# Islamic History Timeline Web App Implementation Plan

## Overview

This plan outlines the implementation of an interactive web application for exploring Islamic history through timeline and map visualizations. The application will enable users to navigate 100-200 historical events spanning 400 CE to present, view them on an interactive map with time-based filtering, and explore connections between related events for sequential learning.

## Current State Analysis

- **Repository**: Empty except for configuration files (`.claude/`, `CLAUDE.md`, `README.md`)
- **Research**: Comprehensive research completed covering timeline libraries, map libraries, and combined solutions
- **Technology Stack**: Not yet initialized (no `package.json`, no source code)
- **Data**: No historical incident data exists yet

### Key Discoveries:
- **vis-timeline** is the recommended timeline library (2.5k GitHub stars, Apache-2.0/MIT license) - supports React components and extensive interaction
- **Leaflet + Leaflet.TimeDimension** is the primary solution for time-based map visualization - lightweight (~42KB), no external dependencies
- No existing source code patterns to follow - this is a greenfield implementation

## Desired End State

A fully functional React + TypeScript web application with:
1. Interactive timeline view using vis-timeline showing 100-200 Islamic history events
2. Interactive map view using Leaflet.TimeDimension with time slider and play controls
3. Graph visualization using React Flow showing connections between related events
4. Incident detail cards with full information, media, and related events
5. Filtering by date, category, and region
6. Responsive design with Tailwind CSS

### Verification:
- `npm run dev` starts development server successfully
- Timeline displays events with drag, selection, and tooltips
- Map shows markers with time-based filtering via slider
- Clicking an incident shows details and related connections
- Build completes without errors: `npm run build`

### Key Discoveries:
- **vis-timeline** requires manual React wrapper (no official React binding) - must use refs and useEffect
- **Leaflet.TimeDimension** provides built-in time slider, play/pause, and speed controls
- **React Flow** is the recommended graph library (36.5k GitHub stars) - nodes are React components
- All three visualizations can share the same incident data structure

## What We're NOT Doing

- No backend server or database - all data stored as JSON files
- No authentication or user accounts
- No real-time updates or WebSocket connections
- No mobile app (responsive web only)
- No content management system for non-technical users
- No search functionality in Phase 1 (can be added later)
- No multi-language support in Phase 1

## Implementation Approach

The implementation follows a phased approach:
1. **Phase 1**: Project setup, data structure, and basic incident display
2. **Phase 2**: Timeline visualization with vis-timeline
3. **Phase 3**: Map visualization with Leaflet.TimeDimension
4. **Phase 4**: Graph visualization with React Flow
5. **Phase 5**: Integration, polishing, and production build

Each phase builds on the previous one, ensuring working functionality at each step.

---

## Phase 1: Project Setup and Data Structure

### Overview
Initialize the React + TypeScript + Vite project with Tailwind CSS, establish the data structure, and create basic incident components.

### Changes Required:

#### 1. Initialize Project with Vite
**File**: `package.json` (new)
**Changes**: Create package.json with all dependencies

```bash
# Run these commands:
npm create vite@latest . -- --template react-ts
npm install
```

**Dependencies to install**:
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "vis-timeline": "^7.7.0",
    "leaflet": "^1.9.4",
    "leaflet.timedimension": "^1.1.1",
    "react-leaflet": "^4.2.0",
    "@xyflow/react": "^12.0.0",
    "react-scripts": "5.0.1"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@types/leaflet": "^1.9.0",
    "@types/leaflet.timedimension": "^1.0.2",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }
}
```

#### 2. Configure Tailwind CSS
**Files**: `tailwind.config.js`, `postcss.config.js`, `src/index.css` (new)
**Changes**: Set up Tailwind with basic configuration

```javascript
// tailwind.config.js
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

```css
/* src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@import 'leaflet/dist/leaflet.css';
@import 'leaflet.timedimension.control.min.css';
@import '@xyflow/react/dist/style.css';
```

#### 3. Create TypeScript Types
**File**: `src/types/incident.ts` (new)
**Changes**: Define incident data structure

