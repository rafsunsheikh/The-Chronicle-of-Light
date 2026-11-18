import { memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { HistoricalIncident } from '../../types/incident';
import {
  CATEGORIES,
  CATEGORY_COLOR,
  CATEGORY_TEXT,
  layoutConnections,
  panBy,
  tickStep,
  zoomAround,
  type Category,
  type ConnectionsLayout,
} from './connectionsLayout';

// The Connections page: connected events on a year axis, one lane per
// category, with arcs between connected events. The mouse wheel over the chart
// zooms the years around the pointer, dragging moves along time, and pinching
// zooms on touch screens. Built to the confirmed mockup (option 2, revision 1).
// Everything from the data is drawn as text; nothing is inserted as HTML.

interface Props {
  incidents: HistoricalIncident[];
  onNodeClick: (incident: HistoricalIncident) => void;
  fill?: boolean;
}

type View = [number, number];

const TOP = 40;
const ZOOM_STEP = 1.5;
const WHEEL_STEP = 1.2;

const btn =
  'inline-flex items-center justify-center min-h-[44px] sm:min-h-[32px] px-3 rounded-full border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-nma';

interface Geometry {
  left: number;
  plotW: number;
  lane: number;
  view: View;
}

const xOf = (g: Geometry, year: number) => g.left + ((year - g.view[0]) / (g.view[1] - g.view[0])) * g.plotW;

function posOf(layout: ConnectionsLayout, g: Geometry, id: string) {
  const e = layout.byId.get(id)!;
  return { x: xOf(g, e.year), y: TOP + e.lane * g.lane + 10 + e.spread * (g.lane - 20) };
}

/** The arcs. Positions follow every zoom step; the saving comes from batching steps per animation frame. */
const Arcs = memo(function Arcs({ layout, g, focus }: { layout: ConnectionsLayout; g: Geometry; focus: string | null }) {
  return (
    <>
      {layout.links.map(([a, b]) => {
        const p = posOf(layout, g, a);
        const q = posOf(layout, g, b);
        const on = a === focus || b === focus;
        const mx = (p.x + q.x) / 2;
        const my = Math.min(p.y, q.y) - Math.min(60, Math.abs(q.x - p.x) / 3) - 6;
        return (
          <path
            key={a + '|' + b}
            d={`M${p.x},${p.y} Q${mx},${my} ${q.x},${q.y}`}
            fill="none"
            stroke={on ? '#1B8A87' : '#94A3B8'}
            strokeWidth={on ? 2.2 : 0.8}
            opacity={on ? 1 : focus ? 0.15 : 0.45}
          />
        );
      })}
    </>
  );
});

/**
 * The dots. One tab stop (roving focus): the chosen dot, or the first visible
 * one when the chosen dot is zoomed out of sight. Clicks and keys are handled
 * once on the parent group, by the dot's data-id.
 */
const Dots = memo(function Dots({
  layout,
  g,
  focus,
  tabId,
}: {
  layout: ConnectionsLayout;
  g: Geometry;
  focus: string | null;
  tabId: string | null;
}) {
  const near = focus ? layout.neighbours.get(focus) : undefined;
  return (
    <>
      {layout.events.map((e) => {
        const id = e.incident.id;
        const p = posOf(layout, g, id);
        const lit = !focus || id === focus || near?.has(id);
        return (
          <circle
            key={id}
            data-id={id}
            cx={p.x}
            cy={p.y}
            r={3.2 + Math.sqrt(e.degree)}
            fill={CATEGORY_COLOR[e.incident.category as Category] ?? '#00C2B8'}
            stroke={id === focus ? '#0C2230' : '#fff'}
            strokeWidth={id === focus ? 2 : 1}
            opacity={lit ? 1 : 0.3}
            tabIndex={id === tabId ? 0 : -1}
            role="button"
            aria-label={`${e.incident.title}, ${e.year} CE, ${e.degree} connection${e.degree === 1 ? '' : 's'}`}
            aria-current={id === focus ? 'true' : undefined}
            className="cursor-pointer focus:outline-none focus-visible:stroke-teal-nma focus-visible:[stroke-width:3px]"
          >
            <title>{`${e.incident.title} (${e.year})`}</title>
          </circle>
        );
      })}
    </>
  );
});

export const ConnectionsTimeline: React.FC<Props> = ({ incidents, onNodeClick, fill = false }) => {
  const layout = useMemo(() => layoutConnections(incidents), [incidents]);
  const [view, setView] = useState<View>([layout.yearMin, layout.yearMax]);
  const [focusId, setFocusId] = useState<string | null>(null);
  // Announced for a click or Enter; arrow keys already read the focused dot's own label.
  const [announce, setAnnounce] = useState('');
  const [width, setWidth] = useState(0);
  const hasEvents = layout.events.length > 0;
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const clipId = 'ct-' + useId().replace(/[^a-zA-Z0-9_-]/g, '');

  // A new year range (a new filter) shows all of it again; the same range keeps the zoom.
  const [bounds, setBounds] = useState<View>([layout.yearMin, layout.yearMax]);
  if (bounds[0] !== layout.yearMin || bounds[1] !== layout.yearMax) {
    setBounds([layout.yearMin, layout.yearMax]);
    setView([layout.yearMin, layout.yearMax]);
  }

  // The chart is drawn at the panel's real width, so text stays readable on a phone.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [hasEvents]);

  const narrow = width > 0 && width < 600;
  const W = Math.max(320, width);
  const left = narrow ? 44 : 110;
  const right = narrow ? 10 : 20;
  const lane = narrow ? 48 : 56;
  const H = TOP + lane * CATEGORIES.length + 30;
  const plotW = W - left - right;
  const g = useMemo<Geometry>(() => ({ left, plotW, lane, view }), [left, plotW, lane, view]);

  // The busiest event is in focus first, and again whenever the filtered set no longer holds the chosen one.
  const busiest = useMemo(() => [...layout.events].sort((a, b) => b.degree - a.degree)[0]?.incident.id ?? null, [layout]);
  const focus = focusId && layout.byId.has(focusId) ? focusId : busiest;
  const byYear = useMemo(() => [...layout.events].sort((a, b) => a.year - b.year || a.lane - b.lane).map((e) => e.incident.id), [layout]);
  const inView = (id: string) => {
    const y = layout.byId.get(id)!.year;
    return y >= view[0] && y <= view[1];
  };
  const tabId = focus && inView(focus) ? focus : (byYear.find(inView) ?? focus);

  // Latest values for the native listeners below, which are attached once.
  const live = useRef({ bounds, W, left, plotW });
  useLayoutEffect(() => {
    live.current = { bounds, W, left, plotW };
  });

  // Wheel and pointer listeners are native: React's wheel listener is passive,
  // and the page must not scroll while the wheel zooms the chart. Updates are
  // gathered and applied once per animation frame.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    let frame = 0;
    let pending: ((v: View) => View)[] = [];
    const schedule = (f: (v: View) => View) => {
      pending.push(f);
      if (frame) return;
      frame = requestAnimationFrame(() => {
        const steps = pending;
        pending = [];
        frame = 0;
        setView((v) => steps.reduce((acc, step) => step(acc), v));
      });
    };
    const svgX = (clientX: number) => {
      const r = svg.getBoundingClientRect();
      return ((clientX - r.left) / r.width) * live.current.W;
    };
    const yearAt = (v: View, px: number) => v[0] + ((px - live.current.left) / live.current.plotW) * (v[1] - v[0]);

    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return; // a sideways swipe is not a zoom
      e.preventDefault();
      const px = svgX(e.clientX);
      const factor = e.deltaY > 0 ? WHEEL_STEP : 1 / WHEEL_STEP;
      schedule((v) => zoomAround(v, yearAt(v, px), factor, live.current.bounds));
    };

    // One pointer pans; two pointers pinch. When the number of pointers
    // changes, the gesture restarts from where the view is now.
    const points = new Map<number, number>();
    let gesture: { x: number; dist: number | null } | null = null;
    const restart = () => {
      const xs = [...points.values()];
      gesture = xs.length ? { x: xs[0], dist: xs.length === 2 ? Math.abs(xs[0] - xs[1]) : null } : null;
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      // A mouse press on a dot chooses it; a finger on a dot may still begin a pinch.
      if (e.pointerType === 'mouse' && (e.target as Element).tagName === 'circle') return;
      svg.setPointerCapture(e.pointerId);
      points.set(e.pointerId, svgX(e.clientX));
      restart();
    };
    const onMove = (e: PointerEvent) => {
      if (!gesture || !points.has(e.pointerId)) return;
      points.set(e.pointerId, svgX(e.clientX));
      const xs = [...points.values()];
      if (xs.length === 2 && gesture.dist) {
        const d = Math.max(1, Math.abs(xs[0] - xs[1]));
        const factor = gesture.dist / d;
        const mid = (xs[0] + xs[1]) / 2;
        gesture.dist = d;
        schedule((v) => zoomAround(v, yearAt(v, mid), factor, live.current.bounds));
        return;
      }
      if (xs.length !== 1) return;
      const moved = xs[0] - gesture.x;
      gesture.x = xs[0];
      schedule((v) => panBy(v, (-moved * (v[1] - v[0])) / live.current.plotW, live.current.bounds));
    };
    const onUp = (e: PointerEvent) => {
      if (!points.delete(e.pointerId)) return;
      restart();
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    svg.addEventListener('pointerdown', onDown);
    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerup', onUp);
    svg.addEventListener('pointercancel', onUp);
    svg.addEventListener('lostpointercapture', onUp);
    return () => {
      cancelAnimationFrame(frame);
      svg.removeEventListener('wheel', onWheel);
      svg.removeEventListener('pointerdown', onDown);
      svg.removeEventListener('pointermove', onMove);
      svg.removeEventListener('pointerup', onUp);
      svg.removeEventListener('pointercancel', onUp);
      svg.removeEventListener('lostpointercapture', onUp);
    };
  }, [hasEvents]);

  /** Choose an event and, when it is outside the years in view, move the view to it. */
  const choose = (id: string, moveFocus = false) => {
    setFocusId(id);
    const chosen = layout.byId.get(id);
    if (!moveFocus && chosen) setAnnounce(`Chosen: ${chosen.incident.title}, ${chosen.degree} connection${chosen.degree === 1 ? '' : 's'}`);
    const y = layout.byId.get(id)?.year;
    if (y !== undefined && (y < view[0] || y > view[1])) setView((v) => panBy(v, y - (v[0] + v[1]) / 2, bounds));
    if (moveFocus) requestAnimationFrame(() => svgRef.current?.querySelector<SVGElement>(`circle[data-id="${CSS.escape(id)}"]`)?.focus());
  };

  const onDotsClick = (e: React.MouseEvent) => {
    const id = (e.target as Element).getAttribute?.('data-id');
    if (id) choose(id);
  };
  const onDotsKey = (e: React.KeyboardEvent) => {
    const id = (e.target as Element).getAttribute?.('data-id');
    if (!id) return;
    const i = byYear.indexOf(id);
    const to = (j: number) => {
      e.preventDefault();
      choose(byYear[Math.max(0, Math.min(byYear.length - 1, j))], true);
    };
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(id);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') to(i + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') to(i - 1);
    else if (e.key === 'Home') to(0);
    else if (e.key === 'End') to(byYear.length - 1);
  };

  const step = tickStep(view[1] - view[0], narrow);
  const ticks: number[] = [];
  for (let y = Math.ceil(view[0] / step) * step; y <= view[1]; y += step) ticks.push(y);

  const focused = focus ? layout.byId.get(focus) : undefined;
  const focusList = focused
    ? [...(layout.neighbours.get(focused.incident.id) ?? [])]
        .map((id) => layout.byId.get(id))
        .filter((n): n is NonNullable<typeof n> => !!n)
        .sort((a, b) => a.year - b.year)
    : [];

  const notDrawn = layout.unconnected + layout.undated;

  return (
    <div className={`bg-white flex flex-col ${fill ? 'h-full w-full overflow-y-auto p-3 sm:p-4' : 'rounded-lg shadow-md p-3 sm:p-4'}`}>
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 mb-3">
        <h2 className="text-lg sm:text-2xl font-bold text-slate-900">Event Connections</h2>
        <p className="text-xs sm:text-sm text-slate-600 sm:text-right">
          Events by year, one lane per category; arcs join connected events · scroll over the chart to zoom the years, drag to move · {notDrawn} event
          {notDrawn === 1 ? '' : 's'} without connections or a year not drawn
        </p>
      </div>

      {!hasEvents ? (
        <div className="rounded-md border border-slate-200 bg-white flex flex-col items-center justify-center text-center gap-2 py-16 px-4 text-slate-600">
          <strong className="text-slate-800">No connected events match these filters</strong>
          <span className="text-sm">Widen the dates or choose All Categories.</span>
        </div>
      ) : (
        <>
          <section className="rounded-md border border-slate-200 bg-white pt-3 pb-2" aria-label="Connections along time">
            <div className="flex flex-wrap items-center gap-2 px-4 pb-2">
              <span className="text-sm text-slate-600 mr-auto tabular-nums">
                Showing {Math.round(view[0])} to {Math.round(view[1])} CE
              </span>
              <button type="button" className={btn} onClick={() => setView((v) => zoomAround(v, (v[0] + v[1]) / 2, 1 / ZOOM_STEP, bounds))}>
                Zoom in
              </button>
              <button type="button" className={btn} onClick={() => setView((v) => zoomAround(v, (v[0] + v[1]) / 2, ZOOM_STEP, bounds))}>
                Zoom out
              </button>
              <button type="button" className={btn} onClick={() => setView(bounds)}>
                Show all years
              </button>
            </div>
            <div ref={wrapRef}>
              <svg
                ref={svgRef}
                viewBox={`0 0 ${W} ${H}`}
                className="block w-full h-auto cursor-grab select-none"
                style={{ touchAction: 'pan-y' }}
                role="group"
                aria-label="Year axis with connected events. Use the arrow keys to move between events by year."
              >
                <defs>
                  <clipPath id={clipId}>
                    <rect x={left - 6} y={0} width={plotW + 12} height={H} />
                  </clipPath>
                </defs>
                {ticks.map((y) => (
                  <g key={y}>
                    <line x1={xOf(g, y)} x2={xOf(g, y)} y1={TOP - 8} y2={H - 24} stroke="#E2E8F0" />
                    <text x={xOf(g, y)} y={H - 8} textAnchor="middle" fontSize={11} fill="#64748B">
                      {y}
                    </text>
                  </g>
                ))}
                {CATEGORIES.map((c, i) => (
                  <text key={c} x={narrow ? 4 : 12} y={TOP + i * lane + lane / 2 + 4} fontSize={narrow ? 10 : 11} fontWeight={600} fill={CATEGORY_TEXT[c]} letterSpacing="0.06em">
                    <title>{c}</title>
                    {narrow ? c.slice(0, 3).toUpperCase() : c.toUpperCase()}
                  </text>
                ))}
                <g clipPath={`url(#${clipId})`}>
                  <Arcs layout={layout} g={g} focus={focus} />
                  <g onClick={onDotsClick} onKeyDown={onDotsKey}>
                    <Dots layout={layout} g={g} focus={focus} tabId={tabId} />
                  </g>
                </g>
              </svg>
            </div>
            <ul className="flex flex-wrap gap-3 px-4 pt-1 text-xs text-slate-600" aria-label="Categories">
              {CATEGORIES.map((c) => (
                <li key={c} className="inline-flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ background: CATEGORY_COLOR[c] }} aria-hidden="true" />
                  {c}
                </li>
              ))}
            </ul>
          </section>

          <p className="sr-only" role="status">
            {announce}
          </p>

          {focused && (
            <section className="rounded-md border border-slate-200 bg-white p-4 mt-4" aria-label="Chosen event">
              <div className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: CATEGORY_TEXT[focused.incident.category as Category] }}>
                {focused.incident.category}
              </div>
              <h3 className="text-base font-semibold text-slate-900 mt-1 break-words">{focused.incident.title}</h3>
              <p className="text-xs text-slate-500 mt-1">
                {focused.year} CE{focused.incident.region ? ` · ${focused.incident.region}` : ''} · {focused.degree} connection{focused.degree === 1 ? '' : 's'}
              </p>
              <ol className="mt-3 max-h-72 overflow-y-auto divide-y divide-slate-100 border-t border-slate-100">
                {focusList.map((n) => (
                  <li key={n.incident.id}>
                    <button
                      type="button"
                      onClick={() => choose(n.incident.id)}
                      className="w-full flex items-baseline gap-2 py-2 text-left text-sm text-slate-800 hover:bg-slate-50 min-h-[44px] sm:min-h-0"
                    >
                      <span className="inline-block w-2 h-2 rounded-full flex-none" style={{ background: CATEGORY_COLOR[n.incident.category as Category] }} aria-hidden="true" />
                      <span className="w-12 flex-none tabular-nums text-slate-500">{n.year}</span>
                      <span className="break-words">{n.incident.title}</span>
                    </button>
                  </li>
                ))}
              </ol>
              <button
                type="button"
                onClick={() => onNodeClick(focused.incident)}
                className="mt-3 inline-flex items-center justify-center min-h-[44px] px-5 rounded-full bg-teal-nma hover:bg-teal-nma/90 text-white text-sm font-semibold"
              >
                Open event
              </button>
            </section>
          )}
        </>
      )}
    </div>
  );
};
