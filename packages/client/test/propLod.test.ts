import { afterEach, describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import '@babylonjs/core/Meshes/meshLODLevel';
import '@babylonjs/core/Meshes/instancedMesh';
import { PROP_LOD_HYSTERESIS, lodWithHysteresis, pickPropLevel, propLodDistance, propLodEdges } from '../src/game/propLod.ts';

const engines: NullEngine[] = [];
afterEach(() => {
  for (const e of engines.splice(0)) e.dispose();
});

describe('prop levels of detail by size on screen (owner, 2026-11-16: a shop shelf popped a few metres away)', () => {
  it('keeps a shop shelf (Shop Shelf, r 1.6 m, written 14 / 40 m) whole to about 40 m, and a chair to 20 m', () => {
    const shelf = propLodEdges([0, 14, 40], 1.6);
    expect(shelf[0]).toBe(0);
    expect(shelf[1]).toBeGreaterThanOrEqual(38);
    expect(shelf[2]).toBeGreaterThan(shelf[1]! * (1 + 2 * PROP_LOD_HYSTERESIS));
    const chair = propLodEdges([0, 10, 28], 0.55);
    expect(chair[1]).toBe(20);
    expect(chair[2]).toBeGreaterThanOrEqual(45);
  });

  it('never brings a level nearer than its family wrote, and caps what size alone asks of a big piece', () => {
    expect(propLodDistance(45, 1, 6.5)).toBe(60);
    expect(propLodDistance(70, 1, 9)).toBe(70);
    expect(propLodDistance(160, 2, 6.5)).toBe(160);
    expect(propLodDistance(0, 0, 3)).toBe(0);
    // A scaled-up copy is bigger on screen: it keeps its full model farther.
    expect(propLodDistance(14, 1, 2.4)).toBeGreaterThan(propLodDistance(14, 1, 1.6));
  });

  it('changes level only past the hysteresis band, either way, and never flickers walking along the line', () => {
    const edges = [0, 40, 120];
    expect(pickPropLevel(10, edges, -1)).toBe(0);
    expect(pickPropLevel(41, edges, -1)).toBe(1);
    // Going out from level 0: not until 40 × 1.15.
    expect(pickPropLevel(45, edges, 0)).toBe(0);
    expect(pickPropLevel(46.5, edges, 0)).toBe(1);
    // Coming back in from level 1: not until 40 × 0.85.
    expect(pickPropLevel(35, edges, 1)).toBe(1);
    expect(pickPropLevel(33.5, edges, 1)).toBe(0);
    // Bobbing back and forth across the line: one change at most.
    let level = 0;
    let changes = 0;
    for (let i = 0; i < 200; i++) {
      const next = pickPropLevel(40 + Math.sin(i) * 4, edges, level);
      if (next !== level) changes++;
      level = next;
    }
    expect(changes).toBe(0);
    // A jump across two boundaries (a respawn) takes the plain choice at once.
    expect(pickPropLevel(130, edges, 0)).toBe(2);
  });

  it('gives GPU instances the same hysteresis (Babylon picks by distance alone)', () => {
    const engine = new NullEngine();
    engines.push(engine);
    const s = new Scene(engine);
    const cam = new FreeCamera('c', new Vector3(0, 0, 0), s);
    const src = CreateBox('src', { size: 1 }, s);
    const low = CreateBox('low', { size: 1 }, s);
    src.addLODLevel(40, low);
    lodWithHysteresis(src);
    const inst = src.createInstance('i');
    const at = (z: number) => {
      inst.position.set(0, 0, z);
      inst.computeWorldMatrix(true);
      return inst.getLOD(cam);
    };
    expect(at(10)).toBe(src);
    expect(at(44)).toBe(src);
    expect(at(47)).toBe(low);
    expect(at(37)).toBe(low);
    expect(at(33)).toBe(src);
    // Another copy keeps its own state.
    const other = src.createInstance('j');
    other.position.set(0, 0, 44);
    other.computeWorldMatrix(true);
    expect(other.getLOD(cam)).toBe(low);
  });
});
