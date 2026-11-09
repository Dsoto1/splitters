import type { Scene } from '@babylonjs/core/scene';
import type { Observer } from '@babylonjs/core/Misc/observable';
import type { PropEntity } from '@tiletrigger/shared';
import type { EnvironmentVisuals } from './environmentVisuals.ts';
import { loadGraphicsQuality } from '../game/graphicsSettings.ts';

/** A decorative copy of a species: `model` is `env.<family>.<species>`, optionally `#<variant>`. */
export interface EnvCopy {
  model: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  scale: number;
}

/**
 * Our species as scenery outside the map (Environment Phase 2: the border's forest and the backdrop's belt and far
 * trees, which were Kenney and Quaternius models): an EnvironmentVisuals of their own, so they get the levels of
 * detail, the far stand-ins, wind and per-square batches the map's own species get, updated from the active camera
 * before each frame. Nothing here collides (the border's collision is shared's borderBoxes). The renderer's code is
 * loaded only when a scatter is first made (never with the menu).
 */
export class EnvScatter {
  private env: EnvironmentVisuals | null = null;
  private observer: Observer<Scene> | null = null;
  private disposed = false;

  constructor(
    private readonly scene: Scene,
    private readonly options: { sector?: number; farOnly?: boolean; prefix: string },
  ) {}

  /** Draw these copies (replaces any before). Resolves once their models are in. */
  async set(copies: readonly EnvCopy[]): Promise<void> {
    if (!copies.length) return;
    const { EnvironmentVisuals } = await import('./environmentVisuals.ts');
    if (this.disposed) return;
    this.env ??= new EnvironmentVisuals(this.scene, loadGraphicsQuality(), { sector: this.options.sector ?? 160 });
    if (this.options.farOnly) this.env.forceLevel(99);
    const entities = copies.map((c, i): PropEntity => {
      const [model, v] = c.model.split('#');
      return { id: `${this.options.prefix}_${i}`, kind: 'prop', model: model!, position: [c.x, c.y, c.z], yaw: c.yaw, scale: c.scale, solid: false, tint: null, ...(v ? { variant: Number(v) } : {}) } as PropEntity;
    });
    await this.env.setPlacements(entities, null);
    if (this.disposed) return;
    const env = this.env;
    this.observer ??= this.scene.onBeforeRenderObservable.add(() => {
      const cam = this.scene.activeCamera;
      if (cam) env.update(cam.globalPosition);
    });
  }

  setVisible(on: boolean): void {
    this.env?.setVisible(on);
  }

  /** Copies, batches and triangles drawn (diagnostics). */
  stats(): ReturnType<EnvironmentVisuals['stats']> | null {
    return this.env?.stats() ?? null;
  }

  dispose(): void {
    this.disposed = true;
    if (this.observer) this.scene.onBeforeRenderObservable.remove(this.observer);
    this.observer = null;
    this.env?.dispose();
    this.env = null;
  }
}
