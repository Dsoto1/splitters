/**
 * Low Bridge: a train heist where the train never moves; the world does
 * (docs/MAP_IDEAS.md, top-10 #3; our own map and name). Bandits fight along
 * the roofs of a speeding express on a trestle 40 m over a misty canyon, and
 * every so often a low road bridge or a rock tunnel comes through at roof
 * height. Style Pack 02 Frontier Dust.
 *
 * - The train stands still on a static deck 40 m up: the locomotive, its cab,
 *   the tender (a coal heap stepping up to the roofs), the mail car (the
 *   strongbox: the bomb site), a passenger coach, the dining car with its bar,
 *   and the caboose with its rear porch. Walk through the cars, or run the
 *   roofs: faster, but exposed. Ladders up every gangway; drop into a gangway
 *   to get off the roof.
 * - The treadmill: everything else moves. Fifteen loop movers each carry
 *   three trestle bents (stacked timber frames, props riding along) and two
 *   telegraph poles past the train at 14 m/s (21 m/s flat out), sink into the
 *   canyon floor behind it, run back underground and rise ahead again. The
 *   kit has no snap-back leg, so the return is hidden under the canyon's
 *   ground mist. The movers start parked and a match-start sequence sends
 *   them off 2.9 s apart: the train "pulls out" every round and the bents
 *   stay evenly spaced from then on.
 * - The low bridge and the tunnel: two trigger movers on timers, with the same
 *   path and speed as the scenery. Each rises out of the mist far ahead and
 *   sweeps the whole train at roof height: the alarm sounds and the lamps on
 *   the cab and caboose flash about 2 s before it reaches the locomotive
 *   (4-7 s before it reaches the coach and the caboose).
 *   Anyone on a roof is run over (crouching does not help: the run-over check
 *   uses the standing body), so drop into a gangway or a car. Inside the cars,
 *   in the gangways and on the ledge beside the train you are safe.
 * - Fall off and you are gone: the canyon floor is far below, under the mist.
 *
 * Side view (x along the train; the train "travels" toward +x):
 *
 *        caboose  diner    coach    mail[A]  tender cab LOCO
 *   ←  [porch|   ][      ][      ][      ][coal][  ][====>   bents and poles stream this way ←
 *   ═══════════════════ static deck, 40 m up ═══════════════════
 */
import type { LogicAction, LogicCondition, LogicRule } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

type V3 = [number, number, number];
type Look = { material: string; tint?: string };
const m = new MapBuilder('low_bridge', 'Low Bridge');
m.theme('frontier');
m.backdrop('sunset', 'mesas', 'sand', 0.45, 0.9);
// Long falls kill (and the canyon floor is 40 m down).
m.history.execute('Physics', { kind: 'setPhysics', before: m.doc.physics, after: { gravity: 1, fallDamage: true } });
m.teams([6, 6]);
const [BANDITS, GUARDS] = m.teamIds(2) as [string, string];

const r2 = (n: number) => Math.round(n * 100) / 100;
const P = Math.PI / 2;

// ---------------------------------------------------------------- heights
const DECK = 40; // top of the trestle deck
const FY = 41.2; // car floors
const CEIL = 43.9; // underside of the roofs
const RY = 44.2; // roof tops
const LINTEL = 44.5; // underside of the low bridge and the tunnel
const HW = 1.8; // half the car width (outer face of the side walls)

// ---------------------------------------------------------------- looks
const PLANKS: Look = { material: 'pbr_weathered_planks' };
const SIDING: Look = { material: 'pbr_weathered_siding', tint: '#8a4a32' };
const SIDING_GREEN: Look = { material: 'pbr_weathered_siding', tint: '#4a6a4a' };
const SIDING_MAIL: Look = { material: 'pbr_weathered_siding', tint: '#5a5a6a' };
const SIDING_RED: Look = { material: 'pbr_weathered_siding', tint: '#a03028' };
const ROOF: Look = { material: 'pbr_rusted_plate', tint: '#4a3a32' };
const IRON: Look = { material: 'pbr_steel', tint: '#2e2c2a' };
const FLOOR: Look = { material: 'pbr_floorboards' };
const COAL: Look = { material: 'pbr_rock', tint: '#26221f' };
const ROCK: Look = { material: 'pbr_rock', tint: '#9a5a3a' };
const TIMBER: Look = { material: 'dark_wood' };

