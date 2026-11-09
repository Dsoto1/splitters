import { buildZone } from '../editor/buildArea.ts';
import { PLAYER, SPRINT, STANCES } from '../sim/constants.ts';
import type { Vec3 } from '../math.ts';
import type { BotHint, BotHintKind, MapDocument } from './schema.ts';
import type { ValidationIssue } from './validate.ts';

/**
 * Bot hints (map format v33; docs/BOTS.md, "Bot hints (map data)"; BOT_AI_PLAN.md Phase D item 5; MapMaker's Bot hints
 * tool, Y): chokepoints, sniper, camp and staging spots and jump links the map's maker marks for bots. They are map
 * data on top of what bots work out themselves (vantage spots, parkour links: the computed ones stay the default).
 * This module is the read-only side bots use (`mapBotHints`) and the checks validateMap and the navigation validator
 * run on them; MapMaker's commands are in editor/botHints.ts.
 */

/** Each kind as MapMaker names it, the radius a new one gets (m), and whether its facing means something. */
export const BOT_HINT_SPECS: Record<BotHintKind, { label: string; radius: number; facing: boolean; what: string }> = {
  choke: { label: 'Chokepoint', radius: 4, facing: true, what: 'A narrow way between areas (a doorway, a bridge, a gap): worth holding or pushing through. Facing: the way through.' },
  sniper: { label: 'Sniper spot', radius: 1.5, facing: true, what: 'A long-sight spot to hold. Facing: the way to watch.' },
  camp: { label: 'Camp spot', radius: 1.5, facing: true, what: 'A tucked-in spot to hold. Facing: the way to watch.' },
  staging: { label: 'Staging spot', radius: 6, facing: true, what: 'Where a side gathers before a push. Facing: the way it pushes.' },
  jump: { label: 'Jump link', radius: 1, facing: false, what: 'A jump a player can make: from its start to its landing (both on the ground).' },
};

/**
 * The map's bot hints (read-only; absent: none), of a kind if given, and for a team if given (`team`: that team's and
 * every side's; null or absent: all of them).
 */
export function mapBotHints(map: Pick<MapDocument, 'botHints'>, kind?: BotHintKind, team?: string | null): readonly BotHint[] {
  const all = map.botHints ?? [];
  if (!kind && !team) return all;
  return all.filter((h) => (!kind || h.kind === kind) && (!team || !h.team || h.team === team));
}

/** A hint's spot (on the ground), and a jump link's landing. */
export const hintAt = (h: Pick<BotHint, 'position'>): Vec3 => ({ x: h.position[0], y: h.position[1], z: h.position[2] });
export const hintTo = (h: Pick<BotHint, 'to'>): Vec3 | null => (h.to ? { x: h.to[0], y: h.to[1], z: h.to[2] } : null);

/** The height a body's feet rise by tucking its legs up in the air (standing less crouching: nav/parkour.ts's jumps up). */
const TUCK = PLAYER.height - STANCES[1].height;
/** Slack for the hint's two points: where it starts and lands are a step from the edges the jump itself clears (m). */
const JUMP_SLACK = 1;
/** A drop that costs more than about 30 health with fall damage on (as sim/mapNav.ts DROP_HURTS_UP_TO, at normal gravity). */
const DROP_HURTS = 5 + 30 / 9;

/**
 * What a player can jump, from the movement numbers (sim/constants.ts: a jump's speed and gravity, a sprint's pace;
 * tucking the legs up for a high ledge, as nav/parkour.ts's jumps up): how high up at most, and how far across for a
 * landing `rise` m higher (lower: negative), at the map's gravity (× normal). Infinity across: a drop, it can go any way.
 */
export function hintJumpReach(rise: number, gravity = 1): { up: number; across: number } {
  const g = PLAYER.gravity * Math.max(0.05, gravity);
  const v = PLAYER.jumpSpeed;
  const apex = (v * v) / (2 * g);
  const up = apex + TUCK;
  if (rise > up) return { up, across: 0 };
  // The feet clear the landing's height on the way down (tucked, for a ledge over the jump's own height).
  const h = rise > apex ? rise - TUCK : rise;
  const t = (v + Math.sqrt(Math.max(0, v * v - 2 * g * h))) / g;
  return { up, across: PLAYER.runSpeed * SPRINT.speed * t + JUMP_SLACK };
}

