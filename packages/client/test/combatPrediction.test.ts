import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BUTTON_FIRE, PhysicsWorld, combatRulesOf, DEFAULT_DEATHMATCH_RULES, loadMap, initPhysics, type MatchRules, type PlayerInput, type PlayerSnapshot, type PrivateState } from '@tiletrigger/shared';
import { Match, initNavigation } from '@tiletrigger/shared/match';
import { LocalPlayer } from '../src/game/prediction.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const arenaPath = fileURLToPath(new URL('../../../maps/phase0_arena.json', import.meta.url));

/** Holding the trigger for `seconds` under latency, the client predicting with the match's combat rules (as session.ts sets them). */
function run(extra: Partial<MatchRules>, seconds: number) {
  const base = loadMap(readFileSync(arenaPath, 'utf8'));
  if (!base.ok) throw new Error('arena invalid');
  const rules = { ...DEFAULT_DEATHMATCH_RULES, ...extra };
  const match = new Match(base.map, rules, 9);
  const me = match.addHuman('me')!;
  const local = new LocalPlayer(new PhysicsWorld(match.geometry));
  local.combat = combatRulesOf(rules, base.map);
  match.step();
  local.reconcile(match.playerSnapshots()[0]!, 0, match.privateState(me.slot));
  const lag = 4;
  const up: { at: number; input: PlayerInput }[] = [];
  const down: { at: number; snap: PlayerSnapshot; ack: number; priv: PrivateState | undefined }[] = [];
  let localReloads = 0;
  let hostReloads = 0;
  for (let t = 0; t < 60 * seconds; t++) {
    const { input } = local.tick({ forward: 0, right: 0, buttons: t % 10 < 5 ? BUTTON_FIRE : 0 }, 0, 0.6, 0, 0);
    up.push({ at: t + lag, input });
    while (up.length && up[0]!.at <= t) match.queueInputs(me.slot, [up.shift()!.input]);
    match.step();
    if (local.reloadTicks > 0) localReloads++;
    if (me.reloadTicks > 0) hostReloads++;
    down.push({ at: t + lag, snap: match.playerSnapshots()[0]!, ack: me.lastSeq, priv: match.privateState(me.slot) });
    while (down.length && down[0]!.at <= t) {
      const d = down.shift()!;
      local.reconcile(d.snap, d.ack, d.priv);
    }
  }
  const held = me.weapons.get(me.current)!;
  match.destroy();
  return { localReloads, hostReloads, held, local };
}

describe('combat rules in prediction', () => {
  it('reloads off with unlimited ammo: neither side ever reloads, the magazine stays fed', () => {
    const r = run({ reloads: false, ammo: 'unlimited' }, 6);
    expect(r.hostReloads).toBe(0);
    expect(r.localReloads).toBe(0);
    expect(r.held.reserve).toBe(r.held.def.reserveMax);
  });

  it('standard rules: the pistol reloads on both sides', () => {
    const r = run({}, 6);
    expect(r.hostReloads).toBeGreaterThan(0);
    expect(r.localReloads).toBeGreaterThan(0);
  });
});
