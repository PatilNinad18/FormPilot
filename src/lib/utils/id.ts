/**
 * Stable unique id generation for custom fields and resumes.
 *
 * Prefers the platform `crypto.randomUUID()` (available in the popup and the
 * service worker, both secure contexts) and falls back to a timestamp+random
 * string only where it is somehow absent, so callers always get a non-empty id.
 * Not used by the content script, so it never affects that bundle.
 */
export function createId(): string {
  const cryptoRef = typeof crypto !== 'undefined' ? crypto : undefined;
  if (cryptoRef !== undefined && typeof cryptoRef.randomUUID === 'function') {
    return cryptoRef.randomUUID();
  }
  const random = Math.random().toString(36).slice(2);
  return `id-${Date.now().toString(36)}-${random}`;
}
