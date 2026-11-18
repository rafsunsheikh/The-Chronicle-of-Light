import { useEffect, useState } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';

// The background map: OpenFreeMap's Positron style (free, no key), drawn by
// MapLibre GL inside the Leaflet map through @maplibre/maplibre-gl-leaflet, so
// the markers, popups and controls stay plain Leaflet. CARTO's tiles, used
// before, now need an API key (checked 2026-11-18).
//
// MapLibre is large and only this page needs it, so it is imported here when
// the map opens, not with the rest of the site.
const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
const ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> ' +
  '<a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">&copy; OpenMapTiles</a> ' +
  'Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
const FAILED = 'The background map could not load. The events are still shown.';

let workerReady: Promise<void> | null = null;

/** MapLibre runs its tile work in a web worker; Vite gives the worker file a URL of its own. */
function setUpWorker(setWorkerUrl: (url: string) => void) {
  workerReady ??= import('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url').then((m) => setWorkerUrl(m.default));
  return workerReady;
}

/** MapLibre 6 draws with WebGL2 only. */
function hasWebGL2(): boolean {
  try {
    const ctx = document.createElement('canvas').getContext('webgl2');
    // Release the test context at once; browsers allow only a few live ones.
    ctx?.getExtension('WEBGL_lose_context')?.loseContext();
    return !!ctx;
  } catch {
    return false;
  }
}

/**
 * Leaflet registers a layer and its move and zoom handlers before the layer's
 * own onAdd runs, so a layer whose onAdd threw is half added. Take it out
 * without calling the bridge's onRemove, which expects a working MapLibre map.
 */
function removeHalfAdded(map: L.Map, layer: L.Layer & { getContainer?: () => HTMLElement | undefined }) {
  const events = layer.getEvents?.() ?? {};
  for (const [name, handler] of Object.entries(events)) map.off(name, handler, layer);
  delete (map as unknown as { _layers: Record<number, L.Layer> })._layers[L.stamp(layer)];
  layer.getContainer?.()?.remove();
}

/** Show place names in English where the map data has them, as the old tiles did. */
function preferEnglish(glMap: import('maplibre-gl').Map) {
  for (const layer of glMap.getStyle()?.layers ?? []) {
    if (layer.type !== 'symbol') continue;
    // Only labels that show a name; road shields show numbers ("ref") and stay as they are.
    const field = glMap.getLayoutProperty(layer.id, 'text-field');
    if (!field || !JSON.stringify(field).includes('name')) continue;
    glMap.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', 'name:en'], ['get', 'name_en'], ['get', 'name:latin'], ['get', 'name']]);
  }
}

export const OpenFreeMapLayer: React.FC = () => {
  const map = useMap();
  // Checked once, before anything is added to the map.
  const [supported] = useState(hasWebGL2);
  const [loadFailed, setFailed] = useState(false);
  const failed = !supported || loadFailed;

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    let layer: L.Layer | null = null;
    (async () => {
      try {
        const [maplibre, bridge] = await Promise.all([
          import('maplibre-gl'),
          import('@maplibre/maplibre-gl-leaflet'),
          import('maplibre-gl/dist/maplibre-gl.css'),
        ]);
        await setUpWorker(maplibre.setWorkerUrl);
        if (cancelled) return;
        const gl = bridge.maplibreGL({ style: STYLE_URL, attributionControl: { customAttribution: ATTRIBUTION } });
        try {
          gl.addTo(map);
        } catch (err) {
          removeHalfAdded(map, gl);
          throw err;
        }
        layer = gl;
        // Only a failure before the style loads means "no background"; a single
        // missing tile later is not worth a message.
        const glMap = gl.getMaplibreMap();
        let loaded = false;
        glMap.once('load', () => {
          loaded = true;
          preferEnglish(glMap);
        });
        glMap.on('error', () => {
          if (!loaded && !cancelled) setFailed(true);
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      layer?.remove();
    };
  }, [map, supported]);

  // The live region is always there, so screen readers announce the sentence when it appears.
  return (
    <div className="leaflet-top leaflet-right" style={{ pointerEvents: 'none' }}>
      <p
        role="status"
        className={failed ? 'leaflet-control m-2 rounded bg-white/95 px-3 py-2 text-xs text-slate-700 shadow-sm' : 'sr-only'}
      >
        {failed ? FAILED : ''}
      </p>
    </div>
  );
};
