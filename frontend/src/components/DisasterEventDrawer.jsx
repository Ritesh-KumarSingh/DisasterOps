import { useState, useEffect } from 'react';
import { resolveDisasterEvent, getDisasterEventDetails, addEventZone, deleteEventZone, addEventTask, updateEventTask } from '../hooks/useDisasterEvents';

const EVENT_EMOJIS = {
  earthquake: '🏚️', flood: '🌊', cyclone: '🌀', wildfire: '🔥', tsunami: '🌊', industrial: '🏭', crime: '🚓'
};

const SEVERITY_COLORS = {
  5: '#dc2626', 4: '#ea580c', 3: '#2563eb', 2: '#16a34a', 1: '#16a34a',
};

export default function DisasterEventDrawer({ eventId, resources, onClose }) {
  const [eventData, setEventData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview'); // overview, zones, tasks
  
  // Forms
  const [newZone, setNewZone] = useState({ name: '', type: 'safe', lat: '', lng: '', radius_km: 1.0 });
  const [newTask, setNewTask] = useState({ title: '', assigned_to: '' });

  const fetchDetails = async () => {
    try {
      const data = await getDisasterEventDetails(eventId);
      setEventData(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (eventId) {
      setLoading(true);
      fetchDetails();
    }
  }, [eventId]);

  const handleResolve = async () => {
    if (window.confirm('Are you sure you want to flag this event as resolved?')) {
      await resolveDisasterEvent(eventId);
      fetchDetails();
    }
  };

  const handleAddZone = async (e) => {
    e.preventDefault();
    await addEventZone(eventId, { ...newZone, lat: parseFloat(newZone.lat), lng: parseFloat(newZone.lng), radius_km: parseFloat(newZone.radius_km) });
    setNewZone({ name: '', type: 'safe', lat: '', lng: '', radius_km: 1.0 });
    fetchDetails();
  };

  const handleDeleteZone = async (zId) => {
    await deleteEventZone(eventId, zId);
    fetchDetails();
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    await addEventTask(eventId, newTask);
    setNewTask({ title: '', assigned_to: '' });
    fetchDetails();
  };

  const handleTaskStatus = async (taskId, status) => {
    await updateEventTask(eventId, taskId, { status });
    fetchDetails();
  };

  const handleTaskAssign = async (taskId, e) => {
    await updateEventTask(eventId, taskId, { assigned_to: e.target.value });
    fetchDetails();
  };

  if (loading) return <div className="incident-drawer static-pane"><div className="spinner" style={{ margin: 'auto' }} /></div>;
  if (!eventData) return <div className="incident-drawer static-pane"><div className="empty-pane">Not Found</div></div>;

  const emoji = EVENT_EMOJIS[eventData.type] || '⚠️';
  const isActive = eventData.status === 'active';

  return (
    <div className="incident-drawer static-pane">
      <button className="drawer-close" onClick={onClose}>×</button>
      
      {/* HEADER */}
      <div className="drawer-header" style={{ paddingBottom: '0' }}>
        <div className="drawer-title-row">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{emoji}</span>
            {eventData.type.toUpperCase()} EVENT
          </h2>
          <span className="severity-badge large" style={{ backgroundColor: SEVERITY_COLORS[eventData.severity] }}>
            S{eventData.severity}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <span className="drawer-id">{eventData.id}</span>
          <span className={`status-badge ${isActive ? 'busy' : 'available'}`}>
            {isActive ? 'ACTIVE' : 'RESOLVED'}
          </span>
        </div>
        
        {/* TAB SWITCHER */}
        <div className="tab-switcher" style={{ borderBottom: 'none' }}>
          {['overview', 'zones', 'tasks'].map((t) => (
            <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="drawer-body">
        
        {/* OVERVIEW TAB */}
        {tab === 'overview' && (
          <>
            <div className="drawer-section">
              <div className="drawer-section-title">Event Synopsis</div>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">Location</span>
                  <span className="detail-value">{eventData.location_name || 'Unspecified'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Coordinates</span>
                  <span className="detail-value">{eventData.lat.toFixed(4)}, {eventData.lng.toFixed(4)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Created At</span>
                  <span className="detail-value">{new Date(eventData.created_at).toLocaleString()}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Initiated By</span>
                  <span className="detail-value">{eventData.created_by.toUpperCase()}</span>
                </div>
              </div>
              
              {eventData.metadata.notes && (
                <div style={{ marginTop: '14px', padding: '12px', background: 'var(--blue-lt)', borderRadius: 'var(--r-sm)', fontSize: '13px', color: 'var(--text-2)' }}>
                  <strong>Operational Notes:</strong><br/>
                  {eventData.metadata.notes}
                </div>
              )}
            </div>
            
            {isActive && (
              <div className="drawer-section">
                <button className="action-btn" onClick={handleResolve} style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>
                  🛑 Conclude Disaster Event
                </button>
              </div>
            )}
          </>
        )}

        {/* ZONES TAB */}
        {tab === 'zones' && (
          <div className="drawer-section">
            <div className="drawer-section-title">Established Zones</div>
            
            {eventData.zones?.length === 0 && <p style={{ fontSize: '13px', color: 'var(--text-3)' }}>No geographic zones mapped yet.</p>}
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {eventData.zones?.map(z => (
                <div key={z.id} className="detail-item" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 700, fontSize: '13px' }}>
                      <span className={`zone-pill type-${z.type}`}></span>
                      {z.name || `${z.type.toUpperCase()} ZONE`}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                      R: {z.radius_km}km | [{z.lat.toFixed(3)}, {z.lng.toFixed(3)}]
                    </span>
                  </div>
                  {isActive && <button onClick={() => handleDeleteZone(z.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--red)' }}>×</button>}
                </div>
              ))}
            </div>

            {isActive && (
              <form onSubmit={handleAddZone} style={{ background: 'var(--bg-subtle)', padding: '12px', borderRadius: 'var(--r-sm)', border: '1px dashed var(--border)' }}>
                <span className="detail-label">Map New Zone</span>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <input className="form-input" style={{ padding: '6px' }} placeholder="Lat" value={newZone.lat} onChange={e => setNewZone(p=>({...p,lat:e.target.value}))} required />
                  <input className="form-input" style={{ padding: '6px' }} placeholder="Lng" value={newZone.lng} onChange={e => setNewZone(p=>({...p,lng:e.target.value}))} required />
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <select className="form-input" style={{ padding: '6px' }} value={newZone.type} onChange={e => setNewZone(p=>({...p,type:e.target.value}))}>
                    <option value="safe">Safe Area (Green)</option>
                    <option value="unsafe">Hazard Line (Red)</option>
                    <option value="evacuation">Evac Route (Amber)</option>
                  </select>
                  <input className="form-input" style={{ padding: '6px', width: '80px' }} placeholder="Rad km" value={newZone.radius_km} onChange={e => setNewZone(p=>({...p,radius_km:e.target.value}))} required />
                </div>
                <button className="action-btn" style={{ padding: '6px', width: '100%', marginTop: '8px', fontSize: '12px' }}>+ Overlay Grid</button>
              </form>
            )}
          </div>
        )}

        {/* TASKS TAB */}
        {tab === 'tasks' && (
          <div className="drawer-section">
            <div className="drawer-section-title">Strategic Directives</div>
            
            {isActive && (
              <form onSubmit={handleAddTask} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <input className="form-input" style={{ padding: '8px' }} placeholder="E.g. Clear main artery cordons" value={newTask.title} onChange={e => setNewTask(p=>({...p,title:e.target.value}))} required />
                <button className="action-btn assign-btn" style={{ padding: '8px', width: 'auto' }}>Add</button>
              </form>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {eventData.tasks?.map(t => (
                <div key={t.id} className="task-card" style={{ padding: '12px', background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', boxShadow: 'var(--sh-xs)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontWeight: 600, fontSize: '13px', lineHeight: 1.3 }}>{t.title}</span>
                    <span className={`task-status-${t.status}`} style={{ fontSize: '10px', fontWeight: 800, textTransform:'uppercase', padding:'2px 6px', borderRadius:'99px' }}>
                      {t.status.replace('_', ' ')}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px' }}>
                    <select
                      value={t.assigned_to || ''}
                      onChange={(e) => handleTaskAssign(t.id, e)}
                      disabled={!isActive}
                      style={{ fontSize: '11px', padding: '4px', maxWidth: '140px' }}
                    >
                      <option value="">Unassigned...</option>
                      {resources.map(r => <option key={r.id} value={r.id}>{r.unit_name}</option>)}
                    </select>
                    
                    {isActive && t.status !== 'done' && (
                      <button onClick={() => handleTaskStatus(t.id, 'done')} style={{ fontSize: '11px', padding: '4px 8px', background: 'var(--green-lt)', color: 'var(--green)', border: '1px solid #bbf7d0', borderRadius: '4px', cursor: 'pointer', fontWeight: 700 }}>
                        Mark Done
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
