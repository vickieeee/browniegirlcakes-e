import { MongoClient, Db, ServerApiVersion } from 'mongodb';
import dotenv from 'dotenv';
import { ensureMongoIndexes, MONGO_COLLECTIONS } from './mongoSchema';

dotenv.config();

const DEFAULT_DB_NAME = 'browniegirlcakes';

declare global {
  // Preserve single MongoClient connection pool across hot reloads & warm serverless invocations
  // eslint-disable-next-line no-var
  var __bgcMongoClientPromise: Promise<MongoClient> | undefined;
  // eslint-disable-next-line no-var
  var __bgcMongoLastUri: string | undefined;
  // eslint-disable-next-line no-var
  var __bgcMongoFailedUri: string | undefined;
  // eslint-disable-next-line no-var
  var __bgcMongoLastErrorMsg: string | undefined;
}

/**
 * Automatically normalizes beginner MongoDB Atlas connection strings:
 * - Removes accidental `MONGODB_URI=` prefix or surrounding quotes
 * - Strips accidental `<` and `>` brackets wrapped around the username or password
 * - Safely URL-encodes special characters (@, :, #, /, ?, %) inside the password
 */
export function normalizeMongoUri(rawInput: string | undefined): string {
  if (!rawInput) return '';
  let uri = rawInput.trim();

  // Strip accidental key prefix
  if (/^MONGODB_URI\s*=/i.test(uri)) {
    uri = uri.replace(/^MONGODB_URI\s*=\s*/i, '').trim();
  }

  // Strip surrounding quotes
  if ((uri.startsWith('"') && uri.endsWith('"')) || (uri.startsWith("'") && uri.endsWith("'"))) {
    uri = uri.slice(1, -1).trim();
  }

  const schemeMatch = uri.match(/^(mongodb(?:\+srv)?:\/\/)(.*)$/i);
  if (!schemeMatch) return uri;

  const scheme = schemeMatch[1];
  const remainder = schemeMatch[2];

  // Separate credentials from host at the LAST '@' before the first '/'
  const slashIdx = remainder.indexOf('/');
  const authorityPart = slashIdx === -1 ? remainder : remainder.slice(0, slashIdx);
  const pathAndQueryPart = slashIdx === -1 ? '' : remainder.slice(slashIdx);

  const lastAtIdx = authorityPart.lastIndexOf('@');
  if (lastAtIdx === -1) return uri;

  const userInfo = authorityPart.slice(0, lastAtIdx);
  const hostPart = authorityPart.slice(lastAtIdx + 1);

  const firstColonIdx = userInfo.indexOf(':');
  if (firstColonIdx === -1) return uri;

  let rawUser = userInfo.slice(0, firstColonIdx).trim();
  let rawPass = userInfo.slice(firstColonIdx + 1).trim();

  // Strip accidental < > around username or password (unless placeholder <db_password>)
  if (rawUser.startsWith('<') && rawUser.endsWith('>') && rawUser.length > 2) {
    rawUser = rawUser.slice(1, -1).trim();
  }
  if (
    rawPass.startsWith('<') &&
    rawPass.endsWith('>') &&
    rawPass.length > 2 &&
    !/^<(db_password|password)>$/i.test(rawPass)
  ) {
    rawPass = rawPass.slice(1, -1).trim();
  }

  // Leave unconfigured placeholder intact so isMongoConfigured() detects it
  if (/^<?(db_password|password)>?$/i.test(rawPass)) {
    return `${scheme}${rawUser}:<db_password>@${hostPart}${pathAndQueryPart}`;
  }

  const safeEncode = (val: string): string => {
    try {
      return encodeURIComponent(decodeURIComponent(val));
    } catch {
      return encodeURIComponent(val);
    }
  };

  return `${scheme}${safeEncode(rawUser)}:${safeEncode(rawPass)}@${hostPart}${pathAndQueryPart}`;
}

export function isMongoConfigured(): boolean {
  const uri = normalizeMongoUri(process.env.MONGODB_URI);
  return Boolean(
    uri &&
      uri !== 'MY_MONGODB_URI' &&
      !uri.includes('<db_password>') &&
      (uri.startsWith('mongodb+srv://') || uri.startsWith('mongodb://'))
  );
}

export function getMongoDbName(): string {
  return (process.env.MONGODB_DB_NAME || DEFAULT_DB_NAME).trim() || DEFAULT_DB_NAME;
}

export class MongoPersistenceError extends Error {
  public readonly statusCode: number;
  public readonly attempts: number;

  constructor(message: string, statusCode = 503, attempts = 1) {
    super(message);
    this.name = 'MongoPersistenceError';
    this.statusCode = statusCode;
    this.attempts = attempts;
  }
}

export function sanitizeMongoErrorMessage(err: unknown): string {
  const rawMsg = err instanceof Error ? err.message : String(err);
  return rawMsg.replace(/mongodb(\+srv)?:\/\/[^\s]+/gi, '[REDACTED_MONGODB_URI]');
}

function isNonRetryableMongoError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const anyErr = err as { code?: number | string; message?: string; statusCode?: number };
  const msg = String(anyErr.message || '');
  // Authentication failure or explicit 4xx validation/not-found errors should not be retried
  if (/bad auth|authentication failed/i.test(msg)) return true;
  if (typeof anyErr.statusCode === 'number' && anyErr.statusCode >= 400 && anyErr.statusCode < 500) {
    return true;
  }
  return false;
}

const sleepMs = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Internal helper that connects and returns the MongoClient.
 * Caches auth failure per URI so bad credentials do not spam network retries or console errors.
 */
