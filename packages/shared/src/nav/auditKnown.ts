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
