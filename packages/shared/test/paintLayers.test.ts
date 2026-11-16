// The painting layers (docs/MAPMAKER_PAINTING_PLAN.md, Phase 2): the warning's counts before a Structure theme change
// (themeChangeImpact), "Keep current look" (keepCurrentLookCommand: today's look pinned as paint, the theme changed,
// one command) leaving every surface drawn exactly as it was, paint surviving every theme, and the cursor's chain
// (surfaceLayer: base theme → set piece look → your paint).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  EditHistory,
  applyCommand,
  buildMapDecor,
  buildMapGeometry,
  builtInSetPieces,
  coreMaterials,
  coreThemes,
  drawnSlots,
  expandSetPieces,
  groundLayerAt,
  impactChanges,
  keepCurrentLookCommand,
  loadMap,
  newTerrain,
  resolveSurface,
  setThemeCommand,
  structurePaintTarget,
  styleKey,
  surfaceLayer,
  themeChangeImpact,
  type MapDocument,
  type MapEntity,
  type SetPiecePlacement,
  type StructureTarget,
  type TilePlacement,
  type WorldBox,
} from '../src/index.ts';
import { makeMap } from './helpers.ts';

const library = builtInSetPieces();
const BRICK = { material: 'core.pbr_brick_old', tint: null };

const block = (id: string, position: [number, number, number], extra: Partial<Extract<MapEntity, { kind: 'block' }>> = {}): MapEntity =>
  ({ id, kind: 'block', position, size: [2, 2, 2], yaw: 0, material: null, tint: null, behaviour: 'solid', trigger: 'step', delaySeconds: 0.8, respawnSeconds: 8, health: 120, ...extra }) as MapEntity;

/** Two rooms (one with painted walls), two blocks (one painted), a Cage Block on the theme's look and one with its own (Military). */
function scene(): MapDocument {
  const map = makeMap(
    [
      { id: 'plain', tile: 'core.room', x: -3, y: 0, z: 0, rotation: 0 },
      { id: 'painted', tile: 'core.room', x: -6, y: 0, z: 0, rotation: 0, surfaces: { walls: BRICK } },
    ],
    [[-60, 0, -60]],
  );
  const pieces: SetPiecePlacement[] = [
    { id: 'cage_theme', piece: 'setpiece.cage_block', x: 2, y: -3, z: 0, rotation: 0, mirror: false },
    { id: 'cage_own', piece: 'setpiece.cage_block', x: 8, y: -3, z: 0, rotation: 0, mirror: false, pack: 'military' },
  ];
  return {
    ...map,
    classicStructure: { ...map.classicStructure, theme: 'core.imperial' },
    entities: [...map.entities, block('blk_plain', [40, 0, 0]), block('blk_painted', [44, 0, 0], { material: 'core.pbr_brick_old' })],
    setPieces: pieces,
  };
}

type Piece = TilePlacement | Extract<MapEntity, { kind: 'block' }>;
const look = (map: MapDocument, piece: Piece, slot: Parameters<typeof resolveSurface>[2]) => {
  if ('tile' in piece) return styleKey(resolveSurface(map, piece, slot));
  const own = piece.material ? coreMaterials.get(piece.material) : undefined;
  return own ? `${own.id}|${piece.tint ?? '-'}` : styleKey(resolveSurface(map, undefined, slot));
};

/**
 * Every surface the map draws, by piece and slot, as the style it resolves to (set pieces expanded), plus each part's
 * facade, glass and door style: what "looks the same" means here.
 */
function drawnLooks(doc: MapDocument): Map<string, string> {
  const map = expandSetPieces(doc, library).map;
  const boxes: WorldBox[] = [...buildMapGeometry(map), ...buildMapDecor(map)];
  const pieces = new Map<string, Piece>([...map.classicStructure.tiles.map((t) => [t.id, t] as const), ...map.entities.filter((e): e is Extract<MapEntity, { kind: 'block' }> => e.kind === 'block' && !e.glass).map((e) => [e.id, e] as const)]);
  const out = new Map<string, string>();
  for (const [id, slots] of drawnSlots(map, boxes)) {
    const piece = pieces.get(id);
    if (piece) for (const slot of slots) out.set(`${id}|${slot}`, look(map, piece, slot));
  }
  for (const t of map.classicStructure.tiles) out.set(`${t.id}|shape`, JSON.stringify([t.options?.facade ?? 'none', t.glass ?? {}]));
  for (const e of map.entities) if (e.kind === 'door') out.set(`${e.id}|door`, e.style ?? 'sliding');
  for (const e of map.entities) if (e.kind === 'block') out.set(`${e.id}|glass`, e.glass ?? '');
  return out;
}

