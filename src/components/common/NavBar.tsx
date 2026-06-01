import React from 'react';
import type { RoutePath } from '../../hooks/useHashRoute';
import { AccountMenu } from './AccountMenu';

interface NavBarProps {
  route: RoutePath;
  eventCount: number;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

const TABS: { path: RoutePath; label: string }[] = [
  { path: '/timeline', label: 'Timeline' },
  { path: '/map', label: 'Map' },
  { path: '/connections', label: 'Connections' },
  { path: '/moments', label: 'All Moments' },
  { path: '/leaderboard', label: 'Leaderboard' },
];

export const NavBar: React.FC<NavBarProps> = ({
  route,
  eventCount,
  searchQuery,
  setSearchQuery,
}) => {
  return (
    <nav className="h-14 shrink-0 bg-navy-nma text-white flex items-stretch z-30 shadow-md">
      <a
        href="#/timeline"
        className="px-4 flex flex-col justify-center shrink-0 hover:bg-white/5 transition-colors"
        aria-label="The Chronicle of Light — home"
      >
        <div className="text-[10px] tracking-widest uppercase opacity-70 leading-tight">The</div>
        <div className="font-bold leading-tight text-sm">Chronicle of Light</div>
      </a>

      <div className="flex items-stretch overflow-x-auto">
        {TABS.map((tab) => {
          const active = route === tab.path;
          return (
            <a
              key={tab.path}
              href={`#${tab.path}`}
              aria-current={active ? 'page' : undefined}
              className={[
                'px-4 sm:px-5 flex items-center text-sm font-medium whitespace-nowrap',
                'border-b-2 transition-colors',
                active
                  ? 'border-white text-white bg-white/10'
                  : 'border-transparent text-white/70 hover:text-white hover:bg-white/5',
              ].join(' ')}
            >
              {tab.label}
            </a>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-3 pl-2 pr-3">
        <div className="relative">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-white/50">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
          </span>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search events…"
            aria-label="Search events"
            className="w-32 sm:w-52 bg-white/10 focus:bg-white/15 text-white placeholder-white/50 text-sm rounded-full border border-white/20 focus:border-white/40 focus:outline-none pl-8 pr-7 py-1.5 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6L18 18M6 18L18 6" />
              </svg>
            </button>
          )}
        </div>
        <span className="hidden lg:block text-xs text-white/60 whitespace-nowrap">
          {eventCount.toLocaleString()} events
        </span>
        <AccountMenu />
      </div>
    </nav>
  );
};
