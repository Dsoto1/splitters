import type { BombsiteEntity } from '../../map/schema.ts';
import { horizontalDistance, type Vec3 } from '../../math.ts';
import { BOMB_CARRIED, BOMB_DEFUSED, BOMB_DROPPED, BOMB_EXPLODED, BOMB_PLANTED, type ModeSnapshot } from '../../protocol.ts';
import { TICK_RATE } from '../constants.ts';
import type { Combatant } from '../match.ts';
import type { BotGoal, ModeHost, ModeLogic } from './types.ts';

/** Seconds to plant (attackers, inside a site) and to defuse (defenders, at the bomb). */
export const BOMB_PLANT_SECONDS = 3;
export const BOMB_DEFUSE_SECONDS = 5;
/** Fuse once planted. */
export const BOMB_FUSE_SECONDS = 40;
/** A round with no plant this long goes to the defenders. */
export const BOMB_ROUND_SECONDS = 115;
export const BOMB_BREAK_SECONDS = 4;
/** Reach for picking the bomb up and for defusing it. */
const PICKUP_RADIUS = 1.3;
const DEFUSE_RADIUS = 1.6;
/** Moving further than this from where you started cancels a plant or defuse. */
const STEADY = 0.6;
const BLAST = { radius: 14, damage: 400 };

interface Action {
  slot: number;
  start: number;
  from: Vec3;
  site: number;
}

/**
 * Bomb (Counter-Strike's bomb defusal, in rounds like Elimination). The first
 * team attacks: one of them carries the bomb, which drops where they die and
 * any attacker can pick up. Inside a bomb site, press Use (E) and hold still
 * for three seconds to plant it; it then blows after a 40-second fuse unless a
 * defender presses Use beside it and holds still for five seconds to defuse.
 * Attackers win a round by killing every defender or by the blast; defenders
 * by killing every attacker before a plant, by running the clock out with no
 * plant, or by the defuse. Nobody respawns within a round. Bots plant and
 * defuse just by standing there (they never press keys).
 */
export class BombMode implements ModeLogic {
  round = 1;
  private readonly wins = new Map<string, number>();
  private restartAt: number | null = null;
  private roundStart = 0;
  state = BOMB_CARRIED;
  pos: Vec3 = { x: 0, y: 0, z: 0 };
  carrier: number | null = null;
  /** Planted: the site and the tick it blows. */
  site = -1;
  blowAt = 0;
  private action: Action | null = null;

  constructor(private readonly host: ModeHost) {
    this.reset();
  }

  private get attackers(): string {
    return this.host.teams[0]!.id;
  }

  private get defenders(): string {
    return this.host.teams[1]!.id;
  }

  /** Bomb sites as [entity index, entity]. */
  sites(): [number, BombsiteEntity][] {
    return this.host.map.entities.flatMap((e, i) => (e.kind === 'bombsite' ? [[i, e] as [number, BombsiteEntity]] : []));
  }

  private siteAt(p: Vec3): number {
    for (const [i, e] of this.sites()) {
      if (Math.hypot(p.x - e.position[0], p.z - e.position[2]) <= e.radius && Math.abs(p.y - e.position[1]) < 3) return i;
    }
    return -1;
  }

  reset(): void {
    this.round = 1;
    this.wins.clear();
    this.startRound();
  }

  private startRound(): void {
    this.restartAt = null;
    this.roundStart = this.host.tick;
    this.state = BOMB_CARRIED;
    this.site = -1;
    this.action = null;
    this.carrier = null;
    this.handOut();
  }

  /** Give the bomb to an attacker (a human when there is one) if nobody has it. */
  private handOut(): void {
    const attackers = this.host.combatants().filter((c) => c.faction === this.attackers && c.alive);
    const pick = attackers.find((c) => c.kind === 'human') ?? attackers[0] ?? null;
    this.carrier = pick?.slot ?? null;
    if (pick) this.pos = { ...pick.move.pos };
  }

