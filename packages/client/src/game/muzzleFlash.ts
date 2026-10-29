import type { Scene } from '@babylonjs/core/scene';
import { Effect } from '@babylonjs/core/Materials/effect';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { Constants } from '@babylonjs/core/Engines/constants';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector2, Vector4 } from '@babylonjs/core/Maths/math.vector';
import type { WeaponDefinition } from '@tiletrigger/shared';
import { versioned } from '../assetUrl.ts';

/**
 * Muzzle flashes from Binbun's Muzzle Flash VFX (CC0). The pack is a Godot
 * project; tools/content/prepare-vfx.mjs reads its scenes into
 * public/vfx/muzzle_flash.json and packs its textures into one atlas. This
 * draws each effect the way the pack does: a few textured "blades" lying
 * along the barrel at random turns (the long flame and the side spikes), a
 * star facing down the barrel (cupped back at the edges), and a soft glow,
 * each fading the way its shader does (eaten away from the muzzle outwards,
 * then dimmed) over the pack's alpha curves. Colours are the effect's own.
 *
 * Played a little faster than the pack (GUNPLAY_SPEC §31: visible but
 * short), and scaled per weapon: the pack is made at a large scale.
 */

interface Layer {
  type: 'blade' | 'front';
  tile: number;
  align: number;
  noise: number;
  scroll: [number, number];
  colorSmooth: number;
  edgeSmooth: number;
  fadeBasic: number;
  fadeDir: number;
  cutoff: number;
  emission: number;
  cup?: { dist: number; exp: number };
  count: number;
  life: number;
  explode: number;
  at: number;
  w: number;
  h: number;
  mid: number;
  scale: [number, number];
  spin: boolean;
  /** [x, y, left tangent, right tangent] (a Godot Curve). */
  alpha: number[][] | null;
  size: number[][] | null;
}
interface FlashEffect {
  primary: [number, number, number];
  secondary: [number, number, number];
  layers: Layer[];
  glow?: { maskExp: number; emission: number; alphaMul: number; at: number; radius: number; height: number };
  length: number;
}
interface FlashPack {
  atlas: { file: string; cols: number; rows: number };
  effects: Record<string, FlashEffect>;
}

/** How much faster than the pack the flashes play. */
const SPEED = 1.6;
/** Marks effect meshes: the atmosphere leaves them out of shadows (atmosphere.ts `worldly`). */
const EFFECT = { effect: true };
/** One hidden rig per scene that builds every flash while the match loads (`MuzzleFlashRig.warm`). */
const warmRigs = new WeakMap<Scene, MuzzleFlashRig>();
const BASE = `${import.meta.env.BASE_URL}vfx/`;

let pack: FlashPack | null = null;
let loading: Promise<FlashPack | null> | null = null;
/** Fetch the flash settings once (flashes fall back to the plain star until they're in). */
export function loadMuzzleFlashes(): Promise<FlashPack | null> {
  loading ??= fetch(versioned(`${BASE}muzzle_flash.json`))
    .then((r) => (r.ok ? (r.json() as Promise<FlashPack>) : null))
    .then((p) => (pack = p && p.effects ? p : null))
    .catch(() => null);
  return loading;
}

/**
 * Which flash a weapon makes and how big (metres per pack unit): its own
 * `view.muzzle` when it names one, else by family. Null: no flash of this
 * kind (melee, beams; the railgun keeps its own).
 */
export function muzzleEffectFor(def: WeaponDefinition): { id: string; scale: number } | null {
  if (def.kind === 'melee' || def.view.beam || def.id === 'core.railgun') return null;
  const own = def.view.muzzle;
  if (own) return { id: own.effect, scale: own.scale ?? 0.2 };
  switch (def.family) {
    case 'pistol':
      return { id: 'short_flash_01', scale: 0.15 };
    case 'revolver':
      return { id: 'short_flash_03', scale: 0.18 };
    case 'machine_pistol':
      return { id: 'short_flash_04', scale: 0.15 };
    case 'smg':
      return { id: 'muzzle_flash_02', scale: 0.17 };
    case 'rifle':
      return { id: 'muzzle_flash_01', scale: 0.2 };
    case 'marksman':
      return { id: 'muzzle_flash_05', scale: 0.2 };
    case 'precision':
      return { id: 'big_flash_06', scale: 0.13 };
    case 'lmg':
      return { id: 'big_flash_01', scale: 0.13 };
    case 'shotgun':
      return { id: 'wide_flash_01', scale: 0.24 };
    default:
      if (def.projectile) return { id: 'big_flash_04', scale: 0.14 };
      if (!def.ammo) return null;
      return def.pellets > 1 ? { id: 'wide_flash_01', scale: 0.22 } : def.damage >= 60 ? { id: 'big_flash_01', scale: 0.13 } : { id: 'muzzle_flash_01', scale: 0.18 };
  }
}

