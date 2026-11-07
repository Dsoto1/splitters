import type { MapDocument, SpawnEntity } from '../map/schema.ts';
import { raceTrack } from '../map/track.ts';
import { BROWSER_MAX_PLAYERS, MAX_PLAYER_SLOTS, TICK_RATE } from './constants.ts';
import { MAX_TEAMS, mapTeams } from './npc.ts';
import { BREAKTHROUGH_POOL, BREAKTHROUGH_POOL_MAX, BREAKTHROUGH_SECTOR_SECONDS, DEFAULT_RULES, GAME_MODES, MODE_LABELS, SCORE_LIMIT_MAX, isGameMode, isTeamMode, isTwoTeamMode, mapCanRun, type GameMode, type MatchRules } from './rules.ts';
import { IMPROMPTU_MIN_PLAYERS } from './spawns.ts';
import { botSetInUse, validateBotSet, type BotSet } from './botSet.ts';
import { validBotCast } from '../content/botThemes.ts';
import { isWeaponSetId } from './weaponSets.ts';

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
  /**
   * The score limit (scoreAuto) and the time (timeAuto) follow the match's size, players and bots
   * (suggestedLimits), while true; false once the host sets them by hand (theirs stays, marked Custom, until
   * "Back to suggested"). Absent (a setup saved before suggestions, until normalizeSetup reads it, or one built in
   * code): scoreLimit and minutes play as they are.
   */
  scoreAuto?: boolean;
  timeAuto?: boolean;
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
  /** Character stats (absent: on). */
  stats?: boolean;
  /** Random characters each life (absent: off). */
  randomChars?: boolean;
  emotes?: boolean;
  botStyle?: 'arena' | 'tactical';
  /** Which looks random bots wear (content/botNames.ts): absent, the map's own; empty, every look; else groups and/or name themes. */
  botCast?: string[];
  killstreaks?: boolean;
  /** Mix up weapon pickups (absent: off). */
  mixPickups?: boolean;
  /** Drop weapon on death (absent: on). */
  dropWeapons?: boolean;
  /** Weapon set (sim/weaponSets.ts: standard, military, scifi, medieval, chaos, mixed). Absent: the map's default. */
  weaponSet?: string;
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
  /**
   * Breakthrough: a second round with the sides swapped (absent: one round). Its reinforcements per attacker are the
   * setup's `scoreLimit` and each sector's minutes its `minutes`, both following the size like any score and time.
   */
  btSwap?: boolean;
  /** The host's own bots (Bots step → Edit bots…; sim/botSet.ts). Absent: random bots. */
  botSet?: BotSet;
}

export type TeamAssign = 'balanced' | 'random' | 'fixed';

/** Largest single team (two of them fill MAX_PLAYER_SLOTS: 48 v 48). */
export const MAX_TEAM_SIZE = MAX_PLAYER_SLOTS / 2;

export { isTwoTeamMode } from './rules.ts';

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
export function validateTeamSizes(raw: readonly unknown[] | undefined, mode: GameMode, fallback: readonly number[] = [4, 4], cap = MAX_PLAYER_SLOTS): { sizes: number[]; fixes: string[] } {
  const fixes: string[] = [];
  let sizes = (Array.isArray(raw) && raw.length ? raw : fallback).map((v) => {
    const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : NaN;
    if (Number.isNaN(n)) fixes.push('A team size was not a number: set to 1');
    return Math.max(1, Math.min(MAX_TEAM_SIZE, cap - 1, Number.isNaN(n) ? 1 : n));
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
  if (total > cap) fixes.push(`At most ${cap} players in all`);
  while (total > cap) {
    const big = sizes.indexOf(Math.max(...sizes));
    sizes[big]!--;
    total--;
  }
  return { sizes, fixes };
}

/**
 * The team layout a setup plays on this map: its own, else the map's (its team setup, else its recommended most
 * split in two: 4v4 for the default 2–8), made valid for the mode and to fit `cap` players (the browser's
 * limit; the setup screen passes this device's, or a race grid's: playerCap).
 */
export function setupTeams(setup: Pick<MatchSetup, 'teams' | 'mode'>, map: MapDocument, cap = BROWSER_MAX_PLAYERS): number[] {
  const half = Math.max(1, Math.round(map.metadata.recommendedPlayers.max / 2));
  return validateTeamSizes(setup.teams, setup.mode, map.teamSetup?.sizes ?? [half, half], cap).sizes;
}

/** Everyone in the match, you and bots included (at most `cap`, as setupTeams). */
export function setupPlayers(setup: MatchSetup, map: MapDocument, cap = BROWSER_MAX_PLAYERS): number {
  return isTeamMode(setup.mode) ? setupTeams(setup, map, cap).reduce((a, b) => a + b, 0) : Math.max(1, Math.min(cap, setup.bots + 1));
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
      case 'core.breakthrough':
        return 'Needs sectors, with their objectives and both sides’ spawns, and this map has none.';
    }
  }
  if (mode === 'core.coop') return "This map isn't a co-op mission (it has no mission for a squad to play).";
  return `This map wasn't made for ${MODE_LABELS[mode]}.`;
}

/** Past this many players the setup suggests going easy on the computer; past the second, it warns; past the third (32 v 32's range), it names the computer it takes. */
export const BIG_MATCH = 32;
export const HUGE_MATCH = 40;
export const CROWD_MATCH = 48;

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);
const clampInt = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, Math.round(v)));
const spawnsOf = (map: MapDocument): SpawnEntity[] => map.entities.filter((e): e is SpawnEntity => e.kind === 'spawn');

