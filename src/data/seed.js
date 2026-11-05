// Deterministic demo data for a Ghanaian school (Creche → Diploma).
import { addDays, format, subDays, isWeekend } from 'date-fns';
import { LIVE } from '../config';
import { payslip } from '../lib/payroll';
import { buildCanteen } from './canteenSeed';
import { buildClockings } from './clockSeed';

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The demo is frozen on one school day; the live apps use the real date.
const localYmd = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
export const TODAY = LIVE ? localYmd(new Date()) : '2026-11-02';
const d = (s) => new Date(`${s}T00:00:00`);
const ymd = (dt) => format(dt, 'yyyy-MM-dd');
const pad = (n, w = 3) => String(n).padStart(w, '0');

export const SECTIONS = ['Early Years', 'Primary', 'JHS', 'SHS', 'Diploma'];

export const DEFAULT_SETTINGS_EXT = {
  appName: 'EduNexa',
  logo: null,
  theme: { preset: 'royal', brand: '#2556eb', accent: '#e11d48' },
  country: 'Ghana',
  currencyCode: 'GHS',
  currencySymbol: 'GH₵',
  modules: { admissions: true, lms: true, payroll: true, transport: true, library: true, store: true, canteen: true, hostel: true, welfare: true, gate: true, live: true },
  auth: {
    mode: 'demo',
    otp: 'admins',
    otpChannel: 'SMS',
    allowParentSignup: true,
    signupApproval: true,
    allowStudentLogin: true,
    minPasswordLength: 8,
    requireNumber: true,
    maxAttempts: 5,
    lockMinutes: 5,
    sessionTimeout: 60,
  },
  gate: { name: 'Main Gate', startTime: '07:30', closeTime: '15:00', rotateSeconds: 30, notifyParents: true, autoRegister: true, secret: 'bfis-gate-7f3k' },
  live: { provider: 'p2p', maxParticipants: 8, studentsStartMuted: true, studentsCanUnmute: true, studentsCanUseCamera: true, jitsiDomain: 'meet.jit.si', jaasAppId: '', turnUrl: '', turnUser: '', turnPass: '' },
};

const MALE = ['Kwame', 'Kofi', 'Kwabena', 'Kwaku', 'Yaw', 'Kwesi', 'Kojo', 'Nana', 'Emmanuel', 'Samuel', 'Daniel', 'Isaac', 'Michael', 'Prince', 'Bernard', 'Ebenezer', 'Richard', 'Joseph', 'Elikem', 'Selorm', 'Nii', 'Fiifi', 'Mawuli', 'Ato', 'Kelvin', 'Jeffrey', 'Godwin', 'Desmond'];
const FEMALE = ['Ama', 'Akua', 'Abena', 'Adwoa', 'Afua', 'Yaa', 'Efua', 'Esi', 'Akosua', 'Adjoa', 'Naa', 'Mavis', 'Gifty', 'Priscilla', 'Abigail', 'Comfort', 'Esther', 'Dzifa', 'Selasi', 'Elorm', 'Nhyira', 'Maame', 'Ewurabena', 'Josephine', 'Linda', 'Vida', 'Belinda', 'Rita'];
const SURNAMES = ['Mensah', 'Asante', 'Owusu', 'Boateng', 'Osei', 'Agyeman', 'Amoah', 'Appiah', 'Darko', 'Ofori', 'Addo', 'Quaye', 'Tetteh', 'Lartey', 'Annan', 'Acheampong', 'Antwi', 'Sarpong', 'Gyamfi', 'Frimpong', 'Nkansah', 'Badu', 'Adjei', 'Kumi', 'Amponsah', 'Agbeko', 'Kpodo', 'Dogbe', 'Ankrah', 'Bonsu', 'Ocran', 'Essien', 'Arthur', 'Danso', 'Yeboah', 'Fosu'];
const AREAS = ['East Legon', 'Spintex', 'Madina', 'Adenta', 'Tema Comm. 25', 'Dansoman', 'Achimota', 'Dome', 'Kasoa', 'Airport Residential', 'Haatso', 'Lashibi', 'Teshie', 'Kaneshie'];
const OCCUPATIONS = ['Banker', 'Trader', 'Nurse', 'Engineer', 'Civil Servant', 'Lawyer', 'Teacher', 'Pharmacist', 'Entrepreneur', 'Accountant', 'Doctor', 'IT Consultant', 'Fashion Designer', 'Pastor', 'Police Officer'];

