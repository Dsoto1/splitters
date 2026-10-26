/**
 * Glacier Line: a battle across a snowfield on an ice world, in a blizzard
 * (our own map and name, built only from our kit). The Defenders hold an ice
 * base cut into a glacier: a hangar with skyfighters and a transport, ice
 * corridors, a command centre whose alert lights go red when the enemy
 * crosses the field, a medical bay, and the power generator. In front of it
 * runs a trench line with mounted guns and a giant dish. The Attackers come
 * from a staging camp to the south, behind three giant four-legged walkers.
 *
 * - The walkers: there is no walker vehicle, so each is a block-built body
 *   (four jointed legs, a hull, a head with chin guns) carried by a mover
 *   that lurches 4 m forward at a time and rocks on every step, 60 m up the
 *   field and back. Its blocks stop players and shots, so you can hide under
 *   one, but its feet run over whoever they step into (movers at 4 m/s and
 *   up do).
 * - The base: the hangar mouth is open; doors on the medical bay and the
 *   entry hall; ice corridors join everything. Bomb site A is the generator
 *   room, B the back of the hangar.
 * - Red alert: Attackers entering the middle of the field switch the base's
 *   alert lights on (blinking red) with a siren; the command console
 *   switches them off again (or back on).
 *
 * Top-down (x east, z north; metres):
 *
 *   z +130   [COMMAND]==corr==[    HANGAR    ]==corr==[GENERATOR A]
 *   z +100   [MEDICAL]==corr==[ B  (mouth)   ]==corr==[ENTRY HALL ]
 *   z  +56   (dish) ==T==== trench line, turrets behind ======T==
 *   z    0          snowfield: drifts, craters, rocks
 *   z  -60       walker      walker      walker   (60 m patrols)
 *   z -115   [barracks]  [pad: gunship]  [barracks]   staging camp
 */
import { TERRAIN_MATERIALS, newTerrain, paintSlopes, terrainHeightAt, type ScenarioLogic, type TerrainData, type TerrainMaterial } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

type V3 = [number, number, number];
const m = new MapBuilder('glacier_line', 'Glacier Line');
m.theme('arctic');
m.backdrop('snowy', 'peaks', 'snow', 0.85, 0.55);
m.teams([16, 16]);
const [ATTACK, DEFEND] = m.teamIds(2) as [string, string];

const P = Math.PI / 2;
const S = Math.PI;
const r2 = (n: number) => Math.round(n * 100) / 100;
const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------- terrain

const LANES = [-48, 6, 58];
const WALK_Z0 = -92;
const STEP = 4;
const STEPS = 15;
const bump = (x: number, z: number, cx: number, cz: number, r: number, h: number) => h * Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (r * r));
const CRATERS: [number, number, number][] = [[-20, -20, 6], [30, 10, 7], [-70, -40, 6], [80, -60, 5], [-30, 30, 5], [96, 24, 6], [-100, 10, 6]];
function height(x: number, z: number): number {
  // Flat: the base and glacier foot, the trench band, the staging camp.
  const keepFlat = Math.max(z > 40 && z < 76 ? 1 : 0, smooth(76, 84, z), 1 - smooth(-104, -96, z));
  let h = Math.max(0, 1.3 * Math.sin(x / 23 + 0.5) * Math.cos(z / 17) + 0.8 * Math.sin((x + z) / 29) + 0.5) + bump(x, z, -90, -70, 14, 3) + bump(x, z, 100, -20, 16, 3.5) + bump(x, z, -36, 0, 10, 2.2);
  // Walker lanes stay gentle (the legs stand on the snow).
  const lane = Math.min(...LANES.map((lx) => Math.abs(x - lx)));
  h *= 0.25 + 0.75 * smooth(8, 14, lane);
  for (const [cx, cz, r] of CRATERS) h -= bump(x, z, cx, cz, r, 1.6);
  h *= 1 - keepFlat;
  // The glacier either side of the base: an ice cliff 14 m up.
  const side = smooth(64, 70, Math.abs(x));
  h += side * 14 * smooth(88, 98, z);
  return h;
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
const mat = (n: TerrainMaterial) => TERRAIN_MATERIALS.indexOf(n);
terrain = {
  ...terrain,
  materials: terrain.materials.map((v, i) => {
    const c = i % (terrain.cols - 1);
    const r = Math.floor(i / (terrain.cols - 1));
    const x = terrain.origin[0] + (c + 0.5) * terrain.spacing;
    const z = terrain.origin[1] + (r + 0.5) * terrain.spacing;
    if (z < -100 && Math.abs(x) < 60) return mat('gravel');
    if (z > 44 && z < 72 && Math.abs(x) < 80) return mat('dirt');
    return v;
  }),
};
terrain = paintSlopes(terrain, 40, 'stone');
m.terrain(terrain);
const ground = (x: number, z: number) => r2(terrainHeightAt(terrain, x, z) ?? 0);
const G = (x: number, z: number, up = 0): V3 => [r2(x), r2(ground(x, z) + up), r2(z)];

// ---------------------------------------------------------------- block helpers

type BlockOpts = Parameters<MapBuilder['block']>[3];
const block = (at: V3, size: V3, o: BlockOpts = {}) => m.block([r2(at[0]), r2(at[1]), r2(at[2])], [r2(size[0]), r2(size[1]), r2(size[2])], 'solid', { respawn: null, ...o });
const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, o: BlockOpts = {}) =>
  block([(x0 + x1) / 2, Math.min(y0, y1), (z0 + z1) / 2], [Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)], o);
