import { useState, useEffect } from 'react';
import { assignResource, overrideAssignment, getAssignments } from '../hooks/useMapState';

const SEVERITY_COLORS = {
  5: '#E24B4A',
  4: '#EF9F27',
  3: '#378ADD',
  2: '#1D9E75',
  1: '#1D9E75',
};

export default function IncidentDrawer({ incident, resources, onClose }) {
  const [assignment, setAssignment] = useState(null);
  const [overrideResourceId, setOverrideResourceId] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Find assignment for this incident
  useEffect(() => {
    const fetchAssignment = async () => {
      try {
        const assignments = await getAssignments();
        const match = assignments.find(a => a.incident_id === incident.id);
        setAssignment(match || null);
      } catch {
        setAssignment(null);
      }
    };
    if (incident) fetchAssignment();
  }, [incident]);

  if (!incident) return null;

  const breakdown = incident.score_breakdown || {};
  const totalScore = incident.priority_score || 1;

  const bars = [
    { label: 'Severity', value: breakdown.severity || 0, color: '#E24B4A' },
    { label: 'Population', value: breakdown.population_density || 0, color: '#EF9F27' },
    { label: 'Proximity', value: breakdown.proximity_to_resource || 0, color: '#378ADD' },
    { label: 'Infrastructure', value: breakdown.infra_criticality || 0, color: '#1D9E75' },
  ];

  const availableResources = resources.filter(r => r.status === 'available');

  const handleAssign = async () => {
    setLoading(true);
    try {
      const result = await assignResource(incident.id);
      setAssignment(result);
      setToast('Resource assigned successfully');
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      setToast(err.response?.data?.detail?.message || 'Assignment failed');
      setTimeout(() => setToast(null), 3000);
    }
    setLoading(false);
  };

  const handleOverride = async () => {
    if (!assignment || !overrideResourceId) return;
    setLoading(true);
    try {
      const result = await overrideAssignment(assignment.id, overrideResourceId);
      setAssignment(result);
      setOverrideResourceId('');
      setToast('Override successful');
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      setToast(err.response?.data?.detail || 'Override failed');
      setTimeout(() => setToast(null), 3000);
    }
    setLoading(false);
  };

  const assignedResource = assignment ? resources.find(r => r.id === assignment.resource_id) : null;

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="incident-drawer">
        <button className="drawer-close" onClick={onClose}>×</button>

        {/* Header */}
        <div className="drawer-header">
          <div className="drawer-title-row">
            <h2>{incident.type.toUpperCase()}</h2>
            <span
              className="severity-badge large"
              style={{ backgroundColor: SEVERITY_COLORS[incident.severity] }}
            >
              Severity {incident.severity}
            </span>
          </div>
          <p className="drawer-id">{incident.id}</p>
        </div>

        {/* Details */}
        <div className="drawer-section">
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
            <div className="detail-item">
              <span className="detail-label">Assigned To</span>
              <span className="detail-value">{assignedResource?.unit_name || 'Unassigned'}</span>
            </div>
          </div>
        </div>

        {/* Score Breakdown */}
        <div className="drawer-section">
          <h3>Priority Score: <span className="score-number">{incident.priority_score}</span></h3>
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
        {assignment && (
          <div className="drawer-section">
            <h3>Assignment</h3>
            <p className="assignment-reason">"{assignment.reason}"</p>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">ETA</span>
                <span className="detail-value">{assignment.eta_minutes} min</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Override</span>
                <span className="detail-value">{assignment.override_by_operator ? 'Yes' : 'No'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="drawer-section">
          <h3>Actions</h3>

          {!assignment && incident.status === 'open' && (
            <button
              className="action-btn assign-btn"
              onClick={handleAssign}
              disabled={loading}
            >
              {loading ? 'Assigning...' : '⚡ Auto-Assign Best Resource'}
            </button>
          )}

          {assignment && (
            <div className="override-section">
              <label className="override-label">Override Assignment</label>
              <div className="override-controls">
                <select
                  value={overrideResourceId}
                  onChange={e => setOverrideResourceId(e.target.value)}
                  className="override-select"
                >
                  <option value="">Select resource...</option>
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

        {/* Toast */}
        {toast && <div className="toast">{toast}</div>}
      </div>
    </>
  );
}
