import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { describe, expect, it } from 'vitest';

/** Every vertex of a built model (they are baked: the content build leaves no node transforms that turn it). */
async function vertices(path: string): Promise<[number, number, number][]> {
  const doc = await new NodeIO().readBinary(new Uint8Array(readFileSync(fileURLToPath(new URL(`../public/models/${path}`, import.meta.url)))));
  const out: [number, number, number][] = [];
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const p of mesh.listPrimitives()) {
      const a = p.getAttribute('POSITION')!.getArray()!;
      for (let i = 0; i < a.length; i += 3) out.push([a[i]!, a[i + 1]!, a[i + 2]!]);
    }
  }
  return out;
}

describe('vehicle models face +Z (the way the sim drives them)', () => {
  it('the hover bike: narrow nose at +Z, wings and twin exhausts at -Z', async () => {
    const v = await vertices('vehicles/hover_bike.glb');
    const width = (front: boolean) => {
      const xs = v.filter((p) => (front ? p[2] > 0.5 : p[2] < -0.5)).map((p) => p[0]);
      return Math.max(...xs) - Math.min(...xs);
    };
    expect(width(false)).toBeGreaterThan(width(true) * 1.5);
  });
});