/** A block from corner to corner (x0..x1, y0..y1, z0..z1). */
function box(xa: number, y0: number, za: number, xb: number, y1: number, zb: number, look: Look, id?: string): void {
  const [x0, x1, z0, z1] = [Math.min(xa, xb), Math.max(xa, xb), Math.min(za, zb), Math.max(za, zb)];
  m.block([r2((x0 + x1) / 2), r2(y0), r2((z0 + z1) / 2)], [r2(x1 - x0), r2(y1 - y0), r2(z1 - z0)], 'solid', { ...look, ...(id ? { id } : {}) });
}

// ---------------------------------------------------------------- the static deck and the line
// The deck runs a little past each end of the train; past that only the rails (drawn only) carry on.
box(-48, DECK - 0.6, -2.3, 0, DECK, 2.3, PLANKS);
box(0, DECK - 0.6, -2.3, 56, DECK, 2.3, PLANKS);
box(-48, DECK - 1.4, -1.6, 0, DECK - 0.6, 1.6, TIMBER);
box(0, DECK - 1.4, -1.6, 56, DECK - 0.6, 1.6, TIMBER);
for (let x = -150; x <= 160; x += 10.4) m.prop('railroad', [r2(x), DECK, 0], P, 1, false);
// River stones on the canyon floor under the mist (they set where the backdrop's ground lies).
for (const [x, z] of [[-90, -34], [30, 40], [120, -40], [-20, 52]] as const) box(x - 3, 0, z - 2, x + 3, 0.5, z + 2, ROCK);

// ---------------------------------------------------------------- the train
const G = 1.6; // gangway between cars
const LOCO_LEN = 6.74;
const LOCO_X = 47.4 - LOCO_LEN / 2;
m.prop('locomotive_red', [r2(LOCO_X), DECK, 0], -P); // faces +x (its chimney end is its -Z)
interface Car {
  id: string;
  len: number;
  x0: number;
  x1: number;
}
const CARS: Car[] = [];
{
  let front = LOCO_X - LOCO_LEN / 2;
  for (const [id, len] of [['cab', 6], ['tender', 7], ['mail', 14], ['coach', 16], ['diner', 16], ['caboose', 10]] as const) {
    CARS.push({ id, len, x0: r2(front - len), x1: r2(front) });
    front -= len + G;
  }
}
const car = (id: string) => CARS.find((c) => c.id === id)!;

/** Under every car: two bogies and the floor. */
function chassis(c: Car, floor: Look = FLOOR): void {
  for (const x of [c.x0 + 1.7, c.x1 - 1.7]) box(x - 1.2, DECK, -1.3, x + 1.2, DECK + 0.7, 1.3, IRON);
  box(c.x0, DECK + 0.7, -HW, c.x1, FY, HW, floor);
}

/** End wall at `x` with a 2 m doorway in the middle (wide enough for bots' paths). */
const DOOR = 1.0;
function endWall(x: number, look: Look): void {
  box(x - 0.1, FY, -HW, x + 0.1, CEIL, -DOOR, look);
  box(x - 0.1, FY, DOOR, x + 0.1, CEIL, HW, look);
  box(x - 0.1, FY + 2.2, -DOOR, x + 0.1, CEIL, DOOR, look);
}

/** Side walls with windows (or a solid wall with a sliding-door gap in the middle for the mail car). */
function sideWalls(c: Car, look: Look, windows: boolean): { x: number; width: number }[] {
  const out: { x: number; width: number }[] = [];
  for (const s of [-1, 1]) {
    const z0 = s > 0 ? HW - 0.2 : -HW;
    const z1 = s > 0 ? HW : -HW + 0.2;
    if (!windows) {
      // Solid sides, with a 1.6 m door gap in the middle (out onto the ledge).
      const mid = (c.x0 + c.x1) / 2;
      box(c.x0, FY, z0, mid - 0.8, CEIL, z1, look);
      box(mid + 0.8, FY, z0, c.x1, CEIL, z1, look);
      box(mid - 0.8, FY + 2.2, z0, mid + 0.8, CEIL, z1, look);
      continue;
    }
    box(c.x0, FY, z0, c.x1, FY + 0.9, z1, look);
    box(c.x0, FY + 2.0, z0, c.x1, CEIL, z1, look);
    // Posts between 1.6 m windows.
    const n = Math.floor((c.len - 0.6) / 2.2);
    const step = (c.len - 0.6) / n;
    for (let k = 0; k <= n; k++) {
      const x = c.x0 + 0.3 + k * step;
      box(x - 0.3, FY + 0.9, z0, x + 0.3, FY + 2.0, z1, look);
      if (k < n && s > 0) out.push({ x: r2(x + step / 2), width: r2(step - 0.6) });
    }
  }
  return out;
}