  alive(): number[] {
    const all = this.host.combatants();
    return this.host.teams.map((t) => all.filter((c) => c.faction === t.id && c.alive).length);
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
    const all = host.combatants();
    if (host.teams.slice(0, 2).some((t) => !all.some((c) => c.faction === t.id))) {
      // Warm-up until both sides have someone: the dead come back.
      for (const c of all) if (!c.alive && c.respawnTick === Infinity) c.respawnTick = host.tick + host.rules.respawnDelayTicks;
      this.roundStart = host.tick;
      if (this.carrier === null && this.state === BOMB_CARRIED) this.handOut();
      return;
    }
    if (this.carrier === null && this.state === BOMB_CARRIED) this.handOut();
    this.moveBomb(all);
    this.runAction(all);
    if (this.state === BOMB_PLANTED && host.tick >= this.blowAt) {
      this.state = BOMB_EXPLODED;
      host.emit({ e: 'bomb', a: 'explode', s: null, p: [this.pos.x, this.pos.y, this.pos.z], i: this.site });
      host.explode({ x: this.pos.x, y: this.pos.y + 0.5, z: this.pos.z }, BLAST.radius, BLAST.damage, null);
      return this.winRound(this.attackers);
    }
    const [att, def] = this.alive();
    if (def === 0) return this.winRound(this.attackers);
    // With the bomb down, the attackers dying doesn't save the defenders: they still have to defuse.
    if (att === 0 && this.state !== BOMB_PLANTED) return this.winRound(this.defenders);
    if (this.state !== BOMB_PLANTED && host.tick - this.roundStart >= BOMB_ROUND_SECONDS * TICK_RATE) return this.winRound(this.defenders);
  }

  /** The bomb follows its carrier; a dropped one goes to the first attacker who walks over it. */
  private moveBomb(all: Combatant[]): void {
    if (this.state === BOMB_CARRIED) {
      const c = this.player(this.carrier);
      if (c?.alive) this.pos = { ...c.move.pos };
      else this.drop(c ?? null);
      return;
    }
    if (this.state !== BOMB_DROPPED) return;
    for (const c of all) {
      if (!c.alive || c.faction !== this.attackers) continue;
      if (horizontalDistance(c.move.pos, this.pos) <= PICKUP_RADIUS && Math.abs(c.move.pos.y - this.pos.y) < 1.5) {
        this.state = BOMB_CARRIED;
        this.carrier = c.slot;
        this.host.emit({ e: 'bomb', a: 'pickup', s: c.slot });
        return;
      }
    }
  }

  private drop(c: Combatant | null): void {
    this.state = BOMB_DROPPED;
    this.carrier = null;
    const ground = this.host.groundBelow({ x: this.pos.x, y: this.pos.y + 1, z: this.pos.z });
    if (ground !== null) this.pos = { ...this.pos, y: ground };
    if (this.action) this.action = null;
    this.host.emit({ e: 'bomb', a: 'drop', s: c?.slot ?? null, p: [this.pos.x, this.pos.y, this.pos.z] });
  }

  /** Planting and defusing: start with Use (bots: just by being there), then hold still. */
  private runAction(all: Combatant[]): void {
    const tick = this.host.tick;
    const a = this.action;
    if (a) {
      const c = this.player(a.slot);
      const ok = c?.alive && horizontalDistance(c.move.pos, a.from) <= STEADY && (this.state === BOMB_PLANTED ? c.faction === this.defenders : this.carrier === c.slot);
      if (!ok) {
        this.action = null;
        return;
      }
      const need = (this.state === BOMB_PLANTED ? BOMB_DEFUSE_SECONDS : BOMB_PLANT_SECONDS) * TICK_RATE;
      if (tick - a.start < need) return;
      this.action = null;
      if (this.state === BOMB_PLANTED) {
        this.state = BOMB_DEFUSED;
        this.host.emit({ e: 'bomb', a: 'defuse', s: c!.slot, i: this.site });
        return this.winRound(this.defenders);
      }
      this.state = BOMB_PLANTED;
      this.site = a.site;
      this.carrier = null;
      const ground = this.host.groundBelow({ x: c!.move.pos.x, y: c!.move.pos.y + 1, z: c!.move.pos.z });
      this.pos = { ...c!.move.pos, y: ground ?? c!.move.pos.y };
      this.blowAt = tick + BOMB_FUSE_SECONDS * TICK_RATE;
      this.host.emit({ e: 'bomb', a: 'plant', s: c!.slot, i: a.site, p: [this.pos.x, this.pos.y, this.pos.z] });
      return;
    }
    const starts = (c: Combatant) => c.useTick === tick || (c.kind !== 'human' && (c.move.vx ?? 0) === 0);
    if (this.state === BOMB_CARRIED) {
      const c = this.player(this.carrier);
      if (!c) return;
      const site = this.siteAt(c.move.pos);
      if (site >= 0 && starts(c)) this.action = { slot: c.slot, start: tick, from: { ...c.move.pos }, site };
    } else if (this.state === BOMB_PLANTED) {
      for (const c of all) {
        if (!c.alive || c.faction !== this.defenders) continue;
        if (horizontalDistance(c.move.pos, this.pos) <= DEFUSE_RADIUS && Math.abs(c.move.pos.y - this.pos.y) < 1.5 && starts(c)) {
          this.action = { slot: c.slot, start: tick, from: { ...c.move.pos }, site: this.site };
          return;
        }
      }
    }
  }

