// Props indoors (map/indoors.ts): under a roof or the floor above all over their footprint, so the client leaves them
// out of the sun's shadow pass. A dorm bay's furniture (between two more) is indoors on both floors; a crate on open ground, one under a
// bridge high overhead, and one at the edge of a roof are not; on St. John's, Smythe Hall's furniture is and its trees
// are not.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { INDOOR_MARGIN, buildMapGeometry, indoorProps, loadMap, newTerrain, serializeMap, type MapDocument, type PropEntity } from '../src/index.ts';
import { makeMap } from './helpers.ts';

const prop = (id: string, model: string, x: number, y: number, z: number): PropEntity => ({ id, kind: 'prop', model, position: [x, y, z], yaw: 0, scale: 1 }) as PropEntity;

function bayMap(extra: PropEntity[]): MapDocument {
  const map = makeMap([{ id: 'home', tile: 'core.room', x: -20, y: -20, z: 0, rotation: 0 }], [[-160, 0, -160]]);
  // Three bays end to end on two floors (a bay's ends are open: the next bay closes them); the middle ones are tested.
  const placements = [0, 1].flatMap((z) => [-1, 0, 1].map((x) => ({ id: x === 0 ? `bay_${z}` : `side_${x + 1}_${z}`, piece: 'setpiece.dorm_bay', x, y: 0, z, rotation: 0 as const, mirror: false, pack: 'collegiate' })));
  const r = loadMap(serializeMap({ ...map, entities: [...map.entities, ...extra], setPieces: placements, terrain: newTerrain(200, 2, [0, 0], 'grass') }));
  if (!r.ok) throw new Error(r.issues.map((i) => i.message).join('; '));
  return r.map;
}

describe('props indoors', () => {
  it("a dorm bay's furniture between two more is indoors on both floors; open ground, the edge of a roof and a high bridge are not", () => {
    const map = bayMap([prop('open', 'kit.crate.wood', 0, 0, 30), prop('edge', 'kit.crate.wood', 0, 8, -4 - INDOOR_MARGIN / 2)]);
    const indoor = indoorProps(map, buildMapGeometry(map));
    const furniture = map.entities.filter((e): e is PropEntity => e.kind === 'prop' && e.id.startsWith('sp_bay_'));
    // (Room furniture paired since St. John's step 4: 20 props a bay, not 36.)
    expect(furniture.length).toBeGreaterThan(36);
    expect(furniture.filter((e) => !indoor(e)).map((e) => `${e.id} ${e.model}`)).toEqual([]);
    const byId = (id: string) => map.entities.find((e) => e.id === id) as PropEntity;
    expect(indoor(byId('open'))).toBe(false);
    // On the roof, half a margin in from its edge: nothing over it.
    expect(indoor(byId('edge'))).toBe(false);
    // Out of doors, the bay's roof 8 m over a crate on the ground beside it is out of reach.
    expect(indoor(prop('beside', 'kit.crate.wood', 0, 0, -6))).toBe(false);
  });

  it("St. John's: Smythe Hall's furniture is indoors, the trees and the street props are not", () => {
    const r = loadMap(readFileSync(new URL('../../../maps/st_johns.json', import.meta.url), 'utf8'));
    if (!r.ok) throw new Error('st_johns');
    const indoor = indoorProps(r.map, buildMapGeometry(r.map));
    const props = r.map.entities.filter((e): e is PropEntity => e.kind === 'prop');
    const smythe = props.filter((e) => e.id.startsWith('sp_') && e.position[0] > 36 && e.position[0] < 60 && e.position[2] > -4 && e.position[2] < 44);
    expect(smythe.length).toBeGreaterThan(150);
    expect(smythe.filter(indoor).length / smythe.length).toBeGreaterThan(0.95);
    const trees = props.filter((e) => e.model.startsWith('env.') || e.model.includes('tree'));
    expect(trees.length).toBeGreaterThan(50);
    expect(trees.filter(indoor).map((e) => e.id)).toEqual([]);
  });
});
