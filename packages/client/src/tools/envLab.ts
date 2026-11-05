import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { Scene } from '@babylonjs/core/scene';
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { CreateLineSystem } from '@babylonjs/core/Meshes/Builders/linesBuilder';
import type { LinesMesh } from '@babylonjs/core/Meshes/linesMesh';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { PhotoDome } from '@babylonjs/core/Helpers/photoDome';
import { ENV_SPECIES, PhysicsWorld, environmentShapes, initPhysics, newMapDocument, type MapDocument, type PropEntity } from '@tiletrigger/shared';
import { EnvironmentVisuals } from '../environment/environmentVisuals.ts';
import { ModelLibrary } from '../content/models.ts';
import { createPropNode } from '../game/propVisuals.ts';
import { versioned } from '../assetUrl.ts';
import { ENV_RENDER } from '../content/environment.generated.ts';

/**
 * Environment lab (team tool, `?envlab`; docs/PROCEDURAL_ENVIRONMENT_AUDIT.md §10): every species and
 * variant in a lineup seen from a player's eye height (1.7 m), next to the Kenney and Quaternius pieces they
 * replace, with toggles for level of detail, wireframe, collider overlay, wind, graphics tier and the renderer
 * (WebGL2 by default, `&renderer=webgpu`). A row of oaks and pines going back to 170 m shows the levels of detail
 * and the far stand-in. For art review and before/after screenshots (window.__envlab drives it in tests).
 */


/** Where the "before" set stands: the same layout, this far along x (views of it use the same framing). */
const BEFORE_X = 90;

/**
 * The lineup, one entry per piece: [species, variant index, the old prop it replaces, x, z]. Trees at the back,
 * shrubs, boulders and grass in front, a cliff wall behind; the "before" set has the old pieces in the same places.
 */
const LINEUP: [string, number, string, number, number][] = [
  ['env.broadleaf.oak', 0, 'prop.oak', -12, 4],
  ['env.broadleaf.oak', 1, 'prop.oak_autumn', -3.5, 4],
  ['env.conifer.pine_tall', 0, 'prop.nt_pine_tall', 4.5, 4],
  ['env.conifer.pine_tall', 1, 'prop.nt_pine_snow_tall', 11, 4],
  ['env.shrub.broadleaf', 0, 'prop.bush_large', -4, -4],
  ['env.shrub.broadleaf', 1, 'prop.bush_leafy', -1.6, -4],
  ['env.rock.boulder_angular', 0, 'prop.nt_boulder', 1.6, -4],
  ['env.rock.boulder_angular', 1, 'prop.nt_boulder_moss', 4.6, -4],
  ['env.grass.clump', 0, 'prop.grass_tall', -7.5, -5],
  ['env.grass.clump', 1, 'prop.grass_patch', -6.2, -5],
  // The plants brush's flowers and fern (foliage.ts), in front of the grass.
  ['env.flower.meadow', 0, 'prop.flower_red', -6.4, -6.6],
  ['env.flower.meadow', 1, 'prop.flower_yellow', -5.4, -6.9],
  ['env.flower.meadow', 2, 'prop.flower_purple', -4.4, -6.6],
  ['env.fern.bracken', 0, 'prop.fern', -2.9, -6.4],
  ['env.fern.bracken', 1, 'prop.plant_low', -1.5, -6.7],
  // Pebbles and eelgrass (the plants brush's stones and water plants), in front of the boulders.
  ['env.rock.pebbles', 0, 'prop.stones', 0.9, -6.5],
  ['env.rock.pebbles', 1, 'prop.stones', 2.2, -6.8],
  ['env.water.eelgrass', 0, 'prop.mn_eelgrass', 3.7, -6.5],
  ['env.water.eelgrass', 1, 'prop.mn_eelgrass', 5.0, -6.5],
];

const EYE = 1.7;

interface LabState {
  ready: boolean;
  view: string;
  stats: () => unknown;
  set: (o: { lod?: number | null; wireframe?: boolean; colliders?: boolean; wind?: boolean; tier?: string; rows?: 'both' | 'new' | 'old'; view?: string }) => Promise<void>;
  frames: () => number;
  /** The scene and its shadow generator (tests and debugging). */
  scene: Scene;
  shadows: ShadowGenerator;
}

