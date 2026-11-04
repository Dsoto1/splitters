// Lists every MapMaker palette piece that has a model picture (tiles, props, vehicles and turrets)
// with its atlas (paletteCatalog.ts atlasGroup: one per Style Pack's tiles, one per content pack's
// props, one for vehicles) and a hash of what its picture is drawn from (the tile's definition, or the
// model file's bytes). Printed as JSON for tools/content/build-palette-atlas.mjs and content:check.
//   node --experimental-transform-types --no-warnings tools/content/palette-items.ts
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { coreCatalog } from '../../packages/shared/src/index.ts';
import { atlasGroup, pictureKeys } from '../../packages/client/src/editor/paletteCatalog.ts';
import { loadPropManifest } from './props-manifest.mjs';

const PUBLIC = join(resolve(dirname(fileURLToPath(import.meta.url)), '../..'), 'packages/client/public');
const MODELS = join(PUBLIC, 'models');
const sha = (data: string | Buffer) => createHash('sha256').update(data).digest('hex').slice(0, 16);
/** Prop id (`prop.<id>`) → its content pack (content/props/<pack>.json): the prop's atlas. */
const packOf = new Map(loadPropManifest().props.map((p: { id: string; pack: string }) => [`prop.${p.id}`, p.pack]));
const items = pictureKeys().map(({ key, tile, file }) => {
  let hash: string;
  if (tile) hash = sha(JSON.stringify(coreCatalog.get(tile)));
  else {
    // Same rule as the client's model loader: kit folders sit in public/, the rest under public/models/.
    const path = /^(props|creatures|city|packs)\//.test(file!) ? join(PUBLIC, file!) : join(MODELS, file!);
    hash = sha(readFileSync(path));
  }
  return { key, group: atlasGroup(key, key.startsWith('prop:') ? packOf.get(key.slice(5)) : undefined), hash };
});
process.stdout.write(JSON.stringify(items));
