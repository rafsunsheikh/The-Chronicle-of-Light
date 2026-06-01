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
import { EventFormModal } from './components/common/EventFormModal';
import { DashboardPage } from './components/contrib/DashboardPage';
import { LeaderboardPage } from './components/contrib/LeaderboardPage';
import { ReviewPage } from './components/contrib/ReviewPage';
import { emptyIncident, generateId } from './lib/eventStore';
import { createSubmission } from './lib/submissions';
import { useAuth } from './lib/auth';
import type { HistoricalIncident } from './types/incident';

interface EditorState {
  mode: 'add' | 'edit';
  draft: HistoricalIncident;
}

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
    searchQuery,
    setSearchQuery,
    refreshEvents,
  } = useIncidents();

  const { enabled: authEnabled, user, signInWithGoogle } = useAuth();

  const route = useHashRoute();
  const [selectedIncident, setSelectedIncident] = useState<HistoricalIncident | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);

  const handleIncidentClick = useCallback((incident: HistoricalIncident) => {
    setSelectedIncident(incident);
  }, []);
  const handleCloseModal = useCallback(() => setSelectedIncident(null), []);

  // Contributing requires sign-in: if a signed-out user clicks Edit/Add, send
  // them through Google sign-in instead of opening the form.
  const requireAuth = useCallback((): boolean => {
    if (user) return true;
    if (authEnabled) signInWithGoogle();
    return false;
  }, [user, authEnabled, signInWithGoogle]);

  const handleEdit = useCallback(
    (incident: HistoricalIncident) => {
      if (!requireAuth()) return;
      setEditor({ mode: 'edit', draft: incident });
    },
    [requireAuth],
  );

  const handleAddEvent = useCallback(() => {
    if (!requireAuth()) return;
    setEditor({ mode: 'add', draft: emptyIncident() });
  }, [requireAuth]);

  // Submit the proposed edit/new event as a pending submission. Returns the
  // result so the form can show success / error inline.
  const handleSaveEvent = useCallback(
    async (draft: HistoricalIncident, note: string) => {
      if (!user) {
        return { error: 'You must be signed in to contribute.' };
      }
      let payload = draft;
      const isCreate = !payload.id;
      if (isCreate) {
        const taken = new Set(allIncidents.map((i) => i.id));
        payload = { ...draft, id: generateId(draft.title, draft.startDate, taken) };
      }
      return createSubmission({
        type: isCreate ? 'create' : 'edit',
        payload,
        authorId: user.id,
        authorEmail: user.email ?? null,
        note,
      });
    },
    [allIncidents, user],
  );

  const handleCancelEdit = useCallback(() => setEditor(null), []);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-panel font-sans">
      <NavBar
        route={route}
        eventCount={allIncidents.length}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

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
            onAddEvent={handleAddEvent}
          />
        )}

        {route === '/map' && (
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
            <div className="flex-1 min-h-0">
              <MapView
                fill
                incidents={incidents}
                onIncidentClick={handleIncidentClick}
                timeRange={dateRange}
              />
            </div>
          </div>
        )}

        {route === '/connections' && (
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
            <div className="flex-1 min-h-0">
              <GraphView fill incidents={incidents} onNodeClick={handleIncidentClick} />
            </div>
          </div>
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

        {route === '/leaderboard' && <LeaderboardPage />}

        {route === '/dashboard' && <DashboardPage />}

        {route === '/review' && (
          <ReviewPage currentEvents={allIncidents} onChanged={refreshEvents} />
        )}
      </main>

      {selectedIncident && (
        <IncidentDetailModal
          incident={selectedIncident}
          onClose={handleCloseModal}
          onEdit={handleEdit}
        />
      )}

      {editor && (
        <EventFormModal
          draft={editor.draft}
          mode={editor.mode}
          onSave={handleSaveEvent}
          onCancel={handleCancelEdit}
        />
      )}
    </div>
  );
}

export default App;
