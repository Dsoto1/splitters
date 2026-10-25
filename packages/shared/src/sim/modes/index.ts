import type { GameMode } from '../rules.ts';
import { CtfMode } from './ctf.ts';
import { ElimMode } from './elim.ts';
import { BombMode } from './bomb.ts';
import { HostageMode } from './hostage.ts';
import { KothMode } from './koth.ts';
import type { ModeHost, ModeLogic } from './types.ts';

export type { BotGoal, ModeHost, ModeLogic } from './types.ts';
export { CtfMode, FLAG_CAPTURE_RADIUS, FLAG_CARRIER_SPEED, FLAG_TOUCH_RADIUS, type FlagRt } from './ctf.ts';
export { CARRIER_AWARENESS, ctfBotAwareness, ctfBotGoal, ctfRole, type CtfRole } from './ctfBots.ts';
export { KothMode, onHill, type HillRt } from './koth.ts';
export { ElimMode, ELIM_BREAK_SECONDS, ELIM_ROUND_SECONDS } from './elim.ts';
export { HostageMode, HOSTAGE_ROUND_SECONDS } from './hostage.ts';
export { BombMode, BOMB_DEFUSE_SECONDS, BOMB_FUSE_SECONDS, BOMB_PLANT_SECONDS, BOMB_ROUND_SECONDS } from './bomb.ts';

/** The objective rules for a mode, or null for modes without any (deathmatch, TDM, co-op). */
export function createMode(mode: GameMode, host: ModeHost): ModeLogic | null {
  switch (mode) {
    case 'core.ctf':
      return new CtfMode(host);
    case 'core.koth':
      return new KothMode(host);
    case 'core.elim':
      return new ElimMode(host);
    case 'core.bomb':
      return new BombMode(host);
    case 'core.hostage':
      return new HostageMode(host);
    default:
      return null;
  }
}
