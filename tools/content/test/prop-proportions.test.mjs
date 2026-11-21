// Each catalogue prop's listed height fits what its model is (owner, 2026-11-16: the Quaternius "Wall Shelf" was the
// pack's narrow standing shelf unit listed at 0.4 m, a tiny bookcase stuck on the wall, on 14 maps). Two checks:
// - shape by name: a wall shelf is wider than it is tall; a bookcase or shelf unit stands 1.2-3.2 m;
// - scale within its pack: furniture from a pack whose source models are kept (assets-src/<pack>/*.glb) is scaled
//   (listed height / the model's own height) within 2.5x of the pack's middle scale, since a pack's pieces are made
//   to one scale; a piece far off it is listed as something it is not. Props retired by a kit alias are skipped
//   (they are played as their family).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { loadPropManifest } from '../props-manifest.mjs';
import { isFurniture } from '../furniture.mjs';
import { ROOT, sizesOf } from '../kitprops.mjs';

const retired = new Set(Object.keys(JSON.parse(readFileSync(join(ROOT, 'content/kitprops.json'), 'utf8')).aliases));
const live = loadPropManifest().props.filter((p) => !retired.has(`prop.${p.id}`));
const sizes = sizesOf(ROOT);

/** Shapes a prop's name promises: [pattern on id and name, check on the built size [w, h, d], what it means]. */
const SHAPES = [
  [/wall.?shelf/, ([w, h, d]) => Math.max(w, d) >= h, 'a wall shelf is wider than it is tall'],
  [/bookcase|bookshelf|shelf.?unit|large.?shelf|shelf_large/, ([w, h]) => h >= 1.2 && h <= 3.2 && w >= 0.3, 'a bookcase or shelf unit stands 1.2-3.2 m (a library case up to 3), at least 0.3 m wide'],
];

/** Pieces far off their pack's scale on purpose: id -> why. */
const OFF_SCALE = {
  // A grand chandelier for halls, 1 m tall and 1.6 m across: the pack's own is a small ceiling light.
  hm_chandelier: 'a hall chandelier, made bigger than the pack\'s on purpose',
};

describe('catalogue props: listed heights fit their models', () => {
  it('match the shape their name promises', () => {
    const bad = [];
    for (const p of live) {
      const s = sizes.get(`prop.${p.id}`);
      if (!s) continue;
      const key = `${p.id} ${(p.name ?? '').toLowerCase()}`;
      for (const [re, ok, says] of SHAPES) if (re.test(key) && !ok(s)) bad.push(`${p.id} (${p.name}): ${s.join(' x ')} m, but ${says}`);
    }
    expect(bad).toEqual([]);
  });

  it('keep furniture within 2.5x of its pack\'s scale', async () => {
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    const byPack = new Map();
    for (const p of live) {
      if (typeof p.src !== 'string' || !/\.glb$/i.test(p.src) || !(p.height > 0)) continue;
      const file = join(ROOT, 'assets-src', p.pack, p.src);
      if (!existsSync(file)) continue;
      const doc = await io.read(file);
      const b = getBounds(doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0]);
      const h = b.max[1] - b.min[1];
      if (!(h > 0.01)) continue;
      if (!byPack.has(p.pack)) byPack.set(p.pack, []);
      byPack.get(p.pack).push({ p, scale: p.height / h });
    }
    const bad = [];
    for (const [pack, list] of byPack) {
      const sorted = list.map((x) => x.scale).sort((a, b) => a - b);
      const middle = sorted[Math.floor(sorted.length / 2)];
      for (const { p, scale } of list) {
        if (!isFurniture(p) || OFF_SCALE[p.id]) continue;
        const r = scale / middle;
        if (r < 1 / 2.5 || r > 2.5) bad.push(`${pack} ${p.id} (${p.name}, ${p.height} m): ${r.toFixed(2)}x the pack's scale`);
      }
    }
    expect(bad).toEqual([]);
  }, 60_000);
});
