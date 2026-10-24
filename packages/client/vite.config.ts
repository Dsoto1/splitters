import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version?: string };

export default defineConfig({
  server: { host: true, port: 5173 },
  define: { __APP_VERSION__: JSON.stringify(pkg.version ?? '0.0.0') },
  build: { target: 'es2022', chunkSizeWarningLimit: 4096 },
});
