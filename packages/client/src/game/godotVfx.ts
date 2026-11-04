import type { Scene } from '@babylonjs/core/scene';
import type { Camera } from '@babylonjs/core/Cameras/camera';
import { Effect } from '@babylonjs/core/Materials/effect';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { Constants } from '@babylonjs/core/Engines/constants';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import { Matrix, Quaternion, Vector2, Vector3, Vector4 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { versioned } from '../assetUrl.ts';
import { sampleCurve } from './muzzleFlash.ts';

/**
 * Plays Binbun's hit and explosion effects (CC0 Godot 4 packs; the full editions, content/vfx.json). The packs
 * draw everything in shaders and GPU particles, no pictures, so
 * tools/content/prepare-vfx.mjs writes each effect out whole as data
 * (public/vfx/hit_fx.json, explosion_fx.json): its particle emitters with
 * their settings, the meshes they draw, the materials (which shader, its
 * uniforms, its noise and gradient textures as settings) and the animation
 * that starts them. This is a small player for that data:
 *
 * - the particles, simulated here the way Godot's ParticleProcessMaterial
 *   does (emission shapes, direction and spread, speed, gravity, damping,
 *   radial acceleration, angles, scale, colour ramps and alpha curves, the
 *   sub-emitters that leave smoke behind flying bits), drawn as thin
 *   instances of the emitter's mesh, one draw per emitter;
 * - the meshes the animation moves and scales (glows, shock spheres);
 * - each pack shader rewritten in GLSL below (they read the particle's
 *   colour and alpha exactly as the Godot shaders read COLOR);
 * - the noise textures made from their FastNoiseLite settings (close in
 *   character, not bit-identical).
 *
 * Godot's lights are left out (a real light costs every pixel here).
 */

type Json = Record<string, unknown>;
interface Pack {
  effects: Record<string, { set?: string; root: Json; nodes: Json[]; animations: Record<string, { length: number; loop?: number; tracks: Track[] }> }>;
}
interface Track {
  type: string;
  path: string;
  interp?: number;
  keys: { times?: { '@PackedFloat32Array': number[] }; transitions?: { '@PackedFloat32Array': number[] }; values?: unknown[]; update?: number };
}

const BASE = `${import.meta.env.BASE_URL}vfx/`;
/** Marks effect meshes: the atmosphere leaves them out of shadows (atmosphere.ts `worldly`). */
const EFFECT = { effect: true };
const packs = new Map<string, Promise<Pack | null>>();
/** Fetch a pack's effects once ('hit_fx', 'explosion_fx', 'electric_fx' …). */
export function loadVfxPack(name: string): Promise<Pack | null> {
  let p = packs.get(name);
  if (!p) {
    p = fetch(versioned(`${BASE}${name}.json`))
      .then((r) => (r.ok ? (r.json() as Promise<Pack>) : null))
      .catch(() => null);
    packs.set(name, p);
  }
  return p;
}
const loaded = new Map<string, Pack>();

// ------------------------------------------------------------------ small helpers for the data

const num = (v: unknown, d: number): number => (typeof v === 'number' ? v : d);
const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d);
const ctor = (v: unknown, name: string): number[] | null => {
  const a = v && typeof v === 'object' ? (v as Record<string, unknown>)[`@${name}`] : undefined;
  return Array.isArray(a) ? (a as number[]) : null;
};
const vec3 = (v: unknown, d: [number, number, number]): [number, number, number] => {
  const a = ctor(v, 'Vector3');
  return a ? [a[0]!, a[1]!, a[2]!] : d;
};
const vec2 = (v: unknown, d: [number, number]): [number, number] => {
  const a = ctor(v, 'Vector2');
  return a ? [a[0]!, a[1]!] : d;
};
const color = (v: unknown, d: [number, number, number, number]): [number, number, number, number] => {
  const a = ctor(v, 'Color');
  return a ? [a[0]!, a[1]!, a[2]!, a[3] ?? 1] : d;
};
const packed = (v: unknown): number[] => {
  if (!v || typeof v !== 'object') return [];
  for (const k of ['@PackedFloat32Array', '@PackedColorArray', '@PackedVector2Array']) {
    const a = (v as Record<string, unknown>)[k];
    if (Array.isArray(a)) return a as number[];
  }
  return [];
};
const curveOf = (v: unknown): number[][] | null => {
  const c = v as Json | null;
  if (!c) return null;
  const curve = (c.type === 'CurveTexture' ? c.curve : c) as Json | null;
  const data = curve?._data;
  if (!Array.isArray(data)) return null;
  const pts: number[][] = [];
  for (let i = 0; i + 2 < data.length; i += 5) {
    const p = ctor(data[i], 'Vector2');
    if (p) pts.push([p[0]!, p[1]!, num(data[i + 1], 0), num(data[i + 2], 0)]);
  }
  return pts;
};
/** A CurveXYZTexture's three curves, or one curve used for all three. */
const scaleCurves = (v: unknown): [number[][] | null, number[][] | null, number[][] | null] | null => {
  const c = v as Json | null;
  if (!c) return null;
  if (c.type === 'CurveXYZTexture') return [curveOf(c.curve_x), curveOf(c.curve_y), curveOf(c.curve_z)];
  const one = curveOf(c);
  return [one, one, one];
};
interface Gradient {
  offsets: number[];
  colors: number[];
}
const gradientOf = (v: unknown): Gradient | null => {
  const t = v as Json | null;
  const g = (t?.gradient ?? null) as Json | null;
  if (!t) return null;
  if (!g) return { offsets: [0, 1], colors: [0, 0, 0, 1, 1, 1, 1, 1] };
  const offsets = packed(g.offsets);
  const colors = packed(g.colors);
  return { offsets: offsets.length ? offsets : [0, 1], colors: colors.length ? colors : [0, 0, 0, 1, 1, 1, 1, 1] };
};
function sampleGradient(g: Gradient, x: number, out: number[]): number[] {
  const { offsets, colors } = g;
  const n = offsets.length;
  if (x <= offsets[0]!) return out.splice(0, 4, ...colors.slice(0, 4)), out;
  for (let i = 0; i + 1 < n; i++) {
    const a = offsets[i]!;
    const b = offsets[i + 1]!;
    if (x > b) continue;
    const t = b > a ? (x - a) / (b - a) : 0;
    for (let k = 0; k < 4; k++) out[k] = colors[i * 4 + k]! + (colors[(i + 1) * 4 + k]! - colors[i * 4 + k]!) * t;
    return out;
  }
  for (let k = 0; k < 4; k++) out[k] = colors[(n - 1) * 4 + k]!;
  return out;
}

/** Godot's ease(): the transition curve between animation keys. */
function ease(x: number, c: number): number {
  if (x < 0) x = 0;
  if (x > 1) x = 1;
  if (c > 0) return c < 1 ? 1 - Math.pow(1 - x, 1 / c) : Math.pow(x, c);
  if (c < 0) return x < 0.5 ? Math.pow(x * 2, -c) * 0.5 : (1 - Math.pow(1 - (x - 0.5) * 2, -c)) * 0.5 + 0.5;
  return 0;
}

/** A value track at time t (linear with Godot's transitions; discrete tracks step). */
function trackAt(tr: Track, t: number): unknown {
  const times = tr.keys.times?.['@PackedFloat32Array'] ?? [];
  const values = tr.keys.values ?? [];
  const trans = tr.keys.transitions?.['@PackedFloat32Array'] ?? [];
  if (!times.length) return undefined;
  if (t <= times[0]!) return values[0];
  let i = 0;
  while (i + 1 < times.length && t >= times[i + 1]!) i++;
  if (i + 1 >= times.length || tr.keys.update === 1 || tr.keys.update === 2) return values[i];
  const a = values[i];
  const b = values[i + 1];
  const f = ease((t - times[i]!) / (times[i + 1]! - times[i]!), trans[i] ?? 1);
  if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * f;
  const va = ctor(a, 'Vector3');
  const vb = ctor(b, 'Vector3');
  if (va && vb) return { '@Vector3': va.map((x, k) => x + (vb[k]! - x) * f) };
  return f < 0.5 ? a : b;
}

// ------------------------------------------------------------------ noise (FastNoiseLite settings → a tileable texture)

function hash(x: number, y: number, s: number): number {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** Periodic gradient-ish value noise (smooth), period p cells. */
function smoothNoise(x: number, y: number, p: number, s: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const g = (i: number, j: number) => {
    const a = hash(((i % p) + p) % p, ((j % p) + p) % p, s) * Math.PI * 2;
    return [Math.cos(a), Math.sin(a)];
  };
  const dot = (i: number, j: number) => {
    const [gx, gy] = g(xi + i, yi + j);
    return gx! * (xf - i) + gy! * (yf - j);
  };
  const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
  const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
  const a = dot(0, 0) + (dot(1, 0) - dot(0, 0)) * u;
  const b = dot(0, 1) + (dot(1, 1) - dot(0, 1)) * u;
  return (a + (b - a) * v) * 0.7 + 0.5;
}
/** Periodic cellular (Worley) noise: distance to the nearest feature point. */
function cellNoise(x: number, y: number, p: number, s: number, manhattan: boolean): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let best = 9;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const cx = xi + i;
      const cy = yi + j;
      const px = cx + hash(((cx % p) + p) % p, ((cy % p) + p) % p, s);
      const py = cy + hash(((cx % p) + p) % p, ((cy % p) + p) % p, s + 17);
      const dx = Math.abs(x - px);
      const dy = Math.abs(y - py);
      best = Math.min(best, manhattan ? (dx + dy) * 0.7 : Math.hypot(dx, dy));
    }
  }
  return Math.min(1, best);
}

const noiseCache = new WeakMap<Scene, Map<string, Texture>>();
function noiseTexture(scene: Scene, spec: Json | null): Texture {
  let cache = noiseCache.get(scene);
  if (!cache) noiseCache.set(scene, (cache = new Map()));
  const key = JSON.stringify(spec ?? {});
  const hit = cache.get(key);
  if (hit) return hit;
  const n = (spec?.noise ?? {}) as Json;
  const type = num(n.noise_type, 1);
  const width = num(spec?.width, 512);
  const freq = num(n.frequency, 0.01);
  const fractal = num(n.fractal_type, 1);
  const octaves = fractal === 0 ? 1 : Math.min(4, num(n.fractal_octaves, 5));
  const gain = num(n.fractal_gain, 0.5);
  const seed = num(n.seed, 0) + 1;
  const manhattan = num(n.cellular_distance_function, 0) === 1;
  // Godot draws the noise at `width` pixels; this makes the same number of features at SIZE.
  const SIZE = 128;
  const period = Math.max(1, Math.round(freq * width));
  const data = new Float32Array(SIZE * SIZE);
  let lo = Infinity;
  let hi = -Infinity;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let v = 0;
      let amp = 1;
      let total = 0;
      for (let o = 0; o < octaves; o++) {
        const p = period << o;
        const fx = (x / SIZE) * p;
        const fy = (y / SIZE) * p;
        let s = type === 2 ? cellNoise(fx, fy, p, seed + o, manhattan) : smoothNoise(fx, fy, p, seed + o);
        if (fractal === 2) s = 1 - Math.abs(s * 2 - 1);
        v += s * amp;
        total += amp;
        amp *= gain;
      }
      v /= total;
      data[y * SIZE + x] = v;
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
  }
  const invert = bool(spec?.invert, false);
  const rgba = new Uint8Array(SIZE * SIZE * 4);
  const asNormal = bool(spec?.as_normal_map, false);
  const bump = num(spec?.bump_strength, 8);
  const h = (x: number, y: number) => {
    let v = (data[(((y % SIZE) + SIZE) % SIZE) * SIZE + (((x % SIZE) + SIZE) % SIZE)]! - lo) / Math.max(1e-6, hi - lo);
    return invert ? 1 - v : v;
  };
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      if (asNormal) {
        const dx = (h(x + 1, y) - h(x - 1, y)) * bump * 0.25;
        const dy = (h(x, y + 1) - h(x, y - 1)) * bump * 0.25;
        const l = Math.hypot(dx, dy, 1);
        rgba.set([((-dx / l) * 0.5 + 0.5) * 255, ((-dy / l) * 0.5 + 0.5) * 255, ((1 / l) * 0.5 + 0.5) * 255, 255], i);
      } else {
        const v = Math.round(h(x, y) * 255);
        rgba.set([v, v, v, 255], i);
      }
    }
  }
  const tex = RawTexture.CreateRGBATexture(rgba, SIZE, SIZE, scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
  tex.wrapU = Texture.WRAP_ADDRESSMODE;
  tex.wrapV = Texture.WRAP_ADDRESSMODE;
  cache.set(key, tex);
  return tex;
}

/** A GradientTexture2D (the flare's soft spot), drawn into a small texture. */
function gradientTexture(scene: Scene, spec: Json): Texture {
  let cache = noiseCache.get(scene);
  if (!cache) noiseCache.set(scene, (cache = new Map()));
  const key = `g${JSON.stringify(spec)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const SIZE = 64;
  const g = gradientOf(spec) ?? { offsets: [0, 1], colors: [0, 0, 0, 1, 1, 1, 1, 1] };
  const radial = num(spec.fill, 0) === 1;
  const from = vec2(spec.fill_from, [0, 0]);
  const to = vec2(spec.fill_to, [1, 0]);
  const rgba = new Uint8Array(SIZE * SIZE * 4);
  const c: number[] = [0, 0, 0, 0];
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = (x + 0.5) / SIZE;
      const v = (y + 0.5) / SIZE;
      const t = radial ? Math.hypot(u - from[0], v - from[1]) / len : ((u - from[0]) * (to[0] - from[0]) + (v - from[1]) * (to[1] - from[1])) / (len * len);
      sampleGradient(g, Math.min(1, Math.max(0, t)), c);
      rgba.set([c[0]! * 255, c[1]! * 255, c[2]! * 255, c[3]! * 255], (y * SIZE + x) * 4);
    }
  }
  const tex = RawTexture.CreateRGBATexture(rgba, SIZE, SIZE, scene, false, false, Texture.BILINEAR_SAMPLINGMODE);
  tex.wrapU = Texture.CLAMP_ADDRESSMODE;
  tex.wrapV = Texture.CLAMP_ADDRESSMODE;
  cache.set(key, tex);
  return tex;
}

/** A picture a pack's effect samples (Vol. 1 packs), shipped beside its JSON (public/vfx/<pack>_<name>.webp). */
function packTexture(scene: Scene, file: string): Texture {
  let cache = noiseCache.get(scene);
  if (!cache) noiseCache.set(scene, (cache = new Map()));
  const key = `t${file}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const tex = new Texture(versioned(`${BASE}${file}`), scene, false, true, Texture.TRILINEAR_SAMPLINGMODE);
  tex.wrapU = Texture.WRAP_ADDRESSMODE;
  tex.wrapV = Texture.WRAP_ADDRESSMODE;
  cache.set(key, tex);
  return tex;
}

