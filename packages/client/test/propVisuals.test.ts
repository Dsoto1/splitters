import { afterEach, describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { PropEntity } from '@tiletrigger/shared';
import type { ModelLibrary } from '../src/content/models.ts';
import { createPropNode, disposePropNode } from '../src/game/propVisuals.ts';

const engines: NullEngine[] = [];
afterEach(() => {
  for (const e of engines.splice(0)) e.dispose();
});

/** A scene and a stand-in model library whose copies all draw with one shared material, as the real one's do. */
function setup() {
  const engine = new NullEngine();
  engines.push(engine);
  const scene = new Scene(engine);
  const shared = new StandardMaterial('barrel_wood', scene);
  shared.diffuseColor = new Color3(0.6, 0.4, 0.2);
  const models = {
    instantiate: async (_path: string, name: string) => {
      const root = new TransformNode(name, scene);
      const box = CreateBox(`${name}_box`, { size: 1 }, scene);
      box.material = shared;
      box.parent = root;
      return root;
    },
  } as unknown as ModelLibrary;
  const prop = (id: string, tint: string | null = null) =>
    createPropNode(scene, models, { id, kind: 'prop', position: [0, 0, 0], model: 'prop.barrel', yaw: 0, scale: 1, solid: true, tint } as unknown as PropEntity, id, false);
  return { scene, shared, prop };
}

const loaded = () => new Promise((r) => setTimeout(r, 0));
const material = (root: TransformNode) => root.getChildMeshes()[0]?.material ?? null;

describe('disposePropNode', () => {
  it('leaves the model material other copies draw with (a MapMaker preview going away kept props white)', async () => {
    const { scene, shared, prop } = setup();
    const placed = prop('placed');
    const ghost = prop('ghost');
    await loaded();
    expect(material(placed)).toBe(shared);
    disposePropNode(ghost);
    expect(ghost.isDisposed()).toBe(true);
    expect(material(placed)).toBe(shared);
    expect(scene.materials).toContain(shared);
    // A copy made afterwards still gets it too.
    const later = prop('later');
    await loaded();
    expect(material(later)).toBe(shared);
  });

  it("disposes a tinted prop's own material copy, not the shared one", async () => {
    const { scene, shared, prop } = setup();
    const plain = prop('plain');
    const tinted = prop('tinted', '#ff0000');
    await loaded();
    const own = material(tinted)!;
    expect(own).not.toBe(shared);
    disposePropNode(tinted);
    expect(scene.materials).not.toContain(own);
    expect(scene.materials).toContain(shared);
    expect(material(plain)).toBe(shared);
  });
});
