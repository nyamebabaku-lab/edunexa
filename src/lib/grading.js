// Grading engines for each school section (Ghana).

export const SCALES = {
  early: {
    name: 'Early Years (Descriptive)',
    bands: [
      { min: 80, grade: 'EX', remark: 'Exceeding expectation' },
      { min: 65, grade: 'ME', remark: 'Meeting expectation' },
      { min: 50, grade: 'AP', remark: 'Approaching expectation' },
      { min: 0, grade: 'BE', remark: 'Beginning' },
    ],
  },
  basic: {
    name: 'GES Basic / BECE (1–9)',
    bands: [
      { min: 80, grade: '1', remark: 'Highest' },
      { min: 70, grade: '2', remark: 'Higher' },
      { min: 65, grade: '3', remark: 'High' },
      { min: 60, grade: '4', remark: 'High Average' },
      { min: 55, grade: '5', remark: 'Average' },
      { min: 50, grade: '6', remark: 'Low Average' },
      { min: 45, grade: '7', remark: 'Low' },
      { min: 40, grade: '8', remark: 'Lower' },
      { min: 0, grade: '9', remark: 'Lowest' },
    ],
  },
  shs: {
    name: 'WASSCE (A1–F9)',
    bands: [
      { min: 75, grade: 'A1', remark: 'Excellent' },
      { min: 70, grade: 'B2', remark: 'Very Good' },
      { min: 65, grade: 'B3', remark: 'Good' },
      { min: 60, grade: 'C4', remark: 'Credit' },
      { min: 55, grade: 'C5', remark: 'Credit' },
      { min: 50, grade: 'C6', remark: 'Credit' },
      { min: 45, grade: 'D7', remark: 'Pass' },
      { min: 40, grade: 'E8', remark: 'Pass' },
      { min: 0, grade: 'F9', remark: 'Fail' },
    ],
  },
  diploma: {
    name: 'Diploma GPA (4.0)',
    bands: [
      { min: 80, grade: 'A', point: 4.0, remark: 'Excellent' },
      { min: 75, grade: 'B+', point: 3.5, remark: 'Very Good' },
      { min: 70, grade: 'B', point: 3.0, remark: 'Good' },
      { min: 65, grade: 'C+', point: 2.5, remark: 'Above Average' },
      { min: 60, grade: 'C', point: 2.0, remark: 'Average' },
      { min: 55, grade: 'D+', point: 1.5, remark: 'Below Average' },
      { min: 50, grade: 'D', point: 1.0, remark: 'Pass' },
      { min: 0, grade: 'F', point: 0, remark: 'Fail' },
    ],
  },
};

export const SECTION_SCALE = {
  'Early Years': 'early',
  Primary: 'basic',
  JHS: 'basic',
  SHS: 'shs',
  Diploma: 'diploma',
};

export function gradeFor(score, section) {
  const scale = SCALES[SECTION_SCALE[section] || 'basic'];
  const s = Number(score) || 0;
  return scale.bands.find((b) => s >= b.min) || scale.bands[scale.bands.length - 1];
}

export const CLASS_SCORE_MAX = 30;
export const EXAM_SCORE_MAX = 70;

export const totalScore = (rec) => (Number(rec?.classScore) || 0) + (Number(rec?.examScore) || 0);

export function gradeTone(score) {
  if (score >= 70) return 'green';
  if (score >= 50) return 'blue';
  if (score >= 40) return 'amber';
  return 'red';
}

/** Rank items by a numeric key, giving ties the same position. */
export function rank(items, key) {
  const sorted = [...items].sort((a, b) => key(b) - key(a));
  const pos = new Map();
  sorted.forEach((it, i) => {
    const prev = sorted[i - 1];
    pos.set(it, prev && key(prev) === key(it) ? pos.get(prev) : i + 1);
  });
  return pos;
}

/** BECE-style aggregate: sum of the best six grade points (lower is better). */
export function aggregate(totals, section) {
  if (section !== 'JHS' && section !== 'Primary') return null;
  const pts = totals.map((t) => Number(gradeFor(t, section).grade)).sort((a, b) => a - b);
  return pts.slice(0, 6).reduce((a, b) => a + b, 0);
}

export function gpa(records, section, credits = {}) {
  let pts = 0;
  let cr = 0;
  records.forEach((r) => {
    const c = credits[r.subjectId] || 3;
    pts += (gradeFor(totalScore(r), section).point ?? 0) * c;
    cr += c;
  });
  return cr ? (pts / cr).toFixed(2) : '0.00';
}
