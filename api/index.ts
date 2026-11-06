import { createExpressApiApp } from '../server';

/**
 * Vercel Serverless Function Entry Point (`/api/index.ts`).
 *
 * All `/api/*` requests defined in `vercel.json` are routed here.
 * Reuses the singleton Express API router and the global MongoDB Atlas
 * connection pool (`globalThis.__bgcMongoClientPromise`) across warm invocations.
 */
const app = createExpressApiApp();

export default app;
