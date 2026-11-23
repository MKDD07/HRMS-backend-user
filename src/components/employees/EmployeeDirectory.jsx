import { SectionSkeleton } from '../ui/SectionSkeleton';
import { createPortal } from 'react-dom';
import { ImageWithSkeleton } from "../ui/ImageWithSkeleton";
import React, { useContext, useEffect, useState, useId } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Users,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { profileImage } from "../../pages/employees/EmployeesPage/directoryData";
import { useAvatarImageState } from "../../lib/avatarImage";
import { Button } from "../ui/Button";
import { UniversalSearch } from '../ui/UniversalSearch';
import { TenantPanelHeader } from '../ui/TenantPanel';
import { WorkspaceNavigationContext } from '../layout/WorkspaceNavigationContext';
import { canUsePage } from '../../../shared/dashboardAccess.mjs';
import "./EmployeeDirectory.scss";
const flattenControls = (node) =>
  React.Children.toArray(node).flatMap((child) =>
    React.isValidElement(child) && child.type === React.Fragment
      ? flattenControls(child.props.children)
      : [child]
  );
const fullName = (person) =>
  [person.first_name, person.last_name].filter(Boolean).join(" ") ||
  person.name ||
  person.userid ||
  "Unnamed employee";
const personId = person => person.userid ?? person.user_id ?? person.id ?? person.employee_code;

