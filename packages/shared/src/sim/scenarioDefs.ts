import { getProp } from '../content/props.ts';
import { boxQuat, dynamicBlockIds, isBreakableProp, type Rot } from '../map/geometry.ts';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { DestructibleModel, MapDocument, MapEntity, TrapKind } from '../map/schema.ts';
import type { Vec3 } from '../math.ts';
import { PLAYER, TICK_RATE } from './constants.ts';
import { ELECTRIC_FENCE } from '../map/border.ts';
import type { PhysicsWorld } from './physics.ts';

/**
 * Shapes and tuning for scenario entities, shared by the simulation, client
 * prediction, rendering and the editor so they always agree.
 */

/** A box turned about the vertical axis. `yaw` follows viewDirection(): local +Z faces (sin yaw, 0, cos yaw). */
export interface OBox {
  center: Vec3;
  half: Vec3;
  yaw: number;
  /** Full rotation of tilted boxes (pitched blocks); tests that only know `yaw` treat them as level. */
  rot?: Rot;
}

export interface Aabb {
  min: Vec3;
  max: Vec3;
}

export const entityPos = (e: { position: readonly [number, number, number] }): Vec3 => ({ x: e.position[0], y: e.position[1], z: e.position[2] });

/** Local (x, y, z) offset in an entity's frame -> world point. */
export function localToWorld(origin: Vec3, yaw: number, lx: number, ly: number, lz: number): Vec3 {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return { x: origin.x + lx * c + lz * s, y: origin.y + ly, z: origin.z - lx * s + lz * c };
}

export function pointInOBox(b: OBox, p: Vec3, inflate = 0): boolean {
  const dx = p.x - b.center.x;
  const dz = p.z - b.center.z;
  const c = Math.cos(b.yaw);
  const s = Math.sin(b.yaw);
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  return Math.abs(lx) <= b.half.x + inflate && Math.abs(lz) <= b.half.z + inflate && Math.abs(p.y - b.center.y) <= b.half.y;
}

/** True when a player standing at `feet` overlaps the box (capsule approximated by its axis plus radius). */
export function playerInOBox(b: OBox, feet: Vec3): boolean {
  for (const h of [0.2, PLAYER.height / 2, PLAYER.height - 0.2]) {
    if (pointInOBox(b, { x: feet.x, y: feet.y + h, z: feet.z }, PLAYER.radius)) return true;
  }
  return false;
}

export function oboxAabb(b: OBox): Aabb {
  const c = Math.abs(Math.cos(b.yaw));
  const s = Math.abs(Math.sin(b.yaw));
  const hx = b.half.x * c + b.half.z * s;
  const hz = b.half.x * s + b.half.z * c;
  return {
    min: { x: b.center.x - hx, y: b.center.y - b.half.y, z: b.center.z - hz },
    max: { x: b.center.x + hx, y: b.center.y + b.half.y, z: b.center.z + hz },
  };
}

/** Does the segment a -> b pass through the box (expanded by `pad` horizontally)? Slab test. */
export function segmentHitsAabb(a: Vec3, b: Vec3, box: Aabb, pad = 0): boolean {
  let t0 = 0;
  let t1 = 1;
  for (const k of ['x', 'y', 'z'] as const) {
    const p = k === 'y' ? 0 : pad;
    const d = b[k] - a[k];
    const lo = box.min[k] - p;
    const hi = box.max[k] + p;
    if (Math.abs(d) < 1e-9) {
      if (a[k] < lo || a[k] > hi) return false;
      continue;
    }
    let u = (lo - a[k]) / d;
    let v = (hi - a[k]) / d;
    if (u > v) [u, v] = [v, u];
    t0 = Math.max(t0, u);
    t1 = Math.min(t1, v);
    if (t0 > t1) return false;
  }
  return true;
}

// ---------------------------------------------------------------- doors

export const DOOR = {
  width: 3,
  height: 3,
  thickness: 0.2,
  /** Seconds to fully open or close. */
  travelSeconds: 0.6,
  /** Auto doors open when a player is this close to the doorway centre. */
  autoRadius: 3,
  /** Auto doors close this long after the last player left. */
  autoCloseSeconds: 1.5,
} as const;

/** The two sliding leaves of a double door; `open` 0..1 slides each leaf into the wall beside the doorway. */
export function doorLeaves(e: Extract<MapEntity, { kind: 'door' }>, open: number): [OBox, OBox] {
  const o = entityPos(e);
  const w = DOOR.width / 4;
  const half = { x: w, y: DOOR.height / 2, z: DOOR.thickness / 2 };
  const shift = open * (DOOR.width / 2);
  return [
    { center: localToWorld(o, e.yaw, -w - shift, DOOR.height / 2, 0), half, yaw: e.yaw },
    { center: localToWorld(o, e.yaw, w + shift, DOOR.height / 2, 0), half, yaw: e.yaw },
  ];
}

