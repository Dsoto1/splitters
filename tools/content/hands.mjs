// Hands measured from the mesh, and finger weights so they close on a grip (prepare-meshy-characters.mjs
// at import, rehand-built.mjs on characters already built).
//
// Meshy hands come in every size and shape (a titan's open slabs, a gauntlet's fist, a cat's paw), and
// carry no finger weights. For each hand this:
// - measures it in the hand joint's own space: the finger direction, the palm centre, the length from
//   the wrist joint to the fingertips, the width across the knuckles and the thickness of the palm;
// - moves the rig's finger joints onto it (knuckles on the measured knuckle line, each finger's two
//   further joints along it, the thumb scaled from the rig's), keeping the rig's joint orientations so
//   the clips mean the same; the game builds its grip frame from these joints;
// - weights the fingers to the rig's finger chains: the vertices past the knuckle line are split into
//   index, middle, ring and pinky by where they sit across the hand (when the gaps between the fingers
//   show), blended into the hand at the knuckles and along each finger at its joints. A mitten or claw
//   whose fingers can't be told apart bends once, at the knuckle line. A hand that is already closed
//   (a fist, a gauntlet) is left rigid: curling it would fold it in two;
// - returns the measurements for the game (CharacterAnimator puts the measured palm, not the rig's, on
//   the grip, and sets the grip's offset from the hand's thickness), written as `extras.hand` on the
//   hand joints.
// The thumb stays on the hand joint (the game never curls it; its joints move to fit the hand).
// Manifest overrides (`fixes.hands`: palm, curl, scale, or per side under l / r) cover the odd model.

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => scale(a, 1 / (Math.hypot(...a) || 1));
const qinv = (q) => [-q[0], -q[1], -q[2], q[3]];
const qrot = (q, v) => {
  const t = scale(cross(q, v), 2);
  return add(add(v, scale(t, q[3])), cross(q, t));
};
const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0 || 1e-9)));
  return t * t * (3 - 2 * t);
};
/** The p-th percentile (0–100) of numbers. */
function pct(xs, p) {
  if (!xs.length) return 0;
  const s = Float64Array.from(xs).sort();
  const i = Math.min(s.length - 1, Math.max(0, (p / 100) * (s.length - 1)));
  const lo = Math.floor(i);
  return s[lo] + (s[Math.min(s.length - 1, lo + 1)] - s[lo]) * (i - lo);
}
const round = (x) => Math.round(x * 1e4) / 1e4;

export const FINGERS = ['index', 'middle', 'ring', 'pinky'];
/** Where a finger's middle and end joints sit along it (the rig's proportions). */
const FINGER_JOINTS = [0.38, 0.69, 1];
/** The knuckle line and the palm centre, as shares of the hand's span from wrist end to fingertips (measured on the rig's mannequin). */
const KNUCKLE_AT = 0.53;
const PALM_AT = 0.22;
/** Below this openness a hand is treated as closed (curling would only crumple it). */
const MIN_OPEN = 0.15;
/** Thickness against span: an open hand is thin (the mannequin's 0.12), a fist or gauntlet thick. */
const OPEN = 0.24;
const CLOSED = 0.42;
/** A finger gap: a run of cells across the fingers holding at most this share of the fullest cell. */
const GAP = 0.18;

/** The side's joint names. */
const names = (s) => ({
  hand: `hand_${s}`,
  lower: `lowerarm_${s}`,
  fingers: FINGERS.map((f) => [1, 2, 3].map((i) => `${f}_0${i}_${s}`).concat(`${f}_04_leaf_${s}`)),
  thumb: [1, 2, 3].map((i) => `thumb_0${i}_${s}`).concat(`thumb_04_leaf_${s}`),
});

/**
 * The rig's own hand, the reference every hand is measured against: in the
 * rig hand joint's space, its finger direction (+y), across (pinky to index),
 * the side the thumb is on, and its finger and thumb joints. `rig` maps joint
 * name to rest world { q, t } (the rig's own, unfitted).
 */
export function rigHand(rig, s) {
  const n = names(s);
  const h = rig.get(n.hand);
  const local = (name) => qrot(qinv(h.q), sub(rig.get(name).t, h.t));
  const along = [0, 1, 0];
  const flat = (v) => sub(v, scale(along, dot(v, along)));
  const across = norm(flat(sub(local(n.fingers[0][0]), local(n.fingers[3][0]))));
  const t = flat(local(n.thumb[1]));
  const palmSide = norm(sub(t, scale(across, dot(t, across))));
  return { along, across, palmSide, fingers: n.fingers.map((c) => c.map(local)), thumb: n.thumb.map(local), knuckle: local(n.fingers[1][0]) };
}

