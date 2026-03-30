import { useState, useEffect, useMemo } from 'react';
import { useMapState, updateAssignmentStatus, resolveAssignment, requestBackup } from '../hooks/useMapState';
import { useNearbyResponders } from '../hooks/useUserLocation';
import { useDisasterEvents } from '../hooks/useDisasterEvents';
import MapView from '../components/MapView';
import UserProfile from '../components/UserProfile';
import NearbyResponders from '../components/NearbyResponders';
import ActiveEventBanner from '../components/ActiveEventBanner';

export default function ResponderPortal() {
  const { incidents, resources, assignments, hazardZones, loading, refetch } = useMapState();
  const { events, activeEvents } = useDisasterEvents();
  const [activeMission, setActiveMission] = useState(null);
  const [showNearby, setShowNearby] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const username = localStorage.getItem('auth_username') || '';

  // Match username like "pol 1", "res_pol_01", "Police Unit 1"
  const myResource = useMemo(() => {
    if (!resources || resources.length === 0) return null;
    const term = username.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Explicit mapping for "pol 1" -> res_pol_01
    const isPol = term.startsWith('pol') && term.length > 3;
    const isAmb = term.startsWith('amb') && term.length > 3;
    const isFire = term.startsWith('fire') && term.length > 4;

    return resources.find(r => {
      const rName = r.unit_name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const rId = r.id.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (term === rName || term === rId) return true;
      if (isPol && rId === `res_pol_0${term.replace('pol', '')}`) return true;
      if (isAmb && rId === `res_amb_0${term.replace('amb', '')}`) return true;
      if (isFire && rId === `res_fire_0${term.replace('fire', '')}`) return true;
      return false;
    });
  }, [username, resources]);

  // Use the resource's known GPS location instead of the browser's HTML5 geolocation
  const userLoc = myResource ? { lat: myResource.lat, lng: myResource.lng, accuracy: 15 } : null;
  const locLoading = loading;
  const locError = !myResource && !loading ? "Resource unit not found for your callsign. Map will not centre." : null;

  const nearbyResponders = useNearbyResponders(userLoc, resources);

  // Find any active (non-resolved) assignment for this resource unit
  const myAssignment = useMemo(() => {
    if (!myResource || !assignments) return null;
    return assignments.find(a =>
      a.resource_id === myResource.id &&
      a.status !== 'resolved'
    );
  }, [myResource, assignments]);

  // Derive the active mission from the assignment's incident (supports backup units too)
  useEffect(() => {
    if (myAssignment && incidents) {
      const mission = incidents.find(i => i.id === myAssignment.incident_id && i.status !== 'resolved');
      setActiveMission(mission || null);
    } else {
      setActiveMission(null);
    }
  }, [myAssignment, incidents]);

  const handleArrive = async () => {
    if (!myAssignment) return;
    setActionLoading(true);
    try {
      await updateAssignmentStatus(myAssignment.id, 'arrived');
      await refetch();
    } catch (err) {
      alert('Failed to update status.');
    }
    setActionLoading(false);
  };

  const handleResolve = async () => {
    if (!myAssignment) return;
    setActionLoading(true);
    try {
      await resolveAssignment(myAssignment.id);
      await refetch();
    } catch (err) {
      alert('Failed to resolve mission.');
    }
    setActionLoading(false);
  };

  const handleBackup = async () => {
    if (!activeMission) return;
    setActionLoading(true);
    try {
      await requestBackup(activeMission.id);
      alert('Backup requested. Stay safe.');
    } catch (err) {
      alert('Failed to request backup.');
    }
    setActionLoading(false);
  };

  return (
    <div className="responder-portal">
      {/* ── Header ── */}
      <header className="responder-header">
        <span style={{ fontSize: '22px' }}>🚑</span>
        <div>
          <div className="responder-callsign">{myResource ? myResource.unit_name.toUpperCase() : username.toUpperCase()}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 500 }}>Field Unit</div>
        </div>
        <div style={{ flex: 1 }} />
        {/* Toggle nearby panel */}
        <button
          onClick={() => setShowNearby(v => !v)}
          style={{
            padding: '5px 12px',
            background: showNearby ? 'var(--blue-lt)' : 'var(--bg-subtle)',
            border: '1.5px solid',
            borderColor: showNearby ? 'var(--blue)' : 'var(--border)',
            borderRadius: '99px',
            fontSize: '11px',
            fontWeight: 700,
            color: showNearby ? 'var(--blue)' : 'var(--text-2)',
            cursor: 'pointer',
            fontFamily: 'Inter,sans-serif',
            marginRight: '10px',
          }}
        >
          📍 Responders Near Me
        </button>
        <div className="responder-status-pill">
          {activeMission ? '🔴 On Mission' : '🟢 Standby'}
        </div>
      </header>

      {/* Active Disaster Banner */}
      <ActiveEventBanner activeEvents={activeEvents} />

      {/* ── Map ── */}
      <div className="responder-map">
        {loading && (
          <div className="map-loading">
            <div className="spinner" />
            <p>Connecting to dispatch…</p>
          </div>
        )}

        <MapView
          incidents={incidents}
          resources={resources}
          hazardZones={hazardZones}
          activeEvents={activeEvents}
          selectedIncident={activeMission}
          onIncidentClick={() => {}}
          userLoc={userLoc}
        />

        {/* Nearby Responders Panel — top-left */}
        {showNearby && !locLoading && (
          <div style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 600 }}>
            <NearbyResponders
              nearbyResponders={nearbyResponders}
              locError={locError}
              locLoading={locLoading}
            />
          </div>
        )}

        {locLoading && (
          <div className="loc-banner">
            <span className="spinner-small" />
            Locating your position…
          </div>
        )}

        {/* Mission Card — bottom-right on responder portal  */}
        <div className="mission-card" style={{ left: 'auto', right: '20px' }}>
          <div className="mission-card-header">
            <span className="mission-status-pill">🚨 Active Mission</span>
            <span className="mission-id">
              #{activeMission ? activeMission.id.slice(-4) : '----'}
            </span>
          </div>

          {activeMission ? (
            <div className="mission-card-body">
              <div className="mission-type">
                {activeMission.type.toUpperCase()} EMERGENCY
              </div>
              <div className="mission-location">
                {activeMission.location_desc || 'No description provided.'}
              </div>
              <div className="mission-details-grid">
                <div className="mission-detail-item">
                  <span className="mission-detail-label">Severity</span>
                  <span className="mission-detail-value">{activeMission.severity}/5</span>
                </div>
                <div className="mission-detail-item">
                  <span className="mission-detail-label">ETA</span>
                  <span className="mission-detail-value">— min</span>
                </div>
              </div>
              <div className="mission-actions">
                {myAssignment?.status === 'arrived' ? (
                  <button 
                    className="mission-btn resolve" 
                    onClick={handleResolve}
                    disabled={actionLoading}
                    style={{ background: 'var(--green)', color: 'white' }}
                  >
                    {actionLoading ? '...' : '🏁 Resolve Mission'}
                  </button>
                ) : (
                  <button 
                    className="mission-btn arrived" 
                    onClick={handleArrive}
                    disabled={actionLoading}
                  >
                    {actionLoading ? '...' : '✅ Arrived'}
                  </button>
                )}
                <button 
                  className="mission-btn backup" 
                  onClick={handleBackup}
                  disabled={actionLoading}
                >
                  {actionLoading ? '...' : '🚑 Backup'}
                </button>
              </div>
            </div>
          ) : (
            <div className="mission-standby">
              <span className="mission-standby-icon">🧘</span>
              <span className="mission-standby-title">Standby for Dispatch</span>
              <span className="mission-standby-sub">
                You will be notified automatically when assigned to an incident.
              </span>
            </div>
          )}

          {/* Dedicated Tasks view if any */}
          {activeEvents.map(ev => 
             ev.tasks?.filter(t => t.status !== 'done').map(t => (
               <div key={t.id} style={{ padding: '12px 16px', background: 'var(--blue-lt)', borderTop: '1px solid var(--border)'}}>
                 <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--blue)', marginBottom: '4px' }}>
                    DIRECTIVE FROM DISASTER OPS
                 </div>
                 <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>
                   {t.title}
                 </div>
               </div>
             ))
          )}
        </div>
      </div>

      {/* User Profile */}
      <UserProfile />
    </div>
  );
}
