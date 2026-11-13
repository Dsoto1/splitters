// A read-only inventory of every piece MapMaker can place, for the asset audit
// (docs/map-briefs/urban/ASSET_AUDIT.md; the owner's guide, section 4). It reads the game's own registries
// (the tile catalogue, the prop tables, the kit families, the environment species, the set pieces, the material
// library and themes, the wall styles, the Style Packs, MapMaker's palette groups) and every map in maps/, and
// writes docs/map-briefs/urban/asset-inventory.json: one record per piece with where it comes from, its size,
// how it collides, which packs and palette groups list it, the retired ids that play as it, and how often the
// maps place it. It changes nothing in the game and is not part of content:check or CI.
//
//   node tools/content/asset-inventory.mjs            write the file
//   node tools/content/asset-inventory.mjs --check    exit 1 if the file is out of date
//   node tools/content/asset-inventory.mjs --summary  also print the counts
//
// The output is deterministic (sorted, no dates): running it twice on the same content gives the same bytes.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(SELF), '../..');
const OUT = join(ROOT, 'docs/map-briefs/urban/asset-inventory.json');

// The registries are TypeScript: run again with node's type stripping (as tools/content/palette-items.ts is run).
if (!process.execArgv.includes('--experimental-transform-types')) {
  try {
    execFileSync(process.execPath, ['--experimental-transform-types', '--no-warnings', SELF, ...process.argv.slice(2)], { cwd: ROOT, stdio: 'inherit' });
  } catch (e) {
    process.exit(typeof e.status === 'number' ? e.status : 1);
  }
  process.exit(0);
}

const shared = await import('../../packages/shared/src/index.ts');
const palette = await import('../../packages/client/src/editor/paletteCatalog.ts');
const packTileFiles = {
  'packTiles.ts': (await import('../../packages/shared/src/map/packTiles.ts')).boxPackTiles,
  'packTiles2.ts': (await import('../../packages/shared/src/map/packTiles2.ts')).boxPackTiles2,
  'packTilesAncient.ts': (await import('../../packages/shared/src/map/packTilesAncient.ts')).ancientPackTiles,
  'packTilesMedieval.ts': (await import('../../packages/shared/src/map/packTilesMedieval.ts')).medievalPackTiles,
  'packTilesHarbor.ts': (await import('../../packages/shared/src/map/packTilesHarbor.ts')).harborPackTiles,
  'packTilesSnow.ts': (await import('../../packages/shared/src/map/packTilesSnow.ts')).snowPackTiles,
  'packTilesDesert.ts': (await import('../../packages/shared/src/map/packTilesDesert.ts')).desertPackTiles,
  'packTilesJungle.ts': (await import('../../packages/shared/src/map/packTilesJungle.ts')).junglePackTiles,
  'packTilesIndustrial.ts': (await import('../../packages/shared/src/map/packTilesIndustrial.ts')).industrialPackTiles,
  'packTilesOrbital.ts': (await import('../../packages/shared/src/map/packTilesOrbital.ts')).orbitalPackTiles,
};

const json = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const sha = (v) => createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex').slice(0, 12);
const byStr = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const sorted = (list) => [...list].sort(byStr);
const r3 = (n) => Math.round(n * 1000) / 1000;
const inc = (map, key, by = 1) => map.set(key, (map.get(key) ?? 0) + by);

// ------------------------------------------------------------------ maps: what they place

/** kind → id → map id → { direct, viaSetPieces } */
const usage = new Map();
function use(kind, id, mapId, via = false, n = 1) {
  if (id === undefined || id === null) return;
  let ids = usage.get(kind);
  if (!ids) usage.set(kind, (ids = new Map()));
  let maps = ids.get(id);
  if (!maps) ids.set(id, (maps = new Map()));
  let u = maps.get(mapId);
  if (!u) maps.set(mapId, (u = { direct: 0, via: 0 }));
  if (via) u.via += n;
  else u.direct += n;
}

const library = shared.builtInSetPieces();
const mapFiles = readdirSync(join(ROOT, 'maps')).filter((f) => f.endsWith('.json')).sort();
const maps = [];
const liveMaps = new Set();

