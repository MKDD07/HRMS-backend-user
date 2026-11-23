export const structureDefaults = (year, month) => ({ gross: 0, basicPercent: 50, hraPercent: 40, daPercent: 0, conveyancePercent: 0, medicalPercent: 0, pfEmployeePercent: 12, pfEmployerPercent: 12, pfCeiling: Number(year) > 2026 || (Number(year) === 2026 && month >= 8) ? 25000 : 15000, pfCovered: true, pfFullWages: false, esiCovered: false, esiEmployeePercent: 0.75, esiEmployerPercent: 3.25, gratuityPercent: 15 / 26 / 12 * 100, statutoryWage: 0, esiWage: 0, professionalTax: 0, tds: 0, lwf: 0 });
export function calculateIndiaStructure(input) {
  const p = { ...input };
  for (const [key, value] of Object.entries(p)) {
    if (typeof value === 'boolean') continue;
    p[key] = Number(value);
    if (!Number.isFinite(p[key]) || p[key] < 0 || p[key] > (key.endsWith('Percent') ? 100 : 1e9)) throw new Error('Enter valid non-negative amounts and percentages between 0 and 100.');
  }
  const round = n => Math.round(n * 100) / 100;
  const basic = round(p.gross * p.basicPercent / 100), da = round(basic * p.daPercent / 100);
  const hra = round(basic * p.hraPercent / 100), conveyance = round(p.gross * p.conveyancePercent / 100), medical = round(p.gross * p.medicalPercent / 100);
  const special = round(p.gross - basic - da - hra - conveyance - medical);
  if (special < 0) throw new Error('Earning percentages exceed monthly gross. Reduce the percentages.');
  const wage = p.statutoryWage || basic + da;
  const pfBase = p.pfFullWages ? wage : Math.min(wage, p.pfCeiling);
  const esiBase = p.esiWage || p.gross;
  const employeePf = p.pfCovered ? Math.round(pfBase * p.pfEmployeePercent / 100) : 0;
  const employerPf = p.pfCovered ? Math.round(pfBase * p.pfEmployerPercent / 100) : 0;
  const employeeEsi = p.esiCovered && !p.esiEmployeeExempt ? Math.ceil(esiBase * p.esiEmployeePercent / 100) : 0;
  const employerEsi = p.esiCovered ? Math.ceil(esiBase * p.esiEmployerPercent / 100) : 0;
  const gratuity = round(wage * p.gratuityPercent / 100);
  const deductions = round(employeePf + employeeEsi + p.professionalTax + p.tds + p.lwf);
  if (deductions > p.gross) throw new Error('Employee deductions exceed gross salary.');
  return { basic, hra, conveyance, medical_allowance: medical, special_allowance: special, bonus_incentive: 0, pf_deduction: employeePf, professional_tax: p.professionalTax, tds_tax: p.tds, custom_earnings: da ? [{ name: 'Dearness allowance', amount: da }] : [], custom_deductions: [{ name: 'ESI employee', amount: employeeEsi }, { name: 'Labour welfare fund', amount: p.lwf }].filter(r => r.amount), monthly_gross: p.gross, total_deductions: deductions, monthly_net: round(p.gross - deductions), employer_pf: employerPf, employer_esi: employerEsi, gratuity_provision: gratuity, annual_ctc: round((p.gross + employerPf + employerEsi + gratuity) * 12), india_structure: p };
}

// Recalculate statutory costs from actual draft earnings without replacing manual allowances.
export function applyIndiaBenefits(salary) {
  if (!salary.india_structure) return salary;
  const p = salary.india_structure, round = n => Math.round(n * 100) / 100;
  const generated = new Set(['ESI employee', 'Labour welfare fund']);
  const da = (salary.custom_earnings || []).filter(r => r.name === 'Dearness allowance').reduce((s,r)=>s+Number(r.amount||0),0);
  const gross = round(['basic','hra','special_allowance','conveyance','medical_allowance','bonus_incentive'].reduce((s,k)=>s+Number(salary[k]||0),0)+(salary.custom_earnings||[]).reduce((s,r)=>s+Number(r.amount||0),0));
  const wage = Number(p.statutoryWage) || Number(salary.basic||0) + da;
  const pfBase = p.pfFullWages ? wage : Math.min(wage,Number(p.pfCeiling));
  const esiBase = Number(p.esiWage) || gross;
  const employeeEsi = p.esiCovered && !p.esiEmployeeExempt ? Math.ceil(esiBase * Number(p.esiEmployeePercent)/100) : 0;
  const custom = [...(salary.custom_deductions||[]).filter(r=>!generated.has(r.name)), ...[{name:'ESI employee',amount:employeeEsi},{name:'Labour welfare fund',amount:Number(p.lwf)||0}].filter(r=>r.amount)];
  const pf = p.pfCovered ? Math.round(pfBase * Number(p.pfEmployeePercent)/100) : 0;
  const employerPf = p.pfCovered ? Math.round(pfBase * Number(p.pfEmployerPercent)/100) : 0;
  const employerEsi = p.esiCovered ? Math.ceil(esiBase * Number(p.esiEmployerPercent)/100) : 0;
  const gratuity = round(wage * Number(p.gratuityPercent)/100);
  const deductions = round(pf+Number(salary.professional_tax||0)+Number(salary.tds_tax||0)+custom.reduce((s,r)=>s+Number(r.amount),0));
  return {...salary,pf_deduction:pf,custom_deductions:custom,employer_pf:employerPf,employer_esi:employerEsi,gratuity_provision:gratuity,monthly_gross:gross,total_deductions:deductions,monthly_net:round(gross-deductions),annual_ctc:round((gross+employerPf+employerEsi+gratuity)*12)};
}
