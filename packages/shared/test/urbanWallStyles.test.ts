/**
 * The two wall styles of Tileset 11, Urban & Civilian (docs/map-briefs/urban/URBAN_PLAN.md C1 and C2; owner-approved
 * with a format bump, 2026-11-13): `shopfront` and `window_arched` in content/tiles/edges.json, and map format v38.
 * Collision is what counts: what stands, what is open, where the glass is. What they look like is trim.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { EDGE_STYLES, EDGE_STYLE_LABELS, GLASS_EDGES, MAP_FORMAT_VERSION, MIGRATIONS, applyCommand, buildMapDecor, buildMapGeometry, edgeSegments, edgeTrimBoxes, initPhysics, loadMap, migrateMapDocument, serializeMap, setEdgeCommand, setEdgeGlassCommand, validateMap, windowPanes, type GlassKind, type MapDocument } from '../src/index.ts';
import { EDGE_SHAPES } from '../src/content/edgeStyles.generated.ts';
import { NavWorld, initNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

type Tile = MapDocument['classicStructure']['tiles'][number];
const room = (edge: string, glass?: GlassKind): Tile => ({ id: 'room', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0, edges: { '0,0,0:N': edge as never }, ...(glass ? { glass: { '0,0,0:N': glass } } : {}) });
/** A room with the style on its north side, a yard north of it, a spawn in the room. */
const shop = (edge: string, glass?: GlassKind) => makeMap([room(edge, glass), { id: 'yard', tile: 'core.yard', x: 0, y: 1, z: 0, rotation: 0 }], [[0, 0, 0]]);

/** Whether (u, y) on the side is stone (a segment) or glass (an opening, when glazed); u along the side, y up. */
function covered(style: 'shopfront' | 'window_arched', glazed: boolean, u: number, y: number): 'stone' | 'glass' | 'open' {
  if (edgeSegments(style, 4, 4).some(([u0, u1, y0, y1]) => u >= u0 && u <= u1 && y >= y0 && y <= y1)) return 'stone';
  if (glazed && EDGE_SHAPES[style]!.openings!.some(([u0, u1, y0, y1]) => u >= u0 && u <= u1 && y >= y0 && y <= y1)) return 'glass';
  return 'open';
}
const samples = (f: (u: number, y: number) => void) => {
  for (let u = -3.995; u < 4; u += 0.01) for (let y = 0.005; y < 4; y += 0.01) f(u, y);
};