async function connectMongoClient(): Promise<MongoClient> {
  const uri = normalizeMongoUri(process.env.MONGODB_URI);

  if (globalThis.__bgcMongoFailedUri === uri && globalThis.__bgcMongoLastErrorMsg) {
    throw new Error(globalThis.__bgcMongoLastErrorMsg);
  }

  if (!globalThis.__bgcMongoClientPromise || globalThis.__bgcMongoLastUri !== uri) {
    const client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
      maxPoolSize: 10,
      minPoolSize: 1,
      connectTimeoutMS: 8000,
      serverSelectionTimeoutMS: 8000,
    });

    globalThis.__bgcMongoLastUri = uri;
    globalThis.__bgcMongoClientPromise = client
      .connect()
      .then((connected) => {
        globalThis.__bgcMongoFailedUri = undefined;
        globalThis.__bgcMongoLastErrorMsg = undefined;
        return connected;
      })
      .catch((err) => {
        globalThis.__bgcMongoClientPromise = undefined;
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

export interface MongoRetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
}

/**
 * Connects to the active environment's MongoDB database (`browniegirl` in Dev, `browniegirlcakes` in Prod)
 * with bounded retries on transient connection failures. Throws MongoPersistenceError (HTTP 503) if unreachable.
 */
export async function getAuthoritativeMongoDatabase(
  options: MongoRetryOptions = {}
): Promise<Db> {
  const maxAttempts = Math.max(1, Math.min(5, options.maxAttempts ?? 3));
  const baseDelayMs = Math.max(50, options.baseDelayMs ?? 250);
  const dbName = getMongoDbName();

  if (!isMongoConfigured()) {
    throw new MongoPersistenceError(
      `Database unavailable: MONGODB_URI is not configured for database "${dbName}".`,
      503,
      0
    );
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const connectedClient = await connectMongoClient();
      const db = connectedClient.db(dbName);
      await ensureMongoIndexes(db);
      return db;
    } catch (err) {
      lastError = err;
      if (isNonRetryableMongoError(err) || attempt === maxAttempts) {
        break;
      }
      globalThis.__bgcMongoClientPromise = undefined;
      await sleepMs(baseDelayMs * attempt);
    }
  }

  throw new MongoPersistenceError(
    `Database unavailable (${dbName}): ${sanitizeMongoErrorMessage(lastError)}`,
    503,
    maxAttempts
  );
}

/**
 * Executes an authoritative MongoDB operation with bounded retries on transient failures.
 * Never swallows errors or falls back to temporary /tmp storage.
 */
export async function withMongoRetry<T>(
  operation: (db: Db, attempt: number) => Promise<T>,
  options: MongoRetryOptions = {}
): Promise<T> {
  const maxAttempts = Math.max(1, Math.min(5, options.maxAttempts ?? 3));
  const baseDelayMs = Math.max(50, options.baseDelayMs ?? 250);
  const dbName = getMongoDbName();

  if (!isMongoConfigured()) {
    throw new MongoPersistenceError(
      `Database unavailable: MONGODB_URI is not configured for database "${dbName}".`,
      503,
      0
    );
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const connectedClient = await connectMongoClient();
      const db = connectedClient.db(dbName);
      await ensureMongoIndexes(db);
      return await operation(db, attempt);
    } catch (err) {
      lastError = err;
      if (isNonRetryableMongoError(err) || attempt === maxAttempts) {
        break;
      }
      // If connection topology closed or timed out, reset cached client promise before retrying
      const msg = sanitizeMongoErrorMessage(err);
      if (/topology|closed|reset|timeout|network|server selection/i.test(msg)) {
        globalThis.__bgcMongoClientPromise = undefined;
      }
      await sleepMs(baseDelayMs * attempt);
    }
  }

  if (lastError instanceof MongoPersistenceError) {
    throw lastError;
  }

  throw new MongoPersistenceError(
    `Database operation failed after ${maxAttempts} attempt(s) on "${dbName}": ${sanitizeMongoErrorMessage(
      lastError
    )}`,
    503,
    maxAttempts
  );
}

/**
 * Returns a cached, reusable MongoDB database instance with all 7 collection indexes initialized.
 * Uses bounded retries before returning null if MONGODB_URI is not configured or unreachable.
 */
export async function getMongoDatabase(): Promise<Db | null> {
  if (!isMongoConfigured()) {
    return null;
  }

  try {
    return await getAuthoritativeMongoDatabase({ maxAttempts: 2, baseDelayMs: 200 });
  } catch {
    return null;
  }
}

export { MONGO_COLLECTIONS };

/**
 * Verifies live connectivity to MongoDB Atlas without exposing credentials.
 */
export async function checkMongoConnectionHealth(): Promise<{
  configured: boolean;
  connected: boolean;
  databaseName: string;
  message: string;
}> {
  const dbName = getMongoDbName();
  if (!isMongoConfigured()) {
    return {
      configured: false,
      connected: false,
      databaseName: dbName,
      message:
        'MONGODB_URI is not yet set in environment variables (or still contains <db_password>).',
    };
  }

  try {
    const db = await getAuthoritativeMongoDatabase({ maxAttempts: 2, baseDelayMs: 200 });
    await db.command({ ping: 1 });
    return {
      configured: true,
      connected: true,
      databaseName: dbName,
      message: `Successfully connected to MongoDB Atlas database "${dbName}".`,
    };
  } catch (err) {
    const safeMsg = sanitizeMongoErrorMessage(err);
    return {
      configured: true,
      connected: false,
      databaseName: dbName,
      message: `MongoDB Atlas connection error (${safeMsg}).`,
    };
  }
}