/** Count a tile placement's own references (its tile, sides, glass, room options, paint). `tileKind` is 'tile'. */
function useTile(t, mapId, via) {
  use('tile', t.tile, mapId, via);
  for (const style of Object.values(t.edges ?? {})) use('edge', style, mapId, via);
  for (const [k, v] of Object.entries(t.options ?? {})) use(`option.${k}`, v, mapId, via);
  for (const s of Object.values(t.surfaces ?? {})) if (s && typeof s.material === 'string') use('material', s.material, mapId, via);
}
/** Count an entity's references (a prop's model and variant, a block's material, a door's style…). */
function useEntity(e, mapId, via) {
  if (e.kind === 'prop') {
    use('prop', e.model, mapId, via);
    if (e.variant !== undefined) use('propVariant', `${e.model}#${e.variant}`, mapId, via);
  } else if (e.kind === 'mount') use('mount', e.model, mapId, via);
  else if (e.kind === 'door') use('door', e.style ?? 'sliding', mapId, via);
  else if (e.kind === 'destructible') use('destructible', e.model, mapId, via);
  else if (e.kind === 'light') use('light', e.fixture ?? 'none', mapId, via);
  else if (e.kind === 'ladder') use('ladder', e.style ?? 'rungs', mapId, via);
  if (e.kind === 'block') use('blocks', 'block', mapId, via);
  if (typeof e.material === 'string') use('material', e.material, mapId, via);
  else if (e.material && typeof e.material.material === 'string') use('material', e.material.material, mapId, via);
}

for (const f of mapFiles) {
  const doc = json(`maps/${f}`);
  const id = doc.metadata?.id ?? f.slice(0, -5);
  const retired = shared.RETIRED_MAPS.has(id);
  const testOnly = doc.metadata?.testOnly === true;
  if (!retired && !testOnly) liveMaps.add(id);
  const cs = doc.classicStructure ?? { tiles: [] };
  const counts = {};
  for (const e of doc.entities ?? []) counts[e.kind] = (counts[e.kind] ?? 0) + 1;
  maps.push({
    id,
    file: `maps/${f}`,
    formatVersion: doc.formatVersion,
    theme: cs.theme ?? null,
    cellSize: cs.cellSize ?? 8,
    levelHeight: cs.levelHeight ?? 4,
    tiles: cs.tiles.length,
    entities: (doc.entities ?? []).length,
    props: counts.prop ?? 0,
    blocks: counts.block ?? 0,
    setPieces: (doc.setPieces ?? []).length,
    terrain: !!doc.terrain,
    bytes: statSync(join(ROOT, 'maps', f)).size,
    ...(retired ? { retired: true } : {}),
    ...(testOnly ? { testOnly: true } : {}),
  });
  use('theme', cs.theme ?? 'core.prototype', id);
  for (const t of cs.tiles) useTile(t, id, false);
  for (const e of doc.entities ?? []) useEntity(e, id, false);
  const local = new Map((doc.setPieceDefs ?? []).map((d) => [d.id, d]));
  for (const p of doc.setPieces ?? []) {
    use('setPiece', p.piece, id);
    if (p.pack) use('rolePack', p.pack, id);
    const def = local.get(p.piece) ?? library.pieces.get(p.piece);
    if (!def) continue;
    for (const part of def.parts) {
      if (part.tile) useTile(part, id, true);
      else useEntity(part, id, true);
    }
  }
}

function usageOf(kind, id) {
  const m = usage.get(kind)?.get(id);
  if (!m) return { placements: 0, viaSetPieces: 0, maps: 0, liveMaps: 0, mapIds: [] };
  let direct = 0;
  let via = 0;
  for (const u of m.values()) {
    direct += u.direct;
    via += u.via;
  }
  const mapIds = sorted(m.keys());
  return { placements: direct, viaSetPieces: via, maps: mapIds.length, liveMaps: mapIds.filter((x) => liveMaps.has(x)).length, mapIds };
}

// ------------------------------------------------------------------ style packs and palette groups

const packsListing = new Map(); // key `${field}:${id}` → [pack ids]
for (const p of shared.STYLE_PACKS) {
  for (const field of ['tiles', 'props', 'materials', 'facades', 'themes', 'mounts']) {
    for (const id of p[field]) {
      const key = `${field}:${id}`;
      if (!packsListing.has(key)) packsListing.set(key, []);
      if (!packsListing.get(key).includes(p.id)) packsListing.get(key).push(p.id);
    }
  }
}
const listedIn = (field, id) => sorted(packsListing.get(`${field}:${id}`) ?? []);

// ------------------------------------------------------------------ sources, licences, model sizes

