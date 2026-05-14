import { Marker, Popup } from 'react-leaflet';
import { HistoricalIncident } from '../../types/incident';
import L from 'leaflet';

const categoryIcons: Record<string, string> = {
  political: 'bg-blue-500',
  religious: 'bg-green-500',
  cultural: 'bg-purple-500',
  scientific: 'bg-yellow-500',
  military: 'bg-red-500',
};

interface MapMarkerProps {
  incident: HistoricalIncident;
  onClick: (incident: HistoricalIncident) => void;
}

export const MapMarker: React.FC<MapMarkerProps> = ({ incident, onClick }) => {
  const customIcon = L.divIcon({
    className: 'custom-marker',
    html: `<div style="width: 20px; height: 20px; border-radius: 50%; background-color: ${categoryIcons[incident.category]}; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

  return (
    <Marker
      position={[incident.location.latitude, incident.location.longitude]}
      icon={customIcon}
      eventHandlers={{
        click: () => onClick(incident),
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
  );
};
