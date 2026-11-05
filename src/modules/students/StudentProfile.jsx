import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pencil, IdCard, ArrowUpRight, Phone, Mail, MapPin, HeartPulse, Bus, BedDouble, BookOpen, User, Award, ClipboardCheck, Wallet, ShieldAlert } from 'lucide-react';
import { useDB } from '../../data/store';
import { useLookups, useCurrentUser, attendanceStats, loanStatus, sortedClasses } from '../../data/selectors';
import { fullName, fmtDate, age, money } from '../../lib/format';
import { gradeTone } from '../../lib/grading';
import { classResults } from '../../lib/results';
import { Button, Card, CardHeader, Badge, Avatar, Tabs, KeyValue, FormModal, EmptyState, Modal, Field, Select, toast, cx } from '../../components/ui';
import PrintView, { Paper } from '../../components/PrintView';
import { SchoolLogo } from '../../components/layout/Logo';
import { QRCode } from '../../components/QR';
import { EditableAvatar, Portrait } from '../../components/PhotoEditor';
import { badgeToken } from '../../lib/gate';
import { studentFields } from './Students';
import { StudentStatement } from '../finance/shared';
import { photoKey, applyPhotoChange } from '../../data/photos';

export function ResultsTable({ result, section }) {
  const L = useLookups();
  if (!result) return <EmptyState title="No results yet" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-slate-50/80 dark:bg-white/[.03]">
          <tr>
            <th className="th">Subject</th>
            <th className="th text-center">Class (30)</th>
            <th className="th text-center">Exam (70)</th>
            <th className="th text-center">Total</th>
            <th className="th text-center">Grade</th>
            <th className="th text-center">Pos.</th>
            <th className="th hidden sm:table-cell">Remark</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
          {result.subjects.map((s) => (
            <tr key={s.subjectId}>
              <td className="td font-medium">{L.subjectName(s.subjectId)}</td>
              <td className="td text-center">{s.classScore ?? '—'}</td>
              <td className="td text-center">{s.examScore ?? '—'}</td>
              <td className="td text-center font-bold">{s.total ?? '—'}</td>
              <td className="td text-center">{s.grade ? <Badge tone={gradeTone(s.total)}>{s.grade}</Badge> : '—'}</td>
              <td className="td text-center text-slate-500">{s.position ?? '—'}</td>
              <td className="td hidden text-slate-500 sm:table-cell">{s.remark}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap gap-6 border-t border-slate-100 px-4 py-4 text-sm dark:border-white/5">
        <span>Average: <b>{result.average}%</b></span>
        <span>Position: <b>{result.position}</b></span>
        {result.aggregate != null && section === 'JHS' && <span>BECE aggregate (best 6): <b>{result.aggregate}</b></span>}
        {result.gpa && <span>GPA: <b>{result.gpa}</b></span>}
      </div>
    </div>
  );
}

function IdCardDoc({ student }) {
  const L = useLookups();
  const s = useDB((x) => x.settings);
  return (
    <Paper className="!p-6">
      <div className="mx-auto w-[340px] overflow-hidden rounded-2xl border border-slate-200 shadow-lg">
        <div className="flex items-center gap-2 bg-brand-700 px-4 py-3 text-white">
          <SchoolLogo className="h-8 w-8" />
          <div className="leading-tight">
            <p className="text-xs font-extrabold uppercase">{s.schoolName}</p>
            <p className="text-[9px] text-brand-100">{s.motto}</p>
          </div>
        </div>
        <div className="flex gap-4 bg-white p-4">
          <Portrait pkey={photoKey('Student', student.id)} name={fullName(student)} className="h-28 w-24 shrink-0" />
          <div className="text-xs leading-relaxed">
            <p className="text-sm font-extrabold text-slate-900">{fullName(student)}</p>
            <p><span className="text-slate-400">ID:</span> <b>{student.admissionNo}</b></p>
            <p><span className="text-slate-400">Class:</span> {L.className(student.classId)}</p>
            <p><span className="text-slate-400">DOB:</span> {fmtDate(student.dob)}</p>
            <p><span className="text-slate-400">Blood:</span> {student.bloodGroup || '—'}</p>
            <p><span className="text-slate-400">Emergency:</span> {L.parent(student.parentId)?.phone}</p>
          </div>
          <QRCode value={badgeToken('Student', student.id)} size={76} className="ml-auto self-end" />
        </div>
        <div className="flex items-center justify-between bg-accent-600 px-4 py-1.5 text-[10px] font-semibold text-white">
          <span>STUDENT ID · {s.academicYear}</span>
          <span>Scan at the gate</span>
        </div>
      </div>
    </Paper>
  );
}

export default function StudentProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const db = useDB();
  const L = useLookups();
  const user = useCurrentUser();
  const [tab, setTab] = useState('overview');
  const [edit, setEdit] = useState(false);
  const [idCard, setIdCard] = useState(false);
  const [move, setMove] = useState(null);
  const student = db.students.find((s) => s.id === id);
  const term = db.settings.currentTerm;

  const results = useMemo(() => {
    if (!student) return {};
    return Object.fromEntries(
      db.terms.slice(0, 2).map((t) => {
        const r = classResults(db, student.classId, t.id);
        return [t.id, r.rows.find((x) => x.student.id === student.id)];
      }),
    );
  }, [db, student]);

  if (!student) return <Card><EmptyState title="Student not found" action={<Button onClick={() => navigate('/students')}>Back to students</Button>} /></Card>;

  const cls = L.cls(student.classId);
  const parent = L.parent(student.parentId);
  const att = attendanceStats(db.attendance, student.id);
  const siblings = db.students.filter((s) => s.parentId === student.parentId && s.id !== student.id);
  const route = db.routes.find((r) => r.id === student.busRouteId);
  const dorm = db.dorms.find((d) => d.id === student.dormId);
  const loans = db.loans.filter((l) => l.memberId === student.id);
  const visits = db.healthVisits.filter((h) => h.studentId === student.id);
  const incidents = db.incidents.filter((h) => h.studentId === student.id);
  const isAdmin = (user.role === 'admin' || user.role === 'headteacher');
  const recent = [...db.attendance].filter((a) => a.records[student.id]).sort((a, b) => b.date.localeCompare(a.date));
  const ATT = { P: ['Present', 'green'], A: ['Absent', 'red'], L: ['Late', 'amber'], E: ['Excused', 'blue'] };

  return (
    <>
      <button onClick={() => navigate(-1)} className="no-print mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand-600">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <Card className="overflow-hidden">
        <div className="h-28 bg-gradient-to-r from-brand-700 via-brand-600 to-brand-500 sm:h-32">
          <div className="h-full w-full opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '22px 22px' }} />
        </div>
        <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end sm:px-8">
          <EditableAvatar pkey={photoKey('Student', student.id)} name={fullName(student)} canEdit={['admin', 'superadmin'].includes(user.role)} className="-mt-10" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">{fullName(student)}</h1>
              <Badge tone={student.status === 'Active' ? 'green' : 'red'} dot>{student.status}</Badge>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {student.admissionNo} · {cls?.name}{cls?.programme ? ` (${cls.programme})` : ''} · {student.gender}, {age(student.dob)} yrs
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge tone="violet">{student.boarding}</Badge>
              {student.house && <Badge tone="blue">{student.house} House</Badge>}
              {route && <Badge tone="red"><Bus className="h-3 w-3" /> {route.name.split('–')[0]}</Badge>}
              {student.allergies && <Badge tone="amber"><HeartPulse className="h-3 w-3" /> Allergy: {student.allergies}</Badge>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={IdCard} onClick={() => setIdCard(true)}>ID card</Button>
            {isAdmin && <Button variant="secondary" icon={ArrowUpRight} onClick={() => setMove({ classId: student.classId, status: student.status })}>Promote / Transfer</Button>}
            {isAdmin && <Button icon={Pencil} onClick={() => setEdit(true)}>Edit</Button>}
          </div>
        </div>
      </Card>

      <div className="mt-6">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'overview', label: 'Overview', icon: User },
            { value: 'academics', label: 'Academics', icon: Award },
            { value: 'attendance', label: 'Attendance', icon: ClipboardCheck },
            ...(isAdmin ? [{ value: 'fees', label: 'Fees', icon: Wallet }] : []),
            { value: 'library', label: 'Library', icon: BookOpen },
            { value: 'welfare', label: 'Health & Conduct', icon: ShieldAlert },
          ]}
        />
      </div>

      <div className="mt-6">
        {tab === 'overview' && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader title="Personal information" icon={User} />
              <div className="p-5">
                <KeyValue
                  cols={3}
                  items={[
                    ['Date of birth', fmtDate(student.dob)],
                    ['Nationality', student.nationality],
                    ['Religion', student.religion],
                    ['Admission date', fmtDate(student.admissionDate)],
                    ['Previous school', student.previousSchool],
                    ['Address', student.address],
                    ['Blood group', student.bloodGroup],
                    ['Allergies', student.allergies || 'None'],
                    ['Medical notes', student.medicalNotes || 'None'],
                    ['Class teacher', L.staffName(cls?.classTeacherId)],
                    ['Boarding', dorm ? `${dorm.name} · Bed ${student.bed || '—'}` : 'Day student'],
                    ['Transport', route ? `${route.name} (${money(route.fee)}/term)` : 'Own arrangement'],
                  ]}
                />
              </div>
            </Card>
            <div className="space-y-6">
              <Card>
                <CardHeader title="Parent / guardian" icon={User} />
                <div className="space-y-3 p-5">
                  <div className="flex items-center gap-3">
                    <Avatar name={L.parentName(parent?.id)} />
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{L.parentName(parent?.id)}</p>
                      <p className="text-xs text-slate-500">{parent?.relation} · {parent?.occupation}</p>
                    </div>
                  </div>
                  <p className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-brand-600" /> <a href={`tel:${parent?.phone}`}>{parent?.phone}</a></p>
                  <p className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-brand-600" /> {parent?.email}</p>
                  <p className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-brand-600" /> {parent?.address}</p>
                </div>
              </Card>
              {siblings.length > 0 && (
                <Card>
                  <CardHeader title="Siblings in school" icon={User} />
                  <div className="p-3">
                    {siblings.map((s) => (
                      <button key={s.id} onClick={() => navigate(`/students/${s.id}`)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-slate-50 dark:hover:bg-white/5">
                        <Avatar name={fullName(s)} photo={photoKey('Student', s.id)} size="sm" />
                        <div><p className="text-sm font-semibold">{fullName(s)}</p><p className="text-xs text-slate-500">{L.className(s.classId)}</p></div>
                      </button>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          </div>
        )}

        {tab === 'academics' && (
          <div className="space-y-6">
            {db.terms.slice(0, 2).reverse().map((t) => (
              <Card key={t.id} className="overflow-hidden">
                <CardHeader title={t.name} subtitle={t.id === term ? 'Current term' : 'Previous term'} icon={Award} />
                <div className="mt-3">
                  <ResultsTable result={results[t.id]} section={cls?.section} />
                </div>
              </Card>
            ))}
          </div>
        )}

        {tab === 'attendance' && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <Card className="p-5">
              <p className="text-xs font-semibold uppercase text-slate-500">Attendance rate</p>
              <p className="mt-1 text-4xl font-extrabold text-brand-700 dark:text-brand-300">{att.rate}%</p>
              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                {Object.entries(ATT).map(([k, [label, tone]]) => (
                  <div key={k} className="rounded-xl bg-slate-50 p-3 dark:bg-white/5">
                    <Badge tone={tone}>{label}</Badge>
                    <p className="mt-2 text-xl font-bold">{att[k]}</p>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="xl:col-span-2">
              <CardHeader title="Recent register" icon={ClipboardCheck} />
              <div className="grid grid-cols-3 gap-2 p-5 sm:grid-cols-5">
                {recent.map((a) => {
                  const [label, tone] = ATT[a.records[student.id]];
                  return (
                    <div key={a.id} className="rounded-xl border border-slate-100 p-3 text-center dark:border-white/5">
                      <p className="text-xs text-slate-500">{fmtDate(a.date, 'EEE d MMM')}</p>
                      <Badge tone={tone} className="mt-2">{label}</Badge>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}

        {tab === 'fees' && <StudentStatement studentId={student.id} canRecord />}

        {tab === 'library' && (
          <Card>
            <CardHeader title="Borrowing history" icon={BookOpen} />
            {loans.length === 0 ? (
              <EmptyState title="No books borrowed" />
            ) : (
              <div className="divide-y divide-slate-100 p-2 dark:divide-white/5">
                {loans.map((l) => {
                  const st = loanStatus(l, db.settings.libraryFinePerDay);
                  return (
                    <div key={l.id} className="flex items-center justify-between gap-3 px-3 py-3">
                      <div>
                        <p className="text-sm font-semibold">{db.books.find((b) => b.id === l.bookId)?.title}</p>
                        <p className="text-xs text-slate-500">Issued {fmtDate(l.issueDate)} · due {fmtDate(l.dueDate)}</p>
                      </div>
                      <Badge tone={st.tone}>{st.label}{st.fine ? ` · ${money(st.fine)}` : ''}</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}

        {tab === 'welfare' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Infirmary visits" icon={HeartPulse} />
              {visits.length === 0 ? <EmptyState title="No visits recorded" /> : (
                <div className="divide-y divide-slate-100 p-2 dark:divide-white/5">
                  {visits.map((v) => (
                    <div key={v.id} className="px-3 py-3">
                      <p className="text-sm font-semibold">{v.complaint}</p>
                      <p className="text-xs text-slate-500">{fmtDate(v.date)} · {v.treatment}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
            <Card>
              <CardHeader title="Conduct & discipline" icon={ShieldAlert} />
              {incidents.length === 0 ? <EmptyState title="Clean record" text="No incidents reported." /> : (
                <div className="divide-y divide-slate-100 p-2 dark:divide-white/5">
                  {incidents.map((v) => (
                    <div key={v.id} className="flex items-center justify-between gap-3 px-3 py-3">
                      <div>
                        <p className="text-sm font-semibold">{v.type}</p>
                        <p className="text-xs text-slate-500">{fmtDate(v.date)} · {v.action}</p>
                      </div>
                      <Badge tone={v.status === 'Open' ? 'amber' : 'green'}>{v.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      <FormModal
        open={edit}
        onClose={() => setEdit(false)}
        title="Edit student"
        fields={studentFields(db.classes, db.parents, db.routes, db.dorms)}
        initial={student}
        onSubmit={({ _photo, ...v }) => {
          db.update('students', student.id, v);
          applyPhotoChange(photoKey('Student', student.id), _photo);
          toast.success('Student updated');
          setEdit(false);
        }}
      />
      <Modal
        open={!!move}
        onClose={() => setMove(null)}
        title="Promote / transfer"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setMove(null)}>Cancel</Button>
            <Button
              onClick={() => {
                db.update('students', student.id, move);
                toast.success('Student updated', `${L.className(move.classId)} · ${move.status}`);
                setMove(null);
              }}
            >
              Apply
            </Button>
          </>
        }
      >
        {move && (
          <div className="space-y-4">
            <Field label="Move to class">
              <Select value={move.classId} onChange={(e) => setMove({ ...move, classId: e.target.value })} options={sortedClasses(db.classes).map((c) => ({ value: c.id, label: c.name }))} />
            </Field>
            <Field label="Status">
              <Select value={move.status} onChange={(e) => setMove({ ...move, status: e.target.value })} options={['Active', 'Suspended', 'Withdrawn', 'Graduated']} />
            </Field>
            <p className={cx('rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-white/5')}>Past scores and payments stay attached to the student's record.</p>
          </div>
        )}
      </Modal>
      <PrintView open={idCard} onClose={() => setIdCard(false)} title="Student ID card">
        <IdCardDoc student={student} />
      </PrintView>
    </>
  );
}
