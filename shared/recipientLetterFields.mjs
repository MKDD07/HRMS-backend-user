import { mergeContent } from './lifecycleDocuments.mjs';
export function recipientLetterFields(person, today = new Date(Date.now()+19800000).toISOString().slice(0,10)) {
 return {employee_name:person.name,first_name:person.name?.split(' ')[0]||'',employee_id:person.employee_code,employee_code:person.employee_code,designation:person.designation||'',department:person.department||'',joining_date:person.joining_date||'',start_date:person.joining_date||'',employment_type:person.employment_type||'',employee_email:person.email||'',employee_phone:person.phone||'',work_location:person.work_location||'',letter_date:today};
}

export function personalizeTemplate(content,person,today) { const keep=new Set(['company_name','company_address','signatory','signatory_role','letter_date']); const clear=node=>({...node,...(node.type==='field'&&!keep.has(node.attrs.key)?{attrs:{...node.attrs,value:''}}:{}),...(node.content?{content:node.content.map(clear)}:{})}); const safe={...content,...Object.fromEntries(['header','body','footer'].map(key=>[key,clear(content[key])]))}; return mergeContent(safe,recipientLetterFields(person,today)); }
