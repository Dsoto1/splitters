import type { Scene } from '@babylonjs/core/scene';
import type { Material } from '@babylonjs/core/Materials/material';
import type { UniformBuffer } from '@babylonjs/core/Materials/uniformBuffer';
import type { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { RawTexture2DArray } from '@babylonjs/core/Materials/Textures/rawTexture2DArray';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Constants } from '@babylonjs/core/Engines/constants';

/**
 * Level draw merging (docs/PERF_96.md, "Performance round 2"). The level (tiles, free blocks, trim and terrain) is
 * built as one mesh per surface style (material and tint, MapStyler): Market Town's is 58 draws in the main pass, and
 * as many again in the water's reflection. Here the meshes of every opaque, non-glowing style are merged across
 * styles into one mesh per texture size and MERGE_CHUNK square: each surface's textures become layers of shared array
 * textures (one for colour, one for normal maps), and each vertex carries its surface's layers, tint and shine. The
 * merged material is the same StandardMaterial lighting (shadows, lights, fog, specular) with those few lookups taken
 * from the vertex instead of the material (LevelArrayPlugin), so the look is unchanged; collision never used these
 * meshes (it is built from the map's boxes).
 *
 * WebGL2 only (array textures in GLSL); elsewhere the level stays one mesh per style.
 */

/**
 * Mip bias for the level's textures on a view drawn small and shown magnified (docs/LOOK.md, "No flicker: texture
 * shimmer"). A phone draws at 0.75 px per CSS pixel on a 2.5-3x screen: each drawn pixel is shown 3-4 device pixels
 * wide, so a speckled floor (terrazzo, gravel, carpet) whose specks are a drawn pixel across twinkles as you turn,
 * mipmaps or not. A mip level per doubling of that magnification past 1.5x (about 0.1 on a desktop at its usual scale,
 * a whole level on a phone at Performance), at most 1: a touch softer, steady.
 */
export function levelMipBias(devicePixelRatio: number, renderRatio: number): number {
  const shown = devicePixelRatio / Math.max(renderRatio, 0.05);
  return shown <= 1.5 ? 0 : Math.min(1, Math.round(Math.log2(shown / 1.5) * 100) / 100);
}

/** Merged level meshes are cut into squares this big (m): the whole level in view is a few draws, and far parts cull. */
export const MERGE_CHUNK = 128;

/** One per-style level mesh to merge: its surface's textures (colour and normal maps, or a procedural pattern), tint and shine. */
export interface MergeSource {
  mesh: Mesh;
  /** Texture key: equal keys share a layer. */
  key: string;
  /** Side of the square texture (px): sources merge with others of the same size. */
  size: number;
  /** Colour pixels (RGBA, rows bottom first as WebGL samples them), loaded when the merge runs. */
  color: () => Promise<Uint8Array>;
  /** Normal-map pixels, or null for a surface without one. */
  normal: (() => Promise<Uint8Array>) | null;
  tint: Color3;
  /** Specular colour (grey) and power, as the per-style material had them. */
  specular: number;
  power: number;
}

/**
 * The StandardMaterial's few per-surface inputs from the vertex: the diffuse colour (tint), the colour and normal-map
 * texels from layers of array textures, the specular colour and power. Everything else in the shader is
 * StandardMaterial's own. The replacements match Babylon 9's (minified) default shader text; a mismatch leaves the
 * material sampling its 1×1 stand-in textures, which the level-merge e2e check would show as untextured walls.
 */
export class LevelArrayPlugin extends MaterialPluginBase {
  constructor(
    material: Material,
    private readonly colors: BaseTexture,
    private readonly normals: BaseTexture | null,
    /** Mip level bias of the surface lookups (`levelMipBias`): blurrier, steadier textures on a magnified low-res view. */
    private readonly mipBias = 0,
  ) {
    super(material, 'LevelArray', 200, { LEVELARRAY: false }, true, true);
  }

  override getClassName(): string {
    return 'LevelArrayPlugin';
  }

  override prepareDefines(defines: Record<string, unknown>): void {
    defines['LEVELARRAY'] = true;
  }

  override getAttributes(attributes: string[]): void {
    attributes.push('levelA', 'levelB');
  }

