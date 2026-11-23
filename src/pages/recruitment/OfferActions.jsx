import React, { useState } from 'react';
import { Send, UserPlus, ShieldCheck } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { talentApi } from '../../lib/talentApi';

export function OfferActions({record,candidate,people,financialAdmin,busy,setBusy,onSaved}) {
  const [error,setError] = useState(''), [hiring,setHiring] = useState(false);
  const [details,setDetails] = useState({first_name:candidate?.title?.split(/\s+/)[0] || '',last_name:candidate?.title?.split(/\s+/).slice(1).join(' ') || '',owner_id:''});
  async function run(action) {
    if (busy) return;
    setBusy(true);setError('');
    try { const result = await action(); onSaved(result.offer || result); }
    catch(error) { setError(error.message); }
    finally { setBusy(false); }
  }
  return <section className="recruitment-offer-actions">
    <div className="recruitment-offer-summary"><ShieldCheck size={19}/><div><strong>{record.hired_user_id ? 'Hiring handoff complete' : record.status === 'Accepted' ? 'Candidate accepted' : 'Candidate offer'}</strong><p>{record.hired_user_id ? 'Employee record and onboarding plan created. Activate the account from the onboarding plan on the joining date.' : record.response ? `Response recorded ${new Date(record.response.at).toLocaleString('en-IN')}` : record.delivery ? `Email accepted by provider for ${record.delivery.recipient}` : 'Review the approved terms before sending the personal response link.'}</p></div></div>
    {error && <div className="talent-alert" role="alert">{error}</div>}
    {record.response?.reason && <p className="talent-hint">Candidate reason: {record.response.reason}</p>}
    {['Approved','Delivery pending'].includes(record.status) && <><p className="talent-hint">Sending emails this candidate a private link to review, accept or decline the approved terms.</p><Button disabled={busy} icon={Send} onClick={() => run(() => talentApi.sendOffer(record))}>{record.status === 'Delivery pending' ? 'Retry delivery' : 'Send approved offer'}</Button></>}
    {record.status === 'Accepted' && !record.hired_user_id && financialAdmin && <>
      {!hiring ? <Button disabled={busy} icon={UserPlus} onClick={() => setHiring(true)}>Prepare hiring handoff</Button> : <div className="recruitment-hiring-fields"><h3>Create employee & onboarding plan</h3><p className="talent-hint">This creates an inactive employee and disabled login. Set a temporary password when activating their onboarding plan.</p><div className="talent-form-grid">{[['first_name','First name'],['last_name','Last name']].map(([key,label]) => <label key={key}><span>{label}</span><input value={details[key]} disabled={busy} maxLength={200} onChange={event => setDetails(current => ({...current,[key]:event.target.value}))}/></label>)}<label className="talent-full"><span>Onboarding coordinator</span><select disabled={busy} value={details.owner_id} onChange={event => setDetails(current => ({...current,owner_id:event.target.value}))}><option value="">Choose coordinator</option>{people.filter(person => person.status !== 'Inactive').map(person => <option key={person.userid || person.user_id} value={person.userid || person.user_id}>{[person.first_name,person.last_name].filter(Boolean).join(' ') || person.username}</option>)}</select></label></div><Button disabled={busy || !details.first_name.trim() || !details.owner_id} icon={UserPlus} onClick={() => run(() => talentApi.hireOffer(record,details))}>Create employee & onboarding</Button></div>}
    </>}
  </section>;
}
export function JoinerActivation({record,financialAdmin,busy,setBusy,onSaved}) {
  const [password,setPassword] = useState(''), [error,setError] = useState('');
  if (!record.source_offer_id || record.joined_at || !financialAdmin || record.status === 'Cancelled') return null;
  async function activate() {
    setBusy(true);setError('');
    try { const result = await talentApi.activateJoiner(record,password); setPassword('');onSaved(result.record); }
    catch(error) {setError(error.message);}
    finally {setBusy(false);}
  }
  return <section className="recruitment-offer-actions"><h3>Activate new joiner</h3><p className="talent-hint">Available on or after the joining date. The employee must change this temporary password at first sign-in. Share it privately with them.</p>{error && <div className="talent-alert" role="alert">{error}</div>}<label><span>Temporary password</span><input type="password" autoComplete="new-password" minLength={12} maxLength={128} disabled={busy} value={password} onChange={event => setPassword(event.target.value)}/></label><Button icon={ShieldCheck} disabled={busy || password.length < 12} onClick={activate}>Mark joined & activate account</Button></section>;
}