const ICE = { material: 'pbr_ice', tint: '#d4ecf6' };
const STEEL = { material: 'pbr_steel', tint: '#a8b0b8' };
const PANEL = { material: 'pbr_white_panel' };
const PLATE = { material: 'pbr_tread_plate', tint: '#a0a4a8' };

// ---------------------------------------------------------------- the ice base: a glacier massif with rooms carved out

const MX0 = -66;
const MX1 = 66;
const MZ0 = 90;
const MZ1 = 132;
const TOP = 14;
interface Room { name: string; x0: number; x1: number; z0: number; z1: number; h: number }
const ROOMS: Room[] = [
  { name: 'hangar', x0: -20, x1: 20, z0: 92, z1: 128, h: 12 },
  { name: 'hangar mouth', x0: -14, x1: 14, z0: MZ0, z1: 92, h: 10 },
  { name: 'command', x0: -64, x1: -36, z0: 106, z1: 128, h: 6 },
  { name: 'medical', x0: -64, x1: -40, z0: 92, z1: 104, h: 5 },
  { name: 'generator', x0: 36, x1: 64, z0: 106, z1: 128, h: 7 },
  { name: 'entry', x0: 40, x1: 64, z0: 92, z1: 104, h: 5 },
  // Ice corridors.
  { name: 'corridor nw', x0: -36, x1: -20, z0: 112, z1: 116, h: 4 },
  { name: 'corridor ne', x0: 20, x1: 36, z0: 112, z1: 116, h: 4 },
  { name: 'corridor sw', x0: -40, x1: -20, z0: 96, z1: 100, h: 4 },
  { name: 'corridor se', x0: 20, x1: 40, z0: 96, z1: 100, h: 4 },
  // Doorways.
  { name: 'medical-command', x0: -53.6, x1: -50.4, z0: 104, z1: 106, h: 3.2 },
  { name: 'entry-generator', x0: 50.4, x1: 53.6, z0: 104, z1: 106, h: 3.2 },
  { name: 'medical door', x0: -53.6, x1: -50.4, z0: MZ0, z1: 92, h: 3.2 },
  { name: 'entry door', x0: 50.4, x1: 53.6, z0: MZ0, z1: 92, h: 3.2 },
];
{
  const xs = [...new Set([MX0, MX1, ...ROOMS.flatMap((r) => [r.x0, r.x1])])].sort((a, b) => a - b);
  const zs = [...new Set([MZ0, MZ1, ...ROOMS.flatMap((r) => [r.z0, r.z1])])].sort((a, b) => a - b);
  const value = (i: number, j: number) => {
    const cx = (xs[i]! + xs[i + 1]!) / 2;
    const cz = (zs[j]! + zs[j + 1]!) / 2;
    return ROOMS.find((r) => cx > r.x0 && cx < r.x1 && cz > r.z0 && cz < r.z1)?.h ?? 0;
  };
  const done = new Set<string>();
  // Greedy merge: runs along z, then widened along x while every cell matches.
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < zs.length - 1; j++) {
      if (done.has(`${i},${j}`)) continue;
      const v = value(i, j);
      // Blocks are at most 64 m along either side.
      let j2 = j;
      while (j2 + 1 < zs.length - 1 && zs[j2 + 2]! - zs[j]! <= 64 && !done.has(`${i},${j2 + 1}`) && value(i, j2 + 1) === v) j2++;
      let i2 = i;
      const columnMatches = (ii: number) => {
        for (let jj = j; jj <= j2; jj++) if (done.has(`${ii},${jj}`) || value(ii, jj) !== v) return false;
        return true;
      };
      while (i2 + 1 < xs.length - 1 && xs[i2 + 2]! - xs[i]! <= 64 && columnMatches(i2 + 1)) i2++;
      for (let ii = i; ii <= i2; ii++) for (let jj = j; jj <= j2; jj++) done.add(`${ii},${jj}`);
      box(xs[i]!, v === 0 ? -0.3 : v, zs[j]!, xs[i2 + 1]!, TOP, zs[j2 + 1]!, ICE);
    }
  }
  // Snow on top, an overhang of ice over the hangar mouth.
  for (const [x0, x1] of [[MX0 - 0.5, -22], [-22, 22], [22, MX1 + 0.5]] as const) box(x0, TOP, MZ0 - 0.5, x1, TOP + 0.8, MZ1, { material: 'pbr_snow' });
  box(-17, 10.5, MZ0 - 2.5, 17, TOP, MZ0, ICE);
  // Steel floors in the rooms that see the most traffic.
  for (const r of ROOMS.filter((q) => ['hangar', 'command', 'generator'].includes(q.name))) box(r.x0, -0.15, r.z0, r.x1, -0.02, r.z1, PLATE);
}
// Hangar mouth: a steel frame round the opening, landing lights along the floor.
for (const s of [-1, 1]) box(s * 14 - 0.5, -0.02, MZ0 - 2.6, s * 14 + 0.5, 10.5, MZ0 - 2.4, STEEL);
// Doors (auto, anyone) into the medical bay and the entry hall.
m.add({ kind: 'door', id: 'door_medical', name: 'Medical bay door', position: [-52, -0.02, 91], yaw: 0, startOpen: false, locked: false, auto: true, style: 'blast' });
m.add({ kind: 'door', id: 'door_entry', name: 'Entry hall door', position: [52, -0.02, 91], yaw: 0, startOpen: false, locked: false, auto: true, style: 'blast' });

