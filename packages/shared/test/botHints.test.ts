// Bot hints in MapMaker (docs/MAPMAKER_OVERHAUL_PLAN.md Phase 4 item 3; BOT_AI_PLAN.md Phase D item 5; docs/BOTS.md,
// "Bot hints (map data)"): map format v33, the commands and their undo, the read-only accessor, and the checks
// (validateMap's, and the navigation validator's off-the-navmesh one), headless.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  BOT_HINT_SPECS,
  BotHint,
  EditHistory,
  MAP_FORMAT_VERSION,
  addBotHintCommand,
  botHintIssues,
  botHintNavIssues,
  deleteBotHintsCommand,
  editBotHintCommand,
  hintJumpReach,
  initPhysics,
  jumpTrouble,
  loadMap,
  mapBotHints,
  mapContentHash,
  migrateMapDocument,
  moveBotHintCommand,
  serializeMap,
  validateMap,
  type EditCommand,
  type MapDocument,
} from '../src/index.ts';
import { initNavigation, validateMapNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

const ok = <T,>(r: T | { error: string }): T => {
  if (r && typeof r === 'object' && 'error' in r) throw new Error((r as { error: string }).error);
  return r as T;
};

/** Open yard tiles, 3 × 3 (x and z from -4 to 20), floor at 0. */
function yard(): MapDocument {
  const tiles: MapDocument['classicStructure']['tiles'] = [];
  for (let x = 0; x < 3; x++) for (let z = 0; z < 3; z++) tiles.push({ id: `yard_${x}${z}`, tile: 'core.yard', x, y: z, z: 0, rotation: 0 });
  return makeMap(tiles, [[0, 0, 0]]);
}

/** Run a command through history: undo gives the document back exactly, redo the same result again. */
function roundTrip(doc: MapDocument, cmd: EditCommand): MapDocument {
  const h = new EditHistory(doc);
  h.execute('step', cmd);
  const after = h.doc;
  h.undo();
  expect(h.doc).toEqual(doc);
  h.redo();
  expect(h.doc).toEqual(after);
  return after;
}

const add = (doc: MapDocument, ...args: Parameters<typeof addBotHintCommand> extends [unknown, ...infer R] ? R : never) => {
  const r = ok(addBotHintCommand(doc, ...args));
  return { doc: roundTrip(doc, r.command), hint: r.hint };
};

describe('format v33: bot hints', () => {
  it('a v32 map migrates unchanged and loads; hints save, load and count in the content hash (bots play them)', () => {
    expect(MAP_FORMAT_VERSION).toBeGreaterThanOrEqual(33);
    const v32 = { ...JSON.parse(readFileSync(new URL('./fixtures/iron_compound_v26.json', import.meta.url), 'utf8')), formatVersion: 32 };
    const { doc, fromVersion } = migrateMapDocument(structuredClone(v32));
    expect(fromVersion).toBe(32);
    expect(doc).toEqual({ ...v32, formatVersion: MAP_FORMAT_VERSION });
    const loaded = loadMap(structuredClone(v32));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.map.botHints).toBeUndefined();
    expect(mapBotHints(loaded.map)).toEqual([]);
    const { doc: hinted } = add(yard(), 'sniper', [4, 0, 4], { yaw: Math.PI / 2 });
    const back = loadMap(serializeMap(hinted));
    expect(back.ok && back.map.botHints).toEqual(hinted.botHints);
    expect(mapContentHash(hinted)).not.toBe(mapContentHash(yard()));
  });

  it('the schema: a jump link has a landing and nothing else does; radius and team are checked', () => {
    const base = { id: 'hint_a', position: [0, 0, 0] as [number, number, number], radius: 2 };
    expect(BotHint.safeParse({ ...base, kind: 'jump' }).success).toBe(false);
    expect(BotHint.safeParse({ ...base, kind: 'jump', to: [3, 0, 0] }).success).toBe(true);
    expect(BotHint.safeParse({ ...base, kind: 'choke', to: [3, 0, 0] }).success).toBe(false);
    expect(BotHint.safeParse({ ...base, kind: 'camp', radius: 0.1 }).success).toBe(false);
    expect(BotHint.safeParse({ ...base, kind: 'camp', team: 'Red Team' }).success).toBe(false);
    expect(BotHint.safeParse({ ...base, kind: 'staging', team: 'red', yaw: 1 }).success).toBe(true);
  });
});

