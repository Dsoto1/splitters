import type { MapDocument } from '../map/schema.ts';
import { MAX_PLAYER_SLOTS, TICK_RATE } from './constants.ts';
import { teamCount } from './hostRules.ts';
import { isCoopMode, isTwoTeamMode } from './matchSetup.ts';
import { MAX_TEAMS } from './npc.ts';
import { GAME_MODES, MODE_LABELS, isGameMode, isTeamMode, rulesForMode, type GameMode, type MatchRules } from './rules.ts';

/**
 * A dedicated server's match rules (the Host Service's RULES setting, its
 * console's `rules` command and the launcher's Match rules card): every rule
 * a browser host sets in Play → Match setup and the pause menu's Match panel,
 * kept by the server and applied to every match it plays (a restart, a map
 * change, the rotation's next map), not only the first. Values are plain JSON
 * (numbers, booleans, words) so they sit in host.json as the owner wrote them.
 *
 * `score`, `time` and `respawn` mean different things in different modes, so
 * they are kept per mode (`modes.tdm.score`); everything else is for every
 * mode. `maps.<id>` overrides any of them on one map (a longer time limit on
 * a big map, low gravity on another). Absent: the mode's / the map's own.
 */
export interface ServerRules {
  [key: string]: unknown;
  /** Per mode ("tdm", "ctf"…): score, time, respawn. */
  modes?: Partial<Record<string, Record<string, unknown>>>;
  /** Per map (its ID): any rule, over the rest. */
  maps?: Record<string, Record<string, unknown>>;
}

/**
 * When a change reaches the running match (as for a browser host):
 * `live` at once; `restart` at the next restart or match (the pause menu's "Apply on restart" rules);
 * `next` at the next match (Restart match, a map change or the rotation's next map: the browser host sets
 * these in Match setup, before its match starts).
 */
export type RuleApply = 'live' | 'restart' | 'next';

export type RuleType =
  | { kind: 'int'; min: number; max: number; step?: number; unit?: string; zero?: string }
  | { kind: 'choice'; values: readonly (readonly [string, string])[] }
  | { kind: 'bool'; on: string; off: string }
  | { kind: 'list'; max: number; pattern?: RegExp };

export interface RuleSpec {
  /** The console word and the setting's key in RULES. */
  key: string;
  label: string;
  help: string;
  type: RuleType;
  apply: RuleApply;
  /** Kept per mode (score, time and respawn mean different things in different modes). */
  perMode?: boolean;
  /** The modes it means anything in (absent: all). */
  modes?: (mode: GameMode) => boolean;
  /** Its value in a match's rules (what plays now). */
  read(r: MatchRules): unknown;
  /** Set it in a match's rules (only called where `modes` allows). */
  write(r: MatchRules, v: unknown): void;
}

const notCoop = (m: GameMode) => !isCoopMode(m);
const teamMode = (m: GameMode) => isTeamMode(m);
const onOff = { kind: 'bool', on: 'On', off: 'Off' } as const;
const choice = (...values: [string, string][]): RuleType => ({ kind: 'choice', values });

