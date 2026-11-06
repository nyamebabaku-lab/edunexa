// Who may read and change each data collection, per role, in the live (multi-school) apps.
// One source of truth: the app checks writes with it before saving, and scripts/gen-access-sql.mjs
// turns it into the database's row-level security table (supabase/migrations), so both always agree.
//
// Read/write scopes:
//   all  – every record of the school
//   fam  – the signed-in student's own records, or a parent's children's records
//   cls  – records for the classes of those children (timetable, lessons, live classes)
//   self – the parent's own parent record
//   mine – the person's own messages, clock-ins and leave requests
//   none – no access

/** Every synced collection. Key/value collections (non-arrays) are stored as one record each. */
export const COLLECTIONS = [
  'terms', 'periods', 'subjects', 'classes', 'allocations', 'staff', 'leaves', 'parents', 'students', 'applications',
  'attendance', 'scores', 'feeStructures', 'invoices', 'payments', 'expenses', 'payrollRuns', 'routes', 'buses', 'trips',
  'maintenance', 'books', 'loans', 'storeItems', 'stockMoves', 'suppliers', 'purchaseOrders', 'dorms', 'exeats', 'notices',
  'events', 'messages', 'smsLog', 'healthVisits', 'incidents', 'materials', 'assignments', 'submissions', 'quizzes',
  'quizAttempts', 'canteenItems', 'canteenStock', 'canteenStockMoves', 'canteenSales', 'clockings', 'liveSessions',
  'timetable', 'reportRemarks', 'canteenMenu', 'boardingFee', 'expenseCategories', 'photos', 'houses', 'exams',
];
export const KV_COLLECTIONS = ['timetable', 'reportRemarks', 'canteenMenu', 'boardingFee', 'expenseCategories'];

/** Staff-side roles that join a school (the Owner/Admin is 'admin'). */
export const MEMBER_ROLES = ['headteacher', 'teacher', 'accountant', 'librarian', 'storekeeper', 'transport', 'canteen', 'hostel', 'staff', 'kiosk', 'parent', 'student'];
export const ALL_ROLES = ['admin', ...MEMBER_ROLES];

const SCHOOL_BASICS = ['terms', 'periods', 'subjects', 'classes', 'notices', 'events', 'timetable', 'houses', 'exams'];
const ACADEMIC = ['allocations', 'attendance', 'scores', 'reportRemarks', 'materials', 'assignments', 'submissions', 'quizzes', 'quizAttempts', 'liveSessions'];
const FINANCE = ['feeStructures', 'invoices', 'payments', 'expenses', 'expenseCategories', 'boardingFee'];
const LIBRARY = ['books', 'loans'];
const STORE = ['storeItems', 'stockMoves', 'suppliers', 'purchaseOrders'];
const TRANSPORT = ['routes', 'buses', 'trips', 'maintenance'];
const CANTEEN = ['canteenItems', 'canteenMenu', 'canteenStock', 'canteenStockMoves', 'canteenSales'];
const HOSTEL = ['dorms', 'exeats'];
const WELFARE = ['healthVisits', 'incidents'];
const PEOPLE = ['students', 'staff', 'parents', 'photos'];

const grant = (out, cols, read, write = 'none') => cols.forEach((c) => (out[c] = [read, write]));

function staffBase(extra) {
  const m = {};
  grant(m, SCHOOL_BASICS, 'all');
  grant(m, ['students', 'staff', 'photos', 'classes'], 'all');
  grant(m, ['messages', 'leaves', 'clockings'], 'mine', 'mine');
  grant(m, ['smsLog'], 'none', 'all');
  extra(m);
  return m;
}

