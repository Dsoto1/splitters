import { STATUS_BURN, STATUS_CHILL, STATUS_FROZEN, STATUS_POISON, STATUS_SLOW, type Vec3 } from '@tiletrigger/shared';
import type { LastingFx } from './lastingFx.ts';
import { ease } from './reduceFlashing.ts';

/**
 * The aura round another character that is burning, poisoned, slowed by goo, chilled or frozen (Binbun's Stylized
 * Status FX; content/vfx.json map.lasting `status.<kind>`): flames licking up round a burning one, green bubbles
 * off a poisoned one, pink bubbles off one stuck in goo, ice crystals round a chilled or frozen one. Drawing only:
 * what a status does, and for how long, is the simulation's.
 *
 * Lasting effects of the moment (game/lastingFx.ts, the first tier: someone near you on fire is news), but only
 * the nearest STATUS_FX_MAX characters within STATUS_FX_RANGE ask, so a burning crowd can't take the places of
 * the fires and gas around it. A character with no place keeps the plain look (the see-through shell in the
 * status' colour); a frozen one keeps its block of ice under the crystals either way. Never asked for your own
 * character: from its eyes an aura would be a sheet over the view, and the screen's tint already says it.
 */

/** Characters further than this from the camera keep the plain shell. */
export const STATUS_FX_RANGE = 40;
/** At most this many characters wear a pack aura at once (the nearest; low graphics has 4 lasting places in all, so one is always left for a fire). */
export const STATUS_FX_MAX = 3;

/**
 * How strong the aura is and how fast it comes up (level a second). A status lasts two to four seconds after the
 * last hit, so it comes up quickly, its particles already out (LastingPlace.prefill). With Reduce flashing on it is dimmer, runs at `calmSlow` of the pack's speed
 * (its flames and bubbles drift rather than lick and pop; LastingPlace.slow) and comes up more slowly.
 */
export const STATUS_FX = {
  level: 0.8,
  calmLevel: 0.65,
  rise: 3,
  calmRise: 0.8,
  calmSlow: 0.5,
} as const;

export type StatusFxKind = 'burn' | 'poison' | 'slow' | 'chill';

/** The aura for a character's status bits (the strongest, in the order of the plain shell's colours), or null. */
export function statusFxKind(bits: number): StatusFxKind | null {
  if (bits & STATUS_FROZEN) return 'chill';
  if (bits & STATUS_BURN) return 'burn';
  if (bits & STATUS_POISON) return 'poison';
  if (bits & STATUS_SLOW) return 'slow';
  if (bits & STATUS_CHILL) return 'chill';
  return null;
}

/**
 * The status bits the plain shell should still show for a character whose pack aura is drawn (`worn`): nothing,
 * except the block of ice round a frozen one, which says "can't move" and stays.
 */
export function plainStatus(bits: number, worn: boolean): number {
  if (!worn) return bits;
  return bits & STATUS_FROZEN ? STATUS_FROZEN : 0;
}

/** The aura's level after `dt` seconds: toward its strength while it is drawn, nothing while it isn't. */
export function statusFxLevel(level: number, drawn: boolean, dt: number, calm: boolean): number {
  if (!drawn) return 0;
  return ease(level, calm ? STATUS_FX.calmLevel : STATUS_FX.level, dt, calm ? STATUS_FX.calmRise : STATUS_FX.rise, 4);
}

interface Ask {
  slot: number;
  kind: StatusFxKind;
  at: Vec3;
  size: number;
  d2: number;
}

/** Asks the lasting effects for the auras: `ask` for each character in view with a status, then `flush` once a frame. */
export class StatusFx {
  private asks: Ask[] = [];
  private readonly levels = new Map<number, number>();
  private last = 0;

  constructor(private readonly lasting: Pick<LastingFx, 'want' | 'drawn'>) {}

  /** A live character (not your own) with status `bits`, standing at `feet`, `size` times the usual height, as seen from `cam`. */
  ask(slot: number, bits: number, feet: Vec3, size: number, cam: Vec3): void {
    const kind = statusFxKind(bits);
    if (!kind) return;
    const d2 = (feet.x - cam.x) ** 2 + (feet.y - cam.y) ** 2 + (feet.z - cam.z) ** 2;
    if (d2 > STATUS_FX_RANGE ** 2) return;
    this.asks.push({ slot, kind, at: { x: feet.x, y: feet.y + 0.95 * size, z: feet.z }, size, d2 });
  }

  /** Whether `slot`'s aura is drawn now (else its plain shell shows). */
  worn(slot: number): boolean {
    return this.lasting.drawn(`status:${slot}`);
  }

  /** Ask for the nearest characters' auras this frame (`now` in ms; `calm`: Reduce flashing on). */
  flush(now: number, calm: boolean): void {
    const dt = this.last ? Math.min(0.1, Math.max(0, (now - this.last) / 1000)) : 0;
    this.last = now;
    const near = this.asks.sort((a, b) => a.d2 - b.d2).slice(0, STATUS_FX_MAX);
    this.asks = [];
    const seen = new Set<number>();
    for (const a of near) {
      seen.add(a.slot);
      const id = `status:${a.slot}`;
      const level = statusFxLevel(this.levels.get(a.slot) ?? 0, this.lasting.drawn(id), dt, calm);
      this.levels.set(a.slot, level);
      this.lasting.want(id, `status.${a.kind}`, a.at, { size: a.size, level, range: STATUS_FX_RANGE, prefill: true, ...(calm ? { slow: STATUS_FX.calmSlow } : {}) });
    }
    for (const slot of this.levels.keys()) if (!seen.has(slot)) this.levels.delete(slot);
  }
}
