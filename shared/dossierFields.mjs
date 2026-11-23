export const DOSSIER_SECTIONS = [
  { title: 'Personal details', fields: [
    ['first_name','First name','text',true],['last_name','Last name'],['email','Work email','email',true],['phone_number','Phone','tel'],['date_of_birth','Date of birth','date'],['gender','Gender'],['blood_group','Blood group'],['marital_status','Marital status'],['address','Address'],['city','City'],['state','State'],['country','Country'],['zipcode','Postal code'],
  ] },
  { title: 'Employment', fields: [
    ['designation','Job title'],['department','Department'],['employment_type','Employment type'],['status','Employment status'],['work_location','Work location'],['joining_date','Joining date','date'],['confirmation_date','Confirmation date','date'],['last_working_date','Last working date','date'],['reports_to_userid','Reporting manager ID'],['skills','Skills'],['bio','Notes'],
  ] },
  { title: 'Bank & statutory details', fields: [
    ['account_holder','Account holder'],['preferred_payment_method','Preferred payment method'],['upi_id','UPI ID'],
    ['bank_name','Bank name'],['account_no','Account number'],['ifsc_code','IFSC'],['branch_name','Branch'],['pan_card','PAN'],['aadhar_card','Aadhaar'],['uan_number','UAN'],['pf_number','PF number'],
  ] },
  { title: 'Emergency contact', fields: [
    ['emergency_contact_name','Contact name'],['emergency_contact_relation','Relationship'],['emergency_phone','Emergency phone','tel'],['personal_email','Personal email','email'],
  ] },
];
export const DOSSIER_FIELDS = DOSSIER_SECTIONS.flatMap(section => section.fields);
export function normalizeDossier(values = {}) {
  const aliases = { phone_number: ['phone'], date_of_birth: ['dob'], joining_date: ['date_of_joining'], account_no: ['account_number'], pan_card: ['pan_number'], employment_type: ['employee_type'] };
  return Object.fromEntries(DOSSIER_FIELDS.map(([key]) => [key, values[key] ?? aliases[key]?.map(alias => values[alias]).find(value => value != null) ?? '']));
}
