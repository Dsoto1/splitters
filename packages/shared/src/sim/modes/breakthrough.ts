import type { BreakthroughObjective } from '../../map/schema.ts';
import { behindLine, breakthroughSectors } from '../../map/sectors.ts';
import { horizontalDistance, type Vec3 } from '../../math.ts';
import {
  BT_IN_ATTACKERS,
  BT_IN_BOTH,
  BT_IN_DEFENDERS,
  BT_IN_NOBODY,
  BT_OBJ_ACTIVE,
  BT_OBJ_DONE,
  BT_OBJ_PLANTED,
  BT_OBJ_SKIPPED,
  BT_OBJ_WAITING,
  BT_ROUND_ATTACKERS,
  BT_ROUND_DEFENDERS,
  BT_ROUND_PLAYING,
  type ModeSnapshot,
} from '../../protocol.ts';
import { TICK_RATE } from '../constants.ts';
import type { Combatant } from '../match.ts';
import { BREAKTHROUGH_POOL, BREAKTHROUGH_SECTOR_SECONDS } from '../rules.ts';
import type { SpawnSpot } from '../spawns.ts';
import type { BotGoal, ModeHost, ModeLogic } from './types.ts';

/** Seconds to plant a charge at a target (attackers) and to defuse one (defenders), holding still within its reach. */
export const BT_PLANT_SECONDS = 3;
export const BT_DEFUSE_SECONDS = 5;
/** A planted charge goes off after this long unless defused. */
export const BT_FUSE_SECONDS = 20;
/** Defenders left behind the line once a sector falls: seconds of warning, then the damage a second it does. */
export const BT_FALLBACK_SECONDS = 10;
export const BT_FALLBACK_DPS = 20;
/** Seconds one attacker alone takes to capture a zone, and a final hold (each zone can say its own). */
export const BT_ZONE_SECONDS = 20;
export const BT_FINAL_SECONDS = 40;
/** Seconds between the two rounds (sides swapped). */
export const BT_BREAK_SECONDS = 8;
/** Defenders respawn this many times slower than the match's respawn delay (attackers take it as it is). */
export const BT_DEFENDER_RESPAWN = 1.5;
/** Most attackers counted for capture speed: one alone at 1×, two at 1.5×, three or more at 2×. */
const ZONE_CROWD = 3;
/** Standing in a zone: within its radius, from a little below its floor to a storey above (as King of the Hill). */
const ZONE_BELOW = 1;
const ZONE_ABOVE = 3.5;
/** A charge's reach in height, and how far a planter or defuser may drift before the action is cancelled. */
const TARGET_HEIGHT = 2;
const STEADY = 0.6;
/** A target's blast as it goes. */
const BLAST = { radius: 9, damage: 260 };
/** Players a spawn point serves before its group gets spots of its own round it (sim/spawns.ts SPAWN_SHARE). */
const GROUP_SHARE = 3;

export type BreakthroughSide = 'attack' | 'defend';

/** One of the map's objectives as it plays. */
export interface BtObjectiveRt {
  /** Its map entity's index. */
  index: number;
  kind: BreakthroughObjective;
  /** Its sector (0-based, in the order they are taken). */
  sector: number;
  label: string;
  pos: Vec3;
  radius: number;
  /** Zones: seconds one attacker alone takes to capture it. */
  seconds: number;
  state: number;
  /** Zones: capture, 0-1. */
  progress: number;
  /** Zones: who stands in it (BT_IN_*). */
  presence: number;
  /** Targets: the tick a planted charge goes off, and who planted it. */
  blowAt: number;
  planter: number | null;
  /** Targets: a plant or defuse under way. */
  action: { slot: number; start: number; from: Vec3 } | null;
}

/** One sector as it plays: its line (where its ground starts, `dir` the way the attackers push), its objectives and its spawn groups. */
export interface BtSectorRt {
  index: number;
  order: number;
  name: string;
  pos: Vec3;
  dir: { x: number; z: number };
  /** Targets to destroy for it to fall (its zones must all be captured too). */
  need: number;
  /** Seconds it puts on the clock. */
  seconds: number;
  objectives: BtObjectiveRt[];
  /** Its spawn groups: the map's spawn points marked for it (as the match's spawn spots, so recent use counts). */
  spawns: Record<BreakthroughSide, SpawnSpot[]>;
}

