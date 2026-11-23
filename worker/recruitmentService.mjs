import { assertRecruitmentTransition } from '../shared/recruitmentModel.mjs';
const stmt = (db,sql,params=[]) => db.prepare(sql).bind(...params);
const fail = (message,status=409) => { throw Object.assign(new Error(message),{status}); };
export async function saveRecruitmentRecord({ db,actor,collection,value,previous,id,now }) {
  const old = previous ? JSON.parse(previous.payload) : null;
  assertRecruitmentTransition(collection,old?.status,value.status);
  if (collection === 'requisitions') {
    if (old && !['Draft','Rejected'].includes(old.status)) {
      for (const key of ['title','department','positions','required_by','employment_type','justification']) if (value[key] !== old[key]) fail('Return the requisition to draft before changing its details.');
    }
    if (['Approved','Rejected'].includes(value.status) && value.status !== old?.status && (actor.original_role || actor.role) !== 'company_admin') fail('Only a company administrator can approve or reject requisitions.',403);
    if (value.status === 'Rejected' && !value.rejection_reason) fail('Provide a reason for rejecting this requisition.',400);
    if (['Pending approval','Approved'].includes(value.status) && !value.justification) fail('Explain why this hire is required before submitting.',400);
    value.requested_by = old?.requested_by || actor.user_id;
    value.approved_by = value.status === 'Approved' ? old?.approved_by || actor.user_id : '';
    value.approved_at = value.status === 'Approved' ? old?.approved_at || now : '';
  }
  let prerequisite = '', prerequisiteParams = [];
  const requireGuard = (sql,params) => { prerequisite += ` AND ${sql}`; prerequisiteParams.push(...params); };
  const linked = async (kind,recordId) => {
    const row = await stmt(db,'SELECT payload FROM talent_records WHERE company_id=? AND collection=? AND id=?',[actor.company_id,kind,recordId]).first();
    if (!row) fail('Linked recruitment record was not found.',400);
    return JSON.parse(row.payload);
  };
  if (collection === 'candidates') {
    value.email = value.email.toLowerCase();
    if (old && old.job_id !== value.job_id) fail('An application cannot move to another opening. Create a separate application.');
    if (old) requireGuard("NOT EXISTS(SELECT 1 FROM talent_records o WHERE o.company_id=? AND o.collection='offers' AND json_extract(o.payload,'$.candidate_id')=? AND json_extract(o.payload,'$.status')='Delivery pending')",[actor.company_id,id]);
    if (old) for (const key of ['employee_id','hired_offer_id','hired_at']) if (old[key]) value[key] = old[key];
    if (!old) {
      const job = await linked('jobs',value.job_id);
      const today = new Date(new Date(now).getTime()+330*60000).toISOString().slice(0,10);
      if (job.status !== 'Open' || (job.closing_date && job.closing_date < today)) fail('Applications require an open job before its closing date.',400);
      requireGuard("EXISTS(SELECT 1 FROM talent_records j WHERE j.company_id=? AND j.collection='jobs' AND j.id=? AND json_extract(j.payload,'$.status')='Open' AND (coalesce(json_extract(j.payload,'$.closing_date'),'')='' OR json_extract(j.payload,'$.closing_date')>=?))",[actor.company_id,value.job_id,today]);
    }
    if (value.status === 'Offered' && old?.status !== 'Offered') {
      const today = new Date(new Date(now).getTime()+330*60000).toISOString().slice(0,10);
      requireGuard("EXISTS(SELECT 1 FROM talent_records o WHERE o.company_id=? AND o.collection='offers' AND json_extract(o.payload,'$.candidate_id')=? AND json_extract(o.payload,'$.status') IN ('Approved','Sent','Accepted') AND json_extract(o.payload,'$.valid_until')>=?)",[actor.company_id,id,today]);
    }
    if (value.status === 'Rejected' && !value.rejection_reason) fail('A rejection reason is required.',400);
  }
  if (['interviews','offers'].includes(collection)) {
    if (old && old.candidate_id !== value.candidate_id) fail('Candidate cannot change on an existing interview or offer.');
    const candidate = await linked('candidates',value.candidate_id);
    const active = collection === 'interviews' ? !['Completed','Cancelled'].includes(value.status) : !['Rejected','Withdrawn','Declined','Expired','Accepted'].includes(value.status);
    if (active) {
      if (['Hired','Rejected','Withdrawn'].includes(candidate.status)) fail('Choose an active application.',400);
      requireGuard("EXISTS(SELECT 1 FROM talent_records c WHERE c.company_id=? AND c.collection='candidates' AND c.id=? AND json_extract(c.payload,'$.status') NOT IN ('Hired','Rejected','Withdrawn'))",[actor.company_id,value.candidate_id]);
    }
  }
  if (collection === 'interviews') {
    if (value.end_time <= value.start_time) fail('End time must be after start time on the same date.',400);
    if (old && ['Completed','Cancelled'].includes(old.status)) for (const key of ['title','candidate_id','interviewer_id','date','start_time','end_time','mode','location','status','outcome','notes']) if (value[key] !== old[key]) fail('Completed or cancelled interviews are locked. Create a new interview.');
    if (value.status === 'Scheduled') {
      requireGuard("NOT EXISTS(SELECT 1 FROM talent_records i WHERE i.company_id=? AND i.collection='interviews' AND i.id<>? AND json_extract(i.payload,'$.status')='Scheduled' AND json_extract(i.payload,'$.date')=? AND json_extract(i.payload,'$.interviewer_id')=? AND json_extract(i.payload,'$.start_time')<? AND json_extract(i.payload,'$.end_time')>?)",[actor.company_id,id,value.date,value.interviewer_id,value.end_time,value.start_time]);
    }
  }
  if (collection === 'offers') {
    if (old?.status === 'Delivery pending') fail('Delivery is pending. Use Retry delivery to complete or reconcile the send.');
    if (old?.hired_user_id) fail('Hired offers are immutable.');
    for (const key of ['delivery','response','approved_by','approved_at','hired_user_id','hired_employee_id','onboarding_id']) if (old?.[key]) value[key] = old[key];
    if (value.valid_until > value.joining_date) fail('Offer validity cannot extend beyond the joining date.',400);
    if (old && !['Draft','Rejected'].includes(old.status)) for (const key of ['title','candidate_id','joining_date','annual_ctc','valid_until','notes','offer_text']) if ((value[key] || '') !== (old[key] || '')) fail('Submitted offer details are locked.');
    if (['Approved','Rejected'].includes(value.status) && old?.status !== value.status && (actor.original_role || actor.role) !== 'company_admin') fail('Only a company administrator can approve or reject offers.',403);
    if (['Pending approval','Approved'].includes(value.status) && old?.status !== value.status) {
      const today = new Date(new Date(now).getTime()+330*60000).toISOString().slice(0,10);
      if (value.valid_until < today) fail('Offer validity must not be in the past.',400);
      if (!value.offer_text) fail('Add the offer terms before submission.',400);
      requireGuard("EXISTS(SELECT 1 FROM talent_records i WHERE i.company_id=? AND i.collection='interviews' AND json_extract(i.payload,'$.candidate_id')=? AND json_extract(i.payload,'$.status')='Completed' AND json_extract(i.payload,'$.outcome') IN ('Hire','Strong hire'))",[actor.company_id,value.candidate_id]);
    }
    if (!['Rejected','Withdrawn','Declined','Expired'].includes(value.status)) requireGuard("NOT EXISTS(SELECT 1 FROM talent_records o WHERE o.company_id=? AND o.collection='offers' AND o.id<>? AND json_extract(o.payload,'$.candidate_id')=? AND json_extract(o.payload,'$.status') NOT IN ('Rejected','Withdrawn','Declined','Expired'))",[actor.company_id,id,value.candidate_id]);
    value.approved_by = old?.approved_by || (value.status === 'Approved' ? actor.user_id : '');
    value.approved_at = old?.approved_at || (value.status === 'Approved' ? now : '');
  }
  if (collection === 'jobs' && value.status === 'Open' && old?.status !== 'Open') {
    if (!value.description) fail('Add a job description before publishing.',400);
    const today = new Date(new Date(now).getTime() + 330 * 60000).toISOString().slice(0,10);
    if (value.closing_date && value.closing_date <= today) fail('Closing date must be in the future.',400);
  }
  if (collection === 'jobs' && old?.hired_count) value.hired_count = old.hired_count;
  if (collection === 'jobs' && value.requisition_id && !['Closed','Cancelled'].includes(value.status)) {
    const requisition = await stmt(db,"SELECT payload FROM talent_records WHERE company_id=? AND collection='requisitions' AND id=?",[actor.company_id,value.requisition_id]).first();
    if (!requisition || JSON.parse(requisition.payload).status !== 'Approved') fail('Choose an approved requisition for this opening.',400);
    if (value.positions > JSON.parse(requisition.payload).positions) fail('Open positions exceed the approved requisition.',400);
    prerequisite = " AND EXISTS (SELECT 1 FROM talent_records req WHERE req.company_id=? AND req.collection='requisitions' AND req.id=? AND json_extract(req.payload,'$.status')='Approved' AND CAST(json_extract(req.payload,'$.positions') AS INTEGER)>=?)";
    prerequisiteParams = [actor.company_id,value.requisition_id,value.positions];
  }
  const changeId = crypto.randomUUID();
  value.last_change_id = changeId;
  const write = previous
    ? stmt(db,`UPDATE talent_records SET payload=?,revision=revision+1,updated_at=? WHERE company_id=? AND collection=? AND id=? AND revision=?${prerequisite}`,[JSON.stringify(value),now,actor.company_id,collection,id,previous.revision,...prerequisiteParams])
    : stmt(db,`INSERT INTO talent_records(company_id,collection,id,payload,created_at,updated_at) SELECT ?,?,?,?,?,? WHERE 1=1${prerequisite}`,[actor.company_id,collection,id,JSON.stringify(value),now,now,...prerequisiteParams]);
  const guard = "EXISTS(SELECT 1 FROM talent_records WHERE company_id=? AND collection=? AND id=? AND json_extract(payload,'$.last_change_id')=?)";
  const params = [actor.company_id,collection,id,changeId];
  const action = old?.status === value.status ? 'Updated' : `${old?.status || 'Created'} -> ${value.status}`;
  const auditValue = { ...value }; delete auditValue.last_change_id;
  const statements = [write,stmt(db,`INSERT INTO talent_audit(company_id,id,collection,record_id,actor_id,action,before_json,after_json,created_at) SELECT ?,?,?,?,?,?,?,?,? WHERE ${guard}`,[actor.company_id,changeId,collection,id,actor.user_id,action,old ? JSON.stringify(old) : null,JSON.stringify(auditValue),now,...params])];
  if (old?.status !== value.status) statements.push(stmt(db,`INSERT INTO talent_domain_events(company_id,id,event_type,record_id,payload,created_at) SELECT ?,?,?,?,?,? WHERE ${guard}`,[actor.company_id,changeId,`${collection}.${value.status.toLowerCase().replaceAll(' ','_')}`,id,JSON.stringify({collection,id,status:value.status,previous_status:old?.status || null}),now,...params]));
  await db.batch(statements);
  const saved = await stmt(db,'SELECT * FROM talent_records WHERE company_id=? AND collection=? AND id=?',[actor.company_id,collection,id]).first();
  if (!saved || JSON.parse(saved.payload).last_change_id !== changeId) fail('Save blocked: record changed, interviewer is busy, offer already exists, or required approval/assessment is missing. Refresh and review the linked records.');
  return saved;
}
