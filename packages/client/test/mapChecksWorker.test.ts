// MapMaker's check worker (editor/mapTestWorkerCore.ts): the navigation check answers first, then the jump pads
// flown by a player's body (shared sim/padFlight.ts), whose misses MapChecks lists as warnings like the rest.
import { describe, expect, it } from 'vitest';
import type { MapDocument } from '@tiletrigger/shared';
import { runMapTest, type FromMapTest } from '../src/editor/mapTestWorkerCore.ts';
import { makeMap } from '../../shared/test/helpers.ts';

/** Open yard tiles, 3 × 3, with a pad at 2, 10 that throws along +x. */
const padYard = (): MapDocument => {
  const tiles: MapDocument['classicStructure']['tiles'] = [];
  for (let x = 0; x < 3; x++) for (let z = 0; z < 3; z++) tiles.push({ id: `y${x}${z}`, tile: 'core.yard', x, y: z, z: 0, rotation: 0 });
  const map = makeMap(tiles, [[0, 0, 0]]);
  map.entities.push({ id: 'pad1', kind: 'pad', position: [2, 0, 10], yaw: Math.PI / 2, power: 14, push: 6 } as MapDocument['entities'][number]);
  return map;
};
const beam = (id: string, z: number) =>
  ({ id, kind: 'block', position: [5, 1.5, z], size: [1, 8, 3.85], yaw: 0, material: null, behaviour: 'solid', trigger: 'step', delaySeconds: 0.8, respawnSeconds: null, health: 100 }) as MapDocument['entities'][number];

const check = async (map: MapDocument): Promise<FromMapTest[]> => {
  const got: FromMapTest[] = [];
  await runMapTest({ k: 'nav', map, computed: false, token: 7 }, (m) => got.push(m));
  return got;
};

describe("MapMaker's check worker", () => {
  it('answers the navigation check, then the pads: a clean pad adds no issue', async () => {
    const got = await check(padYard());
    expect(got.map((m) => m.k)).toEqual(['nav', 'pads']);
    expect(got[1]).toEqual({ k: 'pads', token: 7, issues: [] });
  });

  it('a pad whose body flies into a roof beam the predicted ray passes is a warning that names the pad and the miss', async () => {
    const map = padYard();
    // A beam across the flight with a 0.3 m slot on the arc's line: the ray goes through, a body does not.
    map.entities.push(beam('beam_a', 7.925), beam('beam_b', 12.075));
    const got = await check(map);
    expect(got.map((m) => m.k)).toEqual(['nav', 'pads']);
    const pads = got[1] as Extract<FromMapTest, { k: 'pads' }>;
    expect(pads.token).toBe(7);
    expect(pads.issues).toHaveLength(1);
    // (MapChecks draws an issue by its severity and selects `targetId` on a click, as for every other warning.)
    expect(pads.issues[0]).toMatchObject({ severity: 'warning', code: 'pad.flight', targetId: 'pad1' });
    expect(pads.issues[0]!.message).toMatch(/^jump pad "pad1" \(at 2\.0, 10\.0\): a player lands \d+\.\d m from its predicted landing/);
  });
});