// ------------------------------------------------------------------ meshes (Godot's primitive meshes, with their UVs)

/** Each base mesh's vertex data, taken once (every piece of it gets its own copy on the GPU). */
const baseData = new WeakMap<Mesh, VertexData>();

/**
 * A playing effect's mesh: a base mesh's shape, with its settings. Not `clone()`: that deep-copies the
 * source's properties, about a millisecond a mesh, every time an effect plays. Not the base's geometry either:
 * thin instances keep their matrix, colour and extra buffers on the geometry, so pieces sharing one drew with
 * whichever piece set its buffers last, and drew nothing once that piece was gone (two fires of one kind, a
 * lasting effect started after the same effect was warmed: its MeshInstance parts, a fire's `Core`, vanished).
 */
function pieceOf(base: Mesh, name: string): Mesh {
  const mesh = new Mesh(name, base.getScene());
  let data = baseData.get(base);
  if (!data) baseData.set(base, (data = VertexData.ExtractFromMesh(base, false, true)));
  data.applyToMesh(mesh, false);
  mesh.isPickable = false;
  mesh.alwaysSelectAsActiveMesh = true;
  mesh.doNotSyncBoundingInfo = true;
  return mesh;
}

function godotMesh(scene: Scene, spec: Json, name: string): Mesh {
  const type = String(spec.type);
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const grid = (cols: number, rows: number) => {
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const a = j * (cols + 1) + i;
        indices.push(a, a + 1, a + cols + 1, a + 1, a + cols + 2, a + cols + 1);
      }
    }
  };
  if (type === 'QuadMesh' || type === 'PlaneMesh') {
    const [w, h] = vec2(spec.size, type === 'PlaneMesh' ? [2, 2] : [1, 1]);
    const off = vec3(spec.center_offset, [0, 0, 0]);
    const orient = num(spec.orientation, type === 'PlaneMesh' ? 1 : 2);
    const sx = Math.min(16, num(spec.subdivide_width, 0)) + 1;
    const sy = Math.min(16, num(spec.subdivide_depth, 0)) + 1;
    for (let j = 0; j <= sy; j++) {
      for (let i = 0; i <= sx; i++) {
        const u = i / sx;
        const v = j / sy;
        const a = (u - 0.5) * w;
        const b = (0.5 - v) * h;
        // FACE_Z: XY plane facing +Z; FACE_Y: XZ plane facing +Y (v runs to -Z); FACE_X: ZY plane facing +X.
        if (orient === 2) positions.push(a + off[0], b + off[1], off[2]), normals.push(0, 0, 1);
        else if (orient === 1) positions.push(a + off[0], off[1], -b + off[2]), normals.push(0, 1, 0);
        else positions.push(off[0], b + off[1], -a + off[2]), normals.push(1, 0, 0);
        uvs.push(u, v);
      }
    }
    grid(sx, sy);
  } else if (type === 'SphereMesh') {
    const r = num(spec.radius, 0.5);
    const height = num(spec.height, 1);
    const hemi = bool(spec.is_hemisphere, false);
    const seg = Math.max(8, Math.min(32, num(spec.radial_segments, 64) / 2));
    const rings = Math.max(4, Math.min(16, num(spec.rings, 32) / 2));
    for (let j = 0; j <= rings; j++) {
      const v = j / rings;
      // Godot's sphere: v = 0 at the top; a hemisphere stops at the equator.
      const lat = hemi ? (v * Math.PI) / 2 : v * Math.PI;
      const y = Math.cos(lat) * (hemi ? height : height / 2);
      const rr = Math.sin(lat) * r;
      for (let i = 0; i <= seg; i++) {
        const u = i / seg;
        const a = u * Math.PI * 2;
        const x = Math.sin(a) * rr;
        const z = Math.cos(a) * rr;
        positions.push(x, y, z);
        const n = new Vector3(x / r, y / Math.max(1e-6, hemi ? height : height / 2), z / r).normalize();
        normals.push(n.x, n.y, n.z);
        uvs.push(u, v);
      }
    }
    grid(seg, rings);
  } else if (type === 'TorusMesh') {
    // A ring lying flat (round Y): u round the ring, v round its tube.
    const inner = num(spec.inner_radius, 0.5);
    const outer = num(spec.outer_radius, 1);
    const R = (inner + outer) / 2;
    const r = (outer - inner) / 2;
    const seg = Math.max(8, Math.min(32, num(spec.rings, 64)));
    const side = Math.max(4, Math.min(12, num(spec.ring_segments, 32)));
    for (let j = 0; j <= side; j++) {
      const v = j / side;
      const b = v * Math.PI * 2;
      for (let i = 0; i <= seg; i++) {
        const u = i / seg;
        const a = u * Math.PI * 2;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        positions.push(ca * (R + r * Math.cos(b)), r * Math.sin(b), sa * (R + r * Math.cos(b)));
        normals.push(ca * Math.cos(b), Math.sin(b), sa * Math.cos(b));
        uvs.push(u, v);
      }
    }
    grid(seg, side);
  } else {
    // Cylinders and tube trails: open tubes along Y, v = 0 at the top. Godot puts a cylinder's side in the top half
    // of its UVs (v 0..0.5; the caps take the rest), and the packs' shaders are written for that.
    const top = type === 'TubeTrailMesh' ? num(spec.radius, 0.5) : num(spec.top_radius, 0.5);
    const bottom = type === 'TubeTrailMesh' ? num(spec.radius, 0.5) : num(spec.bottom_radius, 0.5);
    const height = type === 'TubeTrailMesh' ? num(spec.section_length, 0.2) * num(spec.sections, 5) : num(spec.height, 2);
    const seg = Math.max(6, Math.min(24, num(spec.radial_segments, 24)));
    // Zaps bend their tubes along their length: those need the rings they were made with (capped).
    const rings = Math.max(4, Math.min(32, num(spec.rings, 4)));
    for (let j = 0; j <= rings; j++) {
      const v = j / rings;
      const y = (0.5 - v) * height;
      const rr = top + (bottom - top) * v;
      for (let i = 0; i <= seg; i++) {
        const u = i / seg;
        const a = u * Math.PI * 2;
        positions.push(Math.sin(a) * rr, y, Math.cos(a) * rr);
        normals.push(Math.sin(a), (bottom - top) / Math.max(1e-6, height), Math.cos(a));
        uvs.push(u, type === 'TubeTrailMesh' ? v : v * 0.5);
      }
    }
    grid(seg, rings);
  }
  const vd = new VertexData();
  vd.positions = positions;
  vd.normals = normals;
  vd.uvs = uvs;
  vd.indices = indices;
  const mesh = new Mesh(name, scene);
  vd.applyToMesh(mesh, true);
  mesh.isPickable = false;
  mesh.alwaysSelectAsActiveMesh = true;
  mesh.doNotSyncBoundingInfo = true;
  return mesh;
}

// ------------------------------------------------------------------ the shaders, rewritten from the packs (GLSL)

/** Each pack shader: its uniforms (name → default), how it blends, and its fragment code (after `common`). */
interface ShaderPort {
  uniforms: Record<string, number | number[]>;
  samplers?: string[];
  blend: 'add' | 'mix' | 'cut';
  cut?: number;
  cull?: boolean;
  billboardUniform?: boolean;
  /** The shader turns its quads to the camera itself (Godot's billboard written into its vertex()). */
  billboard?: boolean;
  lit?: boolean;
  vertex?: string;
  fragment: string;
  /** GLSL functions the bodies call (put before main in both stages). */
  helpers?: string;
}