  override getSamplers(samplers: string[]): void {
    samplers.push('levelColors', 'levelNormals');
  }

  override bindForSubMesh(uniformBuffer: UniformBuffer): void {
    uniformBuffer.setTexture('levelColors', this.colors);
    uniformBuffer.setTexture('levelNormals', this.normals ?? this.colors);
  }

  override getActiveTextures(active: BaseTexture[]): void {
    active.push(this.colors);
    if (this.normals) active.push(this.normals);
  }

  override hasTexture(texture: BaseTexture): boolean {
    return texture === this.colors || texture === this.normals;
  }

  override getCustomCode(shaderType: string): Record<string, string> | null {
    const bias = this.mipBias > 0 ? `,${this.mipBias.toFixed(2)}` : '';
    if (shaderType === 'vertex') {
      return {
        CUSTOM_VERTEX_DEFINITIONS: 'attribute vec4 levelA;\nattribute vec4 levelB;\nvarying vec4 vLevelA;\nvarying vec4 vLevelB;',
        CUSTOM_VERTEX_MAIN_END: 'vLevelA=levelA;\nvLevelB=levelB;',
      };
    }
    return {
      CUSTOM_FRAGMENT_DEFINITIONS: 'uniform highp sampler2DArray levelColors;\nuniform highp sampler2DArray levelNormals;\nvarying vec4 vLevelA;\nvarying vec4 vLevelB;',
      // Tint: the per-style material's diffuse colour.
      '!vec3 diffuseColor=vDiffuseColor\\.rgb;': 'vec3 diffuseColor=vLevelA.rgb;',
      // Colour texel from the surface's layer.
      '!baseColor=TEXRD\\(diffuseSampler,vDiffuseUV\\+uvOffset\\);': `baseColor=texture(levelColors,vec3(vDiffuseUV+uvOffset,vLevelA.w)${bias});`,
      // Normal-map texel from the surface's layer (a surface without one stays flat). Sampled on every pixel, then
      // chosen: a texture lookup inside a branch that differs between neighbouring pixels picks its mip level from
      // undefined derivatives (GLSL ES 3.0), which some phone GPUs show as sparkling.
      '!normalW=perturbNormal\\(TBN,TEXRD\\(bumpSampler,vBumpUV\\+uvOffset\\)\\.xyz,vBumpInfos\\.y\\);':
        `normalW=perturbNormal(TBN,mix(texture(levelNormals,vec3(vBumpUV+uvOffset,max(vLevelB.x,0.0))${bias}).xyz,vec3(0.5,0.5,1.0),step(vLevelB.x,-0.5)),vBumpInfos.y);`,
      // Specular colour and power.
      '!float glossiness=vSpecularColor\\.a;vec3 specularColor=vSpecularColor\\.rgb;': 'float glossiness=vLevelB.z;vec3 specularColor=vec3(vLevelB.y);',
    };
  }
}

interface Chunk {
  positions: number[];
  normals: number[];
  uvs: number[];
  a: number[];
  b: number[];
  indices: number[];
}

interface Layered {
  sources: MergeSource[];
  colorLayer: Map<string, number>;
  normalLayer: Map<string, number>;
}

/** Group sources by texture size, giving each texture key its layers. */
export function planLayers(sources: readonly MergeSource[]): Map<number, Layered> {
  const groups = new Map<number, Layered>();
  for (const s of sources) {
    let g = groups.get(s.size);
    if (!g) groups.set(s.size, (g = { sources: [], colorLayer: new Map(), normalLayer: new Map() }));
    g.sources.push(s);
    if (!g.colorLayer.has(s.key)) g.colorLayer.set(s.key, g.colorLayer.size);
    if (s.normal && !g.normalLayer.has(s.key)) g.normalLayer.set(s.key, g.normalLayer.size);
  }
  return groups;
}

/**
 * Sort `group`'s triangles into MERGE_CHUNK squares (by their centre), each vertex carrying its surface's layers,
 * tint and shine. Pure (no GPU), so it is tested on its own.
 */
