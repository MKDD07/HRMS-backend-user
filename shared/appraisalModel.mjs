export const REVIEW_STAGES = ['Self-review', 'Manager review', 'Peer/360', 'Calibration', 'Finalize', 'Published', 'Closed'];
export const BANDS = ['Outstanding', 'Exceeds expectations', 'Meets expectations', 'Needs Improvement'];
export const bandFor = score => score >= 4.5 ? BANDS[0] : score >= 3.5 ? BANDS[1] : score >= 2.5 ? BANDS[2] : BANDS[3];
export const isDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
export const isInstant = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
export const stageDeadline = stage => ({ 'Self-review': 'self', 'Manager review': 'manager', 'Peer/360': 'peer', Calibration: 'calibration', Finalize: 'publish' })[stage];
export function newReviewTemplate() {
  return { name: '', rating_scale: 5, sections: [
    { id: 'competencies', name: 'Competencies', weight: 40, questions: [{ id: 'collaboration', text: 'Collaboration and communication' }, { id: 'ownership', text: 'Ownership and quality of work' }] },
    { id: 'goals', name: 'Goals / KRAs', weight: 60, questions: [{ id: 'delivery', text: 'Delivery against agreed goals and KRAs' }] }
  ], increments: { [BANDS[0]]: 12, [BANDS[1]]: 8, [BANDS[2]]: 5, [BANDS[3]]: 0 }, distribution: { [BANDS[0]]: 10, [BANDS[1]]: 20, [BANDS[2]]: 60, [BANDS[3]]: 10 } };
}
export function validateTemplate(input) {
  if (!input || typeof input.name !== 'string' || !input.name.trim() || input.name.length > 120) throw new Error('Template name is required (up to 120 characters).');
  if (!Array.isArray(input.sections) || !input.sections.length || input.sections.length > 10) throw new Error('Use 1–10 template sections.');
  const ids = new Set(), questionIds = new Set();
  const sections = input.sections.map(section => {
    if (!section || !/^[\w-]{1,80}$/.test(section.id) || ids.has(section.id) || typeof section.name !== 'string' || !section.name.trim() || section.name.length > 200) throw new Error('Every section needs a unique ID and name.');
    ids.add(section.id);
    if (typeof section.weight !== 'number' || !Number.isFinite(section.weight) || section.weight <= 0 || section.weight > 100) throw new Error('Section weights must be positive percentages.');
    if (!Array.isArray(section.questions) || !section.questions.length || section.questions.length > 20) throw new Error('Use 1–20 questions per section.');
    return { id: section.id, name: section.name.trim(), weight: section.weight, questions: section.questions.map(q => {
      if (!q || !/^[\w-]{1,80}$/.test(q.id) || questionIds.has(q.id) || ['__proto__','constructor','prototype'].includes(q.id) || typeof q.text !== 'string' || !q.text.trim() || q.text.length > 600) throw new Error('Every question needs a unique ID and text.');
      questionIds.add(q.id); return { id: q.id, text: q.text.trim() };
    }) };
  });
  if (Math.abs(sections.reduce((sum,s)=>sum+s.weight,0)-100)>0.00001) throw new Error('Section weights must total 100%.');
  for (const key of ['increments','distribution']) for (const band of BANDS) if (typeof input[key]?.[band] !== 'number' || !Number.isFinite(input[key][band]) || input[key][band]<0 || input[key][band]>100) throw new Error('Band increments and distribution percentages must be between 0 and 100.');
  if (Math.abs(BANDS.reduce((sum,band)=>sum+input.distribution[band],0)-100)>0.00001) throw new Error('Distribution targets must total 100%.');
  return { name: input.name.trim(), rating_scale: 5, sections, increments: Object.fromEntries(BANDS.map(b=>[b,input.increments[b]])), distribution: Object.fromEntries(BANDS.map(b=>[b,input.distribution[b]])) };
}
export function weightedScore(template, answers) {
  let total = 0;
  for (const section of template.sections) {
    const ratings = section.questions.map(q=>Number(answers[q.id]?.rating));
    if (ratings.some(r=>!Number.isFinite(r) || r<1 || r>5)) return null;
    total += ratings.reduce((sum,r)=>sum+r,0)/ratings.length * section.weight/100;
  }
  return Math.round((total+Number.EPSILON)*100)/100;
}
export function distributionTargets(count, percentages) {
  const parts = BANDS.map((band,index)=>({band,index,raw:count*percentages[band]/100,count:Math.floor(count*percentages[band]/100)}));
  let remaining = count-parts.reduce((sum,p)=>sum+p.count,0);
  for (const part of [...parts].sort((a,b)=>(b.raw-b.count)-(a.raw-a.count) || a.index-b.index)) if (remaining-->0) part.count++;
  return Object.fromEntries(parts.map(p=>[p.band,p.count]));
}
export function inScope(person, scope) {
  return person.status !== 'Inactive' && (!scope.departments.length || scope.departments.includes(person.department)) && (!scope.designations.length || scope.designations.includes(person.designation)) && (!scope.employees.length || scope.employees.includes(person.user_id)) && (!scope.exclude_probation || person.status !== 'Probation') && (!scope.joined_before || isDate(person.joining_date) && person.joining_date <= scope.joined_before);
}
