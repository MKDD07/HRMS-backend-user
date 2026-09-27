import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Mail,
  Phone,
  Building,
  MapPin,
  Calendar,
  CreditCard,
  UserCheck,
  Award,
  Clock,
  Shield,
  ShieldCheck,
  FileText,
  Edit,
  Save,
  CheckCircle2,
  Download,
  Upload,
  Plus,
  Trash2,
  TrendingUp,
  AlertTriangle,
  User,
  Briefcase,
  DollarSign,
  Heart,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { Tabs } from '../../components/ui/Tabs';
import { Modal } from '../../components/ui/Modal';
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

export function EmployeeDetailPage({
  userid,
  api,
  onBack,
  onShowToast
}) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Comprehensive Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTab, setEditTab] = useState('personal');

  // Attendance Calendar state
  const [selectedMonth, setSelectedMonth] = useState('September 2026');
  const [attendanceDays, setAttendanceDays] = useState([]);
  const [selectedDayDetail, setSelectedDayDetail] = useState(null);
  const [isAdjustPunchOpen, setIsAdjustPunchOpen] = useState(false);
  const [punchCheckIn, setPunchCheckIn] = useState('09:15 AM');
  const [punchCheckOut, setPunchCheckOut] = useState('06:30 PM');

  // Salary state
  const [salaryData, setSalaryData] = useState(null);
  const [isEditSalaryOpen, setIsEditSalaryOpen] = useState(false);
  const [salaryForm, setSalaryForm] = useState({});

  // KPI & KRI state
  const [kpiKriData, setKpiKriData] = useState(null);
  const [isEditKpiKriOpen, setIsEditKpiKriOpen] = useState(false);
  const [kpiScore, setKpiScore] = useState(4.8);

  // Documents state
  const [documents, setDocuments] = useState([]);
  const [isUploadDocOpen, setIsUploadDocOpen] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocCategory, setNewDocCategory] = useState('Statutory & Compliance');
  const [newDocFormat, setNewDocFormat] = useState('PDF');
  const [newDocDesc, setNewDocDesc] = useState('');

  // Comprehensive Edit Form fields
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    designation: '',
    department: '',
    status: 'Active',
    type: 'Employee',
    work_location: '',
    date_of_birth: '',
    gender: 'Male',
    blood_group: 'B+',
    marital_status: 'Single',
    nationality: 'Indian',
    city: '',
    state: '',
    country: 'India',
    address: '',
    bio: '',
    manager_name: '',
    joining_date: '2022-03-15',
    confirmation_date: '2022-09-15',
    experience: '4.5 Years',
    skills: '',
    bank_name: '',
    account_no: '',
    ifsc_code: '',
    pan_card: '',
    aadhar_card: '',
    uan_number: '101099234812',
    pf_number: 'MH/BAN/0049210/000/1021',
    emergency_contact_name: 'Rajendra Kataria',
    emergency_contact_relation: 'Father',
    emergency_phone: '+91 98200 88990',
    personal_email: ''
  });

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      try {
        const res = await api.getUser(userid);
        if (res.data && res.data.length > 0) {
          const userObj = res.data[0];
          const personal = res.personalDetails?.[0] || {};
          const professional = res.professionalDetails?.[0] || {};
          const bank = res.bankDetails?.[0] || {};
          const family = res.familyDetails?.[0] || {};

          const merged = {
            ...userObj,
            personal,
            professional,
            bank,
            family
          };

          setProfile(merged);

          // Populate form data
          setFormData({
            first_name: userObj.first_name || '',
            last_name: userObj.last_name || '',
            email: userObj.email || '',
            phone_number: userObj.phone_number || '',
            designation: userObj.designation || 'Staff Software Engineer',
            department: userObj.department || 'Engineering & Technology',
            status: userObj.status || 'Active',
            type: userObj.type || 'Employee',
            work_location: userObj.work_location || 'HQ Vashi Infotech Park',
            date_of_birth: userObj.date_of_birth || personal.dob || '1995-05-15',
            gender: personal.gender || 'Male',
            blood_group: personal.blood_group || 'B+',
            marital_status: personal.marital_status || 'Single',
            nationality: 'Indian',
            city: personal.city || 'Navi Mumbai',
            state: personal.state || 'Maharashtra',
            country: personal.country || 'India',
            address: personal.address || 'Flat 402, Greenfield Residency, Sector 17, Navi Mumbai',
            bio: personal.bio || `${userObj.first_name} leads critical high-performance architecture across the enterprise platform.`,
            manager_name: userObj.manager_name || professional.reporting_manager || 'Executive Committee (CTO)',
            joining_date: userObj.date_of_joining || '2022-03-15',
            confirmation_date: userObj.confirmation_date || '2022-09-15',
            experience: professional.experience || '4.5 Years',
            skills: professional.skills || 'Cloudflare D1 SQL, Distributed Systems, Node.js, React, TypeScript',
            bank_name: bank.bank_name || 'HDFC Bank Ltd',
            account_no: bank.account_no || bank.account_number || '50100488219901',
            ifsc_code: bank.ifsc_code || 'HDFC0001044',
            pan_card: bank.pan_card || bank.pan_number || 'ABCDE1234F',
            aadhar_card: bank.aadhar_card || 'XXXX-XXXX-1098',
            uan_number: '101099234812',
            pf_number: 'MH/BAN/0049210/000/1021',
            emergency_contact_name: family.father_name || 'Rajendra Kataria',
            emergency_contact_relation: 'Father',
            emergency_phone: personal.emergency_contact || family.alternate_contact || '+91 98200 88990',
            personal_email: family.personal_email || `${userObj.first_name?.toLowerCase()}.personal@example.com`
          });

          // Load salary, kpi, documents, and attendance
          const salary = getEmployeeSalary(userid);
          setSalaryData(salary);
          setSalaryForm({ ...salary });

          const kpi = getEmployeeKpiKri(userid);
          setKpiKriData(kpi);
          setKpiScore(kpi.overall_rating);

          setDocuments(getStoredDocuments(userid));
          setAttendanceDays(generateMonthAttendance(2026, 8)); // September 2026
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [userid, api]);

  // Handle saving the full comprehensive dossier
  const handleSaveCompleteDossier = async (e) => {
    e.preventDefault();
    try {
      await api.updateUser(userid, {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone_number: formData.phone_number,
        designation: formData.designation,
        department: formData.department,
        status: formData.status,
        type: formData.type,
        work_location: formData.work_location,
        date_of_birth: formData.date_of_birth
      });

      // Update local profile object
      setProfile((prev) => ({
        ...prev,
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone_number: formData.phone_number,
        designation: formData.designation,
        department: formData.department,
        status: formData.status,
        type: formData.type,
        work_location: formData.work_location,
        date_of_birth: formData.date_of_birth,
        personal: {
          ...prev.personal,
          gender: formData.gender,
          blood_group: formData.blood_group,
          marital_status: formData.marital_status,
          city: formData.city,
          state: formData.state,
          country: formData.country,
          address: formData.address,
          bio: formData.bio,
          emergency_contact: formData.emergency_phone
        },
        professional: {
          ...prev.professional,
          skills: formData.skills,
          experience: formData.experience,
          reporting_manager: formData.manager_name
        },
        bank: {
          ...prev.bank,
          bank_name: formData.bank_name,
          account_no: formData.account_no,
          ifsc_code: formData.ifsc_code,
          pan_card: formData.pan_card,
          aadhar_card: formData.aadhar_card
        },
        family: {
          ...prev.family,
          father_name: formData.emergency_contact_name,
          alternate_contact: formData.emergency_phone,
          personal_email: formData.personal_email
        }
      }));

      setIsEditModalOpen(false);

      if (onShowToast) {
        onShowToast({
          type: 'success',
          title: 'Dossier Saved',
          message: `All details for ${formData.first_name} ${formData.last_name} updated successfully.`
        });
      }
    } catch (err) {
      if (onShowToast) {
        onShowToast({
          type: 'error',
          title: 'Save Failed',
          message: err.message
        });
      }
    }
  };

  // Salary actions
  const handleSaveSalary = () => {
    const basic = Number(salaryForm.basic) || 0;
    const hra = Number(salaryForm.hra) || Math.round(basic * 0.5);
    const allowance = Number(salaryForm.special_allowance) || 0;
    const conveyance = Number(salaryForm.conveyance) || 5000;
    const gross = basic + hra + allowance + conveyance;
    const pf = Number(salaryForm.pf_deduction) || Math.round(basic * 0.12);
    const pt = Number(salaryForm.professional_tax) || 200;
    const tds = Number(salaryForm.tds_tax) || 0;
    const net = gross - (pf + pt + tds);
    const ctc = gross * 12;

    const updated = {
      ...salaryForm,
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
    saveEmployeeSalary(userid, updated);
    setIsEditSalaryOpen(false);

    if (onShowToast) {
      onShowToast({
        type: 'success',
        title: 'Salary Structure Updated',
        message: `Monthly net in-hand recalculated to ₹${net.toLocaleString('en-IN')}.`
      });
    }
  };

  // KPI / KRI actions
  const handleSaveKpiScore = () => {
    const updated = {
      ...kpiKriData,
      overall_rating: Number(kpiScore)
    };
    setKpiKriData(updated);
    saveEmployeeKpiKri(userid, updated);
    setIsEditKpiKriOpen(false);

    if (onShowToast) {
      onShowToast({
        type: 'success',
        title: 'Evaluation Saved',
        message: `Performance rating set to ${kpiScore} / 5.0.`
      });
    }
  };

  // Documents actions
  const handleDownloadDoc = (doc) => {
    downloadDocument(doc, profile);
    if (onShowToast) {
      onShowToast({
        type: 'info',
        title: 'Document Downloaded',
        message: `Saved ${doc.title} to your downloads.`
      });
    }
  };

  const handleAddDocument = (e) => {
    e.preventDefault();
    if (!newDocTitle.trim()) return;

    const newDoc = {
      id: `doc-${Date.now()}`,
      title: newDocTitle.trim(),
      category: newDocCategory,
      format: newDocFormat,
      size: '1.4 MB',
      date: new Date().toISOString().split('T')[0],
      verified: true,
      description: newDocDesc.trim() || 'Uploaded and verified via PulseHRMS enterprise vault.'
    };

    const updated = [newDoc, ...documents];
    setDocuments(updated);
    saveStoredDocuments(userid, updated);
    setIsUploadDocOpen(false);
    setNewDocTitle('');
    setNewDocDesc('');

    if (onShowToast) {
      onShowToast({
        type: 'success',
        title: 'Document Added',
        message: `${newDoc.title} attached to employee vault.`
      });
    }
  };

  const handleDeleteDoc = (docId) => {
    const updated = documents.filter((d) => d.id !== docId);
    setDocuments(updated);
    saveStoredDocuments(userid, updated);

    if (onShowToast) {
      onShowToast({
        type: 'info',
        title: 'Document Removed',
        message: 'Document deleted from vault.'
      });
    }
  };

  // Attendance punch adjustment
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
            note: 'Regularized & Verified by Admin'
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

  if (loading || !profile) {
    return (
      <div className="py-20 text-center text-[#5F6368]">
        <div className="w-8 h-8 border-2 border-[#27292C] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm font-medium">Loading employee dossier from Cloudflare D1 database...</p>
      </div>
    );
  }

  const tabItems = [
    { id: 'overview', label: 'Overview & Bio' },
    { id: 'attendance', label: 'Attendance Calendar' },
    { id: 'salary', label: 'Salary & Compensation' },
    { id: 'performance', label: 'KPI & KRI Scorecard' },
    { id: 'documents', label: 'Documents & Vault' },
    { id: 'bank', label: 'Bank & Statutory' }
  ];

  return (
    <div className="space-y-6">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            icon={ArrowLeft}
            onClick={onBack}
          >
            Back to Directory
          </Button>
          <span className="text-[13px] text-[#5F6368] px-2 py-0.5 rounded bg-[#F3F4F6] border border-[#E5E7EB]">
            Dossier: {profile.userid}
          </span>
        </div>

        <Button
          id="btn-edit-complete-dossier"
          variant="primary"
          size="sm"
          icon={Edit}
          onClick={() => setIsEditModalOpen(true)}
        >
          Edit Complete Dossier
        </Button>
      </div>

      {/* Main Profile Header Card */}
      <div className="p-6 rounded-2xl bg-[#FFFFFF] border border-[#E5E7EB] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <Avatar
              name={`${profile.first_name} ${profile.last_name}`}
              src={profile.profile_pic_url}
              size="xl"
              avatarId={profile.avatar_id}
            />
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl md:text-2xl font-bold text-[#27292C]">
                  {profile.first_name} {profile.last_name}
                </h2>
                <Badge variant={profile.status === 'Active' ? 'success' : profile.status === 'OnLeave' ? 'warning' : 'neutral'}>
                  {profile.status}
                </Badge>
                <span className="text-[13px] font-semibold text-[#5F6368] px-2 py-0.5 rounded bg-[#F3F4F6]">
                  {profile.type || 'Full Time Regular'}
                </span>
              </div>

              <p className="text-sm font-semibold text-[#2563EB] mt-0.5">
                {profile.designation} • {profile.department}
              </p>

              <div className="flex items-center gap-4 text-[13px] text-[#5F6368] mt-2.5 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#27292C]" />
                  {profile.email}
                </span>
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[#27292C]" />
                  {profile.phone_number}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#27292C]" />
                  {profile.work_location || 'HQ Vashi Infotech Park'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              icon={Edit}
              onClick={() => setIsEditModalOpen(true)}
            >
              Edit All Fields
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        tabs={tabItems}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: OVERVIEW & BIO */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Personal Information */}
          <div className="p-5 rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2">
              <h3 className="text-sm font-bold text-[#27292C] flex items-center gap-1.5">
                <User className="w-4 h-4 text-[#2563EB]" />
                Personal Information
              </h3>
              <button
                type="button"
                onClick={() => {
                  setEditTab('personal');
                  setIsEditModalOpen(true);
                }}
                className="text-[13px] text-[#2563EB] hover:underline font-semibold cursor-pointer"
              >
                Edit
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-[13px]">
              <div>
                <span className="text-[#5F6368]">Gender</span>
                <p className="font-semibold text-[#27292C] mt-0.5">
                  {profile.personal?.gender || 'Male'}
                </p>
              </div>
              <div>
                <span className="text-[#5F6368]">Date of Birth</span>
                <p className="font-semibold text-[#27292C] mt-0.5">
                  {profile.date_of_birth || profile.personal?.dob || '1995-05-15'}
                </p>
              </div>
              <div>
                <span className="text-[#5F6368]">Blood Group</span>
                <p className="font-semibold text-[#27292C] mt-0.5">
                  {profile.personal?.blood_group || 'B+'}
                </p>
              </div>
              <div>
                <span className="text-[#5F6368]">Marital Status</span>
                <p className="font-semibold text-[#27292C] mt-0.5">
                  {profile.personal?.marital_status || 'Single'}
                </p>
              </div>
              <div>
                <span className="text-[#5F6368]">City & State</span>
                <p className="font-semibold text-[#27292C] mt-0.5">
                  {profile.personal?.city || 'Navi Mumbai'}, {profile.personal?.state || 'Maharashtra'}
                </p>
              </div>
              <div>
                <span className="text-[#5F6368]">Country</span>
                <p className="font-semibold text-[#27292C] mt-0.5">
                  {profile.personal?.country || 'India'}
                </p>
              </div>
              <div className="col-span-2">
                <span className="text-[#5F6368]">Residential Address</span>
                <p className="font-semibold text-[#27292C] mt-0.5">
                  {profile.personal?.address || 'Flat 402, Greenfield Residency, Sector 17, Navi Mumbai'}
                </p>
              </div>
            </div>
          </div>

          {/* Organizational Hierarchy */}
          <div className="p-5 rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2">
              <h3 className="text-sm font-bold text-[#27292C] flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-[#2563EB]" />
                Organizational Hierarchy & Tenure
              </h3>
              <button
                type="button"
                onClick={() => {
                  setEditTab('job');
                  setIsEditModalOpen(true);
                }}
                className="text-[13px] text-[#2563EB] hover:underline font-semibold cursor-pointer"
              >
                Edit
              </button>
            </div>

            <div className="space-y-3 text-[13px]">
              <div className="flex items-center justify-between p-3 rounded-lg bg-[#F9FAFB] border border-[#E5E7EB]">
                <div>
                  <span className="text-[#5F6368]">Reporting Supervisor</span>
                  <p className="font-bold text-[#27292C] text-sm mt-0.5">
                    {profile.manager_name || profile.professional?.reporting_manager || 'Executive Committee (CTO)'}
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded text-[11px] bg-[#EFF6FF] text-[#1E40AF] font-semibold">
                  Reports To
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <span className="text-[#5F6368]">Date of Joining</span>
                  <p className="font-semibold text-[#27292C] mt-0.5">
                    {profile.date_of_joining || '2022-03-15'}
                  </p>
                </div>
                <div>
                  <span className="text-[#5F6368]">Confirmation Date</span>
                  <p className="font-semibold text-[#27292C] mt-0.5">
                    {profile.confirmation_date || '2022-09-15'}
                  </p>
                </div>
              </div>

              <div>
                <span className="text-[#5F6368]">Technical Skills</span>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {(profile.professional?.skills || 'Cloudflare D1 SQL, Distributed Systems, Node.js, React, TypeScript')
                    .split(',')
                    .map((s) => (
                      <span
                        key={s}
                        className="px-2.5 py-1 rounded-md bg-[#F3F4F6] text-[#27292C] border border-[#E5E7EB] text-[11px] font-medium"
                      >
                        {s.trim()}
                      </span>
                    ))}
                </div>
              </div>

              <div>
                <span className="text-[#5F6368]">Executive Bio</span>
                <p className="text-[#27292C] mt-1 leading-relaxed italic bg-[#F9FAFB] p-2.5 rounded-lg border border-[#E5E7EB]">
                  "{profile.personal?.bio || 'Leads high-impact enterprise architecture and cloud microservices.'}"
                </p>
              </div>
            </div>
          </div>

          {/* Emergency & Family Contacts */}
          <div className="col-span-1 md:col-span-2 p-5 rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2">
              <h3 className="text-sm font-bold text-[#27292C] flex items-center gap-1.5">
                <Heart className="w-4 h-4 text-[#EF4444]" />
                Emergency Contact & Family Details
              </h3>
              <button
                type="button"
                onClick={() => {
                  setEditTab('personal');
                  setIsEditModalOpen(true);
                }}
                className="text-[13px] text-[#2563EB] hover:underline font-semibold cursor-pointer"
              >
                Edit
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[13px]">
              <div>
                <span className="text-[#5F6368]">Contact Name / Relation</span>
                <p className="font-semibold text-[#27292C] mt-0.5">
                  {profile.family?.father_name || 'Rajendra Kataria'} (Father)
                </p>
              </div>
              <div>
                <span className="text-[#5F6368]">Emergency Phone</span>
                <p className="font-semibold text-[#27292C] mt-0.5">
                  {profile.personal?.emergency_contact || profile.family?.alternate_contact || '+91 98200 88990'}
                </p>
              </div>
              <div>
                <span className="text-[#5F6368]">Personal Alternate Email</span>
                <p className="font-semibold text-[#27292C] mt-0.5">
                  {profile.family?.personal_email || `${profile.first_name?.toLowerCase()}.personal@example.com`}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: ATTENDANCE CALENDAR */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FFFFFF] p-4 rounded-xl border border-[#E5E7EB]">
            <div>
              <h3 className="text-sm font-bold text-[#27292C]">
                Monthly Biometric Attendance Calendar
              </h3>
              <p className="text-[13px] text-[#5F6368]">
                Verified geofence clock-in and punch records for {profile.first_name} {profile.last_name}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-[#27292C] px-3 py-1.5 rounded-lg bg-[#F3F4F6] border border-[#E5E7EB]">
                {selectedMonth}
              </span>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[13px]">
            <div className="p-3.5 rounded-xl border border-[#E5E7EB] bg-[#FFFFFF]">
              <span className="text-[#5F6368] block">Present Days</span>
              <span className="text-xl font-bold text-[#000000] mt-0.5 block">10 Days</span>
              <span className="text-[11px] text-[#5F6368] mt-1 block">100% on-time arrival</span>
            </div>
            <div className="p-3.5 rounded-xl border border-[#E5E7EB] bg-[#FFFFFF]">
              <span className="text-[#5F6368] block">Approved Leaves</span>
              <span className="text-xl font-bold text-[#F59E0B] mt-0.5 block">1 Day</span>
              <span className="text-[11px] text-[#5F6368] mt-1 block">Casual Leave</span>
            </div>
            <div className="p-3.5 rounded-xl border border-[#E5E7EB] bg-[#FFFFFF]">
              <span className="text-[#5F6368] block">Weekly Offs</span>
              <span className="text-xl font-bold text-[#6B7280] mt-0.5 block">8 Days</span>
              <span className="text-[11px] text-[#5F6368] mt-1 block">Saturdays & Sundays</span>
            </div>
            <div className="p-3.5 rounded-xl border border-[#E5E7EB] bg-[#FFFFFF]">
              <span className="text-[#5F6368] block">Avg Daily Working Hours</span>
              <span className="text-xl font-bold text-[#2563EB] mt-0.5 block">9h 12m</span>
              <span className="text-[11px] text-[#000000] mt-1 block">+42m over standard shift</span>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="border border-[#E5E7EB] rounded-2xl overflow-hidden bg-[#FFFFFF] shadow-xs">
            <div className="grid grid-cols-7 bg-[#F9FAFB] text-center text-[13px] font-bold text-[#27292C] py-2.5 border-b border-[#E5E7EB]">
              <div>Sun</div>
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div>Sat</div>
            </div>

            <div className="grid grid-cols-7 divide-x divide-y divide-[#F3F4F6]">
              {/* Offset for Sep 2026 starting Tuesday */}
              <div className="p-2.5 min-h-[80px] bg-[#FAFAFA]/50" />
              <div className="p-2.5 min-h-[80px] bg-[#FAFAFA]/50" />

              {attendanceDays.map((item) => (
                <div
                  key={item.day}
                  onClick={() => {
                    setSelectedDayDetail(item);
                    setPunchCheckIn(item.checkIn || '09:15 AM');
                    setPunchCheckOut(item.checkOut || '06:30 PM');
                  }}
                  className={`p-2.5 min-h-[80px] transition-colors cursor-pointer flex flex-col justify-between hover:bg-[#F0FDF4] ${item.day === 14
                    ? 'bg-[#EFF6FF] ring-2 ring-inset ring-[#2563EB]/40'
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
                      className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${item.status === 'Present'
                        ? 'bg-[#000000]/15 text-[#000000]'
                        : item.status === 'Leave'
                          ? 'bg-[#F59E0B]/20 text-[#D97706]'
                          : item.status === 'Weekend'
                            ? 'bg-[#E5E7EB] text-[#6B7280]'
                            : 'text-[#9CA3AF]'
                        }`}
                    >
                      {item.status === 'Present'
                        ? 'Present'
                        : item.status === 'Leave'
                          ? 'Leave'
                          : item.status === 'Weekend'
                            ? 'Weekend'
                            : '-'}
                    </span>
                  </div>

                  <div className="mt-2">
                    {item.checkIn && (
                      <p className="text-[11px] font-medium text-[#27292C]">
                        {item.checkIn}
                      </p>
                    )}
                    {item.checkOut && (
                      <p className="text-[10px] text-[#5F6368] truncate">
                        {item.checkOut}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Selected Day Inspector */}
          {selectedDayDetail && (
            <div className="p-4 rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold text-[#27292C]">
                    Date: {selectedDayDetail.date} ({selectedDayDetail.dayName})
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
                <p className="text-[13px] text-[#5F6368] mt-0.5">
                  {selectedDayDetail.checkIn ? `In: ${selectedDayDetail.checkIn} • ` : ''}
                  {selectedDayDetail.checkOut ? `Out: ${selectedDayDetail.checkOut} • ` : ''}
                  {selectedDayDetail.hours !== '00:00' ? `Total: ${selectedDayDetail.hours} • ` : ''}
                  {selectedDayDetail.note}
                </p>
              </div>

              <Button
                variant="secondary"
                size="sm"
                icon={Clock}
                onClick={() => setIsAdjustPunchOpen(true)}
              >
                Adjust / Regularize Day Punch
              </Button>
            </div>
          )}

          {/* Punch Regularization Modal */}
          {isAdjustPunchOpen && selectedDayDetail && (
            <div className="p-4 rounded-xl border border-[#2563EB]/40 bg-[#EFF6FF] space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-[13px] font-bold text-[#1E3A8A]">
                  Regularize Biometric Punch for {selectedDayDetail.date}
                </h4>
                <button
                  type="button"
                  onClick={() => setIsAdjustPunchOpen(false)}
                  className="text-[13px] text-[#1E3A8A] hover:underline cursor-pointer"
                >
                  Close
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
                <div>
                  <label className="block font-semibold text-[#1E3A8A] mb-1">
                    Punch In Time
                  </label>
                  <input
                    type="text"
                    value={punchCheckIn}
                    onChange={(e) => setPunchCheckIn(e.target.value)}
                    className="w-full text-[13px]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#1E3A8A] mb-1">
                    Punch Out Time
                  </label>
                  <input
                    type="text"
                    value={punchCheckOut}
                    onChange={(e) => setPunchCheckOut(e.target.value)}
                    className="w-full text-[13px]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
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

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: SALARY & COMPENSATION */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'salary' && profile && (
        <SalaryCompensationView
          employee={profile}
          onShowToast={onShowToast}
          isDossierPage={true}
        />
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 4: KPI & KRI PERFORMANCE SCORECARD */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'performance' && kpiKriData && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-[#FFFFFF] p-4 rounded-xl border border-[#E5E7EB]">
            <div>
              <h3 className="text-sm font-bold text-[#27292C]">
                Key Performance Indicators (KPI) & Key Risk Indicators (KRI)
              </h3>
              <p className="text-[13px] text-[#5F6368]">
                Cycle: {kpiKriData.review_period} • Evaluated by Executive Leadership
              </p>
            </div>

            <Button
              variant={isEditKpiKriOpen ? 'secondary' : 'primary'}
              size="sm"
              icon={isEditKpiKriOpen ? CheckCircle2 : Edit}
              onClick={() => {
                if (isEditKpiKriOpen) {
                  handleSaveKpiScore();
                } else {
                  setIsEditKpiKriOpen(true);
                }
              }}
            >
              {isEditKpiKriOpen ? 'Save Evaluation' : 'Edit Scorecard'}
            </Button>
          </div>

          {/* Rating Header Card */}
          <div className="p-5 rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[13px] text-[#5F6368]">Performance Rating</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-bold text-[#27292C]">{kpiScore}</span>
                <span className="text-[13px] text-[#5F6368]">/ 5.0 Scale</span>
                <Badge variant="success">{kpiKriData.rating_category}</Badge>
              </div>
            </div>

            {isEditKpiKriOpen && (
              <div className="flex items-center gap-2">
                <label className="text-[13px] font-semibold text-[#27292C]">Rating Score:</label>
                <input
                  type="number"
                  step="0.1"
                  min="1.0"
                  max="5.0"
                  value={kpiScore}
                  onChange={(e) => setKpiScore(e.target.value)}
                  className="w-20 text-[13px] text-center"
                />
              </div>
            )}
          </div>

          {/* KPIs Section */}
          <div className="space-y-3">
            <h4 className="text-[13px] font-bold text-[#27292C] flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-[#2563EB]" />
              Key Performance Indicators (KPIs)
            </h4>

            <div className="space-y-2.5">
              {kpiKriData.kpis.map((kpi) => (
                <div
                  key={kpi.id}
                  className="p-4 rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[13px] font-bold text-[#27292C]">{kpi.name}</p>
                      <p className="text-[11px] text-[#5F6368] mt-0.5">{kpi.description}</p>
                    </div>
                    <Badge variant={kpi.status === 'Exceeded' ? 'success' : 'neutral'}>
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

          {/* KRIs Section */}
          <div className="space-y-3 pt-2">
            <h4 className="text-[13px] font-bold text-[#27292C] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#000000]" />
              Key Risk Indicators (KRIs) & Operational Risk Profile
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {kpiKriData.kris.map((kri) => (
                <div
                  key={kri.id}
                  className="p-4 rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-bold text-[#27292C]">{kri.name}</p>
                    <Badge variant="success">{kri.level}</Badge>
                  </div>
                  <p className="text-[11px] text-[#4B5563]">
                    <strong>Indicator:</strong> {kri.indicator}
                  </p>
                  <p className="text-[11px] text-[#000000] font-semibold">
                    Current: {kri.current_value} (Threshold: {kri.threshold})
                  </p>
                  <p className="text-[11px] text-[#5F6368] italic border-t border-[#F3F4F6] pt-1 mt-1">
                    {kri.mitigation}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 5: DOCUMENTS & VAULT */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-[#FFFFFF] p-4 rounded-xl border border-[#E5E7EB]">
            <div>
              <h3 className="text-sm font-bold text-[#27292C]">
                Official Employee Document Vault
              </h3>
              <p className="text-[13px] text-[#5F6368]">
                Certified documents, NDAs, identity records, and tax declarations with verified download
              </p>
            </div>

            <Button
              id="btn-upload-doc-dossier"
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setIsUploadDocOpen(true)}
            >
              Upload Document
            </Button>
          </div>

          {/* Upload Modal Form */}
          {isUploadDocOpen && (
            <form
              onSubmit={handleAddDocument}
              className="p-5 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] space-y-4"
            >
              <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2">
                <h4 className="text-[13px] font-bold text-[#27292C]">
                  Attach New Document to {profile.first_name}'s Vault
                </h4>
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
                    placeholder="e.g. Master Degree Certificate"
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
                    Policy Reference / Brief Note
                  </label>
                  <input
                    type="text"
                    value={newDocDesc}
                    onChange={(e) => setNewDocDesc(e.target.value)}
                    placeholder="Brief description of verified file..."
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

          {/* Document Rows */}
          <div className="divide-y divide-[#E5E7EB] border border-[#E5E7EB] rounded-2xl overflow-hidden bg-[#FFFFFF] shadow-xs">
            {documents.length === 0 ? (
              <div className="p-8 text-center text-[13px] text-[#5F6368]">
                No documents found in vault.
              </div>
            ) : (
              documents.map((doc) => (
                <div
                  key={doc.id}
                  className="p-4 hover:bg-[#F9FAFB] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center text-[#27292C] shrink-0">
                      <FileText className="w-5 h-5 text-[#2563EB]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[13px] font-bold text-[#27292C]">{doc.title}</p>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-[#F3F4F6] text-[#5F6368]">
                          {doc.format || 'PDF'}
                        </span>
                        {doc.verified && (
                          <span className="text-[10px] font-semibold text-[#000000] flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#5F6368] mt-0.5">
                        {doc.category} • {doc.size || '1.2 MB'} • Issued / Archived: {doc.date}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <Button
                      id={`btn-dossier-download-${doc.id}`}
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
                      className="p-2 rounded-lg text-[#9CA3AF] hover:text-[#EF4444] hover:bg-[#FEE2E2] transition-colors cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 6: BANK & STATUTORY */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'bank' && (
        <div className="p-6 rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] space-y-4">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2">
            <h3 className="text-sm font-bold text-[#27292C] flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-[#2563EB]" />
              Bank Account & Statutory KYC
            </h3>
            <button
              type="button"
              onClick={() => {
                setEditTab('bank');
                setIsEditModalOpen(true);
              }}
              className="text-[13px] text-[#2563EB] hover:underline font-semibold cursor-pointer"
            >
              Edit Details
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 text-[13px]">
            <div>
              <span className="text-[#5F6368]">Bank Name</span>
              <p className="font-bold text-[#27292C] text-sm mt-0.5">
                {profile.bank?.bank_name || 'HDFC Bank Ltd'}
              </p>
            </div>
            <div>
              <span className="text-[#5F6368]">Account Number</span>
              <p className="font-bold text-[#27292C] text-sm mt-0.5">
                {profile.bank?.account_no || profile.bank?.account_number || '50100488219901'}
              </p>
            </div>
            <div>
              <span className="text-[#5F6368]">IFSC Code</span>
              <p className="font-bold text-[#2563EB] text-sm mt-0.5">
                {profile.bank?.ifsc_code || 'HDFC0001044'}
              </p>
            </div>
            <div>
              <span className="text-[#5F6368]">PAN Card Number</span>
              <p className="font-bold text-[#27292C] text-sm mt-0.5">
                {profile.bank?.pan_card || profile.bank?.pan_number || 'ABCDE1234F'}
              </p>
            </div>
            <div>
              <span className="text-[#5F6368]">Aadhaar Card Number</span>
              <p className="font-bold text-[#27292C] text-sm mt-0.5">
                {profile.bank?.aadhar_card || 'XXXX-XXXX-1098'}
              </p>
            </div>
            <div>
              <span className="text-[#5F6368]">Universal Account Number (UAN)</span>
              <p className="font-bold text-[#27292C] text-sm mt-0.5">
                101099234812
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* COMPREHENSIVE DOSSIER EDIT MODAL */}
      {/* ------------------------------------------------------------- */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Employee Dossier Record"
        size="xl"
      >
        <form onSubmit={handleSaveCompleteDossier} className="space-y-4">
          {/* Edit Modal Tabs */}
          <div className="flex items-center gap-1.5 border-b border-[#E5E7EB] pb-2">
            {[
              { id: 'personal', label: 'Personal & Contact' },
              { id: 'job', label: 'Job & Hierarchy' },
              { id: 'bank', label: 'Bank & Statutory' },
              { id: 'emergency', label: 'Emergency & Bio' }
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setEditTab(t.id)}
                className={`px-3 py-1.5 rounded-lg text-[13px] font-semibold cursor-pointer transition-colors ${editTab === t.id
                  ? 'bg-[#27292C] text-[#FFFFFF]'
                  : 'text-[#5F6368] hover:bg-[#F3F4F6] hover:text-[#27292C]'
                  }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Personal Info */}
          {editTab === 'personal' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[13px]">
              <div>
                <label className="block font-semibold text-[#27292C] mb-1">First Name *</label>
                <input
                  type="text"
                  required
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className="w-full text-[13px]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#27292C] mb-1">Last Name *</label>
                <input
                  type="text"
                  required
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  className="w-full text-[13px]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#27292C] mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full text-[13px]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#27292C] mb-1">Phone Number</label>
                <input
                  type="text"
                  value={formData.phone_number}
                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  className="w-full text-[13px]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#27292C] mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                  className="w-full text-[13px]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#27292C] mb-1">Gender</label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
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
                  value={formData.blood_group}
                  onChange={(e) => setFormData({ ...formData, blood_group: e.target.value })}
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
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full text-[13px]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#27292C] mb-1">State</label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="w-full text-[13px]"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block font-semibold text-[#27292C] mb-1">Residential Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full text-[13px]"
                />
              </div>
            </div>
          )}

          {/* Job Info */}
          {editTab === 'job' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[13px]">
              <div>
                <label className="block font-semibold text-[#27292C] mb-1">Designation Title *</label>
                <input
                  type="text"
                  required
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  className="w-full text-[13px]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#27292C] mb-1">Department *</label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
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
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
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
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full text-[13px]"
                >
                  <option value="Employee">Full Time Regular</option>
                  <option value="Contractor">Contractor / Consultant</option>
                  <option value="Executive">Executive Leadership</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#27292C] mb-1">Work Location</label>
                <input
                  type="text"
                  value={formData.work_location}
                  onChange={(e) => setFormData({ ...formData, work_location: e.target.value })}
                  className="w-full text-[13px]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#27292C] mb-1">Reporting Supervisor</label>
                <input
                  type="text"
                  value={formData.manager_name}
                  onChange={(e) => setFormData({ ...formData, manager_name: e.target.value })}
                  className="w-full text-[13px]"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block font-semibold text-[#27292C] mb-1">Skills (Comma-separated)</label>
                <input
                  type="text"
                  value={formData.skills}
                  onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                  className="w-full text-[13px]"
                />
              </div>
            </div>
          )}

          {/* Bank Info */}
          {editTab === 'bank' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[13px]">
              <div>
                <label className="block font-semibold text-[#27292C] mb-1">Bank Name</label>
                <input
                  type="text"
                  value={formData.bank_name}
                  onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  className="w-full text-[13px]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#27292C] mb-1">Account Number</label>
                <input
                  type="text"
                  value={formData.account_no}
                  onChange={(e) => setFormData({ ...formData, account_no: e.target.value })}
                  className="w-full text-[13px] font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#27292C] mb-1">IFSC Code</label>
                <input
                  type="text"
                  value={formData.ifsc_code}
                  onChange={(e) => setFormData({ ...formData, ifsc_code: e.target.value })}
                  className="w-full text-[13px] uppercase"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#27292C] mb-1">PAN Card Number</label>
                <input
                  type="text"
                  value={formData.pan_card}
                  onChange={(e) => setFormData({ ...formData, pan_card: e.target.value })}
                  className="w-full text-[13px] uppercase"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#27292C] mb-1">Aadhaar Card Number</label>
                <input
                  type="text"
                  value={formData.aadhar_card}
                  onChange={(e) => setFormData({ ...formData, aadhar_card: e.target.value })}
                  className="w-full text-[13px] font-mono"
                />
              </div>
            </div>
          )}

          {/* Emergency & Bio */}
          {editTab === 'emergency' && (
            <div className="space-y-3 text-[13px]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#27292C] mb-1">Emergency Contact Name</label>
                  <input
                    type="text"
                    value={formData.emergency_contact_name}
                    onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                    className="w-full text-[13px]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#27292C] mb-1">Emergency Phone Number</label>
                  <input
                    type="text"
                    value={formData.emergency_phone}
                    onChange={(e) => setFormData({ ...formData, emergency_phone: e.target.value })}
                    className="w-full text-[13px]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#27292C] mb-1">Personal Alternate Email</label>
                <input
                  type="email"
                  value={formData.personal_email}
                  onChange={(e) => setFormData({ ...formData, personal_email: e.target.value })}
                  className="w-full text-[13px]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#27292C] mb-1">Professional Bio</label>
                <textarea
                  rows={3}
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  className="w-full text-[13px]"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5E7EB]">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsEditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              id="btn-save-complete-dossier"
              type="submit"
              variant="primary"
              size="sm"
              icon={Save}
            >
              Save Complete Dossier
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
