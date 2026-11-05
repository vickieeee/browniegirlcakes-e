import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
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
const ORDER_SEQ_KEY = 'browinegirl_order_seq_v1';

const generateNextOrderId = (): string => {
  try {
    const raw = localStorage.getItem(ORDER_SEQ_KEY);
    const current = raw ? parseInt(raw, 10) : 1024;
    const next = isNaN(current) || current < 1024 ? 1025 : current + 1;
    localStorage.setItem(ORDER_SEQ_KEY, String(next));
    return `BGC${next}`;
  } catch {
    const rand = Math.floor(1025 + Math.random() * 8900);
    return `BGC${rand}`;
  }
};

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
    authenticatedUser?: { uid: string; email?: string | null; displayName?: string | null } | null;
  }): Promise<CartOrderRecord> => {
    const activeUser = details.authenticatedUser || user;
    if (!activeUser) {
      throw new Error('Please sign in to place an order.');
    }
    if (!details.deliveryAddress || !details.deliveryAddress.trim()) {
      throw new Error('Please enter your delivery address.');
    }

    const orderId = generateNextOrderId();
    const nowIso = new Date().toISOString();

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

    const hasRegularBrownie = orderItems.some((i) => i.category === 'brownie');
    const hasFrostedBrownie = orderItems.some((i) => i.category === 'frosted_brownie');

    const newOrder: CartOrderRecord = {
      id: orderId,
      orderId,
      userId: activeUser.uid,
      customerName: (details.customerName || activeUser.displayName || 'Customer').trim(),
      customerEmail: (details.customerEmail || activeUser.email || '').trim(),
      customerPhone: details.customerPhone.trim(),
      deliveryAddress: details.deliveryAddress?.trim() || '',
      specialInstructions: details.specialInstructions?.trim() || '',
      items: orderItems,
      totalAmount: formatRupee(cartTotal),
      totalAmountNumeric: cartTotal,
      hasFrostedAddon: hasRegularBrownie && hasFrostedBrownie,
      status: 'received',
      isRead: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // 1. Save to localStorage immediately so Admin Panel on same device sees it even offline
    try {
      const existingRaw = localStorage.getItem(ORDERS_STORAGE_KEY);
      const existingList: CartOrderRecord[] = existingRaw ? JSON.parse(existingRaw) : [];
      const updatedList = [newOrder, ...existingList.filter((o) => o.orderId !== orderId)];
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(updatedList));
    } catch {}

    // 2. Persist to Firestore 'orders' collection under the single Order ID (e.g. BGC1025)
    try {
      await setDoc(doc(db, 'orders', orderId), {
        id: newOrder.id,
        orderId: newOrder.orderId,
        userId: newOrder.userId,
        customerName: newOrder.customerName,
        customerEmail: newOrder.customerEmail,
        customerPhone: newOrder.customerPhone,
        deliveryAddress: newOrder.deliveryAddress || '',
        specialInstructions: newOrder.specialInstructions || '',
        items: newOrder.items,
        totalAmount: newOrder.totalAmount,
        status: newOrder.status,
        createdAt: newOrder.createdAt,
        updatedAt: newOrder.updatedAt,
      });
    } catch (err) {
      console.warn('Firestore orders save warning (saved locally):', err);
    }

    // 3. Also log a synchronized entry in 'inquiries' so all admin order views include it
    try {
      const itemizedLines = newOrder.items
        .map((item) => {
          const catBadge =
            item.category === 'cake_normal'
              ? ' [Cake Menu - Normal Flavours]'
              : item.category === 'cake_premium'
              ? ' [Cake Menu - Premium Flavours]'
              : item.category === 'frosted_brownie'
              ? ' [Frosted Brownie Add-on]'
              : '';
          return `• ${item.name}${catBadge} – ${item.quantity} × ${item.unitPriceFormatted} = ${item.lineTotalFormatted}`;
        })
        .join('\n');

      const summaryMessage = [
        `Order ID: ${newOrder.orderId}`,
        `Customer: ${newOrder.customerName}`,
        `Phone: ${newOrder.customerPhone}`,
        newOrder.deliveryAddress ? `Delivery / Pickup: ${newOrder.deliveryAddress}` : null,
        `\nProducts:`,
        itemizedLines,
        `\nGrand Total: ${newOrder.totalAmount}`,
        newOrder.specialInstructions ? `\nSpecial Notes: ${newOrder.specialInstructions}` : null,
      ]
        .filter(Boolean)
        .join('\n');

      await setDoc(doc(db, 'inquiries', `order_${orderId}`), {
        userId: newOrder.userId,
        userName: newOrder.customerName,
        userEmail: newOrder.customerEmail,
        userPhone: newOrder.customerPhone,
        subject: `Order ID: ${newOrder.orderId} (${newOrder.items.length} Product${newOrder.items.length > 1 ? 's' : ''} — Grand Total: ${newOrder.totalAmount})`,
        message: summaryMessage,
        status: 'new',
        isRead: false,
        createdAt: nowIso,
      });
    } catch (err) {
      console.warn('Firestore inquiry mirror warning:', err);
    }

    clearCart();
    setPreservedSelection(null);
    return newOrder;
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
