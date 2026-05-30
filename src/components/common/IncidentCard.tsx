import React from 'react';
import { HistoricalIncident } from '../../types/incident';

interface IncidentCardProps {
  incident: HistoricalIncident;
  onClick: (incident: HistoricalIncident) => void;
}

export const IncidentCard: React.FC<IncidentCardProps> = ({ incident, onClick }) => {
  return (
    <div
      onClick={() => onClick(incident)}
      className="bg-white rounded-md border border-slate-200 p-4 cursor-pointer hover:border-slate-400 transition-colors"
    >
      <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">
        {incident.category}
      </div>
      <h3 className="font-semibold text-slate-900">{incident.title}</h3>
      <p className="text-sm text-slate-600 mt-1">
        {new Date(incident.startDate).toLocaleDateString()}
      </p>
      <p className="text-xs text-slate-500 mt-1">{incident.location?.name ?? '—'}</p>
    </div>
  );
};
