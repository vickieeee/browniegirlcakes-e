import crypto from 'crypto';
import dotenv from 'dotenv';
import { Request, Response, NextFunction } from 'express';

dotenv.config();

export const PRIMARY_AUTHORIZED_ADMIN_EMAILS = [
  'vigneshsivan2001@gmail.com',
  'preethipreethu712@gmail.com',
];

export const PRIMARY_ADMIN_EMAILS = PRIMARY_AUTHORIZED_ADMIN_EMAILS;

const DEFAULT_FIREBASE_PROJECT_ID = 'extreme-spark-dxctm';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

declare global {
  // eslint-disable-next-line no-var
  var __bgcRuntimeHmacSecret: string | undefined;
  // eslint-disable-next-line no-var
  var __bgcGooglePublicCertsCache: { certs: Record<string, string>; expiresAt: number } | undefined;
}

/**
 * Resolves the server-side HMAC-SHA256 signing secret from environment variables.
 * Never uses a static hardcoded fallback key in source code.
 */
function resolveAdminHmacSecret(): {
  secret: string;
  source: 'ADMIN_SESSION_SECRET' | 'MONGODB_URI_DERIVED' | 'RUNTIME_EPHEMERAL_256BIT';
  configuredViaEnv: boolean;
} {
  const explicitSecret = (process.env.ADMIN_SESSION_SECRET || '').trim();
  if (explicitSecret && explicitSecret !== 'MY_ADMIN_SESSION_SECRET' && explicitSecret.length >= 16) {
    return {
      secret: explicitSecret,
      source: 'ADMIN_SESSION_SECRET',
      configuredViaEnv: true,
    };
  }

  const mongoUri = (process.env.MONGODB_URI || '').trim();
  if (
    mongoUri &&
    mongoUri !== 'MY_MONGODB_URI' &&
    !mongoUri.includes('<db_password>') &&
    (mongoUri.startsWith('mongodb+srv://') || mongoUri.startsWith('mongodb://'))
  ) {
    const derived = crypto.scryptSync(mongoUri, 'bgc_admin_hmac_kdf_v1', 32).toString('hex');
    return {
      secret: derived,
      source: 'MONGODB_URI_DERIVED',
      configuredViaEnv: true,
    };
  }

  if (!globalThis.__bgcRuntimeHmacSecret) {
    globalThis.__bgcRuntimeHmacSecret = crypto.randomBytes(32).toString('hex');
  }

  return {
    secret: globalThis.__bgcRuntimeHmacSecret,
    source: 'RUNTIME_EPHEMERAL_256BIT',
    configuredViaEnv: false,
  };
}

/**
 * Returns non-sensitive metadata about how the HMAC session signing secret is configured.
 */
export function getAdminSigningSecretStatus(): {
  algorithm: 'HMAC-SHA256';
  configuredViaEnv: boolean;
  source: 'ADMIN_SESSION_SECRET' | 'MONGODB_URI_DERIVED' | 'RUNTIME_EPHEMERAL_256BIT';
  keyLengthBits: number;
} {
  const resolved = resolveAdminHmacSecret();
  return {
    algorithm: 'HMAC-SHA256',
    configuredViaEnv: resolved.configuredViaEnv,
    source: resolved.source,
    keyLengthBits: Buffer.from(resolved.secret, 'utf-8').length * 8,
  };
}

/**
 * Hashes an admin password using scrypt + random salt so plain-text passwords
 * are NEVER stored in MongoDB website_settings or on disk.
 */
export function hashAdminPassword(plainPassword: string, existingSalt?: string): {
  hash: string;
  salt: string;
} {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(plainPassword, salt, 64).toString('hex');
  return { hash: derivedKey, salt };
}

/**
 * Timing-safe verification of a candidate password against a stored scrypt hash & salt.
 */
export function verifyHashedAdminPassword(
  candidatePassword: string,
  storedHash: string,
  storedSalt: string
): boolean {
  try {
    const { hash } = hashAdminPassword(candidatePassword, storedSalt);
    const a = Buffer.from(hash, 'hex');
    const b = Buffer.from(storedHash, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Issues a cryptographically signed HMAC-SHA256 session token for an authenticated admin.
 */
export function issueAdminSessionToken(email: string, ttlMs = SESSION_TTL_MS): string {
  const cleanEmail = email.trim().toLowerCase();
  const issuedAt = Date.now();
  const expiresAt = issuedAt + ttlMs;
  const { secret } = resolveAdminHmacSecret();

  const payload = Buffer.from(
    JSON.stringify({
      email: cleanEmail,
      role: 'admin',
      iat: issuedAt,
      exp: expiresAt,
    })
  ).toString('base64url');

  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');

  return `${payload}.${signature}`;
}

/**
 * Verifies a signed HMAC-SHA256 admin session token including constant-time signature
 * comparison and expiration check.
 */
export function verifyAdminSessionToken(token: string): {
  valid: boolean;
  email?: string;
  expiresAt?: number;
  reason?: string;
} {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) {
      return { valid: false, reason: 'Malformed token format' };
    }
    const [payload, signature] = parts;
    const { secret } = resolveAdminHmacSecret();
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('base64url');

    const a = Buffer.from(signature);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { valid: false, reason: 'Invalid HMAC signature' };
    }

    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    if (!decoded?.email || typeof decoded.email !== 'string') {
      return { valid: false, reason: 'Missing email claim' };
    }
    if (typeof decoded.exp === 'number' && Date.now() > decoded.exp) {
      return { valid: false, reason: 'Session token expired' };
    }

    return {
      valid: true,
      email: decoded.email.toLowerCase(),
      expiresAt: decoded.exp,
    };
  } catch {
    return { valid: false, reason: 'Token verification error' };
  }
}

