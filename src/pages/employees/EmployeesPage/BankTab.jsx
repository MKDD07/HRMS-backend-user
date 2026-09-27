import React, { useState } from 'react';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { EditLink, SectionCard } from './employeeUi';
import { maskTail, val } from './employeeConstants';

function Field({ label, children, className = '' }) {
  return (
    <div className={`p-2.5 rounded-lg bg-[#F9FAFB] border border-[#F1F3F5] ${className}`}>
      <span className="uppercase text-[#6B7280]">{label}</span>
      <p className="font-mono font-semibold text-[#111827] mt-0.5 break-all">{children}</p>
    </div>
  );
}

export function BankTab({ employee: e, onEdit }) {
  const [reveal, setReveal] = useState(false);
  const show = (v) => (reveal ? val(v) : maskTail(v));

  return (
    <div className="pt-1">
      <SectionCard
        icon={ShieldCheck}
        title="Bank Account & Statutory KYC"
        action={
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setReveal((r) => !r)}
              className="inline-flex items-center gap-1 font-semibold text-[#374151] hover:text-[#111827] cursor-pointer"
            >
              {reveal ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {reveal ? 'Hide' : 'Show'} numbers
            </button>
            <EditLink onClick={onEdit}>Edit Details</EditLink>
          </div>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
          <Field label="Bank Name">{val(e.bank_name)}</Field>
          <Field label="Account Number">{show(e.account_no || e.account_number)}</Field>
          <Field label="IFSC Code">{val(e.ifsc_code)}</Field>
          <Field label="PAN Card Number">{show(e.pan_card || e.pan_number)}</Field>
          <Field label="Aadhaar Number">{show(e.aadhar_card)}</Field>
          <Field label="UAN">{show(e.uan_number)}</Field>
          <Field label="PF Registration" className="sm:col-span-2 md:col-span-3">{val(e.pf_number)}</Field>
        </div>
      </SectionCard>
    </div>
  );
}
