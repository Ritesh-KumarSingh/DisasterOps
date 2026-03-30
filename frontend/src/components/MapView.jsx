import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Marker, Polygon, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useEffect as useEff } from 'react';
import 'leaflet/dist/leaflet.css';

const SEVERITY_COLORS = {
  5: '#dc2626',
  4: '#ea580c',
  3: '#2563eb',
  2: '#16a34a',
  1: '#16a34a',
};

const HAZARD_COLORS = {
  flood:      { color: '#3b82f6', fillColor: '#3b82f6' },
  fire:       { color: '#dc2626', fillColor: '#dc2626' },
  structural: { color: '#ea580c', fillColor: '#ea580c' },
};

const AGENCY_ICONS = {
  ambulance: '🚑',
  fire:      '🚒',
  police:    '🚔',
};

// ─── Haversine distance (km) ───────────────────────────────────────────────
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Icon builders ────────────────────────────────────────────────────────
function createAgencyIcon(agency, status, distanceKm) {
  const emoji   = AGENCY_ICONS[agency] || '📍';
  const busy    = status === 'busy';
  const nearby  = distanceKm !== null && distanceKm < 3;
  const ring    = nearby && !busy
    ? 'box-shadow:0 0 0 3px #16a34a;border-radius:50%'
    : '';
  return L.divIcon({
    html: `<div style="font-size:24px;opacity:${busy ? 0.45 : 1};filter:${busy ? 'grayscale(60%)' : 'none'};${ring};text-shadow:0 2px 4px rgba(0,0,0,0.2)">${emoji}</div>`,
    className: 'resource-icon',
    iconSize:   [30, 30],
    iconAnchor: [15, 15],
  });
}

const userIcon = L.divIcon({
  html: `<div style="
    width:20px;height:20px;
    border-radius:50%;
    background:#2563eb;
    border:3px solid #fff;
    box-shadow:0 0 0 4px rgba(37,99,235,.25),0 2px 8px rgba(0,0,0,.3);
  "></div>`,
  className: '',
  iconSize:   [20, 20],
  iconAnchor: [10, 10],
});

// ─── Sub-component: fly to user location when it becomes known ────────────
function FlyToUser({ userLoc }) {
  const map = useMap();
  useEffect(() => {
    if (userLoc) {
      map.flyTo([userLoc.lat, userLoc.lng], 14, { duration: 1.4 });
    }
  }, [userLoc]);
  return null;
}

// ─── Sub-component: fit bounds to data if no user location ───────────────
function FitBoundsToData({ incidents, resources, userLoc }) {
  const map = useMap();
  useEffect(() => {
    if (userLoc) return; // if we have user location, FlyToUser handles it
    const points = [
      ...incidents.map(i => [i.lat, i.lng]),
      ...resources.map(r => [r.lat, r.lng]),
    ];
    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points).pad(0.15));
    }
    setTimeout(() => map.invalidateSize(), 200);
  }, []);
  return null;
}

