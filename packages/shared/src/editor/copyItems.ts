import type { MapEntity, SetPiecePlacement, TilePlacement } from '../map/schema.ts';
import { newId } from './commands.ts';

/** Tiles, entities and set-piece placements taken together (a selection's things, a clipboard's). */
export interface MapItems {
  tiles: TilePlacement[];
  entities: MapEntity[];
  setPieces: SetPiecePlacement[];
}

/**
 * Copies with new ids (duplicate, paste, a mirrored copy), referring to each other: a copied mover carries the copied
 * blocks and props, and a portal pair copied whole is linked by a new pair id (half a pair keeps its pair). `idMap`:
 * each original's copy.
 */
export function freshCopies(items: MapItems): MapItems & { idMap: Map<string, string> } {
  const idMap = new Map<string, string>();
  const tiles = items.tiles.map((t) => {
    const id = newId('tile');
    idMap.set(t.id, id);
    return { ...t, id };
  });
  const setPieces = items.setPieces.map((p) => {
    const id = newId('setpiece');
    idMap.set(p.id, id);
    return { ...p, id };
  });
  for (const e of items.entities) idMap.set(e.id, newId(e.kind));
  const pairs = new Map<string, string>();
  for (const e of items.entities) if (e.kind === 'portal' && !pairs.has(e.pair) && items.entities.filter((o) => o.kind === 'portal' && o.pair === e.pair).length === 2) pairs.set(e.pair, newId('pair'));
  const entities = items.entities.map((e): MapEntity => {
    const copy = { ...e, id: idMap.get(e.id)! } as MapEntity;
    if (copy.kind === 'mover') {
      copy.blocks = copy.blocks.map((id) => idMap.get(id) ?? id);
      if (copy.props) copy.props = copy.props.map((id) => idMap.get(id) ?? id);
    }
    if (copy.kind === 'portal' && pairs.has(copy.pair)) copy.pair = pairs.get(copy.pair)!;
    return copy;
  });
  return { tiles, entities, setPieces, idMap };
}
