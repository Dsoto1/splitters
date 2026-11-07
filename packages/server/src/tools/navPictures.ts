import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { loadMap, type MapDocument, type Vec3 } from '@tiletrigger/shared';
import { auditNavigation, dropOptions, findCorridors, mapNavigation, polyShapes, teamHome, type NavAudit, type NavWorld, type Trip } from '@tiletrigger/shared/match';

/**
 * A map's navigation picture (docs/BOTS.md, "Navigation audit"), top-down: the navmesh by what the audit makes of
 * it (the main area shaded by height, one-way areas, traps, islands), its links (jump pads, ladders, portals,
 * ziplines, lifts) and ledge-drop links, spawn points, objectives, pickups, and where route searches failed in
 * scorecard runs. Written to `<dir>/<map id>.png`.
 */
export function drawNavPicture(dir: string, map: MapDocument, nav: NavWorld, audit: NavAudit, fails: readonly (readonly number[])[], trips: readonly Trip[] = []): string {
  const g = audit.graph;
  const { centre } = polyShapes(g);
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < g.count; i++) {
    if (g.type[i] !== 0) continue;
    for (let k = g.vstart[i]!; k < g.vstart[i + 1]!; k++) {
      minX = Math.min(minX, g.vxyz[k * 3]!);
      maxX = Math.max(maxX, g.vxyz[k * 3]!);
      minZ = Math.min(minZ, g.vxyz[k * 3 + 2]!);
      maxZ = Math.max(maxZ, g.vxyz[k * 3 + 2]!);
      minY = Math.min(minY, g.vxyz[k * 3 + 1]!);
      maxY = Math.max(maxY, g.vxyz[k * 3 + 1]!);
    }
  }
  if (!Number.isFinite(minX)) {
    minX = minZ = -10;
    maxX = maxZ = 10;
    minY = maxY = 0;
  }
  const pad = 4;
  const scale = Math.min(6, 1500 / Math.max(10, maxX - minX + pad * 2), 1500 / Math.max(10, maxZ - minZ + pad * 2));
  const head = 34;
  const width = Math.ceil((maxX - minX + pad * 2) * scale);
  const height = Math.ceil((maxZ - minZ + pad * 2) * scale) + head;
  const W = Math.max(width, 620);
  const png = new PNG({ width: W, height });
  const px = png.data;
  const set = (x: number, y: number, c: readonly number[], a = 1) => {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= W || y >= height) return;
    const o = (y * W + x) * 4;
    px[o] = Math.round(px[o]! * (1 - a) + c[0]! * a);
    px[o + 1] = Math.round(px[o + 1]! * (1 - a) + c[1]! * a);
    px[o + 2] = Math.round(px[o + 2]! * (1 - a) + c[2]! * a);
    px[o + 3] = 255;
  };
  for (let y = 0; y < height; y++) for (let x = 0; x < W; x++) set(x, y, BG);
  // Map x to the right, z down the picture (as MapMaker's top view: north up is -z).
  const sx = (x: number) => (x - minX + pad) * scale;
  const sz = (z: number) => (z - minZ + pad) * scale + head;
  const trap = new Uint8Array(g.count);
  const island = new Uint8Array(g.count);
  for (const p of audit.patches) for (const i of p.polys) (audit.traps.includes(p) ? trap : island)[i] = 1;
  // Polygons, lowest first (the higher floor over the lower).
  const order = [...Array(g.count).keys()].filter((i) => g.type[i] === 0 && g.flags[i] !== 0).sort((a, b) => centre[a * 3 + 1]! - centre[b * 3 + 1]!);
  for (const i of order) {
    const t = maxY > minY ? (centre[i * 3 + 1]! - minY) / (maxY - minY) : 0.5;
    const c = trap[i] ? TRAP : island[i] ? ISLAND : !audit.fromMain[i] ? mix(ONE_WAY_LO, ONE_WAY_HI, t) : mix(MAIN_LO, MAIN_HI, t);
    const pts: [number, number][] = [];
    for (let k = g.vstart[i]!; k < g.vstart[i + 1]!; k++) pts.push([sx(g.vxyz[k * 3]!), sz(g.vxyz[k * 3 + 2]!)]);
    fillPolygon(pts, (x, y) => set(x, y, c));
    // Open edges (where walking ends) a little darker, so floors read as shapes.
    for (let j = 0; j < pts.length; j++) if (g.open[i]! & (1 << j)) line(pts[j]!, pts[(j + 1) % pts.length]!, (x, y) => set(x, y, EDGE, 0.6));
  }
  // Links: the map's (pads, ladders, portals, ziplines, lifts), then the drop links (the last ones the build added).
  const links: number[] = [];
  for (let i = 0; i < g.count; i++) if (g.type[i] !== 0) links.push(i);
  links.forEach((i, k) => {
    const a = g.vstart[i]! * 3;
    const drop = k >= links.length - nav.drops;
    const from: [number, number] = [sx(g.vxyz[a]!), sz(g.vxyz[a + 2]!)];
    const to: [number, number] = [sx(g.vxyz[a + 3]!), sz(g.vxyz[a + 5]!)];
    line(from, to, (x, y) => set(x, y, drop ? DROP : LINK));
    dot(to[0], to[1], 1, drop ? DROP : LINK, set);
  });
  // Corridors (route variety: nav/corridors.ts), the first (shortest) of each trip last, so it shows on top.
  for (const t of trips) {
    for (let k = t.corridors.length - 1; k >= 0; k--) {
      const c = ROUTE[k % ROUTE.length]!;
      const pts = t.corridors[k]!.line;
      for (let i = 1; i < pts.length; i++) {
        const a: [number, number] = [sx(pts[i - 1]!.x), sz(pts[i - 1]!.z)];
        const b: [number, number] = [sx(pts[i]!.x), sz(pts[i]!.z)];
        line(a, b, (x, y) => {
          set(x, y, c, 0.9);
          set(x + 1, y, c, 0.9);
          set(x, y + 1, c, 0.9);
        });
      }
    }
  }
  // Failed route searches (scorecard runs): where the bot was.
  for (const f of fails) {
    const x = sx(f[0]!);
    const y = sz(f[2]!);
    for (let d = -2; d <= 2; d++) {
      set(x + d, y + d, FAIL);
      set(x + d, y - d, FAIL);
    }
  }
  for (const e of map.entities) {
    const x = sx(e.position[0]);
    const y = sz(e.position[2]);
    if (e.kind === 'pickup') dot(x, y, 1, PICKUP, set);
    else if (e.kind === 'spawn') {
      dot(x, y, 3, OUTLINE, set);
      dot(x, y, 2, SPAWN, set);
    } else if (e.kind === 'hill') ring(x, y, Math.max(3, ((e as { radius?: number }).radius ?? 3) * scale), OBJECTIVE, set);
    else if (e.kind === 'flag' || e.kind === 'bombsite' || e.kind === 'hostage' || e.kind === 'rescue' || e.kind === 'objective') {
      dot(x, y, 4, OUTLINE, set);
      dot(x, y, 3, OBJECTIVE, set);
    }
  }
  // Title and legend.
  const islands = audit.patches.length - audit.traps.length;
  text(`${map.metadata.id}  TRAPS ${audit.traps.length}  ISLANDS ${islands}  DROP LINKS ${nav.drops}  FAILED SEARCHES ${fails.length}${trips.length ? `  ROUTES ${trips.map((t) => t.corridors.length).join('/')}` : ''}`, 6, 4, TEXT, set);
  let lx = 6;
  for (const [label, c] of LEGEND) {
    for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) set(lx + x, 18 + y, c);
    lx += 10;
    lx = text(label, lx, 18, TEXT, set) + 10;
  }
  mkdirSync(dir, { recursive: true });
  const file = `${dir}/${map.metadata.id}.png`;
  writeFileSync(file, PNG.sync.write(png));
  return file;
}

