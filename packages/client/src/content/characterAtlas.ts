import type { Scene } from '@babylonjs/core/scene';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';

/** Where a texture sits in the atlas: atlas UV = offset + UV × scale (UVs in [0, rep)). */
interface Tile {
  u0: number;
  v0: number;
  su: number;
  sv: number;
  repU: number;
  repV: number;
}

/** Atlas size, and its fixed slots: the two skins, two hair textures, and eye textures repeated twice across. */
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
  { x: 1536, y: 1280, w: 512, h: 256 },
];
/** UV slack at a tile's edges (an exporter's 1.0001 is still inside). */
const SLACK = 0.01;

/**
 * One texture for every character's skin, hair and eyes in a scene (they share
 * a handful of textures and differ only in tint), so a character's head, arms,
 * eyes, eyebrows and hair are one draw: each part's UVs move into its
 * texture's tile and its tint goes into its vertex colours (albedo × texture ×
 * vertex colour, the same product). Outfits (dyed per look) and gear keep
 * their own draws. Parts whose UVs leave their tile, or whose material
 * differs in anything but texture and tint, are left as they are.
 */
export class CharacterAtlas {
  private readonly pixels = new Uint8Array(W * H * 4);
  private readonly texture: RawTexture;
  private readonly tiles = new Map<string, Promise<Tile | null>>();
  private readonly used = new Set<number>();
  private pending = false;

  constructor(private readonly scene: Scene) {
    this.texture = RawTexture.CreateRGBATexture(this.pixels, W, H, scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
    this.texture.name = 'characterAtlas';
    this.texture.wrapU = this.texture.wrapV = Texture.CLAMP_ADDRESSMODE;
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
    const base = parts[0]!.mat;
    const key = surfaceKey(base);
    // A texture that doesn't wrap fits a tile made for wrapping across too (the eyes come both ways).
    const tileFor = async (tex: BaseTexture, [ru, rv]: [number, number]) => (await this.tile(tex, ru, rv)) ?? (ru === 1 ? this.tile(tex, 2, rv) : null);
    const tiles = await Promise.all(parts.map((p) => (surfaceKey(p.mat) === key ? tileFor(p.tex, p.rep) : Promise.resolve(null))));
    if (tiles.filter(Boolean).length < 2) return null;
    const material = base.clone(`${name}_atlas`) as PBRMaterial;
    material.albedoTexture = this.texture;
    material.albedoColor = Color3.White();
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
    const data = await tex.readPixels();
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
      this.texture.update(this.pixels);
    });
  }

  dispose(): void {
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
