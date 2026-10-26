import { beforeAll, describe, expect, it } from 'vitest';
import {
  BUTTON_USE,
  DEFAULT_DEATHMATCH_RULES,
  MOUNT_DEFS,
  MOUNT_FLAG_ALIVE,
  MOUNT_FLAG_BURNING,
  MOUNT_FLAG_WRECK,
  TICK_RATE,
  footprintGap,
  initPhysics,
  mountDamageState,
  type GameEvent,
  type MapDocument,
  type MapEntity,
  type MatchRules,
  type PlayerInput,
} from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const rules: MatchRules = { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000 };
type MountEntity = Omit<Extract<MapEntity, { kind: 'mount' }>, 'id' | 'kind'>;
const mount = (model: string, x: number, z: number, yaw = 0, respawnSeconds: number | null = null): MountEntity => ({ position: [x, 0, z], model: model as 'buggy', yaw, faction: null, respawnSeconds });

/** An open yard 40 × 32 m (x -4..36, z -4..28), with mounts and anything else. */
function yard(mounts: MountEntity[], extra: MapEntity[] = []): MapDocument {
  const tiles = [];
  for (let x = 0; x < 5; x++) for (let y = 0; y < 4; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  const map = makeMap(tiles, [[0, 0, 0]]);
  return { ...map, entities: [...map.entities, ...mounts.map((m, i) => ({ id: `mount_${i}`, kind: 'mount' as const, ...m })), ...extra] };
}

interface MountInternals {
  index: number;
  health: number;
  alive: boolean;
  burning: boolean;
  wreckUntil: number;
  lastHitBy: number | null;
  pos: { x: number; y: number; z: number };
  def: (typeof MOUNT_DEFS)[keyof typeof MOUNT_DEFS];
}
const internals = (match: Match) => match as unknown as { mounts: MountInternals[]; damageMount(m: MountInternals, n: number, by: Combatant | null): void; physics: { lineOfSight(a: unknown, b: unknown): boolean } };

class Driver {
  seq = new Map<number, number>();
  constructor(readonly match: Match) {}
  input(c: Combatant, i: Partial<PlayerInput>): void {
    const seq = (this.seq.get(c.slot) ?? 0) + 1;
    this.seq.set(c.slot, seq);
    this.match.queueInputs(c.slot, [{ seq, forward: 0, right: 0, yaw: c.yaw, pitch: c.pitch, buttons: 0, ...i }]);
  }
  run(n: number, each: () => void = () => {}): GameEvent[] {
    const out: GameEvent[] = [];
    for (let i = 0; i < n; i++) {
      each();
      out.push(...this.match.step());
    }
    return out;
  }
}

const place = (c: Combatant, x: number, z: number) => (c.move = { pos: { x, y: 0, z }, velY: 0, grounded: true });
const use = (d: Driver, c: Combatant) => {
  d.run(1, () => d.input(c, { buttons: BUTTON_USE }));
  d.run(1, () => d.input(c, {}));
};
const flags = (match: Match, i = 0) => (match.snapshot([]).mt![i]! as number[])[8]!;

describe('vehicle damage states, fire, wrecks and crashes', () => {
  it('damage states follow the health fraction: smoke under 60%, heavy smoke under 35%, fire under 15%', () => {
    expect(mountDamageState(1)).toBe('intact');
    expect(mountDamageState(0.59)).toBe('smoking');
    expect(mountDamageState(0.34)).toBe('heavy');
    expect(mountDamageState(0.14)).toBe('burning');
    expect(mountDamageState(0.9, true)).toBe('burning');
    const match = new Match(yard([mount('buggy', 10, 10)]), rules);
    new Driver(match).run(2);
    const m = internals(match).mounts[0]!;
    internals(match).damageMount(m, m.def.health * 0.5, null);
    expect(flags(match)).toBe(MOUNT_FLAG_ALIVE);
    expect(match.snapshot([]).mt![0]![7]).toBe(50);
    internals(match).damageMount(m, m.def.health * 0.38, null);
    expect(flags(match)).toBe(MOUNT_FLAG_ALIVE | MOUNT_FLAG_BURNING);
  });

  it('a burning vehicle burns down and blows up on its own; the kill goes to whoever set it alight', () => {
    const match = new Match(yard([mount('buggy', 10, 10)]), rules);
    const d = new Driver(match);
    const shooter = match.addHuman('shooter')!;
    const driver = match.addHuman('driver')!;
    d.run(2);
    place(shooter, 30, 25);
    place(driver, 10, 8);
    use(d, driver);
    expect(driver.mount).toBeDefined();
    const m = internals(match).mounts[0]!;
    internals(match).damageMount(m, m.def.health * 0.86, shooter);
    expect(m.burning).toBe(true);
    driver.health = 20;
    let ticks = 0;
    const events: GameEvent[] = [];
    while (m.alive && ticks < TICK_RATE * 10) {
      events.push(...d.run(1, () => d.input(driver, {})));
      ticks++;
    }
    expect(m.alive).toBe(false);
    // From 14% it takes a little under 5 s.
    expect(ticks / TICK_RATE).toBeGreaterThan(3);
    expect(ticks / TICK_RATE).toBeLessThan(5.5);
    expect(events.some((e) => e.e === 'explode' && e.m === m.index && e.s === shooter.slot)).toBe(true);
    const kill = events.find((e) => e.e === 'kill' && e.victim === driver.slot);
    expect(kill).toMatchObject({ killer: shooter.slot, weapon: 'core.wreck' });
    expect(shooter.kills).toBe(1);
  });

  it('the wreck stays as solid cover you cannot board, then fades and the vehicle respawns at home', () => {
    const match = new Match(yard([mount('buggy', 10, 10, 0, 30)]), rules);
    const d = new Driver(match);
    const a = match.addHuman('a')!;
    d.run(2);
    const { mounts, damageMount, physics } = internals(match);
    const m = mounts[0]!;
    // Push it away from home first, so the respawn is visible.
    m.pos = { x: 14, y: 0, z: 14 };
    d.run(1);
    damageMount.call(match, m, 10_000, a);
    expect(flags(match)).toBe(MOUNT_FLAG_WRECK);
    d.run(TICK_RATE);
    // Solid: it blocks sight through it, and you can't get in.
    const across = [{ x: 14, y: 0.6, z: 10 }, { x: 14, y: 0.6, z: 18 }] as const;
    expect(physics.lineOfSight(across[0], across[1])).toBe(false);
    place(a, 14, 11.2);
    a.health = 100;
    use(d, a);
    expect(a.mount).toBeUndefined();
    // It stands about 20 s, then it's gone (no longer solid) until the respawn at home.
    d.run(TICK_RATE * 18);
    expect(flags(match) & MOUNT_FLAG_WRECK).toBe(MOUNT_FLAG_WRECK);
    d.run(TICK_RATE * 2);
    expect(flags(match)).toBe(0);
    expect(physics.lineOfSight(across[0], across[1])).toBe(true);
    d.run(TICK_RATE * 10);
    expect(flags(match)).toBe(MOUNT_FLAG_ALIVE);
    expect(m.pos.x).toBeCloseTo(10);
    expect(m.pos.z).toBeCloseTo(10);
    expect(m.health).toBe(m.def.health);
  });

  it('a short respawn delay cuts the wreck short so it is gone before the vehicle is back', () => {
    const match = new Match(yard([mount('kart', 10, 10, 0, 5)]), rules);
    const d = new Driver(match);
    d.run(2);
    const m = internals(match).mounts[0]!;
    internals(match).damageMount(m, 10_000, null);
    d.run(TICK_RATE * 3);
    expect(flags(match)).toBe(MOUNT_FLAG_WRECK);
    d.run(TICK_RATE * 1);
    expect(flags(match)).toBe(0);
    d.run(TICK_RATE * 1 + 2);
    expect(flags(match)).toBe(MOUNT_FLAG_ALIVE);
  });

  it('the blast sets off a chain: it damages a vehicle parked nearby and blows up a barrel beside it', () => {
    const barrel: MapEntity = { id: 'barrel_1', kind: 'destructible', model: 'barrel', position: [10, 0, 14], yaw: 0, health: null, explosiveOnly: false } as MapEntity;
    const match = new Match(yard([mount('buggy', 10, 10), mount('buggy', 14, 10)], [barrel]), rules);
    const d = new Driver(match);
    const a = match.addHuman('a')!;
    d.run(2);
    place(a, 30, 25);
    const [first, second] = internals(match).mounts;
    internals(match).damageMount(first!, 10_000, a);
    const events = d.run(2);
    expect(second!.health).toBeLessThan(second!.def.health);
    expect(second!.lastHitBy).toBe(a.slot);
    expect(events.some((e) => e.e === 'broken')).toBe(true);
    // The barrel went up too: its blast besides the vehicle's.
    expect(events.filter((e) => e.e === 'explode').length).toBeGreaterThanOrEqual(2);
  });

  it('chain reaction: a barrel blast finishes a burning vehicle, which goes up and credits the shooter', () => {
    const barrel: MapEntity = { id: 'barrel_1', kind: 'destructible', model: 'barrel', position: [10, 0, 13], yaw: 0, health: null, explosiveOnly: false } as MapEntity;
    const match = new Match(yard([mount('kart', 10, 10)], [barrel]), rules);
    const d = new Driver(match);
    const a = match.addHuman('a')!;
    d.run(2);
    place(a, 30, 25);
    const m = internals(match).mounts[0]!;
    internals(match).damageMount(m, m.def.health * 0.8, null);
    // Shoot the barrel (explosive damage to destructibles).
    (match as unknown as { splash(at: unknown, r: number, dmg: number, edge: number, owner: Combatant, w: string, self: number): void }).splash({ x: 10, y: 0.6, z: 13.6 }, 1, 50, 50, a, 'core.rocket', 1);
    const events = d.run(2);
    expect(m.alive).toBe(false);
    expect(m.lastHitBy).toBe(a.slot);
    expect(events.some((e) => e.e === 'explode' && e.m === m.index)).toBe(true);
  });

  it('ramming: a kart driven into a parked buggy hurts both, the light kart far worse, credited to the drivers, with a crash', () => {
    const match = new Match(yard([mount('kart', 4, 10, Math.PI / 2), mount('buggy', 20, 10, 0)]), rules);
    const d = new Driver(match);
    const a = match.addHuman('a')!;
    d.run(2);
    place(a, 4, 12);
    use(d, a);
    expect(a.mount?.index).toBe(0);
    const [kart, buggy] = internals(match).mounts;
    const events = d.run(TICK_RATE * 2, () => d.input(a, { forward: 1 }));
    const crash = events.find((e) => e.e === 'crash');
    expect(crash).toBeDefined();
    expect(buggy!.health).toBeLessThan(buggy!.def.health);
    expect(buggy!.lastHitBy).toBe(a.slot);
    const kartLoss = 1 - Math.max(0, kart!.health) / kart!.def.health;
    const buggyLoss = 1 - buggy!.health / buggy!.def.health;
    expect(kartLoss).toBeGreaterThan(buggyLoss * 2);
  });

  it('footprints: the gap between two boxes and the normal from one to the other', () => {
    const a = { pos: { x: 0, y: 0, z: 0 }, yaw: 0, half: [1, 0.5, 2] as const };
    const b = { pos: { x: 3, y: 0, z: 0 }, yaw: 0, half: [1, 0.5, 2] as const };
    const g = footprintGap(a, b)!;
    expect(g.gap).toBeCloseTo(1);
    expect(g.nx).toBeCloseTo(1);
    expect(footprintGap(a, { ...b, pos: { x: 1.5, y: 0, z: 0 } })!.gap).toBeLessThan(0);
    expect(footprintGap(a, { ...b, pos: { x: 0, y: 5, z: 0 } })).toBeNull();
  });

  it('lava sets a vehicle on fire at once and destroys it; deep water floods a ground vehicle but not a hovercraft', () => {
    const pool = (liquid: 'water' | 'lava', x: number): MapEntity => ({ id: `pool_${liquid}`, kind: 'water', position: [x, 0, 12], size: [10, 3, 10], liquid }) as MapEntity;
    const match = new Match(yard([mount('buggy', 6, 12), mount('buggy', 24, 12), mount('speeder', 26, 14)], [pool('lava', 6), pool('water', 24)]), rules);
    const d = new Driver(match);
    d.run(2);
    const [inLava, inWater, hover] = internals(match).mounts;
    expect(inLava!.burning).toBe(true);
    expect(flags(match, 0) & MOUNT_FLAG_BURNING).toBe(MOUNT_FLAG_BURNING);
    d.run(TICK_RATE * 5);
    expect(inLava!.alive).toBe(false);
    expect(inWater!.health).toBeLessThan(inWater!.def.health * 0.6);
    expect(hover!.health).toBe(hover!.def.health);
  });

  it('match setting: tough vehicles take half damage, off makes them indestructible', () => {
    const hit = (vehicleDamage: 'normal' | 'tough' | 'off') => {
      const match = new Match(yard([mount('buggy', 10, 10), mount('turret_mg', 20, 10)]), { ...rules, vehicleDamage });
      new Driver(match).run(2);
      const [m, turret] = internals(match).mounts;
      internals(match).damageMount(m!, 100, null);
      internals(match).damageMount(turret!, 100, null);
      return { vehicle: m!.def.health - m!.health, turret: turret!.def.health - turret!.health };
    };
    expect(hit('normal')).toEqual({ vehicle: 100, turret: 100 });
    expect(hit('tough')).toEqual({ vehicle: 50, turret: 100 });
    expect(hit('off')).toEqual({ vehicle: 0, turret: 100 });
  });
});