/** Standing in a zone (or close enough to a target to plant or defuse at it). */
export function inObjective(o: Pick<BtObjectiveRt, 'kind' | 'pos' | 'radius'>, p: Vec3): boolean {
  if (horizontalDistance(o.pos, p) > o.radius) return false;
  return o.kind === 'target' ? Math.abs(p.y - o.pos.y) < TARGET_HEIGHT : p.y > o.pos.y - ZONE_BELOW && p.y < o.pos.y + ZONE_ABOVE;
}

/**
 * Breakthrough (core.breakthrough, docs/GAME_MODES.md): asymmetric. The attackers take the map's sectors in order;
 * the defenders hold each line in turn.
 * - **Sectors.** A sector falls when every capture zone in it is captured and enough of its targets are destroyed
 *   (all, or its "N of M"). A zone captures while attackers alone stand in it (faster with more, up to two times),
 *   holds while a defender stands in it (contested) and slips back while only defenders do; once captured it stays
 *   so. A target takes a charge: an attacker within reach presses Use and holds still (bots: stand still), the fuse
 *   burns, a defender within reach defuses it the same way. A final hold is a zone whose capture ends the round.
 * - **When a sector falls** the attackers' spawns move up to the next sector's group and the defenders' fall back to
 *   theirs; defenders left on the attackers' side of the next sector's line have BT_FALLBACK_SECONDS to get over it,
 *   then it hurts (BT_FALLBACK_DPS); the next sector's objectives switch on and its time goes on the clock.
 * - **Reinforcements:** the attackers' pool is `breakthroughPool` (BREAKTHROUGH_POOL) per attacker, topped up by half
 *   as much per attacker for each sector taken; each attacker death costs one, and once it is spent the fallen stay
 *   down. The defenders respawn without limit, BT_DEFENDER_RESPAWN times slower.
 * - **Time:** each sector puts its seconds on the clock (its own, else `breakthroughSectorSeconds`). A charge still
 *   burning when the clock runs out plays on (overtime).
 * - **Winning:** the attackers win the round when the last sector falls; the defenders when the clock runs out, or
 *   the pool is spent and the last attacker is down. With `breakthroughSwap` a second round follows with the sides
 *   swapped; a team's score is the sectors it took, and of two teams that took as many, the one that took its last
 *   with more time left wins.
 */
export class BreakthroughMode implements ModeLogic {
  readonly sectors: BtSectorRt[];
  readonly objectives: BtObjectiveRt[];
  round = 1;
  /** The sector in play (0-based); the sector count once the last has fallen. */
  active = 0;
  /** Reinforcements left. */
  pool = 0;
  /** The tick the clock runs out. */
  clockEnd = 0;
  /** How the round stands (BT_ROUND_*), and when the next one starts (between rounds). */
  outcome = BT_ROUND_PLAYING;
  restartAt: number | null = null;
  /** Each team's attack: sectors taken, and the seconds left on the clock when it took its last. */
  private readonly results = new Map<string, { sectors: number; timeLeft: number }>();
  /** Defenders behind the line: since when (tick). */
  readonly behind = new Map<number, number>();
  /** Spots added round a spawn group too small for its team (per sector and side). */
  private readonly extraSpots = new Map<string, SpawnSpot[]>();
  private warnedQuarter = false;

