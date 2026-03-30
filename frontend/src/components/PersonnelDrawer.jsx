import React, { useState } from 'react';
import axios from 'axios';

export default function PersonnelDrawer() {
  const [username, setUsername] = useState('');
  const [role,     setRole]     = useState('responder');
  const [loading,  setLoading]  = useState(false);
  const [message,  setMessage]  = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      await axios.post('/register', { username, role });
      setMessage({ type: 'success', text: `Account "${username}" provisioned as ${role}.` });
      setUsername('');
      setRole('responder');
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Failed to provision account.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="incident-drawer static-pane">
      {/* Header */}
      <div className="drawer-header">
        <div className="drawer-title-row">
          <h2>Personnel</h2>
        </div>
        <span className="drawer-id">Provision new system users</span>
      </div>

      {/* Form */}
      <div className="drawer-body">
        <div className="drawer-section">
          <div className="drawer-section-title">New Account</div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-field">
              <label className="form-label">Username</label>
              <input
                className="form-input"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="e.g. unit_alpha_1"
                required
              />
            </div>

            <div className="form-field">
              <label className="form-label">Authorization Role</label>
              <select
                className="form-select"
                value={role}
                onChange={e => setRole(e.target.value)}
              >
                <option value="responder">First Responder</option>
                <option value="operator">System Operator</option>
              </select>
            </div>

            {message && (
              <div className={message.type === 'success' ? 'alert-success' : 'alert-error'}>
                {message.type === 'success' ? '✓ ' : '✗ '}{message.text}
              </div>
            )}

            <button
              type="submit"
              className="action-btn assign-btn"
              disabled={loading || !username}
            >
              {loading ? <><span className="spinner-small" /> Provisioning...</> : '➕ Provision Access'}
            </button>
          </form>
        </div>

        {/* Info */}
        <div className="drawer-section">
          <div className="drawer-section-title">Role Permissions</div>
          <div className="detail-item" style={{ marginBottom: '8px' }}>
            <span className="detail-label">Operator</span>
            <span className="detail-value" style={{ fontSize: '12px', fontWeight: 600 }}>Full admin access — can view/assign all incidents, manage resources and personnel</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Responder</span>
            <span className="detail-value" style={{ fontSize: '12px', fontWeight: 600 }}>Field access — views assigned missions and can update status</span>
          </div>
        </div>
      </div>
    </div>
  );
}
