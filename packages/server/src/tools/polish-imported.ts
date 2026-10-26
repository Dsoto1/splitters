/**
 * Hand polish for imported TimeSplitters maps that set the bar (docs/IMPORTED_MAPS_AUDIT.md).
 * The importer (import-timesplitters.ts) places the original's pieces, a placeholder set of
 * pickups where the original had items, sparse dressing and its lights; here a few maps get a
 * designed weapon layout (one contested power weapon, mirrored pairs, health and armour on the
 * routes between them), spawns kept off the power weapon, and their big rooms dressed for what
 * they are. Run it after the importer, from packages/server:
 *
 *   npx tsx src/tools/polish-imported.ts [id...]
 *
 * It starts from the importer's file each time it can tell (pickups and props are rebuilt from
 * scratch, so rerunning gives the same file). Cells are the map's own grid: (x, y) east/north,
 * z the level.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dressSpace, loadMap, type MapDocument, type RoomType } from '@tiletrigger/shared';
import { MapBuilder } from './mapkit.ts';

type Cell = [number, number, number];

interface Polish {
  /** The one power weapon, in the most contested spot. */
  power: { item: string; at: Cell };
  /** Everything else: weapons, health, armour, ammo. */
  pickups: [string, Cell][];
  /** Spawns closer than this (m) to the power weapon move to `spawnCells`. */
  clearance: number;
  spawnCells: Cell[];
  /** Rooms (rectangles of cells on one level) and what they are dressed as. */
  rooms: { x0: number; y0: number; x1: number; y1: number; z: number; type: RoomType; density: 'sparse' | 'normal' | 'full' }[];
  /** Extra lights (warm work lights over the routes the importer left dim). */
  lights?: { at: Cell; color: string; intensity: number; range: number }[];
}

const POLISH: Record<string, Polish> = {
  // Clover: four rooms round a central hall on the ground floor, a corridor cross over them,
  // a ring corridor outside. Four-way symmetric, so the weapons are too.
  ts2_clover: {
    power: { item: 'weapon_rockets', at: [0, 0, 0] },
    pickups: [
      ['weapon_auto_shotgun', [-4, -4, 0]],
      ['weapon_auto_shotgun', [4, 4, 0]],
      ['weapon_burst_rifle', [4, -4, 0]],
      ['weapon_burst_rifle', [-4, 4, 0]],
      ['weapon_marksman', [-2, 5, 1]],
      ['weapon_marksman', [2, -5, 1]],
      ['armor_large', [0, 2, 1]],
      ['health_large', [0, -2, 1]],
      ['armor_small', [-2, -4, 1]],
      ['armor_small', [2, 4, 1]],
      ['health_small', [-6, 4, 0]],
      ['health_small', [6, -4, 0]],
      ['ammo', [6, 4, 0]],
      ['ammo', [-6, -4, 0]],
      ['grenades', [-3, -6, 0]],
      ['grenades', [3, 6, 0]],
    ],
    clearance: 14,
    spawnCells: [[-6, 6, 0], [6, -6, 0], [6, 6, 1], [-6, -6, 1]],
    rooms: [
      { x0: -5, y0: 3, x1: -3, y1: 5, z: 0, type: 'storage', density: 'normal' },
      { x0: 3, y0: 3, x1: 5, y1: 5, z: 0, type: 'workshop', density: 'normal' },
      { x0: -5, y0: -5, x1: -3, y1: -3, z: 0, type: 'workshop', density: 'normal' },
      { x0: 3, y0: -5, x1: 5, y1: -3, z: 0, type: 'storage', density: 'normal' },
    ],
  },
  // Bunker (Future Perfect): a barracks hall in the west, cell blocks in the south-west, a
  // command room upstairs in the middle and a maze of corridors on the upper east side.
  tsfp_bunker: {
    power: { item: 'weapon_rockets', at: [2, 2, 1] },
    pickups: [
      ['weapon_railgun', [-6, 3, 0]],
      ['weapon_auto_shotgun', [4, -5, 1]],
      ['weapon_smg', [-7, -9, 0]],
      ['weapon_burst_rifle', [-4, 9, 0]],
      ['weapon_marksman', [-4, 4, 0]],
      ['weapon_flak', [5, -1, 1]],
      ['weapon_lmg', [0, -11, 0]],
      ['armor_large', [2, -3, 1]],
      ['armor_small', [-7, 1, 0]],
      ['health_large', [-1, -10, 0]],
      ['health_small', [8, -8, 1]],
      ['health_small', [-4, 7, 0]],
      ['health_small', [6, -12, 0]],
      ['ammo', [-3, 2, 0]],
      ['ammo', [4, -9, 1]],
      ['ammo', [-2, -12, 0]],
      ['grenades', [3, -1, 1]],
    ],
    clearance: 12,
    spawnCells: [[-5, 1, 0], [7, -6, 1]],
    rooms: [
      { x0: -8, y0: 1, x1: -3, y1: 5, z: 0, type: 'barracks', density: 'normal' },
      { x0: -8, y0: -11, x1: -6, y1: -9, z: 0, type: 'armoury', density: 'normal' },
      { x0: 1, y0: 1, x1: 3, y1: 3, z: 1, type: 'server', density: 'sparse' },
    ],
    lights: [
      { at: [2, -5, 1], color: '#ffd9a0', intensity: 1, range: 12 },
      { at: [6, -9, 1], color: '#ffd9a0', intensity: 1, range: 12 },
    ],
  },
};