export function mergeGeometry(group: Layered, read: (m: Mesh) => { positions: ArrayLike<number>; normals: ArrayLike<number>; uvs: ArrayLike<number>; indices: ArrayLike<number> } | null): Map<string, Chunk> {
  const chunks = new Map<string, Chunk>();
  for (const s of group.sources) {
    const g = read(s.mesh);
    if (!g) continue;
    const { positions: pos, normals: nrm, uvs, indices: idx } = g;
    const colorLayer = group.colorLayer.get(s.key)!;
    const normalLayer = s.normal ? group.normalLayer.get(s.key)! : -1;
    const remap = new Map<string, Map<number, number>>();
    for (let t = 0; t + 2 < idx.length; t += 3) {
      const i0 = idx[t]!;
      const i1 = idx[t + 1]!;
      const i2 = idx[t + 2]!;
      const cx = (pos[i0 * 3]! + pos[i1 * 3]! + pos[i2 * 3]!) / 3;
      const cz = (pos[i0 * 3 + 2]! + pos[i1 * 3 + 2]! + pos[i2 * 3 + 2]!) / 3;
      const key = `${Math.floor(cx / MERGE_CHUNK)}:${Math.floor(cz / MERGE_CHUNK)}`;
      let c = chunks.get(key);
      if (!c) chunks.set(key, (c = { positions: [], normals: [], uvs: [], a: [], b: [], indices: [] }));
      let map = remap.get(key);
      if (!map) remap.set(key, (map = new Map()));
      for (const v of [i0, i1, i2]) {
        let at = map.get(v);
        if (at === undefined) {
          at = c.positions.length / 3;
          map.set(v, at);
          c.positions.push(pos[v * 3]!, pos[v * 3 + 1]!, pos[v * 3 + 2]!);
          c.normals.push(nrm[v * 3]!, nrm[v * 3 + 1]!, nrm[v * 3 + 2]!);
          c.uvs.push(uvs[v * 2]!, uvs[v * 2 + 1]!);
          c.a.push(s.tint.r, s.tint.g, s.tint.b, colorLayer);
          c.b.push(normalLayer, s.specular, s.power, 0);
        }
        c.indices.push(at);
      }
    }
  }
  return chunks;
}

/** A merged mesh's geometry, read from a source mesh in world space (level meshes sit at the origin). */
function readWorld(m: Mesh): { positions: Float32Array; normals: Float32Array; uvs: ArrayLike<number>; indices: ArrayLike<number> } | null {
  const p = m.getVerticesData(VertexBuffer.PositionKind);
  const n = m.getVerticesData(VertexBuffer.NormalKind);
  const uv = m.getVerticesData(VertexBuffer.UVKind);
  const idx = m.getIndices();
  if (!p || !n || !uv || !idx) return null;
  const world = m.computeWorldMatrix(true);
  const positions = new Float32Array(p);
  const normals = new Float32Array(n);
  if (!world.isIdentity()) {
    const v = new Vector3();
    for (let i = 0; i < positions.length; i += 3) {
      Vector3.TransformCoordinatesFromFloatsToRef(p[i]!, p[i + 1]!, p[i + 2]!, world, v);
      positions[i] = v.x;
      positions[i + 1] = v.y;
      positions[i + 2] = v.z;
      Vector3.TransformNormalFromFloatsToRef(n[i]!, n[i + 1]!, n[i + 2]!, world, v);
      v.normalize();
      normals[i] = v.x;
      normals[i + 1] = v.y;
      normals[i + 2] = v.z;
    }
  }
  return { positions, normals, uvs: uv, indices: idx };
}

/** A 1×1 texture standing in for the per-style maps (it turns on the shader's texture paths; the plugin samples the arrays). */
function standIn(scene: Scene, name: string, rgba: [number, number, number, number]): RawTexture {
  const t = RawTexture.CreateRGBATexture(new Uint8Array(rgba), 1, 1, scene, false, false, Texture.NEAREST_SAMPLINGMODE);
  t.name = name;
  return t;
}

