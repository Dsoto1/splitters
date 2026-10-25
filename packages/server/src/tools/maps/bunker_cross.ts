/**
 * Bunker Cross: two concrete bunkers glaring at each other across an open,
 * sun-baked yard cut in half by a dry canal (an homage in spirit to Half-Life
 * deathmatch's Crossfire, rebuilt from our own pieces). Each bunker has a
 * ground-floor hall with three blast doors onto the yard, a sniper gallery a
 * storey up looking over it, and stairs down to tunnels that run under the
 * flanks of the yard and meet the canal in two culverts. The north bunker's
 * storeroom holds the railgun; deep in the south bunker, the control room's
 * button calls an airstrike on the yard.
 *
 * The airstrike: press the button, the alarm sounds three times, at +5 s the
 * eight blast doors (six bunker doors, two culvert mouths) lock shut, and at
 * +6 s 110 buried charges go off at once: every 4 m across the yard, along
 * the canal floor, in the bridge deck and on top of everything climbable.
 * Anyone outside dies; walls and doors keep the blasts out of the bunkers and
 * tunnels. The doors unlock at +8 s and the button comes back after 60 s.
 *
 * Grid x east, y north (one cell = 8 m); levels: z-1 canal and tunnels, z0 yard
 * and bunker floors, z1 sniper galleries.
 *
 *   y5        .   W   .  [S]  .   W   .        S storeroom (railgun), W stairwells up to the gallery landings
 *   y4        t   r   r   r   r   r   t        t tunnel rooms (stairs up from below), r back rooms
 *   y3        ^   H   H   H   H   H   ^        H front hall (z0) under the sniper gallery (z1); ^ stairs down to the tunnels
 *                 D       D       D            D blast doors onto the yard
 *   y2        |   .   .   r   .   .   |        . yard (z0): c crate stacks, w low walls, r ruins
 *   y1        |   .   c   .   w   .   |        | tunnels (z-1) under the flanks, roofed over
 *   y0        J]  ~   ~   B   ~   ~  [J        ~ dry canal (z-1, jump pads back up), B bridge (z0), J] culverts with blast doors
 *   y-1       |   .   w   .   c   .   |
 *   y-2       |   .   .   r   .   .   |
 *                 D       D       D
 *   y-3       v   H   H   H   H   H   v
 *   y-4       t   r   r   r   r   r   t
 *   y-5       .   W   .  [C]  .   W   .        C control room: the airstrike button
 *            -3  -2  -1   0   1   2   3
 */
import type { LogicAction, LogicRule, Rotation, Side } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('bunker_cross', 'Bunker Cross');
m.theme('bunker');
m.backdrop('clear', 'mesas', 'sand', 0.45);
const [north, south] = m.teamIds() as [string, string];
const P = Math.PI / 2;
type V3 = [number, number, number];
const at = (x: number, y: number, z = 0, dx = 0, dy = 0, up = 0): V3 => [x * 8 + dx, z * 4 + up, y * 8 + dy];

// ---------------------------------------------------------------- the yard (z0) and the canal (z-1)

const yardKind: Record<string, [string, Rotation]> = {
  '-1,1': ['yard_crates', 0],
  '1,-1': ['yard_crates', 2],
  '1,1': ['yard_wall', 0],
  '-1,-1': ['yard_wall', 2],
  '0,2': ['yard_ruins', 0],
  '0,-2': ['yard_ruins', 2],
};
for (let x = -2; x <= 2; x++) {
  for (const y of [-2, -1, 1, 2]) {
    const [kind, rot] = yardKind[`${x},${y}`] ?? ['yard', 0];
    m.tile(kind, x, y, 0, rot);
  }
  m.tile('yard', x, 0, -1); // the canal floor, 4 m down
}
m.tile('bridge', 0, 0, 0); // over the canal, north-south
// Canal lips: sheer drops at the bridge and either side of it, half walls at the ends.
for (const [x, style] of [[-2, 'half'], [-1, 'open'], [0, 'open'], [1, 'open'], [2, 'half']] as const) {
  m.edge(x, 1, 0, 'S', style).edge(x, -1, 0, 'N', style);
}

