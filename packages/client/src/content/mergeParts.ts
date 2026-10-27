import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import type { Material } from '@babylonjs/core/Materials/material';
import type { Scene } from '@babylonjs/core/scene';
import type { Node } from '@babylonjs/core/node';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { Color3 } from '@babylonjs/core/Maths/math.color';
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
      if (merged) out.push(merged);
      else out.push(...item);
    }
  }
  return out;
}

/** What has to match for two parts to share a mesh, or null when a part can't be merged. */
function mergeKey(m: AbstractMesh): string | null {
  if (!(m instanceof Mesh) || m.isAnInstance || !m.skeleton || !m.material || m.morphTargetManager || m.hasThinInstances) return null;
  if (!m.getTotalVertices() || !m.getIndices()) return null;
  // Low-detail copies hang off their full mesh as LOD levels and are merged with it.
  const lods = m.getLODLevels();
  if (lods.length > 1) return null;
  const lod = lods[0];
  if (lod && (!lod.mesh || lod.mesh.material !== m.material || lod.mesh.skeleton !== m.skeleton || lod.mesh.morphTargetManager)) return null;
  const local = matrixKey(m);
  if (lod && (lod.mesh!.parent !== m.parent || matrixKey(lod.mesh!) !== local)) return null;
  return [m.skeleton.uniqueId, m.parent?.uniqueId ?? -1, local, materialKey(m.material), kinds(m), lod ? kinds(lod.mesh!) : '', lod?.distanceOrScreenCoverage ?? '', m.sideOrientation, m.numBoneInfluencers, m.receiveShadows, m.renderingGroupId].join('|');
}

function matrixKey(m: AbstractMesh): string {
  m.computeWorldMatrix(true);
  return Array.from(m.getWorldMatrix().asArray(), (v) => v.toFixed(4)).join(',');
}

function kinds(m: Mesh): string {
  return [...m.getVerticesDataKinds()].sort().join(',');
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
    mesh.numBoneInfluencers = first.numBoneInfluencers;
    mesh.sideOrientation = first.sideOrientation;
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

function mergeVertexData(meshes: Mesh[]): VertexData | null {
  try {
    const datas = meshes.map((m) => VertexData.ExtractFromMesh(m, true, true));
    const total = datas.reduce((s, d) => s + (d.positions?.length ?? 0) / 3, 0);
    return datas[0]!.merge(datas.slice(1), total > 65535);
  } catch {
    return null;
  }
}

const gearMaterials = new WeakMap<Scene, Map<string, PBRMaterial>>();

/** One white material per gear finish, coloured per vertex (shared by every character in the scene). */
function gearMaterial(scene: Scene, src: PBRMaterial): PBRMaterial {
  let cache = gearMaterials.get(scene);
  if (!cache) gearMaterials.set(scene, (cache = new Map()));
  const key = `${src.metallic}|${src.roughness}|${src.backFaceCulling}`;
  let m = cache.get(key);
  if (!m) {
    m = new PBRMaterial(`gear_merged_${key}`, scene);
    m.albedoColor = Color3.White();
    m.metallic = src.metallic;
    m.roughness = src.roughness;
    m.backFaceCulling = src.backFaceCulling;
    cache.set(key, m);
  }
  return m;
}

/**
 * Gear (hats, vests, packs: rigid shapes hung on the head and chest joints) as
 * skinned meshes on the character's own skeleton, merged per finish with the
 * colours in the vertices: a commando's helmet, goggles and vest are one or two
 * draws instead of a dozen. Each vertex is bound wholly to the joint its piece
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
    if (!(mat instanceof PBRMaterial) || mat.albedoTexture || bone < 0 || !pos || !nor || !idx || m.skeleton || m.hasThinInstances) {
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
    const matricesIndices = new Float32Array(n * 4);
    const matricesWeights = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      colors.set([c.r, c.g, c.b, 1], i * 4);
      matricesIndices[i * 4] = bone;
      matricesWeights[i * 4] = 1;
    }
    const data = new VertexData();
    Object.assign(data, { positions, normals, indices, colors, matricesIndices, matricesWeights });
    const target = gearMaterial(scene, mat);
    let list = groups.get(target);
    if (!list) groups.set(target, (list = []));
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
