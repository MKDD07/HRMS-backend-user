import React, { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { FilterBar } from '../../../components/ui/FilterBar';
import { Pagination } from '../components/Pagination';
import { DownloadIconButton } from '../components/DownloadIconButton';
import { fullName, getMonthRecord, inr, isFinal } from '../lib/payrollHelpers';

const PAGE_SIZE = 8;

/** Tab 3: whole company for the selected month. */
export function RegisterTab({ users, year, month, version, onDownload }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);

  const data = useMemo(
    () => users.map((employee) => ({ employee, record: getMonthRecord(employee, year, month) })),
    [users, year, month, version]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return data.filter(({ employee, record }) => {
      const hay = `${fullName(employee)} ${employee.userid || ''}`.toLowerCase();
      const label = isFinal(record) ? 'Finalized' : 'Draft';
      return hay.includes(q) && (status === 'ALL' || label === status);
    });
  }, [data, search, status]);

  useEffect(() => setPage(1), [search, status, year, month]);

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const gross = data.reduce((a, d) => a + (d.record.monthly_gross || 0), 0);
  const net = data.reduce((a, d) => a + (d.record.monthly_net || 0), 0);
  const done = data.filter((d) => isFinal(d.record)).length;

  const kpis = [
    ['Total gross payroll', inr(gross), `${month} ${year}`, 'text-[#3e5432]'],
    ['Total net payable', inr(net), 'Bank transfer amount', 'text-[#486537]'],
    ['Finalized', `${done} / ${users.length}`, `${users.length - done} still in draft`, 'text-[#587443]'],
    ['Deductions', inr(gross - net), 'PF, PT, TDS and custom', 'text-[#D97706]']
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(([label, value, note, tone]) => (
          <div key={label} className="card p-4 bg-white border border-[#e2e9da]">
            <span className="text-[13px] font-semibold text-[#7d8e70]">{label}</span>
            <p className={`text-xl font-bold mt-1 ${tone}`}>{value}</p>
            <span className="text-[11px] text-[#7d8e70]">{note}</span>
          </div>
        ))}
      </div>

      <div className="card p-0 bg-white border border-[#e2e9da] overflow-hidden">
        <FilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search employee name or ID..."
          className="border-0 border-b border-[#e2e9da] rounded-none shadow-none"
        >
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="filter-bar__select text-[13px]"
          >
            <option value="ALL">All Statuses</option>
            <option value="Finalized">Finalized</option>
            <option value="Draft">Draft</option>
          </select>
        </FilterBar>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-[#f8faf5] text-[#7d8e70] font-semibold border-b border-[#e2e9da] text-[11px]">
              <tr>
                <th className="py-3.5 px-4">Employee</th>
                <th className="py-3.5 px-4">Department</th>
                <th className="py-3.5 px-4">Bank account</th>
                <th className="py-3.5 px-4">Gross</th>
                <th className="py-3.5 px-4">Deductions</th>
                <th className="py-3.5 px-4">Net</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-center">Payslip</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e9da] text-[#3e5432]">
              {paged.length === 0 && (
                <tr><td colSpan={8} className="py-10 text-center text-[#7d8e70]">No records match these filters.</td></tr>
              )}
              {paged.map(({ employee, record }) => (
                <tr key={employee.userid} className="hover:bg-[#f8faf5]">
                  <td className="py-3.5 px-4">
                    <div className="font-bold">{fullName(employee)}</div>
                    <span className="text-[11px] text-[#7d8e70]">{employee.userid}</span>
                  </td>
                  <td className="py-3.5 px-4 text-[#7d8e70]">{employee.department}</td>
                  <td className="py-3.5 px-4 text-[11px] text-[#7d8e70]">{record.bank_account || '•••• 1024'}</td>
                  <td className="py-3.5 px-4 font-mono">{inr(record.monthly_gross)}</td>
                  <td className="py-3.5 px-4 text-[#DC2626]">{inr(record.total_deductions)}</td>
                  <td className="py-3.5 px-4 font-bold text-[#486537]">{inr(record.monthly_net)}</td>
                  <td className="py-3.5 px-4">
                    <Badge variant={isFinal(record) ? 'success' : 'warning'}>{isFinal(record) ? 'Finalized' : 'Draft'}</Badge>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <DownloadIconButton title={`Download ${employee.first_name}'s payslip`} onClick={() => onDownload(employee, record)} />
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
