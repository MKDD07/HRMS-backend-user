import './GeofenceRulesPage.scss';
import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Camera,
  Shield,
  ShieldCheck,
  Building,
  Plus,
  Edit,
  Save,
  CheckCircle2,
  AlertTriangle,
  Search,
  Users,
  Navigation,
  Crosshair,
  Sliders,
  ExternalLink,
  Layers
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Avatar } from '../../components/ui/Avatar';
import { EmployeeDirectory } from '../../components/employees/EmployeeDirectory';
import {
  getGeofenceGroups,
  saveGeofenceGroup,
  getEmployeeGeofenceRule,
  saveEmployeeGeofenceRule
} from '../../lib/geofenceStore';

export function GeofenceRulesPage({ api, onShowToast, onSelectEmployee }) {
  const [activeTab, setActiveTab] = useState('individual'); // 'individual' or 'groups'
  const [groups, setGroups] = useState(getGeofenceGroups());
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [loadError, setLoadError] = useState('');

  // Left-side editor; the shared person picker stays on the right.
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [empForm, setEmpForm] = useState({
    mode: 'group', // 'group' or 'custom'
    group_id: '',
    custom_location_name: '',
    custom_latitude: '',
    custom_longitude: '',
    custom_radius_meters: 250,
    photo_required: true,
    allow_wfh: false,
    status: 'Enforced'
  });

  // Modal for adding a new group geofence
  const [isAddGroupModalOpen, setIsAddGroupModalOpen] = useState(false);
  const [groupForm, setGroupForm] = useState({
    group_id: '',
    name: '',
    type: 'Regional Office',
    latitude: '',
    longitude: '',
    radius_meters: 250,
    photo_required: true,
    address: ''
  });

  // Load employees
  useEffect(() => {
    async function loadUsers() {
      setLoading(true);
      setLoadError('');
      try {
        if (api?.getAllUsers) {
          const res = await api.getAllUsers({ liveOnly: true });
          if (res?.data) {
            setEmployees(res.data);
          }
        }
      } catch (e) {
        setEmployees([]);
        setLoadError('Unable to load employees. Please reload to try again.');
      } finally {
        setLoading(false);
      }
    }
    loadUsers();
  }, [api]);

  // Load the selected employee into the rule editor.
  const handleOpenEditEmp = (emp) => {
    const currentRule = getEmployeeGeofenceRule(emp.userid, emp);
    setSaveError('');
    setSelectedEmp(emp);
    setEmpForm({
      ...currentRule,
      mode: currentRule.mode || 'group',
      group_id: currentRule.group_id || '',
      custom_location_name:
        currentRule.custom_location_name || '',
      custom_latitude: currentRule.custom_latitude ?? '',
      custom_longitude: currentRule.custom_longitude ?? '',
      custom_radius_meters: currentRule.custom_radius_meters || 200,
      photo_required:
        currentRule.photo_required !== undefined ? currentRule.photo_required : true,
      allow_wfh: Boolean(currentRule.allow_wfh),
      status: currentRule.status === 'Not configured' ? 'Paused' : currentRule.status || 'Paused'
    });
    // No modal — form appears in the right panel
  };

  // Save Individual Geofence
  const handleSaveEmpGeofence = (e) => {
    e.preventDefault();
    if (!selectedEmp) return;

    try {
      setEmpForm(saveEmployeeGeofenceRule(selectedEmp.userid, empForm));
      setSaveError('');
    } catch (error) {
      setSaveError(error.message);
      return;
    }

    if (onShowToast) {
      onShowToast({
        type: 'success',
        title: 'Geofence & Photo Rules Updated',
        message: `Custom policy saved for ${selectedEmp.first_name} ${selectedEmp.last_name} (${empForm.mode === 'custom' ? 'Separate Coordinates' : 'Group Policy'}).`
      });
    }
  };

  // Detect current GPS coordinate using browser location API
  const handleDetectGPS = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setEmpForm((prev) => ({
            ...prev,
            custom_latitude: Number(pos.coords.latitude.toFixed(6)),
            custom_longitude: Number(pos.coords.longitude.toFixed(6))
          }));
          if (onShowToast) {
            onShowToast({
              type: 'info',
              title: 'GPS Coordinates Captured',
              message: `Latitude: ${pos.coords.latitude.toFixed(4)}, Longitude: ${pos.coords.longitude.toFixed(4)}`
            });
          }
        },
        (err) => {
          if (onShowToast) {
            onShowToast({
              type: 'warning',
              title: 'GPS Access Denied',
              message: 'Unable to capture your location. Enter coordinates manually.'
            });
          }
        }
      );
    }
  };

  // Save New Group Geofence
  const handleSaveGroup = (e) => {
    e.preventDefault();
    const newGroupId = groupForm.group_id || `group-${Date.now()}`;
    const toSave = {
      ...groupForm,
      group_id: newGroupId,
      latitude: Number(groupForm.latitude),
      longitude: Number(groupForm.longitude),
      radius_meters: Number(groupForm.radius_meters)
    };
    try {
      const updated = saveGeofenceGroup(toSave);
      setGroups(updated);
    } catch (error) {
      onShowToast?.({ type: 'error', title: 'Could not save campus', message: error.message });
      return;
    }
    setIsAddGroupModalOpen(false);
    setGroupForm({
      group_id: '',
      name: '',
      type: 'Regional Office',
      latitude: '',
      longitude: '',
      radius_meters: 250,
      photo_required: true,
      address: ''
    });

    if (onShowToast) {
      onShowToast({
        type: 'success',
        title: 'Group Geofence Site Saved',
        message: `Configured campus: ${toSave.name}.`
      });
    }
  };

  const rules = employees.map((emp) => getEmployeeGeofenceRule(emp.userid, emp)).filter((rule) => rule.updated_at);
  const activeSite = empForm.mode === 'custom' ? { name: empForm.custom_location_name, latitude: empForm.custom_latitude, longitude: empForm.custom_longitude, radius_meters: empForm.custom_radius_meters } : groups.find((group) => group.group_id === empForm.group_id);

  return (
    <div className="geofence-console space-y-6">
      <PageHeader
        className="geofence-header"
        title="Geofence & Photo Rules"
        subtitle="Manage attendance locations, photo requirements, and work-from-home exceptions."
        breadcrumbs={['HRMS', 'Attendance', 'Geofence & Photo Rules']}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant={activeTab === 'individual' ? 'colored' : 'outline'}
              size="md"
              icon={Users}
              onClick={() => setActiveTab('individual')}
            >
              Employee rules
            </Button>
            <Button
              variant={activeTab === 'groups' ? 'colored' : 'outline'}
              size="md"
              icon={Building}
              onClick={() => setActiveTab('groups')}
            >
              Campus sites
            </Button>
          </div>
        }
      />

      {/* KPI Highlights */}
      <div className="geofence-stats grid grid-cols-1 sm:grid-cols-4 gap-3 text-[13px]">
        <div className="p-4 rounded-xl border border-[#E5E7EB] bg-[#FFFFFF]">
          <span className="text-[#5F6368] block">Configured Campus Sites</span>
          <span className="text-xl font-bold text-[#27292C] mt-0.5 block">
            {groups.length} Sites
          </span>
          <span className="text-[11px] text-[#000000] mt-1 block">
            Saved campus locations
          </span>
        </div>

        <div className="p-4 rounded-xl border border-[#E5E7EB] bg-[#FFFFFF]">
          <span className="text-[#5F6368] block">Custom Individual Geofences</span>
          <span className="text-xl font-bold text-[#2563EB] mt-0.5 block">
            {rules.filter((rule) => rule.mode === 'custom').length} people
          </span>
          <span className="text-[11px] text-[#5F6368] mt-1 block">
            Separate Lat/Lng per person
          </span>
        </div>

        <div className="p-4 rounded-xl border border-[#E5E7EB] bg-[#FFFFFF]">
          <span className="text-[#5F6368] block">Photo Punch Verification</span>
          <span className="text-xl font-bold text-[#000000] mt-0.5 block">
            {rules.filter((rule) => rule.photo_required).length} people
          </span>
          <span className="text-[11px] text-[#5F6368] mt-1 block">
            Configurable per person
          </span>
        </div>

        <div className="p-4 rounded-xl border border-[#000000]/30 bg-[#ECFDF5]">
          <span className="text-[#065F46] block font-semibold">Work-from-home access</span>
          <span className="text-xl font-bold text-[#065F46] mt-0.5 block">
            {rules.filter((rule) => rule.allow_wfh).length} people
          </span>
          <span className="text-[11px] text-[#059669] mt-1 block">
            Configured employee exceptions
          </span>
        </div>
      </div>

      {/* TAB 1: INDIVIDUAL PERSON GEOFENCE */}
      {activeTab === 'individual' && (
        <div className="employee-workspace">
          {selectedEmp ? (
            <section className="geofence-editor">
              <header className="geofence-editor-heading">
                <div><span className="geofence-section-label">EMPLOYEE POLICY</span><h3>Configure Geofence & Photo Rule</h3><p>Set where this person can punch and what evidence is required.</p></div>
                <button type="button" className="geofence-text-button" onClick={() => setSelectedEmp(null)}>Close</button>
              </header>
              <form onSubmit={handleSaveEmpGeofence}>
                <div className="geofence-identity">
                  <Avatar size="md" src={selectedEmp.profile_pic_url} name={selectedEmp.first_name + ' ' + selectedEmp.last_name} />
                  <div><strong>{selectedEmp.first_name} {selectedEmp.last_name}</strong><p>{selectedEmp.userid} / {selectedEmp.department || 'Department not provided'}</p></div>
                  <span className="geofence-status">{empForm.status}</span>
                </div>
                <section className="geofence-editor-section">
                  <div className="geofence-section-heading"><span>01</span><div><h4>Attendance location</h4><p>Choose an existing campus or define an individual boundary.</p></div></div>
                  <div className="geofence-mode-options">
                    {[['group', Building, 'Campus location', 'Use a configured campus boundary'], ['custom', Crosshair, 'Custom location', 'Set coordinates and radius for this person']].map(([mode, Icon, title, description]) => (
                      <button type="button" key={mode} aria-pressed={empForm.mode === mode} className="geofence-mode-option" onClick={() => setEmpForm({ ...empForm, mode })}>
                        <Icon size={19} /><span><strong>{title}</strong><small>{description}</small></span><span className="geofence-radio" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                  {empForm.mode === 'group' ? <div className="geofence-location-fields">
                    <label className="geofence-field">Assigned campus<select required value={empForm.group_id} onChange={(e) => setEmpForm({ ...empForm, group_id: e.target.value })}>
                      <option value="">Select a configured campus</option>{groups.map(g => <option key={g.group_id} value={g.group_id}>{g.name} ({g.is_unrestricted ? 'Unrestricted' : g.radius_meters + ' m'})</option>)}
                    </select></label>
                    {activeSite ? <p className="geofence-field-hint"><MapPin size={14} />{activeSite.is_unrestricted ? 'No location boundary' : activeSite.latitude + ', ' + activeSite.longitude + ' / ' + activeSite.radius_meters + ' m radius'}</p> : <p className="geofence-field-hint">{groups.length ? 'Select a campus to view its location boundary.' : 'No campuses yet. Add one in Campus sites, or use a custom location.'}</p>}
                  </div> : <div className="geofence-location-fields">
                    <label className="geofence-field">Location name<input required value={empForm.custom_location_name} placeholder="Enter location name" onChange={e => setEmpForm({ ...empForm, custom_location_name: e.target.value })} /></label>
                    <div className="geofence-field-grid">
                      <label className="geofence-field">Latitude<input type="number" min="-90" max="90" step="any" required placeholder="-90 to 90" value={empForm.custom_latitude} onChange={e => setEmpForm({ ...empForm, custom_latitude: e.target.value })} /></label>
                      <label className="geofence-field">Longitude<input type="number" min="-180" max="180" step="any" required placeholder="-180 to 180" value={empForm.custom_longitude} onChange={e => setEmpForm({ ...empForm, custom_longitude: e.target.value })} /></label>
                    </div>
                    <button type="button" className="geofence-text-button" onClick={handleDetectGPS}><Crosshair size={14} /> Use my current location</button>
                    <div className="geofence-radius">
                      <label htmlFor="geofence-radius">Allowed radius <strong>{empForm.custom_radius_meters} m</strong></label>
                      <input id="geofence-radius" type="range" min="50" max="1000" step="25" value={empForm.custom_radius_meters} onChange={e => setEmpForm({ ...empForm, custom_radius_meters: Number(e.target.value) })} />
                      <div className="geofence-radius-options">{[100, 200, 350, 500].map(radius => <button type="button" key={radius} aria-pressed={empForm.custom_radius_meters === radius} onClick={() => setEmpForm({ ...empForm, custom_radius_meters: radius })}>{radius} m</button>)}<span>50-1,000 metres</span></div>
                    </div>
                  </div>}
                </section>
                <section className="geofence-editor-section">
                  <div className="geofence-section-heading"><span>02</span><div><h4>Photo & work preferences</h4><p>Configure punch evidence and remote-work eligibility.</p></div></div>
                  <label className="geofence-setting-row"><Camera size={18} /><span><strong>Require a selfie</strong><small>Capture a photo at every punch-in and punch-out.</small></span><input className="geofence-switch" type="checkbox" role="switch" checked={empForm.photo_required} onChange={e => setEmpForm({ ...empForm, photo_required: e.target.checked })} /></label>
                  <label className="geofence-setting-row"><Building size={18} /><span><strong>Allow work from home</strong><small>Record remote-work eligibility for this employee.</small></span><input className="geofence-switch" type="checkbox" role="switch" checked={empForm.allow_wfh} onChange={e => setEmpForm({ ...empForm, allow_wfh: e.target.checked })} /></label>
                </section>
                <section className="geofence-editor-section">
                  <div className="geofence-section-heading"><span>03</span><div><h4>Policy settings</h4><p>Manage the policy status and document any exceptions.</p></div></div>
                  <div className="geofence-policy-fields">
                    <label className="geofence-field">Policy status<select value={empForm.status} onChange={e => setEmpForm({ ...empForm, status: e.target.value })}><option value="Enforced">Enforced</option><option value="Paused">Paused</option></select></label>
                    <label className="geofence-field">Admin notes <span className="geofence-optional">Optional</span><textarea maxLength={500} rows={3} placeholder="Add a reason for this location or exception..." value={empForm.notes || ''} onChange={e => setEmpForm({ ...empForm, notes: e.target.value })} /></label>
                  </div>
                </section>
                {activeSite && <div className="geofence-rule-preview"><ShieldCheck size={19} /><div><strong>{activeSite.name || 'Custom location'} / {activeSite.is_unrestricted ? 'Unrestricted' : activeSite.radius_meters + ' m radius'}</strong><p>{empForm.photo_required ? 'Selfie required' : 'Photo optional'} / {empForm.allow_wfh ? 'WFH eligible' : 'No WFH exception'} / {empForm.status}</p></div>{!activeSite.is_unrestricted && activeSite.latitude !== '' && activeSite.longitude !== '' && <a href={'https://www.google.com/maps?q=' + encodeURIComponent(activeSite.latitude + ',' + activeSite.longitude)} target="_blank" rel="noreferrer">View map <ExternalLink size={13} /></a>}</div>}
                {saveError && <p role="alert" className="geofence-editor-error">{saveError}</p>}
                <footer className="geofence-editor-footer"><p>Saved in this browser.<br />Punch-service integration is required for enforcement.</p><div><Button variant="secondary" size="sm" onClick={() => handleOpenEditEmp(selectedEmp)}>Reset</Button><Button variant="primary" size="sm" icon={Save} type="submit">Save rule</Button></div></footer>
              </form>
            </section>
          ) : (
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-10 text-center">
              <ShieldCheck className="w-10 h-10 mx-auto text-[#4F46E5] mb-4" />
              <h3 className="text-lg font-bold">Attendance rules, tailored to each person</h3>
              <p className="text-sm text-[#5F6368] mt-2">Select a person on the right to configure their campus, location boundary, and photo requirements.</p>
              <div className="grid sm:grid-cols-3 gap-3 mt-6 text-sm text-[#5F6368]">
                <div className="rounded-lg bg-[#F9FAFB] p-4">Campus or custom location</div>
                <div className="rounded-lg bg-[#F9FAFB] p-4">Photo punch requirements</div>
                <div className="rounded-lg bg-[#F9FAFB] p-4">Remote-work exceptions</div>
              </div>
            </div>
          )}
          <EmployeeDirectory employees={employees} selectedId={selectedEmp?.userid} onSelect={handleOpenEditEmp} loading={loading} error={loadError} />
        </div>
      )}

      {/* TAB 2: GROUP-BASED CAMPUS SITES */}
      {activeTab === 'groups' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#27292C]">
                Corporate Campus & Regional Hub Geofences
              </h3>
              <p className="text-[13px] text-[#5F6368]">
                Standard enterprise locations where attendance punches are verified via group boundary rules.
              </p>
            </div>

            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => { setGroupForm({ group_id: '', name: '', type: 'Regional Office', latitude: '', longitude: '', radius_meters: 250, photo_required: true, address: '' }); setIsAddGroupModalOpen(true); }}
            >
              Add Campus Site
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groups.length === 0 && <p className="geofence-empty">No campus sites configured. Add a campus site to define a location boundary.</p>}
            {groups.map((grp) => (
              <div
                key={grp.group_id}
                className="p-5 rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-[#F3F4F6] text-[#5F6368] font-bold">
                      {grp.group_id}
                    </span>
                    <h4 className="text-base font-bold text-[#27292C] mt-1">
                      {grp.name}
                    </h4>
                    <p className="text-[13px] text-[#5F6368]">{grp.address}</p>
                  </div>

                  <div className="flex items-center gap-2"><Badge variant="info">{grp.type}</Badge><Button size="sm" variant="secondary" icon={Edit} onClick={() => { setGroupForm({ ...grp }); setIsAddGroupModalOpen(true); }}>Edit</Button></div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#F3F4F6] text-[13px]">
                  <div>
                    <span className="text-[#5F6368] text-[11px] block">Coordinates</span>
                    <span className="font-semibold text-[#27292C]">
                      {grp.latitude}, {grp.longitude}
                    </span>
                  </div>

                  <div>
                    <span className="text-[#5F6368] text-[11px] block">Allowable Radius</span>
                    <span className="font-semibold text-[#27292C]">
                      {grp.radius_meters} meters
                    </span>
                  </div>

                  <div>
                    <span className="text-[#5F6368] text-[11px] block">Photo Required</span>
                    <span
                      className={`font-semibold ${grp.photo_required ? 'text-[#000000]' : 'text-[#5F6368]'
                        }`}
                    >
                      {grp.photo_required ? 'Mandatory Selfie' : 'Optional'}
                    </span>
                  </div>
                </div>

                {grp.assigned_departments && (
                  <div className="pt-2 border-t border-[#F3F4F6]">
                    <span className="text-[11px] text-[#5F6368] block mb-1">
                      Mapped Departments:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {grp.assigned_departments.map((d) => (
                        <span
                          key={d}
                          className="px-2 py-0.5 rounded bg-[#F3F4F6] text-[#27292C] text-[10px] font-medium"
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ADD GROUP GEOFENCE SITE MODAL */}
      <Modal
        isOpen={isAddGroupModalOpen}
        onClose={() => setIsAddGroupModalOpen(false)}
        title={groupForm.group_id ? "Edit campus site" : "Add campus site"}
        size="md"
      >
        <form onSubmit={handleSaveGroup} className="space-y-4 text-[13px]">
          {!groupForm.group_id && <label className="block text-[12px] text-[#527357]">Start with a site template<select defaultValue="" className="w-full mt-2 p-2 border rounded-lg" onChange={e => { const templates = { office: { type: 'Office', radius_meters: 150, photo_required: true }, campus: { type: 'Campus', radius_meters: 300, photo_required: true }, branch: { type: 'Branch office', radius_meters: 100, photo_required: false } }; if (templates[e.target.value]) setGroupForm(current => ({ ...current, ...templates[e.target.value] })); }}><option value="">Custom site</option><option value="office">Office ? 150 m ? Photo required</option><option value="campus">Campus ? 300 m ? Photo required</option><option value="branch">Branch ? 100 m ? Photo optional</option></select><small>Enter your actual coordinates and review the boundary before saving. Site rules currently save in this browser.</small></label>}

          <div>
            <label className="block text-[12px] font-semibold text-[#27292C] mb-1.5">
              Campus / Site Name *
            </label>
            <input
              type="text"
              required
              value={groupForm.name}
              onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
              placeholder="e.g. Pune Hinjewadi Tech Center"
              className="w-full text-[13px] h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#27292C] focus:ring-1 focus:ring-[#27292C]"
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#27292C] mb-1.5">
              Physical Street Address
            </label>
            <input
              type="text"
              value={groupForm.address}
              onChange={(e) => setGroupForm({ ...groupForm, address: e.target.value })}
              placeholder="e.g. Phase 2, Hinjewadi Rajiv Gandhi Infotech Park, Pune"
              className="w-full text-[13px] h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#27292C] focus:ring-1 focus:ring-[#27292C]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-[#27292C] mb-1.5">
                Latitude Coordinate *
              </label>
              <input
                type="number"
                step="any"
                required
                min="-90" max="90" value={groupForm.latitude}
                onChange={(e) =>
                  setGroupForm({ ...groupForm, latitude: e.target.value })
                }
                className="w-full text-[13px] h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#27292C] focus:ring-1 focus:ring-[#27292C]"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#27292C] mb-1.5">
                Longitude Coordinate *
              </label>
              <input
                type="number"
                step="any"
                required
                min="-180" max="180" value={groupForm.longitude}
                onChange={(e) =>
                  setGroupForm({ ...groupForm, longitude: e.target.value })
                }
                className="w-full text-[13px] h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#27292C] focus:ring-1 focus:ring-[#27292C]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-[#27292C] mb-1.5">
                Allowable Radius (Meters)
              </label>
              <input
                type="number"
                required min={groupForm.is_unrestricted ? 0 : 1} max="100000" value={groupForm.radius_meters}
                onChange={(e) =>
                  setGroupForm({ ...groupForm, radius_meters: e.target.value })
                }
                className="w-full text-[13px] h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#27292C] focus:ring-1 focus:ring-[#27292C]"
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-[#27292C]">
                <input
                  type="checkbox"
                  checked={groupForm.photo_required}
                  onChange={(e) =>
                    setGroupForm({ ...groupForm, photo_required: e.target.checked })
                  }
                  className="rounded text-[#2563EB] focus:ring-[#2563EB]"
                />
                <span className="text-[12px]">Mandatory Selfie Photo</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E5E7EB]">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsAddGroupModalOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" icon={CheckCircle2} type="submit">
              Save Campus Geofence
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
