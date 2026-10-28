import type { Scene } from '@babylonjs/core/scene';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { coreMaterials, roadStrip, roadSurfaceY, trackGeometry, type MapDocument } from '@tiletrigger/shared';
import type { MapStyler } from './mapMeshes.ts';

/**
 * A race track drawn on the map: the road ribbon (asphalt or dirt, laid on
 * the ground it follows), white edge lines and a dashed centre line, red and
 * white curbs, a chequered start/finish line, and an arch over every
 * checkpoint (the start/finish arch is the big one). Shared by the game and
 * MapMaker's preview; geometry comes from the shared track code, so it sits
 * exactly where the simulation's road is.
 */
export function buildRoadMeshes(scene: Scene, doc: MapDocument, styler: MapStyler, name = 'road', o: { arches?: boolean } = {}): Mesh[] {
  const g = trackGeometry(doc);
  const t = doc.track;
  if (!g || !t) return [];
  const out: Mesh[] = [];
  const half = t.width / 2;
  const cols = Math.max(2, Math.ceil(t.width / 3));
  const surfaceId = t.surface === 'dirt' ? 'core.pbr_forest' : 'core.pbr_asphalt';
  const scale = coreMaterials.get(surfaceId)?.scale ?? 4;
  // The road's own copy of the ground material, pulled toward the camera so it never fights the terrain under it.
  const roadMat = styler.surfaceMaterial(doc, surfaceId, t.surface === 'dirt' ? '#b49a74' : null).clone(`${name}_surface`) as StandardMaterial;
  roadMat.zOffset = -2;
  out.push(strip(scene, `${name}_surface`, roadStrip(doc, -half, half, cols, 0.04), roadMat, (c, s) => [((c / cols) * t.width) / scale, s / scale]));
  if (t.surface === 'asphalt') {
    const white = flat(scene, `${name}_paint`, '#e8e8e2', -4);
    out.push(strip(scene, `${name}_edge_l`, roadStrip(doc, -half + 0.5, -half + 0.8, 1, 0.06), white));
    out.push(strip(scene, `${name}_edge_r`, roadStrip(doc, half - 0.8, half - 0.5, 1, 0.06), white));
    out.push(strip(scene, `${name}_centre`, roadStrip(doc, -0.15, 0.15, 1, 0.06), white, undefined, (s) => Math.floor(s / 3) % 2 === 0));
  }
  if (t.curbs) {
    const red = flat(scene, `${name}_curb_red`, '#c8322a', -4);
    const white = flat(scene, `${name}_curb_white`, '#ecebe6', -4);
    for (const [side, from, to] of [['l', -half - 1.1, -half + 0.1], ['r', half - 0.1, half + 1.1]] as const) {
      const rows = roadStrip(doc, from, to, 1, 0.1);
      out.push(strip(scene, `${name}_curb_${side}_r`, rows, red, undefined, (s) => Math.floor(s / 2) % 2 === 0));
      out.push(strip(scene, `${name}_curb_${side}_w`, rows, white, undefined, (s) => Math.floor(s / 2) % 2 === 1));
    }
  }
  // Chequered start/finish line: two rows of squares across the road.
  const line = g.gates[0]!;
  const finish = g.loop ? null : g.gates[g.gates.length - 1]!;
  for (const [k, gate] of [line, finish].entries()) {
    if (!gate) continue;
    const squares = Math.max(6, Math.round(t.width));
    const size = t.width / squares;
    const black = flat(scene, `${name}_chq_b`, '#141414', -5);
    const whiteSq = flat(scene, `${name}_chq_w`, '#f2f2f2', -5);
    for (const [colour, mat] of [[0, black], [1, whiteSq]] as const) {
      const vd = new QuadBuffer();
      for (let row = 0; row < 2; row++) {
        for (let i = 0; i < squares; i++) {
          if ((i + row) % 2 !== colour) continue;
          const a0 = -half + i * size;
          const a1 = a0 + size;
          const b0 = (row - 1) * size;
          const b1 = b0 + size;
          const pt = (lat: number, along: number): [number, number, number] => {
            const x = gate.x + gate.dz * lat + gate.dx * along;
            const z = gate.z - gate.dx * lat + gate.dz * along;
            return [x, roadSurfaceY(doc.terrain, x, z, gate.y) + 0.08, z];
          };
          vd.quad(pt(a0, b0), pt(a1, b0), pt(a1, b1), pt(a0, b1));
        }
      }
      out.push(vd.mesh(scene, `${name}_chequer${k}_${colour}`, mat));
    }
  }
  if (o.arches !== false) out.push(...arches(scene, doc, name));
  for (const m of out) {
    m.isPickable = false;
    m.freezeWorldMatrix();
  }
  return out;
}

