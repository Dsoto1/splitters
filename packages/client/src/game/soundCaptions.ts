import type { Vec3 } from '@tiletrigger/shared';
import type { AudioSystem } from '../audio/audio.ts';
import { CAPTIONS_EVENT, captionMode, type CaptionMode } from './captionPrefs.ts';
import { reduceFlashing } from './reduceFlashing.ts';

/**
 * Sound captions (owner, 2026-11-19, "A"; docs/AUDIO.md, "Sound captions"): important sounds written on screen for
 * hard-of-hearing players and phone play with the sound off: "Gunfire, left ×3", "Grenade! behind", "Footsteps, right".
 *
 * They come from the audio system itself (AudioSystem.onSound): a caption is made where a world sound starts, within
 * the same cull distance, so it matches what you would hear; your own sounds are never positioned, so they never
 * caption. Which sounds caption, and how, is the table below, keyed by sound id prefix. A few lines (at most
 * MAX_LINES) near the bottom centre; repeats merge into one line with a count; a line fades out HOLD_MS after its last
 * sound, eased (no blinking, no bright flash: the text is steady, its backing dark, so Reduce flashing has nothing to
 * calm beyond a slower fade). The screen is redrawn at most RENDER_MS apart, never per sound.
 */

export interface CaptionRule {
  /** A sound id, or the start of one ('fire.' covers 'fire.rifle'). The first rule that matches wins. */
  prefix: string;
  /** The caption; null: none (a rule listed ahead of a broader one to keep that sound out). */
  text: string | null;
  /** For a teammate's sound: its own words, or null for none. Undefined: the same as `text`. */
  friend?: string | null;
  /** Captioned even unpositioned (objective cues, your heartbeat): no direction. Others need a place in the world. */
  global?: true;
  /** A continuing sound (engines, steps, the heartbeat): kept up, not counted. */
  steady?: true;
  /** Which lines a full stack keeps: the lowest rank goes first. */
  rank: number;
}

export const CAPTION_RULES: readonly CaptionRule[] = [
  { prefix: 'fire.knife', text: null, rank: 0 },
  { prefix: 'fire.shotgun.pump', text: null, rank: 0 },
  { prefix: 'fire.cycle', text: null, rank: 0 },
  { prefix: 'fire.', text: 'Gunfire', friend: 'Friendly gunfire', rank: 2 },
  { prefix: 'throw', text: 'Grenade!', friend: 'Friendly grenade', rank: 3 },
  { prefix: 'explosion.debris', text: null, rank: 0 },
  { prefix: 'explosion.vehicle', text: null, rank: 0 },
  { prefix: 'explosion', text: 'Explosion', rank: 3 },
  { prefix: 'bullet.flyby', text: 'Near miss', rank: 2 },
  { prefix: 'footstep', text: 'Footsteps', friend: null, steady: true, rank: 1 },
  { prefix: 'reload.', text: 'Reloading', friend: null, rank: 1 },
  { prefix: 'vehicle.engine', text: 'Vehicle', steady: true, rank: 1 },
  { prefix: 'vehicle.crash', text: 'Crash', rank: 1 },
  { prefix: 'door.', text: 'Door', rank: 0 },
  { prefix: 'break.glass', text: 'Glass breaks', rank: 0 },
  { prefix: 'break.wall', text: 'Wall breaks', rank: 1 },
  { prefix: 'trap.warn', text: 'Warning beep', rank: 2 },
  { prefix: 'trap.', text: 'Trap', rank: 1 },
  { prefix: 'water.splash', text: 'Splash', rank: 0 },
  { prefix: 'objective.new', text: 'Objective updated', global: true, rank: 2 },
  { prefix: 'objective.complete', text: 'Objective complete', global: true, rank: 2 },
  { prefix: 'cue.alarm', text: 'Alarm', global: true, rank: 2 },
  { prefix: 'cue.buzzer', text: 'Objective lost', global: true, rank: 2 },
  { prefix: 'cue.chime', text: 'Objective chime', global: true, rank: 1 },
  { prefix: 'ui.heartbeat', text: 'Heartbeat (low health)', global: true, steady: true, rank: 1 },
];

/** The rule (index into CAPTION_RULES) for a sound id, or -1. */
export function captionRule(id: string, rules: readonly CaptionRule[] = CAPTION_RULES): number {
  for (let i = 0; i < rules.length; i++) {
    const p = rules[i]!.prefix;
    if (id === p || (id.startsWith(p) && (p.endsWith('.') || id[p.length] === '.'))) return i;
  }
  return -1;
}

export const DIRS = ['ahead', 'right', 'behind', 'left'] as const;
export type Dir = (typeof DIRS)[number];
/** No direction (global sounds, or captions without direction). */
export const NO_DIR = 4;
const ARROWS = ['▲', '▶', '▼', '◀', ''] as const;

/**
 * Where `at` is from a listener at `ear` facing `yaw` (the camera's, as AudioSystem.setListener takes it: forward is
 * (sin yaw, cos yaw) on the ground, right (cos yaw, -sin yaw)): 0 ahead, 1 right, 2 behind, 3 left, each a quarter
 * turn wide; NO_DIR when it is right on top of you.
 */
