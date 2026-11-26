import { afterEach, describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
// Side effects ImpactVisuals' instanced effects need (the game view loads them).
import '@babylonjs/core/Meshes/instancedMesh';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import type { WorldBox } from '@tiletrigger/shared';
import { HoleBook, PROP_HOLE_CAP, PROP_HOLED_MAX, holeLook, propHoleTargets, strikeProp } from '../src/game/propHoles.ts';
import { ImpactVisuals } from '../src/game/impactVisuals.ts';

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

/** A crate's root as createPropNode makes it: at its place, scaled, turned by its yaw. */
function crate(s: Scene, name: string, x: number, z: number, yaw = 0, scale = 1): TransformNode {
  const root = new TransformNode(name, s);
  root.position.set(x, 0, z);
  root.scaling.setAll(scale);
  root.rotationQuaternion = Quaternion.RotationAxis(Vector3.Up(), yaw);
  return root;
}

/** Its collision box as shared propBoxes gives it (a 1 m crate, times its scale). */
function crateBox(id: string, x: number, z: number, yaw = 0, scale = 1): WorldBox {
  const h = 0.5 * scale;
  return { min: [x - h, 0, z - h], max: [x + h, 2 * h, z + h], kind: 'prop', sourceId: id, ...(yaw ? { yaw } : {}) };
}

describe('HoleBook (holes on props: a cap each, a budget of props)', () => {
  it('attaches holes in a ring per prop, capped, the oldest slot reused', () => {
    const book = new HoleBook<string>(3, 10);
    expect(book.add('a')).toEqual({ slot: 0, count: 1, evicted: null });
    expect(book.add('a').slot).toBe(1);
    expect(book.add('a').slot).toBe(2);
    expect(book.add('a')).toEqual({ slot: 0, count: 3, evicted: null });
    expect(book.count('a')).toBe(3);
    expect(book.add('b').slot).toBe(0);
  });

  it('gives up the prop holed longest ago past the budget', () => {
    const book = new HoleBook<string>(4, 2);
    book.add('a');
    book.add('b');
    // `a` holed again: now `b` is the one holed longest ago.
    book.add('a');
    expect(book.add('c').evicted).toBe('b');
    expect(book.count('b')).toBe(0);
    expect([...book.keys()]).toEqual(['a', 'c']);
  });

  it('clears a prop that broke or came back', () => {
    const book = new HoleBook<string>(4, 2);
    book.add('a');
    expect(book.clear('a')).toBe(true);
    expect(book.clear('a')).toBe(false);
    expect(book.count('a')).toBe(0);
    expect(book.add('a').slot).toBe(0);
  });
});

describe('strikeProp (a round stopping on a breakable prop)', () => {
  it('finds the crate the round stopped on, in its root frame and the world, and skips a broken one', () => {
    const s = scene();
    const a = crate(s, 'prop_a', 10, 0);
    const b = crate(s, 'prop_b', 10, 3);
    const nodes = new Map([
      ['a', a],
      ['b', b],
    ]);
    const targets = propHoleTargets([crateBox('a', 10, 0), crateBox('b', 10, 3)], (id) => nodes.get(id), () => 'wood');
    expect(targets).toHaveLength(2);
    const hit = strikeProp(targets, { x: 0, y: 0.5, z: 0 }, { x: 9.5, y: 0.5, z: 0 });
    expect(hit?.node).toBe(a);
    expect(hit!.surface).toBe('wood');
    expect(hit!.point.x).toBeCloseTo(9.5, 4);
    expect(hit!.normal.x).toBeCloseTo(-1, 4);
    expect(hit!.local.point.x).toBeCloseTo(-0.5, 4);
    expect(hit!.local.point.y).toBeCloseTo(0.5, 4);
    // Past it, short of it, beside both: nothing.
    expect(strikeProp(targets, { x: 0, y: 0.5, z: 0 }, { x: 14, y: 0.5, z: 0 })).toBeNull();
    expect(strikeProp(targets, { x: 0, y: 0.5, z: 1.5 }, { x: 9.5, y: 0.5, z: 1.5 })).toBeNull();
    // Broken (its root off): a round there finds nothing.
    a.setEnabled(false);
    expect(strikeProp(targets, { x: 0, y: 0.5, z: 0 }, { x: 9.5, y: 0.5, z: 0 })).toBeNull();
  });

  it('follows a turned, scaled prop and one that moved', () => {
    const s = scene();
    const yaw = Math.PI / 4;
    const root = crate(s, 'prop_t', 10, 0, yaw, 2);
    const targets = propHoleTargets([crateBox('t', 10, 0, yaw, 2)], () => root, () => null);
    // Turned 45°, a 2 m crate's corner points at the shooter: 0.3 m off that corner, a round meets a face √2 − 0.3 m short of its centre.
    const at = 10 - Math.SQRT2 + 0.3;
    const hit = strikeProp(targets, { x: 0, y: 1, z: 0.3 }, { x: at, y: 1, z: 0.3 });
    expect(hit?.node).toBe(root);
    // In the root's frame (scaled 2) the face is at ±0.5.
    expect(Math.max(Math.abs(hit!.local.point.x), Math.abs(hit!.local.point.z))).toBeCloseTo(0.5, 3);
    // Moved 5 m along z: found where it is drawn now.
    root.position.z = 5;
    expect(strikeProp(targets, { x: 0, y: 1, z: 0.3 }, { x: at, y: 1, z: 0.3 })).toBeNull();
    expect(strikeProp(targets, { x: 0, y: 1, z: 5.3 }, { x: at, y: 1, z: 5.3 })?.node).toBe(root);
  });
});

describe('holes on breakable props (owner, 2026-11-24)', () => {
  it('attaches holes under the prop root, capped, gone when it breaks and when it comes back', () => {
    const s = scene();
    const fx = new ImpactVisuals(s, () => null);
    const root = crate(s, 'prop_c', 0, 0);
    for (let i = 0; i < PROP_HOLE_CAP + 5; i++) fx.holeOnProp(root, { x: -0.5, y: 0.5, z: 0 }, { x: -1, y: 0, z: 0 }, 1, 'wood');
    expect(fx.propHolesOn(root)).toBe(PROP_HOLE_CAP);
    // The prop's own: a disc under its root, thin instances, the decal tinted for wood.
    const holes = root.getChildMeshes().find((m) => m.name.endsWith('_holes')) as Mesh;
    expect(holes.thinInstanceCount).toBe(PROP_HOLE_CAP);
    expect(holes.material?.name).toBe('bulletHoleMat_wood');
    // Breaks (GameView.setPropShown clears, then switches the root off): no holes, the decal mesh gone.
    fx.clearPropHoles(root);
    root.setEnabled(false);
    expect(fx.propHolesOn(root)).toBe(0);
    expect(holes.isDisposed()).toBe(true);
    // Back at a new round and holed again: a fresh start.
    root.setEnabled(true);
    fx.holeOnProp(root, { x: -0.5, y: 0.5, z: 0 }, { x: -1, y: 0, z: 0 }, 1, 'metal');
    expect(fx.propHolesOn(root)).toBe(1);
    fx.dispose();
  });

  it('keeps at most PROP_HOLED_MAX props holed, giving up the one holed longest ago', () => {
    const s = scene();
    const fx = new ImpactVisuals(s, () => null);
    const roots = Array.from({ length: PROP_HOLED_MAX + 1 }, (_, i) => crate(s, `prop_${i}`, i * 2, 0));
    for (const r of roots) fx.holeOnProp(r, { x: -0.5, y: 0.5, z: 0 }, { x: -1, y: 0, z: 0 }, 1, null);
    expect(fx.holedProps).toBe(PROP_HOLED_MAX);
    expect(fx.propHolesOn(roots[0]!)).toBe(0);
    expect(roots[0]!.getChildMeshes()).toHaveLength(0);
    expect(fx.propHolesOn(roots[PROP_HOLED_MAX]!)).toBe(1);
    fx.dispose();
  });

  it('looks by surface: wood, metal (smaller), stone (wider), plain when unknown', () => {
    expect(holeLook('wood').key).toBe('wood');
    expect(holeLook('thin_wood').key).toBe('wood');
    expect(holeLook('sheet_metal').key).toBe('metal');
    expect(holeLook('metal').scale).toBeLessThan(1);
    expect(holeLook('stone').key).toBe('stone');
    expect(holeLook(null).key).toBe('plain');
  });
});
