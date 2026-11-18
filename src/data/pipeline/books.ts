// The books the pipeline knows, from the same manifests the runner reads, so
// the admin page and the runner can never disagree about what a slug means.
import tabari from '../../../scripts/convert/manifests/tabari.json';
import type { PipelineBook, UploadedBook } from '../../types/pipeline';

interface Manifest {
  author?: string;
  items: Array<{ slug: string; title: string; author?: string; translator?: string; public?: boolean }>;
}

const manifests: Manifest[] = [tabari as Manifest];

export const PIPELINE_BOOKS: PipelineBook[] = manifests.flatMap((m) =>
  m.items.map((item) => ({
    slug: item.slug,
    title: item.title,
    author: item.author ?? m.author ?? null,
    translator: item.translator ?? null,
    public: item.public ?? false,
  })),
);

/** Manifest books plus uploaded ones, uploads first and newest first. A slug in both is the manifest's. */
export function allBooks(uploaded: UploadedBook[]): PipelineBook[] {
  const manifest = new Set(PIPELINE_BOOKS.map((b) => b.slug));
  const fromUploads: PipelineBook[] = uploaded
    .filter((u) => !manifest.has(u.slug))
    .map((u) => ({
      slug: u.slug,
      title: u.title,
      author: u.author,
      translator: u.translator,
      public: u.is_public,
      upload: { state: u.state, error: u.error, createdAt: u.created_at },
    }));
  return [...fromUploads, ...PIPELINE_BOOKS];
}
