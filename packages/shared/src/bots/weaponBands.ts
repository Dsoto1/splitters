import type { WeaponDefinition } from '../sim/weapons.ts';
import { BOT_TTK, BOT_TTK_DISTANCES } from './weaponBands.generated.ts';

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

const bands = new Map<string, readonly [number, number]>();
for (const [id, ttk] of Object.entries(BOT_TTK)) {
  const band = effectiveBand(ttk, BOT_TTK_DISTANCES);
  if (band) bands.set(id, band);
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
  const splash = def.projectile?.splashRadius ?? 0;
  return splash > 0 && m[0] < splash + 1 ? [splash + 1, Math.max(m[1], splash + 3)] : m;
}
