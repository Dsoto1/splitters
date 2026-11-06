// Lists every MapMaker palette piece that has a model picture (tiles, props, vehicles and turrets, set
// pieces) with its atlas (paletteCatalog.ts atlasGroup: one per Style Pack's tiles, one per content
// pack's props, one for vehicles, one for set pieces) and a hash of what its picture is drawn from (the
// tile's definition, the model file's bytes, or a set piece's definition with the role pack it is
// pictured in, its tiles' definitions and its props' models). Printed as JSON for
// tools/content/build-palette-atlas.mjs and content:check.
//   node --experimental-transform-types --no-warnings tools/content/palette-items.ts
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { builtInSetPieces, coreCatalog, getProp } from '../../packages/shared/src/index.ts';
import { atlasGroup, pictureKeys } from '../../packages/client/src/editor/paletteCatalog.ts';
import { loadPropManifest } from './props-manifest.mjs';

const PUBLIC = join(resolve(dirname(fileURLToPath(import.meta.url)), '../..'), 'packages/client/public');
const MODELS = join(PUBLIC, 'models');
const sha = (data: string | Buffer) => createHash('sha256').update(data).digest('hex').slice(0, 16);
// Same rule as the client's model loader: kit folders sit in public/, the rest under public/models/.
const modelBytes = (file: string) => readFileSync(/^(props|creatures|city|packs|env)\//.test(file) ? join(PUBLIC, file) : join(MODELS, file));
/** Prop id (`prop.<id>`) → its content pack (content/props/<pack>.json): the prop's atlas. */
const packOf = new Map(loadPropManifest().props.map((p: { id: string; pack: string }) => [`prop.${p.id}`, p.pack]));
const library = builtInSetPieces();
/** A set piece's picture is drawn in its first role pack (editorApp.ts setPieceThumbDoc): that, its tiles and its props' models. */
function setPieceHash(id: string): string {
  const def = library.pieces.get(id)!;
  const pack = def.packs[0] ? library.packs.get(def.packs[0]) : undefined;
  const tiles = [...new Set(def.parts.flatMap((p) => (p.kind === 'tile' ? [p.tile] : [])))].sort().map((t) => coreCatalog.get(t));
  const models = [...new Set(def.parts.flatMap((p) => (p.kind === 'prop' ? [p.model] : [])))].sort().map((m) => sha(modelBytes(getProp(m)!.file)));
  return sha(JSON.stringify({ def, pack, tiles, models }));
}
const items = pictureKeys().map(({ key, tile, file, setPiece }) => {
  const hash = tile ? sha(JSON.stringify(coreCatalog.get(tile))) : setPiece ? setPieceHash(setPiece) : sha(modelBytes(file!));
  return { key, group: atlasGroup(key, key.startsWith('prop:') ? packOf.get(key.slice(5)) : undefined), hash };
});
process.stdout.write(JSON.stringify(items));
