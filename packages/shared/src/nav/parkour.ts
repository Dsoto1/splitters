import { boxesRay } from '../map/geometry.ts';
import { hypot, type Vec3 } from '../math.ts';
import { BUTTON_CROUCH, BUTTON_JUMP, BUTTON_SPRINT, stepMovement, type MoveEnv, type MoveState } from '../sim/movement.ts';
import { PLAYER, TICK_DT } from '../sim/constants.ts';
import type { PhysicsWorld } from '../sim/physics.ts';
import { components, disabled, edgesOf, fallsFrom, mainOf, polyShapes, reachSet, reverseOf, type FallOptions } from './audit.ts';
import type { NavGraph, NavWorld } from './index.ts';

/**
 * Parkour links (BOT_AI_PLAN.md Phase C item 1; docs/BOTS.md, "Parkour"): the moves a player makes off the walkable
 * ground, as one-way navmesh links bots route over, generated at load from the level's geometry and each one checked
 * by playing it through the real movement code (sim/movement.ts stepMovement) with the inputs a bot gives (`parkourInput`):
 * - **drop**: walking off a ledge onto ground below (no more than a fall that doesn't hurt);
 * - **gap**: a running jump across a gap onto ground about as high or lower;
 * - **up**: a jump up onto a ledge within reach (legs tucked up in the air, as players do, for the higher ones).
 * Only where the move saves a real walk (the walk round is PARKOUR_SAVING times as long and more, or there is none
 * within PARKOUR_WALK m), so a bot doesn't hop down every kerb. Lifts and rope lifts are the movers' own links
 * (sim/movers.ts liftLinks); moves players don't have (vaults, mantles) are out.
 *
 * The cost: at load only (a few hundred candidates checked, each a second or so of one body's movement, a capped
 * number of them); nothing per tick but a bot on a link thinking every tick until it lands.
 */
export type ParkourKind = 'drop' | 'gap' | 'up';

/** The navmesh area of parkour links: routes cost them more than walking (NavWorld's PARKOUR_COST), except agile bots'. */
export const PARKOUR_AREA = 2;

export interface ParkourLink {
  kind: ParkourKind;
  /** On the navmesh: where the move starts, and where it ends. */
  start: Vec3;
  end: Vec3;
  /** The way it faces and runs (yaw, as stepMovement reads it). */
  yaw: number;
  /** How far past the start (m, along the way it runs) it jumps; -1: no jump (a drop). */
  takeoff: number;
  sprint: boolean;
  /** Crouch in the air after the jump (the legs tuck up: a higher ledge). */
  tuck: boolean;
}

/** Where along each open edge candidates are looked for (m apart), and how far out a gap or a ledge may be (m). */
const SAMPLE_SPACING = 1.5;
const PROBE_STEP = 0.3;
const GAP_MAX = 5.5;
const UP_MAX = 1.8;
/** A ledge at least this much higher than where it starts is a jump up, not a step (m). */
const UP_MIN = PLAYER.maxStepHeight + 0.15;
/** The walk this move replaces must be this many times as long as the move, and at least PARKOUR_MIN_WALK m. */
export const PARKOUR_SAVING = 2.5;
const PARKOUR_MIN_WALK = 9;
/** How far (m, polygon centre to centre) the walk round is looked for. */
const PARKOUR_WALK = 60;
/** At most this many links a map, this many of each kind, and this many candidates played through. */
const MAX_LINKS = 180;
const MAX_KIND = 90;
const MAX_TRIALS = 320;
/** Links of a kind closer together than this (m, start to start and end to end) are one link. */
const LINK_SPACING = 4;
/** Candidates this close to one that didn't play through (start to start, end to end) aren't tried. */
const FAILED_SPACING = 1.6;
/** The bodies a link is played through with (BODY_SIZES, its speed): standard, small and large. */
const BODIES = [
  { scale: 1, speed: 1 },
  { scale: 0.78, speed: 1.06 },
  { scale: 1.18, speed: 0.94 },
] as const;
/** How near its end (m) a body must come down (a body off a ledge at a run lands a few metres on: the bot walks back, or on). */
const LAND_REACH = 4;
/** Ticks a move may take, from the start to standing at the end. */
const MAX_TICKS = 100;

