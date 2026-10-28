const RELOAD_KEY = 'chunk-reload-at';

/**
 * True when a lazy-loaded chunk failed to load (usually because a new
 * deploy removed the old hashed file the open page still references).
 */
export function isChunkLoadError(error: unknown): boolean {
  const message = (error as Error)?.message || '';
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk .* failed/i.test(
    message
  );
}

/**
 * Reload the page once to pick up the new build. Returns false if a reload
 * was already attempted in the last 30 seconds, to avoid reload loops.
 */
export function reloadForNewVersion(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < 30000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // storage unavailable - still try reloading
  }
  window.location.reload();
  return true;
}
