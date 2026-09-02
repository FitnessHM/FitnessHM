# Deploying `server/` to Railway

The backend is a standalone package in `/server` of the frontend repo. Deploy
it as its **own Railway service** in the same project as the already-provisioned
Postgres.

## 1. Create the service

Railway project (the one with Postgres) → **+ New** → **GitHub Repo** →
`HB-star13/FitnessHM`. Name it `api` (or `server`).

## 2. Point it at the subdirectory

Service → **Settings** → **Source**:

| Setting | Value |
| --- | --- |
| **Root Directory** | `server` |

Nixpacks then builds from `server/package.json` + `server/.nvmrc` (Node 20).

## 3. Build & start commands

Service → **Settings** → **Deploy** (Nixpacks usually infers these from the
`package.json` scripts; set them explicitly to be safe):

| Setting | Value |
| --- | --- |
| **Build Command** | `npm run build` |
| **Start Command** | `npm run start` |

`npm run start` runs `node dist/index.js`. The install step (`npm ci`) is
automatic because `server/package-lock.json` is committed.

## 4. Variables

Service → **Variables**:

| Variable | Value | Notes |
| --- | --- | --- |
| `DATABASE_URL` | **Add Reference → Postgres → `DATABASE_URL`** | Resolves to `${{ Postgres.DATABASE_URL }}` — the private-network URL. No egress cost, no SSL. |
| `DATABASE_SSL` | `false` | Set `true` **only** if you deliberately switch to the public `DATABASE_PUBLIC_URL`. |
| `APP_BASE_URL` | `https://fitnesshm.vercel.app` | CORS allow-list (localhost is always allowed too). |
| `NODE_ENV` | `production` | |
| `PORT` | *(do not set)* | Railway injects it; the app reads `process.env.PORT`. |

Clerk and Strava variables come in later rollout steps — see `.env.example`.

## 5. Public domain

Service → **Settings** → **Networking** → **Generate Domain**.
You get `https://<name>-production.up.railway.app`. That is the API base URL.

## 6. Run the initial migration (once, after the first deploy)

Migrations are **not** run automatically on boot. From your machine:

```bash
cd server
npx @railway/cli login          # if not already
npx @railway/cli link           # pick the project, then the `api` service
npx @railway/cli run npm run db:migrate
```

Re-run `railway run npm run db:migrate` after any future migration is added.

## 7. Confirm it's up

```bash
curl https://<your-domain>.up.railway.app/healthz
#  -> {"ok":true,"service":"fitnesshm-server","ts":"..."}

curl https://<your-domain>.up.railway.app/readyz
#  -> {"ok":true,"db":true,"configured":true}   (after step 4 + step 6)
```

- `/healthz` = process is alive (never touches the DB).
- `/readyz` = `SELECT 1` succeeded, i.e. `DATABASE_URL` is wired correctly.

Once `/healthz` responds on the Railway URL, report back with the domain and
we start rollout step 2 (Clerk auth).