/**
 * Fetches and caches Google's SecureToken public X.509 certificates for verifying Firebase Auth ID tokens.
 */
async function getGooglePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (globalThis.__bgcGooglePublicCertsCache && globalThis.__bgcGooglePublicCertsCache.expiresAt > now) {
    return globalThis.__bgcGooglePublicCertsCache.certs;
  }

  const res = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch Google public certificates: HTTP ${res.status}`);
  }
  const certs = (await res.json()) as Record<string, string>;
  globalThis.__bgcGooglePublicCertsCache = {
    certs,
    expiresAt: now + 60 * 60 * 1000, // Cache for 1 hour
  };
  return certs;
}

/**
 * Cryptographically verifies a Firebase Authentication ID Token (RS256 JWT)
 * without modifying client-side Firebase Authentication.
 */
export async function verifyFirebaseAdminIdToken(
  idToken: string,
  expectedProjectId = DEFAULT_FIREBASE_PROJECT_ID
): Promise<{ valid: boolean; email?: string; uid?: string; reason?: string }> {
  try {
    const segments = idToken.split('.');
    if (segments.length !== 3) {
      return { valid: false, reason: 'Not a 3-part JWT' };
    }
    const [headerB64, payloadB64, signatureB64] = segments;
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf-8'));
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));

    if (header.alg !== 'RS256' || !header.kid) {
      return { valid: false, reason: 'Invalid JWT header algorithm or missing kid' };
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || payload.exp < nowSec) {
      return { valid: false, reason: 'Firebase ID token expired' };
    }
    if (payload.aud !== expectedProjectId) {
      return { valid: false, reason: 'Firebase ID token audience mismatch' };
    }
    if (payload.iss !== `https://securetoken.google.com/${expectedProjectId}`) {
      return { valid: false, reason: 'Firebase ID token issuer mismatch' };
    }

    const certs = await getGooglePublicCerts();
    const cert = certs[header.kid];
    if (!cert) {
      return { valid: false, reason: 'No matching Google X.509 certificate for token kid' };
    }

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${headerB64}.${payloadB64}`);
    verifier.end();

    const sigBuffer = Buffer.from(signatureB64, 'base64url');
    const isSigValid = verifier.verify(cert, sigBuffer);
    if (!isSigValid) {
      return { valid: false, reason: 'Invalid RSA-SHA256 signature on Firebase ID token' };
    }

    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
    if (!email) {
      return { valid: false, reason: 'Firebase ID token does not contain an email claim' };
    }

    return {
      valid: true,
      email,
      uid: payload.sub || payload.user_id,
    };
  } catch (err) {
    return {
      valid: false,
      reason: err instanceof Error ? err.message : 'Firebase JWT verification failed',
    };
  }
}

/**
 * Checks whether an email address is in the authorized admin list.
 */
export function isAuthorizedAdminEmail(email: string, extraAllowedEmails: string[] = []): boolean {
  const clean = (email || '').trim().toLowerCase();
  if (!clean) return false;
  const allowed = new Set([
    ...PRIMARY_AUTHORIZED_ADMIN_EMAILS.map((e) => e.toLowerCase()),
    ...extraAllowedEmails.map((e) => e.toLowerCase()),
  ]);
  return allowed.has(clean);
}

/**
 * Express middleware for strict server-side admin authorization.
 * Accepts ONLY:
 * 1. Cryptographically verified HMAC-SHA256 admin session token (`Authorization: Bearer <hmac_token>`)
 * 2. Cryptographically verified Firebase Auth ID token (`Authorization: Bearer <firebase_jwt>`)
 * Whose email claim belongs to the authorized admin allowlist.
 */
export function requireAdminAuth(
  extraAllowedEmailsResolver?: () => Promise<string[]> | string[],
  expectedProjectId = DEFAULT_FIREBASE_PROJECT_ID
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const extraEmails = extraAllowedEmailsResolver ? await extraAllowedEmailsResolver() : [];
      const authHeader = req.headers.authorization || '';
      const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

      if (!bearerToken) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized: Missing Authorization Bearer token for admin operation.',
        });
        return;
      }

      // 1. Check if token is a server-signed HMAC-SHA256 admin session token (2 segments)
      if (bearerToken.split('.').length === 2) {
        const verifiedHmac = verifyAdminSessionToken(bearerToken);
        if (verifiedHmac.valid && verifiedHmac.email) {
          if (!isAuthorizedAdminEmail(verifiedHmac.email, extraEmails)) {
            res.status(403).json({
              success: false,
              error: `Forbidden: Email (${verifiedHmac.email}) is not an authorized admin account.`,
            });
            return;
          }
          (req as any).adminEmail = verifiedHmac.email;
          (req as any).adminAuthMethod = 'hmac-session-token';
          next();
          return;
        }
      }

      // 2. Check if token is a Firebase Authentication RS256 ID token (3 segments)
      if (bearerToken.split('.').length === 3) {
        const verifiedFirebase = await verifyFirebaseAdminIdToken(bearerToken, expectedProjectId);
        if (verifiedFirebase.valid && verifiedFirebase.email) {
          if (!isAuthorizedAdminEmail(verifiedFirebase.email, extraEmails)) {
            res.status(403).json({
              success: false,
              error: `Forbidden: Firebase account (${verifiedFirebase.email}) is not an authorized admin.`,
            });
            return;
          }
          (req as any).adminEmail = verifiedFirebase.email;
          (req as any).adminAuthMethod = 'firebase-id-token';
          next();
          return;
        }
      }

      res.status(403).json({
        success: false,
        error: 'Forbidden: Invalid or expired admin authentication token.',
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: 'Admin authorization verification failed.',
      });
    }
  };
}
