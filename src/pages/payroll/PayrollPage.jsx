import './PayrollPage.css';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Download, Lock, Sparkles } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Tabs } from '../../components/ui/Tabs';
import {
  MONTHS,
  YEARS,
  getMonthlySalary,
  saveMonthlySalary,
  getInitialMonthlyRecord
} from '../../lib/salaryStore';
import { payslipApi, issueEmployeePayslip } from '../../lib/payslipApi';
import { applyScopedRows, buildPayrollCsv, downloadTextFile, getMonthRecord, inr, isFinal } from './lib/payrollHelpers';
import { PersonLedgerTab } from './tabs/PersonLedgerTab';
import { ProcessingTab } from './tabs/ProcessingTab';
import { RegisterTab } from './tabs/RegisterTab';
import { StructureTab } from './tabs/StructureTab';

/**
 * Payroll shell. Owns only what tabs share:
 * month/year, person list, selected person, refresh counter, toasts, downloads, bulk actions.
 * Each tab lives in ./tabs and can be changed on its own.
 */
export function PayrollPage({ api, currentUser, allUsers = [], onShowToast }) {
  const [activeTab, setActiveTab] = useState('person-history');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState(MONTHS[new Date().getMonth()]);
  const [users, setUsers] = useState(allUsers || []);
  const [selectedUid, setSelectedUid] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [version, setVersion] = useState(0); // bump after any save so tabs re-read data

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
        if (list.length > 0) {
          setUsers(list);
          setSelectedUid((cur) => cur || (list.find((u) => u.userid === currentUser?.userid) || list[0]).userid);
        }
      } catch (err) {
        console.error('Failed to load personnel:', err);
      }
    }
    load();
  }, [allUsers, currentUser?.userid]);

  const downloadPayslip = async (emp, record) => {
    try {
      await issueEmployeePayslip(emp, record, record?.month || month, record?.year || year, true);
      toast({ type: 'success', title: 'Payslip downloaded', message: `Payslip ready for ${emp?.first_name || 'employee'}.` });
    } catch (err) {
      toast({ type: 'error', title: 'PDF error', message: err.message });
    }
  };

  const saveBulk = async (finalize) => {
    if (!users.length || bulkBusy) return;
    if (finalize && !window.confirm('Finalize salary and generate assigned payslips for ' + month + ' ' + year + '?')) return;
    setBulkBusy(true); let saved = 0, failedUploads = 0; const errors = [];
    for (const employee of users) {
      try {
        const records = await payslipApi.records(employee.userid);
        const latest = records.find(item => item.month === month && item.year === String(year));
        const existing = latest ? { ...latest.salary, month, year } : getMonthlySalary(employee.userid, year, month);
        if (finalize && !existing) { errors.push(employee.userid + ': no saved salary'); continue; }
        const rec = applyScopedRows(existing || getInitialMonthlyRecord(employee.userid, year, month), employee.userid, year, month);
        const record = { ...rec, status: finalize ? 'Finalized' : rec.status || 'Draft' };
        const issued = await payslipApi.saveSalary({ employee, salary: record, month, year });
        saveMonthlySalary(employee.userid, year, month, record); saved++; if (issued.status === 'failed') failedUploads++;
      } catch (error) { errors.push(employee.userid + ': ' + error.message); }
    }
    bump(); setBulkBusy(false); window.dispatchEvent(new Event('payslip-records-changed'));
    toast({ type: errors.length || failedUploads ? 'warning' : 'success', title: 'Payroll batch completed', message: saved + ' saved; ' + failedUploads + ' uploads need retry; ' + errors.length + ' salaries not saved.' + (errors.length ? ' ' + errors.slice(0, 2).join(' / ') : '') });
  };
  const bulkCreate = () => saveBulk(false);
  const bulkFinalize = () => saveBulk(true);

  const exportCsv = () => {
    downloadTextFile(`payroll-${month}-${year}.csv`, buildPayrollCsv(users, year, month));
    toast({ type: 'success', title: 'Payroll exported', message: `${month} ${year} CSV downloaded.` });
  };

  const summary = useMemo(() => {
    const recs = users.map((u) => getMonthRecord(u, year, month));
    return {
      net: recs.reduce((a, r) => a + (r.monthly_net || 0), 0),
      done: recs.filter(isFinal).length
    };
  }, [users, year, month, version]);

  const shared = { users, selectedUid, onSelect: setSelectedUid, year, month, version, onChanged: bump, onToast: toast, onDownload: downloadPayslip };



  return (
    <div className="payroll-console">
      <PageHeader
        title="Payroll & Compensation"
        subtitle="Monthly salary ledgers, drafts, company register and custom pay rows."
        breadcrumbs={['HRMS', 'Payroll & CTC', `${month} ${year}`]}
      />
      <section className="payroll-cycle" aria-label="Payroll period and actions">
        <div className="payroll-period"><Calendar size={18} /><div><span className="payroll-eyebrow">PAY PERIOD</span><div className="payroll-period-inputs"><select aria-label="Month" value={month} onChange={e => setMonth(e.target.value)}>{MONTHS.map(value => <option key={value}>{value}</option>)}</select><select aria-label="Year" value={year} onChange={e => setYear(e.target.value)}>{[...new Set([...YEARS.map(String), year])].sort().map(value => <option key={value}>{value}</option>)}</select></div></div></div>
        <div className="payroll-batch-actions"><Button variant="outline" size="sm" icon={Sparkles} disabled={bulkBusy || !users.length} onClick={bulkCreate}>{bulkBusy ? 'Processing?' : 'Create salary drafts'}</Button><Button variant="primary" size="sm" icon={Lock} disabled={bulkBusy || !users.length} onClick={bulkFinalize}>Finalize all</Button><Button variant="secondary" size="sm" icon={Download} disabled={!users.length} onClick={exportCsv}>Export CSV</Button></div>
      </section>
      <section className="payroll-overview" aria-label="Selected period summary">
        <article><span>Employees</span><strong>{users.length}</strong><small>In the payroll directory</small></article>
        <article><span>Finalized</span><strong>{summary.done}<em> / {users.length}</em></strong><small>For {month} {year}</small></article>
        <article className="payroll-overview-net"><span>Net payable</span><strong>{inr(summary.net)}</strong><small>From locally saved salary records</small></article>
      </section>

      <Tabs
        tabs={[
          { id: 'person-history', label: 'Person ledger' },
          { id: 'processing-drafts', label: `Monthly processing (${month})` },
          { id: 'company-register', label: 'Company register', count: users.length },
          { id: 'salary-structure', label: 'Structure & custom rows' }
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === 'person-history' && <PersonLedgerTab {...shared} />}
      {activeTab === 'processing-drafts' && <ProcessingTab {...shared} />}
      {activeTab === 'company-register' && <RegisterTab {...shared} />}
      {activeTab === 'salary-structure' && <StructureTab {...shared} />}
    </div>
  );
}
