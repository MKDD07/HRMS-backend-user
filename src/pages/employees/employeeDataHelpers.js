// Helper utilities, models, and mock generators for employee-specific
// Attendance Calendars, Salary structures, KRI/KPI performance, and Documents.

export const DEFAULT_EMPLOYEE_DOCUMENTS = [
  {
    id: 'doc-1',
    title: 'Employment Offer & Appointment Letter',
    category: 'Employment Contract',
    format: 'PDF',
    size: '1.4 MB',
    date: '2022-03-15',
    verified: true,
    description: 'Official corporate appointment letter confirming terms of employment, compensation package, and designations.'
  },
  {
    id: 'doc-2',
    title: 'Signed Non-Disclosure & IP Assignment Agreement',
    category: 'Legal & Compliance',
    format: 'PDF',
    size: '840 KB',
    date: '2022-03-15',
    verified: true,
    description: 'Proprietary rights, intellectual property protection, and confidentiality covenant executed upon onboarding.'
  },
  {
    id: 'doc-3',
    title: 'Government Aadhaar Identity Card',
    category: 'KYC & Government ID',
    format: 'PDF',
    size: '1.1 MB',
    date: '2022-03-16',
    verified: true,
    description: 'Unique Identification Authority of India (UIDAI) verified identity proof document.'
  },
  {
    id: 'doc-4',
    title: 'Permanent Account Number (PAN) Card',
    category: 'Tax & Statutory',
    format: 'PDF',
    size: '620 KB',
    date: '2022-03-16',
    verified: true,
    description: 'Income Tax Department government permanent account card for statutory TDS compliance.'
  },
  {
    id: 'doc-5',
    title: 'Highest Degree & Academic Transcript',
    category: 'Academic Credentials',
    format: 'PDF',
    size: '2.4 MB',
    date: '2022-03-18',
    verified: true,
    description: 'Bachelor of Technology degree certificate validated by background verification agency.'
  },
  {
    id: 'doc-6',
    title: 'Previous Employer Relieving & Service Letter',
    category: 'Experience & BGV',
    format: 'PDF',
    size: '1.8 MB',
    date: '2022-03-18',
    verified: true,
    description: 'Formal release certificate confirming previous experience and conduct.'
  }
];

