/**
 * Shared looks (environment Phase 5): a species' looks (its material variants: summer and autumn, green and dry,
 * bare and mossy) are most often the same model painted differently, so they can share one batch per square: one
 * mesh carries each look's vertex colours (`envLook1`…), and each copy says which look it wears (`envLook`, an
 * instance value; EnvLooksPlugin picks the colour in the vertex shader). Draws then grow with the species in view,
 * not with their looks. Looks whose shapes differ (the snow-laden conifers, the meadow flowers' heads) and the
 * crossed-card stand-ins (each look its own picture) keep their own batches.
 *
 * This file only decides which looks can share, level by level; it reads no Babylon state, so it is tested on its own.
 */

/** At most this many looks share one mesh (the base colour and three more vertex attributes, within WebGL2's 16). */
export const MAX_SHARED_LOOKS = 4;

/** What sharing compares of one part of a level of detail. */
export interface LookPart {
  material: string;
  /** Whether the part has its own picture (a stand-in): such parts never share. */
  texture: unknown;
  data: { positions?: ArrayLike<number> | null; indices?: ArrayLike<number> | null; normals?: ArrayLike<number> | null; uvs?: ArrayLike<number> | null; colors?: ArrayLike<number> | null };
  wind: ArrayLike<number> | null;
  sideOrientation: number;
}

export interface LookLevel {
  crossed: boolean;
  parts: readonly LookPart[];
}

function same(a: ArrayLike<number> | null | undefined, b: ArrayLike<number> | null | undefined): boolean {
  if (!a || !b) return !a && !b;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Whether two looks' levels are one shape (only their colours may differ), so they can be drawn as one mesh. */
export function sameShape(a: LookLevel, b: LookLevel): boolean {
  if (a.crossed || b.crossed || a.parts.length !== b.parts.length) return false;
  return a.parts.every((p, i) => {
    const q = b.parts[i]!;
    return (
      !p.texture &&
      !q.texture &&
      p.material === q.material &&
      p.sideOrientation === q.sideOrientation &&
      !!p.data.colors &&
      !!q.data.colors &&
      same(p.data.positions, q.data.positions) &&
      same(p.data.indices, q.data.indices) &&
      same(p.data.normals, q.data.normals) &&
      same(p.data.uvs, q.data.uvs) &&
      same(p.wind, q.wind)
    );
  });
}

/**
 * Sort one species' placed looks (their files, in the species' own order) into sets that share a batch at one level:
 * each set is looks of one shape, at most MAX_SHARED_LOOKS of them, the first of each set its base. Looks with no
 * such level (fewer levels) are left out; a look alone is a set of one (its own batch, as before).
 */
export function lookSets(files: readonly string[], levelOf: (file: string) => LookLevel | undefined, max = MAX_SHARED_LOOKS): string[][] {
  const sets: { base: LookLevel; files: string[] }[] = [];
  for (const f of files) {
    const level = levelOf(f);
    if (!level) continue;
    const set = sets.find((s) => s.files.length < max && sameShape(s.base, level));
    if (set) set.files.push(f);
    else sets.push({ base: level, files: [f] });
  }
  return sets.map((s) => s.files);
}

/** The species part of a variant's file (`env/conifer.spruce.snow.glb` → `conifer.spruce`). */
export function speciesOfFile(file: string): string {
  const name = file.replace(/^.*\//, '').replace(/\.glb$/, '');
  return name.slice(0, name.lastIndexOf('.'));
}
