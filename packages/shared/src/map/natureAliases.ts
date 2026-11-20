/**
 * Retired natural props (the nature swap, docs/PROCEDURAL_ENVIRONMENT.md, "The nature swap"): once no shipped map
 * placed them, the Quaternius Ultimate Nature pack left the build (owner, 2026-11-18). An older map that still
 * places one of its trees, bushes, plants, logs or rocks loads all the same: each placement becomes the generated
 * species the swap table names (editor/natureSwap.ts, the same pick by its id, its rocks by the map's ground), with
 * its id, spot, turn, name and flags. Its model has no file any more, so this happens on every load, in MapMaker too
 * (unlike the kit aliases, which MapMaker keeps as made): an exported map names the species.
 *
 * A prop is retired here when the swap table lists it and the catalogue no longer has it, so a later pack can leave
 * the build the same way. A map's own set pieces' props upgrade too. Not a format change: no field is added, and a map
 * that never placed a retired prop is untouched.
 */
import { getProp } from '../content/props.ts';
import { autoRockLook, natureSwapEntity, natureSwapHas } from '../editor/natureSwap.ts';
import type { MapDocument, PropEntity } from './schema.ts';

/** True when `model` is a natural prop that left the build (its placements load as the species that replaced it). */
export const isRetiredNatureProp = (model: string): boolean => natureSwapHas(model) && !getProp(model);

/** The map with every retired natural prop it places (and its own set pieces place) as its generated species. */
export function withNatureAliases<T extends MapDocument>(doc: T): T {
  const retired = (e: { kind: string; model?: string }) => e.kind === 'prop' && !!e.model && isRetiredNatureProp(e.model);
  const defs = doc.setPieceDefs ?? [];
  if (!doc.entities.some(retired) && !defs.some((d) => d.parts.some(retired))) return doc;
  const look = autoRockLook(doc);
  const entities = doc.entities.map((e) => (retired(e) ? (natureSwapEntity(e as PropEntity, look) ?? e) : e));
  if (!defs.some((d) => d.parts.some(retired))) return { ...doc, entities };
  const setPieceDefs = defs.map((d) =>
    d.parts.some(retired)
      ? {
          ...d,
          parts: d.parts.map((p, i) => {
            if (!retired(p)) return p;
            // A part has no id of its own: its piece and place pick among a mix.
            const { id: _id, ...next } = natureSwapEntity({ ...(p as Omit<PropEntity, 'id'>), id: `${d.id}#${i}` } as PropEntity, look)!;
            return { ...next, ...('when' in p ? { when: p.when } : {}) } as typeof p;
          }),
        }
      : d,
  );
  return { ...doc, entities, setPieceDefs };
}
