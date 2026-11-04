/**
 * Pickups as data (docs/CONTENT_SCALABILITY.md step 5): every pickup item fully resolved (in table order, which is
 * MapMaker's palette order and the order random pickups roll from), the pickup rules and the random-pickup pools must
 * stay exactly what they were before the table moved to content/pickups.json. The fixture was written from the
 * hand-written table, before the move; it is only rewritten on purpose:
 *   UPDATE_PICKUP_FIXTURE=1 pnpm vitest run packages/shared/test/pickupsData.test.ts
 * and the diff of test/fixtures/pickups-resolved.json then shows exactly what changed.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ARMOR_ABSORB, CORE_ITEMS, DAMAGE_BOOST, MAX_ARMOR, PICKUP_RADIUS, SPEED_BOOST, WEAPON_CATEGORIES, categoryItems, getItem, itemCategory } from '../src/index.ts';

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'pickups-resolved.json');

/** JSON that keeps -0 and drops undefined, so the comparison is exact. */
const norm = (v: unknown): unknown => JSON.parse(JSON.stringify(v, (_k, x) => (Object.is(x, -0) ? '-0' : x)));

function pickups() {
  return norm({
    items: CORE_ITEMS.map((item) => ({ item, category: itemCategory(item), found: getItem(item.id) === item })),
    rules: { MAX_ARMOR, ARMOR_ABSORB, SPEED_BOOST, DAMAGE_BOOST, PICKUP_RADIUS },
    pools: Object.fromEntries(WEAPON_CATEGORIES.map((c) => [c, categoryItems(c).map((i) => i.id)])),
  }) as { items: { item: { id: string } }[] };
}

describe('pickups as data: the resolved table', () => {
  if (process.env.UPDATE_PICKUP_FIXTURE) {
    it('writes the fixture', () => {
      writeFileSync(FIXTURE, JSON.stringify(pickups(), null, 1) + '\n');
    });
    return;
  }

  it('deep-equals the fixture written before the move', () => {
    expect(existsSync(FIXTURE)).toBe(true);
    expect(pickups()).toEqual(JSON.parse(readFileSync(FIXTURE, 'utf8')));
  });

  it('keeps the exact numbers (no rounding through JSON)', () => {
    expect(ARMOR_ABSORB).toBe(2 / 3);
    const fx = JSON.parse(readFileSync(FIXTURE, 'utf8')) as { items: { item: { id: string; botValue: number } }[] };
    for (const { item } of fx.items) expect(getItem(item.id)?.botValue, item.id).toBe(item.botValue);
  });
});