const PORTS: Record<string, ShaderPort> = {
  // ---- hits
  four_point_star: {
    uniforms: { primary_color: [1, 1, 1], secondary_color: [1, 0.8, 0.4], emission: 2, emission_mult: 1, star_shape: 2, star_smoothness: 0.1 },
    blend: 'add',
    fragment: `
      vec2 uv = abs(vUV * 2.0 - 1.0);
      float decay = vColor.a;
      float value = clamp(pow(uv.x, u_star_shape * decay) + pow(uv.y, u_star_shape * decay), 0.0, 2.0);
      // No smoothness is a hard edge (smoothstep with equal edges is undefined in GLSL).
      value = u_star_smoothness < 0.001 ? 1.0 - step(0.95, value) : smoothstep(0.95, 0.95 - u_star_smoothness, value);
      outColor = mix(u_secondary_color, u_primary_color, value) * vColor.rgb * u_emission * u_emission_mult;
      outAlpha = value;`,
  },
  flare: {
    uniforms: { primary_color: [1, 1, 1], secondary_color: [1, 0.8, 0.4], emission: 2, emission_mult: 1, streaks_amount: 4, variance1_amplitude: 12, variance2_amplitude: 5, edge_hardness: 0.5, edge_position: 0.1 },
    samplers: ['flare_texture'],
    blend: 'add',
    cull: false,
    billboardUniform: true,
    fragment: `
      float flare = texture2D(flare_texture, vUV).r;
      flare = pow(flare, 8.0) * 0.8;
      vec2 c = vUV - 0.5;
      float angle = atan(c.x, c.y);
      float idOff = vExtra.x;
      float streaks = pow(cos((angle + idOff) * u_streaks_amount) * 0.5 + 0.5, 16.0);
      streaks *= sin((angle + idOff) * u_variance1_amplitude) * 0.5 + 0.5;
      float value = overlay(flare, streaks);
      value = max(value, flare * 0.5);
      value *= 0.5 + (sin((angle + idOff) * u_variance2_amplitude + idOff) * 0.5 + 0.5) * 0.5;
      value = smoothstep(mix(0.0, u_edge_position, u_edge_hardness), mix(1.0, u_edge_position + 0.01, u_edge_hardness), value);
      outColor = mix(u_secondary_color, u_primary_color, value) * vColor.rgb * u_emission * vColor.a * u_emission_mult;
      outAlpha = value;`,
  },
  streaks: {
    uniforms: { primary_color: [1, 1, 1], secondary_color: [1, 0.8, 0.4], emission: 2, emission_mult: 1, streaks1_count: 5, streaks2_count: 11, streaks_fade: 0.4, streaks_thickness: 0.5, center_radius: 0.1, fade_radius: 0.4 },
    blend: 'add',
    billboardUniform: true,
    fragment: `
      vec2 c = vUV - 0.5;
      float angle = atan(c.x, c.y);
      float radius = length(c) * 2.0;
      float viewOffset = vNormal.x * 0.5 + 0.5;
      if (vNormal.z > 0.0) viewOffset = 1.0 - viewOffset;
      viewOffset *= 6.2831853;
      float s1 = sin(angle * u_streaks1_count + viewOffset + u_time);
      float s2 = sin(angle * u_streaks2_count - viewOffset - u_time);
      float value = overlay(s1, s2);
      value -= (1.0 - radius) * u_streaks_fade;
      value *= 1.0 - (radius - value * u_streaks_thickness);
      float mask = max(1.0 - radius, 0.0);
      value *= mask;
      value = min(value, mask);
      value = smoothstep(0.1, 1.0, value);
      value *= pow(clamp((radius - u_center_radius) / (u_fade_radius - u_center_radius), 0.0, 1.0), 4.0);
      outColor = mix(u_secondary_color, u_primary_color, value) * vColor.rgb * u_emission * u_emission_mult;
      outAlpha = value * vColor.a;`,
  },
  glow: {
    uniforms: { primary_color: [1, 1, 1], secondary_color: [1, 0.8, 0.4], emission: 2, emission_mult: 1 },
    blend: 'add',
    fragment: `
      float fresnel = clamp(pow(max(dot(normalize(vNormal), normalize(vView)), 0.0), 8.0), 0.0, 1.0);
      outColor = mix(u_secondary_color, u_primary_color, fresnel) * vColor.a * u_emission * u_emission_mult;
      outAlpha = fresnel;`,
  },
  impact_core: {
    uniforms: { primary_color: [1, 1, 1], secondary_color: [1, 0.8, 0.4], emission: 2, emission_mult: 1, alpha_as_factor: 0, grow_factor: 0.5, streak_amount: 7, clearance: 0, variance_amplitude: 10, variance_strength: 0.1, edge_hardness: 0.5, edge_position: 0.5 },
    blend: 'mix',
    billboardUniform: true,
    fragment: `
      vec2 c = vUV * 2.0 - 1.0;
      float radius = length(c);
      float angle = atan(c.x, c.y);
      float factor = u_alpha_as_factor > 0.5 ? vColor.a : u_grow_factor;
      factor = factor * 4.0 - 1.0;
      float offset = (abs(sin(angle * (u_streak_amount * 0.5) + u_time)) * radius) + u_clearance;
      offset += (sin(angle * u_variance_amplitude) * radius) * u_variance_strength;
      radius += offset * 0.5;
      float value = 1.0 - abs(radius * 2.0 - factor);
      value *= max(pow(max(1.0 - radius, 0.0), 0.1), 0.0);
      value = smoothstep(mix(0.0, u_edge_position, u_edge_hardness), mix(1.0, u_edge_position + 0.01, u_edge_hardness), value);
      outColor = mix(u_secondary_color, u_primary_color, value) * vColor.rgb * u_emission * u_emission_mult;
      outAlpha = value;`,
  },
  impact_slash: {
    uniforms: { primary_color: [1, 1, 1], secondary_color: [1, 0.6, 0.2], emission: 2, emission_mult: 1, pinch_amount: 0.4, alpha_as_factor: 0, animation_factor: 0.5, noise_scale: [1, 0.4], edge_hardness: 0.8 },
    samplers: ['noise_texture'],
    blend: 'mix',
    fragment: `
      float factor = u_alpha_as_factor > 0.5 ? vColor.a : u_animation_factor;
      vec2 s = (1.0 - vUV - vec2(0.5, 0.0)) * vec2(2.0, 1.0);
      float r = length(s);
      float gradient = pow(max(1.0 - vUV.y, 0.0), 0.5) * 2.0;
      r /= (1.0 - u_pinch_amount) + gradient * u_pinch_amount;
      float idOff = vExtra.x / 3.14159265;
      float noise = texture2D(noise_texture, (vUV + vec2(0.0, factor) + idOff) * u_noise_scale).r;
      float shape = (r - noise * 0.5) * 2.0;
      float value = 1.0 - abs(shape * 2.0 - (factor * 4.0 - 1.0));
      value *= clamp(1.0 - shape * shape * shape, 0.0, 1.0) * gradient;
      value *= pow(max(factor, 0.0), 0.1);
      value *= min(vUV.y * 8.0, 1.0);
      value = smoothstep(mix(0.0, 0.19, u_edge_hardness), mix(1.0, 0.2, u_edge_hardness), value);
      outColor = mix(u_secondary_color, u_primary_color, value) * vColor.rgb * u_emission * u_emission_mult;
      outAlpha = value;`,
  },
  impact_sphere: {
    uniforms: { primary_color: [1, 1, 1], secondary_color: [1, 0.8, 0.4], emission: 2, emission_mult: 1, alpha_as_factor: 0, animation_factor: 0.5, scroll: [0.2, 0.2], edge_hardness: 0.5, edge_position: 0.5, noise_displacement: 0.2, displacement: 0.2 },
    samplers: ['noise_texture'],
    blend: 'add',
    cull: false,
    vertex: `
      float pole = max(uv.y, 1.0 - uv.y) * 2.0 - 1.0;
      pole = 1.0 - pow(pole, 8.0);
      float nz = min(texture2D(noise_texture, uv + u_scroll * u_time).r, 1.0) * pole;
      float factor = u_alpha_as_factor > 0.5 ? pcolor.a : max(u_animation_factor, 0.0);
      p += n * nz * u_noise_displacement * factor;
      p += n * u_displacement * factor;`,
    fragment: `
      float pole = max(vUV.y, 1.0 - vUV.y) * 2.0 - 1.0;
      pole = 1.0 - pow(pole, 8.0);
      float noise = min(texture2D(noise_texture, vUV + u_scroll * u_time).r, 1.0) * pole;
      float factor = u_alpha_as_factor > 0.5 ? vColor.a : max(u_animation_factor, 0.0);
      noise += (1.0 - factor) * 2.0 - 1.0;
      float value = smoothstep(mix(0.0, u_edge_position, u_edge_hardness), mix(1.0, u_edge_position + 0.01, u_edge_hardness), clamp(noise, 0.0, 1.0));
      vec3 col = mix(u_secondary_color, u_primary_color, value) * u_emission * u_emission_mult;
      if (!gl_FrontFacing) col = u_secondary_color;
      outColor = col * u_emission;
      outAlpha = value;`,
  },
  spiral_dust: {
    uniforms: { primary_color: [1, 1, 1], secondary_color: [1, 0.8, 0.4], emission: 4, emission_mult: 1, alpha_as_factor: 0, grow_factor: 0.5, streak_count: 3, streak_twist: 3, streak_exponent: 2, streak_scroll: 3, noise_scroll: 0.2, noise_twist: 2, spiral_noise_scale: [1, 1], edge_hardness: 0, edge_position: 0.5 },
    samplers: ['noise_texture'],
    blend: 'add',
    fragment: `
      vec2 c = vUV * 2.0 - 1.0;
      float angle = atan(c.x, c.y);
      float radius = clamp(length(c), 0.0, 1.0);
      vec2 nuv = vec2((angle + radius * u_noise_twist) / 6.2831853, radius - u_time * u_noise_scroll);
      float noise = texture2D(noise_texture, nuv * u_spiral_noise_scale).r;
      float spiral = abs(sin((angle * (u_streak_count * 0.5) + vExtra.x) + (radius * u_streak_twist) - u_time * u_streak_scroll));
      spiral = pow(spiral, u_streak_exponent);
      float factor = u_alpha_as_factor > 0.5 ? vColor.a : u_grow_factor;
      float mask = radius + (1.0 - spiral) * 0.05;
      mask = max(1.0 - abs(mask * 2.0 - factor * 3.0), 0.0) * (1.0 - mask);
      mask = clamp(sqrt(max(mask, 0.0)), 0.0, 1.0);
      noise *= mask * spiral;
      noise = pow(noise, 4.0) * 10.0;
      noise = smoothstep(mix(0.0, u_edge_position, u_edge_hardness), mix(1.0, u_edge_position + 0.01, u_edge_hardness), noise);
      outColor = mix(u_secondary_color, u_primary_color, noise) * vColor.rgb * u_emission * u_emission_mult;
      outAlpha = sqrt(max(noise, 0.0)) * vColor.a;`,
  },
  // ---- explosions
  explosion_bits: {
    uniforms: { primary_color: [1, 1, 1], secondary_color: [1, 1, 1], emission: 2 },
    blend: 'cut',
    cut: -1,
    fragment: `
      outColor = mix(u_secondary_color, u_primary_color, vColor.a) * u_emission;
      outAlpha = 1.0;`,
  },
  explosion_core: {
    uniforms: { primary_color: [1, 1, 1], emission: 3, noise_scale: [1, 1], noise_scroll: [0, 0.2], noise_shape: 1 },
    samplers: ['noise_texture'],
    blend: 'cut',
    cut: 0.1,
    cull: false,
    vertex: `
      float nz = texture2D(noise_texture, uv * 2.0).r;
      p += n * nz * 0.4 * (1.0 - pcolor.a);`,
    fragment: `
      float noise = texture2D(noise_texture, vUV * 2.0 * u_noise_scale + u_time * u_noise_scroll).r;
      noise = pow(noise, u_noise_shape);
      outAlpha = clamp((noise + 1.0) - ((1.0 - vColor.a) * 2.0), 0.0, 1.0);
      outColor = u_primary_color * 20.0;`,
  },
  explosion_impact: {
    uniforms: { primary_color: [1, 1, 1], emission: 2, effect_decay: 0, noise_scale: [1, 1], noise_scroll: [0, 0.2], noise_shape: 1, streak_amount: 7 },
    samplers: ['noise_texture'],
    blend: 'add',
    cut: 0.2,
    cull: false,
    fragment: `
      float noise = texture2D(noise_texture, vUV * 2.0 * u_noise_scale + u_time * u_noise_scroll).r;
      noise = pow(noise, u_noise_shape);
      float wave = sin(vUV.x * 6.2831853 * u_streak_amount);
      float decay = 1.0 - vColor.a;
      float y = vUV.y * 4.0 - 1.0;
      float shape = 1.0 - abs((y - ((1.0 - decay) - 0.25)) + wave * 0.25 * decay);
      shape = (shape - 0.75) / 0.25;
      float value = shape - (2.0 - noise) * (0.2 + pow(decay, 2.0) * 0.8);
      outAlpha = max(value, 0.0);
      outColor = u_primary_color * u_emission;`,
  },
  explosion_rings: {
    uniforms: { primary_color: [1, 1, 1], secondary_color: [1, 1, 1], emission: 2, noise_scale: [1, 1], noise_scroll: [0, 0.2], noise_shape: 1 },
    samplers: ['noise_texture'],
    blend: 'add',
    cut: 0.2,
    cull: false,
    fragment: `
      float decay = 1.0 - vColor.a;
      float mask = 1.0 - abs(vUV.y * 4.0 - 1.0);
      float noise = texture2D(noise_texture, (vUV * vec2(2.0, 1.0) * u_noise_scale) + u_noise_scroll * u_time).r;
      noise = pow(noise, u_noise_shape);
      float value = max(mask - (1.0 - noise) - decay, 0.0);
      outColor = (gl_FrontFacing ? u_primary_color : u_secondary_color) * u_emission;
      outAlpha = value;`,
  },
  explosion_smoke: {
    uniforms: { effect_decay: 0, is_particle: 1, primary_color: [1, 1, 1], secondary_color: [1, 1, 1], tertiary_color: [0.13, 0.13, 0.13], emission: 2, noise_scale: [1, 1], extra_scale: [1, 1], noise_scroll: [0, 0.2], use_stepped_shading: 1, shadow_steps: 3, displacement_amount: 0.2, pole_displacement_amount: 0 },
    samplers: ['smoke_texture', 'normal_texture'],
    blend: 'cut',
    cut: 0.5,
    lit: true,
    vertex: `
      float rnd = pcolor.r;
      vec2 nuv = (uv + rnd + u_noise_scroll * u_time) * u_noise_scale;
      float nz = texture2D(smoke_texture, nuv).r;
      float mask = sin(uv.y * 3.14159265);
      p += n * nz * u_displacement_amount * mask;
      p += n * pow(mask - 1.0, 3.0) * u_pole_displacement_amount;`,
    fragment: `
      float rnd = vColor.r;
      float decay = u_is_particle > 0.5 ? (1.0 - vColor.a * (1.0 - max(u_effect_decay, vExtra.y))) : max(u_effect_decay, vExtra.y);
      vec2 nuv = (vUV + rnd + u_noise_scroll * u_time) * u_noise_scale * u_extra_scale;
      float noise = texture2D(smoke_texture, nuv).r;
      float nv = max((1.0 - noise) - clamp(decay * 2.0, 0.0, 1.0), 0.0);
      nv = smoothstep(0.0, 0.5, nv);
      vec3 albedo = mix(u_tertiary_color, u_primary_color, nv);
      outAlpha = clamp((1.0 + noise) - (min(decay, 1.0) * 2.0), 0.0, 1.0);
      // Lit in steps (toon smoke): the sun on the perturbed normal, plus the sky.
      vec3 nm = texture2D(normal_texture, nuv).rgb * 2.0 - 1.0;
      vec3 N = normalize(normalize(vNormal) + nm * 0.6);
      float light = max(dot(N, -u_sunDir), 0.0);
      if (u_use_stepped_shading > 0.5) light = floor(light * u_shadow_steps) / (u_shadow_steps - 1.0);
      outColor = albedo * (u_ambient + u_sunColor * light) + albedo * nv * u_emission;`,
  },
  explosion_sphere: {
    uniforms: { effect_decay: 0, primary_color: [1, 1, 1], secondary_color: [1, 1, 1], emission: 2, noise_scale: [1, 1], noise_scroll: [-0.2, 0.2], noise_shape: 1, noise_twist: 0.5 },
    samplers: ['noise_texture'],
    blend: 'cut',
    cut: 0.001,
    vertex: `
      vec2 nuv = uv * u_noise_scale + u_noise_scroll * u_time;
      nuv.x += nuv.y * u_noise_twist;
      float value = texture2D(noise_texture, nuv).r;
      float decay = max(u_effect_decay, pextra.y);
      p += n * value * 0.4 * sin(uv.y * 3.14159265) + n * decay;`,
    fragment: `
      vec2 nuv = vUV * u_noise_scale + u_noise_scroll * u_time;
      nuv.x += nuv.y * u_noise_twist;
      float value = texture2D(noise_texture, nuv).r;
      float decay = max(u_effect_decay, vExtra.y);
      outAlpha = clamp(value - decay, 0.0, 1.0);
      outColor = mix(u_secondary_color, u_primary_color, max(value - decay, 0.0)) * u_emission;`,
  },
  explosion_trails: {
    uniforms: { primary_color: [1, 1, 1], secondary_color: [1, 1, 1], emission: 2, noise_scale: [1, 1], noise_scroll: [0, 0.2] },
    samplers: ['noise_texture'],
    blend: 'add',
    cut: 0.2,
    vertex: `
      float wave = sin((uv.x + uv.y - u_time) * 6.2831853 * 2.0) * 0.5 + 0.5;
      p += n * wave * 0.2 * (uv.y * 2.0);`,
    fragment: `
      float decay = 1.0 - vColor.a;
      float noise = texture2D(noise_texture, vUV).r;
      float value = overlay(1.0 - vUV.y * 2.0, noise);
      outAlpha = max(value - decay, 0.0);
      outColor = mix(u_secondary_color, u_primary_color, smoothstep(0.0, 1.0, value)) * u_emission;`,
  },
  smoke_trail: {
    uniforms: { tertiary_color: [0.13, 0.13, 0.13] },
    samplers: ['noise_texture'],
    blend: 'cut',
    cut: 0.1,
    lit: true,
    billboardUniform: true,
    fragment: `
      float radius = length(vUV * 2.0 - 1.0);
      float noise = texture2D(noise_texture, vUV * 0.5 + vColor.r).r;
      float value = noise - (1.0 - vColor.a) - pow(radius, 4.0);
      outAlpha = clamp(value, 0.0, 1.0);
      outColor = u_tertiary_color * (u_ambient + u_sunColor * 0.6);`,
  },
};

