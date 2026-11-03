// Student & staff photos. They live in IndexedDB (much larger than localStorage) and are
// mirrored into a small in-memory store so components re-render when a photo changes.
import { create } from 'zustand';

const DB_NAME = 'edunexa-media';
const STORE = 'photos';

let dbp;
function idb() {
  dbp ||= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}
async function tx(mode, fn) {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(out?.result ?? out);
    t.onerror = () => reject(t.error);
  });
}

/** Key for a person's photo: "Student:stu_001" or "Staff:stf_002". */
export const photoKey = (personType, id) => (id ? `${personType}:${id}` : null);

export const usePhotos = create(() => ({ map: {}, ready: false }));

export async function loadPhotos() {
  try {
    const map = {};
    await tx('readonly', (s) => {
      const req = s.openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (c) {
          map[c.key] = c.value;
          c.continue();
        }
      };
    });
    usePhotos.setState({ map, ready: true });
  } catch {
    usePhotos.setState({ ready: true });
  }
}

const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('edunexa-photos') : null;
channel?.addEventListener('message', () => loadPhotos());

export async function savePhoto(key, dataUrl) {
  await tx('readwrite', (s) => s.put(dataUrl, key));
  usePhotos.setState((st) => ({ map: { ...st.map, [key]: dataUrl } }));
  channel?.postMessage('changed');
}

export async function removePhoto(key) {
  await tx('readwrite', (s) => s.delete(key));
  usePhotos.setState((st) => {
    const map = { ...st.map };
    delete map[key];
    return { map };
  });
  channel?.postMessage('changed');
}

export async function clearPhotos() {
  await tx('readwrite', (s) => s.clear());
  usePhotos.setState({ map: {} });
}

export const usePhoto = (key) => usePhotos((s) => (key ? s.map[key] : null));

/** Centre-crops an image (file, blob or data URL) to a square JPEG, ~20 KB at 320px. */
export function toSquareJpeg(src, { size = 320, zoom = 1, offsetX = 0, offsetY = 0, quality = 0.82 } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height) / zoom;
      const sx = Math.max(0, Math.min(img.width - side, (img.width - side) / 2 - offsetX * side));
      const sy = Math.max(0, Math.min(img.height - side, (img.height - side) / 2 - offsetY * side));
      const c = Object.assign(document.createElement('canvas'), { width: size, height: size });
      const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, sx, sy, side, side, 0, 0, size, size);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('That image could not be opened'));
    if (typeof src === 'string') img.src = src;
    else {
      const r = new FileReader();
      r.onload = () => (img.src = r.result);
      r.onerror = () => reject(new Error('Could not read the file'));
      r.readAsDataURL(src);
    }
  });
}

/** Photo key for a signed-in account (parents have no photo). */
export const userPhotoKey = (u) => (!u?.linkedId || u.role === 'parent' || u.role === 'superadmin' ? null : photoKey(u.role === 'student' ? 'Student' : 'Staff', u.linkedId));

/** Saves, removes or leaves a photo as chosen in a form field (undefined = unchanged). */
export async function applyPhotoChange(key, value) {
  if (!key || value === undefined) return;
  if (value === null) await removePhoto(key);
  else await savePhoto(key, value);
}
