import React, { useState } from 'react';
import { PROVIDER_LABELS, videoEmbedUrl, videoPageUrl, videoPosterUrl, type VideoRef } from '../../lib/video';

interface VideoEmbedProps {
  video: VideoRef;
  title: string;
  className?: string;
}

/**
 * Click-to-load video. Until the visitor presses play the page shows only a
 * poster image (served without cookies) and a button; the provider's player
 * iframe is created on click. Keyboard and screen-reader users get a real
 * button and a link to the provider's page.
 */
export const VideoEmbed: React.FC<VideoEmbedProps> = ({ video, title, className = '' }) => {
  const [playing, setPlaying] = useState(false);
  const poster = videoPosterUrl(video);
  const provider = PROVIDER_LABELS[video.provider];

  return (
    <div className={`relative w-full aspect-video bg-slate-900 rounded-md overflow-hidden ${className}`}>
      {playing ? (
        <iframe
          src={videoEmbedUrl(video)}
          title={title}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`Play video: ${title} (${provider})`}
          className="group absolute inset-0 w-full h-full flex items-center justify-center focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-nma-bright"
        >
          {poster && (
            <img
              src={poster}
              alt=""
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
            />
          )}
          <span className="relative flex items-center justify-center w-16 h-16 rounded-full bg-teal-nma text-white shadow-lg group-hover:bg-teal-nma-bright transition-colors">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
          <span className="absolute bottom-2 right-2 text-[10px] uppercase tracking-widest text-white/80 bg-black/50 px-2 py-0.5 rounded">
            {provider}
          </span>
        </button>
      )}
      <a
        href={videoPageUrl(video)}
        target="_blank"
        rel="noopener noreferrer"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-white text-slate-900 text-xs px-2 py-1 rounded"
      >
        Open on {provider}
      </a>
    </div>
  );
};
