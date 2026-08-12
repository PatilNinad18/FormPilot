/**
 * Small, dependency-free helpers shared across layers.
 */

/**
 * Normalise an unknown thrown value into a human-readable message.
 *
 * `catch` clauses are typed `unknown` under strict mode, and rejected
 * chrome.* promises may surface non-Error values, so callers route everything
 * through here before showing it in the UI.
 */
export function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim() !== '') {
    return error;
  }
  return 'Something went wrong. Please try again.';
}
