import type { Liquid, MapEntity } from '../map/schema.ts';
import type { Vec3 } from '../math.ts';
import { TICK_RATE } from './constants.ts';

/** A body of liquid as movement and damage see it (axis-aligned). */
export interface LiquidBox {
  min: Vec3;
  max: Vec3;
  liquid: Liquid;
}

/** The map's water, lava, acid and swamp (shared by the server and client prediction so both swim the same). */
export function mapLiquids(entities: readonly MapEntity[]): LiquidBox[] {
  const out: LiquidBox[] = [];
  for (const e of entities) {
    if (e.kind !== 'water') continue;
    const [x, y, z] = e.position;
    const [w, h, d] = e.size;
    out.push({ min: { x: x - w / 2, y, z: z - d / 2 }, max: { x: x + w / 2, y: y + h, z: z + d / 2 }, liquid: e.liquid });
  }
  return out;
}

/** The liquid a point is in, if any. */
export function liquidAt(liquids: readonly LiquidBox[], p: Vec3): LiquidBox | null {
  for (const l of liquids) if (p.x >= l.min.x && p.x <= l.max.x && p.z >= l.min.z && p.z <= l.max.z && p.y >= l.min.y && p.y <= l.max.y) return l;
  return null;
}

/** How each liquid treats you: speed swimming and wading, and damage per second while your feet are in it. */
export const LIQUID_SPECS: Record<Liquid, { swim: number; wade: number; dps: number; label: string }> = {
  water: { swim: 0.7, wade: 0.85, dps: 0, label: 'Water' },
  swamp: { swim: 0.45, wade: 0.6, dps: 0, label: 'Swamp' },
  acid: { swim: 0.6, wade: 0.8, dps: 15, label: 'Acid' },
  lava: { swim: 0.5, wade: 0.7, dps: 45, label: 'Lava' },
};

/** Chest height above the feet: deeper than this you swim. */
export const SWIM_DEPTH = 1.0;
/** Seconds you can stay under water before drowning starts (then 10 damage a second). */
export const BREATH_SECONDS = 15;

/**
 * Jetpack fuel in whole units so the server and client prediction count it
 * identically: thrusting costs JET.burn a tick, resting recovers JET.regen.
 */
export const JET = {
  burn: 3,
  /** Recovered per tick while not thrusting: a full tank in 6 s. */
  regen: 2,
  max: 4 * TICK_RATE * 3,
  /** Upward acceleration while thrusting (m/s², net of gravity) and top climbing speed. */
  accel: 22,
  maxUp: 6.5,
};

/** One tick of fuel: thrusting burns it, otherwise it trickles back. */
export const stepJetFuel = (fuel: number, thrusting: boolean): number => (thrusting ? Math.max(0, fuel - JET.burn) : Math.min(JET.max, fuel + JET.regen));
