// Deadwood.
//
// Fallen log (env.deadwood.log): a trunk lying on its side along z, on the ground. Its own taper from the butt
// (z = -length / 2) to the top end, a slight bow, an uneven cross-section (lumps from a noise field) pressed flat where
// it lies. The butt is sawn: a flat face a little off square, with growth rings (vertex colours, no picture). The top
// end is broken: a ragged rim and splintered wood behind it. One or two broken branch stubs stand up from it. Bark is
// the oak strip of the bark picture, with patches weathered to grey where the bark has gone; a variant's `cover`
// grows moss on what faces up.
//
// Two parts: `bark` (material env.bark) and `wood` (env.grass: vertex colours only, for the cut and broken faces).
// Levels of detail: lod = { sides, segments, rings (fractions of the radius, the sawn face's rings), stubs (sides of
// a stub; 0 = none) }. Collision: one hull, three rings of eight points along the trunk (stubs are not part of it).

import { rng } from './rng.mjs';
import { fbm3, smoothstep } from './noise.mjs';
import { Mesh, add, cross, dot, mul, norm, sub } from './mesh.mjs';
import { BARK_STRIPS } from './textures.mjs';
import { toLinear } from './tree.mjs';

/** The log's shape: { L, point(a, t), centre(t), radius(t), jag(a), cut(x, y), stubs, r }. `a` runs from +x up through +y. */
export function logSkeleton(seed, g) {
  const r = rng(seed);
  const L = g.length;
  const lumps = fbm3(seed + 11, 3);
  const rim = fbm3(seed + 12, 3);
  const bowAt = r.jitter(1);
  const radius = (t) => g.radius[0] + (g.radius[1] - g.radius[0]) * t ** 0.8 + (g.flare ?? 0) * Math.exp(-t / 0.08);
  const centre = (t) => [g.bow * bowAt * Math.sin(Math.PI * t), radius(t) - g.sink, -L / 2 + t * L];
  const rad = (a, t) => radius(t) * (1 + g.lump * lumps(Math.cos(a) * 1.4, Math.sin(a) * 1.4, t * L * 1.2));
  const point = (a, t) => {
    const c = centre(t);
    const k = rad(a, t);
    // Where it lies on the ground it is pressed flat (a hand's width under the surface at most).
    return [c[0] + Math.cos(a) * k, Math.max(-0.03, c[1] + Math.sin(a) * k), c[2]];
  };
  // The sawn butt: a plane a little off square.
  const tilt = [r.jitter(g.cutTilt ?? 0.06), r.jitter(g.cutTilt ?? 0.06)];
  const cut = (x, y) => tilt[0] * x + tilt[1] * (y - centre(0)[1]);
  // The broken end: how far each part of the rim sticks out past the nominal end (ragged, with a few teeth).
  const teeth = r.next() * Math.PI * 2;
  const jag = (a) => g.jag * (Math.max(0, 0.35 + 0.75 * rim(Math.cos(a) * 2.6, Math.sin(a) * 2.6, 0.5)) + 0.45 * Math.max(0, Math.sin(a * 5 + teeth)) ** 2);
  const stubs = [];
  const n = r.int(g.stubs[0], g.stubs[1]);
  for (let i = 0; i < n; i++) {
    // Up from the top of the trunk, the first near upright (it sets the log's height), the rest more to a side.
    const t = i === 0 ? r.range(0.3, 0.45) : r.range(0.6, 0.8);
    const a = Math.PI / 2 + (i === 0 ? r.jitter(0.15) : (r.chance(0.5) ? 1 : -1) * r.range(0.45, 0.7));
    const lean = r.jitter(0.3);
    stubs.push({ t, a, dir: norm([Math.cos(a), Math.sin(a), lean]), length: i === 0 ? g.stubLength[1] : r.range(g.stubLength[0], g.stubLength[1] * 0.8), r: r.range(g.stubRadius[0], g.stubRadius[1]), turn: r.next() * Math.PI });
  }
  return { L, point, centre, radius, rad, jag, cut, stubs };
}

/** Add triangle a, b, c to `m`, wound so that it faces along `dir`. */
function facing(m, a, b, c, dir) {
  const p = (i) => [m.P[i * 3], m.P[i * 3 + 1], m.P[i * 3 + 2]];
  if (dot(cross(sub(p(b), p(a)), sub(p(c), p(a))), dir) >= 0) m.tri(a, b, c);
  else m.tri(a, c, b);
}

