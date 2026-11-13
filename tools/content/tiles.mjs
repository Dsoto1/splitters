// Tiles as data: the core building kit and the edge styles (docs/CONTENT_SCALABILITY.md step 7; how to add one:
// docs/CONTENT_PIPELINE.md, "Tiles and edge styles").
//
//   node tools/content/tiles.mjs           check the content and write the generated files
//   node tools/content/tiles.mjs --check   check the content, and that the generated files are up to date
//
// Reads content/tiles/edges.json (every edge style: label, collision segments, trim, window openings and how glass,
// corners, facades and room dressing read it) and content/tiles/core.json (every core kit tile: cells, floors,
// ports, default edges and a list of parts from the shared kit, each naming its builder and parameters). Checks the
// schema (unknown fields are errors) and the references (palette groups and sides are the lists in
// map/tileOptions.ts; default edges are edge styles; ports and default edges sit on the tile's own cells; models are
// under packages/client/public; a part's surface is a material in content/materials.json; every tile and edge style
// the maps and the Style Packs name exists), then writes packages/shared/src/content/edgeStyles.generated.ts and
// kitTiles.generated.ts.
// Tiles and edge styles have no network code: maps store a tile and a side's style by id, so the id never changes.
// Geometry builders and behaviour stay in code: the part builders and the room options (map/catalog.ts), the
// auto/open rule and the facades (map/geometry.ts), and the Style Pack tiles drawn in code (map/packTiles*.ts).

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsList } from './materials.mjs';
import { check, comments, shape, sq, tsInline } from './weapons.mjs';
import { tunnelTiles } from './kit/tunnel.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const EDGES = 'content/tiles/edges.json';
const CORE = 'content/tiles/core.json';
/** The tunnel kit: shapes and material families, made into tiles by tools/content/kit/tunnel.mjs. */
const TUNNELS = 'content/tiles/tunnels.json';
const GENERATED_EDGES = 'packages/shared/src/content/edgeStyles.generated.ts';
const GENERATED_TILES = 'packages/shared/src/content/kitTiles.generated.ts';
const OPTIONS_TS = 'packages/shared/src/map/tileOptions.ts';
const PUBLIC = 'packages/client/public';
/** Id prefixes of the tiles defined here; other prefixes belong to the Style Pack tiles drawn in code. */
const KIT_PREFIXES = ['core', 'city', 'orbital', 'neon'];

