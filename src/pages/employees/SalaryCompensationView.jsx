import React, { useState, useEffect } from 'react';
import {
  Download,
  Edit,
  Save,
  CheckCircle2,
  Plus,
  Trash2,
  FileText,
  CreditCard,
  Building,
  Calendar,
  DollarSign,
  Shield,
  AlertCircle,
  Clock,
  Sparkles
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  MONTHS,
  YEARS,
  getMonthlySalary,
  saveMonthlySalary,
  getInitialMonthlyRecord
} from '../../lib/salaryStore';
import { payslipApi, issueEmployeePayslip } from '../../lib/payslipApi';

export function SalaryCompensationView({
  employee,
  onShowToast,
  isDossierPage = false
}) {
  const [selectedYear, setSelectedYear] = useState('2026');
  const [selectedMonth, setSelectedMonth] = useState('September');

  // Load record for selected month and year
  const [salaryRecord, setSalaryRecord] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);

  // New Custom Row State while editing
  const [newCustomRowName, setNewCustomRowName] = useState('');
  const [newCustomRowAmount, setNewCustomRowAmount] = useState(5000);
  const [newCustomRowType, setNewCustomRowType] = useState('earning'); // 'earning' or 'deduction'

  // Load data whenever employee, year, or month changes
  useEffect(() => {
    if (!employee?.userid) return;
    const record = getMonthlySalary(employee.userid, selectedYear, selectedMonth);
    setSalaryRecord(record);
    setIsEditing(false);
  }, [employee?.userid, selectedYear, selectedMonth]);

  // When entering edit mode, populate editForm
  useEffect(() => {
    if (salaryRecord) {
      setEditForm({
        ...salaryRecord,
        custom_earnings: salaryRecord.custom_earnings || [],
        custom_deductions: salaryRecord.custom_deductions || []
      });
    }
  }, [salaryRecord]);

  // Initialize data for month if none exists
  const handleInitializeMonth = () => {
    const initial = getInitialMonthlyRecord(employee.userid, selectedYear, selectedMonth);
    const saved = saveMonthlySalary(employee.userid, selectedYear, selectedMonth, initial);
    setSalaryRecord(saved);
    setEditForm({
      ...saved,
      custom_earnings: [],
      custom_deductions: []
    });
    if (onShowToast) {
      onShowToast({
        type: 'success',
        title: 'Payroll Initialized',
        message: `Generated salary structure for ${selectedMonth} ${selectedYear}.`
      });
    }
  };

  // Add dynamic custom row while editing
  const handleAddCustomRow = () => {
    if (!newCustomRowName || !editForm) return;

    const row = {
      id: `custom-${Date.now()}`,
      name: newCustomRowName,
      amount: Number(newCustomRowAmount || 0)
    };

    if (newCustomRowType === 'earning') {
      setEditForm({
        ...editForm,
        custom_earnings: [...(editForm.custom_earnings || []), row]
      });
    } else {
      setEditForm({
        ...editForm,
        custom_deductions: [...(editForm.custom_deductions || []), row]
      });
    }

    setNewCustomRowName('');
    setNewCustomRowAmount(5000);
  };

  // Remove custom row
  const handleRemoveCustomRow = (rowId, type) => {
    if (!editForm) return;
    if (type === 'earning') {
      setEditForm({
        ...editForm,
        custom_earnings: (editForm.custom_earnings || []).filter((r) => r.id !== rowId)
      });
    } else {
      setEditForm({
        ...editForm,
        custom_deductions: (editForm.custom_deductions || []).filter((r) => r.id !== rowId)
      });
    }
  };

  // Save changes on click and save
  const handleSaveSalary = async () => {
    if (!editForm || !employee?.userid) return;
    try {
      const issued = await payslipApi.saveSalary({ employee, salary: editForm, month: selectedMonth, year: selectedYear });
      const saved = saveMonthlySalary(employee.userid, selectedYear, selectedMonth, editForm);
      setSalaryRecord(saved); setIsEditing(false);
      window.dispatchEvent(new Event('payslip-records-changed'));
      onShowToast?.({ type: issued.status === 'failed' ? 'warning' : 'success', title: 'Salary saved', message: issued.status === 'failed' ? issued.error : issued.status === 'ready' ? 'Payslip stored in R2 and available in Payroll & CTC.' : 'Salary saved; payslip generation is pending.' });
    } catch (error) { onShowToast?.({ type: 'error', title: 'Salary was not saved', message: error.message }); }
  };

  // Download PDF
  const handleDownloadPDF = async () => {
    if (!salaryRecord) return;
    try {
      await issueEmployeePayslip(employee, salaryRecord, selectedMonth, selectedYear, true);

      if (onShowToast) {
        onShowToast({
          type: 'success',
          title: 'Payslip PDF Downloaded',
          message: `Salary slip for ${selectedMonth} ${selectedYear} saved to downloads.`
        });
      }
    } catch (err) {
      if (onShowToast) {
        onShowToast({
          type: 'error',
          title: 'PDF Download Failed',
          message: err.message
        });
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header Card: Month and Year 2 Dropdowns & Download Action */}
      <div className="bg-[#FFFFFF] p-4 rounded-xl border border-[#E5E7EB] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-[#27292C]">
              Salary & Statutory Compensation Breakdown
            </h3>
            {salaryRecord ? (
              <Badge variant="success">Available • Disbursed</Badge>
            ) : (
              <Badge variant="neutral">No Record Available</Badge>
            )}
          </div>
          <p className="text-[13px] text-[#5F6368] mt-0.5">
            Select Year and Month to view available monthly payroll slips, edit line items, and generate official PDF.
          </p>
        </div>

        {/* 2 DROPDOWNS: MONTH AND YEAR */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-semibold text-[#5F6368]">Month:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="text-[13px] font-semibold bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-[#27292C] focus:ring-1 focus:ring-[#27292C]"
            >
              {MONTHS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-semibold text-[#5F6368]">Year:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="text-[13px] font-semibold bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-[#27292C] focus:ring-1 focus:ring-[#27292C]"
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Action Buttons */}
          {salaryRecord && (
            <div className="flex items-center gap-2">
              <Button
                variant={isEditing ? 'secondary' : 'secondary'}
                size="sm"
                icon={isEditing ? CheckCircle2 : Edit}
                onClick={() => {
                  if (isEditing) {
                    handleSaveSalary();
                  } else {
                    setIsEditing(true);
                  }
                }}
              >
                {isEditing ? 'Save on Click' : 'Edit Salary'}
              </Button>

              <Button
                variant="primary"
                size="sm"
                icon={Download}
                className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-xs"
                onClick={handleDownloadPDF}
              >
                Download PDF
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Case 1: No Data Available for this month */}
      {!salaryRecord ? (
        <div className="p-8 rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-[#F3F4F6] text-[#9CA3AF] flex items-center justify-center mx-auto">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[#27292C]">
              No Available Salary Record for {selectedMonth} {selectedYear}
            </h4>
            <p className="text-[13px] text-[#5F6368] max-w-md mx-auto mt-1">
              Currently showing only recorded payroll data. No disbursal record was logged for this period yet.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={handleInitializeMonth}
          >
            Initialize & Generate Payroll for {selectedMonth} {selectedYear}
          </Button>
        </div>
      ) : (
        /* Case 2: Available Data Found */
        <div className="space-y-4">
          {/* Top KPI Cards: Annual CTC, Monthly Gross, Net In-Hand */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[13px]">
            <div className="p-4 rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] shadow-xs">
              <span className="text-[#5F6368] font-medium">Annual CTC Package</span>
              <p className="text-2xl font-bold text-[#27292C] mt-1">
                ₹{((salaryRecord.monthly_gross || 87000) * 12).toLocaleString('en-IN')}
              </p>
              <span className="text-[11px] text-[#000000] font-semibold mt-1 inline-block">
                Per Annum Cost to Company
              </span>
            </div>

            <div className="p-4 rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] shadow-xs">
              <span className="text-[#5F6368] font-medium">Monthly Gross Earnings</span>
              <p className="text-2xl font-bold text-[#000000] mt-1">
                +₹{(salaryRecord.monthly_gross || 87000).toLocaleString('en-IN')}
              </p>
              <span className="text-[11px] text-[#5F6368] font-medium mt-1 inline-block">
                Before tax & statutory withholdings
              </span>
            </div>

            <div className="p-4 rounded-xl border border-[#000000]/30 bg-[#ECFDF5] shadow-xs">
              <span className="text-[#065F46] font-semibold">Net In-Hand Salary</span>
              <p className="text-2xl font-bold text-[#065F46] mt-1">
                ₹{(salaryRecord.monthly_net || 62000).toLocaleString('en-IN')}
              </p>
              <span className="text-[11px] text-[#059669] font-medium mt-1 inline-block">
                Disbursed to {salaryRecord.bank_name || 'HDFC Bank'} ({salaryRecord.bank_account || '•••• 9842'})
              </span>
            </div>
          </div>

          {/* EDIT FORM VIEW */}
          {isEditing && editForm ? (
            <div className="p-5 rounded-xl border border-[#2563EB]/40 bg-[#FFFFFF] shadow-sm space-y-4 text-[13px]">
              <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2.5">
                <div>
                  <h4 className="text-sm font-bold text-[#27292C]">
                    Edit Salary Figures for {selectedMonth} {selectedYear}
                  </h4>
                  <p className="text-[#5F6368]">
                    Adjust earnings and deductions. Net salary will automatically recalculate upon saving.
                  </p>
                </div>
                <Badge variant="info">Edit Mode Active</Badge>
              </div>

              {/* Standard Line Items Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold text-[#27292C] mb-1">
                    Basic Salary (₹) *
                  </label>
                  <input
                    type="number"
                    value={editForm.basic}
                    onChange={(e) => setEditForm({ ...editForm, basic: Number(e.target.value) })}
                    className="w-full text-[13px] font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#27292C] mb-1">
                    House Rent Allowance - HRA (₹) *
                  </label>
                  <input
                    type="number"
                    value={editForm.hra}
                    onChange={(e) => setEditForm({ ...editForm, hra: Number(e.target.value) })}
                    className="w-full text-[13px] font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#27292C] mb-1">
                    Special / Flexi Allowance (₹) *
                  </label>
                  <input
                    type="number"
                    value={editForm.special_allowance}
                    onChange={(e) =>
                      setEditForm({ ...editForm, special_allowance: Number(e.target.value) })
                    }
                    className="w-full text-[13px] font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#27292C] mb-1">
                    Conveyance Allowance (₹) *
                  </label>
                  <input
                    type="number"
                    value={editForm.conveyance}
                    onChange={(e) =>
                      setEditForm({ ...editForm, conveyance: Number(e.target.value) })
                    }
                    className="w-full text-[13px] font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#27292C] mb-1">
                    Medical Allowance (₹) *
                  </label>
                  <input
                    type="number"
                    value={editForm.medical_allowance}
                    onChange={(e) =>
                      setEditForm({ ...editForm, medical_allowance: Number(e.target.value) })
                    }
                    className="w-full text-[13px] font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#27292C] mb-1">
                    Employee PF (Provident Fund) (₹) *
                  </label>
                  <input
                    type="number"
                    value={editForm.pf_deduction}
                    onChange={(e) =>
                      setEditForm({ ...editForm, pf_deduction: Number(e.target.value) })
                    }
                    className="w-full text-[13px] font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#27292C] mb-1">
                    Professional Tax (PT) (₹) *
                  </label>
                  <input
                    type="number"
                    value={editForm.professional_tax}
                    onChange={(e) =>
                      setEditForm({ ...editForm, professional_tax: Number(e.target.value) })
                    }
                    className="w-full text-[13px] font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#27292C] mb-1">
                    Income Tax (TDS) (₹) *
                  </label>
                  <input
                    type="number"
                    value={editForm.tds_tax}
                    onChange={(e) =>
                      setEditForm({ ...editForm, tds_tax: Number(e.target.value) })
                    }
                    className="w-full text-[13px] font-mono"
                  />
                </div>
              </div>

              {/* Dynamic Custom Rows (Additions / Deductions) */}
              <div className="pt-3 border-t border-[#E5E7EB] space-y-3">
                <span className="font-bold text-[#27292C] block">
                  Add Dynamic Custom Salary Row for this Employee:
                </span>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={newCustomRowType}
                    onChange={(e) => setNewCustomRowType(e.target.value)}
                    className="text-[13px] h-9"
                  >
                    <option value="earning">Addition (Earning)</option>
                    <option value="deduction">Deduction (Withholding)</option>
                  </select>

                  <input
                    type="text"
                    placeholder="Component row name (e.g. Performance Incentive)"
                    value={newCustomRowName}
                    onChange={(e) => setNewCustomRowName(e.target.value)}
                    className="text-[13px] flex-1 min-w-[200px]"
                  />

                  <input
                    type="number"
                    placeholder="Amount in ₹"
                    value={newCustomRowAmount}
                    onChange={(e) => setNewCustomRowAmount(e.target.value)}
                    className="text-[13px] w-32 font-mono"
                  />

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    icon={Plus}
                    onClick={handleAddCustomRow}
                  >
                    Add Row
                  </Button>
                </div>

                {/* Render Custom Rows */}
                {((editForm.custom_earnings || []).length > 0 ||
                  (editForm.custom_deductions || []).length > 0) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      {editForm.custom_earnings?.map((row) => (
                        <div
                          key={row.id}
                          className="p-2 rounded bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-between"
                        >
                          <span className="font-semibold text-[#166534]">
                            + {row.name}: ₹{row.amount?.toLocaleString('en-IN')}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomRow(row.id, 'earning')}
                            className="text-[#EF4444] hover:underline cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      {editForm.custom_deductions?.map((row) => (
                        <div
                          key={row.id}
                          className="p-2 rounded bg-[#FEF2F2] border border-[#FECACA] flex items-center justify-between"
                        >
                          <span className="font-semibold text-[#991B1B]">
                            - {row.name}: ₹{row.amount?.toLocaleString('en-IN')}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomRow(row.id, 'deduction')}
                            className="text-[#EF4444] hover:underline cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-[#E5E7EB]">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={Save}
                  onClick={handleSaveSalary}
                >
                  Save and Recalculate
                </Button>
              </div>
            </div>
          ) : (
            /* READ-ONLY BREAKDOWN TABLES VIEW */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[13px]">
              {/* Earnings (Additions) */}
              <div className="border border-[#E5E7EB] rounded-xl p-4 bg-[#FFFFFF] space-y-2.5 shadow-xs">
                <div className="font-bold text-[#27292C] border-b border-[#E5E7EB] pb-2 flex justify-between items-center">
                  <span>Monthly Earnings (Additions)</span>
                  <span className="text-[#000000] text-sm font-bold">
                    +₹{(salaryRecord.monthly_gross || 87000).toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="flex justify-between py-1.5 border-b border-[#F3F4F6]">
                  <span className="text-[#5F6368]">Basic Salary</span>
                  <span className="font-semibold text-[#27292C]">
                    ₹{(salaryRecord.basic || 12000).toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="flex justify-between py-1.5 border-b border-[#F3F4F6]">
                  <span className="text-[#5F6368]">House Rent Allowance (HRA)</span>
                  <span className="font-semibold text-[#27292C]">
                    ₹{(salaryRecord.hra || 37500).toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="flex justify-between py-1.5 border-b border-[#F3F4F6]">
                  <span className="text-[#5F6368]">Special / Flexi Allowance</span>
                  <span className="font-semibold text-[#27292C]">
                    ₹{(salaryRecord.special_allowance || 27500).toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="flex justify-between py-1.5 border-b border-[#F3F4F6]">
                  <span className="text-[#5F6368]">Conveyance & Medical</span>
                  <span className="font-semibold text-[#27292C]">
                    ₹{((Number(salaryRecord.conveyance || 5000)) + Number(salaryRecord.medical_allowance || 5000)).toLocaleString('en-IN')}
                  </span>
                </div>

                {/* Any dynamic custom additions */}
                {(salaryRecord.custom_earnings || []).map((row) => (
                  <div key={row.id} className="flex justify-between py-1.5 border-b border-[#F3F4F6]">
                    <span className="text-[#2563EB] font-medium">{row.name}</span>
                    <span className="font-semibold text-[#000000]">
                      +₹{Number(row.amount || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>

              {/* Deductions (Subtractions) */}
              <div className="border border-[#E5E7EB] rounded-xl p-4 bg-[#FFFFFF] space-y-2.5 shadow-xs">
                <div className="font-bold text-[#27292C] border-b border-[#E5E7EB] pb-2 flex justify-between items-center">
                  <span>Statutory Deductions</span>
                  <span className="text-[#EF4444] text-sm font-bold">
                    -₹{(salaryRecord.total_deductions || 25000).toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="flex justify-between py-1.5 border-b border-[#F3F4F6]">
                  <span className="text-[#5F6368]">Provident Fund (PF - Employee)</span>
                  <span className="font-semibold text-[#EF4444]">
                    ₹{(salaryRecord.pf_deduction || 9000).toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="flex justify-between py-1.5 border-b border-[#F3F4F6]">
                  <span className="text-[#5F6368]">Professional Tax (PT)</span>
                  <span className="font-semibold text-[#EF4444]">
                    ₹{salaryRecord.professional_tax || 200}
                  </span>
                </div>

                <div className="flex justify-between py-1.5 border-b border-[#F3F4F6]">
                  <span className="text-[#5F6368]">Income Tax (TDS)</span>
                  <span className="font-semibold text-[#EF4444]">
                    ₹{(salaryRecord.tds_tax || 15800).toLocaleString('en-IN')}
                  </span>
                </div>

                {/* Any dynamic custom deductions */}
                {(salaryRecord.custom_deductions || []).map((row) => (
                  <div key={row.id} className="flex justify-between py-1.5 border-b border-[#F3F4F6]">
                    <span className="text-[#EF4444] font-medium">{row.name}</span>
                    <span className="font-semibold text-[#EF4444]">
                      -₹{Number(row.amount || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
