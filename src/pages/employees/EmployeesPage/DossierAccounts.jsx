import React, { useState } from 'react';
import { Pencil, Wallet } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { TenantPanelHeader } from '../../../components/ui/TenantPanel';
import { Button } from '../../../components/ui/Button';
import { PAYMENT_METHODS } from '../../../../shared/paymentDetails.mjs';

const fields = [['account_holder','Account holder'],['bank_name','Bank name'],['account_no','Account number'],['ifsc_code','IFSC'],['branch_name','Branch'],['upi_id','UPI ID']];
export function DossierAccounts({ employee, onSave }) {
  const [editing,setEditing] = useState(false), [busy,setBusy] = useState(false), [error,setError] = useState('');
  return <Card className="overview-card dossier-salary-card"><TenantPanelHeader title="Account details" subtitle="Bank details and preferred payment method." icon={Wallet} controls={!editing && <Button size="sm" variant="outline" iconOnly icon={Pencil} aria-label="Edit account details" title="Edit account details" onClick={() => setEditing(true)} />}/><div className="dossier-salary-form">{editing ? <form onSubmit={async event=>{event.preventDefault();setBusy(true);setError('');try{await onSave(Object.fromEntries(new FormData(event.currentTarget)));setEditing(false);}catch(err){setError(err.message);}finally{setBusy(false);}}}><fieldset disabled={busy} style={{border:0,padding:0,margin:0,minWidth:0}}><div className="dossier-form-grid">{fields.map(([key,title])=><label key={key}>{title}<input name={key} defaultValue={employee[key]||''} maxLength={200}/></label>)}<label>Preferred payment method<select name="preferred_payment_method" defaultValue={employee.preferred_payment_method||''}><option value="">Not specified</option>{PAYMENT_METHODS.map(method=><option key={method}>{method}</option>)}</select></label></div>{error&&<p role="alert" className="people-error">{error}</p>}<div className="dossier-salary-footer"><Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing(false)}>Cancel</Button><Button type="submit" size="sm" loading={busy}>Save account details</Button></div></fieldset></form> : <dl className="dossier-fields">{[...fields,['preferred_payment_method','Preferred payment method']].map(([key,title])=><div key={key}><dt>{title}</dt><dd>{employee[key]||'Not provided'}</dd></div>)}</dl>}</div></Card>;
}
