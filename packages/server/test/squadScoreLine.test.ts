import { beforeAll, describe, expect, it } from 'vitest';
import { CORE_BOT_PROFILES, DEFAULT_RULES, TICK_RATE, initPhysics } from '@tiletrigger/shared';
import { Match, initNavigation, type Combatant } from '@tiletrigger/shared/match';
import { squadScoreText, squadScores } from '../src/tools/squadMeasures.ts';
import { makeMap } from '../../shared/test/helpers.ts';

/** bot-report's squad-score line (Fireteams follow-ups): every squad's points, the best squad and the MVP. */

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

describe('bot-report: the squad-score line', () => {
  it('formats squads (most points first, with their CTF role), the best squad and the MVP', () => {
    const text = squadScoreText({ squads: [[3, 'red', 'Ann', 40, 'attack'], [1, 'blue', 'Bo', 10, ''], [2, 'red', 'Cy', 0, 'defend']], best: [3, 'Ann', 40], mvp: ['Ann', 3, 25] });
    expect(text).toBe('squad scores: #3 red Ann (attack) 40, #1 blue Bo 10, #2 red Cy (defend) 0 | best squad #3 (Ann) 40 | MVP Ann (#3) 25');
    expect(squadScoreText({ squads: [], best: null, mvp: null })).toBe('squad scores: - | best squad - | MVP -');
  });

  it('reads a match: the points by squad, the best squad as the awards name it, the MVP with the most points', () => {
    const tiles = [];
    for (let x = 0; x < 10; x++) for (let y = 0; y < 3; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
    const map = makeMap(tiles, [[0, 0, 4], [70, 0, 4], [10, 0, 10], [60, 0, 10]]);
    const match = new Match(map, { ...DEFAULT_RULES['core.tdm'], teamSizes: [4, 4], fireteams: 4, scoreLimit: 0, timeLimitSeconds: 0 }, 1);
    for (let i = 0; i < 8; i++) match.addBot(`b${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!);
    for (let i = 0; i < TICK_RATE * 10 && match.phase !== 'playing'; i++) match.step();
    match.step();
    const ft = match.fireteams!;
    ft.scores.reset();
    const kill = (match as unknown as { kill: (v: Combatant, k: Combatant | null, w: string) => void }).kill.bind(match);
    const [a, b] = match.teams!.map((t) => match.combatants().filter((c) => c.faction === t.id));
    kill(b![0]!, a![1]!, 'core.rifle');
    kill(b![1]!, a![1]!, 'core.rifle');
    kill(a![0]!, b![2]!, 'core.rifle');
    const r = squadScores(match)!;
    const sa = ft.squadOf(a![1]!.slot)!;
    const sb = ft.squadOf(b![2]!.slot)!;
    expect(r.squads[0]).toEqual([sa.id, sa.team, match.slots[sa.leader!]!.name, 20, '']);
    expect(r.squads[1]![3]).toBe(10);
    expect(r.best).toEqual([sa.id, match.slots[sa.leader!]!.name, 20]);
    expect(r.mvp).toEqual([a![1]!.name, sa.id, 20]);
    expect(sb.id).not.toBe(sa.id);
    expect(squadScoreText(r)).toContain(`MVP ${a![1]!.name} (#${sa.id}) 20`);
  });
});
