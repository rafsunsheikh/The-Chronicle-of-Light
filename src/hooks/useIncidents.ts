import { useState, useMemo } from 'react';
import { HistoricalIncident } from '../types/incident';

const eventModules = import.meta.glob<{ default: HistoricalIncident }>(
  '../data/events/*.json',
  { eager: true },
);
// Sort numerically rather than lexicographically — protects against any
// data inconsistency where some dates are 3-digit ("610-10-13") and others
// are 4-digit ("0610-10-13"); string compare would put all 4-digit before
// all 3-digit even when the underlying years say otherwise. The schema now
// requires 4-digit years, so this is defensive but cheap.
const startTimestamp = (iso: string): number => {
  const [y, m, d] = iso.split('-').map((s) => parseInt(s, 10));
  return new Date(Date.UTC(y || 0, (m || 1) - 1, d || 1)).getTime();
};

const incidentsData: HistoricalIncident[] = Object.values(eventModules)
  .map((m) => m.default)
  .sort((a, b) => startTimestamp(a.startDate) - startTimestamp(b.startDate));

export function useIncidents() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);
  const [selectedEra, setSelectedEra] = useState<string | undefined>(undefined);

  const incidents = useMemo(() => {
    return incidentsData as HistoricalIncident[];
  }, []);

  const filteredIncidents = useMemo(() => {
    return incidents.filter(incident => {
      if (selectedCategory && incident.category !== selectedCategory) return false;
      if (selectedRegion && incident.region !== selectedRegion) return false;
      if (dateRange) {
        if (incident.startDate < dateRange.start) return false;
        if (incident.endDate && incident.endDate > dateRange.end) return false;
      }
      return true;
    });
  }, [incidents, selectedCategory, selectedRegion, dateRange]);

  const categories = useMemo(() => {
    return [...new Set(incidents.map(i => i.category))];
  }, [incidents]);

  const regions = useMemo(() => {
    return [...new Set(incidents.map(i => i.region).filter((r): r is string => !!r))];
  }, [incidents]);

  return {
    incidents: filteredIncidents,
    allIncidents: incidents,
    categories,
    regions,
    selectedCategory,
    setSelectedCategory,
    selectedRegion,
    setSelectedRegion,
    dateRange,
    setDateRange,
    selectedEra,
    setSelectedEra,
  };
}
