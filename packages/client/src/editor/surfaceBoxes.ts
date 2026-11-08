import { blockBoxes, propBoxes, type MapDocument, type WorldBox } from '@tiletrigger/shared';

/**
 * What props and the measure tool land on (surfaceSnap.ts): the map's boxes as drawn (the tiles shown, barriers left
 * out) with blocks and solid props, the levels above the one being edited left out unless every level is shown.
 * Worked out once per document version and view, not per pointer move.
 */
export class SurfaceBoxes {
  private key: { doc: MapDocument; tiles: readonly WorldBox[]; level: number; all: boolean } | null = null;
  private boxes: WorldBox[] = [];
  /** The ids of things (blocks, props) among them: the measure tool snaps to their tops' middles. */
  objects = new Set<string>();

  get(doc: MapDocument, tiles: readonly WorldBox[], level: number, showAll: boolean): WorldBox[] {
    const k = this.key;
    if (k && k.doc === doc && k.tiles === tiles && k.level === level && k.all === showAll) return this.boxes;
    this.key = { doc, tiles, level, all: showAll };
    const top = (level + 1) * doc.classicStructure.levelHeight;
    const things = [...blockBoxes(doc), ...blockBoxes(doc, true), ...propBoxes(doc), ...propBoxes(doc, true)].filter((b) => showAll || b.min[1] < top);
    this.objects = new Set(things.map((b) => b.sourceId));
    this.boxes = [...tiles.filter((b) => b.kind !== 'barrier'), ...things];
    return this.boxes;
  }
}
