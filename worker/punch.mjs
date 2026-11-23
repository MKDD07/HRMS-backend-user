const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const query = (db, sql, args) => db.prepare(sql).bind(...args);

export function resolvePunchPolicy(rule, site = null) {
  if (!rule || rule.status === 'Paused') return { mode: 'without_camera', location_required: false };
  if (!['none', 'custom', 'campus', 'group'].includes(rule.mode)) fail('Invalid assigned attendance rule. Contact your administrator.', 409);
  if (rule.mode === 'group' && !site) fail('Assigned campus is unavailable. Contact your administrator.', 409);
  const location = rule.mode === 'group' ? site : rule;
  const locationRequired = rule.mode !== 'none' && !location.is_unrestricted;
  if (locationRequired && (![location.latitude, location.longitude, location.radius_meters].every(Number.isFinite) || location.radius_meters <= 0)) fail('Assigned location is invalid.', 409);
  const photo = rule.photo_required ?? site?.photo_required ?? false;
  return { mode: photo ? 'with_camera' : locationRequired ? 'only_location_based' : 'without_camera', location_required: locationRequired,
    latitude: location.latitude, longitude: location.longitude, radius_meters: location.radius_meters, name: location.name || '' };
}

export function validatePunch(policy, body) {
  if (policy.mode === 'with_camera' && (typeof body.photo_key !== 'string' || !body.photo_key)) fail('Capture and upload a selfie before punching.');
  if (!policy.location_required) return;
  if (![body.latitude, body.longitude].every(Number.isFinite) || Math.abs(body.latitude) > 90 || Math.abs(body.longitude) > 180) fail('Current GPS location is required.');
  const rad = n => n * Math.PI / 180;
  const a = Math.sin(rad(body.latitude - policy.latitude) / 2) ** 2 + Math.cos(rad(policy.latitude)) * Math.cos(rad(body.latitude)) * Math.sin(rad(body.longitude - policy.longitude) / 2) ** 2;
  const distance = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  if (distance > policy.radius_meters) fail('Move within your assigned attendance perimeter.');
}

