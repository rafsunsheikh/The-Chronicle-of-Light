import React, { useEffect, useRef } from 'react';
import { Timeline, TimelineOptions } from 'vis-timeline/standalone';
import { HistoricalIncident } from '../../types/incident';
import './timeline.css';

interface TimelineViewProps {
  incidents: HistoricalIncident[];
  onIncidentClick: (incident: HistoricalIncident) => void;
  selectedEra?: string;
  onEraChange?: (era: string) => void;
  dateRange: { start: string; end: string } | null;
  onDateRangeChange?: (range: { start: string; end: string } | null) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  incidents,
  onIncidentClick,
  selectedEra,
  onEraChange,
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const timelineInstance = useRef<Timeline | null>(null);

  const eraMarkers = [
    { year: 'earlier', label: 'Earlier' },
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

  useEffect(() => {
    if (!timelineRef.current) return;

    // Convert incidents to timeline items
    const items = incidents.map(incident => ({
      id: incident.id,
      content: incident.title,
      start: incident.startDate,
      end: incident.endDate || undefined,
      group: incident.category,
      className: `incident-${incident.category}`,
    }));

    const options: TimelineOptions = {
      orientation: 'top',
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
      onMove: (item: any, callback: (item: any) => void) => {
        // Prevent item movement
        callback(item);
      },
      margin: {
        item: 20,
        axis: 10,
      },
      template: (item: any, element: HTMLElement, data: any) => {
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
    <div className="bg-gray-50 rounded-lg shadow-md overflow-hidden border border-gray-200">
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
            {eraMarkers.slice(1).map((era, index) => (
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
                {index < eraMarkers.length - 2 && (
                  <div className="w-px h-4 bg-gray-300" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
        {/* Active indicator */}
        {selectedEra && (
          <div className="absolute bottom-0 left-6 h-0.5 bg-slate-900 transition-all" />
        )}
      </div>

      {/* Horizontal Timeline Container */}
      <div className="overflow-x-auto overflow-y-hidden">
        <div ref={timelineRef} className="h-96 min-w-full" />
      </div>
    </div>
  );
};
