// mNotify SMS per school. Super Admin: connect a school's mNotify API key + sender ID.
// Owner/Admin: see the status, credit balance and send a test text.
import { useEffect, useState } from 'react';
import { MessageSquareText, KeyRound, Send, Wallet, CheckCircle2, AlertTriangle, Trash2 } from 'lucide-react';
import { supabase, must, friendly } from '../../lib/supabase';
import { Badge, Button, Card, CardHeader, Field, Input, Modal, Spinner, toast, confirmDialog } from '../../components/ui';

export const smsStatus = async (sid) => must(await supabase.rpc('school_sms_status', sid ? { sid } : {}));

async function callSms(body) {
  const { data, error } = await supabase.functions.invoke('edunexa-sms', { body });
  if (error) {
    let info = {};
    try { info = await error.context.json(); } catch { /* not JSON */ }
    throw new Error(info.error || friendly(error.message));
  }
  if (!data.ok) throw new Error(data.error || 'Not done');
  return data;
}

function StatusLines({ st }) {
  if (!st) return <Spinner className="h-5 w-5 text-brand-600" />;
  if (!st.configured) return <p className="flex items-center gap-2 text-sm text-amber-700"><AlertTriangle className="h-4 w-4" /> Not connected yet — texts are not sent.</p>;
  return (
    <div className="space-y-1.5 text-sm">
      <p className="flex flex-wrap items-center gap-2"><Badge tone={st.enabled ? 'green' : 'slate'} dot>{st.enabled ? 'On' : 'Switched off'}</Badge> Sender ID <b>{st.senderId}</b> · key {st.keyHint}</p>
      <p className="text-slate-500">{st.sentToday} sent in the last 24 h (limit {st.dailyLimit}){st.failedToday ? ` · ${st.failedToday} failed` : ''}</p>
    </div>
  );
}

function TestAndBalance({ schoolId, defaultPhone = '' }) {
  const [phone, setPhone] = useState(defaultPhone);
  const [busy, setBusy] = useState('');
  const [bal, setBal] = useState(null);
  const test = async () => {
    setBusy('test');
    try { await callSms({ action: 'test', to: phone, schoolId }); toast.success('Test SMS sent', `Check ${phone}`); } catch (e) { toast.error('Test failed', e.message); }
    setBusy('');
  };
  const balance = async () => {
    setBusy('bal');
    try { const d = await callSms({ action: 'balance', schoolId }); setBal(d); } catch (e) { toast.error('Could not read the balance', e.message); }
    setBusy('');
  };
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="024 123 4567" inputMode="tel" />
        <Button variant="secondary" icon={busy === 'test' ? Spinner : Send} disabled={!!busy || phone.replace(/\D/g, '').length < 9} onClick={test}>Test</Button>
      </div>
      <div className="flex items-center gap-3">
        <Button size="sm" variant="ghost" icon={busy === 'bal' ? Spinner : Wallet} disabled={!!busy} onClick={balance}>Check mNotify balance</Button>
        {bal && <span className="text-sm font-semibold">{bal.balance ?? '—'} SMS credit{bal.bonus ? ` + ${bal.bonus} bonus` : ''}</span>}
      </div>
    </div>
  );
}

/** Super Admin: connect / change / remove a school's mNotify account. */
export function SchoolSmsModal({ school, onClose }) {
  const [st, setSt] = useState(null);
  const [v, setV] = useState({ key: '', sender: '', limit: 1000, enabled: true });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!school) return;
    setSt(null);
    smsStatus(school.id).then((s) => { setSt(s); setV({ key: '', sender: s.senderId || '', limit: s.dailyLimit || 1000, enabled: s.configured ? s.enabled : true }); }).catch((e) => toast.error(e.message));
  }, [school]);
  const save = async (remove) => {
    if (remove && !(await confirmDialog('Disconnect SMS?', `${school.name} will stop sending texts until a new mNotify key is added.`, { confirmLabel: 'Disconnect' }))) return;
    setBusy(true);
    try {
      const s = must(await supabase.rpc('set_school_sms', { sid: school.id, api_key: remove ? null : v.key || null, sender_id: remove ? '' : v.sender, daily_limit: Number(v.limit) || 1000, enabled: v.enabled }));
      setSt(s);
      setV({ ...v, key: '' });
      toast.success(remove ? 'SMS disconnected' : 'SMS saved', remove ? school.name : `Sender ID ${s.senderId}`);
    } catch (e) { toast.error('Not saved', e.message); }
    setBusy(false);
  };
  return (
    <Modal open={!!school} onClose={onClose} title={`SMS for ${school?.name || ''}`} subtitle="Paste this school's own mNotify API key and approved sender ID. The key is stored on the server only — the apps never see it." size="lg"
      footer={<>
        {st?.configured && <Button variant="soft-red" icon={Trash2} onClick={() => save(true)} disabled={busy}>Disconnect</Button>}
        <Button variant="secondary" onClick={onClose}>Close</Button>
        <Button icon={busy ? Spinner : KeyRound} disabled={busy || !v.sender.trim() || (!st?.configured && !v.key.trim())} onClick={() => save(false)}>Save</Button>
      </>}>
      <div className="space-y-5">
        <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5"><StatusLines st={st} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="mNotify API key" hint={st?.configured ? 'Leave blank to keep the saved key' : 'mNotify dashboard → API → API key'} className="sm:col-span-2">
            <Input type="password" value={v.key} onChange={(e) => setV({ ...v, key: e.target.value })} placeholder={st?.configured ? `Saved (${st.keyHint})` : 'Paste the API key'} autoComplete="off" />
          </Field>
          <Field label="Sender ID" hint="Max 11 characters, approved on mNotify"><Input value={v.sender} maxLength={11} onChange={(e) => setV({ ...v, sender: e.target.value })} placeholder="e.g. BrightStar" /></Field>
          <Field label="Daily limit" hint="Most texts this school can send per 24 h"><Input type="number" min="1" value={v.limit} onChange={(e) => setV({ ...v, limit: e.target.value })} /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.enabled} onChange={(e) => setV({ ...v, enabled: e.target.checked })} /> SMS switched on for this school</label>
        {st?.configured && (
          <div className="border-t border-slate-100 pt-4 dark:border-white/5">
            <p className="mb-2 text-sm font-semibold">Send a test text</p>
            <TestAndBalance schoolId={school.id} />
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Owner/Admin settings card. */
export function SchoolSmsCard({ myPhone }) {
  const [st, setSt] = useState(null);
  useEffect(() => { smsStatus().then(setSt).catch(() => setSt({ configured: false })); }, []);
  return (
    <Card>
      <CardHeader title="SMS (mNotify)" icon={MessageSquareText} subtitle="Texts to parents and staff: absences, fee reminders, gate arrivals and announcements" />
      <div className="space-y-4 p-5">
        <StatusLines st={st} />
        {st?.configured ? (
          <>
            <p className="flex items-center gap-1.5 text-xs text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Connected by EduNexa. Credit is bought on your mNotify account.</p>
            <TestAndBalance defaultPhone={myPhone} />
          </>
        ) : st && <p className="text-sm text-slate-500">Contact EduNexa to connect your school's mNotify account. Until then, texts appear in the SMS history as “Failed — not set up”.</p>}
      </div>
    </Card>
  );
}
