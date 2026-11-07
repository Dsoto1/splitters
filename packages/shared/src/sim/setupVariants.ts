import type { MapDocument } from '../map/schema.ts';
import { LUNAR_GRAVITY, mapPickPlayers, presetPatch, sizePresets, type MatchSetup } from './matchSetup.ts';
import { DEFAULT_RULES, GAME_MODES, MODE_LABELS, type GameMode } from './rules.ts';

/**
 * Mode variants and party presets (Play → match setup, under the mode chips).
 *
 * A variant is a fun-changing option a host switches on over a mode's core: Lunar, Roulette bodies, Classes,
 * Spears only, Discs only. Each is data: the setup fields it sets, the modes it is offered in, the variants it
 * can't be on with or needs, and why it can't be used on a map. The setup screen draws a chip per variant
 * from this table, so a new variant (the Roulette mode's Earned rerolls, Swap on kill, Jackpot rolls…; see
 * docs/ROULETTE_MODE_PLAN.md) is a new entry here (and the setting it sets), not new UI. Balance knobs
 * (lethality, ballistics, respawn…) stay in Advanced rules.
 *
 * A variant is on when its settings are, however they were set (here or one by one in Advanced rules): nothing
 * new is stored, so saved setups keep their shape.
 *
 * A party preset is a one-click bundle: a mode, variants and the map's own team layout.
 */

/** Settings a variant can switch: any optional MatchSetup field. */
export type VariantSettings = Partial<Omit<MatchSetup, 'map' | 'mode' | 'bots' | 'skill' | 'scoreLimit' | 'minutes' | 'scoreAuto' | 'timeAuto'>>;

export interface SetupVariant {
  id: string;
  label: string;
  /** What it does, for its chip's tooltip. */
  tip: string;
  /** The modes it is offered in (absent: every mode). */
  modes?: readonly GameMode[];
  /** The settings it sets when on. Off puts back each one it moved off the standard (the map's own, for gravity and fall damage). */
  sets: VariantSettings;
  /** Settings that belong to it and go when it's switched off (a class limit). */
  clears?: readonly (keyof VariantSettings)[];
  /** Variants it can't be on with: switching it on switches them off. */
  conflicts?: readonly string[];
  /** Variants it needs: switching it on switches them on, and switching one of them off switches it off. */
  needs?: readonly string[];
  /** Why it can't be switched on for this map and mode (greyed, with the reason), or null. `offered`: the map's modes. */
  unavailable?: (map: MapDocument, mode: GameMode, offered: readonly GameMode[]) => string | null;
  /**
   * On unless switched off (Roulette's standard features: signature loadouts, jackpot rolls, the streak pick): its
   * settings are on by the standard, and off writes each one false.
   */
  onByDefault?: boolean;
}

/** Modes with players fighting players and the weapons they pick up. */
const ARMED_PVP: readonly GameMode[] = ['core.deathmatch', 'core.tdm', 'core.ctf', 'core.koth', 'core.elim', 'core.bomb', 'core.hostage'];

