import { beforeAll, describe, expect, it } from 'vitest';
import { EditHistory, applyCommand, buildMapGeometry, initPhysics, rulesForMap, transformCommand, type EditCommand, type MapDocument } from '../src/index.ts';
import { Match, initNavigation } from '../src/match.ts';
import { block, twoRooms } from './kit20.ts';

/**
 * MapMaker UI Phase 5 (MAPMAKER_UI_SPEC §10, "collision/pathing updates"; §11 "Collision and relevant derived systems
 * update after geometry changes"): an edit made in MapMaker (the shared transform command, as a drag, a nudge, Tile
 * View or a typed field makes it) changes what the game builds from the map: its geometry, the physics shots and
 * bodies hit, and the bots' navmesh; undo puts all three back exactly.
 */

const cmd = (c: EditCommand | { error: string }): EditCommand => {
  if ('error' in c) throw new Error(c.error);
  return c;
};

/** A pillar 1 × 3 × 1 m standing in the first room. */
const pillarMap = (): MapDocument => twoRooms([block('pillar_1', [0, 0, 2], { size: [1, 3, 1] })]);

/** What the game builds from the map: the pillar's box, a shot across each of two lines, the floor under each spot. */
function built(map: MapDocument) {
  const box = buildMapGeometry(map).find((b) => b.sourceId === 'pillar_1');
  const match = new Match(map, rulesForMap(map), 1);
  const shot = (z: number) => match.physics.lineOfSight({ x: -3, y: 1.2, z }, { x: 3, y: 1.2, z });
  const floor = (z: number) => !!match.nav.closestPoint({ x: 0, y: 0.1, z }, { x: 0.2, y: 0.5, z: 0.2 });
  const r = { box: box ? { min: box.min.map((v) => +v.toFixed(3)), max: box.max.map((v) => +v.toFixed(3)) } : null, shotAt2: shot(2), shotAtMinus1: shot(-1), floorAt2: floor(2), floorAtMinus1: floor(-1) };
  match.destroy();
  return r;
}

describe('an edit in MapMaker reaches collision and pathing', () => {
  beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

  it('moving a pillar moves its box, what it blocks and where bots walk; undo puts them back', () => {
    const doc = pillarMap();
    const before = built(doc);
    expect(before.box).toEqual({ min: [-0.5, 0, 1.5], max: [0.5, 3, 2.5] });
    expect(before).toMatchObject({ shotAt2: false, shotAtMinus1: true, floorAt2: false, floorAtMinus1: true });

    const history = new EditHistory(doc);
    history.execute('Move', cmd(transformCommand(history.doc, { tiles: [], entities: ['pillar_1'] }, { by: { metres: [0, 0, -3] } })));
    const after = built(history.doc);
    expect(after.box).toEqual({ min: [-0.5, 0, -1.5], max: [0.5, 3, -0.5] });
    expect(after).toMatchObject({ shotAt2: true, shotAtMinus1: false, floorAt2: true, floorAtMinus1: false });

    history.undo();
    expect(built(history.doc)).toEqual(before);
  });

  it('a typed Height lifts the pillar off the floor: shots under it pass, its old footprint walks again', () => {
    const doc = pillarMap();
    const lifted = applyCommand(doc, cmd(transformCommand(doc, { tiles: [], entities: ['pillar_1'] }, { set: { id: 'pillar_1', axis: 1, value: 2.4 } })));
    const r = built(lifted);
    expect(r.box).toEqual({ min: [-0.5, 2.4, 1.5], max: [0.5, 5.4, 2.5] });
    expect(r.shotAt2).toBe(true);
    expect(r.floorAt2).toBe(true);
  });
});
