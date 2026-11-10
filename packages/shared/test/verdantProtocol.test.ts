// Verdant Protocol (MAP 04, docs/map-briefs/MAP_04_Verdant_Protocol.md; built in MapMaker, docs/map-briefs/verdant_protocol/):
// the brief's landmarks, the bunker under its yard, our own foliage only, and its navigation as the match builds it.
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { getItem, initPhysics, loadMap, type MapDocument } from '../src/index.ts';
import { initNavigation, mapNavigation, validateMapNavigation } from '../src/match.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const text = readFileSync(new URL('../../../maps/verdant_protocol.json', import.meta.url)).toString();

describe('Verdant Protocol', () => {
  it('validates with no issues, navigation included, and has the brief\'s landmarks, bunker and modes', { timeout: 180_000 }, () => {
    const raw = JSON.parse(text) as MapDocument;
    const r = loadMap(text);
    if (!r.ok) throw new Error(JSON.stringify(r.issues));
    expect(r.issues).toEqual([]);
    const map = r.map;
    expect(map.metadata.id).toBe('verdant_protocol');
    expect(map.terrain).toBeTruthy();
    const pieces = (raw.setPieces ?? []).map((p) => p.piece);
    const tiles = raw.classicStructure.tiles;
    // The command building: a Server Vault and Barracks on the plateau (level 1).
    expect((raw.setPieces ?? []).some((p) => p.piece === 'setpiece.server_vault' && p.z === 1)).toBe(true);
    expect(tiles.filter((t) => t.tile === 'military.barracks' && t.z === 1).length).toBeGreaterThanOrEqual(2);
    // The greenhouse lab: glass rooms (skylights, breakable glass in the windows; no Glass tower facade, which is a dark
    // glass block with a neon trim, not a greenhouse).
    const glass = tiles.filter((t) => t.tile === 'core.room' && t.z === 0 && !t.options?.facade && t.options?.ceiling === 'skylight');
    expect(glass.length).toBeGreaterThanOrEqual(6);
    expect(glass.some((t) => Object.values(t.glass ?? {}).includes('breakable'))).toBe(true);
    // The old watchpost: a Guard Tower on the knoll (level 2), the one overlook.
    expect(tiles.some((t) => t.tile === 'military.guard_tower' && t.z === 2)).toBe(true);
    // The crashed supply craft: tilted free blocks east of centre.
    const crash = raw.entities.filter((e) => e.kind === 'block' && e.position[0] > 60 && e.position[0] < 110 && e.position[2] > 5 && e.position[2] < 40);
    expect(crash.length).toBeGreaterThanOrEqual(8);
    expect(crash.some((e) => e.kind === 'block' && (e.pitch || e.roll))).toBe(true);
    // The underground quarantine bunker: rooms on level -1 under the yard's floors, two stair huts up.
    const under = tiles.filter((t) => t.z === -1);
    expect(under.filter((t) => t.tile === 'core.stairs')).toHaveLength(2);
    for (const u of under.filter((t) => t.tile !== 'core.stairs' && t.tile !== 'core.room_large')) {
      const covered = tiles.some((t) => t.z === 0 && t.x === u.x && t.y === u.y) || (raw.setPieces ?? []).some((p) => p.z === 0 && p.y === u.y && (p.x === u.x || p.x + 1 === u.x));
      expect(covered, `${u.x},${u.y}`).toBe(true);
    }
    expect(pieces).toEqual(expect.arrayContaining(['setpiece.bunker', 'setpiece.bunker_cluster']));
    // Modes: Team Deathmatch, with CTF and King of the Hill from the flag bases and hills; 16 v 16.
    expect(map.metadata.supportedModes).toContain('core.tdm');
    expect(map.entities.filter((e) => e.kind === 'flag')).toHaveLength(2);
    expect(map.entities.filter((e) => e.kind === 'hill').length).toBeGreaterThanOrEqual(3);
    const spawns = map.entities.filter((e) => e.kind === 'spawn');
    for (const team of ['embers', 'tide']) expect(spawns.filter((e) => e.faction === team).length, team).toBeGreaterThanOrEqual(16);
    for (const e of map.entities) if (e.kind === 'pickup') expect(getItem(e.item), e.item).toBeDefined();
    // Our own foliage only (owner, 2026-11-08): every plant is an environment species, no Kenney trees or plants.
    const plants = map.entities.filter((e) => e.kind === 'prop' && /tree|palm|bush|fern|grass|flower|plant|hedge|cact/.test(e.model));
    expect(plants.filter((e) => e.kind === 'prop' && !e.model.startsWith('env.')).map((e) => (e.kind === 'prop' ? e.model : ''))).toEqual([]);
    expect(map.entities.filter((e) => e.kind === 'prop' && e.model.startsWith('env.')).length).toBeGreaterThan(200);
    // Navigation as validate-map and the match build it (an official map: its findings are errors).
    expect(validateMapNavigation(map, true).issues).toEqual([]);
    // The bunker's ward and the watchpost's top both ways from the yard.
    const built = mapNavigation(map);
    const yard = { x: 8, y: 0, z: -28 };
    for (const p of [{ x: -4, y: -4, z: -20 }, { x: 100, y: 7.85, z: 72 }, { x: -8, y: 3.85, z: 82 }]) {
      expect(built.nav.reachable(yard, p), JSON.stringify(p)).toBe(true);
      expect(built.nav.reachable(p, yard), JSON.stringify(p)).toBe(true);
    }
    built.physics.free();
    built.nav.destroy();
  });
});