// ------------------------------------------------------------------ people and bots

/**
 * How a mode's players are set up: teams; free-for-all (Deathmatch, Disc Arena); a squad against the map
 * (co-op, Zombies); racers on a grid. Presets and the player controls take their form from it.
 */
export type SetupFamily = 'teams' | 'ffa' | 'squad' | 'race';
export const setupFamily = (mode: GameMode): SetupFamily => (isTeamMode(mode) ? 'teams' : isCoopMode(mode) ? 'squad' : mode === 'core.race' ? 'race' : 'ffa');

/**
 * The team you play on before the match (by order, from 0): Fixed, the one you picked; Balanced, the first
 * (offline you are the only person); Random, null (you take a bot's place wherever you land).
 */
export function setupYourTeam(setup: Pick<MatchSetup, 'assign' | 'playerTeam'>, teams: number): number | null {
  if (setup.assign === 'random') return null;
  if (setup.assign === 'fixed') return Math.max(0, Math.min(teams - 1, Math.round(setup.playerTeam ?? 0)));
  return 0;
}

/** People on each team before the match: you on yours, nobody else (bots fill every place; friends who join take bots' places). */
export function setupPeople(setup: Pick<MatchSetup, 'assign' | 'playerTeam'>, teams: number): number[] {
  const you = setupYourTeam(setup, teams);
  return Array.from({ length: teams }, (_, i) => (i === you ? 1 : 0));
}

/** "1 bot", "23 bots" (`word`: "squadmate"…). */
export const countOf = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/** People, then bots: "You + 23 bots", "3 players + 9 bots", "24 bots", "You". `people`: you included. */
export function peopleAndBots(people: number, bots: number, word = 'bot'): string {
  if (people <= 0) return countOf(bots, word);
  const who = people === 1 ? 'You' : `${people} players`;
  return bots > 0 ? `${who} + ${countOf(bots, word)}` : who;
}

/**
 * The setup in a line, people apart from bots (a total in players reads as that many people): "You + 47 bots ·
 * 24v24"; online, with friends in, "3 players + 45 bots · 24v24"; free-for-all "You + 7 bots"; co-op "You + 3
 * squadmates". `people`: everyone who isn't a bot, you included.
 */
export function setupSummary(setup: MatchSetup, map: MapDocument, people = 1, cap = BROWSER_MAX_PLAYERS): string {
  const total = setupPlayers(setup, map, cap);
  const humans = Math.max(1, Math.min(total, people));
  const family = setupFamily(setup.mode);
  const line = peopleAndBots(humans, total - humans, family === 'squad' ? 'squadmate' : 'bot');
  return family === 'teams' ? `${line} · ${setupTeams(setup, map, cap).join('v')}` : line;
}

// ------------------------------------------------------------------ limits

/** The most players a setup can have here, and whose limit that is: this device's (deviceMaxPlayers), or a race track's grid. */
export interface PlayerCap {
  max: number;
  by: 'device' | 'grid';
}

/** A race's start grid: how many racers start in a vehicle (null: not a race, or no track). */
export function raceGrid(mode: GameMode, map: MapDocument): number | null {
  if (mode !== 'core.race') return null;
  return raceTrack(map)?.grid ?? null;
}

/** The cap on players for a mode on a map, given what this device runs (`deviceMax`, you and bots). */
export function playerCap(mode: GameMode, map: MapDocument, deviceMax: number): PlayerCap {
  const device = clampInt(deviceMax, 2, BROWSER_MAX_PLAYERS);
  const grid = raceGrid(mode, map);
  return grid !== null && grid < device ? { max: Math.max(2, grid), by: 'grid' } : { max: device, by: 'device' };
}

/**
 * Why a count stops where it does, in plain words: "24 per team is this computer's limit.", "48 players in all
 * is this computer's limit.", "8 racers fill this track's grid.". `device`: "this computer", "this phone".
 */
export function capMessage(cap: PlayerCap, o: { teams?: number; even?: boolean; device?: string } = {}): string {
  if (cap.by === 'grid') return `${cap.max} racers fill this track's grid.`;
  const whose = `${o.device ?? 'this computer'}'s limit`;
  if (o.teams && o.even) return `${Math.max(1, Math.min(MAX_TEAM_SIZE, Math.floor(cap.max / o.teams)))} per team is ${whose}.`;
  return `${cap.max} players${o.teams ? ' in all' : ''} is ${whose}.`;
}

// ------------------------------------------------------------------ changing teams

/** A team layout after a change, and why it stopped short of what was asked (a limit), if it did. */
export interface TeamChange {
  sizes: number[];
  stopped: string | null;
}

export interface TeamChangeOptions {
  /** People on each team (you; friends mid-match): a team never shrinks below them, nor below one player. */
  people: readonly number[];
  cap: PlayerCap;
  /** Even teams: every team changes alike, so they stay matched. */
  even: boolean;
  /** Whose limit the cap is, for the message ("this computer"). */
  device?: string;
}

/** What stops a team shrinking. */
export const TEAM_FLOOR_NOTE = 'Every team needs at least one player.';

