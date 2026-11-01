import { beforeAll, describe, expect, it } from 'vitest';
import {
  CORE_BOT_PROFILES,
  MAP_FORMAT_VERSION,
  PhysicsWorld,
  TICK_RATE,
  ZIP,
  blockBoxes,
  buildMapGeometry,
  cablePoint,
  grabZipline,
  initPhysics,
  loadMap,
  mapTerrainMesh,
  mapZiplines,
  migrateMapDocument,
  navLinks,
  newScenarioEntity,
  oneHanded,
  propBoxes,
  stepMovement,
  validateMap,
  weaponByCode,
  ziplineClearanceIssues,
  type MapDocument,
  type MapEntity,
} from '../src/index.ts';
import { Match, NavWorld, initNavigation, validateNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';
import { block, codes, loaded, start, type Driver } from './kit20.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const USE = 16;
const JUMP = 1;
const EAST = Math.PI / 2;

type ZiplineEntity = Extract<MapEntity, { kind: 'zipline' }>;
const zipline = (extra: Partial<ZiplineEntity> = {}): ZiplineEntity => ({ id: 'zip_main', kind: 'zipline', position: [-14, 4, 0], end: [28, -2, 0], height: 3.6, speed: 12, twoWay: false, sag: 0.03, ...extra });

/**
 * Open ground (a slab, top at y 0) with two towers 22 m apart across it: the
 * west one 4 m high, the east one 2 m. A zipline runs from the top of the
 * west tower down to the east one. Spawns on the ground beside each tower.
 */
function towers(zips: ZiplineEntity[] = [zipline()], extra: MapEntity[] = []): MapDocument {
  const map = makeMap([], [[-14, 4, 2], [14, 2, 2], [0, 0, 12]]);
  map.entities.push(
    block('ground', [0, -0.5, 0], { size: [60, 0.5, 40] }),
    block('tower_w', [-14, 0, 0], { size: [6, 4, 6] }),
    block('tower_e', [14, 0, 0], { size: [6, 2, 6] }),
    // A wall across the middle, 3 m high, so on foot the way round is long.
    block('wall', [0, 0, -4], { size: [1, 3, 32] }),
    ...zips,
    ...extra,
  );
  return map;
}

/** Ride ticks until off the line (or `max` ticks). */
function rideOut(d: Driver, max: number): number {
  let t = 0;
  while (d.me.move.zip !== undefined && t < max) {
    d.input();
    t++;
  }
  return t;
}

describe('ziplines', () => {
  it('E under the start grabs the line; you hang below it, ride to the far end and drop off onto the platform there', () => {
    const d = start(towers());
    d.place(-13, 4, 0, EAST);
    d.input({ buttons: USE });
    const m = d.me.move;
    expect(m.zip).toBe(0);
    expect(m.zv!).toBeGreaterThan(0);
    // Hanging: feet a body length and a hand below the cable.
    const z = mapZiplines(d.match.map.entities)[0]!;
    const cableY = cablePoint(z, m.zs!).y;
    expect(cableY - m.pos.y).toBeCloseTo(1.8 + ZIP.handGap, 1);
    expect(m.grounded).toBe(false);
    // The snapshot carries the rider state compactly.
    const snap = d.match.playerSnapshots().find((s) => s.s === d.me.slot)!;
    expect(snap.zl).toEqual([0, m.zs, m.zv]);
    // 28 m at 6 m/s and more: well within five seconds.
    const ticks = rideOut(d, TICK_RATE * 6);
    expect(ticks).toBeLessThan(TICK_RATE * 5);
    expect(d.me.move.zip).toBeUndefined();
    // Dropped off before the far post, and lands on the east tower.
    d.run(TICK_RATE);
    expect(d.me.move.grounded).toBe(true);
    expect(d.me.move.pos.y).toBeCloseTo(2, 1);
    expect(d.me.move.pos.x).toBeGreaterThan(11);
    expect(d.me.move.pos.x).toBeLessThan(17);
    expect(d.me.health).toBe(100);
  });

  it('runs downhill faster than the set speed, capped at the top speed; uphill (two-way) at the set speed', () => {
    const steep = zipline({ position: [-14, 4, 0], end: [26, -2, 0], height: 4, speed: 8, twoWay: true });
    const d = start(towers([steep]));
    d.place(-13, 4, 0, EAST);
    d.input({ buttons: USE });
    let top = 0;
    for (let i = 0; i < TICK_RATE * 2 && d.me.move.zip !== undefined; i++) {
      d.input();
      top = Math.max(top, Math.abs(d.me.move.zv ?? 0));
    }
    expect(top).toBeGreaterThan(8.5);
    expect(top).toBeLessThanOrEqual(8 * ZIP.topSpeed + 1e-6);
    // Uphill from the low end (on the east tower): the motor holds the set speed.
    d.place(11.5, 2, 0, -EAST);
    d.input({ buttons: USE });
    expect(d.me.move.zip).toBe(0);
    expect(d.me.move.zv!).toBeLessThan(0);
    d.run(TICK_RATE);
    expect(Math.abs(d.me.move.zv!)).toBeCloseTo(8, 3);
  });

  it('one-way lines only go from start to end; two-way lines take you away from the end you grab', () => {
    const oneWay = mapZiplines([zipline()]);
    const z = oneWay[0]!;
    const nearEnd = { x: z.b.x - z.dir.x * 1.6, y: z.b.y - 3.5, z: 0 };
    expect(grabZipline(oneWay, nearEnd, -EAST, null)).toBeNull();
    // Mid-line facing back the way: a one-way line still goes forward.
    const mid = { x: 0, y: (z.a.y + z.b.y) / 2 - 3, z: 0.5 };
    expect(grabZipline(oneWay, mid, -EAST, null)?.sign).toBe(1);
    const twoWay = mapZiplines([zipline({ twoWay: true })]);
    expect(grabZipline(twoWay, nearEnd, EAST, null)?.sign).toBe(-1);
    expect(grabZipline(twoWay, mid, -EAST, null)?.sign).toBe(-1);
    expect(grabZipline(twoWay, mid, EAST, null)?.sign).toBe(1);
    // Out of reach: too far to the side, or too far below.
    expect(grabZipline(twoWay, { ...mid, z: 3 }, EAST, null)).toBeNull();
    expect(grabZipline(twoWay, { ...mid, y: mid.y - 3 }, EAST, null)).toBeNull();
  });

  it('a team line takes only its team', () => {
    const zips = mapZiplines([zipline({ team: 'red' })]);
    const at = { x: -13, y: 4, z: 0 };
    expect(grabZipline(zips, at, EAST, 'red')).not.toBeNull();
    expect(grabZipline(zips, at, EAST, 'blue')).toBeNull();
    expect(grabZipline(zips, at, EAST, null)).toBeNull();
  });

  it('jump lets go keeping momentum (and a hop); E lets go too', () => {
    const d = start(towers());
    d.place(-13, 4, 0, EAST);
    d.input({ buttons: USE });
    d.run(TICK_RATE / 2);
    const zv = d.me.move.zv!;
    d.input({ buttons: JUMP });
    expect(d.me.move.zip).toBeUndefined();
    expect(d.me.move.vx!).toBeGreaterThan(zv * 0.9);
    expect(d.me.move.velY).toBeGreaterThan(0);
    // Carried on through the air.
    const x = d.me.move.pos.x;
    d.run(10);
    expect(d.me.move.pos.x - x).toBeGreaterThan(1.5);
    d.place(-13, 4, 0, EAST);
    d.input({ buttons: USE });
    expect(d.me.move.zip).toBe(0);
    d.run(5);
    d.input({ buttons: USE });
    expect(d.me.move.zip).toBeUndefined();
  });

  it('a hard hit knocks a rider off; a graze does not', () => {
    const d = start(towers());
    d.place(-13, 4, 0, EAST);
    d.input({ buttons: USE });
    d.run(5);
    const hurt = (n: number) => (d.match as unknown as { damage(v: unknown, a: number, by: null, w: string): void }).damage(d.me, n, null, 'core.test');
    hurt(10);
    expect(d.me.move.zip).toBe(0);
    hurt(ZIP.knockDamage + 1);
    expect(d.me.move.zip).toBeUndefined();
    expect(d.me.move.vx!).toBeGreaterThan(3);
  });

  it('sidearms and blades fire while riding; two-handed guns do not', () => {
    expect(oneHanded(weaponByCode(1)!)).toBe(true);
    const all = [1, 2, 3, 4, 5].map((c) => weaponByCode(c)!).filter(Boolean);
    expect(all.some((w) => !oneHanded(w))).toBe(true);
    expect(all.filter((w) => w.category === 'pistol').every(oneHanded)).toBe(true);
    expect(all.filter((w) => w.category === 'rifle' || w.category === 'sniper' || w.category === 'shotgun').some(oneHanded)).toBe(false);
  });

  it('the server and a replay from the snapshot agree tick for tick (prediction)', () => {
    const d = start(towers());
    d.place(-13, 4, 0, EAST);
    d.input({ buttons: USE });
    d.run(7);
    const snap = d.match.playerSnapshots().find((s) => s.s === d.me.slot)!;
    // Rebuild the state from the snapshot as the client does, and step it with the same code.
    const zl = snap.zl!;
    const physics = new PhysicsWorld(buildMapGeometry(d.match.map), mapTerrainMesh(d.match.map));
    const collider = physics.createPlayerCollider();
    let state = { pos: { x: snap.p[0], y: snap.p[1], z: snap.p[2] }, velY: snap.vy, grounded: snap.g === 1, zip: zl[0], zs: zl[1], zv: zl[2] };
    const zips = mapZiplines(d.match.map.entities);
    for (let i = 0; i < 20; i++) {
      d.input();
      state = stepAs(physics, collider, state, zips) as typeof state;
      expect(state.pos).toEqual(d.me.move.pos);
      expect(state.zs).toEqual(d.me.move.zs);
    }
    physics.free();
  });

  it('format v25: the Zipline palette entry makes a valid line; old maps load; the validator checks length, slope, clearance and reach', () => {
    expect(MAP_FORMAT_VERSION).toBe(25);
    const v24 = { ...towers([]), formatVersion: 24 };
    expect(migrateMapDocument(v24).doc.formatVersion).toBe(25);
    expect(loadMap(v24).ok).toBe(true);
    const placed = newScenarioEntity('zipline', [-14, 4, 0], EAST) as ZiplineEntity;
    expect(placed.kind).toBe('zipline');
    expect(Math.hypot(...placed.end)).toBeGreaterThan(ZIP.minLength);
    const ok = towers([zipline()]);
    expect(codes(validateMap(loaded(ok))).filter((c) => c.startsWith('zipline'))).toEqual([]);
    const issues = (z: ZiplineEntity) => validateMap(towers([z])).map((i) => i.code);
    expect(issues(zipline({ end: [3, 0, 0] }))).toContain('zipline.short');
    expect(issues(zipline({ end: [10, -12, 0] }))).toContain('zipline.steep');
    // Clearance and reach need the level.
    const clear = (z: ZiplineEntity, more: MapEntity[] = []) => {
      const doc = loaded(towers([z], more));
      const physics = new PhysicsWorld(buildMapGeometry(doc), mapTerrainMesh(doc));
      const out = ziplineClearanceIssues(doc.entities, physics).map((i) => i.code);
      physics.free();
      return out;
    };
    expect(clear(zipline())).toEqual([]);
    // A block right in the way of the cable.
    expect(clear(zipline(), [block('in_way', [0, 4, 0], { size: [2, 4, 2] })])).toContain('zipline.blocked');
    // The cable far out of reach over its start (posts 7 m tall).
    expect(clear(zipline({ height: 8, position: [-14, 0, 8], end: [28, 0, 0] }))).toContain('zipline.out_of_reach');
    // Dropping riders off over nothing (the far end beyond the slab).
    expect(clear(zipline({ end: [60, -2, 0] }))).toContain('zipline.no_landing');
  });

  it('bots: a one-way navmesh link from start to end; they take it when it is the shorter way', () => {
    const doc = loaded(towers([zipline()], [block('wall_n', [-8, 0, -4], { size: [1, 3, 32] })]));
    const geometry = buildMapGeometry(doc);
    const physics = new PhysicsWorld(geometry, mapTerrainMesh(doc));
    const links = navLinks(doc.entities, physics).filter((l) => Math.abs(l.start.x - -13) < 3);
    expect(links).toHaveLength(1);
    expect(links[0]!.end.x).toBeGreaterThan(10);
    const walls = [...geometry, ...propBoxes(doc, true), ...blockBoxes(doc, true)];
    const nav = NavWorld.build(walls, mapTerrainMesh(doc), navLinks(doc.entities, physics));
    const plain = NavWorld.build(walls, mapTerrainMesh(doc), []);
    const from = { x: -14, y: 4, z: 1 };
    const to = { x: 14, y: 2, z: 1 };
    const length = (p: { x: number; y: number; z: number }[] | null) => (p ?? []).reduce((s, q, i, a) => (i ? s + Math.hypot(q.x - a[i - 1]!.x, q.z - a[i - 1]!.z) : 0), 0);
    const ride = nav.findPath(from, to);
    expect(ride).not.toBeNull();
    // On foot there is no way up the east tower at all; the ride is the way.
    expect(plain.findPath(from, to)).toBeNull();
    expect(length(ride)).toBeLessThan(35);
    // One way: coming back doesn't use it.
    const back = nav.findPath(to, from);
    expect(back === null || length(back) > 35).toBe(true);
    expect(validateNavigation(doc, nav, physics).filter((i) => i.code.startsWith('zipline'))).toEqual([]);
    nav.destroy();
    plain.destroy();
    physics.free();
    // A bot on the west tower heading for a gun on the east one rides across.
    const map = towers([zipline()], [block('wall_n', [-8, 0, -4], { size: [1, 3, 32] }), { id: 'gun_e', kind: 'pickup', position: [14, 2, -1], item: 'core.weapon_shotgun', respawnSeconds: null }]);
    const match = new Match(loaded(map), undefined, 5);
    const bot = match.addBot('b', { ...CORE_BOT_PROFILES[0]!, exploration: 100 })!;
    bot.move = { pos: { x: -15, y: 4, z: 1 }, velY: 0, grounded: true };
    let rode = false;
    let reached = false;
    for (let t = 0; t < TICK_RATE * 20 && !reached; t++) {
      match.step();
      if (bot.move.zip !== undefined) rode = true;
      if (bot.alive && bot.move.pos.x > 11 && bot.move.pos.y > 1.5) reached = true;
    }
    expect(rode).toBe(true);
    expect(reached).toBe(true);
  });
});

/** One tick of movement as client prediction runs it (no input). */
function stepAs(physics: PhysicsWorld, collider: ReturnType<PhysicsWorld['createPlayerCollider']>, state: unknown, ziplines: ReturnType<typeof mapZiplines>): unknown {
  return stepMovement(physics, collider, state as never, { seq: 0, forward: 0, right: 0, yaw: EAST, pitch: 0, buttons: 0 }, 1, undefined, 1, { ziplines, scale: 1, gravity: 1 });
}
