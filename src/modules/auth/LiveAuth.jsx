// Sign-in, Create account and "waiting for approval" screens for the live apps.
// Main app: school members join a school with its code. Admin app: school owners register a school; the Super Admin signs in here too.
import { useEffect, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Building2, CheckCircle2, Clock, Eye, EyeOff, Hourglass, KeyRound, LogOut, RefreshCw, School, ShieldCheck,
  Smartphone, Sparkles, UserPlus, Ban, Download, Upload, Crown,
} from 'lucide-react';
import { supabase, must, friendly } from '../../lib/supabase';
import { useLive, refresh, signOut, loginEmail, holdAuth } from '../../data/sync';
import { ROLES } from '../../lib/permissions';
import { PRESETS, fileToLogo, applyTheme } from '../../lib/theme';
import { DEFAULT_SETTINGS_EXT } from '../../data/seed';
import { ADMIN_APP, APK_URL, ADMIN_APK_URL, IS_NATIVE, SITE, ADMIN_SITE } from '../../config';
import { LogoMark } from '../../components/layout/Logo';
import { OfflineBanner } from '../../components/NetworkBanner';
import { Button, Field, Input, Badge, Card, Spinner, toast, cx } from '../../components/ui';

const MEMBER_ROLES = ['teacher', 'parent', 'student', 'headteacher', 'accountant', 'librarian', 'storekeeper', 'transport', 'canteen', 'hostel', 'staff', 'kiosk'];
const NEEDS_ADMISSION = (r) => r === 'parent' || r === 'student';

function PasswordInput({ value, onChange, placeholder = 'Password', autoComplete = 'current-password' }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? 'text' : 'password'} value={value} onChange={onChange} placeholder={placeholder} autoComplete={autoComplete} className="pr-10" />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:text-slate-600" aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function Shell({ children }) {
  return (
    <>
      <OfflineBanner />
      <div className="min-h-screen bg-white dark:bg-navy-950 lg:grid lg:grid-cols-[1.05fr_1fr]">
        <div className="relative hidden overflow-hidden bg-navy-900 p-12 text-white lg:flex lg:flex-col">
          <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-600/40 blur-3xl" />
          <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-accent-600/25 blur-3xl" />
          <div className="absolute inset-0 opacity-[.07]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '28px 28px' }} />
          <Brand dark />
          <div className="relative mt-auto max-w-lg">
            <span className="chip bg-white/10 text-brand-100 ring-1 ring-inset ring-white/15"><Sparkles className="h-3.5 w-3.5 text-accent-400" /> {ADMIN_APP ? 'For school owners' : 'One app for your whole school'}</span>
            <h1 className="mt-6 text-5xl font-extrabold leading-[1.05] tracking-tight">
              {ADMIN_APP ? <>Run your school <span className="text-brand-400">your way</span><span className="text-accent-500">.</span></> : <>Your school, <span className="text-brand-400">in your pocket</span><span className="text-accent-500">.</span></>}
            </h1>
            <p className="mt-5 text-lg text-slate-300">
              {ADMIN_APP
                ? 'Register your school, add your logo and colours, and approve every teacher, parent and student who joins.'
                : 'Teachers, parents, students and staff — sign in with the code your school gives you. Every account is approved by the school.'}
            </p>
          </div>
          <div className="relative mt-12 flex items-center gap-6 text-xs text-slate-400">
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" /> Every account approved</span>
            <span className="flex items-center gap-1.5"><Smartphone className="h-4 w-4" /> Android, iPhone & web</span>
          </div>
        </div>
        <div className="flex min-h-screen flex-col px-5 py-8 sm:px-10 lg:px-16">
          <div className="lg:hidden"><Brand /></div>
          <div className="mx-auto my-auto w-full max-w-md py-10">{children}</div>
          <Footer />
        </div>
      </div>
    </>
  );
}

