// The set pieces' check in the game's own TypeScript, for tools/content/setpieces.mjs (which feeds it the content on
// stdin and reads {"problems": [...]} back):
//   node --experimental-transform-types --no-warnings tools/content/setpieces-check.ts < {"pieces": [...], "packs": [...]}
// Each piece against the map schema (SetPieceDefinition; an unknown field is a problem), against map/setPieceCheck.ts
// (tiles, props and materials exist, the footprint covers every part, ports face out, markers, mirror symmetry), then
// placed in a map in each turn, mirrored and not (when it may be), in each of its role packs and in a theme with none:
// validateMap must find no error in what it expands into.
import { readFileSync } from 'node:fs';
import { coreCatalog } from '../../packages/shared/src/map/catalog.ts';
import { SetPieceDefinition, SetPieceRoleValues, type MapDocument, type Rotation } from '../../packages/shared/src/map/schema.ts';
import { checkSetPieceDefinition } from '../../packages/shared/src/map/setPieceCheck.ts';
import type { SetPieceLibrary, SetPieceRolePack } from '../../packages/shared/src/map/setPieces.ts';
import { validateMap } from '../../packages/shared/src/map/validate.ts';
import { newMapDocument } from '../../packages/shared/src/editor/operations.ts';

interface Input {
  pieces: { where: string; def: unknown }[];
  packs: (Omit<SetPieceRolePack, 'roles'> & { roles: unknown })[];
}
const input = JSON.parse(readFileSync(0, 'utf8')) as Input;
const problems: string[] = [];

/** Fields of `raw` the schema dropped (zod strips what it doesn't know): typos, misplaced fields. */
function unknownFields(raw: unknown, parsed: unknown, path: string, out: string[]): string[] {
  if (Array.isArray(raw) && Array.isArray(parsed)) raw.forEach((x, i) => unknownFields(x, parsed[i], `${path}[${i}]`, out));
  else if (raw && typeof raw === 'object' && parsed && typeof parsed === 'object') {
    for (const [k, v] of Object.entries(raw)) {
      if (k === '$comment' || k === 'notes') continue;
      if (!(k in parsed)) out.push(`${path ? `${path}.` : ''}${k}`);
      else unknownFields(v, (parsed as Record<string, unknown>)[k], `${path ? `${path}.` : ''}${k}`, out);
    }
  }
  return out;
}

const packs = new Map<string, SetPieceRolePack>();
for (const p of input.packs) {
  const r = SetPieceRoleValues.safeParse(p.roles);
  if (!r.success) problems.push(...r.error.issues.map((i) => `content/setpieces/roles.json: ${p.id}: roles.${i.path.join('.')}: ${i.message}`));
  else packs.set(p.id, { ...p, roles: r.data });
}

const pieces = new Map<string, SetPieceDefinition>();
const where = new Map<string, string>();
for (const { where: w, def: raw } of input.pieces) {
  const r = SetPieceDefinition.safeParse(raw);
  if (!r.success) {
    problems.push(...r.error.issues.map((i) => `${w}: ${i.path.join('.') || '(root)'}: ${i.message}`));
    continue;
  }
  for (const f of unknownFields(raw, r.data, '', [])) problems.push(`${w}: unknown field "${f}"`);
  for (const p of checkSetPieceDefinition(r.data, { packs, catalog: coreCatalog })) problems.push(`${w}: ${p}`);
  pieces.set(r.data.id, r.data);
  where.set(r.data.id, w);
}

// Each piece in a map of its own, away from the map's one room and spawn: every turn, mirror and pack.
const library: SetPieceLibrary = { pieces, packs };
const base = newMapDocument('Set piece check', new Date(0));
for (const def of pieces.values()) {
  const seen = new Set<string>();
  for (const rotation of [0, 1, 2, 3] as Rotation[]) {
    for (const mirror of def.mirror === 'free' ? [false, true] : [false]) {
      for (const pack of [undefined, ...def.packs]) {
        const doc: MapDocument = { ...base, setPieces: [{ id: 'check_piece', piece: def.id, x: 40, y: 40, z: 2, rotation, mirror, ...(pack ? { pack } : {}) }] };
        for (const i of validateMap(doc, coreCatalog, library)) {
          if (i.severity !== 'error') continue;
          const line = `${where.get(def.id)}: placed${rotation ? ` turned ${rotation * 90}°` : ''}${mirror ? ' mirrored' : ''}${pack ? ` in ${pack}` : ''}: ${i.code}: ${i.message}`;
          if (!seen.has(i.message)) problems.push(line);
          seen.add(i.message);
        }
      }
    }
  }
}

process.stdout.write(JSON.stringify({ problems }));
