import { useState } from 'react';
import { useMapState } from './hooks/useMapState';
import MapView from './components/MapView';
import Sidebar from './components/Sidebar';
import IncidentDrawer from './components/IncidentDrawer';
import SosForm from './components/SosForm';
import './index.css';

function App() {
  const { incidents, resources, hazardZones, loading, error } = useMapState();
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [showSosForm, setShowSosForm] = useState(false);
  const [activeTab, setActiveTab] = useState('incidents');

  const handleIncidentClick = (incident) => {
    setSelectedIncident(incident);
  };

  const handleDrawerClose = () => {
    setSelectedIncident(null);
  };

  return (
    <div className="app">
      <Sidebar
        incidents={incidents}
        resources={resources}
        onIncidentClick={handleIncidentClick}
        selectedIncident={selectedIncident}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div className="map-container">
        {loading && (
          <div className="map-loading">
            <div className="spinner" />
            <p>Loading disaster data...</p>
          </div>
        )}

        {error && (
          <div className="connection-status">
            <span className="pulse-dot" />
            {error}
          </div>
        )}

        <MapView
          incidents={incidents}
          resources={resources}
          hazardZones={hazardZones}
          onIncidentClick={handleIncidentClick}
          selectedIncident={selectedIncident}
        />

        {/* SOS Button */}
        <button className="sos-button" onClick={() => setShowSosForm(true)}>
          🆘 SOS Report
        </button>
      </div>

      {selectedIncident && (
        <IncidentDrawer
          incident={selectedIncident}
          resources={resources}
          onClose={handleDrawerClose}
        />
      )}

      {showSosForm && (
        <SosForm
          onClose={() => setShowSosForm(false)}
          onSubmit={() => setShowSosForm(false)}
        />
      )}
    </div>
  );
}

export default App;
