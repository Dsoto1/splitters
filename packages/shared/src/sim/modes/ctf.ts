import { horizontalDistance, type Vec3 } from '../../math.ts';
import { FLAG_CARRIED, FLAG_DROPPED, FLAG_HOME, type FlagAction, type ModeSnapshot } from '../../protocol.ts';
import { TICK_RATE } from '../constants.ts';
import type { Combatant } from '../match.ts';
import { ctfBotAwareness, ctfBotGoal, ctfBotTookFlag } from './ctfBots.ts';
import type { BotGoal, ModeHost, ModeLogic } from './types.ts';

/** Touching a flag: within this many metres of it (horizontally), and close in height. */
export const FLAG_TOUCH_RADIUS = 1.3;
/** Capturing: the carrier within this many metres of their own flag base. */
export const FLAG_CAPTURE_RADIUS = 1.8;
/** Flag carriers move this much slower. */
export const FLAG_CARRIER_SPEED = 0.85;
const TOUCH_HEIGHT = 2;

export type FlagState = typeof FLAG_HOME | typeof FLAG_CARRIED | typeof FLAG_DROPPED;

/** One team's flag. */
export interface FlagRt {
  team: string;
  base: Vec3;
  /** Where it is now: the base, the carrier's feet, or where it fell. */
  pos: Vec3;
  state: FlagState;
  /** Slot of the player carrying it. */
  carrier: number | null;
  /** Dropped: the tick it goes home on its own. */
  returnAt: number;
  /** The carrier's jetpack fuel, put aside while they carry the flag. */
  savedJet: number | null;
}

/**
 * Capture the Flag. Each of the two teams has a flag at its base. Touch the
 * enemy flag to take it (you are slower, and can't use a jetpack or a
 * vehicle while you carry it); bring it to your own base while your flag is
 * there to score. A carrier who dies drops it where they fell; it stays
 * there until a defender touches it (it goes home) or the return timer runs
 * out. The score limit counts captures.
 */
export class CtfMode implements ModeLogic {
  readonly flags: FlagRt[];
  readonly captures = new Map<string, number>();

  constructor(private readonly host: ModeHost) {
    const teams = host.teams.slice(0, 2);
    this.flags = teams.map((t) => {
      const e = host.map.entities.find((x) => x.kind === 'flag' && x.team === t.id);
      // A map without a base for this team (CTF is not offered for those) falls back to the team's first spawn.
      const at = e?.position ?? host.map.entities.find((x) => x.kind === 'spawn' && x.faction === t.id)?.position ?? [0, 0, 0];
      const base = { x: at[0], y: at[1], z: at[2] };
      return { team: t.id, base, pos: { ...base }, state: FLAG_HOME, carrier: null, returnAt: 0, savedJet: null };
    });
    this.reset();
  }

  private get returnTicks(): number {
    return Math.round((this.host.rules.flagReturnSeconds ?? 30) * TICK_RATE);
  }

  flagOf(team: string | null): FlagRt | undefined {
    return this.flags.find((f) => f.team === team);
  }

  /** The flag this player is carrying, if any. */
  carried(c: Combatant): FlagRt | undefined {
    return this.flags.find((f) => f.carrier === c.slot);
  }

  reset(): void {
    for (const f of this.flags) this.sendHome(f);
    this.captures.clear();
    for (const t of this.host.teams) this.captures.set(t.id, 0);
  }

  step(): void {
    const host = this.host;
    const byslot = new Map(host.combatants().map((c) => [c.slot, c]));
    for (const f of this.flags) {
      if (f.state === FLAG_CARRIED) {
        const c = f.carrier === null ? undefined : byslot.get(f.carrier);
        if (!c || !c.alive) {
          this.drop(f, c?.move.pos ?? f.pos, c?.slot ?? null);
          continue;
        }
        f.pos = { ...c.move.pos };
        // No jetpack while carrying: picking one up only tops up what they get back.
        if (c.jetFuel !== null) {
          f.savedJet = Math.max(f.savedJet ?? 0, c.jetFuel);
          c.jetFuel = null;
        }
      } else if (f.state === FLAG_DROPPED && host.tick >= f.returnAt) {
        this.sendHome(f);
        this.event('return', f, null);
      }
    }
    for (const c of host.combatants()) {
      if (!c.alive || c.mount || !c.faction) continue;
      for (const f of this.flags) {
        if (f.state === FLAG_CARRIED || !touching(c.move.pos, f.pos, FLAG_TOUCH_RADIUS)) continue;
        if (f.team === c.faction) {
          if (f.state === FLAG_DROPPED) {
            this.sendHome(f);
            this.event('return', f, c.slot);
          }
        } else if (this.flagOf(c.faction) && !this.carried(c)) this.take(f, c);
      }
      // Bring it home while your own flag is there.
      const held = this.carried(c);
      const own = this.flagOf(c.faction);
      if (held && own && own.state === FLAG_HOME && touching(c.move.pos, own.base, FLAG_CAPTURE_RADIUS)) this.capture(held, c);
      if (host.rules.scoreLimit > 0 && (this.captures.get(c.faction) ?? 0) >= host.rules.scoreLimit) {
        host.endRound();
        return;
      }
    }
  }

