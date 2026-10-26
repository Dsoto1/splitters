/**
 * Fort Meadow: a wide, gently rolling meadow made for Fort Wars. Two flag
 * bases stand 84 m apart on flat greens with plenty of open ground round
 * them to build on; a low ridge with two saddles crosses the middle (the
 * build-phase barrier runs along it), and grassy knolls on the flanks give
 * high ground to build up from. Point-symmetric, so both halves are fair.
 *
 * Top-down (x east, z north; metres):
 *
 *   z +66  ~~~~~~~~~~~ hills ~~~~~~~~~~~
 *   z +54        Tide spawns
 *   z +42   knoll      [ Tide flag ]      knoll
 *   z +20        open green to build on
 *   z   0   ~~~ ridge ~~ saddle ~~ rockets ~~ saddle ~~ ridge ~~~
 *   z -20        open green to build on
 *   z -42   knoll      [ Embers flag ]    knoll
 *   z -54        Embers spawns
 *   z -66  ~~~~~~~~~~~ hills ~~~~~~~~~~~
 */
import { TERRAIN_MATERIALS, newTerrain, terrainHeightAt, type TerrainData, type TerrainMaterial } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('fort_meadow', 'Fort Meadow');
m.theme('garden');
m.teams([6, 6]);
const [south, north] = m.teamIds(2) as [string, string];

const FLAG_Z = 42;
const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const bump = (x: number, z: number, cx: number, cz: number, r: number, h: number) => h * Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (r * r));
/** f and its half-turn: the two halves match. */
const sym = (f: (x: number, z: number) => number) => (x: number, z: number) => (f(x, z) + f(-x, -z)) / 2;

const rolling = sym((x, z) => 0.5 * Math.sin(x / 11 + 0.7) * Math.cos(z / 15) + 0.35 * Math.sin(z / 9 + x / 21));
/** The midfield ridge, with saddles at x = ±22 to run through. */
const ridge = (x: number, z: number) => 2.2 * Math.exp(-(z * z) / 30) * (1 - 0.85 * Math.exp(-((Math.abs(x) - 22) ** 2) / 40));
/** Knolls on the flanks of each base, and smaller humps out in the field. */
const knolls = (x: number, z: number) =>
  bump(x, z, -30, -40, 7, 3) + bump(x, z, 30, 40, 7, 3) + bump(x, z, 32, -36, 6, 2.2) + bump(x, z, -32, 36, 6, 2.2) + bump(x, z, -12, -18, 5, 1.2) + bump(x, z, 12, 18, 5, 1.2);
/** Flat greens round each flag (radius ~20 m), where the forts go. */
const green = (x: number, z: number) => Math.max(1 - smooth(14, 22, Math.hypot(x, z - FLAG_Z)), 1 - smooth(14, 22, Math.hypot(x, z + FLAG_Z)));
/** Hills round the outside. */
const rim = (x: number, z: number) => smooth(56, 70, Math.abs(x)) * 14 + smooth(62, 74, Math.abs(z)) * 14;

function height(x: number, z: number): number {
  const field = Math.max(0, rolling(x, z) + 0.3) + ridge(x, z) + knolls(x, z);
  return field * (1 - green(x, z)) + rim(x, z);
}

let terrain: TerrainData = { ...newTerrain(140, 2, [0, 0], 'grass'), baseY: -0.1 };
terrain = {
  ...terrain,
  heights: terrain.heights.map((_, i) => {
    const c = i % terrain.cols;
    const r = Math.floor(i / terrain.cols);
    return Math.round(height(terrain.origin[0] + c * terrain.spacing, terrain.origin[1] + r * terrain.spacing) * 100);
  }),
};
const mat = (n: TerrainMaterial) => TERRAIN_MATERIALS.indexOf(n);
terrain = {
  ...terrain,
  materials: terrain.materials.map((v, i) => {
    const c = i % (terrain.cols - 1);
    const r = Math.floor(i / (terrain.cols - 1));
    const x = terrain.origin[0] + (c + 0.5) * terrain.spacing;
    const z = terrain.origin[1] + (r + 0.5) * terrain.spacing;
    if (Math.hypot(x, Math.abs(z) - FLAG_Z) < 4) return mat('gravel');
    if (Math.abs(z) < 3 && Math.abs(Math.abs(x) - 22) < 4) return mat('dirt');
    if (rim(x, z) > 5) return mat('moss');
    return v;
  }),
};
// Short grass only in the open (long grass and bushes would hide the forts' builders); some on the rim.
terrain = {
  ...terrain,
  foliage: terrain.materials.map((v, i) => {
    const c = i % (terrain.cols - 1);
    const r = Math.floor(i / (terrain.cols - 1));
    const x = terrain.origin[0] + (c + 0.5) * terrain.spacing;
    const z = terrain.origin[1] + (r + 0.5) * terrain.spacing;
    if (TERRAIN_MATERIALS[v] !== 'grass') return 0;
    return rim(x, z) > 1 ? 3 : 1;
  }),
};
m.terrain(terrain);
const ground = (x: number, z: number) => +(terrainHeightAt(terrain, x, z) ?? 0).toFixed(2);

