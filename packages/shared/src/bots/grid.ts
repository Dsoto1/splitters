import type { CombatantView } from './brain.ts';

/** Cell size (m): about the separation and hearing scales, so a near query reads a few cells. */
const CELL = 8;
/** Cell coordinates fit in 16 bits each (maps are far smaller than 500 km). */
const OFFSET = 32768;

/**
 * A uniform grid over the ground plane of actors' views, built once per tick
 * per side (Match.runBots) so that "who is near me" reads a few cells instead
 * of every actor in a 96-player match. Iteration is in insertion order within
 * a cell and in cell order across them, so results are deterministic.
 */
export class ViewGrid {
  private readonly cells = new Map<number, CombatantView[]>();
  /** Arrays kept from earlier builds (no allocation per tick once warm). */
  private readonly spare: CombatantView[][] = [];
  size = 0;

  /** Start over with these views. */
  reset(views: Iterable<CombatantView>): this {
    for (const list of this.cells.values()) {
      list.length = 0;
      this.spare.push(list);
    }
    this.cells.clear();
    this.size = 0;
    for (const v of views) this.add(v);
    return this;
  }

  add(v: CombatantView): void {
    const key = cellKey(Math.floor(v.pos.x / CELL), Math.floor(v.pos.z / CELL));
    let list = this.cells.get(key);
    if (!list) this.cells.set(key, (list = this.spare.pop() ?? []));
    list.push(v);
    this.size++;
  }

  /**
   * The views within `r` m of (x, z) over the ground, into `out` (cleared first; maybe
   * a few just outside `r`, in the corner cells: callers check their own distance).
   */
  near(x: number, z: number, r: number, out: CombatantView[]): CombatantView[] {
    out.length = 0;
    const x0 = Math.floor((x - r) / CELL);
    const x1 = Math.floor((x + r) / CELL);
    const z0 = Math.floor((z - r) / CELL);
    const z1 = Math.floor((z + r) / CELL);
    // A query covering more cells than there are filled ones: reading them all is cheaper.
    if ((x1 - x0 + 1) * (z1 - z0 + 1) > this.cells.size * 2) {
      for (const list of this.cells.values()) for (const v of list) out.push(v);
      return out;
    }
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const list = this.cells.get(cellKey(cx, cz));
        if (list) for (const v of list) out.push(v);
      }
    }
    return out;
  }
}

function cellKey(cx: number, cz: number): number {
  return (cx + OFFSET) * 65536 + (cz + OFFSET);
}
