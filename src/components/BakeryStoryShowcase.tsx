import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, Heart, Wheat, ChefHat, ArrowRight } from 'lucide-react';

export interface BakeryStoryShowcaseProps {
  onExploreCreations?: () => void;
  onOpenCustomOrders?: () => void;
}

const BAKERY_ILLUSTRATION_PATH =
  '/assets/aistudio/BrownieGirlCakes_on_a_Charming_Street_Corner_c537cf77.png';

export const BakeryStoryShowcase: React.FC<BakeryStoryShowcaseProps> = ({
  onExploreCreations,
  onOpenCustomOrders,
}) => {
  return (
    <div className="w-full bg-[#F8F0E5] text-[#3B211B] overflow-hidden border-b border-[#E8D6C3]">
      {/* ===================================================================== */}
      {/* 1. EDITORIAL BAKERY ILLUSTRATION SECTION BELOW HERO                   */}
      {/* Heading: "A Little Corner of Happiness"                               */}
      {/* ===================================================================== */}
      <section
        aria-labelledby="bakery-corner-heading"
        className="relative py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
      >
        {/* Editorial Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center max-w-3xl mx-auto mb-8 sm:mb-12"
        >
          <div className="inline-flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#C47B55] mb-3">
            <span className="w-8 h-px bg-[#C47B55]/50" />
            <span>Welcome to Our Sweet Boutique</span>
            <span className="w-8 h-px bg-[#C47B55]/50" />
          </div>

          <h2
            id="bakery-corner-heading"
            className="font-hero text-3xl sm:text-4xl lg:text-5xl font-bold text-[#23120E] tracking-tight leading-tight text-balance"
          >
            A Little Corner of Happiness
          </h2>

          <p className="mt-3 sm:mt-4 text-sm sm:text-base text-[#3B211B]/80 max-w-2xl mx-auto leading-relaxed font-normal">
            Step into the charming world of BrownieGirlCakes — where the warm aroma of melted
            Belgian chocolate, freshly baked layer cakes, and handmade confections fills the street.
          </p>
        </motion.div>

        {/* Full-Width Editorial Presentation Frame — Complete Uncropped Illustration */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 24 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
          className="relative mx-auto rounded-2xl sm:rounded-3xl p-2 sm:p-3.5 md:p-4 bg-[#FFFDF9] border-2 border-[#E8D6C3] shadow-[0_20px_60px_rgba(35,18,14,0.12)]"
        >
          {/* Inner Gold Accent Hairline Frame */}
          <div className="relative overflow-hidden rounded-xl sm:rounded-2xl border border-[#C47B55]/35 bg-[#23120E]">
            <img
              src={BAKERY_ILLUSTRATION_PATH}
              alt="BrownieGirlCakes handmade brownies and cakes boutique on a charming sunlit street corner"
              className="w-full h-auto block object-contain select-none"
              loading="eager"
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Subtle Editorial Caption Bar */}
          <div className="mt-3 sm:mt-4 px-2 sm:px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#3B211B]/75">
            <div className="flex items-center gap-2 font-editorial italic text-sm sm:text-base text-[#23120E]">
              <Sparkles className="w-4 h-4 text-[#C47B55] shrink-0" />
              <span>BrownieGirlCakes — Handmade Brownies, Layer Cakes &amp; Custom Celebrations</span>
            </div>
            {onExploreCreations && (
              <button
                type="button"
                onClick={onExploreCreations}
                className="inline-flex items-center gap-1.5 font-semibold text-xs text-[#C47B55] hover:text-[#23120E] transition-colors cursor-pointer whitespace-nowrap"
              >
                <span>Explore Our Full Menu</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </motion.div>
      </section>

      {/* Subtle Ornamental Hairline Divider */}
      <div className="max-w-5xl mx-auto px-6 flex items-center justify-center gap-4">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#E8D6C3] to-[#C47B55]/40" />
        <Wheat className="w-4 h-4 text-[#C47B55]/70 shrink-0" />
        <div className="h-px flex-1 bg-gradient-to-l from-transparent via-[#E8D6C3] to-[#C47B55]/40" />
      </div>

      {/* ===================================================================== */}
      {/* 2. AUTHENTIC RECIPES SECTION                                          */}
      {/* Heading: "Authentic Recipes"                                          */}
      {/* ===================================================================== */}
      <section
        aria-labelledby="authentic-recipes-heading"
        className="relative py-14 sm:py-20 px-4 sm:px-6 lg:px-8 bg-[#F8F0E5]"
      >
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-4xl mx-auto text-center"
        >
          <div className="w-12 h-12 rounded-2xl bg-[#FFFDF9] border border-[#E8D6C3] text-[#C47B55] mx-auto flex items-center justify-center shadow-2xs mb-5">
            <ChefHat className="w-6 h-6" />
          </div>

          <span className="block text-[11px] font-bold uppercase tracking-[0.24em] text-[#C47B55] mb-2">
            Time-Honoured Craftsmanship
          </span>

          <h2
            id="authentic-recipes-heading"
            className="font-story text-3xl sm:text-4xl lg:text-5xl font-bold text-[#23120E] tracking-tight leading-tight text-balance"
          >
            Authentic Recipes
          </h2>

          <div className="mt-4 mb-5 flex items-center justify-center gap-2">
            <span className="w-10 h-0.5 bg-[#C47B55]/45 rounded-full" />
            <span className="w-2 h-2 rounded-full bg-[#E5A962]" />
            <span className="w-10 h-0.5 bg-[#C47B55]/45 rounded-full" />
          </div>

          <p className="font-editorial text-lg sm:text-2xl text-[#3B211B]/90 max-w-3xl mx-auto leading-relaxed text-balance">
            &ldquo;Every delicious bite begins with recipes crafted with care and passion. We bring
            you the comforting flavours of homemade goodness, made with ingredients we truly believe
            in.&rdquo;
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs sm:text-sm text-[#3B211B]/75">
            <span>Pure Single-Origin Cocoa</span>
            <span aria-hidden="true" className="text-[#C47B55]">
              &middot;
            </span>
            <span>Farm-Fresh Creamery Butter</span>
            <span aria-hidden="true" className="text-[#C47B55]">
              &middot;
            </span>
            <span>Zero Artificial Preservatives</span>
          </div>
        </motion.div>
      </section>

      {/* Subtle Ornamental Hairline Divider */}
      <div className="max-w-5xl mx-auto px-6 flex items-center justify-center gap-4">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#E8D6C3] to-[#C47B55]/40" />
        <Heart className="w-4 h-4 text-[#C47B55]/70 shrink-0" />
        <div className="h-px flex-1 bg-gradient-to-l from-transparent via-[#E8D6C3] to-[#C47B55]/40" />
      </div>

      {/* ===================================================================== */}
      {/* 3. BAKED WITH LOVE SECTION                                            */}
      {/* Heading: "Baked with Love"                                            */}
      {/* ===================================================================== */}
      <section
        aria-labelledby="baked-with-love-heading"
        className="relative py-14 sm:py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#F8F0E5] to-[#FFFDF9]"
      >
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.65, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-4xl mx-auto text-center"
        >
          <div className="w-12 h-12 rounded-2xl bg-[#23120E] border border-[#C47B55]/40 text-[#E5A962] mx-auto flex items-center justify-center shadow-sm mb-5">
            <Heart className="w-5 h-5 fill-[#E5A962]" />
          </div>

          <span className="block text-[11px] font-bold uppercase tracking-[0.24em] text-[#C47B55] mb-2">
            Small-Batch Dedication
          </span>

          <h2
            id="baked-with-love-heading"
            className="font-story text-3xl sm:text-4xl lg:text-5xl font-bold text-[#23120E] tracking-tight leading-tight text-balance"
          >
            Baked with Love
          </h2>

          <div className="mt-4 mb-5 flex items-center justify-center gap-2">
            <span className="w-10 h-0.5 bg-[#C47B55]/45 rounded-full" />
            <span className="w-2 h-2 rounded-full bg-[#C47B55]" />
            <span className="w-10 h-0.5 bg-[#C47B55]/45 rounded-full" />
          </div>

          <p className="font-editorial text-lg sm:text-2xl text-[#3B211B]/90 max-w-3xl mx-auto leading-relaxed text-balance">
            &ldquo;From the first mix to the final decoration, every creation is made with love and
            attention to detail. Because we believe every celebration deserves something truly
            special.&rdquo;
          </p>

          {(onExploreCreations || onOpenCustomOrders) && (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {onExploreCreations && (
                <button
                  type="button"
                  onClick={onExploreCreations}
                  className="px-6 py-3 rounded-full bg-[#3B211B] hover:bg-[#23120E] text-[#F8F0E5] font-semibold text-xs sm:text-sm tracking-wide shadow-sm transition-all cursor-pointer whitespace-nowrap"
                >
                  Browse Cakes &amp; Brownies
                </button>
              )}
              {onOpenCustomOrders && (
                <button
                  type="button"
                  onClick={onOpenCustomOrders}
                  className="px-6 py-3 rounded-full bg-[#FFFDF9] hover:bg-[#F8F0E5] text-[#3B211B] border border-[#C47B55]/50 font-semibold text-xs sm:text-sm tracking-wide transition-all cursor-pointer whitespace-nowrap"
                >
                  Custom Celebration Orders
                </button>
              )}
            </div>
          )}
        </motion.div>
      </section>
    </div>
  );
};

export default BakeryStoryShowcase;