// ---------------------------------------------------------------- tunnels under the flanks (z-1)

for (const s of [-1, 1] as const) {
  const x = 3 * s;
  m.tile('junction_t', x, 0, -1, s < 0 ? 1 : 3); // culvert: canal mouth plus the tunnels north and south
  m.edge(x - s, 0, -1, s < 0 ? 'W' : 'E', 'door');
  m.tile('corridor', x, 1, -1).tile('corridor_clear', x, 2, -1);
  m.tile('corridor', x, -1, -1).tile('corridor_clear', x, -2, -1);
  m.tile('stairs', x, 3, -1, 3); // up north into the north bunker's tunnel room
  m.tile('stairs', x, -3, -1, 1); // up south into the south bunker's
}

// ---------------------------------------------------------------- the bunkers (north: sy = 1, south: sy = -1)

for (const sy of [1, -1] as const) {
  const front: Side = sy > 0 ? 'S' : 'N';
  const back: Side = sy > 0 ? 'N' : 'S';
  // Ground floor: the front hall (arches between its bays), back rooms, the tunnel rooms at the ends.
  m.tile('room', -2, 3 * sy).tile('room_cover', -1, 3 * sy).tile('room_columns', 0, 3 * sy).tile('room_cover', 1, 3 * sy).tile('room', 2, 3 * sy);
  for (let x = -2; x <= 1; x++) m.edge(x, 3 * sy, 0, 'E', 'arch');
  for (let x = -3; x <= 3; x++) m.tile(x === 0 ? 'room_columns' : 'room', x, 4 * sy);
  // Three doorways onto the yard, solid wall between; two doorways from the hall to the back rooms.
  for (const x of [-2, -1, 0, 1, 2]) m.edge(x, 3 * sy, 0, front, Math.abs(x) === 1 ? 'wall' : 'door');
  for (const x of [-1, 1]) m.edge(x, 3 * sy, 0, back, 'wall');
  // The storeroom (north) / control room (south): one doorway in, from the middle back room.
  m.tile('room', 0, 5 * sy);
  // Stairwells up to the gallery landings.
  for (const x of [-2, 2]) m.tile('stairwell', x, 5 * sy, 0, sy > 0 ? 3 : 1);
  // Sniper gallery over the hall: windows and a firing slit over the yard; landings at both ends.
  for (let x = -2; x <= 2; x++) m.tile('room', x, 3 * sy, 1);
  for (let x = -2; x <= 1; x++) m.edge(x, 3 * sy, 1, 'E', 'arch');
  for (const [x, style] of [[-2, 'window'], [-1, 'windows'], [0, 'slit'], [1, 'windows'], [2, 'window']] as const) m.edge(x, 3 * sy, 1, front, style);
  for (const x of [-2, 2]) m.tile('room', x, 4 * sy, 1);

  // Concrete roofs over everything indoors (unreachable slabs, just shade and shelter).
  const roof = (cx: number, cz: number, w: number, d: number, y: number) => m.block([cx, y, cz], [w, 0.5, d], 'solid', { material: 'pbr_concrete' });
  roof(0, 32 * sy, 24, 8, 3.5); // middle back rooms
  roof(0, 40 * sy, 8, 8, 3.5); // storeroom / control room
  for (const s of [-1, 1]) roof(24 * s, 28 * sy, 8, 16, 3.5); // tunnel rooms and the stairs below them
  roof(0, 24 * sy, 40, 8, 8); // gallery
  for (const s of [-1, 1]) roof(16 * s, 36 * sy, 8, 16, 8); // landings and stairwells
}
// The flanks of the yard are solid ground over the tunnels.
for (const s of [-1, 1]) m.block([24 * s, -0.5, 0], [8, 0.5, 40], 'solid', { material: 'pbr_concrete' });

