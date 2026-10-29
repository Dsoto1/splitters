import type { BotBrain } from '../bots/brain.ts';
import type { EventType } from '../map/logic.ts';
import { NPC_ROLES, type EncounterEntity, type MapDocument, type MapPath, type NpcRole, type SquadOrder } from '../map/schema.ts';
import { pathGeometry } from '../map/track.ts';
import { clamp, horizontalDistance, type Vec3 } from '../math.ts';
import type { NavWorld } from '../nav/index.ts';
import { PLAYER, TICK_RATE } from './constants.ts';
import { rosterCount } from './npc.ts';

/** What the encounter system needs from the match. */
export interface EncounterHost {
  readonly tick: number;
  readonly nav: NavWorld;
  /** Living players (humans and Player Bots). */
  players(): readonly { slot: number; pos: Vec3 }[];
  /** Positions of living actors hostile to this faction. */
  hostiles(faction: string): readonly { id: number; pos: Vec3 }[];
  /** Create an NPC; returns its actor ID, or null if it couldn't be placed. */
  spawnNpc(e: EncounterEntity, role: NpcRole, pos: Vec3, yaw: number): number | null;
  npc(id: number): { alive: boolean; pos: Vec3; brain: BotBrain } | undefined;
  entityPos(id: string): Vec3 | undefined;
  fire(event: EventType, target: string, instigator: number | null): void;
  random(): number;
}

interface EncounterRt {
  e: EncounterEntity;
  active: boolean;
  /** Total NPCs this run may spawn (roster + reinforcements, scaled by players). */
  budget: number;
  spawned: number;
  members: number[];
  nextSpawn: number;
  order: SquadOrder;
  cleared: boolean;
  queue: NpcRole[];
  /** Patrol leg per member: 0 = home, 1 = target. */
  legs: Map<number, number>;
  /** Roamers: where each member is wandering to now. */
  wander: Map<number, Vec3>;
  /** Route patrols: which way along the route each member walks (1 with the path's direction, -1 against it). */
  dirs: Map<number, number>;
  /** Route patrols round an open route: members walking back from its end to its start. */
  homing: Set<number>;
}

/** Route patrols aim this far ahead along the route (m), and join it from further off than this. */
const ROUTE_STEP = 5;
const ROUTE_ON = 4;

/** Members re-share sightings this often. */
const ALERT_INTERVAL_TICKS = 15;
/** NPCs don't spawn closer than this to a hostile if there's any other choice. */
const SAFE_SPAWN_DISTANCE = 6;
/** Squads with an entrance come out of it one at a time, this far apart. */
const ENTRANCE_GAP_TICKS = Math.round(TICK_RATE * 0.9);

/**
 * Encounter spawners and their squads. Each encounter is one squad: the squad
 * picks the high-level goal from its order (hold, attack, defend, patrol,
 * follow) and shares sightings; members fight individually with the bot brain.
 */
export class Encounters {
  private readonly list = new Map<string, EncounterRt>();
  private readonly byNpc = new Map<number, EncounterRt>();
  private started = false;
  /** The map's paths by id: the routes squads with the patrol order walk (an encounter's `route`). */
  private readonly routes = new Map<string, MapPath>();

  constructor(
    map: MapDocument,
    private readonly host: EncounterHost,
  ) {
    for (const e of map.entities) if (e.kind === 'encounter') this.list.set(e.id, this.fresh(e));
    for (const p of map.paths ?? []) if (p.points.length >= 2) this.routes.set(p.id, p);
  }

  private fresh(e: EncounterEntity): EncounterRt {
    return { e, active: false, budget: 0, spawned: 0, members: [], nextSpawn: 0, order: e.order, cleared: false, queue: [], legs: new Map(), wander: new Map(), dirs: new Map(), homing: new Set() };
  }

  /** Back to the start (new round). The match removes the NPCs themselves. */
  reset(): void {
    for (const [id, r] of this.list) this.list.set(id, this.fresh(r.e));
    this.byNpc.clear();
    this.started = false;
  }

