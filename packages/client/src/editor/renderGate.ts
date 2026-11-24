import type { Scene } from '@babylonjs/core/scene';
import { perfOn } from '../game/perfSwitches.ts';

/**
 * MapMaker draws only when it needs to (docs/PERF_EDITOR_IDLE_2026-11-24.md). It used to draw the whole scene every
 * display refresh, so it sat at 100% of the main thread doing nothing (the owner's trace of 2026-11-24). Now:
 *
 * - **Busy: every frame.** For ACTIVE_MS after any input (keys anywhere; the pointer over the view, or dragging; a
 *   click, a slider or a field anywhere), after anything the view shows changes (the camera, the canvas's size, the
 *   document, the selection, the level, a mesh, material, texture or light added or gone, a model or texture still
 *   loading, a frame someone waits for: card shots and plan pictures listen for one), and while the app says so
 *   (a terrain stroke, a drag, a held fly key).
 * - **At rest: IDLE_FPS** (AWAY_FPS while the window is not focused), so water, swaying plants, the fence's pulse and
 *   anything that changed without telling still show within a fraction of a second. At rest the active meshes are
 *   frozen (Babylon stops working out what is in view, 31% of a frame in the trace) and worked out afresh every
 *   REFREEZE_MS; the first sign of activity thaws them before the frame is drawn.
 *
 * `?perfoff=editoridle` draws every frame and never freezes, as before (game/perfSwitches.ts).
 */
export const ACTIVE_MS = 500;
export const IDLE_FPS = 15;
export const AWAY_FPS = 4;
export const REFREEZE_MS = 1000;

/** What a frame does: draw with what is in view worked out (full), draw at rest (idle), or nothing (skip). */
export type FrameKind = 'full' | 'idle' | 'skip';

/** The decision, apart from the page (tested in test/renderGate.test.ts). */
export function frameKind(now: number, s: { activeUntil: number; lastRender: number }, focused: boolean): FrameKind {
  if (now < s.activeUntil) return 'full';
  const interval = 1000 / (focused ? IDLE_FPS : AWAY_FPS);
  // (A couple of ms early is on time: refreshes do not land exactly on the interval.)
  return now - s.lastRender >= interval - 4 ? 'idle' : 'skip';
}

/** Two signatures alike, number for number. */
export function sameSignature(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i] && !(Number.isNaN(a[i]) && Number.isNaN(b[i]))) return false;
  return true;
}

export class RenderGate {
  readonly on = perfOn('editoridle');
  private activeUntil = 0;
  private lastRender = -Infinity;
  private last: number[] = [];
  private frozen = false;
  private frozenAt = 0;
  /** When a freeze was last tried (a scene not ready waits for the next try). */
  private triedAt = -Infinity;
  /** Bumped by every thaw: a freeze that completes after it undoes itself. */
  private token = 0;
  private overCanvas = false;
  private readonly off: (() => void)[] = [];
  /** For the checks and the probe: frames drawn of each kind. */
  readonly counts = { full: 0, idle: 0, skip: 0 };

  constructor(private readonly scene: Scene, canvas: HTMLCanvasElement | null) {
    if (!this.on || typeof window === 'undefined') return;
    const wake = () => this.wake();
    const listen = (target: EventTarget, type: string, fn: (e: Event) => void) => {
      target.addEventListener(type, fn, { capture: true, passive: true });
      this.off.push(() => target.removeEventListener(type, fn, { capture: true }));
    };
    for (const type of ['keydown', 'keyup', 'pointerdown', 'pointerup', 'pointercancel', 'input', 'change', 'click', 'contextmenu', 'focus', 'blur', 'resize']) listen(window, type, wake);
    listen(window, 'pointermove', (e) => {
      const over = !!canvas && e.target === canvas;
      // Over the view, dragging, or just leaving it (the hover highlight goes).
      if (over || this.overCanvas || (e as PointerEvent).buttons) this.wake();
      this.overCanvas = over;
    });
    listen(window, 'wheel', (e) => {
      if (!canvas || e.target === canvas) this.wake();
    });
  }

