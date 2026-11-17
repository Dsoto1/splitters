/**
 * When a placed prop changes between its near model and its lighter levels of detail (the prop batches,
 * propBatches.ts, and props drawn as GPU instances, ModelLibrary.mergeModel).
 *
 * Why (owner, 2026-11-16, an indoor shop shelf): the generated props' levels were switched at fixed distances
 * written per family (a shop shelf's goods became one block a shelf at 14 m, a chair's level 1 came at 10 m), so in
 * a shop or a hall you saw shelves of goods turn into flat coloured blocks one step away, and props drawn as GPU
 * instances (fewer than eight copies of a model on the map) flickered between the two as you moved at that
 * distance: Babylon's own level choice has no hysteresis, and the view bobs as you walk.
 *
 * Now:
 * - **By size on screen**: a lighter level waits until the copy is small on screen, by its bounding radius
 *   (`COVER`, a share of the screen's height at the game's default field of view), and never comes nearer than
 *   `FLOOR` (no level change inside a room or a shop) or than the family's own distance; `CAP` keeps a large piece
 *   (a container, a dome) from keeping its full model to the horizon.
 * - **Hysteresis**: a copy changes level only once it is `HYSTERESIS` past the boundary, either way, so standing or
 *   bobbing on the line never flickers. Both paths use `pickPropLevel`.
 * Plants and trees drawn as props (models with a picture card for the distance) keep their written distances.
 */

import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Camera } from '@babylonjs/core/Cameras/camera';
import type { BoundingSphere } from '@babylonjs/core/Culling/boundingSphere';
import type { Nullable } from '@babylonjs/core/types';

/** tan(half the default vertical field of view): view.ts DEFAULT_FOV, 1.35 rad. */
const TAN_HALF_FOV = Math.tan(1.35 / 2);
/** A copy takes level i once its bounding sphere spans less than this share of the screen's height. */
const COVER = [0, 0.05, 0.015];
/** ...but never nearer than this (m): nothing changes level within a room or a shop's aisles. */
const FLOOR = [0, 20, 45];
/** ...and no farther than this (m) for size alone (a family's own distance can be farther). */
const CAP = [0, 60, 150];
/** A copy changes level only once it is this share past the boundary (no flicker at the edge). */
export const PROP_LOD_HYSTERESIS = 0.15;

/**
 * The distance (m) from which a copy of bounding radius `radius` (m, as placed) draws level `level`, given the
 * distance its model was written with (`authored`): see the file comment. Level 0 is always 0.
 */
export function propLodDistance(authored: number, level: number, radius: number): number {
  if (level <= 0) return 0;
  const k = Math.min(level, COVER.length - 1);
  const bySize = Math.min(CAP[k]!, radius / (TAN_HALF_FOV * COVER[k]!));
  return Math.max(authored, FLOOR[k]!, bySize);
}

/**
 * Each level's distance for a copy (`authored[0]` is level 0's, 0), kept increasing: a later level starts at least
 * a hysteresis band and a half past the one before, so the two bands never overlap.
 */
export function propLodEdges(authored: readonly number[], radius: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < authored.length; i++) {
    let d = propLodDistance(authored[i]!, i, radius);
    if (i > 0) d = Math.max(d, out[i - 1]! * (1 + 3 * PROP_LOD_HYSTERESIS));
    out.push(d);
  }
  return out;
}

/**
 * The level a copy at distance `d` draws, given each level's start (`edges`, increasing, `edges[0]` = 0) and the
 * level it drew last (`prev`, -1 for none): the plain choice, unless it is within PROP_LOD_HYSTERESIS of the boundary
 * it would cross, where it keeps `prev`.
 */
export function pickPropLevel(d: number, edges: readonly number[], prev: number): number {
  let level = 0;
  for (let i = 1; i < edges.length; i++) if (d >= edges[i]!) level = i;
  if (prev >= 0 && prev < edges.length && level !== prev) {
    const edge = edges[Math.max(level, prev)]!;
    // Moving out: switch only past edge × (1 + h); moving in: only inside edge × (1 − h).
    if (level > prev ? d < edge * (1 + PROP_LOD_HYSTERESIS) : d > edge * (1 - PROP_LOD_HYSTERESIS)) {
      // Crossed more than one boundary (a teleport, a respawn): the plain choice.
      if (Math.abs(level - prev) === 1) return prev;
    }
  }
  return level;
}

/**
 * Give a GPU-instance source mesh (ModelLibrary.mergeModel) a level choice with hysteresis: Babylon's own picks each
 * instance's level from its distance alone, every frame, so a copy standing near the line flickered between the two
 * as the view bobbed. Each copy (by its bounding sphere, one per instance) keeps the level it drew last until it is
 * PROP_LOD_HYSTERESIS past the line. The levels' distances are the source's (`addLODLevel`, already by size).
 */
export function lodWithHysteresis(src: Mesh): void {
  const plain = src.getLOD.bind(src);
  const last = new WeakMap<BoundingSphere, number>();
  let asc: { distanceOrScreenCoverage: number; mesh: Nullable<Mesh> }[] = [];
  let edges: number[] = [0];
  src.getLOD = (camera: Camera, sphere?: BoundingSphere): Nullable<AbstractMesh> => {
    const levels = src.getLODLevels();
    // Orthographic views (none in play) and screen-coverage levels keep Babylon's own choice.
    if (!levels.length || !camera || camera.mode !== 0 || src.useLODScreenCoverage) return plain(camera, sphere);
    if (levels.length !== asc.length) {
      // Babylon keeps its levels farthest first.
      asc = [...levels].reverse();
      edges = [0, ...asc.map((l) => l.distanceOrScreenCoverage)];
    }
    const bs = sphere ?? src.getBoundingInfo().boundingSphere;
    const c = bs.centerWorld;
    const p = camera.globalPosition;
    const d = Math.hypot(c.x - p.x, c.y - p.y, c.z - p.z);
    const level = pickPropLevel(d, edges, last.get(bs) ?? -1);
    last.set(bs, level);
    if (level === 0) return src;
    const mesh = asc[level - 1]!.mesh;
    if (mesh) {
      // What Babylon's own choice does for the level it returns.
      mesh._preActivate();
      (mesh as unknown as { _updateSubMeshesBoundingInfo(m: unknown): void })._updateSubMeshesBoundingInfo(src.worldMatrixFromCache);
    }
    return mesh;
  };
}
