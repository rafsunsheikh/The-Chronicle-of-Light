import { Marker, Popup } from 'react-leaflet';
import { HistoricalIncident } from '../../types/incident';
import L from 'leaflet';

const CATEGORY_COLOR: Record<string, string> = {
  political: '#3B82F6',
  religious: '#10B981',
  cultural: '#8B5CF6',
  scientific: '#F59E0B',
  military: '#EF4444',
};
const DEFAULT_COLOR = '#1B8A87';

interface MapMarkerProps {
  incident: HistoricalIncident;
  onClick: (incident: HistoricalIncident) => void;
}

export const MapMarker: React.FC<MapMarkerProps> = ({ incident, onClick }) => {
  const loc = incident.location;
  if (!loc) return null; // un-geocoded events aren't placed on the map
  const color = CATEGORY_COLOR[incident.category] ?? DEFAULT_COLOR;
  const customIcon = L.divIcon({
    className: 'custom-marker',
    html: `<div style="width: 20px; height: 20px; border-radius: 50%; background-color: ${color}; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

  return (
    <Marker
      position={[loc.latitude, loc.longitude]}
      icon={customIcon}
      eventHandlers={{
        click: () => onClick(incident),
      }}
    >
      <Popup>
        <div className="p-2">
          <h3 className="font-bold">{incident.title}</h3>
          <p className="text-sm text-gray-600">{incident.startDate}</p>
          <p className="text-sm">{loc.name}</p>
        </div>
      </Popup>
    </Marker>
  );
};
