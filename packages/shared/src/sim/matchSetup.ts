import type { MapDocument } from '../map/schema.ts';
import { MAX_PLAYER_SLOTS, TICK_RATE } from './constants.ts';
import { MAX_TEAMS, mapTeams } from './npc.ts';
import { DEFAULT_RULES, GAME_MODES, MODE_LABELS, isGameMode, isTeamMode, mapCanRun, type GameMode, type MatchRules } from './rules.ts';

/**
 * Match setup (Play → match setup, saved setups): everything the player
 * chooses before a local match, in the shape it is saved in localStorage
 * (`cs.arcade`, older saves included), turned into MatchRules by
 * rulesFromSetup. Absent fields mean "the standard / the map's own".
 */
export interface MatchSetup {
  map: string;
  mode: GameMode;
  /** Free-for-all and co-op: bots besides you. */
  bots: number;
  skill: 'easy' | 'normal' | 'hard';
  scoreLimit: number;
  minutes: number;
  /** Team modes: players per team, 2–8 teams (two-team modes use the first two); bots fill every team. */
  teams?: number[];
  /** Team names and colours by team order (empty entries: the map's). */
  teamNames?: string[];
  teamColors?: string[];
  /** How people are put on teams (absent: balanced). */
  assign?: TeamAssign;
  /** assign 'fixed': the team you join, by order from 0. */
  playerTeam?: number;
  /** Co-op: play a playlist (scenario chain) instead of just this map. */
  playlist?: string;
  leaders?: 'on' | 'vip';
  sizes?: boolean;
  emotes?: boolean;
  botStyle?: 'arena' | 'tactical';
  killstreaks?: boolean;
  squadSpawn?: boolean;
  gravity?: number;
  fallDamage?: boolean;
  friendlyFire?: 'half' | 'on';
  spears?: boolean;
  discs?: boolean;
  vehicleDamage?: 'tough' | 'off';
  lethality?: 'arcade' | 'tactical';
  ballistics?: 'arcade' | 'advanced';
  /** Seconds before you respawn (absent: the mode's own). */
  respawn?: number;
  /** Capture the Flag / Fort Wars: seconds a dropped flag lies before it goes home (absent: 30). */
  flagReturn?: number;
  /** King of the Hill: seconds before the hill moves (absent: 60). */
  hill?: number;
  fortBuild?: number;
  fortCombat?: number;
  fortCycles?: number;
  fortBudget?: number;
  classes?: boolean;
  classLimit?: number;
  raceLaps?: number;
  raceVehicle?: 'kart' | 'speeder' | 'buggy';
  raceCombat?: boolean;
}

export type TeamAssign = 'balanced' | 'random' | 'fixed';

/** Largest single team (two of them fill MAX_PLAYER_SLOTS: 48 v 48). */
export const MAX_TEAM_SIZE = MAX_PLAYER_SLOTS / 2;

/** Modes that are always exactly two teams (attack/defend or one flag each). */
export const isTwoTeamMode = (mode: string): boolean => mode === 'core.ctf' || mode === 'core.forts' || mode === 'core.bomb' || mode === 'core.hostage';

/** Modes where everyone is on one side against the map (no teams, no free-for-all). */
export const isCoopMode = (mode: string): boolean => mode === 'core.coop' || mode === 'core.zombies';

/** A quick preset: it fills in an editable setup (team sizes, or a free-for-all player count). */
export interface SetupPreset {
  id: string;
  label: string;
  /** Team sizes (team modes). */
  sizes?: readonly number[];
  /** Free-for-all: players in all, you included. */
  ffa?: number;
}

/** The common shapes, offered in one click; every one starts an editable setup. */
export const SETUP_PRESETS: readonly SetupPreset[] = [
  { id: '1v1', label: '1v1', sizes: [1, 1] },
  { id: '2v2', label: '2v2', sizes: [2, 2] },
  { id: '4v4', label: '4v4', sizes: [4, 4] },
  { id: '8v8', label: '8v8', sizes: [8, 8] },
  { id: '16v16', label: '16v16', sizes: [16, 16] },
  { id: '24v24', label: '24v24', sizes: [24, 24] },
  { id: '48v48', label: '48v48', sizes: [48, 48] },
  { id: '2v2v2v2', label: '2v2v2v2', sizes: [2, 2, 2, 2] },
  { id: '4x4', label: '4×4 (four teams of four)', sizes: [4, 4, 4, 4] },
  { id: 'ffa8', label: 'FFA 8', ffa: 8 },
  { id: 'ffa16', label: 'FFA 16', ffa: 16 },
];

