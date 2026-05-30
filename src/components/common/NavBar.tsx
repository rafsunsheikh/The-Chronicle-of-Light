import React from 'react';
import type { RoutePath } from '../../hooks/useHashRoute';

interface NavBarProps {
  route: RoutePath;
  eventCount: number;
}

const TABS: { path: RoutePath; label: string }[] = [
  { path: '/timeline', label: 'Timeline' },
  { path: '/map', label: 'Map' },
  { path: '/connections', label: 'Connections' },
  { path: '/moments', label: 'All Moments' },
];

export const NavBar: React.FC<NavBarProps> = ({ route, eventCount }) => {
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

      <div className="ml-auto px-4 hidden sm:flex items-center text-xs text-white/60 whitespace-nowrap">
        {eventCount.toLocaleString()} events
      </div>
    </nav>
  );
};
