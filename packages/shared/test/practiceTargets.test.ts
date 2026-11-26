/**
 * Practice Targets (map format v55; the Practice range, owner 2026-11-19): a steel target that reports each hit to the
 * shooter (zone, distance, what it would do to a player, pellets summed), knocks down and stands up again, or stays up.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { BUTTON_FIRE, DEFAULT_DEATHMATCH_RULES, MAP_FORMAT_VERSION, PLAYER, TICK_RATE, TargetEntity, getWeapon, gunplayOf, initPhysics, lookAngles, migrateMapDocument, targetZoneAt, weaponCode, type GameEvent, type MapDocument, type MapEntity, type MatchRules, type PlayerInput } from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const rules: MatchRules = { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000 };
type Hit = Extract<GameEvent, { e: 'thit' }>;

function deck(extra: MapEntity[]): MapDocument {
  const tiles = [];
  for (let x = -1; x < 12; x++) for (let y = -2; y <= 2; y++) tiles.push({ id: `p_${x}_${y}`, tile: 'core.platform', x, y, z: 0, rotation: 0 as const });
  const map = makeMap(tiles, [[0, 0, 0]]);
  return { ...map, entities: [...map.entities, ...extra] };
}

/** A target 10 m down +X facing back at the shooter at the origin (its face, local +Z, toward -X). */
const target = (extra: Partial<TargetEntity> = {}): MapEntity => TargetEntity.parse({ id: 'tgt_1', kind: 'target', position: [10, 0, 0], yaw: -Math.PI / 2, ...extra });

function setup(weapon: string, extra: Partial<TargetEntity> = {}) {
  const match = new Match(deck([target(extra)]), rules);
  const a = match.addHuman('a')!;
  a.move = { pos: { x: 0, y: 0, z: 0 }, velY: 0, grounded: true };
  const def = getWeapon(weapon);
  a.weapons.set(weaponCode(def), { def, mag: def.magazine, reserve: def.reserveMax, alt: 0 });
  a.current = weaponCode(def);
  a.raiseTicks = 0;
  const index = match.map.entities.findIndex((e) => e.id === 'tgt_1');
  let seq = 0;
  const hits: Hit[] = [];
  const kinds: string[] = [];
  const step = (i: Partial<PlayerInput> = {}) => {
    match.queueInputs(a.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: a.yaw, pitch: a.pitch, buttons: 0, ...i }]);
    for (const ev of match.step()) {
      kinds.push(ev.e);
      if (ev.e === 'thit') hits.push(ev);
    }
  };
  const standing = () => (match.scenario.fullState().es ?? []).find(([i]) => i === index)?.[1] !== 0;
  return { match, a, step, hits, kinds, standing };
}

const eyeOf = (c: Combatant) => ({ x: c.move.pos.x, y: c.move.pos.y + PLAYER.eyeHeight, z: c.move.pos.z });

describe('Practice Targets', () => {
  it('a body hit reports the zone, distance and damage, knocks it down, and it stands up after its reset time', () => {
    const { a, step, hits, kinds, standing } = setup('core.pistol', { resetSeconds: 1 });
    const aim = lookAngles(eyeOf(a), { x: 10, y: 1.2, z: 0 });
    step({ ...aim, buttons: BUTTON_FIRE });
    for (let i = 0; i < 3; i++) step(aim);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ s: a.slot, z: 0, d: 10 });
    expect(hits[0]!.n).toBe(getWeapon('core.pistol').damage);
    expect(kinds).toContain('broken');
    expect(standing()).toBe(false);
    for (let i = 0; i < TICK_RATE; i++) step(aim);
    expect(standing()).toBe(true);
  });

  it('a head hit counts as the weapon\'s head multiple, and shows in the shooter\'s damage numbers as a head hit', () => {
    const { match, a, step, hits } = setup('core.pistol');
    const aim = lookAngles(eyeOf(a), { x: 10, y: 1.72, z: 0 });
    step({ ...aim, buttons: BUTTON_FIRE });
    step(aim);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.z).toBe(1);
    expect(hits[0]!.n).toBe(Math.round(getWeapon('core.pistol').damage * gunplayOf(getWeapon('core.pistol')).head));
    const dd = match.privateState(a.slot)!.dd!;
    expect(dd[0]![2]).toBe(8 | 1);
  });

  it('one that stays up keeps standing and reports every hit; a shotgun shell is one report, its pellets summed', () => {
    const { a, step, hits, standing } = setup('core.shotgun', { stays: true });
    const aim = lookAngles(eyeOf(a), { x: 10, y: 1.2, z: 0 });
    step({ ...aim, buttons: BUTTON_FIRE });
    step(aim);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.p ?? 1).toBeGreaterThan(1);
    expect(standing()).toBe(true);
  });

  it('the zones follow the silhouette (head, body, legs); a plate is all body', () => {
    const s = TargetEntity.parse({ id: 'tgt_2', kind: 'target', position: [0, 2, 0] });
    expect([targetZoneAt(s, { x: 0, y: 3.75, z: 0 }), targetZoneAt(s, { x: 0, y: 3.2, z: 0 }), targetZoneAt(s, { x: 0, y: 2.4, z: 0 })]).toEqual([1, 0, 2]);
    const p = TargetEntity.parse({ id: 'tgt_3', kind: 'target', position: [0, 0, 0], style: 'plate' });
    expect(targetZoneAt(p, { x: 0, y: 1.5, z: 0 })).toBe(0);
    expect(s.style).toBe('silhouette');
    expect(s.resetSeconds).toBe(2);
  });

  it('map format v55: a v54 map loads unchanged', () => {
    expect(MAP_FORMAT_VERSION).toBeGreaterThanOrEqual(55);
    const v54 = { ...makeMap([], [[0, 0, 0]]), formatVersion: 54 } as unknown as Record<string, unknown>;
    const out = migrateMapDocument(v54);
    expect(out.fromVersion).toBe(54);
    expect(out.doc.formatVersion).toBe(MAP_FORMAT_VERSION);
  });
});
