import { createApp, shutdown } from './app.js';
import { env } from './env.js';

const app = createApp();

const server = app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`fitnesshm-server listening on :${env.PORT} (${env.NODE_ENV})`);
});

// Railway sends SIGTERM on redeploy/scale-down. Drain in-flight requests, then
// close the pool.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    console.log(`${signal} received, shutting down…`);
    server.close(async () => {
      await shutdown();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
