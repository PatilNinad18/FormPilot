import { RESUME_SCHEMA_VERSION } from '@constants/resume';
import { STORAGE_KEYS } from '@constants/storage';
import { createId } from '@shared/utils/id';
import { getItem, removeItem, setItem } from '@shared/storage/chromeStorage';
import type {
  Resume,
  ResumeFile,
  ResumeMetaInput,
  ResumeVaultSnapshot,
  StoredResumeVault,
} from '@/types/resume';

/**
 * Resume Vault persistence service.
 *
 * Owns how the vault is read from and written to storage: defaulting, defensive
 * normalisation of untrusted persisted data, schema versioning, timestamps, and
 * the invariant that `defaultResumeId` always points at a resume that exists (or
 * is null). UI and hooks depend on this — never on the raw storage wrapper — so
 * the storage shape stays an implementation detail. Every mutation is a
 * read-modify-write of the whole vault, keeping the persisted document
 * internally consistent.
 */

function nowIso(): string {
  return new Date().toISOString();
}

/** Coerce one unknown entry into a {@link ResumeFile}, or `null` if unusable. */
function normaliseFile(raw: unknown): ResumeFile | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as Record<string, unknown>;

  const dataUrl = record.dataUrl;
  // The bytes are the whole point of a stored resume; without them it is junk.
  if (typeof dataUrl !== 'string' || dataUrl === '') return null;

  const name = typeof record.name === 'string' ? record.name : 'resume';
  const mimeType = typeof record.mimeType === 'string' ? record.mimeType : '';
  const size = typeof record.size === 'number' && Number.isFinite(record.size) ? record.size : 0;

  return { name, mimeType, size, dataUrl };
}

/** Coerce one unknown entry into a {@link Resume}, or `null` if unusable. */
function normaliseResume(raw: unknown): Resume | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as Record<string, unknown>;

  const id = record.id;
  if (typeof id !== 'string' || id.trim() === '') return null;

  const file = normaliseFile(record.file);
  if (file === null) return null;

  const name =
    typeof record.name === 'string' && record.name.trim() !== '' ? record.name : file.name;
  const targetRole = typeof record.targetRole === 'string' ? record.targetRole : '';

  const tags: string[] = [];
  if (Array.isArray(record.tags)) {
    for (const tag of record.tags) {
      if (typeof tag === 'string' && tag.trim() !== '') tags.push(tag);
    }
  }

  const createdAt = typeof record.createdAt === 'string' ? record.createdAt : nowIso();
  const updatedAt = typeof record.updatedAt === 'string' ? record.updatedAt : createdAt;

  return { id, name, targetRole, tags, file, createdAt, updatedAt };
}

/**
 * Parse the persisted vault into a normalised snapshot. Drops unusable entries
 * and repairs the default pointer so it always references a surviving resume.
 */
function normaliseVault(raw: unknown): ResumeVaultSnapshot {
  if (typeof raw !== 'object' || raw === null) {
    return { resumes: [], defaultResumeId: null };
  }
  const record = raw as Record<string, unknown>;

  const resumes: Resume[] = [];
  if (Array.isArray(record.resumes)) {
    for (const entry of record.resumes) {
      const resume = normaliseResume(entry);
      if (resume !== null) resumes.push(resume);
    }
  }

  const rawDefault = record.defaultResumeId;
  const requestedDefault = typeof rawDefault === 'string' ? rawDefault : null;
  const defaultResumeId = resolveDefault(resumes, requestedDefault);

  return { resumes, defaultResumeId };
}

/**
 * Choose a valid default id: honour the requested one if it still exists, else
 * fall back to the first resume (or null when the vault is empty). Centralising
 * this keeps the "default always valid" invariant in one place.
 */
function resolveDefault(resumes: readonly Resume[], requested: string | null): string | null {
  if (requested !== null && resumes.some((resume) => resume.id === requested)) {
    return requested;
  }
  return resumes.length > 0 ? resumes[0].id : null;
}

/** Read the current vault, always normalised and internally consistent. */
export async function loadResumeVault(): Promise<ResumeVaultSnapshot> {
  const stored = await getItem<StoredResumeVault>(STORAGE_KEYS.resumes);
  return normaliseVault(stored);
}

