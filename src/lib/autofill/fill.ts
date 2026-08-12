import { normalizeText, resolveLabel } from './dom';
import {
  isAffirmative,
  normalizeValue,
  optionMatchTier,
  pickOption,
  splitValues,
} from './normalize';
import type { OptionCandidate } from './normalize';
import type { FillableElement } from './types';

/**
 * Value writing.
 *
 * Frameworks such as React track a control's value on the element instance and
 * ignore plain `el.value = x` assignments, so we write through the *native*
 * prototype setter and then dispatch bubbling `input` + `change` events — the
 * combination every major framework and vanilla listener reacts to. Each
 * strategy returns whether it actually changed the DOM, so the engine can tell
 * a real fill from a no-op.
 */

/** The prototype that owns the real `value` setter for a control. */
function valuePrototype(el: FillableElement): object {
  if (el instanceof HTMLInputElement) return HTMLInputElement.prototype;
  if (el instanceof HTMLTextAreaElement) return HTMLTextAreaElement.prototype;
  return HTMLSelectElement.prototype;
}

/** Assign through the native setter so framework value-tracking is bypassed. */
function setNativeValue(el: FillableElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(valuePrototype(el), 'value')?.set;
  if (setter !== undefined) {
    setter.call(el, value);
  } else {
    el.value = value;
  }
}

/** Assign a checkbox/radio `checked` state through the native setter. */
function setNativeChecked(el: HTMLInputElement, checked: boolean): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked')?.set;
  if (setter !== undefined) {
    setter.call(el, checked);
  } else {
    el.checked = checked;
  }
}

/** Fire the events that notify frameworks and native listeners of an edit. */
function dispatchInputAndChange(el: FillableElement): void {
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Fill a text input or textarea. No-op when the value already matches. */
function fillTextControl(el: HTMLInputElement | HTMLTextAreaElement, value: string): boolean {
  if (el.value === value) return false;
  setNativeValue(el, value);
  dispatchInputAndChange(el);
  return true;
}

/** An option's identifying strings for conservative value matching. */
function optionCandidate(option: HTMLOptionElement): OptionCandidate {
  return { value: option.value, text: normalizeText(option.textContent ?? '') };
}

/** Selectable (non-disabled) options of a select, in document order. */
function selectableOptions(select: HTMLSelectElement): HTMLOptionElement[] {
  return Array.from(select.options).filter((option) => !option.disabled);
}

/**
 * Fill a native `<select>`. Single selects choose the one confidently-matching
 * option (skipping ambiguous ones); `<select multiple>` selects every option
 * that matches a listed value without ever clearing the user's existing picks.
 */
function fillSelect(select: HTMLSelectElement, value: string): boolean {
  if (select.multiple) return fillMultiSelect(select, value);
  const option = pickOption(selectableOptions(select), optionCandidate, value);
  if (option === null) return false;
  if (select.value === option.value) return false;
  setNativeValue(select, option.value);
  dispatchInputAndChange(select);
  return true;
}

/** Add each matching option to a multi-select; never deselect existing picks. */
function fillMultiSelect(select: HTMLSelectElement, value: string): boolean {
  const options = selectableOptions(select);
  let changed = false;
  for (const item of splitValues(value)) {
    const option = pickOption(options, optionCandidate, item);
    if (option === null || option.selected) continue;
    option.selected = true;
    changed = true;
  }
  if (!changed) return false;
  dispatchInputAndChange(select);
  return true;
}

/**
 * Whether a checkbox carries only a generic truthy value ("on", "true", "1", or
 * none) rather than a specific option value. Such a box is a boolean consent box
 * whose meaning comes from its label, so an affirmative stored value should tick
 * it; a box with a specific value (e.g. "English") is a multi-select member and
 * is only ticked when that value is explicitly listed.
 */
function checkboxIsBoolean(el: HTMLInputElement): boolean {
  const value = normalizeValue(el.value);
  return value === '' || isAffirmative(value);
}

/**
 * Tick a checkbox when — and only when — there is a confident reason to. A box is
 * checked if its own value/label *strongly* matches one of the listed stored
 * values (multi-select group), or if it is a boolean box and the stored value is
 * affirmative. Already-checked boxes are left alone: we never uncheck a box the
 * user (or page) set, and never guess on a weak match.
 */
function fillCheckbox(el: HTMLInputElement, value: string): boolean {
  if (el.checked) return false;
  const candidate: OptionCandidate = { value: el.value, text: resolveLabel(el) };

  let shouldCheck = false;
  for (const item of splitValues(value)) {
    if (optionMatchTier(candidate, item) === 'strong') {
      shouldCheck = true;
      break;
    }
  }
  if (!shouldCheck && checkboxIsBoolean(el) && isAffirmative(value)) {
    shouldCheck = true;
  }
  if (!shouldCheck) return false;

  setNativeChecked(el, true);
  dispatchInputAndChange(el);
  return true;
}

/** A radio's identifying strings: its own value and its resolved option label. */
function radioCandidate(radio: HTMLInputElement): OptionCandidate {
  return { value: radio.value, text: resolveLabel(radio) };
}

/**
 * Select the radio in a group that confidently matches `value`. The group is
 * left untouched if any radio is already selected (never override a user or page
 * choice) or if no single option matches without ambiguity.
 */
export function fillRadioGroup(radios: readonly HTMLInputElement[], value: string): boolean {
  if (radios.length === 0) return false;
  if (radios.some((radio) => radio.checked)) return false;
  const option = pickOption(radios, radioCandidate, value);
  if (option === null) return false;
  setNativeChecked(option, true);
  dispatchInputAndChange(option);
  return true;
}

/**
 * Fill a single control with `value`, dispatching the right strategy for its
 * type. Radio *groups* are filled via {@link fillRadioGroup}; a stray lone
 * radio is handled here as a one-member group. Returns whether the DOM changed.
 */
export function fillControl(el: FillableElement, value: string): boolean {
  if (el instanceof HTMLSelectElement) return fillSelect(el, value);
  if (el instanceof HTMLTextAreaElement) return fillTextControl(el, value);

  const type = el.type.toLowerCase();
  if (type === 'checkbox') return fillCheckbox(el, value);
  if (type === 'radio') return fillRadioGroup([el], value);
  return fillTextControl(el, value);
}
