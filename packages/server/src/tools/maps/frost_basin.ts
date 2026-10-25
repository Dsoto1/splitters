/**
 * Frost Basin: a big snowy basin ringed by mountains, two hilltop bases at
 * opposite ends and a lonely tower in the middle (homage in spirit to the
 * huge outdoor team maps of Tribes 2, Katabatic and friends). Bases sit on
 * 12 m plateaus whose fronts drop as rock cliffs: jump pads at the foot throw
 * you up, vehicles take the gentle flank roads. Two rocky ridges cut across
 * the field with a narrow pass in the middle; pads put you on their crests.
 *
 * Top-down (x east, z north; metres), point-symmetric about the centre:
 *
 *   z +150  ~~~~~~~~~~~~~~~ mountains ~~~~~~~~~~~~~~~
 *   z +104   hauler [ TIDE: hall + railed roof, MG + rocket turrets ] buggy
 *   z  +84   speeder        ===== cliff, 2 pads =====       road ->
 *   z  +50        /\/\/\/\/\/\  pass  /\/\/\/\/\/\      (north ridge)
 *   z    0   rockets ·   pines   [OUTPOST: 3 storeys]   pines  · double dmg
 *   z  -50      (south ridge)  /\/\/\/\/\  pass  /\/\/\/\/\/\
 *   z  -84   <- road        ===== cliff, 2 pads =====       speeder
 *   z -104   buggy [ EMBERS: hall + railed roof, MG + rocket turrets ] hauler
 *   z -150  ~~~~~~~~~~~~~~~ mountains ~~~~~~~~~~~~~~~
 *
 * Gravel roads loop round both ridge ends from base to base; a footpath runs
 * straight down the middle through the passes. Snow everywhere, stone on the
 * steep faces and a band of bare rock round the mountains.
 */
import { TERRAIN_MATERIALS, newTerrain, paintSlopes, terrainHeightAt, type TerrainData, type TerrainMaterial } from '@chronosplit/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('frost_basin', 'Frost Basin');
m.theme('arctic');

// ---------------------------------------------------------------- terrain shape

const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const bump = (x: number, z: number, cx: number, cz: number, r: number, h: number) => h * Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (r * r));
/** Evaluate f and its 180° turn, so the two halves of the map are fair. */
const sym = (f: (x: number, z: number) => number) => (x: number, z: number) => Math.max(f(x, z), f(-x, -z));
const symAvg = (f: (x: number, z: number) => number) => (x: number, z: number) => (f(x, z) + f(-x, -z)) / 2;

const BASE_Y = 12; // plateau height (tile level 3)
const PLATEAU = { x0: -34, x1: 34, z0: -122, z1: -84 }; // the south one; the north one is its turn

/** Plateau weight for the south base: 1 on top, falling away; the front (north) face is a cliff in the middle. */
function plateauSouth(x: number, z: number, soft = 1): number {
  const dx = Math.max(PLATEAU.x0 - x, x - PLATEAU.x1, 0);
  const front = Math.max(z - PLATEAU.z1, 0);
  const back = Math.max(PLATEAU.z0 - z, 0);
  const frontW = lerp(8, 40, smooth(14, 30, Math.abs(x))) * soft;
  return (1 - smooth(0, 40 * soft, dx)) * (1 - smooth(0, frontW, front)) * (1 - smooth(0, 12 * soft, back));
}
const plateau = sym(plateauSouth);
const plateauCore = sym((x, z) => plateauSouth(x, z, 0.15));

/** South ridge line z = -48 + 0.3x, short at its west end (near the base slope) so the road gets round. */
const ridgeZ = (x: number) => -48 + 0.3 * x;
const RIDGE_N = [-0.3 / Math.hypot(1, 0.3), 1 / Math.hypot(1, 0.3)] as const; // unit normal pointing north
function ridgeSouth(x: number, z: number): number {
  const d = Math.abs(z - ridgeZ(x)) * RIDGE_N[1];
  const ax = Math.abs(x);
  const along = (7 + 1.6 * Math.sin(x / 7) + 0.8 * Math.cos(x / 3.1)) * smooth(5, 11, ax) * (1 - (x < 0 ? smooth(36, 48, ax) : smooth(58, 74, ax)));
  return along * (1 - smooth(3, 9, d));
}
const ridges = sym(ridgeSouth);

/** Outpost footprint, kept flat at 0. */
const outpostFlat = (x: number, z: number) => (1 - smooth(2, 12, Math.max(Math.abs(x) - 13, 0))) * (1 - smooth(2, 12, Math.max(Math.abs(z) - 5, 0)));

