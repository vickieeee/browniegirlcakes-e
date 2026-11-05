import React, { useState, useEffect } from 'react';
import {
  X,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Sparkles,
  CheckCircle2,
  MessageCircle,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { useCart, CartOrderRecord } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useContent } from '../context/ContentContext';
import { formatRupee, buildWhatsAppUrl } from '../utils/formatters';

interface CartDrawerProps {
  onNavigateToFrostedBrownies: () => void;
  onContinueShopping: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  onNavigateToFrostedBrownies,
  onContinueShopping,
}) => {
  const {
    cartItems,
    cartCount,
    cartTotal,
    cartTotalFormatted,
    isCartOpen,
    setIsCartOpen,
    updateQuantity,
    removeFromCart,
    submitCartOrder,
  } = useCart();
  const { user, signInWithGoogle } = useAuth();
  const { settings } = useContent();

  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'checkout' | 'confirmed'>('cart');
  const [customerName, setCustomerName] = useState(user?.displayName || '');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState(user?.email || '');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<CartOrderRecord | null>(null);

  useEffect(() => {
    if (user) {
      if (user.displayName && !customerName) setCustomerName(user.displayName);
      if (user.email && !customerEmail) setCustomerEmail(user.email);
    }
  }, [user]);

  if (!isCartOpen) return null;

  const hasRegularBrownie = cartItems.some((item) => item.category === 'brownie');
  const whatsappNumber = settings.whatsappNumber || '7339651529';

  const handleClose = () => {
    setIsCartOpen(false);
    if (checkoutStep === 'confirmed') {
      setCheckoutStep('cart');
      setConfirmedOrder(null);
    }
  };

  const handleProceedToCheckout = async () => {
    setFormError(null);
    if (!user) {
      const signedInUser = await signInWithGoogle();
      if (!signedInUser) {
        setFormError('Please sign in with Google to place an order.');
        return;
      }
      if (signedInUser.displayName && !customerName) setCustomerName(signedInUser.displayName);
      if (signedInUser.email && !customerEmail) setCustomerEmail(signedInUser.email);
    }
    setCheckoutStep('checkout');
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    let activeUser = user;
    if (!activeUser) {
      const signedInUser = await signInWithGoogle();
      if (!signedInUser) {
        setFormError('Please sign in with Google to place your order.');
        return;
      }
      activeUser = signedInUser;
    }

    const resolvedName = customerName.trim() || activeUser.displayName || '';
    if (!resolvedName) {
      setFormError('Please enter your full name.');
      return;
    }
    if (!customerPhone.trim()) {
      setFormError('Please enter your phone / WhatsApp number.');
      return;
    }
    if (!deliveryAddress.trim()) {
      setFormError('Please enter your complete delivery address. Delivery address is mandatory.');
      return;
    }
    if (cartItems.length === 0) {
      setFormError('Your cart is empty.');
      return;
    }

    try {
      setFormError(null);
      setIsSubmitting(true);
      const orderRecord = await submitCartOrder({
        customerName: resolvedName,
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim() || activeUser.email || '',
        deliveryAddress: deliveryAddress.trim(),
        specialInstructions: specialInstructions.trim(),
        authenticatedUser: activeUser,
      });
      setConfirmedOrder(orderRecord);
      setCheckoutStep('confirmed');
    } catch (err) {
      console.error('Order submission error:', err);
      setFormError('Could not place order. Please sign in and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-lg bg-[#F8F0E5] h-full shadow-2xl flex flex-col border-l border-[#C47B55]/30 overflow-hidden">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-[#3B211B] text-[#F8F0E5] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#C47B55] flex items-center justify-center text-white shadow-xs">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-gallery text-lg sm:text-xl font-bold tracking-tight">
                {checkoutStep === 'confirmed'
                  ? 'Order Confirmed'
                  : checkoutStep === 'checkout'
                  ? 'Complete Your Order'
                  : `Your Bakery Cart (${cartCount})`}
              </h3>
              <p className="text-[11px] text-[#E8D6C3]/80">
                BrownieGirlCakes &bull; Fresh Small-Batch Order
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-[#F8F0E5] flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close cart"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {checkoutStep === 'confirmed' && confirmedOrder ? (
            <div className="bg-white rounded-3xl p-6 border-2 border-[#C47B55] shadow-md space-y-5 animate-in fade-in">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <span className="inline-block px-3 py-1 rounded-full bg-[#3B211B] text-[#E5A962] text-xs font-mono font-bold">
                  Order ID: {confirmedOrder.orderId}
                </span>
                <h4 className="font-gallery text-2xl font-bold text-[#23120E]">
                  Thank You, {confirmedOrder.customerName}!
                </h4>
                <p className="text-xs text-[#3B211B]/75">
                  Your order has been recorded under <strong>{confirmedOrder.orderId}</strong> and sent to our bakery team.
                </p>
              </div>

              <div className="bg-[#F8F0E5] p-4 rounded-2xl border border-[#E8D6C3] space-y-3">
                <div className="flex items-center justify-between border-b border-[#E8D6C3] pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#C47B55]">
                    Products Ordered Together
                  </span>
                  <span className="text-xs font-mono font-bold text-[#3B211B]">
                    {confirmedOrder.orderId}
                  </span>
                </div>

                <div className="space-y-2">
                  {confirmedOrder.items.map((item, idx) => {
                    const itemWeight = item.weight || item.variantLabel;
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs sm:text-sm text-[#23120E] py-1 border-b border-[#E8D6C3]/50 last:border-none"
                      >
                        <div>
                          <span className="font-bold">{item.name}</span>
                          {itemWeight && (
                            <span className="ml-1.5 text-[10px] px-2 py-0.5 rounded-full bg-[#3B211B] text-[#E5A962] font-bold">
                              Weight: {itemWeight}
                            </span>
                          )}
                          {(item.category === 'cake_normal' || item.category === 'cake_premium') && (
                            <span className="ml-1.5 text-[10px] px-2 py-0.5 rounded-full bg-[#C47B55]/15 text-[#C47B55] font-semibold">
                              {item.category === 'cake_premium'
                                ? 'Premium Flavours'
                                : 'Normal Flavours'}
                            </span>
                          )}
                          {item.category === 'frosted_brownie' && (
                            <span className="ml-1.5 text-[10px] px-2 py-0.5 rounded-full bg-[#C47B55]/15 text-[#C47B55] font-semibold">
                              Frosted Add-on
                            </span>
                          )}
                          <span className="block text-[11px] text-[#3B211B]/70">
                            {item.quantity} &times; {item.unitPriceFormatted}
                          </span>
                        </div>
                        <span className="font-bold text-[#1A0B08]">{item.lineTotalFormatted}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-[#3B211B]/20 flex items-center justify-between text-sm sm:text-base font-bold text-[#1A0B08]">
                  <span>Grand Total</span>
                  <span className="text-[#C47B55] text-lg">{confirmedOrder.totalAmount}</span>
                </div>
                {confirmedOrder.deliveryAddress && (
                  <div className="pt-2 border-t border-[#E8D6C3] text-xs text-[#3B211B]">
                    <span className="font-bold text-[#23120E] block">Delivery Address:</span>
                    <span>{confirmedOrder.deliveryAddress}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2.5 pt-2">
                <a
                  href={buildWhatsAppUrl(
                    whatsappNumber,
                    `Hello BrownieGirlCakes! Following up on my Order ID: ${confirmedOrder.orderId} (${confirmedOrder.items
                      .map((i) => `${i.name} – ${i.quantity} × ${i.unitPriceFormatted}`)
                      .join(', ')}) — Grand Total: ${confirmedOrder.totalAmount}`
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 rounded-full bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Open Order in WhatsApp</span>
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setCheckoutStep('cart');
                    setConfirmedOrder(null);
                    setIsCartOpen(false);
                    onContinueShopping();
                  }}
                  className="w-full py-2.5 px-4 rounded-full bg-[#3B211B] hover:bg-[#23120E] text-[#F8F0E5] font-semibold text-xs cursor-pointer"
                >
                  Continue Shopping
                </button>
              </div>
            </div>
          ) : cartItems.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-[#E8D6C3] space-y-4 my-6">
              <div className="w-14 h-14 rounded-full bg-[#F8F0E5] text-[#C47B55] flex items-center justify-center mx-auto">
                <ShoppingBag className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h4 className="font-gallery text-lg font-bold text-[#3B211B]">Your Cart is Empty</h4>
                <p className="text-xs text-[#3B211B]/70 max-w-xs mx-auto">
                  Select any handcrafted brownie, optional Frosted Brownie add-on, assorted box, or bento cake from our menu to start your order.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCartOpen(false);
                  onContinueShopping();
                }}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#C47B55] hover:bg-[#D98B5F] text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
              >
                <span>Browse Brownie Menu</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : checkoutStep === 'cart' ? (
            <>
              {formError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
                  {formError}
                </div>
              )}

              {/* Cart Product / Quantity / Price Table */}
              <div className="bg-white rounded-2xl border border-[#E8D6C3] shadow-xs overflow-hidden">
                <div className="grid grid-cols-12 bg-[#3B211B] text-[#F8F0E5] px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider">
                  <div className="col-span-6">Product</div>
                  <div className="col-span-3 text-center">Quantity</div>
                  <div className="col-span-3 text-right">Price</div>
                </div>

                <div className="divide-y divide-[#E8D6C3]">
                  {cartItems.map((item) => {
                    const lineTotal = item.unitPrice * item.quantity;
                    return (
                      <div
                        key={item.cartItemId}
                        className="grid grid-cols-12 items-center px-4 py-3.5 gap-2 hover:bg-[#F8F0E5]/40 transition-colors"
                      >
                        <div className="col-span-6 flex items-center gap-2.5 min-w-0">
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-11 h-11 rounded-xl object-cover border border-[#E8D6C3] shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-bold text-[#23120E] leading-snug truncate">
                              {item.name}
                            </p>
                            <div className="flex flex-wrap items-center gap-1 mt-0.5">
                              {(item.weight || item.variantLabel) && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#3B211B] text-[#E5A962] font-bold">
                                  Weight: {item.weight || item.variantLabel}
                                </span>
                              )}
                              {(item.category === 'cake_normal' ||
                                item.category === 'cake_premium') && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[#C47B55]/15 text-[#C47B55] font-bold">
                                  {item.category === 'cake_premium'
                                    ? 'Premium Flavours'
                                    : 'Normal Flavours'}
                                </span>
                              )}
                              {item.category === 'frosted_brownie' && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[#C47B55]/15 text-[#C47B55] font-bold">
                                  Frosted Add-on
                                </span>
                              )}
                              <span className="text-[11px] text-[#3B211B]/65">
                                {item.unitPriceFormatted} each
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Quantity Controls */}
                        <div className="col-span-3 flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                            className="w-6 h-6 rounded-full bg-[#F8F0E5] hover:bg-[#E8D6C3] text-[#3B211B] flex items-center justify-center border border-[#E8D6C3] cursor-pointer"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-bold text-[#23120E] w-5 text-center font-mono">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                            className="w-6 h-6 rounded-full bg-[#F8F0E5] hover:bg-[#E8D6C3] text-[#3B211B] flex items-center justify-center border border-[#E8D6C3] cursor-pointer"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Price & Independent Remove */}
                        <div className="col-span-3 flex items-center justify-end gap-2">
                          <span className="text-xs sm:text-sm font-bold text-[#1A0B08]">
                            {formatRupee(lineTotal)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.cartItemId)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title={`Remove ${item.name}`}
                            aria-label={`Remove ${item.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Combined Total Row */}
                <div className="bg-[#F8F0E5] px-4 py-3.5 border-t-2 border-[#E8D6C3] flex items-center justify-between">
                  <span className="text-sm font-bold text-[#3B211B]">Total</span>
                  <span className="text-lg font-bold text-[#1A0B08]">{cartTotalFormatted}</span>
                </div>
              </div>

              {/* Optional Add-on Prompt inside Cart when regular brownie is present */}
              {hasRegularBrownie && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-[#23120E] to-[#3B211B] text-[#F8F0E5] border border-[#E5A962]/40 shadow-sm space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-[#E5A962] shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs sm:text-sm font-semibold text-white">
                        Would you like to add Frosted Brownies with this order?
                      </p>
                      <p className="text-[11px] text-[#E8D6C3]/80">
                        Your selected brownies stay saved in your cart while you browse our decadent Frosted Brownie varieties.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCartOpen(false);
                      onNavigateToFrostedBrownies();
                    }}
                    className="w-full py-2 px-4 rounded-xl bg-[#E5A962] hover:bg-[#F3BC7D] text-[#23120E] font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Frosted Brownies</span>
                  </button>
                </div>
              )}
            </>
          ) : (
            /* Checkout Form Step */
            <form id="cart-checkout-form" onSubmit={handlePlaceOrder} className="space-y-4">
              <button
                type="button"
                onClick={() => setCheckoutStep('cart')}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#C47B55] hover:underline cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Cart Items</span>
              </button>

              {user && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Ordering as <strong>{user.displayName || user.email}</strong>
                  </span>
                </div>
              )}

              <div className="bg-white p-4 rounded-2xl border border-[#E8D6C3] space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-[#3B211B] border-b border-[#E8D6C3] pb-2">
                  <span>Order Summary ({cartCount} items)</span>
                  <span className="text-sm text-[#C47B55]">{cartTotalFormatted}</span>
                </div>
                {cartItems.map((c) => {
                  const selectedWeight = c.weight || c.variantLabel;
                  return (
                    <div key={c.cartItemId} className="flex justify-between items-center text-xs text-[#3B211B]/85 py-0.5">
                      <span className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-[#23120E]">{c.name}</span>
                        {selectedWeight && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#3B211B] text-[#E5A962] font-bold">
                            Weight: {selectedWeight}
                          </span>
                        )}
                        {(c.category === 'cake_normal' || c.category === 'cake_premium') && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#C47B55]/15 text-[#C47B55] font-bold">
                            {c.category === 'cake_premium' ? 'Premium Flavours' : 'Normal Flavours'}
                          </span>
                        )}
                        <span>&times; {c.quantity}</span>
                      </span>
                      <span className="font-bold text-[#1A0B08]">{formatRupee(c.unitPrice * c.quantity)}</span>
                    </div>
                  );
                })}
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
                  {formError}
                </div>
              )}

              <div className="bg-white p-4 rounded-2xl border border-[#E8D6C3] space-y-3">
                <div>
                  <label className="text-xs font-bold text-[#3B211B] block mb-1">
                    Your Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Priya Sharma"
                    className="w-full p-2.5 rounded-xl bg-[#F8F0E5]/60 border border-[#E8D6C3] text-xs text-[#3B211B] font-semibold focus:outline-none focus:border-[#C47B55]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#3B211B] block mb-1">
                    WhatsApp / Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="w-full p-2.5 rounded-xl bg-[#F8F0E5]/60 border border-[#E8D6C3] text-xs text-[#3B211B] font-semibold focus:outline-none focus:border-[#C47B55]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#3B211B] block mb-1">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full p-2.5 rounded-xl bg-[#F8F0E5]/60 border border-[#E8D6C3] text-xs text-[#3B211B] focus:outline-none focus:border-[#C47B55]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#3B211B] flex items-center justify-between mb-1">
                    <span>Delivery Address *</span>
                    <span className="text-[10px] font-semibold text-[#C47B55]">Mandatory</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={deliveryAddress}
                    onChange={(e) => {
                      setDeliveryAddress(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    placeholder="Enter your complete delivery address (Door/Flat No., Street, Landmark, Area, City & Pincode) *"
                    className="w-full p-2.5 rounded-xl bg-[#F8F0E5]/60 border border-[#E8D6C3] text-xs text-[#3B211B] font-semibold focus:outline-none focus:border-[#C47B55]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#3B211B] block mb-1">
                    Special Instructions / Gift Note (Optional)
                  </label>
                  <input
                    type="text"
                    value={specialInstructions}
                    onChange={(e) => setSpecialInstructions(e.target.value)}
                    placeholder="e.g. Happy Birthday message on box"
                    className="w-full p-2.5 rounded-xl bg-[#F8F0E5]/60 border border-[#E8D6C3] text-xs text-[#3B211B] focus:outline-none focus:border-[#C47B55]"
                  />
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Footer Actions */}
        {cartItems.length > 0 && checkoutStep !== 'confirmed' && (
          <div className="p-4 sm:p-5 bg-white border-t border-[#E8D6C3] space-y-2.5">
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className="font-semibold text-[#3B211B]/80">
                Combined Order Total ({cartCount} {cartCount === 1 ? 'item' : 'items'})
              </span>
              <span className="text-base sm:text-lg font-bold text-[#1A0B08]">
                {cartTotalFormatted}
              </span>
            </div>

            {checkoutStep === 'cart' ? (
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsCartOpen(false);
                    onContinueShopping();
                  }}
                  className="py-2.5 px-4 rounded-full bg-[#F8F0E5] hover:bg-[#E8D6C3] text-[#3B211B] font-bold text-xs border border-[#E8D6C3] transition-colors cursor-pointer"
                >
                  Continue Shopping
                </button>
                <button
                  type="button"
                  onClick={handleProceedToCheckout}
                  className="py-2.5 px-4 rounded-full bg-[#C47B55] hover:bg-[#D98B5F] text-white font-bold text-xs shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>Proceed to Order</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="submit"
                form="cart-checkout-form"
                disabled={isSubmitting}
                className="w-full py-3 px-5 rounded-full bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-xs sm:text-sm shadow-md transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? 'Submitting Order...'
                    : `Confirm & Submit Order (${cartTotalFormatted})`}
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