/** What a bot presses on a parkour link (and what the build plays each one through with): run its way, jump at the takeoff, tuck in the air. */
export function parkourInput(link: ParkourLink, pos: Vec3, grounded: boolean, jumped: boolean): { yaw: number; buttons: number; jump: boolean } {
  const dx = Math.sin(link.yaw);
  const dz = Math.cos(link.yaw);
  const along = (pos.x - link.start.x) * dx + (pos.z - link.start.z) * dz;
  const jump = link.takeoff >= 0 && !jumped && grounded && along >= link.takeoff;
  let buttons = link.sprint ? BUTTON_SPRINT : 0;
  if (jump) buttons |= BUTTON_JUMP;
  else if (jumped && !grounded && link.tuck) buttons = BUTTON_CROUCH;
  return { yaw: link.yaw, buttons, jump };
}

/** How far along the link's way (m) `pos` is past its start. */
export function parkourAlong(link: ParkourLink, pos: Vec3): number {
  return (pos.x - link.start.x) * Math.sin(link.yaw) + (pos.z - link.start.z) * Math.cos(link.yaw);
}

/** Where a candidate move goes and what it takes, before it is played through. */
interface Candidate {
  kind: ParkourKind;
  from: number;
  to: number;
  start: Vec3;
  end: Vec3;
  /** The edge sample it was found from (on the navmesh's open edge). */
  at: Vec3;
  /** What it saves: the walk round (m) over the move's length (Infinity: no walk round). */
  saving: number;
}

/**
 * Walking distances (polygon centre to centre, along the navmesh's own links) from polygon `from`, out to `limit` m:
 * Dijkstra over the graph, stopping at the limit. Into `dist` (Infinity where not reached); the polygons it reached are
 * returned so the caller can reset them.
 */
function walkFrom(g: NavGraph, centre: Float32Array, from: number, limit: number, dist: Float64Array): number[] {
  const touched: number[] = [from];
  dist[from] = 0;
  // A binary heap of polygons by cost.
  const hc: number[] = [];
  const hp: number[] = [];
  const swap = (i: number, j: number) => {
    const c = hc[i]!;
    hc[i] = hc[j]!;
    hc[j] = c;
    const p = hp[i]!;
    hp[i] = hp[j]!;
    hp[j] = p;
  };
  const push = (c: number, p: number) => {
    hc.push(c);
    hp.push(p);
    for (let i = hc.length - 1; i > 0; ) {
      const up = (i - 1) >> 1;
      if (hc[up]! <= hc[i]!) break;
      swap(up, i);
      i = up;
    }
  };
  push(0, from);
  while (hc.length) {
    const c = hc[0]!;
    const a = hp[0]!;
    const lc = hc.pop()!;
    const lp = hp.pop()!;
    if (hc.length) {
      hc[0] = lc;
      hp[0] = lp;
      for (let i = 0; ; ) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < hc.length && hc[l]! < hc[m]!) m = l;
        if (r < hc.length && hc[r]! < hc[m]!) m = r;
        if (m === i) break;
        swap(m, i);
        i = m;
      }
    }
    if (c > dist[a]!) continue;
    for (let l = g.linkStart[a]!; l < g.linkStart[a + 1]!; l++) {
      const b = g.links[l]!;
      if (disabled(g, b)) continue;
      const d = c + hypot(centre[a * 3]! - centre[b * 3]!, centre[a * 3 + 2]! - centre[b * 3 + 2]!) + Math.abs(centre[a * 3 + 1]! - centre[b * 3 + 1]!);
      if (d > limit || d >= dist[b]!) continue;
      if (dist[b] === Infinity) touched.push(b);
      dist[b] = d;
      push(d, b);
    }
  }
  return touched;
}

/** The ground's height (m) under (x, z) from `top` down, within `depth` m (the level and the extra solids), or null. */
function groundAt(physics: PhysicsWorld, solids: FallOptions['solids'], x: number, z: number, top: number, depth: number): number | null {
  const o = { x, y: top, z };
  const d = physics.moveRay(o, DOWN, depth);
  const b = solids?.length ? boxesRay(solids, o, DOWN, d ?? depth) : null;
  const hit = d === null ? b : b === null ? d : Math.min(d, b);
  return hit === null ? null : top - hit;
}
const DOWN = { x: 0, y: -1, z: 0 };