async function polish(id: string, p: Polish): Promise<void> {
  const path = fileURLToPath(new URL(`../../../../maps/imported/${id}.json`, import.meta.url));
  const loaded = loadMap(readFileSync(path, 'utf8'));
  if (!loaded.ok) throw new Error(`${id}: does not load`);
  const doc = loaded.map;
  const { cellSize, levelHeight } = doc.classicStructure;
  const world = ([x, y, z]: Cell, dx = 0, dz = 0): [number, number, number] => [x * cellSize + dx, z * levelHeight, y * cellSize + dz];
  const powerAt = world(p.power.at);
  const near = (e: { position: [number, number, number] }) => Math.hypot(e.position[0] - powerAt[0], e.position[2] - powerAt[2]) < p.clearance && Math.abs(e.position[1] - powerAt[1]) < levelHeight;
  // Spawns too close to the power weapon move to the spare cells (keeping their IDs, so a rerun finds
  // nothing to move); pickups and props are rebuilt and the polish's own lights (g_) go, so a rerun
  // gives the same file.
  const moved = doc.entities.filter((e) => e.kind === 'spawn' && near(e));
  if (moved.length > p.spawnCells.length) throw new Error(`${id}: ${moved.length} spawns near the power weapon, ${p.spawnCells.length} spare spawn cells`);
  const entities = doc.entities
    .filter((e) => e.kind !== 'pickup' && e.kind !== 'prop' && !e.id.startsWith('g_'))
    .map((e) => (moved.includes(e) ? { ...e, position: world(p.spawnCells[moved.indexOf(e)]!) } : e));
  const base: MapDocument = { ...doc, entities };
  const b = new MapBuilder(id, doc.metadata.name, base, 'g_');
  b.pickup(p.power.item, powerAt);
  const spawnSpots = b.doc.entities.filter((e) => e.kind === 'spawn').map((e) => e.position);
  for (const [item, cell] of p.pickups) {
    // Off-centre where a spawn stands in the same cell.
    const w = world(cell);
    const shared = spawnSpots.some((s) => Math.hypot(s[0] - w[0], s[2] - w[2]) < 1.5 && Math.abs(s[1] - w[1]) < 1);
    b.pickup(item, shared ? world(cell, 2, 2) : w);
  }
  for (const l of p.lights ?? []) {
    const [x, y, z] = world(l.at);
    b.light([x, y + levelHeight - 0.55, z], { color: l.color, intensity: l.intensity, range: l.range, fixture: 'ceiling' });
  }
  for (const r of p.rooms) {
    const cells: Cell[] = [];
    for (let x = r.x0; x <= r.x1; x++) for (let y = r.y0; y <= r.y1; y++) cells.push([x, y, r.z]);
    b.dress(dressSpace(b.doc, cells), r.type, { density: r.density });
  }
  const issues = await b.save({ dir: 'imported', quiet: true, exitOnError: false });
  for (const i of issues) console.log(`${id}: ${i.severity} ${i.code} ${i.message}`);
  const n = (k: string) => b.doc.entities.filter((e) => e.kind === k).length;
  console.log(`${id}: ${issues.some((i) => i.severity === 'error') ? 'NOT WRITTEN' : 'polished'} (${n('spawn')} spawns, ${n('pickup')} pickups, ${n('prop')} props, ${n('light')} lights; ${moved.length} spawns moved off the power weapon)`);
}

const only = process.argv.slice(2);
for (const [id, p] of Object.entries(POLISH)) if (!only.length || only.includes(id)) await polish(id, p);
