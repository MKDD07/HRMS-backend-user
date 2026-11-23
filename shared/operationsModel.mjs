const f = (key, label, type = 'text', extra = {}) => ({ key, label, type, ...extra });
const title = f('title', 'Title', 'text', { required: true });
const employee = f('employee_id', 'Employee', 'employee', { required: true });
const notes = f('notes', 'Notes', 'textarea');
const status = options => f('status', 'Status', 'select', { options, required: true });
const date = (key, label, required = true) => f(key, label, 'date', { required });
const ref = (key, label, collection) => f(key, label, 'reference', { collection, required: true });
const number = (key, label, min = 0, max = 1000000000, required = true) => f(key, label, 'number', { min, max, required });
const currency = f('currency', 'Currency', 'select', { options: ['INR', 'USD', 'EUR', 'GBP', 'AED'], required: true });
export const OPERATIONS = {
  expenses: { page: 'expenses', table: 'hr_expenses', label: 'Expense claims', singular: 'expense claim', approval: true, fields: [title, employee, f('category', 'Category', 'select', { options: ['Travel', 'Meals', 'Accommodation', 'Equipment', 'Internet', 'Other'], required: true }), date('expense_date', 'Expense date'), number('amount', 'Claim amount', 0.01), currency, f('reviewer_id', 'Approver', 'employee', { required: true }), status(['Draft', 'Submitted', 'Approved', 'Rejected', 'Paid']), date('paid_date', 'Payment date', false), f('payment_reference', 'Payment reference'), notes] },
  review_cycles: { page: 'appraisals', table: 'hr_review_cycles', label: 'Review cycles', singular: 'review cycle', fields: [title, date('start_date', 'Start date'), date('end_date', 'End date'), status(['Draft', 'Open', 'Closed']), notes] },
  appraisals: { page: 'appraisals', table: 'hr_appraisals', label: 'Employee reviews', singular: 'employee review', fields: [title, ref('cycle_id', 'Review cycle', 'review_cycles'), employee, f('reviewer_id', 'Manager', 'employee', { required: true }), f('self_review', 'Employee self-review (recorded by HR)', 'textarea'), number('self_rating', 'Self rating (1–5)', 1, 5, false), f('manager_review', 'Manager feedback', 'textarea'), number('manager_rating', 'Manager rating (1–5)', 1, 5, false), f('outcome', 'Final outcome', 'select', { options: ['Exceeds expectations', 'Meets expectations', 'Needs improvement'] }), status(['Draft', 'Self review', 'Manager review', 'Finalized']), notes] },
  benefit_plans: { page: 'benefits', table: 'hr_benefit_plans', label: 'Benefit plans', singular: 'benefit plan', fields: [title, f('provider', 'Provider / insurer', 'text', { required: true }), f('policy_number', 'Policy number'), f('coverage', 'Coverage details', 'textarea', { required: true }), number('coverage_amount', 'Coverage amount'), number('premium', 'Annual premium'), currency, date('start_date', 'Valid from'), date('end_date', 'Renewal / expiry date'), status(['Active', 'Expired', 'Archived']), notes] },
  benefit_enrollments: { page: 'benefits', table: 'hr_benefit_enrollments', label: 'Enrollments', singular: 'enrollment', fields: [title, ref('plan_id', 'Benefit plan', 'benefit_plans'), employee, date('start_date', 'Coverage starts'), date('end_date', 'Coverage ends'), status(['Active', 'Ended']), notes] },
  dependants: { page: 'benefits', table: 'hr_dependants', label: 'Dependants', singular: 'dependant', fields: [f('title', 'Dependant name', 'text', { required: true }), ref('enrollment_id', 'Enrollment', 'benefit_enrollments'), f('relationship', 'Relationship', 'select', { options: ['Spouse', 'Child', 'Parent', 'Other'], required: true }), date('birth_date', 'Date of birth'), status(['Covered', 'Removed']), notes] },
  surveys: { page: 'surveys', table: 'hr_surveys', label: 'Surveys', singular: 'survey', questions: true, fields: [title, f('description', 'Introduction', 'textarea'), date('start_date', 'Opens on'), date('end_date', 'Closes on'), status(['Draft', 'Open', 'Closed'])] },
  survey_responses: { page: 'surveys', table: 'hr_survey_responses', label: 'Responses', singular: 'response', answers: true, fields: [ref('survey_id', 'Survey', 'surveys'), employee, status(['Submitted'])] },
  projects: { page: 'timesheets', table: 'hr_projects', label: 'Projects', singular: 'project', fields: [title, f('client', 'Client'), f('owner_id', 'Project owner', 'employee', { required: true }), date('start_date', 'Start date'), date('end_date', 'End date'), number('budget_hours', 'Budget hours', 0, 1000000), status(['Planned', 'Active', 'Completed', 'Archived']), notes] },
  timesheets: { page: 'timesheets', table: 'hr_timesheets', label: 'Time entries', singular: 'time entry', approval: true, fields: [title, ref('project_id', 'Project', 'projects'), employee, date('work_date', 'Work date'), number('hours', 'Hours', 0.25, 24), f('billable', 'Billable', 'select', { options: ['Yes', 'No'], required: true }), f('reviewer_id', 'Approver', 'employee', { required: true }), status(['Draft', 'Submitted', 'Approved', 'Rejected']), notes] }
};
export const OPERATION_PAGES = {
  expenses: { title: 'Expenses & Reimbursements', description: 'Record claims, attach receipts, review requests, and track reimbursements.', collections: ['expenses'] },
  appraisals: { title: 'Appraisal Reviews', description: 'Manage review cycles, employee feedback, manager ratings, and final outcomes.', collections: ['review_cycles', 'appraisals'] },
  benefits: { title: 'Benefits & Insurance', description: 'Manage benefit plans, employee coverage, dependants, and renewal dates.', collections: ['benefit_plans', 'benefit_enrollments', 'dependants'] },
  surveys: { title: 'Employee Surveys', description: 'Create questionnaires, record employee responses, and review results.', collections: ['surveys', 'survey_responses'] },
  timesheets: { title: 'Projects & Timesheets', description: 'Plan project work, record employee hours, and approve time entries.', collections: ['projects', 'timesheets'] }
};
export function initialOperation(config) {
  return { ...Object.fromEntries(config.fields.map(field => [field.key, field.required ? field.options?.[0] ?? '' : ''])), ...(config.questions ? { questions: [{ id: 'q1', label: '', type: 'rating' }] } : {}), ...(config.answers ? { answers: {} } : {}) };
}
