import { SQUAD_ORDERS, type PortalEntity, type BlockEntity, type ButtonEntity, type DestructibleEntity, type DoorEntity, type LightEntity, type MapDocument, type MapEntity, type SquadOrder, type TrapEntity, type ZoneEntity } from '../map/schema.ts';
import { dynamicBlockIds } from '../map/geometry.ts';
import { Movers, legTicks, liftLinks } from './movers.ts';
import { mapPortals, portalEntry, PORTAL_EXIT, type Portal } from './portals.ts';
import { isMapId } from './playlist.ts';
import { OBJECTIVE_STATES, type CompareOp, type EventType, type LogicAction, type LogicCondition, type ObjectiveState } from '../map/logic.ts';
import { distance, viewDirection, type Vec3, hypot } from '../math.ts';
import { TRAP_ACTIVE, TRAP_ENABLED, TRAP_SPENT, TRAP_WARNING, type GameEvent, type ScenarioSnapshot } from '../protocol.ts';
import { PLAYER, TICK_RATE } from './constants.ts';
import { RESOURCE_BUDGETS } from '../map/budgets.ts';
import type { PhysicsWorld } from './physics.ts';
import { rayOBox, windowPanes, type GlassPane } from './glass.ts';
import {
  BUTTON,
  DESTRUCTIBLE_SPECS,
  DOOR,
  DOOR_USE_REACH,
  ScenarioBodies,
  TRAP_SPECS,
  breakableOf,
  glassBreakable,
  windowPaneIndex,
  type Breakable,
  doorway,
  entityPos,
  localToWorld,
  oboxAabb,
  playerInOBox,
  pointInOBox,
  trapDamage,
  trapHazard,
  trapTrigger,
  zoneBox,
  type Aabb,
} from './scenarioDefs.ts';
import { ELECTRIC_FENCE, borderFloor, borderRect, borderShockLines, borderStyles, fenceRun, shockLineNearest, type ShockLine } from '../map/border.ts';
import { buildMapGeometry } from '../map/geometry.ts';

/** Someone the scenario reacts to; `team` (their team or faction) matters to team-only buttons, doors and zones. */
export interface ScenarioActor {
  slot: number;
  alive: boolean;
  pos: Vec3;
  team?: string | null;
}

/** Whether a team filter lets this actor through (no filter: everyone). */
export const teamAllows = (filter: string | undefined, team: string | null | undefined): boolean => !filter || filter === team;

/** What the scenario needs from the match it runs in. */
export interface ScenarioHost {
  readonly tick: number;
  /** Players (humans and Player Bots): zones count these. */
  players(): readonly ScenarioActor[];
  /** Players and NPCs: doors open for them and traps hurt them. */
  actors(): readonly ScenarioActor[];
  /** The team (or faction) of an actor, for team-only buttons and doors used with E. */
  teamOf?(slot: number): string | null;
  hurt(slot: number, amount: number, weapon: string): void;
  /** Throw someone along `dir` at `speed` m/s (an electric fence's jolt). */
  push?(slot: number, dir: Vec3, speed: number): void;
  /** An explosion (barrel, mine) that hurts players and other destructibles. */
  blast(at: Vec3, radius: number, damage: number, edge: number, owner: number | null, weapon: string): void;
  /** End the round; co-op missions pass an outcome; "Next map" a suite map ID to load next. */
  endRound(winner: number | null, outcome?: 'victory' | 'defeat', next?: string): void;
  encounter(id: string, op: 'start' | 'stop' | 'order', order?: SquadOrder): void;
  encounterAlive(id: string): number;
  setPickupEnabled(id: string, enabled: boolean): void;
  emit(ev: GameEvent): void;
  /** A runtime budget was hit (once per kind and match): the host logs it. */
  budgetWarning?(text: string): void;
}

interface DoorRt {
  i: number;
  e: DoorEntity;
  open: number;
  target: 0 | 1;
  locked: boolean;
  lastNear: number;
  /** Opened by proximity, so it closes by itself once everyone has left. */
  autoOpened: boolean;
}

interface ButtonRt {
  i: number;
  e: ButtonEntity;
  enabled: boolean;
  used: boolean;
  readyAt: number;
  litUntil: number;
}

interface DestructibleRt {
  i: number;
  id: string;
  b: Breakable;
  health: number;
  max: number;
  alive: boolean;
  /** Free blocks: what sets them off, when they were stood on, and when they come back. */
  block?: { e: BlockEntity; triggeredAt: number | null; respawnAt: number | null };
  /** Shattered glass: when it comes back (the map's glass respawn time; null: next round). */
  glassBack?: number | null;
}

interface ZoneRt {
  i: number;
  e: ZoneEntity;
  enabled: boolean;
  inside: Set<number>;
  satisfied: boolean;
}

interface TrapRt {
  i: number;
  e: TrapEntity;
  enabled: boolean;
  active: boolean;
  /** End of a proximity firing, or of a logic/forced firing. */
  activeUntil: number;
  forcedUntil: number;
  armedAt: number | null;
  rearmAt: number;
  spent: boolean;
  pulseAt: number | null;
  hitAt: Map<number, number>;
}

interface LightRt {
  i: number;
  e: LightEntity;
  on: boolean;
  /** Colour as 0xrrggbb. */
  color: number;
  /** Blinks per second (0: steady). */
  blink: number;
  flashUntil: number;
}

interface PortalRt {
  i: number;
  e: PortalEntity;
  enabled: boolean;
}

interface MoverRt {
  /** Index in Movers.defs. */
  k: number;
  enabled: boolean;
  /** Pingpong and "Send mover" direction through the points. */
  dir: 1 | -1;
  /** Where logic asked it to go next (taken when it parks). */
  queued: number | null;
}

/** Light snapshot flags: [index, LIGHT_ON | LIGHT_FLASH | blinks per second × 10 << 2, colour 0xrrggbb]. */
export const LIGHT_ON = 1;
export const LIGHT_FLASH = 2;
export const lightBlinkOf = (flags: number): number => (flags >> 2) / 10;
export const hexColor = (hex: string): number => parseInt(hex.slice(1), 16);
const isHexColor = (s: string): boolean => /^#[0-9a-fA-F]{6}$/.test(s);

interface Sequence {
  actions: readonly LogicAction[];
  pc: number;
  resumeTick: number;
  instigator: number | null;
}

/** Rule chains deeper than this (events firing events) are cut off, so creators can't hang the server. */
const MAX_EVENT_DEPTH = 8;
const MAX_SEQUENCES = 256;
/** Full scenario state is resent this often (in snapshots) so late joiners and lost deltas recover. */
const KEYFRAME_EVERY = 60;

const compare = (a: number, op: CompareOp, b: number): boolean => {
  switch (op) {
    case '==':
      return a === b;
    case '!=':
      return a !== b;
    case '<':
      return a < b;
    case '<=':
      return a <= b;
    case '>':
      return a > b;
    case '>=':
      return a >= b;
  }
};

/** Weapon IDs used in kill events for scenario hazards. */
export const trapWeaponId = (e: TrapEntity): string => `core.trap_${e.trap}`;
export const BARREL_WEAPON_ID = 'core.barrel';

/**
 * Runs a map's scenario: doors, buttons, destructibles, zones and traps, plus
 * the WHEN -> IF -> DO interpreter over variables, timers and objectives. It is
 * pure simulation (no networking), stepped by Match once per tick.
 */
