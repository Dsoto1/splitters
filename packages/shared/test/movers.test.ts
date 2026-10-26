import { beforeAll, describe, expect, it } from 'vitest';
import { BUTTON_USE, Movers, PhysicsWorld, ScenarioBodies, TICK_DT, buildMapGeometry, emptyInput, stepMovement, TICK_RATE, blockBoxes, carriedTransform, initPhysics, legTicks, liftLinks, loadMap, moverDefs, moverPose, validateMap, type MapEntity } from '../src/index.ts';
import { initNavigation } from '../src/match.ts';
import { act, block, button, codes, cond, loaded, rule, start, twoRooms } from './kit20.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const mover = (id: string, blocks: string[], points: [number, number, number][], extra: Partial<Extract<MapEntity, { kind: 'mover' }>> = {}): MapEntity => ({
  id,
  kind: 'mover',
  position: [-1, 0, 1],
  yaw: 0,
  blocks,
  points,
  mode: 'pingpong',
  speed: 1,
  turnSpeed: 45,
  wait: 0.5,
  startActive: true,
  ...extra,
});

const liftMap = (extra: Partial<Extract<MapEntity, { kind: 'mover' }>> = {}, more: MapEntity[] = [], logic = {}) =>
  twoRooms([block('lift_1', [-1, 0, 1], { size: [2.4, 0.3, 2.4] }), mover('mover_1', ['lift_1'], [[0, 0, 0], [0, 1.5, 0]], extra), ...more], logic);

