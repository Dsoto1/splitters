// Fences, walls and barriers (kit-prop families `fence`, `wall`, `barrier`; docs/PROCEDURAL_ENVIRONMENT.md §11 Phase 6
// part 2): wooden fences (post and rail, planks, pickets, a palisade of pointed stakes), iron railings on a stone
// kerb, drystone walls and concrete road barriers. Each stays inside its bounds, [-w/2, w/2] × [0, h] × [-d/2, d/2]:
// collision is the box, as the pieces they replace had it (a fence stops you and a round like a thin wall).
//
// A piece runs along its longer ground axis (x, or z when it is deeper than wide: the Town Fence). Structure comes
// from the variant's seed and settings, the look from its `look`. Level 1 drops the small parts (tips, seams, caps);
// level 2 is a few boxes with the same outline, so a fence far off is still a fence and not a slab.

import { rng } from '../env/rng.mjs';
import { noise3 } from '../env/noise.mjs';
import { Mesh, box, clamp01, groundShade, hex, mix3, quadN, scale3, triN } from './geom.mjs';
import { woodTone } from './crate.mjs';

/**
 * The piece's own axes: u along its run (−L/2 … L/2), y up, v across (−T/2 … T/2). `P` maps a point, `bx` a box.
 */
function frame(size) {
  const [w, h, d] = size;
  const alongZ = d > w;
  const L = alongZ ? d : w;
  const T = alongZ ? w : d;
  const P = (u, y, v) => (alongZ ? [v, y, u] : [u, y, v]);
  const bx = (m, u0, y0, v0, u1, y1, v1, colour, skip = []) => {
    const lo = P(Math.min(u0, u1), Math.min(y0, y1), Math.min(v0, v1));
    const hi = P(Math.max(u0, u1), Math.max(y0, y1), Math.max(v0, v1));
    box(m, lo, hi, colour, skip);
  };
  // A direction in the piece's axes as a world one (for quadN / triN).
  const D = (u, y, v) => (alongZ ? [v, y, u] : [u, y, v]);
  /** The box faces at the two ends of the run (to leave out where they butt against a post). */
  const ends = alongZ ? ['nz', 'pz'] : ['nx', 'px'];
  /**
   * The piece's finer collision (docs/CONTENT_PIPELINE.md, "Kit props": a see-through fence collides as its posts and
   * rails, not as its bounds): `solid` adds a box in the piece's axes. Only what every variant of the family shares
   * goes in (nothing drawn from the seed), so the family has one collision.
   */
  const solids = [];
  const solid = (u0, y0, v0, u1, y1, v1) => {
    const lo = P(Math.min(u0, u1), Math.min(y0, y1), Math.min(v0, v1));
    const hi = P(Math.max(u0, u1), Math.max(y0, y1), Math.max(v0, v1));
    solids.push([...lo, ...hi]);
  };
  return { L, T, h, P, D, bx, ends, solid, solids };
}

/** A four-sided point on top of a square post or bar: base centre (u, v) at height y, half-width a, rising r. */
function point(m, f, u, y, v, a, r, colour) {
  const tip = f.P(u, y + r, v);
  const c = [f.P(u - a, y, v - a), f.P(u + a, y, v - a), f.P(u + a, y, v + a), f.P(u - a, y, v + a)];
  const out = [f.D(0, 0.5, -1), f.D(1, 0.5, 0), f.D(0, 0.5, 1), f.D(-1, 0.5, 0)];
  for (let i = 0; i < 4; i++) triN(m, c[i], c[(i + 1) % 4], tip, out[i], colour);
}

// ---------------------------------------------------------------- wooden fences

/**
 * A wooden fence. Settings `g`: `style` ('rail': posts with rails between them; 'plank': upright boards on two
 * rails; 'picket': pointed pickets with gaps; 'palisade': a wall of pointed stakes), `posts` (how many), `post`
 * (post width, m), `rails` (how many), `rail` (rail height, m), `board` (board or stake width, m), `gap` (between
 * pickets, a share of the board), `lean` (how unevenly the tops stand, m). `look`: `wood`, `post` (hex), `paint`
 * (hex: painted boards), `jitter`, `grime`, `moss` (hex: green at the foot).
 */
