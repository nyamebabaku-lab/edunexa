import { SchoolSmsCard } from '../accounts/SmsSetup';
import { MessageSquareText } from 'lucide-react';
import { LIVE } from '../../config';
import { useEffect, useRef, useState } from 'react';
import {
  Save, School, CalendarRange, Award, ShieldCheck, Database, Smartphone, RotateCcw, Download, Moon, Check, Minus, Palette, Blocks,
  LockKeyhole, DoorOpen, Users, Upload, Trash2, Globe, UserPlus, KeyRound, Ban, CircleCheck, Video, Wifi, WifiOff, HardDrive, MonitorDown,
} from 'lucide-react';
import { useDB, useSession } from '../../data/store';
import { useCurrentUser } from '../../data/selectors';
import { fmtDate, fmtDateTime, fullName } from '../../lib/format';
import { SCALES } from '../../lib/grading';
import { ROLES, NAV, TOGGLEABLE_MODULES, canAccess } from '../../lib/permissions';
import { PRESETS, applyTheme, fileToLogo, themePalettes } from '../../lib/theme';
import { hashPassword, newUserRecord, portalRoleForStaff } from '../../lib/auth';
import { Card, CardHeader, PageHeader, Tabs, Button, Field, Input, Select, Badge, Avatar, DataTable, Modal, IconButton, toast, confirmDialog, cx } from '../../components/ui';
import { LogoMark } from '../../components/layout/Logo';
import { usePhotos, clearPhotos } from '../../data/photos';
import { useInstall, useNetwork, storageEstimate } from '../../data/offline';
import { userPhotoKey } from '../../data/photos';

const clone = (o) => JSON.parse(JSON.stringify(o));

function Toggle({ checked, onChange, label, desc }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <span>
        <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</span>
        {desc && <span className="block text-xs text-slate-500">{desc}</span>}
      </span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={cx('relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition', checked ? 'bg-brand-600' : 'bg-slate-300 dark:bg-white/20')}>
        <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
    </label>
  );
}

