// Measured hit shapes for every look and creature (docs/CHARACTERS.md, "Hitboxes"): each model is posed as the
// game draws it standing (aim_idle), crouching (crouch_idle) and prone (prone_idle), skinned here in Node
// (skinpose.mjs), and its vertices, grouped by the joint that holds them, are fitted with
//   a head sphere (Head and below it; an alien's eyes),
//   a torso capsule (hips, spine, neck, collar bones),
//   a capsule for each thigh and each shin (with its foot),
//   and arm capsules only where the arms stick out of those shapes (most often the forearms holding the gun).
// The torso is a capsule squashed across the body (`w`, half the width, against `r`, the depth), so a
// broad-shouldered look is wider than deep; limbs are round. Units: metres at a 1.8 m standard body (the game fits every
// character's rest height to 1.8 m, then its size class scales it), feet at the origin, +y up, +z the way the
// character faces, +x its right. Creatures are in their own drawn metres (CREATURE_SPECS scale, stood on the
// ground or hovering), as the NPCs are drawn.
//
// A manifest may override what was measured with `hitbox` (content/characters/<id>.json):
//   { "head": { "r": 0.13, "dy": 0.02, "dz": 0.01 }, "torso": { "w": 0.24, "r": 0.15 }, "legs": { "r": 0.08 }, "arms": false }
// head.r, torso w and r and legs r are absolute (m at 1.8 m), dy/dz move the head; arms false drops them, true keeps
// them even when they hardly stick out. Applied to all three stances.
//
//   node tools/content/hitboxes.mjs          write packages/shared/src/content/hitboxes.generated.ts
//   node tools/content/hitboxes.mjs --check  fail when it is out of date (pnpm content:check runs this)
//   node tools/content/hitboxes.mjs --print [keys…]  print the shapes

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { firstFrame, jointParents, jointPositions, readGlb, retargetFrame, skinnedVertices } from './skinpose.mjs';
import { hitboxOverrideProblems, isQueued, readManifests } from './character-manifests.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const OUT_FILE = join(ROOT, 'packages/shared/src/content/hitboxes.generated.ts');
const CHARS = join(ROOT, 'packages/client/public/characters');
const CREATURES = join(ROOT, 'packages/client/public');
/** The game's standing height for every character (PLAYER.height). */
export const STAND = 1.8;
export const POSES = { stand: 'aim_idle', crouch: 'crouch_idle', prone: 'prone_idle' };
/**
 * Joints the game's aim pose holds over the locomotion clips (characterAnimator.ts UPPER_BODY): crouching with a gun
 * the upper body is drawn half from crouch_idle and half from aim_idle (two clips at weight 1), so it is more upright.
 */
const UPPER_BODY = new Set(['spine_02', 'spine_03', 'neck_01', 'Head', ...['l', 'r'].flatMap((s) => [`clavicle_${s}`, `upperarm_${s}`, `lowerarm_${s}`, `hand_${s}`, ...['index', 'middle', 'pinky', 'ring', 'thumb'].flatMap((f) => [1, 2, 3].map((j) => `${f}_0${j}_${s}`))])]);
/** Torso vertices further than this many times the median from the spine line are not body (tails, capes' hems). */
const SPINE_REACH = 2.4;
/** Arms are kept when at least this share of their vertices lies outside the head, torso and legs (by ARM_SLACK m). */
const ARM_SHARE = 0.2;
const ARM_SLACK = 0.03;
/** The share of the head's vertices its sphere holds. */
const HEAD_SHARE = 0.8;

const r3 = (v) => Math.round(v * 1000) / 1000;
const r2 = (v) => Math.round(v * 100) / 100 || 0;

/** Which part of the body a joint belongs to, by its own name or an ancestor's. */
export function regionOf(joint, parents) {
  for (let j = joint, n = 0; j && n < 40; j = parents[j], n++) {
    if (/^(head|eye)/i.test(j) || j === 'HeadTop_End') return 'head';
    if (/^(thigh_|calf_|foot_|ball_)/.test(j) || /^(Left|Right)(UpLeg|Leg|Foot|ToeBase|Toe_End)$/.test(j)) return /^(thigh_|(Left|Right)UpLeg$)/.test(j) ? 'thigh' : 'shin';
    if (/^(upperarm_|lowerarm_|hand_)/.test(j) || /^(Left|Right)(Arm|ForeArm|Hand)/.test(j) || /^Claw/.test(j)) return 'arm';
  }
  return 'torso';
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));
  return sorted[i];
}
const sortNum = (a) => Float64Array.from(a).sort();

