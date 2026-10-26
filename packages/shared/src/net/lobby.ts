import { GAME_MODES, type GameMode } from '../sim/rules.ts';
import { MAX_PLAYER_SLOTS } from '../sim/constants.ts';
import { sanitizeName } from './clientMessages.ts';

/**
 * The game browser's listings: matches players host from their own browsers
 * (Host game → Public), as the community hub keeps them. A listing is only
 * an advert; joining goes through the join code exactly like a friend's.
 */
export interface LobbyListing {
  id: string;
  /** Join code (Host game). */
  code: string;
  /** Server name the host typed (sanitised). */
  name: string;
  /** Host's player name. */
  host: string;
  /** Map display name. */
  map: string;
  mode: GameMode;
  /** People playing (bots not counted), and how many can (they take bots' places). */
  players: number;
  max: number;
  /** PROTOCOL_VERSION: only matching games are listed. */
  version: number;
  /** The host set up a relay (so players on strict networks can likely connect). */
  relay: boolean;
  /** Seconds since the host last checked in. */
  age?: number;
}

/** What a host sends to list or refresh its game. */
export type LobbyAdvert = Omit<LobbyListing, 'id' | 'age'>;

/** Hosts check in this often; a listing that misses a few drops off. */
export const LOBBY_HEARTBEAT_SECONDS = 20;
export const LOBBY_EXPIRY_SECONDS = 65;

const CODE_RE = /^[A-HJKMNP-Z2-9]{6}$/;
const text = (v: unknown, max: number) => (typeof v === 'string' ? sanitizeName(v).slice(0, max) : null);
const int = (v: unknown, min: number, max: number) => (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null);

/** An advert from untrusted JSON, or null if anything is off. */
export function parseAdvert(v: unknown): LobbyAdvert | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  const code = typeof o.code === 'string' && CODE_RE.test(o.code) ? o.code : null;
  const name = text(o.name, 40);
  const host = text(o.host, 32);
  const map = text(o.map, 40);
  const mode = typeof o.mode === 'string' && (GAME_MODES as readonly string[]).includes(o.mode) ? (o.mode as GameMode) : null;
  const max = int(o.max, 1, MAX_PLAYER_SLOTS);
  const players = int(o.players, 0, MAX_PLAYER_SLOTS);
  const version = int(o.version, 0, 1_000_000);
  if (!code || !name || !host || !map || !mode || max === null || players === null || version === null) return null;
  return { code, name, host, map, mode, players: Math.min(players, max), max, version, relay: o.relay === true };
}