// ---------------------------------------------------------------- bases (s = -1 south / Embers, +1 north / Tide)
for (const [s, team] of [[-1, south], [1, north]] as const) {
  const fz = (dz: number) => s * dz;
  const facing = s > 0 ? Math.PI : 0;
  const Z = fz(FLAG_Z);
  m.flag(team, [0, ground(0, Z), Z], facing);
  // Spawns in a line well behind the flag, clear of the green the fort goes on.
  for (const x of [-9, -6, -3, 0, 3, 6, 9]) m.spawn([x * s, ground(x * s, fz(56)), fz(56)], facing, team);
  m.spawn([-14 * s, ground(-14 * s, fz(52)), fz(52)], facing, team);
  // At home: a rifle, a grenade launcher for knocking down forts, grenades and health.
  m.pickup('weapon_rifle', [-4 * s, ground(-4 * s, fz(50)), fz(50)]);
  m.pickup('weapon_launcher', [4 * s, ground(4 * s, fz(50)), fz(50)]);
  m.pickup('grenades', [-16 * s, ground(-16 * s, fz(46)), fz(46)]).pickup('health_small', [16 * s, ground(16 * s, fz(46)), fz(46)]);
  m.pickup('ammo_explosive', [-30 * s, ground(-30 * s, fz(40)), fz(40)]);
  m.pickup('weapon_shotgun', [32 * s, ground(32 * s, fz(36)), fz(36)]).pickup('ammo_rifle', [24 * s, ground(24 * s, fz(24)), fz(24)]);
  m.pickup('weapon_smg', [-12 * s, ground(-12 * s, fz(18)), fz(18)]);
}
// The middle: rockets on the ridge between the saddles, armour and health out on the flanks.
m.pickup('weapon_rockets', [0, ground(0, 0), 0]);
m.pickup('armor_large', [-40, ground(-40, 6), 6]).pickup('armor_large', [40, ground(40, -6), -6]);
m.pickup('health_large', [-22, ground(-22, -8), -8]).pickup('health_large', [22, ground(22, 8), 8]);
m.pickup('ammo_explosive', [-44, ground(-44, -16), -16]).pickup('ammo_explosive', [44, ground(44, 16), 16]);

// ---------------------------------------------------------------- scenery (out of the build areas)
let seed = 4242;
const rand = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
const put = (model: string, x: number, z: number, scale: number, sink = 0.2, solid = true) =>
  m.prop(model, [+x.toFixed(2), +(ground(x, z) - sink * scale).toFixed(2), +z.toFixed(2)], +(rand() * Math.PI * 2).toFixed(3), scale, solid);
for (const [x, z, model, k] of [
  [-52, -30, 'rock_large', 1.6],
  [-48, 20, 'boulder_jagged', 1],
  [-40, -6, 'rock_small', 1.4],
  [-6, -6, 'rock_small', 1.2],
  [-36, 52, 'rock_large', 1.3],
  [-54, 46, 'boulder_jagged', 0.9],
] as const) {
  put(model, x, z, k);
  put(model, -x, -z, k);
}
// Trees along the rim, a pair at a time.
for (let n = 0, made = 0; n < 400 && made < 18; n++) {
  const x = (rand() - 0.5) * 120;
  const z = (rand() - 0.5) * 132;
  if (Math.abs(x) < 50 && Math.abs(z) < 58) continue;
  put(rand() < 0.5 ? 'nt_common_tree' : 'tree_round', x, z, +(1 + rand() * 0.4).toFixed(2), 0.05);
  put(rand() < 0.5 ? 'nt_common_tree' : 'tree_round', -x, -z, +(1 + rand() * 0.4).toFixed(2), 0.05);
  made++;
}

m.backdrop('clear', 'hills', 'grass', 0.35);
m.bounds('invisible', 0, { min: [-62, -70], max: [62, 70] }, 30);
m.meta({
  description:
    'A wide, gently rolling meadow made for Fort Wars: two flag bases 84 m apart on flat greens with room all round to build, a low ridge with two saddles across the middle (the build-phase barrier runs along it) and grassy knolls on the flanks for high ground. Grenade launchers at each base and rockets on the ridge for knocking the other side\'s fort down. Plays Capture the Flag and Team Deathmatch too.',
  modes: ['core.forts', 'core.ctf', 'core.tdm'],
  players: [4, 12],
});
await m.save();
