import { ImageWithSkeleton } from '../ui/ImageWithSkeleton';
import React, { useEffect, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, RefreshCw, Users } from 'lucide-react';
import { profileImage } from '../../pages/employees/EmployeesPage/directoryData';
import { useAvatarImage } from '../../lib/avatarImage';
import './EmployeeDirectory.scss';
const fullName = person => [person.first_name, person.last_name].filter(Boolean).join(' ') || person.name || person.userid || 'Unnamed employee';
function Photo({ person }) {
  const [liveSrc, setLiveSrc] = useState(profileImage(person));
  const [failed, setFailed] = useState('');
  const imageSrc = useAvatarImage(liveSrc);

  useEffect(() => {
    setLiveSrc(profileImage(person));
    setFailed('');
  }, [person, person?.profile_pic_url]);

  useEffect(() => {
    const handleAvatarUpdate = (e) => {
      const { userid, profile_pic_url } = e.detail || {};
      const targetId = person?.userid || person?.user_id || person?.employee_code || person?.id;
      if (userid && targetId && (userid === targetId || userid === person?.username)) {
        setLiveSrc(profile_pic_url);
        setFailed('');
      }
    };
    window.addEventListener('pulse-avatar-updated', handleAvatarUpdate);
    return () => window.removeEventListener('pulse-avatar-updated', handleAvatarUpdate);
  }, [person]);

  return imageSrc && imageSrc !== failed ? (
    <ImageWithSkeleton className="employee-directory-avatar" src={imageSrc} alt="" width={40} height={40} shape="circle" onError={() => setFailed(imageSrc)} />
  ) : (
    <span className="employee-directory-avatar" aria-hidden="true">
      {fullName(person).split(/\s+/).slice(0, 2).map(part => part[0]).join('')}
    </span>
  );
}
/** Shared controlled directory. Parents own filters, fetching and selected-person data. */
export function EmployeeDirectory({ employees = [], totalCount = employees.length, selectedId, onSelect, getStatus, loading = false, error = '', onRefresh, toolbar = null, headerAction = null, subtitle = 'Select a person to open their complete dossier.', pageSize = 12, multi = false, selectedIds = [], onToggle, onSelectAll, onClearAll, renderMeta, headerExtra = null }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const departments = [...new Set(employees.map(person => person.department).filter(Boolean))].sort();
  const filtered = toolbar ? employees : employees.filter(person =>
    (!department || person.department === department) &&
    [fullName(person), person.userid, person.department, person.designation].join(' ').toLowerCase().includes(search.trim().toLowerCase()));
  const ids = filtered.map(person => person.userid).join('|');
  useEffect(() => { setPage(1); }, [ids]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  return <aside className="employee-directory" aria-label="Employee Directory" aria-busy={loading}>
    <header><div><h2>Employee Directory <span title={`${totalCount} employees`}>{loading || error ? '-' : totalCount > 99 ? '99+' : totalCount}</span></h2><p>{subtitle}</p></div>{headerAction}</header>
    {headerExtra && <div className="employee-directory-extra">{headerExtra}</div>}
    <div className="employee-directory-tools">{toolbar || <>
      <input aria-label="Search employees" placeholder="Search name, ID, department" value={search} onChange={event => setSearch(event.target.value)} />
      <select aria-label="Filter employees by department" value={department} onChange={event => setDepartment(event.target.value)}><option value="">All departments</option>{departments.map(value => <option key={value} value={value}>{value}</option>)}</select>
      {(search || department) && <button type="button" onClick={() => { setSearch(''); setDepartment(''); }}>Clear filters</button>}
    </>}</div>
    {multi && <div className="employee-directory-bulk"><span>{selectedIds.length} selected</span><button type="button" disabled={loading || !!error || !filtered.length} onClick={() => onSelectAll?.(filtered.map(person => person.userid))}>Select all {filtered.length}</button><button type="button" onClick={onClearAll}>Clear selection</button></div>}
    <div className="employee-directory-count"><span aria-live="polite">{loading ? 'Loading people...' : error ? 'Directory unavailable' : `${filtered.length} employees`}</span>{onRefresh && <button aria-label="Refresh directory" disabled={loading} onClick={onRefresh}><RefreshCw size={14} /></button>}</div>
    {loading ? <div className="employee-directory-empty" role="status">Loading employee records...</div> : error ? <div className="employee-directory-empty" role="alert">{error}{onRefresh && <button onClick={onRefresh}>Try again</button>}</div> : !filtered.length ? <div className="employee-directory-empty"><Users size={24} />No employees match this selection.</div> : <div className="employee-directory-cards">{visible.map(person => {
      const status = getStatus?.(person);
      const selected = multi ? selectedIds.includes(person.userid) : selectedId === person.userid;
      return <button className={`employee-directory-card ${selected ? 'is-selected' : ''}`} key={person.userid || person.id} aria-pressed={selected} type="button" onClick={() => multi ? onToggle?.(person.userid) : onSelect?.(person)}>{multi && <span className="employee-directory-check" aria-hidden="true">{selected && <Check size={12} />}</span>}<Photo person={person} /><span className="employee-directory-person"><strong>{fullName(person)}</strong><small>{person.designation || 'Job title not provided'}</small><span>{person.userid} / {person.department || 'Department not provided'}</span>{status && <span className={`employee-directory-status ${status === 'Active' ? 'is-active' : ''}`}>{status}</span>}{renderMeta && <span className="employee-directory-meta">{renderMeta(person)}</span>}</span><ChevronRight size={15} /></button>;
    })}</div>}
    {!loading && !error && filtered.length > 0 && <footer><span>{(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}</span><div><button aria-label="Previous directory page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={15} /></button><span>{currentPage} / {pages}</span><button aria-label="Next directory page" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}><ChevronRight size={15} /></button></div></footer>}
  </aside>;
}