/** The doorway volume; a door won't close on a player standing in it. */
export function doorway(e: Extract<MapEntity, { kind: 'door' }>): OBox {
  return { center: localToWorld(entityPos(e), e.yaw, 0, DOOR.height / 2, 0), half: { x: DOOR.width / 2, y: DOOR.height / 2, z: 0.6 }, yaw: e.yaw };
}

// ---------------------------------------------------------------- buttons

export const BUTTON = {
  /** Height of the button face above the entity position. */
  height: 1.2,
  /** Players must be this close (eye to button) and roughly facing it to press. */
  reach: 2.2,
  facingCos: 0.6,
} as const;

/** Players can also press E at doors that don't open by themselves. */
export const DOOR_USE_REACH = 2.6;

// ---------------------------------------------------------------- destructibles

export interface DestructibleSpec {
  label: string;
  half: Vec3;
  health: number;
  /** Height of the bottom above the entity's position (window panes sit in the window). */
  lift?: number;
  /** Explodes when destroyed (barrels, gas, generators). */
  blast?: { radius: number; damage: number; edge: number };
  /** Bots treat it as a wall to path around until it breaks. */
  blocksPaths?: boolean;
}

export const DESTRUCTIBLE_SPECS: Record<DestructibleModel, DestructibleSpec> = {
  crate: { label: 'Crate', half: { x: 0.6, y: 0.6, z: 0.6 }, health: 60 },
  barrel: { label: 'Explosive barrel', half: { x: 0.45, y: 0.65, z: 0.45 }, health: 30, blast: { radius: 4.5, damage: 90, edge: 15 } },
  wall: { label: 'Breakable wall', half: { x: 1.5, y: 1.5, z: 0.25 }, health: 250, blocksPaths: true },
  glass: { label: 'Window pane', half: { x: 1.3, y: 0.7, z: 0.04 }, health: 1, lift: 1 },
  boards: { label: 'Board barricade', half: { x: 1.5, y: 1.5, z: 0.1 }, health: 70, blocksPaths: true },
  gas: { label: 'Gas cylinder', half: { x: 0.3, y: 0.65, z: 0.3 }, health: 15, blast: { radius: 5, damage: 110, edge: 20 } },
  generator: { label: 'Generator', half: { x: 1, y: 0.9, z: 0.7 }, health: 400, blast: { radius: 4, damage: 80, edge: 10 } },
};

export function destructibleBox(e: Extract<MapEntity, { kind: 'destructible' }>): OBox {
  const spec = DESTRUCTIBLE_SPECS[e.model];
  return { center: localToWorld(entityPos(e), e.yaw, 0, (spec.lift ?? 0) + spec.half.y, 0), half: spec.half, yaw: e.yaw };
}

/** Anything that can be shot apart: destructible entities and breakable solid props. */
export interface Breakable {
  box: OBox;
  health: number;
  explosiveOnly: boolean;
  blast?: { radius: number; damage: number; edge: number };
  blocksPaths: boolean;
  /** Shots and blasts can break it (crumbling floors and trapdoors can't be shot away). */
  shootable?: boolean;
}

/** A free block's box (centre, half size, turn). */
export function blockOBox(e: Extract<MapEntity, { kind: 'block' }>): OBox {
  const [w, h, d] = e.size;
  return { center: { x: e.position[0], y: e.position[1] + h / 2, z: e.position[2] }, half: { x: w / 2, y: h / 2, z: d / 2 }, yaw: e.yaw, ...(e.pitch || e.roll ? { rot: boxQuat(e.yaw, e.pitch, e.roll) } : {}) };
}

/**
 * Anything the scenario turns on and off: destructibles, breakable props and
 * dynamic blocks. `dynamic` (dynamicBlockIds) adds the solid blocks logic
 * drives or movers carry; they can't be shot away.
 */
