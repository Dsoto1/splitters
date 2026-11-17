import { beforeAll, describe, expect, it } from 'vitest';
import {
  PhysicsWorld,
  addPortalsCommand,
  buildMapDecor,
  buildMapGeometry,
  closeOpenEndsCommand,
  coreCatalog,
  initPhysics,
  mapGroundBores,
  newMapDocument,
  newTerrain,
  openEnds,
  stepMovement,
  validateMap,
  type MapDocument,
  type Rotation,
  type TilePlacement,
} from '../src/index.ts';

/**
 * Tileset 04 step 7 (docs/map-briefs/tunnels/PLAN_2026-11-13.md, "Step 7 as built"): the cave family, the cave mouth,
 * and the transitions between families.
 */
const JOINTS: Record<string, string[]> = { to_cave: ['concrete', 'brick', 'mine'], to_concrete: ['brick', 'mine'], to_brick: ['mine'] };

function mapOf(tiles: (Partial<TilePlacement> & { tile: string; x: number; y: number })[], hill = 8): MapDocument {
  const doc = newMapDocument('Caves');
  const t = newTerrain(96, 2);
  t.heights.fill(Math.round(hill * 100));
  return { ...doc, terrain: t, entities: [], classicStructure: { ...doc.classicStructure, tiles: tiles.map((p, i) => ({ id: `tile_${i}`, z: 0, rotation: 0 as Rotation, ...p })) } };
}
const drawnSolid = (doc: MapDocument, id = 'tile_0') =>
  [...buildMapGeometry(doc), ...buildMapDecor(doc)].filter((b) => b.sourceId === id && b.kind === 'trim').map((b) => ({ ...b, kind: 'solid' as const }));

beforeAll(async () => {
  await initPhysics();
});

describe('the cave family', () => {
  it('a rock shell drawn inside the clear box: rough (many slabs, two rocks), never in a player\'s way, no fixtures', () => {
    const solids = coreCatalog.get('core.tunnel_cave_straight')!.solids ?? [];
    const rock = solids.filter((b) => b.kind === 'trim' && b.roll !== undefined);
    expect(rock.length).toBeGreaterThan(60);
    expect(new Set(rock.map((b) => b.surface?.material))).toEqual(new Set(['core.pbr_rock', 'core.pbr_jungle_rock']));
    expect(solids.some((b) => b.surface?.material === 'core.lamp_glow')).toBe(false);
    // The same shell as every family: only what is drawn differs.
    const hard = (id: string) => (coreCatalog.get(id)!.solids ?? []).filter((b) => b.kind !== 'trim').map(({ surface: _s, ...b }) => b);
    for (const shape of ['straight', 'curve', 't', 'cross', 'end', 'shaft']) expect(hard(`core.tunnel_cave_${shape}`), shape).toEqual(hard(`core.tunnel_concrete_${shape}`));
    // Down the passage a body's width off the line (and the middle) at ankle, waist and head: nothing drawn.
    for (const shape of ['straight', 'cross', 'end']) {
      const physics = new PhysicsWorld(drawnSolid(mapOf([{ tile: 'core.tunnel_concrete_' + shape, x: 0, y: 0, family: 'cave' }])), null);
      for (const off of [-1.25, 0, 1.25]) for (const y of [0.12, 1, 1.85]) expect(physics.raycastWorld({ x: off, y, z: shape === 'end' ? -3.9 : 0 }, { x: 0, y: 0, z: -1 }, 3.9), `${shape} ${off} ${y}`).toBeNull();
      physics.free();
    }
  });

  it('the chamber: stalactites hung over head height, rubble low along the walls', () => {
    const solids = coreCatalog.get('core.tunnel_cave_chamber')!.solids ?? [];
    const hung = solids.filter((b) => b.kind === 'trim' && b.surface?.material === 'core.pbr_rock' && b.max[1] > 3);
    expect(hung.length).toBeGreaterThan(20);
    expect(Math.min(...solids.filter((b) => b.kind === 'trim' && b.min[1] > 0.5).map((b) => b.min[1]))).toBeGreaterThan(2.15);
    expect(solids.filter((b) => b.kind === 'trim' && b.min[1] === 0 && b.surface?.material === 'core.pbr_jungle_rock' && b.max[1] <= 0.1).length).toBeGreaterThan(10);
  });
});

describe('the cave mouth', () => {
  it('opens the hill like a portal; rock and boulders, no masonry; a player walks out of it', () => {
    const mouth = coreCatalog.get('core.tunnel_cave_collapse')!;
    expect(mouth.familyOf).toMatchObject({ base: mouth.id, family: 'cave' });
    expect(mouth.ports).toEqual(coreCatalog.get('core.tunnel_concrete_portal')!.ports);
    expect(new Set((mouth.solids ?? []).filter((b) => b.kind !== 'trim').map((b) => b.surface?.material))).toEqual(new Set(['core.pbr_rock', 'core.pbr_jungle_rock']));
    const doc = mapOf([{ tile: mouth.id, x: 0, y: 0 }, { tile: 'core.tunnel_concrete_end', x: 0, y: 1, family: 'cave' }]);
    const bores = mapGroundBores(doc);
    expect(bores.openings.length).toBe(1);
    expect(validateMap(doc).filter((i) => i.code === 'tunnel.mouth_buried')).toEqual([]);
    const physics = new PhysicsWorld(buildMapGeometry(doc).filter((b) => b.kind !== 'trim'), null);
    // Rays down the passage at a body's width either side of the line pass the mouth.
    for (const off of [-1.2, 0, 1.2]) for (const y of [0.3, 1.7]) expect(physics.raycastWorld({ x: off, y, z: 8 }, { x: 0, y: 0, z: -1 }, 11.5), `${off} ${y}`).toBeNull();
    const collider = physics.createPlayerCollider();
    let state = { pos: { x: 0, y: 0.05, z: 8 }, velY: 0, grounded: false };
    for (let i = 0; i < 300; i++) state = stepMovement(physics, collider, state, { seq: i, forward: 1, right: 0, yaw: Math.PI, pitch: 0, buttons: 0 });
    expect(state.pos.z).toBeLessThan(-4);
    physics.free();
  });
});

