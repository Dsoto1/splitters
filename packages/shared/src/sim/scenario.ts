import { SQUAD_ORDERS, type BlockEntity, type ButtonEntity, type DestructibleEntity, type DoorEntity, type MapDocument, type MapEntity, type SquadOrder, type TrapEntity, type ZoneEntity } from '../map/schema.ts';
import { OBJECTIVE_STATES, type CompareOp, type EventType, type LogicAction, type LogicCondition, type ObjectiveState } from '../map/logic.ts';
import { distance, viewDirection, type Vec3 } from '../math.ts';
import { TRAP_ACTIVE, TRAP_ENABLED, TRAP_SPENT, TRAP_WARNING, type GameEvent, type ScenarioSnapshot } from '../protocol.ts';
import { PLAYER, TICK_RATE } from './constants.ts';
import type { PhysicsWorld } from './physics.ts';
import {
  BUTTON,
  DESTRUCTIBLE_SPECS,
  DOOR,
  DOOR_USE_REACH,
  ScenarioBodies,
  TRAP_SPECS,
  breakableOf,
  type Breakable,
  doorway,
  entityPos,
  oboxAabb,
  playerInOBox,
  pointInOBox,
  trapDamage,
  trapHazard,
  trapTrigger,
  zoneBox,
  type Aabb,
} from './scenarioDefs.ts';

/** What the scenario needs from the match it runs in. */
export interface ScenarioHost {
  readonly tick: number;
  /** Players (humans and Player Bots): zones count these. */
  players(): readonly { slot: number; alive: boolean; pos: Vec3 }[];
  /** Players and NPCs: doors open for them and traps hurt them. */
  actors(): readonly { slot: number; alive: boolean; pos: Vec3 }[];
  hurt(slot: number, amount: number, weapon: string): void;
  /** An explosion (barrel, mine) that hurts players and other destructibles. */
  blast(at: Vec3, radius: number, damage: number, edge: number, owner: number | null, weapon: string): void;
  /** End the round; co-op missions pass an outcome. */
  endRound(winner: number | null, outcome?: 'victory' | 'defeat'): void;
  encounter(id: string, op: 'start' | 'stop' | 'order', order?: SquadOrder): void;
  encounterAlive(id: string): number;
  setPickupEnabled(id: string, enabled: boolean): void;
  emit(ev: GameEvent): void;
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
  private lastSent = new Map<number, string>();
  private obSent = '';
  private tmSent = '';
  private snapshots = 0;

