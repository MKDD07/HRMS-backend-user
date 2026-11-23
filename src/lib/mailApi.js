import { COMPANY_API } from './companyAuth';
const root = import.meta.env.VITE_MAIL_API_URL || (['localhost','127.0.0.1'].includes(window.location.hostname)?'/api/mail':COMPANY_API+'/mail');
async function call(path, {body, signal, id, download=false}={}) {
  const response=await fetch(root+path,{method:body?'POST':'GET',signal,headers:{Authorization:`Bearer ${localStorage.getItem('pulse_hrms_token')}`,...(body?{'Content-Type':'application/json'}:{}),...(id?{'Idempotency-Key':id}:{})},...(body?{body:JSON.stringify(body)}:{})});
  if(download && response.ok)return response.blob();
  const result=await response.json().catch(()=>({message:'Mail requires the Node mail service. Check the server deployment.'}));
  if(!response.ok || !result.success)throw Object.assign(new Error(result.message||'Mail request failed.'),{status:response.status});
  if(['/action','/send','/draft'].includes(path))window.dispatchEvent(new Event('mail:updated'));
  return result.data;
}
const query=value=>new URLSearchParams(Object.entries(value).filter(([,v])=>v!==undefined)).toString();
export const mailApi={
  account:()=>call('/account'), saveAccount:body=>call('/account',{body}),
  directory:()=>call('/directory'), folders:()=>call('/folders'), list:(params,signal)=>call('/messages?'+query(params),{signal}),
  read:(params,signal)=>call('/message?'+query(params),{signal}),
  action:body=>call('/action',{body}), draft:(body,id)=>call('/draft',{body,id}),
  send:(body,id)=>call('/send',{body,id}),
  attachment:(params,signal)=>call('/attachment?'+query(params),{download:true,signal})
};
