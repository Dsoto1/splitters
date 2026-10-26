/**
 * Express Lobby: a skyscraper's elevator core is the arena (docs/MAP_IDEAS.md,
 * top-10 #4; our own map and name). Six open glass cabs race up and down a
 * 48 m Neon Megacity atrium; you fight by hopping cab to cab, and the shaft
 * kills anyone who gets in a car's way (cabs run at 5–6 m/s: run-over speed).
 *
 * - The atrium: 27 × 19 m inside, twelve floors (4 m each) and the roof at
 *   48 m. Landing balconies run along the north and south walls on every
 *   other floor (8, 16, 24, 32 and 40 m), joined by fire ladders up the walls.
 * - Six cabs in two rows of three in the middle, each a floor, four corner
 *   posts and a lit roof (ride inside or on top). Different ranges, speeds
 *   and waits, so they pass each other all match:
 *     north row  A lobby → roof (6 m/s), B 8 → 40 m (5 m/s), C lobby → 40 m,
 *                stopping at every landing (5.5 m/s; its floor indicator is
 *                in the lobby),
 *     south row  D lobby → the west mezzanine (36 m), E lobby → roof (6 m/s),
 *                F lobby → the east mezzanine (20 m).
 *   Jetties off the north landings meet B and C at their stops.
 * - Two mezzanines, at 20 m (east) and 36 m (west), between the landings:
 *   reached by riding D or F (or a drop from the landing above). They hold
 *   the King of the Hill hills.
 * - The roof: the machine room, whose console drops the floor of cab C
 *   wherever it is (its riders fall into the shaft: hold jump to open a
 *   parachute, since long falls kill here), a helipad with a gunship, AC units
 *   and antennas. Cabs A and E come up through hatches in the roof.
 * - The lobby: revolving-door force fields in the east and west entrances
 *   (one leaf of each is up at a time, swapping every 2 s), vending machines,
 *   a reception desk, a holo billboard, and the floor indicator for cab C.
 *   Outside, a ring of wet street with the teams' spawns east and west.
 *
 * Plan (x east, z north; metres), lobby level:
 *
 *   z +9.6  ========== north wall (landings above) ==========
 *   z +3     [A]      [B]      [C]        cabs (3.2 m)
 *   z -3     [D]      [E]      [F]
 *   z -9.6  ========== south wall (landings above) ==========
 *     x -13.6  -6       0        6   13.6  (entrances at x ±13.6, z 0)
 */
import type { LogicAction, LogicCondition, LogicRule } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

type V3 = [number, number, number];
type Look = { material: string; tint?: string };
const m = new MapBuilder('express_lobby', 'Express Lobby');
m.theme('neon_megacity');
m.backdrop('night', 'city', 'stone', 0.4);
m.border('skyline');
// Long falls kill: a dropped cab floor means a parachute (hold jump while falling).
m.history.execute('Physics', { kind: 'setPhysics', before: m.doc.physics, after: { gravity: 1, fallDamage: true } });
m.teams([8, 8]);
const [WEST, EAST] = m.teamIds(2) as [string, string];

const r2 = (n: number) => Math.round(n * 100) / 100;
const P = Math.PI / 2;
const S = Math.PI;

// ---------------------------------------------------------------- looks
const GLASS: Look = { material: 'pbr_glass_facade', tint: '#6a80a0' };
const SLAB: Look = { material: 'pbr_terrazzo', tint: '#3a3a44' };
const STEEL: Look = { material: 'pbr_steel', tint: '#4a4a56' };
const STREET: Look = { material: 'pbr_wet_asphalt' };
const PAVE: Look = { material: 'pbr_concrete_dark' };
const RAIL: Look = { material: 'pbr_glass_facade', tint: '#9ab8d8' };
const neon = (tint: string): Look => ({ material: 'neon_tube', tint });

