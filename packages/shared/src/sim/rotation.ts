import { z } from 'zod';
import { MAP_ID_RE, isMapId } from './playlist.ts';
import { GAME_MODES, MODE_LABELS, isGameMode, type GameMode } from './rules.ts';

/**
 * Map rotation for regular matches (Deathmatch, Team Deathmatch, CTF…): the
 * host keeps a list of maps, each with a mode, and when a match ends (after
 * the scoreboard) everyone goes on to the next entry instead of replaying the
 * same map, wrapping round at the end. An empty rotation replays, as before.
 *
 * Entries are maps of our own suite only (a file in maps/, by ID), in a mode
 * the map can play; anything else is dropped when the list is set. The same
 * class runs on a dedicated server or Host Service (server.ts) and in a
 * browser hosting a match (the page keeps it across map changes).
 *
 * Presets are data: maps/rotations/*.json, a few built-in lists per mode
 * family that a host can pick in one go.
 */

/** About as many entries as a host would want to manage in a pause menu. */
export const ROTATION_MAX = 20;

export interface RotationEntry {
  map: string;
  mode: GameMode;
}

/** The rotation as the host's panel shows it. */
export interface RotationState {
  /** Each entry with its map's display name. */
  entries: (RotationEntry & { name: string })[];
  shuffle: boolean;
  /** Index (into `entries`) of the entry played next, or null when the rotation is empty. */
  next: number | null;
  /** Index of the entry playing now (the match travelled there), or null. */
  current: number | null;
}

export const RotationPreset = z.object({
  format: z.literal('tiletrigger.rotation'),
  id: z.string().regex(MAP_ID_RE),
  name: z.string().min(1).max(60),
  description: z.string().max(400).default(''),
  /** Which modes it is for, for grouping in pickers ("ffa", "teams", "objective", "big"). */
  family: z.string().max(24).default(''),
  shuffle: z.boolean().default(false),
  maps: z
    .array(z.object({ map: z.string().regex(MAP_ID_RE), mode: z.enum(GAME_MODES as [GameMode, ...GameMode[]]) }))
    .min(1)
    .max(ROTATION_MAX),
});
export type RotationPreset = z.infer<typeof RotationPreset>;

/** A preset from untrusted JSON, or null. `suite`: when given, every map must be in it. */
export function parseRotationPreset(json: unknown, suite?: ReadonlySet<string>): RotationPreset | null {
  const r = RotationPreset.safeParse(json);
  if (!r.success) return null;
  if (suite && r.data.maps.some((m) => !suite.has(m.map))) return null;
  return r.data;
}

/** What a rotation needs to know about a map: its name and the modes it can play (playableModes), or null when it isn't one of ours. */
export type RotationLookup = (id: string) => { name: string; modes: readonly GameMode[] } | null;

/**
 * Check entries from anywhere (a config file, a command, a preset): the map
 * must be one of our suite, the mode one it can play (no mode: the map's
 * first). The rest are dropped, each with a line saying why. At most
 * ROTATION_MAX are kept.
 */
export function validateRotation(raw: unknown, lookup: RotationLookup): { entries: RotationEntry[]; dropped: string[] } {
  const entries: RotationEntry[] = [];
  const dropped: string[] = [];
  if (!Array.isArray(raw)) return { entries, dropped: raw === undefined || raw === null ? [] : ['the rotation must be a list'] };
  for (const item of raw) {
    const o = typeof item === 'string' ? parseRotationItem(item) : (item as Partial<RotationEntry> | null);
    const map = o?.map;
    if (!isMapId(map)) {
      dropped.push(`"${String(typeof item === 'string' ? item : (map ?? item)).slice(0, 60)}" is not a map ID`);
      continue;
    }
    const info = lookup(map);
    if (!info) {
      dropped.push(`${map} is not one of our maps`);
      continue;
    }
    const mode = o?.mode;
    if (mode !== undefined && !isGameMode(mode)) {
      dropped.push(`${map}: "${String(mode).slice(0, 30)}" is not a mode`);
      continue;
    }
    const want = mode ?? info.modes[0];
    if (!want || !info.modes.includes(want)) {
      dropped.push(`${info.name} can't play ${want ? MODE_LABELS[want] : 'any mode'}`);
      continue;
    }
    if (entries.length >= ROTATION_MAX) {
      dropped.push(`${info.name}: the rotation holds ${ROTATION_MAX} maps at most`);
      continue;
    }
    entries.push({ map, mode: want });
  }
  return { entries, dropped };
}

/** "frost_basin:tdm", "frost_basin:core.tdm" or "frost_basin" (the map's own mode) as an entry; a bad mode stays for validateRotation to report. */
export function parseRotationItem(text: string): { map: string; mode?: string } {
  const [map = '', mode] = text.trim().split(':').map((s) => s.trim());
  if (!mode) return { map };
  return { map, mode: mode.startsWith('core.') ? mode : `core.${mode}` };
}

/** An entry as config text ("frost_basin:tdm"). */
export const rotationItem = (e: RotationEntry): string => `${e.map}:${e.mode.replace(/^core\./, '')}`;

