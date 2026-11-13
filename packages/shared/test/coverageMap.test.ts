// The coverage map (maps/test_coverage.json, made in MapMaker) holds at least one of everything there is: every core
// kit tile, a tile of every style pack, every wall style and both glass kinds, a prop of every prop pack, a pickup of
// every kind, every vehicle and turret, every MapMaker scenario piece (doors, logic, movers, traps, liquids, lights,
// NPC squads and spawners, portals, ladders, ziplines, air drops), every entity kind, the markers of every game mode,
// terrain, roads, a race track, an AI route, a logic rule and every shipped set piece. New content fails this test
// until it is added to the map (in MapMaker: open maps/test_coverage.json, place it, save, export over the file). The
// browser flows that only need "a map with everything" (e2e coverage flow) use it; it is a test map
// (metadata.testOnly): no list offers it.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CORE_ITEMS, EDGE_STYLES, GLASS_KINDS, MOUNT_MODELS, MapEntity, STYLE_PACKS, builtInSetPieces, coreCatalog, loadMap, playableModes, propAlias, raceTrack, type MapDocument } from '../src/index.ts';
import { KIT_TILES } from '../src/content/kitTiles.generated.ts';
import { SCENARIO_PALETTE, newScenarioEntities } from '../src/editor/operations.ts';

const ROOT = new URL('../../../', import.meta.url);
const raw = JSON.parse(readFileSync(new URL('maps/test_coverage.json', ROOT), 'utf8'));
const loaded = loadMap(raw);
const map = (loaded.ok ? loaded.map : raw) as MapDocument;
const tiles = new Set(map.classicStructure.tiles.map((t) => t.tile));
const missing = (want: readonly string[], have: ReadonlySet<string>) => want.filter((w) => !have.has(w));

/** What tells one scenario piece from another: its kind and its own string fields (not ids, which are random, or labels, numbered as placed: bomb site B, Breakthrough's A1, A2…). */
const signature = (e: Record<string, unknown>): string => {
  const o: Record<string, unknown> = { kind: e.kind };
  for (const [k, v] of Object.entries(e)) if (k !== 'id' && k !== 'label' && typeof v === 'string' && !/^[a-z]+_[a-z0-9]{8,}$/.test(v)) o[k] = v;
  return JSON.stringify(o, Object.keys(o).sort());
};
const signatures = new Set(map.entities.map((e) => signature(e as unknown as Record<string, unknown>)));

