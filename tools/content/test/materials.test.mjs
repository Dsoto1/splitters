import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as materials from '../materials.mjs';

const clone = (v) => JSON.parse(JSON.stringify(v));
const ROOT = materials.ROOT;

describe('materials generator (tools/content/materials.mjs)', () => {
  const content = materials.load();
  const mat = (c, id) => c.materials.materials.find((m) => m.id === id);
  const theme = (c, id) => c.materials.themes.find((t) => t.id === id);

  it('finds no problems and the generated file is up to date', () => {
    const { problems, out } = materials.build(content);
    expect(problems).toEqual([]);
    expect(materials.render(out)).toBe(readFileSync(join(ROOT, 'packages/shared/src/content/materials.generated.ts'), 'utf8'));
  });

  it('reads the pattern, category and slot lists from map/materials.ts', () => {
    const src = 'packages/shared/src/map/materials.ts';
    expect(materials.tsList(ROOT, src, 'PATTERN_IDS')).toContain('glyphs_painted');
    expect(materials.tsList(ROOT, src, 'MATERIAL_CATEGORIES')).toContain('Ground');
    expect(materials.tsList(ROOT, src, 'SURFACE_SLOTS')).toEqual(['floor', 'walls', 'solids', 'underside', 'trim', 'roof']);
  });

  it('checks the schema: unknown fields, enums, colours and numbers', () => {
    const c = clone(content);
    mat(c, 'core.concrete').roughness = 0.5;
    mat(c, 'core.sandstone').pattern = 'paisley';
    mat(c, 'core.cobble').category = 'Rubble';
    mat(c, 'core.sand').base = 'beige';
    mat(c, 'core.plaster').accent = '#ABCDEF';
    mat(c, 'core.marble').scale = 0;
    mat(c, 'core.red_brick').shine = 1.5;
    delete mat(c, 'core.dark_brick').pattern;
    mat(c, 'core.pbr_concrete').pattern = 'noise';
    theme(c, 'core.tomb').slots.roof = { material: 'core.sandstone' };
    theme(c, 'core.desert').slots.walls.tint = 'red';
    c.materials.extra = 1;
    const p = materials.build(c).problems.join('\n');
    expect(p).toMatch(/core\.concrete\): unknown field "roughness"/);
    expect(p).toMatch(/core\.sandstone\)\.pattern: one of grid/);
    expect(p).toMatch(/core\.cobble\)\.category: one of Prototype/);
    expect(p).toMatch(/core\.sand\): base: "beige" is not a #rrggbb colour/);
    expect(p).toMatch(/core\.plaster\): accent: "#ABCDEF" is not a #rrggbb colour/);
    expect(p).toMatch(/core\.marble\): scale must be above 0/);
    expect(p).toMatch(/core\.red_brick\): shine must be 0-1/);
    expect(p).toMatch(/core\.dark_brick\): "pattern" is missing/);
    expect(p).toMatch(/core\.pbr_concrete\): a texture material has no "pattern"/);
    expect(p).toMatch(/core\.tomb\)\.slots: unknown field "roof"/);
    expect(p).toMatch(/core\.desert\): slots\.walls\.tint: "red"/);
    expect(p).toMatch(/materials\.json: unknown field "extra"/);
  });

  it('checks textures and references', () => {
    const c = clone(content);
    mat(c, 'core.pbr_concrete').texture = 'Nowhere001';
    mat(c, 'core.pbr_rock').emissive = true; // no Rock064_emission.jpg
    theme(c, 'core.factory').slots.floor.material = 'core.nothing';
    c.materials.materials.push(clone(mat(c, 'core.brass')));
    c.materials.themes.push(clone(theme(c, 'core.lab')));
    c.materials.tintSwatches.push('#ffffff');
    const p = materials.build(c).problems.join('\n');
    expect(p).toMatch(/texture Nowhere001 is not in content\/textures\.json/);
    expect(p).toMatch(/Nowhere001_color\.jpg not found/);
    expect(p).toMatch(/Rock064_emission\.jpg not found/);
    expect(p).toMatch(/core\.factory\): slots\.floor names material core\.nothing/);
    expect(p).toMatch(/core\.brass is listed twice/);
    expect(p).toMatch(/core\.lab is listed twice/);
    expect(p).toMatch(/tintSwatches\[\d+\]: #ffffff is listed twice/);
  });

  it('keeps every material and theme the maps, Style Packs and code name', () => {
    const c = clone(content);
    c.materials.materials = c.materials.materials.filter((m) => !['core.pbr_asphalt', 'core.grate', 'core.pbr_grass', 'core.orbital_panel'].includes(m.id));
    c.materials.themes = c.materials.themes.filter((t) => t.id !== 'core.medieval' && t.id !== 'core.orbital');
    const p = materials.build(c).problems.join('\n');
    expect(p).toMatch(/maps\/[a-z_]+\.json: names material core\.pbr_asphalt, which isn't in content\/materials\.json/);
    expect(p).toMatch(/editor\/operations\.ts: names material core\.grate/);
    expect(p).toMatch(/map\/terrain\.ts: names material core\.pbr_grass/);
    expect(p).toMatch(/editor\/stylePacks\.ts: names material core\.orbital_panel/);
    expect(p).toMatch(/stylePacks\.ts: names theme core\.medieval/);
    expect(p).toMatch(/maps\/[a-z_]+\.json: names theme core\.medieval/);
  });

  it('resolves a scanned texture as the plain pattern in its own colour, in the old key order', () => {
    const { out } = materials.build(content);
    const lava = out.materials.find((m) => m.def.id === 'core.pbr_lava').def;
    expect(Object.keys(lava)).toEqual(['id', 'displayName', 'category', 'pattern', 'base', 'accent', 'scale', 'shine', 'emissive', 'texture']);
    expect(lava).toMatchObject({ pattern: 'plain', accent: lava.base, texture: 'Lava004' });
  });
});
