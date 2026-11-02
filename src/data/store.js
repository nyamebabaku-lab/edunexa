// Single client-side data store. All reads/writes go through these actions,
// so swapping localStorage for a cloud backend later only touches this file.
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { buildSeed } from './seed';
import { uid } from '../lib/format';

const PREFIX = {
  students: 'stu', parents: 'par', staff: 'stf', applications: 'app', classes: 'cls', subjects: 'sub', invoices: 'inv',
  payments: 'pay', expenses: 'exp', books: 'bok', loans: 'lon', storeItems: 'itm', stockMoves: 'stm', suppliers: 'sup',
  purchaseOrders: 'po', routes: 'rte', buses: 'bus', trips: 'trp', maintenance: 'mnt', dorms: 'dor', exeats: 'exe',
  notices: 'not', events: 'evt', messages: 'msg', smsLog: 'sms', healthVisits: 'hlt', incidents: 'dis', materials: 'mat',
  assignments: 'asg', submissions: 'sbm', quizzes: 'qz', quizAttempts: 'qat', leaves: 'lev', payrollRuns: 'prl', allocations: 'alc',
  canteenItems: 'cfi', canteenStock: 'cin', canteenStockMoves: 'csm', canteenSales: 'csl', users: 'usr', clockings: 'clk', liveSessions: 'lvs',
};

export const useDB = create(
  persist(
    (set, get) => ({
      ...buildSeed(),

      add: (col, item) => {
        const rec = { id: item.id || uid(PREFIX[col] || 'rec'), ...item };
        set((s) => ({ [col]: [rec, ...s[col]] }));
        return rec;
      },
      addMany: (col, items) => {
        const recs = items.map((it) => ({ id: it.id || uid(PREFIX[col] || 'rec'), ...it }));
        set((s) => ({ [col]: [...recs, ...s[col]] }));
        return recs;
      },
      update: (col, id, patch) =>
        set((s) => ({ [col]: s[col].map((x) => (x.id === id ? { ...x, ...(typeof patch === 'function' ? patch(x) : patch) } : x)) })),
      upsert: (col, rec) =>
        set((s) => {
          const exists = s[col].some((x) => x.id === rec.id);
          return { [col]: exists ? s[col].map((x) => (x.id === rec.id ? { ...x, ...rec } : x)) : [rec, ...s[col]] };
        }),
      remove: (col, id) => set((s) => ({ [col]: s[col].filter((x) => x.id !== id) })),
      setKey: (key, value) => set((s) => ({ [key]: typeof value === 'function' ? value(s[key]) : value })),
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      resetDemo: () => set(buildSeed()),
      get: (col, id) => get()[col].find((x) => x.id === id),
    }),
    {
      name: 'edunexa-db',
      version: 4,
      // Newer versions add collections, accounts and settings; bring them in without touching saved data.
      migrate: (persisted, version) => {
        if (version >= 4 || !persisted) return persisted;
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
      storage: createJSONStorage(() => localStorage),
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
    { name: 'edunexa-session' },
  ),
);
