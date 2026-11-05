import React from 'react';
import { Award, Trophy, Users, Star, Cake, Sparkles, Phone, CheckCircle2 } from 'lucide-react';
import { useContent } from '../context/ContentContext';

interface AchievementSectionProps {
  onOpenContact: () => void;
  onOpenClasses: () => void;
}

export const AchievementSection: React.FC<AchievementSectionProps> = ({
  onOpenContact,
  onOpenClasses,
}) => {
  const { achievements, settings } = useContent();

  const stats = [
    {
      icon: Cake,
      value: achievements.stat1Value,
      label: achievements.stat1Label,
      description: achievements.stat1Desc,
    },
    {
      icon: Users,
      value: achievements.stat2Value,
      label: achievements.stat2Label,
      description: achievements.stat2Desc,
    },
    {
      icon: Star,
      value: achievements.stat3Value,
      label: achievements.stat3Label,
      description: achievements.stat3Desc,
    },
    {
      icon: Trophy,
      value: achievements.stat4Value,
      label: achievements.stat4Label,
      description: achievements.stat4Desc,
    },
  ];

  const awards = [
    {
      title: achievements.award1Title,
      organization: achievements.award1Org,
      note: achievements.award1Note,
    },
    {
      title: achievements.award2Title,
      organization: achievements.award2Org,
      note: achievements.award2Note,
    },
    {
      title: achievements.award3Title,
      organization: achievements.award3Org,
      note: achievements.award3Note,
    },
  ];

  return (
    <section className="py-20 bg-[#F8F0E5] relative overflow-hidden border-b border-[#E8D6C3]" id="achievements">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E8D6C3] text-[#3B211B] text-xs font-semibold tracking-wider uppercase mb-3">
            <Trophy className="w-3.5 h-3.5 text-[#C47B55]" />
            Our Sweet Milestones & Achievements
          </div>
          <h2 className="font-stats text-3xl sm:text-4xl lg:text-5xl font-bold text-[#3B211B] tracking-tight">
            Recognized for Passion, Perfected for You
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#3B211B]/80 leading-relaxed">
            Every award and five-star review reflects our uncompromised dedication to authentic ingredients, slow baking, and hands-on teaching.
          </p>
        </div>

        {/* 4 Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {stats.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div
                key={idx}
                className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E8D6C3] shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group"
              >
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-[#F8F0E5] border border-[#C47B55]/30 text-[#C47B55] flex items-center justify-center mb-5 group-hover:bg-[#3B211B] group-hover:text-[#F8F0E5] transition-colors">
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="font-stats text-3xl sm:text-4xl font-extrabold text-[#3B211B] tracking-tight block">
                    {stat.value}
                  </span>
                  <h3 className="font-bold text-sm sm:text-base text-[#C47B55] mt-1">
                    {stat.label}
                  </h3>
                </div>
                <p className="text-xs text-[#3B211B]/70 mt-3 leading-relaxed">
                  {stat.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Accolades & Certifications Banner */}
        <div className="bg-[#3B211B] rounded-3xl p-8 sm:p-10 text-[#F8F0E5] border border-[#C47B55]/40 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-[#C47B55]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
            {awards.map((award, i) => (
              <div
                key={i}
                className="p-5 rounded-2xl bg-[#23120E]/70 border border-[#C47B55]/30 flex flex-col justify-between space-y-3"
              >
                <div className="flex items-center gap-2 text-[#E5A962]">
                  <Award className="w-5 h-5 shrink-0" />
                  <span className="text-xs uppercase tracking-wider font-semibold">
                    {award.organization}
                  </span>
                </div>
                <h4 className="font-editorial text-xl font-bold text-[#F8F0E5]">
                  {award.title}
                </h4>
                <p className="text-xs text-[#E8D6C3]/80 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#C47B55] shrink-0" />
                  <span>{award.note}</span>
                </p>
              </div>
            ))}
          </div>

          {/* Contact & Phone Hotline Banner Inside Achievements */}
          <div className="mt-8 pt-8 border-t border-[#C47B55]/30 flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10">
            <div className="flex items-center gap-4 text-center sm:text-left">
              <div className="w-12 h-12 rounded-full bg-[#C47B55] text-white flex items-center justify-center shrink-0 shadow-md">
                <Phone className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#E5A962]">
                  Direct Orders & Studio Hotline
                </p>
                <p className="font-serif text-xl sm:text-2xl font-bold text-white">
                  Call Us:{' '}
                  <a
                    href={`tel:${settings.phoneRaw}`}
                    className="hover:text-[#E5A962] transition-colors underline decoration-[#C47B55]"
                  >
                    {settings.phone}
                  </a>{' '}
                  <span className="text-xs font-normal text-[#E8D6C3]/80 hidden sm:inline">
                    / {settings.phoneRaw}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <a
                href={`tel:${settings.phoneRaw}`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#C47B55] hover:bg-[#D98B5F] text-[#F8F0E5] text-xs sm:text-sm font-semibold tracking-wide transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <Phone className="w-4 h-4" />
                <span>Call Directly</span>
              </a>
              <button
                onClick={onOpenContact}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white/10 hover:bg-white/20 text-[#E8D6C3] hover:text-white border border-[#C47B55]/50 text-xs sm:text-sm font-semibold transition-all cursor-pointer"
              >
                <span>Send Inquiry</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
