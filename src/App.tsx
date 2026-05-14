import { useState, useCallback } from 'react';
import { useIncidents } from './hooks/useIncidents';
import { IncidentCard } from './components/common/IncidentCard';
import { FilterBar } from './components/common/FilterBar';
import { TimelineView } from './components/timeline/TimelineView';
import { MapView } from './components/map/MapView';
import { GraphView } from './components/graph/GraphView';
import { IncidentDetailModal } from './components/common/IncidentDetailModal';
import type { HistoricalIncident } from './types/incident';

function App() {
  const {
    incidents,
    allIncidents,
    categories,
    regions,
    selectedCategory,
    setSelectedCategory,
    selectedRegion,
    setSelectedRegion,
    dateRange,
    setDateRange,
  } = useIncidents();

  const [selectedIncident, setSelectedIncident] = useState<HistoricalIncident | null>(null);
  const [selectedEra, setSelectedEra] = useState<string | undefined>(undefined);

  const getRelatedIncidents = useCallback(
    (incident: HistoricalIncident) => {
      return allIncidents.filter((i) =>
        incident.connections.includes(i.id)
      );
    },
    [allIncidents]
  );

  const handleIncidentClick = useCallback((incident: HistoricalIncident) => {
    setSelectedIncident(incident);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedIncident(null);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-indigo-600 text-white p-6">
        <h1 className="text-3xl font-bold">Islamic History Timeline</h1>
        <p className="mt-2">Explore 1400+ years of Islamic history</p>
      </header>

      <main className="container mx-auto p-6">
        <FilterBar
          categories={categories}
          regions={regions}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          selectedRegion={selectedRegion}
          setSelectedRegion={setSelectedRegion}
          dateRange={dateRange}
          setDateRange={setDateRange}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <TimelineView
            incidents={incidents}
            onIncidentClick={handleIncidentClick}
            selectedEra={selectedEra}
            onEraChange={setSelectedEra}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />
          <MapView
            incidents={incidents}
            onIncidentClick={handleIncidentClick}
            timeRange={dateRange}
          />
        </div>

        <div className="mb-6">
          <GraphView
            incidents={incidents}
            onNodeClick={handleIncidentClick}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {incidents.map((incident) => (
            <IncidentCard
              key={incident.id}
              incident={incident}
              onClick={handleIncidentClick}
            />
          ))}
        </div>

        {incidents.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No incidents found matching your filters
          </div>
        )}
      </main>

      {selectedIncident && (
        <IncidentDetailModal
          incident={selectedIncident}
          onClose={handleCloseModal}
          relatedIncidents={getRelatedIncidents(selectedIncident)}
        />
      )}
    </div>
  );
}

export default App;
