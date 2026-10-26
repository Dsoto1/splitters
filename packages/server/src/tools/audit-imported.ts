/**
 * Audit of the maps converted from TimeSplitters MapMaker saves
 * (maps/imported/*.json). Loads every map and reports, per map: tiles, levels,
 * pieces we could only stand in for, spawns/pickups/lights/props, validation
 * (schema, rules, navmesh), how much of the floor bots can actually walk to,
 * orientation checks and a quality score. Writes docs/IMPORTED_MAPS_AUDIT.md.
 *
 *   npx tsx src/tools/audit-imported.ts [--json <file>]
 *
 * Reads only our own map files and the importer's per-map summary
 * (content/import/timesplitters-import.json: counts, no save data).
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PhysicsWorld,
  SIDE_DIRS,
  VISIBLE_IMPORTED_MAPS,
  blockBoxes,
  buildMapGeometry,
  coreCatalog,
  initPhysics,
  loadMap,
  mapTerrainMesh,
  navLinks,
  propBoxes,
  resolveBackdrop,
  rotateSide,
  rotateXZ,
  validateMap,
  type MapDocument,
} from '@tiletrigger/shared';
import { NavWorld, initNavigation, validateNavigation } from '@tiletrigger/shared/match';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const DIR = join(ROOT, 'maps/imported');
const SUMMARY = join(ROOT, 'content/import/timesplitters-import.json');
const OUT = join(ROOT, 'docs/IMPORTED_MAPS_AUDIT.md');

interface Summary {
  id: string;
  game: 'TS2' | 'TSFP';
  tiles: number;
  placed: number;
  pieces: number;
  standIns: Record<string, number>;
  skippedTiles: number;
  cutOffCells: number;
  verticals: number;
  repairs: { doors: number; stairs: number };
  lights: number;
  props: number;
  dressed: boolean;
  theme: string;
}

export interface MapAudit {
  id: string;
  name: string;
  game: string;
  tiles: number;
  placed: number;
  pieces: number;
  levels: number[];
  standIns: number;
  standInKinds: string;
  skippedTiles: number;
  repairs: number;
  floorCells: number;
  reachableCells: number;
  spawns: number;
  pickups: number;
  lights: number;
  props: number;
  theme: string;
  ground: string;
  errors: number;
  warnings: number;
  stairs: number;
  stairsOk: number;
  spawnsAboveFloor: boolean;
  score: number;
  visible: boolean;
}

/** Every cell with a floor of its own (stairs and ramps aside: they are checked as links). */
function floorCells(map: MapDocument): { x: number; y: number; z: number; stair: boolean }[] {
  const out: { x: number; y: number; z: number; stair: boolean }[] = [];
  for (const t of map.classicStructure.tiles) {
    const def = coreCatalog.get(t.tile);
    if (!def) continue;
    const stair = def.category === 'Vertical';
    for (const [dx, dy, dz] of def.cells) {
      if (!def.floors.includes(dz)) continue;
      const [rx, ry] = rotateXZ(dx, dy, t.rotation);
      out.push({ x: t.x + rx, y: t.y + ry, z: t.z + dz, stair });
    }
  }
  return out;
}

