/**
 * Rank insignia (owner, 2026-11-17; for everyone behind Options → Ranks & badges since 2026-11-19, content/ranks.ts):
 * the badge before a name in the kill feed and on the scoreboards, and the marker over the head. Every group has nine
 * steps (ranks.ts gives the step and the title). Soldiers & Spies' Army wears its military rank: chevrons for the
 * enlisted steps (a rocker under for Pfc. and SSgt.), bars for the lieutenant and captain, stars for the major and
 * colonel. Every other group wears its own mark (Agency a ring round a dot, Horrors a skull, Outer Space a star,
 * Machines a gear, Legends a crown, Animalia a paw, Everyday Folk a plain chevron, Toys a toy brick), its step told the same way for
 * all of them: steps 1-3 the bare mark, 4-6 the mark inside a ring, 7-9 inside a double ring, with no, one or two bars
 * under it for the second and third step of each.
 *
 * Each badge is a few flat polygons in a box from -1 to 1 (y up), simple shapes that read small and far. Every polygon
 * is star-shaped about its centroid, so a mesh can fan it from there (game/insigniaMesh.ts); an SVG draws it as is
 * (game/insigniaSvg.ts). A badge's cuts (a skull's eyes, a gear's hole) are drawn over it in the dark rim colour.
 */
import { lookBranch, lookGroup } from '../sim/npc.ts';

/** Soldier ranks, as written before a surname (botNames.ts gives them out; ranks.ts's Army titles). */
export const SOLDIER_RANKS = ['Pvt.', 'Pfc.', 'Cpl.', 'Sgt.', 'SSgt.', 'Lt.', 'Capt.', 'Maj.', 'Col.'] as const;
export type SoldierRank = (typeof SOLDIER_RANKS)[number];

/** The rank groups: Soldiers & Spies split by branch, then Character Select's other groups (a design of yours: Folk). */
export const RANK_GROUPS = ['army', 'agency', 'horror', 'space', 'machines', 'legends', 'animals', 'folk', 'toys', 'pirates', 'holiday', 'historical'] as const;
export type RankGroup = (typeof RANK_GROUPS)[number];
/** The groups that wear their own mark with the step told by rings and bars (every one but the Army). */
export const MARK_GROUPS = ['agency', 'horror', 'space', 'machines', 'legends', 'animals', 'folk', 'toys', 'pirates', 'holiday', 'historical'] as const;
export type MarkGroup = (typeof MARK_GROUPS)[number];

const ARMY_IDS = ['pvt', 'pfc', 'cpl', 'sgt', 'ssgt', 'lt', 'capt', 'maj', 'col'] as const;
const STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
type MarkId = `${MarkGroup}${(typeof STEPS)[number]}`;
/** Every badge: the Army's nine ranks, then each other group's nine steps (`horror1` … `horror9`). */
export const INSIGNIA_IDS = /* @__PURE__ */ (() => [...ARMY_IDS, ...MARK_GROUPS.flatMap((g) => STEPS.map((n) => `${g}${n}` as MarkId))] as const)();
export type InsigniaId = (typeof ARMY_IDS)[number] | MarkId;

const RANK_INSIGNIA: Readonly<Record<SoldierRank, InsigniaId>> = { 'Pvt.': 'pvt', 'Pfc.': 'pfc', 'Cpl.': 'cpl', 'Sgt.': 'sgt', 'SSgt.': 'ssgt', 'Lt.': 'lt', 'Capt.': 'capt', 'Maj.': 'maj', 'Col.': 'col' };

/** The Army's ranks written out (labels; the other groups' titles are ranks.ts's). */
export const ARMY_RANK_NAMES = ['Private', 'Private First Class', 'Corporal', 'Sergeant', 'Staff Sergeant', 'Lieutenant', 'Captain', 'Major', 'Colonel'] as const;

/**
 * Each group's titles, step 1 to 9 (owner, 2026-11-18: "as written is fine" for the first and last; the steps between
 * are the lead's). The Army's are its ranks as written before a surname. docs/CHARACTERS.md has the table.
 */
