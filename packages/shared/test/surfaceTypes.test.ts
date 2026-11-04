/**
 * Surface types (content/surface-types.json, docs/CONTENT_PIPELINE.md "Surface types"): proof that the job changed
 * nothing it didn't mean to. fixtures/surface-classes-before.json holds every library material's and prop's ballistic
 * class (server) and impact effect (client) on origin/main before surface types existed; it is never regenerated.
 * The ONLY ballistic differences allowed are the owner's fixes (PROCEDURAL_ENVIRONMENT_AUDIT.md Q3, owner decisions
 * 2026-11-04), listed one by one in INTENDED below: a change to any other material or prop fails here.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  BUTTON_FIRE,
  CORE_MATERIALS,
  CORE_PROPS,
  DEFAULT_DEATHMATCH_RULES,
  MATERIAL_BALLISTICS,
  PLAYER,
  SURFACE_TYPES,
  SURFACE_TYPE_IDS,
  entityMaterial,
  getProp,
  getWeapon,
  gunplayOf,
  guessSurface,
  initPhysics,
  lookAngles,
  materialSurface,
  penetrate,
  propSurface,
  propSurfaceOf,
  surfaceMaterial,
  type BallisticMaterial,
  type MapDocument,
  type MapEntity,
  type MatchRules,
  type PlayerInput,
  weaponCode,
} from '../src/index.ts';
import { Match, initNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

const before = JSON.parse(readFileSync(new URL('./fixtures/surface-classes-before.json', import.meta.url), 'utf8')) as {
  materials: Record<string, { ballistic: BallisticMaterial; effect: string }>;
  props: Record<string, { ballistic: BallisticMaterial; effect: string }>;
};

const propClass = (model: string) => entityMaterial({ id: 'x', kind: 'prop', model, position: [0, 0, 0], yaw: 0 } as unknown as MapEntity);

/** Every intended ballistic change, by group: [before, after, prop ids]. Nothing else may change. */
const INTENDED: readonly [BallisticMaterial, BallisticMaterial, readonly string[]][] = [
  // Tree trunks, stumps and logs were concrete (no word in materialClass matched): now bark, heavy_wood (full cover).
  ['concrete', 'heavy_wood', [
    'prop.tree', 'prop.tree_tall', 'prop.tree_autumn', 'prop.pine', 'prop.pine_crooked', 'prop.palm', 'prop.palm_bent', 'prop.log', 'prop.stump',
    'prop.oak', 'prop.oak_dark', 'prop.oak_autumn', 'prop.tree_round', 'prop.tree_round_dark', 'prop.tree_round_autumn', 'prop.tree_fat',
    'prop.tree_detailed', 'prop.tree_cone', 'prop.tree_thin', 'prop.tree_blocks', 'prop.tree_small', 'prop.pine_tall', 'prop.pine_tall_b',
    'prop.pine_round', 'prop.pine_small', 'prop.palm_tall', 'prop.palm_short', 'prop.stump_old', 'prop.stump_cut', 'prop.log_big', 'prop.log_stack',
    'prop.jg_bamboo', 'prop.nt_birch', 'prop.nt_birch_autumn', 'prop.nt_birch_snow', 'prop.nt_common_tree', 'prop.nt_common_tree_2',
    'prop.nt_common_tree_autumn', 'prop.nt_dead_tree', 'prop.nt_common_tree_snow', 'prop.nt_pine_tall', 'prop.nt_pine_small', 'prop.nt_pine_snow_tall',
    'prop.nt_pine_autumn', 'prop.nt_palm_curved', 'prop.nt_palm_tall', 'prop.nt_willow', 'prop.nt_willow_autumn', 'prop.nt_willow_dead',
    'prop.nt_stump_large', 'prop.nt_stump_moss', 'prop.nt_log_large', 'prop.nt_log_moss', 'prop.nt_log_snow', 'prop.rn_dead_tree', 'prop.eg_palm',
    'prop.mn_oak', 'prop.mn_birch', 'prop.mn_fir', 'prop.mn_banana', 'prop.jt_tree_trunk',
  ]],
  // tree_plateau read as "plate".
  ['metal', 'heavy_wood', ['prop.tree_plateau']],
  // Bushes read as "bus".
  ['thin_metal', 'foliage', ['prop.bush', 'prop.bush_large', 'prop.bush_leafy', 'prop.bush_small', 'prop.bush_cone', 'prop.nt_bush_leafy', 'prop.nt_bush_berries', 'prop.nt_bush_snow']],
  // The Meshy shrub (a bush by another name) was concrete.
  ['concrete', 'foliage', ['prop.mn_shrub']],
  // Boulders and cliffs were concrete: now rock, which shoots as stone (like the rocks already were).
  ['concrete', 'stone', ['prop.boulder_round', 'prop.boulder_jagged', 'prop.boulder_flat', 'prop.cliff', 'prop.cliff_corner', 'prop.cliff_steps', 'prop.nt_boulder_tall', 'prop.nt_boulder', 'prop.nt_boulder_moss', 'prop.nt_boulder_snow']],
];

/** The client's old effect words → the surface type that draws them now (stone was the old fallback). */
const OLD_EFFECT: Record<string, string> = { stone: 'concrete', metal: 'metal', wood: 'wood', dirt: 'dirt' };

