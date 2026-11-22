import type { Scene } from '@babylonjs/core/scene';
import { Effect } from '@babylonjs/core/Materials/effect';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Constants } from '@babylonjs/core/Engines/constants';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector4 } from '@babylonjs/core/Maths/math.vector';
import type { WeaponDefinition } from '@tiletrigger/shared';
import { MARK_COLOUR, MARK_GAIN, MARK_GAIN_CALM, RING_TICK, builtHousing, glassCentre, glassHalf, hasGlass, opticOf, ringWidth, type CarriedOptic } from './optics.ts';
import { reduceFlashing } from './reduceFlashing.ts';

/**
 * The optics built in code (docs/GUNPLAY_SPEC.md §15, "Optics by gun"): a red dot's tube and a holographic sight's
 * frame, standing on the gun's top at the mount the optics table gives (shared optics.generated.ts), sized to the gun.
 * No models from outside: a few boxes, a tube and its rims, merged into one mesh in one dark material.
 *
 * In your own hands the housing carries its **glass**, and the mark is drawn on it, not on the HUD: the glass's
 * material works out, for each of its pixels, where that pixel is in the view (the tangents of its angles from the
 * view's axis, from its clip position and the camera's projection) and lights the pixels of the mark: a dot, or a
 * ring with four ticks and a dot. The mark is therefore on the point of aim itself (the middle of the view: rounds
 * leave the eye along the aim), stays there while the gun bobs and kicks, shows only where the glass is, and is as
 * sharp as the screen at any resolution (its edge is one pixel of the view, from the same numbers). Steady: no
 * flicker, no bloom (its brightness is capped, lower with Reduce flashing), no halo.
 */

Effect.ShadersStore.ttOpticGlassVertexShader = `
precision highp float;
attribute vec3 position;
uniform mat4 worldViewProjection;
varying vec4 vClip;
void main(void) {
  gl_Position = worldViewProjection * vec4(position, 1.0);
  vClip = gl_Position;
}`;
// mark: x the dot's radius, y the ring's (0: none), z one pixel of the view, w the mark's brightness (all but w
// tangents of the angle from the view's axis). lens: xy the reciprocals of the projection's scales, z the tint's alpha.
Effect.ShadersStore.ttOpticGlassFragmentShader = `
precision highp float;
uniform vec4 mark;
uniform vec4 lens;
uniform vec3 colour;
uniform vec3 tint;
varying vec4 vClip;
void main(void) {
  vec2 t = (vClip.xy / vClip.w) * lens.xy;
  float r = length(t);
  float px = mark.z;
  float a = 1.0 - smoothstep(mark.x - px * 0.5, mark.x + px * 0.5, r);
  if (mark.y > 0.0) {
    float w = max(px * 1.2, mark.y * ${ringWidth(1).toFixed(4)});
    float ring = 1.0 - smoothstep(w * 0.5 - px * 0.5, w * 0.5 + px * 0.5, abs(r - mark.y));
    float across = min(abs(t.x), abs(t.y));
    float tick = (1.0 - smoothstep(w * 0.5 - px * 0.5, w * 0.5 + px * 0.5, across)) * step(mark.y, r) * (1.0 - smoothstep(mark.y * ${RING_TICK.toFixed(3)} - px * 0.5, mark.y * ${RING_TICK.toFixed(3)} + px * 0.5, r));
    a = max(a, max(ring, tick));
  }
  a *= mark.w;
  gl_FragColor = vec4(mix(tint, colour, a), max(a, lens.z));
}`;

/** The sight sheet's audit switches the marks off for a frame, to find them by what they change (tools/sightSheet.ts). */
export const markAudit = { off: false };

/** The housings' one material for a scene. */
const bodies = new WeakMap<Scene, StandardMaterial>();
function bodyMaterial(scene: Scene): StandardMaterial {
  let m = bodies.get(scene);
  if (!m) {
    m = new StandardMaterial('opticBody', scene);
    m.diffuseColor = new Color3(0.2, 0.21, 0.23);
    m.emissiveColor = new Color3(0.07, 0.074, 0.082);
    m.specularColor = new Color3(0.3, 0.3, 0.32);
    m.specularPower = 28;
    m.backFaceCulling = false;
    bodies.set(scene, m);
  }
  return m;
}

