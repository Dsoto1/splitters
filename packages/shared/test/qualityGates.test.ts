// Tiers and quality gates for maps (map/qualityGates.ts; owner, 2026-11-11): a map is core unless its file says
// experimental, a new map starts experimental, and every core map of maps/ passes the gates that need only the map
// (the navigation audit and a bots-only match are pnpm quality-gates' and the all-maps test's).
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CARD_CLEAR_AHEAD, MAP_FORMAT_VERSION, isRetiredMap, loadMap, mapGates, mapTier, newMapDocument, serializeMap } from '../src/index.ts';

const MAPS = new URL('../../../maps/', import.meta.url);
const ids = readdirSync(MAPS).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();

describe('map tiers', () => {
  it('a map is core unless it says experimental; a new map starts experimental and keeps it through the file', () => {
    expect(mapTier({})).toBe('core');
    expect(mapTier({ tier: 'experimental' })).toBe('experimental');
    const fresh = newMapDocument('New');
    expect(mapTier(fresh.metadata)).toBe('experimental');
    const back = loadMap(serializeMap(fresh));
    expect(back.ok && back.map.metadata.tier).toBe('experimental');
    expect(back.ok && back.map.formatVersion).toBe(MAP_FORMAT_VERSION);
    expect(MAP_FORMAT_VERSION).toBeGreaterThanOrEqual(35);
  });

  it('the gates: spawn points for the players, budgets, a card shot that is not a wall', () => {
    const doc = newMapDocument('Gates');
    const gate = (d: typeof doc, id: string) => mapGates(d).find((g) => g.id === id)!;
    // One spawn point for a map that takes eight.
    expect(gate(doc, 'spawns').pass).toBe(false);
    const eight = { ...doc, entities: Array.from({ length: 8 }, (_, i) => ({ ...doc.entities[0]!, id: `spawn_${i}` })) };
    expect(gate(eight, 'spawns').pass).toBe(true);
    expect(gate(doc, 'budgets').pass).toBe(true);
    // No card shot: the automatic view. A shot from the middle of the room at a wall 4 m away fails; looking up passes.
    expect(gate(doc, 'card')).toMatchObject({ pass: true, note: 'the automatic view' });
    const at = (pitch: number) => ({ ...doc, metadata: { ...doc.metadata, cardCamera: { position: [0, 1.6, 0] as [number, number, number], yaw: 0, pitch } } });
    expect(CARD_CLEAR_AHEAD).toBeGreaterThan(4);
    expect(gate(at(0), 'card').pass).toBe(false);
  });

  it.each(ids.filter((id) => !isRetiredMap(id)))('%s: a core map passes its gates', (id) => {
    const loaded = loadMap(readFileSync(new URL(`${id}.json`, MAPS), 'utf8'));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok || loaded.map.metadata.testOnly || mapTier(loaded.map.metadata) !== 'core') return;
    expect(mapGates(loaded.map).filter((g) => !g.pass).map((g) => `${g.label}: ${g.note}`)).toEqual([]);
  });
});
