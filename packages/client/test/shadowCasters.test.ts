import { afterEach, describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import '@babylonjs/core/Meshes/meshLODLevel';
import '@babylonjs/core/Meshes/instancedMesh';
import type { PropEntity } from '@tiletrigger/shared';
import { ALL_CASCADES, FAR_CASCADES, NEAR_CASCADES, SMALL_REACH_IN, SMALL_REACH_OUT, bySquare, castsInLayer, envShadowSector, envShadowSets, smallCasts } from '../src/game/shadowCasters.ts';
import { PROP_SECTOR, PropBatches } from '../src/game/propBatches.ts';
import { proxyable } from '../src/game/shadowProxy.ts';
import { isStaticCaster } from '../src/game/shadowCache.ts';
import { EnvironmentVisuals } from '../src/environment/environmentVisuals.ts';

const engines: NullEngine[] = [];
afterEach(() => {
  for (const e of engines.splice(0)) e.dispose();
});

function scene(): Scene {
  const engine = new NullEngine();
  engines.push(engine);
  return new Scene(engine);
}

describe('small clutter casts in a band (no shadow blinking at the line)', () => {
  it('in within 20 m, out past 24 m, and between them it keeps what it had', () => {
    expect(SMALL_REACH_IN).toBe(20);
    expect(SMALL_REACH_OUT).toBe(24);
    expect(smallCasts(19.9, false)).toBe(true);
    expect(smallCasts(22, false)).toBe(false);
    expect(smallCasts(22, true)).toBe(true);
    expect(smallCasts(24.1, true)).toBe(false);
  });

  it('a camera pacing back and forth across the line changes a caster once each way, never every step', () => {
    let on = false;
    let changes = 0;
    // Walk in from 30 m to 10 m and out again, wobbling ±1.5 m each step (a player strafing at the line).
    const path: number[] = [];
    for (let d = 30; d >= 10; d -= 0.5) path.push(d + (path.length % 2 ? 1.5 : -1.5));
    for (let d = 10; d <= 30; d += 0.5) path.push(d + (path.length % 2 ? 1.5 : -1.5));
    for (const d of path) {
      const now = smallCasts(d, on);
      if (now !== on) changes++;
      on = now;
      // Within 20 m it always casts: no shadow pops inside it.
      if (d <= SMALL_REACH_IN) expect(on).toBe(true);
    }
    expect(changes).toBe(2);
  });
});

describe('static shadow sets for trees and rocks, by cascade', () => {
  it('near cascades take full detail, the far one the lightest level that casts today; the card stand-in never', () => {
    // Trees: 3 meshed levels and the crossed cards.
    expect(envShadowSets([{ crossed: false }, { crossed: false }, { crossed: false }, { crossed: true }])).toEqual([
      { level: 0, mask: NEAR_CASCADES },
      { level: 2, mask: FAR_CASCADES },
    ]);
    // Shrubs: three levels, the last too light to cast (as before: a level from max(2, levels - 1) on casts nothing).
    expect(envShadowSets([{ crossed: false }, { crossed: false }, { crossed: false }])).toEqual([
      { level: 0, mask: NEAR_CASCADES },
      { level: 1, mask: FAR_CASCADES },
    ]);
    // One level (grass, a rock): one set for every cascade.
    expect(envShadowSets([{ crossed: false }])).toEqual([{ level: 0, mask: ALL_CASCADES }]);
    expect(envShadowSets([{ crossed: true }])).toEqual([]);
    // Small species (environment Phase 5): the near cascades only, at full detail.
    expect(envShadowSets([{ crossed: false }, { crossed: false }, { crossed: true }], true)).toEqual([{ level: 0, mask: NEAR_CASCADES }]);
    expect(envShadowSets([{ crossed: false }], true)).toEqual([{ level: 0, mask: NEAR_CASCADES }]);
  });

  it('each cascade draws its own set; Medium\'s one map is cascade 0; untagged casters draw everywhere', () => {
    expect([0, 1, 2].map((l) => castsInLayer(NEAR_CASCADES, l))).toEqual([true, true, false]);
    expect([0, 1, 2].map((l) => castsInLayer(FAR_CASCADES, l))).toEqual([false, false, true]);
    expect([0, 1, 2].map((l) => castsInLayer(ALL_CASCADES, l))).toEqual([true, true, true]);
    expect([0, 1, 2].map((l) => castsInLayer(undefined, l))).toEqual([true, true, true]);
    expect(envShadowSector(FAR_CASCADES)).toBeGreaterThan(envShadowSector(NEAR_CASCADES));
  });

  it('sorts every copy into exactly one square', () => {
    const copies = Array.from({ length: 200 }, (_, i) => ({ x: ((i * 37) % 400) - 200, z: ((i * 91) % 400) - 200, i }));
    const squares = bySquare(copies, 64);
    const seen = [...squares.values()].flat().map((c) => c.i).sort((a, b) => a - b);
    expect(seen).toEqual(copies.map((c) => c.i));
    for (const [k, list] of squares) for (const c of list) expect(`${Math.floor(c.x / 64)}:${Math.floor(c.z / 64)}`).toBe(k);
  });

  it('the environment renderer casts through sets made once: the drawn batches cast nothing, walking changes no set', async () => {
    const s = scene();
    const env = new EnvironmentVisuals(s, 'medium', { shadowSets: true });
    // A stand-in model (four levels, two parts each, the last crossed) instead of the GLB.
    const internals = env as unknown as {
      model(file: string): Promise<unknown>;
      loaded: Map<string, unknown>;
      templates: Map<string, Mesh[][]>;
    };
    internals.model = (file: string) => {
      const levels = [0, 30, 70, 140].map((distance, li) => ({ distance, crossed: li === 3, parts: [] }));
      internals.loaded.set(file, { levels, triangles: [24, 24, 24, 2] });
      internals.templates.set(
        file,
        levels.map((_, li) =>
          [0, 1].map((pi) => {
            const m = CreateBox(`tpl_${li}_${pi}`, { size: 1 }, s);
            m.material = new StandardMaterial(`tplmat_${li}_${pi}`, s);
            m.setEnabled(false);
            return m;
          }),
        ),
      );
      return Promise.resolve(internals.loaded.get(file));
    };
    const tree = (id: string, x: number, z: number): PropEntity => ({ id, kind: 'prop', model: 'env.conifer.spruce', position: [x, 0, z], yaw: 0, scale: 1, solid: true, tint: null }) as PropEntity;
    // Five spruces: three in one 64 m square, one in the next, one far off (another 256 m square too).
    await env.setPlacements([tree('a', 5, 5), tree('b', 10, 20), tree('c', 30, 40), tree('d', 70, 5), tree('e', 300, 5)], null);
    const sets = () => s.meshes.filter((m) => m.name.startsWith('envshadow_')) as Mesh[];
    const near = sets().filter((m) => (m.metadata as { shadowLayers: number }).shadowLayers === NEAR_CASCADES);
    const far = sets().filter((m) => (m.metadata as { shadowLayers: number }).shadowLayers === FAR_CASCADES);
    // Near: three 64 m squares × two parts; far: two 256 m squares × two parts.
    expect(near.length).toBe(6);
    expect(far.length).toBe(4);
    expect(near.every((m) => m.name.includes('_l0_'))).toBe(true);
    expect(far.every((m) => m.name.includes('_l2_'))).toBe(true);
    expect(near.reduce((n, m) => n + m.thinInstanceCount, 0)).toBe(5 * 2);
    expect(far.reduce((n, m) => n + m.thinInstanceCount, 0)).toBe(5 * 2);
    for (const m of sets()) {
      expect(m.layerMask).toBe(0);
      expect(m.isEnabled()).toBe(true);
      // Static for good: the static shadow cache keeps them from the first frame.
      expect(isStaticCaster(m)).toBe(true);
    }
    const before = sets().map((m) => [m.name, m.thinInstanceCount, [...m.thinInstanceGetWorldMatrices().map((w) => w.m[12])]]);
    env.update(new Vector3(0, 0, 0));
    const drawn = s.meshes.filter((m) => m.name.startsWith('env_') && m.isEnabled());
    expect(drawn.length).toBeGreaterThan(0);
    expect(drawn.every((m) => (m.metadata as { castsNoShadow?: boolean } | null)?.castsNoShadow)).toBe(true);
    // Walk across the map: the drawn levels change, the shadow sets don't (the static cache keeps them).
    for (let x = 0; x <= 300; x += 10) env.update(new Vector3(x, 0, 0));
    expect(sets().map((m) => [m.name, m.thinInstanceCount, [...m.thinInstanceGetWorldMatrices().map((w) => w.m[12])]])).toEqual(before);
    expect(env.stats().shadowBatches).toBe(10);
    // Placed again (MapMaker, a new round of the map): the old sets go with the old batches.
    await env.setPlacements([tree('a', 5, 5)], null);
    expect(sets().length).toBe(4);
    env.dispose();
    expect(sets().length).toBe(0);
  });

  it('without them (?perfoff=smallcasters) the drawn near batches cast, as before', async () => {
    const s = scene();
    const env = new EnvironmentVisuals(s, 'medium');
    const internals = env as unknown as { model(file: string): Promise<unknown>; loaded: Map<string, unknown>; templates: Map<string, Mesh[][]> };
    internals.model = (file: string) => {
      internals.loaded.set(file, { levels: [{ distance: 0, crossed: false, parts: [] }], triangles: [12] });
      const m = CreateBox('tpl', { size: 1 }, s);
      m.setEnabled(false);
      internals.templates.set(file, [[m]]);
      return Promise.resolve(internals.loaded.get(file));
    };
    await env.setPlacements([{ id: 'a', kind: 'prop', model: 'env.conifer.spruce', position: [1, 0, 1], yaw: 0, scale: 1, solid: true, tint: null } as PropEntity], null);
    env.update(new Vector3(0, 0, 0));
    expect(s.meshes.some((m) => m.name.startsWith('envshadow_'))).toBe(false);
    const drawn = s.meshes.filter((m) => m.name.startsWith('env_') && m.isEnabled());
    expect(drawn.length).toBe(1);
    expect((drawn[0]!.metadata as { castsNoShadow?: boolean } | null)?.castsNoShadow).toBeFalsy();
  });
});

/** A model's merged source with a lighter level, as ModelLibrary.staticSources gives it: parked. */
function lodSource(s: Scene, name: string, billboard = false): Mesh[] {
  const a = CreateBox(`${name}_a`, { size: 1 }, s);
  a.material = new StandardMaterial(`${name}_ma`, s);
  a.position.y = -10000;
  const low = CreateBox(`${name}_low`, { size: 1 }, s);
  low.material = a.material;
  low.position.y = -10000;
  if (billboard) low.billboardMode = Mesh.BILLBOARDMODE_Y;
  a.addLODLevel(16, low);
  return [a];
}

function placed(s: Scene, name: string, x: number, z: number): TransformNode {
  const n = new TransformNode(name, s);
  n.position.set(x, 0, z);
  return n;
}

describe('props with levels of detail cast at full detail through the shadow proxies', () => {
  it('a GPU instance of a model with levels can stand in a proxy (full detail); not a picture card, not without the switch', () => {
    const s = scene();
    const [src] = lodSource(s, 'wall');
    const copy = src!.createInstance('wall_1');
    copy.position.set(3, 0, 4);
    copy.computeWorldMatrix(true);
    copy.freezeWorldMatrix();
    expect(proxyable(copy, true)).toBe(true);
    expect(proxyable(copy, false)).toBe(false);
    // The parked source and its levels never do (its copies do).
    expect(proxyable(src!, true)).toBe(false);
    const [card] = lodSource(s, 'plant', true);
    const plant = card!.createInstance('plant_1');
    plant.computeWorldMatrix(true);
    plant.freezeWorldMatrix();
    expect(proxyable(plant, true)).toBe(false);
    // A prop that can break keeps casting on its own (a proxy would keep its shadow once it is broken).
    const crate = src!.createInstance('crate_1');
    crate.metadata = { breakable: true };
    crate.computeWorldMatrix(true);
    crate.freezeWorldMatrix();
    expect(proxyable(crate, true)).toBe(false);
  });

  it('batched copies with levels cast through static full-detail batches per square; their drawn batches cast nothing', async () => {
    const s = scene();
    const src = lodSource(s, 'lamp');
    const batches = new PropBatches(s, async () => src, 20, true);
    const near = placed(s, 'n', 5, 5);
    const far = placed(s, 'f', PROP_SECTOR + 10, 5);
    const inside = placed(s, 'i', 8, 8);
    for (const [r, indoor] of [
      [near, false],
      [far, false],
      [inside, true],
    ] as const)
      expect(await batches.add('lamp', r, false, null, indoor)).toBe(true);
    batches.update(new Vector3(0, 0, 0));
    const shadows = () => s.meshes.filter((m) => m.name.startsWith('static_shadow_')) as Mesh[];
    // Two squares, one part each; the indoor copy casts nothing (the roof's shadow covers it).
    expect(shadows().length).toBe(2);
    expect(shadows().reduce((n, m) => n + m.thinInstanceCount, 0)).toBe(2);
    for (const m of shadows()) {
      expect(m.layerMask).toBe(0);
      expect((m.metadata as { staticThin?: boolean }).staticThin).toBe(true);
      // Full detail, merged into the proxies like any never-changing batch.
      expect(m.getTotalIndices()).toBe(src[0]!.getTotalIndices());
      expect(proxyable(m, true)).toBe(true);
    }
    const drawn = s.meshes.filter((m) => m.name.startsWith('static_batch_') && m.isEnabled());
    expect(drawn.length).toBeGreaterThan(0);
    expect(drawn.every((m) => (m.metadata as { castsNoShadow?: boolean }).castsNoShadow)).toBe(true);
    // Walking about changes the drawn levels, never the shadow batches.
    const was = shadows().map((m) => m.name);
    for (let x = 0; x <= 200; x += 5) batches.update(new Vector3(x, 0, 0));
    expect(shadows().map((m) => m.name)).toEqual(was);
    expect(batches.stats().shadows).toBe(2);
    batches.dispose();
    expect(shadows().length).toBe(0);
  });

  it('without the switch (?perfoff=smallcasters) batches with levels cast as they draw, as before', async () => {
    const s = scene();
    const src = lodSource(s, 'lamp');
    const batches = new PropBatches(s, async () => src, 15);
    await batches.add('lamp', placed(s, 'n', 5, 5), false, null);
    batches.update(new Vector3(0, 0, 0));
    expect(s.meshes.some((m) => m.name.startsWith('static_shadow_'))).toBe(false);
    const drawn = s.meshes.filter((m) => m.name.startsWith('static_batch_') && m.isEnabled());
    expect(drawn.every((m) => !(m.metadata as { castsNoShadow?: boolean }).castsNoShadow)).toBe(true);
  });

  it('small clutter\'s near shadow batch takes copies in the band: in at 20 m, kept to 24 m', async () => {
    const s = scene();
    const src = lodSource(s, 'can');
    const batches = new PropBatches(s, async () => src, 20, true);
    await batches.add('can', placed(s, 'c', 0, 0), true, null);
    const nearBatch = () => s.meshes.find((m) => m.name.startsWith('static_batch_near')) as Mesh;
    const casts = () => nearBatch().isEnabled() && nearBatch().thinInstanceCount === 1;
    // The copy's bounds reach about 0.87 m from its centre: distances below are to the camera from them.
    const r = Math.sqrt(3) / 2;
    batches.update(new Vector3(30 + r, 0, 0));
    expect(casts()).toBe(false);
    batches.update(new Vector3(22 + r, 0, 0));
    expect(casts()).toBe(false);
    batches.update(new Vector3(19 + r, 0, 0));
    expect(casts()).toBe(true);
    batches.update(new Vector3(23 + r, 0, 0));
    expect(casts()).toBe(true);
    batches.update(new Vector3(25 + r, 0, 0));
    expect(casts()).toBe(false);
  });
});
