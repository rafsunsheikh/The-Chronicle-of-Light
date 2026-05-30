import { useState, useCallback } from 'react';
import { useIncidents } from './hooks/useIncidents';
import { useHashRoute } from './hooks/useHashRoute';
import { NavBar } from './components/common/NavBar';
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
    selectedEra,
    setSelectedEra,
  } = useIncidents();

  const route = useHashRoute();
  const [selectedIncident, setSelectedIncident] = useState<HistoricalIncident | null>(null);

  const handleIncidentClick = useCallback((incident: HistoricalIncident) => {
    setSelectedIncident(incident);
  }, []);
  const handleCloseModal = useCallback(() => setSelectedIncident(null), []);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-panel font-sans">
      <NavBar route={route} eventCount={allIncidents.length} />

      <main className="flex-1 min-h-0">
        {route === '/timeline' && (
          <TimelineView
            fill
            incidents={incidents}
            onIncidentClick={handleIncidentClick}
            selectedEra={selectedEra}
            onEraChange={setSelectedEra}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />
        )}

        {route === '/map' && (
          <MapView
            fill
            incidents={incidents}
            onIncidentClick={handleIncidentClick}
            timeRange={dateRange}
          />
        )}

        {route === '/connections' && (
          <GraphView fill incidents={incidents} onNodeClick={handleIncidentClick} />
        )}

        {route === '/moments' && (
          <div className="h-full flex flex-col">
            <div className="shrink-0 p-4 border-b border-slate-200 bg-white">
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
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
              <div className="flex items-baseline justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-700">All moments</h3>
                <span className="text-xs text-slate-500">{incidents.length} shown</span>
              </div>
              {incidents.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  No incidents found matching your filters
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {incidents.map((incident) => (
                    <IncidentCard
                      key={incident.id}
                      incident={incident}
                      onClick={handleIncidentClick}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {selectedIncident && (
        <IncidentDetailModal incident={selectedIncident} onClose={handleCloseModal} />
      )}
    </div>
  );
}

export default App;