export class Scenario {
  readonly bodies: ScenarioBodies;
  private readonly doors = new Map<number, DoorRt>();
  private readonly buttons = new Map<number, ButtonRt>();
  private readonly destructibles = new Map<number, DestructibleRt>();
  private readonly zones = new Map<number, ZoneRt>();
  private readonly traps = new Map<number, TrapRt>();
  private readonly lights = new Map<number, LightRt>();
  /** Movers (lifts, drawbridges…): legs, poses and riders; shared with client prediction. */
  readonly movers: Movers;
  private readonly moverRt = new Map<number, MoverRt>();
  /** Portals (pairs of linked surfaces): logic switches them on and off. */
  readonly portals: Portal[];
  private readonly portalRt = new Map<number, PortalRt>();
  private readonly dynamic: Set<string>;
  /** Lights some rule targets (or that start off or blinking): only these are replicated. */
  private readonly drivenLights = new Set<number>();
  private readonly lifts: ReturnType<typeof liftLinks>;
  private readonly index = new Map<string, number>();
  private readonly pickupEnabled = new Map<string, boolean>();
  private vars = new Map<string, number>();
  private objectives = new Map<string, ObjectiveState>();
  private timers = new Map<string, number | null>();
  private spentRules = new Set<string>();
  private sequences: Sequence[] = [];
  private started = false;
  private roundStart = 0;
  private depth = 0;
  /** Runtime budgets (RESOURCE_BUDGETS): work done this tick, events waiting for the next, recent firings per rule. */
  private budgetTick = -1;
  private actionsThisTick = 0;
  private firingsThisTick = 0;
  private deferredEvents: { event: EventType; target: string | null; instigator: number | null; from: number }[] = [];
  private readonly ruleWindow = new Map<string, { start: number; n: number }>();
  private readonly budgetWarned = new Set<string>();
  private lastSent = new Map<number, string>();
  private obSent = '';
  private tmSent = '';
  private snapshots = 0;
  /** The border's electric fence (none without one) and when it last zapped each victim. */
  private readonly borderShocks: ShockLine[];
  private readonly borderZappedAt = new Map<number, number>();
  /** Glass in window edges (they follow the entities: see windowPaneIndex). */
  private readonly panes: GlassPane[];
  /** Every pane (window glass and glass blocks), so shots and the respawn clock look at glass only. */
  private glass: DestructibleRt[] = [];

  constructor(
    readonly map: MapDocument,
    physics: PhysicsWorld,
    private readonly host: ScenarioHost,
  ) {
    this.bodies = new ScenarioBodies(physics, map);
    this.borderShocks = Object.values(borderStyles(map)).includes('fence') ? borderShockLines(map, borderFloor(map, buildMapGeometry(map))) : [];
    this.dynamic = dynamicBlockIds(map);
    this.movers = new Movers(map);
    this.lifts = liftLinks(map);
    this.portals = mapPortals(map.entities);
    this.panes = windowPanes(map);
    map.entities.forEach((e, i) => this.index.set(e.id, i));
    const targets = new Set(map.logic.rules.flatMap((r) => r.do.map((a) => a.target)));
    map.entities.forEach((e, i) => {
      if (e.kind === 'light' && (targets.has(e.id) || e.off || e.blink)) this.drivenLights.add(i);
    });
    this.reset();
  }

  /** Back to the map's starting state (new round). match_start fires on the next step. */
  reset(): void {
    const tick = this.host.tick;
    this.map.entities.forEach((e, i) => {
      switch (e.kind) {
        case 'door':
          this.doors.set(i, { i, e, open: e.startOpen ? 1 : 0, target: e.startOpen ? 1 : 0, locked: e.locked, lastNear: -Infinity, autoOpened: false });
          this.bodies.setDoorOpen(i, e.startOpen ? 1 : 0);
          break;
        case 'button':
          this.buttons.set(i, { i, e, enabled: e.startEnabled, used: false, readyAt: 0, litUntil: 0 });
          break;
        case 'destructible':
        case 'prop': {
          const b = breakableOf(e);
          if (!b) break;
          this.destructibles.set(i, { i, id: e.id, b, health: b.health, max: b.health, alive: true });
          this.bodies.setSolid(i, true);
          break;
        }
        case 'block': {
          const b = breakableOf(e, this.dynamic);
          if (!b) break;
          const alive = !e.startHidden;
          this.destructibles.set(i, { i, id: e.id, b, health: alive ? b.health : 0, max: b.health, alive, block: { e, triggeredAt: null, respawnAt: null } });
          this.bodies.setSolid(i, alive);
          break;
        }
        case 'light':
          this.lights.set(i, { i, e, on: !e.off, color: hexColor(e.color), blink: e.blink ?? 0, flashUntil: 0 });
          break;
        case 'mover': {
          const k = this.movers.of(i);
          if (k !== undefined) this.moverRt.set(i, { k, enabled: e.startActive, dir: 1, queued: null });
          break;
        }
        case 'portal':
          this.portalRt.set(i, { i, e, enabled: e.startEnabled });
          break;
        case 'zone':
          this.zones.set(i, { i, e, enabled: e.startEnabled, inside: new Set(), satisfied: false });
          break;
        case 'trap':
          this.traps.set(i, { i, e, enabled: e.startEnabled, active: false, activeUntil: 0, forcedUntil: 0, armedAt: null, rearmAt: 0, spent: false, pulseAt: null, hitAt: new Map() });
          break;
        case 'pickup':
          if (this.pickupEnabled.get(e.id) === false) this.host.setPickupEnabled(e.id, true);
          this.pickupEnabled.set(e.id, true);
          break;
        case 'spawn':
        case 'encounter':
        case 'water':
          break;
      }
    });
    this.panes.forEach((p, k) => {
      const i = windowPaneIndex(this.map, k);
      const b = glassBreakable(p);
      this.destructibles.set(i, { i, id: p.id, b, health: b.health, max: b.health, alive: true });
      this.bodies.setSolid(i, true);
    });
    this.glass = [...this.destructibles.values()].filter((d) => d.b.glass);
    const logic = this.map.logic;
    this.vars = new Map(logic.variables.map((v) => [v.id, v.initial]));
    this.objectives = new Map(logic.objectives.map((o) => [o.id, o.startActive ? 'active' : 'inactive']));
    this.timers = new Map(logic.timers.map((t) => [t.id, null]));
    this.spentRules.clear();
    this.sequences = [];
    this.deferredEvents = [];
    this.ruleWindow.clear();
    this.started = false;
    this.roundStart = tick;
    this.movers.reset(tick);
    this.moveMovers(tick);
    this.bodies.commit();
  }

  // ---------------------------------------------------------------- movers

  /** Put carried blocks where their movers are at `tick` (the match calls this before moving anyone). */
  moveMovers(tick = this.host.tick): void {
    if (!this.movers.defs.length) return;
    for (const t of this.movers.transforms(tick)) this.bodies.setTransform(t.block.i, t.center, t.rot);
    this.bodies.commit();
  }

  /** Whether a carried block (entity index) is there: dropped and hidden blocks carry and strike nobody (one function for every call). */
  private readonly blockPresent = (i: number): boolean => this.destructibles.get(i)?.alive !== false;

  /** Where feet standing on a moving block are carried to this tick (null: not riding). */
  carry(feet: Vec3): Vec3 | null {
    if (!this.movers.defs.length) return null;
    return this.movers.carry(feet, this.host.tick, this.blockPresent);
  }

