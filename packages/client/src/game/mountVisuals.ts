import type { Scene } from '@babylonjs/core/scene';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { getMountDef, suspensionOf } from '@tiletrigger/shared';
import type { ModelLibrary } from '../content/models.ts';

/**
 * A turret, sentry or vehicle: its model (loaded in the background) under a
 * root at the mount's footprint centre. Built models are centred on their
 * bounds, so the model is lifted to sit on the ground. Turrets and sentries
 * have a `gun` child the game turns to follow the gunner's aim. `tint`
 * paints it (a skin or its team's colour, see mountTint): the model gets
 * its own copies of its materials, multiplied by the colour.
 */
export function createMountNode(scene: Scene, models: ModelLibrary, model: string, name: string, tint: string | null = null): TransformNode {
  const root = new TransformNode(name, scene);
  const def = getMountDef(model);
  if (!def) return root;
  const body = new TransformNode(`${name}_gun`, scene);
  body.parent = root;
  void models.instantiate(def.model, `${name}_model`).then((node) => {
    if (root.isDisposed()) return node.dispose();
    node.parent = body;
    // Its lower levels of detail (content/guns.json `lod`), per part, before the paint goes on.
    models.attachLods(def.model, `${name}_model`, node);
    const { min } = node.getHierarchyBoundingVectors(true);
    const ride = def.rideHeight ?? (def.vehicle?.hover ? 0.35 : 0);
    node.position.y -= min.y - root.position.y - ride;
    for (const m of node.getChildMeshes()) {
      m.isPickable = false;
      if (tint) paint(m, tint);
      else if (def.glow) glowsOf(root).push(...energise(m, def.glow));
    }
    // A model with wheels of its own (meshes named wheel-front-left and so on, or Meshy models' wheel_* parts) on a vehicle with
    // suspension: each wheel goes on a pivot at its centre, so it can spin, steer and ride its spring.
    if (!def.wheels && suspensionOf(def)) {
      body.computeWorldMatrix(true);
      const toBody = Matrix.Invert(body.getWorldMatrix());
      // A wheel's lower levels of detail (attachLods) ride its pivot with it, not pivots of their own.
      const lods = new Set<unknown>(node.getChildMeshes().flatMap((m) => (m instanceof Mesh ? m.getLODLevels().map((l) => l.mesh) : [])));
      for (const mesh of node.getChildMeshes()) {
        if (!/wheel/i.test(mesh.name) || lods.has(mesh)) continue;
        mesh.computeWorldMatrix(true);
        const c = Vector3.TransformCoordinates(mesh.getBoundingInfo().boundingBox.centerWorld, toBody);
        const pivot = new TransformNode(`${name}_pivot_${mesh.name}`, scene);
        pivot.parent = body;
        pivot.position.copyFrom(c);
        mesh.setParent(pivot);
        if (mesh instanceof Mesh) for (const l of mesh.getLODLevels()) l.mesh?.setParent(pivot);
        wheelsOf(root).push({ pivot, rest: c.y, front: c.z > 0, slot: nearestWheel(def, c.x, c.z) });
      }
    }
  });
  // Wheels on a body without its own: placed in the mount's frame, the axle across the body (the tire's model is
  // built with its axle along Z), the outside face out on each side. Under the body node so they ride with it.
  const wheels = def.wheels;
  if (wheels) {
    wheels.at.forEach(([x, y, z], i) => {
      // On a pivot at the hub (in the mount's frame: spin about X, steer about Y, the spring along Y; View.suspend).
      const pivot = new TransformNode(`${name}_pivot${i}`, scene);
      pivot.parent = body;
      pivot.position.set(x, y, z);
      wheelsOf(root).push({ pivot, rest: y, front: z > 0, slot: nearestWheel(def, x, z) });
      void models.instantiate(wheels.model, `${name}_wheel${i}`).then((wheel) => {
        if (root.isDisposed()) return wheel.dispose();
        wheel.parent = pivot;
        wheel.rotation.y = x < 0 ? -Math.PI / 2 : Math.PI / 2;
        // Rubber stays black: no skin or team paint on the tires.
        for (const m of wheel.getChildMeshes()) m.isPickable = false;
      });
    });
  }
  return root;
}

/** A wheel drawn on a pivot at its hub, in the mount's frame: View.suspend spins, steers and moves it on its spring. */
export interface MountWheel {
  pivot: TransformNode;
  /** The hub's height at rest (m, the pivot's position.y with the spring at rest). */
  rest: number;
  front: boolean;
  /** Which of the suspension's wheels (snapshot order) it is, or -1 (no suspension). */
  slot: number;
}

