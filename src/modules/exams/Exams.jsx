// Exam timetables, separate from the weekly lesson timetable.
// The Owner/Admin and Head Teacher create exam series (e.g. "End of Term 1 Exams") and their papers;
// students and parents see their class's papers once published, teachers see their invigilation duties.
import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Copy, Printer, Send, EyeOff, NotebookPen, AlertTriangle, CalendarDays, Clock, MapPin, UserRound, Check } from 'lucide-react';
import { useDB } from '../../data/store';
import { useLookups, useCurrentUser, usePortalStudent, sortedClasses, TODAY } from '../../data/selectors';
import { fmtDate, uid } from '../../lib/format';
import { SECTIONS } from '../../data/seed';
import { printOrShare, isPhone } from '../../lib/pdf';
import { Card, CardHeader, PageHeader, Button, IconButton, Badge, Select, Tabs, FormModal, EmptyState, toast, confirmDialog, cx } from '../../components/ui';

const overlaps = (a, b) => a.date === b.date && a.start < b.end && b.start < a.end;

/** Clashes between papers: a class sitting two papers at once, an invigilator or a room booked twice. */
export function examClashes(papers, L) {
  const out = {};
  const add = (id, msg) => (out[id] ||= []).push(msg);
  papers.forEach((a, i) => papers.slice(i + 1).forEach((b) => {
    if (!overlaps(a, b)) return;
    const shared = (a.classIds || []).filter((c) => (b.classIds || []).includes(c));
    if (shared.length) {
      const names = shared.map((c) => L.className(c)).join(', ');
      add(a.id, `${names} also sits ${L.subjectName(b.subjectId)} then`);
      add(b.id, `${names} also sits ${L.subjectName(a.subjectId)} then`);
    }
    if (a.invigilatorId && a.invigilatorId === b.invigilatorId) {
      add(a.id, `${L.staffName(a.invigilatorId)} also invigilates ${L.subjectName(b.subjectId)}`);
      add(b.id, `${L.staffName(b.invigilatorId)} also invigilates ${L.subjectName(a.subjectId)}`);
    }
    if (a.room && b.room && a.room.trim().toLowerCase() === b.room.trim().toLowerCase()) {
      add(a.id, `Room ${a.room} is also used for ${L.subjectName(b.subjectId)}`);
      add(b.id, `Room ${b.room} is also used for ${L.subjectName(a.subjectId)}`);
    }
  }));
  return out;
}

