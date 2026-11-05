import React, { useState, useRef, useEffect, type FC } from 'react';
import {
  motion,
  AnimatePresence,
  MotionConfig,
} from 'motion/react';
import {
  LayoutGrid,
  Cake,
  Cherry,
  Sparkles,
  Crown,
  Cookie,
  SlidersHorizontal,
  Check,
  Package,
  ShoppingBag,
} from 'lucide-react';
import { BrownieItem } from '../../data/brownies';
import { formatRupee } from '../../utils/formatters';

export interface FilterItem {
  id: string;
  label: string;
  count?: number;
  icon: React.ComponentType<{ className?: string }>;
}

interface FilterDisclosureProps {
  items?: FilterItem[];
  activeId?: string;
  defaultActiveId?: string;
  onChange?: (id: string) => void;
  menuProducts?: BrownieItem[];
  onSelectProduct?: (product: BrownieItem) => void;
}

const SPRING = {
  type: 'spring',
  stiffness: 260,
  damping: 24,
  mass: 0.9,
} as const;

export const DEFAULT_CAKE_FILTER_ITEMS: FilterItem[] = [
  { id: 'all', label: 'All Menus', icon: LayoutGrid },
  { id: 'cake_menu', label: 'Cake Menu', icon: Cake },
  { id: 'cake_normal', label: 'Normal Flavours', icon: Cherry },
  { id: 'cake_premium', label: 'Premium Flavours', icon: Crown },
  { id: 'brownie', label: 'Brownies', icon: Cookie },
  { id: 'assorted_box', label: 'Assorted Boxes', icon: Package },
  { id: 'frosted_brownie', label: 'Frosted Brownies', icon: Sparkles },
  { id: 'bento_cake', label: 'Bento Cakes', icon: Cake },
];