// ---------------------------------------------------------------- jump pads out of the canal

for (const x of [-1, 1]) {
  m.pad(at(x, 0, -1, 0, 2), 0, 16, 4);
  m.pad(at(x, 0, -1, 0, -2), Math.PI, 16, 4);
}

// ---------------------------------------------------------------- scenario: blast doors, button and the buried charges

const doors: string[] = [];
for (const sy of [1, -1]) {
  for (const x of [-2, 0, 2]) {
    const id = `blastdoor_${sy > 0 ? 'n' : 's'}${x + 2}`;
    doors.push(id);
    m.add({ kind: 'door', id, name: 'Blast door', position: [x * 8, 0, 20 * sy], yaw: 0, startOpen: false, locked: false, auto: true });
  }
}
for (const s of [-1, 1]) {
  const id = `blastdoor_culvert_${s < 0 ? 'w' : 'e'}`;
  doors.push(id);
  m.add({ kind: 'door', id, name: 'Culvert blast door', position: [20 * s, -4, 0], yaw: P, startOpen: false, locked: false, auto: true });
}
m.add({ kind: 'button', id: 'btn_airstrike', name: 'Airstrike control', position: at(0, -5, 0, 0, -3.2), yaw: 0, label: 'Call the airstrike', once: false, cooldownSeconds: 60, startEnabled: true });

// Charges: buried just under the floor (blast 0.1 m above it) every 4 m, so every spot is within 3 m of one.
const charges: string[] = [];
const charge = (pos: V3) => {
  const id = `charge_${String(charges.length + 1).padStart(3, '0')}`;
  charges.push(id);
  m.add({ kind: 'trap', id, name: 'Airstrike charge', trap: 'mine', position: pos, yaw: 0, activation: 'proximity', onSeconds: 0.2, offSeconds: 600, offsetSeconds: 0, startEnabled: false, damage: 1000 });
};
// Cells with solid cover get their own layout (in the tile's frame), clear of the solids and on top of anything climbable.
const GRID: [number, number, number][] = [[-2, -2, 0], [2, -2, 0], [-2, 2, 0], [2, 2, 0]];
const LAYOUT: Record<string, [number, number, number][]> = {
  yard_crates: [[-2, -2, 0], [2, -2, 0], [-2, 2, 0], [3.5, 3.3, 0], [1.5, 1.5, 2]], // and on the 2 m stack
  yard_ruins: [[-1.2, 1.2, 0], [1.2, 1.2, 0], [-1.2, -1.2, 0], [1.5, -3.2, 0], [-3.2, 0, 0], [2.5, 2.5, 1.4], [1.8, -2, 0.9]], // and on the blocks
};
for (let x = -2; x <= 2; x++) {
  for (const y of [-2, -1, 0, 1, 2]) {
    const [kind, rot] = y === 0 ? ['yard', 0] : (yardKind[`${x},${y}`] ?? ['yard', 0]);
    const flip = rot === 2 ? -1 : 1; // only half turns are used for the cover tiles
    for (const [dx, dy, top] of LAYOUT[kind] ?? GRID) charge(at(x, y, y === 0 ? -1 : 0, dx * flip, dy * flip, top - 0.2));
  }
}
for (const dy of [-2.5, 2.5]) charge(at(0, 0, 0, 0, dy, -0.2)); // the bridge deck

const act = (type: LogicAction['type'], target: string | null = null, o: { value?: number; text?: string; state?: string } = {}): LogicAction => ({ type, target, value: o.value ?? 0, text: o.text ?? '', state: o.state ?? '' });
const rule = (id: string, name: string, when: LogicRule['when'], actions: LogicAction[], once = false): LogicRule => ({ id, name, enabled: true, once, when, if: [], do: actions });
const pressed = { event: 'button_pressed', target: 'btn_airstrike' } as const;
const STRIKE_AT = 6;

