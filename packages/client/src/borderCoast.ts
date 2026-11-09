import type { Scene } from '@babylonjs/core/scene';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { COAST_BEACH, COAST_DEPTH, borderNoise, coastHeight, coastHeightAt, type BorderEdge, type BorderStyle, type CoastSide } from '@tiletrigger/shared';
import type { MapStyler } from './mapMeshes.ts';

/**
 * The "coast" border side drawn (map format v32; the layout: shared map/borderCoast.ts): one mesh of land past each
 * coast side (the ground at the line carried on outwards: sand along the shore, low headlands and dunes where cliffs
 * met the line, grass inland, rock where it is steep) in vertex colours over the sand texture, and the sea carrying
 * on past its shore. The forest it gets inland is BorderVisuals' own forest, laid along the inland stretches of the
 * line on the coast's ground (`forest`, `ground`). Scenery only: nothing here collides.
 */
export interface CoastMade {
  meshes: Mesh[];
  materials: StandardMaterial[];
  /** Stretches of the line for the forest, with the styles to treat its two ends as (round a corner, or the shore). */
  forest: { edge: BorderEdge; ends: [BorderStyle, BorderStyle] }[];
  /** The ground past the line where the coast's land is (the forest stands on it), else `fallback`. */
  ground: (x: number, z: number) => number;
}

/** Rows out from the line (m): close together near it, where the shapes change most. */
const ROWS = [0.05, 1, 2.5, 4.5, 7, 10, 14, 19, 25, 32, 40, 49, 59, 70, 82, 95, 108, COAST_DEPTH];
/** Metres between columns along the line. */
const STEP = 2.5;

