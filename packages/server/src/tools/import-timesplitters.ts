/**
 * TimeSplitters 2 / Future Perfect MapMaker importer (first version).
 *
 * Reads the JSON that `tools/import/timesplitters/tsdecode.py` writes for each
 * GameCube save (or runs the decoder itself on .gci files), rebuilds every
 * valid map with ChronoSplit tiles through MapBuilder, validates it (schema,
 * rules and the bot navmesh) and writes maps/imported/<game>_<slug>.json.
 *
 *   npx tsx src/tools/import-timesplitters.ts --decoded <dir with *.gci.json>
 *   npx tsx src/tools/import-timesplitters.ts --gci <dir with .gci files> [--gci <dir>...]
 *   options: --write-table   refresh content/import/timesplitters-mapmaker.json (keeps your edits)
 *            --report <file> write a JSON report of every map (stand-ins, skips, warnings)
 *            --only <slug>   convert one map (by output id, e.g. tsfp_hallway_2)
 *
 * The save is data only: the decoder parses bytes and nothing from it is ever
 * executed. What is exact and what is guessed is in docs/ORIGINAL_MAPS.md and
 * tools/import/timesplitters/FORMAT.md.
 *
 * Scale: one original grid cell becomes one of our 8 m cells, and one original
 * level (z) one of our 4 m levels, re-based so the main area's most common
 * level is our level 0 and centred on the origin. Original +x is our +x (east)
 * and original +y our +y (north); the original's in-game compass is
 * unverified, so a map may come out mirrored.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SIDES, SIDE_DIRS, coreCatalog, edgeKey, localSide, placeTileCommand, rotateSide, rotateXZ, type EdgeStyle, type Rotation, type Side, type TilePlacement, type ValidationIssue } from '@chronosplit/shared';
import { MapBuilder } from './mapkit.ts';

// ---------------------------------------------------------------- decoder JSON

type Game = 'TS2' | 'TSFP';

interface DecodedTile {
  x: number;
  y: number;
  z: number;
  type: number;
  rot: number;
  w: number;
  h: number;
  raw: { cell_links?: [number, number, number][]; b08?: string };
}

interface DecodedItem {
  tile: number;
  x: number;
  y: number;
  z: number;
  kind: number;
}

interface Decoded {
  file: string;
  game: Game | null;
  valid?: boolean;
  error?: string;
  name?: string;
  description?: string;
  briefing?: string;
  tiles?: DecodedTile[];
  items?: DecodedItem[];
  settings?: Record<string, unknown>;
}

// ---------------------------------------------------------------- mapping table

/**
 * How one original tile type becomes ours:
 * - `auto`: each cell becomes one of our corridor pieces (corridor, corner, T,
 *   crossroads, dead end, or a plain room when nothing connects), chosen and
 *   turned by the openings the save shows.
 * - `fill`: every cell of the footprint becomes `tile` (default a plain room),
 *   with no walls inside, so a 3 × 3 original room is one 24 m room.
 * - `tile`: one of our multi-cell tiles with the same footprint, turned by the
 *   original rotation plus `rotationOffset` (clockwise quarter turns).
 * - `skip`: left out.
 * 1 × 1 and 1 × 2 pieces whose ends meet different levels become our stairs
 * (1 cell) or long ramp (2 cells) unless `vertical` is `never`.
 */
type Strategy = 'auto' | 'fill' | 'tile' | 'skip';

interface TableEntry {
  game: Game;
  original: { id: number; name: string | null; category: 'tile'; footprint: [number, number]; cellIds?: number };
  ours: { kind: 'tile'; strategy: Strategy; id: string; rotationOffset: Rotation; vertical?: 'auto' | 'never' };
  /** Original exits in the tile's own frame ("i,j:S" per cell side, x east / y north at rotation 0); null = unknown (connect where the neighbour allows). TS2 only: TSFP saves carry real links. */
  exits: string | null;
  fit: 'exact' | 'close' | 'stand-in';
  confidence: 'confirmed' | 'likely' | 'guess';
  notes: string;
  saves: number;
  placements: number;
}

interface Table {
  about: string;
  scale: string;
  entries: TableEntry[];
}

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const TABLE_PATH = join(ROOT, 'content/import/timesplitters-mapmaker.json');
const DECODER = join(ROOT, 'tools/import/timesplitters/tsdecode.py');
const OUT_DIR = 'imported';

const ALL4 = '0,0:N 0,0:E 0,0:S 0,0:W';

