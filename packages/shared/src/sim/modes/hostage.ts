import type { RescueEntity } from '../../map/schema.ts';
import { horizontalDistance, type Vec3, hypot } from '../../math.ts';
import { HOSTAGE_FOLLOWING, HOSTAGE_RESCUED, HOSTAGE_WAITING, type ModeSnapshot } from '../../protocol.ts';
import { TICK_DT, TICK_RATE } from '../constants.ts';
import type { Combatant } from '../match.ts';
import type { BotGoal, ModeHost, ModeLogic } from './types.ts';

export const HOSTAGE_ROUND_SECONDS = 150;
export const HOSTAGE_BREAK_SECONDS = 4;
/** Reach for taking a hostage along (Use). */
const TAKE_RADIUS = 2;
/** A hostage keeps this far behind whoever leads it, walking at this speed. */
const FOLLOW_GAP = 1.8;
/** Walking pace close behind; it runs (as fast as a sprint) when it falls back. */
const WALK_SPEED = 5;
const RUN_SPEED = 8;
/** Further than this from its leader, a hostage stops and waits. */
const LOSE_RADIUS = 25;

interface Hostage {
  home: Vec3;
  homeYaw: number;
  pos: Vec3;
  yaw: number;
  state: number;
  leader: number | null;
  /** Route to the leader, refreshed now and then. */
  route: Vec3[];
  routeAt: number;
}

/**
 * Hostage Rescue (Counter-Strike's hostage maps, in rounds like Elimination).
 * The first team rescues: press Use (E) beside a hostage and it follows you
 * (along the navmesh, round corners) until you bring it into a rescue zone,
 * or until you die or get too far ahead, when it stops where it is. Rescuing
 * half the hostages (at least one) or eliminating the guards wins the round;
 * the guards win by eliminating the rescuers or running the clock out.
 * Hostages can't be hurt. Bots take hostages along by walking up to them.
 */
export class HostageMode implements ModeLogic {
  round = 1;
  private readonly wins = new Map<string, number>();
  private restartAt: number | null = null;
  private roundStart = 0;
  hostages: Hostage[] = [];

  constructor(private readonly host: ModeHost) {
    this.reset();
  }

  private get rescuers(): string {
    return this.host.teams[0]!.id;
  }

  private get guards(): string {
    return this.host.teams[1]!.id;
  }

  private zones(): RescueEntity[] {
    return this.host.map.entities.filter((e): e is RescueEntity => e.kind === 'rescue');
  }

  reset(): void {
    this.round = 1;
    this.wins.clear();
    this.startRound();
  }

  private startRound(): void {
    this.restartAt = null;
    this.roundStart = this.host.tick;
    this.hostages = this.host.map.entities.flatMap((e) => {
      if (e.kind !== 'hostage') return [];
      const home = { x: e.position[0], y: e.position[1], z: e.position[2] };
      return [{ home, homeYaw: e.yaw, pos: { ...home }, yaw: e.yaw, state: HOSTAGE_WAITING, leader: null, route: [], routeAt: 0 }];
    });
  }

  alive(): number[] {
    const all = this.host.combatants();
    return this.host.teams.map((t) => all.filter((c) => c.faction === t.id && c.alive).length);
  }

  /** Rescues needed to win: half of them, at least one. */
  private get needed(): number {
    return Math.max(1, Math.ceil(this.hostages.length / 2));
  }

  step(): void {
    const host = this.host;
    if (this.restartAt !== null) {
      if (host.tick >= this.restartAt) this.nextRound();
      return;
    }
    const all = host.combatants();
    if (host.teams.slice(0, 2).some((t) => !all.some((c) => c.faction === t.id))) {
      for (const c of all) if (!c.alive && c.respawnTick === Infinity) c.respawnTick = host.tick + host.rules.respawnDelayTicks;
      this.roundStart = host.tick;
      return;
    }
    this.takeAlong(all);
    for (const [i, h] of this.hostages.entries()) if (h.state === HOSTAGE_FOLLOWING) this.follow(h, i);
    const rescued = this.hostages.filter((h) => h.state === HOSTAGE_RESCUED).length;
    if (rescued >= this.needed) return this.winRound(this.rescuers);
    const [res, grd] = this.alive();
    if (grd === 0) return this.winRound(this.rescuers);
    if (res === 0) return this.winRound(this.guards);
    if (host.tick - this.roundStart >= HOSTAGE_ROUND_SECONDS * TICK_RATE) this.winRound(this.guards);
  }

  /** Rescuers start a waiting hostage following them: Use beside it (bots: just walking up). */
  private takeAlong(all: Combatant[]): void {
    for (const c of all) {
      if (!c.alive || c.faction !== this.rescuers) continue;
      const pressed = c.useTick === this.host.tick || c.kind !== 'human';
      if (!pressed) continue;
      for (const [i, h] of this.hostages.entries()) {
        if (h.state !== HOSTAGE_WAITING || horizontalDistance(c.move.pos, h.pos) > TAKE_RADIUS || Math.abs(c.move.pos.y - h.pos.y) > 1.5) continue;
        h.state = HOSTAGE_FOLLOWING;
        h.leader = c.slot;
        h.routeAt = 0;
        this.host.emit({ e: 'hostage', a: 'follow', i, s: c.slot });
        // A human takes one per press; a bot can gather everyone standing round it.
        if (c.kind === 'human') break;
      }
    }
  }

