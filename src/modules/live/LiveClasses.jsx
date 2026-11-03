import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Video, Radio, Copy, Users, CalendarClock, KeyRound, Send, Trash2, Clock, History, WifiOff } from 'lucide-react';
import { useNetwork } from '../../data/offline';
import { useDB } from '../../data/store';
import { useLookups, useCurrentUser, usePortalStudent, sortedClasses, TODAY } from '../../data/selectors';
import { fmtDate, nowISO } from '../../lib/format';
import { makeRoomCode, normalizeCode, isValidCode, inviteLink, sessionStatus, canHost } from '../../lib/live';
import { Card, PageHeader, Tabs, Button, Badge, StatCard, Input, Modal, FormModal, EmptyState, IconButton, Avatar, toast, confirmDialog, cx } from '../../components/ui';
import { photoKey } from '../../data/photos';

const TONE = { Live: 'red', 'Starting soon': 'amber', Scheduled: 'blue', Ended: 'slate', Missed: 'slate' };

export default function LiveClasses() {
  const db = useDB();
  const L = useLookups();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const { student } = usePortalStudent();
  const [tab, setTab] = useState('upcoming');
  const [form, setForm] = useState(null);
  const [code, setCode] = useState('');
  const [detail, setDetail] = useState(null);
  const net = useNetwork();
  const isStaff = ['admin', 'superadmin', 'teacher'].includes(user.role);
  const isTeacher = user.role === 'teacher';

  const alloc = db.allocations.filter((a) => !isTeacher || a.teacherId === user.linkedId);
  const myClassIds = new Set(isStaff ? alloc.map((a) => a.classId) : student ? [student.classId] : []);
  const visible = db.liveSessions.filter((s) => (user.role === 'admin' || user.role === 'superadmin' ? true : isTeacher ? s.teacherId === user.linkedId || myClassIds.has(s.classId) : myClassIds.has(s.classId)));
  const withStatus = visible.map((s) => ({ ...s, st: sessionStatus(s) })).sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
  const upcoming = withStatus.filter((s) => !['Ended', 'Missed'].includes(s.st));
  const past = withStatus.filter((s) => ['Ended', 'Missed'].includes(s.st)).reverse();
  const list = tab === 'upcoming' ? upcoming : past;

  const classOpts = sortedClasses(db.classes).filter((c) => user.role !== 'teacher' || alloc.some((a) => a.classId === c.id)).map((c) => ({ value: c.id, label: c.name }));
  const subjOpts = (v) => db.allocations.filter((a) => a.classId === v.classId && (!isTeacher || a.teacherId === user.linkedId)).map((a) => ({ value: a.subjectId, label: L.subjectName(a.subjectId) }));

  const schedule = (v) => {
    const teacherId = isTeacher ? user.linkedId : db.allocations.find((a) => a.classId === v.classId && a.subjectId === v.subjectId)?.teacherId || user.linkedId;
    const s = db.add('liveSessions', { ...v, duration: Number(v.duration) || 45, teacherId, code: makeRoomCode(), status: 'Scheduled', attendance: [], chat: [], provider: v.provider || null });
    toast.success('Live class scheduled', `Class code ${s.code}`);
    setForm(null);
    setDetail(s);
  };
  const notify = (s) => {
    const cls = L.cls(s.classId);
    db.add('notices', { title: `Live class: ${s.title}`, body: `${cls?.name} ${L.subjectName(s.subjectId)} live class on ${fmtDate(s.date, 'EEEE d MMMM')} at ${s.start}. Open Live Classes in the app to join, or use class code ${s.code}.`, audience: 'Students', priority: 'Normal', date: TODAY, authorId: s.teacherId, pinned: false });
    db.add('smsLog', { date: nowISO(), audience: `Parents · ${cls?.name}`, message: `${db.settings.schoolName}: ${cls?.name} ${L.subjectName(s.subjectId)} live class ${fmtDate(s.date, 'd MMM')} ${s.start}. Class code ${s.code}.`, recipients: db.students.filter((x) => x.classId === s.classId).length, status: 'Delivered' });
    toast.success('Class notified', 'Notice posted and parents texted');
  };
  const join = () => {
    if (!isValidCode(code)) return toast.error('Enter the 8-character class code, e.g. K7Q4-MZ9P');
    navigate(`/live/room/${normalizeCode(code)}`);
  };

  const d = detail && db.liveSessions.find((x) => x.id === detail.id);

  return (
    <>
      <PageHeader
        title="Live Classes"
        subtitle={isStaff ? 'Teach live with video, audio, screen sharing and chat' : 'Join your live lessons with camera and microphone'}
        actions={isStaff && user.role !== 'parent' && <Button icon={Plus} onClick={() => setForm({ date: TODAY, start: '16:00', duration: 45, classId: classOpts[0]?.value })}>Schedule live class</Button>}
      />
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr_1.4fr]">
        <StatCard label="Live now" value={withStatus.filter((s) => s.st === 'Live').length} icon={Radio} tone="red" />
        <StatCard label="Upcoming" value={upcoming.length} icon={CalendarClock} tone="blue" sub={upcoming[0] ? `Next: ${fmtDate(upcoming[0].date, 'EEE d MMM')} ${upcoming[0].start}` : undefined} />
        {user.role !== 'parent' && (
          <Card className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Join with a class code</p>
            <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); join(); }}>
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="K7Q4-MZ9P" className="font-mono uppercase tracking-widest" maxLength={9} />
              <Button type="submit" icon={KeyRound}>Join</Button>
            </form>
          </Card>
        )}
      </div>

      {!net.online && <Card className="mb-6 flex items-center gap-3 border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"><WifiOff className="h-5 w-5 shrink-0" /> You're offline. You can still view and schedule classes; joining a live class needs internet.</Card>}
      {net.online && net.slow && <Card className="mb-6 p-4 text-sm text-slate-600 dark:text-slate-300">Slow connection detected — classes will start in <b>low-data</b> mode. You can switch to audio-only inside the class.</Card>}
      <Tabs className="mb-6" value={tab} onChange={setTab} tabs={[{ value: 'upcoming', label: 'Upcoming', icon: CalendarClock, count: upcoming.length }, { value: 'past', label: 'Past', icon: History, count: past.length }]} />

      {list.length === 0 ? (
        <Card><EmptyState icon={Video} title={tab === 'upcoming' ? 'No live classes scheduled' : 'No past live classes'} text={isStaff && tab === 'upcoming' ? 'Schedule one and share the class code with your students.' : undefined} /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((s) => {
            const host = canHost(user, s);
            const today = s.date === TODAY;
            return (
              <Card key={s.id} className={cx('flex flex-col p-5', s.st === 'Live' && '!border-accent-400 ring-4 ring-accent-500/10')}>
                <div className="flex items-start justify-between gap-2">
                  <div className={cx('flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-lg', s.st === 'Live' ? 'bg-accent-600 shadow-accent-600/30' : 'bg-brand-600 shadow-brand-600/30')}>
                    {s.st === 'Live' ? <Radio className="h-5 w-5 animate-pulse" /> : <Video className="h-5 w-5" />}
                  </div>
                  <Badge tone={TONE[s.st]} dot>{s.st}</Badge>
                </div>
                <button className="mt-4 text-left" onClick={() => setDetail(s)}>
                  <p className="font-bold text-slate-900 hover:text-brand-700 dark:text-white">{s.title}</p>
                  <p className="text-xs text-slate-500">{L.className(s.classId)} · {L.subjectName(s.subjectId)}</p>
                </button>
                <div className="mt-3 space-y-1 text-xs text-slate-500">
                  <p className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {fmtDate(s.date, 'EEE d MMM')} · {s.start} · {s.duration} min</p>
                  <p className="flex items-center gap-1.5"><Avatar name={L.staffName(s.teacherId)} photo={photoKey('Staff', s.teacherId)} size="xs" className="!h-5 !w-5 !text-[8px]" /> {L.staffName(s.teacherId)}</p>
                  {s.st === 'Ended' && <p className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> {s.attendance?.length || 0} attended</p>}
                </div>
                <div className="mt-auto flex gap-2 pt-4">
                  {tab === 'upcoming' && user.role !== 'parent' && (
                    <Button className="flex-1" variant={s.st === 'Live' || (today && host) ? 'primary' : 'soft'} icon={host ? Radio : Video} onClick={() => navigate(`/live/room/${s.code}`)}>
                      {host ? (s.st === 'Live' ? 'Rejoin as host' : 'Start class') : s.st === 'Live' ? 'Join now' : 'Join'}
                    </Button>
                  )}
                  {tab === 'past' && <Button className="flex-1" variant="soft" icon={Users} onClick={() => setDetail(s)}>Attendance</Button>}
                  <IconButton icon={Copy} label="Copy invite link" tone="secondary" onClick={() => { navigator.clipboard?.writeText(inviteLink(s.code)); toast.success('Invite link copied', `Class code ${s.code}`); }} />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={!!d} onClose={() => setDetail(null)} title={d?.title} subtitle={d && `${L.className(d.classId)} · ${L.subjectName(d.subjectId)} · ${fmtDate(d.date, 'EEE d MMM')} ${d.start}`} size="lg"
        footer={d && canHost(user, d) && (
          <>
            <Button variant="soft-red" icon={Trash2} onClick={async () => { if (await confirmDialog('Delete this live class?', d.title)) { db.remove('liveSessions', d.id); setDetail(null); toast.success('Deleted'); } }}>Delete</Button>
            {sessionStatus(d) !== 'Ended' && <Button variant="secondary" icon={Send} onClick={() => notify(d)}>Notify class & parents</Button>}
            {sessionStatus(d) !== 'Ended' && <Button icon={Radio} onClick={() => navigate(`/live/room/${d.code}`)}>Start class</Button>}
          </>
        )}>
        {d && (
          <div className="space-y-5">
            {d.description && <p className="text-sm text-slate-600 dark:text-slate-300">{d.description}</p>}
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-brand-50 p-4 dark:bg-brand-500/10">
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase text-slate-500">Class code</p>
                <p className="font-mono text-2xl font-extrabold tracking-widest text-brand-700 dark:text-brand-300">{d.code}</p>
              </div>
              <Button variant="secondary" icon={Copy} onClick={() => { navigator.clipboard?.writeText(inviteLink(d.code)); toast.success('Invite link copied'); }}>Copy link</Button>
            </div>
            <div>
              <p className="label">Attendance ({d.attendance?.length || 0})</p>
              {!d.attendance?.length ? <p className="text-sm text-slate-500">Attendance is recorded automatically while the class is live.</p> : (
                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 dark:divide-white/5 dark:border-white/5">
                  {d.attendance.map((a, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <Avatar name={a.name} photo={photoKey(a.personType, a.personId)} size="xs" />
                      <span className="flex-1">{a.name}</span>
                      <span className="text-xs text-slate-500">{a.joinedAt} – {a.leftAt || 'still in'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {d.chat?.length > 0 && (
              <div>
                <p className="label">Chat transcript</p>
                <div className="max-h-56 space-y-2 overflow-y-auto rounded-2xl bg-slate-50 p-3 text-sm dark:bg-white/5">
                  {d.chat.map((m) => <p key={m.id}><b>{m.from}:</b> {m.text}</p>)}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <FormModal open={!!form} onClose={() => setForm(null)} title="Schedule a live class" initial={form} onSubmit={schedule}
        fields={[
          { name: 'title', label: 'Title', required: true, span: 2, placeholder: 'e.g. Simultaneous equations' },
          { name: 'classId', label: 'Class', type: 'select', options: classOpts, required: true },
          { name: 'subjectId', label: 'Subject', type: 'select', options: subjOpts, required: true },
          { name: 'date', label: 'Date', type: 'date', required: true },
          { name: 'start', label: 'Start time', type: 'time', required: true },
          { name: 'duration', label: 'Duration (minutes)', type: 'number' },
          { name: 'provider', label: 'Video', type: 'select', options: [{ value: 'p2p', label: `Built-in (up to ${db.settings.live.maxParticipants} people)` }, { value: 'jitsi', label: 'Large class (Jitsi)' }], placeholder: `School default (${db.settings.live.provider === 'jitsi' ? 'Jitsi' : 'built-in'})` },
          { name: 'description', label: 'Notes for students', type: 'textarea' },
        ]}
      />
    </>
  );
}
