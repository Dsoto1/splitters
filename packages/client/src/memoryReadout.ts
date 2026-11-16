import { EngineStore } from '@babylonjs/core/Engines/engineStore';
import { InternalTextureSource } from '@babylonjs/core/Materials/Textures/internalTexture';

/**
 * The memory readout (docs/PERF_MAPMAKER_TRACE_2026-11-15.md, fix 3a): what the page holds, read once a second by
 * the perf overlay and the match recording, and at every MapMaker Test start and Back to MapMaker (a snapshot). It
 * shows whether a long session climbs, and what climbs: Chrome's script memory, the engine's live objects, the page's
 * DOM, the workers we run. Each read walks a few arrays (cheap: under a millisecond on a big map); nothing here runs
 * unless something asks.
 */

export interface MemorySample {
  /** Seconds since the page loaded. */
  t: number;
  /** Chrome's script memory (`performance.memory`, MB): used, total and the limit; null in other browsers. */
  heapMB: number | null;
  heapTotalMB: number | null;
  heapLimitMB: number | null;
  /** The engine's scenes (the menu, MapMaker, a match, the thumbnails' own) and what they hold, summed. */
  scenes: number;
  meshes: number;
  materials: number;
  geometries: number;
  textures: number;
  skeletons: number;
  animationGroups: number;
  transformNodes: number;
  /** Textures on the graphics card (the engine's own list), its render targets, and their size in MB (estimated). */
  gpuTextures: number;
  renderTargets: number;
  gpuTextureMB: number;
  /** The page's elements. */
  domNodes: number;
  /** Our workers alive (made and not terminated). */
  workers: number;
}

const MB = 1024 * 1024;
const round1 = (x: number) => Math.round(x * 10) / 10;

let liveWorkers = 0;
let workersCounted = false;

/** Count the workers we make (a subclass of the page's Worker: made, less terminated). Call once, early. */
export function countWorkers(): void {
  if (workersCounted || typeof Worker === 'undefined') return;
  workersCounted = true;
  const Base = Worker;
  class CountedWorker extends Base {
    private gone = false;
    constructor(url: string | URL, opts?: WorkerOptions) {
      super(url, opts);
      liveWorkers++;
    }
    override terminate(): void {
      if (!this.gone) liveWorkers--;
      this.gone = true;
      super.terminate();
    }
  }
  (globalThis as { Worker: typeof Worker }).Worker = CountedWorker;
}

/** Bytes a texture on the card takes, roughly: four bytes a texel (unless known), a third more for mip maps, six faces for a cube. */
function textureBytes(t: { width: number; height: number; depth?: number; generateMipMaps?: boolean; isCube?: boolean; is3D?: boolean; is2DArray?: boolean; type?: number }): number {
  const texel = t.type === 1 /* float */ ? 16 : t.type === 2 /* half float */ ? 8 : 4;
  const layers = t.isCube ? 6 : t.is3D || t.is2DArray ? Math.max(1, t.depth ?? 1) : 1;
  return t.width * t.height * texel * layers * (t.generateMipMaps ? 4 / 3 : 1);
}

/** What the page holds now. */
export function memorySample(): MemorySample {
  const mem = (performance as Performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
  const s: MemorySample = {
    t: round1(performance.now() / 1000),
    heapMB: mem ? round1(mem.usedJSHeapSize / MB) : null,
    heapTotalMB: mem ? round1(mem.totalJSHeapSize / MB) : null,
    heapLimitMB: mem ? round1(mem.jsHeapSizeLimit / MB) : null,
    scenes: 0,
    meshes: 0,
    materials: 0,
    geometries: 0,
    textures: 0,
    skeletons: 0,
    animationGroups: 0,
    transformNodes: 0,
    gpuTextures: 0,
    renderTargets: 0,
    gpuTextureMB: 0,
    domNodes: document.getElementsByTagName('*').length,
    workers: liveWorkers,
  };
  let bytes = 0;
  for (const engine of EngineStore.Instances) {
    for (const scene of engine.scenes) {
      s.scenes++;
      s.meshes += scene.meshes.length;
      s.materials += scene.materials.length;
      s.geometries += scene.geometries.length;
      s.textures += scene.textures.length;
      s.skeletons += scene.skeletons.length;
      s.animationGroups += scene.animationGroups.length;
      s.transformNodes += scene.transformNodes.length;
    }
    const cache = engine.getLoadedTexturesCache();
    s.gpuTextures += cache.length;
    for (const t of cache) {
      const src = t.source;
      if (src === InternalTextureSource.RenderTarget || src === InternalTextureSource.MultiRenderTarget || src === InternalTextureSource.Depth || src === InternalTextureSource.DepthStencil) s.renderTargets++;
      bytes += textureBytes(t);
    }
  }
  s.gpuTextureMB = round1(bytes / MB);
  return s;
}

/** One line for the perf overlay and MapMaker's status bar. */
export function memoryLine(s: MemorySample = memorySample()): string {
  const heap = s.heapMB !== null ? `script ${Math.round(s.heapMB)} MB` : 'script memory n/a (Chrome only)';
  return `${heap} · ${s.meshes} meshes, ${s.materials} materials, ${s.geometries} geometries, ${s.gpuTextures} textures (${Math.round(s.gpuTextureMB)} MB, ${s.renderTargets} targets) in ${s.scenes} scenes · ${Math.round(s.domNodes / 100) / 10}k DOM nodes · ${s.workers} workers`;
}

/** A snapshot at a moment that matters (a Test start, Back to MapMaker): kept for the recording and the probe. */
export interface MemorySnapshot extends MemorySample {
  label: string;
}

const KEEP_SNAPSHOTS = 200;
export const memorySnapshots: MemorySnapshot[] = [];

export function noteMemory(label: string): MemorySnapshot {
  const snap = { label, ...memorySample() };
  memorySnapshots.push(snap);
  if (memorySnapshots.length > KEEP_SNAPSHOTS) memorySnapshots.splice(0, memorySnapshots.length - KEEP_SNAPSHOTS);
  return snap;
}

// The repeat probe (tools/perf/memory-probe.mjs) and anyone at the console read it from here.
(globalThis as unknown as { __memory: unknown }).__memory = { sample: memorySample, line: memoryLine, snapshots: memorySnapshots, note: noteMemory };
