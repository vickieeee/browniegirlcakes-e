import React from 'react';
import {
  Carousel,
  CarouselContent,
  CarouselNavigation,
  CarouselItem,
} from '@/components/core/carousel';
import { useContent } from '../context/ContentContext';
import { SIGNATURE_BROWNIES, BrownieItem } from '../data/brownies';
import { useAuth } from '../context/AuthContext';
import { formatRupee } from '../utils/formatters';
import { Heart, Sparkles, ShoppingBag } from 'lucide-react';

interface CarouselSpacingProps {
  onSelectBrownie?: (brownie: BrownieItem) => void;
  onViewAllCreations?: () => void;
}

export function CarouselSpacing({
  onSelectBrownie,
  onViewAllCreations,
}: CarouselSpacingProps = {}) {
  const { menuItems } = useContent();
  const brownies = menuItems && menuItems.length > 0 ? menuItems : SIGNATURE_BROWNIES;
  const { userProfile, toggleFavorite, user, signInWithGoogle } = useAuth();

  const handleFavoriteClick = async (e: React.MouseEvent, brownieId: string) => {
    e.stopPropagation();
    if (!user) {
      const signedInUser = await signInWithGoogle();
      if (!signedInUser) return;
    }
    await toggleFavorite(brownieId);
  };

  return (
    <div className='relative w-full px-4'>
      <Carousel>
        <CarouselContent className='-ml-4'>
          {brownies.map((brownie, idx) => {
            const isFav = userProfile?.favorites?.includes(brownie.id);
            const displayNumber = idx + 1;

            return (
              <CarouselItem
                key={brownie.id || idx}
                className='basis-full sm:basis-1/2 md:basis-1/3 pl-4'
              >
                <div
                  onClick={() => onSelectBrownie?.(brownie)}
                  className='group relative flex aspect-square flex-col justify-between overflow-hidden rounded-3xl border border-zinc-200 bg-[#23120E] p-5 shadow-lg transition-all duration-300 hover:border-[#C47B55] hover:shadow-2xl dark:border-zinc-800 cursor-pointer'
                >
                  {/* Photo with Dark Vignette */}
                  <img
                    src={brownie.image}
                    alt={brownie.name}
                    className='absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-108'
                  />
                  <div className='absolute inset-0 bg-gradient-to-t from-[#1F0F0C] via-[#1F0F0C]/50 to-black/30' />

                  {/* Top Bar with Number Badge & Heart */}
                  <div className='relative z-10 flex items-center justify-between'>
                    <div className='flex items-center gap-2'>
                      {/* Number badge matching the template */}
                      <span className='flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900/80 text-xs font-mono font-bold text-[#E5A962] border border-[#C47B55]/40 shadow-xs backdrop-blur-xs'>
                        {displayNumber}
                      </span>
                      {brownie.badge && (
                        <span className='rounded-full bg-[#C47B55] px-2.5 py-0.5 text-[10px] font-bold text-white shadow-xs'>
                          {brownie.badge}
                        </span>
                      )}
                    </div>

                    <button
                      type='button'
                      onClick={(e) => handleFavoriteClick(e, brownie.id)}
                      className='flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-xs transition-transform active:scale-90 hover:bg-black/90'
                      aria-label='Toggle favorite'
                    >
                      <Heart
                        className={`h-4 w-4 transition-colors ${
                          isFav ? 'fill-red-500 text-red-500' : 'text-white'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Bottom Information */}
                  <div className='relative z-10 space-y-1.5'>
                    <div className='flex items-center justify-between gap-2'>
                      <span className='text-[10px] font-bold uppercase tracking-wider text-[#E5A962]'>
                        {brownie.cocoaPercentage}
                      </span>
                      <span className='font-mono text-sm font-bold text-white bg-[#C47B55]/90 px-2.5 py-0.5 rounded-full'>
                        {formatRupee(brownie.price)}
                      </span>
                    </div>

                    <h4 className='font-gallery text-lg sm:text-xl font-bold text-white drop-shadow-xs line-clamp-1 group-hover:text-[#E5A962] transition-colors'>
                      {brownie.name}
                    </h4>

                    <p className='line-clamp-2 text-xs text-[#E8D6C3]/80 leading-relaxed'>
                      {brownie.description}
                    </p>

                    <div className='pt-2 flex items-center justify-between border-t border-white/10 text-xs'>
                      <div className='flex items-center gap-1 text-[11px] text-[#E8D6C3]/70 truncate max-w-[140px]'>
                        <Sparkles className='h-3 w-3 text-[#E5A962] shrink-0' />
                        <span className='truncate'>{brownie.flavorNotes?.[0] || 'Artisan Batch'}</span>
                      </div>
                      <span className='font-semibold text-[#E5A962] group-hover:underline flex items-center gap-1'>
                        <ShoppingBag className='h-3 w-3' /> Order Box
                      </span>
                    </div>
                  </div>
                </div>
              </CarouselItem>
            );
          })}
        </CarouselContent>
        <CarouselNavigation
          className='absolute -bottom-20 left-auto top-auto w-full justify-end gap-2'
          classNameButton='bg-zinc-800 *:stroke-zinc-50 dark:bg-zinc-200 dark:*:stroke-zinc-800'
          alwaysShow
        />
      </Carousel>
    </div>
  );
}

export default CarouselSpacing;
