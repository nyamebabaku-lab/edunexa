import {
  LayoutDashboard, UserPlus, GraduationCap, Users, BriefcaseBusiness, School, CalendarClock, ClipboardCheck,
  BookOpenCheck, FileBadge, MonitorPlay, Wallet, Banknote, Bus, Library, Package, BedDouble, HeartPulse,
  MessagesSquare, CalendarDays, BarChart3, Settings, Award, Receipt, CalendarCheck, UtensilsCrossed, ScanLine, DoorOpen, Video,
  UserCheck, Building2, QrCode, FileSpreadsheet, NotebookPen } from 'lucide-react';
import { LIVE } from '../config';

export const ROLES = {
  superadmin: { label: 'Super Admin', short: 'Super', color: 'rose', desc: 'Platform owner: branding, modules, sign-in security and every school setting.' },
  admin: { label: LIVE ? 'Owner / Admin' : 'Administrator', short: 'Admin', color: 'brand', desc: 'School owner / proprietor with full access to every module and every account.' },
  headteacher: { label: 'Head Teacher', short: 'Head', color: 'indigo', desc: 'Academic head: students, staff, attendance, results sign-off, timetable and LMS. Fees are view-only.' },
  teacher: { label: 'Teacher', short: 'Teacher', color: 'sky', desc: 'Classes, attendance, gradebook, report cards and LMS.' },
  parent: { label: 'Parent / Guardian', short: 'Parent', color: 'emerald', desc: "Children's results, fees, attendance, bus and messages." },
  student: { label: 'Student', short: 'Student', color: 'violet', desc: 'Timetable, lessons, assignments, quizzes and results.' },
  accountant: { label: 'Accountant', short: 'Accounts', color: 'amber', desc: 'Fees, billing, payments, expenses and payroll.' },
  librarian: { label: 'Librarian', short: 'Library', color: 'teal', desc: 'Catalogue, borrowing, returns and fines.' },
  storekeeper: { label: 'Storekeeper', short: 'Store', color: 'orange', desc: 'Inventory, stock movement, sales and suppliers.' },
  transport: { label: 'Transport Officer', short: 'Transport', color: 'rose', desc: 'Buses, routes, drivers, riders and trips.' },
  staff: { label: 'Support Staff', short: 'Staff', color: 'teal', desc: 'Drivers, security, cleaners and kitchen staff: clock in/out and notices.' },
  canteen: { label: 'Canteen Manager', short: 'Canteen', color: 'emerald', desc: 'Food menu, point of sale, kitchen stock and canteen income.' },
  hostel: { label: 'Hostel / Boarding Manager', short: 'Hostel', color: 'violet', desc: 'Halls, bed allocation, boarders and exeats.' },
  kiosk: { label: 'Gate Kiosk', short: 'Kiosk', color: 'slate', desc: 'A device at the school gate that shows the rotating QR code and scans ID cards.' },
};

const ALL = Object.keys(ROLES);