// The hangar: two skyfighters and the transport, cargo, a fuel store (bomb site B) at the back.
m.add({ kind: 'mount', model: 'skyfighter', position: [-9, -0.02, 102], yaw: S, faction: DEFEND, respawnSeconds: null, skin: 'snow' });
m.add({ kind: 'mount', model: 'skyfighter', position: [9, -0.02, 102], yaw: S, faction: DEFEND, respawnSeconds: null, skin: 'snow' });
m.add({ kind: 'mount', model: 'dropship', position: [9, -0.02, 119], yaw: S, faction: DEFEND, respawnSeconds: null, skin: 'snow' });
m.add({ kind: 'bombsite', position: [-9, -0.02, 118], label: 'B', radius: 5 });
m.prop('fuel_tank', [-17, -0.02, 124], 0).prop('fuel_drum', [-17.5, -0.02, 116], 0).prop('fuel_drum', [-17.8, -0.02, 117.4], 0).prop('os_cargo_crate', [-3, -0.02, 125], 0.2);
m.prop('cargo_crate', [-17.4, -0.02, 104], 0).prop('os_canister_rack', [17.4, -0.02, 106], -P).prop('metal_crate', [16.8, -0.02, 126], 0.3).prop('ammo_stack', [-6, -0.02, 126], 0);
for (const [x, z] of [[-10, 98], [10, 98], [-10, 114], [10, 114], [-10, 124], [10, 124]] as const) m.light([x, 11.4, z], { fixture: 'strip', color: '#e8f4ff', intensity: 1.1, range: 14 });

// Command centre: consoles, the holo table and globe, the alert console, red alert lights.
m.prop('holo_table', [-50, -0.02, 117], 0).prop('os_holo_globe', [-44, -0.02, 124], 0).prop('computer_bank', [-63, -0.02, 112], P).prop('computer_bank', [-63, -0.02, 120], P);
m.prop('os_console_corner', [-62.6, -0.02, 126.6], 0).prop('computer_wide', [-54, -0.02, 127.3], S).prop('os_terminal', [-46, -0.02, 127.3], S).prop('screen_panel', [-38, -0.02, 108], -P);
m.add({ kind: 'button', id: 'btn_alert', name: 'Alert console', position: [-50, -0.02, 127.5], yaw: S, label: 'Red alert / all clear', once: false, cooldownSeconds: 2, startEnabled: true, team: DEFEND });
for (const [x, z] of [[-57, 112], [-43, 112], [-50, 122]] as const) m.light([x, 5.4, z], { fixture: 'ceiling', color: '#e8f0ff', intensity: 0.9, range: 10 });
const ALERTS = ['alert_cmd_w', 'alert_cmd_e', 'alert_hangar', 'alert_gen', 'alert_corr_w', 'alert_corr_e'];
const alertAt: V3[] = [[-62, 4.6, 108], [-38, 4.6, 126], [0, 10.8, 127], [62, 5.8, 108], [-28, 3.6, 114], [28, 3.6, 114]];
ALERTS.forEach((id, k) => m.light(alertAt[k]!, { id, fixture: 'bulb', color: '#ff2a18', intensity: 1.6, range: 13, off: true, blink: 2 }));