describe('surface types: nothing changed but the intended fixes', () => {
  it('the fixture covers every material and prop', () => {
    expect(Object.keys(before.materials).sort()).toEqual(CORE_MATERIALS.map((m) => m.id).sort());
    expect(Object.keys(before.props).sort()).toEqual(CORE_PROPS.map((p) => p.id).sort());
  });

  it('every library material keeps its ballistic class and its impact effect (none names a surface yet)', () => {
    const changed = CORE_MATERIALS.filter((m) => surfaceMaterial(m.id) !== before.materials[m.id]!.ballistic || materialSurface(m.id) !== OLD_EFFECT[before.materials[m.id]!.effect]).map((m) => m.id);
    expect(changed).toEqual([]);
  });

  it('props change ballistic class only where INTENDED says, exactly as it says', () => {
    const got: Record<string, string> = {};
    for (const p of CORE_PROPS) {
      const was = before.props[p.id]!.ballistic;
      const now = propClass(p.id);
      if (was !== now) got[p.id] = `${was} -> ${now}`;
    }
    const want: Record<string, string> = {};
    for (const [was, now, ids] of INTENDED) for (const id of ids) want[id] = `${was} -> ${now}`;
    expect(got).toEqual(want);
  });

  it('a prop with no surface keeps its old impact effect; one with a surface draws that surface', () => {
    const changed: string[] = [];
    for (const p of CORE_PROPS) {
      const own = propSurfaceOf(p.id);
      if (own) expect(propSurface(p.id)).toBe(own);
      else if (propSurface(p.id) !== OLD_EFFECT[before.props[p.id]!.effect]) changed.push(p.id);
    }
    expect(changed).toEqual([]);
  });

  it('every surface type has a ballistic class the server knows', () => {
    for (const id of SURFACE_TYPE_IDS) expect(MATERIAL_BALLISTICS[SURFACE_TYPES[id].ballistic], id).toBeDefined();
    expect(SURFACE_TYPES.bark.ballistic).toBe('heavy_wood');
    expect(SURFACE_TYPES.foliage.ballistic).toBe('foliage');
    expect(SURFACE_TYPES.rock.ballistic).toBe('stone');
    expect(guessSurface('nothing to see')).toBe('concrete');
  });
});

describe('surface types: trunks, bushes and boulders under fire', () => {
  beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

  const rifle = gunplayOf(getWeapon('core.rifle')).ballistic!.energy;
  // The strongest round in the game (the precision family's).
  const precision = Math.max(...['core.sniper', 'core.marksman', 'core.rifle'].map((w) => gunplayOf(getWeapon(w)).ballistic?.energy ?? 0));

  it('by the numbers: a trunk post and a boulder stop a rifle round, a bush lets it through', () => {
    const trunk = getProp('prop.oak')!;
    expect(trunk.collision?.[0]).toBeLessThanOrEqual(0.5);
    expect(penetrate(rifle, propClass('prop.oak'), trunk.collision![0])).toBeNull();
    expect(penetrate(precision, propClass('prop.oak'), 0.5)).toBeNull();
    // Heavy wood is not concrete's twin: bark never ricochets.
    expect(MATERIAL_BALLISTICS.heavy_wood.ricochet).toBe(0);
    expect(penetrate(rifle, propClass('prop.bush_large'), getProp('prop.bush_large')!.size[0])).not.toBeNull();
    const boulder = getProp('prop.nt_boulder')!;
    expect(penetrate(rifle, propClass('prop.nt_boulder'), Math.min(boulder.size[0], boulder.size[2]))).toBeNull();
  });

  // A rifle shot from 6 m before a prop to a target 4 m behind it, through the live match (the server's rules).
  const rules: MatchRules = { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000 };
  function shootThrough(model: string): number {
    const tiles = [];
    for (let x = 0; x < 3; x++) for (let y = -1; y <= 1; y++) tiles.push({ id: `p_${x}_${y}`, tile: 'core.platform', x, y, z: 0, rotation: 0 as const });
    const base = makeMap(tiles, [[0, 0, 0]]);
    const prop = { id: 'cover', kind: 'prop', model, position: [6, 0, 0], yaw: 0, scale: 1, solid: true, tint: null } as unknown as MapEntity;
    const match = new Match({ ...base, entities: [...base.entities, prop] } as MapDocument, rules);
    const a = match.addHuman('a')!;
    const b = match.addHuman('b')!;
    a.move = { pos: { x: 0, y: 0, z: 0 }, velY: 0, grounded: true };
    b.move = { pos: { x: 10, y: 0, z: 0 }, velY: 0, grounded: true };
    const def = getWeapon('core.rifle');
    a.weapons.set(weaponCode(def), { def, mag: def.magazine, reserve: def.reserveMax, alt: 0 });
    a.current = weaponCode(def);
    a.raiseTicks = 0;
    a.fireCooldown = 0;
    const eye = { x: 0, y: PLAYER.eyeHeight, z: 0 };
    const chest = { x: 10, y: 1.1, z: 0 };
    let seq = 0;
    const input = (i: Partial<PlayerInput>) => match.queueInputs(a.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: a.yaw, pitch: a.pitch, buttons: 0, ...i }]);
    input({ ...lookAngles(eye, chest), buttons: BUTTON_FIRE });
    match.step();
    for (let i = 0; i < 6; i++) match.step();
    return 100 - b.health;
  }

  it('in a match: nothing between does damage; a trunk and a (chest-high) boulder stop the round; a bush does not', () => {
    const open = shootThrough('prop.grass_tuft');
    expect(open).toBeGreaterThan(0);
    expect(shootThrough('prop.oak')).toBe(0);
    expect(shootThrough('prop.nt_boulder_tall')).toBe(0);
    expect(shootThrough('prop.bush_large')).toBe(open);
  });
});
