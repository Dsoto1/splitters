/**
 * Still props merged into one mesh per material where they stand together (docs/PERF_PROPS_2026-11-23.md,
 * `?perfoff=propmerge`; game/propBatches.ts draws them). The geometry of every copy in a square, placed, with its
 * tint in its vertex colours, is one vertex list per material and level of detail; which copies draw is the index
 * list, rebuilt (only the indices) when a copy changes its level of detail. Pure: no scene, so the tests run it.
 */

/** One copy's part: its geometry in the model's space, where it stands and its tint (null: none). */
export interface MergeItem {
  positions: ArrayLike<number>;
  normals?: ArrayLike<number> | null;
  tangents?: ArrayLike<number> | null;
  uvs?: ArrayLike<number> | null;
  uvs2?: ArrayLike<number> | null;
  /** RGBA per vertex (Babylon's VertexData colours). */
  colors?: ArrayLike<number> | null;
  indices: ArrayLike<number>;
  /** World matrix, Babylon's layout (row vectors: translation in 12-14). */
  matrix: ArrayLike<number>;
  tint?: readonly number[] | null;
}

export interface Merged {
  positions: Float32Array;
  normals: Float32Array | null;
  tangents: Float32Array | null;
  uvs: Float32Array | null;
  uvs2: Float32Array | null;
  colors: Float32Array | null;
  /** Every item's triangles, item after item. */
  indices: Uint32Array;
  /** Per item: where its indices start and how many there are. */
  ranges: Int32Array;
}

/**
 * The items as one mesh: positions placed by each matrix, normals and tangents turned with it (normalised), faces
 * flipped where a matrix mirrors, colours times the tint. An attribute some items lack is filled (texture coordinates
 * 0, colours white, tangents along x) when others have it; colours are made (white times the tint) when any item is
 * tinted.
 */
export function mergeItems(items: readonly MergeItem[]): Merged {
  let vertices = 0;
  let indexCount = 0;
  const has = { normals: false, tangents: false, uvs: false, uvs2: false, colors: false };
  for (const it of items) {
    vertices += it.positions.length / 3;
    indexCount += it.indices.length;
    if (it.normals) has.normals = true;
    if (it.tangents) has.tangents = true;
    if (it.uvs) has.uvs = true;
    if (it.uvs2) has.uvs2 = true;
    if (it.colors || (it.tint && it.tint.some((v) => v !== 1))) has.colors = true;
  }
  const positions = new Float32Array(vertices * 3);
  const normals = has.normals ? new Float32Array(vertices * 3) : null;
  const tangents = has.tangents ? new Float32Array(vertices * 4) : null;
  const uvs = has.uvs ? new Float32Array(vertices * 2) : null;
  const uvs2 = has.uvs2 ? new Float32Array(vertices * 2) : null;
  const colors = has.colors ? new Float32Array(vertices * 4) : null;
  const indices = new Uint32Array(indexCount);
  const ranges = new Int32Array(items.length * 2);
  let v0 = 0;
  let i0 = 0;
  items.forEach((it, k) => {
    const m = it.matrix;
    const n = it.positions.length / 3;
    for (let v = 0; v < n; v++) {
      const x = it.positions[v * 3]!;
      const y = it.positions[v * 3 + 1]!;
      const z = it.positions[v * 3 + 2]!;
      const o = (v0 + v) * 3;
      positions[o] = x * m[0]! + y * m[4]! + z * m[8]! + m[12]!;
      positions[o + 1] = x * m[1]! + y * m[5]! + z * m[9]! + m[13]!;
      positions[o + 2] = x * m[2]! + y * m[6]! + z * m[10]! + m[14]!;
      if (normals) {
        if (it.normals) {
          const nx = it.normals[v * 3]!;
          const ny = it.normals[v * 3 + 1]!;
          const nz = it.normals[v * 3 + 2]!;
          // As the shader turns a copy's normal: by its world matrix, then normalised (Babylon's thin instances do the same).
          const tx = nx * m[0]! + ny * m[4]! + nz * m[8]!;
          const ty = nx * m[1]! + ny * m[5]! + nz * m[9]!;
          const tz = nx * m[2]! + ny * m[6]! + nz * m[10]!;
          const l = Math.hypot(tx, ty, tz) || 1;
          normals[o] = tx / l;
          normals[o + 1] = ty / l;
          normals[o + 2] = tz / l;
        } else normals[o + 1] = 1;
      }
      if (tangents) {
        const t = (v0 + v) * 4;
        if (it.tangents) {
          const ax = it.tangents[v * 4]!;
          const ay = it.tangents[v * 4 + 1]!;
          const az = it.tangents[v * 4 + 2]!;
          const tx = ax * m[0]! + ay * m[4]! + az * m[8]!;
          const ty = ax * m[1]! + ay * m[5]! + az * m[9]!;
          const tz = ax * m[2]! + ay * m[6]! + az * m[10]!;
          const l = Math.hypot(tx, ty, tz) || 1;
          tangents[t] = tx / l;
          tangents[t + 1] = ty / l;
          tangents[t + 2] = tz / l;
          tangents[t + 3] = it.tangents[v * 4 + 3]!;
        } else {
          tangents[t] = 1;
          tangents[t + 3] = 1;
        }
      }
      if (uvs && it.uvs) {
        uvs[(v0 + v) * 2] = it.uvs[v * 2]!;
        uvs[(v0 + v) * 2 + 1] = it.uvs[v * 2 + 1]!;
      }
      if (uvs2 && it.uvs2) {
        uvs2[(v0 + v) * 2] = it.uvs2[v * 2]!;
        uvs2[(v0 + v) * 2 + 1] = it.uvs2[v * 2 + 1]!;
      }
      if (colors) {
        const c = (v0 + v) * 4;
        const t = it.tint;
        for (let q = 0; q < 4; q++) colors[c + q] = (it.colors ? it.colors[v * 4 + q]! : 1) * (t ? (t[q] ?? 1) : 1);
      }
    }
    const det = m[0]! * (m[5]! * m[10]! - m[6]! * m[9]!) - m[1]! * (m[4]! * m[10]! - m[6]! * m[8]!) + m[2]! * (m[4]! * m[9]! - m[5]! * m[8]!);
    const flip = det < 0;
    for (let t = 0; t + 2 < it.indices.length; t += 3) {
      const a = it.indices[t]! + v0;
      const b = it.indices[t + 1]! + v0;
      const c = it.indices[t + 2]! + v0;
      indices[i0 + t] = a;
      indices[i0 + t + 1] = flip ? c : b;
      indices[i0 + t + 2] = flip ? b : c;
    }
    ranges[k * 2] = i0;
    ranges[k * 2 + 1] = it.indices.length;
    v0 += n;
    i0 += it.indices.length;
  });
  return { positions, normals, tangents, uvs, uvs2, colors, indices, ranges };
}

/** The indices of the items `shown` says draw, in item order (into `out` when it is big enough; a view of it). */
export function shownIndices(all: Uint32Array, ranges: Int32Array, shown: (item: number) => boolean, out?: Uint32Array): Uint32Array {
  let total = 0;
  for (let k = 0; k < ranges.length / 2; k++) if (shown(k)) total += ranges[k * 2 + 1]!;
  const buf = out && out.length >= total ? out : new Uint32Array(total);
  let n = 0;
  for (let k = 0; k < ranges.length / 2; k++) {
    if (!shown(k)) continue;
    const start = ranges[k * 2]!;
    const count = ranges[k * 2 + 1]!;
    buf.set(all.subarray(start, start + count), n);
    n += count;
  }
  return buf.subarray(0, n);
}
