import type { FillSummary, FillTarget, ResumeUploadHint } from '@shared/autofill/types';

/**
 * The message contract between the background worker and the content script.
 *
 * Runtime values here (the {@link MESSAGE_TYPES} tags and the type guards) are
 * imported by the content script, which owns this module at runtime. The
 * background worker imports only the *types* (`import type`) and constructs
 * messages from checked string literals, so this module never becomes a shared
 * runtime chunk between the two entry points — keeping `content.js` a single,
 * self-contained classic script.
 */

/** Discriminant tags for every message FormPilot passes internally. */
export const MESSAGE_TYPES = {
  ping: 'formpilot:ping',
  fillForm: 'formpilot:fill-form',
} as const;

/** Liveness probe: confirms a content script is present in a frame. */
export interface PingMessage {
  readonly type: typeof MESSAGE_TYPES.ping;
}

export interface PingResponse {
  readonly ok: true;
}

/**
 * Request to autofill the active document. The finished fill targets travel with
 * the message (background → content); the values never leave the browser. The
 * background worker builds the targets from the saved profile and custom fields,
 * so the content script does not read storage or the profile constants itself.
 * The optional `resumeUpload` hint lets the content script recognise resume/CV
 * file inputs and flag them for the user (files are never injected).
 */
export interface FillFormMessage {
  readonly type: typeof MESSAGE_TYPES.fillForm;
  readonly targets: readonly FillTarget[];
  readonly resumeUpload?: ResumeUploadHint;
}

/** Result of a fill request: the aggregate summary, or a failure reason. */
export type FillFormResponse =
  | { readonly ok: true; readonly summary: FillSummary }
  | { readonly ok: false; readonly error: string };

export type ExtensionMessage = PingMessage | FillFormMessage;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isPingMessage(value: unknown): value is PingMessage {
  return isRecord(value) && value.type === MESSAGE_TYPES.ping;
}

export function isFillFormMessage(value: unknown): value is FillFormMessage {
  return isRecord(value) && value.type === MESSAGE_TYPES.fillForm && Array.isArray(value.targets);
}