export const presetPlayers = (p: SetupPreset): number => p.ffa ?? (p.sizes ?? []).reduce((a, b) => a + b, 0);

/**
 * A team layout made valid for a mode: 2–8 teams (two-team modes: the first
 * two), whole sizes 1–48, and at most MAX_PLAYER_SLOTS in all (the largest
 * teams give way first). `fixes` says what was changed, for the player.
 */
export function validateTeamSizes(raw: readonly unknown[] | undefined, mode: GameMode, fallback: readonly number[] = [4, 4]): { sizes: number[]; fixes: string[] } {
  const fixes: string[] = [];
  let sizes = (Array.isArray(raw) && raw.length ? raw : fallback).map((v) => {
    const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : NaN;
    if (Number.isNaN(n)) fixes.push('A team size was not a number: set to 1');
    return Math.max(1, Math.min(MAX_TEAM_SIZE, Number.isNaN(n) ? 1 : n));
  });
  if (sizes.length > MAX_TEAMS) {
    fixes.push(`At most ${MAX_TEAMS} teams`);
    sizes = sizes.slice(0, MAX_TEAMS);
  }
  while (sizes.length < 2) sizes.push(sizes[0] ?? 1);
  if (isTwoTeamMode(mode) && sizes.length > 2) {
    fixes.push(`${MODE_LABELS[mode]} is always two teams`);
    sizes = sizes.slice(0, 2);
  }
  let total = sizes.reduce((a, b) => a + b, 0);
  if (total > MAX_PLAYER_SLOTS) fixes.push(`At most ${MAX_PLAYER_SLOTS} players in all`);
  while (total > MAX_PLAYER_SLOTS) {
    const big = sizes.indexOf(Math.max(...sizes));
    sizes[big]!--;
    total--;
  }
  return { sizes, fixes };
}

/** The team layout a setup plays on this map: its own, else the map's recommended one, else 4v4 (made valid for the mode). */
export function setupTeams(setup: Pick<MatchSetup, 'teams' | 'mode'>, map: MapDocument): number[] {
  return validateTeamSizes(setup.teams, setup.mode, map.teamSetup?.sizes ?? [4, 4]).sizes;
}

/** Everyone in the match, you and bots included. */
export function setupPlayers(setup: MatchSetup, map: MapDocument): number {
  return isTeamMode(setup.mode) ? setupTeams(setup, map).reduce((a, b) => a + b, 0) : Math.min(MAX_PLAYER_SLOTS, setup.bots + 1);
}

/** Every mode, and whether this map can play it (with the reason when it can't). `offered`: the modes the map lists (playableModes). */
export function modeOptions(map: MapDocument, offered: readonly GameMode[]): { mode: GameMode; ok: boolean; reason?: string }[] {
  return GAME_MODES.map((mode) => {
    if (offered.includes(mode)) return { mode, ok: true };
    return { mode, ok: false, reason: modeUnavailableReason(map, mode) };
  });
}

/** Why the map can't play a mode (for a greyed-out choice's tooltip). */
export function modeUnavailableReason(map: MapDocument, mode: GameMode): string {
  if (!mapCanRun(map, mode)) {
    switch (mode) {
      case 'core.bomb':
        return 'Needs bomb sites, and this map has none.';
      case 'core.hostage':
        return 'Needs hostages and a rescue zone, and this map has none.';
      case 'core.ctf':
      case 'core.forts':
        return 'Needs a flag base for each of the two teams.';
      case 'core.koth':
        return 'Needs hill spots, and this map has none.';
      case 'core.race':
        return 'Needs a race track, and this map has none.';
    }
  }
  if (mode === 'core.coop') return "This map isn't a co-op mission (it has no mission for a squad to play).";
  return `This map wasn't made for ${MODE_LABELS[mode]}.`;
}

