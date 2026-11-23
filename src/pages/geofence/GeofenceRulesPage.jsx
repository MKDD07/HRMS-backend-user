import { Toggle } from '../../components/ui/Toggle';
import { ViewTabs } from '../../components/ui/ViewTabs';
import { GeofencePreview } from '../../components/ui/GeofencePreview';
import { MetricOverview, MetricCard } from '../../components/ui/MetricOverview';
import { TenantPanel } from '../../components/ui/TenantPanel';
import { TenantHeader } from '../../components/ui/TenantHeader';

import './GeofenceRulesPage.scss';
import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Camera,
  ShieldCheck,
  Building,
  Plus,
  Edit,
  Save,
  Users,
  Navigation,
  Layers
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { EmployeeDirectory } from '../../components/employees/EmployeeDirectory';
import { geofenceApi } from '../../lib/geofenceApi';
import { AttendanceRulesEditor } from '../../components/employees/AttendanceRulesEditor';
import { getGeofenceGroups,getAllEmployeeGeofenceSettings } from '../../lib/geofenceStore';

export function GeofenceRulesPage({ api, onShowToast, onSelectEmployee }) {
  const campusFormId = React.useId();
  const [departmentSaving, setDepartmentSaving] = useState(false);
  const [department, setDepartment] = useState('');
  const [departmentResult, setDepartmentResult] = useState('');
  const [activeTab, setActiveTab] = useState('individual'); // 'individual' or 'groups'
  const [groups, setGroups] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savingGroup,setSavingGroup]=useState(false);
  const [ruleLoading,setRuleLoading]=useState(false);
  const [ruleSaving,setRuleSaving]=useState(false);
  const [importing,setImporting]=useState(false);
  const selectionRequest=React.useRef(0);
  const [loadError, setLoadError] = useState('');

  // Left-side editor; the shared person picker stays on the right.
  const [selectedEmp, setSelectedEmp] = useState(null);
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

  useEffect(() => {
    let alive=true;setLoading(true);setLoadError('');
    Promise.all([geofenceApi.people(),geofenceApi.sites()]).then(([people,sites])=>{if(alive){setEmployees(people);setGroups(sites);}}).catch(e=>{if(alive)setLoadError(e.message);}).finally(()=>{if(alive)setLoading(false);});
    return()=>{alive=false;selectionRequest.current++;};
  },[]);
  async function handleOpenEditEmp(emp) {
    if(ruleSaving||importing)return;
    const request=++selectionRequest.current;setRuleLoading(true);setSaveError('');setSelectedEmp(null);
    try {const record=await geofenceApi.employee(emp.userid);if(request===selectionRequest.current)setSelectedEmp(record);}
    catch(e){if(request===selectionRequest.current)setSaveError(e.message);}
    finally{if(request===selectionRequest.current)setRuleLoading(false);}
  }
  async function saveRule(values) {
    setRuleSaving(true);
    try {
    const userid=selectedEmp.userid;
    await geofenceApi.saveEmployee(userid,{...values,dossier_revision:selectedEmp.dossier_revision});
    const record=await geofenceApi.employee(userid);setSelectedEmp(record);
    setEmployees(rows=>rows.map(row=>row.userid===userid?{...row,...record}:row));
    onShowToast?.({type:'success',title:'Attendance rules saved',message:'Updated in the employee dossier and Geofence & Photo Rules.'});
    } finally {setRuleSaving(false);}
  }
  const browserSites=getGeofenceGroups();
  const browserRules=Object.entries(getAllEmployeeGeofenceSettings()||{}).filter(([id,rule])=>rule?.updated_at&&employees.some(emp=>emp.userid===id));
  async function importBrowserSettings() {
    setImporting(true);setLoadError('');
    try {
      const sites=[...await geofenceApi.sites()];
      for(const site of browserSites)if(!sites.some(row=>row.group_id===site.group_id))sites.push(await geofenceApi.saveSite({...site,revision:0,latitude:Number(site.latitude),longitude:Number(site.longitude),radius_meters:Number(site.radius_meters)}));
      for(const [userid,rule] of browserRules) {
        const employee=await geofenceApi.employee(userid);
        if(employee.attendance_rule)continue;
        await geofenceApi.saveEmployee(userid,{dossier_revision:employee.dossier_revision,attendance_rule:{mode:rule.mode==='custom'?'custom':'group',group_id:rule.group_id,name:rule.custom_location_name,latitude:Number(rule.custom_latitude),longitude:Number(rule.custom_longitude),radius_meters:Number(rule.custom_radius_meters),photo_required:rule.photo_required===true,allow_wfh:rule.allow_wfh===true,status:rule.status==='Enforced'?'Enforced':'Paused',notes:rule.notes||''}});
      }
      onShowToast?.({type:'success',title:'Browser settings imported',message:'Existing database records were preserved.'});
    }catch(e){setLoadError(e.message);}
    finally {
      try{const [people,sites]=await Promise.all([geofenceApi.people(),geofenceApi.sites()]);setEmployees(people);setGroups(sites);if(selectedEmp)setSelectedEmp(await geofenceApi.employee(selectedEmp.userid));}catch(e){setLoadError(e.message);}
      setImporting(false);
    }
  }

  // Save New Group Geofence
  const handleSaveGroup = async (e) => {
    e.preventDefault();
    const newGroupId = groupForm.group_id || crypto.randomUUID();
    const toSave = {
      ...groupForm,
      group_id: newGroupId,
      revision: groupForm.revision || 0,
      latitude: Number(groupForm.latitude),
      longitude: Number(groupForm.longitude),
      radius_meters: Number(groupForm.radius_meters)
    };
    setSavingGroup(true);setSaveError('');
    try {
      const updated = await geofenceApi.saveSite(toSave);
      setGroups(rows=>[...rows.filter(row=>row.group_id!==updated.group_id),updated]);
      if(selectedEmp)setSelectedEmp(await geofenceApi.employee(selectedEmp.userid));
    } catch (error) {
      setSaveError(error.message);
      onShowToast?.({ type: 'error', title: 'Could not save campus', message: error.message });
      return;
    } finally {setSavingGroup(false);}
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

  const rules = employees.map(emp=>emp.attendance_rule).filter(Boolean);

  return (
    <div className="geofence-console">
      <TenantHeader
        settings={{
          heading: "Geofence & Photo Rules",
          paragraph: "Manage attendance locations, photo requirements, and work-from-home exceptions.",
          subheading: (['HRMS', 'Attendance', 'Geofence & Photo Rules']).join(' / '),
        }}
      />


      {loadError&&<p className="geofence-editor-error" role="alert">{loadError}</p>}
      {saveError&&!isAddGroupModalOpen&&<p className="geofence-editor-error" role="alert">{saveError}</p>}

      {/* KPI Highlights */}
      <MetricOverview as="div" loading={loading}>
        <MetricCard loading={loading} label="Campus sites" icon={Building} value={groups.length} caption="Saved campus locations" />

        <MetricCard loading={loading} label="Custom geofences" icon={MapPin} value={rules.filter((rule) => rule.mode === 'custom').length} caption="Employee-specific locations" />

        <MetricCard loading={loading} label="Photo verification" icon={Camera} value={rules.filter((rule) => rule.photo_required).length} caption="Employees requiring a punch photo" />

        <MetricCard loading={loading} label="Work-from-home access" icon={Navigation} value={rules.filter((rule) => rule.allow_wfh).length} caption="Configured employee exceptions" />
      </MetricOverview>

      <ViewTabs value={activeTab} onChange={setActiveTab} disabled={departmentSaving || ruleSaving || importing} label="Attendance rule views" tabs={[{id:'individual',label:'Employee rules',icon:Users},{id:'departments',label:'Department rules',icon:Layers},{id:'groups',label:'Campus sites',icon:Building}]} />
      {activeTab === 'departments' && <TenantPanel className="geofence-editor geofence-department-editor" title="Department rules" subtitle="Apply the same attendance policy to an entire team." icon={Layers}>
        <div className="geofence-department-picker"><label>Department<select value={department} disabled={loading || departmentSaving} onChange={event=>{setDepartment(event.target.value);setDepartmentResult('');}}><option value="">Choose department</option>{[...new Set(employees.map(person=>person.department).filter(Boolean))].sort().map(name=><option key={name} value={name}>{name}</option>)}</select></label>{department && <p>{employees.filter(person=>person.department === department).length} {employees.filter(person=>person.department === department).length === 1 ? 'employee' : 'employees'} / Replaces individual location and photo rules.</p>}</div>
        {departmentResult && <p className="geofence-rule-prompt" role="status">{departmentResult}</p>}
        <div className="geofence-editor-content">{!department && <div className="geofence-empty"><Layers size={32} aria-hidden="true" /><h3>Choose a department</h3><p>Select a team above to configure its location and photo requirements.</p></div>}
        {department && <AttendanceRulesEditor key={department} compact departmentMode employee={{userid:'department:'+department,dossier_revision:0,available_locations:groups}} onSave={async values=>{
          setDepartmentSaving(true);
          try {
          const members=employees.filter(person=>person.department === department);
          let saved=0; const failures=[];
          for(const member of members) { try { const current=await geofenceApi.employee(member.userid); await geofenceApi.saveEmployee(member.userid,{dossier_revision:current.dossier_revision,attendance_rule:values.attendance_rule}); saved++; } catch(error) { failures.push([member.first_name,member.last_name].filter(Boolean).join(' ')); } }
          setDepartmentResult(saved+' of '+members.length+' employee rules updated.');
          setEmployees(await geofenceApi.people());
          if(failures.length) throw new Error('Could not update '+failures.join(', ')+'. Review and retry.');
          onShowToast?.({type:'success',title:'Department rules saved',message:saved+' employee rules updated.'});
          } finally { setDepartmentSaving(false); }
        }} />}
      </div></TenantPanel>}

      {/* TAB 1: INDIVIDUAL PERSON GEOFENCE */}
      {activeTab === 'individual' && (
        <div className="employee-workspace workspace-grid geofence-rules-workspace">
          {ruleLoading ? <TenantPanel className="geofence-editor" title="Attendance rules" subtitle="Loading employee settings" icon={ShieldCheck}><div className="geofence-empty" role="status"><span className="skeleton geofence-loading-placeholder" /><p>Loading attendance rules...</p></div></TenantPanel> : selectedEmp ? (
            <TenantPanel className="geofence-editor" title={[selectedEmp.first_name, selectedEmp.last_name].filter(Boolean).join(' ')} subtitle={selectedEmp.department || 'Employee attendance policy'} icon={ShieldCheck}>
              <div className="geofence-editor-content"><AttendanceRulesEditor compact employee={selectedEmp} onSave={saveRule}/></div>
            </TenantPanel>
          ) : (
            <TenantPanel className="geofence-editor" title="Employee attendance rules" subtitle="Choose an employee from the directory to get started." icon={ShieldCheck}>
              <div className="geofence-empty"><Users size={36} aria-hidden="true" /><h3>Attendance rules, tailored to each person</h3><p>Manage where employees check in and the verification they need.</p></div>
              <div className="geofence-rule-options">
                {[[MapPin, 'Location boundary', 'Assign a campus or an individual location.'], [Camera, 'Photo verification', 'Require a photo with each attendance punch.'], [Navigation, 'Remote work', 'Allow work-from-home attendance.']].map(([Icon, title, description]) => <div key={title}><Icon size={18} aria-hidden="true" /><div><h3>{title}</h3><p>{description}</p></div></div>)}
              </div>
            </TenantPanel>
          )}
          <EmployeeDirectory pageSize={6} employees={employees} selectedId={selectedEmp?.userid} onSelect={handleOpenEditEmp} loading={loading} error={loadError} subtitle="Select an employee to manage attendance rules." />
        </div>
      )}

      {/* TAB 2: GROUP-BASED CAMPUS SITES */}
      {activeTab === 'groups' && (
        <TenantPanel className="geofence-sites-panel" title="Campus sites" subtitle="Manage office locations and attendance boundaries." actions={[{id:'add-site',variant:'colored',iconOnly:true,icon:Plus,'aria-label':'Add campus site',title:'Add campus site',disabled:loading,onClick:()=>{setGroupForm({group_id:'',name:'',type:'Regional Office',latitude:'',longitude:'',radius_meters:250,photo_required:true,address:''});setSaveError('');setIsAddGroupModalOpen(true);}}]} >
          <div className="workspace-grid geofence-sites-grid">
            {groups.length === 0 && <div className="geofence-sites-empty"><span className="geofence-sites-empty-icon"><MapPin size={26} /></span><h3>{loading ? 'Loading campus sites' : 'Add your first campus'}</h3><p>{loading ? 'Fetching saved locations.' : 'Define a location and radius, then assign it to employees or a department.'}</p>{!loading && <Button variant="outline" size="sm" icon={Plus} onClick={()=>{setGroupForm({group_id:'',name:'',type:'Regional Office',latitude:'',longitude:'',radius_meters:250,photo_required:true,address:''});setSaveError('');setIsAddGroupModalOpen(true);}}>Add site</Button>}</div>}
            {groups.map(grp => <TenantPanel key={grp.group_id} className="geofence-site-card card--blue" title={grp.name} subtitle={grp.address || grp.type} icon={Building} headingLevel={3}
              controls={<Button variant="fadeout" iconOnly size="sm" icon={Edit} aria-label={'Edit ' + grp.name} title="Edit campus site" onClick={() => {setSaveError('');setGroupForm({...grp});setIsAddGroupModalOpen(true);}} />}>
              <dl className="geofence-site-details">
                <div><dt>Site type</dt><dd>{grp.type}</dd></div>
                <div><dt>Boundary radius</dt><dd>{grp.is_unrestricted ? 'Unrestricted' : grp.radius_meters + ' metres'}</dd></div>
                <div><dt>Coordinates</dt><dd>{grp.is_unrestricted ? 'Any location' : grp.latitude + ', ' + grp.longitude}</dd></div>
                <div><dt>Punch photo</dt><dd><Badge variant={grp.photo_required ? 'warning' : 'neutral'}>{grp.photo_required ? 'Required' : 'Optional'}</Badge></dd></div>
              </dl>
            </TenantPanel>)}
          </div>
        </TenantPanel>
      )}

      {/* ADD GROUP GEOFENCE SITE MODAL */}
      <Modal
        isOpen={isAddGroupModalOpen}
        onClose={() => {if(!savingGroup)setIsAddGroupModalOpen(false);}}
        title={groupForm.group_id ? "Edit campus site" : "Add campus site"}
        size="md"
        className="campus-site-editor"
        subtitle="Set the location boundary and punch requirements."
        busy={savingGroup}
        footer={<><Button variant="outline" disabled={savingGroup} onClick={()=>setIsAddGroupModalOpen(false)}>Cancel</Button><Button variant="colored" icon={Save} type="submit" form={campusFormId} loading={savingGroup}>Save site</Button></>}
      >
        <form id={campusFormId} onSubmit={handleSaveGroup} className="campus-site-form"><fieldset disabled={savingGroup}>
          {saveError && <p role="alert" className="geofence-editor-error">{saveError}</p>}
          {!groupForm.group_id && <label>Site template<select defaultValue="" onChange={event => { const templates={office:{type:'Office',radius_meters:150,photo_required:true},campus:{type:'Campus',radius_meters:300,photo_required:true},branch:{type:'Branch office',radius_meters:100,photo_required:false}}; if(templates[event.target.value])setGroupForm(current=>({...current,...templates[event.target.value]})); }}><option value="">Custom site</option><option value="office">Office / 150 m</option><option value="campus">Campus / 300 m</option><option value="branch">Branch / 100 m</option></select></label>}
          <label>Site name<input required maxLength={200} value={groupForm.name} onChange={event=>setGroupForm({...groupForm,name:event.target.value})} placeholder="e.g. Pune office" /></label>
          <label>Address<input value={groupForm.address} maxLength={500} onChange={event=>setGroupForm({...groupForm,address:event.target.value})} placeholder="Street address" /></label>
          <div className="campus-site-grid"><label>Latitude<input type="number" step="any" required min="-90" max="90" value={groupForm.latitude} onChange={event=>setGroupForm({...groupForm,latitude:event.target.value})} /></label><label>Longitude<input type="number" step="any" required min="-180" max="180" value={groupForm.longitude} onChange={event=>setGroupForm({...groupForm,longitude:event.target.value})} /></label></div>
          <div className="campus-site-grid"><label>Radius (metres)<input type="number" required min={groupForm.is_unrestricted ? 0 : 10} max="10000" value={groupForm.radius_meters} onChange={event=>setGroupForm({...groupForm,radius_meters:event.target.value})} /></label><div className="campus-photo-rule"><label htmlFor="campus-photo-required">Photo required<small>Photo with each punch.</small></label><Toggle id="campus-photo-required" checked={groupForm.photo_required} disabled={savingGroup} onChange={checked=>setGroupForm({...groupForm,photo_required:checked})} /></div></div>
          {!groupForm.is_unrestricted && <GeofencePreview latitude={groupForm.latitude} longitude={groupForm.longitude} radius={groupForm.radius_meters} />}
        </fieldset></form>
      </Modal>
    </div>
  );
}
