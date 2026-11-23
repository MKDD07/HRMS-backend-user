import React from 'react';
export function GeofencePreview({ latitude, longitude, radius }) {
  const lat = Number(latitude), lng = Number(longitude), metres = Number(radius);
  if (latitude === '' || longitude === '' || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || !Number.isFinite(metres) || metres <= 0) return null;
  const dy = metres * 1.7 / 111320, dx = dy / Math.max(.01, Math.cos(lat * Math.PI / 180));
  const bbox = [lng-dx, lat-dy, lng+dx, lat+dy].join(',');
  return <div className="geofence-map-preview"><div className="geofence-map-frame"><iframe title="Location boundary map" loading="lazy" src={`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat},${lng}`} /><span className="geofence-map-radius" aria-hidden="true" /></div><p>{metres} m radius (approximate preview) <a href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`} target="_blank" rel="noopener noreferrer">Open map</a></p></div>;
}
