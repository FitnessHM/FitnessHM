import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { pingDb } from './db/index.js';
import { allowedOrigins, env } from './env.js';
import { getAuth, requireUser, withClerkAuth } from './lib/auth.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1); // Vercel terminates TLS at its edge proxy.
  app.use(helmet());
  app.use(
    cors({
      origin(origin, cb) {
        // Allow same-origin / curl / server-to-server (no Origin header).
        // Frontend and API share one Vercel origin in prod, so this mainly
        // matters for local dev and direct API calls.
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error(`Origin not allowed: ${origin}`));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '5mb' }));
  app.use(
    // Best-effort only: each serverless invocation may land on a different
    // warm instance with its own in-memory store, so this doesn't give the
    // same guarantee it did on a single long-lived Railway process. Kept as
    // cheap defense-in-depth; not a substitute for platform-level abuse
    // protection.
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    }),
  );
  app.use(withClerkAuth);

  // Liveness: the process is up. Never touches the DB so the platform can tell
  // "app crashed" from "DB unreachable".
  app.get('/api/healthz', (_req, res) => {
    res.json({ ok: true, service: 'fitnesshm-server', ts: new Date().toISOString() });
  });

  // Readiness: the DB is actually reachable. Use this to confirm DATABASE_URL
  // is wired correctly.
  app.get('/api/readyz', async (_req, res) => {
    const db = await pingDb();
    res.status(db ? 200 : 503).json({ ok: db, db, configured: env.DATABASE_URL != null });
  });

  // Step 2 sanity check: confirms the client -> Clerk -> requireUser chain
  // works end to end. Step 3 adds the real GET/PUT /api/state here.
  app.get('/api/me', requireUser, (req, res) => {
    const { userId } = getAuth(req);
    res.json({ userId });
  });

  app.use((_req, res) => {
    res.status(404).json({ error: 'not_found' });
  });

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    const message = err instanceof Error ? err.message : 'internal_error';
    res.status(500).json({ error: 'internal_error', message });
  });

  return app;
}