/** A window's clip sheet (attachOptic): its mesh name, by which the view finds it, switches it on while aimed and draws it first. */
export const CLIP_NAME = 'opticClip';
const clips = new WeakMap<Scene, StandardMaterial>();
function clipMaterial(scene: Scene): StandardMaterial {
  let m = clips.get(scene);
  if (!m) {
    m = new StandardMaterial('opticClipMat', scene);
    m.disableColorWrite = true;
    m.disableLighting = true;
    clips.set(scene, m);
  }
  return m;
}

/** The glass with its mark: one material per optic kind in a scene (the mark's sizes are the kind's). */
const glasses = new WeakMap<Scene, Map<string, ShaderMaterial>>();
function glassMaterial(scene: Scene, o: CarriedOptic): ShaderMaterial {
  let byKind = glasses.get(scene);
  if (!byKind) glasses.set(scene, (byKind = new Map()));
  let m = byKind.get(o.id);
  if (m) return m;
  m = new ShaderMaterial(`opticGlass_${o.id}`, scene, { vertex: 'ttOpticGlass', fragment: 'ttOpticGlass' }, { attributes: ['position'], uniforms: ['worldViewProjection', 'mark', 'lens', 'colour', 'tint'], needAlphaBlending: true });
  m.backFaceCulling = false;
  m.disableDepthWrite = true;
  m.alphaMode = Constants.ALPHA_COMBINE;
  m.setColor3('colour', new Color3(...MARK_COLOUR));
  m.setColor3('tint', new Color3(0.2, 0.3, 0.34));
  const mark = new Vector4();
  const lens = new Vector4();
  const kind = o.kind;
  const mat = m;
  m.onBindObservable.add(() => {
    const cam = scene.activeCamera;
    if (!cam) return;
    const p = cam.getProjectionMatrix().m;
    const [sx, sy] = [Math.abs(p[0]!) || 1, Math.abs(p[5]!) || 1];
    // One pixel of the view, as a tangent: the screen's half-height is 1 / sy.
    const px = 2 / (sy * Math.max(1, scene.getEngine().getRenderHeight()));
    // A mark never thinner than the screen can draw: at low resolutions the dot keeps a pixel and a half of radius.
    mark.set(Math.max(kind.mark!.dot, px * 1.5), kind.reticle === 'ring' ? (kind.mark!.ring ?? 0) : 0, px, markAudit.off ? 0 : reduceFlashing() ? MARK_GAIN_CALM : MARK_GAIN);
    lens.set(1 / sx, 1 / sy, 0.07, 0);
    // Straight to the bound effect: the material's own stored values go up before this observer runs, a frame late.
    const fx = mat.getEffect();
    fx.setVector4('mark', mark);
    fx.setVector4('lens', lens);
  });
  byKind.set(o.id, m);
  return m;
}

/** A box from its low corner's middle: `w` across, `h` up from `y`, `d` along, centred on x and on `z`. */
function box(scene: Scene, w: number, h: number, d: number, x: number, y: number, z: number): Mesh {
  const b = CreateBox('opticPart', { width: w, height: h, depth: d }, scene);
  b.position.set(x, y + h / 2, z);
  return b;
}

