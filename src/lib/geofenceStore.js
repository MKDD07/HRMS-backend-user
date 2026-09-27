// Geofence & Biometric Verification Store
// Supports:
// 1. Group-based geofence policies (e.g. HQ Campus, Tech Park Hub, Regional Hub)
// 2. Separate / Individual person geofence coordinates & allowable radius
// 3. Photo / Camera selfie requirement toggle ("photo if needed or not") per person or group

// Legacy signatures are used only to hide untouched demo sites from older browser storage.
// Edited and user-created sites are retained. These records are never seeded.
const LEGACY_SEEDED_GROUPS = [
  {
    group_id: 'group-hq',
    name: 'HQ Vashi Infotech Park Campus',
    type: 'Primary Corporate HQ',
    latitude: 19.0657,
    longitude: 72.9984,
    radius_meters: 250,
    photo_required: true,
    address: 'Sector 30A, Vashi, Navi Mumbai, Maharashtra 400703',
    assigned_departments: ['Engineering & Technology', 'Product & Design', 'Human Resources', 'Finance & Payroll']
  },
  {
    group_id: 'group-blr',
    name: 'Bengaluru R&D Technology Center',
    type: 'Regional Tech Center',
    latitude: 12.9716,
    longitude: 77.5946,
    radius_meters: 300,
    photo_required: true,
    address: 'Outer Ring Road, Bellandur, Bengaluru, Karnataka 560103',
    assigned_departments: ['Cloud Infrastructure', 'Security & Compliance']
  },
  {
    group_id: 'group-del',
    name: 'Delhi NCR Business & Client Hub',
    type: 'Sales & Client Hub',
    latitude: 28.6139,
    longitude: 77.2090,
    radius_meters: 200,
    photo_required: false,
    address: 'Barakhamba Road, Connaught Place, New Delhi 110001',
    assigned_departments: ['Sales & Operations']
  },
  {
    group_id: 'group-remote',
    name: 'Remote / Field Flexible Work',
    type: 'Unrestricted Location',
    latitude: 0,
    longitude: 0,
    radius_meters: 0,
    photo_required: false,
    is_unrestricted: true,
    address: 'Global Work-From-Anywhere Approved',
    assigned_departments: ['Field Consultants', 'Executive Board']
  }
];

export function getGeofenceGroups() {
  try {
    const stored = JSON.parse(localStorage.getItem('pulse_geofence_groups') || '[]');
    if (!Array.isArray(stored)) return [];
    return stored.filter((group) => group && !LEGACY_SEEDED_GROUPS.some((seed) =>
      Object.keys(group).length === Object.keys(seed).length &&
      Object.keys(seed).every((key) => JSON.stringify(group[key]) === JSON.stringify(seed[key]))));
  } catch (error) {
    console.error(error);
    return [];
  }
}

export function saveGeofenceGroup(group) {
  const list = getGeofenceGroups();
  const idx = list.findIndex((g) => g.group_id === group.group_id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...group };
  } else {
    list.push(group);
  }
  localStorage.setItem('pulse_geofence_groups', JSON.stringify(list));
  return list;
}

export function deleteGeofenceGroup(group_id) {
  const list = getGeofenceGroups().filter((g) => g.group_id !== group_id);
  try {
    localStorage.setItem('pulse_geofence_groups', JSON.stringify(list));
  } catch (e) {
    console.error(e);
  }
  return list;
}

// -------------------------------------------------------------
// INDIVIDUAL PERSON GEOFENCE SETTINGS
// -------------------------------------------------------------

export function getAllEmployeeGeofenceSettings() {
  try {
    const raw = localStorage.getItem('pulse_employee_geofences');
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error(e);
  }
  return {};
}

export function getEmployeeGeofenceRule(userid, employee = {}) {
  const all = getAllEmployeeGeofenceSettings();
  if (all[userid]) {
    return all[userid];
  }

  return {
    userid,
    mode: 'group',
    group_id: '',
    custom_location_name: '',
    custom_latitude: '',
    custom_longitude: '',
    custom_radius_meters: 200,
    photo_required: false,
    allow_wfh: false,
    status: 'Not configured'
  };
}

export function saveEmployeeGeofenceRule(userid, rule) {
  const all = getAllEmployeeGeofenceSettings();
  all[userid] = {
    ...rule,
    userid,
    updated_at: new Date().toISOString()
  };
  localStorage.setItem('pulse_employee_geofences', JSON.stringify(all));
  return all[userid];
}

// Get effective resolved geofence for punch check-in
export function getResolvedGeofence(userid, employee = {}) {
  const rule = getEmployeeGeofenceRule(userid, employee);
  if (!rule.updated_at || rule.status !== 'Enforced') return null;
  if (rule.mode === 'custom') {
    return {
      type: 'Individual Custom Geofence',
      name: rule.custom_location_name || 'Designated Individual Site',
      latitude: Number(rule.custom_latitude),
      longitude: Number(rule.custom_longitude),
      radius_meters: Number(rule.custom_radius_meters || 200),
      photo_required: Boolean(rule.photo_required),
      mode: 'custom'
    };
  }

  // Look up group
  const groups = getGeofenceGroups();
  const group = groups.find((g) => g.group_id === rule.group_id);
  if (!group) return null;

  return {
    type: `Group Policy (${group.name})`,
    name: group.name,
    latitude: group.latitude,
    longitude: group.longitude,
    radius_meters: group.radius_meters,
    photo_required: Boolean(rule.photo_required !== undefined ? rule.photo_required : group.photo_required),
    mode: 'group',
    is_unrestricted: Boolean(group.is_unrestricted)
  };
}