  /** Something changed that the next frames must show. */
  wake(ms = ACTIVE_MS): void {
    this.activeUntil = Math.max(this.activeUntil, performance.now() + ms);
  }

  /**
   * Whether this frame draws. `busy`: the app is in the middle of something (a stroke, a drag, a held key); `key`: what
   * else the view shows that the scene's own counts don't (the document's revision, the selection, the level).
   */
  frame(now: number, busy: boolean, key: readonly number[]): boolean {
    if (!this.on) return true;
    const sig = this.signature(key);
    if (busy || !sameSignature(sig, this.last) || this.scene.getWaitingItemsCount() > 0) this.activeUntil = Math.max(this.activeUntil, now + ACTIVE_MS);
    this.last = sig;
    const kind = frameKind(now, { activeUntil: this.activeUntil, lastRender: this.lastRender }, typeof document === 'undefined' || document.hasFocus());
    this.counts[kind]++;
    if (kind === 'skip') return false;
    this.lastRender = now;
    if (kind === 'full') {
      this.thaw();
      return true;
    }
    if (this.frozen && now - this.frozenAt >= REFREEZE_MS) {
      this.thaw();
      this.triedAt = -Infinity;
    }
    if (!this.frozen) this.freeze(now);
    return true;
  }

  /** At rest: what is in view is kept as it is until the next sign of activity (or REFREEZE_MS). */
  private freeze(now: number): void {
    // Only a ready scene (Babylon would otherwise poll its readiness ten times a second until it is): a shader still
    // compiling, a texture still loading, tried again in REFREEZE_MS.
    if (now - this.triedAt < REFREEZE_MS) return;
    this.triedAt = now;
    if (!this.scene.isReady()) return;
    const token = ++this.token;
    this.frozen = true;
    this.frozenAt = now;
    // Not the meshes' own matrices (freezeMeshes false): something animated may still move.
    this.scene.freezeActiveMeshes(false, () => {
      if (token !== this.token) this.scene.unfreezeActiveMeshes();
    }, () => {
      if (token === this.token) this.frozen = false;
    }, false);
  }

  private thaw(): void {
    if (!this.frozen) return;
    this.token++;
    this.frozen = false;
    this.scene.unfreezeActiveMeshes();
  }

  /** What the scene shows, as numbers: the camera, the canvas, the scene's counts and the app's own key. */
  private signature(key: readonly number[]): number[] {
    const s = this.scene;
    const c = s.activeCamera as (typeof s.activeCamera & { rotation?: { x: number; y: number; z: number }; rotationQuaternion?: { x: number; y: number; z: number; w: number } | null }) | null;
    const e = s.getEngine();
    const p = c?.position;
    const r = c?.rotation;
    const q = c?.rotationQuaternion;
    return [
      c?.uniqueId ?? -1, p?.x ?? 0, p?.y ?? 0, p?.z ?? 0, r?.x ?? 0, r?.y ?? 0, r?.z ?? 0, q?.x ?? 0, q?.y ?? 0, q?.z ?? 0, q?.w ?? 0,
      c?.fov ?? 0, c?.mode ?? 0, c?.orthoLeft ?? 0, c?.orthoRight ?? 0, c?.orthoTop ?? 0, c?.orthoBottom ?? 0, c?.minZ ?? 0, c?.maxZ ?? 0,
      e.getRenderWidth(), e.getRenderHeight(), s.activeCameras?.length ?? 0,
      s.meshes.length, s.materials.length, s.textures.length, s.transformNodes.length, s.geometries.length, s.lights.length, s.particleSystems.length, s.skeletons.length,
      s.onBeforeRenderObservable.observers.length, s.onAfterRenderObservable.observers.length,
      ...key,
    ];
  }

  dispose(): void {
    for (const f of this.off) f();
    this.off.length = 0;
    this.thaw();
  }
}