// ---- Electric FX (Binbun VFX Vol. 2): the pack's own glow and impact sphere differ from the hit pack's
PORTS['ElectricFX/glow'] = {
  uniforms: { primary_color: [1, 1, 1], secondary_color: [0, 0.84, 1], emission: 2, exponent: 4 },
  blend: 'add',
  fragment: `
      float fresnel = clamp(pow(max(dot(normalize(vView), normalize(vNormal)), 0.0), u_exponent), 0.0, 1.0);
      outColor = mix(u_secondary_color, u_primary_color, fresnel) * u_emission;
      outAlpha = fresnel * vColor.a * vExtra.w;`,
};
PORTS['ElectricFX/impact_sphere'] = {
  uniforms: { primary_color: [1, 1, 1], emission: 2, noise_scale: [1, 1], edge_hardness: 0.5 },
  samplers: ['noise_texture'],
  blend: 'mix',
  fragment: `
      float noise = texture2D(noise_texture, vUV * u_noise_scale).r;
      float a = smoothstep(1.0 - vColor.a, 1.0, noise);
      a = smoothstep(0.5 * u_edge_hardness, 1.0 - 0.5 * u_edge_hardness, a);
      outColor = u_primary_color * u_emission;
      outAlpha = a * vExtra.w;`,
};
/** A bolt: a tall tube bent into a zigzag along its length (Y), dissolving into its noise as it fades. */
PORTS.zap = {
  uniforms: { primary_color: [1, 1, 1], secondary_color: [0, 0.84, 1], noise_scale: [1, 1], noise_strength: 0.4, frequency: 0.4, amplitude: 0.4, zap_shape: 1 },
  samplers: ['noise_texture'],
  blend: 'cut',
  cut: 0.5,
  cull: false,
  vertex: `
      // Metres along the bolt (Godot reads the world height of a bolt standing up; ours may lie along any line).
      float y = p.y * length(fw[1].xyz) / max(length(fw[0].xyz), 1e-4);
      float motion = u_time * 0.1;
      float rnd = pcolor.r;
      vec4 w;
      for (int i = 0; i < 4; i++) {
        float fr = (i == 1 || i == 3) ? u_frequency * 1.5 : u_frequency;
        float off = i == 0 ? motion + rnd : i == 1 ? 3.14159265 - motion - rnd : i == 2 ? -3.14159265 + motion + rnd : -6.2831853 - motion - rnd;
        float wave = abs(fract(y * fr + off) * 2.0 - 1.0) - 0.5;
        if (u_zap_shape > 2.5) wave = wave * wave * wave * wave * wave * 30.0;
        else if (u_zap_shape > 1.5) wave = wave * wave * wave * 6.0;
        w[i] = wave;
      }
      vec2 offset = vec2(w.x + w.y, w.z + w.w);
      float mask = pow(max(1.0 - uv.y * 2.0, 0.0), 0.5);
      p.xz += offset * u_amplitude * mask * (1.0 + (1.0 - pcolor.a));
      float detail = texture2D(noise_texture, vec2(uv.x, y) * u_noise_scale).r * u_noise_strength * mask;
      p.xz += n.xz * detail * offset;`,
  fragment: `
      float fresnel = pow(max(dot(normalize(vView), normalize(vNormal)), 0.0), 2.0);
      float noise = texture2D(noise_texture, vec2(vUV.x, vUV.y * 2.0) * u_noise_scale).r;
      float a = step(1.0 - vColor.a * vExtra.w, noise);
      a = clamp(a * (vUV.y * 4.0), 0.0, 1.0);
      outColor = mix(u_secondary_color, u_primary_color, step(0.5, fresnel)) * 3.0;
      outAlpha = a;`,
};
/** Short zaps crackling round a ball or an impact: tubes pinched at both ends, wiggling. */
PORTS.electric_particle = {
  uniforms: { primary_color: [1, 1, 1], secondary_color: [0, 0.84, 1], emission: 2, noise_scale: [1, 1], frequency: 1.5, amplitude: 0.3, edge_hardness: 1, edge_position: 0 },
  samplers: ['noise_texture'],
  blend: 'cut',
  cut: 0.5,
  cull: false,
  vertex: `
      float mask = 1.0 - abs(uv.y * 4.0 - 1.0);
      float motion = u_time * 0.1;
      float rnd = pcolor.r;
      float w1 = abs(fract(uv.y * 2.0 * u_frequency + motion + rnd) * 2.0 - 1.0) - 0.5;
      float w2 = abs(fract(uv.y * 2.0 * u_frequency + 3.14159265 + motion - rnd) * 2.0 - 1.0) - 0.5;
      p.xz *= mask;
      p.xz += vec2(w1, w2) * u_amplitude;`,
  fragment: `
      float fresnel = pow(max(dot(normalize(vView), normalize(vNormal)), 0.0), 2.0);
      float noise = texture2D(noise_texture, vUV * u_noise_scale).r;
      noise -= 1.0 - vColor.a * vExtra.w;
      noise *= fresnel;
      noise -= u_edge_position;
      float a = u_edge_hardness >= 0.999 ? step(0.0001, noise) : smoothstep(0.0, 1.0 - u_edge_hardness, noise);
      float value = mix(fresnel, step(0.6, fresnel), u_edge_hardness);
      outColor = mix(u_secondary_color, u_primary_color, value) * u_emission;
      outAlpha = a;`,
};
/** The scorch ring where a bolt lands: a ragged ring of light running out over the ground. */
PORTS.ground_impact = {
  uniforms: { primary_color: [1, 1, 1], secondary_color: [0, 0.84, 1], emission: 2, impact_frequency: 4, grow_amount: 0.5, edge_hardness: 0.5, edge_position: 0.5 },
  blend: 'mix',
  cull: false,
  fragment: `
      vec2 c = vUV * 2.0 - 1.0;
      float radius = length(c);
      float angle = atan(c.x, c.y);
      float r = vColor.r;
      float f = u_impact_frequency;
      float wave = (sin(angle * f + radius + r * 3.14159265) * 0.5 + 0.5) * 2.0
        + (sin(angle * f * 1.76 - radius - r * 0.5) * 0.5 + 0.5) * 1.5
        + (sin(angle * f * 3.14159265 + radius + r * 3.14159265) * 0.5 + 0.5)
        + (sin(angle * (f * 10.0 + 1.0) + radius - r * 0.5) * 0.5 + 0.5) * 0.2;
      float factor = max(1.0 - vColor.a * vExtra.w, 1e-3);
      float value = radius + wave * 0.1;
      value -= u_grow_amount - factor;
      value = max(1.0 - abs(value / factor), 0.0);
      value = clamp((value - u_edge_position) / (1.0 - u_edge_position), 0.0, 1.0);
      float a = smoothstep(0.1 * u_edge_hardness, 1.0 - 0.9 * u_edge_hardness, value);
      value = mix(value, floor(value * 4.0) / 3.0, u_edge_hardness);
      outColor = mix(u_secondary_color, u_primary_color, value) * 0.5 * (1.0 + value * u_emission);
      outAlpha = a;`,
};
/** Light streaking up from where a bolt lands. */
PORTS.ground_streaks = {
  uniforms: { primary_color: [1, 1, 1], emission: 4, streaks_frequency: 8, edge_hardness: 0.5, edge_position: 0.5 },
  blend: 'add',
  cull: false,
  fragment: `
      float y = vUV.y;
      float sf = u_streaks_frequency;
      float wave = (sin(vUV.x * 6.2831853 * sf + u_time) * 0.5 + 0.5) * 2.0
        + (sin(vUV.x * 6.2831853 * (sf + 1.0) - u_time) * 0.5 + 0.5) * 2.0
        + (sin(vUV.x * 6.2831853 * (sf * 8.0) + u_time) * 0.5 + 0.5);
      float value = clamp(y - wave * 0.1, 0.0, 1.0);
      value = min(value, y);
      float ep = pow(u_edge_position, 3.0);
      value = clamp((value - ep) / (1.0 - ep), 0.0, 1.0);
      float a = smoothstep(0.009 * u_edge_hardness, 1.0 - 0.99 * u_edge_hardness, value) * vColor.a * vExtra.w;
      outColor = u_primary_color * u_emission * 2.0;
      outAlpha = a;`,
};

// ---- Flame FX (Binbun VFX Vol. 2): camera-facing flames
/** A flame tongue: a soft disc eaten by scrolling noise in world space, hot at birth, cooling to its second colour. */
PORTS.fire_particle = {
  uniforms: { primary_color: [1, 0.72, 0.29], secondary_color: [0.69, 0, 0.18], emission: 4, color_curve: 1, noise_scale: [1, 1], noise_scroll: [0, 1], flame_density: 0.5, wobble_amount: 1, wobble_frequency: 12, wobble_scroll: 4, edge_hardness: 0.9, edge_position: 0.2, effect_amount: 1, speed_scale: 1 },
  samplers: ['noise_texture'],
  blend: 'mix',
  billboard: true,
  fragment: `
      float wobble = sin(vWorld.y * u_wobble_frequency - (u_time * u_wobble_scroll * u_speed_scale)) * (u_wobble_amount * 0.1);
      vec2 scroll = u_noise_scroll * u_time * u_speed_scale;
      vec2 wuv = ((vWorld.xy + vWorld.zz * 0.5) * u_noise_scale + vec2(wobble, 0.0)) * vec2(-1.0, 1.0);
      float off = texture2D(noise_texture, wuv * 0.5).r * 0.1;
      float noise = texture2D(noise_texture, wuv + vec2(0.0, off) - scroll).r;
      float mask = max((1.0 - length(vUV * 2.0 - 1.0)) - (1.0 - vColor.a), 0.0);
      float value = noise * mask;
      value += pow(mask, (1.0 - u_flame_density) * 8.0) * pow(vColor.a, 8.0);
      value -= 1.0 - u_effect_amount * vExtra.w;
      value = clamp(value, 0.0, 1.0);
      value = smoothstep(u_edge_position, mix(1.0, u_edge_position + 0.01, u_edge_hardness), value);
      vec3 col = mix(u_primary_color, u_secondary_color, pow(max(vColor.r, 0.0), u_color_curve));
      outColor = col * u_emission * (1.0 - vColor.r);
      outAlpha = value;`,
};
/** The flame's bright heart: a soft disc under scrolling noise. */
PORTS.fire_core = {
  uniforms: { primary_color: [1, 0.72, 0.29], secondary_color: [0.69, 0, 0.18], emission: 4, noise_scale: [1, 1], noise_scroll: [0, 1], flame_scale: [1, 1], edge_hardness: 0.9, edge_position: 0.2, effect_amount: 1, speed_scale: 1 },
  samplers: ['noise_texture'],
  blend: 'mix',
  billboard: true,
  fragment: `
      vec2 scroll = u_noise_scroll * u_time * u_speed_scale;
      float mask = max(1.0 - length(vUV * 2.0 - 1.0), 0.0);
      float noise = texture2D(noise_texture, (vUV * u_flame_scale * u_noise_scale) + scroll).r;
      float value = (mask * 4.0 - (1.0 - noise)) / 4.0;
      value -= 1.0 - u_effect_amount * vExtra.w;
      value = clamp(value, 0.0, 1.0);
      value = smoothstep(u_edge_position, mix(1.0, u_edge_position + 0.01, u_edge_hardness), value);
      outColor = u_primary_color * u_emission;
      outAlpha = value;`,
};

// ---- Binbun VFX Vol. 1 (Poison, Ice, Magic Orbs, Projectiles, Portal, Smoke …): one family of shaders shared by
// the packs: up to three scrolling noise masks blended together, coloured between two or three colours, lit
// softly and glowing (EMISSION), faded by the particle's alpha.
const VOL1_HELPERS = `
float blendf(float a, float b, float mode) {
  if (mode < 0.5) return a + b;
  if (mode < 1.5) return a - b;
  if (mode < 2.5) return a * b;
  if (mode < 3.5) return min(a, b);
  if (mode < 4.5) return max(a, b);
  if (mode < 5.5) return 1.0 - (1.0 - a) * (1.0 - b);
  if (mode < 6.5) return a < 0.5 ? 2.0 * a * b : 1.0 - 2.0 * (1.0 - a) * (1.0 - b);
  if (mode < 7.5) return b < 0.5 ? 2.0 * a * b : 1.0 - 2.0 * (1.0 - a) * (1.0 - b);
  if (mode < 8.5) return b < 0.5 ? 2.0 * a * b + a * a * (1.0 - 2.0 * b) : sqrt(max(a, 0.0)) * (2.0 * b - 1.0) + 2.0 * a * (1.0 - b);
  if (mode < 9.5) return a / max(1.0 - b, 1e-3);
  if (mode < 10.5) return 1.0 - (1.0 - a) / max(b, 1e-3);
  return a + b - 1.0;
}
vec2 uvAlign(vec2 uv, float m) {
  if (m < 0.5) return uv;
  if (m < 1.5) return uv.yx;
  if (m < 2.5) return vec2(1.0 - uv.x, uv.y);
  return vec2(1.0 - uv.y, uv.x);
}
vec2 uvRadial(vec2 uv) {
  vec2 c = uv - 0.5;
  return vec2(atan(c.x, c.y) / 6.2831853, length(c));
}
vec2 uvRotate(vec2 uv, float a) {
  mat2 r = mat2(vec2(sin(a), -cos(a)), vec2(cos(a), sin(a)));
  return (uv - 0.5) * r + 0.5;
}
float maskOne(sampler2D tex, vec2 uv, vec2 scale, vec2 scroll, float radial, float rot, float offset) {
  vec2 mapped = (radial > 0.5 ? uvRadial(uv) : uv) * scale + vec2(offset);
  vec2 muv = uvRotate(uvAlign(mapped, u_uv_alignment) + vec2(u_time * u_time_scale) * scroll, u_time * rot);
  return texture2D(tex, muv).r;
}
float vol1Mask(vec2 uv, float offset) {
  float m = maskOne(mask1_texture, uv, u_mask1_scale, u_mask1_scroll, u_mask1_radial, u_mask1_rotation, offset);
  if (u_use_mask2 > 0.5) m = mix(m, blendf(m, maskOne(mask2_texture, uv, u_mask2_scale, u_mask2_scroll, u_mask2_radial, u_mask2_rotation, 0.0), u_mask2_blend_mode), u_mask2_strength);
  if (u_use_mask3 > 0.5) m = mix(m, blendf(m, maskOne(mask3_texture, uv, u_mask3_scale, u_mask3_scroll, u_mask3_radial, u_mask3_rotation, 0.0), u_mask3_blend_mode), u_mask3_strength);
  return m;
}`;
const VOL1_UNIFORMS = {
  mask1_scroll: [0, 0], mask1_scale: [1, 1], mask1_radial: 0, mask1_rotation: 0,
  use_mask2: 0, mask2_scroll: [0, 0], mask2_scale: [1, 1], mask2_strength: 0, mask2_blend_mode: 0, mask2_radial: 0, mask2_rotation: 0,
  use_mask3: 0, mask3_scroll: [0, 0], mask3_scale: [1, 1], mask3_strength: 0, mask3_blend_mode: 0, mask3_radial: 0, mask3_rotation: 0,
  primary_color: [1, 1, 1], secondary_color: [0.5, 0.5, 0.5], tertiary_color: [0.2, 0.2, 0.2], use_tertiary: 0, color_smoothness: 0.5,
  displacement_scale: 0, displacement_offset: 0.5, time_scale: 1, uv_alignment: 0, emission_strength: 2,
  alpha_smoothness: 0.954, alpha_multiplier: 0.954, alpha_mode: 0, alpha_cutoff: 0.05, edge_cutoff: [0, 0, 0, 0],
} as Record<string, number | number[]>;
/** Fragment of the family: `offset` is the particle's own random (particle) or none; `lit` mixes in the scene's light. */
const vol1Fragment = (offset: string, tertiaryMixesB = false) => `
      float m = vol1Mask(vUV, ${offset});
      float cm = smoothstep(0.5 - u_color_smoothness * 0.5, 0.5 + u_color_smoothness * 0.5, m);
      vec3 albedo = ${tertiaryMixesB ? 'mix(mix(u_secondary_color, u_primary_color, pow(cm, 2.0)), u_tertiary_color, vColor.b)' : 'u_use_tertiary > 0.5 ? mix(u_tertiary_color, u_secondary_color, pow(cm, 3.0)) : mix(u_secondary_color, u_primary_color, pow(cm, 3.0))'};
      // Godot lights these (toon-ish) and adds EMISSION = albedo × strength: the sun, the sky and the glow.
      outColor = albedo * (u_ambient * 0.8 + u_sunColor * 0.35) + albedo * u_emission_strength * 0.5;
      // (Godot's clamp(lo, hi, mask) is min(hi, mask).)
      float am = min(0.5 + u_alpha_smoothness * 0.5, m);
      float a = clamp(pow(am, 3.0) * u_alpha_multiplier * vColor.a * vExtra.w, 0.0, 1.0);
      if (vUV.x < u_edge_cutoff.x || vUV.y < u_edge_cutoff.y || vUV.x > 1.0 - u_edge_cutoff.z || vUV.y > 1.0 - u_edge_cutoff.w) a = 0.0;
      if (u_alpha_mode > 0.5 && a < u_alpha_cutoff) a = 0.0;
      outAlpha = a;`;
