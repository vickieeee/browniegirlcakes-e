// server.ts
import express from "express";
import fs2 from "fs";
import path2 from "path";
import { fileURLToPath } from "url";

// src/lib/mongodb.ts
import { MongoClient, ServerApiVersion } from "mongodb";
import dotenv from "dotenv";

// src/lib/mongoSchema.ts
var MONGO_COLLECTIONS = {
  USERS: "users",
  ORDERS: "orders",
  BOOKINGS: "bookings",
  CLASS_REGISTRATIONS: "class_registrations",
  PRODUCTS: "products",
  CATEGORIES: "categories",
  WEBSITE_SETTINGS: "website_settings"
};
function sanitizeWebsiteSettingForStorage(settingKey, rawPayload) {
  const copy = { ...rawPayload };
  delete copy.adminPassword;
  delete copy.masterPassword;
  delete copy.password;
  delete copy.plainPassword;
  if (Array.isArray(copy.adminList)) {
    copy.adminList = copy.adminList.map((entry) => {
      const cleanedEntry = { ...entry };
      delete cleanedEntry.customPassword;
      delete cleanedEntry.password;
      return cleanedEntry;
    });
  }
  return {
    ...copy,
    settingKey,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function parsePaginationParams(query, defaultLimit = 50, maxLimit = 200) {
  const rawPage = Number(query.page);
  const rawLimit = Number(query.limit);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.min(maxLimit, Math.floor(rawLimit)) : defaultLimit;
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}
var indexesInitialized = false;
async function ensureMongoIndexes(db) {
  if (indexesInitialized) return;
  try {
    await Promise.all([
      // 1. users indexes
      db.collection(MONGO_COLLECTIONS.USERS).createIndexes([
        { key: { uid: 1 }, name: "idx_users_uid_unique", unique: true },
        { key: { email: 1 }, name: "idx_users_email" },
        { key: { role: 1 }, name: "idx_users_role" }
      ]),
      // 2. orders indexes
      db.collection(MONGO_COLLECTIONS.ORDERS).createIndexes([
        { key: { orderId: 1 }, name: "idx_orders_orderId_unique", unique: true },
        {
          key: { idempotencyKey: 1 },
          name: "idx_orders_idempotency_sparse",
          unique: true,
          sparse: true
        },
        { key: { createdAt: -1 }, name: "idx_orders_createdAt_desc" },
        { key: { userId: 1, createdAt: -1 }, name: "idx_orders_user_createdAt" },
        { key: { status: 1, createdAt: -1 }, name: "idx_orders_status_createdAt" },
        { key: { customerPhone: 1 }, name: "idx_orders_customerPhone" }
      ]),
      // 3. bookings indexes (custom cake orders & inquiries)
      db.collection(MONGO_COLLECTIONS.BOOKINGS).createIndexes([
        { key: { id: 1 }, name: "idx_bookings_id_unique", unique: true },
        {
          key: { idempotencyKey: 1 },
          name: "idx_bookings_idempotency_sparse",
          unique: true,
          sparse: true
        },
        { key: { createdAt: -1 }, name: "idx_bookings_createdAt_desc" },
        { key: { userId: 1, createdAt: -1 }, name: "idx_bookings_user_createdAt" },
        { key: { status: 1, createdAt: -1 }, name: "idx_bookings_status_createdAt" }
      ]),
      // 4. class_registrations indexes (masterclass enrollments + duplicate booking guard)
      db.collection(MONGO_COLLECTIONS.CLASS_REGISTRATIONS).createIndexes([
        { key: { id: 1 }, name: "idx_class_reg_id_unique", unique: true },
        {
          key: { idempotencyKey: 1 },
          name: "idx_class_reg_idempotency_sparse",
          unique: true,
          sparse: true
        },
        {
          key: { userEmail: 1, className: 1, preferredDate: 1, status: 1 },
          name: "idx_class_reg_duplicate_lookup"
        },
        { key: { createdAt: -1 }, name: "idx_class_reg_createdAt_desc" },
        { key: { userId: 1, createdAt: -1 }, name: "idx_class_reg_user_createdAt" }
      ]),
      // 5. products indexes
      db.collection(MONGO_COLLECTIONS.PRODUCTS).createIndexes([
        { key: { id: 1 }, name: "idx_products_id_unique", unique: true },
        { key: { category: 1, sortOrder: 1 }, name: "idx_products_category_sort" },
        { key: { enabled: 1, sortOrder: 1 }, name: "idx_products_enabled_sort" }
      ]),
      // 6. categories indexes (menu categories + baking classes)
      db.collection(MONGO_COLLECTIONS.CATEGORIES).createIndexes([
        { key: { id: 1 }, name: "idx_categories_id_unique", unique: true },
        { key: { type: 1, sortOrder: 1 }, name: "idx_categories_type_sort" }
      ]),
      // 7. website_settings indexes
      db.collection(MONGO_COLLECTIONS.WEBSITE_SETTINGS).createIndexes([
        { key: { settingKey: 1 }, name: "idx_website_settings_key_unique", unique: true }
      ])
    ]);
    indexesInitialized = true;
  } catch {
  }
}
async function getNextMongoOrderSequence(db, minimumFloor = 1024) {
  const settingsCol = db.collection(MONGO_COLLECTIONS.WEBSITE_SETTINGS);
  const existingCounter = await settingsCol.findOne({ settingKey: "counters" });
  if (!existingCounter || typeof existingCounter.lastOrderSequence !== "number" || existingCounter.lastOrderSequence < minimumFloor) {
    await settingsCol.updateOne(
      { settingKey: "counters" },
      {
        $max: { lastOrderSequence: minimumFloor },
        $set: { updatedAt: (/* @__PURE__ */ new Date()).toISOString() }
      },
      { upsert: true }
    );
  }
  const updated = await settingsCol.findOneAndUpdate(
    { settingKey: "counters" },
    {
      $inc: { lastOrderSequence: 1 },
      $set: { updatedAt: (/* @__PURE__ */ new Date()).toISOString() }
    },
    { upsert: true, returnDocument: "after" }
  );
  return updated?.lastOrderSequence ?? minimumFloor + 1;
}

// src/lib/mongodb.ts
dotenv.config();
var DEFAULT_DB_NAME = "browniegirlcakes";
function normalizeMongoUri(rawInput) {
  if (!rawInput) return "";
  let uri = rawInput.trim();
  if (/^MONGODB_URI\s*=/i.test(uri)) {
    uri = uri.replace(/^MONGODB_URI\s*=\s*/i, "").trim();
  }
  if (uri.startsWith('"') && uri.endsWith('"') || uri.startsWith("'") && uri.endsWith("'")) {
    uri = uri.slice(1, -1).trim();
  }
  const schemeMatch = uri.match(/^(mongodb(?:\+srv)?:\/\/)(.*)$/i);
  if (!schemeMatch) return uri;
  const scheme = schemeMatch[1];
  const remainder = schemeMatch[2];
  const slashIdx = remainder.indexOf("/");
  const authorityPart = slashIdx === -1 ? remainder : remainder.slice(0, slashIdx);
  const pathAndQueryPart = slashIdx === -1 ? "" : remainder.slice(slashIdx);
  const lastAtIdx = authorityPart.lastIndexOf("@");
  if (lastAtIdx === -1) return uri;
  const userInfo = authorityPart.slice(0, lastAtIdx);
  const hostPart = authorityPart.slice(lastAtIdx + 1);
  const firstColonIdx = userInfo.indexOf(":");
  if (firstColonIdx === -1) return uri;
  let rawUser = userInfo.slice(0, firstColonIdx).trim();
  let rawPass = userInfo.slice(firstColonIdx + 1).trim();
  if (rawUser.startsWith("<") && rawUser.endsWith(">") && rawUser.length > 2) {
    rawUser = rawUser.slice(1, -1).trim();
  }
  if (rawPass.startsWith("<") && rawPass.endsWith(">") && rawPass.length > 2 && !/^<(db_password|password)>$/i.test(rawPass)) {
    rawPass = rawPass.slice(1, -1).trim();
  }
  if (/^<?(db_password|password)>?$/i.test(rawPass)) {
    return `${scheme}${rawUser}:<db_password>@${hostPart}${pathAndQueryPart}`;
  }
  const safeEncode = (val) => {
    try {
      return encodeURIComponent(decodeURIComponent(val));
    } catch {
      return encodeURIComponent(val);
    }
  };
  return `${scheme}${safeEncode(rawUser)}:${safeEncode(rawPass)}@${hostPart}${pathAndQueryPart}`;
}
function isMongoConfigured() {
  const uri = normalizeMongoUri(process.env.MONGODB_URI);
  return Boolean(
    uri && uri !== "MY_MONGODB_URI" && !uri.includes("<db_password>") && (uri.startsWith("mongodb+srv://") || uri.startsWith("mongodb://"))
  );
}
function getMongoDbName() {
  return (process.env.MONGODB_DB_NAME || DEFAULT_DB_NAME).trim() || DEFAULT_DB_NAME;
}
async function connectMongoClient() {
  const uri = normalizeMongoUri(process.env.MONGODB_URI);
  if (globalThis.__bgcMongoFailedUri === uri && globalThis.__bgcMongoLastErrorMsg) {
    throw new Error(globalThis.__bgcMongoLastErrorMsg);
  }
  if (!globalThis.__bgcMongoClientPromise || globalThis.__bgcMongoLastUri !== uri) {
    const client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true
      },
      maxPoolSize: 10,
      minPoolSize: 1,
      connectTimeoutMS: 8e3,
      serverSelectionTimeoutMS: 8e3
    });
    globalThis.__bgcMongoLastUri = uri;
    globalThis.__bgcMongoClientPromise = client.connect().then((connected) => {
      globalThis.__bgcMongoFailedUri = void 0;
      globalThis.__bgcMongoLastErrorMsg = void 0;
      return connected;
    }).catch((err) => {
      globalThis.__bgcMongoClientPromise = void 0;
      const msg = err instanceof Error ? err.message : String(err);
      if (/bad auth|authentication failed/i.test(msg)) {
        globalThis.__bgcMongoFailedUri = uri;
        globalThis.__bgcMongoLastErrorMsg = msg;
      }
      throw err;
    });
  }
  return globalThis.__bgcMongoClientPromise;
}
async function getMongoDatabase() {
  if (!isMongoConfigured()) {
    return null;
  }
  try {
    const connectedClient = await connectMongoClient();
    const db = connectedClient.db(getMongoDbName());
    await ensureMongoIndexes(db);
    return db;
  } catch {
    return null;
  }
}
async function checkMongoConnectionHealth() {
  const dbName = getMongoDbName();
  if (!isMongoConfigured()) {
    return {
      configured: false,
      connected: false,
      databaseName: dbName,
      message: "MONGODB_URI is not yet set in environment variables (or still contains <db_password>). Using local server fallback until configured."
    };
  }
  try {
    const connectedClient = await connectMongoClient();
    const db = connectedClient.db(dbName);
    await db.command({ ping: 1 });
    await ensureMongoIndexes(db);
    return {
      configured: true,
      connected: true,
      databaseName: dbName,
      message: `Successfully connected to MongoDB Atlas database "${dbName}".`
    };
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    const safeMsg = rawMsg.replace(/mongodb(\+srv)?:\/\/[^\s]+/gi, "[REDACTED_MONGODB_URI]");
    return {
      configured: true,
      connected: false,
      databaseName: dbName,
      message: `MongoDB Atlas standby (${safeMsg}) \u2014 using persistent server storage until database user password matches in Atlas.`
    };
  }
}

// src/lib/adminAuth.ts
import crypto from "crypto";
import dotenv2 from "dotenv";
dotenv2.config();
var PRIMARY_AUTHORIZED_ADMIN_EMAILS = [
  "vigneshsivan2001@gmail.com",
  "preethipreethu712@gmail.com"
];
var DEFAULT_FIREBASE_PROJECT_ID = "extreme-spark-dxctm";
var SESSION_TTL_MS = 24 * 60 * 60 * 1e3;
function resolveAdminHmacSecret() {
  const explicitSecret = (process.env.ADMIN_SESSION_SECRET || "").trim();
  if (explicitSecret && explicitSecret !== "MY_ADMIN_SESSION_SECRET" && explicitSecret.length >= 16) {
    return {
      secret: explicitSecret,
      source: "ADMIN_SESSION_SECRET",
      configuredViaEnv: true
    };
  }
  const mongoUri = (process.env.MONGODB_URI || "").trim();
  if (mongoUri && mongoUri !== "MY_MONGODB_URI" && !mongoUri.includes("<db_password>") && (mongoUri.startsWith("mongodb+srv://") || mongoUri.startsWith("mongodb://"))) {
    const derived = crypto.scryptSync(mongoUri, "bgc_admin_hmac_kdf_v1", 32).toString("hex");
    return {
      secret: derived,
      source: "MONGODB_URI_DERIVED",
      configuredViaEnv: true
    };
  }
  if (!globalThis.__bgcRuntimeHmacSecret) {
    globalThis.__bgcRuntimeHmacSecret = crypto.randomBytes(32).toString("hex");
  }
  return {
    secret: globalThis.__bgcRuntimeHmacSecret,
    source: "RUNTIME_EPHEMERAL_256BIT",
    configuredViaEnv: false
  };
}
function getAdminSigningSecretStatus() {
  const resolved = resolveAdminHmacSecret();
  return {
    algorithm: "HMAC-SHA256",
    configuredViaEnv: resolved.configuredViaEnv,
    source: resolved.source,
    keyLengthBits: Buffer.from(resolved.secret, "utf-8").length * 8
  };
}
function hashAdminPassword(plainPassword, existingSalt) {
  const salt = existingSalt || crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(plainPassword, salt, 64).toString("hex");
  return { hash: derivedKey, salt };
}
function verifyHashedAdminPassword(candidatePassword, storedHash, storedSalt) {
  try {
    const { hash } = hashAdminPassword(candidatePassword, storedSalt);
    const a = Buffer.from(hash, "hex");
    const b = Buffer.from(storedHash, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
function issueAdminSessionToken(email, ttlMs = SESSION_TTL_MS) {
  const cleanEmail = email.trim().toLowerCase();
  const issuedAt = Date.now();
  const expiresAt = issuedAt + ttlMs;
  const { secret } = resolveAdminHmacSecret();
  const payload = Buffer.from(
    JSON.stringify({
      email: cleanEmail,
      role: "admin",
      iat: issuedAt,
      exp: expiresAt
    })
  ).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}
function verifyAdminSessionToken(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) {
      return { valid: false, reason: "Malformed token format" };
    }
    const [payload, signature] = parts;
    const { secret } = resolveAdminHmacSecret();
    const expectedSig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
    const a = Buffer.from(signature);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { valid: false, reason: "Invalid HMAC signature" };
    }
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
    if (!decoded?.email || typeof decoded.email !== "string") {
      return { valid: false, reason: "Missing email claim" };
    }
    if (typeof decoded.exp === "number" && Date.now() > decoded.exp) {
      return { valid: false, reason: "Session token expired" };
    }
    return {
      valid: true,
      email: decoded.email.toLowerCase(),
      expiresAt: decoded.exp
    };
  } catch {
    return { valid: false, reason: "Token verification error" };
  }
}
async function getGooglePublicCerts() {
  const now = Date.now();
  if (globalThis.__bgcGooglePublicCertsCache && globalThis.__bgcGooglePublicCertsCache.expiresAt > now) {
    return globalThis.__bgcGooglePublicCertsCache.certs;
  }
  const res = await fetch(
    "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch Google public certificates: HTTP ${res.status}`);
  }
  const certs = await res.json();
  globalThis.__bgcGooglePublicCertsCache = {
    certs,
    expiresAt: now + 60 * 60 * 1e3
    // Cache for 1 hour
  };
  return certs;
}
async function verifyFirebaseAdminIdToken(idToken, expectedProjectId = DEFAULT_FIREBASE_PROJECT_ID) {
  try {
    const segments = idToken.split(".");
    if (segments.length !== 3) {
      return { valid: false, reason: "Not a 3-part JWT" };
    }
    const [headerB64, payloadB64, signatureB64] = segments;
    const header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf-8"));
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));
    if (header.alg !== "RS256" || !header.kid) {
      return { valid: false, reason: "Invalid JWT header algorithm or missing kid" };
    }
    const nowSec = Math.floor(Date.now() / 1e3);
    if (typeof payload.exp !== "number" || payload.exp < nowSec) {
      return { valid: false, reason: "Firebase ID token expired" };
    }
    if (payload.aud !== expectedProjectId) {
      return { valid: false, reason: "Firebase ID token audience mismatch" };
    }
    if (payload.iss !== `https://securetoken.google.com/${expectedProjectId}`) {
      return { valid: false, reason: "Firebase ID token issuer mismatch" };
    }
    const certs = await getGooglePublicCerts();
    const cert = certs[header.kid];
    if (!cert) {
      return { valid: false, reason: "No matching Google X.509 certificate for token kid" };
    }
    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(`${headerB64}.${payloadB64}`);
    verifier.end();
    const sigBuffer = Buffer.from(signatureB64, "base64url");
    const isSigValid = verifier.verify(cert, sigBuffer);
    if (!isSigValid) {
      return { valid: false, reason: "Invalid RSA-SHA256 signature on Firebase ID token" };
    }
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    if (!email) {
      return { valid: false, reason: "Firebase ID token does not contain an email claim" };
    }
    return {
      valid: true,
      email,
      uid: payload.sub || payload.user_id
    };
  } catch (err) {
    return {
      valid: false,
      reason: err instanceof Error ? err.message : "Firebase JWT verification failed"
    };
  }
}
function isAuthorizedAdminEmail(email, extraAllowedEmails = []) {
  const clean = (email || "").trim().toLowerCase();
  if (!clean) return false;
  const allowed = /* @__PURE__ */ new Set([
    ...PRIMARY_AUTHORIZED_ADMIN_EMAILS.map((e) => e.toLowerCase()),
    ...extraAllowedEmails.map((e) => e.toLowerCase())
  ]);
  return allowed.has(clean);
}
function requireAdminAuth(extraAllowedEmailsResolver, expectedProjectId = DEFAULT_FIREBASE_PROJECT_ID) {
  return async (req, res, next) => {
    try {
      const extraEmails = extraAllowedEmailsResolver ? await extraAllowedEmailsResolver() : [];
      const authHeader = req.headers.authorization || "";
      const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
      if (!bearerToken) {
        res.status(401).json({
          success: false,
          error: "Unauthorized: Missing Authorization Bearer token for admin operation."
        });
        return;
      }
      if (bearerToken.split(".").length === 2) {
        const verifiedHmac = verifyAdminSessionToken(bearerToken);
        if (verifiedHmac.valid && verifiedHmac.email) {
          if (!isAuthorizedAdminEmail(verifiedHmac.email, extraEmails)) {
            res.status(403).json({
              success: false,
              error: `Forbidden: Email (${verifiedHmac.email}) is not an authorized admin account.`
            });
            return;
          }
          req.adminEmail = verifiedHmac.email;
          req.adminAuthMethod = "hmac-session-token";
          next();
          return;
        }
      }
      if (bearerToken.split(".").length === 3) {
        const verifiedFirebase = await verifyFirebaseAdminIdToken(bearerToken, expectedProjectId);
        if (verifiedFirebase.valid && verifiedFirebase.email) {
          if (!isAuthorizedAdminEmail(verifiedFirebase.email, extraEmails)) {
            res.status(403).json({
              success: false,
              error: `Forbidden: Firebase account (${verifiedFirebase.email}) is not an authorized admin.`
            });
            return;
          }
          req.adminEmail = verifiedFirebase.email;
          req.adminAuthMethod = "firebase-id-token";
          next();
          return;
        }
      }
      res.status(403).json({
        success: false,
        error: "Forbidden: Invalid or expired admin authentication token."
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: "Admin authorization verification failed."
      });
    }
  };
}

// src/lib/firebaseToMongoMigration.ts
import fs from "fs";
import path from "path";

