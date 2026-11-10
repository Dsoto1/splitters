import type { Vec3 } from '../math.ts';
import { TICK_RATE } from '../sim/constants.ts';
import type { BotBrain, BotDebugInfo } from './brain.ts';

/**
 * The in-game bot debug view (`?botdebug=1`, host or offline only; BOT_AI_PLAN.md Phase D item 4; docs/BOTS.md, "Bot
 * debug view"): what the page draws, sent from where the match runs (the match worker) a few times a second while the
 * view is on. Each bot's state, goal, route, scores and why it stopped (BotBrain.debugInfo), and the spots where route
 * searches found no way, collected across the match (the latest DEBUG_FAILED). Nothing runs while it is off.
 */
export interface BotDebugBot extends BotDebugInfo {
  slot: number;
  team: string | null;
  pos: Vec3;
  alive: boolean;
  /** Its role (director.ts), when it has one. */
  role: string | null;
}

export interface BotDebugFrame {
  tick: number;
  bots: BotDebugBot[];
  /** Failed searches (from where, toward where, when), newest last. */
  failed: { from: Vec3; goal: Vec3; tick: number }[];
  /** Callouts in the last few seconds (memory.ts): who called whom out, where. */
  callouts: { by: number; slot: number; pos: Vec3; tick: number }[];
}

/** Failed-search spots kept, and how often (ticks) the page gets a frame. */
export const DEBUG_FAILED = 200;
export const DEBUG_EVERY = Math.round(TICK_RATE / 4);

/** What the collector reads of the match (sim/match.ts: its slots). */
export interface DebugSource {
  tick: number;
  bots(): Iterable<{ slot: number; faction: string | null; pos: Vec3; alive: boolean; brain: BotBrain; role: string | null; callouts: readonly { by: number; slot: number; pos: Vec3; tick: number }[] }>;
}

/**
 * Builds the frames: per bot its debugInfo, and every new failed search (a brain's lastNoRoute that changed since the
 * last frame) into the ring. One per match.
 */
export class BotDebugCollector {
  private readonly failed: { from: Vec3; goal: Vec3; tick: number }[] = [];
  private readonly lastFail = new Map<number, string>();

  frame(src: DebugSource): BotDebugFrame {
    const bots: BotDebugBot[] = [];
    const calls = new Map<string, { by: number; slot: number; pos: Vec3; tick: number }>();
    for (const b of src.bots()) {
      const info = b.brain.debugInfo();
      const nr = info.noRoute;
      if (nr) {
        const k = `${info.failures}`;
        if (this.lastFail.get(b.slot) !== k) {
          this.lastFail.set(b.slot, k);
          this.failed.push({ from: nr.from, goal: nr.goal, tick: src.tick });
          if (this.failed.length > DEBUG_FAILED) this.failed.shift();
        }
      }
      for (const c of b.callouts) if (src.tick - c.tick <= TICK_RATE * 3) calls.set(`${c.by}:${c.slot}:${c.tick}`, { by: c.by, slot: c.slot, pos: { ...c.pos }, tick: c.tick });
      bots.push({ ...info, slot: b.slot, team: b.faction, pos: { ...b.pos }, alive: b.alive, role: b.role });
    }
    return { tick: src.tick, bots, failed: this.failed.map((f) => ({ ...f })), callouts: [...calls.values()] };
  }
}
