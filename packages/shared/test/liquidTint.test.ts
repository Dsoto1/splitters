import { describe, expect, it } from 'vitest';
import { MAP_FORMAT_VERSION, loadMap, mapLiquids, serializeMap, validateMap, type MapEntity } from '../src/index.ts';
import { codes, loaded, twoRooms } from './kit20.ts';

const pool = (extra: Partial<Extract<MapEntity, { kind: 'water' }>> = {}): MapEntity => ({ id: 'pool_1', kind: 'water', position: [0, 0, 0], size: [4, 1, 4], liquid: 'acid', ...extra });

describe('tinted liquids', () => {
  it('a liquid keeps its own colour unless tinted; the tint survives saving and loading', () => {
    const plain = loaded(twoRooms([pool()]));
    expect((plain.entities.find((e) => e.id === 'pool_1') as Extract<MapEntity, { kind: 'water' }>).tint).toBeUndefined();
    const map = loaded(twoRooms([pool({ tint: '#3a5f2a' })]));
    expect(codes(validateMap(map))).toEqual([]);
    const again = loadMap(serializeMap(map));
    expect(again.ok && (again.map.entities.find((e) => e.id === 'pool_1') as Extract<MapEntity, { kind: 'water' }>).tint).toBe('#3a5f2a');
  });

  it('colour is looks only: the liquid still behaves as its kind', () => {
    const tinted = mapLiquids(loaded(twoRooms([pool({ tint: '#3a5f2a' })])).entities);
    const plain = mapLiquids(loaded(twoRooms([pool()])).entities);
    expect(tinted).toEqual(plain);
  });

  it('tints are lowercase #rrggbb, and older maps (v19) load unchanged', () => {
    expect(loadMap(twoRooms([pool({ tint: 'green' })])).ok).toBe(false);
    const old = { ...twoRooms([pool()]), formatVersion: 19 };
    const r = loadMap(old);
    expect(r.ok).toBe(true);
    expect(r.ok && r.map.formatVersion).toBe(MAP_FORMAT_VERSION);
    expect(r.ok && r.migratedFrom).toBe(19);
  });
});
