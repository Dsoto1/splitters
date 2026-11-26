import type { Mesh, Scene } from '@babylonjs/core';
import { boxBounds, cachedWallSections, visibleFaces, wallSectionIndex, type EffectsWorld, type MapDocument, type RenderFace, type WallSection, type WorldBox } from '@tiletrigger/shared';
import { MapStyler } from '../mapMeshes.ts';

/**
 * Breakable walls in play (shared sim/breakWalls.ts). The level is drawn without them (view.ts buildMap); here the
 * standing ones are drawn as one set of meshes by style, and the broken ones' remains (stubs, the part over the
 * hole, ragged teeth, rubble) as another. A break rebuilds both from faces worked out once at the start, so a map's
 * walls cost a few draws whatever their number. The faces are clipped against the level round them, as the level's
 * own are (no flicker where a wall meets the floor or the next wall), and the level round a wall is drawn whole, so
 * the hole shows the ends of the walls beside it.
 */
export class BreakWallVisuals {
  private readonly standing: MapStyler;
  private readonly broken: MapStyler;
  private sections: WallSection[] = [];
  private faces: { wall: { boxes: WorldBox[]; faces: RenderFace[] }; rest: { boxes: WorldBox[]; faces: RenderFace[] } }[] = [];
  private up: boolean[] = [];
  private doc: MapDocument | null = null;
  private base = 0;

  constructor(scene: Scene, share: MapStyler) {
    this.standing = new MapStyler(scene, share);
    this.broken = new MapStyler(scene, share);
  }

  /** `level`: the level's boxes and trim as drawn (without the walls), to clip the walls' faces against. */
  build(doc: MapDocument, level: readonly WorldBox[]): void {
    this.doc = doc;
    this.sections = cachedWallSections(doc);
    this.base = this.sections.length ? wallSectionIndex(doc, 0) : 0;
    this.up = this.sections.map(() => true);
    this.faces = this.sections.map((s) => ({ wall: clipped([...s.boxes, ...s.trim], level), rest: clipped([...s.remains, ...s.rubble], level) }));
    this.redraw();
  }

  /** Replicated states (scenario index → [health %, …]): a section with 0 is broken. */
  apply(states: ReadonlyMap<number, readonly [number, number]>, effects?: EffectsWorld | null): void {
    if (!this.sections.length) return;
    let changed = false;
    for (let k = 0; k < this.sections.length; k++) {
      const s = states.get(this.base + k);
      const up = s ? s[0] > 0 : true;
      if (up !== this.up[k]) {
        this.up[k] = up;
        changed = true;
        // Debris and ragdolls meet the wall, or its remains.
        effects?.setWallStanding(k, up);
      }
    }
    if (changed) this.redraw();
  }

  /** The section at a scenario index (for the break's debris and sound). */
  sectionAt(i: number): WallSection | null {
    return this.sections[i - this.base] ?? null;
  }

  private redraw(): void {
    if (!this.doc) return;
    draw(this.standing, this.doc, 'map_breakwall', this.faces.filter((_, k) => this.up[k]).map((f) => f.wall));
    draw(this.broken, this.doc, 'map_breakwall_rest', this.faces.filter((_, k) => !this.up[k]).map((f) => f.rest));
  }

  dispose(): void {
    if (this.doc) {
      draw(this.standing, this.doc, 'map_breakwall', []);
      draw(this.broken, this.doc, 'map_breakwall_rest', []);
    }
    this.doc = null;
    this.sections = [];
    this.faces = [];
  }
}

/** The faces of `own`, clipped against the level boxes near them. */
function clipped(own: WorldBox[], level: readonly WorldBox[]): { boxes: WorldBox[]; faces: RenderFace[] } {
  if (!own.length) return { boxes: [], faces: [] };
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const b of own) {
    const { min, max } = boxBounds(b);
    for (let a = 0; a < 3; a++) {
      lo[a] = Math.min(lo[a]!, min[a]! - 0.05);
      hi[a] = Math.max(hi[a]!, max[a]! + 0.05);
    }
  }
  const near = level.filter((b) => {
    const { min, max } = boxBounds(b);
    return min[0] <= hi[0]! && max[0] >= lo[0]! && min[1] <= hi[1]! && max[1] >= lo[1]! && min[2] <= hi[2]! && max[2] >= lo[2]!;
  });
  const boxes = [...own, ...near];
  return { boxes, faces: visibleFaces(boxes, (i) => i < own.length) };
}

/** Draw the sets' faces as one mesh set (by style), replacing the styler's last. */
function draw(styler: MapStyler, doc: MapDocument, name: string, sets: readonly { boxes: WorldBox[]; faces: RenderFace[] }[]): Mesh[] {
  const boxes: WorldBox[] = [];
  const faces: RenderFace[] = [];
  for (const s of sets) {
    const at = boxes.length;
    boxes.push(...s.boxes);
    for (const f of s.faces) faces.push(at ? { ...f, box: f.box + at } : f);
  }
  return styler.buildBoxes(doc, boxes, name, faces);
}
