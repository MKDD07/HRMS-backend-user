import React from 'react';
import { ViewTabs } from '../../../components/ui/ViewTabs';
import { Button } from '../../../components/ui/Button';
import { MONTH_NAMES } from '../lib/customRowsStore';
export function ScopePicker({value,onChange,year,month}) {
 const activeYear=String(value.year||year),selected=value.months||[];
 const changeMode=mode=>onChange({...value,mode,year:activeYear});
 return <div className="payroll-scope-picker"><ViewTabs label="Component schedule" value={value.mode} onChange={changeMode} tabs={[{id:'once',label:'This month'},{id:'ongoing',label:'Recurring'},{id:'selected',label:'Choose months'}]}/><p className="payroll-muted">{value.mode==='ongoing'?'Recurring from ':value.mode==='once'?'Applies to ': 'Select months in '}{value.mode==='selected'?activeYear:month+' '+activeYear}</p>{value.mode==='selected'&&<><div className="payroll-scope-toolbar"><label>Year<select value={activeYear} onChange={event=>onChange({...value,year:event.target.value})}>{[...new Set([activeYear,...Array.from({length:7},(_,i)=>String(Number(year)-3+i))])].sort().map(y=><option key={y}>{y}</option>)}</select></label><Button size="sm" variant="outline" onClick={() => onChange({
  ...value,
  months: [...MONTH_NAMES]
})}>Select all</Button><Button size="sm" variant="fadeout" onClick={() => onChange({
  ...value,
  months: []
})}>Clear</Button></div><div className="payroll-month-grid">{MONTH_NAMES.map(m=><Button key={m} size="sm" variant={selected.includes(m) ? 'colored' : 'outline'} active={selected.includes(m)} onClick={() => onChange({
  ...value,
  months: selected.includes(m) ? selected.filter(item => item !== m) : [...selected, m]
})}>{m.slice(0,3)}</Button>)}</div></>}</div>;
}
