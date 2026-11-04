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
//   whose fingers can't be told apart curls as one wide finger (the middle finger's chain). A hand that is already closed
//   (a fist, a gauntlet) is left rigid: curling it would fold it in two;
// - returns the measurements for the game (CharacterAnimator puts the measured palm, not the rig's, on
//   the grip, and sets the grip's offset from the hand's thickness), written as `extras.hand` on the
//   hand joints.
// The thumb stays on the hand joint (the game never curls it; its joints move to fit the hand).
// Manifest overrides (`fixes.hands`: palm, curl, scale, wrist, or per side under l / r) cover the odd model.
// A look's own finger weighting (`fixes.skin`, skinfix.mjs: tips, knuckle, joints, lanes, fingers) changes how the
// fingers are weighted, for that look only; without it every hand is weighted as before.

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
/**
 * Thickness against span: an open hand is thin (the mannequin's 0.12); a Meshy hand modelled relaxed, its
 * fingers a little bent, measures 0.3 to 0.45 and still closes on a grip; a fist or gauntlet is thicker.
 */
const OPEN = 0.35;
const CLOSED = 0.6;
/**
 * Only a compact block is already closed (curling would only crumple it): thick for its span AND about as long
 * as it is wide (an open hand is twice as long as wide; Hector's relaxed hand, 0.38 thick for its span and 1.75
 * times as long as wide, was taken for a fist and left flat on the gun).
 */
const FIST_THICK = 0.5;
const FIST_LONG = 1.5;
/** ...or a block this thick for its span, whatever its width. */
const FIST_BLOCK = 0.65;
/** The most a hand's curl grows for fingers longer than the rig's. */
const LONG_CURL = 1.5;
/** A hand whose own flat agrees less than this with the rig's palm is turned on its joint (a quarter turn: palm forward). */
const TURNED = 0.7;
/** Vertices further than this from the hand's centre, in multiples of the 80th percentile, are strays (a strap, a cape's edge). */
const STRAY = 1.6;
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

/** The thinnest direction of a cloud of points (the normal of its best-fit plane). */
function thinnest(pts) {
  const c = scale(pts.reduce((a, p) => add(a, p), [0, 0, 0]), 1 / pts.length);
  const C = [0, 0, 0, 0, 0, 0];
  for (const p of pts) {
    const [x, y, z] = sub(p, c);
    C[0] += x * x;
    C[1] += y * y;
    C[2] += z * z;
    C[3] += x * y;
    C[4] += x * z;
    C[5] += y * z;
  }
  // The smallest eigenvector: power iteration on (trace - C).
  const tr = C[0] + C[1] + C[2];
  let v = norm([0.31, 0.53, 0.79]);
  for (let i = 0; i < 100; i++) v = norm(sub(scale(v, tr), [C[0] * v[0] + C[3] * v[1] + C[4] * v[2], C[3] * v[0] + C[1] * v[1] + C[5] * v[2], C[4] * v[0] + C[5] * v[1] + C[2] * v[2]]));
  return v;
}

/**
 * The hand's core: its centre and how far from it a vertex may be (further: a stray, a strap, a cape's edge or
 * a hem the skinning left on the hand).
 */
export function handCore(pts) {
  const centre = scale(pts.reduce((a, p) => add(a, p), [0, 0, 0]), 1 / Math.max(1, pts.length));
  const d = pts.map((p) => Math.hypot(...sub(p, centre)));
  return { centre, reach: pts.length < 12 ? Infinity : pct(d, 80) * STRAY };
}

/**
 * Measure one hand. `pts` are its vertices in the hand joint's space; `ref`
 * is rigHand() for this side; `front` the body's front (+z of the model) in
 * that space. Returns the hand's frame and size, in that space.
 */
