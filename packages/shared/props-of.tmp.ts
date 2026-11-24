import { readFileSync } from 'node:fs';
import { expandSetPieces, builtInSetPieces } from './src/index.ts';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const ents = expandSetPieces(doc, builtInSetPieces()).map.entities;
const want = process.argv.slice(3);
const c: Record<string, number> = {};
for (const e of ents) if (e.kind === 'prop') c[e.model] = (c[e.model] ?? 0) + 1;
console.log('props', Object.values(c).reduce((a, b) => a + b, 0), 'models', Object.keys(c).length);
for (const e of ents as any[]) if (e.kind === 'prop' && want.some((w) => e.model.includes(w))) console.log(e.model, e.position.map((v: number) => v.toFixed(2)).join(','), (e.yaw ?? 0).toFixed(2));
if (process.env.NEAR) { const [x, y, z] = process.env.NEAR.split(',').map(Number); for (const e of ents as any[]) if (e.kind === 'prop' && Math.hypot(e.position[0] - x, e.position[2] - z) < 4 && Math.abs(e.position[1] - y) < 3.5) console.log('near', e.model, e.position.map((v: number) => v.toFixed(2)).join(','), e.tint ?? ''); }
