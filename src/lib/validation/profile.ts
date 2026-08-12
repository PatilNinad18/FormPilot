import { FIELD_DESCRIPTORS } from '@constants/profile';
import type { FieldDescriptor, Profile, ProfileFieldKey } from '@/types/profile';

/**
 * Profile validation.
 *
 * Rules are derived from each {@link FieldDescriptor} (format, required,
 * maxLength) so validation stays in lockstep with the schema — adding a field
 * in constants/profile.ts needs no change here. Every field in the MVP is
 * optional, so an empty value always passes; format checks apply only to
 * non-empty input. Patterns are intentionally permissive: the goal is to catch
 * obvious mistakes, not to reject unusual-but-valid real-world values.
 */

/** Per-field validation outcome, keyed by field. Absent key = valid. */
export type FieldErrors = Partial<Record<ProfileFieldKey, string>>;

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: FieldErrors;
}

// Deliberately lenient: local-part@domain.tld with no whitespace.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Digits with common separators; requires at least a few digits to be meaningful.
const PHONE_PATTERN = /^[+]?[\d][\d\s().-]{4,}$/;
// Letters/digits with common postal separators.
const POSTAL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\s-]{1,11}$/;

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate a single value against its descriptor. Returns an error message, or
 * `null` when the value is acceptable.
 */
export function validateValue(descriptor: FieldDescriptor, rawValue: string): string | null {
  const value = rawValue.trim();

  if (value === '') {
    return descriptor.required ? `${descriptor.label} is required.` : null;
  }

  if (descriptor.maxLength !== undefined && value.length > descriptor.maxLength) {
    return `${descriptor.label} must be ${descriptor.maxLength} characters or fewer.`;
  }

  if (descriptor.format === 'email' && !EMAIL_PATTERN.test(value)) {
    return 'Enter a valid email address.';
  }
  if (descriptor.format === 'tel' && !PHONE_PATTERN.test(value)) {
    return 'Enter a valid phone number.';
  }
  if (descriptor.format === 'url' && !isValidUrl(value)) {
    return 'Enter a valid URL (including https://).';
  }
  if (descriptor.format === 'postal' && !POSTAL_PATTERN.test(value)) {
    return 'Enter a valid ZIP / PIN code.';
  }

  return null;
}

/** Validate the whole profile, returning an error map and an overall flag. */
export function validateProfile(profile: Profile): ValidationResult {
  const errors: FieldErrors = {};
  for (const descriptor of FIELD_DESCRIPTORS) {
    const message = validateValue(descriptor, profile[descriptor.key]);
    if (message !== null) {
      errors[descriptor.key] = message;
    }
  }
  return { valid: Object.keys(errors).length === 0, errors };
}
