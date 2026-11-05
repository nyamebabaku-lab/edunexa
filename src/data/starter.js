// Starter structure for a brand-new school in the live apps: Ghana GES classes, subjects, terms and periods.
// No people, fees or records — the school fills those in. Offered once to the Owner/Admin of an empty school.

export const STARTER_SECTIONS = ['Early Years', 'Primary', 'JHS', 'SHS', 'Diploma'];

export const SUBJECT_DEFS = {
  'Early Years': ['Literacy', 'Numeracy', 'Phonics', 'Creative Arts', 'Our World Our People'],
  Primary: ['English Language', 'Mathematics', 'Science', 'Our World Our People', 'Ghanaian Language (Twi)', 'Creative Arts', 'Religious & Moral Education', 'Computing', 'French'],
  JHS: ['English Language', 'Mathematics', 'Integrated Science', 'Social Studies', 'Career Technology', 'Computing', 'Religious & Moral Education', 'Ghanaian Language (Twi)', 'French', 'Creative Arts & Design'],
  SHS: ['Core English', 'Core Mathematics', 'Integrated Science', 'Social Studies', 'Physics', 'Chemistry', 'Biology', 'Elective Mathematics', 'Literature in English', 'History', 'Government', 'Economics', 'Financial Accounting', 'Business Management', 'Cost Accounting'],
  Diploma: ['Principles of Management', 'Financial Accounting I', 'Business Communication', 'Marketing', 'Business Law', 'Programming Fundamentals', 'Database Systems', 'Computer Networking', 'Web Development', 'Computer Architecture'],
};
const SHS_CORE = ['Core English', 'Core Mathematics', 'Integrated Science', 'Social Studies'];
const SHS_PROG = {
  'General Science': ['Physics', 'Chemistry', 'Biology', 'Elective Mathematics'],
  'General Arts': ['Literature in English', 'History', 'Government', 'Economics'],
  Business: ['Financial Accounting', 'Business Management', 'Cost Accounting', 'Economics'],
};
const DIP_PROG = {
  'Business Administration': ['Principles of Management', 'Financial Accounting I', 'Business Communication', 'Marketing', 'Business Law'],
  'Information Technology': ['Programming Fundamentals', 'Database Systems', 'Computer Networking', 'Web Development', 'Computer Architecture'],
};

const CLASS_DEFS = [
  ['Creche', 'Early Years'], ['Nursery 1', 'Early Years'], ['Nursery 2', 'Early Years'], ['KG 1', 'Early Years'], ['KG 2', 'Early Years'],
  ['Basic 1', 'Primary'], ['Basic 2', 'Primary'], ['Basic 3', 'Primary'], ['Basic 4', 'Primary'], ['Basic 5', 'Primary'], ['Basic 6', 'Primary'],
  ['JHS 1', 'JHS'], ['JHS 2', 'JHS'], ['JHS 3', 'JHS'],
  ['SHS 1 Science', 'SHS', 'General Science'], ['SHS 1 Arts', 'SHS', 'General Arts'], ['SHS 1 Business', 'SHS', 'Business'],
  ['SHS 2 Science', 'SHS', 'General Science'], ['SHS 2 Arts', 'SHS', 'General Arts'],
  ['SHS 3 Science', 'SHS', 'General Science'], ['SHS 3 Business', 'SHS', 'Business'],
  ['Dip. Business Admin Y1', 'Diploma', 'Business Administration'], ['Dip. IT Y1', 'Diploma', 'Information Technology'], ['Dip. IT Y2', 'Diploma', 'Information Technology'],
];