const vol1Vertex = (offset: string) => `
      p += n * (vol1Mask(uv, ${offset}) - u_displacement_offset) * u_displacement_scale;`;
PORTS.transparent = {
  uniforms: VOL1_UNIFORMS,
  samplers: ['mask1_texture', 'mask2_texture', 'mask3_texture'],
  helpers: VOL1_HELPERS,
  blend: 'mix',
  billboardUniform: true,
  vertex: vol1Vertex('0.0'),
  fragment: vol1Fragment('0.0'),
};
PORTS.particle = { ...PORTS.transparent, vertex: vol1Vertex('pcolor.r'), fragment: vol1Fragment('vColor.r') };
PORTS.opaque = { ...PORTS.transparent, blend: 'cut', cut: 0.05 };
/** Smoke: the family's masks, its third colour mixed in by the particle's blue (darker puffs). */
PORTS.smoke = { ...PORTS.transparent, vertex: '', fragment: vol1Fragment('vColor.r', true) };
/** A fresnel glow (a shell round an orb): bright at the rim through its gradient. */
PORTS.glow_fresnel = {
  uniforms: { fresnel_amount: 1, fresnel_exponent: 1, enable_mask: 0, mask_scroll: [0, 0], mask_scale: [1, 1], mask_blend_mode: 0, mask_blend: 0, emission_strength: 1, primary_color: [1, 1, 1], secondary_color: [0.5, 0.5, 0.5], alpha_multiplier: 0.954 },
  samplers: ['fresnel_gradient', 'mask_texture'],
  helpers: VOL1_HELPERS.slice(0, VOL1_HELPERS.indexOf('vec2 uvAlign')),
  blend: 'add',
  fragment: `
      float fres = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vView)), 0.0, 1.0), u_fresnel_amount);
      float value = pow(texture2D(fresnel_gradient, vec2(fres, 0.5)).r, u_fresnel_exponent);
      if (u_enable_mask > 0.5) value = clamp(mix(value, blendf(value, texture2D(mask_texture, vUV * u_mask_scale + vec2(u_time) * u_mask_scroll).r, u_mask_blend_mode), u_mask_blend), 0.0, 1.0);
      outColor = mix(u_secondary_color, u_primary_color, value) * u_emission_strength;
      outAlpha = value * u_alpha_multiplier * vColor.a * vExtra.w;`,
};

// ---- Loot VFX (Binbun VFX Vol. 1): the glow round a pickup waiting to be taken
const LOOT_HELPERS = `
vec2 toPolar(vec2 uv) {
  vec2 d = uv - 0.5;
  return vec2(atan(d.y, d.x) / 6.2831853, length(d) * 2.0);
}
vec3 shiftHue(vec3 c, float s) {
  vec3 g = vec3(0.57735);
  vec3 pr = g * dot(g, c);
  vec3 u = c - pr;
  vec3 v = cross(g, u);
  return u * cos(s * 6.2831853) + v * sin(s * 6.2831853) + pr;
}`;
/** A flare of streaks and a ring, turned to the camera. */
PORTS.billboard_flare = {
  uniforms: { primary_color: [1, 1, 1], secondary_color: [0.5, 0.5, 1], emission: 2, hue_variation: 0.05, flare_streaks: 20, flare_ring: 0.6, flare_amount: 1, edge_hardness: 0 },
  samplers: ['noise_texture'],
  helpers: LOOT_HELPERS,
  blend: 'mix',
  billboardUniform: true,
  fragment: `
      vec2 pu = toPolar(vUV);
      float vo = vNormal.x * 4.0;
      float g1 = sin(pu.x * 3.14159265 * (u_flare_streaks * 0.4) + vo + u_time);
      float g2 = -sin(pu.x * 3.14159265 * u_flare_streaks - vo - u_time);
      float value = clamp(g1 * g2, 0.0, 1.0);
      float fm = pow(max(sin(pu.y * 3.14159265), 0.0), 8.0);
      value = pow(value, pu.y * 2.0);
      value = smoothstep(0.4 * u_edge_hardness, mix(1.0, 0.41, u_edge_hardness), value) * fm;
      float ring = max(1.0 - abs(pu.y * 2.0 - 1.0), 0.0);
      value += ring * ring * ring * ring * u_flare_ring;
      value *= u_flare_amount * vExtra.w;
      vec3 col = mix(u_secondary_color, u_primary_color, value);
      col = shiftHue(col, (texture2D(noise_texture, vUV).r * 2.0 - 1.0) * u_hue_variation);
      outColor = col * u_emission;
      outAlpha = value * 0.2;`,
};
/** The glowing heart: a fresnel ball, bobbing. */
PORTS.glow_core = {
  uniforms: { primary_color: [1, 1, 1], secondary_color: [0.5, 0.5, 1], emission: 2, hue_variation: 0.05, glow_amount: 1, edge_hardness: 0, fade_bottom: 0, bob_amount: 0.05 },
  samplers: ['noise_texture'],
  helpers: LOOT_HELPERS,
  blend: 'add',
  vertex: `
      p.y += sin(u_time * 2.0) * u_bob_amount;`,
  fragment: `
      float f = pow(max(dot(normalize(vView), normalize(vNormal)), 0.0), 4.0) * u_glow_amount;
      f = smoothstep(0.0, 1.0, f);
      if (u_fade_bottom > 0.01) f = mix(f, f * pow(max((1.0 - vUV.y) * 2.0 - 1.0, 0.0), 0.2), u_fade_bottom);
      vec3 col = mix(u_secondary_color, u_primary_color, f);
      col = shiftHue(col, (texture2D(noise_texture, vUV).r * 2.0 - 1.0) * (min(vUV.y, 1.0 - vUV.y) * 2.0) * u_hue_variation);
      outColor = col * u_emission;
      outAlpha = clamp(f, 0.0, 1.0) * vExtra.w;`,
};
/** Rings and pillars of light: streaks scrolling round a tube. */
PORTS.glow_tube = {
  uniforms: { primary_color: [1, 1, 1], secondary_color: [0.5, 0.5, 1], emission: 2, hue_variation: 0.05, align: 0, edge_hardness: 0, direction: [1, 0], detail_direction: [0, 1], density: 0.6, streaks: 8, scroll: 1, scale: 2, falloff: 4 },
  samplers: ['noise_texture'],
  helpers: LOOT_HELPERS,
  blend: 'add',
  cull: false,
  vertex: `
      p.y += sin(u_time * 2.0) * 0.05;`,
  fragment: `
      float dir = dot(vUV, u_direction);
      float gr = 1.0 - abs(mod((dir - 0.5) * u_scale * 2.0 + u_time * u_scroll, 2.0) - 1.0);
      gr *= gr;
      float fr = abs(dot(normalize(vView), normalize(vNormal)));
      fr = fr * fr * fr;
      float glow = gr * fr;
      vec2 duv = u_align > 0.5 ? vUV.yx : vUV;
      float detail = abs(mod((dot(duv, u_detail_direction) - 0.5) * u_streaks + u_time, 2.0) - 1.0);
      detail = sqrt(detail) * 2.0 - (2.0 - u_density);
      glow *= detail;
      glow = smoothstep(0.03 * u_edge_hardness, mix(0.4, 0.03, u_edge_hardness), glow);
      float noise = texture2D(noise_texture, vUV).r;
      glow = overlay(glow, noise);
      vec3 col = shiftHue(mix(u_secondary_color, u_primary_color, fr), (noise * 2.0 - 1.0) * u_hue_variation);
      outColor = col * (u_emission / 2.0);
      outAlpha = clamp(glow, 0.0, 1.0) * vExtra.w;`,
};
/** Sparkles drifting up round it. */
PORTS.particle_star = {
  uniforms: { primary_color: [1, 1, 1], use_texture: 0, lock: 0, emission: 2 },
  samplers: ['particle_texture'],
  blend: 'mix',
  vertex: `
      p.y += sin(u_time * 2.0 + pextra.x) * 0.05;`,
  fragment: `
      float shape;
      if (u_use_texture > 0.5 && u_lock < 0.5) shape = texture2D(particle_texture, vUV).a;
      else shape = smoothstep(1.0, 1.2, length(fract(vUV - 0.5) * 2.0 - 1.0));
      outColor = u_primary_color * u_emission;
      outAlpha = shape * vColor.a * vExtra.w;`,
};

const VERTEX = `
precision highp float;
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
#ifdef INSTANCES
attribute vec4 world0;
attribute vec4 world1;
attribute vec4 world2;
attribute vec4 world3;
#endif
attribute vec4 pcolor;
attribute vec4 pextra;
uniform mat4 world;
uniform mat4 view;
uniform mat4 viewProjection;
uniform vec3 eye;
uniform float u_time;
UNIFORMS
varying vec2 vUV;
varying vec4 vColor;
varying vec4 vExtra;
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vWorld;
HELPERS
void main(void) {
  mat4 fw = world;
#ifdef INSTANCES
  fw = world * mat4(world0, world1, world2, world3);
#endif
  vec3 p = position;
  vec3 n = normal;
  VERTEX_BODY
#ifdef BILLBOARD
  vec3 centre = (fw * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 right = vec3(view[0][0], view[1][0], view[2][0]);
  vec3 up = vec3(view[0][1], view[1][1], view[2][1]);
  float ca = cos(pextra.z);
  float sa = sin(pextra.z);
  vec2 q = vec2(p.x * ca - p.y * sa, p.x * sa + p.y * ca);
  vec3 wp = centre + right * q.x * length(fw[0].xyz) + up * q.y * length(fw[1].xyz);
  vec3 wn = -vec3(view[0][2], view[1][2], view[2][2]);
#else
  vec3 wp = (fw * vec4(p, 1.0)).xyz;
  vec3 wn = normalize(mat3(fw) * n);
#endif
  vUV = uv;
  vColor = pcolor;
  vExtra = pextra;
  vNormal = (view * vec4(wn, 0.0)).xyz;
  vView = (view * vec4(eye - wp, 0.0)).xyz;
  vWorld = wp;
#ifdef WORLD_NORMAL
  vNormal = wn;
#endif
  gl_Position = viewProjection * vec4(wp, 1.0);
}`;

const FRAGMENT = `
precision highp float;
varying vec2 vUV;
varying vec4 vColor;
varying vec4 vExtra;
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vWorld;
uniform float u_time;
uniform float u_bright;
uniform vec3 u_sunDir;
uniform vec3 u_sunColor;
uniform vec3 u_ambient;
UNIFORMS
float overlay(float base, float blend) {
  float limit = step(0.5, base);
  return mix(2.0 * base * blend, 1.0 - 2.0 * (1.0 - base) * (1.0 - blend), limit);
}
HELPERS
void main(void) {
  vec3 outColor = vec3(0.0);
  float outAlpha = 1.0;
  FRAGMENT_BODY
  // Godot shows these through a tone map with glow; a soft roll-off keeps the hues instead of clipping to white.
  // (Not named c: the shader bodies use that name.)
  vec3 toned = vec3(1.0) - exp(-max(outColor, vec3(0.0)) * u_bright);
#ifdef CUT
  if (outAlpha < CUT) discard;
  gl_FragColor = vec4(toned, 1.0);
#else
  gl_FragColor = vec4(toned, clamp(outAlpha, 0.0, 1.0));
#endif
}`;

function glslUniforms(port: ShaderPort): string {
  const lines: string[] = [];
  for (const [k, v] of Object.entries(port.uniforms)) lines.push(`uniform ${Array.isArray(v) ? (v.length === 2 ? 'vec2' : v.length === 4 ? 'vec4' : 'vec3') : 'float'} u_${k};`);
  for (const s of port.samplers ?? []) lines.push(`uniform sampler2D ${s};`);
  return lines.join('\n');
}

