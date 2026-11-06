import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, School, Users, MapPin, BookOpen, Trash2, Check, Pencil } from 'lucide-react';
import { useDB } from '../../data/store';
import { useLookups, useCurrentUser, sortedClasses } from '../../data/selectors';
import { fullName } from '../../lib/format';
import { SECTIONS } from '../../data/seed';
import { Card, Badge, Avatar, Button, PageHeader, Tabs, Progress, Modal, Select, FormModal, IconButton, toast, confirmDialog, cx } from '../../components/ui';
import TermsEditor from './Terms';
import Houses from './Houses';
import { removeLevel } from '../accounts/SchoolPanel';
import CrudPage from '../../components/CrudPage';
import { photoKey } from '../../data/photos';

export default function Classes() {
  const db = useDB();
  const L = useLookups();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const [tab, setTab] = useState('classes');
  const [open, setOpen] = useState(null);
  const [form, setForm] = useState(null);
  const isAdmin = (user.role === 'admin' || user.role === 'headteacher');
  const teachers = db.staff.filter((s) => s.status !== 'Exited' && /teacher|head|tutor|lecturer/i.test(`${s.role}`));
  const teacherOpts = teachers.map((t) => ({ value: t.id, label: `${t.title} ${t.firstName} ${t.lastName} (${t.department})` }));

  const mine = (c) => user.role !== 'teacher' || c.classTeacherId === user.linkedId || db.allocations.some((a) => a.classId === c.id && a.teacherId === user.linkedId);
  const classes = sortedClasses(db.classes).filter(mine);
  const cls = open && db.classes.find((c) => c.id === open);

  const setTeacher = (classId, subjectId, teacherId) => {
    const id = `alc_${classId}_${subjectId}`;
    db.upsert('allocations', { id, classId, subjectId, teacherId });
    toast.success('Teacher allocated');
  };

  const saveClass = (v) => {
    const sec = v.section;
    const ofSec = db.subjects.filter((s) => s.section === sec).map((s) => s.id);
    const subjectIds = v.subjectIds ? v.subjectIds.filter((id) => ofSec.includes(id)) : ofSec;
    const rec = { ...v, subjectIds, capacity: Number(v.capacity) || 35, name: v.name.trim() };
    if (db.classes.some((c) => c.id !== v.id && c.name.trim().toLowerCase() === rec.name.toLowerCase())) return toast.error('Name already used', `There is already a class called ${rec.name}`);
    if (v.id) {
      db.update('classes', v.id, rec);
      // Subjects taken off the class lose their teacher allocation and timetable slots.
      const keep = new Set(subjectIds);
      db.removeMany('allocations', db.allocations.filter((a) => a.classId === v.id && !keep.has(a.subjectId)).map((a) => a.id));
    } else {
      // Goes after the last class of its level (or of the levels before it), before the next level.
      const upTo = SECTIONS.slice(0, SECTIONS.indexOf(sec) + 1);
      const before = db.classes.filter((c) => upTo.includes(c.section)).map((c) => c.order ?? 0);
      db.add('classes', { ...rec, order: (before.length ? Math.max(...before) : -1) + 0.01 });
    }
    toast.success(v.id ? 'Class updated' : 'Class created', `${rec.name} · ${subjectIds.length} subjects`);
    setForm(null);
  };

  const deleteClasses = async (list) => {
    const withKids = list.filter((c) => db.students.some((s) => s.classId === c.id));
    if (withKids.length) {
      const n = db.students.filter((s) => withKids.some((c) => c.id === s.classId)).length;
      return toast.error('Move the students first', `${withKids.map((c) => c.name).join(', ')} still ha${withKids.length === 1 ? 's' : 've'} ${n} student${n === 1 ? '' : 's'}. Use Promote / Transfer on each student, then delete.`);
    }
    const what = list.length === 1 ? list[0].name : `${list.length} classes`;
    if (!(await confirmDialog(`Delete ${what}?`, 'Its subject-teacher allocations and timetable are removed too. This cannot be undone.', { confirmLabel: 'Delete' }))) return false;
    const ids = new Set(list.map((c) => c.id));
    db.removeMany('allocations', db.allocations.filter((a) => ids.has(a.classId)).map((a) => a.id));
    db.setKey('timetable', (t) => Object.fromEntries(Object.entries(t || {}).filter(([k]) => !ids.has(k))));
    db.removeMany('classes', [...ids]);
    toast.success(`${what} deleted`);
    setOpen(null);
    return true;
  };

  const dropSection = async (sec) => {
    const n = db.classes.filter((c) => c.section === sec).length;
    if (!(await confirmDialog(`Remove all of ${sec}?`, `Deletes the ${n} ${sec} class${n === 1 ? '' : 'es'} (and ${sec} subjects when no class keeps them). Classes that have students are kept.`, { confirmLabel: 'Remove level' }))) return;
    const r = removeLevel(sec);
    toast.success(`${sec} removed`, r.kept ? `${r.removed} removed · ${r.kept} kept because they have students` : `${r.removed} classes removed`);
  };

  // Subjects: deleting one takes it off every class, its allocations and timetable slots.
  const deleteSubjects = (ids) => {
    const drop = new Set(ids);
    db.classes.filter((c) => c.subjectIds.some((x) => drop.has(x))).forEach((c) => db.update('classes', c.id, { subjectIds: c.subjectIds.filter((x) => !drop.has(x)) }));
    db.removeMany('allocations', db.allocations.filter((a) => drop.has(a.subjectId)).map((a) => a.id));
    db.setKey('timetable', (t) => Object.fromEntries(Object.entries(t || {}).map(([cid, days]) => [cid, Object.fromEntries(Object.entries(days || {}).map(([d, cells]) => [d, Object.fromEntries(Object.entries(cells || {}).filter(([, sid]) => !drop.has(sid)))]))])));
    db.removeMany('subjects', ids);
  };
  // After saving a subject: put it on the classes ticked in the form.
  const placeSubject = (rec, v) => {
    // Untouched on a new subject = every class of its level (what the form showed ticked).
    const ids = v._classIds ?? (v.id ? null : db.classes.filter((c) => c.section === rec.section).map((c) => c.id));
    if (!ids) return;
    const want = new Set(ids);
    const latest = useDB.getState();
    latest.classes.forEach((c) => {
      const has = c.subjectIds.includes(rec.id);
      if (want.has(c.id) && !has) db.update('classes', c.id, { subjectIds: [...c.subjectIds, rec.id] });
      if (!want.has(c.id) && has) db.update('classes', c.id, { subjectIds: c.subjectIds.filter((x) => x !== rec.id) });
    });
  };

  return (
    <>
      <PageHeader
        title="Classes & Subjects"
        subtitle="Class structure, programmes, subjects and teacher allocation"
        actions={
          <>
            <Tabs value={tab} onChange={setTab} tabs={[{ value: 'classes', label: 'Classes', count: classes.length }, { value: 'subjects', label: 'Subjects', count: db.subjects.length }, { value: 'terms', label: 'Terms', count: db.terms.length }, { value: 'houses', label: 'Houses', count: (db.houses || []).length }]} />
            {isAdmin && tab === 'classes' && <Button icon={Plus} onClick={() => setForm({ section: SECTIONS.find((x) => db.classes.some((c) => c.section === x)) || 'Primary', capacity: 35 })}>New class</Button>}
          </>
        }
      />
      {tab === 'terms' ? (
        <TermsEditor />
      ) : tab === 'houses' ? (
        <Houses />
      ) : tab === 'classes' ? (
        <div className="space-y-8">
          {!classes.length && (
            <Card className="p-8 text-center">
              <School className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 font-bold text-slate-900 dark:text-white">No classes yet</p>
              <p className="mt-1 text-sm text-slate-500">{isAdmin ? 'Add your first class, or import classes from Excel.' : 'Classes you teach will show here.'}</p>
              {isAdmin && <Button className="mt-4" icon={Plus} onClick={() => setForm({ section: 'Primary', capacity: 35 })}>New class</Button>}
            </Card>
          )}
          {SECTIONS.map((sec) => {
            const list = classes.filter((c) => c.section === sec);
            if (!list.length) return null;
            return (
              <section key={sec}>
                <div className="mb-3 flex items-center gap-3">
                  <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">{sec}</h2>
                  <Badge tone="blue">{list.length} classes</Badge>
                  <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
                  {isAdmin && (
                    <>
                      <Button size="sm" variant="ghost" icon={Plus} onClick={() => setForm({ section: sec, capacity: sec === 'Early Years' ? 20 : 35 })}>Add</Button>
                      <Button size="sm" variant="ghost" icon={Trash2} className="hover:!text-accent-600" onClick={() => dropSection(sec)}>Remove level</Button>
                    </>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                  {list.map((c) => {
                    const n = db.students.filter((s) => s.classId === c.id && s.status === 'Active').length;
                    return (
                      <Card key={c.id} className="group relative cursor-pointer p-5 transition hover:-translate-y-0.5 hover:shadow-lift" onClick={() => setOpen(c.id)}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/30">
                            <School className="h-5 w-5" />
                          </div>
                          <div className="flex items-center gap-1">
                            {c.programme && <Badge tone="violet">{c.programme}</Badge>}
                            {isAdmin && (
                              <span onClick={(e) => e.stopPropagation()} className="flex">
                                <IconButton icon={Pencil} label={`Edit ${c.name}`} onClick={() => setForm(c)} />
                                <IconButton icon={Trash2} label={`Delete ${c.name}`} className="hover:!bg-accent-50 hover:!text-accent-600" onClick={() => deleteClasses([c])} />
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="mt-4 text-lg font-bold text-slate-900 dark:text-white">{c.name}</p>
                        <p className="text-xs text-slate-500">{L.staffName(c.classTeacherId)}</p>
                        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                          <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {n}/{c.capacity}</span>
                          <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" /> {c.subjectIds.length} subjects</span>
                          <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {c.room || '—'}</span>
                        </div>
                        <Progress value={(n / (c.capacity || 1)) * 100} className="mt-3" tone={n / c.capacity > 0.9 ? 'red' : 'blue'} />
                      </Card>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <CrudPage
          collection="subjects"
          noun="subject"
          canEdit={isAdmin}
          defaults={{ section: 'Primary' }}
          onDelete={deleteSubjects}
          deleteNote={(list) => { const n = db.classes.filter((c) => c.subjectIds.some((x) => list.some((s) => s.id === x))).length; return n ? `It is taken off ${n} class${n === 1 ? '' : 'es'}, with its teacher allocations and timetable slots. Scores already entered stay.` : ''; }}
          toRecord={({ code, ...v }) => ({ ...v, code: code?.trim() || v.name.replace(/[^A-Za-z ]/g, '').split(/\s+/).map((w) => w[0]).join('').slice(0, 4).toUpperCase() })}
          onSaved={placeSubject}
          rows={[...db.subjects].sort((a, b) => SECTIONS.indexOf(a.section) - SECTIONS.indexOf(b.section) || a.name.localeCompare(b.name))}
          fields={[
            { name: 'name', label: 'Subject name', required: true },
            { name: 'code', label: 'Code', placeholder: 'Made from the name if empty' },
            { name: 'section', label: 'Section', type: 'select', options: SECTIONS, required: true },
            { name: 'credits', label: 'Credit hours (Diploma)', type: 'number', hidden: (v) => v.section !== 'Diploma' },
            {
              name: '_classIds',
              label: 'Taught in these classes',
              type: 'custom',
              span: 2,
              render: (v, set) => {
                const inSec = sortedClasses(db.classes).filter((c) => c.section === v.section);
                const current = v._classIds ?? (v.id ? db.classes.filter((c) => c.subjectIds.includes(v.id)).map((c) => c.id) : inSec.map((c) => c.id));
                if (!inSec.length) return <p className="text-xs text-slate-500">No {v.section} classes yet.</p>;
                return <PickChips options={inSec.map((c) => ({ value: c.id, label: c.name }))} value={current} onChange={set} />;
              },
            },
          ]}
          columns={[
            { key: 'code', label: 'Code' },
            { key: 'name', label: 'Subject', render: (s) => <span className="font-semibold">{s.name}</span> },
            { key: 'section', label: 'Section', render: (s) => <Badge tone="blue">{s.section}</Badge> },
            { key: 'credits', label: 'Credits', hideOnMobile: true, render: (s) => s.credits || '—' },
            { key: 'classes', label: 'Taught in', hideOnMobile: true, render: (s) => db.classes.filter((c) => c.subjectIds.includes(s.id)).length + ' classes' },
          ]}
        />
      )}

      <Modal open={!!cls} onClose={() => setOpen(null)} title={cls?.name} subtitle={cls ? `${cls.section}${cls.programme ? ` · ${cls.programme}` : ''} · Room ${cls.room}` : ''} size="lg"
        footer={isAdmin && cls && (
          <>
            <Button variant="soft-red" icon={Trash2} onClick={() => deleteClasses([cls])}>Delete class</Button>
            <Button variant="secondary" icon={Pencil} onClick={() => { setForm(cls); setOpen(null); }}>Edit class</Button>
          </>
        )}>
        {cls && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="label">Subjects & teachers</p>
              {isAdmin && !teachers.length && <p className="mb-2 rounded-xl bg-amber-50 p-2.5 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">No teachers yet — add them in Staff & HR (role Teacher), then pick them here.</p>}
              {!cls.subjectIds.length && <p className="text-sm text-slate-500">No subjects on this class yet{isAdmin ? ' — use Edit class to tick them.' : '.'}</p>}
              <div className="space-y-2">
                {cls.subjectIds.map((sid) => {
                  const a = db.allocations.find((x) => x.classId === cls.id && x.subjectId === sid);
                  return (
                    <div key={sid} className="rounded-xl border border-slate-100 p-3 dark:border-white/5">
                      <p className="text-sm font-semibold">{L.subjectName(sid)}</p>
                      {isAdmin ? (
                        <Select className="mt-2 !py-1.5" value={a?.teacherId || ''} onChange={(e) => setTeacher(cls.id, sid, e.target.value)} options={teacherOpts} placeholder="Unassigned" />
                      ) : (
                        <p className="text-xs text-slate-500">{L.staffName(a?.teacherId)}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="label">Students ({db.students.filter((s) => s.classId === cls.id).length})</p>
              <div className="space-y-1">
                {db.students.filter((s) => s.classId === cls.id).map((s) => (
                  <button key={s.id} onClick={() => navigate(`/students/${s.id}`)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-slate-50 dark:hover:bg-white/5">
                    <Avatar name={fullName(s)} photo={photoKey('Student', s.id)} size="xs" />
                    <span className="text-sm">{fullName(s)}</span>
                    <span className="ml-auto text-xs text-slate-400">{s.gender[0]}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <FormModal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? 'Edit class' : 'New class'}
        initial={form}
        onSubmit={saveClass}
        fields={[
          { name: 'name', label: 'Class name', required: true, placeholder: 'e.g. Basic 4B' },
          { name: 'section', label: 'Section', type: 'select', options: SECTIONS, required: true },
          { name: 'programme', label: 'Programme (SHS / Diploma)', type: 'select', options: [...new Set(['General Science', 'General Arts', 'Business', 'Home Economics', 'Visual Arts', 'Agricultural Science', 'Technical', 'Business Administration', 'Information Technology', ...db.classes.map((c) => c.programme).filter(Boolean)])], editable: true, placeholder: 'Leave empty if none', hidden: (v) => !['SHS', 'Diploma'].includes(v.section) },
          { name: 'room', label: 'Room' },
          { name: 'capacity', label: 'Capacity', type: 'number' },
          { name: 'classTeacherId', label: 'Class teacher', type: 'select', options: teacherOpts, placeholder: teacherOpts.length ? 'None yet' : undefined, emptyHint: 'Add teachers in Staff & HR first' },
          {
            name: 'subjectIds',
            label: 'Subjects taken in this class',
            type: 'custom',
            span: 2,
            render: (v, set) => {
              const pool = db.subjects.filter((x) => x.section === v.section);
              const value = v.subjectIds ?? pool.map((x) => x.id);
              if (!pool.length) return <p className="text-xs text-slate-500">No {v.section} subjects yet — add them in the Subjects tab, then tick them here.</p>;
              return <PickChips options={pool.map((x) => ({ value: x.id, label: x.name }))} value={value} onChange={set} />;
            },
          },
        ]}
      />
    </>
  );
}

/** Tick-chips for choosing several items (subjects of a class, classes of a subject). */
function PickChips({ options, value, onChange }) {
  const set = new Set(value);
  const all = options.every((o) => set.has(o.value));
  return (
    <div>
      <div className="mb-2 flex gap-3 text-xs font-semibold">
        <button type="button" className="text-brand-600 hover:underline" onClick={() => onChange(all ? [] : options.map((o) => o.value))}>{all ? 'Untick all' : 'Tick all'}</button>
        <span className="text-slate-400">{value.length} of {options.length} ticked</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = set.has(o.value);
          return (
            <button type="button" key={o.value} onClick={() => onChange(on ? value.filter((x) => x !== o.value) : [...value, o.value])}
              className={cx('flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ring-1 ring-inset transition', on ? 'bg-brand-50 text-brand-700 ring-brand-300 dark:bg-brand-500/15 dark:text-brand-200' : 'text-slate-500 ring-slate-200 dark:ring-white/10')}>
              {on && <Check className="h-3 w-3" />}{o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