  /** Speed of a fast carried block (a train) running into a body standing at `feet` this tick (0: none). */
  strike(feet: Vec3, radius: number, height: number): number {
    if (!this.movers.defs.length) return 0;
    return this.movers.strike(feet, radius, height, this.host.tick, this.blockPresent);
  }

  /** Whether a portal (entity index) is switched on. */
  portalOn = (i: number): boolean => this.portalRt.get(i)?.enabled ?? false;

  /** Portal pairs as bots see them: where to step in (a navmesh link's start), where it comes out, the surface to walk into, and whether it works now. */
  portalViews(): { start: Vec3; end: Vec3; face: Vec3; on: boolean }[] {
    return this.portals.flatMap((p) => {
      if (p.link < 0) return [];
      const b = this.portals[p.link]!;
      return [{ start: portalEntry(p, 0.9), end: portalEntry(b, PORTAL_EXIT + 0.6), face: { x: p.pos.x, y: p.pos.y, z: p.pos.z }, on: this.portalOn(p.i) && this.portalOn(b.i) }];
    });
  }

  /** Lifts as bots see them: the ride (navmesh link) and where the platform's top is now. */
  liftViews(): { start: Vec3; end: Vec3; top: Vec3; half: number }[] {
    const tick = this.host.tick;
    return this.lifts.flatMap((l) => {
      const i = this.index.get(l.mover);
      const k = i === undefined ? undefined : this.movers.of(i);
      if (k === undefined) return [];
      const def = this.movers.defs[k]!;
      const block = def.blocks[0]!;
      const pose = this.movers.pose(k, tick);
      const top = { x: def.pivot.x + pose.offset.x + block.local.x, y: def.pivot.y + pose.offset.y + block.local.y + block.half.y, z: def.pivot.z + pose.offset.z + block.local.z };
      return [{ start: l.start, end: l.end, top, half: Math.max(block.half.x, block.half.z) }];
    });
  }

  private stepMovers(tick: number): void {
    for (const m of this.moverRt.values()) {
      const def = this.movers.defs[m.k]!;
      const leg = this.movers.legs[m.k]!;
      const n = def.points.length;
      if (leg.from !== leg.to) {
        const end = leg.start + legTicks(def, leg.from, leg.to);
        if (tick < end) continue;
        this.movers.legs[m.k] = { from: leg.to, to: leg.to, start: end };
        this.fire('mover_arrived', def.e.id, null);
        continue;
      }
      let next: number | null = null;
      if (m.queued !== null) {
        next = m.queued;
        m.queued = null;
      } else if (def.e.mode !== 'trigger' && m.enabled && tick >= leg.start + Math.round(def.e.wait * TICK_RATE)) {
        next = this.nextPoint(m, def.e.mode === 'loop', n, leg.to);
      }
      if (next !== null && next !== leg.to) this.movers.legs[m.k] = { from: leg.to, to: next, start: tick };
    }
  }

  private nextPoint(m: MoverRt, loop: boolean, n: number, at: number): number {
    if (loop) return (at + 1) % n;
    if (at + m.dir < 0 || at + m.dir >= n) m.dir = m.dir === 1 ? -1 : 1;
    return at + m.dir;
  }

  // ---------------------------------------------------------------- per tick

  step(): void {
    const tick = this.host.tick;
    if (!this.started) {
      this.started = true;
      this.roundStart = tick;
      this.fire('match_start', null, null);
    }
    this.stepMovers(tick);
    this.stepDoors(tick);
    this.stepBlocks(tick);
    this.stepGlass(tick);
    this.stepZones();
    this.stepTraps(tick);
    this.stepBorderFence(tick);
    this.stepTimers(tick);
    this.stepDeferred();
    this.stepSequences(tick);
    this.bodies.commit();
  }

  /** Crumbling floors and trapdoors give way when stood on; broken blocks come back when nobody is in the way. */
  private stepBlocks(tick: number): void {
    let actors: readonly { slot: number; alive: boolean; pos: Vec3 }[] | null = null;
    for (const d of this.destructibles.values()) {
      const k = d.block;
      if (!k) continue;
      const e = k.e;
      if (d.alive) {
        if (k.triggeredAt === null && e.trigger === 'step' && (e.behaviour === 'crumble' || e.behaviour === 'trapdoor')) {
          actors ??= this.host.actors().filter((a) => a.alive);
          const top = d.b.box.center.y + d.b.box.half.y;
          const on = actors.find((a) => a.pos.y >= top - 0.2 && a.pos.y <= top + 0.4 && pointInOBox({ ...d.b.box, half: { ...d.b.box.half, y: 50 } }, a.pos, 0.3));
          if (on) k.triggeredAt = tick;
        }
        if (k.triggeredAt !== null && tick >= k.triggeredAt + Math.round(e.delaySeconds * TICK_RATE)) this.destroy(d, null);
      } else if (k.respawnAt !== null && tick >= k.respawnAt) {
        actors ??= this.host.actors().filter((a) => a.alive);
        // Wait until nobody would be stuck inside it.
        if (actors.some((a) => pointInOBox(d.b.box, { ...a.pos, y: a.pos.y + 0.9 }, 0.5))) continue;
        d.alive = true;
        d.health = d.max;
        k.triggeredAt = null;
        k.respawnAt = null;
        this.bodies.setSolid(d.i, true);
      }
    }
  }

  /** Shattered panes come back after the map's glass respawn time, once nobody stands in the way. */
  private stepGlass(tick: number): void {
    let actors: readonly { slot: number; alive: boolean; pos: Vec3 }[] | null = null;
    for (const d of this.glass) {
      if (d.alive || d.glassBack == null || tick < d.glassBack) continue;
      actors ??= this.host.actors().filter((a) => a.alive);
      if (actors.some((a) => playerInOBox(d.b.box, a.pos))) continue;
      d.alive = true;
      d.health = d.max;
      d.glassBack = null;
      if (d.block) d.block.respawnAt = null;
      this.bodies.setSolid(d.i, true);
    }
  }

  /**
   * A shot along origin + dir (normalised) for `dist` metres: breakable glass
   * on the way shatters (shots go through it; bulletproof glass stops them
   * before they get here, as a body they hit). Returns how many panes broke.
   */
  shootGlass(origin: Vec3, dir: Vec3, dist: number, instigator: number | null): number {
    let broke = 0;
    for (const d of this.glass) {
      if (!d.alive || d.b.glass !== 'breakable') continue;
      if (rayOBox(origin, dir, dist, d.b.box) === null) continue;
      this.destroy(d, instigator);
      broke++;
    }
    return broke;
  }

  /** Distances along a shot (origin + dir, normalised, for `dist` m) to the standing breakable panes it crosses. */
  glassAlong(origin: Vec3, dir: Vec3, dist: number): number[] {
    const out: number[] = [];
    for (const d of this.glass) {
      if (!d.alive || d.b.glass !== 'breakable') continue;
      const t = rayOBox(origin, dir, dist, d.b.box);
      if (t !== null) out.push(t);
    }
    return out;
  }

