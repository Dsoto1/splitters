import type { ClientMessage } from '../protocol.ts';
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
      return typeof o.protocol === 'number' && typeof o.name === 'string' ? { t: 'hello', protocol: o.protocol, name: o.name, ...(typeof o.look === 'string' && o.look.length <= 64 ? { look: o.look } : {}) } : null;
    case 'ping':
      return typeof o.id === 'number' && typeof o.ct === 'number' ? { t: 'ping', id: o.id, ct: o.ct } : null;
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
        inputs.push(input);
      }
      return { t: 'input', inputs };
    }
    default:
      return null;
  }
}
