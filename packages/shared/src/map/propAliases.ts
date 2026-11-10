/**
 * Retired catalogue props (docs/PROCEDURAL_ENVIRONMENT.md §11 Phase 6, "Migration"): a Kenney crate or barrel that a
 * generated kit family now replaces leaves MapMaker's palette but stays readable. content/kitprops.json `aliases`
 * names the family and variant for each (content/kitProps.ts `propAlias`), with a scale factor; the families take the
 * retired props' exact sizes, so the factor is 1 and collision, footing and paths stay as they were.
 *
 * - As played, loadMap gives each placement of a retired prop the family and variant (`withPropAliases`, after set
 *   pieces are expanded, so a set piece's own props upgrade too): saved and shipped maps that place it keep working and
 *   draw the new piece. Its id, position, facing, solid and tint go with it.
 * - MapMaker opens the map as made (the retired prop stays) and offers "Replace all" in the prop inspector, so an
 *   exported map names the family.
 * Not a format change: no field is added, and a map that never placed a retired prop is untouched.
 */
import { propAlias } from '../content/kitProps.ts';
import type { MapDocument, MapEntity } from './schema.ts';

/** The entity with its retired prop model swapped for the family and variant that replace it (the entity itself otherwise). */
export function aliasedProp<E extends MapEntity>(e: E): E {
  if (e.kind !== 'prop') return e;
  const a = propAlias(e.model);
  if (!a) return e;
  const scale = Math.min(4, Math.max(0.25, Math.round(e.scale * a.scale * 1e4) / 1e4));
  return { ...e, model: a.model, variant: a.variant, scale };
}

/** The map with every retired prop it places replaced by its kit family (the map itself when it places none). */
export function withPropAliases<T extends MapDocument>(doc: T): T {
  if (!doc.entities.some((e) => e.kind === 'prop' && propAlias(e.model))) return doc;
  return { ...doc, entities: doc.entities.map(aliasedProp) };
}
