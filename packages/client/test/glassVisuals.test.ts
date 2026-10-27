import { afterEach, describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { MapDocument, MapEntity } from '@tiletrigger/shared';
import { GlassVisuals } from '../src/game/glassVisuals.ts';
import { makeMap } from '../../shared/test/helpers.ts';

const engines: NullEngine[] = [];
afterEach(() => {
  for (const e of engines.splice(0)) e.dispose();
});

function scene(): Scene {
  const engine = new NullEngine();
  engines.push(engine);
  return new Scene(engine);
}

const pane = (id: string, x: number, z: number): MapEntity => ({ id, kind: 'destructible', model: 'glass', position: [x, 0, z], yaw: 0 }) as MapEntity;
const block = (id: string, x: number, glass: 'breakable' | 'reinforced'): MapEntity =>
  ({ id, kind: 'block', position: [x, 0, 0], size: [2, 2, 0.06], yaw: 0, material: null, tint: null, behaviour: 'solid', trigger: 'logic', delaySeconds: 0.8, respawnSeconds: null, health: 120, glass }) as MapEntity;

/** A room with a glazed window, two Window panes far apart and two glass blocks. */
function glassMap(): MapDocument {
  const map = makeMap([{ id: 'west', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0, edges: { '0,0,0:E': 'window' }, glass: { '0,0,0:E': 'reinforced' } }]);
  return { ...map, entities: [...map.entities, pane('p1', 10, 10), pane('p2', 90, 10), block('b1', 12, 'breakable'), block('b2', 14, 'reinforced')] };
}

/** A pane's instance buffers (its chunk's matrices and colours, and its slot in them). */
type Inside = { panes: { index: number; slot: number; chunk: { matrices: Float32Array; colors: Float32Array } }[] };
const instance = (g: GlassVisuals, index: number) => {
  const p = (g as unknown as Inside).panes.find((q) => q.index === index)!;
  const m = p.chunk.matrices;
  return { alpha: p.chunk.colors[p.slot * 4 + 3]!, scale: Math.hypot(m[p.slot * 16]!, m[p.slot * 16 + 1]!, m[p.slot * 16 + 2]!) };
};

describe('glass visuals', () => {
  it('instances every pane in a few meshes, one per 32 m square, with one shared material', () => {
    const s = scene();
    const g = new GlassVisuals(s);
    g.build(glassMap());
    const meshes = s.meshes.filter((m) => m.name.startsWith('glass_panes_')) as Mesh[];
    // The window, p1 and the blocks share the first square; p2 is 80 m away.
    expect(g.counts.panes).toBe(5);
    expect(meshes.length).toBe(2);
    expect(new Set(meshes.map((m) => m.material)).size).toBe(1);
    expect(meshes.reduce((n, m) => n + m.thinInstanceCount, 0)).toBe(5);
    // Window panes have a cross frame (one mesh for all of them).
    expect((s.meshes.find((m) => m.name === 'glass_frames') as Mesh | undefined)?.thinInstanceCount).toBe(4);
    // MapMaker draws the entities itself: only the window glass here.
    g.build(glassMap(), { windowsOnly: true });
    expect(g.counts.panes).toBe(1);
  });

  it('cracks where a round stops on a pane, frosts bulletproof glass, and forgets both when the pane is whole again', () => {
    const s = scene();
    const g = new GlassVisuals(s);
    const map = glassMap();
    g.build(map);
    const window = map.entities.length;
    // The window is in the room's east wall (x 3.75), from 0.9 to 2.5 m up.
    const hit = g.strike({ x: 0, y: 1.6, z: 0.3 }, { x: 3.72, y: 1.6, z: 0.3 });
    expect(hit).not.toBeNull();
    expect(hit!.normal.x).toBeCloseTo(-1);
    expect(g.counts.cracks).toBe(1);
    // A round that went on past the glass (shot through it, or missed) leaves no crack.
    expect(g.strike({ x: 0, y: 1.6, z: 0.3 }, { x: 9, y: 1.6, z: 0.3 })).toBeNull();
    g.apply(new Map([[window, [40, 0]]]));
    // Frosted: whiter and more opaque.
    expect(instance(g, window).alpha).toBeGreaterThan(1.5);
    g.apply(new Map([[window, [100, 0]]]));
    expect(instance(g, window).alpha).toBeCloseTo(1);
    expect(g.counts.cracks).toBe(0);
  });

  it('drops broken panes out of their instances', () => {
    const s = scene();
    const g = new GlassVisuals(s);
    const map = glassMap();
    g.build(map);
    const p1 = map.entities.findIndex((e) => e.id === 'p1');
    expect(g.standing()).toBe(5);
    g.apply(new Map([[p1, [0, 0]]]));
    expect(g.standing()).toBe(4);
    expect(g.paneAt(p1)!.framed).toBe(true);
    expect(instance(g, p1).scale).toBe(0);
    g.apply(new Map([[p1, [100, 0]]]));
    expect(instance(g, p1).scale).toBeGreaterThan(1);
    g.apply(new Map([[p1, [0, 0]]]));
    expect(g.strike({ x: 10, y: 1.7, z: 5 }, { x: 10, y: 1.7, z: 9.96 })).toBeNull();
  });
});