/** "Next map: Diamond Park (Capture the Flag)" */
export const nextMapLine = (name: string, mode: GameMode): string => `Next map: ${name} (${MODE_LABELS[mode] ?? mode})`;

/** A small seeded random source (tests pass one; hosts use Math.random). */
export type Random = () => number;

/**
 * The host's rotation: the entries in their order, an optional shuffle (a new
 * random order each time round, never the same entry twice in a row), and
 * where in it the match is.
 */
export class MapRotation {
  private list: RotationEntry[] = [];
  private shuffled = false;
  /** The order entries are played in (indices into `list`): as listed, or shuffled. */
  private order: number[] = [];
  /** Position in `order` of the entry playing now (-1: none of them yet). */
  private pos = -1;

  constructor(
    entries: readonly RotationEntry[] = [],
    opts: { shuffle?: boolean } = {},
    private readonly random: Random = Math.random,
  ) {
    this.shuffled = !!opts.shuffle;
    this.set(entries);
  }

  get entries(): readonly RotationEntry[] {
    return this.list;
  }

  get shuffle(): boolean {
    return this.shuffled;
  }

  get empty(): boolean {
    return this.list.length === 0;
  }

  /** Index (into entries) of the entry playing now, or null. */
  get current(): number | null {
    return this.pos >= 0 ? (this.order[this.pos] ?? null) : null;
  }

  /**
   * A new list (already validated). The entry playing now stays current when
   * it is still in the list, so the next one is the one after it. `now`: what
   * the match plays, used when no entry is current yet (the match started on
   * a map of its own): when it is in the list, the rotation carries on from it.
   */
  set(entries: readonly RotationEntry[], now?: RotationEntry | null): void {
    const playing = (this.current !== null ? this.list[this.current] : null) ?? now ?? null;
    this.list = entries.slice(0, ROTATION_MAX).map((e) => ({ map: e.map, mode: e.mode }));
    const at = playing ? this.list.findIndex((e) => e.map === playing.map && e.mode === playing.mode) : -1;
    this.reorder(at);
  }

  /** Shuffle on or off; the entry playing now stays current. */
  setShuffle(on: boolean): void {
    if (on === this.shuffled) return;
    this.shuffled = on;
    this.reorder(this.current ?? -1);
  }

  /** The entry played next, without moving on (null: the rotation is empty, so the match replays). */
  peek(): { entry: RotationEntry; index: number } | null {
    if (!this.list.length) return null;
    const index = this.pos + 1 < this.order.length ? this.order[this.pos + 1]! : this.nextRound()[0]!;
    return { entry: this.list[index]!, index };
  }

  /** Move on to the next entry (the match is travelling there) and return it. */
  advance(): RotationEntry | null {
    const next = this.peek();
    if (!next) return null;
    if (this.pos + 1 < this.order.length) this.pos++;
    else {
      // Round again from the top (shuffled afresh when shuffle is on).
      this.order = this.nextRound();
      this.upcoming = null;
      this.pos = 0;
    }
    return next.entry;
  }

  /** The order of the next time round, worked out once (so peek and advance agree). */
  private upcoming: number[] | null = null;

  private nextRound(): number[] {
    if (!this.upcoming) {
      const n = this.list.length;
      this.upcoming = this.shuffled ? this.shuffledOrder(this.order[this.order.length - 1] ?? -1) : Array.from({ length: n }, (_, i) => i);
    }
    return this.upcoming;
  }

  state(name: (id: string) => string): RotationState {
    const next = this.peek();
    return {
      entries: this.list.map((e) => ({ ...e, name: name(e.map) })),
      shuffle: this.shuffled,
      next: next ? next.index : null,
      current: this.current,
    };
  }

  /** Entries as config text, for saving ("frost_basin:tdm"). */
  items(): string[] {
    return this.list.map(rotationItem);
  }

  private reorder(currentIndex: number): void {
    const n = this.list.length;
    this.upcoming = null;
    if (!this.shuffled) {
      this.order = Array.from({ length: n }, (_, i) => i);
      this.pos = currentIndex;
      return;
    }
    // Shuffled: what plays now first (it has been played this time round), the rest in a random order.
    const rest = Array.from({ length: n }, (_, i) => i).filter((i) => i !== currentIndex);
    this.fisherYates(rest);
    this.order = currentIndex >= 0 ? [currentIndex, ...rest] : rest;
    this.pos = currentIndex >= 0 ? 0 : -1;
  }

  /** A new random order of every entry, not starting with `last` (when there is a choice). */
  private shuffledOrder(last: number): number[] {
    const all = Array.from({ length: this.list.length }, (_, i) => i);
    this.fisherYates(all);
    if (all.length > 1 && all[0] === last) {
      const j = 1 + Math.floor(this.random() * (all.length - 1));
      [all[0], all[j]] = [all[j]!, all[0]!];
    }
    return all;
  }

  private fisherYates(a: number[]): void {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
  }
}
