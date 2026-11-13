import type { MapDocument } from '../map/schema.ts';
import type { ValidationIssue } from '../map/validate.ts';
import type { Vec3 } from '../math.ts';
import { validateMapNavigation } from './mapNav.ts';
import { Match } from './match.ts';
import { mapGravityZones, mapPads, padLandings, type JumpPad } from './movement.ts';

/** A body that lands farther than this (m, on the ground plane) from a pad's predicted landing missed it. */
export const PAD_MISS_M = 2.5;
/** …or this far above or below it (m). */
export const PAD_MISS_HEIGHT_M = 1;
/** The longest flight followed (ticks: 10 s). */
const FLIGHT_TICKS = 600;

/** One jump pad flown by a player's body in a match, against the landing bots are told (movement.ts padLandings: a thin ray). */
export interface PadFlight {
  /** The pad's entity id. */
  id: string;
  pad: Vec3;
  /** Where the pad's arc is predicted to come down (null: nowhere). */
  predicted: Vec3 | null;
  /** Where the body came down (null: it never left the pad, or was still in the air after 10 s). */
  landed: Vec3 | null;
  /** Whether the body lived through the flight (a fall into the void or a deadly liquid kills it). */
  alive: boolean;
  /** Ground-plane distance from the predicted landing to where the body came down (m); Infinity without both. */
  miss: number;
  /** How far above (+) or below (−) the predicted landing the body came down (m); 0 without both. */
  height: number;
}

/** A match with the body that flies its pads. */
interface Flyer {
  match: Match;
  me: NonNullable<ReturnType<Match['addHuman']>>;
  /** (Input numbers go on from pad to pad: a match drops inputs older than the last it took.) */
  seq: number;
  /** Pads flown in this match so far. */
  flown: number;
}

function flyer(map: MapDocument): Flyer | null {
  const match = new Match(map, undefined, 1);
  const me = match.addHuman('pad-check');
  if (me) return { match, me, seq: 0, flown: 0 };
  match.destroy();
  return null;
}

function flyPad(f: Flyer, map: MapDocument, id: string, pad: JumpPad): PadFlight {
  const { match, me } = f;
  f.flown++;
  // What bots are told, on the match's own physics (the scenario's solids are in it by now).
  const predicted = padLandings([pad], match.physics, match.phys.gravity, mapGravityZones(map.entities))[0]?.end ?? null;
  me.health = 100;
  // Maps with an air drop start you in the plane: get out first.
  match.leaveMount(me, false);
  me.move = { pos: { ...pad.pos }, velY: 0, grounded: true };
  let left = false;
  let down = false;
  for (let t = 0; t < FLIGHT_TICKS && me.alive; t++) {
    me.health = 100;
    match.queueInputs(me.slot, [{ seq: ++f.seq, forward: 0, right: 0, yaw: me.yaw, pitch: 0, buttons: 0 }]);
    match.step();
    if (!me.move.grounded) left = true;
    else if (left) {
      down = true;
      break;
    }
  }
  const landed = down && me.alive ? { ...me.move.pos } : null;
  return {
    id,
    pad: { ...pad.pos },
    predicted,
    landed,
    alive: me.alive,
    miss: landed && predicted ? Math.hypot(landed.x - predicted.x, landed.z - predicted.z) : Infinity,
    height: landed && predicted ? landed.y - predicted.y : 0,
  };
}

/** Whether a flight came down on its predicted landing. */
export const padFlightOk = (f: PadFlight): boolean => f.alive && !!f.landed && !!f.predicted && f.miss <= PAD_MISS_M && Math.abs(f.height) <= PAD_MISS_HEIGHT_M;

