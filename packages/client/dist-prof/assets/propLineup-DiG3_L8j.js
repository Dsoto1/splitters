import { S as Scene, C as Color4, H as HemisphericLight, V as Vector3, D as DirectionalLight, d as CreateGround, c as StandardMaterial, a as Color3, F as FreeCamera, e as CreateBox, M as Matrix, f as Camera } from "./babylon-PnzH6wcM.js";
import "./camera-COnbUpeD.js";
import "./groundBuilder-BbO9y42p.js";
import { C as CreateLineSystem } from "./linesBuilder-6E0Gh92-.js";
import { P as PLAYER, C as CharacterLibrary, B as BODY_SIZES, c as CharacterAnimator, M as ModelLibrary } from "./index-BAsW2uYW.js";
import { D as DEFAULT_FOV } from "./view-CiZYAbjB.js";
import { C as CORE_PROPS, g as getProp, e as envModelFile } from "./settle-BDJE4VMF.js";
import { k as kitModelFile } from "./scenarioDefs-BcDISE-R.js";
import "./shaderMaterial.pure-T5Xe2ebz.js";
import "./vendor-BIr0ad6t.js";
import "./abstractMesh-CcTXW9P4.js";
import "./shadowGenerator-_IcnNyty.js";
import "./rapier-BmnBVapV.js";
import "./thinInstanceMesh.pure-BG4P9X5v.js";
import "./envMaterials-BVmVluEo.js";
import "./materialPluginBase-Dhlt5oKE.js";
import "./babylonFileParser.function-CbkFZ5Hm.js";
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
const GUIDES = [
  [0.46, "seat 0.46"],
  [0.76, "table 0.76"],
  [0.92, "counter 0.92"],
  [2.05, "door 2.05"]
];
const GAP = 0.45;
async function openPropLineup(engine) {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.78, 0.8, 0.83, 1);
  new HemisphericLight("hemi", new Vector3(0.3, 1, 0.5), scene).intensity = 0.95;
  new DirectionalLight("sun", new Vector3(-0.3, -1, -0.6), scene).intensity = 0.75;
  const ground = CreateGround("ground", { width: 200, height: 60 }, scene);
  const gm = new StandardMaterial("groundMat", scene);
  gm.diffuseColor = new Color3(0.55, 0.57, 0.6);
  gm.specularColor = new Color3(0, 0, 0);
  ground.material = gm;
  const lines = [];
  for (let i = -20; i <= 80; i++) lines.push([new Vector3(i, 2e-3, -6), new Vector3(i, 2e-3, 6)]);
  for (let j = -6; j <= 6; j++) lines.push([new Vector3(-20, 2e-3, j), new Vector3(80, 2e-3, j)]);
  CreateLineSystem("grid", { lines }, scene).color = new Color3(0.5, 0.52, 0.55);
  const camera = new FreeCamera("lineup_cam", new Vector3(0, PLAYER.eyeHeight, 6), scene);
  camera.minZ = 0.05;
  camera.maxZ = 400;
  scene.activeCamera = camera;
  window.addEventListener("resize", () => engine.resize());
  const params = new URLSearchParams(location.search);
  const look = params.get("look") ?? "core.scout";
  const characters = new CharacterLibrary(scene, { atlas: true });
  const models = new ModelLibrary(scene);
  const still = { speed: 0, moveAngle: 0, airborne: false, alive: true, pitch: 0, celebrate: false };
  const people = [];
  for (const size of ["small", "standard", "large"]) {
    const ch = await characters.create({ look }, `lineup_${size}`);
    const { min, max } = ch.root.getHierarchyBoundingVectors(true);
    ch.root.scaling.scaleInPlace(PLAYER.height * BODY_SIZES[size].scale * ch.root.scaling.y / Math.max(0.5, max.y - min.y));
    people.push({ size, anim: new CharacterAnimator(scene, ch), root: ch.root });
  }
  const ruler = [];
  const mats = ["#141414", "#f2f2f2", "#c0392b"].map((hex, i) => {
    const m = new StandardMaterial(`ruler_${i}`, scene);
    m.diffuseColor = Color3.FromHexString(hex);
    m.emissiveColor = Color3.FromHexString(hex).scale(0.6);
    m.specularColor = new Color3(0, 0, 0);
    return m;
  });
  for (let i = 0; i < 25; i++) {
    const band = CreateBox(`ruler_band_${i}`, { width: 0.06, height: 0.1, depth: 0.06 }, scene);
    band.position.set(0, i * 0.1 + 0.05, 0);
    band.material = i === 9 || i === 19 ? mats[2] : mats[i % 2];
    ruler.push(band);
  }
  const guideMat = new StandardMaterial("guide", scene);
  guideMat.emissiveColor = new Color3(0.1, 0.35, 0.75);
  guideMat.disableLighting = true;
  let guides = [];
  let shown = [];
  let labels = [];
  const overlay = document.createElement("div");
  overlay.id = "lineup-labels";
  overlay.style.cssText = "position:fixed;inset:0;pointer-events:none;font:600 13px/1.25 system-ui,sans-serif;color:#111";
  document.body.append(overlay);
  const label = (text, at, style = "") => {
    const el = document.createElement("div");
    el.textContent = text;
    el.style.cssText = `position:absolute;transform:translate(-50%,0);white-space:nowrap;text-align:center;${style}`;
    overlay.append(el);
    labels.push({ el, at });
  };
  let frames = 0;
  engine.runRenderLoop(() => {
    for (const p of people) p.anim.update(1 / 30, still);
    scene.render();
    const vp = camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
    const m = scene.getTransformMatrix();
    for (const l of labels) {
      const s = Vector3.Project(l.at, Matrix.IdentityReadOnly, m, vp);
      l.el.style.left = `${s.x / engine.getRenderWidth() * window.innerWidth}px`;
      l.el.style.top = `${s.y / engine.getRenderHeight() * window.innerHeight}px`;
    }
    frames++;
  });
  const settle = async (n) => {
    const until = frames + n;
    while (frames < until) await new Promise((r) => setTimeout(r, 10));
  };
  async function show(ids, view, scales = []) {
    for (const n of shown) n.dispose();
    for (const g2 of guides) g2.dispose();
    for (const l of labels) l.el.remove();
    shown = [];
    guides = [];
    labels = [];
    const side = view === "side";
    const facing = Math.PI + (side ? Math.PI / 2 : 0);
    let x = 0;
    for (const p of people) {
      const w = 0.55 * BODY_SIZES[p.size].scale;
      p.root.position.set(x + w / 2, 0, 0);
      p.root.rotation.y = facing;
      label(`${BODY_SIZES[p.size].label}
${(PLAYER.height * BODY_SIZES[p.size].scale).toFixed(2)} m`, new Vector3(x + w / 2, -0.04, 0), "white-space:pre");
      x += w + GAP * 0.6;
    }
    for (const [i, band] of ruler.entries()) band.position.set(x + 0.03, i * 0.1 + 0.05, 0);
    label("1 m", new Vector3(x + 0.03, 1, 0), "transform:translate(6px,-50%);color:#c0392b");
    label("2 m", new Vector3(x + 0.03, 2, 0), "transform:translate(6px,-50%);color:#c0392b");
    x += 0.06 + GAP;
    const placed = [];
    for (const [i, choice] of ids.entries()) {
      const [id, v] = choice.split("#");
      const variant = v === void 0 ? void 0 : Number(v);
      const def = getProp(id);
      if (!def) continue;
      const s = scales[i] ?? 1;
      const across = (side ? def.size[2] : def.size[0]) * s;
      const node = await models.instantiateStatic(kitModelFile(id, variant) ?? envModelFile(id, variant) ?? def.file, `lineup_prop_${i}`);
      node.scaling.setAll(s);
      node.rotation.y = facing;
      node.position.set(x + across / 2, 0, 0);
      shown.push(node);
      placed.push({ id, at: x + across / 2, size: def.size.map((v2) => v2 * s) });
      label(`${def.displayName}${variant ? ` #${variant}` : ""}
${(def.size[1] * s).toFixed(2)} m${s !== 1 ? ` (×${s})` : ""}`, new Vector3(x + across / 2, -0.04, 0), "white-space:pre;font-weight:500");
      x += across + GAP;
    }
    const guideLines = GUIDES.map(([y]) => [new Vector3(-0.2, y, 0.01), new Vector3(x, y, 0.01)]);
    const g = CreateLineSystem("lineup_guides", { lines: guideLines }, scene);
    g.color = new Color3(0.1, 0.35, 0.75);
    guides.push(g);
    for (const [y, text] of GUIDES) label(text, new Vector3(x - GAP / 2, y, 0.01), "transform:translate(4px,-50%);color:#1a4fb0;font-weight:500");
    const width = x;
    if (side) {
      camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
      const aspect = engine.getRenderWidth() / engine.getRenderHeight();
      const half = Math.max(width / 2 + 0.3, (2.75 + 0.35) / 2 * aspect);
      const tall = half / aspect;
      camera.orthoLeft = -half;
      camera.orthoRight = half;
      camera.orthoTop = tall;
      camera.orthoBottom = -tall;
      camera.position.set(width / 2, tall - 0.35, -30);
      camera.setTarget(new Vector3(width / 2, tall - 0.35, 0));
    } else {
      camera.mode = Camera.PERSPECTIVE_CAMERA;
      camera.fov = DEFAULT_FOV;
      const aspect = engine.getRenderWidth() / engine.getRenderHeight();
      const hfov = 2 * Math.atan(Math.tan(DEFAULT_FOV / 2) * aspect);
      const back = Math.max(3, (width / 2 + 0.4) / Math.tan(hfov / 2));
      camera.position.set(width / 2, PLAYER.eyeHeight, -back);
      camera.setTarget(new Vector3(width / 2, PLAYER.eyeHeight, 0));
    }
    await settle(8);
    return { width, props: placed };
  }
  const props = () => CORE_PROPS.map((p) => ({ id: p.id, name: p.displayName, category: p.category, size: p.size }));
  await settle(4);
  Object.assign(window, { __lineup: { show, props, look } });
}
export {
  openPropLineup
};
