import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import type { Material } from '@babylonjs/core/Materials/material';
import type { Scene } from '@babylonjs/core/scene';
import type { Node } from '@babylonjs/core/node';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';

/**
 * Merge a character's skinned parts that share a skeleton, a material and a
 * place in the hierarchy into one mesh each (and their low-detail copies the
 * same way), so a character costs one draw per material rather than one per
 * part. A look is 8–12 parts (torso, belts, legs, feet, arms, hood, head,
 * eyebrows, hair…), most of them in the outfit's or the skin's material, which
 * `dress` has already made identical. Nothing changes on screen: the same
 * triangles, bones and material.
 *
 * Parts whose material differs in anything visible stay apart, and so do parts
 * with different vertex attributes, morph targets or transforms. The first
 * part's material is kept; the others' (identical) clones are disposed.
 */
export function mergeSkinnedParts(meshes: readonly AbstractMesh[], name: string): AbstractMesh[] {
  const groups = new Map<string, Mesh[]>();
  // In the original order: a group takes the place of its first part.
  const order: (AbstractMesh | Mesh[])[] = [];
  for (const m of meshes) {
    const key = mergeKey(m);
    if (key === null) {
      order.push(m);
      continue;
    }
    let g = groups.get(key);
    if (!g) {
      groups.set(key, (g = []));
      order.push(g);
    }
    g.push(m as Mesh);
  }
  const out: AbstractMesh[] = [];
  let n = 0;
  for (const item of order) {
    if (!Array.isArray(item)) out.push(item);
    else if (item.length < 2) out.push(...item);
    else {
      const merged = mergeGroup(item, `${name}_${n++}`);
      if (merged) out.push(merged, ...merged.getLODLevels().flatMap((l) => (l.mesh ? [l.mesh] : [])));
      else out.push(...item);
    }
  }
  // Low-detail copies of merged parts went with them.
  return out.filter((m) => !m.isDisposed());
}

/** What has to match for two parts to share a mesh, or null when a part can't be merged. */
function mergeKey(m: AbstractMesh): string | null {
  // A low-detail copy (blocked: drawn only through its full mesh) is merged along with that mesh.
  if (!(m instanceof Mesh) || m.isAnInstance || m.isBlocked || !m.skeleton || !m.material || m.morphTargetManager || m.hasThinInstances) return null;
  if (!m.getTotalVertices() || !m.getIndices()) return null;
  // Merging keeps only the first UV set (see mergeVertexData).
  if (m.material.getActiveTextures().some((t) => (t as { coordinatesIndex?: number }).coordinatesIndex)) return null;
  // Low-detail copies hang off their full mesh as LOD levels and are merged with it.
  const lods = m.getLODLevels();
  if (lods.length > 1) return null;
  const lod = lods[0];
  if (lod && (!lod.mesh || lod.mesh.material !== m.material || lod.mesh.skeleton !== m.skeleton || lod.mesh.morphTargetManager)) return null;
  // Skinned vertices land at (vertex × bones × the mesh's world matrix): parts can share a mesh while their world matrices agree.
  const local = matrixKey(m);
  if (lod && matrixKey(lod.mesh!) !== local) return null;
  return [m.skeleton.uniqueId, local, materialKey(m.material), lod?.distanceOrScreenCoverage ?? '', m.sideOrientation, opaque(m) || m.hasVertexAlpha, m.useVertexColors, m.receiveShadows, m.renderingGroupId].join('|');
}

/** An opaque material ignores vertex alpha (it only ever scales the alpha), so parts with and without it can share a mesh. */
function opaque(m: AbstractMesh): boolean {
  return (m.material as { transparencyMode?: number | null } | null)?.transparencyMode === 0;
}

function matrixKey(m: AbstractMesh): string {
  m.computeWorldMatrix(true);
  return Array.from(m.getWorldMatrix().asArray(), (v) => v.toFixed(4)).join(',');
}