/** One level of detail of the log: { bark: Mesh, wood: Mesh }. */
export function logMesh(seed, sk, g, lod, look) {
  const bark = new Mesh();
  const wood = new Mesh();
  const { L } = sk;
  const tone = fbm3(seed + 21, 3);
  const patch = fbm3(seed + 22, 2);
  const barkCol = toLinear(look.bark);
  const bare = toLinear(look.bare ?? look.bark);
  const heart = toLinear(look.heart);
  const sap = toLinear(look.sap);
  const cover = look.cover ? toLinear(look.cover) : null;
  const mix = (x, y, t) => x.map((v, i) => v + (y[i] - v) * t);
  const mossOn = (c, p, n) => {
    if (!cover) return c;
    const from = look.coverFrom ?? 0.45;
    const up = n[1] + 0.35 * tone(p[0] * 2.2 + 9, p[1] * 2.2, p[2] * 1.6);
    const m = smoothstep(from, from + 0.3, up) * (look.coverAmount ?? 1);
    return mix(c, mul(cover, 1 + 0.15 * tone(p[0] * 5 + 3, p[1] * 5, p[2] * 5)), m);
  };
  const barkColour = (p, n) => {
    // Darker where it meets the ground; patches where the bark has fallen away and the wood has weathered grey.
    const ao = 0.62 + 0.38 * Math.min(1, Math.max(0, p[1]) / 0.25);
    const gone = smoothstep(0.18, 0.42, patch(p[0] * 1.5, p[1] * 1.5, p[2] * 0.9));
    const shade = (1 + 0.16 * tone(p[0] * 3, p[1] * 3, p[2] * 1.5)) * ao;
    return mossOn(mul(mix(barkCol, bare, gone * (look.bareAmount ?? 0.7)), shade), p, n);
  };
  const strip = BARK_STRIPS.oak;
  const circ = 2 * Math.PI * g.radius[0];
  // The trunk's surface point: ring 0 lies in the sawn plane, the last ring is the ragged rim.
  const at = (a, t) => {
    const p = sk.point(a, t);
    if (t === 0) p[2] += sk.cut(p[0], p[1]);
    if (t === 1) p[2] += sk.jag(a);
    return p;
  };
  const normalAt = (a, t) => {
    const e = 1e-3;
    const t0 = Math.max(0, t - e);
    const t1 = Math.min(1, t + e);
    const n = cross(sub(sk.point(a + e, t), sk.point(a - e, t)), sub(sk.point(a, t1), sk.point(a, t0)));
    // Under the log (pressed flat) the surface faces down.
    return n[0] * n[0] + n[1] * n[1] + n[2] * n[2] < 1e-14 ? [0, -1, 0] : norm(n);
  };
  const S = lod.sides;
  const rings = [];
  for (let j = 0; j <= lod.segments; j++) {
    const t = j / lod.segments;
    const ring = [];
    for (let k = 0; k <= S; k++) {
      const a = (k / S) * Math.PI * 2;
      const p = at(a, t);
      const n = normalAt(a, t);
      ring.push(bark.vertex(p, n, [strip.u0 + (strip.u1 - strip.u0) * (k / S), (t * L) / (2 * circ)], barkColour(p, n)));
    }
    rings.push(ring);
  }
  for (let j = 0; j + 1 < rings.length; j++)
    for (let k = 0; k < S; k++) {
      bark.tri(rings[j][k], rings[j][k + 1], rings[j + 1][k + 1]);
      bark.tri(rings[j][k], rings[j + 1][k + 1], rings[j + 1][k]);
    }

  // The sawn butt: rings of the outline drawn in toward the pith, light and dark in turn (growth rings).
  {
    const c0 = sk.centre(0);
    const pith = [c0[0] + 0.02, c0[1] - 0.015];
    const n = norm([0, 0, -1]);
    const colourOf = (f, i) => {
      if (f >= 1) return mul(barkCol, 0.55);
      const dark = i % 2 === 1;
      const base = mix(heart, sap, smoothstep(0.45, 0.95, f));
      return mul(base, dark ? 0.72 : 1.05);
    };
    const ringAt = (f, i) => {
      const ids = [];
      for (let k = 0; k < S; k++) {
        const e = at((k / S) * Math.PI * 2, 0);
        const x = pith[0] + (e[0] - pith[0]) * f;
        const y = pith[1] + (e[1] - pith[1]) * f;
        const p = [x, y, -L / 2 + sk.cut(x, y)];
        ids.push(wood.vertex(p, n, [0, 0], mul(colourOf(f, i), 1 + 0.08 * tone(x * 14, y * 14, 3))));
      }
      return ids;
    };
    const fr = [...lod.rings].sort((a, b) => a - b);
    const loops = fr.map((f, i) => ringAt(f, i));
    const centre = wood.vertex([pith[0], pith[1], -L / 2 + sk.cut(pith[0], pith[1])], n, [0, 0], mul(heart, 0.7));
    for (let k = 0; k < S; k++) facing(wood, centre, loops[0][k], loops[0][(k + 1) % S], n);
    for (let i = 0; i + 1 < loops.length; i++)
      for (let k = 0; k < S; k++) {
        const k1 = (k + 1) % S;
        facing(wood, loops[i][k], loops[i + 1][k], loops[i + 1][k1], n);
        facing(wood, loops[i][k], loops[i + 1][k1], loops[i][k1], n);
      }
  }

  // The broken end: the ragged rim, the torn wood stepping back inside it, and a splintered heart. Flat facets
  // (each triangle its own corners), so the breaks read as breaks.
  {
    const c1 = sk.centre(1);
    const r = rng(seed + 31);
    const rough = lod.segments > 2;
    const rim = [];
    const inner = [];
    for (let k = 0; k < S; k++) {
      const e = at((k / S) * Math.PI * 2, 1);
      rim.push([e, mul(sap, 0.5)]);
      const f = rough ? r.range(0.35, 0.62) : 0.5;
      const back = rough ? r.range(0.03, g.jag * 1.5) : g.jag * 0.6;
      const p = [c1[0] + (e[0] - c1[0]) * f, Math.max(-0.03, c1[1] + (e[1] - c1[1]) * f), L / 2 - back + (k % 2 ? g.jag * 0.9 : 0)];
      inner.push([p, mul(sap, k % 2 ? 1 : 0.6)]);
    }
    const tip = [[c1[0], c1[1], L / 2 - g.jag * 0.9], mul(heart, 0.6)];
    const facet = (a, b, c) => {
      let n = norm(cross(sub(b[0], a[0]), sub(c[0], a[0])));
      const flip = n[2] < 0;
      if (flip) n = mul(n, -1);
      const ids = [a, flip ? c : b, flip ? b : c].map(([p, col]) => wood.vertex(p, n, [0, 0], col));
      wood.tri(ids[0], ids[1], ids[2]);
    };
    for (let k = 0; k < S; k++) {
      const k1 = (k + 1) % S;
      facet(rim[k], inner[k], inner[k1]);
      facet(rim[k], inner[k1], rim[k1]);
      facet(tip, inner[k], inner[k1]);
    }
  }

  // Branch stubs: short tapered tubes from inside the trunk, their broken ends pale wood.
  if (lod.stubs)
    for (const s of sk.stubs) {
      const n = lod.stubs;
      const c = sk.centre(s.t);
      const base = add(c, mul([Math.cos(s.a), Math.sin(s.a), 0], sk.rad(s.a, s.t) * 0.8));
      const tip = add(c, mul(s.dir, sk.rad(s.a, s.t) + s.length));
      const u = norm(cross(s.dir, [0, 0, 1]));
      const v = cross(s.dir, u);
      const loop = (at0, rad, colour, mesh, normal) => {
        const ids = [];
        for (let k = 0; k <= n; k++) {
          const a = s.turn + (k / n) * Math.PI * 2;
          const d = add(mul(u, Math.cos(a)), mul(v, Math.sin(a)));
          const p = add(at0, mul(d, rad));
          const nn = normal ?? d;
          ids.push(mesh.vertex(p, nn, [strip.u0 + ((strip.u1 - strip.u0) * k) / n / 3, 0], colour(p, nn)));
        }
        return ids;
      };
      const lo = loop(base, s.r * 1.25, barkColour, bark, null);
      const hi = loop(tip, s.r * 0.85, barkColour, bark, null);
      for (let k = 0; k < n; k++) {
        const mid = norm(sub(mul(add(sub([bark.P[lo[k] * 3], bark.P[lo[k] * 3 + 1], bark.P[lo[k] * 3 + 2]], base), sub([bark.P[lo[k + 1] * 3], bark.P[lo[k + 1] * 3 + 1], bark.P[lo[k + 1] * 3 + 2]], base)), 0.5), [0, 0, 0]));
        facing(bark, lo[k], lo[k + 1], hi[k + 1], mid);
        facing(bark, lo[k], hi[k + 1], hi[k], mid);
      }
      const cap = loop(tip, s.r * 0.85, () => mul(sap, 0.9), wood, s.dir);
      const mid = wood.vertex(add(tip, mul(s.dir, s.r * 0.35)), s.dir, [0, 0], mul(heart, 0.9));
      for (let k = 0; k < n; k++) facing(wood, mid, cap[k], cap[k + 1], s.dir);
    }
  return { bark, wood };
}

/** Gameplay shape: one hull round the trunk (three rings of eight points, just inside the bark); stops everything. */
export function logShapes(sk, surface) {
  const points = [];
  for (const t of [0, 0.5, 1])
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const p = sk.point(a, t);
      const c = sk.centre(t);
      // To the millimetre here (and never a negative zero), as the generated table stores them.
      points.push([c[0] + (p[0] - c[0]) * 0.97, p[1] <= -0.03 ? p[1] : c[1] + (p[1] - c[1]) * 0.97, p[2]].map((v) => Math.round(v * 1000) / 1000 + 0));
    }
  return [{ kind: 'hull', points, blocks: 'all', surface }];
}
