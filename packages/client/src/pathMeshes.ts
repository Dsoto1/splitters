import type { Scene } from '@babylonjs/core/scene';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { PATH_LOOKS, coreMaterials, pathGeometry, terrainHeightAt, type MapDocument, type MapPath, type TerrainData } from '@tiletrigger/shared';
import type { MapStyler } from './mapMeshes.ts';
import { flat, strip } from './roadMeshes.ts';

/** Height of a path's surface at (x, z): on the ground wherever there is ground (a path drapes over it), the curve's own height elsewhere. */
export function pathSurfaceY(terrain: TerrainData | null, curveY: number, x: number, z: number): number {
  return terrain ? (terrainHeightAt(terrain, x, z) ?? curveY) : curveY;
}

/** How far a path's surface stands above the ground: a boardwalk a little proud of it, everything else just on it. */
export function pathLift(p: MapPath): number {
  return p.style === 'planks' ? 0.12 : 0.04;
}

/**
 * Rows of points across a path (left edge to right) following the ground,
 * like roadStrip for the race track. Where the path turns tighter than half
 * its width, the inside of the bend would run backwards and fold the ribbon
 * over itself (wedges and pinches at the corners): there each line along the
 * path holds its last point until the bend has passed it, so the inside of
 * the corner is one clean point and the outside sweeps round it.
 */
function pathStrip(terrain: TerrainData | null, p: MapPath, from: number, to: number, cols: number, lift: number): { rows: number[][]; s: number[] } {
  const g = pathGeometry(p);
  const ring = g.loop ? [...g.samples, g.samples[0]!] : g.samples;
  const rows: number[][] = [];
  const s: number[] = [];
  const last: ([number, number] | null)[] = Array.from({ length: cols + 1 }, () => null);
  ring.forEach((q, i) => {
    const row: number[] = [];
    for (let c = 0; c <= cols; c++) {
      const off = from + ((to - from) * c) / cols;
      let x = q.x + q.dz * off;
      let z = q.z - q.dx * off;
      const prev = last[c];
      if (prev && (x - prev[0]) * q.dx + (z - prev[1]) * q.dz < 0) [x, z] = prev;
      last[c] = [x, z];
      row.push(x, pathSurfaceY(terrain, q.y, x, z) + lift, z);
    }
    rows.push(row);
    s.push(i === ring.length - 1 && g.loop ? g.length : q.s);
  });
  return { rows, s };
}

/**
 * The map's paths (paths.ts): each a ribbon of its style's surface laid on
 * the ground it follows (drawn just above it, pulled toward the camera so it
 * never fights the terrain), asphalt roads with white edge lines and a dashed
 * centre line. Shared by the game and MapMaker; `terrain` is the ground as
 * played (with the paths laid in).
 */
export function buildPathMeshes(scene: Scene, doc: MapDocument, terrain: TerrainData | null, styler: MapStyler, name = 'path'): Mesh[] {
  const out: Mesh[] = [];
  const mats = new Map<string, StandardMaterial>();
  for (const p of doc.paths ?? []) {
    if (p.points.length < 2) continue;
    const look = PATH_LOOKS[p.style];
    let mat = mats.get(p.style);
    if (!mat) {
      mat = styler.surfaceMaterial(doc, look.surface, look.tint).clone(`${name}_ribbon_${p.style}`) as StandardMaterial;
      mat.zOffset = -2;
      mats.set(p.style, mat);
    }
    const half = p.width / 2;
    // Columns about a metre apart, so the ribbon follows the ground's bumps across it.
    const cols = Math.max(2, Math.ceil(p.width));
    const scale = coreMaterials.get(look.surface)?.scale ?? 4;
    const lift = pathLift(p);
    out.push(strip(scene, `${name}_${p.id}`, pathStrip(terrain, p, -half, half, cols, lift), mat, (c, s) => [((c / cols) * p.width) / scale, s / scale]));
    if (look.lines && p.width >= 5) {
      const white = flat(scene, `${name}_paint`, '#e8e8e2', -4);
      out.push(strip(scene, `${name}_${p.id}_edge_l`, pathStrip(terrain, p, -half + 0.3, -half + 0.5, 1, lift + 0.02), white));
      out.push(strip(scene, `${name}_${p.id}_edge_r`, pathStrip(terrain, p, half - 0.5, half - 0.3, 1, lift + 0.02), white));
      out.push(strip(scene, `${name}_${p.id}_centre`, pathStrip(terrain, p, -0.1, 0.1, 1, lift + 0.02), white, undefined, (s) => Math.floor(s / 3) % 2 === 0));
    }
  }
  for (const m of out) {
    m.isPickable = false;
    m.freezeWorldMatrix();
  }
  return out;
}

export function disposePathMeshes(meshes: readonly Mesh[]): void {
  for (const m of meshes) {
    const mat = m.material;
    m.dispose();
    // The ribbon's own material copy goes with its last mesh (the shared paint materials stay).
    if (mat && mat.name.includes('_ribbon_') && !mat.getBindedMeshes().length) mat.dispose();
  }
}