export const FilterDisclosure: FC<FilterDisclosureProps> = ({
  items = DEFAULT_CAKE_FILTER_ITEMS,
  activeId,
  defaultActiveId = 'all',
  onChange,
  menuProducts = [],
  onSelectProduct,
}) => {
  const [open, setOpen] = useState(false);
  const [internalActive, setInternalActive] = useState(defaultActiveId);
  const containerRef = useRef<HTMLDivElement>(null);

  const active = activeId !== undefined ? activeId : internalActive;
  const activeItem = items.find((i) => i.id === active) || items[0];
  const ActiveIcon = activeItem ? activeItem.icon : LayoutGrid;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleSelect = (id: string) => {
    setInternalActive(id);
    setOpen(false);
    onChange?.(id);
  };

  const handleProductClick = (product: BrownieItem) => {
    setOpen(false);
    onSelectProduct?.(product);
  };

  // Filter products matching the active category so newly added Admin Panel items are also directly accessible
  const matchingProducts = menuProducts.filter((p) => {
    if (p.enabled === false) return false;
    const cat = p.category || 'brownie';
    if (active === 'all') return true;
    if (active === 'cake_menu') return cat === 'cake_normal' || cat === 'cake_premium';
    return cat === active;
  });

  return (
    <div
      ref={containerRef}
      className="relative flex h-[48px] items-center justify-end select-none shrink-0"
    >
      <MotionConfig
        transition={{
          type: 'spring',
          bounce: 0.2,
          duration: 0.5,
        }}
      >
        <AnimatePresence initial={false}>
          {open ? (
            <motion.div
              key="open-panel"
              initial={{ opacity: 0, scale: 0.95, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{
                opacity: 0,
                scale: 0.96,
                y: -4,
                transition: { duration: 0.14 },
              }}
              style={{ transformOrigin: '100% 0%', borderRadius: 26 }}
              className="absolute right-0 top-0 z-50 flex w-[300px] sm:w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-[3px] overflow-hidden rounded-3xl border-[1.6px] border-[#E8D6C3] bg-[#FFFDF9] p-[10px] shadow-[0_20px_54px_rgba(35,18,14,0.22)]"
            >
              <div className="px-2.5 pt-1 pb-1.5 flex items-center justify-between border-b border-[#E8D6C3]/70 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#C47B55]">
                  Browse Menu Categories
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-[11px] font-bold text-[#3B211B]/60 hover:text-[#23120E] cursor-pointer px-1.5 py-0.5 rounded-md hover:bg-[#F8F0E5]"
                >
                  Close
                </button>
              </div>

              <div className="flex flex-col gap-[3px] max-h-[300px] overflow-y-auto pr-0.5">
                {items.map((item, index) => {
                  const Icon = item.icon;
                  const selected = active === item.id;

                  return (
                    <motion.button
                      key={item.id}
                      type="button"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => handleSelect(item.id)}
                      whileTap={{ scale: 0.98 }}
                      transition={{ ...SPRING, delay: index * 0.025 }}
                      className={`flex w-full cursor-pointer items-center justify-between rounded-[14px] px-[11px] py-[8.5px] transition-colors ${
                        selected
                          ? 'bg-[#3B211B] text-[#F8F0E5] shadow-2xs'
                          : 'hover:bg-[#F8F0E5] text-[#3B211B]'
                      }`}
                    >
                      <div className="flex items-center gap-[11px] min-w-0">
                        <Icon
                          className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                            selected ? 'text-[#E5A962]' : 'text-[#C47B55]'
                          }`}
                        />
                        <span
                          className={`text-[13.5px] font-bold tracking-tight truncate ${
                            selected ? 'text-[#F8F0E5]' : 'text-[#23120E]'
                          }`}
                        >
                          {item.label}
                        </span>
                        {typeof item.count === 'number' && (
                          <span
                            className={`text-[11px] font-mono shrink-0 ${
                              selected ? 'text-[#E5A962]' : 'text-[#3B211B]/60'
                            }`}
                          >
                            ({item.count})
                          </span>
                        )}
                      </div>

                      <div
                        className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[2px] transition-colors ${
                          selected
                            ? 'border-[#E5A962] bg-[#C47B55]'
                            : 'border-[#D5C3B0] bg-transparent'
                        }`}
                      >
                        {selected && <Check className="h-[13px] w-[13px] text-white stroke-[3]" />}
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {/* Live Menu Items List (including any items added from Admin Panel) */}
              {matchingProducts.length > 0 && onSelectProduct && (
                <div className="mt-1.5 pt-2 border-t border-[#E8D6C3]">
                  <div className="px-2 pb-1.5 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#3B211B]/70">
                      {activeItem?.label || 'All Menus'} Items ({matchingProducts.length})
                    </span>
                    <span className="text-[10px] text-[#C47B55] font-semibold">Tap to order</span>
                  </div>
                  <div className="max-h-[190px] overflow-y-auto space-y-1 pr-0.5">
                    {matchingProducts.map((prod) => {
                      const prodCat = prod.category || 'brownie';
                      const isWeightBased =
                        prodCat === 'cake_normal' ||
                        prodCat === 'cake_premium' ||
                        prodCat === 'brownie' ||
                        prodCat === 'bento_cake';
                      const displayPrice = isWeightBased
                        ? formatRupee(prod.priceHalfKg || prod.price || '₹500')
                        : formatRupee(prod.price || '₹150');

                      return (
                        <button
                          key={prod.id}
                          type="button"
                          onClick={() => handleProductClick(prod)}
                          className="w-full flex items-center justify-between gap-2.5 px-2 py-1.5 rounded-xl hover:bg-[#F8F0E5] text-left transition-colors cursor-pointer group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              src={prod.image}
                              alt={prod.name}
                              className="w-8 h-8 rounded-lg object-cover border border-[#E8D6C3] shrink-0"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                  'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?q=80&w=300&auto=format&fit=crop';
                              }}
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-[#23120E] group-hover:text-[#C47B55] truncate">
                                {prod.name}
                              </p>
                              <p className="text-[10px] text-[#3B211B]/65 truncate">
                                {isWeightBased ? `½ KG: ${displayPrice}` : displayPrice}
                              </p>
                            </div>
                          </div>
                          <ShoppingBag className="w-3.5 h-3.5 text-[#C47B55] shrink-0 opacity-75 group-hover:opacity-100" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Trigger Button */}
        <div className="flex items-center">
          <motion.button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            style={{
              borderRadius: 32,
            }}
            aria-label="Open Menu Categories"
            aria-expanded={open}
            title={`Menu Filter (${activeItem?.label || 'All Menus'})`}
            className="z-30 flex h-[44px] px-3.5 gap-2 cursor-pointer items-center justify-center rounded-full border-[1.6px] border-[#E8D6C3] bg-[#FFFDF9] hover:border-[#C47B55] shadow-xs"
          >
            <SlidersHorizontal className="h-[17px] w-[17px] text-[#23120E]" />
            <span className="text-xs font-bold text-[#23120E] whitespace-nowrap">
              {activeItem?.label || 'All Menus'}
            </span>
          </motion.button>

          <motion.button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="z-10 -ml-[8px] flex h-[44px] w-[44px] cursor-pointer items-center justify-center rounded-full border-[1.6px] border-[#E8D6C3] bg-[#F8F0E5] hover:border-[#C47B55] opacity-95 shadow-xs"
            aria-label="Current Menu Category"
          >
            <ActiveIcon className="h-[18px] w-[18px] text-[#C47B55]" />
          </motion.button>
        </div>
      </MotionConfig>
    </div>
  );
};

export default FilterDisclosure;
