import React from 'react';

interface StructuredClassDescriptionProps {
  description?: string;
  fallbackText?: string;
  className?: string;
}

type LineToken =
  | { type: 'empty' }
  | { type: 'heading'; level: 'h3' | 'h4'; text: string }
  | { type: 'bullet'; text: string }
  | { type: 'numbered'; text: string }
  | { type: 'text'; text: string };

type ContentBlock =
  | { kind: 'p'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] };

interface ParsedSection {
  heading?: { level: 'h3' | 'h4'; text: string };
  blocks: ContentBlock[];
}

function classifyLine(rawLine: string, isFirstNonEmpty: boolean): LineToken {
  const trimmed = rawLine.trim();
  if (!trimmed) {
    return { type: 'empty' };
  }

  // 1. Explicit Markdown headings (#, ##, ###)
  const mdMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
  if (mdMatch) {
    return {
      type: 'heading',
      level: mdMatch[1].length <= 2 ? 'h3' : 'h4',
      text: mdMatch[2].trim(),
    };
  }

  // 2. Explicit Bullet points (•, -, *, ▪, ▸, ✓, ✔)
  const bulletMatch = trimmed.match(/^(?:[•\-*▪▸✓✔●◦]|\u2022)\s+(.+)$/);
  if (bulletMatch) {
    return { type: 'bullet', text: bulletMatch[1].trim() };
  }

  // 3. Explicit Numbered list items (1. or 1))
  const numMatch = trimmed.match(/^\d+[\.\)]\s+(.+)$/);
  if (numMatch) {
    return { type: 'numbered', text: numMatch[1].trim() };
  }

  // 4. ALL-CAPS Section Headings (e.g. "CAKE BAKING", "CUPCAKES – 5 FLAVOURS", "ARTISAN BAKING CLASSES")
  const hasLetters = /[A-Z]{2,}/.test(trimmed);
  const isAllUpper = trimmed === trimmed.toUpperCase();
  const endsWithPeriod = trimmed.endsWith('.');
  if (hasLetters && isAllUpper && !endsWithPeriod && trimmed.length <= 95) {
    const isMainBanner =
      isFirstNonEmpty &&
      (trimmed.includes('ARTISAN BAKING CLASSES') ||
        trimmed.includes('MASTERCLASS') ||
        trimmed.includes('CURRICULUM'));
    return {
      type: 'heading',
      level: isMainBanner ? 'h3' : 'h4',
      text: trimmed,
    };
  }

  // 5. Short subheadings ending with a colon (e.g. "Course Highlights:")
  if (trimmed.endsWith(':') && trimmed.length <= 75) {
    return {
      type: 'heading',
      level: 'h4',
      text: trimmed.replace(/:$/, '').trim(),
    };
  }

  return { type: 'text', text: trimmed };
}

function parseStructuredSections(rawDescription: string): ParsedSection[] {
  const normalized = rawDescription.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return [];

  const rawLines = normalized.split('\n');
  const tokens: LineToken[] = [];
  let seenNonEmpty = false;

  for (const line of rawLines) {
    const token = classifyLine(line, !seenNonEmpty);
    if (token.type !== 'empty') {
      seenNonEmpty = true;
    }
    tokens.push(token);
  }

  // Group tokens into sections split by headings
  const rawSections: {
    heading?: { level: 'h3' | 'h4'; text: string };
    tokens: LineToken[];
  }[] = [];

  let currentSection: {
    heading?: { level: 'h3' | 'h4'; text: string };
    tokens: LineToken[];
  } = { tokens: [] };

  for (const token of tokens) {
    if (token.type === 'heading') {
      if (currentSection.heading || currentSection.tokens.some((t) => t.type !== 'empty')) {
        rawSections.push(currentSection);
      }
      currentSection = {
        heading: { level: token.level, text: token.text },
        tokens: [],
      };
    } else {
      currentSection.tokens.push(token);
    }
  }

  if (currentSection.heading || currentSection.tokens.some((t) => t.type !== 'empty')) {
    rawSections.push(currentSection);
  }

  // Convert tokens within each section into structured ContentBlocks (p, ul, ol)
  return rawSections.map((sec) => {
    const blocks: ContentBlock[] = [];
    let pendingTextLines: string[] = [];

    const flushPendingText = (forceParagraphSplit = false) => {
      if (pendingTextLines.length === 0) return;

      const allShortItems =
        pendingTextLines.length >= 2 &&
        pendingTextLines.every((line) => line.length <= 95);

      if (sec.heading && allShortItems && !forceParagraphSplit) {
        // Under a section heading, multiple short lines (like flavours or topics) become a clean bullet list
        const prevBlock = blocks[blocks.length - 1];
        if (prevBlock && prevBlock.kind === 'ul') {
          prevBlock.items.push(...pendingTextLines);
        } else {
          blocks.push({ kind: 'ul', items: [...pendingTextLines] });
        }
      } else if (!sec.heading && pendingTextLines.length >= 3 && pendingTextLines.every((l) => l.length <= 65)) {
        blocks.push({ kind: 'ul', items: [...pendingTextLines] });
      } else {
        blocks.push({ kind: 'p', text: pendingTextLines.join('\n') });
      }
      pendingTextLines = [];
    };

    // Check if the entire section under a heading consists only of short text lines separated by blank lines
    const nonEmptyTokens = sec.tokens.filter((t) => t.type !== 'empty');
    const isAllShortTextUnderHeading =
      Boolean(sec.heading) &&
      nonEmptyTokens.length >= 2 &&
      nonEmptyTokens.every((t) => t.type === 'text' && t.text.length <= 95);

    if (isAllShortTextUnderHeading) {
      blocks.push({
        kind: 'ul',
        items: nonEmptyTokens.map((t) => (t as { type: 'text'; text: string }).text),
      });
      return {
        heading: sec.heading,
        blocks,
      };
    }

    for (const token of sec.tokens) {
      if (token.type === 'empty') {
        // If there are pending plain text lines in a non-heading or multi-paragraph block, flush as paragraph
        if (pendingTextLines.length > 0) {
          flushPendingText(true);
        }
        continue;
      }

      if (token.type === 'bullet') {
        flushPendingText();
        const prev = blocks[blocks.length - 1];
        if (prev && prev.kind === 'ul') {
          prev.items.push(token.text);
        } else {
          blocks.push({ kind: 'ul', items: [token.text] });
        }
        continue;
      }

      if (token.type === 'numbered') {
        flushPendingText();
        const prev = blocks[blocks.length - 1];
        if (prev && prev.kind === 'ol') {
          prev.items.push(token.text);
        } else {
          blocks.push({ kind: 'ol', items: [token.text] });
        }
        continue;
      }

      if (token.type === 'text') {
        pendingTextLines.push(token.text);
      }
    }

    flushPendingText();

    return {
      heading: sec.heading,
      blocks,
    };
  });
}

