import { ModalFrame } from '../../components/ui/Modal';
import { OverviewWorkspace } from './OverviewWorkspace';
import { OverviewLoading } from './OverviewLoading';
import { TenantHeader } from '../../components/ui/TenantHeader';
import React,{useCallback,useEffect,useRef,useState} from 'react';
import { AlertCircle,Download,Plus,SlidersHorizontal,RotateCcw } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { CloseButton } from '../../components/ui/CloseButton';
import { companyRequest } from '../../lib/companyAuth';
import { downloadTalentCsv } from '../../lib/talentApi';
import { AddPerson } from '../employees/EmployeesPage';
import { istDay } from '../../../shared/overviewModel.mjs';
import './DashboardPage.scss';
function Empty({children}){return <div className="tenant-empty">{children}</div>;}
function Dialog({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current.showModal();
    return () => previous?.focus?.();
  }, []);
  return (
    <ModalFrame ref={ref} className="overview-dialog" onCancel={event => {
      event.preventDefault();
      onClose();
    }} aria-label={title}>
      <header>
        <h2>{title}</h2>
        <CloseButton label={`Close ${title}`} onClick={onClose} />
      </header>
      {children}
    </ModalFrame>
  );
}

const dateText=value=>value?new Date(value).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'}):'Not recorded';
export function DashboardPage({currentUser,onNavigate,api,onShowToast}){
  const [data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[filters,setFilters]=useState({department:'',location:'',shift:'',from:'',to:''}),[days,setDays]=useState(7),[adding,setAdding]=useState(false),[posting,setPosting]=useState(false),[saving,setSaving]=useState(false),[postError,setPostError]=useState('');
  const [filtersOpen,setFiltersOpen]=useState(false);
  const request=useRef(null),sequence=useRef(0);
  const refresh=useCallback(async()=>{
    request.current?.abort();
    const controller=new AbortController();request.current=controller;
    const seq=++sequence.current;
    let timedOut=false;
    const timeout=setTimeout(()=>{timedOut=true;controller.abort();},30000);
    setLoading(true);setError('');
    try {
      const params=new URLSearchParams(Object.entries(filters).filter(([,value])=>value));
      params.set('days',String(days));
      const value=await companyRequest('/overview?'+params,{token:localStorage.getItem('pulse_hrms_token'),signal:controller.signal});
      if(seq===sequence.current)setData(value);
    } catch(e) {
      if(seq===sequence.current&&(timedOut||e.name!=='AbortError'))setError(timedOut?'The overview took too long to load. Please retry.':e.message);
    } finally {
      clearTimeout(timeout);
      if(seq===sequence.current)setLoading(false);
    }
  },[filters,days]);
  useEffect(()=>{refresh();const timer=setInterval(()=>{if(!document.hidden)refresh();},180000);return()=>{clearInterval(timer);sequence.current++;request.current?.abort();};},[refresh]);
  const selectPeriod = (from, to) => {
    if (!from || !to || from > to || to > (data?.today || istDay())) return;
    setDays(0);
    setFilters(old => ({ ...old, from, to }));
  };
  const changePeriod = direction => {
    if (!data) return;
    const start = Date.parse(data.from + 'T12:00:00Z');
    const end = Date.parse(data.to + 'T12:00:00Z');
    const span = Math.round((end - start) / 86400000) + 1;
    const todayEnd = Date.parse(data.today + 'T12:00:00Z');
    const nextEnd = Math.min(todayEnd, end + direction * span * 86400000);
    setDays(0);
    setFilters(old => ({ ...old, from: new Date(nextEnd - (span - 1) * 86400000).toISOString().slice(0, 10), to: new Date(nextEnd).toISOString().slice(0, 10) }));
  };
  const navigate=(page,userId)=>{if(data?.permissions[page]||(page==='employee-detail'&&data?.permissions.employees))onNavigate?.(page,userId);};
  const unavailable=keys=>keys.some(k=>data?.errors[k]);
  const change=(key,value)=>setFilters(old=>({...old,[key]:value}));
  const today=data?.today||istDay();
  const exportAttendance=()=>downloadTalentCsv('attendance-overview.csv',['Employee','Department','Date','Status','Check-in (UTC)','Check-out (UTC)','Worked hours'],data.lists.attendance.map(r=>[r.name,r.department,r.date,r.detail,r.check_in,r.check_out,r.hours]));
  async function postAnnouncement(event){event.preventDefault();setSaving(true);setPostError('');const form=new FormData(event.currentTarget);try{await companyRequest('/hr-connect',{token:localStorage.getItem('pulse_hrms_token'),method:'POST',body:JSON.stringify({kind:'announcement',title:form.get('title'),body:form.get('body'),status:'Published',scope:filters.department?'department':'all',target:filters.department})});setPosting(false);refresh();onShowToast?.({type:'success',title:'Announcement published',message:'Saved in HR Connect.'});}catch(e){setPostError(e.message);}finally{setSaving(false);}}
  return <main id="tenant-admin-dashboard" className="tenant-dashboard" aria-busy={loading}>
    <TenantHeader
      refreshAccessory={<Button className="overview-filter-toggle" variant="fadeout" iconOnly icon={SlidersHorizontal} aria-label="Toggle dashboard filters" title="Filters" active={filtersOpen} aria-expanded={filtersOpen} aria-controls="dashboard-filter-panel" onClick={()=>setFiltersOpen(open=>!open)} />}
      settings={{
        subheading: 'WORKSPACE / OVERVIEW',
        heading: (data?.role || 'Workspace') + ' Overview',
        paragraph: 'Welcome back' + (currentUser?.first_name ? ', ' + currentUser.first_name : '') + '. Your people, attendance and priorities.',
        refresh: true,
        buttons: [
          { id: 'exportAttendance', label: 'Export attendance', variant: 'outline' },
          { id: 'postAnnouncement', label: 'Post announcement', variant: 'outline' },
          { id: 'addEmployee', label: 'Add employee' },
        ],
      }}
      actions={{
        refresh: { onClick: refresh, loading },
        exportAttendance: {
          icon: Download,
          visible: !!data,
          disabled: loading || unavailable(['attendance', 'leaves', 'shifts', 'calendar']),
          onClick: exportAttendance,
        },
        postAnnouncement: {
          visible: !!data?.permissions?.helpdesk,
          onClick: () => { setPosting(true); setPostError(''); },
        },
        addEmployee: {
          icon: Plus,
          visible: !!data?.permissions?.employees,
          onClick: () => setAdding(true),
        },
      }}
    />
    <div className={`overview-filter-disclosure ${filtersOpen ? 'is-open' : ''}`} inert={!filtersOpen} aria-hidden={!filtersOpen}><div className="overview-filter-disclosure-inner"><div id="dashboard-filter-panel" className="overview-filters overview-filters--compact" role="region" aria-label="Dashboard filters">
      <div className={`overview-filter-fields ${days === 0 ? 'has-custom-range' : ''}`}>
        {[['department','Department',data?.filters.departments],['location','Location',data?.filters.locations],['shift','Shift',data?.filters.shifts]].map(([key,label,options]) => <label key={key}><span className="overview-label-text">{label}</span><select value={filters[key]} onChange={e=>change(key,e.target.value)} aria-label={label}><option value="">All {label.toLowerCase()}s</option>{(options||[]).map(option=><option key={option.id||option} value={option.id||option}>{option.name||option}</option>)}</select></label>)}
        <label><span className="overview-label-text">Period</span><select aria-label="Overview date range" value={days} onChange={e=>{setDays(Number(e.target.value));setFilters(old=>({...old,from:'',to:''}));}}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={0}>Custom range</option></select></label>
        {days===0&&<><label><span className="overview-label-text">From</span><input aria-label="From date" type="date" max={filters.to||today} value={filters.from} onChange={e=>change('from',e.target.value)}/></label><label><span className="overview-label-text">To</span><input aria-label="To date" type="date" min={filters.from||undefined} max={today} value={filters.to} onChange={e=>change('to',e.target.value)}/></label></>}
      </div>
      <div className="overview-filter-reset"><Button size="sm" variant="fadeout" iconOnly icon={RotateCcw} aria-label="Reset dashboard filters" title="Reset filters" disabled={!Object.values(filters).some(Boolean) && days === 7} onClick={()=>{setFilters({department:'',location:'',shift:'',from:'',to:''});setDays(7);}} /></div>
    </div></div></div>
    {error&&<div role="alert" className="tenant-warning"><AlertCircle size={18}/><span>{error}{data?' Previously loaded data remains visible.':''}</span><Button onClick={refresh}>Retry</Button></div>}
    {data&&Object.keys(data.errors).length>0&&<div role="alert" className="tenant-warning"><AlertCircle size={18}/><span>{Object.values(data.errors).join(' ')} Affected metrics are unavailable.</span><Button variant="outline" onClick={refresh}>Retry</Button></div>}
    {!data?(loading?<OverviewLoading />:<Empty>Overview could not be loaded.</Empty>):<>
      <OverviewWorkspace onSelectPeriod={selectPeriod} onChangePeriod={changePeriod} data={data} loading={loading && !data} currentUser={currentUser} onNavigate={navigate} onRefresh={refresh} onAddEmployee={()=>setAdding(true)} onPostAnnouncement={()=>{setPosting(true);setPostError('');}} />
    </>}
    <footer className="tenant-freshness" role="status">{loading?'Refreshing…':data?`Last successful refresh: ${dateText(data.refreshed_at)} IST`:'Not loaded.'} · Auto-refresh every 3 minutes while this tab is visible.</footer>
    {adding&&<AddPerson api={api} onClose={()=>setAdding(false)} onCreated={()=>{setAdding(false);refresh();onShowToast?.({type:'success',title:'Employee added',message:'Directory updated.'});}}/>}
    {posting&&<Dialog title="Post announcement" onClose={()=>{if(!saving)setPosting(false);}}><form onSubmit={postAnnouncement} className="overview-post"><p>Audience: {filters.department||'All employees'}. Shift and location filters do not limit announcement recipients.</p>{postError&&<p role="alert">{postError}</p>}<label>Title<input name="title" required maxLength={200} disabled={saving}/></label><label>Notice<textarea name="body" required maxLength={10000} rows={6} disabled={saving}/></label><Button type="submit" loading={saving}>Publish announcement</Button></form></Dialog>}
  </main>;
}
export default DashboardPage;
