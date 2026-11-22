/**
 * Your optic choice per gun (docs/GUNPLAY_SPEC.md §15, "Optic choice"; Profile → Favourite loadout → Optics, and the
 * pause menu's Settings → Optic for the gun in hand): weapon ID → optic kind, only for guns not on their default.
 * Kept in this browser. It goes to the match in `hello` and, when changed mid-match, in the `optics` message
 * (docs/MULTIPLAYER_PROTOCOL.md section 27); the host checks each against the optics table (shared sim/opticChoice.ts).
 *
 * The menu reads and writes it, so nothing here loads the optics table: which gun may take which optic is the
 * table's (game/optics.ts, loaded with the match's view and by the profile's picker when it opens).
 */
const KEY = 'tiletrigger.optics';
const MAX = 64;

let cache: Record<string, string> | null = null;
const listeners = new Set<(op: Readonly<Record<string, string>>) => void>();

function load(): Record<string, string> {
  if (cache) return cache;
  let raw: unknown = null;
  try {
    raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
  } catch {
    raw = null;
  }
  const out: Record<string, string> = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>).slice(0, MAX)) if (/^[a-z][a-z0-9_.-]{0,47}$/.test(k) && typeof v === 'string' && /^[a-z0-9]{1,12}$/.test(v)) out[k] = v;
  }
  return (cache = out);
}

/** Your choices now (a copy): weapon ID → optic kind. */
export const myOptics = (): Record<string, string> => ({ ...load() });

/** Your choice for one gun (undefined: its default). */
export const myOpticFor = (weapon: string): string | undefined => load()[weapon];

/** Pick `kind` for `weapon`, or its default (null, or the default's own kind: no entry is kept for it). */
export function setMyOptic(weapon: string, kind: string | null, defaultKind?: string): void {
  const next = { ...load() };
  if (!kind || kind === defaultKind) delete next[weapon];
  else next[weapon] = kind;
  if (next[weapon] === load()[weapon]) return;
  cache = next;
  try {
    if (Object.keys(next).length) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: this page only.
  }
  for (const cb of listeners) cb(next);
}

/**
 * Take a whole list as yours (your account's picks, read as you sign in: careerStats.ts syncOptics). Listeners are told
 * unless `quiet`.
 */
export function replaceMyOptics(op: Readonly<Record<string, string>>, quiet = false): void {
  const next: Record<string, string> = {};
  for (const [k, v] of Object.entries(op).slice(0, MAX)) if (/^[a-z][a-z0-9_.-]{0,47}$/.test(k) && /^[a-z0-9]{1,12}$/.test(v)) next[k] = v;
  cache = next;
  try {
    if (Object.keys(next).length) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: this page only.
  }
  if (!quiet) for (const cb of listeners) cb(next);
}

/** Told of every change (the session sends it to the host); returns the unsubscribe. */
export function onOpticsChange(cb: (op: Readonly<Record<string, string>>) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** `hello`'s field: your choices, or nothing when every gun is on its default. */
export function opticsHello(): { op?: Record<string, string> } {
  const op = myOptics();
  return Object.keys(op).length ? { op } : {};
}

/** Tests: forget the cached copy (storage read again). */
export function resetOpticPrefsCache(): void {
  cache = null;
}
