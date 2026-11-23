import React, { useEffect, useState } from 'react';
import { TenantPanel } from '../../../components/ui/TenantPanel';
import { Button } from '../../../components/ui/Button';
import { payslipApi } from '../../../lib/payslipApi';
import { calculateIndiaStructure, structureDefaults } from '../../../../shared/indiaSalaryStructure.mjs';
import { inr, isFinal } from '../lib/payrollHelpers';

const percentFields = [['basicPercent','Basic','gross'],['hraPercent','HRA','basic'],['daPercent','Dearness allowance','basic'],['conveyancePercent','Conveyance','gross'],['medicalPercent','Medical allowance','gross'],['pfEmployeePercent','Employee PF','PF wage base'],['pfEmployerPercent','Employer PF','PF wage base'],['esiEmployeePercent','Employee ESI','ESI wages'],['esiEmployerPercent','Employer ESI','ESI wages'],['gratuityPercent','Gratuity provision','statutory wages']];
export function IndiaStructureEditor({ employee, record, previousSalary, year, month, onChanged, onToast, dataBusy, dataError }) {
  const [form,setForm] = useState(structureDefaults(year,0));
  const [busy,setBusy] = useState(false);
  const [editing,setEditing] = useState(false);
  const reset = () => setForm({...structureDefaults(year,monthIndex),...record?.india_structure,gross:record?.status==='Not started' ? previousSalary?.monthly_gross || 0 : record?.monthly_gross || 0});
  const monthIndex = ['January','February','March','April','May','June','July','August','September','October','November','December'].indexOf(month);
  useEffect(()=>{reset();setEditing(false);},[employee?.userid,record,previousSalary,year,month]);
  let result, error;
  try { result = calculateIndiaStructure(form); } catch(e) { error=e.message; }
  if (!editing && record?.india_structure) result = record;
  const update=(key,value)=>setForm(current=>({...current,[key]:value}));
  const save=async()=>{
    if (!employee || !result || isFinal(record)) return;
    setBusy(true);
    try {
      // Fetch current revision to avoid replacing a finalized salary from a stale screen.
      const latest=(await payslipApi.records(employee.userid)).find(r=>r.month===month&&String(r.year)===String(year));
      if (['Finalized','Paid'].includes(latest?.salary_status)) throw new Error('This period is finalized. Choose a draft period.');
      const base=latest?.salary || record || {};
      const generatedNames=new Set(['Dearness allowance','ESI employee','Labour welfare fund']);
      const extras=(base.custom_earnings||[]).filter(r=>!generatedNames.has(r.name));
      if (extras.length || Number(base.bonus_incentive)>0) throw new Error('This draft has additional earnings. Review these in Monthly Processing before replacing its gross structure.');
      const response=await payslipApi.saveSalary({employee,year,month,salary_status:'Draft',salary:{...base,...result,custom_deductions:[...(base.custom_deductions||[]).filter(r=>!generatedNames.has(r.name)),...result.custom_deductions],status:'Draft'}});
      onChanged?.();
      setEditing(false);
      onToast?.({type:response.status==='failed'?'warning':'success',title:'Salary structure saved',message:response.status==='failed' ? response.error : 'Draft saved to the payroll service. Review before finalizing.'});
    } catch(e){onToast?.({type:'error',title:'Structure was not saved',message:e.message});} finally{setBusy(false);}
  };
  return <TenantPanel title="Indian salary structure" subtitle={`${month} ${year} · Percentages show their calculation basis. Changes apply to this employee and pay period.`}><div className="payroll-panel-body india-structure">
    <div className="payroll-row-actions"><span className="payroll-muted">{record?.india_structure ? 'Saved structure' : 'No structure saved for this period'}{editing ? ' · Editing' : ' · View mode'}</span>{!editing&&<Button variant="outline" disabled={dataBusy||!!dataError||isFinal(record)} onClick={()=>setEditing(true)}>{record?.india_structure?'Edit structure':'Set up structure'}</Button>}</div>
    <fieldset className="india-structure-fields" disabled={!editing||busy||dataBusy||isFinal(record)}>
    <div className="payroll-fields"><label>Current monthly gross (₹)<input type="number" min="0" step="0.01" value={form.gross} onChange={e=>update('gross',e.target.value)}/></label><div className="payroll-muted">Use gross earnings, before deductions. Annual CTC includes employer costs and cannot simply be divided by 12 to obtain gross.</div></div>
    <div className="payroll-fields">{percentFields.map(([key,label,basis])=><label key={key}>{label} · {Number(form[key]).toFixed(key==='gratuityPercent'?4:2)}% of {basis}<input aria-label={`${label} percentage`} type="number" min="0" max="100" step="0.0001" value={form[key]} onChange={e=>update(key,e.target.value)}/></label>)}</div>
    <div className="payroll-fields">{[['statutoryWage','Verified statutory wages (₹; 0 uses basic + DA)'],['pfCeiling','PF monthly ceiling (₹)'],['esiWage','Verified ESI wages (₹; 0 uses gross)'],['professionalTax','State professional tax (₹)'],['tds','Monthly TDS from annual tax projection (₹)'],['lwf','Employee labour welfare fund (₹)']].map(([key,label])=><label key={key}>{label}<input type="number" min="0" step="0.01" value={form[key]} onChange={e=>update(key,e.target.value)}/></label>)}</div>
    <div className="india-coverage">{[['pfCovered','EPF covered'],['pfFullWages','PF on full statutory wages'],['esiCovered','ESI covered (including continuation)'],['esiEmployeeExempt','Employee ESI share exempt (verified daily-wage eligibility)']].map(([key,label])=><label key={key}><input type="checkbox" checked={!!form[key]} onChange={e=>update(key,e.target.checked)}/>{label}</label>)}</div>
    </fieldset>
    {error ? <p role="alert" className="payroll-error">{error}</p> : <><div className="india-salary-summary">{[['Monthly gross',result.monthly_gross],['Employee deductions',result.total_deductions],['Monthly take-home',result.monthly_net],['Annual CTC estimate',result.annual_ctc]].map(([label,amount])=><div key={label}><span>{label}</span><strong>{inr(amount)}</strong></div>)}</div><div className="india-breakdown">{[['Basic',result.basic],['DA',result.custom_earnings[0]?.amount||0],['HRA',result.hra],['Conveyance',result.conveyance],['Medical',result.medical_allowance],['Special allowance · remaining gross',result.special_allowance],['Employee PF',result.pf_deduction],['Employer PF',result.employer_pf],['Employer ESI',result.employer_esi],['Gratuity provision · employer cost',result.gratuity_provision]].map(([label,amount])=><div key={label}><span>{label}</span><strong>{inr(amount)}</strong></div>)}</div></>}
    <details className="india-compliance" open><summary>Compliance and formula notes</summary><ul>
      <li>Basic at 50% is a company default. Verify allowance exclusions and the statutory 50% add-back test; enter the verified wage base above. Regular special allowances can attract PF.</li>
      <li>PF: wage base × contribution rate. Employer PF includes EPS where eligible; EPS is a split of employer contributions, never an additional employee deduction. Confirm membership, EPS eligibility, EDLI and administration charges separately. <a href="https://www.pib.gov.in/PressReleasePage.aspx?PRID=2314111&lang=1&reg=3" target="_blank" rel="noreferrer">September 2026 ceiling update</a>.</li>
      <li>ESI: verify coverage at the contribution-period start (usual ceiling ₹21,000; ₹25,000 for persons with disability) and continuation rules. Verify low daily-wage eligibility and use the employee-share exemption setting above.</li>
      <li>Gratuity: statutory monthly wages × 15 / 26 × qualifying years at settlement. Monthly CTC provision uses 15 / 26 / 12 (4.8077%); changing a budgeting percentage does not change legal entitlement. Verify service, fixed-term rules and payout ceiling.</li>
      <li>HRA allocation is company policy. Under the old tax regime exemption is the least of actual HRA, rent minus 10% of eligible salary, or 40% / 50% of eligible salary. No automatic HRA exemption is assumed.</li>
      <li>PT and LWF follow the employee's state, slab, exemptions and payment frequency. TDS uses the selected tax regime, annual taxable income, declarations, cess and tax already deducted; it is not a flat salary percentage.</li>
      <li>Check state minimum wages, statutory bonus eligibility and calculation base, overtime, attendance / loss of pay, maternity benefits, leave encashment, PF / ESI remittances and returns, Form 16 / 24Q and final settlement before payroll approval.</li>
      <li>Other earning percentages are policy choices. Special allowance = gross − basic − DA − HRA − conveyance − medical. Employer costs are excluded from take-home. EDLI, administration charges, insurance and other employer benefits are not included in this CTC estimate.</li>
    </ul></details>
    {isFinal(record)&&<p className="payroll-muted">This salary is finalized. The calculation is available for review; saving is disabled.</p>}
    {editing&&<div className="payroll-row-actions"><Button variant="outline" disabled={busy} onClick={()=>{reset();setEditing(false);}}>Cancel</Button><Button variant="colored" disabled={busy||dataBusy||!!dataError||!employee||!result||Number(form.gross)<=0||isFinal(record)} onClick={save}>{busy?'Saving…':'Save structure'}</Button></div>}
  </div></TenantPanel>;
}
