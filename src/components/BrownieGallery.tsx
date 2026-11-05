import React, { useState, useEffect } from 'react';
import { SIGNATURE_BROWNIES, BrownieItem } from '../data/brownies';
import { useContent } from '../context/ContentContext';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  ShoppingBag,
  Plus,
  Minus,
  Check,
  LayoutGrid,
  Cake,
  Cherry,
  Crown,
  Cookie,
  Package,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart, parsePriceNumber } from '../context/CartContext';
import { formatRupee } from '../utils/formatters';
import { FilterDisclosure, FilterItem } from './core/filter-disclosure';

export type GalleryMenuFilterId =
  | 'all'
  | 'cake_menu'
  | 'cake_normal'
  | 'cake_premium'
  | 'brownie'
  | 'assorted_box'
  | 'frosted_brownie'
  | 'bento_cake';

export interface BrownieGalleryProps {
  onSelectBrownie?: (brownie: BrownieItem, initialWeight?: '½ KG' | '1 KG') => void;
  onViewAllCreations?: () => void;
  onOpenCustomOrders?: () => void;
  activeMenuFilter?: GalleryMenuFilterId;
  onMenuFilterChange?: (filterId: GalleryMenuFilterId) => void;
}

export interface ProgressiveBlurSliderProps {
  onSelectBrownie?: (brownie: BrownieItem, initialWeight?: '½ KG' | '1 KG') => void;
  onOpenCustomOrders?: () => void;
}

interface MenuCardProps {
  item: BrownieItem;
  isFav: boolean;
  isSignedIn: boolean;
  onFavorite: (e: React.MouseEvent, id: string) => void;
  onClick: (selectedWeight?: '½ KG' | '1 KG') => void;
  priceMode: 'half_and_full_kg' | 'box' | 'frosted' | 'per_kg';
  onQuickAddToCart?: (
    item: BrownieItem,
    qty: number,
    selectedWeight?: '½ KG' | '1 KG'
  ) => Promise<boolean>;
}

const CATEGORY_EYEBROW_LABELS: Record<string, string> = {
  cake_normal: 'CLASSIC CAKE COLLECTION',
  cake_premium: 'PREMIUM CAKE COLLECTION',
  brownie: 'CLASSIC COLLECTION',
  assorted_box: 'CURATED GIFT BOX',
  frosted_brownie: 'FROSTED COLLECTION',
  bento_cake: 'BENTO CAKE COLLECTION',
};

