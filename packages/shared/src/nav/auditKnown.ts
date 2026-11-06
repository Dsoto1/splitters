import { hypot, type Vec3 } from '../math.ts';

/**
 * What the navigation audit finds on official maps that is left as it is, each with why (docs/BOTS.md, "Navigation
 * audit"; HANDOFF lists them for the owner). The audit reports these as warnings with the reason instead of errors.
 * `near`: a trap's middle (within 6 m); `id`: the spawn point, objective or pickup.
 */
interface KnownNavIssue {
  map: string;
  code: string;
  near?: [number, number, number];
  id?: string;
  why: string;
}

const KNOWN: readonly KnownNavIssue[] = [
  // Places a map means to be one-way (its own description says so): a pad up, no way back.
  { map: 'skyward', code: 'nav.trap', near: [0, 8.1, -32], why: 'the heavy-armour perch: a pad up, no way back, as the map says' },
  { map: 'skyward', code: 'nav.trap', near: [0, 8.1, 32], why: 'the railgun perch: a pad up, no way back, as the map says' },
  { map: 'skyward', code: 'nav.trap', near: [-40, 4.1, 0], why: 'the plasma gun tower (x -40): a pad up, no way back, as the map says' },
  { map: 'skyward', code: 'nav.trap', near: [40, 4.1, 0], why: 'the disc launcher tower (x 40): a pad up, no way back, as the map says' },
  { map: 'skyward', code: 'nav.disconnected', id: 'spawn_035', why: 'a spawn point on the plasma gun tower, which nothing leaves but a fall: for the owner (a pad back down, or the point on the central deck)' },
  { map: 'skyward', code: 'nav.disconnected', id: 'spawn_036', why: 'a spawn point on the disc launcher tower, which nothing leaves but a fall: for the owner (a pad back down, or the point on the central deck)' },
  { map: 'sky_islands', code: 'nav.trap', near: [0, 12.6, 0], why: 'the sky platform (double damage): the pad up, no way back but a fall into the void, as the map says' },
  // For the owner: places players are stuck in too.
  { map: 'grand_marquee', code: 'nav.trap', near: [0, 5.1, -7], why: "the marquee's top: the street's jump pad throws you onto it and nothing gets you down (1.6 m sign panels on three sides, the terrace 2.9 m up behind): for the owner (a gap in a side panel, or a ladder)" },
  { map: 'obsidian_orb', code: 'nav.trap', near: [0, -3.8, 0], why: "the top of the reactor core (prop_087, scaled 4x: its box rises to 3.8 m under the bridges): a fall off a bridge lands on it, not to death down the bottomless shaft the map describes: for the owner (the core not solid, or lower)" },
  { map: 'reactor', code: 'nav.trap', near: [41, -0.8, 25], why: "the yard outside the plant's walls, inside the map's bounds: off the roof's south-west corner at (37, 4, 50) you drop 4.3 m into it, and no route, step or hop leads back in: for the owner (a railing on that corner)" },
  { map: 'serpent_gorge', code: 'nav.trap', near: [28, -7.7, 64], why: "the gorge floor's dry strips along the river, 8 m down: a fall through the openings in the gallery above lands there and the banks are steeper than anyone walks up: for the owner (steps or a ladder out)" },
  { map: 'serpent_gorge', code: 'nav.trap', near: [38, -3.8, 87], why: "slivers along the crypt's walls under the temple, 0.4 m below its floor with a ledge between: a 0.9 m step down at (50, -0.3, 103) gets you in, and no route, step or hop leads out: for the owner" },
  { map: 'erosion', code: 'nav.trap', near: [0, 2.1, 1], why: "the lower deck: the corner pads that throw you back up stand on 3 m pillars that meet the deck only at a corner, which players step across and the navmesh doesn't; the decks crumble away in play anyway: for the owner (corner pillars that share an edge with the deck)" },
  // The navmesh keeps 0.8 m from walls (docs/BOTS.md, "Navmesh clearance"): gaps under 1.6 m are shut to it.
  { map: 'm4_outpost', code: 'nav.pickup_unreachable', id: 'pk_armor_uplink', why: "the uplink room's dais leaves gaps of 1.5-2 m round it, too narrow for the navmesh: bots hop onto the dais from the gate but not round it" },
  { map: 'm4_outpost', code: 'nav.pickup_unreachable', id: 'g_pickup_017', why: "the corridor north of the uplink room, through a 2 m doorway beside the dais: too narrow for the navmesh" },
];

/** Why a finding on an official map is left as it is, or null when it isn't known (an error). */
export function knownNavIssue(map: string, code: string, near: Vec3 | null, id?: string): string | null {
  for (const k of KNOWN) {
    if (k.map !== map || k.code !== code) continue;
    if (k.id !== undefined && k.id !== id) continue;
    if (k.near && (!near || hypot(near.x - k.near[0], near.z - k.near[2]) > 6 || Math.abs(near.y - k.near[1]) > 4)) continue;
    return k.why;
  }
  return null;
}