export function fenceMesh(seed, size, g, look, level) {
  const f = frame(size);
  const { L, T, h } = f;
  const r = rng(seed);
  const m = new Mesh();
  const n = noise3(seed);
  const wood = hex(look.paint ?? look.wood);
  const postWood = hex(look.post ?? look.wood);
  const moss = look.moss ? hex(look.moss) : null;
  // Wood, greened a little at the foot where the look asks.
  const tone = (base, k) => {
    const t = woodTone(base, r, look, seed + k);
    if (!moss) return t;
    return (p) => mix3(t(p), moss, 0.45 * clamp01(1 - p[1] / 0.22) * clamp01(n(p[0] * 5, p[1] * 5, p[2] * 5) * 0.5 + 0.6));
  };
  const style = g.style ?? 'rail';
  const lean = level === 0 ? (g.lean ?? 0) : 0;
  if (style === 'palisade') {
    // Stakes side by side, each a square post with a point; a lashing rail on the front and the back.
    const count = level >= 2 ? 3 : Math.max(3, Math.round(L / g.board));
    const sw = L / count;
    const a = T / 2 - 0.012;
    for (let i = 0; i < count; i++) {
      const u = -L / 2 + sw * (i + 0.5);
      const tip = level >= 2 ? 0 : Math.min(0.26, sw * 1.3);
      // (One stake stands the full height: the piece fills its bounds.)
      const top = h - tip - (i === (count >> 1) ? 0 : Math.abs(r.jitter(lean)));
      const col = tone(wood, i);
      const e0 = i === 0 ? 0 : 0.004;
      const e1 = i === count - 1 ? 0 : 0.004;
      f.bx(m, u - sw / 2 + e0, 0, -T / 2 + (level === 0 ? 0.012 : 0), u + sw / 2 - e1, top, T / 2 - (level === 0 ? 0.012 : 0), col, level >= 2 ? ['ny'] : ['ny', 'py']);
      if (level < 2) point(m, f, u, top, 0, Math.min(sw / 2 - 0.004, T / 2 - 0.012), tip, col);
    }
    if (level === 0) {
      const col = tone(scale3(postWood, 0.8), 77);
      for (const y of [h * 0.3, h * 0.66]) {
        f.bx(m, -L / 2, y, a, L / 2, y + 0.07, T / 2, col, ['nz']);
        f.bx(m, -L / 2, y, -T / 2, L / 2, y + 0.07, -a, col, ['pz']);
      }
    }
    return m;
  }
  // Posts: square, the full depth, with a pointed or flat cap just under the top.
  const posts = Math.max(2, g.posts ?? 2);
  const pw = g.post;
  // (Posts are the full height and depth of the piece: it fills its bounds.)
  const pd = T / 2;
  const postTop = h;
  const us = [];
  for (let i = 0; i < posts; i++) us.push(-L / 2 + pw / 2 + ((L - pw) * i) / (posts - 1));
  for (const [i, u] of us.entries()) {
    const col = tone(postWood, 50 + i);
    const cap = level === 0 ? Math.min(0.05, pw * 0.6) : 0;
    f.bx(m, u - pw / 2, 0, -pd, u + pw / 2, postTop - cap, pd, col, cap ? ['ny', 'py'] : ['ny']);
    if (cap) {
      // A ridged cap across the depth.
      const y = postTop - cap;
      quadN(m, f.P(u - pw / 2, y, -pd), f.P(u, postTop, -pd), f.P(u, postTop, pd), f.P(u - pw / 2, y, pd), f.D(-1, 1, 0), col);
      quadN(m, f.P(u + pw / 2, y, -pd), f.P(u, postTop, -pd), f.P(u, postTop, pd), f.P(u + pw / 2, y, pd), f.D(1, 1, 0), col);
      triN(m, f.P(u - pw / 2, y, pd), f.P(u + pw / 2, y, pd), f.P(u, postTop, pd), f.D(0, 0, 1), col);
      triN(m, f.P(u - pw / 2, y, -pd), f.P(u + pw / 2, y, -pd), f.P(u, postTop, -pd), f.D(0, 0, -1), col);
    }
  }
  const rails = level >= 2 ? Math.min(2, g.rails ?? 2) : Math.max(1, g.rails ?? 2);
  // Where each rail sits (the drawn one is a centimetre off, by the seed).
  const railY = (k, n) => h * (0.28 + (0.56 * k) / Math.max(1, n - 1));
  if (style === 'rail') {
    m.boxes = f.solids;
    for (const u of us) f.solid(u - pw / 2, 0, -pd, u + pw / 2, h, pd);
    const all = Math.max(1, g.rails ?? 2);
    for (let k = 0; k < all; k++) f.solid(-L / 2 + pw * 0.5, railY(k, all) - g.rail / 2, pd - Math.min(0.035, T * 0.4), L / 2 - pw * 0.5, railY(k, all) + g.rail / 2, pd);
  }
  const rh = g.rail;
  const rt = Math.min(0.035, T * 0.4);
  if (style === 'rail') {
    // Rails between the posts, on the front of them, each sagging or tilted a little.
    for (let k = 0; k < rails; k++) {
      const y = railY(k, rails) + (level === 0 ? r.jitter(0.012) : 0);
      const col = tone(wood, 20 + k);
      // Between the posts, set into their front (from the first lighter level on, without the ends hidden in them).
      f.bx(m, -L / 2 + pw * 0.5, y - rh / 2, pd - rt, L / 2 - pw * 0.5, y + rh / 2, pd, col, level > 0 ? f.ends : []);
    }
    return m;
  }
  // Upright boards on two rails (the rails behind them).
  const railCol = tone(scale3(postWood, 0.85), 90);
  if (level === 0) for (const y of [h * 0.24, h * 0.7]) f.bx(m, -L / 2 + pw, y - rh / 2, -rt / 2, L / 2 - pw, y + rh / 2, rt / 2, railCol);
  const span = L - pw * 2;
  const bw = g.board;
  const gap = style === 'picket' ? bw * (g.gap ?? 0.6) : 0.006;
  // From the first lighter level on: a board or two between each pair of posts (no heavier than the piece replaced).
  const bays = posts - 1;
  const count = level >= 1 ? bays * (style === 'picket' && level === 1 ? 2 : 1) : Math.max(2, Math.round(span / (bw + gap)));
  const step = span / count;
  for (let i = 0; i < count; i++) {
    const u0 = -L / 2 + pw + step * i + gap / 2;
    const u1 = u0 + step - gap;
    const tip = style === 'picket' && level === 0 ? Math.min(0.08, (u1 - u0) * 0.6) : 0;
    const top = (style === 'picket' ? h * 0.97 : h * 0.9) - tip - Math.abs(r.jitter(lean));
    const col = tone(wood, i);
    const v0 = rt / 2;
    const v1 = Math.min(T / 2, rt / 2 + 0.022);
    f.bx(m, u0, 0.04, v0, u1, top, v1, col, tip ? ['py'] : []);
    if (tip) {
      // A picket's point: two sloped faces and the two gable ends.
      const mid = (u0 + u1) / 2;
      quadN(m, f.P(u0, top, v0), f.P(mid, top + tip, v0), f.P(mid, top + tip, v1), f.P(u0, top, v1), f.D(-1, 1, 0), col);
      quadN(m, f.P(u1, top, v0), f.P(mid, top + tip, v0), f.P(mid, top + tip, v1), f.P(u1, top, v1), f.D(1, 1, 0), col);
      triN(m, f.P(u0, top, v1), f.P(u1, top, v1), f.P(mid, top + tip, v1), f.D(0, 0, 1), col);
      triN(m, f.P(u0, top, v0), f.P(u1, top, v0), f.P(mid, top + tip, v0), f.D(0, 0, -1), col);
    }
  }
  return m;
}