/** Influence of one side's hand chain (hand, fingers, thumb) on a vertex. */
function chainWeight(J, W, v, chain) {
  let w = 0;
  for (let k = 0; k < 4; k++) if (chain.has(J[v * 4 + k])) w += W[v * 4 + k];
  return w;
}

/**
 * Measure one hand. `pts` are its vertices in the hand joint's space; `ref`
 * is rigHand() for this side. Returns the hand's frame and size, in that space.
 */
export function measureHand(pts, ref, override = {}) {
  if (pts.length < 12) return null;
  const ys = pts.map((p) => p[1]);
  // The finger direction: from the wrist end of the hand to its far end (kept within 45° of the forearm's line).
  const lo = pct(ys, 30);
  const hi = pct(ys, 70);
  const mean = (list) => scale(list.reduce((a, p) => add(a, p), [0, 0, 0]), 1 / Math.max(1, list.length));
  let along = norm(sub(mean(pts.filter((p) => p[1] >= hi)), mean(pts.filter((p) => p[1] <= lo))));
  if (dot(along, ref.along) < Math.SQRT1_2 || !Number.isFinite(along[0])) along = ref.along;
  // Palm side and across from the rig's, square to the finger direction (Meshy hands sit as the rig's do, palm down in the T-pose).
  const palmSide = norm(sub(ref.palmSide, scale(along, dot(ref.palmSide, along))));
  const across = norm(cross(palmSide, along));
  const flip = dot(across, ref.across) < 0 ? -1 : 1;
  const c = scale(across, flip);
  const uvt = pts.map((p) => [dot(p, along), dot(p, c), dot(p, palmSide)]);
  const us = uvt.map((x) => x[0]);
  // From the wrist end (a cuff or sleeve the skinning left on the hand, far behind the wrist joint, doesn't count) to the fingertips.
  const u1 = Math.max(0.02, pct(us, 97));
  const u0 = Math.min(u1 - 0.02, Math.max(pct(us, 3), -0.15 * u1));
  const span = u1 - u0;
  const slab = uvt.filter((x) => x[0] >= u0 + 0.15 * span && x[0] <= u0 + 0.55 * span);
  const use = slab.length >= 6 ? slab : uvt;
  const vs = use.map((x) => x[1]);
  // The core of the palm across (the thumb and any cuff stick out at the sides).
  const vLo = pct(vs, 20);
  const vHi = pct(vs, 80);
  const core = use.filter((x) => x[1] >= vLo && x[1] <= vHi);
  const ts = (core.length >= 4 ? core : use).map((x) => x[2]);
  const thickness = Math.max(0.008, pct(ts, 92) - pct(ts, 8));
  const width = Math.max(0.015, pct(vs, 95) - pct(vs, 5));
  const uP = u0 + PALM_AT * span;
  const vP = pct(vs, 50);
  const tP = (pct(ts, 92) + pct(ts, 8)) / 2;
  const at = (u, v, t) => add(add(scale(along, u), scale(c, v)), scale(palmSide, t));
  const palm = override.palm ?? at(uP, vP, tP);
  // Open or closed: thickness against span.
  const open = 1 - smooth(OPEN, CLOSED, thickness / span);
  return { along, across: c, palmSide, u0, u1, span, width, thickness, uP, vP, tP, palm, open, at, uvt };
}

/**
 * Split the finger part of a hand into index, middle, ring and pinky by the
 * gaps across it, or null when the fingers can't be told apart (a mitten, a
 * claw, fused fingers). Returns the boundaries across, index side first.
 */
export function fingerGaps(uvt, uK, u1) {
  const mid = uvt.filter((x) => x[0] >= uK + 0.2 * (u1 - uK) && x[0] <= uK + 0.75 * (u1 - uK));
  if (mid.length < 24) return null;
  const vs = mid.map((x) => x[1]);
  const a = pct(vs, 2);
  const b = pct(vs, 98);
  const N = Math.min(28, Math.max(10, Math.floor(mid.length / 6)));
  const cells = new Float64Array(N);
  for (const v of vs) cells[Math.min(N - 1, Math.max(0, Math.floor(((v - a) / (b - a || 1)) * N)))]++;
  // Light smoothing only where the sampling is dense enough to need none of it to show a finger.
  const sm = mid.length > N * 12 ? cells : cells.map((x, i) => (cells[Math.max(0, i - 1)] + 2 * x + cells[Math.min(N - 1, i + 1)]) / 4);
  const top = Math.max(...sm);
  // Runs of low cells inside the fingers' extent are gaps; each gap's middle is a boundary.
  const gaps = [];
  let start = -1;
  for (let i = 1; i < N - 1; i++) {
    const low = sm[i] <= GAP * top;
    if (low && start < 0) start = i;
    if ((!low || i === N - 2) && start >= 0) {
      const end = low ? i : i - 1;
      gaps.push(a + (((start + end) / 2 + 0.5) / N) * (b - a));
      start = -1;
    }
  }
  // Four fingers make three gaps (three fingers, as on some paws and claws, two: the ring finger goes unused).
  if (gaps.length !== 3 && gaps.length !== 2) return null;
  return gaps.sort((x, y) => y - x);
}

