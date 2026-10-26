/**
 * Fogbound: trench warfare where the fog fills the trenches and the hilltops
 * stand clear. Our own map and name (MAP_IDEAS no. 7), built from the
 * Military Compound pack's trench set dug into a 200 m terrain, for 12–24
 * players in Capture the Flag and Team Deathmatch.
 *
 * - Two trench networks, one per side: a front line of Trench, Fire Step and
 *   Junction tiles across the field, three communication trenches back to
 *   the camp (Trench Mouths open onto it) and a roofed Dugout off the middle
 *   one with a single way in: the flag room. The tiles sit on the camp's
 *   ground level and the field is raised round them to the berm tops, so
 *   every trench is dug 1.3 m into the ground (1.6 m to the sandbag lip).
 * - Ground mist at 85% pools in the low ground: the trenches, the dugouts,
 *   the shell craters and the camps. Fights in the trench are point-blank
 *   shapes in the white; a fire step puts your head up into clearer air.
 * - No-man's-land: craters, steel hedgehogs, razor wire, broken barriers and
 *   a few proximity mines, rising to a central ridge 9 m over the field with
 *   a ruined chapel on the crest: the only high ground, a sniper duel above
 *   the clouds. The ridge falls away toward the flanks.
 * - The camps behind each line sit at trench level, in the fog, with two
 *   guard towers each (an MG on the lookout) that see over it.
 *
 * Top-down (x east, z north; one cell = 8 m):
 *
 *   z +88  [tower]      north camp (spawns)       [tower]
 *   z +72  mouth            mouth                  mouth
 *   z +56   |     [dugout = flag]-+                  |
 *   z +32  +=S==S==S====S==S==T==S==S====S==S==S=+     front line (S fire steps)
 *   z   0  . . . craters . . [chapel ridge] . . craters . . .
 *   z -32  +=S==S==S====S==S==T==S==S====S==S==S=+
 *   z -56   |                 +-[dugout = flag]  |
 *   z -72  mouth            mouth                  mouth
 *   z -88  [tower]      south camp (spawns)       [tower]
 */
import { type TerrainData } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('fogbound', 'Fogbound');
m.theme('military');
m.backdrop('overcast', 'hills', 'mud', 0.4, 0.85);
m.teams([12, 12]);
const [SOUTH, NORTH] = m.teamIds(2) as [string, string];

type V3 = [number, number, number];
type Rot = 0 | 1 | 2 | 3;
const C = 8;
const r2 = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------- the trench networks

/** Trench pieces of the south network, as [kind, x, y, rotation]; the north one is the same turned 180°. */
const SOUTH_NET: [string, number, number, Rot][] = [];
const FRONT = -4; // the front line's row (z -32)
// Front line: corners at both ends, the junction in the middle, fire steps up toward the enemy (north).
for (let x = -7; x <= 7; x++) {
  if (x === -7) SOUTH_NET.push(['trench_corner', x, FRONT, 0]); // south and east
  else if (x === 7) SOUTH_NET.push(['trench_corner', x, FRONT, 1]); // west and south
  else if (x === 0) SOUTH_NET.push(['trench_t', x, FRONT, 0]); // east, west and south
  else if ([-6, -4, -2, 2, 4, 6].includes(x)) SOUTH_NET.push(['trench_steps', x, FRONT, 3]); // steps up the north berm
  else SOUTH_NET.push(['trench', x, FRONT, 1]);
}
// Communication trenches back to the camp, each ending in a mouth that opens south onto it.
for (const x of [-7, 7]) {
  for (let y = FRONT - 1; y >= -8; y--) SOUTH_NET.push(['trench', x, y, 0]);
  SOUTH_NET.push(['trench_end', x, -9, 2]);
}
SOUTH_NET.push(['trench', 0, -5, 0], ['trench_steps', 0, -6, 2], ['trench_t', 0, -7, 3], ['trench', 0, -8, 0], ['trench_end', 0, -9, 2]);
// The flag dugout: off the middle trench to the east, roofed, one way in (its far end is boarded up).
SOUTH_NET.push(['trench_dugout', 1, -7, 1]);
const DUGOUT_END_X = 1.5 * C; // the boarded far end (south side), x 12

const NETS: { team: string; pieces: [string, number, number, Rot][]; s: 1 | -1 }[] = [
  { team: SOUTH, pieces: SOUTH_NET, s: 1 },
  { team: NORTH, pieces: SOUTH_NET.map(([k, x, y, r]) => [k, -x, -y, ((r + 2) % 4) as Rot]), s: -1 },
];
const trenchCells = new Set<string>();
for (const net of NETS) for (const [kind, x, y, rot] of net.pieces) {
  m.tile(`military.${kind}`, x, y, 0, rot);
  trenchCells.add(`${x},${y}`);
}

