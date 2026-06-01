import React, { useEffect, useMemo, useState } from 'react';
import { HistoricalIncident, Media } from '../../types/incident';
import { CATEGORIES, CONFIDENCE_LEVELS } from '../../lib/eventStore';
import type { SubmitResult } from '../../lib/submissions';

interface EventFormModalProps {
  draft: HistoricalIncident;
  mode: 'add' | 'edit';
  onSave: (incident: HistoricalIncident, note: string) => Promise<SubmitResult>;
  onCancel: () => void;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-nma/40 focus:border-teal-nma';
const labelClass = 'block text-xs font-semibold tracking-wide text-slate-600 mb-1';

export const EventFormModal: React.FC<EventFormModalProps> = ({
  draft,
  mode,
  onSave,
  onCancel,
}) => {
  const [form, setForm] = useState<HistoricalIncident>(draft);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Image media is edited as flat url/caption fields; any non-image media on
  // the original event is preserved untouched and re-attached on save.
  const existingImage = useMemo(
    () => draft.media?.find((m) => m.type === 'image'),
    [draft.media],
  );
  const [imageUrl, setImageUrl] = useState<string>(existingImage?.url ?? '');
  const [imageCaption, setImageCaption] = useState<string>(
    existingImage?.caption ?? '',
  );
  const [note, setNote] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'auto';
    };
  }, [onCancel]);

  const set = <K extends keyof HistoricalIncident>(
    key: K,
    value: HistoricalIncident[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const setLocationField = (
    field: 'latitude' | 'longitude' | 'name',
    raw: string,
  ) => {
    setForm((prev) => {
      const loc = prev.location ?? { latitude: 0, longitude: 0, name: '' };
      const next =
        field === 'name'
          ? { ...loc, name: raw }
          : { ...loc, [field]: raw === '' ? NaN : parseFloat(raw) };
      return { ...prev, location: next };
    });
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!form.title.trim()) next.title = 'Title is required.';
    if (!form.description.trim()) next.description = 'Description is required.';
    if (!ISO_DATE.test(form.startDate))
      next.startDate = 'Use a 4-digit ISO date, e.g. 0622-09-24.';
    if (form.endDate && !ISO_DATE.test(form.endDate))
      next.endDate = 'Use a 4-digit ISO date, e.g. 0622-09-24.';
    const loc = form.location;
    if (loc && (loc.name || !Number.isNaN(loc.latitude) || !Number.isNaN(loc.longitude))) {
      if (Number.isNaN(loc.latitude) || Number.isNaN(loc.longitude))
        next.location = 'Provide both latitude and longitude (or clear all location fields).';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!validate()) return;

    // Re-assemble media: keep non-image entries, prepend the edited image.
    const otherMedia = (form.media ?? []).filter((m) => m.type !== 'image');
    const media: Media[] = imageUrl.trim()
      ? [
          {
            type: 'image',
            url: imageUrl.trim(),
            ...(imageCaption.trim() ? { caption: imageCaption.trim() } : {}),
          },
          ...otherMedia,
        ]
      : otherMedia;

    // Drop an empty/partial location rather than persisting NaN coordinates.
    const loc = form.location;
    const location =
      loc && loc.name && !Number.isNaN(loc.latitude) && !Number.isNaN(loc.longitude)
        ? loc
        : undefined;

    const cleaned: HistoricalIncident = {
      ...form,
      title: form.title.trim(),
      description: form.description.trim(),
      endDate: form.endDate?.trim() ? form.endDate.trim() : undefined,
      region: form.region?.trim() ? form.region.trim() : undefined,
      dynasty: form.dynasty?.trim() ? form.dynasty.trim() : undefined,
      location,
      media,
      connections: form.connections ?? [],
    };

    setSubmitting(true);
    setSubmitError(null);
    const result = await onSave(cleaned, note);
    setSubmitting(false);
    if (result?.error) {
      setSubmitError(result.error);
      return;
    }
    setDone(true);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-form-heading"
      className="fixed inset-0 z-[1200] bg-panel overflow-y-auto"
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <div className="flex items-start justify-between mb-6 sm:mb-8">
          <h2
            id="event-form-heading"
            className="text-2xl sm:text-3xl font-semibold text-teal-nma"
          >
            {done
              ? 'Thank you!'
              : mode === 'add'
                ? 'Propose a new event'
                : 'Suggest an edit'}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel"
            className="w-9 h-9 rounded-full border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 flex items-center justify-center"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6L18 18M6 18L18 6" />
            </svg>
          </button>
        </div>

        {done ? (
          <div className="rounded-lg border border-teal-nma/30 bg-teal-nma/5 p-6 text-slate-700">
            <p className="text-base font-semibold text-teal-nma mb-2">
              Submitted for review
            </p>
            <p className="text-sm leading-relaxed">
              Your {mode === 'add' ? 'proposed event' : 'suggested edit'} has been
              sent to the maintainers. It won't appear on the site until it's
              approved. You can track its status under{' '}
              <span className="font-semibold">My contributions</span>.
            </p>
            <div className="mt-5 flex gap-3">
              <a
                href="#/dashboard"
                onClick={onCancel}
                className="px-5 py-2.5 rounded-full bg-teal-nma hover:bg-teal-nma/90 text-white text-xs font-semibold tracking-wider uppercase transition-colors"
              >
                View my contributions
              </a>
              <button
                type="button"
                onClick={onCancel}
                className="px-5 py-2.5 rounded-full border border-slate-300 text-slate-700 text-xs font-semibold tracking-wider uppercase hover:bg-slate-100 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-md bg-slate-100 px-4 py-3 text-xs text-slate-600">
            {mode === 'add'
              ? 'Your new event will be submitted for review and published once a maintainer approves it.'
              : 'Your changes will be submitted for review and applied once a maintainer approves them.'}
          </div>
          <div>
            <label className={labelClass} htmlFor="ev-title">Title *</label>
            <input
              id="ev-title"
              className={inputClass}
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
            />
            {errors.title && <p className="mt-1 text-xs text-red-nma">{errors.title}</p>}
          </div>

          <div>
            <label className={labelClass} htmlFor="ev-description">Description *</label>
            <textarea
              id="ev-description"
              rows={5}
              className={inputClass}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
            {errors.description && (
              <p className="mt-1 text-xs text-red-nma">{errors.description}</p>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass} htmlFor="ev-start">Start date * (YYYY-MM-DD)</label>
              <input
                id="ev-start"
                className={inputClass}
                placeholder="0622-09-24"
                value={form.startDate}
                onChange={(e) => set('startDate', e.target.value)}
              />
              {errors.startDate && (
                <p className="mt-1 text-xs text-red-nma">{errors.startDate}</p>
              )}
            </div>
            <div>
              <label className={labelClass} htmlFor="ev-end">End date (optional)</label>
              <input
                id="ev-end"
                className={inputClass}
                placeholder="0622-09-24"
                value={form.endDate ?? ''}
                onChange={(e) => set('endDate', e.target.value)}
              />
              {errors.endDate && (
                <p className="mt-1 text-xs text-red-nma">{errors.endDate}</p>
              )}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass} htmlFor="ev-category">Category *</label>
              <select
                id="ev-category"
                className={inputClass}
                value={form.category}
                onChange={(e) =>
                  set('category', e.target.value as HistoricalIncident['category'])
                }
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="ev-confidence">Confidence</label>
              <select
                id="ev-confidence"
                className={inputClass}
                value={form.confidence ?? ''}
                onChange={(e) =>
                  set(
                    'confidence',
                    (e.target.value || undefined) as HistoricalIncident['confidence'],
                  )
                }
              >
                <option value="">—</option>
                {CONFIDENCE_LEVELS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass} htmlFor="ev-region">Region</label>
              <input
                id="ev-region"
                className={inputClass}
                value={form.region ?? ''}
                onChange={(e) => set('region', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="ev-dynasty">Dynasty</label>
              <input
                id="ev-dynasty"
                className={inputClass}
                value={form.dynasty ?? ''}
                onChange={(e) => set('dynasty', e.target.value)}
              />
            </div>
          </div>

          <fieldset className="border border-slate-200 rounded-md p-4">
            <legend className="px-2 text-xs font-semibold tracking-wide text-slate-600">
              Location (optional)
            </legend>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="sm:col-span-3">
                <label className={labelClass} htmlFor="ev-loc-name">Place name</label>
                <input
                  id="ev-loc-name"
                  className={inputClass}
                  placeholder="Mecca, Arabia"
                  value={form.location?.name ?? ''}
                  onChange={(e) => setLocationField('name', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="ev-lat">Latitude</label>
                <input
                  id="ev-lat"
                  className={inputClass}
                  placeholder="21.4225"
                  value={
                    form.location && !Number.isNaN(form.location.latitude)
                      ? String(form.location.latitude)
                      : ''
                  }
                  onChange={(e) => setLocationField('latitude', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="ev-lng">Longitude</label>
                <input
                  id="ev-lng"
                  className={inputClass}
                  placeholder="39.8175"
                  value={
                    form.location && !Number.isNaN(form.location.longitude)
                      ? String(form.location.longitude)
                      : ''
                  }
                  onChange={(e) => setLocationField('longitude', e.target.value)}
                />
              </div>
            </div>
            {errors.location && (
              <p className="mt-2 text-xs text-red-nma">{errors.location}</p>
            )}
          </fieldset>

          <fieldset className="border border-slate-200 rounded-md p-4">
            <legend className="px-2 text-xs font-semibold tracking-wide text-slate-600">
              Image (optional)
            </legend>
            <div className="space-y-4">
              <div>
                <label className={labelClass} htmlFor="ev-img-url">Image URL</label>
                <input
                  id="ev-img-url"
                  className={inputClass}
                  placeholder="https://…"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="ev-img-caption">Caption</label>
                <input
                  id="ev-img-caption"
                  className={inputClass}
                  value={imageCaption}
                  onChange={(e) => setImageCaption(e.target.value)}
                />
              </div>
            </div>
          </fieldset>

          <div>
            <label className={labelClass} htmlFor="ev-note">
              Note to reviewer (optional)
            </label>
            <textarea
              id="ev-note"
              rows={2}
              className={inputClass}
              placeholder="Sources, reasoning, or anything that helps the reviewer"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {submitError && (
            <p className="text-sm text-red-nma">
              Couldn't submit: {submitError}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="px-5 py-2.5 rounded-full border border-slate-300 text-slate-700 text-xs font-semibold tracking-wider uppercase hover:bg-slate-100 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-full bg-teal-nma hover:bg-teal-nma/90 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-semibold tracking-wider uppercase transition-colors"
            >
              {submitting
                ? 'Submitting…'
                : mode === 'add'
                  ? 'Submit new event'
                  : 'Submit edit'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
};
