import type { Scene } from '@babylonjs/core/scene';
import { Effect } from '@babylonjs/core/Materials/effect';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Constants } from '@babylonjs/core/Engines/constants';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder';
import { GLINT, aimDir, glintStrength, stepGlint } from './scopeFeel.ts';
import { reduceFlashing } from './reduceFlashing.ts';
import { HIP_FOV } from './optics.ts';

/**
 * The sniper glint as drawn (scopeFeel.ts GLINT; docs/GUNPLAY_SPEC.md §15, "Scope feel"): for each player aiming a
 * sniper scope your way, one small square facing the camera at the front of their scope, its pixels a soft round
 * point of light worked out in the shader (no texture: as sharp as the screen at any size). It is drawn in the scene
 * with the scene's own depth, so a wall, a hill or a crate in front hides it, at no cost of its own; it writes no
 * depth and takes no fog. One draw of four vertices per glint; nothing at all while nobody glints.
 *
 * Steady and soft: its level only eases (up over 0.15 s, half a second with Reduce flashing on; down over 0.25 s),
 * never blinks, and its colour stays under High's bloom threshold (0.82), so it never blooms. A thin dark ring round
 * it keeps it readable against a bright sky. With Reduce flashing on it is dimmer still.
 */

/** The light's colour (each channel under the bloom threshold). */
export const GLINT_COLOUR: readonly [number, number, number] = [0.8, 0.77, 0.66];

const NAME = 'scopeGlint';

Effect.ShadersStore[`${NAME}VertexShader`] = `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform mat4 worldViewProjection;
varying vec2 vUv;
void main() {
  vUv = uv * 2.0 - 1.0;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}`;

// A soft core, and round it a faint dark ring (premultiplied: the ring only darkens what is behind it).
Effect.ShadersStore[`${NAME}FragmentShader`] = `
precision highp float;
varying vec2 vUv;
uniform float level;
uniform vec3 colour;
void main() {
  float r = length(vUv);
  float core = 1.0 - smoothstep(0.08, 0.62, r);
  float ring = smoothstep(0.35, 0.65, r) * (1.0 - smoothstep(0.72, 1.0, r)) * 0.35;
  float a = level * (core + ring * (1.0 - core));
  if (a < 0.004) discard;
  gl_FragColor = vec4(colour * core * level, a);
}`;

/** A scoped player, for the glint: their slot, their eye and their aim. */
export interface GlintSource {
  slot: number;
  eye: { x: number; y: number; z: number };
  yaw: number;
  pitch: number;
}

export class ScopeGlints {
  private readonly glints = new Map<number, { mesh: Mesh; level: number }>();
  private material: ShaderMaterial | null = null;
  private readonly levels = new WeakMap<object, number>();

  constructor(private readonly scene: Scene) {}

  /** How many glints are drawn now, and the brightest one's level (tests, the flicker check). */
  get shown(): { count: number; level: number } {
    let level = 0;
    for (const g of this.glints.values()) level = Math.max(level, g.level);
    return { count: this.glints.size, level };
  }

  private mat(): ShaderMaterial {
    if (this.material) return this.material;
    const m = new ShaderMaterial(NAME, this.scene, { vertex: NAME, fragment: NAME }, { attributes: ['position', 'uv'], uniforms: ['worldViewProjection', 'level', 'colour'], needAlphaBlending: true });
    m.alphaMode = Constants.ALPHA_PREMULTIPLIED;
    m.backFaceCulling = false;
    m.disableDepthWrite = true;
    m.fogEnabled = false;
    m.setVector3('colour', { x: GLINT_COLOUR[0], y: GLINT_COLOUR[1], z: GLINT_COLOUR[2] } as never);
    m.onBindObservable.add((mesh) => m.getEffect()?.setFloat('level', this.levels.get(mesh) ?? 0));
    return (this.material = m);
  }

  /**
   * A frame: `sources` the players who seem to be aiming a sniper scope, `viewer` your eye (the camera), `fov` the
   * camera's field of view now (a glint grows a little through your own scope, not as much as the zoom).
   */
  update(dt: number, viewer: { x: number; y: number; z: number }, fov: number, sources: readonly GlintSource[]): void {
    const calm = reduceFlashing();
    const top = calm ? GLINT.calm.level : GLINT.normal.level;
    const seen = new Set<number>();
    for (const s of sources) {
      const want = glintStrength(s.eye, s.yaw, s.pitch, viewer) * top;
      let g = this.glints.get(s.slot);
      if (!g && want <= 0) continue;
      if (!g) {
        const mesh = CreatePlane(`${NAME}_${s.slot}`, { size: 2 }, this.scene);
        mesh.material = this.mat();
        mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
        mesh.isPickable = false;
        mesh.alwaysSelectAsActiveMesh = true;
        this.glints.set(s.slot, (g = { mesh, level: 0 }));
      }
      seen.add(s.slot);
      g.level = stepGlint(g.level, want, dt, calm);
      this.place(g.mesh, s, viewer, fov);
      this.levels.set(g.mesh, g.level);
    }
    for (const [slot, g] of this.glints) {
      // Gone from the list (they lowered the scope, died, left): it fades where it was.
      if (!seen.has(slot)) g.level = stepGlint(g.level, 0, dt, calm);
      this.levels.set(g.mesh, g.level);
      if (g.level <= 0) {
        g.mesh.dispose();
        this.glints.delete(slot);
      }
    }
  }

  private place(mesh: Mesh, s: GlintSource, viewer: { x: number; y: number; z: number }, fov: number): void {
    const a = aimDir(s.yaw, s.pitch);
    const p = { x: s.eye.x + a.x * GLINT.ahead, y: s.eye.y + a.y * GLINT.ahead, z: s.eye.z + a.z * GLINT.ahead };
    const d = { x: viewer.x - p.x, y: viewer.y - p.y, z: viewer.z - p.z };
    const dist = Math.max(0.001, Math.hypot(d.x, d.y, d.z));
    // A hand's width toward you, so the gun it sits on does not cut it in half.
    const pull = Math.min(0.25, dist * 0.5) / dist;
    mesh.position.set(p.x + d.x * pull, p.y + d.y * pull, p.z + d.z * pull);
    // The same size on screen at any distance; through a scope the square root of its zoom larger.
    const zoom = Math.tan(HIP_FOV / 2) / Math.tan(Math.max(0.02, fov) / 2);
    mesh.scaling.setAll((dist * GLINT.radius) / Math.sqrt(Math.max(1, zoom)));
  }

  dispose(): void {
    for (const g of this.glints.values()) g.mesh.dispose();
    this.glints.clear();
    this.material?.dispose();
    this.material = null;
  }
}