  start(id: string): void {
    const r = this.list.get(id);
    if (!r || r.active) return;
    const extraPlayers = Math.max(0, this.host.players().length - 1);
    const roster = NPC_ROLES.flatMap((role) => Array<NpcRole>(rosterCount(r.e.roster, role)).fill(role));
    if (!roster.length) roster.push('trooper');
    r.queue = roster;
    r.budget = r.spawned + roster.length + r.e.reinforcements + r.e.perPlayer * extraPlayers;
    r.active = true;
    r.cleared = false;
    r.nextSpawn = this.host.tick;
  }

  /** Stop reinforcing; the squad is cleared once the living members die. */
  stop(id: string): void {
    const r = this.list.get(id);
    if (!r) return;
    r.budget = r.spawned;
    this.checkCleared(r, null);
  }

  setOrder(id: string, order: SquadOrder): void {
    const r = this.list.get(id);
    if (r) r.order = order;
  }

  alive(id: string): number {
    const r = this.list.get(id);
    return r ? r.members.filter((m) => this.host.npc(m)?.alive).length : 0;
  }

  totalAlive(): number {
    let n = 0;
    for (const id of this.list.keys()) n += this.alive(id);
    return n;
  }

  step(): void {
    const tick = this.host.tick;
    if (!this.started) {
      this.started = true;
      for (const r of this.list.values()) if (r.e.startActive) this.start(r.e.id);
    }
    for (const r of this.list.values()) {
      r.members = r.members.filter((m) => this.host.npc(m));
      const living = r.members.filter((m) => this.host.npc(m)!.alive);
      if (r.active && r.spawned < r.budget && living.length < r.e.activeCap && tick >= r.nextSpawn) {
        // The first wave arrives together; reinforcements trickle in.
        const role = r.queue[r.spawned % r.queue.length] ?? 'trooper';
        const id = this.spawnMember(r, role);
        if (id !== null) {
          r.spawned++;
          r.members.push(id);
          this.byNpc.set(id, r);
        }
        const firstWave = r.spawned < r.queue.length;
        r.nextSpawn = tick + (firstWave ? ((r.e.entrance ?? 'none') === 'none' ? 1 : ENTRANCE_GAP_TICKS) : Math.round(r.e.respawnSeconds * TICK_RATE));
      }
      if ((tick + r.e.id.length) % ALERT_INTERVAL_TICKS === 0) this.shareSightings(living);
    }
  }

  private spawnMember(r: EncounterRt, role: NpcRole): number | null {
    const origin = { x: r.e.position[0], y: r.e.position[1], z: r.e.position[2] };
    if (r.e.entrance && r.e.entrance !== 'none') return this.throughEntrance(r, role, origin);
    const hostiles = this.host.hostiles(r.e.faction);
    let best: { pos: Vec3; score: number } | null = null;
    for (let i = 0; i < 12; i++) {
      const a = this.host.random() * Math.PI * 2;
      const d = Math.sqrt(this.host.random()) * r.e.radius;
      const p = this.host.nav.closestPoint({ x: origin.x + Math.cos(a) * d, y: origin.y + 0.5, z: origin.z + Math.sin(a) * d }, { x: 1.5, y: 2, z: 1.5 });
      if (!p) continue;
      const nearestHostile = hostiles.reduce((m, h) => Math.min(m, horizontalDistance(h.pos, p)), Infinity);
      const crowd = r.members.some((m) => {
        const n = this.host.npc(m);
        return n?.alive && horizontalDistance(n.pos, p) < 1.2;
      });
      const score = Math.min(nearestHostile, SAFE_SPAWN_DISTANCE * 3) - (crowd ? 10 : 0) - (nearestHostile < SAFE_SPAWN_DISTANCE ? 20 : 0);
      if (!best || score > best.score) best = { pos: { x: p.x, y: p.y, z: p.z }, score };
    }
    const pos = best?.pos ?? origin;
    return this.host.spawnNpc(r.e, role, pos, r.e.yaw);
  }