/** A sphere round a point cloud: the middle of its trimmed box, the radius holding HEAD_SHARE of the points (ears, horns and hat brims stick out of it). */
function fitSphere(pts) {
  const xs = sortNum(pts.map((p) => p[0])), ys = sortNum(pts.map((p) => p[1])), zs = sortNum(pts.map((p) => p[2]));
  const c = [(percentile(xs, 0.05) + percentile(xs, 0.95)) / 2, (percentile(ys, 0.05) + percentile(ys, 0.95)) / 2, (percentile(zs, 0.05) + percentile(zs, 0.95)) / 2];
  const d = sortNum(pts.map((p) => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2])));
  // No higher than the top of the head (a sphere round a long snout or wide ears would stand over it).
  const r = Math.min(percentile(d, HEAD_SHARE), percentile(ys, 0.99) - c[1] + 0.02);
  return { c, r: Math.max(0.05, r) };
}

/**
 * A capsule squashed across the body round a point cloud: its axis in the up/forward plane (the cloud's main
 * direction there), `r` its radius in that plane (the depth), `w` its half-width, `x` its middle across.
 */
function fitBodyCapsule(pts) {
  const n = pts.length;
  let my = 0, mz = 0;
  for (const p of pts) { my += p[1]; mz += p[2]; }
  my /= n; mz /= n;
  // The axis runs from the middle of its lowest fifth to the middle of its highest (standing, crouching), or
  // from its back fifth to its front one (lying down): the body's own line, not where a tail or a stride spreads it.
  const ys = sortNum(pts.map((p) => p[1])), zs0 = sortNum(pts.map((p) => p[2]));
  const k = percentile(ys, 0.97) - percentile(ys, 0.03) >= 0.6 * (percentile(zs0, 0.97) - percentile(zs0, 0.03)) ? 1 : 2;
  const sorted = [...pts].sort((a, b) => a[k] - b[k]);
  const m = Math.max(1, Math.floor(n / 5));
  const mid = (list) => [list.reduce((t, p) => t + p[1], 0) / list.length, list.reduce((t, p) => t + p[2], 0) / list.length];
  const c0 = mid(sorted.slice(0, m)), c1 = mid(sorted.slice(n - m));
  const L = Math.hypot(c1[0] - c0[0], c1[1] - c0[1]) || 1;
  const u = [(c1[0] - c0[0]) / L, (c1[1] - c0[1]) / L]; // (y, z) along the axis
  const v = [-u[1], u[0]];
  const s = sortNum(pts.map((p) => (p[1] - my) * u[0] + (p[2] - mz) * u[1]));
  const q = sortNum(pts.map((p) => (p[1] - my) * v[0] + (p[2] - mz) * v[1]));
  const xs = sortNum(pts.map((p) => p[0]));
  // Its middle line and depth: round the bulk of the points (a tail or a cape's hem left on the spine is not body).
  const qc = (percentile(q, 0.05) + percentile(q, 0.95)) / 2;
  const r = Math.max(0.03, percentile(sortNum(Array.from(q, (x) => Math.abs(x - qc))), 0.93));
  const x0 = percentile(xs, 0.02), x1 = percentile(xs, 0.98);
  const w = Math.max(r * 0.5, (x1 - x0) / 2);
  let s0 = percentile(s, 0.03), s1 = percentile(s, 0.99);
  // The caps reach r past the segment's ends: pull the ends in, so a cap stands at most 3 cm past the body's end
  // (and a thin one a little more, so corners such as the shoulders aren't rounded off much).
  const pull = Math.min(Math.max(0.7 * r, r - 0.03), (s1 - s0) / 2);
  s0 += pull; s1 -= pull;
  const at = (t) => [my + u[0] * t + v[0] * qc, mz + u[1] * t + v[1] * qc];
  const a = at(s0), b = at(s1);
  // Keep `a` the lower end (or, lying flat, the one further back).
  const swap = a[0] > b[0] + 1e-6 || (Math.abs(a[0] - b[0]) <= 1e-6 && a[1] > b[1]);
  const [lo, hi] = swap ? [b, a] : [a, b];
  return { x: (x0 + x1) / 2, w, r, a: lo, b: hi };
}

