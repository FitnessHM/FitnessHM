import { createApp } from '../server/src/app.js';

// Every /api/* request is rewritten here by vercel.json (source: "/api/(.*)",
// destination: "/api") — Vercel preserves the *original* request URL when
// invoking the function, so Express does the real routing internally
// (createApp() defines the actual paths). An Express app is already a valid
// (req, res) => void handler, so no adapter is needed.
//
// Not a api/[...path].ts bracket catch-all: that only matched single-segment
// paths in production (e.g. /api/me worked, /api/strava/status 404'd at
// Vercel's edge before ever reaching this function) — confirmed live, not
// just a hunch. This rewrite-based pattern is the one Vercel's own Express
// example uses, and it has no such depth limit.
export default createApp();