/** A block from corner to corner, split so no side is longer than the kit allows (64 m across, 32 m up). */
function box(xa: number, y0: number, za: number, xb: number, y1: number, zb: number, look: Look, id?: string, o: { hidden?: boolean } = {}): void {
  const [x0, x1, z0, z1] = [Math.min(xa, xb), Math.max(xa, xb), Math.min(za, zb), Math.max(za, zb)];
  if (!id && (y1 - y0 > 32 || x1 - x0 > 64 || z1 - z0 > 64)) {
    const ny = Math.ceil((y1 - y0) / 32);
    const nx = Math.ceil((x1 - x0) / 64);
    const nz = Math.ceil((z1 - z0) / 64);
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < ny; j++)
        for (let k = 0; k < nz; k++)
          box(x0 + ((x1 - x0) * i) / nx, y0 + ((y1 - y0) * j) / ny, z0 + ((z1 - z0) * k) / nz, x0 + ((x1 - x0) * (i + 1)) / nx, y0 + ((y1 - y0) * (j + 1)) / ny, z0 + ((z1 - z0) * (k + 1)) / nz, look);
    return;
  }
  m.block([r2((x0 + x1) / 2), r2(y0), r2((z0 + z1) / 2)], [r2(x1 - x0), r2(y1 - y0), r2(z1 - z0)], 'solid', { ...look, ...(id ? { id } : {}), ...(o.hidden ? { hidden: true } : {}) });
}

// ---------------------------------------------------------------- dimensions
const IX = 13.6; // inner faces of the east and west walls
const IZ = 9.6; // inner faces of the north and south walls
const WALL = 0.4;
const ROOF = 48;
const LANDINGS = [8, 16, 24, 32, 40];
const DEPTH = 3; // landing depth (z 6.6..9.6)
const EDGE = IZ - DEPTH;
const CAB = 3.2;
const H = CAB / 2;
const COLS = [-6, 0, 6];
const ROWS = [3, -3];
const MEZZ_E = 20;
const MEZZ_W = 36;
const LOBBY = 0.1; // top of the lobby floor

// ---------------------------------------------------------------- street, lobby floor and the tower shell
box(-36, -0.6, -24, 36, 0, 24, STREET);
// Pavements round the tower and lane markings.
// A 4 m pavement round the tower (four strips), the lobby floor inside.
const PX = IX + WALL + 4;
const PZ = IZ + WALL + 4;
for (const s of [-1, 1]) {
  box(-PX, 0, s * (IZ + WALL), PX, LOBBY, s * PZ, PAVE);
  box(s * (IX + WALL), 0, -IZ - WALL, s * PX, LOBBY, IZ + WALL, PAVE);
}
box(-IX - WALL, 0, -IZ - WALL, IX + WALL, LOBBY, IZ + WALL, SLAB);
for (const z of [-17, 17]) box(-34, -0.08, z - 0.1, 34, 0.02, z + 0.1, { material: 'paint_matte', tint: '#d8c040' });
// Walls: glass curtain from the street to the roof, with the lobby entrances (4.8 m) in the east and west walls.
const ENT = 2.4;
for (const s of [-1, 1]) {
  box(-IX - WALL, 0, s > 0 ? IZ : -IZ - WALL, IX + WALL, ROOF, s > 0 ? IZ + WALL : -IZ, GLASS);
  const x0 = s > 0 ? IX : -IX - WALL;
  const x1 = x0 + WALL;
  box(x0, 0, -IZ, x1, ROOF, -ENT, GLASS);
  box(x0, 0, ENT, x1, ROOF, IZ, GLASS);
  box(x0, 3, -ENT, x1, ROOF, ENT, GLASS);
  box(x0, 0, -0.2, x1, 3, 0.2, STEEL); // the mullion between the two leaves
  // Neon cornices on every landing line, outside.
  for (const y of [...LANDINGS, ROOF]) {
    box(-IX - WALL - 0.2, y - 0.3, s * (IZ + WALL) + (s > 0 ? 0 : -0.2), IX + WALL + 0.2, y - 0.1, s * (IZ + WALL) + (s > 0 ? 0.2 : 0), neon(y === ROOF ? '#ff4fd8' : '#4fe0ff'));
    box(s * (IX + WALL) + (s > 0 ? 0 : -0.2), y - 0.3, -IZ - WALL, s * (IX + WALL) + (s > 0 ? 0.2 : 0), y - 0.1, IZ + WALL, neon(y === ROOF ? '#ff4fd8' : '#4fe0ff'));
  }
}
// Revolving-door force fields: two leaves in each entrance, one up at a time.
const FIELDS: string[][] = [];
for (const s of [-1, 1]) {
  const x = s * (IX + WALL / 2);
  const a = `field_${s > 0 ? 'east' : 'west'}_n`;
  const b = `field_${s > 0 ? 'east' : 'west'}_s`;
  m.field([r2(x), 0, 1.3], 2.2, 3, { yaw: P, id: a, tint: '#ff4fd8' });
  m.field([r2(x), 0, -1.3], 2.2, 3, { yaw: P, id: b, tint: '#ff4fd8', hidden: true });
  FIELDS.push([a, b]);
}

