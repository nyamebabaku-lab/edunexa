// EduNexa SMS via mNotify — each school uses its own mNotify API key and sender ID (edunexa.sms_settings).
// Keys never leave the server. Only active staff of an active school can send, only to that school's own
// parents / staff phone numbers, within the school's daily limit. Every message is logged in edunexa.sms_log.
//
// Actions (POST JSON):
//   { smsId }                         send the queued smsLog record (written by the app) and mark it Delivered/Failed
//   { action: 'test', to }            Super Admin / Owner-Admin: one test text
//   { action: 'balance', schoolId? }  Super Admin / Owner-Admin: mNotify credit for the school's account
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { db: { schema: 'edunexa' } });
const SENDERS = ['admin', 'headteacher', 'teacher', 'accountant', 'librarian', 'storekeeper', 'transport', 'canteen', 'hostel', 'staff', 'kiosk'];

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

/** 0241234567 / +233 24 123 4567 / 241234567 → 0241234567, or null. */
function normPhone(p: unknown): string | null {
  let d = String(p ?? '').replace(/\D/g, '');
  if (d.startsWith('233')) d = `0${d.slice(3)}`;
  if (d.length === 9) d = `0${d}`;
  return /^0\d{9}$/.test(d) ? d : null;
}

async function mnotify(key: string, path: string, init?: RequestInit) {
  const res = await fetch(`https://api.mnotify.com/api/${path}${path.includes('?') ? '&' : '?'}key=${encodeURIComponent(key)}`, init);
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text);
  } catch {
    json = { message: text.slice(0, 200) };
  }
  return { ok: res.ok, json };
}

async function sendBatch(key: string, sender: string, recipients: string[], message: string) {
  const r = await mnotify(key, 'sms/quick', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ recipient: recipients, sender, message, is_schedule: false, schedule_date: '' }),
  });
  const sent = r.ok && (r.json.status === 'success' || String(r.json.code) === '2000');
  return { sent, error: sent ? null : String(r.json.message ?? 'mNotify did not accept the message') };
}