/**
 * Fit both hands of a skinned character. `meshes` are its meshes in the
 * skeleton's rest (bind) space, each { pos (xyz per vertex), J, W (four
 * influences per vertex, joint indices into `jointNames`) }, the first the one
 * measured. `world` maps joint name to fitted rest world { q, t } (rotations
 * the rig's); `rig` the same for the rig itself. `overrides` is the manifest's
 * `fixes.hands`. Weights are rewritten in place (J, W); returns the new world
 * positions of the moved finger joints and the measurements per side.
 */
export function fitHands({ meshes, jointNames, world, rig, overrides = {}, log = () => {} }) {
  const index = new Map(jointNames.map((n, i) => [n, i]));
  const moved = new Map();
  const data = {};
  for (const s of ['l', 'r']) {
    const n = names(s);
    const H = world.get(n.hand);
    if (!H || !n.fingers.flat().every((f) => world.has(f))) continue;
    const o = { ...overrides, ...(overrides[s] ?? {}) };
    delete o.l;
    delete o.r;
    const toLocal = (p) => qrot(qinv(H.q), sub(p, H.t));
    const toWorld = (p) => add(H.t, qrot(H.q, p));
    const chain = new Set([n.hand, ...n.fingers.flat(), ...n.thumb].map((x) => index.get(x)).filter((x) => x !== undefined));
    const hi = index.get(n.hand);
    const lower = index.get(n.lower);
    const ref = rigHand(rig, s);
    // Scale the hand about the wrist first (a hand too big for the grip).
    if (o.scale && o.scale !== 1) {
      for (const m of meshes) {
        for (let v = 0; v < m.pos.length / 3; v++) {
          const w = chainWeight(m.J, m.W, v, chain);
          if (!w) continue;
          const p = [m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]];
          const k = 1 + (o.scale - 1) * w;
          m.pos.set(toWorld(scale(toLocal(p), k)), v * 3);
        }
      }
    }
    // The hand's vertices: those its chain mostly holds (a hand left on the forearm by the skinning: the forearm's past the wrist).
    const pick = (m, loose) => {
      const out = [];
      for (let v = 0; v < m.pos.length / 3; v++) {
        const w = chainWeight(m.J, m.W, v, chain);
        const p = toLocal([m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]]);
        if (w >= 0.5 || (loose && p[1] > 0 && [0, 1, 2, 3].some((k) => m.J[v * 4 + k] === lower && m.W[v * 4 + k] >= 0.5))) out.push(v);
      }
      return out;
    };
    const main = meshes[0];
    let loose = false;
    let verts = pick(main, false);
    if (verts.length < 30) {
      loose = true;
      verts = pick(main, true);
    }
    const pts = verts.map((v) => toLocal([main.pos[v * 3], main.pos[v * 3 + 1], main.pos[v * 3 + 2]]));
    const hand = measureHand(pts, ref, o);
    if (!hand) {
      log(`hand_${s}: too few vertices to measure (${pts.length}); left as it was`);
      continue;
    }
    const { along, across, palmSide, u0, u1, span, width, thickness, vP, tP, at } = hand;
    const uK = u0 + KNUCKLE_AT * span;
    const closed = hand.open < MIN_OPEN && o.curl === undefined;
    const gaps = closed ? null : fingerGaps(hand.uvt, uK, u1);
    const mode = closed ? 'none' : gaps ? 'split' : 'mitten';
    // How far the fingers close in the game: open hands all the way; a mitten bends once, so further at that one bend.
    const curl = o.curl ?? (closed ? 0 : round(hand.open * (mode === 'mitten' ? 1.6 : 1)));
    // Joints: knuckles on the knuckle line, spread across the hand (each split finger at its own middle).
    const lanes = [0.375, 0.125, -0.125, -0.375].map((k) => vP + k * width);
    const groupOf = (v) => {
      if (!gaps) return 1;
      const g = gaps.findIndex((b) => v > b);
      const i = g < 0 ? gaps.length : g;
      // Three fingers: index, middle, pinky.
      return gaps.length === 2 && i === 2 ? 3 : i;
    };
    if (gaps) {
      for (let f = 0; f < 4; f++) {
        const mine = hand.uvt.filter((x) => x[0] > uK && groupOf(x[1]) === f).map((x) => x[1]);
        if (mine.length >= 3) lanes[f] = pct(mine, 50);
      }
    }
    const tips = FINGERS.map((_, f) => {
      const mine = hand.uvt.filter((x) => x[0] > uK && groupOf(x[1]) === f).map((x) => x[0]);
      return gaps && mine.length >= 3 ? Math.max(uK + 0.02, pct(mine, 97)) : u1;
    });
    n.fingers.forEach((jointsOf, f) => {
      const len = Math.max(0.015, tips[f] - uK);
      const base = at(uK, lanes[f], tP);
      moved.set(jointsOf[0], toWorld(base));
      FINGER_JOINTS.forEach((k, i) => moved.set(jointsOf[i + 1], toWorld(add(base, scale(along, k * len)))));
    });
    // The thumb: the rig's, scaled to this hand's span and set on this palm.
    const k = span / Math.max(1e-6, ref.fingers[1][3][1] - 0);
    const refPalm = scale(ref.knuckle, PALM_AT / KNUCKLE_AT);
    const toFrame = (p) => {
      const r = sub(p, refPalm);
      return add(hand.palm, add(add(scale(along, dot(r, ref.along) * k), scale(across, dot(r, ref.across) * k)), scale(palmSide, dot(r, ref.palmSide) * k)));
    };
    n.thumb.forEach((name, i) => moved.set(name, toWorld(toFrame(ref.thumb[i]))));

    // Weights: what the hand chain holds is shared out again, so running this twice gives the same.
    const fingerIdx = n.fingers.map((c) => c.slice(0, 3).map((x) => index.get(x)));
    const band = 0.1 * span;
    let weighted = 0;
    for (const m of meshes) {
      const mine = m === main ? verts : pick(m, loose);
      for (const v of mine) {
        const p = toLocal([m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]]);
        const u = dot(p, along);
        const acc = new Map();
        let held = 0;
        for (let q = 0; q < 4; q++) {
          const j = m.J[v * 4 + q];
          const w = m.W[v * 4 + q];
          if (!w) continue;
          if (chain.has(j) || (loose && j === lower && u > 0)) held += w;
          else acc.set(j, (acc.get(j) ?? 0) + w);
        }
        const put = (j, w) => w > 1e-4 && acc.set(j, (acc.get(j) ?? 0) + w);
        const past = mode === 'none' ? 0 : smooth(uK - band, uK + band, u);
        put(hi, held * (1 - past));
        if (past > 0) {
          if (mode === 'mitten') put(fingerIdx[1][0], held * past);
          else {
            const f = groupOf(dot(p, across));
            const len = Math.max(0.015, tips[f] - uK);
            const b = 0.08 * len;
            const s2 = smooth(uK + FINGER_JOINTS[0] * len - b, uK + FINGER_JOINTS[0] * len + b, u);
            const s3 = smooth(uK + FINGER_JOINTS[1] * len - b, uK + FINGER_JOINTS[1] * len + b, u);
            put(fingerIdx[f][0], held * past * (1 - s2));
            put(fingerIdx[f][1], held * past * s2 * (1 - s3));
            put(fingerIdx[f][2], held * past * s2 * s3);
          }
          weighted++;
        }
        const top = [...acc].sort((a, b) => b[1] - a[1]).slice(0, 4);
        const sum = top.reduce((x, [, w]) => x + w, 0) || 1;
        for (let q = 0; q < 4; q++) {
          m.J[v * 4 + q] = top[q]?.[0] ?? 0;
          m.W[v * 4 + q] = top[q] ? top[q][1] / sum : 0;
        }
      }
    }
    data[s] = {
      palm: hand.palm.map(round),
      dir: along.map(round),
      across: across.map(round),
      palmSide: palmSide.map(round),
      length: round(u1),
      width: round(width),
      thickness: round(thickness),
      curl,
      fingers: mode,
    };
    log(`hand_${s}: ${pts.length} vertices${loose ? ' (some taken from the forearm)' : ''}, ${(span * 100).toFixed(1)} cm long, ${(width * 100).toFixed(1)} wide, ${(thickness * 100).toFixed(1)} thick: ${mode}${mode === 'none' ? ' (already closed)' : `, curl ${curl}, ${weighted} vertices on the fingers`}`);
  }
  return { moved, data };
}