```typescript
export interface Location {
  latitude: number;
  longitude: number;
  name: string;
}

export interface Media {
  type: 'image' | 'video' | 'document';
  url: string;
  caption?: string;
}

export interface HistoricalIncident {
  id: string;
  title: string;
  description: string;
  startDate: string; // ISO date string (YYYY-MM-DD)
  endDate?: string; // ISO date string
  location: Location;
  category: 'political' | 'religious' | 'cultural' | 'scientific' | 'military';
  connections: string[]; // Related incident IDs
  learningPath?: string;
  media?: Media[];
  dynasty?: string;
  region?: string;
}
```

#### 4. Create Sample Data
**File**: `src/data/incidents.json` (new)
**Changes**: Create initial dataset with 10-15 sample events covering different categories and regions

```json
[
  {
    "id": "event-001",
    "title": "Revelation of the Quran",
    "description": "First revelation of the Quran to Prophet Muhammad in Cave Hira",
    "startDate": "610-10-13",
    "endDate": "610-10-13",
    "location": {
      "latitude": 21.4225,
      "longitude": 39.8175,
      "name": "Mecca, Arabia"
    },
    "category": "religious",
    "connections": ["event-002"],
    "learningPath": "early-islamic-period",
    "dynasty": "Pre-Islamic",
    "region": "Arabia"
  },
  {
    "id": "event-002",
    "title": "Hijra (Migration to Medina)",
    "description": "Prophet Muhammad and early Muslims migrate from Mecca to Medina",
    "startDate": "622-09-24",
    "endDate": "622-09-24",
    "location": {
      "latitude": 24.5247,
      "longitude": 39.5692,
      "name": "Medina, Arabia"
    },
    "category": "political",
    "connections": ["event-001", "event-003"],
    "learningPath": "early-islamic-period",
    "dynasty": "Rashidun",
    "region": "Arabia"
  }
  // Add 10+ more events...
]
```

#### 5. Create Incident Data Hook
**File**: `src/hooks/useIncidents.ts` (new)
**Changes**: Hook to load and filter incident data

```typescript
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
    return [...new Set(incidents.map(i => i.region).filter(Boolean))];
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
```

#### 6. Create Incident Card Component
**File**: `src/components/common/IncidentCard.tsx` (new)
**Changes**: Display incident summary with title, date, and category

```tsx
import React from 'react';
import { HistoricalIncident } from '../../types/incident';

interface IncidentCardProps {
  incident: HistoricalIncident;
  onClick: (incident: HistoricalIncident) => void;
}

export const IncidentCard: React.FC<IncidentCardProps> = ({ incident, onClick }) => {
  const categoryColors = {
    political: 'bg-blue-500',
    religious: 'bg-green-500',
    cultural: 'bg-purple-500',
    scientific: 'bg-yellow-500',
    military: 'bg-red-500',
  };

  return (
    <div
      onClick={() => onClick(incident)}
      className="bg-white rounded-lg shadow-md p-4 cursor-pointer hover:shadow-lg transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-800">{incident.title}</h3>
          <p className="text-sm text-gray-600 mt-1">
            {new Date(incident.startDate).toLocaleDateString()}
          </p>
          <p className="text-xs text-gray-500 mt-1">{incident.location.name}</p>
        </div>
        <div className={`w-3 h-3 rounded-full ${categoryColors[incident.category]}`} />
      </div>
    </div>
  );
};
```

#### 7. Create Filter Component
**File**: `src/components/common/FilterBar.tsx` (new)
**Changes**: Filter bar for category, region, and date range

```tsx
import React from 'react';

interface FilterBarProps {
  categories: string[];
  regions: string[];
  selectedCategory: string | null;
  setSelectedCategory: (category: string | null) => void;
  selectedRegion: string | null;
  setSelectedRegion: (region: string | null) => void;
  dateRange: { start: string; end: string } | null;
  setDateRange: (range: { start: string; end: string } | null) => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  categories,
  regions,
  selectedCategory,
  setSelectedCategory,
  selectedRegion,
  setSelectedRegion,
  dateRange,
  setDateRange,
}) => {
  return (
    <div className="bg-gray-100 p-4 rounded-lg mb-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <select
          value={selectedCategory || ''}
          onChange={(e) => setSelectedCategory(e.target.value || null)}
          className="p-2 border rounded"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        <select
          value={selectedRegion || ''}
          onChange={(e) => setSelectedRegion(e.target.value || null)}
          className="p-2 border rounded"
        >
          <option value="">All Regions</option>
          {regions.map((region) => (
            <option key={region} value={region}>{region}</option>
          ))}
        </select>

        <input
          type="date"
          value={dateRange?.start || ''}
          onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
          className="p-2 border rounded"
          placeholder="Start Date"
        />

        <input
          type="date"
          value={dateRange?.end || ''}
          onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
          className="p-2 border rounded"
          placeholder="End Date"
        />
      </div>
    </div>
  );
};
```