/** Every phone number that belongs to the school (parents, staff, accounts). */
async function schoolPhones(schoolId: string) {
  const phones = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data } = await db.from('records').select('data').eq('school_id', schoolId).in('col', ['parents', 'staff']).range(from, from + 999);
    (data ?? []).forEach((r: { data: Record<string, unknown> }) => [r.data.phone, r.data.altPhone].map(normPhone).forEach((p) => p && phones.add(p)));
    if (!data || data.length < 1000) break;
  }
  const { data: profs } = await db.from('profiles').select('phone').eq('school_id', schoolId);
  (profs ?? []).forEach((p: { phone: string }) => normPhone(p.phone) && phones.add(normPhone(p.phone)!));
  return phones;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return reply('ok');
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth } = await db.auth.getUser(jwt);
  if (!auth?.user) return reply({ ok: false, error: 'Sign in first' }, 401);
  const { data: me } = await db.from('profiles').select('user_id, role, status, phone, school_id').eq('user_id', auth.user.id).maybeSingle();
  if (!me || me.status !== 'active') return reply({ ok: false, error: 'Account not active' }, 403);

  let body: { action?: string; smsId?: string; to?: string; schoolId?: string };
  try {
    body = await req.json();
  } catch {
    return reply({ ok: false, error: 'Bad request' }, 400);
  }

  const isSuper = me.role === 'superadmin';
  const schoolId = isSuper ? body.schoolId : me.school_id;
  if (!schoolId) return reply({ ok: false, error: 'No school' }, 400);
  if (!isSuper) {
    const { data: school } = await db.from('schools').select('status').eq('id', schoolId).maybeSingle();
    if (school?.status !== 'active') return reply({ ok: false, error: 'School not active' }, 403);
  }
  const { data: cfg } = await db.from('sms_settings').select('*').eq('school_id', schoolId).maybeSingle();

  // ---------------------------------------------------------------- balance / test (admins)
  if (body.action === 'balance' || body.action === 'test') {
    if (!isSuper && me.role !== 'admin') return reply({ ok: false, error: 'Not allowed' }, 403);
    if (!cfg) return reply({ ok: false, error: 'SMS is not set up for this school yet' }, 400);
    if (body.action === 'balance') {
      const r = await mnotify(cfg.api_key, 'balance/sms');
      return reply({ ok: r.ok && r.json.status !== 'error', balance: r.json.balance ?? null, bonus: r.json.bonus ?? null, error: r.ok ? null : String(r.json.message ?? 'Could not read the balance') });
    }
    const to = normPhone(body.to);
    if (!to) return reply({ ok: false, error: 'Enter a valid Ghana phone number' }, 400);
    const message = `EduNexa test: SMS for this school is working. Sender ID ${cfg.sender_id}.`;
    const r = await sendBatch(cfg.api_key, cfg.sender_id, [to], message);
    await db.from('sms_log').insert({ school_id: schoolId, sent_by: me.user_id, to_phone: to, message, status: r.sent ? 'sent' : 'failed', error: r.error });
    return reply({ ok: r.sent, error: r.error }, r.sent ? 200 : 502);
  }

  // ---------------------------------------------------------------- send a queued smsLog record
  if (!SENDERS.includes(me.role)) return reply({ ok: false, error: 'Not allowed' }, 403);
  if (!body.smsId) return reply({ ok: false, error: 'smsId is required' }, 400);
  const { data: rec } = await db.from('records').select('data').eq('school_id', schoolId).eq('col', 'smsLog').eq('id', body.smsId).maybeSingle();
  if (!rec) return reply({ ok: false, error: 'Message not found (not uploaded yet)', retry: true }, 404);
  const sms = rec.data as Record<string, unknown>;
  if (sms.status === 'Delivered' || sms.status === 'Failed') return reply({ ok: sms.status === 'Delivered', status: sms.status, already: true });

  const finish = async (status: 'Delivered' | 'Failed', extra: Record<string, unknown>) => {
    const data = { ...sms, status, sentAt: new Date().toISOString(), ...extra };
    await db.from('records').update({ data }).eq('school_id', schoolId).eq('col', 'smsLog').eq('id', body.smsId);
    return reply({ ok: status === 'Delivered', status, ...extra });
  };
  if (!cfg || !cfg.enabled) return finish('Failed', { error: 'SMS is not set up for this school yet — ask EduNexa to connect your mNotify account', delivered: 0 });

  const message = String(sms.message ?? '').trim().slice(0, 612);
  const allowed = await schoolPhones(schoolId);
  const wanted = [...new Set(((sms.to as string[]) ?? []).map(normPhone).filter(Boolean) as string[])];
  const recipients = wanted.filter((p) => allowed.has(p));
  const skipped = wanted.length - recipients.length;
  if (!message || !recipients.length) return finish('Failed', { error: 'No valid phone numbers of this school’s parents or staff', delivered: 0, skipped });

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await db.from('sms_log').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'sent').gte('at', since);
  if ((count ?? 0) + recipients.length > cfg.daily_limit) return finish('Failed', { error: `Daily SMS limit of ${cfg.daily_limit} reached`, delivered: 0 });

  let delivered = 0;
  let lastError: string | null = null;
  for (let i = 0; i < recipients.length; i += 100) {
    const chunk = recipients.slice(i, i + 100);
    const r = await sendBatch(cfg.api_key, cfg.sender_id, chunk, message);
    if (r.sent) delivered += chunk.length;
    else lastError = r.error;
    await db.from('sms_log').insert(chunk.map((to) => ({ school_id: schoolId, sent_by: me.user_id, sms_id: body.smsId, to_phone: to, message, status: r.sent ? 'sent' : 'failed', error: r.error })));
  }
  return finish(delivered ? 'Delivered' : 'Failed', { delivered, recipients: delivered, skipped, error: lastError });
});
