import { Color4, CreateLineSystem, Vector3, type LinesMesh, type Scene } from '@babylonjs/core';
import { describeSegment, formatLength, segmentParts, measureSegment, type MeasurePoint, type MeasureSegment, type MeasureWorld, type Measurement, type Vec3 } from '@tiletrigger/shared';

/**
 * MapMaker's measure tool (overhaul Phase 1, item 3; the maths is shared editor/measure.ts). Click two points for the
 * distance, the height difference and the slope; a third click chains a path with its total. The line and its numbers
 * stay on screen until the next measure (picking the tool again, then clicking) or Esc. Editor-only: nothing here is
 * in the map file.
 */
export interface MeasureHost {
  scene: Scene;
  /** Screen spot of a world point, or null behind the camera. */
  project(p: Vec3): { x: number; y: number } | null;
  /** Where the labels go (over the view). */
  overlay: HTMLElement;
  /** The map as shown (its boxes and ground, both cached per edit): the jump hint samples it along each stretch. */
  world(): MeasureWorld;
}

export class MeasureTool {
  points: MeasurePoint[] = [];
  /** Where the pointer would put the next point (the tool's live stretch), or null. */
  hover: MeasurePoint | null = null;
  /** The next click starts a new measure (the tool was just picked). */
  private fresh = true;
  private active = false;
  private lines?: LinesMesh;
  private labels: HTMLElement[] = [];
  private drawnKey = '';
  /** Stretches worked out, by their ends, for the map as it was (sampling the ground is done once per stretch). */
  private segs = new Map<string, MeasureSegment>();
  private segsFor: { boxes: unknown; ground: unknown } | null = null;

  constructor(private readonly host: MeasureHost) {}

  /** The tool was picked (`on`) or put down. Picking it again starts a new measure with the next click. */
  setActive(on: boolean): void {
    if (on && !this.active) this.fresh = true;
    this.active = on;
    if (!on) this.hover = null;
    this.redraw();
  }

  /** A click: a point (the first of a new measure, or the next of this one). */
  click(p: MeasurePoint): void {
    if (this.fresh) {
      this.points = [];
      this.fresh = false;
    }
    this.points.push(p);
    this.redraw();
  }

  /** Right-click: take the last point back. False when there was none. */
  back(): boolean {
    if (!this.points.length) return false;
    this.points.pop();
    this.redraw();
    return true;
  }

  /** Esc: the measurement goes. False when there was none. */
  clear(): boolean {
    const had = this.points.length > 0;
    this.points = [];
    this.fresh = true;
    this.redraw();
    return had;
  }

  setHover(p: MeasurePoint | null): void {
    const was = this.hover;
    this.hover = p;
    if (was?.at.x !== p?.at.x || was?.at.y !== p?.at.y || was?.at.z !== p?.at.z) this.redraw();
  }

  /** The points measured. */
  private shown(): Vec3[] {
    return this.points.map((p) => p.at);
  }

  /** The live stretch, from the last point to the pointer, while the tool is in hand (none on the last point itself). */
  private live(): [Vec3, Vec3] | null {
    const last = this.points.at(-1)?.at;
    const h = this.hover?.at;
    if (!this.active || this.fresh || !last || !h || (h.x === last.x && h.y === last.y && h.z === last.z)) return null;
    return [last, h];
  }

  /** The measurement clicked so far (the live stretch left out). */
  get measurement(): Measurement {
    return this.path(this.shown());
  }

