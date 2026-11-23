import { SectionSkeleton } from '../../components/ui/SectionSkeleton';
import { Users as MiUsers, UserPlus as MiUserPlus, UserMinus as MiUserMinus, Fingerprint as MiFingerprint } from 'lucide-react';
import { MetricOverview, MetricCard } from '../../components/ui/MetricOverview';
import { WorkspaceFilters } from '../../components/ui/WorkspaceFilters';
import { TenantHeader } from '../../components/ui/TenantHeader';
import React, { useEffect, useRef, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Button } from '../../components/ui/Button';
import { operationsApi } from '../../lib/operationsApi';
import { downloadTalentCsv } from '../../lib/talentApi';
import '../talent/TalentWorkspace.scss';
import './OperationsPage.scss';
const month = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
const money = value => Number(value).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
export function HRAnalyticsPage() {
  const [from,setFrom]=useState(()=>`${new Date().getFullYear()}-01`), [to,setTo]=useState(()=>month(new Date()));
  const [data,setData]=useState(null), [views,setViews]=useState([]), [loading,setLoading]=useState(true), [error,setError]=useState(''), [tab,setTab]=useState('headcount'), [version,setVersion]=useState(0);
  const [search, setSearch] = useState('');
  const [viewTitle,setViewTitle]=useState(''), [saving,setSaving]=useState(false), [saveError,setSaveError]=useState(''), [notice,setNotice]=useState('');
  const seq=useRef(0);
  useEffect(()=>{const request=++seq.current;setLoading(true);setError('');if(!from || !to || from>to){setError('Select a start month on or before the end month.');setLoading(false);return;}
    Promise.all([operationsApi.analytics(from,to),operationsApi.views()]).then(([report,saved])=>{if(request===seq.current){setData(report);setViews(saved);}}).catch(e=>{if(request===seq.current)setError(e.message);}).finally(()=>{if(request===seq.current)setLoading(false);});return()=>{seq.current++;};
  },[from,to,version]);
  const shown=!loading && !error && data;
  const tabs=[['headcount','Headcount & attrition'],['attendance','Attendance'],['payroll','Payroll'],['departments','Departments']];
  const headings=tab==='headcount'?['Month','Opening headcount','Closing headcount','Joiners','Exits','Attrition %']:tab==='attendance'?['Month','Recorded punch days','Completed punch hours','Open punches']:tab==='departments'?['Department','Current employees']:['Source','Month','Currency','Status','Records','Gross','Deductions','Net'];
  const records=!shown?[]:tab==='headcount'?data.monthly.map(r=>[r.month,r.opening,r.closing,r.joined,r.left,r.attrition===null?'N/A':r.attrition]):tab==='attendance'?data.monthly.map(r=>[r.month,r.punch_days,r.hours || 0,r.open_punches]):tab==='departments'?data.departments.map(r=>[r.department,r.employees]):[...data.salaryLedger.map(r=>['Payroll Studio',r.month,r.currency,r.status,r.records,money(r.gross),money(r.deductions),money(r.net)]),...data.payroll.map(r=>['Core payroll',r.month,r.currency,r.status,r.records,money(r.gross),money(r.deductions),money(r.net)])];
  const filteredRecords = records.filter(row => row.join(' ').toLowerCase().includes(search.trim().toLowerCase()));
  async function saveView(event){event.preventDefault();setSaving(true);setSaveError('');setNotice('');try{const view=await operationsApi.saveView(viewTitle,from,to);setViews(old=>[view,...old]);setViewTitle('');setNotice('View saved.');}catch(e){setSaveError(e.message);}finally{setSaving(false);}}
  return <div className="talent-workspace operations-workspace"><TenantHeader
        settings={{
          subheading: "COMPANY INSIGHTS",
          heading: "HR Analytics",
          paragraph: "Explore employee trends, recorded attendance, and saved payroll totals.",
          refresh: { label: "Refresh analytics" },
          buttons: [
            { id: 'action1', label: "Export CSV", variant: "outline" }
          ]
        }}
        actions={{
          refresh: { "icon": RefreshCw, "loading": loading, "onClick": ()=>setVersion(v=>v+1) },
          action1: { "icon": Download, "disabled": !shown || !filteredRecords.length, "onClick": ()=>downloadTalentCsv(`hr-${tab}-${from}-${to}.csv`,headings,filteredRecords) }
        }}
      />
    <section className="talent-panel"><div className="talent-editor-body"><div className="talent-form-grid"><label><span>From month</span><input type="month" value={from} onChange={e=>setFrom(e.target.value)}/></label><label><span>Through month (up to 24 months)</span><input type="month" min={from} value={to} onChange={e=>setTo(e.target.value)}/></label><label className="talent-full"><span>Saved views</span><select value="" onChange={e=>{const view=views.find(v=>v.id===e.target.value);if(view){setFrom(view.from_month);setTo(view.to_month);}}}><option value="">Select saved date range</option>{views.map(v=><option key={v.id} value={v.id}>{v.title} · {v.from_month}–{v.to_month}</option>)}</select></label></div><form className="talent-actions" onSubmit={saveView}><input aria-label="Saved view name" placeholder="Name this date range" required maxLength={100} value={viewTitle} onChange={e=>setViewTitle(e.target.value)} disabled={saving}/><Button type="submit" variant="outline" loading={saving} disabled={!shown}>Save view</Button></form>{saveError && <p role="alert">{saveError}</p>}{notice && <p role="status">{notice}</p>}</div></section>
    {error && <div role="alert" className="talent-alert">{error}<Button variant="outline" onClick={() => setVersion(v => v + 1)}>Retry</Button></div>}
    <MetricOverview loading={loading} aria-label="HR summary">{[['Current headcount',shown?data.currentHeadcount:'—','Excludes inactive employees'],['Joiners in range',shown?data.monthly.reduce((s,r)=>s+r.joined,0):'—','Based on recorded joining dates'],['Exits in range',shown?data.monthly.reduce((s,r)=>s+r.left,0):'—','Recorded exit dates / completed exit plans'],['Punch days',shown?data.monthly.reduce((s,r)=>s+r.punch_days,0):'—','Recorded employee-days in range']].map(([label,value,detail], index)=><MetricCard key={label} label={label} icon={[MiUsers, MiUserPlus, MiUserMinus, MiFingerprint][index]} value={value} caption={detail} />)}</MetricOverview>
    <section className="talent-panel"><div className="talent-toolbar"><nav className="talent-tabs" aria-label="Analytics tabs">{tabs.map(([id,label])=><Button key={id} aria-pressed={tab === id} onClick={() => setTab(id)} variant={tab === id ? "colored" : "fadeout"} type="submit" wrapContent={false}>{label}</Button>)}</nav></div>
      <WorkspaceFilters search={search} onSearch={setSearch} searchLabel="Search analytics rows" active={!!search} onReset={()=>setSearch('')} />
      {shown && ['headcount','attendance'].includes(tab) && <div className="operations-trend" role="img" aria-label={tab==='headcount'?'Monthly closing headcount; detailed values in the table below.':'Monthly recorded punch days; detailed values in the table below.'}><ResponsiveContainer width="100%" height={240}><LineChart data={data.monthly} margin={{top:16,right:24,bottom:8,left:0}}><CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3"/><XAxis dataKey="month" stroke="var(--color-text-secondary)"/><YAxis allowDecimals={false} stroke="var(--color-text-secondary)"/><Tooltip contentStyle={{background:'var(--color-surface)',borderColor:'var(--color-border)',borderRadius:'var(--radius-input)'}}/><Line type="monotone" dataKey={tab==='headcount'?'closing':'punch_days'} name={tab==='headcount'?'Closing headcount':'Punch days'} stroke="var(--color-primary)" strokeWidth={2} isAnimationActive={false}/></LineChart></ResponsiveContainer></div>}
      <SectionSkeleton loading={loading}>{loading?<div className="talent-empty" role="status">Calculating company analytics…</div>:error?<div className="talent-empty">Analytics unavailable.</div>:!filteredRecords.length?<div className="talent-empty">No recorded data for this period.</div>:<div className="talent-table-scroll"><table><thead><tr>{headings.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{filteredRecords.map((row,i)=><tr key={i}>{row.map((value,j)=><td key={j}>{value}</td>)}</tr>)}</tbody></table></div>}</SectionSkeleton>
      <div className="talent-editor-body"><p className="talent-hint">{tab==='headcount'?'Monthly attrition = recorded exits ÷ average of opening and closing headcount × 100. Historical values depend on recorded joining and exit dates.':tab==='attendance'?'Punch days count recorded employee-days. Hours include completed, valid punch pairs only. These are not scheduled attendance or absence percentages.':tab==='departments'?'Department counts reflect current employee status, irrespective of the selected date range.':'Payroll Studio uses the latest finalized salary per employee and month. Core payroll is shown separately; the two sources must not be added together. Finalized salary does not mean paid.'}</p></div>
    </section>
    {shown && data.warnings.length>0 && <section className="talent-panel"><div className="talent-editor-body"><h2>Data coverage</h2>{data.warnings.map(w=><p className="talent-hint" key={w}>{w}</p>)}</div></section>}
  </div>;
}
