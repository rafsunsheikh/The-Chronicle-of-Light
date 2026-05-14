import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { HistoricalIncident } from '../../types/incident';

interface MapViewProps {
  incidents: HistoricalIncident[];
  onIncidentClick: (incident: HistoricalIncident) => void;
  timeRange: { start: string; end: string } | null;
}

export const MapView: React.FC<MapViewProps> = ({
  incidents,
  onIncidentClick,
  timeRange,
}) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(true);
  }, []);

  if (!isReady) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4">
        <h2 className="text-2xl font-bold mb-4">Map</h2>
        <div className="h-96 rounded flex items-center justify-center bg-gray-100">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      </div>
    );
  }

  const filteredIncidents = incidents.filter(incident => {
    if (!timeRange) return true;
    if (incident.startDate < timeRange.start) return false;
    if (incident.endDate && incident.endDate > timeRange.end) return false;
    return true;
  });

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h2 className="text-2xl font-bold mb-4">Map</h2>
      <div className="h-96 rounded">
        <MapContainer
          center={[30, 45]}
          zoom={3}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {filteredIncidents.map(incident => (
            <Marker
              key={incident.id}
              position={[incident.location.latitude, incident.location.longitude]}
              eventHandlers={{
                click: () => onIncidentClick(incident),
              }}
            >
              <Popup>
                <div className="p-2">
                  <h3 className="font-bold">{incident.title}</h3>
                  <p className="text-sm text-gray-600">{incident.startDate}</p>
                  <p className="text-sm">{incident.location.name}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
};