  private stepDoors(tick: number): void {
    const players = this.host.actors().filter((p) => p.alive);
    const speed = 1 / (DOOR.travelSeconds * TICK_RATE);
    for (const d of this.doors.values()) {
      const way = doorway(d.e);
      if (d.e.auto && !d.locked) {
        const near = players.some((p) => teamAllows(d.e.team, p.team) && hypot(p.pos.x - way.center.x, p.pos.z - way.center.z) <= DOOR.autoRadius && Math.abs(p.pos.y - d.e.position[1]) < 2.5);
        if (near) {
          d.lastNear = tick;
          if (d.target === 0) {
            this.setDoor(d, 1, null);
            d.autoOpened = true;
          }
        } else if (d.target === 1 && d.autoOpened && tick - d.lastNear > DOOR.autoCloseSeconds * TICK_RATE) {
          this.setDoor(d, 0, null);
        }
      }
      if (d.open < d.target) d.open = Math.min(1, d.open + speed);
      else if (d.open > d.target) {
        // Never close on someone standing in the doorway.
        if (!players.some((p) => playerInOBox(way, p.pos))) d.open = Math.max(0, d.open - speed);
      }
      this.bodies.setDoorOpen(d.i, Math.round(d.open * 1000) / 1000);
    }
  }

  private setDoor(d: DoorRt, target: 0 | 1, instigator: number | null): void {
    if (d.target === target) return;
    d.target = target;
    // Opened by logic or by hand: stays open until something closes it.
    d.autoOpened = false;
    this.host.emit({ e: 'door', i: d.i, open: target });
    this.fire(target === 1 ? 'door_opened' : 'door_closed', d.e.id, instigator);
  }

  private stepZones(): void {
    const alive = this.host.players().filter((p) => p.alive);
    for (const z of this.zones.values()) {
      if (!z.enabled) {
        z.inside.clear();
        z.satisfied = false;
        continue;
      }
      const box = zoneBox(z.e);
      const counted = z.e.team ? alive.filter((p) => p.team === z.e.team) : alive;
      const now = new Set(counted.filter((p) => pointInOBox(box, { x: p.pos.x, y: p.pos.y + 0.1, z: p.pos.z })).map((p) => p.slot));
      const entered = [...now].filter((s) => !z.inside.has(s));
      const left = [...z.inside].filter((s) => !now.has(s));
      z.inside = now;
      if (z.e.who === 'any') {
        for (const s of entered) this.fire('zone_enter', z.e.id, s);
        for (const s of left) this.fire('zone_exit', z.e.id, s);
        continue;
      }
      const sat = z.e.who === 'count' ? now.size >= z.e.count : counted.length > 0 && now.size === counted.length;
      if (sat && !z.satisfied) this.fire('zone_enter', z.e.id, entered[entered.length - 1] ?? [...now][0] ?? null);
      else if (!sat && z.satisfied) this.fire('zone_exit', z.e.id, left[0] ?? null);
      z.satisfied = sat;
    }
  }

  private stepTraps(tick: number): void {
    const players = this.host.actors().filter((p) => p.alive);
    for (const t of this.traps.values()) {
      const spec = TRAP_SPECS[t.e.trap];
      const was = t.active;
      if (!t.enabled) {
        t.active = false;
        t.armedAt = null;
        continue;
      }
      const activation = t.e.trap === 'mine' ? 'proximity' : t.e.activation;
      const on = Math.round(t.e.onSeconds * TICK_RATE);
      const off = Math.round(t.e.offSeconds * TICK_RATE);
      let base = false;
      switch (activation) {
        case 'always':
          base = true;
          break;
        case 'cycle': {
          const period = on + off;
          const phase = (((tick - this.roundStart + Math.round(t.e.offsetSeconds * TICK_RATE)) % period) + period) % period;
          base = phase < on;
          break;
        }
        case 'proximity': {
          if (t.active && tick >= t.activeUntil && tick >= t.forcedUntil) {
            t.rearmAt = tick + off;
            t.spent = t.e.trap === 'mine';
          }
          base = tick < t.activeUntil;
          if (!base && tick >= t.rearmAt) {
            t.spent = false;
            const trigger = trapTrigger(t.e);
            if (t.armedAt === null) {
              if (players.some((p) => playerInOBox(trigger, p.pos))) {
                t.armedAt = tick;
                if (spec.warnTicks > 0) this.host.emit({ e: 'trap', i: t.i, warn: 1 });
              }
            }
            if (t.armedAt !== null && tick - t.armedAt >= spec.warnTicks) {
              t.armedAt = null;
              t.activeUntil = tick + on;
              base = true;
            }
          }
          break;
        }
        case 'logic':
          base = false;
          break;
      }
      t.active = base || tick < t.forcedUntil;
      if (t.active && !was) this.trapFired(t, tick);
      if (!t.active) continue;

      if (spec.blast) continue;
      const hazard = trapHazard(t.e);
      if (spec.pulseDelayTicks !== undefined) {
        if (t.pulseAt !== null && tick >= t.pulseAt) {
          t.pulseAt = null;
          for (const p of players) if (playerInOBox(hazard, p.pos)) this.host.hurt(p.slot, trapDamage(t.e), trapWeaponId(t.e));
        }
        continue;
      }
      for (const p of players) {
        if (!playerInOBox(hazard, p.pos)) continue;
        const last = t.hitAt.get(p.slot) ?? -Infinity;
        if (tick - last < spec.intervalTicks) continue;
        t.hitAt.set(p.slot, tick);
        this.host.hurt(p.slot, trapDamage(t.e), trapWeaponId(t.e));
        if (spec.knockback) {
          // Electric fence: a spark from the nearest wire and a jolt away from the side they touched.
          const run = fenceRun(t.e);
          this.zap({ a: run.a, b: run.b, y0: t.e.position[1], height: ELECTRIC_FENCE.height, push: null, entity: t.i }, p, spec.knockback);
        }
      }
    }
  }

  /** The border's electric fence: always live, it zaps and throws back anyone who touches it. */
  private stepBorderFence(tick: number): void {
    if (!this.borderShocks.length) return;
    const rect = borderRect(this.map)!;
    const near = ELECTRIC_FENCE.inset + ELECTRIC_FENCE.reach + 0.5;
    const interval = Math.round(TICK_RATE * ELECTRIC_FENCE.interval);
    for (const p of this.host.actors()) {
      if (!p.alive) continue;
      const { x, z } = p.pos;
      if (Math.min(x - rect.min[0], rect.max[0] - x, z - rect.min[1], rect.max[1] - z) > near) continue;
      if (tick - (this.borderZappedAt.get(p.slot) ?? -Infinity) < interval) continue;
      for (const l of this.borderShocks) {
        const n = shockLineNearest(l, x, z);
        if (n.dist > ELECTRIC_FENCE.reach || p.pos.y > l.y0 + l.height || p.pos.y + PLAYER.height < l.y0 - 0.5) continue;
        this.borderZappedAt.set(p.slot, tick);
        this.host.hurt(p.slot, ELECTRIC_FENCE.damage, 'core.trap_shock');
        this.zap(l, p, ELECTRIC_FENCE.knockback);
        break;
      }
    }
  }

