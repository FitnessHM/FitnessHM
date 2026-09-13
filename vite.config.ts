import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Serve from the domain root. Works on Vercel (fitnesshm.vercel.app) and
  // local dev alike. The old '/FitnessHM/' value was for GitHub Pages
  // project-page hosting and 404s every asset when served from root.
  base: '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Without this, Workbox's NavigationRoute intercepts *every*
        // top-level navigation — including /api/strava/connect and
        // /api/strava/callback — and serves the cached SPA shell instead of
        // ever hitting the network. Confirmed live: Strava's OAuth redirect
        // back to /api/strava/callback never reached the server at all: the
        // service worker silently swallowed it and served index.html, so
        // the user landed back on the app with no error and no connection,
        // and zero trace in the server logs.
        navigateFallbackDenylist: [/^\/api\//],
      },
      manifest: {
        name: 'FitnessHM',
        short_name: 'FitnessHM',
        description: 'Running training blocks, checkpoints, and pace math.',
        theme_color: '#0b0f14',
        background_color: '#0b0f14',
        display: 'standalone',
        icons: [
          { src: 'icon.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
} as any);
