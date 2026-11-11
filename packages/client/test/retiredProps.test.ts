/**
 * Retired catalogue props (content/kitprops.json `aliases`: the Kenney pieces our kit families replaced) stay loadable
 * for old maps, and nothing of ours names them any more: the set pieces, Dress room's recipes, the Style Packs and
 * the scenery belt past a map's edge all name the families. This fails when one of them names a retired prop again.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { KIT_ALIASES, ROOM_TYPES, STYLE_PACKS, builtInSetPieces, getProp, isKitModel, recipeModels } from '@tiletrigger/shared';
import { beltModels } from '../src/backdrop.ts';

const ROOT = new URL('../../../', import.meta.url);
const aliases = JSON.parse(readFileSync(new URL('content/kitprops.json', ROOT), 'utf8')).aliases as Record<string, { model: string }>;
const retired = new Set(Object.keys(aliases));

describe('retired props', () => {
  it('are named by no set piece, Dress room recipe, Style Pack or scenery belt', () => {
    expect(retired.size).toBeGreaterThan(40);
    expect([...retired].sort()).toEqual(KIT_ALIASES.map((a) => a.from).sort());

    // What each names, by where: every list is read, and each names kit families (so the check sees real ids).
    const named: Record<string, string[]> = {};
    const families = readdirSync(new URL('content/setpieces/', ROOT)).filter((f) => f.endsWith('.json') && f !== 'roles.json' && f !== 'aliases.json');
    for (const f of families) {
      const json = JSON.parse(readFileSync(new URL(`content/setpieces/${f}`, ROOT), 'utf8')) as { pieces: { id: string; parts: { kind: string; model?: string }[] }[] };
      for (const p of json.pieces) named[`content/setpieces/${f} ${p.id}`] = p.parts.flatMap((q) => (q.kind === 'prop' && q.model ? [q.model] : []));
    }
    // (As built: the generated table map loading reads.)
    for (const [id, def] of builtInSetPieces().pieces) named[`built set piece ${id}`] = def.parts.flatMap((q) => (q.kind === 'prop' ? [q.model] : []));
    for (const t of ROOM_TYPES) named[`Dress room: ${t}`] = recipeModels(t);
    for (const p of STYLE_PACKS) named[`Style Pack ${p.id}`] = [...p.props];
    named['scenery belt'] = beltModels();

    const hits = Object.entries(named).flatMap(([where, models]) => models.filter((m) => retired.has(m)).map((m) => `${where}: ${m} (now ${aliases[m]!.model})`));
    expect(hits).toEqual([]);

    const all = Object.values(named).flat();
    expect(all.length).toBeGreaterThan(1000);
    for (const group of ['content/setpieces/', 'built set piece', 'Dress room', 'Style Pack', 'scenery belt']) {
      const models = Object.entries(named).filter(([where]) => where.startsWith(group)).flatMap(([, m]) => m);
      expect(models.some(isKitModel), `${group}: names a kit family`).toBe(true);
    }
    // Every prop or kit family named exists (the plants of the belt are species, `env.…`).
    for (const m of new Set(all)) if (!m.startsWith('env.')) expect(getProp(m), m).toBeTruthy();
  });
});