const { num, int, str, bool, en, tup, arr, obj, map, notes } = shape;
const readJson = (root, rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'));

export function load(root = ROOT) {
  return { edges: readJson(root, EDGES), core: readJson(root, CORE), tunnels: existsSync(join(root, TUNNELS)) ? readJson(root, TUNNELS) : null };
}

// ---------------------------------------------------------------- edge values

const NUM = '(\\d+(?:\\.\\d+)?)';
const U_RE = new RegExp(`^(-?)half(?:([+-])${NUM})?$`);
const Y_RE = new RegExp(`^height(?:\\*${NUM})?(?:([+-])${NUM})?$`);
const MIN_RE = new RegExp(`^min\\(${NUM},height\\)$`);

/** An along-the-side value: metres, or "half" / "-half" plus or minus metres. Returns [value, problem]. */
export function uValue(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return [v, null];
  const m = typeof v === 'string' && v.match(U_RE);
  if (!m) return [null, `${JSON.stringify(v)} is not metres, "half", "-half", "half-0.75" or "-half+0.75"`];
  const out = { half: m[1] ? -1 : 1 };
  if (m[2]) out.add = (m[2] === '-' ? -1 : 1) * Number(m[3]);
  return [out, null];
}

/** A height value: metres, "height", "height*2", "height-0.15", "height*2-0.2" or "min(3.5,height)". */
export function yValue(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return [v, null];
  if (typeof v === 'string') {
    const min = v.match(MIN_RE);
    if (min) return [{ upTo: Number(min[1]) }, null];
    const m = v.match(Y_RE);
    if (m) {
      const out = { height: m[1] ? Number(m[1]) : 1 };
      if (m[2]) out.add = (m[2] === '-' ? -1 : 1) * Number(m[3]);
      return [out, null];
    }
  }
  return [null, `${JSON.stringify(v)} is not metres, "height", "height*2", "height-0.15", "height*2-0.2" or "min(3.5,height)"`];
}

const value = { t: 'num|str' };

// ---------------------------------------------------------------- schema

function schemas(root, materials) {
  const sides = tsList(root, OPTIONS_TS, 'SIDES');
  const categories = tsList(root, OPTIONS_TS, 'TILE_CATEGORIES');
  const pair = tup(2, value);
  const repeat = obj({ from: value, 'through?': value, 'below?': value, step: num, 'clamp?': bool });
  const segment = obj({ u: pair, y: pair, 't?': num, 'repeat?': repeat });
  const trimPiece = obj({
    'base?': pair, 'cornice?': pair, 'frame?': obj({ half: num, top: num }), 'window?': obj({ u: tup(2), y: tup(2) }),
    'arch?': obj({ u: tup(2), y: tup(2), count: int, band: num, 'key?': num, 'depth?': num }),
    'u?': pair, 'y?': pair, 'depth?': num, 'v?': tup(2), 'repeat?': repeat, 'outside?': bool,
    'surface?': obj({ material: en(materials), 'tint?': str }),
  });
  const edge = obj({
    id: str, label: str, 'rule?': en(['auto', 'open']), 'segments?': arr(segment), 'trim?': arr(trimPiece), 'trimFrom?': num,
    'openings?': arr(tup(4)), 'glass?': bool, 'corner?': bool, 'facade?': bool, 'street?': bool, 'openDefault?': bool,
    'dressing?': obj({ kind: en(['door', 'window', 'see-through']), 'span?': num }), 'notes?': notes,
  });
  const surface = obj({ material: en(materials), 'tint?': str });
  const at2 = tup(2);
  const builders = {
    box: tup(6),
    flight: obj({ axis: en(['x', 'z']), dir: en([1, -1]), from: num, across: at2, steps: int, 'base?': num, 'run?': num, 'floor?': num }),
    descending: obj({ edge: num, across: at2, steps: int, top: num, 'floor?': num, 'run?': num }),
    rail: obj({ from: at2, to: at2, 'y?': num }),
    columns: obj({ at: arr(at2, 1), half: num, y: at2 }),
    partition: obj({ axis: en(['x', 'z']), at: num, from: num, to: num, 'gaps?': arr(at2), 'y?': at2, 't?': num }),
    lamp: obj({ at: at2, dir: en([1, -1]) }),
    arc: obj({ centre: at2, r: num, turns: at2, 'pieces?': int, y: at2, 't?': num }),
    arcTrim: obj({ centre: at2, r: num, turns: at2, 'height?': num }),
    arcade: obj({ centre: at2, r: num, turns: at2, bays: int, 'height?': num }),
    roundRoom: obj({ centre: at2, r: num, door: num, window: num }),
    discStrips: obj({ centre: at2, r: num, strips: int, width: num, y: at2 }),
    vault: obj({ axis: en(['x', 'z']), span: at2, along: at2, spring: num, crown: num, 'pieces?': int, 't?': num }),
    block: obj({ across: num, height: num }),
  };
  const part = obj({
    ...Object.fromEntries(Object.entries(builders).map(([k, s]) => [`${k}?`, s])),
    'kind?': en(['solid', 'wall', 'floor', 'trim', 'prop']), 'yaw?': num, 'pitch?': num, 'roll?': num, 'surface?': surface,
  });
  const port = obj({ 'side?': en(sides), 'level?': int, 'cell?': tup(2, int), 'allSides?': int, 'perimeter?': tup(2, int), 'levels?': arr(int, 1) });
  const tile = obj({
    id: str, displayName: str, category: en(categories), 'blurb?': str, 'cells?': arr(tup(3, int), 1), 'footprint?': arr(int, 2),
    floors: arr(int), ports: arr(port), 'open?': bool, 'edgeDefault?': str, 'edgeDefaults?': map(str), 'configurable?': bool,
    'model?': obj({ file: str, 'lift?': num }), 'solids?': arr(part), 'extraFloors?': arr(part), 'notes?': notes,
    // MapMaker's tile options that are tiles of their own (map/catalog.ts TILE_OPTIONS): this tile is `tile` with `option` on.
    'optionOf?': obj({ tile: str, option: en(['sideWalls', 'underGround']) }),
    // The tunnel kit (kit/tunnel.mjs): this tile is the shape `base` in the material family `family`.
    'familyOf?': obj({ base: str, family: str, label: str }),
    // A piece buried in terrain (map/groundBore.ts): boxes the ground's surface is cut out of, and mouths it opens at.
    'bore?': obj({ 'cut?': arr(tup(6), 1), 'open?': arr(tup(6), 1), 'out?': en(sides), 'rim?': arr(obj({ line: tup(4), y: tup(2), mode: en(['both', 'raise', 'lower']) }), 1), 'cover?': arr(tup(5), 1) }),
  });
  return { edge, tile, sides, builders: Object.keys(builders) };
}

// check() knows num and str but not "a number or a string": give it that case by wrapping.
const origCheck = check;
function checkValue(v, s, path, out = []) {
  if (s === value) {
    if (!(typeof v === 'number' && Number.isFinite(v)) && !(typeof v === 'string' && v)) out.push(`${path}: a number or a value like "half", not ${JSON.stringify(v)}`);
    return out;
  }
  if (s && s.t === 'tuple' && s.of === value) {
    if (!Array.isArray(v) || v.length !== s.n) out.push(`${path}: a list of ${s.n}`);
    else v.forEach((x, i) => checkValue(x, value, `${path}[${i}]`, out));
    return out;
  }
  if (s && s.t === 'obj' && v && typeof v === 'object' && !Array.isArray(v)) {
    const keys = new Map(Object.keys(s.shape).map((k) => [k.replace(/\?$/, ''), k]));
    for (const k of Object.keys(v)) if (!keys.has(k) && k !== '$comment') out.push(`${path}: unknown field "${k}"`);
    for (const [k, full] of keys) {
      if (v[k] === undefined) {
        if (!full.endsWith('?')) out.push(`${path}: "${k}" is missing`);
      } else checkValue(v[k], s.shape[full], `${path}.${k}`, out);
    }
    return out;
  }
  if (s && s.t === 'arr' && Array.isArray(v) && v.length >= s.min) {
    v.forEach((x, i) => checkValue(x, s.of, `${path}[${i}]`, out));
    return out;
  }
  return origCheck(v, s, path, out);
}

// ---------------------------------------------------------------- references

/** Tile ids and edge styles the maps and the Style Packs name: [kind, id, where]. */
function namedElsewhere(root) {
  const named = [];
  const maps = join(root, 'maps');
  if (existsSync(maps)) {
    for (const f of readdirSync(maps).filter((x) => x.endsWith('.json')).sort()) {
      const text = readFileSync(join(maps, f), 'utf8');
      for (const m of text.matchAll(/"tile":\s*"([^"]+)"/g)) named.push(['tile', m[1], `maps/${f}`]);
      for (const m of text.matchAll(/"edges":\s*\{([^}]*)\}/g)) for (const e of m[1].matchAll(/:\s*"([^"]+)"/g)) named.push(['edge', e[1], `maps/${f}`]);
    }
  }
  const packs = 'packages/shared/src/editor/stylePacks.ts';
  const packSrc = readFileSync(join(root, packs), 'utf8');
  for (const m of packSrc.matchAll(/\btiles:\s*\[([^\]]*)\]/g)) {
    for (const id of m[1].replace(/\/\/[^\n]*/g, '').matchAll(/'([^']+)'/g)) named.push(['tile', id[1], packs]);
  }
  return named;
}

