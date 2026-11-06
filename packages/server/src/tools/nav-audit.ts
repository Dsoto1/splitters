import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMapGeometry, environmentNavTriangles, environmentShapes, initPhysics, joinTriangles, liftLinks, loadMap, mapTerrainMesh, navLinks, PhysicsWorld, propBoxes, blockBoxes, type MapDocument } from '@tiletrigger/shared';
import { NavWorld, auditNavigation, dropOptions, initNavigation, polyShapes } from '@tiletrigger/shared/match';
import { drawNavPicture } from './navPictures.ts';

/**
 * The navigation audit over maps (docs/BOTS.md, "Navigation audit"): per map, the navmesh as the match builds it
 * (links and ledge-drop links in), its patches that don't route to the main area (traps bots get into, islands
 * nobody does), spawn points, objectives and pickups cut off, and a picture.
 *
 *   pnpm nav-audit [map ids…] [--pictures=dir] [--no-drops] [--all]   (no ids: every map in maps/)
 *   --no-drops builds without the ledge-drop links (what the audit finds without them); --all lists islands too.
 */
const flags = process.argv.slice(2).filter((a) => a.startsWith('--'));
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const opt = (k: string) => flags.find((f) => f.startsWith(`--${k}=`))?.slice(k.length + 3);
const here = (p: string) => resolve(process.env.INIT_CWD ?? process.cwd(), p);
const mapsDir = fileURLToPath(new URL('../../../../maps/', import.meta.url));
const noDrops = flags.includes('--no-drops');
const pictures = opt('pictures');

