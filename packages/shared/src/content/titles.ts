/**
 * Titles (docs/PLAYER_PROFILES_PLAN.md, Phase 2): a word a player wears on their profile card, picked on Profile from
 * the ones their career has earned. A small table: each title says how it's earned and checks a career for it. The hub
 * takes a signed-in player's pick only when their career (as the hub keeps it) has earned it; a guest's browser checks
 * its own career. Just for show: nothing reads a title for matchmaking or rewards.
 */
import { careerAccuracy, careerKd, type Career } from '../net/career.ts';

export interface TitleDef {
  id: string;
  name: string;
  /** How it's earned, as Profile says it. */
  how: string;
  earned(c: Career): boolean;
}

const maxWeapon = (c: Career): number => Math.max(0, ...Object.values(c.weaponKills));
const modeWins = (c: Career): number => Object.values(c.modes ?? {}).filter((m) => m.wins > 0).length;

export const TITLES: readonly TitleDef[] = [
  { id: 'recruit', name: 'Recruit', how: 'Play a match to the end', earned: (c) => c.matches >= 1 },
  { id: 'regular', name: 'Regular', how: '25 matches', earned: (c) => c.matches >= 25 },
  { id: 'veteran', name: 'Veteran', how: '100 matches', earned: (c) => c.matches >= 100 },
  { id: 'champion', name: 'Champion', how: '50 wins', earned: (c) => c.wins >= 50 },
  { id: 'marksman', name: 'Marksman', how: '40% accuracy over 50 matches', earned: (c) => c.matches >= 50 && (careerAccuracy(c) ?? 0) >= 40 },
  { id: 'headhunter', name: 'Headhunter', how: '100 headshot kills', earned: (c) => c.headshots >= 100 },
  { id: 'unstoppable', name: 'Unstoppable', how: '10 kills in one life', earned: (c) => c.bestStreak >= 10 },
  { id: 'survivor', name: 'Survivor', how: 'K/D of 2 or better over 25 matches', earned: (c) => c.matches >= 25 && careerKd(c) >= 2 },
  { id: 'centurion', name: 'Centurion', how: '1,000 kills', earned: (c) => c.kills >= 1000 },
  { id: 'specialist', name: 'Specialist', how: '250 kills with one weapon', earned: (c) => maxWeapon(c) >= 250 },
  { id: 'allrounder', name: 'All-Rounder', how: 'A win in 5 different modes', earned: (c) => modeWins(c) >= 5 },
  { id: 'marathoner', name: 'Marathoner', how: '24 hours played', earned: (c) => c.seconds >= 24 * 3600 },
];

const BY_ID = new Map(TITLES.map((t) => [t.id, t]));
export const isTitleId = (v: unknown): v is string => typeof v === 'string' && BY_ID.has(v);
/** A title's name ('' for none or one we don't have). */
export const titleName = (id: string | null | undefined): string => (id ? (BY_ID.get(id)?.name ?? '') : '');
/** The titles a career has earned, in the table's order. */
export const earnedTitles = (c: Career): string[] => TITLES.filter((t) => t.earned(c)).map((t) => t.id);
/** Whether `c` has earned title `id`. */
export const hasTitle = (c: Career, id: string): boolean => !!BY_ID.get(id)?.earned(c);