/**
 * Flies a player's body off every jump pad of a map, in a match as it is played (the same Match, default rules): the
 * player stands on the pad with no input and the flight is followed until the body is on the ground again. A pad's
 * predicted landing is a ray along its arc; a body is 0.7 m wide and 1.8 m tall, and clips roofs, beams and ledges
 * the ray passes (Iron Maw's first pit pad landed 14 m short under Deep Drift's roof). Needs initPhysics and
 * initNavigation.
 *
 * One match flies the map's pads one after another (building a match is most of the cost: seconds on a big map). A
 * flight in it that misses is flown again in a match of its own, from its first tick, and that flight is the answer:
 * what moves on a map (trains, lifts, crumbling decks) is then where it starts, not where earlier flights left it.
 */
export function flyPads(map: MapDocument): PadFlight[] {
  const entities = map.entities.filter((e) => e.kind === 'pad');
  const pads = mapPads(entities);
  const out: PadFlight[] = [];
  let shared: Flyer | null = null;
  try {
    for (const [i, pad] of pads.entries()) {
      shared ??= flyer(map);
      if (!shared) break;
      const first = shared.flown === 0;
      let flight = flyPad(shared, map, entities[i]!.id, pad);
      if (!padFlightOk(flight) && !first) {
        const own = flyer(map);
        if (own) {
          try {
            flight = flyPad(own, map, entities[i]!.id, pad);
          } finally {
            own.match.destroy();
          }
        }
      }
      out.push(flight);
      if (!shared.me.alive) {
        shared.match.destroy();
        shared = null;
      }
    }
  } finally {
    shared?.match.destroy();
  }
  return out;
}

const at = (p: Vec3): string => `${p.x.toFixed(1)}, ${p.z.toFixed(1)}`;

/**
 * Warnings for the pads whose flight misses its predicted landing (`pad.flight`; validate-map and MapMaker's checks):
 * the body comes down more than PAD_MISS_M away (or PAD_MISS_HEIGHT_M above or below), dies on the way, or never
 * comes down. Warnings, not errors: the map still plays, but bots take the pad expecting the predicted landing.
 */
export function padFlightIssues(flights: readonly PadFlight[]): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  for (const f of flights) {
    const name = `jump pad "${f.id}" (at ${at(f.pad)})`;
    let message: string | null = null;
    if (!f.alive) message = `${name}: a player thrown by it dies before landing${f.predicted ? ` (predicted landing ${at(f.predicted)})` : ''}: the flight ends in the void or something deadly`;
    else if (!f.landed) message = `${name}: a player standing on it is not thrown and back on the ground within 10 s: check the pad is on a floor and its power`;
    else if (!f.predicted) message = `${name}: its arc comes down nowhere, but a player lands at ${at(f.landed)}: bots will not use it`;
    else if (f.miss > PAD_MISS_M) message = `${name}: a player lands ${f.miss.toFixed(1)} m from its predicted landing (at ${at(f.landed)}, predicted ${at(f.predicted)}): the body hits something on the way (a roof, beam or ledge over the arc) or slides off the landing; clear the arc or change the pad's power, push or direction`;
    else if (Math.abs(f.height) > PAD_MISS_HEIGHT_M) message = `${name}: a player lands ${Math.abs(f.height).toFixed(1)} m ${f.height > 0 ? 'above' : 'below'} its predicted landing (at ${at(f.landed)}, height ${f.landed.y.toFixed(1)} m, predicted ${f.predicted.y.toFixed(1)} m): the body catches a ledge or misses the floor the arc ends on`;
    if (message) out.push({ severity: 'warning', code: 'pad.flight', message, targetId: f.id });
  }
  return out;
}

/**
 * A map's checks as it is played, for where maps are made (validate-map; MapMaker's check list runs the two parts one
 * after the other): the navigation checks (validateMapNavigation) and every jump pad flown by a player's body
 * (padFlightIssues).
 */
export function validateMapPlay(map: MapDocument, official: boolean, opts: { computed?: boolean } = {}): ReturnType<typeof validateMapNavigation> {
  const nav = validateMapNavigation(map, official, opts);
  return { ...nav, issues: [...nav.issues, ...padFlightIssues(flyPads(map))] };
}
