import {
  BOT_HINT_KINDS,
  BOT_HINT_SPECS,
  addBotHintCommand,
  deleteBotHintsCommand,
  editBotHintCommand,
  hintAt,
  hintTo,
  jumpTrouble,
  mapBotHints,
  moveBotHintCommand,
  type BotHint,
  type BotHintKind,
  type EditCommand,
  type MapDocument,
  type Vec3,
} from '@tiletrigger/shared';

/**
 * Bot hints in MapMaker (MAPMAKER_OVERHAUL_PLAN.md Phase 4 item 3; the commands: shared editor/botHints.ts; the data:
 * shared map/botHints.ts, map format v33): chokepoints, sniper, camp and staging spots and jump links the maker marks
 * for bots. The Bot hints tool (Y, the Entities tab's Bot hints group) places them: one click for a spot, two for a
 * jump link (its start, then its landing). Each shows as an icon pin over the view (and the plan view), with its radius,
 * facing and a jump's arc drawn on a canvas under the pins; a click on a pin selects it for the inspector, and with
 * the tool in hand a pin can be dragged. "What bots know" draws the bots' own computed spots (vantage spots, parkour
 * links) read-only, worked out with the navigation check (sim/mapNav.ts validateMapNavigation `computed`).
 * MapMaker only: play never draws them. Per frame: the pins placed and the canvas redrawn only when the camera or the
 * hints changed.
 */
export interface BotHintHost {
  doc(): MapDocument;
  run(label: string, cmd: EditCommand | { error: string }): boolean;
  toast(message: string, error?: boolean): void;
  /** Screen spot (client pixels) of a world point, or null behind the camera. */
  project(p: Vec3): { x: number; y: number } | null;
  /** The world point under a screen spot (the ground or a floor), or null. */
  pointAt(x: number, y: number): Vec3 | null;
  focus(p: Vec3): void;
  /** The kind of hint the tool has in hand, or null (another tool). */
  tool(): BotHintKind | null;
  pickTool(kind: BotHintKind): void;
  /** Whether a hint at this height is on a level being shown. */
  shown(y: number): boolean;
  /** The part of the window the 3D view shows between the panels (client pixels): pins and lines stay inside it. */
  viewRect(): { left: number; top: number; right: number; bottom: number };
  /** The way the camera looks (yaw): a new spot faces it. */
  lookYaw(): number;
  /** The teams a hint may be for (id, name). */
  teams(): readonly { id: string; name: string }[];
  /** A hint was picked (the editor's own selection goes) or let go: the inspector redrawn. */
  picked(): void;
  /** "What bots know" went on: work the computed spots out (the navigation check, with them). */
  wantComputed(): void;
  overlay: HTMLElement;
}

/** The bots' computed spots as the overlay draws them (sim/mapNav.ts ComputedBotSpots). */
export interface ComputedSpots {
  vantage: readonly { pos: Vec3; kind: 'sniper' | 'camp'; yaw: number; parkour?: boolean }[];
  parkour: readonly { kind: string; start: Vec3; end: Vec3 }[];
}

export const HINT_COLORS: Record<BotHintKind, string> = { choke: '#ff8a3a', sniper: '#c77dff', camp: '#4fd1a5', staging: '#5ab0ff', jump: '#ffd34d' };
const COMPUTED = 'rgba(214, 224, 240, 0.85)';
const SELECTED = '#ffffff';

/** Each kind's icon (24 × 24, drawn in the pin's colour). */
export const HINT_ICONS: Record<BotHintKind, string> = {
  choke: '<path d="M5 3c4 4 4 14 0 18M19 3c-4 4-4 14 0 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M12 7v10" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2 2"/>',
  sniper: '<circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v6M12 16v6M2 12h6M16 12h6" stroke="currentColor" stroke-width="2"/>',
  camp: '<path d="M3 20 12 4l9 16z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 20l-3-6h6z" fill="currentColor"/>',
  staging: '<path d="M6 21V3" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M7 4h11l-3 4 3 4H7z" fill="currentColor"/>',
  jump: '<path d="M3 19c3-12 13-12 16-4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M15 13l4 2 1-4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 21h5M16 21h6" stroke="currentColor" stroke-width="2"/>',
};