export function breakableOf(e: MapEntity, dynamic?: ReadonlySet<string>): Breakable | null {
  if (e.kind === 'block' && e.behaviour === 'solid' && dynamic?.has(e.id)) {
    return { box: blockOBox(e), health: 1, explosiveOnly: false, blocksPaths: false, shootable: false };
  }
  if (e.kind === 'destructible') {
    const spec = DESTRUCTIBLE_SPECS[e.model];
    return { box: destructibleBox(e), health: e.health ?? spec.health, explosiveOnly: e.explosiveOnly, ...(spec.blast ? { blast: spec.blast } : {}), blocksPaths: !!spec.blocksPaths };
  }
  if (e.kind === 'block' && e.behaviour !== 'solid') {
    return { box: blockOBox(e), health: e.health, explosiveOnly: false, blocksPaths: false, shootable: e.behaviour === 'breakable' };
  }
  if (e.kind === 'prop' && isBreakableProp(e)) {
    const def = getProp(e.model)!;
    const [w, h, d] = def.collision!.map((v) => (v * e.scale) / 2) as [number, number, number];
    return {
      box: { center: { x: e.position[0], y: e.position[1] + h, z: e.position[2] }, half: { x: w, y: h, z: d }, yaw: e.yaw },
      health: def.breakable!.health * e.scale,
      explosiveOnly: false,
      ...(def.breakable!.blast ? { blast: def.breakable!.blast } : {}),
      blocksPaths: false,
    };
  }
  return null;
}

// ---------------------------------------------------------------- zones

export function zoneBox(e: Extract<MapEntity, { kind: 'zone' }>): OBox {
  const [sx, sy, sz] = e.size;
  return { center: { x: e.position[0], y: e.position[1] + sy / 2, z: e.position[2] }, half: { x: sx / 2, y: sy / 2, z: sz / 2 }, yaw: 0 };
}

// ---------------------------------------------------------------- traps

export interface TrapSpec {
  label: string;
  /** Damage region in the trap's local frame: centre offset and half extents. */
  hazard: { center: [number, number, number]; half: [number, number, number] };
  /** Proximity traps arm when someone enters this region (defaults to the hazard). */
  trigger?: { center: [number, number, number]; half: [number, number, number] };
  /** Damage per hit. Continuous traps hit each victim every `intervalTicks`; pulse traps hit once per firing. */
  damage: number;
  intervalTicks: number;
  /** Pulse traps deal their damage once, this many ticks after firing (the crusher's drop). */
  pulseDelayTicks?: number;
  /** Proximity traps fire this long after someone steps in (time to react). */
  warnTicks: number;
  /** Mines explode instead of hurting a region. */
  blast?: { radius: number; damage: number; edge: number };
  /** Throws victims back (m/s) away from the trap's local X axis (the electric fence). */
  knockback?: number;
  /** Default timing the editor fills in when this trap is placed. */
  defaults: { activation: 'always' | 'cycle' | 'proximity' | 'logic'; onSeconds: number; offSeconds: number };
}

export const TRAP_SPECS: Record<TrapKind, TrapSpec> = {
  spikes: {
    label: 'Spike floor',
    hazard: { center: [0, 0.5, 0], half: [1.5, 0.5, 1.5] },
    damage: 35,
    intervalTicks: TICK_RATE / 2,
    warnTicks: Math.round(TICK_RATE * 0.4),
    defaults: { activation: 'cycle', onSeconds: 1.5, offSeconds: 2.5 },
  },
  flames: {
    label: 'Flame jet',
    hazard: { center: [0, 1.1, 3], half: [0.8, 1, 2.6] },
    damage: 9,
    intervalTicks: 6,
    warnTicks: Math.round(TICK_RATE * 0.25),
    defaults: { activation: 'cycle', onSeconds: 2, offSeconds: 3 },
  },
  crusher: {
    label: 'Crusher',
    hazard: { center: [0, 1.6, 0], half: [1.5, 1.6, 1.5] },
    damage: 300,
    intervalTicks: TICK_RATE,
    pulseDelayTicks: 9,
    warnTicks: Math.round(TICK_RATE * 0.3),
    defaults: { activation: 'cycle', onSeconds: 1.2, offSeconds: 3 },
  },
  mine: {
    label: 'Proximity mine',
    hazard: { center: [0, 0.1, 0], half: [0.3, 0.1, 0.3] },
    trigger: { center: [0, 1, 0], half: [1.4, 1, 1.4] },
    damage: 110,
    intervalTicks: TICK_RATE,
    warnTicks: Math.round(TICK_RATE * 0.35),
    blast: { radius: 4.5, damage: 110, edge: 20 },
    defaults: { activation: 'proximity', onSeconds: 0.5, offSeconds: 20 },
  },
  laser: {
    label: 'Laser fence',
    hazard: { center: [0, 1.15, 0], half: [1.5, 0.85, 0.1] },
    damage: 25,
    intervalTicks: TICK_RATE / 4,
    warnTicks: 0,
    defaults: { activation: 'cycle', onSeconds: 2, offSeconds: 2 },
  },
  shock: {
    label: 'Electric Fence',
    // Half-length is the run's own (see trapHazard); posts and wires stand 3.2 m tall.
    hazard: { center: [0, ELECTRIC_FENCE.height / 2, 0], half: [ELECTRIC_FENCE.defaultLength / 2, ELECTRIC_FENCE.height / 2, 0.35] },
    damage: ELECTRIC_FENCE.damage,
    intervalTicks: Math.round(TICK_RATE * ELECTRIC_FENCE.interval),
    warnTicks: 0,
    knockback: ELECTRIC_FENCE.knockback,
    defaults: { activation: 'always', onSeconds: 2, offSeconds: 2 },
  },
};