// ---------------------------------------------------------------- terrain

const PLAT = 1.3; // the field, level with the berm tops
const LOW = -0.15; // trench floors and the camps (just under the tiles' level)
const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
let seed = 1916;
const rand = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
/** Shell craters in no-man's-land: x, z, radius, depth. */
const CRATERS: [number, number, number, number][] = [];
for (let n = 0; n < 600 && CRATERS.length < 30; n++) {
  const x = (rand() - 0.5) * 140;
  const z = (rand() - 0.5) * 48;
  const rr = 2.5 + rand() * 2.5;
  // Clear of the trenches, the chapel and each other.
  if (Math.abs(z) > 24 - rr || (Math.abs(x) < 16 && Math.abs(z) < 10) || CRATERS.some(([cx, cz, cr]) => Math.hypot(cx - x, cz - z) < cr + rr + 3)) continue;
  CRATERS.push([r2(x), r2(z), r2(rr), r2(0.9 + rand() * 0.6)]);
}
const RIDGE = 9;
/** The field's height (before the trenches are cut). */
function field(x: number, z: number): number {
  const az = Math.abs(z);
  let h = LOW + (PLAT - LOW) * (1 - smooth(65, 73, az));
  // The ridge across the middle, highest at the chapel and falling away toward the flanks.
  const ridge = RIDGE * Math.exp(-((z / 15) ** 2)) * (0.4 + 0.6 * Math.exp(-((x / 48) ** 2)));
  // The crest is levelled round the chapel.
  const crest = RIDGE * (1 - smooth(13, 19, Math.abs(x))) * (1 - smooth(9, 14, az));
  h += Math.max(ridge, crest) + 0.25 * Math.sin(x / 9 + 1) * Math.cos(z / 11) * (1 - smooth(60, 70, az));
  for (const [cx, cz, cr, cd] of CRATERS) {
    const d = Math.hypot(x - cx, z - cz) / cr;
    if (d < 1.35) h -= cd * (1 - smooth(0.55, 1, d)) - 0.25 * smooth(0.8, 1, d) * (1 - smooth(1, 1.35, d));
  }
  return h;
}
/** A vertex is dug when every cell it touches is trench (vertices on a trench's outer edge stay up, inside its berms). */
const dug = (x: number, z: number): boolean => {
  const xs = Math.abs(x / C - Math.round(x / C) - 0.5) < 1e-6 ? [Math.floor(x / C), Math.ceil(x / C)] : [Math.round(x / C)];
  const zs = Math.abs(z / C - Math.round(z / C) - 0.5) < 1e-6 ? [Math.floor(z / C), Math.ceil(z / C)] : [Math.round(z / C)];
  return xs.every((cx) => zs.every((cy) => trenchCells.has(`${cx},${cy}`)));
};
const N = 101;
const SP = 2;
const ORIGIN: [number, number] = [-100, -100];
const heights: number[] = [];
const materials: number[] = [];
for (let r = 0; r < N; r++) {
  for (let c = 0; c < N; c++) {
    const x = ORIGIN[0] + c * SP;
    const z = ORIGIN[1] + r * SP;
    heights.push(Math.round((dug(x, z) ? LOW : field(x, z)) * 100));
  }
}
// Ground: mud in the field and the craters, grass on the ridge and the far flanks, gravel in the camps.
// Materials: 0 grass, 1 dirt, 2 stone, 4 gravel, 7 mud.
for (let r = 0; r < N - 1; r++) {
  for (let c = 0; c < N - 1; c++) {
    const x = ORIGIN[0] + (c + 0.5) * SP;
    const z = ORIGIN[1] + (r + 0.5) * SP;
    const h = field(x, z);
    const az = Math.abs(z);
    const crater = CRATERS.some(([cx, cz, cr]) => Math.hypot(x - cx, z - cz) < cr);
    materials.push(az > 72 ? 4 : crater ? 7 : h > PLAT + 4 ? 0 : h > PLAT + 1.2 ? 1 : Math.abs(x) > 70 ? 0 : 7);
  }
}
const terrain: TerrainData = { origin: ORIGIN, spacing: SP, cols: N, rows: N, baseY: 0, heights, materials, boundary: true, foliage: [] };
m.terrain(terrain);
const ground = (x: number, z: number) => r2(field(x, z));

