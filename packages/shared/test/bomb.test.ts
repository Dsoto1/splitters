import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { BOMB_PLANTED, BUTTON_USE, CORE_BOT_PROFILES, DEFAULT_RULES, initPhysics, loadMap, mapCanRun, playableModes, type GameEvent, type MapDocument } from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

/** A 40 × 16 m yard with two team bases and a bomb site in the middle. */
function yard(): MapDocument {
  const tiles = [];
  for (let x = 0; x < 5; x++) for (let y = 0; y < 2; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  const map = makeMap(tiles, [[2, 0, 4], [34, 0, 4]]);
  map.entities.push({ id: 'site_a', kind: 'bombsite', position: [20, 0, 8], label: 'A', radius: 4 } as MapDocument['entities'][number]);
  return map;
}

function setup() {
  const match = new Match(yard(), { ...DEFAULT_RULES['core.bomb'], teamSizes: [1, 1] });
  const a = match.addHuman('att')!;
  const d = match.addHuman('def')!;
  const att = [a, d].find((c) => c.faction === (match as unknown as { teams: { id: string }[] }).teams[0]!.id)!;
  const def = att === a ? d : a;
  let seq = 0;
  const events: GameEvent[] = [];
  const step = (n: number, each?: () => void) => {
    for (let i = 0; i < n; i++) {
      for (const c of [att, def]) match.queueInputs(c.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: 0, pitch: 0, buttons: 0 }]);
      each?.();
      events.push(...match.step());
    }
  };
  const press = (c: Combatant) => match.queueInputs(c.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: 0, pitch: 0, buttons: BUTTON_USE }]);
  const put = (c: Combatant, x: number, z: number) => (c.move = { pos: { x, y: 0, z }, velY: 0, grounded: true });
  step(5);
  return { match, att, def, step, press, put, events };
}

describe('Bomb mode', () => {
  it('needs a bomb site; maps with one offer it', () => {
    expect(mapCanRun(makeMap([{ id: 'room', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }]), 'core.bomb')).toBe(false);
    expect(mapCanRun(yard(), 'core.bomb')).toBe(true);
    expect(playableModes(yard())).toContain('core.bomb');
  });

  it('an attacker plants at the site (Use, then still); it blows after the fuse and wins the round', () => {
    const { match, att, def, step, press, put, events } = setup();
    expect(match.snapshot([]).md?.bm?.[4]).toBe(att.slot);
    put(def, 34, 4);
    put(att, 20, 8);
    step(2);
    press(att);
    step(1);
    step(3 * 60 + 5, () => put(def, 34, 4));
    expect(events.some((e) => e.e === 'bomb' && e.a === 'plant')).toBe(true);
    expect(match.snapshot([]).md?.bm?.[0]).toBe(BOMB_PLANTED);
    // The defender stays away: it blows, killing anyone near and winning the round for the attackers.
    put(att, 2, 4);
    step(41 * 60, () => {
      put(def, 34, 4);
      put(att, 2, 4);
    });
    expect(events.some((e) => e.e === 'bomb' && e.a === 'explode')).toBe(true);
    const win = events.find((e) => e.e === 'elim' && e.a === 'win');
    expect(win && win.e === 'elim' && win.team).toBe(att.faction);
  });

  it('a defender defuses a planted bomb and wins the round; moving away cancels', () => {
    const { match, att, def, step, press, put, events } = setup();
    put(att, 20, 8);
    step(2);
    press(att);
    step(3 * 60 + 5);
    expect(match.snapshot([]).md?.bm?.[0]).toBe(BOMB_PLANTED);
    const [, bx, , bz] = match.snapshot([]).md!.bm!;
    put(att, 2, 4);
    // Start defusing, then walk off: it doesn't finish.
    put(def, bx + 0.5, bz);
    step(1);
    press(def);
    step(60, () => put(att, 2, 4));
    put(def, bx + 4, bz);
    step(5 * 60, () => put(att, 2, 4));
    expect(events.some((e) => e.e === 'bomb' && e.a === 'defuse')).toBe(false);
    // Now properly.
    put(def, bx + 0.5, bz);
    step(1);
    press(def);
    step(5 * 60 + 5, () => {
      put(att, 2, 4);
      put(def, bx + 0.5, bz);
    });
    expect(events.some((e) => e.e === 'bomb' && e.a === 'defuse')).toBe(true);
    const win = events.find((e) => e.e === 'elim' && e.a === 'win');
    expect(win && win.e === 'elim' && win.team).toBe(def.faction);
  });

  it('bots play rounds on Sandgate (the round always ends)', () => {
    const r = loadMap(JSON.parse(readFileSync(new URL('../../../maps/sandgate.json', import.meta.url), 'utf8')));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(playableModes(r.map)).toContain('core.bomb');
    const match = new Match(r.map, { ...DEFAULT_RULES['core.bomb'], teamSizes: [4, 4] }, 7);
    for (let i = 0; i < 8; i++) match.addBot(`b${i}`, CORE_BOT_PROFILES[i % 4]!);
    const events: GameEvent[] = [];
    for (let t = 0; t < 60 * 130; t++) events.push(...match.step());
    expect(events.some((e) => e.e === 'elim' && e.a === 'win')).toBe(true);
  }, 120000);
});
