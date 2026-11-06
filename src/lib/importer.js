// Excel import: the template schools fill in, and the logic that turns a filled workbook into EduNexa records.
// Re-importing the same file updates records instead of duplicating them (students by admission number,
// staff by staff number / email / phone, classes by name, books by ISBN, store items by SKU…).
import { uid } from './format';
import { schoolPrefix } from './numbers';
import { STARTER_SECTIONS, SUBJECT_DEFS } from '../data/starter';

// ---------------------------------------------------------------- template
/** Sheet → columns. `*` = required. `ex` = the example row. */
export const SHEETS = [
  {
    name: 'Classes',
    about: 'One row per class. Optional — classes named on the Students sheet are created automatically.',
    cols: [
      ['Class Name*', 'JHS 1A'], ['Level*', 'JHS'], ['Programme', ''], ['Class Teacher', 'Kwame Asante'], ['Room', 'Block B-02'],
      ['Capacity', 35], ['Subjects', 'English Language, Mathematics, Integrated Science, Social Studies'],
    ],
  },
  {
    name: 'Subjects',
    about: 'Optional. Your own subjects per level. Leave empty to use the standard GES subjects.',
    cols: [['Subject Name*', 'Mathematics'], ['Level*', 'JHS'], ['Code', 'JH02'], ['Credits (Diploma only)', '']],
  },
  {
    name: 'Students',
    about: 'One row per student, with the main parent/guardian on the same row. Brothers and sisters with the same parent phone number are linked to the same parent.',
    cols: [
      ['Admission No*', 'ABC/24/0001'], ['First Name*', 'Kofi'], ['Other Names', 'Kwame'], ['Last Name*', 'Mensah'], ['Gender', 'Male'],
      ['Date of Birth', '2012-03-14'], ['Class*', 'JHS 1A'], ['Admission Date', '2024-09-09'], ['Day or Boarder', 'Day'], ['House', 'Aggrey'],
      ['Home Address', 'East Legon, Accra'], ['Blood Group', 'O+'], ['Allergies / Medical Notes', ''], ['Nationality', 'Ghanaian'], ['Religion', 'Christian'],
      ['Previous School', ''], ['Status', 'Active'],
      ['Parent Title', 'Mrs.'], ['Parent First Name*', 'Akosua'], ['Parent Last Name*', 'Mensah'], ['Parent Relationship', 'Mother'],
      ['Parent Phone*', '0244123456'], ['Other Parent / Alt Phone', '0201234567'], ['Parent Email', 'akosua@gmail.com'], ['Parent Occupation', 'Trader'],
    ],
  },
  {
    name: 'Staff',
    about: 'Teachers and all other staff. "Teaches" lists Class - Subject pairs separated by ";".',
    cols: [
      ['Staff No', 'ST/001'], ['Title', 'Mr.'], ['First Name*', 'Kwame'], ['Last Name*', 'Asante'], ['Gender', 'Male'], ['Role*', 'Teacher'],
      ['Department', 'JHS'], ['Phone', '0244555666'], ['Email', 'kwame.asante@gmail.com'], ['Qualification', 'B.Ed'], ['Date Joined', '2020-09-01'],
      ['Basic Salary', 4500], ['Allowances', 500], ['SSNIT No', 'C012345678'], ['Bank', 'GCB Bank'], ['Account No', '1234567890'],
      ['Class Teacher Of', 'JHS 1A'], ['Teaches', 'JHS 1A - Mathematics; JHS 2A - Mathematics'], ['Status', 'Active'],
    ],
  },
  {
    name: 'Fee Balances',
    about: "Opening balances: what each student owes when you start using EduNexa. Leave Term empty for the current term.",
    cols: [['Admission No*', 'ABC/24/0001'], ['Amount Owed*', 850], ['Description', 'Arrears brought forward'], ['Term', 'Term 1, 2026/2027'], ['Due Date', '2026-11-30']],
  },
  {
    name: 'Scores',
    about: 'Past results. Class score is out of 30 and exam out of 70 — or give only a Total out of 100.',
    cols: [['Admission No*', 'ABC/24/0001'], ['Subject*', 'Mathematics'], ['Term*', 'Term 3, 2025/2026'], ['Class Score (30)', 24], ['Exam Score (70)', 58], ['Total (100)', '']],
  },
  {
    name: 'Library Books',
    about: 'Your library catalogue.',
    cols: [['Title*', 'Things Fall Apart'], ['Author', 'Chinua Achebe'], ['Category', 'Literature'], ['ISBN', '978-0-385-47454-2'], ['Copies', 3], ['Shelf', 'LIT-01'], ['Publisher', 'Heinemann'], ['Year', 1958]],
  },
  {
    name: 'Store Items',
    about: 'Uniforms, books and supplies you sell, with the quantity in stock today.',
    cols: [['Item Name*', 'School Uniform – JHS (Set)'], ['SKU', 'UNI-JHS'], ['Category', 'Uniforms'], ['Unit', 'set'], ['Selling Price', 180], ['Cost Price', 130], ['Quantity in Stock', 40], ['Reorder Level', 10]],
  },
];