await Promise.all([initPhysics(), initNavigation()]);
const ids = args.length ? args : readdirSync(mapsDir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();
let traps = 0;
let errors = 0;
for (const id of ids) {
  const path = id.endsWith('.json') ? here(id) : `${mapsDir}${id}.json`;
  const loaded = loadMap(readFileSync(path, 'utf8'));
  if (!loaded.ok) {
    console.log(`${id}: does not load`);
    continue;
  }
  const map: MapDocument = loaded.map;
  const t0 = performance.now();
  const geometry = buildMapGeometry(map);
  const envShapes = environmentShapes(map);
  const physics = new PhysicsWorld(geometry, mapTerrainMesh(map), envShapes);
  const phys = { gravity: map.physics?.gravity ?? 1, fallDamage: map.physics?.fallDamage ?? false };
  const t1 = performance.now();
  const drops = dropOptions(map, physics, geometry, phys);
  const solids = [...propBoxes(map, true), ...blockBoxes(map, true)];
  const nav = NavWorld.build([...geometry, ...solids], joinTriangles(mapTerrainMesh(map), environmentNavTriangles(envShapes)), [...navLinks(map.entities, physics, phys.gravity, solids), ...liftLinks(map)], false, noDrops ? null : drops);
  const t2 = performance.now();
  const audit = auditNavigation(map, nav, physics, { ...drops, official: path.startsWith(mapsDir) });
  const t3 = performance.now();
  const g = audit.graph;
  const ground = [...g.type].filter((t) => t === 0).length;
  const fmt = (p: { x: number; y: number; z: number }) => `(${p.x.toFixed(0)}, ${p.y.toFixed(1)}, ${p.z.toFixed(0)})`;
  const islands = audit.patches.filter((p) => !audit.traps.includes(p));
  console.log(`\n== ${id}: ${ground} polygons, ${nav.drops} drop links | traps ${audit.traps.length} (${audit.traps.reduce((a, t) => a + t.area, 0).toFixed(0)} m²), islands ${islands.length} (${islands.reduce((a, t) => a + t.area, 0).toFixed(0)} m²) | physics ${(t1 - t0).toFixed(0)} ms, navmesh ${(t2 - t1).toFixed(0)} ms, audit ${(t3 - t2).toFixed(0)} ms`);
  for (const t of audit.traps) {
    const by = t.entries.map((e) => e.kind).reduce((m, k) => m.set(k, (m.get(k) ?? 0) + 1), new Map<string, number>());
    console.log(`  trap ${t.area.toFixed(0)} m² round ${fmt(t.centre)} [${fmt(t.min)}..${fmt(t.max)}]: in by ${[...by].map(([k, v]) => `${k} ${v}`).join(', ')}${t.dropOut ? `; drop out ${t.dropOut.drop.toFixed(1)} m at ${fmt(t.dropOut.at)}` : '; no way out'}${t.holds.length ? `; holds ${t.holds.join(', ')}` : ''}`);
  }
  // (Room to stand at a patch's middle: none means it's inside something solid, a surface Recast found in a closed box.)
  const room = (p: { x: number; y: number; z: number }) => (physics.boxClear({ x: p.x, y: p.y + 1, z: p.z }, { x: 0.2, y: 0.6, z: 0.2 }) ? '' : ' INSIDE SOLID');
  if (flags.includes('--all')) for (const t of islands) console.log(`  island ${t.area.toFixed(1)} m² round ${fmt(t.centre)}${room(t.centre)}${t.holds.length ? `; holds ${t.holds.join(', ')}` : ''}${t.dropOut ? `; drop out ${t.dropOut.drop.toFixed(1)} m` : ''}`);
  if (flags.includes('--all')) for (const t of audit.traps) console.log(`  trap ${t.area.toFixed(1)} m² round ${fmt(t.centre)}${room(t.centre)}`);
  for (const i of audit.issues) console.log(`  ${i.severity.toUpperCase()} ${i.code}: ${i.message}`);
  if (flags.includes('--comps')) {
    // The biggest components of routes: area, spawn points, extent (which one is the main area, and why).
    const { area, centre } = polyShapes(g);
    const comps = new Map<number, { area: number; polys: number; spawns: number; y0: number; y1: number; x0: number; x1: number; z0: number; z1: number }>();
    for (let i = 0; i < g.count; i++) {
      if (g.type[i] !== 0) continue;
      const c = comps.get(audit.comp[i]!) ?? comps.set(audit.comp[i]!, { area: 0, polys: 0, spawns: 0, y0: Infinity, y1: -Infinity, x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity }).get(audit.comp[i]!)!;
      c.area += area[i]!;
      c.polys++;
      c.y0 = Math.min(c.y0, centre[i * 3 + 1]!);
      c.y1 = Math.max(c.y1, centre[i * 3 + 1]!);
      c.x0 = Math.min(c.x0, centre[i * 3]!);
      c.x1 = Math.max(c.x1, centre[i * 3]!);
      c.z0 = Math.min(c.z0, centre[i * 3 + 2]!);
      c.z1 = Math.max(c.z1, centre[i * 3 + 2]!);
    }
    for (const e of map.entities) {
      if (e.kind !== 'spawn') continue;
      const hit = nav.nearestPoly({ x: e.position[0], y: e.position[1], z: e.position[2] }, { x: 1, y: 1, z: 1 });
      if (hit) comps.get(audit.comp[hit.index]!)!.spawns++;
    }
    for (const [c, v] of [...comps].sort((a, b) => b[1].area - a[1].area).slice(0, 10)) console.log(`  comp ${c}${c === audit.main ? ' (main)' : ''}: ${v.area.toFixed(0)} m², ${v.polys} polygons, ${v.spawns} spawns, y ${v.y0.toFixed(1)}..${v.y1.toFixed(1)}, x ${v.x0.toFixed(0)}..${v.x1.toFixed(0)}, z ${v.z0.toFixed(0)}..${v.z1.toFixed(0)}`);
  }
  traps += audit.traps.length;
  errors += audit.issues.filter((i) => i.severity === 'error').length;
  if (pictures) drawNavPicture(here(pictures), map, nav, audit, []);
  physics.free();
  nav.destroy();
}
console.log(`\n${ids.length} maps: ${traps} traps, ${errors} errors`);
