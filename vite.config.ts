import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',

      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,

        // CRITICAL: exclude html from precache.
        // Precaching html with skipWaiting causes a race condition on mobile data:
        // new SW activates before its install cache is fully populated, then tries
        // to serve index.html from an empty cache → blank screen.
        // HTML is tiny — let it always come from the network.
        globPatterns: ['**/*.{js,css,ico,png,svg,woff2}'],

        // If a navigation request fails completely (no network, no cache),
        // serve the app shell — prevents blank screen on mobile data reconnect.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/__/,
          /\/sw\.js$/,
          /\/workbox-/,
          /\.netlify/,
        ],

        // Per-file size limit for precaching — skip any single file over 2MB
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,

        runtimeCaching: [
          // HTML / navigation — always try network, fall back to cache.
          // Timeout of 5s means on mobile data it doesn't hang forever.
          {
            urlPattern: ({ request }: { request: Request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'navigation',
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [0, 200] },
            },
          },

          // Supabase — NetworkFirst with 6s timeout (was 10, too long on 2G/3G)
          {
            urlPattern: /^https:\/\/zxptpnavemclwwhazmei\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase',
              networkTimeoutSeconds: 6,
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 200, maxAgeSeconds: 86400 },
            },
          },

          // Google Fonts — CacheFirst, they never change
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 31536000 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },

      includeAssets: ['favicon.svg', 'icons.svg', 'icon-192.png', 'icon-512.png'],

      manifest: {
        name: 'VELA — Command Your Group',
        short_name: 'VELA',
        description: 'Governance and operations platform for holding companies',
        theme_color: '#0f0f23',
        background_color: '#0f0f23',
        display: 'standalone',
        orientation: 'portrait',
        // Use root as start so SW can serve it immediately — /dashboard redirects
        // after auth check in the app anyway
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          { src: '/favicon.svg',  sizes: 'any',     type: 'image/svg+xml' },
        ],
      },

      devOptions: { enabled: false },
    }),
  ],

  build: {
    target: 'es2015',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('react-dom') || id.includes('react-router')) return 'vendor'
          if (id.includes('recharts')) return 'charts'
          if (id.includes('@supabase')) return 'supabase'
          if (id.includes('/idb'))     return 'idb'
        },
      },
    },
  },
})
