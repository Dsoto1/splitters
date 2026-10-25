/**
 * The game was called ChronoSplit until it became Tile Trigger: settings saved
 * under the old `chronosplit.` keys move to `tiletrigger.` ones on first run.
 * Imported first by main.ts, before anything reads its settings.
 */
try {
  for (let i = 0; i < localStorage.length; i++) {
    const old = localStorage.key(i);
    if (!old?.startsWith('chronosplit.')) continue;
    const key = `tiletrigger.${old.slice('chronosplit.'.length)}`;
    const value = localStorage.getItem(old);
    if (localStorage.getItem(key) === null && value !== null) localStorage.setItem(key, value);
  }
} catch {
  // No storage (private window, blocked site data): nothing to move.
}
