import type { Scene } from '@babylonjs/core/scene';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Material } from '@babylonjs/core/Materials/material';
import type { MaterialDefines } from '@babylonjs/core/Materials/materialDefines';
import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase';
import type { UniformBuffer } from '@babylonjs/core/Materials/uniformBuffer';
import { ShaderLanguage } from '@babylonjs/core/Materials/shaderLanguage';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Nullable } from '@babylonjs/core/types';
import { Plane } from '@babylonjs/core/Maths/math.plane';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';

/**
 * MapMaker: building below ground (QUEUE Features; owner, 2026-11-19: "unable to see the actual tunnel layout under
 * terrain"). While a level below the ground is edited, the ground turns to a faint glass, and a clear cut-away circle
 * follows the pointer where its ray meets the ground, so buried pieces, the ghost and the cells taken show through.
 * Back on Ground (or above) the terrain returns as it was. MapMaker only: play never draws it.
 *
 * Steady (no pulsing or flicker): nothing here changes but where the circle is (docs/LOOK.md, "Reduce flashing").
 */

/** How see-through the ground is below ground level (its paint still reads, faintly). */
export const GLASS_ALPHA = 0.22;
/** The cut-away circle's radius, metres, and the soft rim drawn round it. */
export const CUT_RADIUS = 7;
const RIM = 0.6;

/** Where the level below ground is cut for a view from above, over its floor (an architect's section: the roofs of tunnels off). */
export const SECTION_ABOVE_FLOOR = 2.6;
/** Never clipped: the glass ground stays whole over the section. */
const NO_CLIP = new Plane(0, 0, 0, -1);

/** Where the cut is: [x, z, radius, rim]; radius 0 for none. Shared by every glass material (one ground, one pointer). */
const cut = { x: 0, z: 0, r: 0 };

class GroundGlassPlugin extends MaterialPluginBase {
  constructor(material: Material) {
    super(material, 'GroundGlass', 210, { GROUNDGLASS: false });
    this._enable(true);
  }

  override getClassName(): string {
    return 'GroundGlassPlugin';
  }

  override isCompatible(shaderLanguage: ShaderLanguage): boolean {
    return shaderLanguage === ShaderLanguage.GLSL || shaderLanguage === ShaderLanguage.WGSL;
  }

  override prepareDefines(defines: MaterialDefines): void {
    defines['GROUNDGLASS'] = true;
  }

  override getUniforms(): { ubo: { name: string; size: number; type: string }[]; fragment: string } {
    return { ubo: [{ name: 'groundGlass', size: 4, type: 'vec4' }], fragment: '#ifdef GROUNDGLASS\nuniform vec4 groundGlass;\n#endif\n' };
  }

  override bindForSubMesh(ubo: UniformBuffer): void {
    ubo.updateFloat4('groundGlass', cut.x, cut.z, cut.r, RIM);
  }

  override getCustomCode(shaderType: string, shaderLanguage: ShaderLanguage = ShaderLanguage.GLSL): Nullable<{ [pointName: string]: string }> {
    if (shaderType !== 'fragment') return null;
    if (shaderLanguage === ShaderLanguage.WGSL) {
      return {
        CUSTOM_FRAGMENT_MAIN_BEGIN: `
let ggD = distance(fragmentInputs.vPositionW.xz, uniforms.groundGlass.xy);
if (ggD < uniforms.groundGlass.z) { discard; }
`,
        CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR: `
{
  let ggRim = select(0.0, 1.0 - clamp((distance(fragmentInputs.vPositionW.xz, uniforms.groundGlass.xy) - uniforms.groundGlass.z) / uniforms.groundGlass.w, 0.0, 1.0), uniforms.groundGlass.z > 0.0);
  color = vec4f(mix(color.rgb, vec3f(0.75, 0.9, 1.0), ggRim * 0.8), max(color.a, ggRim * 0.85));
}
`,
      };
    }
    return {
      CUSTOM_FRAGMENT_MAIN_BEGIN: `
#ifdef GROUNDGLASS
if (distance(vPositionW.xz, groundGlass.xy) < groundGlass.z) discard;
#endif
`,
      CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR: `
#ifdef GROUNDGLASS
{
  float ggRim = groundGlass.z > 0.0 ? 1.0 - clamp((distance(vPositionW.xz, groundGlass.xy) - groundGlass.z) / groundGlass.w, 0.0, 1.0) : 0.0;
  color = vec4(mix(color.rgb, vec3(0.75, 0.9, 1.0), ggRim * 0.8), max(color.a, ggRim * 0.85));
}
#endif
`,
    };
  }
}

/** Whether a mesh is part of MapMaker's drawn ground (the terrain, its soft paint borders, roads and paths on it). */
const isGround = (m: AbstractMesh): boolean => m.name.startsWith('edmap_terrain') || m.name.startsWith('edroad') || m.name.startsWith('edpath');