#### 8. Create Main App Component
**File**: `src/App.tsx` (modify)
**Changes**: Basic app structure with header and placeholder views

```tsx
import React from 'react';
import { useIncidents } from './hooks/useIncidents';
import { IncidentCard } from './components/common/IncidentCard';
import { FilterBar } from './components/common/FilterBar';

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
  } = useIncidents();

  const handleIncidentClick = (incident: any) => {
    console.log('Selected incident:', incident);
    // TODO: Open incident detail modal
  };

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
    </div>
  );
}

export default App;
```

#### 9. Create Vite Configuration
**File**: `vite.config.ts` (new)
**Changes**: Configure Vite with React plugin

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
```

#### 10. Create TypeScript Configuration
**File**: `tsconfig.json` (new)
**Changes**: TypeScript configuration for React + Vite

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Project builds successfully: `npm run build`
- [ ] TypeScript compiles without errors: `npx tsc --noEmit`
- [ ] Linting passes (if ESLint configured)
- [ ] Development server starts: `npm run dev`

#### Manual Verification:
- [ ] Application loads in browser without errors
- [ ] Header displays "Islamic History Timeline"
- [ ] Filter bar shows category and region dropdowns
- [ ] Incident cards display for all sample events
- [ ] Clicking an incident logs to console (placeholder for Phase 2)
- [ ] Filters work and hide/show incidents accordingly

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Timeline Visualization

### Overview
Implement the interactive timeline view using vis-timeline, allowing users to scroll through history, drag events, and see detailed tooltips.

### Changes Required:

#### 1. Create Timeline Wrapper Component
**File**: `src/components/timeline/TimelineView.tsx` (new)
**Changes**: React wrapper for vis-timeline

```tsx
import React, { useEffect, useRef, useCallback } from 'react';
import { Timeline, TimelineOptions, ItemSet, GroupData } from 'vis-timeline/standalone';
import { HistoricalIncident } from '../../types/incident';
import '../../index.css';

interface TimelineViewProps {
  incidents: HistoricalIncident[];
  onIncidentClick: (incident: HistoricalIncident) => void;
  selectedDate: string | null;
  onDateChange: (date: string | null) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  incidents,
  onIncidentClick,
  selectedDate,
  onDateChange,
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const timelineInstance = useRef<Timeline | null>(null);

  useEffect(() => {
    if (!timelineRef.current) return;

    const items = incidents.map(incident => ({
      id: incident.id,
      content: incident.title,
      start: incident.startDate,
      end: incident.endDate || undefined,
      group: incident.category,
      className: `incident-${incident.category}`,
    }));

    const groups = Array.from(new Set(incidents.map(i => i.category))).map(category => ({
      id: category,
      content: category.charAt(0).toUpperCase() + category.slice(1),
    }));

    const options: TimelineOptions = {
      stack: true,
      margin: {
        item: 10,
        axis: 5,
      },
      editable: {
        add: true,
        updateTime: true,
        remove: true,
      },
      orientation: 'top',
      showCurrentTime: false,
      clusterGroupFn: (items) => {
        // Cluster items that overlap
        return items.length > 1;
      },
      cluster: true,
      selectable: true,
      snap: (date, scale, step) => {
        // Snap to day precision
        return date;
      },
    };

    timelineInstance.current = new Timeline(timelineRef.current, items, options);

    const handleSelection = (info: { items: string[] }) => {
      if (info.items.length > 0) {
        const incident = incidents.find(i => i.id === info.items[0]);
        if (incident) {
          onIncidentClick(incident);
        }
      }
    };

    timelineInstance.current.on('select', handleSelection);

    return () => {
      if (timelineInstance.current) {
        timelineInstance.current.off('select', handleSelection);
        timelineInstance.current.destroy();
      }
    };
  }, [incidents, onIncidentClick]);

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h2 className="text-2xl font-bold mb-4">Timeline</h2>
      <div ref={timelineRef} className="h-96" />
    </div>
  );
};
```

#### 2. Create Timeline Custom CSS
**File**: `src/components/timeline/timeline.css` (new)
**Changes**: Custom styling for timeline items

```css
.incident-political {
  border-left: 4px solid #3b82f6;
}

