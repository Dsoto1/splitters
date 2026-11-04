/**
 * Weapons as data (docs/CONTENT_SCALABILITY.md, "Weapons as data"): every weapon, throwable and class fully resolved
 * (definition, gunplayOf, network code) must stay exactly what it was before the tables moved to content/*.json.
 * The fixture was written from the hand-written tables, before the move; it is only rewritten on purpose:
 *   UPDATE_WEAPON_FIXTURE=1 pnpm vitest run packages/shared/test/weaponsData.test.ts
 * and the diff of test/fixtures/weapons-resolved.json then shows exactly what changed.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CLASS_DEFS,
  CLASS_IDS,
  CORE_WEAPONS,
  DISPENSER,
  THROWABLES,
  THROWABLE_DEFS,
  WEAPONS_BY_SLOT,
  classFromSay,
  classIndex,
  classSay,
  gunplayOf,
  throwableWeaponId,
  weaponByCode,
  weaponCode,
} from '../src/index.ts';

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/weapons-resolved.json');

/** JSON that keeps -0 and drops undefined, so the comparison is exact. */
const norm = (v: unknown): unknown => JSON.parse(JSON.stringify(v, (_k, x) => (Object.is(x, -0) ? '-0' : x)));

function resolved() {
  return norm({
    weapons: Object.values(CORE_WEAPONS).map((def) => ({ code: weaponCode(def), id: def.id, def, gunplay: gunplayOf(def) })),
    bySlot: WEAPONS_BY_SLOT.map((w) => w.id),
    throwables: THROWABLES.map((kind, code) => ({ code, kind, weaponId: throwableWeaponId(kind), def: THROWABLE_DEFS[kind] })),
    classes: CLASS_IDS.map((id) => ({ code: classIndex(id), say: classSay(id), def: CLASS_DEFS[id] })),
    dispenser: DISPENSER,
  }) as {
    weapons: { code: number; id: string }[];
    throwables: { code: number; kind: string }[];
    classes: { code: number; say: number; def: { id: string } }[];
  };
}

describe('weapons as data: the resolved tables', () => {
  if (process.env.UPDATE_WEAPON_FIXTURE) {
    it('writes the fixture', () => {
      writeFileSync(FIXTURE, JSON.stringify(resolved(), null, 1) + '\n');
    });
    return;
  }

  it('deep-equal the fixture written before the move', () => {
    expect(existsSync(FIXTURE)).toBe(true);
    expect(resolved()).toEqual(JSON.parse(readFileSync(FIXTURE, 'utf8')));
  });

  it('keep every network code (weapons, throwables, classes)', () => {
    const fx = JSON.parse(readFileSync(FIXTURE, 'utf8')) as ReturnType<typeof resolved>;
    for (const w of fx.weapons) {
      expect(weaponCode({ id: w.id }), w.id).toBe(w.code);
      expect(weaponByCode(w.code)?.id, String(w.code)).toBe(w.id);
    }
    for (const t of fx.throwables) expect(THROWABLES.indexOf(t.kind as (typeof THROWABLES)[number])).toBe(t.code);
    for (const c of fx.classes) {
      expect(classIndex(c.def.id as (typeof CLASS_IDS)[number])).toBe(c.code);
      expect(classFromSay(c.say)).toBe(c.def.id);
    }
  });
});