/**
 * Bots on team `team` up (delta > 0) or down: the team grows or shrinks with them, since bots are what fill a
 * team (a team of 10 with 9 bots takes an eleventh, it doesn't refuse it). Even teams: every team changes alike.
 * A change stops at the cap (this device, a race grid), at MAX_TEAM_SIZE or at a team's people, and says why.
 */
export function changeTeamBots(sizes: readonly number[], team: number, delta: number, o: TeamChangeOptions): TeamChange {
  return setTeamSize(sizes, team, (sizes[team] ?? 1) + delta, o);
}

/** Team `team` to `size` players in all (typed in), as changeTeamBots: even teams all take that size. */
export function setTeamSize(sizes: readonly number[], team: number, size: number, o: TeamChangeOptions): TeamChange {
  const n = sizes.length;
  const cur = sizes[team] ?? 1;
  const want = Math.round(size);
  const floor = (i: number) => Math.max(1, o.people[i] ?? 0);
  const total = sum(sizes);
  // The most this team can reach: its share of the cap (even), or what the other teams leave.
  const top = o.even ? Math.min(MAX_TEAM_SIZE, Math.floor(o.cap.max / n)) : Math.min(MAX_TEAM_SIZE, o.cap.max - (total - cur));
  const bottom = o.even ? Math.max(...sizes.map((_, i) => floor(i))) : floor(team);
  let next = want;
  let stopped: string | null = null;
  if (want > cur && want > top) {
    // (A setup already over the cap, say one made on a bigger computer, never shrinks on a press of +.)
    next = Math.max(cur, top);
    stopped = top >= MAX_TEAM_SIZE ? `${MAX_TEAM_SIZE} is the most one team can have.` : capMessage(o.cap, { teams: n, even: o.even, device: o.device });
  } else if (want < bottom) {
    next = bottom;
    stopped = TEAM_FLOOR_NOTE;
  }
  return { sizes: o.even ? sizes.map(() => next) : sizes.map((s, i) => (i === team ? next : s)), stopped };
}

/** Even teams switched on: every team the size of the largest, as far as the cap allows. */
export function evenTeams(sizes: readonly number[], o: Omit<TeamChangeOptions, 'even'>): TeamChange {
  const n = sizes.length;
  const top = Math.max(1, Math.min(MAX_TEAM_SIZE, Math.floor(o.cap.max / n)));
  const want = Math.max(...sizes);
  const per = Math.max(...sizes.map((_, i) => Math.max(1, o.people[i] ?? 0)), Math.min(top, want));
  return { sizes: sizes.map(() => per), stopped: want > top ? capMessage(o.cap, { teams: n, even: true, device: o.device }) : null };
}

/**
 * A different number of teams (2–8; two-team modes stay two). A new team comes in at the others' size (even
 * teams) or the last team's; when that doesn't fit under the cap, even teams all shrink to fit and uneven ones
 * take what room is left, and the change says so.
 */
export function changeTeamCount(sizes: readonly number[], count: number, mode: GameMode, o: TeamChangeOptions): TeamChange {
  if (isTwoTeamMode(mode)) return { sizes: sizes.slice(0, 2), stopped: count !== 2 ? `${MODE_LABELS[mode]} is always two teams.` : null };
  const n = clampInt(count, 2, MAX_TEAMS);
  const over = count > MAX_TEAMS ? `${MAX_TEAMS} teams is the most.` : null;
  if (o.even) {
    const per = Math.max(...sizes);
    const fit = Math.max(1, Math.min(per, MAX_TEAM_SIZE, Math.floor(o.cap.max / n)));
    return { sizes: Array.from({ length: n }, () => fit), stopped: over ?? (fit < per ? capMessage(o.cap, { teams: n, even: true, device: o.device }) : null) };
  }
  const out = sizes.slice(0, n);
  let left = o.cap.max - sum(out);
  while (out.length < n) {
    const add = Math.max(1, Math.min(left, out[out.length - 1] ?? 2));
    out.push(add);
    left -= add;
  }
  // A new team that found no room: the largest teams give way.
  const fixed = validateTeamSizes(out, mode, undefined, o.cap.max).sizes;
  return { sizes: fixed, stopped: over ?? (fixed.join() !== out.join() ? capMessage(o.cap, { teams: n, device: o.device }) : null) };
}

// ------------------------------------------------------------------ presets

export type SizePresetId = 'duel' | 'small' | 'pick' | 'big' | 'max';

/**
 * A size preset, worked out from the map (its recommended size, its own team layout, its spawn points), the
 * mode and what this device runs, rather than picked from a fixed list. Team modes give team sizes, the rest
 * the players in all, you included.
 */
export interface SizePreset {
  id: SizePresetId;
  label: string;
  teams?: number[];
  players?: number;
  /** The layout in short: "12v12", "12 players", "squad of 4", "8 racers". */
  value: string;
  /** What it is, for its tooltip. */
  tip: string;
}

export interface PresetOptions {
  /** Teams to share the players out over (multi-team modes); two-team modes are always two. */
  teams?: number;
  /** Players this device runs (deviceMaxPlayers). */
  deviceMax: number;
  /** "this computer", "this phone". */
  device?: string;
  /** Free-for-all and squads: the map's own player count (the Arcade's starting bots, plus you). */
  pickPlayers?: number;
}

/** A map's own team layout (what a setup with no teams of its own plays): its team setup, else its recommended most split in two; made to fit `cap` players. */
export const mapPickTeams = (map: MapDocument, mode: GameMode, cap: number): number[] => setupTeams({ mode }, map, cap);

