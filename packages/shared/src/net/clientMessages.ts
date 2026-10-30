import { HOST_BOT_SKILLS, HOST_BOT_STYLES, type ClientMessage, type HostCommand, type HostRulesPatch } from '../protocol.ts';
import { isMapId } from '../sim/playlist.ts';
import { ROTATION_MAX } from '../sim/rotation.ts';
import { validateBotSet } from '../sim/botSet.ts';
import { isGameMode, type GameMode } from '../sim/rules.ts';
import type { PlayerInput } from '../sim/movement.ts';

/**
 * Checking what a client sends: shared by the dedicated server and a browser
 * hosting a match for friends ("Host game"), so both trust a client exactly
 * as little.
 */
const MAX_INPUTS_PER_MESSAGE = 32;

/** A player name with control characters stripped, at most 32 characters (24 plus a clan tag). */
export function sanitizeName(name: string): string {
  const clean = name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 32);
  return clean || 'Player';
}

/** Structural validation of untrusted client JSON. Values are clamped later by the simulation. */
export function parseClientMessage(text: string): ClientMessage | null {
  let m: unknown;
  try {
    m = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof m !== 'object' || m === null) return null;
  const o = m as Record<string, unknown>;
  switch (o.t) {
    case 'hello':
      return typeof o.protocol === 'number' && typeof o.name === 'string'
        ? { t: 'hello', protocol: o.protocol, name: o.name, ...(typeof o.look === 'string' && o.look.length <= 64 ? { look: o.look } : {}), ...(typeof o.admin === 'string' && o.admin && o.admin.length <= 200 ? { admin: o.admin } : {}), ...(typeof o.pk === 'string' && /^p_[A-Za-z0-9_-]{8,32}$/.test(o.pk) ? { pk: o.pk } : {}), ...(typeof o.ticket === 'string' && o.ticket.length <= 1000 ? { ticket: o.ticket } : {}) }
        : null;
    case 'admin':
      return typeof o.token === 'string' && o.token.length <= 200 ? { t: 'admin', token: o.token } : null;
    case 'host': {
      const cmd = parseHostCommand(o.cmd);
      return cmd ? { t: 'host', cmd } : null;
    }
    case 'ready':
      return { t: 'ready' };
    case 'ping':
      if (typeof o.id !== 'number' || typeof o.ct !== 'number') return null;
      return { t: 'ping', id: o.id, ct: o.ct, ...(typeof o.rtt === 'number' && Number.isFinite(o.rtt) && o.rtt >= 0 ? { rtt: Math.min(9999, Math.round(o.rtt)) } : {}) };
    case 'input': {
      if (!Array.isArray(o.inputs) || o.inputs.length > MAX_INPUTS_PER_MESSAGE) return null;
      const inputs: PlayerInput[] = [];
      for (const raw of o.inputs) {
        if (typeof raw !== 'object' || raw === null) return null;
        const r = raw as Record<string, unknown>;
        const fields = ['seq', 'forward', 'right', 'yaw', 'pitch', 'buttons'] as const;
        if (!fields.every((f) => typeof r[f] === 'number')) return null;
        const input: PlayerInput = { seq: r.seq as number, forward: r.forward as number, right: r.right as number, yaw: r.yaw as number, pitch: r.pitch as number, buttons: r.buttons as number };
        // Optional fields: weapon selection and the tick the player was viewing (lag compensation).
        if (typeof r.weapon === 'number') input.weapon = r.weapon;
        if (typeof r.viewTick === 'number') input.viewTick = r.viewTick;
        if (typeof r.say === 'number') input.say = r.say;
        if (typeof r.build === 'number') input.build = r.build;
        inputs.push(input);
      }
      return { t: 'input', inputs };
    }
    default:
      return null;
  }
}

const count = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 1000;

