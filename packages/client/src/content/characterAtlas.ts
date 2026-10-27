import type { Scene } from '@babylonjs/core/scene';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { GEAR_FINISH_SLOTS, gearFinishTexels } from './mergeParts.ts';

/** Where a texture sits in the atlas: atlas UV = offset + UV × scale (UVs in [0, rep)). */
interface Tile {
  u0: number;
  v0: number;
  su: number;
  sv: number;
  repU: number;
  repV: number;
}

/** Atlas size, and its fixed slots: the two skins, two hair textures, and eye textures repeated twice across (the last slot is gear's, below). */
const W = 2048;
const H = 1536;
const SLOTS: readonly { x: number; y: number; w: number; h: number }[] = [
  { x: 0, y: 0, w: 1024, h: 1024 },
  { x: 1024, y: 0, w: 1024, h: 1024 },
  { x: 0, y: 1024, w: 512, h: 512 },
  { x: 512, y: 1024, w: 512, h: 512 },
  { x: 1024, y: 1024, w: 512, h: 256 },
  { x: 1024, y: 1280, w: 512, h: 256 },
  { x: 1536, y: 1024, w: 512, h: 256 },
];
/**
 * Gear's slot: plain white (gear is coloured per vertex), with its finishes
 * (metallic, roughness) in the matching texels of the small finish texture,
 * one row per culling side. Gear UVs land in its middle, clear of the
 * neighbouring tiles at all but the smallest mip levels.
 */
const GEAR = { x: 1536, y: 1280, w: 512, h: 256 };
/** The finish texture: one texel per 32 × 32 atlas pixels (only gear's texels vary). */
const MR_W = W / 32;
const MR_H = H / 32;
/** Gear finish texels: columns MR_X0 + slot, row per culling side. */
const MR_X0 = GEAR.x / 32 + 4;
const MR_ROW = { culled: GEAR.y / 32 + 1, both: GEAR.y / 32 + 5 };
/** UV slack at a tile's edges (an exporter's 1.0001 is still inside). */
const SLACK = 0.01;

/**
 * One texture for every character's skin, hair and eyes in a scene (they share
 * a handful of textures and differ only in tint), so a character's head, arms,
 * eyes, eyebrows, hair and gear are one draw: each part's UVs move into its
 * texture's tile and its tint goes into its vertex colours (albedo × texture ×
 * vertex colour, the same product); gear (coloured per vertex) samples a
 * white tile, with its finishes in a small metallic/roughness texture laid
 * over the atlas. Outfits (dyed per look) keep their own draw. Parts whose
 * UVs leave their tile, or whose material differs in anything but texture
 * and tint, are left as they are. Gear is drawn from both sides, as skin is.
 */
export class CharacterAtlas {
  private readonly pixels = new Uint8Array(W * H * 4);
  private readonly texture: RawTexture;
  private readonly tiles = new Map<string, Promise<Tile | null>>();
  private readonly used = new Set<number>();
  private pending = false;
  /** Metallic (blue) and roughness (green) over the atlas, for gear's finishes; null until a character's surface sets the rest. */
  private readonly finish = new Uint8Array(MR_W * MR_H * 4);
  private finishTexture: RawTexture | null = null;
  private surface: string | null = null;

