export const COMPANY_POLICY_FIELDS = [
 ['legal_name','Legal company name',200,true],['industry','Industry / business sector',200,true],['country','Country',100,true],['jurisdictions','Operating states / countries',500,true],['registered_address','Registered / head-office address',1000,true],['employee_count','Number of employees',20,true],['business_activity','Products, services and business activities',2000,true],['work_model','Office, remote, hybrid and work locations',1000,true],['worker_types','Employee / contractor types',1000,true],['departments','Departments and functions',1000,false],['operating_hours','Working days, hours and shift practices',1000,false],['payroll_practices','Pay cycle, benefits and compensation practices',2000,false],['leave_practices','Leave and attendance practices',2000,false],['data_handling','Personal data, customer data and security needs',2000,false],['workplace_risks','Workplace, safety and operational risks',2000,false],['company_values','Values, culture and conduct expectations',1500,false],['policy_owner','HR / policy owner and contact',500,true],['website','Company website',300,false],['additional_requirements','Other policies, contracts or customer requirements',2500,false]
];
export const POLICY_SECTIONS = ['Purpose, scope and applicability','Responsibilities and detailed policy rules','Step-by-step procedures, exceptions and escalation','Records, implementation, review and acknowledgement'];
export function validateCompanyPolicyProfile(input) {
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Enter company details.');
 const profile={};for(const [key,label,max,required] of COMPANY_POLICY_FIELDS){const value=input[key]??'';if(typeof value!=='string'||value.length>max||required&&!value.trim())throw Error(`Enter ${label.toLowerCase()} (up to ${max} characters).`);profile[key]=value.trim();}
 if(!/^\d+$/.test(profile.employee_count)||Number(profile.employee_count)<1||Number(profile.employee_count)>1000000)throw Error('Enter a valid employee count.');
 return profile;
}
export function parsePolicyPlan(text) {
 const rows=text.split('\n').map(line=>line.replace(/^[-*\d.)\s]+/,'').split('|').map(value=>value.trim())).filter(parts=>parts.length===3&&parts.every(Boolean));
 if(!rows.length||rows.length>10)throw Error('Aster returned an incomplete policy plan. Try again.');
 const seen=new Set();return rows.map(([title,category,purpose],index)=>{if(title.length>200||category.length>100||purpose.length>500||seen.has(title.toLowerCase()))throw Error('Aster returned an invalid policy plan. Try again.');seen.add(title.toLowerCase());return {id:String(index+1),title,category,purpose,sections:[],status:'planned',savedId:null};});
}
