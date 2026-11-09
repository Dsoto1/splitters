import type { WeaponDefinition } from '../sim/weapons.ts';
import { BOT_DRAW_MS, BOT_TTK, BOT_TTK_DISTANCES } from './weaponBands.generated.ts';

/**
 * Where each gun is good, for bots (GUNPLAY_SPEC §40 and Phase G4; docs/GUNPLAY_AUDIT.md "G4"): from the time to kill
 * `pnpm gun-report` measured in the shared sim as bots fire it (hip; a scoped gun aimed past 7 m), not hand-set. The
 * measured curves are weaponBands.generated.ts (`pnpm gun-report --json=docs/gunplay-audit.json --bands` writes it);
 * the band is worked out from them here.
 *
 * A gun's effective band is the run of distances around its quickest kill where it still kills within
 * BAND_SLACK of that: at most 1.6 times as long, or half a second longer, whichever is more, and never needing more
 * than 2.5 s (a fight is over by then); anything that kills within 0.8 s counts. The band's ends lie halfway to the
 * first measured distance outside it (0 when the closest one is in; the farthest measured when the farthest is in).
 * Guns without a measured curve (melee, tools, mounted guns, a gun added since the last run) keep their hand-set
 * `botRange`.
 */
export const BAND_SLACK = { ratio: 1.6, extraMs: 500, goodMs: 800, capMs: 2500 } as const;

/** The band (m) a measured curve gives (`ttk[i]` ms at `distances[i]`, null: no kill), or null when it never kills in time. */
export function effectiveBand(ttk: readonly (number | null)[], distances: readonly number[]): [number, number] | null {
  let best = -1;
  for (let i = 0; i < ttk.length; i++) {
    const t = ttk[i];
    if (t !== null && t !== undefined && (best < 0 || t < ttk[best]!)) best = i;
  }
  if (best < 0) return null;
  const quickest = ttk[best]!;
  const limit = Math.min(BAND_SLACK.capMs, Math.max(BAND_SLACK.goodMs, quickest * BAND_SLACK.ratio, quickest + BAND_SLACK.extraMs));
  const good = (i: number) => {
    const t = ttk[i];
    return t !== null && t !== undefined && t <= limit;
  };
  if (!good(best)) return null;
  let lo = best;
  let hi = best;
  while (lo > 0 && good(lo - 1)) lo--;
  while (hi < ttk.length - 1 && good(hi + 1)) hi++;
  const near = lo === 0 ? 0 : (distances[lo - 1]! + distances[lo]!) / 2;
  const far = hi === ttk.length - 1 ? distances[hi]! : (distances[hi]! + distances[hi + 1]!) / 2;
  return [near, far];
}

/** The benchmark seven (GUNPLAY_DIRECTION.md): the guns a bot most often meets, the yardstick for a gun's edge. */
export const BENCHMARK_GUNS = ['core.pistol', 'core.revolver', 'core.smg', 'core.rifle', 'core.shotgun', 'core.sniper', 'core.rockets'] as const;

/** The middle of the benchmark guns' times at each distance (a gun that can't kill there counts as the slowest). */
export function benchmarkMedian(curves: Readonly<Record<string, readonly (number | null)[]>>, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const ts = BENCHMARK_GUNS.map((id) => curves[id]?.[i] ?? Infinity).sort((a, b) => a - b);
    out.push(ts[Math.floor(ts.length / 2)]!);
  }
  return out;
}

/**
 * Where a gun has the edge: the longest run (two measured distances or more) inside its band where it kills at least
 * as fast as the benchmark guns' median there (its ends halfway to the next distance, as the band's), or null.
 * A flat curve (the Precision Rifle's) has a band that starts at the muzzle, but it only beats what others carry from
 * mid range on: that is where a bot holding it wants the fight.
 */
