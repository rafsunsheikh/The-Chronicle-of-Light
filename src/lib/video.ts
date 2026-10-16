// Video sources the site can embed. Embedding is allowed by each provider's
// terms; downloading or re-hosting is not, so the site only ever links and
// embeds. YouTube goes through the youtube-nocookie.com domain and the player
// is loaded only after a click, so no YouTube cookies are set by opening a page.
import type { ResourceVideo } from '../types/library';

export type VideoRef = ResourceVideo;

/** Parse a YouTube, Internet Archive or PeerTube URL into a provider and id.
 *  Returns null for anything else. */
export function parseVideoUrl(url: string): VideoRef | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '');
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const v = u.searchParams.get('v');
    if (v) return { provider: 'youtube', id: v };
    const m = u.pathname.match(/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{6,})/);
    if (m) return { provider: 'youtube', id: m[1] };
    return null;
  }
  if (host === 'youtu.be') {
    const id = u.pathname.slice(1).split('/')[0];
    return id ? { provider: 'youtube', id } : null;
  }
  if (host === 'archive.org') {
    const m = u.pathname.match(/^\/(?:details|embed)\/([^/?#]+)/);
    return m ? { provider: 'internet-archive', id: m[1] } : null;
  }
  const pt = u.pathname.match(/^\/(?:videos\/(?:watch|embed)|w)\/([A-Za-z0-9-]{8,})/);
  if (pt) return { provider: 'peertube', id: pt[1], url: `${u.origin}/videos/embed/${pt[1]}` };
  return null;
}

/** The page a visitor can open on the provider's own site. */
export function videoPageUrl(v: VideoRef): string {
  if (v.provider === 'youtube') return `https://www.youtube.com/watch?v=${encodeURIComponent(v.id)}`;
  if (v.provider === 'internet-archive') return `https://archive.org/details/${encodeURIComponent(v.id)}`;
  return v.url ? v.url.replace('/videos/embed/', '/videos/watch/') : '#';
}

/** The iframe source, requested only after the visitor clicks play. */
export function videoEmbedUrl(v: VideoRef): string {
  if (v.provider === 'youtube') {
    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.id)}?autoplay=1&rel=0`;
  }
  if (v.provider === 'internet-archive') return `https://archive.org/embed/${encodeURIComponent(v.id)}?autoplay=1`;
  return v.url ? `${v.url}?autoplay=1` : '';
}

/** A poster image that sets no cookies. YouTube's image CDN serves these
 *  plainly; the Archive has a per-item image service; PeerTube needs the API,
 *  so it gets no poster and shows a plain play button instead. */
export function videoPosterUrl(v: VideoRef): string | null {
  if (v.provider === 'youtube') return `https://i.ytimg.com/vi/${encodeURIComponent(v.id)}/hqdefault.jpg`;
  if (v.provider === 'internet-archive') return `https://archive.org/services/img/${encodeURIComponent(v.id)}`;
  return null;
}

export const PROVIDER_LABELS: Record<VideoRef['provider'], string> = {
  youtube: 'YouTube',
  'internet-archive': 'Internet Archive',
  peertube: 'PeerTube',
};
