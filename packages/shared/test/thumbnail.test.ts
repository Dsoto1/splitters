import { describe, expect, it } from 'vitest';
import { MAP_FORMAT_VERSION, MAX_THUMBNAIL_CHARS, loadMap, serializeMap } from '../src/index.ts';
import { loadArena } from './helpers.ts';

const JPEG = `data:image/jpeg;base64,${'/9j/4AAQSkZJRgABAQ'.repeat(40)}`;
const WEBP = `data:image/webp;base64,${'UklGRiQAAABXRUJQVlA4'.repeat(40)}`;
const CAMERA = { position: [4, 9, -12] as [number, number, number], target: [0, 1, 0] as [number, number, number] };

describe('map pictures (format v22)', () => {
  it('a captured picture and its camera ride along with the map and survive saving and loading', () => {
    for (const thumbnail of [JPEG, WEBP]) {
      const arena = loadArena();
      const again = loadMap(serializeMap({ ...arena, metadata: { ...arena.metadata, thumbnail, thumbnailCamera: CAMERA } }));
      expect(again.ok && again.map.metadata.thumbnail).toBe(thumbnail);
      expect(again.ok && again.map.metadata.thumbnailCamera).toEqual(CAMERA);
    }
  });

  it('maps without one load as before (automatic picture)', () => {
    const r = loadMap(loadArena());
    expect(r.ok && r.map.metadata.thumbnail).toBeUndefined();
    expect(r.ok && r.map.metadata.thumbnailCamera).toBeUndefined();
  });

  it('only small JPEG/WebP data URLs: no links, other formats or oversized pictures', () => {
    const arena = loadArena();
    for (const bad of ['https://example.com/pic.jpg', 'data:image/png;base64,iVBORw0KGgo=', 'data:image/svg+xml;base64,PHN2Zz4=', `data:image/jpeg;base64,${'A'.repeat(MAX_THUMBNAIL_CHARS)}`, 'data:image/jpeg;base64,<script>']) {
      expect(loadMap({ ...arena, metadata: { ...arena.metadata, thumbnail: bad } }).ok).toBe(false);
    }
    expect(loadMap({ ...arena, metadata: { ...arena.metadata, thumbnailCamera: { position: [0, 1, Infinity], target: [0, 0, 0] } } }).ok).toBe(false);
  });

  it('v21 maps migrate to the current version unchanged', () => {
    const r = loadMap({ ...loadArena(), formatVersion: 21 });
    expect(r.ok).toBe(true);
    expect(r.ok && r.map.formatVersion).toBe(MAP_FORMAT_VERSION);
    expect(r.ok && r.migratedFrom).toBe(21);
    expect(r.ok && r.map.metadata.thumbnail).toBeUndefined();
  });
});
