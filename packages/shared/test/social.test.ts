import { beforeAll, expect, it } from 'vitest';
import { DEFAULT_DEATHMATCH_RULES, EMOTE_DANCE, initPhysics, type GameEvent } from '../src/index.ts';
import { Match, initNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));
const room = () => makeMap([{ id: 'room', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }]);

it('quick messages go out as events and the dance emote shows in snapshots; the match can turn both off', () => {
  for (const emotes of [true, false]) {
    const match = new Match(room(), { ...DEFAULT_DEATHMATCH_RULES, emotes });
    const me = match.addHuman('me')!;
    for (let i = 0; i < 3; i++) match.step();
    match.queueInputs(me.slot, [{ seq: 1, forward: 0, right: 0, yaw: 0, pitch: 0, buttons: 0, say: 3 }]);
    const events: GameEvent[] = match.step();
    expect(events.some((e) => e.e === 'say' && e.m === 3)).toBe(emotes);
    for (let i = 0; i < 70; i++) match.step(); // past the one-a-second limit
    match.queueInputs(me.slot, [{ seq: 2, forward: 0, right: 0, yaw: 0, pitch: 0, buttons: 0, say: EMOTE_DANCE }]);
    match.step();
    const snap = match.playerSnapshots().find((p) => p.s === me.slot)!;
    expect(snap.em === 1).toBe(emotes);
  }
});