/** A round capsule along a point cloud's main 3D direction (an arm). */
function fitLimb(pts) {
  const n = pts.length;
  const m = [0, 0, 0];
  for (const p of pts) for (let k = 0; k < 3; k++) m[k] += p[k] / n;
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of pts) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += (p[i] - m[i]) * (p[j] - m[j]);
  let u = [1, 1, 1];
  for (let it = 0; it < 30; it++) {
    const nu = [0, 1, 2].map((i) => C[i][0] * u[0] + C[i][1] * u[1] + C[i][2] * u[2]);
    const l = Math.hypot(...nu) || 1;
    u = nu.map((x) => x / l);
  }
  const s = sortNum(pts.map((p) => (p[0] - m[0]) * u[0] + (p[1] - m[1]) * u[1] + (p[2] - m[2]) * u[2]));
  const perp = sortNum(pts.map((p) => {
    const d = [p[0] - m[0], p[1] - m[1], p[2] - m[2]];
    const t = d[0] * u[0] + d[1] * u[1] + d[2] * u[2];
    return Math.hypot(d[0] - u[0] * t, d[1] - u[1] * t, d[2] - u[2] * t);
  }));
  const r = Math.max(0.03, percentile(perp, 0.9));
  let s0 = percentile(s, 0.02), s1 = percentile(s, 0.98);
  const pull = Math.min(Math.max(0.7 * r, r - 0.03), (s1 - s0) / 2);
  s0 += pull; s1 -= pull;
  return { a: m.map((x, k) => x + u[k] * s0), b: m.map((x, k) => x + u[k] * s1), r };
}

// Distances to the fitted shapes (for which arm points stick out, and the audit).
function segDist(p, a, b) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const L = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2];
  const t = L > 1e-12 ? Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / L)) : 0;
  return Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t);
}
/** How far a point lies outside a squashed body capsule (negative inside), in the squashed space's metres. */
export function outsideBody(p, c) {
  const k = c.r / c.w;
  return segDist([(p[0] - c.x) * k, p[1], p[2]], [0, c.a[0], c.a[1]], [0, c.b[0], c.b[1]]) - c.r;
}
export function outsideShapes(p, s) {
  let d = Infinity;
  if (s.head) d = Math.min(d, Math.hypot(p[0] - s.head.x, p[1] - s.head.y, p[2] - s.head.z) - s.head.r);
  if (s.torso) d = Math.min(d, outsideBody(p, s.torso));
  for (const l of s.legs) d = Math.min(d, segDist(p, l.a, l.b) - l.r);
  for (const a of s.arms) d = Math.min(d, segDist(p, a.a, a.b) - a.r);
  return d;
}

/** Points by region from posed vertices: x flipped to the character's right (glTF +x is its left), scaled by k. */
function regions(verts, parents, k, lift = 0) {
  const out = { head: [], torso: [], thigh: [], shin: [], arm: [] };
  const memo = new Map();
  for (let i = 0; i < verts.x.length; i++) {
    const j = verts.joint[i];
    let r = memo.get(j);
    if (!r) memo.set(j, (r = regionOf(j, parents)));
    out[r].push([-verts.x[i] * k, (verts.y[i] + lift) * k, verts.z[i] * k]);
  }
  return out;
}

