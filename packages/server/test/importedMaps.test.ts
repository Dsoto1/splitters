import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { coreCatalog, loadMap, validateMap } from '@tiletrigger/shared';

/** Maps converted from TimeSplitters MapMaker saves (packages/server/src/tools/import-timesplitters.ts). */
const dir = new URL('../../../maps/imported/', import.meta.url);
const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')) : [];
const tablePath = new URL('../../../content/import/timesplitters-mapmaker.json', import.meta.url);

describe('imported TimeSplitters maps', () => {
  it.each(files)('%s loads, validates and credits the original', (file) => {
    const r = loadMap(JSON.parse(readFileSync(new URL(file, dir), 'utf8')));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.map.metadata.id).toBe(file.replace(/\.json$/, ''));
    expect(validateMap(r.map).filter((i) => i.severity === 'error')).toEqual([]);
    expect(r.map.metadata.description).toMatch(/Imported from a TimeSplitters( 2|: Future Perfect) MapMaker save\./);
    expect(r.map.entities.filter((e) => e.kind === 'spawn').length).toBeGreaterThanOrEqual(4);
  });

  it('mapping table entries point at real tiles', () => {
    if (!existsSync(tablePath)) return;
    const table = JSON.parse(readFileSync(tablePath, 'utf8')) as { entries: { game: string; original: { id: number }; ours: { id: string; strategy: string }; fit: string }[] };
    const keys = new Set<string>();
    for (const e of table.entries) {
      expect(['TS2', 'TSFP']).toContain(e.game);
      expect(['exact', 'close', 'stand-in']).toContain(e.fit);
      expect(['auto', 'fill', 'tile', 'skip']).toContain(e.ours.strategy);
      expect(coreCatalog.get(e.ours.id), `${e.game} ${e.original.id}: ${e.ours.id}`).toBeDefined();
      const k = `${e.game}:${e.original.id}`;
      expect(keys.has(k)).toBe(false);
      keys.add(k);
    }
  });
});
