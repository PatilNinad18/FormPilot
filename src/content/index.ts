import { showFillError, showFillFeedback } from './feedback';
import { runAutofill } from '@shared/autofill/engine';
import {
  isFillFormMessage,
  isPingMessage,
} from '@shared/messaging/messages';
import type { FillFormResponse, PingResponse } from '@shared/messaging/messages';

/**
 * FormPilot AI — content script.
 *
 * Injected into every frame at document_idle. It listens for two internal
 * messages: a liveness `ping`, and a `fill-form` request that carries the fill
 * targets. On a fill request it runs the framework-free autofill engine against
 * the current document, shows count-only feedback, and returns a summary.
 *
 * The engine and messaging runtime live entirely inside this bundle; nothing
 * shared with the popup or worker is imported at runtime, so `content.js` stays
 * a single self-contained classic script.
 */

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (isPingMessage(message)) {
    const response: PingResponse = { ok: true };
    sendResponse(response);
    return false;
  }

  if (isFillFormMessage(message)) {
    try {
      const summary = runAutofill(document, message.targets, message.resumeUpload ?? null);
      showFillFeedback(summary);
      const response: FillFormResponse = { ok: true, summary };
      sendResponse(response);
    } catch (error) {
      showFillError();
      const reason =
        error instanceof Error && error.message !== '' ? error.message : 'unknown error';
      const response: FillFormResponse = { ok: false, error: reason };
      sendResponse(response);
    }
    return false;
  }

  // Unrecognised message: not ours. Do not keep the response channel open.
  return false;
});

export {};
