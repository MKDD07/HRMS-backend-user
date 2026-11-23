// Existing company identities and response envelopes are retained during the staged rollout.
export const RECRUITMENT_TRANSITIONS = {
  requisitions: {
    Draft: ['Pending approval', 'Cancelled'],
    'Pending approval': ['Approved', 'Rejected', 'Cancelled'],
    Approved: ['Cancelled'], Rejected: ['Draft', 'Cancelled'], Cancelled: [], Fulfilled: []
  },
  jobs: { Draft: ['Open', 'Cancelled'], Open: ['On hold', 'Closed', 'Cancelled'], 'On hold': ['Open', 'Closed', 'Cancelled'], Closed: [], Cancelled: [] },
  candidates: { Applied: ['Screening','Interview','Rejected','Withdrawn'], Screening: ['Applied','Interview','Rejected','Withdrawn'], Interview: ['Screening','Offered','Rejected','Withdrawn'], Offered: ['Interview','Rejected','Withdrawn'], Hired: [], Rejected: [], Withdrawn: [] },
  interviews: { Scheduled: ['Completed','Cancelled'], Completed: [], Cancelled: [] },
  offers: { Draft: ['Pending approval','Withdrawn'], 'Pending approval': ['Approved','Rejected','Withdrawn'], Approved: ['Withdrawn'], Rejected: ['Draft','Withdrawn'], 'Delivery pending': [], Sent:['Withdrawn'], Accepted:[], Declined:[], Expired:[], Withdrawn: [] }
};
export function recruitmentStatuses(collection, record) {
  const machine = RECRUITMENT_TRANSITIONS[collection];
  if (!machine) return null;
  return record ? [record.status, ...(machine[record.status] || [])] : [collection === 'candidates' ? 'Applied' : collection === 'interviews' ? 'Scheduled' : 'Draft'];
}
export function assertRecruitmentTransition(collection, previous, next) {
  const machine = RECRUITMENT_TRANSITIONS[collection];
  if (!machine) return;
  const initial = collection === 'candidates' ? 'Applied' : collection === 'interviews' ? 'Scheduled' : 'Draft';
  const allowed = previous ? next === previous || machine[previous]?.includes(next) : next === initial;
  if (!allowed) throw Object.assign(new Error(previous ? `Cannot move ${collection} from ${previous} to ${next}.` : `New ${collection} must start as ${initial}.`), { status: 409 });
}
