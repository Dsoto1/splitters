/**
 * MapMaker draws only when it needs to (editor/renderGate.ts, docs/PERF_EDITOR_IDLE_2026-11-24.md): every frame while
 * something changes, a few a second at rest with the active meshes frozen, thawed before the next changed frame.
 */
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import '@babylonjs/core/Materials/standardMaterial';
import { Scene } from '@babylonjs/core/scene';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ACTIVE_MS, AWAY_FPS, IDLE_FPS, RenderGate, frameKind, sameSignature } from '../src/editor/renderGate.ts';

describe('frameKind', () => {
  it('draws every frame while active, then at the rest rate', () => {
    expect(frameKind(100, { activeUntil: 200, lastRender: 99 }, true)).toBe('full');
    expect(frameKind(300, { activeUntil: 200, lastRender: 290 }, true)).toBe('skip');
    expect(frameKind(290 + 1000 / IDLE_FPS, { activeUntil: 200, lastRender: 290 }, true)).toBe('idle');
    // Not focused: slower still.
    expect(frameKind(290 + 1000 / IDLE_FPS, { activeUntil: 200, lastRender: 290 }, false)).toBe('skip');
    expect(frameKind(290 + 1000 / AWAY_FPS, { activeUntil: 200, lastRender: 290 }, false)).toBe('idle');
  });

  it('compares signatures number for number', () => {
    expect(sameSignature([1, 2, NaN], [1, 2, NaN])).toBe(true);
    expect(sameSignature([1, 2], [1, 3])).toBe(false);
    expect(sameSignature([1, 2], [1, 2, 3])).toBe(false);
  });
});

describe('RenderGate', () => {
  afterEach(() => vi.restoreAllMocks());

  const setup = () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const camera = new FreeCamera('c', new Vector3(0, 5, -10), scene);
    scene.activeCamera = camera;
    CreateBox('b', {}, scene);
    const gate = new RenderGate(scene, null);
    // (A NullEngine scene never reports ready, so Babylon's own freeze would wait: count the calls instead.)
    const frozen = { on: false, freezes: 0, thaws: 0 };
    vi.spyOn(scene, 'isReady').mockReturnValue(true);
    vi.spyOn(scene, 'freezeActiveMeshes').mockImplementation(() => {
      frozen.on = true;
      frozen.freezes++;
      return scene;
    });
    vi.spyOn(scene, 'unfreezeActiveMeshes').mockImplementation(() => {
      frozen.on = false;
      frozen.thaws++;
      return scene;
    });
    return { scene, camera, gate, frozen };
  };

  it('rests and freezes once nothing changes, and thaws on a change before drawing', () => {
    const { scene, camera, gate, frozen } = setup();
    let now = 0;
    const step = (key: number[] = [0]) => {
      now += 16;
      vi.spyOn(performance, 'now').mockReturnValue(now);
      const drew = gate.frame(now, false, key);
      if (drew) scene.render();
      return drew;
    };
    // The first frames are active (the signature is new).
    expect(step()).toBe(true);
    for (let t = 0; t < ACTIVE_MS + 100; t += 16) step();
    // At rest: about IDLE_FPS frames a second, frozen.
    let drawn = 0;
    for (let t = 0; t < 1000; t += 16) if (step()) drawn++;
    expect(drawn).toBeGreaterThanOrEqual(IDLE_FPS - 2);
    expect(drawn).toBeLessThanOrEqual(IDLE_FPS + 2);
    expect(frozen.on).toBe(true);
    // Worked out afresh about once a second at rest.
    expect(frozen.freezes).toBeGreaterThanOrEqual(1);
    expect(frozen.freezes).toBeLessThanOrEqual(2);
    // The camera moves: thawed, drawn this frame.
    camera.position.x += 1;
    expect(step()).toBe(true);
    expect(frozen.on).toBe(false);
    for (let t = 0; t < ACTIVE_MS + 100; t += 16) step();
    // A mesh added, or the app's key changing (an edit), wakes it too.
    CreateBox('b2', {}, scene);
    expect(step()).toBe(true);
    expect(frozen.on).toBe(false);
    for (let t = 0; t < ACTIVE_MS + 100; t += 16) step();
    expect(step([1])).toBe(true);
    for (let t = 0; t < 100; t += 16) expect(step([1])).toBe(true);
    // Busy (a drag, a held key): every frame.
    for (let t = 0; t < ACTIVE_MS + 100; t += 16) step([1]);
    now += 16;
    expect(gate.frame(now, true, [1])).toBe(true);
    gate.dispose();
  });
});
