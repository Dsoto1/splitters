import { beforeAll, describe, expect, it } from 'vitest';
import {
  MAP_FORMAT_VERSION,
  MAP_MAX_ENTITIES,
  MapDocument as MapSchema,
  RESOURCE_BUDGETS,
  SET_PIECE_PLAYED_MAX,
  SNAPSHOT_INTERVAL_TICKS,
  SnapshotDecoder,
  SnapshotStream,
  encodeSnapshots,
  initPhysics,
  loadMap,
  migrateMapDocument,
  rulesForMode,
  serializeMap,
  utf8Length,
  validateMap,
  type GameEvent,
  type MapDocument,
  type ServerMessage,
} from '../src/index.ts';
import { Match, initNavigation } from '../src/match.ts';
import { Unzipper, Zipper } from '../src/net/peerZip.ts';
import { entityCapMap } from './entityCapMap.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

// Map format v48 (owner, 2026-11-18): a map holds up to 8,192 entities (4,096 before). docs/MAP_BUDGETS.md, "Entity cap".
describe('the entity cap: 8,192 a map', () => {
  it('is one number: the schema, the load budget and the map as played', () => {
    expect(MAP_FORMAT_VERSION).toBeGreaterThanOrEqual(48);
    expect(MAP_MAX_ENTITIES).toBe(8192);
    expect(RESOURCE_BUDGETS.entities).toBe(MAP_MAX_ENTITIES);
    expect(SET_PIECE_PLAYED_MAX.entities).toBe(MAP_MAX_ENTITIES);
    // The tile cap is its own limit, unchanged.
    expect(SET_PIECE_PLAYED_MAX.tiles).toBe(4096);
  });

  it('an 8,192-entity map validates and loads; 8,193 is refused', () => {
    const map = entityCapMap(8192);
    expect(map.entities).toHaveLength(8192);
    const r = loadMap(JSON.stringify(map));
    if (!r.ok) throw new Error(JSON.stringify(r.issues.slice(0, 3)));
    expect(validateMap(r.map).filter((i) => i.severity === 'error')).toEqual([]);
    const over = entityCapMap(8193);
    expect(MapSchema.safeParse(over).success).toBe(false);
    const refused = loadMap(JSON.stringify(over));
    expect(refused.ok).toBe(false);
    expect(refused.issues.some((i) => i.severity === 'error' && /entities/.test(i.message))).toBe(true);
  });

  it('a v47 map migrates to v48 as it is', () => {
    const v47 = { ...entityCapMap(64), formatVersion: 47 };
    const { doc } = migrateMapDocument(JSON.parse(JSON.stringify(v47)));
    expect(doc).toEqual({ ...JSON.parse(JSON.stringify(v47)), formatVersion: MAP_FORMAT_VERSION });
  });

  it('measures the map against the 3 MiB raw JSON cap (docs/MAP_BUDGETS.md)', () => {
    expect(RESOURCE_BUDGETS.mapBytes).toBe(3 * 1024 * 1024);
    const map = entityCapMap(8192);
    const compact = utf8Length(JSON.stringify(map));
    const file = utf8Length(serializeMap(map));
    // As played (a joining player's welcome, set pieces' parts) the map is compact JSON: ~155 bytes an entity here.
    expect(compact).toBeLessThan(RESOURCE_BUDGETS.mapBytes * 0.7);
    // MapMaker's file is indented (~290 bytes an entity, a number array over several lines): at 2 MiB an 8,192-entity
    // file of hand-placed things was over the cap; at 3 MiB it fits (owner, 2026-11-22). If this changes, update
    // MAP_BUDGETS.md's "Entity cap".
    expect(file).toBeGreaterThan(2 * 1024 * 1024);
    expect(file).toBeLessThan(RESOURCE_BUDGETS.mapBytes);
  });

  it('a map file near the 3 MiB cap loads and goes through a welcome (docs/MAP_BUDGETS.md, "Join time at 3 MiB")', () => {
    // The lean 8,192 mix with every ID at its longest (64 characters): MapMaker's file just under the cap.
    const base = entityCapMap(8192, 'entity_cap_near_3mib');
    const map: MapDocument = { ...base, entities: base.entities.map((e, i) => ({ ...e, id: `${e.kind}_${i}_`.padEnd(64, 'x') }) as MapDocument['entities'][number]) };
    const file = serializeMap(map);
    expect(utf8Length(file)).toBeGreaterThan(2.5 * 1024 * 1024);
    expect(utf8Length(file)).toBeLessThan(RESOURCE_BUDGETS.mapBytes);
    const t0 = performance.now();
    const loaded = loadMap(file);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const match = new Match(loaded.map, { ...rulesForMode(loaded.map, 'core.deathmatch'), scoreLimit: 0, timeLimitSeconds: 0 }, 7);
    const t1 = performance.now();
    const welcome = JSON.stringify({ t: 'welcome', map: match.map, sc: match.scenario.fullState() });
    // The welcome fits what a joiner will inflate (peerZip's MAX_INFLATED_MESSAGE, 6 MiB).
    expect(utf8Length(welcome)).toBeLessThan(6 * 1024 * 1024);
    const zip = new Zipper();
    const unzip = new Unzipper();
    let text: string | null = null;
    let sent = 0;
    for (const piece of zip.pieces(welcome)) {
      sent += piece.byteLength;
      text = unzip.piece(piece) ?? text;
    }
    const again = loadMap((JSON.parse(text!) as { map: unknown }).map);
    const t2 = performance.now();
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.map.entities).toHaveLength(8192);
    if (process.env.MAP_JOIN_TIMES) console.log(`file ${(utf8Length(file) / 1048576).toFixed(2)} MiB, welcome ${(utf8Length(welcome) / 1048576).toFixed(2)} MiB, sent ${(sent / 1024).toFixed(0)} KiB; host load + match ${(t1 - t0).toFixed(0)} ms, welcome + joiner load ${(t2 - t1).toFixed(0)} ms`);
  });

  it('a match on it: the welcome carries the map, snapshots name its last entities', () => {
    const map: MapDocument = entityCapMap(8192);
    // The doors are the map's last entities: the very last one stands open.
    const lastDoor = map.entities.length - 1;
    expect(map.entities[lastDoor]!.kind).toBe('door');
    map.entities[lastDoor] = { ...map.entities[lastDoor]!, startOpen: true } as MapDocument['entities'][number];
    const match = new Match(map, { ...rulesForMode(map, 'core.deathmatch'), scoreLimit: 0, timeLimitSeconds: 0 }, 7);
    const slot = match.addHuman('host')!.slot;
    let pending: GameEvent[] = [];
    for (let i = 0; i < SNAPSHOT_INTERVAL_TICKS * 3; i++) pending.push(...match.step());
    // The welcome, as a browser host sends it: compressed, in pieces, read back and loaded again on the joiner's side.
    const welcome = JSON.stringify({ t: 'welcome', map: match.map, sc: match.scenario.fullState() });
    const zip = new Zipper();
    const unzip = new Unzipper();
    let text: string | null = null;
    for (const piece of zip.pieces(welcome)) text = unzip.piece(piece) ?? text;
    const got = JSON.parse(text!) as { map: unknown; sc: { es: [number, number, number][] } };
    const again = loadMap(got.map);
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.map.entities).toHaveLength(8192);
    const doors = got.sc.es.filter(([i]) => i >= 8192 - 32);
    expect(doors).toHaveLength(32);
    expect(Math.max(...got.sc.es.map(([i]) => i))).toBe(lastDoor);
    // The snapshot stream: the last door's state, by its index, through encode and decode.
    const decoder = new SnapshotDecoder();
    const stream = new SnapshotStream();
    let seen: [number, number, number] | undefined;
    for (let i = 0; i < SNAPSHOT_INTERVAL_TICKS * 2; i++) {
      pending.push(...match.step());
      if (match.tick % SNAPSHOT_INTERVAL_TICKS) continue;
      const body = match.snapshot(pending);
      pending = [];
      const [t] = encodeSnapshots(body, [{ slot, ack: 0, me: match.privateState(slot), stream }]);
      const msg = decoder.snapshot(JSON.parse(t!) as Extract<ServerMessage, { t: 'snapshot' }>);
      seen = msg.sc?.es?.find(([i]) => i === lastDoor) ?? seen;
    }
    expect(seen?.[0]).toBe(lastDoor);
    expect(seen?.[1]).toBeGreaterThan(0);
    match.destroy();
  }, 120_000);
});