// ---------------------------------------------------------------- landings, jetties, ladders, mezzanines and the roof
/**
 * Fire ladders zigzag up from landing to landing (north side, mirrored on the south): each climbs the
 * front edge of the landing above from a small bay jutting out of the one below, so you walk off the
 * top straight onto the next landing. The last one comes up through a hatch in the roof.
 */
const ladderX = (level: number, side: 1 | -1) => (level % 2 === 0 ? -12 : 12) * side; // level 0 = lobby → 8 m
/** A slab over x0..x1, z0..z1 at top `y` with square holes cut in it. */
function slab(x0: number, x1: number, z0: number, z1: number, y: number, holes: { x0: number; x1: number; z0: number; z1: number }[], look: Look, t = 0.4): void {
  // Cut along x: strips between the holes' x edges, each strip cut along z round the holes in it.
  const xs = [...new Set([x0, x1, ...holes.flatMap((h) => [h.x0, h.x1])])].filter((x) => x >= x0 && x <= x1).sort((a, b) => a - b);
  for (let i = 0; i + 1 < xs.length; i++) {
    const [a, b] = [xs[i]!, xs[i + 1]!];
    const inStrip = holes.filter((h) => h.x0 < b && h.x1 > a).sort((p, q) => p.z0 - q.z0);
    let z = z0;
    for (const h of inStrip) {
      if (h.z0 > z) box(a, y - t, z, b, y, h.z0, look);
      z = Math.max(z, h.z1);
    }
    if (z < z1) box(a, y - t, z, b, y, z1, look);
  }
}
LANDINGS.forEach((y, i) => {
  for (const s of [1, -1] as const) {
    const zIn = s * EDGE;
    const zOut = s * IZ;
    slab(-IX, IX, Math.min(zIn, zOut), Math.max(zIn, zOut), y, [], SLAB);
    // The bay the next ladder up stands in.
    const up = ladderX(i + 1, s);
    box(up - 0.9, y - 0.4, zIn, up + 0.9, y, zIn - s * 1.4, SLAB);
    // A neon strip along the edge, and glass rails on the outer thirds (the middle stays open for cab hops).
    box(-IX, y - 0.6, zIn, IX, y - 0.4, zIn + s * 0.2, neon(s > 0 ? '#4fe0ff' : '#ff4fd8'));
    for (const [a, b] of [[-IX, -9], [9, IX]] as const) box(a, y, zIn, b, y + 1, zIn + s * 0.2, RAIL);
    // The ladder up from this landing to the next (and from the lobby to the first).
    m.add({ kind: 'ladder', position: [up, y, r2(zIn)], yaw: s > 0 ? S : 0, height: 8.1, width: 0.9 });
    if (i === 0) m.add({ kind: 'ladder', position: [ladderX(0, s), LOBBY, r2(zIn)], yaw: s > 0 ? S : 0, height: 8, width: 0.9 });
    m.light([s * 9, y + 3.4, r2(s * (IZ - 1.4))], { fixture: 'none', color: s > 0 ? '#bfe8ff' : '#ffd0f0', intensity: 1, range: 12 });
  }
});
// Jetties off the north landings to meet cab B (8 and 40 m) and cab C (every landing).
const JETTY_Z0 = ROWS[0]! + H + 0.3;
for (const y of LANDINGS) {
  box(COLS[2]! - H, y - 0.4, JETTY_Z0, COLS[2]! + H, y, EDGE, SLAB);
  if (y === 8 || y === 40) box(COLS[1]! - H, y - 0.4, JETTY_Z0, COLS[1]! + H, y, EDGE, SLAB);
}
// Mezzanines beside cab F (east, 20 m) and cab D (west, 36 m).
const MZ0 = -5.4;
const MZ1 = -0.6;
for (const [s, y] of [[1, MEZZ_E], [-1, MEZZ_W]] as const) {
  const xIn = s * (COLS[2]! + H + 0.3);
  box(xIn, y - 0.5, MZ0, s * IX, y, MZ1, { material: 'pbr_tread_plate', tint: '#3a3040' });
  box(xIn, y - 0.7, MZ0, s * IX, y - 0.5, MZ1, neon('#ffb347'));
  box(xIn, y, MZ0, xIn + s * 0.2, y + 1, MZ0 + 1.2, RAIL);
  box(xIn, y, MZ1 - 1.2, xIn + s * 0.2, y + 1, MZ1, RAIL);
  m.light([r2(s * 10.8), y + 3, -3], { fixture: 'none', color: '#ffb347', intensity: 1.2, range: 10 });
}
// The roof, with hatches for cabs A and E and the top ladders.
const hatch = (x: number, z: number) => ({ x0: x - H - 0.2, x1: x + H + 0.2, z0: z - H - 0.2, z1: z + H + 0.2 });
const roofHoles = [hatch(COLS[0]!, ROWS[0]!), hatch(COLS[1]!, ROWS[1]!), ...([1, -1] as const).map((s) => {
  const lx = ladderX(LANDINGS.length, s);
  return { x0: lx - 0.9, x1: lx + 0.9, z0: Math.min(s * (EDGE + 0.5), s * (EDGE - 1.4)), z1: Math.max(s * (EDGE + 0.5), s * (EDGE - 1.4)) };
})];
slab(-IX - WALL, IX + WALL, -IZ - WALL, IZ + WALL, ROOF, roofHoles, { material: 'pbr_concrete_dark' }, 0.6);
// A parapet round the roof.
for (const s of [-1, 1]) {
  box(-IX - WALL, ROOF, s * (IZ + WALL), IX + WALL, ROOF + 1.1, s * (IZ + WALL - 0.3), STEEL);
  box(s * (IX + WALL), ROOF, -IZ - WALL, s * (IX + WALL - 0.3), ROOF + 1.1, IZ + WALL, STEEL);
}

