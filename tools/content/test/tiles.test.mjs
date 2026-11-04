import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as tiles from '../tiles.mjs';

const clone = (v) => JSON.parse(JSON.stringify(v));
const ROOT = tiles.ROOT;

describe('tiles generator (tools/content/tiles.mjs)', () => {
  const content = tiles.load();
  const tile = (c, id) => c.core.tiles.find((t) => t.id === id);
  const edge = (c, id) => c.edges.edges.find((e) => e.id === id);

  it('finds no problems and the generated files are up to date', () => {
    const { problems, out } = tiles.build(content);
    expect(problems).toEqual([]);
    expect(tiles.renderEdges(out)).toBe(readFileSync(join(ROOT, 'packages/shared/src/content/edgeStyles.generated.ts'), 'utf8'));
    expect(tiles.renderTiles(out)).toBe(readFileSync(join(ROOT, 'packages/shared/src/content/kitTiles.generated.ts'), 'utf8'));
  });

  it('reads edge values', () => {
    expect(tiles.uValue('-half+0.75')).toEqual([{ half: -1, add: 0.75 }, null]);
    expect(tiles.uValue('half')).toEqual([{ half: 1 }, null]);
    expect(tiles.uValue(1.5)).toEqual([1.5, null]);
    expect(tiles.uValue('height')[1]).toMatch(/is not metres/);
    expect(tiles.yValue('height*2-0.2')).toEqual([{ height: 2, add: -0.2 }, null]);
    expect(tiles.yValue('min(3.5,height)')).toEqual([{ upTo: 3.5 }, null]);
    expect(tiles.yValue('half')[1]).toMatch(/is not metres/);
  });

  it('checks the edge styles', () => {
    const c = clone(content);
    edge(c, 'wall').thickness = 1;
    edge(c, 'door').segments[0].u[0] = 'halfway';
    edge(c, 'window').glass = true;
    delete edge(c, 'window').openings;
    edge(c, 'bars').segments[0].repeat.through = 'half';
    edge(c, 'auto').segments = [];
    edge(c, 'arch').dressing = { kind: 'door' };
    c.edges.edges.push(clone(edge(c, 'half')));
    c.edges.edges = c.edges.edges.filter((e) => e.id !== 'open');
    const p = tiles.build(c).problems.join('\n');
    expect(p).toMatch(/edges\[1\] \(wall\): unknown field "thickness"/);
    expect(p).toMatch(/\(door\): segments\[0\]\.u\[0\]: "halfway" is not metres/);
    expect(p).toMatch(/\(window\): glass needs "openings"/);
    expect(p).toMatch(/\(bars\): segments\[0\]\.repeat: give one of "through"/);
    expect(p).toMatch(/\(auto\): a rule style \(built by code\) has no segments/);
    expect(p).toMatch(/\(arch\): dressing\.span/);
    expect(p).toMatch(/id half is listed twice/);
    expect(p).toMatch(/keep the "open" style/);
  });

  it('checks the tiles: schema, cells, ports, edges, parts, models and materials', () => {
    const c = clone(content);
    tile(c, 'core.room').colour = 'red';
    tile(c, 'core.corridor').category = 'Hallways';
    tile(c, 'core.stairs').ports.push({ side: 'N', level: 2 });
    tile(c, 'core.corridor_windows').edgeDefault = 'portholes';
    tile(c, 'core.warehouse').edgeDefaults['5,0,1:S'] = 'windows';
    tile(c, 'core.dead_end').solids.push({ cube: [0, 0, 0, 1, 1, 1] });
    tile(c, 'core.yard_crates').solids[0].surface = { material: 'core.nothing' };
    tile(c, 'core.pit').extraFloors[0].box = [4, 0, 0, -4, 1, 1];
    tile(c, 'city.street').model.file = 'city/nowhere.glb';
    tile(c, 'core.room_long').cells = [[0, 0, 0]];
    c.core.tiles.push(clone(tile(c, 'core.platform')));
    const p = tiles.build(c).problems.join('\n');
    expect(p).toMatch(/\(core\.room\): unknown field "colour"/);
    expect(p).toMatch(/\(core\.corridor\)\.category: one of Rooms/);
    expect(p).toMatch(/\(core\.stairs\): ports\[2\]: cell \[0, 0\] on level 2 isn't one of its cells/);
    expect(p).toMatch(/\(core\.corridor_windows\): edgeDefault portholes is not an edge style/);
    expect(p).toMatch(/\(core\.warehouse\): edgeDefaults 5,0,1:S: not one of its cells/);
    expect(p).toMatch(/\(core\.dead_end\)\.solids\[1\]: unknown field "cube"/);
    expect(p).toMatch(/\(core\.yard_crates\)\.solids\[0\]\.surface\.material: one of /);
    expect(p).toMatch(/\(core\.pit\): extraFloors\[0\]: box is \[x0, y0, z0, x1, y1, z1\]/);
    expect(p).toMatch(/\(city\.street\): model packages\/client\/public\/city\/nowhere\.glb not found/);
    expect(p).toMatch(/\(core\.room_long\): give one of "cells" or "footprint"/);
    expect(p).toMatch(/id core\.platform is listed twice/);
  });

  it('keeps every tile and edge style the maps and Style Packs name', () => {
    const c = clone(content);
    c.core.tiles = c.core.tiles.filter((t) => !['core.room', 'core.catwalk'].includes(t.id));
    c.edges.edges = c.edges.edges.filter((e) => e.id !== 'fence');
    const p = tiles.build(c).problems.join('\n');
    expect(p).toMatch(/maps\/[a-z0-9_]+\.json: names tile core\.room, which isn't in content\/tiles\/core\.json/);
    expect(p).toMatch(/editor\/stylePacks\.ts: names tile core\.catwalk/);
    expect(p).toMatch(/maps\/[a-z0-9_]+\.json: names edge style fence, which isn't in content\/tiles\/edges\.json/);
  });
});
