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

  const [selectedIncident, setSelectedIncident] = useState<HistoricalIncident | null>(null);

  const handleIncidentClick = useCallback((incident: HistoricalIncident) => {
    setSelectedIncident(incident);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedIncident(null);
  }, []);

  return (
    <div className="min-h-screen bg-panel font-sans">
      {/* Immersive timeline stage */}
      <section className="relative bg-white">
        {/* Navy logo gutter (top-left, overlays the white stage) */}
        <div className="absolute top-0 left-0 z-20 bg-navy-nma text-white px-3 sm:px-4 w-24 sm:w-40 h-12 sm:h-16 flex flex-col justify-center">
          <div className="text-[9px] sm:text-[10px] tracking-widest uppercase opacity-70 leading-tight">The</div>
          <div className="font-bold leading-tight text-[11px] sm:text-sm">Chronicle of Light</div>
        </div>

        <TimelineView
          incidents={incidents}
          onIncidentClick={handleIncidentClick}
          selectedEra={selectedEra}
          onEraChange={setSelectedEra}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />
      </section>

      {/* Secondary content section */}
      <section className="bg-panel">
        <div className="container mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
          <header className="border-b border-slate-200 pb-3 sm:pb-4">
            <h2 className="text-xs uppercase tracking-widest text-slate-500">Explore further</h2>
          </header>

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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <MapView
              incidents={incidents}
              onIncidentClick={handleIncidentClick}
              timeRange={dateRange}
            />

            <GraphView
              incidents={incidents}
              onNodeClick={handleIncidentClick}
            />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">All moments</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {incidents.map((incident) => (
                <IncidentCard
                  key={incident.id}
                  incident={incident}
                  onClick={handleIncidentClick}
                />
              ))}
            </div>
          </div>

          {incidents.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              No incidents found matching your filters
            </div>
          )}
        </div>
      </section>

      {selectedIncident && (
        <IncidentDetailModal
          incident={selectedIncident}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}

export default App;
