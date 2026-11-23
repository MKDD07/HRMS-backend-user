import { Card } from '../../../components/ui/Card';
import { StatutorySavings } from '../components/StatutorySavings';
import { calculateIndiaStructure } from '../../../../shared/indiaSalaryStructure.mjs';
import { configuredSalaryPolicy, calculatePolicySalary } from '../../../../shared/salaryPolicy.mjs';
import { TenantPanel } from '../../../components/ui/TenantPanel';
import { PayrollPersonSummary } from '../components/PayrollPersonSummary';
import { DossierSkeleton } from '../../employees/EmployeesPage/DossierSkeleton';
import { payrollReview } from '../../../../shared/payrollWorkspace.mjs';
import { payslipApi } from '../../../lib/payslipApi';
import { withAppraisalRows, isAppraisalRow } from '../../../../shared/appraisalPayroll.mjs';
import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Copy, Plus, Save, Unlock, X, AlertCircle } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Avatar } from '../../../components/ui/Avatar';
import { getInitialMonthlyRecord } from '../../../lib/salaryStore';
import { EmployeeDirectory } from '../../../components/employees/EmployeeDirectory';
import { DownloadIconButton } from '../components/DownloadIconButton';
import {
  DEDUCTION_FIELDS,
  EARNING_FIELDS,
  applyScopedRows,
  computeTotals,
  fullName,
  getMonthRecord,
  inr,
  isFinal,
  previousMonth,
  withTotals
} from '../lib/payrollHelpers';

const inputCls = 'w-full h-8 px-2.5 rounded-lg border border-[var(--color-border)] text-[13px] text-[var(--color-text)] disabled:bg-[var(--color-surface-subtle)] disabled:text-[var(--color-text-muted)]';

function NumberField({label,value,onChange,disabled}) {return <label className="payroll-field"><span>{label}</span><input type="number" min="0" step="0.01" disabled={disabled} value={value??0} onChange={event=>onChange(Number(event.target.value))}/></label>;}