// ---------------------------------------------------------------- iron railings

/**
 * Iron railings: square bars with spear points between two rails, a post at each end with a cap, on a stone kerb.
 * Settings `g`: `bar` (bar width, m), `pitch` (bar spacing), `post` (post width), `kerb` (kerb height; 0 for none),
 * `broken` (a share of the bars missing or bent out of line, 0–1; the bent ones lean across the depth). `look`:
 * `iron`, `rust`, `stone` (hex), `rusty` (0–1), `grime`.
 */
export function railingMesh(seed, size, g, look, level) {
  const f = frame(size);
  const { L, T, h } = f;
  const r = rng(seed);
  const m = new Mesh();
  const n = noise3(seed);
  const iron = hex(look.iron);
  const rust = hex(look.rust ?? '#6b3d24');
  const rusty = look.rusty ?? 0.25;
  const metal = (p) => scale3(mix3(iron, rust, rusty * clamp01(n(p[0] * 6, p[1] * 6, p[2] * 6) * 0.5 + 0.55)), groundShade(p[1], 0.3, 0.8));
  const stone = hex(look.stone ?? '#7d7a72');
  const stoneTone = (p) => scale3(stone, groundShade(p[1], 0.12, 0.7) * (1 - 0.15 * clamp01(n(p[0] * 4, p[1] * 9, p[2] * 4))));
  const broken = g.broken ?? 0;
  // The fence stands on the centre line when whole; a broken one keeps its line and lets the bent bars lean out.
  const kerb = g.kerb ?? 0;
  const kd = Math.min(T, 0.2) / 2;
  if (kerb > 0) f.bx(m, -L / 2, 0, -kd, L / 2, kerb, kd, stoneTone, ['ny']);
  const pw = g.post;
  const postTop = h - (level === 0 ? pw * 1.1 : 0);
  for (const s of [-1, 1]) {
    const u = s * (L / 2 - pw / 2);
    f.bx(m, u - pw / 2, kerb, -pw / 2, u + pw / 2, postTop, pw / 2, metal, level === 0 ? ['ny', 'py'] : ['ny']);
    if (level === 0) point(m, f, u, postTop, 0, pw / 2, pw * 1.1, metal);
  }
  const railT = g.bar * 1.3;
  const yLow = kerb + (h - kerb) * 0.1;
  const yHigh = h * 0.8;
  // Collision: the kerb, the posts, the rails and each standing bar (rounds pass between the bars; you don't).
  m.boxes = f.solids;
  if (kerb > 0) f.solid(-L / 2, 0, -kd, L / 2, kerb, kd);
  for (const s of [-1, 1]) f.solid(s * (L / 2 - pw), kerb, -pw / 2, (s * L) / 2, h, pw / 2);
  // Where the fence is broken the top rail stops short of one end.
  const gapFrom = broken > 0 ? L / 2 - pw - (L - pw * 2) * Math.min(0.5, broken) : L / 2 - pw;
  if (level < 2) f.bx(m, -L / 2 + pw, yLow - railT / 2, -railT / 2, L / 2 - pw, yLow + railT / 2, railT / 2, metal);
  f.bx(m, -L / 2 + pw, yHigh - railT / 2, -railT / 2, gapFrom, yHigh + railT / 2, railT / 2, metal);
  f.solid(-L / 2 + pw, yLow - railT / 2, -railT / 2, L / 2 - pw, yLow + railT / 2, railT / 2);
  f.solid(-L / 2 + pw, yHigh - railT / 2, -railT / 2, gapFrom, yHigh + railT / 2, railT / 2);
  {
    const span = L - pw * 2;
    const count = Math.max(3, Math.round(span / g.pitch));
    for (let i = 0; i < count; i++) {
      const u = -L / 2 + pw + (span * (i + 0.5)) / count;
      // (Past the gap the bars are gone or bent, differently in each variant: nothing to stop a round there.)
      if (u <= gapFrom) f.solid(u - g.bar / 2, yLow, -g.bar / 2, u + g.bar / 2, h - g.bar * 3, g.bar / 2);
    }
  }
  if (broken > 0) {
    // Bars torn off, lying on the ground either side of the gap (out to the piece's bounds, front and back).
    const u = gapFrom + (L / 2 - pw - gapFrom) * 0.5;
    f.bx(m, u - 0.32, 0, T / 2 - g.bar, u + 0.28, g.bar, T / 2, metal, ['ny']);
    f.bx(m, u - 0.2, 0, -T / 2, u + 0.3, g.bar, -T / 2 + g.bar, metal, ['ny']);
  }
  if (level >= 2) {
    // Far off: the bars as one thin dark sheet between the rails (the outline, at a fraction of the triangles).
    f.bx(m, -L / 2 + pw, yLow, -0.004, gapFrom, yHigh, 0.004, scale3(iron, 0.9), ['ny', 'py']);
    return m;
  }
  const span = L - pw * 2;
  const count = Math.max(3, Math.round(span / g.pitch));
  const a = g.bar / 2;
  for (let i = 0; i < count; i++) {
    const u = -L / 2 + pw + (span * (i + 0.5)) / count;
    const past = u > gapFrom;
    if (past && r.next() < 0.45) continue; // gone
    const tip = level === 0 ? g.bar * 3 : 0;
    if (past) {
      // Bent out of line: the bar leans across the depth from its foot on the low rail, shorter than the rest.
      const leanTo = (r.next() < 0.5 ? -1 : 1) * (T / 2 - a) * r.range(0.45, 0.9);
      const top = yLow + (h - yLow) * r.range(0.45, 0.8);
      const a0 = [f.P(u - a, yLow, -a), f.P(u + a, yLow, -a), f.P(u + a, yLow, a), f.P(u - a, yLow, a)];
      const a1 = [f.P(u - a, top, leanTo - a), f.P(u + a, top, leanTo - a), f.P(u + a, top, leanTo + a), f.P(u - a, top, leanTo + a)];
      const out = [f.D(0, 0, -1), f.D(1, 0, 0), f.D(0, 0, 1), f.D(-1, 0, 0)];
      for (let k = 0; k < 4; k++) quadN(m, a0[k], a0[(k + 1) % 4], a1[(k + 1) % 4], a1[k], out[k], metal);
      quadN(m, a1[0], a1[1], a1[2], a1[3], f.D(0, 1, 0), metal);
      continue;
    }
    const top = h - tip - (i % 2 ? g.bar * 1.5 : 0);
    f.bx(m, u - a, yLow, -a, u + a, top, a, metal, tip ? ['ny', 'py'] : ['ny']);
    if (tip) point(m, f, u, top, 0, a * 1.7, tip, metal);
  }
  return m;
}