const byTime = (a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`);

function ClassChips({ classes, value, onChange }) {
  const set = new Set(value || []);
  const toggle = (id) => onChange(set.has(id) ? value.filter((x) => x !== id) : [...(value || []), id]);
  const levels = SECTIONS.filter((sec) => classes.some((c) => c.section === sec));
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {levels.map((sec) => {
          const ids = classes.filter((c) => c.section === sec).map((c) => c.id);
          const all = ids.every((id) => set.has(id));
          return (
            <button type="button" key={sec} onClick={() => onChange(all ? (value || []).filter((x) => !ids.includes(x)) : [...new Set([...(value || []), ...ids])])}
              className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300">
              {all ? `Untick ${sec}` : `All ${sec}`}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {classes.map((c) => (
          <button type="button" key={c.id} onClick={() => toggle(c.id)}
            className={cx('flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ring-1 ring-inset transition', set.has(c.id) ? 'bg-brand-50 text-brand-700 ring-brand-300 dark:bg-brand-500/15 dark:text-brand-200' : 'text-slate-500 ring-slate-200 dark:ring-white/10')}>
            {set.has(c.id) && <Check className="h-3 w-3" />}{c.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Exams() {
  const db = useDB();
  const L = useLookups();
  const user = useCurrentUser();
  const { student } = usePortalStudent();
  const canEdit = ['admin', 'headteacher', 'superadmin'].includes(user.role);
  const portal = ['parent', 'student'].includes(user.role);
  const isTeacher = user.role === 'teacher';
  const all = [...(db.exams || [])].sort((a, b) => String(b.start || '').localeCompare(String(a.start || '')));
  const visible = canEdit ? all : all.filter((x) => x.published);
  const [selId, setSelId] = useState(null);
  const sel = visible.find((x) => x.id === selId) || visible[0];
  const [view, setView] = useState(portal ? 'class' : 'day');
  const classes = sortedClasses(db.classes);
  const [classId, setClassId] = useState(student?.classId || classes[0]?.id);
  const [mineOnly, setMineOnly] = useState(false);
  const [seriesForm, setSeriesForm] = useState(null);
  const [paperForm, setPaperForm] = useState(null);

  const papers = useMemo(() => [...(sel?.papers || [])].sort(byTime), [sel]);
  const clash = useMemo(() => examClashes(papers, L), [papers, L]);
  const effClass = portal ? student?.classId : classId;
  const shown = papers.filter((p) => {
    if (portal || view === 'class') return (p.classIds || []).includes(effClass);
    if (isTeacher && mineOnly) return p.invigilatorId === user.linkedId;
    return true;
  });
  const days = [...new Set(shown.map((p) => p.date))].sort();
  const clashCount = Object.keys(clash).length;

  const saveSeries = (v) => {
    if (v.end && v.start && v.end < v.start) return toast.error('Check the dates', 'The last day must be after the first day');
    if (v.id) {
      db.update('exams', v.id, { name: v.name.trim(), termId: v.termId || '', start: v.start, end: v.end, notes: v.notes || '' });
      toast.success('Exam series updated');
    } else {
      const rec = db.add('exams', { name: v.name.trim(), termId: v.termId || db.settings.currentTerm || '', start: v.start, end: v.end, notes: v.notes || '', published: false, papers: [] });
      setSelId(rec.id);
      toast.success('Exam series created', 'Now add the papers');
    }
    setSeriesForm(null);
  };
  const savePaper = (v) => {
    if (!v.classIds?.length) return toast.error('Choose the classes', 'Tick the classes that sit this paper');
    if (v.end <= v.start) return toast.error('Check the times', 'The paper must end after it starts');
    if (sel.start && sel.end && (v.date < sel.start || v.date > sel.end)) toast.info('Outside the exam dates', `${sel.name} runs ${fmtDate(sel.start)} – ${fmtDate(sel.end)}`);
    const paper = { id: v.id || uid('ppr'), date: v.date, start: v.start, end: v.end, subjectId: v.subjectId, classIds: v.classIds, room: (v.room || '').trim(), invigilatorId: v.invigilatorId || '', note: v.note || '' };
    const list = v.id ? sel.papers.map((p) => (p.id === v.id ? paper : p)) : [...(sel.papers || []), paper];
    const c = examClashes(list, L)[paper.id];
    db.update('exams', sel.id, { papers: list });
    toast[c ? 'info' : 'success'](v.id ? 'Paper updated' : 'Paper added', c ? `Clash: ${c[0]}` : `${L.subjectName(paper.subjectId)} · ${fmtDate(paper.date, 'EEE d MMM')} ${paper.start}`);
    setPaperForm(null);
  };
  const delPaper = async (p) => {
    if (!(await confirmDialog('Delete this paper?', `${L.subjectName(p.subjectId)} · ${fmtDate(p.date, 'EEE d MMM')} ${p.start}`, { confirmLabel: 'Delete' }))) return;
    db.update('exams', sel.id, { papers: sel.papers.filter((x) => x.id !== p.id) });
    toast.success('Paper deleted');
  };
  const delSeries = async () => {
    if (!(await confirmDialog(`Delete ${sel.name}?`, `Its ${sel.papers?.length || 0} paper(s) are deleted too. Marks already entered are not affected.`, { confirmLabel: 'Delete' }))) return;
    db.remove('exams', sel.id);
    setSelId(null);
    toast.success('Exam series deleted');
  };
  const copySeries = () => {
    const rec = db.add('exams', { ...sel, id: undefined, name: `${sel.name} (copy)`, published: false, papers: (sel.papers || []).map((p) => ({ ...p, id: uid('ppr') })) });
    setSelId(rec.id);
    toast.success('Copy made', 'Change the name and dates, then publish');
  };
  const publish = async (on) => {
    if (on && clashCount && !(await confirmDialog('Publish with clashes?', `${clashCount} paper(s) clash. Publish anyway?`, { danger: false, confirmLabel: 'Publish' }))) return;
    if (on && !(sel.papers || []).length) return toast.error('No papers yet', 'Add the papers before publishing');
    db.update('exams', sel.id, { published: on });
    if (on) {
      db.add('notices', { title: `Exam timetable: ${sel.name}`, body: `The ${sel.name} timetable (${fmtDate(sel.start)} – ${fmtDate(sel.end)}) is out. Open Exam Timetable in the EduNexa app to see your papers.`, audience: 'All', priority: 'High', date: TODAY, authorId: user.linkedId || null, pinned: false });
      toast.success('Published', 'Students, parents and teachers can see it now and were notified');
    } else toast.info('Hidden', 'Only the Owner/Admin and Head Teacher can see it now');
  };

  const PaperRow = ({ p, showDate }) => {
    const mine = p.invigilatorId && p.invigilatorId === user.linkedId;
    return (
      <div className={cx('flex flex-wrap items-start gap-3 px-5 py-3', clash[p.id] && canEdit && 'bg-accent-50/60 dark:bg-accent-500/5', mine && 'bg-brand-50/60 dark:bg-brand-500/5')}>
        <div className="w-28 shrink-0">
          {showDate && <p className="text-xs font-bold text-accent-600">{fmtDate(p.date, 'EEE d MMM')}</p>}
          <p className="text-sm font-bold text-slate-900 dark:text-white">{p.start}–{p.end}</p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900 dark:text-white">{L.subjectName(p.subjectId)}</p>
          <p className="text-xs text-slate-500">{(p.classIds || []).map((c) => L.className(c)).join(', ')}</p>
          <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-500">
            {p.room && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {p.room}</span>}
            {p.invigilatorId && !portal && <span className="flex items-center gap-1"><UserRound className="h-3 w-3" /> {L.staffName(p.invigilatorId)}</span>}
            {p.note && <span>{p.note}</span>}
          </div>
          {canEdit && clash[p.id]?.map((m, i) => <p key={i} className="mt-1 flex items-center gap-1 text-xs font-semibold text-accent-600"><AlertTriangle className="h-3 w-3" /> {m}</p>)}
        </div>
        {mine && <Badge tone="blue">You invigilate</Badge>}
        {canEdit && (
          <div className="no-print flex gap-1">
            <IconButton icon={Pencil} label="Edit paper" onClick={() => setPaperForm(p)} />
            <IconButton icon={Trash2} label="Delete paper" className="hover:!text-accent-600" onClick={() => delPaper(p)} />
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title="Exam Timetable"
        subtitle={canEdit ? 'Exam series and their papers — separate from the weekly lesson timetable' : portal ? 'Your exam papers' : 'Exam papers and your invigilation duties'}
        actions={
          <>
            {canEdit && <Button icon={Plus} onClick={() => setSeriesForm({ start: TODAY, end: TODAY, termId: db.settings.currentTerm })}>New exam series</Button>}
            {sel && <Button variant="secondary" icon={Printer} onClick={() => printOrShare(document.querySelector('main'), sel.name).catch((e) => toast.error('Could not make the PDF', e.message))}>{isPhone() ? 'Share PDF' : 'Print'}</Button>}
          </>
        }
      />

      {!visible.length ? (
        <Card><EmptyState icon={NotebookPen} title="No exam timetable yet" text={canEdit ? 'Create an exam series (e.g. "End of Term 1 Exams"), add its papers, then publish it.' : 'The school has not published an exam timetable yet.'} action={canEdit && <Button icon={Plus} onClick={() => setSeriesForm({ start: TODAY, end: TODAY, termId: db.settings.currentTerm })}>New exam series</Button>} /></Card>
      ) : (
        <>
          {visible.length > 1 && (
            <div className="no-print mb-4 flex flex-wrap gap-2">
              {visible.map((x) => (
                <button key={x.id} onClick={() => setSelId(x.id)} className={cx('rounded-xl px-3 py-2 text-sm font-semibold ring-1 ring-inset', x.id === sel?.id ? 'bg-brand-600 text-white ring-brand-600' : 'text-slate-600 ring-slate-200 dark:text-slate-300 dark:ring-white/10')}>
                  {x.name}{canEdit && !x.published ? ' · draft' : ''}
                </button>
              ))}
            </div>
          )}
          <Card className="print-area mb-6">
            <CardHeader
              title={sel.name}
              subtitle={`${sel.start ? fmtDate(sel.start, 'd MMM') : ''}${sel.end ? ` – ${fmtDate(sel.end, 'd MMM yyyy')}` : ''} · ${(sel.papers || []).length} paper${(sel.papers || []).length === 1 ? '' : 's'}${db.terms.find((t) => t.id === sel.termId) ? ` · ${db.terms.find((t) => t.id === sel.termId).name}` : ''}`}
              icon={NotebookPen}
              action={canEdit && (
                <div className="no-print flex flex-wrap items-center gap-2">
                  <Badge tone={sel.published ? 'green' : 'amber'} dot>{sel.published ? 'Published' : 'Draft'}</Badge>
                  {clashCount > 0 && <Badge tone="red">{clashCount} clash{clashCount === 1 ? '' : 'es'}</Badge>}
                  <Button size="sm" icon={Plus} onClick={() => setPaperForm({ date: sel.start || TODAY, start: '09:00', end: '11:00', classIds: view === 'class' && classId ? [classId] : [] })}>Add paper</Button>
                  {sel.published ? <Button size="sm" variant="secondary" icon={EyeOff} onClick={() => publish(false)}>Unpublish</Button> : <Button size="sm" variant="secondary" icon={Send} onClick={() => publish(true)}>Publish</Button>}
                  <IconButton icon={Pencil} label="Edit series" onClick={() => setSeriesForm(sel)} />
                  <IconButton icon={Copy} label="Copy series" onClick={copySeries} />
                  <IconButton icon={Trash2} label="Delete series" className="hover:!text-accent-600" onClick={delSeries} />
                </div>
              )}
            />
            {sel.notes && <p className="border-b border-slate-100 px-5 py-2 text-sm text-slate-600 dark:border-white/5 dark:text-slate-300">{sel.notes}</p>}
            {!portal && (
              <div className="no-print flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3 dark:border-white/5">
                <Tabs value={view} onChange={setView} tabs={[{ value: 'day', label: 'By day', icon: CalendarDays }, { value: 'class', label: 'By class', icon: Clock }]} />
                {view === 'class' && <Select className="!w-48" value={classId || ''} onChange={(e) => setClassId(e.target.value)} options={classes.map((c) => ({ value: c.id, label: c.name }))} />}
                {view === 'day' && isTeacher && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} /> Only my invigilation</label>}
              </div>
            )}
            {portal && student && <p className="border-b border-slate-100 px-5 py-2 text-sm text-slate-500 dark:border-white/5">{student.firstName} · {L.className(student.classId)}</p>}
            {!shown.length ? (
              <EmptyState icon={NotebookPen} title="No papers here" text={canEdit ? 'Add the papers for this series.' : 'No papers for this class in this series.'} />
            ) : view === 'class' || portal ? (
              <div className="divide-y divide-slate-100 dark:divide-white/5">{shown.map((p) => <PaperRow key={p.id} p={p} showDate />)}</div>
            ) : (
              days.map((d) => (
                <div key={d}>
                  <p className="bg-slate-50 px-5 py-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:bg-white/[.03]">{fmtDate(d, 'EEEE d MMMM')}</p>
                  <div className="divide-y divide-slate-100 dark:divide-white/5">{shown.filter((p) => p.date === d).map((p) => <PaperRow key={p.id} p={p} />)}</div>
                </div>
              ))
            )}
          </Card>
        </>
      )}

      <FormModal open={!!seriesForm} onClose={() => setSeriesForm(null)} title={seriesForm?.id ? 'Edit exam series' : 'New exam series'} initial={seriesForm} onSubmit={saveSeries} size="md"
        fields={[
          { name: 'name', label: 'Name', required: true, span: 2, placeholder: 'e.g. End of Term 1 Exams 2026' },
          { name: 'start', label: 'First day', type: 'date', required: true },
          { name: 'end', label: 'Last day', type: 'date', required: true },
          { name: 'termId', label: 'Term', type: 'select', span: 2, options: [...db.terms].sort((a, b) => String(a.start).localeCompare(String(b.start))).map((t) => ({ value: t.id, label: t.name })), placeholder: 'No term' },
          { name: 'notes', label: 'Notes for students and parents', type: 'textarea', placeholder: 'e.g. Arrive 30 minutes early with your pens and mathematical set' },
        ]} />

      <FormModal open={!!paperForm} onClose={() => setPaperForm(null)} title={paperForm?.id ? 'Edit paper' : 'Add paper'} initial={paperForm} onSubmit={savePaper}
        fields={[
          { name: 'subjectId', label: 'Subject', type: 'select', required: true, span: 2, options: (v) => {
            const secs = new Set((v.classIds || []).map((c) => L.cls(c)?.section));
            return [...db.subjects].filter((x) => !secs.size || secs.has(x.section)).sort((a, b) => a.name.localeCompare(b.name)).map((x) => ({ value: x.id, label: `${x.name.trim()} (${x.section})` }));
          }, emptyHint: 'Add subjects in Classes & Subjects' },
          { name: 'classIds', label: 'Classes sitting this paper *', type: 'custom', span: 2, render: (v, set) => <ClassChips classes={classes} value={v.classIds} onChange={set} /> },
          { name: 'date', label: 'Date', type: 'date', required: true },
          { name: 'start', label: 'Starts', type: 'time', required: true },
          { name: 'end', label: 'Ends', type: 'time', required: true },
          { name: 'room', label: 'Room / hall', placeholder: 'e.g. Assembly Hall' },
          { name: 'invigilatorId', label: 'Invigilator', type: 'select', span: 2, placeholder: 'None', options: db.staff.filter((x) => x.status !== 'Exited').map((x) => ({ value: x.id, label: `${x.title ? x.title + ' ' : ''}${x.firstName} ${x.lastName}` })) },
          { name: 'note', label: 'Note', span: 2, placeholder: 'e.g. Paper 1 (objectives)' },
        ]} />
    </>
  );
}
