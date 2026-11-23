import React, { useState } from 'react';
import { TenantPanel } from '../../../components/ui/TenantPanel';
import { Button } from '../../../components/ui/Button';
import { buildBankSalaryLetter } from '../../../../shared/bankSalaryLetter.mjs';

export function BankSalaryLetter({users,periodRecords,accounts,month,year,configuration}) {
  const [open,setOpen]=useState(false),[error,setError]=useState('');
  const [details,setDetails]=useState({company:configuration?.templates?.[0]?.company_name||'',bank:'',branch:'',debitAccount:'',signatory:'',date:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())});
  const generate=()=>{try{const html=buildBankSalaryLetter({users,periodRecords,accounts,month,year,...details});const url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=`Bank-salary-letter-${month}-${year}.html`;link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);setError('');}catch(e){setError(e.message);}};
  return <TenantPanel title="Bank salary transfer letter" subtitle="Complete list of finalized, outstanding bank payments for this period. Search and page filters do not limit the list." controls={<Button variant="outline" onClick={()=>setOpen(v=>!v)}>{open?'Close':'Generate letter to bank'}</Button>}>{open&&<div className="payroll-panel-body india-structure"><div className="payroll-fields">{[['company','Company name'],['bank','Company bank'],['branch','Branch / address'],['debitAccount','Company debit account'],['signatory','Authorized signatory'],['date','Letter date']].map(([key,label])=><label key={key}>{label}<input type={key==='date'?'date':'text'} value={details[key]} onChange={e=>setDetails(v=>({...v,[key]:e.target.value}))}/></label>)}</div>{error&&<p className="payroll-error" role="alert">{error}</p>}<p className="payroll-muted">The downloaded letter contains full bank account numbers. Open it to review, print or save as PDF, then sign it for your bank. No payment is sent.</p><Button variant="colored" onClick={generate}>Download complete bank letter</Button></div>}</TenantPanel>;
}