Effect.ShadersStore.ttFlashVertexShader = `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform mat4 world;
uniform mat4 viewProjection;
uniform vec2 cup;
varying vec2 vUV;
void main(void) {
  vec3 p = position;
  // A front flash is cupped: its edges pushed back along the barrel (a radial gradient to a power).
  if (cup.x != 0.0) p.z += pow(clamp(length(uv - 0.5) * 2.0, 0.0, 1.0), cup.y) * cup.x;
  vUV = uv;
  gl_Position = viewProjection * world * vec4(p, 1.0);
}`;

Effect.ShadersStore.ttFlashFragmentShader = `
precision highp float;
varying vec2 vUV;
#ifndef GLOW
uniform sampler2D atlas;
uniform sampler2D noiseTex;
#endif
uniform vec4 tile;
uniform float life;
uniform vec4 fade;
uniform vec2 scroll;
uniform vec2 smoothing;
uniform float time;
uniform float emission;
uniform float opacity;
uniform vec3 primary;
uniform vec3 secondary;
vec2 alignUv(vec2 uv, float a) {
  if (a < 0.5) return uv;
  if (a < 1.5) return uv.yx;
  if (a < 2.5) return vec2(1.0 - uv.x, uv.y);
  return vec2(1.0 - uv.y, uv.x);
}
void main(void) {
#ifdef GLOW
  // The glow: a soft round mask, coloured from the second colour at its rim to the first at its heart.
  float mask = pow(clamp(1.0 - length(vUV - 0.5) * 2.0, 0.0, 1.0), fade.x);
  vec3 col = mix(secondary, primary, mask) * min(1.6, 0.55 + 0.25 * emission);
  gl_FragColor = vec4(col, mask * life * opacity);
#else
  // Godot's UVs run down from the top; the atlas is upright.
  vec2 t = clamp(alignUv(vUV, tile.w), 0.004, 0.996);
  float v = texture2D(atlas, vec2((tile.x + t.x) * tile.z, 1.0 - (tile.y + t.y) * tile.z)).r;
  // Eaten away from the muzzle end as it fades, then dimmed, then broken up by noise.
  v = clamp(v - clamp((vUV.y - 1.0) + life * fade.y * 1.3, 0.0, 1.0), 0.0, 1.0);
  v = mix(v, v * (1.0 - life), fade.x);
  v *= 1.0 - (1.0 - texture2D(noiseTex, vUV + time * scroll).r) * fade.w;
  float a = smoothstep(0.0, max(0.001, smoothing.y), v);
  a *= step(fade.z, min(min(vUV.x, 1.0 - vUV.x), min(vUV.y, 1.0 - vUV.y)));
  vec3 col = mix(secondary, primary, smoothstep(0.0, max(0.001, smoothing.x), v));
  // A hot, paler heart where it's densest (the pack gets this from its emission and the renderer's glow).
  col = mix(col, vec3(1.0, 0.98, 0.9), smoothstep(0.7, 1.0, v) * 0.55) * min(1.4, 0.55 + 0.25 * emission);
  gl_FragColor = vec4(col, a * opacity);
#endif
}`;

/** A Godot Curve sampled at x (cubic between points, with their tangents; flat outside). */
export function sampleCurve(points: readonly number[][] | null, x: number, fallback: number): number {
  if (!points?.length) return fallback;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  if (x <= first[0]!) return first[1]!;
  if (x >= last[0]!) return last[1]!;
  for (let i = 0; i + 1 < points.length; i++) {
    const [x0, y0, , r0] = points[i]! as [number, number, number, number];
    const [x1, y1, l1] = points[i + 1]! as [number, number, number, number];
    if (x > x1) continue;
    const d = x1 - x0;
    const t = d > 0 ? (x - x0) / d : 0;
    // Bezier through the tangents (as Godot draws its curves), x taken as evenly spread.
    const c1 = y0 + (r0 * d) / 3;
    const c2 = y1 - (l1 * d) / 3;
    const u = 1 - t;
    return u * u * u * y0 + 3 * u * u * t * c1 + 3 * u * t * t * c2 + t * t * t * y1;
  }
  return last[1]!;
}

