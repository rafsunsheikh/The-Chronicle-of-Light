import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { fetchLeaderboard } from '../../lib/submissions';
import type { LeaderboardEntry } from '../../types/contribution';

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

const RANK_BADGES = ['🥇', '🥈', '🥉'];

const approvalRate = (e: LeaderboardEntry): number => {
  const reviewed = e.approved_count + e.rejected_count;
  return reviewed === 0 ? 0 : Math.round((e.approved_count / reviewed) * 100);
};

const Centered: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="h-full flex items-center justify-center p-8 text-center">
    <div className="max-w-md">{children}</div>
  </div>
);

export const LeaderboardPage: React.FC = () => {
  const { enabled, user } = useAuth();
  const [items, setItems] = useState<LeaderboardEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const data = await fetchLeaderboard();
      if (!cancelled) setItems(data);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!enabled) {
    return (
      <Centered>
        <p className="text-slate-500">
          The leaderboard isn't available — backend not configured.
        </p>
      </Centered>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-semibold text-teal-nma mb-1">
          Contributors leaderboard
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          Ranked by approved contributions — the edits and new events that have
          made it into the chronicle.
        </p>

        {items === null ? (
          <p className="text-slate-500">Loading…</p>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
            No contributions yet. Be the first — open an event and choose{' '}
            <span className="font-semibold">“Suggest an edit”</span>, or add a new
            event from the timeline.
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((e, i) => {
              const isMe = user?.id === e.author_id;
              return (
                <li
                  key={e.author_id}
                  className={`flex items-center gap-4 rounded-lg border bg-white p-4 ${
                    isMe ? 'border-teal-nma ring-1 ring-teal-nma/30' : 'border-slate-200'
                  }`}
                >
                  <div className="w-8 shrink-0 text-center text-lg font-bold text-slate-400">
                    {RANK_BADGES[i] ?? i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-800 truncate">
                      {e.display_name}
                      {isMe && (
                        <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-teal-nma">
                          You
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {e.pending_count > 0 && `${e.pending_count} pending · `}
                      {e.approved_count + e.rejected_count > 0 &&
                        `${approvalRate(e)}% approval · `}
                      last contribution {formatDate(e.last_contribution)}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-xl font-bold text-emerald-600 leading-none">
                      {e.approved_count}
                    </div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-400 mt-1">
                      approved
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
