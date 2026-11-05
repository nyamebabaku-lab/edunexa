// The front-page picture: EduNexa's default school photo, or the one a school's Owner uploads (Settings → Branding).
// It is blended into the sign-in page and the dashboard greeting with the school's own colours.
// The last school signed in on this device is remembered, so its picture greets people even before they sign in.
import { storeKey } from '../config';

export const DEFAULT_FRONT = `${import.meta.env.BASE_URL}front.jpg`;
const KEY = storeKey('edunexa-front');

/** Picture, name and logo of the last school used on this device (or null). */
export function rememberedSchool() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
}

export function rememberSchool(settings) {
  try {
    if (!settings?.schoolName) return;
    const next = { image: settings.frontImage || null, name: settings.schoolName, logo: settings.logo || null, motto: settings.motto || '' };
    if (JSON.stringify(next) !== localStorage.getItem(KEY)) localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full or blocked: the default picture is used */
  }
}

/** Resizes an uploaded photo to a wide JPEG (max 1600px) small enough to sync to every phone. */
export function fileToFront(file, max = 1600) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith('image/')) return reject(new Error('Please choose a photo (JPG or PNG)'));
    if (file.size > 25 * 1024 * 1024) return reject(new Error('That photo is too large (over 25 MB)'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That photo could not be opened')); };
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.width;
      let h = img.height;
      const scale = Math.min(1, max / Math.max(w, h));
      w = Math.round(w * scale);
      h = Math.round(h * scale);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      // Keep it under ~350 KB so it loads fast on mobile data.
      let q = 0.78;
      let out = c.toDataURL('image/jpeg', q);
      while (out.length > 350000 && q > 0.4) {
        q -= 0.08;
        out = c.toDataURL('image/jpeg', q);
      }
      resolve(out);
    };
    img.src = url;
  });
}