/** An arch over each checkpoint: two posts and a banner; the start/finish one bigger and chequered. */
function arches(scene: Scene, doc: MapDocument, name: string): Mesh[] {
  const g = trackGeometry(doc)!;
  const out: Mesh[] = [];
  const post = flat(scene, `${name}_post`, '#3a3f48', 0);
  const banner = flat(scene, `${name}_banner`, '#f2c14e', 0, 0.35);
  const startBanner = flat(scene, `${name}_banner_start`, '#f2f2f2', 0, 0.2);
  g.gates.forEach((gate, i) => {
    const start = i === 0 || (!g.loop && i === g.gates.length - 1);
    const reach = gate.half + 1.8;
    const h = start ? 6 : 4.5;
    const yaw = Math.atan2(gate.dx, gate.dz);
    for (const side of [-1, 1]) {
      const x = gate.x + gate.dz * reach * side;
      const z = gate.z - gate.dx * reach * side;
      const y = roadSurfaceY(doc.terrain, x, z, gate.y);
      const p = CreateBox(`${name}_gate${i}_post${side}`, { width: 0.4, depth: 0.4, height: h }, scene);
      p.position.set(x, y + h / 2, z);
      p.material = post;
      out.push(p);
    }
    const b = CreateBox(`${name}_gate${i}_banner`, { width: reach * 2 + 0.4, height: start ? 1.4 : 0.7, depth: 0.15 }, scene);
    b.position.set(gate.x, roadSurfaceY(doc.terrain, gate.x, gate.z, gate.y) + h - (start ? 0.7 : 0.35), gate.z);
    b.rotation.y = yaw;
    b.material = start ? startBanner : banner;
    out.push(b);
  });
  return out;
}

const flats = new WeakMap<Scene, Map<string, StandardMaterial>>();

export function flat(scene: Scene, name: string, hex: string, zOffset: number, glow = 0): StandardMaterial {
  let cache = flats.get(scene);
  if (!cache) flats.set(scene, (cache = new Map()));
  const key = `${hex}|${zOffset}|${glow}`;
  let m = cache.get(key);
  if (!m) {
    m = new StandardMaterial(name, scene);
    m.diffuseColor = Color3.FromHexString(hex);
    m.specularColor = new Color3(0.1, 0.1, 0.1);
    m.emissiveColor = Color3.FromHexString(hex).scale(glow);
    m.zOffset = zOffset;
    cache.set(key, m);
  }
  return m;
}

/**
 * A mesh along the road from rows of points across it (see roadStrip),
 * optionally only the stretches `keep` accepts (dashes, curb stripes).
 */
export function strip(scene: Scene, name: string, road: { rows: number[][]; s: number[] }, material: StandardMaterial, uv?: (col: number, s: number) => [number, number], keep?: (s: number) => boolean): Mesh {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const cols = (road.rows[0]?.length ?? 3) / 3 - 1;
  for (let r = 0; r + 1 < road.rows.length; r++) {
    const s0 = road.s[r]!;
    const s1 = road.s[r + 1]!;
    if (keep && !keep((s0 + s1) / 2)) continue;
    const base = positions.length / 3;
    for (const [row, s] of [[road.rows[r]!, s0], [road.rows[r + 1]!, s1]] as const) {
      for (let c = 0; c <= cols; c++) {
        positions.push(row[c * 3]!, row[c * 3 + 1]!, row[c * 3 + 2]!);
        const [u, v] = uv ? uv(c, s) : [c / cols, s / 4];
        uvs.push(u, v);
      }
    }
    for (let c = 0; c < cols; c++) {
      const a = base + c;
      const b = a + 1;
      const d = base + cols + 1 + c;
      const e = d + 1;
      indices.push(a, b, e, a, e, d);
    }
  }
  const mesh = new Mesh(name, scene);
  if (!indices.length) return mesh;
  const vd = new VertexData();
  vd.positions = positions;
  vd.uvs = uvs;
  vd.indices = upward(positions, indices);
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, vd.indices, normals);
  vd.normals = normals;
  vd.applyToMesh(mesh);
  mesh.material = material;
  return mesh;
}

/** Wind every triangle so it faces up (the road's sides depend on which way the track runs). */
function upward(p: number[], idx: number[]): number[] {
  const out = idx.slice();
  for (let i = 0; i < out.length; i += 3) {
    const [a, b, c] = [out[i]! * 3, out[i + 1]! * 3, out[i + 2]! * 3];
    const ux = p[b]! - p[a]!;
    const uz = p[b + 2]! - p[a + 2]!;
    const vx = p[c]! - p[a]!;
    const vz = p[c + 2]! - p[a + 2]!;
    // Same sense as the terrain's up-facing triangles (see MapStyler.buildTerrain).
    if (uz * vx - ux * vz > 0) [out[i + 1], out[i + 2]] = [out[i + 2]!, out[i + 1]!];
  }
  return out;
}

class QuadBuffer {
  private readonly positions: number[] = [];
  private readonly indices: number[] = [];
  quad(a: [number, number, number], b: [number, number, number], c: [number, number, number], d: [number, number, number]): void {
    const base = this.positions.length / 3;
    this.positions.push(...a, ...b, ...c, ...d);
    this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  mesh(scene: Scene, name: string, material: StandardMaterial): Mesh {
    const mesh = new Mesh(name, scene);
    if (!this.indices.length) return mesh;
    const vd = new VertexData();
    vd.positions = this.positions;
    vd.indices = upward(this.positions, this.indices);
    const normals: number[] = [];
    VertexData.ComputeNormals(this.positions, vd.indices, normals);
    vd.normals = normals;
    vd.applyToMesh(mesh);
    mesh.material = material;
    return mesh;
  }
}

/** Dispose road meshes and the road's own surface material (the paint and curb materials are shared per scene). */
export function disposeRoadMeshes(meshes: readonly Mesh[]): void {
  for (const m of meshes) {
    if (m.name.endsWith('_surface')) m.material?.dispose();
    m.dispose();
  }
}
