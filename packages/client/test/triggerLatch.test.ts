/**
 * Shots out of a held sprint (owner, 2026-11-18: "gunshots are lagging now… chugging, not natural like before"). With
 * sprint held, every gap between taps ran the sprint again, so every tap waited the gun's sprint-exit time and a click
 * shorter than it fired nothing (game/triggerLatch.ts). Through the latch, host and prediction alike: taps fire on the
 * tick they're pulled, and a quick click out of a real sprint fires once the gun is up.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { BUTTON_FIRE, BUTTON_SPRINT, BUTTON_ZOOM, DEFAULT_DEATHMATCH_RULES, PhysicsWorld, getWeapon, gunplayOf, initPhysics, weaponCode, type MapDocument } from '@tiletrigger/shared';
import { Match, initNavigation } from '@tiletrigger/shared/match';
import { makeMap } from '../../shared/test/helpers.ts';
import { LocalPlayer } from '../src/game/prediction.ts';
import { SPRINT_AFTER_CYCLE_TICKS, SPRINT_AFTER_FIRE_TICKS, TriggerLatch } from '../src/game/triggerLatch.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const EAST = Math.PI / 2;

function deck(): MapDocument {
  const tiles = [];
  for (let x = -1; x <= 13; x++) for (let y = -1; y <= 1; y++) tiles.push({ id: `p_${x}_${y}`, tile: 'core.platform', x, y, z: 0, rotation: 0 as const });
  return makeMap(tiles, [[0, 0, 0]]);
}

/**
 * Run east with `buttons(t)` held each tick, through the latch (or not), the host and the prediction side by side:
 * the ticks the host fired on and the ticks the prediction fired on.
 */
function play(id: string, ticks: number, buttons: (t: number) => number, latched: boolean): { host: number[]; predicted: number[] } {
  const match = new Match(deck(), { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000 });
  const me = match.addHuman('me')!;
  match.step();
  me.move = { pos: { x: 0, y: 0, z: 0 }, velY: 0, grounded: true };
  const def = getWeapon(id);
  me.weapons.set(weaponCode(def), { def, mag: 500, reserve: 500, alt: 0 });
  me.current = weaponCode(def);
  me.raiseTicks = 0;
  match.step();
  const local = new LocalPlayer(new PhysicsWorld(match.geometry));
  local.reconcile(match.playerSnapshots().find((p) => p.s === me.slot)!, me.lastSeq, match.privateState(me.slot));
  const latch = new TriggerLatch();
  const host: number[] = [];
  const predicted: number[] = [];
  for (let t = 0; t < ticks; t++) {
    let b = buttons(t);
    if (latched) b = latch.apply(b, local.raiseTicks > 0, !!local.state.sprint, def.fireIntervalTicks);
    const { input, shot } = local.tick({ forward: 1, right: 0, buttons: b }, EAST, 0, 0, 0);
    if (shot) predicted.push(t);
    match.queueInputs(me.slot, [input]);
    if (match.step().some((e) => e.e === 'shot' && e.s === me.slot)) host.push(t);
  }
  match.destroy();
  return { host, predicted };
}

/** Sprint held throughout; after a 40-tick sprint, ten pulls of `down` ticks every `every` ticks. */
const taps = (down: number, every: number) => (t: number) => BUTTON_SPRINT | (t >= 40 && (t - 40) % every < down ? BUTTON_FIRE : 0);
const pulls = (every: number) => Array.from({ length: 10 }, (_, i) => 40 + i * every);

describe('the trigger latch (shots out of a held sprint)', () => {
  it('before it: with sprint held every tap waited the exit time, and a rifle click under it fired nothing', () => {
    const smg = play('core.smg', 40 + 10 * 20, taps(6, 20), false);
    expect(smg.host).toEqual(pulls(20).map((t) => t + gunplayOf(getWeapon('core.smg')).handling.sprintExit));
    expect(play('core.rifle', 40 + 10 * 20, taps(6, 20), false).host).toEqual([]);
  });

  it('with it: only a real sprint\'s first shot waits; every later tap fires on its tick, host and prediction alike', () => {
    for (const id of ['core.pistol', 'core.smg', 'core.rifle', 'core.shotgun', 'core.sniper']) {
      const def = getWeapon(id);
      const exit = gunplayOf(def).handling.sprintExit;
      // Taps slower than the gun cycles (the first, late by the exit, included), quicker than the latch lets the sprint back.
      const every = Math.max(def.fireIntervalTicks + exit + 1, 12);
      expect(every, id).toBeLessThan(Math.max(SPRINT_AFTER_FIRE_TICKS, def.fireIntervalTicks + SPRINT_AFTER_CYCLE_TICKS));
      const r = play(id, 40 + 10 * every, taps(4, every), true);
      const want = pulls(every).map((t, i) => (i === 0 ? t + exit : t));
      expect(r.host, id).toEqual(want);
      expect(r.predicted, id).toEqual(want);
    }
  });

  it('a click shorter than the exit time out of a sprint fires when the gun is up (it was lost)', () => {
    const exit = gunplayOf(getWeapon('core.rifle')).handling.sprintExit;
    for (const length of [1, 2, exit - 1]) {
      const click = (t: number) => (t < 40 ? BUTTON_SPRINT : t < 40 + length ? BUTTON_FIRE | BUTTON_SPRINT : BUTTON_SPRINT);
      expect(play('core.rifle', 80, click, false).host, `${length}`).toEqual([]);
      const r = play('core.rifle', 80, click, true);
      expect(r.host, `${length}`).toEqual([40 + exit]);
      expect(r.predicted, `${length}`).toEqual([40 + exit]);
    }
  });

  it('lets the sprint back half a second after the trigger, and leaves other buttons alone', () => {
    const latch = new TriggerLatch();
    expect(latch.apply(BUTTON_FIRE | BUTTON_SPRINT | BUTTON_ZOOM, false, false)).toBe(BUTTON_FIRE | BUTTON_ZOOM);
    for (let i = 0; i < SPRINT_AFTER_FIRE_TICKS - 1; i++) expect(latch.apply(BUTTON_SPRINT, false, false)).toBe(0);
    expect(latch.apply(BUTTON_SPRINT, false, false)).toBe(BUTTON_SPRINT);
    // Never touched: running without the trigger.
    expect(new TriggerLatch().apply(BUTTON_SPRINT, false, true)).toBe(BUTTON_SPRINT);
    // A slow gun (a 90-tick bolt): its cycle and a quarter second.
    const bolt = new TriggerLatch();
    bolt.apply(BUTTON_FIRE, false, false, 90);
    for (let i = 0; i < 90 + SPRINT_AFTER_CYCLE_TICKS - 1; i++) expect(bolt.apply(BUTTON_SPRINT, false, false, 90)).toBe(0);
    expect(bolt.apply(BUTTON_SPRINT, false, false, 90)).toBe(BUTTON_SPRINT);
  });
});
