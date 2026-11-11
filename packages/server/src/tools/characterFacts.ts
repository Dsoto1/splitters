import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MEASURED_HITBOXES, clipSetOf, type CharacterFacts, type CharacterLook, type ModelFacts } from '@tiletrigger/shared';

/**
 * What the content build recorded about each character, for the characters' quality gates
 * (packages/shared/src/content/characterGates.ts): read from the repo's own files, no renderer.
 *
 * - content/meshy.lock.json: each whole-body model's triangles, far copy and hands (its first-person arms too);
 * - content/characters/<id>.json: the triangles its cut asked for (`fixes.triangles`);
 * - content/models.json: the most triangles a character file may have (characterBudgets);
 * - content/clip-sets.lock.json (and a character's own `<id>_clips` in the Meshy lock): the clips each set holds;
 * - MEASURED_HITBOXES: the measured hit shapes;
 * - packages/client/src/frontend/portraitIndex.ts: the portraits shipped with the site.
 */
const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

interface LockFile extends ModelFacts {
  id: string;
  clips?: Record<string, unknown>;
}

/** A function giving the recorded facts of a look (a roster look: CORE_LOOKS). */
export function characterFacts(root = ROOT): (look: CharacterLook) => CharacterFacts {
  const read = (rel: string) => JSON.parse(readFileSync(join(root, rel), 'utf8'));
  const files = new Map<string, LockFile>((read('content/meshy.lock.json').files as LockFile[]).map((f) => [f.id, f]));
  const maxTriangles = read('content/models.json').characterBudgets.maxTriangles as number;
  // Clip sets by id: the shared ones (<set>_clips in their own lock) and a character's own (<id>_clips in the Meshy lock).
  const clips = new Map<string, string[]>();
  for (const f of [...(read('content/clip-sets.lock.json').files as LockFile[]), ...files.values()]) if (f.clips && f.id.endsWith('_clips')) clips.set(f.id.slice(0, -'_clips'.length), Object.keys(f.clips));
  const targets = new Map<string, number>();
  const dir = join(root, 'content/characters');
  for (const f of existsSync(dir) ? readdirSync(dir) : []) {
    if (!f.endsWith('.json')) continue;
    const m = read(`content/characters/${f}`) as { id: string; fixes?: { triangles?: number } };
    if (m.fixes?.triangles) targets.set(m.id, m.fixes.triangles);
  }
  const index = readFileSync(join(root, 'packages/client/src/frontend/portraitIndex.ts'), 'utf8');
  const portraits = new Set([...index.matchAll(/^\s*'([^']+)': '/gm)].map((m) => m[1]!));
  const model = (id: string | undefined): ModelFacts | undefined => {
    const f = id ? files.get(id) : undefined;
    return f ? { triangles: f.triangles, ...(f.lodTriangles ? { lodTriangles: f.lodTriangles } : {}), ...(f.hands !== undefined ? { hands: f.hands } : {}) } : undefined;
  };
  return (look) => {
    const body = look.whole ? look.parts[0] : undefined;
    const set = clipSetOf(look);
    const m = model(body);
    const arms = look.whole ? model(look.whole.arms) : undefined;
    const target = body ? targets.get(body) : undefined;
    const has = set ? clips.get(set) : undefined;
    return {
      ...(m ? { model: m } : {}),
      ...(arms ? { arms } : {}),
      maxTriangles,
      ...(target ? { targetTriangles: target } : {}),
      ...(has ? { clips: has } : {}),
      hitbox: look.id in MEASURED_HITBOXES,
      portrait: portraits.has(look.id),
    };
  };
}
