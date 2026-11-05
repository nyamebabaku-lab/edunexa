// Live classes: room codes, peer ids and provider settings.

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Short, readable, hard-to-guess code like "K7Q4-MZ9P". */
export function makeRoomCode() {
  const pick = () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return `${Array.from({ length: 4 }, pick).join('')}-${Array.from({ length: 4 }, pick).join('')}`;
}

export const normalizeCode = (c) => (c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^(.{4})(.{4}).*$/, '$1-$2');
export const isValidCode = (c) => /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(normalizeCode(c));

const slug = (code) => `edunexa-live-${normalizeCode(code).replace('-', '').toLowerCase()}`;
export const hostPeerId = (code) => `${slug(code)}-host`;
export const guestPeerId = (code) => `${slug(code)}-${Math.random().toString(36).slice(2, 10)}`;

export const inviteLink = (code) => `${window.location.origin}${window.location.pathname}#/live/room/${normalizeCode(code)}`;

/** The ICE servers browsers use to find each other. Schools can add their own TURN relay in settings. */
export function iceServers(live) {
  const list = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  if (live?.turnUrl) list.push({ urls: live.turnUrl, username: live.turnUser || undefined, credential: live.turnPass || undefined });
  return list;
}

export function sessionStatus(s, now = new Date()) {
  if (s.status === 'Ended') return 'Ended';
  if (s.status === 'Live') return 'Live';
  const start = new Date(`${s.date}T${s.start}:00`);
  const end = new Date(start.getTime() + s.duration * 60000);
  if (now > end) return 'Missed';
  if (now >= new Date(start.getTime() - 15 * 60000)) return 'Starting soon';
  return 'Scheduled';
}

export const canHost = (user, session) => user && (user.role === 'admin' || user.role === 'headteacher' || user.role === 'superadmin' || (session && user.linkedId === session.teacherId));