describe('movers', () => {
  it('poses are a pure function of the leg and the tick (eased), and hinges raise drawbridges', () => {
    const doc = loaded(liftMap());
    const [def] = moverDefs(doc);
    expect(legTicks(def!, 0, 1)).toBe(Math.round(1.5 * TICK_RATE));
    const leg = { from: 0, to: 1, start: 100 };
    expect(moverPose(def!, leg, 100).offset.y).toBe(0);
    expect(moverPose(def!, leg, 100 + 45).offset.y).toBeCloseTo(0.75, 5);
    expect(moverPose(def!, leg, 100 + 90).offset.y).toBeCloseTo(1.5, 5);
    // Eased: slow at the start.
    expect(moverPose(def!, leg, 101).offset.y).toBeLessThan(1.5 / 90);

    // Drawbridge: an 8 m deck reaching north from its hinge, raised 90°: its centre goes 4 m up over the hinge.
    const bridge = loaded(twoRooms([block('deck_1', [0, 0, 4], { size: [3, 0.3, 8] }), mover('bridge_1', ['deck_1'], [[0, 0, 0], [0, 0, 0]], { position: [0, 0, 0], angles: [Math.PI / 2, 0], mode: 'trigger' })], { rules: [rule({ when: { event: 'match_start', target: null }, do: [act('mover_go', { target: 'bridge_1' })] })] }));
    const [bd] = moverDefs(bridge);
    const up = carriedTransform(bd!, bd!.blocks[0]!, moverPose(bd!, { from: 0, to: 0, start: 0 }, 0));
    expect(up.center.y).toBeCloseTo(4, 1);
    expect(up.center.z).toBeCloseTo(-0.15, 1);
    // Navigation sees the deck where it starts: standing up.
    const box = blockBoxes(bridge, true)[0]!;
    expect((box.min[1] + box.max[1]) / 2).toBeCloseTo(4, 1);
    expect(box.pitch).toBeCloseTo(Math.PI / 2, 5);
  });

  it('a lift carries the player standing on it up and back down', () => {
    const d = start(liftMap());
    d.place(-1, 0.3, 1);
    let top = 0;
    for (let t = 0; t < TICK_RATE * 3; t++) {
      d.input();
      top = Math.max(top, d.me.move.pos.y);
    }
    expect(top).toBeGreaterThan(1.75);
    // Riding, not falling through or floating off: the feet stay on the platform.
    expect(Math.abs(d.me.move.pos.x + 1)).toBeLessThan(0.05);
    // Wait 0.5 s, up 1.5 s, wait 0.5 s, down 1.5 s: back at the bottom by 4 s.
    d.run(Math.round(TICK_RATE * 1.2));
    expect(d.me.move.pos.y).toBeLessThan(0.4);
    expect(d.me.move.pos.y).toBeGreaterThan(0.25);
  });

  it('trigger movers go when logic sends them, fire "arrives" and answer "parked at"', () => {
    const map = liftMap({ mode: 'trigger' }, [button('button_1', [2, 0, -3])], {
      variables: [{ id: 'var_up', name: 'up', initial: 0 }],
      rules: [
        rule({ when: { event: 'button_pressed', target: 'button_1' }, do: [act('mover_go', { target: 'mover_1' })] }),
        rule({ when: { event: 'mover_arrived', target: 'mover_1' }, if: [cond('mover_at', { target: 'mover_1', op: '==', value: 2 })], do: [act('set_var', { target: 'var_up', value: 1 })] }),
      ],
    });
    expect(codes(validateMap(loaded(map)))).toEqual([]);
    const d = start(map);
    d.run(TICK_RATE * 3);
    expect(d.match.scenario.moverAt('mover_1')).toBe(1);
    d.place(2, 0, -1.6, Math.PI);
    d.input({ yaw: Math.PI, pitch: -0.2, buttons: BUTTON_USE });
    d.run(10);
    expect(d.match.scenario.moverAt('mover_1')).toBe(0);
    d.run(TICK_RATE * 2);
    expect(d.match.scenario.moverAt('mover_1')).toBe(2);
    expect(d.match.scenario.variable('var_up')).toBe(1);
  });

  it('clients rebuild the same poses from the replicated leg', () => {
    const d = start(liftMap());
    d.run(TICK_RATE);
    const sent = d.match.scenario.fullState().es!.find(([i]) => d.match.map.entities[i]?.kind === 'mover')!;
    const client = new Movers(d.match.map);
    client.decode(sent[0], sent[1], sent[2]);
    const tick = d.match.tick + 7;
    expect(client.pose(0, tick)).toEqual(d.match.scenario.movers.pose(0, tick));
  });

  it('prediction (same bodies, same carry, same movement) rides exactly like the server', () => {
    const d = start(liftMap());
    d.place(-1, 0.3, 1);
    d.run(TICK_RATE);
    // A client joins here: it gets the leg and the player's state, then predicts the next 90 ticks.
    const sent = d.match.scenario.fullState().es!.find(([i]) => d.match.map.entities[i]?.kind === 'mover')!;
    const physics = new PhysicsWorld(buildMapGeometry(d.match.map));
    const bodies = new ScenarioBodies(physics, d.match.map);
    const client = new Movers(d.match.map);
    client.decode(sent[0], sent[1], sent[2]);
    const collider = physics.createPlayerCollider();
    let state = { ...d.me.move, pos: { ...d.me.move.pos } };
    let tick = d.match.tick;
    for (let k = 0; k < 90; k++) {
      d.input();
      tick++;
      for (const t of client.transforms(tick)) bodies.setTransform(t.block.i, t.center, t.rot);
      bodies.commit();
      const ridden = client.carry(state.pos, tick);
      if (ridden) state = { ...state, pos: ridden };
      state = stepMovement(physics, collider, state, { ...emptyInput(), seq: k }, 1, TICK_DT, 1, {});
    }
    expect(Math.abs(state.pos.y - d.me.move.pos.y)).toBeLessThan(0.01);
    expect(state.pos.y).toBeGreaterThan(1);
  });

  it('lifts that run by themselves become navmesh links both ways', () => {
    const links = liftLinks(loaded(liftMap()));
    expect(links).toHaveLength(2);
    expect(links[0]!.start.y).toBeCloseTo(0.3, 5);
    expect(links[0]!.end.y).toBeCloseTo(1.8, 5);
    expect(liftLinks(loaded(liftMap({ mode: 'trigger' })))).toEqual([]);
  });

  it('the validator catches shared blocks, missing blocks and trigger movers nobody sends', () => {
    const map = twoRooms([block('blk_1', [0, 1, 0]), mover('mov_1', ['blk_1', 'nope_1'], [[0, 0, 0], [0, 1, 0]]), mover('mov_2', ['blk_1'], [[0, 0, 0], [1, 0, 0]], { mode: 'trigger' })]);
    // The shared block is an error, so the map won't load: check the issues loadMap reports.
    const result = loadMap(map);
    expect(result.ok).toBe(false);
    const issues = codes(result.issues);
    expect(issues).toContain('mover.block');
    expect(issues).toContain('mover.shared_block');
    expect(issues).toContain('mover.never_moves');
  });
});
