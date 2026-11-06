// Temporary (not committed): Shingle Point before vs after its asset refresh. Run with SHINGLE_BEFORE=<file>.
import { beforeAll, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { DEFAULT_DEATHMATCH_RULES, blockBoxes, initPhysics, loadMap, propBoxes, type MapDocument, type WorldBox } from '../src/index.ts';
import { Match, initNavigation } from '../src/match.ts';
import { terrainHeightAt } from '../src/map/terrain.ts';

const load = (text: string): MapDocument => {
  const r = loadMap(text);
  if (!r.ok) throw new Error('load failed');
  return r.map;
};
beforeAll(async () => {
  await Promise.all([initPhysics(), initNavigation()]);
});

/** The four ground corners and the y range of a (yawed) world box. */
function corners(b: WorldBox): { pts: [number, number][]; y: [number, number] } {
  const cx = (b.min[0] + b.max[0]) / 2;
  const cz = (b.min[2] + b.max[2]) / 2;
  const hw = (b.max[0] - b.min[0]) / 2;
  const hd = (b.max[2] - b.min[2]) / 2;
  const t = b.yaw ?? 0;
  const [c, s] = [Math.cos(t), Math.sin(t)];
  const pts = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([x, z]) => [cx + x! * c + z! * s, cz - x! * s + z! * c] as [number, number]);
  return { pts, y: [b.min[1], b.max[1]] };
}
const vol = (b: WorldBox) => (b.max[0] - b.min[0]) * (b.max[1] - b.min[1]) * (b.max[2] - b.min[2]);