/** Why a player couldn't make a jump link (null: they can), at the map's physics. */
export function jumpTrouble(h: Pick<BotHint, 'position' | 'to'>, physics: MapDocument['physics'] = null): string | null {
  const to = hintTo(h);
  if (!to) return null;
  const from = hintAt(h);
  const across = Math.hypot(to.x - from.x, to.z - from.z);
  const rise = to.y - from.y;
  if (across < 0.75 && Math.abs(rise) < 0.75) return 'its start and landing are the same spot';
  const gravity = physics?.gravity ?? 1;
  const r = hintJumpReach(rise, gravity);
  if (rise > r.up) return `its landing is ${rise.toFixed(1)} m up: a jump reaches ${r.up.toFixed(1)} m at most`;
  if (across > r.across) return `it is ${across.toFixed(1)} m across: a running jump ${rise > 0.3 ? `${rise.toFixed(1)} m up ` : rise < -0.3 ? `${(-rise).toFixed(1)} m down ` : ''}reaches about ${r.across.toFixed(1)} m`;
  if (physics?.fallDamage && -rise * gravity > DROP_HURTS) return `it drops ${(-rise).toFixed(1)} m: a fall that hurts (fall damage is on)`;
  return null;
}

/** Hints of a kind (and team) this close are the same hint (m; a jump link: both ends). */
const SAME_SPOT = 1;

const name = (h: BotHint) => `${BOT_HINT_SPECS[h.kind].label} ${h.id}`;

/** A hint's spot, or a jump link's start and landing, each with its name for a message. */
function ends(h: BotHint): { p: Vec3; of: string }[] {
  const to = hintTo(h);
  if (!to) return [{ p: hintAt(h), of: name(h) }];
  return [
    { p: hintAt(h), of: `${name(h)}'s start` },
    { p: to, of: `${name(h)}'s landing` },
  ];
}

/**
 * validateMap's checks of the bot hints (warnings: the hints are advice, bots do without): one outside the map's
 * boundary (or past the build limit), a jump link a player couldn't make (jumpTrouble), and two of a kind on one spot.
 * The navigation validator adds the ones off the navmesh (botHintNavIssues).
 */
export function botHintIssues(map: MapDocument): ValidationIssue[] {
  const hints = map.botHints ?? [];
  if (!hints.length) return [];
  const out: ValidationIssue[] = [];
  for (const h of hints) {
    for (const { p, of } of ends(h)) {
      if (buildZone(map, p.x, p.z) !== 'play') out.push({ severity: 'warning', code: 'bothint.outside', message: `${of} is outside the map boundary`, targetId: h.id });
    }
    const why = h.kind === 'jump' ? jumpTrouble(h, map.physics) : null;
    if (why) out.push({ severity: 'warning', code: 'bothint.jump', message: `${name(h)}: a player couldn't make it (${why})`, targetId: h.id });
  }
  const near = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!) < SAME_SPOT;
  for (let i = 0; i < hints.length; i++) {
    const a = hints[i]!;
    for (let j = 0; j < i; j++) {
      const b = hints[j]!;
      if (a.kind !== b.kind || (a.team ?? '') !== (b.team ?? '') || !near(a.position, b.position)) continue;
      if (a.to && b.to && !near(a.to, b.to)) continue;
      out.push({ severity: 'warning', code: 'bothint.duplicate', message: `${name(a)} is on the same spot as ${b.id}: one is enough`, targetId: a.id });
      break;
    }
  }
  return out;
}

/** What botHintNavIssues needs of the navmesh (nav/index.ts NavWorld). */
export interface HintNav {
  nearestPoly(p: Vec3, halfExtents?: Vec3): { point: Vec3 } | null;
}

/** How far (m) from the navmesh a hint's spot may be and still be on it (across, and up or down). */
const ON_MESH = { x: 1.2, y: 1.6, z: 1.2 };

/**
 * The bot hints against the navmesh as a match builds it (sim/mapNav.ts validateMapNavigation): a spot (or a jump's
 * start or landing) off the navmesh, where no bot can stand. Warnings. (Not "out of reach": a jump link's landing is
 * often ground only that jump gets to, which is what it is for.)
 */
export function botHintNavIssues(map: Pick<MapDocument, 'botHints'>, nav: HintNav): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  for (const h of map.botHints ?? []) {
    for (const { p, of } of ends(h)) {
      const at = nav.nearestPoly(p, ON_MESH);
      if (!at || Math.hypot(at.point.x - p.x, at.point.z - p.z) > ON_MESH.x) out.push({ severity: 'warning', code: 'bothint.offNav', message: `${of} is off the navmesh: no bot can stand there (put it on a floor or the ground)`, targetId: h.id });
    }
  }
  return out;
}
