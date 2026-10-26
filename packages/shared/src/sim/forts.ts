import { viewDirection, type Vec3 } from '../math.ts';
import type { MapDocument } from '../map/schema.ts';
import { PLAYER } from './constants.ts';
import type { PhysicsWorld } from './physics.ts';

/**
 * Fort Wars (SourceForts-style): the pieces teams build with, where a piece
 * goes when you aim the Builder, and the rules for whether it may go there.
 * Shared by the server (authoritative), the client (ghost preview and
 * prediction colliders) and the bots, so all three agree.
 *
 * Pieces turn in quarter turns only, so every part of every piece is an
 * axis-aligned box in the world. Ramps and stairs are built from thin steps
 * (low enough to walk up), which keeps movement on them identical to stairs
 * in the level.
 */

export const FORT_PIECE_KINDS = ['block', 'plank', 'wall', 'metal_wall', 'ramp', 'stairs', 'crate', 'sandbags'] as const;
export type FortPieceKind = (typeof FORT_PIECE_KINDS)[number];
export type FortTier = 'wood' | 'metal' | 'bags';

export interface FortPieceDef {
  kind: FortPieceKind;
  label: string;
  /** Width (local x), height and depth (local z), metres. */
  size: [number, number, number];
  cost: number;
  health: number;
  tier: FortTier;
  /** Collision parts in the piece's own frame: [x0, y0, z0, x1, y1, z1] with x in 0..w, z in 0..d. */
  parts: [number, number, number, number, number, number][];
  /** Ramps and stairs rise toward local +z by this much (drawn as a slope / steps). */
  rise?: 'ramp' | 'stairs';
}

const solid = (w: number, h: number, d: number): FortPieceDef['parts'] => [[0, 0, 0, w, h, d]];
/** `n` steps rising `h` over `d` toward +z, `w` wide. */
const steps = (w: number, h: number, d: number, n: number): FortPieceDef['parts'] =>
  Array.from({ length: n }, (_, i) => [0, (i * h) / n, (i * d) / n, w, ((i + 1) * h) / n, d] as [number, number, number, number, number, number]);

export const FORT_PIECES: Readonly<Record<FortPieceKind, FortPieceDef>> = {
  block: { kind: 'block', label: 'Block', size: [1, 1, 1], cost: 2, health: 160, tier: 'wood', parts: solid(1, 1, 1) },
  plank: { kind: 'plank', label: 'Plank', size: [2, 0.25, 1], cost: 1, health: 90, tier: 'wood', parts: solid(2, 0.25, 1) },
  wall: { kind: 'wall', label: 'Wall', size: [2, 2, 0.5], cost: 4, health: 320, tier: 'wood', parts: solid(2, 2, 0.5) },
  metal_wall: { kind: 'metal_wall', label: 'Metal wall', size: [2, 2, 0.5], cost: 8, health: 650, tier: 'metal', parts: solid(2, 2, 0.5) },
  ramp: { kind: 'ramp', label: 'Ramp', size: [2, 1, 2], cost: 3, health: 220, tier: 'wood', parts: steps(2, 1, 2, 8), rise: 'ramp' },
  stairs: { kind: 'stairs', label: 'Stairs', size: [1, 2, 2], cost: 3, health: 220, tier: 'wood', parts: steps(1, 2, 2, 8), rise: 'stairs' },
  crate: { kind: 'crate', label: 'Crate', size: [1.5, 1.5, 1.5], cost: 3, health: 300, tier: 'metal', parts: solid(1.5, 1.5, 1.5) },
  sandbags: { kind: 'sandbags', label: 'Sandbags', size: [2, 1, 0.5], cost: 2, health: 300, tier: 'bags', parts: solid(2, 1, 0.5) },
};

/** Build grid: every piece's edges land on multiples of this. */
export const FORT_GRID = 0.5;
/** How far the Builder reaches. */
export const FORT_REACH = 7;
/** Pieces standing per team at most (performance). */
export const FORT_MAX_PIECES = 80;
/** Keep this far (m) from the midfield barrier when building. */
export const FORT_BARRIER_CLEARANCE = 1;
/** Keep pieces this far (m, horizontally) from flag bases and spawn points. */
export const FORT_FLAG_CLEARANCE = 3;
export const FORT_SPAWN_CLEARANCE = 1.2;
/** Damage taken from bullets and blades, and from blasts, by tier: bullets chip, explosives smash. */
export const FORT_BULLET_SCALE: Readonly<Record<FortTier, number>> = { wood: 0.5, metal: 0.15, bags: 0.3 };
export const FORT_BLAST_SCALE: Readonly<Record<FortTier, number>> = { wood: 2.5, metal: 1.3, bags: 1.6 };

