/**
 * Combat rules for map makers (GUNPLAY G5, docs/GUNPLAY_SPEC.md "Phase G5 — Creator Controls"; owner, 2026-11-24): a
 * small safe set of match-wide knobs, never per weapon, so every gun keeps its identity:
 *
 * - headshots: off (a head hit counts as the body), normal (each weapon's own head multiple), high (its head bonus doubled);
 * - ammo: normal, unlimited (reserves never run down), scarce (half the spawn and pickup ammo);
 * - reloads: on, or off (the magazine feeds straight from the reserve: no reloading at all);
 * - bullets through walls: on (energy-based penetration, spec §8), or off (cover stops every round; glass still breaks);
 * - damage scale and health scale: 0.5×, 1×, 1.5×, 2× (health is effective health, as Lethality's: damage taken by
 *   players and bots is divided by it, so the HUD's bar and every heal keep their meaning).
 *
 * A map saves its defaults (MapDocument.combatRules, map format v56; MapMaker's Map settings); the host may change each
 * one (MatchRules, Match Setup's Rules tab); what is set nowhere plays the standard. The host's sim reads the resolved
 * rules (combatRulesOf) once per match; the client resolves the same from the rules and the map it was sent (prediction,
 * the gun report).
 */

export const HEADSHOT_RULES = ['off', 'normal', 'high'] as const;
export type HeadshotRule = (typeof HEADSHOT_RULES)[number];
export const AMMO_RULES = ['normal', 'unlimited', 'scarce'] as const;
export type AmmoRule = (typeof AMMO_RULES)[number];
/** The damage and health scales a map or host may pick. */
export const COMBAT_SCALES = [0.5, 1, 1.5, 2] as const;

/** The knobs as a map saves them and MatchRules carries them: each absent means "not set here". */
export interface CombatRules {
  headshots?: HeadshotRule;
  ammo?: AmmoRule;
  /** false: no reloads (the magazine feeds from the reserve). */
  reloads?: boolean;
  /** false: bullets never pass through walls or objects (glass still breaks). */
  wallPenetration?: boolean;
  /** Damage multiple on everything a player, bot or NPC deals to players, bots and NPCs (falls and hazards untouched). */
  damageScale?: number;
  /** Effective health multiple of players and bots. */
  healthScale?: number;
}

/** The knobs' keys (in combatKeys.ts: the menu's first download needs only these, docs/LOADING.md). */
export { COMBAT_RULE_KEYS } from './combatKeys.ts';
import { COMBAT_RULE_KEYS } from './combatKeys.ts';

/** The rules a match plays, everything filled in. */
export interface CombatPlay {
  headshots: HeadshotRule;
  ammo: AmmoRule;
  reloads: boolean;
  wallPenetration: boolean;
  damageScale: number;
  healthScale: number;
}

export const STANDARD_COMBAT: Readonly<CombatPlay> = Object.freeze({ headshots: 'normal', ammo: 'normal', reloads: true, wallPenetration: true, damageScale: 1, healthScale: 1 });

const isScale = (v: unknown): v is number => typeof v === 'number' && (COMBAT_SCALES as readonly number[]).includes(v);
const isHead = (v: unknown): v is HeadshotRule => typeof v === 'string' && (HEADSHOT_RULES as readonly string[]).includes(v);
const isAmmo = (v: unknown): v is AmmoRule => typeof v === 'string' && (AMMO_RULES as readonly string[]).includes(v);

/** Only the valid knobs of `o` (anything else dropped): what a setup, server rules or a hand-made file may hold. */
export function cleanCombatRules(o: unknown): CombatRules {
  const out: CombatRules = {};
  if (!o || typeof o !== 'object') return out;
  const r = o as Record<string, unknown>;
  if (isHead(r.headshots)) out.headshots = r.headshots;
  if (isAmmo(r.ammo)) out.ammo = r.ammo;
  if (typeof r.reloads === 'boolean') out.reloads = r.reloads;
  if (typeof r.wallPenetration === 'boolean') out.wallPenetration = r.wallPenetration;
  if (isScale(r.damageScale)) out.damageScale = r.damageScale;
  if (isScale(r.healthScale)) out.healthScale = r.healthScale;
  return out;
}

/** The map's saved combat rules, as play reads them (absent or empty: none). */
export const mapCombatRules = (map: { combatRules?: CombatRules | null } | null | undefined): CombatRules => cleanCombatRules(map?.combatRules);