/**
 * Gap jumps and jumps up from one edge sample: looking out along the edge's outward normal, a ledge within UP_MAX up
 * and a body's reach (up), or ground about as high (0.5 m up to 3 m down) across a gap of GAP_MAX m at most (gap).
 * Each is the point on top to land (not yet on the navmesh).
 */
function probeOut(physics: PhysicsWorld, opts: FallOptions, at: Vec3, nx: number, nz: number): { kind: 'gap' | 'up'; land: Vec3 }[] {
  const out: { kind: 'gap' | 'up'; land: Vec3 }[] = [];
  const top = at.y + UP_MAX + PLAYER.height * 1.2;
  const depth = top - (at.y - Math.max(4, opts.maxDrop + 1));
  let gapFrom = -1;
  let level = true;
  for (let d = PROBE_STEP; d <= GAP_MAX + 1e-6; d += PROBE_STEP) {
    const x = at.x + nx * d;
    const z = at.z + nz * d;
    const y = groundAt(physics, opts.solids, x, z, top, depth);
    // A ceiling or overhang over the start's height: nothing to jump onto under it from here.
    if (y !== null && y > at.y + UP_MAX) return out;
    if (level) {
      if (y !== null && y > at.y + UP_MIN && d < 2.6) {
        // A ledge's face, within a body's reach of the edge: the top, a little way in.
        const inY = groundAt(physics, opts.solids, at.x + nx * (d + 0.5), at.z + nz * (d + 0.5), top, depth);
        if (inY !== null && Math.abs(inY - y) < 0.2) out.push({ kind: 'up', land: { x: at.x + nx * (d + 0.5), y: inY, z: at.z + nz * (d + 0.5) } });
        return out;
      }
      if (y === null || y < at.y - 1) {
        level = false;
        gapFrom = d;
      } else if (Math.abs(y - at.y) > UP_MIN) return out;
      continue;
    }
    // Over the gap: ground about as high again, past a real gap (a metre of it at least).
    if (y !== null && y > at.y - 3 && y < at.y + 0.5 && d - gapFrom >= 1) {
      const inY = groundAt(physics, opts.solids, at.x + nx * (d + 0.5), at.z + nz * (d + 0.5), top, depth);
      if (inY !== null && Math.abs(inY - y) < 0.25) out.push({ kind: 'gap', land: { x: at.x + nx * (d + 0.5), y: inY, z: at.z + nz * (d + 0.5) } });
      return out;
    }
    if (y !== null && y >= at.y + 0.5) return out;
  }
  return out;
}

/**
 * Plays a candidate through stepMovement with a bot's inputs (parkourInput) from its start, set off to one side by
 * `side` m: whether the body stands at its end within MAX_TICKS (and never lower than the end's ground, less a
 * metre, after the jump: it didn't fall short and walk round).
 */
function playThrough(physics: PhysicsWorld, collider: Parameters<typeof stepMovement>[1], link: ParkourLink, body: { scale: number; speed: number }, gravity: number, side: number): boolean {
  const px = Math.cos(link.yaw);
  const pz = -Math.sin(link.yaw);
  parkourStats.sims++;
  let s: MoveState = { pos: { x: link.start.x + px * side, y: link.start.y + 0.12, z: link.start.z + pz * side }, velY: 0, grounded: false };
  const env: MoveEnv = { scale: body.scale, gravity, jump: 1, stamina: 1, autoChute: true };
  const still = { seq: 0, forward: 0, right: 0, yaw: link.yaw, pitch: 0, buttons: 0 };
  // Settle onto the ground at the start.
  for (let i = 0; i < 12 && !s.grounded; i++) s = stepMovement(physics, collider, s, still, body.speed, TICK_DT, 1, env);
  if (!s.grounded) return false;
  const from = s.pos.y;
  let jumped = false;
  let left = false;
  const lowest = link.end.y - 1;
  for (let t = 0; t < MAX_TICKS; t++) {
    const c = parkourInput(link, s.pos, s.grounded, jumped);
    if (c.jump) jumped = true;
    parkourStats.ticks++;
    s = stepMovement(physics, collider, s, { seq: t, forward: 1, right: 0, yaw: c.yaw, pitch: 0, buttons: c.buttons }, body.speed, TICK_DT, 1, env);
    // (Off the edge: well below where it set off from, not a grounded flag flickering over a seam.)
    if (!s.grounded && s.pos.y < from - 0.4) left = true;
    if ((jumped || left) && s.pos.y < lowest) return false;
    // Down at the end's height, by it (a body landing at a run goes a little past it: the bot walks back, or on).
    if (s.grounded && (jumped || left) && Math.abs(s.pos.y - link.end.y) < 0.6) {
      const d = hypot(s.pos.x - link.end.x, s.pos.z - link.end.z);
      return d < 0.9 || (d < LAND_REACH && physics.lineOfSight({ x: s.pos.x, y: s.pos.y + 0.5, z: s.pos.z }, { x: link.end.x, y: link.end.y + 0.5, z: link.end.z }));
    }
    // Still on the ground long after it should have gone (up against a wall): no good.
    if (!jumped && !left && t > 60) return false;
    // Landed somewhere else after the jump or the fall (short, or on something on the way): no good.
    if (s.grounded && (jumped || left) && t > 4) return false;
  }
  return false;
}

