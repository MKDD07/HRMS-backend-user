// Only metadata stored with the historical punch is used, never the admin's browser.
const object = value => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') { try { const parsed = JSON.parse(value); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}; } catch {} }
  return {};
};
const flag = value => value === true || value === 1 || ['true','1','yes'].includes(String(value).trim().toLowerCase()) ? true : value === false || value === 0 || ['false','0','no'].includes(String(value).trim().toLowerCase()) ? false : null;
export function punchEvidence(record) {
  const metadata = object(record.metadata);
  const sources = [record, metadata, object(record.device_info), object(metadata.device_info), object(record.location), object(metadata.location), object(record.location_info)];
  const pick = keys => {
    for (const source of sources) for (const key of keys) if (source[key] != null && source[key] !== '' && typeof source[key] !== 'object') return source[key];
    return null;
  };
  const flags = sources.flatMap(source => ['is_mock_location', 'mock_location', 'isMockLocation', 'is_mocked', 'mocked', 'isFromMockProvider', 'is_from_mock_provider', 'location_spoofed'].filter(key => Object.hasOwn(source,key)).map(key => flag(source[key]))).filter(value => value !== null);
  return {
    mock: flags.includes(true) ? true : flags.includes(false) ? false : null,
    fields: [
      ['Browser', pick(['browser_name','browser'])], ['Browser version',pick(['browser_version'])],
      ['Device name',pick(['device_name','device_model','model'])], ['Device type',pick(['device_type'])],
      ['Operating system',pick(['os_name','operating_system','os','platform'])], ['OS version',pick(['os_version'])],
      ['IP address',pick(['ip_address','ip'])], ['Attendance source',pick(['attendance_source','source','provider'])],
      ['Latitude',pick(['latitude','lat','check_in_latitude'])], ['Longitude',pick(['longitude','lng','lon','check_in_longitude'])],
      ['GPS accuracy (m)',pick(['location_accuracy','gps_accuracy','accuracy'])], ['Geofence distance (m)',pick(['check_in_distance','geofence_distance'])],
      ['Geofence result',pick(['geofence_status'])], ['Recorded at',pick(['created_at','timestamp'])],
      ['User agent',pick(['user_agent','userAgent'])]
    ]
  };
}
export function mockLocationSignals(record) {
  const keys = ['is_mock_location','mock_location','isMockLocation','is_mocked','mocked','isFromMockProvider','is_from_mock_provider','location_spoofed'];
  const expand = source => {
    const root = object(source);
    return [root, object(root.device_info), object(root.location), object(root.location_info), object(root.metadata)];
  };
  const roots = [record, object(record.metadata)];
  const evaluate = values => { const parsed = values.map(flag).filter(value => value !== null); return parsed.includes(true) ? true : parsed.includes(false) ? false : null; };
  const phase = (names) => {
    const values = [];
    for (const root of roots) for (const name of names) {
      for (const suffix of ['mock_location','is_mock_location','is_mocked','isMockLocation']) values.push(root[`${name}_${suffix}`]);
      for (const source of [...expand(root[name]), ...expand(root[`${name}_metadata`]), ...expand(root[`${name}_location`]), ...expand(root[`${name}_device_info`])]) for (const key of keys) values.push(source[key]);
    }
    return evaluate(values);
  };
  const checkIn = phase(['check_in','checkin','punch_in']);
  const checkOut = phase(['check_out','checkout','punch_out']);
  const general = evaluate(roots.flatMap(root => expand(root).flatMap(source => keys.map(key => source[key]))));
  return { checkIn, checkOut, general, any: checkIn === true || checkOut === true || general === true };
}
export function safeLogValue(value) {
  if (Array.isArray(value)) return value.map(safeLogValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !/password|passwd|token|secret|otp|salt|hash|credential|api_?key/i.test(key)).map(([key,item]) => [key,safeLogValue(item)]));
  if (typeof value === 'string' && /^[\[{]/.test(value.trim())) { try { return safeLogValue(JSON.parse(value)); } catch {} }
  return value;
}
