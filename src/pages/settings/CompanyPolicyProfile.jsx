import React,{useEffect,useState} from 'react';
import { Building2 } from 'lucide-react';
import { TenantPanel } from '../../components/ui/TenantPanel';
import { Button } from '../../components/ui/Button';
import { companyRequest } from '../../lib/companyAuth';
import { COMPANY_POLICY_FIELDS } from '../../../shared/companyPolicyProfile.mjs';
export function CompanyPolicyProfile(){
 const [profile,setProfile]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const call=options=>companyRequest('/documents/assistant/company-profile',{token:localStorage.getItem('pulse_hrms_token'),...options});
 useEffect(()=>{let live=true;call().then(value=>{if(live)setProfile(value);}).catch(err=>{if(live)setError(err.message);});return()=>{live=false;};},[]);
 async function save(event){event.preventDefault();setBusy(true);setError('');setNotice('');try{setProfile(await call({method:'POST',body:JSON.stringify(profile)}));setNotice('Company policy profile saved. Aster will use these details for new document plans.');}catch(err){setError(err.message);}finally{setBusy(false);}}
 return <TenantPanel title="Company policy profile" subtitle="Business details Aster uses to suggest and draft company documents." icon={Building2}><form className="ws-form ws-panel-body" onSubmit={save}><p>Describe actual company practices. Leave optional unknown facts empty; proposed policies stay in AI drafts for HR review.</p>{error&&<p className="ws-error" role="alert">{error}</p>}{notice&&<p className="ws-notice" role="status">{notice}</p>}{profile?<><div className="company-policy-profile-fields">{COMPANY_POLICY_FIELDS.map(([key,label,max,required])=><label key={key}>{label}{required?' *':''}{max>500?<textarea rows={3} maxLength={max} required={required} disabled={busy} value={profile[key]||''} onChange={e=>setProfile(old=>({...old,[key]:e.target.value}))}/>:<input type={key==='employee_count'?'number':'text'} min={key==='employee_count'?1:undefined} maxLength={max} required={required} disabled={busy} value={profile[key]||''} onChange={e=>setProfile(old=>({...old,[key]:e.target.value}))}/>}</label>)}</div><Button type="submit" loading={busy}>Save company policy profile</Button></>:!error&&<p role="status">Loading company profile...</p>}</form></TenantPanel>;
}
