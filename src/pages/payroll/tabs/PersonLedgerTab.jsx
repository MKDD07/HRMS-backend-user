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
export function PersonLedgerTab({ users, selectedUid, onSelect, year, version, onDownload }) {
  const [page, setPage] = useState(1);
  const employee = users.find((u) => u.userid === selectedUid);

  const records = useMemo(() => {
    if (!employee) return [];
    const map = getEmployeeMonthlySalaries(employee.userid);
    const list = Object.keys(map).map((k) => map[k]);
    return list.sort((a, b) => (b.pay_date || '').localeCompare(a.pay_date || ''));
  }, [employee, year, version]);

  useEffect(() => setPage(1), [selectedUid, year]);

  const paged = records.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const name = fullName(employee);

  return (
    <div className="employee-workspace">
      <div className="employee-workspace-content space-y-4">
        <PayslipRecords employee={employee} refreshKey={version} />
        {employee && (
          <div className="card p-4 bg-white border border-[#e2e9da] flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Avatar src={employee.profile_pic_url} avatarId={employee.avatar_id} name={name} size="lg" />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-[#3e5432]">{name}</h3>
                  <span className="text-[13px] font-bold text-[#587443] bg-[#f0f5e9] px-2 py-0.5 rounded">
                    {employee.userid}
                  </span>
                  <Badge variant="neutral">{employee.department || 'Corporate'}</Badge>
                </div>
                <p className="text-[13px] text-[#7d8e70] mt-0.5">{employee.designation || 'Staff'}</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-[#7d8e70] block">Statements</span>
              <strong className="text-base font-bold text-[#3e5432] font-mono">{records.length}</strong>
            </div>
          </div>
        )}

        <div className="card p-0 bg-white border border-[#e2e9da] overflow-hidden">
          <div className="p-4 border-b border-[#e2e9da]">
            <h4 className="text-sm font-bold text-[#3e5432]">Salary history for {name}</h4>
            <p className="text-[13px] text-[#7d8e70]">Every pay period, newest first. Use the icon to download a payslip.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-[#f8faf5] text-[#7d8e70] font-semibold border-b border-[#e2e9da] text-[11px]">
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
              <tbody className="divide-y divide-[#e2e9da] text-[#3e5432]">
                {paged.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-[#7d8e70]">
                      No salary statements yet. Create a draft from the Monthly Processing tab.
                    </td>
                  </tr>
                ) : (
                  paged.map((rec) => (
                    <tr key={rec.id || `${rec.year}-${rec.month}`} className="hover:bg-[#f8faf5]">
                      <td className="py-3.5 px-4 font-bold">{rec.month} {rec.year}</td>
                      <td className="py-3.5 px-4 text-[#7d8e70]">{rec.pay_date || '-'}</td>
                      <td className="py-3.5 px-4 font-mono">{inr(rec.monthly_gross)}</td>
                      <td className="py-3.5 px-4 text-[#DC2626]">{inr(rec.total_deductions)}</td>
                      <td className="py-3.5 px-4 font-bold text-[#486537]">{inr(rec.monthly_net)}</td>
                      <td className="py-3.5 px-4">
                        <Badge variant={isFinal(rec) ? 'success' : 'warning'}>{rec.status || 'Draft'}</Badge>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <DownloadIconButton
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
