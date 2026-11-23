import React, { useEffect, useState } from 'react';
import { Briefcase, CheckCircle2, CalendarDays } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { companyRequest } from '../../lib/companyAuth';
import './CandidateOfferPage.scss';

export default function CandidateOfferPage() {
  const [link] = useState(() => window.location.hash.slice(1).split('.'));
  const [offer,setOffer] = useState(null), [loading,setLoading] = useState(true), [busy,setBusy] = useState(false), [error,setError] = useState('');
  const [name,setName] = useState(''), [confirmed,setConfirmed] = useState(false), [declining,setDeclining] = useState(false), [reason,setReason] = useState('');
  const [id,token] = link;
  const request = options => companyRequest(`/public/recruitment/offers/${encodeURIComponent(id || '')}`,{...options,headers:{'X-Offer-Token':token || ''}});
  useEffect(() => {
    let active = true;
    request().then(value => {if(active) setOffer(value);}).catch(error => {if(active) setError(error.message);}).finally(() => {if(active) setLoading(false);});
    return () => {active=false;};
  },[id,token]);
  async function respond(event) {
    event.preventDefault(); if(busy) return;
    setBusy(true);setError('');
    try {setOffer(await request({method:'POST',body:JSON.stringify({decision:declining?'decline':'accept',typed_name:name,confirmed,reason})}));}
    catch(error) {setError(error.message);}
    finally {setBusy(false);}
  }
  return <main className="candidate-offer-page"><article>
    <header><span className="candidate-offer-icon"><Briefcase size={22}/></span><span className="candidate-offer-eyebrow">{offer?.company_name || 'YOUR OFFER'}</span><h1>Your next chapter</h1><p>{offer ? `Hello ${offer.candidate_name}, review your offer details below.` : 'A personal space to review and respond to your offer.'}</p></header>
    {loading && <p role="status">Loading your offer…</p>}{error && <div className="candidate-offer-alert" role="alert">{error}</div>}
    {offer && <><div className="candidate-offer-position"><span>THE OPPORTUNITY</span><h2>{offer.designation}</h2><p>{offer.department}</p></div><div className="candidate-offer-facts"><div><span>Annual CTC</span><strong>INR {Number(offer.annual_ctc).toLocaleString('en-IN')}</strong></div><div><span>Joining date</span><strong>{offer.joining_date}</strong></div><div><span><CalendarDays size={13}/> Respond by (IST)</span><strong>{offer.valid_until}</strong></div></div><section className="candidate-offer-terms"><h2>Offer terms</h2><p>{offer.offer_text}</p></section>
      {offer.status === 'Sent' ? <form onSubmit={respond}><h2>{declining ? 'Decline this offer' : 'Ready to join?'}</h2>{declining ? <label><span>Let HR know your reason</span><textarea required maxLength={1000} rows={3} value={reason} disabled={busy} onChange={event => setReason(event.target.value)}/></label> : <><label><span>Your full name</span><input required maxLength={120} autoComplete="name" value={name} disabled={busy} onChange={event => setName(event.target.value)}/></label><label className="candidate-offer-confirm"><input type="checkbox" required checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)}/><span>I have read and accept the offer terms above.</span></label></>}<div className="candidate-offer-buttons"><Button type="submit" loading={busy}>{declining ? 'Confirm decline' : 'Accept offer'}</Button><Button variant="fadeout" disabled={busy} onClick={() => setDeclining(!declining)}>{declining ? 'Back to acceptance' : 'Decline offer'}</Button></div></form> : <div className="candidate-offer-result" role="status"><CheckCircle2 size={22}/><div><strong>{offer.status === 'Accepted' ? 'Your acceptance is recorded' : offer.status === 'Declined' ? 'Your response is recorded' : 'This offer has expired'}</strong><p>{offer.status === 'Accepted' ? 'HR will contact you with the next joining steps.' : offer.status === 'Declined' ? 'Thank you for letting the team know.' : 'Please contact your HR coordinator.'}</p></div></div>}
    </>}
    <footer>This link is private. Please keep it for your records.</footer>
  </article></main>;
}
