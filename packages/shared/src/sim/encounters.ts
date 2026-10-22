import type { BotBrain } from '../bots/brain.ts';
import type { EventType } from '../map/logic.ts';
import { NPC_ROLES, type EncounterEntity, type MapDocument, type NpcRole, type SquadOrder } from '../map/schema.ts';
import { horizontalDistance, type Vec3 } from '../math.ts';
import type { NavWorld } from '../nav/index.ts';
import { TICK_RATE } from './constants.ts';

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
}

/** Members re-share sightings this often. */
const ALERT_INTERVAL_TICKS = 15;
/** NPCs don't spawn closer than this to a hostile if there's any other choice. */
const SAFE_SPAWN_DISTANCE = 6;

/**
 * Encounter spawners and their squads. Each encounter is one squad: the squad
 * picks the high-level goal from its order (hold, attack, defend, patrol,
 * follow) and shares sightings; members fight individually with the bot brain.
 */
export class Encounters {
  private readonly list = new Map<string, EncounterRt>();
  private readonly byNpc = new Map<number, EncounterRt>();
  private started = false;

  constructor(
    map: MapDocument,
    private readonly host: EncounterHost,
  ) {
    for (const e of map.entities) if (e.kind === 'encounter') this.list.set(e.id, this.fresh(e));
  }

  private fresh(e: EncounterEntity): EncounterRt {
    return { e, active: false, budget: 0, spawned: 0, members: [], nextSpawn: 0, order: e.order, cleared: false, queue: [], legs: new Map() };
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
    const roster = NPC_ROLES.flatMap((role) => Array<NpcRole>(r.e.roster[role]).fill(role));
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
        r.nextSpawn = tick + (firstWave ? 1 : Math.round(r.e.respawnSeconds * TICK_RATE));
      }
      if ((tick + r.e.id.length) % ALERT_INTERVAL_TICKS === 0) this.shareSightings(living);
    }
  }

  private spawnMember(r: EncounterRt, role: NpcRole): number | null {
    const origin = { x: r.e.position[0], y: r.e.position[1], z: r.e.position[2] };
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
