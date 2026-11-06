// Single client-side data store. All reads/writes go through these actions,
// so swapping localStorage for a cloud backend later only touches this file.
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { DEFAULT_SETTINGS_EXT } from './seed';
import { buildSeed } from './demoSeed';
import { uid } from '../lib/format';
import { LIVE, storeKey } from '../config';
import { COLLECTIONS, KV_COLLECTIONS } from '../lib/access';

// Live apps: sync.js plugs in here. `allow(col)` vetoes writes the signed-in role may not make;
// `write(op)` queues each change for the server. The demo leaves both empty and stays in the browser.
export const hooks = { allow: null, write: null };
const allowed = (col) => !hooks.allow || hooks.allow(col);
const send = (op) => hooks.write?.(op);

/** A school with no records yet (live apps start from this, never from demo data). */
export function emptyState() {
  const out = { users: [] };
  COLLECTIONS.filter((c) => !KV_COLLECTIONS.includes(c) && c !== 'photos').forEach((c) => (out[c] = []));
  Object.assign(out, { timetable: {}, reportRemarks: {}, canteenMenu: {}, boardingFee: 0, expenseCategories: [] });
  out.meta = { version: 1, live: true };
  out.settings = {
    ...structuredClone(DEFAULT_SETTINGS_EXT),
    schoolName: '', motto: '', address: '', phone: '', email: '', website: '', academicYear: '', currentTerm: '',
    currency: 'GHS', headName: '', libraryFinePerDay: 1, loanDays: 14,
    auth: { ...DEFAULT_SETTINGS_EXT.auth, mode: 'live' },
    gate: { ...DEFAULT_SETTINGS_EXT.gate, secret: '' },
  };
  return out;
}

const PREFIX = {
  students: 'stu', parents: 'par', staff: 'stf', applications: 'app', classes: 'cls', subjects: 'sub', invoices: 'inv',
  payments: 'pay', expenses: 'exp', books: 'bok', loans: 'lon', storeItems: 'itm', stockMoves: 'stm', suppliers: 'sup',
  purchaseOrders: 'po', routes: 'rte', buses: 'bus', trips: 'trp', maintenance: 'mnt', dorms: 'dor', exeats: 'exe',
  notices: 'not', events: 'evt', messages: 'msg', smsLog: 'sms', healthVisits: 'hlt', incidents: 'dis', materials: 'mat',
  assignments: 'asg', submissions: 'sbm', quizzes: 'qz', quizAttempts: 'qat', leaves: 'lev', payrollRuns: 'prl', allocations: 'alc',
  canteenItems: 'cfi', canteenStock: 'cin', canteenStockMoves: 'csm', canteenSales: 'csl', users: 'usr', clockings: 'clk', liveSessions: 'lvs', houses: 'hse',
};

// localStorage that reports a full device instead of failing silently.
let warned = 0;
const safeStorage = {
  getItem: (k) => localStorage.getItem(k),
  removeItem: (k) => localStorage.removeItem(k),
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch (e) {
      if (Date.now() - warned > 30000) {
        warned = Date.now();
        window.dispatchEvent(new CustomEvent('edunexa-storage-full', { detail: e.name }));
      }
    }
  },
};

