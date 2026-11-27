import { afterEach, describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import '@babylonjs/core/Meshes/instancedMesh';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { ImpactVisuals } from '../src/game/impactVisuals.ts';
import { bodyDrawable, contextLossCount, contextLossLine, noteBodiesBack, noteContextLost, noteContextRestored, resetContextLosses } from '../src/game/contextLosses.ts';

const engines: NullEngine[] = [];
afterEach(() => {
  for (const e of engines.splice(0)) e.dispose();
  resetContextLosses();
});

// The bullet hole's texture is drawn on a canvas (impactVisuals.ts holeTexture): a do-nothing one under Node.
const noop2d = (): unknown => new Proxy(() => noop2d(), { get: (_t, k) => (k === 'then' ? undefined : noop2d()), set: () => true });
(globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas ??= class {
  constructor(
    public width: number,
    public height: number,
  ) {}
  getContext(): unknown {
    return noop2d();
  }
};

function scene(): Scene {
  const engine = new NullEngine();
  engines.push(engine);
  return new Scene(engine);
}

/** The data Babylon would rebuild a thin-instance buffer from after a lost context (Buffer._rebuild: its `_data`). */
const rebuildData = (mesh: Mesh, kind: 'matrixBuffer' | 'colorBuffer'): Float32Array | null => {
  const store = (mesh as unknown as { _thinInstanceDataStorage: { matrixBuffer?: { _data: Float32Array | null } } })._thinInstanceDataStorage;
  if (kind === 'matrixBuffer') return store.matrixBuffer?._data ?? null;
  const user = (mesh as unknown as { _userThinInstanceBuffersStorage?: { vertexBuffers: Record<string, { _buffer: { _data: Float32Array | null } }> } })._userThinInstanceBuffersStorage;
  return user?.vertexBuffers.instanceColor?._buffer._data ?? null;
};

describe('after a lost WebGL context comes back', () => {
  it("the level's bullet holes are rebuilt whole (a partial update left Babylon only that part, or nothing)", () => {
    const s = scene();
    const fx = new ImpactVisuals(s, () => null);
    const holes = (fx as unknown as { holes: Mesh }).holes;
    const full = rebuildData(holes, 'matrixBuffer')!.length;
    // Two holes, drawn (a partial update of the first two).
    fx.wallImpact({ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, 1, { sparks: 0, dust: null, dustSize: 0, hole: true });
    fx.wallImpact({ x: 0, y: 1.2, z: 0 }, { x: 1, y: 0, z: 0 }, 1, { sparks: 0, dust: null, dustSize: 0, hole: true });
    fx.update(1 / 60);
    expect(fx.holesInLevel).toBe(2);
    // Babylon would now rebuild the buffer two holes long: the third hole overflowed it ("bufferSubData: buffer overflow").
    expect(rebuildData(holes, 'matrixBuffer')!.length).toBe(2 * 16);
    // A third one updated past the start: nothing left to rebuild from at all.
    fx.wallImpact({ x: 0, y: 1.4, z: 0 }, { x: 1, y: 0, z: 0 }, 1, { sparks: 0, dust: null, dustSize: 0, hole: true });
    fx.update(1 / 60);
    expect(rebuildData(holes, 'matrixBuffer')).toBeNull();
    fx.restored();
    expect(rebuildData(holes, 'matrixBuffer')!.length).toBe(full);
    expect(rebuildData(holes, 'colorBuffer')!.length).toBe((full / 16) * 4);
    expect(holes.thinInstanceCount).toBe(3);
    fx.dispose();
  });

  it("a character's body waits for its maps: drawable only once every map on its shown meshes is in", () => {
    const s = scene();
    const root = new TransformNode('char', s);
    const body = CreateBox('body', {}, s);
    body.parent = root;
    const mat = new StandardMaterial('skin', s);
    const tex = new Texture(null, s);
    mat.diffuseTexture = tex;
    body.material = mat;
    const anim = { ch: { root } };
    const ready = (on: boolean) => {
      // A texture with no internal one yet (being transcoded again) reads not ready, as after a restore.
      (tex as unknown as { isReady: () => boolean }).isReady = () => on;
    };
    ready(false);
    expect(bodyDrawable(anim)).toBe(false);
    // A hidden mesh (a low-detail copy not shown) doesn't hold it back.
    body.setEnabled(false);
    expect(bodyDrawable(anim)).toBe(true);
    body.setEnabled(true);
    ready(true);
    expect(bodyDrawable(anim)).toBe(true);
    // Not a character (no body yet): nothing to wait for.
    expect(bodyDrawable({})).toBe(true);
  });

  it('the performance report records each loss, its return and the characters drawn again', () => {
    expect(contextLossLine()).toBe('WebGL context not lost');
    noteContextLost();
    expect(contextLossCount()).toBe(1);
    expect(contextLossLine()).toMatch(/^WebGL context lost 1 time: at \d\d:\d\d:\d\d UTC, not back yet$/);
    noteContextRestored();
    expect(contextLossLine()).toMatch(/back after \d+\.\d s, characters still coming back$/);
    noteBodiesBack(0);
    expect(contextLossLine()).toMatch(/back after \d+\.\d s, characters drawn again after \d+\.\d s$/);
    noteContextLost();
    noteContextRestored();
    noteBodiesBack(3);
    // Only the first note counts (the time all were back, or how many were still out when the wait gave up).
    noteBodiesBack(0);
    expect(contextLossLine()).toMatch(/^WebGL context lost 2 times: .*; .*3 characters still undrawn after \d+\.\d s$/);
  });
});
