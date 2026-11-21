// Shipped maps look the same (docs/MAPMAKER_PAINTING_PLAN.md, "How we prove shipped maps look the same"): every map in
// maps/ and maps/templates/, loaded as played with today's code, hashes as fixtures/paintLooks.json says (written by
// tools/maps/paint-looks.ts before the painting plan's Phase 4 changed how the ground is stored, on the code before it).
// A change to migration, resolveSurface, set-piece expansion or how the ground draws that alters a map's look fails here,
// naming the map. A deliberate change to a map's look regenerates the fixture and says why in its commit.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FIXTURE, shippedLooks } from '../../../tools/maps/paint-looks.ts';

describe('shipped maps look the same', () => {
  const want = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Record<string, unknown>;
  const got = shippedLooks();
  it('covers every shipped map', () => {
    expect(Object.keys(got).sort()).toEqual(Object.keys(want).sort());
  });
  for (const file of Object.keys(want)) {
    it(file, () => {
      expect(got[file], file).toEqual(want[file]);
    });
  }
});