/** The pictures for the maps a scorecard run played, each with its failed searches (all its matches, every mode). */
export async function drawNavPictures(dir: string, mapsDir: string, rows: readonly { map: string; fails?: readonly (readonly number[])[] }[]): Promise<void> {
  const byMap = new Map<string, (readonly number[])[]>();
  for (const r of rows) {
    const list = byMap.get(r.map) ?? byMap.set(r.map, []).get(r.map)!;
    for (const f of r.fails ?? []) list.push(f);
  }
  for (const [id, fails] of [...byMap].sort((a, b) => a[0].localeCompare(b[0]))) {
    const loaded = loadMap(readFileSync(`${mapsDir}${id}.json`, 'utf8'));
    if (!loaded.ok) continue;
    const built = mapNavigation(loaded.map);
    const audit = auditNavigation(loaded.map, built.nav, built.physics, { ...dropOptions(loaded.map, built.physics, built.geometry, built.phys), official: true });
    const file = drawNavPicture(dir, loaded.map, built.nav, audit, fails, mapTrips(loaded.map, built.nav));
    console.log(`nav picture: ${file} (${audit.traps.length} traps, ${fails.length} failed searches)`);
    built.physics.free();
    built.nav.destroy();
  }
}

/**
 * The corridors to draw for a map: its two flags' (each way's are much the same: one way), else each team's way to
 * the hills, the bomb sites or the hostages, else from each team's spawn to the other's.
 */