const rules: LogicRule[] = [
  rule('rule_intro', 'Intro', { event: 'match_start', target: null }, [act('message', null, { value: 6, text: 'The control room deep in the south bunker can call an airstrike on the yard.' })], true),
  rule('rule_airstrike', 'Airstrike: alarm, strike, cooldown', pressed, [
    act('disable', 'btn_airstrike'),
    act('message', null, { value: 5, text: 'AIRSTRIKE INBOUND! Get inside!' }),
    act('sound', null, { state: 'alarm' }),
    act('wait', null, { value: 2 }),
    act('sound', null, { state: 'alarm' }),
    act('wait', null, { value: 2 }),
    act('sound', null, { state: 'alarm' }),
    act('message', null, { value: 2, text: 'Blast doors sealing!' }),
    act('wait', null, { value: STRIKE_AT - 4 }),
    act('sound', null, { state: 'boom' }),
    act('wait', null, { value: 60 - STRIKE_AT }),
    act('enable', 'btn_airstrike'),
    act('message', null, { value: 3, text: 'Airstrike control is ready again.' }),
    act('sound', null, { state: 'chime' }),
  ]),
  rule('rule_blast_doors', 'Airstrike: blast doors shut', pressed, [
    act('wait', null, { value: STRIKE_AT - 1 }),
    ...doors.flatMap((d) => [act('door_lock', d), act('door_close', d)]),
    act('wait', null, { value: 3 }),
    ...doors.map((d) => act('door_unlock', d)),
  ]),
];
// The charges, ten to a rule (enable, fire, and disable again a second later so they never go off underfoot).
for (let i = 0; i < charges.length; i += 10) {
  const group = charges.slice(i, i + 10);
  rules.push(
    rule(`rule_strike_${String(i / 10 + 1).padStart(2, '0')}`, `Airstrike: charges ${i + 1}-${i + group.length}`, pressed, [
      act('wait', null, { value: STRIKE_AT }),
      ...group.flatMap((c) => [act('enable', c), act('trap_fire', c)]),
      act('wait', null, { value: 1 }),
      ...group.map((c) => act('disable', c)),
    ]),
  );
}
m.logic({ variables: [], timers: [], objectives: [], rules });

// ---------------------------------------------------------------- spawns

// Team spawns: each side in its own bunker (back rooms, landings).
for (const [team, sy] of [[north, 1], [south, -1]] as const) {
  const face = sy > 0 ? Math.PI : 0;
  for (const [x, y, z, dx, dy] of [[-2, 4, 0, 1, 1], [2, 4, 0, -1, 1], [-1, 4, 0, -1.5, 1.5], [1, 4, 0, 1.5, 1.5], [-2, 4, 1, 0, 1], [2, 4, 1, 0, 1]] as const) {
    m.spawn(at(x, y * sy, z, dx, dy * sy), face, team);
  }
}
// Shared spawns (deathmatch): both bunkers, the galleries and the tunnels.
for (const sy of [1, -1] as const) {
  const face = sy > 0 ? Math.PI : 0;
  m.spawn(at(-3, 4 * sy, 0, -1, 2 * sy), sy > 0 ? 2.4 : 0.7).spawn(at(3, 4 * sy, 0, 1, 2 * sy), sy > 0 ? -2.4 : -0.7);
  m.spawn(at(0, 4 * sy, 0, 0, 2.5 * sy), face).spawn(at(-1, 3 * sy, 1, 0, 1.5 * sy), face).spawn(at(1, 3 * sy, 1, 0, 1.5 * sy), face);
  m.spawn(at(-2, 3 * sy, 0, -2, 1.5 * sy), face);
}
m.spawn(at(-3, 1, -1, 1.5, 0), Math.PI).spawn(at(3, -1, -1, -1.5, 0), 0);
m.spawn(at(-3, -2, -1, 1.5, 0), 0).spawn(at(3, 2, -1, -1.5, 0), Math.PI);

// ---------------------------------------------------------------- pickups

