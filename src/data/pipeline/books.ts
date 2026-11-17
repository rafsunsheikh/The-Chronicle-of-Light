// The books the pipeline knows, from the same manifests the runner reads, so
// the admin page and the runner can never disagree about what a slug means.
import tabari from '../../../scripts/convert/manifests/tabari.json';
import type { PipelineBook } from '../../types/pipeline';

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
