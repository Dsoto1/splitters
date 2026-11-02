// Skin weights cleaned in the download's own pose, before it is turned to the rig's T-pose (prepare-meshy-characters.mjs
// pose()), and the triangles that turn tears apart (`fixes.skinClean`, on by default; false keeps the weights as they
// come).
//
// Meshy's downloads mostly stand with the arms down, hands against the hips and wide sleeves against the body. Their
// weights (Meshy's rigging, and our own bone heat on unrigged downloads) leak across those contacts: hand and finger
// vertices partly on the hips or a thigh, the inside of a sleeve partly on the spine, the side of a coat partly on the
// hand. Turning the arms out to the T-pose then drags each such vertex part of the way between the arm and the hip,
// and the mesh grows long sheets and strands from the hands to the hips (Giggles' and the Dust Trooper's "sleeve
// spikes", Luther Vanguard's threads from his fingertips, Goblina's hands smeared into flaps); every clip that lifts
// the arms (the gun holds, running) waves them about.
//
// The rule, per vertex: the side it belongs to is the arm or the body, whichever's bones it is nearer (only asked when
// both hold it); the heaviest joint on that side is its anchor, and only joints within HOPS of the anchor on the rig's
// skeleton keep their share (a hand keeps its forearm and upper arm, never the hips; a torso side keeps the chest and
// the clavicle, never the forearm); the other arm never. Then, after the turn to the T-pose, a triangle whose edges
// stretched far past their length in the download joined two parts that only touched there (a fingertip fused to a
// thigh, a sleeve fused to the coat): it is dropped (`tear`).

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** The rig's skeleton (prepare-meshy-characters.mjs JOINT_MAP's targets), child to parent. */
export const RIG_PARENT = {
  pelvis: null,
  spine_01: 'pelvis',
  spine_02: 'spine_01',
  spine_03: 'spine_02',
  neck_01: 'spine_03',
  Head: 'neck_01',
  ...Object.fromEntries(
    ['l', 'r'].flatMap((s) => [
      [`clavicle_${s}`, 'spine_03'],
      [`upperarm_${s}`, `clavicle_${s}`],
      [`lowerarm_${s}`, `upperarm_${s}`],
      [`hand_${s}`, `lowerarm_${s}`],
      [`thigh_${s}`, 'pelvis'],
      [`calf_${s}`, `thigh_${s}`],
      [`foot_${s}`, `calf_${s}`],
      [`ball_${s}`, `foot_${s}`],
    ]),
  ),
};
/** How far along the skeleton (joints) from a vertex's anchor an influence may be. */
export const HOPS = 2;
/** A share at or below this is not "held" by a side when deciding which side a vertex belongs to. */
const BOTH = 0.05;
/** Skin faces away from a bone when its normal and the way out from the bone agree this much (cosine). */
const FACES = 0.2;
/** Arm-held skin facing the arm goes to the body only within this many times its distance to the arm (not a far coat). */
const BODY_REACH = 4;
/** A body rim against an arm reaching this share of the height below the shoulder joint (T-pose) is a side the arm hid. */
export const SIDE_DEPTH = 0.12;
/** A triangle is torn out where an edge grew past this many times its length in the download... */
export const TEAR = 3;
/** ...and is now longer than this share of the character's height. */
const TEAR_MIN = 0.03;

const RIG = Object.keys(RIG_PARENT);
const rigIndex = new Map(RIG.map((n, i) => [n, i]));
/** Joints apart on the rig's skeleton, every pair. */
const HOP = (() => {
  const n = RIG.length;
  const adj = RIG.map(() => []);
  RIG.forEach((c, i) => {
    const p = RIG_PARENT[c];
    if (p) {
      adj[i].push(rigIndex.get(p));
      adj[rigIndex.get(p)].push(i);
    }
  });
  const d = RIG.map(() => new Array(n).fill(Infinity));
  for (let s = 0; s < n; s++) {
    d[s][s] = 0;
    const q = [s];
    while (q.length) {
      const a = q.shift();
      for (const b of adj[a]) if (d[s][b] === Infinity) (d[s][b] = d[s][a] + 1), q.push(b);
    }
  }
  return d;
})();
const ARM = { l: new Set(['upperarm_l', 'lowerarm_l', 'hand_l'].map((n) => rigIndex.get(n))), r: new Set(['upperarm_r', 'lowerarm_r', 'hand_r'].map((n) => rigIndex.get(n))) };

