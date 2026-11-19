import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Ray } from '@babylonjs/core/Culling/ray';
import '@babylonjs/core/Culling/ray';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { CORE_WEAPONS, PLAYER, armsLookFor, getWeapon, type WeaponDefinition } from '@tiletrigger/shared';
import { SIGHT_EXCLUDED, SIGHT_FITS } from '@tiletrigger/shared/sightFit';
import { CharacterLibrary } from '../content/characters.ts';
import { ModelLibrary } from '../content/models.ts';
import { CharacterAnimator, type MotionState } from '../game/characterAnimator.ts';
import { createViewCamera, poseCamera } from '../game/cameraPose.ts';
import { fitFirstPersonArms } from '../game/firstPersonArms.ts';
import { DEFAULT_FOV } from '../game/view.ts';
import { ADS_FOV, SIGHT_TOLERANCE_DEG, aimPlacement, blendPlacement, placed, sightError, type GunBounds, type GunPlacement } from '../game/sightPose.ts';

/** How a weapon aims on the sheet: its own sights (a fit), its optic, the old placement (no usable sights), or not at all. */
export type SightStatus = 'fitted' | 'optic' | 'unfitted' | 'scope' | 'none';

/** One weapon's row on the sheet. */
export interface SightRow {
  id: string;
  name: string;
  status: SightStatus;
  /** The fit's kind (`aperture`, `notch`, `post`, `bead`), or why there is none. */
  detail: string;
  corrected: boolean;
}

/** What the audit measures of the shown weapon at full aim (degrees). */
export interface SightAudit {
  id: string;
  fitted: boolean;
  /** The fit's rear and front points off the aim, placed by the game's own placement (null: no fit). */
  placed: number | null;
  /**
   * The drawn gun against the aim: how far above (+) or below (−) the crosshair's centre the gun's top edge is on the
   * centre column, from rays cast at the meshes as drawn. A gun aimed through or over its sights reads 0 (the front
   * sight's top is the edge); null when the column holds no gun within a degree.
   */
  drawn: number | null;
  /** The front sight's middle left (−) or right (+) of the centre, from the same rays (null: no blade to find the middle of). */
  drawnAcross: number | null;
  /** Nearest drawn geometry to the eye inside the view (m): under the camera's near plane (0.1 m) it would be cut. */
  nearest: number;
  pass: boolean;
}

const statusOf = (def: WeaponDefinition): SightStatus => (def.view.optic ? 'optic' : SIGHT_FITS[def.id] ? 'fitted' : def.view.zoomFov ? 'scope' : def.kind === 'melee' || def.slot === 0 ? 'none' : 'unfitted');

/**
 * Sight check (team tool, `?mode=sights`; docs/GUNPLAY_SPEC.md §15): every hand-held weapon aiming down its sights
 * from the player's eye, as the game places it (game/sightPose.ts, the first-person arms), with the crosshair's centre
 * marked and a target 15 m off, so a gun whose sights are off the aim shows at a glance. ←/→ step through the
 * weapons, A toggles the aim, B the placement from before the fit; `window.__sights` drives it (pictures, the audit).
 */