const rolling = symAvg((x, z) => 1.1 * Math.sin(x / 17 + 0.4) * Math.cos(z / 21) + 0.8 * Math.sin(z / 29 + x / 37) + 0.4 * Math.cos(x / 9 - z / 13));
const hills = sym((x, z) => bump(x, z, 46, 18, 14, 5) + bump(x, z, -40, -24, 11, 3.5) + bump(x, z, 92, -70, 16, 6) + bump(x, z, -20, 22, 8, 2.2) + bump(x, z, 30, -72, 10, 3));
const rim = (x: number, z: number) => {
  const d = Math.hypot(x / 118, z / 142);
  const a = Math.atan2(z, x);
  return smooth(0.8, 1.02, d) * (30 + 6 * Math.sin(a * 5) + 4 * Math.cos(a * 9 + 1));
};

function height(x: number, z: number): number {
  let h = Math.max(0, rolling(x, z) + 0.6) + hills(x, z);
  h = Math.max(h, ridges(x, z));
  h *= 1 - outpostFlat(x, z);
  const p = plateau(x, z);
  h = lerp(h, BASE_Y, p);
  return h + rim(x, z) * (1 - plateauCore(x, z));
}

let terrain: TerrainData = { ...newTerrain(300, 2, [0, 0], 'snow'), baseY: -0.15 };
terrain = {
  ...terrain,
  heights: terrain.heights.map((_, i) => {
    const c = i % terrain.cols;
    const r = Math.floor(i / terrain.cols);
    return Math.round(height(terrain.origin[0] + c * terrain.spacing, terrain.origin[1] + r * terrain.spacing) * 100);
  }),
};

// Roads: polylines (south half; each is also laid turned 180°).
type P = [number, number];
const ROADS: P[][] = [
  [[26, -88], [42, -70], [64, -56], [84, -38], [88, -12], [80, 6]], // east loop round the ridge end
  [[-26, -88], [-42, -70], [-64, -56], [-84, -38], [-88, -12], [-80, 6]], // west loop
];
const FOOTPATH: P[] = [[0, -74], [0, -56], [0, -40], [-3, -20], [0, -6]];
const segDist = (x: number, z: number, [ax, az]: P, [bx, bz]: P) => {
  const vx = bx - ax;
  const vz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
  return Math.hypot(x - ax - vx * t, z - az - vz * t);
};
const lineDist = (x: number, z: number, line: P[]) => Math.min(...line.slice(1).map((b, i) => segDist(x, z, line[i]!, b)));
const roadDist = (x: number, z: number) => Math.min(...ROADS.map((l) => Math.min(lineDist(x, z, l), lineDist(-x, -z, l))));
const pathDist = (x: number, z: number) => Math.min(lineDist(x, z, FOOTPATH), lineDist(-x, -z, FOOTPATH));

const mat = (n: TerrainMaterial) => TERRAIN_MATERIALS.indexOf(n);
terrain = {
  ...terrain,
  materials: terrain.materials.map((v, i) => {
    const c = i % (terrain.cols - 1);
    const r = Math.floor(i / (terrain.cols - 1));
    const x = terrain.origin[0] + (c + 0.5) * terrain.spacing;
    const z = terrain.origin[1] + (r + 0.5) * terrain.spacing;
    if (Math.abs(x) < 30 && Math.abs(z) > 86 && Math.abs(z) < 120) return mat('gravel');
    if (outpostFlat(x, z) > 0.7) return mat('gravel');
    if (roadDist(x, z) < 3) return mat('gravel');
    if (pathDist(x, z) < 1.8) return mat('gravel');
    if (ridges(x, z) > 5.5) return mat('stone');
    if (rim(x, z) > 8 && rim(x, z) < 20) return mat('stone');
    return v;
  }),
};
terrain = paintSlopes(terrain, 36, 'stone');
m.terrain(terrain);
const ground = (x: number, z: number) => +(terrainHeightAt(terrain, x, z) ?? 0).toFixed(2);

// ---------------------------------------------------------------- bases

const [embers, tide] = m.teamIds() as [string, string];
const P2 = Math.PI / 2;

/**
 * One base on its plateau (level 3): a great hall with a railed roof (level 4),
 * open stairs up both front corners, a wide doorway and arches facing mid,
 * side doors and windows, a back door. `s` is -1 for the south base, +1 north.
 */
