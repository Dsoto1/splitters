import { beforeAll, describe, expect, it } from 'vitest';
import { BUTTON_CROUCH, BUTTON_FIRE, BUTTON_JUMP, TICK_RATE, BUTTON_USE, DEFAULT_DEATHMATCH_RULES, MOUNT_DEFS, PLAYER, initPhysics, validateMap, type GameEvent, type MapDocument, type MapEntity, type PlayerInput } from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const rules = { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000 };

/** An open yard 40 × 32 m (x -4..36, z -4..28) with walls round it, and some mounts. */
function yard(mounts: Omit<Extract<MapEntity, { kind: 'mount' }>, 'id' | 'kind'>[], spawns: [number, number, number][] = [[0, 0, 0]]): MapDocument {
  const tiles = [];
  for (let x = 0; x < 5; x++) for (let y = 0; y < 4; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  const map = makeMap(tiles, spawns);
  return { ...map, entities: [...map.entities, ...mounts.map((m, i) => ({ id: `mount_${i}`, kind: 'mount' as const, ...m }))] };
}

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
/** Press E once (it is sent once per key press), then let go. */
const use = (d: Driver, c: Combatant) => {
  d.run(1, () => d.input(c, { buttons: BUTTON_USE }));
  d.run(1, () => d.input(c, {}));
};

describe('turrets, sentries and vehicles', () => {
  it('loads mount entities and validates', () => {
    const map = yard([{ position: [10, 0, 10], model: 'buggy', yaw: 0, faction: null, respawnSeconds: null }]);
    expect(validateMap(map).filter((i) => i.severity === 'error')).toEqual([]);
    const match = new Match(map, rules);
    expect(match.snapshot([]).mt).toHaveLength(1);
  });

  it('a buggy seats four (driver, gunner, two passengers); a fifth player cannot get in', () => {
    expect(MOUNT_DEFS.buggy.seats).toHaveLength(4);
    expect(MOUNT_DEFS.hauler.seats).toHaveLength(6);
    const match = new Match(yard([{ position: [10, 0, 10], model: 'buggy', yaw: 0, faction: null, respawnSeconds: null }]), rules);
    const d = new Driver(match);
    const players = [0, 1, 2, 3, 4].map((i) => match.addHuman(`p${i}`)!);
    d.run(2);
    players.forEach((p, i) => place(p, 9 + i * 0.4, 8));
    for (const p of players) use(d, p);
    const seats = players.map((p) => p.mount?.seat ?? -1);
    expect(seats.slice(0, 4).sort()).toEqual([0, 1, 2, 3]);
    expect(seats[4]).toBe(-1);
    // The gunner's mounted MG fires and heats up.
    const gunner = players[seats.indexOf(1)]!;
    const ev = d.run(20, () => d.input(gunner, { yaw: 0, pitch: 0, buttons: BUTTON_FIRE }));
    expect(ev.some((e) => e.e === 'shot' && e.w === 'core.mount_mg')).toBe(true);
  });

  it('drives forward, turns, and runs enemies over; getting out puts you beside it', () => {
    const match = new Match(yard([{ position: [4, 0, 4], model: 'kart', yaw: Math.PI / 2, faction: null, respawnSeconds: null }]), rules);
    const d = new Driver(match);
    const a = match.addHuman('a')!;
    const b = match.addHuman('b')!;
    d.run(2);
    place(a, 4, 6);
    place(b, 22, 4);
    use(d, a);
    expect(a.mount).toBeDefined();
    const start = { ...a.move.pos };
    d.run(90, () => {
      d.input(a, { forward: 1 });
      d.input(b, {});
    });
    expect(a.move.pos.x - start.x).toBeGreaterThan(8);
    expect(b.health).toBeLessThan(PLAYER.maxHealth);
    use(d, a);
    expect(a.mount).toBeUndefined();
    d.run(30, () => d.input(a, {}));
    expect(a.move.pos.y).toBeGreaterThan(-0.5);
  });

  it('a skyfighter climbs on jump, holds its height, dives on crouch, and settles when left empty', () => {
    const match = new Match(yard([{ position: [16, 0, 12], model: 'skyfighter', yaw: 0, faction: null, respawnSeconds: null }]), rules);
    const d = new Driver(match);
    const a = match.addHuman('a')!;
    d.run(2);
    place(a, 16, 9);
    use(d, a);
    expect(a.mount).toBeDefined();
    const m = () => match.mountSnapshots()[0]! as number[];
    d.run(60, () => d.input(a, { buttons: BUTTON_JUMP }));
    const up = m()[2]!;
    expect(up).toBeGreaterThan(4);
    d.run(30, () => d.input(a, {}));
    expect(Math.abs(m()[2]! - up)).toBeLessThan(1.5);
    d.run(60, () => d.input(a, { buttons: BUTTON_CROUCH }));
    expect(m()[2]!).toBeLessThan(up - 1.5);
    use(d, a);
    d.run(TICK_RATE * 6, () => d.input(a, {}));
    expect(m()[2]!).toBeLessThan(0.5);
  });

  it('hard turns at speed drift (hovercraft most, the handbrake breaks grip)', () => {
    const slideOf = (model: string, brake: boolean) => {
      const match = new Match(yard([{ position: [4, 0, 2], model: model as 'buggy', yaw: 0, faction: null, respawnSeconds: null }]), rules);
      const d = new Driver(match);
      const me = match.addHuman('me')!;
      d.run(2);
      place(me, 4, 0.5);
      use(d, me);
      expect(me.mount).toBeTruthy();
      d.run(60, () => d.input(me, { forward: 1 }));
      let most = 0;
      d.run(30, () => {
        d.input(me, { forward: 1, right: 1, buttons: brake ? BUTTON_JUMP : 0 });
        most = Math.max(most, Math.abs((match as unknown as { mounts: { slide: number }[] }).mounts[0]!.slide));
      });
      return most;
    };
    const kart = slideOf('kart', false);
    const speeder = slideOf('speeder', false);
    expect(speeder).toBeGreaterThan(kart * 2);
    expect(slideOf('kart', true)).toBeGreaterThan(kart * 1.5);
  });

  it("a turret's aim is held within its arc", () => {
    const match = new Match(yard([{ position: [10, 0, 10], model: 'turret_mg', yaw: 0, faction: null, respawnSeconds: null }]), rules);
    const d = new Driver(match);
    const a = match.addHuman('a')!;
    d.run(2);
    place(a, 10, 9);
    use(d, a);
    expect(a.mount?.seat).toBe(0);
    d.run(3, () => d.input(a, { yaw: Math.PI }));
    expect(Math.abs(a.yaw)).toBeLessThanOrEqual(MOUNT_DEFS.turret_mg.seats[0]!.arc! + 1e-6);
  });

  it('a sentry shoots enemies it can see; destroyed, it comes back later', () => {
    const match = new Match(yard([{ position: [10, 0, 10], model: 'sentry', yaw: 0, faction: null, respawnSeconds: 5 }]), rules);
    const d = new Driver(match);
    const a = match.addHuman('a')!;
    d.run(2);
    place(a, 20, 10);
    d.run(180, () => d.input(a, {}));
    expect(a.health).toBeLessThan(PLAYER.maxHealth);
    // Blow it up with damage, then wait for it to respawn.
    const mt = () => match.snapshot([]).mt![0]!;
    (match as unknown as { damageMount(m: unknown, n: number, by: null): void }).damageMount((match as unknown as { mounts: unknown[] }).mounts[0], 1000, null);
    expect(mt()[8]).toBe(0);
    d.run(5 * 60 + 5);
    expect(mt()[8]).toBe(1);
  });

  it('destroying a vehicle throws its riders out into the blast', () => {
    const match = new Match(yard([{ position: [10, 0, 10], model: 'speeder', yaw: 0, faction: null, respawnSeconds: null }]), rules);
    const d = new Driver(match);
    const a = match.addHuman('a')!;
    d.run(2);
    place(a, 10, 8);
    use(d, a);
    expect(a.mount).toBeDefined();
    (match as unknown as { damageMount(m: unknown, n: number, by: null): void }).damageMount((match as unknown as { mounts: unknown[] }).mounts[0], 1000, null);
    expect(a.mount).toBeUndefined();
    expect(a.health).toBeLessThan(PLAYER.maxHealth);
  });

  it('a jump pad throws you up and along its facing', () => {
    const map = yard([]);
    map.entities.push({ id: 'pad', kind: 'pad', position: [8, 0, 8], yaw: Math.PI / 2, power: 14, push: 8 });
    expect(validateMap(map).filter((i) => i.severity === 'error')).toEqual([]);
    const match = new Match(map, rules);
    const d = new Driver(match);
    const a = match.addHuman('a')!;
    d.run(2);
    place(a, 8, 8);
    let top = 0;
    d.run(90, () => {
      d.input(a, {});
      top = Math.max(top, a.move.pos.y);
    });
    expect(top).toBeGreaterThan(3.5);
    expect(a.move.pos.x).toBeGreaterThan(14);
  });

  it('bots can path through a jump pad up to a ledge they could not walk to', () => {
    const map = yard([]);
    // A platform one level up, reachable only by the pad.
    map.classicStructure.tiles.push({ id: 'ledge', tile: 'core.platform_rail', x: 2, y: 2, z: 1, rotation: 0 });
    map.entities.push({ id: 'pad', kind: 'pad', position: [16, 0, 4], yaw: 0, power: 14, push: 11 });
    const match = new Match(map, rules);
    const path = match.nav.findPath({ x: 24, y: 0, z: 0 }, { x: 16, y: 4, z: 17 });
    expect(path).not.toBeNull();
  });
});
