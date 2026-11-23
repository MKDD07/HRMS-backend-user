import { companyRequest } from './companyAuth';
const call=(path,options={})=>companyRequest(path,{token:localStorage.getItem('pulse_hrms_token'),...options});
export const geofenceApi={
  sites:()=>call('/geofence-sites'),
  saveSite:site=>call('/geofence-sites',{method:'POST',body:JSON.stringify(site)}),
  people:()=>call('/geofence-rules'),
  employee:userid=>call('/geofence-rules?userid='+encodeURIComponent(userid)),
  saveEmployee:(userid,values)=>call('/geofence-rules?userid='+encodeURIComponent(userid),{method:'POST',body:JSON.stringify(values)})
};
