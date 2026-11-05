import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'url';

// Three apps from one codebase (VITE_APP): main → dist/, admin → dist/admin/, demo → dist/demo/.
const APP = process.env.VITE_APP || 'demo';
const META = {
  main: { name: 'EduNexa', short: 'EduNexa', desc: 'Your school app for teachers, parents, students and staff', out: 'dist' },
  admin: { name: 'EduNexa Admin', short: 'EduNexa Admin', desc: 'Run your school: approve accounts, branding, every module', out: 'dist/admin' },
  demo: { name: 'EduNexa — Demo', short: 'EduNexa Demo', desc: 'Try EduNexa with a demo school', out: 'dist/demo' },
}[APP];

export default defineConfig({
  base: './',
  define: { 'import.meta.env.VITE_APP': JSON.stringify(APP) },
  // Live apps never include the demo school's sample data.
  resolve: { alias: APP === 'demo' ? [] : [{ find: /^\.\/demoSeed$/, replacement: fileURLToPath(new URL('./src/data/demoSeed.live.js', import.meta.url)) }] },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: `edunexa-${APP}`,
        name: META.name,
        short_name: META.short,
        description: META.desc,
        theme_color: '#1d43d8',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The whole app (every page) is cached on first visit so it opens with no internet.
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,woff2}'],
        // The main app's folder also holds the admin and demo apps; never cache or answer for them.
        globIgnores: APP === 'main' ? ['admin/**', 'demo/**'] : [],
        navigateFallbackDenylist: APP === 'main' ? [/\/admin\//, /\/demo\//] : [],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        runtimeCaching: [
          // Never cache server calls.
          { urlPattern: /supabase\.co\//, handler: 'NetworkOnly' },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-files', expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
  build: {
    outDir: process.env.OUT_DIR || META.out,
    emptyOutDir: APP === 'main' || !!process.env.OUT_DIR,
    chunkSizeWarningLimit: 1500,
  },
});