/** Every variant, in the order its chips are drawn. */
export const SETUP_VARIANTS: readonly SetupVariant[] = [
  {
    id: 'lunar',
    label: 'Lunar',
    tip: 'Low gravity: high, floaty jumps and long drops, with fall damage off. A bonus point for a kill in the air, blasts that throw players about, floaty ragdolls, stronger jump pads, and a gravity storm every minute (a 3-second warning, then gravity shifts for a while).',
    // (Its extras come with its settings: rulesFromSetup plays them wherever Lunar is on, MatchRules.lunar.)
    sets: { gravity: LUNAR_GRAVITY, fallDamage: false },
  },
  {
    id: 'roulette',
    label: 'Roulette bodies',
    tip: "Everyone, you and the bots, plays a random character each life, with that character's own stats (size, health, speed, damage…).",
    // (The Roulette mode deals a new character every life anyway.)
    modes: GAME_MODES.filter((m) => m !== 'core.race' && m !== 'core.roulette'),
    sets: { randomChars: true, stats: true },
  },
  // Roulette (docs/ROULETTE_MODE_PLAN.md; sim/roulette.ts): its standard features, then its variants.
  {
    id: 'signature',
    label: 'Signature loadouts',
    tip: 'Each character spawns holding a weapon that suits it: the knight a spear, a soldier a rifle, an alien a ray gun (as the weapon set allows: else its main gun).',
    modes: ['core.roulette'],
    sets: { rlSignature: true },
    onByDefault: true,
  },
  {
    id: 'jackpots',
    label: 'Jackpot rolls',
    tip: 'Now and then a life rolls a jackpot (a glow, an announcer line, a better weapon and armour) or a tiny body; and a small character downing a large one scores a Giant Slayer bonus.',
    modes: ['core.roulette'],
    sets: { rlJackpots: true },
    onByDefault: true,
  },
  {
    id: 'streakpick',
    label: 'Streak pick',
    tip: '3 kills in one life earn a pick: at your next spawn, choose your character from 3 (each with its own jackpot chance).',
    modes: ['core.roulette'],
    sets: { rlPick: true },
    onByDefault: true,
  },
  {
    id: 'rerolls',
    label: 'Earned rerolls',
    tip: 'Every 2 kills earn a reroll token (2 at most): spend one while down to deal yourself a different next character. Never free.',
    modes: ['core.roulette'],
    sets: { rlRerolls: true },
  },
  {
    id: 'swap',
    label: 'Swap on kill',
    tip: "You become your victim's character at once, keeping your share of health and your weapons. The leader keeps changing.",
    modes: ['core.roulette'],
    sets: { rlSwap: true },
  },
  {
    id: 'variety',
    label: 'Variety bonus',
    tip: 'Bonus points for kills made as several different characters: a point each time the characters you have scored as reach another 3.',
    modes: ['core.roulette'],
    sets: { rlVariety: true },
  },
  {
    id: 'rlteams',
    label: 'Teams',
    tip: 'Play it as Team Deathmatch: everyone split into two sides, each player outlined in their team colour (random looks hide who is on which side).',
    modes: ['core.roulette'],
    sets: { rlTeams: true },
  },
  {
    id: 'classes',
    label: 'Classes',
    tip: 'Everyone picks one of nine classes, each with its own loadout, health, speed and ability (L or , in play). Advanced rules can cap how many on a team play the same class.',
    modes: ARMED_PVP,
    sets: { classes: true },
    clears: ['classLimit'],
    conflicts: ['spears', 'discs'],
  },
  {
    id: 'spears',
    label: 'Spears only',
    tip: 'Everyone holds one throwing spear: one hit kills, then go and fetch it back. No weapon, ammo or grenade pickups.',
    modes: ARMED_PVP,
    sets: { spears: true },
    conflicts: ['discs', 'classes'],
  },
  {
    id: 'discs',
    label: 'Discs only',
    tip: 'Everyone throws bouncing arena discs that knock players about without hurting them: knock rivals off the edge to score. No weapon pickups.',
    modes: ['core.deathmatch', 'core.tdm', 'core.koth', 'core.elim'],
    sets: { discs: true },
    conflicts: ['spears', 'classes'],
    unavailable: (_map, _mode, offered) => (offered.includes('core.discs') ? null : 'Discs knock players off instead of hurting them: it needs a map with edges to fall from (one with Disc Arena).'),
  },
];

/**
 * What a setting means when a setup leaves it out (the standard), for the settings variants switch. A variant
 * writes a setting only where it differs from this, so a setup stays as short as the player left it.
 */
const STANDARD: Partial<Record<keyof VariantSettings, unknown>> = {
  stats: true,
  sizes: true,
  randomChars: false,
  spears: false,
  discs: false,
  classes: false,
  killstreaks: true,
  squadSpawn: true,
  emotes: true,
  dropWeapons: true,
  mixPickups: false,
  rlSignature: true,
  rlJackpots: true,
  rlPick: true,
  rlRerolls: false,
  rlSwap: false,
  rlVariety: false,
  rlTeams: false,
};

/** A setting as the match plays it: the setup's, else the map's own (gravity, fall damage), else the standard. */
export function effectiveSetting(setup: MatchSetup, map: MapDocument, key: keyof VariantSettings): unknown {
  const v = setup[key];
  if (v !== undefined) return v;
  if (key === 'gravity') return map.physics?.gravity ?? 1;
  if (key === 'fallDamage') return map.physics?.fallDamage ?? false;
  return STANDARD[key];
}

export const getVariant = (id: string): SetupVariant | undefined => SETUP_VARIANTS.find((v) => v.id === id);