/** What a match plays: the host's choice for each knob, else the map's, else the standard. */
export function combatRulesOf(rules: CombatRules, map?: { combatRules?: CombatRules | null } | null): CombatPlay {
  const host = cleanCombatRules(rules);
  const own = mapCombatRules(map);
  return {
    headshots: host.headshots ?? own.headshots ?? STANDARD_COMBAT.headshots,
    ammo: host.ammo ?? own.ammo ?? STANDARD_COMBAT.ammo,
    reloads: host.reloads ?? own.reloads ?? STANDARD_COMBAT.reloads,
    wallPenetration: host.wallPenetration ?? own.wallPenetration ?? STANDARD_COMBAT.wallPenetration,
    damageScale: host.damageScale ?? own.damageScale ?? STANDARD_COMBAT.damageScale,
    healthScale: host.healthScale ?? own.healthScale ?? STANDARD_COMBAT.healthScale,
  };
}

/** Whether a match plays the standard combat rules throughout. */
export const standardCombat = (p: CombatPlay): boolean => COMBAT_RULE_KEYS.every((k) => p[k] === STANDARD_COMBAT[k]);

/** A weapon's head multiple under the rule: off counts a head as the body (1), high doubles the bonus over the body. */
export function headMultiple(head: number, rule: HeadshotRule): number {
  if (rule === 'off') return Math.min(1, head);
  if (rule === 'high' && head > 1) return 1 + (head - 1) * 2;
  return head;
}

/** Whether a head hit counts as a headshot (the killfeed's mark, the head hit sound): not with headshots off. */
export const headshotsCount = (p: Pick<CombatPlay, 'headshots'>): boolean => p.headshots !== 'off';

/** Ammo a spawn or pickup hands over under the rule (scarce: half, rounded up, at least one when there was any). */
export function ammoGiven(n: number, rule: AmmoRule): number {
  if (rule !== 'scarce' || n <= 0) return n;
  return Math.max(1, Math.ceil(n / 2));
}

/** A weapon's ammo, as the feed sees it (WeaponState's fields). */
export interface FedWeapon {
  def: { magazine: number; reserveMax: number };
  mag: number;
  reserve: number;
  unchambered?: boolean;
  off?: { mag: number; unchambered?: boolean };
}

/**
 * Reloads off: the magazine (and a second gun's) topped up from the reserve, a round chambered. With unlimited ammo
 * the reserve is full first, so the gun never runs dry. Returns whether anything changed.
 */
export function feedMagazine(w: FedWeapon, p: Pick<CombatPlay, 'ammo' | 'reloads'>): boolean {
  let changed = false;
  if (p.ammo === 'unlimited' && w.def.reserveMax > 0 && w.reserve < w.def.reserveMax) {
    w.reserve = w.def.reserveMax;
    changed = true;
  }
  if (p.reloads || w.def.magazine <= 0) return changed;
  const fill = (box: { mag: number; unchambered?: boolean }) => {
    const take = Math.min(w.def.magazine - box.mag, w.reserve);
    if (take > 0) {
      box.mag += take;
      w.reserve -= take;
      changed = true;
    }
    if (box.unchambered && box.mag > 0) {
      box.unchambered = undefined;
      changed = true;
    }
  };
  fill(w);
  if (w.off) fill(w.off);
  return changed;
}

/** The labels the menus, MapMaker and summaries use. */
export const HEADSHOT_LABELS: Record<HeadshotRule, string> = { off: 'Off', normal: 'Normal', high: 'High' };
export const AMMO_RULE_LABELS: Record<AmmoRule, string> = { normal: 'Normal', unlimited: 'Unlimited', scarce: 'Scarce' };
export const scaleLabel = (v: number): string => `${v}×`;

/** Short words for what differs from the standard ("Headshots off", "Unlimited ammo", "Damage 2×"), in knob order. */
export function combatSummary(p: CombatPlay): string[] {
  const out: string[] = [];
  if (p.headshots !== 'normal') out.push(p.headshots === 'off' ? 'Headshots off' : 'High headshots');
  if (p.ammo !== 'normal') out.push(p.ammo === 'unlimited' ? 'Unlimited ammo' : 'Scarce ammo');
  if (!p.reloads) out.push('No reloads');
  if (!p.wallPenetration) out.push('No wallbangs');
  if (p.damageScale !== 1) out.push(`Damage ${scaleLabel(p.damageScale)}`);
  if (p.healthScale !== 1) out.push(`Health ${scaleLabel(p.healthScale)}`);
  return out;
}
