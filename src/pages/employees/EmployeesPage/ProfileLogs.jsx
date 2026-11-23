import React from 'react';
import { History, Pencil, BadgeCheck } from 'lucide-react';
import './ProfileLogs.scss';

const fieldLabel = value => String(value).replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, character => character.toUpperCase());
const timeValue = value => { const time = Date.parse(value); return Number.isNaN(time) ? 0 : time; };

export function ProfileLogs({ records = [] }) {
  const sorted = [...records].sort((a, b) => timeValue(b.at) - timeValue(a.at));
  return <div className="card overview-card profile-logs">
    {!sorted.length ? <div className="profile-logs__empty"><History size={24} aria-hidden="true" /><p>No profile activity recorded yet.</p><span>Saved updates and profile verification will appear here.</span></div> : <>
      <div className="profile-logs__meta"><span>{sorted.length} recorded {sorted.length === 1 ? 'event' : 'events'}</span><span>Newest first · India time</span></div>
      <div className="profile-logs__scroll" role="region" tabIndex={0} aria-label="Employee profile activity"><ol>{sorted.map((record, index) => {
        const verified = record.action === 'Finalized';
        const Icon = verified ? BadgeCheck : Pencil;
        const valid = Boolean(timeValue(record.at));
        const fields = Array.isArray(record.fields) ? record.fields : [];
        return <li key={record.id || `${record.at}-${index}`}><span className={`profile-logs__icon ${verified ? 'is-verified' : ''}`}><Icon size={16} aria-hidden="true" /></span><div className="profile-logs__copy"><div><strong>{verified ? 'Profile verified' : record.action === 'Updated' ? 'Profile updated' : record.action || 'Profile activity'}</strong><time dateTime={valid ? record.at : undefined}>{valid ? new Date(record.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : 'Time not recorded'}</time></div>{fields.length > 0 && <p>{fields.length} {fields.length === 1 ? 'field' : 'fields'} changed</p>}<details><summary>View event details</summary><dl>{record.actor && <div><dt>Changed by (user ID)</dt><dd>{record.actor}</dd></div>}{fields.length > 0 && <div><dt>Updated fields</dt><dd className="profile-logs__fields">{fields.map(field => <span key={field}>{fieldLabel(field)}</span>)}</dd></div>}</dl></details></div></li>;
      })}</ol></div>
    </>}
  </div>;
}
