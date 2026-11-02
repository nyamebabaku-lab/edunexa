import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, School, Users, MapPin, BookOpen } from 'lucide-react';
import { useDB } from '../../data/store';
import { useLookups, useCurrentUser, sortedClasses } from '../../data/selectors';
import { fullName } from '../../lib/format';
import { SECTIONS } from '../../data/seed';
import { Card, Badge, Avatar, Button, PageHeader, Tabs, Progress, Modal, Select, FormModal, toast } from '../../components/ui';
import CrudPage from '../../components/CrudPage';

export default function Classes() {
  const db = useDB();
  const L = useLookups();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const [tab, setTab] = useState('classes');
  const [open, setOpen] = useState(null);
  const [form, setForm] = useState(null);
  const isAdmin = user.role === 'admin';
  const teachers = db.staff.filter((s) => s.role === 'Teacher');
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
    const subjectIds = v.subjectIds?.length ? v.subjectIds : db.subjects.filter((s) => s.section === sec).map((s) => s.id);
    if (v.id) db.update('classes', v.id, v);
    else db.add('classes', { ...v, subjectIds, capacity: Number(v.capacity) || 35, order: db.classes.length });
    toast.success(v.id ? 'Class updated' : 'Class created');
    setForm(null);
  };

  return (
    <>
      <PageHeader
        title="Classes & Subjects"
        subtitle="Class structure, programmes, subjects and teacher allocation"
        actions={
          <>
            <Tabs value={tab} onChange={setTab} tabs={[{ value: 'classes', label: 'Classes', count: classes.length }, { value: 'subjects', label: 'Subjects', count: db.subjects.length }]} />
            {isAdmin && tab === 'classes' && <Button icon={Plus} onClick={() => setForm({ section: 'Primary', capacity: 35 })}>New class</Button>}
          </>
        }
      />
      {tab === 'classes' ? (
        <div className="space-y-8">
          {SECTIONS.map((sec) => {
            const list = classes.filter((c) => c.section === sec);
            if (!list.length) return null;
            return (
              <section key={sec}>
                <div className="mb-3 flex items-center gap-3">
                  <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">{sec}</h2>
                  <Badge tone="blue">{list.length} classes</Badge>
                  <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                  {list.map((c) => {
                    const n = db.students.filter((s) => s.classId === c.id && s.status === 'Active').length;
                    return (
                      <Card key={c.id} className="cursor-pointer p-5 transition hover:-translate-y-0.5 hover:shadow-lift" onClick={() => setOpen(c.id)}>
                        <div className="flex items-start justify-between">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/30">
                            <School className="h-5 w-5" />
                          </div>
                          {c.programme && <Badge tone="violet">{c.programme}</Badge>}
                        </div>
                        <p className="mt-4 text-lg font-bold text-slate-900 dark:text-white">{c.name}</p>
                        <p className="text-xs text-slate-500">{L.staffName(c.classTeacherId)}</p>
                        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                          <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {n}/{c.capacity}</span>
                          <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" /> {c.subjectIds.length} subjects</span>
                          <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {c.room}</span>
                        </div>
                        <Progress value={(n / c.capacity) * 100} className="mt-3" tone={n / c.capacity > 0.9 ? 'red' : 'blue'} />
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
          fields={[
            { name: 'name', label: 'Subject name', required: true },
            { name: 'code', label: 'Code', required: true },
            { name: 'section', label: 'Section', type: 'select', options: SECTIONS, required: true },
            { name: 'credits', label: 'Credit hours (Diploma)', type: 'number' },
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
        footer={isAdmin && cls && <Button variant="secondary" onClick={() => { setForm(cls); setOpen(null); }}>Edit class</Button>}>
        {cls && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="label">Subjects & teachers</p>
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
                    <Avatar name={fullName(s)} size="xs" />
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
          { name: 'programme', label: 'Programme (SHS / Diploma)' },
          { name: 'room', label: 'Room' },
          { name: 'capacity', label: 'Capacity', type: 'number' },
          { name: 'classTeacherId', label: 'Class teacher', type: 'select', options: teacherOpts },
        ]}
      />
    </>
  );
}
