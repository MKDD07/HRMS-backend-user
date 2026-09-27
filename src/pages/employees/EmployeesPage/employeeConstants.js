export const DEPARTMENTS = [
  'Engineering & Technology',
  'Product & Design',
  'Human Resources',
  'Finance & Payroll',
  'Sales & Operations',
  'Executive Leadership'
];

export const LOCATIONS = [
  { value: 'HQ Vashi Infotech Park', label: 'HQ Vashi Infotech Park, Navi Mumbai' },
  { value: 'Bengaluru Tech Hub', label: 'Bengaluru Tech Hub' },
  { value: 'Remote / Home Office', label: 'Remote / Home Office' }
];

export const TYPE_OPTIONS = [
  { value: 'Employee', label: 'Employee (Standard Access)' },
  { value: 'Department Manager', label: 'Department Manager' },
  { value: 'HR Admin', label: 'HR Admin' },
  { value: 'Super Admin', label: 'Super Admin' },
  { value: 'Contractor', label: 'Contractor / Consultant' },
  { value: 'Executive', label: 'Executive Leadership' },
  { value: 'Intern', label: 'Intern / Trainee' }
];

export const STATUS_OPTIONS = [
  { value: 'Active', label: 'Active' },
  { value: 'OnLeave', label: 'On Leave' },
  { value: 'Probation', label: 'Probation' }
];

// Shared input style for forms
export const inputCls =
  'w-full p-2 rounded-lg border border-[#D1D5DB] bg-white focus:ring-1 focus:ring-[#4F46E5]';

// Missing values render as a dash, never as a fake value
export const val = (v) => (v === undefined || v === null || v === '' ? '—' : v);

export const money = (v) =>
  v === undefined || v === null || v === '' ? '—' : `₹${Number(v).toLocaleString('en-IN')}`;

export const maskTail = (v, visible = 4) => {
  if (!v) return '—';
  const s = String(v);
  return s.length <= visible ? s : `${'•'.repeat(s.length - visible)}${s.slice(-visible)}`;
};