// ---------------------------------------------------------------- per side: dugout, camp, towers

const P = Math.PI / 2;
for (const { team, s } of NETS) {
  const at = (x: number, z: number, y = 0): V3 => [r2(s * x), y, r2(s * z)];
  const face = s > 0 ? 0 : Math.PI; // toward the enemy
  // The dugout's boarded far end, and the flag under its roof.
  m.block(at(DUGOUT_END_X - 0.15, -7 * C), [0.3, 2.3, 3], 'solid', { material: 'pbr_weathered_planks' });
  m.flag(team, at(1 * C, -7 * C), s > 0 ? -P : P);
  m.light(at(1 * C, -7 * C, 2.1), { fixture: 'bulb', color: '#ffc870', intensity: 0.9, range: 6 });
  m.prop('ammo_stack', at(1 * C + 2.6, -7 * C - 1.1), face).prop('sv_radio', at(1 * C - 2.6, -7 * C + 1.1), face + P);

  // Guard towers at the base line, lookouts toward the enemy, an MG on each.
  for (const tx of [-5, 5]) {
    m.tile('military.guard_tower', s * tx, -11 * s, 0, s > 0 ? 2 : 0);
    m.mount('turret_mg', at(tx * C - 1.4, -11 * C - 2.2, 3), face, team);
    m.light(at(tx * C, -11 * C + 1, 5.2), { fixture: 'bulb', color: '#ffe0a8', intensity: 1, range: 10 });
  }
  // The camp: tents, stores, a truck, sandbags, lamps, all at trench level in the fog.
  for (const [x, z, yaw] of [[-20, -84, 0], [20, -84, 0], [-30, -92, P], [30, -92, -P]] as const) m.prop('tent_canvas', at(x, z), yaw + face);
  for (const [x, z] of [[-12, -95], [12, -95]] as const) m.prop('camo_net', at(x, z), face, 1, false);
  m.prop('supply_truck', at(-12, -95), face + 0.2).prop('flatbed_truck', at(12, -95), face - 0.2);
  for (const [x, z] of [[-26, -80], [26, -80], [-48, -82], [48, -82]] as const) m.prop('ammo_crate', at(x, z), face).prop('fuel_drum', at(x + 1.4, z - 0.6), 0);
  for (const [x, z] of [[-36, -78], [36, -78], [-8, -80], [8, -80]] as const) m.prop('sandbag_wall', at(x, z), face);
  for (const [x, z] of [[-30, -86], [30, -86], [0, -94]] as const) {
    m.prop('yard_lamp', at(x, z), face);
    m.light(at(x, z, 4.2), { fixture: 'none', color: '#ffd9a0', intensity: 1, range: 13 });
  }
  // Duckboard ammo and gear down the trenches.
  m.prop('ammo_crate', at(-7 * C + 0.9, -6 * C), 0).prop('sandbag_wall_low', at(7 * C - 0.9, -7 * C), P);
  m.prop('ammo_stack', at(-3 * C, FRONT * C - 0.9), 0).prop('ammo_crate', at(3 * C, FRONT * C - 0.9), 0);

  // Spawns: two rows across the camp, facing the line.
  for (const x of [-30, -22, -14, -6, 6, 14, 22, 30]) m.spawn(at(x, -80), face, team);
  for (const x of [-26, -2, 2, 26]) m.spawn(at(x, -90), face, team);

  // Pickups: shotguns and gas in the trenches, grenades and mines at the junctions, armour in the dugout.
  m.pickup('weapon_shotgun', at(-4 * C, FRONT * C)).pickup('weapon_auto_shotgun', at(4 * C, FRONT * C));
  m.pickup('gas_grenades', at(-6 * C + 1, FRONT * C)).pickup('gas_grenades', at(6 * C - 1, FRONT * C));
  m.pickup('grenades', at(0, FRONT * C)).pickup('mines', at(0, -6 * C));
  m.pickup('weapon_smg', at(-7 * C, -6 * C)).pickup('weapon_lmg', at(7 * C, -6 * C));
  m.pickup('armor_small', at(1 * C - 2, -7 * C)).pickup('health_large', at(0, -8 * C));
  m.pickup('health_small', at(-7 * C, -8 * C)).pickup('health_small', at(7 * C, -8 * C)).pickup('health_small', at(-1 * C, FRONT * C));
  m.pickup('ammo_shells', at(-5 * C, FRONT * C)).pickup('ammo_rifle', at(5 * C, FRONT * C)).pickup('ammo', at(-16, -86)).pickup('ammo', at(16, -86));
  m.pickup('weapon_rifle', at(-34, -84)).pickup('weapon_rifle', at(34, -84)).pickup('weapon_marksman', at(0, -86));
}

