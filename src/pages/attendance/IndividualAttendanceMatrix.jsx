import { MockLocationIcon } from './MockLocationIcon';
﻿import React from 'react';
import { ATTENDANCE_CODES, dayLedger, monthDates } from './attendanceLedger';
export function IndividualAttendanceMatrix({ person, records, leaves, year, today, onOpenDay, leaveUnavailable }) {
  const joined = String(person.date_of_joining || person.joining_date || '').slice(0, 10);
  const validJoining = /^\d{4}-\d{2}-\d{2}$/.test(joined);
  const rows = Array.from({length:12}, (_, index) => {
    const date = new Date(year, index, 1);
    const days = monthDates(date);
    return {month:date.toLocaleDateString('en-GB',{month:'long'}), days, cells:days.map(day => dayLedger(records ?? null, leaves, person.userid, day, today, joined))};
  }).filter(row => !validJoining || row.days[row.days.length-1] >= joined);
  const counts = Object.fromEntries(Object.keys(ATTENDANCE_CODES).map(code => [code, rows.reduce((sum,row) => sum + row.cells.filter(cell => cell.code === code).length,0)]));
  return <section className="attendance-panel"><div className="attendance-panel-heading"><div><h2>{[person.first_name,person.last_name].filter(Boolean).join(' ') || person.userid} / Individual matrix</h2><p>{year} attendance ledger / Joined: {validJoining ? joined : 'Not provided'}</p></div><span>{person.userid}</span></div>
    {leaveUnavailable && <p className="attendance-note">Leave source unavailable. Leave counts may be incomplete.</p>}
    <div className="attendance-code-counts">{Object.entries(ATTENDANCE_CODES).filter(([code]) => !['NA','-','?'].includes(code)).map(([code,title]) => <div key={code} title={title} className={`code-${code}`}><span>{code}</span><strong>{records === null ? '-' : counts[code]}</strong><small>{title}</small></div>)}</div>
    <div className="attendance-matrix-scroll"><table className="attendance-matrix"><thead><tr><th>Month / {year}</th>{Array.from({length:31},(_,i)=><th key={i}>{i+1}</th>)}<th>P</th><th>A</th><th>EL</th><th>SL</th><th>CL</th></tr></thead><tbody>{rows.map(row=><tr key={row.month}><th scope="row">{row.month}</th>{Array.from({length:31},(_,i)=> {const cell=row.cells[i]; return <td key={i}>{cell ? <button disabled={cell.code==='NA'} className={`attendance-matrix-cell code-${cell.code}`} aria-label={`${row.days[i]}: ${cell.label}`} title={`${row.days[i]}: ${cell.label}`} onClick={()=>onOpenDay(person,row.days[i])}>{cell.code}<MockLocationIcon records={cell.records} /></button> : <span aria-label="Date does not exist"> </span>}</td>;})}{['P','A','EL','SL','CL'].map(code=><td key={code}>{records === null ? '?' : row.cells.filter(cell=>cell.code===code).length}</td>)}</tr>)}</tbody></table></div>
    {!rows.length && <div className="attendance-empty">This employee had not joined during {year}.</div>}
    <div className="attendance-legend">{Object.entries(ATTENDANCE_CODES).map(([code,title])=><span className={`code-${code}`} key={code}>{code}: {title}</span>)}</div><p className="attendance-note">Counts are calendar days with each recorded status, not leave balances or payable-day calculations. Click a date for its complete ledger.</p>
  </section>;
}