export function buildSeed() {
  const r = rng(20261102);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const int = (a, b) => Math.floor(r() * (b - a + 1)) + a;
  const phone = () => `0${pick(['24', '54', '55', '20', '50', '27', '26', '59'])}${int(1000000, 9999999)}`;

  // ---------- Settings & terms ----------
  const terms = [
    { id: '2025/2026-T3', name: 'Term 3, 2025/2026', start: '2026-04-28', end: '2026-07-24' },
    { id: '2026/2027-T1', name: 'Term 1, 2026/2027', start: '2026-09-08', end: '2026-12-11' },
    { id: '2026/2027-T2', name: 'Term 2, 2026/2027', start: '2027-01-12', end: '2027-04-02' },
    { id: '2026/2027-T3', name: 'Term 3, 2026/2027', start: '2027-04-27', end: '2027-07-23' },
  ];
  const settings = {
    schoolName: 'Bright Future International School',
    motto: 'Knowledge • Character • Service',
    address: 'No. 14 Boundary Road, East Legon, Accra',
    phone: '030 254 7788',
    email: 'info@brightfuture.edu.gh',
    website: 'www.brightfuture.edu.gh',
    academicYear: '2026/2027',
    currentTerm: '2026/2027-T1',
    currency: 'GHS',
    headName: 'Dr. Mrs. Comfort Owusu-Ansah',
    libraryFinePerDay: 1,
    loanDays: 14,
    ...structuredClone(DEFAULT_SETTINGS_EXT),
  };

  // ---------- Subjects ----------
  const subjectDefs = {
    'Early Years': ['Literacy', 'Numeracy', 'Phonics', 'Creative Arts', 'Our World Our People'],
    Primary: ['English Language', 'Mathematics', 'Science', 'Our World Our People', 'Ghanaian Language (Twi)', 'Creative Arts', 'Religious & Moral Education', 'Computing', 'French'],
    JHS: ['English Language', 'Mathematics', 'Integrated Science', 'Social Studies', 'Career Technology', 'Computing', 'Religious & Moral Education', 'Ghanaian Language (Twi)', 'French', 'Creative Arts & Design'],
    SHS: ['Core English', 'Core Mathematics', 'Integrated Science', 'Social Studies', 'Physics', 'Chemistry', 'Biology', 'Elective Mathematics', 'Literature in English', 'History', 'Government', 'Economics', 'Financial Accounting', 'Business Management', 'Cost Accounting'],
    Diploma: ['Principles of Management', 'Financial Accounting I', 'Business Communication', 'Marketing', 'Business Law', 'Programming Fundamentals', 'Database Systems', 'Computer Networking', 'Web Development', 'Computer Architecture'],
  };
  const subjects = [];
  SECTIONS.forEach((sec) =>
    subjectDefs[sec].forEach((name, i) =>
      subjects.push({
        id: `sub_${sec.slice(0, 2).toLowerCase()}${pad(i + 1, 2)}`,
        name,
        code: `${sec.slice(0, 2).toUpperCase()}${pad(i + 1, 2)}`,
        section: sec,
        credits: sec === 'Diploma' ? (i % 3 === 0 ? 4 : 3) : null,
      }),
    ),
  );
  const subBy = (sec, name) => subjects.find((s) => s.section === sec && s.name === name).id;
  const secSubs = (sec) => subjects.filter((s) => s.section === sec).map((s) => s.id);
  const shsCore = ['Core English', 'Core Mathematics', 'Integrated Science', 'Social Studies'];
  const shsProg = {
    'General Science': ['Physics', 'Chemistry', 'Biology', 'Elective Mathematics'],
    'General Arts': ['Literature in English', 'History', 'Government', 'Economics'],
    Business: ['Financial Accounting', 'Business Management', 'Cost Accounting', 'Economics'],
  };
  const dipProg = {
    'Business Administration': ['Principles of Management', 'Financial Accounting I', 'Business Communication', 'Marketing', 'Business Law'],
    'Information Technology': ['Programming Fundamentals', 'Database Systems', 'Computer Networking', 'Web Development', 'Computer Architecture'],
  };

  // ---------- Classes ----------
  const classDefs = [
    ['Creche', 'Early Years'], ['Nursery 1', 'Early Years'], ['Nursery 2', 'Early Years'], ['KG 1', 'Early Years'], ['KG 2', 'Early Years'],
    ['Basic 1', 'Primary'], ['Basic 2', 'Primary'], ['Basic 3', 'Primary'], ['Basic 4', 'Primary'], ['Basic 5', 'Primary'], ['Basic 6', 'Primary'],
    ['JHS 1', 'JHS'], ['JHS 2', 'JHS'], ['JHS 3', 'JHS'],
    ['SHS 1 Science', 'SHS', 'General Science'], ['SHS 1 Arts', 'SHS', 'General Arts'], ['SHS 1 Business', 'SHS', 'Business'],
    ['SHS 2 Science', 'SHS', 'General Science'], ['SHS 2 Arts', 'SHS', 'General Arts'],
    ['SHS 3 Science', 'SHS', 'General Science'], ['SHS 3 Business', 'SHS', 'Business'],
    ['Dip. Business Admin Y1', 'Diploma', 'Business Administration'], ['Dip. IT Y1', 'Diploma', 'Information Technology'], ['Dip. IT Y2', 'Diploma', 'Information Technology'],
  ];
  const classes = classDefs.map(([name, section, programme], i) => {
    let subjectIds = secSubs(section);
    if (section === 'SHS') subjectIds = [...shsCore, ...shsProg[programme]].map((n) => subBy('SHS', n));
    if (section === 'Diploma') subjectIds = dipProg[programme].map((n) => subBy('Diploma', n));
    return {
      id: `cls_${pad(i + 1, 2)}`,
      name,
      section,
      programme: programme || '',
      capacity: section === 'Early Years' ? 20 : 35,
      room: `${section === 'SHS' ? 'Block C' : section === 'Diploma' ? 'Annex' : section === 'JHS' ? 'Block B' : 'Block A'}-${pad(i + 1, 2)}`,
      classTeacherId: null,
      subjectIds,
      order: i,
    };
  });

  // ---------- Staff ----------
  const staff = [];
  const addStaff = (o) => {
    const female = o.gender ? o.gender === 'Female' : r() < 0.5;
    const first = o.first || pick(female ? FEMALE : MALE);
    const last = o.last || pick(SURNAMES);
    const s = {
      id: `stf_${pad(staff.length + 1)}`,
      staffNo: `BFIS/ST/${pad(staff.length + 1)}`,
      title: o.title || (female ? pick(['Mrs.', 'Ms.']) : 'Mr.'),
      firstName: first,
      lastName: last,
      gender: female ? 'Female' : 'Male',
      role: o.role,
      department: o.department,
      phone: phone(),
      email: `${first}.${last}@brightfuture.edu.gh`.toLowerCase(),
      qualification: o.qualification || pick(['B.Ed', 'BSc', 'BA', 'MPhil', 'Diploma', 'HND']),
      salary: o.salary || int(3200, 6200),
      allowances: o.allowances ?? int(300, 900),
      dateJoined: ymd(subDays(d(TODAY), int(200, 3600))),
      status: 'Active',
      ssnitNo: `C0${int(10000000, 99999999)}`,
      bank: pick(['GCB Bank', 'Ecobank', 'Fidelity Bank', 'CalBank', 'Stanbic', 'Absa Ghana']),
      accountNo: `${int(1000000000, 9999999999)}`,
    };
    staff.push(s);
    return s;
  };
  addStaff({ role: 'Administrator', department: 'Administration', first: 'Comfort', last: 'Owusu-Ansah', title: 'Dr. Mrs.', gender: 'Female', qualification: 'PhD', salary: 14500, allowances: 3000 });
  const demoTeacher = addStaff({ role: 'Teacher', department: 'JHS', first: 'Kwame', last: 'Asante', gender: 'Male', qualification: 'MPhil', salary: 6400, allowances: 900 });
  const accountant = addStaff({ role: 'Accountant', department: 'Finance', first: 'Abena', last: 'Darko', gender: 'Female', qualification: 'ICAG', salary: 7200, allowances: 800 });
  const librarian = addStaff({ role: 'Librarian', department: 'Library', first: 'Esi', last: 'Ankrah', gender: 'Female', salary: 4100 });
  const storekeeper = addStaff({ role: 'Storekeeper', department: 'Stores', first: 'Yaw', last: 'Badu', gender: 'Male', salary: 3600 });
  const transportOfficer = addStaff({ role: 'Transport Officer', department: 'Transport', first: 'Kojo', last: 'Ocran', gender: 'Male', salary: 3900 });
  addStaff({ role: 'Nurse', department: 'Health', first: 'Gifty', last: 'Nkansah', gender: 'Female', qualification: 'RGN' });
  const teacherDepts = { 'Early Years': 4, Primary: 6, JHS: 4, SHS: 7, Diploma: 4 };
  Object.entries(teacherDepts).forEach(([dep, n]) => {
    for (let i = 0; i < n; i++) addStaff({ role: 'Teacher', department: dep, gender: dep === 'Early Years' ? 'Female' : undefined });
  });
  ['Driver', 'Driver', 'Driver', 'Driver', 'Driver', 'Security', 'Cleaner', 'Cook', 'Matron'].forEach((role) =>
    addStaff({ role, department: role === 'Driver' ? 'Transport' : 'Support', qualification: role === 'Driver' ? 'Licence C' : 'WASSCE', salary: int(1800, 2600), allowances: int(150, 300) }),
  );
  const teachers = staff.filter((s) => s.role === 'Teacher');
  const teachersIn = (sec) => teachers.filter((t) => t.department === sec);

  // Class teachers & subject allocations
  classes.forEach((c, i) => {
    const pool = teachersIn(c.section);
    c.classTeacherId = c.name === 'JHS 2' ? demoTeacher.id : pool[i % pool.length].id;
  });
  const allocations = [];
  classes.forEach((c) => {
    const pool = teachersIn(c.section);
    c.subjectIds.forEach((sid, i) => {
      let teacherId = pool[(i + c.order) % pool.length].id;
      if (c.section === 'JHS' && subjects.find((s) => s.id === sid).name === 'Mathematics') teacherId = demoTeacher.id;
      if (c.section === 'Early Years') teacherId = c.classTeacherId;
      allocations.push({ id: `alc_${c.id}_${sid}`, classId: c.id, subjectId: sid, teacherId });
    });
  });

  // ---------- Parents & Students ----------
  const parents = [];
  const students = [];
  const houses = ['Aggrey', 'Nkrumah', 'Guggisberg', 'Yaa Asantewaa'];
  const ageBySection = { 'Early Years': [2, 5], Primary: [6, 11], JHS: [12, 14], SHS: [15, 18], Diploma: [18, 23] };
  const newParent = (lastName, opts = {}) => {
    const female = opts.gender ? opts.gender === 'Female' : r() < 0.55;
    const p = {
      id: `par_${pad(parents.length + 1)}`,
      title: female ? 'Mrs.' : 'Mr.',
      firstName: opts.first || pick(female ? FEMALE : MALE),
      lastName,
      gender: female ? 'Female' : 'Male',
      relation: female ? 'Mother' : 'Father',
      phone: phone(),
      altPhone: r() < 0.5 ? phone() : '',
      email: '',
      occupation: pick(OCCUPATIONS),
      address: `${pick(AREAS)}, Accra`,
    };
    p.email = `${p.firstName}.${p.lastName}${int(1, 99)}@gmail.com`.toLowerCase();
    parents.push(p);
    return p;
  };

  // Demo family: Mrs. Akosua Mensah with children in Basic 4 and JHS 2.
  const demoParent = newParent('Mensah', { first: 'Akosua', gender: 'Female' });
  const family = [
    { first: 'Kofi', gender: 'Male', cls: 'JHS 2' },
    { first: 'Ama', gender: 'Female', cls: 'Basic 4' },
  ];

  let admSeq = 1;
  const newStudent = (c, o = {}) => {
    const female = o.gender ? o.gender === 'Female' : r() < 0.5;
    const [amin, amax] = ageBySection[c.section];
    const yearsOld = amin + ((c.order * 0.7 + r() * 2) % (amax - amin + 1));
    const parent = o.parent || newParent(o.lastName || pick(SURNAMES));
    const boarding = ['SHS', 'Diploma'].includes(c.section) && r() < 0.45 ? 'Boarder' : 'Day';
    const s = {
      id: `stu_${pad(students.length + 1)}`,
      admissionNo: `BFIS/${pick(['22', '23', '24', '25', '26'])}/${pad(admSeq++, 4)}`,
      firstName: o.first || pick(female ? FEMALE : MALE),
      otherNames: r() < 0.3 ? pick(female ? FEMALE : MALE) : '',
      lastName: parent.lastName,
      gender: female ? 'Female' : 'Male',
      dob: ymd(subDays(d(TODAY), Math.floor(yearsOld * 365 + int(0, 300)))),
      classId: c.id,
      parentId: parent.id,
      house: ['JHS', 'SHS', 'Diploma'].includes(c.section) ? pick(houses) : '',
      boarding,
      dormId: null,
      busRouteId: null,
      status: 'Active',
      admissionDate: ymd(subDays(d(TODAY), int(60, 1400))),
      address: parent.address,
      bloodGroup: pick(['O+', 'O+', 'A+', 'B+', 'AB+', 'O-']),
      allergies: r() < 0.12 ? pick(['Peanuts', 'Penicillin', 'Seafood', 'Dust', 'Lactose']) : '',
      medicalNotes: r() < 0.06 ? pick(['Asthmatic – keeps inhaler', 'Sickle cell (AS)', 'Wears glasses']) : '',
      nationality: 'Ghanaian',
      religion: pick(['Christian', 'Christian', 'Christian', 'Muslim']),
      previousSchool: '',
    };
    students.push(s);
    return s;
  };

  classes.forEach((c) => {
    const n = c.section === 'Early Years' ? int(6, 8) : c.section === 'Diploma' ? int(8, 10) : int(8, 11);
    family.filter((f) => f.cls === c.name).forEach((f) => newStudent(c, { ...f, parent: demoParent }));
    for (let i = 0; i < n; i++) {
      // ~12% siblings share an existing parent
      const sibling = parents.length > 10 && r() < 0.12 ? parents[int(1, parents.length - 1)] : null;
      newStudent(c, { parent: sibling || undefined });
    }
  });
  const demoStudent = students.find((s) => s.parentId === demoParent.id && s.firstName === 'Kofi');

  // ---------- Hostel ----------
  const dorms = [
    { id: 'dor_01', name: 'Aggrey Hall', house: 'Aggrey', gender: 'Male', capacity: 24, masterId: teachersIn('SHS')[0].id },
    { id: 'dor_02', name: 'Guggisberg Hall', house: 'Guggisberg', gender: 'Male', capacity: 24, masterId: teachersIn('SHS')[1].id },
    { id: 'dor_03', name: 'Yaa Asantewaa Hall', house: 'Yaa Asantewaa', gender: 'Female', capacity: 24, masterId: teachersIn('SHS')[2].id },
    { id: 'dor_04', name: 'Nkrumah Hall', house: 'Nkrumah', gender: 'Female', capacity: 24, masterId: teachersIn('SHS')[3].id },
  ];
  students
    .filter((s) => s.boarding === 'Boarder')
    .forEach((s, i) => {
      const options = dorms.filter((dm) => dm.gender === s.gender);
      const dm = options[i % options.length];
      s.dormId = dm.id;
      s.house = dm.house;
      s.bed = `${dm.name.split(' ')[0].slice(0, 3).toUpperCase()}-${pad(i + 1, 2)}`;
    });
  const exeats = students
    .filter((s) => s.boarding === 'Boarder')
    .slice(0, 6)
    .map((s, i) => ({
      id: `exe_${pad(i + 1)}`,
      studentId: s.id,
      reason: pick(['Medical appointment', 'Family function', 'Funeral', 'Mid-term break', 'Visa interview']),
      departure: ymd(subDays(d(TODAY), int(1, 20))),
      returnDate: ymd(subDays(d(TODAY), int(-5, 0))),
      status: i < 2 ? 'Pending' : i < 5 ? 'Returned' : 'Approved',
      guardian: 'Parent',
    }));

  // ---------- Transport ----------
  const routes = [
    { id: 'rte_01', name: 'Route A – Spintex', stops: 'Spintex Junction, Coastal Estate, Baatsona, Manet, Palace Mall', fee: 850, departure: '06:10', busId: 'bus_01' },
    { id: 'rte_02', name: 'Route B – Madina / Adenta', stops: 'Adenta Barrier, SDA, Madina Zongo Jn, Ritz, UPSA', fee: 800, departure: '06:00', busId: 'bus_02' },
    { id: 'rte_03', name: 'Route C – Tema', stops: 'Comm. 25, Comm. 18, Lashibi, Sakumono, Nungua Barrier', fee: 950, departure: '05:45', busId: 'bus_03' },
    { id: 'rte_04', name: 'Route D – Dansoman / Kaneshie', stops: 'Dansoman Roundabout, Mpoase, Kaneshie Market, Awudome, Kwame Nkrumah Circle', fee: 900, departure: '05:50', busId: 'bus_04' },
    { id: 'rte_05', name: 'Route E – Achimota / Dome', stops: 'Achimota Mall, Dome Pillar 2, Taifa, Haatso, Ashongman', fee: 820, departure: '06:05', busId: 'bus_05' },
  ];
  const drivers = staff.filter((s) => s.role === 'Driver');
  const buses = routes.map((rt, i) => ({
    id: `bus_0${i + 1}`,
    regNo: `GT ${int(1000, 9999)}-${pick(['22', '23', '24'])}`,
    model: pick(['Toyota Coaster', 'Hyundai County', 'Toyota Hiace', 'Mercedes Sprinter']),
    capacity: pick([30, 30, 26, 18]),
    driverId: drivers[i].id,
    routeId: rt.id,
    status: i === 3 ? 'Maintenance' : 'Active',
    insuranceExpiry: ymd(addDays(d(TODAY), int(20, 300))),
    roadworthyExpiry: ymd(addDays(d(TODAY), int(-10, 200))),
    mileage: int(42000, 160000),
  }));
  students
    .filter((s) => s.boarding === 'Day' && r() < 0.38)
    .forEach((s) => {
      s.busRouteId = pick(routes).id;
    });
  const trips = [];
  for (let i = 0; i < 12; i++) {
    const day = subDays(d(TODAY), Math.floor(i / 2) + 1);
    if (isWeekend(day)) continue;
    buses
      .filter((b) => b.status === 'Active')
      .forEach((b) =>
        trips.push({
          id: `trp_${trips.length + 1}`,
          busId: b.id,
          date: ymd(day),
          type: i % 2 ? 'Afternoon drop-off' : 'Morning pick-up',
          departed: i % 2 ? '15:10' : routes.find((rt) => rt.id === b.routeId).departure,
          arrived: i % 2 ? `16:${int(10, 55)}` : `07:${int(10, 45)}`,
          riders: int(12, 26),
          status: 'Completed',
          notes: r() < 0.15 ? pick(['Heavy traffic at Tetteh Quarshie', 'Fuel top-up', 'Student late at stop']) : '',
        }),
      );
  }
  const maintenance = [
    { id: 'mnt_1', busId: 'bus_04', date: ymd(subDays(d(TODAY), 3)), type: 'Gearbox repair', cost: 4800, vendor: 'Japan Motors', status: 'In progress' },
    { id: 'mnt_2', busId: 'bus_01', date: '2026-09-29', type: 'Full service', cost: 1350, vendor: 'Toyota Ghana', status: 'Completed' },
    { id: 'mnt_3', busId: 'bus_03', date: '2026-10-12', type: 'Tyres (x4)', cost: 3200, vendor: 'Tyre World', status: 'Completed' },
  ];

  // ---------- Fees ----------
  const feeStructures = [
    { id: 'fee_ey', section: 'Early Years', items: [{ name: 'Tuition', amount: 1800 }, { name: 'Feeding', amount: 950 }, { name: 'Learning Materials', amount: 250 }, { name: 'PTA Dues', amount: 100 }] },
    { id: 'fee_pr', section: 'Primary', items: [{ name: 'Tuition', amount: 2200 }, { name: 'Feeding', amount: 950 }, { name: 'ICT', amount: 150 }, { name: 'Sports & Culture', amount: 80 }, { name: 'PTA Dues', amount: 100 }] },
    { id: 'fee_jh', section: 'JHS', items: [{ name: 'Tuition', amount: 2650 }, { name: 'Feeding', amount: 950 }, { name: 'ICT', amount: 180 }, { name: 'Mock Exams', amount: 120 }, { name: 'PTA Dues', amount: 100 }] },
    { id: 'fee_sh', section: 'SHS', items: [{ name: 'Tuition', amount: 3200 }, { name: 'Science Lab / Practicals', amount: 300 }, { name: 'ICT', amount: 180 }, { name: 'Sports & Culture', amount: 100 }, { name: 'PTA Dues', amount: 100 }] },
    { id: 'fee_dp', section: 'Diploma', items: [{ name: 'Tuition (Semester)', amount: 4500 }, { name: 'Registration', amount: 350 }, { name: 'Lab / Studio', amount: 300 }, { name: 'Student Union', amount: 80 }] },
  ];
  const BOARDING_FEE = 2600;

  const invoices = [];
  const payments = [];
  let rcpt = 1;
  const billTerm = (termId, date) =>
    students.forEach((s) => {
      const c = classes.find((x) => x.id === s.classId);
      const items = [...feeStructures.find((f) => f.section === c.section).items];
      if (s.boarding === 'Boarder') items.push({ name: 'Boarding & Feeding', amount: BOARDING_FEE });
      if (s.busRouteId) items.push({ name: 'Transport', amount: routes.find((rt) => rt.id === s.busRouteId).fee });
      invoices.push({
        id: `inv_${pad(invoices.length + 1, 4)}`,
        invoiceNo: `INV-${termId.slice(2, 4)}${termId.slice(-1)}-${pad(invoices.length + 1, 4)}`,
        studentId: s.id,
        termId,
        date,
        dueDate: ymd(addDays(d(date), 21)),
        items,
        discount: r() < 0.06 ? 500 : 0,
        discountReason: '',
        total: items.reduce((a, it) => a + it.amount, 0),
      });
    });
  billTerm('2025/2026-T3', '2026-04-28');
  billTerm('2026/2027-T1', '2026-09-08');
  invoices.forEach((inv) => {
    if (inv.discount) inv.discountReason = pick(['Staff child', 'Sibling discount', 'Scholarship']);
  });

  const methods = ['Mobile Money', 'Mobile Money', 'Mobile Money', 'Bank Transfer', 'Cash', 'Cheque'];
  const momo = ['MTN MoMo', 'Telecel Cash', 'AT Money'];
  const addPayment = (inv, amount, date) => {
    const method = pick(methods);
    payments.push({
      id: `pay_${pad(payments.length + 1, 4)}`,
      receiptNo: `RCT-${pad(rcpt++, 5)}`,
      studentId: inv.studentId,
      invoiceId: inv.id,
      amount: Math.round(amount),
      method,
      network: method === 'Mobile Money' ? pick(momo) : '',
      reference: method === 'Cash' ? '' : `${method === 'Mobile Money' ? 'MP' : 'TX'}${int(10000000, 99999999)}`,
      date,
      receivedBy: accountant.id,
      note: '',
    });
  };
  invoices.forEach((inv) => {
    const due = inv.total - inv.discount;
    const prev = inv.termId === '2025/2026-T3';
    const roll = r();
    const start = d(inv.date);
    const span = prev ? 80 : 50;
    if (inv.studentId === demoStudent.id && !prev) {
      addPayment(inv, due * 0.6, '2026-09-10');
      return;
    }
    if (roll < (prev ? 0.82 : 0.45)) {
      if (r() < 0.5) addPayment(inv, due, ymd(addDays(start, int(0, span))));
      else {
        addPayment(inv, due * 0.5, ymd(addDays(start, int(0, 15))));
        addPayment(inv, due * 0.5, ymd(addDays(start, int(16, span))));
      }
    } else if (roll < (prev ? 0.97 : 0.82)) {
      addPayment(inv, due * (0.3 + r() * 0.4), ymd(addDays(start, int(0, span))));
    }
  });

  const expenseCats = ['Salaries', 'Utilities', 'Maintenance', 'Teaching Materials', 'Feeding', 'Transport & Fuel', 'Events', 'Administration', 'ICT'];
  const expenses = [];
  ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'].forEach((m) => {
    const lines = [
      ['Utilities', 'ECG electricity bill', int(5500, 8500), 'ECG'],
      ['Utilities', 'Ghana Water bill', int(1200, 2200), 'GWCL'],
      ['Feeding', 'Foodstuff supplies', int(18000, 26000), 'Makola Wholesale'],
      ['Transport & Fuel', 'Fuel for school buses', int(9000, 14000), 'GOIL'],
      ['Maintenance', pick(['Plumbing repairs', 'Classroom painting', 'Generator servicing', 'AC servicing']), int(1500, 6000), pick(['FixIt Ltd', 'Local artisan', 'CoolAir GH'])],
      ['Administration', pick(['Printing & stationery', 'Internet subscription', 'Bank charges']), int(800, 3000), pick(['Vodafone Business', 'Office Mart', 'GCB Bank'])],
    ];
    if (m === '2026-07') lines.push(['Events', 'Speech & Prize-giving Day', 14500, 'Events GH']);
    if (m === '2026-09') lines.push(['ICT', '10 Chromebooks for ICT lab', 28000, 'Compu-Ghana'], ['Teaching Materials', 'Textbooks & lab reagents', 12600, 'EPP Books']);
    lines.forEach(([category, description, amount, payee]) =>
      expenses.push({
        id: `exp_${pad(expenses.length + 1)}`,
        date: `${m}-${pad(int(2, 27), 2)}`,
        category,
        description,
        amount,
        payee,
        method: pick(['Bank Transfer', 'Cheque', 'Mobile Money', 'Cash']),
        approvedBy: staff[0].id,
      }),
    );
  });

  // ---------- Payroll ----------
  const payrollRuns = ['2026-08', '2026-09', '2026-10'].map((month, i) => ({
    id: `prl_${month}`,
    month,
    status: 'Paid',
    paidOn: `${month}-27`,
    lines: staff.map((s) => payslip(s)),
    createdAt: `${month}-25`,
    _i: i,
  }));
  payrollRuns.forEach((p) => delete p._i);
  const leaves = [
    { id: 'lev_1', staffId: teachers[3].id, type: 'Sick Leave', from: ymd(subDays(d(TODAY), 4)), to: ymd(subDays(d(TODAY), 2)), reason: 'Malaria – medical note attached', status: 'Approved' },
    { id: 'lev_2', staffId: teachers[8].id, type: 'Annual Leave', from: '2026-12-14', to: '2026-12-31', reason: 'Christmas travel', status: 'Pending' },
    { id: 'lev_3', staffId: demoTeacher.id, type: 'Study Leave', from: '2026-11-16', to: '2026-11-17', reason: 'MPhil defence', status: 'Pending' },
    { id: 'lev_4', staffId: teachers[12].id, type: 'Maternity Leave', from: '2026-10-01', to: '2027-01-15', reason: 'Maternity', status: 'Approved' },
  ];

  // ---------- Timetable ----------
  const periods = [
    { id: 'p1', label: 'P1', start: '08:00', end: '08:40' },
    { id: 'p2', label: 'P2', start: '08:40', end: '09:20' },
    { id: 'p3', label: 'P3', start: '09:20', end: '10:00' },
    { id: 'brk', label: 'Break', start: '10:00', end: '10:30', isBreak: true },
    { id: 'p4', label: 'P4', start: '10:30', end: '11:10' },
    { id: 'p5', label: 'P5', start: '11:10', end: '11:50' },
    { id: 'p6', label: 'P6', start: '11:50', end: '12:30' },
    { id: 'lun', label: 'Lunch', start: '12:30', end: '13:15', isBreak: true },
    { id: 'p7', label: 'P7', start: '13:15', end: '13:55' },
    { id: 'p8', label: 'P8', start: '13:55', end: '14:35' },
  ];
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const timetable = {};
  classes.forEach((c) => {
    const grid = {};
    DAYS.forEach((day, di) => {
      grid[day] = {};
      periods
        .filter((p) => !p.isBreak)
        .forEach((p, pi) => {
          grid[day][p.id] = c.subjectIds[(pi + di * 3 + c.order) % c.subjectIds.length];
        });
    });
    timetable[c.id] = grid;
  });

  // ---------- Attendance (last 15 school days) ----------
  const attendance = [];
  let day = d(TODAY);
  let count = 0;
  while (count < 15) {
    day = subDays(day, 1);
    if (isWeekend(day)) continue;
    count++;
    const date = ymd(day);
    classes.forEach((c) => {
      const recs = {};
      students
        .filter((s) => s.classId === c.id)
        .forEach((s) => {
          const x = r();
          recs[s.id] = x < 0.9 ? 'P' : x < 0.95 ? 'L' : x < 0.985 ? 'A' : 'E';
        });
      attendance.push({ id: `${date}|${c.id}`, date, classId: c.id, records: recs, takenBy: c.classTeacherId });
    });
  }

  // ---------- Scores ----------
  const scores = [];
  students.forEach((s) => {
    const c = classes.find((x) => x.id === s.classId);
    const ability = 0.45 + r() * 0.5;
    ['2025/2026-T3', '2026/2027-T1'].forEach((termId) =>
      c.subjectIds.forEach((sid) => {
        const v = Math.min(0.99, Math.max(0.15, ability + (r() - 0.5) * 0.3));
        scores.push({
          id: `scr_${s.id}_${sid}_${termId}`,
          studentId: s.id,
          subjectId: sid,
          classId: c.id,
          termId,
          classScore: Math.round(v * 30),
          examScore: Math.round(Math.min(0.99, Math.max(0.1, v + (r() - 0.5) * 0.2)) * 70),
        });
      }),
    );
  });
  const reportRemarks = {};

  // ---------- Library ----------
  const bookDefs = [
    ['Things Fall Apart', 'Chinua Achebe', 'Literature'], ['The Beautyful Ones Are Not Yet Born', 'Ayi Kwei Armah', 'Literature'],
    ['Changes: A Love Story', 'Ama Ata Aidoo', 'Literature'], ['Faceless', 'Amma Darko', 'Literature'], ['Homegoing', 'Yaa Gyasi', 'Literature'],
    ['Harmattan Rain', 'Ayesha Harruna Attah', 'Literature'], ['Anansi and the Pot of Wisdom', 'Traditional', "Children's"], ['The Gruffalo', 'Julia Donaldson', "Children's"],
    ['Charlotte\'s Web', 'E. B. White', "Children's"], ['Matilda', 'Roald Dahl', "Children's"], ['Diary of a Wimpy Kid', 'Jeff Kinney', "Children's"],
    ['Aki Ola Core Mathematics', 'Aki Ola', 'Textbook'], ['Aki Ola Integrated Science', 'Aki Ola', 'Textbook'], ['New Senior Secondary Physics', 'M. W. Anyakoha', 'Textbook'],
    ['Essential Chemistry for SHS', 'A. Ababio', 'Textbook'], ['Modern Biology for SHS', 'Sarojini Ramalingam', 'Textbook'], ['Elective Maths Made Simple', 'K. Baffour', 'Textbook'],
    ['Social Studies for JHS', 'Ghana Education Service', 'Textbook'], ['Computing for Basic Schools', 'NaCCA', 'Textbook'], ['Learn French – JHS', 'Unimax', 'Textbook'],
    ['Financial Accounting', 'Frank Wood', 'Business'], ['Principles of Marketing', 'Philip Kotler', 'Business'], ['Business Law in Ghana', 'Daniel Bonsu', 'Business'],
    ['Database System Concepts', 'Silberschatz', 'Computing'], ['Eloquent JavaScript', 'Marijn Haverbeke', 'Computing'], ['Computer Networking: A Top-Down Approach', 'Kurose & Ross', 'Computing'],
    ['A History of Ghana', 'Roger Gocking', 'History'], ['The Ghana Reader', 'Kwasi Konadu', 'History'], ['Ghana: Autobiography of Kwame Nkrumah', 'Kwame Nkrumah', 'History'],
    ['Oxford Advanced Learner\'s Dictionary', 'Oxford', 'Reference'], ['Atlas for Ghana', 'Macmillan', 'Reference'], ['Encyclopedia of Science', 'DK', 'Reference'],
    ['Akan Folktales', 'Peggy Appiah', "Children's"], ['Gulliver\'s Travels', 'Jonathan Swift', 'Literature'], ['The Old Man and the Medal', 'Ferdinand Oyono', 'Literature'],
    ['Animal Farm', 'George Orwell', 'Literature'],
  ];
  const books = bookDefs.map(([title, author, category], i) => {
    const copies = category === 'Textbook' ? int(6, 15) : int(2, 6);
    return {
      id: `bok_${pad(i + 1)}`,
      title,
      author,
      category,
      isbn: `978-${int(0, 9)}-${int(100, 999)}-${int(10000, 99999)}-${int(0, 9)}`,
      copies,
      shelf: `${category.slice(0, 3).toUpperCase()}-${pad(int(1, 20), 2)}`,
      publisher: pick(['Sub-Saharan Publishers', 'Heinemann', 'Penguin', 'Macmillan', 'Unimax', 'EPP Books']),
      year: int(1958, 2024),
    };
  });
  const loans = [];
  const borrowers = students.filter((s) => !s.classId.match(/cls_0[1-5]$/));
  for (let i = 0; i < 34; i++) {
    const issue = subDays(d(TODAY), int(1, 40));
    const returned = r() < 0.45;
    const b = pick(books);
    const isStaff = r() < 0.12;
    loans.push({
      id: `lon_${pad(i + 1)}`,
      bookId: b.id,
      memberType: isStaff ? 'Staff' : 'Student',
      memberId: isStaff ? pick(teachers).id : i === 0 ? demoStudent.id : pick(borrowers).id,
      issueDate: ymd(issue),
      dueDate: ymd(addDays(issue, 14)),
      returnDate: returned ? ymd(addDays(issue, int(3, 18))) : null,
      finePaid: 0,
    });
  }

  // ---------- Store ----------
  const suppliers = [
    { id: 'sup_1', name: 'Kente Uniforms Ltd', contact: 'Mr. Agyei', phone: phone(), email: 'sales@kenteuniforms.com', category: 'Uniforms' },
    { id: 'sup_2', name: 'EPP Books Services', contact: 'Mrs. Lamptey', phone: phone(), email: 'orders@eppbooks.com', category: 'Books' },
    { id: 'sup_3', name: 'Office Mart Ghana', contact: 'Ernest', phone: phone(), email: 'info@officemart.com.gh', category: 'Stationery' },
    { id: 'sup_4', name: 'CleanPro Supplies', contact: 'Afia', phone: phone(), email: 'cleanpro@gmail.com', category: 'Cleaning' },
    { id: 'sup_5', name: 'SciLab West Africa', contact: 'Dr. Ofosu', phone: phone(), email: 'sales@scilab.africa', category: 'Lab' },
  ];
  const itemDefs = [
    ['School Uniform – Primary (Set)', 'Uniforms', 'set', 180, 'sup_1'], ['School Uniform – JHS (Set)', 'Uniforms', 'set', 210, 'sup_1'],
    ['School Uniform – SHS (Set)', 'Uniforms', 'set', 240, 'sup_1'], ['House Jersey', 'Uniforms', 'pcs', 95, 'sup_1'], ['PE Kit', 'Uniforms', 'set', 120, 'sup_1'],
    ['Cardigan (Blue)', 'Uniforms', 'pcs', 110, 'sup_1'], ['School Bag (Branded)', 'Uniforms', 'pcs', 150, 'sup_1'], ['Name Tag', 'Uniforms', 'pcs', 15, 'sup_1'],
    ['Exercise Book (40 leaves)', 'Stationery', 'pcs', 6, 'sup_3'], ['Exercise Book (80 leaves)', 'Stationery', 'pcs', 10, 'sup_3'], ['Note Book (A4)', 'Stationery', 'pcs', 18, 'sup_3'],
    ['Pencil (HB, dozen)', 'Stationery', 'pack', 24, 'sup_3'], ['Mathematical Set', 'Stationery', 'pcs', 35, 'sup_3'], ['Crayons (box)', 'Stationery', 'box', 20, 'sup_3'],
    ['A4 Paper (ream)', 'Stationery', 'ream', 65, 'sup_3'], ['Whiteboard Markers (box)', 'Stationery', 'box', 55, 'sup_3'],
    ['English Textbook – Basic 4', 'Books', 'pcs', 75, 'sup_2'], ['Mathematics Textbook – JHS 2', 'Books', 'pcs', 85, 'sup_2'], ['Core Maths – SHS 1', 'Books', 'pcs', 95, 'sup_2'],
    ['Liquid Soap (5L)', 'Cleaning', 'gal', 45, 'sup_4'], ['Toilet Roll (pack of 10)', 'Cleaning', 'pack', 38, 'sup_4'], ['Detergent (5kg)', 'Cleaning', 'bag', 70, 'sup_4'],
    ['Lab Coats', 'Lab', 'pcs', 85, 'sup_5'], ['Test Tubes (pack of 50)', 'Lab', 'pack', 120, 'sup_5'], ['Hand Sanitizer (500ml)', 'Cleaning', 'pcs', 25, 'sup_4'],
  ];
  const storeItems = itemDefs.map(([name, category, unit, price, supplierId], i) => {
    const reorderLevel = category === 'Stationery' ? 50 : 15;
    const stock = i % 7 === 3 ? int(2, reorderLevel - 1) : int(reorderLevel + 5, reorderLevel * 6);
    return { id: `itm_${pad(i + 1)}`, sku: `SKU-${pad(i + 1, 4)}`, name, category, unit, price, cost: Math.round(price * 0.72), stock, reorderLevel, supplierId };
  });
  const stockMoves = [];
  storeItems.forEach((it) => {
    stockMoves.push({ id: `stm_${stockMoves.length + 1}`, itemId: it.id, type: 'In', qty: it.stock + int(10, 40), date: '2026-08-28', note: 'Opening stock / term restock', studentId: null, amount: 0 });
  });
  for (let i = 0; i < 30; i++) {
    const it = pick(storeItems.filter((x) => ['Uniforms', 'Stationery', 'Books'].includes(x.category)));
    const qty = int(1, 3);
    const st = pick(students);
    stockMoves.push({ id: `stm_${stockMoves.length + 1}`, itemId: it.id, type: 'Sale', qty, date: ymd(subDays(d(TODAY), int(1, 50))), note: 'Sold to student', studentId: st.id, amount: qty * it.price });
  }
  const purchaseOrders = [
    { id: 'po_1', poNo: 'PO-2026-014', supplierId: 'sup_1', date: '2026-10-20', items: [{ itemId: 'itm_003', qty: 40, cost: 173 }, { itemId: 'itm_005', qty: 30, cost: 86 }], status: 'Ordered' },
    { id: 'po_2', poNo: 'PO-2026-013', supplierId: 'sup_3', date: '2026-10-08', items: [{ itemId: 'itm_009', qty: 500, cost: 4 }, { itemId: 'itm_015', qty: 20, cost: 47 }], status: 'Received' },
    { id: 'po_3', poNo: 'PO-2026-015', supplierId: 'sup_4', date: '2026-10-30', items: [{ itemId: 'itm_020', qty: 20, cost: 32 }], status: 'Draft' },
  ];

  // ---------- Admissions ----------
  const stages = ['Applied', 'Applied', 'Applied', 'Entrance Exam', 'Entrance Exam', 'Interview', 'Offered', 'Offered', 'Rejected'];
  const applications = Array.from({ length: 14 }, (_, i) => {
    const female = r() < 0.5;
    const c = pick(classes);
    return {
      id: `app_${pad(i + 1)}`,
      appNo: `APP-2027-${pad(i + 1)}`,
      firstName: pick(female ? FEMALE : MALE),
      lastName: pick(SURNAMES),
      gender: female ? 'Female' : 'Male',
      dob: ymd(subDays(d(TODAY), 365 * (ageBySection[c.section][0] + 1) + int(0, 300))),
      classId: c.id,
      parentName: `${pick(['Mr.', 'Mrs.'])} ${pick(MALE)} ${pick(SURNAMES)}`,
      parentPhone: phone(),
      parentEmail: `parent${i + 1}@gmail.com`,
      previousSchool: pick(['Christ the King Academy', 'Morning Star School', 'Achimota Basic', 'Ridge Church School', 'Holy Child', 'Tema International', 'Home-schooled']),
      boarding: ['SHS', 'Diploma'].includes(c.section) && r() < 0.5 ? 'Boarder' : 'Day',
      stage: stages[i % stages.length],
      examScore: i % 9 >= 4 ? int(45, 92) : null,
      appliedOn: ymd(subDays(d(TODAY), int(1, 40))),
      notes: '',
    };
  });

  // ---------- Communication ----------
  const notices = [
    { id: 'not_1', title: 'Mid-term break', body: 'School will vacate for mid-term break on Friday 6th November and resume on Tuesday 10th November 2026. Buses run the normal timetable on Friday.', audience: 'All', priority: 'High', date: '2026-10-30', authorId: staff[0].id, pinned: true },
    { id: 'not_2', title: 'PTA General Meeting', body: 'All parents are invited to the PTA general meeting on Saturday 14th November at 9:00am in the main auditorium. Agenda: fees review, new science block, end-of-year party.', audience: 'Parents', priority: 'Normal', date: '2026-10-28', authorId: staff[0].id, pinned: false },
    { id: 'not_3', title: 'Second instalment of fees due', body: 'Parents are reminded that the second instalment of Term 1 fees is due by 20th November. Pay via MTN MoMo merchant code 778899 or at the accounts office.', audience: 'Parents', priority: 'High', date: '2026-10-26', authorId: accountant.id, pinned: false },
    { id: 'not_4', title: 'Staff professional development', body: 'All teaching staff will attend a CPD workshop on the new Standards-Based Curriculum on Wednesday 4th November, 2:00pm – 4:30pm.', audience: 'Staff', priority: 'Normal', date: '2026-10-25', authorId: staff[0].id, pinned: false },
    { id: 'not_5', title: 'Inter-house athletics', body: 'Inter-house athletics competition comes off on 27th November. Students should register for events with their house masters.', audience: 'Students', priority: 'Normal', date: '2026-10-22', authorId: staff[0].id, pinned: false },
    { id: 'not_6', title: 'BECE & WASSCE registration', body: 'JHS 3 and SHS 3 students must submit passport pictures and birth certificates for exam registration by 13th November.', audience: 'Students', priority: 'High', date: '2026-10-20', authorId: staff[0].id, pinned: false },
  ];
  const events = [
    ['2026-11-04', 'Staff CPD workshop', 'Staff'], ['2026-11-06', 'Mid-term break begins', 'Holiday'], ['2026-11-10', 'School resumes', 'Academic'],
    ['2026-11-13', 'Exam registration deadline', 'Academic'], ['2026-11-14', 'PTA General Meeting', 'Meeting'], ['2026-11-20', 'Fees 2nd instalment due', 'Finance'],
    ['2026-11-27', 'Inter-house athletics', 'Sports'], ['2026-12-01', 'Farmers Day (Holiday)', 'Holiday'], ['2026-12-04', 'End of term exams begin', 'Academic'],
    ['2026-12-10', 'Carols night & Christmas party', 'Event'], ['2026-12-11', 'Vacation / Report cards issued', 'Academic'], ['2026-10-16', 'Our Day celebration', 'Event'],
    ['2026-10-09', 'Mid-term assessments', 'Academic'], ['2026-11-18', 'Science & Maths quiz (zonal)', 'Academic'], ['2026-11-25', 'Board of Governors meeting', 'Meeting'],
  ].map(([date, title, type], i) => ({ id: `evt_${i + 1}`, date, title, type, description: '' }));

  // ---------- Health & Discipline ----------
  const healthVisits = Array.from({ length: 12 }, (_, i) => ({
    id: `hlt_${i + 1}`,
    studentId: pick(students).id,
    date: ymd(subDays(d(TODAY), int(1, 45))),
    complaint: pick(['Headache', 'Fever', 'Stomach ache', 'Minor cut on knee', 'Malaria symptoms', 'Cough & catarrh', 'Sprained ankle (sports)', 'Dizziness']),
    treatment: pick(['Paracetamol, rest', 'First aid, dressing', 'Referred to hospital', 'ORS & observation', 'Ice pack, rest', 'Parent called, sent home']),
    attendedBy: staff.find((s) => s.role === 'Nurse').id,
    parentNotified: r() < 0.6,
  }));
  const incidents = Array.from({ length: 9 }, (_, i) => ({
    id: `dis_${i + 1}`,
    studentId: pick(students.filter((s) => !s.classId.match(/cls_0[1-9]$/))).id,
    date: ymd(subDays(d(TODAY), int(1, 50))),
    type: pick(['Lateness', 'Uniform violation', 'Fighting', 'Bullying', 'Use of phone in class', 'Truancy', 'Disrespect to staff']),
    description: 'Reported by duty teacher.',
    action: pick(['Verbal warning', 'Detention', 'Parent invited', 'Community service', 'Suspension (2 days)']),
    reportedBy: pick(teachers).id,
    status: pick(['Open', 'Resolved', 'Resolved']),
  }));

  // ---------- LMS ----------
  const jhs2 = classes.find((c) => c.name === 'JHS 2');
  const mathJ = subBy('JHS', 'Mathematics');
  const sciJ = subBy('JHS', 'Integrated Science');
  const engJ = subBy('JHS', 'English Language');
  const materials = [
    { id: 'mat_1', classId: jhs2.id, subjectId: mathJ, title: 'Linear Equations – Lesson Notes', type: 'Notes', content: 'A linear equation in one variable has the form ax + b = 0.\n\nSteps to solve:\n1. Collect like terms.\n2. Move constants to one side.\n3. Divide by the coefficient of x.\n\nExample: 3x + 5 = 20 → 3x = 15 → x = 5.', link: '', date: '2026-10-19', authorId: demoTeacher.id },
    { id: 'mat_2', classId: jhs2.id, subjectId: mathJ, title: 'Video: Solving equations (Khan Academy)', type: 'Video', content: 'Watch before Thursday class.', link: 'https://www.khanacademy.org/math/algebra', date: '2026-10-20', authorId: demoTeacher.id },
    { id: 'mat_3', classId: jhs2.id, subjectId: sciJ, title: 'Photosynthesis – Slides', type: 'Slides', content: 'Light energy + CO₂ + H₂O → glucose + O₂. Chlorophyll in chloroplasts captures light.', link: '', date: '2026-10-21', authorId: teachersIn('JHS')[1].id },
    { id: 'mat_4', classId: jhs2.id, subjectId: engJ, title: 'Comprehension practice passages', type: 'Worksheet', content: 'Read passages 1–3 and answer all questions in your exercise book.', link: '', date: '2026-10-23', authorId: teachersIn('JHS')[2].id },
    { id: 'mat_5', classId: classes.find((c) => c.name === 'Dip. IT Y1').id, subjectId: subBy('Diploma', 'Web Development'), title: 'HTML & CSS Fundamentals', type: 'Notes', content: 'Semantic HTML, the box model, Flexbox and Grid.', link: 'https://developer.mozilla.org/', date: '2026-10-12', authorId: teachersIn('Diploma')[0].id },
  ];
  const assignments = [
    { id: 'asg_1', classId: jhs2.id, subjectId: mathJ, title: 'Linear equations exercise 4B', description: 'Solve questions 1–15 on page 62. Show all working.', dueDate: '2026-11-05', maxScore: 20, authorId: demoTeacher.id, date: '2026-10-26' },
    { id: 'asg_2', classId: jhs2.id, subjectId: sciJ, title: 'Plant cell diagram', description: 'Draw and label a plant cell. Explain the function of 5 organelles.', dueDate: '2026-11-09', maxScore: 15, authorId: teachersIn('JHS')[1].id, date: '2026-10-28' },
    { id: 'asg_3', classId: jhs2.id, subjectId: engJ, title: 'Essay: My community', description: 'Write a 300-word descriptive essay about your community.', dueDate: '2026-10-30', maxScore: 20, authorId: teachersIn('JHS')[2].id, date: '2026-10-20' },
    { id: 'asg_4', classId: jhs2.id, subjectId: mathJ, title: 'Angles & parallel lines', description: 'Complete worksheet 7.', dueDate: '2026-10-22', maxScore: 10, authorId: demoTeacher.id, date: '2026-10-15' },
  ];
  const jhs2Students = students.filter((s) => s.classId === jhs2.id);
  const submissions = [];
  jhs2Students.forEach((s) => {
    ['asg_3', 'asg_4'].forEach((aid) => {
      if (r() < 0.85 || s.id === demoStudent.id) {
        const a = assignments.find((x) => x.id === aid);
        submissions.push({ id: `sbm_${submissions.length + 1}`, assignmentId: aid, studentId: s.id, text: 'Submitted in class / attached work.', date: ymd(subDays(d(a.dueDate), int(0, 3))), score: aid === 'asg_4' ? int(5, 10) : null, feedback: aid === 'asg_4' ? pick(['Good work', 'Show more working', 'Excellent!', 'Neat presentation']) : '' });
      }
    });
    if (r() < 0.4 && s.id !== demoStudent.id) submissions.push({ id: `sbm_${submissions.length + 1}`, assignmentId: 'asg_1', studentId: s.id, text: 'Answers attached.', date: '2026-11-01', score: null, feedback: '' });
  });
  const quizzes = [
    {
      id: 'qz_1', classId: jhs2.id, subjectId: mathJ, title: 'Quick quiz: Linear equations', timeLimit: 10, authorId: demoTeacher.id, date: '2026-10-27', published: true,
      questions: [
        { q: 'Solve: 2x + 6 = 14', options: ['x = 3', 'x = 4', 'x = 5', 'x = 10'], answer: 1 },
        { q: 'Solve: 5x − 5 = 20', options: ['x = 3', 'x = 4', 'x = 5', 'x = 6'], answer: 2 },
        { q: 'If x/3 = 7, then x =', options: ['21', '10', '4', '7/3'], answer: 0 },
        { q: 'Solve: 3(x + 2) = 15', options: ['x = 1', 'x = 2', 'x = 3', 'x = 5'], answer: 2 },
        { q: 'Which is a linear equation?', options: ['x² + 1 = 0', '2x + 3 = 9', 'xy = 4', '1/x = 2'], answer: 1 },
      ],
    },
    {
      id: 'qz_2', classId: jhs2.id, subjectId: sciJ, title: 'Photosynthesis check', timeLimit: 8, authorId: teachersIn('JHS')[1].id, date: '2026-10-29', published: true,
      questions: [
        { q: 'Which gas is released during photosynthesis?', options: ['Carbon dioxide', 'Nitrogen', 'Oxygen', 'Hydrogen'], answer: 2 },
        { q: 'Photosynthesis takes place in the…', options: ['Mitochondria', 'Chloroplast', 'Nucleus', 'Ribosome'], answer: 1 },
        { q: 'The green pigment in leaves is', options: ['Chlorophyll', 'Haemoglobin', 'Melanin', 'Carotene'], answer: 0 },
      ],
    },
  ];
  const quizAttempts = jhs2Students
    .filter((s) => s.id !== demoStudent.id && r() < 0.7)
    .map((s, i) => ({ id: `qat_${i + 1}`, quizId: 'qz_1', studentId: s.id, answers: [], score: int(2, 5), total: 5, date: '2026-10-28' }));

  // ---------- Live classes ----------
  const shs2sci = classes.find((c) => c.name === 'SHS 2 Science');
  const dipIT = classes.find((c) => c.name === 'Dip. IT Y1');
  const jhsSci = teachersIn('JHS')[1];
  const live = (o) => ({ status: 'Scheduled', duration: 45, description: '', attendance: [], chat: [], provider: null, ...o });
  const liveSessions = [
    live({ id: 'lvs_01', code: 'K7Q4-MZ9P', title: 'Simultaneous equations (live)', classId: jhs2.id, subjectId: mathJ, teacherId: demoTeacher.id, date: TODAY, start: '16:00', duration: 60, description: 'Bring your exercise books. We will solve past BECE questions together.' }),
    live({ id: 'lvs_02', code: 'S3RV-8XWD', title: 'Photosynthesis revision', classId: jhs2.id, subjectId: sciJ, teacherId: jhsSci.id, date: ymd(addDays(d(TODAY), 1)), start: '15:30' }),
    live({ id: 'lvs_03', code: 'W4AB-2TNE', title: 'Organic chemistry Q&A', classId: shs2sci.id, subjectId: subBy('SHS', 'Chemistry'), teacherId: teachersIn('SHS')[2].id, date: ymd(addDays(d(TODAY), 2)), start: '17:00', duration: 60 }),
    live({ id: 'lvs_04', code: 'P9DK-Q3HF', title: 'React & web APIs workshop', classId: dipIT.id, subjectId: subBy('Diploma', 'Web Development'), teacherId: teachersIn('Diploma')[0].id, date: ymd(addDays(d(TODAY), 3)), start: '18:00', duration: 90 }),
    live({
      id: 'lvs_05', code: 'H2LM-7RCY', title: 'Angles & parallel lines recap', classId: jhs2.id, subjectId: mathJ, teacherId: demoTeacher.id, date: ymd(subDays(d(TODAY), 3)), start: '16:00', status: 'Ended',
      attendance: jhs2Students.slice(0, 7).map((st, i) => ({ personType: 'Student', personId: st.id, name: `${st.firstName} ${st.lastName}`, joinedAt: `16:0${i % 10}`, leftAt: `16:4${(i * 3) % 10}` })),
    }),
  ];

  // ---------- Messages & SMS ----------
  // ---------- Canteen ----------
  const canteen = buildCanteen({ students, classes, staff, today: TODAY });
  staff.push(...canteen.canteenStaff);
  const canteenManager = canteen.canteenStaff[0];
  const securityGuard = staff.find((x) => x.role === 'Security');

  const users = [
    { id: 'usr_admin', role: 'admin', name: `${staff[0].title} ${staff[0].firstName} ${staff[0].lastName}`, linkedId: staff[0].id, email: staff[0].email },
    { id: 'usr_teacher', role: 'teacher', name: `Mr. ${demoTeacher.firstName} ${demoTeacher.lastName}`, linkedId: demoTeacher.id, email: demoTeacher.email },
    { id: 'usr_parent', role: 'parent', name: `Mrs. ${demoParent.firstName} ${demoParent.lastName}`, linkedId: demoParent.id, email: demoParent.email },
    { id: 'usr_student', role: 'student', name: `${demoStudent.firstName} ${demoStudent.lastName}`, linkedId: demoStudent.id, email: `${demoStudent.firstName}.${demoStudent.lastName}@student.brightfuture.edu.gh`.toLowerCase() },
    { id: 'usr_accountant', role: 'accountant', name: `Mrs. ${accountant.firstName} ${accountant.lastName}`, linkedId: accountant.id, email: accountant.email },
    { id: 'usr_librarian', role: 'librarian', name: `Ms. ${librarian.firstName} ${librarian.lastName}`, linkedId: librarian.id, email: librarian.email },
    { id: 'usr_storekeeper', role: 'storekeeper', name: `Mr. ${storekeeper.firstName} ${storekeeper.lastName}`, linkedId: storekeeper.id, email: storekeeper.email },
    { id: 'usr_transport', role: 'transport', name: `Mr. ${transportOfficer.firstName} ${transportOfficer.lastName}`, linkedId: transportOfficer.id, email: transportOfficer.email },
    { id: 'usr_canteen', role: 'canteen', name: `Mrs. ${canteenManager.firstName} ${canteenManager.lastName}`, linkedId: canteenManager.id, email: canteenManager.email },
    { id: 'usr_staff', role: 'staff', name: `${securityGuard.title} ${securityGuard.firstName} ${securityGuard.lastName}`, linkedId: securityGuard.id, email: securityGuard.email },
    { id: 'usr_super', role: 'superadmin', name: 'Platform Super Admin', linkedId: null, email: 'superadmin@edunexa.app' },
  ];
  users.forEach((u) => {
    u.status = 'Active';
    u.phone = (u.role === 'parent' ? demoParent.phone : staff.find((x) => x.id === u.linkedId)?.phone) || '';
    u.lastLogin = null;
  });

  const messages = [
    { id: 'msg_1', fromId: 'usr_teacher', toId: 'usr_parent', subject: "Kofi's progress in Mathematics", body: 'Good afternoon Mrs. Mensah. Kofi has improved greatly in Mathematics this term. Kindly encourage him to keep practising the exercises at home. Regards, Mr. Asante.', date: '2026-10-29T14:20:00', read: false },
    { id: 'msg_2', fromId: 'usr_accountant', toId: 'usr_parent', subject: 'Fees balance reminder', body: "Dear Parent, this is a gentle reminder that Kofi's Term 1 fees has an outstanding balance. Kindly pay via MoMo or at the accounts office by 20th November. Thank you.", date: '2026-10-27T09:05:00', read: true },
    { id: 'msg_3', fromId: 'usr_parent', toId: 'usr_teacher', subject: 'Re: Homework', body: 'Thank you Sir. Kofi was unwell on Tuesday so he could not submit the homework on time. He will submit tomorrow.', date: '2026-10-22T18:40:00', read: true },
    { id: 'msg_4', fromId: 'usr_admin', toId: 'usr_teacher', subject: 'JHS 2 mock exam timetable', body: 'Please share the draft JHS 2 mock exam timetable before Friday so we can circulate to parents.', date: '2026-10-30T08:15:00', read: false },
    { id: 'msg_5', fromId: 'usr_admin', toId: 'usr_accountant', subject: 'October financial summary', body: 'Kindly prepare the October income & expenditure summary for the Board meeting on 25th November.', date: '2026-10-31T10:00:00', read: false },
    { id: 'msg_6', fromId: 'usr_teacher', toId: 'usr_student', subject: 'Quiz is live', body: 'Kofi, the linear equations quiz is now live on the LMS. You have 10 minutes once you start. Good luck!', date: '2026-10-27T15:30:00', read: false },
    { id: 'msg_7', fromId: 'usr_transport', toId: 'usr_admin', subject: 'Bus 4 repairs', body: 'Bus 4 (Route D) is at Japan Motors for gearbox repairs. Route D students are being covered by Bus 1 on a second run this week.', date: '2026-10-30T16:45:00', read: false },
    { id: 'msg_8', fromId: 'usr_storekeeper', toId: 'usr_admin', subject: 'Low stock: SHS uniforms', body: 'We are low on SHS uniform sets and PE kits. PO-2026-014 has been sent to Kente Uniforms; awaiting delivery.', date: '2026-10-21T11:10:00', read: true },
  ];
  const smsLog = [
    { id: 'sms_1', date: '2026-10-30T10:00:00', audience: 'All Parents', message: 'BFIS: Mid-term break is Fri 6 Nov – Mon 9 Nov. School resumes Tue 10 Nov. Thank you.', recipients: parents.length, status: 'Delivered' },
    { id: 'sms_2', date: '2026-10-26T09:00:00', audience: 'Parents with arrears', message: 'BFIS: Kindly settle the outstanding Term 1 fees by 20 Nov. MoMo merchant code 778899.', recipients: 86, status: 'Delivered' },
  ];

  return {
    meta: { version: 1, seededAt: TODAY },
    settings,
    terms,
    periods,
    users,
    subjects,
    classes,
    allocations,
    staff,
    leaves,
    parents,
    students,
    applications,
    timetable,
    attendance,
    scores,
    reportRemarks,
    feeStructures,
    invoices,
    payments,
    expenses,
    expenseCategories: expenseCats,
    payrollRuns,
    routes,
    buses,
    trips,
    maintenance,
    books,
    loans,
    storeItems,
    stockMoves,
    suppliers,
    purchaseOrders,
    dorms,
    exeats,
    notices,
    events,
    messages,
    smsLog,
    healthVisits,
    incidents,
    materials,
    assignments,
    submissions,
    quizzes,
    quizAttempts,
    boardingFee: BOARDING_FEE,
    canteenItems: canteen.canteenItems,
    canteenMenu: canteen.canteenMenu,
    canteenStock: canteen.canteenStock,
    canteenStockMoves: canteen.canteenStockMoves,
    canteenSales: canteen.canteenSales,
    clockings: buildClockings({ students, staff, classes, attendance, leaves, today: TODAY }),
    liveSessions,
  };
}

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