const propPackFiles = readdirSync(join(ROOT, 'content/props')).filter((f) => f.endsWith('.json')).sort();
/** prop short id → what its pack file says */
const propSource = new Map();
for (const f of propPackFiles) {
  const data = json(`content/props/${f}`);
  for (const p of data.props) {
    propSource.set(`prop.${p.id}`, { pack: f.slice(0, -5), file: `content/props/${f}`, license: data.pack.license, creator: data.pack.creator ?? null, collide: p.collide ?? 'box', src: p.src ?? null, surface: p.surface ?? data.surface ?? null });
  }
}
const lockByFile = new Map();
for (const rel of ['content/props.lock.json', 'content/kitprops.lock.json', 'content/city.lock.json', 'content/packs.lock.json', 'content/environment.lock.json']) {
  if (!existsSync(join(ROOT, rel))) continue;
  for (const e of json(rel).files ?? []) lockByFile.set(e.file, e);
}
const provenanceByFile = new Map(json('content/provenance.json').assets.map((a) => [a.file, a]));
/** A coarse licence class from a licence string, for counting. */
function licenceClass(license, creator = '') {
  const l = String(license ?? '').toLowerCase();
  if (!l) return 'not recorded';
  if (l.includes('owned') || /tile trigger/i.test(creator ?? '')) return /meshy/i.test(`${license} ${creator}`) ? 'owned (Meshy)' : 'owned (made in code)';
  if (l.includes('cc0')) return /meshy/i.test(`${license} ${creator}`) ? 'CC0 (Meshy community)' : 'CC0';
  if (l.includes('cc-by') || l.includes('cc by')) return 'CC BY (credit)';
  if (l.includes('purchas')) return 'purchased';
  return `other: ${license}`;
}

const kitTypeFiles = readdirSync(join(ROOT, 'content/kitprops')).filter((f) => f.endsWith('.json')).sort();
const kitSource = new Map();
for (const f of kitTypeFiles) {
  const data = json(`content/kitprops/${f}`);
  for (const p of data.props) kitSource.set(p.id, { file: `content/kitprops/${f}`, generator: p.generator?.kind ?? data.type, collide: p.collide ?? (p.boxes ? 'boxes' : 'box'), detail: p.detail ?? null });
}
const kitPack = json('content/kitprops.json').pack;
const envFiles = readdirSync(join(ROOT, 'content/environment')).filter((f) => f.endsWith('.json')).sort();
const envSourceByFamily = new Map(envFiles.map((f) => [f.slice(0, -5), `content/environment/${f}`]));
const edgeData = new Map(json('content/tiles/edges.json').edges.map((e) => [e.id, e]));
const codeTileFile = new Map();
for (const [file, make] of Object.entries(packTileFiles)) for (const t of make()) codeTileFile.set(t.id, `packages/shared/src/map/${file}`);
const cityPack = json('content/city.json').pack;
const stylePacksPack = json('content/packs.json').packs;

// ------------------------------------------------------------------ records

const pieces = [];
const kitAliasesTo = new Map();
for (const a of shared.KIT_ALIASES) {
  if (!kitAliasesTo.has(a.model)) kitAliasesTo.set(a.model, []);
  kitAliasesTo.get(a.model).push(a.variant ? `${a.from}→#${a.variant}` : a.from);
}
const tileAliasesTo = new Map();
for (const [tile, piece] of shared.TILE_ALIASES) {
  if (!tileAliasesTo.has(piece)) tileAliasesTo.set(piece, []);
  tileAliasesTo.get(piece).push(tile);
}

