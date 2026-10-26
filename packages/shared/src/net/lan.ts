import { MAX_PLAYER_SLOTS } from '../sim/constants.ts';
import { GAME_MODES, type GameMode } from '../sim/rules.ts';
import { sanitizeName } from './clientMessages.ts';

/**
 * What a dedicated server says about itself, for LAN discovery: over HTTP at
 * `GET /info` on its game port (browsers), and in answer to a UDP broadcast
 * on LAN_DISCOVERY_PORT (the community hub and other tools; browsers can't
 * send UDP).
 */
export interface ServerInfo {
  game: 'tiletrigger';
  /** PROTOCOL_VERSION the server speaks. */
  version: number;
  name: string;
  /** Map display name. */
  map: string;
  mode: GameMode;
  /** People playing (bots not counted), bots, and how many can play. */
  players: number;
  bots: number;
  max: number;
  /** Where to join: ws://<LAN address>:<port>, one per network the server is on. */
  addresses: string[];
}

/** UDP port dedicated servers answer LAN discovery broadcasts on. */
export const LAN_DISCOVERY_PORT = 7787;
/** The broadcast a scanner sends; servers answer with their ServerInfo as JSON. */
export const LAN_DISCOVERY_PROBE = 'tiletrigger:discover';
/** Game ports a browser tries on the hosts it can see (the default 7777 and the next few). */
export const LAN_GAME_PORTS = [7777, 7778, 7779, 7780] as const;

const ADDRESS_RE = /^wss?:\/\/[\w.[\]:-]{1,80}$/;
const int = (v: unknown, min: number, max: number) => (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null);

/** A ServerInfo from untrusted JSON (a LAN reply), or null if anything is off. */
export function parseServerInfo(v: unknown): ServerInfo | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (o.game !== 'tiletrigger') return null;
  const version = int(o.version, 0, 1_000_000);
  const players = int(o.players, 0, MAX_PLAYER_SLOTS);
  const bots = int(o.bots, 0, MAX_PLAYER_SLOTS);
  const max = int(o.max, 1, MAX_PLAYER_SLOTS);
  const name = typeof o.name === 'string' ? sanitizeName(o.name).slice(0, 40) : null;
  const map = typeof o.map === 'string' ? sanitizeName(o.map).slice(0, 40) : null;
  const mode = typeof o.mode === 'string' && (GAME_MODES as readonly string[]).includes(o.mode) ? (o.mode as GameMode) : null;
  const addresses = Array.isArray(o.addresses) ? o.addresses.filter((a): a is string => typeof a === 'string' && ADDRESS_RE.test(a)).slice(0, 8) : [];
  if (version === null || players === null || bots === null || max === null || !name || !map || !mode) return null;
  return { game: 'tiletrigger', version, name, map, mode, players, bots, max, addresses };
}
