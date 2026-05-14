import { useState, useMemo } from 'react';
import { HistoricalIncident } from '../types/incident';
import incidentsData from '../data/incidents.json';

export function useIncidents() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);

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
  };
}