/** A red dot's tube (scale 1, its foot's middle at the origin, +Z the barrel): a foot, a riser, a thin tube with a rim at each end, two turrets. */
function tubeParts(scene: Scene, o: CarriedOptic): Mesh[] {
  const g = o.kind.glass!;
  const r = g.half[1];
  const out = r + 0.0025;
  const parts: Mesh[] = [];
  parts.push(box(scene, 0.03, 0.006, g.length * 0.86, 0, 0, 0));
  parts.push(box(scene, 0.018, g.rise - out - 0.004, g.length * 0.6, 0, 0.005, 0));
  const tube = CreateCylinder('opticPart', { height: g.length, diameter: out * 2, tessellation: 28, cap: Mesh.NO_CAP, sideOrientation: Mesh.DOUBLESIDE }, scene);
  tube.rotation.x = Math.PI / 2;
  tube.position.set(0, g.rise, 0);
  parts.push(tube);
  for (const z of [-g.length / 2, g.length / 2]) {
    const rim = CreateTorus('opticPart', { diameter: (r + out) * 1.0, thickness: (out - r) * 1.2, tessellation: 28 }, scene);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, g.rise, z);
    parts.push(rim);
  }
  const top = CreateCylinder('opticPart', { height: 0.009, diameter: 0.014, tessellation: 12 }, scene);
  top.position.set(0, g.rise + out + 0.003, 0.004);
  parts.push(top);
  const side = CreateCylinder('opticPart', { height: 0.009, diameter: 0.014, tessellation: 12 }, scene);
  side.rotation.z = Math.PI / 2;
  side.position.set(out + 0.003, g.rise, 0.004);
  parts.push(side);
  return parts;
}

/**
 * The 2x optic's tube (the `magtube` housing, scale 1, its foot's middle at the origin, +Z the barrel): a foot and two
 * rings on it, a long tube whose rear end is the eyepiece (its clear radius the glass's: the view looks through it,
 * opticView.ts) with a wider eyepiece bell, a larger objective bell at the front, and a turret on top. The view's
 * depth-only disc at the eyepiece keeps the tube's inside out of the picture.
 */
function scopeParts(scene: Scene, o: CarriedOptic): Mesh[] {
  const g = o.kind.glass!;
  const r = g.half[1];
  const wall = r + 0.0028;
  const foot = g.foot ?? g.length;
  const parts: Mesh[] = [];
  parts.push(box(scene, 0.026, 0.006, foot * 0.92, 0, 0, 0));
  for (const z of [-foot * 0.32, foot * 0.32]) {
    parts.push(box(scene, 0.014, g.rise - wall - 0.004, 0.012, 0, 0.005, z));
    const ring = CreateTorus('opticPart', { diameter: wall * 2 + 0.003, thickness: 0.004, tessellation: 24 }, scene);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, g.rise, z);
    parts.push(ring);
  }
  const tube = CreateCylinder('opticPart', { height: g.length * 0.62, diameter: wall * 2, tessellation: 28, cap: Mesh.NO_CAP, sideOrientation: Mesh.DOUBLESIDE }, scene);
  tube.rotation.x = Math.PI / 2;
  tube.position.set(0, g.rise, 0);
  parts.push(tube);
  // The eyepiece bell (rear) and the objective bell (front): short cones out from the tube.
  const bell = (z: number, len: number, near: number, far: number) => {
    const c = CreateCylinder('opticPart', { height: len, diameterTop: far * 2, diameterBottom: near * 2, tessellation: 28, cap: Mesh.NO_CAP, sideOrientation: Mesh.DOUBLESIDE }, scene);
    c.rotation.x = Math.PI / 2;
    c.position.set(0, g.rise, z);
    return c;
  };
  const rear = g.length * 0.19;
  parts.push(bell(-g.length * 0.31 - rear / 2, rear, wall * 1.18, wall));
  const front = g.length * 0.19;
  parts.push(bell(g.length * 0.31 + front / 2, front, wall, wall * 1.42));
  for (const [z, d] of [[-g.length / 2, wall * 1.18], [g.length / 2, wall * 1.42]] as const) {
    const rim = CreateTorus('opticPart', { diameter: d * 2, thickness: 0.0035, tessellation: 28 }, scene);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, g.rise, z);
    parts.push(rim);
  }
  const top = CreateCylinder('opticPart', { height: 0.01, diameter: 0.016, tessellation: 14 }, scene);
  top.position.set(0, g.rise + wall + 0.004, 0.002);
  parts.push(top);
  return parts;
}

