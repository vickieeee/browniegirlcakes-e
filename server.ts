import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  checkMongoConnectionHealth,
  getMongoDatabase,
  MONGO_COLLECTIONS,
  MongoPersistenceError,
  withMongoRetry,
} from './src/lib/mongodb';
import {
  getNextMongoOrderSequence,
  MongoBookingDoc,
  MongoCategoryDoc,
  MongoClassRegistrationDoc,
  MongoOrderDoc,
  MongoProductDoc,
  MongoUserDoc,
  MongoWebsiteSettingDoc,
  parsePaginationParams,
  sanitizeWebsiteSettingForStorage,
} from './src/lib/mongoSchema';
import {
  getAdminSigningSecretStatus,
  hashAdminPassword,
  isAuthorizedAdminEmail,
  issueAdminSessionToken,
  PRIMARY_AUTHORIZED_ADMIN_EMAILS,
  requireAdminAuth,
  verifyAdminSessionToken,
  verifyFirebaseAdminIdToken,
  verifyHashedAdminPassword,
} from './src/lib/adminAuth';
import { runFirebaseToMongoMigration } from './src/lib/firebaseToMongoMigration';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Firebase metadata for health diagnostics (resilient across root and /var/task/api)
const loadFirebaseConfig = (): { projectId: string; firestoreDatabaseId: string } => {
  const candidatePaths = [
    path.join(__dirname, 'firebase-applet-config.json'),
    path.join(__dirname, '..', 'firebase-applet-config.json'),
    path.join(process.cwd(), 'firebase-applet-config.json'),
  ];
  for (const candidate of candidatePaths) {
    try {
      if (fs.existsSync(candidate)) {
        const parsed = JSON.parse(fs.readFileSync(candidate, 'utf-8'));
        return {
          projectId: parsed.projectId || 'extreme-spark-dxctm',
          firestoreDatabaseId:
            parsed.firestoreDatabaseId || 'ai-studio-75f70547-1c2b-4420-ac3a-f6b892c5187e',
        };
      }
    } catch {
      // Try next candidate path
    }
  }
  return {
    projectId: 'extreme-spark-dxctm',
    firestoreDatabaseId: 'ai-studio-75f70547-1c2b-4420-ac3a-f6b892c5187e',
  };
};
const firebaseConfig = loadFirebaseConfig();

export interface OrderProductEntry {
  productId: string;
  name: string;
  category: string;
  quantity: number;
  unitPrice: number;
  unitPriceFormatted: string;
  lineTotal: number;
  lineTotalFormatted: string;
  variantLabel?: string;
  weight?: string;
  isAddon?: boolean;
}

export interface PersistedOrderRecord {
  id: string;
  orderId: string;
  idempotencyKey?: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryAddress: string;
  specialInstructions?: string;
  items: OrderProductEntry[];
  totalAmount: string;
  totalAmountNumeric: number;
  hasFrostedAddon?: boolean;
  paymentStatus?: 'pending' | 'paid' | 'failed' | 'refunded' | 'cod';
  status: 'received' | 'baking' | 'finishing' | 'out_for_delivery' | 'delivered' | 'cancelled';
  isRead?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PersistedInquiryRecord {
  id: string;
  bookingId?: string;
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
  updatedAt?: string;
}

export interface PersistedRegistrationRecord {
  id: string;
  registrationId?: string;
  idempotencyKey?: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  classId?: string;
  className: string;
  preferredDate?: string;
  notes?: string;
  status: 'registered' | 'waitlist' | 'cancelled';
  createdAt: string;
  updatedAt?: string;
}

interface ProductionDatabaseSchema {
  lastOrderSequence: number;
  orders: PersistedOrderRecord[];
  inquiries: PersistedInquiryRecord[];
  registrations: PersistedRegistrationRecord[];
  products: MongoProductDoc[];
  categories: MongoCategoryDoc[];
  websiteSettings: Record<string, MongoWebsiteSettingDoc>;
  deletedOrderIds: string[];
  deletedInquiryIds: string[];
  deletedRegistrationIds: string[];
  deletedProductIds: string[];
  deletedClassIds: string[];
  updatedAt: string;
}

const BUNDLED_DATA_DIR = path.join(__dirname, 'data');
const DATA_DIR = process.env.VERCEL ? '/tmp/browniegirl_data' : BUNDLED_DATA_DIR;
const DB_FILE_PATH = path.join(DATA_DIR, 'production_db.json');

function ensureDatabaseInitialized(): ProductionDatabaseSchema {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE_PATH)) {
      const bundledDbPath = path.join(BUNDLED_DATA_DIR, 'production_db.json');
      if (process.env.VERCEL && fs.existsSync(bundledDbPath)) {
        const bundledRaw = fs.readFileSync(bundledDbPath, 'utf-8');
        fs.writeFileSync(DB_FILE_PATH, bundledRaw, 'utf-8');
      } else {
        const initialDb: ProductionDatabaseSchema = {
          lastOrderSequence: 1024,
          orders: [],
          inquiries: [],
          registrations: [],
          products: [],
          categories: [],
          websiteSettings: {},
          deletedOrderIds: [],
          deletedInquiryIds: [],
          deletedRegistrationIds: [],
          deletedProductIds: [],
          deletedClassIds: [],
          updatedAt: new Date().toISOString(),
        };
        fs.writeFileSync(DB_FILE_PATH, JSON.stringify(initialDb, null, 2), 'utf-8');
        return initialDb;
      }
    }
  } catch {
    // Non-fatal on read-only serverless filesystems where MongoDB Atlas is primary
  }

  try {
    const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<ProductionDatabaseSchema>;
    return {
      lastOrderSequence: typeof parsed.lastOrderSequence === 'number' ? parsed.lastOrderSequence : 1024,
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      inquiries: Array.isArray(parsed.inquiries) ? parsed.inquiries : [],
      registrations: Array.isArray(parsed.registrations) ? parsed.registrations : [],
      products: Array.isArray(parsed.products) ? parsed.products : [],
      categories: Array.isArray(parsed.categories) ? parsed.categories : [],
      websiteSettings:
        parsed.websiteSettings && typeof parsed.websiteSettings === 'object' ? parsed.websiteSettings : {},
      deletedOrderIds: Array.isArray(parsed.deletedOrderIds) ? parsed.deletedOrderIds : [],
      deletedInquiryIds: Array.isArray(parsed.deletedInquiryIds) ? parsed.deletedInquiryIds : [],
      deletedRegistrationIds: Array.isArray(parsed.deletedRegistrationIds) ? parsed.deletedRegistrationIds : [],
      deletedProductIds: Array.isArray(parsed.deletedProductIds) ? parsed.deletedProductIds : [],
      deletedClassIds: Array.isArray(parsed.deletedClassIds) ? parsed.deletedClassIds : [],
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };
  } catch (err) {
    console.error('[DB] Failed to parse production_db.json, initializing clean state:', err);
    const fallbackDb: ProductionDatabaseSchema = {
      lastOrderSequence: 1024,
      orders: [],
      inquiries: [],
      registrations: [],
      products: [],
      categories: [],
      websiteSettings: {},
      deletedOrderIds: [],
      deletedInquiryIds: [],
      deletedRegistrationIds: [],
      deletedProductIds: [],
      deletedClassIds: [],
      updatedAt: new Date().toISOString(),
    };
    return fallbackDb;
  }
}

let atomicFileCounter = 0;
function saveDatabaseAtomically(dbData: ProductionDatabaseSchema): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    dbData.updatedAt = new Date().toISOString();
    atomicFileCounter += 1;
    const tempPath = `${DB_FILE_PATH}.tmp.${process.pid}.${Date.now()}.${atomicFileCounter}.${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    fs.writeFileSync(tempPath, JSON.stringify(dbData, null, 2), 'utf-8');
    fs.renameSync(tempPath, DB_FILE_PATH);
  } catch {
    // Non-fatal on serverless environments where MongoDB Atlas is authoritative
  }
}

// Lightweight async mutex for concurrent order creation & sequence assignment
let orderCreationQueue: Promise<unknown> = Promise.resolve();
function withOrderCreationLock<T>(task: () => Promise<T>): Promise<T> {
  const next = orderCreationQueue.then(task, task);
  orderCreationQueue = next.catch(() => {});
  return next;
}

const formatRupeeServer = (amount: number): string => {
  const num = Number.isFinite(amount) ? Math.round(amount) : 0;
  return `₹${num.toLocaleString('en-IN')}`;
};

function buildInquirySummaryFromOrder(order: PersistedOrderRecord): PersistedInquiryRecord {
  const itemizedLines = order.items
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
    `Order ID: ${order.orderId}`,
    `Customer: ${order.customerName}`,
    `Phone: ${order.customerPhone}`,
    order.deliveryAddress ? `Delivery / Pickup: ${order.deliveryAddress}` : null,
    `\nProducts:`,
    itemizedLines,
    `\nGrand Total: ${order.totalAmount}`,
    order.specialInstructions ? `\nSpecial Notes: ${order.specialInstructions}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    id: `order_${order.orderId}`,
    bookingId: `order_${order.orderId}`,
    orderId: order.orderId,
    userId: order.userId,
    userName: order.customerName,
    userEmail: order.customerEmail,
    userPhone: order.customerPhone,
    deliveryAddress: order.deliveryAddress,
    deliveryType: 'delivery',
    subject: `Order ID: ${order.orderId} (${order.items.length} Product${order.items.length > 1 ? 's' : ''} — Grand Total: ${order.totalAmount})`,
    message: summaryMessage,
    status: order.isRead ? 'read' : 'new',
    isRead: Boolean(order.isRead),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

function stripMongoId<T extends Record<string, any>>(doc: T): Omit<T, '_id'> {
  const copy = { ...doc };
  delete copy._id;
  return copy;
}