// Medical bay: beds and recovery tanks.
m.prop('space_bed', [-62.4, -0.02, 96], P).prop('space_bed', [-62.4, -0.02, 101], P).prop('os_cryo_pod', [-42, -0.02, 102.6], S).prop('os_cryo_pod', [-46, -0.02, 102.6], S);
m.prop('sv_medkit_case', [-58, -0.02, 102.8], 0);
for (const [x, z] of [[-58, 98], [-46, 98]] as const) m.light([x, 4.4, z], { fixture: 'ceiling', color: '#f4fbff', intensity: 0.9, range: 9 });

// Entry hall and the generator room (bomb site A).
m.prop('os_reactor_core', [50, -0.02, 124.4], 0).prop('os_generator', [40, -0.02, 124], 0).prop('os_generator', [60.4, -0.02, 124], 0).prop('os_power_unit', [62.6, -0.02, 112], -P);
m.prop('os_coolant_pipe', [37.4, -0.02, 110], P).prop('os_pipe_junction', [62.8, -0.02, 118], -P).prop('sf_crate_large', [42, -0.02, 108], 0.2);
m.add({ kind: 'bombsite', position: [50, -0.02, 115], label: 'A', radius: 6 });
for (const [x, z] of [[42, 116], [58, 116], [50, 108]] as const) m.light([x, 6.4, z], { fixture: 'ceiling', color: '#d8f0ff', intensity: 1, range: 11 });
m.prop('ammo_crate', [62.6, -0.02, 94], P).prop('metal_crate', [41.4, -0.02, 102.4], 0).prop('shelf_boxes', [62.8, -0.02, 100], -P);
for (const [x, z] of [[46, 98], [58, 98]] as const) m.light([x, 4.4, z], { fixture: 'ceiling', color: '#e8f4ff', intensity: 0.8, range: 9 });
// Corridors.
for (const [x, z] of [[-28, 114], [28, 114], [-30, 98], [30, 98]] as const) m.light([x, 3.5, z], { fixture: 'strip', color: '#cfeaff', intensity: 0.7, range: 8 });

// ---------------------------------------------------------------- the trench line (z 52..60)

const TY = 7;
const trench = (x: number, kind: string, rot: 0 | 1 | 2 | 3) => m.tile(`military.${kind}`, x, TY, 0, rot);
for (let x = -9; x <= 9; x++) {
  if (x === -9) trench(x, 'trench_end', 3);
  else if (x === 9) trench(x, 'trench_end', 1);
  else if (x === -5 || x === 5) trench(x, 'trench_t', 2);
  else if (x === -3 || x === 3) trench(x, 'trench_dugout', 1);
  else if (x === -7 || x === 1) trench(x, 'trench_steps', 1);
  else if (x === 7 || x === -1) trench(x, 'trench_steps', 3);
  else trench(x, 'trench', 1);
}
// Communication trenches north from the T junctions, opening toward the base.
m.tile('military.trench_end', -5, TY + 1, 0, 0);
m.tile('military.trench_end', 5, TY + 1, 0, 0);
// Gun nests behind the trench: MGs and rocket turrets facing the field.
for (const [x, model] of [[-48, 'turret_mg'], [-24, 'turret_rocket'], [0, 'turret_mg'], [24, 'turret_rocket'], [48, 'turret_mg']] as const) {
  m.prop('sandbag_nest', [x, 0, 64.6], S);
  m.add({ kind: 'mount', model, position: [x, 0, 64], yaw: S, faction: DEFEND, respawnSeconds: null, skin: 'snow' });
}
// Obstacles in front: hedgehogs, tank traps and wire.
for (const [x, z] of [[-60, 44], [-34, 40], [-8, 43], [14, 39], [38, 44], [64, 40]] as const) m.prop('hedgehog', G(x, z), x * 0.1);
for (const [x, z] of [[-46, 46], [-22, 46], [26, 46], [50, 46]] as const) m.prop('dragon_tooth', G(x, z), 0);
for (const x of [-56, -12, 30, 60]) m.prop('razor_wire', G(x, 48), 0);
m.prop('sandbag_wall', G(-70, 64), 0).prop('sandbag_wall', G(70, 64), 0).prop('ammo_crate', G(-12, 66), 0.3).prop('ammo_crate', G(12, 66), -0.3);
for (const x of [-30, 30]) m.light([x, 2.6, 66], { fixture: 'none', color: '#ffd8a0', intensity: 0.9, range: 10 });
m.prop('floodlight', G(-30, 67), S).prop('floodlight', G(30, 67), S);

