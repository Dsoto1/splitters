import { createHash } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  RESOURCE_BUDGETS,
  canonicalJson,
  derivedVersionId,
  initPhysics,
  loadMap,
  logicCycles,
  mapContentHash,
  mapIdentity,
  sha256Hex,
  stampMapRelease,
  type EncounterEntity,
  type LogicRule,
  type MapDocument,
} from '../src/index.ts';
import { Match, initNavigation } from '../src/match.ts';
import { loadArena, makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const rule = (id: string, r: Partial<LogicRule> & Pick<LogicRule, 'when' | 'do'>): LogicRule => ({ id, name: '', enabled: true, once: false, if: [], ...r });
const act = (type: LogicRule['do'][number]['type'], extra: Partial<LogicRule['do'][number]> = {}): LogicRule['do'][number] => ({ type, target: null, value: 0, text: '', state: '', ...extra });
const room = () => makeMap([{ id: 'room_a', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }], [[-2, 0, 0]]);

describe('map data limits', () => {
  it('refuses a map over 2 MiB before parsing it', () => {
    const big = JSON.stringify({ ...room(), metadata: { ...room().metadata, description: 'x'.repeat(RESOURCE_BUDGETS.mapBytes) } });
    const r = loadMap(big);
    expect(r.ok).toBe(false);
    expect(r.issues[0]!.code).toBe('budget.bytes');
    // Not even valid JSON: still the size that refuses it.
    expect(loadMap(`{${' '.repeat(RESOURCE_BUDGETS.mapBytes)}`).issues[0]!.code).toBe('budget.bytes');
  });

  it('caps dependencies', () => {
    const map = { ...room(), dependencies: Array.from({ length: 17 }, (_, i) => ({ pack: `pack${i}.core`, version: '1' })) };
    expect(loadMap(map).ok).toBe(false);
    expect(loadMap({ ...map, dependencies: map.dependencies.slice(0, 16) }).ok).toBe(true);
  });

  it('refuses too many vehicles or destructibles, and warns when encounters ask for more NPCs than the match allows', () => {
    const map = room();
    for (let i = 0; i < RESOURCE_BUDGETS.destructibles + 1; i++) map.entities.push({ id: `blk_${i}`, kind: 'block', position: [0, 10 + i * 0.01, 0], behaviour: 'breakable' } as MapDocument['entities'][number]);
    const r = loadMap(map);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'budget.destructibles')).toBe(true);
    const npcs = room();
    for (let i = 0; i < 3; i++) npcs.entities.push({ id: `enc_${i}`, kind: 'encounter', position: [0, 0, 0], activeCap: 32 } as unknown as EncounterEntity);
    const n = loadMap(npcs);
    expect(n.issues.find((i) => i.code === 'budget.npcs')?.severity).toBe('warning');
  });

  it('strips fields a map must never carry (scripts, links)', () => {
    const map = { ...room(), script: 'alert(1)', onLoad: 'x', metadata: { ...room().metadata, url: 'https://evil.example' } };
    const r = loadMap(map);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect('script' in r.map || 'onLoad' in r.map || 'url' in r.map.metadata).toBe(false);
  });
});

describe('logic loops', () => {
  it('finds rules that set each other off within a tick, and only those', () => {
    const rules = [
      rule('rule_a', { when: { event: 'variable_changed', target: 'var_v1' }, do: [act('add_var', { target: 'var_v2', value: 1 })] }),
      rule('rule_b', { when: { event: 'variable_changed', target: 'var_v2' }, do: [act('add_var', { target: 'var_v3', value: 1 })] }),
      rule('rule_c', { when: { event: 'variable_changed', target: 'var_v3' }, do: [act('add_var', { target: 'var_v1', value: 1 })] }),
      // Self loop.
      rule('rule_d', { when: { event: 'door_opened', target: 'door_x' }, do: [act('door_toggle', { target: 'door_x' })] }),
      // A wait breaks the tick; "once" can't loop; a chain without a way back isn't a loop.
      rule('rule_e', { when: { event: 'variable_changed', target: 'var_w' }, do: [act('wait', { value: 1 }), act('add_var', { target: 'w', value: 1 })] }),
      rule('rule_f', { once: true, when: { event: 'variable_changed', target: 'var_x' }, do: [act('add_var', { target: 'x', value: 1 })] }),
      rule('rule_g', { when: { event: 'match_start', target: null }, do: [act('add_var', { target: 'var_v1', value: 1 })] }),
    ];
    const cycles = logicCycles(rules).map((c) => c.map((r) => r.id).sort());
    expect(cycles).toEqual(expect.arrayContaining([['rule_a', 'rule_b', 'rule_c'], ['rule_d']]));
    expect(cycles).toHaveLength(2);
    const map = room();
    map.logic = { variables: ['var_v1', 'var_v2', 'var_v3'].map((id) => ({ id, name: id, initial: 0 })), timers: [], objectives: [], rules: rules.slice(0, 3) };
    const r = loadMap(map);
    expect(r.ok).toBe(true);
    expect(r.issues.filter((i) => i.code === 'logic.cycle')).toHaveLength(1);
  });

  it('a rule bomb runs slowly instead of freezing the host', () => {
    // Twenty rules on one variable, each adding to it 32 times: unbounded, depth 8 alone would be (20 × 32)^8 actions.
    const map = room();
    const rules = Array.from({ length: 20 }, (_, i) => rule(`bomb_${i}`, { when: { event: 'variable_changed', target: 'var_v' }, do: Array.from({ length: 32 }, () => act('add_var', { target: 'var_v', value: 1 })) }));
    rules.push(rule('rule_kick', { when: { event: 'match_start', target: null }, do: [act('add_var', { target: 'var_v', value: 1 })] }));
    map.logic = { variables: [{ id: 'var_v', name: 'v', initial: 0 }], timers: [], objectives: [], rules };
    const loaded = loadMap(map);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.issues));
    const warn = console.warn;
    const warnings: string[] = [];
    console.warn = (m: string) => warnings.push(m);
    try {
      const match = new Match(loaded.map, undefined, 1);
      match.addHuman('me');
      const t0 = performance.now();
      let last = 0;
      for (let i = 0; i < 30; i++) {
        match.step();
        const v = match.scenario.variable('var_v')!;
        // Each tick runs at most the action budget (plus the one that started it).
        expect(v - last).toBeLessThanOrEqual(RESOURCE_BUDGETS.triggerActionsPerTick + 1);
        last = v;
      }
      expect(performance.now() - t0).toBeLessThan(5000);
      expect(warnings.some((w) => /map budget/.test(w))).toBe(true);
    } finally {
      console.warn = warn;
    }
  });
});

