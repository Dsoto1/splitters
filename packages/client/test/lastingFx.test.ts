import { describe, expect, it } from 'vitest';
import type { GodotVfx, VfxHandle, VfxOptions } from '../src/game/godotVfx.ts';
import { LastingFx } from '../src/game/lastingFx.ts';

/** A stand-in for GodotVfx: `cap` lasting effects at once, each a handle that records what was done to it. */
function fakeVfx(cap: number) {
  const live: { at: { x: number }; level: number; stopped: boolean; steady: boolean; opts: VfxOptions }[] = [];
  const vfx = {
    get loopRoom() {
      return Math.max(0, cap - live.filter((l) => !l.stopped).length);
    },
    start(_pack: string, _effect: string, at: { x: number }, opts: VfxOptions = {}) {
      if (live.filter((l) => !l.stopped).length >= cap) return null;
      const l = { at: { x: at.x }, level: 0, stopped: false, steady: !!opts.steady, opts };
      live.push(l);
      const h: VfxHandle = {
        move: (to) => void (l.at.x = to.x),
        setLevel: (v) => void (l.level = v),
        stop: () => void (l.stopped = true),
        get done() {
          return l.stopped;
        },
      };
      return h;
    },
  };
  return { vfx: vfx as unknown as GodotVfx, live };
}

