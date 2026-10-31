import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MAX_PLAYER_SLOTS, ROTATION_MAX, isGameMode, isMapId, isRegion, regionForTimeZone, sanitizeName, validateServerRules, type GameMode, type Region, type ServerRules } from '@tiletrigger/shared';

/**
 * The Host Service's settings: environment variables, optionally on top of a
 * small JSON file (HOST_CONFIG=host.json; the environment wins). Nothing here
 * is a credential for ToshiroPlay or AWS: the host needs none. ADMIN_TOKEN is
 * this host's own (players who know it run the match from the pause menu).
 */
export interface HostConfig {
  /** The hub that lists the game and introduces players (its PeerJS broker, /lobby, TURN credentials). */
  hub: string;
  /** A map of our suite by ID (frost_basin), or a map file's path (a community map). */
  map: string;
  /** Default: the map's first mode. */
  mode?: GameMode;
  /** Players + bots to keep (bots fill up to this; people take bots' places). */
  botFill: number;
  /** People (not bots) who may play at once: every player's stream goes out of this computer's upload. */
  maxPlayers: number;
  botDifficulty?: 'easy' | 'normal' | 'hard';
  botTakeBack: boolean;
  leaders?: boolean | 'vip';
  /** A scenario chain (maps/playlists/…json). */
  playlist?: string;
  /**
   * The map rotation: after each match the next of these instead of a replay, round and round. Items
   * "map:mode" ("frost_basin:tdm"; no mode: the map's first) or "preset:<id>" (maps/rotations/<id>.json).
   * The match drops maps that aren't ours and modes a map can't play (with a log line).
   */
  rotation?: string[];
  /** Play the rotation in a random order. */
  rotationShuffle?: boolean;
  /**
   * The host's own bots (docs/HOSTING.md, "Bot sets"): a built-in set's id (maps/botsets/<id>.json), a list in
   * the text form ("Sir Clank, core.knight, hard; Zorp"), or (in a JSON config, or BOTSET=file.json) a set
   * object. The match checks it (validateBotSet).
   */
  botSet?: string | Record<string, unknown>;
  /** Listing name in the game browser. */
  name: string;
  /** "hosted by …" in the game browser. */
  hostName: string;
  /** listed: in the game browser (and by code); code: only people with the join code. */
  visibility: 'listed' | 'code';
  /** Lets players who join with it (?admin=… or pause menu → Server admin) run the match. Unset: nobody can. */
  adminToken?: string;
  /** A fixed join code (6 characters, no look-alikes), so links and bookmarks keep working across restarts. Default: a random one, kept while the service runs. */
  joinCode?: string;
  /** Log a status line every this many seconds (0: never). */
  statusEvery: number;
  /** Idle this many seconds and a bot plays for a player until they're back (0: never; default 90). */
  afkSeconds: number;
  /** Away for being idle this many minutes, still connected: removed from the match (0: never; default 10). */
  idleKickMinutes: number;
  /** Where this computer is, for the game browser (players in the same region see it first). Default: from its time zone. */
  region: Region;
  /**
   * The match rules (RULES; shared sim/serverRules.ts): everything a browser host sets in Match setup and the
   * pause menu, for every match this server plays. `{"ff": "half", "modes": {"tdm": {"score": 60, "time": 15}},
   * "maps": {"iron_maw": {"time": 20}}}`. The console's `rules` and the launcher's Match rules card change them.
   */
  rules?: ServerRules;
  /** A message each player gets when they join (MOTD, at most 200 characters). */
  motd?: string;
}

export const DEFAULT_HUB = 'https://trigger.toshiroplay.com';
/** A home connection's upload carries every player's stream (12–30 KB/s each at 48 v 48): 16 people is ~4 Mbit/s. */
export const DEFAULT_MAX_PLAYERS = 16;
const CODE_RE = /^[A-HJKMNP-Z2-9]{6}$/;

/** Keys a JSON config may use (the same names as the environment variables, or camelCase). */
const KEYS: Record<string, string> = {
  HUB: 'hub', MAP: 'map', MODE: 'mode', BOT_FILL: 'botFill', MAX_PLAYERS: 'maxPlayers', BOT_DIFFICULTY: 'botDifficulty', BOT_TAKEBACK: 'botTakeBack',
  LEADERS: 'leaders', PLAYLIST: 'playlist', ROTATION: 'rotation', ROTATION_SHUFFLE: 'rotationShuffle', BOTSET: 'botSet', SERVER_NAME: 'name', HOST_NAME: 'hostName', VISIBILITY: 'visibility', ADMIN_TOKEN: 'adminToken', JOIN_CODE: 'joinCode', STATUS_EVERY: 'statusEvery', AFK_SECONDS: 'afkSeconds', IDLE_KICK_MINUTES: 'idleKickMinutes', REGION: 'region', RULES: 'rules', MOTD: 'motd',
};

export class ConfigError extends Error {}

