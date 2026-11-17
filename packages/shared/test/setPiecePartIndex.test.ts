// Part indices (docs/MAPMAKER_PAINTING_PLAN.md, "Risks"): a placement hides and paints its piece's parts by index
// (`overrides.hide`, `overrides.paint`), so a shipped piece whose parts are reordered would move a map's paint onto
// another part. Every part a map in maps/ hides or paints is pinned here by what it is (its kind and its tile, model,
// size or material); this test fails when one of them changes. A deliberate change: fix the maps in MapMaker, then
// rewrite the fixture with UPDATE_PART_INDEX=1.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { builtInSetPieces, type SetPieceDefinition } from '../src/index.ts';

const ROOT = new URL('../../../', import.meta.url);
const FIXTURE = new URL('fixtures/setPiecePartIndex.json', import.meta.url);
const pieces = builtInSetPieces().pieces;

const signature = (part: SetPieceDefinition['parts'][number] | undefined): string => {
  if (!part) return 'missing';
  switch (part.kind) {
    case 'tile':
      return `tile ${part.tile} ${part.x},${part.y},${part.z}`;
    case 'block':
      return `block ${part.size.join('x')} ${typeof part.material === 'string' ? part.material : JSON.stringify(part.material ?? null)}`;
    case 'prop':
      return `prop ${part.model}`;
    default:
      return part.kind;
  }
};

function pinned(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const dir of ['maps/', 'maps/templates/']) {
    for (const f of readdirSync(new URL(dir, ROOT)).filter((x) => x.endsWith('.json')).sort()) {
      const raw = JSON.parse(readFileSync(new URL(`${dir}${f}`, ROOT), 'utf8')) as { setPieces?: { piece: string; overrides?: { hide?: number[]; paint?: Record<string, unknown> } }[] };
      for (const p of raw.setPieces ?? []) {
        const def = pieces.get(p.piece);
        if (!def) continue;
        for (const i of [...(p.overrides?.hide ?? []), ...Object.keys(p.overrides?.paint ?? {}).map(Number)]) out[`${p.piece}#${i}`] = signature(def.parts[i]);
      }
    }
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : 1)));
}

describe('set-piece parts a map hides or paints by index', () => {
  it('are still the same parts', () => {
    const now = pinned();
    if (process.env.UPDATE_PART_INDEX) writeFileSync(FIXTURE, `${JSON.stringify(now, null, 1)}\n`);
    const before = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Record<string, string>;
    expect(now).toEqual(before);
    expect(Object.values(now)).not.toContain('missing');
  });
});
