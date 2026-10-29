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
 * `virtual:map-index`: what the menu shows of every built-in map (maps/*.json),
 * worked out at build time with the same loadMap the game uses: its key, the
 * metadata a map card shows and the modes it can play. The map files
 * themselves load on demand (mapIndex.ts), so the first visit doesn't
 * download and parse every map to draw the menu. A map that fails to load is
 * left out, as the menu did before.
 */
export function mapIndexPlugin(mapsDir: string): Plugin {
  return {
    name: 'tiletrigger-map-index',
    // Load the shared package before the bundle's own modules keep the build busy: on a loaded machine the
    // module runner's requests otherwise queue behind them past its 60 s timeout and the build fails.
    async buildStart() {
      await loadShared();
    },
    resolveId: (id) => (id === ID ? RESOLVED : undefined),
    async load(id) {
      if (id !== RESOLVED) return undefined;
      const { loadMap, playableModes } = await loadShared();
      const entries = [];
      for (const file of readdirSync(mapsDir).filter((f) => f.endsWith('.json')).sort()) {
        const path = join(mapsDir, file);
        this.addWatchFile(path);
        const r = loadMap(JSON.parse(readFileSync(path, 'utf8')));
        if (!r.ok) continue;
        const md = r.map.metadata;
        entries.push({
          key: file.slice(0, -'.json'.length),
          metadata: { id: md.id, name: md.name, description: md.description, author: md.author, recommendedPlayers: md.recommendedPlayers, ...(md.thumbnail ? { thumbnail: md.thumbnail } : {}) },
          modes: playableModes(r.map),
        });
      }
      return `export default ${JSON.stringify(entries)};`;
    },
  };
}
