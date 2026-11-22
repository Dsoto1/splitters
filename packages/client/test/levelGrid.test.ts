import { afterEach, describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import type { LinesMesh } from '@babylonjs/core/Meshes/linesMesh';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { BuildAreaVisuals, GRID_ACTIVE, GRID_OTHER } from '../src/editor/buildAreaVisuals.ts';

const engines: NullEngine[] = [];
afterEach(() => engines.splice(0).forEach((e) => e.dispose()));

/** The grid's line vertices: each one's height and colour (r, g, b). */
const lines = (scene: Scene) => {
  const g = scene.meshes.find((m) => m.name === 'grid') as LinesMesh;
  const pos = g.getVerticesData(VertexBuffer.PositionKind)!;
  const col = g.getVerticesData(VertexBuffer.ColorKind)!;
  return Array.from({ length: pos.length / 3 }, (_, i) => ({ y: Math.round(pos[i * 3 + 1]! * 10) / 10, rgb: [col[i * 4]!, col[i * 4 + 1]!, col[i * 4 + 2]!].map((v) => Math.round(v * 100)).join(',') }));
};
const rgb = (hex: string) => {
  const c = Color3.FromHexString(hex);
  return [c.r, c.g, c.b].map((v) => Math.round(v * 100)).join(',');
};

describe("MapMaker's level grids (buildAreaVisuals.ts)", () => {
  it('draws the level being edited in green and the other shown levels in blue, fainter', () => {
    const engine = new NullEngine();
    engines.push(engine);
    const scene = new Scene(engine);
    const area = new BuildAreaVisuals(scene);
    // (No setMap: its outlines' labels need a page. Its defaults: 8 m cells, 4 m levels, Ground being edited.)
    area.update({ x: 0, y: 40, z: -40 }, { x: 0, y: -0.7, z: 0.7 });
    expect(new Set(lines(scene).map((v) => v.rgb))).toEqual(new Set([rgb(GRID_ACTIVE)]));
    expect(new Set(lines(scene).map((v) => v.y))).toEqual(new Set([0]));
    // Levels 1 and 2 have things on them (shown: Show all levels): their grids come in blue, at their own heights.
    area.setOtherLevels([2, 1]);
    area.update({ x: 0, y: 40, z: -40 }, { x: 0, y: -0.7, z: 0.7 });
    const all = lines(scene);
    expect(new Set(all.filter((v) => v.y === 0).map((v) => v.rgb))).toEqual(new Set([rgb(GRID_ACTIVE)]));
    expect(new Set(all.filter((v) => v.y !== 0).map((v) => v.rgb))).toEqual(new Set([rgb(GRID_OTHER)]));
    expect(new Set(all.map((v) => v.y))).toEqual(new Set([0, 4, 8]));
    expect(area.gridState()).toEqual({ active: GRID_ACTIVE, others: [1, 2] });
    // The full grid too.
    area.setGridFull(true);
    area.update({ x: 0, y: 40, z: -40 }, { x: 0, y: -0.7, z: 0.7 });
    expect(new Set(lines(scene).map((v) => v.y))).toEqual(new Set([0, 4, 8]));
  });
});