/** Everything about a material that shows, so two clones of one material made identical by `dress` compare equal. */
function materialKey(mat: Material): string {
  const o = mat as unknown as Record<string, unknown>;
  const parts: unknown[] = [mat.getClassName(), mat.alpha, mat.backFaceCulling, mat.wireframe, mat.transparencyMode];
  for (const k of ['albedoColor', 'diffuseColor', 'emissiveColor', 'specularColor', 'reflectivityColor', 'ambientColor']) {
    const c = o[k] as { toHexString?: () => string } | undefined;
    parts.push(c?.toHexString?.() ?? '');
  }
  for (const k of ['metallic', 'roughness', 'specularPower', 'directIntensity', 'environmentIntensity', 'disableLighting', 'useAlphaFromAlbedoTexture', 'unlit']) parts.push(o[k]);
  for (const k of ['albedoTexture', 'diffuseTexture', 'bumpTexture', 'metallicTexture', 'emissiveTexture', 'opacityTexture', 'ambientTexture', 'reflectivityTexture', 'microSurfaceTexture', 'lightmapTexture']) {
    const t = o[k] as { uniqueId?: number } | null | undefined;
    parts.push(t?.uniqueId ?? '');
  }
  return parts.join(';');
}

/** One mesh from a group's parts (and one low-detail mesh from their low-detail copies); null if Babylon can't merge them. */
function mergeGroup(group: Mesh[], name: string): Mesh | null {
  const first = group[0]!;
  const full = mergeVertexData(group);
  if (!full) return null;
  const lods = group.map((m) => m.getLODLevels()[0]?.mesh ?? null);
  const hasLod = lods.some((l) => l);
  // Parts without a low-detail copy stay in full detail in the merged low-detail mesh.
  const low = hasLod ? mergeVertexData(group.map((m, i) => lods[i] ?? m)) : null;
  if (hasLod && !low) return null;
  const scene = first.getScene();
  const make = (data: VertexData, suffix: string): Mesh => {
    const mesh = new Mesh(`${name}${suffix}`, scene);
    data.applyToMesh(mesh, false);
    mesh.parent = first.parent;
    mesh.position.copyFrom(first.position);
    if (first.rotationQuaternion) mesh.rotationQuaternion = first.rotationQuaternion.clone();
    else mesh.rotation.copyFrom(first.rotation);
    mesh.scaling.copyFrom(first.scaling);
    mesh.material = first.material;
    mesh.skeleton = first.skeleton;
    mesh.numBoneInfluencers = Math.max(...group.map((m) => m.numBoneInfluencers));
    mesh.sideOrientation = first.sideOrientation;
    mesh.hasVertexAlpha = group.some((m) => m.hasVertexAlpha);
    mesh.useVertexColors = first.useVertexColors;
    mesh.receiveShadows = first.receiveShadows;
    mesh.renderingGroupId = first.renderingGroupId;
    mesh.isPickable = first.isPickable;
    return mesh;
  };
  const merged = make(full, '');
  if (low) {
    const lowMesh = make(low, '_lod');
    merged.addLODLevel(first.getLODLevels()[0]!.distanceOrScreenCoverage!, lowMesh);
  }
  // The other parts' materials are identical clones of the kept one (see materialKey).
  const material = first.material;
  for (let i = 0; i < group.length; i++) {
    const m = group[i]!;
    const mat = m.material;
    lods[i]?.dispose(false, false);
    m.dispose(false, false);
    if (mat && mat !== material) mat.dispose(false, false);
  }
  return merged;
}

/**
 * The parts' vertices in one buffer. Attributes some parts lack are filled in
 * (white vertex colour, no extra bone influences); the extra UV sets the
 * exporter left on some parts are dropped: character materials only read the
 * first.
 */