  constructor(private readonly host: ModeHost) {
    const map = host.map;
    const spawnEntities = map.entities.filter((e) => e.kind === 'spawn');
    this.sectors = breakthroughSectors(map).map((s) => ({
      index: s.index,
      order: s.order,
      name: s.name,
      pos: s.pos,
      dir: s.dir,
      need: 0,
      seconds: s.seconds ?? host.rules.breakthroughSectorSeconds ?? BREAKTHROUGH_SECTOR_SECONDS,
      objectives: [],
      spawns: { attack: [], defend: [] },
    }));
    const byOrder = new Map<number, BtSectorRt>();
    for (const s of this.sectors) if (!byOrder.has(s.order)) byOrder.set(s.order, s);
    this.objectives = [];
    map.entities.forEach((e, index) => {
      if (e.kind !== 'objective') return;
      const sector = byOrder.get(e.sector);
      if (!sector) return;
      const o: BtObjectiveRt = {
        index,
        kind: e.objective,
        sector: this.sectors.indexOf(sector),
        label: e.label,
        pos: { x: e.position[0], y: e.position[1], z: e.position[2] },
        radius: e.radius,
        seconds: e.seconds ?? (e.objective === 'final' ? BT_FINAL_SECONDS : BT_ZONE_SECONDS),
        state: BT_OBJ_WAITING,
        progress: 0,
        presence: BT_IN_NOBODY,
        blowAt: 0,
        planter: null,
        action: null,
      };
      this.objectives.push(o);
      sector.objectives.push(o);
    });
    const needs = new Map(breakthroughSectors(map).map((s) => [s.index, s.need]));
    for (const s of this.sectors) {
      const targets = s.objectives.filter((o) => o.kind === 'target').length;
      s.need = Math.min(targets, needs.get(s.index) ?? targets);
    }
    spawnEntities.forEach((e, i) => {
      if (e.kind !== 'spawn' || e.sector === undefined || !e.side) return;
      const sector = byOrder.get(e.sector);
      const spot = host.spawnPoints[i];
      if (sector && spot) sector.spawns[e.side].push(spot);
    });
    this.reset();
  }

  private get attackIndex(): number {
    return (this.round - 1) % 2;
  }

  /** The attacking team's ID this round. */
  get attackers(): string {
    return this.host.teams[this.attackIndex]!.id;
  }

  get defenders(): string {
    return this.host.teams[1 - this.attackIndex]!.id;
  }

  /** Rounds in the match: two with the sides swapped, else one. */
  get rounds(): number {
    return this.host.rules.breakthroughSwap ? 2 : 1;
  }

  /** The side a player plays this round (null: not on either team). */
  sideOf(c: Combatant): BreakthroughSide | null {
    return c.faction === this.attackers ? 'attack' : c.faction === this.defenders ? 'defend' : null;
  }

  /** The sector in play (null once the last has fallen). */
  get sector(): BtSectorRt | null {
    return this.sectors[this.active] ?? null;
  }

  private get perAttacker(): number {
    return Math.max(1, Math.round(this.host.rules.breakthroughPool ?? BREAKTHROUGH_POOL));
  }

  /** The attacking team's size: as the rules set it, or as many as are on it. */
  private attackerCount(): number {
    const sized = this.host.rules.teamSizes?.[this.attackIndex] ?? 0;
    return Math.max(1, sized, this.host.combatants().filter((c) => c.faction === this.attackers).length);
  }

  /** Seconds left on the clock. */
  get timeLeft(): number {
    return Math.max(0, Math.ceil((this.clockEnd - this.host.tick) / TICK_RATE));
  }

  reset(): void {
    this.round = 1;
    this.results.clear();
    this.startRound();
  }

  private startRound(): void {
    this.restartAt = null;
    this.outcome = BT_ROUND_PLAYING;
    this.active = 0;
    this.behind.clear();
    this.warnedQuarter = false;
    for (const o of this.objectives) {
      o.state = o.sector === 0 ? BT_OBJ_ACTIVE : BT_OBJ_WAITING;
      o.progress = 0;
      o.presence = BT_IN_NOBODY;
      o.blowAt = 0;
      o.planter = null;
      o.action = null;
    }
    this.pool = this.perAttacker * this.attackerCount();
    this.clockEnd = this.host.tick + (this.sectors[0]?.seconds ?? BREAKTHROUGH_SECTOR_SECONDS) * TICK_RATE;
    if (!this.results.has(this.attackers)) this.results.set(this.attackers, { sectors: 0, timeLeft: 0 });
  }

  private player(slot: number | null): Combatant | undefined {
    return slot === null ? undefined : this.host.combatants().find((c) => c.slot === slot);
  }