/** Fit one pose's shapes. `arms`: true / false forces them (manifest override), undefined decides by ARM_SHARE. */
export function fitPose(reg, arms, spine = []) {
  const s = { head: null, torso: null, legs: [], arms: [] };
  // The torso is what lies round the spine: a tail or a long cape's hem held by the hips is left out.
  if (spine.length >= 2 && reg.torso.length >= 16) {
    const dist = (p) => {
      let d = Infinity;
      for (let i = 1; i < spine.length; i++) d = Math.min(d, segDist(p, spine[i - 1], spine[i]));
      return d;
    };
    const ds = reg.torso.map(dist);
    const median = sortNum(ds)[Math.floor(ds.length / 2)];
    const keep = reg.torso.filter((_, i) => ds[i] <= Math.max(0.12, median * SPINE_REACH));
    if (keep.length >= 16) reg = { ...reg, torso: keep };
  }
  if (reg.head.length >= 8) {
    const h = fitSphere(reg.head);
    s.head = { x: h.c[0], y: h.c[1], z: h.c[2], r: h.r };
  }
  if (reg.torso.length >= 8) s.torso = fitBodyCapsule(reg.torso);
  // Each leg's thigh and shin (with the foot) on its own: a round capsule each, so the gap between the legs and a
  // stride's spread are not body.
  for (const part of ['thigh', 'shin']) {
    for (const side of [1, -1]) {
      const pts = reg[part].filter((p) => p[0] * side > 0);
      if (pts.length >= 8) s.legs.push(fitLimb(pts));
    }
  }
  if (arms !== false && reg.arm.length >= 8) {
    for (const side of [1, -1]) {
      const pts = reg.arm.filter((p) => p[0] * side > 0);
      const out = pts.filter((p) => outsideShapes(p, s) > ARM_SLACK);
      if (pts.length < 8 || out.length < 8) continue;
      if (arms !== true && out.length / pts.length < ARM_SHARE) continue;
      s.arms.push(fitLimb(out));
    }
  }
  // Nothing body-like (a floating eye): one capsule round all of it.
  if (!s.torso && !s.head) s.torso = fitBodyCapsule([...reg.arm, ...reg.thigh, ...reg.shin]);
  return s;
}

/** Overrides from a manifest's `hitbox`. */
export function applyOverrides(s, o) {
  if (!o) return s;
  if (s.head && o.head) s.head = { ...s.head, r: o.head.r ?? s.head.r, y: s.head.y + (o.head.dy ?? 0), z: s.head.z + (o.head.dz ?? 0) };
  if (s.torso && o.torso) s.torso = { ...s.torso, w: o.torso.w ?? s.torso.w, r: o.torso.r ?? s.torso.r };
  if (o.legs) s.legs = s.legs.map((l) => ({ ...l, r: o.legs.r ?? l.r }));
  if (o.arms === false) s.arms = [];
  return s;
}

/** Rest height (the game's fit: the bind pose's full height) of one or more docs. */
function restBounds(docs) {
  let lo = Infinity, hi = -Infinity, wide = 0;
  for (const d of docs) {
    const v = skinnedVertices(d, null);
    for (let i = 0; i < v.y.length; i++) {
      if (v.y[i] < lo) lo = v.y[i];
      if (v.y[i] > hi) hi = v.y[i];
      wide = Math.max(wide, Math.abs(v.x[i]) * 2, Math.abs(v.z[i]) * 2);
    }
  }
  return { lo, hi, height: hi - lo, wide };
}

function merge(list) {
  const out = { head: [], torso: [], thigh: [], shin: [], arm: [] };
  for (const r of list) for (const k of Object.keys(out)) out[k].push(...r[k]);
  return out;
}

/** Half way between two rotations (normalised), as two clips at equal weight blend. */
function halfway(a, b) {
  const sign = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3] < 0 ? -1 : 1;
  const q = a.map((v, i) => (v + sign * b[i]) / 2);
  const l = Math.hypot(...q) || 1;
  return q.map((v) => v / l);
}

/** The pose a stance is drawn in: its clip, and crouching the aim pose blended into the upper body. */
function stanceFrame(rig, d, stance, clipsFrom) {
  const clipOf = (st) => clipsFrom?.[st] ?? POSES[st];
  const frameOf = (st) => (clipsFrom ? firstFrame(d, clipOf(st)) : null) ?? retargetFrame(firstFrame(rig, clipOf(st)), rig, d);
  const frame = frameOf(stance);
  if (stance !== 'crouch') return frame;
  const aim = frameOf('stand');
  const out = new Map(frame);
  for (const [name, e] of frame) {
    const a = aim.get(name);
    if (UPPER_BODY.has(name) && e.rotation && a?.rotation) out.set(name, { ...e, rotation: halfway(e.rotation, a.rotation) });
  }
  return out;
}