describe('transitions', () => {
  it('each joint comes in the families it names, one shell for all, the south port its own family and the north the joint\'s', () => {
    for (const [shape, fams] of Object.entries(JOINTS)) {
      const base = coreCatalog.get(`core.tunnel_${fams[0]}_${shape}`)!;
      expect(coreCatalog.familiesOf(base.id).map((d) => d.familyOf!.family), shape).toEqual(fams);
      const north = shape.slice(3);
      expect(base.ports, shape).toEqual([{ side: 'N', level: 0, family: north }, { side: 'S', level: 0 }]);
      const hard = (id: string) => (coreCatalog.get(id)!.solids ?? []).filter((b) => b.kind !== 'trim').map(({ surface: _s, ...b }) => b);
      for (const f of fams) {
        expect(hard(`core.tunnel_${f}_${shape}`), `${f} ${shape}`).toEqual(hard(base.id));
        // Its two halves drawn in their families: the south's walls in its own, the north's in the joint's.
        const solids = coreCatalog.get(`core.tunnel_${f}_${shape}`)!.solids ?? [];
        const wallOf = (z: number) => solids.find((b) => b.kind !== 'trim' && b.min[0] >= 1.7 && b.min[2] <= z && b.max[2] >= z)!.surface?.material;
        expect(wallOf(-3), `${f} ${shape} south`).toBe(coreCatalog.get(`core.tunnel_${f}_straight`)!.solids!.find((b) => b.kind !== 'trim' && b.min[0] >= 1.7)!.surface?.material);
        expect(wallOf(3), `${f} ${shape} north`).toBe(coreCatalog.get(`core.tunnel_${north}_straight`)!.solids!.find((b) => b.kind !== 'trim' && b.min[0] >= 1.7)!.surface?.material);
        // Nothing drawn in a player's way through it.
        const physics = new PhysicsWorld(drawnSolid(mapOf([{ tile: `core.tunnel_${fams[0]}_${shape}`, x: 0, y: 0, ...(f === fams[0] ? {} : { family: f }) }])), null);
        for (const off of [-1.2, 0, 1.2]) for (const y of [0.12, 1, 1.85]) expect(physics.raycastWorld({ x: off, y, z: -3.95 }, { x: 0, y: 0, z: 1 }, 7.9), `${f} ${shape} ${off} ${y}`).toBeNull();
        physics.free();
      }
    }
  });

  it('Close open ends and Add a portal draw each end in the family on its side', () => {
    const doc = mapOf([{ tile: 'core.tunnel_concrete_to_cave', x: 0, y: 0, family: 'brick' }]);
    expect(openEnds(doc).map((e) => `${e.side}:${e.family ?? '-'}`).sort()).toEqual(['N:cave', 'S:-']);
    const closed = closeOpenEndsCommand(doc);
    if ('error' in closed) throw new Error(closed.error);
    expect(closed.placed.map((p) => `${p.x},${p.y}:${p.tile}:${p.family ?? '-'}`).sort()).toEqual(['0,-1:core.tunnel_concrete_end:brick', '0,1:core.tunnel_concrete_end:cave']);
    const portals = addPortalsCommand(doc);
    if ('error' in portals) throw new Error(portals.error);
    expect(portals.placed.map((p) => `${p.x},${p.y}:${p.tile}:${p.family ?? '-'}`).sort()).toEqual(['0,-1:core.tunnel_concrete_portal:brick', '0,1:core.tunnel_concrete_portal:cave']);
  });

  it('the mine\'s Bay to Road: the wide road bore to the south, the mine passage to the north; no mismatch either side', () => {
    const bay = coreCatalog.get('core.tunnel_mine_to_road')!;
    expect(bay.ports).toEqual([{ side: 'S', level: 0, bore: 'L', family: 'road' }, { side: 'N', level: 0 }]);
    const hard = (id: string) => (coreCatalog.get(id)!.solids ?? []).filter((b) => b.kind !== 'trim').map(({ surface: _s, ...b }) => b);
    expect(hard(bay.id)).toEqual(hard('core.tunnel_road_reducer'));
    const doc = mapOf([{ tile: 'core.tunnel_road_wide_straight', x: 0, y: -1 }, { tile: bay.id, x: 0, y: 0 }, { tile: 'core.tunnel_concrete_straight', x: 0, y: 1, family: 'mine' }]);
    expect(validateMap(doc).filter((i) => i.code === 'tunnel.profile_mismatch')).toEqual([]);
    const ends = closeOpenEndsCommand(mapOf([{ tile: bay.id, x: 0, y: 0 }]));
    if ('error' in ends) throw new Error(ends.error);
    expect(ends.placed.map((p) => `${p.x},${p.y}:${p.tile}:${p.family ?? '-'}`).sort()).toEqual(['0,-1:core.tunnel_road_wide_end:-', '0,1:core.tunnel_concrete_end:mine']);
  });
});
