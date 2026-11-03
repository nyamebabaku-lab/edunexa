import { useEffect, useMemo, useState } from 'react';
import { Plus, FileText, Video, Presentation, ClipboardList, ExternalLink, HelpCircle, CheckCircle2, Clock, Trash2, Send, Timer, Trophy, BookOpen } from 'lucide-react';
import { useDB } from '../../data/store';
import { useLookups, useCurrentUser, usePortalStudent, sortedClasses, TODAY } from '../../data/selectors';
import { fmtDate, fullName, pct } from '../../lib/format';
import { Card, PageHeader, Tabs, Select, Button, Badge, Avatar, Modal, Field, Input, Textarea, FormModal, EmptyState, IconButton, toast, confirmDialog, cx } from '../../components/ui';
import { photoKey } from '../../data/photos';

const TYPE_ICON = { Notes: FileText, Video, Slides: Presentation, Worksheet: ClipboardList };

function useScope() {
  const db = useDB();
  const user = useCurrentUser();
  const { student } = usePortalStudent();
  const isStaff = ['admin', 'teacher'].includes(user.role);
  const alloc = db.allocations.filter((a) => user.role === 'admin' || a.teacherId === user.linkedId);
  const classes = isStaff ? sortedClasses(db.classes).filter((c) => alloc.some((a) => a.classId === c.id)) : [];
  return { db, user, student, isStaff, alloc, classes };
}