/** Distance from p to the segment a-b. */
function toSegment(p, a, b) {
  return Math.hypot(...sub(p, onSegment(p, a, b)));
}
/** The point of the segment a-b nearest p. */
function onSegment(p, a, b) {
  const ab = sub(b, a);
  const t = Math.min(1, Math.max(0, dot(sub(p, a), ab) / (dot(ab, ab) || 1e-12)));
  return add(a, scale(ab, t));
}

/**
 * Clean the weights in place. `rig`: the rig joint each source joint's skin goes to (fingers and extras ride their
 * hand or ancestor); `parent`, `rest`: the source skeleton (parent indices, world positions in the download's pose);
 * `restAt(v)`, `restNrm(v)`: vertex v's position and normal in that pose; `J`, `W`: four influences per vertex (source
 * joint indices; an arm-held vertex found to be body skin takes the nearest body vertex's row whole).
 * Returns how many vertices changed.
 */
export function cleanSkin({ rig, parent, rest, restAt, restNrm, count, J, W, indices = null }) {
  // Each rig joint at its shallowest source joint (the hand, not a finger mapped to it).
  const depth = (i) => {
    let d = 0;
    for (let p = parent[i]; p >= 0; p = parent[p]) d++;
    return d;
  };
  const at = new Map();
  const atDepth = new Map();
  rig.forEach((r, i) => {
    if (!rigIndex.has(r)) return;
    const d = depth(i);
    if (!at.has(r) || d < atDepth.get(r)) (at.set(r, rest[i]), atDepth.set(r, d));
  });
  // Bones as segments: each rig joint to its rig children; the ends (hand, head, ball) carried on a little past.
  const segs = new Map(RIG.map((n) => [n, []]));
  for (const c of RIG) {
    const p = RIG_PARENT[c];
    if (p && at.has(p) && at.has(c)) segs.get(p).push([at.get(p), at.get(c)]);
  }
  for (const [end, from, k] of [['hand_l', 'lowerarm_l', 0.45], ['hand_r', 'lowerarm_r', 0.45], ['ball_l', 'foot_l', 0.5], ['ball_r', 'foot_r', 0.5], ['Head', 'neck_01', 1]]) {
    if (at.has(end) && at.has(from)) segs.get(end).push([at.get(end), add(at.get(end), scale(sub(at.get(end), at.get(from)), k))]);
  }
  for (const n of RIG) if (at.has(n) && !segs.get(n).length) segs.get(n).push([at.get(n), at.get(n)]);
  /** The nearest point of these joints' bones to p, and how far. */
  const nearest = (p, names) => {
    let best = { d: Infinity, at: p };
    for (const n of names)
      for (const [a, b] of segs.get(RIG[n]) ?? []) {
        const at = onSegment(p, a, b);
        const d = Math.hypot(...sub(p, at));
        if (d < best.d) best = { d, at };
      }
    return best;
  };
  /** How much the skin at p (facing n) faces away from a bone at `at` (1: straight out, -1: back at it). */
  const facing = (p, n, at) => {
    const out = sub(p, at);
    return dot(out, n) / ((Math.hypot(...out) || 1) * (Math.hypot(...n) || 1));
  };
  const bodyJoints = RIG.map((_, i) => i).filter((i) => !ARM.l.has(i) && !ARM.r.has(i) && at.has(RIG[i]));

  let changed = 0;
  const isBody = new Uint8Array(count);
  /** Per vertex: its rig joints' summed shares, the arm side it leans to, and the heaviest joint passing a test. */
  const read = (v) => {
    const acc = new Map();
    for (let k = 0; k < 4; k++) {
      const w = W[v * 4 + k];
      if (!w) continue;
      const u = rigIndex.get(rig[J[v * 4 + k]]) ?? 0;
      acc.set(u, (acc.get(u) ?? 0) + w);
    }
    const sideW = { l: 0, r: 0, body: 0 };
    for (const [u, w] of acc) sideW[ARM.l.has(u) ? 'l' : ARM.r.has(u) ? 'r' : 'body'] += w;
    const s = sideW.l >= sideW.r ? 'l' : 'r';
    const heaviest = (pick) => {
      let best = -1;
      for (const [u, w] of acc) if (pick(u) && (best < 0 || w > acc.get(best))) best = u;
      return best;
    };
    return { sideW, s, heaviest };
  };
  const onBody = (u) => !ARM.l.has(u) && !ARM.r.has(u);
  /** Keep only the joints within HOPS of the anchor (never the other arm), shares renormalised. */
  const settle = (v, anchor, s) => {
    if (onBody(anchor)) isBody[v] = 1;
    const other = ARM[s === 'l' ? 'r' : 'l'];
    const keepJoint = (u) => HOP[anchor][u] <= HOPS && !(other.has(u) && !other.has(anchor));
    let dropped = false;
    let sum = 0;
    for (let k = 0; k < 4; k++) {
      const w = W[v * 4 + k];
      if (!w) continue;
      if (keepJoint(rigIndex.get(rig[J[v * 4 + k]]) ?? 0)) sum += w;
      else dropped = true;
    }
    if (!dropped || sum <= 0) return;
    for (let k = 0; k < 4; k++) {
      const w = W[v * 4 + k];
      if (w) W[v * 4 + k] = keepJoint(rigIndex.get(rig[J[v * 4 + k]]) ?? 0) ? w / sum : 0;
    }
    changed++;
  };
  /** Arm-held vertices whose facing says body skin: decided below, by the patch they make. */
  const facesArm = [];
  for (let v = 0; v < count; v++) {
    const { sideW, s, heaviest } = read(v);
    let anchor = heaviest(() => true);
    if (sideW[s] > BOTH) {
      // Held by an arm (and maybe the body): whose skin is it? Skin faces away from its own bone: the inside of a
      // sleeve faces the body, the body's side under a hanging arm faces the arm. Where that doesn't tell, the
      // nearer bone.
      const p = restAt(v);
      const n = restNrm(v);
      const arm = nearest(p, ARM[s]);
      const body = nearest(p, bodyJoints);
      const [fa, fb] = [facing(p, n, arm.at), facing(p, n, body.at)];
      if (fb > FACES && fa < -FACES && body.d < BODY_REACH * arm.d) {
        facesArm.push(v);
        continue;
      }
      const onArm = (fa > FACES && fb < 0) || arm.d <= body.d;
      if (sideW.body > BOTH) anchor = onArm ? heaviest((u) => ARM[s].has(u)) : heaviest(onBody);
    }
    settle(v, anchor, s);
  }
  // Body skin is joined to the body: a patch of such vertices whose rim runs mostly along the body is the body's side
  // (the arm lay over it); one whose rim runs mostly along the arm is the inside of a wide sleeve or cuff, which faces
  // its own bone the same way (it stays on the arm).
  const adopt = [];
  if (facesArm.length) {
    const inPatch = new Int32Array(count).fill(-1);
    facesArm.forEach((v) => (inPatch[v] = 0));
    const nbr = new Map(facesArm.map((v) => [v, []]));
    if (indices)
      for (let t = 0; t < indices.length; t += 3)
        for (let e = 0; e < 3; e++) {
          const [a, b] = [indices[t + e], indices[t + ((e + 1) % 3)]];
          if (nbr.has(a)) nbr.get(a).push(b);
          if (nbr.has(b)) nbr.get(b).push(a);
        }
    let patch = 0;
    for (const v0 of facesArm) {
      if (inPatch[v0] !== 0) continue;
      patch++;
      const members = [];
      const todo = [v0];
      inPatch[v0] = patch;
      let [toBody, toArm] = [0, 0];
      while (todo.length) {
        const v = todo.pop();
        members.push(v);
        for (const u of nbr.get(v)) {
          if (inPatch[u] === 0) (inPatch[u] = patch), todo.push(u);
          else if (inPatch[u] < 0) isBody[u] ? toBody++ : toArm++;
        }
      }
      for (const v of members) {
        const { sideW, s, heaviest } = read(v);
        if (toBody <= toArm) settle(v, heaviest((u) => ARM[s].has(u)), s);
        else if (sideW.body > BOTH) settle(v, heaviest(onBody), s);
        else adopt.push(v);
      }
    }
  }
  if (adopt.length) {
    // The nearest body vertex's weights (a grid over the body's vertices).
    const P = (v) => restAt(v);
    let cell = 0;
    for (const v of adopt.slice(0, 50)) cell = Math.max(cell, nearest(P(v), bodyJoints).d);
    cell = Math.max(cell / 2, 1e-4);
    const grid = new Map();
    const key = (p) => p.map((x) => Math.floor(x / cell)).join(',');
    for (let v = 0; v < count; v++) {
      if (!isBody[v]) continue;
      const k = key(P(v));
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(v);
    }
    for (const v of adopt) {
      const p = P(v);
      const c = p.map((x) => Math.floor(x / cell));
      let best = -1;
      let bd = Infinity;
      for (let r = 0; r < 8 && best < 0; r++)
        for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) for (let k = -r; k <= r; k++) {
          if (Math.max(Math.abs(i), Math.abs(j), Math.abs(k)) !== r) continue;
          for (const b of grid.get(`${c[0] + i},${c[1] + j},${c[2] + k}`) ?? []) {
            const d = Math.hypot(...sub(P(b), p));
            if (d < bd) (bd = d), (best = b);
          }
        }
      if (best < 0) continue;
      for (let k = 0; k < 4; k++) (J[v * 4 + k] = J[best * 4 + k]), (W[v * 4 + k] = W[best * 4 + k]);
      changed++;
    }
  }
  return changed;
}