function roof(c: Car, look: Look = ROOF): void {
  box(c.x0 - 0.1, CEIL, -HW - 0.1, c.x1 + 0.1, RY, HW + 0.1, look);
}

/** A ladder up the outside of an end wall at `x`, facing `dir` (+1: toward +x), on side `side` of the doorway. */
function endLadder(x: number, dir: 1 | -1, side: 1 | -1): void {
  m.add({ kind: 'ladder', position: [r2(x), FY, r2(side * 1.4)], yaw: dir > 0 ? P : -P, height: r2(RY - FY + 0.1), width: 0.5 });
}


// The cab: half-height sides (cab windows), open to the tender behind, a roof on corner posts, the firebox at the front.
{
  const c = car('cab');
  chassis(c, { material: 'pbr_tread_plate', tint: '#3a3430' });
  for (const s of [-1, 1]) {
    const z0 = s > 0 ? HW - 0.2 : -HW;
    const z1 = s > 0 ? HW : -HW + 0.2;
    box(c.x0, FY, z0, c.x0 + 2, FY + 1.1, z1, IRON);
    box(c.x1 - 2.4, FY, z0, c.x1, FY + 1.1, z1, IRON);
    for (const x of [c.x0, c.x1 - 0.3]) box(x, FY + 1.1, z0, x + 0.3, CEIL, z1, IRON);
  }
  box(c.x1 - 0.3, FY, -HW, c.x1, CEIL, HW, IRON); // the back of the boiler
  box(c.x1 - 1.3, FY, -0.7, c.x1 - 0.3, FY + 1.2, 0.7, { material: 'pbr_steel', tint: '#5a2a1a' }); // firebox
  roof(c, IRON);
  m.prop('powder_keg', [r2(c.x1 - 1.9), FY, 1.15], 0.4);
}
// The tender: low sides, the coal heap stepping up toward the cab (the way up to the cab and locomotive roofs).
{
  const c = car('tender');
  chassis(c, IRON);
  for (const s of [-1, 1]) box(c.x0, FY, s > 0 ? HW - 0.2 : -HW, c.x1, FY + 1.4, s > 0 ? HW : -HW + 0.2, IRON);
  // The coal heap along the south side (a 2.2 m walkway to the cab beside it).
  box(c.x1 - 4.2, FY, -HW + 0.2, c.x1, FY + 0.9, -0.6, COAL);
  box(c.x1 - 2.8, FY + 0.9, -HW + 0.2, c.x1, FY + 1.8, -0.6, COAL);
  box(c.x1 - 1.4, FY + 1.8, -HW + 0.2, c.x1, CEIL, -0.6, COAL);
  m.prop('barrel', [r2(c.x0 + 0.6), FY, 1.2], 0);
}
// The enclosed cars.
for (const [id, look, windows] of [
  ['mail', SIDING_MAIL, false],
  ['coach', SIDING_GREEN, true],
  ['diner', SIDING, true],
  ['caboose', SIDING_RED, true],
] as const) {
  const c = car(id);
  chassis(c);
  endWall(c.x0 + 0.1, look);
  endWall(c.x1 - 0.1, look);
  sideWalls(c, look, windows);
  roof(c);
}
// Gangway plates between cars, and ladders up both end walls of every gangway.
for (let i = 0; i + 1 < CARS.length; i++) {
  const front = CARS[i]!;
  const back = CARS[i + 1]!;
  box(back.x1, DECK + 0.7, -HW, front.x0, FY, HW, { material: 'pbr_tread_plate' });
  // The cab and tender need none: the coal heap steps up to the roofs.
  if (front.id === 'cab') continue;
  if (front.id !== 'tender') endLadder(front.x0, -1, 1);
  endLadder(back.x1, 1, -1);
}
// The caboose's rear porch: a railed platform behind it, with a ladder up the back wall.
{
  const c = car('caboose');
  box(c.x0 - 3, DECK + 0.7, -HW, c.x0, FY, HW, FLOOR);
  for (const s of [-1, 1]) box(c.x0 - 3, FY, s > 0 ? HW - 0.2 : -HW, c.x0, FY + 1, s > 0 ? HW : -HW + 0.2, TIMBER);
  box(c.x0 - 3, FY, -HW, c.x0 - 2.8, FY + 1, -0.5, TIMBER);
  box(c.x0 - 3, FY, 0.5, c.x0 - 2.8, FY + 1, HW, TIMBER);
  endLadder(c.x0, -1, 1);
}

