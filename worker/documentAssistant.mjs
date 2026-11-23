import { companyPolicyHandle } from './companyPolicyAssistant.mjs';
import { missingLetterDetails } from '../shared/letterFormatting.mjs';
import { canUsePage } from '../shared/dashboardAccess.mjs';
import { safeImage } from '../shared/lifecycleDocuments.mjs';
import { documentCompleteness } from '../shared/documentCompleteness.mjs';
import { asterTask } from './groq.mjs';
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const stmt = (db, sql, args = []) => db.prepare(sql).bind(...args);
const all = async (db, sql, args = []) => (await stmt(db,sql,args).all()).results;
const parse = value => { try { return JSON.parse(value || '{}'); } catch { return {}; } };
const day = () => new Date(Date.now()+19800000).toISOString().slice(0,10);
const authorized = actor => { if (!canUsePage(actor,'documents')) fail('Document Vault access required.',403); };
export async function documentAssistantSettings(db, company) {
  const settings = await stmt(db,"SELECT payload FROM talent_records WHERE company_id=? AND collection='document_settings'",[company]).first();
  if (settings) return parse(settings.payload);
  const old = await stmt(db,"SELECT payload FROM talent_records WHERE company_id=? AND collection='letter_settings' ORDER BY updated_at DESC LIMIT 1",[company]).first();
  return { requiredCategories: [], branding: parse(parse(old?.payload).content).branding || {} };
}
export async function documentPeople(db, company) {
  return all(db,"SELECT e.employee_id,e.user_id AS userid,e.employee_code,e.first_name,e.last_name,e.department,e.designation,e.status,u.email,e.profile FROM employees e JOIN users u ON u.company_id=e.company_id AND u.user_id=e.user_id WHERE e.company_id=? AND u.status='active' ORDER BY e.first_name,e.last_name",[company]);
}
const publicPerson = person => {
  const profile = parse(person.profile), employment = profile.profile || {};
  return { userid:person.userid,employee_id:person.employee_id,employee_code:person.employee_code,name:[person.first_name,person.last_name].filter(Boolean).join(' '),department:person.department,designation:person.designation,status:person.status,email:person.email,phone:profile.phone_number || profile.phone || '',joining_date:employment.joining_date || profile.joining_date || profile.date_of_joining || '',employment_type:employment.employee_type || profile.employment_type || '',work_location:profile.work_location || '' };
};
async function employeeCheck(db, company, person, settings) {
  const records = await all(db,"SELECT title,metadata,document_id FROM documents WHERE company_id=? AND employee_id=? AND json_extract(metadata,'$.deleted_at') IS NULL",[company,person.employee_id]);
  const documents = records.map(doc => ({ title:doc.title,id:doc.document_id,...parse(doc.metadata) }));
  return { person:publicPerson(person),documents:documents.map(({title,category,verified,expiry_date})=>({title,category,verified,expiry_date})),...documentCompleteness(documents.filter(doc=>doc.delivery!=='company'),settings.requiredCategories || [],day()) };
}
export async function refreshDocumentAlerts(db, company, people) {
  const settings = await documentAssistantSettings(db,company);
  const targets = people || await documentPeople(db,company);
  for (const person of targets) {
    const result = await employeeCheck(db,company,person,settings);
    const issues = [...result.missing.map(x=>`Missing: ${x}`),...result.expired.map(x=>`Expired: ${x}`),...result.unverified.map(x=>`Needs verification: ${x}`)];
    const id = `${company}:document-alert:${person.employee_id}`;
    const previous = await stmt(db,"SELECT payload FROM talent_records WHERE company_id=? AND id=? AND collection='document_alerts'",[company,id]).first();
    const old = parse(previous?.payload), fingerprint = JSON.stringify(issues);
    if (!issues.length && !previous) continue;
    const payload = { userid:person.userid,name:result.person.name,issues,fingerprint,readBy:old.fingerprint === fingerprint ? old.readBy || [] : [],status:issues.length?'Open':'Resolved',checkedAt:new Date().toISOString() };
    await stmt(db,"INSERT INTO talent_records(id,company_id,collection,payload,created_at,updated_at) VALUES(?,?,'document_alerts',?,datetime('now'),datetime('now')) ON CONFLICT(company_id,collection,id) DO UPDATE SET payload=excluded.payload,updated_at=datetime('now'),revision=talent_records.revision+1",[id,company,JSON.stringify(payload)]).run();
  }
}
export async function processDocumentAlerts(db) {
  const companies = await all(db,"SELECT DISTINCT t.company_id FROM talent_records t JOIN companies c ON c.company_id=t.company_id WHERE t.collection='document_settings' AND c.status='active'");
  for (const company of companies) { try { await refreshDocumentAlerts(db,company.company_id); } catch { console.warn(JSON.stringify({event:'document-alert-refresh-failed',company:company.company_id})); } }
}
export async function documentAssistantHandle({db,env,actor,path,method,body}) {
  authorized(actor);
  const section = path.slice('/api/v1/documents/assistant/'.length);
  if(['policy-run','policy-pause','policy-departments','company-profile','policy-job','policy-plan','policy-section','policy-saved'].includes(section)) return companyPolicyHandle({db,env,actor,section,method,body});
  if (section === 'directory' && method === 'GET') return (await documentPeople(db,actor.company_id)).map(publicPerson);
  if (section === 'settings' && method === 'GET') return documentAssistantSettings(db,actor.company_id);
  if (section === 'settings' && method === 'POST') {
    if (!Array.isArray(body.requiredCategories) || body.requiredCategories.length > 30 || body.requiredCategories.some(x=>typeof x !== 'string' || !x.trim() || x.length>100)) fail('Enter up to 30 required document categories.');
    const branding = {};
    for (const key of ['company_name','company_address','signatory','signatory_role']) { if (typeof body.branding?.[key] !== 'string' || body.branding[key].length>1000) fail('Invalid letterhead text.'); branding[key]=body.branding[key].trim(); }
    for (const key of ['logo','signature']) {
      const image = body.branding?.[key]; if (!image) continue;
      if (!safeImage(image.src) || !Number.isFinite(image.width) || image.width<20 || image.width>140 || !Number.isFinite(image.height) || image.height<1 || image.height>280) fail('Use an uploaded PNG or JPEG signature/logo.');
      branding[key]={src:image.src,width:image.width,height:image.height};
    }
    const value = { requiredCategories:[...new Set(body.requiredCategories.map(x=>x.trim()))],branding };
    await stmt(db,"INSERT INTO talent_records(id,company_id,collection,payload,created_at,updated_at) VALUES(?,?,'document_settings',?,datetime('now'),datetime('now')) ON CONFLICT(company_id,collection,id) DO UPDATE SET payload=excluded.payload,updated_at=datetime('now'),revision=talent_records.revision+1",[`${actor.company_id}:document-settings`,actor.company_id,JSON.stringify(value)]).run();
    await refreshDocumentAlerts(db,actor.company_id); return value;
  }
  if (section === 'alerts' && method === 'GET') {
    const records = await all(db,"SELECT id,payload,updated_at FROM talent_records WHERE company_id=? AND collection='document_alerts' AND json_extract(payload,'$.status')='Open' ORDER BY updated_at DESC LIMIT 100",[actor.company_id]);
    return records.map(row=>{const item=parse(row.payload);return {id:`doc-alert:${row.id}`,title:`Document review: ${item.name}`,message:item.issues.join('; '),category:'Personnel',unread:!item.readBy?.includes(actor.user_id),timestamp:row.updated_at,location:{page:'documents',userid:item.userid},systemTag:'Document Vault'};});
  }
  if (section === 'alerts/read' && method === 'POST') {
    const records = await all(db,"SELECT id,payload FROM talent_records WHERE company_id=? AND collection='document_alerts'"+(body.id?" AND id=?":""),[actor.company_id,...(body.id?[String(body.id).replace(/^doc-alert:/,'')]:[])]);
    for(const row of records){const item=parse(row.payload);item.readBy=[...new Set([...(item.readBy||[]),actor.user_id])];await stmt(db,'UPDATE talent_records SET payload=? WHERE company_id=? AND id=?',[JSON.stringify(item),actor.company_id,row.id]).run();} return {saved:true};
  }
  if (section === 'help' && method === 'POST') {
    if(typeof body.prompt!=='string' || !body.prompt.trim() || body.prompt.length>3000) fail('Enter your document request (up to 3000 characters).');
    const settings = await documentAssistantSettings(db,actor.company_id), people = await documentPeople(db,actor.company_id);
    let matches;
    if(body.userid) matches=people.filter(person=>person.userid===body.userid);
    else {
      const prompt = body.prompt.toLowerCase();
      matches=people.filter(person=>[publicPerson(person).name,person.employee_code].filter(Boolean).some(name=>prompt.includes(name.toLowerCase())));
      if(!matches.length) matches=people.filter(person=>person.first_name && new RegExp(`\\b${person.first_name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i').test(body.prompt));
    }
    const checking = body.action === 'check' || /missing|expired|unverified|document status|check.*document|documents.*check/i.test(body.prompt);
    if(checking && matches.length!==1) return {kind:'message',text:matches.length>1?'More than one employee matches. Select the employee above so I can check the correct vault.':'Select an employee above to check their documents.',location:{page:'documents'}};
    if(matches.length>1) return {kind:'message',text:'More than one employee matches. Select the correct employee before drafting.',location:{page:'documents'}};
    if(body.action==='personalize' && (!body.userid || matches.length!==1)) fail('Select a valid employee from this company.',404);
    const selected = matches[0];
    const result = selected ? await employeeCheck(db,actor.company_id,selected,settings) : null;
    if(checking) {
      await refreshDocumentAlerts(db,actor.company_id,[selected]);
      const lines = [`Document check for ${result.person.name} (${day()} IST)`,settings.requiredCategories.length?`Missing required documents: ${result.missing.join(', ') || 'None'}`:'No company checklist configured; missing requirements cannot be determined. Add required categories in Document assistant settings.',`Expired: ${result.expired.join(', ') || 'None'}`,`Needs verification: ${result.unverified.join(', ') || 'None'}`];
      return {kind:'message',text:lines.join('\n'),location:{page:'documents',userid:selected.userid},alertsUpdated:true};
    }
    const company = await stmt(db,'SELECT name FROM companies WHERE company_id=?',[actor.company_id]).first();
    const context = JSON.stringify({ employee:result?.person || null,document_inventory:result?.documents || [],company:settings.branding.company_name || company?.name,company_address:settings.branding.company_address,signatory:settings.branding.signatory,signatory_role:settings.branding.signatory_role,letter_date:day(),previousLetter:typeof body.previousText==='string'?body.previousText.slice(0,10000):'',instructions:(body.action==='personalize' ? 'Personalize the company template exclusively for the supplied employee. Replace all prior recipient identity and employment facts with supplied employee facts; never carry another employee?s dates, terms or compensation into this letter. Unknown personal facts require named placeholders. ' : '')+'Use only supplied facts. Include the letter date, employee name and approved signatory details when available. Do not infer document contents from inventory. Signature artwork is attached by the application, not generated. For any necessary unknown fact use a specific named placeholder such as [Start date required] or [Employment type required], never a generic Details required. Letter issue date defaults to today; effective/start/end dates must come from employee facts or the request. Follow-up answers update previousLetter. Do not add an extra signature placeholder when a signatory is configured.' }).slice(0,15000);
    const draft = await asterTask({env,actor,page:'documents',body:{action:'draft',prompt:body.prompt,context}});
    const missing = missingLetterDetails(draft.text);
    if (missing.length && body.skipMissing !== true) return {kind:'message',text:'Before I save this letter, please provide: '+missing.join(', ')+'. You can answer here, or choose Skip to leave underlined spaces for manual completion.',pending:draft,userid:selected?.userid || null};
    return {...draft,kind:'letter',branding:settings.branding,userid:selected?.userid || null,location:{page:'documents',...(selected?{userid:selected.userid}:{policyView:'ai'})}};
  }
  fail('Document assistant route not found.',404);
}