/** Weapon the Fort Wars Builder is (CORE_WEAPONS). */
export const BUILDER_WEAPON = 'core.builder';

export interface FortBox {
  min: Vec3;
  max: Vec3;
}

/** A piece standing in the world (both server and client keep these). */
export interface FortPieceState {
  id: number;
  kind: FortPieceKind;
  /** Team index (0 or 1). */
  team: number;
  /** Centre of the footprint, at the bottom. */
  base: Vec3;
  /** Quarter turns (0..3): local +z points +z, +x, -z, -x. */
  rot: number;
  boxes: FortBox[];
}

/** Footprint size (x by z) after turning. */
export function fortFootprint(kind: FortPieceKind, rot: number): { w: number; d: number; h: number } {
  const [w, h, d] = FORT_PIECES[kind].size;
  return rot % 2 ? { w: d, d: w, h } : { w, d, h };
}

/** Yaw that turns the piece's local +z to where `rot` points (for drawing). */
export const fortYaw = (rot: number): number => (((rot % 4) + 4) % 4) * (Math.PI / 2);

/** The piece's collision boxes in the world. */
export function fortPieceBoxes(kind: FortPieceKind, rot: number, base: Vec3): FortBox[] {
  const def = FORT_PIECES[kind];
  const [w, , d] = def.size;
  const r = ((rot % 4) + 4) % 4;
  // Local (centred) x/z -> world offsets for each quarter turn.
  const turn = (x: number, z: number): [number, number] => (r === 0 ? [x, z] : r === 1 ? [z, -x] : r === 2 ? [-x, -z] : [-z, x]);
  return def.parts.map(([x0, y0, z0, x1, y1, z1]) => {
    const [ax, az] = turn(x0 - w / 2, z0 - d / 2);
    const [bx, bz] = turn(x1 - w / 2, z1 - d / 2);
    return {
      min: { x: base.x + Math.min(ax, bx), y: base.y + y0, z: base.z + Math.min(az, bz) },
      max: { x: base.x + Math.max(ax, bx), y: base.y + y1, z: base.z + Math.max(az, bz) },
    };
  });
}

/** Bounding box of a set of boxes. */
export function fortBounds(boxes: readonly FortBox[]): FortBox {
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const b of boxes) {
    for (const k of ['x', 'y', 'z'] as const) {
      min[k] = Math.min(min[k], b.min[k]);
      max[k] = Math.max(max[k], b.max[k]);
    }
  }
  return { min, max };
}

const snap = (v: number) => Math.round(v / FORT_GRID) * FORT_GRID;

/** Put the footprint's corner on the grid, keeping the height. */
export function snapFortBase(kind: FortPieceKind, rot: number, p: Vec3): Vec3 {
  const { w, d } = fortFootprint(kind, rot);
  return { x: snap(p.x - w / 2) + w / 2, y: Math.round(p.y * 100) / 100, z: snap(p.z - d / 2) + d / 2 };
}

/**
 * Where a piece would go for someone looking from `eye` along yaw/pitch: on
 * the surface they aim at (on top of a floor or piece, or against the face of
 * a wall, standing on whatever is below), snapped to the grid. Null when they
 * aim at nothing within reach, or at a ceiling.
 */
export function fortAimPlacement(physics: PhysicsWorld, eye: Vec3, yaw: number, pitch: number, kind: FortPieceKind, rot: number): Vec3 | null {
  const dir = viewDirection(yaw, pitch);
  const hit = physics.raycastNormal(eye, dir, FORT_REACH);
  if (!hit || hit.normal.y < -0.5) return null;
  let p = { x: eye.x + dir.x * hit.dist, y: eye.y + dir.y * hit.dist, z: eye.z + dir.z * hit.dist };
  if (hit.normal.y < 0.6) {
    // A wall's face: stand the piece against it, on whatever is underneath.
    const h = Math.hypot(hit.normal.x, hit.normal.z) || 1;
    const ux = hit.normal.x / h;
    const uz = hit.normal.z / h;
    const { w, d } = fortFootprint(kind, rot);
    const out = (Math.abs(ux) * w) / 2 + (Math.abs(uz) * d) / 2 + 0.02;
    p = { x: p.x + ux * out, y: p.y, z: p.z + uz * out };
  }
  const base = snapFortBase(kind, rot, p);
  // Settle on the floor under the snapped centre (it may be the next step of the terrain, or a piece's top).
  const down = physics.raycastHit({ x: base.x, y: p.y + 0.6, z: base.z }, { x: 0, y: -1, z: 0 }, 6);
  if (!down) return null;
  return { ...base, y: Math.round((p.y + 0.6 - down.dist) * 100) / 100 };
}

