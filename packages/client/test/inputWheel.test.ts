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

  it('hold Tab opens the wheel; a tap of Tab shows the scoreboard (another hides it); X goes back to the last weapon', async () => {
    clock();
    const input = await make();
    const quick = vi.fn();
    input.onAction.set('lastWeapon', quick);
    key('keydown', 'Tab');
    now += 60;
    input.frame(1 / 60);
    key('keyup', 'Tab');
    expect(input.wheelOpen).toBe(false);
    expect(input.scoreboardShown).toBe(true);
    key('keydown', 'Tab');
    now += 250;
    input.frame(1 / 60);
    expect(input.wheelOpen).toBe(true);
    key('keyup', 'Tab');
    expect(input.takeWheelClose()).toBe(true);
    // The hold didn't touch the board; a second tap hides it.
    expect(input.scoreboardShown).toBe(true);
    key('keydown', 'Tab');
    now += 50;
    key('keyup', 'Tab');
    expect(input.scoreboardShown).toBe(false);
    // While the wheel can't open (dead, in a vehicle) Tab held shows the board, and a long hold isn't a tap.
    input.canOpenWheel = false;
    key('keydown', 'Tab');
    expect(input.scoreboardShown).toBe(true);
    now += 900;
    key('keyup', 'Tab');
    expect(input.scoreboardShown).toBe(false);
    input.canOpenWheel = true;
    key('keydown', 'KeyX');
    key('keyup', 'KeyX');
    expect(quick).toHaveBeenCalledTimes(1);
    input.dispose();
  });

  it('V is Dodge: sent once per press (a key held sends it no more), not in a vehicle', async () => {
    const { BUTTON_DODGE, BUTTON_ALT } = await import('@tiletrigger/shared');
    const input = await make();
    key('keydown', 'KeyV');
    const first = input.sample().buttons;
    expect(first & BUTTON_DODGE).toBe(BUTTON_DODGE);
    expect(first & BUTTON_ALT).toBe(0);
    expect(input.sample().buttons & BUTTON_DODGE).toBe(0);
    key('keyup', 'KeyV');
    input.inVehicle = true;
    key('keydown', 'KeyV');
    expect(input.sample().buttons & BUTTON_DODGE).toBe(0);
    key('keyup', 'KeyV');
    input.dispose();
  });

  it('Q and E lean, held; F uses; in a vehicle Space and C are the vehicle\'s keys', async () => {
    const { BUTTON_LEAN_LEFT, BUTTON_LEAN_RIGHT, BUTTON_USE, BUTTON_USE_HOLD } = await import('@tiletrigger/shared');
    const input = await make();
    key('keydown', 'KeyQ');
    expect(input.sample().buttons & (BUTTON_LEAN_LEFT | BUTTON_LEAN_RIGHT)).toBe(BUTTON_LEAN_LEFT);
    key('keydown', 'KeyE');
    expect(input.sample().buttons & (BUTTON_LEAN_LEFT | BUTTON_LEAN_RIGHT)).toBe(BUTTON_LEAN_LEFT | BUTTON_LEAN_RIGHT);
    key('keyup', 'KeyQ');
    key('keyup', 'KeyE');
    expect(input.sample().buttons & (BUTTON_LEAN_LEFT | BUTTON_LEAN_RIGHT)).toBe(0);
    key('keydown', 'KeyF');
    expect(input.sample().buttons & (BUTTON_USE | BUTTON_USE_HOLD)).toBe(BUTTON_USE | BUTTON_USE_HOLD);
    key('keyup', 'KeyF');
    expect(input.sample().buttons & BUTTON_FIRE).toBe(0);
    // Seated: C is held down (not the crouch toggle), Space held climbs or brakes.
    input.inVehicle = true;
    key('keydown', 'KeyC');
    expect(input.sample().buttons & BUTTON_CROUCH).toBe(BUTTON_CROUCH);
    key('keyup', 'KeyC');
    expect(input.sample().buttons & BUTTON_CROUCH).toBe(0);
    key('keydown', 'Space');
    input.sample();
    expect(input.sample().buttons & BUTTON_JUMP).toBe(BUTTON_JUMP);
    key('keyup', 'Space');
    expect(input.sample().buttons & BUTTON_JUMP).toBe(0);
    input.inVehicle = false;
    input.dispose();
  });

  it('a rebind takes effect at once (Options → Controls while a match runs)', async () => {
    const { BUTTON_LEAN_LEFT } = await import('@tiletrigger/shared');
    const { defaultBindings, setKey } = await import('../src/game/keyBindings.ts');
    const input = await make();
    input.setBindings(setKey(defaultBindings(), 'leanLeft', 0, 'KeyP'));
    key('keydown', 'KeyQ');
    expect(input.sample().buttons & BUTTON_LEAN_LEFT).toBe(0);
    key('keyup', 'KeyQ');
    key('keydown', 'KeyP');
    expect(input.sample().buttons & BUTTON_LEAN_LEFT).toBe(BUTTON_LEAN_LEFT);
    key('keyup', 'KeyP');
    input.setBindings(defaultBindings());
    input.dispose();
  });

  it('holds fire back while open, and the view stays put while the wheel is pointed', async () => {
    clock();
    const input = await make();
    input.openWheel('touch');
    key('keydown', 'AltLeft');
    expect(input.sample().buttons & BUTTON_FIRE).toBe(0);
    const yaw = input.yaw;
    input.addTouchLook(200, 0);
    input.frame(1 / 60);
    expect(input.yaw).toBe(yaw);
    input.closeWheel(false);
    expect(input.takeWheelClose()).toBe(false);
    expect(input.sample().buttons & BUTTON_FIRE).toBe(BUTTON_FIRE);
    key('keyup', 'AltLeft');
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
  it('feeds the same path as the keyboard: the pad moves, a drag looks, virtual actions jump and crouch', async () => {
    const input = await make();
    input.setTouchMove(0.5, 1);
    input.virtualAction('jump', true);
    input.virtualAction('jump', false);
    const s = input.sample();
    expect(s.forward).toBe(1);
    expect(s.right).toBe(0.5);
    expect(s.buttons & BUTTON_JUMP).toBe(BUTTON_JUMP);
    input.virtualAction('crouch', true);
    input.virtualAction('crouch', false);
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

describe('touch pad tap read late as a hold', () => {
  it('stands back up on the next tick and jumps on the one after (a jump pressed while crouched only stands you up)', async () => {
    const input = await make();
    // The hold timer ran before the lift was handled: crouched…
    input.virtualAction('crouch', true);
    input.virtualAction('crouch', false);
    expect(input.sample().buttons & BUTTON_CROUCH).toBe(BUTTON_CROUCH);
    // …then the lift: a tap after all. Uncrouch, and the jump waits a tick.
    input.virtualAction('crouch', true);
    input.virtualAction('crouch', false);
    input.jumpAfterStanding();
    expect(input.sample().buttons & (BUTTON_CROUCH | BUTTON_JUMP)).toBe(0);
    expect(input.sample().buttons & BUTTON_JUMP).toBe(BUTTON_JUMP);
    expect(input.sample().buttons & BUTTON_JUMP).toBe(0);
    input.dispose();
  });
});

describe('Fireteams order wheel input', () => {
  let now = 1000;
  afterEach(() => vi.restoreAllMocks());
  const clock = () => vi.spyOn(performance, 'now').mockImplementation(() => now);

  it('leading a squad, a tap of B is still the quick-message menu; holding it opens the order wheel, letting go gives the order', async () => {
    clock();
    const { orderSay } = await import('@tiletrigger/shared');
    const input = await make();
    input.ordersOn = true;
    key('keydown', 'KeyB');
    now += 60;
    input.frame(1 / 60);
    key('keyup', 'KeyB');
    expect(input.msgMenu).toBe(true);
    expect(input.wheelOpen).toBe(false);
    key('keydown', 'KeyB');
    key('keyup', 'KeyB');
    expect(input.msgMenu).toBe(false);
    // Held: the order wheel (closing any menu), not the weapon wheel.
    key('keydown', 'KeyB');
    now += 250;
    input.frame(1 / 60);
    expect(input.wheelOpen).toBe(true);
    expect(input.wheelKind).toBe('order');
    key('keyup', 'KeyB');
    expect(input.wheelOpen).toBe(false);
    expect(input.msgMenu).toBe(false);
    expect(input.takeWheelClose()).toBeNull();
    expect(input.takeOrderClose()).toBe(true);
    // The session queues the order picked: it goes with the next input.
    input.queueSay(orderSay('hold'));
    expect(input.sample().say).toBe(orderSay('hold'));
    input.dispose();
  });

  it('not leading a squad, B is the menu at once and never opens the order wheel', async () => {
    clock();
    const input = await make();
    key('keydown', 'KeyB');
    expect(input.msgMenu).toBe(true);
    now += 400;
    input.frame(1 / 60);
    expect(input.wheelOpen).toBe(false);
    key('keyup', 'KeyB');
    expect(input.msgMenu).toBe(true);
    expect(input.openWheel('touch', 'order')).toBe(false);
    input.dispose();
  });

  it('the weapon wheel key does not close the order wheel (one wheel at a time)', async () => {
    clock();
    const input = await make();
    input.ordersOn = true;
    expect(input.openWheel('touch', 'order')).toBe(true);
    expect(input.openWheel('key')).toBe(false);
    key('keydown', 'Tab');
    key('keyup', 'Tab');
    expect(input.wheelOpen).toBe(true);
    input.closeWheel(false);
    expect(input.takeOrderClose()).toBe(false);
    input.dispose();
  });
});
