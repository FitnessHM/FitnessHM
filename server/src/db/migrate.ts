import { migrate } from 'drizzle-orm/neon-http/migrator';
import { db } from './index.js';

// Run from your own machine only: `npm run db:migrate` at the repo root,
// with DATABASE_URL pointed at Neon in the root .env. Never run as part of
// the Vercel build — there is no build-time migration step by design.
if (!db) {
  console.error('DATABASE_URL is not set — cannot run migrations.');
  process.exit(1);
}

console.log('Running migrations…');
await migrate(db, { migrationsFolder: new URL('../../drizzle', import.meta.url).pathname });
console.log('Migrations complete.');
