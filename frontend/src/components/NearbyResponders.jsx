/**
 * NearbyResponders panel
 * Shows a sorted list of emergency units near the user's current location.
 */

const AGENCY_EMOJI = { ambulance: '🚑', fire: '🚒', police: '🚔' };

function formatDist(km) {
  return km < 1
    ? `${(km * 1000).toFixed(0)} m`
    : `${km.toFixed(1)} km`;
}

export default function NearbyResponders({ nearbyResponders, locError, locLoading }) {
  return (
    <div className="nearby-panel">
      <div className="nearby-header">
        <span className="nearby-title">📍 Responders Near You</span>
        {locLoading && <span className="spinner-small" />}
      </div>

      {locError && (
        <div className="nearby-error">
          ⚠ {locError} — Showing all available units.
        </div>
      )}

      {!locLoading && !locError && nearbyResponders.length === 0 && (
        <div className="nearby-empty">No units found.</div>
      )}

      <div className="nearby-list">
        {nearbyResponders.slice(0, 8).map((res, i) => (
          <div
            key={res.id}
            className={`nearby-item ${res.status === 'available' ? 'available' : 'busy'}`}
          >
            <div className="nearby-rank">#{i + 1}</div>
            <div className="nearby-emoji">
              {AGENCY_EMOJI[res.agency] || '📍'}
            </div>
            <div className="nearby-info">
              <span className="nearby-unit">{res.unit_name}</span>
              <span className="nearby-agency">{res.agency}</span>
            </div>
            <div className="nearby-right">
              <span className="nearby-dist">
                {res.distKm != null ? formatDist(res.distKm) : '—'}
              </span>
              <span className={`nearby-status ${res.status}`}>
                {res.status === 'available' ? 'Available' : 'Busy'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
