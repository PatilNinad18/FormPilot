import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Button } from '@components/ui/Button';
import { TextInput } from '@components/ui/TextInput';
import { ACCEPTED_RESUME_EXTENSIONS } from '@constants/resume';
import { useResumes } from '@hooks/useResumes';
import { toErrorMessage } from '@shared/utils/error';
import { readResumeFile } from '@shared/utils/resumeFile';
import type { Resume, ResumeFile } from '@/types/resume';

/**
 * Resume Vault screen.
 *
 * Manages resume *documents* (kept separate from the structured profile): upload
 * PDF/Word files, name them, tag them, mark a default, view, and delete. V1
 * deliberately does not inject files into web upload controls (Chrome forbids
 * it); this is the data + UI foundation for that future flow. All storage goes
 * through {@link useResumes} → the service, never chrome.storage directly.
 */

/** Editable metadata for one resume; tags held as raw comma text while typing. */
interface MetaDraft {
  readonly name: string;
  readonly targetRole: string;
  readonly tagsText: string;
}

function metaDraftFor(resume: Resume): MetaDraft {
  return { name: resume.name, targetRole: resume.targetRole, tagsText: resume.tags.join(', ') };
}

/** Split the tags text into clean, de-duplicated tags. */
function parseTags(text: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of text.split(',')) {
    const trimmed = part.trim();
    if (trimmed === '') continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(trimmed);
  }
  return tags;
}

