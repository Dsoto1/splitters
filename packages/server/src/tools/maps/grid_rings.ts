/**
 * Grid Rings: the Disc Arena demo map. Dark circuit decks rimmed in light
 * float in a night sky over nothing at all; jump pads are the only way
 * between them. Discs bounce off the glowing walls behind the outer decks,
 * and a disc hit near an edge sends you into the void (a point for the
 * thrower).
 *
 * - The hub (centre, 12 × 12): pads out to all four rings.
 * - Four rings (N, E, S, W, 10 × 10): a bounce wall along the far edge, a
 *   pad home to the hub and one up to the next tower (clockwise).
 * - Four towers (corners, 6 × 6, 4 m up): a power disc on each (fast,
 *   triple, splitting, freeze) and a pad down to the hub.
 *
 * Top-down (x east, z north; metres):
 *
 *   z 16   [tw]          [N]          [tn]
 *   z 0           [W]   [hub]   [E]
 *   z -16  [ts]          [S]          [te]
 */
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('grid_rings', 'Grid Rings');
m.theme('station');
m.backdrop('night', 'none', 'none', 0.15);

const DECK = { material: 'circuit', tint: '#9fb4c8' };
const UNDER = { material: 'pbr_space_metal' };
const CYAN = { material: 'light_strip', tint: '#5ff2ff' };
const ORANGE = { material: 'light_strip', tint: '#ff9a3c' };
const WALL = { material: 'scifi_panel', tint: '#3a4a5c' };

/** A deck: a slab with its top at `top`, an underside, and a strip of light round the rim. */
function deck(x: number, z: number, w: number, d: number, top: number, rim: { material: string; tint: string }): void {
  m.block([x, top - 1.2, z], [w, 1.2, d], 'solid', DECK);
  m.block([x, top - 1.6, z], [w - 1, 0.4, d - 1], 'solid', UNDER);
  for (const s of [-1, 1]) {
    m.block([x + s * (w / 2 - 0.1), top - 0.4, z], [0.2, 0.3, d], 'solid', rim);
    m.block([x, top - 0.4, z + s * (d / 2 - 0.1)], [w, 0.3, 0.2], 'solid', rim);
  }
}

// ---------------------------------------------------------------- decks
deck(0, 0, 12, 12, 0, ORANGE); // the hub
const RING = 22;
const rings: [number, number][] = [[0, RING], [RING, 0], [0, -RING], [-RING, 0]]; // N, E, S, W
for (const [x, z] of rings) deck(x, z, 10, 10, 0, CYAN);
const TOWER = 17;
const towers: [number, number][] = [[TOWER, TOWER], [TOWER, -TOWER], [-TOWER, -TOWER], [-TOWER, TOWER]]; // NE, SE, SW, NW
for (const [x, z] of towers) deck(x, z, 6, 6, 4, ORANGE);

// Bounce walls along each ring's far edge (discs come back off them), lit along the top.
for (const [x, z] of rings) {
  const along = x === 0; // the wall runs east-west on the north and south rings
  const ox = Math.sign(x) * 4.6;
  const oz = Math.sign(z) * 4.6;
  m.block([x + ox, 0, z + oz], along ? [8, 3, 0.4] : [0.4, 3, 8], 'solid', WALL);
  m.block([x + ox, 3, z + oz], along ? [8, 0.15, 0.5] : [0.5, 0.15, 8], 'solid', CYAN);
}
// Two low blocks on the hub to duck behind and bank discs off.
m.block([-2.5, 0, 0], [0.8, 1.1, 3], 'solid', WALL).block([2.5, 0, 0], [0.8, 1.1, 3], 'solid', WALL);

// ---------------------------------------------------------------- pads
for (const [x, z] of rings) {
  const ux = Math.sign(x);
  const uz = Math.sign(z);
  m.padTo([ux * 4.5, 0, uz * 4.5], [x - ux * 1.5, 0, z - uz * 1.5], 11); // hub → ring
  m.padTo([x - ux * 3.6, 0, z - uz * 3.6], [ux * 2, 0, uz * 2], 11); // ring → hub
}
// Each ring has a pad up to the tower clockwise of it (off to that side, clear of the hub pad);
// each tower a pad down to the hub.
const radial = (x: number, z: number): [number, number] => [Math.sign(x), Math.sign(z)];
rings.forEach(([x, z], i) => {
  const [tx, tz] = towers[i]!;
  const [ux, uz] = radial(x, z);
  // Sideways toward the tower, a little in from the middle of the ring.
  const sx = ux === 0 ? Math.sign(tx) : 0;
  const sz = uz === 0 ? Math.sign(tz) : 0;
  m.padTo([x + sx * 3.2 - ux * 1.5, 0, z + sz * 3.2 - uz * 1.5], [tx - Math.sign(tx) * 0.5, 4, tz - Math.sign(tz) * 0.5], 14);
});
for (const [x, z] of towers) m.padTo([x - Math.sign(x) * 1.8, 4, z - Math.sign(z) * 1.8], [Math.sign(x) * 3, 0, Math.sign(z) * 3], 10);

// ---------------------------------------------------------------- spawns and power discs
// Two on each ring, back by the wall facing the hub; one on each tower.
for (const [x, z] of rings) {
  const [ux, uz] = radial(x, z);
  for (const s of [-1, 1]) m.spawn([x + uz * s * 2.5 + ux * 1.5, 0, z - ux * s * 2.5 + uz * 1.5], Math.atan2(-ux, -uz));
}
for (const [x, z] of towers) m.spawn([x + Math.sign(x), 4, z + Math.sign(z)], Math.atan2(-x, -z));
const powers = ['disc_fast', 'disc_triple', 'disc_split', 'disc_freeze'];
towers.forEach(([x, z], i) => m.pickup(powers[i]!, [x, 4, z]));
m.pickup('disc_triple', [0, 0, 0], 40);

m.bounds('invisible');
m.meta({
  description:
    'Dark circuit decks rimmed in light, floating in the night with nothing underneath. Ride the pads between the hub, the four rings and the corner towers, bank discs off the glowing walls, grab a power disc up top, and knock everyone else into the void.',
  modes: ['core.discs'],
  players: [2, 10],
});
await m.save();
