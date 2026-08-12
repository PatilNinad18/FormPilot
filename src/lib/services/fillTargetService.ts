import { FIELD_DESCRIPTORS } from '@constants/profile';
import type { FillTarget } from '@shared/autofill/types';
import type { CustomField, Profile } from '@/types/profile';

/**
 * Fill-target construction.
 *
 * Turns the saved data (built-in {@link Profile} + user {@link CustomField}s)
 * into the flat {@link FillTarget}[] the autofill engine consumes. This is the
 * bridge that lets built-in and custom fields share one matching pathway: a
 * built-in field's hints come from its {@link FieldDescriptor.match}, a custom
 * field's from its label + aliases — after this point the engine treats them
 * identically.
 *
 * Runtime-imported by the background worker (which sends the targets to the
 * content script) — never by the content script itself, so `content.js` stays
 * free of the profile constants and remains a self-contained classic bundle.
 */

/** Prefix that namespaces a custom field's id inside the shared target id space. */
export const CUSTOM_TARGET_PREFIX = 'custom:';

/** Build targets for every non-empty built-in profile field. */
function builtInTargets(profile: Profile): FillTarget[] {
  const targets: FillTarget[] = [];
  for (const descriptor of FIELD_DESCRIPTORS) {
    const value = profile[descriptor.key];
    if (typeof value !== 'string' || value.trim() === '') continue;
    const match = descriptor.match ?? {};
    targets.push({
      id: descriptor.key,
      value,
      aliases: match.aliases ?? [],
      autocomplete: match.autocomplete ?? [],
      inputTypes: match.inputTypes ?? [],
      disqualifiers: match.disqualifiers ?? [],
    });
  }
  return targets;
}

/**
 * Build targets for every enabled custom field that has a value. The field's
 * label is always a matching phrase (so "Father's Name" matches without the
 * user configuring anything), joined by any aliases they added.
 */
function customTargets(customFields: readonly CustomField[]): FillTarget[] {
  const targets: FillTarget[] = [];
  for (const field of customFields) {
    if (!field.enabled) continue;
    if (typeof field.value !== 'string' || field.value.trim() === '') continue;
    const aliases = [field.label, ...field.aliases].filter(
      (phrase) => typeof phrase === 'string' && phrase.trim() !== '',
    );
    if (aliases.length === 0) continue;
    targets.push({
      id: `${CUSTOM_TARGET_PREFIX}${field.id}`,
      value: field.value,
      aliases,
      autocomplete: [],
      inputTypes: [],
      disqualifiers: [],
    });
  }
  return targets;
}

/**
 * Assemble the full target list. Built-ins come first so that, on an exact
 * score tie, a standard field wins over a custom one (the matcher breaks ties
 * toward earlier targets).
 */
export function buildFillTargets(
  profile: Profile,
  customFields: readonly CustomField[],
): FillTarget[] {
  return [...builtInTargets(profile), ...customTargets(customFields)];
}