/** A map's own player count for free-for-all and squads: as many as it's made for, 4 to 12. */
export const mapPickPlayers = (rec: { max: number }): number => clampInt(Math.min(12, rec.max), 4, 12);

/**
 * The most a squad (co-op, Zombies) is offered on a map: its recommended size, from its team layout (every team's
 * players in all) or else its recommended most, and at most what this device runs (`cap`).
 */
export const squadRoom = (map: MapDocument, cap: number): number => clampInt(map.teamSetup ? sum(map.teamSetup.sizes) : map.metadata.recommendedPlayers.max, 1, Math.max(1, cap));

/**
 * The size presets for a mode on a map: Duel, Small, Map's pick, Big battle and Max (free-for-all the same in
 * players; a squad's Solo, Duo, Map's pick, Big squad and Max; a race's Duel, Small, Map's pick and Full grid).
 * Small is the fewest the map is made for (at least two a side); Map's pick its own layout; Big battle as many
 * as its recommended most and spawn points hold, or half again its pick when they hold no more; Max what this
 * device runs. Presets that come out the same as another are left out.
 */
export function sizePresets(mode: GameMode, map: MapDocument, o: PresetOptions): SizePreset[] {
  const family = setupFamily(mode);
  const cap = playerCap(mode, map, o.deviceMax);
  const rec = map.metadata.recommendedPlayers;
  const spawns = spawnsOf(map).length;
  const device = o.device ?? 'this computer';
  const roomFor = (pick: number) => {
    // Big battle: what the map is made for and has spawn points for; when that's no more than its pick, half again.
    const fits = Math.min(rec.max, spawns || rec.max);
    return fits > pick ? fits : Math.round(pick * 1.5);
  };
  const out: SizePreset[] = [];
  if (family === 'teams') {
    const n = isTwoTeamMode(mode) ? 2 : clampInt(o.teams ?? 2, 2, MAX_TEAMS);
    const top = Math.max(1, Math.min(MAX_TEAM_SIZE, Math.floor(cap.max / n)));
    const even = (per: number) => Array.from({ length: n }, () => clampInt(per, 1, top));
    const pick = mapPickTeams(map, mode, cap.max);
    const pickPer = Math.ceil(sum(pick) / n);
    const add = (id: SizePresetId, label: string, teams: number[], tip: string) => out.push({ id, label, teams, value: teams.join('v'), tip });
    add('duel', 'Duel', [1, 1], 'One on one: you against a bot (or a friend who joins).');
    add('small', 'Small', even(Math.min(Math.max(2, Math.ceil(rec.min / n)), Math.max(2, pickPer - 1))), `A small match: the fewest this map is made for (${rec.min}), at least two a side.`);
    add('pick', "Map's pick", pick, map.teamSetup ? "The map's own team layout: what its maker set it up for." : `What the map is made for: up to ${rec.max} players.`);
    add('big', 'Big battle', even(Math.max(pickPer + 1, Math.floor(roomFor(sum(pick)) / n))), `As many as the map has room for: its recommended most (${rec.max}) and its ${spawns} spawn points, or half again its own layout.`);
    add('max', 'Max', even(top), `The most ${device} runs: ${n * top} players.`);
  } else {
    const word = family === 'race' ? 'racers' : 'players';
    const value = (n: number) => (family === 'squad' ? (n === 1 ? 'you alone' : n === 2 ? 'you + 1' : `squad of ${n}`) : `${n} ${word}`);
    const add = (id: SizePresetId, label: string, players: number, tip: string) => out.push({ id, label, players: clampInt(players, 1, cap.max), value: value(clampInt(players, 1, cap.max)), tip });
    const grid = raceGrid(mode, map);
    const pick = clampInt(family === 'race' ? Math.min(rec.max, grid ?? rec.max) : (o.pickPlayers ?? mapPickPlayers(rec)), 1, cap.max);
    if (family === 'squad') {
      // No squad beyond what the map is made for (owner, 2026-11-06): its team layout in all, else its recommended most.
      const room = squadRoom(map, cap.max);
      const most = map.teamSetup ? `${room} (its team layout, ${map.teamSetup.sizes.join('v')}, in all)` : `${room}`;
      add('duel', 'Solo', 1, 'Just you against the map.');
      add('small', 'Duo', Math.min(2, room), 'You and one bot squadmate.');
      add('pick', "Map's pick", Math.min(pick, room), `The squad the map is made for (up to ${room}).`);
      add('big', 'Big squad', Math.min(pick * 2, room), "Twice the map's own squad, as far as the map is made for.");
      add('max', 'Max', room, room < squadRoom(map, BROWSER_MAX_PLAYERS) ? `The most ${device} runs: ${room}.` : `The most the map is made for: ${most}.`);
    } else {
      add('duel', 'Duel', 2, 'One on one: you against a bot (or a friend who joins).');
      add('small', 'Small', Math.min(Math.max(4, Math.min(rec.min, pick - 2)), pick - 1), `A small match: the fewest this map is made for (${rec.min}).`);
      add('pick', "Map's pick", pick, family === 'race' ? `What the track is made for: up to ${Math.min(rec.max, grid ?? rec.max)} racers.` : `What the map is made for: up to ${rec.max} players.`);
      if (family === 'race') add('max', cap.by === 'grid' ? 'Full grid' : 'Max', cap.max, cap.by === 'grid' ? `Every place on the grid: ${cap.max}.` : `The most ${device} runs: ${cap.max}.`);
      else {
        add('big', 'Big battle', Math.max(pick + 1, roomFor(pick)), `As many as the map has room for: its recommended most (${rec.max}) and its ${spawns} spawn points, or half again its pick.`);
        add('max', 'Max', cap.max, `The most ${device} runs: ${cap.max} players.`);
      }
    }
  }
  // One button per layout: the map's pick first, then Max over Big battle, Duel over Small; sizes that only go up.
  const key = (p: SizePreset) => p.teams?.join() ?? String(p.players);
  const total = (p: SizePreset) => (p.teams ? sum(p.teams) : p.players!);
  const pick = out.find((p) => p.id === 'pick')!;
  const max = out.find((p) => p.id === 'max');
  const duel = out.find((p) => p.id === 'duel')!;
  return out.filter((p) => {
    if (p.id === 'pick') return true;
    if (key(p) === key(pick)) return false;
    if (p.id === 'small') return key(p) !== key(duel) && total(p) < total(pick) && total(p) > total(duel);
    if (p.id === 'duel') return total(p) < total(pick);
    if (p.id === 'big') return !!max && key(p) !== key(max) && total(p) > total(pick) && total(p) < total(max);
    return total(p) > total(pick);
  });
}