export async function openSightSheet(engine: AbstractEngine): Promise<void> {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.62, 0.7, 0.78, 1);
  new HemisphericLight('hemi', new Vector3(0.3, 1, 0.4), scene).intensity = 0.95;
  new DirectionalLight('sun', new Vector3(-0.4, -1, 0.6), scene).intensity = 0.8;
  const flat = (name: string, colour: Color3) => {
    const m = new StandardMaterial(name, scene);
    m.diffuseColor = colour;
    m.specularColor = Color3.Black();
    return m;
  };
  const ground = CreateGround('ground', { width: 200, height: 200 }, scene);
  ground.material = flat('groundMat', new Color3(0.36, 0.42, 0.33));
  // What you aim at: a body-sized board 15 m off with its chest on the aim, rings round the point of aim.
  const board = CreateBox('board', { width: 0.5, height: 1.8, depth: 0.05 }, scene);
  board.position.set(0, 0.9, 15);
  board.material = flat('boardMat', new Color3(0.82, 0.8, 0.74));
  for (const [i, r] of [0.2, 0.12, 0.04].entries()) {
    const ring = CreateDisc(`ring${i}`, { radius: r, tessellation: 48 }, scene);
    ring.position.set(0, PLAYER.eyeHeight, 15 - 0.03 - i * 0.002);
    ring.material = flat(`ringMat${i}`, i === 2 ? new Color3(0.85, 0.15, 0.1) : i === 1 ? new Color3(0.95, 0.95, 0.95) : new Color3(0.15, 0.15, 0.18));
  }

  const eye = createViewCamera('eye', scene);
  eye.minZ = 0.1;
  eye.position.set(0, PLAYER.eyeHeight, 0);
  poseCamera(eye, 0, 0);
  scene.activeCamera = eye;
  window.addEventListener('resize', () => engine.resize());

  const characters = new CharacterLibrary(scene, { atlas: true });
  const models = new ModelLibrary(scene);
  const still: MotionState = { speed: 0, moveAngle: 0, airborne: false, alive: true, pitch: 0, celebrate: false };

  // The crosshair's centre (a thin cross with an open middle) and the weapon's line.
  const mark = document.createElement('div');
  mark.id = 'sight-mark';
  mark.style.cssText = 'position:fixed;left:50%;top:50%;width:0;height:0;pointer-events:none;z-index:5';
  for (const [w, h, x, y] of [[14, 1, -22, 0], [14, 1, 8, 0], [1, 14, 0, -22], [1, 14, 0, 8]] as const) {
    const arm = document.createElement('div');
    arm.style.cssText = `position:absolute;width:${w}px;height:${h}px;left:${x}px;top:${y}px;background:#35ff6a;box-shadow:0 0 1px #000`;
    mark.append(arm);
  }
  const label = document.createElement('div');
  label.id = 'sight-label';
  label.style.cssText = 'position:fixed;left:12px;top:10px;font:13px/1.4 system-ui,sans-serif;color:#fff;text-shadow:0 1px 2px #000;pointer-events:none;z-index:5;white-space:pre';
  document.body.append(mark, label);

  const rows: SightRow[] = Object.values(CORE_WEAPONS).map((def) => {
    const status = statusOf(def);
    const fit = SIGHT_FITS[def.id];
    return { id: def.id, name: def.displayName, status, detail: fit ? fit.kind : status === 'optic' ? 'optic' : (SIGHT_EXCLUDED[def.id] ?? ''), corrected: !!fit?.corrected };
  });
  /** The weapons that aim with the gun in view: the sheet's pages. */
  const pages = rows.filter((r) => r.status === 'fitted' || r.status === 'optic' || r.status === 'unfitted');

  let frames = 0;
  let shown: { def: WeaponDefinition; node: TransformNode; viewRoot: TransformNode; bounds: GunBounds; anim: CharacterAnimator | null; dispose(): void } | null = null;
  let state = { ads: 1, fitted: true, arms: true };
  let placement: GunPlacement | null = null;

  const place = () => {
    if (!shown) return;
    const aim = aimPlacement(shown.def, shown.bounds, state.fitted);
    placement = blendPlacement(shown.def, aim, state.ads);
    shown.viewRoot.position.set(placement.x, placement.y, placement.z);
    shown.viewRoot.rotation.set(placement.pitch, placement.yaw, 0);
    // The game's fields of view: the hip's, easing to the sights' as the gun comes up.
    eye.fov = DEFAULT_FOV * (1 + (ADS_FOV - 1) * state.ads);
    const row = rows.find((r) => r.id === shown!.def.id)!;
    label.textContent = `${row.name}  (${row.id})\n${row.status}${row.status === 'fitted' ? `: ${row.detail}${row.corrected ? ', corrected by hand' : ''}` : row.detail ? `: ${row.detail}` : ''}\n${state.fitted ? 'as fitted' : 'before the fit'} · aim ${Math.round(state.ads * 100)} %   ←/→ weapon · A aim · B before/after`;
  };

  engine.runRenderLoop(() => {
    shown?.anim?.update(1 / 30, still);
    scene.render();
    frames++;
  });
  const settle = async (n: number) => {
    const until = frames + n;
    while (frames < until) await new Promise((r) => setTimeout(r, 10));
  };

  type ShowOptions = { ads?: number; fitted?: boolean; arms?: boolean; look?: string };
  /** One weapon is loaded at a time: a `show` waits for the one before it. */
  let queue: Promise<void> = Promise.resolve();
  /** Show `weapon` from the eye: `ads` 0 (hip) to 1 (aimed), `fitted: false` for the placement from before the fit. */
  function show(weapon: string, opts: ShowOptions = {}): Promise<void> {
    queue = queue.then(() => showNow(weapon, opts)).catch((e) => console.error(e));
    return queue;
  }
  async function showNow(weapon: string, opts: ShowOptions): Promise<void> {
    state = { ads: opts.ads ?? 1, fitted: opts.fitted ?? true, arms: opts.arms ?? true };
    if (shown?.def.id !== weapon || (shown.anim !== null) !== state.arms) {
      shown?.dispose();
      shown = null;
      const def = getWeapon(weapon);
      const viewRoot = new TransformNode('sight_view', scene);
      viewRoot.parent = eye;
      const node = await models.instantiate(def.view.model, 'sight_viewmodel');
      // Measured as the view measures it (view.ts setViewmodel): before parenting, in the model's own space.
      const b = node.getHierarchyBoundingVectors(true);
      const bounds = { sightTop: b.max.y, stockZ: b.min.z };
      node.parent = viewRoot;
      for (const m of node.getChildMeshes()) m.renderingGroupId = 1;
      let anim: CharacterAnimator | null = null;
      let armsRoot: TransformNode | null = null;
      if (state.arms) {
        armsRoot = new TransformNode('sight_arms', scene);
        armsRoot.parent = eye;
        const ch = await characters.create({ look: armsLookFor(opts.look ?? 'core.ranger'), armsOnly: true }, 'sight_arms_ch');
        fitFirstPersonArms(ch, armsRoot);
        anim = new CharacterAnimator(scene, ch);
        anim.gripExternal(node, def.view.hold);
      }
      shown = {
        def,
        node,
        viewRoot,
        bounds,
        anim,
        dispose: () => {
          anim?.dispose();
          node.dispose();
          viewRoot.dispose();
          armsRoot?.dispose();
        },
      };
    }
    place();
    await settle(state.arms ? 30 : 4);
  }

  /** The gun's meshes as drawn, for the audit's rays. */
  const gunMeshes = (): AbstractMesh[] => (shown ? shown.node.getChildMeshes(false).filter((m) => m.isEnabled() && m.getTotalVertices() > 0) : []);

  /** The distance at which a ray from the eye, `up` and `right` degrees off the aim, first meets the gun (null: it misses). */
  function castAt(meshes: AbstractMesh[], up: number, right: number): number | null {
    const [u, r] = [(up * Math.PI) / 180, (right * Math.PI) / 180];
    const dir = new Vector3(Math.tan(r), Math.tan(u), 1).normalize();
    const ray = new Ray(eye.position.clone(), dir, 5);
    let best: number | null = null;
    for (const m of meshes) {
      const hit = ray.intersectsMesh(m, false);
      if (hit.hit && (best === null || hit.distance < best)) best = hit.distance;
    }
    return best;
  }

  /** Measure the shown weapon at full aim (call after `show(id)`): see SightAudit. */
  function audit(): SightAudit | null {
    if (!shown) return null;
    const def = shown.def;
    const fit = state.fitted ? SIGHT_FITS[def.id] : undefined;
    const aim = aimPlacement(def, shown.bounds, state.fitted);
    scene.render();
    const meshes = gunMeshes();
    for (const m of meshes) m.computeWorldMatrix(true);
    const STEP = 0.005;
    // The gun's top edge on the centre column: up from the centre while it is hit, else down until it is.
    let drawn: number | null = null;
    let at: number | null = null;
    if (castAt(meshes, 0, 0) !== null) {
      for (let a = STEP; a <= 1 && drawn === null; a += STEP) if (castAt(meshes, a, 0) === null) drawn = a - STEP;
    } else {
      for (let a = -STEP; a >= -1 && drawn === null; a -= STEP) if (castAt(meshes, a, 0) !== null) drawn = a + STEP;
    }
    // The blade that edge belongs to: the run of hits at its own distance, just under the edge, either side of the centre.
    let drawnAcross: number | null = null;
    if (drawn !== null) {
      const under = drawn - 0.02;
      at = castAt(meshes, under, 0);
      if (at !== null) {
        const same = (d: number | null) => d !== null && Math.abs(d - at!) < 0.03;
        let l = 0;
        let r = 0;
        while (l > -0.5 && same(castAt(meshes, under, l - STEP))) l -= STEP;
        while (r < 0.5 && same(castAt(meshes, under, r + STEP))) r += STEP;
        if (l > -0.5 && r < 0.5) drawnAcross = (l + r) / 2;
      }
    }
    // Nothing drawn inside the view may come nearer than the camera's near plane.
    let nearest = Infinity;
    const half = (eye.fov / 2) * (180 / Math.PI);
    const wide = (Math.atan(Math.tan(eye.fov / 2) * engine.getAspectRatio(eye)) * 180) / Math.PI;
    for (let u = -half; u <= half; u += half / 12) {
      for (let r = -wide; r <= wide; r += wide / 16) {
        const d = castAt(meshes, u, r);
        if (d !== null) nearest = Math.min(nearest, d * Math.cos((u * Math.PI) / 180) * Math.cos((r * Math.PI) / 180));
      }
    }
    const placedError = fit ? sightError(fit, aim) : null;
    const round = (v: number | null) => (v === null ? null : Math.round(v * 1000) / 1000);
    const pass = !!fit && placedError! <= SIGHT_TOLERANCE_DEG && drawn !== null && Math.abs(drawn) <= SIGHT_TOLERANCE_DEG && Math.abs(drawnAcross ?? 0) <= SIGHT_TOLERANCE_DEG && nearest > eye.minZ;
    return { id: def.id, fitted: !!fit, placed: round(placedError), drawn: round(drawn), drawnAcross: round(drawnAcross), nearest: Math.round(nearest * 1000) / 1000, pass };
  }

  /** Where the shown fit's rear and front points are on screen (CSS pixels from the centre: x right, y up), as placed. */
  function sightPoints(): { rear: [number, number]; front: [number, number] } | null {
    const fit = shown && SIGHT_FITS[shown.def.id];
    if (!fit || !placement) return null;
    const k = engine.getRenderHeight() / engine.getHardwareScalingLevel() / window.devicePixelRatio / 2 / Math.tan(eye.fov / 2);
    const px = (p: readonly [number, number, number]): [number, number] => {
      const c = placed(p, placement!);
      return [(c[0] / c[2]) * k, (c[1] / c[2]) * k];
    };
    return { rear: px(fit.rear), front: px(fit.front) };
  }

  const api = {
    /** Every weapon with how it aims. */
    list: (): SightRow[] => rows,
    /** The weapons the sheet has a page for (they aim with the gun in view). */
    pages: (): SightRow[] => pages,
    show,
    audit,
    sightPoints,
    /** The crosshair mark and the label on or off (pictures). */
    marks: (on: boolean, text = on) => {
      mark.style.display = on ? '' : 'none';
      label.style.display = text ? '' : 'none';
    },
    tolerance: SIGHT_TOLERANCE_DEG,
    get frames() {
      return frames;
    },
  };
  Object.assign(window, { __sights: api });

  let page = Math.max(0, pages.findIndex((r) => r.id === (new URLSearchParams(location.search).get('w') ?? 'core.rifle')));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      page = (page + (e.key === 'ArrowRight' ? 1 : pages.length - 1)) % pages.length;
      void show(pages[page]!.id, state);
    } else if (e.key.toLowerCase() === 'a') void show(pages[page]!.id, { ...state, ads: state.ads > 0.5 ? 0 : 1 });
    else if (e.key.toLowerCase() === 'b') void show(pages[page]!.id, { ...state, fitted: !state.fitted });
  });
  await show(pages[page]!.id);
}
