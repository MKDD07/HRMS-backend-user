import { canUseDashboard } from '../../../shared/dashboardAccess.mjs';
import React, { useEffect, useState } from 'react';
import { ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { companyAuth, companyRequest, COMPANY_API } from '../../lib/companyAuth';
import './LoginPage.scss';
import { LoginArt } from './LoginArt';
import { LoginHeadline } from './LoginHeadline';

export function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [pending, setPending] = useState(null);
  const [visible, setVisible] = useState(false);
  const [newVisible, setNewVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [brand, setBrand] = useState(null);
  const company = new URLSearchParams(window.location.search).get('company');
  const brandCompany = pending?.company_id || company;
  useEffect(() => {
    let active = true;
    setBrand(null);
    if (brandCompany) companyRequest('/branding/' + encodeURIComponent(brandCompany))
      .then(value => { if (active) setBrand(value); })
      .catch(() => { if (active) setBrand(null); });
    return () => { active = false; };
  }, [brandCompany]);
  async function submit(event) {
    event.preventDefault(); setError(''); setNotice(''); setBusy(true);
    try {
      if (pending) {
        if (nextPassword !== confirmation) throw new Error('The new passwords do not match.');
        await companyAuth.changePassword(pending.token, password, nextPassword);
        setPending(null); setPassword(''); setNextPassword(''); setConfirmation('');
        setNotice('Password updated. Sign in with your new password.');
        return;
      }
      const user = await companyAuth.login(username.trim(), password);
      if (!canUseDashboard(user)) { await companyAuth.logout(user.token); throw new Error('Dashboard access has not been granted to this account.'); }
      if (company && user.company_id !== company) { await companyAuth.logout(user.token); throw new Error('This account belongs to a different company.'); }
      if (user.must_change_password) { setPending(user); return; }
      companyAuth.save(user); await onLoginSuccess({ ...user, first_name: user.first_name || user.name || user.username });
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function back() { if (pending) await companyAuth.logout(pending.token).catch(() => {}); setPending(null); setPassword(''); setError(''); }
  return <div className="company-login">
    <header className="login-header"><a className="login-brand" href="/"><img src={COMPANY_API + '/branding/default/logo'} alt="NextHR" /></a><span className="login-header-note"><ShieldCheck size={16} /> Administrator access</span></header>
    <main className="login-layout"><section className="login-story"><span className="login-eyebrow">A BETTER EVERYDAY AT WORK</span><LoginHeadline welcome={brand?.welcome_text} /><p>One place to take care of your team, make room for great work, and keep every workday moving.</p><LoginArt /><span className="login-story-caption">PEOPLE FIRST. EVERY DAY.</span></section>
    <section className="login-form-panel"><div className="login-form-wrap">{brand?.has_logo && brand.company_id === brandCompany && <div className="login-client-brand"><img src={COMPANY_API + '/branding/' + encodeURIComponent(brandCompany) + '/logo'} alt={brand.name} /></div>}<span className="login-step">{pending ? 'ACCOUNT SETUP' : 'WELCOME BACK'}</span><h2>{pending ? 'Make it yours.' : 'Good to see you.'}</h2><p className="login-intro">{pending ? 'Set a personal password before entering your company workspace.' : 'Sign in to your company workspace with the credentials provided to you.'}</p>
    {error && <div className="login-message login-error" role="alert">{error}</div>}{notice && <div className="login-message login-success" role="status">{notice}</div>}
    <form onSubmit={submit}><fieldset disabled={busy}>
    {!pending ? <><label htmlFor="company-username">Username or email</label><input id="company-username" autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. asternova.admin" required /><label htmlFor="company-password">Password</label><div className="login-password"><input id="company-password" type={visible ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /><button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Hide password' : 'Show password'}>{visible ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></> : <><label htmlFor="new-password">New password</label><div className="login-password"><input id="new-password" type={newVisible ? 'text' : 'password'} autoComplete="new-password" minLength={6} maxLength={128} value={nextPassword} onChange={e => setNextPassword(e.target.value)} required /><button type="button" onClick={() => setNewVisible(value => !value)} aria-label={newVisible ? 'Hide new password' : 'Show new password'} aria-pressed={newVisible}>{newVisible ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div><small className="login-hint">Use 6-128 characters. Choose a password you have not used here.</small><label htmlFor="confirm-password">Confirm new password</label><div className="login-password"><input id="confirm-password" type={confirmVisible ? 'text' : 'password'} autoComplete="new-password" minLength={6} maxLength={128} value={confirmation} onChange={e => setConfirmation(e.target.value)} required /><button type="button" onClick={() => setConfirmVisible(value => !value)} aria-label={confirmVisible ? 'Hide confirmed password' : 'Show confirmed password'} aria-pressed={confirmVisible}>{confirmVisible ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></>}
    <button className="login-submit" type="submit">{busy ? 'Please wait...' : pending ? 'Save new password' : 'Sign in to workspace'}<ArrowRight size={18}/></button></fieldset></form>
    {pending ? <button className="login-back" onClick={back} disabled={busy}>Back to sign in</button> : <p className="login-help">Need access? Contact your company administrator.</p>}
    <div className="login-security"><ShieldCheck size={18}/><span>Your workspace. Accessible only to your company.</span></div></div></section></main><footer className="login-footer"><span>Designed for people. Made for work.</span><span>Company workspace / Secure sign in</span></footer></div>;
}
