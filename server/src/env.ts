import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Neon connection string. Optional here only so the process can boot
  // without a DB configured; /api/readyz reports "db: false" until it is
  // set. The Neon HTTP driver (server/src/db/index.ts) needs no separate
  // SSL flag — it's an HTTPS call, not a raw TCP connection.
  DATABASE_URL: z.string().url().optional(),

  // Browser origin(s) allowed to call the API, comma-separated. Local dev
  // origins are always allowed in addition to this. Mostly moot in prod now
  // that frontend and API share one Vercel origin, but still needed locally.
  APP_BASE_URL: z.string().url().default('https://fitnesshm.vercel.app'),

  // --- Wired in step 2 (Clerk) ---
  CLERK_SECRET_KEY: z.string().min(1),
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