function arrayTexture(scene: Scene, layers: Uint8Array[], size: number, name: string): RawTexture2DArray {
  const data = new Uint8Array(size * size * 4 * layers.length);
  layers.forEach((l, i) => data.set(l.subarray(0, size * size * 4), i * size * size * 4));
  const t = new RawTexture2DArray(data, size, size, layers.length, Constants.TEXTUREFORMAT_RGBA, scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
  t.name = name;
  t.wrapU = Texture.WRAP_ADDRESSMODE;
  t.wrapV = Texture.WRAP_ADDRESSMODE;
  t.anisotropicFilteringLevel = 8;
  return t;
}

/**
 * Merge `sources` (WebGL2 only): loads every texture's pixels, builds the arrays, materials and meshes. Returns the new
 * meshes (named `${name}_merged_…`, frozen, not pickable), or null when nothing was merged. The caller disposes the
 * sources it no longer needs.
 */
export async function mergeLevel(scene: Scene, sources: readonly MergeSource[], name = 'map', mipBias = 0): Promise<{ meshes: Mesh[]; merged: Mesh[] } | null> {
  if (sources.length < 2) return null;
  const groups = planLayers(sources);
  const out: Mesh[] = [];
  const merged: Mesh[] = [];
  for (const [size, group] of groups) {
    if (group.sources.length < 2) continue;
    // Pixels of each layer (the same texture key once).
    const byKey = new Map(group.sources.map((s) => [s.key, s]));
    const colorKeys = [...group.colorLayer.keys()];
    const normalKeys = [...group.normalLayer.keys()];
    const [colors, normals] = await Promise.all([Promise.all(colorKeys.map((k) => byKey.get(k)!.color())), Promise.all(normalKeys.map((k) => byKey.get(k)!.normal!()))]);
    if (scene.isDisposed) return null;
    const colorArray = arrayTexture(scene, colors, size, `levelColors_${size}`);
    const normalArray = normals.length ? arrayTexture(scene, normals, size, `levelNormals_${size}`) : null;
    const mat = new StandardMaterial(`mat_level_${size}`, scene);
    mat.diffuseTexture = standIn(scene, 'levelColorStandIn', [255, 255, 255, 255]);
    if (normalArray) {
      mat.bumpTexture = standIn(scene, 'levelNormalStandIn', [128, 128, 255, 255]);
      mat.invertNormalMapY = true;
    }
    mat.diffuseColor = Color3.White();
    // The per-style materials' depth bias (mapMeshes.ts levelDepthBias: drawn a hair behind what lies in its planes).
    const first = group.sources[0]!.mesh.material;
    mat.zOffset = first?.zOffset ?? 0;
    mat.zOffsetUnits = first?.zOffsetUnits ?? 0;
    // Any non-black specular keeps the specular term in the shader; each vertex brings its own colour and power.
    mat.specularColor = new Color3(0.1, 0.1, 0.1);
    new LevelArrayPlugin(mat, colorArray, normalArray, mipBias);
    for (const [key, c] of mergeGeometry(group, readWorld)) {
      if (!c.indices.length) continue;
      const mesh = new Mesh(`${name}_merged_${size}_${key}`, scene);
      const vd = new VertexData();
      vd.positions = c.positions;
      vd.normals = c.normals;
      vd.uvs = c.uvs;
      vd.indices = c.positions.length / 3 > 65535 ? new Uint32Array(c.indices) : c.indices;
      vd.applyToMesh(mesh);
      mesh.setVerticesData('levelA', new Float32Array(c.a), false, 4);
      mesh.setVerticesData('levelB', new Float32Array(c.b), false, 4);
      mesh.material = mat;
      mesh.isPickable = false;
      mesh.freezeWorldMatrix();
      mesh.metadata = { levelMerged: true };
      out.push(mesh);
    }
    for (const s of group.sources) merged.push(s.mesh);
  }
  return out.length ? { meshes: out, merged } : null;
}

/** A JPEG's pixels as WebGL samples a Texture made with invertY (rows bottom first), at `size` px square. */
export async function jpegPixels(url: string, size: number): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const bitmap = await createImageBitmap(await res.blob());
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('no 2d context');
  ctx.translate(0, size);
  ctx.scale(1, -1);
  ctx.drawImage(bitmap, 0, 0, size, size);
  bitmap.close();
  return new Uint8Array(ctx.getImageData(0, 0, size, size).data.buffer);
}
