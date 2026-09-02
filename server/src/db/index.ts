import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from '../env.js';
import * as schema from './schema.js';

// A single shared pool for the process. `pg` connects lazily on first query,
// so importing this module never throws even when DATABASE_URL is unset.
export const pool = env.DATABASE_URL
  ? new pg.Pool({
      connectionString: env.DATABASE_URL,
      max: 10,
      ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
    })
  : null;

export const db = pool ? drizzle(pool, { schema }) : null;

/** True when a `SELECT 1` round-trips within `timeoutMs`. Used by /readyz. */
export async function pingDb(timeoutMs = 2000): Promise<boolean> {
  if (!pool) return false;
  const client = await pool.connect().catch(() => null);
  if (!client) return false;
  try {
    await Promise.race([
      client.query('select 1'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
    ]);
    return true;
  } catch {
    return false;
  } finally {
    client.release();
  }
}
