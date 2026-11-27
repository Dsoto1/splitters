import { describe, expect, it } from 'vitest';
import { BOT_NAMES, NAME_THEMES } from '../src/content/botNames.ts';
import { CHARACTER_GROUPS, NAME_TITLES, nameWithoutTitle, CORE_LOOKS, INSIGNIA_CUTS, INSIGNIA_IDS, INSIGNIA_LABELS, INSIGNIA_SHAPES, MARK_GROUPS, RANK_GROUPS, RANK_TITLES, addMatch, careerProblem, careerRankPoints, cleanSummary, emptyCareer, matchProblem, matchRankPoints, nameWithoutRank, rankGroup, rankInsignia, rankStep, rankTitle, rankedName, readCareer, readRankPoints, shownRank, type MatchSummary } from '../src/index.ts';

describe('ranks for everyone (Options → Ranks & badges)', () => {
  it('gives every group nine titles, first and last as the owner agreed', () => {
    const ends: Record<string, [string, string]> = { agency: ['Asset', 'Spymaster'], horror: ['Ghoul', 'Overlord'], space: ['Cadet', 'Admiral'], machines: ['Unit', 'Prime'], legends: ['Squire', 'Emperor'], animals: ['Pup', 'Apex'], folk: ['Rookie', 'Icon'], toys: ['Wind-Up', 'Toy of the Year'], pirates: ['Deckhand', 'Pirate King'], holiday: ['Guest', 'Holiday Legend'], historical: ['Commoner', 'Immortal'], army: ['Pvt.', 'Col.'] };
    for (const g of RANK_GROUPS) {
      const t = RANK_TITLES[g];
      expect(t).toHaveLength(9);
      expect(new Set(t).size).toBe(9);
      expect([t[0], t[8]]).toEqual(ends[g]);
    }
  });

  it('sorts every look into a rank group (a design of yours: Folk)', () => {
    const groups = new Set(CHARACTER_GROUPS.map((g) => g.id));
    for (const l of CORE_LOOKS) {
      const r = rankGroup(l.id);
      if (l.group === 'soldiers') expect(r).toBe(l.branch === 'agency' ? 'agency' : 'army');
      else if (l.group && groups.has(l.group)) expect(r).toBe(l.group);
    }
    expect(rankGroup('my.design')).toBe('folk');
    expect(rankGroup(undefined)).toBe('folk');
  });

  it('has a badge for every group and step, inside its box', () => {
    expect(INSIGNIA_IDS).toHaveLength(9 * 12);
    for (const g of RANK_GROUPS) for (let n = 1; n <= 9; n++) expect(INSIGNIA_IDS).toContain(rankInsignia(g, n));
    expect(rankInsignia('army', 4)).toBe('sgt');
    expect(rankInsignia('horror', 0)).toBe('horror1');
    expect(rankInsignia('horror', 12)).toBe('horror9');
    for (const g of MARK_GROUPS) expect(INSIGNIA_LABELS[`${g}5`]).toBe(RANK_TITLES[g][4]);
    for (const id of INSIGNIA_IDS) for (const p of [...INSIGNIA_SHAPES[id], ...INSIGNIA_CUTS[id]]) for (const [x, y] of p) expect(Math.max(Math.abs(x), Math.abs(y))).toBeLessThanOrEqual(1.0005);
    // Steps read apart: each of a group's nine badges is drawn differently.
    for (const g of MARK_GROUPS) expect(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => JSON.stringify(INSIGNIA_SHAPES[rankInsignia(g, n)]))).size).toBe(9);
  });

  it('rises with points and kills; leaders start higher', () => {
    expect(rankStep(0)).toBe(1);
    expect(rankStep(99)).toBe(1);
    expect(rankStep(100)).toBe(2);
    expect(rankStep(5000)).toBe(9);
    expect(rankStep(1e9)).toBe(9);
    expect(rankStep(0, 3)).toBe(3);
    expect(rankStep(0, 4)).toBe(4);
    expect(rankStep(1500, 4)).toBe(6);
    expect(matchRankPoints({ k: 5 })).toBe(50);
    expect(matchRankPoints({ k: 5, o: 2 })).toBe(110);
    expect(matchRankPoints({ k: -2 })).toBe(0);
    expect(matchRankPoints({ k: 5, p: 300 })).toBe(300);
  });

  it('puts the title before the name, an Army bot\'s own rank replaced', () => {
    expect(nameWithoutRank('Sgt. Dunmore')).toBe('Dunmore');
    expect(nameWithoutRank('Flt. Lt. Ember')).toBe('Flt. Lt. Ember');
    expect(nameWithoutRank('Sgt.')).toBe('Sgt.');
    expect(rankedName('Sgt. Dunmore', 'army', 1)).toBe('Pvt. Dunmore');
    expect(rankedName('Grimsby', 'horror', 4)).toBe('Ghast Grimsby');
    expect(rankedName('Flt. Lt. Ember', 'army', 2)).toBe('Pfc. Ember');
    expect(rankedName('Capt. Orion', 'space', 1)).toBe('Cadet Orion');
    const s = shownRank('core.chimpanzee', 'Chester Knuckleby', 2);
    expect(s.ins).toBe(`${s.group}2`);
    expect(s.name).toBe(`${RANK_TITLES[s.group][1]} Chester Knuckleby`);
  });

  // Owner, 2026-11-26: "do we accommodate when turning on ranks so they dont duplicate and instead actually just rank up".
  it('ranks names up instead of doubling their titles: every roster, theme and general name, in every group', () => {
    expect(rankedName('Det. Drake Montego', 'animals', 3)).toBe('Scout Drake Montego');
    expect(rankedName('Dr. Hugo Hue', 'folk', 1)).toBe('Rookie Hugo Hue');
    expect(rankedName('Sarge Tobias Crane', 'army', 4)).toBe('Sgt. Tobias Crane');
    expect(rankedName('Pvt. Pete Plastic', 'toys', 2)).toBe('Tin Toy Pete Plastic');
    expect(rankedName('Customs Agent Zhao', 'agency', 6)).toBe('Agent Zhao');
    expect(rankedName('Uncle Moe', 'folk', 1)).toBe('Rookie Uncle Moe'); // family words are names
    expect(rankedName('Imperator Laurel', 'legends', 9)).toBe('Emperor Laurel');
    expect(rankedName("Cap'n Ezra Blackwake", 'pirates', 1)).toBe('Deckhand Ezra Blackwake');
    expect(nameWithoutTitle('Sir')).toBe('Sir');
    const titled = (n: string) => NAME_TITLES.some((t) => n.startsWith(`${t} `));
    const names = new Set([...CORE_LOOKS.map((l) => l.name), ...NAME_THEMES.flatMap((t) => t.names), ...BOT_NAMES]);
    const doubled: string[] = [];
    for (const name of names) for (const g of RANK_GROUPS) for (let n = 1; n <= 9; n++) {
      const shown = rankedName(name, g, n);
      const rest = shown.slice(rankTitle(g, n).length + 1);
      if (titled(rest)) doubled.push(`${name} → ${shown}`);
    }
    expect(doubled).toEqual([]);
    // Every look's own name, ranked in its own group: one title.
    for (const l of CORE_LOOKS) expect(titled(shownRank(l.id, l.name, 5).name.slice(rankTitle(rankGroup(l.id), 5).length + 1)), l.name).toBe(false);
  });

  it('reads rank points from the wire only in range', () => {
    expect(readRankPoints(120)).toBe(120);
    expect(readRankPoints(-1)).toBeNull();
    expect(readRankPoints(1.5)).toBeNull();
    expect(readRankPoints('9')).toBeNull();
    expect(readRankPoints(1e12)).toBeNull();
  });
});

describe('a career keeps its rank points', () => {
  const match = (points?: number): MatchSummary => ({ mode: 'core.deathmatch', result: 'win', kills: 6, deaths: 2, shots: 40, hits: 10, headshots: 1, bestStreak: 3, seconds: 300, weaponKills: { 'core.rifle': 6 }, ...(points === undefined ? {} : { points }) });

  it('sums points; a career from before them counts its kills', () => {
    const c = addMatch(addMatch(emptyCareer(), match(90)), match());
    expect(c.points).toBe(90);
    expect(careerRankPoints(c)).toBe(120);
    expect(careerRankPoints(addMatch(c, match(400)))).toBe(490);
    expect(readCareer({ matches: 1, kills: 3 })!.points).toBe(0);
    expect(careerProblem({ ...c, points: 1e9 })).toMatch(/range/);
  });

  it('checks points in a match summary and keeps them', () => {
    expect(matchProblem(match(120))).toBeNull();
    expect(matchProblem(match())).toBeNull();
    expect(matchProblem(match(-5))).toMatch(/points/);
    expect(cleanSummary(match(120)).points).toBe(120);
    expect('points' in cleanSummary(match())).toBe(false);
  });
});
