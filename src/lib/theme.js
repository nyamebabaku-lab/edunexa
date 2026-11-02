// Runtime theming: brand/accent palettes live in CSS variables so a school can rebrand the app.

export const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

export const DEFAULT_BRAND = {
  50: '#eff5ff', 100: '#dbe8fe', 200: '#bfd6fe', 300: '#93bbfd', 400: '#6097fa', 500: '#3b74f6',
  600: '#2556eb', 700: '#1d43d8', 800: '#1e37af', 900: '#1e338a', 950: '#0f1d4d',
};
export const DEFAULT_ACCENT = {
  50: '#fff1f3', 100: '#ffe0e5', 200: '#ffc6d0', 300: '#ff9aab', 400: '#fd5f7a', 500: '#f52d52',
  600: '#e11d48', 700: '#be123c', 800: '#9f1239', 900: '#881337', 950: '#4c0519',
};

export const PRESETS = [
  { id: 'royal', name: 'Royal Blue & Red', brand: '#2556eb', accent: '#e11d48' },
  { id: 'emerald', name: 'Emerald & Gold', brand: '#047857', accent: '#d97706' },
  { id: 'maroon', name: 'Maroon & Gold', brand: '#9f1239', accent: '#ca8a04' },
  { id: 'purple', name: 'Royal Purple', brand: '#6d28d9', accent: '#db2777' },
  { id: 'navy', name: 'Navy & Orange', brand: '#1e3a8a', accent: '#ea580c' },
  { id: 'teal', name: 'Teal & Coral', brand: '#0f766e', accent: '#e11d48' },
];

const hexToRgb = (hex) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgbToHex = ([r, g, b]) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

const TINT = { 50: 0.93, 100: 0.85, 200: 0.72, 300: 0.55, 400: 0.35, 500: 0.15 };
const SHADE = { 700: 0.15, 800: 0.3, 900: 0.42, 950: 0.62 };

/** Builds a full 50–950 palette treating `base` as the 600 step. */
export function paletteFrom(base) {
  const rgb = hexToRgb(base);
  return Object.fromEntries(
    STEPS.map((s) => {
      if (s === 600) return [s, rgbToHex(rgb)];
      if (TINT[s] != null) return [s, rgbToHex(mix(rgb, [255, 255, 255], TINT[s]))];
      return [s, rgbToHex(mix(rgb, [0, 0, 0], SHADE[s]))];
    }),
  );
}

export const isDefaultTheme = (t) => !t || (t.brand.toLowerCase() === '#2556eb' && t.accent.toLowerCase() === '#e11d48');

export function themePalettes(theme) {
  if (isDefaultTheme(theme)) return { brand: DEFAULT_BRAND, accent: DEFAULT_ACCENT };
  return { brand: paletteFrom(theme.brand), accent: paletteFrom(theme.accent) };
}

/** Writes palette CSS variables onto <html>; also updates the browser theme colour. */
export function applyTheme(theme) {
  const root = document.documentElement;
  const { brand, accent } = themePalettes(theme);
  STEPS.forEach((s) => {
    root.style.setProperty(`--brand-${s}`, hexToRgb(brand[s]).join(' '));
    root.style.setProperty(`--accent-${s}`, hexToRgb(accent[s]).join(' '));
  });
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', brand[700]);
}

export function applyBranding(settings) {
  document.title = `${settings.appName || 'EduNexa'} — ${settings.schoolName}`;
  const href = settings.logo || './icon.svg';
  let link = document.querySelector('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = href;
  link.type = settings.logo ? 'image/png' : 'image/svg+xml';
}

/** Resizes an uploaded image file to a square-ish PNG data URL (max 256px). */
export function fileToLogo(file, max = 256) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Please choose an image file'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That image could not be opened'));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/png'));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
