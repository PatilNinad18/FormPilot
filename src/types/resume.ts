/**
 * Resume Vault domain types for FormPilot AI.
 *
 * A resume is a *document*, deliberately kept separate from the structured
 * profile: the user may keep several (e.g. one per target role), each stored as
 * a self-contained record with its file payload and light metadata. V1 only
 * models and stores this data and its UI — it does not attempt to inject files
 * into web upload controls (Chrome forbids programmatic file input), so nothing
 * here touches the DOM or requires new permissions.
 */

/**
 * The stored file payload for a resume. The bytes are held as a base64 data URL
 * so the whole vault round-trips through chrome.storage.local as plain JSON.
 */
export interface ResumeFile {
  /** Original file name, e.g. "ada-backend.pdf". */
  readonly name: string;
  /** MIME type, e.g. "application/pdf". */
  readonly mimeType: string;
  /** Size in bytes of the original file (for display; not recomputed from data). */
  readonly size: number;
  /** The file contents as a `data:` URL (base64). Kept local; never uploaded. */
  readonly dataUrl: string;
}

/** A single resume document plus the metadata used to pick the right one later. */
export interface Resume {
  readonly id: string;
  /** User-facing name for this resume (defaults to the file name on upload). */
  readonly name: string;
  /** Optional role this resume is tailored for, e.g. "Backend Engineer". */
  readonly targetRole: string;
  /** Optional free-form tags, e.g. ["remote", "2025"]. */
  readonly tags: readonly string[];
  readonly file: ResumeFile;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** The envelope written to chrome.storage.local for the resume vault. */
export interface StoredResumeVault {
  readonly version: number;
  readonly resumes: readonly Resume[];
  /** Id of the resume marked default, or null when none/na. */
  readonly defaultResumeId: string | null;
}

/** Result of loading the vault: the resumes plus which one is the default. */
export interface ResumeVaultSnapshot {
  readonly resumes: readonly Resume[];
  readonly defaultResumeId: string | null;
}

/** The editable metadata fields of a resume (everything but id/file/timestamps). */
export interface ResumeMetaInput {
  readonly name: string;
  readonly targetRole: string;
  readonly tags: readonly string[];
}
