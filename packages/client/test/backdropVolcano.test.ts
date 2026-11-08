import { afterEach, describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { SCENERY_IDS, SCENERY_LABELS, buildMapGeometry, newTerrain, type MapDocument } from '@tiletrigger/shared';
import { BackdropVisuals } from '../src/backdrop.ts';
import type { MapStyler } from '../src/mapMeshes.ts';
import { makeMap } from '../../shared/test/helpers.ts';

const engines: NullEngine[] = [];
afterEach(() => {
  for (const e of engines.splice(0)) e.dispose();
});

/** Just what the backdrop asks a styler for: ground materials and their texture scale. */
function styler(scene: Scene): MapStyler {
  return { groundMaterial: () => new StandardMaterial('g', scene), groundScale: () => 8, surfaceMaterial: () => new StandardMaterial('s', scene) } as unknown as MapStyler;
}

describe('the volcano scenery (Map properties → Scenery: Hills and a volcano)', () => {
  it('is offered with a label', () => {
    expect(SCENERY_IDS).toContain('volcano');
    expect(SCENERY_LABELS.volcano).toBe('Hills and a volcano');
  });

  it('draws hills, and far to the north a cone with its crater glow and smoke plume, all still', () => {
    const engine = new NullEngine();
    engines.push(engine);
    const scene = new Scene(engine);
    const map: MapDocument = makeMap([{ id: 'tile_1', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }]);
    map.terrain = newTerrain(160, 2, [0, 0], 'dirt');
    map.backdrop = { sky: 'clear', scenery: 'volcano', ground: 'dirt', haze: 0.4 };
    const observers = scene.onBeforeRenderObservable.observers.length;
    new BackdropVisuals(scene, styler(scene)).build(map, buildMapGeometry(map));
    const names = scene.meshes.map((m) => m.name);
    for (const n of ['backdrop_ridge', 'backdrop_volcano', 'backdrop_volcano_glow', 'backdrop_volcano_smoke']) expect(names, n).toContain(n);
    const cone = scene.getMeshByName('backdrop_volcano')!;
    cone.refreshBoundingInfo();
    const box = cone.getBoundingInfo().boundingBox;
    // Beyond the hills to the north (+z), and a mountain's height.
    expect(box.minimumWorld.z).toBeGreaterThan(200);
    expect(box.maximumWorld.y - box.minimumWorld.y).toBeGreaterThan(250);
    // The glow is an unlit ember colour, the smoke see-through; nothing is animated (Reduce flashing has nothing to calm).
    expect((scene.getMeshByName('backdrop_volcano_glow')!.material as StandardMaterial).disableLighting).toBe(true);
    expect((scene.getMeshByName('backdrop_volcano_smoke')!.material as StandardMaterial).alpha).toBeLessThan(1);
    expect(scene.onBeforeRenderObservable.observers.length).toBe(observers);
    expect(scene.lights.length).toBe(0);
  });
});