export const RANK_TITLES: Readonly<Record<RankGroup, readonly string[]>> = {
  army: SOLDIER_RANKS,
  agency: ['Asset', 'Courier', 'Contact', 'Handler', 'Operative', 'Agent', 'Senior Agent', 'Station Chief', 'Spymaster'],
  horror: ['Ghoul', 'Shade', 'Wraith', 'Ghast', 'Fiend', 'Revenant', 'Horror', 'Dread Lord', 'Overlord'],
  space: ['Cadet', 'Ensign', 'Pilot', 'Navigator', 'Flight Officer', 'Commander', 'Captain', 'Commodore', 'Admiral'],
  machines: ['Unit', 'Drone', 'Servo', 'Automaton', 'Android', 'Titan', 'Overseer', 'Mainframe', 'Prime'],
  legends: ['Squire', 'Knight', 'Champion', 'Baron', 'Earl', 'Duke', 'Prince', 'King', 'Emperor'],
  animals: ['Pup', 'Cub', 'Scout', 'Tracker', 'Hunter', 'Stalker', 'Prowler', 'Alpha', 'Apex'],
  folk: ['Rookie', 'Regular', 'Local', 'Pro', 'Ace', 'Star', 'Hero', 'Superstar', 'Icon'],
  // The Toys row (owner, 2026-11-26: "do we accommodate when turning on ranks"): its own nine, the lead's.
  toys: ['Wind-Up', 'Tin Toy', 'Plaything', 'Favourite', 'Best-Seller', 'Collectible', 'Keepsake', 'Heirloom', 'Toy of the Year'],
  // The Pirates and Holiday rows (owner, 2026-11-26 evening): their own nine each, the lead's.
  pirates: ['Deckhand', 'Powder Monkey', 'Rigger', 'Gunner', 'Boatswain', 'Quartermaster', 'First Mate', 'Captain', 'Pirate King'],
  holiday: ['Guest', 'Reveller', 'Caroler', 'Merrymaker', 'Host', 'Toastmaster', 'Grand Marshal', 'Guest of Honour', 'Holiday Legend'],
  // The Historical row (owner, 2026-11-27): its own nine, the lead's.
  historical: ['Commoner', 'Militia', 'Shieldbearer', 'Veteran', 'Centurion', 'Chieftain', 'Warlord', 'Conqueror', 'Immortal'],
};

/** Each group's mark as named (labels, the docs). */
export const MARK_NAMES: Readonly<Record<MarkGroup, string>> = { agency: 'Agency ring', horror: 'skull', space: 'star', machines: 'gear', legends: 'crown', animals: 'paw', folk: 'chevron', toys: 'toy brick', pirates: 'anchor', holiday: 'gift', historical: 'column' };

/** Each badge's name (tooltips, screen readers): the rank's title. */
export const INSIGNIA_LABELS: Readonly<Record<InsigniaId, string>> = /* @__PURE__ */ (() => Object.fromEntries([
  ...ARMY_IDS.map((id, i) => [id, ARMY_RANK_NAMES[i]!]),
  ...MARK_GROUPS.flatMap((g) => STEPS.map((n) => [`${g}${n}`, RANK_TITLES[g][n - 1]!])),
]) as Record<InsigniaId, string>)();

/** Other ranks a character's own name may carry, as the rank they wear (a Flight Lieutenant ranks with a Captain). */
const OTHER_RANKS: Readonly<Record<string, SoldierRank>> = { 'Flt. Lt.': 'Capt.' };

/**
 * Titles a name may start with that a rank title replaces when ranks are on (owner, 2026-11-26: names "dont duplicate
 * and instead actually just rank up"): honorifics, offices and trades ("Det. Drake Montego", "Dr. Hugo Hue", "Sarge
 * Tobias Crane", "Ser Godric Vale"), and every group's own rank titles ("Unit Alpha", "Captain Pell"). Longest first,
 * so "Flt. Lt." and "Customs Agent" go before "Lt." and "Agent". Family words (Uncle, Granny, Grandpa) are names, not
 * titles, and stay. Off, every name keeps its title.
 */
