import { createRng, horizontalDistance, type Vec3, hypot } from '../math.ts';
import type { Match } from './match.ts';

/**
 * Load-test helper (bench and the clumped-match test): a patch of walkable
 * ground about `radius` m across from the middle of the map, split in two
 * halves facing each other, where every bot of a two-team match is put so
 * that each one can see (and shoot at) many enemies at once. The worst case
 * for bot thinking, sight lines and hit tests.
 */
export interface ClumpArea {
  center: Vec3;
  radius: number;
  /** Walkable spots for each team (by faction), on its own half of the patch. */
  sides: Map<string, Vec3[]>;
}

/** Find a patch of open walkable ground near the middle of the teams' spawns. */
export function clumpArea(match: Match, radius = 20): ClumpArea {
  const teams = [...new Set(match.combatants().map((c) => c.faction ?? ''))];
  const centroid = (pts: readonly Vec3[]): Vec3 => ({ x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length, z: pts.reduce((s, p) => s + p.z, 0) / pts.length });
  // The map's own spawn points (not ones a big match made up), so the clump is in the same place whatever the match size.
  const own = match.spawnPoints.filter((s) => !s.generated);
  const all = own.map((s) => s.pos);
  const mid = centroid(all);
  const a = centroid(own.filter((s) => s.team === teams[0]).map((s) => s.pos).concat(all.length ? [] : [mid]));
  const b = centroid(own.filter((s) => s.team === teams[1]).map((s) => s.pos).concat(all.length ? [] : [mid]));
  let ax = b.x - a.x;
  let az = b.z - a.z;
  const al = hypot(ax, az);
  if (!Number.isFinite(al) || al < 1) {
    ax = 1;
    az = 0;
  } else {
    ax /= al;
    az /= al;
  }
  const spotsAround = (c: Vec3): Vec3[] => {
    const out: Vec3[] = [];
    for (let dx = -radius; dx <= radius; dx += 2) {
      for (let dz = -radius; dz <= radius; dz += 2) {
        if (dx * dx + dz * dz > radius * radius) continue;
        const p = match.nav.closestPoint({ x: c.x + dx, y: c.y + 1, z: c.z + dz }, { x: 0.8, y: 4, z: 0.8 });
        if (p && Math.abs(p.y - c.y) < 3 && horizontalDistance(p, c) <= radius) out.push(p);
      }
    }
    return out;
  };
  // The open place near the middle with the most walkable ground around it (same level).
  const places = [...match.nav.places()].sort((p, q) => horizontalDistance(p, mid) - horizontalDistance(q, mid)).slice(0, 24);
  let best: { center: Vec3; spots: Vec3[] } | null = null;
  for (const p of places) {
    const spots = spotsAround(p);
    if (!best || spots.length > best.spots.length) best = { center: p, spots };
  }
  const center = best?.center ?? mid;
  const spots = best?.spots ?? [mid];
  const sides = new Map<string, Vec3[]>();
  for (const t of teams) sides.set(t, []);
  for (const p of spots) {
    const side = (p.x - center.x) * ax + (p.z - center.z) * az < 0 ? 0 : 1;
    sides.get(teams[Math.min(side, teams.length - 1)] ?? '')?.push(p);
  }
  for (const [t, list] of sides) if (!list.length) sides.set(t, spots);
  return { center, radius, sides };
}

/**
 * Put these actors (all living ones when omitted) on random spots on their
 * team's half of the patch, facing its middle, with their bots' plans reset.
 */
export function clumpInto(match: Match, area: ClumpArea, slots?: Iterable<number>, seed = 1): void {
  const rng = createRng(seed);
  const list = slots ? [...slots].map((s) => match.actor(s)).filter((c) => !!c) : match.combatants();
  for (const c of list) {
    if (!c.alive || c.mount) continue;
    const spots = area.sides.get(c.faction ?? '') ?? [area.center];
    const p = spots[Math.floor(rng() * spots.length)]!;
    const pos = { x: p.x + (rng() - 0.5) * 0.6, y: p.y + 0.05, z: p.z + (rng() - 0.5) * 0.6 };
    c.move = { pos, velY: 0, grounded: false };
    c.yaw = Math.atan2(area.center.x - pos.x, area.center.z - pos.z);
    c.bot?.onSpawn(c.yaw);
  }
}
