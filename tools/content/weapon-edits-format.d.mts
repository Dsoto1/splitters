// Types for weapon-edits-format.mjs (the Weapon Manager's change set), for the client page (tools/weaponManager.ts).

export const CHANGE_SET_FORMAT: 'tiletrigger.weapon-edits';
export const CHANGE_SET_VERSION: 1;
export const TEXT_LIMITS: { name: number; description: number; note: number };
export type SoundSlot = 'fire' | 'alt' | 'reload';
export const SOUND_SLOTS: readonly SoundSlot[];
export const EDIT_KEYS: readonly string[];

export interface WeaponInfo {
  kind: string;
  pellets: number;
  magazine: number;
  reloadType: 'magazine' | 'shell' | null;
  hasFalloff: boolean;
  hasAccuracy: boolean;
  hasKick: boolean;
  hasBallistic: boolean;
  hasProjectile: boolean;
  hasAlt: boolean;
  category: string | null;
}

export interface StatField {
  path: string;
  label: string;
  unit: string;
  scale?: number;
  min: number;
  max: number;
  int?: boolean;
  list?: boolean;
  when: (w: WeaponInfo) => boolean;
}
export const STAT_FIELDS: readonly StatField[];
export function statField(path: string): StatField | undefined;
export function weaponInfo(def: object, family: object | null | undefined): WeaponInfo;
export function applicableStats(info: WeaponInfo): StatField[];
export function getPath(o: unknown, path: string): unknown;

export type StatValue = number | number[];
export interface WeaponEdit {
  name?: string;
  hidden?: boolean;
  category?: string;
  description?: string;
  sounds?: Partial<Record<SoundSlot, string>>;
  sets?: Record<string, boolean>;
  stats?: Record<string, StatValue>;
  note?: string;
  was?: Record<string, unknown>;
}
export interface ChangeSet {
  format: typeof CHANGE_SET_FORMAT;
  version: typeof CHANGE_SET_VERSION;
  created: string;
  from: string;
  weapons: Record<string, WeaponEdit>;
}
export function isEmptyEdit(e: WeaponEdit | undefined): boolean;
export function buildChangeSet(edits: Record<string, WeaponEdit>, meta?: { created?: string; from?: string }): ChangeSet;
export function statProblems(path: string, value: unknown, info?: WeaponInfo): string[];

export interface ValidationContext {
  weapons: Map<string, { name: string; info: WeaponInfo; current?: (path: string) => unknown }>;
  sounds: Set<string>;
  sets: readonly { id: string; weapons?: readonly string[] | 'all'; spawn?: readonly string[]; sniper?: string }[];
  categories: readonly string[];
  blockers: (id: string) => string[];
  canJoinSet: (id: string) => string | null;
}
export function validateChangeSet(cs: unknown, ctx: ValidationContext): { problems: string[]; warnings: string[] };
