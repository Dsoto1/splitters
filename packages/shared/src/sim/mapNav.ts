import { hintJumps } from '../bots/hints.ts';
import { blockBoxes, boxesRay, buildMapGeometry, mapKillY, mapTerrainMesh, propBoxes, type WorldBox } from '../map/geometry.ts';
import { environmentNavTriangles, environmentShapes, joinTriangles, type EnvWorldShape } from '../map/environment.ts';
import type { MapDocument } from '../map/schema.ts';
import type { Vec3 } from '../math.ts';
import { NavWorld, navSettingsKey, validateNavigation, type DropOptions, type NavExport } from '../nav/index.ts';
import { auditNavigation, type NavAudit } from '../nav/audit.ts';
import type { ValidationIssue } from '../map/validate.ts';
import { LIQUID_SPECS, SWIM_DEPTH, liquidAt, mapLiquids } from './liquids.ts';
import { navLinks, type ExtraRay } from './movement.ts';
import { liftLinks } from './movers.ts';
import { PhysicsWorld } from './physics.ts';
import { DOOR, destructibleBox, doorway, type OBox } from './scenarioDefs.ts';
import { windowPanes } from './glass.ts';
import { matchPhysics, type MatchRules } from './rules.ts';
import { botHintNavIssues } from '../map/botHints.ts';
import { vantageFor, type VantageSpot } from '../bots/vantage.ts';
import type { ParkourKind } from '../nav/parkour.ts';

/**
 * The highest drop a ledge-drop link takes (m, at normal gravity) with fall damage on: one that costs at most about
 * 30 health (fall damage starts past 5 m: match.ts trackFall). With it off, any drop that lands on the navmesh.
 */
export const DROP_HURTS_UP_TO = 5 + 30 / 9;
const DROP_FREE = 60;

/** What the scenario adds that bodies can't pass while it stands: window panes, door panels, breakable walls and boards. */
function scenarioBlockers(map: MapDocument): OBox[] {
  const out: OBox[] = windowPanes(map).map((p) => p.box);
  for (const e of map.entities) {
    if (e.kind === 'door') {
      const d = doorway(e);
      out.push({ ...d, half: { ...d.half, z: DOOR.thickness } });
    } else if (e.kind === 'destructible') out.push(destructibleBox(e));
  }
  return out;
}

/** A ray against boxes physics doesn't hold yet (the scenario's solids), for jump pads' landings; none for none. */
export const solidsRay = (solids: readonly WorldBox[]): ExtraRay | undefined => (solids.length ? (o, d, max) => boxesRay(solids, o, d, max) : undefined);

/** What the navmesh's ledge-drop links need from the match (NavWorld.build `drops`). */
export function dropOptions(map: MapDocument, physics: PhysicsWorld, geometry: readonly WorldBox[], phys: { gravity: number; fallDamage: boolean }): DropOptions {
  const liquids = mapLiquids(map.entities);
  return {
    physics,
    gravity: phys.gravity,
    blockers: scenarioBlockers(map),
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
    // The map's jump links (bot hints): parkour candidates first, played through like the rest.
    jumps: hintJumps(map),
  };
}

/**
 * The bots' navmesh of a map, as the match builds it: the level, breakable props and moving or breaking blocks
 * (plus `extra` boxes: Fort Wars' pieces), terrain and the environment's shapes, the map's links (jump pads, ladders,
 * portals, ziplines, lifts) and ledge-drop links off patches that have no other way down.
 */