/** Starting guesses per type (from FORMAT.md and the neighbour statistics of the sample saves). */
function defaultEntry(game: Game, id: number, footprint: [number, number]): Omit<TableEntry, 'saves' | 'placements'> {
  const [w, h] = footprint;
  const base = { game, original: { id, name: null, category: 'tile' as const, footprint } };
  const room = (fit: TableEntry['fit'], confidence: TableEntry['confidence'], notes: string, exits: string | null = null): Omit<TableEntry, 'saves' | 'placements'> => ({
    ...base,
    ours: { kind: 'tile', strategy: 'fill', id: 'core.room', rotationOffset: 0 },
    exits,
    fit,
    confidence,
    notes,
  });
  const corridor = (exits: string | null, confidence: TableEntry['confidence'], notes: string, fit: TableEntry['fit'] = 'close'): Omit<TableEntry, 'saves' | 'placements'> => ({
    ...base,
    ours: { kind: 'tile', strategy: 'auto', id: 'core.corridor_clear', rotationOffset: 0 },
    exits,
    fit,
    confidence,
    notes,
  });
  if (game === 'TS2') {
    switch (id) {
      case 1: return corridor('0,0:E 0,0:S', 'confirmed', 'Corner (exits E and S at rotation 0). Ours: Corner.');
      case 2: return corridor('0,0:N 0,0:S', 'confirmed', 'Straight corridor. Ours: Corridor (Clear).');
      case 9: return corridor('0,0:N 0,0:S 0,0:W', 'likely', 'T-junction (N, S, W; the W exit only fits 60% of placements, so it may be a window or a side room). Ours: T-Junction.');
      case 17: return corridor(ALL4, 'confirmed', 'Crossroads. Ours: Crossroads.');
      case 0: return corridor('0,0:S 0,1:N', 'likely', '2-long straight (1 x 2). Becomes two corridor cells; a long ramp when its ends meet different levels.');
      case 14: return corridor('0,0:S 0,1:N', 'likely', '1 x 2 with one same-level exit (S); its N end meets the level above in 61% of placements, so it is most likely stairs up. Ours: Long Ramp when the level above is there, else a dead-end corridor.');
      case 18: return { ...room('close', 'likely', '1 x 3 piece open along its E side with one W exit in the middle: probably a wide corridor / balcony. Filled with plain room cells.', '0,0:E 0,1:E 0,2:E 0,1:W'), original: base.original };
      case 4: return { ...room('stand-in', 'guess', 'Never has same-level neighbours and can overlap a corridor: an overlay or vertical piece (lift? ceiling?). Placed as a plain room where the cells are free, else skipped.'), original: base.original };
      case 10: case 15: case 19: return room('close', 'likely', 'Room-width connector (3 x 1), e.g. the arms of "Plus". Filled with plain room cells, open inside.');
      case 12: case 16: case 21: return room('close', 'likely', `3 x 3 room${id === 21 ? ' (same-level exits N and S; its E side meets the level above in 88% of placements, so it may be a big stair hall)' : id === 16 ? ' (exits on every side)' : ''}. Filled as one open 24 m room.`);
      case 3: case 8: case 28: return room('stand-in', 'guess', '2 x 2 piece of unknown kind. Filled as a 16 m room.');
      default: return room('stand-in', 'guess', `Unknown ${w} x ${h} piece (footprint is an upper bound from overlap tests). Filled as a plain room.`);
    }
  }
  switch (id) {
    case 1: case 6: case 8: case 9: case 14: case 35: case 36: case 37: case 38: case 40:
      return corridor(null, 'likely', 'Corridor-family 1 x 1 piece. Its openings come from the save\'s cell links, so our piece (corridor, corner, T, crossroads, dead end) is chosen per placement; the original shape (and any windows or doors) is unknown.');
    case 17:
      return corridor(null, 'likely', 'The most common piece: a 1 x 1 cell that links to every neighbour, often in big blocks (open courtyards / large halls). Blocks of linked cells become one open area; single runs become corridors. Many placements have no links at all (scenery or the upper half of a tall space; skipped when stacked over another tile).');
    case 30:
      return { ...room('stand-in', 'guess', 'Never has links in any save: scenery or a solid block? Placed as a closed room (no doorways) as a stand-in.'), original: base.original };
    case 42:
      return corridor(null, 'guess', '1 x 1 footprint but 12 cell ids, and many links to the levels below: a tall shaft or tower? Placed as a 1 x 1 piece by its same-level links.', 'stand-in');
    case 15:
      return corridor(null, 'likely', '1 x 1 with 2 cell ids that links to the level above: stairs. Ours: Stairs, turned so the low side faces the same-level link and the high side the upper link.');
    case 2:
      return corridor(null, 'likely', '2 x 1 with 2 cell ids that links to the level above: a ramp or staircase. Ours: Long Ramp.');
    case 0:
      return corridor(null, 'likely', '2-long straight (2 x 1); a long ramp when its links reach the level above.');
    case 27:
      return corridor(null, 'guess', '1 x 1 with 3 cell ids (three levels tall?): a lift or ladder shaft? Placed as a 1 x 1 piece by its same-level links.', 'stand-in');
    case 10: case 18: case 19: case 34:
      return room('close', 'likely', `${w} x ${h} connector. Filled with plain room cells, openings from the cell links.`);
    case 3: case 4: case 5: case 28: case 43: case 44:
      return room('stand-in', 'guess', '2 x 2 piece (footprint guessed). Filled as a 16 m room.');
    case 26: case 29:
      return room('stand-in', 'guess', '5 x 3 piece (footprint guessed). Filled as one room.');
    default:
      return room(w * h === 9 ? 'close' : 'stand-in', w * h === 9 ? 'likely' : 'guess', `${w} x ${h} room (footprint from neighbour spacing). Filled as one open room; openings from the cell links.`);
  }
}

function loadTable(): Table | null {
  if (!existsSync(TABLE_PATH)) return null;
  return JSON.parse(readFileSync(TABLE_PATH, 'utf8')) as Table;
}

/** Merge observed types into the table: new types get the default guess, existing entries keep every edit except the counts. */
function refreshTable(old: Table | null, seen: Map<string, { footprint: [number, number]; saves: Set<string>; placements: number; cellIds?: number }>): Table {
  const byKey = new Map((old?.entries ?? []).map((e) => [`${e.game}:${e.original.id}`, e]));
  const entries: TableEntry[] = [];
  for (const [key, s] of [...seen].sort(([a], [b]) => (a.split(':')[0]!.localeCompare(b.split(':')[0]!) || Number(a.split(':')[1]) - Number(b.split(':')[1])))) {
    const [game, id] = key.split(':') as [Game, string];
    const prev = byKey.get(key);
    const e: TableEntry = prev ? { ...prev } : { ...defaultEntry(game, Number(id), s.footprint), saves: 0, placements: 0 };
    e.saves = s.saves.size;
    e.placements = s.placements;
    if (s.cellIds !== undefined) e.original = { ...e.original, cellIds: s.cellIds };
    entries.push(e);
  }
  return {
    about:
      'TimeSplitters 2 / Future Perfect MapMaker tile types -> ChronoSplit tiles, used by packages/server/src/tools/import-timesplitters.ts. One entry per observed type id per game. Edit ours/exits/fit/confidence/notes as controlled test saves confirm pieces; `saves` and `placements` are refreshed by --write-table. Original names are unknown until confirmed (null).',
    scale: 'One original grid cell = one 8 m ChronoSplit cell; one original level (z) = one 4 m level; original +x/+y = our +x (east)/+y (north), compass unverified. Rotation: original quarter turns are counter-clockwise, ours clockwise.',
    entries,
  };
}

// ---------------------------------------------------------------- geometry helpers

const key3 = (x: number, y: number, z: number) => `${x},${y},${z}`;
const OPP: Record<Side, Side> = { N: 'S', E: 'W', S: 'N', W: 'E' };
/** Turn a side counter-clockwise by r quarter turns (the original's rotation sense). */
const ccw = (s: Side, r: number): Side => SIDES[(SIDES.indexOf(s) - (r & 3) + 8) % 4]!;

/** World cell of local (i, j) for a footprint w × h anchored at its min corner with CCW rotation (as the decoder). */
function fpCell(t: { x: number; y: number; rot: number }, w: number, h: number, i: number, j: number): [number, number] {
  const r = t.rot & 3;
  const [dx, dy] = r === 0 ? [i, j] : r === 1 ? [h - 1 - j, i] : r === 2 ? [w - 1 - i, h - 1 - j] : [j, w - 1 - i];
  return [t.x + dx, t.y + dy];
}

/** Our tile with `rot` whose rotated footprint's min corner is (x, y): returns the anchor (local 0,0 cell). */
function anchorForMinCorner(tile: string, rot: Rotation, x: number, y: number): [number, number] {
  const def = coreCatalog.get(tile)!;
  let mx = Infinity;
  let my = Infinity;
  for (const [dx, dy] of def.cells) {
    const [rx, ry] = rotateXZ(dx, dy, rot);
    mx = Math.min(mx, rx);
    my = Math.min(my, ry);
  }
  return [x - mx, y - my];
}

