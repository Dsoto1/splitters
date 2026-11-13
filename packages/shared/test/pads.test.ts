import { readdirSync, readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { initPhysics, loadMap, type MapDocument } from '../src/index.ts';
import { PAD_MISS_HEIGHT_M, PAD_MISS_M, flyPads, initNavigation, padFlightIssues } from '../src/match.ts';

beforeAll(async () => {
  await Promise.all([initPhysics(), initNavigation()]);
});

const load = (id: string): MapDocument => {
  const r = loadMap(readFileSync(new URL(`../../../maps/${id}.json`, import.meta.url), 'utf8'));
  if (!r.ok) throw new Error(`${id} invalid`);
  return r.map;
};

describe('jump pads land where bots are told they do', () => {
  // On maps like Void Yard (nothing but pads over the void) a flight that falls short is a death.
  const withPads = readdirSync(new URL('../../../maps/', import.meta.url))
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
    .filter((id) => load(id).entities.some((e) => e.kind === 'pad'));
  it.each(withPads)('every pad on %s carries a player to its predicted landing', { timeout: 180_000 }, (id) => {
    // The flight MapMaker's checks and validate-map fly (sim/padFlight.ts): there a miss is a warning, here it fails.
    const flights = flyPads(load(id));
    expect(flights.length).toBeGreaterThan(0);
    for (const f of flights) {
      const pad = `pad ${f.id} at ${f.pad.x},${f.pad.z}`;
      expect(f.predicted, `${pad} comes down somewhere`).toBeTruthy();
      expect(f.alive, `${pad}: alive`).toBe(true);
      expect(f.landed, `${pad}: lands`).toBeTruthy();
      const got = f.landed!;
      const want = f.predicted!;
      expect(f.miss, `${pad}: landed ${got.x.toFixed(1)},${got.z.toFixed(1)}, predicted ${want.x.toFixed(1)},${want.z.toFixed(1)}`).toBeLessThan(PAD_MISS_M);
      expect(Math.abs(f.height), `${pad}: landed at ${got.y.toFixed(1)} m, predicted ${want.y.toFixed(1)} m`).toBeLessThan(PAD_MISS_HEIGHT_M);
    }
    expect(padFlightIssues(flights)).toEqual([]);
  });
});
