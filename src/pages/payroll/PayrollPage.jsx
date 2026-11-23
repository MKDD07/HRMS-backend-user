import { Users as MiUsers, CircleCheck as MiCircleCheck, Wallet as MiWallet, Receipt as MiReceipt } from 'lucide-react';
import { MetricOverview, MetricCard } from '../../components/ui/MetricOverview';
import { calculateIndiaStructure } from '../../../shared/indiaSalaryStructure.mjs';
import { configuredSalaryPolicy, calculatePolicySalary } from '../../../shared/salaryPolicy.mjs';
import { latestSalaryRecords, payrollPaymentState, payrollReview } from '../../../shared/payrollWorkspace.mjs';
import { TenantPanel } from '../../components/ui/TenantPanel';
import { TenantHeader } from '../../components/ui/TenantHeader';
import './PayrollPage.scss';
import './PayrollTheme.scss';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Download, Lock, Sparkles } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { ViewTabs } from '../../components/ui/ViewTabs';
import {
  MONTHS,
  YEARS,
  getInitialMonthlyRecord
} from '../../lib/salaryStore';
import { payslipApi, issueEmployeePayslip } from '../../lib/payslipApi';
import { loadRows } from './lib/customRowsStore';
import { applyScopedRows, buildPayrollCsv, downloadTextFile, fullName, inr, isFinal } from './lib/payrollHelpers';
import { PersonLedgerTab } from './tabs/PersonLedgerTab';
import { ProcessingTab } from './tabs/ProcessingTab';
import { RegisterTab } from './tabs/RegisterTab';

/**
 * Payroll shell. Owns only what tabs share:
 * month/year, person list, selected person, refresh counter, toasts, downloads, bulk actions.
 * Each tab lives in ./tabs and can be changed on its own.
 */
