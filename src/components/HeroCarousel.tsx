import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, ArrowRight, Heart, Star } from 'lucide-react';

export interface HeroCarouselProps {
  onExploreCreations: () => void;
  onJoinClass: () => void;
  onGetInTouch: () => void;
  onRegisterInterest: () => void;
  onOpenCustomOrders?: () => void;
}

interface SlideData {
  id: number;
  eyebrow?: string;
  headline: string;
  supportingText: string;
  primaryCtaText: string;
  secondaryCtaText: string;
  primaryCtaAction: 'creations' | 'classes' | 'contact' | 'register' | 'custom-orders';
  secondaryCtaAction: 'creations' | 'classes' | 'contact' | 'register' | 'custom-orders';
  image: string;
  imageAlt: string;
  focalPosition: string; // CSS object-position
  overlayGradient: string;
}

import { useContent } from '../context/ContentContext';

const BASE_SLIDES: SlideData[] = [
  {
    id: 1,
    eyebrow: 'HANDCRAFTED WITH LOVE',
    headline: 'A Little Cocoa, A Lot of Love.',
    supportingText:
      'Discover the joy of homemade brownies, baked with passion and perfected with every batch.',
    primaryCtaText: 'Explore Our Creations',
    secondaryCtaText: 'Join a Baking Class',
    primaryCtaAction: 'creations',
    secondaryCtaAction: 'classes',
    image: 'https://images.unsplash.com/photo-1556911073-38141963c9e0?q=85&w=2400&auto=format&fit=crop',
    imageAlt: 'Artisan woman baker mixing rich chocolate brownie batter in warm boutique bakery kitchen',
    focalPosition: 'object-[75%_center] sm:object-[70%_center] md:object-[65%_center]',
    overlayGradient:
      'from-[#1A0B08]/95 via-[#23120E]/80 via-40% to-transparent',
  },
  {
    id: 2,
    headline: 'Happiness Comes in Brownie Squares.',
    supportingText:
      'Rich, fudgy, chocolate-filled goodness made to make every moment sweeter.',
    primaryCtaText: 'Discover Our Brownies',
    secondaryCtaText: 'Custom Orders & Catering',
    primaryCtaAction: 'creations',
    secondaryCtaAction: 'custom-orders',
    image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?q=85&w=2400&auto=format&fit=crop',
    imageAlt: 'Appetizing close-up of decadent, fudgy chocolate brownies with shiny crackly crust and melted chocolate',
    focalPosition: 'object-center sm:object-[60%_center]',
    overlayGradient:
      'from-[#1A0B08]/95 via-[#23120E]/85 via-50% to-[#1A0B08]/30',
  },
  {
    id: 3,
    headline: "Let's Bake Something Beautiful Together.",
    supportingText:
      'Discover the joy of baking and learn to create delicious brownies, one batch at a time.',
    primaryCtaText: 'Explore Baking Classes',
    secondaryCtaText: 'Register Your Interest',
    primaryCtaAction: 'classes',
    secondaryCtaAction: 'register',
    image: 'https://images.unsplash.com/photo-1581299894007-aaa50297cf16?q=85&w=2400&auto=format&fit=crop',
    imageAlt: 'Friendly woman demonstrating brownie preparation in a clean, warm artisan baking studio',
    focalPosition: 'object-[65%_center] sm:object-[60%_center]',
    overlayGradient:
      'from-[#1A0B08]/95 via-[#23120E]/80 via-45% to-transparent',
  },
];