/** The preset a setup is on right now, or null when it's been changed from all of them (Custom). */
export function matchingPreset(setup: MatchSetup, map: MapDocument, presets: readonly SizePreset[], cap = BROWSER_MAX_PLAYERS): SizePreset | null {
  if (isTeamMode(setup.mode)) {
    const sizes = setupTeams(setup, map, cap).join();
    return presets.find((p) => p.teams?.join() === sizes) ?? null;
  }
  const players = setupPlayers(setup, map, cap);
  return presets.find((p) => p.players === players) ?? null;
}

/** What a preset sets in a setup: the team sizes, or the bots besides you. */
export const presetPatch = (p: SizePreset): Pick<MatchSetup, 'teams'> | Pick<MatchSetup, 'bots'> => (p.teams ? { teams: [...p.teams] } : { bots: Math.max(0, (p.players ?? 1) - 1) });

// ------------------------------------------------------------------ score and time

/** A match's score limit and its length in minutes (0: no limit). */
export interface MatchLimits {
  scoreLimit: number;
  minutes: number;
}

/**
 * Modes whose score limit and time follow the match's size: Team Deathmatch and Deathmatch (kills), Capture the
 * Flag (the time: captures stay) and King of the Hill (hill seconds with the time). Rounds modes (Elimination,
 * Bomb, Hostage Rescue), co-op and Zombies, Fort Wars, Disc Arena and races keep their own.
 */
export const limitsScale = (mode: GameMode): boolean => mode === 'core.tdm' || mode === 'core.deathmatch' || mode === 'core.ctf' || mode === 'core.koth' || mode === 'core.breakthrough';

/**
 * Breakthrough's suggestions by players a side (the setup's "score" is reinforcements per attacker, its time each
 * sector's minutes): up to 16 a side 6 reinforcements an attacker, big teams a little less (many deaths add up
 * quickly), and a sector's time grows with the teams (bigger maps, longer pushes): up to 4 a side 6 and 3 min, up to
 * 16 a side 6 and 4 min, beyond 5 and 5 min. (Small teams were suggested 8: bot attackers broke through in 7 of 8
 * matches on the Breakthrough Range; the owner, 2026-11-07: 6.)
 */
export const breakthroughPoolFor = (perTeam: number): number => (perTeam <= 16 ? 6 : 5);
export const breakthroughMinutesFor = (perTeam: number): number => (perTeam <= 4 ? 3 : perTeam <= 16 ? 4 : 5);

/** How far a score steps from `v` (a stepper's − and +), and what a worked-out score rounds to: 5 under 50, 10 under 300, 50 under 1,000, then 100. */
export const scoreStep = (v: number): number => (v < 50 ? 5 : v < 300 ? 10 : v < 1000 ? 50 : 100);

/** A worked-out score rounded to its step, so it reads well (480 → 500, 96 → 100, 43 → 45). */
export const niceScore = (v: number): number => {
  const step = scoreStep(v);
  return Math.max(step, Math.min(SCORE_LIMIT_MAX, Math.round(v / step) * step));
};

/** Minutes a team match suggests by players a side: 10 up to 6, 15 up to 16, 20 beyond (owner, 2026-11-06). */
export const teamMinutes = (perTeam: number): number => (perTeam <= 6 ? 10 : perTeam <= 16 ? 15 : 20);

/**
 * Team Deathmatch: points a team's score limit asks of each of its players per minute of the time limit. Bots
 * score about 1.3 (the leading team's points per player per minute, the middle of 5–7 maps at each size from 1v1
 * to 24v24: 0.9 to 1.5, and 1.9 at 6v6 on the small maps made for it; Bot AI Phase A's bots the same within a seed's
 * spread: docs/BOTS.md, "Score and time"), so the score falls due near the time limit: on the middle map at 70–115%
 * of it, on a crowded little arena sooner, and a sprawling map runs out of time first.
 */
export const TDM_POINTS_PER_PLAYER_MINUTE = 1;

