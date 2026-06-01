import { useCallback, useEffect, useMemo, useState } from 'react';
import { HistoricalIncident } from '../types/incident';
import { supabase } from '../lib/supabase';

const eventModules = import.meta.glob<{ default: HistoricalIncident }>(
  '../data/events/**/*.json',
  { eager: true },
);

// PostgREST caps a single response at 1,000 rows, so the corpus is fetched in
// pages. Returns null on any failure (or an empty/not-yet-seeded table) so the
// caller falls back to the bundled JSON mirror.
const DB_PAGE_SIZE = 1000;
async function fetchAllEvents(): Promise<HistoricalIncident[] | null> {
  if (!supabase) return null;
  const all: HistoricalIncident[] = [];
  for (let from = 0; ; from += DB_PAGE_SIZE) {
    const { data, error } = await supabase
      .from('events')
      .select('payload')
      .range(from, from + DB_PAGE_SIZE - 1);
    if (error || !data) return null;
    all.push(...data.map((r) => (r as { payload: HistoricalIncident }).payload));
    if (data.length < DB_PAGE_SIZE) break;
  }
  return all.length > 0 ? all : null;
}
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

  // The canonical corpus lives in Supabase. We render the bundled JSON mirror
  // immediately for a fast first paint, then replace it with the live table
  // data once it loads. `null` means "DB not loaded / unavailable" → keep the
  // bundled fallback.
  const [dbEvents, setDbEvents] = useState<HistoricalIncident[] | null>(null);

  const refreshEvents = useCallback(async () => {
    const events = await fetchAllEvents();
    if (events) setDbEvents(events);
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Fetch inside an async IIFE so setState happens after the await (not
    // synchronously in the effect body).
    void (async () => {
      const events = await fetchAllEvents();
      if (!cancelled && events) setDbEvents(events);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const incidents = useMemo(() => {
    const source = dbEvents ?? baseIncidentsData;
    return [...source].sort(
      (a, b) => startTimestamp(a.startDate) - startTimestamp(b.startDate),
    );
  }, [dbEvents]);

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
    refreshEvents,
  };
}