interface SceneShared {
  atlas: Texture;
  noise: RawTexture;
  blade: Mesh;
  front: Mesh;
  glow: Mesh;
}
const shared = new WeakMap<Scene, SceneShared>();

/** Tileable cellular noise (the pack scrolls Godot's FastNoiseLite cellular noise over its long flames). */
function noiseTexture(scene: Scene): RawTexture {
  const n = 64;
  const cells = 6;
  const pts: [number, number][] = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < cells * cells; i++) pts.push([((i % cells) + rnd()) / cells, (Math.floor(i / cells) + rnd()) / cells]);
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let best = 9;
      for (const [px, py] of pts) {
        let dx = Math.abs(x / n - px);
        let dy = Math.abs(y / n - py);
        dx = Math.min(dx, 1 - dx);
        dy = Math.min(dy, 1 - dy);
        best = Math.min(best, Math.hypot(dx, dy));
      }
      const v = Math.round(Math.min(1, best * cells * 1.1) * 255);
      data.set([v, v, v, 255], (y * n + x) * 4);
    }
  }
  const tex = RawTexture.CreateRGBATexture(data, n, n, scene, false, false, Texture.BILINEAR_SAMPLINGMODE);
  tex.wrapU = Texture.WRAP_ADDRESSMODE;
  tex.wrapV = Texture.WRAP_ADDRESSMODE;
  return tex;
}

/** A unit quad in the rig's space: `blade` lies along +Z (the barrel) in the YZ plane, from z 0 to 1, x 0; `front` faces down the barrel (XY), centred; both with Godot's UVs (v down from the far end / top). */
function quad(scene: Scene, name: string, kind: 'blade' | 'front' | 'glow'): Mesh {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const n = kind === 'front' ? 8 : 1;
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const v = j / n;
      // Blade: across is Y (-0.5..0.5), along is Z: v = 0 at the far end. Front and glow: X across, Y up (v = 0 at the top).
      if (kind === 'blade') positions.push(0, u - 0.5, 1 - v);
      else positions.push(u - 0.5, 0.5 - v, 0);
      uvs.push(u, v);
    }
  }
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * (n + 1) + i;
      indices.push(a, a + n + 1, a + 1, a + 1, a + n + 1, a + n + 2);
    }
  }
  const vd = new VertexData();
  vd.positions = positions;
  vd.uvs = uvs;
  vd.indices = indices;
  const mesh = new Mesh(name, scene);
  vd.applyToMesh(mesh);
  mesh.isPickable = false;
  mesh.setEnabled(false);
  return mesh;
}

/**
 * A rig's piece: a new mesh on the shared quad's geometry. Not `clone()`: that deep-copies the source's
 * properties, about 1 ms a piece (a big flash has 15), and a player's first shot builds a rig mid-fight.
 */
function pieceOf(quad: Mesh, name: string): Mesh {
  const mesh = new Mesh(name, quad.getScene());
  quad.geometry?.applyToMesh(mesh);
  mesh.isPickable = false;
  return mesh;
}

function sceneShared(scene: Scene): SceneShared {
  let s = shared.get(scene);
  if (!s) {
    const atlas = new Texture(versioned(`${BASE}muzzle_flash.webp`), scene, false, true, Texture.TRILINEAR_SAMPLINGMODE);
    atlas.wrapU = Texture.CLAMP_ADDRESSMODE;
    atlas.wrapV = Texture.CLAMP_ADDRESSMODE;
    s = { atlas, noise: noiseTexture(scene), blade: quad(scene, 'flashBlade', 'blade'), front: quad(scene, 'flashFront', 'front'), glow: quad(scene, 'flashGlow', 'glow') };
    shared.set(scene, s);
  }
  return s;
}

