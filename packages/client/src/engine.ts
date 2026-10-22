import { Engine } from '@babylonjs/core/Engines/engine';
import { WebGPUEngine } from '@babylonjs/core/Engines/webgpuEngine';
import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

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
 * WebGPU first, WebGL2 fallback (MASTER_SPEC_V2 header). `?renderer=webgl2`
 * forces the fallback; `?renderer=webgpu` skips the survival probe.
 */
export async function createEngine(canvas: HTMLCanvasElement): Promise<{ engine: AbstractEngine; kind: RendererKind; canvas: HTMLCanvasElement; note?: string }> {
  const forced = new URLSearchParams(location.search).get('renderer');
  let note: string | undefined;
  let touchedCanvas = false;
  if (forced !== 'webgl2') {
    try {
      if (await WebGPUEngine.IsSupportedAsync) {
        touchedCanvas = true;
        const engine = new WebGPUEngine(canvas, { antialias: true, stencil: true, powerPreference: 'high-performance' });
        await engine.initAsync();
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
  return { engine, kind: 'WebGL2', canvas, note };
}

function replaceCanvas(old: HTMLCanvasElement): HTMLCanvasElement {
  const fresh = old.cloneNode(false) as HTMLCanvasElement;
  old.replaceWith(fresh);
  return fresh;
}
