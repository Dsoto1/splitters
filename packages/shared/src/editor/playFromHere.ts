import type { Vec3 } from '../math.ts';
import type { WorldBox } from '../map/geometry.ts';
import type { MapBounds } from '../map/schema.ts';
import { terrainHeightAt, type TerrainData } from '../map/terrain.ts';
import { PLAYER } from '../sim/constants.ts';
import { restUnder } from './surfaceSnap.ts';

/**
 * Play from here (MapMaker overhaul Phase 3, item 1): a local test match with you standing at the camera spot, facing
 * where the camera looks. The spot is the nearest walkable ground below the camera: the floor, roof, block top or
 * ground straight under it, else the nearest such spot within PLAY_FROM_HERE_SEARCH metres round it, with room for a
 * player to stand. Refused, with a reason, when there's none.
 */

/** How far round the point under the camera to look for room to stand (m). */
export const PLAY_FROM_HERE_SEARCH = 4;
/** The rings searched, this far apart (m). */
const RING_STEP = 0.5;
/** The most a test start looks up or down (radians): the sim's own limit is ±1.55. */
const MAX_PITCH = 1.4;

export interface PlayFromHereInput {
  /** The camera's position (world metres). */
  camera: Vec3;
  /** Where it looks: yaw (radians, 0 along +Z) and pitch (radians, up positive). */
  yaw: number;
  pitch: number;
  /** The map as played: tiles, blocks and solid props (barriers too: nobody starts inside an invisible wall). */
  boxes: readonly WorldBox[];
  /** The ground as played (MapMaker's shownGround), or null. */
  ground: TerrainData | null;
  /** The playable boundary, or null (none). */
  bounds: Pick<MapBounds, 'min' | 'max'> | null;
}

export type PlayFromHere =
  | {
      ok: true;
      /** Where your feet go (world metres). */
      position: [number, number, number];
      yaw: number;
      pitch: number;
      /** What you stand on. */
      on: 'top' | 'ground';
      /** How far the spot is from straight under the camera (0: right under it). */
      offset: number;
    }
  | { ok: false; reason: string };

/** Steeper ground than a player can stand on (PLAYER.maxSlopeDegrees), from the ground's heights round (x, z). */
function tooSteep(ground: TerrainData, x: number, z: number): boolean {
  const d = Math.max(0.25, ground.spacing / 2);
  const hx0 = terrainHeightAt(ground, x - d, z);
  const hx1 = terrainHeightAt(ground, x + d, z);
  const hz0 = terrainHeightAt(ground, x, z - d);
  const hz1 = terrainHeightAt(ground, x, z + d);
  if (hx0 === null || hx1 === null || hz0 === null || hz1 === null) return false;
  const grad = Math.hypot((hx1 - hx0) / (2 * d), (hz1 - hz0) / (2 * d));
  return (Math.atan(grad) * 180) / Math.PI > PLAYER.maxSlopeDegrees;
}

/** Whether a box overlaps a standing player's body at (x, y, z): from a step's height above the feet to the head. */
function inTheWay(b: WorldBox, x: number, y: number, z: number): boolean {
  const y0 = y + PLAYER.maxStepHeight + 0.05;
  const y1 = y + PLAYER.height;
  if (b.max[1] <= y0 || b.min[1] >= y1) return false;
  let px = x;
  let pz = z;
  if (b.yaw) {
    const cx = (b.min[0] + b.max[0]) / 2;
    const cz = (b.min[2] + b.max[2]) / 2;
    const c = Math.cos(-b.yaw);
    const s = Math.sin(-b.yaw);
    const dx = x - cx;
    const dz = z - cz;
    px = cx + dx * c + dz * s;
    pz = cz - dx * s + dz * c;
  }
  const r = PLAYER.radius;
  return px > b.min[0] - r && px < b.max[0] + r && pz > b.min[2] - r && pz < b.max[2] + r;
}

const inside = (b: Pick<MapBounds, 'min' | 'max'>, x: number, z: number) => x >= b.min[0] && x <= b.max[0] && z >= b.min[1] && z <= b.max[1];

/** The points searched, nearest first: straight under the camera, then rings round it. */
function searchPoints(x: number, z: number): [number, number, number][] {
  const out: [number, number, number][] = [[x, z, 0]];
  for (let r = RING_STEP; r <= PLAY_FROM_HERE_SEARCH + 1e-9; r += RING_STEP) {
    const n = Math.max(8, Math.round((2 * Math.PI * r) / RING_STEP));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      out.push([x + Math.sin(a) * r, z + Math.cos(a) * r, r]);
    }
  }
  return out;
}

const round2 = (v: number) => Math.round(v * 100) / 100 + 0;

/** Where Play from here puts you, or why it can't. */
export function playFromHereSpot(input: PlayFromHereInput): PlayFromHere {
  const { camera, boxes, ground, bounds } = input;
  if (bounds && !inside(bounds, camera.x, camera.z)) return { ok: false, reason: 'The camera is outside the playable boundary: fly back inside it' };
  const solid = boxes.filter((b) => b.kind !== 'barrier');
  let blocked = false;
  let steep = false;
  let found = false;
  for (const [x, z, offset] of searchPoints(camera.x, camera.z)) {
    if (bounds && !inside(bounds, x, z)) continue;
    const rest = restUnder(solid, ground, x, z, camera.y);
    if (!rest || rest.y < PLAYER.killY) continue;
    found = true;
    if (rest.on === 'ground' && ground && tooSteep(ground, x, z)) {
      steep = true;
      continue;
    }
    if (boxes.some((b) => inTheWay(b, x, rest.y, z))) {
      blocked = true;
      continue;
    }
    const pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, input.pitch));
    return { ok: true, position: [round2(x), round2(rest.y), round2(z)], yaw: input.yaw, pitch, on: rest.on, offset: round2(offset) };
  }
  if (!found) return { ok: false, reason: 'Nothing to stand on under the camera: fly over a floor or the ground' };
  if (blocked) return { ok: false, reason: 'No room to stand under the camera: something is in the way. Fly to an open spot' };
  if (steep) return { ok: false, reason: 'The ground under the camera is too steep to stand on' };
  return { ok: false, reason: 'Nowhere to stand under the camera' };
}
