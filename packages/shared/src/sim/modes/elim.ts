import { horizontalDistance } from '../../math.ts';
import type { ModeSnapshot } from '../../protocol.ts';
import { TICK_RATE } from '../constants.ts';
import type { Combatant } from '../match.ts';
import type { BotGoal, ModeHost, ModeLogic } from './types.ts';

/** Pause between Elimination rounds. */
export const ELIM_BREAK_SECONDS = 3;
/** A round that runs this long goes to the team with more players standing. */
export const ELIM_ROUND_SECONDS = 120;
/** After this long, bots stop roaming and hunt down whoever is left. */
const HUNT_AFTER_SECONDS = 30;

/**
 * Elimination: round-based Team Deathmatch. Nobody respawns until the next
 * round; the last team with anyone standing wins the round (a round that
 * runs out goes to the team with more players alive). The score limit counts
 * rounds won. While fewer than two teams have players, the dead respawn as
 * normal (warm-up).
 */
export class ElimMode implements ModeLogic {
  round = 1;
  private readonly wins = new Map<string, number>();
  /** Tick the next round starts (between rounds), else null. */
  private restartAt: number | null = null;
  private roundStart = 0;

  constructor(private readonly host: ModeHost) {
    this.reset();
  }

  reset(): void {
    this.round = 1;
    this.wins.clear();
    this.restartAt = null;
    this.roundStart = this.host.tick;
  }

  /** Living players per team, in team order. */
  alive(): number[] {
    const all = this.host.combatants();
    return this.host.teams.map((t) => all.filter((c) => c.faction === t.id && c.alive).length);
  }

  step(): void {
    const host = this.host;
    if (this.restartAt !== null) {
      if (host.tick >= this.restartAt) this.nextRound();
      return;
    }
    const all = host.combatants();
    const manned = host.teams.filter((t) => all.some((c) => c.faction === t.id));
    if (manned.length < 2) {
      // Warm-up: nobody to fight, so the dead come back.
      for (const c of all) if (!c.alive && c.respawnTick === Infinity) c.respawnTick = host.tick + host.rules.respawnDelayTicks;
      this.roundStart = host.tick;
      return;
    }
    const alive = this.alive();
    const standing = host.teams.filter((_, i) => alive[i]! > 0);
    const timeUp = host.tick - this.roundStart >= ELIM_ROUND_SECONDS * TICK_RATE;
    if (standing.length > 1 && !timeUp) return;
    let winner: string | null = standing.length === 1 ? standing[0]!.id : null;
    if (timeUp && standing.length > 1) {
      const best = Math.max(...alive);
      const top = host.teams.filter((_, i) => alive[i] === best);
      winner = top.length === 1 ? top[0]!.id : null;
    }
    if (winner) this.wins.set(winner, (this.wins.get(winner) ?? 0) + 1);
    host.emit({ e: 'elim', a: 'win', round: this.round, team: winner });
    if (winner && host.rules.scoreLimit > 0 && this.wins.get(winner)! >= host.rules.scoreLimit) {
      host.endRound();
      return;
    }
    this.restartAt = host.tick + ELIM_BREAK_SECONDS * TICK_RATE;
  }

  private nextRound(): void {
    this.round++;
    this.restartAt = null;
    this.roundStart = this.host.tick;
    for (const c of this.host.combatants()) this.host.respawn(c);
    this.host.emit({ e: 'elim', a: 'start', round: this.round, team: null });
  }

  /** The dead wait for the next round. */
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
    return {
      ts: host.teams.map((t) => this.wins.get(t.id) ?? 0),
      el: [this.round, this.restartAt === null ? 0 : Math.max(0, Math.ceil((this.restartAt - host.tick) / TICK_RATE)), ...this.alive()],
    };
  }

  botAwareness(): number {
    return Infinity;
  }

  blocksVehicle(): boolean {
    return false;
  }

  /** Roam as in Team Deathmatch at first; once a round drags on, hunt the nearest enemy left standing. */
  botGoal(c: Combatant, hostiles: readonly Combatant[]): BotGoal | null {
    if (this.host.tick - this.roundStart < HUNT_AFTER_SECONDS * TICK_RATE) return null;
    let best: Combatant | null = null;
    for (const h of hostiles) if (h.kind !== 'npc' && (!best || horizontalDistance(h.move.pos, c.move.pos) < horizontalDistance(best.move.pos, c.move.pos))) best = h;
    return best ? { pos: best.move.pos, radius: 2 } : null;
  }
}