  /** A path's stretches, each judged on the ground along it (shared measure.ts), cached until the map changes. */
  private path(points: readonly Vec3[]): Measurement {
    const world = this.host.world();
    if (this.segsFor?.boxes !== world.boxes || this.segsFor?.ground !== world.ground) {
      this.segs.clear();
      this.segsFor = { boxes: world.boxes, ground: world.ground };
    }
    const segments: MeasureSegment[] = [];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!;
      const b = points[i]!;
      const key = `${a.x},${a.y},${a.z};${b.x},${b.y},${b.z}`;
      let s = this.segs.get(key);
      if (!s) {
        if (this.segs.size > 256) this.segs.clear();
        this.segs.set(key, (s = measureSegment(a, b, world)));
      }
      segments.push(s);
    }
    return { segments, total: segments.reduce((t, x) => t + x.distance, 0) };
  }

  /** The status line: the stretch to the pointer (or the last one) and the total, or what to do. */
  summary(): string {
    const live = this.live();
    const pts = live ? [...this.shown(), live[1]] : this.shown();
    const m = this.path(pts);
    const last = m.segments.at(-1);
    if (!last) return this.points.length && !this.fresh ? 'Click the second point' : this.hover ? `Measure from here · ${snapWord(this.hover)}` : 'Click two points to measure';
    return `${describeSegment(last)}${m.segments.length > 1 ? ` · total ${formatLength(m.total)} over ${m.segments.length}` : ''}`;
  }

  private redraw(): void {
    const pts = this.shown();
    const live = this.live();
    const key = [...pts, ...(live ? [live[1]] : [])].map((p) => `${p.x},${p.y},${p.z}`).join(';') + (live ? '+' : '');
    if (key === this.drawnKey) return;
    this.drawnKey = key;
    this.lines?.dispose();
    this.lines = undefined;
    for (const l of this.labels) l.remove();
    this.labels = [];
    if (!pts.length) return;
    const lift = (p: Vec3) => new Vector3(p.x, p.y + 0.04, p.z);
    const lines: Vector3[][] = [];
    const colors: Color4[][] = [];
    const line = new Color4(1, 0.82, 0.3, 1);
    const tick = new Color4(1, 1, 1, 1);
    for (let i = 1; i < pts.length; i++) {
      lines.push([lift(pts[i - 1]!), lift(pts[i]!)]);
      colors.push([line, line]);
      // The height difference: a drop line from the higher end, and the run across at the lower end's height.
      const a = pts[i - 1]!;
      const b = pts[i]!;
      if (Math.abs(b.y - a.y) > 0.05) {
        const [hi, lo] = b.y > a.y ? [b, a] : [a, b];
        const foot = { x: hi.x, y: lo.y, z: hi.z };
        const faint = new Color4(1, 0.82, 0.3, 0.45);
        lines.push([lift(lo), lift(foot)], [lift(foot), lift(hi)]);
        colors.push([faint, faint], [faint, faint]);
      }
    }
    // The live stretch to the pointer, fainter.
    if (live) {
      const faint = new Color4(1, 0.82, 0.3, 0.6);
      lines.push([lift(live[0]), lift(live[1])]);
      colors.push([faint, faint]);
    }
    // A small cross at each point.
    for (const p of live ? [...pts, live[1]] : pts) {
      const c = lift(p);
      for (const d of [new Vector3(0.25, 0, 0), new Vector3(0, 0, 0.25), new Vector3(0, 0.25, 0)]) {
        lines.push([c.subtract(d), c.add(d)]);
        colors.push([tick, tick]);
      }
    }
    this.lines = CreateLineSystem('measureLines', { lines, colors, useVertexAlpha: true }, this.host.scene);
    this.lines.isPickable = false;
    this.lines.renderingGroupId = 1;
    const m = this.path(pts);
    m.segments.forEach((s, i) => {
      const el = document.createElement('div');
      el.className = 'ed-measure-label';
      el.dataset.segment = String(i);
      // Two short lines (the length; the rise, slope and verdict in a word): the whole sentence is in the status line.
      const parts = segmentParts(s);
      el.innerHTML = `<b></b><span></span>`;
      el.querySelector('b')!.textContent = parts.length;
      el.querySelector('span')!.textContent = `${parts.rise} · ${parts.slope} · ${parts.verdict}`;
      this.labels.push(el);
    });
    if (live) {
      const el = document.createElement('div');
      el.className = 'ed-measure-label live';
      el.dataset.live = '';
      // Two short lines (the length; the rise, slope and verdict in a word): the whole sentence is in the status line.
      const parts = segmentParts(this.path(live).segments[0]!);
      el.innerHTML = `<b></b><span></span>`;
      el.querySelector('b')!.textContent = parts.length;
      el.querySelector('span')!.textContent = `${parts.rise} · ${parts.slope} · ${parts.verdict}`;
      this.labels.push(el);
    }
    if (m.segments.length > 1) {
      const el = document.createElement('div');
      el.className = 'ed-measure-label total';
      el.dataset.total = '';
      el.innerHTML = '<b></b>';
      el.querySelector('b')!.textContent = `Total ${formatLength(m.total)}`;
      this.labels.push(el);
    }
    for (const l of this.labels) this.host.overlay.append(l);
    this.frame();
  }

  /** Keep the labels on their stretches as the camera moves (a few projections a frame). */
  frame(): void {
    if (!this.labels.length) return;
    const pts = this.shown();
    // Stretches' labels sit by their middles; the total beside the last point.
    // Every other stretch's label sits under its line, so neighbours' labels don't cover each other.
    const place = (el: HTMLElement, p: Vec3 | null, at: 'above' | 'below' | 'beside') => {
      const s = p && this.host.project(p);
      el.hidden = !s;
      if (s) el.style.transform = `translate(${Math.round(s.x)}px, ${Math.round(s.y)}px) ${at === 'beside' ? 'translate(14px, -50%)' : `translate(-50%, ${at === 'below' ? '25%' : '-115%'})`}`;
    };
    const live = this.live();
    for (const el of this.labels) {
      if (el.dataset.total !== undefined) place(el, pts.at(-1) ?? null, 'beside');
      else if (el.dataset.live !== undefined) place(el, live ? { x: (live[0].x + live[1].x) / 2, y: (live[0].y + live[1].y) / 2, z: (live[0].z + live[1].z) / 2 } : null, 'above');
      else {
        const i = Number(el.dataset.segment);
        const a = pts[i];
        const b = pts[i + 1];
        place(el, a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 } : null, i % 2 === 1 ? 'below' : 'above');
      }
    }
  }
}

function snapWord(p: MeasurePoint): string {
  return p.snapped === 'object' ? "snapped to the object's top" : p.snapped === 'top' ? 'snapped to the surface' : p.snapped === 'free' ? 'no snap' : 'snapped to the grid';
}
