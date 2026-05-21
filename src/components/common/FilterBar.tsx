import React from 'react';

interface FilterBarProps {
  categories: string[];
  regions: string[];
  selectedCategory: string | null;
  setSelectedCategory: (category: string | null) => void;
  selectedRegion: string | null;
  setSelectedRegion: (region: string | null) => void;
  dateRange: { start: string; end: string } | null;
  setDateRange: (range: { start: string; end: string } | null) => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  categories,
  regions,
  selectedCategory,
  setSelectedCategory,
  selectedRegion,
  setSelectedRegion,
  dateRange,
  setDateRange,
}) => {
  return (
    <div className="bg-white border border-slate-200 rounded-md p-3 sm:p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <select
          value={selectedCategory || ''}
          onChange={(e) => setSelectedCategory(e.target.value || null)}
          className="p-2 border border-slate-300 rounded text-sm"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        <select
          value={selectedRegion || ''}
          onChange={(e) => setSelectedRegion(e.target.value || null)}
          className="p-2 border border-slate-300 rounded text-sm"
        >
          <option value="">All Regions</option>
          {regions.map((region) => (
            <option key={region} value={region}>{region}</option>
          ))}
        </select>

        <input
          type="date"
          value={dateRange?.start || ''}
          onChange={(e) => setDateRange(dateRange ? { ...dateRange, start: e.target.value } : { start: e.target.value, end: '' })}
          className="p-2 border border-slate-300 rounded text-sm"
          placeholder="Start Date"
        />

        <input
          type="date"
          value={dateRange?.end || ''}
          onChange={(e) => setDateRange(dateRange ? { ...dateRange, end: e.target.value } : { start: '', end: e.target.value })}
          className="p-2 border border-slate-300 rounded text-sm"
          placeholder="End Date"
        />
      </div>
    </div>
  );
};
