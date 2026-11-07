import type { Scene } from '@babylonjs/core/scene';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Constants } from '@babylonjs/core/Engines/constants';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Vec3 } from '@tiletrigger/shared';
import { ease } from './reduceFlashing.ts';

/** Seconds a beam takes to come up, how long it holds after the last arc, and how long it takes to fade. */
export const STEADY_ARC = { attack: 0.1, hold: 0.3, release: 0.35 } as const;
/** Ends glide toward the newest points at this rate (per second): no jump from one arc's targets to the next's. */
const FOLLOW = 14;
/** Marks effect meshes: the atmosphere leaves them out of shadows (atmosphere.ts `worldly`). */
const EFFECT = { effect: true };

interface Segment {
  core: Mesh;
  glow: Mesh;
  a: Vector3;
  b: Vector3;
  ta: Vector3;
  tb: Vector3;
  level: number;
  live: boolean;
}
interface Beam {
  segments: Segment[];
  end: Mesh;
  endAt: Vector3;
  endTo: Vector3;
  /** When the last arc came (ms). */
  last: number;
  coreMat: StandardMaterial;
  glowMat: StandardMaterial;
}

/**
 * Lightning with flashing reduced (reduceFlashing.ts): instead of a new crackling bolt for every arc (an Arc Caster
 * arcs about 7 times a second, an arc turret 10, a fence 2 a person), each source holds one steady beam of light
 * along its newest jumps: a thin bright core in a soft glow, and a glow where it lands. Its ends glide after the
 * targets as they move; it comes up over a tenth of a second, holds while the arcs keep coming and fades over a
 * third of a second after the last one. Nothing strobes and nothing jumps from one frame to the next.
 */
export class SteadyArcs {
  private readonly beams = new Map<string, Beam>();
  private last = 0;

  constructor(private readonly scene: Scene) {}

  /** An arc from `key` (a shooter, a turret, a stretch of fence) through `pts`, in `color`. */
  hit(key: string, pts: readonly Vec3[], color: string, now = performance.now()): void {
    if (pts.length < 2) return;
    let beam = this.beams.get(key);
    if (!beam) {
      const c = Color3.FromHexString(color);
      const coreMat = this.material(`steadyArcCore_${key}`, Color3.Lerp(c, Color3.White(), 0.35));
      const glowMat = this.material(`steadyArcGlow_${key}`, c.scale(0.85));
      const end = CreateSphere(`steadyArcEnd_${key}`, { diameter: 1, segments: 8 }, this.scene);
      end.material = glowMat;
      this.prepare(end);
      const last = pts[pts.length - 1]!;
      beam = { segments: [], end, endAt: new Vector3(last.x, last.y, last.z), endTo: new Vector3(last.x, last.y, last.z), last: now, coreMat, glowMat };
      this.beams.set(key, beam);
    }
    beam.last = now;
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      let s = beam.segments[i];
      if (!s) {
        const core = CreateCylinder(`steadyArc_${key}_${i}`, { diameter: 1, height: 1, tessellation: 6 }, this.scene);
        const glow = CreateCylinder(`steadyArcGlow_${key}_${i}`, { diameter: 1, height: 1, tessellation: 8 }, this.scene);
        core.material = beam.coreMat;
        glow.material = beam.glowMat;
        this.prepare(core);
        this.prepare(glow);
        s = { core, glow, a: new Vector3(a.x, a.y, a.z), b: new Vector3(b.x, b.y, b.z), ta: new Vector3(), tb: new Vector3(), level: 0, live: true };
        beam.segments[i] = s;
      }
      s.ta.set(a.x, a.y, a.z);
      s.tb.set(b.x, b.y, b.z);
      s.live = true;
    }
    for (let i = pts.length - 1; i < beam.segments.length; i++) beam.segments[i]!.live = false;
    const end = pts[pts.length - 1]!;
    beam.endTo.set(end.x, end.y, end.z);
  }

  /** Each frame: ends glide, beams come up, hold and fade; faded ones go. */
  update(now = performance.now()): void {
    const dt = Math.min(0.1, Math.max(0, (now - (this.last || now)) / 1000));
    this.last = now;
    const k = Math.min(1, dt * FOLLOW);
    for (const [key, beam] of this.beams) {
      const held = now - beam.last < STEADY_ARC.hold * 1000;
      let shown = 0;
      for (const s of beam.segments) {
        s.level = ease(s.level, held && s.live ? 1 : 0, dt, 1 / STEADY_ARC.attack, 1 / STEADY_ARC.release);
        s.a.addInPlace(s.ta.subtract(s.a).scaleInPlace(k));
        s.b.addInPlace(s.tb.subtract(s.b).scaleInPlace(k));
        const on = s.level > 0.001;
        s.core.setEnabled(on);
        s.glow.setEnabled(on);
        if (!on) continue;
        shown = Math.max(shown, s.level);
        place(s.core, s.a, s.b, 0.035);
        place(s.glow, s.a, s.b, 0.16);
      }
      beam.endAt.addInPlace(beam.endTo.subtract(beam.endAt).scaleInPlace(k));
      beam.end.setEnabled(shown > 0.001);
      beam.end.position.copyFrom(beam.endAt);
      beam.end.scaling.setAll(0.3);
      // One level for the beam's materials: the strongest of its segments (they come and go together).
      beam.coreMat.alpha = 0.9 * shown;
      beam.glowMat.alpha = 0.32 * shown;
      if (!held && shown <= 0.001) {
        for (const s of beam.segments) {
          s.core.dispose();
          s.glow.dispose();
        }
        beam.end.dispose();
        beam.coreMat.dispose();
        beam.glowMat.dispose();
        this.beams.delete(key);
      }
    }
  }

  /** Beams drawn now (tests). */
  get count(): number {
    return this.beams.size;
  }

  dispose(): void {
    for (const beam of this.beams.values()) {
      for (const s of beam.segments) {
        s.core.dispose();
        s.glow.dispose();
      }
      beam.end.dispose();
      beam.coreMat.dispose();
      beam.glowMat.dispose();
    }
    this.beams.clear();
  }

  private material(name: string, color: Color3): StandardMaterial {
    const m = new StandardMaterial(name, this.scene);
    m.emissiveColor = color;
    m.diffuseColor = Color3.Black();
    m.specularColor = Color3.Black();
    m.disableLighting = true;
    m.alphaMode = Constants.ALPHA_ADD;
    m.alpha = 0;
    m.disableDepthWrite = true;
    return m;
  }

  private prepare(mesh: Mesh): void {
    mesh.isPickable = false;
    mesh.metadata = EFFECT;
    mesh.rotationQuaternion = Quaternion.Identity();
    mesh.setEnabled(false);
  }
}

/** Lay a unit cylinder (along Y) from `a` to `b`, `width` across. */
function place(mesh: Mesh, a: Vector3, b: Vector3, width: number): void {
  const d = b.subtract(a);
  const len = Math.max(0.01, d.length());
  mesh.position.copyFrom(a.add(b).scaleInPlace(0.5));
  mesh.scaling.set(width, len, width);
  Quaternion.FromUnitVectorsToRef(Vector3.Up(), d.scaleInPlace(1 / len), mesh.rotationQuaternion!);
}