// ---------------------------------------------------------------- the six cabs
interface CabDef {
  key: string;
  col: number;
  row: number;
  from: number;
  stops: number[];
  speed: number;
  wait: number;
  roofTint: string;
  /** The side its stops open onto ([x, z] unit): the cab's sill is there, and bots' lift links run from it. */
  door: [number, number];
}
const CABS: CabDef[] = [
  { key: 'a', col: 0, row: 0, from: LOBBY, stops: [ROOF], speed: 6, wait: 3, roofTint: '#4fe0ff', door: [1, 0] },
  { key: 'b', col: 1, row: 0, from: 8, stops: [40], speed: 5, wait: 2, roofTint: '#5dff9a', door: [0, 1] },
  { key: 'c', col: 2, row: 0, from: LOBBY, stops: [8, 16, 24, 32, 40], speed: 5.5, wait: 1.6, roofTint: '#ffb347', door: [0, 1] },
  { key: 'd', col: 0, row: 1, from: LOBBY, stops: [MEZZ_W], speed: 5, wait: 3.5, roofTint: '#c45cff', door: [-1, 0] },
  { key: 'e', col: 1, row: 1, from: LOBBY, stops: [ROOF], speed: 6, wait: 2.5, roofTint: '#ff4fd8', door: [1, 0] },
  { key: 'f', col: 2, row: 1, from: LOBBY, stops: [MEZZ_E], speed: 5, wait: 2.5, roofTint: '#ff3b5c', door: [1, 0] },
];
for (const c of CABS) {
  const x = COLS[c.col]!;
  const z = ROWS[c.row]!;
  const y = c.from;
  const id = `cab_${c.key}`;
  const ids: string[] = [];
  const part = (sfx: string, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, look: Look) => {
    box(x + x0, y + y0, z + z0, x + x1, y + y1, z + z1, look, `${id}_${sfx}`);
    ids.push(`${id}_${sfx}`);
  };
  // The floor in two pieces: a 0.6 m sill on the door side first (lift links start from a mover's first block), then the rest.
  const TREAD: Look = { material: 'pbr_tread_plate', tint: '#5a5868' };
  const [dx, dz] = c.door;
  const sill = H - 0.6;
  if (dx) {
    part('sill', dx > 0 ? sill : -H, -0.3, -H, dx > 0 ? H : -sill, 0, H, neon(c.roofTint));
    part('floor', dx > 0 ? -H : -sill, -0.3, -H, dx > 0 ? sill : H, 0, H, TREAD);
  } else {
    part('sill', -H, -0.3, dz > 0 ? sill : -H, H, 0, dz > 0 ? H : -sill, neon(c.roofTint));
    part('floor', -H, -0.3, dz > 0 ? -H : -sill, H, 0, dz > 0 ? sill : H, TREAD);
  }
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) part(`post_${sx > 0 ? 'e' : 'w'}${sz > 0 ? 'n' : 's'}`, sx * H - (sx > 0 ? 0.2 : 0), 0, sz * H - (sz > 0 ? 0.2 : 0), sx * H + (sx > 0 ? 0 : 0.2), 3.2, sz * H + (sz > 0 ? 0 : 0.2), STEEL);
  part('roof', -H, 3.2, -H, H, 3.4, H, neon(c.roofTint));
  // Waist-high glass rails on the three sides away from the door (hop over them to change cabs).
  for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    if (sx === dx && sz === dz) continue;
    const name = sx > 0 ? 'e' : sx < 0 ? 'w' : sz > 0 ? 'n' : 's';
    if (sx) part(`rail_${name}`, sx > 0 ? H - 0.2 : -H, 0, -H + 0.2, sx > 0 ? H : -H + 0.2, 1, H - 0.2, RAIL);
    else part(`rail_${name}`, -H + 0.2, 0, sz > 0 ? H - 0.2 : -H, H - 0.2, 1, sz > 0 ? H : -H + 0.2, RAIL);
    // In the lobby, a fixed rail round the bay too (0.3 m out), so nobody wanders under a cab coming down.
    if (c.from === LOBBY) {
      if (sx) box(x + sx * (H + 0.3), LOBBY, z - H - 0.5, x + sx * (H + 0.5), LOBBY + 1, z + H + 0.5, RAIL);
      else box(x - H - 0.5, LOBBY, z + sz * (H + 0.3), x + H + 0.5, LOBBY + 1, z + sz * (H + 0.5), RAIL);
    }
  }
  const points: V3[] = [[0, 0, 0], ...c.stops.map((s): V3 => [0, r2(s - c.from), 0])];
  m.mover(`mover_${id}`, [x, y, z], ids, points, { mode: 'pingpong', speed: c.speed, wait: c.wait, name: `Cab ${c.key.toUpperCase()}` });
  // A light under each cab roof (static lights can't ride, so the lobby gets a lamp at each shaft instead).
  m.light([x, 4.6, z], { fixture: 'none', color: c.roofTint, intensity: 0.8, range: 6 });
}

