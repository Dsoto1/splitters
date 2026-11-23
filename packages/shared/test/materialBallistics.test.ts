/**
 * Material ballistics fixes (owner, 2026-11-23; GUNPLAY_SPEC §8, "Implementation note: material classes fixed"): 42
 * library materials kept an accidental class from the id guess (`panel` read as glass, `lighthouse` as energy, `carved`
 * as sheet metal). The fixed ones, under fire: what a pistol, an SMG, a rifle and the precision rifle do to each, through
 * the server's rules, and how long the MapMaker barrier lasts.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import {
  BUTTON_FIRE,
  DEFAULT_DEATHMATCH_RULES,
  MATERIAL_BALLISTICS,
  PLAYER,
  RICOCHET_MAX_ANGLE,
  getWeapon,
  gunplayOf,
  initPhysics,
  lookAngles,
  newScenarioEntity,
  penetrate,
  ricochets,
  surfaceMaterial,
  weaponCode,
  type MapDocument,
  type MapEntity,
  type MatchRules,
  type PlayerInput,
} from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const energy = (id: string) => gunplayOf(getWeapon(id)).ballistic!.energy;
const GUNS = ['core.pistol', 'core.smg', 'core.rifle', 'core.sniper'] as const;

describe('material ballistics fixes (owner, 2026-11-23)', () => {
  it('each fixed material has the class the owner chose', () => {
    const want: Record<string, string> = {
      'core.pbr_white_panel': 'thin_metal', 'core.orbital_panel': 'thin_metal', 'core.scifi_panel': 'thin_metal',
      'core.prefab_red': 'thin_metal', 'core.prefab_white': 'thin_metal',
      'core.pbr_bunker_panels': 'concrete',
      'core.light_strip': 'drywall', 'core.glow_trim': 'drywall', 'core.lamp_glow': 'drywall', 'core.beacon_red': 'drywall',
      'core.neon_tube': 'glass',
      'core.lighthouse_bands': 'stone', 'core.carved_stone': 'stone', 'core.hieroglyphs_painted': 'stone',
      'core.sandstone': 'stone', 'core.sandstone_tiles': 'stone', 'core.temple_sandstone': 'stone', 'core.pbr_sandstone_blocks': 'stone', 'core.pbr_rough_sandstone': 'stone',
      'core.wattle': 'thin_wood', 'core.mashrabiya': 'thin_wood',
      'core.pbr_adobe': 'soil',
      // Unchanged (owner: floor grates and walkways stay).
      'core.grate': 'thin_metal', 'core.pbr_walkway': 'thin_metal',
    };
    const got = Object.fromEntries(Object.keys(want).map((id) => [id, surfaceMaterial(id)]));
    expect(got).toEqual(want);
  });

  it('penetration by the numbers: panels stop light guns, bunker concrete stops everything, lights and neon let rounds through', () => {
    const through = (m: string, thick: number) => GUNS.map((g) => penetrate(energy(g), surfaceMaterial(m), thick) !== null);
    // A 0.4 m white panel (Orbital and Industrial walls): cover against the pistol, the SMG and the rifle; the precision rifle punches through.
    expect(through('core.pbr_white_panel', 0.4)).toEqual([false, false, false, true]);
    // A thin 0.1 m panel skin: the rifle gets through, light guns do not.
    expect(through('core.pbr_white_panel', 0.1)).toEqual([false, false, true, true]);
    // Bunker Concrete at Military wall depth stops every round in the game.
    expect(through('core.pbr_bunker_panels', 0.6)).toEqual([false, false, false, false]);
    // Light strips (0.2 m) and neon tubes (0.1 m) no longer stop a round: they were bulletproof "energy".
    expect(through('core.light_strip', 0.2)).toEqual([true, true, true, true]);
    expect(through('core.neon_tube', 0.1)).toEqual([true, true, true, true]);
    // A lighthouse wall and carved temple stone are masonry: nothing gets through 0.5 m.
    expect(through('core.lighthouse_bands', 0.5)).toEqual([false, false, false, false]);
    expect(through('core.carved_stone', 0.5)).toEqual([false, false, false, false]);
    expect(through('core.hieroglyphs_painted', 0.5)).toEqual([false, false, false, false]);
    // Wattle and lattice screens (0.15 m) are thin wood now: a pistol keeps more of its round.
    expect(penetrate(energy('core.pistol'), surfaceMaterial('core.wattle'), 0.15)! / energy('core.pistol')).toBeGreaterThan(0.75);
  });

  it('ricochet: panels spark off like sheet metal; temple stone rarely, adobe never; lights and neon never', () => {
    const graze = 0.02;
    const chance = (m: string) => MATERIAL_BALLISTICS[surfaceMaterial(m)].ricochet;
    expect(chance('core.pbr_white_panel')).toBe(MATERIAL_BALLISTICS.thin_metal.ricochet);
    expect(chance('core.carved_stone')).toBe(MATERIAL_BALLISTICS.stone.ricochet);
    expect(chance('core.carved_stone')).toBeLessThan(0.2);
    for (const m of ['core.pbr_adobe', 'core.light_strip', 'core.neon_tube']) expect(ricochets(surfaceMaterial(m), graze, 0), m).toBe(false);
    expect(ricochets(surfaceMaterial('core.pbr_white_panel'), graze, 0.3)).toBe(true);
    expect(ricochets(surfaceMaterial('core.carved_stone'), graze, 0.3)).toBe(false);
    // Bounded as before: nothing ricochets off a square hit.
    expect(ricochets(surfaceMaterial('core.pbr_white_panel'), RICOCHET_MAX_ANGLE, 0)).toBe(false);
  });

  // The server's own rules: a shooter at the origin, a target 10 m away, a wall 6 m out.
  const rules: MatchRules = { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000 };
  function arena(extra: MapEntity[]): Match {
    const tiles = [];
    for (let x = 0; x < 3; x++) for (let y = -1; y <= 1; y++) tiles.push({ id: `p_${x}_${y}`, tile: 'core.platform', x, y, z: 0, rotation: 0 as const });
    const base = makeMap(tiles, [[0, 0, 0]]);
    return new Match({ ...base, entities: [...base.entities, ...extra] } as MapDocument, rules);
  }
  function arm(c: Combatant, id: string): void {
    const def = getWeapon(id);
    c.weapons.set(weaponCode(def), { def, mag: 1000, reserve: 0, alt: 0 });
    c.current = weaponCode(def);
    c.raiseTicks = 0;
    c.fireCooldown = 0;
  }
  const wall = (material: string, thick: number): MapEntity =>
    ({ id: 'wall', kind: 'block', position: [6, 0, 0], size: [thick, 3, 4], yaw: 0, material, tint: null, behaviour: 'solid', trigger: 'step', delaySeconds: 0.8, respawnSeconds: 8, health: 120 }) as MapEntity;

  /** Damage one round of `gun` does to a player standing 4 m behind a `thick` wall of `material`. */
  function shootThrough(material: string, thick: number, gun: string): number {
    const match = arena([wall(material, thick)]);
    const a = match.addHuman('a')!;
    const b = match.addHuman('b')!;
    a.move = { pos: { x: 0, y: 0, z: 0 }, velY: 0, grounded: true };
    b.move = { pos: { x: 10, y: 0, z: 0 }, velY: 0, grounded: true };
    arm(a, gun);
    let seq = 0;
    const input = (i: Partial<PlayerInput>) => match.queueInputs(a.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: a.yaw, pitch: a.pitch, buttons: 0, ...i }]);
    input({ ...lookAngles({ x: 0, y: PLAYER.eyeHeight, z: 0 }, { x: 10, y: 1.1, z: 0 }), buttons: BUTTON_FIRE });
    match.step();
    for (let i = 0; i < 8; i++) match.step();
    return 100 - b.health;
  }

  it('in a match: a 0.4 m white panel stops the pistol, SMG and rifle; the precision rifle gets through, weakened', () => {
    for (const g of ['core.pistol', 'core.smg', 'core.rifle']) expect(shootThrough('core.pbr_white_panel', 0.4, g), g).toBe(0);
    const open = shootThrough('core.neon_tube', 0.02, 'core.sniper');
    const panel = shootThrough('core.pbr_white_panel', 0.4, 'core.sniper');
    expect(panel).toBeGreaterThan(0);
    expect(panel).toBeLessThan(open);
    // Bunker concrete stops even that.
    expect(shootThrough('core.pbr_bunker_panels', 0.6, 'core.sniper')).toBe(0);
    // A light strip lets a pistol round through.
    expect(shootThrough('core.light_strip', 0.2, 'core.pistol')).toBeGreaterThan(0);
  });

  // 400 HP over (18 Assault Rifle damage x concrete's 0.4) = 56 hits; as glass (x3) it was 8. The owner asked for "about
  // 30"; whether the piece's health should drop to about 220 for that is an open question (HANDOFF, 2026-11-23).
  it('the MapMaker barrier (Bunker Concrete) takes 56 Assault Rifle hits to break (was 8 as glass)', () => {
    const barrier = newScenarioEntity("block:barrier", [4, 0, 0], Math.PI / 2) as Extract<MapEntity, { kind: 'block' }>;
    expect(barrier.material).toBe('core.pbr_bunker_panels');
    const match = arena([barrier]);
    const a = match.addHuman('a')!;
    a.move = { pos: { x: 0, y: 0, z: 0 }, velY: 0, grounded: true };
    arm(a, 'core.rifle');
    let seq = 0;
    let shots = 0;
    const aim = lookAngles({ x: 0, y: PLAYER.eyeHeight, z: 0 }, { x: 4, y: 0.55, z: 0 });
    while (match.scenario.destructibleAlive(barrier.id) && shots < 200) {
      a.fireCooldown = 0;
      match.queueInputs(a.slot, [{ seq: ++seq, forward: 0, right: 0, ...aim, buttons: BUTTON_FIRE }]);
      match.step();
      shots++;
      // Let the recoil settle so every round lands on the block.
      for (let i = 0; i < 20; i++) {
        match.queueInputs(a.slot, [{ seq: ++seq, forward: 0, right: 0, ...aim, buttons: 0 }]);
        match.step();
      }
    }
    expect(match.scenario.destructibleAlive(barrier.id)).toBe(false);
    expect(shots).toBe(Math.ceil(barrier.health! / (getWeapon('core.rifle').damage * MATERIAL_BALLISTICS.concrete.destruction)));
    expect(shots).toBeGreaterThanOrEqual(30);
  });
});