/** A port's name as a shader-store id (`ElectricFX/glow` → `ElectricFX_glow`). */
const shaderId = (name: string): string => name.replace(/[^A-Za-z0-9_]/g, '_');
/** A pack's port of a shader: its own (`<set>/<name>`, where two packs' shaders share a name), else the shared one. */
export function portName(set: string | undefined, name: string): string | null {
  if (set && PORTS[`${set}/${name}`]) return `${set}/${name}`;
  return PORTS[name] ? name : null;
}

let registered = false;
function registerShaders(): void {
  if (registered) return;
  registered = true;
  for (const [key, port] of Object.entries(PORTS)) {
    const u = glslUniforms(port);
    const name = shaderId(key);
    Effect.ShadersStore[`gv_${name}VertexShader`] = VERTEX.replace('UNIFORMS', u).replace('HELPERS', port.helpers ?? '').replace('VERTEX_BODY', port.vertex ?? '');
    Effect.ShadersStore[`gv_${name}FragmentShader`] = FRAGMENT.replace('UNIFORMS', u).replace('HELPERS', port.helpers ?? '').replace('FRAGMENT_BODY', port.fragment);
  }
}

/** Uniform values from the Godot material (and the effect root's shared colours), falling back to the shader's defaults. */
function materialFor(scene: Scene, mat: Json, root: Json, set: string | undefined, billboardAlign: boolean, key: string, cache: Map<string, ShaderMaterial>): ShaderMaterial | null {
  const portKey = portName(set, String((mat.shader as Json | undefined)?.shader ?? ''));
  if (!portKey) return null;
  const port = PORTS[portKey]!;
  const shaderName = shaderId(portKey);
  const hit = cache.get(key);
  if (hit) return hit;
  registerShaders();
  const billboard = billboardAlign || port.billboard === true || (port.billboardUniform === true && bool(mat['shader_parameter/billboard'], false));
  const defines = [...(billboard ? ['#define BILLBOARD'] : []), ...(port.blend === 'cut' || (port.cut !== undefined && port.blend !== 'add') ? [`#define CUT ${(port.cut ?? 0.5) < 0 ? '-1.0' : (port.cut ?? 0.5).toFixed(3)}`] : []), ...(port.lit ? ['#define WORLD_NORMAL'] : [])];
  const uniforms = ['world', 'view', 'viewProjection', 'eye', 'u_time', 'u_bright', 'u_sunDir', 'u_sunColor', 'u_ambient', ...Object.keys(port.uniforms).map((k) => `u_${k}`)];
  const m = new ShaderMaterial(`gv_${key}`, scene, { vertex: `gv_${shaderName}`, fragment: `gv_${shaderName}` }, {
    attributes: ['position', 'normal', 'uv', 'pcolor', 'pextra'],
    uniforms,
    samplers: port.samplers ?? [],
    defines,
    needAlphaBlending: port.blend !== 'cut' && !(port.cut !== undefined && port.blend === 'mix'),
  });
  m.backFaceCulling = port.cull !== false && !billboard;
  if (port.blend === 'add') m.alphaMode = Constants.ALPHA_ADD;
  else if (port.blend === 'mix') m.alphaMode = Constants.ALPHA_COMBINE;
  if (port.blend !== 'cut') m.disableDepthWrite = true;
  const param = (k: string): unknown => {
    const own = mat[`shader_parameter/${k}`];
    if (own !== undefined) return own;
    // The effect's controller sets these on every material (VFXControllerBB / VFXExplosionBB).
    if (['primary_color', 'secondary_color', 'tertiary_color', 'emission', 'noise_scale', 'noise_scroll', 'noise_shape'].includes(k)) return root[k];
    return undefined;
  };
  for (const [k, d] of Object.entries(port.uniforms)) {
    const v = param(k);
    if (Array.isArray(d) && d.length === 4) {
      const a = ctor(v, 'Vector4') ?? (d as number[]);
      m.setVector4(`u_${k}`, new Vector4(a[0] ?? 0, a[1] ?? 0, a[2] ?? 0, a[3] ?? 0));
    } else if (Array.isArray(d) && d.length === 3) {
      const c = color(v, [d[0]!, d[1]!, d[2]!, 1]);
      m.setColor3(`u_${k}`, new Color3(c[0], c[1], c[2]));
    } else if (Array.isArray(d)) {
      const c = vec2(v, [d[0]!, d[1]!]);
      m.setVector2(`u_${k}`, new Vector2(c[0], c[1]));
    } else m.setFloat(`u_${k}`, typeof v === 'boolean' ? (v ? 1 : 0) : num(v, d as number));
  }
  for (const s of port.samplers ?? []) {
    let spec = (mat[`shader_parameter/${s}`] ?? (s === 'noise_texture' ? root.noise_texture : s === 'smoke_texture' ? root.smoke_texture : null)) as Json | null;
    if (s === 'normal_texture' && !spec && root.smoke_texture) spec = { ...(root.smoke_texture as Json), as_normal_map: true, bump_strength: 32 };
    m.setTexture(s, spec && typeof spec.texture === 'string' ? packTexture(scene, spec.texture) : spec && (spec.type === 'GradientTexture2D' || spec.type === 'GradientTexture1D' || (spec.gradient && !spec.noise)) ? gradientTexture(scene, spec) : noiseTexture(scene, spec));
  }
  m.setFloat('u_bright', 0.55);
  cache.set(key, m);
  return m;
}

// ------------------------------------------------------------------ particles

interface Proc {
  shape: number;
  radius: number;
  box: [number, number, number];
  offset: [number, number, number];
  shapeScale: [number, number, number];
  ring?: { axis: [number, number, number]; height: number; radius: number; inner: number };
  dir: [number, number, number];
  spread: number;
  vel: [number, number];
  gravity: [number, number, number];
  damp: [number, number];
  scale: [number, number];
  scaleCurve: [number[][] | null, number[][] | null, number[][] | null] | null;
  alpha: number[][] | null;
  ramp: Gradient | null;
  initRamp: Gradient | null;
  angle: [number, number];
  radial: [number, number];
  radialCurve: number[][] | null;
  radialVel: [number, number];
  velLimit: number[][] | null;
  orbit: number[][] | null;
  alignY: boolean;
  rotateY: boolean;
}

function procOf(p: Json): Proc {
  const ring = num(p.emission_shape, 0) === 6;
  return {
    shape: num(p.emission_shape, 0),
    radius: num(p.emission_sphere_radius, 1),
    box: vec3(p.emission_box_extents, [1, 1, 1]),
    offset: vec3(p.emission_shape_offset, [0, 0, 0]),
    shapeScale: vec3(p.emission_shape_scale, [1, 1, 1]),
    ...(ring ? { ring: { axis: vec3(p.emission_ring_axis, [0, 0, 1]), height: num(p.emission_ring_height, 1), radius: num(p.emission_ring_radius, 1), inner: num(p.emission_ring_inner_radius, 0) } } : {}),
    dir: vec3(p.direction, [1, 0, 0]),
    spread: num(p.spread, 45),
    vel: [num(p.initial_velocity_min, 0), num(p.initial_velocity_max, 0)],
    gravity: vec3(p.gravity, [0, -9.8, 0]),
    damp: [num(p.damping_min, 0), num(p.damping_max, 0)],
    scale: [num(p.scale_min, 1), num(p.scale_max, 1)],
    scaleCurve: scaleCurves(p.scale_curve),
    alpha: curveOf(p.alpha_curve),
    ramp: p.color_ramp ? gradientOf(p.color_ramp) : null,
    initRamp: p.color_initial_ramp ? gradientOf(p.color_initial_ramp) : null,
    angle: [num(p.angle_min, 0), num(p.angle_max, 0)],
    radial: [num(p.radial_accel_min, 0), num(p.radial_accel_max, 0)],
    radialCurve: curveOf(p.radial_accel_curve),
    radialVel: [num(p.radial_velocity_min, 0), num(p.radial_velocity_max, 0)],
    velLimit: curveOf(p.velocity_limit_curve),
    orbit: curveOf(p.orbit_velocity_curve),
    alignY: bool(p.particle_flag_align_y, false),
    rotateY: bool(p.particle_flag_rotate_y, false),
  };
}

interface Particle {
  born: number;
  life: number;
  pos: Vector3;
  vel: Vector3;
  scale: number;
  angle: number;
  damp: number;
  radial: number;
  radialVel: number;
  init: number[];
  id: number;
  nextSub: number;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const DEG = Math.PI / 180;

function spawnPosition(pr: Proc): Vector3 {
  let x = 0;
  let y = 0;
  let z = 0;
  if (pr.shape === 1 || pr.shape === 2) {
    // Sphere (volume) or its surface.
    const u = Math.random() * 2 - 1;
    const a = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const r = pr.radius * (pr.shape === 2 ? 1 : Math.cbrt(Math.random()));
    x = s * Math.cos(a) * r;
    y = u * r;
    z = s * Math.sin(a) * r;
  } else if (pr.shape === 3) {
    x = rnd(-1, 1) * pr.box[0];
    y = rnd(-1, 1) * pr.box[1];
    z = rnd(-1, 1) * pr.box[2];
  } else if (pr.shape === 6 && pr.ring) {
    const a = Math.random() * Math.PI * 2;
    const r = rnd(pr.ring.inner, pr.ring.radius);
    const h = rnd(-0.5, 0.5) * pr.ring.height;
    // Ring around its axis (Godot's default axis is Z).
    const ax = new Vector3(...pr.ring.axis).normalize();
    const t1 = Math.abs(ax.y) < 0.9 ? Vector3.Cross(ax, Vector3.Up()).normalize() : Vector3.Cross(ax, Vector3.Right()).normalize();
    const t2 = Vector3.Cross(ax, t1);
    const v = t1.scale(Math.cos(a) * r).add(t2.scale(Math.sin(a) * r)).add(ax.scale(h));
    x = v.x;
    y = v.y;
    z = v.z;
  }
  return new Vector3(x * pr.shapeScale[0] + pr.offset[0], y * pr.shapeScale[1] + pr.offset[1], z * pr.shapeScale[2] + pr.offset[2]);
}

function spawnVelocity(pr: Proc): Vector3 {
  const d = new Vector3(...pr.dir);
  if (d.lengthSquared() < 1e-9) d.set(1, 0, 0);
  d.normalize();
  const spread = pr.spread * DEG;
  // A random direction within the spread cone around `dir`.
  const cosT = 1 - Math.random() * (1 - Math.cos(spread));
  const sinT = Math.sqrt(Math.max(0, 1 - cosT * cosT));
  const phi = Math.random() * Math.PI * 2;
  const t1 = Math.abs(d.y) < 0.9 ? Vector3.Cross(d, Vector3.Up()).normalize() : Vector3.Cross(d, Vector3.Right()).normalize();
  const t2 = Vector3.Cross(d, t1);
  const dir = d.scale(cosT).add(t1.scale(sinT * Math.cos(phi))).add(t2.scale(sinT * Math.sin(phi)));
  return dir.scale(rnd(pr.vel[0], pr.vel[1]));
}

/** One GPUParticles3D of a playing effect. */
class Emitter {
  readonly mesh: Mesh;
  /** A second draw pass (Godot's draw_pass_2): another mesh drawn with the same particles. */
  mesh2: Mesh | null = null;
  /** The playing effect's strength (fading in or out), handed to the shaders as pextra.w. */
  level = 1;
  private readonly proc: Proc;
  private parts: Particle[] = [];
  private spawned = 0;
  private emitFrom = -1;
  private emitTo = Infinity;
  private readonly matrices: Float32Array;
  private readonly colors: Float32Array;
  private readonly extras: Float32Array;
  private readonly node: Matrix;
  private readonly amount: number;
  readonly lifetime: number;
  private readonly explode: number;
  private readonly oneShot: boolean;
  readonly sub?: { emitter: Emitter; freq: number };
  private readonly align: number;
  private readonly trail: boolean;
  private readonly cap: number;

  constructor(
    base: Mesh,
    node: Json,
    nodeMatrix: Matrix,
    material: ShaderMaterial,
    sub?: { emitter: Emitter; freq: number },
  ) {
    this.mesh = base;
    this.mesh.material = material;
    this.proc = procOf((node.process_material ?? {}) as Json);
    this.amount = Math.max(1, Math.min(256, num(node.amount, 8)));
    this.lifetime = num(node.lifetime, 1);
    this.explode = num(node.explosiveness, 0);
    this.oneShot = bool(node.one_shot, false);
    this.align = num(node.transform_align, 0);
    this.trail = bool(node.trail_enabled, false);
    this.node = nodeMatrix;
    if (sub) this.sub = sub;
    // Sub-emitter targets may hold many more particles than their own amount over a burst.
    this.cap = this.amount * (node.__subTarget ? 4 : 1);
    this.matrices = new Float32Array(this.cap * 16);
    this.colors = new Float32Array(this.cap * 4);
    this.extras = new Float32Array(this.cap * 4);
    this.mesh.thinInstanceSetBuffer('matrix', this.matrices, 16, false);
    this.mesh.thinInstanceSetBuffer('pcolor', this.colors, 4, false);
    this.mesh.thinInstanceSetBuffer('pextra', this.extras, 4, false);
    this.mesh.thinInstanceCount = 0;
  }

  /** Emitting from `t` (seconds since the effect began) until `until`. */
  start(t: number, until: number): void {
    this.emitFrom = t;
    this.emitTo = until;
    this.spawned = 0;
  }

  /** Stop putting out particles at `t`; those out finish their lives. */
  stop(t: number): void {
    this.emitTo = Math.min(this.emitTo, t);
    if (this.oneShot && this.emitFrom >= 0) this.spawned = Math.max(this.spawned, this.amount);
  }

  /** A lasting effect's one-shot emitter that has finished goes again (Godot's looping emitters). */
  rearm(t: number): void {
    if (this.oneShot && this.emitFrom >= 0 && this.emitTo === Infinity && this.spawned >= this.amount && t >= this.emitFrom + this.lifetime) this.start(t, Infinity);
  }