export const HeroCarousel: React.FC<HeroCarouselProps> = ({
  onExploreCreations,
  onJoinClass,
  onGetInTouch,
  onRegisterInterest,
  onOpenCustomOrders,
}) => {
  const { settings, bakingClasses } = useContent();
  const hasClasses = Boolean(bakingClasses && bakingClasses.length > 0);

  const slides: SlideData[] = [
    {
      ...BASE_SLIDES[0],
      secondaryCtaText: hasClasses ? 'Join a Baking Class' : 'Studio Classes & Waitlist',
      image: settings.heroSlide1Image || BASE_SLIDES[0].image,
    },
    {
      ...BASE_SLIDES[1],
      image: settings.heroSlide2Image || BASE_SLIDES[1].image,
    },
    {
      ...BASE_SLIDES[2],
      primaryCtaText: hasClasses ? 'Explore Baking Classes' : 'Join Class Waitlist',
      secondaryCtaText: hasClasses ? 'Register Your Interest' : 'Request Private Workshop',
      image: settings.heroSlide3Image || BASE_SLIDES[2].image,
    },
  ];

  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);
  const slideCount = slides.length;

  // Check for reduced-motion accessibility setting
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const listener = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  // Slide navigation handlers
  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % slideCount);
  }, [slideCount]);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + slideCount) % slideCount);
  }, [slideCount]);

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  // Auto-advance timer (5.5 seconds)
  useEffect(() => {
    if (isPaused || prefersReducedMotion) return;

    const timer = setInterval(() => {
      nextSlide();
    }, 5500);

    return () => clearInterval(timer);
  }, [isPaused, prefersReducedMotion, nextSlide]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      prevSlide();
    } else if (e.key === 'ArrowRight') {
      nextSlide();
    }
  };

  // Touch swipe support for mobile
  const minSwipeDistance = 45;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      nextSlide();
    } else if (isRightSwipe) {
      prevSlide();
    }
  };

  // CTA router
  const handleCtaClick = (action: 'creations' | 'classes' | 'contact' | 'register' | 'custom-orders') => {
    switch (action) {
      case 'creations':
        onExploreCreations();
        break;
      case 'classes':
        onJoinClass();
        break;
      case 'contact':
        onGetInTouch();
        break;
      case 'register':
        onRegisterInterest();
        break;
      case 'custom-orders':
        if (onOpenCustomOrders) {
          onOpenCustomOrders();
        } else {
          onGetInTouch();
        }
        break;
    }
  };

  return (
    <section
      ref={carouselRef}
      className="relative w-full h-[76vh] sm:h-[78vh] min-h-[540px] sm:min-h-[580px] max-h-[850px] bg-[#1A0B08] overflow-hidden select-none"
      aria-label="BrowineGirlCakes Featured Carousel"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      onKeyDown={handleKeyDown}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      tabIndex={0}
      role="region"
      aria-roledescription="carousel"
    >
      {/* Slides Container - Smooth Horizontal Sliding */}
      <div
        className={`w-full h-full flex ${
          prefersReducedMotion ? '' : 'transition-transform duration-700 ease-[cubic-bezier(0.25,1,0.5,1)]'
        }`}
        style={{
          transform: `translateX(-${currentSlide * 100}%)`,
        }}
      >
        {slides.map((slide, index) => {
          const isActive = index === currentSlide;
          return (
            <div
              key={slide.id}
              className="relative w-full h-full shrink-0 flex items-center"
              role="group"
              aria-roledescription="slide"
              aria-label={`Slide ${slide.id} of ${slideCount}: ${slide.headline}`}
              aria-hidden={!isActive}
            >
              {/* Background Edge-to-Edge Image */}
              <div className="absolute inset-0 w-full h-full overflow-hidden">
                <img
                  src={slide.image}
                  alt={slide.imageAlt}
                  className={`w-full h-full object-cover ${slide.focalPosition} transition-transform duration-1000 ${
                    isActive ? 'scale-100' : 'scale-105'
                  }`}
                  loading={index === 0 ? 'eager' : 'lazy'}
                />
              </div>

              {/* Rich Chocolate Gradient Overlays for Optimal Legibility */}
              {/* Desktop Left-to-Right Gradient */}
              <div
                className={`absolute inset-0 bg-gradient-to-r ${slide.overlayGradient} hidden md:block`}
              />
              {/* Mobile/Tablet Bottom-to-Top Gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#1A0B08]/98 via-[#23120E]/85 via-55% to-[#1A0B08]/45 md:hidden" />
              {/* Soft Subtle Vignette */}
              <div className="absolute inset-0 bg-radial-at-c from-transparent via-[#1A0B08]/20 to-[#1A0B08]/80 pointer-events-none" />

              {/* Slide Content - Perfectly Positioned Consistently Across All Slides */}
              <div className="relative z-10 w-full max-w-7xl mx-auto px-5 sm:px-12 lg:px-16 flex items-center">
                <div className="max-w-xl lg:max-w-2xl py-6 pb-16 sm:py-8">
                  {/* Eyebrow Text (for Slide 1 or pill tag for others) */}
                  {slide.eyebrow ? (
                    <div className="inline-flex items-center gap-2 px-3 py-1 sm:py-1.5 rounded-full bg-[#C47B55]/25 border border-[#C47B55]/50 backdrop-blur-md mb-3 sm:mb-5">
                      <Sparkles className="w-3.5 h-3.5 text-[#E5A962]" />
                      <span className="text-[10px] sm:text-xs uppercase tracking-[0.18em] sm:tracking-[0.2em] font-semibold text-[#E8D6C3]">
                        {slide.eyebrow}
                      </span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 px-3 py-1 sm:py-1.5 rounded-full bg-[#3B211B]/60 border border-[#C47B55]/30 backdrop-blur-md mb-3 sm:mb-5">
                      <Star className="w-3.5 h-3.5 text-[#E5A962] fill-[#E5A962]" />
                      <span className="text-[10px] sm:text-xs uppercase tracking-[0.18em] sm:tracking-[0.2em] font-semibold text-[#E8D6C3]">
                        BROWINEGIRLCAKES SIGNATURE
                      </span>
                    </div>
                  )}

                  {/* Main Headline - Hero Display Typography */}
                  <h1 className="font-hero text-[28px] sm:text-5xl lg:text-6xl font-bold text-[#F8F0E5] leading-[1.14] tracking-tight drop-shadow-md">
                    {slide.headline}
                  </h1>

                  {/* Supporting Text - Clean Sans-Serif Typography */}
                  <p className="mt-3 sm:mt-6 text-sm sm:text-lg text-[#E8D6C3]/90 leading-relaxed font-normal max-w-lg drop-shadow-xs">
                    {slide.supportingText}
                  </p>

                  {/* CTA Buttons - Consistent Position & Stacking */}
                  <div className="mt-5 sm:mt-9 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-4">
                    {/* Primary CTA */}
                    <button
                      onClick={() => handleCtaClick(slide.primaryCtaAction)}
                      className="group inline-flex items-center justify-center gap-2.5 px-6 sm:px-7 py-3.5 rounded-full bg-[#C47B55] hover:bg-[#D98B5F] text-[#F8F0E5] font-semibold text-sm sm:text-base tracking-wide shadow-lg hover:shadow-xl hover:shadow-[#C47B55]/30 transition-all duration-300 cursor-pointer active:scale-95 min-h-[46px]"
                    >
                      <span>{slide.primaryCtaText}</span>
                      <ArrowRight className="w-4 h-4 text-[#F8F0E5] group-hover:translate-x-1 transition-transform" />
                    </button>

                    {/* Secondary CTA */}
                    <button
                      onClick={() => handleCtaClick(slide.secondaryCtaAction)}
                      className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-[#23120E]/75 hover:bg-[#3B211B] text-[#E8D6C3] hover:text-[#F8F0E5] font-semibold text-sm sm:text-base tracking-wide border border-[#C47B55]/50 hover:border-[#C47B55] backdrop-blur-md transition-all duration-300 cursor-pointer active:scale-95 min-h-[46px]"
                    >
                      <span>{slide.secondaryCtaText}</span>
                    </button>
                  </div>

                  {/* Small Trust Micro-Pill */}
                  <div className="mt-4 sm:mt-6 flex items-center gap-4 text-[11px] sm:text-xs text-[#E8D6C3]/75">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#E5A962]" />
                      Real Belgian & Valrhona Chocolate
                    </span>
                    <span className="hidden sm:inline text-[#C47B55]">•</span>
                    <span className="hidden sm:inline">Small-Batch Daily Bakes</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation Arrows (Left & Right - Hidden on extra small mobile so they never overlap text) */}
      <button
        onClick={prevSlide}
        className="hidden sm:flex absolute left-4 lg:left-6 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-[#1A0B08]/65 hover:bg-[#3B211B] text-[#E8D6C3] hover:text-[#F8F0E5] border border-[#C47B55]/40 hover:border-[#C47B55] items-center justify-center backdrop-blur-md shadow-lg transition-all duration-300 cursor-pointer hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#C47B55]"
        aria-label="Previous slide"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>

      <button
        onClick={nextSlide}
        className="hidden sm:flex absolute right-4 lg:right-6 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-[#1A0B08]/65 hover:bg-[#3B211B] text-[#E8D6C3] hover:text-[#F8F0E5] border border-[#C47B55]/40 hover:border-[#C47B55] items-center justify-center backdrop-blur-md shadow-lg transition-all duration-300 cursor-pointer hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#C47B55]"
        aria-label="Next slide"
      >
        <ChevronRight className="w-6 h-6" />
      </button>

      {/* Bottom Center Pagination Indicators & Controls */}
      <div className="absolute bottom-3.5 sm:bottom-7 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 sm:gap-3 bg-[#1A0B08]/75 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-[#C47B55]/30 backdrop-blur-md">
        <button
          onClick={prevSlide}
          className="sm:hidden p-1 text-[#E8D6C3]/80 hover:text-white active:scale-90"
          aria-label="Previous slide"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Pagination Dots */}
        <div className="flex items-center gap-2" role="tablist" aria-label="Slide indicators">
          {slides.map((slide, index) => {
            const isActive = index === currentSlide;
            return (
              <button
                key={slide.id}
                onClick={() => goToSlide(index)}
                role="tab"
                aria-selected={isActive}
                aria-label={`Go to slide ${index + 1}: ${slide.headline}`}
                className={`relative h-2.5 rounded-full transition-all duration-500 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#C47B55] ${
                  isActive
                    ? 'w-8 bg-[#C47B55] shadow-xs'
                    : 'w-2.5 bg-[#E8D6C3]/40 hover:bg-[#E8D6C3]/80'
                }`}
              >
                {/* Active Progress Fill Bar */}
                {isActive && !isPaused && !prefersReducedMotion && (
                  <span
                    className="absolute inset-0 bg-[#E5A962] rounded-full origin-left animate-[progress_5.5s_linear]"
                    style={{ animationDuration: '5.5s' }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Vertical Divider */}
        <span className="w-px h-3.5 bg-[#E8D6C3]/30" />

        {/* Slide Counter */}
        <span className="text-[11px] font-mono tracking-wider text-[#E8D6C3]/80">
          0{currentSlide + 1} / 0{slideCount}
        </span>

        <button
          onClick={nextSlide}
          className="sm:hidden p-1 text-[#E8D6C3]/80 hover:text-white active:scale-90"
          aria-label="Next slide"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </section>
  );
};
