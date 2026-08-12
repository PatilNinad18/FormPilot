import { createEmptyProfile, PROFILE_FIELD_KEYS, PROFILE_SCHEMA_VERSION } from '@constants/profile';
import { STORAGE_KEYS } from '@constants/storage';
import type { CustomField, Profile, ProfileSnapshot, StoredProfile } from '@/types/profile';
import { getItem, removeItem, setItem } from '@shared/storage/chromeStorage';

/**
 * Profile persistence service.
 *
 * Owns everything about how the profile is read from and written to storage:
 * defaulting, defensive normalisation of untrusted persisted data, schema
 * versioning, and timestamps. UI and hooks depend on this — never on the raw
 * storage wrapper — so the storage shape stays an implementation detail. The
 * built-in profile and the user's custom fields share one envelope so a load or
 * save is a single atomic operation.
 */

/**
 * Coerce an unknown persisted value into a valid {@link Profile}.
 *
 * Storage can contain data written by an older build, hand-edited values, or
 * corruption. We therefore start from a known-empty profile and copy over only
 * recognised keys whose values are strings, guaranteeing a complete, correctly
 * shaped object regardless of what was on disk. Older envelopes that predate the
 * extended fields simply leave the new keys at their empty default.
 */
function normaliseProfile(raw: unknown): Profile {
  const profile = createEmptyProfile();
  if (typeof raw !== 'object' || raw === null) {
    return profile;
  }
  const record = raw as Record<string, unknown>;
  for (const key of PROFILE_FIELD_KEYS) {
    const value = record[key];
    if (typeof value === 'string') {
      profile[key] = value;
    }
  }
  return profile;
}

/** Coerce one unknown entry into a {@link CustomField}, or `null` if unusable. */
function normaliseCustomField(raw: unknown): CustomField | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as Record<string, unknown>;

  const id = record.id;
  if (typeof id !== 'string' || id.trim() === '') return null;

  const label = typeof record.label === 'string' ? record.label : '';
  const value = typeof record.value === 'string' ? record.value : '';

  const aliases: string[] = [];
  if (Array.isArray(record.aliases)) {
    for (const alias of record.aliases) {
      if (typeof alias === 'string' && alias.trim() !== '') aliases.push(alias);
    }
  }

  // Absent flag defaults to enabled so pre-existing/hand-written data still fills.
  const enabled = record.enabled === false ? false : true;

  return { id, label, value, aliases, enabled };
}

/** Defensively parse the persisted custom-field list (absent/garbage → []). */
function normaliseCustomFields(raw: unknown): CustomField[] {
  if (!Array.isArray(raw)) return [];
  const fields: CustomField[] = [];
  for (const entry of raw) {
    const field = normaliseCustomField(entry);
    if (field !== null) fields.push(field);
  }
  return fields;
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Load the saved profile.
 *
 * Returns a snapshot that distinguishes "never saved" (`exists: false`, a fresh
 * empty profile and no custom fields) from a previously stored one, so the UI
 * can show the right first-run affordance.
 */
export async function loadProfile(): Promise<ProfileSnapshot> {
  const stored = await getItem<StoredProfile>(STORAGE_KEYS.profile);
  if (!stored || typeof stored !== 'object') {
    return { profile: createEmptyProfile(), customFields: [], meta: null, exists: false };
  }
  const profile = normaliseProfile(stored.profile);
  const customFields = normaliseCustomFields(stored.customFields);
  const createdAt = typeof stored.meta?.createdAt === 'string' ? stored.meta.createdAt : nowIso();
  const updatedAt = typeof stored.meta?.updatedAt === 'string' ? stored.meta.updatedAt : createdAt;
  return { profile, customFields, meta: { createdAt, updatedAt }, exists: true };
}

/**
 * Persist the profile and custom fields, preserving the original `createdAt`
 * while refreshing `updatedAt`. Values are normalised on the way in so a partial
 * object from a caller still yields a complete, valid stored envelope. Returns
 * the snapshot as persisted.
 */
export async function saveProfile(
  input: Profile,
  customFields: readonly CustomField[],
): Promise<ProfileSnapshot> {
  const existing = await getItem<StoredProfile>(STORAGE_KEYS.profile);
  const createdAt =
    existing && typeof existing.meta?.createdAt === 'string' ? existing.meta.createdAt : nowIso();
  const meta = { createdAt, updatedAt: nowIso() };
  const profile = normaliseProfile(input);
  const normalisedCustomFields = normaliseCustomFields(customFields);

  const envelope: StoredProfile = {
    version: PROFILE_SCHEMA_VERSION,
    profile,
    customFields: normalisedCustomFields,
    meta,
  };
  await setItem(STORAGE_KEYS.profile, envelope);
  return { profile, customFields: normalisedCustomFields, meta, exists: true };
}

/** Delete the saved profile entirely, returning to the first-run empty state. */
export async function clearProfile(): Promise<void> {
  await removeItem(STORAGE_KEYS.profile);
}
