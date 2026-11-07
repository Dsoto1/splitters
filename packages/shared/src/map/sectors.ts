import type { Vec3 } from '../math.ts';
import type { MapDocument } from './schema.ts';

/**
 * Breakthrough's sectors as data (shared by the mode, its HUD and MapMaker): a map's sector entities in the order
 * they are taken, where each line runs, and which side of it a point is on.
 */
export interface SectorInfo {
  /** Its map entity's index. */
  index: number;
  order: number;
  /** Its own name, else "Sector A", "Sector B"… by its place in the order. */
  name: string;
  /** A point on its line, and the way the attackers push across it (unit, horizontal). */
  pos: Vec3;
  dir: { x: number; z: number };
  need?: number;
  seconds?: number;
}

/** A default name for the sector at `i` (0-based) in the order: Sector A, B, C… */
export const sectorLetter = (i: number): string => String.fromCharCode(65 + (i % 26));

/** The way the attackers push across a line facing `yaw` (+Z at 0, like every facing). */
export const sectorDir = (yaw: number): { x: number; z: number } => ({ x: Math.sin(yaw), z: Math.cos(yaw) });

/** A map's sectors in the order they are taken: sector entities by `order`, then map order. */
export function breakthroughSectors(map: Pick<MapDocument, 'entities'>): SectorInfo[] {
  return map.entities
    .flatMap((e, index) => (e.kind === 'sector' ? [{ e, index }] : []))
    .sort((a, b) => a.e.order - b.e.order || a.index - b.index)
    .map(({ e, index }, i) => ({
      index,
      order: e.order,
      name: e.name || `Sector ${sectorLetter(i)}`,
      pos: { x: e.position[0], y: e.position[1], z: e.position[2] },
      dir: sectorDir(e.yaw),
      ...(e.need !== undefined ? { need: e.need } : {}),
      ...(e.seconds !== undefined ? { seconds: e.seconds } : {}),
    }));
}

/** Is `p` on the attackers' side of a sector's line (behind it, for a defender, once the sector before has fallen)? */
export const behindLine = (s: { pos: Vec3; dir: { x: number; z: number } }, p: { x: number; z: number }): boolean => (p.x - s.pos.x) * s.dir.x + (p.z - s.pos.z) * s.dir.z < 0;
