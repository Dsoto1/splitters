import type { Scene } from '@babylonjs/core/scene';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { FresnelParameters } from '@babylonjs/core/Materials/fresnelParameters';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import { GLASS, glassCracks, windowPanes, type GlassPane, type MapDocument } from '@tiletrigger/shared';
import { skyReflection } from './reflections.ts';

/**
 * Real glass: one material for every pane in the map (see-through, a slight
 * tint, Fresnel reflection of the sky that grows to a mirror at grazing
 * angles, a sharp sun glint), and every window pane drawn as a thin instance
 * of one box, so a building full of windows is one draw call. No render
 * targets. Cracked bulletproof panes frost over (more opaque, whiter); broken
 * panes drop out of the instance list.
 */
export function glassMaterial(scene: Scene, tint: string = GLASS.tint): StandardMaterial {
  const name = `glassMat_${tint}`;
  const have = scene.getMaterialByName(name) as StandardMaterial | null;
  if (have) return have;
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = Color3.FromHexString(tint);
  m.specularColor = new Color3(1, 1, 1);
  m.specularPower = 220;
  m.emissiveColor = Color3.FromHexString(tint).scale(0.07);
  // Nearly clear face on; the Fresnel terms add opacity and reflection towards grazing angles.
  m.alpha = 0.13;
  m.useSpecularOverAlpha = true;
  m.useReflectionOverAlpha = true;
  // Babylon's Fresnel term is pow(bias + |cos|, power): "right" is face on, "left" towards grazing.
  m.opacityFresnelParameters = new FresnelParameters({ leftColor: new Color3(0.75, 0.75, 0.75), rightColor: new Color3(0.04, 0.04, 0.04), bias: 0, power: 0.4 });
  const sky = skyReflection(scene);
  if (sky) {
    m.reflectionTexture = sky;
    m.reflectionFresnelParameters = new FresnelParameters({ leftColor: new Color3(1, 1, 1), rightColor: new Color3(0.22, 0.22, 0.22), bias: 0, power: 0.5 });
  }
  return m;
}

/** Window panes from the map's glazed window edges (glass blocks are drawn as blocks, with the same material). */
export class GlassVisuals {
  private mesh: Mesh | null = null;
  private panes: GlassPane[] = [];
  private first = 0;
  private matrices = new Float32Array(0);
  private colors = new Float32Array(0);
  /** Last applied state per pane (health %), to touch the buffers only when something changed. */
  private shown: number[] = [];

  constructor(private readonly scene: Scene) {}

  /** (Re)build for this map. Pane k has scenario index `map.entities.length + k`. */
  build(map: MapDocument): void {
    this.dispose();
    this.panes = windowPanes(map);
    this.first = map.entities.length;
    if (!this.panes.length || this.scene.isDisposed) return;
    const mesh = CreateBox('glass_panes', { size: 1 }, this.scene);
    mesh.material = glassMaterial(this.scene);
    mesh.isPickable = false;
    mesh.hasVertexAlpha = true;
    const n = this.panes.length;
    this.matrices = new Float32Array(n * 16);
    this.colors = new Float32Array(n * 4);
    this.shown = new Array(n).fill(100);
    this.panes.forEach((_, k) => this.write(k, 100));
    mesh.thinInstanceSetBuffer('matrix', this.matrices, 16, false);
    mesh.thinInstanceSetBuffer('color', this.colors, 4, false);
    mesh.thinInstanceRefreshBoundingInfo(false);
    this.mesh = mesh;
  }

  private write(k: number, health: number): void {
    const p = this.panes[k]!;
    const gone = health <= 0;
    const s = gone ? new Vector3(0, 0, 0) : new Vector3(p.box.half.x * 2, p.box.half.y * 2, p.box.half.z * 2);
    Matrix.ComposeToRef(s, Quaternion.RotationYawPitchRoll(p.box.yaw, 0, 0), new Vector3(p.box.center.x, p.box.center.y, p.box.center.z), tmp);
    tmp.copyToArray(this.matrices, k * 16);
    // Cracks frost the pane: whiter and up to five times as opaque.
    const c = gone ? 0 : glassCracks(health);
    this.colors.set([1 + c * 0.6, 1 + c * 0.6, 1 + c * 0.6, 1 + c * 4], k * 4);
  }

  /** Follow replicated pane states (scenario index -> [health %, 0]). */
  apply(states: ReadonlyMap<number, readonly [number, number]>): void {
    if (!this.mesh) return;
    let dirty = false;
    for (let k = 0; k < this.panes.length; k++) {
      const s = states.get(this.first + k);
      const health = s ? s[0] : 100;
      if (health === this.shown[k]) continue;
      this.shown[k] = health;
      this.write(k, health);
      dirty = true;
    }
    if (!dirty) return;
    this.mesh.thinInstanceBufferUpdated('matrix');
    this.mesh.thinInstanceBufferUpdated('color');
  }

  /** How many panes are standing (automation). */
  standing(): number {
    return this.shown.filter((h) => h > 0).length;
  }

  dispose(): void {
    this.mesh?.dispose(false, false);
    this.mesh = null;
    this.panes = [];
    this.shown = [];
  }
}

const tmp = new Matrix();