  /** A spark from the wire to the victim and a jolt away from the fence. */
  private zap(l: ShockLine, p: { slot: number; pos: Vec3 }, speed: number): void {
    const n = shockLineNearest(l, p.pos.x, p.pos.z);
    let dir: [number, number];
    if (l.push) dir = l.push;
    else {
      const vx = l.b[0] - l.a[0];
      const vz = l.b[1] - l.a[1];
      const len = hypot(vx, vz) || 1;
      // Left normal of the run, flipped to the side they are on.
      dir = [(-vz / len) * n.side, (vx / len) * n.side];
    }
    this.host.push?.(p.slot, { x: dir[0], y: 0.3, z: dir[1] }, speed);
    const wireY = Math.min(l.y0 + ELECTRIC_FENCE.height - 0.4, Math.max(l.y0 + 0.45, p.pos.y + 1.1));
    this.host.emit({ e: 'arc', s: -1, pts: [[n.x, wireY, n.z], [p.pos.x, p.pos.y + 1.1, p.pos.z]] });
  }

  private trapFired(t: TrapRt, tick: number): void {
    const spec = TRAP_SPECS[t.e.trap];
    t.hitAt.clear();
    this.host.emit({ e: 'trap', i: t.i });
    if (spec.pulseDelayTicks !== undefined) t.pulseAt = tick + spec.pulseDelayTicks;
    if (spec.blast) {
      const b = spec.blast;
      const dmg = t.e.damage ?? b.damage;
      this.host.blast({ x: t.e.position[0], y: t.e.position[1] + 0.3, z: t.e.position[2] }, b.radius, dmg, Math.min(dmg, b.edge), null, trapWeaponId(t.e));
      t.spent = true;
    }
    this.fire('trap_fired', t.e.id, null);
  }

  private stepTimers(tick: number): void {
    for (const def of this.map.logic.timers) {
      const end = this.timers.get(def.id);
      if (end === null || end === undefined || tick < end) continue;
      this.timers.set(def.id, def.loop ? tick + Math.round(def.seconds * TICK_RATE) : null);
      this.fire('timer_done', def.id, null);
    }
  }

  private stepSequences(tick: number): void {
    if (!this.sequences.length) return;
    const due = this.sequences.filter((s) => s.resumeTick <= tick);
    if (!due.length) return;
    this.sequences = this.sequences.filter((s) => s.resumeTick > tick);
    for (const s of due) this.run(s);
  }

  // ---------------------------------------------------------------- player actions

  /** A player pressed Use (E). */
  use(slot: number, eye: Vec3, yaw: number, pitch: number): void {
    const i = pickUsable(this.map, eye, yaw, pitch, (k) => this.usable(k));
    if (i === null) return;
    const e = this.map.entities[i]!;
    const tick = this.host.tick;
    const team = this.host.teamOf?.(slot) ?? null;
    if ((e.kind === 'button' || e.kind === 'door') && !teamAllows(e.team, team)) {
      this.host.emit({ e: 'use', s: slot, i, ok: 0 });
      return;
    }
    if (e.kind === 'button') {
      const b = this.buttons.get(i)!;
      if (!b.enabled || (b.e.once && b.used) || tick < b.readyAt) {
        this.host.emit({ e: 'use', s: slot, i, ok: 0 });
        return;
      }
      b.used = true;
      b.readyAt = tick + Math.round(b.e.cooldownSeconds * TICK_RATE);
      b.litUntil = tick + Math.round(TICK_RATE * 0.6);
      this.host.emit({ e: 'use', s: slot, i, ok: 1 });
      this.fire('button_pressed', e.id, slot);
    } else if (e.kind === 'door') {
      const d = this.doors.get(i)!;
      if (d.locked) {
        this.host.emit({ e: 'use', s: slot, i, ok: 0 });
        return;
      }
      this.host.emit({ e: 'use', s: slot, i, ok: 1 });
      this.setDoor(d, d.target === 1 ? 0 : 1, slot);
    }
  }

  /** Whether entity i can currently be aimed at with Use (buttons, manual or locked doors). */
  private usable(i: number): boolean {
    const d = this.doors.get(i);
    if (d) return !d.e.auto || d.locked;
    return this.buttons.has(i);
  }

  /** Damage to a door/crate/wall collider hit by a shot or blade. Returns true if it was a scenario body. */
  damageBody(handle: number, amount: number, instigator: number | null): boolean {
    const i = this.bodies.entityAt(handle);
    if (i === undefined) return false;
    const d = this.destructibles.get(i);
    if (d) this.damageDestructible(d, amount, false, instigator);
    return true;
  }

  /** Explosion damage to destructibles in range. */
  splash(at: Vec3, radius: number, damage: number, edge: number, owner: number | null, physics: PhysicsWorld): void {
    for (const d of this.destructibles.values()) {
      if (!d.alive) continue;
      const box = oboxAabb(d.b.box);
      const closest = { x: clampTo(at.x, box.min.x, box.max.x), y: clampTo(at.y, box.min.y, box.max.y), z: clampTo(at.z, box.min.z, box.max.z) };
      const dist = distance(at, closest);
      if (dist > radius) continue;
      // Line of sight to just short of the surface (the box itself would block a ray to its centre).
      const back = dist > 0.15 ? { x: closest.x + ((at.x - closest.x) / dist) * 0.1, y: closest.y + ((at.y - closest.y) / dist) * 0.1, z: closest.z + ((at.z - closest.z) / dist) * 0.1 } : at;
      if (dist > 0.15 && !physics.lineOfSight(at, back)) continue;
      this.damageDestructible(d, damage + (edge - damage) * (dist / radius), true, owner);
    }
  }

  private damageDestructible(d: DestructibleRt, amount: number, explosive: boolean, instigator: number | null): void {
    if (!d.alive || (d.b.explosiveOnly && !explosive) || d.b.shootable === false) return;
    // Bulletproof glass cracks (its health shows how badly) but never gives way.
    if (d.b.glass === 'reinforced') {
      const before = d.health;
      d.health = Math.max(1, d.health - amount);
      if (d.health < before) this.host.emit({ e: 'crack', i: d.i });
      return;
    }
    d.health -= amount;
    if (d.health <= 0) this.destroy(d, instigator);
  }

  private destroy(d: DestructibleRt, instigator: number | null): void {
    if (!d.alive) return;
    d.alive = false;
    d.health = 0;
    // Hidden solid blocks stay gone until logic puts them back.
    if (d.block?.e.respawnSeconds && d.block.e.behaviour !== 'solid') d.block.respawnAt = this.host.tick + Math.round(d.block.e.respawnSeconds * TICK_RATE);
    // Glass comes back after the map's glass time (next round without one).
    if (d.b.glass) {
      const back = this.map.glass?.respawnSeconds;
      d.glassBack = back ? this.host.tick + Math.round(back * TICK_RATE) : null;
    }
    this.bodies.setSolid(d.i, false);
    this.bodies.commit();
    this.host.emit({ e: 'broken', i: d.i });
    const blast = d.b.blast;
    if (blast) this.host.blast(d.b.box.center, blast.radius, blast.damage, blast.edge, instigator, BARREL_WEAPON_ID);
    this.fire('destroyed', d.id, instigator);
  }

  /** A pickup was taken (Match calls this). */
  pickupTaken(id: string, slot: number): void {
    this.fire('pickup_taken', id, slot);
  }

  playerKilled(victim: number, killer: number | null): void {
    this.fire('player_killed', null, killer ?? victim);
  }

  isPickupEnabled(id: string): boolean {
    return this.pickupEnabled.get(id) !== false;
  }

  // ---------------------------------------------------------------- logic

  /** Per-tick budgets start again each tick (events also fire between steps, from Match). */
  private budgetNow(): void {
    const tick = this.host.tick;
    if (tick === this.budgetTick) return;
    this.budgetTick = tick;
    this.actionsThisTick = 0;
    this.firingsThisTick = 0;
  }