/** The ground as glass while a level below it is edited: its meshes swapped onto see-through twins of their materials. */
export class GroundGlass {
  private on = false;
  /** The dark earth the level's pieces are seen on, just under its floors. */
  private base: Mesh | null = null;
  /** The section cut while the camera is above the level (null: none of ours in place). */
  private section: Plane | null = null;
  private floorY = 0;
  private levelHeight = 4;
  /** Each ground material's glass twin. */
  private readonly twins = new Map<Material, StandardMaterial>();
  /** The material each glassed mesh had. */
  private readonly was = new Map<AbstractMesh, Material>();

  constructor(private readonly scene: Scene) {}

  get active(): boolean {
    return this.on;
  }

  /**
   * On below ground (`below`: the level's floor height and the level height, and the ground's extent), off at Ground
   * and above. Call again after the ground's meshes are rebuilt.
   */
  set(below: { floorY: number; levelHeight: number; min: [number, number]; max: [number, number] } | null): void {
    if (!below) {
      if (this.on) this.restore();
      this.on = false;
      cut.r = 0;
      this.base?.setEnabled(false);
      this.unsection();
      return;
    }
    this.on = true;
    this.floorY = below.floorY;
    this.levelHeight = below.levelHeight;
    this.showBase(below.min, below.max);
    for (const [m] of this.was) if (m.isDisposed()) this.was.delete(m);
    for (const m of this.scene.meshes) {
      if (!isGround(m) || !m.material || this.was.has(m)) continue;
      const twin = this.twinOf(m.material);
      if (!twin) continue;
      this.was.set(m, m.material);
      m.material = twin;
    }
  }

  /** A dark earth under the level's floors, over the ground's extent, so the pieces read against it (not the sky). */
  private showBase(min: [number, number], max: [number, number]): void {
    const w = Math.max(1, max[0] - min[0]);
    const d = Math.max(1, max[1] - min[1]);
    if (!this.base || this.base.metadata?.w !== w || this.base.metadata?.d !== d) {
      this.base?.dispose();
      this.base = CreateGround('edGlassBase', { width: w, height: d }, this.scene);
      const mat = new StandardMaterial('edGlassBaseMat', this.scene);
      mat.diffuseColor = new Color3(0.16, 0.13, 0.1);
      mat.emissiveColor = new Color3(0.09, 0.075, 0.06);
      mat.specularColor = Color3.Black();
      mat.alpha = 0.9;
      mat.clipPlane = NO_CLIP;
      this.base.material = mat;
      this.base.isPickable = false;
      this.base.metadata = { w, d };
    }
    this.base.position.set((min[0] + max[0]) / 2, this.floorY - 0.6, (min[1] + max[1]) / 2);
    this.base.setEnabled(true);
  }

  /**
   * Each frame: seen from above the level (the camera over its ceiling), the view is cut a little over its floor, so
   * the tunnels' roofs come off and their insides show; flown down into a tunnel, it is drawn whole. Another cut (the
   * plan view's) is left alone.
   */
  update(camera: Vector3): void {
    if (!this.on) return;
    const want = camera.y > this.floorY + this.levelHeight;
    const scene = this.scene;
    if (!want) {
      this.unsection();
      return;
    }
    if (scene.clipPlane && scene.clipPlane !== this.section) return;
    const d = -(this.floorY + SECTION_ABOVE_FLOOR);
    if (!this.section || this.section.d !== d) this.section = new Plane(0, 1, 0, d);
    scene.clipPlane = this.section;
  }

  private unsection(): void {
    if (this.section && this.scene.clipPlane === this.section) this.scene.clipPlane = null;
    this.section = null;
  }

  /** The cut-away circle round where the pointer's ray meets the ground; null takes it away. */
  setCut(at: { x: number; z: number } | null): void {
    if (!this.on || !at) {
      cut.r = 0;
      return;
    }
    cut.x = at.x;
    cut.z = at.z;
    cut.r = CUT_RADIUS;
  }

  private twinOf(mat: Material): StandardMaterial | null {
    if (!(mat instanceof StandardMaterial)) return null;
    let twin = this.twins.get(mat);
    if (twin) return twin;
    twin = mat.clone(`${mat.name}_glass`);
    twin.alpha = mat.alpha * GLASS_ALPHA;
    twin.backFaceCulling = false;
    twin.disableDepthWrite = true;
    // Never cut: the glass ground stays whole over the section (and the plan view's cut).
    twin.clipPlane = NO_CLIP;
    new GroundGlassPlugin(twin);
    this.twins.set(mat, twin);
    return twin;
  }

  private restore(): void {
    for (const [m, mat] of this.was) if (!m.isDisposed()) m.material = mat;
    this.was.clear();
  }

  dispose(): void {
    this.restore();
    this.unsection();
    this.base?.dispose();
    for (const t of this.twins.values()) t.dispose();
    this.twins.clear();
  }
}
