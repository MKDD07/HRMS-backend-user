import { companyRequest } from './companyAuth';
const call=(path,options={})=>companyRequest('/appraisals/'+path,{token:localStorage.getItem('pulse_hrms_token'),...options});
export const appraisalApi={
  get:path=>call(path),
  post:(path,body)=>call(path,{method:'POST',body:JSON.stringify(body)}),
  notifications:()=>call('notifications'),
  read:id=>call('notifications/read',{method:'POST',body:JSON.stringify({id})})
};