// ---------------------------------------------------------------- the lobby
// Reception desk, vending machines, sofas, the billboard and cab C's floor indicator.
box(-3, 0.1, -8.4, 3, 1.15, -7.6, { material: 'pbr_marble_black' });
box(-3, 1.15, -8.5, 3, 1.25, -7.5, neon('#4fe0ff'));
m.prop('nc_vending', [-11.5, 0.1, IZ - 0.5], S).prop('nc_vending', [-10.3, 0.1, IZ - 0.5], S).prop('nc_vending', [11.5, 0.1, -IZ + 0.5], 0);
m.prop('nc_holo_kiosk', [10.5, 0.1, IZ - 1], S).prop('sofa', [-11, 0.1, -IZ + 0.8], 0).prop('sofa', [-8, 0.1, -IZ + 0.8], 0);
m.prop('potted_plant', [-IX + 0.6, 0.1, -IZ + 0.6], 0).prop('potted_plant', [IX - 0.6, 0.1, IZ - 0.6], 0);
m.light([0, 5.2, -IZ + 0.3], { fixture: 'billboard', text: 'EXPRESS LOBBY', color: '#4fe0ff', yaw: 0, intensity: 2, range: 16, size: [9, 2.4], id: 'board_lobby' });
const FLOORS = [1, 3, 5, 7, 9, 11];
FLOORS.forEach((f, i) => m.light([r2(3 + i * 1.2), 5.6, IZ - 0.25], { fixture: 'sign', text: String(f), color: '#ffb347', yaw: S, intensity: 1.4, range: 4, size: [0.9, 0.8], id: `floor_${f}`, ...(i ? { off: true } : {}) }));
m.light([6, 6.6, IZ - 0.25], { fixture: 'sign', text: 'CAB C', color: '#ff4fd8', yaw: S, intensity: 1, range: 4, size: [2.4, 0.7] });
for (const [x, z] of [[-9, 0], [9, 0], [0, -6.5], [0, 6.5]] as const) m.light([x, 3.6, z], { fixture: 'none', color: '#ffe0f0', intensity: 1, range: 11 });