export function measureHand(all, ref, override = {}, front = null, cuffChecked = false) {
  if (all.length < 12) return null;
  const body = handCore(all);
  const pts = all.filter((p) => Math.hypot(...sub(p, body.centre)) <= body.reach);
  if (pts.length < 12) return null;
  if (!cuffChecked) {
    // A cuff the skinning left on the hand (King Aldric's fur cuffs) is measured out: the hand starts past it.
    // Dense and as wide as the hand, it held the knuckle line inside itself, so the cuff took the finger weights
    // and curled into flaps.
    const from = cuffEnd(pts, ref);
    if (from !== null) {
      const m = measureHand(pts.filter((p) => dot(p, ref.along) >= from), ref, override, front, true);
      // The cuff stays in the hand's core (it goes back on the hand joint, rigid).
      if (m) return { ...m, cuff: from, core: body };
    }
  }
  const ys = pts.map((p) => p[1]);
  // The finger direction: from the wrist end of the hand to its far end (kept within 45° of the forearm's line).
  const lo = pct(ys, 30);
  const hi = pct(ys, 70);
  const mean = (list) => scale(list.reduce((a, p) => add(a, p), [0, 0, 0]), 1 / Math.max(1, list.length));
  let along = norm(sub(mean(pts.filter((p) => p[1] >= hi)), mean(pts.filter((p) => p[1] <= lo))));
  if (dot(along, ref.along) < Math.SQRT1_2 || !Number.isFinite(along[0])) along = ref.along;
  // Palm side from the rig's, square to the finger direction (most Meshy hands sit as the rig's do, palm down in
  // the T-pose)... unless the hand's own flat says it is turned on its joint (the dapper's, the Knight's: a quarter
  // turn): then its flat, the palm facing the body's front (a T-pose hand turned a quarter is thumb up, palm forward).
  const rigPalm = norm(sub(ref.palmSide, scale(along, dot(ref.palmSide, along))));
  const own = thinnest(pts);
  const flat = norm(sub(own, scale(along, dot(own, along))));
  const turned = !override.palm && front && Number.isFinite(flat[0]) && Math.abs(dot(flat, rigPalm)) < TURNED;
  const palmSide = turned ? scale(flat, dot(flat, front) >= 0 ? 1 : -1) : rigPalm;
  // Across (pinky to index) with the rig's handedness.
  const hand = dot(cross(ref.palmSide, ref.along), ref.across) < 0 ? -1 : 1;
  const c = scale(norm(cross(palmSide, along)), hand);
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
  // Open or closed: thickness against span, and a fist is as long as it is wide.
  const open = 1 - smooth(OPEN, CLOSED, thickness / span);
  const fist = thickness / span > FIST_BLOCK || (thickness / span > FIST_THICK && span / width < FIST_LONG);
  return { along, across: c, palmSide, u0, u1, span, width, thickness, uP, vP, tP, palm, open, fist, turned, core: body, at, uvt };
}

/** A slice across the hand this round (thick through the palm against wide across it) is a cuff, not a hand. */
const CUFF_ROUND = 0.75;
/** ...and a cuff takes at most this share of the hand's length (past it: a fist, a block, left alone). */
const CUFF_MOST = 0.55;
/** ...and holds this many times as many vertices for its length as the hand past it. */
const CUFF_DENSE = 3;
/**
 * Where a cuff at the wrist end of a hand ends (along the rig's finger direction, the hand joint's space), or
 * null. The hand is cut into slices along its length; from the wrist end, slices as thick through the palm as
 * they are wide across (a ring round the wrist) are the cuff, the flat ones the hand.
 */
