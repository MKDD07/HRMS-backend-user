import React, { useId, useState } from 'react';
import { ListChecks } from 'lucide-react';
import { ViewTabs } from './ViewTabs';
import { Button } from './Button';
import { UniversalSearch } from './UniversalSearch';
import './PermissionPicker.scss';

/** Controlled page permissions; this component never saves or grants access. */
export function PermissionPicker({ options, groups = [], value = [], onChange, disabled = false, title = 'Allowed pages', description = 'Each selected page includes its management actions.' }) {
  const id = useId();
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState('all');
  const [selectedOnly, setSelectedOnly] = useState(false);
  const selected = new Set(value);
  const groupKeys = groups.find(item => item.id === group)?.keys;
  const visible = options.filter(([key, label]) => (!groupKeys || groupKeys.includes(key)) && (!selectedOnly || selected.has(key)) && label.toLowerCase().includes(search.trim().toLowerCase()));
  return <section className="permission-picker" aria-labelledby={`${id}-title`} aria-describedby={`${id}-hint`}>
    <div className="permission-picker-heading">
      <h3 id={`${id}-title`}><ListChecks size={16} aria-hidden="true" />{title}</h3>
      <span aria-live="polite">{options.filter(([key]) => selected.has(key)).length} of {options.length} selected</span>
    </div>
    <p className="ws-hint" id={`${id}-hint`}>{description}</p>
    {groups.length > 0 && <ViewTabs variant="slider" label="Allowed page categories" value={group} onChange={setGroup} disabled={disabled} tabs={[{ id: 'all', label: 'All pages', count: options.length }, ...groups.map(item => ({ id: item.id, label: item.label, count: options.filter(([key]) => item.keys.includes(key)).length }))]} />}
    <div className="permission-picker-tools">
      <UniversalSearch scope="page-permissions" label="Search allowed pages" placeholder="Search pages..." value={search} onChange={setSearch} disabled={disabled} showKeyboardHint={false} />
      <Button variant="fadeout" size="sm" active={selectedOnly} aria-pressed={selectedOnly} disabled={disabled} onClick={() => setSelectedOnly(current => !current)}>Selected only</Button>
    </div>
    <div className="permission-picker-options">
      {visible.map(([key, label]) => <label className={`ws-check permission-picker-option ${selected.has(key) ? 'is-selected' : ''}`} key={key}>
        <input type="checkbox" checked={selected.has(key)} disabled={disabled || !onChange} onChange={event => onChange?.(event.target.checked ? [...new Set([...value, key])] : value.filter(item => item !== key))} />
        <span>{label}</span>
      </label>)}
    </div>
    {!visible.length && <p className="permission-picker-empty" role="status">{selectedOnly ? 'No selected pages match this search.' : 'No pages match this search.'}</p>}
  </section>;
}
