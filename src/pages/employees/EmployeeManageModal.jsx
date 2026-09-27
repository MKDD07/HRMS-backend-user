import React, { useState, useEffect } from 'react';
import {
  Calendar,
  CreditCard,
  TrendingUp,
  FileText,
  Edit,
  Download,
  Upload,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Shield,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Save,
  DollarSign,
  User,
  Building,
  Briefcase,
  Layers,
  MapPin,
  Phone,
  Mail
} from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import {
  getStoredDocuments,
  saveStoredDocuments,
  downloadDocument,
  getEmployeeSalary,
  saveEmployeeSalary,
  getEmployeeKpiKri,
  saveEmployeeKpiKri,
  generateMonthAttendance
} from './employeeDataHelpers';
import { SalaryCompensationView } from './SalaryCompensationView';

export function EmployeeManageModal({
  isOpen,
  onClose,
  employee,
  onActionCompleted,
  onShowToast,
  onSelectEmployee
}) {
  if (!employee) return null;

  const [activeTab, setActiveTab] = useState('attendance');
  const [submitting, setSubmitting] = useState(false);

  // -------------------------------------------------------------
  // ATTENDANCE CALENDAR STATE
  // -------------------------------------------------------------
  const [selectedMonth, setSelectedMonth] = useState('September 2026');
  const [attendanceDays, setAttendanceDays] = useState([]);
  const [selectedDayDetail, setSelectedDayDetail] = useState(null);
  const [isAdjustPunchOpen, setIsAdjustPunchOpen] = useState(false);
  const [punchCheckIn, setPunchCheckIn] = useState('09:15 AM');
  const [punchCheckOut, setPunchCheckOut] = useState('06:30 PM');

  // -------------------------------------------------------------
  // SALARY & COMPENSATION STATE
  // -------------------------------------------------------------
  const [salaryData, setSalaryData] = useState(getEmployeeSalary(employee.userid));
  const [isEditingSalary, setIsEditingSalary] = useState(false);
  const [editSalaryForm, setEditSalaryForm] = useState({ ...salaryData });

  // -------------------------------------------------------------
  // KPI & KRI PERFORMANCE STATE
  // -------------------------------------------------------------
  const [kpiKriData, setKpiKriData] = useState(getEmployeeKpiKri(employee.userid));
  const [isEditingKpiKri, setIsEditingKpiKri] = useState(false);
  const [overallScore, setOverallScore] = useState(kpiKriData.overall_rating);

  // -------------------------------------------------------------
  // DOCUMENTS REPOSITORY STATE
  // -------------------------------------------------------------
  const [documents, setDocuments] = useState(getStoredDocuments(employee.userid));
  const [isUploadDocOpen, setIsUploadDocOpen] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocCategory, setNewDocCategory] = useState('Statutory & Compliance');
  const [newDocFormat, setNewDocFormat] = useState('PDF');
  const [newDocDesc, setNewDocDesc] = useState('');

  // -------------------------------------------------------------
  // EDIT ALL PERSON DATA STATE
  // -------------------------------------------------------------
  const [personalForm, setPersonalForm] = useState({
    first_name: employee.first_name || '',
    last_name: employee.last_name || '',
    email: employee.email || '',
    phone_number: employee.phone_number || '',
    designation: employee.designation || '',
    department: employee.department || '',
    status: employee.status || 'Active',
    type: employee.type || 'Employee',
    work_location: employee.work_location || 'HQ Vashi Infotech Park',
    date_of_birth: employee.date_of_birth || '1994-06-15',
    gender: 'Male',
    blood_group: 'B+',
    marital_status: 'Single',
    city: 'Navi Mumbai',
    state: 'Maharashtra',
    address: 'Flat 402, Greenfield Residency, Sector 17, Navi Mumbai',
    bio: `${employee.first_name || 'The employee'} leads critical deliverables across the ${employee.department || 'enterprise'} unit with exemplary dedication.`,
    manager_name: 'Executive Committee (CTO)',
    skills: 'Distributed Systems, Cloudflare D1 SQL, Node.js, Enterprise Security',
    bank_name: 'HDFC Bank Ltd',
    account_no: '50100488219901',
    ifsc_code: 'HDFC0001044',
    pan_card: 'ABCDE1234F',
    aadhar_card: 'XXXX-XXXX-1098'
  });

  useEffect(() => {
    if (employee) {
      setAttendanceDays(generateMonthAttendance(2026, 8)); // Sep 2026
      const s = getEmployeeSalary(employee.userid);
      setSalaryData(s);
      setEditSalaryForm({ ...s });
      const k = getEmployeeKpiKri(employee.userid);
      setKpiKriData(k);
      setOverallScore(k.overall_rating);
      setDocuments(getStoredDocuments(employee.userid));

      setPersonalForm({
        first_name: employee.first_name || '',
        last_name: employee.last_name || '',
        email: employee.email || '',
        phone_number: employee.phone_number || '',
        designation: employee.designation || '',
        department: employee.department || '',
        status: employee.status || 'Active',
        type: employee.type || 'Employee',
        work_location: employee.work_location || 'HQ Vashi Infotech Park',
        date_of_birth: employee.date_of_birth || '1994-06-15',
        gender: employee.gender || 'Male',
        blood_group: employee.blood_group || 'B+',
        marital_status: employee.marital_status || 'Single',
        city: employee.city || 'Navi Mumbai',
        state: employee.state || 'Maharashtra',
        address: employee.address || 'Flat 402, Greenfield Residency, Sector 17, Navi Mumbai',
        bio: employee.bio || `${employee.first_name || 'The employee'} leads critical deliverables with distinction.`,
        manager_name: employee.manager_name || 'Executive Committee (CTO)',
        skills: employee.skills || 'Distributed Systems, Cloudflare D1 SQL, Node.js, Enterprise Security',
        bank_name: employee.bank_name || 'HDFC Bank Ltd',
        account_no: employee.account_no || '50100488219901',
        ifsc_code: employee.ifsc_code || 'HDFC0001044',
        pan_card: employee.pan_card || 'ABCDE1234F',
        aadhar_card: employee.aadhar_card || 'XXXX-XXXX-1098'
      });
    }
  }, [employee]);

  // Handle saving Salary modifications
  const handleSaveSalary = () => {
    const basic = Number(editSalaryForm.basic) || 0;
    const hra = Number(editSalaryForm.hra) || Math.round(basic * 0.5);
    const allowance = Number(editSalaryForm.special_allowance) || 0;
    const conveyance = Number(editSalaryForm.conveyance) || 5000;
    const gross = basic + hra + allowance + conveyance;
    const pf = Number(editSalaryForm.pf_deduction) || Math.round(basic * 0.12);
    const pt = Number(editSalaryForm.professional_tax) || 200;
    const tds = Number(editSalaryForm.tds_tax) || 0;
    const net = gross - (pf + pt + tds);
    const ctc = gross * 12;

    const updated = {
      ...editSalaryForm,
      basic,
      hra,
      special_allowance: allowance,
      conveyance,
      monthly_gross: gross,
      annual_ctc: ctc,
      pf_deduction: pf,
      professional_tax: pt,
      tds_tax: tds,
      monthly_net: net
    };

    setSalaryData(updated);
    saveEmployeeSalary(employee.userid, updated);
    setIsEditingSalary(false);

    if (onShowToast) {
      onShowToast({
        type: 'success',
        title: 'Salary Structure Updated',
        message: `Updated compensation for ${employee.first_name} ${employee.last_name}: Net ₹${net.toLocaleString()}/mo.`
      });
    }
  };

  // Handle saving KPI/KRI changes
  const handleSaveKpiKri = () => {
    const updated = {
      ...kpiKriData,
      overall_rating: Number(overallScore)
    };
    setKpiKriData(updated);
    saveEmployeeKpiKri(employee.userid, updated);
    setIsEditingKpiKri(false);

    if (onShowToast) {
      onShowToast({
        type: 'success',
        title: 'Performance Scorecard Saved',
        message: `KPI & KRI evaluation score set to ${overallScore} / 5.0.`
      });
    }
  };

  // Handle downloading a document
  const handleDownloadDoc = (doc) => {
    downloadDocument(doc, employee);
    if (onShowToast) {
      onShowToast({
        type: 'info',
        title: 'Document Downloaded',
        message: `Saved ${doc.title} to your local downloads folder.`
      });
    }
  };

  // Handle creating a new document
  const handleAddDocument = (e) => {
    e.preventDefault();
    if (!newDocTitle.trim()) return;

    const newDoc = {
      id: `doc-${Date.now()}`,
      title: newDocTitle.trim(),
      category: newDocCategory,
      format: newDocFormat,
      size: '1.2 MB',
      date: new Date().toISOString().split('T')[0],
      verified: true,
      description: newDocDesc.trim() || 'Uploaded and verified via PulseHRMS enterprise vault.'
    };

    const updated = [newDoc, ...documents];
    setDocuments(updated);
    saveStoredDocuments(employee.userid, updated);
    setIsUploadDocOpen(false);
    setNewDocTitle('');
    setNewDocDesc('');

    if (onShowToast) {
      onShowToast({
        type: 'success',
        title: 'Document Saved & Archived',
        message: `${newDoc.title} uploaded successfully.`
      });
    }
  };

  // Handle deleting a document
  const handleDeleteDoc = (docId) => {
    const updated = documents.filter((d) => d.id !== docId);
    setDocuments(updated);
    saveStoredDocuments(employee.userid, updated);

    if (onShowToast) {
      onShowToast({
        type: 'info',
        title: 'Document Removed',
        message: 'The selected document record was removed from the vault.'
      });
    }
  };

  // Handle updating attendance punch
  const handleApplyPunchAdjustment = () => {
    if (!selectedDayDetail) return;
    setAttendanceDays((prev) =>
      prev.map((d) =>
        d.day === selectedDayDetail.day
          ? {
            ...d,
            status: 'Present',
            checkIn: punchCheckIn,
            checkOut: punchCheckOut,
            hours: '09:15 hrs',
            note: 'Regularized & Approved by Admin'
          }
          : d
      )
    );
    setIsAdjustPunchOpen(false);
    if (onShowToast) {
      onShowToast({
        type: 'success',
        title: 'Attendance Regularized',
        message: `Day ${selectedDayDetail.day} updated: ${punchCheckIn} - ${punchCheckOut}.`
      });
    }
  };

  // Handle saving the full comprehensive profile
  const handleSaveCompleteProfile = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (onActionCompleted) {
        onActionCompleted({
          type: 'full_update',
          employeeId: employee.userid,
          ...personalForm
        });
      }

      if (onShowToast) {
        onShowToast({
          type: 'success',
          title: 'Employee Profile Saved',
          message: `All details for ${personalForm.first_name} ${personalForm.last_name} updated successfully.`
        });
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const tabs = [
    { id: 'attendance', label: 'Attendance Calendar', icon: Calendar },
    { id: 'salary', label: 'Salary & Compensation', icon: CreditCard },
    { id: 'kpikri', label: 'KPI & KRI Scorecard', icon: TrendingUp },
    { id: 'documents', label: 'Documents & Vault', icon: FileText },
    { id: 'edit_profile', label: 'Edit All Information', icon: Edit }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Employee Dossier & Management Center"
      size="xl"
    >
      <div className="space-y-5">
        {/* Top Summary Card with Photo and Identity */}
        <div className="p-4 rounded-xl bg-[#FAFAFA] border border-[#E5E7EB] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar
              name={`${personalForm.first_name} ${personalForm.last_name}`}
              src={employee.profile_pic_url}
              size="lg"
              avatarId={employee.avatar_id}
            />
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-base font-bold text-[#27292C]">
                  {personalForm.first_name} {personalForm.last_name}
                </h4>
                <Badge
                  variant={
                    personalForm.status === 'Active'
                      ? 'success'
                      : personalForm.status === 'OnLeave'
                        ? 'warning'
                        : 'neutral'
                  }
                >
                  {personalForm.status}
                </Badge>
                <span className="text-[11px] px-2 py-0.5 rounded bg-[#E5E7EB] text-[#27292C] font-semibold">
                  {employee.userid}
                </span>
              </div>
              <p className="text-[13px] text-[#5F6368] mt-0.5">
                {personalForm.designation} • {personalForm.department} •{' '}
                <span className="text-[#27292C] font-medium">{personalForm.work_location}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center">
            {onSelectEmployee && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSelectEmployee(employee.userid);
                }}
                className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-[#FFFFFF] hover:bg-[#F3F4F6] text-[#2563EB] text-[13px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
              >
                Full Dossier Page
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 border-b border-[#E5E7EB] pb-2 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${isActive
                  ? 'bg-[#27292C] text-[#FFFFFF]'
                  : 'text-[#5F6368] hover:bg-[#F3F4F6] hover:text-[#27292C]'
                  }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* TAB 1: ATTENDANCE CALENDAR */}
        {activeTab === 'attendance' && (
          <div className="space-y-4">
            {/* Header & Stats */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FFFFFF] p-3 rounded-lg border border-[#E5E7EB]">
              <div>
                <h4 className="text-sm font-bold text-[#27292C]">
                  Monthly Biometric Attendance Record
                </h4>
                <p className="text-[13px] text-[#5F6368]">
                  Verified check-in punches and geofence verification for {employee.first_name}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-[#27292C] px-3 py-1 rounded-md bg-[#F3F4F6] border border-[#E5E7EB]">
                  {selectedMonth}
                </span>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[13px]">
              <div className="p-3 rounded-lg border border-[#E5E7EB] bg-[#FAFAFA]">
                <span className="text-[#5F6368] block text-[11px]">Present Days</span>
                <span className="text-lg font-bold text-[#000000]">10 Days</span>
                <span className="text-[10px] text-[#5F6368] block mt-0.5">100% on-time</span>
              </div>
              <div className="p-3 rounded-lg border border-[#E5E7EB] bg-[#FAFAFA]">
                <span className="text-[#5F6368] block text-[11px]">Approved Leaves</span>
                <span className="text-lg font-bold text-[#F59E0B]">1 Day</span>
                <span className="text-[10px] text-[#5F6368] block mt-0.5">Casual Leave</span>
              </div>
              <div className="p-3 rounded-lg border border-[#E5E7EB] bg-[#FAFAFA]">
                <span className="text-[#5F6368] block text-[11px]">Weekly Offs</span>
                <span className="text-lg font-bold text-[#6B7280]">8 Days</span>
                <span className="text-[10px] text-[#5F6368] block mt-0.5">Sat & Sun</span>
              </div>
              <div className="p-3 rounded-lg border border-[#E5E7EB] bg-[#FAFAFA]">
                <span className="text-[#5F6368] block text-[11px]">Avg Daily Hours</span>
                <span className="text-lg font-bold text-[#2563EB]">9h 12m</span>
                <span className="text-[10px] text-[#000000] block mt-0.5">+42m over shift</span>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="border border-[#E5E7EB] rounded-xl overflow-hidden bg-[#FFFFFF]">
              <div className="grid grid-cols-7 bg-[#F3F4F6] text-center text-[11px] font-bold text-[#27292C] py-2 border-b border-[#E5E7EB]">
                <div>Sun</div>
                <div>Mon</div>
                <div>Tue</div>
                <div>Wed</div>
                <div>Thu</div>
                <div>Fri</div>
                <div>Sat</div>
              </div>

              <div className="grid grid-cols-7 divide-x divide-y divide-[#F3F4F6]">
                {/* Pad days for September 2026 starts on Tuesday (index 2: 2 empty blocks on Sun, Mon) */}
                <div className="p-2 min-h-[68px] bg-[#FAFAFA]/50" />
                <div className="p-2 min-h-[68px] bg-[#FAFAFA]/50" />

                {attendanceDays.map((item) => (
                  <div
                    key={item.day}
                    onClick={() => {
                      setSelectedDayDetail(item);
                      setPunchCheckIn(item.checkIn || '09:15 AM');
                      setPunchCheckOut(item.checkOut || '06:30 PM');
                    }}
                    className={`p-2 min-h-[72px] transition-colors cursor-pointer flex flex-col justify-between hover:bg-[#F0FDF4] ${item.day === 14
                      ? 'bg-[#EFF6FF] ring-1 ring-inset ring-[#2563EB]/40'
                      : item.isWeekend
                        ? 'bg-[#F9FAFB]'
                        : item.status === 'Leave'
                          ? 'bg-[#FEF3C7]/40'
                          : 'bg-[#FFFFFF]'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[13px] font-bold ${item.day === 14
                          ? 'text-[#2563EB]'
                          : item.isWeekend
                            ? 'text-[#9CA3AF]'
                            : 'text-[#27292C]'
                          }`}
                      >
                        {item.day}
                      </span>
                      <span
                        className={`text-[9px] px-1 rounded font-semibold ${item.status === 'Present'
                          ? 'bg-[#000000]/15 text-[#000000]'
                          : item.status === 'Leave'
                            ? 'bg-[#F59E0B]/20 text-[#D97706]'
                            : item.status === 'Weekend'
                              ? 'bg-[#E5E7EB] text-[#6B7280]'
                              : 'text-[#9CA3AF]'
                          }`}
                      >
                        {item.status === 'Present'
                          ? 'P'
                          : item.status === 'Leave'
                            ? 'LV'
                            : item.status === 'Weekend'
                              ? 'OFF'
                              : '-'}
                      </span>
                    </div>

                    <div className="mt-1">
                      {item.checkIn && (
                        <p className="text-[10px] text-[#27292C] leading-none">
                          {item.checkIn}
                        </p>
                      )}
                      {item.checkOut && (
                        <p className="text-[9px] text-[#5F6368] leading-tight truncate">
                          {item.checkOut}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Selected Day Quick Inspector & Adjustment */}
            {selectedDayDetail && (
              <div className="p-3.5 rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold text-[#27292C]">
                      Selected: {selectedDayDetail.date} ({selectedDayDetail.dayName})
                    </span>
                    <Badge
                      variant={
                        selectedDayDetail.status === 'Present'
                          ? 'success'
                          : selectedDayDetail.status === 'Leave'
                            ? 'warning'
                            : 'neutral'
                      }
                    >
                      {selectedDayDetail.status}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-[#5F6368] mt-0.5">
                    {selectedDayDetail.checkIn ? `Punch In: ${selectedDayDetail.checkIn} | ` : ''}
                    {selectedDayDetail.checkOut ? `Punch Out: ${selectedDayDetail.checkOut} | ` : ''}
                    {selectedDayDetail.hours !== '00:00' ? `Total Hours: ${selectedDayDetail.hours} • ` : ''}
                    {selectedDayDetail.note}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={Clock}
                    onClick={() => setIsAdjustPunchOpen(true)}
                  >
                    Adjust / Regularize Punch
                  </Button>
                </div>
              </div>
            )}

            {/* Adjust Punch Modal / Drawer */}
            {isAdjustPunchOpen && selectedDayDetail && (
              <div className="p-4 rounded-xl border border-[#2563EB]/30 bg-[#EFF6FF] space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-[13px] font-bold text-[#1E3A8A]">
                    Regularize Punch for Day {selectedDayDetail.day} ({selectedDayDetail.date})
                  </h5>
                  <button
                    type="button"
                    onClick={() => setIsAdjustPunchOpen(false)}
                    className="text-[13px] text-[#1E3A8A] font-semibold hover:underline cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#1E3A8A] mb-1">
                      Check-In Time
                    </label>
                    <input
                      type="text"
                      value={punchCheckIn}
                      onChange={(e) => setPunchCheckIn(e.target.value)}
                      className="w-full text-[13px]"
                      placeholder="e.g. 09:15 AM"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#1E3A8A] mb-1">
                      Check-Out Time
                    </label>
                    <input
                      type="text"
                      value={punchCheckOut}
                      onChange={(e) => setPunchCheckOut(e.target.value)}
                      className="w-full text-[13px]"
                      placeholder="e.g. 06:30 PM"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    variant="primary"
                    size="sm"
                    icon={CheckCircle2}
                    onClick={handleApplyPunchAdjustment}
                  >
                    Save Regularized Punch
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SALARY & COMPENSATION */}
        {activeTab === 'salary' && employee && (
          <SalaryCompensationView
            employee={employee}
            onShowToast={onShowToast}
            isDossierPage={false}
          />
        )}

        {/* TAB 3: KPI & KRI PERFORMANCE */}
        {activeTab === 'kpikri' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-[#FFFFFF] p-3 rounded-lg border border-[#E5E7EB]">
              <div>
                <h4 className="text-sm font-bold text-[#27292C]">
                  Key Performance & Risk Indicator Scorecard
                </h4>
                <p className="text-[13px] text-[#5F6368]">
                  Cycle: {kpiKriData.review_period} • Status: {kpiKriData.rating_category}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant={isEditingKpiKri ? 'secondary' : 'primary'}
                  size="sm"
                  icon={isEditingKpiKri ? CheckCircle2 : Edit}
                  onClick={() => {
                    if (isEditingKpiKri) {
                      handleSaveKpiKri();
                    } else {
                      setIsEditingKpiKri(true);
                    }
                  }}
                >
                  {isEditingKpiKri ? 'Save Scores' : 'Edit Evaluation'}
                </Button>
              </div>
            </div>

            {/* Overall Rating Card */}
            <div className="p-4 rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[13px] text-[#5F6368]">Executive Rating Score</span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-2xl font-bold text-[#27292C]">
                    {overallScore}
                  </span>
                  <span className="text-[13px] text-[#5F6368]">/ 5.0 Rating</span>
                  <Badge variant="success">{kpiKriData.rating_category}</Badge>
                </div>
              </div>

              {isEditingKpiKri && (
                <div className="flex items-center gap-2">
                  <label className="text-[13px] font-semibold text-[#27292C]">
                    Set Score:
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="1.0"
                    max="5.0"
                    value={overallScore}
                    onChange={(e) => setOverallScore(e.target.value)}
                    className="w-20 text-[13px] text-center"
                  />
                </div>
              )}
            </div>

            {/* Section A: Key Performance Indicators (KPIs) */}
            <div className="space-y-3">
              <h5 className="text-[13px] font-bold text-[#27292C] flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-[#2563EB]" />
                Key Performance Indicators (KPIs)
              </h5>

              <div className="space-y-2.5">
                {kpiKriData.kpis.map((kpi) => (
                  <div
                    key={kpi.id}
                    className="p-3.5 rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[13px] font-bold text-[#27292C]">{kpi.name}</p>
                        <p className="text-[11px] text-[#5F6368] mt-0.5">{kpi.description}</p>
                      </div>
                      <Badge
                        variant={kpi.status === 'Exceeded' ? 'success' : 'neutral'}
                      >
                        {kpi.status} ({kpi.score}/5.0)
                      </Badge>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-[#5F6368]">
                      <span>Target: <strong className="text-[#27292C]">{kpi.target}</strong></span>
                      <span>•</span>
                      <span>Achieved: <strong className="text-[#000000]">{kpi.achieved}</strong></span>
                      <span>•</span>
                      <span>Weight: <strong className="text-[#27292C]">{kpi.weight}</strong></span>
                    </div>

                    {/* Visual Progress Bar */}
                    <div className="w-full bg-[#F3F4F6] rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-[#27292C] h-1.5 rounded-full"
                        style={{ width: `${Math.min(100, (kpi.score / 5.0) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section B: Key Risk Indicators (KRIs) */}
            <div className="space-y-3 pt-2">
              <h5 className="text-[13px] font-bold text-[#27292C] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#000000]" />
                Key Risk Indicators (KRIs) & Operational Compliance
              </h5>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {kpiKriData.kris.map((kri) => (
                  <div
                    key={kri.id}
                    className="p-3.5 rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-bold text-[#27292C] leading-snug">
                        {kri.name}
                      </p>
                      <Badge variant="success">
                        {kri.level}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-[#4B5563]">
                      <strong>Indicator:</strong> {kri.indicator}
                    </p>
                    <p className="text-[11px] text-[#000000] font-semibold">
                      Current Value: {kri.current_value} (Threshold: {kri.threshold})
                    </p>
                    <p className="text-[10px] text-[#5F6368] italic border-t border-[#F3F4F6] pt-1 mt-1">
                      {kri.mitigation}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: COMPLETE DOCUMENTS & DOWNLOAD */}
        {activeTab === 'documents' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-[#FFFFFF] p-3 rounded-lg border border-[#E5E7EB]">
              <div>
                <h4 className="text-sm font-bold text-[#27292C]">
                  Official Employee Documents Vault
                </h4>
                <p className="text-[13px] text-[#5F6368]">
                  Verified identity proofs, contracts, certifications, and agreements with download access
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  id="btn-add-employee-doc"
                  variant="primary"
                  size="sm"
                  icon={Plus}
                  onClick={() => setIsUploadDocOpen(true)}
                >
                  Upload Document
                </Button>
              </div>
            </div>

            {/* Upload Modal Form */}
            {isUploadDocOpen && (
              <form
                onSubmit={handleAddDocument}
                className="p-4 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] space-y-3"
              >
                <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2">
                  <h5 className="text-[13px] font-bold text-[#27292C]">
                    Add New Document to {employee.first_name}'s Dossier
                  </h5>
                  <button
                    type="button"
                    onClick={() => setIsUploadDocOpen(false)}
                    className="text-[13px] text-[#5F6368] hover:text-[#27292C] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
                  <div>
                    <label className="block font-semibold text-[#27292C] mb-1">
                      Document Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={newDocTitle}
                      onChange={(e) => setNewDocTitle(e.target.value)}
                      placeholder="e.g. AWS Solutions Architect Certificate"
                      className="w-full text-[13px]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#27292C] mb-1">
                      Document Category
                    </label>
                    <select
                      value={newDocCategory}
                      onChange={(e) => setNewDocCategory(e.target.value)}
                      className="w-full text-[13px]"
                    >
                      <option value="Employment Contract">Employment Contract</option>
                      <option value="Legal & Compliance">Legal & Compliance</option>
                      <option value="KYC & Government ID">KYC & Government ID</option>
                      <option value="Tax & Statutory">Tax & Statutory</option>
                      <option value="Academic Credentials">Academic Credentials</option>
                      <option value="Experience & BGV">Experience & BGV</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-[#27292C] mb-1">
                      Description & Policy Reference
                    </label>
                    <input
                      type="text"
                      value={newDocDesc}
                      onChange={(e) => setNewDocDesc(e.target.value)}
                      placeholder="Brief note about the document..."
                      className="w-full text-[13px]"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E7EB]">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsUploadDocOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    icon={Upload}
                  >
                    Save & Archive Document
                  </Button>
                </div>
              </form>
            )}

            {/* Documents List */}
            <div className="divide-y divide-[#E5E7EB] border border-[#E5E7EB] rounded-xl overflow-hidden bg-[#FFFFFF]">
              {documents.length === 0 ? (
                <div className="p-8 text-center text-[13px] text-[#5F6368]">
                  No documents found. Click "Upload Document" above to attach verified files.
                </div>
              ) : (
                documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-3.5 hover:bg-[#F9FAFB] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center text-[#27292C] shrink-0 mt-0.5">
                        <FileText className="w-5 h-5 text-[#2563EB]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-[13px] font-bold text-[#27292C]">{doc.title}</p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F3F4F6] text-[#5F6368]">
                            {doc.format || 'PDF'}
                          </span>
                          {doc.verified && (
                            <span className="text-[10px] font-semibold text-[#000000] flex items-center gap-0.5">
                              <CheckCircle2 className="w-3 h-3" /> Verified
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#5F6368] mt-0.5">
                          {doc.category} • {doc.size || '1.2 MB'} • Uploaded: {doc.date}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <Button
                        id={`btn-download-doc-${doc.id}`}
                        variant="secondary"
                        size="sm"
                        icon={Download}
                        className="text-[13px] font-semibold text-[#2563EB] hover:text-[#1D4ED8]"
                        onClick={() => handleDownloadDoc(doc)}
                      >
                        Download
                      </Button>
                      <button
                        type="button"
                        onClick={() => handleDeleteDoc(doc.id)}
                        className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#EF4444] hover:bg-[#FEE2E2] transition-colors cursor-pointer"
                        title="Delete Document"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 5: EDIT ALL INFORMATION */}
        {activeTab === 'edit_profile' && (
          <form onSubmit={handleSaveCompleteProfile} className="space-y-4">
            <div className="bg-[#FFFFFF] p-3 rounded-lg border border-[#E5E7EB] flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-[#27292C]">
                  Full Employee Record & Dossier Editor
                </h4>
                <p className="text-[13px] text-[#5F6368]">
                  Edit all personal, employment, contact, and statutory details for {employee.userid}
                </p>
              </div>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                icon={Save}
                loading={submitting}
              >
                Save Changes
              </Button>
            </div>

            {/* Section 1: Personal & Identity Details */}
            <div className="border border-[#E5E7EB] rounded-xl p-4 bg-[#FFFFFF] space-y-3">
              <h5 className="text-[13px] font-bold text-[#27292C] border-b border-[#E5E7EB] pb-1.5 flex items-center gap-1.5">
                <User className="w-4 h-4 text-[#2563EB]" />
                Personal & Contact Information
              </h5>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[13px]">
                <div>
                  <label className="block font-semibold text-[#27292C] mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={personalForm.first_name}
                    onChange={(e) => setPersonalForm({ ...personalForm, first_name: e.target.value })}
                    className="w-full text-[13px]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#27292C] mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={personalForm.last_name}
                    onChange={(e) => setPersonalForm({ ...personalForm, last_name: e.target.value })}
                    className="w-full text-[13px]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#27292C] mb-1">Official Email *</label>
                  <input
                    type="email"
                    required
                    value={personalForm.email}
                    onChange={(e) => setPersonalForm({ ...personalForm, email: e.target.value })}
                    className="w-full text-[13px]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#27292C] mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={personalForm.phone_number}
                    onChange={(e) => setPersonalForm({ ...personalForm, phone_number: e.target.value })}
                    className="w-full text-[13px]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#27292C] mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={personalForm.date_of_birth}
                    onChange={(e) => setPersonalForm({ ...personalForm, date_of_birth: e.target.value })}
                    className="w-full text-[13px]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#27292C] mb-1">Gender</label>
                  <select
                    value={personalForm.gender}
                    onChange={(e) => setPersonalForm({ ...personalForm, gender: e.target.value })}
                    className="w-full text-[13px]"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#27292C] mb-1">Blood Group</label>
                  <select
                    value={personalForm.blood_group}
                    onChange={(e) => setPersonalForm({ ...personalForm, blood_group: e.target.value })}
                    className="w-full text-[13px]"
                  >
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#27292C] mb-1">City</label>
                  <input
                    type="text"
                    value={personalForm.city}
                    onChange={(e) => setPersonalForm({ ...personalForm, city: e.target.value })}
                    className="w-full text-[13px]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#27292C] mb-1">State / Province</label>
                  <input
                    type="text"
                    value={personalForm.state}
                    onChange={(e) => setPersonalForm({ ...personalForm, state: e.target.value })}
                    className="w-full text-[13px]"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block font-semibold text-[#27292C] mb-1">Residential Address</label>
                  <input
                    type="text"
                    value={personalForm.address}
                    onChange={(e) => setPersonalForm({ ...personalForm, address: e.target.value })}
                    className="w-full text-[13px]"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block font-semibold text-[#27292C] mb-1">Professional Bio & Notes</label>
                  <textarea
                    rows={2}
                    value={personalForm.bio}
                    onChange={(e) => setPersonalForm({ ...personalForm, bio: e.target.value })}
                    className="w-full text-[13px]"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Employment & Hierarchy */}
            <div className="border border-[#E5E7EB] rounded-xl p-4 bg-[#FFFFFF] space-y-3">
              <h5 className="text-[13px] font-bold text-[#27292C] border-b border-[#E5E7EB] pb-1.5 flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-[#2563EB]" />
                Job, Role & Departmental Hierarchy
              </h5>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[13px]">
                <div>
                  <label className="block font-semibold text-[#27292C] mb-1">Designation *</label>
                  <input
                    type="text"
                    required
                    value={personalForm.designation}
                    onChange={(e) => setPersonalForm({ ...personalForm, designation: e.target.value })}
                    className="w-full text-[13px]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#27292C] mb-1">Department *</label>
                  <select
                    value={personalForm.department}
                    onChange={(e) => setPersonalForm({ ...personalForm, department: e.target.value })}
                    className="w-full text-[13px]"
                  >
                    <option value="Engineering & Technology">Engineering & Technology</option>
                    <option value="Human Resources">Human Resources</option>
                    <option value="Product & Design">Product & Design</option>
                    <option value="Executive Leadership">Executive Leadership</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#27292C] mb-1">Employment Status</label>
                  <select
                    value={personalForm.status}
                    onChange={(e) => setPersonalForm({ ...personalForm, status: e.target.value })}
                    className="w-full text-[13px]"
                  >
                    <option value="Active">Active</option>
                    <option value="OnLeave">On Leave</option>
                    <option value="Probation">Probation</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#27292C] mb-1">Employee Type</label>
                  <select
                    value={personalForm.type}
                    onChange={(e) => setPersonalForm({ ...personalForm, type: e.target.value })}
                    className="w-full text-[13px]"
                  >
                    <option value="Employee">Full Time Regular</option>
                    <option value="Contractor">Contractor / Consultant</option>
                    <option value="Executive">Executive Leadership</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#27292C] mb-1">Work Campus / Location</label>
                  <input
                    type="text"
                    value={personalForm.work_location}
                    onChange={(e) => setPersonalForm({ ...personalForm, work_location: e.target.value })}
                    className="w-full text-[13px]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#27292C] mb-1">Reporting Supervisor</label>
                  <input
                    type="text"
                    value={personalForm.manager_name}
                    onChange={(e) => setPersonalForm({ ...personalForm, manager_name: e.target.value })}
                    className="w-full text-[13px]"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block font-semibold text-[#27292C] mb-1">Technical Skills & Competencies</label>
                  <input
                    type="text"
                    value={personalForm.skills}
                    onChange={(e) => setPersonalForm({ ...personalForm, skills: e.target.value })}
                    className="w-full text-[13px]"
                    placeholder="Comma-separated skills..."
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Statutory & Bank Details */}
            <div className="border border-[#E5E7EB] rounded-xl p-4 bg-[#FFFFFF] space-y-3">
              <h5 className="text-[13px] font-bold text-[#27292C] border-b border-[#E5E7EB] pb-1.5 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-[#2563EB]" />
                Bank Account & Statutory KYC
              </h5>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[13px]">
                <div>
                  <label className="block font-semibold text-[#27292C] mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={personalForm.bank_name}
                    onChange={(e) => setPersonalForm({ ...personalForm, bank_name: e.target.value })}
                    className="w-full text-[13px]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#27292C] mb-1">Account Number</label>
                  <input
                    type="text"
                    value={personalForm.account_no}
                    onChange={(e) => setPersonalForm({ ...personalForm, account_no: e.target.value })}
                    className="w-full text-[13px] font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#27292C] mb-1">IFSC Code</label>
                  <input
                    type="text"
                    value={personalForm.ifsc_code}
                    onChange={(e) => setPersonalForm({ ...personalForm, ifsc_code: e.target.value })}
                    className="w-full text-[13px] uppercase"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#27292C] mb-1">PAN Card Number</label>
                  <input
                    type="text"
                    value={personalForm.pan_card}
                    onChange={(e) => setPersonalForm({ ...personalForm, pan_card: e.target.value })}
                    className="w-full text-[13px] uppercase"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#27292C] mb-1">Aadhaar Card Number</label>
                  <input
                    type="text"
                    value={personalForm.aadhar_card}
                    onChange={(e) => setPersonalForm({ ...personalForm, aadhar_card: e.target.value })}
                    className="w-full text-[13px] font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5E7EB]">
              <Button variant="secondary" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                id="btn-save-all-employee-info"
                type="submit"
                variant="primary"
                size="sm"
                icon={Save}
                loading={submitting}
              >
                Save Complete Record
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
