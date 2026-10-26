import { beforeAll, describe, expect, it } from 'vitest';
import { BUTTON_USE, LIGHT_FLASH, LIGHT_ON, TICK_RATE, initPhysics, lightBlinkOf, validateMap, type MapEntity } from '../src/index.ts';
import { initNavigation } from '../src/match.ts';
import { act, button, codes, cond, loaded, rule, start, twoRooms } from './kit20.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const lamp = (id: string, extra: Partial<Extract<MapEntity, { kind: 'light' }>> = {}): MapEntity => ({ id, kind: 'light', position: [0, 3.5, 0], yaw: 0, color: '#fff1d6', intensity: 1, range: 10, fixture: 'ceiling', ...extra });

describe('logic-controlled lights', () => {
  it('switch off, on, toggle, recolour, flash and blink from rules; state goes out in snapshots', () => {
    const map = twoRooms([lamp('light_a'), lamp('light_b', { off: true }), button('button_1', [2, 0, -3])], {
      variables: [{ id: 'var_lit', name: 'lit', initial: 0 }],
      rules: [
        rule({ when: { event: 'button_pressed', target: 'button_1' }, do: [act('light_off', { target: 'light_a' }), act('light_toggle', { target: 'light_b' }), act('light_color', { target: 'light_b', text: '#ff2020' }), act('light_flash', { target: 'light_b', value: 0.5 })] }),
        // Conditions see the light's state.
        rule({ when: { event: 'button_pressed', target: 'button_1' }, if: [cond('light', { target: 'light_b', state: 'on' })], do: [act('set_var', { target: 'var_lit', value: 1 })] }),
        rule({ when: { event: 'match_start', target: null }, do: [act('light_blink', { target: 'light_a', state: 'on', value: 4 })] }),
      ],
    });
    expect(codes(validateMap(loaded(map)))).toEqual([]);
    const d = start(map);
    const sc = d.match.scenario;
    // Starts: a on (and blinking from match start), b off.
    expect(sc.lightState('light_a')![0] & LIGHT_ON).toBe(LIGHT_ON);
    expect(lightBlinkOf(sc.lightState('light_a')![0])).toBe(4);
    expect(sc.lightState('light_b')![0] & LIGHT_ON).toBe(0);

    d.place(2, 0, -1.6, Math.PI);
    d.input({ yaw: Math.PI, pitch: -0.2, buttons: BUTTON_USE });
    expect(d.of('use')[0]?.ok).toBe(1);
    expect(sc.lightState('light_a')![0] & LIGHT_ON).toBe(0);
    const [flags, color] = sc.lightState('light_b')!;
    expect(flags & LIGHT_ON).toBe(LIGHT_ON);
    expect(flags & LIGHT_FLASH).toBe(LIGHT_FLASH);
    expect(color).toBe(0xff2020);
    // The second rule ran after the first had switched b on.
    expect(sc.variable('var_lit')).toBe(1);
    d.run(TICK_RATE);
    expect(sc.lightState('light_b')![0] & LIGHT_FLASH).toBe(0);

    // Replicated: both lights are in the full state as [index, flags, colour].
    const full = sc.fullState().es!;
    const b = full.find(([i]) => i === 2)!;
    expect(b[2]).toBe(0xff2020);
    expect(b[1] & LIGHT_ON).toBe(LIGHT_ON);
  });

  it('enable/disable work on lights, and lights nobody drives are not sent', () => {
    const map = twoRooms([lamp('light_a'), lamp('light_static'), button('button_1', [2, 0, -3])], {
      rules: [rule({ when: { event: 'button_pressed', target: 'button_1' }, do: [act('disable', { target: 'light_a' })] })],
    });
    const d = start(map);
    d.place(2, 0, -1.6, Math.PI);
    d.input({ yaw: Math.PI, pitch: -0.2, buttons: BUTTON_USE });
    expect(d.match.scenario.lightState('light_a')![0] & LIGHT_ON).toBe(0);
    const sent = d.match.scenario.fullState().es!.map(([i]) => i);
    expect(sent).toContain(1);
    expect(sent).not.toContain(2);
  });

  it('the validator wants a light for light actions and a colour for "Set light colour"', () => {
    const map = twoRooms([lamp('light_a'), button('button_1', [2, 0, -3])], {
      rules: [
        rule({ when: { event: 'button_pressed', target: 'button_1' }, do: [act('light_color', { target: 'light_a', text: 'red' }), act('light_on', { target: 'button_1' })] }),
      ],
    });
    const issues = codes(validateMap(loaded(map)));
    expect(issues).toContain('logic.color');
    expect(issues).toContain('logic.target_broken');
  });
});