  private winRound(team: string): void {
    const host = this.host;
    this.wins.set(team, (this.wins.get(team) ?? 0) + 1);
    host.emit({ e: 'elim', a: 'win', round: this.round, team });
    if (host.rules.scoreLimit > 0 && this.wins.get(team)! >= host.rules.scoreLimit) return host.endRound();
    this.restartAt = host.tick + BOMB_BREAK_SECONDS * TICK_RATE;
  }

  private nextRound(): void {
    this.round++;
    for (const c of this.host.combatants()) this.host.respawn(c);
    this.startRound();
    this.host.emit({ e: 'elim', a: 'start', round: this.round, team: null });
  }

  /** The dead wait for the next round; a carrier's death drops the bomb (next tick). */
  onKill(victim: Combatant): void {
    victim.respawnTick = Infinity;
  }

  onLeave(c: Combatant): void {
    if (this.carrier === c.slot) this.drop(c);
  }

  /** Host handoff: the team scores a checkpoint carried (as teamScores gives them). */
  restoreScores(scores: ReadonlyMap<string, number>): void {
    for (const t of this.host.teams) this.wins.set(t.id, scores.get(t.id) ?? 0);
  }

  teamScores(): Map<string, number> {
    return new Map(this.host.teams.map((t) => [t.id, this.wins.get(t.id) ?? 0]));
  }

  snapshot(): ModeSnapshot {
    const host = this.host;
    const a = this.action;
    const need = this.state === BOMB_PLANTED ? BOMB_DEFUSE_SECONDS : BOMB_PLANT_SECONDS;
    const r2 = (v: number) => Math.round(v * 100) / 100;
    return {
      ts: host.teams.map((t) => this.wins.get(t.id) ?? 0),
      el: [this.round, this.restartAt === null ? 0 : Math.max(0, Math.ceil((this.restartAt - host.tick) / TICK_RATE)), ...this.alive()],
      bm: [
        this.state,
        r2(this.pos.x),
        r2(this.pos.y),
        r2(this.pos.z),
        this.carrier ?? -1,
        this.state === BOMB_PLANTED ? Math.max(0, Math.ceil((this.blowAt - host.tick) / TICK_RATE)) : 0,
        a ? Math.min(100, Math.round(((host.tick - a.start) / (need * TICK_RATE)) * 100)) : -1,
        a?.slot ?? -1,
        this.site,
      ],
    };
  }

  botAwareness(): number {
    return Infinity;
  }

  blocksVehicle(c: Combatant): boolean {
    return this.carrier === c.slot;
  }

  /**
   * Attackers: the carrier heads for a site (one per round), the rest go with
   * it or fetch a dropped bomb; after the plant they guard it. Defenders split
   * between the sites, and rush the bomb once it's down.
   */
  botGoal(c: Combatant): BotGoal | null {
    const sites = this.sites();
    if (!sites.length) return null;
    const target = sites[this.round % sites.length]![1];
    const targetPos = { x: target.position[0], y: target.position[1], z: target.position[2] };
    if (c.faction === this.attackers) {
      if (this.state === BOMB_PLANTED) return { pos: this.pos, radius: 6 };
      if (this.state === BOMB_DROPPED) return { pos: this.pos, radius: 0.8 };
      if (this.carrier === c.slot) return { pos: targetPos, radius: Math.max(1, target.radius * 0.4) };
      return { pos: targetPos, radius: target.radius + 4 };
    }
    if (this.state === BOMB_PLANTED) return { pos: this.pos, radius: 1 };
    const guard = sites[c.slot % sites.length]![1];
    return { pos: { x: guard.position[0], y: guard.position[1], z: guard.position[2] }, radius: guard.radius + 2 };
  }
}
