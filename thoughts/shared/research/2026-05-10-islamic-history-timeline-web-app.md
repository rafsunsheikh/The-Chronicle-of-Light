---
date: 2026-05-10T16:30:00+00:00
researcher: mdrafsunsheikh
git_commit: N/A (not a git repository)
branch: N/A
repository: islamic_history_timeline_web_app
topic: "Islamic History Timeline Web Application - Interactive Timeline and Map Visualization"
tags: [research, codebase, timeline, map, web-application, islamic-history]
status: complete
last_updated: 2026-05-10
last_updated_by: mdrafsunsheikh
---

# Research: Islamic History Timeline Web Application - Interactive Timeline and Map Visualization

**Date**: 2026-05-10T16:30:00+00:00
**Researcher**: mdrafsunsheikh
**Git Commit**: N/A (not a git repository)
**Branch**: N/A
**Repository**: islamic_history_timeline_web_app

## Research Question

Create a web application that will be an interactive application for Islamic history knowledge with:
- Timeline interaction capability
- Map capability
- Users can navigate to specific timelines to learn about the Islamic world around the world
- Users can track incidents throughout the progression of time and space
- Connections between incidents that users can learn sequentially

## Summary

This research documents the current state of the Islamic History Timeline Web App repository and identifies web libraries and frameworks suitable for building the requested interactive timeline and map visualization application.

**Repository State**: The repository at `/Users/mdrafsunsheikh/Projects/islamic_history_timeline_web_app` is currently empty except for configuration files. No source code, data, or documentation for the Islamic History project exists yet.

**Key Libraries Identified**:
- **Timeline**: vis-timeline (2.5k GitHub stars), FullCalendar Resource Timeline, react-timeline-eco
- **Map**: Leaflet (42KB, lightweight), Mapbox GL JS, Deck.gl (GPU-powered)
- **Combined Timeline+Map**: Leaflet.TimeDimension (primary plugin for time-based map visualization)

## Current Repository Structure

```
/Users/mdrafsunsheikh/Projects/islamic_history_timeline_web_app/
├── .claude/
│   ├── settings.json          # Project-level Claude settings with MCP permissions
│   ├── settings.local.json    # Local settings with web fetch permissions
│   ├── agents/                # Custom agent definitions
│   │   ├── codebase-locator.md
│   │   ├── codebase-analyzer.md
│   │   ├── codebase-pattern-finder.md
│   │   ├── thoughts-locator.md
│   │   ├── thoughts-analyzer.md
│   │   └── web-search-researcher.md
│   └── commands/              # Slash command definitions
│       ├── research_codebase.md
│       ├── create_plan.md
│       ├── implement_plan.md
│       └── (30+ additional commands)
├── CLAUDE.md                  # Project guidance file (currently HumanLayer template)
└── thoughts/                  # Research documentation directory
    └── shared/research/       # Research findings (created for this project)
```

### Configuration Files

#### `.claude/settings.json`
Contains project-level Claude configuration:
- MCP server permissions for `./hack/spec_metadata.sh`
- `enableAllProjectMcpServers: false`
- Environment variable `MAX_THINKING_TOKENS: "32000"`

#### `.claude/settings.local.json`
Contains web fetch permissions for research:
- `WebSearch` - General web search capability
- `WebFetch(domain:visjs.github.io)` - vis-timeline documentation
- `WebFetch(domain:github.com)` - GitHub repositories
- `WebFetch(domain:leafletjs.com)` - Leaflet documentation
- `WebFetch(domain:mapbox.com)` - Mapbox documentation
- `WebFetch(domain:react-timeline.cruft.io)` - React timeline examples
- `WebFetch(domain:fullcalendar.io)` - FullCalendar documentation
- `WebFetch(domain:react-timeline-eco.netlify.app)` - react-timeline-eco demo
- `WebFetch(domain:kepler.gl)` - Kepler.gl visualization
- `WebFetch(domain:deck.gl)` - Deck.gl documentation

