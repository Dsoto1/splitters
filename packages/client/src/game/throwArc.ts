import type { Scene } from '@babylonjs/core/scene';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { PredictedPath } from '@chronosplit/shared';

/** At most this many dots along the arc. */
const MAX_DOTS = 90;

/**
 * The aiming arc for a throw: dots along the predicted path, a ring where it
 * bounces, and the blast area (or the mine's trigger area) where it ends.
 * Only the level is taken into account; players and vehicles that get in
 * the way after you throw still change where it goes.
 */
export class ThrowArc {
  private readonly dot: Mesh;
  private readonly bounceRing: Mesh;
  private readonly area: Mesh;
  private dots: InstancedMesh[] = [];
  private rings: InstancedMesh[] = [];

  constructor(scene: Scene) {
    const glow = (name: string, hex: string, alpha = 1) => {
      const m = new StandardMaterial(name, scene);
      m.disableLighting = true;
      m.emissiveColor = Color3.FromHexString(hex);
      m.alpha = alpha;
      return m;
    };
    this.dot = CreateSphere('throwDot', { diameter: 0.07, segments: 4 }, scene);
    this.dot.material = glow('throwDotMat', '#ffe27a');
    this.bounceRing = CreateTorus('throwBounce', { diameter: 0.35, thickness: 0.04, tessellation: 16 }, scene);
    this.bounceRing.material = glow('throwBounceMat', '#ffffff');
    this.area = CreateDisc('throwArea', { radius: 1, tessellation: 40 }, scene);
    this.area.material = glow('throwAreaMat', '#ff4a3a', 0.28);
    this.area.rotation.x = Math.PI / 2;
    for (const m of [this.dot, this.bounceRing, this.area]) m.isPickable = false;
    // Instances draw only while their source does: keep the sources on, shrunk away.
    for (const m of [this.dot, this.bounceRing]) {
      m.scaling.setAll(0);
      m.alwaysSelectAsActiveMesh = true;
    }
    this.area.setEnabled(false);
  }

  /** Show the arc for `path`, ending in an area of `radius` metres; null hides it. */
  show(path: PredictedPath | null, radius: number): void {
    if (!path) {
      this.hide();
      return;
    }
    const step = Math.max(1, Math.ceil(path.points.length / MAX_DOTS));
    const wanted = path.points.filter((_, i) => i % step === 0 && i > 0);
    const instance = (src: Mesh) => {
      const i = src.createInstance(`${src.name}I`);
      i.scaling.setAll(1);
      i.isPickable = false;
      return i;
    };
    while (this.dots.length < wanted.length) this.dots.push(instance(this.dot));
    this.dots.forEach((d, i) => {
      const p = wanted[i];
      d.setEnabled(!!p);
      if (p) d.position.set(p.x, p.y, p.z);
    });
    while (this.rings.length < path.bounces.length) this.rings.push(instance(this.bounceRing));
    this.rings.forEach((r, i) => {
      const p = path.bounces[i];
      r.setEnabled(!!p);
      if (p) r.position.set(p.x, p.y + 0.02, p.z);
    });
    this.area.setEnabled(true);
    this.area.position.set(path.end.x, path.end.y + 0.04, path.end.z);
    this.area.scaling.setAll(radius);
  }

  hide(): void {
    for (const d of this.dots) d.setEnabled(false);
    for (const r of this.rings) r.setEnabled(false);
    this.area.setEnabled(false);
  }
}
