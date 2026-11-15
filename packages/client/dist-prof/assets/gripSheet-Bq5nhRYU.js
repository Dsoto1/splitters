import { V as Vector3, j as VertexBuffer, M as Matrix, S as Scene, C as Color4, H as HemisphericLight, D as DirectionalLight, d as CreateGround, c as StandardMaterial, a as Color3, T as TransformNode } from "./babylon-PnzH6wcM.js";
import { A as ArcRotateCamera } from "./arcRotateCamera-CsS6MmRY.js";
import "./groundBuilder-BbO9y42p.js";
import { C as CharacterLibrary, ac as setPalmRule, c as CharacterAnimator, M as ModelLibrary, d as getWeapon, ad as setPistolTune, o as CORE_LOOKS, P as PLAYER, ae as armsLookFor, af as fitPlayerSkin, w as CreatureAnimator, v as CreatureLibrary, ag as skinHandFrame, ah as setCurlShare } from "./index-BAsW2uYW.js";
import { c as createViewCamera, D as DEFAULT_FOV, f as fitFirstPersonBody, F as FirstPersonBodyRig, p as poseCamera, a as fitFirstPersonArms } from "./view-CiZYAbjB.js";
import "./easing-CT5FBt-r.js";
import "./vendor-BIr0ad6t.js";
import "./abstractMesh-CcTXW9P4.js";
import "./shadowGenerator-_IcnNyty.js";
import "./rapier-BmnBVapV.js";
import "./settle-BDJE4VMF.js";
import "./thinInstanceMesh.pure-BG4P9X5v.js";
import "./scenarioDefs-BcDISE-R.js";
import "./envMaterials-BVmVluEo.js";
import "./materialPluginBase-Dhlt5oKE.js";
import "./babylonFileParser.function-CbkFZ5Hm.js";
import "./linesBuilder-6E0Gh92-.js";
import "./shaderMaterial.pure-T5Xe2ebz.js";
import "./cylinderBuilder-B3IbC6dA.js";
import "./capsuleBuilder-D5ktebP4.js";
import "./sphereBuilder.pure-CT5peVwp.js";
import "./torusBuilder-BTtpdox_.js";
import "./dynamicTexture.pure-Sh-mex-9.js";
import "./geometryBufferRenderer.pure-CTzrC3G0.js";
import "./multiRenderTarget.pure-CHje0eeK.js";
import "./bakedVertexAnimation-D_Sv770W.js";
import "./morphTargetsVertex-ChAeSZCm.js";
import "./clipPlaneVertex-BdoNWmEf.js";
import "./instancesDeclaration-CoQOC7Vy.js";
import "./pointCloudVertex-wlAeL2fL.js";
import "./bonesVertex-Cpn2iSQy.js";
import "./instancesVertex-23t-Q1Uk.js";
import "./morphTargetsVertex-73_uAtmG.js";
import "./instancesDeclaration-DL63iftc.js";
import "./mountVisuals-DcqHY-wo.js";
import "./environmentVisuals-DHOOYxSF.js";
import "./mapMeshes-BbrFew7q.js";
import "./hitboxOverlay-CUGIm5Wp.js";
import "./lookHitbox-C8CMJlSr.js";
import "./netProbe-Bv9gS1yd.js";
const FINGER = /(?:^|_)(index|middle|ring|pinky)_0\d_([lr])$/;
const HANDISH = (side) => new RegExp(`(?:^|_)(hand|index|middle|ring|pinky|thumb)(_0\\d)?_${side}$`);
const BODY_HEIGHT = 1.8;
const SUPPORT_AHEAD = 0.12;
function skinOf(ch) {
  let best = null;
  let most = 0;
  for (const m of ch.meshes) {
    if (!m.skeleton || m.isDisposed() || /_lod/i.test(m.name)) continue;
    const n = m.getTotalVertices();
    if (n > most) {
      most = n;
      best = m;
    }
  }
  if (!best?.skeleton) return null;
  const sk = best.skeleton;
  const bi = best.getVerticesData(VertexBuffer.MatricesIndicesKind);
  const bw = best.getVerticesData(VertexBuffer.MatricesWeightsKind);
  const pos = best.getVerticesData(VertexBuffer.PositionKind);
  if (!bi || !bw || !pos) return null;
  const mats = sk.getTransformMatrices(best);
  const count = Math.min(pos.length / 3, bw.length / 4);
  const posed = new Float32Array(count * 3);
  for (let v = 0; v < count; v++) {
    const x = pos[v * 3];
    const y = pos[v * 3 + 1];
    const z = pos[v * 3 + 2];
    let ax = 0;
    let ay = 0;
    let az = 0;
    for (let k = 0; k < 4; k++) {
      const w = bw[v * 4 + k];
      if (!w) continue;
      const o = bi[v * 4 + k] * 16;
      ax += w * (mats[o] * x + mats[o + 4] * y + mats[o + 8] * z + mats[o + 12]);
      ay += w * (mats[o + 1] * x + mats[o + 5] * y + mats[o + 9] * z + mats[o + 13]);
      az += w * (mats[o + 2] * x + mats[o + 6] * y + mats[o + 10] * z + mats[o + 14]);
    }
    posed[v * 3] = ax;
    posed[v * 3 + 1] = ay;
    posed[v * 3 + 2] = az;
  }
  return { mesh: best, names: sk.bones.map((b) => b.getTransformNode()?.name ?? b.name), mats, bind: Float32Array.from(pos), posed, bi, bw, count };
}
const at = (a, v) => new Vector3(a[v * 3], a[v * 3 + 1], a[v * 3 + 2]);
const r3 = (n) => Math.round(n * 1e3) / 1e3;
function auditGrip(ch, weapon, hold) {
  const skin = skinOf(ch);
  if (!skin) return null;
  const { mesh, names, mats, bind, posed, bi, bw, count } = skin;
  mesh.computeWorldMatrix(true);
  const world = mesh.getWorldMatrix();
  const toLocal = world.clone().invert();
  let minY = Infinity;
  let maxY = -Infinity;
  for (let v = 0; v < count; v++) {
    minY = Math.min(minY, bind[v * 3 + 1]);
    maxY = Math.max(maxY, bind[v * 3 + 1]);
  }
  const k = BODY_HEIGHT / Math.max(1e-6, maxY - minY);
  const bone = (n) => names.indexOf(n);
  const M = (b) => Matrix.FromArray(mats, b * 16);
  const bindAt = (b) => skin.mesh.skeleton.bones[b].getAbsoluteInverseBindMatrix().clone().invert().getTranslation();
  const posedAt = (n) => {
    const b = bone(n);
    return b < 0 ? null : Vector3.TransformCoordinates(bindAt(b), M(b));
  };
  const front = new Vector3(0, 0, 1);
  const up = new Vector3(0, 1, 0);
  const left = Vector3.Cross(up, front).normalize();
  const handPoint = (side) => {
    if (!weapon || !hold) return null;
    const p = side === "r" ? hold.grip : hold.support;
    if (!p) return null;
    weapon.computeWorldMatrix(true);
    return Vector3.TransformCoordinates(Vector3.TransformCoordinates(new Vector3(p[0], p[1], p[2]), weapon.getWorldMatrix()), toLocal);
  };
  const hands = {};
  for (const side of ["l", "r"]) {
    const re = HANDISH(side);
    const on = names.map((n) => re.test(n));
    const finger = names.map((n) => FINGER.exec(n)?.[2] === side);
    const used = /* @__PURE__ */ new Set();
    const pts = [];
    let fingered = 0;
    for (let v = 0; v < count; v++) {
      let w = 0;
      let fw = 0;
      for (let j = 0; j < 4; j++) {
        const b = bi[v * 4 + j];
        const wj = bw[v * 4 + j];
        if (on[b]) w += wj;
        if (finger[b]) {
          fw += wj;
          if (wj > 0.2) used.add(b);
        }
      }
      if (w < 0.5) continue;
      if (fw >= 0.3) fingered++;
      pts.push(at(posed, v));
    }
    if (pts.length < 6) {
      hands[side] = null;
      continue;
    }
    const wrist = posedAt(`hand_${side}`) ?? pts[0];
    const centre = pts.reduce((a, p) => a.addInPlace(p), Vector3.Zero()).scale(1 / pts.length);
    const far = pts.map((p) => ({ p, d: Vector3.Distance(p, wrist) })).sort((a, b) => b.d - a.d).slice(0, Math.max(3, Math.floor(pts.length * 0.15)));
    const tip = far.reduce((a, x) => a.addInPlace(x.p), Vector3.Zero()).scale(1 / far.length);
    const target = handPoint(side);
    const measured = ch.hands[side];
    const guard = side === "l" && hold?.style === "long" && hold.support ? [handPoint("r"), target] : null;
    const toGuard = (p) => {
      const [g, s2] = guard;
      const d = s2.subtract(g);
      const len = d.length();
      const t = Math.max(Math.min(SUPPORT_AHEAD / Math.max(1e-6, len * k), 1), Math.min(1, Vector3.Dot(p.subtract(g), d) / Math.max(1e-12, len * len)));
      return r3(Vector3.Distance(p, g.add(d.scale(t))) * k);
    };
    hands[side] = {
      fingerShare: r3(fingered / pts.length),
      fingerJoints: used.size,
      tips: target ? r3(Vector3.Distance(tip, target) * k) : null,
      centre: target ? r3(Vector3.Distance(centre, target) * k) : null,
      ...guard?.[0] && guard[1] ? { tipsGuard: toGuard(tip), centreGuard: toGuard(centre) } : {},
      measured: measured ? { curl: measured.curl, fingers: measured.fingers } : null
    };
  }
  const elbows = {};
  for (const side of ["l", "r"]) {
    const ub = bone(`upperarm_${side}`);
    const s = posedAt(`upperarm_${side}`);
    const e = posedAt(`lowerarm_${side}`);
    const w = posedAt(`hand_${side}`);
    if (ub < 0 || !s || !e || !w) {
      elbows[side] = null;
      continue;
    }
    const upper = e.subtract(s).normalize();
    const fore = w.subtract(e).normalize();
    const bend = Math.acos(Math.max(-1, Math.min(1, Vector3.Dot(upper, fore))));
    const flexDir = fore.subtract(upper.scale(Vector3.Dot(fore, upper)));
    const armFront = Vector3.TransformNormal(front, M(ub));
    armFront.subtractInPlace(upper.scale(Vector3.Dot(armFront, upper)));
    const flex = flexDir.lengthSquared() > 1e-10 && armFront.lengthSquared() > 1e-10 ? Vector3.Dot(flexDir.normalize(), armFront.normalize()) : 1;
    elbows[side] = { bend: Math.round(bend * 180 / Math.PI), flex: r3(flex) };
  }
  let gun = null;
  const head = posedAt("Head") ?? posedAt("head");
  const neck = posedAt("neck_01");
  const chest = posedAt("spine_03") ?? posedAt("spine_02");
  const pelvis = posedAt("pelvis");
  const sr = posedAt("upperarm_r");
  const sl = posedAt("upperarm_l");
  const grip = handPoint("r");
  if (weapon && hold && head && neck && chest && sr && sl && grip) {
    const g = (p) => Vector3.TransformCoordinates(Vector3.TransformCoordinates(new Vector3(p[0], p[1], p[2]), weapon.getWorldMatrix()), toLocal);
    const a = hold.style === "long" && hold.shoulder ? g(hold.shoulder) : g(hold.grip);
    const b = hold.support && hold.style === "long" ? g(hold.support) : g([hold.grip[0], hold.grip[1], hold.grip[2] + 0.2]);
    const ab = b.subtract(a);
    const t = Math.max(0, Math.min(1, Vector3.Dot(head.subtract(a), ab) / Math.max(1e-9, ab.lengthSquared())));
    const headToGun = Vector3.Distance(head, a.add(ab.scale(t))) * k;
    const mid = (pelvis ?? chest).clone();
    const half = Math.max(1e-6, Math.abs(Vector3.Dot(sl.subtract(sr), left)) / 2);
    const sideOf = (p, s) => p ? r3(Vector3.Dot(p.subtract(mid), left) * (s === "l" ? 1 : -1) / half) : 0;
    const reach = (s) => {
      const u = bone(`upperarm_${s}`);
      const h = bone(`hand_${s}`);
      return u < 0 || h < 0 ? 0 : Vector3.Distance(bindAt(u), bindAt(h));
    };
    gun = {
      headToGun: r3(headToGun),
      gripAboveShoulder: r3(Vector3.Dot(grip.subtract(sr), up) * k),
      gripAhead: r3(Vector3.Dot(grip.subtract(chest), front) * k),
      elbowSide: { l: sideOf(posedAt("lowerarm_l"), "l"), r: sideOf(posedAt("lowerarm_r"), "r") },
      handSide: { l: sideOf(posedAt("hand_l"), "l"), r: sideOf(posedAt("hand_r"), "r") },
      armOverShoulders: r3((reach("l") + reach("r")) / 2 / (2 * half)),
      shoulderBelowNeck: r3(Vector3.Dot(neck.subtract(sr), up) * k)
    };
  }
  const idx = mesh.getIndices();
  let max = 1;
  let spikes = 0;
  let worst = null;
  const at_ = {};
  if (idx) {
    const seen = /* @__PURE__ */ new Set();
    for (let i = 0; i + 2 < idx.length; i += 3) {
      for (const [p, q] of [[idx[i], idx[i + 1]], [idx[i + 1], idx[i + 2]], [idx[i + 2], idx[i]]]) {
        const key = p < q ? p * count + q : q * count + p;
        if (seen.has(key)) continue;
        seen.add(key);
        const b0 = Vector3.Distance(at(bind, p), at(bind, q)) * k;
        const p0 = Vector3.Distance(at(posed, p), at(posed, q)) * k;
        if (b0 < 2e-3 || p0 < 0.04) continue;
        const ratio = p0 / b0;
        if (ratio > max) {
          max = ratio;
          let wb = -1;
          let ww = 0;
          for (let j = 0; j < 4; j++) if (bw[p * 4 + j] > ww) [ww, wb] = [bw[p * 4 + j], bi[p * 4 + j]];
          worst = wb >= 0 ? names[wb] ?? null : null;
        }
        if (ratio > 3 && p0 > 0.1) {
          spikes++;
          let wb = -1;
          let ww = 0;
          for (let j = 0; j < 4; j++) if (bw[p * 4 + j] > ww) [ww, wb] = [bw[p * 4 + j], bi[p * 4 + j]];
          const n = wb >= 0 ? names[wb] ?? "?" : "?";
          at_[n] = (at_[n] ?? 0) + 1;
        }
      }
    }
  }
  return { verts: count, hands, elbows, gun, stretch: { max: Math.round(max * 10) / 10, spikes, worst, by: at_ } };
}
async function openGripSheet(engine) {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.2, 0.22, 0.25, 1);
  new HemisphericLight("hemi", new Vector3(0.3, 1, 0.4), scene).intensity = 0.95;
  new DirectionalLight("sun", new Vector3(-0.4, -1, 0.6), scene).intensity = 0.8;
  const ground = CreateGround("ground", { width: 8, height: 8 }, scene);
  const gm = new StandardMaterial("groundMat", scene);
  gm.diffuseColor = new Color3(0.3, 0.32, 0.36);
  ground.material = gm;
  const orbit = new ArcRotateCamera("orbit", Math.PI / 2, 1.2, 1.2, new Vector3(0, 1.3, 0), scene);
  orbit.minZ = 0.02;
  const eye = createViewCamera("eye", scene);
  eye.minZ = 0.02;
  eye.fov = DEFAULT_FOV;
  scene.activeCamera = orbit;
  window.addEventListener("resize", () => engine.resize());
  const characters = new CharacterLibrary(scene, { atlas: true });
  const models = new ModelLibrary(scene);
  const still = { speed: 0, moveAngle: 0, airborne: false, alive: true, pitch: 0, celebrate: false };
  let eyePitch = 0;
  let eyeDrop = 0;
  let rig = null;
  let current = null;
  let joints = null;
  let posed = null;
  let frames = 0;
  let fireRate = 0;
  let firedAt = 0;
  const crowd = [];
  let creature = null;
  let creatures = null;
  engine.runRenderLoop(() => {
    current?.anim.update(1 / 30, { ...still, pitch: eyePitch });
    creature?.anim.update(1 / 30, { ...still, pitch: eyePitch });
    for (const a of crowd) a.update(1 / 30, { ...still, pitch: eyePitch });
    if (fireRate > 0 && current && frames - firedAt >= 30 / fireRate) {
      firedAt = frames;
      current.anim.trigger("shoot");
    }
    if (rig) {
      eye.position.set(0, PLAYER.eyeHeight - eyeDrop, 0);
      poseCamera(eye, 0, eyePitch);
      rig.eye.copyFrom(eye.position);
      rig.pitch = eyePitch;
    }
    scene.render();
    frames++;
  });
  const settle = async (n) => {
    const until = frames + n;
    while (frames < until) await new Promise((r) => setTimeout(r, 10));
  };
  async function pose(look, weapon, view) {
    creature?.dispose();
    creature = null;
    current?.dispose();
    current = null;
    joints = null;
    posed = null;
    rig = null;
    const def = getWeapon(weapon);
    if (view === "body") {
      ground.setEnabled(true);
      const holder = new TransformNode("grip_body", scene);
      const ch = await characters.create({ look }, "grip_char");
      fitFirstPersonBody(ch, holder);
      const viewRoot = new TransformNode("grip_view", scene);
      viewRoot.parent = eye;
      const node = await models.instantiate(def.view.model, "grip_viewmodel");
      node.parent = viewRoot;
      for (const m of node.getChildMeshes()) m.renderingGroupId = 1;
      const [vx, vy, vz] = def.view.viewOffset;
      viewRoot.position.set(vx, vy, vz);
      const anim = new CharacterAnimator(scene, ch);
      anim.gripExternal(node, def.view.hold);
      const r = new FirstPersonBodyRig(scene, ch, anim, holder);
      rig = r;
      current = {
        anim,
        dispose: () => {
          r.dispose();
          anim.dispose();
          node.dispose();
          viewRoot.dispose();
          holder.dispose();
        }
      };
      joints = ch.joints;
      eye.position.set(0, PLAYER.eyeHeight - eyeDrop, 0);
      poseCamera(eye, 0, eyePitch);
      scene.activeCamera = eye;
      await settle(40);
    } else if (view === "third") {
      ground.setEnabled(true);
      const ch = await characters.create({ look }, "grip_char");
      const { min, max } = ch.root.getHierarchyBoundingVectors(true);
      ch.root.scaling.scaleInPlace(PLAYER.height * ch.root.scaling.y / Math.max(0.5, max.y - min.y));
      const anim = new CharacterAnimator(scene, ch);
      const node = await models.instantiate(def.view.model, "grip_weapon");
      anim.hold(node, def.view.hold);
      current = { anim, dispose: () => anim.dispose() };
      joints = ch.joints;
      posed = { ch, weapon: node, hold: def.view.hold };
      scene.activeCamera = orbit;
      await settle(40);
      const at2 = (n) => {
        const j = ch.joints.get(n);
        j?.computeWorldMatrix(true);
        return j ? j.getAbsolutePosition().clone() : new Vector3(0, 1.2, 0.3);
      };
      const hr = at2("hand_r");
      const hl = at2("hand_l");
      const side = Math.sign(at2("upperarm_r").x) || 1;
      const target = def.view.hold.style === "melee" ? hr : hr.add(hl).scale(0.5);
      orbit.target.copyFrom(target);
      orbit.alpha = Math.PI / 2 - side * 0.75;
      orbit.beta = 1.25;
      orbit.radius = 0.95;
      await settle(4);
    } else {
      ground.setEnabled(false);
      const root = new TransformNode("grip_fp", scene);
      root.parent = eye;
      const viewRoot = new TransformNode("grip_view", scene);
      viewRoot.parent = eye;
      const ch = await characters.create({ look: armsLookFor(look), armsOnly: true }, "grip_arms");
      fitFirstPersonArms(ch, root);
      const node = await models.instantiate(def.view.model, "grip_viewmodel");
      node.parent = viewRoot;
      const [vx, vy, vz] = def.view.viewOffset;
      viewRoot.position.set(vx, vy, vz);
      const anim = new CharacterAnimator(scene, ch);
      anim.gripExternal(node, def.view.hold);
      current = {
        anim,
        dispose: () => {
          anim.dispose();
          node.dispose();
          viewRoot.dispose();
          root.dispose();
        }
      };
      eye.position.set(0, PLAYER.eyeHeight, -3);
      poseCamera(eye, 0, 0);
      scene.activeCamera = eye;
      await settle(40);
    }
  }
  async function body(from) {
    orbit.target.set(0, from === "feet" ? 0.12 : PLAYER.height / 2, 0);
    orbit.alpha = from === "side" || from === "feet" ? 0 : from === "front" ? Math.PI / 2 : -Math.PI / 2;
    orbit.beta = from === "feet" ? Math.PI / 2 - 0.02 : Math.PI / 2 - 0.05;
    orbit.radius = from === "feet" ? 1.3 : 3.4;
    await settle(4);
  }
  async function upper(from) {
    const j = joints?.get("upperarm_r");
    j?.computeWorldMatrix(true);
    const side = Math.sign(j?.getAbsolutePosition().x ?? 1) || 1;
    orbit.target.set(0, PLAYER.height * 0.66, 0.12);
    orbit.alpha = from === "side" ? side > 0 ? 0 : Math.PI : Math.PI / 2;
    orbit.beta = Math.PI / 2 - 0.08;
    orbit.radius = 2.3;
    await settle(4);
  }
  async function head(alpha, radius, beta = Math.PI / 2 - 0.08) {
    const j = joints?.get("Head");
    j?.computeWorldMatrix(true);
    const p = j ? j.getAbsolutePosition() : new Vector3(0, PLAYER.eyeHeight, 0);
    orbit.target.set(p.x, p.y + 0.06, p.z);
    orbit.alpha = alpha;
    orbit.beta = beta;
    orbit.radius = radius;
    orbit.fov = radius > 2 ? DEFAULT_FOV : 0.8;
    await settle(4);
  }
  async function poseCreature(kind, weapon) {
    creature?.dispose();
    creature = null;
    current?.dispose();
    current = null;
    posed = null;
    rig = null;
    ground.setEnabled(true);
    creatures ??= new CreatureLibrary(scene);
    const ch = await creatures.create(kind, "grip_creature");
    fitPlayerSkin(ch, PLAYER.height);
    const anim = new CreatureAnimator(scene, ch, true);
    const def = getWeapon(weapon);
    const node = await models.instantiate(def.view.model, "grip_weapon");
    anim.hold(node, def.view.hold);
    creature = { anim, dispose: () => (anim.dispose(), ch.dispose(), node.dispose()) };
    joints = ch.joints;
    scene.activeCamera = orbit;
    await settle(40);
    const at2 = (n) => {
      const j = ch.joints.get(n);
      j?.computeWorldMatrix(true);
      return j ? j.getAbsolutePosition().clone() : new Vector3(0, 1.2, 0.3);
    };
    const side = Math.sign(at2("upperarm_r").x) || 1;
    orbit.target.copyFrom(at2("hand_r").add(at2("hand_l")).scale(0.5));
    orbit.alpha = Math.PI / 2 - side * 0.75;
    orbit.beta = 1.25;
    orbit.radius = 0.95;
    await settle(4);
  }
  const api = {
    creature: poseCreature,
    /** The posed creature's animator (`__grips.creature`). */
    creatureAnim: () => creature?.anim ?? null,
    looks: () => CORE_LOOKS.map((l) => ({ id: l.id, name: l.name, parts: l.parts })),
    pose,
    head,
    /** First person: how far (model m) each palm is from its point on the gun (0: on it). */
    miss: () => current?.anim.gripMiss ?? null,
    /** The posed character's animator (tests: where its hands are drawn, gripCheck). */
    anim: () => current?.anim ?? null,
    /** Where the posed hands are drawn on the gun (model m from each hand's skin centre to its point; handProbe.ts). */
    drawn: () => current?.anim.drawnGrip([...rig?.drawnMeshes ?? [], ...current?.anim.ch.meshes ?? []]) ?? null,
    body,
    upper,
    /**
     * After a third-person pose, a close look at one joint (a support hand on the handguard): the orbit camera on
     * that joint's position, `alpha`/`beta` round it (radians, Babylon's), `radius` away (m).
     */
    closeUp: async (joint, alpha, beta, radius = 0.35) => {
      const j = joints?.get(joint);
      j?.computeWorldMatrix(true);
      if (j) orbit.target.copyFrom(j.getAbsolutePosition());
      orbit.alpha = alpha;
      orbit.beta = beta;
      orbit.radius = radius;
      await settle(4);
    },
    /** Measurements of the third-person pose as drawn (tools/gripAudit.ts; tools/content/grip-audit.mjs ranks them). */
    audit: () => posed ? auditGrip(posed.ch, posed.weapon, posed.hold) : null,
    /** Curl test: close the hands by this share of their curl (1 as the game does; 0 open), and redraw. */
    curl: async (share) => {
      setCurlShare(share);
      await settle(4);
    },
    /** The first-person pistol hold, changed live (characterAnimator PISTOL; to tune it), and redrawn. Returns it. */
    pistol: async (tune = {}) => {
      const now = { ...setPistolTune(tune) };
      await settle(4);
      return now;
    },
    /**
     * Full-body first person (`pose(look, weapon, 'body')`): the view's pitch (radians, the game's: + looks up), and the
     * body's motion (speed m/s, stance 0 standing / 1 crouched, airborne); `drop` lowers the eye (m, a crouch).
     */
    /** Full body: look at the posed body from outside (from its right side, `alpha` round), or back through its eyes (null). */
    outside: async (alpha) => {
      if (alpha === null) scene.activeCamera = eye;
      else {
        orbit.target.set(0, 1.2, 0);
        orbit.alpha = alpha;
        orbit.beta = 1.3;
        orbit.radius = 2.4;
        scene.activeCamera = orbit;
      }
      await settle(4);
    },
    look: async (pitch, motion = {}) => {
      eyePitch = pitch;
      eyeDrop = motion.drop ?? 0;
      Object.assign(still, { speed: motion.speed ?? 0, stance: motion.stance ?? 0, airborne: !!motion.airborne, sprinting: !!motion.sprinting });
      await settle(30);
    },
    /**
     * Third person in motion (the legs step in place; the animator is fed 1/30 s a frame): the body's motion (speed,
     * moveAngle, stance, sprinting; `pitch` the aim) and `rate` shots a second fired meanwhile (0: none).
     */
    drive: async (motion, rate = 0, frames2 = 30) => {
      if (motion.pitch !== void 0) eyePitch = motion.pitch;
      const { pitch: _pitch, ...rest } = motion;
      Object.assign(still, { moveAngle: 0, speed: 0, ...rest });
      fireRate = rate;
      await settle(frames2);
    },
    /**
     * Animation cost: `n` more characters of `look` (each holding `weapon`, in a grid behind the posed one) driven by
     * the same motion (`drive`), or none (n 0; n < 0 keeps the crowd there is). Returns, over `seconds`, the mean milliseconds a frame spends
     * evaluating clips and in the animators' after-clip work (aim, IK, grip), and the playing animatables.
     */
    crowd: async (look, n, weapon = "core.rifle", seconds = 3) => {
      if (n >= 0) for (const a of crowd.splice(0)) a.dispose();
      for (let i = 0; i < n; i++) {
        const ch = await characters.create({ look }, `crowd_${i}`);
        ch.root.position.set(i % 12 * 1.2 - 6.6, 0, 3 + Math.floor(i / 12) * 1.5);
        const a = new CharacterAnimator(scene, ch);
        a.hold(await models.instantiate(getWeapon(weapon).view.model, `crowd_w${i}`), getWeapon(weapon).view.hold);
        crowd.push(a);
      }
      await settle(20);
      let t0 = 0;
      let anim = 0;
      let after = 0;
      let count = 0;
      const b = scene.onBeforeAnimationsObservable.add(() => t0 = performance.now());
      const m = scene.onAfterAnimationsObservable.add(() => {
        const t = performance.now();
        anim += t - t0;
        t0 = t;
      }, void 0, true);
      const e = scene.onAfterAnimationsObservable.add(() => {
        after += performance.now() - t0;
        count++;
      });
      const until = performance.now() + seconds * 1e3;
      while (performance.now() < until) await settle(1);
      scene.onBeforeAnimationsObservable.remove(b);
      scene.onAfterAnimationsObservable.remove(m);
      scene.onAfterAnimationsObservable.remove(e);
      return { frames: count, animMs: anim / Math.max(1, count), afterMs: after / Math.max(1, count), animatables: scene.animatables.length };
    },
    /**
     * Which way the posed character's palms were read (handProbe.skinHandFrame): per hand, the cue that decided and
     * each cue's vote (+ agrees), and `rig`: the rig's own reading in the pose as drawn (the thumb's side of the
     * knuckles; + agrees). Null for a hand without a frame of its own.
     */
    palms: () => {
      const ch = current?.anim.ch;
      if (!ch) return null;
      const out = {};
      for (const side of ["l", "r"]) {
        const f = skinHandFrame(ch.meshes, (n) => ch.joints.get(n), side, ch.hands[side]?.palmSide);
        const j = (n) => ch.joints.get(`${n}_${side}`);
        const [hand, knuckle, index, pinky, thumb] = [j("hand"), j("middle_01"), j("index_01"), j("pinky_01"), j("thumb_02")];
        let rig2 = null;
        if (f && hand && knuckle && index && pinky && thumb) {
          for (const n of [hand, knuckle, index, pinky, thumb]) n.computeWorldMatrix(true);
          const wrist = hand.getAbsolutePosition();
          const fwd = knuckle.getAbsolutePosition().subtract(wrist).normalize();
          const across = index.getAbsolutePosition().subtract(pinky.getAbsolutePosition()).normalize();
          const t = thumb.getAbsolutePosition().subtract(wrist);
          const side_ = t.subtract(fwd.scale(Vector3.Dot(t, fwd))).subtract(across.scale(Vector3.Dot(t, across)));
          const palm = Vector3.TransformNormal(f.palm, hand.getWorldMatrix()).normalize();
          rig2 = Math.round(Vector3.Dot(side_.normalize(), palm) * 100) / 100;
        }
        const own = (current?.anim).arms?.[side]?.frame;
        out[side] = f ? { by: f.by, votes: f.votes, rig: rig2, fingers: ch.hands[side]?.fingers ?? "rig", used: own ? Math.round(Vector3.Dot(own.palm, f.palm) * 100) / 100 : null } : null;
      }
      return out;
    },
    /** Before/after: hands built from now on read their palms by `rule` (`joints`, the default, or `old`). */
    palmRule: (rule) => setPalmRule(rule),
    /** World positions of the posed character's joints (third person), by name. */
    joints: () => Object.fromEntries(
      [...joints ?? /* @__PURE__ */ new Map()].map(([n, j]) => {
        j.computeWorldMatrix(true);
        const p = j.getAbsolutePosition();
        return [n, [p.x, p.y, p.z]];
      })
    )
  };
  Object.assign(window, { __grips: api });
}
export {
  openGripSheet
};