/** Settings from the environment and, if HOST_CONFIG names one, a JSON file (relative paths from `cwd`). */
export function loadConfig(env: NodeJS.ProcessEnv = process.env, cwd = process.cwd(), read: (path: string) => string = (p) => readFileSync(p, 'utf8')): HostConfig {
  const raw: Record<string, unknown> = {};
  if (env.HOST_CONFIG) {
    const file = resolve(cwd, env.HOST_CONFIG);
    let json: unknown;
    try {
      json = JSON.parse(read(file));
    } catch (e) {
      throw new ConfigError(`HOST_CONFIG ${file}: ${(e as Error).message}`);
    }
    if (typeof json !== 'object' || json === null || Array.isArray(json)) throw new ConfigError(`HOST_CONFIG ${file}: expected a JSON object`);
    for (const [k, v] of Object.entries(json)) {
      const key = KEYS[k] ?? (Object.values(KEYS).includes(k) ? k : null);
      if (!key) throw new ConfigError(`HOST_CONFIG ${file}: unknown setting "${k}" (known: ${Object.keys(KEYS).join(', ')})`);
      raw[key] = v;
    }
  }
  for (const [envKey, key] of Object.entries(KEYS)) if (env[envKey] !== undefined && env[envKey] !== '') raw[key] = env[envKey];
  // BOTSET=bots.json: a set in a file (only from the owner's own settings, never from a page).
  if (typeof raw.botSet === 'string' && raw.botSet.trim().endsWith('.json')) {
    const file = resolve(cwd, raw.botSet.trim());
    try {
      raw.botSet = JSON.parse(read(file)) as unknown;
    } catch (e) {
      throw new ConfigError(`BOTSET ${file}: ${(e as Error).message}`);
    }
  }
  return parseConfig(raw, cwd);
}

const str = (v: unknown) => (v === undefined || v === null ? undefined : String(v).trim());
const num = (v: unknown, name: string, min: number, max: number, dflt: number): number => {
  if (v === undefined) return dflt;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new ConfigError(`${name} must be a whole number from ${min} to ${max} (got ${String(v)})`);
  return n;
};
const bool = (v: unknown) => v === true || v === 1 || /^(1|true|yes|on)$/i.test(String(v ?? ''));

