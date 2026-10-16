import { useMemo } from 'react';
import type { LibraryResource } from '../types/library';

// Mirrors useIncidents: Vite globs every src/data/library/*.json at build
// time. Drafts under src/data/library/imported/ are gitignored and not matched
// by this pattern, so unreviewed entries never reach the site.
const resourceModules = import.meta.glob<{ default: LibraryResource }>(
  '../data/library/*.json',
  { eager: true },
);

const resourcesData: LibraryResource[] = Object.values(resourceModules)
  .map((m) => m.default)
  .sort((a, b) => a.year - b.year || a.title.localeCompare(b.title));

export function useLibrary() {
  const resources = useMemo(() => resourcesData, []);

  const byId = useMemo(() => {
    const map = new Map<string, LibraryResource>();
    for (const r of resources) map.set(r.id, r);
    return map;
  }, [resources]);

  const countByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of resources) {
      for (const c of r.categories) counts[c] = (counts[c] ?? 0) + 1;
    }
    return counts;
  }, [resources]);

  return { resources, byId, countByCategory };
}
