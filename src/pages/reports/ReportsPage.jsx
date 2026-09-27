import React, { useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { TALENT_COLLECTIONS } from '../../../shared/talentModel.mjs';
import { talentApi, downloadTalentCsv } from '../../lib/talentApi';
import '../talent/TalentWorkspace.scss';

export function ReportsPage({ currentUser }) {
  const [collection, setCollection] = useState('jobs');
  const [data, setData] = useState({}), [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [refresh, setRefresh] = useState(0);
  const [from, setFrom] = useState(''), [to, setTo] = useState('');
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    Promise.all([...Object.keys(TALENT_COLLECTIONS).map(key => talentApi.list(key)), talentApi.people()]).then(values => {
      if (!active) return;
      setData(Object.fromEntries(Object.keys(TALENT_COLLECTIONS).map((key, index) => [key, values[index]]))); setPeople(values.at(-1));
    }).catch(error => { if (active) setError(error.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh]);
  const invalidRange = from && to && from > to;
  const records = useMemo(() => (data[collection] || []).filter(record => !invalidRange && (!from || record.created_at.slice(0, 10) >= from) && (!to || record.created_at.slice(0, 10) <= to)), [data, collection, from, to, invalidRange]);
  const sourceConfig = TALENT_COLLECTIONS[collection];
  const config = { ...sourceConfig, fields: sourceConfig.fields.filter(field => !field.adminOnly || currentUser?.role === 'company_admin') };
  const statusCounts = config.fields.find(field => field.key === 'status').options.map(status => [status, records.filter(record => record.status === status).length]);
  const displayValue = (record, field) => {
    if (field.type === 'employee') { const person = people.find(person => (person.userid || person.user_id) === record[field.key]); return person ? [person.first_name, person.last_name].filter(Boolean).join(' ') || person.name || person.username : record[field.key] || ''; }
    if (field.type === 'reference') return data[field.collection]?.find(item => item.id === record[field.key])?.title || '';
    return record[field.key] ?? '';
  };
  const exportCsv = () => downloadTalentCsv(`${collection}-report.csv`, [...config.fields.map(field => field.label), 'Created at', 'Updated at'], records.map(record => [...config.fields.map(field => displayValue(record, field)), record.created_at, record.updated_at]));
  return <div className="talent-workspace">
    <header className="talent-page-heading"><div><span className="talent-eyebrow">COMPANY INSIGHTS</span><h1>Reports</h1><p>Review and export recorded recruitment, lifecycle, goals, assets, and learning data.</p></div><div className="talent-actions"><Button variant="outline" iconOnly icon={RefreshCw} aria-label="Refresh reports" loading={loading} onClick={() => setRefresh(value => value + 1)} /><Button icon={Download} disabled={loading || !!error || !!invalidRange || !records.length} onClick={exportCsv}>Download CSV</Button></div></header>
    {error && <div role="alert" className="talent-alert">{error}<Button variant="outline" size="sm" onClick={() => setRefresh(value => value + 1)}>Retry</Button></div>}
    <section className="talent-panel"><div className="talent-editor-body"><div className="talent-form-grid"><label><span>Report</span><select value={collection} onChange={event => setCollection(event.target.value)}>{Object.entries(TALENT_COLLECTIONS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label><div /><label><span>Created from</span><input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label><label><span>Created through</span><input type="date" min={from || undefined} value={to} onChange={event => setTo(event.target.value)} /></label></div>{invalidRange && <p role="alert" className="talent-alert">The end date must be on or after the start date.</p>}</div></section>
    {loading ? <section className="talent-panel talent-empty" role="status">Loading report data</section> : !error && <>
      <section className="talent-stats" aria-label="Report summary">{statusCounts.map(([status, count]) => <div key={status}><span>{status}</span><strong>{count}</strong><small>{records.length ? Math.round(count / records.length * 100) : 0}% of {records.length} records</small></div>)}</section>
      <section className="talent-panel"><div className="talent-toolbar"><h2>{config.label}</h2><span>{records.length} records</span></div>{records.length ? <div className="talent-table-scroll"><table><thead><tr>{config.fields.filter(field => field.type !== 'textarea').map(field => <th key={field.key}>{field.label}</th>)}</tr></thead><tbody>{records.map(record => <tr key={record.id}>{config.fields.filter(field => field.type !== 'textarea').map(field => <td key={field.key}>{displayValue(record, field) || ''}</td>)}</tr>)}</tbody></table></div> : <div className="talent-empty"><h3>No records for this report</h3><p>Choose another period or add records in the corresponding module.</p></div>}</section>
    </>}
  </div>;
}