// Tiles.
const boxKey = (b) => [b.min.map(r3), b.max.map(r3), r3(b.yaw ?? 0), r3(b.pitch ?? 0), r3(b.roll ?? 0), b.kind ?? 'solid'];
const tileShape = new Map();
const tileShapePaint = new Map();
/** material id → how many tiles paint a box of their own with it */
const materialInTiles = new Map();
for (const def of shared.coreCatalog.all()) {
  const [w, d] = shared.footprintSize(def);
  const levels = sorted(new Set(def.cells.map((c) => c[2]))).length;
  const solids = def.solids ?? [];
  const mats = sorted(new Set([...solids, ...(def.extraFloors ?? [])].flatMap((b) => (b.surface ? [b.surface.material] : []))));
  for (const m of mats) inc(materialInTiles, m);
  const isKit = !codeTileFile.has(def.id);
  const modelLock = def.model ? lockByFile.get(def.model.file) : undefined;
  const modelSource = def.model ? (def.model.file.startsWith('city/') ? cityPack : stylePacksPack[modelLock?.source] ?? null) : null;
  const shape = { cells: def.cells, floors: def.floors, ports: def.ports, open: !!def.open, edgeDefault: def.edgeDefault ?? null, edgeDefaults: def.edgeDefaults ?? null, solids: solids.map(boxKey).sort((a, b) => byStr(JSON.stringify(a), JSON.stringify(b))), extra: (def.extraFloors ?? []).map(boxKey).sort((a, b) => byStr(JSON.stringify(a), JSON.stringify(b))), model: def.model?.file ?? null };
  const shapeHash = sha(shape);
  const paintHash = sha({ shape, paint: [...solids, ...(def.extraFloors ?? [])].map((b) => [boxKey(b), b.surface ?? null]).sort((a, b) => byStr(JSON.stringify(a), JSON.stringify(b))) });
  (tileShape.get(shapeHash) ?? tileShape.set(shapeHash, []).get(shapeHash)).push(def.id);
  (tileShapePaint.get(paintHash) ?? tileShapePaint.set(paintHash, []).get(paintHash)).push(def.id);
  const retiredTo = shared.TILE_ALIASES.get(def.id);
  pieces.push({
    kind: isKit ? 'tile (data)' : 'tile (code)',
    id: def.id,
    name: def.displayName,
    source: { file: isKit ? 'content/tiles/core.json' : codeTileFile.get(def.id), generator: isKit ? 'tools/content/tiles.mjs → kitTiles.generated.ts, built by map/catalog.ts resolveKitTile' : 'drawn in code as boxes', ...(def.model ? { model: def.model.file, modelPack: modelSource?.title ?? modelLock?.source ?? null, licence: licenceClass(modelSource?.license, modelSource?.creator) } : { licence: 'owned (made in code)' }) },
    footprintCells: [w, d],
    levels,
    cells: def.cells.length,
    ports: def.ports.length,
    boxes: { solid: solids.filter((b) => (b.kind ?? 'solid') !== 'trim').length, trimOnly: solids.filter((b) => b.kind === 'trim').length, extraFloors: (def.extraFloors ?? []).length },
    ...(modelLock ? { triangles: modelLock.triangles, bytes: modelLock.bytes } : {}),
    collision: def.model ? 'floor slabs, side walls and the tile\'s own boxes (the model is only drawn)' : 'floor slabs, side walls (wall styles) and every solid box; trim boxes are drawn only',
    surface: mats.length ? { ownMaterials: mats } : { ownMaterials: [], note: 'painted by the map theme or the placement\'s surfaces' },
    paletteCategory: def.category,
    ...(def.open ? { open: true } : {}),
    ...(def.edgeDefault ? { edgeDefault: def.edgeDefault } : {}),
    ...(def.configurable ? { roomOptions: true } : {}),
    ...(def.optionOf ? { optionOf: def.optionOf } : {}),
    stylePacks: listedIn('tiles', def.id),
    ...(retiredTo ? { retired: true, playsAs: retiredTo } : {}),
    shapeHash,
    usage: usageOf('tile', def.id),
  });
}

// Props from the content packs.
const propsByFileHash = new Map();
for (const def of shared.CORE_PROPS) {
  if (def.id.startsWith('kit.')) continue;
  const src = propSource.get(def.id);
  const lock = lockByFile.get(def.file);
  const prov = provenanceByFile.get(def.file);
  const alias = shared.propAlias(def.id);
  if (lock?.sha256) (propsByFileHash.get(lock.sha256) ?? propsByFileHash.set(lock.sha256, []).get(lock.sha256)).push(def.id);
  pieces.push({
    kind: 'prop',
    id: def.id,
    name: def.displayName,
    source: { file: src?.file ?? null, pack: src?.pack ?? null, model: def.file, src: src?.src ?? null, creator: src?.creator ?? prov?.creator ?? null, licenceText: src?.license ?? prov?.license ?? null, licence: licenceClass(src?.license ?? prov?.license, src?.creator ?? prov?.creator) },
    size: def.size.map(r3),
    collision: def.collision === null ? 'none (walk through)' : `${src?.collide ?? 'box'}${def.boxes ? ` (${def.boxes.length} boxes)` : ''}`,
    surface: shared.propSurfaceOf(def.id) ?? `guessed: ${shared.propSurface(def.id)}`,
    ...(def.breakable ? { breakable: def.breakable.health } : {}),
    ...(lock ? { triangles: lock.triangles, bytes: lock.bytes } : {}),
    paletteCategory: def.category,
    paletteGroup: palette.propGroup(def),
    stylePacks: listedIn('props', def.id),
    ...(palette.RETIRED_PROPS.has(def.id) ? { retired: true, playsAs: alias ? `${alias.model}#${alias.variant}` : null, replaceAllOffers: palette.REPLACEMENTS[def.id] ?? null } : {}),
    usage: usageOf('prop', def.id),
  });
}

