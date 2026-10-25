import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { BUTTON_USE, CORE_BOT_PROFILES, DEFAULT_RULES, HOSTAGE_FOLLOWING, initPhysics, loadMap, playableModes, type GameEvent, type MapDocument } from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

/** A 40 × 16 m yard: one hostage at the east end, the rescue zone at the west. */
function yard(): MapDocument {
  const tiles = [];
  for (let x = 0; x < 5; x++) for (let y = 0; y < 2; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  const map = makeMap(tiles, [[2, 0, 4], [34, 0, 4]]);
  map.entities.push({ id: 'hostage_1', kind: 'hostage', position: [30, 0, 8], yaw: 0 } as MapDocument['entities'][number]);
  map.entities.push({ id: 'rescue_1', kind: 'rescue', position: [4, 0, 8], radius: 3 } as MapDocument['entities'][number]);
  return map;
}

describe('Hostage Rescue', () => {
  it('maps with hostages and a rescue zone offer it', () => {
    expect(playableModes(yard())).toContain('core.hostage');
  });

  it('a rescuer takes a hostage along with E and brings it to the zone to win the round', () => {
    const match = new Match(yard(), { ...DEFAULT_RULES['core.hostage'], teamSizes: [1, 1] });
    const a = match.addHuman('a')!;
    const b = match.addHuman('b')!;
    const teams = (match as unknown as { teams: { id: string }[] }).teams;
    const res = [a, b].find((c) => c.faction === teams[0]!.id)!;
    const grd = res === a ? b : a;
    let seq = 0;
    const events: GameEvent[] = [];
    const tick = (r: Combatant, buttons = 0) => {
      match.queueInputs(r.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: 0, pitch: 0, buttons }]);
      match.queueInputs(grd.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: 0, pitch: 0, buttons: 0 }]);
      events.push(...match.step());
    };
    for (let i = 0; i < 5; i++) tick(res);
    grd.move = { pos: { x: 34, y: 0, z: 2 }, velY: 0, grounded: true };
    res.move = { pos: { x: 29, y: 0, z: 8 }, velY: 0, grounded: true };
    tick(res);
    tick(res, BUTTON_USE);
    expect(match.snapshot([]).md?.hg?.[0]?.[4]).toBe(HOSTAGE_FOLLOWING);
    // Walk west in steps; the hostage keeps up behind.
    for (let x = 29; x >= 4; x -= 0.08) {
      res.move = { pos: { x, y: 0, z: 8 }, velY: 0, grounded: true };
      grd.move = { pos: { x: 34, y: 0, z: 2 }, velY: 0, grounded: true };
      tick(res);
    }
    for (let i = 0; i < 120; i++) tick(res);
    expect(events.some((e) => e.e === 'hostage' && e.a === 'rescue')).toBe(true);
    const win = events.find((e) => e.e === 'elim' && e.a === 'win');
    expect(win && win.e === 'elim' && win.team).toBe(res.faction);
  });

  it('bots play rounds on Dockside Depot (rounds end; rescuers go for the hostages)', () => {
    const r = loadMap(JSON.parse(readFileSync(new URL('../../../maps/dockside_depot.json', import.meta.url), 'utf8')));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(playableModes(r.map)).toContain('core.hostage');
    const match = new Match(r.map, { ...DEFAULT_RULES['core.hostage'], teamSizes: [4, 4] }, 3);
    for (let i = 0; i < 8; i++) match.addBot(`b${i}`, CORE_BOT_PROFILES[i % 4]!);
    const events: GameEvent[] = [];
    for (let t = 0; t < 60 * 160; t++) events.push(...match.step());
    expect(events.some((e) => e.e === 'elim' && e.a === 'win')).toBe(true);
  }, 120000);
});
