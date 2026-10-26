import type { PlayerSnapshot, PrivateState, ServerMessage } from '../protocol.ts';
import { SNAPSHOT_INTERVAL_TICKS } from '../sim/constants.ts';

/** The shared part of a snapshot (everything but the receiver's ack and private state). */
export type SnapshotBody = Omit<Extract<ServerMessage, { t: 'snapshot' }>, 't' | 'ack' | 'me'>;

export interface SnapshotViewer {
  slot: number;
  ack: number;
  me?: PrivateState;
}

/**
 * Interest management for big matches. Up to INTEREST_MIN_PLAYERS players
 * everyone gets everyone in every snapshot (30 Hz). Past that, each receiver
 * gets players near them in every snapshot, players at middle distance in
 * every other one (15 Hz) and far ones in every fourth (7.5 Hz); the ones
 * left out are listed in `hold` and the client keeps drawing them from the
 * snapshots that had them. You always get yourself, and a receiver who is
 * dead (spectating, or waiting to respawn) gets everyone.
 */
export const INTEREST_MIN_PLAYERS = 32;
export const INTEREST_NEAR = 60;
export const INTEREST_MID = 150;

/** How often (in snapshots) a player `d` metres away is sent: 1, 2 or 4. */
export function interestEvery(d: number): number {
  return d < INTEREST_NEAR ? 1 : d < INTEREST_MID ? 2 : 4;
}

/**
 * Which players go in `viewer`'s copy of this snapshot: the indexes into
 * body.players to send, and the slots held back. Spreads each tier over the
 * snapshots by slot, so the far players don't all arrive together.
 */
export function interestFor(body: SnapshotBody, viewer: number): { send: number[]; hold: number[] } {
  const players = body.players;
  const all = players.map((_, i) => i);
  if (players.length <= INTEREST_MIN_PLAYERS) return { send: all, hold: [] };
  const me = players.find((p) => p.s === viewer);
  if (!me || !me.alive) return { send: all, hold: [] };
  const n = Math.floor(body.tick / SNAPSHOT_INTERVAL_TICKS);
  const send: number[] = [];
  const hold: number[] = [];
  players.forEach((p, i) => {
    const d = Math.hypot(p.p[0] - me.p[0], p.p[2] - me.p[2]);
    const every = p === me ? 1 : interestEvery(d);
    if ((n + p.s) % every === 0) send.push(i);
    else hold.push(p.s);
  });
  return { send, hold };
}

/**
 * Serialises one snapshot for many receivers cheaply: each player entry and
 * the rest of the body are turned to JSON once, then every receiver's copy
 * is put together from those pieces (its ack, private state and players).
 */
export function encodeSnapshots(body: SnapshotBody, viewers: readonly SnapshotViewer[]): string[] {
  const { players, ...rest } = body;
  const restJson = JSON.stringify(rest).slice(1);
  const playerJson = players.map((p: PlayerSnapshot) => JSON.stringify(p));
  const full = players.length <= INTEREST_MIN_PLAYERS ? `"players":[${playerJson.join(',')}],` : null;
  return viewers.map((v) => {
    let list = full;
    if (list === null) {
      const { send, hold } = interestFor(body, v.slot);
      list = `"players":[${send.map((i) => playerJson[i]).join(',')}],${hold.length ? `"hold":${JSON.stringify(hold)},` : ''}`;
    }
    return `{"t":"snapshot","ack":${v.ack},${v.me ? `"me":${JSON.stringify(v.me)},` : ''}${list}${restJson}`;
  });
}