describe('bot hint commands (one undo step each)', () => {
  it('places each kind with its own defaults; a jump link from its start to its landing', () => {
    let doc = yard();
    for (const kind of ['choke', 'sniper', 'camp', 'staging'] as const) {
      const r = add(doc, kind, [2.0004, 0, 6], { yaw: 7 });
      doc = r.doc;
      expect(r.hint).toMatchObject({ kind, position: [2, 0, 6], radius: BOT_HINT_SPECS[kind].radius });
      // The facing kept in (-π, π].
      expect(r.hint.yaw).toBeCloseTo(7 - 2 * Math.PI, 3);
      expect(r.hint.to).toBeUndefined();
    }
    const jump = add(doc, 'jump', [0, 0, 0], { to: [4, 0, 0], yaw: 1 });
    expect(jump.hint).toMatchObject({ kind: 'jump', position: [0, 0, 0], to: [4, 0, 0] });
    expect(jump.hint.yaw).toBeUndefined();
    // Without a landing: 3 m the way it faces (yaw 0: north, +z).
    expect(ok(addBotHintCommand(doc, 'jump', [1, 0, 1])).hint.to).toEqual([1, 0, 4]);
    // A team, or every side's.
    expect(ok(addBotHintCommand(doc, 'staging', [1, 0, 1], { team: 'red' })).hint.team).toBe('red');
    expect(mapBotHints(jump.doc)).toHaveLength(5);
    expect(new Set(mapBotHints(jump.doc).map((h) => h.id)).size).toBe(5);
  });

  it('edits: kind (a jump link gains or drops its landing; a default radius follows the kind), facing, radius, team, either end', () => {
    const { doc, hint } = add(yard(), 'choke', [2, 0, 2], { yaw: 0 });
    const asJump = roundTrip(doc, ok(editBotHintCommand(doc, hint.id, { kind: 'jump' })));
    const j = mapBotHints(asJump)[0]!;
    expect(j).toMatchObject({ kind: 'jump', position: [2, 0, 2], to: [2, 0, 5], radius: BOT_HINT_SPECS.jump.radius });
    expect(j.yaw).toBeUndefined();
    const back = mapBotHints(roundTrip(asJump, ok(editBotHintCommand(asJump, hint.id, { kind: 'sniper' }))))[0]!;
    expect(back.to).toBeUndefined();
    expect(back).toMatchObject({ kind: 'sniper', yaw: 0, radius: BOT_HINT_SPECS.sniper.radius });
    // A radius set by hand stays through a change of kind.
    const wide = roundTrip(doc, ok(editBotHintCommand(doc, hint.id, { radius: 9 })));
    expect(mapBotHints(roundTrip(wide, ok(editBotHintCommand(wide, hint.id, { kind: 'staging' }))))[0]!.radius).toBe(9);
    // Radius clamped to the schema's range; team set and cleared; facing set and cleared.
    expect(mapBotHints(applyEdit(doc, hint.id, { radius: 99 }))[0]!.radius).toBe(40);
    const red = applyEdit(doc, hint.id, { team: 'red' });
    expect(mapBotHints(red)[0]!.team).toBe('red');
    expect('team' in mapBotHints(applyEdit(red, hint.id, { team: null }))[0]!).toBe(false);
    expect(mapBotHints(applyEdit(doc, hint.id, { yaw: Math.PI / 4 }))[0]!.yaw).toBeCloseTo(Math.PI / 4, 3);
    expect('yaw' in mapBotHints(applyEdit(doc, hint.id, { yaw: null }))[0]!).toBe(false);
    // Moving: the spot; a jump link's start and landing each on their own.
    expect(mapBotHints(roundTrip(doc, ok(moveBotHintCommand(doc, hint.id, [5, 1, 5]))))[0]!.position).toEqual([5, 1, 5]);
    const moved = mapBotHints(roundTrip(asJump, ok(moveBotHintCommand(asJump, hint.id, [9, 0, 9], 'to'))))[0]!;
    expect(moved).toMatchObject({ position: [2, 0, 2], to: [9, 0, 9] });
    expect(moveBotHintCommand(doc, hint.id, [1, 0, 1], 'to')).toEqual({ error: 'only a jump link has a landing' });
    expect(editBotHintCommand(doc, 'hint_none', { radius: 2 })).toEqual({ error: 'no such bot hint' });
  });

  it('deletes; the last one gone leaves no botHints key, and undo brings it back exactly', () => {
    const a = add(yard(), 'camp', [1, 0, 1]);
    const b = add(a.doc, 'camp', [6, 0, 6]);
    const one = roundTrip(b.doc, ok(deleteBotHintsCommand(b.doc, [a.hint.id])));
    expect(mapBotHints(one).map((h) => h.id)).toEqual([b.hint.id]);
    const none = roundTrip(one, ok(deleteBotHintsCommand(one, [b.hint.id])));
    expect('botHints' in none).toBe(false);
    expect(none).toEqual(yard());
    expect(deleteBotHintsCommand(none, ['hint_x'])).toEqual({ error: 'no such bot hint' });
  });

  it('the accessor bots read: by kind, and a team gets its own and every side’s', () => {
    let doc = yard();
    doc = add(doc, 'staging', [1, 0, 1], { team: 'red' }).doc;
    doc = add(doc, 'staging', [9, 0, 9], { team: 'blue' }).doc;
    doc = add(doc, 'choke', [5, 0, 5]).doc;
    expect(mapBotHints(doc)).toHaveLength(3);
    expect(mapBotHints(doc, 'staging')).toHaveLength(2);
    expect(mapBotHints(doc, 'staging', 'red').map((h) => h.team)).toEqual(['red']);
    expect(mapBotHints(doc, undefined, 'blue').map((h) => h.kind)).toEqual(['staging', 'choke']);
  });
});