export function buildCoast(scene: Scene, styler: MapStyler, sides: readonly CoastSide[], opts: { snowy: boolean; ground: (x: number, z: number) => number; neighbours: (e: BorderEdge) => [BorderStyle, BorderStyle] }): CoastMade {
  const land = { p: [] as number[], c: [] as number[], uv: [] as number[], i: [] as number[] };
  const sea = { p: [] as number[], c: [] as number[], i: [] as number[] };
  const scale = styler.groundScale('sand');
  const dry = Color3.FromHexString(opts.snowy ? '#c4c8cc' : '#e2cc96');
  const wet = Color3.FromHexString(opts.snowy ? '#7d8288' : '#a08a5e');
  const grass = Color3.FromHexString(opts.snowy ? '#e8ecf0' : '#7f9a52');
  const scrub = Color3.FromHexString(opts.snowy ? '#d6dbe0' : '#b8b27a');
  const rock = Color3.FromHexString(opts.snowy ? '#8a929c' : '#8d8a84');
  const deep = Color3.FromHexString('#1f4f6b');
  const shallow = Color3.FromHexString('#3f8a9c');
  const forest: CoastMade['forest'] = [];
  for (const c of sides) {
    const e = c.edge;
    const dir: [number, number] = [(e.b[0] - e.a[0]) / e.length, (e.b[1] - e.a[1]) / e.length];
    const at = (u: number, v: number): [number, number] => [e.a[0] + dir[0] * u + e.out[0] * v, e.a[1] + dir[1] * u + e.out[1] * v];
    // ---- the land
    const cols = Math.max(2, Math.ceil((c.u1 - c.u0) / STEP) + 1);
    const ys: number[] = [];
    const base = land.p.length / 3;
    for (let i = 0; i < cols; i++) {
      const u = c.u0 + ((c.u1 - c.u0) * i) / (cols - 1);
      for (const v of ROWS) {
        const y = coastHeight(c, u, v);
        const [x, z] = at(u, v);
        land.p.push(x, y, z);
        land.uv.push(x / scale, z / scale);
        ys.push(y);
      }
    }
    const R = ROWS.length;
    for (let i = 0; i < cols; i++) {
      for (let r = 0; r < R; r++) {
        const y = ys[i * R + r]!;
        // Steepness: the largest rise to a neighbour over the distance to it.
        let slope = 0;
        const du = (c.u1 - c.u0) / (cols - 1);
        if (i > 0) slope = Math.max(slope, Math.abs(y - ys[(i - 1) * R + r]!) / du);
        if (i < cols - 1) slope = Math.max(slope, Math.abs(y - ys[(i + 1) * R + r]!) / du);
        if (r > 0) slope = Math.max(slope, Math.abs(y - ys[i * R + r - 1]!) / (ROWS[r]! - ROWS[r - 1]!));
        if (r < R - 1) slope = Math.max(slope, Math.abs(y - ys[i * R + r + 1]!) / (ROWS[r + 1]! - ROWS[r]!));
        const over = y - c.sea;
        const j = borderNoise(c.seed, i * 37 + r);
        let col: Color3;
        if (over < 0.5) col = wet;
        else if (over < COAST_BEACH + 0.6) col = Color3.Lerp(wet, dry, Math.min(1, (over - 0.5) / 0.8));
        else if (over < COAST_BEACH + 3.5) col = Color3.Lerp(dry, scrub, Math.min(1, (over - COAST_BEACH - 0.6) / 2.9) * (0.6 + 0.4 * j));
        else col = Color3.Lerp(scrub, grass, Math.min(1, (over - COAST_BEACH - 3.5) / 3) * (0.75 + 0.25 * j));
        if (slope > 0.75) col = Color3.Lerp(col, rock, Math.min(1, (slope - 0.75) / 0.5));
        land.c.push(col.r, col.g, col.b, 1);
      }
    }
    for (let i = 0; i < cols - 1; i++) {
      for (let r = 0; r < R - 1; r++) {
        const a = base + i * R + r;
        const b = base + (i + 1) * R + r;
        land.i.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    // ---- the sea past each shore: deep away from the land, shallow along the shoreline
    for (const [a, b] of c.shore) {
      const atA = a <= 0;
      const atB = b >= e.length;
      // From the far end of the open water to just past where the shore meets higher ground.
      const lo = atA ? c.u0 : a - 10;
      const hi = atB ? c.u1 : b + 10;
      const coastAt = atA ? hi : lo;
      const us = atA && atB ? [lo, hi] : atA ? [lo, Math.max(lo, hi - 45), Math.max(lo, hi - 14), hi] : [lo, Math.min(hi, lo + 14), Math.min(hi, lo + 45), hi];
      const s0 = sea.p.length / 3;
      for (const u of us) {
        const d = Math.abs(u - coastAt);
        const k = atA && atB ? 0.4 : Math.min(1, d / 45);
        for (const [v, far] of [[0.05, 0], [600, 0.6], [2600, 1]] as const) {
          const [x, z] = at(u, v);
          const col = Color3.Lerp(shallow, deep, Math.max(k, far));
          sea.p.push(x, c.sea, z);
          sea.c.push(col.r, col.g, col.b, 1);
        }
      }
      for (let i = 0; i < us.length - 1; i++) {
        for (let r = 0; r < 2; r++) {
          const p = s0 + i * 3 + r;
          const q = s0 + (i + 1) * 3 + r;
          sea.i.push(p, q, p + 1, p + 1, q, q + 1);
        }
      }
    }
    // ---- the forest's stretches: inland only
    const [prev, next] = opts.neighbours(e);
    for (const [p0, q0] of c.inland) {
      // The forest's dark canopy band runs on 40 m past a free end: kept that far back from the shore.
      const p = p0 <= 0 ? p0 : p0 + 40;
      const q = q0 >= e.length ? q0 : q0 - 40;
      if (q - p < 6) continue;
      const a = at(p, 0);
      const b = at(q, 0);
      forest.push({ edge: { side: e.side, style: 'forest', a, b, out: e.out, length: q - p }, ends: [p <= 0 ? prev : 'coast', q >= e.length ? next : 'coast'] });
    }
  }
  const meshes: Mesh[] = [];
  const materials: StandardMaterial[] = [];
  const make = (name: string, g: { p: number[]; c: number[]; i: number[]; uv?: number[] }, mat: StandardMaterial) => {
    if (!g.i.length) return;
    const normals: number[] = [];
    VertexData.ComputeNormals(g.p, g.i, normals);
    // Faces up (the winding depends on which way the edge runs).
    let up = 0;
    for (let k = 1; k < normals.length; k += 3) up += normals[k]!;
    if (up < 0) {
      for (let k = 0; k < g.i.length; k += 3) [g.i[k + 1], g.i[k + 2]] = [g.i[k + 2]!, g.i[k + 1]!];
      normals.length = 0;
      VertexData.ComputeNormals(g.p, g.i, normals);
    }
    const vd = new VertexData();
    vd.positions = g.p;
    vd.indices = g.i;
    vd.colors = g.c;
    vd.normals = normals;
    if (g.uv) vd.uvs = g.uv;
    const m = new Mesh(name, scene);
    vd.applyToMesh(m);
    m.material = mat;
    meshes.push(m);
  };
  const sand = new StandardMaterial('border_coast_land', scene);
  sand.diffuseTexture = styler.groundMaterial('sand').diffuseTexture;
  sand.specularColor = new Color3(0.06, 0.06, 0.06);
  sand.backFaceCulling = false;
  materials.push(sand);
  make('border_coast', land, sand);
  const water = new StandardMaterial('border_coast_sea', scene);
  water.specularColor = new Color3(0.6, 0.6, 0.6);
  water.specularPower = 96;
  water.backFaceCulling = false;
  materials.push(water);
  make('border_coast_sea', sea, water);
  return { meshes, materials, forest, ground: (x, z) => coastHeightAt(sides, x, z) ?? opts.ground(x, z) };
}
