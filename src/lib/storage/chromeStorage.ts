/**
 * Thin, typed wrapper over chrome.storage.local.
 *
 * Centralising access here means the rest of the app never touches the raw
 * chrome.* API directly: call sites get a typed value, a guard for contexts
 * where the API is unavailable (e.g. tests / non-extension pages), and a single
 * place to evolve the persistence backend later. This is the ONLY module that
 * talks to chrome.storage.
 */

/**
 * True when the chrome.storage.local API is reachable. Declared defensively so
 * importing this module never throws in a plain browser/test context where the
 * `chrome` global is absent.
 */
export function isStorageAvailable(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    typeof chrome.storage !== 'undefined' &&
    typeof chrome.storage.local !== 'undefined'
  );
}

function assertStorage(): void {
  if (!isStorageAvailable()) {
    throw new Error('Storage is unavailable. Open FormPilot from the extension toolbar.');
  }
}

/**
 * Read a single key. Returns `undefined` when the key has never been written.
 * The stored shape is opaque here, so the caller supplies `T` and is
 * responsible for validating/normalising the result (see profileService).
 */
export async function getItem<T>(key: string): Promise<T | undefined> {
  assertStorage();
  const result = await chrome.storage.local.get(key);
  const value = result[key];
  return value === undefined ? undefined : (value as T);
}

/** Write a single key, overwriting any previous value. */
export async function setItem<T>(key: string, value: T): Promise<void> {
  assertStorage();
  await chrome.storage.local.set({ [key]: value });
}

/** Remove a single key. A no-op if the key was never present. */
export async function removeItem(key: string): Promise<void> {
  assertStorage();
  await chrome.storage.local.remove(key);
}
