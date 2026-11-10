import { getEnvSpecies } from '../content/environment.ts';
import { getKitFamily } from '../content/kitProps.ts';
import { createRng } from '../math.ts';
import { normalizeYaw } from './operations.ts';

/**
 * Randomise for the prop tool (MapMaker overhaul Phase 1, item 4): each placement gets a random turn, size and
 * variant within a range. Off by default. The rolls are seeded, so a test (and the ghost) know the next one: the
 * ghost shows roll `n`, the click places roll `n`, and the next roll is `n + 1`.
 */
export interface PropRandomOptions {
  on: boolean;
  /** Turn: 'any' (all the way round), a range either side of the tool's facing (degrees), or 0 (no random turn). */
  turn: 'any' | number;
  /** Size: up to this share bigger or smaller (0.1: ±10 %), kept within the prop's allowed scale. 0: no change. */
  size: number;
  /** A random variant, for props that have them (the environment's species: summer, autumn, snow…; the kit families). */
  variant: boolean;
}

export const PROP_RANDOM_DEFAULTS: PropRandomOptions = { on: false, turn: 'any', size: 0.1, variant: true };

/** The turn ranges the panel offers (degrees either side), 'any' first. */
export const PROP_RANDOM_TURNS: readonly (PropRandomOptions['turn'])[] = ['any', 90, 45, 15, 0];
/** The size ranges it offers. */
export const PROP_RANDOM_SIZES: readonly number[] = [0, 0.05, 0.1, 0.2, 0.3];

/** What one placement gets. */
export interface PropRoll {
  yaw: number;
  scale: number;
  /** The variant's index, or undefined for the first (or a prop without variants). */
  variant: number | undefined;
}

/** The scale every prop may take (the inspector's Scale field), and a species' own range within it. */
export const PROP_SCALE_RANGE: readonly [number, number] = [0.25, 4];

export function allowedScale(model: string): readonly [number, number] {
  const range = getEnvSpecies(model)?.placement.scale;
  if (!range) return PROP_SCALE_RANGE;
  return [Math.max(PROP_SCALE_RANGE[0], range[0]), Math.min(PROP_SCALE_RANGE[1], range[1])];
}

/**
 * Roll `n` for a prop of `model` from `seed`: the same seed, roll and options always give the same placement.
 * `yaw` is the tool's facing (R): the turn is around it. With randomise off, the plain placement.
 */
export function rollProp(model: string, yaw: number, opts: PropRandomOptions, seed: number, n: number): PropRoll {
  if (!opts.on) return { yaw, scale: 1, variant: undefined };
  // One stream per roll: mixing the roll into the seed keeps roll n the same whatever came before it.
  const rand = createRng(Math.imul((seed >>> 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(n + 1, 0xc2b2ae35));
  rand();
  const a = rand();
  const b = rand();
  const c = rand();
  const turn = opts.turn === 'any' ? a * Math.PI * 2 : ((a * 2 - 1) * opts.turn * Math.PI) / 180;
  const [lo, hi] = allowedScale(model);
  const raw = 1 + (b * 2 - 1) * opts.size;
  const scale = Math.round(Math.max(lo, Math.min(hi, raw)) * 100) / 100;
  // The environment's species (summer, autumn, snow…) and the kit families (content/kitProps.ts) have variants.
  const variants = (getEnvSpecies(model) ?? getKitFamily(model))?.variants ?? [];
  const pick = opts.variant && variants.length > 1 ? variants[Math.min(variants.length - 1, Math.floor(c * variants.length))]!.index : undefined;
  return { yaw: normalizeYaw(yaw + turn), scale, variant: pick === undefined || pick === variants[0]!.index ? undefined : pick };
}