// ---------------------------------------------------------------- the roof
// The machine room (north-west corner): consoles, and the cab-floor release.
{
  const [x0, x1, z0, z1] = [-IX, -8.6, 5, IZ];
  box(x0, ROOF, z0, x1, ROOF + 3.4, z0 + 0.3, STEEL);
  box(x1 - 0.3, ROOF, z0, x1, ROOF + 3.4, z1 - 2.6, STEEL);
  box(x0, ROOF + 3.4, z0, x1, ROOF + 3.7, z1, STEEL);
  m.prop('os_generator', [-12, ROOF, 8], 0).prop('os_console_corner', [-11.6, ROOF, 6], 0).prop('os_terminal', [-9.8, ROOF, 6.2], 0);
  m.add({ kind: 'button', id: 'btn_cab_drop', name: 'Cab C floor release', position: [-10.4, ROOF + 1.1, 5.55], yaw: 0, label: 'Drop cab C floor', once: false, cooldownSeconds: 30, startEnabled: true });
  m.light([-11, ROOF + 3.1, 7.5], { fixture: 'ceiling', color: '#ff6040', intensity: 1, range: 7, id: 'lamp_machine' });
  m.light([-11, ROOF + 4.4, 5.2], { fixture: 'sign', text: 'MACHINE ROOM', color: '#ff3b5c', yaw: 0, intensity: 1.2, range: 6, size: [3.6, 0.7] });
}
// The helipad and the gunship.
box(3, ROOF, -8.6, 12.4, ROOF + 0.25, 0.4, { material: 'pbr_concrete', tint: '#4a4a52' });
box(6.9, ROOF + 0.2, -6.4, 8.5, ROOF + 0.3, -1.8, { material: 'paint_matte', tint: '#f0f0f0' });
m.mount('gunship', [7.7, ROOF + 0.3, -4.1], P);
m.light([7.7, ROOF + 6, -4.1], { fixture: 'none', color: '#ffffff', intensity: 1, range: 12 });
m.prop('nc_ac_unit', [5.5, ROOF, 8.6], 0).prop('nc_ac_unit', [8, ROOF, 8.6], 0).prop('nc_antenna', [12.4, ROOF, 2.8], 0).prop('nc_water_tank', [-6.4, ROOF, -7.6], 0);

