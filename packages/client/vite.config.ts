import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Rollup } from 'vite';
import { mapIndexPlugin } from './mapIndexPlugin.ts';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version?: string };

/** Asset version: the git commit (changes with every update); the start time when git isn't there. */
function assetVersion(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || String(Date.now());
  } catch {
    return String(Date.now());
  }
}

/**
 * Vendor code in chunks of its own, which keep their names (and hashes) from
 * one release to the next while our code changes: Babylon, Rapier (physics,
 * its WebAssembly inlined by the -compat package), PeerJS and the rest of
 * node_modules. Babylon is split in two: what the first page load runs (the
 * menu: engine, scene, glTF loader) and the rest (shadows, post-processes,
 * particles…), which loads with the match or MapMaker. See docs/LOADING.md.
 */
function vendorChunks(): Rollup.GetManualChunk {
  let initial: Set<string> | null = null;
  /** Modules the entry imports statically (directly or through others): what the first page load runs. */
  const reachable = (meta: Rollup.ManualChunkMeta): Set<string> => {
    if (initial) return initial;
    const seen = new Set<string>();
    const todo = [...meta.getModuleIds()].filter((id) => meta.getModuleInfo(id)?.isEntry);
    while (todo.length) {
      const id = todo.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      todo.push(...(meta.getModuleInfo(id)?.importedIds ?? []));
    }
    return (initial = seen);
  };
  return (id, meta) => {
    const pkg = /node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?((?:@[^/]+\/)?[^/]+)\//.exec(id)?.[1];
    if (!pkg) return undefined;
    const atStart = reachable(meta).has(id);
    if (pkg.startsWith('@babylonjs/') || pkg === 'babylonjs-gltf2interface') return atStart ? 'babylon' : 'babylon-more';
    if (pkg === '@dimforge/rapier3d-compat') return 'rapier';
    if (pkg === 'peerjs' || pkg === 'peerjs-js-binarypack' || pkg === 'webrtc-adapter' || pkg === 'sdp' || pkg === 'eventemitter3') return 'peerjs';
    // Recast (navigation) already loads as a chunk of its own, from the match and the MapMaker only.
    if (pkg.startsWith('@recast-navigation/') || pkg === 'recast-navigation') return undefined;
    return atStart ? 'vendor' : undefined;
  };
}

export default defineConfig({
  // The built-in maps' summaries for the menu (src/mapIndex.ts); the maps themselves load on demand.
  plugins: [mapIndexPlugin(fileURLToPath(new URL('../../maps', import.meta.url)))],
  server: { host: true, port: 5173 },
  // Babylon loads its shaders on demand; pre-bundled, those lazy files went missing whenever the
  // dev cache was rebuilt ("file does not exist … default.vertex-….js"). Serve it as plain ES modules.
  optimizeDeps: { exclude: ['@babylonjs/core', '@babylonjs/loaders', '@babylonjs/materials'] },
  define: { __APP_VERSION__: JSON.stringify(pkg.version ?? '0.0.0'), __ASSET_VERSION__: JSON.stringify(assetVersion()) },
  build: { target: 'es2022', chunkSizeWarningLimit: 4096, rollupOptions: { output: { manualChunks: vendorChunks() } } },
  // The offline match's worker (game/simWorker.ts) loads the simulation lazily: ES module workers split like the page.
  // Rapier gets the same chunk there as on the page: the same bytes under the same hashed name, so the
  // match worker reuses the copy the page already downloaded (one file in dist/assets, one HTTP cache entry).
  worker: { format: 'es', rollupOptions: { output: { manualChunks: (id) => (/node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?@dimforge\/rapier3d-compat\//.test(id) ? 'rapier' : undefined) } } },
});
