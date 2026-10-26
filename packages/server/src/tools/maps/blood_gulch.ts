/**
 * Blood Gulch: a long grassy box canyon walled in by steep rock, with two
 * squat concrete bunkers facing each other from the far ends (a layout homage
 * to the classic Halo: Combat Evolved map; our own name, tiles and props).
 *
 * Top-down (x east, z north; metres), point-symmetric about the centre:
 *
 *   z +150  ~~~~~~~~~~~~~~~~~ end cliffs ~~~~~~~~~~~~~~~~~~
 *   z +130        back ramp to the roof
 *   z +104   tank [ RED bunker: hall, upper room, roof deck ] skyfighter
 *   z  +88   buggy  speeders   pad -> west ledge     east ramp up ↘
 *   z  +60   |ledge 10 m|  boulders  hill   bushes    |ledge 10 m|
 *   z    0   |  outcrop |   rockets on the knoll      | outcrop   |
 *   z  -60   |ledge     |   boulders  hill   path     |ledge      |
 *   z  -88   ↖ west ramp up    pad -> east ledge   speeders  buggy
 *   z -104   skyfighter [ BLUE bunker ] tank
 *   z -150  ~~~~~~~~~~~~~~~~~ end cliffs ~~~~~~~~~~~~~~~~~~
 *
 * Each bunker: a 24 m great hall (flag behind the dais) with a wide front
 * door, a back door and side doors; a railed roof deck with a small upper
 * room in the middle; open stairs up both front corners and a long ramp up
 * the back. A 10 m sniper ledge runs along each side cliff, climbed by a ramp
 * at one end and reached from the far base by a jump pad (our stand-in for
 * the teleporters). A winding dirt path runs base to base over rolling grass.
 */
import { CORE_PROPS, TERRAIN_MATERIALS, newTerrain, paintSlopes, terrainHeightAt, type TerrainData, type TerrainMaterial } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('blood_gulch', 'Blood Gulch');
m.theme('bunker');
m.factions([
  { id: 'red', name: 'Red', color: '#d8344f', relations: {} },
  { id: 'blue', name: 'Blue', color: '#3a7fe2', relations: {} },
]);

// ---------------------------------------------------------------- terrain shape

const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const bump = (x: number, z: number, cx: number, cz: number, r: number, h: number) => h * Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (r * r));
/** Evaluate f and its 180° turn, so the two halves of the map are fair. */
const sym = (f: (x: number, z: number) => number) => (x: number, z: number) => Math.max(f(x, z), f(-x, -z));
const symAvg = (f: (x: number, z: number) => number) => (x: number, z: number) => (f(x, z) + f(-x, -z)) / 2;

/** Half-width of the canyon floor at z (the foot of the side cliffs). */
const halfW = (z: number) => 58 + 3 * Math.sin(z / 23) + 1.5 * Math.cos(z / 11);
/** Distance from the centre line to the cliff foot on the east (x >= 0) or west side at z. */
const foot = (x: number, z: number) => (x >= 0 ? halfW(z) : halfW(-z));
const LEDGE_Y = 10;
const END_Z = 146; // the end cliffs start here
const BASE_Z = 104; // centre of each bunker

/** The east side's ledge: its height at z and whether the shelf exists (0..1). The west one is its 180° turn. */
function eastLedge(z: number): { h: number; shelf: number } {
  // Flat 10 m from z -78 to +72, then a ramp down to the floor by z +112 (north end, near Red).
  const h = LEDGE_Y * clamp01((112 - z) / 40) * smooth(-90, -78, z);
  const shelf = smooth(-92, -78, z) * (1 - smooth(116, 124, z));
  return { h, shelf };
}

/** Cliff height for one side (east: x > 0), as a function of distance past the cliff foot. */
function sideCliff(x: number, z: number): number {
  const d = x - halfW(z);
  const { h, shelf } = eastLedge(z);
  const top = 34 + 4 * Math.sin(z / 9 + 1) + 3 * Math.cos(z / 14 + x / 7);
  const step = h * smooth(-1, 2.5, d); // the steep face up to the ledge
  const s0 = 9 * shelf; // the ledge is ~6 m deep
  return step + smooth(s0, s0 + 13, d) * Math.max(0, top - h);
}
const cliffs = sym(sideCliff);

