import { SectionSkeleton } from '../../components/ui/SectionSkeleton';
import { MetricOverview, MetricCard } from '../../components/ui/MetricOverview';
import { MultiSelect } from '../../components/ui/MultiSelect';
import { Toggle } from '../../components/ui/Toggle';
import { ViewTabs } from '../../components/ui/ViewTabs';
import { Card } from '../../components/ui/Card';
import { TenantPanelHeader } from '../../components/ui/TenantPanel';
import { TenantHeader } from '../../components/ui/TenantHeader';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Download, ExternalLink, Plus, RefreshCw, Save, Trash2, Upload, Users, Check, Sparkles, Shield, Search, Globe, Key, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { HolidayLegend, detectHolidayCategory, HOLIDAY_CATEGORY_CONFIG } from '../../components/ui/UniversalCalendar';
import { BarChart, Bar, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EmployeeDirectory } from '../../components/employees/EmployeeDirectory';
import { companyCalendarApi } from '../../lib/companyCalendarApi';
import { accruedBalance, emptyLeaveType, eligibleFor, holidaysToIcs, icsToHolidays, PROFESSIONAL_LEAVE_PRESETS, presetLeaveType } from '../../lib/leavePolicy';
import { shortCodeOf } from '../leave/leaveCalendarData';
import { HolidayCalendar } from './HolidayCalendar';
import { HolidayEditorPopover } from './HolidayEditorPopover';
import './CompanyCalendarPage.scss';
import './CompanyCalendarHolidays.scss';
import './CompanyCalendarPolicies.scss';
import './CompanyCalendarTheme.scss';

const CALENDARIFIC_COUNTRIES = [
  { code: 'IN', name: 'India' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'SG', name: 'Singapore' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'JP', name: 'Japan' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'PH', name: 'Philippines' }
];

const CALENDARIFIC_MONTHS = [
  { value: '', label: 'All Months (Full Year)' },
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { code: '10', value: '10', label: 'October' },
  { code: '11', value: '11', label: 'November' },
  { code: '12', value: '12', label: 'December' }
];

const LEAVE_TYPE_COLORS = ['var(--color-primary)', 'var(--color-text-secondary)', 'var(--color-text-muted)', 'var(--color-primary-light)'];

function MatrixChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="cc-matrix-chart-tooltip">
      <div className="cc-matrix-chart-tooltip-header">
        <span className="cc-matrix-chart-tooltip-badge" style={{ background: item.color || 'var(--color-primary)' }}>
          {item.code}
        </span>
        <strong>{item.name}</strong>
      </div>
      <div className="cc-matrix-chart-tooltip-body">
        <span>Initial allocation</span>
        <b>{item.days} days</b>
      </div>
    </div>
  );
}