  private overBudget(kind: string, text: string): void {
    if (this.budgetWarned.has(kind)) return;
    this.budgetWarned.add(kind);
    this.host.budgetWarning?.(text);
  }

  /** Events put off from an earlier tick by the per-tick budget, oldest first. */
  private stepDeferred(): void {
    if (!this.deferredEvents.length) return;
    const list = this.deferredEvents;
    this.deferredEvents = [];
    for (const d of list) this.fire(d.event, d.target, d.instigator, d.from);
  }

  /** Run every rule listening for this event. */
  fire(event: EventType, target: string | null, instigator: number | null, from = 0): void {
    if (this.depth >= MAX_EVENT_DEPTH) return;
    this.budgetNow();
    const tick = this.host.tick;
    this.depth++;
    try {
      const rules = this.map.logic.rules;
      for (let ri = from; ri < rules.length; ri++) {
        const rule = rules[ri]!;
        if (!rule.enabled || this.spentRules.has(rule.id) || rule.when.event !== event) continue;
        if (rule.when.target !== null && rule.when.target !== target) continue;
        // Too much this tick: the rest of this event's rules wait for the next one (dropped when too much already waits).
        if (this.firingsThisTick >= RESOURCE_BUDGETS.ruleFiringsPerTick) {
          if (this.deferredEvents.length < RESOURCE_BUDGETS.deferredEvents) this.deferredEvents.push({ event, target, instigator, from: ri });
          this.overBudget('firings', `map logic fired over ${RESOURCE_BUDGETS.ruleFiringsPerTick} rules in one tick: later events wait for the next tick`);
          return;
        }
        // One rule firing over and over (a rule loop) is held to a few dozen times a second.
        const w = this.ruleWindow.get(rule.id);
        if (!w || tick - w.start >= TICK_RATE) this.ruleWindow.set(rule.id, { start: tick, n: 1 });
        else if (++w.n > RESOURCE_BUDGETS.ruleFiringsPerSecond) {
          this.overBudget(`rate:${rule.id}`, `rule "${rule.name || rule.id}" fired over ${RESOURCE_BUDGETS.ruleFiringsPerSecond} times in a second: the extra firings are skipped`);
          continue;
        }
        if (!rule.if.every((c) => this.check(c))) continue;
        if (rule.once) this.spentRules.add(rule.id);
        this.firingsThisTick++;
        this.run({ actions: rule.do, pc: 0, resumeTick: 0, instigator });
      }
    } finally {
      this.depth--;
    }
  }

  private run(seq: Sequence): void {
    this.budgetNow();
    while (seq.pc < seq.actions.length) {
      // Out of actions for this tick: the rest of the sequence carries on next tick.
      if (this.actionsThisTick >= RESOURCE_BUDGETS.triggerActionsPerTick) {
        this.overBudget('actions', `map logic ran over ${RESOURCE_BUDGETS.triggerActionsPerTick} actions in one tick: the rest carries on next tick`);
        if (this.sequences.length >= MAX_SEQUENCES) return;
        seq.resumeTick = this.host.tick + 1;
        this.sequences.push(seq);
        return;
      }
      const a = seq.actions[seq.pc++]!;
      this.actionsThisTick++;
      if (a.type === 'wait') {
        if (a.value <= 0) continue;
        if (this.sequences.length >= MAX_SEQUENCES) return;
        seq.resumeTick = this.host.tick + Math.max(1, Math.round(a.value * TICK_RATE));
        this.sequences.push(seq);
        return;
      }
      this.execute(a, seq.instigator);
    }
  }

  private entityIndex(id: string | null, kind?: MapEntity['kind']): number | undefined {
    if (id === null) return undefined;
    const i = this.index.get(id);
    if (i === undefined || (kind && this.map.entities[i]!.kind !== kind)) return undefined;
    return i;
  }

  private check(c: LogicCondition): boolean {
    switch (c.type) {
      case 'variable':
        return c.target !== null && this.vars.has(c.target) && compare(this.vars.get(c.target)!, c.op, c.value);
      case 'objective':
        return c.target !== null && this.objectives.get(c.target) === c.state;
      case 'door': {
        const d = this.doors.get(this.entityIndex(c.target, 'door') ?? -1);
        if (!d) return false;
        return c.state === 'open' ? d.target === 1 : c.state === 'closed' ? d.target === 0 : c.state === 'locked' ? d.locked : !d.locked;
      }
      case 'zone_count': {
        const z = this.zones.get(this.entityIndex(c.target, 'zone') ?? -1);
        return !!z && compare(z.inside.size, c.op, c.value);
      }
      case 'enabled': {
        const on = this.isEnabled(c.target);
        return on !== undefined && on === (c.state !== 'disabled');
      }
      case 'encounter_alive':
        return this.entityIndex(c.target, 'encounter') !== undefined && compare(this.host.encounterAlive(c.target!), c.op, c.value);
      case 'light': {
        const l = this.lights.get(this.entityIndex(c.target, 'light') ?? -1);
        return !!l && l.on === (c.state !== 'off');
      }
      case 'block': {
        const d = this.destructibles.get(this.entityIndex(c.target, 'block') ?? -1);
        return !!d && d.alive === (c.state !== 'gone');
      }
      case 'mover_at': {
        const m = this.moverRt.get(this.entityIndex(c.target, 'mover') ?? -1);
        if (!m) return false;
        const at = this.movers.parkedAt(m.k, this.host.tick);
        return compare(at === null ? 0 : at + 1, c.op, c.value);
      }
    }
  }

  /** Whether a toggleable entity is switched on (undefined: no such entity). */
  isEnabled(id: string | null): boolean | undefined {
    const i = this.entityIndex(id);
    if (i === undefined) return undefined;
    const e = this.map.entities[i]!;
    if (e.kind === 'pickup') return this.isPickupEnabled(e.id);
    if (e.kind === 'block') return this.destructibles.get(i)?.alive;
    if (e.kind === 'light') return this.lights.get(i)?.on;
    return (this.buttons.get(i) ?? this.zones.get(i) ?? this.traps.get(i) ?? this.moverRt.get(i) ?? this.portalRt.get(i))?.enabled;
  }

  private setEnabled(id: string | null, enabled: boolean): void {
    const i = this.entityIndex(id);
    if (i === undefined) return;
    const e = this.map.entities[i]!;
    if (e.kind === 'pickup') {
      this.pickupEnabled.set(e.id, enabled);
      this.host.setPickupEnabled(e.id, enabled);
      return;
    }
    if (e.kind === 'block') {
      const d = this.destructibles.get(i);
      if (d) {
        if (enabled) this.restore(d);
        else this.destroy(d, null);
      }
      return;
    }
    if (e.kind === 'light') {
      const l = this.lights.get(i);
      if (l) l.on = enabled;
      return;
    }
    const rt = this.buttons.get(i) ?? this.zones.get(i) ?? this.traps.get(i) ?? this.moverRt.get(i) ?? this.portalRt.get(i);
    if (rt) rt.enabled = enabled;
  }

  /** Put a dropped, broken or hidden block back at once (unless someone stands where it goes; then it comes back as soon as they move). */
  private restore(d: DestructibleRt): void {
    if (d.alive || !d.block) return;
    d.block.respawnAt = this.host.tick;
    d.block.triggeredAt = null;
    this.stepBlocks(this.host.tick);
  }