.incident-religious {
  border-left: 4px solid #22c55e;
}

.incident-cultural {
  border-left: 4px solid #a855f7;
}

.incident-scientific {
  border-left: 4px solid #eab308;
}

.incident-military {
  border-left: 4px solid #ef4444;
}
```

#### 3. Update App Component to Include Timeline
**File**: `src/App.tsx` (modify)
**Changes**: Add timeline view alongside incident list

```tsx
import React, { useState } from 'react';
import { useIncidents } from './hooks/useIncidents';
import { IncidentCard } from './components/common/IncidentCard';
import { FilterBar } from './components/common/FilterBar';
import { TimelineView } from './components/timeline/TimelineView';

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
  } = useIncidents();

  const [selectedIncident, setSelectedIncident] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const handleIncidentClick = (incident: any) => {
    setSelectedIncident(incident);
  };

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

        <div className="mb-6">
          <TimelineView
            incidents={incidents}
            onIncidentClick={handleIncidentClick}
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
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
      </main>
    </div>
  );
}

export default App;
```

### Success Criteria:

#### Automated Verification:
- [ ] Timeline component renders without errors
- [ ] vis-timeline library loads successfully
- [ ] Events display on timeline with correct dates
- [ ] Groups appear on the left side by category
- [ ] Build completes: `npm run build`

#### Manual Verification:
- [ ] Timeline shows scrollable horizontal view
- [ ] Events are visible and properly positioned by date
- [ ] Clicking an event selects it and opens incident details
- [ ] Zoom in/out works with mouse wheel
- [ ] Drag events to different dates (if editable enabled)
- [ ] Tooltips show on hover with incident summary

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Map Visualization

### Overview
Implement the interactive map view using Leaflet and Leaflet.TimeDimension, allowing users to view incidents on a map with time-based filtering.

### Changes Required:

#### 1. Create Map View Component
**File**: `src/components/map/MapView.tsx` (new)
**Changes**: Leaflet map with time dimension support

```tsx
import React, { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet.timedimension';
import { HistoricalIncident } from '../../types/incident';
import 'leaflet/dist/leaflet.css';
import 'leaflet.timedimension.control.min.css';

interface MapViewProps {
  incidents: HistoricalIncident[];
  onIncidentClick: (incident: HistoricalIncident) => void;
  timeRange: { start: string; end: string } | null;
}

export const MapView: React.FC<MapViewProps> = ({
  incidents,
  onIncidentClick,
  timeRange,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const timeDimensionLayerRef = useRef<L.TimeDimensionLayer | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // Initialize map
    mapInstance.current = L.map(mapRef.current).setView([30, 45], 3); // Center on Middle East

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(mapInstance.current);

    // Initialize time dimension
    const timeDimension = L.timeDimension({
      periods: 'P1Y', // Yearly periods
      autoplay: false,
      currentTimeStep: new Date('610-01-01'),
      minBufferTime: 1000,
      maxBufferTime: 1000,
    });

    const timeDimensionControl = L.control.timeDimension({
      position: 'bottomright',
      timeDimensionOptions: {
        currentTimeStep: new Date('610-01-01'),
        period: 'P1Y',
      },
      chain: true,
      autoplay: false,
      loop: false,
      autoplayButton: true,
      autoplayButtonOptions: {
        style: 'play',
        playLabel: 'Play',
        pauseLabel: 'Pause',
      },
      timeframe: false,
    }).addTo(mapInstance.current);

    // Create GeoJSON layer
    const createGeoJsonLayer = () => {
      const geoJsonData = {
        type: 'FeatureCollection',
        features: incidents.map(incident => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [incident.location.longitude, incident.location.latitude],
          },
          properties: {
            ...incident,
            time: incident.startDate,
          },
        })),
      };

      const layer = L.geoJSON(geoJsonData, {
        pointToLayer: (feature, latlng) => {
          const marker = L.marker(latlng);
          marker.on('click', () => {
            onIncidentClick(feature.properties as HistoricalIncident);
          });
          return marker;
        },
      }).addTo(mapInstance.current!);

      timeDimensionLayerRef.current = L.timeDimension.layer(layer, {
        updateTimeDimension: true,
        updateMode: 'intersect',
      });
    };

    createGeoJsonLayer();

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
      }
    };
  }, [incidents, onIncidentClick]);

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h2 className="text-2xl font-bold mb-4">Map</h2>
      <div ref={mapRef} className="h-96 rounded" />
    </div>
  );
};
```

#### 2. Create Map Markers Component
**File**: `src/components/map/MapMarker.tsx` (new)
**Changes**: Custom marker with category-based styling

```tsx
import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import { HistoricalIncident } from '../../types/incident';

