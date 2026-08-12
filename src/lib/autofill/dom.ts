import type { FillableElement } from './types';

/**
 * Framework-free DOM helpers for the autofill engine.
 *
 * Every function here depends on nothing but the DOM, so this module can be
 * bundled into the content script without pulling in shared runtime code. The
 * helpers answer three questions the engine needs: which controls exist, what
 * state each is in (visible / disabled / readonly / already-filled), and what
 * human-readable signals surround it (label, attributes).
 */

/** Selector matching the three controls FormPilot can read and fill. */
const CONTROL_SELECTOR = 'input, select, textarea';

/**
 * Input `type`s we never fill: they are non-textual, action-only, security
 * sensitive, or (for `hidden`) explicitly out of scope per the privacy rules.
 */
const NON_FILLABLE_INPUT_TYPES: ReadonlySet<string> = new Set([
  'hidden',
  'password',
  'submit',
  'button',
  'reset',
  'image',
  'file',
]);

/** Collapse runs of whitespace and trim, preserving case. */
export function normalizeText(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

/**
 * Reduce an identifier or free-text string to lowercase space-separated
 * keywords: camelCase is split, and any non-alphanumeric run becomes a single
 * space. `user_firstName` and `First Name:` both become `user first name` /
 * `first name`, giving mapping a stable haystack to match against.
 */
export function compactToken(raw: string): string {
  return raw
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Read an attribute as a trimmed string ('' when absent). */
export function readAttr(el: Element, name: string): string {
  return (el.getAttribute(name) ?? '').trim();
}

/** The engine's control classifier: 'select', 'textarea', or the input type. */
export function getControlType(el: FillableElement): string {
  if (el instanceof HTMLSelectElement) return 'select';
  if (el instanceof HTMLTextAreaElement) return 'textarea';
  return el.type.toLowerCase();
}

/** Gather every fillable control under `root`, excluding non-fillable inputs. */
export function collectControls(root: ParentNode): FillableElement[] {
  const nodes = root.querySelectorAll<FillableElement>(CONTROL_SELECTOR);
  const controls: FillableElement[] = [];
  for (const el of Array.from(nodes)) {
    if (
      el instanceof HTMLInputElement &&
      NON_FILLABLE_INPUT_TYPES.has(el.type.toLowerCase())
    ) {
      continue;
    }
    controls.push(el);
  }
  return controls;
}

/**
 * Whether an element is rendered. Elements with no layout boxes (display:none,
 * the `hidden` attribute, or a hidden ancestor) report no client rects; we also
 * reject `visibility: hidden` / `collapse`, which keep a box but stay invisible.
 * Accepts any element so custom-widget options can be filtered the same way.
 */
export function isVisible(el: Element): boolean {
  if (el.getClientRects().length === 0) return false;
  const style = el.ownerDocument.defaultView?.getComputedStyle(el);
  if (style === undefined) return true;
  return style.visibility !== 'hidden' && style.visibility !== 'collapse';
}

/** Whether the control is disabled, including via an ancestor `fieldset`. */
export function isDisabled(el: FillableElement): boolean {
  return el.matches(':disabled');
}

/** Whether the control rejects edits. `select` has no readonly concept. */
export function isReadonly(el: FillableElement): boolean {
  if (el instanceof HTMLSelectElement) return false;
  return el.readOnly;
}

/** Whether a text-like control already holds a user value we must not clobber. */
export function isTextControlFilled(el: HTMLInputElement | HTMLTextAreaElement): boolean {
  return el.value.trim() !== '';
}

/**
 * Whether a select already has a meaningful choice. A non-empty value on the
 * first option is treated as an unconfirmed placeholder (e.g. "-- Select --"),
 * so only a selection past index 0 counts as user-provided.
 */
export function isSelectFilled(select: HTMLSelectElement): boolean {
  const option = select.selectedOptions.item(0);
  if (option === null || option.disabled) return false;
  if (option.value.trim() === '') return false;
  return select.selectedIndex > 0;
}

/** Join the text of the elements referenced by an idref list (space-separated). */
export function referencedText(scope: Element, idRefs: string | null): string {
  if (idRefs === null) return '';
  const doc = scope.ownerDocument;
  const parts: string[] = [];
  for (const ref of idRefs.split(/\s+/)) {
    if (ref === '') continue;
    const node = doc.getElementById(ref);
    if (node !== null) parts.push(node.textContent ?? '');
  }
  return normalizeText(parts.join(' '));
}

/**
 * Resolve the visible label for a control. `aria-labelledby` wins (explicit
 * author intent); otherwise the native `labels` list covers both
 * `<label for>` and wrapping `<label>` associations.
 */
export function resolveLabel(el: FillableElement): string {
  const aria = referencedText(el, el.getAttribute('aria-labelledby'));
  if (aria !== '') return aria;

  const labels = el.labels;
  if (labels === null) return '';
  const parts: string[] = [];
  for (const label of Array.from(labels)) {
    parts.push(label.textContent ?? '');
  }
  return normalizeText(parts.join(' '));
}

/**
 * Resolve the field-level label of the *group* enclosing a control, if any.
 *
 * Option controls carry only their own option label — a radio reads "Yes", a
 * grouped checkbox reads "English" — while the question they answer ("Consent",
 * "Languages") lives on the container. We look to an ARIA grouping role
 * (`radiogroup` / `group`) via its `aria-labelledby` or `aria-label`, then to a
 * `<fieldset>`'s `<legend>`. Returns '' when the control is not grouped, so
 * callers can fall back to the control's own label.
 */
export function resolveGroupLabel(el: Element): string {
  const group = el.closest('[role="radiogroup"], [role="group"]');
  if (group !== null) {
    const labelledBy = referencedText(group, group.getAttribute('aria-labelledby'));
    if (labelledBy !== '') return labelledBy;
    const ariaLabel = normalizeText(readAttr(group, 'aria-label'));
    if (ariaLabel !== '') return ariaLabel;
  }

  const fieldset = el.closest('fieldset');
  if (fieldset !== null) {
    const legend = fieldset.querySelector('legend');
    if (legend !== null) {
      const text = normalizeText(legend.textContent ?? '');
      if (text !== '') return text;
    }
  }

  return '';
}