/** Flat aprons round the bunkers (north one; the south is its turn). */
const apronN = (x: number, z: number) => (1 - smooth(0, 10, Math.max(Math.abs(x) - 34, 0))) * (1 - smooth(0, 10, Math.max(Math.abs(z - (BASE_Z + 14)) - 26, 0)));
const apron = sym(apronN);

const rolling = symAvg((x, z) => 0.9 * Math.sin(x / 13 + 0.4) * Math.cos(z / 19) + 0.7 * Math.sin(z / 27 + x / 33) + 0.35 * Math.cos(x / 7 - z / 11));
const hills = sym(
  (x, z) =>
    bump(x, z, -22, 42, 14, 4.5) + // the big hill in the north half
    bump(x, z, 26, 64, 10, 3) +
    bump(x, z, 4, 4, 9, 2.4) + // the rocket knoll in the middle
    bump(x, z, 38, 18, 9, 2.6) +
    bump(x, z, -40, 80, 9, 2.2),
);
const endWall = (x: number, z: number) => smooth(END_Z, END_Z + 14, Math.abs(z)) * (32 + 4 * Math.sin(x / 8) + 3 * Math.cos(x / 13));

function height(x: number, z: number): number {
  let h = Math.max(0, rolling(x, z) + 0.5) + hills(x, z);
  h = lerp(h, 0, apron(x, z));
  return Math.max(h, cliffs(x, z), endWall(x, z));
}

let terrain: TerrainData = { ...newTerrain(320, 2, [0, 0], 'grass'), baseY: -0.15 };
terrain = {
  ...terrain,
  heights: terrain.heights.map((_, i) => {
    const c = i % terrain.cols;
    const r = Math.floor(i / terrain.cols);
    return Math.round(height(terrain.origin[0] + c * terrain.spacing, terrain.origin[1] + r * terrain.spacing) * 100);
  }),
};

// The winding path from base to base.
const pathX = (z: number) => 13 * Math.sin(z / 29) + 4 * Math.sin(z / 11);
const onPath = (x: number, z: number) => Math.abs(x - pathX(z)) < 2.2 && Math.abs(z) < BASE_Z - 10;
const ledgeAt = (x: number, z: number) => {
  // On the ledge or its ramp (either side).
  const side = (px: number, pz: number) => {
    const d = px - halfW(pz);
    const { h, shelf } = eastLedge(pz);
    return shelf > 0.5 && h > 0.5 && d > 2.5 && d < 8.5;
  };
  return side(x, z) || side(-x, -z);
};

const mat = (n: TerrainMaterial) => TERRAIN_MATERIALS.indexOf(n);
const cellXZ = (i: number): [number, number] => {
  const c = i % (terrain.cols - 1);
  const r = Math.floor(i / (terrain.cols - 1));
  return [terrain.origin[0] + (c + 0.5) * terrain.spacing, terrain.origin[1] + (r + 0.5) * terrain.spacing];
};
const groundRaw = (x: number, z: number) => (terrainHeightAt(terrain, x, z) ?? 0) - terrain.baseY;
terrain = {
  ...terrain,
  materials: terrain.materials.map((v, i) => {
    const [x, z] = cellXZ(i);
    if (apron(x, z) > 0.7) return mat('gravel');
    if (onPath(x, z)) return mat('dirt');
    if (ledgeAt(x, z)) return mat('dirt');
    if (groundRaw(x, z) > 14) return mat('stone');
    if (cliffs(x, z) > 2 || endWall(x, z) > 2) return mat('moss');
    return v;
  }),
};
terrain = paintSlopes(terrain, 34, 'stone');
// Plants: lush across the floor, overgrown on the flanks by the cliffs, bare on gravel, dirt and rock.
terrain = {
  ...terrain,
  foliage: terrain.materials.map((v, i) => {
    const [x, z] = cellXZ(i);
    const name = TERRAIN_MATERIALS[v];
    if (name !== 'grass' && name !== 'moss') return 0;
    if (name === 'moss') return 1;
    if (Math.abs(x) > foot(x, z) - 16) return 4;
    if (Math.abs(x - pathX(z)) < 5) return 2;
    return 3;
  }),
};
m.terrain(terrain);
const ground = (x: number, z: number) => +(terrainHeightAt(terrain, x, z) ?? 0).toFixed(2);

