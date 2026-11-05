import React from 'react';
import { InfiniteSlider } from '@/components/core/infinite-slider';
import { SIGNATURE_BROWNIES, BrownieItem } from '../data/brownies';
import { useContent } from '../context/ContentContext';
import { Sparkles, Heart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export interface ProgressiveBlurSliderProps {
  onSelectBrownie?: (brownie: BrownieItem) => void;
  onOpenCustomOrders?: () => void;
}

export function ProgressiveBlurSlider({
  onSelectBrownie,
  onOpenCustomOrders,
}: ProgressiveBlurSliderProps = {}) {
  const { menuItems } = useContent();
  const rawBrownies = menuItems && menuItems.length > 0 ? menuItems : SIGNATURE_BROWNIES;
  const brownies = rawBrownies.filter((b) => b.enabled !== false);
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
    <div className='relative h-[370px] w-full overflow-hidden'>
      <InfiniteSlider
        className='flex h-full w-full items-center'
        gap={24}
        speed={45}
        pauseOnHover={true}
        pauseOnTouch={true}
      >
        {brownies.map((brownie, idx) => {
          const isFav = userProfile?.favorites?.includes(brownie.id);
          const itemNum = idx + 1;

          return (
            <div
              key={brownie.id || idx}
              onClick={() => {
                if (onSelectBrownie) onSelectBrownie(brownie);
                else if (onOpenCustomOrders) onOpenCustomOrders();
              }}
              className='group relative flex h-[310px] w-[270px] shrink-0 flex-col justify-between overflow-hidden rounded-3xl border border-zinc-200/80 bg-[#23120E] p-5 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-[#C47B55] hover:shadow-2xl dark:border-zinc-800 cursor-pointer'
            >
              {/* Background Photo */}
              <img
                src={brownie.image}
                alt={brownie.name}
                className='absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-108'
              />
              <div className='absolute inset-0 bg-gradient-to-t from-[#1A0B08]/95 via-[#1A0B08]/45 to-black/30' />

              {/* Top Tag & Heart */}
              <div className='relative z-10 flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <span className='flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900/85 text-xs font-mono font-bold text-[#E5A962] border border-[#C47B55]/40 shadow-xs backdrop-blur-xs'>
                    {itemNum}
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

              {/* Bottom Information (NO PRICE, NO ORDER BUTTON) */}
              <div className='relative z-10 space-y-1.5'>
                <p className='text-[10px] font-bold uppercase tracking-wider text-[#E5A962]'>
                  {brownie.cocoaPercentage}
                </p>

                <h3 className='font-gallery text-lg font-bold text-white drop-shadow-xs line-clamp-1 group-hover:text-[#E5A962] transition-colors'>
                  {brownie.name}
                </h3>

                <p className='line-clamp-2 text-xs text-[#E8D6C3]/80 leading-relaxed'>
                  {brownie.description}
                </p>

                <div className='pt-2 flex items-center justify-between border-t border-white/10 text-xs'>
                  <div className='flex items-center gap-1 text-[11px] text-[#E8D6C3]/70 truncate max-w-[160px]'>
                    <Sparkles className='h-3 w-3 text-[#E5A962] shrink-0' />
                    <span className='truncate'>{brownie.flavorNotes?.[0] || 'Artisan Batch'}</span>
                  </div>
                  <span className='text-[11px] font-semibold text-[#E5A962] group-hover:underline'>
                    Custom Order &rarr;
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </InfiniteSlider>
    </div>
  );
}

export default ProgressiveBlurSlider;
