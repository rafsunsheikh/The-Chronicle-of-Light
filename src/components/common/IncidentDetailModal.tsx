import React, { useEffect } from 'react';
import { HistoricalIncident } from '../../types/incident';

interface IncidentDetailModalProps {
  incident: HistoricalIncident | null;
  onClose: () => void;
  relatedIncidents: HistoricalIncident[];
}

const categoryColors: Record<string, string> = {
  political: 'bg-blue-100 text-blue-800',
  religious: 'bg-green-100 text-green-800',
  cultural: 'bg-purple-100 text-purple-800',
  scientific: 'bg-yellow-100 text-yellow-800',
  military: 'bg-red-100 text-red-800',
};

export const IncidentDetailModal: React.FC<IncidentDetailModalProps> = ({
  incident,
  onClose,
  relatedIncidents,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (incident) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'auto';
    };
  }, [incident, onClose]);

  if (!incident) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-3xl font-bold">{incident.title}</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              &times;
            </button>
          </div>

          <div className="flex gap-4 mb-4 flex-wrap">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${categoryColors[incident.category]}`}>
              {incident.category.charAt(0).toUpperCase() + incident.category.slice(1)}
            </span>
            {incident.dynasty && (
              <span className="px-3 py-1 bg-gray-100 rounded-full text-sm">
                {incident.dynasty}
              </span>
            )}
            {incident.region && (
              <span className="px-3 py-1 bg-gray-100 rounded-full text-sm">
                {incident.region}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-500">Date</h3>
              <p>{new Date(incident.startDate).toLocaleDateString()}</p>
              {incident.endDate && incident.endDate !== incident.startDate && (
                <p className="text-sm text-gray-600">
                  to {new Date(incident.endDate).toLocaleDateString()}
                </p>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-500">Location</h3>
              <p>{incident.location.name}</p>
              <p className="text-sm text-gray-600">
                {incident.location.latitude.toFixed(4)}, {incident.location.longitude.toFixed(4)}
              </p>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Description</h3>
            <p className="text-gray-700">{incident.description}</p>
          </div>

          {incident.connections.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Related Events</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {relatedIncidents.map((related) => (
                  <div
                    key={related.id}
                    className="p-3 bg-gray-50 rounded cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    <p className="font-medium">{related.title}</p>
                    <p className="text-sm text-gray-600">{related.startDate}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
