/**
 * Core profile domain types for FormPilot AI.
 *
 * The profile is intentionally modelled as a flat `Record` of well-known string
 * fields. Storing every value as a string keeps the shape stable across schema
 * versions, mirrors how form controls surface their values, and sidesteps
 * locale-specific parsing concerns (dates, numbers) at the storage boundary.
 * Presentation/validation semantics live in the field descriptor, not the type.
 */

/** Stable identifiers for every built-in value FormPilot can store and autofill. */
export type ProfileFieldKey =
  | 'fullName'
  | 'firstName'
  | 'lastName'
  | 'dateOfBirth'
  | 'email'
  | 'phone'
  | 'addressLine1'
  | 'addressLine2'
  | 'city'
  | 'state'
  | 'postalCode'
  | 'country'
  | 'college'
  | 'degree'
  | 'branch'
  | 'graduationYear'
  | 'cgpa'
  | 'percentage10'
  | 'percentage12'
  | 'jobTitle'
  | 'company'
  | 'yearsOfExperience'
  | 'skills'
  | 'projects'
  | 'certifications'
  | 'website'
  | 'linkedin'
  | 'github'
  | 'leetcode'
  | 'hackerrank';

/** The persisted profile: exactly one string per known field key. */
export type Profile = Record<ProfileFieldKey, string>;

/**
 * How a field should be presented and validated. This drives the input type,
 * inline validation, and the HTML `autocomplete` token — never website-specific
 * selectors — so the same descriptor serves both the popup UI and, later, the
 * autofill mapping layer.
 */
export type FieldFormat =
  | 'text'
  | 'multiline'
  | 'email'
  | 'tel'
  | 'url'
  | 'postal'
  | 'date'
  | 'number';

/** Logical grouping of fields within the profile form. */
export type ProfileSectionId =
  | 'identity'
  | 'contact'
  | 'address'
  | 'education'
  | 'professional'
  | 'skills'
  | 'links';

/**
 * Website-agnostic hints that let the autofill matcher recognise a web form
 * field as belonging to this profile field. Everything here is *data*, consumed
 * by the scoring matcher — never per-site selectors or field-name branch logic.
 */
export interface MatchHints {
  /** Keyword phrases matched against a control's humanised label/name/id haystack. */
  readonly aliases?: readonly string[];
  /** Standard HTML `autocomplete` tokens that authoritatively identify this field. */
  readonly autocomplete?: readonly string[];
  /** Input `type`s this field owns as a weak fallback (e.g. email → email). */
  readonly inputTypes?: readonly string[];
  /** Phrases that, when present, veto this field (e.g. "username" is not a name). */
  readonly disqualifiers?: readonly string[];
}

/** Declarative description of a single profile field. */
export interface FieldDescriptor {
  readonly key: ProfileFieldKey;
  readonly label: string;
  readonly format: FieldFormat;
  readonly placeholder?: string;
  /** Standard HTML autocomplete token (e.g. 'email', 'address-line1'). */
  readonly autoComplete?: string;
  readonly helpText?: string;
  readonly required?: boolean;
  /** Soft maximum length enforced by validation (defensive, not a hard cap). */
  readonly maxLength?: number;
  /** Autofill matching hints; absent for fields matched by label/autocomplete alone. */
  readonly match?: MatchHints;
}

/** A titled group of field descriptors rendered together in the form. */
export interface ProfileSection {
  readonly id: ProfileSectionId;
  readonly title: string;
  readonly description: string;
  readonly fields: readonly FieldDescriptor[];
}

/**
 * A user-defined field that participates in autofill exactly like a built-in
 * one. Its `label` and `aliases` are the matching phrases; the engine never
 * hardcodes anything about a custom field, so "Father's Name" auto-participates
 * the moment it is saved. Kept flat and string-valued to mirror {@link Profile}.
 */
export interface CustomField {
  /** Stable unique id (also used to key the message target as `custom:<id>`). */
  readonly id: string;
  /** Display name and primary matching phrase (e.g. "Father's Name"). */
  readonly label: string;
  readonly value: string;
  /** Extra keyword phrases that should also match this field (e.g. "guardian name"). */
  readonly aliases: readonly string[];
  /** Disabled fields are kept but excluded from autofill. */
  readonly enabled: boolean;
}

/** Bookkeeping timestamps stored alongside the profile (ISO-8601 strings). */
export interface ProfileMeta {
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * The envelope actually written to chrome.storage.local. `version` lets future
 * releases migrate older payloads instead of silently misreading them. Custom
 * fields live in the same envelope as the built-in profile (one atomic read).
 */
export interface StoredProfile {
  readonly version: number;
  readonly profile: Profile;
  readonly customFields: readonly CustomField[];
  readonly meta: ProfileMeta;
}

/** Result of loading the profile: distinguishes "never saved" from "empty". */
export interface ProfileSnapshot {
  readonly profile: Profile;
  readonly customFields: readonly CustomField[];
  readonly meta: ProfileMeta | null;
  readonly exists: boolean;
}
