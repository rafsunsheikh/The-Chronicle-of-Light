import React from 'react';
import type { LibraryResource } from '../../types/library';
import { categoryLabel } from '../../data/renaissanceCategories';
import { LICENSE_LABELS } from '../../data/licenses';

interface ResourceCardProps {
  resource: LibraryResource;
}

export const ResourceCard: React.FC<ResourceCardProps> = ({ resource }) => {
  return (
    <article className="bg-white rounded-md border border-slate-200 p-4 flex flex-col gap-2 hover:border-slate-400 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-widest text-teal-nma font-semibold">
          {resource.type}
        </span>
        <span className="text-[10px] uppercase tracking-widest text-slate-500">
          {resource.year}
        </span>
      </div>

      <h3 className="font-semibold text-slate-900 leading-snug">
        <a href={`#/library/${encodeURIComponent(resource.id)}`} className="hover:text-teal-nma">
          {resource.title}
        </a>
      </h3>

      <p className="text-xs text-slate-600">{resource.creators.join(', ')}</p>

      <p className="text-sm text-slate-700 line-clamp-3">{resource.summary}</p>

      <div className="flex flex-wrap gap-1 mt-auto pt-2">
        {resource.categories.map((c) => (
          <span
            key={c}
            className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600"
          >
            {categoryLabel(c)}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
        <span className="text-slate-500">{LICENSE_LABELS[resource.license]}</span>
        <a
          href={resource.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-teal-nma hover:underline"
        >
          Open at source
        </a>
      </div>
    </article>
  );
};
