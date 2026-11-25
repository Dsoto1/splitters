import { beforeAll, describe, expect, it } from 'vitest';
import {
  MAP_FORMAT_VERSION,
  PhysicsWorld,
  applyCommand,
  buildMapDecor,
  buildMapGeometry,
  builtInSetPieces,
  closeOpenEndsCommand,
  connectedRun,
  connectedRunPieces,
  coreCatalog,
  expandSetPieces,
  initPhysics,
  invertCommand,
  loadMap,
  mapGroundBores,
  newMapDocument,
  newTerrain,
  openEnds,
  serializeMap,
  setPieceFamilies,
  setPieceFamilyCommand,
  setRunFamilyCommand,
  stepMovement,
  validateMap,
  type MapDocument,
  type Rotation,
  type SetPiecePlacement,
  type TilePlacement,
} from '../src/index.ts';

/**
 * Tileset 04 step 5 (docs/map-briefs/tunnels/PLAN_2026-11-13.md, "Step 5 as built"): the brick sewer and mine families
 * on every shape, the barred outfall, a placed set piece's `family` (map format v44), "Close open ends", and the Lit
 * Tunnel Chamber.
 */
const FAMILIES = ['concrete', 'brick', 'mine', 'cave'];
const MODULES: Record<string, string[]> = { straight: ['N', 'S'], curve: ['S', 'E'], t: ['E', 'W', 'S'], cross: ['N', 'E', 'S', 'W'], end: ['S'], portal: ['N'], outfall: ['N'], shaft: ['N', 'S'] };
const DIRS: Record<string, [number, number]> = { N: [0, 1], E: [1, 0], S: [0, -1], W: [-1, 0] };

function mapOf(tiles: (Partial<TilePlacement> & { tile: string; x: number; y: number })[], hill = 8, pieces: SetPiecePlacement[] = []): MapDocument {
  const doc = newMapDocument('Tunnels');
  const t = newTerrain(96, 2);
  t.heights.fill(Math.round(hill * 100));
  return {
    ...doc,
    terrain: t,
    entities: [],
    classicStructure: { ...doc.classicStructure, tiles: tiles.map((p, i) => ({ id: `tile_${i}`, z: 0, rotation: 0 as Rotation, ...p })) },
    ...(pieces.length ? { setPieces: pieces } : {}),
  };
}
const piece = (id: string, kind: string, x: number, y: number, extra: Partial<SetPiecePlacement> = {}): SetPiecePlacement => ({ id, piece: kind, x, y, z: 0, rotation: 0, mirror: false, ...extra });

beforeAll(async () => {
  await initPhysics();
});

