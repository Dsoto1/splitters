import type { FireMode, FireModeSpec, WeaponDefinition } from './weapons.ts';
import { gunplayOf, type KickSpec } from './gunplay.ts';

/**
 * Switchable fire modes (docs/GUNPLAY_SPEC.md §36). A weapon lists its modes in `fireModes` (the first is its own
 * trigger); the player switches with a key and the mode they want rides in every input (`PlayerInput.fireMode`), so
 * the host applies it and client prediction replays it like any other part of the input. Weapons without a list have
 * one mode: their own trigger, read through here as well, so the Burst Rifle and the semi-autos fire exactly as before.
 */
export interface Firing {
  /** Which mode (index into `fireModes`; 0 for a weapon without them). */
  index: number;
  mode: FireMode;
  label: string;
  /** Ticks from one trigger pull to the next (a burst: its first round to the next burst's). */
  interval: number;
  burst: { count: number; intervalTicks: number } | null;
  /** Mechanical recoil in this mode (the weapon's, with the mode's overrides). */
  kick: KickSpec | null;
}

/** Most modes a weapon may list (the input carries a small index). */
export const MAX_FIRE_MODES = 4;

const LABEL: Record<FireMode, string> = { auto: 'Auto', semi: 'Single', burst: 'Burst' };
const cache = new WeakMap<WeaponDefinition, Firing[]>();

/** How many modes a weapon switches between (1: no switch). */
export const fireModeCount = (def: WeaponDefinition): number => Math.min(MAX_FIRE_MODES, def.fireModes?.length ?? 1);

/** A wanted mode index made safe for a weapon (anything out of range is its first mode). */
export function clampFireMode(def: WeaponDefinition, index: number | undefined): number {
  const n = fireModeCount(def);
  return Number.isInteger(index) && index! >= 0 && index! < n ? index! : 0;
}

/** The next mode round (the switch key). */
export const nextFireMode = (def: WeaponDefinition, index: number): number => (clampFireMode(def, index) + 1) % fireModeCount(def);

/** What the trigger does in mode `index` (cached). */
export function firingOf(def: WeaponDefinition, index = 0): Firing {
  let list = cache.get(def);
  if (!list) {
    const own: FireModeSpec = def.fireModes?.[0] ?? { mode: def.fireMode ?? 'auto', label: LABEL[def.fireMode ?? 'auto'] };
    const base = gunplayOf(def).kick;
    const modes = def.fireModes?.slice(0, MAX_FIRE_MODES) ?? [own];
    list = modes.map((m, i) => {
      const burst = m.mode === 'burst' ? (m.burst ?? def.burst ?? null) : null;
      return {
        index: i,
        mode: m.mode,
        label: m.label,
        interval: i === 0 ? def.fireIntervalTicks : (m.fireIntervalTicks ?? def.fireIntervalTicks),
        burst: i === 0 ? (m.mode === 'burst' ? (def.burst ?? null) : null) : burst,
        kick: i > 0 && m.kick && base ? { ...base, ...m.kick } : base,
      };
    });
    cache.set(def, list);
  }
  return list[clampFireMode(def, index)]!;
}
