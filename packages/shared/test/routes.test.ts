import { describe, expect, it } from 'vitest';
import { EncounterEntity, followGuide, pathGeometry, validateMap, vehicleGuides, type MapDocument, type MapPath, type Vec3 } from '../src/index.ts';
import { Encounters, type EncounterHost } from '../src/sim/encounters.ts';
import { makeMap } from './helpers.ts';

/** An east-west road along z = 0, from x = -100 to x = 100, 8 m wide. */
function road(o: Partial<MapPath> = {}): MapPath {
  return { id: 'road', points: [[-100, 0, 0], [0, 0, 0], [100, 0, 0]], closed: false, uses: ['road'], width: 8, style: 'asphalt', lay: true, ...o };
}
const EAST = Math.PI / 2;
const WEST = -Math.PI / 2;
const at = (x: number, z: number): Vec3 => ({ x, y: 0, z });

describe('vehicle bots follow routes and roads', () => {
  it('only drivable lines guide: routes always, roads wide enough for a vehicle', () => {
    const guides = vehicleGuides([road(), road({ id: 'walk', width: 2 }), road({ id: 'route', uses: ['route'], width: 1 })]);
    expect(guides.map((g) => g.line.track.width)).toEqual([8, 1]);
  });

  it('steers at a point ahead along the road, on its right-hand half, the way the goal lies', () => {
    const guides = vehicleGuides([road()]);
    const east = followGuide(guides, at(-60, 1), EAST, at(90, 5), 10)!;
    // Ahead of the car, on the road, in the lane right of the way east (-z).
    expect(east.aim.x).toBeGreaterThan(-60 + 10);
    expect(east.aim.z).toBeCloseTo(-2, 1);
    const west = followGuide(guides, at(60, -1), WEST, at(-90, 0), 10)!;
    expect(west.aim.x).toBeLessThan(60 - 10);
    expect(west.aim.z).toBeCloseTo(2, 1);
    // The faster it goes, the further ahead it looks.
    expect(followGuide(guides, at(-60, 1), EAST, at(90, 5), 30)!.aim.x).toBeGreaterThan(east.aim.x + 5);
  });

  it('leaves the road when it doesn\'t run the goal\'s way, when the goal is close, or when the road is far', () => {
    const guides = vehicleGuides([road()]);
    // The goal lies off to the side: driving along the road doesn't bring it much closer.
    expect(followGuide(guides, at(0, 0), EAST, at(5, 150), 10)).toBeNull();
    expect(followGuide(guides, at(0, 0), EAST, at(20, 0), 10)).toBeNull();
    expect(followGuide(guides, at(0, 40), EAST, at(90, 40), 10)).toBeNull();
    expect(followGuide([], at(0, 0), EAST, at(90, 0), 10)).toBeNull();
  });

  it('never drives a one-way path backwards, and passes on its speed hint', () => {
    const oneWay = vehicleGuides([road({ oneWay: true, speed: 12 })]);
    expect(followGuide(oneWay, at(60, 0), WEST, at(-90, 0), 10)).toBeNull();
    const go = followGuide(oneWay, at(-60, 0), EAST, at(90, 0), 10)!;
    expect(go.speed).toBe(12);
    // One-way: the middle of the road, no lane.
    expect(go.aim.z).toBeCloseTo(0, 6);
  });

  it('follows a closed route round the join', () => {
    const ring: MapPath = { id: 'ring', points: [[0, 0, -40], [40, 0, 0], [0, 0, 40], [-40, 0, 0]], closed: true, uses: ['route'], width: 3, style: 'dirt', lay: false, oneWay: true };
    const g = pathGeometry(ring);
    // Just before the end of the loop (the last point back to the first), heading for a goal past the start.
    const p = g.at(g.length - 4);
    const aim = followGuide(vehicleGuides([ring]), { x: p.x, y: 0, z: p.z }, Math.atan2(p.dx, p.dz), at(60, -10), 5)!;
    const s = g.nearest(aim.aim.x, aim.aim.z)!.sample.s;
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(20);
  });
});