/** role → collection → [read scope, write scope] */
export const ACCESS = {
  admin: Object.fromEntries(COLLECTIONS.map((c) => [c, c === 'messages' ? ['mine', 'mine'] : ['all', 'all']])),

  headteacher: staffBase((m) => {
    grant(m, ['students', 'parents', 'applications', 'allocations', 'classes', 'subjects', 'houses', 'exams', 'terms', 'periods', 'timetable', 'notices', 'events'], 'all', 'all');
    grant(m, ACADEMIC, 'all', 'all');
    grant(m, WELFARE, 'all', 'all');
    grant(m, ['photos', 'leaves', 'clockings', 'smsLog', 'exeats'], 'all', 'all');
    grant(m, ['staff', 'dorms'], 'all');
    grant(m, FINANCE, 'all'); // view only
    grant(m, [...LIBRARY, ...STORE, ...TRANSPORT, ...CANTEEN], 'all');
  }),

  teacher: staffBase((m) => {
    grant(m, ['parents', 'subjects', 'allocations'], 'all');
    grant(m, ['attendance', 'scores', 'reportRemarks', 'materials', 'assignments', 'submissions', 'quizzes', 'liveSessions', ...WELFARE], 'all', 'all');
    grant(m, ['quizAttempts'], 'all');
    grant(m, ['notices'], 'all', 'all');
  }),

  accountant: staffBase((m) => {
    grant(m, ['parents', 'canteenSales', 'canteenItems', 'stockMoves', 'storeItems', 'routes', 'dorms', 'payrollRuns'], 'all');
    grant(m, [...FINANCE, 'payrollRuns'], 'all', 'all');
  }),

  librarian: staffBase((m) => grant(m, LIBRARY, 'all', 'all')),

  storekeeper: staffBase((m) => {
    grant(m, STORE, 'all', 'all');
    grant(m, ['invoices'], 'all', 'all'); // items charged to a student's fees account
    grant(m, ['feeStructures'], 'all');
  }),

  transport: staffBase((m) => {
    grant(m, ['parents'], 'all');
    grant(m, TRANSPORT, 'all', 'all');
    grant(m, ['students'], 'all', 'all'); // assigning riders to routes
  }),

  canteen: staffBase((m) => {
    grant(m, CANTEEN, 'all', 'all');
    grant(m, ['invoices'], 'all', 'all'); // meals charged to a student's fees account
  }),

  hostel: staffBase((m) => {
    grant(m, ['parents'], 'all');
    grant(m, HOSTEL, 'all', 'all');
    grant(m, ['students'], 'all', 'all'); // bed allocation
    grant(m, ['boardingFee'], 'all');
  }),

  staff: staffBase(() => {}),

  kiosk: (() => {
    const m = {};
    grant(m, ['students', 'staff', 'photos', 'classes', 'terms', 'parents'], 'all'); // parents: phone for arrival texts
    grant(m, ['clockings'], 'all', 'all');
    grant(m, ['smsLog'], 'none', 'all');
    return m;
  })(),

  parent: family('parent'),
  student: family('student'),
};

function family(role) {
  const m = {};
  grant(m, SCHOOL_BASICS, 'all');
  grant(m, ['feeStructures', 'boardingFee', 'routes', 'buses', 'canteenItems', 'canteenMenu', 'books', 'dorms'], 'all');
  grant(m, ['students', 'photos', 'scores', 'invoices', 'quizAttempts', 'submissions', 'healthVisits', 'incidents', 'exeats', 'loans', 'canteenSales', 'clockings'], 'fam');
  grant(m, ['attendance', 'allocations', 'materials', 'assignments', 'quizzes', 'liveSessions'], 'cls');
  grant(m, ['payments'], 'fam', 'fam'); // MoMo payments from the portal
  grant(m, ['messages'], 'mine', 'mine');
  if (role === 'parent') grant(m, ['parents'], 'self');
  if (role === 'student') {
    grant(m, ['submissions', 'quizAttempts', 'clockings'], 'fam', 'fam');
    grant(m, ['liveSessions'], 'cls', 'cls'); // joining, chat and hand-raising
  }
  return m;
}

export const readScope = (role, col) => ACCESS[role]?.[col]?.[0] || 'none';
export const writeScope = (role, col) => ACCESS[role]?.[col]?.[1] || 'none';
export const canWrite = (role, col) => role === 'superadmin' || writeScope(role, col) !== 'none';

/** Friendly names for "view only" messages. */
export const COLLECTION_LABEL = {
  invoices: 'fees', payments: 'payments', expenses: 'expenses', feeStructures: 'fee structures', payrollRuns: 'payroll',
  houses: 'houses', exams: 'exam timetables', students: 'student records', staff: 'staff records', parents: 'parent records', classes: 'classes', subjects: 'subjects',
  books: 'library', loans: 'library loans', storeItems: 'store', canteenItems: 'canteen', canteenSales: 'canteen sales',
  routes: 'transport', buses: 'transport', dorms: 'hostel', exeats: 'exeats', scores: 'scores', attendance: 'attendance',
};
