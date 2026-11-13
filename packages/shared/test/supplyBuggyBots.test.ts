import { beforeAll, describe, expect, it } from 'vitest';
import { BOT_DIFFICULTIES, CORE_BOT_PROFILES, DEFAULT_DEATHMATCH_RULES, TICK_RATE, initPhysics, type GameEvent, type MapDocument } from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const rules = { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000 };

/** An open yard 40 × 32 m with a Supply Buggy at (20, 0, 14) facing +z (its tailgate toward -z), on `faction`'s side. */
function yard(faction: string | null): MapDocument {
  const tiles = [];
  for (let x = 0; x < 5; x++) for (let y = 0; y < 4; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  const map = makeMap(tiles, [[0, 0, 0]]);
  return { ...map, entities: [...map.entities, { id: 'mount_0', kind: 'mount' as const, position: [20, 0, 14] as [number, number, number], model: 'supply_buggy', yaw: 0, faction, respawnSeconds: null }] };
}

/** A bot keen on items, 10 m from the tailgate, every gun's reserve kept empty; the first time it resupplies. */
function shortBot(faction: string | null): { got: Extract<GameEvent, { e: 'resupply' }> | undefined; bot: Combatant } {
  const match = new Match(yard(faction), rules);
  const bot = match.addBot('bot', { ...CORE_BOT_PROFILES[3]!, itemGreed: 100 }, BOT_DIFFICULTIES.normal)!;
  match.step();
  bot.move = { pos: { x: 12, y: 0, z: 6 }, velY: 0, grounded: true };
  let got: Extract<GameEvent, { e: 'resupply' }> | undefined;
  for (let t = 0; t < 25 * TICK_RATE && !got; t++) {
    for (const w of bot.weapons.values()) w.reserve = 0;
    got = match.step().find((e): e is Extract<GameEvent, { e: 'resupply' }> => e.e === 'resupply' && e.s === bot.slot && e.ok);
  }
  return { got, bot };
}

describe('bots and the Supply Buggy', () => {
  it('a bot short of ammo goes to a Supply Buggy near it and resupplies at the tailgate (E there), not getting in', () => {
    const { got, bot } = shortBot(null);
    expect(got).toMatchObject({ m: 1, left: 9, ok: true });
    expect(bot.mount).toBeUndefined();
    expect([...bot.weapons.values()].filter((w) => w.def.reserveMax > 0).every((w) => w.reserve > 0)).toBe(true);
  });

  it("another team's Supply Buggy is not its own: it doesn't resupply there", () => {
    const { got } = shortBot('nobody_here');
    expect(got).toBeUndefined();
  });
});
