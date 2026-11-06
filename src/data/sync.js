// Live apps: keeps the in-browser store in step with the EduNexa server (Supabase, schema "edunexa").
// Reads: everything the signed-in account may see (the database's row-level security decides).
// Writes: store actions queue each change in a saved outbox, sent in order, so work done offline goes up later.
import { create } from 'zustand';
import { supabase, must, friendly } from '../lib/supabase';
import { useDB, useSession, hooks, emptyState } from './store';
import { KV_COLLECTIONS, COLLECTIONS, canWrite, readScope, COLLECTION_LABEL } from '../lib/access';
import { ADMIN_APP, storeKey, PHONE_DOMAIN } from '../config';
import { setServerPhotos, clearPhotos } from './photos';
import { toast } from '../components/ui';
import { startPush, stopPush } from '../lib/push';

/**
 * phase: 'loading' | 'signedOut' | 'noProfile' | 'waiting' | 'wrongApp' | 'ready'
 * profile / school: rows from the server; schools: every school (Super Admin only).
 */
export const useLive = create(() => ({ notifications: [], childRequests: [], phase: 'loading', profile: null, school: null, superExists: true, schools: [], stats: {}, pending: 0, syncing: false, lastSync: null }));
const L = (patch) => useLive.setState(patch);

const OUTBOX = storeKey('edunexa-outbox');
const OWNER = storeKey('edunexa-owner'); // whose data the cached store holds
let outbox = [];
try { outbox = JSON.parse(localStorage.getItem(OUTBOX) || '[]'); } catch { outbox = []; }
const saveOutbox = () => {
  try { localStorage.setItem(OUTBOX, JSON.stringify(outbox)); } catch { /* full */ }
  L({ pending: outbox.length });
};

let channel = null;
let started = false;
let hold = 0;

/** Runs sign-up steps without the screen jumping ahead after the sign-in but before the school is joined. */
export async function holdAuth(fn) {
  hold++;
  try {
    return await fn();
  } finally {
    hold--;
  }
}

// ---------------------------------------------------------------- helpers
export const phoneEmail = (phone) => `${String(phone).replace(/\D/g, '').replace(/^233/, '0')}@${PHONE_DOMAIN}`;
/** Email or phone → the email Supabase signs in with. */
export const loginEmail = (id) => (String(id).includes('@') ? String(id).trim().toLowerCase() : phoneEmail(id));
const realEmail = (e) => (e && !e.endsWith(`@${PHONE_DOMAIN}`) ? e : '');
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export const userFromProfile = (p) => ({
  id: p.user_id,
  role: p.role,
  name: p.name,
  email: realEmail(p.email),
  phone: p.phone || '',
  linkedId: p.linked_id,
  status: cap(p.status),
  lastLogin: p.last_login,
  createdAt: p.created_at,
  schoolId: p.school_id,
  matchLabel: p.match_label,
  admissionNo: p.admission_no,
  isOwner: p.is_owner,
});

const settingsFrom = (school) => {
  const base = emptyState().settings;
  const s = school?.settings || {};
  return {
    ...base,
    ...s,
    schoolName: school?.name || s.schoolName || '',
    theme: { ...base.theme, ...(s.theme || {}) },
    modules: { ...base.modules, ...(s.modules || {}) },
    gate: { ...base.gate, ...(s.gate || {}) },
    live: { ...base.live, ...(s.live || {}) },
    auth: base.auth,
  };
};

