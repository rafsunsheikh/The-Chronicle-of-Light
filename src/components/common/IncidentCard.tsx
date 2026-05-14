import React from 'react';
import { HistoricalIncident } from '../../types/incident';

interface IncidentCardProps {
  incident: HistoricalIncident;
  onClick: (incident: HistoricalIncident) => void;
}

const categoryColors = {
  political: 'bg-blue-500',
  religious: 'bg-green-500',
  cultural: 'bg-purple-500',
  scientific: 'bg-yellow-500',
  military: 'bg-red-500',
};

export const IncidentCard: React.FC<IncidentCardProps> = ({ incident, onClick }) => {
  return (
    <div
      onClick={() => onClick(incident)}
      className="bg-white rounded-lg shadow-md p-4 cursor-pointer hover:shadow-lg transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-800">{incident.title}</h3>
          <p className="text-sm text-gray-600 mt-1">
            {new Date(incident.startDate).toLocaleDateString()}
          </p>
          <p className="text-xs text-gray-500 mt-1">{incident.location.name}</p>
        </div>
        <div className={`w-3 h-3 rounded-full ${categoryColors[incident.category]}`} />
      </div>
    </div>
  );
};