const README = [
  ['EduNexa — data import template'],
  [''],
  ['How to use'],
  ['1. Fill in the sheets you need. Every sheet is optional — import just Students, or everything at once.'],
  ['2. Keep the first row (the headings) exactly as it is. Columns marked * are required.'],
  ['3. Delete the grey EXAMPLE row on each sheet (rows still starting with "EXAMPLE" are skipped anyway).'],
  ['4. In EduNexa Admin go to  Import from Excel  →  choose this file  →  check the preview  →  Import.'],
  ['5. You can import again later: existing students (same admission number), staff (same staff no, email or phone), classes,'],
  ['   books (same ISBN) and store items (same SKU) are updated, not duplicated.'],
  ['6. No internet? Import anyway — everything is saved on the device and uploaded when you are back online.'],
  [''],
  ['Allowed values'],
  ['Level', STARTER_SECTIONS.join(' / ') + '   (Creche, Nursery and KG are "Early Years"; Basic 1–6 is "Primary")'],
  ['Gender', 'Male / Female'],
  ['Day or Boarder', 'Day / Boarder'],
  ['Student / staff Status', 'Active / Graduated / Withdrawn / Suspended   ·   staff: Active / On leave / Exited'],
  ['Staff Role', 'Teacher, Head Teacher, Administrator, Accountant, Librarian, Storekeeper, Transport Officer, Canteen Manager, Hostel Manager, Support Staff, Nurse, Driver, Security, Cleaner, Cook, Matron'],
  ['Dates', 'Use an Excel date, or type YYYY-MM-DD (e.g. 2012-03-14) or DD/MM/YYYY (e.g. 14/03/2012)'],
  ['Phone numbers', 'Ghana numbers like 0244123456 or +233 24 412 3456 (a missing leading 0 is added back automatically).'],
  ['Term', 'e.g. "Term 1, 2026/2027" or "2026/2027-T1"'],
  ['Teaches (Staff)', 'Class - Subject pairs separated by ";" e.g.  JHS 1A - Mathematics; JHS 2A - Mathematics'],
  [''],
  ['After import'],
  ['Parents and students then create their own accounts in the EduNexa app with your school code and the student admission number.'],
  ['Teachers and staff do the same; their account is linked to the staff record with the same phone number or email.'],
];

/** Builds the template workbook (needs the xlsx library). */
export function buildTemplate(XLSX) {
  const wb = XLSX.utils.book_new();
  const rm = XLSX.utils.aoa_to_sheet(README);
  rm['!cols'] = [{ wch: 26 }, { wch: 120 }];
  XLSX.utils.book_append_sheet(wb, rm, 'Read me');
  SHEETS.forEach((sh) => {
    const head = sh.cols.map((c) => c[0]);
    const ex = sh.cols.map((c, i) => (i === 0 ? `EXAMPLE ${c[1]}` : c[1]));
    const ws = XLSX.utils.aoa_to_sheet([head, ex]);
    ws['!cols'] = sh.cols.map((c) => ({ wch: Math.max(12, c[0].length + 2, String(c[1]).length + 4) }));
    XLSX.utils.book_append_sheet(wb, ws, sh.name);
  });
  return wb;
}

