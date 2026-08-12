import { useCallback, useEffect, useState } from 'react';
import {
  addResume,
  deleteResume,
  loadResumeVault,
  renameResume,
  replaceResumeFile,
  setDefaultResume,
  updateResumeMeta,
} from '@shared/services/resumeService';
import { toErrorMessage } from '@shared/utils/error';
import type { Resume, ResumeFile, ResumeMetaInput } from '@/types/resume';

/**
 * React binding for the Resume Vault service.
 *
 * Encapsulates load-on-mount plus each mutation, keeping the vault snapshot in
 * state and threading a busy/error status to the UI. Every mutation resolves to
 * the freshly persisted snapshot (the service is read-modify-write of the whole
 * vault), so we simply replace local state with what was saved — no optimistic
 * reconciliation needed. Screens never touch the service or storage directly.
 */

export type VaultStatus = 'idle' | 'working' | 'error';

export interface UseResumesResult {
  readonly resumes: readonly Resume[];
  readonly defaultResumeId: string | null;
  readonly loading: boolean;
  readonly status: VaultStatus;
  readonly error: string | null;
  readonly add: (file: ResumeFile, meta: ResumeMetaInput) => Promise<boolean>;
  readonly rename: (id: string, name: string) => Promise<boolean>;
  readonly updateMeta: (id: string, meta: ResumeMetaInput) => Promise<boolean>;
  readonly replaceFile: (id: string, file: ResumeFile) => Promise<boolean>;
  readonly remove: (id: string) => Promise<boolean>;
  readonly makeDefault: (id: string) => Promise<boolean>;
}

export function useResumes(): UseResumesResult {
  const [resumes, setResumes] = useState<readonly Resume[]>([]);
  const [defaultResumeId, setDefaultResumeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<VaultStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadResumeVault()
      .then((snapshot) => {
        if (!active) return;
        setResumes(snapshot.resumes);
        setDefaultResumeId(snapshot.defaultResumeId);
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

  // Run one vault mutation, funnelling status/error handling through a single
  // path so every action behaves identically to the UI.
  const run = useCallback(
    async (
      action: () => Promise<{ resumes: readonly Resume[]; defaultResumeId: string | null }>,
    ) => {
      setStatus('working');
      setError(null);
      try {
        const snapshot = await action();
        setResumes(snapshot.resumes);
        setDefaultResumeId(snapshot.defaultResumeId);
        setStatus('idle');
        return true;
      } catch (cause: unknown) {
        setError(toErrorMessage(cause));
        setStatus('error');
        return false;
      }
    },
    [],
  );

  const add = useCallback(
    (file: ResumeFile, meta: ResumeMetaInput) => run(() => addResume(file, meta)),
    [run],
  );
  const rename = useCallback(
    (id: string, name: string) => run(() => renameResume(id, name)),
    [run],
  );
  const updateMeta = useCallback(
    (id: string, meta: ResumeMetaInput) => run(() => updateResumeMeta(id, meta)),
    [run],
  );
  const replaceFile = useCallback(
    (id: string, file: ResumeFile) => run(() => replaceResumeFile(id, file)),
    [run],
  );
  const remove = useCallback((id: string) => run(() => deleteResume(id)), [run]);
  const makeDefault = useCallback((id: string) => run(() => setDefaultResume(id)), [run]);

  return {
    resumes,
    defaultResumeId,
    loading,
    status,
    error,
    add,
    rename,
    updateMeta,
    replaceFile,
    remove,
    makeDefault,
  };
}