function flashMaterial(scene: Scene, name: string, glow: boolean): ShaderMaterial {
  const m = new ShaderMaterial(name, scene, { vertex: 'ttFlash', fragment: 'ttFlash' }, {
    attributes: ['position', 'uv'],
    uniforms: ['world', 'viewProjection', 'cup', 'tile', 'life', 'fade', 'scroll', 'smoothing', 'time', 'emission', 'opacity', 'primary', 'secondary'],
    samplers: glow ? [] : ['atlas', 'noiseTex'],
    defines: glow ? ['#define GLOW'] : [],
    needAlphaBlending: true,
  });
  // A new material, only ever given uniforms: nothing to mark dirty. Setting backFaceCulling or alphaMode
  // otherwise walks every mesh in the scene, three times a piece; with 96 players about 5,000 meshes, so a
  // player's first shot (a rig of up to 15 pieces) stalled for tens of milliseconds.
  m.blockDirtyMechanism = true;
  m.backFaceCulling = false;
  m.disableDepthWrite = true;
  m.alphaMode = Constants.ALPHA_COMBINE;
  return m;
}

interface Piece {
  mesh: Mesh;
  mat: ShaderMaterial;
  layer: Layer | null;
  delay: number;
  size: number;
}

/**
 * One gun's flash: built for an effect, fired each shot (new random turns
 * and sizes), animated by `update`. Its root sits at the muzzle with +Z down
 * the barrel; parent it to the gun (or place it each frame).
 */
export class MuzzleFlashRig {
  readonly root: TransformNode;
  private pieces: Piece[] = [];
  private firedAt = -1;
  private length = 0;
  private effectId = '';
  private readonly renderingGroupId: number;

  constructor(
    private readonly scene: Scene,
    private readonly name: string,
    opts: { renderingGroupId?: number } = {},
  ) {
    this.root = new TransformNode(name, scene);
    this.renderingGroupId = opts.renderingGroupId ?? 0;
  }

  /** Whether the pack's settings are in (until then, callers draw their own flash). */
  static ready(): boolean {
    return !!pack;
  }

  private build(id: string): boolean {
    if (id === this.effectId) return true;
    const fx = pack?.effects[id];
    if (!fx || !pack) return false;
    this.clear();
    this.effectId = id;
    const s = sceneShared(this.scene);
    const cols = pack.atlas.cols;
    const primary = Color3.FromArray(fx.primary);
    const secondary = Color3.FromArray(fx.secondary);
    fx.layers.forEach((layer, li) => {
      for (let i = 0; i < layer.count; i++) {
        const mat = flashMaterial(this.scene, `${this.name}_m${li}_${i}`, false);
        mat.setTexture('atlas', s.atlas);
        mat.setTexture('noiseTex', s.noise);
        mat.setVector4('tile', new Vector4(layer.tile % cols, Math.floor(layer.tile / cols), 1 / cols, layer.align));
        mat.setVector4('fade', new Vector4(layer.fadeBasic, layer.fadeDir, layer.cutoff, layer.noise));
        mat.setVector2('scroll', new Vector2(layer.scroll[0], layer.scroll[1]));
        mat.setVector2('smoothing', new Vector2(layer.colorSmooth, layer.edgeSmooth));
        mat.setVector2('cup', layer.cup ? new Vector2(layer.cup.dist / Math.max(0.001, layer.w), layer.cup.exp) : new Vector2(0, 1));
        mat.setFloat('emission', layer.emission);
        mat.setFloat('opacity', 1);
        mat.setColor3('primary', primary);
        mat.setColor3('secondary', secondary);
        const mesh = pieceOf(layer.type === 'front' ? s.front : s.blade, `${this.name}_${li}_${i}`);
        mesh.metadata = EFFECT;
        mesh.material = mat;
        mesh.parent = this.root;
        mesh.renderingGroupId = this.renderingGroupId;
        mesh.setEnabled(false);
        // Particles come out over the first (1 - explosiveness) of their life, in turn.
        const delay = (i / layer.count) * layer.life * (1 - layer.explode);
        this.pieces.push({ mesh, mat, layer, delay, size: 1 });
      }
    });
    if (fx.glow) {
      const mat = flashMaterial(this.scene, `${this.name}_glow`, true);
      mat.setVector4('fade', new Vector4(fx.glow.maskExp, 0, 0, 0));
      mat.setFloat('emission', fx.glow.emission);
      mat.setFloat('opacity', fx.glow.alphaMul);
      mat.setColor3('primary', primary);
      mat.setColor3('secondary', secondary);
      mat.setVector2('cup', new Vector2(0, 1));
      const mesh = pieceOf(s.glow, `${this.name}_glow`);
      mesh.metadata = EFFECT;
      mesh.material = mat;
      mesh.parent = this.root;
      mesh.renderingGroupId = this.renderingGroupId;
      mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
      // The pack's glow is a dome from `at` back towards the muzzle: a disc in its back half, where the flame is
      // (further out, seen from behind the gun it floats ahead of the flame as a separate dot), as wide as it.
      mesh.position.z = fx.glow.at - fx.glow.height * 0.75;
      mesh.scaling.setAll(fx.glow.radius * 2.2);
      mesh.setEnabled(false);
      this.pieces.push({ mesh, mat, layer: null, delay: 0, size: 1 });
    }
    this.length = fx.length;
    return true;
  }