export function edgeOf(ttk: readonly (number | null)[], distances: readonly number[], median: readonly number[], band: readonly [number, number]): [number, number] | null {
  let best: [number, number] | null = null;
  let i = 0;
  const ok = (k: number) => {
    const t = ttk[k];
    return t !== null && t !== undefined && t <= median[k]! && distances[k]! >= band[0] && distances[k]! <= band[1];
  };
  while (i < ttk.length) {
    if (!ok(i)) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < ttk.length && ok(j + 1)) j++;
    // (One distance alone is too thin to be an edge: two in a row at least.)
    if (j > i && (!best || j - i > best[1] - best[0])) best = [i, j];
    i = j + 1;
  }
  if (!best) return null;
  const [a, b] = best;
  return [a === 0 ? 0 : (distances[a - 1]! + distances[a]!) / 2, b === ttk.length - 1 ? distances[b]! : (distances[b]! + distances[b + 1]!) / 2];
}

const bands = new Map<string, readonly [number, number]>();
const edges = new Map<string, readonly [number, number]>();
const median = benchmarkMedian(BOT_TTK, BOT_TTK_DISTANCES.length);
for (const [id, ttk] of Object.entries(BOT_TTK)) {
  const band = effectiveBand(ttk, BOT_TTK_DISTANCES);
  if (!band) continue;
  bands.set(id, band);
  const edge = edgeOf(ttk, BOT_TTK_DISTANCES, median, band);
  if (edge) edges.set(id, edge);
}

/** A curve's value at `d` (m), straight between the measured distances, held at the ends (null: no kill there). */
function curveAt(ttk: readonly (number | null)[], distances: readonly number[], d: number): number {
  const v = (i: number) => ttk[i] ?? Infinity;
  if (d <= distances[0]!) return v(0);
  for (let i = 1; i < distances.length; i++) {
    if (d > distances[i]!) continue;
    const a = v(i - 1);
    const b = v(i);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return Math.max(a, b);
    const u = (d - distances[i - 1]!) / (distances[i]! - distances[i - 1]!);
    return a + (b - a) * u;
  }
  return v(distances.length - 1);
}

/**
 * How much faster (+) or slower (-) this gun kills at `dist` than the benchmark guns' median there, measured: from 1
 * (it kills at once, or nothing else can) to -1 (it can't kill there, or takes twice as long or more). A gun not in
 * hand (`held` false) pays its measured draw first: switching only pays when the new gun still wins after it. 0
 * without a measurement. weaponScore adds it, weighted, so a bot draws the gun that wins the fight at hand.
 */
export function ttkEdge(id: string, dist: number, held = true): number {
  const ttk = BOT_TTK[id];
  if (!ttk) return 0;
  const t = curveAt(ttk, BOT_TTK_DISTANCES, dist) + (held ? 0 : (BOT_DRAW_MS[id] ?? 0));
  const m = curveAt(median, BOT_TTK_DISTANCES, dist);
  if (!Number.isFinite(t)) return -1;
  if (!Number.isFinite(m)) return 1;
  return Math.max(-1, Math.min(1, (m - t) / Math.max(1, m)));
}

/**
 * The distances (m) a bot holding this gun tries to fight at: its band, starting where it gets the edge (a long gun
 * stays out of the range where everyday guns out-kill it). The band itself when it has no edge, or no measurement.
 */
export function botEdge(def: WeaponDefinition): readonly [number, number] {
  const band = botBand(def);
  const e = edges.get(def.id);
  return e && e[0] > band[0] && e[0] < band[1] - 2 ? [e[0], band[1]] : band;
}

/** The measured band for a weapon id, if it has one. */
export const measuredBand = (id: string): readonly [number, number] | undefined => bands.get(id);

/**
 * The range (m) a bot fights this gun at: its measured band; a launcher's near end kept outside its own blast (the
 * measurement's target takes the splash, the shooter doesn't); a gun without a measurement, its hand-set botRange.
 */
export function botBand(def: WeaponDefinition): readonly [number, number] {
  const m = bands.get(def.id);
  if (!m) return def.botRange;
  const splash = def.projectile && def.projectile.selfDamageScale > 0 ? def.projectile.splashRadius : 0;
  return splash > 0 && m[0] < splash + 1 ? [splash + 1, Math.max(m[1], splash + 3)] : m;
}