const emptyHoliday = () => ({ name: '', holiday_date: '', type: '', optional_note: '', active: true });
const INDIAN_HOLIDAY_TYPES = [
  'National Holiday',
  'Gazetted Holiday',
  'Restricted Holiday',
  'State Holiday',
  'Regional Holiday',
  'Religious Holiday',
  'Bank Holiday',
  'Company Holiday',
  'Optional Holiday'
];
const nameOf = person => [person?.first_name, person?.last_name].filter(Boolean).join(' ') || person?.name || person?.userid || 'Employee';
const dateKey = date => {
  if (!date || isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export function CompanyCalendarPage({ api, onShowToast }) {
  const [tab, setTab] = useState('types');
  const [configuration, setConfiguration] = useState({ leaveTypes: [], holidays: [], groups: [], assignments: [] });
  const [people, setPeople] = useState([]);
  const [leaveType, setLeaveType] = useState(emptyLeaveType());
  const [holiday, setHoliday] = useState(emptyHoliday());
  const [holidayEditor, setHolidayEditor] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedIds, setSelectedIds] = useState([]);
  const [peopleSearch, setPeopleSearch] = useState('');
  const [group, setGroup] = useState({ name: '', description: '', active: true, leave_type_ids: [], assignment_mode: 'teams', teams: [], userids: [] });
  const [groupPeople, setGroupPeople] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [assignment, setAssignment] = useState({ mode: 'group', group_id: '', overrides: {} });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  // Calendarific API Integration State
  const [calendarificCountry, setCalendarificCountry] = useState('IN');
  const [calendarificYear, setCalendarificYear] = useState(() => String(new Date().getFullYear()));
  const [calendarificMonth, setCalendarificMonth] = useState('');
  const [calendarificType, setCalendarificType] = useState('');
  const [calendarificLoading, setCalendarificLoading] = useState(false);
  const [calendarificError, setCalendarificError] = useState('');
  const [calendarificHolidays, setCalendarificHolidays] = useState([]);
  const [selectedCalendarificHolidays, setSelectedCalendarificHolidays] = useState([]);
  const [calendarificPreviewMonth, setCalendarificPreviewMonth] = useState(() => new Date());

  const monthlyBreakdown = useMemo(() => {
    const counts = {};
    for (let m = 1; m <= 12; m++) counts[m] = 0;
    for (const h of calendarificHolidays) {
      if (h.holiday_date) {
        const m = parseInt(h.holiday_date.split('-')[1], 10);
        if (m >= 1 && m <= 12) counts[m] = (counts[m] || 0) + 1;
      }
    }
    return counts;
  }, [calendarificHolidays]);

  const groups = useMemo(() => [...new Set(people.flatMap(person => [person.employment_type, person.department, person.type]).filter(Boolean))].sort(), [people]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [config, users] = await Promise.all([
        companyCalendarApi.configuration(),
        api.getAllUsers({ liveOnly: true })
      ]);
      const validConfig = config || { leaveTypes: [], holidays: [], groups: [], assignments: [] };
      setConfiguration(validConfig);
      const userList = users?.data || [];
      setPeople(userList);
      setSelectedPerson(current => current && userList.some(u => u.userid === current.userid) ? current : (userList[0] || null));
    } catch (err) {
      setError(err.message || 'Unable to load company calendar configuration.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function run(action, message) {
    setBusy(true);
    setError('');
    try {
      await action();
      await load();
      onShowToast?.({ type: 'success', title: 'Company Calendar updated', message });
    } catch (err) {
      setError(err.message || 'Operation failed.');
    } finally {
      setBusy(false);
    }
  }

  const saveType = event => {
    event.preventDefault();
    run(async () => {
      const payload = {
        ...leaveType,
        userids: leaveType.eligibility_mode === 'people' ? selectedIds : (leaveType.userids || [])
      };
      const saved = await companyCalendarApi.saveLeaveType(payload);
      setLeaveType(saved);
    }, 'Leave type and eligibility rules saved.');
  };

  const saveHoliday = event => {
    event.preventDefault();
    if (!holiday.holiday_date) return;
    run(async () => {
      const saved = await companyCalendarApi.saveHoliday(holiday);
      setHoliday(saved);
      setHolidayEditor(null);
    }, 'Holiday saved.');
  };

  const exportIcs = () => {
    const list = (configuration.holidays || []).filter(item => item.active);
    if (!list.length) return;
    const blob = new Blob([holidaysToIcs(list)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'company-calendar.ics';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportIcs = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      const importedHolidays = icsToHolidays(content);
      if (!importedHolidays.length) {
        setError('No valid holiday events found in the .ics file.');
        return;
      }
      run(async () => {
        const existingList = configuration.holidays || [];
        for (const item of importedHolidays) {
          const match = existingList.find(h => h.holiday_date === item.holiday_date || (item.id && h.id === item.id));
          await companyCalendarApi.saveHoliday({
            ...item,
            id: match ? match.id : item.id
          });
        }
      }, `Imported ${importedHolidays.length} holiday${importedHolidays.length > 1 ? 's' : ''} from calendar file.`);
    } catch (err) {
      setError(err.message || 'Failed to parse .ics calendar file.');
    } finally {
      if (event.target) event.target.value = '';
    }
  };

  async function fetchCalendarificHolidays(e) {
    if (e) e.preventDefault();
    if (calendarificLoading) return;
    setCalendarificLoading(true);
    setCalendarificError('');
    try {
      const data = await companyCalendarApi.fetchHolidays({ country: calendarificCountry, year: calendarificYear });
      const typeMatchers = {
        national: /national|public|federal|bank/i,
        religious: /religious|christian|orthodox|muslim|hindu|buddhist|hebrew/i,
        observance: /observance/i,
        local: /local|regional|state/i
      };
      const list = data.holidays.filter(item => {
        if (calendarificMonth && Number(item.holiday_date.slice(5, 7)) !== Number(calendarificMonth)) return false;
        return !calendarificType || typeMatchers[calendarificType]?.test([item.type, ...(item.types || [])].join(' '));
      });
      setCalendarificHolidays(list);
      setSelectedCalendarificHolidays(list.map((_, i) => i));
      if (list.length && list[0].holiday_date) {
        setCalendarificPreviewMonth(new Date(`${list[0].holiday_date}T12:00:00`));
      } else if (calendarificMonth) {
        setCalendarificPreviewMonth(new Date(parseInt(calendarificYear, 10), parseInt(calendarificMonth, 10) - 1, 1));
      }
    } catch (err) {
      setCalendarificError(err.message || 'Error fetching holidays from Calendarific.');
    } finally {
      setCalendarificLoading(false);
    }
  }

  const importSelectedCalendarificHolidays = () => {
    const selectedItems = selectedCalendarificHolidays.map(idx => calendarificHolidays[idx]).filter(Boolean);
    if (!selectedItems.length) return;
    run(async () => {
      const existingList = configuration.holidays || [];
      for (const item of selectedItems) {
        const match = existingList.find(h => h.holiday_date === item.holiday_date || h.name.toLowerCase() === item.name.toLowerCase());
        await companyCalendarApi.saveHoliday({
          name: item.name,
          holiday_date: item.holiday_date,
          type: item.type || 'Company Holiday',
          optional_note: item.optional_note || '',
          active: true,
          id: match ? match.id : undefined
        });
      }
    }, `Imported ${selectedItems.length} holiday${selectedItems.length > 1 ? 's' : ''} from Calendarific.`);
  };

  const toggleList = (key, value) => {
    setLeaveType(current => ({
      ...current,
      [key]: (current[key] || []).includes(value)
        ? current[key].filter(item => item !== value)
        : [...(current[key] || []), value]
    }));
  };

  const toggleGroupList = (key, value) => {
    setGroup(current => ({
      ...current,
      [key]: (current[key] || []).includes(value)
        ? current[key].filter(item => item !== value)
        : [...(current[key] || []), value]
    }));
  };

  const matchingGroup = person => (configuration.groups || []).find(item =>
    item.active && (
      item.assignment_mode === 'people'
        ? (item.userids || []).includes(person?.userid)
        : (item.teams || []).some(value => [person?.employment_type, person?.department, person?.type].includes(value))
    )
  );

  useEffect(() => {
    if (!selectedPerson) return;
    const saved = (configuration.assignments || []).find(item => item.userid === selectedPerson.userid);
    const inferred = matchingGroup(selectedPerson);
    setAssignment(saved || { mode: 'group', group_id: inferred?.id || '', overrides: {} });
  }, [selectedPerson?.userid, configuration.assignments, configuration.groups]);

  const usePreset = preset => {
    setLeaveType(presetLeaveType(preset));
    setSelectedIds([]);
    document.querySelector('.cc-entitlement-builder')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const createCustomLeave = () => {
    setLeaveType(emptyLeaveType());
    setSelectedIds([]);
    document.querySelector('.cc-entitlement-builder')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const saveGroup = event => {
    event.preventDefault();
    run(async () => {
      const payload = {
        ...group,
        userids: group.assignment_mode === 'people' ? groupPeople : (group.userids || [])
      };
      const saved = await companyCalendarApi.saveGroup(payload);
      setGroup(saved);
    }, 'Leave policy group saved.');
  };

  const saveAssignment = event => {
    event.preventDefault();
    if (!selectedPerson) return;
    run(async () => {
      const saved = await companyCalendarApi.saveAssignment({ ...assignment, userid: selectedPerson.userid });
      setAssignment(saved);
    }, 'Employee leave assignment saved.');
  };

  const assignmentTypes = useMemo(() => {
    if (!selectedPerson) return [];
    const types = configuration.leaveTypes || [];
    if (assignment.mode === 'custom') {
      return types.map(type => ({
        ...type,
        ...((assignment.overrides || {})[type.id] || {}),
        source: 'Individual'
      }));
    }
    const policy = (configuration.groups || []).find(item => item.id === assignment.group_id) || matchingGroup(selectedPerson);
    const includedIds = policy?.leave_type_ids || [];
    return types
      .filter(type => includedIds.includes(type.id))
      .map(type => ({ ...type, source: policy?.name || 'No group' }));
  }, [selectedPerson, assignment, configuration]);

  const eligibleTypesForChart = useMemo(() => {
    if (!selectedPerson) return [];
    const allTypes = (configuration.leaveTypes || []).filter(t => t.active !== false);
    return allTypes.filter(type => {
      if (assignment.mode === 'custom') {
        const override = (assignment.overrides || {})[type.id];
        return override !== undefined ? override.enabled : eligibleFor(type, selectedPerson);
      }
      return assignmentTypes.some(t => t.id === type.id);
    }).map((type, index) => {
      const override = (assignment.overrides || {})[type.id] || {};
      const days = assignment.mode === 'custom' && override.initial_days !== undefined
        ? Number(override.initial_days)
        : Number(type.initial_days || 0);
      const color = /^#[0-9a-f]{6}$/i.test(type.color || '')
        ? type.color
        : LEAVE_TYPE_COLORS[index % LEAVE_TYPE_COLORS.length];
      return {
        name: type.name,
        code: shortCodeOf(type),
        days,
        color
      };
    });
  }, [selectedPerson, assignment, configuration, assignmentTypes]);

  const selectHolidayDate = date => {
    if (!date) return;
    const value = dateKey(date);
    const existing = (configuration.holidays || []).find(item => item.holiday_date === value);
    setHoliday(existing || { ...emptyHoliday(), holiday_date: value });
    setCalendarMonth(date);
  };

  const stats = [
    { label: 'Leave types', value: (configuration.leaveTypes || []).length, icon: CalendarDays, caption: 'Configured leave entitlements' },
    { label: 'Policy groups', value: (configuration.groups || []).length, icon: Shield, caption: 'Team & role bundle rules' },
    { label: 'Official holidays', value: (configuration.holidays || []).filter(h => h.active).length, icon: Sparkles, caption: `${new Date().getFullYear()} published days` },
    { label: 'Total employees', value: people.length, icon: Users, caption: 'Active people in directory' }
  ];

  return (
    <div className="company-calendar-page">
      <TenantHeader
        settings={{
          subheading: "GOVERNANCE / COMPANY CALENDAR",
          heading: "Company Calendar",
          paragraph: "Define leave entitlements, eligibility, accrual schedules and official holidays.",
          refresh: { label: "Refresh" },
          buttons: [
            { id: 'action1', label: "Import calendar (.ics)", variant: "outline" },
            { id: 'action2', label: "Export calendar (.ics)", variant: "colored" }
          ]
        }}
        actions={{
          refresh: { "icon": RefreshCw, "loading": loading, "onClick": load },
          action1: { "icon": Upload, "loading": busy, "onClick": () => fileInputRef.current?.click() },
          action2: { "icon": Download, "onClick": exportIcs, "disabled": !(configuration.holidays || []).length }
        }}
      />
      <input
            type="file"
            ref={fileInputRef}
            accept=".ics,text/calendar"
            style={{ display: 'none' }}
            onChange={handleImportIcs}
          />

      {error && (
        <div className="cc-error" role="alert">
          <span>{error}</span>
          <Button size="sm" variant="outline" type="button" onClick={load}>Retry</Button>
        </div>
      )}

      <MetricOverview loading={loading} aria-label="Company calendar overview">
        {stats.map(({ label, value, icon: Icon, caption }) => (
          <MetricCard key={label} loading={loading} label={<><div>{label}</div></>} icon={Icon} value={loading ? '—' : value.toLocaleString()} caption={caption} />
        ))}
      </MetricOverview>

      <ViewTabs label="Company Calendar views" value={tab} onChange={setTab} tabs={[{id:'types',label:'Leave types',count:configuration.leaveTypes.length},{id:'eligibility',label:'Eligibility preview',count:people.length},{id:'holidays',label:'Holidays',count:configuration.holidays.length},{id:'sync',label:'Import holidays'}]}/>

      <SectionSkeleton loading={loading}>{loading ? (
        <div className="cc-empty">
          <RefreshCw size={24} className="cc-spin" />
          <p>Loading Company Calendar configuration...</p>
        </div>
      ) : (
        <div className={['cc-workspace', tab === 'types' && 'cc-leave-workspace', !['types', 'eligibility'].includes(tab) && 'is-full', tab === 'holidays' && 'is-holidays'].filter(Boolean).join(' ')}>
          <main>
            {tab === 'types' && (
              <>


                <Card className="tenant-panel cc-panel">
                  <TenantPanelHeader title={<>Leave library</>} subtitle={<>Choose a policy to view or edit.</>} actions={[{id:'action0',label:<>

                      Custom leave
                    </>,icon:Plus,onClick:createCustomLeave}]}/>
                  <div className="cc-type-grid">
                    {(configuration.leaveTypes || []).length ? (
                      configuration.leaveTypes.map(item => (
                        <Button wrapContent={false} size="sm" variant={leaveType.id === item.id ? "colored" : "fadeout"} key={item.id} type="button" style={{
  '--cc-policy-color': /^#[0-9a-f]{6}$/i.test(item.color || '') ? item.color : 'var(--color-primary)'
}} className={['cc-selection', leaveType.id === item.id ? 'is-selected' : ''].filter(Boolean).join(' ')} onClick={() => {
  setLeaveType(item);
  setSelectedIds(item.userids || []);
}}>

                          <span>
                            <strong>{item.name}</strong>
                            <small><i className={item.active ? 'cc-policy-active-dot' : 'cc-policy-off-dot'} aria-hidden="true" />{item.code} · {item.active ? 'Active' : 'Off'}</small>
                          </span>
                          <em><b>{accruedBalance(item)}</b><span>days</span></em>
                        </Button>
                      ))
                    ) : (
                      <p className="cc-empty-inline">No leave types saved. Choose a preset or create a custom type.</p>
                    )}
                  </div>
                </Card>

                <Card className="tenant-panel cc-panel cc-entitlement-builder">
                  <TenantPanelHeader title={<>{leaveType.id ? `Edit ${leaveType.name}` : 'Create leave type'}</>} subtitle={<>Manage allowance, eligibility and accrual.</>} controls={
                    <select className="cc-template-select" aria-label="Choose leave template" value={leaveType.id?'':PROFESSIONAL_LEAVE_PRESETS.some(preset=>preset.code===leaveType.code)?leaveType.code:''} disabled={busy} onChange={e=>{const preset=PROFESSIONAL_LEAVE_PRESETS.find(item=>item.code===e.target.value);if(preset)usePreset(preset);}}>
                      <option value="">Choose template</option>
                      {PROFESSIONAL_LEAVE_PRESETS.filter(preset=>!configuration.leaveTypes.some(item=>String(item.code||'').trim().toUpperCase()===String(preset.code).toUpperCase()||String(item.name||'').trim().toLowerCase()===preset.name.toLowerCase())).map(preset=><option key={preset.code} value={preset.code}>{preset.name}</option>)}
                    </select>
                  }/>
                  <form onSubmit={saveType}>
                    <fieldset disabled={busy}>
                      <section className="cc-builder-section" aria-labelledby="cc-type-details">
                        <div className="cc-builder-section-head"><h3 id="cc-type-details">Policy details</h3><p>Name, appearance and eligible employees.</p></div>
                      <div className="cc-form-grid">
                        <label>
                          Leave name
                          <input
                            required
                            value={leaveType.name}
                            onChange={e => setLeaveType({ ...leaveType, name: e.target.value })}
                            placeholder="Earned Leave"
                          />
                        </label>
                        <label>
                          Short code
                          <input
                            required
                            maxLength={20}
                            value={leaveType.code}
                            onChange={e => setLeaveType({ ...leaveType, code: e.target.value.toUpperCase() })}
                            placeholder="EL"
                          />
                        </label>
                        <label className="cc-color-field">
                          <span>Color tag</span>
                          <div className="cc-color-picker-wrap">
                            <input
                              type="color"
                              className="cc-color-picker-input"
                              value={leaveType.color || '#66864f'}
                              onChange={e => setLeaveType({ ...leaveType, color: e.target.value })}
                              title="Select policy color"
                              aria-label="Select policy color"
                            />
                          </div>
                        </label>
                        <label>
                          Eligibility mode
                          <select
                            value={leaveType.eligibility_mode}
                            onChange={e => setLeaveType({ ...leaveType, eligibility_mode: e.target.value })}
                          >
                            <option value="all">Everyone in company</option>
                            <option value="gender">Gender specific</option>
                            <option value="groups">Group / Department specific</option>
                            <option value="people">Specific employees</option>
                          </select>
                        </label>
                        <label className="cc-wide">
                          Description
                          <textarea
                            rows={2}
                            maxLength={500}
                            value={leaveType.description}
                            onChange={e => setLeaveType({ ...leaveType, description: e.target.value })}
                            placeholder="Describe purpose and guidelines for this leave..."
                          />
                        </label>
                      </div>

                      {leaveType.eligibility_mode === 'gender' && (
                        <div className="cc-options">
                          <strong>Eligible genders</strong>
                          {['Female', 'Male', 'Other'].map(value => (
                            <label key={value}>
                              <input
                                type="checkbox"
                                checked={(leaveType.genders || []).includes(value)}
                                onChange={() => toggleList('genders', value)}
                              />
                              {value}
                            </label>
                          ))}
                        </div>
                      )}

                      {leaveType.eligibility_mode === 'groups' && (
                        <div className="cc-options">
                          <strong>Eligible teams / departments</strong>
                          {groups.map(value => (
                            <label key={value}>
                              <input
                                type="checkbox"
                                checked={(leaveType.groups || []).includes(value)}
                                onChange={() => toggleList('groups', value)}
                              />
                              {value}
                            </label>
                          ))}
                        </div>
                      )}

                      {leaveType.eligibility_mode === 'people' && (
                        <div className="cc-people-selector">
                          <div className="cc-people-selector-header">
                            <strong>Eligible employees ({selectedIds.length} selected)</strong>
                            <div className="cc-people-search-wrap">
                              <Search size={13} />
                              <input
                                type="text"
                                placeholder="Search employees..."
                                value={peopleSearch}
                                onChange={e => setPeopleSearch(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="cc-people-checklist">
                            {people
                              .filter(p => !peopleSearch.trim() || nameOf(p).toLowerCase().includes(peopleSearch.toLowerCase()) || p.userid?.toLowerCase().includes(peopleSearch.toLowerCase()))
                              .map(person => {
                                const checked = selectedIds.includes(person.userid);
                                return (
                                  <label key={person.userid} className={checked ? 'is-selected' : ''}>
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => setSelectedIds(ids => ids.includes(person.userid) ? ids.filter(id => id !== person.userid) : [...ids, person.userid])}
                                    />
                                    <span>{nameOf(person)}</span>
                                    <small>{person.department}</small>
                                  </label>
                                );
                              })}
                          </div>
                        </div>
                      )}

                      </section>
                      <section className="cc-builder-section" aria-labelledby="cc-type-allowance">
                        <div className="cc-builder-section-head"><h3 id="cc-type-allowance">Allowance & effective dates</h3><p>Set the starting balance and how leave builds over time.</p></div>
                      <div className="cc-rule-grid">
                        <label>
                          Initial allocation
                          <input
                            type="number"
                            min="0"
                            step=".25"
                            value={leaveType.initial_days}
                            onChange={e => setLeaveType({ ...leaveType, initial_days: e.target.value })}
                          />
                          <small>Days granted upfront</small>
                        </label>
                        <label>
                          Increment frequency
                          <select
                            value={leaveType.accrual_frequency}
                            onChange={e => setLeaveType({ ...leaveType, accrual_frequency: e.target.value })}
                          >
                            <option value="none">No increment</option>
                            <option value="monthly">Every month</option>
                            <option value="quarterly">Every quarter</option>
                            <option value="yearly">Every year</option>
                          </select>
                        </label>
                        <label>
                          Increment value
                          <input
                            type="number"
                            min="0"
                            step=".25"
                            disabled={leaveType.accrual_frequency === 'none'}
                            value={leaveType.accrual_amount}
                            onChange={e => setLeaveType({ ...leaveType, accrual_amount: e.target.value })}
                          />
                          <small>Accrued per frequency period</small>
                        </label>
                        <label>
                          Maximum balance cap
                          <input
                            type="number"
                            min="0"
                            step=".25"
                            value={leaveType.max_balance}
                            onChange={e => setLeaveType({ ...leaveType, max_balance: e.target.value })}
                          />
                          <small>0 for unlimited</small>
                        </label>
                        <label>
                          Accrual starts
                          <input
                            type="date"
                            value={leaveType.accrual_start_date}
                            onChange={e => setLeaveType({ ...leaveType, accrual_start_date: e.target.value })}
                          />
                        </label>
                        <label>
                          Effective from
                          <input
                            type="date"
                            value={leaveType.effective_from}
                            onChange={e => setLeaveType({ ...leaveType, effective_from: e.target.value })}
                          />
                        </label>
                        <label>
                          Effective until
                          <input
                            type="date"
                            value={leaveType.effective_to}
                            onChange={e => setLeaveType({ ...leaveType, effective_to: e.target.value })}
                          />
                        </label>
                        <div className="cc-balance">
                          <span>Balance today<small>Based on this policy's allocation and accrual</small></span>
                          <strong>{accruedBalance(leaveType)} days</strong>
                        </div>
                      </div>
                      </section>

                      <section className="cc-builder-section" aria-labelledby="cc-type-options">
                        <div className="cc-builder-section-head"><h3 id="cc-type-options">Request options</h3></div>
                      <div className="cc-builder-options">
                        <div><label htmlFor="cc-carry-forward">Carry forward<small>Keep unused leave for the next cycle.</small></label><Toggle id="cc-carry-forward" checked={leaveType.carry_forward} disabled={busy} onChange={checked => setLeaveType({ ...leaveType, carry_forward: checked })} /></div>
                        <div><label htmlFor="cc-half-day">Half day requests<small>Allow employees to request half a day.</small></label><Toggle id="cc-half-day" checked={leaveType.allow_half_day} disabled={busy} onChange={checked => setLeaveType({ ...leaveType, allow_half_day: checked })} /></div>
                      </div>
                      </section>

                      <footer>
                        <div className="cc-builder-status"><label htmlFor="cc-type-active">{leaveType.active ? 'Policy active' : 'Policy disabled'}</label><Toggle id="cc-type-active" checked={leaveType.active} disabled={busy} onChange={checked => setLeaveType({ ...leaveType, active: checked })} /></div>
                        {leaveType.id && (
                          <Button size="sm" variant="danger" type="button" icon={Trash2} wrapContent={false} onClick={() => run(async () => {
  await companyCalendarApi.deleteLeaveType(leaveType.id);
  setLeaveType(emptyLeaveType());
}, 'Leave type removed.')}>
                            Delete
                          </Button>
                        )}
                        <Button size="sm" variant="colored" type="submit" icon={Save} wrapContent={false} disabled={busy}>
                          {busy ? 'Saving...' : 'Save leave type'}
                        </Button>
                      </footer>
                    </fieldset>
                  </form>
                </Card>
              </>
            )}

            {tab === 'eligibility' && (
              <Card className="tenant-panel cc-panel cc-matrix-panel">
                <TenantPanelHeader title={<>{selectedPerson ? nameOf(selectedPerson) : 'Select an employee'}</>} subtitle={<>Manage leave eligibility and allowance.</>} />
                {selectedPerson ? (
                  <form onSubmit={saveAssignment}>
                    <fieldset disabled={busy}>
                      <div className="cc-assignment-mode">
                        <label className={assignment.mode === 'group' ? 'is-selected' : ''}>
                          <input
                            type="radio"
                            name="assignmentMode"
                            checked={assignment.mode === 'group'}
                            onChange={() => setAssignment({
                              mode: 'group',
                              group_id: matchingGroup(selectedPerson)?.id || '',
                              overrides: {}
                            })}
                          />
                          Policy group
                        </label>
                        <label className={assignment.mode === 'custom' ? 'is-selected' : ''}>
                          <input
                            type="radio"
                            name="assignmentMode"
                            checked={assignment.mode === 'custom'}
                            onChange={() => setAssignment({
                              mode: 'custom',
                              group_id: '',
                              overrides: Object.fromEntries(
                                (configuration.leaveTypes || []).map(type => [
                                  type.id,
                                  {
                                    enabled: eligibleFor(type, selectedPerson),
                                    initial_days: type.initial_days,
                                    accrual_amount: type.accrual_amount
                                  }
                                ])
                              )
                            })}
                          />
                          Individual settings
                        </label>
                        {assignment.mode === 'group' && (
                          <select aria-label="Policy group"
                            required
                            value={assignment.group_id}
                            onChange={e => setAssignment({ ...assignment, group_id: e.target.value })}
                          >
                            <option value="">Select policy group</option>
                            {(configuration.groups || [])
                              .filter(item => item.active)
                              .map(item => (
                                <option key={item.id} value={item.id}>{item.name}</option>
                              ))}
                          </select>
                        )}
                      </div>

                      {eligibleTypesForChart.length > 0 && (
                        <Card className="tenant-panel cc-matrix-chart-card">
                          <TenantPanelHeader title="Leave allocation" subtitle={`Initial days across ${eligibleTypesForChart.length} eligible leave types.`} icon={CalendarDays} controls={<span className="cc-chip">{eligibleTypesForChart.length} eligible</span>} />
                          <div className="cc-matrix-chart-body" style={{ height: Math.max(180, eligibleTypesForChart.length * 42 + 36) }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={eligibleTypesForChart} layout="vertical" margin={{ left: 4, right: 16, top: 8, bottom: 4 }}>
                                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 5" horizontal={false} />
                                <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
                                <YAxis type="category" dataKey="code" width={44} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--color-text-secondary)', fontWeight: 500 }} />
                                <Tooltip content={<MatrixChartTooltip />} cursor={{ fill: 'var(--color-surface-subtle)' }} />
                                <Bar dataKey="days" barSize={18} radius={[0, 6, 6, 0]} background={{ fill: 'var(--color-surface-subtle)', radius: 6 }}>
                                  {eligibleTypesForChart.map((entry, index) => (
                                    <Cell key={index} fill={entry.color} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="cc-matrix-chart-tags">
                            {eligibleTypesForChart.map((type, index) => (
                              <span key={index} className="cc-matrix-chart-tag" style={{ '--cc-policy-color': type.color }} title={`${type.name} · ${type.days} initial days`}>
                                <span className="cc-matrix-chart-dot" style={{ background: type.color }} />
                                <strong>{type.code}</strong>
                                <span>{type.name}</span>
                                <b className="cc-matrix-chart-days">{type.days}d</b>
                              </span>
                            ))}
                          </div>
                        </Card>
                      )}

                      <div className="cc-matrix">
                        <div className="cc-matrix-head">
                          <span>Leave type</span>
                          <span>Enabled</span>
                          <span>Days</span>
                          <span>Increment</span>
                          <span>Policy Source</span>
                        </div>
                        {(configuration.leaveTypes || []).map(type => {
                          const row = assignmentTypes.find(item => item.id === type.id);
                          const override = (assignment.overrides || {})[type.id] || {
                            enabled: false,
                            initial_days: type.initial_days,
                            accrual_amount: type.accrual_amount
                          };
                          const custom = assignment.mode === 'custom';
                          const isEnabled = custom ? override.enabled : Boolean(row);

                          return (
                            <div className={`cc-matrix-row ${!isEnabled ? 'is-disabled' : ''}`} key={type.id} style={{ '--cc-policy-color': /^#[0-9a-f]{6}$/i.test(type.color || '') ? type.color : 'var(--color-primary)' }}>
                              <span>
                                <i style={{ background: type.color }} />
                                <b>{type.name}</b>
                                <small>{type.code}</small>
                              </span>
                              <div className="cc-matrix-toggle">
                                <label htmlFor={`cc-leave-enabled-${type.id}`} className="cc-visually-hidden">Enable {type.name}</label>
                                <Toggle
                                  id={`cc-leave-enabled-${type.id}`}
                                  disabled={busy || !custom}
                                  checked={isEnabled}
                                  onChange={checked => setAssignment({
                                    ...assignment,
                                    overrides: {
                                      ...(assignment.overrides || {}),
                                      [type.id]: {
                                        ...override,
                                        enabled: checked
                                      }
                                    }
                                  })}
                                />
                              </div>
                              <input
                                aria-label={`${type.name} days`}
                                type="number"
                                min="0"
                                step=".25"
                                disabled={!custom || !override.enabled}
                                value={custom ? override.initial_days : type.initial_days}
                                onChange={e => setAssignment({
                                  ...assignment,
                                  overrides: {
                                    ...(assignment.overrides || {}),
                                    [type.id]: {
                                      ...override,
                                      initial_days: e.target.value
                                    }
                                  }
                                })}
                              />
                              <div className="cc-matrix-increment">
                                <input
                                  aria-label={`${type.name} increment`}
                                  type="number"
                                  min="0"
                                  step=".25"
                                  disabled={!custom || !override.enabled}
                                  value={custom ? (override.accrual_amount ?? type.accrual_amount ?? 0) : (type.accrual_amount ?? 0)}
                                  onChange={e => setAssignment({
                                    ...assignment,
                                    overrides: {
                                      ...(assignment.overrides || {}),
                                      [type.id]: {
                                        ...override,
                                        accrual_amount: e.target.value
                                      }
                                    }
                                  })}
                                />
                                <small>
                                  {type.accrual_frequency === 'none'
                                    ? 'No increment'
                                    : `per ${type.accrual_frequency.replace('ly', '')}`}
                                </small>
                              </div>
                              <span>{custom ? 'Custom override' : (row?.source || 'Not in group')}</span>
                            </div>
                          );
                        })}
                      </div>

                      <footer>
                        <span>
                          {assignment.mode === 'custom'
                            ? 'Values apply only to this specific employee.'
                            : 'The selected policy group governs enabled leave types.'}
                        </span>
                        <Button size="sm" variant="colored" type="submit" icon={Save} wrapContent={false} disabled={busy}>
                          {busy ? 'Saving...' : 'Save assignment'}
                        </Button>
                      </footer>
                    </fieldset>
                  </form>
                ) : (
                  <div className="cc-empty-inline">Select an employee from the directory to review and customize their leave entitlement matrix.</div>
                )}
              </Card>
            )}

            {tab === 'holidays' && (
              <section className="workspace-grid cc-holiday-layout">
                <Card className="tenant-panel cc-panel cc-holiday-calendar-card">
                <section className="cc-calendar-card">
                  <TenantPanelHeader title={<>{calendarMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</>} subtitle={<>Click a date to add a holiday, or a holiday to edit. Hover to see the day?s details.</>} controls={<div className="cc-month-navigation"><Button type="button" variant="fadeout" iconOnly size="sm" icon={ChevronLeft} aria-label="Previous month" onClick={() => setCalendarMonth(value => new Date(value.getFullYear(), value.getMonth() - 1, 1))} /><Button type="button" variant="fadeout" iconOnly size="sm" icon={ChevronRight} aria-label="Next month" onClick={() => setCalendarMonth(value => new Date(value.getFullYear(), value.getMonth() + 1, 1))} /></div>} />
                  <HolidayCalendar
                    month={calendarMonth}
                    selected={holiday.holiday_date ? new Date(holiday.holiday_date + 'T12:00:00') : undefined}
                    onSelect={selectHolidayDate}
                    onEventSelect={item => setHoliday(item)}
                    onOpen={(date, item, anchor) => { selectHolidayDate(date); if (item) setHoliday(item); setHolidayEditor({ anchor }); }}
                    holidays={configuration.holidays}
                  />
                  <HolidayLegend holidays={configuration.holidays} showAll />
                </section>

                {holidayEditor && <HolidayEditorPopover anchor={holidayEditor.anchor} color={detectHolidayCategory(holiday).color} onClose={() => { if (!busy) setHolidayEditor(null); }}>
                <section className="cc-holiday-editor">
                  <TenantPanelHeader title={<>{holiday.id ? 'Edit holiday' : 'Add holiday'}</>} subtitle={<>
                        {holiday.holiday_date
                          ? new Date(`${holiday.holiday_date}T12:00:00`).toLocaleDateString('en-IN', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })
                          : 'Select a date on the calendar or enter one below.'}
                      </>} />
                  <form onSubmit={saveHoliday}>
                    <fieldset disabled={busy}>
                      <div className="cc-holiday-form">
                        <label>
                          Holiday name
                          <input
                            required
                            value={holiday.name}
                            onChange={e => setHoliday({ ...holiday, name: e.target.value })}
                            placeholder="e.g. Diwali, Independence Day"
                          />
                        </label>
                        <label>
                          Date
                          <input
                            required
                            type="date"
                            value={holiday.holiday_date}
                            onChange={e => {
                              const val = e.target.value;
                              setHoliday({ ...holiday, holiday_date: val });
                              if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
                                const parsed = new Date(`${val}T12:00:00`);
                                if (!isNaN(parsed.getTime())) setCalendarMonth(parsed);
                              }
                            }}
                          />
                        </label>
                        <label>
                          Type
                          <select
                            required
                            value={holiday.type}
                            onChange={e => setHoliday({
                              ...holiday,
                              type: e.target.value,
                              optional_note: e.target.value === 'Optional Holiday' ? holiday.optional_note : ''
                            })}
                          >
                            <option value="">Select holiday type</option>
                            {holiday.type && !INDIAN_HOLIDAY_TYPES.includes(holiday.type) && (
                              <option value={holiday.type}>{holiday.type} (existing)</option>
                            )}
                            {INDIAN_HOLIDAY_TYPES.map(value => (
                              <option key={value} value={value}>{value}</option>
                            ))}
                          </select>
                        </label>
                        {holiday.type === 'Optional Holiday' && (
                          <label>
                            Optional holiday conditions
                            <textarea
                              required
                              rows={3}
                              maxLength={500}
                              value={holiday.optional_note || ''}
                              onChange={e => setHoliday({ ...holiday, optional_note: e.target.value })}
                              placeholder="Explain employee eligibility or rules..."
                            />
                            <small>Included in calendar exports.</small>
                          </label>
                        )}
                      </div>

                      <footer>
                        <div className="cc-holiday-published"><Toggle id="cc-holiday-published" checked={holiday.active} disabled={busy} onChange={active => setHoliday({ ...holiday, active })} /><label htmlFor="cc-holiday-published">{holiday.active ? 'On' : 'Off'}</label></div>
                        {holiday.id && (
                          <Button size="sm" variant="danger" type="button" icon={Trash2} wrapContent={false} onClick={() => run(async () => {
  await companyCalendarApi.deleteHoliday(holiday.id);
  setHoliday(emptyHoliday());
  setHolidayEditor(null);
}, 'Holiday removed.')}>
                            Delete
                          </Button>
                        )}
                        <Button wrapContent={false} icon={Save} size="sm" variant="colored" type="submit" disabled={busy || !holiday.holiday_date || !holiday.name.trim()}>
                          {busy ? 'Saving...' : 'Save holiday'}
                        </Button>
                      </footer>
                    </fieldset>
                  </form>
                </section>
                </HolidayEditorPopover>}
                </Card>
                <Card className="tenant-panel cc-panel cc-official-days">
                  <TenantPanelHeader title={<>Company holidays</>} subtitle={<>Browse and manage holiday dates.</>} actions={[{id:'action0',variant:'colored',iconOnly:true,icon:Plus,'aria-label':'Add holiday',title:'Add holiday',onClick:() => { setHoliday(emptyHoliday()); setHolidayEditor({ anchor: null }); }}]}/>
                  <div className="cc-holidays">
                    {(configuration.holidays || []).length ? (
                      [...configuration.holidays]
                        .sort((a, b) => a.holiday_date.localeCompare(b.holiday_date))
                        .map(item => (
                          <Button wrapContent={false} size="sm" variant={holiday.id === item.id ? "colored" : "fadeout"} type="button" className={['cc-selection', holiday.id === item.id ? 'is-selected' : ''].filter(Boolean).join(' ')} key={item.id} onClick={() => {
  setHoliday(item);
  setHolidayEditor({ anchor: null });
  if (/^\d{4}-\d{2}-\d{2}$/.test(item.holiday_date)) {
    setCalendarMonth(new Date(`${item.holiday_date}T12:00:00`));
  }
}}>
                            <time dateTime={item.holiday_date} className="cc-holiday-date" title={item.holiday_date}>
                              <b>{new Date(`${item.holiday_date}T12:00:00`).getDate()}</b>
                              <span>{new Date(`${item.holiday_date}T12:00:00`).toLocaleDateString('en-IN', { month: 'short' })}</span>
                            </time>
                            <span>
                              <strong>{item.name}</strong>
                              <small>{item.type} · {item.active ? 'Published' : 'Hidden'}</small>
                              {item.optional_note && <small>{item.optional_note}</small>}
                            </span>
                          </Button>
                        ))
                    ) : (
                      <p className="cc-empty-inline">No official holidays added yet.</p>
                    )}
                  </div>
                </Card>

              </section>
            )}

            {tab === 'sync' && (
              <Card className="tenant-panel cc-panel cc-calendarific-panel">
                <TenantPanelHeader title={<>Import official holidays</>} subtitle={<>Choose a location, preview dates and import holidays.</>} />

                <div className="cc-calendarific-layout">
                  <div className="cc-calendarific-main">
                    <form className="cc-calendarific-form" onSubmit={fetchCalendarificHolidays}>
                      <div className="cc-form-grid">
                        <label>
                          Country
                          <select
                            value={calendarificCountry}
                            onChange={e => setCalendarificCountry(e.target.value)}
                          >
                            {CALENDARIFIC_COUNTRIES.map(c => (
                              <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                            ))}
                          </select>
                        </label>

                        <label>
                          Year
                          <input
                            type="number"
                            min="2020"
                            max="2035"
                            value={calendarificYear}
                            onChange={e => setCalendarificYear(e.target.value)}
                            required
                          />
                        </label>

                        <label>
                          Month
                          <select
                            value={calendarificMonth}
                            onChange={e => setCalendarificMonth(e.target.value)}
                          >
                            {CALENDARIFIC_MONTHS.map(m => (
                              <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                          </select>
                        </label>

                        <label>
                          Holiday Type
                          <select
                            value={calendarificType}
                            onChange={e => setCalendarificType(e.target.value)}
                          >
                            <option value="">All Holiday Types</option>
                            <option value="national">National Holidays</option>
                            <option value="religious">Religious Holidays</option>
                            <option value="observance">Observances</option>
                            <option value="local">Local / Regional</option>
                          </select>
                        </label>
                      </div>

                      <div className="cc-calendarific-actions">
                        <Button variant="colored" size="md" icon={RefreshCw} type="submit" loading={calendarificLoading}>
                          {calendarificLoading ? 'Loading holidays...' : 'Load holidays'}
                        </Button>
                        {calendarificHolidays.length > 0 && (
                          <Button variant="primary" size="md" icon={Download} type="button" disabled={busy || selectedCalendarificHolidays.length === 0} onClick={importSelectedCalendarificHolidays}>
                            Import selected ({selectedCalendarificHolidays.length})
                          </Button>
                        )}
                      </div>
                    </form>

                    {calendarificError && (
                      <div className="cc-calendarific-error" role="alert">
                        <span>{calendarificError}</span>
                      </div>
                    )}

                    <div className="cc-year-calendar-section">
                      <div className="cc-year-section-header">
                        <div>
                          <h3>{calendarificYear} holiday calendar</h3>
                          <p>Preview holiday dates before importing.</p>
                        </div>
                        <div className="cc-import-legend" aria-label="Holiday categories">{Object.values(HOLIDAY_CATEGORY_CONFIG).map(category => <span key={category.key} style={{ '--holiday-color': category.color }}><i aria-hidden="true" />{category.label}</span>)}</div>
                      </div>

                      <div className="cc-year-calendar-grid">
                        {Array.from({ length: 12 }, (_, monthIndex) => {
                          const monthNum = monthIndex + 1;
                          const monthDate = new Date(parseInt(calendarificYear, 10) || new Date().getFullYear(), monthIndex, 1);
                          const activeHolidays = calendarificHolidays.length > 0 ? calendarificHolidays : (configuration.holidays || []);
                          const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'long' });

                          return (
                            <div
                              key={monthNum}
                              className={`cc-year-month-card ${calendarificMonth === String(monthNum) ? 'is-highlighted' : ''}`}
                            >
                              <div className="cc-month-card-header">
                                <strong>{monthLabel}</strong>
                              </div>
                              <HolidayCalendar compact month={monthDate} holidays={activeHolidays} />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {calendarificHolidays.length > 0 && (
                      <div className="cc-calendarific-results">
                        <div className="cc-results-header">
                          <div>
                            <strong>Found {calendarificHolidays.length} Holidays</strong>
                            <span>
                              {CALENDARIFIC_COUNTRIES.find(c => c.code === calendarificCountry)?.name || calendarificCountry} · {calendarificYear}
                              {calendarificMonth && ` · ${CALENDARIFIC_MONTHS.find(m => m.value === calendarificMonth)?.label}`}
                            </span>
                          </div>
                          <div className="cc-selection-buttons">
                            <Button size="sm" variant="outline" type="button" onClick={() => setSelectedCalendarificHolidays(calendarificHolidays.map((_, i) => i))}>
                              Select All
                            </Button>
                            <Button size="sm" variant="outline" type="button" onClick={() => setSelectedCalendarificHolidays([])}>
                              Clear
                            </Button>
                          </div>
                        </div>

                        <div className="cc-holiday-items-list">
                          {calendarificHolidays.map((item, idx) => {
                            const isSelected = selectedCalendarificHolidays.includes(idx);
                            const alreadyInDb = (configuration.holidays || []).some(h => h.holiday_date === item.holiday_date);
                            const cat = detectHolidayCategory(item);
                            return (
                              <label
                                key={`${item.holiday_date}-${item.name}-${idx}`}
                                className={`cc-holiday-item-card ${isSelected ? 'is-selected' : ''}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {
                                    setSelectedCalendarificHolidays(prev =>
                                      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
                                    );
                                  }}
                                />
                                <div className="cc-holiday-item-info">
                                  <div className="cc-holiday-item-row">
                                    <span className="cc-holiday-date-badge">{item.holiday_date}</span>
                                    <strong>{item.name}</strong>
                                    {alreadyInDb && <span className="cc-tag-existing">Already configured</span>}
                                  </div>
                                  <div className="cc-holiday-item-meta">
                                    <span
                                      className="cc-tag-type"
                                      style={{
                                        backgroundColor: cat.color,
                                        color: '#ffffff',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        fontWeight: 600,
                                        display: 'inline-block',
                                        width: 'fit-content'
                                      }}
                                    >
                                      {item.type || cat.label}
                                    </span>
                                    {item.optional_note && <p className="cc-holiday-note">{item.optional_note}</p>}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}
          </main>

          {tab === 'types' && (
            <aside className="cc-group-column">
              <Card className="tenant-panel cc-panel cc-group-editor">
                <TenantPanelHeader title={<>{group.id ? `Edit ${group.name}` : 'Create a group'}</>} subtitle={<>Bundle policies and assign them to your people.</>} actions={[{id:'action0',variant:'colored',iconOnly:true,icon:<Plus size={22} aria-hidden="true" />,'aria-label':'Create new policy group',title:'Create new policy group',disabled:busy,onClick:() => {
                      setGroup({
                        name: '',
                        description: '',
                        active: true,
                        leave_type_ids: [],
                        assignment_mode: 'teams',
                        teams: [],
                        userids: []
                      });
                      setGroupPeople([]);
                    }}]}/>
                <form onSubmit={saveGroup}>
                  <fieldset disabled={busy}>
                    <div className="cc-group-form">
                      <label>
                        Group name
                        <input
                          required
                          value={group.name}
                          onChange={e => setGroup({ ...group, name: e.target.value })}
                          placeholder="e.g. Standard Corporate Policy"
                        />
                      </label>
                      <label>
                        Description
                        <textarea
                          rows={2}
                          value={group.description}
                          onChange={e => setGroup({ ...group, description: e.target.value })}
                          placeholder="Group coverage description..."
                        />
                      </label>
                      <MultiSelect label="Included leave types" maxSelected={10} value={group.leave_type_ids||[]} options={configuration.leaveTypes.map(type=>({value:type.id,label:type.name,description:type.code}))} onChange={ids=>setGroup({...group,leave_type_ids:ids})} disabled={busy} placeholder="Choose leave policies" empty="Save a leave type first to include it in a group."/>
                      <label>Assign group to<select value={group.assignment_mode} onChange={e=>setGroup({...group,assignment_mode:e.target.value})}><option value="teams">Teams & departments</option><option value="people">Specific employees</option></select></label>
                      {group.assignment_mode==='teams'?<MultiSelect label="Teams & departments" value={group.teams||[]} options={groups.map(value=>({value,label:value}))} onChange={teams=>setGroup({...group,teams})} disabled={busy} placeholder="Choose teams or departments"/>:<MultiSelect label="Employees" value={groupPeople} options={people.map(person=>({value:person.userid,label:nameOf(person),description:person.department}))} onChange={setGroupPeople} disabled={busy} placeholder="Choose employees"/>}

                    </div>

                    <footer>
                      <div className="cc-group-status"><div><strong>Group enabled</strong><small>{group.active?'Available for leave assignments':'Paused for new assignments'}</small></div><Toggle id="cc-group-enabled" checked={group.active} disabled={busy} onChange={active=>setGroup({...group,active})}/><label htmlFor="cc-group-enabled" className="cc-visually-hidden">Enable policy group</label></div>
                      {group.id && (
                        <Button size="sm" variant="danger" type="button" icon={Trash2} wrapContent={false} onClick={() => run(async () => {
  await companyCalendarApi.deleteGroup(group.id);
  setGroup({
    name: '',
    description: '',
    active: true,
    leave_type_ids: [],
    assignment_mode: 'teams',
    teams: [],
    userids: []
  });
}, 'Policy group removed.')}>
                          Delete
                        </Button>
                      )}
                      <Button size="sm" variant="colored" type="submit" icon={Save} loading={busy}>Save group</Button>
                    </footer>
                  </fieldset>
                </form>
              </Card>

              <Card className="tenant-panel cc-panel">
                <TenantPanelHeader title={<>{(configuration.groups || []).length} policy groups</>}  />
                <div className="cc-saved-groups">
                  {(configuration.groups || []).length ? (
                    (configuration.groups || []).map(item => (
                      <Button size="sm" variant={group.id === item.id ? "colored" : "fadeout"} key={item.id} type="button" className={['cc-selection', group.id === item.id ? 'is-selected' : ''].filter(Boolean).join(' ')} onClick={() => {
  setGroup(item);
  setGroupPeople(item.userids || []);
}} layout="row">
                        <strong>{item.name}</strong>
                        <small>{(item.leave_type_ids || []).length} leave types · {item.active ? 'Active' : 'Off'}</small>
                      </Button>
                    ))
                  ) : (
                    <p className="cc-empty-inline">No policy groups created yet.</p>
                  )}
                </div>
              </Card>
            </aside>
          )}

          {tab === 'eligibility' && (
            <aside className="cc-directory-aside">
              <EmployeeDirectory
                employees={people}
                selectedId={selectedPerson?.userid}
                onSelect={setSelectedPerson}
                subtitle="Select an employee to inspect or customize their matrix."
                pageSize={8}
              />
            </aside>
          )}
        </div>
      )}</SectionSkeleton>
    </div>
  );
}