// ---------------------------------------------------------------- Branding
function Branding({ s, setS }) {
  const fileRef = useRef(null);
  const pal = themePalettes(s.theme);
  useEffect(() => applyTheme(s.theme), [s.theme]);
  useEffect(() => () => applyTheme(useDB.getState().settings.theme), []);
  const upload = async (f) => {
    if (!f) return;
    try {
      setS({ ...s, logo: await fileToLogo(f) });
      toast.success('Logo ready', 'Save changes to apply it everywhere');
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <Card className="p-6">
          <p className="mb-4 font-bold text-slate-900 dark:text-white">Identity</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {!LIVE && <Field label="App name" hint="Shown in the sidebar, sign-in page and browser tab"><Input value={s.appName} onChange={(e) => setS({ ...s, appName: e.target.value })} /></Field>}
            <Field label="Tagline" hint={LIVE ? 'Shown under your school name in the menu' : undefined}><Input value={s.tagline || ''} placeholder={LIVE ? 'e.g. Knowledge is light' : 'School Suite'} onChange={(e) => setS({ ...s, tagline: e.target.value })} /></Field>
            <Field label="School name" className="sm:col-span-2"><Input value={s.schoolName} onChange={(e) => setS({ ...s, schoolName: e.target.value })} /></Field>
            <Field label="Motto" className="sm:col-span-2"><Input value={s.motto} onChange={(e) => setS({ ...s, motto: e.target.value })} /></Field>
          </div>
        </Card>
        <Card className="p-6">
          <p className="mb-4 font-bold text-slate-900 dark:text-white">School logo</p>
          <div className="flex flex-wrap items-center gap-5">
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-white/5">
              {s.logo ? <img src={s.logo} alt="School logo" className="max-h-full max-w-full object-contain" /> : <LogoMark className="h-16 w-16" />}
            </div>
            <div className="space-y-2">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files[0])} />
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" icon={Upload} onClick={() => fileRef.current.click()}>Upload logo</Button>
                {s.logo && <Button variant="soft-red" icon={Trash2} onClick={() => setS({ ...s, logo: null })}>Remove</Button>}
              </div>
              <p className="text-xs text-slate-500">PNG, JPG or SVG. Square images work best; it's resized to 256px. Used on the sidebar, sign-in page, receipts, report cards and ID badges.</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <p className="mb-4 font-bold text-slate-900 dark:text-white">Colours</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {PRESETS.map((p) => (
              <button key={p.id} onClick={() => setS({ ...s, theme: { preset: p.id, brand: p.brand, accent: p.accent } })}
                className={cx('flex items-center gap-3 rounded-2xl border p-3 text-left text-sm font-semibold transition', s.theme.preset === p.id ? 'border-brand-500 ring-4 ring-brand-500/15' : 'border-slate-200 hover:border-slate-300 dark:border-white/10')}>
                <span className="flex">
                  <span className="h-7 w-7 rounded-full ring-2 ring-white" style={{ background: p.brand }} />
                  <span className="-ml-2 h-7 w-7 rounded-full ring-2 ring-white" style={{ background: p.accent }} />
                </span>
                {p.name}
              </button>
            ))}
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {[['brand', 'Main colour'], ['accent', 'Accent colour']].map(([k, label]) => (
              <Field key={k} label={label}>
                <div className="flex items-center gap-2">
                  <input type="color" value={s.theme[k]} onChange={(e) => setS({ ...s, theme: { ...s.theme, preset: 'custom', [k]: e.target.value } })} className="h-11 w-14 cursor-pointer rounded-xl border border-slate-200 bg-white p-1 dark:border-white/10" />
                  <Input value={s.theme[k]} onChange={(e) => /^#[0-9a-f]{6}$/i.test(e.target.value) && setS({ ...s, theme: { ...s.theme, preset: 'custom', [k]: e.target.value } })} className="font-mono" />
                </div>
              </Field>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">Changes preview live. Pick a dark main colour so white text stays readable.</p>
        </Card>
      </div>
      <Card className="h-fit overflow-hidden xl:sticky xl:top-24">
        <CardHeader title="Preview" />
        <div className="m-5 overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-2 bg-navy-900 p-3">
            {s.logo ? <img src={s.logo} alt="" className="h-8 w-8 rounded-lg bg-white object-contain p-0.5" /> : <LogoMark className="h-8 w-8" />}
            <p className="truncate font-extrabold text-white">{s.appName}</p>
          </div>
          <div className="space-y-3 bg-slate-50 p-4 dark:bg-navy-950">
            <div className="rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white">Dashboard</div>
            <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-navy-900">
              <p className="text-xs font-semibold uppercase text-slate-400">Fees collected</p>
              <p className="text-xl font-extrabold">{s.currencySymbol} 650.8k</p>
              <div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-2 w-2/3 rounded-full bg-brand-600" /></div>
            </div>
            <div className="flex gap-2">
              <Button size="sm">Primary</Button>
              <Button size="sm" variant="danger">Accent</Button>
              <Badge tone="blue">Badge</Badge>
              <Badge tone="red">Alert</Badge>
            </div>
            <div className="flex gap-1">{[100, 300, 500, 600, 700, 900].map((k) => <span key={k} className="h-5 flex-1 rounded" style={{ background: pal.brand[k] }} />)}</div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- Security
function Security({ s, setS }) {
  const a = s.auth;
  const set = (patch) => setS({ ...s, auth: { ...a, ...patch } });
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card className="p-6">
        <p className="font-bold text-slate-900 dark:text-white">Sign-in method</p>
        <div className="mt-4 grid gap-3">
          {[['demo', 'Demo portals', 'One-click sign-in for each role. For showing the system to others. Password sign-in is still available.'], ['secure', 'Secure sign-in', 'Everyone signs in with email, phone or admission number plus a password. Demo buttons are hidden.']].map(([k, label, desc]) => (
            <button key={k} onClick={() => set({ mode: k })} className={cx('rounded-2xl border p-4 text-left transition', a.mode === k ? 'border-brand-500 bg-brand-50/50 ring-4 ring-brand-500/10 dark:bg-brand-500/10' : 'border-slate-200 dark:border-white/10')}>
              <p className="flex items-center gap-2 font-semibold">{a.mode === k && <CircleCheck className="h-4 w-4 text-brand-600" />}{label}</p>
              <p className="mt-1 text-xs text-slate-500">{desc}</p>
            </button>
          ))}
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Verification code (OTP)">
            <Select value={a.otp} onChange={(e) => set({ otp: e.target.value })} options={[{ value: 'off', label: 'Off' }, { value: 'admins', label: 'Admins & accountants' }, { value: 'all', label: 'Everyone' }]} />
          </Field>
          <Field label="Send codes by"><Select value={a.otpChannel} onChange={(e) => set({ otpChannel: e.target.value })} options={['SMS', 'Email', 'WhatsApp']} /></Field>
          <Field label="Session timeout (minutes)" hint="0 = never"><Input type="number" min="0" value={a.sessionTimeout} onChange={(e) => set({ sessionTimeout: Number(e.target.value) })} /></Field>
          <Field label="Failed attempts before lockout"><Input type="number" min="3" value={a.maxAttempts} onChange={(e) => set({ maxAttempts: Number(e.target.value) })} /></Field>
          <Field label="Lockout duration (minutes)"><Input type="number" min="1" value={a.lockMinutes} onChange={(e) => set({ lockMinutes: Number(e.target.value) })} /></Field>
        </div>
      </Card>
      <div className="space-y-6">
        <Card className="px-6 py-3">
          <p className="pt-3 font-bold text-slate-900 dark:text-white">Sign-up</p>
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            <Toggle checked={a.allowParentSignup} onChange={(v) => set({ allowParentSignup: v })} label="Parents can create their own account" desc="Checked against the child's admission number and date of birth, then verified by code" />
            <Toggle checked={a.signupApproval} onChange={(v) => set({ signupApproval: v })} label="New parent accounts need admin approval" desc="Approve them in Settings → Users" />
            <Toggle checked={a.allowStudentLogin} onChange={(v) => set({ allowStudentLogin: v })} label="Students can sign in with their admission number" />
          </div>
        </Card>
        <Card className="px-6 py-3">
          <p className="pt-3 font-bold text-slate-900 dark:text-white">Password rules</p>
          <div className="grid gap-4 py-3 sm:grid-cols-2">
            <Field label="Minimum length"><Input type="number" min="6" value={a.minPasswordLength} onChange={(e) => set({ minPasswordLength: Number(e.target.value) })} /></Field>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            <Toggle checked={a.requireNumber} onChange={(v) => set({ requireNumber: v })} label="Require at least one number" />
          </div>
        </Card>
        <p className="text-xs text-slate-500">In this prototype, codes appear on screen and in the SMS log instead of being delivered. A production setup sends them through an SMS/email provider and checks passwords on the server.</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Users
function UsersTab() {
  const db = useDB();
  const me = useCurrentUser();
  const [form, setForm] = useState(null);
  const [status, setStatus] = useState('');
  const rows = db.users.filter((u) => !status || u.status === status);
  const pending = db.users.filter((u) => u.status === 'Pending').length;

  const resetPw = async (u) => {
    if (!(await confirmDialog('Reset password?', `${u.name} will get a temporary password and should change it after signing in.`, { danger: false, confirmLabel: 'Reset' }))) return;
    const temp = `Temp${Math.floor(1000 + Math.random() * 9000)}`;
    db.update('users', u.id, { passwordHash: hashPassword(temp) });
    toast.success('Temporary password set', `${u.name}: ${temp}`);
  };
  const people = (role) => {
    if (role === 'parent') return db.parents.map((p) => ({ value: p.id, label: `${p.title} ${p.firstName} ${p.lastName} · ${p.phone}`, name: `${p.title} ${p.firstName} ${p.lastName}`, phone: p.phone, email: p.email }));
    if (role === 'student') return db.students.map((s) => ({ value: s.id, label: `${fullName(s)} · ${s.admissionNo}`, name: fullName(s), phone: '', email: '' }));
    return db.staff.map((s) => ({ value: s.id, label: `${s.title} ${s.firstName} ${s.lastName} · ${s.role}`, name: `${s.title} ${s.firstName} ${s.lastName}`, phone: s.phone, email: s.email, role: portalRoleForStaff(s) }));
  };
  const create = () => {
    const p = people(form.role).find((x) => x.value === form.linkedId);
    if (!p) return toast.error('Choose who this account is for');
    if (db.users.some((u) => u.linkedId === p.value && u.role === form.role)) return toast.error('That person already has an account');
    db.add('users', newUserRecord({ role: form.role, linkedId: p.value, name: p.name, email: form.email ?? p.email, phone: form.phone ?? p.phone, ...(form.password ? { passwordHash: hashPassword(form.password) } : {}) }));
    toast.success('Account created', form.password ? 'Share the password securely' : 'Default password: demo1234');
    setForm(null);
  };
  const roleOpts = Object.entries(ROLES).filter(([k]) => k !== 'superadmin' || me.role === 'superadmin').map(([k, r]) => ({ value: k, label: r.label }));

  return (
    <>
      <DataTable
        rows={rows}
        searchText={(u) => `${u.name} ${u.email} ${u.phone} ${u.role}`}
        toolbar={
          <>
            <Select className="!w-auto" value={status} onChange={(e) => setStatus(e.target.value)} options={['Active', 'Pending', 'Disabled']} placeholder={`Any status${pending ? ` · ${pending} pending` : ''}`} />
            <Button icon={UserPlus} onClick={() => setForm({ role: 'teacher' })}>Add account</Button>
          </>
        }
        columns={[
          { key: 'name', label: 'Account', render: (u) => <div className="flex items-center gap-3"><Avatar name={u.name} photo={userPhotoKey(u)} size="sm" /><div><p className="font-semibold">{u.name}</p><p className="text-xs text-slate-500">{u.email || u.username || u.phone || '—'}</p></div></div> },
          { key: 'role', label: 'Role', render: (u) => <Badge tone={u.role === 'superadmin' ? 'red' : u.role === 'admin' ? 'blue' : 'slate'}>{ROLES[u.role]?.label || u.role}</Badge> },
          { key: 'phone', label: 'Phone', hideOnMobile: true, render: (u) => u.phone || '—' },
          { key: 'lastLogin', label: 'Last sign-in', hideOnMobile: true, render: (u) => (u.lastLogin ? fmtDateTime(u.lastLogin) : 'Never') },
          { key: 'status', label: 'Status', render: (u) => <Badge tone={u.status === 'Active' ? 'green' : u.status === 'Pending' ? 'amber' : 'red'} dot>{u.status}</Badge> },
          {
            key: 'act', label: '', nosort: true, className: 'text-right',
            render: (u) => {
              const protectedRow = u.id === me.id || (u.role === 'superadmin' && me.role !== 'superadmin');
              return (
                <div className="flex justify-end gap-1">
                  {u.status === 'Pending' && <Button size="sm" icon={Check} onClick={() => { db.update('users', u.id, { status: 'Active' }); toast.success('Account approved', u.name); }}>Approve</Button>}
                  {!protectedRow && <IconButton icon={KeyRound} label="Reset password" onClick={() => resetPw(u)} />}
                  {!protectedRow && u.status !== 'Pending' && (
                    <IconButton icon={u.status === 'Disabled' ? CircleCheck : Ban} label={u.status === 'Disabled' ? 'Enable' : 'Disable'} onClick={() => { db.update('users', u.id, { status: u.status === 'Disabled' ? 'Active' : 'Disabled' }); toast.info(u.status === 'Disabled' ? 'Account enabled' : 'Account disabled', u.name); }} />
                  )}
                </div>
              );
            },
          },
        ]}
      />
      <Modal open={!!form} onClose={() => setForm(null)} title="Add account" footer={<><Button variant="secondary" onClick={() => setForm(null)}>Cancel</Button><Button onClick={create}>Create account</Button></>}>
        {form && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Role"><Select value={form.role} onChange={(e) => setForm({ role: e.target.value })} options={roleOpts} /></Field>
            <Field label="For"><Select value={form.linkedId || ''} onChange={(e) => { const p = people(form.role).find((x) => x.value === e.target.value); setForm({ ...form, linkedId: e.target.value, email: p?.email, phone: p?.phone }); }} placeholder="Select person…" options={people(form.role)} /></Field>
            <Field label="Email"><Input value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Phone"><Input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Password" hint="Leave blank to use the default demo1234" className="sm:col-span-2"><Input value={form.password || ''} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
          </div>
        )}
      </Modal>
    </>
  );
}

function OfflineCard() {
  const net = useNetwork();
  const { prompt, installed, persisted } = useInstall();
  const photos = usePhotos((p) => Object.keys(p.map).length);
  const queued = useDB((d) => d.smsLog.filter((m) => m.status === 'Queued').length);
  const [est, setEst] = useState(null);
  useEffect(() => {
    storageEstimate().then(setEst);
  }, [photos]);
  const mb = (b) => `${(b / 1048576).toFixed(1)} MB`;
  return (
    <Card className="lg:col-span-2">
      <CardHeader title="Offline & slow connections" icon={net.online ? Wifi : WifiOff} subtitle={net.online ? `Online${net.effectiveType !== 'unknown' ? ` · ${net.effectiveType}` : ''}${net.slow ? ' · slow' : ''}` : 'Offline — working from this device'} />
      <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase text-slate-500"><HardDrive className="h-3.5 w-3.5" /> Storage used</p>
          <p className="mt-1 text-xl font-extrabold">{est ? mb(est.usage) : '—'}</p>
          <p className="text-xs text-slate-500">{est?.quota ? `of ${mb(est.quota)} available` : 'on this device'}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
          <p className="text-xs font-semibold uppercase text-slate-500">Offline data protected</p>
          <p className="mt-1 text-xl font-extrabold">{persisted ? 'Yes' : persisted === false ? 'Not yet' : '—'}</p>
          <p className="text-xs text-slate-500">{persisted ? "The browser won't clear it when space runs low" : 'Install the app to protect offline data'}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
          <p className="text-xs font-semibold uppercase text-slate-500">Photos stored</p>
          <p className="mt-1 text-xl font-extrabold">{photos}</p>
          <p className="text-xs text-slate-500">≈20 KB each, compressed</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
          <p className="text-xs font-semibold uppercase text-slate-500">Waiting to send</p>
          <p className="mt-1 text-xl font-extrabold">{queued}</p>
          <p className="text-xs text-slate-500">Text messages queued while offline</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 p-5 text-sm dark:border-white/5">
        {installed ? <Badge tone="green" dot>Installed as an app</Badge> : prompt ? (
          <Button icon={MonitorDown} onClick={async () => { prompt.prompt(); const r = await prompt.userChoice; if (r.outcome === 'accepted') useInstall.setState({ prompt: null, installed: true }); }}>Install app</Button>
        ) : <span className="text-slate-500">To install: iPhone Safari → Share → Add to Home Screen · Android Chrome → ⋮ → Install app</span>}
        <span className="text-xs text-slate-500">After the first visit the whole app opens without internet. Live classes and delivering texts need a connection.</span>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- Page
export default function Settings() {
  const db = useDB();
  const user = useCurrentUser();
  // Demo: the Super Admin brands the app. Live: each school's Owner/Admin brands their own school.
  const isSuper = user.role === 'superadmin' || (LIVE && user.role === 'admin');
  const { dark, toggleDark } = useSession();
  const [tab, setTab] = useState(isSuper ? 'branding' : 'school');
  const [s, setS] = useState(() => clone(db.settings));
  const set = (k) => (e) => setS({ ...s, [k]: e.target.value });
  const editable = ['branding', 'school', 'academic', 'modules', 'security', 'gate', 'live'].includes(tab);
  const dirty = JSON.stringify(s) !== JSON.stringify(db.settings);

  const save = () => {
    db.updateSettings({ ...s, libraryFinePerDay: Number(s.libraryFinePerDay), loanDays: Number(s.loanDays), gate: { ...s.gate, rotateSeconds: Math.max(10, Number(s.gate.rotateSeconds) || 30) } });
    toast.success('Settings saved', LIVE ? 'Applied for everyone in your school' : 'Applied for everyone on this device');
  };
  const backup = () => {
    const data = { ...Object.fromEntries(Object.entries(useDB.getState()).filter(([, v]) => typeof v !== 'function')), photos: usePhotos.getState().map };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `edunexa-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };
  const reset = async () => {
    if (await confirmDialog('Reset all demo data?', 'Every change made on this device (students, payments, scores, photos, branding…) will be replaced with fresh sample data.', { confirmLabel: 'Reset data' })) {
      db.resetDemo();
      await clearPhotos();
      setS(clone(useDB.getState().settings));
      toast.success('Demo data restored');
    }
  };

  const tabs = [
    ...(isSuper ? [{ value: 'branding', label: 'Branding', icon: Palette }] : []),
    { value: 'school', label: 'School profile', icon: School },
    { value: 'academic', label: 'Academic year', icon: CalendarRange },
    { value: 'gate', label: 'Gate attendance', icon: DoorOpen },
    { value: 'live', label: 'Live classes', icon: Video },
    ...(LIVE && user.role === 'admin' ? [{ value: 'sms', label: 'SMS', icon: MessageSquareText }] : []),
    ...(isSuper ? [{ value: 'modules', label: 'Modules', icon: Blocks }] : []),
    ...(isSuper && !LIVE ? [{ value: 'security', label: 'Login & security', icon: LockKeyhole }] : []),
    ...(LIVE ? [] : [{ value: 'users', label: 'Users', icon: Users, count: db.users.filter((u) => u.status === 'Pending').length || undefined }]),
    { value: 'grading', label: 'Grading', icon: Award },
    { value: 'roles', label: 'Roles & access', icon: ShieldCheck },
    { value: 'data', label: 'Data & app', icon: Database },
  ];

  return (
    <>
      <PageHeader
        title={LIVE ? 'School Settings' : isSuper ? 'System Settings' : 'Settings'}
        subtitle={LIVE ? 'Your logo and colours, school profile, academic year, gate and modules — saved for everyone in your school' : isSuper ? 'Configure the platform for this school: branding, modules, sign-in security and more' : 'School profile, academic calendar, gate attendance, users and data'}
        actions={editable && <Button icon={Save} onClick={save} disabled={!dirty}>{dirty ? 'Save changes' : 'Saved'}</Button>}
      />
      <Tabs className="mb-6" value={tab} onChange={setTab} tabs={tabs} />

      {tab === 'branding' && <Branding s={s} setS={setS} />}

      {tab === 'school' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          <Card className="p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="School name" className="sm:col-span-2"><Input value={s.schoolName} onChange={set('schoolName')} /></Field>
              <Field label="Motto" className="sm:col-span-2"><Input value={s.motto} onChange={set('motto')} /></Field>
              <Field label="Address" className="sm:col-span-2"><Input value={s.address} onChange={set('address')} /></Field>
              <Field label="Phone"><Input value={s.phone} onChange={set('phone')} /></Field>
              <Field label="Email"><Input value={s.email} onChange={set('email')} /></Field>
              <Field label="Website"><Input value={s.website} onChange={set('website')} /></Field>
              <Field label="Head of school"><Input value={s.headName} onChange={set('headName')} /></Field>
            </div>
          </Card>
          <Card className="h-fit p-6">
            <p className="mb-4 flex items-center gap-2 font-bold text-slate-900 dark:text-white"><Globe className="h-4 w-4 text-brand-600" /> Region & currency</p>
            <div className="grid gap-4">
              <Field label="Country"><Input value={s.country} onChange={set('country')} /></Field>
              <Field label="Currency code"><Input value={s.currencyCode} onChange={set('currencyCode')} placeholder="GHS" /></Field>
              <Field label="Currency symbol" hint="Shown on every amount, receipt and report"><Input value={s.currencySymbol} onChange={set('currencySymbol')} placeholder="GH₵" /></Field>
            </div>
          </Card>
        </div>
      )}

      {tab === 'academic' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Academic year"><Input value={s.academicYear} onChange={set('academicYear')} /></Field>
              <Field label="Current term"><Select value={s.currentTerm} onChange={set('currentTerm')} options={db.terms.map((t) => ({ value: t.id, label: t.name }))} /></Field>
              <Field label="Library loan period (days)"><Input type="number" value={s.loanDays} onChange={set('loanDays')} /></Field>
              <Field label="Library fine per day"><Input type="number" value={s.libraryFinePerDay} onChange={set('libraryFinePerDay')} /></Field>
            </div>
          </Card>
          <Card>
            <CardHeader title="Term dates" icon={CalendarRange} />
            <div className="divide-y divide-slate-100 p-3 dark:divide-white/5">
              {db.terms.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-2 py-3">
                  <div><p className="text-sm font-semibold">{t.name}</p><p className="text-xs text-slate-500">{fmtDate(t.start)} – {fmtDate(t.end)}</p></div>
                  {t.id === db.settings.currentTerm && <Badge tone="green" dot>Current</Badge>}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === 'gate' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Gate name"><Input value={s.gate.name} onChange={(e) => setS({ ...s, gate: { ...s.gate, name: e.target.value } })} /></Field>
              <Field label="QR changes every (seconds)" hint="Shorter is more secure"><Input type="number" min="10" value={s.gate.rotateSeconds} onChange={(e) => setS({ ...s, gate: { ...s.gate, rotateSeconds: e.target.value } })} /></Field>
              <Field label="Late after"><Input type="time" value={s.gate.startTime} onChange={(e) => setS({ ...s, gate: { ...s.gate, startTime: e.target.value } })} /></Field>
              <Field label="School closes"><Input type="time" value={s.gate.closeTime} onChange={(e) => setS({ ...s, gate: { ...s.gate, closeTime: e.target.value } })} /></Field>
            </div>
          </Card>
          <Card className="px-6 py-3">
            <div className="divide-y divide-slate-100 dark:divide-white/5">
              <Toggle checked={s.gate.autoRegister} onChange={(v) => setS({ ...s, gate: { ...s.gate, autoRegister: v } })} label="Mark the class register from gate clock-ins" desc="Students who clock in are ticked Present (or Late) automatically; teachers can still change it" />
              <Toggle checked={s.gate.notifyParents} onChange={(v) => setS({ ...s, gate: { ...s.gate, notifyParents: v } })} label="Text parents when their child arrives and leaves" />
              {isSuper && (
                <div className="py-3">
                  <Button size="sm" variant="secondary" icon={RotateCcw} onClick={() => setS({ ...s, gate: { ...s.gate, secret: Math.random().toString(36).slice(2, 14) } })}>Generate new gate secret</Button>
                  <p className="mt-1 text-xs text-slate-500">Invalidates every gate code immediately (use if a kiosk is lost).</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {tab === 'live' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <p className="font-bold text-slate-900 dark:text-white">Video service</p>
            <div className="mt-4 grid gap-3">
              {[['p2p', 'Built-in classroom', `Devices connect directly to each other. No account or cost. Best for small groups (up to ~${s.live.maxParticipants}).`], ['jitsi', 'Large classes (Jitsi)', 'Uses a Jitsi video server, which handles whole classes of 30–100. Free public server for trials; 8x8 JaaS or your own server for daily use.']].map(([k, label, desc]) => (
                <button key={k} onClick={() => setS({ ...s, live: { ...s.live, provider: k } })} className={cx('rounded-2xl border p-4 text-left transition', s.live.provider === k ? 'border-brand-500 bg-brand-50/50 ring-4 ring-brand-500/10 dark:bg-brand-500/10' : 'border-slate-200 dark:border-white/10')}>
                  <p className="flex items-center gap-2 font-semibold">{s.live.provider === k && <CircleCheck className="h-4 w-4 text-brand-600" />}{label}</p>
                  <p className="mt-1 text-xs text-slate-500">{desc}</p>
                </button>
              ))}
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Built-in: max participants" hint="Each device sends video to every other one"><Input type="number" min="2" max="16" value={s.live.maxParticipants} onChange={(e) => setS({ ...s, live: { ...s.live, maxParticipants: Number(e.target.value) } })} /></Field>
              <Field label="Jitsi server" hint="meet.jit.si limits embedded calls to 5 minutes"><Input value={s.live.jitsiDomain} onChange={(e) => setS({ ...s, live: { ...s.live, jitsiDomain: e.target.value } })} /></Field>
              <Field label="8x8 JaaS App ID (optional)" hint="Free tier at jaas.8x8.vc, no time limit" className="sm:col-span-2"><Input value={s.live.jaasAppId} placeholder="vpaas-magic-cookie-…" onChange={(e) => setS({ ...s, live: { ...s.live, jaasAppId: e.target.value } })} /></Field>
            </div>
          </Card>
          <div className="space-y-6">
            <Card className="px-6 py-3">
              <p className="pt-3 font-bold text-slate-900 dark:text-white">Classroom rules</p>
              <div className="divide-y divide-slate-100 dark:divide-white/5">
                <Toggle checked={s.live.studentsStartMuted} onChange={(v) => setS({ ...s, live: { ...s.live, studentsStartMuted: v } })} label="Students join with microphone off" />
                <Toggle checked={s.live.studentsCanUnmute} onChange={(v) => setS({ ...s, live: { ...s.live, studentsCanUnmute: v } })} label="Students can unmute themselves" desc="Teachers can change this during class" />
                <Toggle checked={s.live.studentsCanUseCamera} onChange={(v) => setS({ ...s, live: { ...s.live, studentsCanUseCamera: v } })} label="Students can turn on their camera" />
              </div>
            </Card>
            <Card className="p-6">
              <p className="font-bold text-slate-900 dark:text-white">Relay server (optional)</p>
              <p className="mt-1 text-xs text-slate-500">Some school or mobile networks block direct connections. A TURN relay (e.g. from Metered, Twilio or your own coturn) fixes this for the built-in classroom.</p>
              <div className="mt-4 grid gap-4">
                <Field label="TURN URL"><Input value={s.live.turnUrl} placeholder="turn:relay.example.com:3478" onChange={(e) => setS({ ...s, live: { ...s.live, turnUrl: e.target.value } })} /></Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Username"><Input value={s.live.turnUser} onChange={(e) => setS({ ...s, live: { ...s.live, turnUser: e.target.value } })} /></Field>
                  <Field label="Password"><Input type="password" value={s.live.turnPass} onChange={(e) => setS({ ...s, live: { ...s.live, turnPass: e.target.value } })} /></Field>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === 'modules' && (
        <Card className="px-6 py-2">
          <p className="pt-4 text-sm text-slate-500">Turn off modules this school doesn't use. They disappear from menus and search for every role; their data is kept.</p>
          <div className="grid gap-x-10 divide-slate-100 md:grid-cols-2 dark:divide-white/5">
            {TOGGLEABLE_MODULES.map((m) => (
              <div key={m.id} className="border-b border-slate-100 dark:border-white/5">
                <Toggle checked={s.modules[m.id] !== false} onChange={(v) => setS({ ...s, modules: { ...s.modules, [m.id]: v } })} label={m.label} desc={m.desc} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === 'security' && <Security s={s} setS={setS} />}
      {tab === 'sms' && <div className="max-w-2xl"><SchoolSmsCard myPhone={user.phone} /></div>}
      {tab === 'users' && <UsersTab />}

      {tab === 'grading' && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {Object.entries(SCALES).map(([k, sc]) => (
            <Card key={k}>
              <CardHeader title={sc.name} subtitle={{ early: 'Creche – KG', basic: 'Primary & JHS', shs: 'SHS', diploma: 'Diploma' }[k]} />
              <div className="space-y-1.5 p-5 text-sm">
                {sc.bands.map((b, i) => (
                  <div key={b.grade} className="flex justify-between gap-2">
                    <span className="w-10 font-bold text-brand-700 dark:text-brand-300">{b.grade}</span>
                    <span className="text-slate-500">{b.min}–{i === 0 ? 100 : sc.bands[i - 1].min - 1}</span>
                    <span className="flex-1 text-right text-xs text-slate-500">{b.remark}{b.point != null ? ` · ${b.point}` : ''}</span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
          <Card className="p-5 text-sm text-slate-500 md:col-span-2 xl:col-span-4">Scores are split into Class assessment (30%) and Examination (70%). JHS reports show a BECE-style aggregate of the best six subjects; Diploma reports show a credit-weighted GPA.</Card>
        </div>
      )}

      {tab === 'roles' && (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[960px]">
            <thead className="bg-slate-50/80 dark:bg-white/[.03]">
              <tr><th className="th">Module</th>{Object.values(ROLES).map((r) => <th key={r.label} className="th text-center">{r.short}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {NAV.flatMap((g) => g.items).map((it) => (
                <tr key={it.key}>
                  <td className="td font-medium"><span className="flex items-center gap-2"><it.icon className="h-4 w-4 text-brand-600" />{it.label}</span></td>
                  {Object.keys(ROLES).map((r) => (
                    <td key={r} className="td text-center">{canAccess(r, it.key) ? <Check className="mx-auto h-4 w-4 text-emerald-600" /> : <Minus className="mx-auto h-4 w-4 text-slate-300" />}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'data' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <OfflineCard />
          <Card>
            <CardHeader title="Data" icon={Database} subtitle={LIVE ? 'Your school data is stored securely online and cached on this device for offline use' : 'Prototype mode: data is stored in this browser'} />
            <div className="space-y-3 p-5">
              <Button variant="secondary" icon={Download} className="w-full" onClick={backup}>Download backup (JSON)</Button>
              {!LIVE && <Button variant="soft-red" icon={RotateCcw} className="w-full" onClick={reset}>Reset demo data</Button>}
            </div>
          </Card>
          <Card>
            <CardHeader title="Appearance & app" icon={Smartphone} />
            <div className="space-y-4 p-5 text-sm">
              <Button variant="secondary" icon={Moon} onClick={toggleDark}>{dark ? 'Switch to light mode' : 'Switch to dark mode'}</Button>
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
                <p className="font-semibold text-slate-800 dark:text-white">Install on your phone</p>
                <p className="mt-1 text-slate-500"><b>iPhone:</b> open this site in Safari → Share → <i>Add to Home Screen</i>.</p>
                <p className="mt-1 text-slate-500"><b>Android:</b> open in Chrome → ⋮ menu → <i>Install app</i>.</p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
