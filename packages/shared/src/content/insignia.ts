/**
 * Rank insignia (owner, 2026-11-17: "just for the soldiers"): a soldier's rank badge before their name in the kill
 * feed and on the scoreboard, and as the marker over their head. The rank is the one the soldier name theme gives
 * ("Sgt. Dunmore", botNames.ts); Soldiers & Spies' Agency wears the Agency mark instead. Everyone else has none (the
 * marker stays the arrow).
 *
 * Each badge is a few flat polygons in a box from -1 to 1 (y up), simple shapes that read small and far: chevrons
 * for the enlisted ranks (a rocker under for Pfc. and SSgt.), bars for the lieutenant and captain, stars for the
 * major and colonel, a ring round a dot for the Agency. Every polygon is star-shaped about its centroid, so a mesh can
 * fan it from there (game/view.ts); an SVG draws it as is (game/insigniaSvg.ts).
 */
import { lookBranch, lookGroup } from '../sim/npc.ts';

/** Soldier ranks, as written before a surname (botNames.ts gives them out). */
export const SOLDIER_RANKS = ['Pvt.', 'Pfc.', 'Cpl.', 'Sgt.', 'SSgt.', 'Lt.', 'Capt.', 'Maj.', 'Col.'] as const;
export type SoldierRank = (typeof SOLDIER_RANKS)[number];

export const INSIGNIA_IDS = ['pvt', 'pfc', 'cpl', 'sgt', 'ssgt', 'lt', 'capt', 'maj', 'col', 'agency'] as const;
export type InsigniaId = (typeof INSIGNIA_IDS)[number];

const RANK_INSIGNIA: Readonly<Record<SoldierRank, InsigniaId>> = { 'Pvt.': 'pvt', 'Pfc.': 'pfc', 'Cpl.': 'cpl', 'Sgt.': 'sgt', 'SSgt.': 'ssgt', 'Lt.': 'lt', 'Capt.': 'capt', 'Maj.': 'maj', 'Col.': 'col' };

/** Each badge's name (tooltips, screen readers). */
export const INSIGNIA_LABELS: Readonly<Record<InsigniaId, string>> = {
  pvt: 'Private',
  pfc: 'Private First Class',
  cpl: 'Corporal',
  sgt: 'Sergeant',
  ssgt: 'Staff Sergeant',
  lt: 'Lieutenant',
  capt: 'Captain',
  maj: 'Major',
  col: 'Colonel',
  agency: 'Agency',
};

/** Other ranks a character's own name may carry, as the rank they wear (a Flight Lieutenant ranks with a Captain). */
const OTHER_RANKS: Readonly<Record<string, SoldierRank>> = { 'Flt. Lt.': 'Capt.' };

/** The rank a name starts with ("Sgt. Dunmore" → "Sgt."; "Flt. Lt. Ember" → "Capt."), or null. */
export function nameRank(name: string | undefined): SoldierRank | null {
  if (!name) return null;
  for (const [r, as] of Object.entries(OTHER_RANKS)) if (name.startsWith(`${r} `)) return as;
  for (const r of SOLDIER_RANKS) if (name.startsWith(`${r} `)) return r;
  return null;
}

/**
 * A player's badge: soldiers only (Soldiers & Spies). Agency wears the Agency mark; the Army its name's rank, none
 * when the name has no rank (a player's own name). Null for everyone else.
 */
export function soldierInsignia(look: string | undefined, name: string | undefined): InsigniaId | null {
  if (lookGroup(look) !== 'soldiers') return null;
  if (lookBranch(look) === 'agency') return 'agency';
  const rank = nameRank(name);
  return rank ? RANK_INSIGNIA[rank] : null;
}

type Pt = readonly [number, number];
export type InsigniaPolygon = readonly Pt[];

/** Chevron arms' thickness and the gap between stacked chevrons. */
const T = 0.3;
const GAP = 0.2;
const H = 0.55;

/** One chevron (an upturned V), its arms' outer ends at y0 and its point at y0 + H. */
const chevron = (y0: number): InsigniaPolygon[] => [
  [[-1, y0], [0, y0 + H], [0, y0 + H - T], [-1, y0 - T]],
  [[0, y0 + H], [1, y0], [1, y0 - T], [0, y0 + H - T]],
];
/** A rocker (an arc, ends up) whose ends' top is at y. */
const rocker = (y: number): InsigniaPolygon[] => {
  const out: InsigniaPolygon[] = [];
  const n = 8;
  const top = (x: number) => y - 0.32 * (1 - x * x);
  for (let i = 0; i < n; i++) {
    const a = -0.92 + (1.84 * i) / n;
    const b = -0.92 + (1.84 * (i + 1)) / n;
    out.push([[a, top(a)], [b, top(b)], [b, top(b) - T * 0.85], [a, top(a) - T * 0.85]]);
  }
  return out;
};
const chevrons = (count: number, withRocker: boolean): InsigniaPolygon[] => {
  const out: InsigniaPolygon[] = [];
  for (let i = 0; i < count; i++) out.push(...chevron(-i * (T + GAP)));
  if (withRocker) out.push(...rocker(-(count - 1) * (T + GAP) - T - GAP));
  return out;
};
const rect = (x0: number, y0: number, x1: number, y1: number): InsigniaPolygon => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const star = (cx: number, cy: number, r: number): InsigniaPolygon =>
  Array.from({ length: 10 }, (_, i) => {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const k = i % 2 ? r * 0.42 : r;
    return [cx + Math.cos(a) * k, cy + Math.sin(a) * k] as Pt;
  });
const ring = (r0: number, r1: number, n = 20): InsigniaPolygon[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i * 2 * Math.PI) / n;
    const b = ((i + 1) * 2 * Math.PI) / n;
    return [[Math.cos(a) * r1, Math.sin(a) * r1], [Math.cos(b) * r1, Math.sin(b) * r1], [Math.cos(b) * r0, Math.sin(b) * r0], [Math.cos(a) * r0, Math.sin(a) * r0]] as InsigniaPolygon;
  });
const disc = (r: number, n = 14): InsigniaPolygon => Array.from({ length: n }, (_, i) => [Math.cos((i * 2 * Math.PI) / n) * r, Math.sin((i * 2 * Math.PI) / n) * r] as Pt);

/** Centred in the box (and shrunk to fit it): every badge sits where the marker did. */
function fit(polys: InsigniaPolygon[]): readonly InsigniaPolygon[] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of polys) for (const [x, y] of p) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  const s = Math.min(1, 2 / (x1 - x0), 2 / (y1 - y0));
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const r = (v: number) => Math.round(v * 1000) / 1000;
  return polys.map((p) => p.map(([x, y]) => [r((x - cx) * s), r((y - cy) * s)] as Pt));
}

/** Each badge's polygons, in a box from -1 to 1, y up. */
export const INSIGNIA_SHAPES: Readonly<Record<InsigniaId, readonly InsigniaPolygon[]>> = {
  pvt: fit(chevrons(1, false)),
  pfc: fit(chevrons(1, true)),
  cpl: fit(chevrons(2, false)),
  sgt: fit(chevrons(3, false)),
  ssgt: fit(chevrons(3, true)),
  lt: fit([rect(-0.24, -1, 0.24, 1)]),
  capt: fit([rect(-0.78, -1, -0.3, 1), rect(0.3, -1, 0.78, 1)]),
  maj: fit([star(0, 0, 1)]),
  col: fit([star(-0.52, 0, 0.5), star(0.52, 0, 0.5)]),
  agency: fit([...ring(0.62, 1), disc(0.32)]),
};