export function cuffEnd(pts, ref) {
  const across = ref.across;
  const palm = ref.palmSide;
  const us = pts.map((p) => dot(p, ref.along));
  const lo = pct(us, 2);
  const hi = pct(us, 98);
  const N = 10;
  const step = (hi - lo) / N;
  if (!(step > 0)) return null;
  let end = null;
  for (let i = 0; i < N; i++) {
    const slice = pts.filter((_, k) => us[k] >= lo + i * step && us[k] < lo + (i + 1) * step);
    if (slice.length < 6) break;
    const vs = slice.map((p) => dot(p, across));
    const ts = slice.map((p) => dot(p, palm));
    const v = pct(vs, 92) - pct(vs, 8);
    const t = pct(ts, 92) - pct(ts, 8);
    // Round whichever way the hand lies on its joint (a hand turned a quarter is wide through the rig's palm).
    if (Math.min(t, v) < CUFF_ROUND * Math.max(t, v, 1e-6)) break;
    end = lo + (i + 1) * step;
  }
  if (end === null || end - lo > CUFF_MOST * (hi - lo)) return null;
  // ...and much denser than the hand past it (a wrist is round too, but no denser than the palm: a cuff the cut
  // kept detailed beside a hand it left a few dozen vertices, as on King Aldric's).
  const past = us.filter((u) => u >= end).length;
  const before = us.filter((u) => u >= lo && u < end).length;
  if (past < 12 || before / (end - lo) < CUFF_DENSE * (past / Math.max(1e-6, hi - end))) return null;
  return end;
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
 * `fixes.hands`, `skin` its `fixes.skin` finger options (skinfix.mjs fingerSkin), `sides` the hands to fit (both
 * unless set). Weights are rewritten in place (J, W); returns the new world
 * positions of the moved finger joints and the measurements per side.
 */
export function fitHands({ meshes, jointNames, world, rig, overrides = {}, skin = {}, sides = ['l', 'r'], log = () => {} }) {
  const index = new Map(jointNames.map((n, i) => [n, i]));
  const moved = new Map();
  const data = {};
  for (const s of sides) {
    const n = names(s);
    const H = world.get(n.hand);
    if (!H || !n.fingers.flat().every((f) => world.has(f))) continue;
    const o = { ...overrides, ...(overrides[s] ?? {}) };
    delete o.l;
    delete o.r;
    // This look's finger weighting (fixes.skin; defaults: as every other look's).
    const sk = { ...skin, ...(skin?.[s] ?? {}) };
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
    const hand = measureHand(pts, ref, o, qrot(qinv(H.q), [0, 0, 1]));
    if (!hand) {
      log(`hand_${s}: too few vertices to measure (${pts.length}); left as it was`);
      continue;
    }
    const { along, across, palmSide, u0, u1, span, width, thickness, vP, tP, at } = hand;
    const uK = u0 + KNUCKLE_AT * span;
    const closed = hand.fist && o.curl === undefined;
    // `mitten`: the fingers bend together even where gaps are found (a thumb or a fold read as a gap crumpled them).
    // (`fixes.skin.fingers: 'lanes'`: fused fingers, no gaps to find, split evenly across the hand into four.)
    const lanesOnly = !closed && sk.fingers === 'lanes';
    const gaps = lanesOnly ? [0.25, 0, -0.25].map((k) => vP + k * width) : closed || o.mitten ? null : fingerGaps(hand.uvt, uK, u1);
    const mode = closed ? 'none' : gaps ? 'split' : 'mitten';
    // How far the fingers close in the game: open hands all the way. A mitten curls as one wide finger, at the
    // knuckle line and at the two joints along it (bent once at the knuckles, as it was, it stood out from the gun
    // as a flat paddle: the support hands under a handguard, King Aldric's, Dusty Colt's).
    // (Even a thick hand that isn't a fist closes some way: a block that can't curl lies flat on the gun.)
    // Long fingers (a frog's, a monkey's) curl further, so their tips come round to the grip rather than stand
    // open past it: by their length against the rig's, up to LONG_CURL.
    const fingerLen = u1 - uK;
    const rigFinger = Math.hypot(...ref.fingers[1][3]) - Math.hypot(...ref.fingers[1][0]);
    const long = Math.min(LONG_CURL, Math.max(1, fingerLen / Math.max(1e-6, rigFinger)));
    const curl = o.curl ?? (closed ? 0 : round(Math.max(0.5, hand.open) * long));
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
    const band = (sk.knuckle ?? 0.1) * span;
    // Each finger's share of a vertex across the hand: its own finger's, or (`fixes.skin.lanes`) blended with the
    // next finger's near the boundary between them (half each on it), so split fingers bend apart without tearing.
    // (Fingers in order across the hand, index side first: three fingers, as on some paws and claws, skip the ring.)
    const order = gaps ? (gaps.length === 3 ? [0, 1, 2, 3] : [0, 1, 3]) : null;
    const spacing = width / 4;
    const sharesOf = (v) => {
      const f = mode === 'mitten' ? 1 : groupOf(v);
      if (!order || !sk.lanes) return [[f, 1]];
      const reach = sk.lanes * spacing;
      const k = order.indexOf(f);
      // The boundary on the index side of this finger (gaps[k - 1]) and on its pinky side (gaps[k]).
      for (const [b, other] of [[gaps[k - 1], order[k - 1]], [gaps[k], order[k + 1]]]) {
        if (b === undefined || other === undefined) continue;
        const d = Math.abs(v - b);
        if (d < reach) {
          const share = 0.5 * (1 - smooth(0, reach, d));
          return [[f, 1 - share], [other, share]];
        }
      }
      return [[f, 1]];
    };
    let weighted = 0;
    for (const m of meshes) {
      const mine = m === main ? verts : pick(m, loose);
      for (const v of mine) {
        const p = toLocal([m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]]);
        const u = dot(p, along);
        // A stray keeps its weights (armweights.mjs gives it to the body it hangs from)... except (`fixes.skin.tips`)
        // past the knuckle line, no further out than this share of the hand's span past the fingertips: a long
        // fingertip measured out as a stray stayed on the hand while the rest of its finger curled (Zombie Soldier
        // A's needle).
        if (Math.hypot(...sub(p, hand.core.centre)) > hand.core.reach && !(sk.tips && mode !== 'none' && u > uK && u < u1 + sk.tips * span)) continue;
        const acc = new Map();
        let held = 0;
        for (let q = 0; q < 4; q++) {
          const j = m.J[v * 4 + q];
          const w = m.W[v * 4 + q];
          if (!w) continue;
          // (`wrist`: the skin past the wrist joint rides the hand alone, none of it eased into the forearm: a stubby
          // paw blended into its forearm folds at the wrist when the hand turns hard onto a gun pointed at the ground.)
          if (chain.has(j) || ((loose || o.wrist) && j === lower && u > 0)) held += w;
          else acc.set(j, (acc.get(j) ?? 0) + w);
        }
        const put = (j, w) => w > 1e-4 && acc.set(j, (acc.get(j) ?? 0) + w);
        const past = mode === 'none' ? 0 : smooth(uK - band, uK + band, u);
        put(hi, held * (1 - past));
        if (past > 0) {
          for (const [f, share] of sharesOf(dot(p, across))) {
            const len = Math.max(0.015, tips[f] - uK);
            // (`fixes.skin.joints`: a wider blend at each finger joint, so a long thin finger bends round, not in kinks.)
            const b = (sk.joints ?? 0.08) * len;
            const s2 = smooth(uK + FINGER_JOINTS[0] * len - b, uK + FINGER_JOINTS[0] * len + b, u);
            const s3 = smooth(uK + FINGER_JOINTS[1] * len - b, uK + FINGER_JOINTS[1] * len + b, u);
            const h = held * past * share;
            put(fingerIdx[f][0], h * (1 - s2));
            put(fingerIdx[f][1], h * s2 * (1 - s3));
            put(fingerIdx[f][2], h * s2 * s3);
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
    log(`hand_${s}: ${pts.length} vertices${loose ? ' (some taken from the forearm)' : ''}, ${(span * 100).toFixed(1)} cm long, ${(width * 100).toFixed(1)} wide, ${(thickness * 100).toFixed(1)} thick${hand.turned ? ', turned on its joint' : ''}${hand.cuff !== undefined ? ', a cuff at the wrist left out' : ''}: ${mode}${mode === 'none' ? ' (already closed)' : `, curl ${curl}, ${weighted} vertices on the fingers`}`);
  }
  return { moved, data };
}