// The strongbox in the mail car: bomb site A.
const MAIL = car('mail');
const MAIL_MID = (MAIL.x0 + MAIL.x1) / 2;
box(MAIL_MID + 3.2, FY, 0.95, MAIL_MID + 4.6, FY + 1.5, 1.6, { material: 'pbr_steel', tint: '#3a4048' });
box(MAIL_MID - 4.6, FY, -1.6, MAIL_MID - 3.4, FY + 1.1, -1.0, { material: 'crate_wood' });
m.add({ kind: 'bombsite', position: [r2(MAIL_MID + 2), FY, 0], label: 'A', radius: 3.5 });
m.prop('wanted_board', [r2(MAIL_MID - 2), FY, 1.5], Math.PI);

// ---------------------------------------------------------------- spawns and pickups
const CAB = car('cab');
const TENDER = car('tender');
const CABOOSE = car('caboose');
const DINER = car('diner');
const COACH = car('coach');
// Guards: the cab, the tender and the front of the mail car.
for (const [x, z] of [[CAB.x0 + 2.4, -0.8], [CAB.x0 + 2.4, 0.8], [TENDER.x0 + 1, -0.6], [TENDER.x0 + 3.4, 0.6], [MAIL.x1 - 1.4, -0.9], [MAIL.x1 - 1.4, 0.9]] as const) {
  m.spawn([r2(x), FY, z], -P, GUARDS);
}
// Bandits: the caboose, its porch and the back of the dining car.
for (const [x, z] of [[CABOOSE.x0 - 1.5, 0], [CABOOSE.x0 + 2, -0.8], [CABOOSE.x0 + 2, 0.8], [CABOOSE.x1 - 2, 0], [DINER.x0 + 1.4, -0.9], [DINER.x0 + 1.4, 0.9]] as const) m.spawn([r2(x), FY, z], P, BANDITS);
m.pickup('weapon_shotgun', [r2(COACH.x0 + 1.2), FY, 0]).pickup('weapon_rifle', [r2(COACH.x1 - 1.2), FY, 0]);
m.pickup('weapon_sniper', [r2(MAIL.x1 - 2), RY, 0]).pickup('ammo', [r2(DINER.x1 - 1.2), FY, 0]);
m.pickup('health_large', [r2((DINER.x0 + DINER.x1) / 2), FY, 0]).pickup('armor_small', [r2((COACH.x0 + COACH.x1) / 2), FY, 0]);
m.pickup('dynamite', [r2(CABOOSE.x1 - 1), FY, 0.9]);