/** A remark on a setup: a warning that doesn't stop the match, or a hint. */
export interface SetupNote {
  level: 'warn' | 'info';
  text: string;
}

/** Past this many players the setup suggests going easy on the computer; past the second, it warns. */
export const BIG_MATCH = 32;
export const HUGE_MATCH = 64;

/**
 * Warnings and hints for a setup on its map (none of them blocks the match):
 * more players than spawn points, past the map's recommended size, teams
 * without spawns of their own, the map's own team names, big-match load.
 */
export function setupNotes(setup: MatchSetup, map: MapDocument): SetupNote[] {
  const out: SetupNote[] = [];
  const players = setupPlayers(setup, map);
  const spawns = map.entities.filter((e) => e.kind === 'spawn');
  const team = isTeamMode(setup.mode);
  if (spawns.length && players > spawns.length && setup.mode !== 'core.race') out.push({ level: 'warn', text: `${players} players, ${spawns.length} spawn points: spawns will be shared, so players may appear close together.` });
  const rec = map.metadata.recommendedPlayers;
  if (players > rec.max) out.push({ level: 'warn', text: `The map is made for ${rec.min === rec.max ? rec.max : `${rec.min}–${rec.max}`} players; ${players} will be crowded.` });
  if (team) {
    const sizes = setupTeams(setup, map);
    const sides = mapTeams(map, sizes.length);
    const teamed = spawns.filter((s) => s.kind === 'spawn' && s.faction);
    if (teamed.length) {
      const without = sides.flatMap((t, i) => (teamed.some((s) => s.kind === 'spawn' && s.faction === t.id) ? [] : [setup.teamNames?.[i]?.trim() || t.name]));
      if (without.length) out.push({ level: 'warn', text: `${without.join(', ')} ${without.length === 1 ? 'has' : 'have'} no spawn points of ${without.length === 1 ? 'its' : 'their'} own on this map: ${without.length === 1 ? 'it uses' : 'they use'} the shared spawns.` });
    }
    if (map.factions.length >= 2) out.push({ level: 'info', text: `This map's sides are ${map.factions[0]!.name} and ${map.factions[1]!.name} (their bases and spawns); teams beyond them use the shared spawns.` });
    if (map.teamSetup && map.teamSetup.sizes.join() !== sizes.join()) out.push({ level: 'info', text: `The map suggests ${map.teamSetup.sizes.join('v')}.` });
  }
  if (players > HUGE_MATCH) out.push({ level: 'warn', text: `${players} players is a very big match: slower computers may stutter. Low graphics (Options) helps; bots think less often past ${BIG_MATCH}.` });
  else if (players > BIG_MATCH) out.push({ level: 'info', text: `${players} players: a big match. If it stutters, try Low graphics in Options.` });
  return out;
}

/**
 * The rules and player count (you and bots) a setup plays with. Team modes
 * take its team layout (validated), names, colours and assignment;
 * co-op and Zombies keep their own score and time rules.
 */