describe('the brick sewer and mine families', () => {
  it('every module in every family: what is drawn stays out of a player\'s way (above head height, on the floor, or a hand off the walls)', () => {
    for (const family of FAMILIES) {
      for (const [shape, arms] of Object.entries(MODULES)) {
        const doc = mapOf([{ tile: `core.tunnel_concrete_${shape}`, x: 0, y: 0, ...(family === 'concrete' ? {} : { family }) }]);
        // Everything drawn in the piece made solid: a player's walk down each arm (the middle line and 1.3 m either side,
        // a body's width short of the walls) at ankle, waist and head height meets none of it.
        const drawn = [...buildMapGeometry(doc), ...buildMapDecor(doc)].filter((b) => b.sourceId === 'tile_0' && b.kind === 'trim').map((b) => ({ ...b, kind: 'solid' as const }));
        expect(drawn.length, `${family} ${shape}`).toBeGreaterThan(0);
        const physics = new PhysicsWorld(drawn, null);
        for (const side of arms) {
          const [dx, dz] = DIRS[side]!;
          for (const off of [-1.3, 0, 1.3]) {
            for (const y of [0.1, 1, 1.9]) {
              const from = { x: -dz * off, y, z: dx * off };
              expect(physics.raycastWorld(from, { x: dx, y: 0, z: dz }, 4), `${family} ${shape} ${side} ${off} ${y}`).toBeNull();
            }
          }
        }
        physics.free();
      }
    }
  });

  it('brick: a round arch inside the clear box, a water channel between kerbs (drawn, never a liquid) and a lantern; mine: timber sets, lagging and a track', () => {
    const solidsOf = (id: string) => coreCatalog.get(id)!.solids ?? [];
    const brick = solidsOf('core.tunnel_brick_straight');
    // The arch: slabs rolled to the curve from springing to crown, in the walls' brick. No ring of the trim stone at the
    // straight's ends (the next piece's arch runs on: seamless tunnels); a junction shows its arches' rings.
    const arch = brick.filter((b) => b.roll && b.surface?.material === 'core.pbr_brick_old');
    expect(arch.length).toBeGreaterThanOrEqual(9);
    expect(Math.min(...arch.map((b) => b.min[1]))).toBeGreaterThan(1.9);
    expect(brick.some((b) => b.roll && b.surface?.material === 'core.pbr_castle_stone')).toBe(false);
    expect(solidsOf('core.tunnel_brick_t').some((b) => b.roll && b.surface?.material === 'core.pbr_castle_stone')).toBe(true);
    // The water: a surface a hand over the floor, glossy and dark; kerbs either side; a grate.
    expect(brick.filter((b) => b.surface?.material === 'core.paint_gloss').every((b) => b.max[1] <= 0.03)).toBe(true);
    expect(brick.some((b) => b.surface?.material === 'core.grate')).toBe(true);
    expect(brick.some((b) => b.surface?.material === 'core.lamp_glow' && b.min[1] > 2.4)).toBe(true);
    // No liquid: a brick sewer under a hill is no flooded tunnel.
    expect(validateMap(mapOf([{ tile: 'core.tunnel_concrete_straight', x: 0, y: 0, family: 'brick' }])).filter((i) => i.code === 'tunnel.flooded')).toEqual([]);
    const mine = solidsOf('core.tunnel_mine_straight');
    // Sets every 2 m (four a module: posts either side and a cap beam), lagging boards over them, rails on sleepers.
    const posts = mine.filter((b) => b.surface?.material === 'core.oak_beam' && b.max[1] - b.min[1] > 3);
    expect(posts.length).toBe(8);
    expect(posts.every((b) => Math.min(Math.abs(b.min[0]), Math.abs(b.max[0])) >= 1.67)).toBe(true);
    expect(mine.filter((b) => b.surface?.material === 'core.pbr_weathered_planks').length).toBe(5 * 3);
    expect(mine.filter((b) => b.surface?.material === 'core.pbr_steel' && b.max[1] <= 0.07).length).toBeGreaterThanOrEqual(4);
    expect(new Set(mine.filter((b) => b.kind !== 'trim').map((b) => b.surface?.material))).toEqual(new Set(['core.pbr_rock']));
  });

  it('the outfall: a portal\'s mouth with iron bars across it that stop players and bots; shots pass between the bars', () => {
    const portal = coreCatalog.get('core.tunnel_concrete_portal')!;
    const outfall = coreCatalog.get('core.tunnel_concrete_outfall')!;
    expect(outfall.bore).toEqual(portal.bore);
    expect(outfall.ports).toEqual(portal.ports);
    const doc = mapOf([{ tile: 'core.tunnel_concrete_outfall', x: 0, y: 0, family: 'brick' }, { tile: 'core.tunnel_concrete_straight', x: 0, y: 1 }]);
    // Ground: it opens the hill like a portal.
    expect(mapGroundBores(doc)).toEqual(mapGroundBores({ ...doc, classicStructure: { ...doc.classicStructure, tiles: doc.classicStructure.tiles.map((t) => (t.id === 'tile_0' ? { ...t, tile: 'core.tunnel_concrete_portal' } : t)) } }));
    const physics = new PhysicsWorld(buildMapGeometry(doc).filter((b) => b.kind !== 'barrier'), null);
    // A shot down the middle of the passage hits a bar at the headwall (bars every 0.2 m: x = 0 is one); one between bars passes.
    expect(physics.raycastWorld({ x: 0, y: 1, z: 6 }, { x: 0, y: 0, z: -1 }, 12)).toBeCloseTo(6, 0);
    expect(physics.raycastWorld({ x: 0.1, y: 1, z: 6 }, { x: 0, y: 0, z: -1 }, 12)).toBeNull();
    // A player walking out of the tunnel stops at the bars.
    const collider = physics.createPlayerCollider();
    let state = { pos: { x: 0, y: 0.05, z: 6 }, velY: 0, grounded: false };
    for (let i = 0; i < 400; i++) state = stepMovement(physics, collider, state, { seq: i, forward: 1, right: 0, yaw: Math.PI, pitch: 0, buttons: 0 });
    expect(state.pos.z).toBeGreaterThan(0);
    expect(state.pos.z).toBeLessThan(0.6);
    physics.free();
  });
});