export async function openEnvLab(engine: AbstractEngine, canvas: HTMLCanvasElement, rendererKind: string): Promise<void> {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.62, 0.72, 0.82, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.0035;
  scene.fogColor = new Color3(0.66, 0.74, 0.82);
  scene.ambientColor = new Color3(0.25, 0.27, 0.3);
  const camera = new UniversalCamera('cam', new Vector3(0, EYE, -16), scene);
  camera.minZ = 0.05;
  camera.maxZ = 1500;
  camera.fov = 1.2;
  camera.speed = 0.6;
  camera.setTarget(new Vector3(0, EYE, 10));
  camera.attachControl(canvas, true);
  camera.keysUp.push(87);
  camera.keysDown.push(83);
  camera.keysLeft.push(65);
  camera.keysRight.push(68);
  const hemi = new HemisphericLight('hemi', new Vector3(0.2, 1, 0.1), scene);
  hemi.intensity = 0.75;
  hemi.groundColor = new Color3(0.32, 0.3, 0.24);
  // From the front right, so shadows fall toward the viewer's left and the faces we look at are lit.
  const sun = new DirectionalLight('sun', new Vector3(-0.55, -0.7, 0.45), scene);
  sun.position = new Vector3(80, 110, -70);
  sun.intensity = 2.4;
  sun.diffuse = new Color3(1, 0.96, 0.88);
  const shadows = new ShadowGenerator(2048, sun);
  shadows.usePercentageCloserFiltering = true;
  shadows.bias = 0.001;
  shadows.normalBias = 0.02;
  shadows.darkness = 0.15;
  sun.shadowMinZ = 1;
  sun.shadowMaxZ = 400;
  sun.autoCalcShadowZBounds = true;
  try {
    const dome = new PhotoDome('sky', versioned(`${import.meta.env.BASE_URL}skies/clear.jpg`), { resolution: 32, size: 1200 }, scene);
    dome.mesh.isPickable = false;
  } catch {
    // No sky picture: the clear colour stands in.
  }
  const ground = CreateGround('ground', { width: 600, height: 600, subdivisions: 2 }, scene);
  const gm = new PBRMaterial('ground_mat', scene);
  gm.albedoColor = new Color3(0.23, 0.26, 0.14);
  gm.metallic = 0;
  gm.roughness = 1;
  ground.material = gm;
  ground.receiveShadows = true;
  ground.isPickable = false;

  // ---------------------------------------------------------------- the lineup

  const entities: PropEntity[] = [];
  const oldEntities: PropEntity[] = [];
  const ent = (id: string, model: string, pos: [number, number, number], variant?: number, yaw = 0, scale = 1): PropEntity => ({ id, kind: 'prop', model, position: pos, yaw, scale, solid: true, tint: null, ...(variant !== undefined ? { variant } : {}) }) as PropEntity;
  for (const [i, [model, variant, old, x, z]] of LINEUP.entries()) {
    if (model === 'env.flower.meadow') {
      // A few plants of each colour; the old flower as one piece.
      for (let k = 0; k < 5; k++) entities.push(ent(`flower_${i}_${k}`, model, [x + ((k % 3) - 1) * 0.3, 0, z + Math.floor(k / 3) * 0.32 + (k % 2) * 0.08], variant, k * 2.1, 0.9 + (k % 3) * 0.12));
      oldEntities.push(ent(`old_${i}`, old, [x + BEFORE_X, 0, z]));
      continue;
    }
    if (model === 'env.water.eelgrass') {
      // A small bed of clumps (as the plants brush grows it); the old eelgrass as one piece.
      for (let k = 0; k < 4; k++) entities.push(ent(`eelgrass_${i}_${k}`, model, [x + ((k % 2) - 0.5) * 0.42, 0, z + Math.floor(k / 2) * 0.38], variant, k * 1.9, 0.9 + (k % 3) * 0.15));
      oldEntities.push(ent(`old_${i}`, old, [x + BEFORE_X, 0, z]));
      continue;
    }
    if (model === 'env.grass.clump') {
      // Grass as a small patch of clumps; the old tuft as one piece.
      for (let k = 0; k < 30; k++) entities.push(ent(`grass_${i}_${k}`, model, [x + ((k % 5) - 2) * 0.28, 0, z + Math.floor(k / 5) * 0.3], variant, k * 1.3, 0.9 + (k % 3) * 0.15));
      oldEntities.push(ent(`old_${i}`, old, [x + BEFORE_X, 0, z + 0.6]));
      continue;
    }
    entities.push(ent(`lineup_${i}`, model, [x, 0, z], variant));
    oldEntities.push(ent(`old_${i}`, old, [x + BEFORE_X, 0, z]));
  }
  // A cliff wall of four panels side by side (the seams), the old cliff pieces in the "before" set.
  for (let k = 0; k < 4; k++) {
    entities.push(ent(`wall_${k}`, 'env.cliff.face', [-12 + k * 8, 0, 30], k % 2));
    for (let j = 0; j < 2; j++) oldEntities.push(ent(`old_wall_${k}_${j}`, 'prop.cliff', [-14 + k * 8 + j * 4 + BEFORE_X, 0, 30]));
  }
  // Distance rows: oaks, pines and boulders going back from 10 to 170 m (levels of detail, the far stand-in).
  for (const [i, d] of [10, 25, 40, 60, 85, 110, 140, 170].entries()) {
    entities.push(ent(`row_oak_${i}`, 'env.broadleaf.oak', [-46, 0, d], 0, i));
    entities.push(ent(`row_pine_${i}`, 'env.conifer.pine_tall', [-36, 0, d], 0, i));
    entities.push(ent(`row_rock_${i}`, 'env.rock.boulder_angular', [-29, 0, d], 1, i));
  }

  const env = new EnvironmentVisuals(scene, 'high');
  // Browser tests (?test=1) see a still picture: no wind.
  const still = new URLSearchParams(location.search).has('test');
  if (still) env.materials.setWind(0);
  await env.setPlacements(entities, null);
  const library = new ModelLibrary(scene);
  const oldNodes = oldEntities.map((e) => createPropNode(scene, library, e, `old_${e.id}`, true, false, null));

  // Shadows from everything near, onto everything.
  const casters = () => {
    const list = shadows.getShadowMap()!.renderList!;
    list.length = 0;
    for (const m of scene.meshes) {
      if (m === ground || !m.isEnabled() || m.name === 'sky' || m.name.startsWith('env_collider') || (m.metadata as { castsNoShadow?: boolean } | null)?.castsNoShadow) continue;
      if (m.getTotalVertices() > 0) list.push(m);
      m.receiveShadows = true;
    }
  };

  // ---------------------------------------------------------------- colliders

  await initPhysics();
  const doc: MapDocument = { ...newMapDocument('Environment lab'), entities } as MapDocument;
  let colliderLines: LinesMesh | null = null;
  const showColliders = (on: boolean) => {
    colliderLines?.dispose();
    colliderLines = null;
    if (!on) return;
    const physics = new PhysicsWorld([], null, environmentShapes(doc));
    const r = physics.world.debugRender();
    const lines: Vector3[][] = [];
    for (let i = 0; i < r.vertices.length; i += 6) lines.push([new Vector3(r.vertices[i]!, r.vertices[i + 1]!, r.vertices[i + 2]!), new Vector3(r.vertices[i + 3]!, r.vertices[i + 4]!, r.vertices[i + 5]!)]);
    colliderLines = CreateLineSystem('env_colliders', { lines }, scene);
    colliderLines.color = new Color3(1, 0.25, 0.2);
    colliderLines.isPickable = false;
    physics.free();
  };

  // ---------------------------------------------------------------- views

  /** Camera position and target per view; each "before-…" view frames the old set exactly as its view frames the new. */
  const base: Record<string, [[number, number, number], [number, number, number]]> = {
    lineup: [[0, EYE, -20], [0, 3, 4]],
    trees: [[0, EYE, -12], [0, 4.5, 4]],
    small: [[0, EYE, -11], [-1, 0.6, -4]],
    plants: [[-4.6, EYE, -8.2], [-4.2, 0.5, -4]],
    rocks: [[3.2, EYE, -8.6], [3.1, 0.6, -4]],
    ground: [[2.9, EYE, -9.4], [2.9, 0.15, -6.6]],
    cliffs: [[2, EYE, 15], [4, 4, 30]],
  };
  const VIEWS: Record<string, [Vector3, Vector3]> = {};
  for (const [k, [p, t]] of Object.entries(base)) {
    VIEWS[k] = [new Vector3(...p), new Vector3(...t)];
    VIEWS[`before-${k}`] = [new Vector3(p[0] + BEFORE_X, p[1], p[2]), new Vector3(t[0] + BEFORE_X, t[1], t[2])];
  }
  VIEWS['lod-row'] = [new Vector3(-40, EYE, -4), new Vector3(-40, 3, 60)];
  VIEWS.overview = [new Vector3(-30, 28, -45), new Vector3(0, 0, 20)];

  // ---------------------------------------------------------------- panel

  const panel = document.createElement('div');
  panel.id = 'envlab-panel';
  panel.style.cssText = 'position:fixed;left:8px;top:8px;width:300px;background:rgba(18,21,26,.88);padding:10px 12px;font:12px/1.45 system-ui;color:#e6e6e6;border-radius:6px;z-index:10';
  const opt = (id: string, label: string, values: string[]) => `<label style="display:block;margin:3px 0">${label} <select id="${id}">${values.map((v) => `<option>${v}</option>`).join('')}</select></label>`;
  const chk = (id: string, label: string, on = false) => `<label style="display:block;margin:3px 0"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}> ${label}</label>`;
  panel.innerHTML = `<b style="font-size:13px">Environment lab</b> <span style="color:#9ab">${rendererKind} · eye height ${EYE} m</span>
${opt('el-view', 'View', Object.keys(VIEWS))}
${opt('el-lod', 'Level of detail', ['auto', '0', '1', '2', '3'])}
${opt('el-tier', 'Tier', ['high', 'medium', 'low'])}
${opt('el-rows', 'Show', ['both', 'new', 'old'])}
${chk('el-wire', 'Wireframe')}${chk('el-coll', 'Colliders')}${chk('el-wind', 'Wind', !still)}
<div id="el-stats" style="margin-top:6px;color:#9ab;white-space:pre"></div>
<div style="color:#789;margin-top:4px">WASD + drag to look · species: ${ENV_RENDER.map((s) => s.id.slice(4)).join(', ')}</div>`;
  document.body.append(panel);
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

  const state: LabState = {
    ready: false,
    view: 'lineup',
    stats: () => ({ env: env.stats(), draws: (engine as unknown as { _drawCalls?: { current: number } })._drawCalls?.current ?? null, meshes: scene.getActiveMeshes().length }),
    frames: () => frames,
    scene,
    shadows,
    set: async (o) => {
      if (o.lod !== undefined) env.forceLevel(o.lod);
      if (o.wireframe !== undefined) {
        env.materials.setWireframe(o.wireframe);
        for (const n of oldNodes) for (const m of n.getChildMeshes()) if (m.material) m.material.wireframe = o.wireframe;
      }
      if (o.colliders !== undefined) showColliders(o.colliders);
      if (o.wind !== undefined) env.materials.setWind(o.wind ? env.currentTier.wind || 1 : 0);
      if (o.tier !== undefined) env.setTier(o.tier);
      if (o.rows !== undefined) {
        for (const n of oldNodes) n.setEnabled(o.rows !== 'new');
        for (const m of scene.meshes) if (m.name.startsWith('env_') && !m.name.startsWith('env_tpl') && m.name !== 'env_colliders') m.isVisible = o.rows !== 'old';
      }
      if (o.view && VIEWS[o.view]) {
        state.view = o.view;
        $<HTMLSelectElement>('el-view').value = o.view;
        const [p, t] = VIEWS[o.view]!;
        camera.position.copyFrom(p);
        camera.setTarget(t);
      }
      env.update(camera.position);
      casters();
    },
  };
  $('el-view').onchange = () => void state.set({ view: $<HTMLSelectElement>('el-view').value });
  $('el-lod').onchange = () => {
    const v = $<HTMLSelectElement>('el-lod').value;
    void state.set({ lod: v === 'auto' ? null : Number(v) });
  };
  $('el-tier').onchange = () => void state.set({ tier: $<HTMLSelectElement>('el-tier').value });
  $('el-rows').onchange = () => void state.set({ rows: $<HTMLSelectElement>('el-rows').value as 'both' });
  $('el-wire').onchange = () => void state.set({ wireframe: $<HTMLInputElement>('el-wire').checked });
  $('el-coll').onchange = () => void state.set({ colliders: $<HTMLInputElement>('el-coll').checked });
  $('el-wind').onchange = () => void state.set({ wind: $<HTMLInputElement>('el-wind').checked });

  // Wait for the old pieces' models, then draw.
  await Promise.all(oldNodes.map((n) => new Promise<void>((done) => {
    const t0 = performance.now();
    const check = () => (n.getChildMeshes().length || performance.now() - t0 > 8000 ? done() : setTimeout(check, 50));
    check();
  })));
  const view = new URLSearchParams(location.search).get('view');
  await state.set({ view: view && VIEWS[view] ? view : 'lineup' });
  let frames = 0;
  let statsAt = 0;
  scene.onAfterRenderObservable.add(() => {
    frames++;
    env.update(camera.position);
    if (performance.now() - statsAt > 500) {
      statsAt = performance.now();
      const s = env.stats();
      $('el-stats').textContent = `copies ${s.copies} · batches ${s.drawnBatches}/${s.batches}\nper level ${s.perLevel.join(' / ')}\nenv triangles ${s.triangles}\nactive meshes ${scene.getActiveMeshes().length}`;
    }
  });
  window.addEventListener('resize', () => engine.resize());
  engine.runRenderLoop(() => scene.render());
  await scene.whenReadyAsync();
  casters();
  state.ready = true;
  (window as unknown as { __envlab: LabState }).__envlab = state;
}
