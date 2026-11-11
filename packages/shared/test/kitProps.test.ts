// Kit props (docs/PROCEDURAL_ENVIRONMENT.md §11 Phase 6; content/kitProps.ts): the generated families are catalogue
// props whose collision is their box, their variants only change what is drawn, and the load-time aliases give a
// retired prop's placements the family without changing anything gameplay sees: collision boxes, breakable health,
// ballistic class, footing and paths. Every official map that places a retired prop plays with the same prop
// collision as before.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CORE_PROPS,
  KIT_ALIASES,
  KIT_FAMILIES,
  KIT_PROPS,
  aliasedProp,
  breakableOf,
  builtInSetPieces,
  coreCatalog,
  expandSetPieces,
  getKitFamily,
  getProp,
  isKitModel,
  kitModelFile,
  loadMap,
  propAlias,
  propBoxes,
  propSurface,
  withGroundAsPlayed,
  withPropAliases,
  withTileAliases,
  type MapDocument,
  type PropEntity,
} from '../src/index.ts';
import { propMaterial } from '../src/sim/gunplay.ts';

const MAPS = new URL('../../../maps/', import.meta.url);
const mapIds = readdirSync(MAPS).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();
const prop = (over: Partial<PropEntity> = {}): PropEntity => ({ kind: 'prop', id: 'p1', name: '', position: [1, 0, 2], yaw: 0.5, scale: 1, solid: true, tint: null, model: 'prop.crate_small', ...over }) as PropEntity;

describe('kit families', () => {
  it('are catalogue props, found by getProp, each colliding as its box', () => {
    expect(KIT_PROPS.length).toBe(KIT_FAMILIES.length);
    for (const p of KIT_PROPS) {
      expect(isKitModel(p.id), p.id).toBe(true);
      expect(CORE_PROPS).toContain(p);
      expect(getProp(p.id)).toBe(p);
      // Every variant fills the family's bounds (tools/content/kitprops.mjs checks the models): the box is the shape,
      // or, for a piece you can see through (a rail fence, railings, a wall fallen away), its own finer boxes inside it.
      expect(p.collision).toEqual(p.size);
      for (const b of p.boxes ?? []) for (let k = 0; k < 3; k++) expect(b[k + 3]!, p.id).toBeGreaterThan(b[k]!);
      expect(getKitFamily(p.id)?.variants[0]?.file).toBe(p.file);
    }
  });

  it('draw their variant\'s own file, and the first for a variant they lack', () => {
    for (const f of KIT_FAMILIES) {
      expect(new Set(f.variants.map((v) => v.file)).size, f.id).toBe(f.variants.length);
      for (const v of f.variants) expect(kitModelFile(f.id, v.index)).toBe(v.file);
      expect(kitModelFile(f.id, 250)).toBe(f.variants[0]!.file);
      expect(kitModelFile(f.id)).toBe(f.variants[0]!.file);
      // Lighter levels of detail further away.
      for (let i = 1; i < f.lods.length; i++) {
        expect(f.lods[i]!, f.id).toBeGreaterThan(f.lods[i - 1]!);
        expect(f.triangles[i]!, f.id).toBeLessThan(f.triangles[i - 1]!);
      }
    }
    expect(kitModelFile('prop.crate_small', 1)).toBeUndefined();
  });

  it('collide the same whatever their variant (gameplay never reads it)', () => {
    const map = { entities: [0, 1, 2, 3].map((v) => prop({ id: `p${v}`, model: 'kit.crate.wood', variant: v || undefined, position: [0, 0, 0] })) } as unknown as MapDocument;
    const boxes = propBoxes(map, true).map(({ sourceId: _, ...b }) => b);
    expect(boxes.length).toBe(4);
    for (const b of boxes) expect(b).toEqual(boxes[0]);
  });
});