export const STARTER_PERIODS = [
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

const FEE_TEMPLATE = [
  { id: 'fee_ey', section: 'Early Years', items: [{ name: 'Tuition', amount: 1800 }, { name: 'Feeding', amount: 950 }, { name: 'Learning Materials', amount: 250 }, { name: 'PTA Dues', amount: 100 }] },
  { id: 'fee_pr', section: 'Primary', items: [{ name: 'Tuition', amount: 2200 }, { name: 'Feeding', amount: 950 }, { name: 'ICT', amount: 150 }, { name: 'Sports & Culture', amount: 80 }, { name: 'PTA Dues', amount: 100 }] },
  { id: 'fee_jh', section: 'JHS', items: [{ name: 'Tuition', amount: 2650 }, { name: 'Feeding', amount: 950 }, { name: 'ICT', amount: 180 }, { name: 'Mock Exams', amount: 120 }, { name: 'PTA Dues', amount: 100 }] },
  { id: 'fee_sh', section: 'SHS', items: [{ name: 'Tuition', amount: 3200 }, { name: 'Science Lab / Practicals', amount: 300 }, { name: 'ICT', amount: 180 }, { name: 'Sports & Culture', amount: 100 }, { name: 'PTA Dues', amount: 100 }] },
  { id: 'fee_dp', section: 'Diploma', items: [{ name: 'Tuition (Semester)', amount: 4500 }, { name: 'Registration', amount: 350 }, { name: 'Lab / Studio', amount: 300 }, { name: 'Student Union', amount: 80 }] },
];

const pad = (n, w = 2) => String(n).padStart(w, '0');

/** Academic year (Ghana: September–July) and its three terms, worked out from today's date. */
export function starterTerms(today = new Date()) {
  const y = today.getMonth() >= 7 ? today.getFullYear() : today.getFullYear() - 1;
  const yr = `${y}/${y + 1}`;
  const terms = [
    { id: `${yr}-T1`, name: `Term 1, ${yr}`, start: `${y}-09-08`, end: `${y}-12-11` },
    { id: `${yr}-T2`, name: `Term 2, ${yr}`, start: `${y + 1}-01-12`, end: `${y + 1}-04-02` },
    { id: `${yr}-T3`, name: `Term 3, ${yr}`, start: `${y + 1}-04-27`, end: `${y + 1}-07-23` },
  ];
  const iso = today.toISOString().slice(0, 10);
  const current = terms.find((t) => iso <= t.end) || terms[2];
  return { terms, academicYear: yr, currentTerm: current.id };
}

/** Builds the starter records for the chosen sections. */
export function buildStarter(sections = STARTER_SECTIONS) {
  const subjects = [];
  sections.forEach((sec) =>
    SUBJECT_DEFS[sec].forEach((name, i) =>
      subjects.push({
        id: `sub_${sec.slice(0, 2).toLowerCase()}${pad(i + 1)}`,
        name,
        code: `${sec.slice(0, 2).toUpperCase()}${pad(i + 1)}`,
        section: sec,
        credits: sec === 'Diploma' ? (i % 3 === 0 ? 4 : 3) : null,
      }),
    ),
  );
  const subBy = (sec, name) => subjects.find((s) => s.section === sec && s.name === name)?.id;
  const secSubs = (sec) => subjects.filter((s) => s.section === sec).map((s) => s.id);
  const classes = CLASS_DEFS.filter(([, sec]) => sections.includes(sec)).map(([name, section, programme], i) => {
    let subjectIds = secSubs(section);
    if (section === 'SHS') subjectIds = [...SHS_CORE, ...SHS_PROG[programme]].map((n) => subBy('SHS', n));
    if (section === 'Diploma') subjectIds = DIP_PROG[programme].map((n) => subBy('Diploma', n));
    return { id: `cls_${pad(i + 1)}`, name, section, programme: programme || '', capacity: section === 'Early Years' ? 20 : 35, room: '', classTeacherId: null, subjectIds, order: i };
  });
  const feeStructures = FEE_TEMPLATE.filter((f) => sections.includes(f.section)).map((f) => ({ ...f, items: f.items.map((it) => ({ ...it, amount: 0 })) }));
  const { terms, academicYear, currentTerm } = starterTerms();
  return {
    subjects,
    classes,
    periods: STARTER_PERIODS,
    terms,
    feeStructures,
    expenseCategories: ['Salaries', 'Utilities', 'Maintenance', 'Teaching Materials', 'Feeding', 'Transport & Fuel', 'Events', 'Administration', 'ICT'],
    settings: { academicYear, currentTerm },
  };
}
