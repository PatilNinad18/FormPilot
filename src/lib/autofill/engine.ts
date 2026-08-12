import { readRadioGroupSignals, readSignals } from './detect';
import { evaluateCustomControls } from './customControls';
import {
  collectControls,
  isDisabled,
  isReadonly,
  isSelectFilled,
  isTextControlFilled,
  isVisible,
} from './dom';
import { fillControl, fillRadioGroup } from './fill';
import { matchTarget, prepareTargets } from './mapping';
import type { PreparedTarget } from './mapping';
import { markResumeUploadFields } from './resumeField';
import type {
  FieldOutcome,
  FillableElement,
  FillSummary,
  FillTarget,
  ResumeUploadHint,
  SkipReason,
} from './types';

/**
 * Autofill orchestration.
 *
 * `runAutofill` is the engine's single entry point: it collects controls under
 * a root, groups radios, and for each control (or group) applies the skip rules
 * — hidden, disabled, readonly, already-filled — before matching a
 * {@link FillTarget} and writing its value. The result is an aggregate
 * {@link FillSummary} the content script surfaces as user feedback.
 *
 * The engine is fully data-driven: the caller passes the target list (built
 * from profile descriptors and user custom fields), so the engine itself knows
 * nothing about specific fields.
 */

/** Skip reasons that represent a *mapped* control we deliberately left alone. */
const COUNTED_SKIPS: ReadonlySet<SkipReason> = new Set([
  'hidden',
  'disabled',
  'readonly',
  'already-filled',
]);

interface GroupedControls {
  readonly singles: readonly FillableElement[];
  readonly radioGroups: readonly (readonly HTMLInputElement[])[];
}

function skip(id: string | null, reason: SkipReason): FieldOutcome {
  return { status: 'skipped', id, reason };
}

function isRadio(el: FillableElement): el is HTMLInputElement {
  return el instanceof HTMLInputElement && el.type.toLowerCase() === 'radio';
}

/**
 * Split controls into standalone fields and radio groups. Radios are grouped by
 * their owning form *and* shared `name` (two forms may both use `gender`); a
 * radio with no name becomes its own single-member group.
 */
function groupControls(controls: readonly FillableElement[]): GroupedControls {
  const singles: FillableElement[] = [];
  const radioGroups: HTMLInputElement[][] = [];
  const byForm = new Map<HTMLFormElement | null, Map<string, HTMLInputElement[]>>();

  for (const el of controls) {
    if (!isRadio(el)) {
      singles.push(el);
      continue;
    }
    if (el.name === '') {
      radioGroups.push([el]);
      continue;
    }
    let names = byForm.get(el.form);
    if (names === undefined) {
      names = new Map();
      byForm.set(el.form, names);
    }
    const existing = names.get(el.name);
    if (existing === undefined) {
      names.set(el.name, [el]);
    } else {
      existing.push(el);
    }
  }

  for (const names of byForm.values()) {
    for (const list of names.values()) {
      radioGroups.push(list);
    }
  }

  return { singles, radioGroups };
}

/** Whether a control already holds a value FormPilot must not overwrite. */
function isAlreadyFilled(el: FillableElement): boolean {
  if (el instanceof HTMLSelectElement) return isSelectFilled(el);
  if (el instanceof HTMLTextAreaElement) return isTextControlFilled(el);
  const type = el.type.toLowerCase();
  if (type === 'checkbox' || type === 'radio') return el.checked;
  return isTextControlFilled(el);
}

/** Consider one standalone control and report what happened. */
function evaluateControl(el: FillableElement, targets: readonly PreparedTarget[]): FieldOutcome {
  if (!isVisible(el)) return skip(null, 'hidden');
  if (isDisabled(el)) return skip(null, 'disabled');
  if (isReadonly(el)) return skip(null, 'readonly');

  const target = matchTarget(readSignals(el), targets);
  if (target === null) return skip(null, 'no-match');

  if (isAlreadyFilled(el)) return skip(target.id, 'already-filled');

  if (!fillControl(el, target.value)) return skip(target.id, 'no-match');
  return { status: 'filled', id: target.id, reason: null };
}

/** Consider one radio group as a single logical field. */
function evaluateRadioGroup(
  radios: readonly HTMLInputElement[],
  targets: readonly PreparedTarget[],
): FieldOutcome {
  const usable = radios.filter((radio) => isVisible(radio) && !isDisabled(radio));
  if (usable.length === 0) {
    const reason: SkipReason = radios.some(isDisabled) ? 'disabled' : 'hidden';
    return skip(null, reason);
  }

  const target = matchTarget(readRadioGroupSignals(usable[0].name, usable), targets);
  if (target === null) return skip(null, 'no-match');

  if (usable.some((radio) => radio.checked)) return skip(target.id, 'already-filled');

  if (!fillRadioGroup(usable, target.value)) return skip(target.id, 'no-match');
  return { status: 'filled', id: target.id, reason: null };
}

/** Fold per-control outcomes into the summary the UI reports. */
function summarise(
  outcomes: readonly FieldOutcome[],
  resumeUploadFields: number,
): FillSummary {
  let filled = 0;
  let skipped = 0;
  const filledIds: string[] = [];
  const seen = new Set<string>();

  for (const outcome of outcomes) {
    if (outcome.status === 'filled') {
      filled += 1;
      if (outcome.id !== null && !seen.has(outcome.id)) {
        seen.add(outcome.id);
        filledIds.push(outcome.id);
      }
    } else if (outcome.reason !== null && COUNTED_SKIPS.has(outcome.reason)) {
      skipped += 1;
    }
  }

  return { filled, skipped, total: filled + skipped, filledIds, resumeUploadFields };
}

/**
 * Detect, map, and fill every eligible control under `root` from `targets`,
 * returning an aggregate summary. Safe to call repeatedly (e.g. after the page
 * adds fields dynamically): already-filled controls are left untouched. Targets
 * are prepared once per call, so a large profile stays cheap on large pages.
 *
 * Beyond native controls, two extra passes run: custom (ARIA) dropdowns are
 * filled conservatively, and resume/CV upload fields are located and flagged for
 * the user (never populated — browsers forbid setting a file input's value).
 */
export function runAutofill(
  root: ParentNode,
  targets: readonly FillTarget[],
  resumeHint: ResumeUploadHint | null = null,
): FillSummary {
  const controls = collectControls(root);
  const { singles, radioGroups } = groupControls(controls);
  const prepared = prepareTargets(targets);

  const outcomes: FieldOutcome[] = [];
  for (const el of singles) {
    outcomes.push(evaluateControl(el, prepared));
  }
  for (const group of radioGroups) {
    outcomes.push(evaluateRadioGroup(group, prepared));
  }
  for (const outcome of evaluateCustomControls(root, prepared)) {
    outcomes.push(outcome);
  }

  const resumeUploadFields =
    resumeHint === null
      ? 0
      : markResumeUploadFields(root, resumeHint.aliases, resumeHint.defaultResumeName);

  return summarise(outcomes, resumeUploadFields);
}