export async function punchHandle({ db, env, actor, path, method, body = {}, now = new Date() }) {
  const employee = await query(db, 'SELECT employee_id,profile FROM employees WHERE company_id=? AND user_id=?', [actor.company_id, actor.user_id]).first();
  if (!employee) fail('Employee not found.', 404);
  const profile = typeof employee.profile === 'string' ? JSON.parse(employee.profile || '{}') : employee.profile || {};
  const rule = profile.attendance_rule;
  const siteRow = rule?.mode === 'group' ? await query(db, 'SELECT payload FROM geofence_sites WHERE company_id=? AND group_id=?', [actor.company_id, rule.group_id]).first() : null;
  const policy = resolvePunchPolicy(rule, siteRow ? JSON.parse(siteRow.payload) : null);
  if (path === '/api/v1/attendance/photo') {
    if (method !== 'GET') fail('Method not allowed.', 405);
    if (typeof body.key !== 'string' || !body.key.startsWith(`attendance/${actor.company_id}/${actor.user_id}/`)) fail('Photo access denied.', 403);
    const image = await env.HRMS_IMAGES?.get(body.key);
    if (!image) fail('Photo not found.', 404);
    return new Response(image.body, { headers: { 'Content-Type': image.httpMetadata?.contentType || 'image/jpeg', 'Cache-Control': 'no-store' } });
  }
  if (path === '/api/v1/attendance-policy') {
    if (method !== 'GET') fail('Manage employee attendance rules in the admin console.', 405);
    return policy;
  }
  const date = new Date(now.getTime() + 330 * 60000).toISOString().slice(0, 10);
  const time = now.toISOString();
  const args = [actor.company_id, employee.employee_id, date];
  if (path === '/api/v1/getTodaysAttendance') {
    if (method !== 'GET') fail('Method not allowed.', 405);
    const record = await query(db, 'SELECT * FROM attendance WHERE company_id=? AND employee_id=? AND (date=? OR (check_out_time IS NULL AND julianday(check_in_time)>=julianday(?)-1)) ORDER BY check_out_time IS NULL DESC, check_in_time DESC LIMIT 1', [...args, time]).first();
    if (!record) return [];
    const evidence = await query(db, 'SELECT action,photo_key FROM attendance_punch_evidence WHERE company_id=? AND attendance_id=?', [actor.company_id, record.attendance_id]).all();
    const photo = action => { const key = evidence.results.find(e => e.action === action)?.photo_key; return key ? `/api/v1/attendance/photo?key=${encodeURIComponent(key)}` : null; };
    const clock = value => value ? new Date(new Date(value).getTime() + 330 * 60000).toISOString().slice(11, 19) : null;
    const hours = record.check_out_time ? Math.max(0, (new Date(record.check_out_time) - new Date(record.check_in_time)) / 3600000) : 0;
    return [{ ...record, userid: actor.user_id, in_time: clock(record.check_in_time), out_time: clock(record.check_out_time), att_date: record.date, total_hours: `${Math.floor(hours)}:${String(Math.floor(hours % 1 * 60)).padStart(2,'0')}`, move_in_url: photo('punch_in'), move_out_url: photo('punch_out') }];
  }
  if (method !== 'POST') fail('Method not allowed.', 405);
  if (body.userid && body.userid !== actor.user_id) fail('You can only punch your own attendance.', 403);
  if (path === '/api/v1/attendance/upload-image') {
    const match = typeof body.image === 'string' && body.image.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) fail('A selfie image is required.');
    const bytes = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0));
    if (!bytes.length || bytes.length > 5 * 1024 * 1024) fail('Selfie must be smaller than 5 MB.', 413);
    if (!env.HRMS_IMAGES?.put) fail('Attendance photo storage unavailable.', 503);
    const key = `attendance/${actor.company_id}/${actor.user_id}/${date}/${crypto.randomUUID()}`;
    const stored = await env.HRMS_IMAGES.put(key, bytes, { httpMetadata: { contentType: match[1] } });
    if (stored === null || stored === false) fail('Selfie upload failed.', 503);
    return { key, url: `/api/v1/attendance/photo?key=${encodeURIComponent(key)}` };
  }
  const action = body.action === 'check-in' ? 'punch_in' : body.action === 'check-out' ? 'punch_out' : body.action;
  if (!['punch_in', 'punch_out'].includes(action)) fail('Choose punch_in or punch_out.');
  validatePunch(policy, body);
  if (policy.mode === 'with_camera') {
    if (!body.photo_key.startsWith(`attendance/${actor.company_id}/${actor.user_id}/${date}/`) || !await env.HRMS_IMAGES?.head(body.photo_key)) fail('Upload a current selfie before punching.');
    if (await query(db, 'SELECT 1 FROM attendance_punch_evidence WHERE company_id=? AND photo_key=?', [actor.company_id, body.photo_key]).first()) fail('Capture a new selfie for this punch.');
  }
  const existing = await query(db, 'SELECT * FROM attendance WHERE company_id=? AND employee_id=? AND (date=? OR (check_out_time IS NULL AND julianday(check_in_time)>=julianday(?)-1)) ORDER BY check_out_time IS NULL DESC, check_in_time DESC LIMIT 1', [...args, time]).first();
  if (action === 'punch_out' && (!existing || existing.check_out_time)) fail('No open punch-in record found.', 409);
  if (action === 'punch_in' && existing) fail('Attendance already recorded today.', 409);
  const id = existing?.attendance_id || crypto.randomUUID();
  const write = action === 'punch_in'
    ? query(db, 'INSERT INTO attendance(attendance_id,company_id,employee_id,date,check_in_time) VALUES(?,?,?,?,?)', [id, ...args, time])
    : query(db, 'UPDATE attendance SET check_out_time=? WHERE company_id=? AND employee_id=? AND attendance_id=? AND check_out_time IS NULL', [time, actor.company_id, employee.employee_id, id]);
  await db.batch([write, query(db, 'INSERT INTO attendance_punch_evidence(company_id,attendance_id,action,photo_key,latitude,longitude,created_at) VALUES(?,?,?,?,?,?,?)', [actor.company_id, id, action, policy.mode === 'with_camera' ? body.photo_key : null, body.latitude ?? null, body.longitude ?? null, time])]);
  return { attendance_id: id, action, date: existing?.date || date, time };
}