/** The keys whose look differs between two maps (blocks allowed to differ left out). */
function differences(a: Map<string, string>, b: Map<string, string>, allow: readonly string[] = []): string[] {
  const skip = (k: string) => allow.some((id) => k.startsWith(`${id}|`));
  const keys = new Set([...a.keys(), ...b.keys()]);
  return [...keys].filter((k) => !skip(k) && a.get(k) !== b.get(k));
}

/**
 * What a plain theme change really changes, worked out face by face: surfaces that follow the theme itself (a tile
 * slot nothing paints, a block with no material: one each), and the set pieces any of whose surfaces change.
 */
function themedChanges(doc: MapDocument, to: string): { surfaces: number; setPieces: string[] } {
  const before = expandSetPieces(doc, library);
  const changed = differences(drawnLooks(doc), drawnLooks(applyCommand(doc, setThemeCommand(doc, to))));
  const pieces = new Map<string, Piece>([...before.map.classicStructure.tiles.map((t) => [t.id, t] as const), ...before.map.entities.filter((e): e is Extract<MapEntity, { kind: 'block' }> => e.kind === 'block').map((e) => [e.id, e] as const)]);
  let surfaces = 0;
  const blocks = new Set<string>();
  const setPieces = new Set<string>();
  for (const k of changed) {
    const [id, slot] = k.split('|') as [string, string];
    const placement = before.partOf.get(id);
    if (placement) setPieces.add(placement);
    const piece = pieces.get(id);
    if (!piece || slot === 'shape' || slot === 'door' || slot === 'glass') continue;
    if (!('tile' in piece)) {
      if (!piece.material && !blocks.has(id)) {
        blocks.add(id);
        surfaces++;
      }
    } else if (!piece.surfaces?.[slot as 'floor'] && !(slot === 'roof' && piece.surfaces?.floor)) surfaces++;
  }
  return { surfaces, setPieces: [...setPieces].sort() };
}

const loadedCoverage = loadMap(JSON.parse(readFileSync(new URL('../../../maps/test_coverage.json', import.meta.url), 'utf8')));
if (!loadedCoverage.ok) throw new Error('the coverage map loads');
const coverage = loadedCoverage.map;

describe('themeChangeImpact: the warning counts', () => {
  it('counts what follows the theme, what you painted and the set pieces, from Imperial to Industrial', () => {
    const doc = scene();
    const i = themeChangeImpact(doc, library, 'core.industrial');
    expect(i.from).toBe('core.imperial');
    expect(i.to).toBe('core.industrial');
    // The plain room's every drawn slot, the painted room's unpainted ones, and the plain block: they follow the theme.
    const drawn = drawnSlots(expandSetPieces(doc, library).map);
    const roomSlots = drawn.get('plain')!.size;
    expect(drawn.get('painted')!.size).toBe(roomSlots);
    expect(i.changing.pieces.sort()).toEqual(['blk_plain', 'painted', 'plain']);
    // At least every slot of the plain room and the painted room's unpainted ones (the two themes differ in these).
    const differ = [...drawn.get('plain')!].filter((s) => styleKey(resolveSurface(doc, undefined, s)) !== styleKey(resolveSurface({ ...doc, classicStructure: { ...doc.classicStructure, theme: 'core.industrial' } }, undefined, s))).length;
    expect(i.surfacesChange).toBeGreaterThanOrEqual(differ + (differ - 1) + 1);
    // Painted: the room's walls and the painted block.
    expect(i.surfacesPainted).toBe(2);
    // The cage on the theme's look changes with the look; the one with its own look (Military) keeps it (its
    // undersides, which no look gives, follow the theme and count with the surfaces).
    expect(i.changing.setPieces).toContain('cage_theme');
    expect(i.piecesChange).toBe(1);
    expect(i.piecesOwnLook).toBe(1);
    expect(i.skyFollows).toBe(true);
    expect(impactChanges(i)).toBe(i.surfacesChange + 1);
    expect(i.surfacesChange).toBe(themedChanges(doc, 'core.industrial').surfaces);
  });

  it('agrees with what a plain change really changes, surface by surface', () => {
    const doc = scene();
    const i = themeChangeImpact(doc, library, 'core.industrial');
    const real = themedChanges(doc, 'core.industrial');
    expect(i.surfacesChange).toBe(real.surfaces);
    expect([...i.changing.setPieces].sort()).toEqual(real.setPieces);
  });

  it('a set piece painted across the piece and on a part counts those as yours', () => {
    const doc = scene();
    doc.setPieces![0] = { ...doc.setPieces![0]!, overrides: { roles: { stone: BRICK }, paint: { '0': { floor: BRICK, walls: BRICK } } } };
    expect(themeChangeImpact(doc, library, 'core.industrial').surfacesPainted).toBe(2 + 1 + 2);
  });

  it('a backdrop of its own: the sky does not follow', () => {
    const doc = { ...scene(), backdrop: { sky: 'clear', scenery: 'hills', ground: 'grass' } } as unknown as MapDocument;
    expect(themeChangeImpact(doc, library, 'core.industrial').skyFollows).toBe(false);
  });

  it('nothing to change: an empty map, or the same theme', () => {
    const empty = makeMap([]);
    expect(impactChanges(themeChangeImpact(empty, library, 'core.industrial'))).toBe(0);
    expect(impactChanges(themeChangeImpact(scene(), library, 'core.imperial'))).toBe(0);
  });

  it('counts on the coverage map, from Prototype (no look) to Industrial: they match a real change', () => {
    const i = themeChangeImpact(coverage, library, 'core.industrial');
    expect(i.surfacesChange).toBeGreaterThan(100);
    expect(i.surfacesPainted).toBeGreaterThan(100);
    expect(i.surfacesChange).toBe(themedChanges(coverage, 'core.industrial').surfaces);
  });
});

