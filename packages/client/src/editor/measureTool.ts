import { Color4, CreateLineSystem, Vector3, type LinesMesh, type Scene } from '@babylonjs/core';
import { describeSegment, formatLength, measurePath, type MeasurePoint, type Measurement, type Vec3 } from '@tiletrigger/shared';

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

  /** The points measured, with the live stretch to the pointer while the tool is in hand. */
  private shown(): Vec3[] {
    const pts = this.points.map((p) => p.at);
    if (this.active && !this.fresh && this.hover && pts.length) pts.push(this.hover.at);
    return pts;
  }

  /** The measurement on screen (the live stretch included). */
  get measurement(): Measurement {
    return measurePath(this.shown());
  }

  /** The status line: the last stretch and the total, or what to do. */
  summary(): string {
    const m = this.measurement;
    const last = m.segments.at(-1);
    if (!last) return this.points.length && !this.fresh ? 'Click the second point' : this.hover ? `Measure from here · ${snapWord(this.hover)}` : 'Click two points to measure';
    return `${describeSegment(last)}${m.segments.length > 1 ? ` · total ${formatLength(m.total)} over ${m.segments.length}` : ''}`;
  }

  private redraw(): void {
    const pts = this.shown();
    const key = pts.map((p) => `${p.x},${p.y},${p.z}`).join(';');
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
    // A small cross at each point.
    for (const p of pts) {
      const c = lift(p);
      for (const d of [new Vector3(0.25, 0, 0), new Vector3(0, 0, 0.25), new Vector3(0, 0.25, 0)]) {
        lines.push([c.subtract(d), c.add(d)]);
        colors.push([tick, tick]);
      }
    }
    this.lines = CreateLineSystem('measureLines', { lines, colors, useVertexAlpha: true }, this.host.scene);
    this.lines.isPickable = false;
    this.lines.renderingGroupId = 1;
    const m = measurePath(pts);
    m.segments.forEach((s, i) => {
      const el = document.createElement('div');
      el.className = 'ed-measure-label';
      el.dataset.segment = String(i);
      const [len, ...rest] = describeSegment(s).split(' · ');
      el.innerHTML = `<b></b><span></span>`;
      el.querySelector('b')!.textContent = len!;
      el.querySelector('span')!.textContent = rest.join(' · ');
      this.labels.push(el);
    });
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
    // Stretches' labels sit over their middles; the total under the last point.
    const place = (el: HTMLElement, p: Vec3 | null, below = false) => {
      const s = p && this.host.project(p);
      el.hidden = !s;
      if (s) el.style.transform = `translate(${Math.round(s.x)}px, ${Math.round(s.y)}px) translate(-50%, ${below ? '35%' : '-120%'})`;
    };
    for (const el of this.labels) {
      if (el.dataset.total !== undefined) place(el, pts.at(-1) ?? null, true);
      else {
        const i = Number(el.dataset.segment);
        const a = pts[i];
        const b = pts[i + 1];
        place(el, a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 } : null);
      }
    }
  }
}

function snapWord(p: MeasurePoint): string {
  return p.snapped === 'object' ? "snapped to the object's top" : p.snapped === 'top' ? 'snapped to the surface' : p.snapped === 'free' ? 'no snap' : 'snapped to the grid';
}
