// Map format v45 (docs/MAPMAKER_PAINTING_PLAN.md, "Format change A"; painting Phase 4): the ground's base layer. An
// old map's terrain, cell by cell: the base cells (its most common layer that is a Ground theme's base) follow the
// theme, every other cell keeps its look as painted, and the tints (Gravel's darkening) carry over. Then what the new
// encoding does: a Ground theme change moves only the base, Packed Snow paints as itself, a full list never substitutes.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  GROUND_THEMES,
  MAP_FORMAT_VERSION,
  MAX_GROUNDS,
  TERRAIN_MATERIALS,
  TERRAIN_SURFACES,
  applyBrush,
  cellFoliage,
  cellGround,
  cellKind,
  cellPainted,
  groundIndex,
  groundLayersV45,
  groundStyle,
  groundThemeImpact,
  loadMap,
  migrateMapDocument,
  newTerrain,
  setGroundThemeCommand,
  type TerrainData,
} from '../src/index.ts';

/** Backwoods as shipped (v36): moss 47 %, grass 33 %, dirt, mud, gravel and stone. */
const raw = JSON.parse(readFileSync(new URL('../../../maps/backwoods.json', import.meta.url), 'utf8')) as { formatVersion: number; terrain: { materials: number[]; foliage: number[] } };
const old = raw.terrain.materials;
const moss = TERRAIN_MATERIALS.indexOf('moss');

describe('groundLayersV45: an old map keeps its ground, cell by cell', () => {
  const { doc } = migrateMapDocument(raw);
  const t = (doc as { terrain: TerrainData }).terrain;

  it('is an old map with several layers, moss the most common', () => {
    expect(raw.formatVersion).toBeLessThan(45);
    const counts = TERRAIN_MATERIALS.map((_, j) => old.filter((m) => m === j).length);
    expect(Math.max(...counts)).toBe(counts[moss]);
    expect(counts.filter((n) => n > 0).length).toBeGreaterThanOrEqual(5);
  });

  it('lists the eight old layers in their old order and takes the Ground theme whose base is moss', () => {
    expect(t.grounds).toEqual(TERRAIN_MATERIALS.map((m) => TERRAIN_SURFACES[m]));
    expect(t.groundTheme).toBe(GROUND_THEMES.find((g) => g.base === TERRAIN_SURFACES.moss)!.id);
  });

  it('makes the moss cells the base and every other cell painted with its old layer', () => {
    old.forEach((m, i) => {
      expect(t.materials[i], `cell ${i}`).toBe(m === moss ? 0 : m + 1);
      expect(cellPainted(t, i)).toBe(m !== moss);
      expect(cellGround(t, i)).toBe(TERRAIN_SURFACES[TERRAIN_MATERIALS[m]!]);
      expect(cellKind(t, i)).toBe(TERRAIN_MATERIALS[m]);
    });
  });

  it('keeps the tints and the plants', () => {
    const gravel = old.indexOf(TERRAIN_MATERIALS.indexOf('gravel'));
    expect(gravel).toBeGreaterThanOrEqual(0);
    expect(groundStyle(cellGround(t, gravel))).toMatchObject({ tint: '#8f877b' });
    const other = old.indexOf(TERRAIN_MATERIALS.indexOf('grass'));
    expect(groundStyle(cellGround(t, other)).tint).toBeNull();
    const before = { ...t, foliage: [] as number[] };
    // Plants that follow the ground grow the same (painted plant cover is kept as it was).
    old.forEach((m, i) => expect(cellFoliage(before, i)).toBe({ grass: 2, moss: 1 }[TERRAIN_MATERIALS[m] as string] ?? 0));
    expect(t.foliage).toEqual(raw.terrain.foliage);
  });

  it('loads as the new format', () => {
    const r = loadMap(raw);
    expect(r.ok).toBe(true);
    expect(r.ok && r.map.terrain!.groundTheme).toBe(t.groundTheme);
  });
});

describe('groundLayersV45: a release stamp from before keeps its version', () => {
  it('Whiteout Station (stamped, with terrain) loads with its versionId and no "changed since it was exported"', () => {
    const file = JSON.parse(readFileSync(new URL('../../../maps/whiteout_station.json', import.meta.url), 'utf8'));
    expect(file.metadata.release.schemaVersion).toBeLessThan(45);
    const r = loadMap(file, undefined, { forEditing: true });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.issues.filter((i) => i.code === 'release.changed')).toEqual([]);
    expect(r.map.metadata.release).toMatchObject({ versionId: file.metadata.release.versionId, revision: file.metadata.release.revision, schemaVersion: MAP_FORMAT_VERSION });
    // A real edit to the ground is a change.
    const edited = { ...file, terrain: { ...file.terrain, materials: file.terrain.materials.map((m: number, i: number) => (i === 0 ? (m + 1) % 8 : m)) } };
    const e = loadMap(edited, undefined, { forEditing: true });
    expect(e.ok && e.issues.some((i) => i.code === 'release.changed')).toBe(true);
  });
});

