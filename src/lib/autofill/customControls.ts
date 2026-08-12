import { readCustomControlSignals } from './detect';
import { isVisible, normalizeText, readAttr } from './dom';
import { matchTarget } from './mapping';
import type { PreparedTarget } from './mapping';
import { pickOption } from './normalize';
import type { OptionCandidate } from './normalize';
import type { FieldOutcome, FillableElement } from './types';

/**
 * Custom (ARIA) dropdown support — deliberately conservative.
 *
 * Many sites replace `<select>` with a scripted widget: a `role="combobox"` or
 * `role="listbox"` trigger that reveals `role="option"` elements. FormPilot can
 * fill these, but only within strict safety bounds, because the engine runs
 * synchronously and cannot await a site's async menu rendering:
 *
 *   - We never force a closed menu open. Opening is asynchronous and
 *     site-specific; guessing the trigger risks navigation or broken state. We
 *     act only on options that are *already rendered and visible* (an inline
 *     listbox, or a menu the user already opened).
 *   - We never touch native form controls here — a `role="combobox"` on an
 *     `<input>`/`<select>` is handled by the standard fill path.
 *   - We never overwrite an existing choice: if any option is already
 *     `aria-selected`, the widget is left alone.
 *   - We select only on a confident, unambiguous match, by dispatching a click on
 *     the matched option (the same action a user takes) — never on any other
 *     element. Anything unexpected is swallowed so the page is never broken.
 */

/** Widgets we consider; native inputs carrying these roles are excluded below. */
const CUSTOM_CONTROL_SELECTOR = '[role="combobox"], [role="listbox"]';
const OPTION_SELECTOR = '[role="option"]';

function isFillableElement(el: Element): el is FillableElement {
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLSelectElement ||
    el instanceof HTMLTextAreaElement
  );
}

/**
 * Whether a trigger wraps a *visible* native control. Such a widget is a
 * typeahead whose real input the standard fill path handles, so the custom pass
 * must not also act. A merely hidden backing input (common behind a scripted
 * listbox) does not count — that widget is ours to fill.
 */
function wrapsVisibleFormControl(trigger: Element): boolean {
  for (const node of Array.from(trigger.querySelectorAll('input, select, textarea'))) {
    if (isVisible(node)) return true;
  }
  return false;
}

/** The first element referenced by a space-separated idref list, if present. */
function firstReferenced(scope: Element, idRefs: string): Element | null {
  for (const ref of idRefs.split(/\s+/)) {
    if (ref === '') continue;
    const node = scope.ownerDocument.getElementById(ref);
    if (node !== null) return node;
  }
  return null;
}

/**
 * Locate the element that holds a trigger's options: an `aria-controls`/
 * `aria-owns` target, the trigger itself when it is the listbox, a descendant
 * listbox, or — as a last resort — the trigger (options may be direct children).
 */
function resolveOptionContainer(trigger: Element): Element {
  const owns = readAttr(trigger, 'aria-controls') || readAttr(trigger, 'aria-owns');
  if (owns !== '') {
    const referenced = firstReferenced(trigger, owns);
    if (referenced !== null) return referenced;
  }
  if (trigger.getAttribute('role') === 'listbox') return trigger;
  const descendant = trigger.querySelector<HTMLElement>('[role="listbox"]');
  return descendant ?? trigger;
}

/** Visible option elements inside a container. */
function visibleOptions(container: Element): HTMLElement[] {
  const options: HTMLElement[] = [];
  for (const node of Array.from(container.querySelectorAll<HTMLElement>(OPTION_SELECTOR))) {
    if (isVisible(node)) options.push(node);
  }
  return options;
}

/** An option's matching strings: `data-value`/`aria-label` and its visible text. */
function optionCandidate(option: HTMLElement): OptionCandidate {
  const explicit = readAttr(option, 'data-value') || normalizeText(readAttr(option, 'aria-label'));
  return { value: explicit, text: normalizeText(option.textContent ?? '') };
}

/** Whether any visible option already carries a selection we must not disturb. */
function hasExistingSelection(options: readonly HTMLElement[]): boolean {
  return options.some(
    (option) =>
      option.getAttribute('aria-selected') === 'true' ||
      option.getAttribute('aria-checked') === 'true',
  );
}

/** Select an option the way a user would, tolerating widgets that never break. */
function clickOption(option: HTMLElement): boolean {
  try {
    const init: MouseEventInit = {
      bubbles: true,
      cancelable: true,
      view: option.ownerDocument.defaultView,
    };
    option.dispatchEvent(new MouseEvent('mousedown', init));
    option.dispatchEvent(new MouseEvent('mouseup', init));
    option.click();
    return true;
  } catch {
    return false;
  }
}

/**
 * Evaluate one custom-control trigger: map it to a target and, when safe, select
 * the matching already-visible option. Returns the outcome, or `null` when the
 * element is not actually a fillable custom control (native, hidden, or has no
 * rendered options — a closed menu we decline to force open).
 */
function evaluateTrigger(
  trigger: Element,
  targets: readonly PreparedTarget[],
  consumed: Set<Element>,
): FieldOutcome | null {
  if (isFillableElement(trigger) || !isVisible(trigger)) return null;
  // A combobox wrapping a *visible* input/select is a typeahead: the standard
  // fill path owns that native control, so we don't also click an option here.
  if (wrapsVisibleFormControl(trigger)) return null;

  const container = resolveOptionContainer(trigger);
  if (consumed.has(container)) return null;
  consumed.add(container);

  const options = visibleOptions(container);
  if (options.length === 0) return null;

  const target = matchTarget(readCustomControlSignals(trigger), targets);
  if (target === null) return null;

  if (hasExistingSelection(options)) {
    return { status: 'skipped', id: target.id, reason: 'already-filled' };
  }

  const option = pickOption(options, optionCandidate, target.value);
  if (option === null) return { status: 'skipped', id: target.id, reason: 'no-match' };

  if (!clickOption(option)) return { status: 'skipped', id: target.id, reason: 'no-match' };
  return { status: 'filled', id: target.id, reason: null };
}

/**
 * Run the custom-control pass over `root`. Comboboxes are considered before
 * standalone listboxes, and each option container is handled once, so a
 * combobox and the listbox it owns are never filled twice.
 */
export function evaluateCustomControls(
  root: ParentNode,
  targets: readonly PreparedTarget[],
): FieldOutcome[] {
  const triggers = Array.from(root.querySelectorAll<HTMLElement>(CUSTOM_CONTROL_SELECTOR));
  triggers.sort((a, b) => optionContainerRank(a) - optionContainerRank(b));

  const consumed = new Set<Element>();
  const outcomes: FieldOutcome[] = [];
  for (const trigger of triggers) {
    const outcome = evaluateTrigger(trigger, targets, consumed);
    if (outcome !== null) outcomes.push(outcome);
  }
  return outcomes;
}

/** Sort key: comboboxes (0) are resolved before bare listboxes (1). */
function optionContainerRank(el: Element): number {
  return el.getAttribute('role') === 'combobox' ? 0 : 1;
}
