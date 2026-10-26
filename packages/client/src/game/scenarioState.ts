import { Movers, ScenarioBodies, teamAllows, type MapDocument, type PhysicsWorld, type ScenarioSnapshot, type Vec3 } from '@tiletrigger/shared';

/**
 * The client's copy of replicated scenario state. It feeds the visuals and
 * HUD, and drives door, crate and moving-platform colliders in the
 * prediction physics so local movement agrees with the server.
 */
export class ScenarioState {
  readonly entities = new Map<number, readonly [number, number]>();
  objectives: number[] = [];
  /** Visible timers as [timer index, seconds left, local time the value arrived]. */
  timers: [number, number, number][] = [];
  /** Movers (lifts, drawbridges): legs from the server; poses are worked out for any tick. */
  readonly movers: Movers;
  private readonly bodies: ScenarioBodies;
  private posedTick = NaN;

  constructor(
    private readonly map: MapDocument,
    physics: PhysicsWorld,
  ) {
    this.bodies = new ScenarioBodies(physics, map);
    this.movers = new Movers(map);
    this.objectives = map.logic.objectives.map((o) => (o.startActive ? 1 : 0));
  }

  apply(sc: ScenarioSnapshot | undefined, now = performance.now()): void {
    if (!sc) return;
    for (const [i, a, b] of sc.es ?? []) {
      this.entities.set(i, [a, b]);
      const kind = this.map.entities[i]?.kind;
      if (kind === 'door') this.bodies.setDoorOpen(i, a / 100);
      else if (kind === 'destructible' || kind === 'prop' || kind === 'block') this.bodies.setSolid(i, a > 0);
      else if (kind === 'mover') {
        this.movers.decode(i, a, b);
        this.posedTick = NaN;
      }
    }
    if (sc.es?.length) this.bodies.commit();
    if (sc.ob) this.objectives = sc.ob;
    if (sc.tm) this.timers = sc.tm.map(([k, secs]) => [k, secs, now]);
  }

  /** Whether a block (entity index) is there: dropped and hidden blocks carry nobody. */
  present = (i: number): boolean => {
    const s = this.entities.get(i);
    if (s) return s[0] > 0;
    const e = this.map.entities[i];
    return !(e?.kind === 'block' && e.startHidden);
  };

  /** Put moving platforms' colliders where they are at `tick` (prediction runs this before each move). */
  poseAt(tick: number): void {
    if (!this.movers.defs.length || tick === this.posedTick) return;
    this.posedTick = tick;
    for (const t of this.movers.transforms(tick)) this.bodies.setTransform(t.block.i, t.center, t.rot);
    this.bodies.commit();
  }

  /** Where feet standing on a moving platform are carried from `tick - 1` to `tick` (null: not riding). */
  carry(feet: Vec3, tick: number): Vec3 | null {
    if (!this.movers.defs.length) return null;
    return this.movers.carry(feet, tick, this.present);
  }

  /** Seconds left on a visible timer, counted down locally between updates. */
  timerLeft(entry: [number, number, number], now = performance.now()): number {
    return Math.max(0, entry[1] - Math.floor((now - entry[2]) / 1000));
  }

  state(i: number): readonly [number, number] | undefined {
    return this.entities.get(i);
  }

  /** Locked doors and manual doors can be used; buttons when enabled; team-only ones by their team. Mirrors Scenario.usable. */
  usable(i: number, team: string | null = null): boolean {
    const e = this.map.entities[i];
    if ((e?.kind === 'door' || e?.kind === 'button') && !teamAllows(e.team, team)) return false;
    if (e?.kind === 'door') return !e.auto || (this.entities.get(i)?.[1] ?? (e.locked ? 1 : 0)) === 1;
    return e?.kind === 'button';
  }
}
