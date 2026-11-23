import { PayrollPersonSummary } from '../components/PayrollPersonSummary';
import { TenantPanelHeader } from '../../../components/ui/TenantPanel';
import { DossierSkeleton } from '../../employees/EmployeesPage/DossierSkeleton';
import { PayslipRecords } from '../../../components/payroll/PayslipRecords';
import React, { useEffect, useMemo, useState } from 'react';
import { Badge } from '../../../components/ui/Badge';
import { Avatar } from '../../../components/ui/Avatar';
import { getEmployeeMonthlySalaries } from '../../../lib/salaryStore';
import { EmployeeDirectory } from '../../../components/employees/EmployeeDirectory';
import { Pagination } from '../components/Pagination';
import { DownloadIconButton } from '../components/DownloadIconButton';
import { fullName, inr, isFinal } from '../lib/payrollHelpers';

const PAGE_SIZE = 5;


/** Tab 1: all months of salary for one person (left) + person list (right). */
export function PersonLedgerTab({ users, selectedUid, onSelect, year, version, onDownload, ledger = {}, dataBusy, dataError }) {
  const [page, setPage] = useState(1);
  const employee = users.find((u) => u.userid === selectedUid);

  const records = ledger[employee?.userid] || [];

  useEffect(() => setPage(1), [selectedUid, year]);

  const paged = records.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const name = fullName(employee);

  if (dataBusy) return <DossierSkeleton/>;
  if (dataError) return null;
  return (
    <div className="employee-workspace">
      <div className="employee-workspace-content payroll-tab-stack">

        {employee && <PayrollPersonSummary employee={employee} detail={records.length+' saved pay periods'}/>}
        <details className="payroll-payslip-details"><summary>Payslip revisions</summary><PayslipRecords employee={employee} refreshKey={version}/></details>

        <div className="card p-0 bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
          <TenantPanelHeader title="Salary history" subtitle="Saved pay periods, newest first."/>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)] font-semibold border-b border-[var(--color-border)] text-[11px]">
                <tr>
                  <th className="py-3.5 px-4">Pay period</th>
                  <th className="py-3.5 px-4">Pay date</th>
                  <th className="py-3.5 px-4">Gross</th>
                  <th className="py-3.5 px-4">Deductions</th>
                  <th className="py-3.5 px-4">Net</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-center">Payslip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)] text-[var(--color-text)]">
                {paged.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-[var(--color-text-muted)]">
                      No salary statements yet. Create a draft from the Monthly Processing tab.
                    </td>
                  </tr>
                ) : (
                  paged.map((rec) => (
                    <tr key={rec.id || `${rec.year}-${rec.month}`} className="hover:bg-[var(--color-surface-subtle)]">
                      <td className="py-3.5 px-4 font-bold">{rec.month} {rec.year}</td>
                      <td className="py-3.5 px-4 text-[var(--color-text-muted)]">{rec.pay_date || '-'}</td>
                      <td className="py-3.5 px-4 font-mono">{inr(rec.monthly_gross)}</td>
                      <td className="py-3.5 px-4 text-[var(--color-danger)]">{inr(rec.total_deductions)}</td>
                      <td className="py-3.5 px-4 font-bold text-[var(--color-text)]">{inr(rec.monthly_net)}</td>
                      <td className="py-3.5 px-4">
                        <span className="payroll-status">{rec.status || 'Draft'}</span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <DownloadIconButton disabled={!isFinal(rec)}
                          title={`Download ${rec.month} ${rec.year} payslip`}
                          onClick={() => onDownload(employee, rec)}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination page={page} pageSize={PAGE_SIZE} total={records.length} onChange={setPage} noun="statements" />
        </div>
      </div>

      <div className="employee-workspace-directory">
        <EmployeeDirectory employees={users} selectedId={selectedUid} onSelect={(e) => onSelect(e.userid)} subtitle="Select a person to view their salary ledger." />
      </div>
    </div>
  );
}