// ---------------------------------------------------------------- bunkers

const [red, blue] = m.teamIds() as [string, string];

/**
 * One bunker. `s` is +1 for Red (north) and -1 for Blue (south): everything
 * is the other's 180° turn. Grid rows: the hall covers rows 12..14 (north),
 * the back ramp rows 15..16.
 */
function buildBase(s: 1 | -1, team: string): void {
  const front = s > 0 ? 'S' : 'N';
  const back = s > 0 ? 'N' : 'S';
  const east = s > 0 ? 'E' : 'W';
  const west = s > 0 ? 'W' : 'E';
  const row = (r: number) => s * r; // grid row on this side, counted from the centre
  const X = (c: number) => s * c; // grid column, turned with the base
  const fz = (dz: number) => s * dz; // world z
  const fx = (dx: number) => s * dx; // world x
  const facing = s > 0 ? Math.PI : 0; // facing mid

  // Ground floor: the great hall (rows 12..14).
  m.tile('hall', -1, Math.min(row(12), row(14)), 0, 0, { ceiling: 'roof' });
  // Roof deck on top, with a small upper room in the middle.
  for (let c = -1; c <= 1; c++) for (let r = 12; r <= 14; r++) if (!(c === 0 && r === 13)) m.tile('platform_rail', X(c), row(r), 1);
  m.tile('room', 0, row(13), 1, 0, { ceiling: 'roof' });
  m.edge(0, row(13), 1, front, 'door').edge(0, row(13), 1, back, 'door');
  m.edge(0, row(13), 1, 'E', 'windows').edge(0, row(13), 1, 'W', 'windows');

  // Doors: wide front with arches beside it, a back door, a door each side.
  m.edge(0, row(12), 0, front, 'wide').edge(-1, row(12), 0, front, 'arch').edge(1, row(12), 0, front, 'arch');
  m.edge(0, row(14), 0, back, 'door').edge(-1, row(14), 0, back, 'slit').edge(1, row(14), 0, back, 'slit');
  m.edge(-1, row(13), 0, 'W', 'door').edge(1, row(13), 0, 'E', 'door');
  m.edge(-1, row(14), 0, 'W', 'slit').edge(1, row(14), 0, 'E', 'slit');
  m.edge(-1, row(12), 0, 'W', 'window').edge(1, row(12), 0, 'E', 'window');

  // Open stairs up both front corners, climbing inwards, with landings at their feet.
  m.tile('stairs_open', 2, row(12), 0, 2).tile('stairs_open', -2, row(12), 0, 0);
  m.tile('platform', 3, row(12), 0).tile('platform', -3, row(12), 0);
  // The long ramp up the back, beside the back door (east of it for Red, west for Blue).
  m.tile('ramp', X(1), row(16), 0, s > 0 ? 1 : 3);
  for (const lvl of [0, 1]) for (const r of [15, 16]) {
    m.edge(X(1), row(r), lvl, east, 'railing').edge(X(1), row(r), lvl, west, lvl === 0 ? 'wall' : 'railing');
  }
  m.edge(X(1), row(16), 0, back, 'open');

  // Vehicles out on the apron, nosed toward mid with room to drive out.
  m.mount('buggy', [fx(-22), ground(fx(-22), fz(84)), fz(84)], facing, team);
  m.mount('speeder', [fx(18), ground(fx(18), fz(84)), fz(84)], facing, team);
  m.mount('speeder', [fx(24), ground(fx(24), fz(84)), fz(84)], facing, team);
  m.mount('tank', [fx(-26), ground(fx(-26), fz(106)), fz(106)], facing, team);
  m.mount('skyfighter', [fx(26), ground(fx(26), fz(110)), fz(110)], facing, team);

  // Team spawns: in the hall, on the deck and on the apron.
  for (const [x, dz] of [[-9, 100], [9, 100], [-9, 110], [9, 110], [-4, 114]] as const) m.spawn([fx(x), 0, fz(dz)], facing, team);
  m.spawn([fx(-6), 4, fz(98)], facing, team).spawn([fx(6), 4, fz(98)], facing, team);
  m.spawn([fx(-14), ground(fx(-14), fz(90)), fz(90)], facing, team);

  // Pickups: rifles and an SMG in the hall, the sniper rifle on the roof, a shotgun by the back door.
  m.pickup('weapon_burst_rifle', [fx(-6), 0, fz(98)]).pickup('weapon_smg', [fx(6), 0, fz(98)]);
  m.pickup('weapon_hand_cannon', [fx(9), 0, fz(114)]).pickup('ammo_rifle', [fx(-9), 0, fz(114)]);
  m.pickup('grenades', [fx(-12.5), 0, fz(104)]).pickup('health_small', [fx(12.5), 0, fz(104)]);
  m.pickup('weapon_sniper', [fx(-8), 4, fz(108)]).pickup('ammo_sniper', [fx(8), 4, fz(108)]);
  m.pickup('weapon_shotgun', [fx(-4), ground(fx(-4), fz(124)), fz(124)]).pickup('ammo_shells', [fx(-8), ground(fx(-8), fz(126)), fz(126)]);
  m.pickup('armor_small', [fx(0), ground(0, fz(90)), fz(90)]);

  // Capture the Flag: the flag stands behind the dais on the ground floor.
  m.flag(team, [0, 0, fz(110.5)], facing);

  // The "teleporter": a pad off the west flank throws you onto the far west ledge (east for Blue).
  const lz = fz(70);
  const lx = -s * (halfW(-s * lz) + 5.5);
  const px = fx(-40);
  const pz = fz(98);
  m.padTo([px, ground(px, pz), pz], [+lx.toFixed(2), ground(lx, lz), lz], 26);

  // Apron dressing: sandbag-ish barriers, crates, a light either side of the front door.
  m.prop('barrier', [fx(-6), ground(fx(-6), fz(91)), fz(91)]).prop('barrier', [fx(6), ground(fx(6), fz(91)), fz(91)]);
  m.prop('crate_large', [fx(-30), ground(fx(-30), fz(118)), fz(118)], 0.3).prop('crate_small', [fx(-30), ground(fx(-30), fz(121)), fz(121)], 0.1);
  m.prop('cargo_crate', [fx(30), ground(fx(30), fz(122)), fz(122)], 1.4);
  m.prop('lightpost', [fx(-13), ground(fx(-13), fz(92)), fz(92)]).prop('lightpost', [fx(13), ground(fx(13), fz(92)), fz(92)]);
  m.breakable('barrel', [fx(14), ground(fx(14), fz(120)), fz(120)]);
}
buildBase(1, red);
buildBase(-1, blue);

