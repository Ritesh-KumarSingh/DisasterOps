import { useState } from 'react';
import { createDisasterEvent } from '../hooks/useDisasterEvents';

const EVENT_TYPES = [
  { id: 'earthquake', emoji: '🏚️', label: 'Earthquake' },
  { id: 'flood',      emoji: '🌊', label: 'Flood' },
  { id: 'cyclone',    emoji: '🌀', label: 'Cyclone' },
  { id: 'wildfire',   emoji: '🔥', label: 'Wildfire' },
  { id: 'tsunami',    emoji: '🌊', label: 'Tsunami' },
  { id: 'industrial', emoji: '🏭', label: 'Industrial' },
  { id: 'crime',      emoji: '🚓', label: 'Crime' },
];

export default function DisasterEventModal({ onClose, onCreated }) {
  const [formData, setFormData] = useState({
    type: 'earthquake',
    location_name: '',
    lat: '',
    lng: '',
    severity: 3,
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.lat || !formData.lng) {
      setError('Please provide coordinates.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = {
        type: formData.type,
        location_name: formData.location_name,
        lat: parseFloat(formData.lat),
        lng: parseFloat(formData.lng),
        severity: parseInt(formData.severity),
        created_by: localStorage.getItem('auth_username') || 'system',
        metadata: { notes: formData.notes }
      };
      await createDisasterEvent(payload);
      onCreated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to declare event.');
      setLoading(false);
    }
  };

  const handleGeolocate = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setFormData(prev => ({
            ...prev,
            lat: pos.coords.latitude.toFixed(4),
            lng: pos.coords.longitude.toFixed(4),
          }));
        },
        () => setError('Geolocation failed. Please enter manually.'),
      );
    }
  };

  return (
    <div className="modal-overlay">
      <div className="sos-modal">
        <button className="drawer-close" onClick={onClose}>×</button>
        <div className="sos-header" style={{ background: 'var(--red-lt)', borderBottomColor: '#fecaca' }}>
          <span className="sos-icon">📣</span>
          <h2>Declare Disaster Event</h2>
        </div>

        <form onSubmit={handleSubmit} className="sos-stack">
          {error && <div className="error-msg">{error}</div>}

          <div className="form-group">
            <label>Event Type</label>
            <div className="role-selector" style={{ flexWrap: 'wrap' }}>
              {EVENT_TYPES.map(t => (
                <div
                  key={t.id}
                  className={`role-box ${formData.type === t.id ? 'active' : ''}`}
                  onClick={() => setFormData(p => ({ ...p, type: t.id }))}
                  style={{ minWidth: '80px' }}
                >
                  <span className="role-icon-lg">{t.emoji}</span>
                  {t.label}
                </div>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Location Name (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Downtown Metro Station"
              value={formData.location_name}
              onChange={e => setFormData(p => ({ ...p, location_name: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label>Epicentre Coordinates</label>
            <div className="coord-row">
              <input
                type="number"
                placeholder="Lat"
                step="any"
                value={formData.lat}
                onChange={e => setFormData(p => ({ ...p, lat: e.target.value }))}
              />
              <input
                type="number"
                placeholder="Lng"
                step="any"
                value={formData.lng}
                onChange={e => setFormData(p => ({ ...p, lng: e.target.value }))}
              />
              <button type="button" className="action-btn" onClick={handleGeolocate} style={{ padding: '0 12px' }}>
                📍 Curr Loc
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Severity Level</label>
            <div className="severity-radios">
              {[1, 2, 3, 4, 5].map(s => (
                <label key={s} className={`severity-radio ${formData.severity === s ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="severity"
                    value={s}
                    checked={formData.severity === s}
                    onChange={() => setFormData(p => ({ ...p, severity: s }))}
                  />
                  <span>{s}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Operational Notes</label>
            <textarea
              rows={3}
              placeholder="Initial intelligence, required protocols..."
              value={formData.notes}
              onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
              className="form-input"
              style={{ resize: 'vertical' }}
            />
          </div>

          <button type="submit" className="action-btn assign-btn" disabled={loading} style={{ background: 'var(--red)', borderColor: 'var(--red)', marginTop: '8px' }}>
            {loading ? 'Transmitting...' : '📣 Broadcast Alert & Open Event'}
          </button>
        </form>
      </div>
    </div>
  );
}
