// New hand geometry (`fixes.hands.graft`): a low-poly Meshy hand whose fingers fold into shards when they close
// (a few long slivers per finger, cut that way by the simplification) is replaced by the rig's own hand, the
// athlete body part's (`athlete_torso_m.glb`, Quaternius, as shipped), fitted to it: the donor hand is measured
// and mapped onto the old hand's measured frame (length, width and thickness from the wrist joint, the palm the
// same side round), skinned with the donor's own finger weights (the rig's chains, made to curl), and the rig's
// finger and thumb joints moved onto it. Its surface takes the colour of the old hand (each new vertex the texture
// coordinate of the old hand vertex whose colour is the old hand's median), so a glove stays a glove. The old hand's triangles (those its hand chain mostly holds) go; the donor's wrist reaches a little up the
// forearm into the sleeve or cuff, so no gap shows.
//
// Used by rehand-built.mjs (on a built file) before the hands are measured; a grafted hand is then measured only
// (`fingers: 'own'`: the rig's own weights are kept). A file records the sides grafted (`extras.graft` on its skin),
// so running it again changes nothing.

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

/** The donor's hand vertices: those its hand chain holds at least this much (as the old hand's, so its wrist meets the sleeve). */
const DONOR_HELD = 0.5;
/** A target vertex the hand chain holds at least this much is the old hand, and goes. */
const OLD_HELD = 0.5;

export const HAND_JOINT = (s) => new RegExp(`^(hand|index_0\\d|middle_0\\d|ring_0\\d|pinky_0\\d|thumb_0\\d)(_leaf)?_${s}$|^(index|middle|ring|pinky|thumb)_04_leaf_${s}$`);

/**
 * A hand's frame in its hand joint's space from its measurements (hands.mjs `fitHands`, `extras.hand`): an origin on
 * the palm's line through the wrist, and the three axes scaled by the hand's length, width and thickness.
 */
function frameOf(h) {
  const dir = norm(h.dir);
  const across = norm(h.across);
  const palmSide = norm(h.palmSide);
  const o = sub(h.palm, scale(dir, dot(h.palm, dir)));
  return { o, dir, across, palmSide, len: h.length, width: h.width, thick: h.thickness };
}

/** A point in the donor hand's joint space to the target's, through the two frames (shares of each axis). */
function mapLocal(p, fd, ft) {
  const r = sub(p, fd.o);
  const a = dot(p, fd.dir) / fd.len;
  const b = dot(r, fd.across) / fd.width;
  const c = dot(r, fd.palmSide) / fd.thick;
  return add(ft.o, add(scale(ft.dir, a * ft.len), add(scale(ft.across, b * ft.width), scale(ft.palmSide, c * ft.thick))));
}
/** A direction (a normal) the same way: the inverse of the scaling, so it stays square to the mapped surface. */
function mapNormal(n, fd, ft) {
  const a = dot(n, fd.dir) * fd.len;
  const b = dot(n, fd.across) * fd.width;
  const c = dot(n, fd.palmSide) * fd.thick;
  return norm(add(scale(ft.dir, a / ft.len), add(scale(ft.across, b / ft.width), scale(ft.palmSide, c / ft.thick))));
}

/**
 * Graft the donor's hands onto the target (both opened as rehand-built.mjs `open`: meshes in bind space, joints'
 * rest { q, t }), side by side. `measure(c, sides)` measures hands as `fitHands` does (measured only).
 * Returns { moved: Map<joint, world position>, sides } and edits the target meshes' arrays: each mesh gets `added`
 * (the new vertices: pos, J, W, uv, nrm) and `drop` (triangle starts to remove); the caller writes them.
 */