/**
 * The parkour links of a navmesh (NavWorld.build, before its other links go in): candidates from every open edge,
 * kept where they save a walk, then played through for every body size from a few takeoffs and either side; each
 * that works for all with room to spare becomes a link. `others`: the build's other links' polygons (they count as ways
 * round).
 */
/** Counts from the last parkourLinks call (debug: candidates, trials and links by kind, ms). */
export const parkourStats = { cands: {} as Record<string, number>, trials: {} as Record<string, number>, links: {} as Record<string, number>, sims: 0, ticks: 0, findMs: 0, verifyMs: 0 };

export function parkourLinks(nav: NavWorld, physics: PhysicsWorld, opts: FallOptions, gravity = 1, others: readonly (readonly [number, number])[] = [], spawns: readonly Vec3[] = []): ParkourLink[] {
  const g = nav.graph();
  const n = g.count;
  if (!n) return [];
  const { centre } = polyShapes(g);
  // The build's other links (pads, ladders) as walks of their own length: a move one of them already makes isn't new.
  const extraFrom = new Map<number, number[]>();
  for (const [a, b] of others) (extraFrom.get(a) ?? extraFrom.set(a, []).get(a)!).push(b);
  const dist = new Float64Array(n).fill(Infinity);
  const cands: Candidate[] = [];
  const t0 = performance.now();
  parkourStats.cands = {};
  parkourStats.trials = {};
  parkourStats.links = {};
  parkourStats.sims = 0;
  // Drops are only those that don't hurt (fall damage starts past 5 m at normal gravity).
  const dropOpts: FallOptions = { ...opts, maxDrop: Math.min(opts.maxDrop, 5 / Math.max(0.05, gravity)) };
  for (let i = 0; i < n; i++) {
    if (g.type[i] !== 0 || !g.open[i] || disabled(g, i)) continue;
    // Edge samples and their outward normals (as fallsFrom walks them).
    const found: { kind: ParkourKind; at: Vec3; land: Vec3; to: number }[] = [];
    for (const f of fallsFrom(nav, physics, i, dropOpts)) if (f.to >= 0 && f.to !== i && f.drop > 0.6) found.push({ kind: 'drop', at: f.at, land: f.land, to: f.to });
    const a0 = g.vstart[i]!;
    const vc = g.vstart[i + 1]! - a0;
    const cx = centre[i * 3]!;
    const cz = centre[i * 3 + 2]!;
    for (let j = 0; j < vc; j++) {
      if (!(g.open[i]! & (1 << j))) continue;
      const ia = (a0 + j) * 3;
      const ib = (a0 + ((j + 1) % vc)) * 3;
      const ax = g.vxyz[ia]!;
      const ay = g.vxyz[ia + 1]!;
      const az = g.vxyz[ia + 2]!;
      const dx = g.vxyz[ib]! - ax;
      const dy = g.vxyz[ib + 1]! - ay;
      const dz = g.vxyz[ib + 2]! - az;
      const len = hypot(dx, dz);
      if (len < 0.4) continue;
      let nx = dz / len;
      let nz = -dx / len;
      if (nx * (ax + dx / 2 - cx) + nz * (az + dz / 2 - cz) < 0) {
        nx = -nx;
        nz = -nz;
      }
      const m = Math.max(1, Math.round(len / SAMPLE_SPACING));
      for (let k = 0; k < m; k++) {
        const t = (k + 0.5) / m;
        const at = { x: ax + dx * t, y: ay + dy * t, z: az + dz * t };
        for (const p of probeOut(physics, opts, at, nx, nz)) {
          const hit = nav.nearestPoly({ x: p.land.x + nx * 0.6, y: p.land.y + 0.2, z: p.land.z + nz * 0.6 }, { x: 1, y: 0.4, z: 1 });
          if (!hit || hit.index === i || disabled(g, hit.index) || Math.abs(hit.point.y - p.land.y) > 0.5) continue;
          found.push({ kind: p.kind, at, land: hit.point, to: hit.index });
        }
      }
    }
    if (!found.length) continue;
    // The walk round from here, once for the polygon.
    const touched = walkFrom(g, centre, i, PARKOUR_WALK, dist);
    for (const f of found) {
      const start = nav.nearestPoly(f.at, { x: 0.3, y: 0.5, z: 0.3 })?.point ?? f.at;
      const move = hypot(f.land.x - start.x, f.land.z - start.z) + Math.abs(f.land.y - start.y);
      const walk = dist[f.to]!;
      const also = extraFrom.get(i)?.includes(f.to) ?? false;
      if (also || walk < Math.max(PARKOUR_MIN_WALK, move * PARKOUR_SAVING)) continue;
      cands.push({ kind: f.kind, from: i, to: f.to, start, end: f.land, at: f.at, saving: walk / Math.max(0.5, move) });
    }
    for (const p of touched) dist[p] = Infinity;
  }
  for (const c of cands) parkourStats.cands[c.kind] = (parkourStats.cands[c.kind] ?? 0) + 1;
  const t1 = performance.now();
  parkourStats.findMs = t1 - t0;
  // Best savings first (no walk round at all first), then by place: deterministic.
  cands.sort((a, b) => b.saving - a.saving || a.start.x - b.start.x || a.start.z - b.start.z || a.start.y - b.start.y);
  const out: ParkourLink[] = [];
  const ends: [number, number][] = [];
  const kinds: Record<ParkourKind, number> = { drop: 0, gap: 0, up: 0 };
  const collider = physics.createPlayerCollider();
  let trials = 0;
  const failed: Candidate[] = [];
  try {
    for (const c of cands) {
      if (out.length >= MAX_LINKS || trials >= MAX_TRIALS) break;
      if (kinds[c.kind] >= MAX_KIND) continue;
      const near = (l: { kind: ParkourKind; start: Vec3; end: Vec3 }, r: number) => l.kind === c.kind && hypot(l.start.x - c.start.x, l.start.z - c.start.z) < r && Math.abs(l.start.y - c.start.y) < 1 && hypot(l.end.x - c.end.x, l.end.z - c.end.z) < r && Math.abs(l.end.y - c.end.y) < 1;
      // (One link for a stretch of ledge; and not again beside one that didn't play through.)
      if (out.some((l) => near(l, LINK_SPACING)) || failed.some((l) => near(l, FAILED_SPACING))) continue;
      // (Not through one of the scenario's solids: a breakable prop or a moving block, not in the physics yet.)
      const yaw = Math.atan2(c.end.x - c.start.x, c.end.z - c.start.z);
      const len = hypot(c.end.x - c.start.x, c.end.z - c.start.z);
      if (opts.solids?.length && [0.5, 1.2].some((h) => boxesRay(opts.solids!, { x: c.start.x, y: Math.max(c.start.y, c.end.y) + h, z: c.start.z }, { x: Math.sin(yaw), y: 0, z: Math.cos(yaw) }, len) !== null)) continue;
      // (A gap wider than a sprinting jump carries the slowest body, landing as low as it does: not worth playing.)
      if (c.kind === 'gap') {
        const h = Math.max(0, c.start.y - c.end.y);
        const g = PLAYER.gravity * gravity;
        const air = (PLAYER.jumpSpeed + Math.sqrt(PLAYER.jumpSpeed ** 2 + 2 * g * h)) / g;
        if (len - 1.4 > air * PLAYER.runSpeed * 1.5 * BODIES[2].speed) continue;
      }
      trials++;
      parkourStats.trials[c.kind] = (parkourStats.trials[c.kind] ?? 0) + 1;
      const link = verify(physics, collider, c, yaw, gravity);
      if (!link) {
        failed.push(c);
        continue;
      }
      out.push(link);
      ends.push([c.from, c.to]);
      kinds[c.kind]++;
    }
  } finally {
    physics.removeCollider(collider);
  }
  const kept = safeLinks(g, out, ends, others, spawns.flatMap((p) => {
    const hit = nav.nearestPoly(p, { x: 1, y: 1, z: 1 });
    return hit ? [hit.index] : [];
  }));
  for (const l of kept) parkourStats.links[l.kind] = (parkourStats.links[l.kind] ?? 0) + 1;
  parkourStats.verifyMs = performance.now() - t1;
  return kept;
}

