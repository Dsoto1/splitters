/**
 * The pose check (owner, 2026-11-22, "add a quiet check"): a third-person body drawn standing in its bind pose (the
 * T-pose) for more than a moment, or never posed since it was shown, is noticed and written down, once per body per
 * match, so the next game that shows one says which body it was and why (docs/CHARACTERS.md, "The pose check").
 *
 * The owner saw one once (St. John's, Team Deathmatch, spectating with the free camera: a green-hooded ranger standing
 * in a T on a white ring, no gun) and it couldn't be reproduced (`wip/fix-tpose-1122`). The check is cheap: GameView
 * hands it its on-screen characters POSE_CHECK_EVERY_MS apart (a few times a second), and each body costs a comparison
 * of a few of its drawn skin matrices (CharacterAnimator.drawnBindPose) and a counter (CharacterAnimator.poses).
 *
 * Quiet: nothing on screen. A report goes to the console (`[pose-check]`), to `window.__poseReports`, to this
 * browser's storage (POSE_REPORTS_KEY, the last POSE_REPORTS_KEPT) and into the performance report (Pause → Settings →
 * Copy performance report). Off in `?test=1` runs unless a test turns it on (`window.__poseCheck = true`).
 */

import { testMode } from '../testMode.ts';

/** How often GameView looks (ms). */
export const POSE_CHECK_EVERY_MS = 250;
/** Drawn in the bind pose, on screen, for this long (ms): a report. */
export const BIND_HOLD_MS = 600;
/** Alive and on screen this long (ms) without a single evaluated pose since it was shown or given to a player: a report. */
export const UNPOSED_HOLD_MS = 1000;
/**
 * And for at least this many drawn frames (both reasons): on a slow page (a frame a second) a far character's animation
 * steps every few frames (animLod.ts, up to every 12th, after waiting for its own phase), so time alone called bodies
 * that were simply waiting for their next evaluation "never posed".
 */
export const HOLD_FRAMES = 30;
/** Reports kept in this browser (newest last). */
export const POSE_REPORTS_KEPT = 20;
export const POSE_REPORTS_KEY = 'tt.poseReports';
/** Reports a match writes at most (one body per report). */
export const POSE_REPORTS_PER_MATCH = 8;

/** What GameView knows of one drawn character body, each look. */
export interface PoseSample {
  /** The body's identity for this match (one avatar's life with this body). */
  key: object;
  /** Drawn and on screen (enabled, in the camera's view, not your own hidden body). */
  visible: boolean;
  alive: boolean;
  /** Its drawn skin is the bind pose (CharacterAnimator.drawnBindPose: the arms set as the chest is); null: can't tell. */
  bind: boolean | null;
  /** Evaluated poses so far (CharacterAnimator.poses). */
  poses: number;
  /** The details written down when it is reported (only then). */
  details: () => Record<string, unknown>;
}

export type PoseReason = 'bind' | 'unposed';

export interface PoseReport {
  reason: PoseReason;
  /** How long it had been so when reported (ms). */
  forMs: number;
  at: string;
  [k: string]: unknown;
}

interface Track {
  /** When it was last seen not visible → visible, and its pose count then. */
  shownAt: number;
  shownFrame: number;
  posesAtShow: number;
  /** Since when its skin has been the bind pose while visible (-1: not). */
  bindSince: number;
  bindFrame: number;
  reported: boolean;
  seen: boolean;
}

/** Whether the check runs on this page: always in play, off in `?test=1` unless a test sets `window.__poseCheck`. */
export function poseCheckOn(): boolean {
  const flag = (globalThis as { __poseCheck?: boolean }).__poseCheck;
  if (typeof flag === 'boolean') return flag;
  return !testMode();
}

/**
 * One match's watcher. `observe` takes the bodies GameView draws now and returns the ones to report (each at most
 * once); bodies it no longer sees are forgotten.
 */
export class PoseWatch {
  private readonly tracks = new Map<object, Track>();
  private written = 0;

  constructor(private readonly limit = POSE_REPORTS_PER_MATCH) {}

