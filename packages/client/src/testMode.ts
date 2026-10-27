/**
 * Deterministic test mode for browser tests: `?test=1` (with `&seed=n`, `&god=1`).
 *
 * - a fixed simulation seed (default 1), so bots, spawns and drops play out the same way;
 * - MapMaker ids from a seeded generator, so room dressing (seeded by tile ids) is the same every run;
 * - `god=1`: the local player takes no damage (falling out of the map still kills).
 *
 * Offline only. It is honoured only on a dev server, a build made with VITE_TEST_HOOKS=1, or a page served
 * from this machine (localhost); and a match in test mode can't be hosted, listed or joined (see
 * MatchHost.open and the session's `hostable`), so it never reaches anyone else.
 */
export interface TestOptions {
  seed: number;
  god: boolean;
}

function allowedHere(): boolean {
  if (import.meta.env.DEV || (import.meta.env.VITE_TEST_HOOKS as string | undefined) === '1') return true;
  return typeof location !== 'undefined' && /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])$/.test(location.hostname);
}

let cached: TestOptions | null | undefined;

/** The page's test mode, or null (not asked for, or not allowed here). */
export function testMode(): TestOptions | null {
  if (cached !== undefined) return cached;
  cached = null;
  if (typeof location === 'undefined') return cached;
  const q = new URLSearchParams(location.search);
  if (q.get('test') !== '1' || !allowedHere()) return cached;
  const seed = Number(q.get('seed') ?? 1);
  cached = { seed: Number.isFinite(seed) ? Math.floor(seed) : 1, god: q.get('god') === '1' };
  return cached;
}

/** Mulberry32: the small seeded generator test mode hands out for ids. */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
