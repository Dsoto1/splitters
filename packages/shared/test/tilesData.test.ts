/**
 * Tiles as data (docs/CONTENT_SCALABILITY.md step 7): the core building kit (every tile catalog.ts defines, in
 * catalog order), the edge styles (labels, collision segments, trim, window openings, how glass, corners, facades and
 * room dressing read them) and what they build in every map must stay exactly what they were before the kit moved to
 * content/tiles/. The fixture was written from the hand-written tables, before the move; it is only rewritten on
 * purpose:
 *   UPDATE_TILE_FIXTURE=1 pnpm vitest run packages/shared/test/tilesData.test.ts
 * and the diff of test/fixtures/tiles-resolved.json then shows exactly what changed.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CORNERS,
  EDGE_STYLES,
  EDGE_STYLE_LABELS,
  FACADES,
  GLASS_EDGES,
  STYLE_PACKS,
  TILE_DIMENSIONS,
  buildFacades,
  buildMapDecor,
  buildMapGeometry,
  coreCatalog,
  coreMaterials,
  resolveKitTile,
  dressSpace,
  edgeSegments,
  edgeTrim,
  loadMap,
  validateMap,
  windowOpenings,
  windowPanes,
  type EdgeStyle,
  type MapDocument,
  type ResolvedEdge,
} from '../src/index.ts';
import { boxPackTiles } from '../src/map/packTiles.ts';
import { boxPackTiles2 } from '../src/map/packTiles2.ts';
import { ancientPackTiles } from '../src/map/packTilesAncient.ts';
import { desertPackTiles } from '../src/map/packTilesDesert.ts';
import { harborPackTiles } from '../src/map/packTilesHarbor.ts';
import { junglePackTiles } from '../src/map/packTilesJungle.ts';
import { medievalPackTiles } from '../src/map/packTilesMedieval.ts';
import { snowPackTiles } from '../src/map/packTilesSnow.ts';
import { KIT_TILES } from '../src/content/kitTiles.generated.ts';
import { makeMap } from './helpers.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(HERE, 'fixtures', 'tiles-resolved.json');
const MAPS = join(HERE, '../../../maps');

/** JSON that keeps -0 and drops undefined, so the comparison is exact. */
const norm = (v: unknown): unknown => JSON.parse(JSON.stringify(v, (_k, x) => (Object.is(x, -0) ? '-0' : x)));
const hash = (v: unknown): string => createHash('sha256').update(JSON.stringify(v, (_k, x) => (Object.is(x, -0) ? '-0' : x))).digest('hex').slice(0, 24);

/** The Style Pack tiles drawn by code (packTiles*.ts): not part of the kit's data, only of the catalog order. */
const PACK_IDS = new Set([boxPackTiles, boxPackTiles2, ancientPackTiles, medievalPackTiles, harborPackTiles, snowPackTiles, desertPackTiles, junglePackTiles].flatMap((f) => f().map((t) => t.id)));

/** Wall sizes the edge styles are measured at: [half a cell side, level height]. */
const SIZES: [number, number][] = [[4, 4], [4, 3], [4, 8], [4, 2.5], [5, 4.5], [3, 3.6]];
const BUILT = EDGE_STYLES.filter((s) => s !== 'auto' && s !== 'open') as ResolvedEdge[];

/** One room per edge style (all four sides), in each corner style, with a box facade, a street facade and a model facade. */
function styleMap(): MapDocument {
  const tiles: MapDocument['classicStructure']['tiles'] = [];
  const facades = FACADES.filter((f) => ['none', 'concrete', 'false_front', 'brick', 'gothic_stone', 'timber_frame'].includes(f));
  EDGE_STYLES.forEach((style, i) => {
    const edges = Object.fromEntries(['N', 'E', 'S', 'W'].map((s) => [`0,0,0:${s}`, style as EdgeStyle]));
    CORNERS.forEach((corners, j) => {
      tiles.push({ id: `r_${style}_${corners}`, tile: 'core.room', x: i * 2, y: j * 2, z: 0, rotation: 0, edges, options: { corners, facade: facades[(i + j) % facades.length] } });
    });
    // A glazed window side, so the panes are built too.
    tiles.push({ id: `g_${style}`, tile: 'core.room', x: i * 2, y: 20, z: 0, rotation: 1, edges: { '0,0,0:N': style as EdgeStyle }, glass: { '0,0,0:N': 'breakable' } } as never);
  });
  return makeMap(tiles);
}

