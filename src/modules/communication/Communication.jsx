import { schoolPrefix } from '../../lib/numbers';
import { smsAudiences } from '../../lib/sms';
import { LIVE } from '../../config';
import { useState } from 'react';
import { Inbox, Send, Megaphone, MessageSquareText, PenSquare, Pin, Reply, Smartphone } from 'lucide-react';
import { useDB } from '../../data/store';
import { useCurrentUser, useLookups, TODAY } from '../../data/selectors';
import { fmtDate, fmtDateTime, nowISO } from '../../lib/format';
import { ROLES } from '../../lib/permissions';
import { Card, PageHeader, Tabs, Badge, Avatar, Button, Modal, Field, Select, Input, Textarea, EmptyState, FormModal, DataTable, toast, cx } from '../../components/ui';
import { userPhotoKey } from '../../data/photos';

const AUDIENCE_FOR = { admin: null, teacher: ['All', 'Staff'], accountant: ['All', 'Staff'], librarian: ['All', 'Staff'], storekeeper: ['All', 'Staff'], transport: ['All', 'Staff'], parent: ['All', 'Parents'], student: ['All', 'Students'] };

export default function Communication() {
  const db = useDB();
  const user = useCurrentUser();
  const L = useLookups();
  const isAdmin = (user.role === 'admin' || user.role === 'headteacher');
  const canSms = ['admin', 'accountant'].includes(user.role);
  const [tab, setTab] = useState('inbox');
  const [openMsg, setOpenMsg] = useState(null);
  const [compose, setCompose] = useState(null);
  const [noticeForm, setNoticeForm] = useState(null);
  const [sms, setSms] = useState({ audience: 'All Parents', message: '' });

  const userName = (id) => db.users.find((u) => u.id === id)?.name || '—';
  const inbox = db.messages.filter((m) => m.toId === user.id).sort((a, b) => b.date.localeCompare(a.date));
  const sent = db.messages.filter((m) => m.fromId === user.id).sort((a, b) => b.date.localeCompare(a.date));
  const aud = AUDIENCE_FOR[user.role];
  const notices = db.notices.filter((n) => !aud || aud.includes(n.audience)).sort((a, b) => (b.pinned - a.pinned) || b.date.localeCompare(a.date));
  const list = tab === 'inbox' ? inbox : sent;

  const open = (m) => {
    setOpenMsg(m);
    if (m.toId === user.id && !m.read) db.update('messages', m.id, { read: true });
  };
  const send = () => {
    if (!compose.toId || !compose.subject || !compose.body) return toast.error('Fill in recipient, subject and message');
    db.add('messages', { fromId: user.id, toId: compose.toId, subject: compose.subject, body: compose.body, date: nowISO(), read: false });
    toast.success('Message sent', `To ${userName(compose.toId)}`);
    setCompose(null);
  };
  const audiencePhones = smsAudiences(db);
  const audienceCount = Object.fromEntries(Object.entries(audiencePhones).map(([k, v]) => [k, v.length]));

  return (
    <>
      <PageHeader
        title="Communication"
        subtitle="Messages, notice board and SMS broadcasts"
        actions={
          <>
            {isAdmin && <Button variant="secondary" icon={Megaphone} onClick={() => setNoticeForm({ audience: 'All', priority: 'Normal', pinned: false })}>New notice</Button>}
            <Button icon={PenSquare} onClick={() => setCompose({})}>Compose</Button>
          </>
        }
      />
      <Tabs className="mb-6" value={tab} onChange={setTab} tabs={[
        { value: 'inbox', label: 'Inbox', icon: Inbox, count: inbox.filter((m) => !m.read).length || undefined },
        { value: 'sent', label: 'Sent', icon: Send },
        { value: 'notices', label: 'Notice board', icon: Megaphone },
        ...(canSms ? [{ value: 'sms', label: 'SMS', icon: Smartphone }] : []),
      ]} />

      {(tab === 'inbox' || tab === 'sent') && (
        <Card className="overflow-hidden">
          {list.length === 0 ? <EmptyState icon={MessageSquareText} title="No messages" /> : (
            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {list.map((m) => {
                const other = tab === 'inbox' ? m.fromId : m.toId;
                const unread = tab === 'inbox' && !m.read;
                return (
                  <button key={m.id} onClick={() => open(m)} className={cx('flex w-full items-start gap-4 px-5 py-4 text-left transition hover:bg-slate-50 dark:hover:bg-white/[.03]', unread && 'bg-brand-50/50 dark:bg-brand-500/5')}>
                    <Avatar name={userName(other)} photo={userPhotoKey(db.users.find((u) => u.id === other))} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className={cx('truncate text-sm', unread ? 'font-bold text-slate-900 dark:text-white' : 'font-semibold text-slate-700 dark:text-slate-200')}>{userName(other)}</p>
                        <Badge tone="slate">{ROLES[db.users.find((u) => u.id === other)?.role]?.short}</Badge>
                        {unread && <span className="h-2 w-2 rounded-full bg-accent-600" />}
                      </div>
                      <p className={cx('truncate text-sm', unread ? 'font-semibold text-slate-800 dark:text-slate-100' : 'text-slate-600 dark:text-slate-300')}>{m.subject}</p>
                      <p className="truncate text-xs text-slate-500">{m.body}</p>
                    </div>
                    <span className="shrink-0 text-xs text-slate-400">{fmtDate(m.date, 'd MMM')}</span>
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {tab === 'notices' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {notices.map((n) => (
            <Card key={n.id} className={cx('p-5', n.priority === 'High' && 'border-l-4 border-l-accent-600')}>
              <div className="flex flex-wrap items-center gap-2">
                {n.pinned && <Badge tone="blue"><Pin className="h-3 w-3" /> Pinned</Badge>}
                {n.priority === 'High' && <Badge tone="red">Important</Badge>}
                <Badge tone="slate">{n.audience}</Badge>
                <span className="ml-auto text-xs text-slate-400">{fmtDate(n.date)}</span>
              </div>
              <p className="mt-3 text-lg font-bold text-slate-900 dark:text-white">{n.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{n.body}</p>
              <p className="mt-4 text-xs text-slate-400">— {L.staffName(n.authorId)}</p>
              {isAdmin && (
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setNoticeForm(n)}>Edit</Button>
                  <Button size="sm" variant="ghost" className="text-accent-600" onClick={() => { db.remove('notices', n.id); toast.success('Notice removed'); }}>Delete</Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {tab === 'sms' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[400px_1fr]">
          <Card className="p-5">
            <p className="mb-4 font-bold text-slate-900 dark:text-white">Send bulk SMS</p>
            <div className="space-y-4">
              <Field label="Audience"><Select value={sms.audience} onChange={(e) => setSms({ ...sms, audience: e.target.value })} options={Object.entries(audienceCount).map(([k, v]) => ({ value: k, label: `${k} (${v})` }))} /></Field>
              <Field label="Message" hint={`${sms.message.length}/160 characters · ${Math.max(1, Math.ceil(sms.message.length / 160))} SMS each`}>
                <Textarea value={sms.message} onChange={(e) => setSms({ ...sms, message: e.target.value })} placeholder={`${schoolPrefix(db.settings)}: …`} />
              </Field>
              <Button className="w-full" icon={Send} onClick={() => {
                if (!sms.message.trim()) return toast.error('Type a message');
                const to = audiencePhones[sms.audience] || [];
                if (!to.length) return toast.error('No phone numbers', 'Nobody in this group has a phone number saved');
                db.add('smsLog', { date: nowISO(), audience: sms.audience, message: sms.message, to, recipients: to.length, status: 'Delivered' });
                toast.success(LIVE ? 'Sending SMS' : 'SMS sent', `${to.length} recipients`);
                setSms({ ...sms, message: '' });
              }} disabled={!audienceCount[sms.audience]}>Send to {audienceCount[sms.audience] || 0} recipients</Button>
              <p className="text-xs text-slate-400">Demo mode: messages are logged, not actually delivered. Connect an SMS provider (e.g. Hubtel, Arkesel) in production.</p>
            </div>
          </Card>
          <DataTable rows={db.smsLog} initialSort={{ key: 'date', dir: 'desc' }} columns={[
            { key: 'date', label: 'Sent', render: (s) => fmtDateTime(s.date) },
            { key: 'audience', label: 'Audience', render: (s) => <span className="font-semibold">{s.audience}</span> },
            { key: 'message', label: 'Message', render: (s) => <span className="line-clamp-2 max-w-md whitespace-normal text-xs text-slate-500">{s.message}</span> },
            { key: 'recipients', label: 'To', render: (s) => (s.delivered != null && s.delivered !== s.recipients ? `${s.delivered}/${s.recipients}` : s.recipients) },
            { key: 'status', label: 'Status', render: (s) => (
              <div className="max-w-[220px] whitespace-normal">
                <Badge tone={{ Delivered: 'green', Failed: 'red', Sending: 'blue', Queued: 'amber' }[s.status] || 'slate'}>{s.status}</Badge>
                {s.error && <p className="mt-1 text-[11px] leading-snug text-accent-600">{s.error}</p>}
              </div>
            ) },
          ]} />
        </div>
      )}

      <Modal open={!!openMsg} onClose={() => setOpenMsg(null)} title={openMsg?.subject} subtitle={openMsg && `${userName(openMsg.fromId)} → ${userName(openMsg.toId)} · ${fmtDateTime(openMsg.date)}`}
        footer={openMsg?.toId === user.id && <Button icon={Reply} onClick={() => { setCompose({ toId: openMsg.fromId, subject: `Re: ${openMsg.subject.replace(/^Re: /, '')}` }); setOpenMsg(null); }}>Reply</Button>}>
        <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700 dark:text-slate-300">{openMsg?.body}</p>
      </Modal>
      <Modal open={!!compose} onClose={() => setCompose(null)} title="New message" footer={<><Button variant="secondary" onClick={() => setCompose(null)}>Cancel</Button><Button icon={Send} onClick={send}>Send</Button></>}>
        {compose && (
          <div className="space-y-4">
            <Field label="To"><Select value={compose.toId || ''} onChange={(e) => setCompose({ ...compose, toId: e.target.value })} placeholder="Select recipient…" options={db.users.filter((u) => u.id !== user.id).map((u) => ({ value: u.id, label: `${u.name} · ${ROLES[u.role].label}` }))} /></Field>
            <Field label="Subject"><Input value={compose.subject || ''} onChange={(e) => setCompose({ ...compose, subject: e.target.value })} /></Field>
            <Field label="Message"><Textarea value={compose.body || ''} onChange={(e) => setCompose({ ...compose, body: e.target.value })} className="min-h-[160px]" /></Field>
          </div>
        )}
      </Modal>
      <FormModal open={!!noticeForm} onClose={() => setNoticeForm(null)} title={noticeForm?.id ? 'Edit notice' : 'New notice'} initial={noticeForm}
        fields={[
          { name: 'title', label: 'Title', required: true, span: 2 },
          { name: 'audience', label: 'Audience', type: 'select', options: ['All', 'Parents', 'Students', 'Staff'] },
          { name: 'priority', label: 'Priority', type: 'select', options: ['Normal', 'High'] },
          { name: 'pinned', label: 'Pin to top', type: 'checkbox' },
          { name: 'body', label: 'Message', type: 'textarea', required: true },
        ]}
        onSubmit={(v) => {
          if (v.id) db.update('notices', v.id, v); else db.add('notices', { ...v, date: TODAY, authorId: user.linkedId });
          toast.success('Notice published'); setNoticeForm(null);
        }}
      />
    </>
  );
}
