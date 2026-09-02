import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './index.js';

// Run with: npm run db:migrate   (locally: needs DATABASE_URL in server/.env
// on Railway: `railway run npm run db:migrate` from the server service)
if (!db || !pool) {
  console.error('DATABASE_URL is not set — cannot run migrations.');
  process.exit(1);
}

console.log('Running migrations…');
await migrate(db, { migrationsFolder: new URL('../../drizzle', import.meta.url).pathname });
console.log('Migrations complete.');
await pool.end();
