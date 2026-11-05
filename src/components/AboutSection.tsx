import React from 'react';
import { Heart, Sparkles, Award, ChefHat, Flame, Coffee, Phone, Instagram } from 'lucide-react';
import { useContent } from '../context/ContentContext';
import { getInstagramUrl } from '../utils/formatters';

interface AboutSectionProps {
  onJoinClass: () => void;
  onExploreCreations: () => void;
}

export const AboutSection: React.FC<AboutSectionProps> = ({
  onJoinClass,
  onExploreCreations,
}) => {
  const { settings, bakingClasses } = useContent();

  return (
    <section id="about-section" className="py-20 bg-[#F8F0E5] relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Visual Showcase */}
          <div className="relative">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-[#E8D6C3] bg-[#23120E] aspect-4/3">
              <img
                src={settings.aboutImage}
                alt="Head baker crafting artisanal brownies in kitchen"
                className="w-full h-full object-cover object-[70%_center]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1A0B08]/80 via-transparent to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 p-4 rounded-2xl bg-[#3B211B]/90 backdrop-blur-md border border-[#C47B55]/40 text-[#F8F0E5]">
                <p className="font-editorial italic text-base sm:text-lg">
                  "Every batch starts with genuine respect for single-origin cocoa and honest, slow baking."
                </p>
                <p className="text-xs font-semibold text-[#E5A962] mt-2">
                  — Elena & the BrowineGirlCakes Kitchen
                </p>
              </div>
            </div>

            {/* Small Floating Accent Card */}
            <div className="hidden sm:flex absolute -bottom-6 -right-6 bg-white p-4 rounded-2xl shadow-xl border border-[#E8D6C3] items-center gap-3 max-w-xs">
              <div className="w-10 h-10 rounded-full bg-[#C47B55]/15 text-[#C47B55] flex items-center justify-center shrink-0">
                <ChefHat className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#3B211B]">Small-Batch Guarantee</p>
                <p className="text-[11px] text-[#3B211B]/70">No preservatives, 100% natural butter & cocoa.</p>
              </div>
            </div>
          </div>

          {/* Story Content */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E8D6C3] text-[#3B211B] text-xs font-semibold tracking-wider uppercase">
              <Heart className="w-3.5 h-3.5 text-[#C47B55] fill-[#C47B55]" />
              The Baker Behind the Brand
            </div>

            <h2 className="font-story text-3xl sm:text-4xl lg:text-5xl font-bold text-[#3B211B] leading-tight">
              Baked with Passion. Perfected with Love.
            </h2>

            <p className="text-base text-[#3B211B]/80 leading-relaxed">
              BrowineGirlCakes began with a simple craving for the quintessential brownie: a glossy, paper-thin crackle on top that gives way to a velvety, molten-rich chocolate core. Dissatisfied with dry, cakey imitations, we spent years refining temperature curves, cocoa butter ratios, and sugar crystallization.
            </p>

            <p className="text-base text-[#3B211B]/80 leading-relaxed">
              Today, our boutique bakery and hands-on teaching studio welcomes chocolate lovers from all walks of life. Whether you are indulging in our signature squares or joining us by the prep table in an interactive masterclass, we invite you into our sweet world.
            </p>

            {/* Core Values / Highlights */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-white border border-[#E8D6C3]">
                <Flame className="w-5 h-5 text-[#C47B55] mb-2" />
                <h4 className="font-editorial font-bold text-[#3B211B] text-base">Fudgy Perfection</h4>
                <p className="text-xs text-[#3B211B]/70 mt-1">Precise bake timing for deep chocolate decadence.</p>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-[#E8D6C3]">
                <Sparkles className="w-5 h-5 text-[#C47B55] mb-2" />
                <h4 className="font-editorial font-bold text-[#3B211B] text-base">Hands-On Studio</h4>
                <p className="text-xs text-[#3B211B]/70 mt-1">Online &amp; Offline brownie masterclasses.</p>
              </div>
            </div>

            {/* Live Classes Preview (Shows Online / Offline Format & Description on Public Website) */}
            {bakingClasses && bakingClasses.length > 0 && (
              <div className="p-4 rounded-2xl bg-white border border-[#E8D6C3] space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#C47B55]">
                    Available Baking Classes ({bakingClasses.length})
                  </span>
                  <button
                    type="button"
                    onClick={onJoinClass}
                    className="text-xs font-bold text-[#3B211B] hover:text-[#C47B55] underline cursor-pointer"
                  >
                    Book a Seat &rarr;
                  </button>
                </div>
                <div className="space-y-2.5">
                  {bakingClasses.slice(0, 3).map((cls) => {
                    const fmt = cls.format || 'Online';
                    const isOffline =
                      fmt.toLowerCase().includes('offline') && !fmt.toLowerCase().includes('online');
                    return (
                      <div
                        key={cls.id}
                        onClick={onJoinClass}
                        className="p-3 rounded-xl bg-[#F8F0E5]/70 border border-[#E8D6C3] hover:border-[#C47B55] transition-all cursor-pointer space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-xs font-bold text-[#3B211B]">{cls.title}</span>
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              isOffline
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            }`}
                          >
                            {fmt}
                          </span>
                        </div>
                        {cls.description && (
                          <p className="text-[11px] text-[#3B211B]/80 line-clamp-2 leading-relaxed whitespace-pre-line">
                            {cls.description}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* CTAs & Instagram Link */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={onJoinClass}
                className="px-6 py-3 rounded-full bg-[#3B211B] hover:bg-[#23120E] text-[#F8F0E5] font-semibold text-sm tracking-wide shadow-md transition-all cursor-pointer"
              >
                {bakingClasses && bakingClasses.length > 0 ? 'Join a Baking Class' : 'Studio Classes & Waitlist'}
              </button>
              <button
                onClick={onExploreCreations}
                className="px-6 py-3 rounded-full bg-[#E8D6C3] hover:bg-[#d8c3ad] text-[#3B211B] font-semibold text-sm tracking-wide transition-all cursor-pointer"
              >
                Browse Flavors
              </button>
              <a
                href={getInstagramUrl(settings.instagramId)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-3 rounded-full bg-white hover:bg-stone-50 text-[#3B211B] border border-[#E8D6C3] font-semibold text-sm tracking-wide shadow-xs hover:border-[#C47B55] transition-all flex items-center gap-2 cursor-pointer"
                title="Follow our baking journey on Instagram"
              >
                <Instagram className="w-4 h-4 text-[#E5A962]" />
                <span>@browniegirlcakes</span>
              </a>
            </div>

            <div className="pt-2 flex items-center gap-3 text-xs text-[#3B211B]/80">
              <Phone className="w-4 h-4 text-[#C47B55]" />
              <span>Questions or custom requests? Call our head baker directly: </span>
              <a
                href={`tel:${settings.phoneRaw}`}
                className="font-bold text-[#3B211B] hover:text-[#C47B55] underline"
              >
                {settings.phone}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
