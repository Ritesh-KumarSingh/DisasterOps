import { useState } from 'react';
import { startScenario } from '../hooks/useMapState';
import KpiStrip from './KpiStrip';

const SEVERITY_COLORS = {
  5: '#E24B4A',
  4: '#EF9F27',
  3: '#378ADD',
  2: '#1D9E75',
  1: '#1D9E75',
};

const TYPE_BADGES = {
  flood: { bg: '#1a3a5c', text: '#64b5f6' },
  fire: { bg: '#5c1a1a', text: '#ef9a9a' },
  medical: { bg: '#1a5c3a', text: '#81c784' },
  structural: { bg: '#5c4a1a', text: '#ffd54f' },
  other: { bg: '#3a3a3a', text: '#bbb' },
};

export default function Sidebar({ incidents, resources, onIncidentClick, selectedIncident, activeTab, onTabChange }) {
  const [runningScenario, setRunningScenario] = useState(null);
  const [scenarioLoading, setScenarioLoading] = useState(null);

  const handleScenario = async (name) => {
    setScenarioLoading(name);
    try {
      await startScenario(name);
      setRunningScenario(name);
    } catch (err) {
      console.error('Scenario start failed:', err);
    }
    setScenarioLoading(null);
  };

  const sortedIncidents = [...incidents].sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0));

  const sortedResources = [...resources].sort((a, b) => {
    if (a.status === 'available' && b.status !== 'available') return -1;
    if (a.status !== 'available' && b.status === 'available') return 1;
    return a.unit_name.localeCompare(b.unit_name);
  });

  return (
    <div className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <div className="logo">
          <span className="logo-icon">🛡️</span>
          <div>
            <h1>DisasterOps</h1>
            <p className="tagline">AI Coordination System</p>
          </div>
        </div>
      </div>

      {/* Scenario Launcher */}
      <div className="scenario-section">
        <h3 className="section-title">Scenario Simulation</h3>
        <div className="scenario-buttons">
          {[
            { name: 'flood', label: '🌊 Flood', color: '#378ADD' },
            { name: 'wildfire', label: '🔥 Wildfire', color: '#E24B4A' },
            { name: 'quake', label: '🏚️ Earthquake', color: '#EF9F27' },
          ].map(({ name, label, color }) => (
            <button
              key={name}
              className={`scenario-btn ${runningScenario === name ? 'active' : ''}`}
              style={{ '--btn-color': color }}
              onClick={() => handleScenario(name)}
              disabled={scenarioLoading !== null}
            >
              {scenarioLoading === name ? (
                <span className="spinner-small" />
              ) : (
                label
              )}
              {runningScenario === name && <span className="live-badge">LIVE</span>}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Strip */}
      <KpiStrip />

      {/* Tab Switcher */}
      <div className="tab-switcher">
        <button
          className={`tab-btn ${activeTab === 'incidents' ? 'active' : ''}`}
          onClick={() => onTabChange('incidents')}
        >
          Incidents ({incidents.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'resources' ? 'active' : ''}`}
          onClick={() => onTabChange('resources')}
        >
          Resources ({resources.length})
        </button>
      </div>

      {/* Content */}
      <div className="sidebar-content">
        {activeTab === 'incidents' ? (
          <div className="incident-list">
            {sortedIncidents.map((inc) => {
              const typeBadge = TYPE_BADGES[inc.type] || TYPE_BADGES.other;
              const isSelected = selectedIncident?.id === inc.id;
              return (
                <div
                  key={inc.id}
                  className={`incident-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => onIncidentClick(inc)}
                >
                  <div className="incident-card-header">
                    <span className="incident-id">{inc.id.slice(0, 12)}</span>
                    <span
                      className="severity-badge"
                      style={{ backgroundColor: SEVERITY_COLORS[inc.severity] }}
                    >
                      S{inc.severity}
                    </span>
                  </div>
                  <div className="incident-card-body">
                    <span
                      className="type-badge"
                      style={{ backgroundColor: typeBadge.bg, color: typeBadge.text }}
                    >
                      {inc.type}
                    </span>
                    <span className="priority-score">{inc.priority_score ?? '—'}</span>
                  </div>
                  <p className="incident-desc">{inc.location_desc}</p>
                  {inc.status === 'assigned' && (
                    <span className="assigned-badge">✓ Assigned</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="resource-list">
            {sortedResources.map((res) => (
              <div key={res.id} className="resource-card">
                <div className="resource-card-header">
                  <span className="resource-name">{res.unit_name}</span>
                  <span className={`status-badge ${res.status}`}>
                    {res.status}
                  </span>
                </div>
                <div className="resource-card-body">
                  <span className="agency-badge">{res.agency}</span>
                  <span className="skills-text">{res.skills.join(', ')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
