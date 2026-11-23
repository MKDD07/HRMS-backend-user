const field = (key, label, type = 'text', extra = {}) => ({ key, label, type, ...extra });
const title = field('title', 'Title', 'text', { required: true });
const employee = field('employee_id', 'Employee', 'employee', { required: true });
const due = field('due_date', 'Due date', 'date', { required: true });
const notes = field('notes', 'Notes', 'textarea');
const status = options => field('status', 'Status', 'select', { options, required: true });
export const TALENT_COLLECTIONS = {
  requisitions: { page: 'recruitment', label: 'Hiring requisitions', singular: 'hiring requisition', fields: [title, field('department','Department','text',{required:true}), field('positions','Requested positions','number',{required:true,min:1,max:1000,default:1}), field('employment_type','Employment type','select',{options:['Full-time','Part-time','Contract','Internship'],default:'Full-time',required:true}), field('required_by','Required by','date'), status(['Draft','Pending approval','Approved','Rejected','Cancelled','Fulfilled']), field('justification','Hiring justification','textarea'), field('rejection_reason','Rejection reason','textarea',{when:{key:'status',values:['Rejected']},required:true})] },
  jobs: { page: 'recruitment', label: 'Job openings', singular: 'job opening', fields: [title, field('department', 'Department', 'text', { required: true }), field('location', 'Location'), field('positions', 'Open positions', 'number', { required: true, min: 1, max: 1000, default: 1 }), status(['Draft', 'Open', 'On hold', 'Closed']), field('description', 'Job description', 'textarea')] },
  candidates: { page: 'recruitment', label: 'Candidates', singular: 'candidate', fields: [field('title', 'Candidate name', 'text', { required: true }), field('email', 'Email', 'email', { required: true }), field('phone', 'Phone'), field('job_id', 'Job opening', 'reference', { collection: 'jobs', required: true }), status(['Applied', 'Screening', 'Interview', 'Offered', 'Hired', 'Rejected', 'Withdrawn']), field('interview_date', 'Interview date', 'date'), notes] },
  onboarding: { page: 'onboarding', label: 'Onboarding plans', singular: 'onboarding plan', fields: [title, employee, field('owner_id', 'Coordinator', 'employee', { required: true }), field('start_date', 'Joining date', 'date', { required: true }), due, field('probation_months', 'Probation duration (months)', 'number', { min: 1, max: 36 }), field('probation_end_date', 'Probation end date override', 'date'), status(['Not started', 'In progress', 'Completed', 'Cancelled']), notes], checklist: ['Collect joining documents', 'Prepare equipment and access', 'Complete orientation', 'Confirm team introduction'] },
  offboarding: { page: 'offboarding', label: 'Exit plans', singular: 'exit plan', fields: [title, employee, field('owner_id', 'Coordinator', 'employee', { required: true }), field('start_date', 'Notice date', 'date', { required: true }), field('due_date', 'Last working date', 'date', { required: true }), status(['Not started', 'In progress', 'Completed', 'Cancelled']), notes], checklist: ['Complete knowledge handover', 'Confirm asset return', 'Confirm access revocation', 'Record exit interview', 'Confirm final settlement review'] },
  goals: { page: 'performance', label: 'Objectives', singular: 'objective', fields: [title, employee, due, status(['Not started', 'On track', 'At risk', 'Completed', 'Cancelled']), notes], keyResults: true },
  asset_lists: { page: 'assets', label: 'Asset lists', singular: 'asset list', assetTypes: true, fields: [field('title', 'List name', 'text', { required: true }), notes] },
  assets: { page: 'assets', label: 'Assets', singular: 'asset', fields: [
    field('title', 'Asset name', 'text', { required: true, section: 'Asset details' }),
    field('list_id', 'Asset list', 'reference', { collection: 'asset_lists' }),
    field('serial_number', 'Serial / asset tag', 'text', { required: true }),
    field('category', 'Asset type', 'select', { options: ['Laptop', 'Desktop', 'Phone', 'Tablet', 'Monitor', 'Printer', 'Network equipment', 'Accessory', 'Other'], required: true }),
    field('custom_type', 'Other asset type name', 'text', { required: true, when: { key: 'category', values: ['Other'] } }),
    field('brand', 'Brand / manufacturer'), field('model', 'Model'), field('location', 'Storage / office location'),
    field('condition', 'Condition', 'select', { options: ['New', 'Good', 'Fair', 'Damaged'], required: true }),
    status(['Available', 'Maintenance', 'Retired']),
    field('processor', 'Processor', 'text', { section: 'Technical specifications', when: { key: 'category', values: ['Laptop', 'Desktop'] } }),
    field('memory', 'RAM', 'text', { when: { key: 'category', values: ['Laptop', 'Desktop', 'Phone', 'Tablet'] } }),
    field('storage', 'Storage capacity', 'text', { when: { key: 'category', values: ['Laptop', 'Desktop', 'Phone', 'Tablet'] } }),
    field('operating_system', 'Operating system', 'text', { when: { key: 'category', values: ['Laptop', 'Desktop', 'Phone', 'Tablet'] } }),
    field('imei', 'IMEI', 'text', { when: { key: 'category', values: ['Phone', 'Tablet'] } }),
    field('screen_size', 'Screen size', 'text', { when: { key: 'category', values: ['Monitor', 'Laptop', 'Phone', 'Tablet'] } }),
    field('specifications', 'Additional specifications', 'textarea'),
    field('purchase_date', 'Purchase date', 'date', { adminOnly: true, section: 'Purchase details - admin only' }),
    field('purchase_price', 'Purchase price', 'number', { min: 0, max: 1000000000, adminOnly: true }),
    field('currency', 'Currency', 'select', { options: ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD', 'JPY'], default: 'INR', adminOnly: true }),
    field('vendor', 'Vendor / supplier', 'text', { adminOnly: true }),
    field('invoice_number', 'Invoice number', 'text', { adminOnly: true }),
    field('warranty_until', 'Warranty expiry', 'date', { adminOnly: true }),
    field('purchase_notes', 'Purchase / warranty notes', 'textarea', { adminOnly: true }), notes
  ] },
  asset_issues: { page: 'assets', label: 'Individual issued', singular: 'asset issue', fields: [
    field('asset_id', 'Asset', 'reference', { collection: 'assets', required: true }), employee,
    field('issue_date', 'Issued / sent date', 'date', { required: true }),
    field('received_date', 'Employee received date', 'date'),
    field('return_date', 'Returned to company date', 'date'),
    status(['Issued', 'Received', 'Returned']),
    field('acknowledgement_note', 'Acknowledgement note', 'textarea'),
    field('return_condition', 'Return condition', 'select', { options: ['Good', 'Fair', 'Damaged'], when: { key: 'status', values: ['Returned'] }, required: true }), notes
  ] },
  courses: { page: 'learning', label: 'Course catalogue', singular: 'course', fields: [title, field('provider', 'Provider'), field('url', 'Course link', 'url'), field('hours', 'Duration (hours)', 'number', { min: 0, max: 10000 }), status(['Draft', 'Published', 'Archived']), field('description', 'Description', 'textarea')] },
  enrollments: { page: 'learning', label: 'Learning assignments', singular: 'learning assignment', fields: [field('title', 'Assignment title', 'text', { required: true }), field('course_id', 'Course', 'reference', { collection: 'courses', required: true }), employee, due, field('progress', 'Progress (%)', 'number', { min: 0, max: 100, default: 0 }), status(['Not started', 'In progress', 'Completed', 'Cancelled']), notes] }
};
TALENT_COLLECTIONS.jobs.fields.splice(1,0,field('requisition_id','Approved requisition','reference',{collection:'requisitions'}));
TALENT_COLLECTIONS.candidates.fields.push(field('source','Application source','select',{options:['Direct','Referral','Job board','Agency','Other']}),field('rejection_reason','Rejection reason','textarea',{when:{key:'status',values:['Rejected']},required:true}));
TALENT_COLLECTIONS.interviews = { page:'recruitment', label:'Interviews', singular:'interview', fields:[title,field('candidate_id','Candidate','reference',{collection:'candidates',required:true}),field('interviewer_id','Interviewer','employee',{required:true}),field('date','Interview date','date',{required:true}),field('start_time','Start time (IST)','time',{required:true}),field('end_time','End time (IST)','time',{required:true}),field('mode','Mode','select',{options:['Video','Phone','In person'],required:true}),field('location','Meeting link / location'),status(['Scheduled','Completed','Cancelled']),field('outcome','HR assessment','select',{options:['Hire','Strong hire','No hire','Undecided'],when:{key:'status',values:['Completed']},required:true}),notes] };
TALENT_COLLECTIONS.offers = { page:'recruitment', label:'Offers', singular:'offer', fields:[title,field('candidate_id','Candidate','reference',{collection:'candidates',required:true}),field('joining_date','Proposed joining date','date',{required:true}),field('annual_ctc','Annual CTC (INR)','number',{required:true,min:1,max:1000000000}),field('valid_until','Valid until','date',{required:true}),status(['Draft','Pending approval','Approved','Rejected','Withdrawn']),field('rejection_reason','Rejection reason','textarea',{when:{key:'status',values:['Rejected']},required:true}),notes] };
TALENT_COLLECTIONS.offers.fields.push(field('offer_text','Offer terms','textarea'));
TALENT_COLLECTIONS.offers.fields.find(item => item.key === 'status').options.push('Delivery pending','Sent','Accepted','Declined','Expired');
TALENT_COLLECTIONS.jobs.fields.push(field('closing_date','Closing date','date'));
TALENT_COLLECTIONS.jobs.fields.find(field => field.key === 'status').options.push('Cancelled');
TALENT_COLLECTIONS.letter_settings = { page: 'onboarding', label: 'Letter settings', singular: 'letter settings', singleton: true, documentContent: true, fields: [title, field('content', 'Letterhead settings', 'textarea', { maxLength: 1000000, required: true }), status(['Draft', 'Published'])] };
for (const page of ['onboarding', 'offboarding']) {
  TALENT_COLLECTIONS[`${page}_templates`] = { page, label: 'Templates', singular: 'template', fields: [title, field('kind', 'Document type'), field('content', 'Document content', 'textarea', { maxLength: 1000000, required: true }), status(['Draft', 'Published'])], documentContent: true };
  TALENT_COLLECTIONS[`${page}_documents`] = { page, label: 'Documents', singular: 'document', fields: [title, employee, field('kind', 'Document type'), field('source_key', 'Automation reference'), field('content', 'Document content', 'textarea', { maxLength: 1000000, required: true }), status(['Draft', 'Finalized'])], documentContent: true };
}
export const TALENT_PAGES = {
  recruitment: { title: 'Recruitment & ATS', description: 'Manage openings, interviews and offers throughout your hiring workflow.', collections: ['requisitions', 'jobs', 'candidates','interviews','offers'] },
  onboarding: { title: 'Onboarding plans', description: 'Welcome new joiners, prepare their papers, and track every step.', collections: ['onboarding'] },
  offboarding: { title: 'Offboarding & Exit', description: 'Coordinate handover, clearance, and exit tasks in one place.', collections: ['offboarding'] },
  performance: { title: 'Goals & OKRs', description: 'Set objectives, measure key results, and review progress.', collections: ['goals'] },
  assets: { title: 'Assets', description: 'Maintain your inventory and track equipment assignments and returns.', collections: ['assets', 'asset_issues', 'asset_lists'] },
  learning: { title: 'Learning & Development', description: 'Build your course catalogue and follow employee learning progress.', collections: ['courses', 'enrollments'] }
};
export function recordProgress(record, config) {
  if (config.checklist) return record.checklist?.length ? Math.round(record.checklist.filter(item => item.done).length / record.checklist.length * 100) : 0;
  if (config.keyResults) return record.key_results?.length ? Math.round(record.key_results.reduce((sum, item) => sum + Math.min(1, Math.max(0, Number(item.current) / Number(item.target))), 0) / record.key_results.length * 100) : 0;
  return Number(record.progress) || 0;
}

export const ASSET_TECHNICAL_FIELDS = ['processor', 'memory', 'storage', 'operating_system', 'imei', 'screen_size', 'specifications'];
export const fieldIsVisible = (field, record) => !(record.list_id && ASSET_TECHNICAL_FIELDS.includes(field.key)) && (!field.when || field.when.values.includes(record[field.when.key]));