export const StructuredClassDescription: React.FC<StructuredClassDescriptionProps> = ({
  description,
  fallbackText = 'Hands-on artisan brownie & baking workshop guided step-by-step by our head baker.',
  className = '',
}) => {
  const contentToRender =
    typeof description === 'string' && description.trim().length > 0
      ? description
      : fallbackText;

  const sections = parseStructuredSections(contentToRender);

  return (
    <div className={`space-y-4 ${className}`}>
      {sections.map((section, sIdx) => {
        const isMainBanner = section.heading?.level === 'h3' && section.blocks.length === 0;

        if (isMainBanner && section.heading) {
          return (
            <div
              key={sIdx}
              className="pb-2 border-b-2 border-[#C47B55]/35 flex items-center justify-between"
            >
              <h3 className="font-editorial text-sm sm:text-base font-bold tracking-wider uppercase text-[#3B211B]">
                {section.heading.text}
              </h3>
            </div>
          );
        }

        return (
          <div
            key={sIdx}
            className={
              section.heading
                ? 'p-3.5 sm:p-4 rounded-xl bg-[#F8F0E5]/70 border border-[#E8D6C3] space-y-2'
                : 'space-y-2.5'
            }
          >
            {section.heading &&
              (section.heading.level === 'h3' ? (
                <h3 className="font-editorial text-sm sm:text-base font-bold tracking-wide uppercase text-[#3B211B] border-b border-[#E8D6C3] pb-1.5">
                  {section.heading.text}
                </h3>
              ) : (
                <h4 className="font-sans text-xs sm:text-sm font-bold tracking-wide uppercase text-[#3B211B] flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#C47B55] shrink-0" />
                  <span>{section.heading.text}</span>
                </h4>
              ))}

            {section.blocks.map((block, bIdx) => {
              if (block.kind === 'ul') {
                const useTwoColumns = block.items.length >= 5 && block.items.every((item) => item.length <= 38);
                return (
                  <ul
                    key={bIdx}
                    className={`list-disc pl-5 text-xs sm:text-sm text-[#3B211B]/90 leading-relaxed ${
                      useTwoColumns
                        ? 'grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5'
                        : 'space-y-1.5'
                    }`}
                  >
                    {block.items.map((item, iIdx) => (
                      <li key={iIdx} className="marker:text-[#C47B55] pl-0.5">
                        {item}
                      </li>
                    ))}
                  </ul>
                );
              }

              if (block.kind === 'ol') {
                return (
                  <ol
                    key={bIdx}
                    className="list-decimal pl-5 space-y-1.5 text-xs sm:text-sm text-[#3B211B]/90 leading-relaxed"
                  >
                    {block.items.map((item, iIdx) => (
                      <li key={iIdx} className="marker:text-[#C47B55] marker:font-bold pl-0.5">
                        {item}
                      </li>
                    ))}
                  </ol>
                );
              }

              return (
                <p
                  key={bIdx}
                  className="text-xs sm:text-sm text-[#3B211B]/90 leading-relaxed whitespace-pre-line"
                >
                  {block.text}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};
