import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as sp from '../setpieces.mjs';

const clone = (v) => JSON.parse(JSON.stringify(v));
const ROOT = sp.ROOT;

describe('set-piece generator (tools/content/setpieces.mjs)', () => {
  const content = sp.load();
  const piece = (c, id) => c.families.flatMap((f) => f.json.pieces).find((p) => p.id === id);
  const pack = (c, id) => c.roles.packs.find((p) => p.id === id);

  it('finds no problems (every piece placed in each turn, mirror and pack) and the generated file is up to date', { timeout: 120_000 }, () => {
    const { problems, out } = sp.build(content);
    expect(problems).toEqual([]);
    expect(out.pieces.map((p) => p.def.id)).toEqual(expect.arrayContaining(['setpiece.carriageway_1', 'setpiece.carriageway_2', 'setpiece.skybridge_2', 'setpiece.skybridge_3', 'setpiece.skybridge_4']));
    expect(sp.render(out)).toBe(readFileSync(join(ROOT, 'packages/shared/src/content/setPieces.generated.ts'), 'utf8'));
  });

  it('checks the role packs: fields, themes, materials, facades, door styles, glass', () => {
    const c = clone(content);
    pack(c, 'snow').colour = 'grey';
    pack(c, 'gothic').themes.push('core.castle');
    pack(c, 'medieval').roles.stone.material = 'core.marzipan';
    pack(c, 'imperial').roles.facade = 'baroque';
    pack(c, 'military').roles.door = 'revolving';
    pack(c, 'neon').roles.glass = 'stained';
    pack(c, 'harbor').stylePack = 'atlantis';
    const p = sp.build(c, ROOT, { skipDeep: true }).problems.join('\n');
    expect(p).toMatch(/\(snow\): unknown field "colour"/);
    expect(p).toMatch(/\(gothic\): theme core\.castle is already collegiate's/);
    expect(p).toMatch(/\(medieval\): roles\.stone: core\.marzipan is not a material/);
    expect(p).toMatch(/\(imperial\): roles\.facade: baroque is not a facade/);
    expect(p).toMatch(/\(military\): roles\.door: revolving is not a door style/);
    expect(p).toMatch(/\(neon\): roles\.glass is breakable, reinforced or none/);
    expect(p).toMatch(/\(harbor\): stylePack atlantis is not a Style Pack/);
  });

  it('checks the families: ids, families and packs', () => {
    const c = clone(content);
    piece(c, 'setpiece.carriageway_1').id = 'carriageway one';
    piece(c, 'setpiece.skybridge_2').packs.push('baroque');
    c.families[0].json.extra = true;
    const p = sp.build(c, ROOT, { skipDeep: true }).problems.join('\n');
    expect(p).toMatch(/id is setpiece\.<name>/);
    expect(p).toMatch(/packs: baroque is not a role pack/);
    expect(p).toMatch(/carriageway\.json: unknown field "extra"/);
  });

  it('checks the pieces with the game: schema, references, footprint, ports, markers, mirror, and every expansion', { timeout: 120_000 }, () => {
    const c = clone(content);
    const one = piece(c, 'setpiece.carriageway_1');
    one.parts[0].colour = 'red';
    one.parts[1].tile = 'core.nothing';
    one.parts[4].position = [20, 2, 0];
    one.ports.push({ side: 'N', cell: [3, 3], level: 0, kind: 'door' });
    one.markers.push({ name: 'odd', kind: 'doorPair', parts: [0, 1] });
    const two = piece(c, 'setpiece.carriageway_2');
    two.parts[0].tile = 'core.stairs';
    two.parts[0].rotation = 1;
    delete two.parts[0].edges;
    delete two.parts[0].options;
    two.ports.push({ side: 'E', cell: [0, 0], level: 0, kind: 'door' });
    const sky = piece(c, 'setpiece.skybridge_2');
    sky.parts[0].edges['0,0,0:Q'] = 'wall';
    const p = sp.build(c).problems.join('\n');
    expect(p).toMatch(/carriageway_1\): unknown field "parts\[0\]\.colour"/);
    expect(p).toMatch(/carriageway_1\): parts\[1\] \(tile\): core\.nothing is not a tile/);
    expect(p).toMatch(/carriageway_1\): parts\[4\] \(light\): at \[20, 2, 0\], outside the footprint/);
    expect(p).toMatch(/carriageway_1\): ports\[6\]: cell \[3, 3\] on level 0 is not in the footprint/);
    expect(p).toMatch(/carriageway_1\): markers\.odd: a door pair is two doors/);
    expect(p).toMatch(/carriageway_2\): ports\[8\]: side E of \[0, 0\] faces the piece's own cell/);
    expect(p).toMatch(/carriageway_2\): mirror: "free", but Stairs \(core\.stairs\) isn't its own mirror image/);
    expect(p).toMatch(/skybridge_2\): parts\.0\.edges\.0,0,0:Q: Invalid key/);
    // And what the piece expands into, placed (tiles of its own overlapping).
    expect(p).toMatch(/carriageway_2\): placed: tile\.overlap: tiles sp_check_piece_0 and sp_check_piece_2 overlap/);
  });
});
