import { useCallback, useEffect, useState } from 'react';
import { createEmptyProfile } from '@constants/profile';
import { clearProfile, loadProfile, saveProfile } from '@shared/services/profileService';
import { toErrorMessage } from '@shared/utils/error';
import type { CustomField, Profile, ProfileMeta } from '@/types/profile';

/**
 * React binding for the profile service.
 *
 * Encapsulates load-on-mount, persistence, and the async status/error state the
 * UI needs — so screens stay declarative and never touch the service or storage
 * layers directly. Returns the last *persisted* profile and custom fields;
 * in-progress edits are owned by the form (draft state), keeping a clear line
 * between "saved" and "being edited".
 */

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface UseProfileResult {
  /** The most recently loaded or saved profile (never edits in flight). */
  readonly profile: Profile;
  /** The most recently loaded or saved custom fields (never edits in flight). */
  readonly customFields: readonly CustomField[];
  readonly meta: ProfileMeta | null;
  /** True while the initial load is in flight. */
  readonly loading: boolean;
  /** Whether a profile has previously been saved (vs first-run default). */
  readonly exists: boolean;
  readonly status: SaveStatus;
  readonly error: string | null;
  /** Persist the profile and custom fields; resolves `true` on success. */
  readonly save: (next: Profile, customFields: readonly CustomField[]) => Promise<boolean>;
  /** Delete the saved profile and return to the empty default state. */
  readonly clear: () => Promise<void>;
}

export function useProfile(): UseProfileResult {
  const [profile, setProfile] = useState<Profile>(() => createEmptyProfile());
  const [customFields, setCustomFields] = useState<readonly CustomField[]>([]);
  const [meta, setMeta] = useState<ProfileMeta | null>(null);
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // Load once when the popup mounts. The `active` flag guards against the
  // StrictMode double-invoke and any unmount mid-flight.
  useEffect(() => {
    let active = true;
    setLoading(true);
    loadProfile()
      .then((snapshot) => {
        if (!active) return;
        setProfile(snapshot.profile);
        setCustomFields(snapshot.customFields);
        setMeta(snapshot.meta);
        setExists(snapshot.exists);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (active) setError(toErrorMessage(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const save = useCallback(
    async (next: Profile, nextCustomFields: readonly CustomField[]): Promise<boolean> => {
      setStatus('saving');
      setError(null);
      try {
        const snapshot = await saveProfile(next, nextCustomFields);
        setProfile(snapshot.profile);
        setCustomFields(snapshot.customFields);
        setMeta(snapshot.meta);
        setExists(true);
        setStatus('saved');
        return true;
      } catch (cause: unknown) {
        setError(toErrorMessage(cause));
        setStatus('error');
        return false;
      }
    },
    [],
  );

  const clear = useCallback(async (): Promise<void> => {
    try {
      await clearProfile();
      setProfile(createEmptyProfile());
      setCustomFields([]);
      setMeta(null);
      setExists(false);
      setStatus('idle');
      setError(null);
    } catch (cause: unknown) {
      setError(toErrorMessage(cause));
      setStatus('error');
    }
  }, []);

  return { profile, customFields, meta, loading, exists, status, error, save, clear };
}