/** Retired props whose family is another ballistic class on purpose (owner, 2026-11-10: the iron fences are iron), and the class it has. */
const REMATERIALLED = new Map<string, string>([
  ['prop.iron_fence', 'thin_metal'], ['prop.iron_fence_damaged', 'thin_metal'],
  // Wooden furniture that played as concrete by an accident of its name (owner, 2026-11-11: make it wood; the bin thin metal).
  ['prop.desk', 'wood'], ['prop.bench', 'wood'], ['prop.bookcase', 'wood'], ['prop.bookcase_wide', 'wood'],
  ['prop.stall', 'wood'], ['prop.stall_green', 'wood'], ['prop.stall_bench', 'wood'], ['prop.trashcan', 'thin_metal'],
  // Part 5, by the same rule: the sofa (concrete by the guess) is upholstery over a wooden frame, like the armchair
  // (wood already); the cabinets (thin metal, by the word "cabinet") are wooden; the white goods (concrete) are sheet steel.
  ['prop.sofa', 'wood'], ['prop.kitchen_cabinet', 'wood'], ['prop.tv_cabinet', 'wood'],
  ['prop.fridge', 'thin_metal'], ['prop.stove', 'thin_metal'], ['prop.washer', 'thin_metal'],
]);

describe('kit aliases', () => {
  it('name catalogue props, families and variants that exist', () => {
    expect(KIT_ALIASES.length).toBeGreaterThan(0);
    for (const a of KIT_ALIASES) {
      expect(getProp(a.from), a.from).toBeDefined();
      expect(isKitModel(a.from)).toBe(false);
      const f = getKitFamily(a.model);
      expect(f, a.model).toBeDefined();
      expect(f!.variants.some((v) => v.index === a.variant)).toBe(true);
      expect(propAlias(a.from)).toBe(a);
    }
    expect(propAlias('prop.sandbag_wall')).toBeUndefined();
  });

  it('keep what gameplay sees: size, collision, breakable health, debris, ballistic class and category of play', () => {
    for (const a of KIT_ALIASES) {
      const was = getProp(a.from)!;
      const now = getProp(a.model)!;
      expect(now.size.map((v) => v * a.scale), a.from).toEqual(was.size);
      expect(now.collision!.map((v) => v * a.scale), a.from).toEqual(was.collision);
      // A piece that collided as finer boxes (a fence's posts and rails) is replaced by a family with its own finer
      // boxes (owner, 2026-11-10: kit pieces collide as their own posts and rails; the gaps differ a little from the
      // Kenney ones'), inside the same bounds; a piece that was one box stays one box.
      expect(!!now.boxes, `${a.from}: one box stays one box, finer boxes stay finer`).toBe(!!was.boxes);
      for (const b of now.boxes ?? []) for (let k = 0; k < 3; k++) {
        const half = k === 1 ? now.size[1] : now.size[k]! / 2;
        expect(b[k]!, a.model).toBeGreaterThanOrEqual(k === 1 ? 0 : -half - 0.001);
        expect(b[k + 3]!, a.model).toBeLessThanOrEqual(half + 0.001);
      }
      expect(now.breakable?.health, a.from).toBe(was.breakable?.health);
      expect(now.breakable?.blast, a.from).toBe(was.breakable?.blast);
      expect(now.breakable?.debris, a.from).toBe(was.breakable?.debris);
      expect(now.conceals, a.from).toBe(was.conceals);
      // What rounds do (gunplay's ballistic class); the impact's sound family too.
      // (The Kenney iron fences played as thin wood, by their name; ours are thin metal: REMATERIALLED.)
      if (!REMATERIALLED.has(a.from)) expect(propMaterial(a.model), a.from).toBe(propMaterial(a.from));
      else expect(propMaterial(a.model), a.from).toBe(REMATERIALLED.get(a.from));
      expect(propSurface(a.model), a.from).toBeDefined();
    }
  });

  it('give a placement the family and variant, keeping its id, place, facing, scale, solid flag and tint', () => {
    for (const a of KIT_ALIASES) {
      const e = prop({ model: a.from, scale: 1.3, tint: '#aabbcc', solid: false });
      const out = aliasedProp(e);
      expect(out).toEqual({ ...e, model: a.model, variant: a.variant, scale: Math.round(1.3 * a.scale * 1e4) / 1e4 });
      // Breakable data: the same box and health as the retired prop's.
      const before = breakableOf({ ...e, solid: true });
      const after = breakableOf({ ...out, solid: true });
      // (Its parts are the family's own finer boxes when the retired prop had finer ones.)
      const whole = <T>(b: T): T => (getProp(a.from)!.boxes && b ? ({ ...b, parts: undefined } as T) : b);
      expect(whole(after)).toEqual(whole(before));
    }
    const other = prop({ model: 'prop.sandbag_wall' });
    expect(aliasedProp(other)).toBe(other);
    const doc = { entities: [other] } as unknown as MapDocument;
    expect(withPropAliases(doc)).toBe(doc);
  });

  it('upgrade a map as played; MapMaker opens it as made', () => {
    // An older file: the official maps name the kit families themselves since MapMaker's Replace all (2026-11-10), so
    // Bunker Cross's are put back to the retired props they were made with.
    const back = new Map(KIT_ALIASES.map((a) => [a.model, a.from]));
    const doc = JSON.parse(readFileSync(new URL('bunker_cross.json', MAPS), 'utf8')) as { entities: { kind: string; model?: string }[] };
    for (const e of doc.entities) if (e.kind === 'prop' && e.model && back.has(e.model)) e.model = back.get(e.model)!;
    const json = JSON.stringify(doc);
    const made = loadMap(json, coreCatalog, { forEditing: true });
    const played = loadMap(json);
    expect(made.ok && played.ok).toBe(true);
    if (!made.ok || !played.ok) return;
    const retired = made.map.entities.filter((e) => e.kind === 'prop' && propAlias(e.model));
    expect(retired.length).toBeGreaterThan(0);
    for (const e of retired) {
      const p = played.map.entities.find((x) => x.id === e.id) as PropEntity | undefined;
      expect(p?.model, e.id).toBe(propAlias((e as PropEntity).model)!.model);
    }
    expect(played.map.entities.some((e) => e.kind === 'prop' && propAlias(e.model))).toBe(false);
  });

  // The whole suite: as played, every map's prop collision (static and breakable boxes, footing) is what it was with
  // the retired props. Maps that never placed one are untouched.
  it.each(mapIds)('leave %s\'s prop collision as it was', (id) => {
    const made = loadMap(readFileSync(new URL(`${id}.json`, MAPS), 'utf8'), coreCatalog, { forEditing: true, openWithErrors: true });
    if (!made.ok) return;
    const library = builtInSetPieces();
    const expanded = expandSetPieces(withTileAliases(made.map), library, coreCatalog).map;
    if (!expanded.entities.some((e) => e.kind === 'prop' && propAlias(e.model))) return;
    const before = withGroundAsPlayed(expanded, coreCatalog);
    const after = withGroundAsPlayed(withPropAliases(expanded), coreCatalog);
    const strip = (m: MapDocument) => m.entities.map((e) => (e.kind === 'prop' ? { id: e.id, position: e.position, yaw: e.yaw } : { id: e.id }));
    expect(strip(after)).toEqual(strip(before));
    // (Placements of a prop that collided as finer boxes take the family's own, inside the same bounds: left out here.)
    const reshaped = new Set(expanded.entities.filter((e) => e.kind === 'prop' && getProp(e.model)?.boxes && propAlias(e.model)).map((e) => e.id));
    const same = (boxes: ReturnType<typeof propBoxes>) => boxes.filter((b) => !reshaped.has(b.sourceId));
    expect(same(propBoxes(after))).toEqual(same(propBoxes(before)));
    expect(same(propBoxes(after, true))).toEqual(same(propBoxes(before, true)));
    // (A reshaped placement that collided still does; one placed as decoration, not solid, still doesn't.)
    const count = (m: MapDocument, id: string) => propBoxes(m).filter((b) => b.sourceId === id).length + propBoxes(m, true).filter((b) => b.sourceId === id).length;
    for (const id of reshaped) expect(count(after, id) > 0, id).toBe(count(before, id) > 0);
  });
});