/** The posed spine line, hips to head (our rig's joints, a Mixamo rig's, or an alien's spine chain), in output units. */
function spineLine(d, frame, k, lift = 0) {
  const j = jointPositions(d, frame);
  const names = ['pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'Head', 'Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Root', 'Spine_1', 'Spine_2', 'Spine_3', 'Spine_4', 'Spine_5', 'Spine_6'];
  return names.filter((n) => j[n]).map((n) => [-j[n][0] * k, (j[n][1] + lift) * k, j[n][2] * k]);
}

/**
 * A character on the rig (one file or several parts) posed in one stance, its vertices by region in the hit
 * shapes' units (metres at a 1.8 m standing height, x to its right). Returns { reg, rest }.
 */
export async function characterPoints(files, stance, clipsFrom) {
  const rig = await readGlb(join(CHARS, 'rig.glb'));
  const docs = await Promise.all(files.map((f) => readGlb(join(CHARS, `${f}.glb`))));
  const rest = restBounds(docs);
  const k = STAND / rest.height;
  let spine = [];
  const regs = docs.map((d, i) => {
    const frame = stanceFrame(rig, d, stance, clipsFrom);
    if (i === 0) spine = spineLine(d, frame, k);
    return regions(skinnedVertices(d, frame), jointParents(d), k);
  });
  return { reg: merge(regs), rest: rest.height, spine };
}

/** Measure a character on the rig: its shapes in each pose, at a 1.8 m standing height. */
export async function measureCharacter(files, overrides, clipsFrom) {
  const out = {};
  for (const stance of Object.keys(POSES)) {
    const { reg, rest, spine } = await characterPoints(files, stance, clipsFrom);
    out.rest = r3(rest);
    out[stance] = applyOverrides(fitPose(reg, overrides?.arms, spine), overrides);
  }
  return out;
}

/** A creature as an NPC is drawn (its idle clip), its vertices by region in its drawn metres. */
export async function creaturePoints(spec) {
  const doc = await readGlb(join(CREATURES, spec.model));
  const rest = restBounds([doc]);
  const k = spec.scale;
  const lift = -rest.lo + spec.hover / k;
  const frame = firstFrame(doc, 'idle');
  return { reg: regions(skinnedVertices(doc, frame), jointParents(doc), k, lift), rest: rest.height * k, wide: rest.wide * k, spine: spineLine(doc, frame, k, lift) };
}

/**
 * A creature as an NPC is drawn: its model scaled by CREATURE_SPECS, stood on its lowest rest point (or hovering).
 * It has no crouch or prone clips: those stances keep its standing shapes.
 */
export async function measureCreature(spec) {
  const { reg, rest, wide, spine } = await creaturePoints(spec);
  const s = fitPose(reg, undefined, spine);
  return { rest: r3(rest), wide: r3(wide), hover: spec.hover, stand: s, crouch: s, prone: s };
}

/** Everything that gets shapes: { key, files, overrides, clipsFrom } for characters, { key, creature } for creatures. */
export async function subjects() {
  const { CORE_LOOKS } = await import('../../packages/shared/src/content/looks.ts');
  const { CREATURE_SPECS } = await import('../../packages/shared/src/sim/creatures.ts');
  const out = [
    { key: 'base:male', files: ['rig'] },
    { key: 'base:female', files: ['mannequin_f'] },
    { key: 'base:zombie', files: ['rig'], clipsFrom: { stand: 'zombie_idle' } },
  ];
  for (const l of CORE_LOOKS) if (!l.whole) out.push({ key: l.id, files: [l.head, ...l.parts, ...l.hair].filter(Boolean) });
  for (const m of readManifests()) {
    if (isQueued(m) || m.kind !== 'character' || !existsSync(join(CHARS, `${m.id}.glb`))) continue;
    out.push({ key: m.look, files: [m.id], overrides: m.hitbox });
  }
  for (const [kind, spec] of Object.entries(CREATURE_SPECS)) out.push({ key: `creature:${kind}`, creature: spec });
  return out;
}

/** A subject's posed vertices by region (see characterPoints / creaturePoints). */
export const pointsOf = (sub, stance = 'stand') => (sub.creature ? creaturePoints(sub.creature) : characterPoints(sub.files, stance, sub.clipsFrom));

/** Everything measured: [key, entry]. Keys: look ids, `base:male` / `base:female` / `base:zombie` (mannequins), `creature:<kind>`. */
export async function measureAll() {
  const out = [];
  for (const sub of await subjects()) out.push([sub.key, sub.creature ? await measureCreature(sub.creature) : await measureCharacter(sub.files, sub.overrides, sub.clipsFrom)]);
  return out;
}

// The generated table.
const fmt = (n) => String(r2(n));
const body = (c) => `{ x: ${fmt(c.x)}, w: ${fmt(c.w)}, r: ${fmt(c.r)}, a: [${fmt(c.a[0])}, ${fmt(c.a[1])}], b: [${fmt(c.b[0])}, ${fmt(c.b[1])}] }`;
function shapesSrc(s) {
  const parts = [];
  if (s.head) parts.push(`head: { x: ${fmt(s.head.x)}, y: ${fmt(s.head.y)}, z: ${fmt(s.head.z)}, r: ${fmt(s.head.r)} }`);
  if (s.torso) parts.push(`torso: ${body(s.torso)}`);
  const limb = (a) => `{ a: [${a.a.map(fmt).join(', ')}], b: [${a.b.map(fmt).join(', ')}], r: ${fmt(a.r)} }`;
  parts.push(`legs: [${s.legs.map(limb).join(', ')}]`);
  parts.push(`arms: [${s.arms.map(limb).join(', ')}]`);
  return `{ ${parts.join(', ')} }`;
}

export function source(entries) {
  const L = [
    '// Generated by tools/content/hitboxes.mjs from the character and creature models (and `hitbox` overrides in',
    '// content/characters/*.json). Do not edit by hand: run `node tools/content/hitboxes.mjs` (pnpm content:check fails until you do).',
    "import type { LookHitbox } from '../sim/hitbox.ts';",
    '',
    '/** Measured hit shapes by look id, `base:<mannequin>` and `creature:<kind>` (docs/CHARACTERS.md, "Hitboxes"). */',
    'export const MEASURED_HITBOXES: Readonly<Record<string, LookHitbox>> = {',
  ];
  for (const [key, e] of entries) {
    const same = e.crouch === e.stand;
    const extra = e.wide !== undefined ? `, wide: ${fmt(e.wide)}, hover: ${fmt(e.hover)}, creature: true` : '';
    L.push(`  '${key}': { rest: ${fmt(e.rest)}${extra},`);
    L.push(`    stand: ${shapesSrc(e.stand)},`);
    if (same) L.push('    crouch: null, prone: null },');
    else {
      L.push(`    crouch: ${shapesSrc(e.crouch)},`);
      L.push(`    prone: ${shapesSrc(e.prone)} },`);
    }
  }
  L.push('};', '');
  return L.join('\n');
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  for (const m of readManifests()) {
    const p = hitboxOverrideProblems(m.hitbox);
    if (p.length) {
      console.error(`${m.id}: ${p.join('; ')}`);
      process.exit(1);
    }
  }
  const entries = await measureAll();
  if (args[0] === '--print') {
    const keys = args.slice(1);
    for (const [k, e] of entries) if (!keys.length || keys.includes(k)) console.log(k, JSON.stringify({ rest: e.rest, stand: e.stand }, (_, v) => (typeof v === 'number' ? r3(v) : v)));
  } else {
    const src = source(entries);
    if (args[0] === '--check') {
      const old = existsSync(OUT_FILE) ? readFileSync(OUT_FILE, 'utf8') : '';
      if (old !== src) {
        console.error('hitboxes.generated.ts is out of date: run node tools/content/hitboxes.mjs');
        process.exit(1);
      }
      console.log(`hitboxes: ${entries.length} measured, up to date`);
    } else {
      writeFileSync(OUT_FILE, src);
      console.log(`hitboxes: wrote ${entries.length} to ${OUT_FILE}`);
    }
  }
}
