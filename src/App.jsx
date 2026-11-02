import { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useDB, useSession } from './data/store';
import { useCurrentUser } from './data/selectors';
import { canAccess } from './lib/permissions';
import { Toaster, EmptyState, Card } from './components/ui';
import AppShell from './components/layout/AppShell';
import Login from './modules/auth/Login';
import Dashboard from './modules/dashboard/Dashboard';
import Admissions from './modules/admissions/Admissions';
import Students from './modules/students/Students';
import StudentProfile from './modules/students/StudentProfile';
import Parents from './modules/parents/Parents';
import Staff from './modules/staff/Staff';
import StaffProfile from './modules/staff/StaffProfile';
import Classes from './modules/classes/Classes';
import Timetable from './modules/timetable/Timetable';
import Attendance from './modules/attendance/Attendance';
import Gradebook from './modules/academics/Gradebook';
import ReportCards from './modules/academics/ReportCards';
import LMS from './modules/lms/LMS';
import { MyResults, MyAttendance, MyFees } from './modules/portal/Portal';
import Finance from './modules/finance/Finance';
import Payroll from './modules/finance/Payroll';
import Transport from './modules/transport/Transport';
import LibraryPage from './modules/library/Library';
import Store from './modules/store/Store';
import Canteen from './modules/canteen/Canteen';
import Hostel from './modules/hostel/Hostel';
import Welfare from './modules/welfare/Welfare';
import Communication from './modules/communication/Communication';
import CalendarPage from './modules/calendar/Calendar';
import Reports from './modules/reports/Reports';
import Settings from './modules/settings/Settings';
import ClockIn from './modules/gate/ClockIn';
import Gate from './modules/gate/Gate';
import GateKiosk from './modules/gate/GateKiosk';
import LiveClasses from './modules/live/LiveClasses';
import LiveRoom from './modules/live/LiveRoom';
import { applyTheme, applyBranding } from './lib/theme';
import { setCurrencySymbol } from './lib/format';

function Guard({ k, children }) {
  const user = useCurrentUser();
  const modules = useDB((s) => s.settings.modules);
  if (!canAccess(user.role, k, modules))
    return (
      <Card>
        <EmptyState icon={ShieldAlert} title="No access" text="Your role does not have permission to view this page." />
      </Card>
    );
  return children;
}

export default function App() {
  const dark = useSession((s) => s.dark);
  const user = useCurrentUser();
  const settings = useDB((s) => s.settings);
  setCurrencySymbol(settings.currencySymbol);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);
  useEffect(() => applyTheme(settings.theme), [settings.theme]);
  useEffect(() => applyBranding(settings), [settings.logo, settings.appName, settings.schoolName]); // eslint-disable-line react-hooks/exhaustive-deps
  // Keep tabs on the same device in sync (e.g. the gate kiosk and a phone-view tab).
  useEffect(() => {
    const h = (e) => {
      if (e.key === 'edunexa-db') useDB.persist.rehydrate();
      if (e.key === 'edunexa-session') useSession.persist.rehydrate();
    };
    window.addEventListener('storage', h);
    return () => window.removeEventListener('storage', h);
  }, []);

  return (
    <HashRouter>
      <Toaster />
      {!user ? (
        <Routes>
          <Route path="*" element={<Login />} />
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      )}
    </HashRouter>
  );
}