function mergeVertexData(meshes: Mesh[]): VertexData | null {
  try {
    const datas = meshes.map((m) => {
      const d = VertexData.ExtractFromMesh(m, true, true);
      d.uvs2 = d.uvs3 = d.uvs4 = d.uvs5 = d.uvs6 = null;
      return d;
    });
    const total = datas.reduce((s, d) => s + (d.positions?.length ?? 0) / 3, 0);
    return datas[0]!.merge(datas.slice(1), total > 65535, false, false, true);
  } catch {
    return null;
  }
}

/** Gear finishes (metallic, roughness) in a scene, one texel each in the finish table. */
const FINISH_SLOTS = 8;
interface GearLook {
  material: PBRMaterial;
  table: RawTexture;
  texels: Uint8Array;
  finishes: string[];
}
const gearLooks = new WeakMap<Scene, Map<boolean, GearLook>>();

/**
 * One material for all gear of a scene (per culling side), coloured per vertex,
 * with each piece's metallic and roughness looked up from a small table
 * texture by its UV: cloth, hard plastic, glass and metal pieces share a draw.
 * Returns the material and the U coordinate of the piece's finish (null when
 * the table is full).
 */
function gearFinish(scene: Scene, src: PBRMaterial): { material: PBRMaterial; u: number } | null {
  let cache = gearLooks.get(scene);
  if (!cache) gearLooks.set(scene, (cache = new Map()));
  let look = cache.get(src.backFaceCulling);
  if (!look) {
    const texels = new Uint8Array(FINISH_SLOTS * 4);
    const table = RawTexture.CreateRGBATexture(texels, FINISH_SLOTS, 1, scene, false, false, Texture.NEAREST_SAMPLINGMODE);
    table.name = 'gearFinishes';
    table.wrapU = table.wrapV = Texture.CLAMP_ADDRESSMODE;
    const material = new PBRMaterial(`gear_merged_${src.backFaceCulling ? 'culled' : 'both'}`, scene);
    material.albedoColor = Color3.White();
    material.metallic = 1;
    material.roughness = 1;
    material.metallicTexture = table;
    material.useRoughnessFromMetallicTextureAlpha = false;
    material.useRoughnessFromMetallicTextureGreen = true;
    material.useMetallnessFromMetallicTextureBlue = true;
    material.backFaceCulling = src.backFaceCulling;
    look = { material, table, texels, finishes: [] };
    cache.set(src.backFaceCulling, look);
  }
  const metallic = src.metallic ?? 1;
  const roughness = src.roughness ?? 1;
  const key = `${metallic}|${roughness}`;
  let i = look.finishes.indexOf(key);
  if (i < 0) {
    if (look.finishes.length >= FINISH_SLOTS) return null;
    i = look.finishes.push(key) - 1;
    look.texels.set([255, Math.round(roughness * 255), Math.round(metallic * 255), 255], i * 4);
    look.table.update(look.texels);
  }
  return { material: look.material, u: (i + 0.5) / FINISH_SLOTS };
}

/**
 * Gear (hats, vests, packs: rigid shapes hung on the head and chest joints) as
 * one skinned mesh on the character's own skeleton, with each piece's colour in
 * its vertices and its finish in the shared table (gearFinish): a commando's
 * helmet, goggles and vest are one draw instead of a dozen. Each vertex is bound wholly to the joint its piece
 * hung on, so it moves exactly as before. `body` is a skinned mesh of the same
 * character (its place in the hierarchy and its bone matrices are used).
 */
