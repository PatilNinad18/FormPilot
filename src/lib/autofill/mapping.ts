import { compactToken } from './dom';
import type { FieldSignals, FillTarget } from './types';

/**
 * Semantic field matching — a data-driven scoring model.
 *
 * Every fillable value (built-in profile field or user custom field) arrives as
 * a {@link FillTarget} carrying its own matching hints. For a given control we
 * *score* each target against the control's signals and pick the best — there
 * is no per-field branch logic here, so a brand-new custom field participates
 * with zero engine changes. All matching is website-agnostic: only the semantic
 * hints browsers and accessible markup already expose.
 *
 * Scoring, strongest first:
 *   - a disqualifier phrase present  → veto (score 0)
 *   - a standard `autocomplete` token match → authoritative
 *   - an alias phrase found in the haystack → the longer/more specific the
 *     alias, the higher the score (so "first name" beats a bare "name"); an
 *     exact whole-field match adds a bonus
 *   - the input `type` the target owns → weak fallback
 */

const AUTOCOMPLETE_SCORE = 1000;
const ALIAS_BASE = 100;
const EXACT_FIELD_BONUS = 60;
const INPUT_TYPE_SCORE = 40;
/** Any positive score is a match; disqualified/irrelevant targets score 0. */
const MIN_SCORE = 1;

/**
 * A {@link FillTarget} with its alias/disqualifier phrases pre-normalised with
 * the *same* {@link compactToken} the detector applies to the haystack, so
 * phrase comparison is apples-to-apples. Autocomplete tokens keep their hyphens
 * and are only lowercased. Prepared once per fill pass.
 */
export interface PreparedTarget {
  readonly id: string;
  readonly value: string;
  readonly aliases: readonly string[];
  readonly autocomplete: readonly string[];
  readonly inputTypes: readonly string[];
  readonly disqualifiers: readonly string[];
}

/** Compact a list of phrases, dropping empties and duplicates. */
function prepPhrases(values: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const value of values) {
    const token = compactToken(value);
    if (token !== '') seen.add(token);
  }
  return Array.from(seen);
}

/** Lowercase autocomplete tokens, preserving their hyphens; drop empties. */
function prepTokens(values: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const value of values) {
    const token = value.trim().toLowerCase();
    if (token !== '') seen.add(token);
  }
  return Array.from(seen);
}

/**
 * Normalise raw {@link FillTarget}s (as received over the fill message) into
 * {@link PreparedTarget}s. Targets with no usable value or no way to match are
 * dropped so they never produce spurious fills.
 */
export function prepareTargets(targets: readonly FillTarget[]): PreparedTarget[] {
  const prepared: PreparedTarget[] = [];
  for (const target of targets) {
    if (typeof target.value !== 'string' || target.value.trim() === '') continue;
    const aliases = prepPhrases(target.aliases);
    const autocomplete = prepTokens(target.autocomplete);
    const inputTypes = prepTokens(target.inputTypes);
    if (aliases.length === 0 && autocomplete.length === 0 && inputTypes.length === 0) continue;
    prepared.push({
      id: target.id,
      value: target.value,
      aliases,
      autocomplete,
      inputTypes,
      disqualifiers: prepPhrases(target.disqualifiers),
    });
  }
  return prepared;
}

/** True when `phrase` appears in `haystack` as a whole token sequence. */
function containsPhrase(haystack: string, phrase: string): boolean {
  return ` ${haystack} `.includes(` ${phrase} `);
}

function matchesAutocomplete(signalTokens: readonly string[], target: PreparedTarget): boolean {
  for (const token of signalTokens) {
    if (token !== '' && target.autocomplete.includes(token)) return true;
  }
  return false;
}

/**
 * Score one target against one control's signals. `exactForms` are the compacted
 * label/name/id, used to reward a match that spans a whole field identifier.
 */
function scoreTarget(
  signals: FieldSignals,
  signalTokens: readonly string[],
  exactForms: ReadonlySet<string>,
  target: PreparedTarget,
): number {
  for (const disqualifier of target.disqualifiers) {
    if (containsPhrase(signals.haystack, disqualifier)) return 0;
  }

  let score = 0;

  if (target.autocomplete.length > 0 && matchesAutocomplete(signalTokens, target)) {
    score = AUTOCOMPLETE_SCORE;
  }

  for (const alias of target.aliases) {
    if (!containsPhrase(signals.haystack, alias)) continue;
    let aliasScore = ALIAS_BASE + alias.length;
    if (exactForms.has(alias)) aliasScore += EXACT_FIELD_BONUS;
    if (aliasScore > score) score = aliasScore;
  }

  if (target.inputTypes.includes(signals.controlType) && INPUT_TYPE_SCORE > score) {
    score = INPUT_TYPE_SCORE;
  }

  return score;
}

/**
 * Pick the best-scoring target for a control, or `null` when nothing fits.
 * Ties keep the earlier target (built-ins are ordered before custom fields),
 * making the result deterministic.
 */
export function matchTarget(
  signals: FieldSignals,
  targets: readonly PreparedTarget[],
): PreparedTarget | null {
  const signalTokens = signals.autocomplete.split(' ');
  const exactForms = new Set<string>([
    compactToken(signals.label),
    compactToken(signals.name),
    compactToken(signals.id),
  ]);
  exactForms.delete('');

  let best: PreparedTarget | null = null;
  let bestScore = 0;
  for (const target of targets) {
    const score = scoreTarget(signals, signalTokens, exactForms, target);
    if (score > bestScore) {
      bestScore = score;
      best = target;
    }
  }
  return bestScore >= MIN_SCORE ? best : null;
}