const categoryIcons = {
  political: 'bg-blue-500',
  religious: 'bg-green-500',
  cultural: 'bg-purple-500',
  scientific: 'bg-yellow-500',
  military: 'bg-red-500',
};

interface MapMarkerProps {
  incident: HistoricalIncident;
  onClick: (incident: HistoricalIncident) => void;
}

export const MapMarker: React.FC<MapMarkerProps> = ({ incident, onClick }) => {
  const iconStyle = {
    width: 20,
    height: 20,
    borderRadius: '50%',
    backgroundColor: categoryIcons[incident.category],
    border: '2px solid white',
    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
  };

  return (
    <Marker
      position={[incident.location.latitude, incident.location.longitude]}
      eventHandlers={{
        click: () => onClick(incident),
      }}
    >
      <Popup>
        <div className="p-2">
          <h3 className="font-bold">{incident.title}</h3>
          <p className="text-sm text-gray-600">{incident.startDate}</p>
          <p className="text-sm">{incident.location.name}</p>
        </div>
      </Popup>
    </Marker>
  );
};
```

#### 3. Update App Component to Include Map
**File**: `src/App.tsx` (modify)
**Changes**: Add map view alongside timeline

```tsx
import React, { useState } from 'react';
import { useIncidents } from './hooks/useIncidents';
import { IncidentCard } from './components/common/IncidentCard';
import { FilterBar } from './components/common/FilterBar';
import { TimelineView } from './components/timeline/TimelineView';
import { MapView } from './components/map/MapView';

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
  } = useIncidents();

  const [selectedIncident, setSelectedIncident] = useState<any>(null);

  const handleIncidentClick = (incident: any) => {
    setSelectedIncident(incident);
  };

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
            selectedDate={null}
            onDateChange={() => {}}
          />
          <MapView
            incidents={incidents}
            onIncidentClick={handleIncidentClick}
            timeRange={dateRange}
          />
        </div>

        <h2 className="text-xl font-bold mb-4">Incidents</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {incidents.map((incident) => (
            <IncidentCard
              key={incident.id}
              incident={incident}
              onClick={handleIncidentClick}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

export default App;
```

### Success Criteria:

#### Automated Verification:
- [ ] Map component renders without errors
- [ ] Leaflet library loads successfully
- [ ] Map tiles display correctly
- [ ] Time dimension control appears
- [ ] Build completes: `npm run build`

#### Manual Verification:
- [ ] Map displays with correct center (Middle East)
- [ ] Markers appear at correct geographic locations
- [ ] Clicking a marker opens a popup with incident info
- [ ] Time slider allows browsing through different time periods
- [ ] Play button animates markers through time
- [ ] Filters update map markers accordingly

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Graph Visualization

### Overview
Implement the graph visualization using React Flow to show connections between related historical events.

### Changes Required:

#### 1. Create Graph View Component
**File**: `src/components/graph/GraphView.tsx` (new)
**Changes**: React Flow graph showing incident connections

```tsx
import React, { useState, useCallback } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import { HistoricalIncident } from '../../types/incident';
import '@xyflow/react/dist/style.css';

interface GraphViewProps {
  incidents: HistoricalIncident[];
  selectedIncident: HistoricalIncident | null;
}

export const GraphView: React.FC<GraphViewProps> = ({
  incidents,
  selectedIncident,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node[]>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge[]>([]);

  React.useEffect(() => {
    if (incidents.length === 0) return;

    // Create nodes for all incidents
    const graphNodes: Node[] = incidents.map((incident) => ({
      id: incident.id,
      type: 'default',
      position: { x: 0, y: 0 }, // Let Dagre layout position them
      data: {
        label: incident.title,
        incident: incident,
      },
      style: {
        backgroundColor: getCategoryColor(incident.category),
        color: 'white',
        padding: '10px',
        borderRadius: '8px',
        width: '200px',
      },
    }));

    // Create edges for connections
    const graphEdges: Edge[] = [];
    incidents.forEach((incident) => {
      incident.connections.forEach((connectedId) => {
        graphEdges.push({
          id: `${incident.id}-${connectedId}`,
          source: incident.id,
          target: connectedId,
          animated: true,
          style: { stroke: '#666', strokeWidth: 2 },
        });
      });
    });

    setNodes(graphNodes);
    setEdges(graphEdges);
  }, [incidents, setNodes, setEdges]);

  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      political: '#3b82f6',
      religious: '#22c55e',
      cultural: '#a855f7',
      scientific: '#eab308',
      military: '#ef4444',
    };
    return colors[category] || '#6b7280';
  };

  const handleNodeClick = useCallback(
    (_, node) => {
      const incident = node.data.incident as HistoricalIncident;
      window.dispatchEvent(new CustomEvent('incident-selected', { detail: incident }));
    },
    []
  );

  return (
    <div className="bg-white rounded-lg shadow-md p-4 h-96">
      <h2 className="text-2xl font-bold mb-4">Event Connections</h2>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        fitView
      >
        <Controls />
        <MiniMap />
        <Background />
      </ReactFlow>
    </div>
  );
};
```

#### 2. Create Incident Detail Modal
**File**: `src/components/common/IncidentDetailModal.tsx` (new)
**Changes**: Modal showing full incident details and graph view

```tsx
import React, { useEffect } from 'react';
import { HistoricalIncident } from '../../types/incident';

interface IncidentDetailModalProps {
  incident: HistoricalIncident | null;
  onClose: () => void;
  relatedIncidents: HistoricalIncident[];
}

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

  const categoryColors = {
    political: 'bg-blue-100 text-blue-800',
    religious: 'bg-green-100 text-green-800',
    cultural: 'bg-purple-100 text-purple-800',
    scientific: 'bg-yellow-100 text-yellow-800',
    military: 'bg-red-100 text-red-800',
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
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

          <div className="flex gap-4 mb-4">
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

          <div className="grid grid-cols-2 gap-4 mb-6">
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
                {incident.location.latitude}, {incident.location.longitude}
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
                    className="p-3 bg-gray-50 rounded cursor-pointer hover:bg-gray-100"
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
```

#### 3. Update App Component to Include Graph
**File**: `src/App.tsx` (modify)
**Changes**: Add graph view and incident detail modal

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useIncidents } from './hooks/useIncidents';
import { IncidentCard } from './components/common/IncidentCard';
import { FilterBar } from './components/common/FilterBar';
import { TimelineView } from './components/timeline/TimelineView';
import { MapView } from './components/map/MapView';
import { GraphView } from './components/graph/GraphView';
import { IncidentDetailModal } from './components/common/IncidentDetailModal';

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
  } = useIncidents();

  const [selectedIncident, setSelectedIncident] = useState<any>(null);

  const getRelatedIncidents = useCallback(
    (incident: any) => {
      return incidents.filter((i) =>
        incident.connections.includes(i.id)
      );
    },
    [incidents]
  );

  const handleIncidentClick = useCallback((incident: any) => {
    setSelectedIncident(incident);
  }, []);

  useEffect(() => {
    const handleCustomEvent = (e: CustomEvent) => {
      setSelectedIncident(e.detail);
    };

    window.addEventListener('incident-selected', handleCustomEvent as any);
    return () => {
      window.removeEventListener('incident-selected', handleCustomEvent as any);
    };
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
            selectedDate={null}
            onDateChange={() => {}}
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
            selectedIncident={selectedIncident}
          />
        </div>

        <h2 className="text-xl font-bold mb-4">Incidents</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {incidents.map((incident) => (
            <IncidentCard
              key={incident.id}
              incident={incident}
              onClick={handleIncidentClick}
            />
          ))}
        </div>
      </main>

      {selectedIncident && (
        <IncidentDetailModal
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
          relatedIncidents={getRelatedIncidents(selectedIncident)}
        />
      )}
    </div>
  );
}

export default App;
```

### Success Criteria:

#### Automated Verification:
- [x] Graph component renders without errors
- [x] React Flow library loads successfully
- [x] Nodes and edges display correctly
- [x] Build completes: `npm run build`

#### Manual Verification:
- [ ] Graph shows nodes for all incidents
- [ ] Edges connect related incidents
- [ ] Clicking a node opens incident details
- [ ] Nodes can be dragged to reposition
- [ ] Zoom and pan work correctly
- [ ] MiniMap shows overview of graph

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Polish and Production

### Overview
Refine the UI/UX, optimize performance, add final touches, and prepare for production deployment.

### Changes Required:

#### 1. Add Responsive Design Improvements
**File**: `src/App.tsx` (modify)
**Changes**: Improve mobile responsiveness

```tsx
// Add responsive breakpoints and mobile-optimized layouts
// Ensure all views stack properly on mobile
// Add hamburger menu for navigation
```

#### 2. Performance Optimization
**File**: `src/hooks/useIncidents.ts` (modify)
**Changes**: Add memoization and lazy loading

```typescript
// Implement lazy loading for large datasets
// Add virtualization for long incident lists
// Optimize map marker rendering
```

#### 3. Add Loading States
**File**: `src/components/common/LoadingSpinner.tsx` (new)
**Changes**: Loading spinner component

```tsx
import React from 'react';

export const LoadingSpinner: React.FC = () => {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
    </div>
  );
};
```

#### 4. Create Production Build
**File**: `package.json` (modify)
**Changes**: Add build scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext ts,tsx"
  }
}
```

#### 5. Add README Documentation
**File**: `README.md` (update)
**Changes**: Add setup and deployment instructions

```markdown
## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Start development: `npm run dev`

## Building for Production

```bash
npm run build
```

## Deployment

The build output will be in the `dist/` directory. Deploy this to any static hosting service:
- Vercel: `vercel deploy`
- Netlify: `netlify deploy`
- GitHub Pages: Configure in `vite.config.ts`

## Adding New Incidents

Edit `src/data/incidents.json` and add new incident objects following the schema in `src/types/incident.ts`.
```

### Success Criteria:

#### Automated Verification:
- [ ] Production build completes without errors
- [ ] No TypeScript errors
- [ ] No linting errors
- [ ] Build size is reasonable (< 5MB)

#### Manual Verification:
- [ ] Application works on mobile devices
- [ ] All views are responsive
- [ ] Performance is acceptable with 100+ incidents
- [ ] No console errors
- [ ] All features work correctly

---

## Testing Strategy

### Unit Tests:
- Test incident data structure validation
- Test filter logic in `useIncidents` hook
- Test category color mapping

### Integration Tests:
- Test timeline rendering with sample data
- Test map rendering with sample data
- Test graph rendering with sample data

### Manual Testing Steps:
1. Navigate through timeline and verify events display correctly
2. Use map time slider to browse different time periods
3. Click on incidents and verify details modal opens
4. Test graph navigation between connected events
5. Test filters (category, region, date range)
6. Test responsive design on mobile devices

## Performance Considerations

- **Timeline**: vis-timeline handles thousands of items efficiently
- **Map**: Limit visible markers based on zoom level
- **Graph**: Use clustering for large datasets
- **Data**: Consider pagination or virtualization for 100+ incidents

## Migration Notes

This is a greenfield project with no migration required. All data will be stored in JSON files.

## References

- Research document: `thoughts/shared/research/2026-05-10-islamic-history-timeline-web-app.md`
- vis-timeline documentation: https://visjs.github.io/vis-timeline/
- Leaflet documentation: https://leafletjs.com/
- Leaflet.TimeDimension: https://github.com/socib/Leaflet.TimeDimension
- React Flow documentation: https://reactflow.dev/