/** Persist a snapshot, stamping the current schema version. */
async function persist(snapshot: ResumeVaultSnapshot): Promise<ResumeVaultSnapshot> {
  const envelope: StoredResumeVault = {
    version: RESUME_SCHEMA_VERSION,
    resumes: snapshot.resumes,
    defaultResumeId: snapshot.defaultResumeId,
  };
  await setItem(STORAGE_KEYS.resumes, envelope);
  return snapshot;
}

/** Trim + drop empty tags so stored metadata stays tidy regardless of caller. */
function cleanTags(tags: readonly string[]): string[] {
  const cleaned: string[] = [];
  for (const tag of tags) {
    const trimmed = tag.trim();
    if (trimmed !== '') cleaned.push(trimmed);
  }
  return cleaned;
}

/**
 * Add a resume from an uploaded file payload plus its metadata. The first resume
 * added becomes the default automatically. Returns the updated snapshot.
 */
export async function addResume(
  file: ResumeFile,
  meta: ResumeMetaInput,
): Promise<ResumeVaultSnapshot> {
  const current = await loadResumeVault();
  const timestamp = nowIso();
  const name = meta.name.trim() !== '' ? meta.name.trim() : file.name;

  const resume: Resume = {
    id: createId(),
    name,
    targetRole: meta.targetRole.trim(),
    tags: cleanTags(meta.tags),
    file,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const resumes = [...current.resumes, resume];
  const defaultResumeId = current.defaultResumeId ?? resume.id;
  return persist({ resumes, defaultResumeId });
}

/** Replace a resume's editable metadata (name/role/tags), touching updatedAt. */
export async function updateResumeMeta(
  id: string,
  meta: ResumeMetaInput,
): Promise<ResumeVaultSnapshot> {
  const current = await loadResumeVault();
  const name = meta.name.trim();
  const resumes = current.resumes.map((resume) =>
    resume.id === id
      ? {
          ...resume,
          name: name !== '' ? name : resume.name,
          targetRole: meta.targetRole.trim(),
          tags: cleanTags(meta.tags),
          updatedAt: nowIso(),
        }
      : resume,
  );
  return persist({ resumes, defaultResumeId: current.defaultResumeId });
}

/**
 * Replace a resume's file payload in place (e.g. the user uploaded a newer PDF),
 * preserving its id, name, role, tags, default status, and `createdAt` while
 * refreshing `updatedAt`. A no-op when the id is unknown.
 */
export async function replaceResumeFile(
  id: string,
  file: ResumeFile,
): Promise<ResumeVaultSnapshot> {
  const current = await loadResumeVault();
  const resumes = current.resumes.map((resume) =>
    resume.id === id ? { ...resume, file, updatedAt: nowIso() } : resume,
  );
  return persist({ resumes, defaultResumeId: current.defaultResumeId });
}

/** Convenience wrapper to rename a resume without touching its other metadata. */
export async function renameResume(id: string, name: string): Promise<ResumeVaultSnapshot> {
  const current = await loadResumeVault();
  const trimmed = name.trim();
  const resumes = current.resumes.map((resume) =>
    resume.id === id && trimmed !== ''
      ? { ...resume, name: trimmed, updatedAt: nowIso() }
      : resume,
  );
  return persist({ resumes, defaultResumeId: current.defaultResumeId });
}

/**
 * Delete a resume. If it was the default, the default moves to the first
 * remaining resume (or null when the vault becomes empty).
 */
export async function deleteResume(id: string): Promise<ResumeVaultSnapshot> {
  const current = await loadResumeVault();
  const resumes = current.resumes.filter((resume) => resume.id !== id);
  const defaultResumeId = resolveDefault(resumes, current.defaultResumeId);
  return persist({ resumes, defaultResumeId });
}

/**
 * Mark a resume as the default. A no-op (but still normalised + persisted) when
 * the id is unknown, so the stored default can never point at a missing resume.
 */
export async function setDefaultResume(id: string): Promise<ResumeVaultSnapshot> {
  const current = await loadResumeVault();
  const defaultResumeId = resolveDefault(current.resumes, id);
  return persist({ resumes: current.resumes, defaultResumeId });
}

/** Delete the entire vault, returning to the empty first-run state. */
export async function clearResumeVault(): Promise<void> {
  await removeItem(STORAGE_KEYS.resumes);
}