  onKill(victim: Combatant): void {
    const f = this.carried(victim);
    if (f) this.drop(f, victim.move.pos, victim.slot);
  }

  onLeave(c: Combatant): void {
    this.onKill(c);
  }

  teamScores(): Map<string, number> {
    return new Map(this.host.teams.map((t) => [t.id, this.captures.get(t.id) ?? 0]));
  }

  snapshot(): ModeSnapshot {
    const r2 = (v: number) => Math.round(v * 100) / 100;
    const teams = this.host.teams;
    return {
      ts: teams.map((t) => this.captures.get(t.id) ?? 0),
      fl: this.flags.map((f) => [
        teams.findIndex((t) => t.id === f.team),
        f.state,
        r2(f.pos.x),
        r2(f.pos.y),
        r2(f.pos.z),
        f.carrier ?? -1,
        f.state === FLAG_DROPPED ? Math.max(0, Math.ceil((f.returnAt - this.host.tick) / TICK_RATE)) : 0,
      ]),
    };
  }

  blocksVehicle(c: Combatant): boolean {
    return !!this.carried(c);
  }

  botAwareness(c: Combatant): number {
    return ctfBotAwareness(c, this.flags);
  }

  botGoal(c: Combatant): BotGoal | null {
    return ctfBotGoal(c, this.host.combatants(), this.flags);
  }

  // ---------------------------------------------------------------- flag moves

  private take(f: FlagRt, c: Combatant): void {
    f.state = FLAG_CARRIED;
    f.carrier = c.slot;
    f.pos = { ...c.move.pos };
    f.savedJet = c.jetFuel;
    c.jetFuel = null;
    c.modeSpeed = FLAG_CARRIER_SPEED;
    if (c.bot) ctfBotTookFlag(c);
    this.event('take', f, c.slot);
  }

  /** Let go of the carrier: normal speed, jetpack back. */
  private release(f: FlagRt): void {
    const c = f.carrier === null ? undefined : this.host.combatants().find((o) => o.slot === f.carrier);
    if (c) {
      c.modeSpeed = undefined;
      if (c.alive && f.savedJet !== null) c.jetFuel = f.savedJet;
    }
    f.carrier = null;
    f.savedJet = null;
  }

  private drop(f: FlagRt, at: Vec3, by: number | null): void {
    this.release(f);
    const floor = this.host.groundBelow({ x: at.x, y: at.y + 0.5, z: at.z });
    // Lost over a drop (or the void): it goes straight home.
    if (floor === null || floor < this.host.killY + 1) {
      this.sendHome(f);
      this.event('return', f, null);
      return;
    }
    f.state = FLAG_DROPPED;
    f.pos = { x: at.x, y: floor, z: at.z };
    f.returnAt = this.host.tick + this.returnTicks;
    this.event('drop', f, by);
  }

  private sendHome(f: FlagRt): void {
    if (f.state === FLAG_CARRIED) this.release(f);
    f.state = FLAG_HOME;
    f.carrier = null;
    f.pos = { ...f.base };
    f.returnAt = 0;
  }

  private capture(f: FlagRt, c: Combatant): void {
    this.sendHome(f);
    this.captures.set(c.faction!, (this.captures.get(c.faction!) ?? 0) + 1);
    this.event('capture', f, c.slot);
  }

  private event(a: FlagAction, f: FlagRt, s: number | null): void {
    this.host.emit({ e: 'flag', a, team: f.team, s });
  }
}

const touching = (p: Vec3, target: Vec3, radius: number): boolean => horizontalDistance(p, target) <= radius && Math.abs(p.y - target.y) < TOUCH_HEIGHT;