/**
 * Triangles to keep after the turn to the T-pose: those whose every edge kept within TEAR times its length in the
 * download (`from`: positions in the download's pose; `to`: turned, `k` the scale from one to the other, `height`
 * the character's height in `to`'s units), but those `spare` keeps (an armpit's skin rightly stretches as the arm
 * comes up). Returns { indices, torn }.
 */
export function tearStretched(indices, from, to, k, height, spare = () => false) {
  const bad = stretched(from, to, k, height);
  const out = [];
  let torn = 0;
  for (let t = 0; t < indices.length; t += 3) {
    if (!spare(indices[t], indices[t + 1], indices[t + 2]) && bad(indices[t], indices[t + 1], indices[t + 2])) torn++;
    else out.push(indices[t], indices[t + 1], indices[t + 2]);
  }
  return { indices: new indices.constructor(out), torn };
}

/** Whether a triangle (three vertices) has an edge the turn stretched past TEAR (tearStretched). */
export function stretched(from, to, k, height) {
  const len = (A, a, b) => Math.hypot(A[a * 3] - A[b * 3], A[a * 3 + 1] - A[b * 3 + 1], A[a * 3 + 2] - A[b * 3 + 2]);
  return (a, b, c) => {
    for (const [x, y] of [[a, b], [b, c], [c, a]]) {
      const now = len(to, x, y);
      if (now > TEAR_MIN * height && now > TEAR * len(from, x, y) * k) return true;
    }
    return false;
  };
}

