# FitnessHM

Local-first running-training PWA (React + Vite + Dexie/IndexedDB) with a
Vercel-serverless API (Express under `/api`), Clerk auth, and Neon Postgres.
Frontend and API deploy together as one Vercel project — no separate backend
host, no CORS in production.

## Local dev

```bash
npm install
cp .env.example .env   # fill in the values below
npx vercel dev          # serves the frontend AND /api together, one origin
```

`vercel dev` is the one command for local dev: it runs the Vite dev server
and the `/api` functions behind a single origin, the same way they're served
in production. (Don't point `npm run dev` at `vercel dev` — Vercel uses that
script as the underlying dev command it shells out to, so aliasing them
recurses. `npm run dev` stays plain `vite`, frontend-only, for when you don't
need the backend.) First run: `npx vercel login`, then `npx vercel link` to
connect this checkout to the project.

### Env vars (`.env`, gitignored)

See `.env.example` for the full list. In short:

- `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY` — from the Clerk dashboard.
- `DATABASE_URL` — Neon's pooled connection string (Project → Connect in the Neon dashboard).
- `STRAVA_*`, `TOKEN_ENCRYPTION_KEY` — step 4 (Strava OAuth), not wired up yet.

### Vercel dashboard env vars (production)

Set the same keys as service Environment Variables in the Vercel project
(Settings → Environment Variables), values from Clerk/Neon, not the ones in
your local `.env`:

| Variable | Where it comes from |
| --- | --- |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk dashboard → API keys (**production** instance, not the dev one used locally) |
| `CLERK_SECRET_KEY` | same, production instance |
| `CLERK_PUBLISHABLE_KEY` | same, production instance |
| `DATABASE_URL` | Neon dashboard → Connect (pooled connection string) |
| `APP_BASE_URL` | `https://fitnesshm.vercel.app` |

## Database migrations

Migrations run **only from a developer's machine**, never as part of the
Vercel build:

```bash
npm run db:migrate     # applies server/drizzle/*.sql against DATABASE_URL
npm run db:generate    # after changing server/src/db/schema.ts, generates a new migration
```

There is no build-time or boot-time migration step by design — a bad
migration should never be able to block or break a deploy.

## Project layout

- `src/` — the frontend (Vite). Talks to Dexie locally and to `/api/*` for
  sync once step 3 lands.
- `server/src/` — the actual backend source: Express app (`app.ts`), Drizzle
  schema/db (`db/`), Clerk middleware (`lib/auth.ts`). Not a separate
  deployable package — just where the backend code lives.
- `api/[...path].ts` — the single Vercel serverless function. Every `/api/*`
  request is routed here; Express (`server/src/app.ts`) does the actual
  route matching internally.

## Typechecking

```bash
npm run typecheck       # frontend (src/)
npm run typecheck:api   # backend + api (server/src/, api/)
```

Two separate `tsconfig`s on purpose — the frontend one only ever sees
`src/`, so nothing under `server/` (Clerk's backend SDK, Drizzle, the Neon
driver, etc.) can end up in the browser bundle.
