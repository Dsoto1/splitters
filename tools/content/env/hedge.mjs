// Clipped hedges (env.hedge.*): a hedge section `length` long (along z, as the Kenney hedges it replaces lie),
// `height` tall and `width` deep, its top edges rounded by the clippers and its faces a little uneven. A core of
// leaf (the hedges atlas card's solid middle, so you never see through it) wrapped in leaf cards (hedge.0) set
// just proud of the surface, facing out with some scatter, darker low down and inside, lighter on top.
// Collision (shared): the block as one hull that stops everything (it is a wall), surface foliage.

import { rng } from './rng.mjs';
import { fbm3 } from './noise.mjs';
import { Mesh, add, cross, mul, norm, perp } from './mesh.mjs';
import { card } from './branches.mjs';
import { toLinear } from './tree.mjs';

/** The hedge's surface: half sizes and the rounding (shared by levels and variants). */
export function hedgeSkeleton(seed, g) {
  return { hx: g.width / 2, hz: g.length / 2, H: g.height, round: g.round, bump: fbm3(seed + 13, 2) };
}

/** A point on the clipped surface for a face and (s, t) in [-1, 1]², and its outward normal. */
function surface(sk, face, s, t) {
  const { hx, hz, H, round } = sk;
  let p;
  let n;
  if (face === 'top') {
    p = [s * (hx - round), H, t * (hz - round * 0.5)];
    n = [0, 1, 0];
  } else if (face === 'x+' || face === 'x-') {
    const sg = face === 'x+' ? 1 : -1;
    // A little batter (narrower at the top), the top edge rolled over.
    const y = (t * 0.5 + 0.5) * (H - round);
    p = [sg * (hx - 0.04 * (y / H)), y, s * hz];
    n = [sg, 0.08, 0];
  } else {
    const sg = face === 'z+' ? 1 : -1;
    const y = (t * 0.5 + 0.5) * (H - round);
    p = [s * (hx - 0.04), y, sg * hz];
    n = [0, 0.05, sg];
  }
  return { p, n: norm(n) };
}

/** The rounded edge between the top and a side: a quarter circle of radius `round`. */
function edgePoint(sk, side, s, a) {
  const { hx, hz, H, round } = sk;
  const c = Math.cos(a);
  const sn = Math.sin(a);
  if (side === 'x+' || side === 'x-') {
    const sg = side === 'x+' ? 1 : -1;
    return { p: [sg * (hx - round + round * sn), H - round + round * c, s * hz], n: norm([sg * sn, c, 0]) };
  }
  const sg = side === 'z+' ? 1 : -1;
  return { p: [s * (hx - round), H - round + round * c, sg * (hz - round * 0.5 + round * 0.5 * sn)], n: norm([0, c, sg * sn]) };
}

