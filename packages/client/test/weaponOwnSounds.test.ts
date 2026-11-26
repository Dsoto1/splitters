import { afterEach, describe, expect, it } from 'vitest';
import { CORE_WEAPONS, THROWABLE_DEFS, type GameEvent } from '@tiletrigger/shared';
import type { AudioSystem, PlayOptions } from '../src/audio/audio.ts';
import { SessionAudio, explosionSoundOf, impactSoundOf, weaponSoundIds } from '../src/game/sessionAudio.ts';

/** A weapon's own Explosion and Impact sounds (owner, 2026-11-24; the Weapon Manager picks them): none until picked. */
const heard = () => {
  const played: { id: string; opts: PlayOptions }[] = [];
  const audio = { play: (id: string, opts: PlayOptions = {}) => played.push({ id, opts }) } as unknown as AudioSystem;
  return { played, sfx: new SessionAudio(audio, () => 0) };
};
const launcher = CORE_WEAPONS['core.launcher']!;
const frag = THROWABLE_DEFS.frag;
const keep = { view: { ...launcher.view }, frag: frag.explosionSound };
afterEach(() => {
  launcher.view.explosionSound = keep.view.explosionSound;
  launcher.view.impactSound = keep.view.impactSound;
  (frag as { explosionSound?: string }).explosionSound = keep.frag;
});

describe("weapons' own explosion and impact sounds", () => {
  it("the Blaster X-42's energy crackle is the only one yet (2026-11-25): else the shared explosion, and no extra hit sound", () => {
    expect(Object.values(CORE_WEAPONS).filter((w) => w.view.explosionSound || w.view.impactSound).map((w) => [w.id, w.view.explosionSound, w.view.impactSound])).toEqual([['core.blaster_x42', undefined, 'impact.energy']]);
    expect(impactSoundOf('core.blaster_x42')).toBe('impact.energy');
    expect(explosionSoundOf('core.launcher')).toBe('explosion');
    expect(explosionSoundOf('core.frag')).toBe('explosion');
    expect(explosionSoundOf(undefined)).toBe('explosion');
    expect(impactSoundOf('core.rifle')).toBeNull();
  });

  it('a picked explosion plays in place of the shared one, the debris still under it; a throwable too', () => {
    launcher.view.explosionSound = 'explosion.vehicle';
    (frag as { explosionSound?: string }).explosionSound = 'impact.metal';
    const { played, sfx } = heard();
    sfx.event({ e: 'explode', s: 1, p: [0, 0, 0], r: 3, w: 'core.launcher' } as GameEvent, () => [], 0);
    sfx.event({ e: 'explode', s: 1, p: [0, 0, 0], r: 3, w: 'core.frag' } as GameEvent, () => [], 0);
    expect(played.map((p) => p.id)).toEqual(['explosion.vehicle', 'explosion.debris', 'impact.metal', 'explosion.debris']);
    expect(weaponSoundIds()).toContain('impact.metal');
  });

  it('a picked impact is layered on the surface\'s own where a round lands', () => {
    const rifle = CORE_WEAPONS['core.rifle']!;
    const was = rifle.view.impactSound;
    rifle.view.impactSound = 'impact.metal';
    try {
      const { played, sfx } = heard();
      sfx.event({ e: 'shot', s: 3, w: 'core.rifle', from: [0, 1, 0], to: [[0, 1, 30]], hit: [null] } as unknown as GameEvent, () => [], 0);
      const ids = played.map((p) => p.id);
      expect(ids).toContain('impact.world');
      expect(ids.indexOf('impact.metal')).toBe(ids.indexOf('impact.world') + 1);
    } finally {
      rifle.view.impactSound = was;
    }
  });
});