/** What a placement check needs to know about the world. */
export interface FortWorld {
  physics: PhysicsWorld;
  /** Signed distance from the midfield line: negative on the first team's half. */
  side(p: Vec3): number;
  pieces: readonly FortPieceState[];
  /** Feet of the living players (nobody may be built into). */
  bodies: readonly Vec3[];
  /** Points to keep clear: flag bases and spawn points, with their clearance radius. */
  keepClear: readonly { pos: Vec3; r: number }[];
}

/** Why a piece can't go at `base` for team index `team`, or null when it can. Budget and caps are checked by the caller. */
export function fortPlacementProblem(world: FortWorld, team: number, kind: FortPieceKind, rot: number, base: Vec3): string | null {
  const boxes = fortPieceBoxes(kind, rot, base);
  const all = fortBounds(boxes);
  const sign = team === 0 ? -1 : 1;
  for (const x of [all.min.x, all.max.x]) {
    for (const z of [all.min.z, all.max.z]) {
      if (world.side({ x, y: base.y, z }) * sign < FORT_BARRIER_CLEARANCE) return 'Build on your own side';
    }
  }
  for (const k of world.keepClear) {
    const dx = Math.max(all.min.x - k.pos.x, 0, k.pos.x - all.max.x);
    const dz = Math.max(all.min.z - k.pos.z, 0, k.pos.z - all.max.z);
    if (Math.hypot(dx, dz) < k.r && all.min.y < k.pos.y + 3 && all.max.y > k.pos.y - 1) return 'Too close to a flag or spawn';
  }
  const r = PLAYER.radius;
  for (const b of world.bodies) {
    if (b.x + r > all.min.x && b.x - r < all.max.x && b.z + r > all.min.z && b.z - r < all.max.z && b.y + PLAYER.height > all.min.y && b.y < all.max.y) return 'Someone is in the way';
  }
  for (const p of world.pieces) {
    for (const o of p.boxes) for (const b of boxes) if (overlaps(o, b, 0.01)) return 'Blocked by another piece';
  }
  // Not into the level (a little sinking into uneven ground is fine).
  for (const b of boxes) {
    const half = { x: (b.max.x - b.min.x) / 2 - 0.06, y: (b.max.y - b.min.y) / 2 - 0.12, z: (b.max.z - b.min.z) / 2 - 0.06 };
    const centre = { x: (b.min.x + b.max.x) / 2, y: (b.min.y + b.max.y) / 2 + 0.12, z: (b.min.z + b.max.z) / 2 };
    if (half.y > 0.01 && !world.physics.boxClear(centre, half)) return 'Blocked';
  }
  // Something to stand on under the middle.
  const down = world.physics.raycastHit({ x: base.x, y: base.y + 0.3, z: base.z }, { x: 0, y: -1, z: 0 }, 0.8);
  if (!down) return 'Needs something under it';
  return null;
}

export const overlaps = (a: FortBox, b: FortBox, shrink = 0): boolean =>
  a.min.x + shrink < b.max.x && a.max.x - shrink > b.min.x && a.min.y + shrink < b.max.y && a.max.y - shrink > b.min.y && a.min.z + shrink < b.max.z && a.max.z - shrink > b.min.z;

/** The two flag bases a Fort Wars match builds around (the first two teams'), or null without them. */
export function fortFlagBases(map: MapDocument, teams: readonly { id: string }[]): [Vec3, Vec3] | null {
  const at = (id: string | undefined) => {
    const e = map.entities.find((x) => x.kind === 'flag' && x.team === id);
    return e ? { x: e.position[0], y: e.position[1], z: e.position[2] } : null;
  };
  const a = at(teams[0]?.id);
  const b = at(teams[1]?.id);
  return a && b ? [a, b] : null;
}

/**
 * The midfield line: halfway between the flag bases, square to the line
 * between them. `side(p)` is negative on the first team's half. The barrier
 * is a tall, thin wall along it (`yaw` turns a box's local z onto the line
 * between the bases).
 */
export function fortMidfield(a: Vec3, b: Vec3): { mid: Vec3; dir: Vec3; yaw: number; side: (p: Vec3) => number } {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dz) || 1;
  const dir = { x: dx / len, y: 0, z: dz / len };
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
  return { mid, dir, yaw: Math.atan2(dir.x, dir.z), side: (p) => (p.x - mid.x) * dir.x + (p.z - mid.z) * dir.z };
}

/** The phase barrier's collision box: centre, half extents (x along the line, z its thickness) and yaw. */
export const FORT_BARRIER_HALF = { x: 400, y: 200, z: 0.25 };

/** Phases in ModeSnapshot.fo. */
export const FORT_BUILD = 0;
export const FORT_COMBAT = 1;