/** One level of detail: { leaf }. lod = { cards, cardScale }. */
export function hedgeMesh(seed, sk, g, lod, look, atlas) {
  const r = rng(seed + 5);
  const leaf = new Mesh();
  const info = atlas.cards['hedge.0'];
  const greens = look.leaves.map(toLinear);
  const { hx, hz, H } = sk;
  // The core: five faces inset a little, textured with the card's solid middle.
  {
    const [u0, v0, u1, v1] = info.uv;
    const cu = [u0 + (u1 - u0) * 0.3, u0 + (u1 - u0) * 0.7];
    const cv = [v0 + (v1 - v0) * 0.3, v0 + (v1 - v0) * 0.7];
    const ix = hx - 0.07;
    const iz = hz - 0.07;
    const top = H - 0.06;
    const dark = greens[0].map((c) => c * 0.55);
    const face = (a, b, c, d, n) => {
      const ids = [a, b, c, d].map((p, k) => leaf.vertex(p, n, [cu[k === 1 || k === 2 ? 1 : 0], cv[k >= 2 ? 1 : 0]], p[1] > H * 0.8 ? dark.map((x) => x * 1.25) : dark, [0, 0]));
      leaf.quad(ids[0], ids[1], ids[2], ids[3]);
    };
    face([ix, 0, iz], [ix, 0, -iz], [ix, top, -iz], [ix, top, iz], [1, 0, 0]);
    face([-ix, 0, -iz], [-ix, 0, iz], [-ix, top, iz], [-ix, top, -iz], [-1, 0, 0]);
    face([-ix, 0, iz], [ix, 0, iz], [ix, top, iz], [-ix, top, iz], [0, 0, 1]);
    face([ix, 0, -iz], [-ix, 0, -iz], [-ix, top, -iz], [ix, top, -iz], [0, 0, -1]);
    face([-ix, top, iz], [ix, top, iz], [ix, top, -iz], [-ix, top, -iz], [0, 1, 0]);
  }
  // Cards, shared out over the faces by area (the rounded top edges get their share too).
  const areas = {
    top: (hx * 2 - g.round * 2) * (hz * 2 - g.round),
    'x+': hz * 2 * (H - g.round),
    'x-': hz * 2 * (H - g.round),
    'z+': hx * 2 * (H - g.round),
    'z-': hx * 2 * (H - g.round),
    'e:x+': hz * 2 * g.round * 1.57,
    'e:x-': hz * 2 * g.round * 1.57,
    'e:z+': hx * 2 * g.round * 1.57,
    'e:z-': hx * 2 * g.round * 1.57,
  };
  const total = Object.values(areas).reduce((a, b) => a + b, 0);
  for (const [face, area] of Object.entries(areas)) {
    const n = Math.max(1, Math.round((lod.cards * area) / total));
    // Stratified: a jittered grid over the face, so the cards cover it evenly.
    const cols = Math.max(1, Math.round(Math.sqrt(n * (face.endsWith('x+') || face.endsWith('x-') || face === 'top' ? 3 : 1))));
    const rows = Math.max(1, Math.ceil(n / cols));
    for (let k = 0; k < n; k++) {
      const s = ((k % cols) + 0.5 + r.jitter(0.4)) / cols;
      const t = (Math.floor(k / cols) + 0.5 + r.jitter(0.4)) / rows;
      const at = face.startsWith('e:') ? edgePoint(sk, face.slice(2), s * 2 - 1, (t * Math.PI) / 2) : surface(sk, face, s * 2 - 1, t * 2 - 1);
      const bump = sk.bump(at.p[0] * 1.3, at.p[1] * 1.3, at.p[2] * 1.3);
      const c = add(at.p, mul(at.n, 0.02 + 0.06 * bump + r.range(0, 0.03)));
      const face0 = norm(add(at.n, mul(r.unit(), 0.45)));
      const up = norm(cross(face0, perp(face0)));
      const base = greens[r.int(0, greens.length - 1)];
      // Low and shaded faces darker; the clipped top in the sun lighter.
      const lightness = (0.62 + 0.38 * Math.min(1, c[1] / H)) * (at.n[1] > 0.5 ? 1.12 : 1) * (0.9 + 0.2 * bump) * (1 + r.jitter(look.jitter));
      const size = g.cardSize * lod.cardScale * r.range(0.85, 1.15);
      card(leaf, { c, up, face: face0, size, card: info, colour: base.map((x) => x * lightness), lit: norm(add(at.n, [0, 0.35, 0])), wind: () => [0.05, 0.25] });
    }
  }
  return { leaf };
}

/** Gameplay shape: the block as a hull (stops everything), its top at the clipped height. */
export function hedgeShapes(sk) {
  const { hx, hz, H } = sk;
  const pts = [];
  for (const x of [-hx, hx]) for (const y of [0, H]) for (const z of [-hz, hz]) pts.push([x, y, z]);
  return [{ kind: 'hull', points: pts, blocks: 'all', surface: 'foliage' }];
}