/** Tab 2: edit one person's month (left), pick person (right). Draft, then finalize. */
export function ProcessingTab({ users, selectedUid, onSelect, year, month, version, onChanged, onToast, onDownload, periodRecords = {}, accounts = {}, configuration }) {
  const employee = users.find((u) => u.userid === selectedUid);
  const [form, setForm] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [adjustment,setAdjustment]=useState({name:'',amount:0,type:'earning'});
  const [saving, setSaving] = useState(false), [loadError, setLoadError] = useState('');
  const [calculationNotice,setCalculationNotice]=useState('');
  const [appraisal,setAppraisal]=useState(null),[appraisalError,setAppraisalError]=useState('');

  useEffect(() => {
    let active = true; setForm(null); setLoadError(''); setShowAdd(false);setCalculationNotice('');
    if (!employee) return;
    payslipApi.records(employee.userid).then(records => {
      if (!active) return;
      const saved = records.find(record => record.month === month && record.year === String(year));
      let rec = saved ? { ...saved.salary, status:saved.salary_status, apply_appraisals:!!saved.appraisal_applied, year, month, user_id: employee.userid } : getInitialMonthlyRecord(employee.userid, year, month);
      if (!saved) {
        const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
        const key=r=>Number(r.year)*12+months.indexOf(r.month);
        const prior=records.filter(r=>r.salary?.india_structure&&key(r)<key({year,month})).sort((a,b)=>key(b)-key(a))[0];
        if(prior) rec={...rec,...calculateIndiaStructure({...prior.salary.india_structure,gross:prior.salary.india_structure.gross}),status:'Draft'};
      }
      if (!isFinal(rec) && !rec.india_structure) {
        const {policy,components}=configuredSalaryPolicy(configuration,employee.userid,year,['January','February','March','April','May','June','July','August','September','October','November','December'].indexOf(month));
        const gross=computeTotals(rec).gross;
        const basicOnly=Number(rec.basic)>0&&gross===Number(rec.basic)&&Number(policy.basicPercent)>0;
        if (basicOnly) {
          rec=calculatePolicySalary(rec,policy,Number(rec.basic)*100/Number(policy.basicPercent),components);
          setCalculationNotice('This draft contained only basic salary. Base gross and allowances have been calculated from the basic percentage. Review the amounts and coverage, then save the draft.');
        }
        else if (!gross || !saved) rec=calculatePolicySalary(rec,policy,gross,components);
        else rec=withTotals({...rec,india_structure:{...policy,gross},policy_components:components});
      }
      setForm(JSON.parse(JSON.stringify(applyScopedRows(rec, employee.userid, year, month))));
    }).catch(error => { if (active) setLoadError(error.message); });
    return () => { active = false; };
  }, [selectedUid, year, month, version, configuration]);
  useEffect(()=>{let active=true;setAppraisal(null);setAppraisalError('');if(employee)payslipApi.appraisalAdjustments(employee.userid,year,month).then(value=>{if(active)setAppraisal(value);}).catch(e=>{if(active)setAppraisalError(e.message);});return()=>{active=false;};},[selectedUid,year,month,version]);

  const calculated = useMemo(() => form ? withTotals(form) : null, [form]);
  const totals = useMemo(() => computeTotals(calculated), [calculated]);
  const locked = isFinal(form);
  const negative = totals.net < 0;
  const name = fullName(employee);

  const set = (key, value) => {
    if(key==='basic'&&form.india_structure) {
      if(Number(form.india_structure.basicPercent)<=0){onToast?.({type:'error',title:'Basic percentage is zero',message:'Enter gross instead or change the salary structure.'});return;}
      changeGross(value*100/Number(form.india_structure.basicPercent));return;
    }
    setForm((f) => withTotals({ ...f, [key]: value }));
  };
  const changeGross = value => setForm(current => {
    try {
      return withTotals(calculatePolicySalary(current,current.india_structure,value,current.policy_components||[]));
    } catch(error) { onToast?.({type:'error',title:'Unable to calculate structure',message:error.message}); return current; }
  });
  const earningLabel = (key,label) => {
    if(!form?.india_structure) return label;
    const fields={basic:['basicPercent','gross'],hra:['hraPercent','basic'],conveyance:['conveyancePercent','gross'],medical_allowance:['medicalPercent','gross']};
    return fields[key] ? `${label} (${form.india_structure[fields[key][0]]}% of ${fields[key][1]})` : key==='special_allowance' ? `${label} (remaining gross)` : label;
  };
  const activePolicy=configuredSalaryPolicy(configuration,employee?.userid,year,['January','February','March','April','May','June','July','August','September','October','November','December'].indexOf(month));
  const applySavedRules=()=>{
    try {setForm(current=>withTotals(calculatePolicySalary(current,activePolicy.policy,current.india_structure?.gross||computeTotals(current).gross,activePolicy.components)));onToast?.({type:'info',title:'Salary rules applied',message:'Review calculated amounts and save the draft.'});}
    catch(error){onToast?.({type:'error',title:'Rules could not be applied',message:error.message});}
  };

  const persist = async (status, extra = {}) => {
    if (saving || !form) return;
    setSaving(true);
    try {
      const rec = withTotals({ ...form, employee_name: name, status, ...extra });
      const issued = await payslipApi.saveSalary({ employee, salary: rec, month, year, salary_status:status, apply_appraisals:form.apply_appraisals===true });
      const saved={...rec,...issued.salary,status:issued.salary_status,apply_appraisals:!!issued.appraisal_applied};
      setForm(saved); onChanged();
      window.dispatchEvent(new Event('payslip-records-changed'));
      onToast?.({ type: issued.status === 'failed' ? 'warning' : 'success', title: 'Salary saved', message: issued.status === 'failed' ? issued.error : issued.status === 'ready' ? 'PDF stored in R2.' : 'Salary saved; generation is pending.' });
    } catch (error) { onToast?.({ type: 'error', title: 'Salary was not saved', message: error.message }); } finally { setSaving(false); }
  };
  const saveDraft = () => persist('Draft', { updated_at: new Date().toISOString() });
  const finalize = () => { const issues=payrollReview({employee,record:withTotals({...form,status:'Draft'}),account:accounts[employee.userid],configuration});if(issues.length){onToast?.({type:'error',title:'Payroll needs review',message:issues.join(' / ')});return;}if (!negative) return persist('Finalized', { finalized_at: new Date().toISOString() }); };
  const unlock = () => persist('Draft', { finalized_at: null });

  const copyLastMonth = async () => {
    const prev = previousMonth(year, month);
    let last;try{const history=await payslipApi.records(employee.userid);last=history.find(record=>record.year===String(prev.year)&&record.month===prev.month)?.salary;}catch(error){onToast?.({type:'error',title:'Previous salary unavailable',message:error.message});return;}
    if (!last) {
      onToast?.({ type: 'warning', title: 'Nothing to copy', message: `No saved salary for ${prev.month} ${prev.year}.` });
      return;
    }
    const keys = [...EARNING_FIELDS, ...DEDUCTION_FIELDS].map(([k]) => k);
    setForm((f) => {
      const next = { ...f };
      keys.forEach((k) => (next[k] = last[k] ?? 0));
      next.india_structure = last.india_structure;
      next.custom_earnings = last.custom_earnings || [];
      next.custom_deductions = last.custom_deductions || [];
      return withTotals(next);
    });
    onToast?.({ type: 'info', title: 'Copied', message: `Values from ${prev.month} ${prev.year}. Save the draft to keep them.` });
  };

  const removeCustom = (listKey, item) => {
    setForm((f) => ({
      ...f,
      [listKey]: f[listKey].filter((c) => item.id ? c.id !== item.id : c.name !== item.name),
      // a removed scoped row must not come back for this month
      skipped_row_ids: item.row_id ? [...(f.skipped_row_ids || []), item.row_id] : f.skipped_row_ids
    }));
  };

  const editCustom = (listKey, name, amount) =>
    setForm((f) => withTotals({ ...f, [listKey]: f[listKey].map(c => (c.name === name ? { ...c, amount } : c)) }));

  const addRow = (row) => {
    if(!row.name.trim()||!Number.isFinite(Number(row.amount))||Number(row.amount)<=0) return;
    if(['Dearness allowance','ESI employee','Labour welfare fund',...(form.policy_components||[]).map(r=>r.name)].includes(row.name.trim())) {onToast?.({type:'error',title:'Choose a different name',message:'This component is already calculated from the salary structure.'});return;}
    const key=row.type==='earning'?'custom_earnings':'custom_deductions';
    setForm(f=>withTotals({...f,[key]:[...(f[key]||[]),{id:crypto.randomUUID(),name:row.name.trim(),amount:Number(row.amount)}]}));
    setAdjustment({name:'',amount:0,type:'earning'});
    setShowAdd(false);
    onToast?.({ type: 'success', title: 'Row added', message: `${row.name} added for ${name}.` });
  };

  const renderCustom = (listKey, tone) =>
    (calculated[listKey] || []).map((c, idx) => (
      <div key={c.id || idx}>
        <label className={`flex items-center justify-between mb-1 text-[13px] font-semibold ${tone}`}>
          <span>{c.name}{c.source === 'scoped' ? ' (from structure)' : ' (custom)'}</span>
          {!locked && !isAppraisalRow(c) && !(form.india_structure && ['Dearness allowance','ESI employee','Labour welfare fund',...(form.policy_components||[]).map(r=>r.name)].includes(c.name)) && (
            <Button size="sm" variant="outline" wrapContent={false} type="button" onClick={() => removeCustom(listKey, c)} title="Remove from this month" className="">
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </label>
        <input type="number" disabled={locked || saving || isAppraisalRow(c) || (!!form.india_structure && ['Dearness allowance','ESI employee','Labour welfare fund',...(form.policy_components||[]).map(r=>r.name)].includes(c.name))} value={c.amount || 0} onChange={(e) => editCustom(listKey, c.name, Number(e.target.value))} className={inputCls} />
      </div>
    ));

  return <div className="employee-workspace payroll-processing">
    <div className="employee-workspace-content payroll-tab-stack">
      {!form ? loadError ? <div role="alert" className="payroll-error">{loadError}</div> : employee ? <DossierSkeleton/> : <Card className="tenant-empty">Select a person to edit their salary.</Card> : <>
        <PayrollPersonSummary employee={employee} detail={month+' '+year} status={locked?'Finalized':'Draft'} actions={<>
          <DownloadIconButton disabled={!locked || saving} onClick={()=>onDownload(employee,form)}/>
          {locked ? <Button size="sm" variant="outline" icon={Unlock} disabled={saving} onClick={unlock}>Reopen draft</Button> : <><Button size="sm" variant="outline" icon={Copy} disabled={saving} onClick={copyLastMonth}>Copy previous month</Button><Button size="sm" variant="outline" icon={Plus} disabled={saving} onClick={() => setShowAdd(value => !value)}>Period adjustment</Button></>}
      </>}/>
        {(appraisal?.rows.length>0 || appraisalError) && <TenantPanel title="Appraisal adjustments" subtitle="Published adjustments for this payroll period."><div className="payroll-panel-body">{appraisalError?<p role="alert" className="payroll-error">{appraisalError}</p>:<>{appraisal.rows.map(row=><p key={row.name}>{row.name}: {inr(row.amount)}</p>)}<Button size="sm" variant="outline" disabled={locked || saving} onClick={() => setForm(current => ({
  ...withAppraisalRows(current, appraisal.rows),
  apply_appraisals: true
}))}>{form.apply_appraisals?'Refresh adjustments':'Import adjustments'}</Button></>}</div></TenantPanel>}
        {negative && <div role="alert" className="payroll-error">Deductions exceed earnings. Review the amounts before finalizing.</div>}
        {calculationNotice&&<p role="status" className="payroll-muted">{calculationNotice}</p>}
        {showAdd && !locked && <TenantPanel title="Pay-period adjustment" subtitle={`Add an amount for ${name}, ${month} ${year}. Define recurring component rules in the Studio.`}><form className="payroll-panel-body india-structure" onSubmit={e=>{e.preventDefault();addRow(adjustment);}}><div className="payroll-fields"><label>Adjustment name<input required value={adjustment.name} onChange={e=>setAdjustment(v=>({...v,name:e.target.value}))}/></label><label>Type<select value={adjustment.type} onChange={e=>setAdjustment(v=>({...v,type:e.target.value}))}><option value="earning">Earning</option><option value="deduction">Deduction</option></select></label><NumberField label="Amount (₹)" value={adjustment.amount} onChange={amount=>setAdjustment(v=>({...v,amount}))}/></div><Button type="submit" variant="colored" disabled={saving||!adjustment.name.trim()||Number(adjustment.amount)<=0}>Add to this period</Button></form></TenantPanel>}
        {form.india_structure&&<TenantPanel title="Automatic salary calculation" subtitle="Enter base gross or edit Basic Salary below: both recalculate HRA, allowances, PF, ESI and gratuity. Bonus is additional. Manage reusable rules in Structures & Payslip Studio."><div className="payroll-panel-body payroll-fields"><NumberField label="Base monthly gross (₹)" value={form.india_structure.gross} disabled={locked||saving} onChange={changeGross}/><div className="payroll-muted">Rules: {activePolicy.name}. Basic is {form.india_structure.basicPercent}% of base gross; HRA is {form.india_structure.hraPercent}% of basic. Entering basic ?45,000 at 50% means base gross ?90,000.<br/><Button size="sm" variant="outline" disabled={locked||saving} onClick={applySavedRules}>Apply latest saved rules</Button></div></div></TenantPanel>}
        <div className="payroll-component-grid">
          <TenantPanel className="payroll-panel--earnings" title="Earnings & allowances" subtitle="Monthly amounts before deductions." controls={<strong className="payroll-panel-total">{inr(totals.gross)}</strong>}><div className="payroll-panel-body payroll-fields">{EARNING_FIELDS.map(([key,label])=><NumberField key={key} label={earningLabel(key,label)} value={form[key]} disabled={locked||saving||(!!form.india_structure&&key!=='bonus_incentive'&&key!=='basic')} onChange={value=>set(key,value)}/>)}{renderCustom('custom_earnings','')}</div></TenantPanel>
          <TenantPanel className="payroll-panel--deductions" title="Deductions & taxes" subtitle="Employee deductions for this period." controls={<strong className="payroll-panel-total">{inr(totals.deductions)}</strong>}><div className="payroll-panel-body payroll-fields">{DEDUCTION_FIELDS.map(([key,label])=><NumberField key={key} label={key==='pf_deduction'&&form.india_structure ? `Provident Fund (${form.india_structure.pfEmployeePercent}% - automatic)` : label} value={calculated[key]} disabled={locked||saving||(key==='pf_deduction'&&!!form.india_structure)} onChange={value=>set(key,value)}/>)}{renderCustom('custom_deductions','')}</div></TenantPanel>
        </div>
        <Card className="payroll-draft-footer"><div className="payroll-totals"><div><span>Gross earnings</span><strong>{inr(totals.gross)}</strong></div><div><span>Deductions</span><strong>{inr(totals.deductions)}</strong></div><div className="payroll-net"><span>Net payable</span><strong>{inr(totals.net)}</strong></div></div>{!locked&&<div className="payroll-footer-actions"><Button size="sm" variant="outline" icon={Save} loading={saving} onClick={saveDraft}>Save draft</Button><Button size="sm" variant="colored" icon={CheckCircle2} disabled={negative || saving} onClick={finalize}>Finalize salary</Button></div>}</Card>
        <StatutorySavings salary={calculated} locked={locked||saving} onUpdate={(key,value)=>setForm(current=>withTotals({...current,india_structure:{...current.india_structure,[key]:value}}))}/>
      </>}
    </div>
    <div className="employee-workspace-directory"><EmployeeDirectory employees={users} selectedId={selectedUid} onSelect={person=>onSelect(person.userid)} subtitle="Choose an employee for this pay period." renderMeta={person=>{const record=periodRecords[person.userid];return <span className="payroll-directory-meta">{record?.status || 'Not started'}{record?.status !== 'Not started' && record && <span>{inr(record.monthly_net)}</span>}</span>;}}/></div>
  </div>;
}