describe('a set piece\'s family (map format v44)', () => {
  it('the Lit Tunnel Run, Shaft, Riser and Chamber follow the placement\'s family; ladders and lights stay', () => {
    expect(MAP_FORMAT_VERSION).toBeGreaterThanOrEqual(44);
    for (const kind of ['setpiece.tunnel_lit_run', 'setpiece.tunnel_shaft', 'setpiece.tunnel_riser', 'setpiece.tunnel_lit_chamber']) {
      const plain = mapOf([], 8, [piece('piece_a', kind, 0, 0)]);
      const mine = mapOf([], 8, [piece('piece_a', kind, 0, 0, { family: 'mine' })]);
      const a = expandSetPieces(plain, builtInSetPieces()).map;
      const b = expandSetPieces(mine, builtInSetPieces()).map;
      expect(a.classicStructure.tiles.every((t) => !('family' in t)), kind).toBe(true);
      expect(b.classicStructure.tiles.map((t) => t.family), kind).toEqual(a.classicStructure.tiles.map(() => 'mine'));
      expect(b.entities, kind).toEqual(a.entities);
      // The same shell, ground and passage: only what is drawn differs.
      const hard = (m: MapDocument) => buildMapGeometry(m).filter((x) => x.kind !== 'trim').map(({ surface: _s, ...x }) => x);
      expect(hard(b), kind).toEqual(hard(a));
      expect(mapGroundBores(b), kind).toEqual(mapGroundBores(a));
      expect(setPieceFamilies(plain, plain.setPieces![0]!).map((f) => `${f.family}${f.on ? '*' : ''}`), kind).toEqual(['concrete*', 'brick', 'mine', 'cave']);
      expect(setPieceFamilies(mine, mine.setPieces![0]!).find((f) => f.on)!.family, kind).toBe('mine');
    }
    // A piece with no tunnel parts has no families; a family no part comes in changes nothing.
    expect(setPieceFamilies(mapOf([]), piece('piece_b', 'setpiece.cage_block', 0, 0))).toEqual([]);
    const odd = expandSetPieces(mapOf([], 8, [piece('piece_a', 'setpiece.tunnel_lit_run', 0, 0, { family: 'marzipan' })]), builtInSetPieces()).map;
    expect(odd.classicStructure.tiles.every((t) => !('family' in t))).toBe(true);
  });

  it('the format: v44 keeps the field through save and load; a v43 map opens unchanged', () => {
    const doc = mapOf([], 8, [piece('piece_a', 'setpiece.tunnel_lit_run', 0, 0, { family: 'brick' })]);
    const again = loadMap(serializeMap(doc), undefined, { forEditing: true, openWithErrors: true });
    expect(again.ok && again.map.setPieces?.[0]?.family).toBe('brick');
    const plain = mapOf([], 8, [piece('piece_a', 'setpiece.tunnel_lit_run', 0, 0)]);
    const old = loadMap({ ...JSON.parse(serializeMap(plain)), formatVersion: 43 }, undefined, { forEditing: true, openWithErrors: true });
    expect(old.ok).toBe(true);
    if (old.ok) {
      expect(old.migratedFrom).toBe(43);
      expect(old.map.setPieces).toEqual(plain.setPieces);
    }
  });

  it('the Family switch on a set piece, and a whole run through one, in one undo step', () => {
    // A straight, the Lit Tunnel Run north of it, a Tunnel Shaft north of that: one run.
    const doc = mapOf([{ tile: 'core.tunnel_concrete_straight', x: 0, y: -1 }], 8, [piece('piece_run', 'setpiece.tunnel_lit_run', 0, 0), piece('piece_shaft', 'setpiece.tunnel_shaft', 0, 3)]);
    const one = setPieceFamilyCommand(doc, ['piece_shaft'], 'brick');
    if ('error' in one) throw new Error(one.error);
    const after = applyCommand(doc, one);
    expect(after.setPieces!.map((p) => p.family)).toEqual([undefined, 'brick']);
    expect(applyCommand(after, invertCommand(one))).toEqual(doc);
    // Back to its parts' own family: the field goes.
    const back = setPieceFamilyCommand(after, ['piece_shaft'], 'concrete');
    if ('error' in back) throw new Error(back.error);
    expect('family' in applyCommand(after, back).setPieces![1]!).toBe(false);
    expect('error' in setPieceFamilyCommand(doc, ['piece_shaft'], 'concrete')).toBe(true);
    // The whole run from the map's own tile reaches both set pieces.
    expect(connectedRun(doc, ['tile_0'])).toEqual(['tile_0']);
    expect(connectedRunPieces(doc, ['tile_0'])).toEqual(['piece_run', 'piece_shaft']);
    const whole = setRunFamilyCommand(doc, connectedRun(doc, ['tile_0']), connectedRunPieces(doc, ['tile_0']), 'mine');
    if ('error' in whole) throw new Error(whole.error);
    const mined = applyCommand(doc, whole);
    expect(mined.classicStructure.tiles[0]!.family).toBe('mine');
    expect(mined.setPieces!.map((p) => p.family)).toEqual(['mine', 'mine']);
    expect(applyCommand(mined, invertCommand(whole))).toEqual(doc);
  });
});