describe('the coverage map', () => {
  it('loads with no errors, as a test map', () => {
    expect(loaded.ok, loaded.issues.map((i) => i.message).join('; ')).toBe(true);
    expect(loaded.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(map.metadata.id).toBe('test_coverage');
    expect(map.metadata.testOnly).toBe(true);
  });

  it('has every core kit tile, and a tile of every style pack', () => {
    // (A tunnel shape in another material family is the same tile with a `family`: each family is on the map by one
    // piece drawn in it.)
    const twin = (id: string) => { const f = coreCatalog.get(id)?.familyOf; return !!f && f.base !== id; };
    expect(missing(KIT_TILES.map((t) => t.id).filter((id) => !twin(id)), tiles)).toEqual([]);
    const families = new Set(map.classicStructure.tiles.map((t) => coreCatalog.drawn(t)?.familyOf?.family).filter(Boolean));
    expect(missing([...new Set(coreCatalog.all().flatMap((d) => (d.familyOf ? [d.familyOf.family] : [])))], families as Set<string>)).toEqual([]);
    const kit = new Set(KIT_TILES.map((t) => t.id));
    const packsWithout = STYLE_PACKS.filter((p) => p.tiles.some((t) => !kit.has(t) && coreCatalog.get(t)) && !p.tiles.some((t) => !kit.has(t) && tiles.has(t)));
    expect(packsWithout.map((p) => p.id)).toEqual([]);
  });

  it('has every wall style and both kinds of window glass', () => {
    const edges = new Set(map.classicStructure.tiles.flatMap((t) => Object.values(t.edges ?? {})));
    expect(missing(EDGE_STYLES.filter((s) => s !== 'auto'), edges)).toEqual([]);
    const glass = new Set([...map.classicStructure.tiles.flatMap((t) => Object.values(t.glass ?? {})), ...map.entities.flatMap((e) => ('glass' in e && typeof e.glass === 'string' ? [e.glass] : []))]);
    expect(missing(GLASS_KINDS, glass)).toEqual([]);
  });

  it('has a prop of every prop pack', () => {
    const models = new Set(map.entities.flatMap((e) => (e.kind === 'prop' ? [e.model] : [])));
    const dir = new URL('content/props/', ROOT);
    const without = readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      // (The map is read as played: a retired prop on it is the kit family that took its place. A pack whose props are
      // all retired, the mini-market's since kit props part 9, is on the map by one of those families.)
      .filter((f) => !(JSON.parse(readFileSync(new URL(f, dir), 'utf8')).props as { id: string }[]).some((p) => models.has(`prop.${p.id}`) || models.has(propAlias(`prop.${p.id}`)?.model ?? '')));
    expect(without).toEqual([]);
  });

  it('has a pickup of every kind, and every vehicle and turret', () => {
    const items = new Set(map.entities.flatMap((e) => (e.kind === 'pickup' ? [e.item] : [])));
    const kinds = new Set(CORE_ITEMS.filter((i) => items.has(i.id)).map((i) => i.effect.kind));
    expect(missing([...new Set(CORE_ITEMS.map((i) => i.effect.kind))], kinds)).toEqual([]);
    const mounts = new Set(map.entities.flatMap((e) => (e.kind === 'mount' ? [e.model] : [])));
    expect(missing(MOUNT_MODELS, mounts)).toEqual([]);
  });

  it('has every entity kind and every MapMaker scenario piece', () => {
    const kinds = MapEntity.options.map((o) => o.shape.kind.value as string);
    expect(missing(kinds, new Set(map.entities.map((e) => e.kind)))).toEqual([]);
    const pieces = SCENARIO_PALETTE.map((p) => p.key).filter((key) => !newScenarioEntities(key, [0, 0, 0], 0).some((e) => signatures.has(signature(e as unknown as Record<string, unknown>))));
    expect(pieces).toEqual([]);
  });

  it('has one of every shipped set piece (placed in MapMaker), each expanding into its parts as played', () => {
    const placements = (raw.setPieces ?? []) as { id: string; piece: string }[];
    const placed = new Set(placements.map((p) => p.piece));
    expect(missing([...builtInSetPieces().pieces.keys()], placed)).toEqual([]);
    // As played (loadMap) the placements are their parts: no set pieces left, every placement's parts in the map.
    expect(map.setPieces).toBeUndefined();
    const parts = new Set([...map.classicStructure.tiles, ...map.entities].map((x) => x.id.replace(/_\d+$/, '')));
    expect(placements.filter((p) => !parts.has(`sp_${p.id}`)).map((p) => p.piece)).toEqual([]);
  });

  it('has the markers of every game mode, terrain, roads, a track (NPC traffic), an AI route and logic', () => {
    expect(new Set(map.entities.flatMap((e) => (e.kind === 'flag' ? [e.team] : []))).size).toBeGreaterThanOrEqual(2);
    expect(playableModes(map)).toEqual(expect.arrayContaining(['core.ctf', 'core.forts', 'core.koth', 'core.bomb', 'core.hostage', 'core.breakthrough', 'core.zombies']));
    expect(raceTrack(map)).not.toBeNull();
    const uses = new Set((map.paths ?? []).flatMap((p) => p.uses));
    expect(missing(['road', 'race', 'route'], uses)).toEqual([]);
    expect(map.terrain).toBeTruthy();
    expect(map.logic.rules.length).toBeGreaterThan(0);
    expect(map.entities.filter((e) => e.kind === 'spawn').length).toBeGreaterThanOrEqual(map.metadata.recommendedPlayers.max);
  });
});