function Brand({ dark }) {
  return (
    <div className="relative flex items-center gap-2.5">
      <LogoMark className="h-10 w-10" />
      <div className="leading-none">
        <p className={cx('text-lg font-extrabold tracking-tight', dark ? 'text-white' : 'text-slate-900 dark:text-white')}>Edu<span className="text-accent-500">Nexa</span></p>
        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[.18em] text-slate-400">{ADMIN_APP ? 'Admin' : 'School Suite'}</p>
      </div>
    </div>
  );
}

function Footer() {
  if (IS_NATIVE) return null;
  return (
    <div className="mx-auto flex w-full max-w-md flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-slate-500">
      <a href={ADMIN_APP ? ADMIN_APK_URL : APK_URL} className="flex items-center gap-1.5 font-semibold text-brand-600 hover:underline"><Download className="h-3.5 w-3.5" /> Get the Android app</a>
      <a href={ADMIN_APP ? SITE : ADMIN_SITE} className="hover:underline">{ADMIN_APP ? 'Teachers, parents & students app' : 'School owner? Open EduNexa Admin'}</a>
    </div>
  );
}

const Err = ({ children }) => (children ? <p className="rounded-xl bg-accent-50 px-3 py-2 text-sm text-accent-700 dark:bg-accent-500/10 dark:text-accent-300">{children}</p> : null);

/** Creates (or reuses) the sign-in for an email/phone + password. */
async function ensureSignIn(identifier, password) {
  const email = loginEmail(identifier);
  let r = await supabase.auth.signUp({ email, password });
  if (r.error && /already|registered|exists/i.test(r.error.message)) r = await supabase.auth.signInWithPassword({ email, password });
  else if (!r.error && !r.data.session) r = await supabase.auth.signInWithPassword({ email, password });
  if (r.error) {
    if (/Invalid login/i.test(r.error.message)) throw new Error('This email/phone already has an account with a different password. Sign in instead.');
    throw new Error(friendly(r.error.message));
  }
}

// ---------------------------------------------------------------- sign in
function SignIn({ go }) {
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const superExists = useLive((s) => s.superExists);
  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!id.trim() || !pw) return setErr('Enter your email or phone number and password');
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail(id), password: pw });
    setBusy(false);
    if (error) setErr(friendly(error.message));
  };
  return (
    <>
      <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">{ADMIN_APP ? 'EduNexa Admin' : 'Welcome back'}</h2>
      <p className="mt-2 text-slate-500">{ADMIN_APP ? 'For school owners / administrators and the EduNexa Super Admin.' : 'Sign in with the email or phone number you registered with.'}</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <Field label="Email or phone number"><Input value={id} onChange={(e) => setId(e.target.value)} placeholder="you@email.com or 024 123 4567" autoComplete="username" autoFocus /></Field>
        <Field label="Password"><PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
        <Err>{err}</Err>
        <Button type="submit" size="lg" className="w-full" icon={busy ? Spinner : ArrowRight} disabled={busy}>Sign in</Button>
      </form>
      <p className="mt-3 text-center text-xs text-slate-500">Forgot your password? Ask your school's Owner/Admin to reset it.</p>
      <div className="mt-8 rounded-2xl border border-slate-200 p-4 dark:border-white/10">
        <p className="text-sm font-semibold text-slate-800 dark:text-white">{ADMIN_APP ? 'New school?' : 'New to EduNexa?'}</p>
        <p className="mt-1 text-sm text-slate-500">{ADMIN_APP ? 'Register your school. EduNexa approves it, then you approve your staff, parents and students.' : 'Get your school code from the school office, then create your account.'}</p>
        <Button variant="secondary" className="mt-3 w-full" icon={ADMIN_APP ? Building2 : UserPlus} onClick={() => go(ADMIN_APP ? 'register' : 'join')}>{ADMIN_APP ? 'Register a school' : 'Create account'}</Button>
        {ADMIN_APP && <Button variant="ghost" size="sm" className="mt-2 w-full" icon={UserPlus} onClick={() => go('join')}>Join an existing school as an administrator</Button>}
      </div>
      {ADMIN_APP && !superExists && (
        <button onClick={() => go('claim')} className="mt-4 flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-brand-600"><Crown className="h-3.5 w-3.5" /> Set up the EduNexa Super Admin</button>
      )}
    </>
  );
}