/** Encounters with one patrol squad of `n` on `path`, members moved by hand. */
function patrol(path: MapPath, n = 1) {
  const e = EncounterEntity.parse({ id: 'squad', kind: 'encounter', position: [path.points[0]![0], 0, path.points[0]![2]], roster: { trooper: n, gunner: 0, heavy: 0 }, activeCap: n, order: 'patrol', route: path.id });
  const map: MapDocument = { ...makeMap([]), entities: [e], paths: [path] };
  const npcs = new Map<number, { alive: boolean; pos: Vec3; brain: never }>();
  const host: EncounterHost = {
    tick: 0,
    nav: { closestPoint: (p: Vec3) => p, places: () => [] } as unknown as EncounterHost['nav'],
    players: () => [],
    hostiles: () => [],
    spawnNpc: (_e, _r, pos) => {
      const id = 100 + npcs.size;
      npcs.set(id, { alive: true, pos: { ...pos }, brain: {} as never });
      return id;
    },
    npc: (id) => npcs.get(id),
    entityPos: () => undefined,
    fire: () => {},
    random: () => 0,
  };
  const enc = new Encounters(map, host);
  for (let i = 0; i < n; i++) {
    enc.step();
    (host as { tick: number }).tick++;
  }
  /** Walk member `id` toward its goal for `steps` thinks, 1.5 m at a time; the arc lengths it reached. */
  const walk = (id: number, steps: number): number[] => {
    const g = pathGeometry(path);
    const out: number[] = [];
    for (let i = 0; i < steps; i++) {
      const me = npcs.get(id)!;
      const goal = enc.goalFor(id)!;
      const d = Math.hypot(goal.pos.x - me.pos.x, goal.pos.z - me.pos.z);
      const k = Math.min(1, 1.5 / Math.max(d, 1e-6));
      me.pos = { x: me.pos.x + (goal.pos.x - me.pos.x) * k, y: 0, z: me.pos.z + (goal.pos.z - me.pos.z) * k };
      out.push(g.nearest(me.pos.x, me.pos.z, 1e5)!.sample.s);
    }
    return out;
  };
  return { enc, npcs, walk };
}

describe('NPC squads patrol routes', () => {
  const square: MapPath = { id: 'beat', points: [[0, 0, 0], [30, 0, 0], [30, 0, 30], [0, 0, 30]], closed: true, uses: ['route'], width: 3, style: 'dirt', lay: false };

  it('walk round a closed route, again and again, in its direction', () => {
    const { walk, enc } = patrol(square);
    expect(enc.roaming(100)).toBe(true);
    const s = walk(100, 200);
    const len = pathGeometry(square).length;
    // Laps: s comes back round past the start more than once, moving forwards between wraps.
    let wraps = 0;
    for (let i = 1; i < s.length; i++) {
      if (s[i]! < s[i - 1]! - len / 2) wraps++;
      else expect(s[i]!).toBeGreaterThanOrEqual(s[i - 1]! - 0.5);
    }
    expect(wraps).toBeGreaterThanOrEqual(2);
  });

  it('walk an open route there and back, turning at its ends', () => {
    const open = { ...square, closed: false };
    const len = pathGeometry(open).length;
    const s = patrol(open).walk(100, 160);
    const max = Math.max(...s);
    const turn = s.indexOf(max);
    expect(max).toBeGreaterThan(len - 4);
    // After the far end they come back down to the start.
    expect(Math.min(...s.slice(turn))).toBeLessThan(4);
  });

  it('a one-way open route is walked round: back to the start from the end, never backwards along it', () => {
    const s = patrol({ ...square, closed: false, oneWay: true }).walk(100, 200);
    const len = pathGeometry(square).length;
    expect(Math.max(...s)).toBeGreaterThan(len * 0.6);
  });

  it('the validator wants a route that exists (or a target) for a patrol', () => {
    const e = EncounterEntity.parse({ id: 'squad', kind: 'encounter', position: [0, 0, 0], order: 'patrol', route: 'nope' });
    const codes = (m: MapDocument) => validateMap(m).map((i) => i.code);
    expect(codes({ ...makeMap([]), entities: [e] })).toEqual(expect.arrayContaining(['encounter.route', 'encounter.target']));
    const ok = codes({ ...makeMap([]), entities: [{ ...e, route: 'beat' }], paths: [square] });
    expect(ok).not.toContain('encounter.route');
    expect(ok).not.toContain('encounter.target');
  });
});
