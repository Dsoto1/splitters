import { afterEach, describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { BOTTOMLESS_INFINITY, createPickupVisual, lemniscate } from '../src/game/pickupVisuals.ts';
import type { ModelLibrary } from '../src/content/models.ts';

/** Bottomless Mag's pickup (owner, 2026-11-24): a small stack of rounds under an ∞, not a magazine under two hoops (it read like scissors). */
const engines: NullEngine[] = [];
afterEach(() => {
  for (const e of engines.splice(0)) e.dispose();
});

describe("Bottomless Mag's pickup", () => {
  it('draws an ∞: a closed figure eight as wide as asked, crossing itself in the middle', () => {
    const path = lemniscate(0.42, 48);
    expect(path[0]!.equalsWithEpsilon(path[path.length - 1]!, 1e-9)).toBe(true);
    const xs = path.map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(0.42, 5);
    expect(path.every((p) => p.z === 0)).toBe(true);
    // Two lobes: it passes through the middle twice on the way round (a quarter and three quarters).
    expect(path[12]!.length()).toBeLessThan(1e-9);
    expect(path[36]!.length()).toBeLessThan(1e-9);
    // Not as tall as wide, and the same above and below.
    const ys = path.map((p) => p.y);
    expect(Math.max(...ys)).toBeLessThan(0.1);
    expect(Math.max(...ys)).toBeCloseTo(-Math.min(...ys), 6);
  });

  it('is six rounds stacked three, two, one, with the ∞ over them, all about half a metre across', () => {
    const engine = new NullEngine();
    engines.push(engine);
    const scene = new Scene(engine);
    const root = createPickupVisual(scene, {} as ModelLibrary, 'core.powerup_bottomless', 'bm');
    const meshes = root.getChildMeshes();
    const cases = meshes.filter((m) => m.name.startsWith('bm_bmcase'));
    const tips = meshes.filter((m) => m.name.startsWith('bm_bmtip'));
    expect(cases.length).toBe(6);
    expect(tips.length).toBe(6);
    expect(meshes.some((m) => m.name.includes('bmloop') || m.name.includes('bmmag'))).toBe(false);
    const rows = new Map<number, number>();
    for (const c of cases) rows.set(Math.round(c.position.y * 1000), (rows.get(Math.round(c.position.y * 1000)) ?? 0) + 1);
    expect([...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, n]) => n)).toEqual([3, 2, 1]);
    const mark = meshes.find((m) => m.name === 'bm_bminf')!;
    expect(mark).toBeDefined();
    expect(mark.position.y).toBe(BOTTOMLESS_INFINITY.y);
    expect(Math.max(...cases.map((c) => c.position.y))).toBeLessThan(mark.position.y - 0.05);
    // (The ring under it in its colour, 0.7 m like the others', left out.)
    const shape = meshes.filter((m) => !m.name.includes('puring'));
    for (const m of shape) m.computeWorldMatrix(true);
    const lo = Math.min(...shape.map((m) => m.getBoundingInfo().boundingBox.minimumWorld.x));
    const hi = Math.max(...shape.map((m) => m.getBoundingInfo().boundingBox.maximumWorld.x));
    const bottom = Math.min(...shape.map((m) => m.getBoundingInfo().boundingBox.minimumWorld.y));
    const top = Math.max(...shape.map((m) => m.getBoundingInfo().boundingBox.maximumWorld.y));
    expect(hi - lo).toBeGreaterThan(0.3);
    expect(hi - lo).toBeLessThan(0.55);
    expect(top - bottom).toBeLessThan(0.6);
  });
});
