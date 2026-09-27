import React, { useEffect, useState } from 'react';
import { Download, RefreshCw, FileText, Link } from 'lucide-react';
import { payslipApi } from '../../lib/payslipApi';
import './PayslipStudio.scss';

export function PayslipRecords({ employee, refreshKey = 0 }) {
  const [records, setRecords] = useState([]), [error, setError] = useState(''), [loading, setLoading] = useState(false), [busy, setBusy] = useState(''), [notice, setNotice] = useState('');
  const [tick, setTick] = useState(0);
  useEffect(() => { const refresh = () => setTick(t => t + 1); window.addEventListener('payslip-records-changed', refresh); return () => window.removeEventListener('payslip-records-changed', refresh); }, []);
  useEffect(() => {
    let active = true; setRecords([]); setError('');
    if (!employee?.userid) return;
    setLoading(true);
    payslipApi.records(employee.userid).then(data => { if (active) setRecords(data); }).catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [employee?.userid, refreshKey, tick]);
  async function action(record, download) {
    setBusy(record.id); setError(''); setNotice('');
    try {
      if (download === 'link') { const { url } = await payslipApi.downloadLink(record.id); await navigator.clipboard.writeText(url); setNotice('Private download link copied. It expires in 5 minutes.'); }
      else if (download) await payslipApi.download(record.id);
      else { const result = await payslipApi.generate(record.id); if (result.status !== 'ready') throw new Error(result.error); setTick(t => t + 1); }
    } catch (err) { setError(err.message); } finally { setBusy(''); }
  }
  return <section className="payslip-records"><header><div><h3><FileText size={16} /> Generated payslips</h3><p>Saved salary and template revisions for {employee?.userid || 'the selected person'}.</p></div><button type="button" className="ps-button" aria-label="Refresh payslips" onClick={() => setTick(t => t + 1)} disabled={loading}><RefreshCw size={14} /></button></header>
    {notice && <p role="status" className="ps-notice">{notice}</p>}
    {error && <p role="alert" className="ps-error">{error}</p>}
    {loading ? <p className="ps-empty">Loading payslips...</p> : !records.length ? <p className="ps-empty">No generated payslips yet. Assign a template and save salary in Edit Salary & Structure.</p> : <div className="ps-record-list">{records.map(record => <article key={record.id}><div><strong>{record.month} {record.year}</strong><small>{record.template.name} / v{record.template.version} / {record.created_at.slice(0, 10)}</small><span>INR {record.salary.monthly_net.toLocaleString('en-IN', { minimumFractionDigits: 2 })} net pay</span>{record.error && <small className="ps-error">{record.error}</small>}</div><span className={'ps-status ' + record.status}>{record.status === 'ready' ? 'Stored in R2' : record.status === 'failed' ? 'Upload needs retry' : 'Not generated'}</span><button type="button" className="ps-button" disabled={busy === record.id} onClick={() => action(record, record.status === 'ready')}><Download size={14} />{busy === record.id ? 'Working...' : record.status === 'ready' ? 'Download PDF' : 'Generate & store'}</button>{record.status === 'ready' && <button className="ps-button" type="button" disabled={busy === record.id} title="Copy private download link (5 minutes)" aria-label="Copy private download link" onClick={() => action(record, 'link')}><Link size={14} /></button>}</article>)}</div>}
  </section>;
}