  constructor(
    readonly map: MapDocument,
    physics: PhysicsWorld,
    private readonly host: ScenarioHost,
  ) {
    this.bodies = new ScenarioBodies(physics, map);
    map.entities.forEach((e, i) => this.index.set(e.id, i));
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
          const b = breakableOf(e);
          if (!b) break;
          this.destructibles.set(i, { i, id: e.id, b, health: b.health, max: b.health, alive: true, block: { e, triggeredAt: null, respawnAt: null } });
          this.bodies.setSolid(i, true);
          break;
        }
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
    const logic = this.map.logic;
    this.vars = new Map(logic.variables.map((v) => [v.id, v.initial]));
    this.objectives = new Map(logic.objectives.map((o) => [o.id, o.startActive ? 'active' : 'inactive']));
    this.timers = new Map(logic.timers.map((t) => [t.id, null]));
    this.spentRules.clear();
    this.sequences = [];
    this.started = false;
    this.roundStart = tick;
    this.bodies.commit();
  }

  // ---------------------------------------------------------------- per tick

  step(): void {
    const tick = this.host.tick;
    if (!this.started) {
      this.started = true;
      this.roundStart = tick;
      this.fire('match_start', null, null);
    }
    this.stepDoors(tick);
    this.stepBlocks(tick);
    this.stepZones();
    this.stepTraps(tick);
    this.stepTimers(tick);
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

  private stepDoors(tick: number): void {
    const players = this.host.actors().filter((p) => p.alive);
    const speed = 1 / (DOOR.travelSeconds * TICK_RATE);
    for (const d of this.doors.values()) {
      const way = doorway(d.e);
      if (d.e.auto && !d.locked) {
        const near = players.some((p) => Math.hypot(p.pos.x - way.center.x, p.pos.z - way.center.z) <= DOOR.autoRadius && Math.abs(p.pos.y - d.e.position[1]) < 2.5);
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
      const now = new Set(alive.filter((p) => pointInOBox(box, { x: p.pos.x, y: p.pos.y + 0.1, z: p.pos.z })).map((p) => p.slot));
      const entered = [...now].filter((s) => !z.inside.has(s));
      const left = [...z.inside].filter((s) => !now.has(s));
      z.inside = now;
      if (z.e.who === 'any') {
        for (const s of entered) this.fire('zone_enter', z.e.id, s);
        for (const s of left) this.fire('zone_exit', z.e.id, s);
        continue;
      }
      const sat = z.e.who === 'count' ? now.size >= z.e.count : alive.length > 0 && now.size === alive.length;
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
      }
    }
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
    d.health -= amount;
    if (d.health <= 0) this.destroy(d, instigator);
  }

  private destroy(d: DestructibleRt, instigator: number | null): void {
    if (!d.alive) return;
    d.alive = false;
    d.health = 0;
    if (d.block?.e.respawnSeconds) d.block.respawnAt = this.host.tick + Math.round(d.block.e.respawnSeconds * TICK_RATE);
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

  /** Run every rule listening for this event. */
  fire(event: EventType, target: string | null, instigator: number | null): void {
    if (this.depth >= MAX_EVENT_DEPTH) return;
    this.depth++;
    try {
      for (const rule of this.map.logic.rules) {
        if (!rule.enabled || this.spentRules.has(rule.id) || rule.when.event !== event) continue;
        if (rule.when.target !== null && rule.when.target !== target) continue;
        if (!rule.if.every((c) => this.check(c))) continue;
        if (rule.once) this.spentRules.add(rule.id);
        this.run({ actions: rule.do, pc: 0, resumeTick: 0, instigator });
      }
    } finally {
      this.depth--;
    }
  }

  private run(seq: Sequence): void {
    while (seq.pc < seq.actions.length) {
      const a = seq.actions[seq.pc++]!;
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
    }
  }

  private isEnabled(id: string | null): boolean | undefined {
    const i = this.entityIndex(id);
    if (i === undefined) return undefined;
    const e = this.map.entities[i]!;
    if (e.kind === 'pickup') return this.isPickupEnabled(e.id);
    return (this.buttons.get(i) ?? this.zones.get(i) ?? this.traps.get(i))?.enabled;
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
    const rt = this.buttons.get(i) ?? this.zones.get(i) ?? this.traps.get(i);
    if (rt) rt.enabled = enabled;
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
      case 'encounter_start':
      case 'encounter_stop':
      case 'encounter_order':
        if (this.entityIndex(a.target, 'encounter') === undefined) return;
        this.host.encounter(a.target!, a.type === 'encounter_start' ? 'start' : a.type === 'encounter_stop' ? 'stop' : 'order', (SQUAD_ORDERS as readonly string[]).includes(a.state) ? (a.state as SquadOrder) : 'attack');
        break;
      case 'wait':
        break;
    }
  }

  // ---------------------------------------------------------------- queries

  /** Obstacles bots must path around: locked or manual closed doors and intact breakable walls. */
  blockers(): Aabb[] {
    const out: Aabb[] = [];
    for (const d of this.doors.values()) {
      // Just the door's own plane, so goals standing next to a closed door stay reachable.
      if (d.open < 0.9 && (d.locked || !d.e.auto)) out.push(oboxAabb({ ...doorway(d.e), half: { ...doorway(d.e).half, z: DOOR.thickness } }));
    }
    for (const d of this.destructibles.values()) {
      if (d.alive && d.b.blocksPaths) out.push(oboxAabb(d.b.box));
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
