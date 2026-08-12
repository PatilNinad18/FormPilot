/**
 * Namespaced keys for everything FormPilot persists in chrome.storage.local.
 *
 * Keys are dotted and product-prefixed so the extension never collides with
 * other data and its storage footprint is easy to audit. Add new keys here so
 * there is a single, greppable source of truth.
 */
export const STORAGE_KEYS = {
  /** The user's saved profile envelope ({@link StoredProfile}). */
  profile: 'formpilot.profile.v1',
  /** The resume vault envelope ({@link StoredResumeVault}). */
  resumes: 'formpilot.resumes.v1',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
