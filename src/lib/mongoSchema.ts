import { Db } from 'mongodb';
import { MenuCategory } from '../data/brownies';

// ============================================================================
// 1. COLLECTION NAMES (EXACT 7 COLLECTIONS)
// ============================================================================
export const MONGO_COLLECTIONS = {
  USERS: 'users',
  ORDERS: 'orders',
  BOOKINGS: 'bookings',
  CLASS_REGISTRATIONS: 'class_registrations',
  PRODUCTS: 'products',
  CATEGORIES: 'categories',
  WEBSITE_SETTINGS: 'website_settings',
} as const;

// ============================================================================
// 2. DOCUMENT INTERFACES (PRESERVING EXISTING BROWNIEGIRLCAKES STRUCTURES)
// ============================================================================

export interface MongoUserDoc {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: 'customer' | 'admin';
  favorites: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MongoOrderProductItem {
  productId: string;
  name: string;
  category: MenuCategory | string;
  quantity: number;
  unitPrice: number;
  unitPriceFormatted: string;
  lineTotal: number;
  lineTotalFormatted: string;
  variantLabel?: string;
  weight?: string;
  isAddon?: boolean;
}

export interface MongoOrderDoc {
  id: string;
  orderId: string;
  idempotencyKey?: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryAddress: string;
  specialInstructions?: string;
  items: MongoOrderProductItem[];
  totalAmount: string;
  totalAmountNumeric: number;
  hasFrostedAddon?: boolean;
  paymentStatus?: 'pending' | 'paid' | 'cod';
  status: 'received' | 'baking' | 'finishing' | 'out_for_delivery' | 'delivered' | 'cancelled';
  isRead?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MongoBookingDoc {
  id: string;
  bookingId: string;
  orderId?: string;
  idempotencyKey?: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  subject: string;
  message: string;
  eventType?: string;
  eventDate?: string;
  guestCount?: string;
  deliveryType?: 'delivery' | 'pickup';
  deliveryAddress?: string;
  status: 'new' | 'read' | 'replied' | 'closed';
  isRead?: boolean;
  readAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MongoClassRegistrationDoc {
  id: string;
  registrationId: string;
  idempotencyKey?: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  classId?: string;
  className: string;
  preferredDate: string;
  notes?: string;
  status: 'registered' | 'waitlist' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface MongoProductDoc {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  category: MenuCategory | 'custom_showcase';
  price: string;
  priceHalfKg?: string;
  priceOneKg?: string;
  image: string;
  badge?: string;
  cocoaPercentage: string;
  flavorNotes: string[];
  enabled: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt: string;
}

export interface MongoCategoryDoc {
  id: string;
  type: 'menu_category' | 'baking_class';
  // Menu category fields
  slug?: string;
  title: string;
  subtitle?: string;
  hasWeightOptions?: boolean;
  sortOrder?: number;
  // Baking class fields
  level?: string;
  duration?: string;
  price?: string;
  format?: 'Online' | 'In-Person Studio' | 'Offline' | 'Online & Offline' | string;
  description?: string;
  dates?: string[];
  enabled?: boolean;
  updatedAt: string;
}

/**
 * SECURITY REQUIREMENT:
 * website_settings NEVER stores plain-text `adminPassword`.
 * Only non-sensitive settings, achievements, authorized admin email metadata,
 * or one-way scrypt password hashes (`adminPasswordHash` + `adminPasswordSalt`) are permitted.
 */
export interface MongoWebsiteSettingDoc {
  settingKey: 'general' | 'achievements' | 'admins' | 'counters';
  // For 'general'
  phone?: string;
  phoneRaw?: string;
  whatsappNumber?: string;
  email?: string;
  instagramId?: string;
  facebookId?: string;
  onlineClassTime?: string;
  aboutImage?: string;
  heroSlide1Image?: string;
  heroSlide2Image?: string;
  heroSlide3Image?: string;
  // For 'achievements'
  stat1Value?: string;
  stat1Label?: string;
  stat1Desc?: string;
  stat2Value?: string;
  stat2Label?: string;
  stat2Desc?: string;
  stat3Value?: string;
  stat3Label?: string;
  stat3Desc?: string;
  stat4Value?: string;
  stat4Label?: string;
  stat4Desc?: string;
  award1Title?: string;
  award1Org?: string;
  award1Note?: string;
  award2Title?: string;
  award2Org?: string;
  award2Note?: string;
  award3Title?: string;
  award3Org?: string;
  award3Note?: string;
  // For 'admins' (NEVER plain-text adminPassword)
  adminEmails?: string[];
  adminList?: Array<{
    email: string;
    name: string;
    role: 'owner' | 'co-admin' | 'manager';
    addedAt: string;
    addedBy: string;
    isPrimary?: boolean;
  }>;
  adminPasswordHash?: string;
  adminPasswordSalt?: string;
  // For 'counters'
  lastOrderSequence?: number;
  lastBookingSequence?: number;
  updatedAt: string;
}

// ============================================================================
// 3. DATA VALIDATION & SANITIZATION HELPERS
// ============================================================================

export function sanitizeWebsiteSettingForStorage(
  settingKey: MongoWebsiteSettingDoc['settingKey'],
  rawPayload: Record<string, unknown>
): MongoWebsiteSettingDoc {
  const copy: Record<string, unknown> = { ...rawPayload };

  // SECURITY RULE: Explicitly strip any plain-text password fields before saving to MongoDB
  delete copy.adminPassword;
  delete copy.masterPassword;
  delete copy.password;
  delete copy.plainPassword;

  if (Array.isArray(copy.adminList)) {
    copy.adminList = copy.adminList.map((entry: any) => {
      const cleanedEntry = { ...entry };
      delete cleanedEntry.customPassword;
      delete cleanedEntry.password;
      return cleanedEntry;
    });
  }

  return {
    ...(copy as Partial<MongoWebsiteSettingDoc>),
    settingKey,
    updatedAt: new Date().toISOString(),
  };
}

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export function parsePaginationParams(
  query: Record<string, unknown>,
  defaultLimit = 50,
  maxLimit = 200
): PaginationParams {
  const rawPage = Number(query.page);
  const rawLimit = Number(query.limit);

  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const limit =
    Number.isFinite(rawLimit) && rawLimit >= 1
      ? Math.min(maxLimit, Math.floor(rawLimit))
      : defaultLimit;
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

// ============================================================================
// 4. INDEX INITIALIZATION (IDEMPOTENT)
// ============================================================================

let indexesInitialized = false;

export async function ensureMongoIndexes(db: Db): Promise<void> {
  if (indexesInitialized) return;

  try {
    await Promise.all([
      // 1. users indexes
      db.collection(MONGO_COLLECTIONS.USERS).createIndexes([
        { key: { uid: 1 }, name: 'idx_users_uid_unique', unique: true },
        { key: { email: 1 }, name: 'idx_users_email' },
        { key: { role: 1 }, name: 'idx_users_role' },
      ]),

      // 2. orders indexes
      db.collection(MONGO_COLLECTIONS.ORDERS).createIndexes([
        { key: { orderId: 1 }, name: 'idx_orders_orderId_unique', unique: true },
        {
          key: { idempotencyKey: 1 },
          name: 'idx_orders_idempotency_sparse',
          unique: true,
          sparse: true,
        },
        { key: { createdAt: -1 }, name: 'idx_orders_createdAt_desc' },
        { key: { userId: 1, createdAt: -1 }, name: 'idx_orders_user_createdAt' },
        { key: { status: 1, createdAt: -1 }, name: 'idx_orders_status_createdAt' },
        { key: { customerPhone: 1 }, name: 'idx_orders_customerPhone' },
      ]),

      // 3. bookings indexes (custom cake orders & inquiries)
      db.collection(MONGO_COLLECTIONS.BOOKINGS).createIndexes([
        { key: { id: 1 }, name: 'idx_bookings_id_unique', unique: true },
        {
          key: { idempotencyKey: 1 },
          name: 'idx_bookings_idempotency_sparse',
          unique: true,
          sparse: true,
        },
        { key: { createdAt: -1 }, name: 'idx_bookings_createdAt_desc' },
        { key: { userId: 1, createdAt: -1 }, name: 'idx_bookings_user_createdAt' },
        { key: { status: 1, createdAt: -1 }, name: 'idx_bookings_status_createdAt' },
      ]),

      // 4. class_registrations indexes (masterclass enrollments + duplicate booking guard)
      db.collection(MONGO_COLLECTIONS.CLASS_REGISTRATIONS).createIndexes([
        { key: { id: 1 }, name: 'idx_class_reg_id_unique', unique: true },
        {
          key: { idempotencyKey: 1 },
          name: 'idx_class_reg_idempotency_sparse',
          unique: true,
          sparse: true,
        },
        {
          key: { userEmail: 1, className: 1, preferredDate: 1, status: 1 },
          name: 'idx_class_reg_duplicate_lookup',
        },
        { key: { createdAt: -1 }, name: 'idx_class_reg_createdAt_desc' },
        { key: { userId: 1, createdAt: -1 }, name: 'idx_class_reg_user_createdAt' },
      ]),

      // 5. products indexes
      db.collection(MONGO_COLLECTIONS.PRODUCTS).createIndexes([
        { key: { id: 1 }, name: 'idx_products_id_unique', unique: true },
        { key: { category: 1, sortOrder: 1 }, name: 'idx_products_category_sort' },
        { key: { enabled: 1, sortOrder: 1 }, name: 'idx_products_enabled_sort' },
      ]),

      // 6. categories indexes (menu categories + baking classes)
      db.collection(MONGO_COLLECTIONS.CATEGORIES).createIndexes([
        { key: { id: 1 }, name: 'idx_categories_id_unique', unique: true },
        { key: { type: 1, sortOrder: 1 }, name: 'idx_categories_type_sort' },
      ]),

      // 7. website_settings indexes
      db.collection(MONGO_COLLECTIONS.WEBSITE_SETTINGS).createIndexes([
        { key: { settingKey: 1 }, name: 'idx_website_settings_key_unique', unique: true },
      ]),
    ]);

    indexesInitialized = true;
  } catch {
    // Non-blocking index initialization
  }
}

/**
 * Generates the next globally unique sequential Order ID atomically in MongoDB.
 */
export async function getNextMongoOrderSequence(db: Db, minimumFloor = 1024): Promise<number> {
  const settingsCol = db.collection<MongoWebsiteSettingDoc>(MONGO_COLLECTIONS.WEBSITE_SETTINGS);
  const existingCounter = await settingsCol.findOne({ settingKey: 'counters' });

  if (!existingCounter || typeof existingCounter.lastOrderSequence !== 'number' || existingCounter.lastOrderSequence < minimumFloor) {
    await settingsCol.updateOne(
      { settingKey: 'counters' },
      {
        $max: { lastOrderSequence: minimumFloor },
        $set: { updatedAt: new Date().toISOString() },
      },
      { upsert: true }
    );
  }

  const updated = await settingsCol.findOneAndUpdate(
    { settingKey: 'counters' },
    {
      $inc: { lastOrderSequence: 1 },
      $set: { updatedAt: new Date().toISOString() },
    },
    { upsert: true, returnDocument: 'after' }
  );

  return updated?.lastOrderSequence ?? minimumFloor + 1;
}