// ---------------------------------------------------------------- the dish (west of the trench)

const DX = -86;
const DZ = 70;
{
  const top = 2;
  box(DX - 7, -0.3, DZ - 7, DX + 7, top, DZ + 7, { material: 'pbr_concrete_dark' });
  // Ramps up the plinth on the south and east.
  const run = 5;
  const len = Math.hypot(run, top);
  const pitch = r2(Math.atan(top / run));
  block([DX, top / 2 - 0.3, DZ - 7 - run / 2], [4, 0.3, r2(len)], { material: 'pbr_concrete_dark', pitch });
  block([DX + 7 + run / 2, top / 2 - 0.3, DZ + 2], [4, 0.3, r2(len)], { material: 'pbr_concrete_dark', yaw: -P, pitch });
  // The pylon and the bowl: a hub and twelve petals rising outwards, a feed mast and its housing.
  block([DX, top, DZ], [3, 8, 3], STEEL);
  block([DX, top + 8, DZ], [5, 1.2, 5], STEEL);
  block([DX, top + 9.2, DZ], [6, 0.3, 6], PANEL);
  for (let k = 0; k < 12; k++) {
    const yaw = k * (Math.PI / 6);
    block([DX + Math.sin(yaw) * 5.2, top + 9.9, DZ + Math.cos(yaw) * 5.2], [3.4, 0.3, 5], { ...PANEL, yaw: r2(yaw), pitch: 0.5 });
  }
  block([DX, top + 9.4, DZ], [0.5, 6, 0.5], STEEL);
  block([DX, top + 15.4, DZ], [1.4, 1.4, 1.4], STEEL);
  m.light([DX, top + 17.2, DZ], { fixture: 'bulb', color: '#ff2a18', intensity: 1.4, range: 14, blink: 1.2 });
  m.light([DX, top + 3, DZ - 4], { fixture: 'none', color: '#cfe8ff', intensity: 1, range: 12 });
  m.prop('os_power_unit', [DX - 4.6, top, DZ + 4.6], 0).prop('os_transmitter', [DX + 4.4, top, DZ + 4.8], S);
}

// ---------------------------------------------------------------- the walkers

/**
 * A walker: 23 blocks on a mover (four jointed legs with feet, hull, armour
 * plate, neck, head, chin and cheek guns) lurching 4 m at a time up the
 * field and back, rocking on each step. At 4.2 m/s it runs over what its
 * blocks sweep into; standing still between steps, you can shelter under it.
 */