  /** A shot: the effect (built the first time) at this scale, with fresh random turns and sizes. False when it can't be drawn yet. */
  fire(id: string, scale: number): boolean {
    if (!this.build(id)) return false;
    this.root.scaling.setAll(scale);
    this.firedAt = performance.now();
    for (const p of this.pieces) {
      const l = p.layer;
      if (!l) continue;
      p.size = l.scale[0] + Math.random() * (l.scale[1] - l.scale[0]);
      const turn = l.spin ? Math.random() * Math.PI * 2 : 0;
      if (l.type === 'blade') {
        // Along the barrel from `at`, centred `mid` along; turned about the barrel.
        p.mesh.position.set(0, 0, l.at + (l.mid - l.h / 2) * p.size);
        p.mesh.rotation.set(0, 0, turn);
        p.mesh.scaling.set(1, l.w * p.size, l.h * p.size);
      } else {
        p.mesh.position.set(0, 0, l.at);
        p.mesh.rotation.set(0, 0, turn);
        p.mesh.scaling.set(l.w * p.size, l.h * p.size, l.w * p.size);
      }
    }
    return true;
  }

  /**
   * Build these flashes once (the shared pieces, the materials) while the match loads: the first shot of each
   * built them mid-fight. One hidden rig per scene does it.
   */
  static warm(scene: Scene, ids: readonly string[]): void {
    let rig = warmRigs.get(scene);
    if (!rig) warmRigs.set(scene, (rig = new MuzzleFlashRig(scene, 'muzzleFlashWarm')));
    for (const id of ids) rig.build(id);
  }

  /** Tests and screenshots: hold every flash at this many ms after its shot (undefined: play normally). */
  static hold: number | undefined;

  /** Animate; returns whether anything is showing. */
  update(now = performance.now()): boolean {
    if (this.firedAt < 0) return false;
    if (MuzzleFlashRig.hold !== undefined) now = this.firedAt + MuzzleFlashRig.hold;
    const t = ((now - this.firedAt) / 1000) * SPEED;
    let any = false;
    for (const p of this.pieces) {
      const l = p.layer;
      if (!l) {
        // Glow: 1 → 0 over the effect, easing out.
        const x = this.length > 0 ? t / this.length : 1;
        const on = x < 1;
        p.mesh.setEnabled(on);
        if (on) p.mat.setFloat('life', (1 - x) * (1 - x));
        any ||= on;
        continue;
      }
      const x = (t - p.delay) / l.life;
      const on = x >= 0 && x < 1;
      p.mesh.setEnabled(on);
      if (!on) continue;
      any = true;
      p.mat.setFloat('life', Math.min(1, Math.max(0, sampleCurve(l.alpha, x, x))));
      p.mat.setFloat('time', now / 1000);
      if (l.size) {
        const k = p.size * sampleCurve(l.size, x, 1);
        if (l.type === 'blade') p.mesh.scaling.set(1, l.w * k, l.h * k);
        else p.mesh.scaling.set(l.w * k, l.h * k, l.w * k);
      }
    }
    if (!any) this.firedAt = -1;
    return any;
  }

  hide(): void {
    this.firedAt = -1;
    for (const p of this.pieces) p.mesh.setEnabled(false);
  }

  private clear(): void {
    for (const p of this.pieces) {
      p.mat.dispose();
      p.mesh.dispose();
    }
    this.pieces = [];
    this.effectId = '';
  }

  dispose(): void {
    this.clear();
    this.root.dispose();
  }
}
