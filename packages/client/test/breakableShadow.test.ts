import { afterEach, describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import '@babylonjs/core/Meshes/instancedMesh';
import type { PropEntity } from '@tiletrigger/shared';
import type { ModelLibrary } from '../src/content/models.ts';
import { createPropNode } from '../src/game/propVisuals.ts';
import { buildShadowProxies, proxyable } from '../src/game/shadowProxy.ts';

const engines: NullEngine[] = [];
afterEach(() => {
  for (const e of engines.splice(0)) e.dispose();
});

function scene(): Scene {
  const engine = new NullEngine();
  engines.push(engine);
  return new Scene(engine);
}

/** A model library whose static copies are GPU instances of one parked box (no levels of detail), as instantiateStatic makes. */
function library(s: Scene): ModelLibrary {
  const src = CreateBox('src', { size: 1 }, s);
  src.material = new StandardMaterial('src_mat', s);
  src.position.y = -10000;
  const copy = async (_file: string, name: string) => {
    const root = new TransformNode(name, s);
    const inst = src.createInstance(`${name}_inst`);
    inst.position.setAll(0);
    inst.parent = root;
    return root;
  };
  return { instantiateStatic: copy, instantiate: copy } as unknown as ModelLibrary;
}

const prop = (id: string, x: number): PropEntity => ({ id, kind: 'prop', model: 'kit.wall.stone', position: [x, 0, 0], yaw: 0, scale: 1, solid: true, tint: null }) as PropEntity;

async function placed(s: Scene, lib: ModelLibrary, e: PropEntity, breakable: boolean): Promise<{ root: TransformNode; meshes: AbstractMesh[] }> {
  const root = createPropNode(s, lib, e, `prop_${e.id}`, true, true, null, null, false, breakable);
  // The model comes in a microtask or two later.
  for (let i = 0; i < 5; i++) await Promise.resolve();
  const meshes = root.getChildMeshes();
  for (const m of meshes) m.computeWorldMatrix(true);
  return { root, meshes };
}

describe('a broken prop takes its shadow with it', () => {
  it('a prop that can break (no levels of detail, a few copies: GPU instances) never casts through the merged proxies', async () => {
    const s = scene();
    const lib = library(s);
    const plain = await placed(s, lib, prop('a', 3), false);
    const crate = await placed(s, lib, prop('b', 6), true);
    expect(plain.meshes.length).toBe(1);
    expect(crate.meshes.length).toBe(1);
    expect((crate.meshes[0]!.metadata as { breakable?: boolean }).breakable).toBe(true);
    // With and without cheaper small casters' levels-of-detail path.
    for (const lodInstances of [true, false]) {
      expect(proxyable(plain.meshes[0]!, lodInstances)).toBe(true);
      expect(proxyable(crate.meshes[0]!, lodInstances)).toBe(false);
    }
    const { sources } = buildShadowProxies(s, [...plain.meshes, ...crate.meshes]);
    expect(sources).toEqual(plain.meshes);
  });

  it('casting on its own, a broken one (its node switched off) is out of the shadow pass at once', async () => {
    const s = scene();
    const crate = await placed(s, library(s), prop('c', 2), true);
    const m = crate.meshes[0]!;
    expect(m.isEnabled()).toBe(true);
    // GameView.breakProp switches the node off: the shadow map draws only enabled meshes.
    crate.root.setEnabled(false);
    expect(m.isEnabled()).toBe(false);
    expect(proxyable(m)).toBe(false);
  });
});