  step(): void {
    const host = this.host;
    if (this.restartAt !== null) {
      if (host.tick >= this.restartAt) this.nextRound();
      return;
    }
    if (this.outcome !== BT_ROUND_PLAYING) return;
    const all = host.combatants();
    if (!all.some((c) => c.faction === this.attackers) || !all.some((c) => c.faction === this.defenders)) {
      // Warm-up until both sides have someone: the clock waits, the pool fills to the team, the fallen come back.
      this.clockEnd++;
      this.pool = Math.max(this.pool, this.perAttacker * this.attackerCount());
      for (const c of all) if (!c.alive && c.respawnTick === Infinity) c.respawnTick = host.tick + host.rules.respawnDelayTicks;
      return;
    }
    const sector = this.sector;
    if (!sector) return;
    for (const o of sector.objectives) {
      if (o.state === BT_OBJ_DONE || o.state === BT_OBJ_SKIPPED) continue;
      if (o.kind === 'target') this.runTarget(o, all);
      else this.runZone(o, all);
      if (this.outcome !== BT_ROUND_PLAYING || this.sector !== sector) return;
    }
    if (this.sectorTaken(sector)) return this.sectorFalls();
    this.fallBack(all);
    // Out of time (a charge still burning plays on), or out of reinforcements with the last attacker down.
    const burning = sector.objectives.some((o) => o.state === BT_OBJ_PLANTED);
    if (host.tick >= this.clockEnd && !burning) return this.endAttack(false);
    if (this.pool <= 0 && !all.some((c) => c.faction === this.attackers && (c.alive || c.respawnTick < Infinity))) this.endAttack(false);
  }

  /** A zone: attackers alone capture it, a defender in it holds it, defenders alone push it back. */
  private runZone(o: BtObjectiveRt, all: Combatant[]): void {
    let att = 0;
    let def = 0;
    const inside: Combatant[] = [];
    for (const c of all) {
      if (!c.alive || !inObjective(o, c.move.pos)) continue;
      if (c.faction === this.attackers) {
        att++;
        inside.push(c);
      } else if (c.faction === this.defenders) def++;
    }
    o.presence = att && def ? BT_IN_BOTH : att ? BT_IN_ATTACKERS : def ? BT_IN_DEFENDERS : BT_IN_NOBODY;
    const step = 1 / (o.seconds * TICK_RATE);
    if (att && !def) o.progress = Math.min(1, o.progress + step * (1 + 0.5 * (Math.min(att, ZONE_CROWD) - 1)));
    else if (def && !att) o.progress = Math.max(0, o.progress - step);
    if (o.progress < 1) return;
    o.state = BT_OBJ_DONE;
    o.presence = BT_IN_NOBODY;
    for (const c of inside) c.objective++;
    this.host.emit({ e: 'bt', a: 'capture', i: o.index, team: this.attackers });
  }

  /** A target: plant (attackers), defuse (defenders), and the charge going off. */
  private runTarget(o: BtObjectiveRt, all: Combatant[]): void {
    const host = this.host;
    const tick = host.tick;
    const planted = o.state === BT_OBJ_PLANTED;
    if (planted && tick >= o.blowAt) {
      o.state = BT_OBJ_DONE;
      o.action = null;
      host.explode({ x: o.pos.x, y: o.pos.y + 0.6, z: o.pos.z }, BLAST.radius, BLAST.damage, this.player(o.planter) ?? null);
      host.emit({ e: 'bt', a: 'destroy', i: o.index, s: o.planter, p: [o.pos.x, o.pos.y, o.pos.z] });
      return;
    }
    const side = planted ? this.defenders : this.attackers;
    const a = o.action;
    if (a) {
      const c = this.player(a.slot);
      if (!c?.alive || c.faction !== side || horizontalDistance(c.move.pos, a.from) > STEADY || !inObjective(o, c.move.pos)) {
        o.action = null;
        return;
      }
      if (tick - a.start < (planted ? BT_DEFUSE_SECONDS : BT_PLANT_SECONDS) * TICK_RATE) return;
      o.action = null;
      if (planted) {
        o.state = BT_OBJ_ACTIVE;
        o.planter = null;
        host.emit({ e: 'bt', a: 'defuse', i: o.index, s: c.slot });
      } else {
        o.state = BT_OBJ_PLANTED;
        o.planter = c.slot;
        o.blowAt = tick + BT_FUSE_SECONDS * TICK_RATE;
        host.emit({ e: 'bt', a: 'plant', i: o.index, s: c.slot });
      }
      return;
    }
    // Use (E) starts it; bots start it just by standing still within reach (they never press keys).
    for (const c of all) {
      if (!c.alive || c.faction !== side || !inObjective(o, c.move.pos)) continue;
      if (c.useTick === tick || (c.kind !== 'human' && (c.move.vx ?? 0) === 0 && (c.move.vz ?? 0) === 0)) {
        o.action = { slot: c.slot, start: tick, from: { ...c.move.pos } };
        return;
      }
    }
  }