  private execute(a: LogicAction, instigator: number | null): void {
    const tick = this.host.tick;
    switch (a.type) {
      case 'door_open':
      case 'door_close':
      case 'door_toggle': {
        const d = this.doors.get(this.entityIndex(a.target, 'door') ?? -1);
        if (!d) return;
        const want = a.type === 'door_open' ? 1 : a.type === 'door_close' ? 0 : d.target === 1 ? 0 : 1;
        this.setDoor(d, want, instigator);
        break;
      }
      case 'door_lock':
      case 'door_unlock': {
        const d = this.doors.get(this.entityIndex(a.target, 'door') ?? -1);
        if (d) d.locked = a.type === 'door_lock';
        break;
      }
      case 'enable':
      case 'disable':
        this.setEnabled(a.target, a.type === 'enable');
        break;
      case 'trap_fire': {
        const t = this.traps.get(this.entityIndex(a.target, 'trap') ?? -1);
        if (t && t.enabled) t.forcedUntil = tick + Math.round(t.e.onSeconds * TICK_RATE);
        break;
      }
      case 'destroy': {
        const d = this.destructibles.get(this.entityIndex(a.target) ?? -1);
        if (d) this.destroy(d, instigator);
        break;
      }
      case 'set_var':
      case 'add_var': {
        if (a.target === null || !this.vars.has(a.target)) return;
        const before = this.vars.get(a.target)!;
        const after = a.type === 'set_var' ? a.value : before + a.value;
        if (after === before) return;
        this.vars.set(a.target, after);
        this.fire('variable_changed', a.target, instigator);
        break;
      }
      case 'objective': {
        if (a.target === null || !this.objectives.has(a.target)) return;
        const state = (OBJECTIVE_STATES as readonly string[]).includes(a.state) ? (a.state as ObjectiveState) : 'active';
        if (this.objectives.get(a.target) === state) return;
        this.objectives.set(a.target, state);
        const index = this.map.logic.objectives.findIndex((o) => o.id === a.target);
        this.host.emit({ e: 'obj', i: index, st: OBJECTIVE_STATES.indexOf(state) });
        if (state === 'complete') this.fire('objective_completed', a.target, instigator);
        break;
      }
      case 'timer_start': {
        const def = this.map.logic.timers.find((t) => t.id === a.target);
        if (def) this.timers.set(def.id, tick + Math.round(def.seconds * TICK_RATE));
        break;
      }
      case 'timer_stop':
        if (a.target !== null && this.timers.has(a.target)) this.timers.set(a.target, null);
        break;
      case 'message':
        if (a.text) this.host.emit({ e: 'msg', text: a.text, secs: a.value > 0 ? Math.min(a.value, 30) : 4 });
        break;
      case 'sound':
        this.host.emit({ e: 'cue', cue: a.state || 'chime' });
        break;
      case 'end_round':
        if (a.state === 'players win' || a.state === 'players lose') this.host.endRound(null, a.state === 'players win' ? 'victory' : 'defeat');
        else this.host.endRound(a.state === 'nobody wins' ? null : instigator);
        break;
      case 'next_map': {
        const id = a.text.trim();
        if (isMapId(id)) this.host.endRound(null, 'victory', id);
        break;
      }
      case 'encounter_start':
      case 'encounter_stop':
      case 'encounter_order':
        if (this.entityIndex(a.target, 'encounter') === undefined) return;
        this.host.encounter(a.target!, a.type === 'encounter_start' ? 'start' : a.type === 'encounter_stop' ? 'stop' : 'order', (SQUAD_ORDERS as readonly string[]).includes(a.state) ? (a.state as SquadOrder) : 'attack');
        break;
      case 'light_on':
      case 'light_off':
      case 'light_toggle':
      case 'light_color':
      case 'light_flash':
      case 'light_blink': {
        const l = this.lights.get(this.entityIndex(a.target, 'light') ?? -1);
        if (!l) return;
        if (a.type === 'light_on') l.on = true;
        else if (a.type === 'light_off') l.on = false;
        else if (a.type === 'light_toggle') l.on = !l.on;
        else if (a.type === 'light_color') l.color = hexColor(isHexColor(a.text.trim()) ? a.text.trim().toLowerCase() : l.e.color);
        else if (a.type === 'light_flash') l.flashUntil = tick + Math.max(1, Math.round((a.value > 0 ? Math.min(a.value, 30) : 0.3) * TICK_RATE));
        else l.blink = a.state === 'off' ? 0 : Math.max(0.2, Math.min(10, a.value || 2));
        break;
      }
      case 'block_drop':
      case 'block_restore': {
        const d = this.destructibles.get(this.entityIndex(a.target, 'block') ?? -1);
        if (!d) return;
        if (a.type === 'block_drop') this.destroy(d, instigator);
        else this.restore(d);
        break;
      }
      case 'mover_go':
      case 'mover_to': {
        const m = this.moverRt.get(this.entityIndex(a.target, 'mover') ?? -1);
        if (!m) return;
        const def = this.movers.defs[m.k]!;
        const leg = this.movers.legs[m.k]!;
        const n = def.points.length;
        const target = a.type === 'mover_to' ? Math.max(0, Math.min(n - 1, Math.round(a.value) - 1)) : this.nextPoint(m, def.e.mode === 'loop', n, m.queued ?? leg.to);
        if (leg.from === leg.to) {
          // Parked: leave now.
          if (target !== leg.to) this.movers.legs[m.k] = { from: leg.to, to: target, start: tick };
          m.queued = null;
        } else m.queued = target;
        break;
      }
      case 'wait':
        break;
    }
  }

  // ---------------------------------------------------------------- queries

  /**
   * Obstacles bots must path around: locked or manual closed doors (and
   * team-only doors of another team) and intact breakable walls. `team`: the
   * bot's team or faction.
   */
  blockers(team: string | null = null): Aabb[] {
    const out: Aabb[] = [];
    for (const d of this.doors.values()) {
      // Just the door's own plane, so goals standing next to a closed door stay reachable.
      if (d.open < 0.9 && (d.locked || !d.e.auto || !teamAllows(d.e.team, team))) out.push(this.doorPlane(d));
    }
    for (const d of this.destructibles.values()) {
      if (d.alive && d.b.blocksPaths) out.push(oboxAabb(d.b.box));
    }
    return out;
  }

  private doorPlane(d: DoorRt): Aabb {
    return oboxAabb({ ...doorway(d.e), half: { ...doorway(d.e).half, z: DOOR.thickness } });
  }