  /**
   * One member out of the squad's entrance: at its mouth (a breach's is just
   * in front of the wall), or from a vent above, dropping to the floor. Waits
   * while the last one is still standing in the way.
   */
  private throughEntrance(r: EncounterRt, role: NpcRole, origin: Vec3): number | null {
    const e = r.e;
    const out = e.entrance === 'breach' ? 0.8 : 0;
    const jitter = () => (this.host.random() - 0.5) * 0.5;
    const mouth = { x: origin.x + Math.sin(e.yaw) * out + jitter(), y: origin.y, z: origin.z + Math.cos(e.yaw) * out + jitter() };
    const blocked = r.members.some((m) => {
      const n = this.host.npc(m);
      return n?.alive && horizontalDistance(n.pos, mouth) < 1.1 && Math.abs(n.pos.y - origin.y) < 2.5;
    });
    if (blocked) return null;
    const ground = this.host.nav.closestPoint({ x: mouth.x, y: mouth.y + 0.5, z: mouth.z }, { x: 1, y: 2, z: 1 });
    const pos = ground ? { x: ground.x, y: ground.y, z: ground.z } : mouth;
    // Out of the vent with the head just below it.
    if (e.entrance === 'vent') pos.y += clamp((e.ventHeight ?? 3.5) - PLAYER.height * (e.size ?? 1) - 0.1, 0, 10);
    return this.host.spawnNpc(e, role, pos, e.yaw);
  }

  /** Squadmates who can see an enemy tell the others where it is. */
  private shareSightings(living: number[]): void {
    let seen: { pos: Vec3; tick: number } | null = null;
    for (const m of living) {
      const brain = this.host.npc(m)!.brain;
      const s = brain.target !== null ? brain.lastSeen : null;
      if (s && (!seen || s.tick > seen.tick)) seen = s;
    }
    if (!seen) return;
    for (const m of living) this.host.npc(m)!.brain.alert(seen.pos, seen.tick);
  }

  /** Roamers and route patrols keep moving with nobody near (they don't doze off like guards). */
  roaming(npcId: number): boolean {
    const r = this.byNpc.get(npcId);
    return !!r && (r.order === 'roam' || (r.order === 'patrol' && !!this.route(r)));
  }

  /** The route a squad patrols (its encounter's `route`, when the map has that path), or null. */
  private route(r: EncounterRt): MapPath | null {
    return (r.e.route && this.routes.get(r.e.route)) || null;
  }

  /**
   * Walking a route: a point a few metres ahead along it, members a little
   * apart side by side. Off the route, the nearest point on it first. Round
   * and round a loop; on an open route there and back (turning at its ends),
   * or round (back to the start from the end) when the path says so. A
   * one-way route is only walked its own way.
   */
  private routeGoal(r: EncounterRt, path: MapPath, npcId: number, pos: Vec3, index: number): { pos: Vec3; radius: number } {
    const g = pathGeometry(path);
    const lane = ((index % 3) - 1) * 0.9;
    const at = (s: number): Vec3 => {
      const q = g.at(s);
      return { x: q.x + q.dz * lane, y: q.y, z: q.z - q.dx * lane };
    };
    if (r.homing.has(npcId)) {
      if (horizontalDistance(pos, g.samples[0]!) > 3) return { pos: at(0), radius: 1.5 };
      r.homing.delete(npcId);
    }
    const near = g.nearest(pos.x, pos.z, 1e5)!;
    if (near.dist > ROUTE_ON) return { pos: at(near.sample.s), radius: 1.5 };
    const style = path.patrol ?? (path.closed ? 'loop' : 'back_and_forth');
    let dir = path.oneWay ? 1 : (r.dirs.get(npcId) ?? 1);
    if (!g.loop) {
      const s = near.sample.s;
      if (style === 'back_and_forth' && !path.oneWay) {
        if (dir > 0 && s >= g.length - 2) dir = -1;
        else if (dir < 0 && s <= 2) dir = 1;
      } else if (s >= g.length - 2) {
        // Round an open route: back to its start, then along it again.
        r.homing.add(npcId);
        return { pos: at(0), radius: 1.5 };
      }
    }
    r.dirs.set(npcId, dir);
    return { pos: at(near.sample.s + dir * ROUTE_STEP), radius: 1.5 };
  }

