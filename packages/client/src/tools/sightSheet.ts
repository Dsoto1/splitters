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
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Ray } from '@babylonjs/core/Culling/ray';
import { RenderingGroup } from '@babylonjs/core/Rendering/renderingGroup';
import '@babylonjs/core/Culling/ray';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { CORE_WEAPONS, PLAYER, armsLookFor, getWeapon, type MatchRules, type WeaponDefinition } from '@tiletrigger/shared';
import { WEAPON_OPTICS, type OpticKindId } from '@tiletrigger/shared/optics';
import { SIGHT_EXCLUDED, SIGHT_FITS } from '@tiletrigger/shared/sightFit';
import { CharacterLibrary } from '../content/characters.ts';
import { ModelLibrary } from '../content/models.ts';
import { CharacterAnimator, type MotionState } from '../game/characterAnimator.ts';
import { createViewCamera, poseCamera } from '../game/cameraPose.ts';
import { fitFirstPersonArms } from '../game/firstPersonArms.ts';
import { DEFAULT_FOV } from '../game/view.ts';
import { ADS_FOV, SIGHT_TOLERANCE_DEG, aimPlacement, blendPlacement, placed, sightError, sightPicture, type GunBounds, type GunPlacement } from '../game/sightPose.ts';
import { eyepieceOf, glassCentre, glassHalf, hasGlass, opticNone, opticOf, type CarriedOptic } from '../game/optics.ts';
import { CLIP_NAME, attachOptic, markAudit } from '../game/opticHousing.ts';
import { opticFrame } from '../game/opticView.ts';
import { holdoverFor } from '../game/holdover.ts';
import { drawHoldover } from '../game/hud.ts';

/**
 * How a weapon aims on the sheet: its own sights (a fit), a glass built on it (a red dot, a holographic sight), its
 * model's optic, the full-screen scope, the old placement (neither sights nor an optic), or not at all.
 */
export type SightStatus = 'fitted' | 'glass' | 'optic' | 'unfitted' | 'scope' | 'none';

/** One weapon's row on the sheet. */
export interface SightRow {
  id: string;
  name: string;
  status: SightStatus;
  /** The fit's kind (`aperture`, `notch`, `post`, `bead`), or why there is none. */
  detail: string;
  corrected: boolean;
  /** The optic it carries (content/optics.json): its kind and name, its reticle, its magnification over the hip view; null: none. */
  optic: { id: OpticKindId; name: string; reticle: string; mag: number; allowed: readonly OpticKindId[] } | null;
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
  /**
   * The optic's reticle against the aim (degrees off the view's middle): a glass's mark found on the drawn frame (what
   * it changes when switched off), a scope's or an optic's from where its centre is laid out. null: no reticle.
   */
  reticle: number | null;
  /** A glass's window: its half-height as a share of the screen's, and how much larger the gun is drawn for it. */
  window: number | null;
  picture: number;
  pass: boolean;
}

const statusOf = (def: WeaponDefinition): SightStatus => (def.view.optic ? 'optic' : def.view.zoomFov ? 'scope' : hasGlass(opticOf(def)) ? 'glass' : SIGHT_FITS[def.id] ? 'fitted' : def.kind === 'melee' || def.slot === 0 ? 'none' : 'unfitted');
/** The sheet's ballistics for holdover marks: the official default. */
const RULES: Pick<MatchRules, 'ballistics'> = { ballistics: 'standard' };