describe('the Shopfront wall style', () => {
  it('is a riser 0.45 m high between two 1 m piers under a head at 3 m: one opening 6 m wide that takes glass', () => {
    expect(EDGE_STYLE_LABELS.shopfront).toBe('Shopfront');
    expect(edgeSegments('shopfront', 4, 4)).toEqual([[-4, -3, 0, 4, 0.5], [3, 4, 0, 4, 0.5], [-3, 3, 0, 0.45, 0.5], [-3, 3, 3, 4, 0.5]]);
    expect(EDGE_SHAPES.shopfront!.openings).toEqual([[-3, 3, 0.45, 3]]);
    expect(GLASS_EDGES.has('shopfront')).toBe(true);
    // On a level 3 m high the head goes and the opening runs to the ceiling; nothing is left over it to float.
    expect(edgeSegments('shopfront', 4, 3).filter(([, , y0, y1]) => y1 - y0 > 1e-6 && y0 >= 3)).toEqual([]);
  });

  it('glazed, nothing of the side is open: stone or glass everywhere, and the pane is the whole opening', () => {
    let open = 0;
    let glass = 0;
    samples((u, y) => {
      const c = covered('shopfront', true, u, y);
      if (c === 'open') open++;
      if (c === 'glass') glass++;
    });
    expect(open).toBe(0);
    // 6 m by 2.55 m of glass.
    expect(glass / 10000).toBeCloseTo(6 * 2.55, 1);
    for (const kind of ['breakable', 'reinforced'] as const) {
      const panes = windowPanes(shop('shopfront', kind));
      expect(panes).toHaveLength(1);
      // In the middle of the north wall's thickness (the wall is the room's outer 0.5 m), from the riser to the head.
      expect(panes[0]).toMatchObject({ id: 'room:0,0,0:N', kind, box: { center: { x: 0, y: 0.45 + 2.55 / 2, z: 3.75 }, half: { x: 3, y: 2.55 / 2 } } });
      expect(panes[0]!.box.half.z).toBeLessThan(0.1);
      expect(validateMap(shop('shopfront', kind)).filter((i) => i.severity === 'error' || i.code === 'glass.edge')).toEqual([]);
    }
  });

  it('collides as its piers, riser and head only; the sill, head, jambs and the painted frame are trim', () => {
    const map = shop('shopfront', 'breakable');
    // The north side's own boxes: in the wall's 0.5 m (z 3.5 to 4), not reaching the side walls' corners.
    const wall = buildMapGeometry(map).filter((b) => b.sourceId === 'room' && b.kind !== 'trim' && b.min[2] >= 3.5 - 1e-6 && b.max[2] <= 4 + 1e-6 && b.max[1] > 0.01);
    // Sampled across the side: stone where the piers, the riser and the head are, nothing in the opening.
    const stone = (x: number, y: number) => wall.some((b) => x >= b.min[0] && x <= b.max[0] && y >= b.min[1] && y <= b.max[1]);
    for (const [x, y, want] of [[-3.5, 2, true], [3.5, 2, true], [0, 0.2, true], [2.9, 0.4, true], [0, 3.5, true], [0, 1.5, false], [-2.9, 0.5, false], [2.9, 2.95, false], [0, 0.5, false]] as const) expect(stone(x, y), `${x}, ${y}`).toBe(want);
    const trim = edgeTrimBoxes('shopfront', 4, 4);
    const frame = trim.filter((p) => p.surface);
    expect(frame).toHaveLength(4);
    for (const p of frame) {
      expect(p.surface).toEqual({ material: 'core.paint_matte', tint: '#3a3d42' });
      // Round the glass's plane (0.25 m in), inside the opening: one pane, no mullion across it.
      expect(p.v0).toBeLessThan(0.25);
      expect(p.v1).toBeGreaterThan(0.25);
      expect(p.u1 - p.u0 < 0.08 || p.y1 - p.y0 < 0.1).toBe(true);
    }
    // The surround is on the outer face too where nothing is built beyond.
    expect(edgeTrimBoxes('shopfront', 4, 4, true).filter((p) => p.v1 === 0)).toHaveLength(4);
    expect(buildMapDecor(map).filter((b) => b.surface?.material === 'core.paint_matte').every((b) => b.kind === 'trim')).toBe(true);
    expect(buildMapGeometry(map).some((b) => b.surface?.material === 'core.paint_matte')).toBe(false);
  });

  it('bots do not path through it, glazed or not; a doorway beside it is the way in', () => {
    for (const glass of [undefined, 'breakable', 'reinforced'] as const) {
      const map = shop('shopfront', glass);
      const nav = NavWorld.build(buildMapGeometry(map).filter((b) => b.sourceId !== 'ground'));
      const path = nav.findPath({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 8 });
      const end = path?.[path.length - 1];
      expect(end ? Math.hypot(end.x, end.z - 8) : Infinity, `glass: ${glass}`).toBeGreaterThan(2);
      nav.destroy();
    }
    const door = makeMap([{ id: 'room', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0, edges: { '0,0,0:N': 'door' } }, { id: 'yard', tile: 'core.yard', x: 0, y: 1, z: 0, rotation: 0 }]);
    const nav = NavWorld.build(buildMapGeometry(door).filter((b) => b.sourceId !== 'ground'));
    const path = nav.findPath({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 8 })!;
    expect(Math.hypot(path[path.length - 1]!.x, path[path.length - 1]!.z - 8)).toBeLessThan(1.2);
    nav.destroy();
  });
});