// Kit prop families (generated in code).
for (const fam of shared.KIT_FAMILIES) {
  const def = shared.getProp(fam.id);
  const src = kitSource.get(fam.id);
  const files = fam.variants.map((v) => lockByFile.get(v.file)).filter(Boolean);
  const u = usageOf('prop', fam.id);
  const viaAliases = shared.KIT_ALIASES.filter((a) => a.model === fam.id).reduce((n, a) => n + usageOf('prop', a.from).placements + usageOf('prop', a.from).viaSetPieces, 0);
  const variantUse = Object.fromEntries(fam.variants.map((v) => [v.name, usageOf('propVariant', `${fam.id}#${v.index}`).placements + usageOf('propVariant', `${fam.id}#${v.index}`).viaSetPieces]));
  pieces.push({
    kind: 'kit prop family',
    id: fam.id,
    name: def.displayName,
    source: { file: src?.file ?? null, generator: `tools/content/kit (kind "${fam.kind}") via tools/content/kitprops.mjs`, pack: kitPack.id, licence: 'owned (made in code)' },
    size: def.size.map(r3),
    collision: def.collision === null ? 'none (walk through)' : def.boxes ? `boxes (${def.boxes.length})` : 'box',
    surface: fam.surface,
    ...(def.breakable ? { breakable: def.breakable.health } : {}),
    variants: fam.variants.map((v) => v.name),
    lodDistances: [...fam.lods],
    lodTriangles: [...fam.triangles],
    bytes: files.reduce((n, f) => n + f.bytes, 0),
    ...(fam.within ? { partOfLargerBuild: true } : {}),
    paletteCategory: def.category,
    paletteGroup: palette.propGroup(def),
    stylePacks: listedIn('props', fam.id),
    aliases: sorted(kitAliasesTo.get(fam.id) ?? []),
    usage: { ...u, placementsOfRetiredIdsThatPlayAsIt: viaAliases, byVariantWhereNamed: variantUse },
  });
}

// Environment species (generated in code).
for (const s of shared.ENV_SPECIES) {
  const kinds = sorted(new Set(s.variants.flatMap((v) => v.shapes.map((sh) => `${sh.kind}${sh.blocks === 'shots' ? ' (shots only)' : ''}`))));
  const offered = Object.entries(palette.GROUND_COVER_SPECIES).find(([, ids]) => ids.includes(s.id))?.[0] ?? null;
  const replaces = sorted(Object.entries(palette.REPLACEMENTS).filter(([, to]) => to.split('#')[0] === s.id).map(([from]) => from));
  pieces.push({
    kind: 'environment species',
    id: s.id,
    name: s.displayName,
    source: { file: envSourceByFamily.get(s.family) ?? null, generator: 'tools/content/env via tools/content/environment.mjs', licence: 'owned (made in code)' },
    size: s.variants[0].size.map(r3),
    nominalHeight: s.nominalHeight,
    collision: kinds.length ? kinds.join(', ') : 'none',
    surface: s.surface,
    nav: s.nav,
    role: s.role,
    conceals: !!s.conceals,
    variants: s.variants.map((v) => v.name),
    paletteCategory: offered ?? `Nature (${s.category})`,
    paletteGroup: 'nature',
    stylePacks: listedIn('props', s.id),
    aliases: replaces,
    usage: usageOf('prop', s.id),
  });
}

// Set pieces and their role packs.
for (const def of library.pieces.values()) {
  const parts = {};
  for (const p of def.parts) {
    const k = p.tile ? 'tile' : (p.kind ?? 'other');
    parts[k] = (parts[k] ?? 0) + 1;
  }
  const xs = def.footprint.cells.map((c) => c[0]);
  const ys = def.footprint.cells.map((c) => c[1]);
  pieces.push({
    kind: 'set piece',
    id: def.id,
    name: def.displayName,
    source: { file: `content/setpieces/${def.family}.json`, generator: 'tools/content/setpieces.mjs → setPieces.generated.ts', licence: 'owned (made of catalogue pieces)' },
    footprintCells: [Math.max(...xs) - Math.min(...xs) + 1, Math.max(...ys) - Math.min(...ys) + 1],
    levels: def.footprint.levels.length,
    cells: def.footprint.cells.length,
    parts: Object.fromEntries(Object.entries(parts).sort(([a], [b]) => byStr(a, b))),
    uses: { tiles: sorted(new Set(def.parts.filter((p) => p.tile).map((p) => p.tile))), props: sorted(new Set(def.parts.filter((p) => p.kind === 'prop').map((p) => p.model))) },
    collision: 'its parts\' own',
    paletteCategory: def.category,
    paletteGroup: palette.setPieceFamilyLabel(def.family),
    mirror: def.mirror,
    rolePacks: [...def.packs],
    stylePacks: shared.STYLE_PACKS.filter((sp) => palette.setPieceSuitsStylePack(def, sp.id, library.packs)).map((sp) => sp.id).sort(byStr),
    aliases: sorted(tileAliasesTo.get(def.id) ?? []),
    usage: usageOf('setPiece', def.id),
  });
}
for (const p of library.packs.values()) {
  pieces.push({
    kind: 'set piece role pack',
    id: p.id,
    name: p.displayName,
    source: { file: 'content/setpieces/roles.json', licence: 'owned (data)' },
    themes: [...p.themes],
    stylePack: p.stylePack ?? (shared.STYLE_PACKS.some((sp) => sp.id === p.id) ? p.id : null),
    roles: Object.fromEntries(Object.entries(p.roles).map(([k, v]) => [k, typeof v === 'string' ? v : v.tint ? `${v.material} ${v.tint}` : v.material])),
    piecesThatSuitIt: [...library.pieces.values()].filter((d) => d.packs.includes(p.id)).length,
    usage: usageOf('rolePack', p.id),
  });
}

