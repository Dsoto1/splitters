import { S as Scene, C as Color4, V as Vector3, H as HemisphericLight, D as DirectionalLight, d as CreateGround, c as StandardMaterial, a as Color3, T as TransformNode } from "./babylon-PnzH6wcM.js";
import { A as ArcRotateCamera } from "./arcRotateCamera-CsS6MmRY.js";
import "./groundBuilder-BbO9y42p.js";
import { o as CORE_LOOKS, N as NPC_ROLE_SPECS, C as CharacterLibrary, P as PLAYER, c as CharacterAnimator, u as CREATURE_ROLES, v as CreatureLibrary, w as CreatureAnimator, x as setCharacterLodZoom, M as ModelLibrary, d as getWeapon, y as SPRINT } from "./index-BAsW2uYW.js";
import { B as BodyHitbox, h as hitboxForSpec } from "./hitboxOverlay-CUGIm5Wp.js";
import "./easing-CT5FBt-r.js";
import "./vendor-BIr0ad6t.js";
import "./capsuleBuilder-D5ktebP4.js";
import "./sphereBuilder.pure-CT5peVwp.js";
import "./lookHitbox-C8CMJlSr.js";
async function openCharacterViewer(engine, canvas) {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.16, 0.18, 0.21, 1);
  const params = new URLSearchParams(location.search);
  const only = params.get("looks")?.split(",");
  const specs = only ? CORE_LOOKS.filter((l) => only.includes(l.id)).map((l) => ({ look: l.id, label: l.name })) : [
    ...CORE_LOOKS.map((l) => ({ look: l.id, label: l.name })),
    { npc: { color: "#d04a3a", scale: NPC_ROLE_SPECS.trooper.scale }, label: "NPC Trooper" },
    { npc: { color: "#d04a3a", scale: NPC_ROLE_SPECS.trooper.scale, female: true }, label: "NPC Trooper (F)" },
    { npc: { color: "#5cc77a", scale: NPC_ROLE_SPECS.heavy.scale }, label: "NPC Heavy" },
    { npc: { color: "#5cc77a", scale: NPC_ROLE_SPECS.heavy.scale, female: true }, label: "NPC Heavy (F)" }
  ];
  const spacing = 1.3;
  const perRow = only ? specs.length : Math.ceil(specs.length / 2);
  const place = (i) => ({ x: i % perRow * spacing + (i >= perRow ? spacing / 2 : 0), z: i >= perRow ? -1.6 : 0 });
  const mid = (perRow - 1) * spacing / 2;
  const camera = new ArcRotateCamera("cam", Number(params.get("alpha") ?? Math.PI / 2), 1.25, Number(params.get("dist") ?? 12), new Vector3(Number(params.get("x") ?? mid), 1, Number(params.get("z") ?? 0)), scene);
  camera.minZ = 0.05;
  camera.wheelPrecision = 40;
  camera.attachControl(canvas, true);
  new HemisphericLight("hemi", new Vector3(0.3, 1, 0.4), scene).intensity = 0.9;
  new DirectionalLight("sun", new Vector3(-0.4, -1, 0.6), scene).intensity = 0.7;
  const ground = CreateGround("ground", { width: 40, height: 20 }, scene);
  const gm = new StandardMaterial("groundMat", scene);
  gm.diffuseColor = new Color3(0.3, 0.32, 0.36);
  ground.material = gm;
  const characters = new CharacterLibrary(scene, { atlas: true });
  const models = new ModelLibrary(scene);
  const animators = await Promise.all(
    specs.map(async (s, i) => {
      const ch = await characters.create(s, `view_${i}`);
      ch.root.rotation.y = 0;
      const { min, max } = ch.root.getHierarchyBoundingVectors(true);
      ch.root.scaling.scaleInPlace(PLAYER.height * ch.root.scaling.y / Math.max(0.5, max.y - min.y));
      const holder = ch.root;
      const p = place(i);
      holder.position.set(p.x, 0, p.z);
      return new CharacterAnimator(scene, ch);
    })
  );
  const creatureLib = new CreatureLibrary(scene);
  const bodies = params.get("creatures") === "0" ? [] : [...CREATURE_ROLES, "zombie"];
  const creatures = await Promise.all(
    bodies.map(async (kind, i) => {
      const ch = await creatureLib.create(kind, `creature_${kind}`);
      ch.root.position.set(mid + (i - (bodies.length - 1) / 2) * 2.6, 0, 2.4);
      return new CreatureAnimator(scene, ch);
    })
  );
  const state = { speed: 0, moveAngle: 0, airborne: false, alive: true, pitch: 0, celebrate: false };
  const overlays = [
    ...specs.map((s, i) => ({ s, at: place(i) })),
    ...bodies.map((kind, i) => ({ s: { creature: kind }, at: { x: mid + (i - (bodies.length - 1) / 2) * 2.6, z: 2.4 } }))
  ].map(({ s, at }, i) => {
    const node = new TransformNode(`hitbox_at_${i}`, scene);
    node.position.set(at.x, 0, at.z);
    return { node, spec: s, box: new BodyHitbox(scene) };
  });
  let showHitboxes = params.get("hitboxes") === "1";
  const drawHitboxes = () => {
    for (const o of overlays) {
      if (!showHitboxes) {
        o.box.hide();
        continue;
      }
      const h = hitboxForSpec(o.spec);
      o.box.show(o.node, h.box, state.stance ?? 0, h.scale);
    }
  };
  drawHitboxes();
  const panel = document.createElement("div");
  panel.id = "char-panel";
  panel.style.cssText = "position:fixed;left:0;right:0;bottom:0;padding:10px;background:rgba(21,24,29,.94);font:12px system-ui;color:#eee;display:flex;flex-wrap:wrap;gap:6px;align-items:center";
  const btn = (label, f) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.onclick = f;
    panel.append(b);
  };
  const move = (speed, angle = 0, sprinting = false) => () => Object.assign(state, { speed, moveAngle: angle, sprinting, airborne: false, alive: true, celebrate: false });
  const run = PLAYER.runSpeed;
  btn("Idle", move(0));
  btn("Walk", move(1.6));
  btn("Jog", move(3.2));
  btn("Run", move(run));
  btn("Sprint", move(run * SPRINT.speed, 0, true));
  btn("Diagonal", move(run, Math.PI / 4));
  btn("Strafe →", move(run, Math.PI / 2));
  btn("Backpedal", move(run * 0.85, Math.PI));
  btn("Airborne", () => Object.assign(state, { airborne: !state.airborne }));
  btn("Death", () => Object.assign(state, { alive: !state.alive }));
  btn("Dance", () => Object.assign(state, { celebrate: !state.celebrate }));
  for (const [label, stance] of [["Stand", 0], ["Crouch", 1], ["Prone", 2]]) btn(label, () => (Object.assign(state, { stance }), drawHitboxes()));
  btn("Hitboxes", () => (showHitboxes = !showHitboxes, drawHitboxes()));
  for (const a of ["shoot", "melee", "melee_heavy", "reload", "throw", "hit", "interact"]) btn(a, () => [...animators, ...creatures].forEach((x) => x.trigger(a)));
  for (const [label, w] of [["Knife", "core.knife"], ["Pistol", "core.pistol"], ["Rifle", "core.rifle"], ["Shotgun", "core.shotgun"], ["Sniper", "core.sniper"], ["Launcher", "core.launcher"], ["Revolver", "core.revolver"], ["Spin Gun", "core.lmg"]]) {
    btn(label, () => animators.forEach((x, i) => void models.instantiate(getWeapon(w).view.model, `held_${i}`).then((n) => x.hold(n, getWeapon(w).view.hold))));
  }
  const pitch = document.createElement("input");
  pitch.type = "range";
  pitch.min = "-60";
  pitch.max = "60";
  pitch.value = "0";
  pitch.oninput = () => state.pitch = Number(pitch.value) * Math.PI / 180;
  panel.append(" Aim pitch ", pitch, ` ${specs.map((s) => s.label).join(" · ")} · front: ${bodies.join(", ")}`);
  document.body.append(panel);
  window.__charsReady = true;
  Object.assign(window, { __charHitboxes: (on, stance) => (showHitboxes = on, stance !== void 0 && (state.stance = stance), drawHitboxes()), __charCamera: camera, __charState: state, __charAnimators: animators, __creatureAnimators: creatures, __charSpecs: specs.length, __charLodZoom: setCharacterLodZoom });
  let last = performance.now();
  engine.runRenderLoop(() => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1e3);
    last = now;
    for (const a of animators) a.update(dt, state);
    for (const c of creatures) c.update(dt, state);
    scene.render();
  });
  return () => {
    panel.remove();
    scene.dispose();
  };
}
export {
  openCharacterViewer
};
