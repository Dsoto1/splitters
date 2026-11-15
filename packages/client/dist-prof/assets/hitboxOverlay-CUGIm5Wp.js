import { T as TransformNode, V as Vector3, Q as Quaternion, c as StandardMaterial, a as Color3 } from "./babylon-PnzH6wcM.js";
import { C as CreateCapsule } from "./capsuleBuilder-D5ktebP4.js";
import { z as shapesFor, A as HITBOX_MARGIN } from "./index-BAsW2uYW.js";
import { M as MEASURED_HITBOXES, c as creatureSkinScale, l as lookHitbox } from "./lookHitbox-C8CMJlSr.js";
import { C as CreateSphere } from "./sphereBuilder.pure-CT5peVwp.js";
function hitboxForSpec(spec) {
  const fallback = MEASURED_HITBOXES["base:male"];
  if (spec.creature) {
    const box = MEASURED_HITBOXES[`creature:${spec.creature}`] ?? fallback;
    return { box, scale: spec.armed ? creatureSkinScale(box) : spec.size ?? 1 };
  }
  if (spec.npc) return { box: MEASURED_HITBOXES[spec.npc.zombie ? "base:zombie" : spec.npc.female ? "base:female" : "base:male"] ?? fallback, scale: spec.npc.scale };
  const h = lookHitbox(spec.look);
  return { box: h.box, scale: h.scale * (spec.size ?? 1) };
}
const COLORS = { head: "#ff3b30", torso: "#ffd60a", arms: "#34c759", legs: "#2f8cff" };
const mats = /* @__PURE__ */ new WeakMap();
function materials(scene) {
  let m = mats.get(scene);
  if (!m) {
    const make = (name, hex, alpha) => {
      const mat = new StandardMaterial(`hitbox_${name}`, scene);
      mat.diffuseColor = Color3.Black();
      mat.specularColor = Color3.Black();
      mat.emissiveColor = Color3.FromHexString(hex);
      mat.disableLighting = true;
      mat.alpha = alpha;
      mat.backFaceCulling = false;
      return mat;
    };
    const set = (tag, alpha) => ({ head: make(`head${tag}`, COLORS.head, alpha), torso: make(`torso${tag}`, COLORS.torso, alpha), arms: make(`arms${tag}`, COLORS.arms, alpha), legs: make(`legs${tag}`, COLORS.legs, alpha) });
    m = { core: set("", 0.42), pad: set("_pad", 0.14) };
    mats.set(scene, m);
  }
  return m;
}
function drawHitShapes(scene, s, name) {
  const root = new TransformNode(name, scene);
  const all = materials(scene);
  drawLayer(scene, s, name, root, all.core, 0, 0);
  drawLayer(scene, s, `${name}_pad`, root, all.pad, HITBOX_MARGIN.body, HITBOX_MARGIN.head);
  return root;
}
function drawLayer(scene, s, name, root, m, pad, padHead) {
  const capsule = (part, a, b, r0, squash = 1) => {
    const r = r0 + pad;
    const len = Vector3.Distance(a, b);
    const mesh = CreateCapsule(`${name}_${part}`, { radius: r, height: len + 2 * r, tessellation: 14, subdivisions: 2, capSubdivisions: 6 }, scene);
    mesh.material = m[part];
    mesh.isPickable = false;
    mesh.parent = root;
    mesh.position.copyFrom(a.add(b).scale(0.5));
    const dir = len > 1e-6 ? b.subtract(a).normalize() : Vector3.Up();
    mesh.rotationQuaternion = new Quaternion();
    Quaternion.FromUnitVectorsToRef(Vector3.Up(), dir, mesh.rotationQuaternion);
    mesh.scaling.x = squash;
  };
  if (s.head) {
    const h = CreateSphere(`${name}_head`, { diameter: (s.head.r + padHead) * 2, segments: 12 }, scene);
    h.material = m.head;
    h.isPickable = false;
    h.parent = root;
    h.position.set(s.head.x, s.head.y, s.head.z);
  }
  if (s.torso) {
    const t = s.torso;
    capsule("torso", new Vector3(t.x, t.a[0], t.a[1]), new Vector3(t.x, t.b[0], t.b[1]), t.r, (t.w + pad) / (t.r + pad));
  }
  for (const l of s.legs) capsule("legs", Vector3.FromArray(l.a), Vector3.FromArray(l.b), l.r);
  for (const l of s.arms) capsule("arms", Vector3.FromArray(l.a), Vector3.FromArray(l.b), l.r);
}
class BodyHitbox {
  constructor(scene) {
    this.scene = scene;
  }
  scene;
  node = null;
  key = "";
  /** Show `box` in `stance` at `scale` under `parent` (placed at the feet, turned to the body's yaw). */
  show(parent, box, stance, scale) {
    const s = shapesFor(box, stance);
    const key = `${keyOf(box)}|${stance}`;
    if (key !== this.key) {
      this.node?.dispose();
      this.node = drawHitShapes(this.scene, s, `hitbox_${parent.name}`);
      this.key = key;
    }
    const n = this.node;
    if (n.parent !== parent) n.parent = parent;
    n.setEnabled(true);
    n.scaling.setAll(scale);
  }
  hide() {
    this.node?.setEnabled(false);
  }
  dispose() {
    this.node?.dispose();
    this.node = null;
    this.key = "";
  }
}
const keys = /* @__PURE__ */ new WeakMap();
let nextKey = 0;
function keyOf(box) {
  let k = keys.get(box);
  if (!k) keys.set(box, k = String(nextKey++));
  return k;
}
export {
  BodyHitbox as B,
  hitboxForSpec as h
};