export function getStoredDocuments(userid) {
  try {
    const raw = localStorage.getItem(`pulse_docs_${userid}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error(e);
  }
  return DEFAULT_EMPLOYEE_DOCUMENTS;
}

export function saveStoredDocuments(userid, docs) {
  try {
    localStorage.setItem(`pulse_docs_${userid}`, JSON.stringify(docs));
  } catch (e) {
    console.error(e);
  }
}

// Download generator that triggers an actual browser file download
export function downloadDocument(doc, employee) {
  const content = `===================================================================
HRTIVA ENTERPRISE SYSTEMS - SECURE DOCUMENT REPOSITORY
===================================================================
Document Title:    ${doc.title.toUpperCase()}
Category:          ${doc.category}
Document Reference: DOC-${employee.userid}-${doc.id || Math.floor(Math.random() * 10000)}
Date of Record:    ${doc.date || '2026-09-14'}
Verification:      Digitally Verified via Cloudflare D1 & R2 Hash

EMPLOYEE RECIPIENT INFORMATION
-------------------------------------------------------------------
Employee ID:       ${employee.userid}
Full Legal Name:   ${employee.first_name} ${employee.last_name}
Department:        ${employee.department}
Designation:       ${employee.designation}
Work Location:     ${employee.work_location || 'HQ Vashi Infotech Park'}
Official Email:    ${employee.email}

RECORD DETAILS
-------------------------------------------------------------------
${doc.description || `This document serves as an authentic certified copy of employment records for ${employee.first_name} ${employee.last_name}. All provisions, statutory declarations, and corporate policies outlined herein have been recorded under Enterprise ISO 27001 compliance standards.`}

File Format:       ${doc.format || 'PDF'}
Storage Bucket:    r2-enterprise-vault/hrtiva_ent_01/${employee.userid}
Security Hash:     SHA256: 9e8a71b89efc440d912cb84910cf981329

Issued by:
Corporate Human Resources & Operations Bureau
PulseHRMS Enterprise Cloud
===================================================================`;

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${employee.userid}_${doc.title.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Default Salary Structure per employee
export function getEmployeeSalary(userid) {
  const defaultMap = {
    'TYS-1021': {
      annual_ctc: 1800000,
      monthly_gross: 150000,
      basic: 75000,
      hra: 37500,
      special_allowance: 27500,
      conveyance: 5000,
      medical_allowance: 5000,
      pf_deduction: 9000,
      professional_tax: 200,
      tds_tax: 15800,
      monthly_net: 125000,
      pay_frequency: 'Monthly',
      bank_account: '•••• •••• 9842',
      bank_name: 'HDFC Bank Ltd',
      currency: 'INR'
    },
    'TYS-1008': {
      annual_ctc: 1560000,
      monthly_gross: 130000,
      basic: 65000,
      hra: 32500,
      special_allowance: 22500,
      conveyance: 5000,
      medical_allowance: 5000,
      pf_deduction: 7800,
      professional_tax: 200,
      tds_tax: 13000,
      monthly_net: 109000,
      pay_frequency: 'Monthly',
      bank_account: '•••• •••• 4118',
      bank_name: 'ICICI Bank Ltd',
      currency: 'INR'
    },
    'TYS-1003': {
      annual_ctc: 1440000,
      monthly_gross: 120000,
      basic: 60000,
      hra: 30000,
      special_allowance: 20000,
      conveyance: 5000,
      medical_allowance: 5000,
      pf_deduction: 7200,
      professional_tax: 200,
      tds_tax: 11600,
      monthly_net: 101000,
      pay_frequency: 'Monthly',
      bank_account: '•••• •••• 2291',
      bank_name: 'Axis Bank Ltd',
      currency: 'INR'
    },
    'TYS-1005': {
      annual_ctc: 1320000,
      monthly_gross: 110000,
      basic: 55000,
      hra: 27500,
      special_allowance: 17500,
      conveyance: 5000,
      medical_allowance: 5000,
      pf_deduction: 6600,
      professional_tax: 200,
      tds_tax: 9200,
      monthly_net: 94000,
      pay_frequency: 'Monthly',
      bank_account: '•••• •••• 7741',
      bank_name: 'Kotak Mahindra Bank',
      currency: 'INR'
    }
  };

  try {
    const raw = localStorage.getItem(`pulse_salary_${userid}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error(e);
  }

  return defaultMap[userid] || {
    annual_ctc: 1200000,
    monthly_gross: 100000,
    basic: 50000,
    hra: 25000,
    special_allowance: 17000,
    conveyance: 4000,
    medical_allowance: 4000,
    pf_deduction: 6000,
    professional_tax: 200,
    tds_tax: 8800,
    monthly_net: 85000,
    pay_frequency: 'Monthly',
    bank_account: '•••• •••• 1234',
    bank_name: 'State Bank of India',
    currency: 'INR'
  };
}

export function saveEmployeeSalary(userid, salary) {
  try {
    localStorage.setItem(`pulse_salary_${userid}`, JSON.stringify(salary));
  } catch (e) {
    console.error(e);
  }
}

// Key Performance Indicators (KPI) and Key Risk Indicators (KRI)
export function getEmployeeKpiKri(userid) {
  const defaultPerformance = {
    review_period: 'FY 2026-27 (Q2 Mid-Year Review)',
    overall_rating: 4.8,
    max_rating: 5.0,
    rating_category: 'Exceeds Expectations',
    kpis: [
      {
        id: 'kpi-1',
        name: 'Core System & Architecture Delivery',
        description: 'Design and rollout of distributed edge APIs and D1 database migration.',
        target: '95%',
        achieved: '99%',
        weight: '30%',
        status: 'Exceeded',
        score: 4.9
      },
      {
        id: 'kpi-2',
        name: 'Cloud Availability & Service Uptime',
        description: 'Maintain sub-50ms latency across global edge points with zero unplanned outages.',
        target: '99.90%',
        achieved: '99.98%',
        weight: '25%',
        status: 'Exceeded',
        score: 5.0
      },
      {
        id: 'kpi-3',
        name: 'Sprint Velocity & Defect-Free Deployments',
        description: 'Complete 100% committed sprint epics with < 2% defect escaping rate.',
        target: '90%',
        achieved: '94%',
        weight: '25%',
        status: 'Achieved',
        score: 4.7
      },
      {
        id: 'kpi-4',
        name: 'Mentorship & Engineering Governance',
        description: 'Active peer code reviews, architecture RFC publications, and junior engineer mentoring.',
        target: '85%',
        achieved: '92%',
        weight: '20%',
        status: 'Achieved',
        score: 4.6
      }
    ],
    kris: [
      {
        id: 'kri-1',
        name: 'Information Security & ISO Compliance Risk',
        indicator: 'Privileged Cloud Credential & Data Leakage Vulnerability',
        current_value: '0 Flagged Events',
        threshold: '< 1 incident/quarter',
        level: 'Low Risk',
        status_color: 'green',
        mitigation: 'Strict hardware MFA, biometric session checks, and zero-trust IAM roles enforced.'
      },
      {
        id: 'kri-2',
        name: 'Key Personnel Single-Point-of-Failure Risk',
        indicator: 'Documentation & Knowledge Redundancy Coverage',
        current_value: '95% Runbook Coverage',
        threshold: '> 85% documented',
        level: 'Low Risk',
        status_color: 'green',
        mitigation: 'Comprehensive engineering architecture blueprints cataloged in repository.'
      },
      {
        id: 'kri-3',
        name: 'Overtime & Burnout Capacity Risk',
        indicator: 'Consecutive Excessive Hours (>50 hrs/week)',
        current_value: 'Normal Load (42.5 hrs/wk avg)',
        threshold: '< 48 hrs/wk average',
        level: 'Low Risk',
        status_color: 'green',
        mitigation: 'Workload balanced across microservice squads with flexible remote scheduling.'
      },
      {
        id: 'kri-4',
        name: 'Mandatory Regulatory Training Completion',
        indicator: 'POSH, GDPR, and Enterprise Ethics Certifications',
        current_value: '100% Certified',
        threshold: '100% on-time completion',
        level: 'Low Risk',
        status_color: 'green',
        mitigation: 'Automated refresher reminders active; all yearly certificates current.'
      }
    ]
  };

  try {
    const raw = localStorage.getItem(`pulse_kpikri_${userid}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error(e);
  }

  return defaultPerformance;
}

export function saveEmployeeKpiKri(userid, data) {
  try {
    localStorage.setItem(`pulse_kpikri_${userid}`, JSON.stringify(data));
  } catch (e) {
    console.error(e);
  }
}

// Generate Month Days Attendance for September 2026 (or specified month)
export function generateMonthAttendance(year = 2026, monthIndex = 8) {
  // monthIndex 8 is September (0-indexed)
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const days = [];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Current simulation day: September 14, 2026
  const simulationCurrentDay = 14;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, monthIndex, d);
    const dayOfWeek = dateObj.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    let status = 'Upcoming';
    let checkIn = null;
    let checkOut = null;
    let hours = '00:00';
    let note = '';

    if (isWeekend) {
      status = 'Weekend';
      note = 'Weekly Off';
    } else if (d > simulationCurrentDay) {
      status = 'Upcoming';
    } else if (d === 10) {
      // Leave example
      status = 'Leave';
      note = 'Casual Leave Approved';
    } else if (d === simulationCurrentDay) {
      status = 'Present';
      checkIn = '09:25 AM';
      checkOut = 'Active (In Office)';
      hours = '05:35 hrs';
      note = 'Shift In Progress';
    } else {
      status = 'Present';
      const randomMins = 15 + ((d * 7) % 20);
      const outMins = 25 + ((d * 3) % 25);
      checkIn = `09:${String(randomMins).padStart(2, '0')} AM`;
      checkOut = `06:${String(outMins).padStart(2, '0')} PM`;
      hours = '09:10 hrs';
      note = 'Biometric Geofence Verified';
    }

    days.push({
      day: d,
      date: dateStr,
      dayName: dayNames[dayOfWeek],
      isWeekend,
      status,
      checkIn,
      checkOut,
      hours,
      note
    });
  }

  return days;
}
