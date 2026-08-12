import {
  compactToken,
  getControlType,
  normalizeText,
  readAttr,
  referencedText,
  resolveGroupLabel,
  resolveLabel,
} from './dom';
import type { FieldSignals, FillableElement } from './types';

/** Control-type sentinel for custom ARIA widgets, matched by alias only. */
export const CUSTOM_CONTROL_TYPE = 'custom-combobox';

/**
 * Signal extraction.
 *
 * Detection turns a raw control into the website-agnostic {@link FieldSignals}
 * that mapping consumes. Human-readable attributes are collected in their
 * original case first (so camelCase identifiers such as `firstName` split into
 * keywords) and lowercased for storage; the `autocomplete` token keeps its
 * hyphens intact so it can be matched against the standard token vocabulary.
 */

/** Build the space-separated keyword haystack from raw signal strings. */
function buildHaystack(values: readonly string[]): string {
  const parts: string[] = [];
  for (const value of values) {
    const token = compactToken(value);
    if (token !== '') parts.push(token);
  }
  return parts.join(' ');
}

/** Lowercase an `autocomplete` value while preserving its token hyphens. */
function normalizeAutocomplete(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * The field-identifying label for a control. Most controls use their own label,
 * but a *grouped* checkbox carries an option label ("English") whose field
 * identity ("Languages") lives on the enclosing group. When such a group label
 * exists we use it instead, so the option text never masquerades as the field
 * name — mirroring how radio groups are labelled. A lone consent checkbox has no
 * group, so it keeps its own label.
 */
function resolveFieldLabel(el: FillableElement, controlType: string): string {
  if (controlType === 'checkbox') {
    const groupLabel = resolveGroupLabel(el);
    if (groupLabel !== '') return groupLabel;
  }
  return resolveLabel(el);
}

/** Read the full signal set from a single control. */
export function readSignals(el: FillableElement): FieldSignals {
  const nameRaw = readAttr(el, 'name');
  const idRaw = readAttr(el, 'id');
  const placeholderRaw = normalizeText(readAttr(el, 'placeholder'));
  const ariaLabelRaw = normalizeText(readAttr(el, 'aria-label'));
  const controlType = getControlType(el);
  const labelRaw = resolveFieldLabel(el, controlType);

  return {
    autocomplete: normalizeAutocomplete(readAttr(el, 'autocomplete')),
    name: nameRaw.toLowerCase(),
    id: idRaw.toLowerCase(),
    placeholder: placeholderRaw.toLowerCase(),
    ariaLabel: ariaLabelRaw.toLowerCase(),
    label: labelRaw.toLowerCase(),
    controlType,
    haystack: buildHaystack([nameRaw, idRaw, placeholderRaw, ariaLabelRaw, labelRaw]),
  };
}

/**
 * Signals for a radio group, keyed off the shared `name` plus the group label.
 * Per-option labels are intentionally excluded from the haystack: they describe
 * the values, not the field, and would pollute mapping.
 */
export function readRadioGroupSignals(
  name: string,
  radios: readonly HTMLInputElement[],
): FieldSignals {
  const base = {
    autocomplete: '',
    name: name.toLowerCase(),
    id: '',
    placeholder: '',
    controlType: 'radio',
  } as const;

  if (radios.length === 0) {
    return { ...base, ariaLabel: '', label: '', haystack: buildHaystack([name]) };
  }

  const first = radios[0];
  const groupLabel = resolveGroupLabel(first);
  const ariaLabelRaw = normalizeText(readAttr(first, 'aria-label'));

  return {
    ...base,
    ariaLabel: ariaLabelRaw.toLowerCase(),
    label: groupLabel.toLowerCase(),
    haystack: buildHaystack([name, groupLabel, ariaLabelRaw]),
  };
}

/**
 * Resolve the visible label of a *non-form* ARIA element (a custom combobox is a
 * `<div>`/`<button>`, so it has no `labels` collection). Tries `aria-labelledby`,
 * then `aria-label`, then an enclosing group label, then a wrapping `<label>`.
 */
function resolveAriaLabel(el: Element): string {
  const labelledBy = referencedText(el, el.getAttribute('aria-labelledby'));
  if (labelledBy !== '') return labelledBy;

  const ariaLabel = normalizeText(readAttr(el, 'aria-label'));
  if (ariaLabel !== '') return ariaLabel;

  const groupLabel = resolveGroupLabel(el);
  if (groupLabel !== '') return groupLabel;

  const wrappingLabel = el.closest('label');
  if (wrappingLabel !== null) {
    const text = normalizeText(wrappingLabel.textContent ?? '');
    if (text !== '') return text;
  }

  return '';
}

/**
 * Signals for a custom ARIA widget (combobox/listbox trigger). It exposes no
 * browser autocomplete or input `type`, so matching leans on its accessible
 * label, name/id, and any `aria-*` description — the same haystack machinery,
 * fed from element attributes rather than a form control.
 */
export function readCustomControlSignals(el: Element): FieldSignals {
  const nameRaw = readAttr(el, 'name');
  const idRaw = readAttr(el, 'id');
  const ariaLabelRaw = resolveAriaLabel(el);

  return {
    autocomplete: '',
    name: nameRaw.toLowerCase(),
    id: idRaw.toLowerCase(),
    placeholder: '',
    ariaLabel: ariaLabelRaw.toLowerCase(),
    label: ariaLabelRaw.toLowerCase(),
    controlType: CUSTOM_CONTROL_TYPE,
    haystack: buildHaystack([nameRaw, idRaw, ariaLabelRaw]),
  };
}
