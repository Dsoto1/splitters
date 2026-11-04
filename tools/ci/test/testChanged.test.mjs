// `pnpm test:changed` (tools/ci/testChanged.mjs): the unit tests that read a changed map file, which vitest's
// own --changed (imports only) doesn't find.
import { describe, expect, it } from 'vitest';
import { mapReads, mapTestsFor, readTestSources } from '../testChanged.mjs';

const sources = readTestSources();
const names = (files) => files.map((f) => f.slice(f.lastIndexOf('/') + 1).replace(/\.test\.(ts|mjs)$/, ''));

describe('tests that read maps', () => {
  it('a map change runs every test that reads the maps folder', () => {
    const got = names(mapTestsFor(['maps/frost_basin.json'], sources));
    for (const t of ['unifiedPaths', 'pads', 'playlist', 'terrainFloors', 'stylePacksDesert', 'stylePacks2', 'stylePacksJungle', 'rotation', 'botSet', 'select']) expect(got).toContain(t);
  });

  it('a named map runs the tests that open it; the arena runs the arena helpers\' users', () => {
    expect(names(mapTestsFor(['maps/bunker_cross.json'], sources))).toEqual(expect.arrayContaining(['modes', 'server']));
    expect(names(mapTestsFor(['maps/frost_basin.json'], sources))).not.toContain('modes');
    const arena = names(mapTestsFor(['maps/phase0_arena.json'], sources));
    expect(arena).toEqual(expect.arrayContaining(['prediction']));
    // helpers.ts (ARENA_PATH, loadArena): a test importing it reads the arena.
    expect(mapTestsFor(['maps/phase0_arena.json'], { 'packages/shared/test/helpers.ts': 'export const ARENA_PATH = "x";', 'packages/shared/test/a.test.ts': "import { loadArena } from './helpers.ts';", 'packages/shared/test/b.test.ts': "import { makeMap } from './helpers';" })).toEqual(['packages/shared/test/a.test.ts', 'packages/shared/test/b.test.ts']);
  });

  it('rotation and bot-set presets run the tests that read those folders', () => {
    expect(names(mapTestsFor(['maps/rotations/core.json'], sources))).toContain('rotation');
    expect(names(mapTestsFor(['maps/botsets/zombie_horde.json'], sources))).toContain('botSet');
  });

  it('no map change: nothing extra', () => {
    expect(mapTestsFor(['packages/client/src/game/view.ts', 'docs/HOSTING.md'], sources)).toEqual([]);
  });

  it('reads: named maps, the folder, computed paths', () => {
    expect(mapReads("readFileSync(new URL('../../../maps/sandgate.json', import.meta.url))")).toMatchObject({ any: false, ids: new Set(['sandgate']) });
    expect(mapReads("const dir = new URL('../../../maps/', import.meta.url)").any).toBe(true);
    expect(mapReads('read(`maps/${f}`)').any).toBe(true);
    expect(mapReads('fetch(`${base}/maps/frost_basin`)').any).toBe(false);
  });
});