// Themes and library materials.
const materialInThemes = new Map();
for (const t of shared.CORE_THEMES) {
  for (const s of Object.values(t.slots)) {
    if (!materialInThemes.has(s.material)) materialInThemes.set(s.material, new Set());
    materialInThemes.get(s.material).add(t.id);
  }
  const rolePack = [...library.packs.values()].find((p) => p.themes.includes(t.id))?.id ?? null;
  pieces.push({
    kind: 'theme',
    id: t.id,
    name: t.displayName,
    source: { file: 'content/materials.json', generator: 'tools/content/materials.mjs → materials.generated.ts', licence: 'owned (data)' },
    slots: Object.fromEntries(Object.entries(t.slots).map(([k, v]) => [k, v.tint ? `${v.material} ${v.tint}` : v.material])),
    sky: t.sky,
    stylePacks: listedIn('themes', t.id),
    rolePack,
    usage: usageOf('theme', t.id),
  });
}
const materialSame = new Map();
for (const m of shared.CORE_MATERIALS) {
  const look = m.texture ? `texture:${m.texture}` : `pattern:${m.pattern}:${m.base}:${m.accent}:${m.scale}`;
  (materialSame.get(look) ?? materialSame.set(look, []).get(look)).push(m.id);
  const tex = m.texture ? provenanceByFile.get(`textures/${m.texture}_color.jpg`) : null;
  pieces.push({
    kind: 'material',
    id: m.id,
    name: m.displayName,
    source: { file: 'content/materials.json', ...(m.texture ? { texture: m.texture, licence: licenceClass(tex?.license ?? 'CC0-1.0 (ambientCG)', tex?.creator) } : { pattern: m.pattern, licence: 'owned (made in code)' }) },
    surface: shared.materialSurfaceOf(m.id) ?? `guessed: ${shared.materialSurface(m.id)}`,
    ...(typeof shared.surfaceMaterial === 'function' ? { ballistic: shared.surfaceMaterial(m.id) } : {}),
    paletteCategory: m.category,
    ...(m.emissive ? { emissive: true } : {}),
    inThemes: sorted(materialInThemes.get(m.id) ?? []),
    tilesPaintedWithIt: materialInTiles.get(m.id) ?? 0,
    stylePacks: listedIn('materials', m.id),
    usage: usageOf('material', m.id),
  });
}

// Wall (edge) styles, facades and the other room options.
for (const id of shared.EDGE_STYLES) {
  const e = edgeData.get(id) ?? {};
  const t = [...new Set((e.segments ?? []).map((s) => s.t ?? shared.TILE_DIMENSIONS.wallThickness))].sort((a, b) => a - b);
  pieces.push({
    kind: 'wall style',
    id,
    name: shared.EDGE_STYLE_LABELS[id],
    source: { file: 'content/tiles/edges.json', generator: 'tools/content/tiles.mjs → edgeStyles.generated.ts, built by map/geometry.ts', licence: 'owned (data)' },
    ...(e.rule ? { rule: e.rule } : { segments: (e.segments ?? []).length, thickness: t }),
    ...(e.openings ? { openings: e.openings.map(([u0, u1, y0, y1]) => ({ width: r3(u1 - u0), from: y0, to: y1 })) } : {}),
    ...(e.glass ? { takesGlass: true } : {}),
    collision: e.rule ? 'a rule, not a shape' : 'its segments (boxes)',
    usage: usageOf('edge', id),
  });
}
for (const id of shared.FACADES) {
  pieces.push({
    kind: 'facade',
    id,
    name: shared.FACADE_LABELS[id],
    source: { file: shared.MODEL_FACADES.has(id) ? 'models (city kit and packs: map/faces.ts FACADE_FILES)' : 'boxes in library materials (map/faces.ts)', licence: shared.MODEL_FACADES.has(id) ? 'CC0 / owned (see content/city.json, content/packs.json)' : 'owned (made in code)' },
    collision: 'none (drawn on the outside of a room\'s walls)',
    stylePacks: listedIn('facades', id),
    rolePacks: [...library.packs.values()].filter((p) => p.roles.facade === id).map((p) => p.id).sort(byStr),
    usage: usageOf('option.facade', id),
  });
}
for (const [group, list, labels] of [['ceiling', shared.CEILINGS, shared.CEILING_LABELS], ['corners', shared.CORNERS, null], ['layout', shared.ROOM_LAYOUTS, shared.ROOM_LAYOUT_LABELS], ['floor', shared.FLOOR_INSERTS, shared.FLOOR_INSERT_LABELS]]) {
  for (const id of list) pieces.push({ kind: `room option (${group})`, id, name: labels?.[id] ?? id, source: { file: 'packages/shared/src/map/tileOptions.ts', licence: 'owned (made in code)' }, usage: usageOf(`option.${group}`, id) });
}

