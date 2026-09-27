import React from 'react';
import { Briefcase, Heart, User } from 'lucide-react';
import { Detail, EditLink, SectionCard } from './employeeUi';
import { val } from './employeeConstants';

export function OverviewTab({ employee: e, onEdit }) {
  const edit = <EditLink onClick={onEdit} />;
  const skills = (e.skills || '').split(',').map((s) => s.trim()).filter(Boolean);
  const cityState = [e.city, e.state].filter(Boolean).join(', ');

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
      <SectionCard icon={User} title="Personal Information" action={edit}>
        <div className="grid grid-cols-2 gap-2.5">
          <Detail label="Gender">{val(e.gender)}</Detail>
          <Detail label="Date of Birth">{val(e.date_of_birth)}</Detail>
          <Detail label="Blood Group">{val(e.blood_group)}</Detail>
          <Detail label="Marital Status">{val(e.marital_status)}</Detail>
          <Detail label="City & State">{val(cityState)}</Detail>
          <Detail label="Country">{val(e.country)}</Detail>
          <Detail label="Residential Address" className="col-span-2">{val(e.address)}</Detail>
        </div>
      </SectionCard>

      <SectionCard icon={Briefcase} title="Organization & Tenure" action={edit}>
        <div className="space-y-2.5">
          <div className="p-2 rounded-lg bg-[#F9FAFB] border border-[#F1F3F5]">
            <Detail label="Reporting Supervisor">{val(e.manager_name)}</Detail>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <Detail label="Date of Joining">{val(e.date_of_joining || e.joining_date)}</Detail>
            <Detail label="Confirmation Date">{val(e.confirmation_date)}</Detail>
            <Detail label="Total Experience">{val(e.experience)}</Detail>
          </div>

          <div>
            <span className="uppercase text-[#6B7280]">Skills</span>
            {skills.length === 0 ? (
              <p className="font-semibold text-[#111827] mt-0.5">—</p>
            ) : (
              <div className="flex flex-wrap gap-1 mt-1">
                {skills.map((s) => (
                  <span
                    key={s}
                    className="px-2 py-0.5 rounded bg-[#F3F4F6] text-[#111827] border border-[#E5E7EB] font-medium"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <span className="uppercase text-[#6B7280]">Bio</span>
            <p className="text-[#374151] mt-1 leading-relaxed bg-[#F9FAFB] p-2 rounded-lg border border-[#F1F3F5]">
              {val(e.bio)}
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        icon={Heart}
        iconClass="text-[#EF4444]"
        title="Emergency Contact & Family"
        action={edit}
        className="sm:col-span-2"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Detail label="Contact Name / Relation">
            {e.emergency_contact_name
              ? `${e.emergency_contact_name}${e.emergency_contact_relation ? ` (${e.emergency_contact_relation})` : ''}`
              : '—'}
          </Detail>
          <Detail label="Emergency Phone">{val(e.emergency_phone)}</Detail>
          <Detail label="Personal Email">{val(e.personal_email)}</Detail>
        </div>
      </SectionCard>
    </div>
  );
}
