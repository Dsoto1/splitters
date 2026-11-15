import { T as TransformNode, M as Matrix, h as Mesh, V as Vector3, a as Color3 } from "./babylon-PnzH6wcM.js";
import { al as getMountDef } from "./index-BAsW2uYW.js";
const setups = /* @__PURE__ */ new WeakMap();
function suspensionOf(def) {
  let s = setups.get(def);
  if (s !== void 0) return s;
  const t = def.vehicle?.suspension;
  if (!t) s = null;
  else {
    const drawn = def.wheels?.at;
    const points = t.wheels ?? drawn?.map(([x, , z]) => [x, z]) ?? [];
    s = points.length >= 3 ? { ...t, points, hubY: t.hub ?? drawn?.[0]?.[1] ?? 0.4 } : null;
  }
  setups.set(def, s);
  return s;
}
function newSuspension(setup) {
  const n = setup.points.length;
  return { h: 0, hv: 0, p: 0, pv: 0, r: 0, rv: 0, wheel: new Array(n).fill(0), ground: new Array(n).fill(0), contact: n, steer: 0, settled: true };
}
const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
function stepSuspension(s, t, dt, input) {
  const w = 2 * Math.PI * t.freq;
  const k = w * w;
  const c = 2 * t.damping * w;
  const n = t.points.length;
  if (input.landing > 0) s.hv -= input.landing * t.land;
  let hAcc;
  let pAcc;
  let rAcc;
  let contact = 0;
  if (!input.grounded) {
    hAcc = -k * s.h - c * s.hv;
    pAcc = (s.p > -t.maxTilt * 0.7 ? -t.tumble : 0) - s.pv * 0.6;
    rAcc = -s.r * k * 0.08 - s.rv * 0.6;
    for (let i = 0; i < n; i++) s.wheel[i] = -t.travel;
  } else {
    let f = 0;
    let fp = 0;
    let fr = 0;
    let zz = 0;
    let xx = 0;
    for (let i = 0; i < n; i++) {
      const [x, z] = t.points[i];
      zz += z * z;
      xx += x * x;
      const g = s.ground[i];
      const ext = g === null || g === void 0 ? Infinity : s.h + z * s.p - x * s.r - g;
      let fi;
      if (ext < t.travel) {
        contact++;
        fi = -k * ext - c * (s.hv + z * s.pv - x * s.rv);
        if (-ext > t.bump) fi += 8 * k * (-ext - t.bump) - c * 2 * Math.min(0, s.hv + z * s.pv - x * s.rv);
        s.wheel[i] = clamp(-ext, -t.travel, t.bump);
      } else {
        fi = -k * t.travel;
        s.wheel[i] = -t.travel;
      }
      f += fi;
      fp += fi * z;
      fr -= fi * x;
    }
    hAcc = f / n;
    pAcc = fp / Math.max(1e-3, zz) + t.squat * k * input.aLong;
    rAcc = fr / Math.max(1e-3, xx) - t.lean * k * input.aLat;
  }
  s.contact = contact;
  s.hv = clamp(s.hv + hAcc * dt, -8, 8);
  s.pv = clamp(s.pv + pAcc * dt, -4, 4);
  s.rv = clamp(s.rv + rAcc * dt, -4, 4);
  s.h += s.hv * dt;
  s.p += s.pv * dt;
  s.r += s.rv * dt;
  const hLo = -t.bump - 0.12;
  const hHi = t.travel + 0.25;
  if (s.h < hLo || s.h > hHi) {
    s.h = clamp(s.h, hLo, hHi);
    s.hv = 0;
  }
  if (Math.abs(s.p) > t.maxTilt) {
    s.p = clamp(s.p, -t.maxTilt, t.maxTilt);
    if (s.p * s.pv > 0) s.pv = 0;
  }
  if (Math.abs(s.r) > t.maxTilt) {
    s.r = clamp(s.r, -t.maxTilt, t.maxTilt);
    if (s.r * s.rv > 0) s.rv = 0;
  }
  s.steer += (input.steer - s.steer) * Math.min(1, dt * 10);
  if (Math.abs(s.steer) < 1e-3) s.steer = 0;
  s.settled = input.grounded && Math.abs(s.hv) + Math.abs(s.pv) + Math.abs(s.rv) < 0.01 && Math.abs(input.aLong) + Math.abs(input.aLat) < 0.05 && s.steer === 0;
}
function suspensionSnapshot(index, s) {
  const out = [index, Math.round(s.h * 100), Math.round(s.p * 1e3), Math.round(s.r * 1e3), Math.round(s.steer * 100)];
  for (const w of s.wheel) out.push(Math.round(w * 100));
  return out;
}
function createMountNode(scene, models, model, name, tint = null) {
  const root = new TransformNode(name, scene);
  const def = getMountDef(model);
  if (!def) return root;
  const body = new TransformNode(`${name}_gun`, scene);
  body.parent = root;
  void models.instantiate(def.model, `${name}_model`).then((node) => {
    if (root.isDisposed()) return node.dispose();
    node.parent = body;
    const scale = def.scale ?? 1;
    if (scale !== 1) node.scaling.scaleInPlace(scale);
    models.attachLods(def.model, `${name}_model`, node, scale);
    const { min } = node.getHierarchyBoundingVectors(true);
    const ride = def.rideHeight ?? (def.vehicle?.hover ? 0.35 : 0);
    node.position.y -= min.y - root.position.y - ride;
    for (const m of node.getChildMeshes()) {
      m.isPickable = false;
      if (tint) paint(m, tint);
      else if (def.glow) glowsOf(root).push(...energise(m, def.glow));
    }
    if (!def.wheels && suspensionOf(def)) {
      body.computeWorldMatrix(true);
      const toBody = Matrix.Invert(body.getWorldMatrix());
      const lods = new Set(node.getChildMeshes().flatMap((m) => m instanceof Mesh ? m.getLODLevels().map((l) => l.mesh) : []));
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
  const wheels = def.wheels;
  if (wheels) {
    wheels.at.forEach(([x, y, z], i) => {
      const pivot = new TransformNode(`${name}_pivot${i}`, scene);
      pivot.parent = body;
      pivot.position.set(x, y, z);
      wheelsOf(root).push({ pivot, rest: y, front: z > 0, slot: nearestWheel(def, x, z) });
      void models.instantiate(wheels.model, `${name}_wheel${i}`).then((wheel) => {
        if (root.isDisposed()) return wheel.dispose();
        const { min, max } = wheel.getHierarchyBoundingVectors(true);
        const [across, , along] = tireScale({ radius: (max.y - min.y) / 2, width: max.z - min.z }, wheels);
        wheel.scaling.set(wheel.scaling.x * across, wheel.scaling.y * across, wheel.scaling.z * along);
        wheel.parent = pivot;
        wheel.rotation.y = x < 0 ? -Math.PI / 2 : Math.PI / 2;
        for (const m of wheel.getChildMeshes()) m.isPickable = false;
      });
    });
  }
  return root;
}
function tireScale(own, wheels) {
  const across = wheels.radius !== void 0 && own.radius > 0 ? wheels.radius / own.radius : 1;
  const along = wheels.width !== void 0 && own.width > 0 ? wheels.width / own.width : across;
  return [across, across, along];
}
function nearestWheel(def, x, z) {
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
const wheelLists = /* @__PURE__ */ new WeakMap();
function wheelsOf(root) {
  let list = wheelLists.get(root);
  if (!list) wheelLists.set(root, list = []);
  return list;
}
function paint(mesh, tint) {
  const src = mesh.material;
  if (!src) return;
  const c = Color3.FromHexString(tint);
  const mat = src.clone(`${src.name}_${tint}`);
  if (!mat) return;
  if ("albedoColor" in mat) mat.albedoColor = (mat.albedoColor ?? Color3.White()).multiply(c);
  else if ("diffuseColor" in mat) mat.diffuseColor = mat.diffuseColor.multiply(c);
  if (c.r * 0.3 + c.g * 0.59 + c.b * 0.11 > 0.85) mat.emissiveColor = c.scale(0.18);
  mesh.material = mat;
}
function energise(mesh, glow) {
  const src = mesh.material;
  if (!src) return [];
  const c = Color3.FromHexString(glow);
  const mat = src.clone(`${src.name}_glow_${glow}`);
  if (!mat) return [];
  const mix = Color3.Lerp(Color3.White(), c, 0.5);
  if ("albedoColor" in mat) mat.albedoColor = (mat.albedoColor ?? Color3.White()).multiply(mix);
  else if ("diffuseColor" in mat) mat.diffuseColor = mat.diffuseColor.multiply(mix);
  mat.emissiveColor = c.scale(MOUNT_GLOW_IDLE);
  mesh.material = mat;
  return [mat];
}
const MOUNT_GLOW_IDLE = 0.12;
const MOUNT_GLOW_PEAK = 0.5;
const glowLists = /* @__PURE__ */ new WeakMap();
function glowsOf(root) {
  let list = glowLists.get(root);
  if (!list) glowLists.set(root, list = []);
  return list;
}
function setMountGlow(root, glow, level) {
  const list = glowLists.get(root);
  if (!list?.length) return null;
  const k = MOUNT_GLOW_IDLE + (MOUNT_GLOW_PEAK - MOUNT_GLOW_IDLE) * Math.max(0, Math.min(1, level));
  const c = Color3.FromHexString(glow).scale(k);
  for (const m of list) m.emissiveColor = c;
  return k;
}
function mountTurret(root) {
  const turret = root.getChildTransformNodes(false, (n) => n.name.endsWith("_model_turret"))[0];
  if (!turret) return null;
  return { turret, barrel: turret.getChildTransformNodes(false, (n) => n.name.endsWith("_model_barrel"))[0] ?? null };
}
const mountGun = (root) => root.getChildren((n) => n.name.endsWith("_gun"), true)[0] ?? null;
const mountVisuals = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  MOUNT_GLOW_IDLE,
  MOUNT_GLOW_PEAK,
  createMountNode,
  mountGun,
  mountTurret,
  setMountGlow,
  tireScale,
  wheelsOf
}, Symbol.toStringTag, { value: "Module" }));
export {
  mountTurret as a,
  suspensionOf as b,
  createMountNode as c,
  stepSuspension as d,
  suspensionSnapshot as e,
  mountVisuals as f,
  mountGun as m,
  newSuspension as n,
  setMountGlow as s,
  wheelsOf as w
};
