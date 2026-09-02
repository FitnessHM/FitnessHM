import 'dotenv/config';
import { z } from 'zod';

// Step 1 keeps almost everything optional so the process can boot and answer
// /healthz even before the database (or, later, Clerk/Strava) is wired.
// Tighten these to `.min(1)` as each rollout step lands.
const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),

  // Postgres. Railway injects this via a service reference variable
  // (${{ Postgres.DATABASE_URL }}). Optional here only so local `npm run dev`
  // works without a DB; /readyz reports "db: false" until it is set.
  DATABASE_URL: z.string().url().optional(),
  // "true" only when connecting over Railway's *public* Postgres URL. The
  // private-network URL (recommended) needs no SSL.
  DATABASE_SSL: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  // Browser origin(s) allowed to call the API, comma-separated. Local dev
  // origins are always allowed in addition to this.
  APP_BASE_URL: z.string().url().default('https://fitnesshm.vercel.app'),

  // --- Wired in step 2 (Clerk) ---
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),

  // --- Wired in step 4 (Strava) ---
  STRAVA_CLIENT_ID: z.string().optional(),
  STRAVA_CLIENT_SECRET: z.string().optional(),
  STRAVA_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
  STRAVA_SCOPE: z.string().default('read,activity:read_all'),
  // 32-byte key, base64-encoded, for AES-256-GCM encryption of Strava tokens
  // at rest. Generate with: openssl rand -base64 32
  TOKEN_ENCRYPTION_KEY: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const allowedOrigins = [
  env.APP_BASE_URL,
  'http://localhost:5173',
  'http://localhost:5174',
];
