import { afterEach, describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { createAura } from '../src/game/arsenalVisuals.ts';

const engines: NullEngine[] = [];
afterEach(() => {
  for (const e of engines.splice(0)) e.dispose();
});

describe('status auras share their shapes (Flavius Rule memory, 2026-11-16)', () => {
  it('gives every aura the same geometry, made once, and keeps it when auras go', () => {
    const engine = new NullEngine();
    engines.push(engine);
    const scene = new Scene(engine);
    const a = createAura(scene, new TransformNode('a', scene));
    const b = createAura(scene, new TransformNode('b', scene));
    const rimOf = (m: Mesh) => m.getChildMeshes()[0] as Mesh;
    expect(a.geometry).toBe(b.geometry);
    expect(rimOf(a).geometry).toBe(rimOf(b).geometry);
    expect(a.getTotalVertices()).toBeGreaterThan(0);
    expect(rimOf(a).getTotalVertices()).toBeGreaterThan(a.getTotalVertices());
    // The shell is body-sized: about 2 m tall, 1 m across.
    const size = a.getBoundingInfo().boundingBox.extendSize;
    expect(size.y * 2).toBeCloseTo(1.95, 2);
    expect(size.x * 2).toBeCloseTo(1.0, 1);
    const geometries = scene.geometries.length;
    a.dispose();
    const c = createAura(scene, new TransformNode('c', scene));
    expect(c.geometry).toBe(b.geometry);
    expect(b.geometry?.isDisposed()).toBe(false);
    expect(scene.geometries.length).toBe(geometries);
    // Their shapes stay hidden.
    expect(scene.meshes.filter((m) => m.name.endsWith('_shape')).every((m) => !m.isEnabled())).toBe(true);
  });
});