/** Whether a variant is on: every setting it sets is as it sets it (whether set here or in Advanced rules). */
export function variantOn(v: SetupVariant, setup: MatchSetup, map: MapDocument): boolean {
  return (Object.keys(v.sets) as (keyof VariantSettings)[]).every((k) => effectiveSetting(setup, map, k) === v.sets[k]);
}

/** A variant offered in a mode. */
export const variantFor = (v: SetupVariant, mode: GameMode): boolean => !v.modes || v.modes.includes(mode);

export interface VariantState {
  variant: SetupVariant;
  on: boolean;
  /** Why it can't be switched on here (only while it's off: one that's on can always be switched off). */
  disabled: string | null;
}

/** The variants a mode offers on a map, each with whether it's on and why it can't be switched on. */
export function variantStates(setup: MatchSetup, map: MapDocument, offered: readonly GameMode[]): VariantState[] {
  return SETUP_VARIANTS.filter((v) => variantFor(v, setup.mode)).map((variant) => {
    const on = variantOn(variant, setup, map);
    return { variant, on, disabled: on ? null : (variant.unavailable?.(map, setup.mode, offered) ?? null) };
  });
}

function write(out: MatchSetup, sets: VariantSettings): void {
  for (const k of Object.keys(sets) as (keyof VariantSettings)[]) {
    if (STANDARD[k] !== undefined && STANDARD[k] === sets[k]) delete out[k];
    else (out as unknown as Record<string, unknown>)[k] = sets[k];
  }
}

/** Whether a variant is on by the setup's own settings (no map: gravity and fall damage only when set). */
const setOn = (v: SetupVariant, setup: MatchSetup): boolean => (Object.keys(v.sets) as (keyof VariantSettings)[]).every((k) => (setup[k] ?? STANDARD[k]) === v.sets[k]);

function switchOff(out: MatchSetup, v: SetupVariant, seen: Set<string>): void {
  if (seen.has(v.id)) return;
  seen.add(v.id);
  // On by default: off says so (each of its settings false).
  if (v.onByDefault) {
    for (const k of Object.keys(v.sets) as (keyof VariantSettings)[]) (out as unknown as Record<string, unknown>)[k] = false;
    for (const d of SETUP_VARIANTS) if (d.needs?.includes(v.id)) switchOff(out, d, seen);
    return;
  }
  // Back to the standard (or the map's own) for each setting it moved; one it set to the standard stays.
  for (const k of Object.keys(v.sets) as (keyof VariantSettings)[]) if (STANDARD[k] === undefined || STANDARD[k] !== v.sets[k]) delete out[k];
  for (const k of v.clears ?? []) delete out[k];
  for (const d of SETUP_VARIANTS) if (d.needs?.includes(v.id)) switchOff(out, d, seen);
}

/**
 * A setup with a variant switched on or off (a new object; the old one is left as it was). On switches off the
 * variants it conflicts with and on the ones it needs; off puts its settings back and switches off those that
 * need it.
 */
export function setVariant(setup: MatchSetup, id: string, on: boolean): MatchSetup {
  const v = getVariant(id);
  const out: MatchSetup = { ...setup };
  if (!v) return out;
  if (!on) {
    switchOff(out, v, new Set());
    return out;
  }
  const seen = new Set<string>([v.id]);
  for (const c of v.conflicts ?? []) {
    const other = getVariant(c);
    if (other && setOn(other, out)) switchOff(out, other, seen);
  }
  for (const n of v.needs ?? []) {
    const need = getVariant(n);
    if (need) write(out, need.sets);
  }
  write(out, v.sets);
  return out;
}

// ------------------------------------------------------------------ party presets

export interface PartyPreset {
  id: string;
  label: string;
  /** What it plays like, in a line under its name. */
  line: string;
  /** Its mode: `teams` on a map with teams of its own (sides or a team layout), else `ffa`; whichever of them the map has. */
  mode: { teams?: GameMode; ffa?: GameMode };
  /** The variants it switches on; every other variant goes off (but those on by default, which stay on). */
  variants: readonly string[];
}

/** Whether a party preset wants a variant on: one it lists, or one on by default. */
const partyWants = (p: PartyPreset, v: SetupVariant): boolean => p.variants.includes(v.id) || !!v.onByDefault;

