import { useState } from 'react';
import { useMapState } from '../hooks/useMapState';
import { useUserLocation, useNearbyResponders } from '../hooks/useUserLocation';
import { useDisasterEvents } from '../hooks/useDisasterEvents';
import MapView from '../components/MapView';
import SosForm from '../components/SosForm';
import UserProfile from '../components/UserProfile';
import NearbyResponders from '../components/NearbyResponders';
import ActiveEventBanner from '../components/ActiveEventBanner';

export default function UserPortal() {
  const { incidents, resources, hazardZones, loading, error } = useMapState();
  const { activeEvents } = useDisasterEvents();
  const { userLoc, locError, locLoading } = useUserLocation();
  const nearbyResponders = useNearbyResponders(userLoc, resources);
  const [showSosForm, setShowSosForm] = useState(false);
  const [showNearby, setShowNearby] = useState(true);

  return (
    <div className="user-portal">
      {/* ── Header Bar ── */}
      <header className="citizen-header">
        <div className="citizen-brand">
          <span className="citizen-brand-icon">🛡️</span>
          <div className="citizen-brand-text">
            <span className="citizen-brand-name">DisasterOps Citizen</span>
            <span className="citizen-brand-sub">Emergency Response Network</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Toggle nearby panel */}
          <button
            onClick={() => setShowNearby(v => !v)}
            style={{
              padding: '6px 14px',
              background: showNearby ? 'var(--blue-lt)' : 'var(--bg-subtle)',
              border: '1.5px solid var(--border)',
              borderColor: showNearby ? 'var(--blue)' : 'var(--border)',
              borderRadius: '99px',
              fontSize: '12px',
              fontWeight: 700,
              color: showNearby ? 'var(--blue)' : 'var(--text-2)',
              cursor: 'pointer',
              fontFamily: 'Inter,sans-serif',
              transition: 'var(--ease)',
            }}
          >
            📍 Nearby ({nearbyResponders.filter(r => r.status === 'available').length} available)
          </button>
          <div className="system-status">
            <span className="status-dot" />
            {userLoc ? 'Location Active' : 'System Operational'}
          </div>
        </div>
      </header>

      {/* Active Disaster Banner (Citizen View) */}
      <ActiveEventBanner activeEvents={activeEvents} />

      {/* ── Map ── */}
      <div className="citizen-map">
        {loading && (
          <div className="map-loading">
            <div className="spinner" />
            <p>Syncing safety data…</p>
          </div>
        )}
        {error && (
          <div className="connection-status">
            ⚠ Connection error: {error}
          </div>
        )}

        <MapView
          incidents={incidents}
          resources={resources}
          hazardZones={hazardZones}
          activeEvents={activeEvents}
          onIncidentClick={() => {}}
          selectedIncident={null}
          userLoc={userLoc}
        />

        {/* Locating banner while GPS resolves */}
        {locLoading && (
          <div className="loc-banner">
            <span className="spinner-small" />
            Locating you for nearest responders…
          </div>
        )}

        {/* Nearby Responders Panel */}
        {showNearby && !locLoading && (
          <NearbyResponders
            nearbyResponders={nearbyResponders}
            locError={locError}
            locLoading={locLoading}
          />
        )}

        {/* SOS Button */}
        <button className="sos-button-floating" onClick={() => setShowSosForm(true)}>
          <span className="sos-emoji">🆘</span>
          <span className="sos-label">SOS</span>
        </button>
      </div>

      {/* User Profile */}
      <UserProfile />

      {showSosForm && (
        <SosForm
          onClose={() => setShowSosForm(false)}
          onSubmit={() => setShowSosForm(false)}
          userLoc={userLoc}
        />
      )}
    </div>
  );
}
