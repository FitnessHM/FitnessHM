import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { pingDb, pool } from './db/index.js';
import { allowedOrigins, env } from './env.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1); // Railway terminates TLS at its edge proxy.
  app.use(helmet());
  app.use(
    cors({
      origin(origin, cb) {
        // Allow same-origin / curl / server-to-server (no Origin header).
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error(`Origin not allowed: ${origin}`));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '5mb' }));
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    }),
  );

  // Liveness: the process is up. Never touches the DB so the platform can tell
  // "app crashed" from "DB unreachable".
  app.get('/healthz', (_req, res) => {
    res.json({ ok: true, service: 'fitnesshm-server', ts: new Date().toISOString() });
  });

  // Readiness: the DB is actually reachable. Use this to confirm DATABASE_URL
  // is wired correctly on Railway.
  app.get('/readyz', async (_req, res) => {
    const db = await pingDb();
    res.status(db ? 200 : 503).json({ ok: db, db, configured: env.DATABASE_URL != null });
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

export async function shutdown() {
  if (pool) await pool.end();
}
