import { neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import { env } from '../env.js';
import * as schema from './schema.js';

// neon-http's driver has no transaction support at all ("No transactions
// support in neon-http driver") — confirmed the hard way while building the
// whole-payload state sync, which needs an atomic delete+reinsert. This
// WebSocket-backed Pool gives real transactions while still being fine for
// serverless: Neon's pooling handles the connection lifecycle, no long-lived
// TCP pool held across invocations the way raw `pg` would.
neonConfig.webSocketConstructor = ws;

export const pool = env.DATABASE_URL ? new Pool({ connectionString: env.DATABASE_URL }) : null;

export const db = pool ? drizzle(pool, { schema }) : null;

/** True when `select 1` round-trips. Used by /api/readyz. */
export async function pingDb(): Promise<boolean> {
  if (!pool) return false;
  try {
    const client = await pool.connect();
    try {
      await client.query('select 1');
      return true;
    } finally {
      client.release();
    }
  } catch {
    return false;
  }
}
