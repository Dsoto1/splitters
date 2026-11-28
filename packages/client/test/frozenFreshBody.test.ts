import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture';
import type { CharacterLibrary } from '../src/content/characters.ts';
import type { CharacterAnimator as Animator } from '../src/game/characterAnimator.ts';

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
 * characters3's pose check, CI runs 46104515126 and 46141903583: a dead far body drawn in its bind pose for good (Flt.
 * Lt. Ember, Cal, Elder Tomo: each built a frame before it died, frozen, the death clip "playing" at weight 1, never
 * posed). A body frozen before the scene's next animation step (a crowd's ragdoll budget drops a cheap ragdoll to frozen
 * in the frame it started: GameView.dropTier) kept its joints as they were, the held death pose never written. Real
 * bodies, driven as GameView drives one; the pose check's own test (CharacterAnimator.drawnBindPose) judges.
 */
describe('a body frozen in the frame it went down', () => {
  let engine: NullEngine;
  let scene: Scene;
  let lib: CharacterLibrary;
  let CharacterAnimator: typeof Animator;
  beforeAll(async () => {
    vi.spyOn(BaseTexture.prototype, 'getSize').mockImplementation(function (this: BaseTexture) {
      return /skin_/.test(this.name) ? { width: 1024, height: 1024 } : /hair_/.test(this.name) ? { width: 512, height: 512 } : { width: 256, height: 256 };
    });
    vi.spyOn(BaseTexture.prototype, 'readPixels').mockImplementation(function (this: BaseTexture) {
      const { width, height } = this.getSize();
      return Promise.resolve(new Uint8Array(width * height * 4));
    });
    ({ CharacterAnimator } = await import('../src/game/characterAnimator.ts'));
    const { CharacterLibrary } = await import('../src/content/characters.ts');
    engine = new NullEngine();
    scene = new Scene(engine);
    new FreeCamera('cam', new Vector3(0, 1.5, -80), scene).setTarget(new Vector3(0, 1, 0));
    lib = new CharacterLibrary(scene, { atlas: true });
  }, 120000);
  afterAll(() => {
    scene.dispose();
    engine.dispose();
    vi.restoreAllMocks();
  });

  for (const look of ['core.ember', 'core.dale'])
    for (const how of ['cheap ragdoll', 'laid down'] as const)
      it(`${look}, ${how}: drawn in the death pose, not the bind pose`, async () => {
        const ch = await lib.create({ look }, `frozen_${look}_${how}`);
        const anim = new CharacterAnimator(scene, ch);
        // Built, and dead before its first animation step: a far body never evaluated (its bones in the bind pose).
        if (how === 'cheap ragdoll') anim.ragdoll('limp');
        else anim.lieDown();
        // Dropped to frozen at once (the budget), then drawn for a few frames.
        anim.freezePose();
        for (let i = 0; i < 3; i++) scene.render();
        expect(anim.drawnBindPose()).toEqual({ arms: false, legs: false });
        expect(anim.poseState()).toMatchObject({ dead: true, frozen: true, poses: 0 });
        ch.dispose();
      }, 120000);
});