/** The rotation that turns a set of local port sides into the wanted world sides, if any. */
function rotationFor(localPorts: Side[], world: Set<Side>): Rotation | null {
  for (let r = 0; r < 4; r++) {
    const s = new Set(localPorts.map((p) => rotateSide(p, r)));
    if (s.size === world.size && [...world].every((x) => s.has(x))) return r as Rotation;
  }
  return null;
}

// ---------------------------------------------------------------- conversion

interface Plan {
  ts: number; // index of the original tile
  kind: 'cell' | 'vertical' | 'tile';
  tile: string;
  rotation: Rotation;
  /** Anchor of our placement (local 0,0 cell). */
  x: number;
  y: number;
  z: number;
  /** Our cells: world cell -> local [dx, dy, dz]. */
  cells: Map<string, [number, number, number]>;
  /** Vertical pieces: the low port (world cell at the lower level + side) and the high port. */
  low?: { cell: string; side: Side };
  high?: { cell: string; side: Side };
  /** For `cell` plans picked by connections. */
  auto?: boolean;
  /** Original-local (i, j) of this cell (cell plans). */
  local?: [number, number];
  standIn?: boolean;
}

interface MapReport {
  file: string;
  game: Game;
  name: string;
  id?: string;
  status: 'converted' | 'skipped';
  reason?: string;
  tiles: number;
  placed: number;
  ourTiles: number;
  standIns: Record<string, number>;
  skippedTiles: string[];
  verticals: number;
  pickups: number;
  spawns: number;
  theme: string;
  warnings: string[];
}

const SAFE_FLOOR = new Set(['core.room', 'core.corridor_clear', 'core.corner', 'core.junction_t', 'core.junction_x', 'core.dead_end', 'core.yard']);

/** A balanced default set of pickups, handed out in this order (weapons, then health/armour/ammo between them). */
const PICKUP_ROTATION = [
  'weapon_smg', 'health_small', 'weapon_auto_shotgun', 'ammo', 'armor_small', 'weapon_burst_rifle', 'health_large', 'weapon_marksman',
  'ammo', 'weapon_flak', 'armor_large', 'weapon_rockets', 'health_small', 'ammo_explosive', 'weapon_lmg', 'weapon_railgun',
  'armor_small', 'weapon_shotgun', 'ammo', 'health_small', 'weapon_launcher', 'weapon_plasma', 'ammo', 'grenades',
];

const THEME_WORDS: [RegExp, string][] = [
  [/\b(egypt|egyptian|egyptology|horus|bastet|pharaoh|tombs?|mummy|mummies|sphinx|desert|pyramids?)\b/i, 'tomb'],
  [/\b(ice|icy|arctic|antarctic|snow|frost|frozen)\b/i, 'arctic'],
  [/\b(fire|volcano|lava|infernal|hell|daemonic|demons?|inferno)\b/i, 'volcano'],
  [/\b(aliens?|space|station|stargate|cyber\w*|sentrybot|robots?|vr|planet|ufo|time jump|zenyatta\w*|vimana)\b/i, 'station'],
  [/\b(lab|labs|rats|research|hazard|biohazard|parasol|experiments?|toxic|reactor|atomic|nuclear|silo)\b/i, 'lab'],
  [/\b(gothic|manor|catacombs?|crypts?|haunted|zombies?|spooky|spookiest|priests?|religion|witch|purgatory|graveyard|ghosts?|cabin)\b/i, 'manor'],
  [/\b(castle|fortress|dungeon|keep|knights?|labyrinth\w*|maze)\b/i, 'castle'],
  [/\b(temple|shrine|ritual|ruins|aztec|jungle|blossom|romulus|roman|senate|gargoyle\w*)\b/i, 'temple'],
  [/\b(alamo|saloon|western|frontier|cowboys?)\b/i, 'saloon'],
  [/\b(bunker|base|outpost|military|trench(es)?|assault|armor|army|sniper\w*|squad|soldiers?|core)\b/i, 'bunker'],
  [/\b(factory|warehouse|basement|industrial|gas station|garage|complex|vault|upstairs|stack)\b/i, 'factory'],
  [/\b(city|street|neon|downtown|racer|race|carmageddon|duck|duckman)\b/i, 'city'],
];
const FALLBACK_THEMES = ['bunker', 'factory', 'castle', 'lab', 'station', 'manor'];

function pickTheme(d: Decoded): { theme: string; why: string } {
  // The name first (it is what the author chose), then the description and briefing.
  for (const text of [d.name ?? '', `${d.description ?? ''} ${d.briefing ?? ''}`]) {
    for (const [re, theme] of THEME_WORDS) {
      const m = re.exec(text);
      if (m) return { theme, why: `keyword "${m[0].trim()}"` };
    }
  }
  // TS2 settings +0x08 is a guessed tileset field (0..4); otherwise a stable pick from the name.
  const guess = d.game === 'TS2' ? Number((d.settings as { u16_08_theme_guess?: number } | undefined)?.u16_08_theme_guess ?? NaN) : NaN;
  if (Number.isFinite(guess)) return { theme: FALLBACK_THEMES[guess % FALLBACK_THEMES.length]!, why: `guessed tileset field = ${guess}` };
  let hsh = 0;
  for (const c of d.name ?? '') hsh = (hsh * 31 + c.charCodeAt(0)) >>> 0;
  return { theme: FALLBACK_THEMES[hsh % FALLBACK_THEMES.length]!, why: 'no keyword: picked from the name' };
}