describe('groundLayersV45: the base', () => {
  const migrate = (materials: number[]) => (groundLayersV45({ terrain: { materials } }).terrain as TerrainData);
  it('a tie goes to the earlier layer', () => {
    const t = migrate([3, 3, 4, 4]);
    expect(t.groundTheme).toBe(GROUND_THEMES.find((g) => g.base === TERRAIN_SURFACES.sand)!.id);
    expect(t.materials).toEqual([0, 0, 5, 5]);
  });
  it('a layer no Ground theme has as its base is never the base: the next most common is', () => {
    const mud = TERRAIN_MATERIALS.indexOf('mud');
    const t = migrate([mud, mud, mud, 0]);
    expect(t.groundTheme).toBe('ground.meadow');
    expect(t.materials).toEqual([mud + 1, mud + 1, mud + 1, 0]);
    // All of it such a layer: the default theme, every cell painted, the look the same.
    const all = migrate([mud, mud]);
    expect(all.materials).toEqual([mud + 1, mud + 1]);
    expect(cellGround(all, 0)).toBe(TERRAIN_SURFACES.mud);
  });
  it('a map without terrain is unchanged', () => {
    expect(groundLayersV45({ terrain: null })).toEqual({ terrain: null });
    expect(groundLayersV45({})).toEqual({});
  });
});

describe('the Ground theme and painted ground', () => {
  const paint = (t: TerrainData, ground: string | null, x = 0) => applyBrush(t, { brush: 'paint', x, z: 0, radius: 3, strength: 1, ground });

  it('a new terrain is all base', () => {
    const t = newTerrain(16, 2, [0, 0], 'ground.quarry');
    expect(t.materials.every((m) => m === 0)).toBe(true);
    expect(cellGround(t, 0)).toBe('core.pbr_gravel');
  });

  it('Packed Snow paints as Packed Snow (no stand-in) and stays when the Ground theme changes', () => {
    const t = paint(newTerrain(32, 2, [0, 0], 'ground.meadow'), 'core.packed_snow');
    const i = t.materials.findIndex((m) => m > 0);
    expect(t.grounds).toEqual(['core.packed_snow']);
    expect(groundStyle(cellGround(t, i)).material.id).toBe('core.packed_snow');
    const changed = { ...t, groundTheme: 'ground.desert' };
    expect(cellGround(changed, i)).toBe('core.packed_snow');
    expect(cellGround(changed, 0)).toBe('core.pbr_sand');
  });

  it('the warning counts the ground that follows and the ground painted; Keep keeps every cell', () => {
    const t = paint(newTerrain(32, 2, [0, 0], 'ground.meadow'), 'core.pbr_sand');
    const painted = t.materials.filter((m) => m > 0).length;
    const impact = groundThemeImpact({ terrain: t, backdrop: null }, 'ground.snowfield')!;
    expect(impact.paintedM2).toBe(painted * 4);
    expect(impact.followsM2).toBe((t.materials.length - painted) * 4);
    expect([impact.baseFrom, impact.baseTo]).toEqual(['core.pbr_grass', 'core.pbr_snow']);
    const keep = setGroundThemeCommand({ terrain: t }, 'ground.snowfield', true)!;
    const after = (keep as { after: TerrainData }).after;
    expect(after.groundTheme).toBe('ground.snowfield');
    for (let i = 0; i < t.materials.length; i++) expect(cellGround(after, i)).toBe(cellGround(t, i));
    const change = (setGroundThemeCommand({ terrain: t }, 'ground.snowfield') as { after: TerrainData }).after;
    for (let i = 0; i < t.materials.length; i++) expect(cellGround(change, i)).toBe(t.materials[i] ? 'core.pbr_sand' : 'core.pbr_snow');
  });

  it('a full list drops unused grounds first, and never substitutes', () => {
    let t = newTerrain(200, 2, [0, 0], 'ground.meadow');
    const grounds = GROUND_THEMES.flatMap((g) => g.grounds).filter((g, i, a) => a.indexOf(g) === i);
    expect(grounds.length).toBeGreaterThan(MAX_GROUNDS);
    for (let k = 0; k < MAX_GROUNDS; k++) t = paint(t, grounds[k]!, -90 + k * 10);
    expect(t.grounds).toHaveLength(MAX_GROUNDS);
    expect(groundIndex(t, grounds[MAX_GROUNDS]!)).toBeNull();
    expect(paint(t, grounds[MAX_GROUNDS]!, 0)).toBe(t);
    // Paint one ground over entirely: its slot frees up.
    const freed = paint(t, grounds[1]!, -90);
    const slot = groundIndex(freed, grounds[MAX_GROUNDS]!)!;
    expect(slot).not.toBeNull();
    for (let i = 0; i < freed.materials.length; i++) expect(cellGround(slot.terrain, i)).toBe(cellGround(freed, i));
  });

  it('refuses a material that is not a ground', () => {
    const t = newTerrain(16, 2);
    expect(paint(t, 'core.pbr_checker')).toBe(t);
  });
});