/**
 * The links that don't lead a bot from ground that routes back to the main area onto ground that doesn't (a pillar a
 * gap jump reaches with no way off: a trap of the links' own making), the rest considered with them, until none is
 * left out.
 */
function safeLinks(g: NavGraph, links: ParkourLink[], ends: [number, number][], others: readonly (readonly [number, number])[], seeds: readonly number[]): ParkourLink[] {
  const n = g.count;
  let keep = links.map(() => true);
  for (let round = 0; round < 8; round++) {
    const pairs = [...others, ...ends.filter((_, i) => keep[i])];
    const e = edgesOf(g, pairs);
    const comps = components(e, n);
    const main = mainOf(g, comps, seeds, e);
    const mainPolys: number[] = [];
    for (let i = 0; i < n; i++) if (comps.of[i] === main) mainPolys.push(i);
    const back = reverseOf(e, n);
    const toMain = reachSet(back.start, back.to, n, mainPolys);
    let dropped = false;
    keep = keep.map((k, i) => {
      if (!k) return false;
      const [a, b] = ends[i]!;
      if (toMain[a] && !toMain[b]) {
        dropped = true;
        return false;
      }
      return true;
    });
    if (!dropped) break;
  }
  return links.filter((_, i) => keep[i]);
}

/**
 * The takeoff (and sprint, tuck) that plays a candidate through for every body from either side of its start, with
 * the takeoff a little early and late working too (a bot isn't exact); null when none does.
 */
