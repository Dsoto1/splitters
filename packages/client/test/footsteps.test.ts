import { describe, expect, it } from 'vitest';
import { CORE_MATERIALS, SURFACE_TYPE_IDS, materialSurface, newMapDocument, newTerrain, type MapDocument, type WorldBox } from '@tiletrigger/shared';
import type { AudioSystem, PlayOptions } from '../src/audio/audio.ts';
import { footstepSoundId, surfaceMap, surfaceOfFace, terrainSurfaceAt } from '../src/game/fxMap.ts';
import { SessionAudio } from '../src/game/sessionAudio.ts';
import type { LocalPlayer } from '../src/game/prediction.ts';
import type { RemotePose } from '../src/game/interpolation.ts';
import manifest from '../../../content/sounds.json';

/** Footsteps by surface (owner 2026-11-22, "4a"): recorded steps per surface, looked up from the map, nothing sent. */
const sounds = manifest.sounds as unknown as Record<string, { variants?: unknown[] }>;
const up = { x: 0, y: 1, z: 0 };
const box = (o: Partial<WorldBox>): WorldBox => ({ min: [0, -0.2, 0], max: [4, 0, 4], kind: 'floor', sourceId: 't1', ...o }) as WorldBox;

describe('footsteps by surface', () => {
  it('every surface type steps on a recorded set of three or four (wood: the two the bundles have)', () => {
    const ids = new Set(SURFACE_TYPE_IDS.map((s) => footstepSoundId(s)));
    expect([...ids].sort()).toEqual(['footstep', 'footstep.dirt', 'footstep.grass', 'footstep.gravel', 'footstep.metal', 'footstep.snow', 'footstep.wood']);
    for (const id of ids) {
      expect(sounds[id], id).toBeDefined();
      expect(sounds[id]!.variants!.length, id).toBeGreaterThanOrEqual(id === 'footstep.wood' ? 2 : 3);
    }
    expect(footstepSoundId('metal')).toBe('footstep.metal');
    expect(footstepSoundId('sheet_metal')).toBe('footstep.metal');
    expect(footstepSoundId('thin_wood')).toBe('footstep.wood');
    expect(footstepSoundId('grass')).toBe('footstep.grass');
    expect(footstepSoundId('sand')).toBe('footstep.dirt');
    expect(footstepSoundId('snow')).toBe('footstep.snow');
    expect(footstepSoundId('concrete')).toBe('footstep');
  });

  it('every library material names its surface', () => {
    expect(CORE_MATERIALS.filter((m) => !m.surface).map((m) => m.id)).toEqual([]);
    expect(materialSurface('core.oak_planks')).toBe('wood');
    expect(materialSurface('core.pbr_grass')).toBe('grass');
    expect(materialSurface('core.steel_grating')).toBe('metal');
    expect(materialSurface('core.packed_snow')).toBe('snow');
  });

  it("a tile's floor is the material painted on it, else its theme's; its walls the walls'", () => {
    const doc = newMapDocument('steps');
    doc.classicStructure.theme = 'core.prototype';
    doc.classicStructure.tiles = [{ id: 't1', tile: 'core.floor', surfaces: { floor: { material: 'core.oak_planks', tint: null } } } as unknown as MapDocument['classicStructure']['tiles'][number]];
    const map = surfaceMap(doc);
    expect(surfaceOfFace(box({}), up, { x: 1, y: 0, z: 1 }, map)).toBe('wood');
    doc.classicStructure.tiles[0]!.surfaces = {};
    expect(surfaceOfFace(box({}), up, { x: 1, y: 0, z: 1 }, surfaceMap(doc))).toBe(materialSurface('core.proto_floor'));
    // A free block's own material wins.
    expect(surfaceOfFace(box({ sourceId: 'b1', kind: 'solid', surface: { material: 'core.steel_plate', tint: null } }), up, { x: 0, y: 0, z: 0 }, map)).toBe('metal');
  });

  it('the terrain: the ground painted in the cell underfoot, the base elsewhere', () => {
    const t = newTerrain(20, 2, [0, 0], 'ground.meadow');
    expect(terrainSurfaceAt(t, 1, 1)).toBe('grass');
    t.grounds = ['core.pbr_gravel'];
    // The cell at x 3, z 1 (column 5 of a 20 m terrain centred on 0, 2 m cells).
    const c = Math.floor((3 - t.origin[0]) / t.spacing);
    const r = Math.floor((1 - t.origin[1]) / t.spacing);
    t.materials[r * (t.cols - 1) + c] = 1;
    expect(terrainSurfaceAt(t, 3, 1)).toBe('gravel');
    expect(terrainSurfaceAt(t, 1, 1)).toBe('grass');
    expect(terrainSurfaceAt(null, 0, 0)).toBe('dirt');
    // No box under the ray: the terrain.
    const doc = newMapDocument('steps');
    doc.terrain = t;
    expect(surfaceOfFace(null, up, { x: 3, y: 0, z: 1 }, surfaceMap(doc))).toBe('gravel');
  });

  it('your steps and others\' play the step for where each foot lands', () => {
    const played: { id: string; opts: PlayOptions }[] = [];
    const audio = { play: (id: string, opts: PlayOptions = {}) => played.push({ id, opts }) } as unknown as AudioSystem;
    const sfx = new SessionAudio(audio, () => 0);
    sfx.stepSound = (at) => (at.x > 50 ? 'footstep.snow' : 'footstep.metal');
    const local = { alive: true, state: { pos: { x: 0, y: 0, z: 0 }, grounded: true, velY: 0 }, reloadTicks: 0 } as unknown as LocalPlayer;
    for (let i = 1; i <= 10; i++) {
      const before = { ...local.state.pos };
      local.state.pos = { x: i, y: 0, z: 0 };
      sfx.localStep(local, before, 1);
    }
    expect(played.map((p) => p.id)).toContain('footstep.metal');
    played.length = 0;
    const pose = (x: number) => ({ slot: 2, x, y: 0, z: 0, alive: true }) as unknown as RemotePose;
    for (let x = 60; x <= 70; x++) sfx.remoteSteps([pose(x)]);
    const step = played.find((p) => p.id.startsWith('footstep'));
    expect(step?.id).toBe('footstep.snow');
    expect(step?.opts.at).toBeDefined();
  });
});
