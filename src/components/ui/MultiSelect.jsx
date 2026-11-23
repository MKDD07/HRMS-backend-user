import React,{useId,useState} from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from './Button';
import './MultiSelect.scss';

export function MultiSelect({label,options=[],value=[],onChange,disabled=false,maxSelected,placeholder='Select options',empty='No options available.'}) {
  const id=useId(),[open,setOpen]=useState(false),[search,setSearch]=useState('');
  const selected=options.filter(option=>value.includes(option.value));
  const filtered=options.filter(option=>`${option.label} ${option.description||''}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <div className="multi-select" onKeyDown={e=>{if(e.key==='Escape')setOpen(false);}}>
    <span id={`${id}-label`} className="multi-select__label">{label}{maxSelected&&<small>{value.length}/{maxSelected}</small>}</span>
    <Button size="sm" variant="outline" endIcon={ChevronDown} className="multi-select__trigger" disabled={disabled} aria-labelledby={`${id}-label ${id}-value`} aria-expanded={open} aria-controls={`${id}-options`} onClick={() => setOpen(!open)}><span id={`${id}-value`}>{selected.length?selected.map(option=>option.label).join(', '):placeholder}</span></Button>
    {open&&<div id={`${id}-options`} className="multi-select__options"><input aria-label={`Search ${label.toLowerCase()}`} placeholder="Search options" value={search} onChange={e=>setSearch(e.target.value)} disabled={disabled}/><div className="multi-select__list">{filtered.map(option=><label key={option.value}><input type="checkbox" checked={value.includes(option.value)} disabled={disabled||option.disabled||(!value.includes(option.value)&&maxSelected!=null&&value.length>=maxSelected)} onChange={()=>onChange(value.includes(option.value)?value.filter(item=>item!==option.value):[...value,option.value])}/><span>{option.label}{option.description&&<small>{option.description}</small>}</span></label>)}{!filtered.length&&<p>{search?'No matches.':empty}</p>}</div><Button variant="fadeout" size="sm" onClick={() => setOpen(false)}>Done</Button></div>}
  </div>;
}