function verify(physics: PhysicsWorld, collider: Parameters<typeof stepMovement>[1], c: Candidate, yaw: number, gravity: number): ParkourLink | null {
  const base: ParkourLink = { kind: c.kind, start: c.start, end: c.end, yaw, takeoff: -1, sprint: false, tuck: false };
  // (The standard body from the middle is played first, by the caller, a takeoff a little early and late too.)
  const works = (l: ParkourLink): boolean => {
    // (Small from one side, large from the other: a bot comes onto a link a little off its middle.)
    if (!playThrough(physics, collider, l, BODIES[1], gravity, -0.2)) return false;
    if (!playThrough(physics, collider, l, BODIES[2], gravity, 0.2)) return false;
    return true;
  };
  // (A drop is walking off: the fall's own checks, audit.ts traceFall, saw room for any body; one play through.)
  if (c.kind === 'drop') return playThrough(physics, collider, base, BODIES[0], gravity, 0) ? base : null;
  // Where the edge is along the way (the sample's distance past the start), and the takeoffs to try, latest first.
  const edge = parkourAlong(base, c.at);
  const rise = c.end.y - c.start.y;
  const variants: { sprint: boolean; tuck: boolean }[] = c.kind === 'gap' ? [{ sprint: false, tuck: false }, { sprint: true, tuck: false }] : rise > 0.9 ? [{ sprint: false, tuck: true }] : [{ sprint: false, tuck: false }, { sprint: false, tuck: true }];
  const offsets = c.kind === 'gap' ? [0.6, 0.4, 0.2, 0] : [0.2, 0, -0.2, -0.4];
  for (const v of variants) {
    for (const o of offsets) {
      const l = { ...base, ...v, takeoff: Math.max(0, edge + o) };
      // Room to spare: a takeoff 0.15 m either side works too (the middle one for every body and side).
      if (!playThrough(physics, collider, l, BODIES[0], gravity, 0)) continue;
      if (!playThrough(physics, collider, { ...l, takeoff: l.takeoff + 0.15 }, BODIES[0], gravity, 0)) continue;
      if (!playThrough(physics, collider, { ...l, takeoff: Math.max(0, l.takeoff - 0.15) }, BODIES[0], gravity, 0)) continue;
      if (works(l)) return l;
    }
  }
  return null;
}
