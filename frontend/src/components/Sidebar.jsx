import { useState } from 'react';
import KpiStrip from './KpiStrip';
import { useStrategy } from '../hooks/useStrategy';

const SEVERITY_COLORS = {
  5: '#dc2626', 4: '#ea580c', 3: '#2563eb', 2: '#16a34a', 1: '#16a34a',
};

const TYPE_BADGES = {
  flood:      { bg: 'rgba(37,99,235,.1)',  text: '#1d4ed8' },
  fire:       { bg: 'rgba(220,38,38,.1)',  text: '#dc2626' },
  medical:    { bg: 'rgba(22,163,74,.1)',  text: '#15803d' },
  structural: { bg: 'rgba(234,88,12,.1)',  text: '#c2410c' },
  crime:      { bg: 'rgba(100,116,139,.1)', text: '#475569' },
};

const EVENT_EMOJIS = {
  earthquake: '🏚️', flood: '🌊', cyclone: '🌀', wildfire: '🔥', tsunami: '🌊', industrial: '🏭', crime: '🚓'
};

export default function Sidebar({ 
  incidents, resources, activeEvents=[], 
  onIncidentClick, selectedIncident, 
  onEventClick, selectedEvent,
  activeTab, onTabChange 
}) {
  const { strategy, loading: strategyLoading, triggerAnalysis } = useStrategy();
  const sortedIncidents = incidents
    .filter(inc => inc.status !== 'resolved')
    .sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0));
  const sortedResources = [...resources].sort((a, b) => {
    if (a.status === 'available' && b.status !== 'available') return -1;
    if (a.status !== 'available' && b.status === 'available') return 1;
    return a.unit_name.localeCompare(b.unit_name);
  });

  return (
    <div className="sidebar">
      {/* ── Header ── */}
      <div className="sidebar-header">
        <span className="logo-icon">🛡️</span>
        <div>
          <div className="logo-text">DisasterOps</div>
          <div className="tagline">AI Coordination System</div>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <KpiStrip />

      {/* Space divider */}
      <div style={{ paddingBottom: '20px' }} />

      {/* ── Tab Bar ── */}
      <div className="tab-switcher">
        {['strategy', 'events', 'incidents', 'resources'].map((t) => (
          <button
            key={t}
            className={`tab-btn ${activeTab === t ? 'active' : ''}`}
            onClick={() => onTabChange(t)}
          >
            {t === 'strategy' ? '✨ Strategy' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div className="sidebar-content">
        {activeTab === 'incidents' && (
          <>
            {sortedIncidents.length === 0 && (
              <div className="empty-pane">
                <div className="empty-pane-icon">📭</div>
                <div className="empty-pane-title">No Active Incidents</div>
                <div className="empty-pane-sub">Awaiting incoming incident reports from field units or citizens.</div>
              </div>
            )}
            {sortedIncidents.map((inc) => {
              const typeBadge = TYPE_BADGES[inc.type] || TYPE_BADGES.crime;
              const isSelected = selectedIncident?.id === inc.id;
              return (
                <div
                  key={inc.id}
                  className={`incident-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => onIncidentClick(inc)}
                >
                  <div className="incident-card-header">
                    <span className="incident-id">{inc.id.slice(0, 12)}</span>
                    <span className="severity-badge" style={{ backgroundColor: SEVERITY_COLORS[inc.severity] }}>
                      S{inc.severity}
                    </span>
                  </div>
                  <div className="incident-card-body">
                    <span className="type-badge" style={{ backgroundColor: typeBadge.bg, color: typeBadge.text }}>
                      {inc.type}
                    </span>
                    <span className="priority-score">{inc.priority_score ?? '—'}</span>
                  </div>
                  <div className="incident-desc">{inc.location_desc}</div>
                  {inc.backup_requested ? (
                    <span className="backup-pulse-badge">🆘 BACKUP</span>
                  ) : inc.status === 'assigned' && (
                    <span className="assigned-badge">✓ Assigned</span>
                  )}
                </div>
              );
            })}
          </>
        )}

        {activeTab === 'resources' && (
          <>
            {sortedResources.length === 0 && (
              <div className="empty-pane">
                <div className="empty-pane-icon">🚒</div>
                <div className="empty-pane-title">No Resources Loaded</div>
              </div>
            )}
            {sortedResources.map((res) => (
              <div key={res.id} className="resource-card">
                <div className="resource-card-header">
                  <span className="resource-name">{res.unit_name}</span>
                  <span className={`status-badge ${res.status}`}>{res.status}</span>
                </div>
                <div className="resource-card-body">
                  <span className="agency-badge">{res.agency}</span>
                  <span className="skills-text">{res.skills.join(', ')}</span>
                </div>
              </div>
            ))}
          </>
        )}

        {activeTab === 'events' && (
          <>
            <button className="action-btn assign-btn" onClick={() => onEventClick('NEW')} style={{ background: 'var(--red)', borderColor: 'var(--red)' }}>
              📣 Declare Disaster Event
            </button>
            {activeEvents.length === 0 && (
              <div className="empty-pane">
                <div className="empty-pane-icon">🛡️</div>
                <div className="empty-pane-title">No Active Events</div>
                <div className="empty-pane-sub">Initiate a disaster operation to begin broad coordination.</div>
              </div>
            )}
            {activeEvents.map(ev => {
              const emoji = EVENT_EMOJIS[ev.type] || '⚠️';
              const isSelected = selectedEvent?.id === ev.id;
              return (
                <div
                  key={ev.id}
                  className={`incident-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => onEventClick(ev)}
                >
                  <div className="incident-card-header">
                    <span className="incident-id">{ev.type.toUpperCase()}</span>
                    <span className="severity-badge" style={{ backgroundColor: SEVERITY_COLORS[ev.severity] }}>
                      S{ev.severity}
                    </span>
                  </div>
                  <div className="incident-card-body">
                    <span className="type-badge" style={{ fontSize: '16px', background: 'transparent', padding: 0 }}>
                      {emoji}
                    </span>
                    <span className="priority-score">{ev.status === 'active' ? 'LIVE' : 'DONE'}</span>
                  </div>
                  <div className="incident-desc">{ev.location_name || 'Unspecified Location'}</div>
                </div>
              );
            })}
          </>
        )}

        {activeTab === 'strategy' && (
          <div className="strategy-tab">
            <div className="strategy-header">
              <div className="strategy-title">AI Coordination Insights</div>
              <button 
                className="trigger-btn"
                onClick={triggerAnalysis}
                disabled={strategyLoading}
              >
                {strategyLoading ? 'Analyzing...' : 'Refresh AI Strategy'}
              </button>
            </div>
            
            {strategy?.strategic_recommendation && (
              <div className="strategy-card">
                <div className="card-lbl">EFFICIENCY SCORE</div>
                <div className="efficiency-meter">
                  <div 
                    className="efficiency-fill" 
                    style={{ width: `${strategy.strategic_recommendation.efficiency_score}%` }}
                  />
                  <span>{strategy.strategic_recommendation.efficiency_score}%</span>
                </div>
                
                <div className="card-lbl" style={{marginTop:'15px'}}>RISK SUMMARY</div>
                <div className="risk-text">{strategy.strategic_recommendation.risk_summary}</div>
                
                <div className="card-lbl" style={{marginTop:'15px'}}>PRIORITY ACTIONS</div>
                <ul className="action-list">
                  {strategy.strategic_recommendation.priority_actions?.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="strategy-footer">
              Insight generated by Gemini 2.0. Multi-Agent System analyzing {incidents.length} active incidents.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
