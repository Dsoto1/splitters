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
  // For the owner: places players are stuck in too.
  // The reactor core (prop_087, scaled 4x) collides as its shape since the slack pass (2026-11-06), no longer its box:
  // a fall off a bridge goes past it down the shaft the map calls bottomless, onto the shaft's floor 32 m down (above
  // the kill height: fatal with fall damage on, a pit without). One finding each side of the core's foot.
  ...[[7, 0], [-7, 0], [0, 7], [0, -7]].map(([x, z]): KnownNavIssue => ({ map: 'obsidian_orb', code: 'nav.trap', near: [x!, -31.9, z!], why: "the reactor shaft's floor beside the core's foot, 32 m below the bridges: a fall off a bridge lands there, above the kill height, not to death down the bottomless shaft the map describes: for the owner (the shaft's floor under the kill height)" })),
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
