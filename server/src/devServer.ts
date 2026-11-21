import { createApp } from './app.js';

// Local-only alternative to `vercel dev` (useful when you can't log into the
// Vercel CLI -- 2FA, offline, etc.). Run alongside `npm run dev` (plain
// Vite): vite's dev-server proxy (vite.config.ts) forwards /api/* here, so
// the browser still sees one origin, same as production and `vercel dev`.
// Never used in production -- api/index.ts (the real Vercel function) calls
// createApp() directly and never imports this file.
const port = Number(process.env.PORT ?? 8787);

createApp().listen(port, () => {
  console.log(`API listening on http://localhost:${port} (proxied from the Vite dev server at /api)`);
});