export function skinGear(gear: readonly Mesh[], body: Mesh, name: string): Mesh[] {
  const skeleton = body.skeleton;
  if (!skeleton || gear.length < 2) return [...gear];
  const scene = body.getScene();
  skeleton.prepare(true);
  const bones = skeleton.getTransformMatrices(body);
  body.computeWorldMatrix(true);
  const S = body.getWorldMatrix();
  const flipBody = S.determinant() < 0;
  const boneOf = new Map<Node, number>();
  for (const b of skeleton.bones) {
    const t = b.getTransformNode();
    if (t) boneOf.set(t, b.getIndex());
  }
  const groups = new Map<PBRMaterial, VertexData[]>();
  const keep: Mesh[] = [];
  for (const m of gear) {
    const mat = m.material;
    let bone = -1;
    for (let n: Node | null = m.parent; n && bone < 0; n = n.parent) bone = boneOf.get(n) ?? -1;
    const pos = m.getVerticesData(VertexBuffer.PositionKind);
    const nor = m.getVerticesData(VertexBuffer.NormalKind);
    const idx = m.getIndices();
    const finish = mat instanceof PBRMaterial && !mat.albedoTexture && !mat.metallicTexture && mat.alpha >= 1 ? gearFinish(scene, mat) : null;
    if (!finish || !(mat instanceof PBRMaterial) || bone < 0 || !pos || !nor || !idx || m.skeleton || m.hasThinInstances) {
      keep.push(m);
      continue;
    }
    m.computeWorldMatrix(true);
    const W = m.getWorldMatrix();
    // Where the vertex sits now (world), back through this bone's skinning and the body's world matrix.
    const toSkin = W.multiply(Matrix.FromArray(bones, bone * 16).multiply(S).invert());
    const normalM = toSkin.clone().invert().transpose();
    const n = pos.length / 3;
    const positions = new Float32Array(n * 3);
    const normals = new Float32Array(n * 3);
    const v = new Vector3();
    for (let i = 0; i < n; i++) {
      Vector3.TransformCoordinatesFromFloatsToRef(pos[i * 3]!, pos[i * 3 + 1]!, pos[i * 3 + 2]!, toSkin, v);
      v.toArray(positions, i * 3);
      Vector3.TransformNormalFromFloatsToRef(nor[i * 3]!, nor[i * 3 + 1]!, nor[i * 3 + 2]!, normalM, v);
      v.normalize().toArray(normals, i * 3);
    }
    const indices = Array.from(idx);
    // Babylon turns the faces of a mirrored mesh round: keep each piece's faces facing out as they did.
    if (W.determinant() < 0 !== flipBody) for (let t = 0; t + 2 < indices.length; t += 3) [indices[t + 1], indices[t + 2]] = [indices[t + 2]!, indices[t + 1]!];
    const c = mat.albedoColor;
    const colors = new Float32Array(n * 4);
    const uvs = new Float32Array(n * 2);
    const matricesIndices = new Float32Array(n * 4);
    const matricesWeights = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      colors.set([c.r, c.g, c.b, 1], i * 4);
      uvs.set([finish.u, 0.5], i * 2);
      matricesIndices[i * 4] = bone;
      matricesWeights[i * 4] = 1;
    }
    const data = new VertexData();
    Object.assign(data, { positions, normals, indices, colors, uvs, matricesIndices, matricesWeights });
    let list = groups.get(finish.material);
    if (!list) groups.set(finish.material, (list = []));
    list.push(data);
    m.dispose(false, false);
  }
  let k = 0;
  for (const [mat, datas] of groups) {
    const total = datas.reduce((s, d) => s + d.positions!.length / 3, 0);
    const data = datas[0]!.merge(datas.slice(1), total > 65535);
    const mesh = new Mesh(`${name}_${k++}`, scene);
    data.applyToMesh(mesh, false);
    mesh.parent = body.parent;
    mesh.position.copyFrom(body.position);
    if (body.rotationQuaternion) mesh.rotationQuaternion = body.rotationQuaternion.clone();
    else mesh.rotation.copyFrom(body.rotation);
    mesh.scaling.copyFrom(body.scaling);
    mesh.material = mat;
    mesh.skeleton = skeleton;
    mesh.numBoneInfluencers = 1;
    mesh.isPickable = false;
    keep.push(mesh);
  }
  return keep;
}
