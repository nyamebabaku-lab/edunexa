import { totalScore, gradeFor, rank, aggregate, gpa } from './grading';

/**
 * Computes a class's results for a term: per-subject totals, grades and positions,
 * plus overall average, position, BECE aggregate (Basic/JHS) or GPA (Diploma).
 */
export function classResults(db, classId, termId) {
  const cls = db.classes.find((c) => c.id === classId);
  if (!cls) return { cls: null, rows: [], subjectStats: {} };
  const students = db.students.filter((s) => s.classId === classId && s.status === 'Active');
  const scores = db.scores.filter((s) => s.classId === classId && s.termId === termId);
  const credits = Object.fromEntries(db.subjects.map((s) => [s.id, s.credits || 3]));

  const subjectPos = {};
  const subjectStats = {};
  cls.subjectIds.forEach((sid) => {
    const recs = scores.filter((r) => r.subjectId === sid);
    const pos = rank(recs, totalScore);
    subjectPos[sid] = Object.fromEntries(recs.map((r) => [r.studentId, pos.get(r)]));
    const totals = recs.map(totalScore);
    subjectStats[sid] = {
      avg: totals.length ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length) : 0,
      high: totals.length ? Math.max(...totals) : 0,
      low: totals.length ? Math.min(...totals) : 0,
    };
  });

  const rows = students.map((st) => {
    const recs = scores.filter((r) => r.studentId === st.id);
    const subjects = cls.subjectIds.map((sid) => {
      const r = recs.find((x) => x.subjectId === sid);
      const total = r ? totalScore(r) : null;
      const g = total == null ? null : gradeFor(total, cls.section);
      return { subjectId: sid, classScore: r?.classScore ?? null, examScore: r?.examScore ?? null, total, grade: g?.grade, remark: g?.remark, position: subjectPos[sid][st.id] };
    });
    const totals = subjects.filter((s) => s.total != null).map((s) => s.total);
    const sumTotal = totals.reduce((a, b) => a + b, 0);
    return {
      student: st,
      subjects,
      total: sumTotal,
      average: totals.length ? Math.round((sumTotal / totals.length) * 10) / 10 : 0,
      aggregate: aggregate(totals, cls.section),
      gpa: cls.section === 'Diploma' ? gpa(recs, cls.section, credits) : null,
      complete: totals.length === cls.subjectIds.length,
    };
  });
  const pos = rank(rows, (r) => r.average);
  rows.forEach((r) => (r.position = pos.get(r)));
  rows.sort((a, b) => a.position - b.position);
  return { cls, rows, subjectStats };
}

export function autoRemark(avg) {
  if (avg >= 80) return 'An outstanding performance. Keep it up!';
  if (avg >= 70) return 'Very good work this term. Aim even higher.';
  if (avg >= 60) return 'Good effort. With more focus you can excel.';
  if (avg >= 50) return 'Fair performance. More effort is needed in weaker subjects.';
  if (avg >= 40) return 'Below expectation. Needs extra support and practice.';
  return 'Weak performance. Parent conference recommended.';
}