export function mapTrips(map: MapDocument, nav: NavWorld): Trip[] {
  const at = (e: { position: readonly number[] }): Vec3 => ({ x: e.position[0]!, y: e.position[1]!, z: e.position[2]! });
  const flags = map.entities.filter((e) => e.kind === 'flag');
  if (flags.length >= 2) return [findCorridors(nav, at(flags[0]!), at(flags[1]!))];
  const spawns = map.entities.filter((e) => e.kind === 'spawn').map((e) => ({ pos: at(e), team: (e as { faction?: string | null }).faction ?? null }));
  const teams = [...new Set(spawns.map((s) => s.team).filter((t): t is string => !!t))].sort();
  const homes = teams.map((t) => teamHome(spawns, t)).filter((h): h is Vec3 => !!h);
  const goals = map.entities.filter((e) => e.kind === 'hill' || e.kind === 'bombsite' || e.kind === 'hostage').map(at);
  if (homes.length && goals.length) return homes.flatMap((h) => goals.map((g) => findCorridors(nav, h, g)));
  return homes.length >= 2 ? [findCorridors(nav, homes[0]!, homes[1]!)] : [];
}

type Rgb = readonly [number, number, number];
const BG: Rgb = [22, 23, 28];
const EDGE: Rgb = [10, 10, 14];
const MAIN_LO: Rgb = [58, 68, 88];
const MAIN_HI: Rgb = [170, 186, 210];
const ONE_WAY_LO: Rgb = [40, 96, 90];
const ONE_WAY_HI: Rgb = [110, 200, 180];
const TRAP: Rgb = [228, 52, 40];
const ISLAND: Rgb = [118, 72, 150];
const LINK: Rgb = [235, 205, 60];
const DROP: Rgb = [255, 140, 20];
const SPAWN: Rgb = [70, 225, 100];
const OUTLINE: Rgb = [0, 0, 0];
const OBJECTIVE: Rgb = [255, 236, 40];
const PICKUP: Rgb = [80, 220, 245];
const FAIL: Rgb = [255, 60, 220];
const TEXT: Rgb = [235, 235, 235];
/** Each trip's corridors: the shortest, the second, the third. */
const ROUTE: readonly Rgb[] = [
  [40, 140, 255],
  [255, 95, 95],
  [250, 250, 250],
];
const LEGEND: [string, Rgb][] = [
  ['MAIN', MAIN_HI],
  ['ONE-WAY', ONE_WAY_HI],
  ['TRAP', TRAP],
  ['ISLAND', ISLAND],
  ['LINK', LINK],
  ['DROP', DROP],
  ['SPAWN', SPAWN],
  ['OBJECTIVE', OBJECTIVE],
  ['PICKUP', PICKUP],
  ['FAILED SEARCH', FAIL],
  ['ROUTES 1 2 3', ROUTE[0]!],
];

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