const deg = (yaw: number) => Math.round((yaw * 180) / Math.PI);
const rad = (d: number) => (d * Math.PI) / 180;
const fmt = (v: number) => String(Math.round(v * 100) / 100);
const v3 = (p: readonly number[]): Vec3 => ({ x: p[0]!, y: p[1]!, z: p[2]! });

export class BotHintTool {
  private layer: HTMLElement;
  private canvas: HTMLCanvasElement;
  private pins = new Map<string, HTMLButtonElement>();
  private drawn: readonly BotHint[] | null = null;
  private drawKey = '';
  /** The hint selected for the inspector (null: none). */
  private sel: string | null = null;
  /** A jump link's start, clicked: the next click is its landing. */
  private pending: Vec3 | null = null;
  private pendingPin: HTMLElement;
  /** A pin being dragged (the tool in hand): which end, where grabbed, whether it moved, and where to. */
  private drag: { id: string; end: 'at' | 'to'; x: number; y: number; moved: boolean; at: Vec3 | null } | null = null;
  /** "What bots know": on, and what was worked out (null: not yet, or out of date). */
  computedOn = false;
  private computed: ComputedSpots | null = null;
  private computedNote: HTMLElement | null = null;

  constructor(private readonly host: BotHintHost) {
    this.layer = document.createElement('div');
    this.layer.id = 'ed-bothints';
    this.layer.className = 'ed-bothints';
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'ed-bothints-canvas';
    this.pendingPin = document.createElement('div');
    this.pendingPin.className = 'ed-hint-pending';
    this.pendingPin.hidden = true;
    this.pendingPin.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${HINT_ICONS.jump}</svg><span>Jump start: click its landing (Esc cancels)</span>`;
    this.layer.append(this.canvas, this.pendingPin);
    host.overlay.append(this.layer);
    window.addEventListener('pointermove', (e) => this.pointerMove(e));
    window.addEventListener('pointerup', (e) => this.pointerUp(e));
  }

  /** The hint selected for the inspector, if it is still in the map. */
  selected(): BotHint | null {
    return (this.sel && mapBotHints(this.host.doc()).find((h) => h.id === this.sel)) || null;
  }

  /** Let the selected hint go (the editor selected something else). */
  deselect(): void {
    this.sel = null;
    this.drawKey = '';
  }

  select(id: string): void {
    this.sel = id;
    this.drawKey = '';
    this.host.picked();
  }

  /** Esc: a jump link half placed is dropped, else the selected hint let go. Whether it did anything. */
  escape(): boolean {
    if (this.pending) {
      this.pending = null;
      this.pendingPin.hidden = true;
      return true;
    }
    if (this.sel) {
      this.sel = null;
      this.drawKey = '';
      this.host.picked();
      return true;
    }
    return false;
  }

  /** Del: the selected hint goes. Whether there was one. */
  deleteSelected(): boolean {
    const h = this.selected();
    if (!h) return false;
    if (this.host.run(`Delete ${BOT_HINT_SPECS[h.kind].label.toLowerCase()}`, deleteBotHintsCommand(this.host.doc(), [h.id]))) {
      this.sel = null;
      this.host.picked();
    }
    return true;
  }

  /** R: the selected hint turns 45° (Shift: 15°). Whether there was one that faces. */
  turnSelected(fine: boolean): boolean {
    const h = this.selected();
    if (!h || !BOT_HINT_SPECS[h.kind].facing) return false;
    const step = rad(fine ? 15 : 45);
    const yaw = Math.round(((h.yaw ?? 0) + step) / step) * step;
    if (this.host.run('Turn bot hint', editBotHintCommand(this.host.doc(), h.id, { yaw }))) this.host.toast(`Facing ${((deg(yaw) % 360) + 360) % 360}°`);
    return true;
  }

  /** A click with the tool on the view: a spot here (it faces the way the camera looks), or a jump link's start, then its landing. */
  place(at: Vec3 | null): void {
    const kind = this.host.tool();
    if (!kind) return;
    if (!at) return this.host.toast('Point at the ground or a floor to put a bot hint there', true);
    if (kind === 'jump' && !this.pending) {
      this.pending = at;
      return;
    }
    const from = kind === 'jump' ? this.pending! : at;
    const r = addBotHintCommand(this.host.doc(), kind, [from.x, from.y, from.z], kind === 'jump' ? { to: [at.x, at.y, at.z] } : { yaw: Math.round(this.host.lookYaw() / rad(45)) * rad(45) });
    this.pending = null;
    this.pendingPin.hidden = true;
    if ('error' in r) return this.host.toast(r.error, true);
    if (this.host.run(`Place ${BOT_HINT_SPECS[kind].label.toLowerCase()}`, r.command)) {
      const why = kind === 'jump' ? jumpTrouble(r.hint, this.host.doc().physics) : null;
      this.host.toast(why ? `Jump link placed, but a player couldn't make it: ${why}` : `${BOT_HINT_SPECS[kind].label} placed · edit it in the inspector · Ctrl+Z to undo`, !!why);
      this.select(r.hint.id);
    }
  }

  /** The tool was put down: a half-placed jump link goes. */
  setActive(on: boolean): void {
    if (!on && this.pending) {
      this.pending = null;
      this.pendingPin.hidden = true;
    }
    this.layer.classList.toggle('tool', on);
  }

  /** The computed spots, from the navigation check (null: out of date, or "What bots know" is off). */
  setComputed(spots: ComputedSpots | null): void {
    this.computed = spots;
    this.drawKey = '';
    if (this.computedNote) this.computedNote.textContent = this.computedText();
  }

  private computedText(): string {
    if (!this.computedOn) return '';
    const c = this.computed;
    if (!c) return 'Working out what bots know…';
    const n = (k: string) => c.vantage.filter((v) => v.kind === k).length;
    return `Bots work out ${n('sniper')} sniper and ${n('camp')} camp spots and ${c.parkour.length} parkour links here (grey, read-only). They work out no chokepoints or staging spots: mark those yourself.`;
  }

  // ---------------------------------------------------------------- per frame

  /** The view's rect this frame (pins and lines are kept inside it, off the panels). */
  private rect = { left: 0, top: 0, right: 0, bottom: 0 };

  frame(): void {
    const doc = this.host.doc();
    const hints = mapBotHints(doc);
    // (Read only while there is something to draw: it asks the page for its layout.)
    if (hints.length || this.pending || this.computedOn) this.rect = this.host.viewRect();
    const inView = (s: { x: number; y: number } | null) => !!s && s.x >= this.rect.left && s.x <= this.rect.right && s.y >= this.rect.top && s.y <= this.rect.bottom;
    if (hints !== this.drawn) this.rebuild(hints);
    if (this.sel && !hints.some((h) => h.id === this.sel)) this.sel = null;
    // The pins: each hint's spot (a jump link's start and landing).
    const spots: [string, Vec3][] = [];
    for (const h of hints) {
      const d = this.drag?.id === h.id ? this.drag : null;
      spots.push([h.id, d?.end === 'at' && d.at ? d.at : hintAt(h)]);
      if (h.to) spots.push([`${h.id}:to`, d?.end === 'to' && d.at ? d.at : hintTo(h)!]);
    }
    for (const [key, p] of spots) {
      const el = this.pins.get(key);
      if (!el) continue;
      const s = this.host.shown(p.y) ? this.host.project(p) : null;
      el.hidden = !inView(s);
      if (s) el.style.transform = `translate(${Math.round(s.x)}px, ${Math.round(s.y)}px)`;
      el.classList.toggle('sel', key.split(':')[0] === this.sel);
    }
    if (this.pending) {
      const s = this.host.project(this.pending);
      this.pendingPin.hidden = !inView(s);
      if (s) this.pendingPin.style.transform = `translate(${Math.round(s.x)}px, ${Math.round(s.y)}px)`;
    }
    this.drawLines(hints);
  }

  private rebuild(hints: readonly BotHint[]): void {
    this.drawn = hints;
    this.drawKey = '';
    const keep = new Set(hints.flatMap((h) => (h.to ? [h.id, `${h.id}:to`] : [h.id])));
    for (const [id, el] of this.pins) if (!keep.has(id)) (el.remove(), this.pins.delete(id));
    for (const h of hints) {
      for (const end of h.to ? (['at', 'to'] as const) : (['at'] as const)) {
        const key = end === 'to' ? `${h.id}:to` : h.id;
        let el = this.pins.get(key);
        if (!el) {
          el = document.createElement('button');
          el.type = 'button';
          el.className = `ed-hint-pin${end === 'to' ? ' landing' : ''}`;
          el.dataset.hint = h.id;
          el.dataset.end = end;
          el.addEventListener('pointerdown', (e) => this.pinDown(e, h.id, end));
          this.pins.set(key, el);
          this.layer.append(el);
        }
        el.dataset.kind = h.kind;
        el.style.color = HINT_COLORS[h.kind];
        el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${end === 'to' ? '<circle cx="12" cy="12" r="5" fill="currentColor"/>' : HINT_ICONS[h.kind]}</svg>`;
        const team = h.team ? this.host.teams().find((t) => t.id === h.team)?.name ?? h.team : 'every side';
        el.title = `${BOT_HINT_SPECS[h.kind].label}${end === 'to' ? ' (landing)' : ''} · ${team} · ${fmt(h.radius)} m\nClick to edit in the inspector${this.host.tool() ? ', drag to move' : ' (Bot hints tool, Y: drag to move)'}`;
      }
    }
  }

  private pinDown(e: PointerEvent, id: string, end: 'at' | 'to'): void {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    this.drag = { id, end, x: e.clientX, y: e.clientY, moved: false, at: null };
  }

  private pointerMove(e: PointerEvent): void {
    const d = this.drag;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4 && this.host.tool()) d.moved = true;
    if (d.moved) {
      d.at = this.host.pointAt(e.clientX, e.clientY) ?? d.at;
      this.drawKey = '';
    }
  }

  private pointerUp(e: PointerEvent): void {
    const d = this.drag;
    if (!d || e.button !== 0) return;
    this.drag = null;
    this.drawKey = '';
    if (!d.moved) return this.select(d.id);
    if (d.at && this.host.run('Move bot hint', moveBotHintCommand(this.host.doc(), d.id, [d.at.x, d.at.y, d.at.z], d.end))) this.host.picked();
  }

  /** The canvas under the pins: radii, facings, jump arcs, and the computed spots. Redrawn when the camera or hints change. */
  private drawLines(hints: readonly BotHint[]): void {
    const w = this.layer.clientWidth;
    const h = this.layer.clientHeight;
    const comp = this.computedOn ? this.computed : null;
    if (!hints.length && !comp) {
      if (this.drawKey !== 'empty') {
        this.canvas.getContext('2d')?.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawKey = 'empty';
      }
      return;
    }
    // The camera's state, read off three projected points (cheap; anything that moves the view moves them).
    const probe = [this.host.project({ x: 0, y: 0, z: 0 }), this.host.project({ x: 97, y: 13, z: 41 }), this.host.project({ x: -53, y: 3, z: 89 })];
    const r = this.rect;
    const key = `${w}x${h}|${r.left},${r.top},${r.right},${r.bottom}|${probe.map((p) => (p ? `${p.x.toFixed(1)},${p.y.toFixed(1)}` : '-')).join('|')}|${this.sel}|${this.drag?.at ? `${this.drag.at.x},${this.drag.at.z}` : ''}|${this.host.shown(1e4)}`;
    if (key === this.drawKey) return;
    this.drawKey = key;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
    }
    const g = this.canvas.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    g.save();
    g.beginPath();
    g.rect(r.left, r.top, Math.max(0, r.right - r.left), Math.max(0, r.bottom - r.top));
    g.clip();
    g.lineCap = 'round';
    // The bots' own spots first (under the maker's).
    if (comp) {
      g.setLineDash([4, 4]);
      for (const l of comp.parkour) if (this.host.shown(l.start.y)) this.arc(g, l.start, l.end, COMPUTED, 1.5);
      g.setLineDash([]);
      for (const v of comp.vantage) {
        if (!this.host.shown(v.pos.y)) continue;
        const s = this.host.project(v.pos);
        if (!s) continue;
        this.facing(g, v.pos, v.yaw, 3, COMPUTED, 1.5);
        g.save();
        g.translate(s.x, s.y);
        g.rotate(Math.PI / 4);
        g.strokeStyle = COMPUTED;
        g.fillStyle = v.kind === 'sniper' ? 'rgba(199, 125, 255, 0.35)' : 'rgba(79, 209, 165, 0.35)';
        g.lineWidth = 1.5;
        g.fillRect(-4, -4, 8, 8);
        g.strokeRect(-4, -4, 8, 8);
        g.restore();
      }
    }
    for (const hint of hints) {
      const d = this.drag?.id === hint.id ? this.drag : null;
      const at = d?.end === 'at' && d.at ? d.at : hintAt(hint);
      if (!this.host.shown(at.y)) continue;
      const color = hint.id === this.sel ? SELECTED : HINT_COLORS[hint.kind];
      const width = hint.id === this.sel ? 2.5 : 1.75;
      if (hint.kind === 'jump') {
        const to = d?.end === 'to' && d.at ? d.at : hintTo(hint)!;
        this.arc(g, at, to, color, width + 0.5, true);
        continue;
      }
      g.setLineDash([6, 4]);
      this.ring(g, at, hint.radius, color, width);
      g.setLineDash([]);
      if (hint.yaw !== undefined) this.facing(g, at, hint.yaw, Math.max(2, hint.radius), color, width);
    }
    g.restore();
  }

  /** A circle on the ground round `c` (projected). */
  private ring(g: CanvasRenderingContext2D, c: Vec3, r: number, color: string, width: number): void {
    g.beginPath();
    let started = false;
    for (let i = 0; i <= 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      const s = this.host.project({ x: c.x + Math.sin(a) * r, y: c.y + 0.05, z: c.z + Math.cos(a) * r });
      if (!s) {
        started = false;
        continue;
      }
      if (started) g.lineTo(s.x, s.y);
      else g.moveTo(s.x, s.y);
      started = true;
    }
    g.strokeStyle = color;
    g.lineWidth = width;
    g.stroke();
  }

  /** An arrow on the ground from `c`, `len` m the way `yaw` faces. */
  private facing(g: CanvasRenderingContext2D, c: Vec3, yaw: number, len: number, color: string, width: number): void {
    const dir = { x: Math.sin(yaw), z: Math.cos(yaw) };
    const tip = { x: c.x + dir.x * len, y: c.y + 0.05, z: c.z + dir.z * len };
    const a = this.host.project({ x: c.x, y: c.y + 0.05, z: c.z });
    const b = this.host.project(tip);
    if (!a || !b) return;
    const back = len * 0.25;
    const l = this.host.project({ x: tip.x - dir.x * back + dir.z * back * 0.6, y: tip.y, z: tip.z - dir.z * back - dir.x * back * 0.6 });
    const r = this.host.project({ x: tip.x - dir.x * back - dir.z * back * 0.6, y: tip.y, z: tip.z - dir.z * back + dir.x * back * 0.6 });
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    if (l && r) {
      g.moveTo(l.x, l.y);
      g.lineTo(b.x, b.y);
      g.lineTo(r.x, r.y);
    }
    g.strokeStyle = color;
    g.lineWidth = width;
    g.stroke();
  }

  /** A jump's arc from `a` to `b` (up a metre over the higher end), with an arrowhead at the landing. */
  private arc(g: CanvasRenderingContext2D, a: Vec3, b: Vec3, color: string, width: number, head = false): void {
    const top = Math.max(a.y, b.y) + 1 + Math.hypot(b.x - a.x, b.z - a.z) * 0.08;
    const at = (t: number): Vec3 => {
      // A parabola through a (t = 0) and b (t = 1) peaking at `top` (near enough).
      const y = (1 - t) * (1 - t) * a.y + 2 * t * (1 - t) * (2 * top - (a.y + b.y) / 2) + t * t * b.y;
      return { x: a.x + (b.x - a.x) * t, y: y + 0.05, z: a.z + (b.z - a.z) * t };
    };
    g.beginPath();
    let started = false;
    let last: { x: number; y: number } | null = null;
    let prev: { x: number; y: number } | null = null;
    for (let i = 0; i <= 20; i++) {
      const s = this.host.project(at(i / 20));
      if (!s) {
        started = false;
        continue;
      }
      if (started) g.lineTo(s.x, s.y);
      else g.moveTo(s.x, s.y);
      started = true;
      prev = last;
      last = s;
    }
    g.strokeStyle = color;
    g.lineWidth = width;
    g.stroke();
    if (head && last && prev) {
      const ang = Math.atan2(last.y - prev.y, last.x - prev.x);
      g.beginPath();
      g.moveTo(last.x - Math.cos(ang - 0.5) * 10, last.y - Math.sin(ang - 0.5) * 10);
      g.lineTo(last.x, last.y);
      g.lineTo(last.x - Math.cos(ang + 0.5) * 10, last.y - Math.sin(ang + 0.5) * 10);
      g.setLineDash([]);
      g.stroke();
    }
  }

  // ---------------------------------------------------------------- panels

  /** The palette's Bot hints group: one card a kind, the "What bots know" switch and a key. */
  fillPalette(grid: HTMLElement, register: (el: HTMLElement, key: string, name: string, tags: string) => void): void {
    for (const kind of BOT_HINT_KINDS) {
      const spec = BOT_HINT_SPECS[kind];
      const b = document.createElement('button');
      b.className = 'tile-btn';
      b.dataset.tool = `bothint:${kind}`;
      b.innerHTML = `<svg viewBox="0 0 56 56"><circle cx="28" cy="28" r="22" fill="#141a28" stroke="${HINT_COLORS[kind]}" stroke-width="2"/><g transform="translate(14 14) scale(1.17)" style="color:${HINT_COLORS[kind]}">${HINT_ICONS[kind]}</g></svg>${spec.label}`;
      b.title = `${spec.label}: ${spec.what}`;
      b.addEventListener('click', () => this.host.pickTool(kind));
      grid.append(b);
      register(b, b.dataset.tool, spec.label, `bot hint ai ${kind} ${spec.label.toLowerCase()} ${kind === 'choke' ? 'chokepoint choke' : ''}${kind === 'jump' ? 'parkour link' : ''}`);
    }
    const wrap = document.createElement('div');
    wrap.className = 'ed-hint-known';
    const lab = document.createElement('label');
    lab.className = 'check';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.id = 'ed-hints-computed';
    box.checked = this.computedOn;
    box.addEventListener('change', () => this.setComputedOn(box.checked));
    lab.append(box, document.createTextNode('What bots know'));
    lab.title = "Show the spots bots work out for themselves (grey, read-only): sniper and camp spots and parkour links. Add hints only for what's missing.";
    const note = document.createElement('p');
    note.className = 'ed-note';
    note.id = 'ed-hints-computed-note';
    this.computedNote = note;
    wrap.append(lab, note);
    grid.after(wrap);
  }

  setComputedOn(on: boolean): void {
    this.computedOn = on;
    const box = document.getElementById('ed-hints-computed') as HTMLInputElement | null;
    if (box) box.checked = on;
    this.drawKey = '';
    if (on) this.host.wantComputed();
    else this.computed = null;
    if (this.computedNote) this.computedNote.textContent = this.computedText();
  }

  /** The inspector for the selected hint (null: none selected). */
  inspector(): HTMLElement | null {
    const h = this.selected();
    if (!h) return null;
    const spec = BOT_HINT_SPECS[h.kind];
    const wrap = document.createElement('div');
    wrap.id = 'ed-hint-inspector';
    wrap.dataset.hint = h.id;
    const head = document.createElement('h2');
    head.textContent = `Bot hint: ${spec.label}`;
    head.style.color = HINT_COLORS[h.kind];
    const what = document.createElement('small');
    what.className = 'ed-note';
    what.textContent = `${spec.what} Bots read hints on top of what they work out themselves; play never shows them.`;
    wrap.append(head, what);
    const edit = (label: string, patch: Parameters<typeof editBotHintCommand>[2]) => {
      if (this.host.run(label, editBotHintCommand(this.host.doc(), h.id, patch))) this.host.picked();
    };
    const kind = document.createElement('select');
    kind.id = 'ed-hint-kind';
    for (const k of BOT_HINT_KINDS) kind.append(new Option(BOT_HINT_SPECS[k].label, k, false, k === h.kind));
    kind.addEventListener('change', () => edit('Change bot hint kind', { kind: kind.value as BotHintKind }));
    wrap.append(row('Kind', kind));
    if (spec.facing) {
      const yaw = num('ed-hint-yaw', h.yaw === undefined ? 0 : deg(h.yaw), 15, (v) => edit('Turn bot hint', { yaw: rad(v) }));
      wrap.append(row('Facing (°)', yaw));
    }
    wrap.append(row('Radius (m)', num('ed-hint-radius', h.radius, 0.5, (v) => edit('Bot hint radius', { radius: v }))));
    const team = document.createElement('select');
    team.id = 'ed-hint-team';
    team.append(new Option('Every side', '', false, !h.team));
    for (const t of this.host.teams()) team.append(new Option(t.name, t.id, false, t.id === h.team));
    if (h.team && !this.host.teams().some((t) => t.id === h.team)) team.append(new Option(h.team, h.team, false, true));
    team.addEventListener('change', () => edit('Bot hint team', { team: team.value || null }));
    wrap.append(row('For', team));
    const xyz = (prefix: string, label: string, p: readonly number[], set: (q: [number, number, number]) => void) => {
      const box = document.createElement('div');
      box.className = 'ed-hint-xyz';
      const q: [number, number, number] = [p[0]!, p[1]!, p[2]!];
      (['x', 'y', 'z'] as const).forEach((axis, i) => {
        const inp = num(`${prefix}-${axis}`, q[i]!, 0.5, (v) => {
          q[i] = v;
          set([...q]);
        });
        inp.title = `${label} ${axis.toUpperCase()} (m)`;
        box.append(inp);
      });
      wrap.append(row(label, box));
    };
    xyz('ed-hint-at', h.kind === 'jump' ? 'Start' : 'Spot', h.position, (q) => edit('Move bot hint', { position: q }));
    if (h.to) {
      xyz('ed-hint-to', 'Landing', h.to, (q) => edit('Move jump landing', { to: q }));
      const why = jumpTrouble(h, this.host.doc().physics);
      const verdict = document.createElement('p');
      verdict.id = 'ed-hint-verdict';
      verdict.className = `ed-note ${why ? 'bad' : 'ok'}`;
      const a = v3(h.position);
      const b = v3(h.to);
      verdict.textContent = why ? `✗ A player couldn't make it: ${why}` : `✓ A player can make it: ${fmt(Math.hypot(b.x - a.x, b.z - a.z))} m across, ${fmt(b.y - a.y)} m up`;
      wrap.append(verdict);
    }
    const acts = document.createElement('div');
    acts.className = 'ed-dialog-actions';
    const go = document.createElement('button');
    go.type = 'button';
    go.textContent = 'Go to';
    go.addEventListener('click', () => this.host.focus(hintAt(h)));
    const del = document.createElement('button');
    del.type = 'button';
    del.id = 'ed-hint-delete';
    del.className = 'danger';
    del.textContent = 'Delete';
    del.addEventListener('click', () => this.deleteSelected());
    acts.append(go, del);
    wrap.append(acts);
    return wrap;
  }
}

function row(label: string, control: HTMLElement): HTMLElement {
  const r = document.createElement('div');
  r.className = 'row';
  const t = document.createElement('span');
  t.textContent = label;
  r.append(t, control);
  return r;
}

function num(id: string, value: number, step: number, onCommit: (v: number) => void): HTMLInputElement {
  const i = document.createElement('input');
  i.type = 'number';
  i.id = id;
  i.step = String(step);
  i.value = fmt(value);
  i.addEventListener('change', () => {
    const v = Number(i.value);
    if (i.value.trim() !== '' && Number.isFinite(v)) onCommit(v);
  });
  return i;
}
