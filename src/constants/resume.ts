/**
 * Resume Vault constants.
 *
 * Kept separate from the profile constants because the vault is an independent
 * feature with its own storage envelope and schema lifecycle.
 */

/** Schema version for the persisted {@link StoredResumeVault} envelope. */
export const RESUME_SCHEMA_VERSION = 1;

/**
 * Per-file size ceiling. chrome.storage.local allows ~10MB total without the
 * `unlimitedStorage` permission (which V1 deliberately does not request), and a
 * base64 data URL inflates bytes by ~33%, so we cap a single resume well under
 * that to leave room for several. Enforced by the service on add.
 */
export const MAX_RESUME_BYTES = 2 * 1024 * 1024;

/** Accepted resume file types, used for the file picker and validation. */
export const ACCEPTED_RESUME_MIME_TYPES: readonly string[] = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

/** File-extension fallback for pickers/validation when MIME type is absent. */
export const ACCEPTED_RESUME_EXTENSIONS: readonly string[] = ['.pdf', '.doc', '.docx'];

/**
 * Keyword phrases that identify a resume/CV *upload* field on a web page. Passed
 * to the content script so a file input can be recognised through the same
 * alias-matching the engine uses for every other field — never per-site
 * selectors. Kept broad but resume-specific so it does not flag unrelated file
 * inputs (e.g. a profile photo or a cover-letter upload).
 */
export const RESUME_FIELD_ALIASES: readonly string[] = [
  'resume',
  'resume upload',
  'upload resume',
  'attach resume',
  'cv',
  'cv upload',
  'upload cv',
  'attach cv',
  'curriculum vitae',
  'resume cv',
  'resume or cv',
];