/** Human-readable file size. */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/** Decode a base64 `data:` URL into a Blob without a network round-trip. */
function dataUrlToBlob(dataUrl: string): Blob {
  const commaIndex = dataUrl.indexOf(',');
  const header = dataUrl.slice(0, commaIndex);
  const base64 = dataUrl.slice(commaIndex + 1);
  const mimeMatch = /data:([^;]+)/.exec(header);
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

/** Open a stored resume in a new tab via a short-lived object URL. */
function openResumeInNewTab(file: ResumeFile): void {
  const url = URL.createObjectURL(dataUrlToBlob(file.dataUrl));
  window.open(url, '_blank', 'noopener');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

const ACCEPT_ATTR = ACCEPTED_RESUME_EXTENSIONS.join(',');

export function ResumeVaultScreen() {
  const {
    resumes,
    defaultResumeId,
    loading,
    status,
    error,
    add,
    updateMeta,
    replaceFile,
    remove,
    makeDefault,
  } = useResumes();
  const [drafts, setDrafts] = useState<Record<string, MetaDraft>>({});
  const [uploadError, setUploadError] = useState<string | null>(null);
  // One hidden file input per row, so "Replace file" can open the OS picker for
  // that specific resume. Chrome forbids scripting a file input's value, but a
  // user-driven pick inside our own popup is fine — we read the chosen file.
  const replaceInputs = useRef<Record<string, HTMLInputElement | null>>({});

  // Re-seed per-resume metadata drafts whenever the vault snapshot changes.
  useEffect(() => {
    const next: Record<string, MetaDraft> = {};
    for (const resume of resumes) {
      next[resume.id] = metaDraftFor(resume);
    }
    setDrafts(next);
  }, [resumes]);

  async function handleUpload(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const input = event.target;
    const files = input.files;
    // Reset immediately so re-picking the same file still fires onChange.
    input.value = '';
    if (!files || files.length === 0) return;
    const file = files[0];
    setUploadError(null);
    try {
      const resumeFile = await readResumeFile(file);
      await add(resumeFile, { name: file.name, targetRole: '', tags: [] });
    } catch (cause: unknown) {
      setUploadError(toErrorMessage(cause));
    }
  }

  // Swap the stored file for an existing resume, keeping its name/role/tags and
  // default status. Same read path as upload; only the payload changes.
  async function handleReplace(id: string, event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const input = event.target;
    const files = input.files;
    input.value = '';
    if (!files || files.length === 0) return;
    const file = files[0];
    setUploadError(null);
    try {
      const resumeFile = await readResumeFile(file);
      await replaceFile(id, resumeFile);
    } catch (cause: unknown) {
      setUploadError(toErrorMessage(cause));
    }
  }

  function patchDraft(id: string, changes: Partial<MetaDraft>): void {
    setDrafts((prev) => {
      const current = prev[id] ?? { name: '', targetRole: '', tagsText: '' };
      return { ...prev, [id]: { ...current, ...changes } };
    });
  }

  async function saveMeta(resume: Resume): Promise<void> {
    const draft = drafts[resume.id] ?? metaDraftFor(resume);
    const name = draft.name.trim() === '' ? resume.file.name : draft.name.trim();
    await updateMeta(resume.id, {
      name,
      targetRole: draft.targetRole.trim(),
      tags: parseTags(draft.tagsText),
    });
  }

  function isDirty(resume: Resume): boolean {
    // A missing draft falls back to the seed, so it reads as "not dirty".
    const draft = drafts[resume.id] ?? metaDraftFor(resume);
    const seed = metaDraftFor(resume);
    return (
      draft.name.trim() !== seed.name ||
      draft.targetRole.trim() !== seed.targetRole ||
      parseTags(draft.tagsText).join(' ') !== resume.tags.join(' ')
    );
  }

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-ink-muted">
        Loading your resumes…
      </div>
    );
  }

  const busy = status === 'working';

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Resume Vault</h2>
          <p className="text-xs text-ink-faint">
            Store PDF or Word resumes on this device. Tag them by role so the right one is ready
            when you apply.
          </p>
        </div>

        <label className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed border-line-strong bg-surface-sunken px-3 py-4 text-center transition-colors hover:border-brand">
          <span className="text-sm font-medium text-ink">Upload a resume</span>
          <span className="text-xs text-ink-faint">PDF, DOC, or DOCX</span>
          <input
            type="file"
            accept={ACCEPT_ATTR}
            className="hidden"
            disabled={busy}
            onChange={handleUpload}
          />
        </label>

        <div aria-live="polite" className="min-h-[16px] text-xs">
          {uploadError ? (
            <span className="text-accent-danger">{uploadError}</span>
          ) : error ? (
            <span className="text-accent-danger">{error}</span>
          ) : null}
        </div>
      </section>

      {resumes.length === 0 ? (
        <p className="rounded-lg bg-surface-sunken px-3 py-3 text-xs text-ink-faint">
          No resumes yet. Upload one above to get started.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {resumes.map((resume) => {
            const draft = drafts[resume.id] ?? metaDraftFor(resume);
            const isDefault = resume.id === defaultResumeId;
            return (
              <li
                key={resume.id}
                className="flex flex-col gap-3 rounded-lg border border-line bg-surface-raised p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink" title={resume.file.name}>
                      {resume.file.name}
                    </p>
                    <p className="text-xs text-ink-faint">{formatSize(resume.file.size)}</p>
                  </div>
                  {isDefault ? (
                    <span className="shrink-0 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">
                      Default
                    </span>
                  ) : null}
                </div>

                <TextInput
                  label="Resume name"
                  value={draft.name}
                  placeholder={resume.file.name}
                  maxLength={120}
                  onChange={(value) => patchDraft(resume.id, { name: value })}
                />
                <TextInput
                  label="Target role"
                  value={draft.targetRole}
                  placeholder="e.g. Backend Engineer"
                  maxLength={120}
                  onChange={(value) => patchDraft(resume.id, { targetRole: value })}
                />
                <TextInput
                  label="Tags"
                  value={draft.tagsText}
                  placeholder="remote, 2025"
                  helpText="Comma-separated labels to help you find this resume later."
                  onChange={(value) => patchDraft(resume.id, { tagsText: value })}
                />

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="primary"
                    disabled={busy || !isDirty(resume)}
                    onClick={() => void saveMeta(resume)}
                  >
                    Save changes
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busy || isDefault}
                    onClick={() => void makeDefault(resume.id)}
                  >
                    {isDefault ? 'Default' : 'Set default'}
                  </Button>
                  <Button variant="ghost" onClick={() => openResumeInNewTab(resume.file)}>
                    View
                  </Button>
                  <input
                    ref={(element) => {
                      replaceInputs.current[resume.id] = element;
                    }}
                    type="file"
                    accept={ACCEPT_ATTR}
                    className="hidden"
                    disabled={busy}
                    onChange={(event) => void handleReplace(resume.id, event)}
                  />
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => replaceInputs.current[resume.id]?.click()}
                  >
                    Replace file
                  </Button>
                  <Button
                    variant="danger"
                    className="ml-auto"
                    disabled={busy}
                    onClick={() => void remove(resume.id)}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