function cleanText(s: string | undefined): string {
  return (s ?? '')
    .replace(/[^\x20-\x7e\n]/g, '')
    .split('\n')
    .map((l) => l.replace(/\s{2,}/g, ' ').trim())
    .filter((l) => l && !/^[_\-=*. ]+$/.test(l))
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

/** Cell ids each TSFP tile type takes in the link numbering (the most common step between consecutive tiles). */
function learnCellIds(maps: Decoded[]): Map<number, number> {
  const gaps = new Map<number, Map<number, number>>();
  for (const d of maps) {
    if (d.game !== 'TSFP') continue;
    const tiles = d.tiles!;
    for (let i = 0; i + 1 < tiles.length; i++) {
      const a = tiles[i]!.raw.cell_links ?? [];
      const b = tiles[i + 1]!.raw.cell_links ?? [];
      if (!a.length || !b.length) continue;
      const gap = Math.min(...b.map((l) => l[0])) - Math.min(...a.map((l) => l[0]));
      const m = gaps.get(tiles[i]!.type) ?? new Map<number, number>();
      m.set(gap, (m.get(gap) ?? 0) + 1);
      gaps.set(tiles[i]!.type, m);
    }
  }
  const out = new Map<number, number>();
  for (const [t, m] of gaps) out.set(t, [...m].sort((a, b) => b[1] - a[1])[0]![0]);
  return out;
}

interface Converted {
  report: MapReport;
  builder?: MapBuilder;
}

function convert(d: Decoded, id: string, table: Map<string, TableEntry>, cellIds: Map<number, number>): Converted {
  const game = d.game!;
  const tiles = d.tiles!;
  const name = (d.name ?? '').trim() || d.file.replace(/\..*$/, '');
  const report: MapReport = { file: d.file, game, name, id, status: 'converted', tiles: tiles.length, placed: 0, ourTiles: 0, standIns: {}, skippedTiles: [], verticals: 0, pickups: 0, spawns: 0, theme: '', warnings: [] };
  const entryOf = (t: DecodedTile) => table.get(`${game}:${t.type}`);
  const sizeOf = (t: DecodedTile): [number, number] => entryOf(t)?.original.footprint ?? [t.w, t.h];
  const tsCells = tiles.map((t) => {
    const [w, h] = sizeOf(t);
    const out: { i: number; j: number; x: number; y: number }[] = [];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const [x, y] = fpCell(t, w, h, i, j);
      out.push({ i, j, x, y });
    }
    return out;
  });
  // Original occupancy (first tile wins; the TSFP stacking glitch leaves exact duplicates).
  const tsOcc = new Map<string, number>();
  tiles.forEach((t, k) => tsCells[k]!.forEach((c) => tsOcc.has(key3(c.x, c.y, t.z)) || tsOcc.set(key3(c.x, c.y, t.z), k)));

  // ------------------------------------------------ TSFP links: which original tiles connect, and where
  const linked = new Map<number, Set<number>>();
  const precise = new Set<string>(); // "x,y,z|x,y,z" same-level cell pairs the links name exactly
  const preciseTiles = new Set<string>(); // tile pairs with at least one exact pair
  const linkTo = (a: number, b: number) => {
    if (a === b) return;
    (linked.get(a) ?? linked.set(a, new Set()).get(a)!).add(b);
    (linked.get(b) ?? linked.set(b, new Set()).get(b)!).add(a);
  };
  if (game === 'TSFP') {
    const owner = new Map<number, number>();
    tiles.forEach((t, k) => (t.raw.cell_links ?? []).forEach(([a]) => owner.has(a) || owner.set(a, k)));
    // Cell ids are handed out tile by tile from 1001, row by row over the footprint.
    const base: number[] = [];
    let next = 1001;
    tiles.forEach((t, k) => {
      const own = (t.raw.cell_links ?? []).map((l) => l[0]);
      const n = cellIds.get(t.type) ?? sizeOf(t)[0] * sizeOf(t)[1];
      let b = next;
      if (own.length && !(b <= Math.min(...own) && Math.max(...own) < b + n)) b = Math.max(...own) - Math.min(...own) < n ? Math.min(...own) : Math.max(b, Math.max(...own) - n + 1);
      base[k] = b;
      next = b + n;
    });
    const cellOf = (k: number, cid: number): string | null => {
      const t = tiles[k]!;
      const [w, h] = sizeOf(t);
      const idx = cid - base[k]!;
      if (idx < 0 || idx >= w * h) return null;
      const [x, y] = fpCell(t, w, h, idx % w, Math.floor(idx / w));
      return key3(x, y, t.z);
    };
    tiles.forEach((t, k) => {
      for (const [a, b] of t.raw.cell_links ?? []) {
        const j = owner.get(b);
        if (j === undefined || tiles[j]!.z !== t.z) {
          if (j !== undefined && tiles[j]!.z === t.z + 1) linkTo(k, j); // upward links: stairs and ramps
          continue;
        }
        linkTo(k, j);
        const ca = cellOf(k, a);
        const cb = cellOf(j, b);
        if (ca && cb) {
          const [ax, ay] = ca.split(',').map(Number) as [number, number];
          const [bx, by] = cb.split(',').map(Number) as [number, number];
          if (Math.abs(ax - bx) + Math.abs(ay - by) === 1) {
            precise.add(`${ca}|${cb}`).add(`${cb}|${ca}`);
            preciseTiles.add(`${k}|${j}`).add(`${j}|${k}`);
          }
        }
      }
    });
  }
  const tsLinked = (a: number, b: number) => linked.get(a)?.has(b) ?? false;

  /** TS2: does original tile k have an exit at local cell (i, j) on world side s? null = unknown. */
  const exitAt = (k: number, i: number, j: number, s: Side): boolean | null => {
    const e = entryOf(tiles[k]!)?.exits;
    if (e == null) return null;
    const local = ccw(s, -(tiles[k]!.rot & 3)); // undo the original's CCW turn
    return e.split(/\s+/).includes(`${i},${j}:${local}`);
  };

  // ------------------------------------------------ plans
  const plans: Plan[] = [];
  const occ = new Map<string, number>(); // our cell -> plan index
  const free = (cells: string[]) => cells.every((c) => !occ.has(c));
  const claim = (p: Plan) => {
    const idx = plans.push(p) - 1;
    for (const c of p.cells.keys()) occ.set(c, idx);
  };
  const standIn = (label: string) => (report.standIns[label] = (report.standIns[label] ?? 0) + 1);

  /** A vertical reading of a 1 × 1 or 1 × 2 tile: low end at one level, high end one level up. */
  const vertical = (k: number): { low: [number, number]; lowSide: Side; high: [number, number]; highSide: Side; zl: number } | null => {
    const t = tiles[k]!;
    const cells = tsCells[k]!;
    if (cells.length > 2) return null;
    const ends: { cell: [number, number]; side: Side }[] = [];
    if (cells.length === 1) for (const s of SIDES) ends.push({ cell: [cells[0]!.x, cells[0]!.y], side: s });
    else {
      const [a, b] = cells as [{ x: number; y: number }, { x: number; y: number }];
      const dir = SIDES.find((s) => SIDE_DIRS[s][0] === b.x - a.x && SIDE_DIRS[s][1] === b.y - a.y)!;
      ends.push({ cell: [a.x, a.y], side: OPP[dir] }, { cell: [b.x, b.y], side: dir });
    }
    const at = (c: [number, number], s: Side, dz: number) => {
      const [dx, dy] = SIDE_DIRS[s];
      const n = tsOcc.get(key3(c[0] + dx, c[1] + dy, t.z + dz));
      return n === undefined || n === k ? undefined : n;
    };
    const joins = (n: number | undefined, c: [number, number], s: Side) => {
      if (n === undefined) return false;
      if (game === 'TSFP') return tsLinked(k, n);
      const local = cells.find((q) => q.x === c[0] && q.y === c[1])!;
      return exitAt(k, local.i, local.j, s) !== false;
    };
    for (const lo of ends) {
      for (const hi of ends) {
        if (lo === hi || hi.side !== OPP[lo.side] || (cells.length === 2 && lo.cell === hi.cell)) continue;
        // Up: low end on this level, high end meets the level above (and nothing on this level there).
        const same = at(lo.cell, lo.side, 0);
        const up = at(hi.cell, hi.side, 1);
        const level = at(hi.cell, hi.side, 0);
        // TSFP: a tile on this level beside the high end is fine as long as the stairs do not link to it (it gets a wall).
        const highClear = game === 'TSFP' ? level === undefined || !tsLinked(k, level) : level === undefined;
        if (joins(same, lo.cell, lo.side) && highClear && up !== undefined && (game === 'TSFP' ? tsLinked(k, up) : true)) {
          return { low: lo.cell, lowSide: lo.side, high: hi.cell, highSide: hi.side, zl: t.z };
        }
        // Down (TS2 only; TSFP stairs link upward themselves): high end on this level, low end meets the level below.
        if (game === 'TS2') {
          const down = at(lo.cell, lo.side, -1);
          const level = at(hi.cell, hi.side, 0);
          if (down !== undefined && at(lo.cell, lo.side, 0) === undefined && joins(level, hi.cell, hi.side)) {
            return { low: lo.cell, lowSide: lo.side, high: hi.cell, highSide: hi.side, zl: t.z - 1 };
          }
        }
      }
    }
    return null;
  };

  tiles.forEach((t, k) => {
    const entry = entryOf(t);
    const strategy = entry?.ours.strategy ?? 'fill';
    const label = `${game} type ${t.type} at ${t.x},${t.y},${t.z}`;
    if (strategy === 'skip') return void report.skippedTiles.push(`${label}: skipped by the mapping table`);
    if (!entry) standIn(`type ${t.type} (not in the table)`);
    else if (entry.fit === 'stand-in') standIn(`type ${t.type}`);
    // TSFP tiles without any link that sit right over another tile: the upper half of a tall space (or scenery). Skip.
    if (game === 'TSFP' && !(t.raw.cell_links ?? []).length && tsCells[k]!.every((c) => tsOcc.has(key3(c.x, c.y, t.z - 1)))) {
      return void report.skippedTiles.push(`${label}: no links and stacked over another tile (upper storey / scenery)`);
    }
    // Stairs and ramps.
    const v = entry?.ours.vertical === 'never' ? null : vertical(k);
    if (v) {
      const two = tsCells[k]!.length === 2;
      const tile = two ? 'core.ramp' : 'core.stairs';
      // Our stairs and ramp climb from local W (low) to local E (high): turn local E onto the climbing direction.
      const rotation = SIDES.findIndex((_, r) => rotateSide('E', r) === v.highSide) as Rotation;
      const [ax, ay] = v.low;
      const def = coreCatalog.get(tile)!;
      const cells = new Map<string, [number, number, number]>();
      for (const [dx, dy, dz] of def.cells) {
        const [rx, ry] = rotateXZ(dx, dy, rotation);
        cells.set(key3(ax + rx, ay + ry, v.zl + dz), [dx, dy, dz]);
      }
      const ok = free([...cells.keys()]) && [...cells.keys()].every((c) => {
        const o = tsOcc.get(c);
        return o === undefined || o === k;
      });
      if (ok) {
        report.verticals++;
        return void claim({ ts: k, kind: 'vertical', tile, rotation, x: ax, y: ay, z: v.zl, cells, low: { cell: key3(v.low[0], v.low[1], v.zl), side: v.lowSide }, high: { cell: key3(v.high[0], v.high[1], v.zl + 1), side: v.highSide } });
      }
      report.warnings.push(`${label}: stairs would collide with other tiles; kept flat`);
    }
    if (strategy === 'tile' && entry && coreCatalog.get(entry.ours.id)) {
      const rotation = (((4 - (t.rot & 3)) % 4) + entry.ours.rotationOffset) % 4 as Rotation;
      const minX = Math.min(...tsCells[k]!.map((c) => c.x));
      const minY = Math.min(...tsCells[k]!.map((c) => c.y));
      const [ax, ay] = anchorForMinCorner(entry.ours.id, rotation, minX, minY);
      const cells = new Map<string, [number, number, number]>();
      for (const [dx, dy, dz] of coreCatalog.get(entry.ours.id)!.cells) {
        const [rx, ry] = rotateXZ(dx, dy, rotation);
        cells.set(key3(ax + rx, ay + ry, t.z + dz), [dx, dy, dz]);
      }
      if (free([...cells.keys()])) return void claim({ ts: k, kind: 'tile', tile: entry.ours.id, rotation, x: ax, y: ay, z: t.z, cells });
      report.warnings.push(`${label}: ${entry.ours.id} does not fit; filled with rooms`);
    }
    // One of our cells per original cell.
    const fillTile = strategy === 'fill' && entry && coreCatalog.get(entry.ours.id)?.cells.length === 1 ? entry.ours.id : 'core.room';
    let placed = 0;
    for (const c of tsCells[k]!) {
      const key = key3(c.x, c.y, t.z);
      if (occ.has(key)) continue;
      claim({ ts: k, kind: 'cell', tile: fillTile, rotation: 0, x: c.x, y: c.y, z: t.z, cells: new Map([[key, [0, 0, 0]]]), auto: strategy === 'auto', local: [c.i, c.j] });
      placed++;
    }
    if (!placed) report.skippedTiles.push(`${label}: every cell already taken (overlap)`);
    else if (placed < tsCells[k]!.length) report.warnings.push(`${label}: ${tsCells[k]!.length - placed} of its cells overlap other tiles`);
  });

  // ------------------------------------------------ connections between our cells
  const cellPlan = (c: string) => occ.get(c);
  /** Does plan p allow a connection out of our cell c on side s? (Stairs and ramps only at their two ports.) */
  const portOk = (p: Plan, c: string, s: Side): boolean => {
    if (p.kind === 'vertical') return (p.low!.cell === c && p.low!.side === s) || (p.high!.cell === c && p.high!.side === s);
    if (p.kind === 'tile') {
      const def = coreCatalog.get(p.tile)!;
      const [lx, ly, lz] = p.cells.get(c)!;
      const ls = localSide(s, p.rotation);
      return def.ports.some((q) => q.level === lz && (q.cell?.[0] ?? 0) === lx && (q.cell?.[1] ?? 0) === ly && q.side === ls);
    }
    return true;
  };
  const tsCellLocal = (k: number, c: string) => {
    const [x, y] = c.split(',').map(Number) as [number, number];
    return tsCells[k]!.find((q) => q.x === x && q.y === y);
  };
  const connected = new Map<string, boolean>(); // "cell:side"
  const decide = (a: string, s: Side, b: string): boolean => {
    const pa = plans[cellPlan(a)!]!;
    const pb = plans[cellPlan(b)!]!;
    if (pa.ts === pb.ts) return pa.kind !== 'vertical'; // inside one original piece
    if (!portOk(pa, a, s) || !portOk(pb, b, OPP[s])) return false;
    if (game === 'TSFP') {
      if (!tsLinked(pa.ts, pb.ts)) return false;
      if (pa.kind !== 'vertical' && pb.kind !== 'vertical' && preciseTiles.has(`${pa.ts}|${pb.ts}`)) return precise.has(`${a}|${b}`);
      return true;
    }
    const ea = pa.kind === 'vertical' ? null : (() => {
      const l = tsCellLocal(pa.ts, a);
      return l ? exitAt(pa.ts, l.i, l.j, s) : null;
    })();
    const eb = pb.kind === 'vertical' ? null : (() => {
      const l = tsCellLocal(pb.ts, b);
      return l ? exitAt(pb.ts, l.i, l.j, OPP[s]) : null;
    })();
    if (ea === false || eb === false) return false;
    // Two pieces whose exits are both unknown: connect only rooms (multi-cell), not two unknown 1 × 1 pieces.
    if (ea === null && eb === null) return tsCells[pa.ts]!.length > 1 || tsCells[pb.ts]!.length > 1 || pa.kind === 'vertical' || pb.kind === 'vertical';
    return true;
  };
  for (const c of occ.keys()) {
    const [x, y, z] = c.split(',').map(Number) as [number, number, number];
    for (const s of SIDES) {
      const [dx, dy] = SIDE_DIRS[s];
      const n = key3(x + dx, y + dy, z);
      if (!occ.has(n) || occ.get(n) === occ.get(c)) continue;
      if (connected.has(`${c}:${s}`)) continue;
      const v = decide(c, s, n) && decide(n, OPP[s], c);
      connected.set(`${c}:${s}`, v);
      connected.set(`${n}:${OPP[s]}`, v);
    }
  }
  const conn = (c: string, s: Side) => connected.get(`${c}:${s}`) === true;
  // Open areas: a cell is part of one when a 2 × 2 block round it is connected all the way round.
  const openArea = new Set<string>();
  for (const c of occ.keys()) {
    const [x, y, z] = c.split(',').map(Number) as [number, number, number];
    const k00 = c;
    const k10 = key3(x + 1, y, z);
    const k01 = key3(x, y + 1, z);
    const k11 = key3(x + 1, y + 1, z);
    if (![k10, k01, k11].every((q) => occ.has(q))) continue;
    if ([k00, k10, k01, k11].some((q) => plans[occ.get(q)!]!.kind === 'vertical')) continue;
    const inner = (a: string, s: Side, b: string) => occ.get(a) === occ.get(b) || conn(a, s);
    if (inner(k00, 'E', k10) && inner(k00, 'N', k01) && inner(k10, 'N', k11) && inner(k01, 'E', k11)) for (const q of [k00, k10, k01, k11]) openArea.add(q);
  }

  // ------------------------------------------------ choose our pieces and wall styles
  const CORRIDOR_PIECES: [string, Side[]][] = [
    ['core.dead_end', ['N']],
    ['core.corridor_clear', ['N', 'S']],
    ['core.corner', ['N', 'E']],
    ['core.junction_t', ['N', 'E', 'W']],
    ['core.junction_x', ['N', 'E', 'S', 'W']],
  ];
  for (const p of plans) {
    if (p.kind !== 'cell' || !p.auto) continue;
    const c = [...p.cells.keys()][0]!;
    const open = new Set(SIDES.filter((s) => conn(c, s)));
    if (openArea.has(c) || open.size === 0) {
      p.tile = 'core.room';
      continue;
    }
    for (const [tile, ports] of CORRIDOR_PIECES) {
      const r = rotationFor(ports, open);
      if (r !== null) {
        p.tile = tile;
        p.rotation = r;
        break;
      }
    }
  }
  const multi = (p: Plan) => tsCells[p.ts]!.length > 1 && p.kind !== 'vertical';
  const styleFor = (a: string, s: Side, b: string): EdgeStyle => {
    const pa = plans[occ.get(a)!]!;
    const pb = plans[occ.get(b)!]!;
    if (!conn(a, s)) return 'wall';
    if (pa.ts === pb.ts || (openArea.has(a) && openArea.has(b))) return 'open';
    if (multi(pa) && multi(pb)) return 'wide';
    return 'door';
  };
  /** Whether our piece has a port on world side s of cell c (what the `auto` wall rule looks at). */
  const hasPort = (p: Plan, c: string, s: Side): boolean => {
    const [lx, ly, lz] = p.cells.get(c)!;
    const ls = localSide(s, p.rotation);
    return coreCatalog.get(p.tile)!.ports.some((q) => q.level === lz && (q.cell?.[0] ?? 0) === lx && (q.cell?.[1] ?? 0) === ly && q.side === ls);
  };
  const placements: TilePlacement[] = [];
  const b = new MapBuilder(id, name.slice(0, 80));
  plans.forEach((p, pi) => {
    const edges: Record<string, EdgeStyle> = {};
    for (const [c, local] of p.cells) {
      const [x, y, z] = c.split(',').map(Number) as [number, number, number];
      for (const s of SIDES) {
        const [dx, dy] = SIDE_DIRS[s];
        const n = key3(x + dx, y + dy, z);
        const pn = occ.get(n);
        // One choice per shared wall (the resolver reads the neighbour's), stored on the earlier piece.
        if (pn === undefined || pn <= pi) continue;
        const style = styleFor(c, s, n);
        // Leave it `auto` when the classic rule already builds the same thing (doorway where ports meet, else a wall).
        const ports = hasPort(p, c, s) && hasPort(plans[pn]!, n, OPP[s]);
        if ((style === 'door' && ports) || (style === 'wall' && !ports)) continue;
        edges[edgeKey(local, localSide(s, p.rotation))] = style;
      }
    }
    placements.push({ id: b.newId('tile'), tile: p.tile, x: p.x, y: p.y, z: p.z, rotation: p.rotation, ...(Object.keys(edges).length ? { edges } : {}) });
  });
  report.placed = new Set(plans.map((p) => p.ts)).size;
  report.ourTiles = placements.length;

  // ------------------------------------------------ centre the map on the origin
  const xs = plans.flatMap((p) => [...p.cells.keys()].map((c) => Number(c.split(',')[0])));
  const ys = plans.flatMap((p) => [...p.cells.keys()].map((c) => Number(c.split(',')[1])));
  if (!xs.length) return { report: { ...report, status: 'skipped', reason: 'no tiles could be placed' } };
  const ox = Math.round((Math.min(...xs) + Math.max(...xs)) / 2);
  const oy = Math.round((Math.min(...ys) + Math.max(...ys)) / 2);

  // ------------------------------------------------ walkable graph, main area, spawns and pickups
  const parent = new Map<string, string>();
  const find = (a: string): string => {
    let r = a;
    while (parent.get(r) !== r) r = parent.get(r)!;
    parent.set(a, r);
    return r;
  };
  const union = (a: string, c: string) => parent.set(find(a), find(c));
  for (const c of occ.keys()) parent.set(c, c);
  for (const p of plans) {
    const cs = [...p.cells.keys()];
    if (p.kind !== 'cell') for (const c of cs.slice(1)) union(cs[0]!, c);
  }
  for (const [ks, v] of connected) {
    if (!v) continue;
    const [c, s] = ks.split(':') as [string, Side];
    const [x, y, z] = c.split(',').map(Number) as [number, number, number];
    union(c, key3(x + SIDE_DIRS[s][0], y + SIDE_DIRS[s][1], z));
  }
  const flat = [...occ.keys()].filter((c) => {
    const p = plans[occ.get(c)!]!;
    return p.kind === 'cell' && SAFE_FLOOR.has(p.tile);
  });
  const sizes = new Map<string, number>();
  for (const c of flat) sizes.set(find(c), (sizes.get(find(c)) ?? 0) + 1);
  const main = [...sizes].sort((a, b2) => b2[1] - a[1])[0]?.[0];
  const area = flat.filter((c) => find(c) === main);
  if (area.length < 2) return { report: { ...report, status: 'skipped', reason: `the largest connected area has ${area.length} floor cell(s)` } };
  const unreachable = flat.length - area.length;
  if (unreachable) report.warnings.push(`${unreachable} of ${flat.length} floor cells are not connected to the main area (no entities placed there)`);
  // The main area's most common level becomes our level 0 (the original's z is kept relative to it).
  const levels = new Map<number, number>();
  for (const c of area) levels.set(Number(c.split(',')[2]), (levels.get(Number(c.split(',')[2])) ?? 0) + 1);
  const oz = [...levels].sort((a, b2) => b2[1] - a[1] || a[0] - b2[0])[0]![0];
  for (const pl of placements) {
    pl.x -= ox;
    pl.y -= oy;
    pl.z -= oz;
  }
  // Every placement must pass the editor's own overlap check, one by one, as MapMaker would.
  for (const pl of placements) {
    const r = placeTileCommand(b.doc, pl.tile, pl.x, pl.y, pl.z, pl.rotation);
    if ('error' in r) return { report: { ...report, status: 'skipped', reason: `tile ${pl.tile} at ${pl.x},${pl.y},${pl.z}: ${r.error}` } };
    b.history.execute('Place tile', { kind: 'addTiles', tiles: [{ ...r.placement, id: pl.id, ...(pl.edges ? { edges: pl.edges } : {}) }] });
  }
  const world = (c: string, off: [number, number] = [0, 0]): [number, number, number] => {
    const [x, y, z] = c.split(',').map(Number) as [number, number, number];
    const { cellSize, levelHeight } = b.doc.classicStructure;
    return [(x - ox) * cellSize + off[0], (z - oz) * levelHeight, (y - oy) * cellSize + off[1]];
  };
  // Farthest-point sampling over the main area (deterministic: start from the first cell in save order).
  const dist2 = (a: string, c: string) => {
    const [ax, ay, az] = a.split(',').map(Number) as [number, number, number];
    const [cx, cy, cz] = c.split(',').map(Number) as [number, number, number];
    return (ax - cx) ** 2 + (ay - cy) ** 2 + (2 * (az - cz)) ** 2;
  };
  const spread = (pool: string[], n: number, avoid: string[] = []): string[] => {
    const out: string[] = [];
    const taken = [...avoid];
    const cand = [...pool];
    while (out.length < n && cand.length) {
      let best = 0;
      let bestD = -1;
      cand.forEach((c, i) => {
        const dd = taken.length ? Math.min(...taken.map((t) => dist2(c, t))) : -i;
        if (dd > bestD) (bestD = dd), (best = i);
      });
      const [c] = cand.splice(best, 1);
      out.push(c!);
      taken.push(c!);
    }
    return out;
  };
  // Pickups where the original had items (their kinds are unknown, so the set is our balanced default).
  const itemCells: string[] = [];
  for (const it of d.items ?? []) {
    const t = tiles[it.tile];
    if (!t) continue;
    for (const c of tsCells[it.tile]!) {
      const kc = key3(c.x, c.y, t.z);
      if (area.includes(kc) && !itemCells.includes(kc)) {
        itemCells.push(kc);
        break;
      }
    }
  }
  const nSpawns = Math.max(4, Math.min(12, Math.round(area.length / 3)));
  const spawnCells = spread(area.filter((c) => !itemCells.includes(c)).length >= nSpawns ? area.filter((c) => !itemCells.includes(c)) : area, nSpawns);
  const nPickups = Math.max(6, Math.min(20, itemCells.length || Math.round(area.length / 3)));
  const pickupCells = [...spread(itemCells, Math.min(nPickups, itemCells.length), spawnCells)];
  if (pickupCells.length < nPickups) pickupCells.push(...spread(area.filter((c) => !pickupCells.includes(c)), nPickups - pickupCells.length, [...spawnCells, ...pickupCells]));
  for (const c of spawnCells) {
    const open = SIDES.filter((s) => conn(c, s));
    const facing = open[0] ?? 'N';
    const yaw = { N: 0, E: Math.PI / 2, S: Math.PI, W: -Math.PI / 2 }[facing];
    const shared = pickupCells.includes(c);
    b.spawn(world(c, shared ? [-2, -2] : [0, 0]), yaw);
  }
  pickupCells.forEach((c, i) => {
    const shared = spawnCells.includes(c);
    b.pickup(PICKUP_ROTATION[i % PICKUP_ROTATION.length]!, world(c, shared ? [2, 2] : [0, 0]));
  });
  report.spawns = spawnCells.length;
  report.pickups = pickupCells.length;
  if (!(d.items ?? []).length) report.warnings.push('the save has no items: pickups spread evenly');

  // ------------------------------------------------ theme and metadata
  const { theme, why } = pickTheme(d);
  b.theme(theme);
  report.theme = `${theme} (${why})`;
  const gameName = game === 'TS2' ? 'TimeSplitters 2' : 'TimeSplitters: Future Perfect';
  const desc = cleanText(d.description);
  const credit = `Imported from a ${gameName} MapMaker save.`;
  b.meta({
    description: `${desc ? `${desc}${/[.!?]$/.test(desc) ? '' : '.'} ` : ''}${credit}`.slice(0, 2000),
    modes: ['core.deathmatch'],
    players: [2, Math.max(2, Math.min(12, spawnCells.length))],
    author: '', // the saves store no author
  });
  return { report, builder: b };
}

