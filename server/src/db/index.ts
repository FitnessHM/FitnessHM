import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { env } from '../env.js';
import * as schema from './schema.js';

// Neon's HTTP driver: each query is a stateless HTTPS call, no pooled TCP
// connection held across invocations. That's the right model for serverless
// (a pg.Pool per invocation would risk exhausting Postgres's connection
// limit under concurrency). db.transaction() batches statements into one
// HTTP call executed atomically server-side — not a fully interactive
// transaction, but enough for whole-payload sync writes.
const sql = env.DATABASE_URL ? neon(env.DATABASE_URL) : null;

export const db = sql ? drizzle(sql, { schema }) : null;

/** True when `select 1` round-trips. Used by /api/readyz. */
export async function pingDb(): Promise<boolean> {
  if (!sql) return false;
  try {
    await sql`select 1`;
    return true;
  } catch {
    return false;
  }
}