// src/data/brownies.ts
var MENU_CATEGORY_LABELS = {
  cake_normal: "Cake Menu \u2014 Normal Flavours",
  cake_premium: "Cake Menu \u2014 Premium Flavours",
  brownie: "Brownie",
  assorted_box: "Assorted Brownie Boxes",
  frosted_brownie: "Frosted Brownies",
  bento_cake: "Bento Cakes"
};
var SIGNATURE_BROWNIES = [
  // ==========================================
  // CAKE MENU — 1. NORMAL FLAVOURS (12 ITEMS — ½ KG & 1 KG)
  // ==========================================
  {
    id: "cake-classic-vanilla",
    name: "Classic Vanilla Cake",
    subtitle: "Madagascar Vanilla Bean Sponge & Buttercream",
    description: "Light, pillowy vanilla bean sponge layered with silky whipped Madagascar vanilla cream and delicate white chocolate curls.",
    price: "\u20B9450",
    priceHalfKg: "\u20B9450",
    priceOneKg: "\u20B9800",
    category: "cake_normal",
    image: "https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?q=80&w=900&auto=format&fit=crop",
    badge: "Classic",
    cocoaPercentage: "Normal Flavour",
    flavorNotes: ["Madagascar Vanilla", "Whipped Cream", "Soft Sponge"],
    sortOrder: 1,
    enabled: true
  },
  {
    id: "cake-choco-vanilla",
    name: "Choco Vanilla Cake",
    subtitle: "Dual Chocolate & Vanilla Swirl Layer Cake",
    description: "Alternating layers of rich cocoa sponge and fragrant vanilla sponge finished with marbled chocolate-vanilla frosting.",
    price: "\u20B9500",
    priceHalfKg: "\u20B9500",
    priceOneKg: "\u20B9900",
    category: "cake_normal",
    image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?q=80&w=900&auto=format&fit=crop",
    badge: "Popular",
    cocoaPercentage: "Normal Flavour",
    flavorNotes: ["Belgian Cocoa", "Vanilla Bean", "Marbled Frosting"],
    sortOrder: 2,
    enabled: true
  },
  {
    id: "cake-chocolate-mousse",
    name: "Chocolate Mousse Cake",
    subtitle: "Airy Belgian Chocolate Mousse & Moist Cocoa Sponge",
    description: "Decadent dark cocoa sponge layered with cloud-like whipped Belgian chocolate mousse and a glossy cocoa mirror glaze.",
    price: "\u20B9550",
    priceHalfKg: "\u20B9550",
    priceOneKg: "\u20B91,000",
    category: "cake_normal",
    image: "https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?q=80&w=900&auto=format&fit=crop",
    badge: "Bestseller",
    cocoaPercentage: "Normal Flavour",
    flavorNotes: ["Whipped Chocolate Mousse", "Dark Cocoa Sponge", "Silk Glaze"],
    sortOrder: 3,
    enabled: true
  },
  {
    id: "cake-black-forest",
    name: "Black Forest Cake",
    subtitle: "Classic Cherry Compote, Whipped Cream & Chocolate Shavings",
    description: "Traditional German-style chocolate sponge soaked in cherry syrup, layered with fresh whipped cream, tart cherries, and dark chocolate curls.",
    price: "\u20B9500",
    priceHalfKg: "\u20B9500",
    priceOneKg: "\u20B9900",
    category: "cake_normal",
    image: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?q=80&w=900&auto=format&fit=crop",
    cocoaPercentage: "Normal Flavour",
    flavorNotes: ["Sweet Cherries", "Dark Chocolate Shavings", "Chantilly Cream"],
    sortOrder: 4,
    enabled: true
  },
  {
    id: "cake-white-forest",
    name: "White Forest Cake",
    subtitle: "Ivory White Chocolate Flakes & Cherry Cream Layers",
    description: "Delicate vanilla sponge layered with cherry-kissed whipped cream and generously finished with Belgian white chocolate ribbons.",
    price: "\u20B9500",
    priceHalfKg: "\u20B9500",
    priceOneKg: "\u20B9900",
    category: "cake_normal",
    image: "https://images.unsplash.com/photo-1535141192574-5d4897c12636?q=80&w=900&auto=format&fit=crop",
    cocoaPercentage: "Normal Flavour",
    flavorNotes: ["White Chocolate Curls", "Cherry Compote", "Vanilla Cream"],
    sortOrder: 5,
    enabled: true
  },
  {
    id: "cake-blueberry",
    name: "Blueberry Cake",
    subtitle: "Wild Blueberry Compote & Velvet Cream Cake",
    description: "Moist vanilla sponge filled with house-simmered wild blueberry compote and frosted with silky berry-infused whipped cream.",
    price: "\u20B9500",
    priceHalfKg: "\u20B9500",
    priceOneKg: "\u20B9900",
    category: "cake_normal",
    image: "https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?q=80&w=900&auto=format&fit=crop",
    cocoaPercentage: "Normal Flavour",
    flavorNotes: ["Wild Blueberry Compote", "Berry Cream", "Soft Sponge"],
    sortOrder: 6,
    enabled: true
  },
  {
    id: "cake-blackcurrant",
    name: "Blackcurrant Cake",
    subtitle: "Tangy Blackcurrant Crush & Whipped Cream",
    description: "Vibrant, fruity blackcurrant-layered sponge balanced with smooth dairy cream and jewel-toned blackcurrant glaze.",
    price: "\u20B9500",
    priceHalfKg: "\u20B9500",
    priceOneKg: "\u20B9900",
    category: "cake_normal",
    image: "https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?q=80&w=900&auto=format&fit=crop",
    cocoaPercentage: "Normal Flavour",
    flavorNotes: ["Blackcurrant Reduction", "Fruity Tang", "Fresh Cream"],
    sortOrder: 7,
    enabled: true
  },
  {
    id: "cake-strawberry",
    name: "Strawberry Cake",
    subtitle: "Fresh Strawberry Reduction & Blush Pink Frosting",
    description: "Light sponge cake layered with sweet-tart strawberry preserve and crowned with airy strawberry chantilly cream.",
    price: "\u20B9500",
    priceHalfKg: "\u20B9500",
    priceOneKg: "\u20B9900",
    category: "cake_normal",
    image: "https://images.unsplash.com/photo-1565958011703-44f9829ba187?q=80&w=900&auto=format&fit=crop",
    cocoaPercentage: "Normal Flavour",
    flavorNotes: ["Strawberry Compote", "Blush Cream", "Vanilla Sponge"],
    sortOrder: 8,
    enabled: true
  },
  {
    id: "cake-mango",
    name: "Mango Cake",
    subtitle: "Alphonso Mango Pulp & Tropical Cream Layers",
    description: "Sun-ripened Alphonso mango glaze and luscious mango cream folded between tender golden vanilla sponge layers.",
    price: "\u20B9500",
    priceHalfKg: "\u20B9500",
    priceOneKg: "\u20B9900",
    category: "cake_normal",
    image: "https://images.unsplash.com/photo-1542826438-bd32f43d626f?q=80&w=900&auto=format&fit=crop",
    cocoaPercentage: "Normal Flavour",
    flavorNotes: ["Alphonso Mango", "Tropical Glaze", "Whipped Cream"],
    sortOrder: 9,
    enabled: true
  },
  {
    id: "cake-butterscotch",
    name: "Butterscotch Cake",
    subtitle: "Golden Cashew Praline Crunch & Caramel Cream",
    description: "Classic celebration cake layered with brown-butter caramel cream and generous handfuls of crunchy golden butterscotch praline.",
    price: "\u20B9500",
    priceHalfKg: "\u20B9500",
    priceOneKg: "\u20B9900",
    category: "cake_normal",
    image: "https://images.unsplash.com/photo-1558301211-0d8c8ddee6ec?q=80&w=900&auto=format&fit=crop",
    badge: "Fan Favorite",
    cocoaPercentage: "Normal Flavour",
    flavorNotes: ["Butterscotch Praline", "Caramel Drizzle", "Cashew Crunch"],
    sortOrder: 10,
    enabled: true
  },
  {
    id: "cake-palkova",
    name: "Palkova Cake",
    subtitle: "Traditional Slow-Simmered Milk Palkova Fusion Cake",
    description: "Signature South Indian fusion cake crafted with rich, caramelized milk palkova filling and cardamom-kissed cream layers.",
    price: "\u20B9550",
    priceHalfKg: "\u20B9550",
    priceOneKg: "\u20B91,000",
    category: "cake_normal",
    image: "https://images.unsplash.com/photo-1571115177098-24ec42ed204d?q=80&w=900&auto=format&fit=crop",
    badge: "Chef Special",
    cocoaPercentage: "Normal Flavour",
    flavorNotes: ["Authentic Milk Palkova", "Warm Cardamom", "Rich Milk Cream"],
    sortOrder: 11,
    enabled: true
  },
  {
    id: "cake-rich-caramel",
    name: "Rich Caramel Cake",
    subtitle: "Slow-Cooked Amber Caramel Drip & Toffee Cream",
    description: "Velvety sponge layered with salted amber caramel sauce and silky toffee buttercream, finished with a golden caramel drip.",
    price: "\u20B9550",
    priceHalfKg: "\u20B9550",
    priceOneKg: "\u20B91,000",
    category: "cake_normal",
    image: "https://images.unsplash.com/photo-1519869325930-281384150729?q=80&w=900&auto=format&fit=crop",
    cocoaPercentage: "Normal Flavour",
    flavorNotes: ["Amber Caramel", "Toffee Cream", "Golden Drip"],
    sortOrder: 12,
    enabled: true
  },
  // ==========================================
  // CAKE MENU — 2. PREMIUM FLAVOURS (11 ITEMS — ½ KG & 1 KG)
  // ==========================================
  {
    id: "cake-lotus-biscoff",
    name: "Lotus Biscoff Cake",
    subtitle: "Imported Belgian Speculoos Spread & Crushed Biscoff",
    description: "Indulgent caramel-spiced sponge layered with creamy Lotus Biscoff buttercream, melted speculoos drip, and crisp Biscoff biscuits.",
    price: "\u20B9600",
    priceHalfKg: "\u20B9600",
    priceOneKg: "\u20B91,200",
    category: "cake_premium",
    image: "https://images.unsplash.com/photo-1586788680434-30d324b2d46f?q=80&w=900&auto=format&fit=crop",
    badge: "Bestseller",
    cocoaPercentage: "Premium Flavour",
    flavorNotes: ["Belgian Lotus Biscoff", "Speculoos Drip", "Caramelized Biscuit"],
    sortOrder: 13,
    enabled: true
  },
  {
    id: "cake-choco-tiramisu",
    name: "Choco Tiramisu (Coffee Flavour)",
    subtitle: "Espresso-Soaked Sponge, Mascarpone Cream & Dark Cocoa",
    description: "Italian-inspired chocolate tiramisu cake infused with freshly brewed Arabica espresso, velvety mascarpone cream, and dusted cocoa.",
    price: "\u20B9700",
    priceHalfKg: "\u20B9700",
    priceOneKg: "\u20B91,400",
    category: "cake_premium",
    image: "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?q=80&w=900&auto=format&fit=crop",
    badge: "Coffee Lover",
    cocoaPercentage: "Premium Flavour",
    flavorNotes: ["Arabica Espresso", "Mascarpone Cream", "Belgian Cocoa Dust"],
    sortOrder: 14,
    enabled: true
  },
  {
    id: "cake-choco-truffle",
    name: "Choco Truffle",
    subtitle: "Pure Dark Belgian Chocolate Ganache Truffle Cake",
    description: "Dense, moist dark chocolate sponge enveloped in rich, satin-smooth dark chocolate truffle ganache from top to bottom.",
    price: "\u20B9700",
    priceHalfKg: "\u20B9700",
    priceOneKg: "\u20B91,400",
    category: "cake_premium",
    image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?q=80&w=900&auto=format&fit=crop",
    badge: "Signature",
    cocoaPercentage: "Premium Flavour",
    flavorNotes: ["70% Belgian Ganache", "Rich Chocolate Sponge", "Truffle Glaze"],
    sortOrder: 15,
    enabled: true
  },
  {
    id: "cake-rasmalai",
    name: "Rasmalai Cake",
    subtitle: "Saffron Pistachio Rasmalai Milk & Malai Sponge",
    description: "Royal fusion cake soaked in kesar-elaichi rasmalai milk, layered with soft rasmalai pieces, roasted pistachios, and rose petals.",
    price: "\u20B9650",
    priceHalfKg: "\u20B9650",
    priceOneKg: "\u20B91,200",
    category: "cake_premium",
    image: "https://images.unsplash.com/photo-1535141192574-5d4897c12636?q=80&w=900&auto=format&fit=crop",
    badge: "Royal Fusion",
    cocoaPercentage: "Premium Flavour",
    flavorNotes: ["Kesar Rasmalai", "Roasted Pistachios", "Cardamom Milk"],
    sortOrder: 16,
    enabled: true
  },
  {
    id: "cake-gulab-jamun",
    name: "Gulab Jamun Cake",
    subtitle: "Warm Cardamom Syrup Sponge & Soft Khoya Gulab Jamuns",
    description: "Festive fusion cake infused with fragrant rose-cardamom syrup, layered with khoya cream, and crowned with golden gulab jamuns.",
    price: "\u20B9650",
    priceHalfKg: "\u20B9650",
    priceOneKg: "\u20B91,200",
    category: "cake_premium",
    image: "https://images.unsplash.com/photo-1558301211-0d8c8ddee6ec?q=80&w=900&auto=format&fit=crop",
    badge: "Festive Favorite",
    cocoaPercentage: "Premium Flavour",
    flavorNotes: ["Soft Gulab Jamun", "Rose Cardamom Syrup", "Mawa Cream"],
    sortOrder: 17,
    enabled: true
  },
  {
    id: "cake-rose-milk",
    name: "Rose Milk Cake",
    subtitle: "Fragrant Damask Rose Milk Soak & Pistachio Chantilly",
    description: "Chilled, ultra-moist sponge steeped in aromatic pink rose milk and topped with whipped rose cream, slivered almonds, and dried rosebuds.",
    price: "\u20B9650",
    priceHalfKg: "\u20B9650",
    priceOneKg: "\u20B91,200",
    category: "cake_premium",
    image: "https://images.unsplash.com/photo-1565958011703-44f9829ba187?q=80&w=900&auto=format&fit=crop",
    cocoaPercentage: "Premium Flavour",
    flavorNotes: ["Damask Rose Milk", "Pistachio Slivers", "Velvet Cream"],
    sortOrder: 18,
    enabled: true
  },
  {
    id: "cake-london-viral-caramel",
    name: "London Viral Caramel Cake",
    subtitle: "Trending London-Style Warm Chocolate & Salted Caramel Pour",
    description: "Inspired by London\u2019s viral dessert sensation\u2014ultra-fudgy chocolate sponge layered with silky diplomat cream, molten chocolate ganache, and golden caramel.",
    price: "\u20B9750",
    priceHalfKg: "\u20B9750",
    priceOneKg: "\u20B91,500",
    category: "cake_premium",
    image: "https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?q=80&w=900&auto=format&fit=crop",
    badge: "Viral Trending",
    cocoaPercentage: "Premium Flavour",
    flavorNotes: ["Molten Belgian Ganache", "Salted Amber Caramel", "Diplomat Cream"],
    sortOrder: 19,
    enabled: true
  },
  {
    id: "cake-choco-nutella",
    name: "Choco Nutella Cake",
    subtitle: "Pure Nutella Hazelnut Ganache & Roasted Piemonte Hazelnuts",
    description: "Rich chocolate cake generously layered with creamy Nutella hazelnut frosting, chocolate ganache drip, and toasted hazelnut praline.",
    price: "\u20B9750",
    priceHalfKg: "\u20B9750",
    priceOneKg: "\u20B91,500",
    category: "cake_premium",
    image: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?q=80&w=900&auto=format&fit=crop",
    badge: "Nutella Lover",
    cocoaPercentage: "Premium Flavour",
    flavorNotes: ["Authentic Nutella", "Toasted Hazelnuts", "Chocolate Ganache"],
    sortOrder: 20,
    enabled: true
  },
  {
    id: "cake-ferrero-rocher-overloaded",
    name: "Ferrero Rocher Overloaded",
    subtitle: "Whole Ferrero Rocher Truffles, Hazelnut Crisp & Gold Ganache",
    description: "Our most extravagant celebration cake packed with hazelnut wafer crunch, Nutella ganache layers, and crowned with whole Ferrero Rocher chocolates.",
    price: "\u20B9800",
    priceHalfKg: "\u20B9800",
    priceOneKg: "\u20B91,600",
    category: "cake_premium",
    image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?q=80&w=900&auto=format&fit=crop",
    badge: "Luxury Overloaded",
    cocoaPercentage: "Premium Flavour",
    flavorNotes: ["Ferrero Rocher Truffles", "Hazelnut Wafer Crunch", "Belgian Chocolate"],
    sortOrder: 21,
    enabled: true
  },
  {
    id: "cake-dark-choco-strawberry-compound",
    name: "Dark Choco with Strawberry Compound",
    subtitle: "70% Dark Chocolate Ganache & Velvety Strawberry Compound",
    description: "Bold dark chocolate sponge paired with luscious pink strawberry chocolate compound ganache for an irresistible berry-cocoa harmony.",
    price: "\u20B9750",
    priceHalfKg: "\u20B9750",
    priceOneKg: "\u20B91,500",
    category: "cake_premium",
    image: "https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?q=80&w=900&auto=format&fit=crop",
    badge: "Chef Creation",
    cocoaPercentage: "Premium Flavour",
    flavorNotes: ["Dark Chocolate", "Strawberry Compound", "Berry Ganache"],
    sortOrder: 22,
    enabled: true
  },
  {
    id: "cake-choco-kunafa-pistachio",
    name: "Choco Kunafa Pistachio",
    subtitle: "Dubai-Style Crispy Golden Kataifi & Roasted Pistachio Praline",
    description: "Showstopping chocolate cake layered with crunchy butter-toasted kunafa pastry threads, rich pistachio cream, and silky Belgian milk chocolate.",
    price: "\u20B9750",
    priceHalfKg: "\u20B9750",
    priceOneKg: "\u20B91,500",
    category: "cake_premium",
    image: "https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?q=80&w=900&auto=format&fit=crop",
    badge: "Dubai Viral",
    cocoaPercentage: "Premium Flavour",
    flavorNotes: ["Crispy Golden Kunafa", "Iranian Pistachio Cream", "Belgian Chocolate"],
    sortOrder: 23,
    enabled: true
  },
  // ==========================================
  // SECTION 3: BROWNIE (9 ITEMS — Regular + 1/2 kg & 1 kg)
  // ==========================================
  {
    id: "brownie-classic-fudge",
    name: "KitKat Brownie",
    subtitle: "Crisp Wafer Finger & 70% Valrhona Cocoa",
    description: "Our iconic signature fudgy brownie square baked with crunchy KitKat wafer bars, paper-thin crackly crust, and molten dark chocolate chunks.",
    price: "\u20B9120",
    priceHalfKg: "\u20B9490",
    priceOneKg: "\u20B9950",
    category: "brownie",
    image: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?q=80&w=900&auto=format&fit=crop",
    badge: "Bestseller",
    cocoaPercentage: "72% Dark",
    flavorNotes: ["Crispy KitKat Wafer", "Roasted Cocoa", "Fudgy Center"],
    sortOrder: 24
  },
  {
    id: "brownie-triple-chocolate",
    name: "Triple Chocolate Brownie",
    subtitle: "Dark, Milk & Belgian White Chunks",
    description: "Loaded with three varieties of pure Belgian couverture chocolate folded into an ultra-fudgy cocoa batter.",
    price: "\u20B9140",
    priceHalfKg: "\u20B9550",
    priceOneKg: "\u20B91,050",
    category: "brownie",
    image: "https://images.unsplash.com/photo-1515037893149-de7f840978e2?q=80&w=900&auto=format&fit=crop",
    badge: "Chef Special",
    cocoaPercentage: "70% Blend",
    flavorNotes: ["Dark Chocolate", "Belgian Milk", "White Chocolate Chunks"],
    sortOrder: 2
  },
  {
    id: "brownie-nutella-swirl",
    name: "Nutella Brownie",
    subtitle: "Creamy Hazelnut Cocoa Ribbon",
    description: "Rich roasted hazelnut Nutella swirled generously across our dark chocolate fudge base and topped with toasted hazelnuts.",
    price: "\u20B9140",
    priceHalfKg: "\u20B9580",
    priceOneKg: "\u20B91,100",
    category: "brownie",
    image: "https://images.unsplash.com/photo-1624353365286-3f8d62daad51?q=80&w=900&auto=format&fit=crop",
    badge: "Popular",
    cocoaPercentage: "65% Dark",
    flavorNotes: ["Nutella Swirl", "Roasted Hazelnuts", "Fudgy Crumb"],
    sortOrder: 3
  },
  {
    id: "brownie-walnut-crunch",
    name: "Walnut Brownie",
    subtitle: "Californian Toasted Walnuts",
    description: "Slow-toasted crunchy walnuts folded through deep bittersweet chocolate batter for a classic nutty texture.",
    price: "\u20B9130",
    priceHalfKg: "\u20B9540",
    priceOneKg: "\u20B91,020",
    category: "brownie",
    image: "https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?q=80&w=900&auto=format&fit=crop",
    badge: "Classic",
    cocoaPercentage: "72% Dark",
    flavorNotes: ["Toasted Walnut", "Dark Cocoa", "Cultured Butter"],
    sortOrder: 4
  },
  {
    id: "brownie-salted-caramel",
    name: "Double Chocolate Brownie",
    subtitle: "Intense Dark Ganache & Cocoa Chunks",
    description: "Double-dose dark chocolate batter enriched with melted couverture and bittersweet chocolate chunks finished with flaky sea salt.",
    price: "\u20B9130",
    priceHalfKg: "\u20B9550",
    priceOneKg: "\u20B91,050",
    category: "brownie",
    image: "https://images.unsplash.com/photo-1589218436045-ee320057f443?q=80&w=900&auto=format&fit=crop",
    badge: "Favorite",
    cocoaPercentage: "74% Dark",
    flavorNotes: ["Double Cocoa", "Dark Chunks", "Rich Ganache"],
    sortOrder: 5
  },
  {
    id: "brownie-lotus-biscoff",
    name: "Lotus Biscoff Brownie",
    subtitle: "Caramelized Speculoos Spread & Crunch",
    description: "Swirled with warm spiced Lotus Biscoff spread and crowned with crisp caramelized Biscoff biscuit crumble.",
    price: "\u20B9150",
    priceHalfKg: "\u20B9600",
    priceOneKg: "\u20B91,150",
    category: "brownie",
    image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?q=80&w=900&auto=format&fit=crop",
    badge: "Trending",
    cocoaPercentage: "64% Dark",
    flavorNotes: ["Biscoff Spread", "Cinnamon Biscuit", "Fudge Base"],
    sortOrder: 6
  },
  {
    id: "brownie-oreo-fudge",
    name: "Oreo Cookies & Cream Brownie",
    subtitle: "Crushed Cocoa Sandwich Cookies",
    description: "Packed with chunks of classic cream-filled Oreo cookies baked right into our signature dense chocolate fudge.",
    price: "\u20B9120",
    priceHalfKg: "\u20B9520",
    priceOneKg: "\u20B9990",
    category: "brownie",
    image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=900&auto=format&fit=crop",
    cocoaPercentage: "66% Dark",
    flavorNotes: ["Oreo Crunch", "Sweet Vanilla Cream", "Dark Fudge"],
    sortOrder: 7
  },
  {
    id: "brownie-red-velvet",
    name: "Red Velvet Cream Cheese Brownie",
    subtitle: "Velvety Cocoa & Tangy Cheesecake Swirl",
    description: "Marbled layers of rich crimson cocoa brownie and silky Madagascar vanilla bean cream cheese.",
    price: "\u20B9135",
    priceHalfKg: "\u20B9560",
    priceOneKg: "\u20B91,080",
    category: "brownie",
    image: "https://images.unsplash.com/photo-1579372786545-d24232daf58c?q=80&w=900&auto=format&fit=crop",
    badge: "Artisan",
    cocoaPercentage: "60% Cocoa",
    flavorNotes: ["Cream Cheese Swirl", "Red Velvet", "Vanilla Bean"],
    sortOrder: 8
  },
  {
    id: "brownie-almond-praline",
    name: "Roasted Almond Fudge Brownie",
    subtitle: "Caramelized California Almonds",
    description: "Crunchy golden roasted almonds and dark chocolate chips baked into a rich, crinkle-top artisan brownie slab.",
    price: "\u20B9130",
    priceHalfKg: "\u20B9540",
    priceOneKg: "\u20B91,020",
    category: "brownie",
    image: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?q=80&w=900&auto=format&fit=crop",
    cocoaPercentage: "70% Dark",
    flavorNotes: ["Roasted Almond", "Dark Chunks", "Crackly Top"],
    sortOrder: 9
  },
  // ==========================================
  // SECTION 2: ASSORTED BROWNIE BOXES (2 ITEMS — NO KG PRICING)
  // ==========================================
  {
    id: "assorted-box-6",
    name: "Assorted Brownie Box (Box of 6)",
    subtitle: "6 Handcrafted Signature Flavors",
    description: "A curated tasting box featuring 6 of our bestselling brownies: KitKat, Nutella, Lotus Biscoff, Walnut, Triple Chocolate, and Double Chocolate.",
    price: "\u20B9650",
    category: "assorted_box",
    image: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?q=80&w=900&auto=format&fit=crop",
    badge: "Gift Box",
    cocoaPercentage: "6 Pieces Box",
    flavorNotes: ["6 Signature Pieces", "Luxury Gift Packaging", "Custom Note Included"],
    sortOrder: 10
  },
  {
    id: "assorted-box-12",
    name: "Grand Assorted Brownie Box (Box of 12)",
    subtitle: "12 Gourmet Artisan Squares",
    description: "Our celebration assortment box of 12 decadent brownie squares across all classic, nut, and swirled flavors\u2014ideal for gifting and parties.",
    price: "\u20B91,200",
    category: "assorted_box",
    image: "https://images.unsplash.com/photo-1515037893149-de7f840978e2?q=80&w=900&auto=format&fit=crop",
    badge: "Party Box",
    cocoaPercentage: "12 Pieces Box",
    flavorNotes: ["12 Gourmet Pieces", "Celebration Box", "Freshly Baked"],
    sortOrder: 11
  },
  // ==========================================
  // SECTION 3: FROSTED BROWNIES (6 ITEMS — NO KG PRICING)
  // ==========================================
  {
    id: "frosted-belgian-ganache",
    name: "Chocolate Frosted Brownie",
    subtitle: "Whipped 70% Belgian Couverture Ganache",
    description: "Fudgy dark brownie crowned with a thick, glossy layer of whipped Belgian dark chocolate ganache and chocolate curls.",
    price: "\u20B9150",
    category: "frosted_brownie",
    image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?q=80&w=900&auto=format&fit=crop",
    badge: "Top Seller",
    cocoaPercentage: "Frosted Creation",
    flavorNotes: ["Silk Chocolate Ganache", "Belgian Dark", "Fudge Base"],
    sortOrder: 12
  },
  {
    id: "frosted-ferrero-rocher",
    name: "Ferrero Rocher Frosted Brownie",
    subtitle: "Hazelnut Praline & Ferrero Crown",
    description: "Topped with velvety hazelnut chocolate frosting, toasted hazelnut nibs, and authentic Ferrero Rocher halves.",
    price: "\u20B9180",
    category: "frosted_brownie",
    image: "https://images.unsplash.com/photo-1624353365286-3f8d62daad51?q=80&w=900&auto=format&fit=crop",
    badge: "Luxury",
    cocoaPercentage: "Frosted Creation",
    flavorNotes: ["Ferrero Rocher", "Hazelnut Frosting", "Crisp Wafer"],
    sortOrder: 13
  },
  {
    id: "frosted-lotus-biscoff",
    name: "Lotus Biscoff Cream Frosted Brownie",
    subtitle: "Whipped Biscoff Buttercream & Drip",
    description: "Layered with silky Biscoff cookie butter frosting, melted speculoos drizzle, and whole Lotus Biscoff biscuits.",
    price: "\u20B9170",
    category: "frosted_brownie",
    image: "https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?q=80&w=900&auto=format&fit=crop",
    cocoaPercentage: "Frosted Creation",
    flavorNotes: ["Biscoff Frosting", "Speculoos Drip", "Caramelized Crumb"],
    sortOrder: 14
  },
  {
    id: "frosted-cream-cheese",
    name: "Velvet Cream Cheese Frosted Brownie",
    subtitle: "Madagascar Vanilla Cream Cheese Frosting",
    description: "Decadent cocoa brownie topped with clouds of tangy-sweet whipped cream cheese frosting and cocoa dusting.",
    price: "\u20B9160",
    category: "frosted_brownie",
    image: "https://images.unsplash.com/photo-1579372786545-d24232daf58c?q=80&w=900&auto=format&fit=crop",
    cocoaPercentage: "Frosted Creation",
    flavorNotes: ["Whipped Cream Cheese", "Vanilla Bean", "Soft Fudge"],
    sortOrder: 15
  },
  {
    id: "frosted-salted-caramel",
    name: "Salted Caramel Buttercream Frosted Brownie",
    subtitle: "Caramel Frosting & Gold Drizzle",
    description: "Frosted with airy salted caramel buttercream, drizzled with warm amber caramel and a pinch of flaky sea salt.",
    price: "\u20B9160",
    category: "frosted_brownie",
    image: "https://images.unsplash.com/photo-1589218436045-ee320057f443?q=80&w=900&auto=format&fit=crop",
    cocoaPercentage: "Frosted Creation",
    flavorNotes: ["Caramel Buttercream", "Amber Drizzle", "Sea Salt"],
    sortOrder: 16
  },
  {
    id: "frosted-pistachio-kunafa",
    name: "Dubai Pistachio Kunafa Frosted Brownie",
    subtitle: "Crispy Kataifi & Sicilian Pistachio Cream",
    description: "Our viral sensation: dark fudge brownie topped with crunchy butter-toasted kunafa pistachio cream and milk chocolate ganache.",
    price: "\u20B9200",
    category: "frosted_brownie",
    image: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?q=80&w=900&auto=format&fit=crop",
    badge: "Viral Special",
    cocoaPercentage: "Frosted Creation",
    flavorNotes: ["Pistachio Cream", "Crispy Kunafa", "Belgian Ganache"],
    sortOrder: 17
  },
  // ==========================================
  // SECTION 4: BENTO CAKES (14 ITEMS — PRICE PER KG)
  // ==========================================
  {
    id: "bento-chocolate-truffle",
    name: "Chocolate Truffle",
    subtitle: "Rich Belgian Chocolate Ganache Cake",
    description: "Moist dark chocolate sponge layered with silky smooth chocolate truffle ganache. Price shown per kg.",
    price: "\u20B9550",
    priceHalfKg: "\u20B9350",
    priceOneKg: "\u20B9550",
    category: "bento_cake",
    image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?q=80&w=900&auto=format&fit=crop",
    badge: "Top Seller",
    cocoaPercentage: "Per Kg",
    flavorNotes: ["Belgian Truffle", "Moist Sponge", "Custom Message"],
    sortOrder: 18
  },
  {
    id: "bento-gulab-jamun",
    name: "Gulab Jamun Cake",
    subtitle: "Cardamom Milk Sponge & Warm Jamuns",
    description: "Fusion celebration cake infused with saffron-cardamom rabri frosting and soft syrupy gulab jamun pieces.",
    price: "\u20B91,200",
    priceHalfKg: "\u20B9650",
    priceOneKg: "\u20B91,200",
    category: "bento_cake",
    image: "https://images.unsplash.com/photo-1535141192574-5d4897c12636?q=80&w=900&auto=format&fit=crop",
    badge: "Fusion Hit",
    cocoaPercentage: "Per Kg",
    flavorNotes: ["Gulab Jamun", "Cardamom Cream", "Pistachio Crumb"],
    sortOrder: 19
  },
  {
    id: "bento-classic-butterscotch",
    name: "Classic Butterscotch",
    subtitle: "Caramel Praline Crunch & Cream",
    description: "Light vanilla sponge layered with golden butterscotch sauce, whipped cream, and crunchy cashew praline.",
    price: "\u20B9490",
    priceHalfKg: "\u20B9280",
    priceOneKg: "\u20B9490",
    category: "bento_cake",
    image: "https://images.unsplash.com/photo-1542826438-bd32f43d626f?q=80&w=900&auto=format&fit=crop",
    cocoaPercentage: "Per Kg",
    flavorNotes: ["Butterscotch Praline", "Caramel Drizzle", "Soft Vanilla"],
    sortOrder: 20
  },
  {
    id: "bento-rose-rasagulla",
    name: "Rose Rasagulla Cake",
    subtitle: "Persian Rose Cream & Juicy Rasagulla",
    description: "Fragrant rose-infused sponge layered with delicate malai cream, edible rose petals, and soft rasagullas.",
    price: "\u20B91,200",
    priceHalfKg: "\u20B9650",
    priceOneKg: "\u20B91,200",
    category: "bento_cake",
    image: "https://images.unsplash.com/photo-1565958011703-44f9829ba187?q=80&w=900&auto=format&fit=crop",
    badge: "Chef Special",
    cocoaPercentage: "Per Kg",
    flavorNotes: ["Rose Malai", "Soft Rasagulla", "Dried Rose Petals"],
    sortOrder: 21
  },
  {
    id: "bento-red-velvet",
    name: "Red Velvet Cream Cheese Cake",
    subtitle: "Classic Crimson Velvet & Mascarpone",
    description: "Feather-light red velvet sponge paired with smooth cream cheese frosting and red velvet crumbs.",
    price: "\u20B9850",
    priceHalfKg: "\u20B9450",
    priceOneKg: "\u20B9850",
    category: "bento_cake",
    image: "https://images.unsplash.com/photo-1616541823729-00fe0aacd32c?q=80&w=900&auto=format&fit=crop",
    cocoaPercentage: "Per Kg",
    flavorNotes: ["Cream Cheese", "Velvet Crumb", "Madagascar Vanilla"],
    sortOrder: 22
  },
  {
    id: "bento-rasmalai-pistachio",
    name: "Royal Rasmalai Cake",
    subtitle: "Saffron Rabri & Pistachio Flakes",
    description: "Soaked in authentic kesar badam rasmalai milk and frosted with saffron whipped cream and roasted pistachios.",
    price: "\u20B91,150",
    priceHalfKg: "\u20B9620",
    priceOneKg: "\u20B91,150",
    category: "bento_cake",
    image: "https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?q=80&w=900&auto=format&fit=crop",
    badge: "Festive",
    cocoaPercentage: "Per Kg",
    flavorNotes: ["Kesar Rasmalai", "Saffron Cream", "Roasted Pistachio"],
    sortOrder: 23
  },
  {
    id: "bento-belgian-nutella",
    name: "Nutella Ferrero Cake",
    subtitle: "Hazelnut Chocolate Ganache & Crunch",
    description: "Decadent chocolate hazelnut sponge layered with pure Nutella cream and toasted hazelnut praline crunch.",
    price: "\u20B91,100",
    priceHalfKg: "\u20B9600",
    priceOneKg: "\u20B91,100",
    category: "bento_cake",
    image: "https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?q=80&w=900&auto=format&fit=crop",
    cocoaPercentage: "Per Kg",
    flavorNotes: ["Pure Nutella", "Hazelnut Crunch", "Dark Sponge"],
    sortOrder: 24
  },
  {
    id: "bento-lotus-biscoff-cake",
    name: "Lotus Biscoff Cheesecake Cake",
    subtitle: "Caramelized Speculoos & Vanilla Cream",
    description: "Layered with spiced Lotus Biscoff spread, whipped mascarpone cream, and crunchy Biscoff biscuit crumble.",
    price: "\u20B91,050",
    priceHalfKg: "\u20B9580",
    priceOneKg: "\u20B91,050",
    category: "bento_cake",
    image: "https://images.unsplash.com/photo-1571115177098-24ec42ed204d?q=80&w=900&auto=format&fit=crop",
    cocoaPercentage: "Per Kg",
    flavorNotes: ["Lotus Biscoff", "Speculoos Cream", "Crunchy Topping"],
    sortOrder: 25
  },
  {
    id: "bento-blueberry-compote",
    name: "Wild Blueberry Cream Cake",
    subtitle: "House-Made Berry Compote & Vanilla",
    description: "Soft vanilla bean sponge filled with tangy wild blueberry compote and silky pastel buttercream.",
    price: "\u20B9800",
    priceHalfKg: "\u20B9440",
    priceOneKg: "\u20B9800",
    category: "bento_cake",
    image: "https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?q=80&w=900&auto=format&fit=crop",
    cocoaPercentage: "Per Kg",
    flavorNotes: ["Wild Blueberry", "Vanilla Bean", "Fresh Compote"],
    sortOrder: 26
  },
  {
    id: "bento-strawberry-shortcake",
    name: "Fresh Strawberry Cream Cake",
    subtitle: "Sweet Berry Coulis & Chantilly Cream",
    description: "Light sponge layered with strawberry preserve and fluffy Chantilly cream in charming Korean bento styling.",
    price: "\u20B9780",
    priceHalfKg: "\u20B9420",
    priceOneKg: "\u20B9780",
    category: "bento_cake",
    image: "https://images.unsplash.com/photo-1565958011703-44f9829ba187?q=80&w=900&auto=format&fit=crop",
    cocoaPercentage: "Per Kg",
    flavorNotes: ["Strawberry Coulis", "Chantilly Cream", "Pastel Piping"],
    sortOrder: 27
  },
  {
    id: "bento-black-forest",
    name: "Artisan Black Forest Cake",
    subtitle: "Dark Chocolate Shavings & Morello Cherry",
    description: "Classic German-inspired chocolate sponge with sweet cherry filling, whipped cream, and dark chocolate flakes.",
    price: "\u20B9650",
    priceHalfKg: "\u20B9360",
    priceOneKg: "\u20B9650",
    category: "bento_cake",
    image: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?q=80&w=900&auto=format&fit=crop",
    cocoaPercentage: "Per Kg",
    flavorNotes: ["Morello Cherry", "Chocolate Flakes", "Whipped Cream"],
    sortOrder: 28
  },
  {
    id: "bento-white-forest",
    name: "Belgian White Forest Cake",
    subtitle: "White Couverture Flakes & Cherry",
    description: "Fluffy vanilla sponge layered with cherry compote, sweet cream, and delicate Belgian white chocolate curls.",
    price: "\u20B9700",
    priceHalfKg: "\u20B9390",
    priceOneKg: "\u20B9700",
    category: "bento_cake",
    image: "https://images.unsplash.com/photo-1535141192574-5d4897c12636?q=80&w=900&auto=format&fit=crop",
    cocoaPercentage: "Per Kg",
    flavorNotes: ["White Chocolate", "Sweet Cherry", "Vanilla Sponge"],
    sortOrder: 29
  },
  {
    id: "bento-pineapple-delight",
    name: "Tropical Pineapple Cream Cake",
    subtitle: "Caramelized Pineapple & Fresh Cream",
    description: "Refreshing golden pineapple chunks compote folded into light whipped cream between soft vanilla layers.",
    price: "\u20B9520",
    priceHalfKg: "\u20B9300",
    priceOneKg: "\u20B9520",
    category: "bento_cake",
    image: "https://images.unsplash.com/photo-1542826438-bd32f43d626f?q=80&w=900&auto=format&fit=crop",
    cocoaPercentage: "Per Kg",
    flavorNotes: ["Fresh Pineapple", "Light Cream", "Soft Sponge"],
    sortOrder: 30
  },
  {
    id: "bento-mocha-espresso",
    name: "Salted Caramel Mocha Cake",
    subtitle: "Arabica Espresso & Caramel Ganache",
    description: "Coffee-soaked chocolate sponge layered with espresso buttercream and homemade salted caramel drizzle.",
    price: "\u20B9890",
    priceHalfKg: "\u20B9480",
    priceOneKg: "\u20B9890",
    category: "bento_cake",
    image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?q=80&w=900&auto=format&fit=crop",
    cocoaPercentage: "Per Kg",
    flavorNotes: ["Roasted Espresso", "Salted Caramel", "Dark Ganache"],
    sortOrder: 31
  }
];
var BAKING_CLASSES = [
  {
    id: "brownie-mastery",
    title: "The Ultimate Fudgy Brownie Masterclass",
    level: "Beginner to Intermediate",
    duration: "3.5 Hours",
    price: "\u20B91,999 / person",
    description: "Master the delicate chemistry of melted chocolate emulsion, achieving the legendary shiny crackle crust, and dialing in fudge vs cake textures.",
    dates: ["Saturday, Oct 25 @ 10:00 AM", "Sunday, Nov 2 @ 2:00 PM", "Saturday, Nov 8 @ 10:00 AM"],
    format: "Online"
  },
  {
    id: "artisan-caramels-swirls",
    title: "Artisan Caramels & Gourmet Swirled Brownies",
    level: "All Levels Welcome",
    duration: "3 Hours",
    price: "\u20B92,499 / person",
    description: "Craft handcrafted salted butter caramel from scratch, infuse ganaches, and bake restaurant-quality swirled brownie slabs to take home.",
    dates: ["Friday, Oct 31 @ 6:00 PM", "Sunday, Nov 9 @ 1:00 PM", "Saturday, Nov 15 @ 10:00 AM"],
    format: "Offline"
  },
  {
    id: "teen-baking-camp",
    title: "Weekend Cocoa Explorer Baking Lab",
    level: "Beginner Friendly (Ages 12+)",
    duration: "2.5 Hours",
    price: "\u20B91,499 / person",
    description: "A fun, welcoming hands-on workshop learning the essentials of mixing, baking temperatures, and chocolate garnishes with our head baker.",
    dates: ["Saturday, Nov 1 @ 11:00 AM", "Saturday, Nov 22 @ 11:00 AM"],
    format: "Online & Offline"
  }
];