  /** Share the particles with a second mesh (draw_pass_2). */
  addPass(mesh: Mesh, material: ShaderMaterial): void {
    mesh.material = material;
    mesh.thinInstanceSetBuffer('matrix', this.matrices, 16, false);
    mesh.thinInstanceSetBuffer('pcolor', this.colors, 4, false);
    mesh.thinInstanceSetBuffer('pextra', this.extras, 4, false);
    mesh.thinInstanceCount = 0;
    this.mesh2 = mesh;
  }

  /** A particle at `pos` (sub-emitters: where the parent is now). */
  spawnAt(t: number, pos: Vector3 | null): void {
    // Counted even when full: the emission loops run until `spawned` catches up, and a particle
    // skipped without counting would keep them spinning for ever (a frozen page).
    if (this.parts.length >= this.cap) {
      this.spawned++;
      return;
    }
    const pr = this.proc;
    const p: Particle = {
      born: t,
      life: this.lifetime,
      pos: pos ? pos.clone().add(new Vector3(...pr.offset)) : spawnPosition(pr),
      vel: spawnVelocity(pr),
      scale: rnd(pr.scale[0], pr.scale[1]),
      angle: rnd(pr.angle[0], pr.angle[1]) * DEG,
      damp: rnd(pr.damp[0], pr.damp[1]),
      radial: rnd(pr.radial[0], pr.radial[1]),
      radialVel: rnd(pr.radialVel[0], pr.radialVel[1]),
      init: pr.initRamp ? sampleGradient(pr.initRamp, Math.random(), [1, 1, 1, 1]) : [1, 1, 1, 1],
      id: this.spawned++,
      nextSub: t,
    };
    this.parts.push(p);
  }

  private lastT = 0;
  get alive(): boolean {
    return this.parts.length > 0 || (this.emitFrom >= 0 && !this.doneEmitting);
  }

  private get doneEmitting(): boolean {
    return this.oneShot ? this.spawned >= this.amount : this.lastT >= this.emitTo;
  }

  update(t: number, dt: number, cam: Camera | null, root: Matrix): void {
    this.lastT = t;
    const pr = this.proc;
    // Emission: a one-shot puts out `amount` over the first (1 - explosiveness) of a lifetime; otherwise amount per lifetime while on.
    if (this.emitFrom >= 0 && t >= this.emitFrom) {
      if (this.oneShot) {
        const spanT = this.lifetime * (1 - this.explode);
        while (this.spawned < this.amount && t >= this.emitFrom + (spanT * this.spawned) / this.amount) this.spawnAt(this.emitFrom + (spanT * this.spawned) / this.amount, null);
      } else if (t < this.emitTo) {
        // Bounded per frame, whatever the lifetime (a zero one would ask for infinitely many).
        const want = Math.min(this.spawned + this.cap, Math.floor(((t - this.emitFrom) / Math.max(1e-3, this.lifetime)) * this.amount));
        while (this.spawned <= want) this.spawnAt(t, null);
      }
    }
    const g = pr.gravity;
    let n = 0;
    const m = Matrix.Identity();
    const q = new Quaternion();
    const tmp = Matrix.Identity();
    const col: number[] = [1, 1, 1, 1];
    const camView = cam?.getViewMatrix();
    this.parts = this.parts.filter((p) => {
      const age = t - p.born;
      const x = age / p.life;
      if (x >= 1 || age < 0) return age < 0;
      // Motion.
      p.vel.x += g[0] * dt;
      p.vel.y += g[1] * dt;
      p.vel.z += g[2] * dt;
      if (p.radial) {
        const r = p.pos.clone();
        if (r.lengthSquared() > 1e-8) p.vel.addInPlace(r.normalize().scale(p.radial * sampleCurve(pr.radialCurve, x, 1) * dt));
      }
      if (p.damp) {
        const s = p.vel.length();
        if (s > 0) p.vel.scaleInPlace(Math.max(0, s - p.damp * dt) / s);
      }
      if (pr.orbit) {
        const w = sampleCurve(pr.orbit, x, 0) * Math.PI * 2 * dt;
        const c = Math.cos(w);
        const s = Math.sin(w);
        const px = p.pos.x;
        p.pos.x = px * c - p.pos.z * s;
        p.pos.z = px * s + p.pos.z * c;
      }
      if (pr.velLimit) {
        // Godot's velocity limit: speed held under the curve over the particle's life.
        const lim = sampleCurve(pr.velLimit, x, Infinity);
        const sp = p.vel.length();
        if (sp > lim && sp > 0) p.vel.scaleInPlace(lim / sp);
      }
      p.pos.addInPlace(p.vel.scale(dt));
      if (p.radialVel) {
        // Godot's radial velocity: straight out from the emitter (in from it when negative), on top of the motion.
        const l = p.pos.length();
        if (l > 1e-6) p.pos.scaleInPlace(Math.max(0, l + p.radialVel * dt) / l);
      }
      if (this.sub && t >= p.nextSub) {
        p.nextSub = t + 1 / Math.max(1, this.sub.freq);
        this.sub.emitter.spawnAt(t, p.pos);
      }
      if (n >= this.cap) return true;
      // Size.
      const sc = pr.scaleCurve;
      const sx = p.scale * (sc ? sampleCurve(sc[0], x, 1) : 1);
      const sy = p.scale * (sc ? sampleCurve(sc[1], x, 1) : 1);
      const sz = p.scale * (sc ? sampleCurve(sc[2], x, 1) : 1);
      // Turn: Y along the motion (align_y), about Y (rotate_y), else about Z (camera-facing quads turn in the shader).
      let angle = 0;
      if (pr.alignY || this.align === 2 || this.trail) {
        // The way it moves, its radial velocity included (sparks round a ball point out from it).
        const mv = p.radialVel && p.pos.lengthSquared() > 1e-8 ? p.vel.add(p.pos.normalizeToNew().scale(p.radialVel)) : p.vel;
        const v = mv.lengthSquared() > 1e-8 ? mv.normalizeToNew() : Vector3.Up();
        const ref = Math.abs(v.y) < 0.95 ? Vector3.Up() : Vector3.Right();
        const xAxis = Vector3.Cross(v, ref).normalize();
        const zAxis = Vector3.Cross(xAxis, v);
        Quaternion.FromRotationMatrixToRef(Matrix.FromValues(xAxis.x, xAxis.y, xAxis.z, 0, v.x, v.y, v.z, 0, zAxis.x, zAxis.y, zAxis.z, 0, 0, 0, 0, 1), q);
      } else if (pr.rotateY) Quaternion.RotationYawPitchRollToRef(p.angle, 0, 0, q);
      else {
        Quaternion.RotationYawPitchRollToRef(0, 0, this.align === 1 ? 0 : p.angle, q);
        angle = p.angle;
      }
      if (this.align === 3 && camView) {
        // Camera-facing, turned so its Y follows the motion on screen.
        const v = Vector3.TransformNormal(p.vel, camView);
        angle = Math.atan2(-v.x, v.y);
      }
      let stretch = 1;
      if (this.trail) stretch = Math.max(0.2, p.vel.length() * 0.3);
      Matrix.ComposeToRef(new Vector3(sx, sy * stretch, sz), q, p.pos, m);
      m.multiplyToRef(this.node, tmp);
      tmp.multiplyToRef(root, m);
      m.copyToArray(this.matrices, n * 16);
      // Colour: initial ramp × ramp over life, alpha × the alpha curve (what the shaders read as COLOR).
      if (pr.ramp) sampleGradient(pr.ramp, x, col);
      else col.splice(0, 4, 1, 1, 1, 1);
      this.colors[n * 4] = col[0]! * p.init[0]!;
      this.colors[n * 4 + 1] = col[1]! * p.init[1]!;
      this.colors[n * 4 + 2] = col[2]! * p.init[2]!;
      this.colors[n * 4 + 3] = col[3]! * p.init[3]! * sampleCurve(pr.alpha, x, 1);
      this.extras[n * 4] = p.id;
      this.extras[n * 4 + 1] = 0;
      this.extras[n * 4 + 2] = angle;
      this.extras[n * 4 + 3] = this.level;
      n++;
      return true;
    });
    for (const mesh of this.mesh2 ? [this.mesh, this.mesh2] : [this.mesh]) {
      mesh.thinInstanceCount = n;
      if (n) {
        mesh.thinInstanceBufferUpdated('matrix');
        mesh.thinInstanceBufferUpdated('pcolor');
        mesh.thinInstanceBufferUpdated('pextra');
      }
      mesh.setEnabled(n > 0);
    }
  }

  dispose(): void {
    this.mesh.dispose();
    this.mesh2?.dispose();
  }
}

/** A MeshInstance3D the animation moves, scales and fades (effect_decay). */
class Prop {
  readonly mesh: Mesh;
  readonly matrix = new Float32Array(16);
  readonly colorBuf = new Float32Array([1, 1, 1, 1]);
  readonly extraBuf = new Float32Array([0, 0, 0, 1]);
  scale: [number, number, number] = [1, 1, 1];
  pos: [number, number, number];
  rot: [number, number, number] = [0, 0, 0];
  decay = 0;
  /** The playing effect's strength (pextra.w). */
  level = 1;
  constructor(
    mesh: Mesh,
    readonly name: string,
    readonly base: Matrix,
  ) {
    this.mesh = mesh;
    const t = base.getTranslation();
    this.pos = [t.x, t.y, t.z];
    mesh.thinInstanceSetBuffer('matrix', this.matrix, 16, false);
    mesh.thinInstanceSetBuffer('pcolor', this.colorBuf, 4, true);
    mesh.thinInstanceSetBuffer('pextra', this.extraBuf, 4, false);
  }
  update(root: Matrix): void {
    const s = new Vector3();
    const r = new Quaternion();
    const tr = new Vector3();
    this.base.decompose(s, r, tr);
    const q = Quaternion.RotationYawPitchRoll(this.rot[1], this.rot[0], this.rot[2]).multiply(r);
    const m = Matrix.Compose(new Vector3(s.x * this.scale[0], s.y * this.scale[1], s.z * this.scale[2]), q, new Vector3(...this.pos)).multiply(root);
    m.copyToArray(this.matrix, 0);
    this.extraBuf[1] = this.decay;
    this.extraBuf[3] = this.level;
    this.mesh.thinInstanceBufferUpdated('matrix');
    this.mesh.thinInstanceBufferUpdated('pextra');
  }
}

/** A Godot Transform3D (rows) as a Babylon matrix (row-vector convention). */
function godotMatrix(v: unknown): Matrix {
  const t = ctor(v, 'Transform3D');
  if (!t) return Matrix.Identity();
  // Godot rows r0 = (t0 t1 t2), r1 = (t3 t4 t5), r2 = (t6 t7 t8); basis columns are its axes.
  return Matrix.FromValues(t[0]!, t[3]!, t[6]!, 0, t[1]!, t[4]!, t[7]!, 0, t[2]!, t[5]!, t[8]!, 0, t[9]!, t[10]!, t[11]!, 1);
}

interface Playing {
  t: number;
  length: number;
  root: Matrix;
  emitters: Map<string, Emitter>;
  props: Prop[];
  tracks: Track[];
  started: Set<string>;
  /** Time runs this many times faster than the pack's (an effect fitted to the game's timing). */
  speed: number;
  /** A lasting effect (a fire, a charge ball): runs until stopped. */
  loop: boolean;
  /** When a lasting effect was told to stop (its own time), or null. */
  stopAt: number | null;
  /** Strength now and wanted (lasting effects fade in and out over FADE seconds). */
  level: number;
  want: number;
  minor: boolean;
}

/** Ways to place an effect. */
export interface VfxPlace {
  /** Times its size (all axes). */
  scale?: number;
  /** Turn it so its up follows this (a surface's normal, the way a bolt runs). */
  up?: Vector3;
  /** Turn it about its up by this much (radians), after `up`. */
  yaw?: number;
}

export interface VfxOptions extends VfxPlace {
  /** Time this many times faster than the pack's (fitted to how long the game's moment lasts). */
  speed?: number;
  /** Minor effects (an impact's accent, a pickup's sparkle) give way when many are playing. */
  minor?: boolean;
  /** Only these of its parts (node names). */
  only?: readonly string[];
  /** Leave these of its parts out (node names). */
  skip?: readonly string[];
  /** Stretch these parts along their Y by `by` (a bolt's tube, made 6 m long, laid between two points). */
  stretch?: { nodes: readonly string[]; by: number };
}

/** A lasting effect playing (GodotVfx.start): move it, fade it, stop it. */
export interface VfxHandle {
  /** Put it somewhere else (a ball over a moving turret). */
  move(at: Vector3, place?: VfxPlace): void;
  /** How strong it is, 0..1 (shaders fade or thin it; 0 hides it). */
  setLevel(level: number): void;
  /** Stop: no new particles, those out finish, then it is gone. */
  stop(): void;
  /** Gone (stopped and finished, or never fitted in). */
  readonly done: boolean;
}

/** Settings by graphics quality: how many effects may play at once (one-shots, minor ones, lasting ones). */
const QUALITY = {
  low: { playing: 6, minor: 3, loops: 4, density: 0.5 },
  medium: { playing: 12, minor: 7, loops: 10, density: 1 },
  high: { playing: 16, minor: 10, loops: 16, density: 1 },
} as const;
export type VfxQuality = keyof typeof QUALITY;

/** Seconds a lasting effect takes to fade in or out. */
const FADE = 0.25;

function rootMatrix(at: Vector3, place: VfxPlace): Matrix {
  const scale = place.scale ?? 1;
  const q = place.up && Math.abs(place.up.y) < 0.999 ? Quaternion.FromUnitVectorsToRef(Vector3.Up(), place.up.clone().normalize(), new Quaternion()) : place.up && place.up.y < 0 ? Quaternion.RotationAxis(Vector3.Right(), Math.PI) : Quaternion.Identity();
  if (place.yaw) q.multiplyInPlace(Quaternion.RotationAxis(Vector3.Up(), place.yaw));
  return Matrix.Compose(new Vector3(scale, scale, scale), q, at);
}

/**
 * Plays the packs' effects in a scene. `play` puts a one-shot at a point (scaled, optionally turned so its up
 * follows a surface normal); `start` a lasting one (a fire, a charge ball) that runs until its handle stops it;
 * `update` each frame. How many may play at once follows the graphics quality (`quality`).
 */
export class GodotVfx {
  private playing: Playing[] = [];
  private readonly materials = new Map<string, ShaderMaterial>();
  private readonly meshes = new Map<string, Mesh>();
  private serial = 0;
  private sun = { dir: new Vector3(-0.4, -1, 0.3).normalize(), color: new Color3(1, 0.97, 0.9), ambient: new Color3(0.45, 0.45, 0.5) };
  private caps: (typeof QUALITY)[VfxQuality] = QUALITY.medium;