export function rulesFromSetup(setup: MatchSetup, map: MapDocument): { rules: MatchRules; fill: number } {
  const s = setup;
  const base = DEFAULT_RULES[s.mode];
  const rules: MatchRules = isCoopMode(s.mode) ? { ...base } : { ...base, scoreLimit: s.scoreLimit, timeLimitSeconds: s.minutes * 60 };
  if (s.sizes === false) rules.bodySizes = false;
  if (s.emotes === false) rules.emotes = false;
  if (s.botStyle) rules.botStyle = s.botStyle;
  if (s.killstreaks === false) rules.killstreaks = false;
  if (s.squadSpawn === false) rules.squadSpawn = false;
  if (s.gravity !== undefined) rules.gravity = s.gravity;
  if (s.fallDamage !== undefined) rules.fallDamage = s.fallDamage;
  if (s.friendlyFire) rules.friendlyFire = s.friendlyFire;
  if (s.spears) rules.weapons = 'spears';
  else if (s.discs) rules.weapons = 'discs';
  if (s.classes) {
    rules.classes = true;
    if (s.classLimit) rules.classLimit = s.classLimit;
  }
  if (s.vehicleDamage) rules.vehicleDamage = s.vehicleDamage;
  if (s.lethality) rules.lethality = s.lethality;
  if (s.ballistics) rules.ballistics = s.ballistics;
  if (s.respawn !== undefined) rules.respawnDelayTicks = Math.round(Math.max(0, Math.min(30, s.respawn)) * TICK_RATE);
  if (s.leaders && isTeamMode(s.mode)) rules.leaders = s.leaders === 'vip' ? 'vip' : true;
  if ((s.mode === 'core.ctf' || s.mode === 'core.forts') && s.flagReturn) rules.flagReturnSeconds = s.flagReturn;
  if (s.mode === 'core.koth' && s.hill) rules.hillSeconds = s.hill;
  if (s.mode === 'core.forts') {
    rules.timeLimitSeconds = 0;
    rules.fortBuildSeconds = Math.round((s.fortBuild ?? 2.5) * 60);
    rules.fortCombatSeconds = Math.round((s.fortCombat ?? 5) * 60);
    rules.fortCycles = s.fortCycles ?? 1;
    rules.fortBudget = s.fortBudget ?? 420;
  }
  if (s.mode === 'core.race') {
    if (s.raceLaps) rules.raceLaps = s.raceLaps;
    if (s.raceVehicle) rules.raceVehicle = s.raceVehicle;
    if (s.raceCombat !== undefined) rules.raceCombat = s.raceCombat;
  }
  if (!isTeamMode(s.mode)) return { rules, fill: Math.max(1, Math.min(MAX_PLAYER_SLOTS, s.bots + 1)) };
  const sizes = setupTeams(s, map);
  rules.teamSizes = sizes;
  const names = (s.teamNames ?? []).slice(0, sizes.length).map((n) => (typeof n === 'string' ? n.trim().slice(0, 24) : ''));
  const colors = (s.teamColors ?? []).slice(0, sizes.length).map((c) => (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c : ''));
  if (names.some(Boolean)) rules.teamNames = names;
  if (colors.some(Boolean)) rules.teamColors = colors;
  if (s.assign === 'random') rules.teamAssign = 'random';
  if (s.assign === 'fixed') {
    rules.teamAssign = 'fixed';
    rules.hostTeam = Math.max(0, Math.min(sizes.length - 1, Math.round(s.playerTeam ?? 0)));
  }
  return { rules, fill: sizes.reduce((a, b) => a + b, 0) };
}

const num = (v: unknown, min: number, max: number, dflt: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : dflt);

/**
 * A setup read back from storage (this version's or an older one's), or
 * null when it isn't one. The core fields are checked and clamped; the
 * optional ones are kept as they were saved (rulesFromSetup reads them
 * defensively). A mode the setup's map can't play falls back to `modes[0]`.
 */
export function normalizeSetup(raw: unknown, modes?: readonly GameMode[]): MatchSetup | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.map !== 'string' || !o.map) return null;
  let mode: GameMode = typeof o.mode === 'string' && isGameMode(o.mode) ? o.mode : (modes?.[0] ?? 'core.deathmatch');
  if (modes?.length && !modes.includes(mode)) mode = modes[0]!;
  const out = { ...(o as unknown as MatchSetup), mode };
  out.bots = Math.round(num(o.bots, 0, MAX_PLAYER_SLOTS - 1, 3));
  out.skill = o.skill === 'easy' || o.skill === 'hard' ? o.skill : 'normal';
  out.scoreLimit = Math.round(num(o.scoreLimit, 0, 1000, DEFAULT_RULES[mode].scoreLimit));
  out.minutes = num(o.minutes, 0, 120, 10);
  if (o.teams !== undefined) {
    if (Array.isArray(o.teams)) out.teams = validateTeamSizes(o.teams, 'core.tdm').sizes;
    else delete out.teams;
  }
  for (const k of ['teamNames', 'teamColors'] as const) if (out[k] !== undefined && !Array.isArray(out[k])) delete out[k];
  if (out.assign !== undefined && out.assign !== 'random' && out.assign !== 'fixed' && out.assign !== 'balanced') delete out.assign;
  if (out.playerTeam !== undefined) out.playerTeam = Math.round(num(out.playerTeam, 0, MAX_TEAMS - 1, 0));
  return out;
}
