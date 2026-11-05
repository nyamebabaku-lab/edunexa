import { LIVE } from '../../config';
import SchoolPanel from '../accounts/SchoolPanel';
import { PlatformDashboard } from '../accounts/Schools';
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format, parseISO, subMonths } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import {
  GraduationCap, Users, Wallet, AlertCircle, ClipboardCheck, UserPlus, BookOpen, Package, Bus, CalendarDays, Megaphone,
  ArrowRight, Clock, FileText, Library, Wrench, BedDouble, Banknote, Award, Receipt, MonitorPlay, PenSquare, HelpCircle, Boxes,
  UtensilsCrossed, ShoppingBasket, TrendingUp, Coins, ScanLine, DoorOpen, Video, Radio,
} from 'lucide-react';
import { useDB } from '../../data/store';
import { useCurrentUser, useLookups, useBalances, invoiceNet, loanStatus, attendanceStats, usePortalStudent, stockLevel, TODAY } from '../../data/selectors';
import { money, moneyShort, fmtDate, sum, pct, fullName, groupBy, compactNum } from '../../lib/format';
import { totalScore, gradeFor } from '../../lib/grading';
import { SECTIONS, DAYS } from '../../data/seed';
import { Card, CardHeader, StatCard, Badge, Avatar, Button, Progress, EmptyState, cx } from '../../components/ui';
import { useChartTheme, axisProps, ChartTooltip, Legend } from '../../components/charts';
import { ingredientLevel, useCanteenIncome, CAT_ICON } from '../canteen/Canteen';
import { sessionStatus } from '../../lib/live';
import { photoKey } from '../../data/photos';

function Hello({ name, sub, display }) {
  const h = new Date().getHours();
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return (
    <div className="mb-6 flex flex-col gap-1">
      <p className="text-sm font-semibold text-accent-600">{fmtDate(TODAY, 'EEEE, d MMMM yyyy')}</p>
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
        {greet}, {display || name.replace(/^(Dr\. Mrs\.|Mrs\.|Mr\.|Ms\.)\s/, '').split(' ')[0]}
      </h1>
      {sub && <p className="text-sm text-slate-500">{sub}</p>}
    </div>
  );
}

