import type { RenaissanceCategory } from '../types/library';

export interface CategoryDef {
  id: RenaissanceCategory;
  label: string;
  blurb: string;
}

// Display order for the Islamic Renaissance section. The ids must match the
// `categories` enum in library.schema.json; the validator checks the data
// against the schema, so a typo here shows up as an empty category, not a crash.
export const RENAISSANCE_CATEGORIES: CategoryDef[] = [
  {
    id: 'science-and-mathematics',
    label: 'Science and mathematics',
    blurb: 'Algebra, algorithms, optics and the experimental method.',
  },
  {
    id: 'astronomy',
    label: 'Astronomy',
    blurb: 'Observatories, star tables and the instruments that measured the sky.',
  },
  {
    id: 'medicine',
    label: 'Medicine',
    blurb: 'Hospitals, pharmacology and textbooks used in Europe for centuries.',
  },
  {
    id: 'philosophy-and-theology',
    label: 'Philosophy and theology',
    blurb: 'Reason, revelation and the thinkers who argued over both.',
  },
  {
    id: 'literature-and-poetry',
    label: 'Literature and poetry',
    blurb: 'Epics, quatrains and the stories that travelled the world.',
  },
  {
    id: 'art-and-architecture',
    label: 'Art and architecture',
    blurb: 'Mosques, palaces, calligraphy and geometric design.',
  },
  {
    id: 'translation-movement',
    label: 'Translation movement',
    blurb: 'Greek, Persian and Indian works carried into Arabic and onward.',
  },
  {
    id: 'institutions',
    label: 'Institutions',
    blurb: 'The House of Wisdom, madrasas, libraries and hospitals.',
  },
  {
    id: 'geography-and-travel',
    label: 'Geography and travel',
    blurb: 'Maps, travelogues and the trade routes that linked three continents.',
  },
];

export const categoryLabel = (id: string): string =>
  RENAISSANCE_CATEGORIES.find((c) => c.id === id)?.label ?? id;
