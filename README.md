# Islamic History Timeline Web App

An interactive web application for exploring Islamic history through timeline and map visualizations.

## Features

- **Interactive Timeline**: Navigate through Islamic history chronologically
- **Interactive Map**: View historical incidents on a map with time-based filtering
- **Incident Connections**: Explore connections between related historical events
- **Sequential Learning**: Learn about incidents one by one through connected pathways

## Technology Stack

### Timeline Visualization
- **vis-timeline** - Interactive timeline library with drag & drop, selection, and animation support

### Map Visualization
- **Leaflet** - Lightweight, mobile-friendly interactive maps
- **Leaflet.TimeDimension** - Time dimension plugin for temporal map visualization

### Framework
- **React** - Component-based UI framework
- **TypeScript** - Type-safe development

## Project Structure

```
islamic_history_timeline_web_app/
├── src/                          # Source code
│   ├── components/               # React components
│   ├── hooks/                    # Custom hooks
│   ├── lib/                      # Utilities and configurations
│   ├── data/                     # Historical data
│   └── styles/                   # Global styles
├── public/                       # Static assets
├── thoughts/                     # Research and documentation
│   └── shared/research/          # Research findings
└── package.json                  # Dependencies
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd islamic_history_timeline_web_app

# Install dependencies
npm install

# Start development server
npm run dev
```

## Development

### Running Tests

```bash
npm test
```

### Building for Production

```bash
npm run build
```

## Data Format

Historical incidents should follow this schema:

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
  connections: string[];
  media?: Media[];
}
```

## Research Documentation

For detailed research on timeline and map libraries, see:
- `thoughts/shared/research/2026-05-10-islamic-history-timeline-web-app.md`

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests
4. Submit a pull request

## License

[To be determined]
