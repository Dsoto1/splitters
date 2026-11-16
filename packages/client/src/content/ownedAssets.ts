import type { Scene } from '@babylonjs/core/scene';
import type { Material } from '@babylonjs/core/Materials/material';
import type { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture';

/**
 * The materials and textures one character body made of its own, so its dispose frees exactly those.
 *
 * A body's parts are instanced with their materials cloned (each body tints and dresses its own), and a PBR clone
 * clones every texture it holds too: new Texture wrappers over the same pictures (the engine shares the GPU texture
 * by URL and counts its users, so disposing a wrapper only drops its count). Nodes disposed without their materials
 * left all of that in the scene: some 2 materials and 1.5 textures a body, for the whole match (Flavius Rule,
 * 65 players: 318 → 1,083 textures in 200 s, GPU memory flat).
 *
 * `track` records what the scene gains while it runs (synchronous code only: the instancing and the atlas clone), so
 * nothing shared (the library's skin, hair and outfit textures, dyed textures, the atlas's own textures, gear's
 * materials, other bodies') is ever counted. A tracked material that goes takes its tracked textures with it.
 */
export class OwnedAssets {
  private readonly materials = new Set<Material>();
  private readonly textures = new Set<BaseTexture>();

  /** `on` false (`?perfoff=bodyclones`, measuring against the old code): tracks nothing, so frees nothing. */
  constructor(
    private readonly scene: Scene,
    private readonly on = true,
  ) {}

  /** Run `fn` and keep every material and texture it adds to the scene as this body's own. */
  track<T>(fn: () => T): T {
    if (!this.on) return fn();
    // New materials are pushed onto the end of the scene's list (the scene tells its observers only on a later tick);
    // new textures are announced at once.
    const before = this.scene.materials.length;
    const texs = this.scene.onNewTextureAddedObservable.add((t) => this.addTexture(t));
    try {
      return fn();
    } finally {
      this.scene.onNewTextureAddedObservable.remove(texs);
      const list = this.scene.materials;
      for (let i = before; i < list.length; i++) this.addMaterial(list[i]!);
    }
  }

  /** How many of each this body holds (tests). */
  get counts(): { materials: number; textures: number } {
    return { materials: this.materials.size, textures: this.textures.size };
  }

  /** A texture of ours taken off a material (`dress` and the atlas put shared ones in its place): freed when no material of ours holds it. */
  release(t: BaseTexture | null | undefined): void {
    if (!t || !this.textures.has(t)) return;
    for (const m of this.materials) if (holds(m, t)) return;
    this.textures.delete(t);
    t.dispose();
  }

  /** Our materials no mesh in `used` draws with (parts merged away, low-detail copies, swapped meshes): freed now. */
  keepOnly(used: ReadonlySet<Material | null>): void {
    for (const m of [...this.materials]) if (!used.has(m)) m.dispose(false, false);
  }

  dispose(): void {
    for (const m of [...this.materials]) m.dispose(false, false);
    for (const t of [...this.textures]) t.dispose();
    this.textures.clear();
  }

  private addMaterial(m: Material): void {
    this.materials.add(m);
    m.onDisposeObservable.addOnce(() => {
      this.materials.delete(m);
      // Its textures that are ours (a clone's own copies; never the shared ones it was dressed in).
      for (const t of m.getActiveTextures()) this.release(t);
    });
  }

  private addTexture(t: BaseTexture): void {
    this.textures.add(t);
    t.onDisposeObservable.addOnce(() => this.textures.delete(t));
  }
}

function holds(m: Material, t: BaseTexture): boolean {
  return m.hasTexture(t) || m.getActiveTextures().includes(t);
}