export const useDB = create(
  persist(
    (set, get) => ({
      ...(LIVE ? emptyState() : buildSeed()),

      add: (col, item) => {
        const rec = { id: item.id || uid(PREFIX[col] || 'rec'), ...item };
        if (!allowed(col)) return rec;
        // Texts created while offline wait in the queue and go out when the connection returns.
        if (col === 'smsLog' && typeof navigator !== 'undefined' && !navigator.onLine) rec.status = 'Queued';
        // Live apps: texts really go out through the school's mNotify account (see sync.js).
        if (col === 'smsLog' && LIVE) rec.status = 'Sending';
        set((s) => ({ [col]: [rec, ...s[col]] }));
        send({ type: 'put', col, rec });
        return rec;
      },
      addMany: (col, items) => {
        const recs = items.map((it) => ({ id: it.id || uid(PREFIX[col] || 'rec'), ...it }));
        if (!allowed(col)) return recs;
        set((s) => ({ [col]: [...recs, ...s[col]] }));
        recs.forEach((rec) => send({ type: 'put', col, rec }));
        return recs;
      },
      update: (col, id, patch) => {
        if (!allowed(col)) return;
        set((s) => ({ [col]: s[col].map((x) => (x.id === id ? { ...x, ...(typeof patch === 'function' ? patch(x) : patch) } : x)) }));
        const rec = get()[col].find((x) => x.id === id);
        if (rec) send({ type: 'put', col, rec });
      },
      upsert: (col, rec) => {
        if (!allowed(col)) return;
        set((s) => {
          const exists = s[col].some((x) => x.id === rec.id);
          return { [col]: exists ? s[col].map((x) => (x.id === rec.id ? { ...x, ...rec } : x)) : [rec, ...s[col]] };
        });
        send({ type: 'put', col, rec: get()[col].find((x) => x.id === rec.id) });
      },
      /** Adds or merges many records in one go (used by the Excel import). */
      bulkUpsert: (col, recs) => {
        if (!recs.length || !allowed(col)) return;
        const byId = new Map(recs.map((r) => [r.id, r]));
        set((s) => {
          const seen = new Set();
          const merged = s[col].map((x) => {
            const r = byId.get(x.id);
            if (!r) return x;
            seen.add(x.id);
            return { ...x, ...r };
          });
          return { [col]: [...recs.filter((r) => !seen.has(r.id)), ...merged] };
        });
        const now = new Map(get()[col].map((x) => [x.id, x]));
        recs.forEach((r) => send({ type: 'put', col, rec: now.get(r.id) }));
      },
      remove: (col, id) => {
        if (!allowed(col)) return;
        set((s) => ({ [col]: s[col].filter((x) => x.id !== id) }));
        send({ type: 'del', col, id });
      },
      /** Deletes many records of one collection in a single update. */
      removeMany: (col, ids) => {
        if (!ids.length || !allowed(col)) return;
        const drop = new Set(ids);
        set((s) => ({ [col]: s[col].filter((x) => !drop.has(x.id)) }));
        ids.forEach((id) => send({ type: 'del', col, id }));
      },
      setKey: (key, value) => {
        if (!allowed(key)) return;
        const before = get()[key];
        set((s) => ({ [key]: typeof value === 'function' ? value(s[key]) : value }));
        const after = get()[key];
        if (KV_COLLECTIONS.includes(key)) return send({ type: 'kv', col: key, value: after });
        if (Array.isArray(after)) {
          // Whole-list edits (e.g. fee structures): save what changed, delete what was removed.
          const keep = new Set(after.map((x) => x.id));
          after.forEach((rec) => send({ type: 'put', col: key, rec }));
          (before || []).filter((x) => !keep.has(x.id)).forEach((x) => send({ type: 'del', col: key, id: x.id }));
        }
      },
      updateSettings: (patch) => {
        if (!allowed('settings')) return;
        set((s) => ({ settings: { ...s.settings, ...patch } }));
        send({ type: 'settings', patch });
      },
      resetDemo: () => set(LIVE ? emptyState() : buildSeed()),
      get: (col, id) => get()[col].find((x) => x.id === id),
    }),
    {
      name: storeKey('edunexa-db'),
      version: 4,
      // Newer versions add collections, accounts and settings; bring them in without touching saved data.
      migrate: (persisted, version) => {
        if (version >= 4 || !persisted || LIVE) return persisted;
        const seed = buildSeed();
        const out = { ...persisted };
        Object.keys(seed).forEach((k) => {
          if (out[k] === undefined) out[k] = seed[k];
        });
        const addMissing = (key) => {
          const ids = new Set(out[key].map((x) => x.id));
          out[key] = [...out[key], ...seed[key].filter((x) => !ids.has(x.id))];
        };
        addMissing('users');
        addMissing('staff');
        out.users = out.users.map((u) => ({ status: 'Active', phone: '', lastLogin: null, ...u }));
        const st = { ...seed.settings, ...out.settings };
        ['theme', 'modules', 'auth', 'gate', 'live'].forEach((k) => (st[k] = { ...seed.settings[k], ...(out.settings[k] || {}) }));
        out.settings = st;
        return out;
      },
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => Object.fromEntries(Object.entries(s).filter(([, v]) => typeof v !== 'function')),
    },
  ),
);

export const useSession = create(
  persist(
    (set) => ({
      userId: null,
      dark: false,
      childId: null,
      sidebarCollapsed: false,
      lastActive: null,
      attempts: {},
      login: (userId) => set({ userId, childId: null, lastActive: Date.now() }),
      touch: () => set({ lastActive: Date.now() }),
      setAttempts: (attempts) => set({ attempts }),
      logout: () => set({ userId: null, childId: null }),
      toggleDark: () => set((s) => ({ dark: !s.dark })),
      setChild: (childId) => set({ childId }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    { name: storeKey('edunexa-session') },
  ),
);