  private sectorTaken(s: BtSectorRt): boolean {
    let destroyed = 0;
    for (const o of s.objectives) {
      if (o.kind === 'target') {
        if (o.state === BT_OBJ_DONE) destroyed++;
      } else if (o.state !== BT_OBJ_DONE) return false;
    }
    return destroyed >= s.need && s.objectives.length > 0;
  }

  /** The sector in play has fallen: spawns move up, the next one's objectives and time come into play (or the attackers have won). */
  private sectorFalls(): void {
    const host = this.host;
    const fallen = this.sector!;
    for (const o of fallen.objectives) {
      if (o.state === BT_OBJ_DONE) continue;
      o.state = BT_OBJ_SKIPPED;
      o.action = null;
      o.planter = null;
    }
    const res = this.results.get(this.attackers)!;
    res.sectors = this.active + 1;
    res.timeLeft = this.timeLeft;
    host.emit({ e: 'bt', a: 'sector', n: this.active, team: this.attackers });
    this.active++;
    this.behind.clear();
    const next = this.sector;
    if (!next) return this.endAttack(true);
    this.pool += Math.ceil(this.perAttacker / 2) * this.attackerCount();
    this.warnedQuarter = false;
    this.clockEnd = Math.max(this.clockEnd, host.tick) + next.seconds * TICK_RATE;
    for (const o of next.objectives) o.state = BT_OBJ_ACTIVE;
  }

  /** Defenders on the attackers' side of the line once a sector has fallen: a warning, then it hurts. */
  private fallBack(all: Combatant[]): void {
    const line = this.active > 0 ? this.sector : null;
    for (const c of all) {
      if (c.faction !== this.defenders || !c.alive || !line || !behindLine(line, c.move.pos)) {
        this.behind.delete(c.slot);
        continue;
      }
      const since = this.behind.get(c.slot);
      if (since === undefined) this.behind.set(c.slot, this.host.tick);
      else if (this.host.tick - since >= BT_FALLBACK_SECONDS * TICK_RATE) this.host.hurt?.(c, BT_FALLBACK_DPS / TICK_RATE, 'core.fallback');
    }
  }

  /** The round is over: the attackers took the last sector (`won`) or the defenders held. */
  private endAttack(won: boolean): void {
    const host = this.host;
    this.outcome = won ? BT_ROUND_ATTACKERS : BT_ROUND_DEFENDERS;
    this.behind.clear();
    for (const o of this.objectives) o.action = null;
    host.emit({ e: 'bt', a: 'round', n: this.round, team: won ? this.attackers : this.defenders });
    if (this.round < this.rounds) {
      this.restartAt = host.tick + BT_BREAK_SECONDS * TICK_RATE;
      return;
    }
    host.endRound(this.winner(won));
  }

  /** Who won the match: one round, its winner; two, more sectors taken, then more time left when the last was taken. */
  private winner(lastWon: boolean): string | null {
    if (this.rounds === 1) return lastWon ? this.attackers : this.defenders;
    const [a, b] = this.host.teams.slice(0, 2).map((t) => this.results.get(t.id) ?? { sectors: 0, timeLeft: 0 });
    if (a!.sectors !== b!.sectors) return a!.sectors > b!.sectors ? this.host.teams[0]!.id : this.host.teams[1]!.id;
    if (a!.sectors > 0 && a!.timeLeft !== b!.timeLeft) return a!.timeLeft > b!.timeLeft ? this.host.teams[0]!.id : this.host.teams[1]!.id;
    return null;
  }

  private nextRound(): void {
    this.round++;
    this.startRound();
    for (const c of this.host.combatants()) this.host.respawn(c);
    this.host.emit({ e: 'bt', a: 'start', n: this.round, team: this.attackers });
  }

  onKill(victim: Combatant): void {
    this.behind.delete(victim.slot);
    const host = this.host;
    if (victim.faction === this.defenders) {
      victim.respawnTick = host.tick + Math.round(host.rules.respawnDelayTicks * BT_DEFENDER_RESPAWN);
      return;
    }
    if (victim.faction !== this.attackers || this.outcome !== BT_ROUND_PLAYING || this.restartAt !== null) return;
    if (this.pool <= 0) {
      victim.respawnTick = Infinity;
      return;
    }
    this.pool--;
    const start = this.perAttacker * this.attackerCount();
    if (this.pool === 0) host.emit({ e: 'bt', a: 'pool', n: 0, team: this.attackers });
    else if (!this.warnedQuarter && this.pool <= Math.floor(start / 4)) {
      this.warnedQuarter = true;
      host.emit({ e: 'bt', a: 'pool', n: this.pool, team: this.attackers });
    }
  }