export async function auditMap(map: MapDocument, s: Summary | undefined): Promise<MapAudit> {
  const { cellSize, levelHeight } = map.classicStructure;
  const geometry = buildMapGeometry(map);
  const physics = new PhysicsWorld(geometry, mapTerrainMesh(map));
  const nav = NavWorld.build([...geometry, ...propBoxes(map, true), ...blockBoxes(map, true)], mapTerrainMesh(map), navLinks(map.entities, physics));
  physics.free();
  const issues = [...validateMap(map), ...validateNavigation(map, nav)];
  const spawns = map.entities.filter((e) => e.kind === 'spawn');
  const first = spawns[0];
  const from = first ? { x: first.position[0], y: first.position[1], z: first.position[2] } : null;
  /** Can bots walk from the first spawn to (x, y, z) (a point on a floor)? */
  const reach = (p: { x: number; y: number; z: number }): boolean => {
    if (!from) return false;
    const q = nav.closestPoint(p, { x: 3, y: 1.2, z: 3 });
    if (!q || Math.abs(q.y - p.y) > 1.2) return false;
    const path = nav.findPath(from, q);
    const end = path?.[path.length - 1];
    return !!end && Math.hypot(end.x - q.x, end.z - q.z) < 1.5 && Math.abs(end.y - q.y) < 1.5;
  };
  const cells = floorCells(map).filter((c) => !c.stair);
  const reachable = cells.filter((c) => reach({ x: c.x * cellSize, y: c.z * levelHeight + 0.05, z: c.y * cellSize })).length;
  // Orientation: every flight must climb from a floor at its low port to a floor one level up at its high port.
  const occupied = new Set(floorCells(map).map((c) => `${c.x},${c.y},${c.z}`));
  let stairs = 0;
  let stairsOk = 0;
  for (const t of map.classicStructure.tiles) {
    const def = coreCatalog.get(t.tile);
    if (!def || def.category !== 'Vertical' || def.ports.length < 2) continue;
    stairs++;
    const ends = def.ports.map((p) => {
      const [rx, ry] = rotateXZ(p.cell?.[0] ?? 0, p.cell?.[1] ?? 0, t.rotation);
      const [dx, dy] = SIDE_DIRS[rotateSide(p.side, t.rotation)];
      return { x: t.x + rx + dx, y: t.y + ry + dy, z: t.z + p.level };
    });
    const low = ends.reduce((a, b) => (b.z < a.z ? b : a));
    const high = ends.reduce((a, b) => (b.z > a.z ? b : a));
    if (high.z === low.z + 1 && occupied.has(`${low.x},${low.y},${low.z}`) && occupied.has(`${high.x},${high.y},${high.z}`)) stairsOk++;
  }
  const levels = [...new Set(cells.map((c) => c.z))].sort((a, b) => a - b);
  const lowest = Math.min(...levels) * levelHeight;
  const spawnsAboveFloor = spawns.every((sp) => sp.position[1] >= lowest - 0.01);
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;
  const standIns = Object.values(s?.standIns ?? {}).reduce((a, b) => a + b, 0);
  const repairs = (s?.repairs.doors ?? 0) + (s?.repairs.stairs ?? 0);
  const pieces = map.classicStructure.tiles.length;
  // Quality score (0-100): how much is walkable, how faithful the conversion is, how clean and playable.
  const coverage = cells.length ? reachable / cells.length : 0;
  const fidelity = s ? s.placed / Math.max(1, s.tiles) : 0;
  const known = s ? 1 - Math.min(1, standIns / Math.max(1, s.placed)) : 0;
  const invented = Math.min(1, repairs / Math.max(1, pieces / 8));
  const size = reachable < 40 ? reachable / 40 : reachable > 300 ? Math.max(0, 1 - (reachable - 300) / 300) : 1;
  const score = Math.round(
    35 * coverage + 15 * fidelity + 15 * known + 10 * (1 - invented) + Math.max(0, 10 - 2 * warnings - 10 * errors) + 10 * size + (levels.length > 1 && stairs && stairsOk === stairs ? 5 : levels.length === 1 ? 2 : 0),
  );
  nav.destroy();
  return {
    id: map.metadata.id,
    name: map.metadata.name,
    game: s?.game ?? (map.metadata.id.startsWith('ts2_') ? 'TS2' : 'TSFP'),
    tiles: s?.tiles ?? 0,
    placed: s?.placed ?? 0,
    pieces,
    levels,
    standIns,
    standInKinds: Object.entries(s?.standIns ?? {}).map(([k, v]) => `${k.replace('type ', '')}×${v}`).join(' '),
    skippedTiles: s?.skippedTiles ?? 0,
    repairs,
    floorCells: cells.length,
    reachableCells: reachable,
    spawns: spawns.length,
    pickups: map.entities.filter((e) => e.kind === 'pickup').length,
    lights: map.entities.filter((e) => e.kind === 'light').length,
    props: map.entities.filter((e) => e.kind === 'prop').length,
    theme: map.classicStructure.theme.replace(/^core\./, ''),
    ground: resolveBackdrop(map).ground,
    errors,
    warnings,
    stairs,
    stairsOk,
    spawnsAboveFloor,
    score,
    visible: VISIBLE_IMPORTED_MAPS.includes(map.metadata.id),
  };
}

