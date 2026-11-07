import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrownieItem, MenuCategory } from '../data/brownies';
import { formatRupee } from '../utils/formatters';
import { useAuth } from './AuthContext';

export interface CartItem {
  cartItemId: string;
  productId: string;
  name: string;
  category: MenuCategory;
  unitPrice: number;
  unitPriceFormatted: string;
  quantity: number;
  variantLabel?: string;
  weight?: string;
  image: string;
  isAddon?: boolean;
}

export interface PreservedBrownieSelection {
  brownie: BrownieItem;
  quantity: number;
  variantLabel?: string;
  weight?: string;
  unitPrice: number;
}

export interface OrderProductEntry {
  productId: string;
  name: string;
  category: MenuCategory;
  quantity: number;
  unitPrice: number;
  unitPriceFormatted: string;
  lineTotal: number;
  lineTotalFormatted: string;
  variantLabel?: string;
  weight?: string;
  isAddon?: boolean;
}

export interface CartOrderRecord {
  id: string;
  orderId: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryAddress?: string;
  specialInstructions?: string;
  items: OrderProductEntry[];
  totalAmount: string;
  totalAmountNumeric: number;
  hasFrostedAddon?: boolean;
  paymentStatus?: 'pending' | 'paid' | 'failed' | 'refunded' | 'cod';
  status: 'received' | 'baking' | 'finishing' | 'out_for_delivery' | 'delivered' | 'cancelled';
  isRead?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export const parsePriceNumber = (priceStr?: string | number): number => {
  if (typeof priceStr === 'number') return priceStr;
  if (!priceStr) return 0;
  const cleaned = String(priceStr).replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : Math.round(parsed);
};

const CART_STORAGE_KEY = 'browinegirl_shopping_cart_v1';
const ORDERS_STORAGE_KEY = 'browinegirl_cart_orders_v1';

interface CartContextType {
  cartItems: CartItem[];
  cartCount: number;
  cartTotal: number;
  cartTotalFormatted: string;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  preservedSelection: PreservedBrownieSelection | null;
  setPreservedSelection: (sel: PreservedBrownieSelection | null) => void;
  toastNotification: string | null;
  triggerCartToast: (msg: string) => void;
  addToCart: (
    item: BrownieItem,
    quantity?: number,
    options?: {
      variantLabel?: string;
      weight?: string;
      customUnitPrice?: number;
      isAddon?: boolean;
      silent?: boolean;
    }
  ) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  removeFromCart: (cartItemId: string) => void;
  clearCart: () => void;
  submitCartOrder: (details: {
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    deliveryAddress: string;
    specialInstructions?: string;
    idempotencyKey?: string;
    authenticatedUser?: { uid: string; email?: string | null; displayName?: string | null } | null;
  }) => Promise<CartOrderRecord>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [preservedSelection, setPreservedSelection] = useState<PreservedBrownieSelection | null>(null);
  const [toastNotification, setToastNotification] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
    } catch {}
  }, [cartItems]);

  const triggerCartToast = (msg: string) => {
    setToastNotification(msg);
    setTimeout(() => {
      setToastNotification((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  const addToCart = (
    item: BrownieItem,
    quantity = 1,
    options?: {
      variantLabel?: string;
      weight?: string;
      customUnitPrice?: number;
      isAddon?: boolean;
      silent?: boolean;
    }
  ) => {
    const category: MenuCategory = item.category || 'brownie';
    const isWeightCategory =
      category === 'cake_normal' ||
      category === 'cake_premium' ||
      category === 'brownie' ||
      category === 'bento_cake';
    const rawWeight = options?.weight?.trim() || options?.variantLabel?.trim();
    const resolvedWeight = isWeightCategory
      ? rawWeight === '1 KG' || rawWeight === '1 kg'
        ? '1 KG'
        : '½ KG'
      : rawWeight || undefined;

    const unitPrice =
      options?.customUnitPrice !== undefined
        ? options.customUnitPrice
        : isWeightCategory
        ? resolvedWeight === '1 KG'
          ? parsePriceNumber(item.priceOneKg || item.price || '900')
          : parsePriceNumber(item.priceHalfKg || item.price || '500')
        : parsePriceNumber(item.price || '150');

    // Distinct cartItemId ensures each product + weight option is stored independently
    const cartItemId = resolvedWeight ? `${item.id}__${resolvedWeight}` : item.id;

    setCartItems((prev) => {
      const existingIndex = prev.findIndex((entry) => entry.cartItemId === cartItemId);
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + Math.max(1, quantity),
          unitPrice,
          unitPriceFormatted: formatRupee(unitPrice),
          variantLabel: resolvedWeight,
          weight: resolvedWeight,
        };
        return updated;
      }

      const newEntry: CartItem = {
        cartItemId,
        productId: item.id,
        name: item.name,
        category,
        unitPrice,
        unitPriceFormatted: formatRupee(unitPrice),
        quantity: Math.max(1, quantity),
        variantLabel: resolvedWeight,
        weight: resolvedWeight,
        image: item.image,
        isAddon: options?.isAddon || category === 'frosted_brownie',
      };
      return [...prev, newEntry];
    });

    if (!options?.silent) {
      triggerCartToast(
        `Added ${quantity} × ${item.name}${resolvedWeight ? ` (${resolvedWeight})` : ''} to cart!`
      );
    }
  };

  const updateQuantity = (cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(cartItemId);
      return;
    }
    setCartItems((prev) =>
      prev.map((entry) =>
        entry.cartItemId === cartItemId ? { ...entry, quantity } : entry
      )
    );
  };

  const removeFromCart = (cartItemId: string) => {
    setCartItems((prev) => prev.filter((entry) => entry.cartItemId !== cartItemId));
  };

  const clearCart = () => {
    setCartItems([]);
    try {
      localStorage.removeItem(CART_STORAGE_KEY);
    } catch {}
  };

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cartItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const cartTotalFormatted = formatRupee(cartTotal);

  const submitCartOrder = async (details: {
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    deliveryAddress: string;
    specialInstructions?: string;
    idempotencyKey?: string;
    authenticatedUser?: { uid: string; email?: string | null; displayName?: string | null } | null;
  }): Promise<CartOrderRecord> => {
    const activeUser = details.authenticatedUser || user;
    const resolvedName = (details.customerName || activeUser?.displayName || '').trim();
    const resolvedPhone = (details.customerPhone || '').trim();
    const resolvedEmail = (details.customerEmail || activeUser?.email || '').trim();
    const resolvedAddress = (details.deliveryAddress || '').trim();

    if (!resolvedName) {
      throw new Error('Please enter your full name.');
    }
    if (!resolvedPhone) {
      throw new Error('Please enter your WhatsApp / mobile number.');
    }
    if (!resolvedAddress) {
      throw new Error('Please enter your complete delivery address.');
    }
    if (cartItems.length === 0) {
      throw new Error('Your cart is empty. Please add at least one cake or brownie item.');
    }

    const orderItems: OrderProductEntry[] = cartItems.map((c) => {
      const selectedWeight = c.weight || c.variantLabel;
      const baseName = c.name.replace(/\s*\((½ KG|1\/2 kg|1 KG|1 kg)\)\s*$/i, '').trim();
      return {
        productId: c.productId,
        name: selectedWeight ? `${baseName} (${selectedWeight})` : baseName,
        category: c.category,
        quantity: c.quantity,
        unitPrice: c.unitPrice,
        unitPriceFormatted: formatRupee(c.unitPrice),
        lineTotal: c.unitPrice * c.quantity,
        lineTotalFormatted: formatRupee(c.unitPrice * c.quantity),
        ...(selectedWeight ? { variantLabel: selectedWeight, weight: selectedWeight } : {}),
        isAddon: Boolean(c.isAddon || c.category === 'frosted_brownie'),
      };
    });

    // 1. Persist to production backend API (/api/orders) and wait for database confirmation
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: activeUser?.uid || `guest_${Date.now()}`,
        customerName: resolvedName,
        customerEmail: resolvedEmail,
        customerPhone: resolvedPhone,
        deliveryAddress: resolvedAddress,
        specialInstructions: (details.specialInstructions || '').trim(),
        items: orderItems,
        idempotencyKey: details.idempotencyKey,
      }),
    });

    let responseData: { success?: boolean; order?: CartOrderRecord; error?: string } | null = null;
    try {
      responseData = await response.json();
    } catch {
      throw new Error('Unable to communicate with the order server. Please check your connection and try again.');
    }

    if (!response.ok || !responseData?.success || !responseData?.order) {
      throw new Error(
        responseData?.error || 'Could not save your order to the database. Please try again.'
      );
    }

    const savedOrder: CartOrderRecord = responseData.order;

    // 2. Update local customer receipt cache with the confirmed database record
    try {
      const existingRaw = localStorage.getItem(ORDERS_STORAGE_KEY);
      const existingList: CartOrderRecord[] = existingRaw ? JSON.parse(existingRaw) : [];
      const updatedList = [
        savedOrder,
        ...existingList.filter((o) => o.orderId !== savedOrder.orderId),
      ];
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(updatedList));
    } catch {}

    clearCart();
    setPreservedSelection(null);
    return savedOrder;
  };

  return (
    <CartContext.Provider
      value={{
        cartItems,
        cartCount,
        cartTotal,
        cartTotalFormatted,
        isCartOpen,
        setIsCartOpen,
        preservedSelection,
        setPreservedSelection,
        toastNotification,
        triggerCartToast,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        submitCartOrder,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
