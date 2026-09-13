import { createApp } from '../server/src/app.js';

// Catch-all: every /api/* request is routed to this one function, and
// Express does the real routing internally (createApp() defines the actual
// paths — /api/healthz, /api/readyz, /api/me, ...). An Express app is
// already a valid (req, res) => void handler, so no adapter is needed.
export default createApp();
