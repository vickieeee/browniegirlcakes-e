'use client';
import { cn } from '@/lib/utils';
import { useMotionValue, animate, motion, AnimationPlaybackControls } from 'motion/react';
import React, { useState, useEffect, useRef } from 'react';
import useMeasure from 'react-use-measure';

export type InfiniteSliderProps = {
  children: React.ReactNode;
  gap?: number;
  speed?: number;
  speedOnHover?: number;
  pauseOnHover?: boolean;
  pauseOnTouch?: boolean;
  direction?: 'horizontal' | 'vertical';
  reverse?: boolean;
  className?: string;
};

export function InfiniteSlider({
  children,
  gap = 16,
  speed = 100,
  speedOnHover,
  pauseOnHover = true,
  pauseOnTouch = true,
  direction = 'horizontal',
  reverse = false,
  className,
}: InfiniteSliderProps) {
  const [isPaused, setIsPaused] = useState(false);
  const [ref, { width, height }] = useMeasure();
  const translation = useMotionValue(0);
  const controlsRef = useRef<AnimationPlaybackControls | null>(null);

  useEffect(() => {
    const size = direction === 'horizontal' ? width : height;
    if (!size || size === 0) return;

    const contentSize = size + gap;
    const from = reverse ? -contentSize / 2 : 0;
    const to = reverse ? 0 : -contentSize / 2;

    if (isPaused) {
      controlsRef.current?.stop();
      return;
    }

    const currentPos = translation.get();
    // Wrap current position if outside bounds
    let normalizedPos = currentPos;
    if (reverse) {
      if (normalizedPos > 0) normalizedPos = from;
      if (normalizedPos < from) normalizedPos = from;
    } else {
      if (normalizedPos < to) normalizedPos = 0;
      if (normalizedPos > 0) normalizedPos = 0;
    }
    translation.set(normalizedPos);

    const remainingDistance = Math.abs(to - normalizedPos);
    const duration = remainingDistance / (speed || 50);

    const startLoop = () => {
      translation.set(from);
      const loopDistance = Math.abs(to - from);
      const loopDuration = loopDistance / (speed || 50);

      controlsRef.current = animate(translation, to, {
        ease: 'linear',
        duration: loopDuration,
        repeat: Infinity,
        repeatType: 'loop',
        onRepeat: () => {
          translation.set(from);
        },
      });
    };

    // First animate remaining distance, then loop seamlessly
    if (remainingDistance > 1) {
      controlsRef.current = animate(translation, to, {
        ease: 'linear',
        duration,
        onComplete: startLoop,
      });
    } else {
      startLoop();
    }

    return () => {
      controlsRef.current?.stop();
    };
  }, [width, height, gap, speed, direction, reverse, isPaused, translation]);

  const handlePointerEnter = () => {
    if (pauseOnHover) setIsPaused(true);
  };

  const handlePointerLeave = () => {
    if (pauseOnHover) setIsPaused(false);
  };

  const handleTouchStart = () => {
    if (pauseOnTouch) setIsPaused(true);
  };

  const handleTouchEnd = () => {
    if (pauseOnTouch) setIsPaused(false);
  };

  return (
    <div
      className={cn('overflow-hidden select-none', className)}
      onMouseEnter={handlePointerEnter}
      onMouseLeave={handlePointerLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <motion.div
        className="flex w-max cursor-grab active:cursor-grabbing"
        style={{
          ...(direction === 'horizontal'
            ? { x: translation }
            : { y: translation }),
          gap: `${gap}px`,
          flexDirection: direction === 'horizontal' ? 'row' : 'column',
        }}
        ref={ref}
      >
        {children}
        {children}
      </motion.div>
    </div>
  );
}

export default InfiniteSlider;
