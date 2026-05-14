# Editorial-Style Timeline Redesign Implementation Plan

## Overview

This plan implements a museum-grade, editorial-style interactive timeline inspired by high-end digital exhibition design. The redesign transforms the current basic vis-timeline into an immersive storytelling interface with horizontal scrolling, elegant card-based event display, and full-page modal details.

## Current State Analysis

The existing timeline at `src/components/timeline/TimelineView.tsx` has:
- Basic vis-timeline with vertical orientation
- Simple clickable items with category-based left borders
- Standard selection event handling
- No horizontal scrolling
- No drag-and-drop (editable mode enabled but not needed)

**Key Files:**
- `src/components/timeline/TimelineView.tsx:11` - Main component
- `src/components/timeline/timeline.css:1` - Category styling
- `src/App.tsx:64` - Timeline integration point

## Desired End State

A fully immersive timeline experience with:
1. **Horizontal scrolling timeline** - Mouse wheel scrolls horizontally instead of vertically
2. **Clean top navigation bar** - Era markers (Earlier, 600, 700, etc.) with active state indicator
3. **Card-based event display** - Image-led storytelling with variable placement
4. **Full-page modal details** - Cross button, brief description, "Read More" button
5. **Minimalist aesthetic** - Aggressive whitespace, soft gray background, refined typography
6. **No drag-and-drop** - Read-only timeline interaction

### Verification Steps:
- [ ] Horizontal scroll works with mouse wheel
- [ ] Top timeline shows era markers with active red indicator
- [ ] Event cards display with images and minimal overlay text
- [ ] Clicking card opens full-page modal with cross button
- [ ] Modal shows brief description with "Read More" button
- [ ] Design matches editorial/museum aesthetic

## What We're NOT Doing

- No vertical scrolling timeline
- No drag-and-drop event repositioning
- No zoom controls or time range picker (separate component)
- No complex parallax or WebGL effects
- No mobile-specific timeline rework (focus on desktop first)
- No CMS integration (JSON data only)

## Implementation Approach

The implementation follows these phases:

1. **Foundation** - Basic horizontal timeline with era markers
2. **Visual Design** - Editorial styling and card layouts
3. **Modal System** - Full-page detail view
4. **Integration** - Connect with existing incident data
5. **Polish** - Transitions, accessibility, final touches

---

## Phase 1: Horizontal Timeline Foundation

### Overview
Set up the core horizontal scrolling timeline structure with era markers and disable edit mode.

### Changes Required:

#### 1. Update TimelineView Component Structure
**File**: `src/components/timeline/TimelineView.tsx`

**Changes**: 
- Add era marker navigation state
- Configure horizontal scrolling options
- Disable editable mode
- Add horizontal scroll container

```typescript
// Lines 6-9: Add new props
interface TimelineViewProps {
  incidents: HistoricalIncident[];
  onIncidentClick: (incident: HistoricalIncident) => void;
  selectedEra?: string;
  onEraChange?: (era: string) => void;
  dateRange: { start: string; end: string } | null;
  onDateRangeChange?: (range: { start: string; end: string } | null) => void;
}

// Lines 31-44: Updated options for horizontal scroll
const options: TimelineOptions = {
  orientation: 'top',
  axis: 'top',
  horizontalScroll: true,
  zoomMin: 1000 * 60 * 60 * 24 * 365, // Minimum 1 year zoom
  zoomMax: 1000 * 60 * 60 * 24 * 365 * 1400, // Maximum 1400 years zoom
  editable: {
    add: false,
    updateTime: false,
    remove: false,
  },
  selectable: true,
  showCurrentTime: false,
  dragTime: true,
  onMove: (item: any, callback: (item: any) => void) => {
    // Prevent item movement
    callback(item);
  },
  margin: {
    item: 20,
    axis: 10,
  },
};
```

#### 2. Add Horizontal Scroll Container
**File**: `src/components/timeline/TimelineView.tsx`

