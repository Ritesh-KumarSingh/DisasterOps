import { MapContainer, TileLayer, CircleMarker, Marker, Polygon, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect } from 'react';
import 'leaflet/dist/leaflet.css';

const SEVERITY_COLORS = {
  5: '#E24B4A',
  4: '#EF9F27',
  3: '#378ADD',
  2: '#1D9E75',
  1: '#1D9E75',
};

const HAZARD_COLORS = {
  flood: { color: '#378ADD', fillColor: '#378ADD' },
  fire: { color: '#E24B4A', fillColor: '#E24B4A' },
  structural: { color: '#EF9F27', fillColor: '#EF9F27' },
};

const AGENCY_ICONS = {
  ambulance: '🚑',
  fire: '🚒',
  police: '🚔',
};

function createAgencyIcon(agency, status) {
  const emoji = AGENCY_ICONS[agency] || '📍';
  const opacity = status === 'busy' ? 0.5 : 1;
  return L.divIcon({
    html: `<div style="font-size:24px;opacity:${opacity};filter:${status === 'busy' ? 'grayscale(50%)' : 'none'};text-shadow:0 2px 4px rgba(0,0,0,0.3)">${emoji}</div>`,
    className: 'resource-icon',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function MapBoundsAdjust({ incidents, resources }) {
  const map = useMap();
  useEffect(() => {
    const points = [
      ...incidents.map(i => [i.lat, i.lng]),
      ...resources.map(r => [r.lat, r.lng]),
    ];
    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds.pad(0.1));
    }
  }, []);
  return null;
}

export default function MapView({ incidents, resources, hazardZones, onIncidentClick, selectedIncident }) {
  const center = [28.6139, 77.2090]; // Delhi

  return (
    <MapContainer
      center={center}
      zoom={13}
      style={{ width: '100%', height: '100%' }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />

      <MapBoundsAdjust incidents={incidents} resources={resources} />

      {/* Hazard zone polygons */}
      {hazardZones.map((hz) => {
        const colors = HAZARD_COLORS[hz.type] || HAZARD_COLORS.structural;
        return (
          <Polygon
            key={hz.id}
            positions={hz.polygon.map(p => [p[0], p[1]])}
            pathOptions={{
              color: colors.color,
              fillColor: colors.fillColor,
              fillOpacity: 0.2,
              weight: 2,
              dashArray: '6 4',
            }}
          >
            <Popup>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>
                <strong>{hz.type.toUpperCase()} Zone</strong><br />
                Risk Level: {(hz.risk_level * 100).toFixed(0)}%
              </div>
            </Popup>
          </Polygon>
        );
      })}

      {/* Incident markers */}
      {incidents.map((inc) => {
        const isSelected = selectedIncident?.id === inc.id;
        return (
          <CircleMarker
            key={inc.id}
            center={[inc.lat, inc.lng]}
            radius={isSelected ? 14 : inc.severity >= 4 ? 10 : 7}
            pathOptions={{
              color: isSelected ? '#ffffff' : SEVERITY_COLORS[inc.severity] || '#378ADD',
              fillColor: SEVERITY_COLORS[inc.severity] || '#378ADD',
              fillOpacity: 0.85,
              weight: isSelected ? 3 : 2,
            }}
            eventHandlers={{
              click: () => onIncidentClick(inc),
            }}
          >
            <Popup>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', minWidth: '180px' }}>
                <strong>{inc.type.toUpperCase()}</strong> — Severity {inc.severity}<br />
                Score: <strong>{inc.priority_score}</strong><br />
                {inc.location_desc}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}

      {/* Resource markers */}
      {resources.map((res) => (
        <Marker
          key={res.id}
          position={[res.lat, res.lng]}
          icon={createAgencyIcon(res.agency, res.status)}
        >
          <Popup>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', minWidth: '160px' }}>
              <strong>{res.unit_name}</strong><br />
              Agency: {res.agency}<br />
              Status: <span style={{ color: res.status === 'available' ? '#1D9E75' : '#EF9F27', fontWeight: 600 }}>{res.status}</span><br />
              Skills: {res.skills.join(', ')}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