describe('the Arched window wall style', () => {
  const SPRING = 2;
  const R = 1;
  const curve = (u: number) => SPRING + Math.sqrt(Math.max(0, R * R - u * u));

  it('is 2 m wide with a sill at 0.9 m and a round head from 2 m to 3 m, and takes glass', () => {
    expect(EDGE_STYLE_LABELS.window_arched).toBe('Arched window');
    expect(EDGE_SHAPES.window_arched!.openings).toEqual([[-1, 1, 0.9, 3]]);
    expect(GLASS_EDGES.has('window_arched')).toBe(true);
    const segs = edgeSegments('window_arched', 4, 4);
    expect(segs).toContainEqual([-4, -1, 0, 4, 0.5]);
    expect(segs).toContainEqual([1, 4, 0, 4, 0.5]);
    expect(segs).toContainEqual([-1, 1, 0, 0.9, 0.5]);
    // Mirror-symmetric about the middle.
    const key = (s: number[]) => s.map((v) => v.toFixed(2)).join();
    expect(segs.map(([u0, u1, ...r]) => key([-u1, -u0, ...r])).sort()).toEqual(segs.map(key).sort());
  });

  it('its stone steps over the curve and never dips below it, at most 0.2 m over it', () => {
    const head = edgeSegments('window_arched', 4, 4).filter(([u0, u1, y0]) => u0 >= -1 && u1 <= 1 && y0 > 1);
    expect(head).toHaveLength(17);
    // The steps cover the opening's width without a gap.
    const sorted = [...head].sort((a, b) => a[0] - b[0]);
    expect(sorted[0]![0]).toBe(-1);
    expect(sorted[sorted.length - 1]![1]).toBe(1);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i]![0]).toBeCloseTo(sorted[i - 1]![1], 9);
    for (const [u0, u1, y0, y1] of head) {
      expect(y1).toBe(4);
      // The curve's highest point under this step is at its edge nearer the middle.
      const inner = Math.min(Math.abs(u0), Math.abs(u1));
      const top = u0 < 0 && u1 > 0 ? curve(0) : curve(inner);
      expect(y0, `${u0}..${u1}`).toBeGreaterThanOrEqual(top - 1e-9);
      expect(y0 - top, `${u0}..${u1}`).toBeLessThan(0.011);
      // And over the step's other edge, where the curve is lower, the stone is at most 0.2 m above it.
      expect(y0 - curve(Math.max(Math.abs(u0), Math.abs(u1))), `${u0}..${u1}`).toBeLessThanOrEqual(0.2 + 1e-9);
    }
  });

  it('glazed, nothing of the side is open; open, the hole is the arch and no more', () => {
    let open = 0;
    samples((u, y) => {
      if (covered('window_arched', true, u, y) === 'open') open++;
    });
    expect(open).toBe(0);
    let hole = 0;
    let outside = 0;
    samples((u, y) => {
      if (covered('window_arched', false, u, y) !== 'open') return;
      hole++;
      // Every open point is inside the opening's rectangle, above the sill, and under the curve or at most 0.2 m over it (a step).
      if (Math.abs(u) > 1 || y < 0.9 || y > 3 || (y > SPRING && y > curve(Math.abs(u)) + 0.2 + 1e-9)) outside++;
    });
    expect(outside).toBe(0);
    // The arch's own area: 2 m by 1.1 m under half a disc of radius 1 m, and the little the steps leave over the curve.
    const area = hole / 10000;
    expect(area).toBeGreaterThan(2 * 1.1 + Math.PI / 2);
    expect(area).toBeLessThan(2 * 1.1 + Math.PI / 2 + 0.2);
    const panes = windowPanes(shop('window_arched', 'reinforced'));
    expect(panes).toHaveLength(1);
    expect(panes[0]).toMatchObject({ kind: 'reinforced', box: { center: { x: 0, z: 3.75 }, half: { x: 1, y: 1.05 } } });
    expect(panes[0]!.box.center.y).toBeCloseTo(1.95, 9);
  });

  it('is dressed with nine voussoirs and a keystone, a sill and jambs, and a painted frame by the glass: trim only', () => {
    const trim = edgeTrimBoxes('window_arched', 4, 4);
    expect(trim.filter((p) => p.tilt !== undefined).length).toBeGreaterThanOrEqual(8);
    expect(trim.some((p) => p.depth === 0.14 && p.y1 === 0.9)).toBe(true);
    const frame = trim.filter((p) => p.surface);
    expect(frame).toHaveLength(6);
    for (const p of frame) {
      expect(p.surface).toEqual({ material: 'core.paint_matte', tint: '#e6e1d3' });
      expect(p.u0).toBeGreaterThanOrEqual(-1);
      expect(p.u1).toBeLessThanOrEqual(1);
      expect(p.y0).toBeGreaterThanOrEqual(0.9);
      expect(p.y1).toBeLessThan(3);
    }
    const map = shop('window_arched', 'breakable');
    expect(buildMapGeometry(map).some((b) => b.surface?.material === 'core.paint_matte')).toBe(false);
    expect(validateMap(map).filter((i) => i.severity === 'error')).toEqual([]);
  });
});

