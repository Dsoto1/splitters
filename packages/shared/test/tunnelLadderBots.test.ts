import { beforeAll, expect, it } from 'vitest';
import { Match, initNavigation } from '../src/match.ts';
import { CORE_BOT_PROFILES } from '../src/bots/profile.ts';
import { builtInSetPieces, expandSetPieces, initPhysics, newMapDocument, newTerrain, rulesForMode, type MapDocument, type Rotation } from '../src/index.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

/**
 * Tileset 04 step 4: what bots do with the tunnel kit's ladders. A sealed tunnel a level under a flat field (a dead
 * end each side of a Tunnel Shaft set piece): the shaft's ladder is the only way between the tunnel and the field.
 */
function sealed(): MapDocument {
  const doc = newMapDocument('Shaft');
  const t = newTerrain(96, 2);
  const tiles = [
    { id: 'a', tile: 'core.tunnel_concrete_end', x: 0, y: 1, z: -1, rotation: 0 as Rotation },
    { id: 'b', tile: 'core.tunnel_concrete_end', x: 0, y: -1, z: -1, rotation: 2 as Rotation },
  ];
  const placed: MapDocument = {
    ...doc,
    terrain: { ...t, baseY: -0.15 },
    entities: [
      { id: 'sp_a', kind: 'spawn', position: [12, 0, 10], yaw: 0, faction: null },
      { id: 'sp_b', kind: 'spawn', position: [-12, 0, -10], yaw: 0, faction: null },
    ] as MapDocument['entities'],
    classicStructure: { ...doc.classicStructure, tiles },
    setPieces: [{ id: 'piece_shaft', piece: 'setpiece.tunnel_shaft', x: 0, y: 0, z: -1, rotation: 0, mirror: false }],
  };
  return expandSetPieces(placed, builtInSetPieces()).map;
}

type Nav = { findPath(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): { x: number; y: number; z: number }[] | null };

it('bots route up and down a shaft\'s ladder, and a bot at the bottom of a sealed tunnel climbs out to the field', () => {
  const map = sealed();
  const match = new Match(map, { ...rulesForMode(map, 'core.tdm'), scoreLimit: 0, timeLimitSeconds: 0 }, 3);
  const nav = (match as unknown as { nav: Nav }).nav;
  const field = { x: 12, y: -0.15, z: 10 };
  const floor = { x: 0.5, y: -4, z: 8 };
  // The match's navmesh carries the ladder's links: the tunnel and the field are joined both ways, by nothing else.
  const up = nav.findPath(floor, field)!;
  expect(up).not.toBeNull();
  expect(up[up.length - 1]!.y).toBeGreaterThan(-0.5);
  const down = nav.findPath(field, floor)!;
  expect(down).not.toBeNull();
  expect(down[down.length - 1]!.y).toBeLessThan(-3.5);

  const bot = match.addBot('climber', CORE_BOT_PROFILES[0]!)!;
  match.addBot('other', CORE_BOT_PROFILES[1]!);
  for (let i = 0; i < 30; i++) match.step();
  bot.move.pos = { ...floor };
  bot.move.velY = 0;
  // (The other bot comes down the same ladder for it, so the two meet in the hatch: out within the minute and a half all the same.)
  let out = -1;
  for (let i = 0; i < 60 * 90 && out < 0; i++) {
    match.step();
    if (!bot.alive) {
      bot.move.pos = { ...floor };
      continue;
    }
    if (bot.move.grounded && bot.move.pos.y > -0.6) out = i;
  }
  expect(out).toBeGreaterThanOrEqual(0);
}, 240000);