describe('lasting effects (lastingFx.ts)', () => {
  it('draws the nearest wanted ones up to the cap, and hands a place on when a nearer one appears', () => {
    const { vfx, live } = fakeVfx(2);
    const fx = new LastingFx(vfx);
    const cam = { x: 0, y: 0, z: 0 };
    fx.want('a', 'fire.zone', { x: 30, y: 0, z: 0 });
    fx.want('b', 'fire.zone', { x: 10, y: 0, z: 0 });
    fx.want('c', 'fire.zone', { x: 20, y: 0, z: 0 });
    fx.update(cam);
    expect([fx.drawn('a'), fx.drawn('b'), fx.drawn('c')]).toEqual([false, true, true]);
    // A nearer one: the farthest drawn gives its place up.
    fx.want('d', 'fire.zone', { x: 5, y: 0, z: 0 });
    fx.want('b', 'fire.zone', { x: 10, y: 0, z: 0 });
    fx.want('c', 'fire.zone', { x: 20, y: 0, z: 0 });
    fx.update(cam);
    fx.update(cam);
    expect(fx.drawn('d') && fx.drawn('b') && !fx.drawn('c')).toBe(true);
    expect(live.filter((l) => !l.stopped).length).toBeLessThanOrEqual(2);
  });

  it('moves a drawn effect rather than remaking it, and stops what is no longer asked for', async () => {
    const { vfx, live } = fakeVfx(4);
    const fx = new LastingFx(vfx);
    fx.want('a', 'fire.zone', { x: 1, y: 0, z: 0 }, { level: 0.5 });
    fx.update({ x: 0, y: 0, z: 0 });
    fx.want('a', 'fire.zone', { x: 2, y: 0, z: 0 });
    fx.update({ x: 0, y: 0, z: 0 });
    expect(live.length).toBe(1);
    expect(live[0]!.at.x).toBe(2);
    expect(live[0]!.level).toBe(1);
    await new Promise((r) => setTimeout(r, 350));
    fx.update({ x: 0, y: 0, z: 0 });
    expect(fx.drawn('a')).toBe(false);
    expect(live[0]!.stopped).toBe(true);
  });

  it('hands places to decor (fire props) only after every other lasting effect', () => {
    const { vfx } = fakeVfx(2);
    const fx = new LastingFx(vfx);
    const cam = { x: 0, y: 0, z: 0 };
    fx.want('torch1', 'flame.torch', { x: 1, y: 0, z: 0 });
    fx.want('torch2', 'flame.torch', { x: 2, y: 0, z: 0 });
    fx.want('torch3', 'flame.torch', { x: 3, y: 0, z: 0 });
    fx.update(cam);
    expect([fx.drawn('torch1'), fx.drawn('torch2'), fx.drawn('torch3')]).toEqual([true, true, false]);
    // A burning patch 40 m off takes the farther torch's place.
    fx.want('torch1', 'flame.torch', { x: 1, y: 0, z: 0 });
    fx.want('torch2', 'flame.torch', { x: 2, y: 0, z: 0 });
    fx.want('torch3', 'flame.torch', { x: 3, y: 0, z: 0 });
    fx.want('patch', 'fire.zone', { x: 40, y: 0, z: 0 });
    fx.update(cam);
    fx.update(cam);
    expect([fx.drawn('patch'), fx.drawn('torch1'), fx.drawn('torch2')]).toEqual([true, true, false]);
  });

  it("gives pickups' glows at most half the places, and only what gameplay effects leave", () => {
    const { vfx } = fakeVfx(4);
    const fx = new LastingFx(vfx);
    const cam = { x: 0, y: 0, z: 0 };
    const ask = (fire: boolean) => {
      for (let i = 1; i <= 4; i++) fx.want(`loot${i}`, 'loot.health', { x: i, y: 0, z: 0 });
      fx.want('torch', 'flame.torch', { x: 20, y: 0, z: 0 });
      if (fire) for (let i = 1; i <= 3; i++) fx.want(`fire${i}`, 'fire.zone', { x: 30 + i, y: 0, z: 0 });
    };
    ask(false);
    fx.update(cam);
    // Four places: the two nearest glows, and the torch (the other two glows don't take the free place).
    expect([1, 2, 3, 4].map((i) => fx.drawn(`loot${i}`))).toEqual([true, true, false, false]);
    expect(fx.drawn('torch')).toBe(true);
    expect(fx.count).toBe(3);
    // Three fires further off than any of them: they come first, and one glow keeps the place left.
    ask(true);
    fx.update(cam);
    ask(true);
    fx.update(cam);
    expect([1, 2, 3].every((i) => fx.drawn(`fire${i}`))).toBe(true);
    expect([1, 2, 3, 4].map((i) => fx.drawn(`loot${i}`))).toEqual([true, false, false, false]);
    expect(fx.drawn('torch')).toBe(false);
  });

  it('places portals and jump pads after the effects of the moment and before every decoration', () => {
    const { vfx } = fakeVfx(4);
    const fx = new LastingFx(vfx);
    const cam = { x: 0, y: 0, z: 0 };
    const ask = () => {
      // Glows and a prop flame right at your feet, a pad and a portal further off, fires further still.
      fx.want('glow1', 'loot.weapon', { x: 1, y: 0, z: 0 });
      fx.want('glow2', 'loot.health', { x: 2, y: 0, z: 0 });
      fx.want('torch', 'flame.torch', { x: 3, y: 0, z: 0 });
      fx.want('pad', 'pad', { x: 20, y: 0, z: 0 });
      fx.want('portal', 'portal', { x: 30, y: 0, z: 0 });
      fx.want('fire1', 'fire.zone', { x: 50, y: 0, z: 0 });
      fx.want('fire2', 'fire.zone', { x: 60, y: 0, z: 0 });
    };
    ask();
    fx.update(cam);
    // Four places: both fires, then the pad and the portal; no glow, no torch.
    expect(['fire1', 'fire2', 'pad', 'portal', 'glow1', 'glow2', 'torch'].map((id) => fx.drawn(id))).toEqual([true, true, true, true, false, false, false]);
    // The fires go out: the glows (half the places at most) and the torch get what the fixtures leave.
    fx.dispose();
    fx.want('glow1', 'loot.weapon', { x: 1, y: 0, z: 0 });
    fx.want('glow2', 'loot.health', { x: 2, y: 0, z: 0 });
    fx.want('torch', 'flame.torch', { x: 3, y: 0, z: 0 });
    fx.want('pad', 'pad', { x: 20, y: 0, z: 0 });
    fx.want('portal', 'portal', { x: 30, y: 0, z: 0 });
    fx.update(cam);
    expect(fx.drawn('pad') && fx.drawn('portal')).toBe(true);
    expect(['glow1', 'glow2', 'torch'].filter((id) => fx.drawn(id)).length).toBe(2);
  });

  it("keeps to a request's own range, hands on its turn, colour and fit, and starts again when the colour changes", () => {
    const { vfx, live } = fakeVfx(4);
    const fx = new LastingFx(vfx);
    const cam = { x: 0, y: 0, z: 0 };
    fx.want('far', 'pad', { x: 40, y: 0, z: 0 }, { range: 36 });
    fx.want('near', 'pad', { x: 30, y: 0, z: 0 }, { range: 36 });
    fx.want('gate', 'portal', { x: 5, y: 0, z: 0 }, { yaw: 1.5, tint: '#3aa8ff', stretch: { nodes: ['PortalMesh'], by: 0.9 } });
    fx.update(cam);
    expect([fx.drawn('far'), fx.drawn('near'), fx.drawn('gate')]).toEqual([false, true, true]);
    const gate = live.find((l) => l.opts.tint === '#3aa8ff');
    expect(gate?.opts.yaw).toBe(1.5);
    expect(gate?.opts.stretch).toEqual({ nodes: ['PortalMesh'], by: 0.9 });
    expect(gate?.opts.skip).toContain('StencilMesh');
    fx.want('gate', 'portal', { x: 5, y: 0, z: 0 }, { yaw: 1.5, tint: '#ff8a2a' });
    fx.update(cam);
    fx.update(cam);
    expect(gate?.stopped).toBe(true);
    expect(live.some((l) => !l.stopped && l.opts.tint === '#ff8a2a')).toBe(true);
  });

  it('keeps an effect asked for after the last update, however long the frame took', async () => {
    const { vfx, live } = fakeVfx(2);
    const fx = new LastingFx(vfx);
    const cam = { x: 0, y: 0, z: 0 };
    // An owner that asks after the frame's update (pickups), on a page drawing under three frames a second.
    fx.update(cam);
    fx.want('a', 'loot.health', { x: 1, y: 0, z: 0 });
    for (let frame = 0; frame < 2; frame++) {
      await new Promise((r) => setTimeout(r, 350));
      fx.update(cam);
      expect(fx.drawn('a')).toBe(true);
      fx.want('a', 'loot.health', { x: 1, y: 0, z: 0 });
    }
    expect(live.length).toBe(1);
    // No longer asked for: gone at the update after next.
    await new Promise((r) => setTimeout(r, 350));
    fx.update(cam);
    await new Promise((r) => setTimeout(r, 350));
    fx.update(cam);
    expect(fx.drawn('a')).toBe(false);
  });

  it('starts an effect again, held still, when Reduce flashing asks for it steady', () => {
    const { vfx, live } = fakeVfx(2);
    const fx = new LastingFx(vfx);
    const cam = { x: 0, y: 0, z: 0 };
    fx.want('a', 'loot.health', { x: 1, y: 0, z: 0 });
    fx.update(cam);
    fx.want('a', 'loot.health', { x: 1, y: 0, z: 0 }, { steady: true });
    fx.update(cam);
    fx.update(cam);
    expect(live.map((l) => [l.stopped, l.steady])).toEqual([[true, false], [false, true]]);
  });

  it('leaves out what is beyond its range and unknown keys', () => {
    const { vfx } = fakeVfx(4);
    const fx = new LastingFx(vfx);
    fx.want('far', 'fire.zone', { x: 500, y: 0, z: 0 });
    fx.want('odd', 'no.such.effect', { x: 1, y: 0, z: 0 });
    fx.update({ x: 0, y: 0, z: 0 });
    expect(fx.drawn('far') || fx.drawn('odd')).toBe(false);
  });
  it('starts a slowed effect again when its speed changes (Reduce flashing switched while it plays)', () => {
    const { vfx, live } = fakeVfx(4);
    const fx = new LastingFx(vfx);
    const cam = { x: 0, y: 0, z: 0 };
    fx.want('s', 'status.burn', { x: 3, y: 0, z: 0 }, { slow: 0.4 });
    fx.update(cam);
    expect(live[0]!.opts.slow).toBe(0.4);
    fx.want('s', 'status.burn', { x: 3, y: 0, z: 0 }, { slow: 0.4 });
    fx.update(cam);
    expect(live.length).toBe(1);
    fx.want('s', 'status.burn', { x: 3, y: 0, z: 0 });
    fx.update(cam);
    expect(live[0]!.stopped).toBe(true);
    fx.want('s', 'status.burn', { x: 3, y: 0, z: 0 });
    fx.update(cam);
    expect(live.filter((l) => !l.stopped).length).toBe(1);
    expect(live.at(-1)!.opts.slow).toBeUndefined();
  });

  it('ranks effects out of view after the fixtures in view, and loot in view after both (Low: 4 places)', () => {
    const { vfx } = fakeVfx(4);
    const fx = new LastingFx(vfx);
    const cam = { x: 0, y: 0, z: 0 };
    // In view: x > 0. Four flame-trap jets out of sight (behind, in the oven), two pads and a portal ahead, one pickup.
    const inView = (at: { x: number }) => at.x > 0;
    const ask = () => {
      for (let i = 0; i < 4; i++) fx.want(`trap${i}`, 'fire.trap', { x: -22 - i, y: 0, z: 0 });
      fx.want('pad1', 'pad', { x: 12, y: 0, z: 0 });
      fx.want('pad2', 'pad', { x: 14, y: 0, z: 0 });
      fx.want('gate', 'portal', { x: 20, y: 0, z: 0 });
      fx.want('loot', 'loot.ammo', { x: 6, y: 0, z: 0 });
    };
    ask();
    fx.update(cam, inView);
    expect([fx.drawn('pad1'), fx.drawn('pad2'), fx.drawn('gate')]).toEqual([true, true, true]);
    expect([0, 1, 2, 3].filter((i) => fx.drawn(`trap${i}`)).length).toBe(1);
    expect(fx.drawn('loot')).toBe(false);
    // Without the view test the jets, nearer than the portal, take its place as before.
    const plain = new LastingFx(fakeVfx(4).vfx);
    for (let i = 0; i < 4; i++) plain.want(`trap${i}`, 'fire.trap', { x: -2 - i, y: 0, z: 0 });
    plain.want('gate', 'portal', { x: 20, y: 0, z: 0 });
    plain.update(cam);
    expect(plain.drawn('gate')).toBe(false);
  });

  it('counts an effect within a few metres as in view wherever it is', () => {
    const { vfx } = fakeVfx(1);
    const fx = new LastingFx(vfx);
    fx.want('aura', 'fire.zone', { x: -2, y: 0, z: 0 });
    fx.want('pad', 'pad', { x: 12, y: 0, z: 0 });
    fx.update({ x: 0, y: 0, z: 0 }, (at) => at.x > 0);
    expect(fx.drawn('aura')).toBe(true);
  });
});
