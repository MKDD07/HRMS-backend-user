import { employeeDossier } from './employeeDossier.mjs';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export async function geofenceRulesHandle({db,actor,method,userid,body={}}) {
  if(actor.role!=='company_admin')fail('Geofence management access required.',403);
  if(!userid&&method==='GET') {
    const rows=await db.prepare('SELECT user_id AS userid,first_name,last_name,department,designation,profile FROM employees WHERE company_id=?').bind(actor.company_id).all();
    return rows.results.map(({profile,...row})=>{const p=JSON.parse(profile||'{}');return {...row,profile_pic_url:p.profile_pic_url||'',attendance_rule:p.attendance_rule||null};});
  }
  if(method==='POST') {
    if(Object.keys(body).some(k=>!['dossier_revision','attendance_rule','shift_id','shift_override'].includes(k)))fail('Only attendance rules and work schedules can be changed here.');
    if(!Number.isInteger(body.dossier_revision))fail('Employee revision is required.');
    return employeeDossier({db,actor,method,userid,body});
  }
  if(method!=='GET')fail('Method not allowed.',405);
  const result=await employeeDossier({db,actor,method,userid});
  const change = result.dossier_audit?.find(entry => entry.fields?.includes('attendance_rule'));
  const editor = change?.actor ? await db.prepare('SELECT first_name,last_name FROM employees WHERE company_id=? AND user_id=?').bind(actor.company_id, change.actor).first() : null;
  result.attendance_rule_updated_by = editor ? [editor.first_name, editor.last_name].filter(Boolean).join(' ') : '';
  return Object.fromEntries(['attendance_rule_updated_by','userid','first_name','last_name','department','designation','profile_pic_url','dossier_revision','available_locations','available_shifts','shift_id','shift_override','attendance_rule'].map(k=>[k,result[k]]));
}