// ---------------------------------------------------------------- dressing
// By hand: the cars are 3.2 m wide inside, so everything backs onto a wall and a 2 m lane stays clear.
const SEAT: Look = { material: 'pbr_canvas', tint: '#7a2a2a' };
const CLOTH: Look = { material: 'canvas', tint: '#f0e8dc' };
const BAR: Look = { material: 'pbr_walnut' };
{
  // The coach: benches along both walls, gaps by the doors and in the middle.
  const c = COACH;
  const mid = (c.x0 + c.x1) / 2;
  for (const s of [-1, 1]) {
    for (let x = c.x0 + 2.6; x < c.x1 - 2; x += 2.6) {
      if (Math.abs(x - mid) < 1.4) continue;
      box(x - 0.9, FY, s * 1.1, x + 0.9, FY + 0.45, s * 1.6, SEAT);
      box(x - 0.9, FY + 0.45, s > 0 ? 1.4 : -1.6, x + 0.9, FY + 1.05, s > 0 ? 1.6 : -1.4, SEAT);
    }
  }
}
{
  // The dining car: the bar along the north wall at the front, set tables along the south wall.
  const c = DINER;
  box(c.x1 - 6.5, FY, 1.05, c.x1 - 1.4, FY + 1.1, 1.6, BAR);
  for (let x = c.x1 - 6; x <= c.x1 - 2; x += 1.3) m.prop('bar_stool', [r2(x), FY, 0.7], 0);
  m.prop('crate_bottles', [r2(c.x1 - 3), r2(FY + 1.1), 1.32], P).prop('bottle', [r2(c.x1 - 5.2), r2(FY + 1.1), 1.3], 0).prop('bottle', [r2(c.x1 - 4.9), r2(FY + 1.1), 1.35], 0);
  for (let x = c.x0 + 3.2; x < c.x1 - 7.5; x += 2.6) {
    box(x - 0.5, FY, -1.6, x + 0.5, FY + 0.76, -1.0, CLOTH);
    m.prop('chair', [r2(x - 0.8), FY, -1.3], P).prop('chair', [r2(x + 0.8), FY, -1.3], -P);
  }
}
{
  // The caboose: a bunk on the north wall, the stove on the south wall.
  const c = CABOOSE;
  const mid = (c.x0 + c.x1) / 2;
  m.prop('bunk_bed', [r2(mid - 0.6), FY, 1.03], P);
  m.prop('dungeon_barrel', [r2(mid + 2.2), FY, -1.05], 0).prop('lantern', [r2(mid + 2.2), r2(FY + 1), -1.05], 0);
}
{
  // The mail car: the strongbox (north wall) and pigeonholes opposite it, sacks and a crate at the back.
  const mid = MAIL_MID;
  m.prop('hm_bookshelf', [r2(mid + 1.6), FY, -1.43], 0).prop('hm_bookshelf', [r2(mid + 2.7), FY, -1.43], 0);
  m.prop('crate_small', [r2(mid - 2.6), FY, -1.25], 0.3).prop('dynamite_crate', [r2(mid - 5.5), FY, 1.25], 0);
}
for (const c of [MAIL, COACH, DINER, CABOOSE]) m.light([r2((c.x0 + c.x1) / 2), CEIL - 0.1, 0], { fixture: 'ceiling', color: '#ffd9a0', intensity: 0.9, range: Math.max(8, c.len * 0.6) });

// ---------------------------------------------------------------- the treadmill (scenery streaming past)
const SPEED = 14;
const RISE_X = 110; // where the scenery comes up out of the mist ahead
const PASS = 250; // how far it runs along the train
const SINK = 52; // how far down it goes to hide under the canyon floor
const GROUPS = 15;
const PERIOD = (2 * PASS + 2 * SINK) / SPEED;
const LOOP: V3[] = [[0, -SINK, 0], [0, 0, 0], [-PASS, 0, 0], [-PASS, -SINK, 0]];
/** A trestle bent: timber frames stacked down to the canyon floor, wider as they go, turned across the line. */
const BENT = [1.5, 2.4, 3.4, 4];
const scenery: string[] = [];
for (let g = 0; g < GROUPS; g++) {
  const id = `scenery_${String(g + 1).padStart(2, '0')}`;
  const props: string[] = [];
  const blocks: string[] = [];
  for (const [k, dx] of [0, 20, 40].entries()) {
    const x = RISE_X + dx;
    let top = DECK - 0.6;
    BENT.forEach((s, j) => {
      top -= 3.55 * s;
      const pid = `${id}_bent${k + 1}_${j + 1}`;
      m.add({ kind: 'prop', id: pid, model: 'prop.mine_frame', position: [x, r2(top), 0], yaw: P, scale: s, solid: false, tint: null });
      props.push(pid);
    });
  }
  // Telegraph poles on the north side, with a crossarm.
  for (const [k, dx] of [0, 40].entries()) {
    const x = RISE_X + dx;
    const bid = `${id}_pole${k + 1}`;
    m.block([x, DECK - 2, 3.9], [0.3, 10, 0.3], 'solid', { material: 'dark_wood', id: bid });
    blocks.push(bid);
    const aid = `${id}_arm${k + 1}`;
    m.add({ kind: 'prop', id: aid, model: 'prop.hitching_post', position: [x, DECK + 7.1, 3.9], yaw: P, scale: 1, solid: false, tint: null });
    props.push(aid);
  }
  m.mover(id, [RISE_X, DECK, 0], blocks, LOOP, { mode: 'loop', speed: SPEED, wait: 0, startActive: false, props, name: `Scenery ${g + 1}` });
  scenery.push(id);
}