it('Shingle Point: before vs after', () => {
  const before = load(readFileSync(process.env.SHINGLE_BEFORE!, 'utf8'));
  const after = load(readFileSync(new URL('../../../maps/shingle_point.json', import.meta.url), 'utf8'));
  const out: Record<string, unknown> = {};
  // 1. Everything but props, blocks and the theme is the same.
  const same = (k: string) => JSON.stringify(before.entities.filter((e) => e.kind === k)) === JSON.stringify(after.entities.filter((e) => e.kind === k));
  out.unchangedKinds = Object.fromEntries(['spawn', 'pickup', 'mount', 'ladder', 'pad', 'bombsite', 'hill', 'light', 'water'].map((k) => [k, same(k) ? `same (${before.entities.filter((e) => e.kind === k).length})` : 'DIFFERENT']));
  out.tiles = JSON.stringify(before.classicStructure.tiles) === JSON.stringify(after.classicStructure.tiles) ? 'same' : 'DIFFERENT';
  out.terrain = JSON.stringify(before.terrain) === JSON.stringify(after.terrain) ? 'same' : 'DIFFERENT';
  out.logic = JSON.stringify(before.logic) === JSON.stringify(after.logic) ? 'same' : 'DIFFERENT';
  out.theme = `${before.classicStructure.theme} -> ${after.classicStructure.theme}`;
  out.models = { before: new Set(before.entities.filter((e) => e.kind === 'prop').map((e) => e.model)).size, after: new Set(after.entities.filter((e) => e.kind === 'prop').map((e) => e.model)).size };
  // 2. Converted groups: block boxes before vs the new piece's boxes after (craft and wrecks: corner by corner).
  const plan = JSON.parse(readFileSync(process.env.SHINGLE_PLAN!, 'utf8')) as { kind: string; ids: string[]; placed: { id: string } }[];
  const bb = new Map(blockBoxes(before).map((b) => [b.sourceId, b]));
  const pb = propBoxes(after);
  const dev: Record<string, number[]> = {};
  const volume: Record<string, [number, number]> = {};
  for (const g of plan) {
    const olds = g.ids.map((id) => bb.get(id)!);
    const news = pb.filter((b) => b.sourceId === g.placed.id);
    const v = volume[g.kind] ?? [0, 0];
    v[0] += olds.reduce((s, b) => s + vol(b), 0);
    v[1] += news.reduce((s, b) => s + vol(b), 0);
    volume[g.kind] = v;
    if (g.kind === 'hedgehog') continue;
    // Each old box against its best-matching new box: largest corner distance (m) and top difference.
    let worst = 0;
    for (const o of olds) {
      const co = corners(o);
      let best = Infinity;
      for (const n of news) {
        const cn = corners(n);
        const d = Math.max(...co.pts.map((p) => Math.min(...cn.pts.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1])))));
        best = Math.min(best, Math.max(d, Math.abs(co.y[1] - cn.y[1])));
      }
      worst = Math.max(worst, best);
    }
    (dev[g.kind] ??= []).push(+worst.toFixed(3));
  }
  out.groupWorstCornerOrTopDeviation_m = dev;
  out.groupColliderVolume_m3 = Object.fromEntries(Object.entries(volume).map(([k, [a, b]]) => [k, `${a.toFixed(1)} -> ${b.toFixed(1)}`]));
  // 3. Matches: navigation and sightlines.
  const mb = new Match(before, DEFAULT_DEATHMATCH_RULES, 1);
  const ma = new Match(after, DEFAULT_DEATHMATCH_RULES, 1);
  const goals = before.entities.filter((e) => ['pickup', 'bombsite', 'hill'].includes(e.kind));
  const spawns = before.entities.filter((e) => e.kind === 'spawn');
  const navStats = (m: Match) => {
    let ok = 0;
    let len = 0;
    let n = 0;
    for (const s of spawns)
      for (const g of goals) {
        n++;
        const to = { x: g.position[0], y: g.position[1], z: g.position[2] };
        const path = m.nav.findPath({ x: s.position[0], y: s.position[1], z: s.position[2] }, to);
        const end = path?.[path.length - 1];
        if (!end || Math.hypot(end.x - to.x, end.z - to.z) > 1.5 || Math.abs(end.y - to.y) > 2) continue;
        ok++;
        for (let i = 1; i < path!.length; i++) len += Math.hypot(path![i]!.x - path![i - 1]!.x, path![i]!.y - path![i - 1]!.y, path![i]!.z - path![i - 1]!.z);
      }
    return { reached: `${ok}/${n}`, meanPath_m: +(len / Math.max(1, ok)).toFixed(1) };
  };
  out.nav = { before: navStats(mb), after: navStats(ma) };
  // Sightlines: beach eyes (crouched 1.0 m and standing 1.6 m) to the crest (standing), the crest down to the beach,
  // and across the village; the share blocked.
  const t = before.terrain!;
  const ground = (x: number, z: number) => terrainHeightAt(t, x, z);
  const rnd = (() => {
    let s = 7;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  })();
  const pts = (n: number, x0: number, x1: number, z0: number, z1: number) => Array.from({ length: n }, () => [x0 + rnd() * (x1 - x0), z0 + rnd() * (z1 - z0)] as [number, number]);
  const beach = pts(150, -100, 100, -78, -22);
  const crest = pts(40, -100, 100, 4, 22);
  const village = pts(60, -100, 100, 40, 125);
  const blocked = (m: Match, a: [number, number], ah: number, b: [number, number], bh: number) => {
    const o = { x: a[0], y: ground(a[0], a[1]) + ah, z: a[1] };
    const p = { x: b[0], y: ground(b[0], b[1]) + bh, z: b[1] };
    const d = { x: p.x - o.x, y: p.y - o.y, z: p.z - o.z };
    const L = Math.hypot(d.x, d.y, d.z);
    const hit = m.physics.raycastWorld(o, { x: d.x / L, y: d.y / L, z: d.z / L }, L - 0.3);
    return hit !== null;
  };
  const share = (m: Match, A: [number, number][], ah: number, B: [number, number][], bh: number) => {
    let n = 0;
    let k = 0;
    for (const a of A) for (const b of B) (n++, blocked(m, a, ah, b, bh) && k++);
    return +((100 * k) / n).toFixed(2);
  };
  const near = (A: [number, number][], B: [number, number][], r: number) => A.flatMap((a) => B.filter((b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < r).map((b) => [a, b] as const));
  const pairShare = (m: Match, pairs: (readonly [[number, number], [number, number]])[], h: number) => +((100 * pairs.filter(([a, b]) => blocked(m, a, h, b, h)).length) / pairs.length).toFixed(2);
  const beachPairs = near(beach, beach, 30);
  const villagePairs = near(village, village, 40);
  out.sightlinesBlockedPercent = {
    beachCrouched_to_crest: [share(mb, beach, 1.0, crest, 1.6), share(ma, beach, 1.0, crest, 1.6)],
    beachStanding_to_crest: [share(mb, beach, 1.6, crest, 1.6), share(ma, beach, 1.6, crest, 1.6)],
    acrossBeach_within30m_crouched: [pairShare(mb, beachPairs, 1.0), pairShare(ma, beachPairs, 1.0)],
    acrossBeach_within30m_standing: [pairShare(mb, beachPairs, 1.6), pairShare(ma, beachPairs, 1.6)],
    village_within40m_standing: [pairShare(mb, villagePairs, 1.6), pairShare(ma, villagePairs, 1.6)],
    village_to_crest_standing: [share(mb, village, 1.6, crest, 1.6), share(ma, village, 1.6, crest, 1.6)],
    pairs: { beachToCrest: beach.length * crest.length, beach: beachPairs.length, village: villagePairs.length },
  };
  writeFileSync(process.env.SHINGLE_OUT!, JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
}, 900000);