/** What a map builds from its tiles and edges: geometry, trim, facades, window glass, validation and room dressing. */
function built(map: MapDocument) {
  const geometry = buildMapGeometry(map);
  const dress = map.classicStructure.tiles.slice(0, 40).map((t) => {
    try {
      return dressSpace(map, [[t.x, t.y, t.z]], geometry);
    } catch (e) {
      return String(e);
    }
  });
  return {
    geometry: hash(geometry),
    decor: hash(buildMapDecor(map)),
    facades: hash(buildFacades(map)),
    panes: hash(windowPanes(map)),
    issues: hash(validateMap(map)),
    dressing: hash(dress),
  };
}

function tiles() {
  const all = coreCatalog.all();
  const maps: Record<string, unknown> = {};
  for (const f of readdirSync(MAPS).filter((x) => x.endsWith('.json')).sort()) {
    const r = loadMap(readFileSync(join(MAPS, f), 'utf8'));
    maps[f] = r.ok ? built(r.map) : { failed: hash(r.issues) };
  }
  return norm({
    order: all.map((t) => t.id),
    kit: all.filter((t) => !PACK_IDS.has(t.id)),
    dimensions: TILE_DIMENSIONS,
    edges: {
      styles: EDGE_STYLES,
      labels: EDGE_STYLE_LABELS,
      shapes: Object.fromEntries(
        BUILT.map((s) => [
          s,
          {
            sizes: SIZES.map(([half, height]) => ({ half, height, segments: edgeSegments(s, half, height), trim: edgeTrim(s, half, height) })),
            glass: GLASS_EDGES.has(s),
            windows: SIZES.map(([, height]) => windowOpenings(s, height)),
          },
        ]),
      ),
      none: { segments: edgeSegments('none', 4, 4), trim: edgeTrim('none', 4, 4) },
    },
    styleMap: built(styleMap()),
    maps,
  });
}

describe('tiles as data: the resolved kit', () => {
  if (process.env.UPDATE_TILE_FIXTURE) {
    it('writes the fixture', () => {
      writeFileSync(FIXTURE, JSON.stringify(tiles(), null, 1) + '\n');
    }, 600_000);
    return;
  }

  it('deep-equals the fixture written before the move', () => {
    expect(existsSync(FIXTURE)).toBe(true);
    const now = tiles() as Record<string, unknown>;
    const was = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Record<string, unknown>;
    // Part by part first, so a failure says which part changed.
    for (const k of Object.keys(was)) expect(now[k], k).toEqual(was[k]);
    expect(now).toEqual(was);
    // Key order too: a tile's palette picture is keyed by a hash of its definition's JSON (tools/content/palette-items.ts).
    expect(JSON.stringify(now.kit)).toBe(JSON.stringify(was.kit));
  }, 600_000);

  it('every tile the maps and Style Packs name exists, kit or Style Pack (the generator checks the kit\'s side)', () => {
    const missing: string[] = [];
    for (const f of readdirSync(MAPS).filter((x) => x.endsWith('.json'))) {
      for (const m of readFileSync(join(MAPS, f), 'utf8').matchAll(/"tile":\s*"([^"]+)"/g)) if (!coreCatalog.get(m[1]!)) missing.push(`${f}: ${m[1]}`);
    }
    for (const p of STYLE_PACKS) for (const id of p.tiles) if (!coreCatalog.get(id)) missing.push(`${p.id}: ${id}`);
    expect(missing).toEqual([]);
  });

  it('builds every kit tile from its data, and the kit names only edge styles and materials that exist', () => {
    expect(KIT_TILES.length).toBeGreaterThan(60);
    for (const spec of KIT_TILES) {
      const def = coreCatalog.get(spec.id)!;
      expect(def, spec.id).toEqual(resolveKitTile(spec));
      for (const s of [def.edgeDefault, ...Object.values(def.edgeDefaults ?? {})]) if (s) expect(EDGE_STYLES, spec.id).toContain(s);
      for (const b of [...(def.solids ?? []), ...(def.extraFloors ?? [])]) if (b.surface) expect(coreMaterials.get(b.surface.material), spec.id).toBeTruthy();
    }
  });
});
