import React from 'react';
import { Avatar } from '../../../components/ui/Avatar';

export function EmployeeRoster({
  employees,
  totalCount,
  selectedPersonId,
  onSelectPerson
}) {
  return (
    <div className="card p-4 bg-white rounded-xl flex flex-col gap-3 shadow-2xs relative w-full">
      <div className="flex items-center justify-between pb-2 border-b border-[#F1F3F5]">
        <div>
          <h3 className="font-bold">Directory Roster</h3>
          <p>
            Showing {employees.length} of {totalCount} employees
          </p>
        </div>
      </div>

      <div className="max-h-[680px] overflow-y-auto space-y-2.5 pr-1">
        {employees.length === 0 ? (
          <div className="py-12 text-center text-[#5F6368]">
            No employees matching the selected criteria.
          </div>
        ) : (
          employees.map((emp) => {
            const isSelected = emp.userid === selectedPersonId;
            return (
              <div
                key={emp.userid}
                onClick={() => onSelectPerson(emp.userid)}
                className={`p-3 rounded-xl transition-all cursor-pointer text-left group ${
                  isSelected
                    ? 'bg-black text-white'
                    : 'bg-[#F5F3F1] text-[#111827] hover:bg-[#ECE9E5]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar
                    name={`${emp.first_name} ${emp.last_name}`}
                    src={emp.profile_pic_url}
                    size="xl"
                    avatarId={emp.avatar_id}
                    status={emp.status || 'Active'}
                  />
                  <div className="min-w-0">
                    <p
                      className={`font-semibold truncate transition-colors ${
                        isSelected ? 'text-white' : 'text-[#111827]'
                      }`}
                    >
                      {emp.first_name} {emp.last_name}
                    </p>
                    <p
                      className={`text-[11px] truncate ${
                        isSelected ? 'text-[#9CA3AF]' : 'text-[#5F6368]'
                      }`}
                    >
                      {emp.designation || 'Staff'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
