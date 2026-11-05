import { useEffect, useState } from 'react';
import { ArrowRight, ShieldCheck, Smartphone, Sparkles, Eye, EyeOff, KeyRound, ArrowLeft, UserPlus, Clock, MessageSquareText } from 'lucide-react';
import { useDB, useSession } from '../../data/store';
import { ROLES } from '../../lib/permissions';
import { nowISO } from '../../lib/format';
import { findAccount, checkPassword, hashPassword, passwordProblems, needsOtp, makeOtp, maskContact, newUserRecord, DEFAULT_PASSWORD } from '../../lib/auth';
import Logo from '../../components/layout/Logo';
import { FrontBackdrop } from '../../components/FrontImage';
import { OfflineBanner } from '../../components/NetworkBanner';
import { Avatar, Button, Field, Input, Select, toast, cx } from '../../components/ui';
import { userPhotoKey } from '../../data/photos';

const RING = {
  brand: 'hover:ring-brand-500', sky: 'hover:ring-sky-500', emerald: 'hover:ring-emerald-500', violet: 'hover:ring-violet-500',
  amber: 'hover:ring-amber-500', teal: 'hover:ring-teal-500', orange: 'hover:ring-orange-500', rose: 'hover:ring-accent-500',
};

function sendCode(target, purpose) {
  const db = useDB.getState();
  const code = makeOtp();
  const channel = db.settings.auth.otpChannel;
  db.add('smsLog', { date: nowISO(), audience: `Verification · ${maskContact(target)}`, message: `${db.settings.appName}: your ${purpose} code is ${code}. It expires in 5 minutes. Never share this code.`, recipients: 1, status: 'Delivered' });
  toast.info(`Demo ${channel}: ${code}`, `Sent to ${maskContact(target)}. In production this goes by real ${channel}.`);
  return { code, expires: Date.now() + 5 * 60000, tries: 0 };
}

