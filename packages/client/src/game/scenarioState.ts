import { ScenarioBodies, type MapDocument, type PhysicsWorld, type ScenarioSnapshot } from '@chronosplit/shared';

/**
 * The client's copy of replicated scenario state. It feeds the visuals and
 * HUD, and drives door and crate colliders in the prediction physics so
 * local movement agrees with the server.
 */
export class ScenarioState {
  readonly entities = new Map<number, readonly [number, number]>();
  objectives: number[] = [];
  /** Visible timers as [timer index, seconds left, local time the value arrived]. */
  timers: [number, number, number][] = [];
  private readonly bodies: ScenarioBodies;

  constructor(
    private readonly map: MapDocument,
    physics: PhysicsWorld,
  ) {
    this.bodies = new ScenarioBodies(physics, map);
    this.objectives = map.logic.objectives.map((o) => (o.startActive ? 1 : 0));
  }

  apply(sc: ScenarioSnapshot | undefined, now = performance.now()): void {
    if (!sc) return;
    for (const [i, a, b] of sc.es ?? []) {
      this.entities.set(i, [a, b]);
      const kind = this.map.entities[i]?.kind;
      if (kind === 'door') this.bodies.setDoorOpen(i, a / 100);
      else if (kind === 'destructible') this.bodies.setSolid(i, a > 0);
    }
    if (sc.es?.length) this.bodies.commit();
    if (sc.ob) this.objectives = sc.ob;
    if (sc.tm) this.timers = sc.tm.map(([k, secs]) => [k, secs, now]);
  }

  /** Seconds left on a visible timer, counted down locally between updates. */
  timerLeft(entry: [number, number, number], now = performance.now()): number {
    return Math.max(0, entry[1] - Math.floor((now - entry[2]) / 1000));
  }

  state(i: number): readonly [number, number] | undefined {
    return this.entities.get(i);
  }

  /** Locked doors and manual doors can be used; buttons when enabled. Mirrors Scenario.usable. */
  usable(i: number): boolean {
    const e = this.map.entities[i];
    if (e?.kind === 'door') return !e.auto || (this.entities.get(i)?.[1] ?? (e.locked ? 1 : 0)) === 1;
    return e?.kind === 'button';
  }

}