/**
 * Sight check (team tool, `?mode=sights`; docs/GUNPLAY_SPEC.md §15): every hand-held weapon aiming down its sights
 * or through its optic from the player's eye, as the game places it (game/sightPose.ts, optics.ts, the first-person
 * arms), with the crosshair's centre marked and a target 15 m off, so a gun whose sights or reticle are off the aim
 * shows at a glance. Scopes show their own view (the reticle and its holdover marks at the scope's zoom). ←/→ step
 * through the weapons, A toggles the aim, B the placement from before the fit, M the green centre mark; `window.__sights`
 * drives it (pictures, the audit).
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
  const targets: Mesh[] = [board];
  for (const [i, r] of [0.2, 0.12, 0.04].entries()) {
    const ring = CreateDisc(`ring${i}`, { radius: r, tessellation: 48 }, scene);
    ring.position.set(0, PLAYER.eyeHeight, 15 - 0.03 - i * 0.002);
    targets.push(ring);
    ring.material = flat(`ringMat${i}`, i === 2 ? new Color3(0.85, 0.15, 0.1) : i === 1 ? new Color3(0.95, 0.95, 0.95) : new Color3(0.15, 0.15, 0.18));
  }

  const eye = createViewCamera('eye', scene);
  eye.minZ = 0.1;
  eye.position.set(0, PLAYER.eyeHeight, 0);
  poseCamera(eye, 0, 0);
  scene.activeCamera = eye;
  window.addEventListener('resize', () => engine.resize());

  // A model optic's depth-only disc goes first in the gun's rendering group (view.ts).
  scene.setRenderingOrder(1, (a, b) => {
    const ma = a.getMesh().name === 'sight_mask' || a.getMesh().name === CLIP_NAME;
    const mb = b.getMesh().name === 'sight_mask' || b.getMesh().name === CLIP_NAME;
    return ma === mb ? RenderingGroup.PainterSortCompare(a, b) : ma ? -1 : 1;
  });
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
    const o = opticOf(def);
    const fov = o ? (o.mag ? 2 * Math.atan(Math.tan(DEFAULT_FOV / 2) / o.mag) : DEFAULT_FOV * (o.kind.adsFov ?? 1)) : DEFAULT_FOV * ADS_FOV;
    const optic = o ? { id: o.id, name: o.kind.name, reticle: o.kind.reticle, mag: Math.round((Math.tan(DEFAULT_FOV / 2) / Math.tan(fov / 2)) * 100) / 100, allowed: (WEAPON_OPTICS[def.id]?.allowed ?? []) } : null;
    return { id: def.id, name: def.displayName, status, detail: status === 'fitted' && fit ? fit.kind : status === 'optic' ? 'optic' : (opticNone(def) ?? SIGHT_EXCLUDED[def.id] ?? ''), corrected: status === 'fitted' && !!fit?.corrected, optic };
  });
  /** The weapons that aim: the sheet's pages (melee, tools and mounted guns have none). */
  const pages = rows.filter((r) => r.status !== 'none');

  // A scope's or a model optic's reticle: the game's own markup and styles (index.html #scope, #optic), taken out of the
  // hidden HUD (this page has no match).
  const scopeEl = document.getElementById('scope')!;
  const opticEl = document.getElementById('optic')!;
  for (const el of [scopeEl, opticEl]) {
    el.hidden = true;
    el.style.cssText += ';position:fixed;inset:0;z-index:4;animation:none';
    el.querySelector('[id$=breath]')?.remove();
    document.body.append(el);
  }
  const scopeMarks = scopeEl.querySelector<SVGElement>('.holdover')!;
  const opticMarks = opticEl.querySelector<SVGElement>('.holdover')!;

  let frames = 0;
  let shown: { def: WeaponDefinition; node: TransformNode; viewRoot: TransformNode; frame: TransformNode; bounds: GunBounds; anim: CharacterAnimator | null; arms: TransformNode | null; optic: CarriedOptic | null; mask: Mesh | null; dispose(): void } | null = null;
  let state: { ads: number; fitted: boolean; arms: boolean; optic?: OpticKindId; picture?: number } = { ads: 1, fitted: true, arms: true };
  let placement: GunPlacement | null = null;
  let picture = 1;

  const place = () => {
    if (!shown) return;
    const def = shown.def;
    const aim = aimPlacement(def, shown.bounds, state.fitted, shown.optic);
    placement = blendPlacement(def, aim, state.ads);
    shown.viewRoot.position.set(placement.x, placement.y, placement.z);
    shown.viewRoot.rotation.set(placement.pitch, placement.yaw, 0);
    // The game's fields of view: the hip's, easing to the sights' as the gun comes up.
    eye.fov = DEFAULT_FOV * (1 + (ADS_FOV - 1) * state.ads);
    // The sight picture (optics.ts): the gun drawn larger about the view axis as it comes up, as view.ts does.
    const full = state.picture ?? (state.fitted ? sightPicture(def, aim, shown.optic) : 1);
    picture = 1 + (full - 1) * state.ads * state.ads * (3 - 2 * state.ads);
    shown.frame.scaling.set(picture, picture, 1);
    scopeEl.hidden = true;
    opticEl.hidden = true;
    shown.viewRoot.setEnabled(true);
    shown.mask?.setEnabled(false);
    shown.arms?.setEnabled(true);
    // A sight window's clip is on once the gun is most of the way up, as in view.ts.
    shown.node.getChildMeshes().find((m) => m.name === CLIP_NAME)?.setEnabled(state.fitted && state.ads > 0.7);
    const aimed = state.ads >= 1 && state.fitted;
    if (aimed && def.view.zoomFov) {
      // A scope: its own view, the gun hidden behind the overlay (session.ts).
      eye.fov = def.view.zoomFov;
      shown.viewRoot.setEnabled(false);
      shown.arms?.setEnabled(false);
      scopeEl.hidden = false;
      scopeEl.dataset.reticle = shown.optic?.kind.reticle ?? 'fine';
      drawHoldover(scopeMarks, holdoverFor(def, RULES, Math.tan(eye.fov / 2) * Math.min(1, innerWidth / Math.max(1, innerHeight))), 1);
    } else if (aimed && eyepieceOf(def, shown.optic)) {
      // The model's own optic, or a 2x optic built on its top (opticView.ts), the eye fully on it.
      const eyepiece = eyepieceOf(def, shown.optic)!;
      const f = opticFrame(eyepiece, DEFAULT_FOV * ADS_FOV, DEFAULT_FOV, 1);
      eye.fov = f.worldFov;
      shown.frame.scaling.set(f.squash, f.squash, 1);
      shown.mask?.setEnabled(true);
      shown.arms?.setEnabled(false);
      opticEl.hidden = false;
      opticEl.style.setProperty('--r', `${(f.lens * 50).toFixed(3)}vh`);
      opticEl.style.setProperty('--o', '1');
      opticEl.dataset.reticle = shown.optic?.kind.reticle ?? eyepiece.reticle ?? 'duplex';
      const marks = holdoverFor(def, RULES, Math.tan(f.worldFov / 2) * f.lens, 3.6);
      drawHoldover(opticMarks, marks, 1.4);
      opticEl.classList.toggle('holdover-on', marks.length > 0);
    }
    const row = rows.find((r) => r.id === def.id)!;
    const o = shown.optic;
    const carries = o ? `${o.kind.name}${o.id !== row.optic?.id ? ' (not its default)' : ''} · ${(Math.tan(DEFAULT_FOV / 2) / Math.tan(eye.fov / 2)).toFixed(2)}x${picture > 1.001 ? ` · gun drawn x${picture.toFixed(2)}` : ''}` : 'no optic: the aim it had';
    label.textContent = `${row.name}  (${row.id})\n${carries}\n${row.status}${row.status === 'fitted' ? `: ${row.detail}${row.corrected ? ', corrected by hand' : ''}` : row.detail ? `: ${row.detail}` : ''}\n${state.fitted ? 'as fitted' : 'before the fit'} · aim ${Math.round(state.ads * 100)} %   ←/→ weapon · A aim · B before/after · M mark`;
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

  type ShowOptions = { ads?: number; fitted?: boolean; arms?: boolean; look?: string; optic?: OpticKindId; picture?: number };
  /** One weapon is loaded at a time: a `show` waits for the one before it. */
  let queue: Promise<void> = Promise.resolve();
  /** Show `weapon` from the eye: `ads` 0 (hip) to 1 (aimed), `fitted: false` for the placement from before the fit. */
  function show(weapon: string, opts: ShowOptions = {}): Promise<void> {
    queue = queue.then(() => showNow(weapon, opts)).catch((e) => console.error(e));
    return queue;
  }
  async function showNow(weapon: string, opts: ShowOptions): Promise<void> {
    state = { ads: opts.ads ?? 1, fitted: opts.fitted ?? true, arms: opts.arms ?? true, ...(opts.optic ? { optic: opts.optic } : {}), ...(opts.picture ? { picture: opts.picture } : {}) };
    const carried = opticOf(getWeapon(weapon), state.optic);
    if (shown?.def.id !== weapon || (shown.anim !== null) !== state.arms || shown.optic?.id !== carried?.id) {
      shown?.dispose();
      shown = null;
      const def = getWeapon(weapon);
      // As view.ts hangs the gun: under a node that draws it larger about the view axis (the sight picture, an optic's frame).
      const frame = new TransformNode('sight_frame', scene);
      frame.parent = eye;
      const viewRoot = new TransformNode('sight_view', scene);
      viewRoot.parent = frame;
      const node = await models.instantiate(def.view.model, 'sight_viewmodel');
      // Measured as the view measures it (view.ts setViewmodel): before parenting, in the model's own space.
      const b = node.getHierarchyBoundingVectors(true);
      const bounds = { sightTop: b.max.y, stockZ: b.min.z };
      node.parent = viewRoot;
      for (const m of node.getChildMeshes()) m.renderingGroupId = 1;
      attachOptic(scene, node, def, true, carried);
      // A model optic's glass: a depth-only disc, drawn first, keeps the tube behind it out of the view (view.ts setOptic).
      let mask: Mesh | null = null;
      const eyepiece = eyepieceOf(def, carried);
      if (eyepiece) {
        mask = CreateDisc('sight_mask', { radius: eyepiece.radius, tessellation: 48, sideOrientation: Mesh.DOUBLESIDE }, scene);
        const mat = new StandardMaterial('sight_maskMat', scene);
        mat.disableColorWrite = true;
        mat.disableLighting = true;
        mask.material = mat;
        mask.renderingGroupId = 1;
        mask.parent = viewRoot;
        mask.position.set(...eyepiece.eye);
        mask.setEnabled(false);
      }
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
        frame,
        bounds,
        anim,
        arms: armsRoot,
        optic: carried,
        mask,
        dispose: () => {
          anim?.dispose();
          node.dispose();
          viewRoot.dispose();
          armsRoot?.dispose();
          frame.dispose();
        },
      };
    }
    place();
    await settle(state.arms ? 30 : 4);
  }

  /** The gun's meshes as drawn, for the audit's rays (not its glass: the eye looks through it). */
  const gunMeshes = (): AbstractMesh[] => (shown ? shown.node.getChildMeshes(false).filter((m) => m.isEnabled() && m.getTotalVertices() > 0 && m.name !== 'opticGlass' && m.name !== CLIP_NAME) : []);

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
  async function audit(): Promise<SightAudit | null> {
    if (!shown) return null;
    const def = shown.def;
    const glass = state.fitted && hasGlass(shown.optic) ? shown.optic : null;
    const fit = state.fitted && !glass ? SIGHT_FITS[def.id] : undefined;
    const aim = aimPlacement(def, shown.bounds, state.fitted, shown.optic);
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
    // The reticle against the aim: a glass's mark as drawn, a scope's or an optic's as laid out.
    const scoped = !scopeEl.hidden ? scopeEl : !opticEl.hidden ? opticEl : null;
    const reticle = glass ? await markOffset() : scoped ? reticleOffset(scoped) : null;
    const window = glass ? (glassHalf(glass)[1] * picture) / (glassCentre(glass)[2] + aim.z) / Math.tan(eye.fov / 2) : null;
    const sightsPass = !!fit && placedError! <= SIGHT_TOLERANCE_DEG && drawn !== null && Math.abs(drawn) <= SIGHT_TOLERANCE_DEG && Math.abs(drawnAcross ?? 0) <= SIGHT_TOLERANCE_DEG;
    // A glass: its mark on the aim, and nothing of the gun on the aim through it. A scope: its reticle on the aim.
    const opticPass = reticle !== null && reticle <= SIGHT_TOLERANCE_DEG && (!glass || castAt(meshes, 0, 0) === null);
    const pass = (fit ? sightsPass : glass || scoped ? opticPass : true) && (scoped === scopeEl || nearest > eye.minZ || !!eyepieceOf(def, shown.optic));
    return { id: def.id, fitted: !!fit, placed: round(placedError), drawn: fit ? round(drawn) : null, drawnAcross: fit ? round(drawnAcross) : null, nearest: Math.round(nearest * 1000) / 1000, reticle: round(reticle), window: round(window), picture: Math.round(picture * 100) / 100, pass };
  }

  /**
   * How far a glass's mark is from the view's middle as drawn (degrees): the frame is drawn with the mark and without
   * it, and the pixels that differ are the mark; their middle against the screen's.
   * null when nothing differs: no mark in view.
   */
  async function markOffset(): Promise<number | null> {
    const [w, h] = [engine.getRenderWidth(), engine.getRenderHeight()];
    const half = Math.round(h * 0.12);
    const [x0, y0] = [Math.floor(w / 2) - half, Math.floor(h / 2) - half];
    const grab = async (off: boolean) => {
      markAudit.off = off;
      scene.render();
      return new Uint8Array((await engine.readPixels(x0, y0, half * 2, half * 2)).buffer.slice(0));
    };
    // Without the target: its red middle is the mark's own colour.
    for (const t of targets) t.setEnabled(false);
    const on = await grab(false);
    const off = await grab(true);
    for (const t of targets) t.setEnabled(true);
    markAudit.off = false;
    scene.render();
    let [sum, sx, sy] = [0, 0, 0];
    for (let j = 0; j < half * 2; j++) {
      for (let i = 0; i < half * 2; i++) {
        const k = (j * half * 2 + i) * 4;
        // Each pixel of the mark counts once: weighting by the change would lean towards the darker ground behind it.
        if (Math.abs(on[k]! - off[k]!) + Math.abs(on[k + 1]! - off[k + 1]!) + Math.abs(on[k + 2]! - off[k + 2]!) < 24) continue;
        sum++;
        sx += x0 + i + 0.5 - w / 2;
        sy += y0 + j + 0.5 - h / 2;
      }
    }
    if (!sum) return null;
    return (Math.atan((Math.hypot(sx / sum, sy / sum) * 2 * Math.tan(eye.fov / 2)) / h) * 180) / Math.PI;
  }

  /** How far a scope's or an optic's reticle is from the view's middle as laid out (degrees): its drawing's origin (every reticle's aim point) on the page. */
  function reticleOffset(el: HTMLElement): number | null {
    const svg = el.querySelector('svg');
    const m = svg?.getScreenCTM();
    if (!svg || !m) return null;
    const p = new DOMPoint(0, 0).matrixTransform(m);
    const px = Math.hypot(p.x - innerWidth / 2, p.y - innerHeight / 2);
    return (Math.atan((px * 2 * Math.tan(eye.fov / 2)) / innerHeight) * 180) / Math.PI;
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
    else if (e.key.toLowerCase() === 'm') mark.style.display = mark.style.display === 'none' ? '' : 'none';
  });
  await show(pages[page]!.id);
}
