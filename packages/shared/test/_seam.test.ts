import { it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildMapDecor, buildMapGeometry, loadMap } from '../src/index.ts';
it('seams', () => {
  const r = loadMap(JSON.parse(readFileSync(new URL('../../../maps/twin_spires.json', import.meta.url), 'utf8')));
  if (!r.ok) throw new Error('map');
  const geo = buildMapGeometry(r.map).map((b) => ({ ...b, src: 'geo' }));
  const dec = buildMapDecor(r.map).map((b) => ({ ...b, src: 'decor' }));
  const boxes = [...geo, ...dec].filter((b) => !b.yaw);
  let n = 0;
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i]!, b = boxes[j]!;
    const ox = Math.min(a.max[0], b.max[0]) - Math.max(a.min[0], b.min[0]);
    const oz = Math.min(a.max[2], b.max[2]) - Math.max(a.min[2], b.min[2]);
    if (ox <= 0.02 || oz <= 0.02) continue;
    const dy = Math.abs(a.max[1] - b.max[1]);
    if (dy < 0.02 && a.kind !== b.kind || (dy < 0.02 && (a.src !== b.src))) {
      if (n++ < 30) process.stdout.write(`ZF ${a.src}:${a.kind}:${a.sourceId} vs ${b.src}:${b.kind}:${b.sourceId} top ${a.max[1].toFixed(3)}/${b.max[1].toFixed(3)} overlap ${ox.toFixed(2)}x${oz.toFixed(2)} at x ${Math.max(a.min[0], b.min[0]).toFixed(1)} z ${Math.max(a.min[2], b.min[2]).toFixed(1)}\n`);
    }
  }
  process.stdout.write(`ZFTOTAL ${n}\n`);
});
