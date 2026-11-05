import { useEffect, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useDB, useSession } from './data/store';
import { useCurrentUser, usePortalStudent } from './data/selectors';
import { canAccess } from './lib/permissions';
import { Toaster, EmptyState, Card } from './components/ui';
import { Loader2 } from 'lucide-react';
import AppShell from './components/layout/AppShell';
import Login from './modules/auth/Login';
import LiveAuth from './modules/auth/LiveAuth';
import { LIVE, storeKey } from './config';
import { useLive } from './data/sync';
import { applyTheme, applyBranding } from './lib/theme';
import { setCurrencySymbol } from './lib/format';
import { rememberSchool } from './lib/front';

// Pages load on demand so the first visit is light on slow connections; the service worker caches them all for offline use.
const Dashboard = lazy(() => import('./modules/dashboard/Dashboard'));
const Admissions = lazy(() => import('./modules/admissions/Admissions'));
const Students = lazy(() => import('./modules/students/Students'));
const StudentProfile = lazy(() => import('./modules/students/StudentProfile'));
const Parents = lazy(() => import('./modules/parents/Parents'));
const Staff = lazy(() => import('./modules/staff/Staff'));
const StaffProfile = lazy(() => import('./modules/staff/StaffProfile'));
const Classes = lazy(() => import('./modules/classes/Classes'));
const Timetable = lazy(() => import('./modules/timetable/Timetable'));
const Attendance = lazy(() => import('./modules/attendance/Attendance'));
const Gradebook = lazy(() => import('./modules/academics/Gradebook'));
const ReportCards = lazy(() => import('./modules/academics/ReportCards'));
const LMS = lazy(() => import('./modules/lms/LMS'));
const MyResults = lazy(() => import('./modules/portal/Portal').then((m) => ({ default: m.MyResults })));
const MyAttendance = lazy(() => import('./modules/portal/Portal').then((m) => ({ default: m.MyAttendance })));
const MyFees = lazy(() => import('./modules/portal/Portal').then((m) => ({ default: m.MyFees })));
const Finance = lazy(() => import('./modules/finance/Finance'));
const Payroll = lazy(() => import('./modules/finance/Payroll'));
const Transport = lazy(() => import('./modules/transport/Transport'));
const LibraryPage = lazy(() => import('./modules/library/Library'));
const Store = lazy(() => import('./modules/store/Store'));
const Canteen = lazy(() => import('./modules/canteen/Canteen'));
const Hostel = lazy(() => import('./modules/hostel/Hostel'));
const Welfare = lazy(() => import('./modules/welfare/Welfare'));
const Communication = lazy(() => import('./modules/communication/Communication'));
const CalendarPage = lazy(() => import('./modules/calendar/Calendar'));
const Reports = lazy(() => import('./modules/reports/Reports'));
const Settings = lazy(() => import('./modules/settings/Settings'));
const ClockIn = lazy(() => import('./modules/gate/ClockIn'));
const Gate = lazy(() => import('./modules/gate/Gate'));
const GateKiosk = lazy(() => import('./modules/gate/GateKiosk'));
const LiveClasses = lazy(() => import('./modules/live/LiveClasses'));
const LiveRoom = lazy(() => import('./modules/live/LiveRoom'));
const Accounts = lazy(() => import('./modules/accounts/Accounts'));
const Schools = lazy(() => import('./modules/accounts/Schools'));
const Import = lazy(() => import('./modules/import/Import'));
const Notifications = lazy(() => import('./modules/notifications/Notifications'));

function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="h-7 w-7 animate-spin text-brand-600" />
    </div>
  );
}

function Guard({ k, children }) {
  const user = useCurrentUser();
  const modules = useDB((s) => s.settings.modules);
  const { student } = usePortalStudent();
  if (!canAccess(user.role, k, modules))
    return (
      <Card>
        <EmptyState icon={ShieldAlert} title="No access" text="Your role does not have permission to view this page." />
      </Card>
    );
  // Parents and students see their pages once the school has linked their record.
  if (['parent', 'student'].includes(user.role) && !student && !['communication', 'calendar'].includes(k))
    return (
      <Card>
        <EmptyState icon={ShieldAlert} title={user.role === 'parent' ? 'No child linked yet' : 'Your record is not linked yet'} text="This page fills in once the school links your account to the student record. Ask the school office to check the admission number." />
      </Card>
    );
  return children;
}