// ---------------------------------------------------------------- no-man's-land

// Hedgehogs, wire, broken barriers and rubble between the lines (off the trench lips and the crater bottoms).
const clutter: [string, number, number, number][] = [];
for (let n = 0; n < 400 && clutter.length < 46; n++) {
  const x = r2((rand() - 0.5) * 136);
  const z = r2((rand() - 0.5) * 50);
  if (Math.abs(z) > 25 || (Math.abs(x) < 18 && Math.abs(z) < 12)) continue;
  if (CRATERS.some(([cx, cz, cr]) => Math.hypot(cx - x, cz - z) < cr + 1)) continue;
  if (clutter.some(([, cx, cz]) => Math.hypot(cx - x, cz - z) < 6)) continue;
  const kinds = ['hedgehog', 'hedgehog', 'razor_wire', 'razor_wire', 'jersey_barrier_broken', 'brick_rubble', 'rock_large', 'nt_dead_tree', 'sandbag_wall_low', 'dragon_tooth'];
  clutter.push([kinds[clutter.length % kinds.length]!, x, z, r2(rand() * Math.PI * 2)]);
}
for (const [kind, x, z, yaw] of clutter) m.prop(kind, [x, ground(x, z), z], yaw, 1, kind !== 'razor_wire');
// Wire belts in front of each line, with gaps at the fire steps.
for (const s of [1, -1]) for (const x of [-52, -28, -12, 12, 28, 52]) m.prop('razor_wire', [x, PLAT, s * -26.5], 0, 1.2, false);
// Proximity mines in the open between the craters.
for (const [x, z] of [[-40, 6], [40, -6], [-22, -18], [22, 18], [-62, -14], [62, 14]] as const) {
  m.add({ kind: 'trap', trap: 'mine', position: [x, ground(x, z), z], yaw: 0, activation: 'proximity', onSeconds: 0.5, offSeconds: 25, offsetSeconds: 0, startEnabled: true, damage: null });
}

// The ruined chapel on the crest: broken walls, a standing arch, columns and rubble; a stone floor.
const TOP = r2(field(0, 0));
m.block([0, TOP - 0.3, 0], [12, 0.3, 18], 'solid', { material: 'pbr_castle_stone', tint: '#b8b4a8' });
for (const [model, x, z, yaw] of [
  ['rn_wall', -6, -4, Math.PI / 2], ['rn_wall_broken', -6, 4, Math.PI / 2], ['rn_wall_hole', 6, -4, -Math.PI / 2], ['rn_wall_half', 6, 4, -Math.PI / 2],
  ['rn_arch_gothic', 0, 9, 0], ['rn_wall_broken', -3.5, -9, 0], ['rn_buttress', -6.6, 0, Math.PI / 2], ['rn_buttress', 6.6, 0, -Math.PI / 2],
  ['rn_column_broken', -3, 2, 0], ['rn_column_round', 3, -2, 0], ['brick_rubble', 2.5, 5, 0.6], ['brick_rubble', -2, -6, 2],
] as [string, number, number, number][]) m.prop(model, [x, TOP, z], yaw);
for (const [x, z] of [[-14, 6], [15, -5], [-10, -12], [11, 12]] as const) m.prop('rn_dead_tree', [x, ground(x, z), z], x / 7, 1);
m.pickup('weapon_sniper', [0, TOP, -1]).pickup('ammo_sniper', [-3, TOP, 4]).pickup('ammo_sniper', [3, TOP, -6]);
m.pickup('armor_large', [0, TOP, 6]).pickup('health_small', [-14, ground(-14, 0), 0]).pickup('health_small', [14, ground(14, 0), 0]);
m.light([0, TOP + 3.2, 0], { fixture: 'none', color: '#fff2d8', intensity: 0.8, range: 12 });

m.bounds('invisible', 0, { min: [-78, -98], max: [78, 98] }, 30);
m.border('forest');
m.meta({
  description:
    'Trench warfare in the fog: two trench networks dug into a muddy field, ground mist pooling in every trench, crater and camp, and a ruined chapel on the ridge between them standing clear above it all. In the trench you see a shape three metres ahead and can\'t tell whose it is; climb a fire step and your head is up in clear air, in sight of the ridge. The flags sit in roofed dugouts with one way in; guard towers with machine guns watch over each camp.',
  modes: ['core.ctf', 'core.tdm'],
  players: [12, 24],
});
await m.save();
