// Bars and barred gates are drawn in a tile's `metal` surface (format v41; docs/MAPMAKER_PAINTING_PLAN.md, the Cage
// Block bug of 2026-11-15): across every theme and every look (role pack), none of their faces resolves to anything
// but a metal, the Cage Block's bars are iron in every look (owner, 2026-11-15: 1a), and painting the walls never
// reaches them. Railings stay in the walls' surface (owner: 2a); the tall fence is as it was (3a).
import { describe, expect, it } from 'vitest';
import { EDGE_SHAPES } from '../src/content/edgeStyles.generated.ts';
import {
  ROLE_THEME_SLOT,
  buildMapDecor,
  buildMapGeometry,
  builtInSetPieces,
  coreMaterials,
  coreThemes,
  edgeSegments,
  expandSetPieces,
  faceSlot,
  resolveSurface,
  coreCatalog,
  tileHasMetal,
  type MapDocument,
  type WorldBox,
} from '../src/index.ts';
import { makeMap } from './helpers.ts';

/** The edge styles that are bars or a barred gate. */
const BARRED = ['bars', 'bars_gate'] as const;
const library = builtInSetPieces();
const PACKS = [null, ...library.packs.keys()];

/** A room with bars, a barred gate and a railing on three sides, and a Cage Block in `pack` (null: the theme's look). */
function barsMap(theme: string, pack: string | null): MapDocument {
  const map = makeMap([{ id: 'barred', tile: 'core.room', x: -4, y: 0, z: 0, rotation: 0, edges: { '0,0,0:E': 'bars', '0,0,0:S': 'bars_gate', '0,0,0:W': 'railing' } }], [[-60, 0, -60]]);
  return { ...map, classicStructure: { ...map.classicStructure, theme }, setPieces: [{ id: 'cage', piece: 'setpiece.cage_block', x: 2, y: 0, z: 0, rotation: 0, mirror: false, ...(pack ? { pack } : {}) }] };
}

/** Each face normal of a box (its six sides; enough for an axis-aligned bar). */
const NORMALS: [number, number, number][] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

