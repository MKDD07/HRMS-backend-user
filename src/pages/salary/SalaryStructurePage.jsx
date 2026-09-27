import { PayslipStudio } from '../../components/payroll/PayslipStudio';
import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Plus,
  Trash2,
  Edit,
  Save,
  CheckCircle2,
  Sliders,
  Layers,
  Users,
  Shield,
  FileText,
  CreditCard,
  Building,
  HelpCircle,
  Search,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Percent
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { FilterBar } from '../../components/ui/FilterBar';
import {
  getAllSalarySchemas,
  saveSalarySchema,
  deleteSalarySchema
} from '../../lib/salaryStore';

function SalaryComponentsPage({ api, onShowToast, onSelectEmployee }) {
  const [schemas, setSchemas] = useState(getAllSalarySchemas());
  const [selectedSchemaId, setSelectedSchemaId] = useState(
    schemas[0]?.salary_id || 'SAL-1001'
  );
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [searchEmployee, setSearchEmployee] = useState('');

  // Active schema object
  const activeSchema =
    schemas.find((s) => s.salary_id === selectedSchemaId) || schemas[0] || {};

  // Modals
  const [isAddSchemaModalOpen, setIsAddSchemaModalOpen] = useState(false);
  const [isAddRowModalOpen, setIsAddRowModalOpen] = useState(false);
  const [newRowCategory, setNewRowCategory] = useState('earnings'); // 'earnings' or 'deductions'
  const [rowName, setRowName] = useState('');
  const [rowCode, setRowCode] = useState('');
  const [rowType, setRowType] = useState('Fixed');
  const [rowDefaultAmount, setRowDefaultAmount] = useState(5000);
  const [rowTaxable, setRowTaxable] = useState(true);

  // New Schema Modal Form
  const [newSchemaId, setNewSchemaId] = useState('SAL-1004');
  const [newSchemaName, setNewSchemaName] = useState('');
  const [newSchemaGrade, setNewSchemaGrade] = useState('L3 / Associate Specialist');
  const [newSchemaDesc, setNewSchemaDesc] = useState('');
  const [newSchemaRange, setNewSchemaRange] = useState('₹8,00,000 - ₹15,00,000');

  // Load employees from API
  useEffect(() => {
    async function fetchUsers() {
      setLoadingEmployees(true);
      try {
        if (api?.getAllUsers) {
          const res = await api.getAllUsers();
          if (res?.data) {
            setEmployees(res.data);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingEmployees(false);
      }
    }
    fetchUsers();
  }, [api]);

  // Handle Add New Row to selected Schema
  const handleAddNewRow = (e) => {
    e.preventDefault();
    if (!rowName) return;

    const newRow = {
      id: `row-${Date.now()}`,
      name: rowName,
      code: rowCode || rowName.toUpperCase().replace(/[^A-Z0-9]/g, '_').substring(0, 10),
      type: rowType,
      default_amount: Number(rowDefaultAmount || 0),
      is_taxable: rowTaxable,
      is_statutory: false
    };

    const updated = { ...activeSchema };
    if (newRowCategory === 'earnings') {
      updated.earnings_rows = [...(updated.earnings_rows || []), newRow];
    } else {
      updated.deductions_rows = [...(updated.deductions_rows || []), newRow];
    }

    const savedList = saveSalarySchema(updated);
    setSchemas(savedList);
    setIsAddRowModalOpen(false);
    setRowName('');
    setRowCode('');
    setRowDefaultAmount(5000);

    if (onShowToast) {
      onShowToast({
        type: 'success',
        title: 'Salary Row Added',
        message: `Added "${newRow.name}" to schema ${activeSchema.salary_id}.`
      });
    }
  };

  // Handle Delete Row
  const handleDeleteRow = (rowId, category) => {
    const updated = { ...activeSchema };
    if (category === 'earnings') {
      updated.earnings_rows = (updated.earnings_rows || []).filter((r) => r.id !== rowId);
    } else {
      updated.deductions_rows = (updated.deductions_rows || []).filter((r) => r.id !== rowId);
    }
    const savedList = saveSalarySchema(updated);
    setSchemas(savedList);

    if (onShowToast) {
      onShowToast({
        type: 'info',
        title: 'Row Removed',
        message: `Component removed from ${activeSchema.salary_id}.`
      });
    }
  };

  // Handle Create New Schema
  const handleCreateSchema = (e) => {
    e.preventDefault();
    if (!newSchemaId || !newSchemaName) return;

    const schemaToSave = {
      salary_id: newSchemaId.trim().toUpperCase(),
      name: newSchemaName,
      description: newSchemaDesc || 'Customized enterprise compensation schema.',
      grade: newSchemaGrade,
      annual_base_range: newSchemaRange,
      currency: 'INR',
      assigned_count: 0,
      earnings_rows: [
        { id: `row-e1-${Date.now()}`, name: 'Basic Salary', code: 'BASIC', type: 'Fixed', default_amount: 12000, is_taxable: true },
        { id: `row-e2-${Date.now()}`, name: 'House Rent Allowance (HRA)', code: 'HRA', type: '% of Basic', default_amount: 37500, is_taxable: false },
        { id: `row-e3-${Date.now()}`, name: 'Special / Flexi Allowance', code: 'SPECIAL', type: 'Fixed', default_amount: 27500, is_taxable: true },
        { id: `row-e4-${Date.now()}`, name: 'Conveyance & Medical', code: 'CONV_MED', type: 'Fixed', default_amount: 10000, is_taxable: false }
      ],
      deductions_rows: [
        { id: `row-d1-${Date.now()}`, name: 'Provident Fund (PF - Employee)', code: 'PF_EMP', type: 'Statutory 12%', default_amount: 9000, is_statutory: true },
        { id: `row-d2-${Date.now()}`, name: 'Professional Tax (PT)', code: 'PT', type: 'State Statutory', default_amount: 200, is_statutory: true },
        { id: `row-d3-${Date.now()}`, name: 'Income Tax (TDS)', code: 'TDS', type: 'Income Bracket', default_amount: 15800, is_statutory: true }
      ]
    };

    const savedList = saveSalarySchema(schemaToSave);
    setSchemas(savedList);
    setSelectedSchemaId(schemaToSave.salary_id);
    setIsAddSchemaModalOpen(false);

    // Reset Form
    setNewSchemaName('');
    setNewSchemaDesc('');
    setNewSchemaId(`SAL-${Math.floor(1000 + Math.random() * 9000)}`);

    if (onShowToast) {
      onShowToast({
        type: 'success',
        title: 'New Salary ID Schema Created',
        message: `Plan ${schemaToSave.salary_id} is now available for payroll.`
      });
    }
  };

  // Calculate live preview metrics for selected activeSchema
  const previewGross = (activeSchema.earnings_rows || []).reduce(
    (sum, r) => sum + Number(r.default_amount || 0),
    0
  );
  const previewDeductions = (activeSchema.deductions_rows || []).reduce(
    (sum, r) => sum + Number(r.default_amount || 0),
    0
  );
  const previewNet = previewGross - previewDeductions;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Salary & Component Builder"
        subtitle="Manage salary schemas by salary_id, add dynamic earnings & deduction rows, and customize pay structures per employee."
        breadcrumbs={['HRMS', 'Payroll', 'Edit Salary & Structure']}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={Plus}
              onClick={() => {
                setNewRowCategory('earnings');
                setIsAddRowModalOpen(true);
              }}
            >
              Add New Salary Row
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Sliders}
              onClick={() => setIsAddSchemaModalOpen(true)}
            >
              Create New Salary ID
            </Button>
          </div>
        }
      />

      {/* Top Banner: Schema Selector */}
      <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#E5E7EB] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-[#5F6368] uppercase tracking-wider">
              Active Schema:
            </span>
            <span className="text-sm font-bold px-2.5 py-0.5 rounded bg-[#27292C] text-[#FFFFFF]">
              {activeSchema.salary_id}
            </span>
            <span className="text-sm font-bold text-[#27292C]">
              {activeSchema.name}
            </span>
          </div>
          <p className="text-[13px] text-[#5F6368]">
            {activeSchema.description} • Grade: <span className="font-semibold text-[#27292C]">{activeSchema.grade}</span>
          </p>
        </div>

        {/* Schema Switcher Dropdown */}
        <div className="flex items-center gap-3">
          <label className="text-[13px] font-semibold text-[#27292C] whitespace-nowrap">
            Select Salary ID:
          </label>
          <select
            value={selectedSchemaId}
            onChange={(e) => setSelectedSchemaId(e.target.value)}
            className="filter-bar__select text-[13px] font-bold"
          >
            {schemas.map((s) => (
              <option key={s.salary_id} value={s.salary_id}>
                {s.salary_id} - {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary KPI Cards for Active Schema */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-[13px]">
        <div className="p-4 rounded-xl border border-[#E5E7EB] bg-[#FFFFFF]">
          <span className="text-[#5F6368] block">Configured Schema ID</span>
          <span className="text-xl font-bold text-[#2563EB] mt-0.5 block">
            {activeSchema.salary_id}
          </span>
          <span className="text-[11px] text-[#5F6368] mt-1 block">
            {activeSchema.assigned_count || 42} employees mapped
          </span>
        </div>

        <div className="p-4 rounded-xl border border-[#E5E7EB] bg-[#FFFFFF]">
          <span className="text-[#5F6368] block">Standard Monthly Gross</span>
          <span className="text-xl font-bold text-[#000000] mt-0.5 block">
            ₹{previewGross.toLocaleString('en-IN')}
          </span>
          <span className="text-[11px] text-[#5F6368] mt-1 block">
            {activeSchema.earnings_rows?.length || 0} addition rows
          </span>
        </div>

        <div className="p-4 rounded-xl border border-[#E5E7EB] bg-[#FFFFFF]">
          <span className="text-[#5F6368] block">Standard Deductions</span>
          <span className="text-xl font-bold text-[#EF4444] mt-0.5 block">
            -₹{previewDeductions.toLocaleString('en-IN')}
          </span>
          <span className="text-[11px] text-[#5F6368] mt-1 block">
            {activeSchema.deductions_rows?.length || 0} deduction rows
          </span>
        </div>

        <div className="p-4 rounded-xl border border-[#000000]/30 bg-[#ECFDF5]">
          <span className="text-[#065F46] block font-semibold">Net Standard Pay</span>
          <span className="text-xl font-bold text-[#065F46] mt-0.5 block">
            ₹{previewNet.toLocaleString('en-IN')}
          </span>
          <span className="text-[11px] text-[#059669] mt-1 block">
            Annual: ₹{(previewGross * 12).toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      {/* Grid: Earnings Rows (Left) & Deductions Rows (Right) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* EARNINGS ROWS (ADDITIONS) */}
        <div className="p-5 rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] space-y-3">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#27292C] flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-[#000000]" />
                Earnings Components (Additions)
              </h3>
              <p className="text-[13px] text-[#5F6368]">
                Customizable addition rows for salary schema {activeSchema.salary_id}
              </p>
            </div>

            <Button
              variant="secondary"
              size="sm"
              icon={Plus}
              onClick={() => {
                setNewRowCategory('earnings');
                setIsAddRowModalOpen(true);
              }}
            >
              Add Row
            </Button>
          </div>

          <div className="space-y-2">
            {(activeSchema.earnings_rows || []).map((row) => (
              <div
                key={row.id}
                className="p-3 rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] flex items-center justify-between hover:bg-[#FFFFFF] transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold text-[#27292C]">
                      {row.name}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#E5E7EB] text-[#5F6368]">
                      {row.code}
                    </span>
                    <Badge variant={row.is_taxable ? 'neutral' : 'info'}>
                      {row.is_taxable ? 'Taxable' : 'Exempt'}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-[#5F6368] mt-0.5">
                    Type: <span className="font-semibold text-[#27292C]">{row.type}</span>
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[13px] font-bold text-[#000000]">
                    +₹{Number(row.default_amount || 0).toLocaleString('en-IN')}
                  </span>
                  <button
                    type="button"
                    title="Remove component"
                    onClick={() => handleDeleteRow(row.id, 'earnings')}
                    className="p-1 rounded text-[#9CA3AF] hover:text-[#EF4444] hover:bg-[#FEE2E2] transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-[#E5E7EB] flex justify-between items-center text-[13px] font-bold">
            <span className="text-[#27292C]">Total Monthly Gross:</span>
            <span className="text-[#000000] text-sm">
              +₹{previewGross.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* DEDUCTIONS ROWS */}
        <div className="p-5 rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] space-y-3">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#27292C] flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-[#EF4444]" />
                Statutory Deductions & Taxes
              </h3>
              <p className="text-[13px] text-[#5F6368]">
                Withholdings, PF, Professional Tax, and Income Tax TDS rows
              </p>
            </div>

            <Button
              variant="secondary"
              size="sm"
              icon={Plus}
              onClick={() => {
                setNewRowCategory('deductions');
                setIsAddRowModalOpen(true);
              }}
            >
              Add Row
            </Button>
          </div>

          <div className="space-y-2">
            {(activeSchema.deductions_rows || []).map((row) => (
              <div
                key={row.id}
                className="p-3 rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] flex items-center justify-between hover:bg-[#FFFFFF] transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold text-[#27292C]">
                      {row.name}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#E5E7EB] text-[#5F6368]">
                      {row.code}
                    </span>
                    {row.is_statutory && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FEE2E2] text-[#DC2626] font-semibold">
                        Statutory
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#5F6368] mt-0.5">
                    Type: <span className="font-semibold text-[#27292C]">{row.type}</span>
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[13px] font-bold text-[#EF4444]">
                    -₹{Number(row.default_amount || 0).toLocaleString('en-IN')}
                  </span>
                  <button
                    type="button"
                    title="Remove component"
                    onClick={() => handleDeleteRow(row.id, 'deductions')}
                    className="p-1 rounded text-[#9CA3AF] hover:text-[#EF4444] hover:bg-[#FEE2E2] transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-[#E5E7EB] flex justify-between items-center text-[13px] font-bold">
            <span className="text-[#27292C]">Total Deductions:</span>
            <span className="text-[#EF4444] text-sm">
              -₹{previewDeductions.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </div>

      {/* Employee Mapping Table with Search */}
      <div className="p-5 rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] space-y-4">
        <div>
          <h3 className="text-sm font-bold text-[#27292C]">
            Employees Assigned to Salary Schema {activeSchema.salary_id}
          </h3>
          <p className="text-[13px] text-[#5F6368]">
            Employees mapped to this structure receive these earnings & deduction rows on monthly payslip.
          </p>
        </div>

        <FilterBar
          searchValue={searchEmployee}
          onSearchChange={setSearchEmployee}
          searchPlaceholder="Filter assigned employees by name or ID..."
        />

        <div className="overflow-x-auto">
          <table className="w-full text-[13px] text-left">
            <thead className="bg-[#F9FAFB] text-[#5F6368] font-bold border-b border-[#E5E7EB]">
              <tr>
                <th className="py-2.5 px-3">Employee ID</th>
                <th className="py-2.5 px-3">Name</th>
                <th className="py-2.5 px-3">Department</th>
                <th className="py-2.5 px-3">Designation</th>
                <th className="py-2.5 px-3">Assigned Salary ID</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {employees
                .filter((emp) => {
                  const query = searchEmployee.toLowerCase();
                  return (
                    (emp.first_name || '').toLowerCase().includes(query) ||
                    (emp.last_name || '').toLowerCase().includes(query) ||
                    (emp.userid || '').toLowerCase().includes(query)
                  );
                })
                .slice(0, 8)
                .map((emp) => (
                  <tr key={emp.userid} className="hover:bg-[#FAFAFA]">
                    <td className="py-2.5 px-3 font-bold text-[#2563EB]">
                      {emp.userid}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-[#27292C]">
                      {emp.first_name} {emp.last_name}
                    </td>
                    <td className="py-2.5 px-3 text-[#5F6368]">{emp.department}</td>
                    <td className="py-2.5 px-3 text-[#5F6368]">{emp.designation}</td>
                    <td className="py-2.5 px-3">
                      <span className="text-[13px] font-bold px-2 py-0.5 rounded bg-[#F3F4F6] text-[#27292C]">
                        {activeSchema.salary_id}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {onSelectEmployee && (
                        <button
                          type="button"
                          onClick={() => onSelectEmployee(emp.userid)}
                          className="text-[13px] text-[#2563EB] hover:underline font-semibold cursor-pointer"
                        >
                          View Dossier
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: ADD NEW SALARY ROW */}
      <Modal
        isOpen={isAddRowModalOpen}
        onClose={() => setIsAddRowModalOpen(false)}
        title={`Add New Component Row to ${activeSchema.salary_id}`}
        size="md"
      >
        <form onSubmit={handleAddNewRow} className="space-y-4 text-[13px]">
          <div>
            <label className="block font-semibold text-[#27292C] mb-1">
              Component Category *
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="cat"
                  value="earnings"
                  checked={newRowCategory === 'earnings'}
                  onChange={() => setNewRowCategory('earnings')}
                />
                <span className="font-medium text-[#000000]">Earnings (Addition)</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="cat"
                  value="deductions"
                  checked={newRowCategory === 'deductions'}
                  onChange={() => setNewRowCategory('deductions')}
                />
                <span className="font-medium text-[#EF4444]">Deductions (Subtractions)</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#27292C] mb-1">
              Component Name *
            </label>
            <input
              type="text"
              required
              value={rowName}
              onChange={(e) => setRowName(e.target.value)}
              placeholder="e.g. Remote Work Internet Stipend or Loyalty Bonus"
              className="w-full text-[13px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#27292C] mb-1">
                Component Short Code
              </label>
              <input
                type="text"
                value={rowCode}
                onChange={(e) => setRowCode(e.target.value)}
                placeholder="e.g. STIPEND_NET"
                className="w-full text-[13px] font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#27292C] mb-1">
                Calculation Type
              </label>
              <select
                value={rowType}
                onChange={(e) => setRowType(e.target.value)}
                className="w-full text-[13px] h-9"
              >
                <option value="Fixed">Fixed Monthly Amount</option>
                <option value="% of Basic">% of Basic Pay</option>
                <option value="Variable">Variable / Performance</option>
                <option value="Statutory">Statutory Formula</option>
                <option value="Reimbursement">Tax-Free Reimbursement</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#27292C] mb-1">
                Default Amount (₹ / month) *
              </label>
              <input
                type="number"
                required
                value={rowDefaultAmount}
                onChange={(e) => setRowDefaultAmount(e.target.value)}
                className="w-full text-[13px] font-mono"
              />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-[#27292C]">
                <input
                  type="checkbox"
                  checked={rowTaxable}
                  onChange={(e) => setRowTaxable(e.target.checked)}
                />
                <span>Subject to Income Tax TDS</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E5E7EB]">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsAddRowModalOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" icon={Save} type="submit">
              Save Component Row
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: CREATE NEW SALARY ID SCHEMA */}
      <Modal
        isOpen={isAddSchemaModalOpen}
        onClose={() => setIsAddSchemaModalOpen(false)}
        title="Create New Salary ID Schema"
        size="md"
      >
        <form onSubmit={handleCreateSchema} className="space-y-4 text-[13px]">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#27292C] mb-1">
                Salary ID Number / Code *
              </label>
              <input
                type="text"
                required
                value={newSchemaId}
                onChange={(e) => setNewSchemaId(e.target.value)}
                placeholder="e.g. SAL-1005"
                className="w-full text-[13px] uppercase"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#27292C] mb-1">
                Target Level / Grade
              </label>
              <input
                type="text"
                value={newSchemaGrade}
                onChange={(e) => setNewSchemaGrade(e.target.value)}
                placeholder="e.g. L5 / Lead Engineer"
                className="w-full text-[13px]"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#27292C] mb-1">
              Schema Title / Name *
            </label>
            <input
              type="text"
              required
              value={newSchemaName}
              onChange={(e) => setNewSchemaName(e.target.value)}
              placeholder="e.g. Senior Cloud Architect Compensation Structure"
              className="w-full text-[13px]"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#27292C] mb-1">
              Annual Base CTC Range
            </label>
            <input
              type="text"
              value={newSchemaRange}
              onChange={(e) => setNewSchemaRange(e.target.value)}
              placeholder="e.g. ₹18,00,000 - ₹32,00,000"
              className="w-full text-[13px]"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#27292C] mb-1">
              Description & Notes
            </label>
            <textarea
              rows={3}
              value={newSchemaDesc}
              onChange={(e) => setNewSchemaDesc(e.target.value)}
              placeholder="Describe role applicability, statutory policies, and bonus terms..."
              className="w-full text-[13px]"
            />
          </div>

          <div className="p-3 bg-[#F0FDF4] rounded-lg border border-[#86EFAC] text-[11px] text-[#166534]">
            <strong>Note:</strong> New Schema will initialize with standard components (Basic ₹12,000, HRA ₹37,500, Special ₹27,500, Conveyance & Medical ₹10,000, PF ₹9,000, PT ₹200, TDS ₹15,800), which can then be customized with more or less rows as needed.
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E5E7EB]">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsAddSchemaModalOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" icon={CheckCircle2} type="submit">
              Create Schema Plan
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export function SalaryStructurePage(props) { return <PayslipStudio api={props.api}><SalaryComponentsPage {...props} /></PayslipStudio>; }
