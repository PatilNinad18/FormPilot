import { loadProfile } from '@shared/services/profileService';
import { loadResumeVault } from '@shared/services/resumeService';
import { buildFillTargets } from '@shared/services/fillTargetService';
import { RESUME_FIELD_ALIASES } from '@constants/resume';
import type { FillFormMessage } from '@shared/messaging/messages';
import type { ResumeUploadHint } from '@shared/autofill/types';

/**
 * FormPilot AI — MV3 background service worker.
 *
 * Owns the data-reading side of autofill: when the fill command fires, it loads
 * the saved profile plus the user's custom fields, builds the flat fill-target
 * list, and hands it to the active tab's content script, which runs the engine.
 * The worker imports only the message *types* (not the messaging runtime), so it
 * never shares a bundle chunk with the content script. The values stay inside
 * the browser end to end.
 */

const EXTENSION_LABEL = 'FormPilot AI';
const FILL_COMMAND = 'fill-current-form';

chrome.runtime.onInstalled.addListener((details) => {
  // Surfaced in the service-worker console to confirm the worker booted.
  console.warn(`[${EXTENSION_LABEL}] service worker installed (${details.reason}).`);
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== FILL_COMMAND) return;
  void fillActiveTab();
});

/** Load the saved data and ask the active tab's content script to fill its forms. */
async function fillActiveTab(): Promise<void> {
  const snapshot = await loadProfile().catch(() => null);
  if (snapshot === null) {
    console.warn(`[${EXTENSION_LABEL}] could not read the saved profile.`);
    return;
  }

  // Built-in fields and enabled custom fields both become targets; an empty list
  // means there is no text data to fill from (no profile, no custom fields).
  const targets = buildFillTargets(snapshot.profile, snapshot.customFields);

  // Resume upload fields are flagged separately from text fields: the hint names
  // the default resume (if any) so the content script can point the user at the
  // right control. A saved resume alone is reason enough to run a pass.
  const resumeUpload = await buildResumeHint();
  if (targets.length === 0 && resumeUpload.defaultResumeName === null) {
    console.warn(`[${EXTENSION_LABEL}] no saved profile or resume to autofill from yet.`);
    return;
  }

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeTab = tabs[0];
  if (tabs.length === 0 || activeTab.id === undefined) {
    console.warn(`[${EXTENSION_LABEL}] no active tab to autofill.`);
    return;
  }
  const tabId = activeTab.id;

  // Built from a checked literal rather than the messaging runtime, so this
  // module stays free of any content-script chunk.
  const message: FillFormMessage = { type: 'formpilot:fill-form', targets, resumeUpload };

  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch {
    // Expected on pages without a content script (chrome://, the web store,
    // the new-tab page). Nothing to fill there.
    console.warn(`[${EXTENSION_LABEL}] no form fields are reachable on the active tab.`);
  }
}

/**
 * Build the resume-upload hint sent with a fill request. The static aliases let
 * the content script recognise a resume/CV file input; the default resume's name
 * (if one is set) is shown to the user so they know which file to attach. The
 * file itself is never sent to the page — browsers forbid scripting a file input.
 */
async function buildResumeHint(): Promise<ResumeUploadHint> {
  const vault = await loadResumeVault().catch(() => null);
  if (vault === null) {
    return { aliases: RESUME_FIELD_ALIASES, defaultResumeName: null };
  }
  const defaultResume = vault.resumes.find((resume) => resume.id === vault.defaultResumeId) ?? null;
  return { aliases: RESUME_FIELD_ALIASES, defaultResumeName: defaultResume?.name ?? null };
}

export {};