// Vehicles and turrets, and the gameplay pieces whose look is a style.
for (const id of shared.MOUNT_MODELS) {
  const def = shared.MOUNT_DEFS[id];
  pieces.push({ kind: 'vehicle or turret', id, name: def.displayName, source: { file: 'content/vehicles', model: def.model ?? null }, stylePacks: listedIn('mounts', id), usage: usageOf('mount', id) });
}
for (const id of shared.DOOR_STYLES) pieces.push({ kind: 'door style', id, name: shared.DOOR_STYLE_LABELS[id], source: { file: 'packages/shared/src/map/schema.ts DOOR_STYLES' }, stylePacks: shared.STYLE_PACKS.filter((p) => p.gameplay.includes(`door:${id}`)).map((p) => p.id).sort(byStr), usage: usageOf('door', id) });
for (const id of shared.DESTRUCTIBLE_MODELS) pieces.push({ kind: 'destructible', id, name: id, source: { file: 'packages/shared/src/map/schema.ts DESTRUCTIBLE_MODELS' }, stylePacks: shared.STYLE_PACKS.filter((p) => p.gameplay.includes(id)).map((p) => p.id).sort(byStr), usage: usageOf('destructible', id) });
for (const id of shared.LIGHT_FIXTURES) pieces.push({ kind: 'light fixture', id, name: id, source: { file: 'packages/shared/src/map/schema.ts LIGHT_FIXTURES' }, stylePacks: shared.STYLE_PACKS.filter((p) => p.gameplay.includes(`light:${id}`)).map((p) => p.id).sort(byStr), usage: usageOf('light', id) });
for (const id of shared.LADDER_STYLES) pieces.push({ kind: 'ladder style', id, name: shared.LADDER_STYLE_LABELS[id], source: { file: 'packages/shared/src/map/schema.ts LADDER_STYLES' }, usage: usageOf('ladder', id) });

pieces.sort((a, b) => byStr(a.kind, b.kind) || byStr(a.id, b.id));

// ------------------------------------------------------------------ checks across the tables

const known = { tile: new Set(shared.coreCatalog.all().map((t) => t.id)), setPiece: new Set(library.pieces.keys()), theme: new Set(shared.CORE_THEMES.map((t) => t.id)), material: new Set(shared.CORE_MATERIALS.map((m) => m.id)) };
const unknown = [];
for (const [kind, ids] of usage) {
  for (const [id, m] of ids) {
    let ok = true;
    if (kind === 'tile' || kind === 'theme' || kind === 'material') ok = known[kind].has(id);
    else if (kind === 'setPiece') ok = known.setPiece.has(id) || id.startsWith('local.');
    else if (kind === 'prop') ok = !!shared.getProp(id);
    if (!ok) unknown.push({ kind, id, mapIds: sorted(m.keys()) });
  }
}
unknown.sort((a, b) => byStr(a.kind, b.kind) || byStr(a.id, b.id));

const mapsOf = (kind, ids) => sorted(new Set(ids.flatMap((id) => usageOf(kind, id).mapIds)));
const duplicateCandidates = [];
for (const [hash, ids] of tileShape) {
  if (ids.length < 2) continue;
  const samePaint = [...tileShapePaint.values()].some((g) => g.length === ids.length && ids.every((i) => g.includes(i)));
  duplicateCandidates.push({ what: samePaint ? 'tiles with the same cells, ports, boxes and paint' : 'tiles with the same cells, ports and boxes (paint differs)', key: hash, ids: sorted(ids), mapIds: mapsOf('tile', ids) });
}
for (const [hash, ids] of propsByFileHash) if (ids.length > 1) duplicateCandidates.push({ what: 'props drawn from byte-identical model files', key: hash, ids: sorted(ids), mapIds: mapsOf('prop', ids) });
const bySrc = new Map();
for (const [id, s] of propSource) if (s.src) (bySrc.get(`${s.pack}/${s.src}`) ?? bySrc.set(`${s.pack}/${s.src}`, []).get(`${s.pack}/${s.src}`)).push(id);
for (const [key, ids] of bySrc) if (ids.length > 1) duplicateCandidates.push({ what: 'props built from the same source model (may differ by size, colours or collision)', key, ids: sorted(ids), mapIds: mapsOf('prop', ids) });
for (const [key, ids] of materialSame) if (ids.length > 1) duplicateCandidates.push({ what: 'materials with the same texture or the same pattern and colours (tint, shine or surface type may differ)', key, ids: sorted(ids), mapIds: mapsOf('material', ids) });
duplicateCandidates.sort((a, b) => byStr(a.what, b.what) || byStr(a.ids[0], b.ids[0]));

