import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { CORE_LOOKS, MODULAR_PARTS_MALE, encodeLook, type CharacterLook } from '@tiletrigger/shared';
import type { CharacterLibrary, CharacterSpec } from '../src/content/characters.ts';

// The library's files come from public/ on disk (the loader is handed their bytes).
const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
vi.mock('@babylonjs/core/Loading/sceneLoader', async (orig) => {
  const real = (await orig()) as typeof import('@babylonjs/core/Loading/sceneLoader');
  return {
    ...real,
    LoadAssetContainerAsync: (src: string, scene: Scene, opts: object) =>
      real.LoadAssetContainerAsync(new Uint8Array(readFileSync(PUBLIC + src.replace(/\?.*$/, '').replace(/^\//, ''))), scene, opts),
  };
});

/**
 * A body's cloned materials and texture copies go with it (the Flavius Rule recording: textures +3.4 a second and
 * materials +3 a second over a whole match, every body past the pool leaving its clones in the scene), and nothing
 * shared goes with them.
 */
describe('character bodies free what they cloned', () => {
  let engine: NullEngine;
  let scene: Scene;
  let lib: CharacterLibrary;
  const pick = (p: (l: CharacterLook) => boolean, n: number) => CORE_LOOKS.filter(p).slice(0, n).map((l) => l.id);
  // Several kinds of look: whole-body (Meshy) characters, outfit parts with gear, dyed outfits, a beard.
  const looks = [
    ...pick((l) => !!l.whole, 3),
    ...pick((l) => !l.whole && !!l.gear?.length, 2),
    ...pick((l) => !l.whole && !!(l.cloth || l.trim), 2),
    ...pick((l) => !l.whole && l.hair.includes('beard'), 1),
    // Part-made looks (Linktifa's outfit parts: no outfit preset is left on the roster), as an NPC skin's arms are made:
    // a beard, a dyed outfit, another hairstyle, each with its skin and hair tints (the atlas's work).
    ...[
      { hair: ['hair_beard'], colorways: ['ranger_moss'], skin: '#c68e6a', hairColor: '#2a2422' },
      { hair: ['hair_long'], colorways: [] as string[], skin: '#8d5a3c', hairColor: '#b08850' },
      { hair: ['hair_buzzed'], colorways: ['ranger_moss'], skin: '#f1c9a5', hairColor: '#3a3030' },
      { hair: ['hair_simpleparted'], colorways: [] as string[], skin: '#6b4430', hairColor: '#8a6a50' },
    ].map((d) => encodeLook({ body: 'male', parts: [...MODULAR_PARTS_MALE], ...d })),
  ];
  const specs: CharacterSpec[] = [
    ...looks.map((look) => ({ look })),
    { npc: { color: '#d04a3a', scale: 1 } },
    { npc: { color: '#3a6ad0', scale: 1, female: true } },
    { look: looks[0]!, armsOnly: true },
    { look: looks[3]!, armsOnly: true },
  ];

  beforeAll(async () => {
    // The atlas reads its tiles' pixels: give skin, hair and eye pictures the slots' sizes and some pixels.
    vi.spyOn(BaseTexture.prototype, 'getSize').mockImplementation(function (this: BaseTexture) {
      return /skin_/.test(this.name) ? { width: 1024, height: 1024 } : /hair_/.test(this.name) ? { width: 512, height: 512 } : { width: 256, height: 256 };
    });
    vi.spyOn(BaseTexture.prototype, 'readPixels').mockImplementation(function (this: BaseTexture) {
      const { width, height } = this.getSize();
      return Promise.resolve(new Uint8Array(width * height * 4).fill(this.uniqueId & 255));
    });
    const { CharacterLibrary } = await import('../src/content/characters.ts');
    engine = new NullEngine();
    scene = new Scene(engine);
    lib = new CharacterLibrary(scene, { atlas: true });
  });
  afterAll(() => {
    scene.dispose();
    engine.dispose();
    vi.restoreAllMocks();
  });

  const counts = () => ({ materials: scene.materials.length, textures: scene.textures.length, gpu: engine.getLoadedTexturesCache().length });

  it('50 bodies of several looks made and disposed leave the scene as it was', async () => {
    expect(looks.length).toBeGreaterThanOrEqual(6);
    // One of each first: the library's shared textures, gear materials and the atlas come with the first bodies and stay.
    for (const s of specs) (await lib.create(s, 'first')).dispose();
    const start = counts();
    let atlased = 0;
    for (let i = 0; i < 50; i++) {
      const ch = await lib.create(specs[i % specs.length]!, `body_${i}`);
      if (ch.meshes.some((m) => m.material?.name.endsWith('_atlas'))) atlased++;
      ch.dispose();
    }
    // The skin-and-hair atlas took part (its per-body material is a clone too).
    expect(atlased).toBeGreaterThan(10);
    expect(counts()).toEqual(start);

    // Many alive at once, then all gone: the same.
    const alive = await Promise.all(specs.map((s, i) => lib.create(s, `crowd_${i}`)));
    expect(counts().materials).toBeGreaterThan(start.materials);
    for (const ch of alive) ch.dispose();
    expect(counts()).toEqual(start);
  });

  it('the shared textures still dress a body made afterwards', async () => {
    const ch = await lib.create({ look: looks[3]! }, 'after');
    const textures = new Set(ch.meshes.flatMap((m) => (m.material ? m.material.getActiveTextures() : [])));
    expect(textures.size).toBeGreaterThan(0);
    for (const t of textures) {
      expect(scene.textures).toContain(t);
      // Still backed by its picture (a texture disposed by mistake loses it).
      expect(t.getInternalTexture()).not.toBeNull();
    }
    for (const m of ch.meshes) if (m.material instanceof PBRMaterial) expect(scene.materials).toContain(m.material);
    ch.dispose();
  });
});
