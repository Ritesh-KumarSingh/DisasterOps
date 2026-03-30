import { useState } from 'react';
import { useMapState } from '../hooks/useMapState';
import { useDisasterEvents } from '../hooks/useDisasterEvents';
import MapView from '../components/MapView';
import Sidebar from '../components/Sidebar';
import IncidentDrawer from '../components/IncidentDrawer';
import PersonnelDrawer from '../components/PersonnelDrawer';
import DisasterEventDrawer from '../components/DisasterEventDrawer';
import DisasterEventModal from '../components/DisasterEventModal';
import SosForm from '../components/SosForm';
import UserProfile from '../components/UserProfile';

export default function AdminDashboard() {
  const { incidents, resources, assignments, hazardZones, loading, error } = useMapState();
  const { activeEvents, refetch: refetchEvents } = useDisasterEvents();
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [selectedEvent,    setSelectedEvent]    = useState(null);
  const [showEventModal,   setShowEventModal]   = useState(false);
  const [showSosForm,      setShowSosForm]      = useState(false);
  const [activeTab,        setActiveTab]        = useState('events');

  return (
    <div className="admin-layout">
      {/* User profile widget sits fixed top-right */}
      <UserProfile />

      {/* Left Sidebar */}
      <Sidebar
        incidents={incidents}
        resources={resources}
        activeEvents={activeEvents}
        onIncidentClick={(inc) => { setSelectedIncident(inc); setActiveTab('incidents'); setSelectedEvent(null); }}
        selectedIncident={selectedIncident}
        onEventClick={(ev) => {
          if (ev === 'NEW') setShowEventModal(true);
          else { setSelectedEvent(ev); setActiveTab('events'); setSelectedIncident(null); }
        }}
        selectedEvent={selectedEvent}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Centre Map */}
      <div className="map-container">
        {loading && (
          <div className="map-loading">
            <div className="spinner" />
            <p>Synchronizing fleet data…</p>
          </div>
        )}
        {error && (
          <div className="connection-status">
            ⚠ Operator Sync Error: {error}
          </div>
        )}

        <MapView
          incidents={incidents}
          resources={resources}
          hazardZones={hazardZones}
          activeEvents={activeEvents}
          onIncidentClick={(inc) => { setSelectedIncident(inc); setActiveTab('incidents'); setSelectedEvent(null); }}
          selectedIncident={selectedIncident}
        />

        {/* Log Incident */}
        <button className="sos-button-admin" onClick={() => setShowSosForm(true)}>
          🚨 Log Incident
        </button>
      </div>

      {/* Right Pane — Personnel | Event | Incident | Empty */}
      {activeTab === 'personnel' ? (
        <PersonnelDrawer />
      ) : activeTab === 'events' && selectedEvent ? (
        <DisasterEventDrawer 
          eventId={selectedEvent.id} 
          resources={resources} 
          onClose={() => setSelectedEvent(null)} 
        />
      ) : activeTab === 'incidents' && selectedIncident ? (
        <IncidentDrawer
          incident={selectedIncident}
          resources={resources}
          assignments={assignments}
          onClose={() => setSelectedIncident(null)}
          isStatic={true}
        />
      ) : (
        <div className="incident-drawer static-pane" style={{ background: 'var(--bg-surface)' }}>
          <div className="empty-pane">
            <div className="empty-pane-icon">📋</div>
            <div className="empty-pane-title">Select an Incident</div>
            <div className="empty-pane-sub">
              Click an incident in the sidebar or map to view operational details and manage assignments.
            </div>
          </div>
        </div>
      )}

      {showSosForm && (
        <SosForm onClose={() => setShowSosForm(false)} onSubmit={() => setShowSosForm(false)} />
      )}

      {showEventModal && (
        <DisasterEventModal onClose={() => setShowEventModal(false)} onCreated={refetchEvents} />
      )}
    </div>
  );
}
