// How every shipped map looks, as hashes (docs/MAPMAKER_PAINTING_PLAN.md, "How we prove shipped maps look the same"):
// for each map in maps/ and maps/templates/, loaded as played (loadMap: migrated, set pieces expanded, paths laid),
//   faces: every box's resolved surface style (material and tint) on its top and on its sides (what faceSlot gives a
//          face pointing up or sideways), counted by piece and style;
//   ground: every terrain cell's drawn material and tint, its plant cover and the kind of ground it behaves as
//           (plants, the Environment brush, the plan picture), in cell order, and the ground past the border.
// Written once before a change to how surfaces or the ground resolve (the painting plan's Phase 4 wrote it on
// origin/main first), then packages/shared/test/paintLooks.test.ts checks every map still hashes the same.
//   node --experimental-transform-types --no-warnings tools/maps/paint-looks.ts --write
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMapDecor, buildMapGeometry, cellFoliage, cellGround, cellKind, coreMaterials, groundStyle, faceSlot, loadMap, resolveBackdrop, resolveSurface, styleKey, type MapDocument, type TerrainData } from '../../packages/shared/src/index.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const FIXTURE = join(ROOT, 'packages/shared/test/fixtures/paintLooks.json');

const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);

/** Cell `i`'s drawn look and behaviour: material|tint|plant cover|kind (the look as the terrain draws it: groundStyle). */
function cellLook(t: TerrainData, i: number): string {
  const style = groundStyle(cellGround(t, i));
  return `${style.material.id}|${style.tint ?? '-'}|${cellFoliage(t, i)}|${cellKind(t, i)}`;
}

/** The two hashes of one map as played. */
export function mapLooks(map: MapDocument): { faces: string; ground: string | null } {
  const tiles = new Map(map.classicStructure.tiles.map((t) => [t.id, t]));
  const counts = new Map<string, number>();
  for (const b of [...buildMapGeometry(map), ...buildMapDecor(map)]) {
    const own = b.surface ? coreMaterials.get(b.surface.material) : undefined;
    const tile = tiles.get(b.sourceId);
    const at = (n: [number, number, number]) => (own ? `${own.id}|${b.surface!.tint ?? '-'}` : styleKey(resolveSurface(map, tile, faceSlot(b, n))));
    const key = `${b.sourceId}#${at([0, 1, 0])}#${at([1, 0, 0])}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const faces = sha([...counts].map(([k, n]) => `${k}*${n}`).sort().join('\n'));
  const t = map.terrain;
  if (!t) return { faces, ground: null };
  const cells: string[] = [];
  for (let i = 0; i < t.materials.length; i++) cells.push(cellLook(t, i));
  return { faces, ground: sha(`${cells.join('\n')}\nborder:${resolveBackdrop(map).ground}`) };
}

/** Every shipped map's looks, by file (maps/x.json, maps/templates/y.json). */
export function shippedLooks(): Record<string, { faces: string; ground: string | null } | { error: string }> {
  const out: Record<string, { faces: string; ground: string | null } | { error: string }> = {};
  for (const dir of ['maps', 'maps/templates']) {
    for (const f of readdirSync(join(ROOT, dir)).filter((x) => x.endsWith('.json')).sort()) {
      const loaded = loadMap(readFileSync(join(ROOT, dir, f), 'utf8'));
      out[`${dir}/${f}`] = loaded.ok ? mapLooks(loaded.map) : { error: loaded.issues.filter((i) => i.severity === 'error').map((i) => i.code).join(',') };
    }
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const looks = shippedLooks();
  const text = `${JSON.stringify(looks, null, 0).replace(/^\{/, '{\n').replace(/\},"/g, '},\n"').replace(/\}\}$/, '}\n}')}\n`;
  if (process.argv.includes('--write')) writeFileSync(FIXTURE, text);
  else process.stdout.write(text);
}
