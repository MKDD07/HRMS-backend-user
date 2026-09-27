import React, { useState } from 'react';
import { Briefcase, Heart, Save, ShieldCheck, User } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { PanelHeader, SectionCard } from './employeeUi';
import { DEPARTMENTS, STATUS_OPTIONS, TYPE_OPTIONS, inputCls } from './employeeConstants';

const opts = (list) => list.map((v) => ({ value: v, label: v }));
const GENDERS = opts(['Male', 'Female', 'Other']);
const BLOOD_GROUPS = opts(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']);
const MARITAL = opts(['Single', 'Married', 'Divorced']);

const WIDE = 'sm:col-span-2';
const FULL = 'sm:col-span-2 md:col-span-3';

// Every editable field lives here, so adding a field is one line.
const SECTIONS = [
  {
    title: 'Personal & Identity',
    icon: User,
    cols: 'md:grid-cols-3',
    fields: [
      { name: 'first_name', label: 'First Name *', required: true },
      { name: 'last_name', label: 'Last Name' },
      { name: 'email', label: 'Official Email *', type: 'email', required: true },
      { name: 'phone_number', label: 'Phone Number' },
      { name: 'date_of_birth', label: 'Date of Birth', type: 'date' },
      { name: 'gender', label: 'Gender', options: GENDERS },
      { name: 'blood_group', label: 'Blood Group', options: BLOOD_GROUPS },
      { name: 'marital_status', label: 'Marital Status', options: MARITAL },
      { name: 'city', label: 'City' },
      { name: 'state', label: 'State' },
      { name: 'country', label: 'Country' },
      { name: 'address', label: 'Residential Address', span: FULL }
    ]
  },
  {
    title: 'Role & Organization',
    icon: Briefcase,
    cols: 'md:grid-cols-3',
    fields: [
      { name: 'designation', label: 'Designation' },
      { name: 'department', label: 'Department', options: opts(DEPARTMENTS) },
      { name: 'work_location', label: 'Work Location' },
      { name: 'type', label: 'Role Type', options: TYPE_OPTIONS },
      { name: 'status', label: 'Employment Status', options: STATUS_OPTIONS },
      { name: 'manager_name', label: 'Reporting Manager' },
      { name: 'joining_date', label: 'Date of Joining', type: 'date' },
      { name: 'confirmation_date', label: 'Confirmation Date', type: 'date' },
      { name: 'experience', label: 'Total Experience', placeholder: 'e.g. 4.5 Years' },
      { name: 'skills', label: 'Skills (comma-separated)', span: FULL },
      { name: 'bio', label: 'Bio', type: 'textarea', span: FULL }
    ]
  },
  {
    title: 'Bank Account & Statutory KYC',
    icon: ShieldCheck,
    cols: 'md:grid-cols-3',
    fields: [
      { name: 'bank_name', label: 'Bank Name' },
      { name: 'account_no', label: 'Account Number' },
      { name: 'ifsc_code', label: 'IFSC Code' },
      { name: 'pan_card', label: 'PAN Card Number' },
      { name: 'aadhar_card', label: 'Aadhaar Number' },
      { name: 'uan_number', label: 'UAN' },
      { name: 'pf_number', label: 'PF Registration No', span: FULL }
    ]
  },
  {
    title: 'Emergency Contact',
    icon: Heart,
    iconClass: 'text-[#EF4444]',
    cols: 'md:grid-cols-4',
    fields: [
      { name: 'emergency_contact_name', label: 'Contact Name' },
      { name: 'emergency_contact_relation', label: 'Relationship' },
      { name: 'emergency_phone', label: 'Emergency Phone' },
      { name: 'personal_email', label: 'Personal Email', type: 'email' }
    ]
  }
];

// Some backend fields use alternate names
const ALIASES = {
  phone_number: (e) => e.phone_number || e.phone,
  joining_date: (e) => e.date_of_joining || e.joining_date,
  account_no: (e) => e.account_no || e.account_number,
  pan_card: (e) => e.pan_card || e.pan_number
};

function buildForm(employee) {
  const form = {};
  SECTIONS.forEach((s) =>
    s.fields.forEach((f) => {
      form[f.name] = (ALIASES[f.name] ? ALIASES[f.name](employee) : employee[f.name]) ?? '';
    })
  );
  return form;
}

function FormField({ field, value, onChange }) {
  const { name, label, type = 'text', options, span = '', required, placeholder } = field;
  return (
    <div className={span}>
      <label htmlFor={`f-${name}`} className="block font-semibold text-[#111827] mb-1">
        {label}
      </label>
      {options ? (
        <select id={`f-${name}`} value={value} onChange={(e) => onChange(name, e.target.value)} className={inputCls}>
          <option value="">Not set</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea
          id={`f-${name}`}
          rows={2}
          value={value}
          onChange={(e) => onChange(name, e.target.value)}
          className={inputCls}
        />
      ) : (
        <input
          id={`f-${name}`}
          type={type}
          required={required}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(name, e.target.value)}
          className={inputCls}
        />
      )}
    </div>
  );
}

export function EditProfileTab({ employee, onSave, onCancel }) {
  const [form, setForm] = useState(() => buildForm(employee));
  const [saving, setSaving] = useState(false);
  const setField = (name, value) => setForm((f) => ({ ...f, [name]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-1">
      <PanelHeader
        title={`Edit profile: ${employee.first_name} ${employee.last_name || ''}`}
        subtitle="Personal details, role, statutory banking, and emergency contacts."
      >
        <Button type="button" variant="secondary" size="xs" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" size="xs" icon={Save} disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </PanelHeader>

      {SECTIONS.map((section) => (
        <SectionCard key={section.title} icon={section.icon} iconClass={section.iconClass} title={section.title}>
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${section.cols} gap-3`}>
            {section.fields.map((f) => (
              <FormField key={f.name} field={f} value={form[f.name]} onChange={setField} />
            ))}
          </div>
        </SectionCard>
      ))}
    </form>
  );
}
