import { clerkClient } from '@clerk/express';
import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';

// Clerk's session JWT only carries the user id by default — no email. Called
// on first sync (or first sign-in) to backfill the users row; cheap no-op
// afterwards since Clerk's own API is only hit once per new account.
export async function ensureUser(userId: string): Promise<void> {
  if (!db) throw new Error('DATABASE_URL is not set');

  const [existing] = await db.select({ id: users.id }).from(users).where(sql`${users.id} = ${userId}`);
  if (existing) return;

  const clerkUser = await clerkClient.users.getUser(userId);
  const primaryEmail = clerkUser.emailAddresses.find(
    (e) => e.id === clerkUser.primaryEmailAddressId,
  )?.emailAddress;
  if (!primaryEmail) {
    throw new Error(`Clerk user ${userId} has no primary email`);
  }

  await db
    .insert(users)
    .values({ id: userId, email: primaryEmail.toLowerCase() })
    .onConflictDoNothing({ target: users.id });
}