/** Every rule, in the order the console and the launcher list them. */
export const SERVER_RULES: readonly RuleSpec[] = [
  {
    key: 'score', label: 'Score limit', help: 'The score that wins (0: none). Per mode: kills in Deathmatch and Team Deathmatch, captures in CTF, rounds in Elimination…', type: { kind: 'int', min: 0, max: 1000, zero: 'none' }, apply: 'restart', perMode: true,
    modes: (m) => notCoop(m) && m !== 'core.race', read: (r) => r.scoreLimit, write: (r, v) => (r.scoreLimit = v as number),
  },
  {
    key: 'time', label: 'Time limit', help: 'Minutes until the match ends (0: no limit). Per mode.', type: { kind: 'int', min: 0, max: 120, unit: 'min', zero: '∞' }, apply: 'restart', perMode: true,
    modes: (m) => notCoop(m) && m !== 'core.forts', read: (r) => Math.round(r.timeLimitSeconds / 60), write: (r, v) => (r.timeLimitSeconds = (v as number) * 60),
  },
  {
    key: 'respawn', label: 'Respawn delay', help: 'Seconds before players are back in. Rounds modes and Zombies wait for the next round or wave instead. Per mode.', type: { kind: 'int', min: 0, max: 30, unit: 's' }, apply: 'restart', perMode: true,
    read: (r) => Math.round(r.respawnDelayTicks / TICK_RATE), write: (r, v) => (r.respawnDelayTicks = Math.round((v as number) * TICK_RATE)),
  },
  {
    key: 'ff', label: 'Friendly fire', help: 'Whether shots and blasts hurt teammates (team modes and co-op).', type: choice(['off', 'Off'], ['half', 'Half'], ['on', 'Full']), apply: 'restart',
    modes: (m) => teamMode(m) || isCoopMode(m), read: (r) => r.friendlyFire ?? 'off', write: (r, v) => (v === 'off' ? delete r.friendlyFire : (r.friendlyFire = v as 'half' | 'on')),
  },
  {
    key: 'mix', label: 'Mix up weapon pickups', help: 'Every weapon pickup not marked "keep fixed" holds a random weapon of its kind, and a new one each time it comes back.', type: onOff, apply: 'live',
    read: (r) => !!r.mixPickups, write: (r, v) => (v ? (r.mixPickups = true) : delete r.mixPickups),
  },
  {
    key: 'drops', label: 'Drop weapon on death', help: "A fallen player's or bot's primary lies at the body for 30 s with the ammo it had left (off clears the ones lying about).", type: onOff, apply: 'live',
    modes: (m) => m !== 'core.race' && m !== 'core.discs', read: (r) => r.dropWeapons !== false, write: (r, v) => (v ? delete r.dropWeapons : (r.dropWeapons = false)),
  },
  {
    key: 'style', label: 'Bot style', help: 'Mixed: every character its own way. Arena: always moving (Quake). Tactical: cover and held angles (Counter-Strike).', type: choice(['mixed', 'Mixed'], ['arena', 'Arena'], ['tactical', 'Tactical']), apply: 'live',
    read: (r) => r.botStyle ?? 'mixed', write: (r, v) => (v === 'mixed' ? delete r.botStyle : (r.botStyle = v as 'arena' | 'tactical')),
  },
  {
    key: 'teams', label: 'Teams', help: 'How many teams (2 to 8) in Team Deathmatch, King of the Hill and Elimination; CTF, Fort Wars, Bomb and Hostage are always two.', type: { kind: 'int', min: 2, max: MAX_TEAMS }, apply: 'next',
    modes: (m) => teamMode(m) && !isTwoTeamMode(m), read: (r) => teamCount(r), write: () => undefined,
  },
  {
    key: 'assign', label: 'Team balance', help: 'Balanced: people spread evenly over the teams, bots fill the rest. Random: a random team with room.', type: choice(['balanced', 'Balanced'], ['random', 'Random']), apply: 'next',
    modes: teamMode, read: (r) => r.teamAssign === 'random' ? 'random' : 'balanced', write: (r, v) => (v === 'random' ? (r.teamAssign = 'random') : delete r.teamAssign),
  },
  {
    key: 'teamnames', label: 'Team names', help: 'Names in team order, separated by commas (blank: the map\'s).', type: { kind: 'list', max: 24 }, apply: 'next',
    modes: teamMode, read: (r) => r.teamNames?.join(', ') ?? '', write: (r, v) => setList(r, 'teamNames', v as string[]),
  },
  {
    key: 'teamcolors', label: 'Team colours', help: 'Colours in team order (#rrggbb), separated by commas (blank: the map\'s).', type: { kind: 'list', max: 7, pattern: /^#[0-9a-f]{6}$/i }, apply: 'next',
    modes: teamMode, read: (r) => r.teamColors?.join(', ') ?? '', write: (r, v) => setList(r, 'teamColors', v as string[]),
  },
  {
    key: 'leaders', label: 'Team leaders', help: 'Each team has a leader (gold star) whose orders every bot on the team follows. Leader hunt (Team Deathmatch): downing the enemy leader scores 3 extra.', type: choice(['off', 'Off'], ['on', 'On'], ['vip', 'Leader hunt']), apply: 'next',
    modes: teamMode, read: (r) => (r.leaders === 'vip' ? 'vip' : r.leaders ? 'on' : 'off'), write: (r, v) => (v === 'off' ? delete r.leaders : (r.leaders = v === 'vip' && r.mode === 'core.tdm' ? 'vip' : true)),
  },
  {
    key: 'squadspawn', label: 'Spawn on teammates', help: 'Team modes: respawn beside a teammate who is out of the fight.', type: onOff, apply: 'next',
    modes: teamMode, read: (r) => r.squadSpawn !== false, write: (r, v) => (v ? delete r.squadSpawn : (r.squadSpawn = false)),
  },
  {
    key: 'streaks', label: 'Kill streaks', help: 'Rewards for kills without dying: UAV, Supply Pulse, Counter-UAV, Airstrike.', type: onOff, apply: 'next',
    read: (r) => r.killstreaks !== false, write: (r, v) => (v ? delete r.killstreaks : (r.killstreaks = false)),
  },
  {
    key: 'sizes', label: 'Character sizes', help: 'Matter: small characters are quicker targets with less health, large ones slower and tougher. Equal: everyone at standard size.', type: { kind: 'bool', on: 'Matter', off: 'All equal' }, apply: 'next',
    read: (r) => r.bodySizes !== false, write: (r, v) => (v ? delete r.bodySizes : (r.bodySizes = false)),
  },
  {
    key: 'gravity', label: 'Gravity', help: "Low, normal or heavy (default: the map's own).", type: choice(['low', 'Low'], ['normal', 'Normal'], ['heavy', 'Heavy']), apply: 'next',
    read: (r) => (r.gravity === undefined ? 'normal' : r.gravity <= 0.5 ? 'low' : r.gravity >= 1.5 ? 'heavy' : 'normal'), write: (r, v) => (r.gravity = v === 'low' ? 0.4 : v === 'heavy' ? 1.6 : 1),
  },
  {
    key: 'fall', label: 'Fall damage', help: "Drops past about 5 m hurt; about 16 m kills (default: the map's own).", type: onOff, apply: 'next',
    read: (r) => !!r.fallDamage, write: (r, v) => (r.fallDamage = !!v),
  },
  {
    key: 'lethality', label: 'Lethality', help: 'Arcade: everyone soaks about 40% more. Standard: the official balance. Tactical: about 30% less (very lethal).', type: choice(['arcade', 'Arcade'], ['standard', 'Standard'], ['tactical', 'Tactical']), apply: 'next',
    read: (r) => r.lethality ?? 'standard', write: (r, v) => (v === 'standard' ? delete r.lethality : (r.lethality = v as 'arcade' | 'tactical')),
  },
  {
    key: 'ballistics', label: 'Ballistics', help: 'Arcade: fast bullets that barely drop. Standard: the official default. Advanced: slower bullets that drop more.', type: choice(['arcade', 'Arcade'], ['standard', 'Standard'], ['advanced', 'Advanced']), apply: 'next',
    read: (r) => r.ballistics ?? 'standard', write: (r, v) => (v === 'standard' ? delete r.ballistics : (r.ballistics = v as 'arcade' | 'advanced')),
  },
  {
    key: 'emotes', label: 'Emotes & messages', help: 'Quick messages and the dance emote (pings always work).', type: onOff, apply: 'next',
    read: (r) => r.emotes !== false, write: (r, v) => (v ? delete r.emotes : (r.emotes = false)),
  },
  {
    key: 'weapons', label: 'Weapons & pickups', help: "Normal: the map's weapons and pickups. Spears only: one throwing spear each. Discs only: bouncing arena discs (no pickups either way).", type: choice(['normal', 'Normal'], ['spears', 'Spears only'], ['discs', 'Discs only']), apply: 'next',
    read: (r) => r.weapons ?? 'normal', write: (r, v) => (v === 'normal' ? delete r.weapons : (r.weapons = v as 'spears' | 'discs')),
  },
  {
    key: 'classes', label: 'Classes', help: 'Everyone picks one of nine classes; a limit caps how many on a team play the same one.', type: choice(['off', 'Off'], ['on', 'On'], ['1', 'Max 1'], ['2', 'Max 2']), apply: 'next',
    read: (r) => (!r.classes ? 'off' : r.classLimit ? String(r.classLimit) : 'on'),
    write: (r, v) => {
      delete r.classLimit;
      if (v === 'off') return void delete r.classes;
      r.classes = true;
      if (v === '1' || v === '2') r.classLimit = Number(v);
    },
  },
  {
    key: 'vehicles', label: 'Vehicle damage', help: "Normal: vehicles burn and blow up. Tough: half damage. Off: they can't be destroyed.", type: choice(['normal', 'Normal'], ['tough', 'Tough'], ['off', 'Off']), apply: 'next',
    read: (r) => r.vehicleDamage ?? 'normal', write: (r, v) => (v === 'normal' ? delete r.vehicleDamage : (r.vehicleDamage = v as 'tough' | 'off')),
  },
  {
    key: 'flagreturn', label: 'Flag return', help: 'Seconds a dropped flag lies before it goes home (Capture the Flag, Fort Wars).', type: { kind: 'int', min: 5, max: 120, step: 5, unit: 's' }, apply: 'next',
    modes: (m) => m === 'core.ctf' || m === 'core.forts', read: (r) => r.flagReturnSeconds ?? 30, write: (r, v) => (r.flagReturnSeconds = v as number),
  },
  {
    key: 'hill', label: 'Hill moves', help: 'Seconds before the hill moves to the next spot (King of the Hill).', type: { kind: 'int', min: 15, max: 300, step: 15, unit: 's' }, apply: 'next',
    modes: (m) => m === 'core.koth', read: (r) => r.hillSeconds ?? 60, write: (r, v) => (r.hillSeconds = v as number),
  },
  {
    key: 'fortbuild', label: 'Build phase', help: 'Minutes to build before the barrier drops (Fort Wars).', type: { kind: 'int', min: 1, max: 6, unit: 'min' }, apply: 'next',
    modes: (m) => m === 'core.forts', read: (r) => Math.round((r.fortBuildSeconds ?? 150) / 60), write: (r, v) => (r.fortBuildSeconds = (v as number) * 60),
  },
  {
    key: 'fortcombat', label: 'Combat phase', help: 'Minutes of Capture the Flag after each build phase (Fort Wars).', type: { kind: 'int', min: 2, max: 20, unit: 'min' }, apply: 'next',
    modes: (m) => m === 'core.forts', read: (r) => Math.round((r.fortCombatSeconds ?? 300) / 60), write: (r, v) => (r.fortCombatSeconds = (v as number) * 60),
  },
  {
    key: 'fortcycles', label: 'Cycles', help: 'Build-then-fight rounds before the match ends (Fort Wars).', type: { kind: 'int', min: 1, max: 5 }, apply: 'next',
    modes: (m) => m === 'core.forts', read: (r) => r.fortCycles ?? 1, write: (r, v) => (r.fortCycles = v as number),
  },
  {
    key: 'fortbudget', label: 'Build points', help: "Each team's budget: a block costs 2, a wall 4, a metal wall 8 (Fort Wars).", type: { kind: 'int', min: 100, max: 800, step: 20 }, apply: 'next',
    modes: (m) => m === 'core.forts', read: (r) => r.fortBudget ?? 420, write: (r, v) => (r.fortBudget = v as number),
  },
  {
    key: 'laps', label: 'Laps', help: 'Laps of the circuit (Race; a point-to-point track is one run).', type: { kind: 'int', min: 1, max: 10 }, apply: 'next',
    modes: (m) => m === 'core.race', read: (r) => r.raceLaps ?? 3, write: (r, v) => (r.raceLaps = v as number),
  },
  {
    key: 'racevehicle', label: 'Race vehicle', help: "What everyone races in (default: the track's own).", type: choice(['kart', 'Go-Kart'], ['speeder', 'Speeder'], ['buggy', 'Buggy']), apply: 'next',
    modes: (m) => m === 'core.race', read: (r) => r.raceVehicle ?? '', write: (r, v) => (r.raceVehicle = v as 'kart' | 'speeder' | 'buggy'),
  },
  {
    key: 'racecombat', label: 'Race combat', help: "Combat: weapons and vehicle guns are live. Clean: nobody can hurt anybody (default: the track's own).", type: { kind: 'bool', on: 'Combat', off: 'Clean' }, apply: 'next',
    modes: (m) => m === 'core.race', read: (r) => r.raceCombat ?? '', write: (r, v) => (r.raceCombat = !!v),
  },
];

// Built on first use, so a bundle that never reads the rules can drop this module (the menu's first JS).
let byKey: Map<string, RuleSpec> | undefined;
export const ruleSpec = (key: string): RuleSpec | undefined => (byKey ??= new Map(SERVER_RULES.map((s) => [s.key, s]))).get(key.toLowerCase());

function setList(r: MatchRules, k: 'teamNames' | 'teamColors', v: string[]): void {
  if (!v.length || !v.some(Boolean)) delete r[k];
  else r[k] = v.slice(0, MAX_TEAMS);
}

/** "tdm" for core.tdm: how modes are keyed in RULES. */
export const modeKey = (mode: string): string => mode.replace(/^core\./, '');

/** A rule's value made valid (a console word, a JSON value from host.json or the launcher), or an error for the owner. */
export function parseRuleValue(spec: RuleSpec, raw: unknown): { ok: true; value: unknown } | { ok: false; error: string } {
  const t = spec.type;
  const text = typeof raw === 'string' ? raw.trim().toLowerCase() : raw;
  if (t.kind === 'int') {
    const n = typeof text === 'number' ? text : text === 'none' || text === 'off' || text === '∞' ? 0 : Number(text);
    if (!Number.isFinite(n) || n < t.min || n > t.max) return { ok: false, error: `${spec.key} is a number from ${t.min} to ${t.max}${t.unit ? ` (${t.unit})` : ''}` };
    return { ok: true, value: Math.round(n) };
  }
  if (t.kind === 'bool') {
    if (text === true || text === false) return { ok: true, value: text };
    const on = ['on', 'true', 'yes', '1', t.on.toLowerCase()];
    const off = ['off', 'false', 'no', '0', t.off.toLowerCase().replace(/\s+/g, '')];
    const w = String(text).replace(/\s+/g, '');
    if (on.includes(w)) return { ok: true, value: true };
    if (off.includes(w)) return { ok: true, value: false };
    return { ok: false, error: `${spec.key} is on or off` };
  }
  if (t.kind === 'choice') {
    const w = String(text).replace(/\s+/g, '');
    const hit = t.values.find(([v, label]) => v === w || label.toLowerCase().replace(/\s+/g, '') === w);
    if (!hit) return { ok: false, error: `${spec.key} is one of ${t.values.map(([v]) => v).join(', ')}` };
    return { ok: true, value: hit[0] };
  }
  const items = (Array.isArray(raw) ? raw.map(String) : String(raw ?? '').split(',')).map((s) => s.trim().slice(0, 24)).slice(0, MAX_TEAMS);
  if (t.pattern && items.some((s) => s && !t.pattern!.test(s))) return { ok: false, error: `${spec.key}: each one like #ff6600` };
  return { ok: true, value: items.some(Boolean) ? items : [] };
}

/** RULES from host.json, the environment (JSON text) or the launcher, checked: unknown rules and bad values are refused with a message. */
export function validateServerRules(raw: unknown): { rules: ServerRules; error?: string } {
  if (raw === undefined || raw === null || raw === '') return { rules: {} };
  let o: unknown = raw;
  if (typeof raw === 'string') {
    try {
      o = JSON.parse(raw);
    } catch {
      return { rules: {}, error: 'RULES must be JSON, e.g. {"modes":{"tdm":{"score":60,"time":15}},"ff":"half"}' };
    }
  }
  if (typeof o !== 'object' || o === null || Array.isArray(o)) return { rules: {}, error: 'RULES must be an object of rules' };
  const out: ServerRules = {};
  const flat = (src: Record<string, unknown>, where: string, perModeOk: boolean, into: Record<string, unknown>): string | undefined => {
    for (const [k, v] of Object.entries(src)) {
      if (k === 'modes' || k === 'maps') continue;
      const spec = ruleSpec(k);
      if (!spec) return `${where}unknown rule "${k}" (known: ${SERVER_RULES.map((s) => s.key).join(', ')})`;
      if (spec.perMode && !perModeOk) return `${where}${k} is kept per mode: put it under "modes" (e.g. "modes": {"tdm": {"${k}": …}})`;
      if (v === null || v === 'default') continue;
      const p = parseRuleValue(spec, v);
      if (!p.ok) return `${where}${p.error}`;
      into[spec.key] = p.value;
    }
    return undefined;
  };
  const obj = o as Record<string, unknown>;
  const e1 = flat(obj, 'RULES: ', false, out);
  if (e1) return { rules: {}, error: e1 };
  if (obj.modes !== undefined) {
    if (typeof obj.modes !== 'object' || obj.modes === null || Array.isArray(obj.modes)) return { rules: {}, error: 'RULES.modes must map modes to rules' };
    out.modes = {};
    for (const [m, r] of Object.entries(obj.modes as Record<string, unknown>)) {
      const mode = `core.${modeKey(m.toLowerCase())}`;
      if (!isGameMode(mode)) return { rules: {}, error: `RULES.modes: "${m}" is not a mode (${GAME_MODES.map(modeKey).join(', ')})` };
      if (typeof r !== 'object' || r === null) return { rules: {}, error: `RULES.modes.${m} must be an object` };
      const into: Record<string, unknown> = {};
      const e = flat(r as Record<string, unknown>, `RULES.modes.${m}: `, true, into);
      if (e) return { rules: {}, error: e };
      if (Object.keys(into).length) out.modes[modeKey(mode)] = into;
    }
    if (!Object.keys(out.modes).length) delete out.modes;
  }
  if (obj.maps !== undefined) {
    if (typeof obj.maps !== 'object' || obj.maps === null || Array.isArray(obj.maps)) return { rules: {}, error: 'RULES.maps must map map IDs to rules' };
    out.maps = {};
    for (const [id, r] of Object.entries(obj.maps as Record<string, unknown>)) {
      if (!/^[a-z0-9_]{2,48}$/.test(id)) return { rules: {}, error: `RULES.maps: "${id.slice(0, 40)}" is not a map ID` };
      if (typeof r !== 'object' || r === null) return { rules: {}, error: `RULES.maps.${id} must be an object` };
      const into: Record<string, unknown> = {};
      const e = flat(r as Record<string, unknown>, `RULES.maps.${id}: `, true, into);
      if (e) return { rules: {}, error: e };
      if (Object.keys(into).length) out.maps[id] = into;
    }
    if (!Object.keys(out.maps).length) delete out.maps;
  }
  return { rules: out };
}

/** The value a server rule has for a map and mode (per map over per mode over everyone's), and where it comes from. */
export function serverRuleFor(sr: ServerRules, key: string, mapId: string, mode: GameMode): { value: unknown; from: 'map' | 'mode' | 'all' } | null {
  const m = sr.maps?.[mapId];
  if (m && m[key] !== undefined) return { value: m[key], from: 'map' };
  const spec = ruleSpec(key);
  if (spec?.perMode) {
    const v = sr.modes?.[modeKey(mode)]?.[key];
    return v === undefined ? null : { value: v, from: 'mode' };
  }
  return sr[key] === undefined ? null : { value: sr[key], from: 'all' };
}

/** A copy of `sr` with one rule set (value undefined: back to the default) for everyone, the mode, or one map. */
export function setServerRule(sr: ServerRules, key: string, value: unknown, where: { mode: GameMode; map?: string }): ServerRules {
  const spec = ruleSpec(key)!;
  const out: ServerRules = JSON.parse(JSON.stringify(sr)) as ServerRules;
  const put = (o: Record<string, unknown>) => (value === undefined ? delete o[spec.key] : (o[spec.key] = value));
  if (where.map) {
    const maps = (out.maps ??= {});
    put((maps[where.map] ??= {}));
    if (!Object.keys(maps[where.map]!).length) delete maps[where.map];
    if (!Object.keys(maps).length) delete out.maps;
  } else if (spec.perMode) {
    const modes = (out.modes ??= {});
    const k = modeKey(where.mode);
    put((modes[k] ??= {}));
    if (!Object.keys(modes[k]!).length) delete modes[k];
    if (!Object.keys(modes).length) delete out.modes;
  } else put(out);
  return out;
}

/**
 * A match's rules with the server's rules applied (every match the server starts: the first, a restart with
 * new rules, a map change, the rotation's next map). Where the server sets nothing, a rule the browser host
 * would set in Match setup goes back to the mode's own (a "default" undoes it at the next match); the
 * restart rules (score, time, respawn, friendly fire) stay as they were carried over. `fill` is the players
 * to keep: a team count changes the team sizes.
 */
export function applyServerRules(rules: MatchRules, sr: ServerRules, map: MapDocument, fill: number): { rules: MatchRules; fill: number } {
  const out: MatchRules = { ...rules };
  const base = rulesForMode(map, rules.mode);
  for (const spec of SERVER_RULES) {
    if (spec.modes && !spec.modes(out.mode)) continue;
    const got = serverRuleFor(sr, spec.key, map.metadata.id, out.mode);
    if (got) spec.write(out, got.value);
    // Back to the mode's own (on a dedicated server only these rules set them).
    else if (spec.apply === 'next') restoreFrom(out, base, spec);
  }
  // Spears or discs only: no classes.
  if (out.classes && out.weapons && out.weapons !== 'normal') delete out.classes;
  if (out.leaders === 'vip' && out.mode !== 'core.tdm') out.leaders = true;
  const teams = teamCount(out);
  if (!teams) return { rules: out, fill };
  const want = serverRuleFor(sr, 'teams', map.metadata.id, out.mode);
  const count = isTwoTeamMode(out.mode) ? 2 : want ? Math.max(2, Math.min(MAX_TEAMS, want.value as number)) : teams;
  if (count === teams && out.teamSizes?.length === teams) return { rules: out, fill };
  const size = Math.max(1, Math.min(Math.floor(MAX_PLAYER_SLOTS / count), Math.round(fill / count)));
  out.teamSizes = Array.from({ length: count }, () => size);
  return { rules: out, fill: size * count };
}

/** The MatchRules fields each "next match" rule writes, put back to the base's. */
const FIELDS: Record<string, (keyof MatchRules)[]> = {
  assign: ['teamAssign'], teamnames: ['teamNames'], teamcolors: ['teamColors'], leaders: ['leaders'], squadspawn: ['squadSpawn'], streaks: ['killstreaks'], sizes: ['bodySizes'], gravity: ['gravity'], fall: ['fallDamage'],
  lethality: ['lethality'], ballistics: ['ballistics'], emotes: ['emotes'], weapons: ['weapons'], classes: ['classes', 'classLimit'], vehicles: ['vehicleDamage'], flagreturn: ['flagReturnSeconds'], hill: ['hillSeconds'],
  fortbuild: ['fortBuildSeconds'], fortcombat: ['fortCombatSeconds'], fortcycles: ['fortCycles'], fortbudget: ['fortBudget'], laps: ['raceLaps'], racevehicle: ['raceVehicle'], racecombat: ['raceCombat'],
};

function restoreFrom(out: MatchRules, base: MatchRules, spec: RuleSpec): void {
  for (const f of FIELDS[spec.key] ?? []) {
    if (base[f] === undefined) delete out[f];
    else (out as unknown as Record<string, unknown>)[f] = base[f];
  }
}

/** A rule's value for people: "15 min", "Half", "On". */
export function ruleText(spec: RuleSpec, v: unknown): string {
  const t = spec.type;
  if (v === '' || v === undefined || v === null) return 'default';
  if (t.kind === 'int') return v === 0 && t.zero ? t.zero : `${String(v)}${t.unit ? ` ${t.unit}` : ''}`;
  if (t.kind === 'bool') return v ? t.on : t.off;
  if (t.kind === 'choice') return t.values.find(([x]) => x === v)?.[1] ?? String(v);
  return Array.isArray(v) ? v.join(', ') || 'default' : String(v);
}

/** The rules as console lines: what plays now, what the server will use, and when a change applies. */
export function serverRulesText(sr: ServerRules, now: MatchRules, mapId: string, pending: ReadonlySet<string> = new Set()): string {
  const mode = now.mode;
  const rows = SERVER_RULES.filter((s) => !s.modes || s.modes(mode)).map((s) => {
    const got = serverRuleFor(sr, s.key, mapId, mode);
    const playing = ruleText(s, s.read(now));
    const set = got ? ruleText(s, got.value) : null;
    const where = got ? (got.from === 'map' ? ` (this map)` : got.from === 'mode' ? ` (${MODE_LABELS[mode]})` : '') : '';
    const waits = pending.has(s.key) || (set !== null && set !== playing) ? `  → ${set ?? 'default'} ${s.apply === 'restart' ? 'at the restart' : 'at the next match'}` : '';
    return `  ${s.key.padEnd(11)} ${playing}${set !== null && !waits ? where : ''}${waits}${waits ? where : ''}`;
  });
  return [`Match rules for ${MODE_LABELS[mode]} (rules <name> <value>, rules <name> default; rules map <name> <value>: this map only):`, ...rows].join('\n');
}