/**
 * Deathmatch: the leader's kills a match suggests, per square root of the players (10 minutes). The leader's kill
 * rate grows about as √players (1.8 a minute with 2 players, 3.8 with 8, 5–7 with 16–32), so the score grows
 * gently: 15 for 2 players, 35 for 8, 50 for 16, 70 for 32.
 */
export const DM_KILLS_PER_ROOT_PLAYER = 12;

/** King of the Hill: hill seconds to win per minute of the match (120 in 10 minutes, as before). */
export const HILL_SECONDS_PER_MINUTE = 12;

/**
 * The score limit and time a match suggests for its size: `players` in all (you and bots), and in team modes the
 * `teams` (each team's players: the largest leads the score). Fitted to how fast bots score (pnpm bot-report,
 * 2026-11-06; docs/BOTS.md, "Score and time"), so the score is usually reached near the time limit rather than in
 * two minutes, and it meets the owner's anchors (4v4 about 40 points in 10 minutes, 24v24 about 500 in 15–20):
 * - Team Deathmatch: a point per player per minute of the time limit (a team of n, `teamMinutes`: n × minutes):
 *   1v1 10, 4v4 40, 6v6 60 (10 min); 8v8 120, 12v12 180, 16v16 240 (15 min); 24v24 500, 48v48 950 (20 min).
 * - Deathmatch: the leader's kills, gently up with the players (12 × √players), 10 minutes.
 * - Capture the Flag: the mode's captures (3), the time with the teams' size.
 * - King of the Hill: the time with the teams' size, hill seconds with the time (12 a minute).
 * - Everything else: the mode's own score, 10 minutes (as a setup always started).
 */
export function suggestedLimits(mode: GameMode, players: number, teams?: readonly number[]): MatchLimits {
  const all = Math.max(1, Math.round(players));
  const perTeam = Math.max(1, ...(teams?.length ? teams : [Math.ceil(all / 2)]));
  switch (mode) {
    case 'core.tdm': {
      const minutes = teamMinutes(perTeam);
      return { scoreLimit: niceScore(perTeam * minutes * TDM_POINTS_PER_PLAYER_MINUTE), minutes };
    }
    case 'core.deathmatch':
      return { scoreLimit: niceScore(DM_KILLS_PER_ROOT_PLAYER * Math.sqrt(all)), minutes: 10 };
    case 'core.ctf':
      return { scoreLimit: DEFAULT_RULES[mode].scoreLimit, minutes: teamMinutes(perTeam) };
    case 'core.koth': {
      const minutes = teamMinutes(perTeam);
      return { scoreLimit: minutes * HILL_SECONDS_PER_MINUTE, minutes };
    }
    case 'core.breakthrough':
      return { scoreLimit: breakthroughPoolFor(perTeam), minutes: breakthroughMinutesFor(perTeam) };
    default:
      return { scoreLimit: DEFAULT_RULES[mode].scoreLimit, minutes: 10 };
  }
}

/** A setup's score limit and time as it plays, the suggestion for its size, and which follow it (the rest are the host's own: Custom). */
export interface SetupLimits extends MatchLimits {
  suggested: MatchLimits;
  auto: { score: boolean; time: boolean };
}

/**
 * The score limit and time a setup plays here (`cap`: as setupTeams, so a setup saved on a bigger computer
 * suggests for what it plays on a phone): the suggestion for its size where it follows it (scoreAuto, timeAuto),
 * else its own.
 */
export function setupLimits(setup: MatchSetup, map: MapDocument, cap = BROWSER_MAX_PLAYERS): SetupLimits {
  const teams = isTeamMode(setup.mode) ? setupTeams(setup, map, cap) : undefined;
  const suggested = suggestedLimits(setup.mode, teams ? sum(teams) : setupPlayers(setup, map, cap), teams);
  const auto = { score: setup.scoreAuto === true, time: setup.timeAuto === true };
  return { scoreLimit: auto.score ? suggested.scoreLimit : setup.scoreLimit, minutes: auto.time ? suggested.minutes : setup.minutes, suggested, auto };
}

/** The setup with its stored score limit and time made what it plays (the suggestion where it follows it), for saving. */
export function withSetupLimits(setup: MatchSetup, map: MapDocument, cap = BROWSER_MAX_PLAYERS): MatchSetup {
  const l = setupLimits(setup, map, cap);
  return l.scoreLimit === setup.scoreLimit && l.minutes === setup.minutes ? setup : { ...setup, scoreLimit: l.scoreLimit, minutes: l.minutes };
}

// ------------------------------------------------------------------ fit

export type FitLevel = 'fits' | 'crowded' | 'problem';
export type FitTopic = 'device' | 'grid' | 'size' | 'spawns' | 'teams' | 'performance';

/** One line of the fit check: what it found about one thing, how much that matters, and a fix when there is one. */
export interface FitItem {
  topic: FitTopic;
  level: 'ok' | 'info' | 'warn' | 'problem';
  text: string;
  /** A suggestion's button: "Use 12v12" (team sizes) or "Use 8 racers" (players in all, you included). */
  fix?: { label: string; teams?: number[]; players?: number };
}

export interface SetupFit {
  level: FitLevel;
  /** "Fits", "Crowded", "Problem". */
  label: string;
  items: FitItem[];
}

export const FIT_LABELS: Record<FitLevel, string> = { fits: 'Fits', crowded: 'Crowded', problem: 'Problem' };