#### `CLAUDE.md`
Currently contains a template from the HumanLayer project (not specific to Islamic History Timeline). The file describes:
- HumanLayer SDK & Platform components
- Local Tools Suite components
- Development commands and conventions
- TODO annotation system

## Timeline Visualization Libraries

### vis-timeline
**Source**: [visjs/vis-timeline GitHub](https://github.com/visjs/vis-timeline) | [Documentation](https://visjs.github.io/vis-timeline/)

**Purpose**: Create fully customizable, interactive timelines and 2D-graphs with items and ranges.

**Key Features**:
- Automatic time scale adjustment from milliseconds to years
- Items can be created, edited, and deleted
- Resource grouping support
- Supports React 15/16 components in templates
- Extensive interaction: drag & drop, selection, tooltips, animation
- Customizable styling with templates

**GitHub Statistics**:
- Stars: 2.5k
- Forks: 369
- Commits: 4,176
- Languages: JavaScript 93.6%
- License: Apache-2.0 OR MIT

**Installation**:
```bash
npm install vis-timeline
```

**Examples**: [Timeline Examples](https://visjs.github.io/vis-timeline/examples/timeline/)

---

### react-timeline-eco
**Source**: [react-timeline-eco GitHub](https://github.com/ecojs/react-timeline-eco) | [Demo](https://react-timeline-eco.netlify.app/)

**Purpose**: React-based timeline component for visualizing time-based data.

**Key Features**:
- React hooks-based implementation
- Zoomable and scrollable timeline
- Multiple track support
- Event and resource visualization

---

### FullCalendar Resource Timeline View
**Source**: [FullCalendar Documentation](https://fullcalendar.io/docs/timeline) | [GitHub](https://github.com/fullcalendar/fullcalendar)

**Purpose**: Premium calendar library with resource timeline views for scheduling and timeline visualization.

**Key Features**:
- Views: timelineDay, timelineWeek, timelineMonth, timelineYear
- Resource grouping with `resourceGroupField`
- Customizable `resourceAreaWidth` and `slotMinWidth`
- Stacking configuration for overlapping events
- Custom duration support: `duration: { days: 4 }`
- Resource area header render hooks
- Expand rows to fill available height

**Installation**:
```bash
npm install @fullcalendar/core @fullcalendar/resource @fullcalendar/resource-timeline
```

**Setup Example**:
```javascript
import { Calendar } from '@fullcalendar/core';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';

let calendar = new Calendar(calendarEl, {
  initialView: 'resourceTimeline',
  resources: [{id: '1', title: 'Resource 1'}],
  events: [...]
});
```

---

### TimelineJS (KnightLab)
**Source**: [KnightLab TimelineJS](https://timeline.knightlab.com/) | [GitHub](https://github.com/NUKnightLab/timeline)

**Purpose**: Interactive, linear timeline that displays data from a spreadsheet.

**Key Features**:
- Spreadsheet-based data input
- Linear timeline visualization
- Supports images, text, multimedia
- Educational use cases

## Map Visualization Libraries

### Leaflet
**Source**: [Leaflet Website](https://leafletjs.com/) | [Documentation](https://leafletjs.com/reference.html) | [GitHub](https://github.com/Leaflet/Leaflet)

**Purpose**: Open-source JavaScript library for mobile-friendly interactive maps.

**Key Features**:
- Size: ~42KB of JavaScript
- No external dependencies
- Layers: Tiles, vector shapes, markers, popups, GeoJSON
- Interaction: Drag panning with inertia, wheel zoom, mobile pinch-zoom
- Visual: Smooth animations, retina support, pure CSS styling
- Controls: Zoom, attribution, layers, scale
- Performance: Hardware acceleration

**Installation**:
```html
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
```

**Setup Example**:
```javascript
var map = L.map('map').setView([51.505, -0.09], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
```

---

### Mapbox GL JS
**Source**: [Mapbox Website](https://mapbox.com/)

**Purpose**: Immersive maps for web with customizable visual elements.

**Key Features**:
- 3D terrain and building visualization
- Traffic and movement data visualization
- Customizable layers and styles
- Movement Data for population patterns through space and time
- Traffic Data for temporal analysis

---

### Deck.gl
**Source**: [Deck.gl Website](https://deck.gl/)

**Purpose**: GPU-powered, highly performant large-scale data visualization library.

**Key Features**:
- Large-scale data visualization
- Base map integration
- Animation layer support for temporal data
- Time range animation capabilities

## Libraries Combining Timeline + Map Functionality

### Leaflet.TimeDimension
**Source**: [GitHub](https://github.com/socib/Leaflet.TimeDimension) | [Examples](https://apps.socib.es/Leaflet.TimeDimension/examples/)

**Purpose**: Add time dimension capabilities to Leaflet maps.

**Key Features**:
- Time slider, speed slider, play/pause controls
- Layer types: `L.TimeDimension.Layer.WMS`, `L.TimeDimension.Layer.GeoJSON`
- Update modes: intersect, union, replace, extremes
- Time interval configuration with ISO8601 format

**Installation**:
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet-timedimension@1.1.1/dist/leaflet.timedimension.control.min.css" />
<script src="https://cdn.jsdelivr.net/npm/leaflet-timedimension@1.1.1/dist/leaflet.timedimension.min.js"></script>
```

**Setup Example**:
```javascript
var map = L.map('map', {
    zoom: 10,
    center: [38.705, 1.15],
    timeDimension: true,
    timeDimensionOptions: {
        timeInterval: "2014-09-30/2014-10-30",
        period: "PT1H"
    },
    timeDimensionControl: true,
});
```

---

### Leaflet.timeline
**Source**: [GitHub](https://github.com/jonskeate/Leaflet.timeline) | [Examples](https://skeate.dev/Leaflet.timeline/examples/earthquakes.html)

**Purpose**: Display arbitrary GeoJSON on a map with a timeline slider and play button.

---

### Leaflet Timeline Control
**Source**: [Demo](https://codesandbox.io/s/leaflet-timeline-control-ibyby)

**Purpose**: Unopinionated timeline control for displaying time series data on maps.

---

## Additional Leaflet Time-Related Plugins

| Plugin | Purpose | Source |
|--------|---------|---------|
| **leaflet-calendar** | Calendar picker with date selection triggers | [GitHub](https://github.com/antoniovlx/leaflet-calendar) |
| **Leaflet Hex Time Slider** | Minimalistic time slider using leaflet + d3.js + nouislider | [Demo](https://albertkun.github.io/leaflet_hex_timeslider/) |
| **leaflet.timelineSlider** | Customizable timeline slider with user-defined functionality | [Demo](https://svitkin.github.io/leaflet-timeline-slider/) |
| **Leaflet Time-Slider** | Dynamic marker add/remove via jQuery UI slider | [Demo](https://dwilhelm89.github.io/LeafletSlider/) |
| **LeafletPlayback** | Playback of time-stamped GPS tracks synchronized to clock | [Demo](http://virtualfence.theoutpost.io/) |
| **leaflet.TrackPlayBack** | Display and dynamically play tracks | [Demo](https://linghuam.github.io/Leaflet.TrackPlayBack/) |
| **leaflet-temporal-geojson** | Flexible animation of GeoJSON features | [GitHub](https://github.com/danwild/leaflet-temporal-geojson) |

---

## Overlay Animation Plugins for Maps

| Plugin | Purpose | Source |
|--------|---------|---------|
| **Leaflet.AnimatedMarker** | Animate marker along polyline | [GitHub](https://github.com/aogle/Leaflet.AnimatedMarker) |
| **Leaflet.MarkerPlayer** | Animate marker along polyline with get/set progress | [GitHub](https://github.com/0n3byt3/Leaflet.MarkerPlayer) |
| **Leaflet.MovingMarker** | Move markers along polyline with custom durations | [GitHub](https://github.com/Ewoken/Leaflet.MovingMarker) |
| **leaflet.motion** | Simple motion on polylines with marker | [GitHub](https://github.com/ivogabe/leaflet-motion) |
| **Leaflet.TrackPlayer** | Trajectory playback with auto-rotation | [GitHub](https://github.com/wj00370/Leaflet.TrackPlayer) |
| **leaflet-point-animator** | Animate large numbers of GeoJSON points | [GitHub](https://github.com/danwild/leaflet-point-animator) |
| **Leaflet.MarkerMotion** | Smooth marker animation along predefined paths | [GitHub](https://github.com/AlejandroRM-DEV/Leaflet.MarkerMotion) |

---

## Popular React-Based Solutions

### react-leaflet
**Source**: [react-leaflet GitHub](https://github.com/react-leaflet/react-leaflet)

**Purpose**: React bindings for Leaflet maps.

**Features**:
- Full Leaflet API available as React components
- Integrates with Leaflet.TimeDimension plugin
- Declarative map component structure

### FullCalendar with React
**Source**: [FullCalendar React Docs](https://fullcalendar.io/docs/react)

**Purpose**: React integration for FullCalendar's timeline views.

**Features**:
- React component wrapper
- Resource timeline view support
- Event handlers as React props

---

## Integration Examples

### Timeline + Map with Leaflet

```javascript
// Initialize map with time dimension
var map = L.map('map', {
    zoom: 10,
    center: [51.505, -0.09],
    timeDimension: true,
    timeDimensionOptions: {
        timeInterval: "2014-09-30/2014-10-30",
        period: "PT1H"
    },
    timeDimensionControl: true,
});

// Add GeoJSON layer with time
var geojsonLayer = L.timeDimension.layer.geoJSON(yourGeojsonData, {
    pointToLayer: function (feature, latlng) {
        return L.marker(latlng);
    }
}).addTo(map);
```

### React Timeline with vis-timeline

```javascript
import { Timeline } from 'vis-timeline';
import 'vis-timeline/styles/vis-timeline-graph2d.min.css';

function TimelineComponent({ events }) {
    const timelineRef = useRef(null);
    
    useEffect(() => {
        const timeline = new Timeline(
            timelineRef.current,
            events,
            { stack: true }
        );
    }, [events]);
    
    return <div ref={timelineRef}></div>;
}
```

---

## Additional Resources

### Timeline Libraries
- [vis-timeline Documentation](https://visjs.github.io/vis-timeline/docs/timeline/) - Comprehensive API reference with examples
- [FullCalendar Resource Timeline](https://fullcalendar.io/docs/resource-timeline-view) - Premium scheduling with timeline views
- [react-timeline-eco Demo](https://react-timeline-eco.netlify.app/) - React timeline component examples

### Map Libraries
- [Leaflet Plugins Page](https://leafletjs.com/plugins.html) - Complete list of Leaflet plugins including time dimension
- [Leaflet.TimeDimension Examples](https://apps.socib.es/Leaflet.TimeDimension/examples/) - Working demos of time-based map visualization
- [Mapbox Movement Data](https://mapbox.com/movement) - Population patterns through space and time

### Combined Solutions
- [Leaflet timeline Examples](https://skeate.dev/Leaflet.timeline/examples/earthquakes.html) - Earthquake visualization with timeline
- [leaflet.calendar Demo](https://antoniovlx.github.io/leaflet-calendar/examples/index.html) - Calendar picker integration

---

## Related Research
None yet - this is the initial research document for this project.

## Follow-up Research: Graph Visualization Libraries (2026-05-10)

### React Graph Visualization Libraries

#### 1. React Flow
**Source**: [https://reactflow.dev](https://reactflow.dev) | **GitHub**: [https://github.com/xyflow/xyflow](https://github.com/xyflow/xyflow)

**Purpose**: Node-based editor with interactive diagrams for React.

**Key Features**:
- Built-in: dragging, zooming, panning, multi-node selection, keyboard navigation
- Customizable nodes, handles, edges, and edge labels
- Built-in components: Background, Minimap, Controls, Panel, NodeToolbar
- Supports Dagre/Elkjs layouts for automatic graph positioning
- Full React component integration for nodes

**Installation**:
```bash
npm install @xyflow/react
```

**React Integration**: Nodes are React components
```jsx
import { Background, Controls, MiniMap } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

function App() {
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);
  
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={setNodesChange}
      onEdgesChange={setEdgesChange}
    >
      <Background />
      <Controls />
      <MiniMap />
    </ReactFlow>
  );
}
```

**Customization**:
- Full styling via Tailwind or plain CSS
- Theming support
- Custom node/edge rendering with React components
- Minimap for large graphs, controls for zoom/pan

**Performance**:
- 36.5K GitHub stars, 7.40M weekly NPM installs
- Handles medium to large node/edge sets effectively
- Performance optimization covered in advanced concepts

**Examples & Documentation**:
- Quick Start: [https://reactflow.dev/learn](https://reactflow.dev/learn)
- API Reference: [https://reactflow.dev/api-reference](https://reactflow.dev/api-reference)
- Examples: [https://reactflow.dev/examples](https://reactflow.dev/examples)
- Playground: [https://play.reactflow.dev](https://play.reactflow.dev)

---

#### 2. React Force Graph
**Source**: [https://github.com/vasturiano/react-force-graph](https://github.com/vasturiano/react-force-graph)

**Purpose**: Force-directed graphs with 2D, 3D, VR, and AR support.

**Key Features**:
- Force-directed iterative layout using d3-force-3d physics engine
- 4 packages: `react-force-graph-2d`, `react-force-graph-3d`, `react-force-graph-vr`, `react-force-graph-ar`
- Canvas/WebGL rendering for performance
- Zooming, panning, node dragging, hover/click interactions

**Installation**:
```bash
npm install react-force-graph-3d
```

**React Integration**:
```jsx
import ForceGraph3D from 'react-force-graph-3d';

<ForceGraph3D
  graphData={graphData}
  nodeLabel="name"
  linkColor={() => 'blue'}
/>
```

**Customization**:
- `nodeCanvasObject` (2D) or `nodeThreeObject` (3D) for custom rendering
- `linkCurvature`, `linkDirectionalArrowLength`, `linkDirectionalParticles`
- Node sizing via `nodeVal` or `nodeRelSize`

**Performance**:
- WebGL/Canvas rendering for optimized performance
- `enablePointerInteraction` can be disabled for maximum performance
- Supports large graph visualizations (demos available)

**Examples**:
- Large graph demo: [https://vasturiano.github.io/react-force-graph/example/large-graph/](https://vasturiano.github.io/react-force-graph/example/large-graph/)
- Basic demo: [https://vasturiano.github.io/react-force-graph/example/](https://vasturiano.github.io/react-force-graph/example/)

---

#### 3. Cytoscape.js with React
**Source**: [https://js.cytoscape.org](https://js.cytoscape.org) | **GitHub**: [https://github.com/cytoscape/cytoscape.js](https://github.com/cytoscape/cytoscape.js)

**Purpose**: Graph theory library with advanced analysis features.

**Key Features**:
- Fully featured graph library in pure JavaScript
- No external dependencies
- Directed, undirected, and compound graph models
- Built-in gestures: pinch-to-zoom, box selection, panning
- Graph querying with selectors

**React Integration**: Use wrapper `react-cytoscapejs`
```bash
npm install cytoscape react-cytoscapejs
```

**Customization**:
- Stylesheets separate presentation from data
- Selectors for terse filtering and graph querying
- Supports custom node and edge rendering

**Performance**:
- Highly optimized for large graphs
- `hideEdgesOnViewport` for responsive panning/zooming

---

#### 4. Vis.js Network
**Source**: [https://visjs.github.io/vis-network/](https://visjs.github.io/vis-network/) | **GitHub**: [https://github.com/visjs/vis-network](https://github.com/visjs/vis-network)

**Purpose**: Network graph visualization with nodes and edges.

**Key Features**:
- Custom shapes, styles, colors, sizes, images
- Clustering support for large datasets
- Import from Gephi and DOT language
- Smooth performance on modern browsers

**React Integration**: Use wrapper `react-vis-network` or `react-graph-vis`

**Performance**:
- Works smoothly for up to a few thousand nodes and edges
- Clustering support for larger datasets

---

#### 5. D3.js with React
**Source**: [https://d3js.org](https://d3js.org) | **GitHub**: [https://github.com/d3/d3](https://github.com/d3/d3)

**Purpose**: The most flexible and powerful graph visualization library.

**Key Features**:
- Force-directed graph layouts via d3-force
- Highly flexible and customizable
- No opinionated structure - build exactly what you need

**React Integration**: Use with `useRef` hooks and lifecycle methods

**Examples**:
- Force-directed graph: [https://observablehq.com/@d3/force-directed-graph](https://observablehq.com/@d3/force-directed-graph)

---

### Comparison Summary

| Library | Best For | License | Performance | Learning Curve |
|---------|----------|---------|-------------|----------------|
| **React Flow** | Interactive node editors, relationship mapping | MIT | Good for medium graphs | Low |
| **React Force Graph** | 3D/2D force-directed relationships | MIT | Excellent with WebGL | Medium |
| **Cytoscape.js** | Graph analysis, complex relationships | MIT | Excellent for large graphs | Medium |
| **Vis.js Network** | Simple network graphs, clustering | Apache 2.0 | Good (few thousand nodes) | Low |
| **D3.js + React** | Maximum customization | ISC | Variable | High |

### Recommendation for Islamic History App

**Primary Choice: React Flow**
- Most popular with excellent community support
- Best React integration (nodes are React components)
- Supports automatic layouts (Dagre/Elkjs)
- Easy to style and customize
- Good for showing incident connections

**Alternative: React Force Graph**
- Better for large datasets
- 3D visualization option
- Force-directed layout shows natural relationships
- WebGL performance for many nodes

---

## Follow-up Research: Islamic History Data Sources (2026-05-10)

### Data Source Options

#### 1. Manual Data Collection (Recommended for Start)

**Approach**: Create JSON data files sourced from reputable academic references.

**Advantages**:
- Full control over data structure
- No API dependencies or rate limits
- Can start small and expand incrementally
- Best for read-only applications

**Sources to Reference**:
- **Encyclopedia of Islam** (Brill) - Comprehensive academic reference
- **Oxford Islamic Studies Online** - Academic articles
- **World History Encyclopedia** - Free online resource
- **University digital collections** - Digital humanities projects
- **Museum collections** - British Museum, Metropolitan Museum of Art Islamic collections

**Data Collection Template**:
```json
{
  "id": "unique-identifier",
  "title": "Event Title",
  "description": "Detailed description of the event",
  "startDate": "2026-05-10",
  "endDate": "2026-05-10",
  "location": {
    "latitude": 33.8869,
    "longitude": 35.5119,
    "name": "Jerusalem"
  },
  "category": "religious|political|cultural|scientific|military",
  "connections": ["related-event-id-1", "related-event-id-2"],
  "learningPath": "path-name",
  "media": [
    {
      "type": "image",
      "url": "/images/event.jpg",
      "caption": "Image description"
    }
  ]
}
```

---

#### 2. Academic Databases to Explore

**Encyclopedia of Islam (Brill)**:
- URL: [https://referenceworks.brillonline.com/browse/encyclopaedia-of-islam](https://referenceworks.brillonline.com/browse/encyclopaedia-of-islam)
- Coverage: Islamic history from 622 CE to present
- Access: Subscription required (university libraries often have access)

**Oxford Islamic Studies Online**:
- URL: [https://www.oxfordislamicstudies.com/](https://www.oxfordislamicstudies.com/)
- Coverage: Islamic civilization from 6th century to present
- Access: Subscription required

**Cambridge History of Islam**:
- URL: [https://www.cambridge.org/core/series/cambridge-history-of-islam](https://www.cambridge.org/core/series/cambridge-history-of-islam)
- Coverage: Comprehensive Islamic history
- Access: Subscription required

**World History Encyclopedia**:
- URL: [https://www.worldhistory.org/](https://www.worldhistory.org/)
- Coverage: World history including Islamic civilizations
- Access: Free, open content

---

#### 3. Digital Humanities Projects

**Digital Islamic History**:
- Research digital humanities projects focused on Islamic history
- Check conferences and publications for timeline projects
- Look for TEI-encoded historical texts

**University Digital Collections**:
- Harvard Library Digital Collections
- Princeton University Library Islamic manuscripts
- University of Chicago Oriental Institute
- SOAS University of London Special Collections

---

#### 4. Potential Dataset Sources

**Kaggle**:
- Search for historical datasets that may include Islamic history events
- Example: [https://www.kaggle.com/datasets](https://www.kaggle.com/datasets)
- Note: May need filtering and verification

**GitHub**:
- Search for open historical data projects
- Example: [https://github.com/search?q=islamic+history+dataset](https://github.com/search?q=islamic+history+dataset)
- Look for CSV/JSON data files

**Data.gov**:
- Government open data portals
- May contain historical/geographic data

---

### Recommended Data Strategy

**Phase 1: Core Dataset (Start Here)**
- Create initial JSON file with 50-100 key events
- Focus on major political, religious, and cultural events
- Include geographic coordinates for map visualization
- Define connection relationships between events

**Phase 2: Expand Coverage**
- Add events from different periods (7th-21st century)
- Include diverse geographic regions (Middle East, North Africa, Europe, Asia)
- Add categories: battles, caliphs, scientific achievements, architectural works

**Phase 3: Enrich Content**
- Add media (images, documents)
- Include multiple languages
- Add scholarly references and citations
- Create learning paths for sequential exploration

---

## Final Technology Stack Recommendation

### Core Stack
```
Frontend Framework: React + TypeScript
Build Tool: Vite
Styling: Tailwind CSS
State Management: Zustand

Timeline: vis-timeline
Map: Leaflet + Leaflet.TimeDimension
Graph Visualization: React Flow
```

### Data Format
```
Primary: JSON files (read-only)
Optional: SQLite for complex queries
Optional: JSON Server for local development API
```

### Directory Structure
```
src/
├── components/
│   ├── timeline/
│   │   ├── TimelineView.tsx
│   │   └── TimelineEvent.tsx
│   ├── map/
│   │   ├── MapView.tsx
│   │   └── MapMarker.tsx
│   ├── graph/
│   │   ├── GraphView.tsx
│   │   └── GraphNode.tsx
│   └── common/
│       ├── IncidentCard.tsx
│       └── LearningPath.tsx
├── hooks/
│   ├── useIncidents.ts
│   ├── useTimeline.ts
│   └── useGraph.ts
├── lib/
│   ├── leaflet.ts
│   └── utils.ts
├── data/
│   └── incidents.json
└── styles/
    └── globals.css
```

---

## Open Questions for Implementation

1. **Data Volume**: How many historical incidents should the initial dataset contain?
2. **Time Range**: Should we start with a specific period (e.g., 622-1258 CE) or cover the full 400 CE to present range?
3. **Geographic Scope**: Which regions should be prioritized? (Middle East, North Africa, Andalusia, Central Asia, South Asia, etc.)
4. **Categories**: What event categories are most important? (political, religious, military, cultural, scientific, architectural)
5. **Learning Paths**: What types of sequential learning paths would be most valuable? (chronological, thematic, geographic, dynastic)
6. **Media**: What types of media should be supported? (images, maps, documents, videos)
7. **Search**: Should the app include search functionality across incidents?
8. **Filtering**: What filtering options are needed? (by date, category, region, dynasty)