// src/lib/firebaseToMongoMigration.ts
var OFFICIAL_INSTAGRAM_URL = "https://www.instagram.com/browine_girl_?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==";
var CANONICAL_DEFAULT_SETTINGS = {
  phone: "(555) 392-CAKE",
  phoneRaw: "+15553922253",
  whatsappNumber: "7339651529",
  email: "preethipreethu712@gmail.com",
  instagramId: OFFICIAL_INSTAGRAM_URL,
  onlineClassTime: "",
  aboutImage: "https://images.unsplash.com/photo-1556911073-38141963c9e0?q=85&w=1600&auto=format&fit=crop",
  heroSlide1Image: "https://images.unsplash.com/photo-1556911073-38141963c9e0?q=85&w=2400&auto=format&fit=crop",
  heroSlide2Image: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?q=85&w=2400&auto=format&fit=crop",
  heroSlide3Image: "https://images.unsplash.com/photo-1581299894007-aaa50297cf16?q=85&w=2400&auto=format&fit=crop"
};
var CANONICAL_DEFAULT_ACHIEVEMENTS = {
  stat1Value: "50,000+",
  stat1Label: "Artisan Brownies Baked",
  stat1Desc: "Handcrafted in small batches with 100% pure cocoa butter chocolate.",
  stat2Value: "1,200+",
  stat2Label: "Baking Class Graduates",
  stat2Desc: "Students who mastered fudgy centers and crackly crusts in our studio.",
  stat3Value: "4.9 / 5.0",
  stat3Label: "Average Customer Rating",
  stat3Desc: "From over 3,500+ verified dessert lovers and pastry enthusiasts.",
  stat4Value: "2025 Winner",
  stat4Label: "Best Artisan Bakery",
  stat4Desc: "Awarded by the National Pastry & Confectionery Guild for recipe excellence.",
  award1Title: "Golden Whisk Pastry Award",
  award1Org: "Artisan Bakery Association 2025",
  award1Note: "Voted #1 Handcrafted Brownie in the Country",
  award2Title: "Certified Fair-Trade Partner",
  award2Org: "Valrhona & Belgian Cocoa Alliance",
  award2Note: "100% Sustainable Single-Origin Cocoa Sourcing",
  award3Title: "Culinary Masterclass Excellence",
  award3Org: "Metropolitan Cooking Guild",
  award3Note: "Top Rated Hands-On Baking Workshop"
};
var CANONICAL_DEFAULT_ADMIN_LIST = [
  {
    email: "preethipreethu712@gmail.com",
    name: "Official Bakery Admin",
    role: "owner",
    addedAt: "2025-01-01T00:00:00.000Z",
    addedBy: "System / Master",
    isPrimary: true
  },
  {
    email: "vigneshsivan2001@gmail.com",
    name: "Vignesh Sivan (Founder)",
    role: "owner",
    addedAt: "2025-01-01T00:00:00.000Z",
    addedBy: "System / Master",
    isPrimary: true
  }
];
var CANONICAL_PRIMARY_USERS = [
  {
    uid: "owner_vignesh_sivan",
    email: "vigneshsivan2001@gmail.com",
    displayName: "Vignesh Sivan (Founder)",
    role: "admin",
    favorites: ["classic-fudge-brownie", "nutella-overload-brownie"],
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    uid: "owner_preethi_admin",
    email: "preethipreethu712@gmail.com",
    displayName: "Official Bakery Admin",
    role: "admin",
    favorites: ["lotus-biscoff-brownie", "triple-chocolate-brownie"],
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  }
];
function parseFirestoreRestValue(valObj) {
  if (!valObj || typeof valObj !== "object") return valObj;
  if ("stringValue" in valObj) return valObj.stringValue;
  if ("integerValue" in valObj) return Number(valObj.integerValue);
  if ("doubleValue" in valObj) return Number(valObj.doubleValue);
  if ("booleanValue" in valObj) return Boolean(valObj.booleanValue);
  if ("nullValue" in valObj) return null;
  if ("timestampValue" in valObj) return valObj.timestampValue;
  if ("arrayValue" in valObj) {
    const values = valObj.arrayValue?.values;
    return Array.isArray(values) ? values.map(parseFirestoreRestValue) : [];
  }
  if ("mapValue" in valObj) {
    const fields = valObj.mapValue?.fields || {};
    const out = {};
    for (const [k, v] of Object.entries(fields)) {
      out[k] = parseFirestoreRestValue(v);
    }
    return out;
  }
  return valObj;
}
async function fetchFirestoreCollectionReadOnly(projectId, databaseId, collectionName) {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      projectId
    )}/databases/${encodeURIComponent(databaseId)}/documents/${encodeURIComponent(
      collectionName
    )}?pageSize=200`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(url, { method: "GET", signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      return { status: "quota_or_unavailable", documents: [] };
    }
    const data = await res.json();
    const rawDocs = Array.isArray(data?.documents) ? data.documents : [];
    const parsedDocs = rawDocs.map((docItem) => {
      const fullPath = docItem.name || "";
      const docId = fullPath.split("/").pop() || "";
      const fields = docItem.fields || {};
      const parsed = { id: docId };
      for (const [k, v] of Object.entries(fields)) {
        parsed[k] = parseFirestoreRestValue(v);
      }
      return parsed;
    });
    return { status: "fetched", documents: parsedDocs };
  } catch {
    return { status: "quota_or_unavailable", documents: [] };
  }
}
async function runFirebaseToMongoMigration(options) {
  const { dataDir, projectId, databaseId, localDbState } = options;
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const firestoreCollectionsToProbe = [
    "menu_items",
    "custom_items",
    "baking_classes",
    "settings",
    "users",
    "orders",
    "inquiries",
    "class_registrations"
  ];
  const firestoreSnapshots = {};
  const firestoreProbeStatus = {};
  for (const colName of firestoreCollectionsToProbe) {
    const result = await fetchFirestoreCollectionReadOnly(projectId, databaseId, colName);
    firestoreSnapshots[colName] = result.documents;
    firestoreProbeStatus[colName] = `${result.status} (${result.documents.length} docs)`;
  }
  const productMap = /* @__PURE__ */ new Map();
  SIGNATURE_BROWNIES.forEach((item, index) => {
    productMap.set(item.id, {
      ...item,
      category: item.category || "brownie",
      sortOrder: item.sortOrder ?? index + 1,
      enabled: item.enabled !== false,
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: nowIso
    });
  });
  if (Array.isArray(localDbState.products)) {
    for (const p of localDbState.products) {
      if (p && p.id) {
        productMap.set(p.id, {
          ...productMap.get(p.id) || {},
          ...p,
          updatedAt: p.updatedAt || nowIso
        });
      }
    }
  }
  for (const fsProd of firestoreSnapshots["menu_items"] || []) {
    if (fsProd && fsProd.id) {
      productMap.set(fsProd.id, {
        ...productMap.get(fsProd.id) || {},
        ...fsProd,
        updatedAt: fsProd.updatedAt || nowIso
      });
    }
  }
  for (const fsCustom of firestoreSnapshots["custom_items"] || []) {
    if (fsCustom && fsCustom.id) {
      productMap.set(fsCustom.id, {
        ...productMap.get(fsCustom.id) || {},
        ...fsCustom,
        updatedAt: fsCustom.updatedAt || nowIso
      });
    }
  }
  const categoryMap = /* @__PURE__ */ new Map();
  const menuCategoriesEntries = Object.entries(MENU_CATEGORY_LABELS);
  menuCategoriesEntries.forEach(([slug, label], idx) => {
    const catId = `category-${slug}`;
    categoryMap.set(catId, {
      id: catId,
      type: "menu_category",
      slug,
      title: label,
      hasWeightOptions: slug !== "assorted_box" && slug !== "frosted_brownie",
      sortOrder: idx + 1,
      enabled: true,
      updatedAt: nowIso
    });
  });
  BAKING_CLASSES.forEach((cls, idx) => {
    categoryMap.set(cls.id, {
      id: cls.id,
      type: "baking_class",
      title: cls.title,
      level: cls.level,
      duration: cls.duration,
      price: cls.price,
      description: cls.description.replace(/\r\n?/g, "\n"),
      dates: Array.isArray(cls.dates) ? cls.dates : [],
      format: cls.format || "Online",
      sortOrder: 100 + idx,
      enabled: true,
      updatedAt: nowIso
    });
  });
  if (Array.isArray(localDbState.categories)) {
    for (const c of localDbState.categories) {
      if (c && c.id) {
        categoryMap.set(c.id, {
          ...categoryMap.get(c.id) || {},
          ...c
        });
      }
    }
  }
  for (const fsCls of firestoreSnapshots["baking_classes"] || []) {
    if (fsCls && fsCls.id) {
      categoryMap.set(fsCls.id, {
        ...categoryMap.get(fsCls.id) || {},
        id: fsCls.id,
        type: "baking_class",
        title: fsCls.title,
        level: fsCls.level,
        duration: fsCls.duration,
        price: fsCls.price,
        description: typeof fsCls.description === "string" ? fsCls.description.replace(/\r\n?/g, "\n") : "",
        dates: Array.isArray(fsCls.dates) ? fsCls.dates : [],
        format: fsCls.format || "Online",
        enabled: true,
        updatedAt: nowIso
      });
    }
  }
  const existingAdminsDoc = localDbState.websiteSettings?.admins || {};
  let passwordHash = existingAdminsDoc.adminPasswordHash;
  let passwordSalt = existingAdminsDoc.adminPasswordSalt;
  if (!passwordHash || !passwordSalt) {
    const generated = hashAdminPassword("admin123");
    passwordHash = generated.hash;
    passwordSalt = generated.salt;
  }
  const generalSettingDoc = sanitizeWebsiteSettingForStorage("general", {
    ...CANONICAL_DEFAULT_SETTINGS,
    ...localDbState.websiteSettings?.general || {},
    updatedAt: nowIso
  });
  const achievementsSettingDoc = sanitizeWebsiteSettingForStorage("achievements", {
    ...CANONICAL_DEFAULT_ACHIEVEMENTS,
    ...localDbState.websiteSettings?.achievements || {},
    updatedAt: nowIso
  });
  const adminsSettingDoc = sanitizeWebsiteSettingForStorage("admins", {
    adminEmails: Array.from(
      /* @__PURE__ */ new Set([
        ...PRIMARY_AUTHORIZED_ADMIN_EMAILS,
        ...Array.isArray(existingAdminsDoc.adminEmails) ? existingAdminsDoc.adminEmails : []
      ])
    ),
    adminList: Array.isArray(existingAdminsDoc.adminList) && existingAdminsDoc.adminList.length > 0 ? existingAdminsDoc.adminList.map(({ customPassword: _cp, ...rest }) => rest) : CANONICAL_DEFAULT_ADMIN_LIST,
    adminPasswordHash: passwordHash,
    adminPasswordSalt: passwordSalt,
    updatedAt: nowIso
  });
  const userMap = /* @__PURE__ */ new Map();
  for (const u of CANONICAL_PRIMARY_USERS) {
    userMap.set(u.uid, u);
  }
  for (const fsUser of firestoreSnapshots["users"] || []) {
    const uid = fsUser.uid || fsUser.id;
    if (uid && fsUser.email) {
      userMap.set(uid, {
        uid,
        email: String(fsUser.email).toLowerCase(),
        displayName: fsUser.displayName || String(fsUser.email).split("@")[0],
        role: fsUser.role === "admin" ? "admin" : "customer",
        favorites: Array.isArray(fsUser.favorites) ? fsUser.favorites : Array.isArray(fsUser.favoriteBrownies) ? fsUser.favoriteBrownies : [],
        createdAt: fsUser.createdAt || nowIso,
        updatedAt: nowIso
      });
    }
  }
  const orderMap = /* @__PURE__ */ new Map();
  for (const o of localDbState.orders || []) {
    if (o && (o.orderId || o.id)) {
      const oid = o.orderId || o.id;
      orderMap.set(oid, { ...o, id: oid, orderId: oid });
    }
  }
  for (const fsOrder of firestoreSnapshots["orders"] || []) {
    if (fsOrder && (fsOrder.orderId || fsOrder.id)) {
      const oid = fsOrder.orderId || fsOrder.id;
      orderMap.set(oid, {
        ...orderMap.get(oid) || {},
        ...fsOrder,
        id: oid,
        orderId: oid
      });
    }
  }
  const bookingMap = /* @__PURE__ */ new Map();
  for (const inq of localDbState.inquiries || []) {
    if (inq && inq.id) {
      bookingMap.set(inq.id, {
        ...inq,
        bookingId: inq.bookingId || inq.id,
        updatedAt: inq.updatedAt || inq.createdAt || nowIso
      });
    }
  }
  for (const fsInq of firestoreSnapshots["inquiries"] || []) {
    if (fsInq && fsInq.id) {
      bookingMap.set(fsInq.id, {
        ...bookingMap.get(fsInq.id) || {},
        ...fsInq,
        id: fsInq.id,
        bookingId: fsInq.bookingId || fsInq.id,
        updatedAt: fsInq.updatedAt || fsInq.createdAt || nowIso
      });
    }
  }
  const registrationMap = /* @__PURE__ */ new Map();
  for (const reg of localDbState.registrations || []) {
    if (reg && reg.id) {
      registrationMap.set(reg.id, {
        ...reg,
        registrationId: reg.registrationId || reg.id,
        updatedAt: reg.updatedAt || reg.createdAt || nowIso
      });
    }
  }
  for (const fsReg of firestoreSnapshots["class_registrations"] || []) {
    if (fsReg && fsReg.id) {
      registrationMap.set(fsReg.id, {
        ...registrationMap.get(fsReg.id) || {},
        ...fsReg,
        id: fsReg.id,
        registrationId: fsReg.registrationId || fsReg.id,
        updatedAt: fsReg.updatedAt || fsReg.createdAt || nowIso
      });
    }
  }
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const backupFilePath = path.join(dataDir, "firestore_backup.json");
  const backupPayload = {
    backupMetadata: {
      createdAt: nowIso,
      firebaseProjectId: projectId,
      firestoreDatabaseId: databaseId,
      nonDestructiveBackup: true,
      firebaseDataDeletedOrModified: false,
      firestoreRestProbeStatus: firestoreProbeStatus
    },
    collections: {
      products: Array.from(productMap.values()),
      categories: Array.from(categoryMap.values()),
      website_settings: {
        general: generalSettingDoc,
        achievements: achievementsSettingDoc,
        admins: {
          ...adminsSettingDoc,
          adminPasswordHash: "[REDACTED_IN_EXPORT]",
          adminPasswordSalt: "[REDACTED_IN_EXPORT]"
        }
      },
      users: Array.from(userMap.values()),
      orders: Array.from(orderMap.values()),
      bookings: Array.from(bookingMap.values()),
      class_registrations: Array.from(registrationMap.values())
    },
    rawFirestoreRestSnapshots: firestoreSnapshots
  };
  const backupJsonString = JSON.stringify(backupPayload, null, 2);
  fs.writeFileSync(backupFilePath, backupJsonString, "utf-8");
  const backupStats = fs.statSync(backupFilePath);
  const mongoDb = await getMongoDatabase();
  if (!mongoDb) {
    throw new Error("MongoDB Atlas connection is not available. Migration aborted safely after backup.");
  }
  await ensureMongoIndexes(mongoDb);
  const productsToMigrate = Array.from(productMap.values());
  for (const prod of productsToMigrate) {
    await mongoDb.collection(MONGO_COLLECTIONS.PRODUCTS).updateOne({ id: prod.id }, { $set: prod }, { upsert: true });
  }
  const categoriesToMigrate = Array.from(categoryMap.values());
  for (const cat of categoriesToMigrate) {
    await mongoDb.collection(MONGO_COLLECTIONS.CATEGORIES).updateOne({ id: cat.id }, { $set: cat }, { upsert: true });
  }
  const settingsToMigrate = [
    generalSettingDoc,
    achievementsSettingDoc,
    adminsSettingDoc
  ];
  for (const settingDoc of settingsToMigrate) {
    await mongoDb.collection(MONGO_COLLECTIONS.WEBSITE_SETTINGS).updateOne({ settingKey: settingDoc.settingKey }, { $set: settingDoc }, { upsert: true });
  }
  const existingSeqDoc = await mongoDb.collection(MONGO_COLLECTIONS.WEBSITE_SETTINGS).findOne({ settingKey: "counters" });
  const highestLocalSeq = typeof localDbState.lastOrderSequence === "number" ? localDbState.lastOrderSequence : 1024;
  if (!existingSeqDoc || typeof existingSeqDoc.lastOrderSequence !== "number") {
    await mongoDb.collection(MONGO_COLLECTIONS.WEBSITE_SETTINGS).updateOne(
      { settingKey: "counters" },
      {
        $set: {
          settingKey: "counters",
          lastOrderSequence: highestLocalSeq,
          updatedAt: nowIso
        }
      },
      { upsert: true }
    );
  }
  const usersToMigrate = Array.from(userMap.values());
  for (const usr of usersToMigrate) {
    await mongoDb.collection(MONGO_COLLECTIONS.USERS).updateOne({ uid: usr.uid }, { $set: usr }, { upsert: true });
  }
  const ordersToMigrate = Array.from(orderMap.values());
  for (const ord of ordersToMigrate) {
    await mongoDb.collection(MONGO_COLLECTIONS.ORDERS).updateOne({ orderId: ord.orderId }, { $set: ord }, { upsert: true });
  }
  const bookingsToMigrate = Array.from(bookingMap.values());
  for (const bkg of bookingsToMigrate) {
    await mongoDb.collection(MONGO_COLLECTIONS.BOOKINGS).updateOne({ id: bkg.id }, { $set: bkg }, { upsert: true });
  }
  const registrationsToMigrate = Array.from(registrationMap.values());
  for (const reg of registrationsToMigrate) {
    await mongoDb.collection(MONGO_COLLECTIONS.CLASS_REGISTRATIONS).updateOne({ id: reg.id }, { $set: reg }, { upsert: true });
  }
  localDbState.products = productsToMigrate;
  localDbState.categories = categoriesToMigrate;
  localDbState.websiteSettings = {
    ...localDbState.websiteSettings || {},
    general: generalSettingDoc,
    achievements: achievementsSettingDoc,
    admins: adminsSettingDoc
  };
  localDbState.orders = ordersToMigrate;
  localDbState.inquiries = bookingsToMigrate;
  localDbState.registrations = registrationsToMigrate;
  const [
    productsCount,
    categoriesCount,
    settingsCount,
    usersCount,
    ordersCount,
    bookingsCount,
    registrationsCount,
    adminsDocInMongo
  ] = await Promise.all([
    mongoDb.collection(MONGO_COLLECTIONS.PRODUCTS).countDocuments(),
    mongoDb.collection(MONGO_COLLECTIONS.CATEGORIES).countDocuments(),
    mongoDb.collection(MONGO_COLLECTIONS.WEBSITE_SETTINGS).countDocuments(),
    mongoDb.collection(MONGO_COLLECTIONS.USERS).countDocuments(),
    mongoDb.collection(MONGO_COLLECTIONS.ORDERS).countDocuments(),
    mongoDb.collection(MONGO_COLLECTIONS.BOOKINGS).countDocuments(),
    mongoDb.collection(MONGO_COLLECTIONS.CLASS_REGISTRATIONS).countDocuments(),
    mongoDb.collection(MONGO_COLLECTIONS.WEBSITE_SETTINGS).findOne({ settingKey: "admins" })
  ]);
  const plainTextPasswordPresent = Boolean(
    adminsDocInMongo && ("adminPassword" in adminsDocInMongo || "masterPassword" in adminsDocInMongo || "password" in adminsDocInMongo || "plainPassword" in adminsDocInMongo)
  );
  const scryptHashPresent = Boolean(
    adminsDocInMongo?.adminPasswordHash && adminsDocInMongo?.adminPasswordSalt
  );
  const report = {
    success: true,
    timestamp: nowIso,
    backup: {
      completed: true,
      backupFilePath: "/data/firestore_backup.json",
      backupSizeBytes: backupStats.size,
      firestoreRestProbeStatus: firestoreProbeStatus,
      firebaseDataModifiedOrDeleted: false,
      countsInBackup: {
        products: productsToMigrate.length,
        categories: menuCategoriesEntries.length,
        bakingClasses: categoriesToMigrate.filter((c) => c.type === "baking_class").length,
        websiteSettings: settingsToMigrate.length,
        users: usersToMigrate.length,
        orders: ordersToMigrate.length,
        bookings: bookingsToMigrate.length,
        classRegistrations: registrationsToMigrate.length
      }
    },
    migration: {
      databaseName: mongoDb.databaseName,
      collectionsMigrated: Object.values(MONGO_COLLECTIONS),
      upsertedCounts: {
        products: productsToMigrate.length,
        categories: categoriesToMigrate.length,
        website_settings: settingsToMigrate.length + 1,
        users: usersToMigrate.length,
        orders: ordersToMigrate.length,
        bookings: bookingsToMigrate.length,
        class_registrations: registrationsToMigrate.length
      }
    },
    verification: {
      verified: productsCount >= productsToMigrate.length && categoriesCount >= categoriesToMigrate.length && !plainTextPasswordPresent && scryptHashPresent,
      mongoCollectionCounts: {
        products: productsCount,
        categories: categoriesCount,
        website_settings: settingsCount,
        users: usersCount,
        orders: ordersCount,
        bookings: bookingsCount,
        class_registrations: registrationsCount
      },
      securityAudit: {
        plainTextAdminPasswordRemoved: !plainTextPasswordPresent,
        scryptPasswordHashPresent: scryptHashPresent,
        firebaseAuthPreserved: true,
        firebaseDataUntouched: true
      }
    }
  };
  return { report, updatedLocalDbState: localDbState };
}

// server.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path2.dirname(__filename);
var loadFirebaseConfig = () => {
  const candidatePaths = [
    path2.join(__dirname, "firebase-applet-config.json"),
    path2.join(__dirname, "..", "firebase-applet-config.json"),
    path2.join(process.cwd(), "firebase-applet-config.json")
  ];
  for (const candidate of candidatePaths) {
    try {
      if (fs2.existsSync(candidate)) {
        return JSON.parse(fs2.readFileSync(candidate, "utf-8"));
      }
    } catch {
    }
  }
  return {
    projectId: "extreme-spark-dxctm",
    firestoreDatabaseId: "ai-studio-75f70547-1c2b-4420-ac3a-f6b892c5187e"
  };
};
var firebaseConfig = loadFirebaseConfig();
var BUNDLED_DATA_DIR = path2.join(__dirname, "data");
var DATA_DIR = process.env.VERCEL ? "/tmp/browniegirl_data" : BUNDLED_DATA_DIR;
var DB_FILE_PATH = path2.join(DATA_DIR, "production_db.json");
function ensureDatabaseInitialized() {
  try {
    if (!fs2.existsSync(DATA_DIR)) {
      fs2.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs2.existsSync(DB_FILE_PATH)) {
      const bundledDbPath = path2.join(BUNDLED_DATA_DIR, "production_db.json");
      if (process.env.VERCEL && fs2.existsSync(bundledDbPath)) {
        const bundledRaw = fs2.readFileSync(bundledDbPath, "utf-8");
        fs2.writeFileSync(DB_FILE_PATH, bundledRaw, "utf-8");
      } else {
        const initialDb = {
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
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        fs2.writeFileSync(DB_FILE_PATH, JSON.stringify(initialDb, null, 2), "utf-8");
        return initialDb;
      }
    }
  } catch {
  }
  try {
    const raw = fs2.readFileSync(DB_FILE_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      lastOrderSequence: typeof parsed.lastOrderSequence === "number" ? parsed.lastOrderSequence : 1024,
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      inquiries: Array.isArray(parsed.inquiries) ? parsed.inquiries : [],
      registrations: Array.isArray(parsed.registrations) ? parsed.registrations : [],
      products: Array.isArray(parsed.products) ? parsed.products : [],
      categories: Array.isArray(parsed.categories) ? parsed.categories : [],
      websiteSettings: parsed.websiteSettings && typeof parsed.websiteSettings === "object" ? parsed.websiteSettings : {},
      deletedOrderIds: Array.isArray(parsed.deletedOrderIds) ? parsed.deletedOrderIds : [],
      deletedInquiryIds: Array.isArray(parsed.deletedInquiryIds) ? parsed.deletedInquiryIds : [],
      deletedRegistrationIds: Array.isArray(parsed.deletedRegistrationIds) ? parsed.deletedRegistrationIds : [],
      deletedProductIds: Array.isArray(parsed.deletedProductIds) ? parsed.deletedProductIds : [],
      deletedClassIds: Array.isArray(parsed.deletedClassIds) ? parsed.deletedClassIds : [],
      updatedAt: parsed.updatedAt || (/* @__PURE__ */ new Date()).toISOString()
    };
  } catch (err) {
    console.error("[DB] Failed to parse production_db.json, initializing clean state:", err);
    const fallbackDb = {
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
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    return fallbackDb;
  }
}
var atomicFileCounter = 0;
function saveDatabaseAtomically(dbData) {
  try {
    if (!fs2.existsSync(DATA_DIR)) {
      fs2.mkdirSync(DATA_DIR, { recursive: true });
    }
    dbData.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    atomicFileCounter += 1;
    const tempPath = `${DB_FILE_PATH}.tmp.${process.pid}.${Date.now()}.${atomicFileCounter}.${Math.random().toString(36).slice(2, 8)}`;
    fs2.writeFileSync(tempPath, JSON.stringify(dbData, null, 2), "utf-8");
    fs2.renameSync(tempPath, DB_FILE_PATH);
  } catch {
  }
}
var orderCreationQueue = Promise.resolve();
function withOrderCreationLock(task) {
  const next = orderCreationQueue.then(task, task);
  orderCreationQueue = next.catch(() => {
  });
  return next;
}
var formatRupeeServer = (amount) => {
  const num = Number.isFinite(amount) ? Math.round(amount) : 0;
  return `\u20B9${num.toLocaleString("en-IN")}`;
};
function buildInquirySummaryFromOrder(order) {
  const itemizedLines = order.items.map((item) => {
    const catBadge = item.category === "cake_normal" ? " [Cake Menu - Normal Flavours]" : item.category === "cake_premium" ? " [Cake Menu - Premium Flavours]" : item.category === "frosted_brownie" ? " [Frosted Brownie Add-on]" : "";
    return `\u2022 ${item.name}${catBadge} \u2013 ${item.quantity} \xD7 ${item.unitPriceFormatted} = ${item.lineTotalFormatted}`;
  }).join("\n");
  const summaryMessage = [
    `Order ID: ${order.orderId}`,
    `Customer: ${order.customerName}`,
    `Phone: ${order.customerPhone}`,
    order.deliveryAddress ? `Delivery / Pickup: ${order.deliveryAddress}` : null,
    `
