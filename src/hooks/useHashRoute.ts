import { useEffect, useState } from 'react';

/**
 * Minimal dependency-free hash router.
 *
 * Hash routing (URLs like `…/#/map`) is used deliberately: the app is served
 * from a GitHub Pages sub-path and a normal path router would 404 on deep links
 * / refreshes without an SPA fallback. The hash never hits the server.
 *
 * Most routes are exact. `/library` takes one segment after it, the resource
 * id (`#/library/lib-0830-the-algebra-of-al-khwarizmi`), returned as `param`.
 */
export type RoutePath =
  | '/timeline'
  | '/map'
  | '/connections'
  | '/moments'
  | '/renaissance'
  | '/library'
  | '/leaderboard'
  | '/dashboard'
  | '/review';

export interface HashRoute {
  path: RoutePath;
  /** The segment after the path, for routes that take one. Null otherwise. */
  param: string | null;
  /** A third segment such as "read" in #/library/<id>/read. Null otherwise. */
  sub: string | null;
}

const DEFAULT_ROUTE: RoutePath = '/timeline';
const ROUTES: RoutePath[] = [
  '/timeline',
  '/map',
  '/connections',
  '/moments',
  '/renaissance',
  '/library',
  '/leaderboard',
  '/dashboard',
  '/review',
];
const PARAM_ROUTES = new Set<RoutePath>(['/library']);

export const currentRoute = (): HashRoute => {
  const raw = window.location.hash.replace(/^#/, '').split('?')[0];
  const [, first = '', second = '', third = ''] = raw.split('/');
  const path = `/${first}` as RoutePath;
  if (!ROUTES.includes(path)) return { path: DEFAULT_ROUTE, param: null, sub: null };
  const param = PARAM_ROUTES.has(path) && second ? decodeURIComponent(second) : null;
  const sub = param && third ? decodeURIComponent(third) : null;
  return { path, param, sub };
};

export function useHashRoute(): HashRoute {
  const [route, setRoute] = useState<HashRoute>(currentRoute);
  useEffect(() => {
    const onChange = () => setRoute(currentRoute());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
