/**
 * Character stats (docs/CHARACTERS.md, "Character stats"): each look may set its own health, speed, size, damage
 * dealt, stamina, jump, melee strength and armor (`stats` in content/characters/<id>.json). A stat a look leaves
 * out is its size class's value (BODY_SIZES; the class has no say in the last five, so they are everyone's: 1, or 0
 * armor), so nothing changes until a field is set. The match setting Character stats (MatchRules.characterStats,
 * default on) off ignores every look's own stats: everyone plays their size class (and with Character sizes: All
 * equal, standard).
 */
import { getLook } from '../content/looks.ts';
import { BODY_SIZES, type BodySize } from './constants.ts';

export interface CharacterStats {
  /** Health on spawn and the most health pickups give. */
  health: number;
  /** Movement speed, a multiple of everyone's. */
  speed: number;
  /** Body size: height, width and eyes, a multiple of a 1.8 m standard body (the collider and the hit shapes). */
  size: number;
  /** Damage dealt with guns, grenades and other non-melee attacks, a multiple. */
  damage: number;
  /** How long sprinting lasts (stamina drains this many times slower). */
  stamina: number;
  /** Jump speed, a multiple (1.1 jumps about 21% higher). */
  jump: number;
  /** Damage dealt with melee (knives, axes, punches and kicks), a multiple. */
  melee: number;
  /** Share of incoming damage shrugged off (0 to 0.4), before any armor pickup. */
  armor: number;
}
export type StatKey = keyof CharacterStats;

/** Every stat in display order, with its range (what a manifest may set) and how Character Select shows it. */
export const STAT_SPECS: readonly { key: StatKey; label: string; min: number; max: number; step: number; help: string }[] = [
  { key: 'health', label: 'Health', min: 50, max: 200, step: 5, help: 'Health on spawn (standard 100; small 85, large 115).' },
  { key: 'speed', label: 'Speed', min: 0.8, max: 1.25, step: 0.01, help: 'Movement speed, a multiple of everyone\'s (small 1.06, large 0.94).' },
  { key: 'size', label: 'Size', min: 0.7, max: 1.3, step: 0.01, help: 'Body size, a multiple of a 1.8 m body (small 0.78, large 1.18): how big a target, and the gaps it fits through.' },
  { key: 'damage', label: 'Damage', min: 0.75, max: 1.3, step: 0.01, help: 'Damage dealt with guns and grenades, a multiple.' },
  { key: 'stamina', label: 'Stamina', min: 0.5, max: 2, step: 0.05, help: 'How long sprinting lasts, a multiple.' },
  { key: 'jump', label: 'Jump', min: 0.8, max: 1.3, step: 0.01, help: 'Jump speed, a multiple (1.1 jumps about a fifth higher).' },
  { key: 'melee', label: 'Melee', min: 0.5, max: 2, step: 0.05, help: 'Damage dealt with knives, axes, punches and kicks, a multiple.' },
  { key: 'armor', label: 'Armor', min: 0, max: 0.4, step: 0.01, help: 'Share of incoming damage shrugged off (0.1: a tenth).' },
];
export const STAT_KEYS: readonly StatKey[] = STAT_SPECS.map((s) => s.key);

/** A size class's stats: what every look of that size plays with unless it sets its own. */
export function classStats(size: BodySize): CharacterStats {
  const c = BODY_SIZES[size];
  return { health: c.health, speed: c.speed, size: c.scale, damage: 1, stamina: 1, jump: 1, melee: 1, armor: 0 };
}

/** Problems with a look's `stats` (a manifest's): unknown fields, values out of range. */
export function statsProblems(stats: unknown): string[] {
  if (stats === undefined) return [];
  if (!stats || typeof stats !== 'object' || Array.isArray(stats)) return ['stats: { health, speed, size, damage, stamina, jump, melee, armor }'];
  const out: string[] = [];
  for (const [k, v] of Object.entries(stats)) {
    const spec = STAT_SPECS.find((s) => s.key === k);
    if (!spec) out.push(`stats.${k}: unknown (${STAT_KEYS.join(', ')})`);
    else if (typeof v !== 'number' || !Number.isFinite(v) || v < spec.min || v > spec.max) out.push(`stats.${k}: ${spec.min}–${spec.max}`);
  }
  return out;
}

/**
 * The stats a look plays with: its size class's (standard when `sizes` is off), then its own `stats` (when `stats`
 * is on). With sizes off its own size is ignored too: everyone is a standard body.
 */
export function lookStats(look: string | undefined, rules: { sizes?: boolean; stats?: boolean } = {}): CharacterStats {
  // An NPC skin (`npc:<role>`) is a standard body.
  if (look?.startsWith('npc:')) return classStats('standard');
  const l = getLook(look);
  const sizes = rules.sizes !== false;
  const out = classStats(sizes ? (l.size ?? 'standard') : 'standard');
  if (rules.stats === false || !l.stats) return out;
  for (const k of STAT_KEYS) {
    const v = l.stats[k];
    if (v === undefined || (k === 'size' && !sizes)) continue;
    out[k] = v;
  }
  return out;
}

/** The stats a match plays a look with (its Character sizes and Character stats settings). */
export const matchStats = (look: string | undefined, rules: { bodySizes?: boolean; characterStats?: boolean }): CharacterStats => lookStats(look, { sizes: rules.bodySizes !== false, stats: rules.characterStats !== false });
