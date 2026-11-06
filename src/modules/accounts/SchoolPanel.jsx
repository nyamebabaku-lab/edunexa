// Owner/Admin dashboard header in the live apps: school code to share, accounts waiting, and first-time set-up.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Share2, RefreshCw, Hourglass, ArrowRight, Rocket, FileSpreadsheet, Check, X } from 'lucide-react';
import { useDB } from '../../data/store';
import { useLive, regenerateCode } from '../../data/sync';
import { buildStarter, STARTER_SECTIONS } from '../../data/starter';
import { SITE, ADMIN_SITE, APK_URL } from '../../config';
import { Button, Card, Badge, confirmDialog, toast, Spinner, cx } from '../../components/ui';

/** Creates the full GES structure (all levels) once; deterministic ids make a second run harmless. */
export function createStarter(sections = STARTER_SECTIONS, { classes = true } = {}) {
  const st = buildStarter(sections);
  const db = useDB.getState();
  if (!db.terms.length) db.bulkUpsert('terms', st.terms);
  if (!db.periods.length) db.bulkUpsert('periods', st.periods);
  db.bulkUpsert('subjects', st.subjects);
  if (classes) db.bulkUpsert('classes', st.classes);
  else {
    // The school made its own classes: give each one the standard subjects of its level.
    const bySec = (sec) => st.subjects.filter((x) => x.section === sec).map((x) => x.id);
    db.classes.filter((c) => !c.subjectIds?.length).forEach((c) => db.update('classes', c.id, { subjectIds: bySec(c.section) }));
  }
  if (!db.feeStructures.length) db.setKey('feeStructures', st.feeStructures);
  if (!db.expenseCategories.length) db.setKey('expenseCategories', st.expenseCategories);
  db.updateSettings({ ...(db.settings.currentTerm ? {} : st.settings), starterDone: true });
  return st;
}

/** Removes a whole level (its classes and subjects) — for levels the school does not have. Classes with students stay. */
export function removeLevel(section) {
  const db = useDB.getState();
  const busy = new Set(db.students.map((x) => x.classId));
  const classes = db.classes.filter((c) => c.section === section && !busy.has(c.id));
  const kept = db.classes.filter((c) => c.section === section && busy.has(c.id)).length;
  const classIds = new Set(classes.map((c) => c.id));
  db.removeMany('classes', [...classIds]);
  db.removeMany('allocations', db.allocations.filter((x) => classIds.has(x.classId)).map((x) => x.id));
  if (!kept) db.removeMany('subjects', db.subjects.filter((x) => x.section === section).map((x) => x.id));
  db.setKey('timetable', (t) => Object.fromEntries(Object.entries(t || {}).filter(([k]) => !classIds.has(k))));
  db.setKey('feeStructures', (f) => (kept ? f : (f || []).filter((x) => x.section !== section)));
  return { removed: classIds.size, kept };
}

