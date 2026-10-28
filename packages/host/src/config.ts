import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MAX_PLAYER_SLOTS, isGameMode, isMapId, sanitizeName, type GameMode } from '@tiletrigger/shared';

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
}

export const DEFAULT_HUB = 'https://trigger.toshiroplay.com';
/** A home connection's upload carries every player's stream (12–30 KB/s each at 48 v 48): 16 people is ~4 Mbit/s. */
export const DEFAULT_MAX_PLAYERS = 16;
const CODE_RE = /^[A-HJKMNP-Z2-9]{6}$/;

/** Keys a JSON config may use (the same names as the environment variables, or camelCase). */
const KEYS: Record<string, string> = {
  HUB: 'hub', MAP: 'map', MODE: 'mode', BOT_FILL: 'botFill', MAX_PLAYERS: 'maxPlayers', BOT_DIFFICULTY: 'botDifficulty', BOT_TAKEBACK: 'botTakeBack',
  LEADERS: 'leaders', PLAYLIST: 'playlist', SERVER_NAME: 'name', HOST_NAME: 'hostName', VISIBILITY: 'visibility', ADMIN_TOKEN: 'adminToken', JOIN_CODE: 'joinCode', STATUS_EVERY: 'statusEvery', AFK_SECONDS: 'afkSeconds',
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
    name: name || 'Dedicated host',
    hostName: hostName || 'Host Service',
    visibility,
    ...(adminToken ? { adminToken } : {}),
    ...(joinCode ? { joinCode } : {}),
    statusEvery: num(raw.statusEvery, 'STATUS_EVERY', 0, 86400, 60),
    afkSeconds: num(raw.afkSeconds, 'AFK_SECONDS', 0, 3600, 90),
  };
}

/** The settings for the log, without the admin token. */
export function describeConfig(c: HostConfig): string {
  return `hub ${c.hub}, map ${c.map}${c.mode ? ` (${c.mode})` : ''}, ${c.botFill} players and bots, up to ${c.maxPlayers} people, ${c.visibility === 'listed' ? `listed as "${c.name}"` : 'join code only'}${c.adminToken ? ', admin token set' : ''}`;
}