export function PayrollPage({ api, currentUser, allUsers = [], onShowToast }) {
  const [activeTab, setActiveTab] = useState('processing-drafts');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState(MONTHS[new Date().getMonth()]);
  const [users, setUsers] = useState((allUsers || []).filter(user=>!user.plan_locked));
  const [selectedUid, setSelectedUid] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const [ledger, setLedger] = useState({}), [payments, setPayments] = useState({}), [accounts, setAccounts] = useState({});
  const [configuration, setConfiguration] = useState(null), [dataBusy,setDataBusy] = useState(true), [dataError,setDataError] = useState(''), [review,setReview] = useState(false); // bump after any save so tabs re-read data

  const bump = useCallback(() => setVersion((v) => v + 1), []);
  const toast = useCallback((t) => onShowToast && onShowToast(t), [onShowToast]);

  useEffect(() => {
    async function load() {
      try {
        let list = allUsers;
        if (!list || list.length === 0) {
          const res = await api.getAllUsers({ liveOnly: true });
          list = res?.data || [];
        }
        list=list.filter(user=>!user.plan_locked);
        if (list.length > 0) {
          setUsers(list);
          setSelectedUid((cur) => cur || (list.find((u) => u.userid === currentUser?.userid) || list[0]).userid);
        }
      } catch (err) {
        setDataError(err.message || 'Unable to load employees.');
      }
    }
    load();
  }, [allUsers, currentUser?.userid]);

  useEffect(() => {
    let active=true; setDataBusy(true);setDataError('');setReview(false);
    const nextLedger={},nextPayments={},nextAccounts={};
    async function load() {
      const [config]=await Promise.all([payslipApi.configuration(),loadRows()]);let position=0;
      await Promise.all(Array.from({length:Math.min(4,users.length)},async()=>{while(position<users.length){const employee=users[position++];const [records,paymentRows,dossier]=await Promise.all([payslipApi.records(employee.userid),api.getSalaries(employee.userid,{liveOnly:true}),api.getEmployeeDossier(employee.userid)]);nextLedger[employee.userid]=latestSalaryRecords(records);nextPayments[employee.userid]=paymentRows.data;nextAccounts[employee.userid]=dossier.data[0];}}));
      if(active){setLedger(nextLedger);setPayments(nextPayments);setAccounts(nextAccounts);setConfiguration(config);}
    }
    load().catch(error=>{if(active)setDataError(error.message);}).finally(()=>{if(active)setDataBusy(false);});
    return()=>{active=false;};
  },[users,version,api]);
  const periodRecords = useMemo(()=>Object.fromEntries(users.map(employee=>{
    const saved=ledger[employee.userid]?.find(record=>record.month===month&&record.year===String(year));
    const record=saved||{month,year,status:'Not started',monthly_gross:0,total_deductions:0,monthly_net:0};
    return [employee.userid,{...record,...payrollPaymentState(record,payments[employee.userid])}];
  })),[users,ledger,payments,month,year]);
  const reviewRows=users.map(employee=>({employee,record:periodRecords[employee.userid],issues:payrollReview({employee,record:periodRecords[employee.userid],account:accounts[employee.userid],configuration})}));

  const downloadPayslip = async (emp, record) => {
    if (!isFinal(record)) { toast({type:'warning',title:'Salary is not finalized',message:'Save and finalize the salary before downloading a payslip.'}); return; }
    try {
      await issueEmployeePayslip(emp, record, record?.month || month, record?.year || year, true);
      toast({ type: 'success', title: 'Payslip downloaded', message: `Payslip ready for ${emp?.first_name || 'employee'}.` });
    } catch (err) {
      toast({ type: 'error', title: 'PDF error', message: err.message });
    }
  };

  const saveBulk = async (finalize) => {
    if (!users.length || bulkBusy) return;
    if (dataBusy || dataError) return;
    setBulkBusy(true); let saved = 0, failedUploads = 0; const errors = [];
    for (const employee of users) {
      if (finalize && (isFinal(periodRecords[employee.userid]) || reviewRows.find(row=>row.employee.userid===employee.userid)?.issues.length)) continue;
      try {
        const records = await payslipApi.records(employee.userid);
        const latest = records.find(item => item.month === month && item.year === String(year));
        const existing = latest ? { ...latest.salary, status:latest.salary_status, month, year } : null;
        if (finalize && existing) {const issues=payrollReview({employee,record:existing,account:accounts[employee.userid],configuration});if(issues.length){errors.push(fullName(employee)+': '+issues.join(' / '));continue;}}
        if (isFinal(existing)) continue;
        if (finalize && !existing) { errors.push(fullName(employee) + ': no saved salary'); continue; }
        let initial = existing || getInitialMonthlyRecord(employee.userid, year, month);
        if (!existing) {
          const key=r=>Number(r.year)*12+MONTHS.indexOf(r.month);
          const prior=records.filter(r=>r.salary?.india_structure&&key(r)<key({year,month})).sort((a,b)=>key(b)-key(a))[0];
          if(prior) initial={...initial,...calculateIndiaStructure({...prior.salary.india_structure,gross:prior.salary.india_structure.gross}),status:'Draft'};
        }
        if (!initial.india_structure) {
          const {policy,components}=configuredSalaryPolicy(configuration,employee.userid,year,MONTHS.indexOf(month));
          const gross=Number(initial.monthly_gross)||0;
          initial=existing ? {...initial,india_structure:{...policy,gross},policy_components:components} : calculatePolicySalary(initial,policy,gross,components);
        }
        const rec = applyScopedRows(initial, employee.userid, year, month);
        const record = { ...rec, status: finalize ? 'Finalized' : rec.status || 'Draft' };
        const issued = await payslipApi.saveSalary({ employee, salary: record, month, year, salary_status: finalize ? 'Finalized' : 'Draft' });
        saved++; if (issued.status === 'failed') failedUploads++;
      } catch (error) { errors.push(fullName(employee) + ': ' + error.message); }
    }
    bump(); setBulkBusy(false); window.dispatchEvent(new Event('payslip-records-changed'));
    toast({ type: errors.length || failedUploads ? 'warning' : 'success', title: 'Payroll batch completed', message: saved + ' saved; ' + failedUploads + ' uploads need retry; ' + errors.length + ' salaries not saved.' + (errors.length ? ' ' + errors.slice(0, 2).join(' / ') : '') });
  };
  const bulkCreate = () => saveBulk(false);
  const bulkFinalize = () => saveBulk(true);

  const exportCsv = () => {
    downloadTextFile(`payroll-${month}-${year}.csv`, buildPayrollCsv(users, year, month, periodRecords));
    toast({ type: 'success', title: 'Payroll exported', message: `${month} ${year} CSV downloaded.` });
  };

  const summary = useMemo(() => {
    const recs = Object.values(periodRecords);
    return {
      net: recs.reduce((a, r) => a + (r.monthly_net || 0), 0),
      done: recs.filter(isFinal).length, paid: recs.filter(r=>r.payment_status==='Paid').length, pending: recs.reduce((a,r)=>a+(r.pending||0),0)
    };
  }, [periodRecords]);

  const shared = { periodRecords, ledger, dataBusy, dataError, accounts, configuration, users, selectedUid, onSelect: setSelectedUid, year, month, version, onChanged: bump, onToast: toast, onDownload: downloadPayslip };



  return (
    <div className="payroll-console">
      <TenantHeader actions={{export:{icon:Download,onClick:exportCsv,disabled:dataBusy||!!dataError||!users.length}}}
        settings={{
          heading: "Payroll & Compensation",
          paragraph: "Calculate employee salaries, review statutory costs, finalize payroll and reconcile payments. Reusable rules and payslip designs are managed in Structures & Payslip Studio.",
          buttons: [{id:'export',label:'Export CSV',variant:'outline'}],
          subheading: (['HRMS', 'Payroll & CTC', `${month} ${year}`]).join(' / ')
        }}
      />
      <TenantPanel className="payroll-cycle-panel" title="Payroll cycle" subtitle="Select a month to review saved salary records." controls={<input className="payroll-period-picker" aria-label="Payroll month" type="month" value={year+'-'+String(MONTHS.indexOf(month)+1).padStart(2,'0')} disabled={bulkBusy} onChange={event=>{if(!event.target.value)return;const [y,m]=event.target.value.split('-');setYear(y);setMonth(MONTHS[Number(m)-1]);setReview(false);}}/>} actions={[{id:'drafts',label:'Create drafts',icon:Sparkles,disabled:bulkBusy||dataBusy||!!dataError||!users.length,onClick:bulkCreate},{id:'review',label:'Review payroll',icon:Lock,variant:'colored',disabled:bulkBusy||dataBusy||!!dataError||!users.length,onClick:()=>setReview(true)}]}/>
      {dataError && <div role="alert" className="payroll-error">{dataError}<Button size="sm" variant="outline" onClick={bump}>Retry</Button></div>}
      {!dataError && <MetricOverview loading={dataBusy} aria-label="Selected period summary">
        <MetricCard as="article" label="Employees" icon={MiUsers} value={users.length} caption="In the payroll directory" />
        <MetricCard as="article" label="Finalized" icon={MiCircleCheck} value={<>{summary.done}<em> / {users.length}</em></>} caption={<>For {month} {year}</>} />
        <MetricCard as="article" label="Net payable" icon={MiWallet} value={inr(summary.net)} caption="From saved salary records" />
        <MetricCard as="article" label="Payments recorded" icon={MiReceipt} value={<>{summary.paid}<em> / {users.length}</em></>} caption={<>{inr(summary.pending)} remains payable</>} />
      </MetricOverview>}
      {review && <TenantPanel title="Review payroll" subtitle={month+' '+year+' - only ready drafts will be finalized.'}><div className="payroll-review-list">{reviewRows.map(({employee,record,issues})=><div key={employee.userid}><strong>{[employee.first_name,employee.last_name].filter(Boolean).join(' ')}</strong><span>{isFinal(record)?'Already finalized':issues.length?issues.join(' / '):'Ready to finalize'}</span></div>)}</div><div className="payroll-review-actions"><Button size="sm" variant="outline" onClick={() => setReview(false)} disabled={bulkBusy}>Cancel</Button><Button size="sm" variant="colored" loading={bulkBusy} disabled={!reviewRows.some(row => !isFinal(row.record) && !row.issues.length)} onClick={bulkFinalize}>Finalize ready drafts</Button></div></TenantPanel>}

      <ViewTabs label="Payroll views"
        tabs={[
          { id: 'processing-drafts', label: 'Salary processing' },
          { id: 'person-history', label: 'Salary history' },
          { id: 'company-register', label: 'Company register', count: users.length }
        ]}
        value={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === 'person-history' && <PersonLedgerTab {...shared} />}
      {activeTab === 'processing-drafts' && <ProcessingTab {...shared} />}
      {activeTab === 'company-register' && <RegisterTab {...shared} />}
    </div>
  );
}