  constructor(private readonly scene: Scene) {}

  /** Low graphics plays fewer effects at once and thins the lasting ones; high plays more. */
  set quality(q: VfxQuality) {
    this.caps = QUALITY[q] ?? QUALITY.medium;
  }

  /** Light the lit effects (smoke) like the scene: the sun's direction and colour, and the sky's. */
  setLight(dir: Vector3, sunColor: Color3, ambient: Color3): void {
    this.sun = { dir: dir.normalize(), color: sunColor, ambient };
  }

  static async preload(...names: string[]): Promise<void> {
    await Promise.all(
      names.map(async (n) => {
        const p = await loadVfxPack(n);
        if (p) loaded.set(n, p);
      }),
    );
  }

  /** Whether that pack's effects can be played now. */
  static ready(pack: string): boolean {
    return loaded.has(pack);
  }

  /**
   * Play `effect` of `pack` at `at`, `scale` times its size; `up` turns it to stand on a surface. False when the pack
   * isn't in yet or too many are playing. `minor` effects (an impact's accent, a pickup's sparkle) stop at
   * MAX_MINOR, so they never crowd out an explosion.
   */
  play(pack: string, effect: string, at: Vector3, opts: VfxOptions = {}): boolean {
    const oneShots = this.playing.length - this.loopCount;
    // A big fight can ask for dozens at once: past the cap the caller's plain effect stands in.
    if (oneShots >= (opts.minor ? this.caps.minor : this.caps.playing)) return false;
    return !!this.begin(pack, effect, at, opts, false);
  }

  /**
   * Start a lasting effect (a fire, a charge ball, a glow): it runs, fading in, until its handle stops it. Null when
   * the pack isn't in or as many lasting effects play as the quality allows (callers keep their plain look).
   */
  start(pack: string, effect: string, at: Vector3, opts: VfxOptions = {}): VfxHandle | null {
    if (this.loopCount >= this.caps.loops) return null;
    const p = this.begin(pack, effect, at, opts, true);
    if (!p) return null;
    const self = this;
    return {
      move(to: Vector3, place?: VfxPlace) {
        p.root = rootMatrix(to, { scale: opts.scale, up: opts.up, yaw: opts.yaw, ...place });
      },
      setLevel(level: number) {
        p.want = Math.max(0, Math.min(1, level));
      },
      stop() {
        if (p.stopAt === null) p.stopAt = p.t;
      },
      get done() {
        return !self.playing.includes(p);
      },
    };
  }

  /** How many more lasting effects may start now (by graphics quality). */
  get loopRoom(): number {
    return Math.max(0, this.caps.loops - this.loopCount);
  }

  /** Lasting effects playing now. */
  get loopCount(): number {
    let n = 0;
    for (const p of this.playing) if (p.loop) n++;
    return n;
  }

  private begin(pack: string, effect: string, at: Vector3, opts: VfxOptions, loop: boolean): Playing | null {
    const fx = loaded.get(pack)?.effects[effect];
    if (!fx) return null;
    const root = rootMatrix(at, opts);
    // A lasting effect opens (its `open` animation) and runs; a one-shot plays `main`.
    const anim = (loop ? (fx.animations.open ?? fx.animations.main) : fx.animations.main) ?? Object.values(fx.animations).find((a) => a.length > 0.01);
    const emitters = new Map<string, Emitter>();
    const props: Prop[] = [];
    const id = this.serial++;
    const wanted = (name: string) => (!opts.only || opts.only.includes(name)) && !opts.skip?.includes(name);
    const byName = new Map(fx.nodes.map((n) => [String(n.name), n]));
    // A node's place in the effect: its own transform under its parents' (Godot nests them).
    const placeOf = (node: Json): Matrix => {
      let m = godotMatrix(node.transform);
      for (let parent = typeof node.parent === 'string' ? node.parent : null, guard = 0; parent && guard < 8; guard++) {
        const up = byName.get(parent.split('/').pop()!);
        if (!up) break;
        m = m.multiply(godotMatrix(up.transform));
        parent = typeof up.parent === 'string' ? up.parent : null;
      }
      const stretch = opts.stretch && opts.stretch.nodes.includes(String(node.name)) ? opts.stretch.by : 1;
      return stretch !== 1 ? m.multiply(Matrix.Scaling(1, stretch, 1)) : m;
    };
    // Sub-emitter targets first, so their parents can find them.
    const subTargets = new Set(fx.nodes.map((n) => n.sub_emitter).filter((s): s is string => typeof s === 'string').map((s) => s.replace(/^\.\.\//, '')));
    const order = [...fx.nodes].sort((a, b) => Number(subTargets.has(String(b.name))) - Number(subTargets.has(String(a.name))));
    for (const node of order) {
      const name = String(node.name);
      if (!wanted(name) || node.visible === false) continue;
      if (node.type === 'GPUParticles3D') {
        const meshSpec = node.draw_pass_1 as Json | undefined;
        const matSpec = node.material_override as Json | undefined;
        if (!meshSpec || !matSpec) continue;
        const material = materialFor(this.scene, matSpec, fx.root, fx.set, num(node.transform_align, 0) === 1 || num(node.transform_align, 0) === 3, `${pack}/${effect}/${name}`, this.materials);
        if (!material) continue;
        const mesh = pieceOf(this.baseMesh(`${pack}/${effect}/${name}`, meshSpec), `gv_${name}_${id}`);
        mesh.metadata = EFFECT;
        mesh.setEnabled(false);
        const subName = typeof node.sub_emitter === 'string' ? node.sub_emitter.replace(/^\.\.\//, '') : null;
        const target = subName ? emitters.get(subName) : undefined;
        const freq = num((node.process_material as Json | undefined)?.sub_emitter_frequency, 4);
        // Lasting effects on low graphics put out fewer particles (each a quad or a tube to fill).
        const thin = loop && this.caps.density < 1 && num(node.amount, 8) > 4 ? { amount: Math.max(2, Math.round(num(node.amount, 8) * this.caps.density)) } : {};
        const e = new Emitter(mesh, { ...(subTargets.has(name) ? { ...node, __subTarget: true } : node), ...thin }, placeOf(node), material, target ? { emitter: target, freq } : undefined);
        const pass2 = num(node.draw_passes, 1) > 1 ? (node.draw_pass_2 as Json | undefined) : undefined;
        if (pass2) {
          const m2 = pieceOf(this.baseMesh(`${pack}/${effect}/${name}#2`, pass2), `gv_${name}2_${id}`);
          m2.metadata = EFFECT;
          m2.setEnabled(false);
          e.addPass(m2, material);
        }
        emitters.set(name, e);
      } else if (node.type === 'MeshInstance3D') {
        const meshSpec = node.mesh as Json | undefined;
        const matSpec = (node.material_override ?? node['surface_material_override/0']) as Json | undefined;
        if (!meshSpec || !matSpec) continue;
        const material = materialFor(this.scene, matSpec, fx.root, fx.set, false, `${pack}/${effect}/${name}`, this.materials);
        if (!material) continue;
        const mesh = pieceOf(this.baseMesh(`${pack}/${effect}/${name}`, meshSpec), `gv_${name}_${id}`);
        mesh.metadata = EFFECT;
        mesh.material = material;
        const prop = new Prop(mesh, name, placeOf(node));
        prop.decay = num(matSpec['shader_parameter/effect_decay'], 0);
        props.push(prop);
      }
    }
    if (!emitters.size && !props.length) return null;
    // Emitters with no animation track start at once (Godot's `emitting` default).
    const tracks = anim?.tracks ?? [];
    const started = new Set<string>();
    for (const [name, e] of emitters) {
      const node = byName.get(name)!;
      const tr = tracks.find((t) => t.path === `${name}:emitting`);
      if (!tr && node.emitting !== false && ![...emitters.values()].some((x) => x.sub?.emitter === e)) {
        e.start(0, loop ? Infinity : (anim?.length ?? 1));
        started.add(name);
      }
    }
    const level = loop ? 0 : 1;
    const p: Playing = { t: 0, length: anim?.length ?? 1, root, emitters, props, tracks, started, speed: opts.speed ?? 1, loop, stopAt: null, level, want: 1, minor: !!opts.minor };
    this.playing.push(p);
    return p;
  }

  private baseMesh(key: string, spec: Json): Mesh {
    let m = this.meshes.get(key);
    if (!m) {
      m = godotMesh(this.scene, spec, `gvBase_${this.meshes.size}`);
      m.setEnabled(false);
      this.meshes.set(key, m);
    }
    return m;
  }

  update(dtMs: number): void {
    if (!this.playing.length) return;
    const wall = Math.min(0.05, dtMs / 1000);
    const now = performance.now() / 1000;
    for (const m of this.materials.values()) {
      m.setFloat('u_time', now % 1000);
      m.setVector3('u_sunDir', this.sun.dir);
      m.setColor3('u_sunColor', this.sun.color);
      m.setColor3('u_ambient', this.sun.ambient);
      m.setVector3('eye', this.scene.activeCamera?.globalPosition ?? Vector3.Zero());
    }
    const cam = this.scene.activeCamera;
    this.playing = this.playing.filter((p) => {
      const dt = wall * p.speed;
      p.t += dt;
      if (p.loop) {
        // Fade toward what's wanted (out once stopped); the emitters stop putting out particles when told.
        const target = p.stopAt !== null ? 0 : p.want;
        p.level += Math.sign(target - p.level) * Math.min(Math.abs(target - p.level), wall / FADE);
        if (p.stopAt !== null) for (const e of p.emitters.values()) e.stop(p.stopAt);
        else for (const e of p.emitters.values()) e.rearm(p.t);
      }
      // The animation: emitters switched on (and off), props moved, scaled and faded.
      for (const tr of p.tracks) {
        const [node, prop] = tr.path.split(':');
        if (!node || !prop) continue;
        const v = trackAt(tr, p.t);
        if (prop === 'emitting') {
          const e = p.emitters.get(node);
          if (!e) continue;
          const on = v === true;
          if (on && !p.started.has(node) && p.stopAt === null) {
            p.started.add(node);
            // Off again at the next key that says false (a lasting effect's `open` leaves them on).
            const times = tr.keys.times?.['@PackedFloat32Array'] ?? [];
            const vals = tr.keys.values ?? [];
            const i = vals.findIndex((x, k) => x === false && times[k]! > p.t - dt);
            e.start(p.t, i >= 0 ? times[i]! : Infinity);
          }
          continue;
        }
        const pr = p.props.find((x) => x.name === node);
        if (!pr || v === undefined) continue;
        const v3 = ctor(v, 'Vector3');
        if (prop === 'scale' && v3) pr.scale = [v3[0]!, v3[1]!, v3[2]!];
        else if (prop === 'position' && v3) pr.pos = [v3[0]!, v3[1]!, v3[2]!];
        else if (prop === 'rotation' && v3) pr.rot = [v3[0]!, v3[1]!, v3[2]!];
        else if (prop.endsWith('effect_decay') && typeof v === 'number') pr.decay = v;
      }
      const showProps = p.loop ? p.level > 0.001 : p.t < p.length;
      let alive = p.loop ? p.stopAt === null || p.level > 0.001 : p.t < p.length;
      for (const e of p.emitters.values()) {
        e.level = p.level;
        e.update(p.t, dt, cam, p.root);
        alive ||= e.alive;
      }
      for (const pr of p.props) {
        pr.level = p.level;
        pr.mesh.setEnabled(showProps);
        pr.update(p.root);
      }
      if (!alive) {
        for (const e of p.emitters.values()) e.dispose();
        for (const pr of p.props) pr.mesh.dispose();
      }
      return alive;
    });
  }

  /**
   * Make an effect's meshes and materials before it's first needed (played out of sight and gone at once): its
   * first play otherwise built them mid-fight. What it made stays cached for later plays. (Not forceCompilation:
   * it polls every 16 ms until the material is ready, for ever once its mesh is gone.)
   */
  warm(pack: string, effect: string, draw = false): (() => void) | null {
    const p = this.begin(pack, effect, new Vector3(0, -10000, 0), {}, false);
    if (!p) return null;
    const end = () => {
      const i = this.playing.indexOf(p);
      if (i < 0) return;
      this.playing.splice(i, 1);
      for (const e of p.emitters.values()) e.dispose();
      for (const pr of p.props) pr.mesh.dispose();
    };
    // `draw`: it plays out of sight (its pieces draw wherever they are) until `end` is called, so each piece's
    // shader, with the particles' instancing as played, is built now (GameView.prewarm: the loading gate waits).
    if (draw) return end;
    end();
    return null;
  }

  /** At most this many one-shot effects play at once on medium graphics (each is a handful of meshes and particles). */
  static MAX_PLAYING = QUALITY.medium.playing;
  /** Minor effects play only while fewer than this many one-shots are playing (medium graphics). */
  static MAX_MINOR = QUALITY.medium.minor;

  /** How many effects are playing (tests). */
  get count(): number {
    return this.playing.length;
  }

  dispose(): void {
    for (const p of this.playing) {
      for (const e of p.emitters.values()) e.dispose();
      for (const pr of p.props) pr.mesh.dispose();
    }
    this.playing = [];
    for (const m of this.materials.values()) m.dispose();
    for (const m of this.meshes.values()) m.dispose();
  }
}
