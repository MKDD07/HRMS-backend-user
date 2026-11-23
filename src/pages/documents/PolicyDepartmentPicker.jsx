import React,{useEffect,useState} from 'react';
import { companyRequest } from '../../lib/companyAuth';
export function PolicyDepartmentPicker({value,onChange,disabled}){
 const [departments,setDepartments]=useState([]),[error,setError]=useState('');
 useEffect(()=>{let live=true;companyRequest('/documents/assistant/policy-departments',{token:localStorage.getItem('pulse_hrms_token')}).then(list=>{if(live)setDepartments(list);}).catch(err=>{if(live)setError(err.message);});return()=>{live=false;};},[]);
 return <fieldset><legend>Applicable departments</legend><p>Leave all unchecked to apply this policy company-wide.</p>{error&&<p role="alert">{error}</p>}<div className="company-policy-departments"><label><input type="checkbox" checked={!value.length} disabled={disabled} onChange={()=>onChange([])}/>All departments</label>{departments.map(name=><label key={name}><input type="checkbox" checked={value.includes(name)} disabled={disabled} onChange={event=>onChange(event.target.checked?[...value,name]:value.filter(item=>item!==name))}/>{name}</label>)}</div></fieldset>;
}
