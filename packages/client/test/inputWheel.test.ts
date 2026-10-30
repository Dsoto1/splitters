import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { BUTTON_CROUCH, BUTTON_FIRE, BUTTON_JUMP, CORE_WEAPONS, weaponByCode } from '@tiletrigger/shared';

// InputState listens on window and document: a bare EventTarget for each is enough here.
beforeAll(() => {
  const g = globalThis as unknown as Record<string, unknown>;
  g.window ??= new EventTarget();
  g.document ??= Object.assign(new EventTarget(), { pointerLockElement: null });
});

const key = (type: 'keydown' | 'keyup', code: string) => window.dispatchEvent(Object.assign(new Event(type), { code, repeat: false, metaKey: false, ctrlKey: false }));

async function make() {
  const { InputState } = await import('../src/game/input.ts');
  const input = new InputState(new EventTarget() as unknown as HTMLCanvasElement);
  input.wheelKey = 'KeyQ';
  input.setTouchEngaged(true);
  return input;
}

const scroll = (deltaY: number, deltaMode: number, t: number) => {
  const e = Object.assign(new Event('wheel'), { deltaY, deltaMode });
  Object.defineProperty(e, 'timeStamp', { value: t });
  window.dispatchEvent(e);
};

describe('scrolling through weapons', () => {
  it('one step per wheel notch, and a trackpad flick of many small events is a step or two, not one per event', async () => {
    const input = await make();
    scroll(3, 1, 100);
    expect(input.takeWheel()).toBe(1);
    // 30 events of 4 px, 8 ms apart: 120 px in a quarter of a second used to be 30 steps.
    for (let i = 0; i < 30; i++) scroll(4, 0, 1000 + i * 8);
    const steps = input.takeWheel();
    expect(steps).toBeGreaterThanOrEqual(1);
    expect(steps).toBeLessThanOrEqual(2);
    // Back the other way.
    scroll(-120, 0, 2000);
    expect(input.takeWheel()).toBe(-1);
    input.dispose();
  });
});

describe('weapon wheel input', () => {
  let now = 1000;
  afterEach(() => vi.restoreAllMocks());
  const clock = () => vi.spyOn(performance, 'now').mockImplementation(() => now);

  it('a tap of Q is still the quick switch; holding it opens the wheel', async () => {
    clock();
    const input = await make();
    const quick = vi.fn();
    input.onToggle.set('KeyQ', quick);
    key('keydown', 'KeyQ');
    now += 60;
    input.frame(1 / 60);
    key('keyup', 'KeyQ');
    expect(quick).toHaveBeenCalledTimes(1);
    expect(input.wheelOpen).toBe(false);
    key('keydown', 'KeyQ');
    now += 250;
    input.frame(1 / 60);
    expect(input.wheelOpen).toBe(true);
    key('keyup', 'KeyQ');
    expect(quick).toHaveBeenCalledTimes(1);
    expect(input.takeWheelClose()).toBe(true);
    input.dispose();
  });

  it('holds fire back while open, and the view stays put while the wheel is pointed', async () => {
    clock();
    const input = await make();
    input.openWheel('touch');
    key('keydown', 'KeyF');
    expect(input.sample().buttons & BUTTON_FIRE).toBe(0);
    const yaw = input.yaw;
    input.addTouchLook(200, 0);
    input.frame(1 / 60);
    expect(input.yaw).toBe(yaw);
    input.closeWheel(false);
    expect(input.takeWheelClose()).toBe(false);
    expect(input.sample().buttons & BUTTON_FIRE).toBe(BUTTON_FIRE);
    key('keyup', 'KeyF');
    input.dispose();
  });

  it("won't open when the session says no (dead, in a vehicle)", async () => {
    const input = await make();
    input.canOpenWheel = false;
    input.openWheel('pad');
    expect(input.wheelOpen).toBe(false);
    input.dispose();
  });
});

describe('touch input', () => {
  it('feeds the same path as the keyboard: the pad moves, a drag looks, virtual keys jump and crouch', async () => {
    const input = await make();
    input.setTouchMove(0.5, 1);
    input.virtualKey('Space', true);
    input.virtualKey('Space', false);
    const s = input.sample();
    expect(s.forward).toBe(1);
    expect(s.right).toBe(0.5);
    expect(s.buttons & BUTTON_JUMP).toBe(BUTTON_JUMP);
    input.virtualKey('KeyC', true);
    input.virtualKey('KeyC', false);
    expect(input.sample().buttons & BUTTON_CROUCH).toBe(BUTTON_CROUCH);
    const yaw = input.yaw;
    input.addTouchLook(100, 0);
    input.frame(1 / 60);
    expect(input.yaw).toBeGreaterThan(yaw);
    // Pausing lets go of everything.
    input.setTouchEngaged(false);
    expect(input.sample()).toEqual({ forward: 0, right: 0, buttons: 0 });
    input.dispose();
  });
});

describe('wheelEntries', () => {
  it('shows ammo, marks the held weapon and dims an empty one', async () => {
    const { wheelEntries } = await import('../src/game/weaponWheel.ts');
    const codes = [1, 2];
    const knife = weaponByCode(1)!;
    const pistol = weaponByCode(2)!;
    expect(knife.magazine).toBe(0);
    expect(CORE_WEAPONS[pistol.id]).toBeTruthy();
    const inv = new Map<number, [number, number, number, number]>([
      [1, [0, 0, 0, 0]],
      [2, [0, 0, 0, 0]],
    ]);
    const e = wheelEntries(codes, inv, 1);
    expect(e.map((x) => [x.name, x.ammo, x.empty, x.held])).toEqual([
      [knife.displayName, '∞', false, true],
      [pistol.displayName, '0 / 0', true, false],
    ]);
  });
});
