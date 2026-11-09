import type { Vec3 } from '../math.ts';

/**
 * Where bots got stuck and where their routes failed, since the last look (docs/BOTS.md "Scorecard"): the bot
 * scorecard (`pnpm bot-report`, its stuck spots and failed searches) and MapMaker's bot test run (its heatmaps,
 * editor/mapTest.ts) both read their bots through this, so they count the same things.
 */
export interface TracedBot {
  slot: number;
  move: { pos: Vec3 };
  bot?: { stuckCount: number; pathFailures: number; lastNoRoute: { goal: Vec3; from: Vec3 } | null; doing: string } | null;
}

export interface TraceStep {
  /** Stuck recoveries since the last look, where the bot is now and what it was doing. */
  stuck: number;
  at: Vec3;
  doing: string;
  /** Route searches that found no way since the last look, and the last of them (from, toward). */
  failed: number;
  noRoute: { goal: Vec3; from: Vec3 } | null;
}

export class BotTrace {
  private readonly stuck = new Map<number, number>();
  private readonly fails = new Map<number, number>();

  /** What happened to this bot since the last look (null: not a bot). */
  look(c: TracedBot): TraceStep | null {
    const b = c.bot;
    if (!b) return null;
    const stuck = b.stuckCount - (this.stuck.get(c.slot) ?? 0);
    if (stuck > 0) this.stuck.set(c.slot, b.stuckCount);
    const failed = b.pathFailures - (this.fails.get(c.slot) ?? 0);
    if (failed > 0) this.fails.set(c.slot, b.pathFailures);
    return { stuck: Math.max(0, stuck), at: c.move.pos, doing: b.doing, failed: Math.max(0, failed), noRoute: failed > 0 ? b.lastNoRoute : null };
  }
}