// ---------------------------------------------------------------- drystone walls

/**
 * A drystone wall: courses of stones of uneven length, each a block through the wall set a little in or out, and a
 * course of flat capstones. Settings `g`: `courses`, `stone` [min, max] (a stone's length, m), `cap` (the capstones'
 * height, m), `inset` (how far a stone may sit back from the face, m), `broken` (0–1: the top courses fall away
 * towards one end, with fallen stones at the foot). `look`: `stone`, `dark` (hex: the gaps), `moss` (hex), `jitter`.
 */
export function stoneWallMesh(seed, size, g, look, level) {
  const f = frame(size);
  const { L, T, h } = f;
  const r = rng(seed);
  const m = new Mesh();
  const n = noise3(seed);
  const stone = hex(look.stone);
  const moss = look.moss ? hex(look.moss) : null;
  const broken = g.broken ?? 0;
  const tint = (base) => {
    const c = scale3(base, 1 + r.jitter(look.jitter ?? 0.12));
    const warm = r.jitter(0.03);
    const s = [c[0] * (1 + warm), c[1], c[2] * (1 - warm)];
    return (p, nn) => {
      let col = scale3(s, groundShade(p[1], 0.2, 0.75) * (1 - 0.14 * clamp01(n(p[0] * 7, p[1] * 7, p[2] * 7))));
      if (moss && nn && nn[1] > 0.5) col = mix3(col, moss, 0.5 * clamp01(n(p[0] * 3, 1, p[2] * 3) * 0.5 + 0.5));
      return col;
    };
  };
  // How high the wall stands at u: whole, or falling away towards +u when broken.
  const heightAt = (u) => (broken > 0 ? h * (1 - broken * clamp01((u + L * 0.12) / (L * 0.5))) : h);
  if (broken > 0) {
    // Collision: the wall as it stands, in four steps down to its low end.
    m.boxes = f.solids;
    for (let i = 0; i < 4; i++) {
      const u0 = -L / 2 + (L * i) / 4;
      const u1 = u0 + L / 4;
      f.solid(u0, 0, -T / 2, u1, Math.max((h - g.cap) / g.courses, Math.round(heightAt((u0 + u1) / 2) * 100) / 100), T / 2);
    }
  }
  if (level >= 2) {
    const steps = broken > 0 ? 3 : 1;
    for (let i = 0; i < steps; i++) {
      const u0 = -L / 2 + (L * i) / steps;
      const u1 = u0 + L / steps;
      f.bx(m, u0, 0, -T / 2, u1, Math.max(h * 0.25, heightAt((u0 + u1) / 2)), T / 2, tint(stone), ['ny']);
    }
    return m;
  }
  const capH = g.cap;
  // From the first lighter level on: two courses of two or three long stones under one cap (no heavier than the piece replaced).
  const courses = level === 1 ? 2 : g.courses;
  const ch = (h - capH) / courses;
  const inset = level === 0 ? g.inset : 0;
  // The dark heart behind the stones' faces, so the gaps between them read as shadow.
  const dark = hex(look.dark ?? '#2b2a27');
  for (let c = 0; c < courses; c++) {
    const y0 = c * ch;
    const y1 = y0 + ch;
    let u = -L / 2;
    // Alternate courses start with a half stone, so the joints don't line up.
    let first = c % 2 ? r.range(g.stone[0] * 0.4, g.stone[0] * 0.7) : r.range(g.stone[0], g.stone[1]);
    while (u < L / 2 - 0.001) {
      let len = level === 1 ? L / 2 + (c ? L * 0.12 : -L * 0.1) * (first === null ? -1 : 1) : (first ?? r.range(g.stone[0], g.stone[1]));
      first = null;
      if (L / 2 - (u + len) < g.stone[0] * 0.5) len = L / 2 - u;
      const mid = u + len / 2;
      if (y1 <= heightAt(mid) - capH * (broken > 0 ? 0 : 1) + 0.0001 || c === 0) {
        const seam = level === 0 ? 0.006 : 0;
        const back = r.range(0, inset);
        const front = r.range(0, inset);
        // (No seam at the wall's own ends, and the first stone of the bottom course out to the faces: the piece fills its bounds.)
        const s0 = u <= -L / 2 + 0.0001 ? 0 : seam;
        const s1 = u + len >= L / 2 - 0.0001 ? 0 : seam;
        const flush = c === 0 && s0 === 0;
        f.bx(m, u + s0, y0 + (c ? seam : 0), -T / 2 + (flush ? 0 : back), u + len - s1, y1 - seam, T / 2 - (flush ? 0 : front), tint(stone), c ? [] : ['ny']);
      }
      u += len;
    }
    if (level === 0) f.bx(m, -L / 2 + 0.01, y0, -T / 2 + inset + 0.004, Math.min(L / 2 - 0.01, broken > 0 ? L / 2 : L / 2 - 0.01), Math.min(y1, heightAt(0)), T / 2 - inset - 0.004, dark, ['ny', 'py']);
  }
  // Capstones: flat, the full depth, where the wall still stands whole.
  let u = -L / 2;
  let caps = 0;
  while (u < L / 2 - 0.001) {
    let len = level === 1 ? L : r.range(g.stone[0] * 1.2, g.stone[1] * 1.5);
    if (level === 1 && broken > 0) len = L * 0.3;
    if (L / 2 - (u + len) < g.stone[0]) len = L / 2 - u;
    // (The first capstone is level with the top and reaches the end: the piece fills its bounds.)
    const whole = heightAt(u + len) >= h - 0.0001 || caps === 0;
    if (whole) f.bx(m, u + (caps ? 0.004 : 0), h - capH, -T / 2, u + len - (u + len >= L / 2 - 0.0001 ? 0 : 0.004), h - (caps ? Math.abs(r.jitter(level === 0 ? 0.012 : 0)) : 0), T / 2, tint(scale3(stone, 0.92)));
    caps++;
    u += len;
    if (level === 1 && broken > 0) break;
  }
  if (broken > 0 && level === 0) {
    // Fallen stones at the foot of the low end, inside the bounds.
    for (let i = 0; i < 4; i++) {
      const s = r.range(0.1, 0.17);
      const uu = r.range(L * 0.05, L / 2 - s);
      const side = i % 2 ? 1 : -1;
      const top = Math.min(h * 0.5, heightAt(uu) + s * 0.6);
      f.bx(m, uu - s / 2, Math.max(0, top - s * 0.7), side * (T / 2 - s * 0.55) - s * 0.25, uu + s / 2, top, side * (T / 2 - s * 0.55) + s * 0.25, tint(stone), ['ny']);
    }
  }
  return m;
}