function applyEdit(doc: MapDocument, id: string, patch: Parameters<typeof editBotHintCommand>[2]): MapDocument {
  return roundTrip(doc, ok(editBotHintCommand(doc, id, patch)));
}

describe('bot hint checks (warnings, never errors)', () => {
  it('jumps: what the movement numbers allow (a running jump about 5.5 m across, 1.8 m up with the legs tucked)', () => {
    expect(hintJumpReach(0).across).toBeGreaterThan(5.4);
    expect(hintJumpReach(0).across).toBeLessThan(7);
    expect(hintJumpReach(0).up).toBeCloseTo(7 * 7 / 40 + 0.6, 2);
    // Lower gravity: further and higher.
    expect(hintJumpReach(0, 0.5).across).toBeGreaterThan(hintJumpReach(0).across);
    const j = (to: [number, number, number], physics: MapDocument['physics'] = null) => jumpTrouble({ position: [0, 0, 0], to }, physics);
    expect(j([5, 0, 0])).toBeNull();
    expect(j([4, 1.5, 0])).toBeNull();
    expect(j([9, 0, 0])).toMatch(/9\.0 m across/);
    expect(j([2, 2.5, 0])).toMatch(/2\.5 m up/);
    expect(j([0.2, 0, 0.2])).toMatch(/same spot/);
    // A long drop: fine without fall damage, a warning with it.
    expect(j([3, -12, 0])).toBeNull();
    expect(j([3, -12, 0], { gravity: 1, fallDamage: true })).toMatch(/fall that hurts/);
  });

  it('validateMap: outside the boundary, a jump no one could make, two on one spot', () => {
    let doc: MapDocument = { ...yard(), bounds: { min: [-4, -4], max: [20, 20], style: 'invisible', height: 8 } };
    doc = add(doc, 'sniper', [4, 0, 4]).doc;
    const clean = validateMap(doc).filter((i) => i.code.startsWith('bothint.'));
    expect(clean).toEqual([]);
    const outside = add(doc, 'camp', [30, 0, 4]);
    doc = outside.doc;
    const far = add(doc, 'jump', [0, 0, 0], { to: [12, 0, 0] });
    doc = far.doc;
    doc = add(doc, 'sniper', [4.3, 0, 4.2]).doc;
    // The same spot but another kind or team is fine.
    doc = add(doc, 'camp', [4, 0, 4]).doc;
    doc = add(doc, 'sniper', [4, 0, 4], { team: 'red' }).doc;
    const issues = validateMap(doc).filter((i) => i.code.startsWith('bothint.'));
    expect(issues.every((i) => i.severity === 'warning')).toBe(true);
    expect(issues.map((i) => i.code).sort()).toEqual(['bothint.duplicate', 'bothint.jump', 'bothint.outside']);
    expect(issues.find((i) => i.code === 'bothint.jump')!.targetId).toBe(far.hint.id);
    expect(issues.find((i) => i.code === 'bothint.outside')!.message).toMatch(/Camp spot hint_\w+ is outside the map boundary/);
    expect(issues.find((i) => i.code === 'bothint.outside')!.targetId).toBe(outside.hint.id);
    expect(botHintIssues(yard())).toEqual([]);
  });

  it('off the navmesh: the fake navmesh says where it is', () => {
    const doc = add(add(yard(), 'choke', [4, 0, 4]).doc, 'jump', [0, 0, 0], { to: [3, 0, 0] }).doc;
    const nav = { nearestPoly: (p: { x: number; y: number; z: number }) => (p.x > 2 ? null : { point: { ...p } }) };
    const issues = botHintNavIssues(doc, nav);
    expect(issues.map((i) => i.message)).toEqual([expect.stringMatching(/^Chokepoint hint_\w+ is off the navmesh/), expect.stringMatching(/^Jump link hint_\w+'s landing is off the navmesh/)]);
  });
});

describe('bot hints on a real navmesh (sim/mapNav.ts)', () => {
  beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

  it('the navigation validator warns of a hint off the navmesh, and works out the computed spots when asked', () => {
    let doc = yard();
    doc = add(doc, 'sniper', [8, 0, 8]).doc;
    const off = add(doc, 'camp', [8, 6, 8]);
    doc = off.doc;
    const r = validateMapNavigation(doc, false, { computed: true });
    const hints = r.issues.filter((i) => i.code.startsWith('bothint.'));
    expect(hints.map((i) => [i.code, i.targetId, i.severity])).toEqual([['bothint.offNav', off.hint.id, 'warning']]);
    expect(r.computed).toBeDefined();
    expect(Array.isArray(r.computed!.vantage) && Array.isArray(r.computed!.parkour)).toBe(true);
    expect(validateMapNavigation(doc, false).computed).toBeUndefined();
  });
});
