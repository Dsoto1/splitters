/**
 * Player emblems (docs/PLAYER_PROFILES_PLAN.md, Phase 2): a small mark a player picks on Profile, shown beside their
 * name on the scoreboard, in the kill feed and on their profile card. Our own shapes in the badges' style (flat
 * polygons in a box from -1 to 1, y up, drawn by client game/emblemSvg.ts), in one of EMBLEM_COLORS. Data only: a
 * player's emblem is an id and a colour index ("bolt.3"), so nothing is uploaded and nothing but these shapes is drawn.
 */

type Pt = readonly [number, number];
export type EmblemPolygon = readonly Pt[];

/** The colours an emblem comes in (index → CSS colour): bright enough on the dark plate, apart from each other. */
export const EMBLEM_COLORS = ['#e5484d', '#f76b15', '#ffc53d', '#8fd14f', '#30a46c', '#12a594', '#00a2c7', '#3e63dd', '#8e4ec6', '#d6409f', '#ecedf2', '#8b8d98'] as const;
export const EMBLEM_COLOR_NAMES = ['Red', 'Orange', 'Amber', 'Lime', 'Green', 'Teal', 'Cyan', 'Blue', 'Violet', 'Pink', 'White', 'Steel'] as const;

const poly = (...pts: [number, number][]): EmblemPolygon => pts;
const circle = (cx: number, cy: number, r: number, n = 18, a0 = 0): EmblemPolygon => Array.from({ length: n }, (_, i) => [cx + Math.cos(a0 + (i * 2 * Math.PI) / n) * r, cy + Math.sin(a0 + (i * 2 * Math.PI) / n) * r] as Pt);
const starPts = (cx: number, cy: number, r: number, inner: number, n = 5): EmblemPolygon =>
  Array.from({ length: n * 2 }, (_, i) => {
    const a = Math.PI / 2 + (i * Math.PI) / n;
    const k = i % 2 ? r * inner : r;
    return [cx + Math.cos(a) * k, cy + Math.sin(a) * k] as Pt;
  });
/** A ring as quads (an SVG draws each; together they read as one band). */
const ring = (r0: number, r1: number, n = 24): EmblemPolygon[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i * 2 * Math.PI) / n;
    const b = ((i + 1) * 2 * Math.PI) / n;
    return [[Math.cos(a) * r1, Math.sin(a) * r1], [Math.cos(b) * r1, Math.sin(b) * r1], [Math.cos(b) * r0, Math.sin(b) * r0], [Math.cos(a) * r0, Math.sin(a) * r0]] as EmblemPolygon;
  });
const rect = (x0: number, y0: number, x1: number, y1: number): EmblemPolygon => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const mirror = (half: [number, number][]): EmblemPolygon => [...half, ...[...half].reverse().map(([x, y]) => [-x, y] as [number, number])];

/** An emblem: its filled polygons, and cuts drawn over them in the plate's dark colour (an eye's pupil, a moon's bite). */
interface Shape {
  label: string;
  fill: EmblemPolygon[];
  cut?: EmblemPolygon[];
}