const MenuCatalogCard: React.FC<MenuCardProps> = ({
  item,
  isFav,
  onFavorite,
  onClick,
  priceMode,
  onQuickAddToCart,
}) => {
  const [qty, setQty] = useState(1);
  const [selectedWeight, setSelectedWeight] = useState<'½ KG' | '1 KG'>('½ KG');
  const [justAdded, setJustAdded] = useState(false);

  const isWeightBased = priceMode === 'half_and_full_kg' || priceMode === 'per_kg';

  const unitPrice = formatRupee(item.price || '₹150');
  const halfKg = item.priceHalfKg ? formatRupee(item.priceHalfKg) : formatRupee(item.price || '₹490');
  const oneKg = item.priceOneKg ? formatRupee(item.priceOneKg) : formatRupee(item.price || '₹950');
  const mainPrice = formatRupee(item.price || item.priceOneKg || item.priceHalfKg || '₹490');

  const activePrice = isWeightBased
    ? selectedWeight === '1 KG'
      ? oneKg
      : halfKg
    : priceMode === 'box'
    ? mainPrice
    : unitPrice;

  const priceLabel = isWeightBased
    ? `Price (${selectedWeight})`
    : priceMode === 'box'
    ? 'Box price'
    : 'Starting from';

  const eyebrowText =
    CATEGORY_EYEBROW_LABELS[item.category || 'brownie'] || 'CLASSIC COLLECTION';

  const descriptionText = (item.description || item.subtitle || '').trim();

  const metaDetails: string[] = [];
  if (item.cocoaPercentage) {
    metaDetails.push(item.cocoaPercentage);
  } else if (item.flavorNotes && item.flavorNotes.length > 0) {
    metaDetails.push(item.flavorNotes[0]);
  } else {
    metaDetails.push('Freshly baked');
  }

  if (isWeightBased) {
    metaDetails.push('½ KG & 1 KG');
  } else if (priceMode === 'box') {
    metaDetails.push(item.subtitle || 'Assorted box');
  } else {
    metaDetails.push(item.subtitle || '1 piece');
  }

  const handleQuickAdd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onQuickAddToCart) {
      const added = await onQuickAddToCart(item, qty, isWeightBased ? selectedWeight : undefined);
      if (added) {
        setJustAdded(true);
        setTimeout(() => setJustAdded(false), 1600);
      }
    } else {
      onClick(isWeightBased ? selectedWeight : undefined);
    }
  };

  return (
    <article
      onClick={() => onClick(isWeightBased ? selectedWeight : undefined)}
      className="brownie-card"
    >
      <div className="brownie-card__media">
        <img
          className="brownie-card__image"
          src={item.image}
          alt={item.name}
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?q=80&w=600&auto=format&fit=crop';
          }}
        />

        {item.badge && <span className="brownie-card__badge">{item.badge}</span>}

        <button
          type="button"
          onClick={(e) => onFavorite(e, item.id)}
          className={`brownie-card__wishlist ${isFav ? 'brownie-card__wishlist--active' : ''}`}
          aria-label={isFav ? `Remove ${item.name} from wishlist` : `Add ${item.name} to wishlist`}
          aria-pressed={isFav}
        >
          {isFav ? '♥' : '♡'}
        </button>
      </div>

      <div className="brownie-card__body">
        <p className="brownie-card__eyebrow">{eyebrowText}</p>
        <h3 className="brownie-card__name">{item.name}</h3>

        {descriptionText && <p className="brownie-card__description">{descriptionText}</p>}

        {metaDetails.length > 0 && (
          <div className="brownie-card__meta">
            {metaDetails.map((detail, idx) => (
              <React.Fragment key={`${item.id}-meta-${idx}`}>
                {idx > 0 && <span className="brownie-card__dot" aria-hidden="true" />}
                <span>{detail}</span>
              </React.Fragment>
            ))}
          </div>
        )}

        <div className="brownie-card__options" onClick={(e) => e.stopPropagation()}>
          {isWeightBased ? (
            <div
              className="brownie-card__weights"
              role="radiogroup"
              aria-label={`Select weight for ${item.name}`}
            >
              <button
                type="button"
                role="radio"
                aria-checked={selectedWeight === '½ KG'}
                onClick={() => setSelectedWeight('½ KG')}
                className={`brownie-card__weight-btn ${
                  selectedWeight === '½ KG' ? 'brownie-card__weight-btn--active' : ''
                }`}
              >
                <span>½ KG</span>
                <span>{halfKg}</span>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={selectedWeight === '1 KG'}
                onClick={() => setSelectedWeight('1 KG')}
                className={`brownie-card__weight-btn ${
                  selectedWeight === '1 KG' ? 'brownie-card__weight-btn--active' : ''
                }`}
              >
                <span>1 KG</span>
                <span>{oneKg}</span>
              </button>
            </div>
          ) : (
            <span className="text-[10px] font-medium text-[#806c60]">Quantity</span>
          )}

          <div className="brownie-card__qty">
            <button
              type="button"
              onClick={() => setQty((prev) => Math.max(1, prev - 1))}
              className="brownie-card__qty-btn"
              aria-label="Decrease quantity"
            >
              <Minus className="w-2.5 h-2.5" />
            </button>
            <span className="brownie-card__qty-val">{qty}</span>
            <button
              type="button"
              onClick={() => setQty((prev) => prev + 1)}
              className="brownie-card__qty-btn"
              aria-label="Increase quantity"
            >
              <Plus className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>

        <div className="brownie-card__footer" onClick={(e) => e.stopPropagation()}>
          <div className="brownie-card__price-wrap">
            <span className="brownie-card__price-label">{priceLabel}</span>
            <span className="brownie-card__price">{activePrice}</span>
          </div>

          <button
            type="button"
            onClick={handleQuickAdd}
            className={`brownie-card__add ${justAdded ? 'brownie-card__add--added' : ''}`}
          >
            {justAdded ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Added</span>
              </>
            ) : (
              <>
                <span>Add to cart</span>
                <span aria-hidden="true">→</span>
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
};