/** Id prefixes of the Style Pack tiles drawn in code (map/packTiles*.ts). */
function codePackPrefixes(root) {
  const dir = 'packages/shared/src/map';
  const out = new Set();
  for (const f of readdirSync(join(root, dir)).filter((x) => /^packTiles.*\.ts$/.test(x))) {
    const src = readFileSync(join(root, dir, f), 'utf8');
    for (const m of src.matchAll(/\bid:\s*[`']([a-z]+)\./g)) out.add(m[1]);
  }
  return out;
}

// ---------------------------------------------------------------- build

/** Check everything and build the tables: { problems, out: { edges, tiles } }. */
export function build(content, root = ROOT) {
  const problems = [];
  const materials = readJson(root, 'content/materials.json').materials.map((m) => m.id);
  const S = schemas(root, materials);

  // Edge styles.
  const top = content.edges;
  for (const k of Object.keys(top ?? {})) if (!['$comment', 'edges'].includes(k)) problems.push(`${EDGES}: unknown field "${k}"`);
  const edgeList = Array.isArray(top?.edges) ? top.edges : [];
  if (!edgeList.length) problems.push(`${EDGES}: "edges" must be a list of at least 1`);
  const edges = [];
  const edgeIds = new Set();
  for (const [i, e] of edgeList.entries()) {
    const where = `${EDGES}: edges[${i}] (${e?.id})`;
    const bad = checkValue(e, S.edge, where);
    problems.push(...bad);
    if (bad.length) continue;
    if (!/^[a-z][a-z0-9_]*$/.test(e.id)) problems.push(`${where}: id must be lower case letters, digits and _`);
    if (edgeIds.has(e.id)) problems.push(`${where}: id ${e.id} is listed twice`);
    edgeIds.add(e.id);
    const def = { id: e.id, label: e.label };
    if (e.rule) {
      if (e.rule !== e.id) problems.push(`${where}: rule ${e.rule} belongs to the style with id ${e.rule}`);
      const extra = Object.keys(e).filter((k) => !['id', 'label', 'rule', 'notes', '$comment'].includes(k));
      if (extra.length) problems.push(`${where}: a rule style (built by code) has no ${extra.join(', ')}`);
      edges.push({ def, rule: e.rule, notes: e.notes });
      continue;
    }
    if (!e.segments) problems.push(`${where}: "segments" is missing (what collides)`);
    if (!e.trim) problems.push(`${where}: "trim" is missing (an empty list for none)`);
    const parse = (v, f, path) => {
      const [x, p] = f(v);
      if (p) problems.push(`${where}: ${path}: ${p}`);
      return x;
    };
    const pair = (p, f, path) => [parse(p[0], f, `${path}[0]`), parse(p[1], f, `${path}[1]`)];
    const rep = (r, path) => {
      if (!r) return undefined;
      if ((r.through === undefined) === (r.below === undefined)) problems.push(`${where}: ${path}: give one of "through" (inclusive) or "below"`);
      if (!(r.step > 0)) problems.push(`${where}: ${path}.step must be above 0`);
      return {
        from: parse(r.from, uValue, `${path}.from`),
        to: parse(r.through ?? r.below, uValue, `${path}.${r.through !== undefined ? 'through' : 'below'}`),
        ...(r.through !== undefined ? { through: true } : {}),
        step: r.step,
        ...(r.clamp ? { clamp: true } : {}),
      };
    };
    const segments = (e.segments ?? []).map((s, j) => {
      const path = `segments[${j}]`;
      if (s.t !== undefined && !(s.t > 0)) problems.push(`${where}: ${path}.t must be above 0`);
      const r = rep(s.repeat, `${path}.repeat`);
      if (r && s.u.some((x) => typeof x !== 'number')) problems.push(`${where}: ${path}.u: offsets from the repeat are metres`);
      return { u: r ? s.u : pair(s.u, uValue, `${path}.u`), y: pair(s.y, yValue, `${path}.y`), ...(s.t !== undefined ? { t: s.t } : {}), ...(r ? { repeat: r } : {}) };
    });
    const trim = (e.trim ?? []).map((t, j) => {
      const path = `trim[${j}]`;
      const kinds = ['base', 'cornice', 'frame', 'window', 'arch', 'u'].filter((k) => t[k] !== undefined);
      if (kinds.length !== 1) {
        problems.push(`${where}: ${path}: one of base, cornice, frame, window, arch, or a box (u, y, depth)`);
        return {};
      }
      if (t.outside && !t.arch && !t.u) problems.push(`${where}: ${path}: outside goes on an arch or a trim box`);
      if (t.base) return { base: pair(t.base, uValue, `${path}.base`) };
      if (t.cornice) return { cornice: pair(t.cornice, uValue, `${path}.cornice`) };
      const own = t.surface ? { surface: t.surface } : {};
      if (t.surface && !t.frame && !t.u) problems.push(`${where}: ${path}: surface goes on a frame or a trim box`);
      if (t.surface?.tint !== undefined && !/^#[0-9a-f]{6}$/.test(t.surface.tint)) problems.push(`${where}: ${path}.surface.tint must be #rrggbb`);
      if (t.frame) return { frame: t.frame, ...own };
      if (t.window) return { window: t.window };
      if (t.arch) {
        const a = t.arch;
        if (!(a.u[0] < a.u[1])) problems.push(`${where}: ${path}.arch.u: the springing points [u0, u1] with u0 < u1`);
        if (!(a.y[0] < a.y[1])) problems.push(`${where}: ${path}.arch.y: [springing, crown] with the crown higher`);
        if (!(a.count >= 1) || !(a.band > 0)) problems.push(`${where}: ${path}.arch: count at least 1 and band (the voussoirs' depth, m) above 0`);
        if (a.y[1] - a.y[0] > (a.u[1] - a.u[0]) / 2) problems.push(`${where}: ${path}.arch: a segmental arch rises at most half its span`);
        return { arch: a, ...(t.outside ? { outside: true } : {}) };
      }
      if (t.v !== undefined) {
        // A box set in the wall itself (a sash's bars by the glass): from and to, in from the cell's boundary.
        if (t.y === undefined || t.depth !== undefined || t.repeat || t.outside) problems.push(`${where}: ${path}: a box set in the wall has u, y and v (no depth, repeat or outside)`);
        if (!(t.v[0] < t.v[1])) problems.push(`${where}: ${path}.v: [from, to] in from the cell's boundary, from < to`);
        return { u: pair(t.u, uValue, `${path}.u`), y: pair(t.y ?? [0, 0], yValue, `${path}.y`), v: t.v, ...own };
      }
      if (t.y === undefined || t.depth === undefined) problems.push(`${where}: ${path}: a trim box needs u, y and depth (or v)`);
      const r = rep(t.repeat, `${path}.repeat`);
      if (r && t.u.some((x) => typeof x !== 'number')) problems.push(`${where}: ${path}.u: offsets from the repeat are metres`);
      return { u: r ? t.u : pair(t.u, uValue, `${path}.u`), y: pair(t.y ?? [0, 0], yValue, `${path}.y`), depth: t.depth, ...(r ? { repeat: r } : {}), ...(t.outside ? { outside: true } : {}), ...own };
    });
    if (e.glass && !e.openings?.length) problems.push(`${where}: glass needs "openings" (the window openings it fills)`);
    for (const [j, o] of (e.openings ?? []).entries()) if (!(o[0] < o[1] && o[2] < o[3])) problems.push(`${where}: openings[${j}]: [u0, u1, y0, y1] with u0 < u1 and y0 < y1`);
    if (e.dressing && e.dressing.kind !== 'see-through' && !(e.dressing.span > 0)) problems.push(`${where}: dressing.span (the opening's width, m) must be above 0`);
    if (e.dressing?.kind === 'see-through' && e.dressing.span !== undefined) problems.push(`${where}: a see-through side has no dressing.span`);
    const shape = {
      segments, trim, ...(e.trimFrom !== undefined ? { trimFrom: e.trimFrom } : {}),
      ...(e.openings ? { openings: e.openings } : {}), ...(e.openDefault ? { openDefault: true } : {}),
      ...(e.dressing ? { dressing: e.dressing } : {}),
    };
    edges.push({ def, shape, flags: { glass: !!e.glass, corner: !!e.corner, facade: !!e.facade, street: !!e.street }, notes: e.notes });
  }
  for (const rule of ['auto', 'open']) if (!edgeList.some((e) => e?.id === rule && e?.rule === rule)) problems.push(`${EDGES}: keep the "${rule}" style (rule: "${rule}"; map/geometry.ts resolveEdge)`);
  if (edgeList[0] && edgeList[0].id !== 'auto') problems.push(`${EDGES}: auto comes first (MapMaker's reset)`);

  // Tiles.
  const core = content.core;
  for (const k of Object.keys(core ?? {})) if (!['$comment', 'tiles'].includes(k)) problems.push(`${CORE}: unknown field "${k}"`);
  const tileList = Array.isArray(core?.tiles) ? [...core.tiles] : [];
  // The tunnel kit's tiles, generated from its shapes and families, after the hand-written kit.
  if (content.tunnels) {
    try {
      tileList.push(...tunnelTiles(content.tunnels));
    } catch (e) {
      problems.push(`${TUNNELS}: ${e.message}`);
    }
  }
  if (!tileList.length) problems.push(`${CORE}: "tiles" must be a list of at least 1`);
  const tiles = [];
  const ids = new Set();
  const built = new Set(edges.filter((e) => !e.rule || e.rule === 'open').map((e) => e.def.id));
  for (const [i, t] of tileList.entries()) {
    const where = `${CORE}: tiles[${i}] (${t?.id})`;
    const bad = checkValue(t, S.tile, where);
    problems.push(...bad);
    if (bad.length) continue;
    if (!new RegExp(`^(${KIT_PREFIXES.join('|')})\\.[a-z][a-z0-9_]*$`).test(t.id)) problems.push(`${where}: id must be ${KIT_PREFIXES.join('., ')}. then lower case letters, digits and _`);
    if (ids.has(t.id)) problems.push(`${where}: id ${t.id} is listed twice`);
    ids.add(t.id);
    if ((t.cells === undefined) === (t.footprint === undefined)) problems.push(`${where}: give one of "cells" or "footprint" ([w, d] or [w, d, levels])`);
    if (t.footprint && (t.footprint.length > 3 || t.footprint.some((n) => n < 1))) problems.push(`${where}: footprint is [w, d] or [w, d, levels], each at least 1`);
    const cells = t.cells ?? (() => {
      const [w, d, h = 1] = t.footprint;
      const out = [];
      for (let z = 0; z < h; z++) for (let y = 0; y < d; y++) for (let x = 0; x < w; x++) out.push([x, y, z]);
      return out;
    })();
    const has = (x, y, z) => cells.some((c) => c[0] === x && c[1] === y && c[2] === z);
    const levels = new Set(cells.map((c) => c[2]));
    for (const f of t.floors) if (!levels.has(f)) problems.push(`${where}: floors: level ${f} isn't one of its cells' levels`);
    for (const [j, p] of t.ports.entries()) {
      const path = `${where}: ports[${j}]`;
      const forms = [p.side !== undefined, p.allSides !== undefined, p.perimeter !== undefined].filter(Boolean).length;
      if (forms !== 1) problems.push(`${path}: one of a port (side, level, cell), allSides (a level) or perimeter ([w, d], levels)`);
      else if (p.side !== undefined) {
        if (p.level === undefined) problems.push(`${path}: "level" is missing`);
        const [cx, cy] = p.cell ?? [0, 0];
        if (!has(cx, cy, p.level ?? 0)) problems.push(`${path}: cell [${cx}, ${cy}] on level ${p.level} isn't one of its cells`);
        if (p.levels || p.allSides !== undefined || p.perimeter) problems.push(`${path}: mixes a port with a shorthand`);
      } else if (p.allSides !== undefined) {
        if (p.level !== undefined || p.cell || p.levels) problems.push(`${path}: allSides is a level on its own`);
        if (!has(0, 0, p.allSides)) problems.push(`${path}: level ${p.allSides} isn't one of its cells' levels`);
      } else {
        if (p.level !== undefined || p.cell || p.side) problems.push(`${path}: perimeter takes only levels`);
        for (const l of p.levels ?? [0]) if (!has(p.perimeter[0] - 1, p.perimeter[1] - 1, l)) problems.push(`${path}: the perimeter ${p.perimeter.join(' × ')} on level ${l} runs past its cells`);
      }
    }
    if (t.edgeDefault !== undefined && (!built.has(t.edgeDefault) || t.edgeDefault === 'auto')) problems.push(`${where}: edgeDefault ${t.edgeDefault} is not an edge style in ${EDGES}`);
    for (const [k, s] of Object.entries(t.edgeDefaults ?? {})) {
      const m = k.match(/^(-?\d+),(-?\d+),(-?\d+):([NESW])$/);
      if (!m) problems.push(`${where}: edgeDefaults key ${k} is "dx,dy,dz:S" (a side of one of its cells)`);
      else if (!has(+m[1], +m[2], +m[3])) problems.push(`${where}: edgeDefaults ${k}: not one of its cells`);
      if (!built.has(s) || s === 'auto') problems.push(`${where}: edgeDefaults ${k}: ${s} is not an edge style in ${EDGES}`);
    }
    if (t.model && !existsSync(join(root, PUBLIC, t.model.file))) problems.push(`${where}: model ${PUBLIC}/${t.model.file} not found`);
    for (const field of ['solids', 'extraFloors']) {
      for (const [j, p] of (t[field] ?? []).entries()) {
        const named = S.builders.filter((b) => p[b] !== undefined);
        if (named.length !== 1) problems.push(`${where}: ${field}[${j}]: name one builder (${S.builders.join(', ')})`);
        if (p.box && !(p.box[0] <= p.box[3] && p.box[1] <= p.box[4] && p.box[2] <= p.box[5])) problems.push(`${where}: ${field}[${j}]: box is [x0, y0, z0, x1, y1, z1] with each min at most its max`);
        if ((p.yaw !== undefined || p.pitch !== undefined || p.roll !== undefined) && !p.box) problems.push(`${where}: ${field}[${j}]: yaw, pitch and roll go on a box`);
        if (p.surface?.tint !== undefined && !/^#[0-9a-f]{6}$/.test(p.surface.tint)) problems.push(`${where}: ${field}[${j}]: surface.tint is a #rrggbb colour (lower case)`);
        if (p.block && !t.footprint) problems.push(`${where}: ${field}[${j}]: a block is centred on a footprint`);
        if (p.vault && !(p.vault.span[0] < p.vault.span[1] && p.vault.along[0] < p.vault.along[1] && p.vault.spring < p.vault.crown)) problems.push(`${where}: ${field}[${j}]: a vault spans [a0, a1] across and [b0, b1] along (each a0 < a1), its crown over its springing`);
      }
    }
    const { notes: tn, $comment: _c, ...spec } = t;
    tiles.push({ spec, notes: tn });
  }

  // Tile options: the plain tile is in this kit, isn't an option itself, has the same cells and ports, and one tile per option.
  const byId = new Map(tileList.map((t) => [t?.id, t]));
  const optionPairs = new Set();
  for (const t of tileList) {
    if (!t?.optionOf) continue;
    const where = `${CORE}: ${t.id} optionOf`;
    const base = byId.get(t.optionOf.tile);
    if (!base) problems.push(`${where}: ${t.optionOf.tile} isn't a tile in ${CORE}`);
    else {
      if (base.optionOf) problems.push(`${where}: ${base.id} is itself an option of another tile`);
      if (JSON.stringify(base.cells ?? base.footprint) !== JSON.stringify(t.cells ?? t.footprint)) problems.push(`${where}: its cells differ from ${base.id}'s`);
      if (JSON.stringify(base.ports) !== JSON.stringify(t.ports)) problems.push(`${where}: its ports differ from ${base.id}'s`);
    }
    const pair = `${t.optionOf.tile} ${t.optionOf.option}`;
    if (optionPairs.has(pair)) problems.push(`${where}: ${t.optionOf.tile} already has a ${t.optionOf.option} tile`);
    optionPairs.add(pair);
  }

  // Maps and Style Packs name tiles and edge styles by id: one they use can't be renamed or removed.
  if (tiles.length === tileList.length && edges.length === edgeList.length) {
    const packPrefixes = codePackPrefixes(root);
    const allEdges = new Set(edges.map((e) => e.def.id));
    const once = new Set();
    for (const [kind, id, where] of namedElsewhere(root)) {
      if (once.has(`${kind} ${id} ${where}`)) continue;
      once.add(`${kind} ${id} ${where}`);
      if (kind === 'edge' && !allEdges.has(id)) problems.push(`${where}: names edge style ${id}, which isn't in ${EDGES} (an edge style id never changes)`);
      if (kind === 'tile') {
        const prefix = id.split('.')[0];
        if (KIT_PREFIXES.includes(prefix) && !ids.has(id) && !packPrefixes.has(prefix)) problems.push(`${where}: names tile ${id}, which isn't in ${CORE} (a tile id never changes)`);
        else if (!KIT_PREFIXES.includes(prefix) && !packPrefixes.has(prefix)) problems.push(`${where}: names tile ${id}: no tile set has the prefix ${prefix}.`);
      }
    }
  }
  return { problems, out: { edges, tiles } };
}

// ---------------------------------------------------------------- render

export function renderEdges(out) {
  const L = [];
  L.push('// Generated by tools/content/tiles.mjs from content/tiles/edges.json. Do not edit by hand: edit the JSON and run');
  L.push('// `node tools/content/tiles.mjs`.');
  L.push("import type { EdgeShape } from '../map/tileOptions.ts';");
  L.push('');
  L.push("/** Every edge style, in MapMaker's order. `auto` and `open` are rules (map/geometry.ts resolveEdge). */");
  L.push(`export const EDGE_STYLES = [${out.edges.map((e) => sq(e.def.id)).join(', ')}] as const;`);
  L.push('');
  L.push('export const EDGE_STYLE_LABELS: Readonly<Record<(typeof EDGE_STYLES)[number], string>> = {');
  for (const e of out.edges) L.push(`  ${e.def.id}: ${sq(e.def.label)},`);
  L.push('};');
  L.push('');
  L.push('/** What each built style is made of: collision segments, trim, openings, dressing (map/geometry.ts reads them). */');
  L.push('export const EDGE_SHAPES: Readonly<Partial<Record<(typeof EDGE_STYLES)[number], EdgeShape>>> = {');
  for (const e of out.edges) if (e.shape) L.push(`${comments(e.notes, '  ')}  ${e.def.id}: ${tsInline(e.shape)},`);
  L.push('};');
  L.push('');
  const list = (name, doc, flag) => {
    L.push(`/** ${doc} */`);
    L.push(`export const ${name} = [${out.edges.filter((e) => e.flags?.[flag]).map((e) => sq(e.def.id)).join(', ')}] as const;`);
  };
  list('GLASS_EDGE_STYLES', 'Styles with window openings glass can fill (sim/glass.ts).', 'glass');
  list('CORNER_EDGE_STYLES', 'Styles a room\'s corner piece can stand against (solid enough at the corner itself).', 'corner');
  list('FACADE_EDGE_STYLES', 'Styles a facade dresses (the outside of a wall).', 'facade');
  list('STREET_EDGE_STYLES', 'Street faces: where a frontier false front gets its awning and boardwalk.', 'street');
  return `${L.join('\n')}\n`;
}

export function renderTiles(out) {
  const L = [];
  L.push('// Generated by tools/content/tiles.mjs from content/tiles/core.json and content/tiles/tunnels.json (the tunnel kit:');
  L.push('// tools/content/kit/tunnel.mjs). Do not edit by hand: edit the JSON and run');
  L.push('// `node tools/content/tiles.mjs`.');
  L.push("import type { TileSpec } from '../map/catalog.ts';");
  L.push('');
  L.push("/** The core building kit, in palette order: map/catalog.ts builds each tile's parts (resolveKitTile). */");
  L.push('export const KIT_TILES: readonly TileSpec[] = [');
  for (const t of out.tiles) L.push(`${comments(t.notes, '  ')}  ${tsInline(t.spec)},`);
  L.push('];');
  return `${L.join('\n')}\n`;
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const { problems, out } = build(load());
  if (problems.length) {
    console.error(`tiles: ${problems.length} problem(s)\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  const files = [[GENERATED_EDGES, renderEdges(out)], [GENERATED_TILES, renderTiles(out)]];
  const stale = files.filter(([f, text]) => !existsSync(join(ROOT, f)) || readFileSync(join(ROOT, f), 'utf8') !== text);
  if (checkOnly) {
    if (stale.length) {
      console.error(`tiles: out of date: ${stale.map(([f]) => f).join(', ')} (run node tools/content/tiles.mjs)`);
      process.exit(1);
    }
  } else for (const [f, text] of stale) writeFileSync(join(ROOT, f), text);
  console.log(`tiles OK: ${out.tiles.length} kit tiles, ${out.edges.length} edge styles${checkOnly ? '' : stale.length ? `; wrote ${stale.map(([f]) => f).join(', ')}` : '; up to date'}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