function walker(n: number, wx: number): void {
  const wz = WALK_Z0;
  const g = ground(wx, wz);
  const ids: string[] = [];
  const part = (name: string, at: V3, size: V3, o: BlockOpts = STEEL) => {
    const id = `walker${n}_${name}`;
    ids.push(id);
    block([wx + at[0], g + at[1], wz + at[2]], size, { ...o, id });
  };
  const LEG = { material: 'pbr_steel', tint: '#8c939c' };
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    const k = `${sx > 0 ? 'r' : 'l'}${sz > 0 ? 'f' : 'b'}`;
    const lx = sx * 3.4;
    const lz = sz * 5.2;
    part(`${k}_foot`, [lx, -0.1, lz], [2.2, 0.6, 2.8], LEG);
    part(`${k}_shin`, [lx, 0.5, lz], [1.3, 7, 1.3], LEG);
    part(`${k}_knee`, [lx, 7.2, lz], [1.9, 1.5, 2.1], STEEL);
    part(`${k}_thigh`, [lx, 8.6, lz], [1.5, 6.2, 1.5], LEG);
  }
  part('hull', [0, 14.6, 0], [7.6, 4.6, 13.2]);
  part('plate', [0, 19.2, -0.5], [5.6, 0.8, 10]);
  part('neck', [0, 15.6, 7.6], [2.2, 2.2, 2.4]);
  part('head', [0, 14.8, 10.9], [3.8, 3.4, 5.4]);
  for (const s of [-1, 1]) {
    part(`gun${s > 0 ? 'r' : 'l'}`, [s * 1.1, 15.1, 14.8], [0.4, 0.4, 3.2], { material: 'pbr_steel', tint: '#4a4e54' });
    part(`cheek${s > 0 ? 'r' : 'l'}`, [s * 2.1, 16.6, 13], [0.3, 0.3, 2.2], { material: 'pbr_steel', tint: '#4a4e54' });
  }
  const points: V3[] = Array.from({ length: STEPS + 1 }, (_, k) => [0, 0, k * STEP]);
  const angles = points.map((_, k) => (k % 2 ? 0.025 : -0.025));
  m.mover(`mover_walker${n}`, [r2(wx), r2(g + 17), r2(wz)], ids, points, { mode: 'pingpong', speed: 4.2, wait: 0.9, angles, turnSpeed: 20, name: `Walker ${n}` });
}
LANES.forEach((x, k) => walker(k + 1, x));

// ---------------------------------------------------------------- the staging camp (south)

m.tile('military.barracks', -4, -15, 0, 0); // x -36..-20, z -124..-116
m.tile('military.barracks', 3, -15, 0, 0); // x 20..36
m.edge(-4, -15, 0, 'N', 'door').edge(-3, -15, 0, 'N', 'door').edge(3, -15, 0, 'N', 'door').edge(4, -15, 0, 'N', 'door');
m.tile('military.helipad', -1, -15, 0); // x -10..2, z -122..-110
m.add({ kind: 'mount', model: 'gunship', position: [-4, 0.15, -116], yaw: 0, faction: ATTACK, respawnSeconds: null, skin: 'snow' });
m.add({ kind: 'mount', model: 'tank', position: G(30, -104), yaw: 0, faction: ATTACK, respawnSeconds: null, skin: 'snow' });
for (const [x, z] of [[-60, -104], [-56, -104], [70, -104], [74, -104]] as const) m.add({ kind: 'mount', model: 'snow_sled', position: G(x, z), yaw: 0, faction: ATTACK, respawnSeconds: null, skin: 'snow' });
for (const [x, z] of [[-24, 80], [24, 80]] as const) m.add({ kind: 'mount', model: 'snow_sled', position: G(x, z), yaw: S, faction: DEFEND, respawnSeconds: null, skin: 'snow' });
// Walker gantries: a steel tower beside each walker's start, a sentry at its foot.
for (const [k, wx] of LANES.entries()) {
  const gx = wx + 9;
  const g = ground(gx, WALK_Z0);
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) block([gx + sx * 1.4, g - 0.3, WALK_Z0 + sz * 1.4], [0.5, 18.3, 0.5], STEEL);
  for (const y of [6, 12, 18]) box(gx - 1.8, g + y, WALK_Z0 - 1.8, gx + 1.8, g + y + 0.3, WALK_Z0 + 1.8, PLATE);
  m.light([gx, g + 18.6, WALK_Z0], { fixture: 'bulb', color: '#ffb040', intensity: 1.2, range: 14, ...(k === 1 ? {} : { blink: 1.5 }) });
  m.add({ kind: 'mount', model: 'sentry', position: G(gx + 3.6, WALK_Z0 - 6), yaw: 0, faction: ATTACK, respawnSeconds: null });
}
m.prop('shipping_container_blue', G(-48, -128), 0).prop('shipping_container_red', G(48, -128), 0).prop('fuel_tank', G(-60, -122), 0).prop('storage_tank', G(62, -120), 0);
m.prop('supply_truck', G(-14, -132), P).prop('flatbed_truck', G(14, -132), P).prop('ammo_stack', G(-16, -108), 0.4).prop('ammo_crate', G(16, -108), 0).prop('pallet', G(8, -110), 0.3);
for (const [x, z] of [[-40, -110], [40, -110], [-8, -132], [8, -104]] as const) {
  m.prop('floodlight', G(x, z), 0);
  m.light(G(x, z + 1, 5.2), { fixture: 'none', color: '#f0f4ff', intensity: 1.2, range: 16 });
}