export function buildMapNav(map: MapDocument, geometry: readonly WorldBox[], physics: PhysicsWorld, envShapes: readonly EnvWorldShape[], phys: { gravity: number; fallDamage: boolean }, extra: readonly WorldBox[] = [], parkour = true): NavWorld {
  // (Parkour links at load only: a rebuild in a match, Fort Wars' pieces, goes without them. Played through mid-match they
  // cost a hitch, and over the forts' walls they took attackers off the way to the flag: forts.test's capture.)
  const drops = { ...dropOptions(map, physics, geometry, phys), noParkour: !parkour };
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

/** A 53-bit string hash (cyrb53), two lanes over the text's UTF-16 units: a key, not a secret. */
function hashText(text: string, h1 = 0xdeadbeef, h2 = 0x41c6ce57): [number, number] {
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return [h1 >>> 0, h2 >>> 0];
}

/** The same hash over a typed array's bytes, 32 bits at a time. */
function hashWords(words: Uint32Array, seed: [number, number]): [number, number] {
  let [h1, h2] = seed;
  for (let i = 0; i < words.length; i++) {
    const c = words[i]!;
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return [h1 >>> 0, h2 >>> 0];
}

/**
 * What a map's navmesh is built from (buildMapNav, at load: no `extra`, parkour on), as a key: two maps with the same
 * key get the same navmesh. It hashes what the build reads, worked out (the level's boxes, the terrain's triangles, the
 * environment's shapes, the scenario's solids and blockers, the bot hints' jumps, the lifts' links, the kill height,
 * gravity and fall damage) and every placement but props, by its place in the list (a portal's pair goes by it); a
 * prop counts only through the boxes and shapes it makes. So MapMaker's navigation check, which builds from the map as
 * shown (set pieces expanded, the ground as shown), can hand its navmesh to the Test's match, which plays the map as
 * loadMap gives it, exactly when the two come out the same (NavWorld.export / Match `nav`).
 */
export function navInputKey(map: MapDocument, geometry: readonly WorldBox[], envShapes: readonly EnvWorldShape[], phys: { gravity: number; fallDamage: boolean }): string {
  const terrain = mapTerrainMesh(map);
  const text = JSON.stringify([
    navSettingsKey(),
    phys.gravity,
    phys.fallDamage,
    mapKillY(geometry, map),
    geometry,
    envShapes,
    propBoxes(map, true),
    blockBoxes(map, true),
    windowPanes(map),
    hintJumps(map),
    liftLinks(map),
    map.entities.map((e, i) => (e.kind === 'prop' ? i : [i, e])),
  ]);
  let h = hashText(text);
  if (terrain) {
    h = hashWords(new Uint32Array(terrain.positions.buffer, terrain.positions.byteOffset, terrain.positions.length), h);
    h = hashWords(new Uint32Array(terrain.indices.buffer, terrain.indices.byteOffset, terrain.indices.length), h);
  } else h = hashText('no terrain', ...h);
  return `${NAV_KEY_VERSION}:${h[0].toString(36)}${h[1].toString(36)}:${text.length.toString(36)}`;
}

/** Bump when buildMapNav's inputs change (so an old key can't match a new build). */
const NAV_KEY_VERSION = 1;

/** A match's navmesh key (navInputKey) for `map` under `rules`, worked out as the match works it out (a store's lookup before the match). */
export function mapNavKey(map: MapDocument, rules: MatchRules): string {
  const geometry = buildMapGeometry(map);
  return navInputKey(map, geometry, environmentShapes(map), matchPhysics(rules, map));
}

/** A navmesh built ahead (MapMaker's navigation check), with the key of what it was built from (navInputKey). */
export interface PrebuiltNav {
  key: string;
  nav: NavExport;
}

/** Bytes a navmesh export holds (its Detour tile, most of it; the parkour links at a rough 100 bytes each). */
export const navExportBytes = (n: NavExport): number => n.mesh.byteLength + (n.walkReach?.byteLength ?? 0) + n.parkour.length * 100 + n.spawnSeeds.length * 24;

/**
 * Navmeshes kept between matches in this process (docs/SCALING_STUDY_2026-11-15.md, recommended order 1): the next
 * match of the same map (the same key: navInputKey, what the build reads, with the navmesh's settings) takes its
 * navmesh from here instead of building it. The most recently used first; past `maxEntries` or `maxBytes` the
 * oldest go. A dedicated host keeps them as long as it runs; a browser host also keeps them in its own storage
 * (client game/navCache.ts).
 */
export class NavCache {
  private readonly entries = new Map<string, { nav: NavExport; size: number }>();
  private bytes = 0;
  hits = 0;
  misses = 0;

  constructor(
    readonly maxEntries = 6,
    readonly maxBytes = 96 * 1024 * 1024,
  ) {}

  get size(): number {
    return this.entries.size;
  }

  get(key: string): NavExport | undefined {
    const e = this.entries.get(key);
    if (!e) return undefined;
    this.drop(key);
    // (Its data sent away to another thread, transferred: gone here.)
    if (!e.nav.mesh.byteLength) return undefined;
    // (Most recently used last: Map keeps insertion order.)
    this.entries.set(key, e);
    this.bytes += e.size;
    return e.nav;
  }

  put(key: string, nav: NavExport): void {
    const size = navExportBytes(nav);
    if (size > this.maxBytes) return;
    this.drop(key);
    this.entries.set(key, { nav, size });
    this.bytes += size;
    for (const k of this.entries.keys()) {
      if (this.entries.size <= this.maxEntries && this.bytes <= this.maxBytes) break;
      this.drop(k);
    }
  }

  private drop(key: string): void {
    const e = this.entries.get(key);
    if (!e) return;
    this.entries.delete(key);
    this.bytes -= e.size;
  }

  clear(): void {
    this.entries.clear();
    this.bytes = 0;
  }
}

/**
 * This build of the navigation code, for a store that outlives it (a browser host's: client game/navCache.ts): the
 * name of the file this code runs from (in the game's build its name carries a hash of its code).
 */
export function navBuildId(): string {
  try {
    return new URL(import.meta.url).pathname.split('/').pop() ?? '';
  } catch {
    return '';
  }
}

/** This process's navmeshes (every match of a map takes from it: loadMapNav). */
export const navCache = new NavCache();

/**
 * The navmesh a match builds at load (buildMapNav), or the same NavWorld without the build (seconds on a big map):
 * `prebuilt`'s when its key is this map's (MapMaker's check, a browser host's storage), else navCache's. `reused`
 * says which; `built` is a fresh build's export (also put in navCache), for a store that keeps it longer.
 */
export function loadMapNav(map: MapDocument, geometry: readonly WorldBox[], physics: PhysicsWorld, envShapes: readonly EnvWorldShape[], phys: { gravity: number; fallDamage: boolean }, prebuilt?: PrebuiltNav | null, cache: NavCache | null = navCache): { nav: NavWorld; reused: boolean; built: PrebuiltNav | null } {
  const key = prebuilt || cache ? navInputKey(map, geometry, envShapes, phys) : '';
  for (const data of [prebuilt?.key === key ? prebuilt.nav : undefined, cache?.get(key)]) {
    if (!data) continue;
    try {
      const nav = NavWorld.import(data);
      if (cache) {
        cache.hits++;
        if (data === prebuilt?.nav) cache.put(key, data);
      }
      return { nav, reused: true, built: null };
    } catch {
      // Data that doesn't import (another build's): the next, or built here.
    }
  }
  const nav = buildMapNav(map, geometry, physics, envShapes, phys);
  if (!cache) return { nav, reused: false, built: null };
  cache.misses++;
  const built = { key, nav: nav.export() };
  cache.put(key, built.nav);
  return { nav, reused: false, built };
}

/**
 * The navigation checks of a map as a match would play it (validate-map, the all-maps test, MapMaker's validator):
 * its navmesh and physics built as the match builds them, then validateNavigation with the navigation audit.
 * `official`: a map in maps/ (the audit's findings and blocked spawn points are errors; for creators, warnings).
 */
export function validateMapNavigation(map: MapDocument, official: boolean, opts: { computed?: boolean; prebuilt?: boolean } = {}): { issues: ValidationIssue[]; audit: NavAudit; computed?: ComputedBotSpots; prebuilt?: PrebuiltNav } {
  const built = mapNavigation(map);
  try {
    // (`prebuilt`: the navmesh as built, before the checks read it, for a match of this map: MapMaker's Test.)
    const prebuilt = opts.prebuilt ? { key: navInputKey(map, built.geometry, built.envShapes, built.phys), nav: built.nav.export() } : null;
    // (And for a match of this map in this process: the jump pads' flights after the check take it from navCache.)
    if (prebuilt) navCache.put(prebuilt.key, prebuilt.nav);
    const drop = { ...dropOptions(map, built.physics, built.geometry, built.phys), official };
    const audit = auditNavigation(map, built.nav, built.physics, drop);
    // Bot hints (v33) off the navmesh: warnings (map/botHints.ts).
    const issues = [...validateNavigation(map, built.nav, built.physics, { ...drop, done: audit }), ...botHintNavIssues(map, built.nav)];
    return { issues, audit, ...(opts.computed ? { computed: computedBotSpots(built) } : {}), ...(prebuilt ? { prebuilt } : {}) };
  } finally {
    built.physics.free();
    built.nav.destroy();
  }
}

/**
 * What bots work out for themselves on a map (MapMaker's "What bots know" overlay, read-only): the vantage spots
 * campers and snipers pick from (bots/vantage.ts vantageFor, from the main area's places, as the match does before the
 * trips' lanes reweigh them) and the parkour links routes take (nav/parkour.ts). Bots work out no chokepoints or staging
 * spots of their own today.
 */
export interface ComputedBotSpots {
  vantage: VantageSpot[];
  parkour: { kind: ParkourKind; start: Vec3; end: Vec3 }[];
}

function computedBotSpots(built: { nav: NavWorld; physics: PhysicsWorld }): ComputedBotSpots {
  const { nav, physics } = built;
  const vantage = vantageFor(nav.mainPlaces(), (o, d, max) => physics.raycastWorld(o, d, max), nav.parkourPlaces()).map((v) => ({ ...v, pos: { ...v.pos } }));
  return { vantage, parkour: nav.parkour.map((l) => ({ kind: l.kind, start: { ...l.start }, end: { ...l.end } })) };
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
