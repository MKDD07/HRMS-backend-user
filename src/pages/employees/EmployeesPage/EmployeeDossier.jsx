import React from 'react';
import {
  Calendar,
  CreditCard,
  Download,
  Edit,
  FileText,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Briefcase
} from 'lucide-react';
import { Avatar } from '../../../components/ui/Avatar';
import { OverviewTab } from './OverviewTab';
import { AttendanceTab } from './AttendanceTab';
import { SalaryCompensationView } from '../SalaryCompensationView';
import { KpiKriTab } from './KpiKriTab';
import { DocumentsTab } from './DocumentsTab';
import { BankTab } from './BankTab';
import { EditProfileTab } from './EditProfileTab';

const DOSSIER_NAV_TABS = [
  { id: 'overview', label: 'Full Dossier', icon: UserCheck },
  { id: 'attendance', label: 'Attendance', icon: Calendar },
  { id: 'salary', label: 'Compensation', icon: CreditCard },
  { id: 'kpikri', label: 'Scorecard', icon: TrendingUp },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'bank', label: 'Bank & KYC', icon: ShieldCheck },
  { id: 'edit_profile', label: 'Edit Profile', icon: Edit }
];

export function EmployeeDossier({
  employee,
  dossierTab,
  onTabChange,
  onOpenSlipModal,
  onOpenManageModal,
  onSavePersonalProfile,
  onShowToast
}) {
  if (!employee) {
    return (
      <div className="p-12 bg-white border border-[#E5E7EB] rounded-2xl text-center text-[#4B5563]">
        Select an employee from the roster on the right to open their Dossier & Management Center.
      </div>
    );
  }

  const phone = employee.phone_number || employee.phone || '+91 98765 43210';
  const email = employee.email || 'mohit.kataria@hrtiva.com';

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-xs space-y-6">
      {/* Dossier Header & Profile Overview */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5 pb-5 border-b border-[#F1F3F5]">
        {/* Left Profile Details */}
        <div className="flex items-start gap-4 min-w-0">
          <Avatar
            name={`${employee.first_name} ${employee.last_name}`}
            src={employee.profile_pic_url}
            size="2xl"
            avatarId={employee.avatar_id}
            status={employee.status || 'Active'}
          />
          <div className="min-w-0 space-y-1.5 pt-0.5">
            <h1 className="text-2xl font-bold text-[#111827] tracking-tight truncate">
              {employee.first_name} {employee.last_name}
            </h1>

            <p className="text-[14px] font-medium text-[#4B5563] truncate">
              {employee.designation || 'Staff'} • <span className="text-[#6B7280]">{employee.department || 'General'}</span>
            </p>

            {/* Location & Role Metadata */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pt-1 text-[14px] text-[#374151]">
              <div className="inline-flex items-center gap-1.5" title="Work Location">
                <MapPin className="w-4 h-4 text-[#6B7280] shrink-0" />
                <span className="font-medium text-[#111827]">{employee.work_location || 'HQ Vashi Infotech Park'}</span>
              </div>
              <div className="inline-flex items-center gap-1.5" title="Role Type">
                <Briefcase className="w-4 h-4 text-[#6B7280] shrink-0" />
                <span className="font-medium text-[#111827]">{employee.type || 'Super Admin'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Top Corner: ID Badge & Quick Actions (Solid Colors, No Borders) */}
        <div className="flex items-center gap-2 shrink-0 self-start">
          <span
            className="font-mono text-xs max-h-[28px] border border-[#EF4444] font-bold text-[#EF4444] px-2.5 py-2 rounded-[50px] shadow-2xs select-all"
            title="Employee ID"
          >
            {employee.userid}
          </span>

          {/* Call icon button (Solid Green, No Border) */}
          <a
            href={`tel:${phone}`}
            className="p-2 text-white bg-[#10B981] hover:bg-[#059669] rounded-[50px] shadow-2xs transition-all cursor-pointer"
            title={`Call: ${phone}`}
            aria-label="Call Employee"
          >
            <Phone className="w-4 h-4" />
          </a>

          {/* Mail icon button (Solid Blue/Indigo, No Border) */}
          <a
            href={`mailto:${email}`}
            className="p-2 text-white bg-[#EF4444] hover:bg-[#EF4444] rounded-[50px] shadow-2xs transition-all cursor-pointer"
            title={`Email: ${email}`}
            aria-label="Email Employee"
          >
            <Mail className="w-4 h-4" />
          </a>

          {/* Download Payslip Button (Solid Slate/Gray, No Border) */}
          <button
            type="button"
            onClick={() => onOpenSlipModal(employee)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#111827] bg-[#F3F4F6] hover:bg-[#E5E7EB] rounded-[50px] shadow-2xs transition-all cursor-pointer"
            title="Download Payslip PDF"
          >
            <Download className="w-3.5 h-3.5 text-[#374151]" />
            <span>Payslip</span>
          </button>

          {/* Quick Manage Button (Solid Black/Dark, No Border) */}
          <button
            type="button"
            onClick={() => onOpenManageModal(employee)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#111827] hover:bg-black rounded-[50px] shadow-2xs transition-all cursor-pointer"
            title="Quick Manage"
          >
            <Calendar className="w-3.5 h-3.5 text-white/90" />
            <span>Manage</span>
          </button>
        </div>
      </div>

      {/* Modern High-Contrast Dossier Tabs */}
      <div className="overflow-x-auto pb-1">
        <nav className="flex items-center space-x-1 text-xs font-semibold whitespace-nowrap">
          {DOSSIER_NAV_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = dossierTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[50px] transition-all cursor-pointer ${isActive
                  ? 'bg-[#111827] text-white shadow-2xs'
                  : 'text-[#4B5563] hover:text-[#111827] hover:bg-[#F3F4F6]'
                  }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Active Tab Panels */}
      {dossierTab === 'overview' && (
        <OverviewTab employee={employee} onEdit={() => onTabChange('edit_profile')} />
      )}

      {dossierTab === 'attendance' && (
        <AttendanceTab employee={employee} onShowToast={onShowToast} />
      )}

      {dossierTab === 'salary' && (
        <div className="pt-1">
          <SalaryCompensationView
            employee={employee}
            onShowToast={onShowToast}
            isDossierPage={true}
          />
        </div>
      )}

      {dossierTab === 'kpikri' && (
        <KpiKriTab employee={employee} onShowToast={onShowToast} />
      )}

      {dossierTab === 'documents' && (
        <DocumentsTab employee={employee} onShowToast={onShowToast} />
      )}

      {dossierTab === 'bank' && (
        <BankTab employee={employee} onEdit={() => onTabChange('edit_profile')} />
      )}

      {dossierTab === 'edit_profile' && (
        <EditProfileTab
          employee={employee}
          onSave={onSavePersonalProfile}
          onCancel={() => onTabChange('overview')}
        />
      )}
    </div>
  );
}