// ---------------------------------------------------------------- the snowfield

let seed = 0x91ac1e;
const rand = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
const placed: [number, number, number][] = [];
const clear = (x: number, z: number, r: number) =>
  z > -96 && z < 38 && Math.abs(x) < 126 &&
  LANES.every((lx) => Math.abs(x - lx) > 9 + r || z > WALK_Z0 + STEP * STEPS + 12) &&
  Math.hypot(x - DX, z - DZ) > 14 &&
  placed.every(([px, pz, pr]) => Math.hypot(px - x, pz - z) > pr + r + 2);
for (let n = 0; n < 1500 && placed.length < 70; n++) {
  const x = (rand() - 0.5) * 250;
  const z = -96 + rand() * 134;
  const scale = r2(1.2 + rand() * 1.8);
  const r = scale * 1.1;
  if (!clear(x, z, r)) continue;
  placed.push([x, z, r]);
  const pick = rand();
  const model = pick < 0.45 ? 'nt_boulder_snow' : pick < 0.8 ? 'nt_rock_snow' : 'rock_large';
  m.prop(model, G(x, z, -0.3 * scale), r2(rand() * 6.28), scale);
}
for (let n = 0; n < 600 && placed.length < 100; n++) {
  const x = (rand() - 0.5) * 250;
  const z = -96 + rand() * 134;
  if (!clear(x, z, 1)) continue;
  placed.push([x, z, 1]);
  const pine = rand() < 0.6;
  m.prop(pine ? 'nt_pine_snow_tall' : 'nt_bush_snow', G(x, z, -0.1), r2(rand() * 6.28), r2(0.9 + rand() * 0.6), pine);
}
// Wreckage on the field: a downed skyfighter's hull (pitched blocks), barricades.
block([-14, ground(-14, -6) - 0.4, -6], [3, 1.6, 9], { ...STEEL, yaw: 0.7, pitch: 0.18, roll: -0.2 });
block([-16.4, ground(-16.4, -4) - 0.2, -4], [6, 0.3, 2], { ...STEEL, yaw: 0.7, roll: 0.35 });
m.prop('jersey_barrier_broken', G(40, -10), 0.6).prop('jersey_barrier', G(-60, 10), -0.4).prop('concrete_block', G(70, 20), 0.2).prop('brick_rubble', G(-40, -50), 1);

// ---------------------------------------------------------------- logic

type Action = ScenarioLogic['rules'][number]['do'][number];
type Condition = ScenarioLogic['rules'][number]['if'][number];
const act = (type: Action['type'], target: string | null = null, o: { value?: number; text?: string; state?: string } = {}): Action => ({ type, target, value: o.value ?? 0, text: o.text ?? '', state: o.state ?? '' }) as Action;
const cond = (type: Condition['type'], target: string | null, op: Condition['op'], value: number, state = ''): Condition => ({ type, target, op, value, state }) as Condition;
const rule = (id: string, name: string, event: string, target: string | null, does: Action[], ifs: Condition[] = []) => ({ id, name, enabled: true, once: false, when: { event, target }, if: ifs, do: does }) as ScenarioLogic['rules'][number];
const alertOn = [...ALERTS.map((id) => act('light_on', id)), act('sound', null, { state: 'alarm' })];
const alertOff = [...ALERTS.map((id) => act('light_off', id)), act('sound', null, { state: 'chime' })];
m.add({ kind: 'zone', id: 'zone_field_w', name: 'Mid-field west', position: G(-40, 0), size: [64, 12, 24], who: 'any', count: 1, startEnabled: true, team: ATTACK });
m.add({ kind: 'zone', id: 'zone_field_e', name: 'Mid-field east', position: G(40, 0), size: [64, 12, 24], who: 'any', count: 1, startEnabled: true, team: ATTACK });
m.logic({
  variables: [],
  timers: [],
  objectives: [],
  rules: [
    rule('rule_start', 'Welcome', 'match_start', null, [act('message', null, { value: 5, text: 'Glacier Line. Walkers are moving up the field.' })]),
    ...['zone_field_w', 'zone_field_e'].map((z) =>
      rule(`rule_${z}`, 'Red alert when the attack crosses the field', 'zone_enter', z, [...alertOn, act('message', null, { value: 4, text: 'Red alert! Enemy troops on the field!' })], [cond('light', 'alert_cmd_w', '==', 0, 'off')]),
    ),
    rule('rule_alert_on', 'Alert console: red alert', 'button_pressed', 'btn_alert', [...alertOn, act('message', null, { value: 3, text: 'Red alert.' })], [cond('light', 'alert_cmd_w', '==', 0, 'off')]),
    rule('rule_alert_off', 'Alert console: all clear', 'button_pressed', 'btn_alert', [...alertOff, act('message', null, { value: 3, text: 'All clear.' })], [cond('light', 'alert_cmd_w', '==', 0, 'on')]),
  ],
});

