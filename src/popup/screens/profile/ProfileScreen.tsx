import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@components/ui/Button';
import { TextField } from '@components/ui/TextField';
import { PROFILE_SECTIONS } from '@constants/profile';
import { useProfile } from '@hooks/useProfile';
import { validateProfile } from '@shared/validation/profile';
import type { FieldErrors } from '@shared/validation/profile';
import type { Profile, ProfileFieldKey } from '@/types/profile';
import { CustomFieldsEditor, customFieldsToDrafts, draftsToCustomFields } from './CustomFieldsEditor';
import type { CustomFieldDraft } from './CustomFieldsEditor';

/**
 * Profile management screen.
 *
 * Owns the editable draft (separate from the last-persisted profile the hook
 * exposes), tracks which fields the user has touched so errors only surface
 * after interaction or a save attempt, and drives save/reset with clear
 * success and validation feedback.
 */

type TouchedMap = Partial<Record<ProfileFieldKey, boolean>>;

/**
 * Fields compact enough to sit two-per-row in the narrow popup. Everything else
 * (and any multiline field) spans the full width. Purely presentational, so it
 * lives here rather than polluting the semantic field descriptors.
 */
const HALF_WIDTH_FIELDS: ReadonlySet<ProfileFieldKey> = new Set([
  'firstName',
  'lastName',
  'city',
  'state',
  'postalCode',
  'country',
]);

export function ProfileScreen() {
  const { profile, customFields, loading, exists, status, error, save, clear } = useProfile();

  const [draft, setDraft] = useState<Profile>(profile);
  const [customDrafts, setCustomDrafts] = useState<readonly CustomFieldDraft[]>(() =>
    customFieldsToDrafts(customFields),
  );
  const [touched, setTouched] = useState<TouchedMap>({});
  const [submitted, setSubmitted] = useState(false);

  // Re-seed the draft whenever a freshly loaded/saved profile arrives.
  useEffect(() => {
    setDraft(profile);
  }, [profile]);

  // Re-seed custom-field drafts on load/save so the editor reflects storage.
  useEffect(() => {
    setCustomDrafts(customFieldsToDrafts(customFields));
  }, [customFields]);

  const validation = useMemo(() => validateProfile(draft), [draft]);

  // Only reveal a field's error once it's been touched or a save was attempted.
  const visibleErrors = useMemo<FieldErrors>(() => {
    if (submitted) return validation.errors;
    const shown: FieldErrors = {};
    for (const key of Object.keys(validation.errors) as ProfileFieldKey[]) {
      if (touched[key]) shown[key] = validation.errors[key];
    }
    return shown;
  }, [validation.errors, touched, submitted]);

  // Compare the normalised custom fields (labels trimmed, aliases parsed) rather
  // than raw draft text, so cosmetic edits like a trailing comma don't count.
  const customFieldsDirty = useMemo(
    () =>
      JSON.stringify(draftsToCustomFields(customDrafts)) !==
      JSON.stringify(customFields as readonly unknown[]),
    [customDrafts, customFields],
  );

  const profileDirty = useMemo(
    () => (Object.keys(draft) as ProfileFieldKey[]).some((key) => draft[key] !== profile[key]),
    [draft, profile],
  );

  const dirty = profileDirty || customFieldsDirty;

  const handleChange = useCallback((key: ProfileFieldKey, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleBlur = useCallback((key: ProfileFieldKey) => {
    setTouched((prev) => ({ ...prev, [key]: true }));
  }, []);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setSubmitted(true);
      const result = validateProfile(draft);
      if (!result.valid) return;
      await save(draft, draftsToCustomFields(customDrafts));
    },
    [draft, customDrafts, save],
  );

  const handleReset = useCallback(async () => {
    await clear();
    setTouched({});
    setSubmitted(false);
  }, [clear]);

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-ink-muted">
        Loading your profile…
      </div>
    );
  }

  const errorCount = Object.keys(visibleErrors).length;
  const showSaved = status === 'saved' && !dirty;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      {!exists ? (
        <p className="rounded-lg bg-brand-soft/60 px-3 py-2 text-xs text-ink-muted">
          No profile saved yet. Fill in what you like and press{' '}
          <span className="font-medium text-ink">Save profile</span> — FormPilot keeps it on this
          device only.
        </p>
      ) : null}

      {PROFILE_SECTIONS.map((section) => (
        <section key={section.id} className="flex flex-col gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">{section.title}</h2>
            <p className="text-xs text-ink-faint">{section.description}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {section.fields.map((descriptor) => {
              const spanClass =
                descriptor.format !== 'multiline' && HALF_WIDTH_FIELDS.has(descriptor.key)
                  ? 'col-span-1'
                  : 'col-span-2';
              return (
                <div key={descriptor.key} className={spanClass}>
                  <TextField
                    descriptor={descriptor}
                    value={draft[descriptor.key]}
                    error={visibleErrors[descriptor.key] ?? null}
                    onChange={handleChange}
                    onBlur={handleBlur}
                  />
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Custom Fields</h2>
          <p className="text-xs text-ink-faint">
            Anything the built-in fields don&apos;t cover. Each one autofills using its name and
            aliases.
          </p>
        </div>
        <CustomFieldsEditor drafts={customDrafts} onChange={setCustomDrafts} />
      </section>

      <div
        aria-live="polite"
        className="min-h-[20px] text-xs"
      >
        {error ? (
          <span className="text-accent-danger">{error}</span>
        ) : submitted && errorCount > 0 ? (
          <span className="text-accent-danger">
            Please fix {errorCount} field{errorCount > 1 ? 's' : ''} above.
          </span>
        ) : showSaved ? (
          <span className="text-accent-success">Profile saved.</span>
        ) : null}
      </div>

      <div className="sticky bottom-0 -mx-5 flex items-center justify-between gap-2 border-t border-line bg-surface px-5 py-3">
        <Button
          type="button"
          variant="danger"
          onClick={handleReset}
          disabled={!exists || status === 'saving'}
        >
          Clear
        </Button>
        <Button type="submit" variant="primary" disabled={status === 'saving' || !dirty}>
          {status === 'saving' ? 'Saving…' : 'Save profile'}
        </Button>
      </div>
    </form>
  );
}