export function graftHands({ target, donor, sides, measure, smooth = 1, log = () => {} }) {
  const moved = new Map();
  const done = [];
  const mt = measure(target, sides);
  const md = measure(donor, sides);
  const targetIndex = new Map(target.jointNames.map((n, i) => [n, i]));
  for (const s of sides) {
    const ht = mt[s];
    const hd = md[s];
    if (!ht || !hd) {
      log(`hand_${s}: not measured; not grafted`);
      continue;
    }
    // The donor's hand in the target's hand joint space as it sits in its own (the rig's joint frames, so the clips'
    // finger poses and the game's curl bend it as they bend the rig's), sized to the old hand: its length, width
    // and thickness. (Laid along the old hand's own measured frame instead, a hand turned on its joint bent its
    // fingers across themselves.)
    const fd = frameOf(hd);
    // (Thickness as the length and width scale: an old hand's measured thickness counts its relaxed, half-closed
    // fingers, and a donor hand made that thick curled its fingers through each other.)
    const k = { len: ht.length / hd.length, width: ht.width / hd.width };
    k.thick = Math.sqrt(k.len * k.width);
    const ft = { ...fd, o: add(scale(fd.across, dot(fd.o, fd.across) * k.width), scale(fd.palmSide, dot(fd.o, fd.palmSide) * k.thick)), len: ht.length, width: ht.width, thick: hd.thickness * k.thick };
    const Ht = target.world.get(`hand_${s}`);
    const Hd = donor.world.get(`hand_${s}`);
    const dLocal = (p) => qrot(qinv(Hd.q), sub(p, Hd.t));
    const tWorld = (p) => add(Ht.t, qrot(Ht.q, p));
    const toTarget = (p) => tWorld(mapLocal(dLocal(p), fd, ft));
    const re = HAND_JOINT(s);
    const chainT = new Set(target.jointNames.map((n, i) => (re.test(n) ? i : -1)).filter((i) => i >= 0));
    const chainD = new Set(donor.jointNames.map((n, i) => (re.test(n) ? i : -1)).filter((i) => i >= 0));
    const heldBy = (J, W, v, chain) => {
      let w = 0;
      for (let k = 0; k < 4; k++) if (chain.has(J[v * 4 + k])) w += W[v * 4 + k];
      return w;
    };
    let added = 0;
    let dropped = 0;
    let turnedAll = 0;
    target.meshes.forEach((m) => {
      const dm = donor.meshes.find((x) => x.lod === m.lod) ?? donor.meshes[0];
      const uvOf = (v) => (m.uv ? [m.uv[v * 2], m.uv[v * 2 + 1]] : [0, 0]);
      const n = m.pos.length / 3;
      // The old hand: its vertices (their texture coordinates, for the new surface) and its triangles (to go).
      const old = [];
      for (let v = 0; v < n; v++) if (heldBy(m.J, m.W, v, chainT) >= OLD_HELD) old.push(v);
      const isOld = new Uint8Array(n);
      for (const v of old) isOld[v] = 1;
      if (!old.length) return;
      m.drop ??= new Set();
      // The old hand's triangles: they go, and the new hand takes its surface from them (below).
      const oldTris = [];
      for (let i = 0; i < m.idx.length; i += 3) {
        if (!isOld[m.idx[i]] || !isOld[m.idx[i + 1]] || !isOld[m.idx[i + 2]]) continue;
        oldTris.push(i);
        if (m.drop.has(i)) continue;
        m.drop.add(i);
        dropped++;
      }
      // The donor's hand (its vertices the hand chain holds), mapped, then (`smooth`) subdivided: the donor's own
      // fingers are a few segments round, and closed they read as blocks.
      const dn = dm.pos.length / 3;
      const keep = new Int32Array(dn).fill(-1);
      const hand = { pos: [], nrm: [], jw: [], idx: [] };
      // (Welded by position: copies of a vertex either side of the donor's own texture seams are one, so the hand
      // subdivides as one surface.)
      const at = new Map();
      for (let v = 0; v < dn; v++) {
        if (heldBy(dm.J, dm.W, v, chainD) < DONOR_HELD) continue;
        const kp = `${dm.pos[v * 3].toFixed(5)},${dm.pos[v * 3 + 1].toFixed(5)},${dm.pos[v * 3 + 2].toFixed(5)}`;
        if (at.has(kp)) {
          keep[v] = at.get(kp);
          continue;
        }
        keep[v] = hand.pos.length;
        at.set(kp, keep[v]);
        hand.pos.push(toTarget([dm.pos[v * 3], dm.pos[v * 3 + 1], dm.pos[v * 3 + 2]]));
        const nd = dm.nrm ? qrot(qinv(Hd.q), [dm.nrm[v * 3], dm.nrm[v * 3 + 1], dm.nrm[v * 3 + 2]]) : [0, 0, 1];
        hand.nrm.push(qrot(Ht.q, mapNormal(nd, fd, ft)));
        const jw = new Map();
        for (let k = 0; k < 4; k++) {
          const w = dm.W[v * 4 + k];
          const t = w ? targetIndex.get(donor.jointNames[dm.J[v * 4 + k]]) : undefined;
          if (t !== undefined) jw.set(t, (jw.get(t) ?? 0) + w);
        }
        hand.jw.push(jw);
      }
      for (let i = 0; i < dm.idx.length; i += 3) {
        const [a, b, c] = [keep[dm.idx[i]], keep[dm.idx[i + 1]], keep[dm.idx[i + 2]]];
        if (a >= 0 && b >= 0 && c >= 0 && a !== b && b !== c && a !== c) hand.idx.push(a, b, c);
      }
      // Every triangle facing out, as its vertices' normals do: the donor part is drawn two-sided, and some of its
      // palm's triangles are wound inward; on a character drawn one-sided they were holes, the pistol's grip showing
      // through the palm (owner, 2026-11-17).
      let turned = 0;
      for (let i = 0; i < hand.idx.length; i += 3) {
        const [a, b, c] = [hand.idx[i], hand.idx[i + 1], hand.idx[i + 2]];
        const face = cross(sub(hand.pos[b], hand.pos[a]), sub(hand.pos[c], hand.pos[a]));
        if (dot(face, add(add(hand.nrm[a], hand.nrm[b]), hand.nrm[c])) < 0) {
          [hand.idx[i + 1], hand.idx[i + 2]] = [c, b];
          turned++;
        }
      }
      turnedAll += turned;
      for (let level = 0; level < (m.lod ? 0 : smooth); level++) subdivide(hand);
      // Its surface from the old hand's: each new triangle takes its texture coordinates from the old triangle nearest
      // it (its corners projected onto that triangle's plane, kept within a little of it), so the skin's tone, a
      // glove's seams and a nail's colour carry over; its corners are its own (no texture coordinate is shared
      // across two old triangles' charts).
      const P = (v) => [m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]];
      const olds = oldTris.map((i) => ({ a: P(m.idx[i]), b: P(m.idx[i + 1]), c: P(m.idx[i + 2]), ua: uvOf(m.idx[i]), ub: uvOf(m.idx[i + 1]), uc: uvOf(m.idx[i + 2]) }));
      const fresh = { pos: [], J: [], W: [], uv: [], nrm: [], idx: [] };
      // (A corner is shared by the triangles that read the same old triangle.)
      const corner = new Map();
      for (let i = 0; i < hand.idx.length; i += 3) {
        const corners = [hand.idx[i], hand.idx[i + 1], hand.idx[i + 2]];
        const centre = scale(add(add(hand.pos[corners[0]], hand.pos[corners[1]]), hand.pos[corners[2]]), 1 / 3);
        let best = null;
        let bd = Infinity;
        for (const o of olds) {
          const d = distToTriangle(centre, o.a, o.b, o.c);
          if (d < bd) [bd, best] = [d, o];
        }
        for (const v of corners) {
          const ck = `${v}_${best ? olds.indexOf(best) : -1}`;
          if (corner.has(ck)) {
            fresh.idx.push(corner.get(ck));
            continue;
          }
          corner.set(ck, fresh.pos.length);
          const uv = best ? uvOnTriangle(hand.pos[v], best) : [0, 0];
          fresh.pos.push(hand.pos[v]);
          fresh.nrm.push(hand.nrm[v]);
          const top = [...hand.jw[v]].sort((x, y) => y[1] - x[1]).slice(0, 4);
          const sum = top.reduce((a2, [, w]) => a2 + w, 0) || 1;
          fresh.J.push([0, 1, 2, 3].map((k2) => top[k2]?.[0] ?? 0));
          fresh.W.push([0, 1, 2, 3].map((k2) => (top[k2] ? top[k2][1] / sum : 0)));
          fresh.uv.push(uv);
          fresh.idx.push(fresh.pos.length - 1);
        }
      }
      added += fresh.pos.length;
      (m.added ??= []).push(fresh);
    });
    // The rig's finger and thumb joints onto the new hand.
    for (const name of donor.jointNames) {
      if (!re.test(name) || name === `hand_${s}` || !targetIndex.has(name) || !donor.world.has(name)) continue;
      moved.set(name, toTarget(donor.world.get(name).t));
    }
    done.push(s);
    log(`hand_${s}: new hand geometry (the rig's own hand fitted: ${(ht.length * 100).toFixed(1)} cm long, ${(ht.width * 100).toFixed(1)} wide): ${added} vertices for ${dropped} old triangles${turnedAll ? `, ${turnedAll} donor triangles turned to face out` : ''}`);
  }
  return { moved, sides: done };
}

