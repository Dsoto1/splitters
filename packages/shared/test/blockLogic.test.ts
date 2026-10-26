import { beforeAll, describe, expect, it } from 'vitest';
import { BUTTON_USE, TICK_RATE, blockBoxes, dynamicBlockIds, initPhysics, validateMap } from '../src/index.ts';
import { initNavigation } from '../src/match.ts';
import { act, block, button, codes, cond, loaded, rule, start, twoRooms } from './kit20.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

/** Press the button at (2, 0, -3) from just north of it. */
function press(d: ReturnType<typeof start>): void {
  const p = { ...d.me.move.pos };
  d.place(2, 0, -1.6, Math.PI);
  d.input({ yaw: Math.PI, pitch: -0.2, buttons: BUTTON_USE });
  d.place(p.x, p.y, p.z);
}

describe('logic targeting blocks', () => {
  it('a lever springs a logic-only trapdoor (no validator warnings) and a rule rebuilds it', () => {
    const map = twoRooms([block('trap_1', [-1, 1, 1], { size: [2, 0.5, 2], behaviour: 'trapdoor', trigger: 'logic', respawnSeconds: null }), button('button_1', [2, 0, -3])], {
      variables: [{ id: 'var_n', name: 'presses', initial: 0 }],
      rules: [
        // Second press rebuilds it (listed first, so the first press's drop doesn't set it off at once).
        rule({ when: { event: 'button_pressed', target: 'button_1' }, if: [cond('variable', { target: 'var_n', op: '==', value: 1 }), cond('block', { target: 'trap_1', state: 'gone' })], do: [act('wait', { value: 0.1 }), act('block_restore', { target: 'trap_1' }), act('add_var', { target: 'var_n', value: 1 })] }),
        rule({ when: { event: 'button_pressed', target: 'button_1' }, if: [cond('block', { target: 'trap_1', state: 'present' })], do: [act('block_drop', { target: 'trap_1' }), act('add_var', { target: 'var_n', value: 1 })] }),
      ],
    });
    expect(codes(validateMap(loaded(map)))).toEqual([]);
    const d = start(map);
    // Standing on it: it holds (logic-only trapdoors ignore feet).
    d.place(-1, 1.5, 1);
    d.run(TICK_RATE);
    expect(d.me.move.pos.y).toBeGreaterThan(1.4);
    press(d);
    expect(d.match.scenario.destructibleAlive('trap_1')).toBe(false);
    d.run(TICK_RATE);
    expect(d.me.move.pos.y).toBeLessThan(0.1);
    // Second press: rebuilt (nobody in the way now).
    d.place(-3, 0, 2);
    press(d);
    d.run(12);
    expect(d.match.scenario.destructibleAlive('trap_1')).toBe(true);
    expect(d.match.scenario.variable('var_n')).toBe(2);
  });

  it('"Destroy" on a crumbling block is legal too, and logic-only blocks nobody drops are flagged', () => {
    const ok = twoRooms([block('floor_1', [-1, 1, 1], { behaviour: 'crumble', trigger: 'logic' }), button('button_1', [2, 0, -3])], {
      rules: [rule({ when: { event: 'button_pressed', target: 'button_1' }, do: [act('destroy', { target: 'floor_1' })] })],
    });
    expect(codes(validateMap(loaded(ok)))).toEqual([]);
    const stuck = twoRooms([block('floor_1', [-1, 1, 1], { behaviour: 'crumble', trigger: 'logic' })]);
    expect(codes(validateMap(loaded(stuck)))).toContain('block.never_drops');
  });

  it('solid blocks a rule targets leave the static level and can be switched off and on', () => {
    const map = twoRooms([block('shelf_1', [-1, 1, 1], { size: [2, 0.5, 2] }), block('static_1', [-2, 2, -2], { size: [1, 0.5, 1] }), button('button_1', [2, 0, -3])], {
      rules: [rule({ when: { event: 'button_pressed', target: 'button_1' }, do: [act('disable', { target: 'shelf_1' }), act('wait', { value: 1 }), act('enable', { target: 'shelf_1' })] })],
    });
    const doc = loaded(map);
    expect(codes(validateMap(doc))).toEqual([]);
    expect([...dynamicBlockIds(doc)]).toEqual(['shelf_1']);
    expect(blockBoxes(doc).map((b) => b.sourceId)).toEqual(['static_1']);
    // Navigation sees it in its idle (present) state.
    expect(blockBoxes(doc, true).map((b) => b.sourceId)).toEqual(['shelf_1']);
    const d = start(map);
    d.place(-1, 1.5, 1);
    d.run(10);
    expect(d.me.move.pos.y).toBeGreaterThan(1.4);
    press(d);
    d.run(TICK_RATE / 2);
    expect(d.me.move.pos.y).toBeLessThan(0.1);
    expect(d.match.scenario.destructibleAlive('shelf_1')).toBe(false);
    // Hidden solid blocks don't come back by themselves; the rule's enable does (once nobody is in the way).
    d.place(-3, 0, 3);
    d.run(TICK_RATE);
    expect(d.match.scenario.destructibleAlive('shelf_1')).toBe(true);
  });

  it('blocks that start hidden appear on cue, are absent for navigation, and must be shown by some rule', () => {
    const map = twoRooms([block('bridge_1', [-1, 1, 1], { startHidden: true }), button('button_1', [2, 0, -3])], {
      rules: [rule({ when: { event: 'button_pressed', target: 'button_1' }, do: [act('block_restore', { target: 'bridge_1' })] })],
    });
    const doc = loaded(map);
    expect(codes(validateMap(doc))).toEqual([]);
    expect(blockBoxes(doc, true)).toEqual([]);
    const d = start(map);
    expect(d.match.scenario.destructibleAlive('bridge_1')).toBe(false);
    d.place(-3, 0, 3);
    press(d);
    expect(d.match.scenario.destructibleAlive('bridge_1')).toBe(true);

    const never = twoRooms([block('bridge_1', [-1, 1, 1], { startHidden: true })]);
    expect(codes(validateMap(loaded(never)))).toContain('block.never_appears');
  });
});