export const NAME_TITLES: readonly string[] = /* @__PURE__ */ (() => {
  const own = [
    'Flt. Lt.', 'Customs Agent', 'Old King', 'Sea Dog',
    'Det.', 'Detective', 'Dr.', 'Doctor', 'Prof.', 'Professor', 'Insp.', 'Inspector', 'Officer', 'Agent', 'Inquisitor',
    'Sarge', 'Sergeant', 'Corporal', 'Private', 'Lieutenant', 'Major', 'Colonel', 'General', 'Admiral', 'Commander', 'Captain', 'Cap\'n', 'Commodore', 'Marshal', 'Sheriff', 'Deputy', 'Judge',
    'Emperor', 'Empress', 'Imperator', 'King', 'Queen', 'Prince', 'Princess', 'Duke', 'Duchess', 'Count', 'Countess', 'Baron', 'Baroness', 'Earl', 'Lord', 'Lady', 'Sir', 'Dame', 'Ser', 'Squire', 'Knight',
    'Emir', 'Sultan', 'Kaiser', 'Tsar', 'Pharaoh', 'Chief', 'Elder', 'Brother', 'Sister', 'Father', 'Mother', 'Abbot', 'Friar',
    'Madame', 'Mme.', 'Mister', 'Mr.', 'Mrs.', 'Ms.', 'Miss', 'Coach', 'Chef',
  ];
  const ranks = Object.values(RANK_TITLES).flat();
  return [...new Set([...own, ...ranks])].sort((a, b) => b.length - a.length);
})();

/**
 * A name without the title it starts with, for a rank title to go in its place ("Det. Drake Montego" → "Drake
 * Montego"; "Pvt. Pete Plastic" → "Pete Plastic"); a name that is only a title, or has none, as it is.
 */
export function nameWithoutTitle(name: string): string {
  for (const t of NAME_TITLES) if (name.startsWith(`${t} `) && name.length > t.length + 1) return name.slice(t.length + 1);
  return name;
}

/** The rank a name starts with ("Sgt. Dunmore" → "Sgt."; "Flt. Lt. Ember" → "Capt."), or null. */
export function nameRank(name: string | undefined): SoldierRank | null {
  if (!name) return null;
  for (const [r, as] of Object.entries(OTHER_RANKS)) if (name.startsWith(`${r} `)) return as;
  for (const r of SOLDIER_RANKS) if (name.startsWith(`${r} `)) return r;
  return null;
}

/**
 * A name without the soldier rank it starts with ("Sgt. Dunmore" → "Dunmore"); a character's own rank ("Flt. Lt.
 * Ember") stays unless `own` (a rank title goes in its place).
 */
export function nameWithoutRank(name: string, own = false): string {
  const ranks = own ? [...Object.keys(OTHER_RANKS), ...SOLDIER_RANKS] : SOLDIER_RANKS;
  for (const r of ranks) if (name.startsWith(`${r} `) && name.length > r.length + 1) return name.slice(r.length + 1);
  return name;
}

/** The rank group a look wears: Soldiers & Spies by branch, the other groups their own; a design of yours (or unknown) Folk. */
export function rankGroup(look: string | undefined): RankGroup {
  const g = lookGroup(look);
  if (g === 'soldiers') return lookBranch(look) === 'agency' ? 'agency' : 'army';
  // The Toys row (owner, 2026-11-26) has its own titles and mark.
  return g ?? 'folk';
}

/** A group's badge for a step (1 to 9, clamped). */
export function rankInsignia(group: RankGroup, step: number): InsigniaId {
  const n = Math.max(1, Math.min(9, Math.round(step)));
  return group === 'army' ? ARMY_IDS[n - 1]! : (`${group}${n}` as MarkId);
}

/**
 * The badge a soldier's name gives (the rank their name starts with; Agency its ring), null for everyone else: what
 * the Army's names meant before ranks rose with play (ranks.ts). Kept for a character whose own name carries a rank.
 */