/**
 * How well a setup fits its map and this device, as one verdict (Fits, Crowded, Problem) with the details
 * behind it, in this order: what the device runs, a race's grid, the map's recommended size (and its own
 * layout, with a button to use it), its spawn points, teams without spawns of their own, how heavy the match
 * is. Only real problems are red: racers who would start on foot, more players than this device runs, far more
 * (over twice) than the map is made for. Nothing here stops the match.
 */
export function setupFit(setup: MatchSetup, map: MapDocument, o: { deviceMax: number; device?: string; pickPlayers?: number }): SetupFit {
  const items: FitItem[] = [];
  const family = setupFamily(setup.mode);
  const rec = map.metadata.recommendedPlayers;
  const recText = rec.min === rec.max ? `${rec.max}` : `${rec.min}–${rec.max}`;
  const device = o.device ?? 'this computer';
  const cap = playerCap(setup.mode, map, o.deviceMax);
  // What it plays with here (this device's limit, a race's grid), and what it asks for.
  const players = setupPlayers(setup, map, cap.max);
  const asked = setupPlayers(setup, map);
  const unit = family === 'race' ? 'racers' : 'players';
  const sizes = family === 'teams' ? setupTeams(setup, map, cap.max) : [];
  const pick = family === 'teams' ? mapPickTeams(map, setup.mode, cap.max) : [];
  const pickPlayers = clampInt(family === 'race' ? Math.min(rec.max, raceGrid(setup.mode, map) ?? rec.max) : (o.pickPlayers ?? mapPickPlayers(rec)), 1, cap.max);
  const atPick = family === 'teams' ? sizes.join() === pick.join() : players === pickPlayers;
  const pickFix: NonNullable<FitItem['fix']> = family === 'teams' ? { label: `Use ${pick.join('v')}`, teams: pick } : { label: `Use ${pickPlayers} ${unit}`, players: pickPlayers };

  // A setup made on a bigger computer, or a race with more racers than places on the grid, plays what fits here.
  const grid = raceGrid(setup.mode, map);
  if (asked > players) {
    const plays = family === 'teams' ? sizes.join('v') : `${players} ${unit}`;
    items.push(cap.by === 'grid'
      ? { topic: 'grid', level: 'info', text: `${grid} places on the grid: ${players} race (this setup asks for ${asked}).` }
      : { topic: 'device', level: 'info', text: `This setup asks for ${asked} ${unit}; ${device} runs ${cap.max}, so it plays ${plays}.` });
  } else if (grid !== null) items.push({ topic: 'grid', level: 'ok', text: `${grid} places on the grid: every racer starts in a vehicle.` });
  // The map's size, and its own layout when this isn't it.
  const suggest = family === 'teams' && map.teamSetup && !atPick ? ` The map suggests ${pick.join('v')}.` : '';
  if (players > rec.max * 2) items.push({ topic: 'size', level: 'problem', text: `The map is made for ${recText} players: ${players} is far more than it has room for.${suggest}`, ...(atPick ? {} : { fix: pickFix }) });
  else if (players > rec.max) items.push({ topic: 'size', level: 'warn', text: `The map is made for ${recText} players: ${players} will be crowded.${suggest}`, ...(atPick ? {} : { fix: pickFix }) });
  else if (players < rec.min) items.push({ topic: 'size', level: 'info', text: `The map is made for ${recText} players: ${players} will feel empty.${suggest}`, ...(atPick ? {} : { fix: pickFix }) });
  else items.push({ topic: 'size', level: suggest ? 'info' : 'ok', text: `The map is made for ${recText} players: ${players} fit.${suggest}`, ...(suggest ? { fix: pickFix } : {}) });
  // Spawn points: one each, else shared (the match makes more of its own for big matches).
  const spawns = spawnsOf(map);
  if (family !== 'race' && spawns.length) {
    const sided = family === 'teams' ? spawns.filter((s) => s.faction).length : 0;
    const where = sided ? ` (${sided} on the teams' sides, ${spawns.length - sided} shared)` : '';
    if (players > spawns.length) {
      const extra = players >= IMPROMPTU_MIN_PLAYERS ? ' The match adds spawn points of its own on open ground.' : '';
      items.push({ topic: 'spawns', level: 'warn', text: `${players} players, ${spawns.length} spawn points${where}: spawns will be shared, so players may appear close together.${extra}` });
    } else items.push({ topic: 'spawns', level: 'ok', text: `${spawns.length} spawn points${where} for ${players} players: one each.` });
  }
  if (family === 'teams') {
    const sides = mapTeams(map, sizes.length);
    const teamed = spawns.filter((s) => s.faction);
    if (teamed.length) {
      const without = sides.flatMap((t, i) => (teamed.some((s) => s.faction === t.id) ? [] : [setup.teamNames?.[i]?.trim() || t.name]));
      const one = without.length === 1;
      const pool = teamed.length < spawns.length ? 'the shared spawns' : "the other teams' spawns, away from enemies";
      if (without.length) items.push({ topic: 'teams', level: 'warn', text: `${without.join(', ')} ${one ? 'has' : 'have'} no spawn points of ${one ? 'its' : 'their'} own on this map: ${one ? 'it uses' : 'they use'} ${pool}.` });
    }
    if (map.factions.length >= 2 && sizes.length > 2) items.push({ topic: 'teams', level: 'info', text: `This map's sides are ${map.factions[0]!.name} and ${map.factions[1]!.name} (their bases and spawns); teams beyond them use the shared spawns.` });
  }
  if (players > CROWD_MATCH) items.push({ topic: 'performance', level: 'warn', text: `${players} players is a crowd for one computer: a recent desktop or a fast laptop runs it; slower ones will stutter. Low or Medium graphics helps; bots think less often past ${BIG_MATCH}.` });
  else if (players > HUGE_MATCH) items.push({ topic: 'performance', level: 'warn', text: `${players} players is a very big match: slower computers may stutter. Low graphics helps; bots think less often past ${BIG_MATCH}.` });
  else if (players > BIG_MATCH) items.push({ topic: 'performance', level: 'info', text: `${players} players: a big match. If it stutters, try Low graphics.` });
  else items.push({ topic: 'performance', level: 'ok', text: `${players} ${unit}: light enough for most computers.` });
  const level: FitLevel = items.some((i) => i.level === 'problem') ? 'problem' : items.some((i) => i.level === 'warn') ? 'crowded' : 'fits';
  return { level, label: FIT_LABELS[level], items };
}

