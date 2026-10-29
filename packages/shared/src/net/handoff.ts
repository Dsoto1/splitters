import { sha256Hex } from '../map/identity.ts';
import { HOST_BOT_SKILLS, type MatchPhase } from '../protocol.ts';
import { MAX_PLAYER_SLOTS } from '../sim/constants.ts';
import { isGameMode, type MatchRules } from '../sim/rules.ts';
import { sanitizeName } from './clientMessages.ts';

/**
 * Host handoff (browser hosts): while friends play in a match a browser
 * hosts, the host names one of them its successor and keeps them up to date
 * with a compact checkpoint of the match. If the host goes (leaves, or its
 * link drops), the successor starts the match again from the checkpoint in
 * its own browser, on the join code the host named in advance, and the others
 * reconnect to it, taking back their places by their keys. What carries over
 * and what starts fresh: docs/MULTIPLAYER_PROTOCOL.md, "Host leaves".
 */

/** How often the host sends its successor a checkpoint (seconds). */
export const CHECKPOINT_EVERY_SECONDS = 3;
/** A checkpoint older than this (seconds) is too stale to carry on from: the match ends instead. */
export const CHECKPOINT_MAX_AGE_SECONDS = 30;
/** How long friends wait to be let into the successor's match (seconds) before giving up on it. */
export const HANDOFF_JOIN_SECONDS = 20;
/** How long a friend asked to stand by has to open its standby code (seconds) before the host asks someone else. */
export const STANDBY_ANSWER_SECONDS = 30;
/** The biggest checkpoint a successor accepts (characters of JSON). */
export const MAX_CHECKPOINT_CHARS = 96 * 1024;

/** One player in a checkpoint: a person (playing, or away) or a Player Bot, as they stand. */
export interface CheckpointPlayer {
  name: string;
  /** A person (connected or away: their place is kept for them), or a Player Bot. */
  kind: 'human' | 'bot';
  /** A person's key, hashed (handoffKey): how their next connection to the successor takes their place back. */
  key?: string;
  /** This is the successor's own player. */
  succ?: 1;
  /** Signed in: their name is their verified username. */
  acct?: 1;
  look: string;
  team: string | null;
  /** Kills, deaths, self-kills and objective plays. */
  k: number;
  d: number;
  x?: number;
  o?: number;
  alive: boolean;
  /** Alive: where they stand, which way they face, health and armour. */
  p?: [number, number, number];
  yaw?: number;
  hp?: number;
  ar?: number;
  /** Weapons as [id, magazine, reserve], and the one in hand. */
  w?: [string, number, number][];
  cur?: string;
}

/** Everything the successor needs to carry the match on (the map it already has: the welcome brought it). */
export interface MatchCheckpoint {
  v: 1;
  /** The map's ID: the successor checks it against its own copy. */
  map: string;
  /** The rules as they play now (the host may have changed teams or bot style since the welcome). */
  rules: MatchRules;
  phase: MatchPhase;
  /** Seconds left of the phase (0: untimed). */
  timeLeft: number;
  /** Players to keep (bots included) and bot skill. */
  fill: number;
  skill: (typeof HOST_BOT_SKILLS)[number];
  /** Objective modes' team scores (captures, rounds won, seconds held), by team ID. */
  teams?: [string, number][];
  players: CheckpointPlayer[];
  /** Keys the host banned (hashed), so they stay out. */
  banned?: string[];
  /** The game browser listing: its name, and the host's listing ID and secret so the successor can take it down. */
  listing?: { name: string; id?: string; secret?: string };
}

/**
 * A person's key (`pk:…` browser key, `sub:…` account), hashed for a checkpoint: the successor can match a
 * returning player's key to their place without ever holding other players' keys. Already hashed: as it is.
 */
export function handoffKey(key: string): string {
  if (key.startsWith('h:')) return key;
  return `h:${sha256Hex(new TextEncoder().encode(key)).slice(0, 32)}`;
}

const num = (v: unknown, lo: number, hi: number): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : null);
const int = (v: unknown, lo: number, hi: number): number | null => {
  const n = num(v, lo, hi);
  return n === null ? null : Math.round(n);
};
const id = (v: unknown, max = 64): string | null => (typeof v === 'string' && v.length > 0 && v.length <= max && /^[\w.:-]+$/.test(v) ? v : null);
const PHASES: readonly MatchPhase[] = ['waiting', 'countdown', 'playing', 'intermission'];
const KEY_RE = /^h:[0-9a-f]{32}$/;
const POS_LIMIT = 100_000;

