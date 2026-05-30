import { useEffect, useState } from 'react';

/**
 * Minimal dependency-free hash router.
 *
 * Hash routing (URLs like `…/#/map`) is used deliberately: the app is served
 * from a GitHub Pages sub-path and a normal path router would 404 on deep links
 * / refreshes without an SPA fallback. The hash never hits the server.
 */
export type RoutePath = '/timeline' | '/map' | '/connections' | '/moments';

const DEFAULT_ROUTE: RoutePath = '/timeline';
const ROUTES: RoutePath[] = ['/timeline', '/map', '/connections', '/moments'];

const currentRoute = (): RoutePath => {
  const h = window.location.hash.replace(/^#/, '') as RoutePath;
  return ROUTES.includes(h) ? h : DEFAULT_ROUTE;
};

export function useHashRoute(): RoutePath {
  const [route, setRoute] = useState<RoutePath>(currentRoute);
  useEffect(() => {
    const onChange = () => setRoute(currentRoute());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
