// The menu's map index (mapIndexPlugin.ts, `virtual:map-index`): every map that loads, test maps left out.
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { mapIndexPlugin } from '../mapIndexPlugin.ts';

describe('map index', () => {
  it('lists the maps, without test maps (metadata.testOnly)', { timeout: 120_000 }, async () => {
    const plugin = mapIndexPlugin(fileURLToPath(new URL('../../../maps', import.meta.url)));
    const id = (plugin.resolveId as (id: string) => string | undefined)('virtual:map-index')!;
    const code = await (plugin.load as (this: unknown, id: string) => Promise<string>).call({ addWatchFile: () => {} }, id);
    const entries = JSON.parse(code.replace(/^export default /, '').replace(/;$/, '')) as { key: string; name?: string; modes?: string[]; builtIn?: { hash: string; release?: { contentHash: string; revision: number } } }[];
    expect(entries.length).toBeGreaterThan(20);
    expect(entries.some((e) => e.key === 'frost_basin')).toBe(true);
    expect(entries.some((e) => e.key === 'test_coverage')).toBe(false);
    // The Breakthrough Range is a test map (owner, 2026-11-08: hidden from every list; tests reach it by ?testmap=).
    expect(entries.some((e) => e.key === 'test_breakthrough')).toBe(false);
    expect(entries.find((e) => e.key === 'iron_coast')?.modes).toContain('core.breakthrough');
    // A map with a release block carries its record for choosing it over a published copy (publishedChoice.ts):
    // Flavius Rule as exported at revision 32 (its block describes it).
    // The records live apart (`virtual:map-releases`, loaded on demand: the menu's first download is on a budget).
    expect(entries.some((e) => e.builtIn)).toBe(false);
    const rid = (plugin.resolveId as (id: string) => string | undefined)('virtual:map-releases')!;
    const rcode = await (plugin.load as (this: unknown, id: string) => Promise<string>).call({ addWatchFile: () => {} }, rid);
    const records = JSON.parse(rcode.replace(/^export default /, '').replace(/;$/, '')) as Record<string, { hash: string; release?: { contentHash: string; revision: number } }>;
    const flavius = records.sandfall_colosseum;
    expect(flavius?.release?.revision).toBeGreaterThanOrEqual(32);
    expect(flavius?.hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(Object.keys(records).length).toBeGreaterThan(20);
    expect(Object.keys(records).every((k) => entries.some((e) => e.key === k))).toBe(true);
  });
});