function ListRow({ icon: Icon, title, sub, right, tone = 'blue', onClick }) {
  const bg = { blue: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15', red: 'bg-accent-50 text-accent-600 dark:bg-accent-500/15', amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15', green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15' }[tone];
  return (
    <div onClick={onClick} className={cx('flex items-center gap-3 px-5 py-3', onClick && 'cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[.03]')}>
      {Icon && (
        <div className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', bg)}>
          <Icon className="h-4 w-4" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</p>
        {sub && <p className="truncate text-xs text-slate-500">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

function Notices({ audience }) {
  const notices = useDB((s) => s.notices);
  const list = notices.filter((n) => n.audience === 'All' || audience.includes(n.audience)).slice(0, 4);
  return (
    <Card>
      <CardHeader title="Notice board" icon={Megaphone} action={<Link to="/communication" className="text-xs font-semibold text-brand-600">View all</Link>} />
      <div className="divide-y divide-slate-100 pb-2 dark:divide-white/5">
        {list.map((n) => (
          <div key={n.id} className="px-5 py-3">
            <div className="flex items-center gap-2">
              {n.priority === 'High' && <Badge tone="red">Important</Badge>}
              <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{n.title}</p>
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-slate-500">{n.body}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function UpcomingEvents({ limit = 5 }) {
  const events = useDB((s) => s.events);
  const list = events.filter((e) => e.date >= TODAY).sort((a, b) => a.date.localeCompare(b.date)).slice(0, limit);
  return (
    <Card>
      <CardHeader title="Upcoming events" icon={CalendarDays} action={<Link to="/calendar" className="text-xs font-semibold text-brand-600">Calendar</Link>} />
      <div className="space-y-1 p-3">
        {list.map((e) => (
          <div key={e.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
            <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-500/15">
              <span className="text-[10px] font-bold uppercase text-accent-600">{fmtDate(e.date, 'MMM')}</span>
              <span className="text-base font-extrabold leading-none text-brand-700 dark:text-brand-300">{fmtDate(e.date, 'd')}</span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{e.title}</p>
              <p className="text-xs text-slate-500">
                {fmtDate(e.date, 'EEEE')} · {e.type}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function useCollections(months = 6) {
  const payments = useDB((s) => s.payments);
  return useMemo(() => {
    const out = [];
    for (let i = months - 1; i >= 0; i--) {
      const m = format(subMonths(parseISO(TODAY), i), 'yyyy-MM');
      out.push({ month: format(parseISO(`${m}-01`), 'MMM'), key: m, amount: sum(payments.filter((p) => p.date.startsWith(m)), (p) => p.amount) });
    }
    return out;
  }, [payments, months]);
}

function CollectionsChart({ height = 240 }) {
  const t = useChartTheme();
  const data = useCollections(7);
  return (
    <Card>
      <CardHeader title="Fee collections" subtitle="Monthly payments received" icon={Wallet} />
      <div className="px-2 pb-4 pt-4" style={{ height }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ left: 8, right: 16, top: 8 }}>
            <defs>
              <linearGradient id="gCol" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={t.primary} stopOpacity={0.28} />
                <stop offset="1" stopColor={t.primary} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={t.grid} vertical={false} />
            <XAxis dataKey="month" {...axisProps(t)} />
            <YAxis {...axisProps(t)} tickFormatter={(v) => compactNum(v)} width={44} />
            <Tooltip content={<ChartTooltip format={money} />} cursor={{ stroke: t.axis, strokeDasharray: '3 3' }} />
            <Area type="monotone" dataKey="amount" name="Collected" stroke={t.primary} strokeWidth={2} fill="url(#gCol)" activeDot={{ r: 5, strokeWidth: 2, stroke: t.surface }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function IncomeExpenseChart() {
  const t = useChartTheme();
  const payments = useDB((s) => s.payments);
  const expenses = useDB((s) => s.expenses);
  const payrollRuns = useDB((s) => s.payrollRuns);
  const canteenSales = useDB((s) => s.canteenSales);
  const canteenMoves = useDB((s) => s.canteenStockMoves);
  const data = useMemo(() => {
    const out = [];
    for (let i = 5; i >= 0; i--) {
      const m = format(subMonths(parseISO(TODAY), i + 1), 'yyyy-MM');
      const payroll = sum(payrollRuns.filter((r) => r.month === m).flatMap((r) => r.lines), (l) => l.gross + l.employerSsnit);
      out.push({
        month: format(parseISO(`${m}-01`), 'MMM'),
        income: sum(payments.filter((p) => p.date.startsWith(m)), (p) => p.amount) + sum(canteenSales.filter((c) => c.date.startsWith(m) && c.method !== 'Bill to fees'), (c) => c.total),
        expense: sum(expenses.filter((e) => e.date.startsWith(m)), (e) => e.amount) + payroll + sum(canteenMoves.filter((c) => c.type === 'Purchase' && c.date.startsWith(m)), (c) => c.cost),
      });
    }
    return out;
  }, [payments, expenses, payrollRuns, canteenSales, canteenMoves]);
  return (
    <Card>
      <CardHeader title="Income vs expenditure" subtitle="Last 6 months, incl. payroll & canteen" icon={Banknote} action={<Legend items={[['Income', t.primary], ['Expenditure', t.secondary]]} />} />
      <div className="h-[260px] px-2 pb-4 pt-4">
        <ResponsiveContainer>
          <BarChart data={data} barGap={2} margin={{ left: 8, right: 16, top: 8 }}>
            <CartesianGrid stroke={t.grid} vertical={false} />
            <XAxis dataKey="month" {...axisProps(t)} />
            <YAxis {...axisProps(t)} tickFormatter={(v) => compactNum(v)} width={44} />
            <Tooltip content={<ChartTooltip format={money} />} cursor={{ fill: t.soft }} />
            <Bar dataKey="income" name="Income" fill={t.primary} radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Bar dataKey="expense" name="Expenditure" fill={t.secondary} radius={[4, 4, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function EnrolmentChart() {
  const t = useChartTheme();
  const students = useDB((s) => s.students);
  const classes = useDB((s) => s.classes);
  const data = SECTIONS.map((sec) => ({
    section: sec,
    students: students.filter((s) => s.status === 'Active' && classes.find((c) => c.id === s.classId)?.section === sec).length,
  }));
  return (
    <Card>
      <CardHeader title="Enrolment by section" subtitle={`${sum(data, (d) => d.students)} active students`} icon={GraduationCap} />
      <div className="h-[240px] px-2 pb-4 pt-4">
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ left: 12, right: 28 }}>
            <CartesianGrid stroke={t.grid} horizontal={false} />
            <XAxis type="number" {...axisProps(t)} />
            <YAxis type="category" dataKey="section" {...axisProps(t)} width={80} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: t.soft }} />
            <Bar dataKey="students" name="Students" fill={t.primary} radius={[0, 4, 4, 0]} maxBarSize={20} label={{ position: 'right', fontSize: 11, fill: t.axis }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function AttendanceTrend({ classIds }) {
  const t = useChartTheme();
  const attendance = useDB((s) => s.attendance);
  const data = useMemo(() => {
    const rel = classIds ? attendance.filter((a) => classIds.includes(a.classId)) : attendance;
    const byDate = groupBy(rel, (a) => a.date);
    return Object.keys(byDate)
      .sort()
      .map((date) => {
        const vals = byDate[date].flatMap((a) => Object.values(a.records));
        return { date: fmtDate(date, 'd MMM'), rate: pct(vals.filter((v) => v === 'P' || v === 'L').length, vals.length) };
      });
  }, [attendance, classIds]);
  return (
    <Card>
      <CardHeader title="Attendance trend" subtitle="Daily present rate, last 15 school days" icon={ClipboardCheck} />
      <div className="h-[240px] px-2 pb-4 pt-4">
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ left: 0, right: 16, top: 8 }}>
            <defs>
              <linearGradient id="gAtt" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={t.primary} stopOpacity={0.22} />
                <stop offset="1" stopColor={t.primary} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={t.grid} vertical={false} />
            <XAxis dataKey="date" {...axisProps(t)} interval="preserveStartEnd" minTickGap={20} />
            <YAxis {...axisProps(t)} domain={[70, 100]} tickFormatter={(v) => `${v}%`} width={40} />
            <Tooltip content={<ChartTooltip format={(v) => `${v}%`} />} cursor={{ stroke: t.axis, strokeDasharray: '3 3' }} />
            <Area type="monotone" dataKey="rate" name="Present" stroke={t.primary} strokeWidth={2} fill="url(#gAtt)" activeDot={{ r: 5, strokeWidth: 2, stroke: t.surface }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function lastAttendanceRate(attendance, classIds) {
  const dates = [...new Set(attendance.map((a) => a.date))].sort();
  const last = dates[dates.length - 1];
  const vals = attendance.filter((a) => a.date === last && (!classIds || classIds.includes(a.classId))).flatMap((a) => Object.values(a.records));
  return { rate: pct(vals.filter((v) => v === 'P' || v === 'L').length, vals.length), date: last };
}

// ---------------------------------------------------------------- Admin
function AdminDashboard({ user }) {
  const db = useDB();
  const L = useLookups();
  const navigate = useNavigate();
  const bal = useBalances();
  const term = db.settings.currentTerm;
  const termInv = db.invoices.filter((i) => i.termId === term);
  const billed = sum(termInv, invoiceNet);
  const termInvIds = new Set(termInv.map((i) => i.id));
  const collected = sum(db.payments.filter((p) => termInvIds.has(p.invoiceId)), (p) => p.amount);
  const active = db.students.filter((s) => s.status === 'Active').length;
  const att = lastAttendanceRate(db.attendance);
  const overdue = db.loans.filter((l) => loanStatus(l).label === 'Overdue').length;
  const lowStock = db.storeItems.filter((i) => i.stock <= i.reorderLevel);
  const pendingLeave = db.leaves.filter((l) => l.status === 'Pending');
  const pipeline = ['Applied', 'Entrance Exam', 'Interview', 'Offered'].map((s) => [s, db.applications.filter((a) => a.stage === s).length]);
  const debtors = db.students.filter((s) => bal.get(s.id).balance > 0).length;

  return (
    <>
      <Hello name={user.name} display={user.role === 'superadmin' ? 'Super Admin' : undefined} sub={[db.settings.schoolName, db.terms.find((t) => t.id === term)?.name].filter(Boolean).join(' · ')} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active students" value={active} icon={GraduationCap} tone="blue" sub={`${db.classes.length} classes · Creche → Diploma`} onClick={() => navigate('/students')} />
        <StatCard label="Staff" value={db.staff.filter((s) => s.status === 'Active').length} icon={Users} tone="navy" sub={`${db.staff.filter((s) => s.role === 'Teacher').length} teachers`} onClick={() => navigate('/staff')} />
        <StatCard label="Term fees collected" value={moneyShort(collected)} icon={Wallet} tone="green" sub={`${pct(collected, billed)}% of ${moneyShort(billed)} billed`} onClick={() => navigate('/finance')} />
        <StatCard label="Outstanding fees" value={moneyShort(bal.totalBilled - bal.totalPaid)} icon={AlertCircle} tone="red" sub={`${debtors} students owing`} onClick={() => navigate('/finance')} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <IncomeExpenseChart />
        </div>
        <Card>
          <CardHeader title="Needs attention" icon={AlertCircle} />
          <div className="divide-y divide-slate-100 py-2 dark:divide-white/5">
            {db.settings.modules.gate !== false && (
              <ListRow icon={DoorOpen} tone="green" title={`Gate: ${db.clockings.filter((c) => c.date === TODAY && c.personType === 'Student').length} students · ${db.clockings.filter((c) => c.date === TODAY && c.personType === 'Staff').length} staff in`} sub={`${db.clockings.filter((c) => c.date === TODAY && c.late).length} late today`} onClick={() => navigate('/gate')} />
            )}
            <ListRow icon={ClipboardCheck} tone="blue" title={`${att.rate}% attendance`} sub={`Last register · ${fmtDate(att.date)}`} onClick={() => navigate('/attendance')} />
            <ListRow icon={UserPlus} tone="blue" title={`${db.applications.filter((a) => a.stage !== 'Rejected' && a.stage !== 'Enrolled').length} applications in pipeline`} sub="Admissions" onClick={() => navigate('/admissions')} />
            <ListRow icon={Package} tone="amber" title={`${lowStock.length} items low on stock`} sub={lowStock.slice(0, 2).map((i) => i.name).join(', ')} onClick={() => navigate('/store')} />
            <ListRow icon={BookOpen} tone="red" title={`${overdue} overdue library books`} sub="Fines accruing daily" onClick={() => navigate('/library')} />
            <ListRow icon={Wrench} tone="amber" title={`${db.buses.filter((b) => b.status !== 'Active').length} bus under maintenance`} sub="Transport" onClick={() => navigate('/transport')} />
            <ListRow icon={FileText} tone="blue" title={`${pendingLeave.length} leave requests pending`} sub="Staff & HR" onClick={() => navigate('/staff')} />
            <ListRow icon={UtensilsCrossed} tone="green" title={`Canteen today: ${money(sum(db.canteenSales.filter((c) => c.date === TODAY), (c) => c.total))}`} sub={`${db.canteenSales.filter((c) => c.date === TODAY).length} sales · ${db.canteenStock.filter((i) => i.qty <= i.reorderLevel).length} ingredients low`} onClick={() => navigate('/canteen')} />
          </div>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <EnrolmentChart />
        <AttendanceTrend />
        <Card>
          <CardHeader title="Admissions pipeline" subtitle="2027 intake" icon={UserPlus} action={<Link to="/admissions" className="text-xs font-semibold text-brand-600">Open</Link>} />
          <div className="space-y-4 p-5">
            {pipeline.map(([stage, n]) => (
              <div key={stage}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span className="font-medium text-slate-600 dark:text-slate-300">{stage}</span>
                  <span className="font-bold text-slate-900 dark:text-white">{n}</span>
                </div>
                <Progress value={pct(n, db.applications.length) * 2.5} tone={stage === 'Offered' ? 'green' : 'blue'} />
              </div>
            ))}
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-white/5">
              <BedDouble className="h-4 w-4 text-brand-600" />
              {db.students.filter((s) => s.boarding === 'Boarder').length} boarders across {db.dorms.length} halls
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader title="Recent payments" icon={Receipt} action={<Link to="/finance" className="text-xs font-semibold text-brand-600">View all</Link>} />
          <div className="divide-y divide-slate-100 pb-2 dark:divide-white/5">
            {[...db.payments]
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 6)
              .map((p) => (
                <ListRow
                  key={p.id}
                  title={L.studentName(p.studentId)}
                  sub={`${p.method}${p.network ? ` · ${p.network}` : ''} · ${fmtDate(p.date)}`}
                  right={<span className="text-sm font-bold text-emerald-600">{money(p.amount)}</span>}
                />
              ))}
          </div>
        </Card>
        <Notices audience={['Parents', 'Staff', 'Students']} />
        <UpcomingEvents />
      </div>
    </>
  );
}

// ---------------------------------------------------------------- Teacher
function todayName() {
  const n = fmtDate(TODAY, 'EEEE');
  return DAYS.includes(n) ? n : 'Monday';
}

function TeacherDashboard({ user }) {
  const db = useDB();
  const L = useLookups();
  const navigate = useNavigate();
  const me = user.linkedId;
  const myAlloc = db.allocations.filter((a) => a.teacherId === me);
  const myClassIds = [...new Set([...myAlloc.map((a) => a.classId), ...db.classes.filter((c) => c.classTeacherId === me).map((c) => c.id)])];
  const formClass = db.classes.find((c) => c.classTeacherId === me);
  const myStudents = db.students.filter((s) => myClassIds.includes(s.classId));
  const day = todayName();
  const schedule = db.periods
    .filter((p) => !p.isBreak)
    .flatMap((p) =>
      myClassIds
        .filter((cid) => myAlloc.some((a) => a.classId === cid && a.subjectId === db.timetable[cid]?.[day]?.[p.id]))
        .map((cid) => ({ period: p, classId: cid, subjectId: db.timetable[cid][day][p.id] })),
    );
  const myAssignments = db.assignments.filter((a) => a.authorId === me);
  const toGrade = db.submissions.filter((s) => myAssignments.some((a) => a.id === s.assignmentId) && s.score == null);
  const att = lastAttendanceRate(db.attendance, formClass ? [formClass.id] : myClassIds);
  const takenToday = formClass && db.attendance.some((a) => a.classId === formClass.id && a.date === TODAY && a.takenBy !== 'gate');

  return (
    <>
      <Hello name={user.name} sub={formClass ? `Class teacher · ${formClass.name}` : 'Teacher'} />
      <ClockCard />
      <LiveCard />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="My classes" value={myClassIds.length} icon={GraduationCap} tone="blue" sub={`${myStudents.length} students`} />
        <StatCard label="Lessons today" value={schedule.length} icon={Clock} tone="navy" sub={day} onClick={() => navigate('/timetable')} />
        <StatCard label="Work to mark" value={toGrade.length} icon={PenSquare} tone="red" sub="Ungraded submissions" onClick={() => navigate('/lms')} />
        <StatCard label="Form class attendance" value={`${att.rate}%`} icon={ClipboardCheck} tone="green" sub={`Last register ${fmtDate(att.date, 'd MMM')}`} onClick={() => navigate('/attendance')} />
      </div>

      {formClass && !takenToday && (
        <Card className="mt-6 flex flex-col items-start gap-4 border-brand-200 bg-gradient-to-r from-brand-600 to-brand-700 p-5 text-white sm:flex-row sm:items-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="font-bold">Today's register for {formClass.name} hasn't been taken</p>
            <p className="text-sm text-brand-100">Mark attendance before 9:00am so parents of absent students are notified.</p>
          </div>
          <Button variant="danger" onClick={() => navigate('/attendance')} icon={ArrowRight}>
            Take register
          </Button>
        </Card>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title={`My timetable · ${day}`} icon={Clock} action={<Link to="/timetable" className="text-xs font-semibold text-brand-600">Full week</Link>} />
          <div className="p-5">
            {schedule.length === 0 ? (
              <EmptyState title="No lessons today" />
            ) : (
              <ol className="relative space-y-3 border-l-2 border-dashed border-slate-200 pl-6 dark:border-white/10">
                {schedule.map((s, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[31px] top-3 h-3 w-3 rounded-full border-2 border-white bg-brand-600 dark:border-navy-900" />
                    <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3.5 dark:bg-white/5">
                      <div>
                        <p className="text-sm font-bold text-slate-800 dark:text-white">{L.subjectName(s.subjectId)}</p>
                        <p className="text-xs text-slate-500">
                          {L.className(s.classId)} · {L.cls(s.classId)?.room}
                        </p>
                      </div>
                      <Badge tone="blue">
                        {s.period.start}–{s.period.end}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Quick actions" icon={PenSquare} />
          <div className="grid grid-cols-2 gap-3 p-5">
            {[
              [ClipboardCheck, 'Attendance', '/attendance'],
              [Award, 'Enter scores', '/gradebook'],
              [FileText, 'Report cards', '/report-cards'],
              [MonitorPlay, 'Post lesson', '/lms'],
              [HelpCircle, 'Create quiz', '/lms'],
              [Megaphone, 'Message parents', '/communication'],
            ].map(([Icon, label, to]) => (
              <button key={label} onClick={() => navigate(to)} className="flex flex-col items-center gap-2 rounded-2xl border border-slate-100 p-4 text-center text-xs font-semibold text-slate-700 transition hover:border-brand-200 hover:bg-brand-50 dark:border-white/5 dark:text-slate-200 dark:hover:bg-white/5">
                <Icon className="h-5 w-5 text-brand-600" />
                {label}
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <AttendanceTrend classIds={myClassIds} />
        <Card>
          <CardHeader title="My classes" icon={GraduationCap} />
          <div className="divide-y divide-slate-100 pb-2 dark:divide-white/5">
            {myClassIds.map((cid) => (
              <ListRow
                key={cid}
                icon={GraduationCap}
                title={L.className(cid)}
                sub={myAlloc.filter((a) => a.classId === cid).map((a) => L.subjectName(a.subjectId)).join(', ') || 'Form class'}
                right={<Badge>{db.students.filter((s) => s.classId === cid).length} students</Badge>}
              />
            ))}
          </div>
        </Card>
        <Notices audience={['Staff']} />
      </div>
    </>
  );
}

// ---------------------------------------------------------------- Parent & student
function ChildCard({ student }) {
  const db = useDB();
  const L = useLookups();
  const bal = useBalances().get(student.id);
  const att = attendanceStats(db.attendance, student.id);
  const c = L.cls(student.classId);
  const sc = db.scores.filter((s) => s.studentId === student.id && s.termId === db.settings.currentTerm);
  const avg = sc.length ? Math.round(sum(sc, totalScore) / sc.length) : 0;
  const route = db.routes.find((r) => r.id === student.busRouteId);
  return (
    <Card className="overflow-hidden">
      <div className="relative bg-gradient-to-br from-brand-600 to-brand-800 p-5 text-white">
        <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-4">
          <Avatar name={fullName(student)} photo={photoKey('Student', student.id)} size="lg" className="ring-white/30" />
          <div>
            <p className="text-lg font-bold">{fullName(student)}</p>
            <p className="text-sm text-brand-100">
              {c?.name} · {student.admissionNo}
            </p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-white/5">
        <div className="p-4 text-center">
          <p className="text-xl font-extrabold text-slate-900 dark:text-white">{att.rate}%</p>
          <p className="text-[11px] font-semibold uppercase text-slate-400">Attendance</p>
        </div>
        <div className="p-4 text-center">
          <p className="text-xl font-extrabold text-slate-900 dark:text-white">{avg}%</p>
          <p className="text-[11px] font-semibold uppercase text-slate-400">Avg · Grade {gradeFor(avg, c?.section).grade}</p>
        </div>
        <div className="p-4 text-center">
          <p className={cx('text-xl font-extrabold', bal.balance > 0 ? 'text-accent-600' : 'text-emerald-600')}>{moneyShort(bal.balance)}</p>
          <p className="text-[11px] font-semibold uppercase text-slate-400">Fees owing</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-slate-100 p-4 dark:border-white/5">
        {route && <Badge tone="blue"><Bus className="h-3 w-3" /> {route.name}</Badge>}
        <Badge tone="slate">{student.boarding}</Badge>
        {student.house && <Badge tone="violet">{student.house} House</Badge>}
      </div>
    </Card>
  );
}

function FamilyDashboard({ user }) {
  const db = useDB();
  const L = useLookups();
  const navigate = useNavigate();
  const { student, children } = usePortalStudent();
  const isParent = user.role === 'parent';
  const kids = isParent ? children : [student];
  const due = db.assignments
    .filter((a) => a.classId === student.classId && a.dueDate >= TODAY)
    .filter((a) => !db.submissions.some((s) => s.assignmentId === a.id && s.studentId === student.id));
  const quizzes = db.quizzes.filter((q) => q.classId === student.classId && q.published && !db.quizAttempts.some((a) => a.quizId === q.id && a.studentId === student.id));
  const day = todayName();
  const tt = db.timetable[student.classId]?.[day] || {};
  const loans = db.loans.filter((l) => l.memberId === student.id && !l.returnDate);

  return (
    <>
      <Hello name={user.name} sub={isParent ? `Parent of ${children.map((c) => c.firstName).join(' & ')}` : `${L.className(student.classId)} · ${student.admissionNo}`} />
      {!isParent && <ClockCard />}
      {!isParent && <LiveCard />}
      <div className={cx('grid grid-cols-1 gap-6', kids.length > 1 ? 'lg:grid-cols-2' : 'lg:grid-cols-[1fr_1.4fr]')}>
        {kids.map((k) => (
          <ChildCard key={k.id} student={k} />
        ))}
        {!isParent && (
          <Card>
            <CardHeader title={`Today · ${day}`} icon={Clock} action={<Link to="/timetable" className="text-xs font-semibold text-brand-600">Timetable</Link>} />
            <div className="grid grid-cols-2 gap-2 p-5 sm:grid-cols-4">
              {db.periods
                .filter((p) => !p.isBreak)
                .map((p) => (
                  <div key={p.id} className="rounded-xl bg-slate-50 p-3 dark:bg-white/5">
                    <p className="text-[10px] font-bold text-accent-600">{p.start}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs font-semibold text-slate-700 dark:text-slate-200">{L.subjectName(tt[p.id])}</p>
                  </div>
                ))}
            </div>
          </Card>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Homework due" value={due.length} icon={PenSquare} tone="red" sub={isParent ? `For ${student.firstName}` : 'Not yet submitted'} onClick={() => navigate('/lms')} />
        <StatCard label="Quizzes open" value={quizzes.length} icon={HelpCircle} tone="violet" sub="On the LMS" onClick={() => navigate('/lms')} />
        <StatCard label="Results" value="View" icon={Award} tone="blue" sub="Term report & grades" onClick={() => navigate('/my/results')} />
        {isParent ? (
          <StatCard label="Pay fees" value="MoMo" icon={Wallet} tone="green" sub="Pay online & get receipt" onClick={() => navigate('/my/fees')} />
        ) : (
          <StatCard label="Library books" value={loans.length} icon={Library} tone="green" sub="Currently borrowed" onClick={() => navigate('/library')} />
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader title="Assignments due" icon={PenSquare} action={<Link to="/lms" className="text-xs font-semibold text-brand-600">LMS</Link>} />
          {due.length === 0 ? (
            <EmptyState title="All caught up!" text="No pending assignments." />
          ) : (
            <div className="divide-y divide-slate-100 pb-2 dark:divide-white/5">
              {due.map((a) => (
                <ListRow key={a.id} icon={FileText} tone="red" title={a.title} sub={L.subjectName(a.subjectId)} right={<Badge tone="red">Due {fmtDate(a.dueDate, 'd MMM')}</Badge>} />
              ))}
            </div>
          )}
        </Card>
        <Notices audience={isParent ? ['Parents'] : ['Students']} />
        <UpcomingEvents />
      </div>
    </>
  );
}

// ---------------------------------------------------------------- Staff roles
function AccountantDashboard({ user }) {
  const db = useDB();
  const L = useLookups();
  const bal = useBalances();
  const navigate = useNavigate();
  const term = db.settings.currentTerm;
  const termInv = db.invoices.filter((i) => i.termId === term);
  const ids = new Set(termInv.map((i) => i.id));
  const billed = sum(termInv, invoiceNet);
  const collected = sum(db.payments.filter((p) => ids.has(p.invoiceId)), (p) => p.amount);
  const monthKey = TODAY.slice(0, 7);
  const lastMonth = format(subMonths(parseISO(TODAY), 1), 'yyyy-MM');
  const debtors = db.students.map((s) => ({ s, b: bal.get(s.id).balance })).filter((x) => x.b > 0).sort((a, b) => b.b - a.b);
  return (
    <>
      <Hello name={user.name} sub="Finance overview" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Billed this term" value={moneyShort(billed)} icon={FileText} tone="blue" sub={`${termInv.length} invoices`} />
        <StatCard label="Collected this term" value={moneyShort(collected)} icon={Wallet} tone="green" sub={`${pct(collected, billed)}% collection rate`} />
        <StatCard label="Outstanding" value={moneyShort(bal.totalBilled - bal.totalPaid)} icon={AlertCircle} tone="red" sub={`${debtors.length} students`} />
        <StatCard label="Expenses (last month)" value={moneyShort(sum(db.expenses.filter((e) => e.date.startsWith(lastMonth)), (e) => e.amount))} icon={Banknote} tone="amber" sub={`This month so far: ${moneyShort(sum(db.expenses.filter((e) => e.date.startsWith(monthKey)), (e) => e.amount))}`} />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <CollectionsChart height={280} />
        <IncomeExpenseChart />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Top debtors" icon={AlertCircle} action={<Button size="sm" variant="soft" onClick={() => navigate('/finance')}>Arrears</Button>} />
          <div className="divide-y divide-slate-100 pb-2 dark:divide-white/5">
            {debtors.slice(0, 7).map(({ s, b }) => (
              <ListRow key={s.id} title={fullName(s)} sub={`${L.className(s.classId)} · ${L.parentName(s.parentId)}`} right={<span className="text-sm font-bold text-accent-600">{money(b)}</span>} />
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Payment methods" subtitle="This term" icon={Receipt} />
          <div className="space-y-4 p-5">
            {Object.entries(groupBy(db.payments.filter((p) => ids.has(p.invoiceId)), (p) => p.method))
              .sort((a, b) => sum(b[1], (p) => p.amount) - sum(a[1], (p) => p.amount))
              .map(([m, ps]) => {
                const v = sum(ps, (p) => p.amount);
                return (
                  <div key={m}>
                    <div className="mb-1.5 flex justify-between text-sm">
                      <span className="font-medium text-slate-600 dark:text-slate-300">{m}</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {money(v)} <span className="font-normal text-slate-400">· {pct(v, collected)}%</span>
                      </span>
                    </div>
                    <Progress value={pct(v, collected)} />
                  </div>
                );
              })}
          </div>
        </Card>
      </div>
    </>
  );
}

function LibrarianDashboard({ user }) {
  const db = useDB();
  const L = useLookups();
  const navigate = useNavigate();
  const fine = db.settings.libraryFinePerDay;
  const open = db.loans.filter((l) => !l.returnDate);
  const overdue = open.filter((l) => loanStatus(l, fine).label === 'Overdue');
  const memberName = (l) => (l.memberType === 'Staff' ? L.staffName(l.memberId) : L.studentName(l.memberId));
  return (
    <>
      <Hello name={user.name} sub="Library overview" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Titles" value={db.books.length} icon={BookOpen} tone="blue" sub={`${sum(db.books, (b) => b.copies)} copies`} />
        <StatCard label="On loan" value={open.length} icon={Library} tone="navy" />
        <StatCard label="Overdue" value={overdue.length} icon={AlertCircle} tone="red" sub="Fines accruing" />
        <StatCard label="Fines outstanding" value={money(sum(overdue, (l) => loanStatus(l, fine).fine))} icon={Wallet} tone="amber" />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Overdue books" icon={AlertCircle} action={<Button size="sm" variant="soft" onClick={() => navigate('/library')}>Manage</Button>} />
          <div className="divide-y divide-slate-100 pb-2 dark:divide-white/5">
            {overdue.slice(0, 8).map((l) => (
              <ListRow key={l.id} icon={BookOpen} tone="red" title={db.books.find((b) => b.id === l.bookId)?.title} sub={memberName(l)} right={<Badge tone="red">{loanStatus(l, fine).late}d late</Badge>} />
            ))}
          </div>
        </Card>
        <Notices audience={['Staff']} />
      </div>
    </>
  );
}

function StoreDashboard({ user }) {
  const db = useDB();
  const navigate = useNavigate();
  const low = db.storeItems.filter((i) => i.stock <= i.reorderLevel);
  const monthSales = db.stockMoves.filter((m) => m.type === 'Sale' && m.date >= format(subMonths(parseISO(TODAY), 1), 'yyyy-MM-dd'));
  return (
    <>
      <Hello name={user.name} sub="Store & inventory overview" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Items" value={db.storeItems.length} icon={Boxes} tone="blue" sub={`${db.suppliers.length} suppliers`} />
        <StatCard label="Stock value (cost)" value={moneyShort(sum(db.storeItems, (i) => i.stock * i.cost))} icon={Package} tone="navy" />
        <StatCard label="Low / out of stock" value={low.length} icon={AlertCircle} tone="red" onClick={() => navigate('/store')} />
        <StatCard label="Sales (30 days)" value={moneyShort(sum(monthSales, (m) => m.amount))} icon={Receipt} tone="green" sub={`${monthSales.length} transactions`} />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Reorder list" icon={AlertCircle} action={<Button size="sm" variant="soft" onClick={() => navigate('/store')}>Open store</Button>} />
          <div className="divide-y divide-slate-100 pb-2 dark:divide-white/5">
            {low.map((i) => (
              <ListRow key={i.id} icon={Package} tone={stockLevel(i).tone === 'red' ? 'red' : 'amber'} title={i.name} sub={`Reorder at ${i.reorderLevel} ${i.unit}`} right={<Badge tone={stockLevel(i).tone}>{i.stock} left</Badge>} />
            ))}
          </div>
        </Card>
        <Notices audience={['Staff']} />
      </div>
    </>
  );
}

function TransportDashboard({ user }) {
  const db = useDB();
  const L = useLookups();
  const riders = db.students.filter((s) => s.busRouteId);
  return (
    <>
      <Hello name={user.name} sub="Transport overview" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Buses" value={db.buses.length} icon={Bus} tone="blue" sub={`${db.buses.filter((b) => b.status === 'Active').length} active`} />
        <StatCard label="Riders" value={riders.length} icon={GraduationCap} tone="navy" sub={`${db.routes.length} routes`} />
        <StatCard label="Trips (7 days)" value={db.trips.length} icon={Clock} tone="green" />
        <StatCard label="In maintenance" value={db.buses.filter((b) => b.status !== 'Active').length} icon={Wrench} tone="red" />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Routes" icon={Bus} action={<Link to="/transport" className="text-xs font-semibold text-brand-600">Manage</Link>} />
          <div className="divide-y divide-slate-100 pb-2 dark:divide-white/5">
            {db.routes.map((r) => {
              const bus = db.buses.find((b) => b.id === r.busId);
              const n = riders.filter((s) => s.busRouteId === r.id).length;
              return (
                <ListRow
                  key={r.id}
                  icon={Bus}
                  tone={bus?.status === 'Active' ? 'blue' : 'red'}
                  title={r.name}
                  sub={`${bus?.regNo} · ${L.staffName(bus?.driverId)} · departs ${r.departure}`}
                  right={<Badge tone={n > (bus?.capacity || 0) ? 'red' : 'slate'}>{n}/{bus?.capacity}</Badge>}
                />
              );
            })}
          </div>
        </Card>
        <Notices audience={['Staff']} />
      </div>
    </>
  );
}

function CanteenDashboard({ user }) {
  const db = useDB();
  const L = useLookups();
  const navigate = useNavigate();
  const week = useCanteenIncome('7');
  const today = db.canteenSales.filter((c) => c.date === TODAY);
  const low = db.canteenStock.filter((i) => i.qty <= i.reorderLevel);
  const menu = db.canteenMenu[todayName()] || { Breakfast: [], Lunch: [] };
  const item = (id) => db.canteenItems.find((i) => i.id === id);
  return (
    <>
      <Hello name={user.name} sub={`Canteen · ${todayName()}'s service`} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Sales today" value={money(sum(today, (c) => c.total))} icon={Coins} tone="green" sub={`${today.length} orders`} onClick={() => navigate('/canteen')} />
        <StatCard label="Last 7 days" value={moneyShort(week.revenue)} icon={TrendingUp} tone="blue" sub={`${week.sales.length} orders`} />
        <StatCard label="Net (7 days)" value={moneyShort(week.revenue - week.purchases)} icon={Wallet} tone="navy" sub={`Purchases ${moneyShort(week.purchases)}`} />
        <StatCard label="Ingredients low" value={low.length} icon={AlertCircle} tone="red" sub={low.slice(0, 2).map((i) => i.name).join(', ')} onClick={() => navigate('/canteen')} />
      </div>
      <Card className="mt-6 flex flex-col items-start gap-4 bg-gradient-to-r from-brand-600 to-brand-700 p-5 text-white sm:flex-row sm:items-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15"><ShoppingBasket className="h-5 w-5" /></div>
        <div className="flex-1">
          <p className="font-bold">Ready for service</p>
          <p className="text-sm text-brand-100">Open the point of sale to take orders by cash, MoMo or bill to fees.</p>
        </div>
        <Button variant="danger" icon={ArrowRight} onClick={() => navigate('/canteen')}>Open point of sale</Button>
      </Card>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title={`Today's menu · ${todayName()}`} icon={UtensilsCrossed} />
          <div className="space-y-4 p-5">
            {['Breakfast', 'Lunch'].map((slot) => {
              const Icon = CAT_ICON[slot];
              return (
                <div key={slot}>
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400"><Icon className="h-3.5 w-3.5" /> {slot}</p>
                  {menu[slot].map((id) => (
                    <div key={id} className="flex justify-between py-1 text-sm">
                      <span className={cx(!item(id)?.available && 'text-slate-400 line-through')}>{item(id)?.name}</span>
                      <span className="font-semibold">{money(item(id)?.price)}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </Card>
        <Card>
          <CardHeader title="Best sellers this week" icon={TrendingUp} />
          <div className="divide-y divide-slate-100 pb-2 dark:divide-white/5">
            {week.top.slice(0, 6).map((x) => (
              <ListRow key={x.item.id} title={x.item.name} sub={`${x.qty} sold`} right={<span className="text-sm font-bold">{money(x.revenue)}</span>} />
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Restock needed" icon={Package} />
          {low.length === 0 ? <EmptyState title="Kitchen is fully stocked" /> : (
            <div className="divide-y divide-slate-100 pb-2 dark:divide-white/5">
              {low.map((i) => (
                <ListRow key={i.id} icon={Package} tone={ingredientLevel(i).tone === 'red' ? 'red' : 'amber'} title={i.name} sub={`Reorder at ${i.reorderLevel} ${i.unit} · ${i.supplier}`} right={<Badge tone={ingredientLevel(i).tone}>{i.qty} {i.unit}</Badge>} />
              ))}
            </div>
          )}
        </Card>
      </div>
      <div className="mt-6">
        <Card>
          <CardHeader title="Recent orders" icon={Receipt} />
          <div className="divide-y divide-slate-100 pb-2 dark:divide-white/5">
            {[...db.canteenSales].sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)).slice(0, 6).map((c) => (
              <ListRow key={c.id} title={c.items.map((l) => `${l.qty}× ${item(l.itemId)?.name}`).join(', ')} sub={`${c.buyerType === 'Student' ? L.studentName(c.studentId) : c.buyerType === 'Staff' ? L.staffName(c.staffId) : 'Visitor'} · ${fmtDate(c.date, 'd MMM')} ${c.time} · ${c.method}`} right={<span className="text-sm font-bold text-emerald-600">{money(c.total)}</span>} />
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

function ClockCard() {
  const db = useDB();
  const user = useCurrentUser();
  const navigate = useNavigate();
  if (db.settings.modules.gate === false || !user.linkedId || user.role === 'parent') return null;
  const type = user.role === 'student' ? 'Student' : 'Staff';
  const c = db.clockings.find((x) => x.date === TODAY && x.personType === type && x.personId === user.linkedId);
  return (
    <Card className="mb-6 flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center">
      <div className={cx('flex h-11 w-11 items-center justify-center rounded-2xl text-white', c ? (c.late ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-accent-600')}><ScanLine className="h-5 w-5" /></div>
      <div className="flex-1">
        <p className="font-bold text-slate-900 dark:text-white">{!c ? "You haven't clocked in today" : c.out ? `Clocked out at ${c.out}` : `Clocked in at ${c.in}${c.late ? ' (late)' : ''}`}</p>
        <p className="text-sm text-slate-500">Scan the QR code at the {db.settings.gate.name} when you arrive and leave.</p>
      </div>
      {!c?.out && <Button icon={ScanLine} onClick={() => navigate('/clock')}>{c ? 'Clock out' : 'Clock in'}</Button>}
    </Card>
  );
}

function LiveCard() {
  const db = useDB();
  const user = useCurrentUser();
  const L = useLookups();
  const navigate = useNavigate();
  const { student } = usePortalStudent();
  if (db.settings.modules.live === false) return null;
  const mine = (s) => (user.role === 'teacher' ? s.teacherId === user.linkedId : student && s.classId === student.classId);
  const next = db.liveSessions.filter(mine).map((s) => ({ ...s, st: sessionStatus(s) })).filter((s) => !['Ended', 'Missed'].includes(s.st)).sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`))[0];
  if (!next) return null;
  const live = next.st === 'Live';
  return (
    <Card className={cx('mb-6 flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center', live && 'border-accent-300 bg-accent-50/40 dark:bg-accent-500/5')}>
      <div className={cx('flex h-11 w-11 items-center justify-center rounded-2xl text-white', live ? 'bg-accent-600' : 'bg-brand-600')}>{live ? <Radio className="h-5 w-5 animate-pulse" /> : <Video className="h-5 w-5" />}</div>
      <div className="flex-1">
        <p className="font-bold text-slate-900 dark:text-white">{live ? 'Live now: ' : next.date === TODAY ? 'Live class today: ' : 'Next live class: '}{next.title}</p>
        <p className="text-sm text-slate-500">{L.subjectName(next.subjectId)} · {fmtDate(next.date, 'EEE d MMM')} at {next.start} · {L.staffName(next.teacherId)}</p>
      </div>
      <Button icon={live ? Radio : Video} variant={live || next.date === TODAY ? 'primary' : 'soft'} onClick={() => navigate(next.date === TODAY || live ? `/live/room/${next.code}` : '/live')}>
        {user.role === 'teacher' ? 'Start class' : live ? 'Join now' : next.date === TODAY ? 'Join' : 'View'}
      </Button>
    </Card>
  );
}

function StaffDashboard({ user }) {
  return (
    <>
      <Hello name={user.name} sub={useLookups().staff(user.linkedId)?.role} />
      <ClockCard />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Notices audience={['Staff']} />
        <UpcomingEvents />
      </div>
    </>
  );
}

export default function Dashboard() {
  const user = useCurrentUser();
  if (LIVE && user.role === 'superadmin') return <PlatformDashboard />;
  switch (user.role) {
    case 'admin':
      return LIVE ? <><SchoolPanel /><AdminDashboard user={user} /></> : <AdminDashboard user={user} />;
    case 'superadmin':
    case 'headteacher':
      return <AdminDashboard user={user} />;
    case 'staff':
    case 'hostel':
      return <StaffDashboard user={user} />;
    case 'teacher':
      return <TeacherDashboard user={user} />;
    case 'parent':
    case 'student':
      return <FamilyDashboard user={user} />;
    case 'accountant':
      return <AccountantDashboard user={user} />;
    case 'librarian':
      return <LibrarianDashboard user={user} />;
    case 'storekeeper':
      return <StoreDashboard user={user} />;
    case 'transport':
      return <TransportDashboard user={user} />;
    case 'canteen':
      return <CanteenDashboard user={user} />;
    default:
      return null;
  }
}
