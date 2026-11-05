import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export type OrderDeliveryStatus =
  | 'received'
  | 'baking'
  | 'finishing'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export interface OrderTimelineStep {
  status: OrderDeliveryStatus;
  title: string;
  description: string;
  timestamp: string;
  completed: boolean;
  current: boolean;
}

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: string;
  notes?: string;
  image?: string;
}

export interface BrownieOrder {
  id: string;
  orderId: string;
  userId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  items: OrderItem[];
  totalAmount: string;
  status: OrderDeliveryStatus;
  statusMessage: string;
  estimatedDelivery: string;
  deliveryAddress: string;
  driverName?: string;
  driverPhone?: string;
  createdAt: string;
  updatedAt: string;
  specialInstructions?: string;
}

export const SAMPLE_ORDERS: BrownieOrder[] = [
  {
    id: 'BG-8492',
    orderId: 'BG-8492',
    customerName: 'Elena Vance',
    customerEmail: 'elena.vance@example.com',
    customerPhone: '(555) 234-8901',
    items: [
      {
        id: 'classic-fudge',
        name: 'Classic Belgian Fudge Brownie (6-Pack)',
        quantity: 1,
        price: '₹499',
        image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?q=85&w=600&auto=format&fit=crop',
      },
      {
        id: 'salted-caramel',
        name: 'Salted Caramel Sea-Salt Swirl (6-Pack)',
        quantity: 1,
        price: '₹549',
        image: 'https://images.unsplash.com/photo-1515037893149-de7f840978e2?q=85&w=600&auto=format&fit=crop',
      },
    ],
    totalAmount: '₹1,048',
    status: 'out_for_delivery',
    statusMessage: 'Courier Marcus P. is en route with your temperature-controlled warm bakery box.',
    estimatedDelivery: 'Today in ~25 mins (3:45 PM – 4:05 PM)',
    deliveryAddress: '742 Evergreen Terrace, Apt 4B, Metropolis',
    driverName: 'Marcus P. (Bakery Courier)',
    driverPhone: '(555) 781-9920',
    createdAt: new Date(Date.now() - 75 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    specialInstructions: 'Please ring bell; leave at apartment front door if no answer.',
  },
  {
    id: 'BG-5104',
    orderId: 'BG-5104',
    customerName: 'Liam Chen',
    customerEmail: 'liam.chen@example.com',
    customerPhone: '(555) 492-1144',
    items: [
      {
        id: 'nutella-hazelnut',
        name: 'Nutella Hazelnut Crunch Brownies (6-Pack)',
        quantity: 1,
        price: '₹549',
        image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=85&w=600&auto=format&fit=crop',
      },
      {
        id: 'espresso-ganache',
        name: 'Espresso Dark Ganache Squares (6-Pack)',
        quantity: 1,
        price: '₹499',
        image: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?q=85&w=600&auto=format&fit=crop',
      },
    ],
    totalAmount: '₹1,048',
    status: 'baking',
    statusMessage: 'Freshly baking in our Valrhona deck oven at 325°F. Rising with crackly tops!',
    estimatedDelivery: 'Today by 5:30 PM',
    deliveryAddress: '1200 Ocean Boulevard, Suite 12, Seaside City',
    createdAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    specialInstructions: 'Warm delivery preferred for office birthday celebration.',
  },
  {
    id: 'BG-7821',
    orderId: 'BG-7821',
    customerName: 'Sarah Jenkins',
    customerEmail: 'sarah.j@example.com',
    customerPhone: '(555) 839-2041',
    items: [
      {
        id: 'raspberry-velvet',
        name: 'Raspberry White Chocolate Velvet (6-Pack)',
        quantity: 1,
        price: '₹599',
        image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?q=85&w=600&auto=format&fit=crop',
      },
    ],
    totalAmount: '₹599',
    status: 'delivered',
    statusMessage: 'Delivered in hand-tied satin ribbon box with complimentary artisan recipe card.',
    estimatedDelivery: 'Delivered Today at 1:15 PM',
    deliveryAddress: '88 Pastry Lane, Heritage District',
    driverName: 'Chloe D. (Bakery Dispatch)',
    createdAt: new Date(Date.now() - 180 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'BG-9310',
    orderId: 'BG-9310',
    customerName: 'Alex Rodriguez',
    customerEmail: 'alex.rod@example.com',
    customerPhone: '(555) 901-4477',
    items: [
      {
        id: 'classic-fudge',
        name: 'Belgian Chocolate Brownie Party Box (12-Pack)',
        quantity: 1,
        price: '₹999',
        image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?q=85&w=600&auto=format&fit=crop',
      },
    ],
    totalAmount: '₹999',
    status: 'finishing',
    statusMessage: 'Chocolatiers are dusting Maldon flake salt and hand-packaging in luxury gold-foil boxes.',
    estimatedDelivery: 'Today by 4:45 PM',
    deliveryAddress: '344 Central Plaza, Tech Quarter',
    createdAt: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
];

const ORDER_STORAGE_KEY = 'browinegirl_local_orders';

/**
 * Build a 5-step delivery timeline based on the current order status
 */
export function buildOrderTimeline(order: BrownieOrder): OrderTimelineStep[] {
  const stepsMeta: { status: OrderDeliveryStatus; title: string; description: string }[] = [
    {
      status: 'received',
      title: 'Order Confirmed',
      description: 'Kitchen received order & ingredients prepared.',
    },
    {
      status: 'baking',
      title: 'Deck Oven Baking',
      description: 'Slow-baking in small batches for ultra-fudgy center.',
    },
    {
      status: 'finishing',
      title: 'Artisan Glazing & Boxed',
      description: 'Handcrafted chocolate finishes & sealed in insulated box.',
    },
    {
      status: 'out_for_delivery',
      title: 'Out for Courier Delivery',
      description: 'Courier en route with thermal bakery dispatch.',
    },
    {
      status: 'delivered',
      title: 'Warm Delivery Completed',
      description: 'Delivered fresh to your doorstep. Bon Appétit!',
    },
  ];

  const statusOrder: OrderDeliveryStatus[] = [
    'received',
    'baking',
    'finishing',
    'out_for_delivery',
    'delivered',
  ];

  const currentIndex = statusOrder.indexOf(order.status);

  return stepsMeta.map((s, idx) => {
    const isCompleted = currentIndex >= idx;
    const isCurrent = currentIndex === idx;

    let timeLabel = '';
    if (idx === 0) timeLabel = 'Received';
    else if (idx === currentIndex) timeLabel = 'In Progress';
    else if (idx < currentIndex) timeLabel = 'Completed';
    else timeLabel = 'Upcoming';

    return {
      status: s.status,
      title: s.title,
      description: s.description,
      timestamp: timeLabel,
      completed: isCompleted,
      current: isCurrent,
    };
  });
}

/**
 * Fetch an order by its ID from Firestore, with graceful local fallback & automatic seeding
 */
export async function fetchOrderById(rawId: string): Promise<BrownieOrder | null> {
  const cleanId = rawId.trim().toUpperCase();
  if (!cleanId) return null;

  // 1. Try Firestore
  try {
    const docRef = doc(db, 'orders', cleanId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as BrownieOrder;
    }
  } catch (err) {
    console.warn('Firestore order lookup warning, checking fallback:', err);
  }

  // 2. Try LocalStorage
  try {
    const cached = localStorage.getItem(ORDER_STORAGE_KEY);
    if (cached) {
      const orders = JSON.parse(cached) as BrownieOrder[];
      const found = orders.find(
        (o) => o.orderId.toUpperCase() === cleanId || o.id.toUpperCase() === cleanId
      );
      if (found) return found;
    }
  } catch (err) {
    console.warn('LocalStorage order lookup error:', err);
  }

  // 3. Fallback to sample orders
  const sample = SAMPLE_ORDERS.find(
    (o) => o.orderId.toUpperCase() === cleanId || o.id.toUpperCase() === cleanId
  );

  if (sample) {
    // Optionally seed it into Firestore so future lookups find it there
    try {
      await setDoc(doc(db, 'orders', sample.id), sample, { merge: true });
    } catch {
      // Ignored if permissions are restricted
    }
    return sample;
  }

  return null;
}

/**
 * Get all available demo / recent orders for instant user discovery
 */
export function getDemoOrders(): BrownieOrder[] {
  try {
    const cached = localStorage.getItem(ORDER_STORAGE_KEY);
    if (cached) {
      const customOrders = JSON.parse(cached) as BrownieOrder[];
      if (Array.isArray(customOrders) && customOrders.length > 0) {
        return [...customOrders, ...SAMPLE_ORDERS];
      }
    }
  } catch {}
  return SAMPLE_ORDERS;
}
