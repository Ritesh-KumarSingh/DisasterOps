import { useState } from 'react';
import { createIncident } from '../hooks/useMapState';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE || '';

export default function DemoTools({ role }) {
  const [loading,   setLoading]   = useState(false);
  const [showTools, setShowTools] = useState(false);

  const handleTriggerSOS = async () => {
    setLoading(true);
    try {
      const mockIncident = {
        type: 'flood', severity: 4,
        lat: 28.61, lng: 77.20,
        location_desc: 'MOCK DEMO SOS (Auto-Triggered)',
        density_index: 0.8, infra_weight: 0.6,
      };
      const incident = await createIncident(mockIncident);
      await axios.post(`${API_BASE_URL}/assign`, { incident_id: incident.id });
      alert(`Demo SOS triggered & assigned: ${incident.id}`);
    } catch (err) {
      console.error('Demo SOS failed:', err);
      alert('Demo trigger failed.');
    }
    setLoading(false);
  };

  return (
    <div className="demo-tools-floating">
      <button className="demo-tools-toggle" onClick={() => setShowTools(!showTools)}>
        🛠️ Demo Tools {showTools ? '▴' : '▾'}
      </button>
      {showTools && (
        <div className="demo-tools-body">
          <button className="action-btn assign-btn" onClick={handleTriggerSOS} disabled={loading} style={{ fontSize: '12px', padding: '8px 14px' }}>
            {loading ? <><span className="spinner-small" /> Triggering...</> : '🚀 Trigger Auto-SOS'}
          </button>
          <button className="demo-btn" onClick={() => (window.location.href = '/')}>
            🏠 Exit to Login
          </button>
          <div className="demo-role-badge">Role: {role.toUpperCase()}</div>
        </div>
      )}
    </div>
  );
}