function markdown(rows: MapAudit[]): string {
  const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : '–');
  const sum = (f: (r: MapAudit) => number) => rows.reduce((a, r) => a + f(r), 0);
  const lines = [
    '# Imported TimeSplitters maps: audit',
    '',
    'Generated by `packages/server/src/tools/audit-imported.ts` (run `npx tsx src/tools/audit-imported.ts` in `packages/server`',
    'after the importer). It reads our converted maps (`maps/imported/*.json`) and the importer\'s per-map summary',
    '(`content/import/timesplitters-import.json`, counts only). No save data is stored here or anywhere in the repo.',
    'How the maps are made, and what is guessed: [ORIGINAL_MAPS.md](ORIGINAL_MAPS.md), `tools/import/timesplitters/FORMAT.md`.',
    '',
    '## Summary',
    '',
    `- ${rows.length} maps (TS2 ${rows.filter((r) => r.game === 'TS2').length}, Future Perfect ${rows.filter((r) => r.game === 'TSFP').length}); ${rows.filter((r) => r.visible).length} visible in the map list: ${rows.filter((r) => r.visible).map((r) => `\`${r.id}\``).join(', ') || 'none'}.`,
    `- Validation: ${sum((r) => r.errors)} errors, ${sum((r) => r.warnings)} warnings over all maps; ${rows.filter((r) => !r.errors && !r.warnings).length} maps are clean.`,
    `- Walkable floor: bots reach ${pct(sum((r) => r.reachableCells), sum((r) => r.floorCells))} of all floor cells from the first spawn (${rows.filter((r) => r.reachableCells === r.floorCells).length} maps: all of it).`,
    `- Pieces: ${sum((r) => r.placed)} of ${sum((r) => r.tiles)} original tiles placed; ${sum((r) => r.standIns)} are stand-ins for pieces we can't name yet; ${sum((r) => r.repairs)} doorways/stairs added to join areas the save joins in ways we can't decode.`,
    `- Orientation: ${sum((r) => r.stairsOk)} of ${sum((r) => r.stairs)} flights climb from a floor to a floor one level up; every map stands on ground (no sky below): ${rows.every((r) => r.ground !== 'none') ? 'yes' : 'no'}; spawns never below the lowest floor: ${rows.every((r) => r.spawnsAboveFloor) ? 'yes' : 'no'}.`,
    `- Dressing and light: ${sum((r) => r.lights)} lights (from the saves' per-tile light colours), ${sum((r) => r.props)} props (our dressing in the original rooms).`,
    '',
    '## What was wrong (the "mostly empty, sky below / mirrored" report) and what changed',
    '',
    '- **Mostly empty.** Large parts of most maps were cut off from where the spawns are, so no spawns or pickups went there',
    '  and bots never did either (before: 9,195 floor cells cut off over all maps; now 2,428). MapMaker only saves maps whose',
    '  pieces all connect, so every cut-off area was the converter misreading a piece: TS2 exits are statistical guesses, and',
    '  lifts, ladders and unknown stair pieces are not decoded. A repair pass now joins every area that touches another with',
    '  the smallest change (one doorway, or stairs: a step up onto a higher terrace, or a stairwell beside two stacked',
    '  areas), preferring joins the save hints at. Areas that touch nothing stay cut off and get no spawns or pickups.',
    '  The rooms were also bare: each original room of four cells or more now gets sparse dressing for the theme.',
    '- **Sky below.** Maps that picked the Space Station theme took its backdrop, which floats in space with no ground: every',
    '  gap and every look over an edge showed sky under the map. Imported maps now always stand on ground.',
    '- **Open to the sky.** Rooms had no roofs; original rooms and halls now get one (open courtyards excepted).',
    '- **Lighting.** Not converted before. The per-tile light colour in the save (white by default, black for lights off,',
    '  plus reds, ambers and blues) is now one light per original tile, in that colour.',
    '- **Spawns** faced the first doorway in N/E/S/W order; they now face down the longest open run.',
    '- **Mirrored.** Not a converter bug that the data can show (see below); rotation, footprints and stairs are now pinned by',
    '  tests (`packages/shared/test/imported.test.ts`).',
    '',
    '## What the decoded data is still missing',
    '',
    'No controlled test saves (FORMAT.md section 6) were available for this pass, so these stay open; each names the saves that',
    'would settle it.',
    '',
    '- **Props / items.** TS2 attachments and Future Perfect items are decoded (positions per tile, a kind number, a facing),',
    '  but which kind is which weapon, pickup, start point or prop is unknown, and so is where in a tile an item stands.',
    '  Pickups are placeholders from a balanced set. Saves 9-11 (one item each, then moved, then turned).',
    '- **Textures / looks.** Tile type names and per-tile looks are unknown (TS2 tile record +8, Future Perfect +8 are',
    '  candidates for a texture or tileset byte). The theme comes from words in the name and description. Saves 2 and 7.',
    '- **Heights.** z is one storey (4 m). Future Perfect open blocks link down 1-5 levels (terrain or drops?) and some types',
    '  take extra cell ids (tall rooms, shafts): those are flattened to one storey. Saves 6 and 15.',
    '- **Vertical pieces** (lifts, ladders, some stairs) and **logic** (doors, switches, objectives) are not decoded.',
    '- **Lights**: the colour is converted; the second Future Perfect colour (usually 101010, maybe ambient) and the f32 at',
    '  +0x18 (maybe radius) are not. Save 13.',
    '',
    '## Visible maps',
    '',
    'The five verified maps are the highest-scoring ones that also look right in play (checked in the browser from above and',
    'from spawns), one of each kind: `ts2_core` (a four-storey bunker), `ts2_clover` (four rooms round a hall under a corridor',
    'cross, four-way symmetric), `tsfp_bunker` (barracks, cell blocks and a corridor maze), `tsfp_archives` (long office',
    'corridors on two floors) and `tsfp_stack` (warehouse rooms round courtyards). High scorers left hidden: big empty halls',
    '(`ts2_face_off`, `ts2_zombie_night`, `ts2_messy_base`), dense grids of one-cell rooms (`tsfp_fire_temple`) and open',
    'yards that read as a flat field (`tsfp_ice_temple`).',
    '',
    '`ts2_clover` and `tsfp_bunker` are polished by hand to set the bar (`packages/server/src/tools/polish-imported.ts`): a',
    'designed weapon layout (one contested power weapon, mirrored pairs of the others, armour and health on the routes between',
    'them), spawns kept off the power weapon, and their big rooms dressed for what they are at normal density.',
    '',
    '## Regenerating',
    '',
    'The saves are not in the repo. With them: run the importer (ORIGINAL_MAPS.md), then `polish-imported.ts`, then this audit.',
    'Without them, change the maps with a script over `maps/imported/*.json`, as the polish does.',
    '',
    '### Mirroring',
    '',
    'The save stores x, y and a quarter-turn rotation; with x east and y north the rotation is counter-clockwise (the only',
    'sense that makes corridor exits line up, FORMAT.md 2.2), and the converter maps that onto our clockwise rotation, so',
    'no map is mirrored *relative to itself* (a turned piece, its stairs and its doorways agree; `imported.test.ts` checks',
    'the rotation and footprint rules). Whether the whole map is the mirror image of what the game shows (y south instead',
    'of north) cannot be told from the data: every cue in it (rotation sense, exits, stairs, side flags) flips together.',
    'It needs one controlled save (FORMAT.md section 6, saves 3 and 5: one corridor moved east, then north). Until then',
    'the maps keep +y = north.',
    '',
    '### Score',
    '',
    'Out of 100: walkable share of the floor ×35, original tiles placed ×15, pieces we can name (not stand-ins) ×15,',
    'few added doorways/stairs ×10, validation (10, minus 2 per warning), a deathmatch-sized walkable area (40–300 cells) ×10,',
    'and 5 for working levels (2 for a single-level map).',
    '',
    '## Maps',
    '',
    '| Map | Game | Score | Visible | Tiles placed | Pieces | Levels | Stand-ins (type×n) | Added | Bots reach | Spawns / pickups | Lights / props | Theme | Stairs ok | Validation |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const r of [...rows].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))) {
    lines.push(
      `| \`${r.id}\` ${r.name.replace(/\|/g, '/')} | ${r.game} | ${r.score} | ${r.visible ? '**yes**' : 'no'} | ${r.placed}/${r.tiles} | ${r.pieces} | ${r.levels.length} (${r.levels[0]}..${r.levels[r.levels.length - 1]}) | ${r.standIns ? `${r.standIns}: ${r.standInKinds}` : '0'} | ${r.repairs} | ${pct(r.reachableCells, r.floorCells)} of ${r.floorCells} | ${r.spawns} / ${r.pickups} | ${r.lights} / ${r.props} | ${r.theme} | ${r.stairsOk}/${r.stairs} | ${r.errors} E, ${r.warnings} W |`,
    );
  }
  return `${lines.join('\n')}\n`;
}

async function main(): Promise<void> {
  await Promise.all([initPhysics(), initNavigation()]);
  const summary = existsSync(SUMMARY) ? (JSON.parse(readFileSync(SUMMARY, 'utf8')) as { maps: Summary[] }).maps : [];
  const byId = new Map(summary.map((s) => [s.id, s]));
  const rows: MapAudit[] = [];
  for (const f of readdirSync(DIR).filter((x) => x.endsWith('.json')).sort()) {
    const r = loadMap(readFileSync(join(DIR, f), 'utf8'));
    if (!r.ok) {
      console.log(`FAIL ${f}: does not load`);
      continue;
    }
    const a = await auditMap(r.map, byId.get(r.map.metadata.id));
    rows.push(a);
    console.log(`${String(a.score).padStart(3)} ${a.id.padEnd(28)} reach ${a.reachableCells}/${a.floorCells} levels ${a.levels.length} stand-ins ${a.standIns} added ${a.repairs} ${a.errors}E ${a.warnings}W`);
  }
  writeFileSync(OUT, markdown(rows));
  const i = process.argv.indexOf('--json');
  if (i > 0) writeFileSync(process.argv[i + 1]!, `${JSON.stringify(rows, null, 1)}\n`);
  console.log(`wrote ${OUT}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
