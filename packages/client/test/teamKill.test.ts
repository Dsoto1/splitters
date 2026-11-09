import { describe, expect, it } from 'vitest';
import type { GameEvent } from '@tiletrigger/shared';
import { SessionAudio } from '../src/game/sessionAudio.ts';
import type { RemotePose } from '../src/game/interpolation.ts';
import type { AudioSystem } from '../src/audio/audio.ts';

/**
 * Team kills on the client (owner, 2026-11-08): a team kill confirms nothing. Your kill confirmation sounds (the
 * crunch, the climbing step, the multi-kill call) play for an enemy, never for a teammate; the deaths sound either way.
 * (The feed's TK tag, the missing kill marker and streak burst are checked in the browser: e2e `teams`.)
 */
describe('team kill sounds', () => {
  const run = (events: GameEvent[]) => {
    const played: string[] = [];
    const audio = { play: (id: string) => played.push(id) } as unknown as AudioSystem;
    const sfx = new SessionAudio(audio, () => 0);
    const poses = () => [3, 4, 5].map((slot) => ({ slot, x: slot, y: 0, z: 0, alive: false }) as unknown as RemotePose);
    events.forEach((ev, i) => sfx.event(ev, poses, 1000 + i * 100));
    return played;
  };
  const CONFIRM = ['ui.kill.confirm', 'ui.kill', 'announce.multikill'];

  it('an enemy kill confirms (and two in a row call the multi-kill)', () => {
    const played = run([
      { e: 'kill', killer: 0, victim: 3, weapon: 'core.rifle' },
      { e: 'kill', killer: 0, victim: 4, weapon: 'core.rifle' },
    ]);
    expect(played.filter((id) => id === 'ui.kill.confirm')).toHaveLength(2);
    expect(played).toContain('announce.multikill');
  });

  it('a team kill plays the death only: no confirmation, and it does not count toward a multi-kill', () => {
    const tk = run([{ e: 'kill', killer: 0, victim: 3, weapon: 'core.rifle', tk: 1 }]);
    expect(tk.some((id) => CONFIRM.includes(id))).toBe(false);
    expect(tk).toContain('death');
    const after = run([
      { e: 'kill', killer: 0, victim: 3, weapon: 'core.rifle', tk: 1 },
      { e: 'kill', killer: 0, victim: 4, weapon: 'core.rifle' },
    ]);
    expect(after.filter((id) => id === 'ui.kill.confirm')).toHaveLength(1);
    expect(after).not.toContain('announce.multikill');
  });
});