// ---------------------------------------------------------------- shared account fields
function AccountFields({ v, set, needEmail }) {
  return (
    <>
      <Field label="Full name"><Input value={v.name} onChange={set('name')} placeholder="e.g. Akosua Mensah" autoComplete="name" /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone number"><Input value={v.phone} onChange={set('phone')} placeholder="024 123 4567" inputMode="tel" autoComplete="tel" /></Field>
        <Field label={needEmail ? 'Email' : 'Email (optional)'} hint={needEmail ? undefined : 'Leave blank to sign in with your phone'}><Input type="email" value={v.email} onChange={set('email')} placeholder="you@email.com" autoComplete="email" /></Field>
      </div>
      <Field label="Create a password" hint="At least 8 characters with a number"><PasswordInput value={v.password} onChange={set('password')} placeholder="New password" autoComplete="new-password" /></Field>
    </>
  );
}

function checkAccount(v, needEmail) {
  if (!v.name.trim()) return 'Enter your full name';
  if (needEmail && !/^\S+@\S+\.\S+$/.test(v.email)) return 'Enter a valid email address';
  if (!v.email.trim() && v.phone.replace(/\D/g, '').length < 9) return 'Enter your phone number (or an email)';
  if (v.email.trim() && !/^\S+@\S+\.\S+$/.test(v.email)) return 'That email address is not valid';
  if (v.password.length < 8 || !/\d/.test(v.password)) return 'Password needs at least 8 characters, including a number';
  return '';
}

// ---------------------------------------------------------------- join a school (members; co-admins in the Admin app)
function SchoolCodeStep({ onFound }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const look = async (e) => {
    e.preventDefault();
    setErr('');
    if (code.trim().length < 6) return setErr('School codes have 6 letters/numbers');
    setBusy(true);
    try {
      const s = must(await supabase.rpc('school_by_code', { code: code.trim() }));
      if (!s) setErr('No school has that code. Check it with your school office.');
      else onFound({ ...s, code: code.trim().toUpperCase() });
    } catch (e2) {
      setErr(friendly(e2.message));
    }
    setBusy(false);
  };
  return (
    <form onSubmit={look} className="mt-8 space-y-4">
      <Field label="School code" hint="6 characters, from your school office or the school's Owner/Admin">
        <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} placeholder="e.g. 7K2QF9" className="text-center font-mono text-2xl tracking-[.4em]" autoFocus />
      </Field>
      <Err>{err}</Err>
      <Button type="submit" size="lg" className="w-full" icon={busy ? Spinner : ArrowRight} disabled={busy}>Continue</Button>
    </form>
  );
}

function SchoolChip({ school }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-white/5">
      {school.logo ? <img src={school.logo} alt="" className="h-11 w-11 rounded-xl bg-white object-contain p-0.5" /> : <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white"><School className="h-5 w-5" /></span>}
      <div className="min-w-0">
        <p className="truncate font-bold text-slate-900 dark:text-white">{school.name}</p>
        <p className="text-xs text-slate-500">{school.city || 'School'} · code <span className="font-mono">{school.code}</span></p>
      </div>
    </div>
  );
}