describe('runtime caps', () => {
  it('keeps NPCs alive at once within the map-wide budget', () => {
    const map = makeMap(
      [
        { id: 'room_a', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 },
        { id: 'room_b', tile: 'core.room', x: 1, y: 0, z: 0, rotation: 0 },
      ],
      [[-2, 0, 0]],
    );
    for (let i = 0; i < 4; i++) {
      map.entities.push({
        id: `enc_${i}`,
        kind: 'encounter',
        position: [8, 0, 0],
        yaw: 0,
        faction: 'syndicate',
        roster: { trooper: 16, gunner: 0, heavy: 0 },
        activeCap: 32,
        reinforcements: 100,
        perPlayer: 0,
        respawnSeconds: 0.5,
        radius: 3,
        order: 'hold',
        orderTarget: null,
        startActive: true,
        difficulty: 'easy',
      } as EncounterEntity);
    }
    const loaded = loadMap(map);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.issues));
    const warn = console.warn;
    console.warn = () => undefined;
    try {
      const match = new Match(loaded.map, undefined, 1);
      match.addHuman('me');
      let most = 0;
      for (let i = 0; i < 400; i++) {
        match.step();
        most = Math.max(most, [...match.npcs.values()].filter((c) => c.alive).length);
      }
      expect(most).toBeGreaterThan(32);
      expect(most).toBeLessThanOrEqual(RESOURCE_BUDGETS.activeNpcs);
    } finally {
      console.warn = warn;
    }
  });
});

describe('map identity', () => {
  it('hashes with a standard SHA-256', () => {
    for (const s of ['', 'abc', 'x'.repeat(1000), 'Pläyer ✓']) {
      expect(sha256Hex(new TextEncoder().encode(s))).toBe(createHash('sha256').update(s).digest('hex'));
    }
  });

  it('hashes content, not key order, whitespace or the picture', () => {
    const map = loadArena();
    const h = mapContentHash(map);
    expect(h).toMatch(/^sha256:[0-9a-f]{64}$/);
    const reverse = (v: unknown): unknown => (Array.isArray(v) ? v.map(reverse) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).reverse().map(([k, x]) => [k, reverse(x)])) : v);
    const shuffled = reverse(map) as MapDocument;
    expect(JSON.stringify(shuffled)).not.toBe(JSON.stringify(map));
    expect(mapContentHash(shuffled)).toBe(h);
    expect(mapContentHash({ ...map, metadata: { ...map.metadata, thumbnail: 'data:image/jpeg;base64,AAAA' } })).toBe(h);
    expect(mapContentHash({ ...map, metadata: { ...map.metadata, name: 'Other' } })).not.toBe(h);
    expect(canonicalJson({ b: 1, a: [1, { d: 2, c: 3 }] })).toBe('{"a":[1,{"c":3,"d":2}],"b":1}');
  });

  it('stamps a map ID once and a new version only when the content changes', () => {
    const map = loadArena();
    expect(map.metadata.release).toBeUndefined();
    const v1 = stampMapRelease(map);
    const r1 = v1.metadata.release!;
    expect(r1.mapId).toMatch(/^m_[a-z2-7]{16}$/);
    expect(r1.versionId).toMatch(/^v_[a-z2-7]{16}$/);
    expect(r1.revision).toBe(1);
    // It survives a save and load (backwards compatible: no format change).
    const back = loadMap(JSON.stringify(v1));
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.map.metadata.release).toEqual(r1);
    expect(stampMapRelease(back.map).metadata.release).toEqual(r1);
    const edited = { ...back.map, metadata: { ...back.map.metadata, description: 'changed' } };
    expect(loadMap(edited).issues.some((i) => i.code === 'release.changed')).toBe(true);
    const r2 = stampMapRelease(edited).metadata.release!;
    expect(r2.mapId).toBe(r1.mapId);
    expect(r2.versionId).not.toBe(r1.versionId);
    expect(r2.revision).toBe(2);
    expect(r2.contentHash).not.toBe(r1.contentHash);
  });

  it('gives unstamped maps an identity derived from their content', () => {
    const map = loadArena();
    const id = mapIdentity(map);
    expect(id).toMatchObject({ mapId: map.metadata.id, stamped: false });
    expect(id.versionId).toBe(derivedVersionId(id.contentHash));
    expect(id.versionId).toMatch(/^v_[a-z2-7]{16}$/);
    const stamped = stampMapRelease(map);
    expect(mapIdentity(stamped)).toMatchObject({ mapId: stamped.metadata.release!.mapId, versionId: stamped.metadata.release!.versionId, stamped: true });
  });
});