// ---------------------------------------------------------------- driver

function args(): { decoded: string[]; gci: string[]; writeTable: boolean; report?: string; only?: string } {
  const a = process.argv.slice(2);
  const out: ReturnType<typeof args> = { decoded: [], gci: [], writeTable: false };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--decoded') out.decoded.push(a[++i]!);
    else if (a[i] === '--gci') out.gci.push(a[++i]!);
    else if (a[i] === '--write-table') out.writeTable = true;
    else if (a[i] === '--report') out.report = a[++i];
    else if (a[i] === '--only') out.only = a[++i];
    else throw new Error(`unknown argument ${a[i]}`);
  }
  if (!out.decoded.length && !out.gci.length) throw new Error('give --decoded <dir> (decoder JSON) or --gci <dir> (saves)');
  return out;
}

function readDecoded(dirs: string[], gciDirs: string[]): Decoded[] {
  const out: Decoded[] = [];
  for (const dir of gciDirs) {
    const files = readdirSync(dir).filter((f) => /\.gci$/i.test(f));
    if (!files.length) continue;
    const tmp = mkdtempSync(join(tmpdir(), 'tsdecode-'));
    // -I: isolated mode, so nothing next to the saves can shadow the decoder's imports. The saves are only read as bytes.
    execFileSync('python3', ['-I', DECODER, tmp, ...files.map((f) => join(dir, f))], { stdio: ['ignore', 'ignore', 'inherit'] });
    dirs.push(tmp);
  }
  for (const dir of dirs) {
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) out.push(JSON.parse(readFileSync(join(dir, f), 'utf8')) as Decoded);
  }
  return out;
}