describe('keepCurrentLookCommand: the theme changes, what is built looks the same', () => {
  it('pins exactly today\'s materials on the scene, one undo step', () => {
    const doc = scene();
    const { command, approximate } = keepCurrentLookCommand(doc, library, 'core.industrial');
    const h = new EditHistory(doc);
    h.execute('Change theme, keep the look', command);
    expect(h.doc.classicStructure.theme).toBe('core.industrial');
    expect(differences(drawnLooks(doc), drawnLooks(h.doc), approximate)).toEqual([]);
    // Pinned as paint: the plain room now has surfaces, the plain block a material, the themed cage overrides.
    expect(h.doc.classicStructure.tiles.find((t) => t.id === 'plain')!.surfaces).toBeDefined();
    expect((h.doc.entities.find((e) => e.id === 'blk_plain') as { material: string | null }).material).not.toBeNull();
    expect(h.doc.setPieces!.find((p) => p.id === 'cage_theme')!.overrides).toBeDefined();
    // Your paint is as it was.
    expect(h.doc.classicStructure.tiles.find((t) => t.id === 'painted')!.surfaces!.walls).toEqual(BRICK);
    // Everything that would have changed is pinned: going back to Imperial changes nothing.
    expect(impactChanges(themeChangeImpact(h.doc, library, 'core.imperial'))).toBe(0);
    h.undo();
    expect(h.doc).toEqual(doc);
    expect(h.canUndo).toBe(false);
  });

  for (const to of ['core.industrial', 'core.desert_city', 'core.neon', 'core.castle']) {
    it(`on the coverage map (Prototype → ${to}): every surface resolves to the same material`, () => {
      const { command, approximate } = keepCurrentLookCommand(coverage, library, to);
      const after = applyCommand(coverage, command);
      expect(after.classicStructure.theme).toBe(to);
      expect(differences(drawnLooks(coverage), drawnLooks(after), approximate)).toEqual([]);
      // Blocks that showed two theme materials (a top and sides) keep one of them: the one they show most.
      const before = drawnLooks(coverage);
      const now = drawnLooks(after);
      for (const id of approximate) {
        const keys = [...before.keys()].filter((k) => k.startsWith(`${id}|`) && !k.endsWith('|glass'));
        expect(keys.some((k) => before.get(k) === now.get(k)), id).toBe(true);
      }
      // Everything that would have changed is pinned: going back to Prototype changes nothing.
      expect(impactChanges(themeChangeImpact(after, library, 'core.prototype'))).toBe(0);
    });
  }

  it('from a theme with a look to one with another: the set pieces keep their look too', () => {
    const doc = { ...coverage, classicStructure: { ...coverage.classicStructure, theme: 'core.medieval' } };
    const { command, approximate } = keepCurrentLookCommand(doc, library, 'core.orbital');
    expect(differences(drawnLooks(doc), drawnLooks(applyCommand(doc, command)), approximate)).toEqual([]);
  });

  it('a block whose top and sides showed two theme materials keeps its top\'s, and is named', () => {
    const doc = scene();
    const { approximate } = keepCurrentLookCommand(doc, library, 'core.industrial');
    const floor = (t: string) => styleKey(resolveSurface({ ...doc, classicStructure: { ...doc.classicStructure, theme: t } }, undefined, 'floor'));
    const under = (t: string) => styleKey(resolveSurface({ ...doc, classicStructure: { ...doc.classicStructure, theme: t } }, undefined, 'underside'));
    expect(approximate.includes('blk_plain')).toBe(floor('core.imperial') !== under('core.imperial'));
  });
});

