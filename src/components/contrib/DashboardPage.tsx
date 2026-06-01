import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth';
import {
  fetchLeaderboard,
  listMySubmissions,
  withdrawSubmission,
} from '../../lib/submissions';
import type { EventSubmission } from '../../types/contribution';

const ordinal = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
};

const STATUS_STYLES: Record<EventSubmission['status'], string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-rose-100 text-rose-700',
};

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : new Intl.DateTimeFormat('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(d);
};

const Centered: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="h-full flex items-center justify-center p-8 text-center">
    <div className="max-w-md">{children}</div>
  </div>
);

export const DashboardPage: React.FC = () => {
  const { enabled, user, signInWithGoogle } = useAuth();
  const [items, setItems] = useState<EventSubmission[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rank, setRank] = useState<{
    position: number;
    total: number;
    approved: number;
  } | null>(null);

  const reload = useCallback(async () => {
    if (!user) return;
    setItems(await listMySubmissions(user.id));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      const [data, board] = await Promise.all([
        listMySubmissions(user.id),
        fetchLeaderboard(),
      ]);
      if (cancelled) return;
      setItems(data);
      const idx = board.findIndex((e) => e.author_id === user.id);
      setRank(
        idx === -1
          ? null
          : {
              position: idx + 1,
              total: board.length,
              approved: board[idx].approved_count,
            },
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!enabled) {
    return (
      <Centered>
        <p className="text-slate-500">Sign-in isn't configured for this site.</p>
      </Centered>
    );
  }

  if (!user) {
    return (
      <Centered>
        <h2 className="text-2xl font-semibold text-teal-nma mb-2">My contributions</h2>
        <p className="text-slate-600 mb-5">
          Sign in to propose edits and track the status of your contributions.
        </p>
        <button
          type="button"
          onClick={() => signInWithGoogle()}
          className="rounded-full bg-teal-nma hover:bg-teal-nma/90 text-white text-xs font-semibold tracking-wider uppercase px-6 py-3 transition-colors"
        >
          Sign in with Google
        </button>
      </Centered>
    );
  }

  const handleWithdraw = async (id: string) => {
    setBusyId(id);
    await withdrawSubmission(id);
    setBusyId(null);
    reload();
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-semibold text-teal-nma mb-1">My contributions</h1>
        <p className="text-sm text-slate-500 mb-6">
          Edits and new events you've proposed. They go live once a maintainer
          approves them.
        </p>

        {rank && (
          <a
            href="#/leaderboard"
            className="mb-6 flex items-center gap-3 rounded-lg border border-teal-nma/30 bg-teal-nma/5 px-4 py-3 hover:bg-teal-nma/10 transition-colors"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-nma text-sm font-bold text-white">
              #{rank.position}
            </span>
            <span className="text-sm text-slate-700">
              You're <span className="font-semibold">{ordinal(rank.position)}</span>{' '}
              of {rank.total} contributors with{' '}
              <span className="font-semibold">{rank.approved}</span> approved{' '}
              {rank.approved === 1 ? 'contribution' : 'contributions'}.
              <span className="ml-1 text-teal-nma font-medium">
                View leaderboard →
              </span>
            </span>
          </a>
        )}

        {items === null ? (
          <p className="text-slate-500">Loading…</p>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
            You haven't proposed any changes yet. Open an event and choose{' '}
            <span className="font-semibold">“Suggest an edit”</span>, or add a new
            event from the timeline.
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((s) => (
              <li
                key={s.id}
                className="rounded-lg border border-slate-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wide text-slate-400">
                      {s.type === 'create' ? 'New event' : 'Edit'}
                    </div>
                    <div className="font-semibold text-slate-800 truncate">
                      {s.payload.title || s.event_id}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Submitted {formatDate(s.created_at)}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full ${STATUS_STYLES[s.status]}`}
                  >
                    {s.status}
                  </span>
                </div>

                {s.note && (
                  <p className="mt-2 text-sm text-slate-600">
                    <span className="font-medium">Your note:</span> {s.note}
                  </p>
                )}
                {s.review_note && (
                  <p className="mt-1 text-sm text-slate-600">
                    <span className="font-medium">Reviewer:</span> {s.review_note}
                  </p>
                )}

                {s.status === 'pending' && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => handleWithdraw(s.id)}
                      disabled={busyId === s.id}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-50"
                    >
                      {busyId === s.id ? 'Withdrawing…' : 'Withdraw'}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
