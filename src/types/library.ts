// Library resources: books, reports, articles, videos and courses that sit
// in the Islamic Renaissance section. One JSON file per resource lives at
// src/data/library/{id}.json and is validated by scripts/validate-library.mjs
// against src/data/library.schema.json. Keep this type in sync with the schema.

export type ResourceType = 'book' | 'report' | 'article' | 'video' | 'course';

export type ResourceLicense =
  | 'public-domain'
  | 'cc0'
  | 'cc-by'
  | 'cc-by-sa'
  | 'cc-by-nc'
  | 'cc-by-nc-sa'
  | 'all-rights-reserved'
  | 'unknown';

export type RenaissanceCategory =
  | 'science-and-mathematics'
  | 'astronomy'
  | 'medicine'
  | 'philosophy-and-theology'
  | 'literature-and-poetry'
  | 'art-and-architecture'
  | 'translation-movement'
  | 'institutions'
  | 'geography-and-travel';

export interface ResourceVideo {
  provider: 'youtube' | 'internet-archive' | 'peertube';
  id: string;
  url?: string;
}

export interface ResourceSource {
  name: string;
  url?: string;
  retrieved: string; // YYYY-MM-DD
}

export interface LibraryResource {
  id: string; // lib-YYYY-slug, YYYY = the `year` field zero-padded
  type: ResourceType;
  title: string;
  originalTitle?: string;
  creators: string[];
  edition?: string;
  year: number; // year the work was written or first published
  language: string; // BCP 47 tag of the linked edition, e.g. "en", "ar"
  categories: RenaissanceCategory[];
  summary: string;
  url: string;
  license: ResourceLicense;
  hosted: boolean; // true only when the full text is committed to this repo
  contentPath?: string | null; // content/books/<slug>/content.md when hosted
  video?: ResourceVideo | null;
  source: ResourceSource;
  relatedEvents?: string[];
  confidence: 'established' | 'auto-imported';
}