// ---------------------------------------------------------------- spawns, pickups, objectives

// Attackers: the staging camp.
for (const [x, z] of [[-64, -112], [-50, -112], [-40, -130], [-16, -128], [8, -126], [16, -112], [44, -112], [58, -112], [70, -128], [-72, -128], [-28, -108], [12, -104], [40, -128], [-4, -104]] as const) m.spawn(G(x, z), 0, ATTACK);
// Defenders: the base and behind the trench.
for (const [x, z, yaw] of [[-16, 96, S], [16, 96, S], [-14, 110, S], [16, 110, S], [-58, 110, S], [-42, 120, S], [-58, 96, S], [-46, 96, S], [60, 96, S], [46, 96, S], [42, 116, S], [58, 110, S], [-30, 70, S], [30, 70, S]] as const) m.spawn(G(x, z), yaw, DEFEND);
// Free-for-all: out on the field.
for (const [x, z, yaw] of [[-100, -10, P], [100, -6, -P], [-24, -40, 0], [24, 20, S], [-70, 30, S], [80, -40, 0]] as const) m.spawn(G(x, z), yaw, null);

m.pickup('weapon_sniper', [DX + 4, 2, DZ - 4.6], 30).pickup('ammo_sniper', [DX - 4, 2, DZ - 4.6]).pickup('weapon_rockets', [-24, 0, 56], 40).pickup('weapon_lmg', [24, 0, 56], 30);
m.pickup('weapon_rifle', [-30, -0.02, 98]).pickup('weapon_smg', [30, -0.02, 98]).pickup('weapon_shotgun', [-28, -0.02, 114]).pickup('weapon_shotgun', [28, -0.02, 114]);
m.pickup('weapon_launcher', [0, 0.15, -112], 40).pickup('weapon_rifle', G(-30, -108)).pickup('weapon_smg', G(30, -110)).pickup('weapon_marksman', G(46, -106), 30);
m.pickup('weapon_plasma', G(-14, -12), 30).pickup('weapon_railgun', G(100, -20), 45).pickup('powerup_damage', G(-90, -70), 60).pickup('mines', [0, 0, 56]).pickup('sandbags', G(-12, 68));
m.pickup('health_large', [-52, -0.02, 98], 30).pickup('health_large', G(0, -124)).pickup('health_small', G(-60, 0)).pickup('health_small', G(60, 10)).pickup('health_small', G(0, -40)).pickup('health_small', [0, -0.02, 106]);
m.pickup('armor_large', [-50, -0.02, 112], 40).pickup('armor_small', G(-36, -60)).pickup('armor_small', G(36, -70)).pickup('grenades', G(-20, -104)).pickup('grenades', [8, 0, 56]).pickup('ammo', [-56, 0, 56]).pickup('ammo', [56, 0, 56]).pickup('ammo', G(50, -104));

// King of the Hill: the trench, the dish, the hangar.
m.hill([16, 0, 56], 5);
m.hill([DX, 2, DZ - 5], 4);
m.hill([0, -0.02, 110], 6);
// Capture the Flag: in the trench, and at the walker staging area.
m.flag(DEFEND, [-16, 0, 56], S);
m.flag(ATTACK, G(-4, -107.5), 0);

await m.fillTeamSpawns(16);
m.bounds('invisible', 4, { min: [-136, -140], max: [136, 134] });
m.border('cliffs');
m.meta({
  description:
    'A battle across a snowfield in a blizzard. The Defenders hold an ice base cut into a glacier: a hangar with two skyfighters and a transport, ice corridors, a command centre with red alert lights, a medical bay and the power generator, behind a trench line of mounted guns and a giant dish. The Attackers push up from a staging camp behind three giant four-legged walkers that lurch up the field and back: shelter under one, but keep clear of its feet. Snow sleds, a tank and a gunship for the push. Bomb: blow the generator (A) or the hangar fuel store (B).',
  modes: ['core.bomb', 'core.tdm', 'core.ctf', 'core.koth', 'core.deathmatch'],
  players: [16, 32],
});
await m.save();
