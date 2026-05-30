import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { HistoricalIncident } from '../../types/incident';
import { MapMarker } from './MapMarker';

interface MapViewProps {
  incidents: HistoricalIncident[];
  onIncidentClick: (incident: HistoricalIncident) => void;
  timeRange: { start: string; end: string } | null;
  fill?: boolean; // fill the parent (full-window page) instead of the card layout
}

export const MapView: React.FC<MapViewProps> = ({
  incidents,
  onIncidentClick,
  timeRange,
  fill = false,
}) => {
  const filteredIncidents = incidents.filter(incident => {
    if (!incident.location) return false; // only geocoded events appear on the map
    if (!timeRange) return true;
    if (incident.startDate < timeRange.start) return false;
    if (incident.endDate && incident.endDate > timeRange.end) return false;
    return true;
  });

  return (
    <div className={fill ? 'h-full w-full' : 'bg-white rounded-lg shadow-md p-3 sm:p-4'}>
      {!fill && <h2 className="text-lg sm:text-2xl font-bold mb-3 sm:mb-4">Map</h2>}
      <div className={fill ? 'h-full w-full' : 'h-64 sm:h-80 lg:h-96 rounded'}>
        <MapContainer
          center={[30, 45]}
          zoom={3}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            subdomains={['a', 'b', 'c', 'd']}
            maxZoom={19}
          />
          {filteredIncidents.map(incident => (
            <MapMarker
              key={incident.id}
              incident={incident}
              onClick={onIncidentClick}
            />
          ))}
        </MapContainer>
      </div>
    </div>
  );
};