// ---------------------------------------------------------------- reads
async function loadAllRecords() {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const page = must(await supabase.from('records').select('col,id,data').order('updated_at', { ascending: false }).range(from, from + 999));
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

function applyRows(rows, role) {
  const state = emptyState();
  delete state.settings;
  delete state.meta;
  const photos = {};
  rows.forEach(({ col, id, data }) => {
    if (col === 'photos') photos[id] = data.url;
    else if (KV_COLLECTIONS.includes(col)) state[col] = data.v;
    else if (Array.isArray(state[col])) state[col].push(data);
  });
  // Only collections this role may read are replaced; anything else stays empty.
  COLLECTIONS.forEach((c) => {
    if (readScope(role, c) === 'none' && c !== 'photos') state[c] = emptyState()[c];
  });
  return { state, photos };
}

async function loadUsers() {
  const profiles = must(await supabase.from('profiles').select('*').order('created_at', { ascending: false }));
  return profiles.map(userFromProfile);
}

async function loadSchool(profile) {
  const role = profile.role;
  const [ctx, rows, users] = await Promise.all([must(await supabase.rpc('my_context')), loadAllRecords(), loadUsers()]);
  const { state, photos } = applyRows(rows, role);
  if (readScope(role, 'staff') === 'none') state.staff = must(await supabase.rpc('staff_directory')) || [];
  useDB.setState({ ...state, users, settings: settingsFrom(ctx.school) });
  L({ school: ctx.school, profile: ctx.profile });
  setServerPhotos(photos);
}

async function loadPlatform() {
  const [schools, users, stats] = await Promise.all([
    must(await supabase.from('schools').select('*').order('created_at', { ascending: false })),
    loadUsers(),
    must(await supabase.rpc('platform_stats')),
  ]);
  const counts = Object.fromEntries((stats?.schools || []).map((s) => [s.id, s]));
  useDB.setState({ users, settings: { ...emptyState().settings, schoolName: 'EduNexa Platform' } });
  L({ schools, stats: counts });
}

/** Requests by parents to link more children (a parent sees their own; Owner/Admin and Head Teacher see the school's). */
async function loadChildRequests() {
  const { profile } = useLive.getState();
  if (!profile || !['parent', 'admin', 'headteacher'].includes(profile.role)) return L({ childRequests: [] });
  const { data } = await supabase.from('child_requests').select('*').neq('status', 'failed').order('created_at', { ascending: false }).limit(200);
  L({ childRequests: data || [] });
}
/** Parent: ask to link another child. Returns the request, or null when the details did not match. */
export async function requestChild(admissionNo, dob) {
  const r = await rpc('request_child', { admission_no: admissionNo, dob });
  loadChildRequests().catch(() => {});
  return r?.id ? r : null;
}
/** Owner/Admin or Head Teacher: approve or decline a parent's request. */
export async function decideChildRequest(id, approve) {
  const r = await rpc('decide_child_request', { request_id: id, approve });
  await loadChildRequests().catch(() => {});
  return r;
}

async function loadNotifications() {
  const { data } = await supabase.from('notifications').select('id,created_at,kind,title,body,link,read_at').order('created_at', { ascending: false }).limit(100);
  L({ notifications: data || [] });
}

/** Marks the signed-in person's notifications as read. */
export async function markNotificationsRead() {
  const unread = useLive.getState().notifications.filter((n) => !n.read_at).map((n) => n.id);
  if (!unread.length) return;
  const now = new Date().toISOString();
  L({ notifications: useLive.getState().notifications.map((n) => (n.read_at ? n : { ...n, read_at: now })) });
  await supabase.from('notifications').update({ read_at: now }).in('id', unread);
}

/** Re-reads everything for the signed-in account. */
export async function reload() {
  const { profile } = useLive.getState();
  if (!profile || profile.status !== 'active') return;
  L({ syncing: true });
  try {
    if (profile.role === 'superadmin') await loadPlatform();
    else await loadSchool(profile);
    loadNotifications().catch(() => {});
    loadChildRequests().catch(() => {});
    L({ lastSync: new Date().toISOString() });
  } catch (e) {
    toast.error('Could not refresh', friendly(e.message));
  } finally {
    L({ syncing: false });
  }
}

// ---------------------------------------------------------------- realtime
function subscribe(profile) {
  channel?.unsubscribe();
  const ch = supabase.channel(`edunexa-${profile.user_id}`);
  if (profile.role !== 'superadmin') {
    ch.on('postgres_changes', { event: '*', schema: 'edunexa', table: 'records', filter: `school_id=eq.${profile.school_id}` }, (ev) => {
      const row = ev.eventType === 'DELETE' ? ev.old : ev.new;
      if (!row?.col) return;
      // Our own unsent edits win until they reach the server.
      if (outbox.some((o) => o.col === row.col && o.id === row.id)) return;
      remoteChange(row.col, row.id, ev.eventType === 'DELETE' ? null : row.data);
    });
    ch.on('postgres_changes', { event: 'UPDATE', schema: 'edunexa', table: 'schools', filter: `id=eq.${profile.school_id}` }, async (ev) => {
      let school = ev.new;
      // Very large rows (logo + front picture) can arrive without their settings: read the row instead.
      if (!school?.settings || ev.errors?.length) {
        try {
          school = must(await supabase.rpc('my_context'))?.school || school;
        } catch {
          return;
        }
      }
      if (!school?.settings) return;
      useDB.setState({ settings: settingsFrom(school) });
      L({ school });
      if (school.status !== 'active') refresh();
    });
  }
  if (['parent', 'admin', 'headteacher'].includes(profile.role))
    ch.on('postgres_changes', { event: '*', schema: 'edunexa', table: 'child_requests' }, (ev) => {
      loadChildRequests().catch(() => {});
      // A parent's request was approved: their new child's records become readable — load them.
      if (profile.role === 'parent' && ev.new?.status === 'approved' && ev.new?.user_id === profile.user_id) reload();
    });
  ch.on('postgres_changes', { event: 'INSERT', schema: 'edunexa', table: 'notifications', filter: `user_id=eq.${profile.user_id}` }, (ev) => {
    L({ notifications: [ev.new, ...useLive.getState().notifications].slice(0, 100) });
  });
  ch.on('postgres_changes', { event: '*', schema: 'edunexa', table: 'profiles' }, (ev) => {
    if ((ev.new?.user_id || ev.old?.user_id) === profile.user_id) return refresh();
    loadUsers().then((users) => useDB.setState({ users })).catch(() => {});
    if (profile.role === 'superadmin') loadPlatform().catch(() => {});
  });
  if (profile.role === 'superadmin')
    ch.on('postgres_changes', { event: '*', schema: 'edunexa', table: 'schools' }, () => loadPlatform().catch(() => {}));
  ch.subscribe();
  channel = ch;
}

function remoteChange(col, id, data) {
  if (col === 'photos') return setServerPhotos({ [id]: data?.url || null }, true);
  if (KV_COLLECTIONS.includes(col)) return data && useDB.setState({ [col]: data.v });
  const list = useDB.getState()[col];
  if (!Array.isArray(list)) return;
  if (!data) return useDB.setState({ [col]: list.filter((x) => x.id !== id) });
  const exists = list.some((x) => x.id === id);
  useDB.setState({ [col]: exists ? list.map((x) => (x.id === id ? data : x)) : [data, ...list] });
}

// ---------------------------------------------------------------- writes
const allowWrite = (col) => {
  const { profile, phase } = useLive.getState();
  if (phase !== 'ready' || !profile) return false;
  if (col === 'users') return false; // accounts are managed on the server (Accounts page)
  if (col === 'settings') {
    if (profile.role === 'admin') return true;
    toast.error('View only', 'Only the school Owner/Admin can change school settings');
    return false;
  }
  if (canWrite(profile.role, col)) return true;
  toast.error('View only', `Your role can view ${COLLECTION_LABEL[col] || col} but not change it`);
  return false;
};

const queueWrite = (op) => {
  const entry =
    op.type === 'put' ? { type: 'put', col: op.col, id: op.rec.id, data: op.rec }
    : op.type === 'del' ? { type: 'del', col: op.col, id: op.id }
    : op.type === 'kv' ? { type: 'put', col: op.col, id: 'value', data: { v: op.value } }
    : { type: 'settings', patch: op.patch };
  // A newer change to the same record replaces an unsent older one.
  if (entry.type !== 'settings') outbox = outbox.filter((o) => !(o.col === entry.col && o.id === entry.id));
  outbox.push(entry);
  // A new text message: once the record is on the server, ask the server to send it.
  if (entry.type === 'put' && entry.col === 'smsLog' && entry.data.status === 'Sending') outbox.push({ type: 'sms', col: 'smsLog', smsId: entry.id });
  saveOutbox();
  flushSoon();
};

/** Puts the server's answer (Delivered / Failed …) on the local copy without queueing another write. */
function markSms(id, patch) {
  const list = useDB.getState().smsLog;
  useDB.setState({ smsLog: list.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
}

let flushTimer = null;
let flushing = false;
function flushSoon(ms = 250) {
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, ms);
}

/** Sends queued changes in order. Network trouble keeps them for later; refusals are dropped and reported. */
export async function flush() {
  if (flushing || !outbox.length) return;
  const { profile } = useLive.getState();
  if (!profile?.school_id || profile.status !== 'active') return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  flushing = true;
  try {
    while (outbox.length) {
      const head = outbox[0];
      let batch = [head];
      if (head.type === 'put') {
        batch = [];
        for (const o of outbox) {
          if (o.type !== 'put' || batch.length >= 200) break;
          batch.push(o);
        }
      }
      try {
        if (head.type === 'put') {
          must(await supabase.from('records').upsert(batch.map((o) => ({ school_id: profile.school_id, col: o.col, id: o.id, data: o.data })), { onConflict: 'school_id,col,id' }));
        } else if (head.type === 'sms') {
          const { data, error } = await supabase.functions.invoke('edunexa-sms', { body: { smsId: head.smsId } });
          if (error) {
            // Network trouble or the function is unreachable: keep it and try again later.
            if (!error.context || error.name === 'FunctionsFetchError') throw new Error('No internet connection');
            let info = {};
            try { info = await error.context.json(); } catch { /* not JSON */ }
            if (info.retry) throw new Error('No internet connection');
            markSms(head.smsId, { status: 'Failed', error: info.error || error.message });
            toast.error('SMS not sent', info.error || error.message);
          } else {
            markSms(head.smsId, { status: data.status, delivered: data.delivered, error: data.error || null, sentAt: new Date().toISOString() });
            if (data.status === 'Failed') toast.error('SMS not sent', data.error || 'mNotify did not accept the message');
            else if (data.skipped) toast.info('Some numbers skipped', `${data.skipped} number(s) are not parents or staff of this school`);
          }
        } else if (head.type === 'del') {
          must(await supabase.from('records').delete().match({ school_id: profile.school_id, col: head.col, id: head.id }));
        } else {
          const settings = must(await supabase.rpc('save_school_settings', { patch: head.patch }));
          L({ school: { ...useLive.getState().school, settings } });
        }
        outbox = outbox.slice(batch.length);
        saveOutbox();
      } catch (e) {
        const msg = friendly(e.message);
        if (msg === 'No internet connection' || msg === 'Failed to send a request to the Edge Function') break;
        outbox = outbox.slice(batch.length);
        saveOutbox();
        toast.error('Not saved', msg);
        reload();
      }
    }
  } finally {
    flushing = false;
  }
  if (outbox.length) flushSoon(15000);
}

// ---------------------------------------------------------------- session lifecycle
function resetLocal() {
  useDB.setState(emptyState());
  useSession.setState({ userId: null, childId: null });
  outbox = [];
  saveOutbox();
  clearPhotos().catch(() => {});
}

/** Works out where the signed-in person stands and loads their data. */
export async function refresh() {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) {
    channel?.unsubscribe();
    channel = null;
    resetLocal();
    L({ phase: 'signedOut', profile: null, school: null });
    return;
  }
  let ctx;
  try {
    ctx = must(await supabase.rpc('my_context'));
  } catch (e) {
    // Offline with a cached school: keep working from the saved copy.
    if (localStorage.getItem(OWNER) === session.user.id && useLive.getState().profile) return L({ phase: 'ready' });
    if (localStorage.getItem(OWNER) === session.user.id && useDB.getState().users.length) {
      const me = useDB.getState().users.find((u) => u.id === session.user.id);
      if (me) {
        useSession.setState({ userId: me.id });
        L({ phase: 'ready', profile: { user_id: me.id, role: me.role, status: 'active', school_id: me.schoolId, linked_id: me.linkedId } });
        return;
      }
    }
    toast.error('Could not connect', friendly(e.message));
    L({ phase: 'signedOut' });
    return;
  }
  const { profile, school, superExists } = ctx;
  L({ profile, school, superExists });
  if (localStorage.getItem(OWNER) !== session.user.id) {
    resetLocal();
    localStorage.setItem(OWNER, session.user.id);
  }
  if (!profile) return L({ phase: 'noProfile' });
  const adminRole = profile.role === 'admin' || profile.role === 'superadmin';
  if (adminRole !== ADMIN_APP) return L({ phase: 'wrongApp' });
  if (profile.status !== 'active' || (school && school.status !== 'active')) {
    subscribe(profile);
    startPush().catch(() => {}); // so "your account is approved" reaches the phone
    return L({ phase: 'waiting' });
  }
  useSession.setState({ userId: profile.user_id });
  if (useLive.getState().phase !== 'ready') {
    // Show the cached copy at once if we have it; fresh data follows.
    if (useDB.getState().users.some((u) => u.id === profile.user_id)) L({ phase: 'ready' });
    await reload();
    supabase.rpc('touch_login').then(() => {});
  }
  L({ phase: 'ready' });
  subscribe(profile);
  flush();
  startPush().catch(() => {});
}

export function startLive() {
  if (started || !supabase) return;
  started = true;
  hooks.allow = allowWrite;
  hooks.write = queueWrite;
  supabase.auth.onAuthStateChange((event) => {
    if ((event === 'SIGNED_IN' || event === 'SIGNED_OUT') && !hold) setTimeout(refresh, 0);
  });
  refresh();
  window.addEventListener('online', () => {
    flush();
    reload();
  });
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hiddenAt = Date.now();
    else if (hiddenAt && Date.now() - hiddenAt > 5 * 60000) reload();
  });
}

