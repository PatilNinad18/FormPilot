import type { FillSummary } from '@shared/autofill/types';

/**
 * On-page autofill feedback.
 *
 * Renders a small toast inside a closed shadow root so the host page's CSS can
 * never restyle it and FormPilot's styles never leak out. Only *counts* are
 * shown — never any profile values — so nothing sensitive is painted onto the
 * page. This module is content-script-only at runtime.
 */

const HOST_ID = 'formpilot-feedback-host';
const VISIBLE_MS = 4000;

/** Turn a summary into a human sentence describing counts only. */
function summaryText(summary: FillSummary): string {
  return appendResumeNote(baseSummaryText(summary), summary.resumeUploadFields);
}

/** The fill portion of the message, before any resume-upload note. */
function baseSummaryText(summary: FillSummary): string {
  if (summary.filled === 0) {
    if (summary.total === 0) {
      return 'FormPilot: no fields to fill on this page.';
    }
    return 'FormPilot: matching fields already had values — nothing changed.';
  }

  const noun = summary.filled === 1 ? 'field' : 'fields';
  const base = `FormPilot filled ${summary.filled} ${noun}.`;
  if (summary.skipped > 0) {
    const left =
      summary.skipped === 1 ? '1 field left unchanged' : `${summary.skipped} fields left unchanged`;
    return `${base} ${left}.`;
  }
  return base;
}

/**
 * Append a note about resume upload fields. Browsers block extensions from
 * setting a file input, so these are flagged (and highlighted on the page) for
 * the user to complete by hand — the toast says so honestly.
 */
function appendResumeNote(text: string, resumeUploadFields: number): string {
  if (resumeUploadFields === 0) return text;
  const noun = resumeUploadFields === 1 ? 'a resume upload field' : 'resume upload fields';
  return `${text} Highlighted ${noun} — attach your file there manually.`;
}

const TOAST_STYLE = [
  'font:500 13px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif',
  'color:#0b1324',
  'background:#ffffff',
  'border:1px solid rgba(15,23,42,0.12)',
  'border-radius:10px',
  'box-shadow:0 8px 24px rgba(15,23,42,0.18)',
  'padding:10px 14px',
  'max-width:320px',
  'pointer-events:auto',
].join(';');

/** Show a transient toast with the given text. Replaces any existing toast. */
function showToast(text: string): void {
  // documentElement is always present in a rendered page; body may not be yet.
  const root = document.body ?? document.documentElement;

  const previous = document.getElementById(HOST_ID);
  if (previous !== null) previous.remove();

  const host = document.createElement('div');
  host.id = HOST_ID;
  host.setAttribute(
    'style',
    'position:fixed;top:16px;right:16px;z-index:2147483647;pointer-events:none;',
  );

  const shadow = host.attachShadow({ mode: 'closed' });
  const toast = document.createElement('div');
  toast.textContent = text;
  toast.setAttribute('style', TOAST_STYLE);
  shadow.appendChild(toast);
  root.appendChild(host);

  window.setTimeout(() => {
    host.remove();
  }, VISIBLE_MS);
}

/** Announce the outcome of a fill pass. */
export function showFillFeedback(summary: FillSummary): void {
  showToast(summaryText(summary));
}

/** Announce a failure without leaking any detail onto the page. */
export function showFillError(): void {
  showToast('FormPilot could not autofill this page.');
}
