import React, { useEffect, useState, useRef } from 'react';
import { motion, MotionProps } from 'motion/react';

export interface TextScrambleProps extends MotionProps {
  children: string;
  duration?: number;
  speed?: number;
  characterSet?: string;
  as?: React.ElementType;
  className?: string;
  trigger?: boolean;
  onScrambleComplete?: () => void;
}

const DEFAULT_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+~|}{[]:;?><';

export function TextScramble({
  children,
  duration = 1.2,
  speed = 0.04,
  characterSet = DEFAULT_CHARS,
  className,
  as: Component = 'span',
  trigger = true,
  onScrambleComplete,
  ...props
}: TextScrambleProps) {
  const [displayText, setDisplayText] = useState(children);
  const [isScrambling, setIsScrambling] = useState(false);
  const textRef = useRef(children);
  textRef.current = children;

  useEffect(() => {
    if (!trigger) return;

    let isMounted = true;
    setIsScrambling(true);

    const targetText = textRef.current;
    const length = targetText.length;
    const steps = Math.max(1, Math.floor(duration / speed));
    let step = 0;

    const interval = setInterval(() => {
      if (!isMounted) return;

      const progress = step / steps;
      const revealedCount = Math.floor(progress * length);

      let result = '';
      for (let i = 0; i < length; i++) {
        if (targetText[i] === ' ') {
          result += ' ';
        } else if (i < revealedCount) {
          result += targetText[i];
        } else {
          const randomChar =
            characterSet[Math.floor(Math.random() * characterSet.length)];
          result += randomChar;
        }
      }

      setDisplayText(result);
      step++;

      if (step > steps) {
        clearInterval(interval);
        if (isMounted) {
          setDisplayText(targetText);
          setIsScrambling(false);
          if (onScrambleComplete) onScrambleComplete();
        }
      }
    }, speed * 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [trigger, duration, speed, characterSet, children, onScrambleComplete]);

  const MotionComponent = motion.create(Component);

  return (
    <MotionComponent
      className={className}
      aria-label={children}
      {...props}
    >
      {displayText}
    </MotionComponent>
  );
}

export function TextScrambleBasic() {
  return (
    <TextScramble className='font-mono text-sm uppercase'>
      Text Scramble
    </TextScramble>
  );
}

export default TextScramble;
