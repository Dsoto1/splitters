// New map's setup screen (owner, 2026-11-24): the defaults make the blank map New always made, each choice lands in
// the document where Map properties keeps it, and a "Start from" layout keeps what it sets itself.
import { DEFAULT_GROUND_THEME, fitBounds, loadMap, mapPlayerCaps, matchingGroundTheme, newMapDocument, playableRect, type MapDocument } from '@tiletrigger/shared';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BOUNDARY_CHOICES, MAIN_MODES, STARTER_TERRAIN, starterMap, layoutOwns, layoutWithSetup, newMapDefaults, newMapFromSetup, setupModes, suggestedSize } from '../src/editor/newMapSetup.ts';

/** A map without what differs each time it is made (ids, dates). */
const shape = (doc: MapDocument) =>
  JSON.parse(JSON.stringify(doc, (k, v) => (k === 'id' || k === 'createdAt' || k === 'updatedAt' ? undefined : v))) as unknown;

const template = (id: string): MapDocument => {
  const json = JSON.parse(readFileSync(fileURLToPath(new URL(`../../../maps/templates/${id}.json`, import.meta.url)), 'utf8'));
  const r = loadMap(json, undefined, { forEditing: true });
  if (!r.ok) throw new Error(`template ${id} does not load`);
  return r.map;
};

describe('New map setup defaults', () => {
  it('are the blank map New made before: Medium ground, its Ground theme, Prototype, Deathmatch, 8 players, no boundary', () => {
    const d = newMapDefaults();
    const blank = newMapDocument();
    expect(d).toEqual({ size: STARTER_TERRAIN, ground: DEFAULT_GROUND_THEME, theme: blank.classicStructure.theme, mode: 'core.deathmatch', also: [], best: 8, upTo: null, boundary: '' });
    expect(shape(newMapFromSetup(d))).toEqual(shape(starterMap(STARTER_TERRAIN, DEFAULT_GROUND_THEME)));
    const doc = newMapFromSetup(d);
    expect(doc.bounds).toBeNull();
    expect(doc.metadata.playerCaps).toBeUndefined();
    expect(playableRect(doc)?.from).toBe('terrain');
  });

  it("start on the default theme's own Ground theme, so a theme change can take its match", () => {
    expect(matchingGroundTheme(newMapDefaults().theme)).toBe(newMapDefaults().ground);
  });

  it('suggest the default size for the default players', () => {
    const d = newMapDefaults();
    expect(suggestedSize(d.best)).toBe(d.size);
  });
});

describe('New map setup choices', () => {
  it('set the Structure theme, the modes (main first) and the players where Map properties keeps them', () => {
    const doc = newMapFromSetup({ ...newMapDefaults(), theme: 'core.military', ground: matchingGroundTheme('core.military'), mode: 'core.tdm', also: ['core.deathmatch', 'core.tdm'], best: 12, upTo: 24 });
    expect(doc.classicStructure.theme).toBe('core.military');
    expect(doc.terrain?.groundTheme ?? DEFAULT_GROUND_THEME).toBe(matchingGroundTheme('core.military'));
    expect(doc.metadata.supportedModes).toEqual(['core.tdm', 'core.deathmatch']);
    expect(doc.metadata.recommendedPlayers).toEqual({ min: 2, max: 12 });
    expect(mapPlayerCaps(doc, 'core.tdm')).toEqual({ recommended: 12, max: 24, auto: false });
  });

  it("leave the most automatic when it isn't set, and a squad mode keeps one number", () => {
    expect(newMapFromSetup({ ...newMapDefaults(), best: 6 }).metadata.playerCaps).toBeUndefined();
    const coop = newMapFromSetup({ ...newMapDefaults(), mode: 'core.coop', best: 4, upTo: 10 });
    expect(coop.metadata.playerCaps).toBeUndefined();
    expect(coop.metadata.recommendedPlayers.max).toBe(4);
    expect(setupModes({ mode: 'core.coop', also: ['core.coop', 'core.deathmatch'] })).toEqual(['core.coop', 'core.deathmatch']);
  });

  it('fit a boundary round the new map with Fit to map, or none for the terrain edge', () => {
    for (const [style] of BOUNDARY_CHOICES) {
      const doc = newMapFromSetup({ ...newMapDefaults(), boundary: style });
      if (!style) {
        expect(doc.bounds).toBeNull();
        continue;
      }
      const fit = fitBounds({ ...doc, bounds: null }, 4)!;
      expect(doc.bounds).toEqual({ min: fit.min, max: fit.max, style, height: 8 });
      expect(playableRect(doc)?.from).toBe('bounds');
      // Round the whole ground: nothing on it is outside the playable boundary.
      const t = doc.terrain!;
      expect(doc.bounds!.min[0]).toBeLessThanOrEqual(t.origin[0]);
      expect(doc.bounds!.max[1]).toBeGreaterThanOrEqual(t.origin[1] + (t.rows - 1) * t.spacing);
    }
    // A sky map: round what's built (the starting room).
    const sky = newMapFromSetup({ ...newMapDefaults(), size: 0, boundary: 'wall' });
    expect(sky.terrain).toBeNull();
    expect(sky.bounds?.style).toBe('wall');
  });

  it('suggest sizes by players as MAP_BUDGETS.md does (skirmish, standard, large, then huge)', () => {
    expect([2, 6, 7, 12, 13, 24, 25, 64].map(suggestedSize)).toEqual([96, 96, 160, 160, 240, 240, 320, 320]);
  });

  it('offer the modes Map properties offers', () => {
    expect(MAIN_MODES.map(([m]) => m)).toContain('core.deathmatch');
    expect(new Set(MAIN_MODES.map(([m]) => m)).size).toBe(MAIN_MODES.length);
  });
});

describe('a Start from layout', () => {
  it('keeps its own modes, players and boundary, and takes the theme when it is built plain', () => {
    const ctf = template('ctf');
    expect(layoutOwns(ctf)).toEqual({ theme: false, modes: true, boundary: true });
    const made = layoutWithSetup(ctf, { theme: 'core.military', boundary: 'fence' });
    expect(made.classicStructure.theme).toBe('core.military');
    expect(made.bounds).toEqual(ctf.bounds);
    expect(made.metadata.supportedModes).toEqual(ctf.metadata.supportedModes);
    expect(made.metadata.recommendedPlayers).toEqual(ctf.metadata.recommendedPlayers);
  });

  it('without a boundary of its own takes the one picked, fitted round it', () => {
    const open = template('open_terrain');
    expect(layoutOwns(open).boundary).toBe(false);
    expect(layoutWithSetup(open, { theme: open.classicStructure.theme, boundary: '' }).bounds).toBeNull();
    const fenced = layoutWithSetup(open, { theme: open.classicStructure.theme, boundary: 'fence' });
    expect(fenced.bounds).toEqual({ ...fitBounds(open, 4)!, style: 'fence', height: 8 });
  });

  it('in a theme of its own keeps it', () => {
    const own = { ...template('arena') };
    own.classicStructure = { ...own.classicStructure, theme: 'core.castle' };
    expect(layoutOwns(own).theme).toBe(true);
    expect(layoutWithSetup(own, { theme: 'core.military', boundary: '' }).classicStructure.theme).toBe('core.castle');
  });
});