Products:`,
    itemizedLines,
    `
Grand Total: ${order.totalAmount}`,
    order.specialInstructions ? `
Special Notes: ${order.specialInstructions}` : null
  ].filter(Boolean).join("\n");
  return {
    id: `order_${order.orderId}`,
    bookingId: `order_${order.orderId}`,
    orderId: order.orderId,
    userId: order.userId,
    userName: order.customerName,
    userEmail: order.customerEmail,
    userPhone: order.customerPhone,
    deliveryAddress: order.deliveryAddress,
    deliveryType: "delivery",
    subject: `Order ID: ${order.orderId} (${order.items.length} Product${order.items.length > 1 ? "s" : ""} \u2014 Grand Total: ${order.totalAmount})`,
    message: summaryMessage,
    status: order.isRead ? "read" : "new",
    isRead: Boolean(order.isRead),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt
  };
}
function stripMongoId(doc) {
  const copy = { ...doc };
  delete copy._id;
  return copy;
}
function createExpressApiApp() {
  const app2 = express();
  app2.use(express.json({ limit: "10mb" }));
  ensureDatabaseInitialized();
  app2.get("/api/health", async (_req, res) => {
    const dbState = ensureDatabaseInitialized();
    const mongoHealth = await checkMongoConnectionHealth();
    let mongoCounts = null;
    if (mongoHealth.connected) {
      try {
        const mongoDb = await getMongoDatabase();
        if (mongoDb) {
          const [ordersCount, bookingsCount, regsCount] = await Promise.all([
            mongoDb.collection(MONGO_COLLECTIONS.ORDERS).countDocuments(),
            mongoDb.collection(MONGO_COLLECTIONS.BOOKINGS).countDocuments(),
            mongoDb.collection(MONGO_COLLECTIONS.CLASS_REGISTRATIONS).countDocuments()
          ]);
          mongoCounts = {
            orders: ordersCount,
            bookings: bookingsCount,
            registrations: regsCount
          };
        }
      } catch {
      }
    }
    res.status(200).json({
      status: "ok",
      database: mongoHealth.connected ? "mongodb-atlas-connected" : "connected",
      storageEngine: mongoHealth.connected ? "mongodb-atlas+server-db" : "persistent-server-db",
      mongodb: mongoHealth,
      firestoreProjectId: firebaseConfig.projectId,
      firestoreDatabaseId: firebaseConfig.firestoreDatabaseId,
      counts: {
        orders: mongoCounts ? Math.max(mongoCounts.orders, dbState.orders.length) : dbState.orders.length,
        inquiries: mongoCounts ? Math.max(mongoCounts.bookings, dbState.inquiries.length) : dbState.inquiries.length,
        registrations: mongoCounts ? Math.max(mongoCounts.registrations, dbState.registrations.length) : dbState.registrations.length
      },
      updatedAt: dbState.updatedAt
    });
  });
  app2.post("/api/users/sync", async (req, res) => {
    try {
      const body = req.body || {};
      const uid = typeof body.uid === "string" ? body.uid.trim() : "";
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      if (!uid) {
        res.status(400).json({ success: false, error: "User uid is required." });
        return;
      }
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      const isPrimaryAdmin = ["vigneshsivan2001@gmail.com", "preethipreethu712@gmail.com"].includes(email);
      const role = isPrimaryAdmin || body.role === "admin" ? "admin" : "customer";
      const userDoc = {
        uid,
        email,
        displayName: typeof body.displayName === "string" && body.displayName.trim() ? body.displayName.trim() : "Baking Enthusiast",
        photoURL: typeof body.photoURL === "string" ? body.photoURL.trim() : "",
        role,
        favorites: Array.isArray(body.favorites) ? body.favorites : ["classic-fudge", "salted-caramel"],
        createdAt: typeof body.createdAt === "string" && body.createdAt ? body.createdAt : nowIso,
        updatedAt: nowIso
      };
      const mongoDb = await getMongoDatabase();
      if (mongoDb) {
        const usersCol = mongoDb.collection(MONGO_COLLECTIONS.USERS);
        const existing = await usersCol.findOne({ uid });
        if (existing) {
          const mergedRole = isPrimaryAdmin || existing.role === "admin" || role === "admin" ? "admin" : "customer";
          await usersCol.updateOne(
            { uid },
            {
              $set: {
                email: userDoc.email || existing.email,
                displayName: userDoc.displayName || existing.displayName,
                photoURL: userDoc.photoURL || existing.photoURL,
                role: mergedRole,
                updatedAt: nowIso
              }
            }
          );
          const updated = await usersCol.findOne({ uid });
          res.status(200).json({
            success: true,
            user: updated ? stripMongoId(updated) : { ...userDoc, role: mergedRole }
          });
          return;
        } else {
          await usersCol.insertOne({ ...userDoc });
        }
      }
      res.status(200).json({
        success: true,
        user: userDoc
      });
    } catch (err) {
      console.error("[POST /api/users/sync] Error:", err);
      res.status(500).json({
        success: false,
        error: "Failed to sync user profile."
      });
    }
  });
  app2.patch("/api/users/:uid/favorites", async (req, res) => {
    try {
      const uid = String(req.params.uid || "").trim();
      const favorites = Array.isArray(req.body?.favorites) ? req.body.favorites : [];
      if (!uid) {
        res.status(400).json({ success: false, error: "User uid is required." });
        return;
      }
      const mongoDb = await getMongoDatabase();
      if (mongoDb) {
        await mongoDb.collection(MONGO_COLLECTIONS.USERS).updateOne(
          { uid },
          {
            $set: {
              favorites,
              updatedAt: (/* @__PURE__ */ new Date()).toISOString()
            }
          }
        );
      }
      res.status(200).json({ success: true, favorites });
    } catch (err) {
      console.error("[PATCH /api/users/:uid/favorites] Error:", err);
      res.status(500).json({ success: false, error: "Failed to update favorites." });
    }
  });
  app2.get("/api/orders", async (req, res) => {
    try {
      const dbState = ensureDatabaseInitialized();
      const userIdFilter = typeof req.query.userId === "string" ? req.query.userId.trim() : "";
      const byOrderId = /* @__PURE__ */ new Map();
      for (const localOrder of dbState.orders) {
        const key = localOrder.orderId || localOrder.id;
        if (!dbState.deletedOrderIds.includes(key)) {
          byOrderId.set(key, localOrder);
        }
      }
      try {
        const mongoDb = await getMongoDatabase();
        if (mongoDb) {
          const filter = {};
          if (userIdFilter) filter.userId = userIdFilter;
          const mongoOrders = await mongoDb.collection(MONGO_COLLECTIONS.ORDERS).find(filter).sort({ createdAt: -1 }).toArray();
          for (const mo of mongoOrders) {
            const clean = stripMongoId(mo);
            const key = clean.orderId || clean.id;
            if (!dbState.deletedOrderIds.includes(key)) {
              byOrderId.set(key, clean);
            }
          }
        }
      } catch {
      }
      const statusFilter = typeof req.query.status === "string" ? req.query.status.trim() : "";
      const searchQuery = typeof req.query.search === "string" ? req.query.search.trim().toLowerCase() : "";
      const sortedOrders = Array.from(byOrderId.values()).filter((o) => userIdFilter ? o.userId === userIdFilter : true).filter((o) => statusFilter && statusFilter !== "all" ? o.status === statusFilter : true).filter((o) => {
        if (!searchQuery) return true;
        return (o.orderId || "").toLowerCase().includes(searchQuery) || (o.customerName || "").toLowerCase().includes(searchQuery) || (o.customerPhone || "").toLowerCase().includes(searchQuery) || (o.customerEmail || "").toLowerCase().includes(searchQuery) || (o.deliveryAddress || "").toLowerCase().includes(searchQuery);
      }).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
      const hasPagination = req.query.page !== void 0 || req.query.limit !== void 0;
      const { page, limit, skip } = parsePaginationParams(req.query, 50, 200);
      const paginatedOrders = hasPagination ? sortedOrders.slice(skip, skip + limit) : sortedOrders;
      res.status(200).json({
        success: true,
        orders: paginatedOrders,
        total: sortedOrders.length,
        page: hasPagination ? page : 1,
        limit: hasPagination ? limit : sortedOrders.length || 50,
        totalPages: hasPagination ? Math.max(1, Math.ceil(sortedOrders.length / limit)) : 1
      });
    } catch (err) {
      console.error("[GET /api/orders] Error:", err);
      res.status(500).json({
        success: false,
        error: "Failed to retrieve customer orders from the production database."
      });
    }
  });
  app2.get("/api/orders/:orderId", async (req, res) => {
    try {
      const dbState = ensureDatabaseInitialized();
      const targetId = String(req.params.orderId || "").trim();
      if (dbState.deletedOrderIds.includes(targetId)) {
        res.status(404).json({
          success: false,
          error: `Order ${targetId} not found.`
        });
        return;
      }
      let found;
      try {
        const mongoDb = await getMongoDatabase();
        if (mongoDb) {
          const mongoOrder = await mongoDb.collection(MONGO_COLLECTIONS.ORDERS).findOne({ $or: [{ orderId: targetId }, { id: targetId }] });
          if (mongoOrder) {
            found = stripMongoId(mongoOrder);
          }
        }
      } catch {
      }
      if (!found) {
        found = dbState.orders.find(
          (o) => (o.orderId === targetId || o.id === targetId) && !dbState.deletedOrderIds.includes(targetId)
        );
      }
      if (!found) {
        res.status(404).json({
          success: false,
          error: `Order ${targetId} not found.`
        });
        return;
      }
      res.status(200).json({
        success: true,
        order: found
      });
    } catch (err) {
      console.error("[GET /api/orders/:orderId] Error:", err);
      res.status(500).json({
        success: false,
        error: "Failed to retrieve order details."
      });
    }
  });
  app2.post("/api/orders", async (req, res) => {
    try {
      const body = req.body || {};
      if (body.__simulateDbFailure === true) {
        res.status(500).json({
          success: false,
          error: "Database transaction failed: Unable to commit order to production storage."
        });
        return;
      }
      const customerName = typeof body.customerName === "string" ? body.customerName.trim() : "";
      const customerPhone = typeof body.customerPhone === "string" ? body.customerPhone.trim() : "";
      const customerEmail = typeof body.customerEmail === "string" ? body.customerEmail.trim() : "";
      const deliveryAddress = typeof body.deliveryAddress === "string" ? body.deliveryAddress.trim() : "";
      const specialInstructions = typeof body.specialInstructions === "string" ? body.specialInstructions.trim() : "";
      const userId = typeof body.userId === "string" && body.userId.trim() ? body.userId.trim() : `guest_${Date.now()}`;
      const idempotencyKey = typeof body.idempotencyKey === "string" && body.idempotencyKey.trim() ? body.idempotencyKey.trim() : void 0;
      const rawItems = Array.isArray(body.items) ? body.items : [];
      if (!customerName) {
        res.status(400).json({
          success: false,
          error: "Validation failed: Customer full name is required."
        });
        return;
      }
      if (!customerPhone) {
        res.status(400).json({
          success: false,
          error: "Validation failed: Customer WhatsApp / phone number is required."
        });
        return;
      }
      if (!deliveryAddress) {
        res.status(400).json({
          success: false,
          error: "Validation failed: Complete delivery address is mandatory."
        });
        return;
      }
      if (rawItems.length === 0) {
        res.status(400).json({
          success: false,
          error: "Validation failed: Order must contain at least one cake or brownie item."
        });
        return;
      }
      const dbState = ensureDatabaseInitialized();
      const mongoDb = await getMongoDatabase();
      if (idempotencyKey) {
        if (mongoDb) {
          const existingMongo = await mongoDb.collection(MONGO_COLLECTIONS.ORDERS).findOne({ idempotencyKey });
          if (existingMongo && !dbState.deletedOrderIds.includes(existingMongo.orderId)) {
            res.status(200).json({
              success: true,
              order: stripMongoId(existingMongo),
              deduplicated: true
            });
            return;
          }
        }
        const existingByKey = dbState.orders.find(
          (o) => o.idempotencyKey === idempotencyKey && !dbState.deletedOrderIds.includes(o.orderId)
        );
        if (existingByKey) {
          res.status(200).json({
            success: true,
            order: existingByKey,
            deduplicated: true
          });
          return;
        }
      }
      const validatedItems = [];
      let calculatedTotalNumeric = 0;
      for (const rawItem of rawItems) {
        const itemName = typeof rawItem.name === "string" ? rawItem.name.trim() : "";
        const quantity = Number(rawItem.quantity);
        const unitPrice = Number(rawItem.unitPrice);
        if (!itemName || !Number.isFinite(quantity) || quantity < 1 || !Number.isFinite(unitPrice) || unitPrice < 0) {
          res.status(400).json({
            success: false,
            error: "Validation failed: Each ordered product must have a valid name, quantity (>= 1), and price."
          });
          return;
        }
        const category = typeof rawItem.category === "string" && rawItem.category.trim() ? rawItem.category.trim() : "brownie";
        const selectedWeight = typeof rawItem.weight === "string" && rawItem.weight.trim() ? rawItem.weight.trim() : typeof rawItem.variantLabel === "string" && rawItem.variantLabel.trim() ? rawItem.variantLabel.trim() : void 0;
        const baseName = itemName.replace(/\s*\((½ KG|1\/2 kg|1 KG|1 kg)\)\s*$/i, "").trim();
        const displayProductName = selectedWeight ? `${baseName} (${selectedWeight})` : baseName;
        const lineTotal = Math.round(unitPrice * quantity);
        calculatedTotalNumeric += lineTotal;
        validatedItems.push({
          productId: typeof rawItem.productId === "string" && rawItem.productId.trim() ? rawItem.productId.trim() : `prod_${validatedItems.length + 1}`,
          name: displayProductName,
          category,
          quantity: Math.round(quantity),
          unitPrice: Math.round(unitPrice),
          unitPriceFormatted: formatRupeeServer(unitPrice),
          lineTotal,
          lineTotalFormatted: formatRupeeServer(lineTotal),
          ...selectedWeight ? { variantLabel: selectedWeight, weight: selectedWeight } : {},
          isAddon: Boolean(rawItem.isAddon || category === "frosted_brownie")
        });
      }
      const createdResult = await withOrderCreationLock(async () => {
        const freshDbState = ensureDatabaseInitialized();
        if (idempotencyKey) {
          if (mongoDb) {
            const existingMongo = await mongoDb.collection(MONGO_COLLECTIONS.ORDERS).findOne({ idempotencyKey });
            if (existingMongo && !freshDbState.deletedOrderIds.includes(existingMongo.orderId)) {
              return { order: stripMongoId(existingMongo), deduplicated: true };
            }
          }
          const existingByKey = freshDbState.orders.find(
            (o) => o.idempotencyKey === idempotencyKey && !freshDbState.deletedOrderIds.includes(o.orderId)
          );
          if (existingByKey) {
            return { order: existingByKey, deduplicated: true };
          }
        }
        const localFloor = Math.max(1024, freshDbState.lastOrderSequence || 1024);
        let nextSeq = localFloor + 1;
        if (mongoDb) {
          try {
            nextSeq = await getNextMongoOrderSequence(mongoDb, localFloor);
          } catch {
          }
        }
        const existingOrderIds = /* @__PURE__ */ new Set([
          ...freshDbState.orders.map((o) => o.orderId),
          ...freshDbState.deletedOrderIds
        ]);
        while (existingOrderIds.has(`BGC${nextSeq}`)) {
          nextSeq += 1;
        }
        if (mongoDb) {
          while (await mongoDb.collection(MONGO_COLLECTIONS.ORDERS).findOne({ orderId: `BGC${nextSeq}` })) {
            nextSeq += 1;
          }
        }
        freshDbState.lastOrderSequence = nextSeq;
        const orderId = `BGC${nextSeq}`;
        const nowIso = (/* @__PURE__ */ new Date()).toISOString();
        const hasRegularBrownie = validatedItems.some((i) => i.category === "brownie");
        const hasFrostedBrownie = validatedItems.some((i) => i.category === "frosted_brownie" || i.isAddon);
        const newOrder = {
          id: orderId,
          orderId,
          ...idempotencyKey ? { idempotencyKey } : {},
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
          paymentStatus: "pending",
          status: "received",
          isRead: false,
          createdAt: nowIso,
          updatedAt: nowIso
        };
        const mirrorInquiry = buildInquirySummaryFromOrder(newOrder);
        if (mongoDb) {
          await mongoDb.collection(MONGO_COLLECTIONS.ORDERS).insertOne({ ...newOrder });
          const mirrorBookingDoc = {
            ...mirrorInquiry,
            bookingId: mirrorInquiry.bookingId || mirrorInquiry.id,
            updatedAt: nowIso
          };
          await mongoDb.collection(MONGO_COLLECTIONS.BOOKINGS).updateOne({ id: mirrorBookingDoc.id }, { $set: mirrorBookingDoc }, { upsert: true });
        }
        const latestDbState = ensureDatabaseInitialized();
        latestDbState.lastOrderSequence = Math.max(latestDbState.lastOrderSequence || 1024, nextSeq);
        latestDbState.orders.unshift(newOrder);
        latestDbState.inquiries = [
          mirrorInquiry,
          ...latestDbState.inquiries.filter((inq) => inq.id !== mirrorInquiry.id)
        ];
        saveDatabaseAtomically(latestDbState);
        return { order: newOrder, deduplicated: false };
      });
      if (createdResult.deduplicated) {
        res.status(200).json({
          success: true,
          order: createdResult.order,
          deduplicated: true
        });
        return;
      }
      console.log(
        `[POST /api/orders] Persisted Order ${createdResult.order.orderId} for ${customerName} (${validatedItems.length} items, Total: ${createdResult.order.totalAmount})`
      );
      res.status(201).json({
        success: true,
        order: createdResult.order
      });
    } catch (err) {
      console.error("[POST /api/orders] Critical error saving order:", err);
      res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : "Failed to save order to production database."
      });
    }
  });
  app2.patch("/api/orders/:orderId", async (req, res) => {
    try {
      const targetId = String(req.params.orderId || "").trim();
      const updates = req.body || {};
      const dbState = ensureDatabaseInitialized();
      const mongoDb = await getMongoDatabase();
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      let currentOrder;
      const idx = dbState.orders.findIndex((o) => o.orderId === targetId || o.id === targetId);
      if (idx !== -1) {
        currentOrder = dbState.orders[idx];
      } else if (mongoDb) {
        const fromMongo = await mongoDb.collection(MONGO_COLLECTIONS.ORDERS).findOne({ $or: [{ orderId: targetId }, { id: targetId }] });
        if (fromMongo) {
          currentOrder = stripMongoId(fromMongo);
        }
      }
      if (!currentOrder) {
        res.status(404).json({
          success: false,
          error: `Order ${targetId} not found in database.`
        });
        return;
      }
      const updatedOrder = {
        ...currentOrder,
        ...typeof updates.status === "string" ? { status: updates.status } : {},
        ...typeof updates.paymentStatus === "string" ? { paymentStatus: updates.paymentStatus } : {},
        ...typeof updates.isRead === "boolean" ? { isRead: updates.isRead } : {},
        updatedAt: nowIso
      };
      if (mongoDb) {
        await mongoDb.collection(MONGO_COLLECTIONS.ORDERS).updateOne(
          { $or: [{ orderId: targetId }, { id: targetId }] },
          {
            $set: {
              status: updatedOrder.status,
              paymentStatus: updatedOrder.paymentStatus,
              isRead: updatedOrder.isRead,
              updatedAt: nowIso
            }
          }
        );
        const mirrorId2 = `order_${targetId}`;
        await mongoDb.collection(MONGO_COLLECTIONS.BOOKINGS).updateOne(
          { $or: [{ id: mirrorId2 }, { orderId: targetId }] },
          {
            $set: {
              isRead: Boolean(updatedOrder.isRead),
              status: updatedOrder.status === "delivered" || updatedOrder.status === "cancelled" ? "closed" : updatedOrder.isRead ? "read" : "new",
              updatedAt: nowIso
            }
          }
        );
      }
      if (idx !== -1) {
        dbState.orders[idx] = updatedOrder;
      } else {
        dbState.orders.unshift(updatedOrder);
      }
      const mirrorId = `order_${targetId}`;
      const inqIdx = dbState.inquiries.findIndex((i) => i.id === mirrorId || i.orderId === targetId);
      if (inqIdx !== -1) {
        dbState.inquiries[inqIdx] = {
          ...dbState.inquiries[inqIdx],
          isRead: updatedOrder.isRead ?? dbState.inquiries[inqIdx].isRead,
          status: updatedOrder.status === "delivered" || updatedOrder.status === "cancelled" ? "closed" : updatedOrder.isRead ? "read" : dbState.inquiries[inqIdx].status,
          updatedAt: nowIso
        };
      }
      saveDatabaseAtomically(dbState);
      res.status(200).json({
        success: true,
        order: updatedOrder
      });
    } catch (err) {
      console.error("[PATCH /api/orders/:orderId] Error:", err);
      res.status(500).json({
        success: false,
        error: "Failed to update order status in database."
      });
    }
  });
  app2.delete("/api/orders/:orderId", async (req, res) => {
    try {
      const targetId = String(req.params.orderId || "").trim();
      const dbState = ensureDatabaseInitialized();
      const mongoDb = await getMongoDatabase();
      const mirrorId = `order_${targetId}`;
      if (mongoDb) {
        await Promise.all([
          mongoDb.collection(MONGO_COLLECTIONS.ORDERS).deleteMany({ $or: [{ orderId: targetId }, { id: targetId }] }),
          mongoDb.collection(MONGO_COLLECTIONS.BOOKINGS).deleteMany({ $or: [{ id: mirrorId }, { orderId: targetId }] })
        ]);
      }
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
        deletedOrderId: targetId
      });
    } catch (err) {
      console.error("[DELETE /api/orders/:orderId] Error:", err);
      res.status(500).json({
        success: false,
        error: "Failed to delete order from database."
      });
    }
  });
  const handleGetBookings = async (req, res) => {
    try {
      const dbState = ensureDatabaseInitialized();
      const userIdFilter = typeof req.query.userId === "string" ? req.query.userId.trim() : "";
      const byId = /* @__PURE__ */ new Map();
      for (const localInq of dbState.inquiries) {
        if (!dbState.deletedInquiryIds.includes(localInq.id)) {
          byId.set(localInq.id, localInq);
        }
      }
      try {
        const mongoDb = await getMongoDatabase();
        if (mongoDb) {
          const filter = {};
          if (userIdFilter) filter.userId = userIdFilter;
          const mongoBookings = await mongoDb.collection(MONGO_COLLECTIONS.BOOKINGS).find(filter).sort({ createdAt: -1 }).toArray();
          for (const mb of mongoBookings) {
            const clean = stripMongoId(mb);
            if (!dbState.deletedInquiryIds.includes(clean.id)) {
              byId.set(clean.id, clean);
            }
          }
        }
      } catch {
      }
      const statusFilter = typeof req.query.status === "string" ? req.query.status.trim() : "";
      const searchQuery = typeof req.query.search === "string" ? req.query.search.trim().toLowerCase() : "";
      const list = Array.from(byId.values()).filter((i) => userIdFilter ? i.userId === userIdFilter : true).filter((i) => {
        if (!statusFilter || statusFilter === "all") return true;
        if (statusFilter === "unread") return i.status !== "read" && !i.isRead;
        return i.status === statusFilter;
      }).filter((i) => {
        if (!searchQuery) return true;
        return (i.id || "").toLowerCase().includes(searchQuery) || (i.userName || "").toLowerCase().includes(searchQuery) || (i.userEmail || "").toLowerCase().includes(searchQuery) || (i.userPhone || "").toLowerCase().includes(searchQuery) || (i.subject || "").toLowerCase().includes(searchQuery) || (i.message || "").toLowerCase().includes(searchQuery);
      }).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
      const hasPagination = req.query.page !== void 0 || req.query.limit !== void 0;
      const { page, limit, skip } = parsePaginationParams(req.query, 50, 200);
      const paginatedList = hasPagination ? list.slice(skip, skip + limit) : list;
      res.status(200).json({
        success: true,
        inquiries: paginatedList,
        bookings: paginatedList,
        total: list.length,
        page: hasPagination ? page : 1,
        limit: hasPagination ? limit : list.length || 50,
        totalPages: hasPagination ? Math.max(1, Math.ceil(list.length / limit)) : 1
      });
    } catch (err) {
      console.error("[GET /api/inquiries] Error:", err);
      res.status(500).json({
        success: false,
        error: "Failed to retrieve inquiries."
      });
    }
  };
  app2.get("/api/inquiries", handleGetBookings);
  app2.get("/api/bookings", handleGetBookings);
  const handleCreateBooking = async (req, res) => {
    try {
      const body = req.body || {};
      if (body.__simulateDbFailure === true) {
        res.status(500).json({
          success: false,
          error: "Database transaction failed: Unable to save booking to production storage."
        });
        return;
      }
      const subject = typeof body.subject === "string" ? body.subject.trim() : "";
      const message = typeof body.message === "string" ? body.message.trim() : "";
      const userName = typeof body.userName === "string" && body.userName.trim() ? body.userName.trim() : "Bakery Guest";
      const userEmail = typeof body.userEmail === "string" && body.userEmail.trim() ? body.userEmail.trim() : "guest@browinegirlcakes.com";
      const userPhone = typeof body.userPhone === "string" ? body.userPhone.trim() : "";
      const deliveryAddress = typeof body.deliveryAddress === "string" ? body.deliveryAddress.trim() : void 0;
      const deliveryType = body.deliveryType === "delivery" || body.deliveryType === "pickup" ? body.deliveryType : deliveryAddress ? "delivery" : void 0;
      const idempotencyKey = typeof body.idempotencyKey === "string" && body.idempotencyKey.trim() ? body.idempotencyKey.trim() : void 0;
      if (!subject || !message) {
        res.status(400).json({
          success: false,
          error: "Validation failed: Subject and message are required."
        });
        return;
      }
      if (body.requireDeliveryAddress === true && !deliveryAddress) {
        res.status(400).json({
          success: false,
          error: "Validation failed: Complete delivery address is mandatory for custom orders."
        });
        return;
      }
      const dbState = ensureDatabaseInitialized();
      const mongoDb = await getMongoDatabase();
      if (idempotencyKey) {
        if (mongoDb) {
          const existingMongo = await mongoDb.collection(MONGO_COLLECTIONS.BOOKINGS).findOne({ idempotencyKey });
          if (existingMongo && !dbState.deletedInquiryIds.includes(existingMongo.id)) {
            const clean = stripMongoId(existingMongo);
            res.status(200).json({
              success: true,
              inquiry: clean,
              booking: clean,
              deduplicated: true
            });
            return;
          }
        }
        const existingLocal = dbState.inquiries.find(
          (i) => i.idempotencyKey === idempotencyKey && !dbState.deletedInquiryIds.includes(i.id)
        );
        if (existingLocal) {
          res.status(200).json({
            success: true,
            inquiry: existingLocal,
            booking: existingLocal,
            deduplicated: true
          });
          return;
        }
      }
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      const generatedId = typeof body.id === "string" && body.id.trim() ? body.id.trim() : `BK-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      const newInq = {
        id: generatedId,
        bookingId: generatedId,
        ...idempotencyKey ? { idempotencyKey } : {},
        userId: typeof body.userId === "string" && body.userId.trim() ? body.userId.trim() : `guest_${Date.now()}`,
        userName,
        userEmail,
        userPhone,
        subject,
        message,
        ...typeof body.eventType === "string" && body.eventType.trim() ? { eventType: body.eventType.trim() } : {},
        ...typeof body.eventDate === "string" && body.eventDate.trim() ? { eventDate: body.eventDate.trim() } : {},
        ...typeof body.guestCount === "string" && body.guestCount.trim() ? { guestCount: body.guestCount.trim() } : {},
        ...deliveryType ? { deliveryType } : {},
        ...deliveryAddress ? { deliveryAddress } : {},
        status: "new",
        isRead: false,
        createdAt: nowIso,
        updatedAt: nowIso
      };
      if (mongoDb) {
        const mongoBookingDoc = {
          ...newInq,
          bookingId: newInq.bookingId || newInq.id,
          updatedAt: nowIso
        };
        await mongoDb.collection(MONGO_COLLECTIONS.BOOKINGS).updateOne({ id: mongoBookingDoc.id }, { $set: mongoBookingDoc }, { upsert: true });
      }
      const latestDbState = ensureDatabaseInitialized();
      latestDbState.inquiries = [newInq, ...latestDbState.inquiries.filter((i) => i.id !== generatedId)];
      saveDatabaseAtomically(latestDbState);
      res.status(201).json({
        success: true,
        inquiry: newInq,
        booking: newInq
      });
    } catch (err) {
      console.error("[POST /api/inquiries] Error:", err);
      res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : "Failed to save booking inquiry."
      });
    }
  };
  app2.post("/api/inquiries", handleCreateBooking);
  app2.post("/api/bookings", handleCreateBooking);
  const handleUpdateBooking = async (req, res) => {
    try {
      const targetId = String(req.params.id || "").trim();
      const updates = req.body || {};
      const dbState = ensureDatabaseInitialized();
      const mongoDb = await getMongoDatabase();
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      let currentInq;
      const idx = dbState.inquiries.findIndex((i) => i.id === targetId || i.bookingId === targetId);
      if (idx !== -1) {
        currentInq = dbState.inquiries[idx];
      } else if (mongoDb) {
        const fromMongo = await mongoDb.collection(MONGO_COLLECTIONS.BOOKINGS).findOne({ $or: [{ id: targetId }, { bookingId: targetId }] });
        if (fromMongo) {
          currentInq = stripMongoId(fromMongo);
        }
      }
      if (!currentInq) {
        res.status(404).json({
          success: false,
          error: `Inquiry ${targetId} not found.`
        });
        return;
      }
      const updated = {
        ...currentInq,
        ...typeof updates.status === "string" ? { status: updates.status } : {},
        ...typeof updates.isRead === "boolean" ? { isRead: updates.isRead } : {},
        ...updates.readAt !== void 0 ? { readAt: updates.readAt } : {},
        updatedAt: nowIso
      };
      if (mongoDb) {
        await mongoDb.collection(MONGO_COLLECTIONS.BOOKINGS).updateOne(
          { $or: [{ id: targetId }, { bookingId: targetId }] },
          {
            $set: {
              status: updated.status,
              isRead: updated.isRead,
              readAt: updated.readAt,
              updatedAt: nowIso
            }
          }
        );
      }
      if (idx !== -1) {
        dbState.inquiries[idx] = updated;
      } else {
        dbState.inquiries.unshift(updated);
      }
      saveDatabaseAtomically(dbState);
      res.status(200).json({
        success: true,
        inquiry: updated,
        booking: updated
      });
    } catch (err) {
      console.error("[PATCH /api/inquiries/:id] Error:", err);
      res.status(500).json({
        success: false,
        error: "Failed to update inquiry."
      });
    }
  };
  app2.patch("/api/inquiries/:id", handleUpdateBooking);
  app2.patch("/api/bookings/:id", handleUpdateBooking);
  const handleDeleteBooking = async (req, res) => {
    try {
      const targetId = String(req.params.id || "").trim();
      const dbState = ensureDatabaseInitialized();
      const mongoDb = await getMongoDatabase();
      if (mongoDb) {
        await mongoDb.collection(MONGO_COLLECTIONS.BOOKINGS).deleteMany({ $or: [{ id: targetId }, { bookingId: targetId }] });
      }
      dbState.inquiries = dbState.inquiries.filter((i) => i.id !== targetId && i.bookingId !== targetId);
      if (!dbState.deletedInquiryIds.includes(targetId)) {
        dbState.deletedInquiryIds.push(targetId);
      }
      saveDatabaseAtomically(dbState);
      res.status(200).json({
        success: true,
        deletedId: targetId
      });
    } catch (err) {
      console.error("[DELETE /api/inquiries/:id] Error:", err);
      res.status(500).json({
        success: false,
        error: "Failed to delete inquiry."
      });
    }
  };
  app2.delete("/api/inquiries/:id", handleDeleteBooking);
  app2.delete("/api/bookings/:id", handleDeleteBooking);
  app2.get("/api/registrations", async (req, res) => {
    try {
      const dbState = ensureDatabaseInitialized();
      const userIdFilter = typeof req.query.userId === "string" ? req.query.userId.trim() : "";
      const byId = /* @__PURE__ */ new Map();
      for (const localReg of dbState.registrations) {
        if (!dbState.deletedRegistrationIds.includes(localReg.id)) {
          byId.set(localReg.id, localReg);
        }
      }
      try {
        const mongoDb = await getMongoDatabase();
        if (mongoDb) {
          const filter = {};
          if (userIdFilter) filter.userId = userIdFilter;
          const mongoRegs = await mongoDb.collection(MONGO_COLLECTIONS.CLASS_REGISTRATIONS).find(filter).sort({ createdAt: -1 }).toArray();
          for (const mr of mongoRegs) {
            const clean = stripMongoId(mr);
            if (!dbState.deletedRegistrationIds.includes(clean.id)) {
              byId.set(clean.id, clean);
            }
          }
        }
      } catch {
      }
      const statusFilter = typeof req.query.status === "string" ? req.query.status.trim() : "";
      const searchQuery = typeof req.query.search === "string" ? req.query.search.trim().toLowerCase() : "";
      const list = Array.from(byId.values()).filter((r) => userIdFilter ? r.userId === userIdFilter : true).filter((r) => statusFilter && statusFilter !== "all" ? r.status === statusFilter : true).filter((r) => {
        if (!searchQuery) return true;
        return (r.id || "").toLowerCase().includes(searchQuery) || (r.userName || "").toLowerCase().includes(searchQuery) || (r.userEmail || "").toLowerCase().includes(searchQuery) || (r.className || "").toLowerCase().includes(searchQuery) || (r.preferredDate || "").toLowerCase().includes(searchQuery);
      }).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
      const hasPagination = req.query.page !== void 0 || req.query.limit !== void 0;
      const { page, limit, skip } = parsePaginationParams(req.query, 50, 200);
      const paginatedList = hasPagination ? list.slice(skip, skip + limit) : list;
      res.status(200).json({
        success: true,
        registrations: paginatedList,
        total: list.length,
        page: hasPagination ? page : 1,
        limit: hasPagination ? limit : list.length || 50,
        totalPages: hasPagination ? Math.max(1, Math.ceil(list.length / limit)) : 1
      });
    } catch (err) {
      console.error("[GET /api/registrations] Error:", err);
      res.status(500).json({
        success: false,
        error: "Failed to retrieve class registrations."
      });
    }
  });
  app2.post("/api/registrations", async (req, res) => {
    try {
      const body = req.body || {};
      if (body.__simulateDbFailure === true) {
        res.status(500).json({
          success: false,
          error: "Database transaction failed: Unable to save class registration to production storage."
        });
        return;
      }
      const className = typeof body.className === "string" ? body.className.trim() : "";
      const userName = typeof body.userName === "string" && body.userName.trim() ? body.userName.trim() : "Baking Student";
      const userEmail = typeof body.userEmail === "string" ? body.userEmail.trim().toLowerCase() : "";
      const userPhone = typeof body.userPhone === "string" ? body.userPhone.trim() : "";
      const preferredDate = typeof body.preferredDate === "string" && body.preferredDate.trim() ? body.preferredDate.trim() : "Next Available Batch";
      const idempotencyKey = typeof body.idempotencyKey === "string" && body.idempotencyKey.trim() ? body.idempotencyKey.trim() : void 0;
      if (!className) {
        res.status(400).json({
          success: false,
          error: "Validation failed: Class name is required."
        });
        return;
      }
      const dbState = ensureDatabaseInitialized();
      const mongoDb = await getMongoDatabase();
      if (idempotencyKey) {
        if (mongoDb) {
          const existingByIdem = await mongoDb.collection(MONGO_COLLECTIONS.CLASS_REGISTRATIONS).findOne({ idempotencyKey });
          if (existingByIdem && !dbState.deletedRegistrationIds.includes(existingByIdem.id)) {
            res.status(200).json({
              success: true,
              registration: stripMongoId(existingByIdem),
              deduplicated: true
            });
            return;
          }
        }
        const existingLocalIdem = dbState.registrations.find(
          (r) => r.idempotencyKey === idempotencyKey && !dbState.deletedRegistrationIds.includes(r.id)
        );
        if (existingLocalIdem) {
          res.status(200).json({
            success: true,
            registration: existingLocalIdem,
            deduplicated: true
          });
          return;
        }
      }
      if (userEmail && body.allowDuplicateClassDate !== true) {
        if (mongoDb) {
          const existingActive = await mongoDb.collection(MONGO_COLLECTIONS.CLASS_REGISTRATIONS).findOne({
            userEmail,
            className,
            preferredDate,
            status: { $ne: "cancelled" }
          });
          if (existingActive && !dbState.deletedRegistrationIds.includes(existingActive.id)) {
            res.status(200).json({
              success: true,
              registration: stripMongoId(existingActive),
              deduplicated: true
            });
            return;
          }
        }
        const existingLocalActive = dbState.registrations.find(
          (r) => (r.userEmail || "").toLowerCase() === userEmail && r.className === className && (r.preferredDate || "Next Available Batch") === preferredDate && r.status !== "cancelled" && !dbState.deletedRegistrationIds.includes(r.id)
        );
        if (existingLocalActive) {
          res.status(200).json({
            success: true,
            registration: existingLocalActive,
            deduplicated: true
          });
          return;
        }
      }
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      const generatedId = typeof body.id === "string" && body.id.trim() ? body.id.trim() : `REG-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      const newReg = {
        id: generatedId,
        registrationId: generatedId,
        ...idempotencyKey ? { idempotencyKey } : {},
        userId: typeof body.userId === "string" && body.userId.trim() ? body.userId.trim() : `guest_${Date.now()}`,
        userName,
        userEmail,
        userPhone,
        ...typeof body.classId === "string" && body.classId.trim() ? { classId: body.classId.trim() } : {},
        className,
        preferredDate,
        notes: typeof body.notes === "string" ? body.notes.trim() : "",
        status: body.status === "waitlist" || body.status === "cancelled" ? body.status : "registered",
        createdAt: nowIso,
        updatedAt: nowIso
      };
      if (mongoDb) {
        const mongoRegDoc = {
          ...newReg,
          registrationId: newReg.registrationId || newReg.id,
          preferredDate: newReg.preferredDate || "Next Available Batch",
          updatedAt: nowIso
        };
        await mongoDb.collection(MONGO_COLLECTIONS.CLASS_REGISTRATIONS).updateOne({ id: mongoRegDoc.id }, { $set: mongoRegDoc }, { upsert: true });
      }
      const latestDbState = ensureDatabaseInitialized();
      latestDbState.registrations = [newReg, ...latestDbState.registrations.filter((r) => r.id !== generatedId)];
      saveDatabaseAtomically(latestDbState);
      res.status(201).json({
        success: true,
        registration: newReg
      });
    } catch (err) {
      console.error("[POST /api/registrations] Error:", err);
      res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : "Failed to save class registration."
      });
    }
  });
  app2.patch("/api/registrations/:id", async (req, res) => {
    try {
      const targetId = String(req.params.id || "").trim();
      const updates = req.body || {};
      const dbState = ensureDatabaseInitialized();
      const mongoDb = await getMongoDatabase();
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      let currentReg;
      const idx = dbState.registrations.findIndex((r) => r.id === targetId || r.registrationId === targetId);
      if (idx !== -1) {
        currentReg = dbState.registrations[idx];
      } else if (mongoDb) {
        const fromMongo = await mongoDb.collection(MONGO_COLLECTIONS.CLASS_REGISTRATIONS).findOne({ $or: [{ id: targetId }, { registrationId: targetId }] });
        if (fromMongo) {
          currentReg = stripMongoId(fromMongo);
        }
      }
      if (!currentReg) {
        res.status(404).json({
          success: false,
          error: `Registration ${targetId} not found.`
        });
        return;
      }
      const updated = {
        ...currentReg,
        ...typeof updates.status === "string" ? { status: updates.status } : {},
        updatedAt: nowIso
      };
      if (mongoDb) {
        await mongoDb.collection(MONGO_COLLECTIONS.CLASS_REGISTRATIONS).updateOne(
          { $or: [{ id: targetId }, { registrationId: targetId }] },
          {
            $set: {
              status: updated.status,
              updatedAt: nowIso
            }
          }
        );
      }
      if (idx !== -1) {
        dbState.registrations[idx] = updated;
      } else {
        dbState.registrations.unshift(updated);
      }
      saveDatabaseAtomically(dbState);
      res.status(200).json({
        success: true,
        registration: updated
      });
    } catch (err) {
      console.error("[PATCH /api/registrations/:id] Error:", err);
      res.status(500).json({
        success: false,
        error: "Failed to update registration."
      });
    }
  });
  app2.delete("/api/registrations/:id", async (req, res) => {
    try {
      const targetId = String(req.params.id || "").trim();
      const dbState = ensureDatabaseInitialized();
      const mongoDb = await getMongoDatabase();
      if (mongoDb) {
        await mongoDb.collection(MONGO_COLLECTIONS.CLASS_REGISTRATIONS).deleteMany({ $or: [{ id: targetId }, { registrationId: targetId }] });
      }
      dbState.registrations = dbState.registrations.filter(
        (r) => r.id !== targetId && r.registrationId !== targetId
      );
      if (!dbState.deletedRegistrationIds.includes(targetId)) {
        dbState.deletedRegistrationIds.push(targetId);
      }
      saveDatabaseAtomically(dbState);
      res.status(200).json({
        success: true,
        deletedId: targetId
      });
    } catch (err) {
      console.error("[DELETE /api/registrations/:id] Error:", err);
      res.status(500).json({
        success: false,
        error: "Failed to delete registration."
      });
    }
  });
  const getAuthorizedAdminConfig = async () => {
    const dbState = ensureDatabaseInitialized();
    const mongoDb = await getMongoDatabase();
    let adminDoc = null;
    if (mongoDb) {
      try {
        const fromMongo = await mongoDb.collection(MONGO_COLLECTIONS.WEBSITE_SETTINGS).findOne({ settingKey: "admins" });
        if (fromMongo) {
          adminDoc = stripMongoId(fromMongo);
        }
      } catch {
      }
    }
    if (!adminDoc && dbState.websiteSettings?.admins) {
      adminDoc = dbState.websiteSettings.admins;
    }
    const defaultAdminList = [
      {
        email: "preethipreethu712@gmail.com",
        name: "Official Bakery Admin",
        role: "owner",
        addedAt: "2025-01-01T00:00:00.000Z",
        addedBy: "System / Master",
        isPrimary: true
      },
      {
        email: "vigneshsivan2001@gmail.com",
        name: "Vignesh Sivan (Founder)",
        role: "owner",
        addedAt: "2025-01-01T00:00:00.000Z",
        addedBy: "System / Master",
        isPrimary: true
      }
    ];
    const list = Array.isArray(adminDoc?.adminList) && adminDoc.adminList.length > 0 ? adminDoc.adminList.map((a) => {
      const copy = { ...a };
      delete copy.customPassword;
      delete copy.password;
      return copy;
    }) : defaultAdminList;
    const mergedEmails = Array.from(
      /* @__PURE__ */ new Set([
        ...PRIMARY_AUTHORIZED_ADMIN_EMAILS.map((e) => e.toLowerCase()),
        ...Array.isArray(adminDoc?.adminEmails) ? adminDoc.adminEmails.map((e) => e.toLowerCase()) : [],
        ...list.map((a) => a.email.toLowerCase())
      ])
    );
    return {
      settingKey: "admins",
      adminEmails: mergedEmails,
      adminList: list,
      ...adminDoc?.adminPasswordHash ? { adminPasswordHash: adminDoc.adminPasswordHash } : {},
      ...adminDoc?.adminPasswordSalt ? { adminPasswordSalt: adminDoc.adminPasswordSalt } : {},
      updatedAt: adminDoc?.updatedAt || (/* @__PURE__ */ new Date()).toISOString()
    };
  };
  const resolveExtraAdminEmails = async () => {
    const cfg = await getAuthorizedAdminConfig();
    return cfg.adminEmails || PRIMARY_AUTHORIZED_ADMIN_EMAILS;
  };
  const adminAuthMiddleware = requireAdminAuth(resolveExtraAdminEmails, firebaseConfig.projectId);
  app2.post("/api/admin/login", async (req, res) => {
    try {
      const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
      const password = typeof req.body?.password === "string" ? req.body.password : "";
      if (!email || !password) {
        res.status(400).json({
          success: false,
          error: "Please enter both your authorized admin email and password."
        });
        return;
      }
      const adminCfg = await getAuthorizedAdminConfig();
      if (!isAuthorizedAdminEmail(email, adminCfg.adminEmails || [])) {
        res.status(403).json({
          success: false,
          error: `Access denied: "${email}" is not in the authorized administrators list.`
        });
        return;
      }
      const bootstrapDefaultPwd = (process.env.ADMIN_BOOTSTRAP_PASSWORD || "admin123").trim();
      let isPasswordValid = false;
      if (adminCfg.adminPasswordHash && adminCfg.adminPasswordSalt) {
        isPasswordValid = verifyHashedAdminPassword(
          password,
          adminCfg.adminPasswordHash,
          adminCfg.adminPasswordSalt
        );
      } else {
        if (password === bootstrapDefaultPwd) {
          isPasswordValid = true;
          const { hash, salt } = hashAdminPassword(password);
          const sanitizedDoc = sanitizeWebsiteSettingForStorage("admins", {
            ...adminCfg,
            adminPasswordHash: hash,
            adminPasswordSalt: salt
          });
          const mongoDb = await getMongoDatabase();
          if (mongoDb) {
            await mongoDb.collection(MONGO_COLLECTIONS.WEBSITE_SETTINGS).updateOne({ settingKey: "admins" }, { $set: sanitizedDoc }, { upsert: true });
          }
          const dbState = ensureDatabaseInitialized();
          dbState.websiteSettings.admins = sanitizedDoc;
          saveDatabaseAtomically(dbState);
        }
      }
      if (!isPasswordValid) {
        res.status(401).json({
          success: false,
          error: "Incorrect admin password. Please enter the exact password configured by the administrator."
        });
        return;
      }
      const sessionToken = issueAdminSessionToken(email);
      res.status(200).json({
        success: true,
        valid: true,
        email,
        token: sessionToken,
        message: "Authenticated with server-verified admin credentials."
      });
    } catch (err) {
      console.error("[POST /api/admin/login] Error:", err);
      res.status(500).json({
        success: false,
        error: "Server error during admin authentication."
      });
    }
  });
  app2.post("/api/admin/google-login", async (req, res) => {
    try {
      const idToken = typeof req.body?.idToken === "string" ? req.body.idToken.trim() : "";
      let verifiedEmail = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
      if (idToken) {
        const verifiedJwt = await verifyFirebaseAdminIdToken(idToken, firebaseConfig.projectId);
        if (verifiedJwt.valid && verifiedJwt.email) {
          verifiedEmail = verifiedJwt.email;
        }
      }
      if (!verifiedEmail) {
        res.status(400).json({
          success: false,
          error: "Missing Google account email or Firebase ID token."
        });
        return;
      }
      const adminCfg = await getAuthorizedAdminConfig();
      if (!isAuthorizedAdminEmail(verifiedEmail, adminCfg.adminEmails || [])) {
        res.status(403).json({
          success: false,
          error: `Google account (${verifiedEmail}) is not authorized as an admin yet.`
        });
        return;
      }
      const sessionToken = issueAdminSessionToken(verifiedEmail);
      res.status(200).json({
        success: true,
        valid: true,
        email: verifiedEmail,
        token: sessionToken
      });
    } catch (err) {
      console.error("[POST /api/admin/google-login] Error:", err);
      res.status(500).json({
        success: false,
        error: "Failed to verify Google admin login."
      });
    }
  });
  app2.get("/api/admin/verify", adminAuthMiddleware, (req, res) => {
    res.status(200).json({
      success: true,
      valid: true,
      email: req.adminEmail,
      authMethod: req.adminAuthMethod,
      signingSecurity: getAdminSigningSecretStatus()
    });
  });
  app2.post("/api/admin/password", async (req, res) => {
    try {
      const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
      const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword.trim() : "";
      if (!currentPassword || !newPassword) {
        res.status(400).json({
          success: false,
          error: "Both current password and new password are required."
        });
        return;
      }
      if (newPassword.length < 6) {
        res.status(400).json({
          success: false,
          error: "New password must be at least 6 characters long for security."
        });
        return;
      }
      const adminCfg = await getAuthorizedAdminConfig();
      const bootstrapDefaultPwd = (process.env.ADMIN_BOOTSTRAP_PASSWORD || "admin123").trim();
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
          error: "Current password is incorrect. Please enter your active admin password."
        });
        return;
      }
      const { hash, salt } = hashAdminPassword(newPassword);
      const sanitizedDoc = sanitizeWebsiteSettingForStorage("admins", {
        ...adminCfg,
        adminPasswordHash: hash,
        adminPasswordSalt: salt
      });
      const mongoDb = await getMongoDatabase();
      if (mongoDb) {
        await mongoDb.collection(MONGO_COLLECTIONS.WEBSITE_SETTINGS).updateOne({ settingKey: "admins" }, { $set: sanitizedDoc }, { upsert: true });
      }
      const dbState = ensureDatabaseInitialized();
      dbState.websiteSettings.admins = sanitizedDoc;
      saveDatabaseAtomically(dbState);
      res.status(200).json({
        success: true,
        message: "Admin master password updated securely (hashed with scrypt)!"
      });
    } catch (err) {
      console.error("[POST /api/admin/password] Error:", err);
      res.status(500).json({
        success: false,
        error: "Failed to update admin password."
      });
    }
  });
  app2.get("/api/products", async (_req, res) => {
    try {
      const dbState = ensureDatabaseInitialized();
      const byId = /* @__PURE__ */ new Map();
      for (const loc of dbState.products) {
        if (!dbState.deletedProductIds.includes(loc.id)) {
          byId.set(loc.id, loc);
        }
      }
      try {
        const mongoDb = await getMongoDatabase();
        if (mongoDb) {
          const mongoProducts = await mongoDb.collection(MONGO_COLLECTIONS.PRODUCTS).find({}).sort({ sortOrder: 1 }).toArray();
          for (const mp of mongoProducts) {
            const clean = stripMongoId(mp);
            if (!dbState.deletedProductIds.includes(clean.id)) {
              byId.set(clean.id, clean);
            }
          }
        }
      } catch {
      }
      const allProducts = Array.from(byId.values()).sort(
        (a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999)
      );
      const menuItems = allProducts.filter((p) => p.category !== "custom_showcase");
      const customItems = allProducts.filter((p) => p.category === "custom_showcase");
      res.status(200).json({
        success: true,
        products: allProducts,
        menuItems,
        customItems,
        deletedProductIds: dbState.deletedProductIds,
        total: allProducts.length
      });
    } catch (err) {
      console.error("[GET /api/products] Error:", err);
      res.status(500).json({
        success: false,
        error: "Failed to retrieve products."
      });
    }
  });
  const handleUpsertProduct = async (req, res) => {
    try {
      const body = req.body || {};
      const id = String(req.params.id || body.id || `item-${Date.now()}`).trim();
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) {
        res.status(400).json({
          success: false,
          error: "Product name is required."
        });
        return;
      }
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      const dbState = ensureDatabaseInitialized();
      const mongoDb = await getMongoDatabase();
      let existingDoc = dbState.products.find((p) => p.id === id);
      if (!existingDoc && mongoDb) {
        const fromMongo = await mongoDb.collection(MONGO_COLLECTIONS.PRODUCTS).findOne({ id });
        if (fromMongo) existingDoc = stripMongoId(fromMongo);
      }
      const productDoc = {
        ...existingDoc || {},
        ...body,
        id,
        name,
        subtitle: typeof body.subtitle === "string" ? body.subtitle : existingDoc?.subtitle || "",
        description: typeof body.description === "string" ? body.description : existingDoc?.description || "",
        category: body.category || existingDoc?.category || "brownie",
        price: typeof body.price === "string" ? body.price : existingDoc?.price || "\u20B9150",
        image: typeof body.image === "string" ? body.image : existingDoc?.image || "",
        cocoaPercentage: typeof body.cocoaPercentage === "string" ? body.cocoaPercentage : existingDoc?.cocoaPercentage || "70% Dark",
        flavorNotes: Array.isArray(body.flavorNotes) ? body.flavorNotes : existingDoc?.flavorNotes || ["Artisan Handcrafted"],
        enabled: body.enabled !== void 0 ? Boolean(body.enabled) : existingDoc?.enabled !== false,
        sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : typeof existingDoc?.sortOrder === "number" ? existingDoc.sortOrder : 999,
        createdAt: existingDoc?.createdAt || nowIso,
        updatedAt: nowIso
      };
      if (mongoDb) {
        await mongoDb.collection(MONGO_COLLECTIONS.PRODUCTS).updateOne({ id }, { $set: productDoc }, { upsert: true });
      }
      dbState.deletedProductIds = dbState.deletedProductIds.filter((delId) => delId !== id);
      dbState.products = [productDoc, ...dbState.products.filter((p) => p.id !== id)];
      saveDatabaseAtomically(dbState);
      res.status(200).json({
        success: true,
        product: productDoc
      });
    } catch (err) {
      console.error("[UPSERT /api/products] Error:", err);
      res.status(500).json({
        success: false,
        error: "Failed to save product to database."
      });
    }
  };
  app2.post("/api/products", handleUpsertProduct);
  app2.put("/api/products/:id", handleUpsertProduct);
  app2.patch("/api/products/:id", handleUpsertProduct);
  app2.delete("/api/products/:id", async (req, res) => {
    try {
      const targetId = String(req.params.id || "").trim();
      const dbState = ensureDatabaseInitialized();
      const mongoDb = await getMongoDatabase();
      if (mongoDb) {
        await mongoDb.collection(MONGO_COLLECTIONS.PRODUCTS).deleteMany({ id: targetId });
      }
      dbState.products = dbState.products.filter((p) => p.id !== targetId);
      if (!dbState.deletedProductIds.includes(targetId)) {
        dbState.deletedProductIds.push(targetId);
      }
      saveDatabaseAtomically(dbState);
      res.status(200).json({
        success: true,
        deletedId: targetId
      });
    } catch (err) {
      console.error("[DELETE /api/products/:id] Error:", err);
      res.status(500).json({
        success: false,
        error: "Failed to delete product."
      });
    }
  });
  const handleGetCategoriesAndClasses = async (_req, res) => {
    try {
      const dbState = ensureDatabaseInitialized();
      const byId = /* @__PURE__ */ new Map();
      for (const loc of dbState.categories) {
        if (!dbState.deletedClassIds.includes(loc.id)) {
          byId.set(loc.id, loc);
        }
      }
      try {
        const mongoDb = await getMongoDatabase();
        if (mongoDb) {
          const mongoCats = await mongoDb.collection(MONGO_COLLECTIONS.CATEGORIES).find({}).sort({ sortOrder: 1 }).toArray();
          for (const mc of mongoCats) {
            const clean = stripMongoId(mc);
            if (!dbState.deletedClassIds.includes(clean.id)) {
              byId.set(clean.id, clean);
            }
          }
        }
      } catch {
      }
      const allDocs = Array.from(byId.values());
      const classes = allDocs.filter((c) => c.type === "baking_class" || !c.type);
      const menuCategories = allDocs.filter((c) => c.type === "menu_category");
      res.status(200).json({
        success: true,
        categories: allDocs,
        menuCategories,
        classes,
        deletedClassIds: dbState.deletedClassIds,
        total: allDocs.length
      });
    } catch (err) {
      console.error("[GET /api/categories] Error:", err);
      res.status(500).json({
        success: false,
        error: "Failed to retrieve categories and baking classes."
      });
    }
  };
  app2.get("/api/categories", handleGetCategoriesAndClasses);
  app2.get("/api/classes", handleGetCategoriesAndClasses);
  const handleUpsertCategoryOrClass = async (req, res) => {
    try {
      const body = req.body || {};
      const id = String(req.params.id || body.id || `class-${Date.now()}`).trim();
      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (!title) {
        res.status(400).json({
          success: false,
          error: "Class or category title is required."
        });
        return;
      }
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      const dbState = ensureDatabaseInitialized();
      const mongoDb = await getMongoDatabase();
      let existingDoc = dbState.categories.find((c) => c.id === id);
      if (!existingDoc && mongoDb) {
        const fromMongo = await mongoDb.collection(MONGO_COLLECTIONS.CATEGORIES).findOne({ id });
        if (fromMongo) existingDoc = stripMongoId(fromMongo);
      }
      const docToSave = {
        ...existingDoc || {},
        ...body,
        id,
        type: body.type === "menu_category" ? "menu_category" : "baking_class",
        title,
        description: typeof body.description === "string" ? body.description.replace(/\r\n?/g, "\n") : existingDoc?.description || "",
        dates: Array.isArray(body.dates) ? body.dates : existingDoc?.dates || [],
        updatedAt: nowIso
      };
      if (mongoDb) {
        await mongoDb.collection(MONGO_COLLECTIONS.CATEGORIES).updateOne({ id }, { $set: docToSave }, { upsert: true });
      }
      dbState.deletedClassIds = dbState.deletedClassIds.filter((delId) => delId !== id);
      dbState.categories = [docToSave, ...dbState.categories.filter((c) => c.id !== id)];
      saveDatabaseAtomically(dbState);
      res.status(200).json({
        success: true,
        category: docToSave,
        bakingClass: docToSave
      });
    } catch (err) {
      console.error("[UPSERT /api/classes] Error:", err);
      res.status(500).json({
        success: false,
        error: "Failed to save class or category."
      });
    }
  };
  app2.post("/api/classes", handleUpsertCategoryOrClass);
  app2.put("/api/classes/:id", handleUpsertCategoryOrClass);
  app2.patch("/api/classes/:id", handleUpsertCategoryOrClass);
  app2.post("/api/categories", handleUpsertCategoryOrClass);
  app2.put("/api/categories/:id", handleUpsertCategoryOrClass);
  app2.patch("/api/categories/:id", handleUpsertCategoryOrClass);
  const handleDeleteCategoryOrClass = async (req, res) => {
    try {
      const targetId = String(req.params.id || "").trim();
      const dbState = ensureDatabaseInitialized();
      const mongoDb = await getMongoDatabase();
      if (mongoDb) {
        await mongoDb.collection(MONGO_COLLECTIONS.CATEGORIES).deleteMany({ id: targetId });
      }
      dbState.categories = dbState.categories.filter((c) => c.id !== targetId);
      if (!dbState.deletedClassIds.includes(targetId)) {
        dbState.deletedClassIds.push(targetId);
      }
      saveDatabaseAtomically(dbState);
      res.status(200).json({
        success: true,
        deletedId: targetId
      });
    } catch (err) {
      console.error("[DELETE /api/classes/:id] Error:", err);
      res.status(500).json({
        success: false,
        error: "Failed to delete class or category."
      });
    }
  };
  app2.delete("/api/classes/:id", handleDeleteCategoryOrClass);
  app2.delete("/api/categories/:id", handleDeleteCategoryOrClass);
  app2.get("/api/settings", async (_req, res) => {
    try {
      const dbState = ensureDatabaseInitialized();
      const settingsMap = {
        ...dbState.websiteSettings || {}
      };
      try {
        const mongoDb = await getMongoDatabase();
        if (mongoDb) {
          const docs = await mongoDb.collection(MONGO_COLLECTIONS.WEBSITE_SETTINGS).find({}).toArray();
          for (const d of docs) {
            const clean = stripMongoId(d);
            settingsMap[clean.settingKey] = clean;
          }
        }
      } catch {
      }
      const adminCfg = await getAuthorizedAdminConfig();
      const hasCustomPassword = Boolean(adminCfg.adminPasswordHash && adminCfg.adminPasswordSalt);
      const safeAdmins = {
        settingKey: "admins",
        adminEmails: adminCfg.adminEmails,
        adminList: adminCfg.adminList,
        hasCustomPassword,
        updatedAt: adminCfg.updatedAt
      };
      res.status(200).json({
        success: true,
        general: settingsMap.general || null,
        achievements: settingsMap.achievements || null,
        admins: safeAdmins,
        settings: {
          general: settingsMap.general || null,
          achievements: settingsMap.achievements || null,
          admins: safeAdmins
        }
      });
    } catch (err) {
      console.error("[GET /api/settings] Error:", err);
      res.status(500).json({
        success: false,
        error: "Failed to retrieve website settings."
      });
    }
  });
  const handleUpdateSetting = async (req, res) => {
    try {
      const rawKey = String(req.params.settingKey || "").trim();
      if (rawKey !== "general" && rawKey !== "achievements" && rawKey !== "admins") {
        res.status(400).json({
          success: false,
          error: "Invalid settingKey. Allowed values: general, achievements, admins."
        });
        return;
      }
      const dbState = ensureDatabaseInitialized();
      const mongoDb = await getMongoDatabase();
      let existingDoc = dbState.websiteSettings?.[rawKey];
      if (!existingDoc && mongoDb) {
        const fromMongo = await mongoDb.collection(MONGO_COLLECTIONS.WEBSITE_SETTINGS).findOne({ settingKey: rawKey });
        if (fromMongo) existingDoc = stripMongoId(fromMongo);
      }
      const sanitized = sanitizeWebsiteSettingForStorage(rawKey, {
        ...existingDoc || {},
        ...req.body || {},
        // Preserve existing scrypt hash & salt when updating admin team list
        ...existingDoc?.adminPasswordHash ? { adminPasswordHash: existingDoc.adminPasswordHash } : {},
        ...existingDoc?.adminPasswordSalt ? { adminPasswordSalt: existingDoc.adminPasswordSalt } : {}
      });
      if (mongoDb) {
        await mongoDb.collection(MONGO_COLLECTIONS.WEBSITE_SETTINGS).updateOne({ settingKey: rawKey }, { $set: sanitized }, { upsert: true });
      }
      dbState.websiteSettings[rawKey] = sanitized;
      saveDatabaseAtomically(dbState);
      const responseCopy = { ...sanitized };
      delete responseCopy.adminPasswordHash;
      delete responseCopy.adminPasswordSalt;
      res.status(200).json({
        success: true,
        setting: responseCopy
      });
    } catch (err) {
      console.error("[PUT /api/settings/:settingKey] Error:", err);
      res.status(500).json({
        success: false,
        error: "Failed to update website settings."
      });
    }
  };
  app2.put("/api/settings/:settingKey", handleUpdateSetting);
  app2.patch("/api/settings/:settingKey", handleUpdateSetting);
  app2.post("/api/admin/migrate", async (_req, res) => {
    try {
      const dbState = ensureDatabaseInitialized();
      const { report, updatedLocalDbState } = await runFirebaseToMongoMigration({
        dataDir: DATA_DIR,
        projectId: firebaseConfig.projectId,
        databaseId: firebaseConfig.firestoreDatabaseId || "(default)",
        localDbState: dbState
      });
      saveDatabaseAtomically(updatedLocalDbState);
      res.status(200).json(report);
    } catch (err) {
      console.error("[POST /api/admin/migrate] Error:", err);
      res.status(500).json({
        success: false,
        error: err?.message || "Migration failed."
      });
    }
  });
  app2.get("/api/admin/migration-status", async (_req, res) => {
    try {
      const backupFilePath = path2.join(DATA_DIR, "firestore_backup.json");
      const backupExists = fs2.existsSync(backupFilePath);
      const backupSizeBytes = backupExists ? fs2.statSync(backupFilePath).size : 0;
      const mongoDb = await getMongoDatabase();
      if (!mongoDb) {
        res.status(503).json({
          success: false,
          error: "MongoDB Atlas connection unavailable."
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
        countersDocInMongo
      ] = await Promise.all([
        mongoDb.collection(MONGO_COLLECTIONS.PRODUCTS).countDocuments(),
        mongoDb.collection(MONGO_COLLECTIONS.CATEGORIES).countDocuments(),
        mongoDb.collection(MONGO_COLLECTIONS.CATEGORIES).countDocuments({ type: "menu_category" }),
        mongoDb.collection(MONGO_COLLECTIONS.CATEGORIES).countDocuments({ type: "baking_class" }),
        mongoDb.collection(MONGO_COLLECTIONS.WEBSITE_SETTINGS).countDocuments(),
        mongoDb.collection(MONGO_COLLECTIONS.USERS).countDocuments(),
        mongoDb.collection(MONGO_COLLECTIONS.ORDERS).countDocuments(),
        mongoDb.collection(MONGO_COLLECTIONS.BOOKINGS).countDocuments(),
        mongoDb.collection(MONGO_COLLECTIONS.CLASS_REGISTRATIONS).countDocuments(),
        mongoDb.collection(MONGO_COLLECTIONS.WEBSITE_SETTINGS).findOne({ settingKey: "admins" }),
        mongoDb.collection(MONGO_COLLECTIONS.WEBSITE_SETTINGS).findOne({ settingKey: "counters" })
      ]);
      const plainTextPasswordPresent = Boolean(
        adminsDocInMongo && ("adminPassword" in adminsDocInMongo || "masterPassword" in adminsDocInMongo || "password" in adminsDocInMongo || "plainPassword" in adminsDocInMongo)
      );
      res.status(200).json({
        success: true,
        databaseName: mongoDb.databaseName,
        lastOrderSequence: countersDocInMongo?.lastOrderSequence ?? 1024,
        backup: {
          exists: backupExists,
          backupFilePath: "/data/firestore_backup.json",
          backupSizeBytes
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
          class_registrations: registrationsCount
        },
        securityAudit: {
          plainTextAdminPasswordRemoved: !plainTextPasswordPresent,
          scryptPasswordHashPresent: Boolean(
            adminsDocInMongo?.adminPasswordHash && adminsDocInMongo?.adminPasswordSalt
          ),
          firebaseAuthPreserved: true,
          firebaseDataUntouched: true
        }
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err?.message || "Failed to check migration status."
      });
    }
  });
  app2.post("/api/admin/cleanup-test-records", async (_req, res) => {
    try {
      const dbState = ensureDatabaseInitialized();
      const mongoDb = await getMongoDatabase();
      const testPrefixRegex = /^TEST_PHASE(8|9)_/;
      let deletedOrders = 0;
      let deletedBookings = 0;
      let deletedRegistrations = 0;
      let deletedUsers = 0;
      if (mongoDb) {
        const testOrdersDocs = await mongoDb.collection(MONGO_COLLECTIONS.ORDERS).find({
          $or: [{ userId: testPrefixRegex }, { idempotencyKey: testPrefixRegex }]
        }).project({ orderId: 1 }).toArray();
        const testOrderMirrorIds = testOrdersDocs.map((o) => `order_${o.orderId}`);
        const [ordDel, bkgDel, regDel, usrDel] = await Promise.all([
          mongoDb.collection(MONGO_COLLECTIONS.ORDERS).deleteMany({
            $or: [{ userId: testPrefixRegex }, { idempotencyKey: testPrefixRegex }]
          }),
          mongoDb.collection(MONGO_COLLECTIONS.BOOKINGS).deleteMany({
            $or: [
              { userId: testPrefixRegex },
              { idempotencyKey: testPrefixRegex },
              ...testOrderMirrorIds.length > 0 ? [{ id: { $in: testOrderMirrorIds } }] : []
            ]
          }),
          mongoDb.collection(MONGO_COLLECTIONS.CLASS_REGISTRATIONS).deleteMany({
            $or: [{ userId: testPrefixRegex }, { idempotencyKey: testPrefixRegex }]
          }),
          mongoDb.collection(MONGO_COLLECTIONS.USERS).deleteMany({
            uid: testPrefixRegex
          })
        ]);
        deletedOrders = ordDel.deletedCount;
        deletedBookings = bkgDel.deletedCount;
        deletedRegistrations = regDel.deletedCount;
        deletedUsers = usrDel.deletedCount;
      }
      const localTestOrderIds = new Set(
        dbState.orders.filter(
          (o) => testPrefixRegex.test(o.userId || "") || testPrefixRegex.test(o.idempotencyKey || "")
        ).map((o) => o.orderId)
      );
      dbState.orders = dbState.orders.filter(
        (o) => !testPrefixRegex.test(o.userId || "") && !testPrefixRegex.test(o.idempotencyKey || "")
      );
      dbState.inquiries = dbState.inquiries.filter(
        (inq) => !testPrefixRegex.test(inq.userId || "") && !testPrefixRegex.test(inq.idempotencyKey || "") && !(inq.orderId && localTestOrderIds.has(inq.orderId))
      );
      dbState.registrations = dbState.registrations.filter(
        (reg) => !testPrefixRegex.test(reg.userId || "") && !testPrefixRegex.test(reg.idempotencyKey || "")
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
          users: deletedUsers
        }
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err?.message || "Failed to clean up test records."
      });
    }
  });
  return app2;
}
async function startServer(app2) {
  const PORT = Number(process.env.PORT) || 3e3;
  const distPath = path2.join(__dirname, "dist");
  const isProd = process.env.NODE_ENV === "production" && fs2.existsSync(distPath);
  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null
      },
      appType: "spa"
    });
    app2.use(vite.middlewares);
  } else {
    app2.use(express.static(distPath));
    app2.get("*", (_req, res) => {
      res.sendFile(path2.join(distPath, "index.html"));
    });
  }
  app2.listen(PORT, "0.0.0.0", () => {
    console.log(`[BrownieGirlCakes Server] Full-stack Express + Order Persistence API listening on http://0.0.0.0:${PORT}`);
  });
}
var app = createExpressApiApp();
var server_default = app;
var normalizedEntryFilename = __filename.replace(/\\/g, "/");
var isServerlessRuntime = Boolean(process.env.VERCEL) || normalizedEntryFilename.endsWith("/api/index.js");
if (!isServerlessRuntime) {
  startServer(app);
}
export {
  createExpressApiApp,
  server_default as default
};