// ---------------------------------------------------------------- the field

// Point-symmetric pairs (each listed for the north half; the south gets its turn).
const field: [string, number, number][] = [
  ['weapon_plasma', -46, 6], // by the west outcrop
  ['health_large', 46, 30],
  ['weapon_launcher', -22, 42], // on the big hill
  ['ammo_explosive', 26, 64],
  ['armor_small', 38, 18],
  ['weapon_rifle', -30, 70],
  ['ammo_rifle', 10, 46],
  ['health_small', -8, 24],
  ['grenades', 34, 44],
];
const singles: [string, number, number][] = [['weapon_rockets', 4, 4], ['armor_large', -4, -4]];
for (const [item, x, z] of field) {
  m.pickup(item, [x, ground(x, z), z]);
  m.pickup(item, [-x, ground(-x, -z), -z]);
}
for (const [item, x, z] of singles) m.pickup(item, [x, ground(x, z), z]);
// Up on the ledges: sniper ammo and a little health for the perches.
for (const s of [1, -1] as const) {
  for (const z of [40, -40]) {
    const x = s * (halfW(z) + 5.5);
    m.pickup(z > 0 ? 'ammo_sniper' : 'health_small', [+x.toFixed(2), ground(x, s * z), s * z]);
  }
}
// Free-for-all spawns spread over the field and the ledges.
const ffa: [number, number][] = [[-30, 30], [30, 50], [-44, 60], [0, 30], [44, 0], [16, 82]];
for (const [x, z] of ffa) {
  m.spawn([x, ground(x, z), z], z > 0 ? Math.PI : 0);
  m.spawn([-x, ground(-x, -z), -z], z > 0 ? 0 : Math.PI);
}
for (const s of [1, -1] as const) {
  const x = s * (halfW(s * 0) + 5.5);
  m.spawn([+x.toFixed(2), ground(x, 0), 0], s > 0 ? -Math.PI / 2 : Math.PI / 2);
}