type Plot = (x: number, y: number, c: Rgb, a?: number) => void;

/** Fills a convex polygon (pixel centres inside it). */
function fillPolygon(pts: readonly [number, number][], plot: (x: number, y: number) => void): void {
  if (pts.length < 3) return;
  const y0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[1]))));
  const y1 = Math.ceil(Math.max(...pts.map((p) => p[1])));
  for (let y = y0; y <= y1; y++) {
    const cy = y + 0.5;
    let lo = Infinity;
    let hi = -Infinity;
    for (let j = 0; j < pts.length; j++) {
      const [ax, ay] = pts[j]!;
      const [bx, by] = pts[(j + 1) % pts.length]!;
      if ((ay <= cy && by > cy) || (by <= cy && ay > cy)) {
        const x = ax + ((cy - ay) / (by - ay)) * (bx - ax);
        lo = Math.min(lo, x);
        hi = Math.max(hi, x);
      }
    }
    if (lo > hi) continue;
    for (let x = Math.round(lo); x < Math.round(hi); x++) plot(x, y);
    // (Slivers narrower than a pixel still show.)
    if (Math.round(lo) >= Math.round(hi)) plot(Math.floor(lo), y);
  }
}

function line(a: readonly [number, number], b: readonly [number, number], plot: (x: number, y: number) => void): void {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))));
  for (let i = 0; i <= n; i++) plot(a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n);
}

function dot(x: number, y: number, r: number, c: Rgb, plot: Plot): void {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + r) plot(x + dx, y + dy, c);
}

function ring(x: number, y: number, r: number, c: Rgb, plot: Plot): void {
  const n = Math.max(12, Math.ceil(r * 6));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    plot(x + Math.cos(a) * r, y + Math.sin(a) * r, c);
    plot(x + Math.cos(a) * (r - 1), y + Math.sin(a) * (r - 1), c);
  }
}

/** Writes `s` in a 5 × 7 pixel font (capitals, digits and a little punctuation); returns where it ends. */
function text(s: string, x: number, y: number, c: Rgb, plot: Plot): number {
  for (const ch of s.toUpperCase()) {
    const rows = FONT[ch] ?? FONT[' ']!;
    for (let r = 0; r < 7; r++) for (let b = 0; b < 5; b++) if (rows[r]! & (16 >> b)) plot(x + b, y + r, c);
    x += 6;
  }
  return x;
}

const FONT: Record<string, readonly number[]> = {
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14], D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16], G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17], S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 17, 10, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
  '0': [14, 17, 19, 21, 25, 17, 14], '1': [4, 12, 4, 4, 4, 4, 14], '2': [14, 17, 1, 2, 4, 8, 31], '3': [31, 2, 4, 2, 1, 17, 14],
  '4': [2, 6, 10, 18, 31, 2, 2], '5': [31, 16, 30, 1, 1, 17, 14], '6': [6, 8, 16, 30, 17, 17, 14], '7': [31, 1, 2, 4, 8, 8, 8],
  '8': [14, 17, 17, 14, 17, 17, 14], '9': [14, 17, 17, 15, 1, 2, 12],
  ' ': [0, 0, 0, 0, 0, 0, 0], '.': [0, 0, 0, 0, 0, 12, 12], ',': [0, 0, 0, 0, 12, 4, 8], ':': [0, 12, 12, 0, 12, 12, 0],
  '%': [24, 25, 2, 4, 8, 19, 3], '-': [0, 0, 0, 31, 0, 0, 0], '(': [2, 4, 8, 8, 8, 4, 2], ')': [8, 4, 2, 2, 2, 4, 8],
  '/': [0, 1, 2, 4, 8, 16, 0], _: [0, 0, 0, 0, 0, 0, 31], '+': [0, 4, 4, 31, 4, 4, 0], '=': [0, 0, 31, 0, 31, 0, 0],
};
