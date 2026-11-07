import { horizontalDistance, type Vec3 } from '../../math.ts';
import type { ModeSnapshot } from '../../protocol.ts';
import { TICK_RATE } from '../constants.ts';
import type { Combatant } from '../match.ts';
import { playbookFor } from '../../bots/playbooks.ts';
import type { SideBrief } from '../../bots/teamBrain.ts';
import { teamHome, type BotGoal, type BotTripSpec, type ModeHost, type ModeLogic } from './types.ts';


export interface HillRt {
  /** Index of its map entity. */
  index: number;
  pos: Vec3;
  radius: number;
}

/** Standing on the hill: within its radius, from a little below its floor to a storey above. */
export const onHill = (h: HillRt, p: Vec3): boolean => horizontalDistance(h.pos, p) <= h.radius && p.y > h.pos.y - 1 && p.y < h.pos.y + 3.5;

/**
 * King of the Hill. The hill is one of the map's hill spots and moves to the
 * next one (in map order) every `hillSeconds`. A team scores a point for
 * every second it alone has living players on it; with two teams on it, it
 * is contested and nobody scores. The score limit counts those seconds.
 */
export class KothMode implements ModeLogic {
  readonly hills: HillRt[];
  active = 0;
  private moveAt = 0;
  /** Ticks held per team. */
  private readonly held = new Map<string, number>();
  /** Team holding the hill right now, null for nobody, 'contested'. */
  holder: string | null = null;

  constructor(private readonly host: ModeHost) {
    this.hills = host.map.entities.flatMap((e, index) => (e.kind === 'hill' ? [{ index, pos: { x: e.position[0], y: e.position[1], z: e.position[2] }, radius: e.radius }] : []));
    if (!this.hills.length) this.hills.push({ index: -1, pos: { x: 0, y: 0, z: 0 }, radius: 5 });
    this.reset();
  }

  private get moveTicks(): number {
    return Math.round((this.host.rules.hillSeconds ?? 60) * TICK_RATE);
  }

  get hill(): HillRt {
    return this.hills[this.active]!;
  }

  reset(): void {
    this.active = 0;
    this.moveAt = this.host.tick + this.moveTicks;
    this.held.clear();
    this.holder = null;
  }

  step(): void {
    const host = this.host;
    if (host.tick >= this.moveAt) {
      this.moveAt = host.tick + this.moveTicks;
      if (this.hills.length > 1) {
        this.active = (this.active + 1) % this.hills.length;
        this.holder = null;
        host.emit({ e: 'hill', a: 'move', i: this.hill.index, team: null });
      }
    }
    const present = new Set<string>();
    for (const c of host.combatants()) if (c.alive && c.faction && onHill(this.hill, c.move.pos)) present.add(c.faction);
    const holder = present.size === 1 ? [...present][0]! : present.size > 1 ? 'contested' : null;
    if (holder !== this.holder) {
      this.holder = holder;
      host.emit({ e: 'hill', a: 'hold', i: this.hill.index, team: holder === 'contested' ? null : holder });
    }
    if (holder && holder !== 'contested') {
      const ticks = (this.held.get(holder) ?? 0) + 1;
      this.held.set(holder, ticks);
      if (host.rules.scoreLimit > 0 && Math.floor(ticks / TICK_RATE) >= host.rules.scoreLimit) host.endRound();
    }
  }

  onKill(): void {}

  onLeave(): void {}

  /** Host handoff: the team scores a checkpoint carried (as teamScores gives them). */
  restoreScores(scores: ReadonlyMap<string, number>): void {
    for (const t of this.host.teams) this.held.set(t.id, (scores.get(t.id) ?? 0) * TICK_RATE);
  }

  teamScores(): Map<string, number> {
    return new Map(this.host.teams.map((t) => [t.id, Math.floor((this.held.get(t.id) ?? 0) / TICK_RATE)]));
  }

  snapshot(): ModeSnapshot {
    const teams = this.host.teams;
    const holder = this.holder === 'contested' ? -2 : teams.findIndex((t) => t.id === this.holder);
    return {
      ts: teams.map((t) => Math.floor((this.held.get(t.id) ?? 0) / TICK_RATE)),
      hl: [this.hill.index, holder, this.hills.length > 1 ? Math.max(0, Math.ceil((this.moveAt - this.host.tick) / TICK_RATE)) : 0],
    };
  }

  botAwareness(): number {
    return Infinity;
  }

  blocksVehicle(): boolean {
    return false;
  }

  /** Each team's way from its spawn to every hill. */
  botTrips(): readonly BotTripSpec[] {
    const out: BotTripSpec[] = [];
    for (const t of this.host.teams) {
      const home = teamHome(this.host.spawnPoints, t.id);
      if (home) for (const h of this.hills) if (h.index >= 0) out.push({ team: t.id, from: home, to: { ...h.pos }, kind: 'attack' });
    }
    return out;
  }

  /**
   * The team brain's brief: everyone goes for the hill; while the other team holds it, they gather first and retake it
   * together (a group push), otherwise straight in.
   */
  botBrief(team: string): SideBrief | null {
    const theirs = this.holder !== null && this.holder !== 'contested' && this.holder !== team;
    return { attack: { pos: { ...this.hill.pos }, stage: theirs }, intercept: null, playbook: playbookFor('core.koth').team };
  }

  /**
   * Everyone heads for the hill and spreads out on it. A goal to hold (bots/brain.ts scored choices: what happens near
   * the hill draws a bot on it, gunfire further off doesn't), not one to keep to on the way (`push`: such a bot takes
   * cover only when hurt or reloading). Before scores a bot on the hill went after any gunfire it heard and the hill
   * emptied: held 26 % of the time on the dev sample (Shingle Point, Diamond Park, Bunker Cross), 40 % with them.
   */
  botGoal(c: Combatant): BotGoal | null {
    const h = this.hill;
    return { pos: h.pos, radius: Math.max(1, h.radius * 0.6 - (c.slot % 3)) };
  }
}