/** Distance from a point to a triangle (the nearest point on it). */
function distToTriangle(p, a, b, c) {
  const q = nearestOnTriangle(p, a, b, c);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}
function nearestOnTriangle(p, a, b, c) {
  // (Ericson, Real-Time Collision Detection, 5.1.5.)
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a);
  const d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return a;
  const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return b;
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return add(a, scale(ab, d1 / (d1 - d3)));
  const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return c;
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return add(a, scale(ac, d2 / (d2 - d6)));
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) return add(b, scale(sub(c, b), (d4 - d3) / (d4 - d3 + (d5 - d6))));
  const den = 1 / (va + vb + vc);
  return add(a, add(scale(ab, vb * den), scale(ac, vc * den)));
}
/** How far past a triangle's edges a projected corner may read the map (barycentric): a little, never into the next chart. */
const UV_REACH = 0;
/** A point's texture coordinate on an old triangle: projected onto its plane, barycentric, held within UV_REACH of it. */
function uvOnTriangle(p, o) {
  const e1 = sub(o.b, o.a), e2 = sub(o.c, o.a), r = sub(p, o.a);
  const d11 = dot(e1, e1), d12 = dot(e1, e2), d22 = dot(e2, e2), dr1 = dot(r, e1), dr2 = dot(r, e2);
  const den = d11 * d22 - d12 * d12 || 1e-12;
  let v = (d22 * dr1 - d12 * dr2) / den;
  let w = (d11 * dr2 - d12 * dr1) / den;
  let u = 1 - v - w;
  [u, v, w] = [u, v, w].map((x) => Math.max(-UV_REACH, x));
  const t = u + v + w;
  [u, v, w] = [u / t, v / t, w / t];
  return [0, 1].map((k) => u * o.ua[k] + v * o.ub[k] + w * o.uc[k]);
}

