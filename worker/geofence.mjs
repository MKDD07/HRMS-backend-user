const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const stmt=(db,sql,values=[])=>db.prepare(sql).bind(...values);
export async function geofenceSites(db,company) {
  const rows=await stmt(db,'SELECT group_id,payload,revision FROM geofence_sites WHERE company_id=? ORDER BY group_id',[company]).all();
  return rows.results.map(row=>({...JSON.parse(row.payload),group_id:row.group_id,revision:row.revision}));
}
export function resolveAttendanceRule(rule,sites) {
  if (!rule) return null;
  if (rule.mode!=='group') return rule;
  const site=sites.find(s=>s.group_id===rule.group_id);
  return {...rule,name:site?.name||'',latitude:site?.latitude??null,longitude:site?.longitude??null,radius_meters:site?.radius_meters??null,is_unrestricted:site?.is_unrestricted===true,site_missing:!site};
}
export async function validateAttendanceRule(db,company,rule) {
  if(rule===null)return null;
  if(!rule||!['none','custom','campus','group'].includes(rule.mode)||typeof rule.photo_required!=='boolean'||typeof rule.allow_wfh!=='boolean')fail('Invalid attendance rule.');
  const mode=rule.mode==='campus'?'custom':rule.mode;
  const status=rule.status??'Enforced';
  if(!['Enforced','Paused'].includes(status))fail('Invalid policy status.');
  const common={mode,status,photo_required:rule.photo_required,allow_wfh:rule.allow_wfh,notes:String(rule.notes||'').slice(0,500),updated_at:new Date().toISOString()};
  if(mode==='group') {
    if(!(await geofenceSites(db,company)).some(s=>s.group_id===rule.group_id))fail('Choose an existing company campus.');
    return {...common,group_id:rule.group_id};
  }
  if(mode==='none')return common;
  if(!String(rule.name||'').trim()||!Number.isFinite(rule.latitude)||Math.abs(rule.latitude)>90||!Number.isFinite(rule.longitude)||Math.abs(rule.longitude)>180||!Number.isFinite(rule.radius_meters)||rule.radius_meters<10||rule.radius_meters>10000)fail('Enter a location, valid coordinates and radius of 10–10,000 metres.');
  return {...common,name:String(rule.name).trim().slice(0,200),latitude:rule.latitude,longitude:rule.longitude,radius_meters:rule.radius_meters};
}
export async function geofenceSiteHandle({db,actor,method,body={}}) {
  if(actor.role!=='company_admin')fail('Geofence management access required.',403);
  if(method==='GET')return geofenceSites(db,actor.company_id);
  if(method!=='POST')fail('Method not allowed.',405);
  const {revision,group_id,...site}=body;
  if(typeof group_id!=='string'||!group_id||group_id.length>100||!Number.isInteger(revision)||revision<0)fail('Site ID and revision are required.');
  if(typeof site.name!=='string'||!site.name.trim()||site.name.length>200||typeof site.photo_required!=='boolean')fail('Enter a campus name and photo preference.');
  if(!Number.isFinite(site.latitude)||Math.abs(site.latitude)>90||!Number.isFinite(site.longitude)||Math.abs(site.longitude)>180||!Number.isFinite(site.radius_meters)||site.radius_meters< (site.is_unrestricted?0:10)||site.radius_meters>10000)fail('Enter valid coordinates and radius (10–10,000 metres).');
  const value={name:site.name.trim(),type:String(site.type||'').slice(0,100),address:String(site.address||'').slice(0,500),latitude:site.latitude,longitude:site.longitude,radius_meters:site.radius_meters,photo_required:site.photo_required,is_unrestricted:site.is_unrestricted===true};
  const result=revision===0?await stmt(db,'INSERT INTO geofence_sites(company_id,group_id,payload,revision) VALUES(?,?,?,1) ON CONFLICT DO NOTHING RETURNING revision',[actor.company_id,group_id,JSON.stringify(value)]).first():await stmt(db,'UPDATE geofence_sites SET payload=?,revision=revision+1 WHERE company_id=? AND group_id=? AND revision=? RETURNING revision',[JSON.stringify(value),actor.company_id,group_id,revision]).first();
  if(!result)fail('Campus changed. Reload before saving.',409);
  return {...value,group_id,revision:result.revision};
}
