import test from 'node:test';
import assert from 'node:assert/strict';
import { personalizeTemplate } from './recipientLetterFields.mjs';
import { documentFields } from './lifecycleDocuments.mjs';
const empty={type:'doc',content:[]};
test('personalized template replaces identity and clears previous recipient facts',()=>{
 const fields=['employee_name','joining_date','annual_ctc','company_name'].map(key=>({type:'field',attrs:{key,value:key==='company_name'?'Example Ltd':'Previous employee'}}));
 const content={header:empty,body:{type:'doc',content:[{type:'paragraph',content:fields}]},footer:empty};
 const result=personalizeTemplate(content,{name:'New Employee',employee_code:'E2',joining_date:'2026-11-01'},'2026-10-11');
 const values=Object.fromEntries(documentFields(result).map(field=>[field.key,field.value]));
 assert.equal(values.employee_name,'New Employee');assert.equal(values.joining_date,'2026-11-01');assert.equal(values.annual_ctc,'');assert.equal(values.company_name,'Example Ltd');
 assert.equal(documentFields(content)[0].value,'Previous employee');
});