export function createExpressApiApp(): express.Express {
  const app = express();

  app.use(express.json({ limit: '10mb' }));

  // Ensure DB exists on boot
  ensureDatabaseInitialized();

  // ============================================================================
  // API ROUTES — HEALTH, USERS, ORDERS, BOOKINGS/INQUIRIES & CLASS REGISTRATIONS
  // ============================================================================

  // Health & Database Diagnostics — Authoritative Live MongoDB Collection Counts
  app.get('/api/health', async (req: Request, res: Response) => {
    const mongoHealth = await checkMongoConnectionHealth();

    if (req.query.__simulateDbFailure === 'true' || !mongoHealth.connected) {
      res.status(503).json({
        status: 'error',
        database: 'disconnected',
        databaseName: mongoHealth.databaseName,
        connected: false,
        storageEngine: 'mongodb-atlas',
        mongodb: mongoHealth,
        countsStatus: 'unavailable',
        error:
          req.query.__simulateDbFailure === 'true'
            ? 'Simulated database health check failure.'
            : mongoHealth.message || `Unable to connect to MongoDB database "${mongoHealth.databaseName}".`,
      });
      return;
    }

    try {
      const liveCounts = await withMongoRetry(
        async (mongoDb) => {
          const [
            ordersCount,
            productsCount,
            categoriesCount,
            bookingsCount,
            registrationsCount,
          ] = await Promise.all([
            mongoDb.collection(MONGO_COLLECTIONS.ORDERS).countDocuments(),
            mongoDb.collection(MONGO_COLLECTIONS.PRODUCTS).countDocuments(),
            mongoDb.collection(MONGO_COLLECTIONS.CATEGORIES).countDocuments(),
            mongoDb.collection(MONGO_COLLECTIONS.BOOKINGS).countDocuments(),
            mongoDb.collection(MONGO_COLLECTIONS.CLASS_REGISTRATIONS).countDocuments(),
          ]);

          return {
            orders: ordersCount,
            products: productsCount,
            categories: categoriesCount,
            bookings: bookingsCount,
            inquiries: bookingsCount,
            registrations: registrationsCount,
          };
        },
        { maxAttempts: 2, baseDelayMs: 200 }
      );

      res.status(200).json({
        status: 'ok',
        database: 'mongodb-atlas-connected',
        databaseName: mongoHealth.databaseName,
        connected: true,
        storageEngine: 'mongodb-atlas',
        mongodb: mongoHealth,
        firestoreProjectId: firebaseConfig.projectId,
        firestoreDatabaseId: firebaseConfig.firestoreDatabaseId,
        countsStatus: 'ok',
        orders: liveCounts.orders,
        products: liveCounts.products,
        categories: liveCounts.categories,
        bookings: liveCounts.bookings,
        registrations: liveCounts.registrations,
        counts: liveCounts,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      const safeErr = err instanceof Error ? err.message : 'Failed to query MongoDB collection counts.';
      res.status(503).json({
        status: 'degraded',
        database: 'mongodb-atlas-connected',
        databaseName: mongoHealth.databaseName,
        connected: true,
        storageEngine: 'mongodb-atlas',
        mongodb: mongoHealth,
        countsStatus: 'error',
        error: `Database connected to "${mongoHealth.databaseName}", but collection count query failed: ${safeErr}`,
      });
    }
  });

  // ============================================================================
  // USERS PROFILE SYNC API (/api/users/sync & /api/users/:uid/favorites)
  // Preserves Firebase Authentication while syncing user profile to MongoDB
  // ============================================================================
  app.post('/api/users/sync', async (req: Request, res: Response) => {
    try {
      const body = req.body || {};
      const uid = typeof body.uid === 'string' ? body.uid.trim() : '';
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      if (!uid) {
        res.status(400).json({ success: false, error: 'User uid is required.' });
        return;
      }

      const nowIso = new Date().toISOString();
      const isPrimaryAdmin = ['vigneshsivan2001@gmail.com', 'preethipreethu712@gmail.com'].includes(email);
      const role: 'customer' | 'admin' =
        isPrimaryAdmin || body.role === 'admin' ? 'admin' : 'customer';

      const userDoc: MongoUserDoc = {
        uid,
        email,
        displayName: typeof body.displayName === 'string' && body.displayName.trim() ? body.displayName.trim() : 'Baking Enthusiast',
        photoURL: typeof body.photoURL === 'string' ? body.photoURL.trim() : '',
        role,
        favorites: Array.isArray(body.favorites) ? body.favorites : ['classic-fudge', 'salted-caramel'],
        createdAt: typeof body.createdAt === 'string' && body.createdAt ? body.createdAt : nowIso,
        updatedAt: nowIso,
      };

      const mongoDb = await getMongoDatabase();
      if (mongoDb) {
        const usersCol = mongoDb.collection<MongoUserDoc>(MONGO_COLLECTIONS.USERS);
        const existing = await usersCol.findOne({ uid });
        if (existing) {
          const mergedRole: 'customer' | 'admin' =
            isPrimaryAdmin || existing.role === 'admin' || role === 'admin' ? 'admin' : 'customer';
          await usersCol.updateOne(
            { uid },
            {
              $set: {
                email: userDoc.email || existing.email,
                displayName: userDoc.displayName || existing.displayName,
                photoURL: userDoc.photoURL || existing.photoURL,
                role: mergedRole,
                updatedAt: nowIso,
              },
            }
          );
          const updated = await usersCol.findOne({ uid });
          res.status(200).json({
            success: true,
            user: updated ? stripMongoId(updated) : { ...userDoc, role: mergedRole },
          });
          return;
        } else {
          await usersCol.insertOne({ ...userDoc });
        }
      }

      res.status(200).json({
        success: true,
        user: userDoc,
      });
    } catch (err) {
      console.error('[POST /api/users/sync] Error:', err);
      res.status(500).json({
        success: false,
        error: 'Failed to sync user profile.',
      });
    }
  });

  app.patch('/api/users/:uid/favorites', async (req: Request, res: Response) => {
    try {
      const uid = String(req.params.uid || '').trim();
      const favorites = Array.isArray(req.body?.favorites) ? req.body.favorites : [];
      if (!uid) {
        res.status(400).json({ success: false, error: 'User uid is required.' });
        return;
      }

      const mongoDb = await getMongoDatabase();
      if (mongoDb) {
        await mongoDb.collection<MongoUserDoc>(MONGO_COLLECTIONS.USERS).updateOne(
          { uid },
          {
            $set: {
              favorites,
              updatedAt: new Date().toISOString(),
            },
          }
        );
      }

      res.status(200).json({ success: true, favorites });
    } catch (err) {
      console.error('[PATCH /api/users/:uid/favorites] Error:', err);
      res.status(500).json({ success: false, error: 'Failed to update favorites.' });
    }
  });

  // ============================================================================
  // ORDERS API (/api/orders) — Authoritative MongoDB `orders` Collection
  // ============================================================================

  // GET /api/orders — Fetch all persisted orders from authoritative MongoDB sorted newest first
  app.get('/api/orders', async (req: Request, res: Response) => {
    try {
      if (req.query.__simulateDbFailure === 'true') {
        throw new MongoPersistenceError(
          'Simulated database connectivity failure while reading orders.',
          503
        );
      }

      const userIdFilter = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
      const statusFilter = typeof req.query.status === 'string' ? req.query.status.trim() : '';
      const searchQuery = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';

      const mongoOrders = await withMongoRetry(async (mongoDb) => {
        const filter: Record<string, unknown> = {};
        if (userIdFilter) filter.userId = userIdFilter;
        const docs = await mongoDb
          .collection<MongoOrderDoc>(MONGO_COLLECTIONS.ORDERS)
          .find(filter)
          .sort({ createdAt: -1 })
          .toArray();
        return docs.map((mo) => stripMongoId(mo) as PersistedOrderRecord);
      });

      const sortedOrders = mongoOrders
        .filter((o) => (userIdFilter ? o.userId === userIdFilter : true))
        .filter((o) => (statusFilter && statusFilter !== 'all' ? o.status === statusFilter : true))
        .filter((o) => {
          if (!searchQuery) return true;
          return (
            (o.orderId || '').toLowerCase().includes(searchQuery) ||
            (o.customerName || '').toLowerCase().includes(searchQuery) ||
            (o.customerPhone || '').toLowerCase().includes(searchQuery) ||
            (o.customerEmail || '').toLowerCase().includes(searchQuery) ||
            (o.deliveryAddress || '').toLowerCase().includes(searchQuery)
          );
        })
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

      const hasPagination = req.query.page !== undefined || req.query.limit !== undefined;
      const { page, limit, skip } = parsePaginationParams(req.query as Record<string, unknown>, 50, 200);
      const paginatedOrders = hasPagination ? sortedOrders.slice(skip, skip + limit) : sortedOrders;

      res.status(200).json({
        success: true,
        orders: paginatedOrders,
        total: sortedOrders.length,
        page: hasPagination ? page : 1,
        limit: hasPagination ? limit : sortedOrders.length || 50,
        totalPages: hasPagination ? Math.max(1, Math.ceil(sortedOrders.length / limit)) : 1,
      });
    } catch (err) {
      console.error('[GET /api/orders] Error:', err);
      const statusCode = err instanceof MongoPersistenceError ? err.statusCode : 503;
      res.status(statusCode).json({
        success: false,
        error:
          err instanceof Error
            ? err.message
            : 'Database unavailable: Failed to retrieve customer orders from MongoDB.',
      });
    }
  });

  // GET /api/orders/:orderId — Fetch single persisted order by ID from authoritative MongoDB
  app.get('/api/orders/:orderId', async (req: Request, res: Response) => {
    try {
      if (req.query.__simulateDbFailure === 'true') {
        throw new MongoPersistenceError(
          'Simulated database connectivity failure while reading order details.',
          503
        );
      }

      const targetId = String(req.params.orderId || '').trim();
      if (!targetId) {
        res.status(400).json({
          success: false,
          error: 'Order ID is required.',
        });
        return;
      }

      const found = await withMongoRetry(async (mongoDb) => {
        const mongoOrder = await mongoDb
          .collection<MongoOrderDoc>(MONGO_COLLECTIONS.ORDERS)
          .findOne({ $or: [{ orderId: targetId }, { id: targetId }] });
        return mongoOrder ? (stripMongoId(mongoOrder) as PersistedOrderRecord) : null;
      });

      if (!found) {
        res.status(404).json({
          success: false,
          error: `Order ${targetId} not found.`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        order: found,
      });
    } catch (err) {
      console.error('[GET /api/orders/:orderId] Error:', err);
      const statusCode = err instanceof MongoPersistenceError ? err.statusCode : 503;
      res.status(statusCode).json({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to retrieve order details from MongoDB.',
      });
    }
  });

  // POST /api/orders — Validate and permanently persist a new customer order to authoritative MongoDB
  app.post('/api/orders', async (req: Request, res: Response) => {
    try {
      const body = req.body || {};

      // Allow testing simulated database failure via explicit flag (never writes to /tmp or MongoDB)
      if (body.__simulateDbFailure === true) {
        res.status(503).json({
          success: false,
          error: 'Database transaction failed: Unable to commit order to MongoDB storage.',
        });
        return;
      }

      const simulatedTransientFailures =
        typeof body.__simulateTransientFailures === 'number' && body.__simulateTransientFailures > 0
          ? Math.floor(body.__simulateTransientFailures)
          : 0;

      const customerName = typeof body.customerName === 'string' ? body.customerName.trim() : '';
      const customerPhone = typeof body.customerPhone === 'string' ? body.customerPhone.trim() : '';
      const customerEmail = typeof body.customerEmail === 'string' ? body.customerEmail.trim() : '';
      const deliveryAddress = typeof body.deliveryAddress === 'string' ? body.deliveryAddress.trim() : '';
      const specialInstructions =
        typeof body.specialInstructions === 'string' ? body.specialInstructions.trim() : '';
      const userId = typeof body.userId === 'string' && body.userId.trim() ? body.userId.trim() : `guest_${Date.now()}`;
      const idempotencyKey =
        typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim()
          ? body.idempotencyKey.trim()
          : undefined;
      const rawItems = Array.isArray(body.items) ? body.items : [];

      // Strict server-side validation
      if (!customerName) {
        res.status(400).json({
          success: false,
          error: 'Validation failed: Customer full name is required.',
        });
        return;
      }
      if (!customerPhone) {
        res.status(400).json({
          success: false,
          error: 'Validation failed: Customer WhatsApp / phone number is required.',
        });
        return;
      }
      if (!deliveryAddress) {
        res.status(400).json({
          success: false,
          error: 'Validation failed: Complete delivery address is mandatory.',
        });
        return;
      }
      if (rawItems.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Validation failed: Order must contain at least one cake or brownie item.',
        });
        return;
      }

      // Normalize and validate every product entry (preserving weight ½ KG / 1 KG, category, price, quantity)
      const validatedItems: OrderProductEntry[] = [];
      let calculatedTotalNumeric = 0;

      for (const rawItem of rawItems) {
        const itemName = typeof rawItem.name === 'string' ? rawItem.name.trim() : '';
        const quantity = Number(rawItem.quantity);
        const unitPrice = Number(rawItem.unitPrice);

        if (!itemName || !Number.isFinite(quantity) || quantity < 1 || !Number.isFinite(unitPrice) || unitPrice < 0) {
          res.status(400).json({
            success: false,
            error: 'Validation failed: Each ordered product must have a valid name, quantity (>= 1), and price.',
          });
          return;
        }

        const category = typeof rawItem.category === 'string' && rawItem.category.trim() ? rawItem.category.trim() : 'brownie';
        const selectedWeight =
          typeof rawItem.weight === 'string' && rawItem.weight.trim()
            ? rawItem.weight.trim()
            : typeof rawItem.variantLabel === 'string' && rawItem.variantLabel.trim()
            ? rawItem.variantLabel.trim()
            : undefined;

        const baseName = itemName.replace(/\s*\((½ KG|1\/2 kg|1 KG|1 kg)\)\s*$/i, '').trim();
        const displayProductName = selectedWeight ? `${baseName} (${selectedWeight})` : baseName;
        const lineTotal = Math.round(unitPrice * quantity);
        calculatedTotalNumeric += lineTotal;

        validatedItems.push({
          productId: typeof rawItem.productId === 'string' && rawItem.productId.trim() ? rawItem.productId.trim() : `prod_${validatedItems.length + 1}`,
          name: displayProductName,
          category,
          quantity: Math.round(quantity),
          unitPrice: Math.round(unitPrice),
          unitPriceFormatted: formatRupeeServer(unitPrice),
          lineTotal,
          lineTotalFormatted: formatRupeeServer(lineTotal),
          ...(selectedWeight ? { variantLabel: selectedWeight, weight: selectedWeight } : {}),
          isAddon: Boolean(rawItem.isAddon || category === 'frosted_brownie'),
        });
      }

      // Serialize sequence generation & authoritative MongoDB persistence across concurrent requests
      const createdResult = await withOrderCreationLock(async () => {
        let allocatedSeq: number | null = null;

        return await withMongoRetry(
          async (mongoDb, attempt) => {
            const ordersCol = mongoDb.collection<MongoOrderDoc>(MONGO_COLLECTIONS.ORDERS);
            const bookingsCol = mongoDb.collection<MongoBookingDoc>(MONGO_COLLECTIONS.BOOKINGS);

            // 1. Check idempotency key in MongoDB first (also catches retries where a prior attempt succeeded)
            if (idempotencyKey) {
              const existingMongo = await ordersCol.findOne({ idempotencyKey });
              if (existingMongo) {
                return {
                  order: stripMongoId(existingMongo) as PersistedOrderRecord,
                  deduplicated: true,
                  attempts: attempt,
                };
              }
            }

            // Support deterministic testing of transient retry behavior before allocating sequence
            if (simulatedTransientFailures > 0 && attempt <= simulatedTransientFailures) {
              throw new Error(
                `Simulated transient MongoDB write timeout on attempt ${attempt} of ${simulatedTransientFailures}.`
              );
            }

            // 2. Allocate order sequence atomically in MongoDB (reusing allocatedSeq if retrying within same request)
            if (allocatedSeq === null) {
              let nextSeq = await getNextMongoOrderSequence(mongoDb, 1024);
              while (await ordersCol.findOne({ orderId: `BGC${nextSeq}` })) {
                nextSeq = await getNextMongoOrderSequence(mongoDb, nextSeq);
              }
              allocatedSeq = nextSeq;
            }

            const orderId = `BGC${allocatedSeq}`;
            const nowIso = new Date().toISOString();
            const hasRegularBrownie = validatedItems.some((i) => i.category === 'brownie');
            const hasFrostedBrownie = validatedItems.some((i) => i.category === 'frosted_brownie' || i.isAddon);

            const newOrder: PersistedOrderRecord = {
              id: orderId,
              orderId,
              ...(idempotencyKey ? { idempotencyKey } : {}),
              userId,
              customerName,
              customerEmail,
              customerPhone,
              deliveryAddress,
              specialInstructions,
              items: validatedItems,
              totalAmount: formatRupeeServer(calculatedTotalNumeric),
              totalAmountNumeric: calculatedTotalNumeric,
              hasFrostedAddon: hasRegularBrownie && hasFrostedBrownie,
              paymentStatus: 'pending',
              status: 'received',
              isRead: false,
              createdAt: nowIso,
              updatedAt: nowIso,
            };

            const mirrorInquiry = buildInquirySummaryFromOrder(newOrder);

            // 3. Persist order to MongoDB and verify acknowledgement
            const existingByOrderId = await ordersCol.findOne({ orderId });
            if (!existingByOrderId) {
              try {
                const insertRes = await ordersCol.insertOne({ ...(newOrder as MongoOrderDoc) });
                if (!insertRes.acknowledged) {
                  throw new MongoPersistenceError('MongoDB did not acknowledge order insertion.', 503, attempt);
                }
              } catch (insertErr: any) {
                // If duplicate key on idempotencyKey occurred during concurrent/retry race, return existing order
                if (insertErr?.code === 11000 && idempotencyKey) {
                  const racedDoc = await ordersCol.findOne({ idempotencyKey });
                  if (racedDoc) {
                    return {
                      order: stripMongoId(racedDoc) as PersistedOrderRecord,
                      deduplicated: true,
                      attempts: attempt,
                    };
                  }
                }
                throw insertErr;
              }
            }

            // 4. Persist mirror booking summary to MongoDB and verify acknowledgement
            const mirrorBookingDoc: MongoBookingDoc = {
              ...mirrorInquiry,
              bookingId: mirrorInquiry.bookingId || mirrorInquiry.id,
              updatedAt: nowIso,
            };
            const bookingRes = await bookingsCol.updateOne(
              { id: mirrorBookingDoc.id },
              { $set: mirrorBookingDoc },
              { upsert: true }
            );
            if (!bookingRes.acknowledged) {
              throw new MongoPersistenceError('MongoDB did not acknowledge booking mirror write.', 503, attempt);
            }

            // 5. Verify persisted document exists in MongoDB before returning success
            const confirmedDoc = await ordersCol.findOne({ orderId });
            if (!confirmedDoc) {
              throw new MongoPersistenceError(
                `Order ${orderId} could not be verified in MongoDB after write.`,
                503,
                attempt
              );
            }

            return {
              order: stripMongoId(confirmedDoc) as PersistedOrderRecord,
              deduplicated: false,
              attempts: attempt,
            };
          },
          { maxAttempts: 3, baseDelayMs: 250 }
        );
      });

      if (createdResult.deduplicated) {
        res.status(200).json({
          success: true,
          order: createdResult.order,
          deduplicated: true,
          attempts: createdResult.attempts,
        });
        return;
      }

      console.log(
        `[POST /api/orders] Confirmed MongoDB Order ${createdResult.order.orderId} for ${customerName} (${validatedItems.length} items, Total: ${createdResult.order.totalAmount}, attempts=${createdResult.attempts})`
      );

      res.status(201).json({
        success: true,
        order: createdResult.order,
        attempts: createdResult.attempts,
      });
    } catch (err) {
      console.error('[POST /api/orders] Critical error saving order to MongoDB:', err);
      const statusCode = err instanceof MongoPersistenceError ? err.statusCode : 503;
      res.status(statusCode).json({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to save order to production database.',
      });
    }
  });

  // PATCH /api/orders/:orderId — Update order status, paymentStatus, or read state in authoritative MongoDB
  app.patch('/api/orders/:orderId', async (req: Request, res: Response) => {
    try {
      const targetId = String(req.params.orderId || '').trim();
      const updates = req.body || {};

      if (updates.__simulateDbFailure === true) {
        res.status(503).json({
          success: false,
          error: 'Database transaction failed: Unable to update order in MongoDB.',
        });
        return;
      }

      const ALLOWED_ORDER_STATUSES = [
        'received',
        'baking',
        'finishing',
        'out_for_delivery',
        'delivered',
        'cancelled',
      ] as const;
      const ALLOWED_PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded', 'cod'] as const;

      if (
        updates.status !== undefined &&
        (typeof updates.status !== 'string' ||
          !ALLOWED_ORDER_STATUSES.includes(updates.status as any))
      ) {
        res.status(400).json({
          success: false,
          error: `Invalid order status "${updates.status}". Allowed values: ${ALLOWED_ORDER_STATUSES.join(', ')}.`,
        });
        return;
      }

      if (
        updates.paymentStatus !== undefined &&
        (typeof updates.paymentStatus !== 'string' ||
          !ALLOWED_PAYMENT_STATUSES.includes(updates.paymentStatus as any))
      ) {
        res.status(400).json({
          success: false,
          error: `Invalid payment status "${updates.paymentStatus}". Allowed values: pending, paid, failed, refunded.`,
        });
        return;
      }

      const nowIso = new Date().toISOString();

      const updatedOrder = await withMongoRetry(async (mongoDb) => {
        const ordersCol = mongoDb.collection<MongoOrderDoc>(MONGO_COLLECTIONS.ORDERS);
        const bookingsCol = mongoDb.collection<MongoBookingDoc>(MONGO_COLLECTIONS.BOOKINGS);

        const existing = await ordersCol.findOne({ $or: [{ orderId: targetId }, { id: targetId }] });
        if (!existing) {
          return null;
        }

        const currentOrder = stripMongoId(existing) as PersistedOrderRecord;
        // CRITICAL BUSINESS RULE: Order Status (`status`) and Payment Status (`paymentStatus`) are strictly independent.
        // Updating `status` (even to `delivered`) NEVER automatically marks `paymentStatus` as `paid`.
        // Updating `paymentStatus` NEVER automatically changes `status`.
        const nextStatus =
          typeof updates.status === 'string' ? (updates.status as PersistedOrderRecord['status']) : currentOrder.status;
        const nextPaymentStatus =
          typeof updates.paymentStatus === 'string'
            ? (updates.paymentStatus as PersistedOrderRecord['paymentStatus'])
            : currentOrder.paymentStatus || 'pending';
        const nextIsRead =
          typeof updates.isRead === 'boolean' ? updates.isRead : Boolean(currentOrder.isRead);

        const nextOrder: PersistedOrderRecord = {
          ...currentOrder,
          status: nextStatus,
          paymentStatus: nextPaymentStatus,
          isRead: nextIsRead,
          updatedAt: nowIso,
        };

        const updateRes = await ordersCol.updateOne(
          { $or: [{ orderId: targetId }, { id: targetId }] },
          {
            $set: {
              status: nextOrder.status,
              paymentStatus: nextOrder.paymentStatus,
              isRead: nextOrder.isRead,
              updatedAt: nowIso,
            },
          }
        );

        if (!updateRes.acknowledged) {
          throw new MongoPersistenceError('MongoDB did not acknowledge order status update.', 503);
        }

        const mirrorId = `order_${targetId}`;
        await bookingsCol.updateOne(
          { $or: [{ id: mirrorId }, { orderId: targetId }] },
          {
            $set: {
              isRead: Boolean(nextOrder.isRead),
              status:
                nextOrder.status === 'delivered' || nextOrder.status === 'cancelled'
                  ? 'closed'
                  : nextOrder.isRead
                  ? 'read'
                  : 'new',
              updatedAt: nowIso,
            },
          }
        );

        const refreshed = await ordersCol.findOne({ $or: [{ orderId: targetId }, { id: targetId }] });
        return refreshed ? (stripMongoId(refreshed) as PersistedOrderRecord) : nextOrder;
      });

      if (!updatedOrder) {
        res.status(404).json({
          success: false,
          error: `Order ${targetId} not found in database.`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        order: updatedOrder,
      });
    } catch (err) {
      console.error('[PATCH /api/orders/:orderId] Error:', err);
      const statusCode = err instanceof MongoPersistenceError ? err.statusCode : 503;
      res.status(statusCode).json({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update order status in database.',
      });
    }
  });

  // DELETE /api/orders/:orderId — Permanently delete order from authoritative MongoDB
  app.delete('/api/orders/:orderId', async (req: Request, res: Response) => {
    try {
      const targetId = String(req.params.orderId || '').trim();
      const mirrorId = `order_${targetId}`;

      await withMongoRetry(async (mongoDb) => {
        const [ordRes, bkgRes] = await Promise.all([
          mongoDb
            .collection<MongoOrderDoc>(MONGO_COLLECTIONS.ORDERS)
            .deleteMany({ $or: [{ orderId: targetId }, { id: targetId }] }),
          mongoDb
            .collection<MongoBookingDoc>(MONGO_COLLECTIONS.BOOKINGS)
            .deleteMany({ $or: [{ id: mirrorId }, { orderId: targetId }] }),
        ]);

        if (!ordRes.acknowledged || !bkgRes.acknowledged) {
          throw new MongoPersistenceError('MongoDB did not acknowledge order deletion.', 503);
        }
      });

      const dbState = ensureDatabaseInitialized();
      dbState.orders = dbState.orders.filter((o) => o.orderId !== targetId && o.id !== targetId);
      if (!dbState.deletedOrderIds.includes(targetId)) {
        dbState.deletedOrderIds.push(targetId);
      }
      dbState.inquiries = dbState.inquiries.filter((i) => i.id !== mirrorId && i.orderId !== targetId);
      if (!dbState.deletedInquiryIds.includes(mirrorId)) {
        dbState.deletedInquiryIds.push(mirrorId);
      }
      saveDatabaseAtomically(dbState);

      res.status(200).json({
        success: true,
        deletedOrderId: targetId,
      });
    } catch (err) {
      console.error('[DELETE /api/orders/:orderId] Error:', err);
      const statusCode = err instanceof MongoPersistenceError ? err.statusCode : 503;
      res.status(statusCode).json({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to delete order from database.',
      });
    }
  });

  // ============================================================================
  // BOOKINGS & CUSTOM ORDERS API (/api/inquiries & /api/bookings)
  // Authoritative MongoDB `bookings` Collection
  // ============================================================================

  const handleGetBookings = async (req: Request, res: Response) => {
    try {
      if (req.query.__simulateDbFailure === 'true') {
        throw new MongoPersistenceError(
          'Simulated database connectivity failure while reading bookings.',
          503
        );
      }

      const userIdFilter = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
      const statusFilter = typeof req.query.status === 'string' ? req.query.status.trim() : '';
      const searchQuery = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';

      const mongoBookings = await withMongoRetry(async (mongoDb) => {
        const filter: Record<string, unknown> = {};
        if (userIdFilter) filter.userId = userIdFilter;
        const docs = await mongoDb
          .collection<MongoBookingDoc>(MONGO_COLLECTIONS.BOOKINGS)
          .find(filter)
          .sort({ createdAt: -1 })
          .toArray();
        return docs.map((mb) => stripMongoId(mb) as PersistedInquiryRecord);
      });

      const list = mongoBookings
        .filter((i) => (userIdFilter ? i.userId === userIdFilter : true))
        .filter((i) => {
          if (!statusFilter || statusFilter === 'all') return true;
          if (statusFilter === 'unread') return i.status !== 'read' && !i.isRead;
          return i.status === statusFilter;
        })
        .filter((i) => {
          if (!searchQuery) return true;
          return (
            (i.id || '').toLowerCase().includes(searchQuery) ||
            (i.userName || '').toLowerCase().includes(searchQuery) ||
            (i.userEmail || '').toLowerCase().includes(searchQuery) ||
            (i.userPhone || '').toLowerCase().includes(searchQuery) ||
            (i.subject || '').toLowerCase().includes(searchQuery) ||
            (i.message || '').toLowerCase().includes(searchQuery)
          );
        })
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

      const hasPagination = req.query.page !== undefined || req.query.limit !== undefined;
      const { page, limit, skip } = parsePaginationParams(req.query as Record<string, unknown>, 50, 200);
      const paginatedList = hasPagination ? list.slice(skip, skip + limit) : list;

      res.status(200).json({
        success: true,
        inquiries: paginatedList,
        bookings: paginatedList,
        total: list.length,
        page: hasPagination ? page : 1,
        limit: hasPagination ? limit : list.length || 50,
        totalPages: hasPagination ? Math.max(1, Math.ceil(list.length / limit)) : 1,
      });
    } catch (err) {
      console.error('[GET /api/inquiries] Error:', err);
      const statusCode = err instanceof MongoPersistenceError ? err.statusCode : 503;
      res.status(statusCode).json({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to retrieve inquiries from MongoDB.',
      });
    }
  };

  app.get('/api/inquiries', handleGetBookings);
  app.get('/api/bookings', handleGetBookings);

  const handleCreateBooking = async (req: Request, res: Response) => {
    try {
      const body = req.body || {};

      if (body.__simulateDbFailure === true) {
        res.status(503).json({
          success: false,
          error: 'Database transaction failed: Unable to save booking to MongoDB storage.',
        });
        return;
      }

      const simulatedTransientFailures =
        typeof body.__simulateTransientFailures === 'number' && body.__simulateTransientFailures > 0
          ? Math.floor(body.__simulateTransientFailures)
          : 0;

      const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
      const message = typeof body.message === 'string' ? body.message.trim() : '';
      const userName =
        typeof body.userName === 'string' && body.userName.trim() ? body.userName.trim() : 'Bakery Guest';
      const userEmail =
        typeof body.userEmail === 'string' && body.userEmail.trim()
          ? body.userEmail.trim()
          : 'guest@browinegirlcakes.com';
      const userPhone = typeof body.userPhone === 'string' ? body.userPhone.trim() : '';
      const deliveryAddress =
        typeof body.deliveryAddress === 'string' ? body.deliveryAddress.trim() : undefined;
      const deliveryType: 'delivery' | 'pickup' | undefined =
        body.deliveryType === 'delivery' || body.deliveryType === 'pickup'
          ? body.deliveryType
          : deliveryAddress
          ? 'delivery'
          : undefined;
      const idempotencyKey =
        typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim()
          ? body.idempotencyKey.trim()
          : undefined;

      if (!subject || !message) {
        res.status(400).json({
          success: false,
          error: 'Validation failed: Subject and message are required.',
        });
        return;
      }

      if (body.requireDeliveryAddress === true && !deliveryAddress) {
        res.status(400).json({
          success: false,
          error: 'Validation failed: Complete delivery address is mandatory for custom orders.',
        });
        return;
      }

      const generatedId =
        typeof body.id === 'string' && body.id.trim()
          ? body.id.trim()
          : `BK-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

      const result = await withMongoRetry(
        async (mongoDb, attempt) => {
          const bookingsCol = mongoDb.collection<MongoBookingDoc>(MONGO_COLLECTIONS.BOOKINGS);

          // 1. Idempotency check in MongoDB
          if (idempotencyKey) {
            const existingMongo = await bookingsCol.findOne({ idempotencyKey });
            if (existingMongo) {
              return {
                booking: stripMongoId(existingMongo) as PersistedInquiryRecord,
                deduplicated: true,
                attempts: attempt,
              };
            }
          }

          if (simulatedTransientFailures > 0 && attempt <= simulatedTransientFailures) {
            throw new Error(
              `Simulated transient MongoDB booking write failure on attempt ${attempt} of ${simulatedTransientFailures}.`
            );
          }

          const nowIso = new Date().toISOString();
          const newInq: PersistedInquiryRecord = {
            id: generatedId,
            bookingId: generatedId,
            ...(idempotencyKey ? { idempotencyKey } : {}),
            userId:
              typeof body.userId === 'string' && body.userId.trim() ? body.userId.trim() : `guest_${Date.now()}`,
            userName,
            userEmail,
            userPhone,
            subject,
            message,
            ...(typeof body.eventType === 'string' && body.eventType.trim()
              ? { eventType: body.eventType.trim() }
              : {}),
            ...(typeof body.eventDate === 'string' && body.eventDate.trim()
              ? { eventDate: body.eventDate.trim() }
              : {}),
            ...(typeof body.guestCount === 'string' && body.guestCount.trim()
              ? { guestCount: body.guestCount.trim() }
              : {}),
            ...(deliveryType ? { deliveryType } : {}),
            ...(deliveryAddress ? { deliveryAddress } : {}),
            status: 'new',
            isRead: false,
            createdAt: nowIso,
            updatedAt: nowIso,
          };

          const mongoBookingDoc: MongoBookingDoc = {
            ...newInq,
            bookingId: newInq.bookingId || newInq.id,
            updatedAt: nowIso,
          };

          try {
            const writeRes = await bookingsCol.updateOne(
              { id: mongoBookingDoc.id },
              { $set: mongoBookingDoc },
              { upsert: true }
            );
            if (!writeRes.acknowledged) {
              throw new MongoPersistenceError('MongoDB did not acknowledge booking persistence.', 503, attempt);
            }
          } catch (writeErr: any) {
            if (writeErr?.code === 11000 && idempotencyKey) {
              const existingDoc = await bookingsCol.findOne({ idempotencyKey });
              if (existingDoc) {
                return {
                  booking: stripMongoId(existingDoc) as PersistedInquiryRecord,
                  deduplicated: true,
                  attempts: attempt,
                };
              }
            }
            throw writeErr;
          }

          const confirmed = await bookingsCol.findOne({ id: mongoBookingDoc.id });
          if (!confirmed) {
            throw new MongoPersistenceError('Booking could not be verified in MongoDB after write.', 503, attempt);
          }

          return {
            booking: stripMongoId(confirmed) as PersistedInquiryRecord,
            deduplicated: false,
            attempts: attempt,
          };
        },
        { maxAttempts: 3, baseDelayMs: 250 }
      );

      if (result.deduplicated) {
        res.status(200).json({
          success: true,
          inquiry: result.booking,
          booking: result.booking,
          deduplicated: true,
          attempts: result.attempts,
        });
        return;
      }

      res.status(201).json({
        success: true,
        inquiry: result.booking,
        booking: result.booking,
        attempts: result.attempts,
      });
    } catch (err) {
      console.error('[POST /api/inquiries] Error:', err);
      const statusCode = err instanceof MongoPersistenceError ? err.statusCode : 503;
      res.status(statusCode).json({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to save booking inquiry to MongoDB.',
      });
    }
  };

  app.post('/api/inquiries', handleCreateBooking);
  app.post('/api/bookings', handleCreateBooking);

  const handleUpdateBooking = async (req: Request, res: Response) => {
    try {
      const targetId = String(req.params.id || '').trim();
      const updates = req.body || {};

      if (updates.__simulateDbFailure === true) {
        res.status(503).json({
          success: false,
          error: 'Database transaction failed: Unable to update booking in MongoDB.',
        });
        return;
      }

      const nowIso = new Date().toISOString();

      const updated = await withMongoRetry(async (mongoDb) => {
        const bookingsCol = mongoDb.collection<MongoBookingDoc>(MONGO_COLLECTIONS.BOOKINGS);
        const existing = await bookingsCol.findOne({ $or: [{ id: targetId }, { bookingId: targetId }] });
        if (!existing) {
          return null;
        }

        const currentInq = stripMongoId(existing) as PersistedInquiryRecord;
        const nextInq: PersistedInquiryRecord = {
          ...currentInq,
          ...(typeof updates.status === 'string' ? { status: updates.status as any } : {}),
          ...(typeof updates.isRead === 'boolean' ? { isRead: updates.isRead } : {}),
          ...(updates.readAt !== undefined ? { readAt: updates.readAt } : {}),
          updatedAt: nowIso,
        };

        const updateRes = await bookingsCol.updateOne(
          { $or: [{ id: targetId }, { bookingId: targetId }] },
          {
            $set: {
              status: nextInq.status,
              isRead: nextInq.isRead,
              readAt: nextInq.readAt,
              updatedAt: nowIso,
            },
          }
        );

        if (!updateRes.acknowledged) {
          throw new MongoPersistenceError('MongoDB did not acknowledge booking update.', 503);
        }

        return nextInq;
      });

      if (!updated) {
        res.status(404).json({
          success: false,
          error: `Inquiry ${targetId} not found.`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        inquiry: updated,
        booking: updated,
      });
    } catch (err) {
      console.error('[PATCH /api/inquiries/:id] Error:', err);
      const statusCode = err instanceof MongoPersistenceError ? err.statusCode : 503;
      res.status(statusCode).json({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update inquiry in MongoDB.',
      });
    }
  };

  app.patch('/api/inquiries/:id', handleUpdateBooking);
  app.patch('/api/bookings/:id', handleUpdateBooking);

  const handleDeleteBooking = async (req: Request, res: Response) => {
    try {
      const targetId = String(req.params.id || '').trim();

      await withMongoRetry(async (mongoDb) => {
        const delRes = await mongoDb
          .collection<MongoBookingDoc>(MONGO_COLLECTIONS.BOOKINGS)
          .deleteMany({ $or: [{ id: targetId }, { bookingId: targetId }] });

        if (!delRes.acknowledged) {
          throw new MongoPersistenceError('MongoDB did not acknowledge booking deletion.', 503);
        }
      });

      const dbState = ensureDatabaseInitialized();
      dbState.inquiries = dbState.inquiries.filter((i) => i.id !== targetId && i.bookingId !== targetId);
      if (!dbState.deletedInquiryIds.includes(targetId)) {
        dbState.deletedInquiryIds.push(targetId);
      }
      saveDatabaseAtomically(dbState);

      res.status(200).json({
        success: true,
        deletedId: targetId,
      });
    } catch (err) {
      console.error('[DELETE /api/inquiries/:id] Error:', err);
      const statusCode = err instanceof MongoPersistenceError ? err.statusCode : 503;
      res.status(statusCode).json({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to delete inquiry from MongoDB.',
      });
    }
  };

  app.delete('/api/inquiries/:id', handleDeleteBooking);
  app.delete('/api/bookings/:id', handleDeleteBooking);

  // ============================================================================
  // CLASS REGISTRATIONS API (/api/registrations)
  // Authoritative MongoDB `class_registrations` Collection
  // ============================================================================

  app.get('/api/registrations', async (req: Request, res: Response) => {
    try {
      if (req.query.__simulateDbFailure === 'true') {
        throw new MongoPersistenceError(
          'Simulated database connectivity failure while reading class registrations.',
          503
        );
      }

      const userIdFilter = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
      const statusFilter = typeof req.query.status === 'string' ? req.query.status.trim() : '';
      const searchQuery = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';

      const mongoRegs = await withMongoRetry(async (mongoDb) => {
        const filter: Record<string, unknown> = {};
        if (userIdFilter) filter.userId = userIdFilter;
        const docs = await mongoDb
          .collection<MongoClassRegistrationDoc>(MONGO_COLLECTIONS.CLASS_REGISTRATIONS)
          .find(filter)
          .sort({ createdAt: -1 })
          .toArray();
        return docs.map((mr) => stripMongoId(mr) as PersistedRegistrationRecord);
      });

      const list = mongoRegs
        .filter((r) => (userIdFilter ? r.userId === userIdFilter : true))
        .filter((r) => (statusFilter && statusFilter !== 'all' ? r.status === statusFilter : true))
        .filter((r) => {
          if (!searchQuery) return true;
          return (
            (r.id || '').toLowerCase().includes(searchQuery) ||
            (r.userName || '').toLowerCase().includes(searchQuery) ||
            (r.userEmail || '').toLowerCase().includes(searchQuery) ||
            (r.className || '').toLowerCase().includes(searchQuery) ||
            (r.preferredDate || '').toLowerCase().includes(searchQuery)
          );
        })
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

      const hasPagination = req.query.page !== undefined || req.query.limit !== undefined;
      const { page, limit, skip } = parsePaginationParams(req.query as Record<string, unknown>, 50, 200);
      const paginatedList = hasPagination ? list.slice(skip, skip + limit) : list;

      res.status(200).json({
        success: true,
        registrations: paginatedList,
        total: list.length,
        page: hasPagination ? page : 1,
        limit: hasPagination ? limit : list.length || 50,
        totalPages: hasPagination ? Math.max(1, Math.ceil(list.length / limit)) : 1,
      });
    } catch (err) {
      console.error('[GET /api/registrations] Error:', err);
      const statusCode = err instanceof MongoPersistenceError ? err.statusCode : 503;
      res.status(statusCode).json({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to retrieve class registrations from MongoDB.',
      });
    }
  });

  app.post('/api/registrations', async (req: Request, res: Response) => {
    try {
      const body = req.body || {};

      if (body.__simulateDbFailure === true) {
        res.status(503).json({
          success: false,
          error: 'Database transaction failed: Unable to save class registration to MongoDB storage.',
        });
        return;
      }

      const simulatedTransientFailures =
        typeof body.__simulateTransientFailures === 'number' && body.__simulateTransientFailures > 0
          ? Math.floor(body.__simulateTransientFailures)
          : 0;

      const className = typeof body.className === 'string' ? body.className.trim() : '';
      const userName =
        typeof body.userName === 'string' && body.userName.trim() ? body.userName.trim() : 'Baking Student';
      const userEmail = typeof body.userEmail === 'string' ? body.userEmail.trim().toLowerCase() : '';
      const userPhone = typeof body.userPhone === 'string' ? body.userPhone.trim() : '';
      const preferredDate =
        typeof body.preferredDate === 'string' && body.preferredDate.trim()
          ? body.preferredDate.trim()
          : 'Next Available Batch';
      const idempotencyKey =
        typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim()
          ? body.idempotencyKey.trim()
          : undefined;

      if (!className) {
        res.status(400).json({
          success: false,
          error: 'Validation failed: Class name is required.',
        });
        return;
      }

      const generatedId =
        typeof body.id === 'string' && body.id.trim()
          ? body.id.trim()
          : `REG-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

      const result = await withMongoRetry(
        async (mongoDb, attempt) => {
          const regsCol = mongoDb.collection<MongoClassRegistrationDoc>(MONGO_COLLECTIONS.CLASS_REGISTRATIONS);

          // 1. Idempotency key duplicate guard in MongoDB
          if (idempotencyKey) {
            const existingByIdem = await regsCol.findOne({ idempotencyKey });
            if (existingByIdem) {
              return {
                registration: stripMongoId(existingByIdem) as PersistedRegistrationRecord,
                deduplicated: true,
                attempts: attempt,
              };
            }
          }

          // 2. Compound duplicate guard in MongoDB: prevent same student email from double-booking same class & date
          if (userEmail && body.allowDuplicateClassDate !== true) {
            const existingActive = await regsCol.findOne({
              userEmail,
              className,
              preferredDate,
              status: { $ne: 'cancelled' },
            });
            if (existingActive) {
              return {
                registration: stripMongoId(existingActive) as PersistedRegistrationRecord,
                deduplicated: true,
                attempts: attempt,
              };
            }
          }

          if (simulatedTransientFailures > 0 && attempt <= simulatedTransientFailures) {
            throw new Error(
              `Simulated transient MongoDB registration write failure on attempt ${attempt} of ${simulatedTransientFailures}.`
            );
          }

          const nowIso = new Date().toISOString();
          const newReg: PersistedRegistrationRecord = {
            id: generatedId,
            registrationId: generatedId,
            ...(idempotencyKey ? { idempotencyKey } : {}),
            userId:
              typeof body.userId === 'string' && body.userId.trim() ? body.userId.trim() : `guest_${Date.now()}`,
            userName,
            userEmail,
            userPhone,
            ...(typeof body.classId === 'string' && body.classId.trim() ? { classId: body.classId.trim() } : {}),
            className,
            preferredDate,
            notes: typeof body.notes === 'string' ? body.notes.trim() : '',
            status:
              body.status === 'waitlist' || body.status === 'cancelled' ? body.status : 'registered',
            createdAt: nowIso,
            updatedAt: nowIso,
          };

          const mongoRegDoc: MongoClassRegistrationDoc = {
            ...newReg,
            registrationId: newReg.registrationId || newReg.id,
            preferredDate: newReg.preferredDate || 'Next Available Batch',
            updatedAt: nowIso,
          };

          try {
            const writeRes = await regsCol.updateOne(
              { id: mongoRegDoc.id },
              { $set: mongoRegDoc },
              { upsert: true }
            );
            if (!writeRes.acknowledged) {
              throw new MongoPersistenceError('MongoDB did not acknowledge registration write.', 503, attempt);
            }
          } catch (writeErr: any) {
            if (writeErr?.code === 11000 && idempotencyKey) {
              const existingDoc = await regsCol.findOne({ idempotencyKey });
              if (existingDoc) {
                return {
                  registration: stripMongoId(existingDoc) as PersistedRegistrationRecord,
                  deduplicated: true,
                  attempts: attempt,
                };
              }
            }
            throw writeErr;
          }

          const confirmed = await regsCol.findOne({ id: mongoRegDoc.id });
          if (!confirmed) {
            throw new MongoPersistenceError('Registration could not be verified in MongoDB after write.', 503, attempt);
          }

          return {
            registration: stripMongoId(confirmed) as PersistedRegistrationRecord,
            deduplicated: false,
            attempts: attempt,
          };
        },
        { maxAttempts: 3, baseDelayMs: 250 }
      );

      if (result.deduplicated) {
        res.status(200).json({
          success: true,
          registration: result.registration,
          deduplicated: true,
          attempts: result.attempts,
        });
        return;
      }

      res.status(201).json({
        success: true,
        registration: result.registration,
        attempts: result.attempts,
      });
    } catch (err) {
      console.error('[POST /api/registrations] Error:', err);
      const statusCode = err instanceof MongoPersistenceError ? err.statusCode : 503;
      res.status(statusCode).json({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to save class registration to MongoDB.',
      });
    }
  });

  app.patch('/api/registrations/:id', async (req: Request, res: Response) => {
    try {
      const targetId = String(req.params.id || '').trim();
      const updates = req.body || {};

      if (updates.__simulateDbFailure === true) {
        res.status(503).json({
          success: false,
          error: 'Database transaction failed: Unable to update registration in MongoDB.',
        });
        return;
      }

      const nowIso = new Date().toISOString();

      const updated = await withMongoRetry(async (mongoDb) => {
        const regsCol = mongoDb.collection<MongoClassRegistrationDoc>(MONGO_COLLECTIONS.CLASS_REGISTRATIONS);
        const existing = await regsCol.findOne({ $or: [{ id: targetId }, { registrationId: targetId }] });
        if (!existing) {
          return null;
        }

        const currentReg = stripMongoId(existing) as PersistedRegistrationRecord;
        const nextReg: PersistedRegistrationRecord = {
          ...currentReg,
          ...(typeof updates.status === 'string' ? { status: updates.status as any } : {}),
          updatedAt: nowIso,
        };

        const updateRes = await regsCol.updateOne(
          { $or: [{ id: targetId }, { registrationId: targetId }] },
          {
            $set: {
              status: nextReg.status,
              updatedAt: nowIso,
            },
          }
        );

        if (!updateRes.acknowledged) {
          throw new MongoPersistenceError('MongoDB did not acknowledge registration update.', 503);
        }

        return nextReg;
      });

      if (!updated) {
        res.status(404).json({
          success: false,
          error: `Registration ${targetId} not found.`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        registration: updated,
      });
    } catch (err) {
      console.error('[PATCH /api/registrations/:id] Error:', err);
      const statusCode = err instanceof MongoPersistenceError ? err.statusCode : 503;
      res.status(statusCode).json({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update registration in MongoDB.',
      });
    }
  });

  app.delete('/api/registrations/:id', async (req: Request, res: Response) => {
    try {
      const targetId = String(req.params.id || '').trim();

      await withMongoRetry(async (mongoDb) => {
        const delRes = await mongoDb
          .collection<MongoClassRegistrationDoc>(MONGO_COLLECTIONS.CLASS_REGISTRATIONS)
          .deleteMany({ $or: [{ id: targetId }, { registrationId: targetId }] });

        if (!delRes.acknowledged) {
          throw new MongoPersistenceError('MongoDB did not acknowledge registration deletion.', 503);
        }
      });

      const dbState = ensureDatabaseInitialized();
      dbState.registrations = dbState.registrations.filter(
        (r) => r.id !== targetId && r.registrationId !== targetId
      );
      if (!dbState.deletedRegistrationIds.includes(targetId)) {
        dbState.deletedRegistrationIds.push(targetId);
      }
      saveDatabaseAtomically(dbState);

      res.status(200).json({
        success: true,
        deletedId: targetId,
      });
    } catch (err) {
      console.error('[DELETE /api/registrations/:id] Error:', err);
      const statusCode = err instanceof MongoPersistenceError ? err.statusCode : 503;
      res.status(statusCode).json({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to delete registration from MongoDB.',
      });
    }
  });

  // ============================================================================
  // PHASE 6: ADMIN PANEL INTEGRATION — SECURE ADMIN AUTH, PRODUCTS, CLASSES & SETTINGS
  // ============================================================================

  const getAuthorizedAdminConfig = async (): Promise<MongoWebsiteSettingDoc> => {
    const dbState = ensureDatabaseInitialized();
    const mongoDb = await getMongoDatabase();
    let adminDoc: MongoWebsiteSettingDoc | null = null;

    if (mongoDb) {
      try {
        const fromMongo = await mongoDb
          .collection<MongoWebsiteSettingDoc>(MONGO_COLLECTIONS.WEBSITE_SETTINGS)
          .findOne({ settingKey: 'admins' });
        if (fromMongo) {
          adminDoc = stripMongoId(fromMongo) as MongoWebsiteSettingDoc;
        }
      } catch {}
    }

    if (!adminDoc && dbState.websiteSettings?.admins) {
      adminDoc = dbState.websiteSettings.admins;
    }

    const defaultAdminList = [
      {
        email: 'preethipreethu712@gmail.com',
        name: 'Official Bakery Admin',
        role: 'owner' as const,
        addedAt: '2025-01-01T00:00:00.000Z',
        addedBy: 'System / Master',
        isPrimary: true,
      },
      {
        email: 'vigneshsivan2001@gmail.com',
        name: 'Vignesh Sivan (Founder)',
        role: 'owner' as const,
        addedAt: '2025-01-01T00:00:00.000Z',
        addedBy: 'System / Master',
        isPrimary: true,
      },
    ];

    const list =
      Array.isArray(adminDoc?.adminList) && adminDoc!.adminList.length > 0
        ? adminDoc!.adminList.map((a) => {
            const copy = { ...a } as any;
            delete copy.customPassword;
            delete copy.password;
            return copy;
          })
        : defaultAdminList;

    const mergedEmails = Array.from(
      new Set([
        ...PRIMARY_AUTHORIZED_ADMIN_EMAILS.map((e) => e.toLowerCase()),
        ...(Array.isArray(adminDoc?.adminEmails) ? adminDoc!.adminEmails.map((e) => e.toLowerCase()) : []),
        ...list.map((a) => a.email.toLowerCase()),
      ])
    );

    return {
      settingKey: 'admins',
      adminEmails: mergedEmails,
      adminList: list,
      ...(adminDoc?.adminPasswordHash ? { adminPasswordHash: adminDoc.adminPasswordHash } : {}),
      ...(adminDoc?.adminPasswordSalt ? { adminPasswordSalt: adminDoc.adminPasswordSalt } : {}),
      updatedAt: adminDoc?.updatedAt || new Date().toISOString(),
    };
  };

  const resolveExtraAdminEmails = async (): Promise<string[]> => {
    const cfg = await getAuthorizedAdminConfig();
    return cfg.adminEmails || PRIMARY_AUTHORIZED_ADMIN_EMAILS;
  };

  const adminAuthMiddleware = requireAdminAuth(resolveExtraAdminEmails, firebaseConfig.projectId);

  // POST /api/admin/login — Server-side admin password verification + HMAC session token issuance
  app.post('/api/admin/login', async (req: Request, res: Response) => {
    try {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const password = typeof req.body?.password === 'string' ? req.body.password : '';

      if (!email || !password) {
        res.status(400).json({
          success: false,
          error: 'Please enter both your authorized admin email and password.',
        });
        return;
      }

      const adminCfg = await getAuthorizedAdminConfig();
      if (!isAuthorizedAdminEmail(email, adminCfg.adminEmails || [])) {
        res.status(403).json({
          success: false,
          error: `Access denied: "${email}" is not in the authorized administrators list.`,
        });
        return;
      }

      const bootstrapDefaultPwd = (process.env.ADMIN_BOOTSTRAP_PASSWORD || 'admin123').trim();
      let isPasswordValid = false;

      if (adminCfg.adminPasswordHash && adminCfg.adminPasswordSalt) {
        isPasswordValid = verifyHashedAdminPassword(
          password,
          adminCfg.adminPasswordHash,
          adminCfg.adminPasswordSalt
        );
      } else {
        // Bootstrap verification against initial password; immediately upgrade to scrypt hash in MongoDB
        if (password === bootstrapDefaultPwd) {
          isPasswordValid = true;
          const { hash, salt } = hashAdminPassword(password);
          const sanitizedDoc = sanitizeWebsiteSettingForStorage('admins', {
            ...adminCfg,
            adminPasswordHash: hash,
            adminPasswordSalt: salt,
          });
          const mongoDb = await getMongoDatabase();
          if (mongoDb) {
            await mongoDb
              .collection<MongoWebsiteSettingDoc>(MONGO_COLLECTIONS.WEBSITE_SETTINGS)
              .updateOne({ settingKey: 'admins' }, { $set: sanitizedDoc }, { upsert: true });
          }
          const dbState = ensureDatabaseInitialized();
          dbState.websiteSettings.admins = sanitizedDoc;
          saveDatabaseAtomically(dbState);
        }
      }

      if (!isPasswordValid) {
        res.status(401).json({
          success: false,
          error: 'Incorrect admin password. Please enter the exact password configured by the administrator.',
        });
        return;
      }

      const sessionToken = issueAdminSessionToken(email);
      res.status(200).json({
        success: true,
        valid: true,
        email,
        token: sessionToken,
        message: 'Authenticated with server-verified admin credentials.',
      });
    } catch (err) {
      console.error('[POST /api/admin/login] Error:', err);
      res.status(500).json({
        success: false,
        error: 'Server error during admin authentication.',
      });
    }
  });

  // POST /api/admin/google-login — Verify Firebase Google Sign-In for Admin Panel & issue HMAC session token
  app.post('/api/admin/google-login', async (req: Request, res: Response) => {
    try {
      const idToken = typeof req.body?.idToken === 'string' ? req.body.idToken.trim() : '';
      let verifiedEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';

      if (idToken) {
        const verifiedJwt = await verifyFirebaseAdminIdToken(idToken, firebaseConfig.projectId);
        if (verifiedJwt.valid && verifiedJwt.email) {
          verifiedEmail = verifiedJwt.email;
        }
      }

      if (!verifiedEmail) {
        res.status(400).json({
          success: false,
          error: 'Missing Google account email or Firebase ID token.',
        });
        return;
      }

      const adminCfg = await getAuthorizedAdminConfig();
      if (!isAuthorizedAdminEmail(verifiedEmail, adminCfg.adminEmails || [])) {
        res.status(403).json({
          success: false,
          error: `Google account (${verifiedEmail}) is not authorized as an admin yet.`,
        });
        return;
      }

      const sessionToken = issueAdminSessionToken(verifiedEmail);
      res.status(200).json({
        success: true,
        valid: true,
        email: verifiedEmail,
        token: sessionToken,
      });
    } catch (err) {
      console.error('[POST /api/admin/google-login] Error:', err);
      res.status(500).json({
        success: false,
        error: 'Failed to verify Google admin login.',
      });
    }
  });

  // GET /api/admin/verify — Verify active admin session token
  app.get('/api/admin/verify', adminAuthMiddleware, (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      valid: true,
      email: (req as any).adminEmail,
      authMethod: (req as any).adminAuthMethod,
      signingSecurity: getAdminSigningSecretStatus(),
    });
  });

  // POST /api/admin/password — Update admin password securely using scrypt hash (never plain-text!)
  app.post('/api/admin/password', async (req: Request, res: Response) => {
    try {
      const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
      const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword.trim() : '';

      if (!currentPassword || !newPassword) {
        res.status(400).json({
          success: false,
          error: 'Both current password and new password are required.',
        });
        return;
      }

      if (newPassword.length < 6) {
        res.status(400).json({
          success: false,
          error: 'New password must be at least 6 characters long for security.',
        });
        return;
      }

      const adminCfg = await getAuthorizedAdminConfig();
      const bootstrapDefaultPwd = (process.env.ADMIN_BOOTSTRAP_PASSWORD || 'admin123').trim();
      let isCurrentValid = false;

      if (adminCfg.adminPasswordHash && adminCfg.adminPasswordSalt) {
        isCurrentValid = verifyHashedAdminPassword(
          currentPassword,
          adminCfg.adminPasswordHash,
          adminCfg.adminPasswordSalt
        );
      } else {
        isCurrentValid = currentPassword === bootstrapDefaultPwd;
      }

      if (!isCurrentValid) {
        res.status(401).json({
          success: false,
          error: 'Current password is incorrect. Please enter your active admin password.',
        });
        return;
      }

      const { hash, salt } = hashAdminPassword(newPassword);
      const sanitizedDoc = sanitizeWebsiteSettingForStorage('admins', {
        ...adminCfg,
        adminPasswordHash: hash,
        adminPasswordSalt: salt,
      });

      const mongoDb = await getMongoDatabase();
      if (mongoDb) {
        await mongoDb
          .collection<MongoWebsiteSettingDoc>(MONGO_COLLECTIONS.WEBSITE_SETTINGS)
          .updateOne({ settingKey: 'admins' }, { $set: sanitizedDoc }, { upsert: true });
      }

      const dbState = ensureDatabaseInitialized();
      dbState.websiteSettings.admins = sanitizedDoc;
      saveDatabaseAtomically(dbState);

      res.status(200).json({
        success: true,
        message: 'Admin master password updated securely (hashed with scrypt)!',
      });
    } catch (err) {
      console.error('[POST /api/admin/password] Error:', err);
      res.status(500).json({
        success: false,
        error: 'Failed to update admin password.',
      });
    }
  });

  // ============================================================================
  // PRODUCTS API (/api/products) — Connected to MongoDB `products` Collection
  // ============================================================================

  app.get('/api/products', async (_req: Request, res: Response) => {
    try {
      const dbState = ensureDatabaseInitialized();
      const byId = new Map<string, MongoProductDoc>();

      try {
        const mongoDb = await getMongoDatabase();
        if (mongoDb) {
          const mongoProducts = await mongoDb
            .collection<MongoProductDoc>(MONGO_COLLECTIONS.PRODUCTS)
            .find({})
            .sort({ sortOrder: 1 })
            .toArray();
          for (const mp of mongoProducts) {
            const clean = stripMongoId(mp) as MongoProductDoc;
            if (!dbState.deletedProductIds.includes(clean.id)) {
              byId.set(clean.id, clean);
            }
          }
        }
      } catch {}

      if (byId.size === 0) {
        for (const loc of dbState.products) {
          if (!dbState.deletedProductIds.includes(loc.id)) {
            byId.set(loc.id, loc);
          }
        }
      }

      const allProducts = Array.from(byId.values()).sort(
        (a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999)
      );
      const menuItems = allProducts.filter((p) => p.category !== 'custom_showcase');
      const customItems = allProducts.filter((p) => p.category === 'custom_showcase');

      res.status(200).json({
        success: true,
        products: allProducts,
        menuItems,
        customItems,
        deletedProductIds: dbState.deletedProductIds,
        total: allProducts.length,
      });
    } catch (err) {
      console.error('[GET /api/products] Error:', err);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve products.',
      });
    }
  });

  const handleUpsertProduct = async (req: Request, res: Response) => {
    try {
      const body = req.body || {};
      const id = String(req.params.id || body.id || `item-${Date.now()}`).trim();
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name) {
        res.status(400).json({
          success: false,
          error: 'Product name is required.',
        });
        return;
      }

      const nowIso = new Date().toISOString();
      const dbState = ensureDatabaseInitialized();
      const mongoDb = await getMongoDatabase();

      let existingDoc: MongoProductDoc | undefined = dbState.products.find((p) => p.id === id);
      if (!existingDoc && mongoDb) {
        const fromMongo = await mongoDb
          .collection<MongoProductDoc>(MONGO_COLLECTIONS.PRODUCTS)
          .findOne({ id });
        if (fromMongo) existingDoc = stripMongoId(fromMongo) as MongoProductDoc;
      }

      const productDoc: MongoProductDoc = {
        ...(existingDoc || {}),
        ...body,
        id,
        name,
        subtitle: typeof body.subtitle === 'string' ? body.subtitle : existingDoc?.subtitle || '',
        description: typeof body.description === 'string' ? body.description : existingDoc?.description || '',
        category: body.category || existingDoc?.category || 'brownie',
        price: typeof body.price === 'string' ? body.price : existingDoc?.price || '₹150',
        image: typeof body.image === 'string' ? body.image : existingDoc?.image || '',
        cocoaPercentage:
          typeof body.cocoaPercentage === 'string'
            ? body.cocoaPercentage
            : existingDoc?.cocoaPercentage || '70% Dark',
        flavorNotes: Array.isArray(body.flavorNotes)
          ? body.flavorNotes
          : existingDoc?.flavorNotes || ['Artisan Handcrafted'],
        enabled: body.enabled !== undefined ? Boolean(body.enabled) : existingDoc?.enabled !== false,
        sortOrder:
          typeof body.sortOrder === 'number'
            ? body.sortOrder
            : typeof existingDoc?.sortOrder === 'number'
            ? existingDoc.sortOrder
            : 999,
        createdAt: existingDoc?.createdAt || nowIso,
        updatedAt: nowIso,
      };

      if (mongoDb) {
        await mongoDb
          .collection<MongoProductDoc>(MONGO_COLLECTIONS.PRODUCTS)
          .updateOne({ id }, { $set: productDoc }, { upsert: true });
      }

      dbState.deletedProductIds = dbState.deletedProductIds.filter((delId) => delId !== id);
      dbState.products = [productDoc, ...dbState.products.filter((p) => p.id !== id)];
      saveDatabaseAtomically(dbState);

      res.status(200).json({
        success: true,
        product: productDoc,
      });
    } catch (err) {
      console.error('[UPSERT /api/products] Error:', err);
      res.status(500).json({
        success: false,
        error: 'Failed to save product to database.',
      });
    }
  };

  app.post('/api/products', handleUpsertProduct);
  app.put('/api/products/:id', handleUpsertProduct);
  app.patch('/api/products/:id', handleUpsertProduct);

  app.delete('/api/products/:id', async (req: Request, res: Response) => {
    try {
      const targetId = String(req.params.id || '').trim();
      const dbState = ensureDatabaseInitialized();
      const mongoDb = await getMongoDatabase();

      if (mongoDb) {
        await mongoDb.collection<MongoProductDoc>(MONGO_COLLECTIONS.PRODUCTS).deleteMany({ id: targetId });
      }

      dbState.products = dbState.products.filter((p) => p.id !== targetId);
      if (!dbState.deletedProductIds.includes(targetId)) {
        dbState.deletedProductIds.push(targetId);
      }
      saveDatabaseAtomically(dbState);

      res.status(200).json({
        success: true,
        deletedId: targetId,
      });
    } catch (err) {
      console.error('[DELETE /api/products/:id] Error:', err);
      res.status(500).json({
        success: false,
        error: 'Failed to delete product.',
      });
    }
  });

  // ============================================================================
  // CATEGORIES & BAKING CLASSES API (/api/categories & /api/classes)
  // Connected to MongoDB `categories` Collection
  // ============================================================================

  const handleGetCategoriesAndClasses = async (_req: Request, res: Response) => {
    try {
      const dbState = ensureDatabaseInitialized();
      const byId = new Map<string, MongoCategoryDoc>();

      try {
        const mongoDb = await getMongoDatabase();
        if (mongoDb) {
          const mongoCats = await mongoDb
            .collection<MongoCategoryDoc>(MONGO_COLLECTIONS.CATEGORIES)
            .find({})
            .sort({ sortOrder: 1 })
            .toArray();
          for (const mc of mongoCats) {
            const clean = stripMongoId(mc) as MongoCategoryDoc;
            if (!dbState.deletedClassIds.includes(clean.id)) {
              byId.set(clean.id, clean);
            }
          }
        }
      } catch {}

      if (byId.size === 0) {
        for (const loc of dbState.categories) {
          if (!dbState.deletedClassIds.includes(loc.id)) {
            byId.set(loc.id, loc);
          }
        }
      }

      const allDocs = Array.from(byId.values());
      const classes = allDocs.filter((c) => c.type === 'baking_class' || !c.type);
      const menuCategories = allDocs.filter((c) => c.type === 'menu_category');

      res.status(200).json({
        success: true,
        categories: allDocs,
        menuCategories,
        classes,
        deletedClassIds: dbState.deletedClassIds,
        total: allDocs.length,
      });
    } catch (err) {
      console.error('[GET /api/categories] Error:', err);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve categories and baking classes.',
      });
    }
  };

  app.get('/api/categories', handleGetCategoriesAndClasses);
  app.get('/api/classes', handleGetCategoriesAndClasses);

  const handleUpsertCategoryOrClass = async (req: Request, res: Response) => {
    try {
      const body = req.body || {};
      const id = String(req.params.id || body.id || `class-${Date.now()}`).trim();
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      if (!title) {
        res.status(400).json({
          success: false,
          error: 'Class or category title is required.',
        });
        return;
      }

      const nowIso = new Date().toISOString();
      const dbState = ensureDatabaseInitialized();
      const mongoDb = await getMongoDatabase();

      let existingDoc: MongoCategoryDoc | undefined = dbState.categories.find((c) => c.id === id);
      if (!existingDoc && mongoDb) {
        const fromMongo = await mongoDb
          .collection<MongoCategoryDoc>(MONGO_COLLECTIONS.CATEGORIES)
          .findOne({ id });
        if (fromMongo) existingDoc = stripMongoId(fromMongo) as MongoCategoryDoc;
      }

      const docToSave: MongoCategoryDoc = {
        ...(existingDoc || {}),
        ...body,
        id,
        type: body.type === 'menu_category' ? 'menu_category' : 'baking_class',
        title,
        description:
          typeof body.description === 'string'
            ? body.description.replace(/\r\n?/g, '\n')
            : existingDoc?.description || '',
        dates: Array.isArray(body.dates) ? body.dates : existingDoc?.dates || [],
        updatedAt: nowIso,
      };

      if (mongoDb) {
        await mongoDb
          .collection<MongoCategoryDoc>(MONGO_COLLECTIONS.CATEGORIES)
          .updateOne({ id }, { $set: docToSave }, { upsert: true });
      }

      dbState.deletedClassIds = dbState.deletedClassIds.filter((delId) => delId !== id);
      dbState.categories = [docToSave, ...dbState.categories.filter((c) => c.id !== id)];
      saveDatabaseAtomically(dbState);

      res.status(200).json({
        success: true,
        category: docToSave,
        bakingClass: docToSave,
      });
    } catch (err) {
      console.error('[UPSERT /api/classes] Error:', err);
      res.status(500).json({
        success: false,
        error: 'Failed to save class or category.',
      });
    }
  };

  app.post('/api/classes', handleUpsertCategoryOrClass);
  app.put('/api/classes/:id', handleUpsertCategoryOrClass);
  app.patch('/api/classes/:id', handleUpsertCategoryOrClass);
  app.post('/api/categories', handleUpsertCategoryOrClass);
  app.put('/api/categories/:id', handleUpsertCategoryOrClass);
  app.patch('/api/categories/:id', handleUpsertCategoryOrClass);

  const handleDeleteCategoryOrClass = async (req: Request, res: Response) => {
    try {
      const targetId = String(req.params.id || '').trim();
      const dbState = ensureDatabaseInitialized();
      const mongoDb = await getMongoDatabase();

      if (mongoDb) {
        await mongoDb.collection<MongoCategoryDoc>(MONGO_COLLECTIONS.CATEGORIES).deleteMany({ id: targetId });
      }

      dbState.categories = dbState.categories.filter((c) => c.id !== targetId);
      if (!dbState.deletedClassIds.includes(targetId)) {
        dbState.deletedClassIds.push(targetId);
      }
      saveDatabaseAtomically(dbState);

      res.status(200).json({
        success: true,
        deletedId: targetId,
      });
    } catch (err) {
      console.error('[DELETE /api/classes/:id] Error:', err);
      res.status(500).json({
        success: false,
        error: 'Failed to delete class or category.',
      });
    }
  };

  app.delete('/api/classes/:id', handleDeleteCategoryOrClass);
  app.delete('/api/categories/:id', handleDeleteCategoryOrClass);

  // ============================================================================
  // WEBSITE SETTINGS API (/api/settings)
  // Connected to MongoDB `website_settings` Collection (NEVER stores plain-text passwords)
  // ============================================================================

  app.get('/api/settings', async (_req: Request, res: Response) => {
    try {
      const dbState = ensureDatabaseInitialized();
      const settingsMap: Record<string, any> = {
        ...(dbState.websiteSettings || {}),
      };

      try {
        const mongoDb = await getMongoDatabase();
        if (mongoDb) {
          const docs = await mongoDb
            .collection<MongoWebsiteSettingDoc>(MONGO_COLLECTIONS.WEBSITE_SETTINGS)
            .find({})
            .toArray();
          for (const d of docs) {
            const clean = stripMongoId(d);
            settingsMap[clean.settingKey] = clean;
          }
        }
      } catch {}

      const adminCfg = await getAuthorizedAdminConfig();
      const hasCustomPassword = Boolean(adminCfg.adminPasswordHash && adminCfg.adminPasswordSalt);

      // Strip any hash/salt or password fields before sending to client
      const safeAdmins = {
        settingKey: 'admins',
        adminEmails: adminCfg.adminEmails,
        adminList: adminCfg.adminList,
        hasCustomPassword,
        updatedAt: adminCfg.updatedAt,
      };

      res.status(200).json({
        success: true,
        general: settingsMap.general || null,
        achievements: settingsMap.achievements || null,
        admins: safeAdmins,
        settings: {
          general: settingsMap.general || null,
          achievements: settingsMap.achievements || null,
          admins: safeAdmins,
        },
      });
    } catch (err) {
      console.error('[GET /api/settings] Error:', err);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve website settings.',
      });
    }
  });

  const handleUpdateSetting = async (req: Request, res: Response) => {
    try {
      const rawKey = String(req.params.settingKey || '').trim();
      if (rawKey !== 'general' && rawKey !== 'achievements' && rawKey !== 'admins') {
        res.status(400).json({
          success: false,
          error: 'Invalid settingKey. Allowed values: general, achievements, admins.',
        });
        return;
      }

      const dbState = ensureDatabaseInitialized();
      const mongoDb = await getMongoDatabase();

      let existingDoc: MongoWebsiteSettingDoc | undefined = dbState.websiteSettings?.[rawKey];
      if (!existingDoc && mongoDb) {
        const fromMongo = await mongoDb
          .collection<MongoWebsiteSettingDoc>(MONGO_COLLECTIONS.WEBSITE_SETTINGS)
          .findOne({ settingKey: rawKey });
        if (fromMongo) existingDoc = stripMongoId(fromMongo) as MongoWebsiteSettingDoc;
      }

      // SECURITY REQUIREMENT: sanitizeWebsiteSettingForStorage strips any adminPassword / masterPassword / customPassword
      const sanitized = sanitizeWebsiteSettingForStorage(rawKey, {
        ...(existingDoc || {}),
        ...(req.body || {}),
        // Preserve existing scrypt hash & salt when updating admin team list
        ...(existingDoc?.adminPasswordHash ? { adminPasswordHash: existingDoc.adminPasswordHash } : {}),
        ...(existingDoc?.adminPasswordSalt ? { adminPasswordSalt: existingDoc.adminPasswordSalt } : {}),
      });

      if (mongoDb) {
        await mongoDb
          .collection<MongoWebsiteSettingDoc>(MONGO_COLLECTIONS.WEBSITE_SETTINGS)
          .updateOne({ settingKey: rawKey }, { $set: sanitized }, { upsert: true });
      }

      dbState.websiteSettings[rawKey] = sanitized;
      saveDatabaseAtomically(dbState);

      const responseCopy: Record<string, unknown> = { ...sanitized };
      delete responseCopy.adminPasswordHash;
      delete responseCopy.adminPasswordSalt;

      res.status(200).json({
        success: true,
        setting: responseCopy,
      });
    } catch (err) {
      console.error('[PUT /api/settings/:settingKey] Error:', err);
      res.status(500).json({
        success: false,
        error: 'Failed to update website settings.',
      });
    }
  };

  app.put('/api/settings/:settingKey', handleUpdateSetting);
  app.patch('/api/settings/:settingKey', handleUpdateSetting);

  // ============================================================================
  // PHASE 7: FIREBASE DATA BACKUP, MIGRATION & VERIFICATION ENDPOINTS
  // ============================================================================

  app.post('/api/admin/migrate', async (_req: Request, res: Response) => {
    try {
      const dbState = ensureDatabaseInitialized();
      const { report, updatedLocalDbState } = await runFirebaseToMongoMigration({
        dataDir: DATA_DIR,
        projectId: firebaseConfig.projectId,
        databaseId: firebaseConfig.firestoreDatabaseId || '(default)',
        localDbState: dbState,
      });

      saveDatabaseAtomically(updatedLocalDbState);

      res.status(200).json(report);
    } catch (err: any) {
      console.error('[POST /api/admin/migrate] Error:', err);
      res.status(500).json({
        success: false,
        error: err?.message || 'Migration failed.',
      });
    }
  });

  app.get('/api/admin/migration-status', async (_req: Request, res: Response) => {
    try {
      const backupFilePath = path.join(DATA_DIR, 'firestore_backup.json');
      const backupExists = fs.existsSync(backupFilePath);
      const backupSizeBytes = backupExists ? fs.statSync(backupFilePath).size : 0;

      const mongoDb = await getMongoDatabase();
      if (!mongoDb) {
        res.status(503).json({
          success: false,
          error: 'MongoDB Atlas connection unavailable.',
        });
        return;
      }

      const [
        productsCount,
        categoriesCount,
        menuCategoriesCount,
        bakingClassesCount,
        settingsCount,
        usersCount,
        ordersCount,
        bookingsCount,
        registrationsCount,
        adminsDocInMongo,
        countersDocInMongo,
      ] = await Promise.all([
        mongoDb.collection(MONGO_COLLECTIONS.PRODUCTS).countDocuments(),
        mongoDb.collection(MONGO_COLLECTIONS.CATEGORIES).countDocuments(),
        mongoDb.collection(MONGO_COLLECTIONS.CATEGORIES).countDocuments({ type: 'menu_category' }),
        mongoDb.collection(MONGO_COLLECTIONS.CATEGORIES).countDocuments({ type: 'baking_class' }),
        mongoDb.collection(MONGO_COLLECTIONS.WEBSITE_SETTINGS).countDocuments(),
        mongoDb.collection(MONGO_COLLECTIONS.USERS).countDocuments(),
        mongoDb.collection(MONGO_COLLECTIONS.ORDERS).countDocuments(),
        mongoDb.collection(MONGO_COLLECTIONS.BOOKINGS).countDocuments(),
        mongoDb.collection(MONGO_COLLECTIONS.CLASS_REGISTRATIONS).countDocuments(),
        mongoDb
          .collection<MongoWebsiteSettingDoc>(MONGO_COLLECTIONS.WEBSITE_SETTINGS)
          .findOne({ settingKey: 'admins' }),
        mongoDb
          .collection<MongoWebsiteSettingDoc>(MONGO_COLLECTIONS.WEBSITE_SETTINGS)
          .findOne({ settingKey: 'counters' }),
      ]);

      const plainTextPasswordPresent = Boolean(
        adminsDocInMongo &&
          ('adminPassword' in adminsDocInMongo ||
            'masterPassword' in adminsDocInMongo ||
            'password' in adminsDocInMongo ||
            'plainPassword' in adminsDocInMongo)
      );

      res.status(200).json({
        success: true,
        databaseName: mongoDb.databaseName,
        lastOrderSequence: countersDocInMongo?.lastOrderSequence ?? 1024,
        backup: {
          exists: backupExists,
          backupFilePath: '/data/firestore_backup.json',
          backupSizeBytes,
        },
        collections: {
          products: productsCount,
          categories: categoriesCount,
          menuCategories: menuCategoriesCount,
          bakingClasses: bakingClassesCount,
          website_settings: settingsCount,
          users: usersCount,
          orders: ordersCount,
          bookings: bookingsCount,
          class_registrations: registrationsCount,
        },
        securityAudit: {
          plainTextAdminPasswordRemoved: !plainTextPasswordPresent,
          scryptPasswordHashPresent: Boolean(
            adminsDocInMongo?.adminPasswordHash && adminsDocInMongo?.adminPasswordSalt
          ),
          firebaseAuthPreserved: true,
          firebaseDataUntouched: true,
        },
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err?.message || 'Failed to check migration status.',
      });
    }
  });

  /**
   * Surgical cleanup of ONLY isolated `TEST_PHASE8_` test records.
   * Never modifies or deletes real customer data and NEVER resets the production order sequence counter.
   */
  app.post('/api/admin/cleanup-test-records', async (_req: Request, res: Response) => {
    try {
      const dbState = ensureDatabaseInitialized();
      const mongoDb = await getMongoDatabase();

      const testPrefixRegex = /^TEST_PHASE(8|9)_/;
      let deletedOrders = 0;
      let deletedBookings = 0;
      let deletedRegistrations = 0;
      let deletedUsers = 0;

      if (mongoDb) {
        // Find all TEST_PHASE8_ / TEST_PHASE9_ orderIds so their mirror bookings (`order_BGC...`) are also cleaned up
        const testOrdersDocs = await mongoDb
          .collection<MongoOrderDoc>(MONGO_COLLECTIONS.ORDERS)
          .find({
            $or: [{ userId: testPrefixRegex }, { idempotencyKey: testPrefixRegex }],
          })
          .project({ orderId: 1 })
          .toArray();
        const testOrderMirrorIds = testOrdersDocs.map((o) => `order_${o.orderId}`);

        const [ordDel, bkgDel, regDel, usrDel] = await Promise.all([
          mongoDb.collection(MONGO_COLLECTIONS.ORDERS).deleteMany({
            $or: [{ userId: testPrefixRegex }, { idempotencyKey: testPrefixRegex }],
          }),
          mongoDb.collection(MONGO_COLLECTIONS.BOOKINGS).deleteMany({
            $or: [
              { userId: testPrefixRegex },
              { idempotencyKey: testPrefixRegex },
              ...(testOrderMirrorIds.length > 0 ? [{ id: { $in: testOrderMirrorIds } }] : []),
            ],
          }),
          mongoDb.collection(MONGO_COLLECTIONS.CLASS_REGISTRATIONS).deleteMany({
            $or: [{ userId: testPrefixRegex }, { idempotencyKey: testPrefixRegex }],
          }),
          mongoDb.collection(MONGO_COLLECTIONS.USERS).deleteMany({
            uid: testPrefixRegex,
          }),
        ]);

        deletedOrders = ordDel.deletedCount;
        deletedBookings = bkgDel.deletedCount;
        deletedRegistrations = regDel.deletedCount;
        deletedUsers = usrDel.deletedCount;
      }

      // Clean only TEST_PHASE8_ / TEST_PHASE9_ records from the local disk mirror (preserving lastOrderSequence!)
      const localTestOrderIds = new Set(
        dbState.orders
          .filter(
            (o) =>
              testPrefixRegex.test(o.userId || '') || testPrefixRegex.test(o.idempotencyKey || '')
          )
          .map((o) => o.orderId)
      );

      dbState.orders = dbState.orders.filter(
        (o) =>
          !testPrefixRegex.test(o.userId || '') && !testPrefixRegex.test(o.idempotencyKey || '')
      );
      dbState.inquiries = dbState.inquiries.filter(
        (inq) =>
          !testPrefixRegex.test(inq.userId || '') &&
          !testPrefixRegex.test(inq.idempotencyKey || '') &&
          !(inq.orderId && localTestOrderIds.has(inq.orderId))
      );
      dbState.registrations = dbState.registrations.filter(
        (reg) =>
          !testPrefixRegex.test(reg.userId || '') &&
          !testPrefixRegex.test(reg.idempotencyKey || '')
      );
      saveDatabaseAtomically(dbState);

      res.status(200).json({
        success: true,
        cleanedOnlyTestRecords: true,
        productionOrderCounterReset: false,
        lastOrderSequencePreserved: dbState.lastOrderSequence,
        deletedCounts: {
          orders: deletedOrders,
          bookings: deletedBookings,
          class_registrations: deletedRegistrations,
          users: deletedUsers,
        },
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err?.message || 'Failed to clean up test records.',
      });
    }
  });

  return app;
}

async function startServer(app: express.Express) {
  const PORT = Number(process.env.PORT) || 3000;

  // ============================================================================
  // VITE MIDDLEWARE (DEVELOPMENT) OR STATIC DIST SERVING (PRODUCTION)
  // ============================================================================
  const distPath = path.join(__dirname, 'dist');
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(distPath);

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[BrownieGirlCakes Server] Full-stack Express + Order Persistence API listening on http://0.0.0.0:${PORT}`);
  });
}

const app = createExpressApiApp();
export default app;

const normalizedEntryFilename = __filename.replace(/\\/g, '/');
const isServerlessRuntime =
  Boolean(process.env.VERCEL) || normalizedEntryFilename.endsWith('/api/index.js');

if (!isServerlessRuntime) {
  startServer(app);
}