/**
 * One-click party bundles: a mode, its variants and the map's own team layout. Lunar Roulette plays the Roulette mode
 * (docs/ROULETTE_MODE_PLAN.md) with Lunar on; Roulette's standard features stay on (a preset leaves a variant that is on
 * by default on).
 */
export const PARTY_PRESETS: readonly PartyPreset[] = [
  {
    id: 'lunar_roulette',
    label: 'Lunar Roulette',
    line: 'Roulette on the moon: a new character every life, low gravity, air kills and a gravity storm every minute.',
    mode: { ffa: 'core.roulette' },
    variants: ['lunar'],
  },
  {
    id: 'spear_fight',
    label: 'Spear Fight',
    line: 'One throwing spear each: one hit kills, then go and fetch it back.',
    mode: { teams: 'core.tdm', ffa: 'core.deathmatch' },
    variants: ['spears'],
  },
];

/** Whether a map has teams of its own: a team layout, or spawn points by side. */
export const mapHasTeams = (map: MapDocument): boolean => !!map.teamSetup || map.entities.some((e) => e.kind === 'spawn' && !!e.faction);

/** The mode a party preset plays on a map (`offered`: the modes the map has), or null when the map has neither. */
export function partyMode(p: PartyPreset, map: MapDocument, offered: readonly GameMode[]): GameMode | null {
  const order = mapHasTeams(map) ? [p.mode.teams, p.mode.ffa] : [p.mode.ffa, p.mode.teams];
  return order.find((m): m is GameMode => !!m && offered.includes(m)) ?? null;
}

/** Why a party preset can't be used on a map, or null. */
export function partyUnavailable(p: PartyPreset, map: MapDocument, offered: readonly GameMode[]): string | null {
  const mode = partyMode(p, map, offered);
  if (!mode) return `This map has no ${[p.mode.ffa, p.mode.teams].flatMap((m) => (m ? [MODE_LABELS[m]] : [])).join(' or ')}.`;
  for (const id of p.variants) {
    const v = getVariant(id);
    if (!v || !variantFor(v, mode)) return `${v?.label ?? id} isn't offered in this mode.`;
    const why = v.unavailable?.(map, mode, offered);
    if (why) return why;
  }
  return null;
}

/** Whether a setup is a party preset: its mode, its variants on and every other one off (the team layout can be anything). */
export function partyOn(p: PartyPreset, setup: MatchSetup, map: MapDocument, offered: readonly GameMode[]): boolean {
  if (setup.mode !== partyMode(p, map, offered)) return false;
  return SETUP_VARIANTS.filter((v) => variantFor(v, setup.mode)).every((v) => variantOn(v, setup, map) === partyWants(p, v));
}

/**
 * A setup with a party preset applied (a new object): its mode (when the mode changes, its score follows the
 * suggestion for the size again: a score for another mode means nothing), its variants on and the others off, and
 * the map's own team layout for the mode (`deviceMax`: players this device runs; `pickPlayers`: the map's own
 * free-for-all count). Null when the map can't play it.
 */
export function applyParty(p: PartyPreset, setup: MatchSetup, map: MapDocument, offered: readonly GameMode[], o: { deviceMax: number; pickPlayers?: number }): MatchSetup | null {
  const mode = partyMode(p, map, offered);
  if (!mode || partyUnavailable(p, map, offered)) return null;
  let out: MatchSetup = mode === setup.mode ? { ...setup } : { ...setup, mode, scoreLimit: DEFAULT_RULES[mode].scoreLimit, scoreAuto: true };
  // Off: every variant it doesn't want, also one its mode doesn't offer (Spears only left on would play in Roulette).
  for (const v of SETUP_VARIANTS) if (!partyWants(p, v) && variantOn(v, out, map)) out = setVariant(out, v.id, false);
  for (const v of SETUP_VARIANTS) if (variantFor(v, mode) && partyWants(p, v) && !variantOn(v, out, map)) out = setVariant(out, v.id, true);
  const pick = sizePresets(mode, map, { deviceMax: o.deviceMax, pickPlayers: o.pickPlayers ?? mapPickPlayers(map.metadata.recommendedPlayers) }).find((x) => x.id === 'pick');
  if (pick) Object.assign(out, presetPatch(pick));
  if (out.playerTeam !== undefined && out.teams && out.playerTeam >= out.teams.length) out.playerTeam = out.teams.length - 1;
  return out;
}