export default function App() {
  const dark = useSession((s) => s.dark);
  const user = useCurrentUser();
  const phase = useLive((s) => s.phase);
  const settings = useDB((s) => s.settings);
  setCurrencySymbol(settings.currencySymbol);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);
  useEffect(() => applyTheme(settings.theme), [settings.theme]);
  useEffect(() => applyBranding(settings), [settings.logo, settings.appName, settings.schoolName]); // eslint-disable-line react-hooks/exhaustive-deps
  // Remember this school's name, logo and picture so the sign-in page shows them next time on this device.
  useEffect(() => {
    if (LIVE && phase === 'ready' && user && user.role !== 'superadmin') rememberSchool(settings);
  }, [phase, user?.role, settings.schoolName, settings.logo, settings.frontImage, settings.motto]); // eslint-disable-line react-hooks/exhaustive-deps
  // Keep tabs on the same device in sync (e.g. the gate kiosk and a phone-view tab).
  useEffect(() => {
    const h = (e) => {
      if (e.key === storeKey('edunexa-db')) useDB.persist.rehydrate();
      if (e.key === storeKey('edunexa-session')) useSession.persist.rehydrate();
    };
    window.addEventListener('storage', h);
    return () => window.removeEventListener('storage', h);
  }, []);

  return (
    <HashRouter>
      <Toaster />
      <Suspense fallback={<PageLoader />}>
      {LIVE && (phase !== 'ready' || !user) ? (
        <LiveAuth />
      ) : !user ? (
        <Routes>
          <Route path="*" element={<Login />} />
        </Routes>
      ) : user.role === 'kiosk' ? (
        // A gate kiosk account only ever shows the kiosk screen.
        <Routes>
          <Route path="*" element={<GateKiosk />} />
        </Routes>
      ) : (
        <Routes>
          <Route path="gate/kiosk" element={<Guard k="gate"><GateKiosk /></Guard>} />
          <Route path="live/room/:code" element={<Guard k="live"><LiveRoom /></Guard>} />
          <Route element={<AppShell />}>
            <Route index element={<Dashboard />} />
            <Route path="clock" element={<Guard k="clock"><ClockIn /></Guard>} />
            <Route path="gate" element={<Guard k="gate"><Gate /></Guard>} />
            <Route path="live" element={<Guard k="live"><LiveClasses /></Guard>} />
            <Route path="admissions" element={<Guard k="admissions"><Admissions /></Guard>} />
            <Route path="students" element={<Guard k="students"><Students /></Guard>} />
            <Route path="students/:id" element={<Guard k="students"><StudentProfile /></Guard>} />
            <Route path="parents" element={<Guard k="parents"><Parents /></Guard>} />
            <Route path="staff" element={<Guard k="staff"><Staff /></Guard>} />
            <Route path="staff/:id" element={<Guard k="staff"><StaffProfile /></Guard>} />
            <Route path="classes" element={<Guard k="classes"><Classes /></Guard>} />
            <Route path="timetable" element={<Guard k="timetable"><Timetable /></Guard>} />
            <Route path="attendance" element={<Guard k="attendance"><Attendance /></Guard>} />
            <Route path="gradebook" element={<Guard k="gradebook"><Gradebook /></Guard>} />
            <Route path="report-cards" element={<Guard k="reportcards"><ReportCards /></Guard>} />
            <Route path="lms" element={<Guard k="lms"><LMS /></Guard>} />
            <Route path="my/results" element={<Guard k="myresults"><MyResults /></Guard>} />
            <Route path="my/attendance" element={<Guard k="myattendance"><MyAttendance /></Guard>} />
            <Route path="my/fees" element={<Guard k="myfees"><MyFees /></Guard>} />
            <Route path="finance" element={<Guard k="finance"><Finance /></Guard>} />
            <Route path="payroll" element={<Guard k="payroll"><Payroll /></Guard>} />
            <Route path="transport" element={<Guard k="transport"><Transport /></Guard>} />
            <Route path="library" element={<Guard k="library"><LibraryPage /></Guard>} />
            <Route path="store" element={<Guard k="store"><Store /></Guard>} />
            <Route path="canteen" element={<Guard k="canteen"><Canteen /></Guard>} />
            <Route path="hostel" element={<Guard k="hostel"><Hostel /></Guard>} />
            <Route path="welfare" element={<Guard k="welfare"><Welfare /></Guard>} />
            <Route path="communication" element={<Communication />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="reports" element={<Guard k="reports"><Reports /></Guard>} />
            <Route path="settings" element={<Guard k="settings"><Settings /></Guard>} />
            <Route path="import" element={<Guard k="import"><Import /></Guard>} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="accounts" element={<Guard k="accounts"><Accounts /></Guard>} />
            <Route path="schools" element={<Guard k="schools"><Schools /></Guard>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      )}
      </Suspense>
    </HashRouter>
  );
}