// ---------------------------------------------------------------- the low bridge and the tunnel
const ARCH_SINK = 56;
const ARCH_LOOP: V3[] = [[0, -ARCH_SINK, 0], [0, 0, 0], [-PASS, 0, 0], [-PASS, -ARCH_SINK, 0]];
{
  // The low bridge: a timber road deck on two tall piers either side of the line.
  const x = RISE_X;
  const ids: string[] = [];
  const part = (sfx: string, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, look: Look) => {
    box(x + x0, y0, z0, x + x1, y1, z1, look, `bridge_${sfx}`);
    ids.push(`bridge_${sfx}`);
  };
  part('deck', -2.5, LINTEL, -9, 2.5, LINTEL + 1.1, 9, PLANKS);
  part('rail_n', -2.5, LINTEL + 1.1, 8.7, 2.5, LINTEL + 2, 9, TIMBER);
  part('rail_s', -2.5, LINTEL + 1.1, -9, 2.5, LINTEL + 2, -8.7, TIMBER);
  for (const s of [-1, 1]) {
    const [z0, z1] = s > 0 ? [3.2, 4.6] : [-4.6, -3.2];
    part(`pier_${s > 0 ? 'n' : 's'}_top`, -1.2, 22, z0, 1.2, LINTEL, z1, ROCK);
    part(`pier_${s > 0 ? 'n' : 's'}_low`, -1.2, 0, z0, 1.2, 22, z1, ROCK);
  }
  m.add({ kind: 'prop', id: 'bridge_wagon', model: 'prop.covered_wagon', position: [x, LINTEL + 1.1, -4], yaw: 0, scale: 1, solid: false, tint: null });
  m.mover('mover_low_bridge', [x, DECK, 0], ids, ARCH_LOOP, { mode: 'trigger', speed: SPEED, wait: 0, props: ['bridge_wagon'], name: 'The low bridge' });
}
{
  // The tunnel: a 12 m rock bore, its crown just over the roofs.
  const x = RISE_X;
  const ids: string[] = [];
  const part = (sfx: string, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, look: Look) => {
    box(x + x0, y0, z0, x + x1, y1, z1, look, `tunnel_${sfx}`);
    ids.push(`tunnel_${sfx}`);
  };
  part('crown', -6, LINTEL, -7, 6, LINTEL + 7, 7, ROCK);
  for (const s of [-1, 1]) {
    const [z0, z1] = s > 0 ? [3.2, 7] : [-7, -3.2];
    part(`wall_${s > 0 ? 'n' : 's'}_top`, -6, 22, z0, 6, LINTEL, z1, ROCK);
    part(`wall_${s > 0 ? 'n' : 's'}_low`, -6, 0, z0, 6, 22, z1, ROCK);
  }
  part('portal', -6.4, LINTEL - 0.2, -3.4, -6, LINTEL + 1.2, 3.4, TIMBER); // timbers round the leading mouth
  m.mover('mover_tunnel', [x, DECK, 0], ids, ARCH_LOOP, { mode: 'trigger', speed: SPEED, wait: 0, name: 'The tunnel' });
}

// Warning lamps on the cab roof and the caboose.
m.light([r2(CAB.x0 + 1), RY + 0.4, 0], { fixture: 'bulb', color: '#ff3020', id: 'lamp_cab', off: true, intensity: 2, range: 14 });
m.light([r2(CABOOSE.x0 + 1), RY + 0.4, 0], { fixture: 'bulb', color: '#ff3020', id: 'lamp_caboose', off: true, intensity: 2, range: 14 });
// A warm lantern on the porch and one over the tender.
m.light([r2(CABOOSE.x0 - 1.5), FY + 2, 0], { fixture: 'bulb', color: '#ffb060', intensity: 1, range: 7 });
m.light([r2(TENDER.x0 + 3), FY + 2.6, 0], { fixture: 'none', color: '#ffb060', intensity: 0.8, range: 8 });

