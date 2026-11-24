import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { BUTTON_CROUCH, BUTTON_LEAN_LEFT, BUTTON_LEAN_RIGHT, BUTTON_PRONE } from '@tiletrigger/shared';

beforeAll(() => {
  const g = globalThis as unknown as Record<string, unknown>;
  g.window ??= new EventTarget();
  g.document ??= Object.assign(new EventTarget(), { pointerLockElement: null });
});

const A = 0, B = 1, LT = 6, LEFT = 14, RIGHT = 15;

describe('controller: d-pad lean while aiming, B for crouch and prone', () => {
  let now = 1000;
  const held = new Set<number>();
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    held.clear();
  });

  async function make() {
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.stubGlobal('navigator', {
      getGamepads: () => [
        { connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: held.has(i), value: held.has(i) ? 1 : 0 })) },
      ],
    });
    const { InputState } = await import('../src/game/input.ts');
    const input = new InputState(new EventTarget() as unknown as HTMLCanvasElement);
    input.setTouchEngaged(true);
    return input;
  }
  /** One frame with these buttons down, `ms` later; returns the sampled buttons. */
  const step = (input: Awaited<ReturnType<typeof make>>, ms: number, ...down: number[]) => {
    now += ms;
    held.clear();
    for (const d of down) held.add(d);
    input.frame(ms / 1000);
    return input.sample().buttons;
  };

  it('LT held: the d-pad leans while held, and no weapon switch comes of it', async () => {
    const input = await make();
    step(input, 16, LT);
    expect(step(input, 16, LT, LEFT) & BUTTON_LEAN_LEFT).toBe(BUTTON_LEAN_LEFT);
    expect(step(input, 16, LT, RIGHT) & BUTTON_LEAN_RIGHT).toBe(BUTTON_LEAN_RIGHT);
    expect(step(input, 16, LT) & (BUTTON_LEAN_LEFT | BUTTON_LEAN_RIGHT)).toBe(0);
    step(input, 16);
    expect(input.takeWheel()).toBe(0);
    input.dispose();
  });

  it('without the aim, left and right are the previous and next weapon, and nothing leans', async () => {
    const input = await make();
    expect(step(input, 16, RIGHT) & (BUTTON_LEAN_LEFT | BUTTON_LEAN_RIGHT)).toBe(0);
    step(input, 16);
    expect(input.takeWheel()).toBe(1);
    step(input, 16, LEFT);
    step(input, 16);
    expect(input.takeWheel()).toBe(-1);
    input.dispose();
  });

  it('LT let go while the d-pad is held: the lean stops and no weapon switch is made', async () => {
    const input = await make();
    step(input, 16, LT);
    step(input, 16, LT, LEFT);
    expect(step(input, 16, LEFT) & BUTTON_LEAN_LEFT).toBe(0);
    step(input, 16);
    expect(input.takeWheel()).toBe(0);
    input.dispose();
  });

  it('the d-pad pressed, then LT: no switch and no lean', async () => {
    const input = await make();
    step(input, 16, RIGHT);
    expect(step(input, 16, RIGHT, LT) & BUTTON_LEAN_RIGHT).toBe(0);
    step(input, 16, LT);
    step(input, 16);
    expect(input.takeWheel()).toBe(0);
    input.dispose();
  });

  it('toggled aim counts as aiming', async () => {
    const { saveCombatPrefs } = await import('../src/game/combatPrefs.ts');
    saveCombatPrefs({ aim: 'toggle' });
    const input = await make();
    step(input, 16, LT);
    step(input, 16); // LT let go, the aim stays on
    expect(step(input, 16, RIGHT) & BUTTON_LEAN_RIGHT).toBe(BUTTON_LEAN_RIGHT);
    step(input, 16);
    expect(input.takeWheel()).toBe(0);
    input.dispose();
    saveCombatPrefs({ aim: 'hold' });
  });

  it('a tap of B is crouch, held 0.4 s it is prone, and A stands you up', async () => {
    const input = await make();
    step(input, 16, B);
    expect(step(input, 100, B)).toBe(0);
    expect(step(input, 16) & BUTTON_CROUCH).toBe(BUTTON_CROUCH);
    expect(step(input, 16, B) & BUTTON_CROUCH).toBe(BUTTON_CROUCH);
    step(input, 16);
    expect(step(input, 16) & BUTTON_CROUCH).toBe(0);
    step(input, 16, B);
    step(input, 450, B);
    const b = step(input, 16, B);
    expect(b & BUTTON_PRONE).toBe(BUTTON_PRONE);
    expect(b & BUTTON_CROUCH).toBe(0);
    // Let go: stays prone (not a crouch toggle on top).
    expect(step(input, 16) & BUTTON_PRONE).toBe(BUTTON_PRONE);
    step(input, 16, A);
    expect(step(input, 16) & BUTTON_PRONE).toBe(0);
    input.dispose();
  });

  it('a pad without the standard layout is told once; a standard pad says nothing', async () => {
    const input = await make();
    const notes: string[] = [];
    input.onNotice = (t) => notes.push(t);
    vi.stubGlobal('navigator', { getGamepads: () => [{ id: 'odd pad', connected: true, mapping: '', axes: [], buttons: [] }] });
    input.checkPadMapping();
    input.checkPadMapping();
    input.frame(0.016);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toContain('standard layout');
    vi.stubGlobal('navigator', { getGamepads: () => [{ id: 'good', connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: [] }] });
    input.checkPadMapping();
    expect(notes).toHaveLength(1);
    input.dispose();
  });
});