function buildBase(s: 1 | -1, team: string): void {
  const L = 3;
  const front = s < 0 ? 'N' : 'S';
  const back = s < 0 ? 'S' : 'N';
  const yFront = s * 12;
  const yBack = s * 14;
  const y0 = Math.min(yFront, yBack);
  m.tile('hall', -1, y0, L);
  m.fill('platform_rail', -1, y0, 1, y0 + 2, L + 1);
  // Open stairs at the front corners, climbing inwards to the roof.
  m.tile('stairs_open', 2, yFront, L, 2);
  m.tile('stairs_open', -2, yFront, L, 0);
  // Landings at the foot of each flight: the first step is 0.4 m above the snow, too high to walk up.
  m.tile('platform', 3, yFront, L).tile('platform', -3, yFront, L);
  m.edge(0, yFront, L, front, 'wide').edge(-1, yFront, L, front, 'arch').edge(1, yFront, L, front, 'arch');
  m.edge(0, yBack, L, back, 'door').edge(-1, yBack, L, back, 'windows').edge(1, yBack, L, back, 'windows');
  m.edge(-1, s * 13, L, 'W', 'door').edge(1, s * 13, L, 'E', 'door');
  m.edge(-1, yBack, L, 'W', 'windows').edge(1, yBack, L, 'E', 'windows');

  const fz = (dz: number) => s * dz; // world z on this side, dz measured from the centre line toward the base
  const facing = s < 0 ? 0 : Math.PI;
  // Turrets on the roof: an MG over the front door, a rocket turret on a back corner.
  m.mount('turret_mg', [0, 16, fz(93.5)], facing, team);
  m.mount('turret_rocket', [s * 9, 16, fz(110)], facing, team);
  // Vehicles on the plateau flanks: buggy and speeder out front, hauler at the back.
  m.mount('buggy', [-s * 26, ground(-s * 26, fz(96)), fz(96)], facing);
  m.mount('speeder', [s * 26, ground(s * 26, fz(96)), fz(96)], facing);
  m.mount('hauler', [s * 25, ground(s * 25, fz(114)), fz(114)], facing);
  // Jump pads at the foot of the cliff throw you up onto the apron.
  for (const x of [-7, 7]) m.pad([x, ground(x, fz(72)), fz(72)], facing + Math.PI, 24, 14);
  // Team spawns: four in the hall, two on the flanks.
  for (const [x, dz] of [[-9, 104], [9, 104], [-4, 113], [4, 113]] as const) m.spawn([x, BASE_Y, fz(dz)], facing, team);
  for (const x of [-27, 27]) m.spawn([x, ground(x, fz(90)), fz(90)], facing, team);
  // Yard dressing: crates by the doors, barriers along the cliff top.
  m.prop('crate_large', [-15, ground(-15, fz(92)), fz(92)], 0.2).prop('crate_small', [-15.5, ground(-15.5, fz(90.4)), fz(90.4)]);
  m.prop('container_tall', [15, ground(15, fz(108)), fz(108)]).prop('cargo_crate', [17, ground(17, fz(104)), fz(104)], 0.4);
  m.prop('barrier', [-17, ground(-17, fz(86)), fz(86)]).prop('barrier', [17, ground(17, fz(86)), fz(86)]);
  m.prop('metal_panel', [0, ground(0, fz(88)), fz(88)], 0);
  m.breakable('barrel', [-20, ground(-20, fz(100)), fz(100)]).breakable('gas', [20, ground(20, fz(118)), fz(118)]);
  m.prop('lightpost', [-30, ground(-30, fz(86)), fz(86)]).prop('lightpost', [30, ground(30, fz(86)), fz(86)]);
  // Base pickups: the disc launcher before the dais, rifles in the hall, a sniper rifle on the roof.
  m.pickup('weapon_disc_launcher', [0, BASE_Y, fz(99.6)]);
  m.pickup('weapon_rifle', [-9, BASE_Y, fz(98)]).pickup('weapon_smg', [9, BASE_Y, fz(98)]);
  m.pickup('ammo_rifle', [-10, BASE_Y, fz(114)]).pickup('grenades', [10, BASE_Y, fz(114)]);
  m.pickup('health_small', [0, BASE_Y, fz(114)]).pickup('armor_small', [-26, ground(-26, fz(104)), fz(104)]);
  m.pickup('weapon_sniper', [0, 16, fz(108)]).pickup('ammo_sniper', [-8, 16, fz(100)]);
  // Capture the Flag: the flag stands behind the dais in the middle of the hall.
  m.flag(team, [0, BASE_Y, fz(107.6)], facing);
}
buildBase(-1, embers);
buildBase(1, tide);

// ---------------------------------------------------------------- the outpost