// Power: the railgun in the north storeroom; heavy armour in the south control room by the button; rockets under the bridge; double damage on it.
m.pickup('weapon_railgun', at(0, 5, 0, 0, 1)).pickup('ammo_sniper', at(0, 5, 0, -2.5, 2.5));
m.pickup('armor_large', at(0, -5, 0, 2.5, 0));
m.pickup('weapon_rockets', at(0, 0, -1)).pickup('ammo_explosive', at(-2, 0, -1)).pickup('ammo_explosive', at(2, 0, -1));
m.pickup('powerup_damage', at(0, 0, 0));
for (const sy of [1, -1] as const) {
  // Snipers in the galleries, shotguns and armour in the halls, health and SMGs in the back.
  m.pickup('weapon_sniper', at(0, 3 * sy, 1, 0, 1.5 * sy)).pickup('ammo_sniper', at(-2, 3 * sy, 1)).pickup('ammo_sniper', at(2, 3 * sy, 1));
  m.pickup('weapon_shotgun', at(-1, 3 * sy, 0, 0, 2 * sy)).pickup('armor_small', at(1, 3 * sy, 0, 0, 2 * sy)).pickup('ammo_shells', at(2, 3 * sy, 0));
  m.pickup('health_large', at(-1, 4 * sy, 0, 0, 1 * sy)).pickup('weapon_smg', at(1, 4 * sy, 0, 0, 1 * sy)).pickup('ammo_light', at(2, 4 * sy, 0));
  m.pickup('health_small', at(-3, 4 * sy, 0)).pickup('ammo', at(3, 4 * sy, 0));
}
// Tunnels: launcher and rifle, grenades, health.
m.pickup('weapon_launcher', at(-3, 1, -1, 1.5, 0)).pickup('weapon_burst_rifle', at(3, -1, -1, -1.5, 0));
m.pickup('grenades', at(-3, -2, -1)).pickup('grenades', at(3, 2, -1));
m.pickup('health_small', at(-3, -1, -1, 1.5, 0)).pickup('health_small', at(3, 1, -1, -1.5, 0));
m.pickup('ammo_rifle', at(-3, 2, -1)).pickup('ammo_rifle', at(3, -2, -1));
// The yard: a rifle and a little health out in the open.
m.pickup('weapon_rifle', at(-2, -2, 0)).pickup('weapon_plasma', at(2, 2, 0)).pickup('ammo_cells', at(-2, 2, 0, 2, 0));
m.pickup('health_small', at(-2, 1, 0)).pickup('health_small', at(2, -1, 0));

// ---------------------------------------------------------------- props

