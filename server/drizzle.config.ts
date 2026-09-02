import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // Only needed for `drizzle-kit push` / `studio`; `generate` works offline.
    url: process.env.DATABASE_URL ?? 'postgres://localhost:5432/placeholder',
  },
  strict: true,
  verbose: true,
});
