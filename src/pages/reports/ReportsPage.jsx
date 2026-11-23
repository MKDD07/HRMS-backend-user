import { SectionSkeleton } from '../../components/ui/SectionSkeleton';
import { CircleCheck as MiCircleCheck, Clock as MiClock, CircleX as MiCircleX, ChartNoAxesCombined as MiChartNoAxesCombined } from 'lucide-react';
import { MetricOverview, MetricCard } from '../../components/ui/MetricOverview';
import { WorkspaceFilters } from '../../components/ui/WorkspaceFilters';
import { TenantHeader } from '../../components/ui/TenantHeader';
import React, { useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { TALENT_COLLECTIONS } from '../../../shared/talentModel.mjs';
import { talentApi, downloadTalentCsv } from '../../lib/talentApi';
import '../talent/TalentWorkspace.scss';
const REPORT_COLLECTIONS = Object.fromEntries(Object.entries(TALENT_COLLECTIONS).filter(([, config]) => !config.documentContent));

export function ReportsPage({ currentUser }) {
  const [collection, setCollection] = useState('jobs');
  const [data, setData] = useState({}), [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [refresh, setRefresh] = useState(0);
  const [search, setSearch] = useState(''), [status, setStatus] = useState(''), [page, setPage] = useState(1);
  const [from, setFrom] = useState(''), [to, setTo] = useState('');
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    const keys = [...new Set([collection, ...REPORT_COLLECTIONS[collection].fields.filter(field => field.type === 'reference').map(field => field.collection)])];
    Promise.all([...keys.map(key => talentApi.list(key)), talentApi.people()]).then(values => {
      if (!active) return;
      setData(Object.fromEntries(keys.map((key, index) => [key, values[index]]))); setPeople(values.at(-1));
    }).catch(error => { if (active) setError(error.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh, collection]);
  const invalidRange = from && to && from > to;
  const datedRecords = useMemo(() => (data[collection] || []).filter(record => !invalidRange && (!from || (record.created_at || '').slice(0, 10) >= from) && (!to || (record.created_at || '').slice(0, 10) <= to)), [data, collection, from, to, invalidRange]);
  const sourceConfig = TALENT_COLLECTIONS[collection];
  const config = { ...sourceConfig, fields: sourceConfig.fields.filter(field => !field.adminOnly || currentUser?.role === 'company_admin') };
  const statuses = config.fields.find(field => field.key === 'status')?.options || [];
  useEffect(() => { setPage(1); }, [collection, search, status, from, to]);
  const displayValue = (record, field) => {
    if (field.type === 'employee') { const person = people.find(person => (person.userid || person.user_id) === record[field.key]); return person ? [person.first_name, person.last_name].filter(Boolean).join(' ') || person.name || person.username : record[field.key] || ''; }
    if (field.type === 'reference') return data[field.collection]?.find(item => item.id === record[field.key])?.title || '';
    return record[field.key] ?? '';
  };
  const records = datedRecords.filter(record => (!status || record.status === status) && config.fields.map(field => displayValue(record, field)).join(' ').toLowerCase().includes(search.trim().toLowerCase()));
  const statusCounts = statuses.map(value => [value, records.filter(record => record.status === value).length]);
  const pages = Math.max(1, Math.ceil(records.length / 25)), currentPage = Math.min(page, pages);
  const visible = records.slice((currentPage - 1) * 25, currentPage * 25);
  const clearFilters = () => { setSearch(''); setStatus(''); setFrom(''); setTo(''); setPage(1); };
  const exportCsv = () => downloadTalentCsv(`${collection}-report.csv`, [...config.fields.map(field => field.label), 'Created at', 'Updated at'], records.map(record => [...config.fields.map(field => displayValue(record, field)), record.created_at, record.updated_at]));
  return <div className="talent-workspace">
    <TenantHeader
        settings={{
          subheading: "COMPANY INSIGHTS",
          heading: "Reports",
          paragraph: "Review and export recorded recruitment, lifecycle, goals, assets, and learning data.",
          refresh: { label: "Refresh reports" },
          buttons: [
            { id: 'action1', label: "Download CSV", variant: "colored" }
          ]
        }}
        actions={{
          refresh: { "icon": RefreshCw, "loading": loading, "onClick": () => setRefresh(value => value + 1) },
          action1: { "icon": Download, "disabled": loading || !!error || !!invalidRange || !records.length, "onClick": exportCsv }
        }}
      />
    {error && <div role="alert" className="talent-alert">{error}<Button variant="outline" size="sm" onClick={() => setRefresh(value => value + 1)}>Retry</Button></div>}
    <section className="talent-panel"><div className="talent-editor-body"><div className="talent-form-grid"><label><span>Report</span><select value={collection} onChange={event => { setCollection(event.target.value); setStatus(''); setSearch(''); }}>{Object.entries(REPORT_COLLECTIONS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label><div /><label><span>Created from</span><input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label><label><span>Created through</span><input type="date" min={from || undefined} value={to} onChange={event => setTo(event.target.value)} /></label></div>{invalidRange && <p role="alert" className="talent-alert">The end date must be on or after the start date.</p>}</div></section>
    <WorkspaceFilters search={search} onSearch={setSearch} status={status} onStatus={setStatus} statuses={statuses} active={!!search || !!status || !!from || !!to} onReset={clearFilters} />
    <SectionSkeleton loading={loading}>{loading ? <section className="talent-panel talent-empty" role="status">Loading report data</section> : !error && <>
      <MetricOverview loading={loading} aria-label="Report summary">{statusCounts.map(([status, count]) => <MetricCard key={status} label={status} icon={/completed|approved|hired|accepted|active|published/i.test(status) ? MiCircleCheck : /pending|draft|review|planned|submitted/i.test(status) ? MiClock : /rejected|cancelled|withdrawn|closed/i.test(status) ? MiCircleX : MiChartNoAxesCombined} value={count} caption={<>{records.length ? Math.round(count / records.length * 100) : 0}% of {records.length} records</>} />)}</MetricOverview>
      <section className="talent-panel"><div className="talent-toolbar"><h2>{config.label}</h2><span>{records.length} records</span></div>{records.length ? <div className="talent-table-scroll"><table><thead><tr>{config.fields.filter(field => field.type !== 'textarea').map(field => <th key={field.key}>{field.label}</th>)}</tr></thead><tbody>{visible.map(record => <tr key={record.id}>{config.fields.filter(field => field.type !== 'textarea').map(field => <td key={field.key}>{displayValue(record, field) || ''}</td>)}</tr>)}</tbody></table></div> : <div className="talent-empty"><h3>No records for this report</h3><p>Adjust your filters or add records in the corresponding module.</p></div>}{records.length > 0 && <div className="talent-toolbar" aria-label="Report pagination"><span>{(currentPage - 1) * 25 + 1} - {Math.min(currentPage * 25, records.length)} of {records.length} records</span><div className="talent-actions"><Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</Button><span>Page {currentPage} of {pages}</span><Button variant="outline" size="sm" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next</Button></div></div>}</section>
    </>}</SectionSkeleton>
  </div>;
}
