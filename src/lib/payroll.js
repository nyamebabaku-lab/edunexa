// Ghana payroll rules (monthly): SSNIT Tier 1/2 employee 5.5%, employer 13%; GRA PAYE bands.
export const SSNIT_EMPLOYEE = 0.055;
export const SSNIT_EMPLOYER = 0.13;

const PAYE_BANDS = [
  [490, 0],
  [110, 0.05],
  [130, 0.1],
  [3166.67, 0.175],
  [16000, 0.25],
  [30520, 0.3],
  [Infinity, 0.35],
];

export function paye(taxable) {
  let rest = Math.max(0, taxable);
  let tax = 0;
  for (const [width, rate] of PAYE_BANDS) {
    const chunk = Math.min(rest, width);
    tax += chunk * rate;
    rest -= chunk;
    if (rest <= 0) break;
  }
  return Math.round(tax * 100) / 100;
}

export function payslip(staff) {
  const basic = Number(staff.salary) || 0;
  const allowances = Number(staff.allowances) || 0;
  const ssnit = Math.round(basic * SSNIT_EMPLOYEE * 100) / 100;
  const tax = paye(basic + allowances - ssnit);
  const gross = basic + allowances;
  return {
    staffId: staff.id,
    basic,
    allowances,
    gross,
    ssnit,
    employerSsnit: Math.round(basic * SSNIT_EMPLOYER * 100) / 100,
    paye: tax,
    net: Math.round((gross - ssnit - tax) * 100) / 100,
  };
}