/**
 * The rules and player count (you and bots) a setup plays with. Team modes
 * take its team layout (validated), names, colours and assignment;
 * co-op and Zombies keep their own score and time rules. The score limit and
 * time are the suggestion for the size where the setup follows it
 * (setupLimits). `cap`: the most players (as setupTeams).
 */
export function rulesFromSetup(setup: MatchSetup, map: MapDocument, cap = BROWSER_MAX_PLAYERS): { rules: MatchRules; fill: number } {
  const s = setup;
  const base = DEFAULT_RULES[s.mode];
  const limits = isCoopMode(s.mode) ? null : setupLimits(s, map, cap);
  const rules: MatchRules = limits ? { ...base, scoreLimit: limits.scoreLimit, timeLimitSeconds: limits.minutes * 60 } : { ...base };
  if (s.sizes === false) rules.bodySizes = false;
  if (s.stats === false) rules.characterStats = false;
  if (s.randomChars) rules.randomCharacters = true;
  if (s.emotes === false) rules.emotes = false;
  if (s.botStyle) rules.botStyle = s.botStyle;
  if (Array.isArray(s.botCast)) rules.botCast = validBotCast(s.botCast);
  if (s.killstreaks === false) rules.killstreaks = false;
  if (s.mixPickups) rules.mixPickups = true;
  if (s.dropWeapons === false) rules.dropWeapons = false;
  if (isWeaponSetId(s.weaponSet)) rules.weaponSet = s.weaponSet;
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
  if (s.mode === 'core.breakthrough' && limits) {
    // The mode ends the match itself: the setup's score is reinforcements per attacker, its time each sector's.
    rules.breakthroughPool = Math.max(1, Math.min(BREAKTHROUGH_POOL_MAX, Math.round(limits.scoreLimit) || BREAKTHROUGH_POOL));
    rules.breakthroughSectorSeconds = Math.max(60, Math.round(limits.minutes * 60) || BREAKTHROUGH_SECTOR_SECONDS);
    rules.scoreLimit = 0;
    rules.timeLimitSeconds = 0;
    if (s.btSwap) rules.breakthroughSwap = true;
  }
  if (!isTeamMode(s.mode)) return { rules, fill: Math.max(1, Math.min(cap, s.bots + 1)) };
  const sizes = setupTeams(s, map, cap);
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
  out.bots = Math.round(num(o.bots, 0, BROWSER_MAX_PLAYERS - 1, 3));
  out.skill = o.skill === 'easy' || o.skill === 'hard' ? o.skill : 'normal';
  out.scoreLimit = Math.round(num(o.scoreLimit, 0, SCORE_LIMIT_MAX, DEFAULT_RULES[mode].scoreLimit));
  out.minutes = num(o.minutes, 0, 120, 10);
  // Score and time follow the size unless set by hand. A setup saved before suggestions set them by hand where they
  // differ from what every setup started with (the mode's standard score, 10 minutes); a score for a mode the map
  // can't play here means nothing, so it follows too.
  out.scoreAuto = o.mode !== mode || (typeof o.scoreAuto === 'boolean' ? o.scoreAuto : out.scoreLimit === DEFAULT_RULES[mode].scoreLimit);
  out.timeAuto = typeof o.timeAuto === 'boolean' ? o.timeAuto : out.minutes === 10;
  if (o.teams !== undefined) {
    if (Array.isArray(o.teams)) out.teams = validateTeamSizes(o.teams, 'core.tdm', undefined, BROWSER_MAX_PLAYERS).sizes;
    else delete out.teams;
  }
  for (const k of ['teamNames', 'teamColors'] as const) if (out[k] !== undefined && !Array.isArray(out[k])) delete out[k];
  if (out.assign !== undefined && out.assign !== 'random' && out.assign !== 'fixed' && out.assign !== 'balanced') delete out.assign;
  if (out.playerTeam !== undefined) out.playerTeam = Math.round(num(out.playerTeam, 0, MAX_TEAMS - 1, 0));
  // A weapon set this build doesn't have (a setup saved by another version): the map's default instead.
  if (out.weaponSet !== undefined && !isWeaponSetId(out.weaponSet)) delete out.weaponSet;
  if (o.botSet !== undefined) {
    const v = validateBotSet(o.botSet)?.set;
    if (v && botSetInUse(v)) out.botSet = v;
    else delete out.botSet;
  }
  return out;
}
