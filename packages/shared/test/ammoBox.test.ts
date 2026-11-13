import { beforeAll, describe, expect, it } from 'vitest';
import { BUTTON_THROW, BUTTON_USE, COOK_OFF, DEFAULT_DEATHMATCH_RULES, DEPLOYED_BOX, PLACED_BOX, TICK_RATE, cookOff, initPhysics, type GameEvent, type MapDocument, type PlayerInput } from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const rules = { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000 };

/** An open yard 40 × 32 m with an Ammo Box placed at (10, 0, 10) (respawn 30 s). */
function yard(): MapDocument {
  const tiles = [];
  for (let x = 0; x < 5; x++) for (let y = 0; y < 4; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  const map = makeMap(tiles, [[0, 0, 0]]);
  return { ...map, entities: [...map.entities, { id: 'ammo_1', kind: 'pickup' as const, item: 'core.ammo', position: [10, 0, 10] as [number, number, number], respawnSeconds: 30 }] };
}

class Driver {
  seq = new Map<number, number>();
  constructor(readonly match: Match) {}
  input(c: Combatant, i: Partial<PlayerInput>): void {
    const seq = (this.seq.get(c.slot) ?? 0) + 1;
    this.seq.set(c.slot, seq);
    this.match.queueInputs(c.slot, [{ seq, forward: 0, right: 0, yaw: c.yaw, pitch: c.pitch, buttons: 0, ...i }]);
  }
  run(n: number, each: () => void = () => {}): GameEvent[] {
    const out: GameEvent[] = [];
    for (let i = 0; i < n; i++) {
      each();
      out.push(...this.match.step());
    }
    return out;
  }
}

const place = (c: Combatant, x: number, z: number) => (c.move = { pos: { x, y: 0, z }, velY: 0, grounded: true });
type Box = { id: number; uses: number; health: number; placed: boolean };
const boxes = (m: Match) => m.ammoBoxes() as Box[];
const empty = (c: Combatant) => {
  for (const w of c.weapons.values()) w.reserve = 0;
  c.throwable = null;
};
const resupplies = (ev: GameEvent[]) => ev.filter((e): e is Extract<GameEvent, { e: 'resupply' }> => e.e === 'resupply');

describe('ammo boxes (sim/resupply.ts)', () => {
  it("a map's Ammo Box is a solid crate: Use beside it resupplies (a use each), with a wait between two", () => {
    const match = new Match(yard(), rules);
    const d = new Driver(match);
    const a = match.addHuman('a')!;
    d.run(2);
    expect(boxes(match)).toMatchObject([{ uses: PLACED_BOX.uses, placed: true }]);
    // Not a walk-over pickup any more: standing on its spot gives nothing.
    expect(match.snapshot([]).ab).toHaveLength(1);
    place(a, 11.2, 10);
    empty(a);
    const press = () => {
      const ev = d.run(1, () => d.input(a, { buttons: BUTTON_USE }));
      d.run(1, () => d.input(a, {}));
      return resupplies(ev);
    };
    expect(press()).toMatchObject([{ s: a.slot, m: -1, left: PLACED_BOX.uses - 1, ok: true }]);
    expect([...a.weapons.values()].filter((w) => w.def.reserveMax > 0).every((w) => w.reserve === w.def.reserveMax)).toBe(true);
    expect(a.throwable?.count).toBeGreaterThan(0);
    // Emptied again at once: the wait holds it back (nothing spent), then it gives.
    empty(a);
    expect(press()).toMatchObject([{ ok: false, left: PLACED_BOX.uses - 1 }]);
    d.run(Math.ceil(4 * TICK_RATE), () => d.input(a, {}));
    expect(press()).toMatchObject([{ ok: true, left: PLACED_BOX.uses - 2 }]);
    // Too far: Use does nothing here.
    place(a, 14, 10);
    expect(press()).toEqual([]);
  });

  it('shot or blown up, it cooks off: small blasts round it for a few seconds that hurt slightly, then it comes back full', () => {
    const match = new Match(yard(), rules);
    const d = new Driver(match);
    const a = match.addHuman('a')!;
    const near = match.addHuman('b')!;
    d.run(2);
    place(a, 0, 0);
    place(near, 11.5, 10);
    const hp = near.health;
    // Wreck it (as a blast would).
    (match as unknown as { splash: (...x: unknown[]) => void }).splash({ x: 10, y: 0.4, z: 10 }, 1, 500, 500, a, 'core.launcher', 0);
    near.health = hp;
    expect(boxes(match)).toEqual([]);
    const ev = d.run(Math.ceil(COOK_OFF.seconds * TICK_RATE) + 2);
    const blasts = ev.filter((e) => e.e === 'explode' && (e as { w?: string }).w === COOK_OFF.weapon);
    // A full box: the whole round (cookOff's count for a full one), every one within its spread of the box.
    expect(blasts.length).toBe(cookOff(1, 1, TICK_RATE).length);
    for (const b of blasts) expect(Math.hypot((b as { p: number[] }).p[0]! - 10, (b as { p: number[] }).p[2]! - 10)).toBeLessThanOrEqual(COOK_OFF.spread + 1e-6);
    // Slightly: hurt, not killed.
    expect(near.alive).toBe(true);
    expect(near.health).toBeLessThan(hp);
    expect(hp - near.health).toBeLessThan(hp * 0.8);
    // Back full after its pickup's respawn time.
    d.run(30 * TICK_RATE);
    expect(boxes(match)).toMatchObject([{ uses: PLACED_BOX.uses, health: 1 }]);
  });

  it('an emptier box cooks off less', () => {
    expect(cookOff(0, 3, TICK_RATE).length).toBe(1);
    expect(cookOff(0.5, 3, TICK_RATE).length).toBeLessThan(cookOff(1, 3, TICK_RATE).length);
    expect(cookOff(1, 3, TICK_RATE).every((k) => k.tick <= COOK_OFF.seconds * TICK_RATE)).toBe(true);
  });

  it('an Ammo Box Kit sets a box down where it lands; Use there resupplies; one each', () => {
    const match = new Match(yard(), rules);
    const d = new Driver(match);
    const a = match.addHuman('a')!;
    d.run(2);
    place(a, 2, 2);
    a.throwable = { kind: 'ammo_box', count: 1 };
    d.run(1, () => d.input(a, { buttons: BUTTON_THROW, yaw: 0, pitch: -0.3 }));
    d.run(3 * TICK_RATE, () => d.input(a, { yaw: 0 }));
    const deployed = boxes(match).filter((b) => !b.placed);
    expect(deployed).toHaveLength(1);
    expect(deployed[0]!.uses).toBe(DEPLOYED_BOX.uses);
    expect(a.throwable).toBeNull();
    const at = match.ammoBoxes().find((b) => !b.placed)!.pos;
    place(a, at.x + 1, at.z);
    empty(a);
    const ev = d.run(1, () => d.input(a, { buttons: BUTTON_USE }));
    expect(resupplies(ev)).toMatchObject([{ ok: true, left: DEPLOYED_BOX.uses - 1 }]);
    // A resupply never hands out another kit.
    expect(a.throwable?.kind).not.toBe('ammo_box');
  });
});