function PasswordInput({ value, onChange, placeholder = 'Password', autoComplete = 'current-password' }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? 'text' : 'password'} value={value} onChange={onChange} placeholder={placeholder} autoComplete={autoComplete} className="pr-10" />
      <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function OtpStep({ otp, setOtp, target, purpose, onVerified, onBack }) {
  const [code, setCode] = useState('');
  const [wait, setWait] = useState(30);
  useEffect(() => {
    const t = setInterval(() => setWait((w) => Math.max(0, w - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  const verify = (e) => {
    e.preventDefault();
    if (Date.now() > otp.expires) return toast.error('Code expired', 'Request a new code');
    if (code !== otp.code) {
      const tries = otp.tries + 1;
      if (tries >= 3) {
        toast.error('Too many wrong codes', 'Please start again');
        return onBack();
      }
      setOtp({ ...otp, tries });
      return toast.error('Incorrect code', `${3 - tries} attempt(s) left`);
    }
    onVerified();
  };
  return (
    <form onSubmit={verify} className="space-y-5">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15"><MessageSquareText className="h-6 w-6" /></div>
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Enter verification code</h2>
        <p className="mt-1 text-sm text-slate-500">We sent a 6-digit {purpose} code to <b>{maskContact(target)}</b>.</p>
      </div>
      <Input autoFocus inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="••••••" className="!py-4 text-center font-mono text-2xl tracking-[.5em]" />
      <Button type="submit" size="lg" className="w-full" disabled={code.length !== 6}>Verify</Button>
      <div className="flex items-center justify-between text-sm">
        <button type="button" onClick={onBack} className="flex items-center gap-1 font-semibold text-slate-500 hover:text-brand-600"><ArrowLeft className="h-4 w-4" /> Back</button>
        <button type="button" disabled={wait > 0} onClick={() => { setOtp(sendCode(target, purpose)); setWait(30); }} className="font-semibold text-brand-600 disabled:text-slate-400">
          {wait > 0 ? `Resend in ${wait}s` : 'Resend code'}
        </button>
      </div>
    </form>
  );
}

export default function Login() {
  const users = useDB((s) => s.users);
  const settings = useDB((s) => s.settings);
  const auth = settings.auth;
  const { login, attempts, setAttempts } = useSession();
  const [view, setView] = useState(auth.mode === 'demo' ? 'roles' : 'password');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(null); // { user?, provision? } awaiting OTP
  const [otp, setOtp] = useState(null);
  const [signup, setSignup] = useState({ title: 'Mrs.' });
  const [reset, setReset] = useState(null);

  useEffect(() => {
    if (auth.mode === 'secure' && view === 'roles') setView('password');
  }, [auth.mode, view]);

  const finish = (acct) => {
    const db = useDB.getState();
    let user = acct.user;
    if (!user) user = db.add('users', newUserRecord(acct.provision));
    db.update('users', user.id, { lastLogin: nowISO() });
    window.location.hash = '#/';
    login(user.id);
    toast.success(`Welcome, ${user.name.split(' ').slice(-2, -1)[0] || user.name}`);
  };

  const key = identifier.trim().toLowerCase();
  const lock = attempts[key];
  const locked = lock?.until && lock.until > Date.now();

  const submitPassword = (e) => {
    e.preventDefault();
    if (locked) return toast.error('Account temporarily locked', `Try again in ${Math.ceil((lock.until - Date.now()) / 60000)} minute(s)`);
    const db = useDB.getState();
    const acct = findAccount(db, identifier);
    if (acct.blocked) return toast.error(acct.blocked);
    if (acct.noAccount === 'parent') return toast.info('No account yet', auth.allowParentSignup ? 'Create your parent account below.' : 'Ask the school office to create your account.');
    const user = acct.user || acct.provision;
    const ok = user && checkPassword(user, password);
    if (!ok) {
      const count = (lock?.count || 0) + 1;
      const next = count >= auth.maxAttempts ? { count: 0, until: Date.now() + auth.lockMinutes * 60000 } : { count };
      setAttempts({ ...attempts, [key]: next });
      return toast.error(next.until ? 'Too many failed attempts' : 'Incorrect details', next.until ? `Sign-in locked for ${auth.lockMinutes} minutes` : `${auth.maxAttempts - count} attempt(s) left before lockout`);
    }
    setAttempts({ ...attempts, [key]: undefined });
    if (acct.user?.status === 'Pending') return setView('awaiting');
    if (acct.user?.status === 'Disabled') return toast.error('Account disabled', 'Contact the school administrator');
    if (needsOtp(user.role, auth) && (user.phone || user.email)) {
      setPending(acct);
      setOtp(sendCode(user, 'sign-in'));
      return setView('otp');
    }
    finish(acct);
  };

  const submitSignup = (e) => {
    e.preventDefault();
    const db = useDB.getState();
    const v = signup;
    if (!v.firstName || !v.lastName || !v.phone || !v.password || !v.admissionNo || !v.dob) return toast.error('Please fill in every field');
    const probs = passwordProblems(v.password, auth);
    if (probs.length) return toast.error('Password too weak', `Use ${probs.join(' and ')}`);
    if (v.password !== v.confirm) return toast.error('Passwords do not match');
    const child = db.students.find((s) => s.admissionNo.toLowerCase() === v.admissionNo.trim().toLowerCase() && s.dob === v.dob);
    if (!child) return toast.error('Child not found', 'Check the admission number and date of birth');
    if (findAccount(db, v.phone).user) return toast.error('Phone already registered', 'Sign in instead, or reset your password');
    const existing = db.users.find((u) => u.role === 'parent' && u.linkedId === child.parentId);
    if (existing) return toast.error('This family already has an account', 'Sign in with the registered phone number or reset the password');
    const target = { phone: v.phone, email: v.email };
    setPending({ signup: { ...v, parentId: child.parentId, childName: child.firstName } });
    setOtp(sendCode(target, 'sign-up'));
    setView('signupOtp');
  };

  const completeSignup = () => {
    const db = useDB.getState();
    const v = pending.signup;
    const user = db.add('users', newUserRecord({
      role: 'parent', linkedId: v.parentId, name: `${v.title} ${v.firstName} ${v.lastName}`, email: v.email || '', phone: v.phone,
      passwordHash: hashPassword(v.password), status: auth.signupApproval ? 'Pending' : 'Active', verified: true,
    }));
    if (auth.signupApproval) {
      db.add('messages', { fromId: user.id, toId: 'usr_admin', subject: 'New parent account awaiting approval', body: `${user.name} (${v.phone}) signed up as the parent of ${v.childName}. Approve in Settings → Users.`, date: nowISO(), read: false });
      setView('awaiting');
    } else finish({ user });
  };

  const startReset = (e) => {
    e.preventDefault();
    const acct = findAccount(useDB.getState(), reset.identifier);
    if (!acct.user) return toast.error('No account found', 'Check the email, phone or admission number');
    setReset({ ...reset, user: acct.user });
    setOtp(sendCode(acct.user, 'password reset'));
    setView('resetOtp');
  };
  const finishReset = (e) => {
    e.preventDefault();
    const probs = passwordProblems(reset.password, auth);
    if (probs.length) return toast.error('Password too weak', `Use ${probs.join(' and ')}`);
    if (reset.password !== reset.confirm) return toast.error('Passwords do not match');
    useDB.getState().update('users', reset.user.id, { passwordHash: hashPassword(reset.password) });
    toast.success('Password updated', 'Sign in with your new password');
    setIdentifier(reset.identifier);
    setPassword('');
    setReset(null);
    setView('password');
  };

  const setS = (k) => (e) => setSignup({ ...signup, [k]: e.target.value });

  return (
    <>
    <OfflineBanner />
    <div className="min-h-screen bg-white dark:bg-navy-950 lg:grid lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-navy-900 p-12 text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <FrontBackdrop src={settings.frontImage} variant="panel" />
        <div className="relative"><Logo dark /></div>
        <div className="relative mt-auto max-w-lg">
          <span className="chip bg-white/10 text-brand-100 ring-1 ring-inset ring-white/15"><Sparkles className="h-3.5 w-3.5 text-accent-400" /> One platform. Every part of your school.</span>
          <h1 className="mt-6 text-5xl font-extrabold leading-[1.05] tracking-tight">
            Run your whole school <span className="text-brand-400">beautifully</span><span className="text-accent-500">.</span>
          </h1>
          <p className="mt-5 text-lg text-slate-300">Admissions, academics, fees, gate attendance, canteen, transport, library and learning — connected for administrators, teachers, parents and students.</p>
          <div className="mt-10 grid grid-cols-3 gap-4">
            {[['20+', 'Modules'], [`${Object.keys(ROLES).length}`, 'Role portals'], ['QR', 'Gate clock-in']].map(([a, b]) => (
              <div key={b} className="rounded-2xl bg-white/5 p-4 ring-1 ring-inset ring-white/10"><p className="text-lg font-extrabold">{a}</p><p className="text-xs text-slate-400">{b}</p></div>
            ))}
          </div>
        </div>
        <div className="relative mt-12 flex items-center gap-6 text-xs text-slate-400">
          <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" /> {auth.mode === 'secure' ? 'Password + verification code' : 'Role-based access'}</span>
          <span className="flex items-center gap-1.5"><Smartphone className="h-4 w-4" /> Works on iOS & Android</span>
        </div>
      </div>

      <div className="flex min-h-screen flex-col px-5 pb-8 pt-0 sm:px-10 lg:px-16 lg:pt-8">
        <div className="relative -mx-5 mb-2 h-48 sm:-mx-10 lg:hidden">
          <FrontBackdrop src={settings.frontImage} variant="top" />
          <div className="relative px-5 pt-6 sm:px-10"><span className="inline-block rounded-2xl bg-white/90 px-3 py-2 shadow-sm backdrop-blur dark:bg-navy-900/80"><Logo /></span></div>
        </div>
        <div className="mx-auto my-auto w-full max-w-xl py-10">
          {view === 'roles' && (
            <>
              <p className="text-sm font-semibold text-accent-600">{settings.schoolName}</p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Welcome back</h2>
              <p className="mt-2 text-slate-500">This is a live demo. Choose a portal to sign in instantly — each one shows exactly what that person would see.</p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {users.filter((u) => u.id.startsWith('usr_') && !u.createdAt).map((u) => {
                  const r = ROLES[u.role];
                  if (!r) return null;
                  return (
                    <button key={u.id} onClick={() => finish({ user: u })} className={cx('group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 text-left ring-2 ring-transparent transition hover:-translate-y-0.5 hover:shadow-lift dark:border-white/10 dark:bg-navy-900', RING[r.color])}>
                      <Avatar name={u.name} photo={userPhotoKey(u)} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{r.label}</p>
                        <p className="truncate text-xs text-slate-500">{u.name}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
                    </button>
                  );
                })}
              </div>
              <Button variant="secondary" icon={KeyRound} className="mt-6 w-full" onClick={() => setView('password')}>Sign in with password instead</Button>
              <p className="mt-6 text-center text-xs text-slate-400">Demo data is stored on this device only. A Super Admin can switch to secure password sign-in in Settings.</p>
            </>
          )}

          {view === 'password' && (
            <form onSubmit={submitPassword} className="space-y-5">
              <div>
                <p className="text-sm font-semibold text-accent-600">{settings.schoolName}</p>
                <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Sign in</h2>
                <p className="mt-2 text-slate-500">Use your email, phone number or admission number.</p>
              </div>
              <Field label="Email, phone or admission no."><Input autoFocus value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" placeholder="e.g. 0241234567 or BFIS/26/0112" /></Field>
              <Field label="Password"><PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
              {locked && <p className="flex items-center gap-2 rounded-xl bg-accent-50 p-3 text-sm text-accent-700 dark:bg-accent-500/10"><Clock className="h-4 w-4" /> Too many attempts. Try again in {Math.ceil((lock.until - Date.now()) / 60000)} min.</p>}
              <Button type="submit" size="lg" className="w-full" icon={ArrowRight}>Sign in</Button>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <button type="button" onClick={() => { setReset({ identifier }); setView('reset'); }} className="font-semibold text-brand-600">Forgot password?</button>
                {auth.allowParentSignup && <button type="button" onClick={() => setView('signup')} className="flex items-center gap-1 font-semibold text-brand-600"><UserPlus className="h-4 w-4" /> Create parent account</button>}
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 text-xs text-slate-500 dark:bg-white/5">
                <p className="font-semibold text-slate-700 dark:text-slate-200">Demo accounts</p>
                <p className="mt-1">Every demo account uses the password <b className="font-mono">{DEFAULT_PASSWORD}</b>. Try <button type="button" className="font-mono text-brand-600" onClick={() => setIdentifier(users.find((u) => u.role === 'teacher')?.email)}>{users.find((u) => u.role === 'teacher')?.email}</button> (teacher), student <button type="button" className="font-mono text-brand-600" onClick={() => setIdentifier(useDB.getState().students.find((s) => s.id === users.find((u) => u.role === 'student')?.linkedId)?.admissionNo)}>{useDB.getState().students.find((s) => s.id === users.find((u) => u.role === 'student')?.linkedId)?.admissionNo}</button>, or <button type="button" className="font-mono text-brand-600" onClick={() => setIdentifier('superadmin@edunexa.app')}>superadmin@edunexa.app</button>.</p>
              </div>
              {auth.mode === 'demo' && <button type="button" onClick={() => setView('roles')} className="flex w-full items-center justify-center gap-1 text-sm font-semibold text-slate-500 hover:text-brand-600"><ArrowLeft className="h-4 w-4" /> Back to demo portals</button>}
            </form>
          )}

          {view === 'otp' && pending && <OtpStep otp={otp} setOtp={setOtp} target={pending.user || pending.provision} purpose="sign-in" onBack={() => setView('password')} onVerified={() => finish(pending)} />}

          {view === 'signup' && (
            <form onSubmit={submitSignup} className="space-y-4">
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Create a parent account</h2>
                <p className="mt-2 text-slate-500">We'll check your child's details and send a code to your phone.</p>
              </div>
              <div className="grid grid-cols-[100px_1fr_1fr] gap-3">
                <Field label="Title"><Select value={signup.title} onChange={setS('title')} options={['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Rev.']} /></Field>
                <Field label="First name"><Input value={signup.firstName || ''} onChange={setS('firstName')} /></Field>
                <Field label="Surname"><Input value={signup.lastName || ''} onChange={setS('lastName')} /></Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Phone number"><Input type="tel" value={signup.phone || ''} onChange={setS('phone')} placeholder="024 123 4567" /></Field>
                <Field label="Email (optional)"><Input type="email" value={signup.email || ''} onChange={setS('email')} /></Field>
                <Field label="Child's admission no."><Input value={signup.admissionNo || ''} onChange={setS('admissionNo')} placeholder="BFIS/26/0112" /></Field>
                <Field label="Child's date of birth"><Input type="date" value={signup.dob || ''} onChange={setS('dob')} /></Field>
                <Field label="Password" hint={`At least ${auth.minPasswordLength} characters${auth.requireNumber ? ', including a number' : ''}`}><PasswordInput value={signup.password || ''} onChange={setS('password')} autoComplete="new-password" /></Field>
                <Field label="Confirm password"><PasswordInput value={signup.confirm || ''} onChange={setS('confirm')} placeholder="Repeat password" autoComplete="new-password" /></Field>
              </div>
              <Button type="submit" size="lg" className="w-full" icon={ArrowRight}>Continue</Button>
              <button type="button" onClick={() => setView('password')} className="flex w-full items-center justify-center gap-1 text-sm font-semibold text-slate-500 hover:text-brand-600"><ArrowLeft className="h-4 w-4" /> I already have an account</button>
            </form>
          )}

          {view === 'signupOtp' && pending?.signup && <OtpStep otp={otp} setOtp={setOtp} target={{ phone: pending.signup.phone, email: pending.signup.email }} purpose="sign-up" onBack={() => setView('signup')} onVerified={completeSignup} />}

          {view === 'awaiting' && (
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600"><Clock className="h-7 w-7" /></div>
              <h2 className="mt-5 text-2xl font-extrabold text-slate-900 dark:text-white">Awaiting approval</h2>
              <p className="mt-2 text-slate-500">Your account is verified and waiting for the school to approve it. You'll be able to sign in once it's approved.</p>
              <Button variant="secondary" className="mt-6" onClick={() => setView('password')}>Back to sign in</Button>
            </div>
          )}

          {view === 'reset' && reset && (
            <form onSubmit={startReset} className="space-y-5">
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Reset password</h2>
              <p className="text-slate-500">Enter your email, phone or admission number and we'll send you a code.</p>
              <Field label="Email, phone or admission no."><Input autoFocus value={reset.identifier || ''} onChange={(e) => setReset({ ...reset, identifier: e.target.value })} /></Field>
              <Button type="submit" size="lg" className="w-full">Send code</Button>
              <button type="button" onClick={() => setView('password')} className="flex w-full items-center justify-center gap-1 text-sm font-semibold text-slate-500 hover:text-brand-600"><ArrowLeft className="h-4 w-4" /> Back to sign in</button>
            </form>
          )}
          {view === 'resetOtp' && reset?.user && <OtpStep otp={otp} setOtp={setOtp} target={reset.user} purpose="password reset" onBack={() => setView('reset')} onVerified={() => setView('resetNew')} />}
          {view === 'resetNew' && reset && (
            <form onSubmit={finishReset} className="space-y-5">
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Choose a new password</h2>
              <Field label="New password" hint={`At least ${auth.minPasswordLength} characters${auth.requireNumber ? ', including a number' : ''}`}><PasswordInput value={reset.password || ''} onChange={(e) => setReset({ ...reset, password: e.target.value })} autoComplete="new-password" /></Field>
              <Field label="Confirm password"><PasswordInput value={reset.confirm || ''} onChange={(e) => setReset({ ...reset, confirm: e.target.value })} placeholder="Repeat password" autoComplete="new-password" /></Field>
              <Button type="submit" size="lg" className="w-full">Save password</Button>
            </form>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
