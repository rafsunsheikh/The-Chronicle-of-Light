import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../lib/auth';

export const AccountMenu: React.FC = () => {
  const { enabled, loading, user, profile, isMaintainer, signInWithGoogle, signOut } =
    useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Hide entirely when the backend isn't configured yet.
  if (!enabled) return null;
  if (loading) {
    return <div className="w-20 h-8 rounded-full bg-white/10 animate-pulse" aria-hidden />;
  }

  if (!user) {
    return (
      <button
        type="button"
        onClick={() => signInWithGoogle()}
        className="flex items-center gap-2 rounded-full bg-white text-navy-nma text-sm font-semibold px-3 sm:px-4 py-1.5 hover:bg-white/90 transition-colors whitespace-nowrap"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/>
          <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"/>
        </svg>
        <span className="hidden sm:inline">Sign in</span>
      </button>
    );
  }

  const name = profile?.display_name || user.email || 'Account';
  const avatarUrl = (user.user_metadata?.avatar_url as string | undefined) ?? undefined;
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full bg-white/10 hover:bg-white/20 pl-1 pr-2 sm:pr-3 py-1 transition-colors"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
        ) : (
          <span className="w-7 h-7 rounded-full bg-teal-nma text-white text-xs font-bold flex items-center justify-center">
            {initial}
          </span>
        )}
        <span className="hidden md:inline text-sm text-white max-w-[10rem] truncate">
          {name}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 rounded-lg bg-white shadow-xl ring-1 ring-slate-200 py-1 text-sm text-slate-700 z-[1300]"
        >
          <div className="px-3 py-2 border-b border-slate-100">
            <div className="font-semibold text-slate-800 truncate">{name}</div>
            {user.email && (
              <div className="text-xs text-slate-500 truncate">{user.email}</div>
            )}
            {isMaintainer && (
              <span className="mt-1 inline-block text-[10px] font-semibold uppercase tracking-wide text-teal-nma">
                Maintainer
              </span>
            )}
          </div>

          <a
            href="#/dashboard"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 hover:bg-slate-50"
          >
            My contributions
          </a>
          {isMaintainer && (
            <a
              href="#/review"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 hover:bg-slate-50"
            >
              Review queue
            </a>
          )}

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              signOut();
            }}
            className="w-full text-left px-3 py-2 hover:bg-slate-50 border-t border-slate-100 text-red-nma"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
};
