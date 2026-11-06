import { beforeAll, describe, expect, it } from 'vitest';
import { BOT_DIFFICULTIES, BUTTON_CROUCH, BUTTON_PRONE, CORE_BOT_PROFILES, BUTTON_FIRE, DEFAULT_DEATHMATCH_RULES, applyCommand, getEnvSpecies, getProp, initPhysics, replacePropsCommand, type MapDocument, type PropEntity } from '../src/index.ts';
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

/**
 * The Kenney fern and small bush are retired once our fern and shrub hide players the same way (owner, 2026-11-05).
 * MapMaker's "Replace all" swaps a placed piece for a species keeping its height (replacePropsCommand, size 'height'),
 * so the proof runs on what that operation makes: in each stance, standing in the same spot, a player is hidden in the
 * replacement exactly when they were hidden in the Kenney piece, and a bot holds its fire the same way.
 */
describe('our fern and shrub hide players as the Kenney fern and small bush did', () => {
  const STANCE = { stand: 0, crouch: BUTTON_CROUCH, prone: BUTTON_PRONE } as const;
  /** The yard with one plant (`model`, at `scale`) at (12, 0, 4). */
  const yardWith = (model: string, scale: number, variant?: number): MapDocument => {
    const map = yard();
    return { ...map, entities: map.entities.map((e) => (e.id === 'bush' && e.kind === 'prop' ? ({ ...e, model, scale, ...(variant !== undefined ? { variant } : {}) } as PropEntity) : e)) };
  };
  /** The plant as "Replace all" turns `from` (at `scale`) into `to`. */
  const replaced = (from: string, scale: number, to: string): { model: string; scale: number; variant?: number } => {
    const doc = yardWith(from, scale);
    const e = applyCommand(doc, replacePropsCommand(doc, from, to, 'height')).entities.find((x) => x.id === 'bush') as { model: string; scale: number; variant?: number };
    return { model: e.model, scale: e.scale, variant: e.variant };
  };
  /** Whether a player in each stance, `dx` m east of the plant's middle, is hidden. */
  const hiddenBy = (map: MapDocument, dx: number): Record<keyof typeof STANCE, boolean> => {
    const out = {} as Record<keyof typeof STANCE, boolean>;
    for (const [name, buttons] of Object.entries(STANCE) as [keyof typeof STANCE, number][]) {
      const m = new Match(map, DEFAULT_DEATHMATCH_RULES, 1);
      const me = m.addHuman('me')!;
      let seq = 0;
      for (let i = 0; i < 40; i++) {
        me.move = { ...me.move, pos: { x: 12 + dx, y: 0, z: 4 } };
        m.queueInputs(me.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: 0, pitch: 0, buttons }]);
        m.step();
      }
      out[name] = concealed(m, me);
    }
    return out;
  };

  for (const [from, to, scale] of [
    ['prop.fern', 'env.fern.bracken', 1],
    ['prop.fern', 'env.fern.bracken', 1.3],
    ['prop.fern', 'env.fern.bracken#1', 0.85],
    ['prop.bush_small', 'env.shrub.broadleaf', 1],
    ['prop.bush_small', 'env.shrub.broadleaf#1', 1.3],
    // Shingle Point's bushes (its refresh): the Kenney large bush and the Quaternius leafy bush, at the scales it places.
    ['prop.bush_large', 'env.shrub.broadleaf', 1],
    ['prop.nt_bush_leafy', 'env.shrub.broadleaf', 1],
    ['prop.nt_bush_leafy', 'env.shrub.broadleaf', 1.5],
    ['prop.nt_bush_leafy', 'env.shrub.broadleaf', 2],
    ['prop.bush_large', 'env.shrub.broadleaf', 1.1],
  ] as const) {
    it(`${from} ×${scale} → ${to}: hidden in the same stances, at the middle and near the edge`, () => {
      const r = replaced(from, scale, to);
      expect(r.model).toBe(to.split('#')[0]);
      expect(getEnvSpecies(r.model)!.conceals).not.toBeNull();
      const before = yardWith(from, scale);
      const after = yardWith(r.model, r.scale, r.variant);
      // Just inside the Kenney piece's own radius at this scale: inside both cylinders.
      const edge = (Math.min(getProp(from)!.size[0], getProp(from)!.size[2]) * scale) / 2 - 0.05;
      for (const dx of [0, edge]) expect(hiddenBy(after, dx), `${r.model} ×${r.scale}, ${dx} m from the middle`).toEqual(hiddenBy(before, dx));
    });
  }

  it('the stances they hide: a fern hides you crouched or prone, a small bush only prone', () => {
    const fern = replaced('prop.fern', 1, 'env.fern.bracken');
    expect(hiddenBy(yardWith(fern.model, fern.scale), 0)).toEqual({ stand: false, crouch: true, prone: true });
    const bush = replaced('prop.bush_small', 1, 'env.shrub.broadleaf');
    expect(hiddenBy(yardWith(bush.model, bush.scale), 0)).toEqual({ stand: false, crouch: false, prone: true });
  });

  for (const [from, to, stance] of [['prop.fern', 'env.fern.bracken', 'crouch'], ['prop.bush_small', 'env.shrub.broadleaf', 'prone']] as const) {
    it(`a bot 10 m away does not shoot a player ${stance === 'crouch' ? 'crouched' : 'lying'} in ${to} (as Replace all sizes it for ${from}); once they stand it does`, () => {
      const shotsAt = (map: MapDocument) => {
        const m = new Match(map, DEFAULT_DEATHMATCH_RULES, 2);
        const me = m.addHuman('me')!;
        const bot = m.addBot('bot', { ...CORE_BOT_PROFILES[3]!, exploration: 0, itemGreed: 0, tags: [] }, BOT_DIFFICULTIES.normal)!;
        let seq = 0;
        return (ticks: number, buttons: number) => {
          let shots = 0;
          for (let i = 0; i < ticks; i++) {
            me.health = 100;
            me.move = { ...me.move, pos: { x: 12, y: 0, z: 4 } };
            bot.move = { ...bot.move, pos: { x: 2, y: 0, z: 4 } };
            m.queueInputs(me.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: -Math.PI / 2, pitch: 0, buttons }]);
            for (const e of m.step()) if (e.e === 'shot' && e.s === bot.slot) shots++;
          }
          return shots;
        };
      };
      // Control: in the open (a flower that hides nobody) the bot shoots a player in that stance.
      expect(shotsAt(yardWith('prop.flower_red', 1))(150, STANCE[stance])).toBeGreaterThan(0);
      const r = replaced(from, 1, to);
      const run = shotsAt(yardWith(r.model, r.scale, r.variant));
      expect(run(150, STANCE[stance])).toBe(0);
      expect(run(150, 0)).toBeGreaterThan(0);
      // The Kenney piece it replaces: the same.
      const old = shotsAt(yardWith(from, 1));
      expect(old(150, STANCE[stance])).toBe(0);
      expect(old(150, 0)).toBeGreaterThan(0);
    });
  }
});