/** A holographic sight's frame: a long low body, and at its front a hooded window: two posts and a top bar. */
function frameParts(scene: Scene, o: CarriedOptic): Mesh[] {
  const g = o.kind.glass!;
  const [hw, hh] = g.half;
  const bar = 0.0045;
  const sill = g.rise - hh;
  const zf = g.length * 0.22;
  const deep = g.length * 0.34;
  const parts: Mesh[] = [];
  parts.push(box(scene, hw * 2 + bar * 2, sill, g.length, 0, 0, 0));
  for (const x of [-(hw + bar / 2), hw + bar / 2]) parts.push(box(scene, bar, hh * 2 + bar, deep, x, sill, zf));
  parts.push(box(scene, hw * 2 + bar * 2, bar, deep, 0, sill + hh * 2, zf));
  // The battery's cap on the right of the body.
  const cap = CreateCylinder('opticPart', { height: 0.012, diameter: sill * 0.7, tessellation: 12 }, scene);
  cap.rotation.z = Math.PI / 2;
  cap.position.set(hw + bar + 0.004, sill * 0.5, -g.length * 0.2);
  parts.push(cap);
  return parts;
}

/**
 * Build `def`'s optic on its model `gun` (a node in the model's own space), or nothing when it carries none built in
 * code (`optic`: the one it carries, by default its own; a player's pick is optics.ts opticFor). `own`: your own first-person gun, which gets the glass and its mark and is drawn in the gun's rendering
 * group; everyone else's copy is the housing alone. Returns the housing's root (disposed with the gun).
 */
export function attachOptic(scene: Scene, gun: TransformNode, def: WeaponDefinition, own: boolean, optic: CarriedOptic | null = opticOf(def)): TransformNode | null {
  if (!builtHousing(optic)) return null;
  if (!own && optic.window) return null;
  const root = new TransformNode(`optic_${def.id}`, scene);
  root.parent = gun;
  // The model's own open sight (`window`): nothing to build, the glass goes in its window.
  const mount = optic.mount && !optic.window ? optic.mount : null;
  if (mount) {
    root.position.set(mount.at[0], mount.at[1], mount.at[2]);
    root.scaling.setAll(mount.scale);
    const parts = optic.kind.housing === 'tube' ? tubeParts(scene, optic) : optic.kind.housing === 'magtube' ? scopeParts(scene, optic) : frameParts(scene, optic);
    const body = Mesh.MergeMeshes(parts, true, true)!;
    body.name = 'opticBody';
    body.material = bodyMaterial(scene);
    body.parent = root;
    body.isPickable = false;
    if (own) body.renderingGroupId = 1;
  }
  // The 2x optic has no glass of its own: its eyepiece is looked through (the view's mask) and its reticle is the HUD's.
  if (own && hasGlass(optic)) {
    const [hw, hh] = glassHalf(optic);
    const c = glassCentre(optic);
    const round = !!mount && optic.kind.housing === 'tube';
    const glass = round ? CreateDisc('opticGlass', { radius: hh, tessellation: 40, sideOrientation: Mesh.DOUBLESIDE }, scene) : CreatePlane('opticGlass', { width: hw * 2, height: hh * 2, sideOrientation: Mesh.DOUBLESIDE }, scene);
    glass.material = glassMaterial(scene, optic);
    // On the gun itself (not under the housing's scale): the window's middle, a little ahead of a built housing's.
    glass.parent = gun;
    glass.position.set(c[0], c[1], c[2] + (mount ? optic.kind.glass.length * mount.scale * (round ? 0.3 : 0.22) : 0));
    glass.renderingGroupId = 1;
    glass.isPickable = false;
    glass.metadata = { effect: true };
    if (optic.window) {
      // The window's clip (content/optics.json `window`): a depth-only sheet over the opening, just behind the glass,
      // drawn first in the gun's rendering group while aimed (CLIP_NAME: view.ts, the sight sheet), so nothing of the
      // gun behind the opening is drawn there: loose scraps of a model inside its own sight box stay out of the
      // sight picture, and the world shows through as it should.
      const clip = CreatePlane(CLIP_NAME, { width: hw * 2, height: hh * 2, sideOrientation: Mesh.DOUBLESIDE }, scene);
      clip.material = clipMaterial(scene);
      clip.parent = gun;
      clip.position.set(c[0], c[1], c[2] + 0.0015);
      clip.renderingGroupId = 1;
      clip.isPickable = false;
      clip.metadata = { effect: true };
      clip.setEnabled(false);
    }
  }
  return root;
}