// ---------------------------------------------------------------- Materials
function Materials({ classId }) {
  const { db, user, isStaff, alloc } = useScope();
  const L = useLookups();
  const [form, setForm] = useState(null);
  const [view, setView] = useState(null);
  const list = db.materials.filter((m) => m.classId === classId).sort((a, b) => b.date.localeCompare(a.date));
  const subjOpts = alloc.filter((a) => a.classId === classId).map((a) => ({ value: a.subjectId, label: L.subjectName(a.subjectId) }));
  return (
    <>
      {isStaff && (
        <div className="mb-4 flex justify-end">
          <Button icon={Plus} onClick={() => setForm({ type: 'Notes', subjectId: subjOpts[0]?.value })}>Post lesson material</Button>
        </div>
      )}
      {list.length === 0 ? (
        <Card><EmptyState icon={BookOpen} title="No lesson materials yet" text={isStaff ? 'Post notes, slides, worksheets or video links for this class.' : 'Your teachers have not posted materials yet.'} /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((m) => {
            const Icon = TYPE_ICON[m.type] || FileText;
            return (
              <Card key={m.id} className="flex cursor-pointer flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-lift" onClick={() => setView(m)}>
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15"><Icon className="h-5 w-5" /></div>
                  <Badge tone="blue">{m.type}</Badge>
                </div>
                <p className="mt-4 font-bold text-slate-900 dark:text-white">{m.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500">{m.content}</p>
                <div className="mt-auto flex items-center justify-between pt-4 text-xs text-slate-400">
                  <span>{L.subjectName(m.subjectId)}</span>
                  <span>{fmtDate(m.date, 'd MMM')}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <Modal open={!!view} onClose={() => setView(null)} title={view?.title} subtitle={view && `${L.subjectName(view.subjectId)} · ${L.staffName(view.authorId)} · ${fmtDate(view.date)}`}
        footer={isStaff && view && <Button variant="soft-red" icon={Trash2} onClick={async () => { if (await confirmDialog('Delete material?', view.title)) { db.remove('materials', view.id); setView(null); toast.success('Deleted'); } }}>Delete</Button>}>
        {view && (
          <div className="space-y-4">
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700 dark:text-slate-300">{view.content}</p>
            {view.link && <a href={view.link} target="_blank" rel="noreferrer"><Button variant="soft" icon={ExternalLink}>Open resource</Button></a>}
          </div>
        )}
      </Modal>
      <FormModal open={!!form} onClose={() => setForm(null)} title="Post lesson material" initial={form}
        fields={[
          { name: 'title', label: 'Title', required: true, span: 2 },
          { name: 'subjectId', label: 'Subject', type: 'select', options: subjOpts, required: true },
          { name: 'type', label: 'Type', type: 'select', options: Object.keys(TYPE_ICON) },
          { name: 'content', label: 'Content / instructions', type: 'textarea', required: true },
          { name: 'link', label: 'Link (video, doc, website)', span: 2, placeholder: 'https://' },
        ]}
        onSubmit={(v) => { db.add('materials', { ...v, classId, date: TODAY, authorId: user.linkedId }); toast.success('Material posted', 'Students can now see it'); setForm(null); }}
      />
    </>
  );
}

// ---------------------------------------------------------------- Assignments
function Assignments({ classId }) {
  const { db, user, student, isStaff, alloc } = useScope();
  const L = useLookups();
  const [form, setForm] = useState(null);
  const [open, setOpen] = useState(null);
  const [answer, setAnswer] = useState('');
  const list = db.assignments.filter((a) => a.classId === classId).sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  const subjOpts = alloc.filter((a) => a.classId === classId).map((a) => ({ value: a.subjectId, label: L.subjectName(a.subjectId) }));
  const classSize = db.students.filter((s) => s.classId === classId).length;
  const asg = open && db.assignments.find((a) => a.id === open);
  const mySub = (aid) => student && db.submissions.find((s) => s.assignmentId === aid && s.studentId === student.id);

  return (
    <>
      {isStaff && (
        <div className="mb-4 flex justify-end">
          <Button icon={Plus} onClick={() => setForm({ subjectId: subjOpts[0]?.value, maxScore: 20, dueDate: TODAY })}>New assignment</Button>
        </div>
      )}
      {list.length === 0 ? <Card><EmptyState icon={ClipboardList} title="No assignments" /></Card> : (
        <div className="space-y-3">
          {list.map((a) => {
            const subs = db.submissions.filter((s) => s.assignmentId === a.id);
            const mine = mySub(a.id);
            const overdue = a.dueDate < TODAY;
            return (
              <Card key={a.id} className="flex cursor-pointer flex-col gap-3 p-4 transition hover:shadow-lift sm:flex-row sm:items-center" onClick={() => { setOpen(a.id); setAnswer(mine?.text || ''); }}>
                <div className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', overdue ? 'bg-slate-100 text-slate-500 dark:bg-white/5' : 'bg-accent-50 text-accent-600 dark:bg-accent-500/15')}>
                  <ClipboardList className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-900 dark:text-white">{a.title}</p>
                  <p className="text-xs text-slate-500">{L.subjectName(a.subjectId)} · {a.maxScore} marks · set {fmtDate(a.date, 'd MMM')}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={overdue ? 'slate' : 'red'}><Clock className="h-3 w-3" /> Due {fmtDate(a.dueDate, 'd MMM')}</Badge>
                  {isStaff ? (
                    <Badge tone="blue">{subs.length}/{classSize} submitted · {subs.filter((s) => s.score == null).length} to mark</Badge>
                  ) : mine ? (
                    <Badge tone="green"><CheckCircle2 className="h-3 w-3" /> {mine.score != null ? `${mine.score}/${a.maxScore}` : 'Submitted'}</Badge>
                  ) : (
                    <Badge tone={overdue ? 'red' : 'amber'}>{overdue ? 'Missed' : 'Pending'}</Badge>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={!!asg} onClose={() => setOpen(null)} title={asg?.title} subtitle={asg && `${L.subjectName(asg.subjectId)} · due ${fmtDate(asg.dueDate)} · ${asg.maxScore} marks`} size={isStaff ? 'lg' : 'md'}
        footer={asg && user.role === 'student' && !(mySub(asg.id)?.score != null) && (
          <Button icon={Send} onClick={() => {
            const ex = mySub(asg.id);
            if (!answer.trim()) return toast.error('Write your answer first');
            if (ex) db.update('submissions', ex.id, { text: answer, date: TODAY });
            else db.add('submissions', { assignmentId: asg.id, studentId: student.id, text: answer, date: TODAY, score: null, feedback: '' });
            toast.success('Assignment submitted'); setOpen(null);
          }}>{mySub(asg.id) ? 'Update submission' : 'Submit'}</Button>
        )}>
        {asg && (
          <div className="space-y-5">
            <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 dark:bg-white/5 dark:text-slate-300">{asg.description}</p>
            {isStaff ? (
              <div>
                <p className="label">Submissions</p>
                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 dark:divide-white/5 dark:border-white/5">
                  {db.students.filter((s) => s.classId === classId).map((s) => {
                    const sub = db.submissions.find((x) => x.assignmentId === asg.id && x.studentId === s.id);
                    return (
                      <div key={s.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                        <div className="flex flex-1 items-center gap-3">
                          <Avatar name={fullName(s)} photo={photoKey('Student', s.id)} size="xs" />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold">{fullName(s)}</p>
                            <p className="truncate text-xs text-slate-500">{sub ? `${fmtDate(sub.date, 'd MMM')} · ${sub.text}` : 'Not submitted'}</p>
                          </div>
                        </div>
                        {sub && (
                          <div className="flex items-center gap-2">
                            <input type="number" min="0" max={asg.maxScore} defaultValue={sub.score ?? ''} placeholder="Score" className="input w-20 !py-1.5 text-center"
                              onBlur={(e) => { if (e.target.value !== '') { db.update('submissions', sub.id, { score: Math.min(asg.maxScore, Number(e.target.value)) }); toast.success('Score saved', fullName(s)); } }} />
                            <span className="text-xs text-slate-400">/ {asg.maxScore}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : user.role === 'student' ? (
              mySub(asg.id)?.score != null ? (
                <div className="rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-500/10">
                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">Graded: {mySub(asg.id).score}/{asg.maxScore}</p>
                  {mySub(asg.id).feedback && <p className="text-sm text-emerald-700 dark:text-emerald-300">“{mySub(asg.id).feedback}”</p>}
                </div>
              ) : (
                <Field label="Your answer"><Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} className="min-h-[160px]" placeholder="Type your answer or describe your attached work…" /></Field>
              )
            ) : (
              <p className="text-sm text-slate-500">Status for {student.firstName}: <b>{mySub(asg.id) ? (mySub(asg.id).score != null ? `Graded ${mySub(asg.id).score}/${asg.maxScore}` : 'Submitted') : 'Not submitted'}</b></p>
            )}
          </div>
        )}
      </Modal>

      <FormModal open={!!form} onClose={() => setForm(null)} title="New assignment" initial={form}
        fields={[
          { name: 'title', label: 'Title', required: true, span: 2 },
          { name: 'subjectId', label: 'Subject', type: 'select', options: subjOpts, required: true },
          { name: 'dueDate', label: 'Due date', type: 'date', required: true },
          { name: 'maxScore', label: 'Maximum score', type: 'number' },
          { name: 'description', label: 'Instructions', type: 'textarea', required: true },
        ]}
        onSubmit={(v) => { db.add('assignments', { ...v, classId, date: TODAY, authorId: user.linkedId }); toast.success('Assignment set', 'Students have been notified'); setForm(null); }}
      />
    </>
  );
}

// ---------------------------------------------------------------- Quizzes
function QuizBuilder({ open, onClose, classId, subjOpts }) {
  const { db, user } = useScope();
  const blank = () => ({ q: '', options: ['', '', '', ''], answer: 0 });
  const [v, setV] = useState({ title: '', subjectId: '', timeLimit: 10, questions: [blank()] });
  useEffect(() => { if (open) setV({ title: '', subjectId: subjOpts[0]?.value || '', timeLimit: 10, questions: [blank()] }); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const setQ = (i, patch) => setV({ ...v, questions: v.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) });
  const save = () => {
    if (!v.title || v.questions.some((q) => !q.q || q.options.some((o) => !o))) return toast.error('Complete the title and every question/option');
    db.add('quizzes', { ...v, classId, timeLimit: Number(v.timeLimit), authorId: user.linkedId, date: TODAY, published: true });
    toast.success('Quiz published', `${v.questions.length} questions`);
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Create quiz" size="lg" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Publish quiz</Button></>}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Title" className="sm:col-span-3"><Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} /></Field>
        <Field label="Subject" className="sm:col-span-2"><Select value={v.subjectId} onChange={(e) => setV({ ...v, subjectId: e.target.value })} options={subjOpts} /></Field>
        <Field label="Time limit (min)"><Input type="number" value={v.timeLimit} onChange={(e) => setV({ ...v, timeLimit: e.target.value })} /></Field>
      </div>
      <div className="mt-6 space-y-4">
        {v.questions.map((q, i) => (
          <div key={i} className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
            <div className="flex items-center gap-2">
              <Badge tone="blue">Q{i + 1}</Badge>
              <Input value={q.q} onChange={(e) => setQ(i, { q: e.target.value })} placeholder="Question" />
              {v.questions.length > 1 && <IconButton icon={Trash2} label="Remove" onClick={() => setV({ ...v, questions: v.questions.filter((_, j) => j !== i) })} />}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {q.options.map((o, k) => (
                <label key={k} className={cx('flex items-center gap-2 rounded-xl border p-2', q.answer === k ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-500/10' : 'border-slate-200 dark:border-white/10')}>
                  <input type="radio" checked={q.answer === k} onChange={() => setQ(i, { answer: k })} className="accent-emerald-600" />
                  <input value={o} onChange={(e) => setQ(i, { options: q.options.map((x, m) => (m === k ? e.target.value : x)) })} placeholder={`Option ${String.fromCharCode(65 + k)}`} className="flex-1 bg-transparent text-sm outline-none" />
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-400">Select the radio button beside the correct answer.</p>
          </div>
        ))}
        <Button variant="soft" icon={Plus} onClick={() => setV({ ...v, questions: [...v.questions, blank()] })}>Add question</Button>
      </div>
    </Modal>
  );
}

function TakeQuiz({ quiz, onClose }) {
  const { db, student } = useScope();
  const [answers, setAnswers] = useState({});
  const [left, setLeft] = useState(quiz.timeLimit * 60);
  const [done, setDone] = useState(null);
  const submit = () => {
    const score = quiz.questions.filter((q, i) => answers[i] === q.answer).length;
    db.add('quizAttempts', { quizId: quiz.id, studentId: student.id, answers: quiz.questions.map((_, i) => answers[i] ?? null), score, total: quiz.questions.length, date: TODAY });
    setDone(score);
  };
  useEffect(() => {
    if (done != null) return;
    if (left <= 0) { submit(); return; }
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Modal open onClose={onClose} title={quiz.title} subtitle={`${quiz.questions.length} questions`} size="lg"
      footer={done == null ? <Button icon={Send} onClick={submit}>Submit quiz</Button> : <Button onClick={onClose}>Close</Button>}>
      {done != null ? (
        <div className="flex flex-col items-center py-8 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/30"><Trophy className="h-9 w-9" /></div>
          <p className="mt-4 text-3xl font-extrabold">{done} / {quiz.questions.length}</p>
          <p className="text-slate-500">{pct(done, quiz.questions.length)}% — {pct(done, quiz.questions.length) >= 70 ? 'Excellent work!' : 'Keep practising!'}</p>
          <div className="mt-6 w-full space-y-2 text-left">
            {quiz.questions.map((q, i) => (
              <div key={i} className={cx('rounded-xl p-3 text-sm', answers[i] === q.answer ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-accent-50 dark:bg-accent-500/10')}>
                <p className="font-semibold">{i + 1}. {q.q}</p>
                <p className="text-xs text-slate-600 dark:text-slate-300">Correct answer: {q.options[q.answer]}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className={cx('mb-5 flex items-center justify-between rounded-2xl p-3 text-sm font-bold', left < 60 ? 'bg-accent-50 text-accent-700 dark:bg-accent-500/10' : 'bg-brand-50 text-brand-700 dark:bg-brand-500/10')}>
            <span className="flex items-center gap-2"><Timer className="h-4 w-4" /> Time left</span>
            <span className="font-mono">{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</span>
          </div>
          <div className="space-y-5">
            {quiz.questions.map((q, i) => (
              <div key={i}>
                <p className="font-semibold text-slate-900 dark:text-white">{i + 1}. {q.q}</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {q.options.map((o, k) => (
                    <button key={k} onClick={() => setAnswers({ ...answers, [i]: k })}
                      className={cx('rounded-xl border p-3 text-left text-sm font-medium transition', answers[i] === k ? 'border-brand-500 bg-brand-50 text-brand-800 ring-2 ring-brand-500/20 dark:bg-brand-500/15 dark:text-brand-200' : 'border-slate-200 hover:border-brand-300 dark:border-white/10')}>
                      <span className="mr-2 font-bold text-slate-400">{String.fromCharCode(65 + k)}.</span>{o}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}

function Quizzes({ classId }) {
  const { db, user, student, isStaff, alloc } = useScope();
  const L = useLookups();
  const [build, setBuild] = useState(false);
  const [take, setTake] = useState(null);
  const [results, setResults] = useState(null);
  const list = db.quizzes.filter((q) => q.classId === classId);
  const subjOpts = alloc.filter((a) => a.classId === classId).map((a) => ({ value: a.subjectId, label: L.subjectName(a.subjectId) }));
  const attemptOf = (qid) => student && db.quizAttempts.find((a) => a.quizId === qid && a.studentId === student.id);
  const rq = results && db.quizzes.find((q) => q.id === results);
  return (
    <>
      {isStaff && <div className="mb-4 flex justify-end"><Button icon={Plus} onClick={() => setBuild(true)}>Create quiz</Button></div>}
      {list.length === 0 ? <Card><EmptyState icon={HelpCircle} title="No quizzes yet" /></Card> : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((q) => {
            const attempts = db.quizAttempts.filter((a) => a.quizId === q.id);
            const mine = attemptOf(q.id);
            const avg = attempts.length ? Math.round(attempts.reduce((a, x) => a + pct(x.score, x.total), 0) / attempts.length) : 0;
            return (
              <Card key={q.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500 text-white shadow-lg shadow-violet-500/30"><HelpCircle className="h-5 w-5" /></div>
                  <Badge tone="slate"><Timer className="h-3 w-3" /> {q.timeLimit} min</Badge>
                </div>
                <p className="mt-4 font-bold text-slate-900 dark:text-white">{q.title}</p>
                <p className="text-xs text-slate-500">{L.subjectName(q.subjectId)} · {q.questions.length} questions</p>
                <div className="mt-auto pt-4">
                  {isStaff ? (
                    <Button variant="soft" className="w-full" onClick={() => setResults(q.id)}>{attempts.length} attempts · avg {avg}%</Button>
                  ) : mine ? (
                    <div className="rounded-xl bg-emerald-50 p-3 text-center text-sm font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">Score: {mine.score}/{mine.total}</div>
                  ) : user.role === 'student' ? (
                    <Button className="w-full" onClick={() => setTake(q)}>Start quiz</Button>
                  ) : (
                    <Badge tone="amber">Not attempted yet</Badge>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <QuizBuilder open={build} onClose={() => setBuild(false)} classId={classId} subjOpts={subjOpts} />
      {take && <TakeQuiz quiz={take} onClose={() => setTake(null)} />}
      <Modal open={!!rq} onClose={() => setResults(null)} title={rq?.title} subtitle="Results">
        {rq && (
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {db.quizAttempts.filter((a) => a.quizId === rq.id).sort((a, b) => b.score - a.score).map((a) => (
              <div key={a.id} className="flex items-center gap-3 py-2.5">
                <Avatar name={L.studentName(a.studentId)} photo={photoKey('Student', a.studentId)} size="xs" />
                <span className="flex-1 text-sm">{L.studentName(a.studentId)}</span>
                <Badge tone={pct(a.score, a.total) >= 60 ? 'green' : 'red'}>{a.score}/{a.total}</Badge>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}

export default function LMS() {
  const { db, isStaff, classes, student, user } = useScope();
  const [tab, setTab] = useState('materials');
  const [classId, setClassId] = useState(isStaff ? (classes.find((c) => c.classTeacherId === user.linkedId) || classes.find((c) => c.name === 'JHS 2') || classes[0])?.id : student?.classId);
  const effective = isStaff ? classId : student?.classId;
  const counts = useMemo(() => ({
    materials: db.materials.filter((m) => m.classId === effective).length,
    assignments: db.assignments.filter((m) => m.classId === effective).length,
    quizzes: db.quizzes.filter((m) => m.classId === effective).length,
  }), [db, effective]);
  return (
    <>
      <PageHeader
        title="Learning (LMS)"
        subtitle={isStaff ? 'Post lessons, set assignments and run quizzes' : `${student.firstName}'s lessons, homework and quizzes`}
        actions={isStaff && <Select className="!w-48" value={classId} onChange={(e) => setClassId(e.target.value)} options={classes.map((c) => ({ value: c.id, label: c.name }))} />}
      />
      <Tabs className="mb-6" value={tab} onChange={setTab} tabs={[
        { value: 'materials', label: 'Lessons', icon: BookOpen, count: counts.materials },
        { value: 'assignments', label: 'Assignments', icon: ClipboardList, count: counts.assignments },
        { value: 'quizzes', label: 'Quizzes', icon: HelpCircle, count: counts.quizzes },
      ]} />
      {tab === 'materials' && <Materials classId={effective} />}
      {tab === 'assignments' && <Assignments classId={effective} />}
      {tab === 'quizzes' && <Quizzes classId={effective} />}
    </>
  );
}

