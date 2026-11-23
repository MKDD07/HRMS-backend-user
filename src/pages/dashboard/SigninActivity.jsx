import React, { useEffect, useState } from 'react';
import { LogIn, LogOut } from 'lucide-react';
import { TenantPanel } from '../../components/ui/TenantPanel';
import { Button } from '../../components/ui/Button';
import { companyRequest } from '../../lib/companyAuth';

export function SigninActivity({ currentUser }) {
  const [feed, setFeed] = useState({ items: [], loading: true, error: '' });
  const [recent, setRecent] = useState(null);
  const [version, setVersion] = useState(0);
  const permitted = currentUser?.role === 'company_admin';
  useEffect(() => {
    if (!permitted) return;
    let alive = true, timer, highlightTimer, seen = null;
    const controller = new AbortController();
    async function load() {
      if (document.hidden) { if (alive) timer = setTimeout(load, 60000); return; }
      try {
        const value = await companyRequest('/signin-activity', { token: localStorage.getItem('pulse_hrms_token'), signal: controller.signal });
        if (!alive) return;
        const newest = seen && value.items.find(item => !seen.has(item.id));
        seen = new Set(value.items.map(item => item.id));
        setFeed({ ...value, loading: false, error: '' });
        if (newest) {
          setRecent(newest);
          clearTimeout(highlightTimer);
          highlightTimer = setTimeout(() => setRecent(null), 8000);
        }
      } catch (error) {
        if (alive && error.name !== 'AbortError') setFeed(old => ({ ...old, loading: false, error: 'Sign-in activity is unavailable. Retry to reconnect.' }));
      } finally { if (alive) timer = setTimeout(load, 60000); }
    }
    load();
    return () => { alive = false; controller.abort(); clearTimeout(timer); clearTimeout(highlightTimer); };
  }, [permitted, currentUser?.company_id, currentUser?.user_id, version]);
  if (!permitted) return null;
  return <TenantPanel title="Today's sign-in activity" subtitle="Login and logout events · India time" icon={LogIn} className="card--blue signin-activity">
    {feed.error && <p className="signin-activity__notice" role="alert">{feed.error}</p>}
    {recent && <p className="signin-activity__notice" role="status">{recent.name} {recent.event === 'login' ? 'signed in' : 'signed out'} just now.</p>}
    <div className="signin-activity__scroll" tabIndex={0} role="region" aria-label="Today's login and logout events">
      {!feed.items.length && <p className="tenant-empty">{feed.loading ? 'Loading sign-in activity?' : feed.error ? 'No activity available.' : 'No sign-ins or logouts recorded today.'}</p>}
      {feed.items.map(item => {
        const Icon = item.event === 'login' ? LogIn : LogOut;
        return <article key={item.id} className={`signin-activity__row ${item.event === 'login' ? 'is-login' : 'is-logout'}`}><span className="signin-activity__icon"><Icon size={16} aria-hidden="true" /></span><div><strong>{item.name}</strong><span>{item.event === 'login' ? 'Signed in' : 'Signed out'}</span></div><time dateTime={item.occurred_at}>{new Date(item.occurred_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })}</time></article>;
      })}
    </div>
    <p className="signin-activity__footnote">Latest 50 events today. Session expiry and closed tabs are not logouts.</p>
  </TenantPanel>;
}
