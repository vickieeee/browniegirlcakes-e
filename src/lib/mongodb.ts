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

/**
 * Returns a cached, reusable MongoDB database instance with all 7 collection indexes initialized.
 * Prevents opening new connections on every API request in both Express and Vercel Serverless.
 * Returns null silently if MONGODB_URI is not configured or temporarily unreachable.
 */
export async function getMongoDatabase(): Promise<Db | null> {
  if (!isMongoConfigured()) {
    return null;
  }

  try {
    const connectedClient = await connectMongoClient();
    const db = connectedClient.db(getMongoDbName());
    await ensureMongoIndexes(db);
    return db;
  } catch {
    // Silently fall back to persistent server storage without triggering runtime console error alerts
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
        'MONGODB_URI is not yet set in environment variables (or still contains <db_password>). Using local server fallback until configured.',
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
      message: `Successfully connected to MongoDB Atlas database "${dbName}".`,
    };
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    // Sanitize any potential URI substrings from error messages
    const safeMsg = rawMsg.replace(/mongodb(\+srv)?:\/\/[^\s]+/gi, '[REDACTED_MONGODB_URI]');
    return {
      configured: true,
      connected: false,
      databaseName: dbName,
      message: `MongoDB Atlas standby (${safeMsg}) — using persistent server storage until database user password matches in Atlas.`,
    };
  }
}
