import { readSignals } from './detect';
import { compactToken, isDisabled, isVisible } from './dom';

/**
 * Resume/CV upload-field handling.
 *
 * Browser security is explicit here: an extension **cannot** put a file into an
 * `<input type="file">`. The `.files` property only accepts a trusted `FileList`
 * the browser itself builds from a real user picker; a script-built one is
 * rejected, and forging the drop/DataTransfer path is exactly the kind of unsafe
 * trick this project forbids. So FormPilot never pretends to upload — it *finds*
 * resume upload fields (via the same alias matching used everywhere else) and
 * draws a temporary, fully reversible highlight so the user can attach the file
 * themselves. Nothing is injected, and no styling is left behind.
 */

/** How long the highlight stays before the element's styles are restored. */
const HIGHLIGHT_DURATION_MS = 6000;
/** Marks an already-highlighted field so repeated runs don't stack timers/styles. */
const HIGHLIGHT_MARKER = 'data-formpilot-resume-hint';

/** True when a resume alias appears as a whole phrase in the field's haystack. */
function matchesResumeAlias(haystack: string, aliases: readonly string[]): boolean {
  if (haystack === '') return false;
  const padded = ` ${haystack} `;
  for (const alias of aliases) {
    const phrase = compactToken(alias);
    if (phrase !== '' && padded.includes(` ${phrase} `)) return true;
  }
  return false;
}

/** Every `<input type="file">` under `root`, which the fill pass never collects. */
function collectFileInputs(root: ParentNode): HTMLInputElement[] {
  const inputs: HTMLInputElement[] = [];
  for (const el of Array.from(root.querySelectorAll<HTMLInputElement>('input[type="file"]'))) {
    inputs.push(el);
  }
  return inputs;
}

/**
 * Apply a reversible outline highlight to a recognised upload field. The prior
 * inline styles and title are captured and restored on a timer, so the page is
 * returned to exactly its original state — we never leave a mark behind.
 */
function highlightField(el: HTMLInputElement, hintText: string): void {
  if (el.hasAttribute(HIGHLIGHT_MARKER)) return;
  el.setAttribute(HIGHLIGHT_MARKER, '');

  const prev = {
    outline: el.style.outline,
    outlineOffset: el.style.outlineOffset,
    borderRadius: el.style.borderRadius,
    title: el.getAttribute('title'),
  };

  el.style.outline = '2px dashed #d97706';
  el.style.outlineOffset = '2px';
  el.style.borderRadius = '4px';
  el.setAttribute('title', hintText);

  const view = el.ownerDocument.defaultView ?? window;
  view.setTimeout(() => {
    el.style.outline = prev.outline;
    el.style.outlineOffset = prev.outlineOffset;
    el.style.borderRadius = prev.borderRadius;
    if (prev.title === null) el.removeAttribute('title');
    else el.setAttribute('title', prev.title);
    el.removeAttribute(HIGHLIGHT_MARKER);
  }, HIGHLIGHT_DURATION_MS);
}

/**
 * Find and highlight resume/CV upload fields under `root`, returning how many
 * were recognised. Hidden and disabled inputs are ignored (the same rules as
 * every other control). No file is ever assigned — this is detection plus a
 * reversible visual cue only.
 */
export function markResumeUploadFields(
  root: ParentNode,
  aliases: readonly string[],
  defaultResumeName: string | null,
): number {
  if (aliases.length === 0) return 0;

  const hintText =
    defaultResumeName !== null
      ? `FormPilot: attach your resume "${defaultResumeName}" here (browsers require you to pick the file).`
      : 'FormPilot: attach your resume here (browsers require you to pick the file).';

  let count = 0;
  for (const input of collectFileInputs(root)) {
    if (!isVisible(input) || isDisabled(input)) continue;
    const signals = readSignals(input);
    if (!matchesResumeAlias(signals.haystack, aliases)) continue;
    highlightField(input, hintText);
    count += 1;
  }
  return count;
}
