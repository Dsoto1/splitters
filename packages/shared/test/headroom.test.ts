// MapMaker's headroom check (map/headroom.ts; owner, 2026-11-18/19): stairs and ramps too low to walk standing, for
// the tallest body (Flavius Rule's gate stair wells had 2.5 m over their middle steps: a large character crouched).
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BODY_SIZES, PLAYER, STAIR_HEADROOM, builtInSetPieces, expandSetPieces, headroomIssues, loadMap, lowHeadroom, rampHeadroom, serializeMap, shapeChecks, type MapDocument, type MapEntity } from '../src/index.ts';

const library = builtInSetPieces();
/** A map as MapMaker checks it: as made (`forEditing`), its set pieces expanded, naming their parts' placements. */
function asMapMaker(json: string): { view: MapDocument; partOf: ReadonlyMap<string, string> } {
  const r = loadMap(json, undefined, { forEditing: true });
  if (!r.ok) throw new Error(r.issues.map((i) => i.message).join('; '));
  const x = expandSetPieces(r.map, library);
  return { view: x.map, partOf: x.partOf };
}
import { makeMap } from './helpers.ts';

const block = (id: string, position: [number, number, number], size: [number, number, number], tilt: { pitch?: number; roll?: number } = {}): MapEntity =>
  ({ id, kind: 'block', position, size, yaw: 0, material: 'core.concrete', tint: null, behaviour: 'solid', trigger: 'step', delaySeconds: 0.8, respawnSeconds: 8, health: 120, ...tilt }) as MapEntity;

/** Open stairs (one level up, climbing east: 16 steps of 0.25 by 0.5 m from x -4) and what else is given. */
function stairs(...more: MapEntity[]): MapDocument {
  const map = makeMap([{ id: 'st', tile: 'core.stairs_open', x: 0, y: 0, z: 0, rotation: 0 }], [[-8, 0, 0]]);
  return { ...map, entities: [...map.entities, ...more] };
}
/** A slab over the flight's middle (x -1 to 1), its underside `at` m up. */
const slab = (at: number) => block('slab', [0, at, 0], [2, 0.3, 4]);

describe('stair headroom', () => {
  it('needs the tallest body plus two risers over a step (2.62 m), and its height plus its reach up a ramp', () => {
    expect(STAIR_HEADROOM).toBeCloseTo(BODY_SIZES.large.scale * PLAYER.height + 0.5, 6);
    expect(STAIR_HEADROOM).toBeGreaterThan(2.6);
    expect(rampHeadroom(0)).toBeCloseTo(BODY_SIZES.large.scale * PLAYER.height, 6);
    expect(rampHeadroom(0.3)).toBeGreaterThan(rampHeadroom(0.1));
  });

  it('open stairs alone have room to stand', () => {
    expect(lowHeadroom(stairs())).toEqual([]);
    expect(headroomIssues(stairs())).toEqual([]);
  });

  it('a slab low over the flight is flagged once, on the stairs, with its clear height and what it needs', () => {
    // The flight's middle steps top out at 1.75 to 2.5 m: a slab from 3.2 m leaves 0.7 to 1.45 m there.
    const map = stairs(slab(3.6));
    const low = lowHeadroom(map);
    expect(low.length).toBeGreaterThan(0);
    expect(low.every((l) => l.over === 'slab' && l.need === STAIR_HEADROOM)).toBe(true);
    const issues = headroomIssues(map);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: 'warning', code: 'stairs.headroom', targetId: 'st' });
    expect(issues[0]!.message).toContain('2.62 m');
  });

  it('2.5 m over the steps (more than standing height, as on Flavius Rule) is flagged; 2.7 m is not', () => {
    expect(headroomIssues(stairs(slab(4.5)))).toHaveLength(1);
    expect(Math.min(...lowHeadroom(stairs(slab(4.5))).map((l) => l.headroom))).toBeGreaterThan(PLAYER.height);
    expect(headroomIssues(stairs(slab(5.2)))).toEqual([]);
    expect(headroomIssues(stairs(slab(6.5)))).toEqual([]);
  });

  it('lower than a crouch is two pieces overlapping, not a way through: left to the other checks', () => {
    expect(headroomIssues(stairs(slab(2.9)))).toEqual([]);
  });

  it('a ramp under a ceiling is measured for its tilt; a tilted rail or plate edge is no ramp', () => {
    const ramp = block('ramp', [0, 0, 0], [3, 0.3, 8], { pitch: 0.2 });
    // Its top runs about -0.5 to 1.4 m along it: a ceiling 3 m up leaves 1.6 m at the high end.
    expect(headroomIssues({ ...makeMap([], [[-8, 0, 0]]), entities: [ramp, block('roof', [0, 3, 0], [4, 0.3, 10])] })).toHaveLength(1);
    expect(headroomIssues({ ...makeMap([], [[-8, 0, 0]]), entities: [ramp, block('roof', [0, 5, 0], [4, 0.3, 10])] })).toEqual([]);
    // A handrail (6 cm wide) tilted along a flight, under the next flight: nothing to walk on.
    const rail = block('rail', [0, 1, 0], [0.06, 0.06, 4], { pitch: 0.5 });
    expect(headroomIssues({ ...makeMap([], [[-8, 0, 0]]), entities: [rail, block('over', [0, 2.6, 0], [2, 0.3, 6])] })).toEqual([]);
  });

  it("a pitched roof's own panels hanging over each other are not flagged", () => {
    // A bandstand's hipped roof: four panels of one set piece, each hanging past its hips over the next.
    const { view, partOf } = asMapMaker(serializeMap({ ...makeMap([], [[-40, 0, 0]]), setPieces: [{ id: 'bstand', piece: 'setpiece.bandstand', x: 0, y: 0, z: 0, rotation: 0, mirror: false, pack: 'urban' }] }));
    expect(view.classicStructure.tiles.length + view.entities.length).toBeGreaterThan(1);
    expect(shapeChecks(view, partOf).issues.filter((i) => i.code === 'stairs.headroom')).toEqual([]);
  });

  it("MapMaker's shape checks carry the warning beside the overlaps", () => {
    const issues = shapeChecks(stairs(slab(4.5)), new Map()).issues;
    expect(issues.filter((i) => i.code === 'stairs.headroom')).toHaveLength(1);
  });

  it('no shipped map has a stair or ramp too low to walk standing', { timeout: 240_000 }, () => {
    const dir = new URL('../../../maps/', import.meta.url);
    const flagged: string[] = [];
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      const { view, partOf } = asMapMaker(readFileSync(new URL(f, dir), 'utf8'));
      for (const i of headroomIssues(view, partOf)) flagged.push(`${f}: ${i.message}`);
    }
    expect(flagged).toEqual([]);
  });
});
