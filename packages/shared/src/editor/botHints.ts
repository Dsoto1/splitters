import { BOT_HINT_SPECS, mapBotHints } from '../map/botHints.ts';
import { BotHint, type BotHintKind, type MapDocument } from '../map/schema.ts';
import { newId, type EditCommand } from './commands.ts';

/**
 * MapMaker's bot hint commands (map format v33; MAPMAKER_OVERHAUL_PLAN.md Phase 4 item 3; the data: map/botHints.ts):
 * the Bot hints tool (Y) places chokepoints, sniper, camp and staging spots and jump links, the inspector edits them.
 * Each edit is one undo step (the list replaced: `setBotHints`).
 */

/** The most hints a map holds (the schema's cap). */
export const BOT_HINT_MAX = 256;

type P3 = readonly [number, number, number];
const r3 = (v: number) => Math.round(v * 1000) / 1000 + 0;
const at = (p: P3): [number, number, number] => [r3(p[0]), r3(p[1]), r3(p[2])];
/** A yaw kept in (-π, π], to a thousandth. */
const yawOf = (y: number) => r3(Math.atan2(Math.sin(y), Math.cos(y)));

const setHints = (doc: MapDocument, after: BotHint[]): EditCommand => ({ kind: 'setBotHints', before: doc.botHints ?? null, after: after.length ? after : null });

/** A hint as the schema takes it, or why not. */
function checked(h: BotHint): BotHint | { error: string } {
  const r = BotHint.safeParse(h);
  return r.success ? r.data : { error: r.error.issues[0]?.message ?? 'not a valid bot hint' };
}

/** Where a jump link lands when none is given: 3 m on the way it faces (yaw as a spawn's: 0 is north, +z). */
function landingFrom(position: P3, yaw: number | undefined): [number, number, number] {
  const y = yaw ?? 0;
  return at([position[0] + Math.sin(y) * 3, position[1], position[2] + Math.cos(y) * 3]);
}

/** Place a new hint here (a jump link: from `position` to `to`). Its radius and facing default by kind (BOT_HINT_SPECS). */
export function addBotHintCommand(
  doc: MapDocument,
  kind: BotHintKind,
  position: P3,
  opts: { to?: P3; yaw?: number; radius?: number; team?: string | null } = {},
): { command: EditCommand; hint: BotHint } | { error: string } {
  if (mapBotHints(doc).length >= BOT_HINT_MAX) return { error: `a map holds ${BOT_HINT_MAX} bot hints at most: delete some first` };
  const spec = BOT_HINT_SPECS[kind];
  const yaw = spec.facing ? yawOf(opts.yaw ?? 0) : undefined;
  const hint = checked({
    id: newId('hint'),
    kind,
    position: at(position),
    ...(yaw !== undefined ? { yaw } : {}),
    radius: opts.radius ?? spec.radius,
    ...(opts.team ? { team: opts.team } : {}),
    ...(kind === 'jump' ? { to: opts.to ? at(opts.to) : landingFrom(position, opts.yaw) } : {}),
  });
  if ('error' in hint) return hint;
  return { command: setHints(doc, [...mapBotHints(doc), hint]), hint };
}

/** What the inspector changes: the kind, the facing (null: none), the radius, the team (null: every side's), either end. */
export interface BotHintPatch {
  kind?: BotHintKind;
  yaw?: number | null;
  radius?: number;
  team?: string | null;
  position?: P3;
  to?: P3;
}

/**
 * Change a hint. A new kind keeps the spot (a radius left at the old kind's default takes the new one's); one made a
 * jump link gets a landing 3 m on, one that stops being a jump link drops it.
 */
export function editBotHintCommand(doc: MapDocument, id: string, patch: BotHintPatch): EditCommand | { error: string } {
  const list = mapBotHints(doc);
  const old = list.find((h) => h.id === id);
  if (!old) return { error: 'no such bot hint' };
  const kind = patch.kind ?? old.kind;
  const spec = BOT_HINT_SPECS[kind];
  const position = patch.position ? at(patch.position) : old.position;
  const yawIn = patch.yaw === undefined ? old.yaw : patch.yaw === null ? undefined : patch.yaw;
  const yaw = spec.facing ? (yawIn === undefined ? (kind !== old.kind ? 0 : undefined) : yawOf(yawIn)) : undefined;
  const radius = patch.radius ?? (kind !== old.kind && old.radius === BOT_HINT_SPECS[old.kind].radius ? spec.radius : old.radius);
  const team = patch.team === undefined ? old.team : patch.team ?? undefined;
  const to = kind === 'jump' ? (patch.to ? at(patch.to) : old.to ?? landingFrom(position, old.yaw)) : undefined;
  const next = checked({
    id,
    kind,
    position,
    ...(yaw !== undefined ? { yaw } : {}),
    radius: r3(Math.max(0.5, Math.min(40, radius))),
    ...(team ? { team } : {}),
    ...(to ? { to } : {}),
  });
  if ('error' in next) return next;
  return setHints(doc, list.map((h) => (h.id === id ? next : h)));
}

/** Move a hint's spot (a jump link's start), or (`end` 'to') a jump link's landing. */
export function moveBotHintCommand(doc: MapDocument, id: string, position: P3, end: 'at' | 'to' = 'at'): EditCommand | { error: string } {
  const old = mapBotHints(doc).find((h) => h.id === id);
  if (!old) return { error: 'no such bot hint' };
  if (end === 'to') return old.to ? editBotHintCommand(doc, id, { to: position }) : { error: 'only a jump link has a landing' };
  return editBotHintCommand(doc, id, { position });
}

/** Delete hints. */
export function deleteBotHintsCommand(doc: MapDocument, ids: readonly string[]): EditCommand | { error: string } {
  const gone = new Set(ids);
  const list = mapBotHints(doc);
  const after = list.filter((h) => !gone.has(h.id));
  if (after.length === list.length) return { error: 'no such bot hint' };
  return setHints(doc, after);
}