// ---------------------------------------------------------------- helpers
const norm = (s) => String(s ?? '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '');
const str = (v) => (v == null ? '' : v instanceof Date ? ymd(v) : String(v).trim());
const num = (v) => {
  const n = Number(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const key = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const digits9 = (p) => String(p || '').replace(/\D/g, '').slice(-9);
const pad = (n, w = 2) => String(n).padStart(w, '0');
function ymd(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** Excel date, YYYY-MM-DD, DD/MM/YYYY or DD-MM-YYYY → YYYY-MM-DD ('' if blank, null if unreadable). */
export function toDate(v) {
  if (v == null || v === '') return '';
  if (v instanceof Date && !Number.isNaN(v.getTime())) return ymd(v);
  if (typeof v === 'number' && v > 20000 && v < 80000) return ymd(new Date(Math.round((v - 25569) * 864e5) + new Date().getTimezoneOffset() * 6e4));
  const s = String(v).trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  return null;
}
const phone = (v) => {
  const s = str(v).replace(/[^\d+]/g, '');
  if (/^\+?233\d{9}$/.test(s)) return `0${s.slice(-9)}`;
  if (/^\d{9}$/.test(s)) return `0${s}`;
  return s;
};
const gender = (v) => (/^f/i.test(str(v)) ? 'Female' : /^m/i.test(str(v)) ? 'Male' : '');

/** Guess the level from a level name or a class name. */
export function levelOf(v) {
  const s = key(v);
  if (!s) return null;
  const exact = STARTER_SECTIONS.find((x) => key(x) === s);
  if (exact) return exact;
  if (/creche|cr[eè]che|nursery|kg|kindergarten|early|pre-?school|playgroup/.test(s)) return 'Early Years';
  if (/jhs|junior high|basic\s*[789]\b|form [123] jhs/.test(s)) return 'JHS';
  if (/shs|senior high|form [1-4]\b|sss/.test(s)) return 'SHS';
  if (/dip|hnd|tertiary|level \d00|year [1-4]/.test(s)) return 'Diploma';
  if (/primary|basic|class [1-6]\b|p[1-6]\b|lower|upper/.test(s)) return 'Primary';
  return null;
}

/** "Term 1, 2026/2027", "2026/2027-T1", "T1 2026/2027", "First term 2026/27" → term id + name. */
export function parseTerm(v) {
  const s = str(v);
  if (!s) return null;
  let m = /^(\d{4})\/(\d{4})-T([123])$/i.exec(s);
  if (m) return { id: s.toUpperCase().replace('-t', '-T'), yr: `${m[1]}/${m[2]}`, n: Number(m[3]) };
  const n = /\b(?:term|t)\s*([123])\b/i.exec(s)?.[1] || ({ first: 1, second: 2, third: 3 })[/\b(first|second|third)\b/i.exec(s)?.[1]?.toLowerCase()];
  m = /(\d{4})\s*[/-]\s*(\d{2,4})/.exec(s);
  if (!n || !m) return null;
  const y2 = m[2].length === 2 ? `${m[1].slice(0, 2)}${m[2]}` : m[2];
  return { id: `${m[1]}/${y2}-T${n}`, yr: `${m[1]}/${y2}`, n: Number(n) };
}
function termRecord(t) {
  const y = Number(t.yr.slice(0, 4));
  const dates = { 1: [`${y}-09-08`, `${y}-12-11`], 2: [`${y + 1}-01-12`, `${y + 1}-04-02`], 3: [`${y + 1}-04-27`, `${y + 1}-07-23`] }[t.n];
  return { id: t.id, name: `Term ${t.n}, ${t.yr}`, start: dates[0], end: dates[1] };
}

/** Reads a sheet into objects keyed by normalised heading; skips blank and EXAMPLE rows. */
function readSheet(XLSX, ws) {
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
  if (!aoa.length) return [];
  const heads = aoa[0].map(norm);
  const out = [];
  aoa.slice(1).forEach((r, i) => {
    if (!r.some((c) => str(c) !== '')) return;
    if (/^example/i.test(str(r[0]))) return;
    const o = { _row: i + 2 };
    heads.forEach((h, c) => h && (o[h] = r[c]));
    out.push(o);
  });
  return out;
}
const findSheet = (wb, name) => wb.SheetNames.find((n) => norm(n) === norm(name));

// ---------------------------------------------------------------- plan
/**
 * Works out everything a workbook would add or change, without changing anything.
 * Returns { sheets: [{ name, add, update, skipped, errors: [{row, msg}] }], writes: { col: [records] }, settings, total }.
 */
export function planImport(XLSX, wb, db) {
  const report = {};
  const R = (name) => (report[name] ||= { name, add: 0, update: 0, errors: [] });
  const err = (sheet, row, msg) => R(sheet).errors.push({ row, msg });
  const writes = {};
  const put = (col, rec, isNew, sheet) => {
    (writes[col] ||= new Map()).set(rec.id, { ...(writes[col].get(rec.id) || {}), ...rec });
    if (sheet) R(sheet)[isNew ? 'add' : 'update']++;
    return rec;
  };
  const rows = (name) => {
    const n = findSheet(wb, name);
    return n ? readSheet(XLSX, wb.Sheets[n]) : [];
  };

  // Working copies so later sheets see what earlier sheets create.
  const subjects = [...db.subjects];
  const classes = [...db.classes];
  const staff = [...db.staff];
  const parents = [...db.parents];
  const students = [...db.students];
  const terms = [...db.terms];
  const allocations = [...db.allocations];

  const findSubject = (name, level) => {
    const k = key(name);
    return subjects.find((s) => key(s.name) === k && (!level || s.section === level)) || subjects.find((s) => key(s.code) === k && (!level || s.section === level));
  };
  const ensureSubject = (name, level, sheet) => {
    let s = findSubject(name, level);
    if (!s) {
      const n = subjects.filter((x) => x.section === level).length + 1;
      s = { id: uid('sub'), name: str(name), code: `${level.slice(0, 2).toUpperCase()}${pad(n)}`, section: level, credits: level === 'Diploma' ? 3 : null };
      subjects.push(s);
      put('subjects', s, true, sheet);
    }
    return s;
  };
  const defaultSubjects = (level) => {
    const have = subjects.filter((s) => s.section === level);
    if (have.length) return have.map((s) => s.id);
    return (SUBJECT_DEFS[level] || []).map((n) => ensureSubject(n, level, null).id);
  };
  const findClass = (name) => classes.find((c) => key(c.name) === key(name));
  const ensureClass = (name, level, sheet) => {
    let c = findClass(name);
    if (c) return c;
    const sec = level || levelOf(name);
    if (!sec) return null;
    c = { id: uid('cls'), name: str(name), section: sec, programme: '', capacity: sec === 'Early Years' ? 20 : 35, room: '', classTeacherId: null, subjectIds: defaultSubjects(sec), order: classes.length };
    classes.push(c);
    put('classes', c, true, sheet);
    return c;
  };
  const findStaff = (v) => {
    const k = key(v);
    if (!k) return null;
    return staff.find((s) => key(s.staffNo) === k) || staff.find((s) => key([s.firstName, s.lastName].join(' ')) === k) || staff.find((s) => key([s.title, s.firstName, s.lastName].join(' ')) === k) || staff.find((s) => key(s.email) === k);
  };
  // Houses named on student rows join the school's house list.
  const houses = [...(db.houses || [])];
  const ensureHouse = (name) => {
    const n = str(name);
    if (!n) return '';
    let h = houses.find((x) => key(x.name) === key(n));
    if (!h) {
      h = { id: `hse_${houses.length + 1}_${key(n).replace(/[^a-z0-9]/g, '').slice(0, 12)}`, name: n, colour: ['#dc2626', '#16a34a', '#2563eb', '#ca8a04', '#7c3aed', '#ea580c'][houses.length % 6], masterId: null };
      houses.push(h);
      put('houses', h, true, null);
    }
    return h.name;
  };
  const ensureTerm = (v) => {
    const t = parseTerm(v);
    if (!t) return null;
    let rec = terms.find((x) => x.id === t.id) || terms.find((x) => key(x.name) === key(v));
    if (!rec) {
      rec = termRecord(t);
      terms.push(rec);
      put('terms', rec, true, null);
    }
    return rec;
  };

  // 1. Subjects
  rows('Subjects').forEach((r) => {
    const name = str(r.subjectname);
    const level = levelOf(r.level);
    if (!name) return err('Subjects', r._row, 'Subject Name is empty');
    if (!level) return err('Subjects', r._row, `Unknown level "${str(r.level)}"`);
    const ex = findSubject(name, level);
    const rec = { ...(ex || { id: uid('sub'), section: level }), name, code: str(r.code) || ex?.code || `${level.slice(0, 2).toUpperCase()}${pad(subjects.filter((x) => x.section === level).length + 1)}`, credits: level === 'Diploma' ? num(r.credits) || 3 : null };
    if (!ex) subjects.push(rec);
    else Object.assign(ex, rec);
    put('subjects', rec, !ex, 'Subjects');
  });

  // 2. Classes (class teacher resolved after Staff)
  const classTeacherLater = [];
  rows('Classes').forEach((r) => {
    const name = str(r.classname);
    if (!name) return err('Classes', r._row, 'Class Name is empty');
    const level = levelOf(r.level) || levelOf(name);
    if (!level) return err('Classes', r._row, `Unknown level "${str(r.level)}" — use ${STARTER_SECTIONS.join(', ')}`);
    const ex = findClass(name);
    const subs = str(r.subjects) ? str(r.subjects).split(/[,;\n]/).map((x) => x.trim()).filter(Boolean).map((n) => ensureSubject(n, level, 'Classes').id) : ex?.subjectIds || defaultSubjects(level);
    const rec = { ...(ex || { id: uid('cls'), classTeacherId: null, order: classes.length }), name, section: level, programme: str(r.programme) || ex?.programme || '', room: str(r.room) || ex?.room || '', capacity: num(r.capacity) || ex?.capacity || (level === 'Early Years' ? 20 : 35), subjectIds: subs };
    if (!ex) classes.push(rec);
    else Object.assign(ex, rec);
    put('classes', rec, !ex, 'Classes');
    if (str(r.classteacher)) classTeacherLater.push([rec, str(r.classteacher), r._row]);
  });

  // 3. Staff
  rows('Staff').forEach((r) => {
    const first = str(r.firstname);
    const last = str(r.lastname);
    if (!first || !last) return err('Staff', r._row, 'First Name and Last Name are required');
    const role = str(r.role);
    if (!role) return err('Staff', r._row, 'Role is empty');
    const ph = phone(r.phone);
    const em = str(r.email).toLowerCase();
    const no = str(r.staffno);
    const ex = (no && staff.find((s) => key(s.staffNo) === key(no))) || (em && staff.find((s) => key(s.email) === em)) || (ph && digits9(ph).length === 9 && staff.find((s) => digits9(s.phone) === digits9(ph)));
    const joined = toDate(r.datejoined);
    if (joined === null) err('Staff', r._row, `Date Joined "${str(r.datejoined)}" is not a date — left blank`);
    const rec = {
      ...(ex || { id: uid('stf'), staffNo: no || `${schoolPrefix(db.settings)}/ST/${pad(staff.length + 1, 3)}`, status: 'Active' }),
      ...(no ? { staffNo: no } : {}),
      title: str(r.title) || ex?.title || '', firstName: first, lastName: last, gender: gender(r.gender) || ex?.gender || '', role,
      department: str(r.department) || ex?.department || '', phone: ph || ex?.phone || '', email: em || ex?.email || '',
      qualification: str(r.qualification) || ex?.qualification || '', dateJoined: joined || ex?.dateJoined || '',
      salary: r.basicsalary !== '' && r.basicsalary != null ? num(r.basicsalary) : ex?.salary || 0,
      allowances: r.allowances !== '' && r.allowances != null ? num(r.allowances) : ex?.allowances || 0,
      ssnitNo: str(r.ssnitno) || ex?.ssnitNo || '', bank: str(r.bank) || ex?.bank || '', accountNo: str(r.accountno) || ex?.accountNo || '',
      status: str(r.status) || ex?.status || 'Active',
    };
    if (!ex) staff.push(rec);
    else Object.assign(ex, rec);
    put('staff', rec, !ex, 'Staff');
    if (str(r.classteacherof)) {
      const c = ensureClass(str(r.classteacherof), null, 'Classes');
      if (c) put('classes', Object.assign(c, { classTeacherId: rec.id }), false, null);
      else err('Staff', r._row, `Class "${str(r.classteacherof)}" not found and its level could not be guessed`);
    }
    str(r.teaches).split(/[;\n]/).map((x) => x.trim()).filter(Boolean).forEach((pair) => {
      const m = /^(.+?)\s*[-–:]\s*(.+)$/.exec(pair);
      if (!m) return err('Staff', r._row, `"${pair}" in Teaches should look like "JHS 1A - Mathematics"`);
      const c = ensureClass(m[1], null, 'Classes');
      if (!c) return err('Staff', r._row, `Class "${m[1]}" not found`);
      const sub = ensureSubject(m[2], c.section, 'Subjects');
      if (!c.subjectIds.includes(sub.id)) put('classes', Object.assign(c, { subjectIds: [...c.subjectIds, sub.id] }), false, null);
      const id = `alc_${c.id}_${sub.id}`;
      const a = { id, classId: c.id, subjectId: sub.id, teacherId: rec.id };
      const i = allocations.findIndex((x) => x.id === id);
      if (i >= 0) allocations[i] = a;
      else allocations.push(a);
      put('allocations', a, true, null);
    });
  });
  classTeacherLater.forEach(([c, who, row]) => {
    const s = findStaff(who);
    if (!s) return err('Classes', row, `Class teacher "${who}" is not on the Staff sheet or in EduNexa`);
    put('classes', Object.assign(c, { classTeacherId: s.id }), false, null);
  });

  // 4. Students + parents
  const seenAdm = new Set();
  rows('Students').forEach((r) => {
    const adm = str(r.admissionno).toUpperCase();
    const first = str(r.firstname);
    const last = str(r.lastname);
    if (!adm) return err('Students', r._row, 'Admission No is empty');
    if (seenAdm.has(adm)) return err('Students', r._row, `Admission No ${adm} appears twice in the file — only the first row was used`);
    seenAdm.add(adm);
    if (!first || !last) return err('Students', r._row, 'First Name and Last Name are required');
    const clsName = str(r.class);
    if (!clsName) return err('Students', r._row, 'Class is empty');
    const cls = ensureClass(clsName, null, 'Classes');
    if (!cls) return err('Students', r._row, `Class "${clsName}" is new and its level could not be guessed — add it to the Classes sheet with a Level`);
    const dob = toDate(r.dateofbirth);
    const admDate = toDate(r.admissiondate);
    if (dob === null) err('Students', r._row, `Date of Birth "${str(r.dateofbirth)}" is not a date — left blank`);
    const ex = students.find((s) => key(s.admissionNo) === key(adm));

    // Parent: matched by phone (siblings share one parent record), else created.
    let parentId = ex?.parentId || null;
    const pPhone = phone(r.parentphone);
    const pFirst = str(r.parentfirstname);
    const pLast = str(r.parentlastname);
    if (pPhone || pFirst) {
      let p = (pPhone && digits9(pPhone).length === 9 && parents.find((x) => digits9(x.phone) === digits9(pPhone))) || (parentId && parents.find((x) => x.id === parentId));
      const isNew = !p;
      if (isNew && !pPhone) err('Students', r._row, 'Parent Phone is empty — parent saved without a phone (they need it to receive SMS)');
      const prec = {
        ...(p || { id: uid('par'), address: str(r.homeaddress) }),
        title: str(r.parenttitle) || p?.title || '', firstName: pFirst || p?.firstName || '', lastName: pLast || p?.lastName || last,
        gender: /mother|mum|aunt|grand ?mother|sister|female/i.test(str(r.parentrelationship)) ? 'Female' : /father|dad|uncle|grand ?father|brother|male/i.test(str(r.parentrelationship)) ? 'Male' : p?.gender || '',
        relation: str(r.parentrelationship) || p?.relation || 'Parent', phone: pPhone || p?.phone || '', altPhone: phone(r.otherparentaltphone) || p?.altPhone || '',
        email: str(r.parentemail).toLowerCase() || p?.email || '', occupation: str(r.parentoccupation) || p?.occupation || '',
      };
      if (p) Object.assign(p, prec);
      else parents.push((p = prec));
      put('parents', prec, isNew, null);
      if (isNew) R('Parents').add++;
      parentId = prec.id;
    }
    const boarding = /board/i.test(str(r.dayorboarder)) ? 'Boarder' : str(r.dayorboarder) ? 'Day' : ex?.boarding || 'Day';
    const rec = {
      ...(ex || { id: uid('stu'), dormId: null, busRouteId: null }),
      admissionNo: adm, firstName: first, otherNames: str(r.othernames), lastName: last, gender: gender(r.gender) || ex?.gender || '',
      dob: dob || ex?.dob || '', classId: cls.id, parentId, house: ensureHouse(r.house) || ex?.house || '', boarding,
      status: str(r.status) || ex?.status || 'Active', admissionDate: admDate || ex?.admissionDate || '', address: str(r.homeaddress) || ex?.address || '',
      bloodGroup: str(r.bloodgroup) || ex?.bloodGroup || '', allergies: str(r.allergiesmedicalnotes) || ex?.allergies || '', medicalNotes: ex?.medicalNotes || '',
      nationality: str(r.nationality) || ex?.nationality || 'Ghanaian', religion: str(r.religion) || ex?.religion || '', previousSchool: str(r.previousschool) || ex?.previousSchool || '',
    };
    if (!ex) students.push(rec);
    else Object.assign(ex, rec);
    put('students', rec, !ex, 'Students');
  });
  const studentByAdm = (v) => students.find((s) => key(s.admissionNo) === key(v));

  // 5. Fee balances → one opening-balance invoice per student per term
  const curTerm = terms.find((t) => t.id === db.settings.currentTerm) || terms[terms.length - 1];
  rows('Fee Balances').forEach((r) => {
    const s = studentByAdm(r.admissionno);
    if (!s) return err('Fee Balances', r._row, `No student with admission number "${str(r.admissionno)}"`);
    const amt = num(r.amountowed);
    if (amt <= 0) return err('Fee Balances', r._row, 'Amount Owed must be more than 0');
    const term = str(r.term) ? ensureTerm(r.term) : curTerm;
    if (!term) return err('Fee Balances', r._row, str(r.term) ? `Term "${str(r.term)}" not understood — use e.g. "Term 1, 2026/2027"` : 'No current term set — create terms first (Settings → Academic year) or fill the Term column');
    const due = toDate(r.duedate);
    const id = `inv_ob_${s.id}_${term.id}`.replace(/[^a-zA-Z0-9_]/g, '_');
    const isNew = !db.invoices.some((i) => i.id === id);
    put('invoices', { id, invoiceNo: `OB-${s.admissionNo}`, studentId: s.id, termId: term.id, date: ymd(new Date()), dueDate: due || term.end, items: [{ name: str(r.description) || 'Opening balance (arrears)', amount: amt }], discount: 0, discountReason: '', total: amt }, isNew, 'Fee Balances');
  });

  // 6. Scores
  rows('Scores').forEach((r) => {
    const s = studentByAdm(r.admissionno);
    if (!s) return err('Scores', r._row, `No student with admission number "${str(r.admissionno)}"`);
    const term = ensureTerm(r.term);
    if (!term) return err('Scores', r._row, `Term "${str(r.term)}" not understood — use e.g. "Term 3, 2025/2026"`);
    const cls = classes.find((c) => c.id === s.classId);
    const sub = findSubject(r.subject, cls?.section) || findSubject(r.subject);
    if (!sub) return err('Scores', r._row, `Subject "${str(r.subject)}" not found — add it to the Subjects sheet`);
    let cs = num(r.classscore);
    let es = num(r.examscore);
    const tot = str(r.total) !== '' ? num(r.total) : null;
    if (tot != null && !str(r.classscore) && !str(r.examscore)) {
      cs = Math.round(tot * 0.3 * 10) / 10;
      es = Math.round((tot - cs) * 10) / 10;
    }
    if (cs < 0 || cs > 30 || es < 0 || es > 70) return err('Scores', r._row, 'Class score must be 0–30 and exam score 0–70');
    const id = `scr_${s.id}_${sub.id}_${term.id}`;
    put('scores', { id, studentId: s.id, subjectId: sub.id, classId: s.classId, termId: term.id, classScore: cs, examScore: es }, !db.scores.some((x) => x.id === id), 'Scores');
  });

  // 7. Library
  rows('Library Books').forEach((r) => {
    const title = str(r.title);
    if (!title) return err('Library Books', r._row, 'Title is empty');
    const isbn = str(r.isbn);
    const ex = (isbn && db.books.find((b) => key(b.isbn) === key(isbn))) || db.books.find((b) => key(b.title) === key(title) && key(b.author) === key(r.author));
    put('books', { ...(ex || { id: uid('bok') }), title, author: str(r.author) || ex?.author || '', category: str(r.category) || ex?.category || 'General', isbn: isbn || ex?.isbn || '', copies: num(r.copies) || ex?.copies || 1, shelf: str(r.shelf) || ex?.shelf || '', publisher: str(r.publisher) || ex?.publisher || '', year: num(r.year) || ex?.year || '' }, !ex, 'Library Books');
  });

  // 8. Store
  rows('Store Items').forEach((r) => {
    const name = str(r.itemname);
    if (!name) return err('Store Items', r._row, 'Item Name is empty');
    const sku = str(r.sku);
    const ex = (sku && db.storeItems.find((x) => key(x.sku) === key(sku))) || db.storeItems.find((x) => key(x.name) === key(name));
    put('storeItems', { ...(ex || { id: uid('itm'), supplierId: null }), name, sku: sku || ex?.sku || `SKU-${pad(db.storeItems.length + 1, 4)}`, category: str(r.category) || ex?.category || 'General', unit: str(r.unit) || ex?.unit || 'pcs', price: num(r.sellingprice) || ex?.price || 0, cost: num(r.costprice) || ex?.cost || 0, stock: str(r.quantityinstock) !== '' ? num(r.quantityinstock) : ex?.stock || 0, reorderLevel: num(r.reorderlevel) || ex?.reorderLevel || 5 }, !ex, 'Store Items');
  });

  const out = Object.fromEntries(Object.entries(writes).map(([c, m]) => [c, [...m.values()]]));
  const order = ['Classes', 'Subjects', 'Students', 'Parents', 'Staff', 'Fee Balances', 'Scores', 'Library Books', 'Store Items'];
  const sheets = order.filter((n) => report[n]).map((n) => report[n]);
  const today = new Date().toISOString().slice(0, 10);
  const cur = [...terms].sort((a, b) => a.start.localeCompare(b.start)).find((t) => today <= t.end) || terms[terms.length - 1];
  const settings = !db.settings.currentTerm && cur ? { currentTerm: cur.id, academicYear: cur.id.slice(0, 9) } : null;
  return { sheets, writes: out, settings, total: Object.values(out).reduce((a, l) => a + l.length, 0), found: wb.SheetNames };
}

/** Order matters: parents and classes before students, students before invoices and scores. */
export const WRITE_ORDER = ['terms', 'subjects', 'classes', 'houses', 'staff', 'allocations', 'parents', 'students', 'invoices', 'scores', 'books', 'storeItems'];