describe('paint survives every theme', () => {
  it('a painted wall, block and set-piece part show the same in every theme', () => {
    const doc = scene();
    doc.setPieces![0] = { ...doc.setPieces![0]!, overrides: { paint: { '0': { walls: BRICK } } } };
    const base = drawnLooks(doc);
    for (const t of coreThemes.all()) {
      const looks = drawnLooks(applyCommand(doc, setThemeCommand(doc, t.id)));
      expect(looks.get('painted|walls'), t.id).toBe(base.get('painted|walls'));
      expect(looks.get('blk_painted|floor'), t.id).toBe(base.get('blk_painted|floor'));
      expect(looks.get('sp_cage_theme_0|walls'), t.id).toBe(base.get('sp_cage_theme_0|walls'));
    }
  });
});

describe('surfaceLayer: the cursor\'s chain', () => {
  const doc = scene();
  const exp = expandSetPieces(doc, library);
  const boxes = buildMapGeometry(exp.map);
  const at = (pred: (b: WorldBox) => boolean, normal: [number, number, number] = [1, 0, 0]): StructureTarget => {
    const box = boxes.find(pred)!;
    const t = structurePaintTarget(doc, exp, library, { box, normal });
    expect(t.kind).not.toBe('refused');
    return t as StructureTarget;
  };

  it('an unpainted wall: the theme shows', () => {
    const l = surfaceLayer(doc, library, at((b) => b.sourceId === 'plain' && b.kind === 'wall'));
    expect(l.surface).toBe('Wall');
    expect(l.winner).toBe('base');
    expect(l.base.source).toBe('Imperial Arena');
    expect(l.look.style).toBeNull();
    expect(l.paint.style).toBeNull();
  });

  it('a painted wall: your paint shows', () => {
    const l = surfaceLayer(doc, library, at((b) => b.sourceId === 'painted' && b.kind === 'wall'));
    expect(l.winner).toBe('paint');
    expect(l.paint.style!.material.id).toBe(BRICK.material);
  });

  it("a set piece's wall: the look shows, named as the theme's; painted across the piece, your paint", () => {
    const target = at((b) => b.sourceId.startsWith('sp_cage_theme_') && b.kind === 'wall');
    const l = surfaceLayer(doc, library, target);
    expect(l.winner).toBe('look');
    expect(l.look.source).toMatch(/\(the theme's\)$/);
    const own = surfaceLayer(doc, library, at((b) => b.sourceId.startsWith('sp_cage_own_') && b.kind === 'wall'));
    expect(own.look.source).not.toMatch(/the theme's/);
    const painted: MapDocument = { ...doc, setPieces: doc.setPieces!.map((p) => (p.id === 'cage_theme' ? { ...p, overrides: { roles: { stone: BRICK } } } : p)) };
    const t2 = { ...target, placement: painted.setPieces![0]! } as StructureTarget;
    const l2 = surfaceLayer(painted, library, t2);
    expect(l2.winner).toBe('paint');
    expect(l2.paint.source).toBe('across the piece');
  });

  it('a block: the theme for the face, else its paint', () => {
    const l = surfaceLayer(doc, library, at((b) => b.sourceId === 'blk_plain'), 'floor');
    expect(l.surface).toBe('Block');
    expect(l.winner).toBe('base');
    expect(surfaceLayer(doc, library, at((b) => b.sourceId === 'blk_painted')).winner).toBe('paint');
  });
});

describe('groundLayerAt: the ground under Ground paint', () => {
  it('names the ground, the Ground theme and its base, and whether the cell is painted', () => {
    const t = newTerrain(16, 2, [0, 0], 'ground.quarry');
    t.grounds = ['core.pbr_sand'];
    t.materials[0] = 1;
    const corner = groundLayerAt(t, t.origin[0] + 0.5, t.origin[1] + 0.5)!;
    expect(corner).toEqual({ material: 'core.pbr_sand', base: 'core.pbr_gravel', theme: 'ground.quarry', painted: true });
    expect(groundLayerAt(t, 0.5, 0.5)).toEqual({ material: 'core.pbr_gravel', base: 'core.pbr_gravel', theme: 'ground.quarry', painted: false });
    expect(groundLayerAt(t, 1000, 0)).toBeNull();
  });
});
