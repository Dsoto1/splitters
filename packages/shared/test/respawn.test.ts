import { beforeAll, expect, it } from 'vitest';
import { BUTTON_RESPAWN, DEFAULT_DEATHMATCH_RULES, initPhysics, type GameEvent } from '../src/index.ts';
import { Match, initNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

it('a player can ask to respawn (stuck somewhere): they die there and come back as usual', () => {
  const match = new Match(makeMap([{ id: 'room', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }]), { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 30 });
  const me = match.addHuman('me')!;
  const events: GameEvent[] = [];
  for (let i = 0; i < 5; i++) events.push(...match.step());
  expect(me.alive).toBe(true);
  match.queueInputs(me.slot, [{ seq: 1, forward: 0, right: 0, yaw: 0, pitch: 0, buttons: BUTTON_RESPAWN }]);
  events.push(...match.step());
  expect(me.alive).toBe(false);
  expect(events.some((e) => e.e === 'kill' && e.victim === me.slot && e.weapon === 'core.respawn')).toBe(true);
  for (let i = 0; i < 40; i++) match.step();
  expect(me.alive).toBe(true);
});
