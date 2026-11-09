// MapMaker's starter layouts (docs/MAPMAKER_OVERHAUL_PLAN.md, Phase 3 item 5): maps/templates/<id>.json, built in
// MapMaker. Each loads, validates clean (no errors or warnings, every spawn and pickup reachable by bots), and sits
// apart from the suite (maps/*.json), so no map list, playlist or the menu shows it.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { MAP_TEMPLATES, blockBoxes, buildMapGeometry, initPhysics, liftLinks, loadMap, mapTerrainMesh, navLinks, PhysicsWorld, propBoxes, startFromTemplate, validateMap, type MapDocument } from '../src/index.ts';
import { NavWorld, initNavigation, validateNavigation } from '../src/match.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const dir = new URL('../../../maps/templates/', import.meta.url);
const load = (id: string): MapDocument => {
  const r = loadMap(readFileSync(new URL(`${id}.json`, dir), 'utf8'));
  if (!r.ok) throw new Error(`${id}: ${JSON.stringify(r.issues.slice(0, 3))}`);
  return r.map;
};

describe('map templates', () => {
  it('every template has its file, and every file is a template', () => {
    expect(readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort()).toEqual(MAP_TEMPLATES.map((t) => t.id).sort());
    // Not in the suite: maps/*.json (what the menu, playlists and the map index read) holds none of them.
    for (const t of MAP_TEMPLATES) expect(existsSync(new URL(`../../../maps/${t.id}.json`, import.meta.url))).toBe(false);
  });

  it.each(MAP_TEMPLATES.map((t) => t.id))('%s validates clean, every spawn and pickup reachable', { timeout: 180_000 }, (id) => {
    const map = load(id);
    expect(map.metadata.id).toBe(`template_${id}`);
    expect(validateMap(map).filter((i) => i.severity !== 'suggestion')).toEqual([]);
    const geometry = buildMapGeometry(map);
    const physics = new PhysicsWorld(geometry, mapTerrainMesh(map));
    const nav = NavWorld.build([...geometry, ...propBoxes(map, true), ...blockBoxes(map, true)], mapTerrainMesh(map), [...navLinks(map.entities, physics), ...liftLinks(map)]);
    expect(validateNavigation(map, nav).filter((i) => i.severity !== 'suggestion')).toEqual([]);
    nav.destroy();
    physics.free();
    const fresh = startFromTemplate(map, 'Mine');
    expect(fresh.metadata.id).not.toBe(map.metadata.id);
  });
});
