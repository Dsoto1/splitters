// Every map in maps/, headless (no browser): it loads and validates, its geometry, navmesh and physics build, and
// 90 ticks (1.5 s) of its own mode with bots run without a throw, nobody falls out of the world and every spawn
// point stands on walkable ground. The browser map tour (e2e mapsFlow) runs nightly; this runs on every change that
// touches shared, map or content code (e2e/flowMap.mjs: those run the shared unit tests).
//
// Split over ALL_MAPS_PARTS files (allMaps1..N.test.ts) so vitest runs them side by side. ALL_MAPS=id1,id2 checks only those maps.
import { readdirSync, readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { BOT_DIFFICULTIES, CORE_BOT_PROFILES, buildMapGeometry, initPhysics, loadMap, rulesForMap } from '../src/index.ts';
import { Match, initNavigation, validateMapNavigation } from '../src/match.ts';

const MAPS = new URL('../../../maps/', import.meta.url);
const only = process.env.ALL_MAPS?.split(',').filter(Boolean);
/** How many test files share the maps (allMaps1.test.ts … allMaps<N>.test.ts). */
export const ALL_MAPS_PARTS = 8;
/** The maps part `part` (0-based) checks: every ALL_MAPS_PARTS-th by name. */
export const mapsOfPart = (part: number): string[] =>
  readdirSync(MAPS)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -5))
    .filter((id) => !only || only.includes(id))
    .sort()
    .filter((_, i) => i % ALL_MAPS_PARTS === part);
const BOTS = 8;
const TICKS = 90;

export function checkMaps(part: number): void {
  beforeAll(() => Promise.all([initPhysics(), initNavigation()]));
  const ids = mapsOfPart(part);
  if (!ids.length) it.skip('no maps in this part', () => {});
  describe.each(ids)('map %s', (id) => {
    it('loads, validates, builds and plays 90 ticks with bots', { timeout: 120_000 }, () => {
      const loaded = loadMap(readFileSync(new URL(`${id}.json`, MAPS), 'utf8'));
      expect(loaded.ok, loaded.issues.filter((i) => i.severity === 'error').map((i) => i.message).join('; ')).toBe(true);
      if (!loaded.ok) return;
      const map = loaded.map;
      expect(map.metadata.id).toBe(id);
      expect(loaded.issues.filter((i) => i.severity === 'error')).toEqual([]);

      // Geometry, physics and the navmesh as the match builds them (drop links in), and the navigation audit, as
      // pnpm validate-map does (an official map: no traps, nothing cut off, no spawn point inside something solid,
      // unless known: auditKnown.ts).
      expect(buildMapGeometry(map).length + (map.terrain ? 1 : 0)).toBeGreaterThan(0);
      const navIssues = validateMapNavigation(map, true).issues;
      expect(navIssues.filter((i) => i.severity === 'error').map((i) => `${i.code}: ${i.message}`)).toEqual([]);
      // Every spawn point is on walkable ground.
      expect(navIssues.filter((i) => i.code === 'nav.spawn_off_mesh').map((i) => i.message)).toEqual([]);

      // Its own mode, with bots: the match runs, and nobody ends up below the world.
      const match = new Match(map, rulesForMap(map), 42);
      for (let i = 0; i < BOTS; i++) match.addBot(`bot${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!, BOT_DIFFICULTIES.normal);
      expect(match.combatants().length).toBeGreaterThan(0);
      // Maps with basements (sewers, cisterns) spawn below 0: below the lowest spawn is falling (as e2e's map tour).
      const floor = Math.min(-5, ...map.entities.filter((e) => e.kind === 'spawn').map((e) => e.position[1] - 2));
      const fell = new Set<string>();
      for (let t = 0; t < TICKS; t++) {
        match.step();
        for (const c of match.combatants()) if (c.alive && c.move.pos.y < floor) fell.add(`${c.name} (y ${c.move.pos.y.toFixed(1)})`);
      }
      expect([...fell], `fell below ${floor.toFixed(1)}`).toEqual([]);
      expect(match.combatants().every((c) => Number.isFinite(c.move.pos.x) && Number.isFinite(c.move.pos.y) && Number.isFinite(c.move.pos.z))).toBe(true);
      match.destroy();
    });
  });
}
