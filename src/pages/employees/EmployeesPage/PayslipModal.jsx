import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Avatar } from '../../../components/ui/Avatar';
import { MONTHS, YEARS, getMonthlySalary, getInitialMonthlyRecord } from '../../../lib/salaryStore';

export function PayslipModal({
  isOpen,
  onClose,
  employee,
  onDownload
}) {
  const [slipMonth, setSlipMonth] = useState('September');
  const [slipYear, setSlipYear] = useState('2026');

  if (!employee) return null;

  const record =
    getMonthlySalary(employee.userid, slipYear, slipMonth) ||
    getInitialMonthlyRecord(employee.userid, slipYear, slipMonth);

  const handleDownload = () => {
    onDownload({
      employee,
      record,
      month: slipMonth,
      year: slipYear
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Download Salary Payslip (PDF)"
      size="md"
    >
      <div className="space-y-4">
        {/* Employee Summary Card */}
        <div className="flex items-center gap-3 p-3.5 rounded-xl border border-[#E5E7EB] bg-[#FAFAFA]">
          <Avatar
            name={`${employee.first_name} ${employee.last_name}`}
            src={employee.profile_pic_url}
            size="md"
            avatarId={employee.avatar_id}
          />
          <div className="flex-1 min-w-0">
            <h4 className="text-sm text-[#27292C] truncate">
              {employee.first_name} {employee.last_name}
            </h4>
            <p className="text-[13px] text-[#5F6368] font-mono">
              {employee.userid} • {employee.designation || 'Staff'}
            </p>
            <p className="text-[11px] text-[#5F6368] truncate">
              Disbursal: {record.bank_name || 'HDFC Bank Ltd'} ({record.bank_account || '•••• •••• 9842'})
            </p>
          </div>
        </div>

        {/* Month & Year Selection */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[13px] font-semibold text-[#27292C] mb-1">
              Select Month
            </label>
            <select
              value={slipMonth}
              onChange={(e) => setSlipMonth(e.target.value)}
              className="w-full text-[13px] h-9 rounded-lg border border-[#E5E7EB] bg-[#FFFFFF] px-2.5"
            >
              {MONTHS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#27292C] mb-1">
              Select Year
            </label>
            <select
              value={slipYear}
              onChange={(e) => setSlipYear(e.target.value)}
              className="w-full text-[13px] h-9 rounded-lg border border-[#E5E7EB] bg-[#FFFFFF] px-2.5"
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Salary Breakdown Summary Card */}
        <div className="p-3.5 rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] space-y-2 text-[13px]">
          <div className="flex justify-between items-center border-b border-[#F3F4F6] pb-1.5">
            <span className="text-[#5F6368]">Monthly Gross Earnings (Additions):</span>
            <span className="text-[#000000]">
              +₹{(record.monthly_gross || 87000).toLocaleString('en-IN')}
            </span>
          </div>
          <div className="flex justify-between items-center border-b border-[#F3F4F6] pb-1.5">
            <span className="text-[#5F6368]">Statutory Deductions (PF, PT, TDS):</span>
            <span className="text-[#EF4444]">
              -₹{(record.total_deductions || 25000).toLocaleString('en-IN')}
            </span>
          </div>
          <div className="flex justify-between items-center pt-1 text-sm">
            <span className="text-[#27292C]">Net Disbursed Take-Home:</span>
            <span className="text-[#065F46] bg-[#ECFDF5] px-2 py-0.5 rounded">
              ₹{(record.monthly_net || 62000).toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E7EB]">
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            id="btn-confirm-download-pdf"
            variant="primary"
            size="sm"
            icon={Download}
            onClick={handleDownload}
          >
            Download {slipMonth} Payslip (PDF)
          </Button>
        </div>
      </div>
    </Modal>
  );
}