describe('bars and barred gates are metal', () => {
  it('every barred edge style is drawn in the metal surface; no other style is (railings and fences keep the walls\'s)', () => {
    for (const id of BARRED) expect(EDGE_SHAPES[id]?.paint, id).toBe('metal');
    const others = Object.entries(EDGE_SHAPES).filter(([id, s]) => s?.paint && !(BARRED as readonly string[]).includes(id)).map(([id]) => id);
    expect(others).toEqual([]);
  });

  it('a set piece\'s metal role paints the metal slot, never solids (which can be brick)', () => {
    expect(ROLE_THEME_SLOT.metal).toBe('metal');
  });

  it('every role pack\'s metal is a metal', () => {
    for (const [id, pack] of library.packs) if (pack.roles.metal) expect(coreMaterials.get(pack.roles.metal.material)?.category, id).toBe('Metal');
  });

  it('across every theme and look, every bar, gate and railing face resolves to a metal', () => {
    const bad: string[] = [];
    let checked = 0;
    for (const theme of coreThemes.all()) {
      for (const pack of PACKS) {
        const doc = expandSetPieces(barsMap(theme.id, pack), library).map;
        const tiles = new Map(doc.classicStructure.tiles.map((t) => [t.id, t]));
        const boxes: WorldBox[] = [...buildMapGeometry(doc), ...buildMapDecor(doc)];
        const metal = boxes.filter((b) => b.paint === 'metal');
        // The room's bars and gate and the Cage Block's bars and gates: each segment of each (the railing is not metal).
        const segments = (style: (typeof BARRED)[number]) => edgeSegments(style, 4, 4).length;
        expect(metal.filter((b) => b.kind === 'wall').length).toBe(segments('bars') * 2 + segments('bars_gate') * 3);
        for (const b of metal) {
          for (const n of NORMALS) {
            const s = resolveSurface(doc, tiles.get(b.sourceId), faceSlot(b, n));
            checked++;
            if (s.material.category !== 'Metal') bad.push(`${theme.id} ${pack ?? '(theme look)'} ${b.sourceId}: ${s.material.id}`);
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(1000);
    expect([...new Set(bad)].slice(0, 20)).toEqual([]);
  });

  it("the Cage Block's bars are iron in every theme and every look (owner: 1a), as a tile's own bars are", () => {
    const bad: string[] = [];
    for (const theme of coreThemes.all()) {
      for (const pack of PACKS) {
        const doc = expandSetPieces(barsMap(theme.id, pack), library).map;
        const tiles = new Map(doc.classicStructure.tiles.map((t) => [t.id, t]));
        for (const b of buildMapGeometry(doc).filter((x) => x.paint === 'metal')) {
          const m = resolveSurface(doc, tiles.get(b.sourceId), faceSlot(b, [0, 0, -1])).material.id;
          if (m !== 'core.pbr_steel') bad.push(`${theme.id} ${pack ?? '(theme look)'} ${b.sourceId}: ${m}`);
        }
      }
    }
    expect([...new Set(bad)].slice(0, 20)).toEqual([]);
  });

  it('railings stay in the walls surface, as before (owner: 2a)', () => {
    expect(EDGE_SHAPES.railing?.paint).toBeUndefined();
    expect(EDGE_SHAPES.fence?.paint).toBeUndefined();
    const doc = expandSetPieces(barsMap('core.city', null), library).map;
    const rail = buildMapGeometry(doc).filter((b) => b.sourceId === 'barred' && b.kind === 'wall' && b.max[0] < -35.5 && b.max[1] - b.min[1] <= 1.01);
    expect(rail.length).toBeGreaterThan(0);
    const tile = doc.classicStructure.tiles.find((t) => t.id === 'barred');
    for (const b of rail) {
      expect(b.paint).toBeUndefined();
      expect(faceSlot(b, [1, 0, 0])).toBe('walls');
      expect(resolveSurface(doc, tile, faceSlot(b, [1, 0, 0])).material.id).toBe(resolveSurface(doc, undefined, 'walls').material.id);
    }
    expect(buildMapDecor(doc).filter((b) => b.sourceId === 'barred' && b.paint === 'metal').length).toBe(0);
  });

  it('painting the walls leaves the bars; painting the metal changes only them', () => {
    const base = expandSetPieces(barsMap('core.city', null), library).map;
    const paint = (surfaces: Record<string, { material: string; tint: null }>): MapDocument => ({
      ...base,
      classicStructure: { ...base.classicStructure, tiles: base.classicStructure.tiles.map((t) => (t.id === 'barred' ? { ...t, surfaces } : t)) },
    });
    const bar = buildMapGeometry(base).find((b) => b.sourceId === 'barred' && b.paint === 'metal')!;
    const wall = buildMapGeometry(base).find((b) => b.sourceId === 'barred' && b.kind === 'wall' && !b.paint)!;
    const walls = paint({ walls: { material: 'core.pbr_brick_old', tint: null } });
    const t1 = walls.classicStructure.tiles.find((t) => t.id === 'barred');
    expect(resolveSurface(walls, t1, faceSlot(bar, [1, 0, 0])).material.category).toBe('Metal');
    expect(resolveSurface(walls, t1, faceSlot(wall, [1, 0, 0])).material.id).toBe('core.pbr_brick_old');
    const metal = paint({ metal: { material: 'core.brass', tint: null } });
    const t2 = metal.classicStructure.tiles.find((t) => t.id === 'barred');
    expect(resolveSurface(metal, t2, faceSlot(bar, [1, 0, 0])).material.id).toBe('core.brass');
    expect(resolveSurface(metal, t2, faceSlot(wall, [1, 0, 0])).material.id).toBe(resolveSurface(base, undefined, 'walls').material.id);
  });

  it('a tile shows a Metal surface only where it has bars', () => {
    expect(tileHasMetal(coreCatalog.get('core.room'), { edges: { '0,0,0:E': 'bars' } })).toBe(true);
    expect(tileHasMetal(coreCatalog.get('core.room'), { edges: { '0,0,0:E': 'wall' } })).toBe(false);
    expect(tileHasMetal(coreCatalog.get('core.room'), {})).toBe(false);
    const railed = coreCatalog.all().find((t) => t.edgeDefault === 'railing');
    expect(railed && tileHasMetal(railed, {})).toBe(false);
  });
});
