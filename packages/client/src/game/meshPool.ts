import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';

/**
 * Short-lived effect meshes (sparks, dust, blood) kept for reuse, hidden,
 * instead of made and disposed for every hit. A big fight makes about a
 * thousand a second, and disposing one isn't cheap: the scene looks through
 * every running animation for any on it (each character bone's, about twelve
 * thousand with 96 players) and through all its meshes to take it out.
 */
export class MeshPool<T extends AbstractMesh> {
  private readonly free: T[] = [];

  constructor(
    private readonly make: () => T,
    /** Meshes kept hidden for reuse at most; past that, given-back meshes are disposed. */
    private readonly max: number,
  ) {}

  /** A mesh, shown (its position, scale and the like are the caller's to set). */
  take(): T {
    const m = this.free.pop() ?? this.make();
    m.setEnabled(true);
    return m;
  }

  /** Done with a mesh: hidden for reuse. */
  give(m: T): void {
    if (this.free.length >= this.max) {
      m.dispose();
      return;
    }
    m.setEnabled(false);
    this.free.push(m);
  }

  /**
   * Draw one of these for a few frames while the match loads, far out of sight, so its shader is built
   * then instead of at the first hit (a stall). `pose` sets it up the way it's drawn (scale, fade).
   */
  warm(pose: (m: T) => void = () => undefined, frames = 3): void {
    const m = this.take();
    m.position.set(0, -10000, 0);
    pose(m);
    // Drawn though out of view.
    m.alwaysSelectAsActiveMesh = true;
    const scene = m.getScene();
    let left = frames;
    const obs = scene.onAfterRenderObservable.add(() => {
      if (--left > 0) return;
      scene.onAfterRenderObservable.remove(obs);
      m.alwaysSelectAsActiveMesh = false;
      this.give(m);
    });
  }

  dispose(): void {
    for (const m of this.free) m.dispose();
    this.free.length = 0;
  }
}