export function soldierInsignia(look: string | undefined, name: string | undefined): InsigniaId | null {
  if (lookGroup(look) !== 'soldiers') return null;
  if (lookBranch(look) === 'agency') return 'agency1';
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

/** A polygon's points scaled by `k` and moved by (dx, dy). */
const move = (polys: InsigniaPolygon[], k: number, dx = 0, dy = 0): InsigniaPolygon[] => polys.map((p) => p.map(([x, y]) => [x * k + dx, y * k + dy] as Pt));
const ellipse = (cx: number, cy: number, rx: number, ry: number, n = 14): InsigniaPolygon =>
  Array.from({ length: n }, (_, i) => [cx + Math.cos((i * 2 * Math.PI) / n) * rx, cy + Math.sin((i * 2 * Math.PI) / n) * ry] as Pt);
const tri = (a: Pt, b: Pt, c: Pt): InsigniaPolygon => [a, b, c];

/** A badge: its filled polygons and the cuts drawn over them in the rim's dark colour. */
interface Badge {
  fill: InsigniaPolygon[];
  cut?: InsigniaPolygon[];
}

/** Each group's mark, about the size of a disc of radius 1. */
const MARKS: Readonly<Record<MarkGroup, () => Badge>> = {
  agency: () => ({ fill: [...ring(0.62, 1), disc(0.32)] }),
  horror: () => ({
    // A skull: the cranium, the jaw with its teeth gaps, two eyes and a nose cut out.
    fill: [ellipse(0, 0.18, 0.86, 0.78, 18), rect(-0.5, -0.92, 0.5, -0.3)],
    cut: [ellipse(-0.34, 0.12, 0.22, 0.24, 10), ellipse(0.34, 0.12, 0.22, 0.24, 10), tri([0, -0.12], [-0.12, -0.36], [0.12, -0.36]), rect(-0.2, -0.92, -0.12, -0.62), rect(0.12, -0.92, 0.2, -0.62)],
  }),
  space: () => ({ fill: [star(0, -0.05, 1.05)] }),
  machines: () => {
    // A gear: a wheel with eight teeth and a hole.
    const teeth: InsigniaPolygon[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const c = Math.cos(a), sn = Math.sin(a);
      const pt = (r: number, w: number): Pt => [c * r - sn * w, sn * r + c * w];
      teeth.push([pt(0.6, -0.17), pt(1, -0.14), pt(1, 0.14), pt(0.6, 0.17)]);
    }
    return { fill: [disc(0.74, 20), ...teeth], cut: [disc(0.3, 14)] };
  },
  legends: () => ({
    // A crown: the band and three points, a jewel on each tip.
    fill: [rect(-0.9, -0.7, 0.9, -0.28), tri([-0.9, -0.3], [-0.68, 0.62], [-0.38, -0.3]), tri([-0.32, -0.3], [0, 0.8], [0.32, -0.3]), tri([0.38, -0.3], [0.68, 0.62], [0.9, -0.3]), disc(0.13, 10).map(([x, y]) => [x - 0.68, y + 0.66] as Pt), disc(0.13, 10).map(([x, y]) => [x, y + 0.86] as Pt), disc(0.13, 10).map(([x, y]) => [x + 0.68, y + 0.66] as Pt)],
  }),
  animals: () => ({
    // A paw: the pad and four toes.
    fill: [ellipse(0, -0.38, 0.56, 0.46, 16), ellipse(-0.72, 0.12, 0.2, 0.27, 10), ellipse(-0.27, 0.5, 0.21, 0.28, 10), ellipse(0.27, 0.5, 0.21, 0.28, 10), ellipse(0.72, 0.12, 0.2, 0.27, 10)],
  }),
  folk: () => ({ fill: chevron(-0.3).map((p) => p.map(([x, y]) => [x, y + 0.05] as Pt)) }),
  // A toy brick: the block and its two studs on top.
  toys: () => ({ fill: [rect(-0.95, -0.62, 0.95, 0.3), rect(-0.7, 0.3, -0.2, 0.66), rect(0.2, 0.3, 0.7, 0.66)] }),
  // An anchor: the ring, the shank, the stock across it and the crown's two flukes.
  pirates: () => ({ fill: [...ring(0.12, 0.26, 12).map((p) => p.map(([x, y]) => [x, y + 0.74] as Pt)), rect(-0.1, -0.72, 0.1, 0.5), rect(-0.5, 0.26, 0.5, 0.42), tri([-0.1, -0.72], [-0.82, -0.2], [-0.7, -0.42]), tri([0.1, -0.72], [0.82, -0.2], [0.7, -0.42]), tri([-0.3, -0.62], [0.3, -0.62], [0, -0.95])] }),
  // A gift: the box and its lid, the ribbon cut down the middle and a bow on top.
  // A column: the capital, the shaft with two flutes cut down it, and the base.
  historical: () => ({ fill: [rect(-0.8, 0.58, 0.8, 0.86), rect(-0.6, 0.44, 0.6, 0.58), rect(-0.45, -0.6, 0.45, 0.44), rect(-0.7, -0.74, 0.7, -0.6), rect(-0.85, -0.92, 0.85, -0.74)], cut: [rect(-0.24, -0.5, -0.12, 0.36), rect(0.12, -0.5, 0.24, 0.36)] }),
  holiday: () => ({ fill: [rect(-0.8, -0.85, 0.8, 0.2), rect(-0.92, 0.2, 0.92, 0.48), tri([0, 0.48], [-0.55, 0.9], [-0.45, 0.48]), tri([0, 0.48], [0.55, 0.9], [0.45, 0.48])], cut: [rect(-0.09, -0.85, 0.09, 0.48)] }),
};

/** A group's badge for a step: the mark (in a ring from step 4, a double ring from 7) and its bars (none, one or two). */
function markBadge(g: MarkGroup, step: number): Badge {
  const tier = Math.floor((step - 1) / 3);
  const bars = (step - 1) % 3;
  const m = MARKS[g]();
  // In a ring the mark shrinks to fit inside it.
  const k = tier === 0 ? 1 : tier === 1 ? 0.6 : 0.5;
  const fill = move(m.fill, k);
  const cut = m.cut ? move(m.cut, k) : [];
  if (tier >= 1) fill.push(...ring(tier === 1 ? 0.8 : 0.86, 1.04, 24));
  if (tier >= 2) fill.push(...ring(0.6, 0.72, 24));
  const r = tier === 0 ? 1.05 : 1.08;
  for (let i = 0; i < bars; i++) {
    const y = -r - 0.14 - i * 0.36;
    fill.push(rect(-0.62, y - 0.22, 0.62, y));
  }
  return cut.length ? { fill, cut } : { fill };
}

/** Centred in the box (and shrunk to fit it) by its filled polygons, its cuts moved with them. */
function fitBadge(b: Badge): { fill: readonly InsigniaPolygon[]; cut: readonly InsigniaPolygon[] } {
  const all = [...b.fill, ...(b.cut ?? [])];
  const f = fit(all);
  return { fill: f.slice(0, b.fill.length), cut: f.slice(b.fill.length) };
}

const armyShapes = (): Readonly<Record<(typeof ARMY_IDS)[number], InsigniaPolygon[]>> => ({
  pvt: chevrons(1, false),
  pfc: chevrons(1, true),
  cpl: chevrons(2, false),
  sgt: chevrons(3, false),
  ssgt: chevrons(3, true),
  lt: [rect(-0.24, -1, 0.24, 1)],
  capt: [rect(-0.78, -1, -0.3, 1), rect(0.3, -1, 0.78, 1)],
  maj: [star(0, 0, 1)],
  col: [star(-0.52, 0, 0.5), star(0.52, 0, 0.5)],
});

/** (Made only where something reads them, so the menu's bundle can leave them out.) */
const BADGES: Readonly<Record<InsigniaId, { fill: readonly InsigniaPolygon[]; cut: readonly InsigniaPolygon[] }>> = /* @__PURE__ */ (() => {
  const army = armyShapes();
  return Object.fromEntries([
    ...ARMY_IDS.map((id) => [id, { fill: fit(army[id]), cut: [] }]),
    ...MARK_GROUPS.flatMap((g) => STEPS.map((n) => [`${g}${n}`, fitBadge(markBadge(g, n))])),
  ]) as Record<InsigniaId, { fill: readonly InsigniaPolygon[]; cut: readonly InsigniaPolygon[] }>;
})();

/** Each badge's polygons, in a box from -1 to 1, y up. */
export const INSIGNIA_SHAPES: Readonly<Record<InsigniaId, readonly InsigniaPolygon[]>> = /* @__PURE__ */ (() => Object.fromEntries(Object.entries(BADGES).map(([id, b]) => [id, b.fill])) as Record<InsigniaId, readonly InsigniaPolygon[]>)();
/** Each badge's cuts (drawn over it in the rim's dark colour): a skull's eyes, a gear's hole; empty for most. */
export const INSIGNIA_CUTS: Readonly<Record<InsigniaId, readonly InsigniaPolygon[]>> = /* @__PURE__ */ (() => Object.fromEntries(Object.entries(BADGES).map(([id, b]) => [id, b.cut])) as Record<InsigniaId, readonly InsigniaPolygon[]>)();
