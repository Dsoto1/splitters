// Jump pads flown by a player's body (sim/padFlight.ts): validate-map's and MapMaker's `pad.flight` warning.
import { beforeAll, describe, expect, it } from 'vitest';
import { PhysicsWorld, buildMapGeometry, initPhysics, mapPads, padLandings, type MapDocument } from '../src/index.ts';
import { PAD_MISS_M, flyPads, initNavigation, padFlightIssues, validateMapNavigation, validateMapPlay, type PadFlight } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

/** Open yard tiles, 3 × 3 (x and z from -4 to 20), floor at 0, with a pad at 2, 10 that throws along +x. */
const padYard = (): MapDocument => {
  const tiles: MapDocument['classicStructure']['tiles'] = [];
  for (let x = 0; x < 3; x++) for (let z = 0; z < 3; z++) tiles.push({ id: `y${x}${z}`, tile: 'core.yard', x, y: z, z: 0, rotation: 0 });
  const map = makeMap(tiles, [[0, 0, 0]]);
  map.entities.push({ id: 'pad1', kind: 'pad', position: [2, 0, 10], yaw: Math.PI / 2, power: 14, push: 6 } as MapDocument['entities'][number]);
  return map;
};
const block = (id: string, center: [number, number], size: [number, number, number], y: number) =>
  ({ id, kind: 'block', position: [center[0], y, center[1]], size, yaw: 0, material: null, behaviour: 'solid', trigger: 'step', delaySeconds: 0.8, respawnSeconds: null, health: 100 }) as MapDocument['entities'][number];

describe('jump pads flown by a body', () => {
  it('a clean pad lands on its prediction: no warning', () => {
    const map = padYard();
    const [f] = flyPads(map);
    expect(f).toMatchObject({ id: 'pad1', alive: true });
    expect(f!.landed!.x - 2).toBeGreaterThan(4);
    expect(f!.miss).toBeLessThan(1);
    expect(padFlightIssues([f!])).toEqual([]);
    expect(validateMapPlay(map, false).issues.filter((i) => i.code === 'pad.flight')).toEqual([]);
  });

  it('a roof beam with a slot on the arc: the thin predicted ray passes it, the body does not, and the pad warns with the miss', () => {
    const map = padYard();
    // A roof with a deep beam across the flight, 1.5 m up, with a 0.3 m slot in it on the arc's line (z 10): a ray
    // along the line goes through the slot; a body 0.7 m wide flies into the beam.
    map.entities.push(block('beam_a', [5, 7.925], [1, 8, 3.85], 1.5), block('beam_b', [5, 12.075], [1, 8, 3.85], 1.5));
    const physics = new PhysicsWorld(buildMapGeometry(map), null);
    const clean = padYard();
    const cleanPhysics = new PhysicsWorld(buildMapGeometry(clean), null);
    const ray = padLandings(mapPads(map.entities), physics)[0]!.end;
    expect(ray.x).toBeCloseTo(padLandings(mapPads(clean.entities), cleanPhysics)[0]!.end.x, 3);
    physics.free();
    cleanPhysics.free();

    const [f] = flyPads(map);
    expect(f!.alive).toBe(true);
    expect(f!.predicted!.x).toBeCloseTo(ray.x, 1);
    expect(f!.miss).toBeGreaterThan(PAD_MISS_M);
    const issues = validateMapPlay(map, false).issues.filter((i) => i.code === 'pad.flight');
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: 'warning', targetId: 'pad1' });
    expect(issues[0]!.message).toContain('jump pad "pad1" (at 2.0, 10.0)');
    expect(issues[0]!.message).toContain(`a player lands ${f!.miss.toFixed(1)} m from its predicted landing`);
    // A warning on an official map too (never an error), and not part of the navigation checks other callers run.
    expect(validateMapPlay(map, true).issues.filter((i) => i.code === 'pad.flight').map((i) => i.severity)).toEqual(['warning']);
    expect(validateMapNavigation(map, true).issues.filter((i) => i.code === 'pad.flight')).toEqual([]);
  });

  it('words each kind of miss', () => {
    const base: PadFlight = { id: 'p', pad: { x: 1, y: 0, z: 2 }, predicted: { x: 9, y: 0, z: 2 }, landed: { x: 9, y: 0, z: 2 }, alive: true, miss: 0, height: 0 };
    const said = (f: Partial<PadFlight>) => padFlightIssues([{ ...base, ...f }])[0]?.message ?? '';
    expect(said({})).toBe('');
    expect(said({ miss: 2.4 })).toBe('');
    expect(said({ miss: 14.04, landed: { x: -5, y: 0, z: 2 } })).toMatch(/lands 14\.0 m from its predicted landing \(at -5\.0, 2\.0, predicted 9\.0, 2\.0\)/);
    expect(said({ height: 3.2, landed: { x: 9, y: 3.2, z: 2 } })).toMatch(/lands 3\.2 m above its predicted landing/);
    expect(said({ alive: false, landed: null, miss: Infinity })).toMatch(/dies before landing/);
    expect(said({ landed: null, miss: Infinity })).toMatch(/not thrown and back on the ground within 10 s/);
    expect(said({ predicted: null, miss: Infinity })).toMatch(/comes down nowhere/);
    expect(padFlightIssues([{ ...base, miss: 3 }])[0]).toMatchObject({ severity: 'warning', code: 'pad.flight', targetId: 'p' });
  });

  it('a map without pads flies nothing', () => {
    const map = padYard();
    map.entities = map.entities.filter((e) => e.kind !== 'pad');
    expect(flyPads(map)).toEqual([]);
  });
});
