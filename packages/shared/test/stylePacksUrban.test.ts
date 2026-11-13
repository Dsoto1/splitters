import { describe, expect, it } from 'vitest';
import { FACADES, SCENARIO_PALETTE, STYLE_PACKS, builtInSetPieces, coreCatalog, coreMaterials, coreThemes, getItem, getProp, getStylePack, isKitModel, placementPack, propAlias, stylePackHas } from '../src/index.ts';

/**
 * Style Pack 14 Urban & Civilian (Tileset 11; docs/map-briefs/urban/URBAN_PLAN.md). It is a list of pieces the game
 * already has, by reference: no tiles of its own, nothing copied or renamed, and the packs it draws on keep their lists.
 */
describe('Style Pack 14 Urban & Civilian', () => {
  const pack = getStylePack('urban')!;

  it('is registered as a list of existing pieces, with no tiles of its own and no demo map yet', () => {
    expect(pack).toMatchObject({ number: '14', displayName: 'Urban & Civilian' });
    expect(STYLE_PACKS[STYLE_PACKS.length - 1]).toBe(pack);
    // The owner, 2026-11-13: no demo map yet. A pack may have none; it names no map as if it were one.
    expect(pack.demo).toBeUndefined();
    // No tile and no prop is the pack's own: every id belongs to something that was already there.
    expect(coreCatalog.all().filter((d) => d.id.startsWith('urban.'))).toEqual([]);
    expect(pack.tiles.filter((id) => id.startsWith('urban.'))).toEqual([]);
    for (const id of pack.themes) expect(coreThemes.get(id), id).toBeDefined();
    expect(pack.tiles.length).toBeGreaterThanOrEqual(30);
    expect(pack.props.length).toBeGreaterThanOrEqual(60);
    expect(pack.materials.length).toBeGreaterThanOrEqual(20);
    expect(pack.facades).toEqual(['brick', 'storefront', 'plaster', 'clapboard', 'suburban_brick', 'glass', 'corrugated']);
    for (const f of pack.facades) expect(FACADES).toContain(f);
  });

  it('every piece it lists exists, none is retired, and nothing is listed twice', () => {
    for (const id of pack.tiles) expect(coreCatalog.get(id), id).toBeDefined();
    for (const p of pack.props) {
      expect(getProp(p), p).toBeDefined();
      expect(propAlias(p), `${p} is retired`).toBeUndefined();
    }
    for (const m of pack.materials) expect(coreMaterials.get(m), m).toBeDefined();
    for (const k of pack.gameplay) expect(SCENARIO_PALETTE.some((e) => e.key === k), k).toBe(true);
    for (const k of Object.keys(pack.gameplayNotes ?? {})) expect(pack.gameplay as readonly string[], k).toContain(k);
    for (const i of pack.pickups) expect(getItem(i), i).toBeDefined();
    for (const list of [pack.tiles, pack.props, pack.materials, pack.gameplay, pack.pickups]) expect(new Set(list).size).toBe(list.length);
    expect(pack.props.filter(isKitModel).length).toBeGreaterThanOrEqual(12);
  });

  it('cross-lists: the packs it draws on still list their own pieces', () => {
    for (const other of STYLE_PACKS.filter((p) => p.id !== 'urban')) {
      const own = coreCatalog.all().filter((d) => d.id.startsWith(`${other.id}.`)).map((d) => d.id);
      for (const id of pack.tiles.filter((t) => own.includes(t))) expect(other.tiles, `${other.id} keeps ${id}`).toContain(id);
    }
    // The eight Suburban tiles, the seven Industrial ones and the Neon shop and block are in both lists.
    expect(pack.tiles.filter((t) => t.startsWith('suburban.'))).toHaveLength(8);
    expect(pack.tiles.filter((t) => t.startsWith('industrial.'))).toHaveLength(7);
    expect(pack.tiles.filter((t) => t.startsWith('city.'))).toHaveLength(5);
    for (const id of ['neon.shop_a', 'neon.block_n']) {
      expect(stylePackHas(pack, `tile:${id}`)).toBe(true);
      expect(stylePackHas(getStylePack('neon')!, `tile:${id}`)).toBe(true);
    }
    expect(stylePackHas(pack, 'tile:jungle.ziggurat')).toBe(false);
  });

  it('has its role pack for set pieces, the default for no theme, on the pieces that suit a town', () => {
    const library = builtInSetPieces();
    const roles = library.packs.get('urban')!;
    expect(roles).toMatchObject({ displayName: 'Urban & Civilian', stylePack: 'urban', themes: [] });
    for (const role of ['stone', 'trim', 'floor', 'paving', 'roof', 'wood', 'metal'] as const) expect(coreMaterials.get(roles.roles[role]!.material), role).toBeDefined();
    expect(roles.roles).toMatchObject({ facade: 'brick', door: 'oak', glass: 'breakable' });
    // A theme belongs to one role pack at most, and this one takes none: a set piece placed with no pack named in a
    // City Block, Factory or Research Lab map is painted by its theme, as before.
    for (const theme of ['core.city', 'core.factory', 'core.lab']) expect(placementPack({}, theme, library), theme).toBeNull();
    expect(placementPack({ pack: 'urban' }, 'core.city', library)?.id).toBe('urban');
    expect(placementPack({}, 'core.suburban', library)?.id).toBe('suburban');
    const suits = [...library.pieces.values()].filter((d) => d.packs.includes('urban')).map((d) => d.id);
    expect(suits).toEqual(expect.arrayContaining(['setpiece.crossroads_plaza', 'setpiece.loading_dock', 'setpiece.skybridge_2', 'setpiece.stair_tower_4', 'setpiece.atrium_tower', 'setpiece.catwalk_bridge_3']));
    expect(suits).toHaveLength(16);
  });
});