/** Checks and fills in defaults; throws ConfigError with a message for the owner. */
export function parseConfig(raw: Record<string, unknown>, cwd = process.cwd()): HostConfig {
  const hub = str(raw.hub) ?? DEFAULT_HUB;
  let url: URL;
  try {
    url = new URL(/^\w+:\/\//.test(hub) ? hub : `https://${hub}`);
  } catch {
    throw new ConfigError(`HUB is not an address: ${hub}`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new ConfigError(`HUB must be http(s):// (got ${url.protocol})`);
  // Plain http only for a hub on this machine or the home network (tests, LAN parties): the internet hub is https.
  if (url.protocol === 'http:' && !/^(localhost|127\.|\[::1\]|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname)) throw new ConfigError(`HUB over plain http is only for a hub on your own network; use https:// (got ${hub})`);
  const map = str(raw.map) ?? 'frost_basin';
  const mode = str(raw.mode);
  if (mode !== undefined && !isGameMode(mode)) throw new ConfigError(`MODE ${mode} is not a game mode`);
  const difficulty = str(raw.botDifficulty);
  if (difficulty !== undefined && !['easy', 'normal', 'hard'].includes(difficulty)) throw new ConfigError('BOT_DIFFICULTY must be easy, normal or hard');
  const visibility = str(raw.visibility) ?? 'listed';
  if (visibility !== 'listed' && visibility !== 'code') throw new ConfigError('VISIBILITY must be listed (game browser and code) or code (join code only)');
  const joinCode = str(raw.joinCode)?.toUpperCase();
  if (joinCode !== undefined && !CODE_RE.test(joinCode)) throw new ConfigError('JOIN_CODE must be 6 characters from A-Z and 2-9 without look-alikes (no I, L, O, 0 or 1)');
  const adminToken = str(raw.adminToken);
  if (adminToken !== undefined && adminToken.length < 8) throw new ConfigError('ADMIN_TOKEN must be at least 8 characters (anyone who has it runs the match)');
  const leaders = str(raw.leaders);
  const name = (str(raw.name) ? sanitizeName(str(raw.name)!) : '').slice(0, 40);
  const hostName = (str(raw.hostName) ? sanitizeName(str(raw.hostName)!) : '').slice(0, 32);
  const playlist = str(raw.playlist);
  const rotation = rotationSetting(raw.rotation);
  const botSet = botSetSetting(raw.botSet);
  const rules = validateServerRules(raw.rules);
  if (rules.error) throw new ConfigError(rules.error);
  const motd = str(raw.motd)?.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 200);
  return {
    hub: url.origin + url.pathname.replace(/\/+$/, ''),
    map: isMapId(map) ? map : resolve(cwd, map),
    ...(mode ? { mode: mode as GameMode } : {}),
    botFill: num(raw.botFill, 'BOT_FILL', 0, MAX_PLAYER_SLOTS, 24),
    maxPlayers: num(raw.maxPlayers, 'MAX_PLAYERS', 1, MAX_PLAYER_SLOTS, DEFAULT_MAX_PLAYERS),
    ...(difficulty ? { botDifficulty: difficulty as 'easy' | 'normal' | 'hard' } : {}),
    botTakeBack: bool(raw.botTakeBack),
    ...(leaders === 'vip' ? { leaders: 'vip' as const } : leaders === 'on' || leaders === 'true' ? { leaders: true } : {}),
    ...(playlist ? { playlist: resolve(cwd, playlist) } : {}),
    ...(rotation.length ? { rotation } : {}),
    ...(bool(raw.rotationShuffle) ? { rotationShuffle: true } : {}),
    ...(botSet !== undefined ? { botSet } : {}),
    name: name || 'Dedicated host',
    hostName: hostName || 'Host Service',
    visibility,
    ...(adminToken ? { adminToken } : {}),
    ...(joinCode ? { joinCode } : {}),
    statusEvery: num(raw.statusEvery, 'STATUS_EVERY', 0, 86400, 60),
    afkSeconds: num(raw.afkSeconds, 'AFK_SECONDS', 0, 3600, 90),
    idleKickMinutes: num(raw.idleKickMinutes, 'IDLE_KICK_MINUTES', 0, 1440, 10),
    region: regionSetting(str(raw.region)),
    ...(Object.keys(rules.rules).length ? { rules: rules.rules } : {}),
    ...(motd ? { motd } : {}),
  };
}

/** One rotation item: "map", "map:mode" (tdm or core.tdm) or "preset:<id>". */
const ROTATION_ITEM = /^(preset:[a-z0-9_]{2,48}|[a-z0-9_]{2,48}(:(core\.)?[a-z]{2,16})?)$/;

/**
 * ROTATION: "frost_basin:tdm, diamond_park:ctf" (commas or spaces), or in a JSON config a list of those
 * or of { map, mode } objects. Only the form is checked here; the match checks the maps and modes.
 */
export function rotationSetting(v: unknown): string[] {
  if (v === undefined || v === null || v === '') return [];
  const list: unknown[] = Array.isArray(v) ? v : String(v).split(/[\s,]+/).filter(Boolean);
  if (list.length > ROTATION_MAX * 2) throw new ConfigError(`ROTATION: at most ${ROTATION_MAX} maps`);
  return list.map((item) => {
    const text = typeof item === 'object' && item !== null ? `${String((item as { map?: unknown }).map ?? '')}${(item as { mode?: unknown }).mode ? `:${String((item as { mode?: unknown }).mode)}` : ''}` : String(item);
    const t = text.trim().toLowerCase();
    if (!ROTATION_ITEM.test(t)) throw new ConfigError(`ROTATION: "${text.slice(0, 60)}" is not map:mode (frost_basin:tdm) or preset:<name>`);
    return t;
  });
}

/** Most text a BOTSET may be (96 bots of about 30 characters). */
export const BOTSET_MAX_TEXT = 4000;

/** BOTSET: a preset's id or the text form (a string), or a set object; only the form is checked here. */
export function botSetSetting(v: unknown): HostConfig['botSet'] {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'string') {
    if (v.length > BOTSET_MAX_TEXT) throw new ConfigError(`BOTSET: at most ${BOTSET_MAX_TEXT} characters`);
    return v.trim();
  }
  if (typeof v === 'object' && !Array.isArray(v) && JSON.stringify(v).length <= BOTSET_MAX_TEXT * 4) return v as Record<string, unknown>;
  throw new ConfigError('BOTSET must be a built-in set\'s name, a list ("Name, look, skill; …"), or a { name, entries, fill } object');
}

function regionSetting(v: string | undefined): Region {
  if (v === undefined || v === '') {
    try {
      return regionForTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone ?? '');
    } catch {
      return 'na-east';
    }
  }
  if (!isRegion(v)) throw new ConfigError(`REGION must be one of na-west, na-east, sa, eu, africa, me, asia-south, asia-east, oceania (got ${v})`);
  return v;
}

/** The settings for the log, without the admin token. */
export function describeConfig(c: HostConfig): string {
  return `hub ${c.hub}, map ${c.map}${c.mode ? ` (${c.mode})` : ''}${c.rotation?.length ? `, rotation ${c.rotation.join(' ')}${c.rotationShuffle ? ' (shuffled)' : ''}` : ''}${c.botSet ? `, bot set ${typeof c.botSet === 'string' && !/[,;]/.test(c.botSet) ? c.botSet : 'of your own'}` : ''}, ${c.botFill} players and bots, up to ${c.maxPlayers} people, ${c.visibility === 'listed' ? `listed as "${c.name}"` : 'join code only'}${c.adminToken ? ', admin token set' : ''}${c.rules ? ', match rules set' : ''}`;
}
