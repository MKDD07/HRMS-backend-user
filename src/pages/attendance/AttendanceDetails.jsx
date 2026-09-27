import { MockLocationIcon } from './MockLocationIcon';
﻿import React, { useEffect, useState } from 'react';
import { AlertTriangle, Monitor, X } from 'lucide-react';
import { punchEvidence, mockLocationSignals, safeLogValue } from './punchEvidence';
import { hasPunch, formatMinutes, recordDate } from './attendanceLedger';
const nameOf = person => [person.first_name,person.last_name].filter(Boolean).join(' ') || person.name || person.userid;
const show = value => value == null || value === '' ? 'Not recorded' : String(value);
export function PunchEvidence({ record }) {
  const evidence = punchEvidence(record);
  const signals = mockLocationSignals(record);
  return <section className="punch-evidence" aria-label="Device and location evidence"><h3><Monitor size={15} />Device &amp; location evidence</h3><div className={`punch-location-flag ${signals.any ? 'is-flagged' : ''}`} role={signals.any ? 'alert' : undefined}>{signals.any && <AlertTriangle size={16} />}<span>{signals.any ? 'Mock location reported - review this punch' : evidence.mock === false ? 'Mock-location signal: not reported by device' : 'Mock-location signal: not recorded'}</span></div><dl>{evidence.fields.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{show(value)}</dd></div>)}</dl><p>Evidence supplied with this punch. A missing or negative mock-location signal does not verify the location.</p></section>;
}
export function CompleteLogDetails({ record }) {
  const flags = mockLocationSignals(record);
  const signal = value => value === true ? 'Mock location reported' : value === false ? 'Device reported false' : 'Not recorded';
  const clean = safeLogValue(Object.fromEntries(Object.entries(record).filter(([key])=>key!=='employee')));
  function render(value) {
    if (Array.isArray(value)) return value.length ? value.map((item,index)=><div key={index}>{render(item)}</div>) : 'No records';
    if (value && typeof value==='object') return <dl className="attendance-details">{Object.entries(value).map(([key,item])=><div key={key}><dt>{key.replace(/_/g,' ')}</dt><dd>{render(item)}</dd></div>)}</dl>;
    return value === true ? 'Yes' : value === false ? 'No' : show(value);
  }
  return <div className="attendance-complete-log"><h3>Record &amp; punch information</h3><dl className="attendance-details">{[['Record ID',record.id || record.attendance_id],['Employee ID',record.userid || record.user_id || record.employee?.userid],['Date',record.date || record.attdate],['Status',record.status || record.attstatus],['Punch in',record.check_in_time || record.intime],['Punch out',record.check_out_time || record.outtime],['Reported hours',record.total_hours ?? record.totalhours]].map(([key,value])=><div key={key}><dt>{key}</dt><dd>{show(value)}</dd></div>)}</dl><h3>Location-integrity signals</h3><dl className="attendance-details"><div><dt>Punch in</dt><dd>{signal(flags.checkIn)} <MockLocationIcon record={record} phase="in" /></dd></div><div><dt>Punch out</dt><dd>{signal(flags.checkOut)} <MockLocationIcon record={record} phase="out" /></dd></div><div><dt>Record-level signal</dt><dd>{signal(flags.general)}</dd></div></dl>{flags.general === true && flags.checkIn !== true && flags.checkOut !== true && <p className="attendance-note">The record reports mock location but does not identify which punch was affected.</p>}<PunchEvidence record={record} /><h3>All supplied log fields</h3>{render(clean)}</div>;
}
export function MonthlyAttendanceDetails({ metric, people, dates, ledger, logs, monthLabel, onClose, onOpenDay, loading, error, missing }) {
  const [page,setPage]=useState(1);
  const scope=people.map(person=>person.userid).join('|');
  useEffect(()=>setPage(1),[metric,monthLabel,scope]);
  const title = {employees:'Employees',days:'Days with punches',hours:'Reported hours',records:'Punch records'}[metric];
  const dayRows=people.flatMap(person=>dates.map(day=>({person,day,cell:ledger[person.userid]?.[day]}))).filter(row=>row.cell);
  const rows=metric==='employees' ? people.map(person=>({person})) : metric==='records' ? logs.map(record=>({person:record.employee,day:recordDate(record),record})) : dayRows.filter(row=>metric==='days' ? row.cell.records.some(record=>hasPunch(record.check_in_time || record.intime)) : row.cell.minutes!==null);
  const totalPages=Math.max(1,Math.ceil(rows.length/25));
  const activePage=Math.min(page,totalPages);
  return <section className="attendance-panel attendance-month-drilldown" id="attendance-month-details" aria-label={`${title} monthly details`}><div className="attendance-panel-heading"><div><h2>{title} / {monthLabel}</h2><p>{metric==='employees' ? 'Employees in the current selection, with their monthly totals.' : metric==='hours' ? 'Only reported hours are summed; unreported durations are excluded.' : 'Monthly records for the current employee selection.'}</p></div><button className="attendance-icon" onClick={onClose} aria-label="Close monthly details"><X size={16} /></button></div>{loading ? <div className="attendance-empty">Loading monthly details...</div> : error ? <div className="attendance-empty">Employee data is unavailable. Refresh to try again.</div> : <>{missing && <p className="attendance-note">Attendance is incomplete for some employees. Available records are listed below.</p>}{!rows.length ? <div className="attendance-empty">{metric==='hours' ? 'No reported hours in this month.' : 'No matching monthly records.'}</div> : <><div className="attendance-logs-scroll"><table className="attendance-logs"><thead><tr><th>Employee</th>{metric==='employees' ? <><th>Punch days</th><th>Reported hours</th><th>Records</th></> : <><th>Date</th>{metric==='records' ? <><th>Punch in</th><th>Punch out</th></> : <th>{metric==='hours'?'Reported hours':'Records'}</th>}<th>Day ledger</th></>}</tr></thead><tbody>{rows.slice((activePage-1)*25,activePage*25).map((row,index)=>{
    const cells=dates.map(day=>ledger[row.person.userid]?.[day]).filter(Boolean);
    const unavailable=cells.some(cell=>cell.code==='?');
    const times=cells.map(cell=>cell.minutes).filter(value=>value!==null);
    return <tr key={`${row.person.userid}-${row.day || index}-${index}`}><td><strong>{nameOf(row.person)}</strong><small>{row.person.userid}</small></td>{metric==='employees' ? <><td>{unavailable?'?':cells.filter(cell=>cell.records.some(record=>hasPunch(record.check_in_time || record.intime))).length}</td><td>{unavailable?'?':times.length?formatMinutes(times.reduce((sum,time)=>sum+time,0)):'Not recorded'}</td><td>{unavailable?'?':cells.reduce((sum,cell)=>sum+cell.records.length,0)}</td></> : <><td>{row.day} <MockLocationIcon records={row.record ? [row.record] : row.cell?.records} /></td>{metric==='records' ? <><td>{show(row.record.check_in_time || row.record.intime)} <MockLocationIcon record={row.record} phase="in" /></td><td>{show(row.record.check_out_time || row.record.outtime)} <MockLocationIcon record={row.record} phase="out" /></td></> : <td>{metric==='hours'?formatMinutes(row.cell.minutes):row.cell.records.length}</td>}<td><button className="attendance-text" onClick={()=>onOpenDay(row.person,row.day)}>Open day</button></td></>}</tr>;
  })}</tbody></table></div><div className="attendance-pagination"><button disabled={activePage===1} onClick={()=>setPage(activePage-1)}>Previous</button><span>{activePage} / {totalPages}</span><button disabled={activePage===totalPages} onClick={()=>setPage(activePage+1)}>Next</button></div></>}</>}</section>;
}
