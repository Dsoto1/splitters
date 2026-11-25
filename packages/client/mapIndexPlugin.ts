import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runnerImport, type Plugin } from 'vite';

type Shared = typeof import('@tiletrigger/shared');
let shared: Promise<Shared> | undefined;
/** The shared package (TypeScript source), run through Vite's module runner. */
function loadShared(): Promise<Shared> {
  shared ??= runnerImport<Shared>(fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)), { configFile: false, logLevel: 'error' }).then((r) => r.module);
  return shared;
}

const ID = 'virtual:map-index';
const RESOLVED = `\0${ID}`;
/**
 * The built-in maps' release records (key → builtInRecord), apart from the index: only publishedMaps.ts reads them,
 * on demand, so they stay out of the menu's first download (about 27 kB raw: tools/ci/bundle-budget.mjs).
 */
const RELEASES = 'virtual:map-releases';
const RELEASES_RESOLVED = `\0${RELEASES}`;

/**
 * `virtual:map-index`: what the menu shows of every built-in map (maps/*.json),
 * worked out at build time with the same loadMap the game uses: its key, the
 * metadata a map card shows and the modes it can play. The map files
 * themselves load on demand (mapIndex.ts), so the first visit doesn't
 * download and parse every map to draw the menu. A map that fails to load is
 * left out, as the menu did before, and so is a test map (metadata.testOnly).
 *
 * A map with a release block (metadata.release) also carries its `builtIn` record (shared publishedChoice.ts: its
 * content hash as the hub hashes it, and the version it records), so the site can tell whether a version the owner
 * published is newer than the built-in map or older (publishedMaps.ts) without hashing maps in the browser.
 */
export function mapIndexPlugin(mapsDir: string): Plugin {
  return {
    name: 'tiletrigger-map-index',
    // Load the shared package before the bundle's own modules keep the build busy: on a loaded machine the
    // module runner's requests otherwise queue behind them past its 60 s timeout and the build fails.
    async buildStart() {
      await loadShared();
    },
    resolveId: (id) => (id === ID ? RESOLVED : id === RELEASES ? RELEASES_RESOLVED : undefined),
    async load(id) {
      if (id !== RESOLVED && id !== RELEASES_RESOLVED) return undefined;
      const { loadMap, playableModes, mapPlayerCaps, builtInRecord, isRetiredMap } = await loadShared();
      const entries = [];
      for (const file of readdirSync(mapsDir).filter((f) => f.endsWith('.json')).sort()) {
        const path = join(mapsDir, file);
        this.addWatchFile(path);
        const text = readFileSync(path, 'utf8');
        const r = loadMap(JSON.parse(text));
        // Test maps (testOnly, MapMaker's Map properties) are left out of every list the menu draws.
        if (!r.ok || r.map.metadata.testOnly) continue;
        const md = r.map.metadata;
        const modes = playableModes(r.map);
        entries.push({
          key: file.slice(0, -'.json'.length),
          // A retired map's description is left out (the menu's first download is on a budget, tools/ci/bundle-budget.mjs):
          // no card, template or list shows one (RETIRED_MAPS); the map's own file still carries it.
          metadata: { id: md.id, name: md.name, description: isRetiredMap(md.id) ? '' : md.description, author: md.author, recommendedPlayers: md.recommendedPlayers, ...(md.thumbnail ? { thumbnail: md.thumbnail } : {}), ...(md.tier === 'experimental' ? { tier: md.tier } : {}), // Categories as "t:modern" (the category's initial: mapIndex.ts reads them back); none for retired maps, which no list shows.
          ...(md.categories?.length && !isRetiredMap(md.id) ? { categories: md.categories.map((c) => `${c.category[0]}:${c.tag}`) } : {}) },
          modes,
          // The most players each mode takes (the next-map vote leaves out maps too small for the people in a match).
          caps: modes.map((mode) => mapPlayerCaps(r.map, mode).max),
          ...(id === RELEASES_RESOLVED && md.release ? { builtIn: editingRecord(text) } : {}),
        });
      }
      if (id === RELEASES_RESOLVED) return `export default ${JSON.stringify(Object.fromEntries(entries.filter((e) => e.builtIn).map((e) => [e.key, e.builtIn])))};`;
      return `export default ${JSON.stringify(entries)};`;
      /** The record as the hub would hash this map: loaded for editing (paths not laid into the ground). */
      function editingRecord(text: string) {
        const e = loadMap(text, undefined, { forEditing: true });
        return e.ok ? builtInRecord(e.map) : undefined;
      }
    },
  };
}
