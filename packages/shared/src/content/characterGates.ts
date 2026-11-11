import { CORE_LOOKS, DEFAULT_CLIP_SET, characterTier, clipSetOf, type CharacterLook, type CharacterTier } from './looks.ts';

/**
 * Quality gates for characters (owner, 2026-11-11: the same rules as for maps, map/qualityGates.ts). To be `core` a
 * character passes every blocking gate; for an `experimental` one they only report. These are the headless gates:
 * what the build already measured and recorded (the model locks, the clip sets, the hit shapes, the shipped
 * portraits). `pnpm quality-gates` prints them after the maps'; the facts are read by
 * packages/server/src/tools/characterFacts.ts.
 *
 * Not here (they need the game's renderer; a later step): how the hands sit on each gun (the grip sheet), what the
 * portrait and the face look like, clipping in first person.
 */
export interface CharacterGate {
  id: CharacterGateId;
  /** What it checks, in a few words. */
  label: string;
  ok: boolean;
  /** What was found. */
  note: string;
  /** False: it only reports, even for a core character (REPORT_ONLY_CHARACTER_GATES). */
  blocking: boolean;
}
export type CharacterGateId = 'triangles' | 'lod' | 'hands' | 'clips' | 'hitbox' | 'portrait';

/** The clips a whole clip set holds, as the game asks for them (CLIP_SET_CLIPS in tools/content/character-manifests.mjs; a test keeps them equal). */
export const CLIP_SET_CLIPS = ['clip_walk', 'clip_run', 'clip_shoot_fwd', 'clip_shoot_run', 'clip_shoot_back'] as const;

/**
 * Gates that only report for every tier, with why. Empty today: every gate below passes for the whole core roster.
 * A gate the core roster fails goes here (with a TODO for the owner) instead of weakening the roster.
 */
export const REPORT_ONLY_CHARACTER_GATES: Readonly<Partial<Record<CharacterGateId, string>>> = {};

/** One built model file as its lock records it (content/meshy.lock.json). */
export interface ModelFacts {
  triangles: number;
  /** Its far copy's triangles (absent: none built). */
  lodTriangles?: number;
  /** Whether its hands were measured and fitted (finger joints, the palm). */
  hands?: boolean;
}

/** What the build recorded about one character; a part left out is a gate skipped (it doesn't apply or isn't recorded). */
export interface CharacterFacts {
  /** A whole-body character's model (absent: a look built from the shared parts, whose files are budgeted in content:check). */
  model?: ModelFacts;
  /** Its own first-person arms' file (absent: it wears a universal arms part, or isn't whole-body). */
  arms?: ModelFacts;
  /** The most triangles a character file may have (content/models.json characterBudgets.maxTriangles). */
  maxTriangles?: number;
  /** The triangles its manifest asked the cut for (`fixes.triangles`): told in the note, not judged. */
  targetTriangles?: number;
  /** The clips built into the clip set it moves with (absent: the set isn't built). */
  clips?: readonly string[];
  /** Whether its hit shape was measured from its model (MEASURED_HITBOXES). */
  hitbox: boolean;
  /** Whether a portrait of it ships with the site (SHIPPED_PORTRAITS). */
  portrait: boolean;
}

/** A character's headless gates. Whole-body only: triangles, lod, hands (a parts-built look has no file of its own to judge). */
export function characterGates(look: Pick<CharacterLook, 'id' | 'clips' | 'locomotion' | 'whole'>, facts: CharacterFacts): CharacterGate[] {
  const out: CharacterGate[] = [];
  const add = (id: CharacterGateId, label: string, ok: boolean, note: string) => out.push({ id, label, ok, note, blocking: !(id in REPORT_ONLY_CHARACTER_GATES) });
  const m = facts.model;
  if (look.whole) {
    if (!m) add('triangles', 'Within its triangle budget', false, 'no built model recorded (content/meshy.lock.json)');
    else {
      const max = facts.maxTriangles ?? Infinity;
      const target = facts.targetTriangles ? ` (its cut asked for ${facts.targetTriangles})` : '';
      add('triangles', 'Within its triangle budget', m.triangles <= max, `${m.triangles} of ${max} triangles${target}`);
      add('lod', 'A far copy', (m.lodTriangles ?? 0) > 0 && m.lodTriangles! < m.triangles, m.lodTriangles ? `${m.lodTriangles} triangles far away` : 'no low-detail copy built');
      const a = facts.arms;
      const own = look.whole.arms.endsWith('_fparms');
      const handsOk = m.hands === true && (!own || a?.hands === true);
      add('hands', 'Hands measured', handsOk, handsOk ? (own ? 'body and first-person arms' : 'body (universal first-person arms)') : m.hands !== true ? 'the body\'s hands were not measured' : 'its first-person arms are not built or their hands were not measured');
    }
  }
  const set = clipSetOf(look);
  if (set === null) add('clips', 'Clip set complete', true, look.locomotion === 'roll' ? 'rolls: no gait clips' : 'the rig\'s own gait (opted out)');
  else {
    const missing = CLIP_SET_CLIPS.filter((c) => !facts.clips?.includes(c));
    add('clips', 'Clip set complete', !!facts.clips && !missing.length, !facts.clips ? `clip set ${set} is not built` : missing.length ? `${set} lacks ${missing.join(', ')}` : `${set}${set === DEFAULT_CLIP_SET ? ' (the default)' : ''}: all ${CLIP_SET_CLIPS.length} clips`);
  }
  add('hitbox', 'Hit shape measured', facts.hitbox, facts.hitbox ? 'measured from its model' : 'no measured hit shape (run node tools/content/hitboxes.mjs)');
  add('portrait', 'Portrait shipped', facts.portrait, facts.portrait ? 'in the portrait index' : 'no shipped portrait (the Capture portraits workflow)');
  return out;
}

export interface CharacterGateReport {
  look: string;
  name: string;
  tier: CharacterTier;
  gates: CharacterGate[];
  /** The gates it fails that count against it: blocking ones, when it is core. */
  failing: CharacterGate[];
}

/** The gates of every look of a roster (CORE_LOOKS unless given), with the facts `factsFor` finds for each. */
export function characterGateReports(factsFor: (look: CharacterLook) => CharacterFacts, roster: readonly CharacterLook[] = CORE_LOOKS): CharacterGateReport[] {
  return roster.map((l) => {
    const tier = characterTier(l);
    const gates = characterGates(l, factsFor(l));
    // A core character must pass; for an experimental one the gates only report.
    return { look: l.id, name: l.name, tier, gates, failing: tier === 'core' ? gates.filter((g) => !g.ok && g.blocking) : [] };
  });
}