function StarterCard() {
  const classes = useDB((s) => s.classes);
  const subjects = useDB((s) => s.subjects);
  const terms = useDB((s) => s.terms);
  const navigate = useNavigate();
  const levels = STARTER_SECTIONS.filter((sec) => classes.some((c) => c.section === sec));
  const drop = async (sec) => {
    const n = classes.filter((c) => c.section === sec).length;
    if (!(await confirmDialog(`Remove ${sec}?`, `Deletes the ${n} ${sec} class${n === 1 ? '' : 'es'} and their subjects. Use this if your school does not have ${sec}. Classes that already have students are kept.`, { confirmLabel: 'Remove' }))) return;
    const r = removeLevel(sec);
    toast.success(`${sec} removed`, r.kept ? `${r.kept} class(es) with students were kept` : `${r.removed} classes removed`);
  };
  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-br from-brand-700 to-brand-500 p-6 text-white">
        <p className="flex items-center gap-2 text-sm font-semibold text-brand-100"><Rocket className="h-4 w-4" /> Welcome — your school is ready to fill in</p>
        <h3 className="mt-2 text-2xl font-extrabold">{subjects.length ? 'We set up your classes, subjects and terms' : 'Finish setting up your school'}</h3>
        <p className="mt-1 text-sm text-brand-100">{classes.length} classes, {subjects.length} subjects and {terms.length} terms from the Ghana GES structure. Remove the levels you don't have, and add, rename or delete any class or subject in Classes & Subjects.</p>
      </div>
      <div className="grid gap-6 p-6 md:grid-cols-2">
        <div>
          <p className="font-bold text-slate-900 dark:text-white">1. Keep only your levels</p>
          <p className="mt-1 text-sm text-slate-500">Tap ✕ to remove a level your school does not have.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {levels.map((sec) => (
              <span key={sec} className="flex items-center gap-1.5 rounded-xl bg-brand-50 py-1.5 pl-3 pr-1.5 text-sm font-semibold text-brand-700 ring-1 ring-inset ring-brand-200 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/30">
                <Check className="h-3.5 w-3.5" />{sec === 'Early Years' ? 'Creche – KG' : sec}
                <button aria-label={`Remove ${sec}`} onClick={() => drop(sec)} className="rounded-lg p-1 text-brand-400 hover:bg-white hover:text-accent-600 dark:hover:bg-white/10"><X className="h-3.5 w-3.5" /></button>
              </span>
            ))}
            {!levels.length && <Button size="sm" icon={Rocket} onClick={() => { createStarter(); toast.success('Structure created again'); }}>Create GES structure again</Button>}
          </div>
          {classes.length > 0 && !subjects.length && (
            <Button size="sm" className="mt-3" icon={Rocket} onClick={() => { const st = createStarter(STARTER_SECTIONS, { classes: false }); toast.success('Subjects, terms and bell times added', `${st.subjects.length} GES subjects — your classes were kept`); }}>Add standard subjects, terms & bell times</Button>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => navigate('/classes')}>Classes & Subjects</Button>
            <Button size="sm" variant="secondary" onClick={() => navigate('/timetable')}>Timetable</Button>
          </div>
        </div>
        <div>
          <p className="font-bold text-slate-900 dark:text-white">2. Add your people</p>
          <p className="mt-1 text-sm text-slate-500">Add students and staff one by one, or bring everything in from our Excel template: students & parents, staff, classes, fee balances, past scores, books and store stock. Works offline too.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" icon={FileSpreadsheet} onClick={() => navigate('/import')}>Import from Excel</Button>
            <Button variant="ghost" onClick={() => useDB.getState().updateSettings({ setupSeen: true })}>Hide this</Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function SchoolPanel() {
  const school = useLive((s) => s.school);
  const pendingAccounts = useDB((s) => s.users.filter((u) => u.status === 'Pending').length);
  const pendingChildren = useLive((s) => s.childRequests.filter((r) => r.status === 'pending').length);
  const pending = pendingAccounts + pendingChildren;
  const empty = useDB((s) => s.classes.length === 0 && s.students.length === 0);
  const fresh = useDB((s) => s.students.length === 0 && !s.settings.setupSeen);
  const starterDone = useDB((s) => s.settings.starterDone || s.subjects.length > 0);
  // A brand-new school gets the full class, subject and term structure automatically (once).
  useEffect(() => {
    if (school?.status === 'active' && empty && !starterDone) {
      const st = createStarter();
      toast.success('Classes, subjects and terms created', `${st.classes.length} classes and ${st.subjects.length} subjects — remove any level you don't have`);
    }
  }, [school?.status, empty, starterDone]);
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
      {fresh && <StarterCard />}
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
            <p className="text-sm text-slate-500">{pendingChildren ? `${pendingAccounts} account${pendingAccounts === 1 ? '' : 's'} + ${pendingChildren} child link${pendingChildren === 1 ? '' : 's'} waiting` : `account${pending === 1 ? '' : 's'} waiting for your approval`}</p>
          </div>
          <Button size="sm" icon={ArrowRight} onClick={() => navigate('/accounts')}>{pending ? 'Review' : 'Accounts'}</Button>
        </Card>
      </div>
      {!fresh && <p className="-mt-2 text-right text-xs"><button className="font-semibold text-brand-600 hover:underline" onClick={() => navigate('/import')}>Import more records from Excel →</button> <span className="text-slate-400">· Admin web: {ADMIN_SITE.replace('https://', '')}</span></p>}
      {school.status !== 'active' && <Badge tone="amber">School status: {school.status}</Badge>}
    </div>
  );
}