  onLeave(c: Combatant): void {
    this.behind.delete(c.slot);
    for (const o of this.objectives) if (o.action?.slot === c.slot) o.action = null;
  }

  onSpawn(c: Combatant): void {
    this.behind.delete(c.slot);
  }

  /** Host handoff: the team scores a checkpoint carried (sectors taken). */
  restoreScores(scores: ReadonlyMap<string, number>): void {
    for (const t of this.host.teams) {
      const n = scores.get(t.id);
      if (n !== undefined) this.results.set(t.id, { sectors: n, timeLeft: this.results.get(t.id)?.timeLeft ?? 0 });
    }
  }

  /** Each team's score: the sectors it took attacking. */
  teamScores(): Map<string, number> {
    return new Map(this.host.teams.map((t) => [t.id, this.results.get(t.id)?.sectors ?? 0]));
  }

  /** The time the HUD shows: the sector clock (the break's while sides swap). */
  clock(): number | null {
    if (this.restartAt !== null) return Math.max(0, Math.ceil((this.restartAt - this.host.tick) / TICK_RATE));
    return this.outcome === BT_ROUND_PLAYING ? this.timeLeft : 0;
  }

  snapshot(): ModeSnapshot {
    const host = this.host;
    const tick = host.tick;
    return {
      ts: host.teams.map((t) => this.results.get(t.id)?.sectors ?? 0),
      bt: [
        this.round,
        this.rounds,
        this.attackIndex,
        this.active,
        Math.max(0, this.pool),
        this.outcome === BT_ROUND_PLAYING ? this.timeLeft : 0,
        this.restartAt === null ? 0 : Math.max(0, Math.ceil((this.restartAt - tick) / TICK_RATE)),
        this.outcome,
      ],
      bo: this.objectives.map((o) => {
        const a = o.action;
        const need = (o.state === BT_OBJ_PLANTED ? BT_DEFUSE_SECONDS : BT_PLANT_SECONDS) * TICK_RATE;
        if (o.kind !== 'target') return [o.index, o.state, Math.floor(o.progress * 100), o.presence, -1];
        return [o.index, o.state, a ? Math.min(100, Math.round(((tick - a.start) / need) * 100)) : -1, o.state === BT_OBJ_PLANTED ? Math.max(0, Math.ceil((o.blowAt - tick) / TICK_RATE)) : 0, a?.slot ?? -1];
      }),
      ...(this.behind.size ? { bf: [...this.behind].map(([slot, since]): [number, number] => [slot, Math.max(0, Math.ceil((since + BT_FALLBACK_SECONDS * TICK_RATE - tick) / TICK_RATE))]) } : {}),
    };
  }

  botAwareness(): number {
    return Infinity;
  }

  blocksVehicle(): boolean {
    return false;
  }

  /** Where a side spawns now: its group for the sector in play, else the nearest sector's group for that side (further back for defenders, further forward for attackers first). */
  spawnSpots(c: Combatant): readonly SpawnSpot[] | null {
    const side = this.sideOf(c);
    if (!side || !this.sectors.length) return null;
    const k = Math.min(this.active, this.sectors.length - 1);
    const n = this.sectors.length;
    const order: number[] = [k];
    for (let d = 1; d < n; d++) {
      const fwd = k + d;
      const back = k - d;
      // Defenders fall back to a later sector's group first; attackers keep to an earlier one.
      for (const s of side === 'defend' ? [fwd, back] : [back, fwd]) if (s >= 0 && s < n) order.push(s);
    }
    for (const s of order) {
      const spots = this.groupSpots(s, side);
      if (spots.length) return spots;
    }
    return null;
  }

