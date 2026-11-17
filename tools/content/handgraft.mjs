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
export function graftHands({ target, donor, sides, measure, colourAt = null, normalAt = null, log = () => {} }) {
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
    target.meshes.forEach((m) => {
      const dm = donor.meshes.find((x) => x.lod === m.lod) ?? donor.meshes[0];
      const n = m.pos.length / 3;
      // The old hand: its vertices (their texture coordinates, for the new surface) and its triangles (to go).
      const old = [];
      for (let v = 0; v < n; v++) if (heldBy(m.J, m.W, v, chainT) >= OLD_HELD) old.push(v);
      const isOld = new Uint8Array(n);
      for (const v of old) isOld[v] = 1;
      if (!old.length) return;
      // The new hand's one colour: the old hand vertex whose colour is nearest the old hand's median (a glove's
      // white, a skin's tone), not a seam's or a nail's.
      const uvOf = (v) => (m.uv ? [m.uv[v * 2], m.uv[v * 2 + 1]] : [0, 0]);
      let handUV = uvOf(old[0]);
      if (colourAt && m.uv) {
        const cols = old.map((v) => colourAt(...uvOf(v)));
        const med = [0, 1, 2].map((k) => cols.map((c) => c[k]).sort((a, b) => a - b)[cols.length >> 1]);
        // ...where the normal map is flat too (one texel's tilt on every new vertex shaded the hand in blotches).
        const tilt = (v) => {
          const n = normalAt?.(...uvOf(v));
          return n ? (n[0] - 128) ** 2 + (n[1] - 128) ** 2 : 0;
        };
        let bd = Infinity;
        old.forEach((v, i) => {
          const d = (cols[i][0] - med[0]) ** 2 + (cols[i][1] - med[1]) ** 2 + (cols[i][2] - med[2]) ** 2 + tilt(v);
          if (d < bd) [bd, handUV] = [d, uvOf(v)];
        });
      }
      m.drop ??= new Set();
      for (let i = 0; i < m.idx.length; i += 3) {
        if (!isOld[m.idx[i]] || !isOld[m.idx[i + 1]] || !isOld[m.idx[i + 2]] || m.drop.has(i)) continue;
        m.drop.add(i);
        dropped++;
      }
      // The donor's hand, mapped.
      const dn = dm.pos.length / 3;
      const keep = new Int32Array(dn).fill(-1);
      const fresh = { pos: [], J: [], W: [], uv: [], nrm: [], idx: [] };
      for (let v = 0; v < dn; v++) {
        if (heldBy(dm.J, dm.W, v, chainD) < DONOR_HELD) continue;
        keep[v] = fresh.pos.length;
        const p = toTarget([dm.pos[v * 3], dm.pos[v * 3 + 1], dm.pos[v * 3 + 2]]);
        fresh.pos.push(p);
        const nd = dm.nrm ? qrot(qinv(Hd.q), [dm.nrm[v * 3], dm.nrm[v * 3 + 1], dm.nrm[v * 3 + 2]]) : [0, 0, 1];
        fresh.nrm.push(qrot(Ht.q, mapNormal(nd, fd, ft)));
        const js = [];
        for (let k = 0; k < 4; k++) {
          const w = dm.W[v * 4 + k];
          if (!w) continue;
          const t = targetIndex.get(donor.jointNames[dm.J[v * 4 + k]]);
          if (t !== undefined) js.push([t, w]);
        }
        const sum = js.reduce((a, [, w]) => a + w, 0) || 1;
        fresh.J.push([0, 1, 2, 3].map((k) => js[k]?.[0] ?? 0));
        fresh.W.push([0, 1, 2, 3].map((k) => (js[k] ? js[k][1] / sum : 0)));
        fresh.uv.push(handUV);
      }
      // Donor triangles wholly kept.
      for (let i = 0; i < dm.idx.length; i += 3) {
        const [a, b, c] = [keep[dm.idx[i]], keep[dm.idx[i + 1]], keep[dm.idx[i + 2]]];
        if (a < 0 || b < 0 || c < 0) continue;
        fresh.idx.push(a, b, c);
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
    log(`hand_${s}: new hand geometry (the rig's own hand fitted: ${(ht.length * 100).toFixed(1)} cm long, ${(ht.width * 100).toFixed(1)} wide): ${added} vertices for ${dropped} old triangles`);
  }
  return { moved, sides: done };
}