/**
 * Close the holes the turn opened, each with a fan round its middle in one flat colour (from inside a triangle by the
 * rim vertex nearest the middle: the rim's own UVs would stretch the texture across unrelated charts):
 * - the tear's: each new rim (a hand torn off a thigh leaves one in each) cut into runs on one side (an arm or the
 *   body, by its weights: `side(v)` 'l', 'r' or 'body');
 * - the body's sides an arm covered: where the download's arm hung inside a cape or a coat, the body has no side under
 *   it, and its rim against the arm's skin reaches well down the side (`deep(ring)`, positions in `pos`), not round the
 *   shoulder only. Closed on the body (hidden while the arm is down, the body's side when it comes up).
 * Vertices are matched by place and side (texture seams split them). Returns the new arrays.
 */
export function capTears({ before, after, pos, nrm, uv, J, W, side, deep = () => false }) {
  const ids = new Map();
  const id = new Int32Array(pos.length / 3);
  for (let v = 0; v < id.length; v++) {
    const k = `${Math.round(pos[v * 3] * 1e5)},${Math.round(pos[v * 3 + 1] * 1e5)},${Math.round(pos[v * 3 + 2] * 1e5)},${side(v)}`;
    if (!ids.has(k)) ids.set(k, v);
    id[v] = ids.get(k);
  }
  const key = (a, b) => (id[a] < id[b] ? `${id[a]},${id[b]}` : `${id[b]},${id[a]}`);
  const uses = (I, pick = () => true) => {
    const m = new Map();
    for (let t = 0; t < I.length; t += 3) {
      if (!pick(t)) continue;
      for (let e = 0; e < 3; e++) {
        const k = key(I[t + e], I[t + ((e + 1) % 3)]);
        m.set(k, (m.get(k) ?? 0) + 1);
      }
    }
    return m;
  };
  /** Chains of directed rim edges (a to b, as their kept triangle runs them). */
  const chains = (next) => {
    const prev = new Map([...next].map(([a, b]) => [b, a]));
    const out = [];
    const seen = new Set();
    for (const start of next.keys()) {
      if (seen.has(start)) continue;
      // Walk back to a chain's first vertex (or once round a loop).
      let s = start;
      for (let guard = 0; prev.has(s) && prev.get(s) !== start && guard < next.size; guard++) s = prev.get(s);
      if (prev.get(s) === start) s = start;
      const chain = [s];
      for (let v = s; next.has(v) && !seen.has(v); v = next.get(v)) {
        seen.add(v);
        chain.push(next.get(v));
        if (next.get(v) === s) break;
      }
      out.push(chain);
    }
    return out;
  };
  const runs = [];
  // The tear's rims.
  {
    const was = uses(before);
    const now = uses(after);
    const next = new Map();
    for (let t = 0; t < after.length; t += 3) for (let e = 0; e < 3; e++) {
      const [a, b] = [id[after[t + e]], id[after[t + ((e + 1) % 3)]]];
      const k = key(a, b);
      if (now.get(k) === 1 && was.get(k) !== 1 && !next.has(a)) next.set(a, b);
    }
    for (const chain of chains(next)) {
      // Runs of edges with both ends on one side.
      let run = [];
      for (let i = 0; i + 1 < chain.length; i++) {
        const [a, b] = [chain[i], chain[i + 1]];
        if (side(a) === side(b) && (!run.length || side(run[0][0]) === side(a))) run.push([a, b]);
        else {
          if (run.length >= 3) runs.push(run);
          run = side(a) === side(b) ? [[a, b]] : [];
        }
      }
      if (run.length >= 3) runs.push(run);
    }
  }
  const tears = runs.length;
  // The body's rims against the arms.
  {
    const isBody = (t) => side(after[t]) === 'body' && side(after[t + 1]) === 'body' && side(after[t + 2]) === 'body';
    const inBody = uses(after, isBody);
    const all = uses(after);
    const next = new Map();
    for (let t = 0; t < after.length; t += 3) {
      if (!isBody(t)) continue;
      for (let e = 0; e < 3; e++) {
        const [a, b] = [id[after[t + e]], id[after[t + ((e + 1) % 3)]]];
        const k = key(a, b);
        if (inBody.get(k) === 1 && all.get(k) >= 2 && !next.has(a)) next.set(a, b);
      }
    }
    if (process.env.CAP_DEBUG) console.log(`  sockets: ${next.size} rim edges, chains ${chains(next).map((c) => `${c.length}${c[0] === c[c.length - 1] ? 'o' : '-'}${deep(c) ? 'D' : ''}`).join(' ')}`);
    for (const chain of chains(next)) {
      if (chain.length < 4 || chain[0] !== chain[chain.length - 1] || !deep(chain)) continue;
      const run = [];
      for (let i = 0; i + 1 < chain.length; i++) run.push([chain[i], chain[i + 1]]);
      runs.push(run);
    }
  }
  if (!runs.length) return { pos, nrm, uv, J, W, indices: after, capped: 0, sides: 0 };
  const n0 = pos.length / 3;
  let extra = 0;
  for (const r of runs) extra += r.length + 2;
  const P2 = new Float32Array((n0 + extra) * 3);
  P2.set(pos);
  const N2 = new Float32Array((n0 + extra) * 3);
  N2.set(nrm);
  const U2 = new Float32Array((n0 + extra) * 2);
  U2.set(uv);
  const J2 = new J.constructor((n0 + extra) * 4);
  J2.set(J);
  const W2 = new Float32Array((n0 + extra) * 4);
  W2.set(W);
  const tris = Array.from(after);
  let n = n0;
  const p = (v) => [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
  for (const run of runs) {
    const ring = [run[0][0], ...run.map((e) => e[1])];
    const mid = scale(ring.reduce((s, v) => add(s, p(v)), [0, 0, 0]), 1 / ring.length);
    let near = ring[0];
    for (const v of ring) if (Math.hypot(...sub(p(v), mid)) < Math.hypot(...sub(p(near), mid))) near = v;
    // The cap's facing: the fan's (b, a, middle) turns, summed.
    let f = [0, 0, 0];
    for (const [a, b] of run) {
      const [u, w] = [sub(p(a), p(b)), sub(mid, p(b))];
      f = add(f, [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]);
    }
    f = scale(f, 1 / (Math.hypot(...f) || 1));
    // The colour: the middle of a triangle the nearest rim vertex keeps (inside its chart: a vertex's own texel sits on
    // the chart's edge, where the map bleeds into its empty background).
    let tex = [uv[near * 2], uv[near * 2 + 1]];
    for (let t = 0; t < after.length; t += 3)
      if (id[after[t]] === near || id[after[t + 1]] === near || id[after[t + 2]] === near) {
        tex = [0, 1].map((c) => (uv[after[t] * 2 + c] + uv[after[t + 1] * 2 + c] + uv[after[t + 2] * 2 + c]) / 3);
        break;
      }
    // The middle takes the weights of the rim vertex nearest it.
    const copy = new Map();
    const dup = (v, at) => {
      P2.set(at ?? p(v), n * 3);
      N2.set(f, n * 3);
      U2.set(tex, n * 2);
      J2.set(J.subarray(v * 4, v * 4 + 4), n * 4);
      W2.set(W.subarray(v * 4, v * 4 + 4), n * 4);
      return n++;
    };
    for (const v of ring) if (!copy.has(v)) copy.set(v, dup(v));
    const c = dup(near, mid);
    for (const [a, b] of run) tris.push(copy.get(b), copy.get(a), c);
  }
  return { pos: P2.subarray(0, n * 3), nrm: N2.subarray(0, n * 3), uv: U2.subarray(0, n * 2), J: J2.subarray(0, n * 4), W: W2.subarray(0, n * 4), indices: new after.constructor(tris), capped: tears, sides: runs.length - tears };
}