/** The suspension wheel nearest (x, z) in the mount's frame, or -1. */
function nearestWheel(def: NonNullable<ReturnType<typeof getMountDef>>, x: number, z: number): number {
  const points = suspensionOf(def)?.points;
  if (!points) return -1;
  let best = -1;
  let bestD = Infinity;
  points.forEach(([px, pz], i) => {
    const d = (px - x) ** 2 + (pz - z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

const wheelLists = new WeakMap<TransformNode, MountWheel[]>();
/** A mount node's wheels, in the order of the def's `wheels.at` (filled in as they load). */
export function wheelsOf(root: TransformNode): MountWheel[] {
  let list = wheelLists.get(root);
  if (!list) wheelLists.set(root, (list = []));
  return list;
}

/** Give a mesh its own copy of its material, tinted (pale skins also glow a little, so snow paint reads white). */
function paint(mesh: { material: PBRMaterial | StandardMaterial | null | unknown }, tint: string): void {
  const src = mesh.material as PBRMaterial | StandardMaterial | null;
  if (!src) return;
  const c = Color3.FromHexString(tint);
  const mat = src.clone(`${src.name}_${tint}`) as PBRMaterial | StandardMaterial | null;
  if (!mat) return;
  if ('albedoColor' in mat) mat.albedoColor = (mat.albedoColor ?? Color3.White()).multiply(c);
  else if ('diffuseColor' in mat) mat.diffuseColor = mat.diffuseColor.multiply(c);
  if (c.r * 0.3 + c.g * 0.59 + c.b * 0.11 > 0.85) mat.emissiveColor = c.scale(0.18);
  mesh.material = mat;
}

/**
 * A mount drawn in its energy colour (MountDef.glow, the Arc Turret): its own copy of the material, the colour
 * mixed half into its paint and glowing in it (setMountGlow sets how brightly). Returns the material to drive.
 */
function energise(mesh: { material: PBRMaterial | StandardMaterial | null | unknown }, glow: string): (PBRMaterial | StandardMaterial)[] {
  const src = mesh.material as PBRMaterial | StandardMaterial | null;
  if (!src) return [];
  const c = Color3.FromHexString(glow);
  const mat = src.clone(`${src.name}_glow_${glow}`) as PBRMaterial | StandardMaterial | null;
  if (!mat) return [];
  const mix = Color3.Lerp(Color3.White(), c, 0.5);
  if ('albedoColor' in mat) mat.albedoColor = (mat.albedoColor ?? Color3.White()).multiply(mix);
  else if ('diffuseColor' in mat) mat.diffuseColor = mat.diffuseColor.multiply(mix);
  mat.emissiveColor = c.scale(MOUNT_GLOW_IDLE);
  mesh.material = mat;
  return [mat];
}

/** How brightly an energy-coloured mount glows (its colour scaled): idle, and at the peak of a wind-up or an arc. */
export const MOUNT_GLOW_IDLE = 0.12;
export const MOUNT_GLOW_PEAK = 0.5;

const glowLists = new WeakMap<TransformNode, (PBRMaterial | StandardMaterial)[]>();
/** A mount node's energy-coloured materials (filled in as its model loads). */
function glowsOf(root: TransformNode): (PBRMaterial | StandardMaterial)[] {
  let list = glowLists.get(root);
  if (!list) glowLists.set(root, (list = []));
  return list;
}

/** Set an energy-coloured mount's glow: `level` 0 (idle) to 1 (peak). Returns the level set, or null (no glow). */
export function setMountGlow(root: TransformNode, glow: string, level: number): number | null {
  const list = glowLists.get(root);
  if (!list?.length) return null;
  const k = MOUNT_GLOW_IDLE + (MOUNT_GLOW_PEAK - MOUNT_GLOW_IDLE) * Math.max(0, Math.min(1, level));
  const c = Color3.FromHexString(glow).scale(k);
  for (const m of list) m.emissiveColor = c;
  return k;
}

/**
 * A vehicle's own turning gun (MountDef.turret; content/guns.json `parts`): the model's `turret` node (turns about
 * its upright with the seat's aim) and `barrel` node (pitches), or null while the model loads or when it has none (the
 * fallback model). They sit inside the glTF import's mirrored root, so View.turnTurret sets them in the model's own frame.
 */
export function mountTurret(root: TransformNode): { turret: TransformNode; barrel: TransformNode | null } | null {
  const turret = root.getChildTransformNodes(false, (n) => n.name.endsWith('_model_turret'))[0];
  if (!turret) return null;
  return { turret, barrel: turret.getChildTransformNodes(false, (n) => n.name.endsWith('_model_barrel'))[0] ?? null };
}

/** The part of a mount that turns with the gunner's aim (turrets), or null. */
export const mountGun = (root: TransformNode): TransformNode | null => root.getChildren((n) => n.name.endsWith('_gun'), true)[0] as TransformNode | undefined ?? null;