// Ground floor: two rooms and a stairwell; first floor: a lookout room and a
// second stairwell to the railed roof (8 m), where the railgun waits.
m.tile('room', -1, 0, 0).tile('room_cover', 0, 0, 0).tile('stairwell', 1, 0, 0, 0);
m.tile('room', 0, 0, 1).tile('stairwell', -1, 0, 1, 2);
m.tile('platform_rail', 0, 0, 2).tile('platform_rail', 1, 0, 2);
m.edge(-1, 0, 0, 'W', 'wide').edge(-1, 0, 0, 'N', 'door').edge(-1, 0, 0, 'S', 'door');
m.edge(0, 0, 0, 'N', 'arch').edge(0, 0, 0, 'S', 'arch');
m.edge(1, 0, 0, 'E', 'windows');
for (const side of ['N', 'S'] as const) m.edge(0, 0, 1, side, 'windows');
m.edge(-1, 0, 1, 'N', 'slit').edge(-1, 0, 1, 'S', 'slit');
m.pickup('weapon_railgun', [6, 8, 0]).pickup('armor_large', [-8, 0, 0]).pickup('health_large', [0, 4, 0]);
m.pickup('ammo_cells', [-3, 8, 2]);
m.spawn([-8, 0, 2.5], P2).spawn([0, 4, 2], -P2);
// Sandbag-ish cover round the outpost.
m.prop('barrier', [-18, 0, 7]).prop('barrier', [18, 0, -7]).prop('crate_large', [6, 0, 8], 1.2).prop('crate_large', [-6, 0, -8], 1.2);
m.prop('barrier_high', [14, 0, 8]).prop('barrier_high', [-14, 0, -8]);
// King of the Hill: the outpost roof, and each ridge pass.
m.hill([4, 8, 0], 5).hill([0, ground(0, 50), 50], 6).hill([0, ground(0, -50), -50], 6);

// ---------------------------------------------------------------- ridges: pads onto the crests

for (const s of [-1, 1] as const) {
  for (const ax of [-34, 34]) {
    const x = s * ax;
    const cz = s * ridgeZ(ax);
    for (const side of [-1, 1] as const) {
      // 9 m off the crest line, thrown back across onto it.
      const nx = s * RIDGE_N[0] * side;
      const nz = s * RIDGE_N[1] * side;
      const px = +(x + nx * 9.5).toFixed(2);
      const pz = +(cz + nz * 9.5).toFixed(2);
      m.pad([px, ground(px, pz), pz], Math.atan2(-nx, -nz), 20, 6);
    }
  }
}
// Crest rewards.
for (const s of [-1, 1] as const) {
  m.pickup('health_large', [s * 40, ground(s * 40, s * ridgeZ(40)), s * ridgeZ(40)]);
  m.pickup('ammo_explosive', [-s * 28, ground(-s * 28, s * ridgeZ(-28)), s * ridgeZ(-28)]);
}

// ---------------------------------------------------------------- the field

// Power and support weapons out on the flanks and in the dips (point-symmetric pairs).
const field: [string, number, number][] = [
  ['weapon_rockets', 74, 0],
  ['powerup_damage', -74, 0],
  ['weapon_plasma', 50, -20], ['weapon_plasma', -50, 20],
  ['weapon_launcher', -10, -66], ['weapon_launcher', 10, 66],
  ['weapon_lmg', 60, -66], ['weapon_lmg', -60, 66],
  ['weapon_shotgun', -14, -30], ['weapon_shotgun', 14, 30],
  ['ammo_explosive', 70, 10], ['ammo_explosive', -70, -10],
  ['ammo_cells', 56, -14], ['ammo_cells', -56, 14],
  ['health_small', 20, -18], ['health_small', -20, 18],
  ['health_large', 88, -30], ['health_large', -88, 30],
  ['armor_small', -30, -40], ['armor_small', 30, 40],
  ['mines', 0, -60], ['mines', 0, 60],
  ['ammo_rifle', -50, -40], ['ammo_rifle', 50, 40],
];
for (const [item, x, z] of field) m.pickup(item, [x, ground(x, z), z]);
// Two roaming spawns out on the flanks for deathmatch.
m.spawn([-66, ground(-66, -8), -8], 0).spawn([66, ground(66, 8), 8], Math.PI);

// ---------------------------------------------------------------- rocks and pines

let seed = 7654321;
const rand = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
const placed: [number, number, number][] = [];
const free = (x: number, z: number, r: number) => placed.every(([px, pz, pr]) => Math.hypot(px - x, pz - z) > r + pr + 3);
const busy: [number, number, number][] = [
  // keep clear: outpost, pads, pickups
  [0, 0, 18],
  ...field.map(([, x, z]) => [x, z, 3] as [number, number, number]),
];
const clear = (x: number, z: number, r: number) =>
  plateau(x, z) < 0.05 && rim(x, z) < 3 && roadDist(x, z) > 5 + r && pathDist(x, z) > 4 + r && ridges(x, z) < 0.5 && busy.every(([bx, bz, br]) => Math.hypot(bx - x, bz - z) > br + r);
