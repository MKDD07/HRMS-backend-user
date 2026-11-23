import React from 'react';
import { UniversalSearch } from './UniversalSearch';
import { Button } from './Button';
import './WorkspaceFilters.scss';

/** Controlled filters shared by workplace lists and reports. */
export function WorkspaceFilters({ search, onSearch, searchLabel = 'Search records', status = '', onStatus, statuses = [], allStatus = '', onReset, active = false, disabled = false, children }) {
  return <div className="workspace-filters" role="group" aria-label="Record filters">
    {onSearch && <UniversalSearch className="workspace-filters__search" variant="filled" label={searchLabel} value={search} disabled={disabled} onChange={onSearch} />}
    {onStatus && <label><span className="workspace-filters__label">Status</span><select aria-label="Filter by status" value={status} disabled={disabled} onChange={event => onStatus(event.target.value)}><option value={allStatus}>All statuses</option>{statuses.map(value => <option key={value} value={value}>{value}</option>)}</select></label>}
    {children}
    {onReset && <Button variant="outline" size="sm" disabled={disabled || !active} onClick={onReset}>Clear filters</Button>}
  </div>;
}
