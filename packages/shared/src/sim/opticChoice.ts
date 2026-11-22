import { OPTIC_KINDS, WEAPON_OPTICS, type OpticKindId } from '../content/optics.generated.ts';

/**
 * A player's optic choice per weapon (docs/GUNPLAY_SPEC.md §15, "Optic choice"; the sights and scopes pass, step 4):
 * for each gun that may carry more than one optic (content/optics.json `allowed`), the one they picked in their
 * loadout (Profile → Favourite loadout → Optics). Weapon ID → optic kind; a gun not named carries its default.
 *
 * It travels in `hello` and the `optics` message (docs/MULTIPLAYER_PROTOCOL.md section 27), is kept on the player and
 * goes to everyone in the roster (`op`), so every client draws the optic each player picked; the match reads it only
 * for `PlayerSnapshot.zm` (a magnified optic's picture is up). Nothing about a shot depends on it: damage, spread,
 * recoil and timing are the gun's own whatever it carries. Bots carry each gun's default (they have no loadout).
 */
export type OpticChoices = Readonly<Record<string, OpticKindId>>;

/** Most entries a choice list may hold (more than there are guns with a choice). */
export const OPTIC_CHOICES_MAX = 64;

/**
 * A choice list from anywhere (a client's message, this browser's storage), made valid: only guns that have that
 * optic among their `allowed`, and not their default (the default needs no entry). Undefined when nothing is left.
 */
export function cleanOpticChoices(raw: unknown): OpticChoices | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
  const out: Record<string, OpticKindId> = {};
  let n = 0;
  for (const [id, kind] of Object.entries(raw as Record<string, unknown>)) {
    if (++n > OPTIC_CHOICES_MAX) break;
    const w = Object.prototype.hasOwnProperty.call(WEAPON_OPTICS, id) ? WEAPON_OPTICS[id] : undefined;
    if (!w || typeof kind !== 'string' || kind === w.default || !(w.allowed as readonly string[]).includes(kind)) continue;
    out[id] = kind as OpticKindId;
  }
  return Object.keys(out).length ? out : undefined;
}

/** The optic `weapon` is carried with under `choices` (its default when not chosen), or null: it carries none. */
export function chosenOptic(weapon: string, choices?: OpticChoices): OpticKindId | null {
  const w = Object.prototype.hasOwnProperty.call(WEAPON_OPTICS, weapon) ? WEAPON_OPTICS[weapon] : undefined;
  if (!w) return null;
  const c = choices?.[weapon];
  return c && w.allowed.includes(c) ? c : w.default;
}

/** A magnified optic: the 2-3x optics, the sniper scopes and the 2x optic built in code. */
export const magnifiedOptic = (id: OpticKindId | null): boolean => !!id && (OPTIC_KINDS[id].mag !== undefined || OPTIC_KINDS[id].power !== undefined);

/** Two choice lists say the same. */
export function sameOpticChoices(a: OpticChoices | undefined, b: OpticChoices | undefined): boolean {
  const ka = Object.keys(a ?? {});
  if (ka.length !== Object.keys(b ?? {}).length) return false;
  return ka.every((k) => a![k] === b?.[k]);
}