function Join({ go, signedIn }) {
  const [school, setSchool] = useState(null);
  const [role, setRole] = useState(ADMIN_APP ? 'admin' : null);
  const [v, setV] = useState({ name: '', phone: '', email: '', password: '', admission: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  useEffect(() => {
    if (school?.theme) applyTheme({ brand: '#2556eb', accent: '#e11d48', ...school.theme });
  }, [school]);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    const problem = signedIn ? (v.name.trim() ? '' : 'Enter your full name') : checkAccount(v, false);
    if (problem) return setErr(problem);
    if (NEEDS_ADMISSION(role) && !v.admission.trim()) return setErr("Enter the student's admission number");
    setBusy(true);
    try {
      await holdAuth(async () => {
        if (!signedIn) await ensureSignIn(v.email.trim() || v.phone, v.password);
        must(await supabase.rpc('join_school', { code: school.code, member_role: role, full_name: v.name.trim(), phone: v.phone.trim() || null, admission_no: NEEDS_ADMISSION(role) ? v.admission.trim() : null }));
      });
      await refresh();
    } catch (e2) {
      setErr(friendly(e2.message));
    }
    setBusy(false);
  };

  return (
    <>
      <button onClick={() => (role && !ADMIN_APP ? setRole(null) : school ? setSchool(null) : go('signin'))} className="mb-6 flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand-600"><ArrowLeft className="h-4 w-4" /> Back</button>
      <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">{ADMIN_APP ? 'Join as an administrator' : 'Create your account'}</h2>
      {!school && (
        <>
          <p className="mt-2 text-slate-500">Step 1 of 3 · Enter your school's code.</p>
          <SchoolCodeStep onFound={setSchool} />
        </>
      )}
      {school && !role && (
        <>
          <p className="mt-2 text-slate-500">Step 2 of 3 · Who are you at this school?</p>
          <div className="mt-5"><SchoolChip school={school} /></div>
          <div className="mt-5 grid grid-cols-2 gap-2.5">
            {MEMBER_ROLES.map((r) => (
              <button key={r} onClick={() => setRole(r)} className="rounded-2xl border border-slate-200 p-3 text-left transition hover:border-brand-500 hover:bg-brand-50/50 dark:border-white/10 dark:hover:bg-white/5">
                <p className="text-sm font-bold text-slate-900 dark:text-white">{ROLES[r].label}</p>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500">{ROLES[r].desc}</p>
              </button>
            ))}
          </div>
        </>
      )}
      {school && role && (
        <>
          <p className="mt-2 text-slate-500">{ADMIN_APP ? 'Step 2 of 2' : 'Step 3 of 3'} · Your details. The school approves your account before you can sign in.</p>
          <div className="mt-5"><SchoolChip school={school} /></div>
          <form onSubmit={submit} className="mt-5 space-y-4">
            <div className="flex items-center gap-2 text-sm"><span className="text-slate-500">Joining as</span><Badge tone="blue">{ROLES[role].label}</Badge></div>
            {NEEDS_ADMISSION(role) && (
              <Field label={role === 'parent' ? "Your child's admission number" : 'Your admission number'} hint="Exactly as on the report card or ID card, e.g. ABC/24/0012">
                <Input value={v.admission} onChange={set('admission')} placeholder="Admission number" className="font-mono uppercase" />
              </Field>
            )}
            {signedIn ? <Field label="Full name"><Input value={v.name} onChange={set('name')} placeholder="Your full name" /></Field> : <AccountFields v={v} set={set} />}
            <Err>{err}</Err>
            <Button type="submit" size="lg" className="w-full" icon={busy ? Spinner : UserPlus} disabled={busy}>Create account</Button>
          </form>
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------- register a school (Admin app)
const randomSecret = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 16);

function Register({ go, signedIn }) {
  const [v, setV] = useState({ name: '', phone: '', email: '', password: '', school: '', city: '', schoolPhone: '' });
  const [logo, setLogo] = useState(null);
  const [theme, setTheme] = useState(PRESETS[0]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  useEffect(() => applyTheme({ brand: theme.brand, accent: theme.accent }), [theme]);

  const pickLogo = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try { setLogo(await fileToLogo(f)); } catch (e2) { toast.error(e2.message); }
  };
  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!v.school.trim()) return setErr('Enter the school name');
    const problem = signedIn ? (v.name.trim() ? '' : 'Enter your full name') : checkAccount(v, true);
    if (problem) return setErr(problem);
    setBusy(true);
    try {
      const settings = {
        ...structuredClone(DEFAULT_SETTINGS_EXT),
        logo,
        theme: { preset: theme.id, brand: theme.brand, accent: theme.accent },
        address: v.city.trim(),
        phone: v.schoolPhone.trim(),
        email: '',
        motto: '', website: '', headName: '', currency: 'GHS', libraryFinePerDay: 1, loanDays: 14,
        auth: { ...DEFAULT_SETTINGS_EXT.auth, mode: 'live' },
        gate: { ...DEFAULT_SETTINGS_EXT.gate, secret: randomSecret() },
      };
      await holdAuth(async () => {
        if (!signedIn) await ensureSignIn(v.email.trim(), v.password);
        must(await supabase.rpc('register_school', { school: { name: v.school.trim(), city: v.city.trim() || null, phone: v.schoolPhone.trim() || null, email: v.email.trim() || null, settings }, full_name: v.name.trim(), phone: v.phone.trim() || null }));
      });
      await refresh();
    } catch (e2) {
      setErr(friendly(e2.message));
    }
    setBusy(false);
  };
  return (
    <>
      <button onClick={() => go('signin')} className="mb-6 flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand-600"><ArrowLeft className="h-4 w-4" /> Back</button>
      <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Register your school</h2>
      <p className="mt-2 text-slate-500">EduNexa reviews and approves new schools. You'll get a school code to share with your staff, parents and students.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">School</p>
        <Field label="School name"><Input value={v.school} onChange={set('school')} placeholder="e.g. Bright Stars Academy" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Town / city"><Input value={v.city} onChange={set('city')} placeholder="e.g. Kumasi" /></Field>
          <Field label="School phone"><Input value={v.schoolPhone} onChange={set('schoolPhone')} placeholder="030 000 0000" inputMode="tel" /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
          <Field label="Logo">
            <label className="flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 hover:border-brand-500 dark:border-white/15 dark:bg-white/5">
              {logo ? <img src={logo} alt="School logo" className="max-h-full max-w-full object-contain" /> : <Upload className="h-6 w-6 text-slate-400" />}
              <input type="file" accept="image/*" className="hidden" onChange={pickLogo} />
            </label>
          </Field>
          <Field label="Theme colour">
            <div className="grid grid-cols-6 gap-2">
              {PRESETS.map((p) => (
                <button type="button" key={p.id} title={p.name} onClick={() => setTheme(p)} className={cx('relative h-10 rounded-xl ring-offset-2 transition dark:ring-offset-navy-950', theme.id === p.id && 'ring-2 ring-slate-900 dark:ring-white')} style={{ background: `linear-gradient(135deg, ${p.brand} 60%, ${p.accent} 60%)` }}>
                  {theme.id === p.id && <CheckCircle2 className="absolute inset-0 m-auto h-4 w-4 text-white" />}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-slate-500">{theme.name} · change any time in Settings</p>
          </Field>
        </div>
        <p className="pt-2 text-xs font-bold uppercase tracking-wider text-slate-400">You (the owner / administrator)</p>
        {signedIn ? <Field label="Full name"><Input value={v.name} onChange={set('name')} /></Field> : <AccountFields v={v} set={set} needEmail />}
        <Err>{err}</Err>
        <Button type="submit" size="lg" className="w-full" icon={busy ? Spinner : Building2} disabled={busy}>Register school</Button>
      </form>
    </>
  );
}

// ---------------------------------------------------------------- Super Admin set-up (reserved email only)
function Claim({ go, signedIn }) {
  const [v, setV] = useState({ name: '', email: '', phone: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!v.name.trim()) return setErr('Enter your name');
    if (!signedIn && (!v.email || v.password.length < 8)) return setErr('Enter the reserved email and a password of 8+ characters');
    setBusy(true);
    try {
      await holdAuth(async () => {
        if (!signedIn) await ensureSignIn(v.email.trim(), v.password);
        must(await supabase.rpc('claim_super_admin', { full_name: v.name.trim() }));
      });
      await refresh();
    } catch (e2) {
      setErr(friendly(e2.message));
    }
    setBusy(false);
  };
  return (
    <>
      <button onClick={() => go('signin')} className="mb-6 flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand-600"><ArrowLeft className="h-4 w-4" /> Back</button>
      <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">EduNexa Super Admin</h2>
      <p className="mt-2 text-slate-500">One-time set-up for the platform owner. Only the reserved email address can claim this account.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label="Your name"><Input value={v.name} onChange={set('name')} /></Field>
        {!signedIn && (
          <>
            <Field label="Reserved email"><Input type="email" value={v.email} onChange={set('email')} autoComplete="email" /></Field>
            <Field label="Password" hint="Use your existing password if this email already has an account"><PasswordInput value={v.password} onChange={set('password')} autoComplete="new-password" /></Field>
          </>
        )}
        <Err>{err}</Err>
        <Button type="submit" size="lg" className="w-full" icon={busy ? Spinner : KeyRound} disabled={busy}>Claim Super Admin</Button>
      </form>
    </>
  );
}

// ---------------------------------------------------------------- after sign-in
function SignedInBar() {
  return (
    <button onClick={signOut} className="mt-6 flex w-full items-center justify-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-accent-600"><LogOut className="h-4 w-4" /> Sign out</button>
  );
}

/** Signed in, but not part of EduNexa yet (e.g. an account from another app, or sign-up interrupted). */
function FinishSetup() {
  const superExists = useLive((s) => s.superExists);
  const [view, setView] = useState(ADMIN_APP ? 'choose' : 'join');
  if (view === 'join') return <><Join go={() => setView(ADMIN_APP ? 'choose' : 'join')} signedIn /><SignedInBar /></>;
  if (view === 'register') return <><Register go={() => setView('choose')} signedIn /><SignedInBar /></>;
  if (view === 'claim') return <><Claim go={() => setView('choose')} signedIn /><SignedInBar /></>;
  return (
    <>
      <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Finish setting up</h2>
      <p className="mt-2 text-slate-500">You're signed in, but not linked to a school yet.</p>
      <div className="mt-6 space-y-3">
        <Button size="lg" className="w-full" icon={Building2} onClick={() => setView('register')}>Register a school</Button>
        <Button variant="secondary" size="lg" className="w-full" icon={UserPlus} onClick={() => setView('join')}>Join a school as an administrator</Button>
        {!superExists && <Button variant="ghost" className="w-full" icon={Crown} onClick={() => setView('claim')}>Set up the EduNexa Super Admin</Button>}
      </div>
      <SignedInBar />
    </>
  );
}

function Waiting() {
  const { profile, school } = useLive();
  const [busy, setBusy] = useState(false);
  const schoolOff = school && school.status !== 'active';
  const st = schoolOff && profile.status === 'active' ? school.status : profile.status;
  const INFO = {
    pending: {
      icon: Hourglass, tone: 'amber', title: 'Waiting for approval',
      text: profile.is_owner
        ? 'EduNexa is reviewing your school. You can sign in as soon as it is approved — usually within one working day.'
        : `${school?.name || 'Your school'}'s Owner/Admin will review your account. This page opens your app as soon as you are approved.`,
    },
    suspended: { icon: Ban, tone: 'red', title: schoolOff ? 'School suspended' : 'Account suspended', text: schoolOff ? 'This school is suspended on EduNexa. Please contact EduNexa support.' : 'Your account has been suspended. Please contact your school.' },
    deactivated: { icon: Ban, tone: 'slate', title: 'Account deactivated', text: 'Your account has been deactivated. Please contact your school if this is a mistake.' },
  }[st] || { icon: Clock, tone: 'amber', title: 'Not available yet', text: 'Please check again later.' };
  const reason = (schoolOff ? school.status_reason : profile.status_reason) || '';
  return (
    <>
      <div className={cx('flex h-14 w-14 items-center justify-center rounded-2xl', INFO.tone === 'red' ? 'bg-accent-50 text-accent-600' : INFO.tone === 'slate' ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-600')}><INFO.icon className="h-7 w-7" /></div>
      <h2 className="mt-5 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">{INFO.title}</h2>
      <p className="mt-2 text-slate-500">{INFO.text}</p>
      {reason && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-white/5 dark:text-slate-300">Reason: {reason}</p>}
      <Card className="mt-6 space-y-2 p-4 text-sm">
        <p><span className="text-slate-500">Name:</span> <b>{profile.name}</b></p>
        <p><span className="text-slate-500">Role:</span> {ROLES[profile.role]?.label}</p>
        {school && <p><span className="text-slate-500">School:</span> {school.name}{profile.is_owner && school.status === 'pending' && ' (awaiting EduNexa approval)'}</p>}
        {profile.match_label && <p><span className="text-slate-500">{profile.role === 'parent' ? 'Child' : 'Student record'}:</span> {profile.match_label}</p>}
        {profile.is_owner && school?.code && <p><span className="text-slate-500">Your school code:</span> <span className="font-mono font-bold">{school.code}</span> — staff and parents can sign up now and you approve them once your school is live.</p>}
      </Card>
      <Button variant="secondary" className="mt-6 w-full" icon={busy ? Spinner : RefreshCw} disabled={busy} onClick={async () => { setBusy(true); await refresh(); setBusy(false); }}>Check again</Button>
      <SignedInBar />
    </>
  );
}

function WrongApp() {
  const profile = useLive((s) => s.profile);
  const admin = profile.role === 'admin' || profile.role === 'superadmin';
  return (
    <>
      <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Use the {admin ? 'EduNexa Admin' : 'EduNexa'} app</h2>
      <p className="mt-2 text-slate-500">
        {admin
          ? 'School Owner/Admin and Super Admin accounts sign in to EduNexa Admin, where you manage your school and approve accounts.'
          : `Your ${ROLES[profile.role]?.label} account signs in to the EduNexa app (EduNexa Admin is only for school owners).`}
      </p>
      {!IS_NATIVE && (
        <div className="mt-6 space-y-3">
          <a href={admin ? ADMIN_SITE : SITE}><Button size="lg" className="w-full" icon={ArrowRight}>Open {admin ? 'EduNexa Admin' : 'EduNexa'} on the web</Button></a>
          <a href={admin ? ADMIN_APK_URL : APK_URL}><Button variant="secondary" className="mt-3 w-full" icon={Download}>Download the Android app</Button></a>
        </div>
      )}
      <SignedInBar />
    </>
  );
}

/** Every screen before the app itself. */
export default function LiveAuth() {
  const phase = useLive((s) => s.phase);
  const [view, setView] = useState('signin');
  if (phase === 'loading')
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-navy-950">
        <div className="flex flex-col items-center gap-4"><LogoMark className="h-14 w-14 animate-pulse" /><Spinner className="h-6 w-6 text-brand-600" /></div>
      </div>
    );
  let body;
  if (phase === 'noProfile') body = <FinishSetup />;
  else if (phase === 'waiting') body = <Waiting />;
  else if (phase === 'wrongApp') body = <WrongApp />;
  else if (view === 'join') body = <Join go={setView} />;
  else if (view === 'register' && ADMIN_APP) body = <Register go={setView} />;
  else if (view === 'claim' && ADMIN_APP) body = <Claim go={setView} />;
  else body = <SignIn go={setView} />;
  return <Shell>{body}</Shell>;
}