  constructor(private readonly scene: Scene) {
    for (let y = GEAR.y; y < GEAR.y + GEAR.h; y++) this.pixels.fill(255, (y * W + GEAR.x) * 4, (y * W + GEAR.x + GEAR.w) * 4);
    this.texture = RawTexture.CreateRGBATexture(this.pixels, W, H, scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
    this.texture.name = 'characterAtlas';
    this.texture.wrapU = this.texture.wrapV = Texture.CLAMP_ADDRESSMODE;
  }

  /**
   * The finish texture, filled with the skin surface's metallic and roughness
   * and the gear tables' finishes (refreshed whenever a table has grown).
   */
  private finishes(base: PBRMaterial): RawTexture | null {
    const metal = base.metallic ?? 1;
    const rough = base.roughness ?? 1;
    const surface = `${metal}|${rough}`;
    // Characters on another surface keep their gear apart (never so far: every skin is the same).
    if (this.surface !== null && this.surface !== surface) return null;
    if (this.surface === null) {
      this.surface = surface;
      for (let i = 0; i < MR_W * MR_H; i++) this.finish.set([255, Math.round(rough * 255), Math.round(metal * 255), 255], i * 4);
    }
    let changed = !this.finishTexture;
    for (const [side, row] of [[true, MR_ROW.culled], [false, MR_ROW.both]] as const) {
      const table = gearFinishTexels(this.scene, side);
      if (!table) continue;
      for (let i = 0; i < GEAR_FINISH_SLOTS; i++) {
        const at = (row * MR_W + MR_X0 + i) * 4;
        for (let k = 0; k < 4; k++) {
          if (this.finish[at + k] === table[i * 4 + k]) continue;
          this.finish[at + k] = table[i * 4 + k]!;
          changed = true;
        }
      }
    }
    if (!this.finishTexture) {
      this.finishTexture = RawTexture.CreateRGBATexture(this.finish, MR_W, MR_H, this.scene, false, false, Texture.NEAREST_SAMPLINGMODE);
      this.finishTexture.name = 'characterAtlasFinish';
      this.finishTexture.wrapU = this.finishTexture.wrapV = Texture.CLAMP_ADDRESSMODE;
      // Data, not colour.
      this.finishTexture.gammaSpace = false;
    } else if (changed) this.finishTexture.update(this.finish);
    return this.finishTexture;
  }

  /**
   * Move a character's skin, hair and eye parts (full and low-detail meshes)
   * onto the atlas with one material of their own (so a power-up glow still
   * lights only this character). Call before merging parts: parts that now
   * share the material merge into one mesh.
   */
  async apply(meshes: readonly AbstractMesh[], name: string, accept: (mat: PBRMaterial) => boolean): Promise<PBRMaterial | null> {
    const parts: { mesh: Mesh; mat: PBRMaterial; tex: BaseTexture; uv: Float32Array | number[]; rep: [number, number] }[] = [];
    for (const m of meshes) {
      const mat = m.material;
      if (!(m instanceof Mesh) || !m.skeleton || !(mat instanceof PBRMaterial) || !accept(mat) || !eligible(mat)) continue;
      const tex = mat.albedoTexture!;
      const uv = m.getVerticesData(VertexBuffer.UVKind);
      if (!uv) continue;
      const rep = repeats(uv);
      if (!rep) continue;
      parts.push({ mesh: m, mat, tex, uv, rep });
    }
    if (!parts.length) return null;
    // Gear (one skinned mesh per character, coloured per vertex, finishes from a table) joins them on the atlas's white tile.
    const gear = meshes.filter((m): m is Mesh => m instanceof Mesh && !!m.skeleton && m.material instanceof PBRMaterial && m.material.metallicTexture?.name === 'gearFinishes' && !m.material.albedoTexture);
    const base = parts[0]!.mat;
    const key = surfaceKey(base);
    // A texture that doesn't wrap fits a tile made for wrapping across too (the eyes come both ways).
    const tileFor = async (tex: BaseTexture, [ru, rv]: [number, number]) => (await this.tile(tex, ru, rv)) ?? (ru === 1 ? this.tile(tex, 2, rv) : null);
    const tiles = await Promise.all(parts.map((p) => (surfaceKey(p.mat) === key ? tileFor(p.tex, p.rep) : Promise.resolve(null))));
    if (tiles.filter(Boolean).length < 2) return null;
    const finish = gear.length ? this.finishes(base) : null;
    const material = base.clone(`${name}_atlas`) as PBRMaterial;
    material.albedoTexture = this.texture;
    material.albedoColor = Color3.White();
    if (finish) {
      // Metallic and roughness from the finish texture (the skin's own values everywhere but gear's texels).
      material.metallic = 1;
      material.roughness = 1;
      material.metallicTexture = finish;
      material.useRoughnessFromMetallicTextureAlpha = false;
      material.useRoughnessFromMetallicTextureGreen = true;
      material.useMetallnessFromMetallicTextureBlue = true;
    }
    const old = new Set<PBRMaterial>();
    parts.forEach((p, i) => {
      const t = tiles[i];
      if (!t || p.mesh.isDisposed()) return;
      const m = p.mesh;
      // Its own vertices: the part's geometry is shared with every other copy of it.
      m.makeGeometryUnique();
      const n = p.uv.length / 2;
      const uv = new Float32Array(n * 2);
      for (let k = 0; k < n; k++) {
        uv[k * 2] = t.u0 + clamp(p.uv[k * 2]!, t.repU) * t.su;
        uv[k * 2 + 1] = t.v0 + clamp(p.uv[k * 2 + 1]!, t.repV) * t.sv;
      }
      m.setVerticesData(VertexBuffer.UVKind, uv, false, 2);
      const c = p.mat.albedoColor;
      const had = m.getVerticesData(VertexBuffer.ColorKind);
      const stride = had && had.length === n * 3 ? 3 : 4;
      const colors = new Float32Array(n * 4);
      for (let k = 0; k < n; k++) {
        const r = had ? had[k * stride]! : 1;
        const g = had ? had[k * stride + 1]! : 1;
        const b = had ? had[k * stride + 2]! : 1;
        const a = had && stride === 4 ? had[k * stride + 3]! : 1;
        colors.set([r * c.r, g * c.g, b * c.b, a], k * 4);
      }
      m.setVerticesData(VertexBuffer.ColorKind, colors, false, 4);
      m.useVertexColors = true;
      old.add(p.mat);
      m.material = material;
    });
    if (finish) {
      // Low-detail copies of the skin, hair and eyes are drawn past this distance: gear (which has none) merges with them.
      const lodAs = parts.find((p) => p.mesh.material === material && p.mesh.getLODLevels().length)?.mesh.getLODLevels()[0]?.distanceOrScreenCoverage ?? undefined;
      for (const m of gear) {
        const uv = m.getVerticesData(VertexBuffer.UVKind);
        if (!uv) continue;
        const row = (m.material as PBRMaterial).backFaceCulling ? MR_ROW.culled : MR_ROW.both;
        const out = new Float32Array(uv.length);
        for (let k = 0; k < uv.length; k += 2) {
          // The table's U is (slot + 0.5) / slots: the same slot's texel in the finish texture, at its centre.
          const slot = Math.min(GEAR_FINISH_SLOTS - 1, Math.floor(uv[k]! * GEAR_FINISH_SLOTS));
          out[k] = (MR_X0 + slot + 0.5) / MR_W;
          out[k + 1] = (row + 0.5) / MR_H;
        }
        m.setVerticesData(VertexBuffer.UVKind, out, false, 2);
        // The head's winding (the import's mirrored meshes count their faces the other way): the same faces, so it can merge.
        const side = parts[0]!.mesh.sideOrientation;
        const idx = m.getIndices();
        if (side !== null && m.sideOrientation !== side && idx) {
          const flipped = Array.from(idx);
          for (let t = 0; t + 2 < flipped.length; t += 3) [flipped[t + 1], flipped[t + 2]] = [flipped[t + 2]!, flipped[t + 1]!];
          m.setIndices(flipped);
          m.sideOrientation = side;
        }
        // Drawn from both sides now, like the skin: closed shapes look the same.
        m.material = material;
        if (lodAs !== undefined) m.metadata = { ...(m.metadata as object | null), mergeLodAs: lodAs };
      }
    }
    // The parts' own (cloned) materials; the shared textures stay.
    for (const mat of old) if (!meshes.some((m) => m.material === mat)) mat.dispose(false, false);
    return material;
  }

  /** The tile of a texture repeated rep times across and down (filled from its pixels on first use). */
  private tile(tex: BaseTexture, repU: number, repV: number): Promise<Tile | null> {
    const key = `${tex.uniqueId}|${repU}|${repV}`;
    let p = this.tiles.get(key);
    if (!p) {
      p = this.fill(tex, repU, repV).catch(() => null);
      this.tiles.set(key, p);
    }
    return p;
  }

  /** Tiles by their pixels' hash: every head file carries its own copy of the same eye texture. */
  private readonly byContent = new Map<string, Tile>();

  private async fill(tex: BaseTexture, repU: number, repV: number): Promise<Tile | null> {
    await ready(tex);
    const { width: w, height: h } = tex.getSize();
    if ((tex as Texture).invertY || !SLOTS.some((s) => s.w === w * repU && s.h === h * repV)) return null;
    const data = await readWithoutStall(tex, w, h);
    if (!data || data.byteLength < w * h * 4) return null;
    const src = new Uint8Array(data.buffer, data.byteOffset, w * h * 4);
    let hash = 0x811c9dc5;
    for (let i = 0; i < src.length; i += 7) hash = Math.imul(hash ^ src[i]!, 16777619);
    const key = `${w}x${h}|${repU}|${repV}|${hash}`;
    const same = this.byContent.get(key);
    if (same) return same;
    const slot = SLOTS.findIndex((s, i) => !this.used.has(i) && s.w === w * repU && s.h === h * repV);
    if (slot < 0) return null;
    this.used.add(slot);
    const s = SLOTS[slot]!;
    for (let ry = 0; ry < repV; ry++) {
      for (let y = 0; y < h; y++) {
        const row = src.subarray(y * w * 4, (y + 1) * w * 4);
        for (let rx = 0; rx < repU; rx++) this.pixels.set(row, ((s.y + ry * h + y) * W + s.x + rx * w) * 4);
      }
    }
    this.upload();
    const tile = { u0: s.x / W, v0: s.y / H, su: w / W, sv: h / H, repU, repV };
    this.byContent.set(key, tile);
    return tile;
  }

  /** Re-upload once for every tile filled in the same moment. */
  private upload(): void {
    if (this.pending) return;
    this.pending = true;
    queueMicrotask(() => {
      this.pending = false;
      // Disposed in the same moment a tile was filled (a scene closing): nothing to upload to.
      if (!this.disposed) this.texture.update(this.pixels);
    });
  }

  private disposed = false;

  dispose(): void {
    this.disposed = true;
    this.texture.dispose();
  }
}

/** A plain opaque PBR surface with only a colour texture (what skin, hair and eyes are). */
function eligible(mat: PBRMaterial): boolean {
  const t = mat.albedoTexture;
  if (!t || mat.alpha < 1 || mat.transparencyMode || (t as Texture).coordinatesIndex || (t as Texture).uScale !== 1 || (t as Texture).vScale !== 1 || (t as Texture).uOffset || (t as Texture).vOffset) return false;
  return !mat.bumpTexture && !mat.metallicTexture && !mat.emissiveTexture && !mat.opacityTexture && !mat.ambientTexture && !mat.reflectivityTexture && !mat.microSurfaceTexture && !mat.lightmapTexture && !mat.useAlphaFromAlbedoTexture;
}

/** Everything about a surface but its colour texture and tint: parts sharing the atlas must agree on it. */
function surfaceKey(mat: PBRMaterial): string {
  return [mat.metallic, mat.roughness, mat.backFaceCulling, mat.emissiveColor.toHexString(), mat.reflectivityColor.toHexString(), mat.directIntensity, mat.environmentIntensity, mat.unlit, mat.disableLighting, mat.twoSidedLighting, mat.sideOrientation].join('|');
}

/** How many times across and down the UVs wrap (1 or 2), or null when they leave [0, 2]. */
function repeats(uv: ArrayLike<number>): [number, number] | null {
  let maxU = 0;
  let maxV = 0;
  for (let i = 0; i < uv.length; i += 2) {
    const u = uv[i]!;
    const v = uv[i + 1]!;
    if (u < -SLACK || v < -SLACK) return null;
    if (u > maxU) maxU = u;
    if (v > maxV) maxV = v;
  }
  const rep = (m: number) => (m <= 1 + SLACK ? 1 : m <= 2 + SLACK ? 2 : 0);
  const ru = rep(maxU);
  const rv = rep(maxV);
  // Only the eyes wrap, across: their tiles are twice as wide.
  return ru && rv === 1 ? [ru, rv] : null;
}

const clamp = (x: number, rep: number) => Math.max(0, Math.min(rep, x));

/** The WebGL2 engine internals an asynchronous texture read needs. */
interface AsyncReadEngine {
  _gl?: WebGL2RenderingContext;
  _webGLVersion?: number;
  _currentFramebuffer?: WebGLFramebuffer | null;
  _readPixelsAsync?: (x: number, y: number, w: number, h: number, format: number, type: number, out: ArrayBufferView) => Promise<ArrayBufferView> | null;
}

/**
 * A texture's pixels without waiting for the GPU. `readPixels` reads back at
 * once: the page's thread waits until the GPU has drawn everything queued
 * before it. A character's skin, hair and eye textures arrive while the first
 * frames of a big match are still being drawn, and on a slow GPU (or a CPU
 * renderer on a busy machine) dozens of those waits made seconds-long stalls
 * in the warm-up (PERF_96.md, "Warm-up hang"). On WebGL2 the read goes into a
 * buffer and is collected once a fence says the GPU got there; elsewhere, or
 * if that fails, the plain read.
 */
async function readWithoutStall(tex: BaseTexture, w: number, h: number): Promise<ArrayBufferView | null> {
  const engine = tex.getScene()?.getEngine() as unknown as AsyncReadEngine | undefined;
  const gl = engine?._gl;
  const handle = tex.getInternalTexture()?._hardwareTexture?.underlyingResource as WebGLTexture | undefined;
  if (engine && gl && (engine._webGLVersion ?? 1) >= 2 && engine._readPixelsAsync && handle) {
    let done: Promise<ArrayBufferView> | null = null;
    const fb = gl.createFramebuffer();
    try {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, handle, 0);
      done = engine._readPixelsAsync(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(w * h * 4));
    } catch {
      done = null;
    } finally {
      gl.bindFramebuffer(gl.FRAMEBUFFER, engine._currentFramebuffer ?? null);
      gl.deleteFramebuffer(fb);
    }
    const data = done ? await done.catch(() => null) : null;
    if (data) return data;
  }
  return tex.readPixels();
}

function ready(tex: BaseTexture): Promise<void> {
  if (tex.isReady()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const t = tex as Texture;
    const timer = setTimeout(() => reject(new Error('texture never loaded')), 20000);
    if (t.onLoadObservable) {
      t.onLoadObservable.addOnce(() => {
        clearTimeout(timer);
        resolve();
      });
    } else {
      clearTimeout(timer);
      reject(new Error('no load event'));
    }
  });
}