const counts = {};
for (const p of pieces) {
  const c = (counts[p.kind] ??= { pieces: 0, placedInAMap: 0, neverPlaced: 0, retired: 0 });
  c.pieces++;
  if (p.retired) c.retired++;
  if (p.usage.placements + p.usage.viaSetPieces > 0) c.placedInAMap++;
  else c.neverPlaced++;
}
const versions = new Map();
for (const m of maps) inc(versions, String(m.formatVersion));

const out = {
  $comment: 'Generated by tools/content/asset-inventory.mjs from the game\'s registries and maps/*.json. Read-only: nothing in the game reads this file. Do not edit by hand; run the tool again. Usage: `placements` are a map file\'s own placements, `viaSetPieces` those inside the set pieces it places; `liveMaps` leaves out retired and test-only maps.',
  conventions: {
    grid: { cellSize: shared.SET_PIECE_GRID.cellSize, levelHeight: shared.SET_PIECE_GRID.levelHeight, note: 'a map stores its own cellSize and levelHeight (schema defaults 8 and 4); see `maps` for what each file says' },
    tileDimensions: { ...shared.TILE_DIMENSIONS },
    mapFormat: { name: shared.MAP_FORMAT, version: shared.MAP_FORMAT_VERSION },
    tilePivot: 'the centre of the tile\'s first cell [0,0] at its base floor; a footprint grows to +x (east) and +y (north) before the turn; turned in quarter turns clockwise',
    propPivot: 'the centre of the footprint on the floor (y = 0), facing +z before its yaw; free yaw in radians and a scale of 0.25 to 4',
    setPiecePivot: 'its anchor cell, turned in quarter turns and optionally mirrored',
  },
  counts: Object.fromEntries(Object.entries(counts).sort(([a], [b]) => byStr(a, b))),
  mapFormatVersions: Object.fromEntries([...versions].sort(([a], [b]) => byStr(a, b))),
  stylePacks: shared.STYLE_PACKS.map((p) => ({ id: p.id, number: p.number, name: p.displayName, style: p.style, themes: [...p.themes], facades: [...p.facades], tiles: p.tiles.length, ownTiles: p.tiles.filter((t) => t.startsWith(`${p.id}.`)).length, props: p.props.length, materials: p.materials.length, setPieces: [...library.pieces.values()].filter((d) => palette.setPieceSuitsStylePack(d, p.id, library.packs)).length, demo: p.demo ?? null })),
  propGroups: palette.PROP_GROUPS.map((g) => ({ id: g.id, label: g.label, categories: [...g.categories] })),
  tileCategories: [...shared.TILE_CATEGORIES],
  maps,
  unknownReferences: unknown,
  duplicateCandidates,
  pieces,
};

// One piece (and one map) per line: stable, and a change to one piece is one line of diff.
const lines = ['{'];
const keys = Object.keys(out);
keys.forEach((k, i) => {
  const v = out[k];
  const comma = i < keys.length - 1 ? ',' : '';
  if (Array.isArray(v) && ['pieces', 'maps', 'duplicateCandidates', 'unknownReferences', 'stylePacks', 'propGroups'].includes(k)) {
    lines.push(`  ${JSON.stringify(k)}: [`);
    v.forEach((item, j) => lines.push(`    ${JSON.stringify(item)}${j < v.length - 1 ? ',' : ''}`));
    lines.push(`  ]${comma}`);
  } else lines.push(`  ${JSON.stringify(k)}: ${JSON.stringify(v)}${comma}`);
});
lines.push('}');
const text = `${lines.join('\n')}\n`;

const rel = relative(ROOT, OUT);
if (process.argv.includes('--check')) {
  const have = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (have !== text) {
    console.error(`${rel} is out of date: run node tools/content/asset-inventory.mjs`);
    process.exit(1);
  }
  console.log(`${rel} is up to date (${pieces.length} pieces, ${maps.length} maps)`);
} else {
  writeFileSync(OUT, text);
  console.log(`wrote ${rel}: ${pieces.length} pieces, ${maps.length} maps, ${text.length} bytes`);
}
if (process.argv.includes('--summary')) console.log(JSON.stringify(out.counts, null, 2));