// ---------------------------------------------------------------- the street
for (const [x, z, yaw] of [[-20, -14, 0], [20, 14, S], [-20, 14, S], [20, -14, 0]] as const) m.prop('nc_streetlight', [x, 0, z], yaw);
for (const [x, z] of [[-20, -12.5], [20, 12.5], [-20, 12.5], [20, -12.5]] as const) m.light([x, 6.6, z], { fixture: 'none', color: '#ffd9a0', intensity: 1, range: 13 });
m.prop('nc_food_stall', [-24, 0, 6], P).prop('nc_food_stall', [24, 0, -6], -P).prop('nc_dumpster', [-24, 0, -8], P).prop('nc_dumpster', [24, 0, 8], -P);
m.prop('nc_road_barrier', [-27, 0, 0], 0).prop('nc_road_barrier', [27, 0, 0], 0).prop('nc_neon_barrier', [-17.5, 0, 4], P).prop('nc_neon_barrier', [17.5, 0, -4], P);
m.light([-24, 2.6, 6], { fixture: 'sign', text: 'RAMEN', color: '#ff4fd8', yaw: P, intensity: 1.2, range: 6, size: [2.2, 0.7] });
m.light([24, 2.6, -6], { fixture: 'sign', text: 'NOODLES', color: '#5dff9a', yaw: -P, intensity: 1.2, range: 6, size: [2.6, 0.7] });
for (const s of [-1, 1]) m.light([s * (IX + WALL + 0.1), 3.6, 0], { fixture: 'sign', text: 'EXPRESS LOBBY', color: '#4fe0ff', yaw: s * P, intensity: 1.4, range: 8, size: [4.4, 0.8] });

// ---------------------------------------------------------------- objectives, spawns and pickups
m.hill([r2(10.8), MEZZ_E, -3], 2.4);
m.hill([r2(-10.8), MEZZ_W, -3], 2.4);
// West team: the west street and the north landings at 8 and 24 m; east team: the east street and the south landings.
for (const [team, s] of [[WEST, -1], [EAST, 1]] as const) {
  for (const z of [-6, -2, 2, 6]) m.spawn([s * 20, 0, z], -s * P, team);
  const zl = -s * (IZ - 1.4);
  for (const y of [8, 24]) for (const x of [-4, 4]) m.spawn([x, y, r2(zl)], s > 0 ? 0 : S, team);
}
m.pickup('weapon_smg', [-6, 0.1, -7.5]).pickup('weapon_shotgun', [6, 0.1, 7.5]).pickup('ammo', [0, 0.1, -6.5]);
m.pickup('weapon_rifle', [-8, 16, 8.2]).pickup('weapon_rifle', [8, 16, -8.2]);
m.pickup('weapon_burst_rifle', [0, 32, 8.2]).pickup('weapon_launcher', [0, 32, -8.2]);
m.pickup('weapon_rockets', [12, MEZZ_E, -1.6]).pickup('weapon_sniper', [-12, MEZZ_W, -1.6]);
m.pickup('weapon_railgun', [-4, ROOF, -6]).pickup('armor_large', [2, ROOF, 6]);
for (const [x, y, z] of [[-10, 8, -8.2], [10, 8, 8.2], [-6, 24, -8.2], [6, 24, 8.2], [-10, 40, -8.2], [10, 40, 8.2], [-22, 0, 0], [22, 0, 0]] as const) m.pickup('health_small', [x, y, z]);
for (const [x, y, z] of [[10, 32, 8.2], [-10, 32, -8.2], [0, 0.1, 6.5]] as const) m.pickup('health_large', [x, y, z]);
for (const [x, y, z] of [[-6, 16, -8.2], [6, 16, 8.2], [-2, 40, -8.2]] as const) m.pickup('ammo', [x, y, z]);