/**
 * One level of subdivision of the donor hand, in place (Loop's rules on a closed patch, its open border kept as a
 * curve): each triangle into four, the old vertices eased toward their neighbours and the new ones at the weighted
 * middle of their edge; normals and skin weights blended the same way, so the fingers round off instead of standing
 * as six-sided blocks.
 */
function subdivide(h) {
  const n = h.pos.length;
  const edges = new Map();
  const key = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);
  const opp = new Map();
  for (let i = 0; i < h.idx.length; i += 3) {
    const t = [h.idx[i], h.idx[i + 1], h.idx[i + 2]];
    for (let k = 0; k < 3; k++) {
      const kk = key(t[k], t[(k + 1) % 3]);
      (opp.get(kk) ?? opp.set(kk, []).get(kk)).push(t[(k + 2) % 3]);
    }
  }
  const nbr = Array.from({ length: n }, () => new Set());
  const border = new Uint8Array(n);
  for (const [kk, os] of opp) {
    const [a, b] = kk.split('_').map(Number);
    nbr[a].add(b);
    nbr[b].add(a);
    if (os.length === 1) border[a] = border[b] = 1;
  }
  const mix = (parts) => {
    const pos = [0, 0, 0], nrm = [0, 0, 0], jw = new Map();
    for (const [v, w] of parts) {
      for (let k = 0; k < 3; k++) [pos[k], nrm[k]] = [pos[k] + h.pos[v][k] * w, nrm[k] + h.nrm[v][k] * w];
      for (const [j, x] of h.jw[v]) jw.set(j, (jw.get(j) ?? 0) + x * w);
    }
    return { pos, nrm: norm(nrm), jw };
  };
  const out = { pos: [], nrm: [], jw: [] };
  // Old vertices, eased (border ones kept: the wrist's edge meets the sleeve where it was).
  for (let v = 0; v < n; v++) {
    const ns = [...nbr[v]];
    if (border[v] || ns.length < 3) {
      out.pos.push(h.pos[v]); out.nrm.push(h.nrm[v]); out.jw.push(h.jw[v]);
      continue;
    }
    const beta = ns.length === 3 ? 3 / 16 : 3 / (8 * ns.length);
    const r = mix([[v, 1 - ns.length * beta], ...ns.map((x) => [x, beta])]);
    out.pos.push(r.pos); out.nrm.push(r.nrm); out.jw.push(r.jw);
  }
  const mid = new Map();
  const midOf = (a, b) => {
    const kk = key(a, b);
    if (mid.has(kk)) return mid.get(kk);
    const os = opp.get(kk) ?? [];
    const r = os.length === 2 ? mix([[a, 3 / 8], [b, 3 / 8], [os[0], 1 / 8], [os[1], 1 / 8]]) : mix([[a, 1 / 2], [b, 1 / 2]]);
    out.pos.push(r.pos); out.nrm.push(r.nrm); out.jw.push(r.jw);
    mid.set(kk, out.pos.length - 1);
    return out.pos.length - 1;
  };
  const idx = [];
  for (let i = 0; i < h.idx.length; i += 3) {
    const [a, b, c] = [h.idx[i], h.idx[i + 1], h.idx[i + 2]];
    const [ab, bc, ca] = [midOf(a, b), midOf(b, c), midOf(c, a)];
    idx.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
  }
  Object.assign(h, out, { idx });
}