// Yard: concrete barriers and boxes for cover, a skip, lamps on the walls; explosive drums that go up with the strike.
m.prop('barrier', at(-2, 2, 0, 1, -2), 0).prop('barrier', at(2, -2, 0, -1, 2), 0);
m.prop('barrier', at(2, 1, 0, 0, 3), 0.3).prop('barrier', at(-2, -1, 0, 0, -3), 0.3);
m.prop('factory_box', at(-2, -2, 0, 2.5, 2), 0.2).prop('factory_box', at(2, 2, 0, -2.5, -2), 0.2);
m.prop('skip', at(1, 2, 0, 1, 1), P).prop('crate_large', at(-1, -2, 0, -1, -1), 0.4);
m.breakable('barrel', at(-2, 1, 0, -2.5, 2.5)).breakable('barrel', at(2, -1, 0, 2.5, -2.5));
for (const sy of [1, -1]) for (const x of [-1, 1]) m.prop('warning_sign', at(x, 2 * sy, 0, 0, 3.4 * sy), sy > 0 ? Math.PI : 0, 1, false);
for (const s of [-1, 1]) for (const y of [-2, 2]) m.prop('lightpost', at(2 * s, y, 0, 3.2 * s, 0), s > 0 ? -P : P);
// Canal: debris, rocks, a drum of gas.
m.prop('debris', at(-1, 0, -1, -1, 1.5)).prop('rock_medium', at(1, 0, -1, 2, -1.8)).prop('rock_small', at(-2, 0, -1, 1, -2));
m.prop('big_pipe', at(2, 0, -1, -1, 3), P).breakable('gas', at(-2, 0, -1, -3, 2.8));
// Halls: sandbag-style barriers and crates by the doors.
for (const sy of [1, -1] as const) {
  m.prop('barrier', at(-1, 3 * sy, 0, 0, -1 * sy), 0).prop('barrier', at(1, 3 * sy, 0, 0, -1 * sy), 0);
  m.prop('crate_large', at(-2, 3 * sy, 0, -2.6, 2.6 * sy)).prop('metal_crate', at(2, 3 * sy, 0, 2.6, 2.6 * sy));
  // Back rooms: bunks, a table, lockers.
  m.prop('bunk_bed', at(-2, 4 * sy, 0, -2.4, 2.4 * sy), P).prop('table', at(-1, 4 * sy, 0, 1.5, -1.5 * sy)).prop('chair', at(-1, 4 * sy, 0, 2.6, -1.5 * sy), -P, 1, false);
  m.prop('kitchen_cabinet', at(1, 4 * sy, 0, 3.2, 2 * sy), -P).prop('shelf_boxes', at(2, 4 * sy, 0, 3.2, 1 * sy), -P);
  m.prop('pipe_valve', at(-3, 4 * sy, 0, -3, 3 * sy)).prop('barrel', at(3, 4 * sy, 0, 3, 3 * sy));
  // Galleries: crates under the windows.
  m.prop('crate_small', at(-1, 3 * sy, 1, -2.5, 2.5 * sy)).prop('crate_small', at(1, 3 * sy, 1, 2.5, 2.5 * sy));
}
// The storeroom: shelves and crates round the railgun.
m.prop('shelf_boxes', at(0, 5, 0, -3.2, 0), P).prop('shelf_bags', at(0, 5, 0, 3.2, 0), -P).prop('cargo_crate', at(0, 5, 0, 2.5, 3), 0).prop('metal_crate', at(0, 5, 0, -2.5, -2.5));
// The control room: consoles round the button.
m.prop('computer_bank', at(0, -5, 0, -2.5, -3.2), 0).prop('screen_panel', at(0, -5, 0, 2.5, -3.3), 0).prop('desk', at(0, -5, 0, -3, 0.5), P).prop('office_chair', at(0, -5, 0, -1.8, 0.5), -P, 1, false);
// Tunnels: pipes and drums.
for (const s of [-1, 1]) {
  m.prop('pipe_valve', at(3 * s, 2, -1, 3 * s, 0)).prop('barrel', at(3 * s, -2, -1, 3 * s, 1)).prop('barrel_open', at(3 * s, -2, -1, 3 * s, -0.2));
}

m.bounds('invisible');
m.teams([8, 8]);
// ---------------------------------------------------------------- objectives
// Capture the Flag: each team's flag in the front hall of its own bunker, behind the middle blast door.
m.flag(north, at(0, 3, 0, 0, 1), Math.PI).flag(south, at(0, -3, 0, 0, -1), 0);
// King of the Hill: the bridge, then the yard either side of the canal.
m.hill(at(0, 0, 0), 5).hill(at(-2, 1, 0), 5).hill(at(2, -1, 0), 5);

// Furniture in the bare rooms, for what they are in this theme.
m.furnish();
// Enough team spawns for a full match.
await m.fillTeamSpawns(8);
m.lightRooms();
m.meta({
  description:
    'Two concrete bunkers face each other across an open yard split by a dry canal. Snipe from the galleries, run the tunnels under the flanks, grab the railgun from the north storeroom, and if the yard gets crowded, hit the button deep in the south bunker: an alarm, the blast doors seal, and six seconds later an airstrike levels everything outside.',
  modes: ['core.deathmatch', 'core.tdm', 'core.ctf', 'core.koth'],
  players: [6, 16],
});
await m.save();
