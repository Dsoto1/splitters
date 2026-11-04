import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as surfaces from '../surface-types.mjs';
import * as materials from '../materials.mjs';

const clone = (v) => JSON.parse(JSON.stringify(v));
const ROOT = surfaces.ROOT;

describe('surface types generator (tools/content/surface-types.mjs)', () => {
  const content = surfaces.load();
  const type = (c, id) => c.surfaces.types.find((t) => t.id === id);
  const prop = (c, pack, id) => c.packs.find((p) => p.id === pack).props.find((p) => p.id === id);

  it('finds no problems and the generated file is up to date', () => {
    const { problems, out } = surfaces.build(content);
    expect(problems).toEqual([]);
    expect(surfaces.render(out)).toBe(readFileSync(join(ROOT, 'packages/shared/src/content/surfaceTypes.generated.ts'), 'utf8'));
  });

  it('gives props their own surface, else their pack\'s', () => {
    const c = clone(content);
    c.packs.find((p) => p.id === 'kenney-nature-kit').surface = 'grass';
    const props = new Map(surfaces.build(c).out.props);
    expect(props.get('prop.oak')).toBe('bark');
    expect(props.get('prop.flower_red')).toBe('grass');
  });

  it('checks the schema and every name: classes, surface types, the impacts in content/vfx.json', () => {
    const c = clone(content);
    type(c, 'bark').ballistic = 'balsa';
    type(c, 'wood').impact.sound = 'creak';
    type(c, 'metal').shiny = true;
    prop(c, 'kenney-nature-kit', 'oak').surface = 'oakwood';
    c.packs.find((p) => p.id === 'kenney-pirate-kit').surface = 'driftwood';
    c.surfaces.guess.words.slime = ['goo'];
    c.vfx.map.impacts.chrome = { sparks: 1, accent: null };
    delete c.vfx.map.impacts.sand;
    c.vfx.map.impacts.foliage.sparks = 3;
    c.vfx.map.impacts.sheet_metal.chips = 2;
    c.vfx.map.surfaces = { stone: [] };
    const p = surfaces.build(c).problems.join('\n');
    expect(p).toMatch(/\(bark\)\.ballistic: one of flesh/);
    expect(p).toMatch(/\(wood\)\.impact\.sound: one of hard/);
    expect(p).toMatch(/\(metal\): unknown field "shiny"/);
    expect(p).toMatch(/kenney-nature-kit\.json: oak: surface: surface type "oakwood" isn't/);
    expect(p).toMatch(/kenney-pirate-kit\.json: surface: surface type "driftwood" isn't/);
    expect(p).toMatch(/guess\.words: surface type "slime" isn't/);
    expect(p).toMatch(/map\.impacts\.chrome: no surface type chrome/);
    expect(p).toMatch(/map\.impacts has no drawing for surface type sand/);
    expect(p).toMatch(/map\.impacts\.foliage: draws sparks the type doesn't throw/);
    expect(p).toMatch(/map\.impacts\.sheet_metal: draws chips, splinters or leaves the type doesn't throw/);
    expect(p).toMatch(/map\.surfaces is gone/);
  });

  it('materials may name a surface type and a ballistic class, and only real ones', () => {
    const c = materials.load();
    const m = c.materials.materials.find((x) => x.id === 'core.oak_beam');
    m.surface = 'bark';
    expect(materials.build(c).problems).toEqual([]);
    expect(materials.build(c).out.materials.find((x) => x.def.id === 'core.oak_beam').def).toMatchObject({ surface: 'bark' });
    m.surface = 'teak';
    m.ballistic = 'adamantium';
    const p = materials.build(c).problems.join('\n');
    expect(p).toMatch(/core\.oak_beam\)\.surface: one of concrete/);
    expect(p).toMatch(/core\.oak_beam\)\.ballistic: one of flesh/);
  });
});