  /**
   * Closed doors a button opens, for bots whose path they block: the door's
   * blocker box (the same box `blockers` gives), where to stand to press the
   * button and the button face to look at. Only buttons `team` may press and
   * rules that open, toggle or unlock-and-open the door count.
   */
  doorButtons(team: string | null = null): { door: Aabb; stand: Vec3; face: Vec3; button: string }[] {
    const out: { door: Aabb; stand: Vec3; face: Vec3; button: string }[] = [];
    for (const rule of this.map.logic.rules) {
      if (!rule.enabled || this.spentRules.has(rule.id) || rule.when.event !== 'button_pressed' || !rule.when.target) continue;
      const b = this.buttons.get(this.entityIndex(rule.when.target, 'button') ?? -1);
      if (!b || !b.enabled || (b.e.once && b.used) || !teamAllows(b.e.team, team)) continue;
      for (const a of rule.do) {
        if (a.type !== 'door_open' && a.type !== 'door_toggle' && a.type !== 'door_unlock') continue;
        const d = this.doors.get(this.entityIndex(a.target, 'door') ?? -1);
        if (!d || d.open >= 0.9 || d.target === 1) continue;
        // Unlocking alone opens only doors that then open by themselves for this bot.
        if (a.type === 'door_unlock' && !(d.e.auto && teamAllows(d.e.team, team)) && !rule.do.some((x) => x.target === d.e.id && (x.type === 'door_open' || x.type === 'door_toggle'))) continue;
        const pos = entityPos(b.e);
        out.push({ door: this.doorPlane(d), stand: localToWorld(pos, b.e.yaw, 0, 0, 1), face: localToWorld(pos, b.e.yaw, 0, BUTTON.height, 0.15), button: b.e.id });
      }
    }
    return out;
  }

  /** Trap regions that are dangerous right now (active or about to fire). Mines stay hidden from bots. */
  hazards(): Aabb[] {
    const out: Aabb[] = [];
    for (const t of this.traps.values()) {
      if (t.e.trap === 'mine' || !t.enabled) continue;
      if (t.active || t.armedAt !== null) out.push(oboxAabb(trapHazard(t.e)));
    }
    return out;
  }

  objectiveState(id: string): ObjectiveState | undefined {
    return this.objectives.get(id);
  }

  variable(id: string): number | undefined {
    return this.vars.get(id);
  }

  doorOpen(id: string): number | undefined {
    return this.doors.get(this.entityIndex(id, 'door') ?? -1)?.open;
  }

  private lightFlags(l: LightRt, tick: number): number {
    return (l.on ? LIGHT_ON : 0) | (tick < l.flashUntil ? LIGHT_FLASH : 0) | (Math.round(l.blink * 10) << 2);
  }

  /** A light's state as sent to players: [flags (LIGHT_*), colour 0xrrggbb]. */
  lightState(id: string): [number, number] | undefined {
    const l = this.lights.get(this.entityIndex(id, 'light') ?? -1);
    return l && [this.lightFlags(l, this.host.tick), l.color];
  }

  /** Point (1 = first) a mover is parked at, 0 while travelling. */
  moverAt(id: string): number | undefined {
    const m = this.moverRt.get(this.entityIndex(id, 'mover') ?? -1);
    if (!m) return undefined;
    const at = this.movers.parkedAt(m.k, this.host.tick);
    return at === null ? 0 : at + 1;
  }

  destructibleAlive(id: string): boolean | undefined {
    return this.destructibles.get(this.entityIndex(id) ?? -1)?.alive;
  }

  // ---------------------------------------------------------------- snapshots

  private entityStates(): [number, number, number][] {
    const tick = this.host.tick;
    const out: [number, number, number][] = [];
    for (const d of this.doors.values()) out.push([d.i, Math.round(d.open * 100), d.locked ? 1 : 0]);
    for (const b of this.buttons.values()) out.push([b.i, b.enabled && !(b.e.once && b.used) ? 1 : 0, tick < b.litUntil ? 1 : 0]);
    // Blocks also say whether they are giving way (shaking).
    for (const d of this.destructibles.values()) out.push([d.i, d.alive ? Math.max(1, Math.ceil((d.health / d.max) * 100)) : 0, d.alive && d.block?.triggeredAt != null ? 1 : 0]);
    for (const z of this.zones.values()) out.push([z.i, z.enabled ? 1 : 0, z.inside.size]);
    for (const t of this.traps.values()) {
      const flags = (t.enabled ? TRAP_ENABLED : 0) | (t.active ? TRAP_ACTIVE : 0) | (t.armedAt !== null ? TRAP_WARNING : 0) | (t.spent ? TRAP_SPENT : 0);
      out.push([t.i, flags, 0]);
    }
    for (const l of this.lights.values()) {
      if (this.drivenLights.has(l.i)) out.push([l.i, this.lightFlags(l, tick), l.color]);
    }
    for (const m of this.moverRt.values()) out.push(this.movers.encode(m.k));
    for (const p of this.portalRt.values()) out.push([p.i, p.enabled ? 1 : 0, 0]);
    return out;
  }

  private objectiveStates(): number[] {
    return this.map.logic.objectives.map((o) => OBJECTIVE_STATES.indexOf(this.objectives.get(o.id) ?? 'inactive'));
  }

  private timerStates(): [number, number][] {
    const tick = this.host.tick;
    const out: [number, number][] = [];
    this.map.logic.timers.forEach((t, k) => {
      const end = this.timers.get(t.id);
      if (t.visible && end !== null && end !== undefined) out.push([k, Math.max(0, Math.ceil((end - tick) / TICK_RATE))]);
    });
    return out;
  }

  /** Everything, for a joining player. Doesn't affect delta tracking. */
  fullState(): ScenarioSnapshot {
    return { es: this.entityStates(), ob: this.objectiveStates(), tm: this.timerStates() };
  }

  /** What changed since the previous call (all of it on keyframes). Call once per broadcast snapshot. */
  delta(): ScenarioSnapshot | undefined {
    const keyframe = this.snapshots++ % KEYFRAME_EVERY === 0;
    const out: ScenarioSnapshot = {};
    const es = this.entityStates().filter(([i, a, b]) => {
      const key = `${a},${b}`;
      if (!keyframe && this.lastSent.get(i) === key) return false;
      this.lastSent.set(i, key);
      return true;
    });
    if (es.length) out.es = es;
    const ob = this.objectiveStates();
    const obKey = ob.join(',');
    if (ob.length && (keyframe || obKey !== this.obSent)) out.ob = ob;
    this.obSent = obKey;
    const tm = this.timerStates();
    const tmKey = JSON.stringify(tm);
    if (keyframe ? tm.length > 0 : tmKey !== this.tmSent) out.tm = tm;
    this.tmSent = tmKey;
    return out.es || out.ob || out.tm ? out : undefined;
  }
}

const clampTo = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * The button or door a player at `eye` looking along (yaw, pitch) would use:
 * the nearest one within reach that is roughly in front of them. Shared by the
 * server (pressing) and the client (the "E" prompt).
 */
export function pickUsable(map: MapDocument, eye: Vec3, yaw: number, pitch: number, candidate: (index: number) => boolean): number | null {
  const look = viewDirection(yaw, pitch);
  let best: number | null = null;
  let bestD = Infinity;
  map.entities.forEach((e, i) => {
    if ((e.kind !== 'button' && e.kind !== 'door') || !candidate(i)) return;
    const target = e.kind === 'button' ? { x: e.position[0], y: e.position[1] + BUTTON.height, z: e.position[2] } : { ...entityPos(e), y: e.position[1] + Math.min(PLAYER.eyeHeight, 1.5) };
    const reach = e.kind === 'button' ? BUTTON.reach : DOOR_USE_REACH;
    const d = distance(eye, target);
    if (d > reach || d >= bestD) return;
    const dir = { x: (target.x - eye.x) / (d || 1), y: (target.y - eye.y) / (d || 1), z: (target.z - eye.z) / (d || 1) };
    const facing = dir.x * look.x + dir.y * look.y + dir.z * look.z;
    if (d > 0.5 && facing < BUTTON.facingCos) return;
    best = i;
    bestD = d;
  });
  return best;
}