export async function signOut() {
  if (outbox.length && !window.confirm(`${outbox.length} change(s) have not reached the server yet (no internet). Sign out anyway and lose them?`)) return;
  channel?.unsubscribe();
  channel = null;
  await stopPush().catch(() => {});
  await supabase.auth.signOut();
  localStorage.removeItem(OWNER);
  resetLocal();
  L({ phase: 'signedOut', profile: null, school: null, schools: [] });
}

// ---------------------------------------------------------------- account actions (server functions)
export const rpc = async (fn, args) => must(await supabase.rpc(fn, args));
export const setAccountStatus = (target, status, reason) => rpc('set_account_status', { target, new_status: status, reason: reason || null });
export const deleteAccount = (target) => rpc('delete_account', { target });
export const setSchoolStatus = (sid, status, reason) => rpc('set_school_status', { sid, new_status: status, reason: reason || null });
export const deleteSchool = (sid) => rpc('delete_school', { sid });
export const regenerateCode = () => rpc('regenerate_code');
export const resetPassword = (target, password) => rpc('reset_member_password', { target, new_password: password });
/** Re-reads the account list (after approving, suspending…) without waiting for the realtime echo. */
export async function refreshUsers() {
  const users = await loadUsers();
  useDB.setState({ users });
  if (useLive.getState().profile?.role === 'superadmin') await loadPlatform();
}
