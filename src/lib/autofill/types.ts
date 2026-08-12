/**
 * Shared types for the autofill engine.
 *
 * The engine is deliberately framework-free and depends on nothing but the DOM
 * and these self-contained types (never the profile constants/services), so it
 * can be bundled into the content script without pulling in shared runtime
 * modules. It operates on {@link FillTarget}s — a flat, data-only description of
 * "a value that can be filled" — so built-in and custom profile fields flow
 * through one pathway and the engine hardcodes nothing about either.
 */

/** The three form controls FormPilot can read and fill. */
export type FillableElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/**
 * A single fillable value plus the website-agnostic hints used to recognise the
 * web form field it belongs to. Built entirely from data (profile descriptors +
 * user custom fields) on the background side and passed to the engine, so the
 * matcher stays a pure scoring function over these records.
 */
export interface FillTarget {
  /** Unique id: a built-in `ProfileFieldKey`, or `custom:<id>` for user fields. */
  readonly id: string;
  /** The value to write into a matching control. Always non-empty by construction. */
  readonly value: string;
  /** Keyword phrases matched against a control's humanised haystack. */
  readonly aliases: readonly string[];
  /** Standard `autocomplete` tokens that authoritatively identify this target. */
  readonly autocomplete: readonly string[];
  /** Input `type`s this target owns as a weak fallback (e.g. email → email). */
  readonly inputTypes: readonly string[];
  /** Phrases that, when present in the haystack, veto this target. */
  readonly disqualifiers: readonly string[];
}

/**
 * The website-agnostic hints read from a single control. Detection produces
 * these; mapping consumes them. Every field is a plain string (never null) so
 * downstream matching stays branch-free.
 */
export interface FieldSignals {
  /** Raw `autocomplete` attribute, lowercased (may hold several space-separated tokens). */
  readonly autocomplete: string;
  readonly name: string;
  readonly id: string;
  readonly placeholder: string;
  readonly ariaLabel: string;
  /** Visible label resolved from <label>, a wrapping label, or aria-labelledby. */
  readonly label: string;
  /** For <input> the lowercased `type`; otherwise 'select' / 'textarea' / 'radio'. */
  readonly controlType: string;
  /** name + id + placeholder + aria-label + label, humanised into a keyword haystack. */
  readonly haystack: string;
}

/** Why a mapped field was left untouched. */
export type SkipReason =
  | 'hidden'
  | 'disabled'
  | 'readonly'
  | 'already-filled'
  | 'no-value'
  | 'no-match';

export type FillStatus = 'filled' | 'skipped';

/** The result of considering one control (or one radio group). */
export interface FieldOutcome {
  readonly status: FillStatus;
  /** The id of the {@link FillTarget} the control mapped to, when known. */
  readonly id: string | null;
  /** Populated only when `status` is 'skipped'. */
  readonly reason: SkipReason | null;
}

/**
 * A hint that lets the engine *recognise* resume/CV file-upload fields on a page.
 *
 * Chrome forbids programmatically assigning a trusted file to `<input type=
 * "file">`, so the engine never fills these — it locates them and flags them so
 * the content script can point the user at the control to finish by hand. The
 * aliases match the same way every other field does; the default resume name is
 * shown in the prompt so the user knows which document to attach.
 */
export interface ResumeUploadHint {
  /** Keyword phrases that identify a resume/CV upload control. */
  readonly aliases: readonly string[];
  /** Name of the default resume to attach, or null when the vault is empty. */
  readonly defaultResumeName: string | null;
}

/** Aggregate result of a fill pass over a document/subtree, for UI feedback. */
export interface FillSummary {
  readonly filled: number;
  /** Count of *mapped* controls deliberately left as-is (already-filled/disabled/hidden/readonly). */
  readonly skipped: number;
  readonly total: number;
  /** Distinct target ids that were written, for messaging/diagnostics. */
  readonly filledIds: readonly string[];
  /** Count of detected resume/CV upload fields the user must complete by hand. */
  readonly resumeUploadFields: number;
}
