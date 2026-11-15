import { aF as lookAngles, aG as viewDirection, g as getLook, aH as MATCH_PLAY, aI as hypot, a4 as TICK_RATE, P as PLAYER } from "./index-BAsW2uYW.js";
const TP_BACK = 3;
const TP_SIDE = 0.6;
const TP_UP = 0.35;
const TP_WALL_GAP = 0.25;
const TP_MIN = 0.3;
const TP_AIM_REACH = 400;
const TP_AIM_MIN_AHEAD = 0.5;
function thirdPersonCamera(world, eye, yaw, pitch) {
  const fwd = viewDirection(yaw, pitch);
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  const ox = -fwd.x * TP_BACK + rx * TP_SIDE;
  const oy = -fwd.y * TP_BACK + TP_UP;
  const oz = -fwd.z * TP_BACK + rz * TP_SIDE;
  const len = Math.hypot(ox, oy, oz);
  const dir = { x: ox / len, y: oy / len, z: oz / len };
  const hit = world(eye, dir, len);
  const d = hit === null ? len : Math.max(TP_MIN, hit - TP_WALL_GAP);
  return { pos: { x: eye.x + dir.x * d, y: eye.y + dir.y * d, z: eye.z + dir.z * d }, dist: d };
}
function thirdPersonAim(world, eye, yaw, pitch, bodies) {
  const cam = thirdPersonCamera(world, eye, yaw, pitch).pos;
  const fwd = viewDirection(yaw, pitch);
  let t = world(cam, fwd, TP_AIM_REACH) ?? TP_AIM_REACH;
  const b = bodies?.(cam, fwd, t);
  if (b !== null && b !== void 0 && b < t) t = b;
  const p = { x: cam.x + fwd.x * t, y: cam.y + fwd.y * t, z: cam.z + fwd.z * t };
  const ahead = (p.x - eye.x) * fwd.x + (p.y - eye.y) * fwd.y + (p.z - eye.z) * fwd.z;
  if (ahead < TP_AIM_MIN_AHEAD) return { yaw, pitch };
  return lookAngles(eye, p);
}
const A = MATCH_PLAY.awards;
const NEMESIS_RUN = MATCH_PLAY.callouts.nemesis;
class MatchAwards {
  tally = /* @__PURE__ */ new Map();
  /** Kills of `victim` by `killer` this match: `killer * 4096 + victim` -> kills. */
  pair = /* @__PURE__ */ new Map();
  /** Kills in a row of `victim` by `killer` with none back (the nemesis callout). */
  run = /* @__PURE__ */ new Map();
  of(slot) {
    let t = this.tally.get(slot);
    if (!t) this.tally.set(slot, t = { shots: 0, hits: 0, streak: 0, best: 0, revenge: 0, lastKiller: -1 });
    return t;
  }
  reset() {
    this.tally.clear();
    this.pair.clear();
    this.run.clear();
  }
  /**
   * Rounds fired and hits on enemies from a tick's events: a shot's rounds (each pellet; one still in flight hits or
   * misses with its impact), and the impacts of rounds that were. `counts(slot)`: a player or bot (not an NPC);
   * `enemies(a, b)`: whether a hit of b by a counts (not a teammate, a vehicle or a prop).
   */
  events(events, counts, enemies, rounds) {
    for (const e of events) {
      if (e.e === "shot") {
        if (!counts(e.s) || !rounds(e.w)) continue;
        const t = this.of(e.s);
        const flying = e.fl?.length ? new Set(e.fl) : null;
        for (let i = 0; i < e.to.length; i++) {
          t.shots++;
          const h = e.hit[i];
          if (!flying?.has(i) && h !== null && h !== void 0 && enemies(e.s, h)) t.hits++;
        }
      } else if (e.e === "impact") {
        if (!counts(e.s) || !rounds(e.w)) continue;
        if (e.hit !== null && enemies(e.s, e.hit)) this.of(e.s).hits++;
      }
    }
  }
  /**
   * A kill that scores (`killer` a player or bot downing an enemy, not a team kill or their own fall), or a death
   * that doesn't (`killer` null: a fall, their own grenade). Returns the callouts it makes.
   */
  kill(killer, victim) {
    const out = [];
    const v = this.of(victim);
    v.streak = 0;
    if (killer === null || killer === victim) return out;
    const k = this.of(killer);
    k.streak++;
    k.best = Math.max(k.best, k.streak);
    const key = killer * 4096 + victim;
    this.pair.set(key, (this.pair.get(key) ?? 0) + 1);
    if (k.lastKiller === victim) {
      k.revenge++;
      k.lastKiller = -1;
      out.push({ a: "revenge", s: killer, t: victim });
    }
    v.lastKiller = killer;
    this.run.delete(victim * 4096 + killer);
    const run = (this.run.get(key) ?? 0) + 1;
    this.run.set(key, run);
    if (run === NEMESIS_RUN) out.push({ a: "nemesis", s: killer, t: victim, n: run });
    return out;
  }
  /** A team kill: it ends the killer's streak (Longest Streak) and earns nothing (no pair, no revenge, no nemesis run). */
  endStreak(slot) {
    const t = this.tally.get(slot);
    if (t) t.streak = 0;
  }
  /**
   * The awards for the players still in the match (`slots`, in slot order; ties go to the lower slot; an award
   * nobody earned isn't given).
   */
  awards(slots) {
    const out = [];
    const here = new Set(slots);
    const rows = [...slots].sort((a, b) => a - b).map((s) => [s, this.tally.get(s)]).filter((x) => !!x[1]);
    const top = (value, min) => {
      let best = null;
      for (const x of rows) if (value(x[1]) >= min && (!best || value(x[1]) > value(best[1]))) best = x;
      return best;
    };
    const acc = top((t) => t.shots >= A.accuracyMinShots ? t.hits / t.shots : -1, 0);
    if (acc && acc[1].hits > 0) out.push(["accurate", acc[0], Math.round(acc[1].hits / acc[1].shots * 100), acc[1].shots]);
    const streak = top((t) => t.best, A.streakMin);
    if (streak) out.push(["streak", streak[0], streak[1].best]);
    let nemesis = null;
    for (const [key, n] of this.pair) {
      const killer = Math.floor(key / 4096);
      const victim = key % 4096;
      if (!here.has(killer) || n < A.nemesisMin) continue;
      if (!nemesis || n > nemesis[2] || n === nemesis[2] && (killer < nemesis[0] || killer === nemesis[0] && victim < nemesis[1])) nemesis = [killer, victim, n];
    }
    if (nemesis) out.push(["nemesis", nemesis[0], nemesis[2], nemesis[1]]);
    const revenge = top((t) => t.revenge, A.revengeMin);
    if (revenge) out.push(["revenge", revenge[0], revenge[1].revenge]);
    return out;
  }
  /** For bot-report and tests: rounds fired and hit, best streak and revenge kills of a slot. */
  stats(slot) {
    const t = this.tally.get(slot);
    return t ? { shots: t.shots, hits: t.hits, best: t.best, revenge: t.revenge } : null;
  }
}
function awardText(a, name) {
  const who = name(a[1]);
  switch (a[0]) {
    case "accurate":
      return { title: "Most Accurate", line: `${who}: ${a[2]}% of ${a[3] ?? 0} rounds on target` };
    case "streak":
      return { title: "Longest Streak", line: `${who}: ${a[2]} kills in one life` };
    case "nemesis":
      return { title: "Nemesis", line: `${who}: downed ${typeof a[3] === "number" ? name(a[3]) : "one player"} ${a[2]} times` };
    case "revenge":
      return { title: "Most Revenge Kills", line: `${who}: ${a[2]} ${a[2] === 1 ? "payback" : "paybacks"}` };
    case "shapeshifter":
      return { title: "Shapeshifter", line: `${who}: ${a[2]} different characters` };
    case "giantslayer":
      return { title: "Giant Slayer", line: `${who}: ${a[2]} large ${a[2] === 1 ? "character" : "characters"} downed as a small one` };
    case "moonwalker":
      return { title: "Moonwalker", line: `${who}: ${a[2]} air ${a[2] === 1 ? "kill" : "kills"}` };
    case "bestsquad":
      return { title: "Best Squad", line: `${who}'s squad: ${a[2]} points` };
    case "squadmvp":
      return { title: "Squad MVP", line: `${who}: ${a[2]} points` };
    case "unlucky":
      return { title: "Unluckiest Roll", line: `${who} as ${getLook(String(a[3])).name}: down in ${(a[2] / 10).toFixed(1)} s` };
  }
}
const IMPACT = {
  /** Shove (m/s along the shot) at stopping power 1, for a full-damage hit. */
  shove: 3.6,
  /** Share of speed taken away at stopping power 1. */
  slow: 0.42,
  /** Stagger seconds at stopping power 0 and at 1. */
  minSeconds: 0.12,
  maxSeconds: 0.42,
  /** Caps per stagger window: total shove (m/s), deepest slow, longest window. */
  maxShove: 4.5,
  maxSlow: 0.5,
  maxStaggerSeconds: 0.6,
  /** After a window: no stopping power for this long. */
  immunitySeconds: 0.5
};
const STOPPING_BY_CATEGORY = {
  pistol: 0.15,
  smg: 0.12,
  rifle: 0.3,
  shotgun: 0.8,
  sniper: 0.9,
  explosive: 0.4,
  melee: 0.55,
  special: 0.25
};
const REVOLVER_STOPPING = 0.45;
const DEFAULT_STOPPING = 0.3;
function stoppingPower(def) {
  if (def.stoppingPower !== void 0) return Math.max(0, Math.min(1, def.stoppingPower));
  if (def.family === "revolver") return REVOLVER_STOPPING;
  return def.category ? STOPPING_BY_CATEGORY[def.category] : DEFAULT_STOPPING;
}
function staggerOf(power) {
  return { shove: IMPACT.shove * power, slow: IMPACT.slow * power, ticks: Math.round((IMPACT.minSeconds + (IMPACT.maxSeconds - IMPACT.minSeconds) * power) * TICK_RATE) };
}
const newImpact = () => ({ ticks: 0, elapsed: 0, slow: 0, shove: 0, immune: 0 });
const MAX_STAGGER_TICKS = Math.round(IMPACT.maxStaggerSeconds * TICK_RATE);
const IMMUNE_TICKS = Math.round(IMPACT.immunitySeconds * TICK_RATE);
function hitImpact(s, power, share = 1) {
  if (power <= 0 || share <= 0 || s.immune > 0) return 0;
  if (s.ticks === 0) {
    s.elapsed = 0;
    s.slow = 0;
    s.shove = 0;
  }
  const one = staggerOf(power);
  const k = Math.min(1, share);
  const shove = Math.max(0, Math.min(one.shove * k, IMPACT.maxShove - s.shove));
  s.shove += shove;
  const cap = Math.min(IMPACT.maxSlow, Math.max(s.slow, one.slow));
  s.slow = Math.min(cap, s.slow + one.slow * k);
  s.ticks = Math.max(s.ticks, Math.min(one.ticks, MAX_STAGGER_TICKS - s.elapsed));
  return shove;
}
function stepImpact(s) {
  if (s.ticks > 0) {
    s.ticks--;
    s.elapsed++;
    if (s.ticks === 0) {
      s.slow = 0;
      s.shove = 0;
      s.elapsed = 0;
      s.immune = IMMUNE_TICKS;
    }
  } else if (s.immune > 0) s.immune--;
}
const impactSpeed = (s) => s.ticks > 0 ? 1 - s.slow : 1;
function blastKnockback(spec) {
  if (spec.knockback !== void 0) return spec.knockback;
  if (spec.splashDamage < 35) return 0;
  return Math.max(6, Math.min(13, 4 + spec.splashDamage * 0.06));
}
const BLAST = {
  /** Strength left at the edge of the radius (linear from 1 at the centre). */
  edge: 0.4,
  out: 0.85,
  lift: 0.9,
  liftFromBelow: 0.35,
  /** The least lift, for a blast above you. */
  minLift: 0.35,
  /** Your own blast: a little less sideways, a little less up (a rocket jump of about 2.4 m). */
  selfOut: 0.7,
  selfLift: 0.8
};
function blastThrow(dir, d, radius, knockback, self = false) {
  if (knockback <= 0 || d > radius) return { x: 0, y: 0, z: 0 };
  const speed = knockback * (1 - (1 - BLAST.edge) * Math.max(0, d / radius));
  const h = hypot(dir.x, dir.z);
  const out = speed * (self ? BLAST.selfOut : BLAST.out);
  const lift = speed * Math.max(BLAST.minLift, BLAST.lift + BLAST.liftFromBelow * dir.y) * (self ? BLAST.selfLift : 1);
  return h > 0.05 ? { x: dir.x / h * out * Math.min(1, h * 1.5), y: lift, z: dir.z / h * out * Math.min(1, h * 1.5) } : { x: 0, y: lift, z: 0 };
}
const FORT_PIECE_KINDS = ["block", "plank", "wall", "metal_wall", "ramp", "stairs", "crate", "sandbags"];
const solid = (w, h, d) => [[0, 0, 0, w, h, d]];
const steps = (w, h, d, n) => Array.from({ length: n }, (_, i) => [0, i * h / n, i * d / n, w, (i + 1) * h / n, d]);
const FORT_PIECES = {
  block: { kind: "block", label: "Block", size: [1, 1, 1], cost: 2, health: 160, tier: "wood", parts: solid(1, 1, 1) },
  plank: { kind: "plank", label: "Plank", size: [2, 0.25, 1], cost: 1, health: 90, tier: "wood", parts: solid(2, 0.25, 1) },
  wall: { kind: "wall", label: "Wall", size: [2, 2, 0.5], cost: 4, health: 320, tier: "wood", parts: solid(2, 2, 0.5) },
  metal_wall: { kind: "metal_wall", label: "Metal wall", size: [2, 2, 0.5], cost: 8, health: 650, tier: "metal", parts: solid(2, 2, 0.5) },
  ramp: { kind: "ramp", label: "Ramp", size: [2, 1, 2], cost: 3, health: 220, tier: "wood", parts: steps(2, 1, 2, 8), rise: "ramp" },
  stairs: { kind: "stairs", label: "Stairs", size: [1, 2, 2], cost: 3, health: 220, tier: "wood", parts: steps(1, 2, 2, 8), rise: "stairs" },
  crate: { kind: "crate", label: "Crate", size: [1.5, 1.5, 1.5], cost: 3, health: 300, tier: "metal", parts: solid(1.5, 1.5, 1.5) },
  sandbags: { kind: "sandbags", label: "Sandbags", size: [2, 1, 0.5], cost: 2, health: 300, tier: "bags", parts: solid(2, 1, 0.5) }
};
const FORT_GRID = 0.5;
const FORT_REACH = 7;
const FORT_MAX_PIECES = 200;
const FORT_BARRIER_CLEARANCE = 1;
const FORT_FLAG_CLEARANCE = 3;
const FORT_SPAWN_CLEARANCE = 1.2;
const FORT_BULLET_SCALE = { wood: 0.5, metal: 0.15, bags: 0.3 };
const FORT_BLAST_SCALE = { wood: 2.5, metal: 1.3, bags: 1.6 };
const BUILDER_WEAPON = "core.builder";
function fortFootprint(kind, rot) {
  const [w, h, d] = FORT_PIECES[kind].size;
  return rot % 2 ? { w: d, d: w, h } : { w, d, h };
}
function fortPieceBoxes(kind, rot, base) {
  const def = FORT_PIECES[kind];
  const [w, , d] = def.size;
  const r = (rot % 4 + 4) % 4;
  const turn = (x, z) => r === 0 ? [x, z] : r === 1 ? [z, -x] : r === 2 ? [-x, -z] : [-z, x];
  return def.parts.map(([x0, y0, z0, x1, y1, z1]) => {
    const [ax, az] = turn(x0 - w / 2, z0 - d / 2);
    const [bx, bz] = turn(x1 - w / 2, z1 - d / 2);
    return {
      min: { x: base.x + Math.min(ax, bx), y: base.y + y0, z: base.z + Math.min(az, bz) },
      max: { x: base.x + Math.max(ax, bx), y: base.y + y1, z: base.z + Math.max(az, bz) }
    };
  });
}
function fortBounds(boxes) {
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const b of boxes) {
    for (const k of ["x", "y", "z"]) {
      min[k] = Math.min(min[k], b.min[k]);
      max[k] = Math.max(max[k], b.max[k]);
    }
  }
  return { min, max };
}
const snap = (v) => Math.round(v / FORT_GRID) * FORT_GRID;
function snapFortBase(kind, rot, p) {
  const { w, d } = fortFootprint(kind, rot);
  return { x: snap(p.x - w / 2) + w / 2, y: Math.round(p.y * 100) / 100, z: snap(p.z - d / 2) + d / 2 };
}
function fortAimPlacement(physics, eye, yaw, pitch, kind, rot) {
  const dir = viewDirection(yaw, pitch);
  const hit = physics.raycastNormal(eye, dir, FORT_REACH);
  if (!hit || hit.normal.y < -0.5) return null;
  let p = { x: eye.x + dir.x * hit.dist, y: eye.y + dir.y * hit.dist, z: eye.z + dir.z * hit.dist };
  if (hit.normal.y < 0.6) {
    const h = hypot(hit.normal.x, hit.normal.z) || 1;
    const ux = hit.normal.x / h;
    const uz = hit.normal.z / h;
    const { w, d } = fortFootprint(kind, rot);
    const out = Math.abs(ux) * w / 2 + Math.abs(uz) * d / 2 + 0.02;
    p = { x: p.x + ux * out, y: p.y, z: p.z + uz * out };
  }
  const base = snapFortBase(kind, rot, p);
  const down = physics.raycastHit({ x: base.x, y: p.y + 0.6, z: base.z }, { x: 0, y: -1, z: 0 }, 6);
  if (!down) return null;
  return { ...base, y: Math.round((p.y + 0.6 - down.dist) * 100) / 100 };
}
function fortPlacementProblem(world, team, kind, rot, base) {
  const boxes = fortPieceBoxes(kind, rot, base);
  const all = fortBounds(boxes);
  const sign = team === 0 ? -1 : 1;
  for (const x of [all.min.x, all.max.x]) {
    for (const z of [all.min.z, all.max.z]) {
      if (world.side({ x, y: base.y, z }) * sign < FORT_BARRIER_CLEARANCE) return "Build on your own side";
    }
  }
  for (const k of world.keepClear) {
    const dx = Math.max(all.min.x - k.pos.x, 0, k.pos.x - all.max.x);
    const dz = Math.max(all.min.z - k.pos.z, 0, k.pos.z - all.max.z);
    if (hypot(dx, dz) < k.r && all.min.y < k.pos.y + 3 && all.max.y > k.pos.y - 1) return "Too close to a flag or spawn";
  }
  const r = PLAYER.radius;
  for (const b of world.bodies) {
    if (b.x + r > all.min.x && b.x - r < all.max.x && b.z + r > all.min.z && b.z - r < all.max.z && b.y + PLAYER.height > all.min.y && b.y < all.max.y) return "Someone is in the way";
  }
  for (const p of world.pieces) {
    for (const o of p.boxes) for (const b of boxes) if (overlaps(o, b, 0.01)) return "Blocked by another piece";
  }
  for (const b of boxes) {
    const half = { x: (b.max.x - b.min.x) / 2 - 0.06, y: (b.max.y - b.min.y) / 2 - 0.12, z: (b.max.z - b.min.z) / 2 - 0.06 };
    const centre = { x: (b.min.x + b.max.x) / 2, y: (b.min.y + b.max.y) / 2 + 0.12, z: (b.min.z + b.max.z) / 2 };
    if (half.y > 0.01 && !world.physics.boxClear(centre, half)) return "Blocked";
  }
  const down = world.physics.raycastHit({ x: base.x, y: base.y + 0.3, z: base.z }, { x: 0, y: -1, z: 0 }, 0.8);
  if (!down) return "Needs something under it";
  return null;
}
const overlaps = (a, b, shrink = 0) => a.min.x + shrink < b.max.x && a.max.x - shrink > b.min.x && a.min.y + shrink < b.max.y && a.max.y - shrink > b.min.y && a.min.z + shrink < b.max.z && a.max.z - shrink > b.min.z;
function fortFlagBases(map, teams) {
  const at = (id) => {
    const e = map.entities.find((x) => x.kind === "flag" && x.team === id);
    return e ? { x: e.position[0], y: e.position[1], z: e.position[2] } : null;
  };
  const a = at(teams[0]?.id);
  const b = at(teams[1]?.id);
  return a && b ? [a, b] : null;
}
function fortMidfield(a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = hypot(dx, dz) || 1;
  const dir = { x: dx / len, y: 0, z: dz / len };
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
  return { mid, dir, yaw: Math.atan2(dir.x, dir.z), side: (p) => (p.x - mid.x) * dir.x + (p.z - mid.z) * dir.z };
}
const FORT_BARRIER_HALF = { x: 400, y: 200, z: 0.25 };
const FORT_BUILD = 0;
const FORT_COMBAT = 1;
export {
  impactSpeed as A,
  BUILDER_WEAPON as B,
  FORT_PIECE_KINDS as F,
  MatchAwards as M,
  fortMidfield as a,
  FORT_BUILD as b,
  fortPieceBoxes as c,
  fortBounds as d,
  FORT_PIECES as e,
  fortFlagBases as f,
  FORT_BARRIER_HALF as g,
  fortAimPlacement as h,
  FORT_MAX_PIECES as i,
  fortPlacementProblem as j,
  FORT_FLAG_CLEARANCE as k,
  FORT_SPAWN_CLEARANCE as l,
  awardText as m,
  thirdPersonCamera as n,
  snapFortBase as o,
  FORT_COMBAT as p,
  FORT_REACH as q,
  FORT_BULLET_SCALE as r,
  stoppingPower as s,
  thirdPersonAim as t,
  FORT_BLAST_SCALE as u,
  blastKnockback as v,
  newImpact as w,
  hitImpact as x,
  stepImpact as y,
  blastThrow as z
};
