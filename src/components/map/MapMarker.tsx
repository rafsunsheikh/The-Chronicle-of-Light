import { Marker, Tooltip } from 'react-leaflet';
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

const formatYear = (iso: string): string => {
  const year = parseInt(iso.split('-')[0], 10);
  return Number.isNaN(year) ? iso : String(year);
};

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
      {/* Hover preview card. `interactive` keeps it alive while the pointer is
          over it, so clicking the card itself opens the event too. */}
      <Tooltip
        direction="top"
        offset={[0, -14]}
        opacity={1}
        interactive
        className="map-hover-tooltip"
      >
        <div
          role="button"
          tabIndex={0}
          onClick={() => onClick(incident)}
          className="w-44 sm:w-52 max-w-[75vw] cursor-pointer rounded-md bg-white px-3 py-2 shadow-lg ring-1 ring-slate-200"
        >
          <div
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color }}
          >
            {incident.category}
          </div>
          <div className="text-sm font-semibold leading-snug text-slate-800">
            {incident.title}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            {formatYear(incident.startDate)}
            {loc.name ? ` · ${loc.name}` : ''}
          </div>
        </div>
      </Tooltip>
    </Marker>
  );
};