  /** Where a member should be when not fighting. */
  goalFor(npcId: number): { pos: Vec3; radius: number } | null {
    const r = this.byNpc.get(npcId);
    const me = this.host.npc(npcId);
    if (!r || !me) return null;
    const index = Math.max(0, r.members.indexOf(npcId));
    const home = { x: r.e.position[0], y: r.e.position[1], z: r.e.position[2] };
    const target = (r.e.orderTarget && this.host.entityPos(r.e.orderTarget)) || home;
    const ring = (p: Vec3, base: number): Vec3 => {
      const a = index * 2.39996;
      const d = base + (index % 3) * 0.8;
      return { x: p.x + Math.cos(a) * d, y: p.y, z: p.z + Math.sin(a) * d };
    };
    switch (r.order) {
      case 'hold':
        return { pos: ring(home, 1.5), radius: 1.5 };
      case 'defend':
        return { pos: ring(target, 2), radius: 2 };
      case 'patrol': {
        const route = this.route(r);
        if (route) return this.routeGoal(r, route, npcId, me.pos, index);
        let leg = r.legs.get(npcId) ?? 1;
        const goal = leg ? target : home;
        if (horizontalDistance(me.pos, goal) < 2.5) {
          leg = 1 - leg;
          r.legs.set(npcId, leg);
        }
        return { pos: leg ? target : home, radius: 1.5 };
      }
      case 'attack': {
        let best: Vec3 | null = null;
        let bestD = Infinity;
        for (const h of this.host.hostiles(r.e.faction)) {
          const d = horizontalDistance(h.pos, me.pos) + Math.abs(h.pos.y - me.pos.y) * 2;
          if (d < bestD) {
            bestD = d;
            best = h.pos;
          }
        }
        return best ? { pos: best, radius: 2 } : { pos: ring(home, 1.5), radius: 1.5 };
      }
      case 'roam': {
        // Wander between places all over the map, a new one each time it gets there; fights whatever it meets.
        let goal = r.wander.get(npcId);
        if (!goal || horizontalDistance(me.pos, goal) < 3) {
          const places = this.host.nav.places();
          goal = places.length ? places[Math.floor(this.host.random() * places.length)]! : ring(home, 6);
          r.wander.set(npcId, goal);
        }
        return { pos: goal, radius: 2.5 };
      }
      case 'follow': {
        let best: Vec3 | null = null;
        let bestD = Infinity;
        for (const p of this.host.players()) {
          const d = horizontalDistance(p.pos, me.pos);
          if (d < bestD) {
            bestD = d;
            best = p.pos;
          }
        }
        return best ? { pos: ring(best, 2.5), radius: 3 } : { pos: ring(home, 1.5), radius: 1.5 };
      }
    }
  }

  /**
   * Bounding overwatch for attacking squads: grunts pair up and take turns,
   * one moving up to the next cover while its partner holds and covers.
   * Null when the member isn't part of that (other orders, heavies, snipers).
   */
  squadFor(npcId: number, role: NpcRole): { advance: boolean } | null {
    const r = this.byNpc.get(npcId);
    if (!r || r.order !== 'attack' || (role !== 'trooper' && role !== 'gunner')) return null;
    const grunts = r.members.filter((m) => this.host.npc(m)?.alive);
    if (grunts.length < 2) return { advance: true };
    const index = grunts.indexOf(npcId);
    const phase = Math.floor(this.host.tick / (TICK_RATE * 3)) % 2;
    return { advance: index % 2 === phase };
  }

  /** Bookkeeping when a member dies: logic events and the cleared check. */
  onNpcKilled(npcId: number, killer: number | null): void {
    const r = this.byNpc.get(npcId);
    if (!r) return;
    this.host.fire('npc_killed', r.e.id, killer);
    this.checkCleared(r, killer, npcId);
  }

  private checkCleared(r: EncounterRt, killer: number | null, justDied?: number): void {
    if (r.cleared || r.spawned === 0 || r.spawned < r.budget) return;
    const anyAlive = r.members.some((m) => m !== justDied && this.host.npc(m)?.alive);
    if (anyAlive) return;
    r.cleared = true;
    r.active = false;
    this.host.fire('encounter_cleared', r.e.id, killer);
  }

  encounterOf(npcId: number): string | undefined {
    return this.byNpc.get(npcId)?.e.id;
  }
}
