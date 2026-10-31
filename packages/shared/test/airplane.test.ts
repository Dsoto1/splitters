import { beforeAll, describe, expect, it } from 'vitest';
import {
  AIRPLANE_DEF,
  BOT_DIFFICULTIES,
  BUTTON_JUMP,
  BUTTON_USE,
  CORE_BOT_PROFILES,
  DEFAULT_DEATHMATCH_RULES,
  MAP_FORMAT_VERSION,
  PLAYER,
  TICK_RATE,
  DROPSHIP_DROP_DEF,
  airRoute,
  canDrop,
  dropArea,
  dropPlan,
  dropStretchEnds,
  initPhysics,
  newScenarioEntities,
  loadMap,
  migrateMapDocument,
  routePose,
  validateMap,
  type AirplaneEntity,
  type GameEvent,
  type MapDocument,
  type PlayerInput,
} from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

/** An open yard 40 × 32 m (x -4..36, z -4..28) with a plane flying a 24 m square loop 50 m over it. */
function yard(plane: Partial<AirplaneEntity> = {}): MapDocument {
  const tiles = [];
  for (let x = 0; x < 5; x++) for (let y = 0; y < 4; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  const map = makeMap(tiles, [[4, 0, 4], [28, 0, 20]]);
  const e: AirplaneEntity = { id: 'plane_1', kind: 'airplane', position: [16, 0, 12], route: [[-12, -12], [12, -12], [12, 12], [-12, 12]], altitude: 50, loopSeconds: 12, closed: true, airdrop: 'start', ...plane };
  return { ...map, entities: [...map.entities, e] };
}

const rules = { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: TICK_RATE, fallDamage: true };

class Driver {
  private seq = new Map<number, number>();
  constructor(readonly match: Match) {}
  input(c: Combatant, i: Partial<PlayerInput> = {}): void {
    const seq = (this.seq.get(c.slot) ?? 0) + 1;
    this.seq.set(c.slot, seq);
    this.match.queueInputs(c.slot, [{ seq, forward: 0, right: 0, yaw: c.yaw, pitch: c.pitch, buttons: 0, ...i }]);
  }
}

describe('transport plane route', () => {
  it('flies its route by the clock: start, corners, heading and speed', () => {
    const r = airRoute({ position: [16, 0, 12], route: [[-12, -12], [12, -12], [12, 12], [-12, 12]], altitude: 50, loopSeconds: 12, closed: true });
    expect(r.length).toBeCloseTo(96);
    const start = routePose(r, 0);
    expect(start.pos).toEqual({ x: 4, y: 50, z: 0 });
    // First leg runs along +x.
    expect(start.yaw).toBeCloseTo(Math.PI / 2);
    expect(Math.hypot(start.vel.x, start.vel.z)).toBeCloseTo(8);
    // Half a lap later it is at the opposite corner.
    const half = routePose(r, 6 * TICK_RATE);
    expect(half.pos.x).toBeCloseTo(28);
    expect(half.pos.z).toBeCloseTo(24);
    // A whole lap brings it back.
    expect(routePose(r, 12 * TICK_RATE).pos.x).toBeCloseTo(4);
  });
});

describe('air drop', () => {
  it('everyone starts the round in the plane; it carries them round its route', () => {
    const match = new Match(yard(), rules);
    const a = match.addHuman('a')!;
    expect(a.mount).toBeDefined();
    expect(a.move.pos.y).toBeGreaterThan(45);
    const before = { ...a.move.pos };
    const d = new Driver(match);
    for (let i = 0; i < TICK_RATE * 2; i++) {
      d.input(a);
      match.step();
    }
    expect(a.mount).toBeDefined();
    expect(Math.hypot(a.move.pos.x - before.x, a.move.pos.z - before.z)).toBeGreaterThan(10);
    // The plane can't be hurt and its box doesn't block (it is in the snapshot like any mount).
    const snap = match.mountSnapshots().find((m) => m[0] === match.map.entities.findIndex((e) => e.kind === 'airplane'))!;
    expect(snap[7]).toBe(100);
  });

  it('jumping out arms the parachute: it opens on its own and you land unhurt, even with fall damage on', () => {
    const match = new Match(yard(), rules);
    const a = match.addHuman('a')!;
    const d = new Driver(match);
    d.input(a);
    match.step();
    d.input(a, { buttons: BUTTON_JUMP });
    match.step();
    expect(a.mount).toBeUndefined();
    expect(a.move.drop).toBe(true);
    // Carried along by the plane's speed.
    expect(Math.hypot(a.move.vx ?? 0, a.move.vz ?? 0)).toBeGreaterThan(2);
    let opened = false;
    for (let i = 0; i < TICK_RATE * 25 && !(a.move.grounded && opened); i++) {
      d.input(a);
      match.step();
      if (a.move.chute) opened = true;
    }
    expect(opened).toBe(true);
    expect(a.move.grounded).toBe(true);
    expect(a.alive).toBe(true);
    expect(a.health).toBe(PLAYER.maxHealth);
  });

  it('E jumps out too; with "start" only the first spawn of a round is in the plane, with "always" every one is', () => {
    for (const airdrop of ['start', 'always'] as const) {
      const match = new Match(yard({ airdrop }), rules);
      const a = match.addHuman('a')!;
      const d = new Driver(match);
      d.input(a, { buttons: BUTTON_USE });
      match.step();
      expect(a.mount).toBeUndefined();
      // Die (falling without a canopy is fine: just respawn) and come back.
      match.leaveMount(a, false);
      a.health = 1;
      a.move = { pos: { x: 16, y: 30, z: 12 }, velY: -30, grounded: false };
      for (let i = 0; i < TICK_RATE * 6 && a.alive; i++) {
        d.input(a);
        match.step();
      }
      expect(a.alive).toBe(false);
      for (let i = 0; i < TICK_RATE * 2 && !a.alive; i++) {
        d.input(a);
        match.step();
      }
      expect(a.alive).toBe(true);
      expect(!!a.mount).toBe(airdrop === 'always');
    }
  });

  it('without air drop nobody spawns aboard', () => {
    const match = new Match(yard({ airdrop: 'off' }), rules);
    const a = match.addHuman('a')!;
    expect(a.mount).toBeUndefined();
    expect(a.move.pos.y).toBeLessThan(2);
  });

  it('an open route throws out anyone still aboard at its end', () => {
    const match = new Match(yard({ closed: false, route: [[-12, 0], [12, 0]], loopSeconds: 4 }), rules);
    const a = match.addHuman('a')!;
    const d = new Driver(match);
    expect(a.mount).toBeDefined();
    for (let i = 0; i < TICK_RATE * 4 + 2; i++) {
      d.input(a);
      match.step();
    }
    expect(a.mount).toBeUndefined();
    expect(a.move.drop || a.move.chute).toBeTruthy();
  });

  it('bots ride the plane, jump out over their objective and parachute in', () => {
    // Knives only, so nobody is shot out of the sky before the drop.
    const match = new Match(yard({ loopSeconds: 16 }), { ...rules, startingWeapons: ['core.knife'], startingGrenades: 0 });
    const bots = [0, 1, 2].map((i) => match.addBot(`bot${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!, BOT_DIFFICULTIES.normal)!);
    expect(bots.every((b) => b.mount)).toBe(true);
    const chuted = new Set<number>();
    for (let i = 0; i < TICK_RATE * 40; i++) {
      match.step();
      for (const b of bots) if (b.move.chute) chuted.add(b.slot);
      if (bots.every((b) => !b.mount && b.move.grounded)) break;
    }
    expect(bots.every((b) => !b.mount)).toBe(true);
    expect(chuted.size).toBe(bots.length);
    expect(bots.every((b) => b.alive && b.move.pos.y < 3)).toBe(true);
  });
});

describe('airplane map entity', () => {
  it('validates; bad routes and low flights are flagged', () => {
    expect(validateMap(yard()).filter((i) => i.severity !== 'suggestion' && i.code.startsWith('airplane'))).toEqual([]);
    const tight = validateMap(yard({ route: [[0, 0], [4, 0]] }));
    expect(tight.some((i) => i.code === 'airplane.route' && i.severity === 'error')).toBe(true);
    // 15 m up is only 11 m over the yard's walls.
    expect(validateMap(yard({ altitude: 15 })).some((i) => i.code === 'airplane.low')).toBe(true);
    expect(validateMap(yard({ loopSeconds: 600 })).some((i) => i.code === 'airplane.speed')).toBe(true);
  });

  it('round-trips through the loader, and v18 maps migrate to the current format', () => {
    const map = yard();
    const loaded = loadMap(JSON.stringify(map));
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.map.entities.find((e) => e.kind === 'airplane')).toMatchObject({ kind: 'airplane', airdrop: 'start', closed: true });
    const old = { ...map, formatVersion: 18, entities: map.entities.filter((e) => e.kind !== 'airplane') };
    const { doc, fromVersion } = migrateMapDocument(old);
    expect(fromVersion).toBe(18);
    expect(doc.formatVersion).toBe(MAP_FORMAT_VERSION);
    expect(loadMap(JSON.stringify(doc)).ok).toBe(true);
  });

  it('the plane seats 24', () => {
    expect(AIRPLANE_DEF.seats).toHaveLength(24);
    expect(AIRPLANE_DEF.seats.every((s) => s.role === 'passenger')).toBe(true);
  });
});

/** The craft flying the map's drop route (the match keeps its mounts to itself). */
const craftOf = (m: Match) => (m as unknown as { mounts: { route?: unknown; pos: { x: number }; def: unknown }[] }).mounts.find((x) => x.route)!;

/** The yard with a route from far off its west edge, across it (x -4..36) and far off its east edge. */
const runIn = (plane: Partial<AirplaneEntity> = {}) => yard({ closed: false, route: [[-116, 0], [124, 0]], loopSeconds: 24, ...plane });

describe('drop routes in and out of bounds', () => {
  it('the drop plan marks only the stretch over the play area (pure)', () => {
    const r = airRoute({ position: [0, 0, 0], route: [[-100, 0], [100, 0]], altitude: 50, loopSeconds: 20, closed: false });
    const plan = dropPlan(r, (x) => x >= -20 && x <= 20);
    expect(plan.any).toBe(true);
    const tickAt = (x: number) => Math.round(((x + 100) / 200) * 20 * TICK_RATE);
    expect(canDrop(plan, r, tickAt(-60))).toBe(false);
    expect(canDrop(plan, r, tickAt(0))).toBe(true);
    expect(canDrop(plan, r, tickAt(60))).toBe(false);
    // The stretch ends once, at its last good point (within a sample of x = 20).
    const ends = Array.from({ length: 20 * TICK_RATE }, (_, t) => t).filter((t) => dropStretchEnds(plan, r, t));
    expect(ends).toHaveLength(1);
    expect(-100 + (ends[0]! / (20 * TICK_RATE)) * 200).toBeGreaterThan(14);
    expect(-100 + (ends[0]! / (20 * TICK_RATE)) * 200).toBeLessThanOrEqual(20);
    // A route nowhere over good ground lets riders jump anywhere (old maps keep working).
    const none = dropPlan(r, () => false);
    expect(none.any).toBe(false);
    expect(canDrop(none, r, 0)).toBe(true);
  });

  it('the play area is the boundary, else what is built, a little in from the edge', () => {
    const map = yard();
    expect(dropArea(map)).toEqual({ x0: -1, z0: -1, x1: 33, z1: 25 });
    expect(dropArea({ ...map, bounds: { min: [-50, -40], max: [50, 40], style: 'invisible', height: 8 } })).toEqual({ x0: -47, z0: -37, x1: 47, z1: 37 });
  });

  for (const craft of ['plane', 'dropship'] as const) {
    it(`${craft}: a jump outside the map is refused with a hint; over the map it goes`, () => {
      const match = new Match(runIn({ craft }), rules);
      const a = match.addHuman('a')!;
      expect(a.mount).toBeDefined();
      const d = new Driver(match);
      const events: GameEvent[] = [];
      d.input(a);
      events.push(...match.step());
      for (const buttons of [BUTTON_JUMP, BUTTON_USE]) {
        d.input(a, { buttons });
        events.push(...match.step());
        expect(a.mount, 'still aboard off the map').toBeDefined();
      }
      const hints = events.filter((e) => e.e === 'msg' && e.s === a.slot);
      // Told once (not every tick the key is down), and only them.
      expect(hints).toHaveLength(1);
      expect(hints[0]).toMatchObject({ text: expect.stringMatching(/drop zone/) });
      // Ride on until the craft is over the yard, then jump.
      for (let i = 0; i < TICK_RATE * 24 && craftOf(match).pos.x < 14; i++) {
        d.input(a);
        match.step();
      }
      d.input(a, { buttons: BUTTON_JUMP });
      match.step();
      expect(a.mount).toBeUndefined();
      for (let i = 0; i < TICK_RATE * 25 && !a.move.grounded; i++) {
        d.input(a);
        match.step();
      }
      expect(a.alive).toBe(true);
      expect(a.move.pos.x).toBeGreaterThan(-4);
      expect(a.move.pos.x).toBeLessThan(36);
    });

    it(`${craft}: anyone still aboard is dropped at the last good point, and lands in the map`, () => {
      const match = new Match(runIn({ craft }), rules);
      const a = match.addHuman('a')!;
      const d = new Driver(match);
      let outAt: number | null = null;
      for (let i = 0; i < TICK_RATE * 24 && a.mount; i++) {
        d.input(a);
        match.step();
        if (!a.mount) outAt = craftOf(match).pos.x;
      }
      expect(a.mount).toBeUndefined();
      // Out over the yard's far side, well before the route ends 100 m further on.
      expect(outAt).toBeGreaterThan(10);
      expect(outAt).toBeLessThan(40);
      for (let i = 0; i < TICK_RATE * 25 && !a.move.grounded; i++) {
        d.input(a);
        match.step();
      }
      expect(a.alive).toBe(true);
      expect(a.move.pos.x).toBeGreaterThan(-4);
      expect(a.move.pos.x).toBeLessThan(36);
      expect(a.move.pos.y).toBeLessThan(2);
    });

    it(`${craft}: bots jump only over the map and land where they can walk`, () => {
      const match = new Match(runIn({ craft, loopSeconds: 30 }), { ...rules, startingWeapons: ['core.knife'], startingGrenades: 0 });
      const bots = [0, 1, 2].map((i) => match.addBot(`bot${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!, BOT_DIFFICULTIES.normal)!);
      expect(bots.every((b) => b.mount)).toBe(true);
      const jumpedAt = new Map<number, number>();
      for (let i = 0; i < TICK_RATE * 40; i++) {
        match.step();
        for (const b of bots) if (!b.mount && !jumpedAt.has(b.slot)) jumpedAt.set(b.slot, craftOf(match).pos.x);
        if (bots.every((b) => !b.mount && b.move.grounded)) break;
      }
      expect(jumpedAt.size).toBe(bots.length);
      for (const x of jumpedAt.values()) {
        expect(x).toBeGreaterThan(-1);
        expect(x).toBeLessThan(40);
      }
      for (const b of bots) {
        expect(b.alive).toBe(true);
        expect(b.move.pos.y).toBeLessThan(2);
        expect(b.move.pos.x).toBeGreaterThan(-4);
        expect(b.move.pos.x).toBeLessThan(36);
      }
    });
  }

  it('the route starts from its first point when play begins (the loading wait and countdown hold it)', () => {
    const match = new Match(runIn(), rules, 1, { startGate: true });
    const a = match.addHuman('a')!;
    const d = new Driver(match);
    for (let i = 0; i < TICK_RATE * 60 && match.phase !== 'playing'; i++) {
      d.input(a);
      match.step();
    }
    expect(match.phase).toBe('playing');
    d.input(a);
    match.step();
    // Off the yard's west edge (x -100), not wherever the clock had got to.
    expect(craftOf(match).pos.x).toBeLessThan(-95);
    expect(a.mount).toBeDefined();
  });

  it('no jumping out over the void: only over a floor or the terrain', () => {
    // A boundary twice the yard's size: its east half is inside the boundary but has nothing to land on.
    // No ground slab round the built area (a sky map): past the yard is the void.
    const base = runIn();
    const map: MapDocument = { ...base, backdrop: { ...base.backdrop, ground: 'none' } as MapDocument['backdrop'], bounds: { min: [-4, -4] as [number, number], max: [76, 28] as [number, number], style: 'invisible' as const, height: 8 } };
    const match = new Match(map, rules);
    const a = match.addHuman('a')!;
    const d = new Driver(match);
    for (let i = 0; i < TICK_RATE * 24 && craftOf(match).pos.x < 56; i++) {
      d.input(a);
      match.step();
    }
    expect(a.mount).toBeUndefined();
    // Dropped at the yard's edge, not over the empty half.
    expect(a.move.pos.x).toBeLessThan(40);
  });

  it('the dropship is a drop route choice: 12 riders, its own model, the same rules', () => {
    expect(DROPSHIP_DROP_DEF).toMatchObject({ model: 'vehicles/dropship.glb', airplane: true });
    expect(DROPSHIP_DROP_DEF.seats).toHaveLength(12);
    const [e] = newScenarioEntities('airplane:dropship', [0, 0, 0], 0);
    expect(e).toMatchObject({ kind: 'airplane', craft: 'dropship', closed: false });
    const match = new Match(runIn({ craft: 'dropship' }), rules);
    expect(craftOf(match).def).toBe(DROPSHIP_DROP_DEF);
    const loaded = loadMap(JSON.stringify(runIn({ craft: 'dropship' })));
    expect(loaded.ok && loaded.map.entities.find((x) => x.kind === 'airplane')).toMatchObject({ craft: 'dropship' });
  });

  it('routes may run far outside the boundary; one that never crosses the play area is flagged', () => {
    const far = { ...runIn({ route: [[-416, 0], [424, 0]], loopSeconds: 60 }), bounds: { min: [-4, -4] as [number, number], max: [36, 28] as [number, number], style: 'invisible' as const, height: 8 } };
    expect(validateMap(far).filter((i) => i.code.startsWith('airplane') && i.severity !== 'suggestion')).toEqual([]);
    const away = runIn({ route: [[-200, 100], [200, 100]], loopSeconds: 30 });
    expect(validateMap(away).some((i) => i.code === 'airplane.nodrop')).toBe(true);
  });
});
