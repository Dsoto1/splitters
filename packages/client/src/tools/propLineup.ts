import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { Scene } from '@babylonjs/core/scene';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { CreateLineSystem } from '@babylonjs/core/Meshes/Builders/linesBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { BODY_SIZES, CORE_PROPS, PLAYER, getProp, type BodySize, type PropDefinition } from '@tiletrigger/shared';
import { CharacterLibrary } from '../content/characters.ts';
import { ModelLibrary } from '../content/models.ts';
import { CharacterAnimator, type MotionState } from '../game/characterAnimator.ts';
import { DEFAULT_FOV } from '../game/view.ts';

/** How a row is seen: from a standing player's eye (the game's field of view), or a true elevation of each prop's side. */
export type LineupView = 'eye' | 'side';

/** Reference heights drawn across the row (docs/CONTENT_PIPELINE.md, "Real-world sizes"). */
const GUIDES: readonly [number, string][] = [
  [0.46, 'seat 0.46'],
  [0.76, 'table 0.76'],
  [0.92, 'counter 0.92'],
  [2.05, 'door 2.05'],
];
/** Gap between neighbours in a row (metres). */
const GAP = 0.45;

/**
 * Prop lineup (team tool, `?mode=lineup`): placeable props in a row beside a small, a standard and a large character
 * (BODY_SIZES: 1.40, 1.80 and 2.12 m) and a 1 m ruler, with the reference heights of chairs, tables, counters and
 * doors drawn across, so props can be judged against the people who use them. tools/content/prop-lineup.mjs drives it
 * through `window.__lineup` and screenshots each row into a sheet per pack: from a standing player's eye (1.6 m, the
 * game's field of view) and from the side (a true elevation: each prop turned to show its profile).
 */