export function EmployeeDirectoryPhoto({ person, size = 40 }) {
  const [liveSrc, setLiveSrc] = useState(profileImage(person));
  const [failed, setFailed] = useState("");
  const { url: imageSrc, loading: photoLoading } = useAvatarImageState(liveSrc);

  useEffect(() => {
    setLiveSrc(profileImage(person));
    setFailed("");
  }, [person, person?.profile_pic_url]);

  useEffect(() => {
    const handleAvatarUpdate = (e) => {
      const { userid, profile_pic_url } = e.detail || {};
      const targetId =
        person?.userid ||
        person?.user_id ||
        person?.employee_code ||
        person?.id;
      if (
        userid &&
        targetId &&
        (userid === targetId || userid === person?.username)
      ) {
        setLiveSrc(profile_pic_url);
        setFailed("");
      }
    };
    window.addEventListener("pulse-avatar-updated", handleAvatarUpdate);
    return () =>
      window.removeEventListener("pulse-avatar-updated", handleAvatarUpdate);
  }, [person]);

  return photoLoading || (imageSrc && imageSrc !== failed) ? (
    <ImageWithSkeleton
      className="employee-directory-avatar"
      src={imageSrc}
      loading={photoLoading}
      alt=""
      width={size}
      height={size}
      shape="circle"
      onError={() => setFailed(imageSrc)}
    />
  ) : (
    <span className="employee-directory-avatar" aria-hidden="true">
      {fullName(person)
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")}
    </span>
  );
}
/** Shared controlled directory. Parents own filters, fetching and selected-person data. */
export function EmployeeDirectory({
  employees = [],
  totalCount = employees.length,
  selectedId,
  onSelect,
  getStatus,
  loading = false,
  error = "",
  onRefresh,
  onOpenDirectory,
  toolbar = null,
  headerAction = null,
  hideHeader = false,
  controlsContainer = null,
  controlsInHeader = false,
  searchOnly = false,
  headerTitle = 'Employee Directory',
  headerSubtitle,
  subtitle = "Select a person to open their complete dossier.",
  pageSize = 12,
  multi = false,
  selectedIds = [],
  onToggle,
  onSelectAll,
  onClearAll,
  renderMeta,
  headerExtra = null,
  variant = "soft",
  className = "",
  picker = false,
  hideSearch = false,
  searchValue,
  renderActions,
  actionsPlacement = "footer",
  getCardProps,
}) {
  const navigation = useContext(WorkspaceNavigationContext);
  const openDirectory = onOpenDirectory || (navigation?.onNavigate && canUsePage(navigation.currentUser, 'employees') ? () => navigation.onNavigate('employees') : null);
  const limit = picker ? 3 : Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 12;
  const canSelect = multi ? typeof onToggle === "function" : typeof onSelect === "function";
  const Row = canSelect ? "button" : "div";
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersId = useId();
  const [localSearch, setSearch] = useState("");
  const search = searchValue ?? localSearch;
  const [department, setDepartment] = useState("");
  const departments = [
    ...new Set(employees.map((person) => person.department).filter(Boolean)),
  ].sort();
  const filtered = picker && !search.trim() ? [] : toolbar
    ? employees
    : employees.filter(
        (person) =>
          (!department || person.department === department) &&
          [
            fullName(person),
            person.userid,
            person.employee_code,
            person.email,
            person.department,
            person.designation,
          ]
            .join(" ")
            .toLowerCase()
            .includes(search.trim().toLowerCase())
      );
  const ids = filtered.map(personId).join("|");
  useEffect(() => {
    setPage(1);
  }, [ids]);
  const pages = Math.max(1, Math.ceil(filtered.length / limit));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice(
    (currentPage - 1) * limit,
    currentPage * limit
  );
  const design = ["list", "soft", "grid"].includes(variant) ? variant : "soft";
  const inlineActions = actionsPlacement === "inline" && design !== "grid";
  const filterCount = toolbar
    ? flattenControls(toolbar).filter(child => React.isValidElement(child) && child.type === "select" && child.props.value).length
    : Number(Boolean(department));
  const description = headerSubtitle ?? (canSelect ? subtitle : undefined);
  const countLabel = `${filtered.length === totalCount ? totalCount : `${filtered.length} of ${totalCount}`} ${totalCount === 1 ? "employee" : "employees"}`;
  const searchControls = hideSearch ? null : (<div className="employee-directory-search-line">
          {toolbar ? (
            flattenControls(toolbar)
              .filter(
                (child) => React.isValidElement(child) && child.type === "input"
              )
              .map((child, index) => {
                const { onChange, value, "aria-label": searchLabel = "Search employees", placeholder = "Search employees...", ...props } = child.props;
                return <UniversalSearch {...props} key={child.key || index} id={`search-outlined-${filtersId}-${index}`} className="employee-directory-universal-search" scope="employee-directory" variant="outlined" value={value || ''}
                  onChange={(next, event) => onChange?.(event || { target: { value: next }, currentTarget: { value: next } })}
                  label={searchLabel} placeholder={placeholder} icon={Search} shortcut="k" showKeyboardHint={false} />;
              })
          ) : (
            <UniversalSearch
              id={`search-outlined-${filtersId}`} className="employee-directory-universal-search" scope="employee-directory" variant="outlined"
              label={picker ? "Search people or teams" : "Search employees"}
              placeholder={picker ? "Type a name or team..." : "Search employees..."}
              autoFocus={picker}
              value={search}
              onChange={setSearch} icon={Search} shortcut={picker ? undefined : "k"} showKeyboardHint={false}
            />
          )}
        {!searchOnly && <Button
          variant="fadeout"
          iconOnly
          icon={SlidersHorizontal}
          aria-label={`Toggle directory filters${filterCount ? ` (${filterCount} active)` : ""}`}
          aria-controls={filtersId}
          title={filterCount ? `${filterCount} active filters` : "Filters"}
          aria-expanded={filtersOpen}
          active={filtersOpen || filterCount > 0}
          onClick={() => setFiltersOpen((open) => !open)}
        />}
      </div>);
  const headerSummary = <div className="employee-directory-header-summary" aria-live="polite" aria-label={loading || error ? undefined : countLabel}>{loading ? <span className="skeleton directory-skeleton-count" aria-label="Loading employee total" /> : error ? <span>Unavailable</span> : <><strong>{filtered.length === totalCount ? totalCount : `${filtered.length} / ${totalCount}`}</strong><span>{totalCount === 1 ? 'employee' : 'employees'}</span></>}</div>;
  return (
    <aside
      className={`card employee-directory employee-directory--${design} ${controlsInHeader ? "employee-directory--header-controls" : ""} ${inlineActions ? "employee-directory--inline-actions" : ""} ${picker ? "employee-directory--picker" : ""} ${className}`.trim()}
      aria-label={typeof headerTitle === "string" ? headerTitle : "Employee Directory"}
      aria-busy={loading}
    >
      {controlsInHeader ? <TenantPanelHeader title={headerTitle} icon={Users} subtitle={description} controls={<>{!searchOnly && headerSummary}{headerAction}{searchControls}</>} /> : !hideHeader && <TenantPanelHeader
        icon={Users} title={headerTitle}
        subtitle={description}
        controls={<>{!searchOnly && headerSummary}{headerAction}{openDirectory && navigation?.activePage !== 'employees' && <Button className="employee-directory-open" variant="outline" viewAll aria-label="Open Employee Directory" title="Open Employee Directory" onClick={openDirectory} />}</>}
      />}
      {loading && <span className="sr-only" role="status">Loading employee directory</span>}
      {headerExtra && (
        <div className="employee-directory-extra">{headerExtra}</div>
      )}
      {!controlsInHeader && (controlsContainer ? createPortal(searchControls, controlsContainer) : searchControls)}
      {!searchOnly && !loading && filtersOpen && (
        <div className="employee-directory-inline-filters" id={filtersId}>
          <div className="employee-filter-controls">
            {toolbar ? (
              flattenControls(toolbar)
                .filter(
                  (child) =>
                    !(React.isValidElement(child) && child.type === "input")
                )
                .map((child, index) =>
                  React.isValidElement(child) && child.type === "select" ? (
                    <label key={child.key || index}>
                      <span>
                        {child.props["aria-label"]?.replace(
                          /^Filter (employees by )?/,
                          ""
                        ) || "Filter"}
                      </span>
                      {child}
                    </label>
                  ) : (
                    child
                  )
                )
            ) : (
              <>
                <label>
                  <span>Department</span>
                  <select
                    aria-label="Filter employees by department"
                    value={department}
                    onChange={(event) => setDepartment(event.target.value)}
                  >
                    <option value="">All departments</option>
                    {departments.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                {(search || department) && (
                  <Button
                    size="sm"
                    variant="fadeout"
                    onClick={() => {
                      setSearch("");
                      setDepartment("");
                    }}
                  >
                    Reset
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      )}
      {multi && !picker && (
        <div className="employee-directory-bulk">
          <span>{selectedIds.length} selected</span>
          <Button
            size="sm"
            variant="fadeout"
            disabled={loading || !!error || !filtered.length || !onSelectAll}
            onClick={() =>
              onSelectAll?.(filtered.map(personId))
            }
          >
            Select all
          </Button>
          <Button size="sm" variant="fadeout" disabled={!onClearAll || !selectedIds.length} onClick={onClearAll}>
            Clear selection
          </Button>
        </div>
      )}
      {hideHeader && !controlsInHeader && !picker && headerSummary}
      <SectionSkeleton className="employee-directory-list" loading={loading}>{loading ? (
        <div
          className="employee-directory-cards"
          aria-label="Loading employee directory"
        >
          {Array.from({
            length: Math.max(1,Math.min(12,limit,totalCount>0?totalCount:12)),
          }).map((_, i) => (
            <div key={i} className={'employee-directory-entry' + (design === "grid" ? " card" : "")} aria-hidden="true"><div className="employee-directory-card-skeleton">{multi && <span className="skeleton directory-skeleton-checkbox"/>}
              <span className="directory-skeleton-photo"><div className="employee-directory-card-skeleton__avatar" />{getStatus && <span className="skeleton directory-skeleton-presence"/>}</span>
              <div className="employee-directory-card-skeleton__body">
                <div className="employee-directory-card-skeleton__name" />
                <div className="employee-directory-card-skeleton__role" />
                {renderMeta && <div className="employee-directory-card-skeleton__meta" />}
              </div><span className="skeleton directory-skeleton-chevron"/>
            </div>{renderActions&&<div className="employee-directory-entry-actions"><span className="skeleton directory-skeleton-action"/></div>}</div>
          ))}
        </div>
      ) : error ? (
        <div className="employee-directory-empty" role="alert">
          {error}
          {onRefresh && (
            <Button size="sm" variant="outline" onClick={onRefresh}>
              Try again
            </Button>
          )}
        </div>
      ) : !filtered.length ? (
        <div className="employee-directory-empty">
          <Users size={24} />
          {picker ? search.trim() ? "No matches. Try another name or team." : "Type to find a colleague or team." : "No employees match this selection."}
        </div>
      ) : (
        <div className="employee-directory-cards" role="list" aria-label="Employees">
          {visible.map((person) => {
            const status = getStatus?.(person);
            const selected = multi
              ? selectedIds.includes(personId(person))
              : selectedId != null && selectedId === personId(person);
            const subInfo = picker ? "" : [person.designation, person.department]
              .filter(Boolean)
              .join(" · ");
            const { className: entryClass = "", ...entryProps } = getCardProps?.(person) || {};
            return (
              <div
                className={`employee-directory-entry${person.plan_locked ? " is-plan-locked" : ""}${design === "grid" ? " card" : ""} ${entryClass}`.trim()}
                key={personId(person)}
                {...entryProps}
                role="listitem"
              >
                <Row
                  className={`employee-directory-card ${
                    selected ? "is-selected" : ""
                  }`.trim()}
                  disabled={canSelect && Boolean(person.plan_locked)}
                  title={person.plan_locked ? "Outside current plan capacity" : undefined}
                  aria-pressed={canSelect ? selected : undefined}
                  type={canSelect ? "button" : undefined}
                  onClick={canSelect ? () =>
                    multi ? onToggle(personId(person)) : onSelect(person)
                  : undefined}
                >
                  {multi && (
                    <span
                      className="employee-directory-check"
                      aria-hidden="true"
                    >
                      {selected && <Check size={12} />}
                    </span>
                  )}
                  <span className="employee-directory-photo">
                    <EmployeeDirectoryPhoto person={person} size={picker ? 28 : design === "grid" ? 44 : 40} />
                    {status && (
                      <span
                        className={`employee-directory-presence ${
                          status === "Active"
                            ? "is-active"
                            : status === "Not punched in" ||
                              status === "Punched out"
                            ? "is-away"
                            : "is-unknown"
                        }`}
                        role="img"
                        aria-label={status}
                        title={status}
                      />
                    )}
                  </span>
                  <span className="employee-directory-person">
                    <strong>{fullName(person)}</strong>
                    {subInfo && <small title={subInfo}>{subInfo}</small>}
                    {renderMeta && (
                      <span className="employee-directory-meta">
                        {renderMeta(person)}
                      </span>
                    )}
                  </span>
                  {canSelect && !picker && !(inlineActions && renderActions) && <ChevronRight size={16} aria-hidden="true" />}
                </Row>
                {renderActions && !person.plan_locked && (
                  <div className="employee-directory-entry-actions">
                    {renderActions(person)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}</SectionSkeleton>
      {loading&&<footer aria-hidden="true"><span className="skeleton directory-skeleton-count"/><div><span className="skeleton directory-skeleton-control"/><span className="skeleton directory-skeleton-count"/><span className="skeleton directory-skeleton-control"/></div></footer>}
      {!picker && !loading && !error && filtered.length > 0 && (
        <footer>
          <span>
            {(currentPage - 1) * limit + 1}–
            {Math.min(currentPage * limit, filtered.length)} of{" "}
            {filtered.length}
          </span>
          <div>
            <Button
              size="sm"
              variant="outline"
              iconOnly
              icon={ChevronLeft}
              aria-label="Previous directory page"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            />
            <span>
              {currentPage} / {pages}
            </span>
            <Button
              size="sm"
              variant="outline"
              iconOnly
              icon={ChevronRight}
              aria-label="Next directory page"
              disabled={currentPage === pages}
              onClick={() => setPage(currentPage + 1)}
            />
          </div>
        </footer>
      )}
    </aside>
  );
}