  /** A spawn group's spots, with spots round its own when it holds too few for its team (each checked for room and ground). */
  private groupSpots(s: number, side: BreakthroughSide): SpawnSpot[] {
    const own = this.sectors[s]!.spawns[side];
    if (!own.length) return own;
    const team = side === 'attack' ? this.attackIndex : 1 - this.attackIndex;
    const players = Math.max(this.host.rules.teamSizes?.[team] ?? 0, this.host.combatants().filter((c) => c.faction === this.host.teams[team]?.id).length);
    if (own.length * GROUP_SHARE >= players) return own;
    const key = `${s}:${side}`;
    let extra = this.extraSpots.get(key);
    if (!extra) {
      extra = [];
      const want = Math.ceil(players / GROUP_SHARE) - own.length;
      const physics = this.host.physics;
      for (const sp of own) {
        for (let k = 0; k < 8 && extra.length < want; k++) {
          const a = sp.yaw + (k * Math.PI) / 4;
          const p = { x: sp.pos.x + Math.sin(a) * 2.5, y: sp.pos.y + 0.6, z: sp.pos.z + Math.cos(a) * 2.5 };
          const ground = this.host.groundBelow(p);
          if (ground === null || Math.abs(ground - sp.pos.y) > 0.7) continue;
          const at = { x: p.x, y: ground, z: p.z };
          if (!physics.headroom({ x: at.x, y: at.y + 0.05, z: at.z }, 1.8)) continue;
          if (!physics.lineOfSight({ x: sp.pos.x, y: sp.pos.y + 1, z: sp.pos.z }, { x: at.x, y: at.y + 1, z: at.z })) continue;
          if (this.host.deadly?.(at)) continue;
          extra.push({ pos: at, yaw: sp.yaw, team: sp.team });
        }
      }
      this.extraSpots.set(key, extra);
    }
    return extra.length ? [...own, ...extra] : own;
  }

  /** Squad spawns: not beside a defender left behind the line. */
  spawnBeside(c: Combatant, mate: Combatant): boolean {
    if (this.sideOf(c) !== 'defend') return true;
    const line = this.active > 0 ? this.sector : null;
    return !line || !behindLine(line, mate.move.pos);
  }

  /**
   * Basic Breakthrough bots (Bot AI Phase B part 2 gives them a playbook), through the King of the Hill and Bomb
   * hooks: attackers spread over the sector's open objectives by slot and stand in a zone to capture it, or stand
   * still at a target to plant (and guard a charge once it burns); defenders hold the objectives, crowd a zone the
   * attackers are taking and rush a planted charge to defuse it. Between rounds: roam.
   */
  botGoal(c: Combatant): BotGoal | null {
    const sector = this.sector;
    if (!sector || this.outcome !== BT_ROUND_PLAYING || this.restartAt !== null) return null;
    const side = this.sideOf(c);
    const open = sector.objectives.filter((o) => o.state === BT_OBJ_ACTIVE || o.state === BT_OBJ_PLANTED);
    if (!side || !open.length) return null;
    const planted = open.filter((o) => o.state === BT_OBJ_PLANTED);
    if (side === 'attack') {
      // Targets still to plant come first (zones are taken by standing in them, which any attacker on the way helps).
      const o = open[c.slot % open.length]!;
      if (o.state === BT_OBJ_PLANTED) return { pos: o.pos, radius: Math.max(3, o.radius + 3) };
      if (o.kind === 'target') return { pos: o.pos, radius: Math.max(0.6, Math.min(1.2, o.radius * 0.4)), push: true };
      return { pos: o.pos, radius: Math.max(1, o.radius * 0.6 - (c.slot % 3) * 0.5), push: true };
    }
    // Defenders: a burning charge first (every other one), a zone being taken next, else hold their share.
    if (planted.length && c.slot % 2 === 0) {
      const o = planted.reduce((a, b) => (horizontalDistance(a.pos, c.move.pos) <= horizontalDistance(b.pos, c.move.pos) ? a : b));
      return { pos: o.pos, radius: Math.max(0.6, Math.min(1.2, o.radius * 0.4)), push: true };
    }
    const taking = open.filter((o) => o.kind !== 'target' && (o.presence === BT_IN_ATTACKERS || o.presence === BT_IN_BOTH));
    if (taking.length && c.slot % 3 !== 2) {
      const o = taking[c.slot % taking.length]!;
      return { pos: o.pos, radius: Math.max(1, o.radius * 0.5), push: true };
    }
    const o = open[c.slot % open.length]!;
    return { pos: o.pos, radius: o.kind === 'target' ? Math.max(3, o.radius + 3) : Math.max(1.5, o.radius * 0.8) };
  }
}
