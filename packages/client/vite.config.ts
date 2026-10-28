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
 * one release to the next while our code changes: `babylon` (the part of
 * Babylon the first page load runs: engine, scene, materials, glTF loader),
 * `rapier` (physics, its WebAssembly inlined by the -compat package), `peerjs`
 * and `vendor` (the rest of node_modules the menu needs). See docs/LOADING.md.
 */
function vendorChunks(): Rollup.GetManualChunk {
  let start: Set<string> | null = null;
  /** What the first page load runs: the entry and everything it imports statically. */
  const atStart = (meta: Rollup.ManualChunkMeta): Set<string> => {
    if (start) return start;
    start = new Set();
    const todo = [...meta.getModuleIds()].filter((m) => meta.getModuleInfo(m)?.isEntry);
    while (todo.length) {
      const id = todo.pop()!;
      if (start.has(id)) continue;
      start.add(id);
      todo.push(...(meta.getModuleInfo(id)?.importedIds ?? []));
    }
    return start;
  };
  return (id, meta) => {
    const pkg = /node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?((?:@[^/]+\/)?[^/]+)\//.exec(id)?.[1];
    if (!pkg) return undefined;
    const first = atStart(meta).has(id);
    // The rest of Babylon keeps Rollup's own chunks: a manual chunk would also take in the shaders it imports,
    // which the menu fetches on demand, and the menu would then wait for all of it to get one.
    if (pkg.startsWith('@babylonjs/') || pkg === 'babylonjs-gltf2interface') return first ? 'babylon' : undefined;
    if (pkg === '@dimforge/rapier3d-compat') return 'rapier';
    if (pkg === 'peerjs' || pkg === 'peerjs-js-binarypack' || pkg === 'webrtc-adapter' || pkg === 'sdp' || pkg === 'eventemitter3') return 'peerjs';
    // Everything else the menu needs (zod, …); the rest (recast, pako) stays with whoever loads it.
    return first ? 'vendor' : undefined;
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
