import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  SETUP_KIND_DEFS,
  SETUP_KINDS,
  builtInKind,
  emptyProgress,
  inSetupKind,
  isUnlistedMap,
  readCampaign,
  recordWin,
  storySetupRows,
  type CampaignData,
  type CampaignProgress,
} from '../src/index.ts';

// Match Setup's tabs (docs/CAMPAIGN.md, "Match Setup by sector"): Story from the campaign data; Arenas, Arcade and
// Battlegrounds from each map's own metadata; Custom every map.
const MAPS = new URL('../../../maps/', import.meta.url);
const listed = readdirSync(MAPS)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.slice(0, -5))
  .filter((id) => !isUnlistedMap(id))
  .map((id) => {
    const m = JSON.parse(readFileSync(new URL(`${id}.json`, MAPS), 'utf8')).metadata;
    return { id, modes: m.supportedModes as string[], maxPlayers: m.recommendedPlayers.max as number };
  });

describe('Match Setup tabs', () => {
  it('has the owner’s five tabs in order', () => {
    expect([...SETUP_KINDS]).toEqual(['story', 'arenas', 'arcade', 'battlegrounds', 'custom']);
    expect(SETUP_KIND_DEFS.map((d) => d.label)).toEqual(['Story', 'Arenas', 'Arcade', 'Battlegrounds', 'Custom']);
  });

  it('puts every built-in map under exactly one of Arenas, Arcade and Battlegrounds, and every map under Custom', () => {
    for (const m of listed) {
      const under = (['arenas', 'arcade', 'battlegrounds'] as const).filter((k) => inSetupKind(m, k));
      expect(under, m.id).toHaveLength(1);
      expect(inSetupKind(m, 'custom')).toBe(true);
      expect(inSetupKind(m, 'story')).toBe(false);
    }
    const by = (k: string) => listed.filter((m) => builtInKind(m) === k).map((m) => m.id);
    // Each tab has maps today.
    for (const k of ['arenas', 'arcade', 'battlegrounds']) expect(by(k).length, k).toBeGreaterThan(0);
  });

  it('sorts by the rule: the first mode an arcade one, then 24+ players or Breakthrough, else Arenas', () => {
    const kind = (id: string) => builtInKind(listed.find((m) => m.id === id)!);
    expect(kind('grid_rings')).toBe('arcade'); // Discs
    expect(kind('fort_meadow')).toBe('arcade'); // Forts first
    expect(kind('st_johns')).toBe('battlegrounds'); // 8-32
    expect(kind('iron_coast')).toBe('battlegrounds'); // Breakthrough
    expect(kind('sandgate')).toBe('arenas');
    expect(kind('canyon')).toBe('arenas');
    expect(builtInKind({ modes: ['core.tdm'], maxPlayers: 20 })).toBe('arenas');
    expect(builtInKind({ modes: ['core.tdm'], maxPlayers: 24 })).toBe('battlegrounds');
    expect(builtInKind({ modes: ['core.tdm', 'core.zombies'], maxPlayers: 32 })).toBe('battlegrounds');
    expect(builtInKind({ modes: ['core.zombies', 'core.tdm'], maxPlayers: 32 })).toBe('arcade');
  });

  it('keeps your own and the community maps under Custom only', () => {
    for (const extra of [{ own: true }, { community: true }]) {
      const m = { modes: ['core.discs'], maxPlayers: 64, ...extra };
      expect(builtInKind(m)).toBeNull();
      expect(SETUP_KINDS.filter((k) => inSetupKind(m, k))).toEqual(['custom']);
    }
  });
});

const sector = (id: string) => ({
  id,
  name: id,
  classification: 'historical' as const,
  period: 'P',
  description: 'D',
  maps: [1, 2, 3].map((n) => ({ map: `${id}_map${n}`, unlock: `core.${id}${n}` })),
  boss: { character: `core.${id}boss`, companions: [] },
  rewards: [`core.${id}boss`],
  expedition: { crew: 10, allies: [] },
});
const DATA: CampaignData = {
  sectors: [sector('a'), sector('b'), sector('c')],
  convergences: [{ id: 'ab', name: 'AB', description: 'D', sectors: ['a', 'b'], maps: ['ab_map'], rewards: [] }],
};
const win = (p: CampaignProgress, owner: string, map: string) => recordWin(p, DATA, owner, map).progress;

describe('Story rows', () => {
  it('builds a row per sector in the data’s order: map 1 open, the others locked, then an Unknown tile', () => {
    const rows = storySetupRows(DATA, emptyProgress());
    expect(rows.map((r) => r.sector.id)).toEqual(['a', 'b', 'c']);
    for (const r of rows) {
      expect(r.maps.map((m) => m.state)).toEqual(['open', 'locked', 'locked']);
      expect(r.tiles).toEqual([{ unknown: true }]);
    }
  });

  it('marks won maps, and the next to win in Story (still locked for hosting until it is won)', () => {
    const p = win(emptyProgress(), 'a', 'a_map1');
    expect(storySetupRows(DATA, p)[0]!.maps.map((m) => m.state)).toEqual(['won', 'next', 'locked']);
    const q = win(p, 'a', 'a_map2');
    expect(storySetupRows(DATA, q)[0]!.maps.map((m) => m.state)).toEqual(['won', 'won', 'next']);
  });

  it('shows the convergence by name once found, and nothing locked when locks are off', () => {
    let p = emptyProgress();
    for (const s of ['a', 'b']) for (const n of [1, 2, 3]) p = win(p, s, `${s}_map${n}`);
    const rows = storySetupRows(DATA, p);
    expect(rows[0]!.maps.map((m) => m.state)).toEqual(['won', 'won', 'won']);
    expect(rows[0]!.tiles).toEqual([{ known: DATA.convergences[0] }]);
    expect(rows[2]!.tiles).toEqual([{ unknown: true }]);
    expect(storySetupRows(DATA, emptyProgress(), false).flatMap((r) => r.maps.map((m) => m.state))).not.toContain('locked');
  });

  it('re-sorts itself as the sectors change (reordered, added, more maps)', () => {
    const moved: CampaignData = { ...DATA, sectors: [DATA.sectors[2]!, { ...DATA.sectors[0]!, maps: [...DATA.sectors[0]!.maps, { map: 'a_map4', unlock: 'core.a4' }] }] };
    const rows = storySetupRows(moved, emptyProgress());
    expect(rows.map((r) => r.sector.id)).toEqual(['c', 'a']);
    expect(rows[1]!.maps.map((m) => m.map)).toEqual(['a_map1', 'a_map2', 'a_map3', 'a_map4']);
  });

  it('reads the real campaign: every row’s maps are listed suite maps', () => {
    const data = readCampaign(JSON.parse(readFileSync(new URL('../../../content/campaign.json', import.meta.url), 'utf8')));
    const rows = storySetupRows(data, emptyProgress());
    expect(rows.length).toBe(data.sectors.length);
    for (const r of rows) for (const m of r.maps) expect(listed.some((l) => l.id === m.map), m.map).toBe(true);
  });
});