export const NAV = [
  {
    group: 'Overview',
    items: [
      { key: 'dashboard', label: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ALL },
      { key: 'clock', label: 'Clock in / out', path: '/clock', icon: ScanLine, roles: ['admin', 'headteacher', 'teacher', 'student', 'accountant', 'librarian', 'storekeeper', 'transport', 'canteen', 'hostel', 'staff'], module: 'gate' },
      { key: 'gate', label: 'Gate Attendance', path: '/gate', icon: DoorOpen, roles: ['admin', 'headteacher'], module: 'gate' },
      { key: 'kiosk', label: 'Gate kiosk screen', path: '/gate/kiosk', icon: QrCode, roles: ['admin', 'kiosk'], module: 'gate', hidden: true },
    ],
  },
  {
    group: 'People',
    items: [
      { key: 'admissions', label: 'Admissions', path: '/admissions', icon: UserPlus, roles: ['admin', 'headteacher'], module: 'admissions' },
      { key: 'students', label: 'Students', path: '/students', icon: GraduationCap, roles: ['admin', 'headteacher', 'teacher'] },
      { key: 'parents', label: 'Parents', path: '/parents', icon: Users, roles: ['admin', 'headteacher'] },
      { key: 'staff', label: 'Staff & HR', path: '/staff', icon: BriefcaseBusiness, roles: ['admin', 'headteacher'] },
    ],
  },
  {
    group: 'Academics',
    items: [
      { key: 'classes', label: 'Classes & Subjects', path: '/classes', icon: School, roles: ['admin', 'headteacher', 'teacher'] },
      { key: 'timetable', label: 'Timetable', path: '/timetable', icon: CalendarClock, roles: ['admin', 'headteacher', 'teacher', 'student', 'parent'] },
      { key: 'exams', label: 'Exam Timetable', path: '/exams', icon: NotebookPen, roles: ['admin', 'headteacher', 'teacher', 'student', 'parent'] },
      { key: 'attendance', label: 'Attendance', path: '/attendance', icon: ClipboardCheck, roles: ['admin', 'headteacher', 'teacher'] },
      { key: 'gradebook', label: 'Gradebook', path: '/gradebook', icon: BookOpenCheck, roles: ['admin', 'headteacher', 'teacher'] },
      { key: 'reportcards', label: 'Report Cards', path: '/report-cards', icon: FileBadge, roles: ['admin', 'headteacher', 'teacher'] },
      { key: 'lms', label: 'Learning (LMS)', path: '/lms', icon: MonitorPlay, roles: ['admin', 'headteacher', 'teacher', 'student', 'parent'], module: 'lms' },
      { key: 'live', label: 'Live Classes', path: '/live', icon: Video, roles: ['admin', 'headteacher', 'teacher', 'student', 'parent'], module: 'live' },
      { key: 'myresults', label: 'Results', path: '/my/results', icon: Award, roles: ['parent', 'student'] },
      { key: 'myattendance', label: 'Attendance', path: '/my/attendance', icon: CalendarCheck, roles: ['parent', 'student'] },
    ],
  },
  {
    group: 'Finance',
    items: [
      { key: 'finance', label: 'Fees & Finance', path: '/finance', icon: Wallet, roles: ['admin', 'accountant', 'headteacher'] },
      { key: 'payroll', label: 'Payroll', path: '/payroll', icon: Banknote, roles: ['admin', 'accountant'], module: 'payroll' },
      { key: 'myfees', label: 'Fees & Payments', path: '/my/fees', icon: Receipt, roles: ['parent', 'student'] },
    ],
  },
  {
    group: 'Operations',
    items: [
      { key: 'transport', label: 'Transport', path: '/transport', icon: Bus, roles: ['admin', 'headteacher', 'transport', 'parent'], module: 'transport' },
      { key: 'library', label: 'Library', path: '/library', icon: Library, roles: ['admin', 'headteacher', 'librarian', 'student'], module: 'library' },
      { key: 'store', label: 'Store & Inventory', path: '/store', icon: Package, roles: ['admin', 'headteacher', 'storekeeper'], module: 'store' },
      { key: 'canteen', label: 'Canteen', path: '/canteen', icon: UtensilsCrossed, roles: ['admin', 'headteacher', 'canteen', 'accountant', 'parent', 'student'], module: 'canteen' },
      { key: 'hostel', label: 'Hostel & Boarding', path: '/hostel', icon: BedDouble, roles: ['admin', 'hostel', 'headteacher'], module: 'hostel' },
      { key: 'welfare', label: 'Health & Discipline', path: '/welfare', icon: HeartPulse, roles: ['admin', 'headteacher', 'teacher'], module: 'welfare' },
    ],
  },
  {
    group: 'Engage',
    items: [
      { key: 'communication', label: 'Communication', path: '/communication', icon: MessagesSquare, roles: ALL.filter((r) => r !== 'kiosk') },
      { key: 'calendar', label: 'Calendar', path: '/calendar', icon: CalendarDays, roles: ALL.filter((r) => r !== 'kiosk') },
    ],
  },
  {
    group: 'Platform',
    items: [
      { key: 'schools', label: 'Schools', path: '/schools', icon: Building2, roles: ['superadmin'], live: true },
      { key: 'accounts', label: 'Accounts', path: '/accounts', icon: UserCheck, roles: ['admin', 'superadmin'], live: true },
    ],
  },
  {
    group: 'System',
    items: [
      { key: 'reports', label: 'Reports', path: '/reports', icon: BarChart3, roles: ['admin', 'headteacher', 'accountant', 'canteen'] },
      { key: 'import', label: 'Import from Excel', path: '/import', icon: FileSpreadsheet, roles: ['admin'] },
      { key: 'settings', label: 'Settings', path: '/settings', icon: Settings, roles: ['admin', 'superadmin'] },
    ],
  },
];