const SHAPES = {
  bolt: { label: 'Bolt', fill: [poly([0.25, 0.95], [-0.55, -0.05], [-0.05, -0.05], [-0.3, -0.95], [0.55, 0.12], [0.05, 0.12])] },
  star: { label: 'Star', fill: [starPts(0, 0.05, 0.95, 0.42)] },
  crown: { label: 'Crown', fill: [poly([-0.85, -0.6], [-0.95, 0.55], [-0.45, 0.05], [0, 0.75], [0.45, 0.05], [0.95, 0.55], [0.85, -0.6]), rect(-0.85, -0.85, 0.85, -0.68)] },
  flame: { label: 'Flame', fill: [poly([0, 0.95], [0.25, 0.45], [0.6, 0.2], [0.7, -0.25], [0.5, -0.7], [0, -0.92], [-0.5, -0.7], [-0.7, -0.25], [-0.55, 0.2], [-0.35, 0.05], [-0.25, 0.5])], cut: [poly([0, 0.15], [0.25, -0.25], [0.22, -0.55], [0, -0.7], [-0.22, -0.55], [-0.25, -0.25])] },
  wings: { label: 'Wings', fill: [poly([-0.12, -0.3], [-0.95, 0.55], [-0.85, 0.15], [-0.95, 0.1], [-0.7, -0.15], [-0.8, -0.2], [-0.45, -0.45]), poly([0.12, -0.3], [0.45, -0.45], [0.8, -0.2], [0.7, -0.15], [0.95, 0.1], [0.85, 0.15], [0.95, 0.55]), circle(0, -0.15, 0.2, 12)] },
  crosshair: { label: 'Crosshair', fill: [...ring(0.55, 0.72), rect(-0.08, 0.3, 0.08, 0.98), rect(-0.08, -0.98, 0.08, -0.3), rect(0.3, -0.08, 0.98, 0.08), rect(-0.98, -0.08, -0.3, 0.08), circle(0, 0, 0.11, 10)] },
  shield: { label: 'Shield', fill: [mirror([[0, -0.95], [0.6, -0.5], [0.8, 0.2], [0.8, 0.75], [0.4, 0.85], [0, 0.95]])], cut: [rect(-0.07, -0.65, 0.07, 0.7), rect(-0.55, 0.15, 0.55, 0.29)] },
  diamond: { label: 'Diamond', fill: [poly([0, -0.95], [0.9, 0.25], [0.55, 0.7], [-0.55, 0.7], [-0.9, 0.25])], cut: [poly([0, -0.6], [0.32, 0.25], [-0.32, 0.25]), rect(-0.9, 0.22, 0.9, 0.3)] },
  sword: { label: 'Sword', fill: [poly([0, 0.98], [0.14, 0.75], [0.14, -0.35], [-0.14, -0.35], [-0.14, 0.75]), rect(-0.5, -0.5, 0.5, -0.36), rect(-0.09, -0.8, 0.09, -0.5), circle(0, -0.85, 0.13, 10)] },
  heart: { label: 'Heart', fill: [poly([0, -0.9], [0.75, -0.1], [0.95, 0.3], [0.88, 0.62], [0.62, 0.82], [0.3, 0.78], [0, 0.5], [-0.3, 0.78], [-0.62, 0.82], [-0.88, 0.62], [-0.95, 0.3], [-0.75, -0.1])] },
  moon: { label: 'Moon', fill: [circle(0, 0, 0.9, 24)], cut: [circle(0.33, 0.2, 0.66, 24)] },
  sun: { label: 'Sun', fill: [circle(0, 0, 0.45, 18), ...Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    const p = (r: number, d: number): [number, number] => [Math.cos(a + d) * r, Math.sin(a + d) * r];
    return poly(p(0.55, -0.2), p(0.98, 0), p(0.55, 0.2));
  })] },
  spade: { label: 'Spade', fill: [poly([0, 0.95], [0.6, 0.35], [0.85, -0.05], [0.75, -0.4], [0.45, -0.5], [0.12, -0.3], [0.3, -0.92], [-0.3, -0.92], [-0.12, -0.3], [-0.45, -0.5], [-0.75, -0.4], [-0.85, -0.05], [-0.6, 0.35])] },
  eye: { label: 'Eye', fill: [poly([-0.98, 0], [-0.6, 0.4], [0, 0.58], [0.6, 0.4], [0.98, 0], [0.6, -0.4], [0, -0.58], [-0.6, -0.4])], cut: [...ring(0.22, 0.36, 18)] },
  trident: { label: 'Trident', fill: [rect(-0.08, -0.98, 0.08, 0.5), poly([0, 0.98], [0.18, 0.55], [-0.18, 0.55]), poly([-0.62, 0.85], [-0.72, 0.35], [-0.55, 0.1], [0.55, 0.1], [0.72, 0.35], [0.62, 0.85], [0.5, 0.35], [0.4, 0.25], [-0.4, 0.25], [-0.5, 0.35])] },
  tiles: { label: 'Tiles', fill: [rect(-0.9, 0.08, -0.08, 0.9), rect(0.08, 0.08, 0.9, 0.9), rect(-0.9, -0.9, -0.08, -0.08), poly([0.08, -0.9], [0.9, -0.9], [0.9, -0.08], [0.5, -0.08], [0.5, -0.4], [0.08, -0.4])] },
} satisfies Record<string, Shape>;

export type EmblemId = keyof typeof SHAPES;
/** Every emblem, in the order Profile offers them. */
export const EMBLEM_IDS = Object.keys(SHAPES) as EmblemId[];
export const EMBLEM_LABELS: Readonly<Record<EmblemId, string>> = Object.fromEntries(EMBLEM_IDS.map((id) => [id, SHAPES[id].label])) as Record<EmblemId, string>;
const r3 = (polys: readonly EmblemPolygon[]): readonly EmblemPolygon[] => polys.map((p) => p.map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000] as Pt));
export const EMBLEM_SHAPES: Readonly<Record<EmblemId, readonly EmblemPolygon[]>> = Object.fromEntries(EMBLEM_IDS.map((id) => [id, r3(SHAPES[id].fill)])) as Record<EmblemId, readonly EmblemPolygon[]>;
export const EMBLEM_CUTS: Readonly<Record<EmblemId, readonly EmblemPolygon[]>> = Object.fromEntries(EMBLEM_IDS.map((id) => [id, r3((SHAPES[id] as Shape).cut ?? [])])) as Record<EmblemId, readonly EmblemPolygon[]>;

export const isEmblemId = (v: unknown): v is EmblemId => typeof v === 'string' && Object.prototype.hasOwnProperty.call(SHAPES, v);

/** A player's emblem: a shape and a colour. */
export interface Emblem {
  id: EmblemId;
  color: number;
}

/** An emblem as it travels and is kept: "<id>.<colour index>" (a few bytes in a hello, the roster, a profile). */
export const emblemCode = (e: Emblem): string => `${e.id}.${e.color}`;

/** The emblem a code names, or null when it names none (an unknown shape or colour, anything not a code). */
export function readEmblem(v: unknown): Emblem | null {
  if (typeof v !== 'string' || v.length > 24) return null;
  const m = /^([a-z]+)\.(\d{1,2})$/.exec(v);
  if (!m || !isEmblemId(m[1])) return null;
  const color = Number(m[2]);
  return color < EMBLEM_COLORS.length ? { id: m[1], color } : null;
}

/** An emblem code as it was sent, or null for anything that isn't one (what the hub, the host and the roster keep). */
export const cleanEmblemCode = (v: unknown): string | null => {
  const e = readEmblem(v);
  return e ? emblemCode(e) : null;
};