// ─── Main MapView ─────────────────────────────────────────────────────────
export default function MapView({
  incidents,
  resources,
  hazardZones,
  activeEvents = [],
  onIncidentClick,
  selectedIncident,
  userLoc,       // passed in from parent (lat, lng, accuracy)
}) {
  // Default center: world-ish view until we know location
  const defaultCenter = [20.5937, 78.9629]; // India center — generic fallback
  const center = userLoc ? [userLoc.lat, userLoc.lng] : defaultCenter;

  return (
    <MapContainer
      center={center}
      zoom={userLoc ? 14 : 5}
      style={{ width: '100%', height: '100%' }}
      zoomControl={true}
    >
      {/* Carto Light tiles */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />

      <FlyToUser userLoc={userLoc} />
      <FitBoundsToData incidents={incidents} resources={resources} userLoc={userLoc} />

      {/* ── User Location Marker ── */}
      {userLoc && (
        <Marker position={[userLoc.lat, userLoc.lng]} icon={userIcon}>
          <Popup>
            <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '13px' }}>
              <strong>📍 Your Location</strong>
              {userLoc.accuracy && (
                <><br />Accuracy: ±{Math.round(userLoc.accuracy)} m</>
              )}
            </div>
          </Popup>
        </Marker>
      )}

      {/* ── Hazard Zones ── */}
      {hazardZones.map((hz) => {
        const colors = HAZARD_COLORS[hz.type] || HAZARD_COLORS.structural;
        
        // Handle Polygon (legacy/static)
        if (hz.polygon) {
          return (
            <Polygon
              key={hz.id || `${hz.lat}-${hz.lng}`}
              positions={hz.polygon.map(p => [p[0], p[1]])}
              pathOptions={{
                color:      colors.color,
                fillColor:  colors.fillColor,
                fillOpacity: 0.18,
                weight: 2,
                dashArray: '6 4',
              }}
            >
              <Popup>
                <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '13px' }}>
                  <strong>{hz.type.toUpperCase()} Zone</strong><br />
                  Risk: {(hz.risk_level * 100)?.toFixed(0) || 100}%
                </div>
              </Popup>
            </Polygon>
          );
        }

        // Handle Circle (AI Predicted)
        if (hz.lat && hz.lng) {
          return (
            <CircleMarker
              key={hz.id || `${hz.lat}-${hz.lng}`}
              center={[hz.lat, hz.lng]}
              radius={hz.radius_km * 25} // Scaling factor
              pathOptions={{
                color:      '#ef4444',
                fillColor:  '#ef4444',
                fillOpacity: 0.1,
                weight: 2,
                dashArray: '5 5',
              }}
            >
              <Popup>
                <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '13px' }}>
                  <strong>✨ AI PREDICTED: {hz.name}</strong><br />
                  Type: {hz.type.toUpperCase()}<br />
                  <em>{hz.reason}</em>
                </div>
              </Popup>
            </CircleMarker>
          );
        }

        return null;
      })}

      {/* ── Disaster Events (Epicenters & Zones) ── */}
      {activeEvents.map(ev => {
        const evColor = ev.severity >= 4 ? '#ef4444' : ev.severity >= 3 ? '#f97316' : '#eab308';
        return (
          <div key={`evt-group-${ev.id}`}>
            {/* Epicenter Pulse */}
            <CircleMarker
              center={[ev.lat, ev.lng]}
              radius={24}
              pathOptions={{
                color: evColor,
                fillColor: evColor,
                fillOpacity: 0.15,
                weight: 2,
                dashArray: '10 5'
              }}
            >
              <Popup>
                <strong>Epicenter: {ev.type.toUpperCase()}</strong><br />
                {ev.location_name}<br/>Severity: {ev.severity}/5
              </Popup>
            </CircleMarker>
            
            {/* Zones for this event */}
            {ev.zones?.map(z => {
              const zColor = z.type === 'safe' ? '#22c55e' : z.type === 'unsafe' ? '#ef4444' : '#f59e0b';
              return (
                <CircleMarker
                  key={z.id}
                  center={[z.lat, z.lng]}
                  radius={z.radius_km * 20} // arbitrary scaling for visual radius if not using actual geo circles
                  pathOptions={{
                    color: zColor,
                    fillColor: zColor,
                    fillOpacity: 0.15,
                    weight: 1.5
                  }}
                >
                  <Popup>
                    <strong>{z.name || z.type.toUpperCase() + ' ZONE'}</strong><br />
                    Radius: {z.radius_km} km
                  </Popup>
                </CircleMarker>
              );
            })}
          </div>
        );
      })}


      {/* ── Incident Markers ── */}
      {incidents.map((inc) => {
        const isSelected = selectedIncident?.id === inc.id;
        return (
          <CircleMarker
            key={inc.id}
            center={[inc.lat, inc.lng]}
            radius={isSelected ? 14 : inc.severity >= 4 ? 10 : 7}
            pathOptions={{
              color:       isSelected ? '#ffffff' : SEVERITY_COLORS[inc.severity],
              fillColor:   SEVERITY_COLORS[inc.severity],
              fillOpacity: 0.9,
              weight:      isSelected ? 3 : 2,
            }}
            eventHandlers={{ click: () => onIncidentClick(inc) }}
          >
            <Popup>
              <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '13px', minWidth: '180px' }}>
                <strong>{inc.type.toUpperCase()}</strong> — Severity {inc.severity}<br />
                Score: <strong>{inc.priority_score}</strong><br />
                {inc.location_desc}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}

      {/* ── Resource / Responder Markers ── */}
      {resources.map((res) => {
        const distKm = userLoc
          ? haversineKm(userLoc.lat, userLoc.lng, res.lat, res.lng)
          : null;

        return (
          <Marker
            key={res.id}
            position={[res.lat, res.lng]}
            icon={createAgencyIcon(res.agency, res.status, distKm)}
          >
            <Popup>
              <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '13px', minWidth: '170px' }}>
                <strong>{res.unit_name}</strong><br />
                Agency: {res.agency}<br />
                Status: <span style={{
                  color: res.status === 'available' ? '#16a34a' : '#ea580c',
                  fontWeight: 700,
                }}>{res.status}</span><br />
                Skills: {res.skills.join(', ')}<br />
                {distKm !== null && (
                  <span style={{ color: '#2563eb', fontWeight: 600 }}>
                    📍 {distKm < 1 ? `${(distKm * 1000).toFixed(0)} m away` : `${distKm.toFixed(1)} km away`}
                  </span>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
