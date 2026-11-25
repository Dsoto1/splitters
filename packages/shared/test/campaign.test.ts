import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CAMPAIGN_SIDE_MAX,
  CORE_LOOKS,
  campaignProblems,
  characterTier,
  isRetiredMap,
  readCampaign,
  TRAINING_MAPS,
  type CampaignRefs,
} from '../src/index.ts';
import { WHOLE_BODY_NPC_LOOKS } from '../src/content/characters.generated.ts';

/** content/campaign.json against the game itself: every map and character it names is real and usable. */
const raw = JSON.parse(readFileSync(new URL('../../../content/campaign.json', import.meta.url), 'utf8')) as unknown;
const looks = new Map(CORE_LOOKS.map((l) => [l.id, l]));
const npcs = new Set(WHOLE_BODY_NPC_LOOKS.map((l) => l.id));

const refs: CampaignRefs = {
  map(id) {
    const file = new URL(`../../../maps/${id}.json`, import.meta.url);
    if (!existsSync(file)) return 'no such map in maps/';
    if (isRetiredMap(id) || TRAINING_MAPS.has(id)) return 'a retired or training map';
    const modes = (JSON.parse(readFileSync(file, 'utf8')) as { metadata: { supportedModes?: string[] } }).metadata.supportedModes ?? [];
    return modes.includes('core.tdm') || modes.includes('core.deathmatch') ? null : 'Story plays Team Deathmatch or Deathmatch: the map has neither';
  },
  character(id, use) {
    const l = looks.get(id);
    if (!l) return use === 'boss' && npcs.has(id) ? null : 'not a character on the roster';
    if (use !== 'boss' && characterTier(l) !== 'core') return 'an experimental character';
    return null;
  },
};

describe('campaign data (content/campaign.json)', () => {
  it('is well formed and every reference resolves', () => {
    expect(campaignProblems(raw, refs)).toEqual([]);
  });

  it('has the slice: one historical, one modern, one future sector and a convergence between two of them', () => {
    const d = readCampaign(raw);
    expect(d.sectors.map((s) => s.classification).sort()).toEqual(['future', 'historical', 'modern']);
    const jade = d.sectors.find((s) => s.classification === 'historical')!;
    expect(jade.name).toBe('The Jade Empire');
    // Owner, 2026-11-25: Balam Nightclaw, Talon Skycrest, the Sun Warrior and Aurelio in the boss encounter.
    expect([jade.boss.character, ...jade.boss.companions].sort()).toEqual(['core.aztecjaguar', 'core.eagleclan', 'core.goldenwarrior', 'core.sunpriest']);
    expect(d.convergences).toHaveLength(1);
    expect(d.convergences[0]!.sectors.every((s) => d.sectors.some((x) => x.id === s))).toBe(true);
    // Placeholders until the owner names them.
    expect([...d.sectors, ...d.convergences].every((x) => x.provisional)).toBe(true);
  });

  it('keeps every side at 14 or fewer', () => {
    for (const s of readCampaign(raw).sectors) expect(s.expedition.crew + s.expedition.allies.length).toBeLessThanOrEqual(CAMPAIGN_SIDE_MAX);
  });
});

describe('campaignProblems', () => {
  const sector = (id: string, over: Record<string, unknown> = {}) => ({
    id,
    name: 'S',
    classification: 'modern',
    period: 'P',
    description: 'D',
    maps: [
      { map: 'a', unlock: `core.${id}1` },
      { map: 'b', unlock: `core.${id}2` },
      { map: 'c', unlock: `core.${id}3` },
    ],
    boss: { character: 'core.boss', companions: [] },
    rewards: [],
    expedition: { crew: 9, allies: ['core.x'] },
    ...over,
  });
  const ok = { sectors: [sector('one'), sector('two')], convergences: [{ id: 'both', name: 'B', description: 'D', sectors: ['one', 'two'], maps: ['z'], rewards: [] }] };

  it('passes good data', () => expect(campaignProblems(ok)).toEqual([]));

  it('refuses duplicate ids, across sectors and convergences', () => {
    expect(campaignProblems({ ...ok, sectors: [sector('one'), sector('one', { maps: sector('dup').maps })] }).join()).toMatch(/one is used twice/);
    expect(campaignProblems({ ...ok, convergences: [{ ...ok.convergences[0], id: 'one' }] }).join()).toMatch(/one is used twice/);
  });

  it('refuses more than 14 a side and a crew outside 8-10', () => {
    const allies = ['core.a', 'core.b', 'core.c', 'core.d', 'core.e'];
    expect(campaignProblems({ ...ok, sectors: [sector('one', { expedition: { crew: 10, allies } }), sector('two')] }).join()).toMatch(/over 14 a side/);
    expect(campaignProblems({ ...ok, sectors: [sector('one', { expedition: { crew: 7, allies: [] } }), sector('two')] }).join()).toMatch(/crew: 8-10/);
  });

  it('wants 3 maps a sector and one character unlocked by one place only', () => {
    expect(campaignProblems({ ...ok, sectors: [sector('one', { maps: sector('one').maps.slice(0, 2) }), sector('two')] }).join()).toMatch(/exactly 3/);
    expect(campaignProblems({ ...ok, sectors: [sector('one', { rewards: ['core.two1'] }), sector('two')] }).join()).toMatch(/already unlocked/);
  });

  it('wants a convergence to join two different, real sectors', () => {
    expect(campaignProblems({ ...ok, convergences: [{ ...ok.convergences[0], sectors: ['one', 'nope'] }] }).join()).toMatch(/nope isn't a sector/);
    expect(campaignProblems({ ...ok, convergences: [{ ...ok.convergences[0], sectors: ['one', 'one'] }] }).join()).toMatch(/two different/);
  });

  it('reports references the game does not have', () => {
    const why = campaignProblems(ok, { map: (m) => (m === 'b' ? 'no such map' : null), character: (c) => (c === 'core.x' ? 'not on the roster' : null) });
    expect(why.some((l) => /maps\[1\]: b: no such map/.test(l))).toBe(true);
    expect(why.some((l) => /allies: core.x: not on the roster/.test(l))).toBe(true);
  });
});