/** A host command's shape (whether the sender may run the match is the host's to check). */
function parseHostCommand(raw: unknown): HostCommand | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  switch (o.c) {
    case 'bots': {
      if (o.fill !== undefined && !count(o.fill)) return null;
      if (o.teamSize !== undefined && !count(o.teamSize)) return null;
      if (o.teamSizes !== undefined && !(Array.isArray(o.teamSizes) && o.teamSizes.length >= 2 && o.teamSizes.length <= 8 && o.teamSizes.every(count))) return null;
      if (o.skill !== undefined && !(HOST_BOT_SKILLS as readonly unknown[]).includes(o.skill)) return null;
      if (o.style !== undefined && !(HOST_BOT_STYLES as readonly unknown[]).includes(o.style)) return null;
      // The bot set: made valid here (names cleaned and capped, unknown looks random); not a set at all: refused.
      let botSet: Extract<HostCommand, { c: 'bots' }>['botSet'];
      if (o.botSet === null) botSet = null;
      else if (o.botSet !== undefined) {
        const v = validateBotSet(o.botSet);
        if (!v) return null;
        botSet = v.set;
      }
      const cmd = { c: 'bots', fill: o.fill, teamSize: o.teamSize, teamSizes: Array.isArray(o.teamSizes) ? [...(o.teamSizes as number[])] : undefined, skill: o.skill, style: o.style, botSet } as Extract<HostCommand, { c: 'bots' }>;
      for (const k of ['fill', 'teamSize', 'teamSizes', 'skill', 'style', 'botSet'] as const) if (cmd[k] === undefined) delete cmd[k];
      return cmd;
    }
    case 'rules': {
      const r = o.rules;
      if (typeof r !== 'object' || r === null) return null;
      const p = r as Record<string, unknown>;
      const rules: HostRulesPatch = {};
      if (p.scoreLimit !== undefined) {
        if (!count(p.scoreLimit)) return null;
        rules.scoreLimit = p.scoreLimit;
      }
      if (p.timeLimitSeconds !== undefined) {
        if (!(typeof p.timeLimitSeconds === 'number' && Number.isInteger(p.timeLimitSeconds) && p.timeLimitSeconds >= 0 && p.timeLimitSeconds <= 7200)) return null;
        rules.timeLimitSeconds = p.timeLimitSeconds;
      }
      if (p.respawnDelayTicks !== undefined) {
        if (!count(p.respawnDelayTicks)) return null;
        rules.respawnDelayTicks = p.respawnDelayTicks;
      }
      if (p.friendlyFire !== undefined) {
        if (p.friendlyFire !== 'off' && p.friendlyFire !== 'half' && p.friendlyFire !== 'on') return null;
        rules.friendlyFire = p.friendlyFire;
      }
      if (p.mixPickups !== undefined) {
        if (typeof p.mixPickups !== 'boolean') return null;
        rules.mixPickups = p.mixPickups;
      }
      return { c: 'rules', rules };
    }
    case 'map':
      if (typeof o.map !== 'string' || !o.map || o.map.length > 80) return null;
      if (o.mode !== undefined && (typeof o.mode !== 'string' || !isGameMode(o.mode))) return null;
      return { c: 'map', map: o.map, ...(o.mode !== undefined ? { mode: o.mode as Extract<HostCommand, { c: 'map' }>['mode'] & string } : {}) };
    case 'kick':
    case 'ban': {
      if (!(typeof o.slot === 'number' && Number.isInteger(o.slot) && o.slot >= 0 && o.slot < 1000)) return null;
      const reason = typeof o.reason === 'string' ? o.reason.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 80) : '';
      if (o.c === 'kick') return { c: 'kick', slot: o.slot, ...(reason ? { reason } : {}) };
      if (o.minutes !== undefined && !(typeof o.minutes === 'number' && Number.isInteger(o.minutes) && o.minutes >= 0 && o.minutes <= 525_600)) return null;
      return { c: 'ban', slot: o.slot, ...(o.minutes ? { minutes: o.minutes as number } : {}), ...(reason ? { reason } : {}) };
    }
    case 'rotation': {
      // Shapes only: whether each map is ours and plays that mode is the host's to check.
      if (o.shuffle !== undefined && typeof o.shuffle !== 'boolean') return null;
      if (o.entries !== undefined && !(Array.isArray(o.entries) && o.entries.length <= ROTATION_MAX)) return null;
      const entries: { map: string; mode: GameMode }[] = [];
      for (const e of (o.entries as unknown[] | undefined) ?? []) {
        const x = e as Record<string, unknown> | null;
        if (!x || !isMapId(x.map) || typeof x.mode !== 'string' || !isGameMode(x.mode)) return null;
        entries.push({ map: x.map, mode: x.mode });
      }
      return { c: 'rotation', ...(o.entries !== undefined ? { entries } : {}), ...(o.shuffle !== undefined ? { shuffle: o.shuffle as boolean } : {}) };
    }
    case 'skip':
      return { c: 'skip' };
    case 'restart':
      return { c: 'restart' };
    case 'end':
      return { c: 'end' };
    default:
      return null;
  }
}
