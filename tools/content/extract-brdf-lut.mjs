// Copies Babylon.js's environment BRDF lookup table (an RGBD-encoded PNG that
// Babylon embeds as base64 in Misc/brdfTextureTools; Apache-2.0) out of the
// installed @babylonjs/core into the client, so the client can load it as an
// ordinary texture (see packages/client/src/content/brdf.ts for why).
//
//   node tools/content/extract-brdf-lut.mjs          write the PNG
//   node tools/content/extract-brdf-lut.mjs --check  verify it matches the installed Babylon.js

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'packages/client/src/content/envBrdfRgbd.png');
const require = createRequire(join(ROOT, 'packages/client/package.json'));
const source = readFileSync(require.resolve('@babylonjs/core/Misc/brdfTextureTools.js'), 'utf8');
const match = source.match(/const _environmentBRDFBase64Texture = "data:image\/png;base64,([A-Za-z0-9+/=]+)"/);
if (!match) throw new Error('environment BRDF texture not found in @babylonjs/core/Misc/brdfTextureTools.js');
const png = Buffer.from(match[1], 'base64');

if (process.argv.includes('--check')) {
  const same = existsSync(OUT) && readFileSync(OUT).equals(png);
  console.log(same ? 'BRDF lookup table is up to date' : `BRDF lookup table is stale: run node tools/content/extract-brdf-lut.mjs`);
  process.exit(same ? 0 : 1);
}
writeFileSync(OUT, png);
console.log(`wrote ${OUT} (${png.length} bytes)`);
