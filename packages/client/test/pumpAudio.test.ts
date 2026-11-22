import { describe, expect, it } from 'vitest';
import { CORE_WEAPONS, getWeapon, type GameEvent } from '@tiletrigger/shared';
import type { AudioSystem, PlayOptions } from '../src/audio/audio.ts';
import { SessionAudio } from '../src/game/sessionAudio.ts';
import manifest from '../../../content/sounds.json';

/** The pump shotgun's recorded pump after each shot (owner 2026-11-22, "3a"; weapon `view.cycle`). */
const heard = () => {
  const played: { id: string; opts: PlayOptions }[] = [];
  const audio = { play: (id: string, opts: PlayOptions = {}) => played.push({ id, opts }) } as unknown as AudioSystem;
  return { played, sfx: new SessionAudio(audio, () => 0) };
};

describe('pump after the shot', () => {
  const shotgun = getWeapon('core.shotgun');

  it('the pump shotgun works its pump inside its fire interval, with a recorded sound', () => {
    const cycle = shotgun.view.cycle!;
    expect(cycle.sound).toBe('fire.shotgun.pump');
    expect(cycle.sound in manifest.sounds).toBe(true);
    expect(cycle.at).toBeGreaterThan(0.15);
    // The pump (about 0.45 s) is done by the time the next shot can come.
    expect(cycle.at + 0.45).toBeLessThanOrEqual(shotgun.fireIntervalTicks / 60 + 0.01);
  });

  it('only pump guns pump: the auto, revolving and sawn-off shotguns share the report but not the pump', () => {
    const pumps = Object.values(CORE_WEAPONS).filter((w) => w.view.cycle).map((w) => w.id);
    expect(pumps).toEqual(['core.shotgun']);
  });

  it('your own shot: the report now, the pump cycle.at later (and after a slow frame, as late again)', () => {
    const { played, sfx } = heard();
    sfx.localShot(shotgun, false, 0.02);
    expect(played.map((p) => p.id)).toEqual(['fire.shotgun', 'fire.shotgun.pump']);
    expect(played[1]!.opts.delay).toBeCloseTo(0.02 + shotgun.view.cycle!.at);
    expect(played[1]!.opts.at).toBeUndefined();
  });

  it("someone else's shot: the pump from their gun", () => {
    const { played, sfx } = heard();
    const ev = { e: 'shot', s: 3, w: 'core.shotgun', from: [1, 2, 3], to: [[1, 2, 40]], hit: [null] } as unknown as GameEvent;
    sfx.event(ev, () => [], 0);
    const pump = played.find((p) => p.id === 'fire.shotgun.pump');
    expect(pump?.opts).toMatchObject({ at: { x: 1, y: 2, z: 3 }, delay: shotgun.view.cycle!.at });
  });

  it('a gun without a pump plays its report alone', () => {
    const { played, sfx } = heard();
    sfx.localShot(getWeapon('core.rifle'));
    expect(played.map((p) => p.id)).toEqual([getWeapon('core.rifle').view.sound ?? 'fire.rifle']);
  });
});
