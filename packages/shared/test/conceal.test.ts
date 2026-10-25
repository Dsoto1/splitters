import { beforeAll, describe, expect, it } from 'vitest';
import { BOT_DIFFICULTIES, BUTTON_CROUCH, CORE_BOT_PROFILES, BUTTON_FIRE, DEFAULT_DEATHMATCH_RULES, getProp, initPhysics, type MapDocument } from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

/** An open yard with one large bush at (12, 0, 4). */
function yard(): MapDocument {
  const tiles = [];
  for (let x = 0; x < 4; x++) for (let y = 0; y < 2; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  const map = makeMap(tiles, [[0, 0, 4], [12, 0, 4]]);
  return { ...map, entities: [...map.entities, { id: 'bush', kind: 'prop' as const, model: 'prop.nt_bush_leafy', position: [12, 0, 4] as [number, number, number], yaw: 0, scale: 1, solid: false, tint: null }] };
}

const concealed = (m: Match, c: Combatant): boolean => (m as unknown as { concealed(c: Combatant): boolean }).concealed(c);

describe('hiding in bushes', () => {
  it('bush props are marked as cover to hide in', () => {
    expect(getProp('prop.nt_bush_leafy')?.conceals).toBe(true);
    expect(getProp('prop.bush')?.conceals).toBe(true);
    expect(getProp('prop.crate_large')?.conceals).toBeFalsy();
  });

  it('crouched in a bush you are hidden; standing up, stepping out or firing gives you away', () => {
    const m = new Match(yard(), DEFAULT_DEATHMATCH_RULES, 1);
    const me = m.addHuman('me')!;
    let seq = 0;
    const input = (buttons: number) => m.queueInputs(me.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: 0, pitch: 0, buttons }]);
    me.move = { pos: { x: 12, y: 0, z: 4 }, velY: 0, grounded: true };
    for (let i = 0; i < 20; i++) {
      input(BUTTON_CROUCH);
      m.step();
    }
    expect(concealed(m, me)).toBe(true);
    // Firing shows where you are for a moment.
    input(BUTTON_CROUCH | BUTTON_FIRE);
    m.step();
    expect(concealed(m, me)).toBe(false);
    // Out of the bush: seen.
    me.move = { ...me.move, pos: { x: 20, y: 0, z: 4 } };
    for (let i = 0; i < 160; i++) {
      input(BUTTON_CROUCH);
      m.step();
    }
    expect(concealed(m, me)).toBe(false);
  });

  it('a bot looking straight at a hidden player 10 m away does not shoot; once they stand up it does', () => {
    const m = new Match(yard(), DEFAULT_DEATHMATCH_RULES, 2);
    const me = m.addHuman('me')!;
    const bot = m.addBot('bot', { ...CORE_BOT_PROFILES[3]!, exploration: 0, itemGreed: 0, tags: [] }, BOT_DIFFICULTIES.normal)!;
    let seq = 0;
    const run = (ticks: number, buttons: number) => {
      const shots: number[] = [];
      for (let i = 0; i < ticks; i++) {
        me.health = 100;
        me.move = { ...me.move, pos: { x: 12, y: 0, z: 4 } };
        bot.move = { ...bot.move, pos: { x: 2, y: 0, z: 4 } };
        m.queueInputs(me.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: -Math.PI / 2, pitch: 0, buttons }]);
        for (const e of m.step()) if (e.e === 'shot' && e.s === bot.slot) shots.push(m.tick);
      }
      return shots.length;
    };
    expect(run(150, BUTTON_CROUCH)).toBe(0);
    expect(run(150, 0)).toBeGreaterThan(0);
  });
});
