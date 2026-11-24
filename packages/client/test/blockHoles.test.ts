import { afterEach, describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { newMapDocument, type MapDocument, type MapEntity } from '@tiletrigger/shared';
import { BLOCK_HOLE_SLACK, rayBoxLocalHit } from '../src/game/blockHoles.ts';
import { ImpactVisuals } from '../src/game/impactVisuals.ts';
import { ScenarioVisuals } from '../src/game/scenarioVisuals.ts';

const engines: NullEngine[] = [];
afterEach(() => {
  for (const e of engines.splice(0)) e.dispose();
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

describe('rayBoxLocalHit (a round stopping on a block the scenario drives)', () => {
  const half = { x: 0.1, y: 0.95, z: 0.6 };
  const at = Matrix.Translation(25, 0.95, 0);

  it('finds the face a round stopped on, in the block frame', () => {
    const hit = rayBoxLocalHit({ x: 0, y: 1.5, z: 0 }, { x: 24.9, y: 1.5, z: 0 }, at, half);
    expect(hit).not.toBeNull();
    expect(hit!.dist).toBeCloseTo(24.9, 5);
    expect(hit!.normal.asArray()).toEqual([-1, 0, 0]);
    expect(hit!.point.x).toBeCloseTo(-0.1, 5);
    expect(hit!.point.y).toBeCloseTo(0.55, 5);
  });

  it('none when the round went past the block or stopped well short of it', () => {
    // Past it (the block is gone in the game, or the round flew by): the face is far nearer than where it stopped.
    expect(rayBoxLocalHit({ x: 0, y: 1.5, z: 0 }, { x: 40, y: 1.5, z: 0 }, at, half)).toBeNull();
    // Short of it (stopped on something first).
    expect(rayBoxLocalHit({ x: 0, y: 1.5, z: 0 }, { x: 24.9 - BLOCK_HOLE_SLACK - 0.1, y: 1.5, z: 0 }, at, half)).toBeNull();
    // Beside it.
    expect(rayBoxLocalHit({ x: 0, y: 1.5, z: 2 }, { x: 24.9, y: 1.5, z: 2 }, at, half)).toBeNull();
  });

  it('follows a moved and turned block (a mover carrying it)', () => {
    const turned = Matrix.Compose(new Vector3(1, 1, 1), Quaternion.RotationAxis(Vector3.Up(), Math.PI / 2), new Vector3(10, 0.95, 5));
    // Turned a quarter, the block's thin X side faces along world Z: a round along +X meets its wide side (local Z face).
    const hit = rayBoxLocalHit({ x: 0, y: 1, z: 5 }, { x: 9.4, y: 1, z: 5 }, turned, half);
    expect(hit).not.toBeNull();
    expect(Math.abs(hit!.normal.z)).toBe(1);
    expect(hit!.dist).toBeCloseTo(9.4, 5);
  });

  it('none from inside the block', () => {
    expect(rayBoxLocalHit({ x: 25, y: 1, z: 0 }, { x: 25.05, y: 1, z: 0.5 }, at, half)).toBeNull();
  });
});

describe('holes on breakable and moving blocks (owner: the Training Range boards left no marks)', () => {
  function rangeMap(): MapDocument {
    const map = newMapDocument('range', new Date(0));
    const board = (id: string, x: number, z: number): MapEntity => ({ id, position: [x, 0, z], kind: 'block', size: [0.2, 1.9, 1.2], yaw: 0, material: 'core.crate_wood', tint: null, behaviour: 'breakable', trigger: 'step', delaySeconds: 0.8, respawnSeconds: 4, health: 600 }) as MapEntity;
    map.entities.push(board('static_25', 25, 0), board('walk_25_board', 25, 8));
    map.entities.push({ id: 'walk_25', position: [25, 0, 8], name: 'walking', kind: 'mover', yaw: 0, blocks: ['walk_25_board'], points: [[0, 0, 0], [0, 0, 8]], mode: 'pingpong', speed: 3.9, turnSpeed: 45, wait: 0.4, startActive: true } as MapEntity);
    return map;
  }

  it('a round stopping on a breakable board finds it, holes it, and the holes go when it comes back', () => {
    const s = scene();
    const map = rangeMap();
    const sv = new ScenarioVisuals(s);
    sv.build(map.entities, map);
    const fx = new ImpactVisuals(s, () => null);
    sv.onBlockReset = (body) => fx.clearHolesOn(body);
    const strike = sv.strikeBlock({ x: 0, y: 1.5, z: 0 }, { x: 24.9, y: 1.5, z: 0 });
    expect(strike).not.toBeNull();
    expect(strike!.material).toBe('core.crate_wood');
    expect(strike!.point.x).toBeCloseTo(24.9, 3);
    expect(strike!.normal.x).toBeCloseTo(-1, 5);
    fx.holeOn(strike!.body, strike!.local.point, strike!.local.normal, 1);
    fx.holeOn(strike!.body, strike!.local.point, strike!.local.normal, 1);
    expect(fx.holesOn(strike!.body)).toBe(2);
    // The holes are the block's own: a disc mesh under its body, drawn as thin instances.
    const holes = strike!.body.getChildMeshes().find((m) => m.name.endsWith('_holes')) as Mesh;
    expect(holes.thinInstanceCount).toBe(2);
    // Broken, then back: whole again.
    const i = map.entities.findIndex((e) => e.id === 'static_25');
    sv.apply(new Map([[i, [0, 0] as const]]));
    expect(fx.holesOn(strike!.body)).toBe(2);
    sv.apply(new Map([[i, [100, 0] as const]]));
    expect(fx.holesOn(strike!.body)).toBe(0);
    expect(holes.thinInstanceCount).toBe(0);
    fx.dispose();
    sv.dispose();
  });

  it('a board a mover carries is found where it is drawn now', () => {
    const s = scene();
    const map = rangeMap();
    const sv = new ScenarioVisuals(s);
    sv.build(map.entities, map);
    const body = sv.node(map.entities.findIndex((e) => e.id === 'walk_25_board'))!;
    // As applyMovers places it: moved 5 m along the lane.
    body.position.set(25, 0, 13);
    expect(sv.strikeBlock({ x: 0, y: 1.5, z: 8 }, { x: 24.9, y: 1.5, z: 8 })).toBeNull();
    const hit = sv.strikeBlock({ x: 0, y: 1.5, z: 13 }, { x: 24.9, y: 1.5, z: 13 });
    expect(hit?.point.z).toBeCloseTo(13, 3);
    sv.dispose();
  });
});
