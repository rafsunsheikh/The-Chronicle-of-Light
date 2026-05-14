# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

**Islamic History Timeline Web App** - An interactive web application for exploring Islamic history through timeline and map visualizations.

### Project Goals

- Provide users with an interactive timeline to explore Islamic history
- Display historical incidents on an interactive map with time-based filtering
- Enable users to track incidents through time and space
- Create connections between related historical events for sequential learning

### Project Structure

```
islamic_history_timeline_web_app/
├── src/                          # Source code (to be created)
│   ├── components/               # React components
│   ├── hooks/                    # Custom React hooks
│   ├── lib/                      # Utility libraries and configurations
│   ├── data/                     # Islamic history data (JSON/SQLite)
│   └── styles/                   # Global styles
├── public/                       # Static assets
├── thoughts/                     # Research and documentation
│   └── shared/research/          # Research findings
├── .claude/                      # Claude Code configuration
├── package.json                  # Dependencies and scripts
└── README.md                     # Project documentation
```

### Recommended Technology Stack

Based on research findings, the following libraries are recommended for implementation:

#### Timeline Visualization
- **vis-timeline** - Primary timeline library (2.5k GitHub stars)
  - Interactive, customizable timelines
  - Supports React components
  - Drag & drop, selection, tooltips, animation

#### Map Visualization
- **Leaflet** - Lightweight map library (~42KB)
  - Mobile-friendly interactive maps
  - Extensive plugin ecosystem
  - GeoJSON support

#### Combined Timeline + Map
- **Leaflet.TimeDimension** - Time dimension plugin for Leaflet
  - Time slider, play/pause controls
  - GeoJSON layer support with time intervals

#### React Integration
- **react-leaflet** - React bindings for Leaflet
- **vis-timeline** - Standalone or via custom React wrapper

### Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

### Data Structure Recommendations

For storing Islamic history incidents, consider the following schema:

```typescript
interface HistoricalIncident {
  id: string;
  title: string;
  description: string;
  startDate: Date;
  endDate?: Date;
  location: {
    latitude: number;
    longitude: number;
    name: string;
  };
  category: string;
  connections: string[];  // Related incident IDs
  media?: Media[];
}

interface Media {
  type: 'image' | 'video' | 'document';
  url: string;
  caption?: string;
}
```

### Development Guidelines

1. **Component Structure**: Use React functional components with hooks
2. **State Management**: Consider using Context API or Zustand for global state
3. **Data Fetching**: Use React Query or SWR for data fetching
4. **Styling**: Use Tailwind CSS or styled-components
5. **TypeScript**: Strongly typed components and data structures

### TODO Annotations

We use a priority-based TODO annotation system:

- `TODO(0)`: Critical - never merge
- `TODO(1)`: High - architectural flaws, major bugs
- `TODO(2)`: Medium - minor bugs, missing features
- `TODO(3)`: Low - polish, tests, documentation
- `TODO(4)`: Questions/investigations needed
- `PERF`: Performance optimization opportunities

### Additional Resources

- Research document: `thoughts/shared/research/2026-05-10-islamic-history-timeline-web-app.md`
- vis-timeline docs: https://visjs.github.io/vis-timeline/
- Leaflet docs: https://leafletjs.com/
- Leaflet.TimeDimension: https://github.com/socib/Leaflet.TimeDimension