export async function openPropLineup(engine: AbstractEngine): Promise<void> {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.78, 0.8, 0.83, 1);
  new HemisphericLight('hemi', new Vector3(0.3, 1, 0.5), scene).intensity = 0.95;
  new DirectionalLight('sun', new Vector3(-0.3, -1, -0.6), scene).intensity = 0.75;
  const ground = CreateGround('ground', { width: 200, height: 60 }, scene);
  const gm = new StandardMaterial('groundMat', scene);
  gm.diffuseColor = new Color3(0.55, 0.57, 0.6);
  gm.specularColor = new Color3(0, 0, 0);
  ground.material = gm;
  // A 0.5 m grid on the floor.
  const lines: Vector3[][] = [];
  for (let i = -40; i <= 160; i++) lines.push([new Vector3(i * 0.5, 0.002, -6), new Vector3(i * 0.5, 0.002, 6)]);
  for (let j = -12; j <= 12; j++) lines.push([new Vector3(-20, 0.002, j * 0.5), new Vector3(80, 0.002, j * 0.5)]);
  CreateLineSystem('grid', { lines }, scene).color = new Color3(0.45, 0.47, 0.5);

  const camera = new FreeCamera('lineup_cam', new Vector3(0, PLAYER.eyeHeight, 6), scene);
  camera.minZ = 0.05;
  camera.maxZ = 400;
  scene.activeCamera = camera;
  window.addEventListener('resize', () => engine.resize());

  const params = new URLSearchParams(location.search);
  const look = params.get('look') ?? 'core.scout';
  const characters = new CharacterLibrary(scene, { atlas: true });
  const models = new ModelLibrary(scene);
  const still: MotionState = { speed: 0, moveAngle: 0, airborne: false, alive: true, pitch: 0, celebrate: false };
  const people: { size: BodySize; anim: CharacterAnimator; root: TransformNode }[] = [];
  for (const size of ['small', 'standard', 'large'] as const) {
    const ch = await characters.create({ look }, `lineup_${size}`);
    const { min, max } = ch.root.getHierarchyBoundingVectors(true);
    ch.root.scaling.scaleInPlace((PLAYER.height * BODY_SIZES[size].scale * ch.root.scaling.y) / Math.max(0.5, max.y - min.y));
    people.push({ size, anim: new CharacterAnimator(scene, ch), root: ch.root });
  }

  // The ruler: 2.5 m in 10 cm bands, black and white, a darker band every metre.
  const ruler: TransformNode[] = [];
  const mats = ['#141414', '#f2f2f2', '#c0392b'].map((hex, i) => {
    const m = new StandardMaterial(`ruler_${i}`, scene);
    m.diffuseColor = Color3.FromHexString(hex);
    m.emissiveColor = Color3.FromHexString(hex).scale(0.6);
    m.specularColor = new Color3(0, 0, 0);
    return m;
  });
  for (let i = 0; i < 25; i++) {
    const band = CreateBox(`ruler_band_${i}`, { width: 0.06, height: 0.1, depth: 0.06 }, scene);
    band.position.set(0, i * 0.1 + 0.05, 0);
    band.material = i === 9 || i === 19 ? mats[2]! : mats[i % 2]!;
    ruler.push(band);
  }
  const guideMat = new StandardMaterial('guide', scene);
  guideMat.emissiveColor = new Color3(0.1, 0.35, 0.75);
  guideMat.disableLighting = true;
  let guides: TransformNode[] = [];
  let shown: TransformNode[] = [];
  let labels: { el: HTMLDivElement; at: Vector3 }[] = [];
  const overlay = document.createElement('div');
  overlay.id = 'lineup-labels';
  overlay.style.cssText = 'position:fixed;inset:0;pointer-events:none;font:600 13px/1.25 system-ui,sans-serif;color:#111';
  document.body.append(overlay);
  const label = (text: string, at: Vector3, style = '') => {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = `position:absolute;transform:translate(-50%,0);white-space:nowrap;text-align:center;${style}`;
    overlay.append(el);
    labels.push({ el, at });
  };

  let frames = 0;
  engine.runRenderLoop(() => {
    for (const p of people) p.anim.update(1 / 30, still);
    scene.render();
    // Labels under what they name.
    const vp = camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
    const m = scene.getTransformMatrix();
    for (const l of labels) {
      const s = Vector3.Project(l.at, Matrix.IdentityReadOnly, m, vp);
      l.el.style.left = `${(s.x / engine.getRenderWidth()) * window.innerWidth}px`;
      l.el.style.top = `${(s.y / engine.getRenderHeight()) * window.innerHeight}px`;
    }
    frames++;
  });
  const settle = async (n: number) => {
    const until = frames + n;
    while (frames < until) await new Promise((r) => setTimeout(r, 10));
  };

  /**
   * Show the props `ids` in a row (left to right) after the three characters and the ruler, seen from `view`. `scales`:
   * an instance scale per prop (default 1). Resolves once the models are drawn.
   */
  async function show(ids: string[], view: LineupView, scales: number[] = []): Promise<{ width: number; props: { id: string; at: number; size: readonly number[] }[] }> {
    for (const n of shown) n.dispose();
    for (const g of guides) g.dispose();
    for (const l of labels) l.el.remove();
    shown = [];
    guides = [];
    labels = [];
    const side = view === 'side';
    // The characters, then the ruler, then the props, each `GAP` from the last.
    let x = 0;
    for (const p of people) {
      const w = 0.55 * BODY_SIZES[p.size].scale;
      p.root.position.set(x + w / 2, 0, 0);
      p.root.rotation.y = side ? Math.PI / 2 : 0;
      label(`${BODY_SIZES[p.size].label}\n${(PLAYER.height * BODY_SIZES[p.size].scale).toFixed(2)} m`, new Vector3(x + w / 2, -0.04, 0), 'white-space:pre');
      x += w + GAP * 0.6;
    }
    for (const [i, band] of ruler.entries()) band.position.set(x + 0.03, i * 0.1 + 0.05, 0);
    label('1 m', new Vector3(x + 0.03, 1, 0), 'transform:translate(6px,-50%);color:#c0392b');
    label('2 m', new Vector3(x + 0.03, 2, 0), 'transform:translate(6px,-50%);color:#c0392b');
    x += 0.06 + GAP;
    const placed: { id: string; at: number; size: readonly number[] }[] = [];
    for (const [i, id] of ids.entries()) {
      const def: PropDefinition | undefined = getProp(id);
      if (!def) continue;
      const s = scales[i] ?? 1;
      // Side view: turned a quarter so its profile (its depth, z) faces the camera.
      const across = (side ? def.size[2] : def.size[0]) * s;
      const node = await models.instantiateStatic(def.file, `lineup_prop_${i}`);
      node.scaling.setAll(s);
      node.rotation.y = side ? Math.PI / 2 : 0;
      node.position.set(x + across / 2, 0, 0);
      shown.push(node);
      placed.push({ id, at: x + across / 2, size: def.size.map((v) => v * s) });
      label(`${def.displayName}\n${(def.size[1] * s).toFixed(2)} m${s !== 1 ? ` (×${s})` : ''}`, new Vector3(x + across / 2, -0.04, 0), 'white-space:pre;font-weight:500');
      x += across + GAP;
    }
    // Guides across the row at the reference heights, a hair behind the props' middles.
    const guideLines = GUIDES.map(([y]) => [new Vector3(-0.2, y, -0.01), new Vector3(x, y, -0.01)]);
    const g = CreateLineSystem('lineup_guides', { lines: guideLines }, scene);
    g.color = new Color3(0.1, 0.35, 0.75);
    guides.push(g);
    for (const [y, text] of GUIDES) label(text, new Vector3(x - GAP / 2, y, -0.01), 'transform:translate(4px,-50%);color:#1a4fb0;font-weight:500');
    // The camera: from a standing player's eye, the game's field of view, back far enough for the row; or a true elevation.
    const width = x;
    if (side) {
      camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
      const aspect = engine.getRenderWidth() / engine.getRenderHeight();
      const half = Math.max(width / 2 + 0.3, ((2.75 + 0.35) / 2) * aspect);
      const tall = half / aspect;
      camera.orthoLeft = -half;
      camera.orthoRight = half;
      camera.orthoTop = tall;
      camera.orthoBottom = -tall;
      camera.position.set(width / 2, tall - 0.35, 30);
      camera.setTarget(new Vector3(width / 2, tall - 0.35, 0));
    } else {
      camera.mode = Camera.PERSPECTIVE_CAMERA;
      camera.fov = DEFAULT_FOV;
      const aspect = engine.getRenderWidth() / engine.getRenderHeight();
      const hfov = 2 * Math.atan(Math.tan(DEFAULT_FOV / 2) * aspect);
      const back = Math.max(3, (width / 2 + 0.4) / Math.tan(hfov / 2));
      camera.position.set(width / 2, PLAYER.eyeHeight, back);
      camera.setTarget(new Vector3(width / 2, PLAYER.eyeHeight, 0));
    }
    await settle(8);
    return { width, props: placed };
  }

  /** Every placeable prop: id, name, category, built size. */
  const props = () => CORE_PROPS.map((p) => ({ id: p.id, name: p.displayName, category: p.category, size: p.size }));
  await settle(4);
  Object.assign(window, { __lineup: { show, props, look } });
}