const region = (e: Extract<MapEntity, { kind: 'trap' }>, r: { center: [number, number, number]; half: [number, number, number] }): OBox => ({
  center: localToWorld(entityPos(e), e.yaw, r.center[0], r.center[1], r.center[2]),
  half: { x: r.half[0], y: r.half[1], z: r.half[2] },
  yaw: e.yaw,
});

export const trapHazard = (e: Extract<MapEntity, { kind: 'trap' }>): OBox => {
  const h = TRAP_SPECS[e.trap].hazard;
  // An electric fence's danger runs its whole length.
  if (e.trap === 'shock') return region(e, { center: h.center, half: [(e.length ?? ELECTRIC_FENCE.defaultLength) / 2 + 0.1, h.half[1], h.half[2]] });
  return region(e, h);
};
export const trapTrigger = (e: Extract<MapEntity, { kind: 'trap' }>): OBox => (TRAP_SPECS[e.trap].trigger ? region(e, TRAP_SPECS[e.trap].trigger!) : trapHazard(e));
export const trapDamage = (e: Extract<MapEntity, { kind: 'trap' }>): number => e.damage ?? TRAP_SPECS[e.trap].damage;

// ---------------------------------------------------------------- collision bodies

/**
 * Colliders for doors and destructibles. The server and each predicting
 * client build the same bodies from the map and drive them from the same
 * entity state, so movement against doors predicts like static walls.
 */
export class ScenarioBodies {
  private readonly doors = new Map<number, [RAPIER.Collider, RAPIER.Collider]>();
  private readonly solids = new Map<number, RAPIER.Collider>();
  private readonly byHandle = new Map<number, number>();
  private readonly doorOpen = new Map<number, number>();

  constructor(
    private readonly physics: PhysicsWorld,
    private readonly map: MapDocument,
  ) {
    const dynamic = dynamicBlockIds(map);
    map.entities.forEach((e, i) => {
      if (e.kind === 'door') {
        const [a, b] = doorLeaves(e, 0);
        const leaves: [RAPIER.Collider, RAPIER.Collider] = [physics.createBox(a.center, a.half, a.yaw), physics.createBox(b.center, b.half, b.yaw)];
        this.doors.set(i, leaves);
        this.doorOpen.set(i, 0);
        for (const c of leaves) this.byHandle.set(c.handle, i);
        this.setDoorOpen(i, e.startOpen ? 1 : 0);
      } else {
        const box = breakableOf(e, dynamic)?.box;
        if (!box) return;
        const c = physics.createBox(box.center, box.half, box.yaw, box.rot);
        this.solids.set(i, c);
        this.byHandle.set(c.handle, i);
        if (e.kind === 'block' && e.startHidden) physics.setBoxEnabled(c, false);
      }
    });
    physics.commit();
  }

  /** Entity index of the scenario body a ray hit, if it was one. */
  entityAt(handle: number): number | undefined {
    return this.byHandle.get(handle);
  }

  setDoorOpen(index: number, open: number): void {
    const leaves = this.doors.get(index);
    const e = this.map.entities[index];
    if (!leaves || e?.kind !== 'door' || this.doorOpen.get(index) === open) return;
    this.doorOpen.set(index, open);
    const boxes = doorLeaves(e, open);
    leaves.forEach((c, k) => this.physics.moveBox(c, boxes[k]!.center));
    // Fully open leaves sit inside the wall; disabling them keeps the doorway clean for movement and shots.
    for (const c of leaves) this.physics.setBoxEnabled(c, open < 0.999);
  }

  /** Move a carried block (movers). */
  setTransform(index: number, center: Vec3, rot: Rot): void {
    const c = this.solids.get(index);
    if (c) this.physics.setBoxTransform(c, center, rot);
  }

  setSolid(index: number, present: boolean): void {
    const c = this.solids.get(index);
    if (c) this.physics.setBoxEnabled(c, present);
  }

  commit(): void {
    this.physics.commit();
  }
}