// King of the Hill: the rocket knoll, then the big hills in each half.
m.hill([4, ground(4, 4), 4], 6).hill([-22, ground(-22, 42), 42], 6).hill([22, ground(22, -42), -42], 6);

// ---------------------------------------------------------------- rocks, bushes and trees

let seed = 20011115;
const rand = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
const placed: [number, number, number][] = [];
const freeAt = (x: number, z: number, r: number) => placed.every(([px, pz, pr]) => Math.hypot(px - x, pz - z) > r + pr + 2.5);
const marks: [number, number, number][] = [
  ...[...field, ...singles].flatMap(([, x, z]) => [[x, z, 4], [-x, -z, 4]] as [number, number, number][]),
  ...ffa.flatMap(([x, z]) => [[x, z, 3], [-x, -z, 3]] as [number, number, number][]),
  [4, 4, 7], [-22, 42, 6], [22, -42, 6],
  // pad lanes: from each pad toward its ledge
  ...[1, -1].flatMap((s) => Array.from({ length: 8 }, (_, k) => [s * (-40 - k * 3), s * (98 - k * 3.6), 4] as [number, number, number])),
];
const open = (x: number, z: number, r: number) =>
  apron(x, z) < 0.05 &&
  Math.abs(z) < END_Z - 6 &&
  Math.abs(x) < foot(x, z) - 3 - r &&
  Math.abs(x - pathX(z)) > 3.5 + r &&
  marks.every(([mx, mz, mr]) => Math.hypot(mx - x, mz - z) > mr + r);
const put = (model: string, x: number, z: number, scale: number, sink = 0.25, solid = true) =>
  m.prop(model, [+x.toFixed(2), +(ground(x, z) - sink * scale).toFixed(2), +z.toFixed(2)], +(rand() * Math.PI * 2).toFixed(3), scale, solid);

