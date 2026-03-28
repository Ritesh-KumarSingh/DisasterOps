import { useState } from 'react';
import { createIncident } from '../hooks/useMapState';

export default function SosForm({ onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    type: 'flood',
    severity: 3,
    lat: '',
    lng: '',
    location_desc: '',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

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
        () => alert('Geolocation failed. Please enter coordinates manually.'),
      );
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.lat || !formData.lng) {
      alert('Please provide location coordinates.');
      return;
    }
    setLoading(true);
    try {
      const data = {
        type: formData.type,
        severity: parseInt(formData.severity),
        lat: parseFloat(formData.lat),
        lng: parseFloat(formData.lng),
        location_desc: formData.location_desc,
      };
      const incident = await createIncident(data);
      setResult(incident);
      if (onSubmit) onSubmit(incident);
    } catch (err) {
      alert('Failed to submit report. Try again.');
    }
    setLoading(false);
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      <div className="sos-modal">
        <button className="drawer-close" onClick={onClose}>×</button>
        <div className="sos-header">
          <span className="sos-icon">🆘</span>
          <h2>Emergency Report</h2>
        </div>

        {result ? (
          <div className="sos-success">
            <div className="success-icon">✅</div>
            <h3>Report Submitted</h3>
            <p>Incident ID: <strong>{result.id}</strong></p>
            <p>Priority Score: <strong>{result.priority_score}</strong></p>
            <button className="action-btn" onClick={onClose}>Close</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="sos-form">
            <div className="form-group">
              <label>Location</label>
              <div className="coord-row">
                <input
                  type="number"
                  placeholder="Latitude"
                  step="0.0001"
                  value={formData.lat}
                  onChange={e => setFormData(prev => ({ ...prev, lat: e.target.value }))}
                />
                <input
                  type="number"
                  placeholder="Longitude"
                  step="0.0001"
                  value={formData.lng}
                  onChange={e => setFormData(prev => ({ ...prev, lng: e.target.value }))}
                />
                <button type="button" className="geo-btn" onClick={handleGeolocate}>
                  📍 GPS
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Incident Type</label>
              <select
                value={formData.type}
                onChange={e => setFormData(prev => ({ ...prev, type: e.target.value }))}
              >
                <option value="flood">Flood</option>
                <option value="fire">Fire</option>
                <option value="medical">Medical</option>
                <option value="structural">Structural</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label>Severity</label>
              <div className="severity-radios">
                {[1, 2, 3, 4, 5].map(s => (
                  <label key={s} className={`severity-radio ${formData.severity === s ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="severity"
                      value={s}
                      checked={formData.severity === s}
                      onChange={() => setFormData(prev => ({ ...prev, severity: s }))}
                    />
                    <span>{s}</span>
                    <small>{s === 1 ? 'Minor' : s === 3 ? 'Serious' : s === 5 ? 'Critical' : ''}</small>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Description (optional)</label>
              <textarea
                placeholder="Describe the situation..."
                value={formData.location_desc}
                onChange={e => setFormData(prev => ({ ...prev, location_desc: e.target.value }))}
                rows={3}
              />
            </div>

            <button type="submit" className="action-btn sos-submit" disabled={loading}>
              {loading ? 'Submitting...' : '🚨 Submit Emergency Report'}
            </button>
          </form>
        )}
      </div>
    </>
  );
}
