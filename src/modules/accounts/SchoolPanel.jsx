// Owner/Admin dashboard header in the live apps: school code to share, accounts waiting, and first-time set-up.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Share2, RefreshCw, Hourglass, ArrowRight, Rocket, FileSpreadsheet, Check } from 'lucide-react';
import { useDB } from '../../data/store';
import { useLive, regenerateCode } from '../../data/sync';
import { buildStarter, STARTER_SECTIONS } from '../../data/starter';
import { SITE, ADMIN_SITE, APK_URL } from '../../config';
import { Button, Card, Badge, confirmDialog, toast, Spinner, cx } from '../../components/ui';

function StarterCard() {
  const [sections, setSections] = useState(['Early Years', 'Primary', 'JHS']);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const toggle = (s) => setSections((x) => (x.includes(s) ? x.filter((y) => y !== s) : [...x, s]));
  const create = () => {
    setBusy(true);
    const st = buildStarter(STARTER_SECTIONS.filter((s) => sections.includes(s)));
    const db = useDB.getState();
    db.addMany('terms', st.terms);
    db.addMany('periods', st.periods);
    db.addMany('subjects', st.subjects);
    db.addMany('classes', st.classes);
    db.setKey('feeStructures', st.feeStructures);
    db.setKey('expenseCategories', st.expenseCategories);
    db.updateSettings(st.settings);
    toast.success('School structure created', `${st.classes.length} classes, ${st.subjects.length} subjects and 3 terms. Rename or delete any in Classes & Subjects.`);
    setBusy(false);
  };
  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-br from-brand-700 to-brand-500 p-6 text-white">
        <p className="flex items-center gap-2 text-sm font-semibold text-brand-100"><Rocket className="h-4 w-4" /> Welcome — let's set up your school</p>
        <h3 className="mt-2 text-2xl font-extrabold">Your school is empty</h3>
        <p className="mt-1 text-sm text-brand-100">Start with the Ghana GES class and subject structure, or bring everything in from Excel.</p>
      </div>
      <div className="grid gap-6 p-6 md:grid-cols-2">
        <div>
          <p className="font-bold text-slate-900 dark:text-white">1. Quick start structure</p>
          <p className="mt-1 text-sm text-slate-500">Which levels does your school have?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {STARTER_SECTIONS.map((s) => (
              <button key={s} onClick={() => toggle(s)} className={cx('flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold ring-1 ring-inset transition', sections.includes(s) ? 'bg-brand-50 text-brand-700 ring-brand-300 dark:bg-brand-500/15 dark:text-brand-200' : 'text-slate-500 ring-slate-200 dark:ring-white/10')}>
                {sections.includes(s) && <Check className="h-3.5 w-3.5" />}{s === 'Early Years' ? 'Creche – KG' : s}
              </button>
            ))}
          </div>
          <Button className="mt-4" icon={busy ? Spinner : Rocket} disabled={!sections.length || busy} onClick={create}>Create classes, subjects & terms</Button>
        </div>
        <div>
          <p className="font-bold text-slate-900 dark:text-white">2. Import your existing records</p>
          <p className="mt-1 text-sm text-slate-500">Download our Excel template, fill in students & parents, staff, classes, fee balances, past scores, books and store stock — then upload it. Works offline too.</p>
          <Button variant="secondary" className="mt-4" icon={FileSpreadsheet} onClick={() => navigate('/import')}>Import from Excel</Button>
        </div>
      </div>
    </Card>
  );
}

export default function SchoolPanel() {
  const school = useLive((s) => s.school);
  const pending = useDB((s) => s.users.filter((u) => u.status === 'Pending').length);
  const empty = useDB((s) => s.classes.length === 0 && s.students.length === 0);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  if (!school) return null;
  const invite = `Join ${school.name} on EduNexa.\n1. Open ${SITE} or install the Android app: ${APK_URL}\n2. Tap "Create account" and enter our school code: ${school.code}\nParents and students: have your admission number ready.`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(invite); toast.success('Invitation copied', 'Paste it into WhatsApp, SMS or email'); } catch { toast.info(`School code: ${school.code}`); }
  };
  const share = () => (navigator.share ? navigator.share({ title: `${school.name} on EduNexa`, text: invite }).catch(() => {}) : window.open(`https://wa.me/?text=${encodeURIComponent(invite)}`, '_blank'));
  const regen = async () => {
    if (!(await confirmDialog('Change the school code?', 'The old code stops working at once. Existing accounts are not affected — only new sign-ups need the new code.', { danger: false, confirmLabel: 'Change code' }))) return;
    setBusy(true);
    try {
      const code = await regenerateCode();
      useLive.setState({ school: { ...school, code } });
      toast.success('New school code', code);
    } catch (e) { toast.error('Not changed', e.message); }
    setBusy(false);
  };
  return (
    <div className="mb-6 space-y-6">
      {empty && <StarterCard />}
      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <Card className="flex flex-wrap items-center gap-4 p-5">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">School code</p>
            <p className="mt-1 font-mono text-3xl font-extrabold tracking-[.25em] text-brand-700 dark:text-brand-300">{school.code}</p>
            <p className="mt-1 text-xs text-slate-500">Staff, parents and students use this to create their accounts in the EduNexa app.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" icon={Copy} onClick={copy}>Copy invite</Button>
            <Button size="sm" variant="secondary" icon={Share2} onClick={share}>Share</Button>
            <Button size="sm" variant="ghost" icon={busy ? Spinner : RefreshCw} onClick={regen}>New code</Button>
          </div>
        </Card>
        <Card className={cx('flex items-center gap-4 p-5', pending > 0 && 'ring-2 ring-amber-300')}>
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/10"><Hourglass className="h-6 w-6" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-2xl font-extrabold">{pending}</p>
            <p className="text-sm text-slate-500">account{pending === 1 ? '' : 's'} waiting for your approval</p>
          </div>
          <Button size="sm" icon={ArrowRight} onClick={() => navigate('/accounts')}>{pending ? 'Review' : 'Accounts'}</Button>
        </Card>
      </div>
      {!empty && <p className="-mt-2 text-right text-xs"><button className="font-semibold text-brand-600 hover:underline" onClick={() => navigate('/import')}>Import more records from Excel →</button> <span className="text-slate-400">· Admin web: {ADMIN_SITE.replace('https://', '')}</span></p>}
      {school.status !== 'active' && <Badge tone="amber">School status: {school.status}</Badge>}
    </div>
  );
}