// ---------------------------------------------------------------- concrete road barriers

/**
 * A concrete road barrier (the "Jersey" profile): a wide foot, a sloped toe and a tall narrow stem, cut along its run
 * into bays so stripes can be painted on. Settings `g`: `foot` (the foot's height, m), `toe` (where the stem starts,
 * m), `stem` (the top's width, m), `waist` (the width where the stem starts), `bays` (stripes along the run), `slots`
 * (two lifting slots under it). `look`: `concrete`, `stripeA`, `stripeB` (hex: alternate bays painted on the upper
 * faces), `stripeFrom` (0–1 of the height the paint starts at), `grime`, `chips` (0–1: darker chipped patches).
 */
export function barrierMesh(seed, size, g, look, level) {
  const f = frame(size);
  const { L, T, h } = f;
  const m = new Mesh();
  const n = noise3(seed);
  const concrete = hex(look.concrete);
  const grime = look.grime ?? 0.3;
  const chips = look.chips ?? 0.2;
  const base = (c) => (p) => {
    const worn = 1 - chips * 0.4 * clamp01(n(p[0] * 2.3, p[1] * 2.3, p[2] * 2.3) - 0.25) * 2;
    return scale3(c, groundShade(p[1], 0.28, 1 - grime * 0.6) * worn * (1 - 0.08 * clamp01(n(p[0] * 11, p[1] * 11, p[2] * 11))));
  };
  const a = look.stripeA ? hex(look.stripeA) : null;
  const b = look.stripeB ? hex(look.stripeB) : null;
  // Half the profile, bottom to top: [half-width, height].
  const prof = level >= 1 ? [[T / 2, 0], [g.waist / 2, g.toe], [g.stem / 2, h]] : [[T / 2, 0], [T / 2, g.foot], [g.waist / 2, g.toe], [g.stem / 2, h]];
  // (The farthest level is bare concrete: the stripes are a metre wide and gone by then.)
  const bays = level === 0 && a ? Math.max(2, g.bays ?? 6) : 1;
  const from = h * (look.stripeFrom ?? 0.45);
  for (let i = 0; i < bays; i++) {
    const u0 = -L / 2 + (L * i) / bays;
    const u1 = u0 + L / bays;
    const paint = a && level < 2 ? (i % 2 ? (b ?? concrete) : a) : null;
    for (let k = 0; k + 1 < prof.length; k++) {
      const [w0, y0] = prof[k];
      const [w1, y1] = prof[k + 1];
      for (const s of [-1, 1]) {
        // The paint covers the stem above `from`: the face is cut there when it crosses it.
        const cut = paint && y0 < from && y1 > from ? [[y0, lerp(w0, w1, (from - y0) / (y1 - y0)), from]] : null;
        const parts = cut ? [[w0, y0, cut[0][1], from, false], [cut[0][1], from, w1, y1, true]] : [[w0, y0, w1, y1, !!paint && y0 >= from]];
        for (const [wa, ya, wb, yb, painted] of parts) {
          quadN(m, f.P(u0, ya, s * wa), f.P(u1, ya, s * wa), f.P(u1, yb, s * wb), f.P(u0, yb, s * wb), f.D(0, 0.3, s), base(painted ? paint : concrete));
        }
      }
    }
    // The top.
    quadN(m, f.P(u0, h, -g.stem / 2), f.P(u1, h, -g.stem / 2), f.P(u1, h, g.stem / 2), f.P(u0, h, g.stem / 2), f.D(0, 1, 0), base(paint ?? scale3(concrete, 1.05)));
  }
  // The ends: the profile as a fan of quads, mirrored.
  for (const s of [-1, 1]) {
    const u = (s * L) / 2;
    for (let k = 0; k + 1 < prof.length; k++) {
      const [w0, y0] = prof[k];
      const [w1, y1] = prof[k + 1];
      quadN(m, f.P(u, y0, -w0), f.P(u, y0, w0), f.P(u, y1, w1), f.P(u, y1, -w1), f.D(s, 0, 0), base(scale3(concrete, 0.94)));
    }
  }
  if (level === 0 && g.slots) {
    // Lifting slots: two dark recesses under the foot on each side (drawn as dark panels just proud of the face).
    const dark = scale3(concrete, 0.18);
    for (const s of [-1, 1])
      for (const uc of [-L * 0.27, L * 0.27]) {
        quadN(m, f.P(uc - 0.11, 0, s * (T / 2 + 0.001)), f.P(uc + 0.11, 0, s * (T / 2 + 0.001)), f.P(uc + 0.11, g.foot * 0.75, s * (T / 2 + 0.001)), f.P(uc - 0.11, g.foot * 0.75, s * (T / 2 + 0.001)), f.D(0, 0, s), dark);
      }
  }
  return m;
}

const lerp = (p, q, t) => p + (q - p) * t;