describe('map format v38', () => {
  it('is the current format, with a migration from v37 that changes nothing', () => {
    expect(MAP_FORMAT_VERSION).toBe(38);
    expect(EDGE_STYLES).toContain('shopfront');
    expect(EDGE_STYLES).toContain('window_arched');
    // The two new styles come last before `open`: every earlier style keeps its place in MapMaker's order.
    expect(EDGE_STYLES.slice(-3)).toEqual(['shopfront', 'window_arched', 'open']);
    const doc = { format: 'tiletrigger.map', formatVersion: 37, anything: { kept: [1, 2, 3] } };
    expect(MIGRATIONS.get(37)!(doc)).toEqual(doc);
    expect(migrateMapDocument(doc)).toEqual({ doc: { ...doc, formatVersion: 38 }, fromVersion: 37 });
  });

  it('a map with a new style is saved as v38 and loads back as it was saved', () => {
    for (const style of ['shopfront', 'window_arched'] as const) {
      let map = shop('wall');
      const cmd = setEdgeCommand(map, { cell: [0, 0, 0], side: 'N' }, style);
      if ('error' in cmd) throw new Error(cmd.error);
      map = applyCommand(map, cmd);
      const glass = setEdgeGlassCommand(map, { cell: [0, 0, 0], side: 'N' }, 'breakable');
      if ('error' in glass) throw new Error(glass.error);
      map = applyCommand(map, glass);
      const text = serializeMap(map);
      expect(JSON.parse(text).formatVersion).toBe(38);
      const again = loadMap(text, undefined, { forEditing: true, openWithErrors: true });
      expect(again.ok ? [] : again.issues).toEqual([]);
      if (!again.ok) continue;
      expect(again.migratedFrom).toBe(38);
      expect(again.map.classicStructure.tiles).toEqual(map.classicStructure.tiles);
      expect(again.map.classicStructure.tiles[0]).toMatchObject({ edges: { '0,0,0:N': style }, glass: { '0,0,0:N': 'breakable' } });
    }
  });

  it('a v37 map opens unchanged, and so do the shipped maps, whatever version their files say', () => {
    const plain = shop('window', 'breakable');
    const old = loadMap({ ...JSON.parse(serializeMap(plain)), formatVersion: 37 }, undefined, { forEditing: true, openWithErrors: true });
    expect(old.ok).toBe(true);
    if (old.ok) {
      expect(old.migratedFrom).toBe(37);
      expect(old.map.classicStructure).toEqual(plain.classicStructure);
      expect(old.map.entities).toEqual(plain.entities);
      expect(buildMapGeometry(old.map)).toEqual(buildMapGeometry(plain));
    }
    // Shipped files (v36 and v37 among them): opened for editing, the tiles, their sides and their glass are the file's own.
    for (const id of ['riot_junction', 'crossroads', 'st_johns', 'test_coverage']) {
      const raw = JSON.parse(readFileSync(new URL(`../../../maps/${id}.json`, import.meta.url), 'utf8')) as { formatVersion: number; classicStructure: { tiles: { id: string; edges?: Record<string, string>; glass?: Record<string, string> }[] } };
      expect(raw.formatVersion, id).toBeLessThan(38);
      const r = loadMap(raw, undefined, { forEditing: true, openWithErrors: true });
      expect(r.ok, id).toBe(true);
      if (!r.ok) continue;
      expect(r.map.formatVersion).toBe(38);
      const sides = (tiles: { id: string; edges?: Record<string, string>; glass?: Record<string, string> }[]) => tiles.map((t) => [t.id, t.edges ?? null, t.glass ?? null]);
      expect(sides(r.map.classicStructure.tiles), id).toEqual(sides(raw.classicStructure.tiles));
      // No shipped map names a new style: nothing was changed to use them.
      expect(JSON.stringify(raw).includes('shopfront') || JSON.stringify(raw).includes('window_arched'), id).toBe(false);
    }
  });
});
