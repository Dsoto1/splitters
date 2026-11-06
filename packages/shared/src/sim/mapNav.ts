import { blockBoxes, boxesRay, buildMapGeometry, mapKillY, mapTerrainMesh, propBoxes, type WorldBox } from '../map/geometry.ts';
import { environmentNavTriangles, environmentShapes, joinTriangles, type EnvWorldShape } from '../map/environment.ts';
import type { MapDocument } from '../map/schema.ts';
import type { Vec3 } from '../math.ts';
import { NavWorld, validateNavigation, type DropOptions } from '../nav/index.ts';
import { auditNavigation, type NavAudit } from '../nav/audit.ts';
import type { ValidationIssue } from '../map/validate.ts';
import { LIQUID_SPECS, SWIM_DEPTH, liquidAt, mapLiquids } from './liquids.ts';
import { navLinks, type ExtraRay } from './movement.ts';
import { liftLinks } from './movers.ts';
import { PhysicsWorld } from './physics.ts';
import { matchPhysics, type MatchRules } from './rules.ts';

/**
 * The highest drop a ledge-drop link takes (m, at normal gravity) with fall damage on: one that costs at most about
 * 30 health (fall damage starts past 5 m: match.ts trackFall). With it off, any drop that lands on the navmesh.
 */
export const DROP_HURTS_UP_TO = 5 + 30 / 9;
const DROP_FREE = 60;

/** A ray against boxes physics doesn't hold yet (the scenario's solids), for jump pads' landings; none for none. */
export const solidsRay = (solids: readonly WorldBox[]): ExtraRay | undefined => (solids.length ? (o, d, max) => boxesRay(solids, o, d, max) : undefined);

/** What the navmesh's ledge-drop links need from the match (NavWorld.build `drops`). */
export function dropOptions(map: MapDocument, physics: PhysicsWorld, geometry: readonly WorldBox[], phys: { gravity: number; fallDamage: boolean }): DropOptions {
  const liquids = mapLiquids(map.entities);
  return {
    physics,
    spawns: map.entities.filter((e) => e.kind === 'spawn').map((e): Vec3 => ({ x: e.position[0], y: e.position[1], z: e.position[2] })),
    maxDrop: phys.fallDamage ? DROP_HURTS_UP_TO / Math.max(0.05, phys.gravity) : DROP_FREE,
    floorY: mapKillY(geometry, map),
    deadly: liquids.length
      ? (p) => {
          const l = liquidAt(liquids, { x: p.x, y: p.y + 0.3, z: p.z });
          return !!l && LIQUID_SPECS[l.liquid].dps >= 30;
        }
      : undefined,
    // Over a body's chest: swimming (bots don't swim out; they surface and drown in the end).
    underLiquid: liquids.length ? (p) => !!liquidAt(liquids, { x: p.x, y: p.y + SWIM_DEPTH + 0.2, z: p.z }) : undefined,
    // Breakable props and moving or breaking blocks: the scenario's, added to the physics after the navmesh.
    solids: [...propBoxes(map, true), ...blockBoxes(map, true)],
  };
}

/**
 * The bots' navmesh of a map, as the match builds it: the level, breakable props and moving or breaking blocks
 * (plus `extra` boxes: Fort Wars' pieces), terrain and the environment's shapes, the map's links (jump pads, ladders,
 * portals, ziplines, lifts) and ledge-drop links off patches that have no other way down.
 */
export function buildMapNav(map: MapDocument, geometry: readonly WorldBox[], physics: PhysicsWorld, envShapes: readonly EnvWorldShape[], phys: { gravity: number; fallDamage: boolean }, extra: readonly WorldBox[] = []): NavWorld {
  const drops = dropOptions(map, physics, geometry, phys);
  const solids = drops.solids ?? [];
  return NavWorld.build(
    [...geometry, ...solids, ...extra],
    joinTriangles(mapTerrainMesh(map), environmentNavTriangles(envShapes)),
    // (Jump pads' flights come down on the scenario's solids too, as the navmesh has them.)
    [...navLinks(map.entities, physics, phys.gravity, solidsRay(extra.length ? [...solids, ...extra] : solids)), ...liftLinks(map)],
    false,
    drops,
  );
}

/**
 * The navigation checks of a map as a match would play it (validate-map, the all-maps test, MapMaker's validator):
 * its navmesh and physics built as the match builds them, then validateNavigation with the navigation audit.
 * `official`: a map in maps/ (the audit's findings and blocked spawn points are errors; for creators, warnings).
 */
export function validateMapNavigation(map: MapDocument, official: boolean): { issues: ValidationIssue[]; audit: NavAudit } {
  const built = mapNavigation(map);
  try {
    const opts = { ...dropOptions(map, built.physics, built.geometry, built.phys), official };
    const audit = auditNavigation(map, built.nav, built.physics, opts);
    return { issues: validateNavigation(map, built.nav, built.physics, { ...opts, done: audit }), audit };
  } finally {
    built.physics.free();
    built.nav.destroy();
  }
}

/**
 * A map's level physics and navmesh as a match builds them, for the checks that run outside one (validate-map, the
 * all-maps test, MapMaker's validator). Free both when done.
 */
export function mapNavigation(map: MapDocument, rules?: MatchRules): { geometry: WorldBox[]; physics: PhysicsWorld; nav: NavWorld; phys: { gravity: number; fallDamage: boolean }; envShapes: EnvWorldShape[] } {
  const geometry = buildMapGeometry(map);
  const envShapes = environmentShapes(map);
  const physics = new PhysicsWorld(geometry, mapTerrainMesh(map), envShapes);
  const phys = rules ? matchPhysics(rules, map) : { gravity: map.physics?.gravity ?? 1, fallDamage: map.physics?.fallDamage ?? false };
  const nav = buildMapNav(map, geometry, physics, envShapes, phys);
  return { geometry, physics, nav, phys, envShapes };
}