const rock = (model: string, x: number, z: number, scale: number, sink = 0.3) =>
  m.prop(model, [+x.toFixed(2), +(ground(x, z) - sink * scale).toFixed(2), +z.toFixed(2)], +(rand() * Math.PI * 2).toFixed(3), scale);

// Boulders: cover across the field, mirrored so neither side gets more.
for (let n = 0; n < 600 && placed.length < 44; n++) {
  const x = (rand() - 0.5) * 200;
  const z = (rand() - 0.5) * 150;
  const scale = +(1.6 + rand() * 2).toFixed(2);
  const r = scale * 1.1;
  if (!clear(x, z, r) || !clear(-x, -z, r) || !free(x, z, r) || !free(-x, -z, r)) continue;
  placed.push([x, z, r], [-x, -z, r]);
  const model = rand() < 0.6 ? 'rock_large' : 'rock_medium';
  rock(model, x, z, scale);
  rock(model, -x, -z, scale);
}
// Spires along the ridges' feet and the mountain foot.
for (let n = 0; n < 400 && placed.length < 80; n++) {
  const x = (rand() - 0.5) * 230;
  const z = (rand() - 0.5) * 260;
  const nearRidge = ridges(x, z) > 0.3 && ridges(x, z) < 3;
  const nearRim = rim(x, z) > 1 && rim(x, z) < 6;
  if ((!nearRidge && !nearRim) || plateau(x, z) > 0.05 || roadDist(x, z) < 8 || pathDist(x, z) < 6 || !free(x, z, 3)) continue;
  placed.push([x, z, 3]);
  rock('rocks_tall', x, z, +(1.2 + rand() * 1.2).toFixed(2), 0.4);
}
// Pine stands on the hills and round the basin edge.
const stands: P[] = [[46, 18], [-40, -24], [92, -70], [-92, 70], [-46, -18], [40, 24], [30, -72], [-30, 72], [-100, -20], [100, 20], [60, 100], [-60, -100]];
for (const [cx, cz] of stands) {
  for (let k = 0; k < 6; k++) {
    const x = cx + (rand() - 0.5) * 22;
    const z = cz + (rand() - 0.5) * 22;
    if (plateau(x, z) > 0.05 || roadDist(x, z) < 5 || pathDist(x, z) < 4 || ridges(x, z) > 0.5 || busy.some(([bx, bz, br]) => Math.hypot(bx - x, bz - z) < br + 1) || !free(x, z, 1)) continue;
    placed.push([x, z, 1]);
    m.prop(rand() < 0.6 ? 'pine' : 'pine_crooked', [+x.toFixed(2), +(ground(x, z) - 0.1).toFixed(2), +z.toFixed(2)], +(rand() * 6).toFixed(3), +(1.2 + rand() * 0.6).toFixed(2));
  }
}
// Small stuff: flat rocks, logs and stumps.
for (let n = 0; n < 400 && placed.length < 190; n++) {
  const x = (rand() - 0.5) * 210;
  const z = (rand() - 0.5) * 200;
  if (!clear(x, z, 0.6) || !free(x, z, 0.6)) continue;
  placed.push([x, z, 0.6]);
  const pick = rand();
  rock(pick < 0.75 ? 'rock_small' : pick < 0.9 ? 'log' : 'stump', x, z, pick < 0.75 ? 1.4 + rand() : 1, 0.1);
}

// ---------------------------------------------------------------- map settings

m.teams([8, 8]);
// Furniture in the bare rooms, for what they are in this theme.
m.furnish();
// Enough team spawns for a full match.
await m.fillTeamSpawns(8);
m.meta({
  description:
    'A wide snowy basin ringed by mountains. Embers hold the southern hilltop hall, Tide the northern one: each has a railed roof with turrets and a sniper rifle, a buggy, a speeder and a hauler, and a cliff out front that only jump pads climb, and its flag behind the dais in the hall. Two rocky ridges cross the field with a pass in the middle (hills in King of the Hill, with the outpost roof); the three-storey outpost at the centre hides the railgun on its roof, with rockets out on the east flank and double damage on the west. An homage in spirit to the great outdoor team maps of the early 2000s.',
  modes: ['core.tdm', 'core.deathmatch'],
  players: [4, 16],
});
await m.save();
