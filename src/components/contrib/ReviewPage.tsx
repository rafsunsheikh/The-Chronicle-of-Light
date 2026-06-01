import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../lib/auth';
import {
  approveSubmission,
  listPendingSubmissions,
  rejectSubmission,
} from '../../lib/submissions';
import type { EventSubmission } from '../../types/contribution';
import type { HistoricalIncident } from '../../types/incident';

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

// Fields surfaced in the proposed-vs-current diff.
const FIELDS: { label: string; get: (e: HistoricalIncident) => string }[] = [
  { label: 'Title', get: (e) => e.title },
  { label: 'Start', get: (e) => e.startDate },
  { label: 'End', get: (e) => e.endDate ?? '—' },
  { label: 'Category', get: (e) => e.category },
  { label: 'Region', get: (e) => e.region ?? '—' },
  { label: 'Dynasty', get: (e) => e.dynasty ?? '—' },
  { label: 'Confidence', get: (e) => e.confidence ?? '—' },
  {
    label: 'Location',
    get: (e) =>
      e.location
        ? `${e.location.name} (${e.location.latitude}, ${e.location.longitude})`
        : '—',
  },
  {
    label: 'Image',
    get: (e) => e.media?.find((m) => m.type === 'image')?.url ?? '—',
  },
  { label: 'Description', get: (e) => e.description },
];

const Centered: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="h-full flex items-center justify-center p-8 text-center">
    <div className="max-w-md">{children}</div>
  </div>
);

const ReviewCard: React.FC<{
  submission: EventSubmission;
  current?: HistoricalIncident;
  onDone: () => void;
}> = ({ submission, current, onDone }) => {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<null | 'approve' | 'reject'>(null);
  const [error, setError] = useState<string | null>(null);

  const proposed = submission.payload;
  const isCreate = submission.type === 'create';

  const rows = FIELDS.map((f) => {
    const before = current ? f.get(current) : '—';
    const after = f.get(proposed);
    return { label: f.label, before, after, changed: before !== after };
  }).filter((r) => (isCreate ? r.after !== '—' : r.changed));

  const act = async (kind: 'approve' | 'reject') => {
    setBusy(kind);
    setError(null);
    const fn = kind === 'approve' ? approveSubmission : rejectSubmission;
    const { error: err } = await fn(submission.id, note);
    setBusy(null);
    if (err) {
      setError(err);
      return;
    }
    onDone();
  };

  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wide text-slate-400">
            {isCreate ? 'New event' : 'Edit'} · {submission.event_id}
          </div>
          <div className="font-semibold text-slate-800 truncate">
            {proposed.title || submission.event_id}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {submission.author_email ?? 'unknown'} · {formatDate(submission.created_at)}
          </div>
        </div>
        {!isCreate && !current && (
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full bg-amber-100 text-amber-800">
            target missing
          </span>
        )}
      </div>

      {submission.note && (
        <p className="mt-2 text-sm text-slate-600">
          <span className="font-medium">Submitter note:</span> {submission.note}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="mt-3 text-sm italic text-slate-500">
          No field changes detected.
        </p>
      ) : (
        <div className="mt-3 divide-y divide-slate-100 border border-slate-100 rounded-md">
          {rows.map((r) => (
            <div
              key={r.label}
              className="grid grid-cols-[6rem_1fr] gap-2 px-3 py-2 text-sm"
            >
              <div className="text-xs font-semibold text-slate-500 pt-0.5">
                {r.label}
              </div>
              <div className="break-words">
                {!isCreate && (
                  <span className="line-through text-rose-500/70 mr-2">
                    {r.before}
                  </span>
                )}
                <span className="text-emerald-700">{r.after}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Review note (optional)"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-nma/40 focus:border-teal-nma"
        />
      </div>

      {error && <p className="mt-2 text-sm text-rose-600">Failed: {error}</p>}

      <div className="mt-3 flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => act('reject')}
          disabled={busy !== null}
          className="rounded-full border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50 text-xs font-semibold tracking-wider uppercase px-4 py-2 transition-colors"
        >
          {busy === 'reject' ? 'Rejecting…' : 'Reject'}
        </button>
        <button
          type="button"
          onClick={() => act('approve')}
          disabled={busy !== null}
          className="rounded-full bg-teal-nma hover:bg-teal-nma/90 text-white disabled:opacity-60 text-xs font-semibold tracking-wider uppercase px-4 py-2 transition-colors"
        >
          {busy === 'approve' ? 'Approving…' : 'Approve'}
        </button>
      </div>
    </li>
  );
};

interface ReviewPageProps {
  currentEvents: HistoricalIncident[];
  onChanged: () => void; // refresh the live corpus after an approval
}

export const ReviewPage: React.FC<ReviewPageProps> = ({
  currentEvents,
  onChanged,
}) => {
  const { enabled, user, isMaintainer, signInWithGoogle } = useAuth();
  const [items, setItems] = useState<EventSubmission[] | null>(null);

  const currentById = useMemo(() => {
    const m = new Map<string, HistoricalIncident>();
    for (const e of currentEvents) m.set(e.id, e);
    return m;
  }, [currentEvents]);

  const reload = useCallback(async () => {
    setItems(await listPendingSubmissions());
  }, []);

  useEffect(() => {
    if (!isMaintainer) return;
    let cancelled = false;
    void (async () => {
      const data = await listPendingSubmissions();
      if (!cancelled) setItems(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [isMaintainer]);

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
        <h2 className="text-2xl font-semibold text-teal-nma mb-2">Review queue</h2>
        <p className="text-slate-600 mb-5">Sign in to access the review queue.</p>
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
  if (!isMaintainer) {
    return (
      <Centered>
        <p className="text-slate-600">
          You don't have access to the review queue. Only maintainers can review
          submissions.
        </p>
      </Centered>
    );
  }

  const handleDone = () => {
    reload();
    onChanged();
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-semibold text-teal-nma mb-1">Review queue</h1>
        <p className="text-sm text-slate-500 mb-6">
          Pending submissions. Approving applies the change to the live data
          immediately.
        </p>

        {items === null ? (
          <p className="text-slate-500">Loading…</p>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
            Nothing to review — the queue is empty. 🎉
          </div>
        ) : (
          <ul className="space-y-4">
            {items.map((s) => (
              <ReviewCard
                key={s.id}
                submission={s}
                current={currentById.get(s.event_id)}
                onDone={handleDone}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
