// MapMaker UI Phase 5: every saved map opens and saves as MapMaker does without losing anything (MAPMAKER_UI_SPEC §10,
// "Test existing saved maps, serialization/migrations"; §11 "Old maps open/save without losing objects or gameplay
// configuration"). The maps in maps/ span many format versions, so opening each one runs the migrations from there.
// For each map (and the old-format fixtures):
// - MapMaker opens it (loadMap forEditing) and saves it (serializeMap, as Save, Export and Publish write it);
// - the saved file reopens and saves to the same text (open/save is stable: a second save changes nothing);
// - the saved file plays exactly like the original (the map as played from both is the same: every tile, thing,
//   set piece part, mode and setting kept);
// - a draft (the map kept in this browser as JSON, storage.ts) reads back to the same map;
// - the saved file carries the current format version and validates with no new errors.
// Split over SAVED_MAPS_PARTS files so vitest runs them side by side. ALL_MAPS=id1,id2 checks only those maps.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MAP_FORMAT_VERSION, loadMap, serializeMap, type MapDocument } from '../src/index.ts';

const MAPS = new URL('../../../maps/', import.meta.url);
const FIXTURES = new URL('./fixtures/', import.meta.url);
const only = process.env.ALL_MAPS?.split(',').filter(Boolean);
export const SAVED_MAPS_PARTS = 3;

/** The map files (and the old map fixtures: files with a formatVersion) that part `part` (0-based) checks. */
export function savedMapsOfPart(part: number): { name: string; url: URL }[] {
  const maps = readdirSync(MAPS)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ name: f.slice(0, -5), url: new URL(f, MAPS) }))
    .filter((m) => !only || only.includes(m.name));
  const fixtures = only
    ? []
    : readdirSync(FIXTURES)
        .filter((f) => f.endsWith('.json'))
        .map((f) => ({ name: `fixture ${f.slice(0, -5)}`, url: new URL(f, FIXTURES) }))
        .filter((m) => {
          const v = JSON.parse(readFileSync(m.url, 'utf8')) as { formatVersion?: unknown; metadata?: unknown };
          return typeof v.formatVersion === 'number' && !!v.metadata;
        });
  return [...maps, ...fixtures].sort((a, b) => a.name.localeCompare(b.name)).filter((_, i) => i % SAVED_MAPS_PARTS === part);
}

const errors = (r: { issues: { severity: string; code: string; message: string }[] }): string[] => r.issues.filter((i) => i.severity === 'error').map((i) => `${i.code}: ${i.message}`);
const counts = (m: MapDocument) => ({
  entities: m.entities.length,
  tiles: m.classicStructure.tiles.length,
  setPieces: (m as { setPieces?: unknown[] }).setPieces?.length ?? 0,
  modes: JSON.stringify(m.modes ?? null),
  rules: JSON.stringify((m as { rules?: unknown }).rules ?? null),
});

export function checkSavedMaps(part: number): void {
  const files = savedMapsOfPart(part);
  if (!files.length) it.skip('no maps in this part', () => {});
  describe.each(files)('$name', ({ url }) => {
    it('opens and saves in MapMaker with nothing lost', { timeout: 120_000 }, () => {
      const raw = readFileSync(url, 'utf8');
      const opened = loadMap(raw, undefined, { forEditing: true, openWithErrors: true });
      expect(opened.ok, errors(opened).join('; ')).toBe(true);
      if (!opened.ok) return;
      const saved = serializeMap(opened.map);
      expect(opened.map.formatVersion).toBe(MAP_FORMAT_VERSION);

      // A second open and save writes the same file.
      const reopened = loadMap(saved, undefined, { forEditing: true, openWithErrors: true });
      expect(reopened.ok, errors(reopened).join('; ')).toBe(true);
      if (!reopened.ok) return;
      expect(serializeMap(reopened.map)).toBe(saved);
      expect(counts(reopened.map)).toEqual(counts(opened.map));

      // A draft (the map as JSON in this browser) reads back to the same map.
      const draft = loadMap(JSON.parse(JSON.stringify(opened.map)), undefined, { forEditing: true, openWithErrors: true });
      expect(draft.ok).toBe(true);
      if (draft.ok) expect(serializeMap(draft.map)).toBe(saved);

      // The saved file plays as the original does, with no new errors.
      const playedBefore = loadMap(raw);
      const playedAfter = loadMap(saved);
      expect(errors(playedAfter)).toEqual(errors(playedBefore));
      expect(playedAfter.ok).toBe(playedBefore.ok);
      if (playedBefore.ok && playedAfter.ok) {
        expect(counts(playedAfter.map)).toEqual(counts(playedBefore.map));
        expect(serializeMap(playedAfter.map)).toBe(serializeMap(playedBefore.map));
      }
    });
  });
}