**Changes**: Wrap timeline in horizontal scroll container

```tsx
// Lines 67-71: Updated return
return (
  <div className="bg-gray-50 rounded-lg shadow-md overflow-hidden">
    {/* Era Navigation Bar */}
    <div className="border-b border-gray-200 bg-white">
      <div className="flex items-center px-6 py-3 overflow-x-auto">
        <div className="flex items-center space-x-8 min-w-max">
          <button
            onClick={() => onEraChange?.('earlier')}
            className={`text-sm font-medium transition-colors ${
              selectedEra === 'earlier'
                ? 'text-slate-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Earlier
          </button>
          {eraMarkers.map((era, index) => (
            <React.Fragment key={era.year}>
              <button
                onClick={() => onEraChange?.(era.year)}
                className={`text-sm font-medium transition-colors ${
                  selectedEra === era.year
                    ? 'text-slate-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {era.year}
              </button>
              {index < eraMarkers.length - 1 && (
                <div className="w-px h-4 bg-gray-300" />
              )}
            </React.Fragment>
          ))}
        </div>
        {/* Active indicator */}
        {selectedEra && (
          <div className="absolute bottom-0 left-6 h-0.5 bg-slate-900 transition-all" />
        )}
      </div>
    </div>

    {/* Horizontal Timeline Container */}
    <div className="overflow-x-auto overflow-y-hidden">
      <div ref={timelineRef} className="h-96 min-w-full" />
    </div>
  </div>
);
```

#### 3. Add Era Markers Configuration
**File**: `src/components/timeline/TimelineView.tsx`

**Changes**: Add era markers array

```typescript
// Add after line 16 (after refs)
const eraMarkers = [
  { year: '400', label: '400' },
  { year: '600', label: '600' },
  { year: '700', label: '700' },
  { year: '800', label: '800' },
  { year: '900', label: '900' },
  { year: '1000', label: '1000' },
  { year: '1100', label: '1100' },
  { year: '1200', label: '1200' },
  { year: '1300', label: '1300' },
  { year: '1400', label: '1400' },
  { year: '1500', label: '1500' },
  { year: '1600', label: '1600' },
  { year: '1700', label: '1700' },
  { year: '1800', label: '1800' },
  { year: '1900', label: '1900' },
  { year: '2000', label: '2000' },
];
```

#### 4. Add Horizontal Scroll CSS
**File**: `src/components/timeline/timeline.css`

**Changes**: Add horizontal scroll styling

```css
/* Lines 1-19: Existing category styling */
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

/* New: Horizontal scroll styling */
.overflow-x-auto::-webkit-scrollbar {
  height: 8px;
}

.overflow-x-auto::-webkit-scrollbar-track {
  background: #f1f5f9;
}

.overflow-x-auto::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}

.overflow-x-auto::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* Timeline item styling */
.vis-item {
  border-radius: 4px;
  font-size: 14px;
  padding: 8px 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.vis-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.vis-item.selected {
  border: 2px solid #000;
}

/* Era marker active state */
.vis-timeline .vis-axis {
  margin-top: 10px;
}

.vis-timeline .vis-line {
  border-color: #e2e8f0;
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Timeline renders without errors
- [ ] Horizontal scroll works with mouse wheel
- [ ] Era markers display correctly
- [ ] No drag-and-drop functionality
- [ ] Build completes: `npm run build`

#### Manual Verification:
- [ ] Mouse wheel scrolls horizontally
- [ ] Era markers show 400, 600, 700, etc.
- [ ] Active era has red underline indicator
- [ ] Timeline items are not draggable
- [ ] Clicking items still triggers selection

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Editorial Visual Design

### Overview
Apply the museum-grade editorial styling with soft grays, refined typography, card-based layouts with images, and a unified color scheme (no category-specific colors).

### Changes Required:

#### 1. Update Timeline Item Templates (with Image Support)
**File**: `src/components/timeline/TimelineView.tsx`

**Changes**: Add custom template function for timeline items with image support

```typescript
// Lines 31-44: Add template option to options
const options: TimelineOptions = {
  // ... existing options
  template: (item: any, element: HTMLElement, data: any) => {
    // Create custom card-style timeline item with image
    const imageUrl = (data as any).media?.[0]?.url || '/placeholder-image.jpg';
    element.innerHTML = `
      <div class="timeline-card">
        <img src="${imageUrl}" alt="${item.content}" class="timeline-card-image" />
        <div class="timeline-card-content">
          <div class="timeline-card-year">${item.start.split('-')[0]}</div>
          <div class="timeline-card-title">${item.content}</div>
          <div class="timeline-card-category">${item.group}</div>
        </div>
      </div>
    `;
  },
};
```

#### 2. Add Editorial Card Styling (Unified Color Scheme)
**File**: `src/components/timeline/timeline.css`

**Changes**: Add card-based styling with unified color scheme (no category colors)

```css
/* New: Editorial card styling - unified color scheme */
.timeline-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 0;
  min-width: 280px;
  max-width: 320px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
  overflow: hidden;
}

.timeline-card:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  transform: translateY(-4px);
}

/* Image container */
.timeline-card-image {
  height: 160px;
  width: 100%;
  object-fit: cover;
  background: #f1f5f9;
}

.timeline-card-content {
  padding: 16px;
}

.timeline-card-year {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  margin-bottom: 4px;
}

.timeline-card-title {
  font-size: 15px;
  font-weight: 500;
  color: #1e293b;
  margin-bottom: 8px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.timeline-card-category {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #94a3b8;
}

/* Unified border - no category colors */
.timeline-card {
  border-left: 3px solid #475569;
}
```

#### 3. Update Container Styling
**File**: `src/components/timeline/TimelineView.tsx`

**Changes**: Update main container for editorial look

```tsx
// Lines 67-71: Updated container
return (
  <div className="bg-gray-50 rounded-lg shadow-sm overflow-hidden border border-gray-200">
    {/* ... era navigation bar ... */}
    {/* ... timeline container ... */}
  </div>
);
```

#### 4. Add Typography Enhancements
**File**: `src/components/timeline/timeline.css`

**Changes**: Add refined typography

```css
/* New: Typography enhancements */
.vis-item {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.vis-label {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-weight: 500;
}

/* Era navigation typography */
.overflow-x-auto button {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Custom templates render correctly
- [ ] No CSS errors in browser console
- [ ] Build completes: `npm run build`

#### Manual Verification:
- [ ] Cards have soft shadows and rounded corners
- [ ] Typography is refined and readable
- [ ] Unified color scheme (no category colors)
- [ ] Image support works for timeline cards
- [ ] Hover effects work smoothly
- [ ] Overall design feels premium/editorial

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Full-Page Modal Details

### Overview
Create a full-page modal that opens when clicking a timeline item, featuring cross button, brief description, and "Read More" button that opens a separate extended view modal with full content.

### Changes Required:

#### 1. Update Modal Component
**File**: `src/components/common/IncidentDetailModal.tsx`

**Changes**: Transform to full-page modal with new design

```tsx
// Lines 1145-1156: Update interface
interface IncidentDetailModalProps {
  incident: HistoricalIncident | null;
  onClose: () => void;
  relatedIncidents: HistoricalIncident[];
}

// Lines 1182-1255: Updated modal design
return (
  <div className="fixed inset-0 bg-gray-50 flex items-center justify-center z-50">
    {/* Cross button at top right */}
    <button
      onClick={onClose}
      className="absolute top-8 right-8 text-gray-400 hover:text-gray-600 transition-colors"
      aria-label="Close modal"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-8 w-8"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    </button>

    {/* Content container */}
    <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
      <div className="p-8 md:p-12">
        {/* Title */}
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          {incident.title}
        </h2>

        {/* Metadata - unified color scheme */}
        <div className="flex flex-wrap gap-4 mb-6">
          <span className="px-4 py-2 bg-slate-100 rounded-full text-sm font-medium text-slate-700">
            {incident.category.charAt(0).toUpperCase() + incident.category.slice(1)}
          </span>
          {incident.dynasty && (
            <span className="px-4 py-2 bg-slate-100 rounded-full text-sm text-slate-700">
              {incident.dynasty}
            </span>
          )}
          {incident.region && (
            <span className="px-4 py-2 bg-slate-100 rounded-full text-sm text-slate-700">
              {incident.region}
            </span>
          )}
        </div>

        {/* Brief description (visible) */}
        <div className="mb-8">
          <p className="text-gray-700 text-lg leading-relaxed">
            {incident.description.substring(0, 200)}
            {incident.description.length > 200 ? '...' : ''}
          </p>
        </div>

        {/* Read More button - opens separate extended view */}
        <button
          onClick={() => {
            // TODO: Open separate extended view modal
            // This will show full description, media, and related events
            console.log('Open extended view for:', incident.id);
          }}
          className="bg-slate-700 hover:bg-slate-800 text-white font-medium py-3 px-8 rounded-lg transition-colors"
        >
          Read More
        </button>
      </div>
    </div>
  </div>
);
```

#### 2. Update App Component to Pass Modal Props
**File**: `src/App.tsx`

**Changes**: Pass new props to modal

```tsx
// Lines 99-105: Updated modal usage
{selectedIncident && (
  <IncidentDetailModal
    incident={selectedIncident}
    onClose={handleCloseModal}
    relatedIncidents={getRelatedIncidents(selectedIncident)}
  />
)}
```

#### 3. Add Modal Animation (Optional)
**File**: `src/components/common/IncidentDetailModal.tsx`

**Changes**: Add entrance/exit animation

```css
/* Add to modal component or globals.css */
@keyframes modal-entrance {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-content {
  animation: modal-entrance 0.3s ease-out;
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Modal component renders without errors
- [ ] Cross button closes modal
- [ ] Build completes: `npm run build`

#### Manual Verification:
- [ ] Modal opens on timeline item click
- [ ] Cross button at top right works
- [ ] Brief description shows (first 200 chars)
- [ ] "Read More" button is visible and styled
- [ ] Modal has proper backdrop and z-index

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 4.

---

## Phase 4: Integration with Incident Data

### Overview
Connect the enhanced timeline with existing incident data, ensuring proper date filtering and era mapping.

### Changes Required:

#### 1. Update useIncidents Hook
**File**: `src/hooks/useIncidents.ts`

**Changes**: Add era-based filtering

```typescript
// Lines 225-266: Add era filtering
export function useIncidents() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);
  const [selectedEra, setSelectedEra] = useState<string | null>(null);

  // ... existing code ...

  const filteredIncidents = useMemo(() => {
    return incidents.filter(incident => {
      if (selectedCategory && incident.category !== selectedCategory) return false;
      if (selectedRegion && incident.region !== selectedRegion) return false;
      if (dateRange) {
        if (incident.startDate < dateRange.start) return false;
        if (incident.endDate && incident.endDate > dateRange.end) return false;
      }
      if (selectedEra && selectedEra !== 'earlier') {
        const incidentYear = parseInt(incident.startDate.split('-')[0]);
        const eraYear = parseInt(selectedEra);
        if (Math.abs(incidentYear - eraYear) > 50) return false;
      }
      return true;
    });
  }, [incidents, selectedCategory, selectedRegion, dateRange, selectedEra]);

  // ... existing return ...
  return {
    // ... existing returns ...
    selectedEra,
    setSelectedEra,
  };
}
```

#### 2. Update App Component
**File**: `src/App.tsx`

**Changes**: Pass era state to TimelineView

```tsx
// Lines 52-61: Add era props
<TimelineView
  incidents={incidents}
  onIncidentClick={handleIncidentClick}
  selectedEra={selectedEra}
  onEraChange={setSelectedEra}
  dateRange={dateRange}
  onDateRangeChange={setDateRange}
/>
```

### Success Criteria:

#### Automated Verification:
- [ ] Era filtering works correctly
- [ ] Date range filtering still works
- [ ] Build completes: `npm run build`

#### Manual Verification:
- [ ] Clicking era markers filters timeline
- [ ] "Earlier" marker shows pre-400 events
- [ ] Date range filter works alongside era filter
- [ ] Timeline updates when era changes

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 5.

---

## Phase 5: Polish and Accessibility

### Overview
Add final touches including keyboard navigation, focus states, and accessibility improvements.

### Changes Required:

#### 1. Add Keyboard Navigation
**File**: `src/components/timeline/TimelineView.tsx`

**Changes**: Add keyboard support for era navigation

```typescript
// Add keyboard handler
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      // Scroll timeline left
      timelineRef.current?.scrollBy({ left: -200, behavior: 'smooth' });
    } else if (e.key === 'ArrowRight') {
      // Scroll timeline right
      timelineRef.current?.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, []);
```

#### 2. Add Focus States
**File**: `src/components/timeline/timeline.css`

**Changes**: Add accessible focus styles

```css
/* New: Focus states - unified slate color */
.overflow-x-auto button:focus {
  outline: 2px solid #1e293b;
  outline-offset: 2px;
}

.timeline-card:focus {
  outline: 2px solid #1e293b;
  outline-offset: 2px;
}

/* Modal focus trap */
.incident-detail-modal:focus {
  outline: none;
}
```

#### 3. Add ARIA Labels
**File**: `src/components/timeline/TimelineView.tsx`

**Changes**: Add accessibility labels

```tsx
// Add to era navigation
<div
  role="navigation"
  aria-label="Era navigation"
  className="border-b border-gray-200 bg-white"
>
  {/* ... */}
</div>

// Add to timeline container
<div
  ref={timelineRef}
  className="h-96 min-w-full"
  role="region"
  aria-label="Historical timeline"
/>
```

### Success Criteria:

#### Automated Verification:
- [ ] Keyboard navigation works (Arrow keys)
- [ ] Focus states are visible
- [ ] ARIA labels present
- [ ] Build completes: `npm run build`

#### Manual Verification:
- [ ] Tab navigation works through era markers
- [ ] Arrow keys scroll timeline
- [ ] Focus states are visible and accessible
- [ ] Screen reader announces era names
- [ ] Modal is focus-trapped when open

---

## Testing Strategy

### Unit Tests:
- Test era marker click handlers
- Test timeline item selection
- Test modal open/close functionality
- Test date range filtering

### Integration Tests:
- Test horizontal scroll with mouse wheel
- Test era filtering combined with category filtering
- Test modal opens with correct incident data
- Test keyboard navigation

### Manual Testing Steps:
1. Navigate through timeline using mouse wheel
2. Click era markers and verify filtering
3. Click timeline items and verify modal opens
4. Test cross button closes modal
5. Test keyboard navigation (Tab, Arrow keys)
6. Test with screen reader if available
7. Verify design matches editorial aesthetic

## Performance Considerations

- **Timeline Rendering**: vis-timeline handles thousands of items efficiently
- **Horizontal Scroll**: Use CSS `overflow-x-auto` for native scroll performance
- **Modal**: Lazy render modal only when incident is selected
- **Images**: Implement lazy loading for incident media if added later

## Migration Notes

This is an enhancement to existing timeline, not a replacement. The data structure remains the same. Existing incidents will work without modification.

## References

- Research document: `thoughts/shared/research/2026-05-10-islamic-history-timeline-web-app.md`
- vis-timeline documentation: https://visjs.github.io/vis-timeline/
- Screenshot reference: `references/Screenshot 2026-05-14 at 4.36.41 pm.png`
- Screenshot reference: `references/Screenshot 2026-05-14 at 4.36.04 pm.png`