// Demo: the Super Admin can open everything an administrator can (but has no personal clock-in).
// Live: the Super Admin runs the platform (schools and accounts) and never sees inside a school's records.
const allows = (item, role) => {
  if (item.live && !LIVE) return false;
  if (LIVE && role === 'superadmin') return item.live || item.key === 'dashboard';
  return item.roles.includes(role) || (role === 'superadmin' && item.roles.includes('admin') && item.key !== 'clock');
};
const enabled = (item, modules) => !item.module || !modules || modules[item.module] !== false;

export const navFor = (role, modules) =>
  NAV.map((g) => ({ ...g, items: g.items.filter((i) => !i.hidden && allows(i, role) && enabled(i, modules)) })).filter((g) => g.items.length);

export const canAccess = (role, key, modules) => NAV.some((g) => g.items.some((i) => i.key === key && allows(i, role) && enabled(i, modules)));

/** Modules a school can switch off, with the nav keys each one hides. */
export const TOGGLEABLE_MODULES = [
  { id: 'admissions', label: 'Admissions', desc: 'Applicant pipeline and admission letters' },
  { id: 'lms', label: 'Learning (LMS)', desc: 'Lesson materials, assignments and quizzes' },
  { id: 'payroll', label: 'Payroll', desc: 'Monthly salaries, SSNIT and PAYE' },
  { id: 'gate', label: 'Gate attendance', desc: 'QR clock-in/out for students and staff' },
  { id: 'live', label: 'Live classes', desc: 'Video lessons with camera, microphone, screen sharing and chat' },
  { id: 'transport', label: 'Transport', desc: 'Buses, routes, riders and trips' },
  { id: 'library', label: 'Library', desc: 'Catalogue, loans and fines' },
  { id: 'store', label: 'Store & inventory', desc: 'Uniforms, books and supplies' },
  { id: 'canteen', label: 'Canteen', desc: 'Menu, point of sale, kitchen stock and income' },
  { id: 'hostel', label: 'Hostel & boarding', desc: 'Halls, beds and exeats' },
  { id: 'welfare', label: 'Health & discipline', desc: 'Infirmary and conduct records' },
];

/** Bottom tab bar on phones: first 4 most-used destinations per role. */
export const MOBILE_TABS = {
  admin: LIVE ? ['dashboard', 'students', 'accounts', 'finance'] : ['dashboard', 'students', 'finance', 'communication'],
  teacher: ['dashboard', 'clock', 'live', 'attendance'],
  parent: ['dashboard', 'myresults', 'myfees', 'communication'],
  student: ['dashboard', 'live', 'clock', 'lms'],
  accountant: ['dashboard', 'finance', 'payroll', 'reports'],
  librarian: ['dashboard', 'library', 'communication', 'calendar'],
  storekeeper: ['dashboard', 'store', 'communication', 'calendar'],
  transport: ['dashboard', 'transport', 'communication', 'calendar'],
  canteen: ['dashboard', 'canteen', 'reports', 'communication'],
  superadmin: LIVE ? ['dashboard', 'schools', 'accounts'] : ['dashboard', 'settings', 'students', 'finance'],
  headteacher: ['dashboard', 'students', 'attendance', 'reportcards'],
  hostel: ['dashboard', 'hostel', 'communication', 'calendar'],
  kiosk: ['dashboard'],
  staff: ['dashboard', 'clock', 'communication', 'calendar'],
};

export const navItem = (key) => NAV.flatMap((g) => g.items).find((i) => i.key === key);
