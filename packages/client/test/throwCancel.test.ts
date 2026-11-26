import { beforeAll, describe, expect, it } from 'vitest';
import { BUTTON_THROW } from '@tiletrigger/shared';

// Cancel a throw by switching weapon (owner, 2026-11-25): G held aims a throw, letting go throws; a weapon switch in
// between (session.ts requestWeapon calls cancelThrow) cancels it, so letting go sends no throw at all.
beforeAll(() => {
  const g = globalThis as unknown as Record<string, unknown>;
  g.window ??= new EventTarget();
  g.document ??= Object.assign(new EventTarget(), { pointerLockElement: null });
});

const key = (type: 'keydown' | 'keyup', code: string) => window.dispatchEvent(Object.assign(new Event(type), { code, repeat: false, metaKey: false, ctrlKey: false }));

async function make() {
  const { InputState } = await import('../src/game/input.ts');
  const input = new InputState(new EventTarget() as unknown as HTMLCanvasElement);
  input.setTouchEngaged(true);
  return input;
}
const throws = (input: Awaited<ReturnType<typeof make>>) => (input.sample().buttons & BUTTON_THROW) !== 0;

describe('cancelling a throw by switching weapon', () => {
  it('G held then let go throws once', async () => {
    const input = await make();
    key('keydown', 'KeyG');
    expect(input.throwAiming).toBe(true);
    expect(throws(input)).toBe(false);
    key('keyup', 'KeyG');
    expect(throws(input)).toBe(true);
    expect(throws(input)).toBe(false);
    input.dispose();
  });

  it('a switch while G is held cancels: the arc goes, and letting go throws nothing', async () => {
    const input = await make();
    key('keydown', 'KeyG');
    input.cancelThrow();
    expect(input.throwAiming).toBe(false);
    key('keyup', 'KeyG');
    expect(throws(input)).toBe(false);
    // The next press aims afresh.
    key('keydown', 'KeyG');
    key('keyup', 'KeyG');
    expect(throws(input)).toBe(true);
    input.dispose();
  });

  it('a throw already let go still goes', async () => {
    const input = await make();
    key('keydown', 'KeyG');
    key('keyup', 'KeyG');
    input.cancelThrow();
    expect(throws(input)).toBe(true);
    input.dispose();
  });
});
