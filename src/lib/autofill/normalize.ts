/**
 * Value normalization and option matching for the autofill engine.
 *
 * Radio, checkbox, and select controls do not take arbitrary text: they offer a
 * fixed set of *options*, and filling one means matching the user's stored value
 * against those option labels/values. Real forms differ from stored values in
 * cosmetic ways — a stored "18–24" (en dash) versus an option "18-24" (hyphen),
 * different casing, stray punctuation, "&" versus "and". This module reduces both
 * sides to comparable forms and scores a match with deliberate conservatism, so
 * a confident selection is made but an ambiguous one is skipped.
 *
 * Everything here is a pure string/DOM-free helper, so it stays inside the
 * content bundle without pulling in shared runtime modules.
 */

/** Unicode dash variants (hyphen, figure/en/em dash, minus) unified to '-'. */
const DASH_PATTERN = /[‐‑‒–—―−]/g;

/**
 * Canonical comparison form: lowercased, unicode dashes unified to a plain
 * hyphen, "&" spelled out, and whitespace collapsed. Keeps hyphens and spaces so
 * range-like values ("18-24") stay structured while "18–24" compares equal.
 */
export function normalizeValue(raw: string): string {
  return raw
    .replace(DASH_PATTERN, '-')
    .replace(/&/g, ' and ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Aggressively condensed form: only lowercase alphanumerics, all separators
 * removed. Lets "B.Tech", "B Tech", and "BTech" compare equal, and "18-24"
 * equal "18 24". Used as a secondary equality test after {@link normalizeValue}.
 */
export function condenseValue(raw: string): string {
  return normalizeValue(raw).replace(/[^a-z0-9]+/g, '');
}

/** Split a value into lowercase alphanumeric word tokens ("18-24" → 18, 24). */
export function valueTokens(raw: string): string[] {
  const spaced = normalizeValue(raw)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return spaced === '' ? [] : spaced.split(' ');
}

/** Values that mean "check / select the affirmative". */
const AFFIRMATIVE: ReadonlySet<string> = new Set([
  'yes',
  'true',
  'on',
  '1',
  'y',
  'checked',
  'agree',
  'agreed',
  'accept',
  'accepted',
]);

/** Values that explicitly mean "no" — used to leave a boolean control alone. */
const NEGATIVE: ReadonlySet<string> = new Set([
  'no',
  'false',
  'off',
  '0',
  'n',
  'unchecked',
  'disagree',
  'decline',
  'declined',
]);

export function isAffirmative(value: string): boolean {
  return AFFIRMATIVE.has(normalizeValue(value));
}

export function isNegative(value: string): boolean {
  return NEGATIVE.has(normalizeValue(value));
}

/**
 * Split a stored value that may encode several selections (for multi-select
 * checkbox groups and `<select multiple>`). Splits on commas, semicolons, pipes,
 * and newlines, trimming and de-duplicating. A plain single value (or one that
 * legitimately contains a slash, like "TCP/IP") comes back as a one-element list.
 */
export function splitValues(raw: string): string[] {
  const parts = raw.split(/[,;|\n]+/);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed === '') continue;
    const key = normalizeValue(trimmed);
    if (key === '' || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

/** How strongly an option matched a target value. */
export type OptionMatchTier = 'strong' | 'weak' | 'none';

/** An option's identifying strings: its form `value` and its visible text. */
export interface OptionCandidate {
  readonly value: string;
  readonly text: string;
}

interface ValueForms {
  readonly norm: string;
  readonly cond: string;
  readonly tokens: readonly string[];
}

function toForms(raw: string): ValueForms {
  return { norm: normalizeValue(raw), cond: condenseValue(raw), tokens: valueTokens(raw) };
}

/** Whether `needle` appears as a contiguous whole-token run inside `hay`. */
function containsTokenRun(hay: readonly string[], needle: readonly string[]): boolean {
  if (needle.length === 0 || needle.length > hay.length) return false;
  for (let start = 0; start + needle.length <= hay.length; start += 1) {
    let matched = true;
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (hay[start + offset] !== needle[offset]) {
        matched = false;
        break;
      }
    }
    if (matched) return true;
  }
  return false;
}

/**
 * Classify how well one option matches a target value.
 *
 * `strong`  — normalized or condensed equality of the option's value or text
 *             (e.g. "18–24" ≈ "18-24", "B.Tech" ≈ "BTech").
 * `weak`    — one side's tokens appear as a contiguous whole-word run inside the
 *             other ("18-24" inside "aged 18-24"). Whole-word matching is what
 *             stops "male" from matching "female" the way raw substring did.
 * `none`    — no defensible relationship.
 */
export function optionMatchTier(candidate: OptionCandidate, target: string): OptionMatchTier {
  const t = toForms(target);
  if (t.norm === '') return 'none';

  const value = toForms(candidate.value);
  const text = toForms(candidate.text);

  if (t.norm === value.norm || t.norm === text.norm) return 'strong';
  if (t.cond !== '' && (t.cond === value.cond || t.cond === text.cond)) return 'strong';

  if (t.tokens.length > 0) {
    if (containsTokenRun(text.tokens, t.tokens) || containsTokenRun(t.tokens, text.tokens)) {
      return 'weak';
    }
    if (
      value.tokens.length > 0 &&
      (containsTokenRun(value.tokens, t.tokens) || containsTokenRun(t.tokens, value.tokens))
    ) {
      return 'weak';
    }
  }

  return 'none';
}

/**
 * Choose the single best option for a target, or `null` when nothing fits or the
 * choice is ambiguous. A unique `strong` match always wins; failing that, a
 * unique `weak` match is taken. Two or more equally-strong candidates return
 * `null` — never guess between plausible options.
 */
export function pickOption<T>(
  items: readonly T[],
  toCandidate: (item: T) => OptionCandidate,
  target: string,
): T | null {
  let strong: T | null = null;
  let strongCount = 0;
  let weak: T | null = null;
  let weakCount = 0;

  for (const item of items) {
    const tier = optionMatchTier(toCandidate(item), target);
    if (tier === 'strong') {
      strong = item;
      strongCount += 1;
    } else if (tier === 'weak') {
      weak = item;
      weakCount += 1;
    }
  }

  if (strongCount === 1) return strong;
  if (strongCount > 1) return null;
  if (weakCount === 1) return weak;
  return null;
}
