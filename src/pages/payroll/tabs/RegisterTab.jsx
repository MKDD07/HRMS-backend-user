import { DossierSkeleton } from '../../employees/EmployeesPage/DossierSkeleton';
import { BankSalaryLetter } from '../components/BankSalaryLetter';
import { TenantPanelHeader } from '../../../components/ui/TenantPanel';
import React, { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { FilterBar } from '../../../components/ui/FilterBar';
import { Pagination } from '../components/Pagination';
import { DownloadIconButton } from '../components/DownloadIconButton';
import { fullName, getMonthRecord, inr, isFinal } from '../lib/payrollHelpers';

const PAGE_SIZE = 8;

/** Tab 3: whole company for the selected month. */
export function RegisterTab({ users, year, month, version, onDownload, periodRecords = {}, dataBusy, dataError, accounts = {}, configuration }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);

  const data = useMemo(
    () => users.map((employee) => ({ employee, record: periodRecords[employee.userid] || {status:'Not started'} })),
    [users, year, month, version, periodRecords]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return data.filter(({ employee, record }) => {
      const hay = `${fullName(employee)} ${employee.department || ''}`.toLowerCase();
      const label = record.status;
      return hay.includes(q) && (status === 'ALL' || label === status);
    });
  }, [data, search, status]);

  useEffect(() => setPage(1), [search, status, year, month]);

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const gross = data.reduce((a, d) => a + (d.record.monthly_gross || 0), 0);
  const net = data.reduce((a, d) => a + (d.record.monthly_net || 0), 0);
  const done = data.filter((d) => isFinal(d.record)).length;

  const kpis = [
    ['Total gross payroll', inr(gross), `${month} ${year}`, 'text-[var(--color-text)]'],
    ['Total net payable', inr(net), 'Saved salary amounts', 'text-[var(--color-text)]'],
    ['Finalized', `${done} / ${users.length}`, `${data.filter(d=>d.record.status==='Draft').length} saved drafts`, 'text-[var(--color-text)]'],
    ['Deductions', inr(gross - net), 'PF, PT, TDS and custom', 'text-[var(--color-text-secondary)]']
  ];

  if (dataBusy) return <DossierSkeleton/>;
  if (dataError) return null;
  return (
    <div className="space-y-4">
      <BankSalaryLetter users={users} periodRecords={periodRecords} accounts={accounts} month={month} year={year} configuration={configuration}/>
      <div className="card tenant-panel p-0 overflow-hidden"><TenantPanelHeader title="Company register" subtitle="Saved salary records and recorded payments for this period."/>
        <FilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search employee name or department..."
          className="border-0 border-b border-[var(--color-border)] rounded-none shadow-none"
        >
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="filter-bar__select text-[13px]"
          >
            <option value="ALL">All Statuses</option>
            <option value="Finalized">Finalized</option>
            <option value="Draft">Draft</option><option value="Not started">Not started</option>
          </select>
        </FilterBar>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)] font-semibold border-b border-[var(--color-border)] text-[11px]">
              <tr>
                <th className="py-3.5 px-4">Employee</th>
                <th className="py-3.5 px-4">Department</th>
                <th className="py-3.5 px-4">Bank account</th>
                <th className="py-3.5 px-4">Gross</th>
                <th className="py-3.5 px-4">Deductions</th>
                <th className="py-3.5 px-4">Net</th>
                <th className="py-3.5 px-4">Salary status</th><th className="py-3.5 px-4">Payment</th>
                <th className="py-3.5 px-4 text-center">Payslip</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)] text-[var(--color-text)]">
              {paged.length === 0 && (
                <tr><td colSpan={9} className="py-10 text-center text-[var(--color-text-muted)]">No records match these filters.</td></tr>
              )}
              {paged.map(({ employee, record }) => (
                <tr key={employee.userid} className="hover:bg-[var(--color-surface-subtle)]">
                  <td className="py-3.5 px-4">
                    <div className="font-bold">{fullName(employee)}</div>

                  </td>
                  <td className="py-3.5 px-4 text-[var(--color-text-muted)]">{employee.department}</td>
                  <td className="py-3.5 px-4 text-[11px] text-[var(--color-text-muted)]">{accounts[employee.userid]?.account_no ? 'Ending '+accounts[employee.userid].account_no.slice(-4) : accounts[employee.userid]?.preferred_payment_method || 'Not provided'}</td>
                  <td className="py-3.5 px-4 font-mono">{inr(record.monthly_gross)}</td>
                  <td className="py-3.5 px-4 text-[var(--color-danger)]">{inr(record.total_deductions)}</td>
                  <td className="py-3.5 px-4 font-bold text-[var(--color-text)]">{inr(record.monthly_net)}</td>
                  <td className="py-3.5 px-4">
                    <span className="payroll-status">{record.status}</span>
                  </td>
                  <td className="py-3.5 px-4">{record.payment_status}<small className="payroll-payment-note">{inr(record.paid)} recorded</small>{record.payment_method && <small className="payroll-payment-note">{record.payment_method}</small>}{record.payment_reference && <small className="payroll-payment-note">{record.payment_reference}</small>}</td>
                  <td className="py-3.5 px-4 text-center">
                    <DownloadIconButton disabled={!isFinal(record)} title={`Download ${employee.first_name}'s payslip`} onClick={() => onDownload(employee, record)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} />
      </div>
    </div>
  );
}
