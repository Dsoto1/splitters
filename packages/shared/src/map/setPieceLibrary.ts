/**
 * The shipped set pieces and role packs (content/setpieces/, built into content/setPieces.generated.ts by
 * tools/content/setpieces.mjs), parsed once when a map first needs them. Only map loading and checking read this
 * (validate.ts), so it loads with the map content, never with the menu (docs/LOADING.md; tools/ci/bundle-budget.mjs).
 */
import { SET_PIECE_DEFS, SET_PIECE_PACKS } from '../content/setPieces.generated.ts';
import { SetPieceDefinition, SetPieceRoleValues } from './schema.ts';
import type { SetPieceLibrary } from './setPieces.ts';

let library: SetPieceLibrary | undefined;

/** The shipped set pieces (by id) and role packs (by id). */
export function builtInSetPieces(): SetPieceLibrary {
  return (library ??= {
    pieces: new Map(SET_PIECE_DEFS.map((d) => {
      const def = SetPieceDefinition.parse(d);
      return [def.id, def] as const;
    })),
    packs: new Map(SET_PIECE_PACKS.map((p) => [p.id, { ...p, roles: SetPieceRoleValues.parse(p.roles) }] as const)),
  });
}