export function directionOf(ear: Readonly<Vec3>, yaw: number, at: Readonly<Vec3>): number {
  const dx = at.x - ear.x;
  const dz = at.z - ear.z;
  const fwd = dx * Math.sin(yaw) + dz * Math.cos(yaw);
  const right = dx * Math.cos(yaw) - dz * Math.sin(yaw);
  if (fwd * fwd + right * right < 0.25) return NO_DIR;
  const a = Math.atan2(right, fwd);
  const q = Math.PI / 4;
  if (Math.abs(a) <= q) return 0;
  if (Math.abs(a) >= 3 * q) return 2;
  return a > 0 ? 1 : 3;
}

/** A sound past this share of its range's cull distance is "far" (dimmer, and said so with direction on). */
export const FAR_SHARE = 0.4;
/** Sounds a player makes this close to the ear are the one you are (or are watching): never captioned. */
export const SELF_RADIUS = 1.5;

export const MAX_LINES = 4;
/** A line stays this long after its last sound (ms), then fades. */
export const HOLD_MS = 2000;
/** The fade (ms; slower with Reduce flashing). */
export const FADE_MS = 500;
export const CALM_FADE_MS = 800;
/** The screen is redrawn at most this often (ms). */
export const RENDER_MS = 250;
/** A count stops at this (shown as "×99"). */
const MAX_COUNT = 99;

export interface CaptionLine {
  key: number;
  rule: number;
  friend: boolean;
  dir: number;
  far: boolean;
  count: number;
  first: number;
  last: number;
}

/** What a line says. */
export function captionText(line: Readonly<CaptionLine>, rules: readonly CaptionRule[] = CAPTION_RULES): string {
  const r = rules[line.rule]!;
  const base = (line.friend && r.friend !== undefined ? r.friend : r.text) ?? '';
  let s = base;
  if (line.dir !== NO_DIR) {
    const where = `${line.far ? 'far ' : ''}${DIRS[line.dir]}`;
    s = base.endsWith('!') ? `${base} ${where}` : `${base}, ${where}`;
  }
  if (line.count > 1) s += ` ×${line.count}`;
  return s;
}

/**
 * The captions' lines, as data: sounds in, lines out. No DOM, no allocation per sound once a line exists (a merged
 * repeat only bumps its line).
 */
export class CaptionStack {
  readonly lines: CaptionLine[] = [];
  private readonly spare: CaptionLine[] = [];
  /** Bumped when the lines change (the screen redraws only then). */
  version = 0;

  constructor(private readonly rules: readonly CaptionRule[] = CAPTION_RULES) {}

  /** A sound heard: rule index, a teammate's, direction (or NO_DIR), far. Returns whether it was kept. */
  push(rule: number, friend: boolean, dir: number, far: boolean, now: number): boolean {
    const r = this.rules[rule];
    if (!r) return false;
    const text = friend && r.friend !== undefined ? r.friend : r.text;
    if (text === null) return false;
    const key = ((rule * 2 + (friend ? 1 : 0)) * 8 + dir) * 2 + (far ? 1 : 0);
    const lines = this.lines;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]!;
      if (l.key !== key) continue;
      if (now - l.last < HOLD_MS) {
        if (!r.steady && l.count < MAX_COUNT) l.count++;
        l.last = now;
        // The newest line goes to the bottom.
        if (i !== lines.length - 1) lines.push(lines.splice(i, 1)[0]!);
        this.version++;
        return true;
      }
      // Faded: start it again.
      this.release(i);
      break;
    }
    this.expire(now);
    if (lines.length >= MAX_LINES) {
      // Full: the lowest-ranked, oldest line makes way, unless the new one ranks lower still.
      let drop = -1;
      for (let i = 0; i < lines.length; i++) {
        const a = lines[i]!;
        const b = drop < 0 ? null : lines[drop]!;
        if (!b || this.rules[a.rule]!.rank < this.rules[b.rule]!.rank || (this.rules[a.rule]!.rank === this.rules[b.rule]!.rank && a.last < b.last)) drop = i;
      }
      if (this.rules[lines[drop]!.rule]!.rank > r.rank) return false;
      this.release(drop);
    }
    const l = this.spare.pop() ?? { key: 0, rule: 0, friend: false, dir: 0, far: false, count: 0, first: 0, last: 0 };
    l.key = key;
    l.rule = rule;
    l.friend = friend;
    l.dir = dir;
    l.far = far;
    l.count = 1;
    l.first = now;
    l.last = now;
    lines.push(l);
    this.version++;
    return true;
  }

  /** Drop the lines that have faded out (HOLD_MS plus `fade`). */
  expire(now: number, fade = FADE_MS): void {
    for (let i = this.lines.length - 1; i >= 0; i--) if (now - this.lines[i]!.last >= HOLD_MS + fade) this.release(i);
  }

  clear(): void {
    while (this.lines.length) this.release(this.lines.length - 1);
  }

  private release(i: number): void {
    this.spare.push(this.lines.splice(i, 1)[0]!);
    this.version++;
  }
}