function parsePlayer(v: unknown): CheckpointPlayer | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  const kind = o.kind === 'human' || o.kind === 'bot' ? o.kind : null;
  const look = id(o.look);
  const k = int(o.k, -100_000, 100_000);
  const d = int(o.d, 0, 100_000);
  if (!kind || typeof o.name !== 'string' || !look || k === null || d === null) return null;
  const team = o.team === null ? null : id(o.team);
  if (team === null && o.team !== null) return null;
  const p: CheckpointPlayer = { name: sanitizeName(o.name), kind, look, team, k, d, alive: o.alive === true };
  if (kind === 'human' && typeof o.key === 'string' && KEY_RE.test(o.key)) p.key = o.key;
  if (o.succ === 1) p.succ = 1;
  if (o.acct === 1) p.acct = 1;
  const x = int(o.x, 0, 100_000);
  const ob = int(o.o, 0, 100_000);
  if (x) p.x = x;
  if (ob) p.o = ob;
  if (p.alive && Array.isArray(o.p) && o.p.length === 3) {
    const xyz = o.p.map((c) => num(c, -POS_LIMIT, POS_LIMIT));
    if (xyz.every((c) => c !== null)) p.p = xyz as [number, number, number];
  }
  const yaw = num(o.yaw, -1e4, 1e4);
  if (yaw !== null) p.yaw = yaw;
  const hp = num(o.hp, 0, 10_000);
  if (hp !== null) p.hp = hp;
  const ar = num(o.ar, 0, 10_000);
  if (ar !== null) p.ar = ar;
  if (Array.isArray(o.w)) {
    p.w = o.w.slice(0, 16).flatMap((e): [string, number, number][] => {
      if (!Array.isArray(e) || e.length !== 3) return [];
      const wid = id(e[0]);
      const mag = int(e[1], 0, 10_000);
      const reserve = int(e[2], 0, 100_000);
      return wid && mag !== null && reserve !== null ? [[wid, mag, reserve]] : [];
    });
  }
  const cur = id(o.cur);
  if (cur) p.cur = cur;
  return p;
}

/**
 * A checkpoint from the host (JSON text or parsed), checked and bounded, or null if anything essential is off.
 * The successor already trusts the host with the match (it ran it), so this guards shape and size, not intent.
 */
export function parseCheckpoint(raw: unknown): MatchCheckpoint | null {
  let v = raw;
  if (typeof raw === 'string') {
    if (raw.length > MAX_CHECKPOINT_CHARS) return null;
    try {
      v = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  const map = id(o.map);
  const rules = o.rules as MatchRules | undefined;
  const phase = PHASES.find((ph) => ph === o.phase);
  const timeLeft = int(o.timeLeft, 0, 7 * 24 * 3600);
  const fill = int(o.fill, 1, MAX_PLAYER_SLOTS);
  const skill = HOST_BOT_SKILLS.find((s) => s === o.skill);
  if (o.v !== 1 || !map || !phase || timeLeft === null || fill === null || !skill) return null;
  if (typeof rules !== 'object' || rules === null || typeof rules.mode !== 'string' || !isGameMode(rules.mode)) return null;
  if (!Array.isArray(o.players) || o.players.length > MAX_PLAYER_SLOTS) return null;
  const players = o.players.map(parsePlayer);
  if (players.some((p) => p === null)) return null;
  const cp: MatchCheckpoint = { v: 1, map, rules, phase, timeLeft, fill, skill, players: players as CheckpointPlayer[] };
  if (Array.isArray(o.teams)) {
    cp.teams = o.teams.slice(0, 16).flatMap((e): [string, number][] => {
      const team = Array.isArray(e) ? id(e[0]) : null;
      const score = Array.isArray(e) ? int(e[1], 0, 1_000_000) : null;
      return team && score !== null ? [[team, score]] : [];
    });
  }
  if (Array.isArray(o.banned)) cp.banned = o.banned.filter((k): k is string => typeof k === 'string' && KEY_RE.test(k)).slice(0, 256);
  const l = o.listing as Record<string, unknown> | undefined;
  if (typeof l === 'object' && l !== null && typeof l.name === 'string') {
    cp.listing = { name: l.name.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 40) };
    if (typeof l.id === 'string' && /^[\w-]{1,64}$/.test(l.id) && typeof l.secret === 'string' && /^[0-9a-f]{1,64}$/.test(l.secret)) Object.assign(cp.listing, { id: l.id, secret: l.secret });
  }
  return cp;
}

/** A join code the host named for its successor (the same shape as every join code). */
export const isJoinCode = (v: unknown): v is string => typeof v === 'string' && /^[A-HJKMNP-Z2-9]{6}$/.test(v);
