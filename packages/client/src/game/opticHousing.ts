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
import { MARK_COLOUR, MARK_GAIN, MARK_GAIN_CALM, RING_TICK, glassCentre, glassHalf, hasGlass, opticOf, ringWidth, type CarriedOptic } from './optics.ts';
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
    m.diffuseColor = new Color3(0.085, 0.09, 0.1);
    m.specularColor = new Color3(0.22, 0.22, 0.24);
    m.specularPower = 28;
    m.backFaceCulling = false;
    bodies.set(scene, m);
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
 * code. `own`: your own first-person gun, which gets the glass and its mark and is drawn in the gun's rendering
 * group; everyone else's copy is the housing alone. Returns the housing's root (disposed with the gun).
 */
export function attachOptic(scene: Scene, gun: TransformNode, def: WeaponDefinition, own: boolean, optic: CarriedOptic | null = opticOf(def)): TransformNode | null {
  if (!hasGlass(optic)) return null;
  const root = new TransformNode(`optic_${def.id}`, scene);
  root.parent = gun;
  root.position.set(optic.mount.at[0], optic.mount.at[1], optic.mount.at[2]);
  root.scaling.setAll(optic.mount.scale);
  const parts = optic.kind.housing === 'tube' ? tubeParts(scene, optic) : frameParts(scene, optic);
  const body = Mesh.MergeMeshes(parts, true, true)!;
  body.name = 'opticBody';
  body.material = bodyMaterial(scene);
  body.parent = root;
  body.isPickable = false;
  if (own) {
    body.renderingGroupId = 1;
    const [hw, hh] = glassHalf(optic);
    const c = glassCentre(optic);
    const glass = optic.kind.housing === 'tube' ? CreateDisc('opticGlass', { radius: hh, tessellation: 40, sideOrientation: Mesh.DOUBLESIDE }, scene) : CreatePlane('opticGlass', { width: hw * 2, height: hh * 2, sideOrientation: Mesh.DOUBLESIDE }, scene);
    glass.material = glassMaterial(scene, optic);
    // On the gun itself (not under the housing's scale): the window's middle, a little ahead of the housing's.
    glass.parent = gun;
    glass.position.set(c[0], c[1], c[2] + optic.kind.glass.length * optic.mount.scale * (optic.kind.housing === 'tube' ? 0.3 : 0.22));
    glass.renderingGroupId = 1;
    glass.isPickable = false;
    glass.metadata = { effect: true };
  }
  return root;
}
