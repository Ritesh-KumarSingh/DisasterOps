import { useState, useEffect } from 'react';
import { assignResource, overrideAssignment, getAssignments } from '../hooks/useMapState';

const SEVERITY_COLORS = {
  5: '#dc2626', 4: '#ea580c', 3: '#2563eb', 2: '#16a34a', 1: '#16a34a',
};

export default function IncidentDrawer({ incident, resources, assignments = [], onClose, isStatic = false }) {
  const [localAssignments, setLocalAssignments] = useState([]);
  const [overrideResourceId, setOverrideResourceId] = useState('');
  const [loading,           setLoading]           = useState(false);
  const [toast,             setToast]             = useState(null);

  useEffect(() => {
    // Fill local state with assignments for this incident
    const matches = assignments.filter(a => a.incident_id === incident.id);
    setLocalAssignments(matches);
  }, [incident, assignments]);

  if (!incident) return null;

  const breakdown  = incident.score_breakdown || {};
  const totalScore = incident.priority_score  || 1;

  const bars = [
    { label: 'Severity',       value: breakdown.severity           || 0, color: '#dc2626' },
    { label: 'Population',     value: breakdown.population_density || 0, color: '#ea580c' },
    { label: 'Proximity',      value: breakdown.proximity_to_resource || 0, color: '#2563eb' },
    { label: 'Infrastructure', value: breakdown.infra_criticality  || 0, color: '#15803d' },
  ];

  const availableResources = resources.filter(r => r.status === 'available');
  const assignedResources   = localAssignments.map(a => resources.find(r => r.id === a.resource_id)).filter(Boolean);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const handleAssign = async () => {
    setLoading(true);
    try {
      const result = await assignResource(incident.id);
      setLocalAssignments(prev => [...prev, result]);
      showToast('Resource assigned successfully');
    } catch (err) {
      showToast(err.response?.data?.detail?.message || 'Assignment failed');
    }
    setLoading(false);
  };

  const handleOverride = async () => {
    if (!assignment || !overrideResourceId) return;
    setLoading(true);
    try {
      const result = await overrideAssignment(localAssignments[0].id, overrideResourceId);
      setLocalAssignments(prev => [result, ...prev.slice(1)]);
      setOverrideResourceId('');
      showToast('Override successful');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Override failed');
    }
    setLoading(false);
  };

  return (
    <>
      {!isStatic && <div className="drawer-overlay" onClick={onClose} />}
      <div className={`incident-drawer ${isStatic ? 'static-pane' : ''}`}>
        <button className="drawer-close" onClick={onClose}>×</button>

        {/* ── Header ── */}
        <div className="drawer-header">
          <div className="drawer-title-row">
            <h2>{incident.type.toUpperCase()} EMERGENCY</h2>
            <span className="severity-badge large" style={{ backgroundColor: SEVERITY_COLORS[incident.severity] }}>
              S{incident.severity}
            </span>
          </div>
          <span className="drawer-id">{incident.id}</span>
        </div>

        {incident.status !== 'resolved' && incident.backup_requested && (
          <div style={{
            margin: '0 20px 20px',
            padding: '12px 16px',
            background: 'rgba(220, 38, 38, 0.1)',
            border: '1.5px solid rgba(220, 38, 38, 0.3)',
            borderRadius: 'var(--r-md)',
            color: 'var(--red)',
            fontSize: '12px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            <span style={{ fontSize: '18px' }}>🚨</span>
            <div>
              <div style={{ textTransform: 'uppercase', fontSize: '10px', opacity: 0.8 }}>Backup Status</div>
              PRIMARY UNIT CALLED FOR BACKUP — Auto-Dispatch Engaged
            </div>
          </div>
        )}

        {/* ── Scrollable body ── */}
        <div className="drawer-body">

          {/* Details */}
          <div className="drawer-section">
            <div className="drawer-section-title">Incident Details</div>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Location</span>
                <span className="detail-value">{incident.location_desc || 'N/A'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Coordinates</span>
                <span className="detail-value">{incident.lat.toFixed(4)}, {incident.lng.toFixed(4)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Reported</span>
                <span className="detail-value">{new Date(incident.reported_at).toLocaleTimeString()}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Status</span>
                <span className={`detail-value status-${incident.status}`}>{incident.status}</span>
              </div>
              <div className="detail-item" style={{ gridColumn: 'span 2' }}>
                <span className="detail-label">Assigned Units</span>
                <span className="detail-value">
                  {assignedResources.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                      {assignedResources.map(r => (
                        <span key={r.id} style={{
                          background: 'var(--bg-subtle)',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--blue)' }} />
                          {r.unit_name} ({r.agency})
                        </span>
                      ))}
                    </div>
                  ) : 'Unassigned'}
                </span>
              </div>
            </div>
          </div>

          {/* Score Breakdown */}
          <div className="drawer-section">
            <div className="score-header">
              <div className="drawer-section-title">Priority Score</div>
              <span className="score-number">{incident.priority_score}</span>
            </div>
            <div className="score-bars">
              {bars.map((bar) => (
                <div key={bar.label} className="score-bar-row">
                  <span className="bar-label">{bar.label}</span>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${Math.min((bar.value / totalScore) * 100, 100)}%`,
                        backgroundColor: bar.color,
                      }}
                    />
                  </div>
                  <span className="bar-value">{bar.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Assignment Info */}
          {localAssignments.length > 0 && (
            <div className="drawer-section">
              <div className="drawer-section-title">Deployment Info</div>
              <div className="assignment-stack" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {localAssignments.map((asgn, idx) => (
                  <div key={asgn.id} style={{ padding: '10px', background: 'var(--bg-subtle)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '4px' }}>
                      {idx === 0 ? 'Primary Dispatch' : 'Backup Dispatch'}
                    </div>
                    <p className="assignment-reason" style={{ margin: '4px 0', fontSize: '12px' }}>"{asgn.reason}"</p>
                    <div style={{ display: 'flex', gap: '15px', marginTop: '8px', fontSize: '11px' }}>
                      <span><strong>ETA:</strong> {asgn.eta_minutes} min</span>
                      <span><strong>Status:</strong> {asgn.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="drawer-section">
            <div className="drawer-section-title">Operator Override</div>
            {localAssignments.length === 0 && incident.status === 'open' && (
              <button className="action-btn assign-btn" onClick={handleAssign} disabled={loading}>
                {loading ? <><span className="spinner-small" /> Assigning...</> : '⚡ Auto-Assign Best Resource'}
              </button>
            )}
            {localAssignments.length > 0 && (
              <div className="override-section">
                <span className="override-label">Reassign Primary Unit</span>
                <div className="override-controls">
                  <select
                    className="override-select"
                    value={overrideResourceId}
                    onChange={e => setOverrideResourceId(e.target.value)}
                  >
                    <option value="">Select replacement...</option>
                    {availableResources.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.unit_name} ({r.agency}) — {r.skills.join(', ')}
                      </option>
                    ))}
                  </select>
                  <button
                    className="action-btn override-btn"
                    onClick={handleOverride}
                    disabled={!overrideResourceId || loading}
                  >
                    {loading ? '...' : 'Reassign'}
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>{/* end drawer-body */}

        {toast && <div className="toast">{toast}</div>}
      </div>
    </>
  );
}
