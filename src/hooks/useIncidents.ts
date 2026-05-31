import { useCallback, useMemo, useState } from 'react';
import { HistoricalIncident } from '../types/incident';
import {
  EventOverrides,
  downloadJson,
  loadOverrides,
  persistOverrides,
} from '../lib/eventStore';

const eventModules = import.meta.glob<{ default: HistoricalIncident }>(
  '../data/events/**/*.json',
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

const baseIncidentsData: HistoricalIncident[] = Object.values(eventModules)
  .map((m) => m.default)
  .sort((a, b) => startTimestamp(a.startDate) - startTimestamp(b.startDate));

export function useIncidents() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);
  const [selectedEra, setSelectedEra] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Writable overlay (user edits + newly-added events) persisted to localStorage.
  const [overrides, setOverrides] = useState<EventOverrides>(() => loadOverrides());

  // Merge the immutable build-time data with the overlay: an override with the
  // same id replaces a base event; an override with a new id is appended.
  const incidents = useMemo(() => {
    const merged = new Map<string, HistoricalIncident>();
    for (const incident of baseIncidentsData) merged.set(incident.id, incident);
    for (const id of Object.keys(overrides)) merged.set(id, overrides[id]);
    return [...merged.values()].sort(
      (a, b) => startTimestamp(a.startDate) - startTimestamp(b.startDate),
    );
  }, [overrides]);

  const filteredIncidents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return incidents.filter(incident => {
      if (selectedCategory && incident.category !== selectedCategory) return false;
      if (selectedRegion && incident.region !== selectedRegion) return false;
      if (dateRange) {
        if (incident.startDate < dateRange.start) return false;
        if (incident.endDate && incident.endDate > dateRange.end) return false;
      }
      if (query) {
        const haystack = [
          incident.title,
          incident.description,
          incident.region,
          incident.dynasty,
          incident.category,
          incident.location?.name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [incidents, selectedCategory, selectedRegion, dateRange, searchQuery]);

  const categories = useMemo(() => {
    return [...new Set(incidents.map(i => i.category))];
  }, [incidents]);

  const regions = useMemo(() => {
    return [...new Set(incidents.map(i => i.region).filter((r): r is string => !!r))];
  }, [incidents]);

  // Insert or update an event in the overlay and persist it.
  const upsertIncident = useCallback((incident: HistoricalIncident) => {
    setOverrides((prev) => {
      const next = { ...prev, [incident.id]: incident };
      persistOverrides(next);
      return next;
    });
  }, []);

  const changeCount = Object.keys(overrides).length;

  // Download every edited / added event as a JSON array so it can be committed
  // back into src/data/events/.
  const exportChanges = useCallback(() => {
    const list = Object.values(overrides);
    if (list.length === 0) return;
    downloadJson(`events-export-${list.length}.json`, list);
  }, [overrides]);

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
    searchQuery,
    setSearchQuery,
    upsertIncident,
    exportChanges,
    changeCount,
  };
}
