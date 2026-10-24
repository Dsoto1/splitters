import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version?: string };

/** Asset version: the git commit (changes with every update); the start time when git isn't there. */
function assetVersion(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || String(Date.now());
  } catch {
    return String(Date.now());
  }
}

export default defineConfig({
  server: { host: true, port: 5173 },
  define: { __APP_VERSION__: JSON.stringify(pkg.version ?? '0.0.0'), __ASSET_VERSION__: JSON.stringify(assetVersion()) },
  build: { target: 'es2022', chunkSizeWarningLimit: 4096 },
});