// Big boulders across the floor, in point-symmetric pairs.
const BOULDERS: [string, number, number][] = [
  // model, scale from, scale range
  ['rock_large', 1.6, 1.4],
  ['boulder_jagged', 0.8, 0.6],
  ['rock_large', 2, 1.2],
  ['nt_boulder', 2.2, 1.4],
  ['boulder_round', 0.55, 0.4],
];
const reach = (model: string, scale: number) => {
  const size = CORE_PROPS.find((p) => p.id === `prop.${model}`)!.size;
  return (Math.max(size[0], size[2]) / 2) * scale;
};
for (let n = 0; n < 900 && placed.length < 44; n++) {
  const x = (rand() - 0.5) * 110;
  const z = (rand() - 0.5) * 170;
  const [model, s0, sr] = BOULDERS[Math.floor(rand() * BOULDERS.length)]!;
  const scale = +(s0 + rand() * sr).toFixed(2);
  const r = reach(model, scale);
  if (!open(x, z, r) || !open(-x, -z, r) || !freeAt(x, z, r) || !freeAt(-x, -z, r)) continue;
  placed.push([x, z, r], [-x, -z, r]);
  put(model, x, z, scale);
  put(model, -x, -z, scale);
}
// Rock outcrops against the side cliffs near mid: a horseshoe of tall rocks round a sheltered nook.
for (const s of [1, -1] as const) {
  const cz = s * 6;
  const footX = s * halfW(s * cz);
  const ring: [number, number, string, number][] = [
    [-s * 4, cz - 7, 'rock_spire_tall', 2.2],
    [-s * 9, cz - 4, 'boulder_jagged', 1.9],
    [-s * 10, cz + 3, 'rocks_tall', 2.4],
    [-s * 5, cz + 8, 'rock_spire_tall', 2],
    [-s * 1, cz + 10, 'boulder_jagged', 1.7],
  ];
  for (const [dx, z, model, scale] of ring) {
    put(model, footX + dx, z, scale, 0.3);
    placed.push([footX + dx, z, reach(model, scale)]);
  }
}
// Spires and broken rock along the cliff foot.
for (let n = 0; n < 500 && placed.length < 84; n++) {
  const z = (rand() - 0.5) * 2 * (END_Z - 20);
  const side = rand() < 0.5 ? -1 : 1;
  const x = side * (foot(side, z) - 1 + rand() * 2);
  if (apron(x, z) > 0.05 || ledgeAt(x, z) || !freeAt(x, z, 3) || marks.some(([mx, mz, mr]) => Math.hypot(mx - x, mz - z) < mr + 4)) continue;
  // Keep the ledge ramps clear.
  const rz = side > 0 ? z : -z;
  if (rz > 68 && rz < 120) continue;
  placed.push([x, z, 3]);
  put(rand() < 0.5 ? 'rocks_tall' : 'rock_spire_tall', x, z, +(1.2 + rand() * 1.1).toFixed(2), 0.4);
}
// Trees near the cliffs.
const TREES = ['nt_common_tree', 'tree', 'nt_common_tree_2', 'tree_round'];
for (let n = 0; n < 600 && placed.length < 112; n++) {
  const z = (rand() - 0.5) * 2 * (END_Z - 26);
  const side = rand() < 0.5 ? -1 : 1;
  const x = side * (foot(side, z) - 6 - rand() * 8);
  if (!open(x, z, 1.5) || !freeAt(x, z, 2)) continue;
  placed.push([x, z, 2]);
  put(TREES[Math.floor(rand() * TREES.length)]!, x, z, +(1 + rand() * 0.5).toFixed(2), 0.05);
}
// Leafy bushes on the flanks to hide in (walk-through).
let bushes = 0;
for (let n = 0; n < 2000 && bushes < 110; n++) {
  const z = (rand() - 0.5) * 2 * (END_Z - 30);
  const side = rand() < 0.5 ? -1 : 1;
  const x = side * (foot(side, z) - 4 - rand() * 22);
  if (!open(x, z, 0.8) || !freeAt(x, z, 0.3)) continue;
  placed.push([x, z, 0.8]);
  bushes++;
  put(rand() < 0.7 ? 'nt_bush_leafy' : 'bush_large', x, z, +(1.2 + rand() * 0.8).toFixed(2), 0.05, false);
}
// Small rocks, tall grass and wildflowers for detail.
for (let n = 0; n < 2000 && placed.length < 420; n++) {
  const x = (rand() - 0.5) * 112;
  const z = (rand() - 0.5) * 2 * (END_Z - 12);
  if (!open(x, z, 0.4) || !freeAt(x, z, 0.1)) continue;
  placed.push([x, z, 0.4]);
  const pick = rand();
  if (pick < 0.3) put(rand() < 0.5 ? 'rock_small' : 'nt_rock_moss', x, z, +(1 + rand()).toFixed(2), 0.15);
  else if (pick < 0.75) put('grass_tall', x, z, +(1 + rand() * 0.6).toFixed(2), 0, false);
  else put('nt_wildflowers', x, z, +(1.5 + rand()).toFixed(2), 0, false);
}

// ---------------------------------------------------------------- map settings

m.backdrop('sunset', 'mountains', 'grass', 0.45, 0.35);
m.bounds('invisible', 0, { min: [-78, -156], max: [78, 156] }, 40);
m.teams([8, 8]);
m.furnish();
await m.fillTeamSpawns(8);
m.lightRooms();
m.meta({
  description:
    'A long grassy box canyon walled in by sheer rock, with two squat concrete bunkers facing each other from the far ends: Red holds the north, Blue the south. Each bunker keeps its flag behind the dais on the ground floor, a sniper rifle on its roof deck (open stairs at the front corners, a long ramp up the back) and a buggy, two speeders, a tank and a skyfighter on the apron. A jump pad beside each base throws you onto the 10 m sniper ledge along the far side cliff; each ledge also has a ramp at one end. Rolling grass, boulders, rock outcrops by the cliffs and bushes to hide in fill the floor; rockets wait on the knoll in the middle. A layout homage to the classic two-base canyon of 2001.',
  modes: ['core.ctf', 'core.tdm', 'core.deathmatch', 'core.koth'],
  players: [4, 16],
});
await m.save();
