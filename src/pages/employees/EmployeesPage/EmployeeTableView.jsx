import React from 'react';
import { ChevronRight, Download, Calendar, MapPin } from 'lucide-react';
import { Avatar } from '../../../components/ui/Avatar';

export function EmployeeTableView({
  employees,
  onSelectEmployee,
  onOpenSlipModal,
  onOpenManageModal,
  onOpenDossier
}) {
  return (
    <div className="card p-0 bg-white border border-[#E5E7EB] rounded-xl overflow-hidden shadow-2xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="text-[#5F6368] border-b border-[#E5E7EB] text-[11px] uppercase tracking-wider select-none">
            <tr>
              <th className="py-3.5 px-4">Employee</th>
              <th className="py-3.5 px-4">ID & Department</th>
              <th className="py-3.5 px-4">Location</th>
              <th className="py-3.5 px-4">Role / Type</th>
              <th className="py-3.5 px-4 text-center">Status</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F3F5] text-[#27292C]">
            {employees.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-14 text-center text-[#5F6368]">
                  No employees matching the selected criteria.
                </td>
              </tr>
            ) : (
              employees.map((emp) => (
                <tr
                  key={emp.userid}
                  className="hover:bg-[#F9FAFB]/80 transition-colors group cursor-pointer"
                  onClick={() => onSelectEmployee(emp.userid)}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={`${emp.first_name} ${emp.last_name}`}
                        src={emp.profile_pic_url}
                        size="md"
                        avatarId={emp.avatar_id}
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-[#27292C] group-hover:text-[#4F46E5] transition-colors truncate">
                          {emp.first_name} {emp.last_name}
                        </p>
                        <p className="text-[11px] text-[#5F6368] truncate mt-0.5">
                          {emp.designation || 'Staff'}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="font-semibold text-[#4F46E5] bg-[#EEF2FF] px-2 py-0.5 rounded border border-[#E0E7FF]">
                      {emp.userid}
                    </span>
                    <p className="text-[11px] text-[#5F6368] mt-1 truncate">
                      {emp.department || 'General'}
                    </p>
                  </td>

                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-[#5F6368]">
                      <MapPin className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0" />
                      <span className="truncate max-w-[150px]">
                        {emp.work_location || 'HQ Vashi'}
                      </span>
                    </div>
                  </td>

                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded font-medium bg-[#F9FAFB] text-[#374151] border border-[#E5E7EB]">
                      {emp.type || 'Employee'}
                    </span>
                  </td>

                  <td className="py-4 px-4 text-center whitespace-nowrap">
                    <span
                      title={emp.status === 'Active' ? 'Active' : emp.status === 'OnLeave' ? 'On Leave' : 'Offline'}
                      aria-label={emp.status || 'Active'}
                      className={`inline-flex items-center justify-center w-5 h-5 rounded-full border shadow-2xs transition-transform hover:scale-110 cursor-help ${
                        emp.status === 'Active'
                          ? 'bg-[#ECFDF5] border-[#A7F3D0]'
                          : emp.status === 'OnLeave'
                            ? 'bg-[#FFFBEB] border-[#FDE68A]'
                            : 'bg-[#F3F4F6] border-[#E5E7EB]'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          emp.status === 'Active'
                            ? 'bg-[#000000]'
                            : emp.status === 'OnLeave'
                              ? 'bg-[#F59E0B]'
                              : 'bg-[#9CA3AF]'
                        }`}
                      />
                    </span>
                  </td>

                  <td className="py-4 px-4 text-right whitespace-nowrap">
                    <div
                      className="flex items-center justify-end gap-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        id={`btn-payslip-${emp.userid}`}
                        onClick={() => onOpenSlipModal(emp)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 font-semibold text-[#374151] bg-white border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] hover:text-[#111827] hover:border-[#D1D5DB] transition-all cursor-pointer shadow-2xs"
                        title="Download Payslip PDF"
                      >
                        <Download className="w-3.5 h-3.5 text-[#6B7280]" />
                        <span>Payslip</span>
                      </button>
                      <button
                        type="button"
                        id={`btn-manage-employee-${emp.userid}`}
                        onClick={() => onOpenManageModal(emp)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 font-semibold text-[#111827] bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg hover:bg-white hover:border-[#D1D5DB] transition-all cursor-pointer shadow-2xs"
                        title="Quick Manage"
                      >
                        <Calendar className="w-3.5 h-3.5 text-[#6B7280]" />
                        <span>Manage</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenDossier(emp)}
                        className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#4F46E5] hover:bg-[#EEF2FF] transition-all cursor-pointer"
                        title="Open Employee Dossier"
                        aria-label="Open Employee Dossier"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