// ---------------------------------------------------------------- logic
const act = (type: LogicAction['type'], target: string | null = null, o: { value?: number; text?: string; state?: string } = {}): LogicAction => ({ type, target, value: o.value ?? 0, text: o.text ?? '', state: o.state ?? '' });
const when = (event: LogicRule['when']['event'], target: string | null = null): LogicRule['when'] => ({ event, target });
const at = (mover: string, point: number): LogicCondition => ({ type: 'mover_at', target: mover, op: '==', value: point, state: '' });
const rule = (id: string, name: string, w: LogicRule['when'], does: LogicAction[], ifs: LogicCondition[] = []): LogicRule => ({ id, name, enabled: true, once: false, when: w, if: ifs, do: does });
const step = r2(PERIOD / GROUPS);
const archRules = (mover: string, timer: string, what: string): LogicRule[] => [
  rule(`rule_${mover}_go`, `${what}: up ahead`, when('timer_done', timer), [act('mover_to', mover, { value: 2 })], [at(mover, 1)]),
  rule(`rule_${mover}_sweep`, `${what}: sweeps the train`, when('mover_arrived', mover), [
    act('mover_to', mover, { value: 3 }),
    act('wait', null, { value: 3.4 }),
    act('sound', null, { state: 'alarm' }),
    act('message', null, { value: 3, text: `${what.toUpperCase()}! Get off the roofs!` }),
    act('light_on', 'lamp_cab'),
    act('light_on', 'lamp_caboose'),
    act('light_blink', 'lamp_cab', { value: 4, state: 'on' }),
    act('light_blink', 'lamp_caboose', { value: 4, state: 'on' }),
    act('wait', null, { value: 6 }),
    act('light_blink', 'lamp_cab', { state: 'off' }),
    act('light_blink', 'lamp_caboose', { state: 'off' }),
    act('light_off', 'lamp_cab'),
    act('light_off', 'lamp_caboose'),
  ], [at(mover, 2)]),
  rule(`rule_${mover}_sink`, `${what}: sinks behind`, when('mover_arrived', mover), [act('mover_to', mover, { value: 4 })], [at(mover, 3)]),
  rule(`rule_${mover}_back`, `${what}: back under the canyon`, when('mover_arrived', mover), [act('mover_to', mover, { value: 1 })], [at(mover, 4)]),
];
m.logic({
  variables: [],
  timers: [
    { id: 'timer_tunnel', name: 'Tunnel', seconds: 29, loop: true, visible: false },
    { id: 'timer_bridge', name: 'Low bridge', seconds: 43, loop: true, visible: false },
  ],
  objectives: [],
  rules: [
    rule('rule_depart', 'The express pulls out', when('match_start'), [
      act('message', null, { value: 4, text: 'All aboard! Mind the low bridge and the tunnel: get off the roofs when the alarm sounds.' }),
      act('timer_start', 'timer_tunnel'),
      act('timer_start', 'timer_bridge'),
      ...scenery.flatMap((id, i) => (i ? [act('wait', null, { value: step }), act('enable', id)] : [act('enable', id)])),
    ]),
    ...archRules('mover_tunnel', 'timer_tunnel', 'Tunnel'),
    ...archRules('mover_low_bridge', 'timer_bridge', 'Low bridge'),
  ],
});

m.bounds('invisible', 0, { min: [-160, -60], max: [170, 60] }, 60);
m.meta({
  description:
    'A train heist where the train never moves; the world does. Bandits fight along the roofs of a speeding express on a trestle 40 m over a misty canyon while the bents and telegraph poles stream past. Walk through the mail car, coach, diner and caboose, or run the roofs, and drop into a gangway when the alarm sounds: a low bridge and a rock tunnel sweep the roof line. Bomb site: the strongbox in the mail car.',
  modes: ['core.bomb', 'core.tdm'],
  players: [8, 12],
});
await m.save();