export const BrownieGallery: React.FC<BrownieGalleryProps> = ({
  onSelectBrownie,
  onViewAllCreations,
  onOpenCustomOrders,
  activeMenuFilter: controlledFilter,
  onMenuFilterChange,
}) => {
  const { menuItems } = useContent();
  const rawItems = menuItems && menuItems.length > 0 ? menuItems : SIGNATURE_BROWNIES;
  const allItems = rawItems.filter((item) => item.enabled !== false);
  const { userProfile, toggleFavorite, user, signInWithGoogle } = useAuth();
  const {
    addToCart,
    cartCount,
    cartTotalFormatted,
    setIsCartOpen,
    preservedSelection,
  } = useCart();

  const [internalFilter, setInternalFilter] = useState<GalleryMenuFilterId>('all');
  const activeMenuFilter = controlledFilter !== undefined ? controlledFilter : internalFilter;

  useEffect(() => {
    if (controlledFilter !== undefined) {
      setInternalFilter(controlledFilter);
    }
  }, [controlledFilter]);

  const handleSetMenuFilter = (nextFilter: GalleryMenuFilterId) => {
    setInternalFilter(nextFilter);
    onMenuFilterChange?.(nextFilter);
  };

  const handleFavoriteClick = async (e: React.MouseEvent, brownieId: string) => {
    e.stopPropagation();
    if (!user) {
      const signedInUser = await signInWithGoogle();
      if (!signedInUser) return;
    }
    await toggleFavorite(brownieId);
  };

  const handleCardClick = (item: BrownieItem, selectedWeight?: '½ KG' | '1 KG') => {
    if (onSelectBrownie) {
      onSelectBrownie(item, selectedWeight);
    } else if (onOpenCustomOrders) {
      onOpenCustomOrders();
    }
  };

  const handleQuickAddItem = async (
    item: BrownieItem,
    qty: number,
    selectedWeight?: '½ KG' | '1 KG'
  ): Promise<boolean> => {
    if (!user) {
      const signedInUser = await signInWithGoogle();
      if (!signedInUser) return false;
    }

    const category = item.category || 'brownie';

    if (category === 'cake_normal' || category === 'cake_premium') {
      const chosenWeight: '½ KG' | '1 KG' = selectedWeight === '1 KG' ? '1 KG' : '½ KG';
      const unitNum =
        chosenWeight === '1 KG'
          ? parsePriceNumber(item.priceOneKg || item.price || '900')
          : parsePriceNumber(item.priceHalfKg || item.price || '500');

      addToCart(item, qty, {
        variantLabel: chosenWeight,
        weight: chosenWeight,
        customUnitPrice: unitNum,
        isAddon: false,
      });
      return true;
    }

    if (category === 'brownie') {
      const chosenWeight: '½ KG' | '1 KG' = selectedWeight === '1 KG' ? '1 KG' : '½ KG';
      const unitNum =
        chosenWeight === '1 KG'
          ? parsePriceNumber(item.priceOneKg || item.price || '950')
          : parsePriceNumber(item.priceHalfKg || item.price || '490');

      addToCart(item, qty, {
        variantLabel: chosenWeight,
        weight: chosenWeight,
        customUnitPrice: unitNum,
        isAddon: false,
      });
      if (onSelectBrownie) {
        onSelectBrownie(item, chosenWeight);
      }
      return true;
    }

    if (category === 'bento_cake') {
      const chosenWeight: '½ KG' | '1 KG' = selectedWeight === '1 KG' ? '1 KG' : '½ KG';
      const unitNum =
        chosenWeight === '1 KG'
          ? parsePriceNumber(item.priceOneKg || item.price || '550')
          : parsePriceNumber(item.priceHalfKg || item.price || '350');

      addToCart(item, qty, {
        variantLabel: chosenWeight,
        weight: chosenWeight,
        customUnitPrice: unitNum,
        isAddon: false,
      });
      return true;
    }

    const unitNum = parsePriceNumber(item.price || '150');
    addToCart(item, qty, {
      customUnitPrice: unitNum,
      isAddon: category === 'frosted_brownie',
    });
    return true;
  };

  // Group items into sections (dynamically synced with Admin Panel menuItems)
  const cakeNormalItems = allItems.filter((item) => item.category === 'cake_normal');
  const cakePremiumItems = allItems.filter((item) => item.category === 'cake_premium');
  const brownieSectionItems = allItems.filter(
    (item) => !item.category || item.category === 'brownie'
  );
  const assortedBoxItems = allItems.filter((item) => item.category === 'assorted_box');
  const frostedBrownieItems = allItems.filter((item) => item.category === 'frosted_brownie');
  const bentoCakeItems = allItems.filter((item) => item.category === 'bento_cake');

  // All menu categories & counts (automatically reflects any items added/edited in Admin Panel)
  const menuCategoryFilterItems: FilterItem[] = [
    {
      id: 'all',
      label: 'All Menus',
      count: allItems.length,
      icon: LayoutGrid,
    },
    {
      id: 'cake_menu',
      label: 'Cake Menu',
      count: cakeNormalItems.length + cakePremiumItems.length,
      icon: Cake,
    },
    {
      id: 'cake_normal',
      label: 'Normal Flavours',
      count: cakeNormalItems.length,
      icon: Cherry,
    },
    {
      id: 'cake_premium',
      label: 'Premium Flavours',
      count: cakePremiumItems.length,
      icon: Crown,
    },
    {
      id: 'brownie',
      label: 'Brownies',
      count: brownieSectionItems.length,
      icon: Cookie,
    },
    {
      id: 'assorted_box',
      label: 'Assorted Boxes',
      count: assortedBoxItems.length,
      icon: Package,
    },
    {
      id: 'frosted_brownie',
      label: 'Frosted Brownies',
      count: frostedBrownieItems.length,
      icon: Sparkles,
    },
    {
      id: 'bento_cake',
      label: 'Bento Cakes',
      count: bentoCakeItems.length,
      icon: Cake,
    },
  ];

  const showCakeNormal =
    activeMenuFilter === 'all' ||
    activeMenuFilter === 'cake_menu' ||
    activeMenuFilter === 'cake_normal';
  const showCakePremium =
    activeMenuFilter === 'all' ||
    activeMenuFilter === 'cake_menu' ||
    activeMenuFilter === 'cake_premium';
  const showBrownies = activeMenuFilter === 'all' || activeMenuFilter === 'brownie';
  const showAssortedBoxes = activeMenuFilter === 'all' || activeMenuFilter === 'assorted_box';
  const showFrostedBrownies = activeMenuFilter === 'all' || activeMenuFilter === 'frosted_brownie';
  const showBentoCakes = activeMenuFilter === 'all' || activeMenuFilter === 'bento_cake';

  const renderMenuFilterButton = () => (
    <div className="flex items-center gap-2">
      {activeMenuFilter !== 'all' && (
        <button
          type="button"
          onClick={() => handleSetMenuFilter('all')}
          className="px-3 py-1.5 rounded-full bg-[#F8F0E5] hover:bg-[#E8D6C3] text-[#3B211B] border border-[#E8D6C3] text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
        >
          Show All Menus
        </button>
      )}
      <FilterDisclosure
        items={menuCategoryFilterItems}
        activeId={activeMenuFilter}
        onChange={(id) => handleSetMenuFilter(id as GalleryMenuFilterId)}
        menuProducts={allItems}
        onSelectProduct={(prod) => handleCardClick(prod, '½ KG')}
      />
    </div>
  );

  return (
    <section
      className="w-full py-12 sm:py-20 bg-[#FFFDF9] border-b border-[#E8D6C3]"
      id="brownie-gallery"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14 sm:space-y-20">
        {/* ======================================================= */}
        {/* MAIN BLOCK 1 (FIRST): CAKE MENU                         */}
        {/* Subcategories: 1. Normal Flavours | 2. Premium Flavours */}
        {/* ======================================================= */}
        {(showCakeNormal || showCakePremium) &&
          (cakeNormalItems.length > 0 || cakePremiumItems.length > 0) && (
            <div className="space-y-12 sm:space-y-16" id="cake-menu-section">
              <div className="text-center border-b border-[#E8D6C3] pb-6">
                <span className="inline-block text-[11px] font-bold uppercase tracking-[0.25em] text-[#C47B55] mb-1.5">
                  Freshly Baked Celebration &amp; Artisan Layer Cakes
                </span>
                <h2 className="font-gallery text-3xl sm:text-5xl font-normal uppercase tracking-[0.14em] text-[#1A0B08]">
                  CAKE MENU
                </h2>
                <p className="mt-2 text-xs sm:text-sm text-[#3B211B]/75 max-w-xl mx-auto">
                  Select <strong>½ KG</strong> or <strong>1 KG</strong> weight on any cake below to view live pricing and add directly to your cart.
                </p>
              </div>

              {/* SUBCATEGORY 1: NORMAL FLAVOURS */}
              {showCakeNormal && cakeNormalItems.length > 0 && (
                <div id="cake-normal-section" className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E8D6C3]/70 pb-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C47B55] block">
                        Cake Menu &bull; Category 01
                      </span>
                      <h3 className="font-gallery text-2xl sm:text-3xl font-normal uppercase tracking-[0.1em] text-[#1A0B08]">
                        NORMAL FLAVOURS
                      </h3>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
                      <p className="text-xs text-[#3B211B]/70 font-medium">
                        Available in ½ KG &amp; 1 KG options ({cakeNormalItems.length}{' '}
                        {cakeNormalItems.length === 1 ? 'flavour' : 'flavours'})
                      </p>
                      {renderMenuFilterButton()}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-4 sm:gap-x-6 sm:gap-y-10">
                    {cakeNormalItems.map((item) => (
                      <MenuCatalogCard
                        key={item.id}
                        item={item}
                        isFav={Boolean(userProfile?.favorites?.includes(item.id))}
                        isSignedIn={Boolean(user)}
                        onFavorite={handleFavoriteClick}
                        onClick={(w) => handleCardClick(item, w)}
                        priceMode="per_kg"
                        onQuickAddToCart={handleQuickAddItem}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* SUBCATEGORY 2: PREMIUM FLAVOURS */}
              {showCakePremium && cakePremiumItems.length > 0 && (
                <div id="cake-premium-section" className="pt-4 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E8D6C3]/70 pb-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C47B55] block">
                        Cake Menu &bull; Category 02
                      </span>
                      <h3 className="font-gallery text-2xl sm:text-3xl font-normal uppercase tracking-[0.1em] text-[#1A0B08]">
                        PREMIUM FLAVOURS
                      </h3>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
                      <p className="text-xs text-[#3B211B]/70 font-medium">
                        Signature &amp; imported luxury cake flavours in ½ KG &amp; 1 KG ({cakePremiumItems.length} flavours)
                      </p>
                      {!showCakeNormal && renderMenuFilterButton()}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-4 sm:gap-x-6 sm:gap-y-10">
                    {cakePremiumItems.map((item) => (
                      <MenuCatalogCard
                        key={item.id}
                        item={item}
                        isFav={Boolean(userProfile?.favorites?.includes(item.id))}
                        isSignedIn={Boolean(user)}
                        onFavorite={handleFavoriteClick}
                        onClick={(w) => handleCardClick(item, w)}
                        priceMode="per_kg"
                        onQuickAddToCart={handleQuickAddItem}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        {/* ======================================================= */}
        {/* MAIN BLOCK 2: BROWNIES (Brownie + Assorted + Frosted)   */}
        {/* ======================================================= */}
        {(showBrownies || showAssortedBoxes || showFrostedBrownies) && (
          <div className="space-y-14 sm:space-y-16 pt-6 border-t-2 border-[#E8D6C3]">
            {/* 1. BROWNIE */}
            {showBrownies && brownieSectionItems.length > 0 && (
              <div id="regular-brownies-section">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8 sm:mb-10 border-b border-[#E8D6C3]/70 pb-4">
                  <div className={activeMenuFilter === 'all' ? 'text-center w-full' : ''}>
                    <span className="inline-block text-[11px] font-bold uppercase tracking-[0.2em] text-[#C47B55] mb-1.5">
                      Brownies ({brownieSectionItems.length} items)
                    </span>
                    <h2 className="font-gallery text-2xl sm:text-4xl font-normal uppercase tracking-[0.12em] text-[#1A0B08]">
                      BROWNIE
                    </h2>
                    <p className="mt-1.5 text-xs sm:text-sm text-[#3B211B]/70">
                      Choose ½ KG or 1 KG weight options — with optional Frosted Brownie add-ons
                    </p>
                  </div>
                  {activeMenuFilter === 'brownie' && (
                    <div className="flex justify-end shrink-0">
                      {renderMenuFilterButton()}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-4 sm:gap-x-7 sm:gap-y-10">
                  {brownieSectionItems.map((item) => (
                    <MenuCatalogCard
                      key={item.id}
                      item={item}
                      isFav={Boolean(userProfile?.favorites?.includes(item.id))}
                      isSignedIn={Boolean(user)}
                      onFavorite={handleFavoriteClick}
                      onClick={(w) => handleCardClick(item, w)}
                      priceMode="half_and_full_kg"
                      onQuickAddToCart={handleQuickAddItem}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 2. ASSORTED BROWNIE BOXES (NO KG PRICING) */}
            {showAssortedBoxes && assortedBoxItems.length > 0 && (
              <div className="pt-4 border-t border-[#E8D6C3]/60" id="assorted-boxes-section">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8 sm:mb-10 border-b border-[#E8D6C3]/70 pb-4">
                  <div className={activeMenuFilter === 'all' ? 'text-center w-full' : ''}>
                    <span className="inline-block text-[10px] font-bold uppercase tracking-[0.2em] text-[#C47B55] mb-1">
                      Curated Gift Boxes ({assortedBoxItems.length} items)
                    </span>
                    <h3 className="font-gallery text-2xl sm:text-3xl font-normal uppercase tracking-[0.12em] text-[#1A0B08]">
                      ASSORTED BROWNIE BOXES
                    </h3>
                    <p className="mt-1.5 text-xs sm:text-sm text-[#3B211B]/70">
                      Handpicked tasting boxes of our signature brownie creations
                    </p>
                  </div>
                  {activeMenuFilter === 'assorted_box' && (
                    <div className="flex justify-end shrink-0">
                      {renderMenuFilterButton()}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-2 max-w-2xl mx-auto gap-x-3 gap-y-4 sm:gap-x-8 sm:gap-y-10">
                  {assortedBoxItems.map((item) => (
                    <MenuCatalogCard
                      key={item.id}
                      item={item}
                      isFav={Boolean(userProfile?.favorites?.includes(item.id))}
                      isSignedIn={Boolean(user)}
                      onFavorite={handleFavoriteClick}
                      onClick={() => handleCardClick(item)}
                      priceMode="box"
                      onQuickAddToCart={handleQuickAddItem}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 3. FROSTED BROWNIES (NO KG PRICING + OPTIONAL ADD-ON NAVIGATION TARGET) */}
            {showFrostedBrownies && frostedBrownieItems.length > 0 && (
              <div className="pt-6 border-t border-[#E8D6C3]/60 scroll-mt-24" id="frosted-brownies-section">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8 sm:mb-10 border-b border-[#E8D6C3]/70 pb-4">
                  <div className={activeMenuFilter === 'all' ? 'text-center w-full' : ''}>
                    <span className="inline-block text-[10px] font-bold uppercase tracking-[0.2em] text-[#C47B55] mb-1">
                      Signature &amp; Optional Add-On Varieties ({frostedBrownieItems.length} items)
                    </span>
                    <h3 className="font-gallery text-2xl sm:text-3xl font-normal uppercase tracking-[0.12em] text-[#1A0B08]">
                      FROSTED BROWNIES
                    </h3>
                    <p className="mt-1.5 text-xs sm:text-sm text-[#3B211B]/70">
                      Crowned with whipped Belgian ganaches, pralines &amp; artisan frostings — order standalone or add to your brownie order
                    </p>
                  </div>
                  {activeMenuFilter === 'frosted_brownie' && (
                    <div className="flex justify-end shrink-0">
                      {renderMenuFilterButton()}
                    </div>
                  )}
                </div>

                {/* Preserved Regular Brownie Banner when navigating via "+ Add Frosted Brownies" */}
                {preservedSelection && (
                  <div className="mb-8 p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-[#23120E] via-[#3B211B] to-[#23120E] text-[#F8F0E5] border-2 border-[#E5A962] shadow-lg flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in">
                    <div className="flex items-center gap-3.5 text-center sm:text-left">
                      <img
                        src={preservedSelection.brownie.image}
                        alt={preservedSelection.brownie.name}
                        className="w-14 h-14 rounded-2xl object-cover border-2 border-[#E5A962] shrink-0 hidden sm:block"
                      />
                      <div>
                        <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-full bg-[#E5A962] text-[#23120E] text-[10px] font-bold uppercase tracking-wider">
                            Regular Brownie Preserved in Cart
                          </span>
                          <span className="text-xs font-mono text-[#E8D6C3]">
                            Qty: {preservedSelection.quantity} &times; {formatRupee(preservedSelection.unitPrice)}
                          </span>
                        </div>
                        <h4 className="font-gallery text-base sm:text-lg font-bold text-white mt-0.5">
                          Selected: {preservedSelection.brownie.name}
                          {preservedSelection.variantLabel ? ` (${preservedSelection.variantLabel})` : ''}
                        </h4>
                        <p className="text-xs text-[#E8D6C3]/80">
                          Select any optional Frosted Brownie below and click <strong>Add to Cart</strong>, or return to your original selection anytime.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-2.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          if (onSelectBrownie) {
                            onSelectBrownie(preservedSelection.brownie);
                          } else {
                            document
                              .getElementById('regular-brownies-section')
                              ?.scrollIntoView({ behavior: 'smooth' });
                          }
                        }}
                        className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-[#F8F0E5] border border-white/20 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <ArrowLeft className="w-3.5 h-3.5 text-[#E5A962]" />
                        <span>Return to {preservedSelection.brownie.name}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsCartOpen(true)}
                        className="px-5 py-2 rounded-full bg-[#E5A962] hover:bg-[#F3BC7D] text-[#23120E] font-bold text-xs shadow-md transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>
                          View Cart ({cartCount}) &bull; {cartTotalFormatted}
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-4 sm:gap-x-7 sm:gap-y-10">
                  {frostedBrownieItems.map((item) => (
                    <MenuCatalogCard
                      key={item.id}
                      item={item}
                      isFav={Boolean(userProfile?.favorites?.includes(item.id))}
                      isSignedIn={Boolean(user)}
                      onFavorite={handleFavoriteClick}
                      onClick={() => handleCardClick(item)}
                      priceMode="frosted"
                      onQuickAddToCart={handleQuickAddItem}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================= */}
        {/* SECTION 4: BENTO CAKES (Price per kg)                   */}
        {/* ======================================================= */}
        {showBentoCakes && bentoCakeItems.length > 0 && (
          <div className="pt-8 border-t-2 border-[#E8D6C3]" id="bento-cakes-section">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8 sm:mb-10 border-b border-[#E8D6C3]/70 pb-4">
              <div className={activeMenuFilter === 'all' ? 'text-center w-full' : ''}>
                <span className="inline-block text-[11px] font-bold uppercase tracking-[0.2em] text-[#C47B55] mb-1.5">
                  Handcrafted Cakes ({bentoCakeItems.length} items)
                </span>
                <h2 className="font-gallery text-2xl sm:text-4xl font-normal uppercase tracking-[0.12em] text-[#1A0B08]">
                  BENTO CAKES
                </h2>
                <p className="mt-1.5 text-xs sm:text-sm text-[#3B211B]/70">
                  Custom celebration &amp; bento cakes — choose ½ KG or 1 KG weight options
                </p>
              </div>
              {activeMenuFilter === 'bento_cake' && (
                <div className="flex justify-end shrink-0">
                  {renderMenuFilterButton()}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-4 sm:gap-x-6 sm:gap-y-10">
              {bentoCakeItems.map((item) => (
                <MenuCatalogCard
                  key={item.id}
                  item={item}
                  isFav={Boolean(userProfile?.favorites?.includes(item.id))}
                  isSignedIn={Boolean(user)}
                  onFavorite={handleFavoriteClick}
                  onClick={(w) => handleCardClick(item, w)}
                  priceMode="per_kg"
                  onQuickAddToCart={handleQuickAddItem}
                />
              ))}
            </div>
          </div>
        )}

        {/* Custom Order Callout Bar */}
        <div className="mt-10 p-6 rounded-3xl bg-[#23120E] text-[#F8F0E5] border border-[#3B211B] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="space-y-1 text-center sm:text-left">
            <h4 className="font-gallery text-lg font-bold text-[#F8F0E5] flex items-center justify-center sm:justify-start gap-2">
              <Sparkles className="w-4 h-4 text-[#E5A962]" />
              <span>Looking for a custom batch or personalized celebration cake?</span>
            </h4>
            <p className="text-xs text-[#E8D6C3]/80">
              Tap any item above to order, add optional Frosted Brownies, or inquire for bespoke event batches.
            </p>
          </div>

          <button
            onClick={onOpenCustomOrders || onViewAllCreations}
            className="px-6 py-2.5 rounded-full bg-[#E5A962] hover:bg-[#F3BC7D] text-[#23120E] font-bold text-xs shadow-md transition-colors shrink-0 cursor-pointer flex items-center gap-1.5"
          >
            <span>Design Custom Order</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
};

export default BrownieGallery;