async function main(): Promise<void> {
  const opt = args();
  const all = readDecoded([...opt.decoded], opt.gci);
  const reports: MapReport[] = [];
  const valid: Decoded[] = [];
  for (const d of all) {
    if (!d.game) reports.push({ file: d.file, game: 'TS2', name: '', status: 'skipped', reason: d.error ?? 'not a MapMaker map (a profile?)', tiles: 0, placed: 0, ourTiles: 0, standIns: {}, skippedTiles: [], verticals: 0, pickups: 0, spawns: 0, theme: '', warnings: [] });
    else if (!d.valid) reports.push({ file: d.file, game: d.game, name: d.name ?? '', status: 'skipped', reason: 'corrupt save (the decoder could not walk it consistently; see FORMAT.md)', tiles: d.tiles?.length ?? 0, placed: 0, ourTiles: 0, standIns: {}, skippedTiles: [], verticals: 0, pickups: 0, spawns: 0, theme: '', warnings: [] });
    else valid.push(d);
  }
  const cellIds = learnCellIds(valid);
  // Observed types and the mapping table.
  const seen = new Map<string, { footprint: [number, number]; saves: Set<string>; placements: number; cellIds?: number }>();
  for (const d of valid) for (const t of d.tiles!) {
    const k = `${d.game}:${t.type}`;
    const s = seen.get(k) ?? { footprint: [t.w, t.h] as [number, number], saves: new Set<string>(), placements: 0, ...(d.game === 'TSFP' && cellIds.has(t.type) ? { cellIds: cellIds.get(t.type) } : {}) };
    s.saves.add(d.file);
    s.placements++;
    seen.set(k, s);
  }
  let table = loadTable();
  if (opt.writeTable || !table) {
    table = refreshTable(table, seen);
    mkdirSync(join(ROOT, 'content/import'), { recursive: true });
    writeFileSync(TABLE_PATH, `${JSON.stringify(table, null, 2)}\n`);
    console.log(`wrote ${TABLE_PATH} (${table.entries.length} entries)`);
  }
  const byType = new Map(table.entries.map((e) => [`${e.game}:${e.original.id}`, e]));

  mkdirSync(join(ROOT, 'maps', OUT_DIR), { recursive: true });
  const used = new Set<string>();
  for (const d of valid.sort((a, b) => a.file.localeCompare(b.file))) {
    const base = `${d.game!.toLowerCase()}_${slug((d.name ?? '').trim() || d.file.replace(/\..*$/, '')) || 'map'}`;
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}_${n}`;
    used.add(id);
    if (opt.only && opt.only !== id) continue;
    const { report, builder } = convert(d, id, byType, cellIds);
    if (builder) {
      const issues: ValidationIssue[] = await builder.save({ dir: OUT_DIR, exitOnError: false, quiet: true });
      const errors = issues.filter((i) => i.severity === 'error');
      if (errors.length) {
        report.status = 'skipped';
        report.reason = `does not validate: ${errors.map((e) => `${e.code} ${e.message}`).join('; ')}`;
      }
      for (const i of issues.filter((x) => x.severity === 'warning')) report.warnings.push(`${i.code}: ${i.message}`);
    }
    reports.push(report);
    const si = Object.entries(report.standIns).map(([k, v]) => `${k} x${v}`).join(', ');
    console.log(`${report.status === 'converted' ? 'OK  ' : 'SKIP'} ${id.padEnd(30)} ${String(report.placed).padStart(3)}/${String(report.tiles).padEnd(3)} tiles -> ${String(report.ourTiles).padStart(3)} pieces, ${report.verticals} stairs, ${report.spawns} spawns, ${report.pickups} pickups, theme ${report.theme}${report.reason ? `  [${report.reason}]` : ''}`);
    if (si) console.log(`     stand-ins: ${si}`);
    for (const w of report.warnings.filter((x) => x.startsWith('nav.'))) console.log(`     ${w}`);
  }
  const conv = reports.filter((r) => r.status === 'converted');
  console.log(`\nconverted ${conv.length} maps (TS2 ${conv.filter((r) => r.game === 'TS2').length}, TSFP ${conv.filter((r) => r.game === 'TSFP').length}); skipped ${reports.length - conv.length}`);
  for (const r of reports.filter((x) => x.status === 'skipped')) console.log(`  skipped ${r.file}: ${r.reason}`);
  console.log('items are placeholders: the original item kinds are unknown, so every map gets a balanced default set where the original had items.');
  if (opt.report) writeFileSync(opt.report, `${JSON.stringify(reports, null, 1)}\n`);
}

await main();