  /** `frame`: the scene's drawn frames so far (a count that goes up by one a frame). */
  observe(now: number, samples: Iterable<PoseSample>, frame = Infinity): PoseReport[] {
    const out: PoseReport[] = [];
    poseCheckStats.checks++;
    for (const t of this.tracks.values()) t.seen = false;
    for (const s of samples) {
      if (s.visible) poseCheckStats.onScreen++;
      let t = this.tracks.get(s.key);
      if (!t) this.tracks.set(s.key, (t = { shownAt: -1, shownFrame: 0, posesAtShow: s.poses, bindSince: -1, bindFrame: 0, reported: false, seen: true }));
      t.seen = true;
      if (!s.visible) {
        t.shownAt = -1;
        t.bindSince = -1;
        continue;
      }
      if (t.shownAt < 0) {
        t.shownAt = now;
        t.shownFrame = frame;
        t.posesAtShow = s.poses;
      }
      if (s.bind) {
        if (t.bindSince < 0) {
          t.bindSince = now;
          t.bindFrame = frame;
        }
      } else t.bindSince = -1;
      if (t.reported || this.written >= this.limit) continue;
      let reason: PoseReason | null = null;
      let since = 0;
      if (t.bindSince >= 0 && now - t.bindSince >= BIND_HOLD_MS && !(frame - t.bindFrame < HOLD_FRAMES)) {
        reason = 'bind';
        since = t.bindSince;
      } else if (s.alive && s.poses === t.posesAtShow && now - t.shownAt >= UNPOSED_HOLD_MS && !(frame - t.shownFrame < HOLD_FRAMES)) {
        reason = 'unposed';
        since = t.shownAt;
      }
      if (!reason) continue;
      t.reported = true;
      this.written++;
      const frames = reason === 'bind' ? frame - t.bindFrame : frame - t.shownFrame;
      out.push({ reason, forMs: Math.round(now - since), ...(Number.isFinite(frames) ? { forFrames: frames } : {}), at: new Date().toISOString(), ...s.details() });
    }
    for (const [k, t] of this.tracks) if (!t.seen) this.tracks.delete(k);
    return out;
  }
}

/** Since the page loaded: how many times the check looked, and at how many bodies on screen in all (tests). */
export const poseCheckStats = { checks: 0, onScreen: 0 };
(globalThis as unknown as { __poseCheckStats: typeof poseCheckStats }).__poseCheckStats = poseCheckStats;

/** Every report this page has written (newest last), as `window.__poseReports` shows them. */
export const poseReports: PoseReport[] = [];
(globalThis as unknown as { __poseReports: PoseReport[] }).__poseReports = poseReports;

/** Write a report down: the console, the page's list and this browser's storage. */
export function recordPoseReport(r: PoseReport): void {
  poseReports.push(r);
  if (poseReports.length > POSE_REPORTS_KEPT) poseReports.splice(0, poseReports.length - POSE_REPORTS_KEPT);
  console.warn(`[pose-check] a body drawn ${r.reason === 'bind' ? 'in its bind pose (T-pose)' : 'never posed'} for ${r.forMs} ms`, r);
  try {
    const kept = JSON.parse(localStorage.getItem(POSE_REPORTS_KEY) ?? '[]') as PoseReport[];
    kept.push(r);
    localStorage.setItem(POSE_REPORTS_KEY, JSON.stringify(kept.slice(-POSE_REPORTS_KEPT)));
  } catch {
    // Storage blocked or full: the console and the page's list still have it.
  }
}

/** The reports kept in this browser (from earlier games too), oldest first. */
export function keptPoseReports(): PoseReport[] {
  try {
    const kept = JSON.parse(localStorage.getItem(POSE_REPORTS_KEY) ?? '[]') as unknown;
    return Array.isArray(kept) ? (kept as PoseReport[]) : [];
  } catch {
    return [];
  }
}

/** The performance report's lines (perfOverlay.ts): the kept reports, one a line. */
export function poseReportLines(): string[] {
  const kept = keptPoseReports();
  if (!kept.length) return ['pose check: no body seen in a T-pose'];
  return [`pose check: ${kept.length} report${kept.length === 1 ? '' : 's'} (newest last)`, ...kept.map((r) => `  ${JSON.stringify(r)}`)];
}

/**
 * Whether a skin's drawn matrices are its bind pose: every probed bone's skin matrix turns as the first one's does
 * (a skin at rest has every matrix the identity, or one rigid move of the whole if its root joint moved). Rotation parts
 * only, each entry within `eps`. `slots` are the bones' places in the matrix array (16 floats each); unknown places
 * (negative, or past the end) are skipped, and fewer than two left can't tell (null).
 */
export function rigidAlike(m: ArrayLike<number>, slots: readonly number[], eps = 0.02): boolean | null {
  const ok = slots.filter((s) => s >= 0 && (s + 1) * 16 <= m.length);
  if (ok.length < 2) return null;
  const ref = ok[0]! * 16;
  for (let k = 1; k < ok.length; k++) {
    const o = ok[k]! * 16;
    for (const i of [0, 1, 2, 4, 5, 6, 8, 9, 10]) if (Math.abs(m[o + i]! - m[ref + i]!) > eps) return false;
  }
  return true;
}
