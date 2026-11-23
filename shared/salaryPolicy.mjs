import { applyIndiaBenefits, calculateIndiaStructure, structureDefaults } from './indiaSalaryStructure.mjs';
export function validateSalaryComponents(rows = []) {
  if (!Array.isArray(rows) || rows.length > 30) throw new Error('Use up to 30 salary components.');
  const reserved=new Set(['dearness allowance','esi employee','labour welfare fund']);
  const names=new Set();
  return rows.map(row=>{
    const name=String(row.name||'').trim().slice(0,100),value=Number(row.value);
    if(!name||reserved.has(name.toLowerCase())||names.has(name.toLowerCase())) throw new Error('Use unique component names; statutory component names are reserved.');
    names.add(name.toLowerCase());
    if(!['earning','deduction'].includes(row.type)||!['fixed','percent'].includes(row.mode)||!['gross','basic'].includes(row.basis)||!Number.isFinite(value)||value<0||value>(row.mode==='percent'?100:1e9)) throw new Error('Choose valid component types, bases and values.');
    return {name,type:row.type,mode:row.mode,basis:row.basis,value};
  });
}
export function configuredSalaryPolicy(configuration, userid, year, monthIndex) {
  const assignment=configuration?.assignments?.find(a=>(a.id||a.userid)===userid);
  const group=configuration?.groups?.find(g=>g.id===assignment?.group_id);
  return {policy:{...structureDefaults(year,monthIndex),...group?.salary_structure},components:group?.salary_components||[],name:group?.salary_structure ? group.name : 'Indian default',groupId:group?.id||''};
}
export function calculatePolicySalary(salary, policy, gross, components=[]) {
  const result=calculateIndiaStructure({...policy,gross:Number(gross)});
  const definitions=validateSalaryComponents(components);
  const names=new Set(definitions.map(r=>r.name));
  const previousNames=new Set((salary.policy_components||[]).map(r=>r.name));
  const extra=definitions.map(r=>({name:r.name,amount:Math.round((r.mode==='fixed'?r.value:(r.basis==='basic'?result.basic:result.monthly_gross)*r.value/100)*100)/100,type:r.type}));
  const keep=rows=>(rows||[]).filter(r=>!names.has(r.name)&&!previousNames.has(r.name)&&!['Dearness allowance','ESI employee','Labour welfare fund'].includes(r.name));
  return applyIndiaBenefits({...salary,...result,bonus_incentive:Number(salary.bonus_incentive)||0,professional_tax:salary.professional_tax ?? result.professional_tax,tds_tax:salary.tds_tax ?? result.tds_tax,custom_earnings:[...result.custom_earnings,...keep(salary.custom_earnings),...extra.filter(r=>r.type==='earning').map(({type,...r})=>r)],custom_deductions:[...keep(salary.custom_deductions),...extra.filter(r=>r.type==='deduction').map(({type,...r})=>r)],policy_components:definitions});
}
export function applyPolicyComponents(salary) {
  if (!salary.india_structure || !salary.policy_components?.length) return salary;
  const rows=validateSalaryComponents(salary.policy_components);
  const names=new Set(rows.map(r=>r.name));
  const calculated=rows.map(r=>({name:r.name,type:r.type,amount:Math.round((r.mode==='fixed'?r.value:(r.basis==='basic'?Number(salary.basic||0):Number(salary.india_structure.gross||0))*r.value/100)*100)/100}));
  return {...salary,custom_earnings:[...(salary.custom_earnings||[]).filter(r=>!names.has(r.name)),...calculated.filter(r=>r.type==='earning').map(({type,...r})=>r)],custom_deductions:[...(salary.custom_deductions||[]).filter(r=>!names.has(r.name)),...calculated.filter(r=>r.type==='deduction').map(({type,...r})=>r)]};
}
