import { Engine } from '@babylonjs/core/Engines/engine';
import type { WebGPUEngine } from '@babylonjs/core/Engines/webgpuEngine';
import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { installEnvironmentBrdf } from './content/brdf.ts';

export type RendererKind = 'WebGPU' | 'WebGL2';

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/**
 * Render a few empty frames and report whether the WebGPU device survived.
 * Some drivers (and software adapters) hand out a device that is lost as soon
 * as it presents; we would rather start on WebGL2 than crash mid-match.
 */
async function webgpuSurvives(engine: WebGPUEngine): Promise<boolean> {
  let lost = false;
  const obs = engine.onContextLostObservable.add(() => (lost = true));
  const scene = new Scene(engine);
  new FreeCamera('probe', Vector3.Zero(), scene);
  try {
    for (let i = 0; i < 4 && !lost; i++) {
      scene.render();
      await nextFrame();
    }
  } catch {
    lost = true;
  }
  scene.dispose();
  engine.onContextLostObservable.remove(obs);
  return !lost;
}

/**
 * WebGL2 by default for now: on WebGPU some of our materials draw flat white
 * and effects land in the wrong place (seen on macOS Chrome), so WebGPU is
 * opt-in with `?renderer=webgpu` until that's fixed and checked.
 * `?renderer=webgl2` forces WebGL2.
 */
export async function createEngine(canvas: HTMLCanvasElement): Promise<{ engine: AbstractEngine; kind: RendererKind; canvas: HTMLCanvasElement; note?: string }> {
  const forced = new URLSearchParams(location.search).get('renderer');
  let note: string | undefined;
  let touchedCanvas = false;
  if (forced === 'webgpu') {
    try {
      // Opt-in, so its engine is a chunk of its own: WebGL2 pages never load it.
      const { WebGPUEngine } = await import('@babylonjs/core/Engines/webgpuEngine');
      if (await WebGPUEngine.IsSupportedAsync) {
        touchedCanvas = true;
        // No stencil (nothing draws with one): Babylon then gives the main pass a 32-bit float depth buffer instead of
        // depth24plus, and with reverse depth on WebGPU's [0, 1] depth range that keeps millimetres apart at any range
        // (docs/LOOK.md, "Depth buffer"). WebGL2 can't have either on the canvas (see below).
        const engine = new WebGPUEngine(canvas, { antialias: true, stencil: false, powerPreference: 'high-performance' });
        await engine.initAsync();
        engine.useReverseDepthBuffer = true;
        engine.onNewSceneAddedObservable.add(installEnvironmentBrdf);
        if (forced === 'webgpu' || (await webgpuSurvives(engine))) return { engine, kind: 'WebGPU', canvas };
        engine.dispose();
        note = 'WebGPU device was lost during startup; using WebGL2';
      } else {
        note = 'WebGPU not supported by this browser; using WebGL2';
      }
    } catch (e) {
      note = `WebGPU failed to start (${(e as Error).message}); using WebGL2`;
    }
    console.warn(note);
  }
  // A canvas that had a WebGPU context cannot get a WebGL one; swap in a fresh canvas.
  if (touchedCanvas) canvas = replaceCanvas(canvas);
  const engine = new Engine(canvas, true, { stencil: true, powerPreference: 'high-performance' }, true);
  // Reverse depth. On WebGL2 it buys little: the canvas's depth buffer is 24-bit fixed point and WebGL's depth range
  // is [-1, 1], so precision stays about d² / 17,000 km (6 mm at 100 m) either way; a float depth target plus
  // EXT_clip_control would fix that at the cost of a full-screen copy. Coplanar faces, the cause of the flicker
  // the owner saw, are gone at build time instead (visibleFaces); this stays as it was.
  engine.useReverseDepthBuffer = true;
  // Every scene's PBR materials share a BRDF table that needs no GPU pre-pass (see content/brdf.ts).
  engine.onNewSceneAddedObservable.add(installEnvironmentBrdf);
  return { engine, kind: 'WebGL2', canvas, note };
}

function replaceCanvas(old: HTMLCanvasElement): HTMLCanvasElement {
  const fresh = old.cloneNode(false) as HTMLCanvasElement;
  old.replaceWith(fresh);
  return fresh;
}