/** Who made a sound, from your side: a teammate, or anyone else (FFA, the other team, NPCs). */
export type Relation = (slot: number) => 'friend' | 'enemy';

/**
 * Sound captions in a match: listens to the audio system while the setting is on, and draws the stack into the HUD
 * (`#captions`), redrawn at most every RENDER_MS.
 */
export class SoundCaptions {
  readonly stack = new CaptionStack();
  private readonly ruleOf = new Map<string, number>();
  private mode: CaptionMode = captionMode();
  private el: HTMLElement | null = null;
  private rows: HTMLElement[] = [];
  private drawnVersion = -1;
  private drawnAt = -Infinity;
  private readonly onMode = () => this.setMode(captionMode());
  /** Counts for the tests and the perf report: sounds heard, captions kept. */
  readonly stats = { heard: 0, kept: 0, renders: 0 };

  constructor(
    private readonly audio: AudioSystem,
    private readonly relation: Relation,
    private readonly host: () => HTMLElement | null = () => document.getElementById('hud'),
    private readonly clock: () => number = () => performance.now(),
  ) {
    if (typeof window !== 'undefined') window.addEventListener(CAPTIONS_EVENT, this.onMode);
    this.setMode(this.mode);
  }

  setMode(mode: CaptionMode): void {
    this.mode = mode;
    if (mode === 'off') {
      if (this.audio.onSound === this.hear) this.audio.onSound = null;
      this.stack.clear();
      if (this.el) this.el.hidden = true;
    } else {
      this.audio.onSound = this.hear;
    }
  }

  /** The audio system's hook (AudioSystem.onSound). */
  readonly hear = (id: string, at: Vec3 | undefined, dist: number, cull: number, by: number | undefined): void => {
    let rule = this.ruleOf.get(id);
    if (rule === undefined) this.ruleOf.set(id, (rule = captionRule(id)));
    if (rule < 0) return;
    const r = CAPTION_RULES[rule]!;
    if (!at && !r.global) return;
    if (by !== undefined && at && dist < SELF_RADIUS) return;
    this.stats.heard++;
    const friend = by !== undefined && this.relation(by) === 'friend';
    const dir = at && this.mode === 'dir' ? directionOf(this.audio.earAt, this.audio.earYaw, at) : NO_DIR;
    if (this.stack.push(rule, friend, dir, this.mode === 'dir' && !!at && dist > cull * FAR_SHARE, this.clock())) this.stats.kept++;
  };

  /** Once a frame: redraws when something changed, at most every RENDER_MS. */
  update(now: number): void {
    if (this.mode === 'off') return;
    if (now - this.drawnAt < RENDER_MS) return;
    const calm = reduceFlashing();
    const fade = calm ? CALM_FADE_MS : FADE_MS;
    this.stack.expire(now, fade);
    const lines = this.stack.lines;
    // Lines start fading on their own (CSS), so a redraw is needed only when the lines change or one starts to fade.
    let fading = 0;
    for (const l of lines) if (now - l.last >= HOLD_MS) fading++;
    const version = this.stack.version * 8 + fading;
    if (version === this.drawnVersion) return;
    this.drawnVersion = version;
    this.drawnAt = now;
    this.stats.renders++;
    const el = this.ensureEl();
    if (!el) return;
    el.hidden = lines.length === 0;
    el.classList.toggle('calm', calm);
    while (this.rows.length < lines.length) {
      const row = document.createElement('div');
      row.className = 'cap';
      const arrow = document.createElement('span');
      arrow.className = 'cap-dir';
      const text = document.createElement('span');
      text.className = 'cap-text';
      row.append(arrow, text);
      el.append(row);
      this.rows.push(row);
    }
    for (let i = 0; i < this.rows.length; i++) {
      const row = this.rows[i]!;
      const l = lines[i];
      if (!l) {
        if (!row.hidden) row.hidden = true;
        continue;
      }
      row.hidden = false;
      const text = captionText(l);
      const [arrow, label] = row.children as unknown as [HTMLElement, HTMLElement];
      if (label.textContent !== text) label.textContent = text;
      const a = ARROWS[l.dir] ?? '';
      if (arrow.textContent !== a) arrow.textContent = a;
      arrow.hidden = a === '';
      row.classList.toggle('far', l.far);
      row.classList.toggle('friend', l.friend);
      row.classList.toggle('out', now - l.last >= HOLD_MS);
      row.dataset.dir = l.dir === NO_DIR ? '' : DIRS[l.dir];
    }
  }

  private ensureEl(): HTMLElement | null {
    if (this.el?.isConnected) return this.el;
    const host = this.host();
    if (!host) return null;
    const el = document.createElement('div');
    el.id = 'captions';
    el.setAttribute('role', 'log');
    el.setAttribute('aria-live', 'off');
    host.append(el);
    this.el = el;
    this.rows = [];
    return el;
  }

  dispose(): void {
    if (typeof window !== 'undefined') window.removeEventListener(CAPTIONS_EVENT, this.onMode);
    if (this.audio.onSound === this.hear) this.audio.onSound = null;
    this.el?.remove();
    this.el = null;
    this.rows = [];
  }
}