  private follow(h: Hostage, i: number): void {
    const host = this.host;
    const leader = h.leader === null ? undefined : host.combatants().find((c) => c.slot === h.leader);
    if (!leader?.alive || horizontalDistance(leader.move.pos, h.pos) > LOSE_RADIUS) {
      h.state = HOSTAGE_WAITING;
      h.leader = null;
      host.emit({ e: 'hostage', a: 'stop', i, s: null });
      return;
    }
    // Rescued once inside a zone (the leader brought it there).
    for (const z of this.zones()) {
      if (hypot(h.pos.x - z.position[0], h.pos.z - z.position[2]) <= z.radius && Math.abs(h.pos.y - z.position[1]) < 3) {
        h.state = HOSTAGE_RESCUED;
        h.leader = null;
        host.emit({ e: 'hostage', a: 'rescue', i, s: leader.slot });
        return;
      }
    }
    if (horizontalDistance(leader.move.pos, h.pos) <= FOLLOW_GAP) return;
    if (host.tick >= h.routeAt) {
      h.route = host.path(h.pos, leader.move.pos)?.slice(1) ?? [{ ...leader.move.pos }];
      h.routeAt = host.tick + Math.round(TICK_RATE * 0.5);
    }
    let step = (horizontalDistance(leader.move.pos, h.pos) > 5 ? RUN_SPEED : WALK_SPEED) * TICK_DT;
    while (step > 0 && h.route.length) {
      const next = h.route[0]!;
      const d = horizontalDistance(h.pos, next);
      if (d <= step) {
        h.pos = { ...next };
        h.route.shift();
        step -= d;
        continue;
      }
      const k = step / d;
      h.yaw = Math.atan2(next.x - h.pos.x, next.z - h.pos.z);
      h.pos = { x: h.pos.x + (next.x - h.pos.x) * k, y: h.pos.y + (next.y - h.pos.y) * k, z: h.pos.z + (next.z - h.pos.z) * k };
      step = 0;
    }
    const ground = host.groundBelow({ x: h.pos.x, y: h.pos.y + 1, z: h.pos.z });
    if (ground !== null) h.pos = { ...h.pos, y: ground };
  }

  private winRound(team: string): void {
    const host = this.host;
    this.wins.set(team, (this.wins.get(team) ?? 0) + 1);
    host.emit({ e: 'elim', a: 'win', round: this.round, team });
    if (host.rules.scoreLimit > 0 && this.wins.get(team)! >= host.rules.scoreLimit) return host.endRound();
    this.restartAt = host.tick + HOSTAGE_BREAK_SECONDS * TICK_RATE;
  }

  private nextRound(): void {
    this.round++;
    for (const c of this.host.combatants()) this.host.respawn(c);
    this.startRound();
    this.host.emit({ e: 'elim', a: 'start', round: this.round, team: null });
  }

  onKill(victim: Combatant): void {
    victim.respawnTick = Infinity;
  }

  onLeave(): void {}

  /** Host handoff: the team scores a checkpoint carried (as teamScores gives them). */
  restoreScores(scores: ReadonlyMap<string, number>): void {
    for (const t of this.host.teams) this.wins.set(t.id, scores.get(t.id) ?? 0);
  }

  teamScores(): Map<string, number> {
    return new Map(this.host.teams.map((t) => [t.id, this.wins.get(t.id) ?? 0]));
  }

  snapshot(): ModeSnapshot {
    const host = this.host;
    const r2 = (v: number) => Math.round(v * 100) / 100;
    return {
      ts: host.teams.map((t) => this.wins.get(t.id) ?? 0),
      el: [this.round, this.restartAt === null ? 0 : Math.max(0, Math.ceil((this.restartAt - host.tick) / TICK_RATE)), ...this.alive()],
      hg: this.hostages.map((h) => [r2(h.pos.x), r2(h.pos.y), r2(h.pos.z), r2(h.yaw), h.state, h.leader ?? -1]),
    };
  }

  botAwareness(): number {
    return Infinity;
  }

  blocksVehicle(c: Combatant): boolean {
    return this.hostages.some((h) => h.leader === c.slot);
  }

  /**
   * Rescuers: lead your hostages to the nearest rescue zone; otherwise go and
   * fetch the nearest waiting one. Guards hold near the hostages, and chase
   * whoever is leading one away.
   */
  botGoal(c: Combatant): BotGoal | null {
    const zones = this.zones();
    const waiting = this.hostages.filter((h) => h.state === HOSTAGE_WAITING);
    const nearest = <T extends { pos: Vec3 }>(list: T[]) => list.reduce<T | null>((b, h) => (!b || horizontalDistance(h.pos, c.move.pos) < horizontalDistance(b.pos, c.move.pos) ? h : b), null);
    if (c.faction === this.rescuers) {
      if (this.hostages.some((h) => h.leader === c.slot) && zones.length) {
        const z = nearest(zones.map((e) => ({ pos: { x: e.position[0], y: e.position[1], z: e.position[2] }, r: e.radius })))!;
        return { pos: z.pos, radius: Math.max(1, z.r * 0.5) };
      }
      const h = nearest(waiting);
      return h ? { pos: h.pos, radius: 1.2 } : null;
    }
    const led = nearest(this.hostages.filter((h) => h.state === HOSTAGE_FOLLOWING));
    if (led) return { pos: led.pos, radius: 3 };
    const h = waiting[c.slot % Math.max(1, waiting.length)];
    return h ? { pos: h.pos, radius: 6 } : null;
  }
}
