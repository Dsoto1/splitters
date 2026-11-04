/**
 * Vehicles, turrets and NPC roles as data (docs/CONTENT_SCALABILITY.md step 4): every mount definition and every NPC
 * role fully resolved (spec, bot profile, network code) must stay exactly what it was before the tables moved to
 * content/vehicles/*.json and content/npcs.json. The fixtures were written from the hand-written tables, before the
 * move; they are only rewritten on purpose:
 *   UPDATE_VEHICLE_FIXTURE=1 pnpm vitest run packages/shared/test/vehiclesNpcsData.test.ts
 * and the diff of test/fixtures/vehicles-resolved.json and npc-roles-resolved.json then shows exactly what changed.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  AIRPLANE_DEF,
  CREATURE_ROLES,
  DROPSHIP_DROP_DEF,
  MOUNT_DEFS,
  MOUNT_MODELS,
  NPC_LOOK_GROUPS,
  NPC_LOOKS,
  NPC_ROLE_PROFILES,
  NPC_ROLE_SPECS,
  NPC_ROLES,
  PLAYER_NPC_LOOKS,
  airCraftDef,
  cockpitEye,
  getMountDef,
  mountMass,
  type MountDef,
} from '../src/index.ts';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const VEHICLES = join(FIXTURES, 'vehicles-resolved.json');
const NPCS = join(FIXTURES, 'npc-roles-resolved.json');

/** JSON that keeps -0 and drops undefined, so the comparison is exact. */
const norm = (v: unknown): unknown => JSON.parse(JSON.stringify(v, (_k, x) => (Object.is(x, -0) ? '-0' : x)));

const resolveMount = (def: MountDef) => ({ def, mass: mountMass(def), eyes: def.seats.map((_, i) => cockpitEye(def, i)) });

function vehicles() {
  return norm({
    // MOUNT_MODELS order is MapMaker's palette and inspector order (mounts travel as their map entity index, not a code).
    models: [...MOUNT_MODELS],
    mounts: MOUNT_MODELS.map((m) => resolveMount(MOUNT_DEFS[m])),
    airplane: resolveMount(AIRPLANE_DEF),
    dropshipDrop: resolveMount(DROPSHIP_DROP_DEF),
    lookup: {
      airplane: getMountDef('airplane')?.id,
      dropship_drop: getMountDef('dropship_drop')?.id,
      craftDropship: airCraftDef('dropship').id,
      craftDefault: airCraftDef(undefined).id,
    },
  }) as { models: string[] };
}

function npcs() {
  return norm({
    // A role's code is its index in NPC_ROLES: NPC snapshots carry it (match.ts npcSnapshots, client session).
    roles: NPC_ROLES.map((role, code) => ({ code, role, spec: NPC_ROLE_SPECS[role], profile: NPC_ROLE_PROFILES[role] })),
    creatures: [...CREATURE_ROLES],
    looks: NPC_LOOKS,
    playerLooks: PLAYER_NPC_LOOKS.map((l) => l.id),
    lookGroups: NPC_LOOK_GROUPS,
  }) as { roles: { code: number; role: string }[] };
}

describe('vehicles, turrets and NPC roles as data: the resolved tables', () => {
  if (process.env.UPDATE_VEHICLE_FIXTURE) {
    it('writes the fixtures', () => {
      writeFileSync(VEHICLES, JSON.stringify(vehicles(), null, 1) + '\n');
      writeFileSync(NPCS, JSON.stringify(npcs(), null, 1) + '\n');
    });
    return;
  }

  it('mounts deep-equal the fixture written before the move', () => {
    expect(existsSync(VEHICLES)).toBe(true);
    expect(vehicles()).toEqual(JSON.parse(readFileSync(VEHICLES, 'utf8')));
  });

  it('NPC roles deep-equal the fixture written before the move', () => {
    expect(existsSync(NPCS)).toBe(true);
    expect(npcs()).toEqual(JSON.parse(readFileSync(NPCS, 'utf8')));
  });

  it('keep every NPC role network code', () => {
    const fx = JSON.parse(readFileSync(NPCS, 'utf8')) as ReturnType<typeof npcs>;
    for (const r of fx.roles) expect(NPC_ROLES.indexOf(r.role as (typeof NPC_ROLES)[number]), r.role).toBe(r.code);
    expect(NPC_ROLES.length).toBe(fx.roles.length);
  });
});
