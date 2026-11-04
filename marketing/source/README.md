# Flyer source

Designed with the `graphic-design` skill. Each flyer is a 1080×1080 HTML section and is exported at 2× (2160×2160 PNG).

1. `node shots.mjs`: capture fresh app screenshots into `shots/` from `vite preview` on port 4173.
2. `node gen.mjs`: build `flyers.html` from `flyers.css` and the copy in `gen.mjs`.
3. `node render.mjs ../flyers/`: export the PNGs.
4. `node sheet.mjs ../flyers ../flyers-contact-sheet.png 4 540`: make the contact sheet.

The scripts need `playwright-core` and the Chromium 1148 build. `gen.mjs` loads `react`, `lucide-react` and `qrcode` from the app's own `node_modules`.
