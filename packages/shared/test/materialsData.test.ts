/**
 * Library materials as data (docs/CONTENT_SCALABILITY.md step 6): every surface material fully resolved (in table
 * order, which is MapMaker's palette order), every theme, the tint swatches, the surface slots, and what code derives
 * from a material (its ballistic class, the terrain layer it paints as) must stay exactly what they were before the
 * tables moved to content/materials.json. The fixture was written from the hand-written tables, before the move; it is
 * only rewritten on purpose:
 *   UPDATE_MATERIAL_FIXTURE=1 pnpm vitest run packages/shared/test/materialsData.test.ts
 * and the diff of test/fixtures/materials-resolved.json then shows exactly what changed.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CORE_MATERIALS, CORE_THEMES, SURFACE_SLOTS, SURFACE_SLOT_LABELS, TINT_SWATCHES, coreMaterials, coreThemes, surfaceMaterial, terrainMaterialFor } from '../src/index.ts';

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'materials-resolved.json');

/** JSON that keeps -0 and drops undefined, so the comparison is exact. */
const norm = (v: unknown): unknown => JSON.parse(JSON.stringify(v, (_k, x) => (Object.is(x, -0) ? '-0' : x)));

function materials() {
  return norm({
    materials: CORE_MATERIALS.map((material) => ({
      material,
      keys: Object.keys(material),
      found: coreMaterials.get(material.id) === material,
      ballistic: surfaceMaterial(material.id),
      terrain: terrainMaterialFor(material.id),
    })),
    palette: coreMaterials.all().map((m) => m.id),
    themes: CORE_THEMES.map((theme) => ({ theme, found: coreThemes.get(theme.id) === theme })),
    themeOrder: coreThemes.all().map((t) => t.id),
    tints: TINT_SWATCHES,
    slots: { SURFACE_SLOTS, SURFACE_SLOT_LABELS },
  });
}

describe('materials as data: the resolved tables', () => {
  if (process.env.UPDATE_MATERIAL_FIXTURE) {
    it('writes the fixture', () => {
      writeFileSync(FIXTURE, JSON.stringify(materials(), null, 1) + '\n');
    });
    return;
  }

  it('deep-equals the fixture written before the move', () => {
    expect(existsSync(FIXTURE)).toBe(true);
    expect(materials()).toEqual(JSON.parse(readFileSync(FIXTURE, 'utf8')));
  });
});
