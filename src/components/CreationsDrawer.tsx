import React, { useState, useEffect } from 'react';
import { SIGNATURE_BROWNIES, BrownieItem } from '../data/brownies';
import {
  X,
  Heart,
  Sparkles,
  Check,
  MessageCircle,
  ShoppingBag,
  Plus,
  Minus,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useContent } from '../context/ContentContext';
import { useCart, parsePriceNumber } from '../context/CartContext';
import { formatRupee, buildWhatsAppUrl, triggerWhatsAppRedirect } from '../utils/formatters';

interface CreationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedBrownie?: BrownieItem | null;
  initialWeight?: '½ KG' | '1 KG';
  onSelectBrownie: (brownie: BrownieItem, initialWeight?: '½ KG' | '1 KG') => void;
  onOrderNow: () => void;
  onOpenCustomOrders?: () => void;
  onNavigateToFrostedSection?: () => void;
}

export const CreationsDrawer: React.FC<CreationsDrawerProps> = ({
  isOpen,
  onClose,
  selectedBrownie,
  initialWeight = '½ KG',
  onSelectBrownie,
  onOrderNow,
  onOpenCustomOrders,
  onNavigateToFrostedSection,
}) => {
  const { userProfile, toggleFavorite, user, signInWithGoogle } = useAuth();
  const { menuItems, settings } = useContent();
  const {
    addToCart,
    cartItems,
    cartCount,
    cartTotalFormatted,
    setIsCartOpen,
    preservedSelection,
    setPreservedSelection,
  } = useCart();

  const brownies = (menuItems.length > 0 ? menuItems : SIGNATURE_BROWNIES).filter(
    (b) => b.enabled !== false
  );
  const frostedBrownies = brownies.filter((b) => b.category === 'frosted_brownie');

  const [quantity, setQuantity] = useState(1);
  const [selectedWeight, setSelectedWeight] = useState<'½ KG' | '1 KG'>(initialWeight);
  const [viewMode, setViewMode] = useState<'detail' | 'frosted_addons'>('detail');
  const [frostedQuantities, setFrostedQuantities] = useState<Record<string, number>>({});
  const [addedFeedbackId, setAddedFeedbackId] = useState<string | null>(null);

  const activeBrownie = selectedBrownie || brownies[0];
  const activeCategory = activeBrownie?.category || 'brownie';
  const isWeightBased =
    activeCategory === 'cake_normal' ||
    activeCategory === 'cake_premium' ||
    activeCategory === 'brownie' ||
    activeCategory === 'bento_cake';

  useEffect(() => {
    setQuantity(1);
    setSelectedWeight(initialWeight === '1 KG' ? '1 KG' : '½ KG');
    setViewMode('detail');
  }, [activeBrownie?.id, initialWeight]);

  if (!isOpen || !activeBrownie) return null;

  const isFav = userProfile?.favorites?.includes(activeBrownie.id);
  const whatsappNum = settings.whatsappNumber || '7339651529';

  const halfKgFormatted = formatRupee(activeBrownie.priceHalfKg || activeBrownie.price || '₹490');
  const oneKgFormatted = formatRupee(activeBrownie.priceOneKg || activeBrownie.price || '₹950');

  // Compute unit price for the active product based on category & selected weight (½ KG or 1 KG)
  const getActiveUnitPrice = (): { priceNum: number; variantLabel?: '½ KG' | '1 KG' } => {
    if (isWeightBased) {
      if (selectedWeight === '1 KG') {
        return {
          priceNum: parsePriceNumber(activeBrownie.priceOneKg || activeBrownie.price || '950'),
          variantLabel: '1 KG',
        };
      }
      return {
        priceNum: parsePriceNumber(activeBrownie.priceHalfKg || activeBrownie.price || '490'),
        variantLabel: '½ KG',
      };
    }

    // Assorted Box or Frosted Brownie: NO KG OPTIONS
    return {
      priceNum: parsePriceNumber(activeBrownie.price || '150'),
      variantLabel: undefined,
    };
  };

  const { priceNum: currentUnitPrice, variantLabel: currentVariantLabel } = getActiveUnitPrice();

  const itemWhatsappUrl = buildWhatsAppUrl(
    whatsappNum,
    `Hello BrownieGirlCakes! I would like to order "${activeBrownie.name}"${
      currentVariantLabel ? ` (${currentVariantLabel})` : ''
    } — ${quantity} × ${formatRupee(currentUnitPrice)} = ${formatRupee(
      currentUnitPrice * quantity
    )}. Please share availability.`
  );

  const ensureSignedInForOrder = async (): Promise<boolean> => {
    if (user) return true;
    const signedInUser = await signInWithGoogle();
    return Boolean(signedInUser);
  };

  const handleFavorite = async () => {
    if (!user) {
      const signedInUser = await signInWithGoogle();
      if (!signedInUser) return;
    }
    await toggleFavorite(activeBrownie.id);
  };

  const handleAddCurrentToCart = async (): Promise<boolean> => {
    const canOrder = await ensureSignedInForOrder();
    if (!canOrder) return false;

    addToCart(activeBrownie, quantity, {
      variantLabel: currentVariantLabel,
      weight: currentVariantLabel,
      customUnitPrice: currentUnitPrice,
      isAddon: activeCategory === 'frosted_brownie',
    });
    setAddedFeedbackId(activeBrownie.id);
    setTimeout(() => setAddedFeedbackId(null), 1800);
    return true;
  };

  // Handler when clicking "+ Add Frosted Brownies" on a regular brownie
  const handleOpenFrostedAddons = async () => {
    const canOrder = await ensureSignedInForOrder();
    if (!canOrder) return;

    // Ensure the regular brownie, its selected weight (½ KG or 1 KG), and quantity are preserved in the cart
    const targetCartItemId = currentVariantLabel
      ? `${activeBrownie.id}__${currentVariantLabel}`
      : activeBrownie.id;
    const alreadyInCart = cartItems.some((c) => c.cartItemId === targetCartItemId);
    if (!alreadyInCart) {
      addToCart(activeBrownie, quantity, {
        variantLabel: currentVariantLabel,
        weight: currentVariantLabel,
        customUnitPrice: currentUnitPrice,
        isAddon: false,
      });
    }

    setPreservedSelection({
      brownie: activeBrownie,
      quantity,
      variantLabel: currentVariantLabel,
      weight: currentVariantLabel,
      unitPrice: currentUnitPrice,
    });

    setViewMode('frosted_addons');
  };

  const handleAddFrostedVarietyToCart = async (frostedItem: BrownieItem) => {
    const canOrder = await ensureSignedInForOrder();
    if (!canOrder) return;

    const qty = frostedQuantities[frostedItem.id] || 1;
    const priceNum = parsePriceNumber(frostedItem.price || '150');
    addToCart(frostedItem, qty, {
      customUnitPrice: priceNum,
      isAddon: true,
    });
    setAddedFeedbackId(frostedItem.id);
    setTimeout(() => setAddedFeedbackId(null), 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-[#F8F0E5] h-full shadow-2xl flex flex-col border-l border-[#C47B55]/30 overflow-hidden">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-[#3B211B] text-[#F8F0E5] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <Sparkles className="w-5 h-5 text-[#E5A962] shrink-0" />
            <div className="min-w-0">
              <h3 className="font-gallery text-lg sm:text-xl font-bold tracking-tight truncate">
                {viewMode === 'frosted_addons'
                  ? 'Select Optional Frosted Brownies'
                  : 'Artisan Brownie & Cake Ordering'}
              </h3>
              <p className="text-xs text-[#E8D6C3]/80 truncate">
                {viewMode === 'frosted_addons'
                  ? 'Add Frosted Brownies to your order or continue with your regular selection'
                  : 'Slow-baked in small batches daily'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                onClose();
                setIsCartOpen(true);
              }}
              className="px-3 py-1.5 rounded-full bg-[#C47B55] hover:bg-[#D98B5F] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Cart ({cartCount})</span>
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-[#F8F0E5] flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {viewMode === 'frosted_addons' ? (
            /* ============================================================ */
            /* FROSTED BROWNIES ADD-ON PAGE / VIEW (Requirement 3)          */
            /* ============================================================ */
            <div className="space-y-5 animate-in fade-in">
              {/* Preserved Original Regular Brownie Banner */}
              <div className="p-4 rounded-2xl bg-[#23120E] text-[#F8F0E5] border-2 border-[#E5A962] shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src={(preservedSelection?.brownie || activeBrownie).image}
                    alt={(preservedSelection?.brownie || activeBrownie).name}
                    className="w-12 h-12 rounded-xl object-cover border border-[#E5A962]"
                  />
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#E5A962] block">
                      Preserved Regular Brownie Selection
                    </span>
                    <p className="text-sm font-bold text-white">
                      {(preservedSelection?.brownie || activeBrownie).name}{' '}
                      {(preservedSelection?.weight || preservedSelection?.variantLabel || currentVariantLabel)
                        ? `(${preservedSelection?.weight || preservedSelection?.variantLabel || currentVariantLabel})`
                        : ''}{' '}
                      &times; {preservedSelection?.quantity || quantity} (
                      {formatRupee(
                        (preservedSelection?.unitPrice || currentUnitPrice) *
                          (preservedSelection?.quantity || quantity)
                      )}
                      )
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setViewMode('detail')}
                    className="px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 text-[#E5A962]" />
                    <span>Return to Selection</span>
                  </button>
                  {onNavigateToFrostedSection && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onNavigateToFrostedSection();
                      }}
                      className="px-3 py-1.5 rounded-full bg-[#E5A962]/20 hover:bg-[#E5A962]/30 text-[#E5A962] border border-[#E5A962]/40 text-xs font-semibold cursor-pointer"
                    >
                      Full Page View
                    </button>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-gallery text-xl font-bold text-[#23120E]">
                  Available Frosted Brownie Varieties
                </h4>
                <p className="text-xs text-[#3B211B]/75 mt-0.5">
                  Select your preferred Frosted Brownies and quantity below to add to the same cart. Frosted Brownies are completely optional.
                </p>
              </div>

              {/* Frosted Brownies Variety Cards (NO KG OPTIONS) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {frostedBrownies.map((fb) => {
                  const fbQty = frostedQuantities[fb.id] || 1;
                  const fbPrice = formatRupee(fb.price || '₹150');
                  const isJustAdded = addedFeedbackId === fb.id;

                  return (
                    <div
                      key={fb.id}
                      className="bg-white rounded-2xl border border-[#E8D6C3] hover:border-[#C47B55] p-3.5 shadow-xs flex flex-col justify-between gap-3 transition-all"
                    >
                      <div className="flex gap-3">
                        <img
                          src={fb.image}
                          alt={fb.name}
                          className="w-20 h-20 rounded-xl object-cover border border-[#E5A962]/50 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          {fb.badge && (
                            <span className="inline-block px-2 py-0.2 rounded bg-[#3B211B] text-[#E5A962] text-[9px] font-bold uppercase mb-0.5">
                              {fb.badge}
                            </span>
                          )}
                          <h5 className="font-gallery text-sm font-bold text-[#23120E] leading-snug">
                            {fb.name}
                          </h5>
                          <p className="text-[11px] text-[#3B211B]/70 line-clamp-2 mt-0.5">
                            {fb.description}
                          </p>
                          <p className="text-sm font-bold text-[#C47B55] mt-1">{fbPrice}</p>
                        </div>
                      </div>

                      <div className="pt-2.5 border-t border-[#F8F0E5] flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 bg-[#F8F0E5] rounded-full px-2 py-1 border border-[#E8D6C3]">
                          <button
                            type="button"
                            onClick={() =>
                              setFrostedQuantities((prev) => ({
                                ...prev,
                                [fb.id]: Math.max(1, (prev[fb.id] || 1) - 1),
                              }))
                            }
                            className="w-5 h-5 rounded-full hover:bg-white text-[#3B211B] flex items-center justify-center cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-bold text-[#23120E] w-5 text-center font-mono">
                            {fbQty}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setFrostedQuantities((prev) => ({
                                ...prev,
                                [fb.id]: (prev[fb.id] || 1) + 1,
                              }))
                            }
                            className="w-5 h-5 rounded-full hover:bg-white text-[#3B211B] flex items-center justify-center cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAddFrostedVarietyToCart(fb)}
                          className={`flex-1 py-2 px-3 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs ${
                            isJustAdded
                              ? 'bg-emerald-600 text-white'
                              : 'bg-[#C47B55] hover:bg-[#D98B5F] text-white'
                          }`}
                        >
                          {isJustAdded ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Added to Cart!</span>
                            </>
                          ) : (
                            <>
                              <ShoppingBag className="w-3.5 h-3.5" />
                              <span>Add to Cart</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Navigation Footer for Frosted Add-on View */}
              <div className="p-4 bg-white rounded-2xl border border-[#E8D6C3] flex flex-col sm:flex-row items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setViewMode('detail')}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-full bg-[#F8F0E5] hover:bg-[#E8D6C3] text-[#3B211B] text-xs font-bold border border-[#E8D6C3] flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Return to Original Brownie</span>
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 sm:flex-initial px-4 py-2.5 rounded-full bg-white hover:bg-stone-50 text-[#3B211B] text-xs font-semibold border border-[#E8D6C3] cursor-pointer"
                  >
                    Continue Shopping
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      setIsCartOpen(true);
                    }}
                    className="flex-1 sm:flex-initial px-5 py-2.5 rounded-full bg-[#3B211B] hover:bg-[#23120E] text-[#E5A962] text-xs font-bold flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>
                      View Cart ({cartCount}) &bull; {cartTotalFormatted}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ============================================================ */
            /* PRODUCT DETAIL & ORDERING VIEW                               */
            /* ============================================================ */
            <>
              <div className="bg-white rounded-2xl overflow-hidden border border-[#E8D6C3] shadow-md">
                <div className="relative h-60 sm:h-68 w-full bg-[#23120E]">
                  <img
                    src={activeBrownie.image}
                    alt={activeBrownie.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  <button
                    onClick={handleFavorite}
                    className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-[#3B211B] flex items-center justify-center shadow-md transition-transform active:scale-90"
                    aria-label="Favorite this brownie"
                  >
                    <Heart
                      className={`w-5 h-5 ${
                        isFav ? 'text-red-500 fill-red-500' : 'text-[#3B211B]'
                      }`}
                    />
                  </button>
                  <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                    <div>
                      <span className="text-xs font-semibold text-[#E5A962] tracking-wider uppercase">
                        {activeBrownie.cocoaPercentage}
                      </span>
                      <h4 className="font-gallery text-2xl font-bold text-white drop-shadow-xs">
                        {activeBrownie.name}
                      </h4>
                    </div>
                    <span className="text-xs font-bold text-white bg-[#C47B55] px-3.5 py-1 rounded-full shadow-xs">
                      {currentVariantLabel ? `${currentVariantLabel}: ` : ''}
                      {formatRupee(currentUnitPrice)}
                    </span>
                  </div>
                </div>

                <div className="p-5 sm:p-6 space-y-4">
                  {/* Weight Selection Section: ONLY TWO OPTIONS (½ KG & 1 KG) */}
                  {isWeightBased && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-[#3B211B]/80">
                          Select Weight Option
                        </label>
                        <span className="text-xs font-bold text-[#C47B55]">
                          Selected: {selectedWeight} &mdash; {formatRupee(currentUnitPrice)}
                        </span>
                      </div>

                      <div
                        className="grid grid-cols-2 gap-3"
                        role="radiogroup"
                        aria-label="Select Weight Option"
                      >
                        <button
                          type="button"
                          role="radio"
                          aria-checked={selectedWeight === '½ KG'}
                          onClick={() => setSelectedWeight('½ KG')}
                          className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer flex items-center justify-between ${
                            selectedWeight === '½ KG'
                              ? 'border-[#C47B55] bg-[#3B211B] text-[#F8F0E5] shadow-sm'
                              : 'border-[#E8D6C3] bg-white text-[#3B211B] hover:border-[#C47B55]/60 hover:bg-[#F8F0E5]/50'
                          }`}
                        >
                          <div>
                            <span
                              className={`block text-xs font-bold ${
                                selectedWeight === '½ KG' ? 'text-[#E5A962]' : 'text-[#3B211B]'
                              }`}
                            >
                              ½ KG
                            </span>
                            <span
                              className={`text-[10px] ${
                                selectedWeight === '½ KG' ? 'text-[#E8D6C3]/80' : 'text-[#3B211B]/65'
                              }`}
                            >
                              Half Kilogram
                            </span>
                          </div>
                          <strong
                            className={`text-sm sm:text-base font-bold ${
                              selectedWeight === '½ KG' ? 'text-white' : 'text-[#1A0B08]'
                            }`}
                          >
                            {halfKgFormatted}
                          </strong>
                        </button>

                        <button
                          type="button"
                          role="radio"
                          aria-checked={selectedWeight === '1 KG'}
                          onClick={() => setSelectedWeight('1 KG')}
                          className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer flex items-center justify-between ${
                            selectedWeight === '1 KG'
                              ? 'border-[#C47B55] bg-[#3B211B] text-[#F8F0E5] shadow-sm'
                              : 'border-[#E8D6C3] bg-white text-[#3B211B] hover:border-[#C47B55]/60 hover:bg-[#F8F0E5]/50'
                          }`}
                        >
                          <div>
                            <span
                              className={`block text-xs font-bold ${
                                selectedWeight === '1 KG' ? 'text-[#E5A962]' : 'text-[#3B211B]'
                              }`}
                            >
                              1 KG
                            </span>
                            <span
                              className={`text-[10px] ${
                                selectedWeight === '1 KG' ? 'text-[#E8D6C3]/80' : 'text-[#3B211B]/65'
                              }`}
                            >
                              One Kilogram
                            </span>
                          </div>
                          <strong
                            className={`text-sm sm:text-base font-bold ${
                              selectedWeight === '1 KG' ? 'text-white' : 'text-[#1A0B08]'
                            }`}
                          >
                            {oneKgFormatted}
                          </strong>
                        </button>
                      </div>
                    </div>
                  )}

                  {(activeCategory === 'assorted_box' || activeCategory === 'frosted_brownie') && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-[#F8F0E5] border border-[#E8D6C3]">
                      <span className="text-xs font-bold text-[#3B211B]">
                        {activeCategory === 'assorted_box' ? 'Assorted Box Price' : 'Frosted Brownie Price'}
                      </span>
                      <strong className="text-base font-bold text-[#C47B55]">
                        {formatRupee(activeBrownie.price)}
                      </strong>
                    </div>
                  )}

                  <p className="text-sm text-[#3B211B]/85 leading-relaxed">
                    {activeBrownie.description}
                  </p>

                  {/* Quantity & Add to Cart Bar */}
                  <div className="p-3.5 rounded-2xl bg-[#F8F0E5] border border-[#E8D6C3] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="flex items-center justify-between sm:justify-start gap-3">
                      <span className="text-xs font-bold text-[#3B211B]">Quantity:</span>
                      <div className="flex items-center gap-2 bg-white rounded-full px-2.5 py-1 border border-[#E8D6C3]">
                        <button
                          type="button"
                          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                          className="w-6 h-6 rounded-full hover:bg-[#F8F0E5] text-[#3B211B] flex items-center justify-center cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-sm font-bold text-[#23120E] w-6 text-center font-mono">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQuantity((q) => q + 1)}
                          className="w-6 h-6 rounded-full hover:bg-[#F8F0E5] text-[#3B211B] flex items-center justify-center cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddCurrentToCart}
                      className={`flex-1 py-2.5 px-5 rounded-full font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        addedFeedbackId === activeBrownie.id
                          ? 'bg-emerald-600 text-white'
                          : 'bg-[#3B211B] hover:bg-[#23120E] text-[#F8F0E5]'
                      }`}
                    >
                      {addedFeedbackId === activeBrownie.id ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>
                            Added {currentVariantLabel ? `(${currentVariantLabel}) ` : ''}to Cart!
                          </span>
                        </>
                      ) : (
                        <>
                          <ShoppingBag className="w-4 h-4 text-[#E5A962]" />
                          <span>
                            Add to Cart
                            {currentVariantLabel ? ` (${currentVariantLabel})` : ''} &bull;{' '}
                            {formatRupee(currentUnitPrice * quantity)}
                          </span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* ============================================================ */}
                  {/* REQUIREMENT 2: OPTIONAL FROSTED BROWNIES ADD-ON PROMPT       */}
                  {/* Shown whenever a customer selects a regular brownie          */}
                  {/* ============================================================ */}
                  {activeCategory === 'brownie' && (
                    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#23120E] via-[#3B211B] to-[#23120E] text-[#F8F0E5] border-2 border-[#E5A962]/60 shadow-md space-y-3">
                      <div className="flex items-start gap-2.5">
                        <Sparkles className="w-5 h-5 text-[#E5A962] shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="text-sm sm:text-base font-bold text-white">
                            Would you like to add Frosted Brownies with this order?
                          </p>
                          <p className="text-xs text-[#E8D6C3]/85">
                            Your selected <strong>{activeBrownie.name}</strong> ({selectedWeight}, Qty:{' '}
                            {quantity}) will be preserved in your cart while you choose optional Frosted Brownie varieties.
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                        <button
                          type="button"
                          onClick={handleOpenFrostedAddons}
                          className="flex-1 py-2.5 px-4 rounded-xl bg-[#E5A962] hover:bg-[#F3BC7D] text-[#23120E] font-bold text-xs sm:text-sm shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Plus className="w-4 h-4" />
                          <span>+ Add Frosted Brownies</span>
                        </button>

                        <button
                          type="button"
                          onClick={async () => {
                            const canOrder = await ensureSignedInForOrder();
                            if (!canOrder) return;
                            const targetCartItemId = currentVariantLabel
                              ? `${activeBrownie.id}__${currentVariantLabel}`
                              : activeBrownie.id;
                            const alreadyInCart = cartItems.some(
                              (c) => c.cartItemId === targetCartItemId
                            );
                            if (!alreadyInCart) {
                              await handleAddCurrentToCart();
                            }
                            onClose();
                            setIsCartOpen(true);
                          }}
                          className="py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-[#F8F0E5] border border-white/20 font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <span>Continue Without Add-ons</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[#C47B55] block mb-2">
                      Tasting &amp; Flavor Notes
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {(activeBrownie.flavorNotes || []).map((note, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8D6C3]/60 text-[#3B211B] text-xs font-medium"
                        >
                          <Check className="w-3.5 h-3.5 text-[#C47B55]" />
                          {note}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#F8F0E5] flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      onClick={async () => {
                        const canOrder = await ensureSignedInForOrder();
                        if (!canOrder) return;
                        const targetCartItemId = currentVariantLabel
                          ? `${activeBrownie.id}__${currentVariantLabel}`
                          : activeBrownie.id;
                        const alreadyInCart = cartItems.some(
                          (c) => c.cartItemId === targetCartItemId
                        );
                        if (!alreadyInCart) {
                          await handleAddCurrentToCart();
                        }
                        onClose();
                        setIsCartOpen(true);
                      }}
                      className="flex-1 py-3 px-4 rounded-full bg-[#C47B55] hover:bg-[#D98B5F] text-white font-bold text-xs sm:text-sm tracking-wide shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>View Cart &amp; Checkout ({cartCount})</span>
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        const canOrder = await ensureSignedInForOrder();
                        if (!canOrder) return;
                        triggerWhatsAppRedirect(itemWhatsappUrl);
                      }}
                      className="py-3 px-4 rounded-full bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-xs sm:text-sm tracking-wide shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>WhatsApp Inquiry</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Selector */}
              <div>
                <h4 className="font-gallery text-lg font-bold text-[#3B211B] mb-3">
                  Browse Other Flavors
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {brownies.map((b) => {
                    const bCat = b.category || 'brownie';
                    const bIsWeight =
                      bCat === 'cake_normal' ||
                      bCat === 'cake_premium' ||
                      bCat === 'brownie' ||
                      bCat === 'bento_cake';
                    return (
                      <div
                        key={b.id}
                        onClick={() => onSelectBrownie(b, selectedWeight)}
                        className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                          activeBrownie.id === b.id
                            ? 'border-[#C47B55] bg-white shadow-sm'
                            : 'border-[#E8D6C3] bg-white/60 hover:bg-white'
                        }`}
                      >
                        <img
                          src={b.image}
                          alt={b.name}
                          className="w-14 h-14 rounded-lg object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-[#3B211B] truncate">{b.name}</p>
                          <p className="text-[11px] text-[#C47B55] font-bold truncate">
                            {bIsWeight
                              ? `½ KG: ${formatRupee(b.priceHalfKg || b.price)} • 1 KG: ${formatRupee(
                                  b.priceOneKg || b.price
                                )}`
                              : formatRupee(b.price)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