describe('Close open ends', () => {
  it('a Dead End on each open end, its passage facing back, in the piece\'s family; vaulted ends are left', () => {
    const doc = mapOf([
      { tile: 'core.tunnel_concrete_straight', x: -1, y: 0, rotation: 1, family: 'mine' },
      { tile: 'core.tunnel_concrete_cross', x: 0, y: 0 },
      { tile: 'core.tunnel_vault_buried', x: 1, y: 0, rotation: 1 },
    ]);
    expect(openEnds(doc).map((e) => `${e.tile}:${e.side}`).sort()).toEqual(['tile_0:W', 'tile_1:N', 'tile_1:S', 'tile_2:E']);
    const made = closeOpenEndsCommand(doc);
    if ('error' in made) throw new Error(made.error);
    const placed = Object.fromEntries(made.placed.map((p) => [`${p.x},${p.y}`, p]));
    // Its passage runs south in its own frame: an end west of the run is turned three quarters, north of it two.
    expect(placed['-2,0']).toMatchObject({ tile: 'core.tunnel_concrete_end', family: 'mine', rotation: 3 });
    expect(placed['0,1']).toMatchObject({ tile: 'core.tunnel_concrete_end', rotation: 0 });
    expect(placed['0,-1']).toMatchObject({ tile: 'core.tunnel_concrete_end', rotation: 2 });
    expect('family' in placed['0,1']!).toBe(false);
    expect(placed['2,0']).toBeUndefined();
    const done = applyCommand(doc, made.command);
    expect(openEnds(done).map((e) => `${e.tile}:${e.side}`)).toEqual(['tile_2:E']);
    // Under the hill, no buried mouth is left on the kit pieces.
    expect(validateMap(done).filter((i) => i.code === 'tunnel.mouth_buried').map((i) => i.targetId)).toEqual(['tile_2']);
    expect('error' in closeOpenEndsCommand(done, ['tile_1'])).toBe(true);
  });

  it('the Lit Tunnel Chamber alone: four openings closed in its family, four real lights', () => {
    const doc = mapOf([], 8, [piece('piece_room', 'setpiece.tunnel_lit_chamber', 0, 0, { family: 'brick' })]);
    const built = expandSetPieces(doc, builtInSetPieces()).map;
    expect(built.entities.filter((e) => e.kind === 'light').length).toBe(4);
    const parts = [...expandSetPieces(doc, builtInSetPieces()).partOf.keys()];
    const made = closeOpenEndsCommand(doc, parts);
    if ('error' in made) throw new Error(made.error);
    expect(made.placed.map((p) => `${p.x},${p.y}r${p.rotation}:${p.family}`).sort()).toEqual(['-1,0r3:brick', '0,-1r2:brick', '0,2r0:brick', '2,0r1:brick']);
    expect(openEnds(applyCommand(doc, made.command))).toEqual([]);
  });
});
