import { normalizeTurn, snapTurn, turnLabel, yawToward, type Vec3 } from '@tiletrigger/shared';

/**
 * The rotate ring on the selection gizmo (MapMaker overhaul Phase 3, item 9; the maths is shared editor/turnRing.ts).
 * Drag the ring to turn the selection about its centre: it snaps by the selection's own step (the same as R; Shift:
 * the finer step; tiles, set pieces, zones and water quarter turns), shows the angle by the pointer while dragging,
 * Esc cancels, and letting go is one undo step (turnByCommand, through rotateCommand).
 */
export interface RingHost {
  /** The gizmo's centre (the selection's), or null with nothing selected. */
  center(): Vec3 | null;
  /** The ring's radius round that centre (m). */
  radius(): number;
  /** The snap step for the selection (radians); `fine`: Shift's. */
  step(fine: boolean): number;
  /** Screen spot of a world point, or null behind the camera. */
  project(p: Vec3): { x: number; y: number } | null;
  /** Where the pointer's ray meets the horizontal plane at height `y`, or null. */
  onPlane(y: number): Vec3 | null;
  /** Show the selection turned by `turn` (null: as it is). */
  preview(turn: number | null): void;
  /** Turn the selection for good (one undo step); false when it can't. */
  commit(turn: number): boolean;
  /** Draw the ring (hot: under the pointer or held), with the drag's start and current facing. */
  draw(ring: { radius: number; hot: boolean; from?: number; to?: number } | null): void;
}

/** How near the ring (in screen pixels) the pointer must be to grab it. */
const GRAB_PX = 12;

export class RotateRing {
  /** The drag in progress: where it started (the pointer's facing from the centre), and the snapped turn so far. */
  drag: { center: Vec3; start: number; turn: number } | null = null;
  /** The pointer is over the ring (it lights up). */
  hot = false;
  private readonly label: HTMLElement;

  constructor(
    private readonly host: RingHost,
    overlay: HTMLElement,
  ) {
    this.label = document.createElement('div');
    this.label.id = 'ed-ring-angle';
    this.label.hidden = true;
    overlay.append(this.label);
  }

  /** Is the pointer (at `pointer`, screen) on the ring? */
  over(pointer: { x: number; y: number } | null): boolean {
    const c = this.host.center();
    if (!c || !pointer) return false;
    const p = this.host.onPlane(c.y);
    if (!p) return false;
    const dx = p.x - c.x;
    const dz = p.z - c.z;
    const d = Math.hypot(dx, dz);
    if (d < 1e-6) return false;
    const r = this.host.radius();
    const q = this.host.project({ x: c.x + (dx / d) * r, y: c.y, z: c.z + (dz / d) * r });
    return !!q && Math.hypot(q.x - pointer.x, q.y - pointer.y) <= GRAB_PX;
  }

  /** The pointer moved (not dragging): light the ring when it is over it. Returns whether it is. */
  hover(pointer: { x: number; y: number } | null): boolean {
    const hot = this.over(pointer);
    if (hot !== this.hot) {
      this.hot = hot;
      this.redraw();
    }
    return hot;
  }

  /** Press on the ring: start a drag. False when the pointer isn't on it. */
  begin(pointer: { x: number; y: number }): boolean {
    const c = this.host.center();
    if (!c || !this.over(pointer)) return false;
    const p = this.host.onPlane(c.y)!;
    this.drag = { center: { ...c }, start: yawToward(c, p), turn: 0 };
    this.hot = true;
    this.redraw();
    this.showLabel(pointer);
    return true;
  }

  /** The pointer moved while dragging: the snapped turn, previewed. */
  move(pointer: { x: number; y: number }, fine: boolean): void {
    const d = this.drag;
    if (!d) return;
    const p = this.host.onPlane(d.center.y);
    if (p && Math.hypot(p.x - d.center.x, p.z - d.center.z) > 1e-3) {
      const turn = snapTurn(normalizeTurn(yawToward(d.center, p) - d.start), this.host.step(fine));
      if (turn !== d.turn) {
        d.turn = turn;
        this.host.preview(turn || null);
        this.redraw();
      }
    }
    this.showLabel(pointer);
  }

  /** Let go: the turn is made (one undo step). */
  end(): void {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    this.label.hidden = true;
    this.host.preview(null);
    if (d.turn) this.host.commit(d.turn);
    this.redraw();
  }

  /** Esc: the drag is dropped, nothing turns. False when there was none. */
  cancel(): boolean {
    if (!this.drag) return false;
    this.drag = null;
    this.label.hidden = true;
    this.host.preview(null);
    this.redraw();
    return true;
  }

  /** Draw (or hide) the ring for the current selection. */
  redraw(): void {
    const c = this.host.center();
    if (!c) return this.host.draw(null);
    const d = this.drag;
    this.host.draw({ radius: this.host.radius(), hot: this.hot || !!d, ...(d ? { from: d.start, to: d.start + d.turn } : {}) });
  }

  private showLabel(pointer: { x: number; y: number }): void {
    const d = this.drag;
    if (!d) return;
    this.label.textContent = turnLabel(d.turn);
    this.label.hidden = false;
    this.label.style.transform = `translate(${Math.round(pointer.x + 16)}px, ${Math.round(pointer.y - 28)}px)`;
  }
}
