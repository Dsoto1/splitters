import { coreCatalog, type TileCatalog } from '../map/catalog.ts';
import type { MapDocument, MapEntity } from '../map/schema.ts';
import { MAX_TEAMS, mapTeams } from '../sim/npc.ts';
import { placementCells } from './operations.ts';

/**
 * The plan view (MapMaker overhaul Phase 3, item 2): the level being edited from straight above, through an
 * orthographic camera, with tile outlines and icons for spawns (by team), objectives, flags, hills and pickups. This
 * is its maths, kept apart from the drawing: where the camera frames, world ↔ screen, what the icons are. North (+Z)
 * is up on screen, east (+X) to the right, as MapMaker's own camera faces at its start.
 */

/** The ground the plan frames: world metres, x0 < x1, z0 < z1. */
export interface PlanArea {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

/** What the orthographic camera sees: centred on (cx, cz), halfW by halfH metres either way. */
export interface PlanFrame {
  cx: number;
  cz: number;
  halfW: number;
  halfH: number;
}

/** The smallest a plan zooms in to and the most it zooms out to (half the height, m). */
export const PLAN_MIN_HALF = 4;
export const PLAN_MAX_HALF = 2000;

/** The area a plan opens on: the playable boundary, else what's built and placed (with a margin), else 40 m round the middle. */
export function planArea(doc: MapDocument, catalog: TileCatalog = coreCatalog): PlanArea {
  if (doc.bounds) return { x0: doc.bounds.min[0], z0: doc.bounds.min[1], x1: doc.bounds.max[0], z1: doc.bounds.max[1] };
  const cell = doc.classicStructure.cellSize;
  let a: PlanArea = { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity };
  const grow = (x: number, z: number, r: number) => {
    a = { x0: Math.min(a.x0, x - r), z0: Math.min(a.z0, z - r), x1: Math.max(a.x1, x + r), z1: Math.max(a.z1, z + r) };
  };
  for (const t of doc.classicStructure.tiles) for (const [x, y] of placementCells(t, catalog) ?? [[t.x, t.y, t.z]]) grow(x * cell, y * cell, cell / 2);
  for (const e of doc.entities) if (e.kind !== 'prop') grow(e.position[0], e.position[2], 2);
  if (!Number.isFinite(a.x0)) return { x0: -20, z0: -20, x1: 20, z1: 20 };
  return { x0: a.x0 - 4, z0: a.z0 - 4, x1: a.x1 + 4, z1: a.z1 + 4 };
}

/** A frame that fits `area` (with `margin` metres round it) in a view of this aspect (width / height). */
export function planFrame(area: PlanArea, aspect: number, margin = 2): PlanFrame {
  const w = Math.max(1, area.x1 - area.x0) + margin * 2;
  const h = Math.max(1, area.z1 - area.z0) + margin * 2;
  const k = Math.max(0.01, aspect);
  const halfH = clampHalf(Math.max(h / 2, w / 2 / k));
  return { cx: (area.x0 + area.x1) / 2, cz: (area.z0 + area.z1) / 2, halfW: halfH * k, halfH };
}

const clampHalf = (v: number) => Math.max(PLAN_MIN_HALF, Math.min(PLAN_MAX_HALF, v));

/** The same frame in a view of another aspect (the window resized): the height kept. */
export function planFitAspect(f: PlanFrame, aspect: number): PlanFrame {
  return { ...f, halfW: f.halfH * Math.max(0.01, aspect) };
}

/** World (x, z) to a point on a w × h screen (pixels from the top left). */
export function planToScreen(f: PlanFrame, w: number, h: number, x: number, z: number): { x: number; y: number } {
  return { x: ((x - (f.cx - f.halfW)) / (2 * f.halfW)) * w, y: (((f.cz + f.halfH) - z) / (2 * f.halfH)) * h };
}

/** A point on a w × h screen back to world (x, z). */
export function screenToPlan(f: PlanFrame, w: number, h: number, sx: number, sy: number): { x: number; z: number } {
  return { x: f.cx - f.halfW + (sx / w) * 2 * f.halfW, z: f.cz + f.halfH - (sy / h) * 2 * f.halfH };
}

/** Pixels per metre on a screen h pixels high. */
export function planScale(f: PlanFrame, h: number): number {
  return h / (2 * f.halfH);
}

/** Zoom by `factor` (> 1: out) about a world point, which stays where it is on screen. */
export function planZoom(f: PlanFrame, factor: number, at: { x: number; z: number } = { x: f.cx, z: f.cz }): PlanFrame {
  const halfH = clampHalf(f.halfH * factor);
  const k = halfH / f.halfH;
  return { cx: at.x + (f.cx - at.x) * k, cz: at.z + (f.cz - at.z) * k, halfW: f.halfW * k, halfH };
}

/** Pan by a drag of (dx, dy) screen pixels (the ground follows the pointer). */
export function planPan(f: PlanFrame, w: number, h: number, dx: number, dy: number): PlanFrame {
  return { ...f, cx: f.cx - (dx / w) * 2 * f.halfW, cz: f.cz + (dy / h) * 2 * f.halfH };
}

/** Move a frame by world metres (WASD in the plan view: north is up). */
export function planMove(f: PlanFrame, east: number, north: number): PlanFrame {
  return { ...f, cx: f.cx + east, cz: f.cz + north };
}

/** The level an entity stands on (its position's height over the level height; a hair below a floor counts as on it). */
export function entityLevel(y: number, levelHeight: number): number {
  return Math.floor((y + 0.5) / levelHeight);
}

/**
 * Whether a plan of `level` shows a thing at height y: its own level's (a basement's: just its own; the ground plan:
 * everything lower too). `onGround`: it stands on the open ground (a hill's top is still the ground plan).
 */
export function onPlanLevel(y: number, level: number, levelHeight: number, onGround = false): boolean {
  const l = onGround ? 0 : entityLevel(y, levelHeight);
  return level === 0 ? l <= 0 : l === level;
}

/** One tile's footprint on the plan: the rectangle round its cells (world metres). */
export interface PlanTile {
  id: string;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  /** True for tiles of the level shown; false for the level below's (drawn faint, for reference). */
  current: boolean;
}

/** The tiles a plan of `level` outlines: the level's own, and the level below's (faint). */
export function planTiles(doc: MapDocument, level: number, catalog: TileCatalog = coreCatalog): PlanTile[] {
  const cell = doc.classicStructure.cellSize;
  const out: PlanTile[] = [];
  for (const t of doc.classicStructure.tiles) {
    const cells = (placementCells(t, catalog) ?? [[t.x, t.y, t.z]]).filter(([, , z]) => z === level || z === level - 1);
    for (const lv of [level, level - 1]) {
      const here = cells.filter(([, , z]) => z === lv);
      if (!here.length) continue;
      let r = { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity };
      for (const [x, y] of here) r = { x0: Math.min(r.x0, x * cell - cell / 2), z0: Math.min(r.z0, y * cell - cell / 2), x1: Math.max(r.x1, x * cell + cell / 2), z1: Math.max(r.z1, y * cell + cell / 2) };
      out.push({ id: t.id, ...r, current: lv === level });
    }
  }
  return out;
}

/** What a plan icon stands for. */
export type PlanMarkerKind = 'spawn' | 'flag' | 'hill' | 'objective' | 'pickup';

/** One icon on the plan. */
export interface PlanMarker {
  id: string;
  kind: PlanMarkerKind;
  x: number;
  z: number;
  /** Facing (spawns, flags), radians as everywhere (0 along +Z). */
  yaw: number;
  /** The team's colour (spawns, flags), else the kind's. */
  color: string;
  /** A short label in the icon (a site's letter, a sector objective's name), or ''. */
  label: string;
  /** A zone's radius drawn round it (hills, sites, rescue zones, objectives), or 0. */
  radius: number;
  /** Words for a tooltip and the PNG's key: "Spawn (Red)", "Flag (Blue)", "Hill", "Bomb site A". */
  title: string;
}

/** The kinds' own colours (the team colours for team things). */
export const PLAN_COLORS = { spawn: '#4fb3ff', hill: '#ffd34d', objective: '#ff8a3a', pickup: '#58d68d', attack: '#ff8a3a', defend: '#5ab0ff' } as const;

/**
 * The icons on a plan of `level`: spawns (by team), objectives, flags, hills and pickups standing on it.
 * `groundAt`: the ground's height at (x, z) (MapMaker's shownGround), or null where there's none: a thing within
 * 0.6 m of it stands on the open ground, whatever its height.
 */
export function planMarkers(doc: MapDocument, level: number, groundAt: (x: number, z: number) => number | null = () => null): PlanMarker[] {
  const lh = doc.classicStructure.levelHeight;
  const teams = mapTeams(doc, MAX_TEAMS);
  const team = (id: string | null | undefined) => (id ? teams.find((t) => t.id === id) : undefined);
  const out: PlanMarker[] = [];
  const add = (e: MapEntity, m: Omit<PlanMarker, 'id' | 'x' | 'z'>) => out.push({ id: e.id, x: e.position[0], z: e.position[2], ...m });
  for (const e of doc.entities) {
    const g = groundAt(e.position[0], e.position[2]);
    if (!onPlanLevel(e.position[1], level, lh, g !== null && Math.abs(e.position[1] - g) < 0.6)) continue;
    switch (e.kind) {
      case 'spawn': {
        const t = team(e.faction);
        const color = e.side ? PLAN_COLORS[e.side] : (t?.color ?? PLAN_COLORS.spawn);
        const who = e.side ? (e.side === 'attack' ? 'attackers' : 'defenders') : (t?.name ?? 'everyone');
        add(e, { kind: 'spawn', yaw: e.yaw, color, label: '', radius: 0, title: `Spawn (${who})` });
        break;
      }
      case 'flag': {
        const t = team(e.team);
        add(e, { kind: 'flag', yaw: e.yaw, color: t?.color ?? '#888888', label: '', radius: 0, title: `Flag (${t?.name ?? e.team})` });
        break;
      }
      case 'hill':
        add(e, { kind: 'hill', yaw: 0, color: PLAN_COLORS.hill, label: '', radius: e.radius, title: 'Hill' });
        break;
      case 'bombsite':
        add(e, { kind: 'objective', yaw: 0, color: PLAN_COLORS.objective, label: e.label, radius: e.radius, title: `Bomb site ${e.label}` });
        break;
      case 'objective':
        add(e, { kind: 'objective', yaw: e.yaw, color: PLAN_COLORS.objective, label: e.label, radius: e.radius, title: `Objective ${e.label} (sector ${e.sector})` });
        break;
      case 'hostage':
        add(e, { kind: 'objective', yaw: e.yaw, color: PLAN_COLORS.objective, label: 'H', radius: 0, title: 'Hostage' });
        break;
      case 'rescue':
        add(e, { kind: 'objective', yaw: 0, color: PLAN_COLORS.objective, label: 'R', radius: e.radius, title: 'Rescue zone' });
        break;
      case 'pickup':
        add(e, { kind: 'pickup', yaw: 0, color: PLAN_COLORS.pickup, label: '', radius: 0, title: e.random ? `Random ${e.random} pickup` : `Pickup (${e.item})` });
        break;
    }
  }
  return out;
}

/** A plan's PNG file name: the map's name and the level, safe for any file system ("step_temple-ground-plan.png"). */
export function planFileName(mapName: string, level: number): string {
  const base = mapName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'map';
  const lv = level === 0 ? 'ground' : level > 0 ? `level${level}` : `basement${-level}`;
  return `${base}-${lv}-plan.png`;
}