// ---------------------------------------------------------------- logic
const act = (type: LogicAction['type'], target: string | null = null, o: { value?: number; text?: string; state?: string } = {}): LogicAction => ({ type, target, value: o.value ?? 0, text: o.text ?? '', state: o.state ?? '' });
const when = (event: LogicRule['when']['event'], target: string | null = null): LogicRule['when'] => ({ event, target });
const rule = (id: string, name: string, w: LogicRule['when'], does: LogicAction[], ifs: LogicCondition[] = []): LogicRule => ({ id, name, enabled: true, once: false, when: w, if: ifs, do: does });
m.logic({
  variables: [],
  timers: [
    { id: 'timer_door_a', name: 'Revolving doors (turn)', seconds: 2, loop: false, visible: false },
    { id: 'timer_door_b', name: 'Revolving doors (back)', seconds: 2, loop: false, visible: false },
  ],
  objectives: [],
  rules: [
    rule('rule_welcome', 'Welcome', when('match_start'), [act('message', null, { value: 4, text: 'Express Lobby. Cabs do not stop for you: mind the shaft.' }), act('timer_start', 'timer_door_a')]),
    // Revolving doors: the leaves swap every 2 s.
    rule('rule_door_turn', 'Revolving doors turn', when('timer_done', 'timer_door_a'), [...FIELDS.flatMap(([a, b]) => [act('block_drop', a!), act('block_restore', b!)]), act('timer_start', 'timer_door_b')]),
    rule('rule_door_back', 'Revolving doors turn back', when('timer_done', 'timer_door_b'), [...FIELDS.flatMap(([a, b]) => [act('block_drop', b!), act('block_restore', a!)]), act('timer_start', 'timer_door_a')]),
    // The machine room console drops cab C's floor wherever it is; it comes back 6 s later.
    rule('rule_cab_drop', 'Cab C floor release', when('button_pressed', 'btn_cab_drop'), [
      act('sound', null, { state: 'alarm' }),
      act('message', null, { value: 3, text: 'Cab C floor released! Hold jump to open a parachute.' }),
      act('light_blink', 'lamp_machine', { value: 4, state: 'on' }),
      act('block_drop', 'cab_c_floor'),
      act('block_drop', 'cab_c_sill'),
      act('wait', null, { value: 6 }),
      act('block_restore', 'cab_c_floor'),
      act('block_restore', 'cab_c_sill'),
      act('light_blink', 'lamp_machine', { state: 'off' }),
      act('sound', null, { state: 'chime' }),
    ]),
    // Cab C's floor indicator: the lit number follows the cab from stop to stop.
    ...FLOORS.map((f, i) =>
      rule(`rule_floor_${f}`, `Cab C at floor ${f}`, when('mover_arrived', 'mover_cab_c'), [...FLOORS.map((g) => act(g === f ? 'light_on' : 'light_off', `floor_${g}`)), ...(f === 11 ? [act('sound', null, { state: 'chime' })] : [])], [{ type: 'mover_at', target: 'mover_cab_c', op: '==', value: i + 1, state: '' }]),
    ),
  ],
});

m.bounds('invisible', 0, { min: [-36, -24], max: [36, 24] }, 60);
m.meta({
  description:
    "A skyscraper's elevator core is the arena: six open glass cabs race up and down a 48 m neon atrium, and the shaft runs over anyone in a car's way. Hop cab to cab, ride up to the two mezzanines that hold the hills, take the roof with its gunship, and hit the machine-room console to drop cab C's floor out from under its riders (hold jump for a parachute: long falls kill).",
  modes: ['core.koth', 'core.tdm'],
  players: [8, 16],
});
await m.save();
