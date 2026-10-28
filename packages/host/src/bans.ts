import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import type { PlayerIdentity } from '@tiletrigger/server/server';
import { writePrivate } from './state.ts';

/**
 * The Host Service's ban list: a JSON file in its state folder (bans.json),
 * kept across restarts and shared by the console (service process) and the
 * match process (in-game admins' bans), each reading it again when it changed.
 *
 * Signed-in players are banned by account (Cognito `sub`, proven by a
 * hub-signed ticket). Guests can only be banned by what their browser says
 * (a random per-browser key, which clearing site data resets) and their
 * address when the link is direct (not through the relay; shared by a
 * household, and changes): guest bans are weak by nature.
 */
export interface Ban {
  id: string;
  name: string;
  sub?: string;
  pk?: string;
  address?: string;
  /** Unix ms; 0: for good. */
  until: number;
  reason: string;
  by: string;
  at: number;
}

const MAX_BANS = 5000;

export class BanList {
  private bans: Ban[] = [];
  private mtime = -1;

  constructor(
    private readonly file: string,
    private readonly now: () => number = Date.now,
  ) {
    this.reload();
  }

  /** Read the file again if it changed (another process added or lifted a ban). */
  reload(): void {
    let m = 0;
    try {
      m = existsSync(this.file) ? statSync(this.file).mtimeMs : 0;
    } catch {
      return;
    }
    if (m === this.mtime) return;
    this.mtime = m;
    try {
      const j = m ? (JSON.parse(readFileSync(this.file, 'utf8')) as { bans?: Ban[] }) : {};
      this.bans = Array.isArray(j.bans) ? j.bans.filter((b) => b && typeof b.id === 'string' && (b.sub || b.pk || b.address)) : [];
    } catch {
      // A broken file: keep what we had (and don't overwrite it by accident until a ban changes).
    }
  }

  private save(): void {
    const t = this.now();
    this.bans = this.bans.filter((b) => !b.until || b.until > t).slice(-MAX_BANS);
    writePrivate(this.file, JSON.stringify({ bans: this.bans }, null, 2));
    try {
      this.mtime = statSync(this.file).mtimeMs;
    } catch {
      this.mtime = -1;
    }
  }

  list(): Ban[] {
    this.reload();
    const t = this.now();
    return this.bans.filter((b) => !b.until || b.until > t);
  }

  add(who: PlayerIdentity, minutes: number, reason: string, by: string): Ban {
    this.reload();
    const ban: Ban = {
      id: randomBytes(3).toString('hex'),
      name: who.name,
      // An account ban needs nothing else; a guest's holds on to what there is.
      ...(who.sub ? { sub: who.sub } : { ...(who.pk ? { pk: who.pk } : {}), ...(who.address ? { address: who.address } : {}) }),
      until: minutes > 0 ? this.now() + minutes * 60_000 : 0,
      reason: reason.slice(0, 80),
      by: by.slice(0, 40),
      at: this.now(),
    };
    if (!ban.sub && !ban.pk && !ban.address) throw new Error(`nothing to ban ${who.name} by (no account, browser key or address)`);
    this.bans.push(ban);
    this.save();
    return ban;
  }

  /** Lift bans by ID or player name (case-insensitive); returns how many. */
  remove(idOrName: string): number {
    this.reload();
    const key = idOrName.toLowerCase();
    const before = this.bans.length;
    this.bans = this.bans.filter((b) => b.id !== idOrName && b.name.toLowerCase() !== key);
    const n = before - this.bans.length;
    if (n) this.save();
    return n;
  }

  /** Why this player may not join, or null. */
  check(who: PlayerIdentity): string | null {
    const hit = this.list().find((b) => (b.sub && b.sub === who.sub) || (b.pk && b.pk === who.pk) || (b.address && b.address === who.address));
    if (!hit) return null;
    const until = hit.until ? ` until ${new Date(hit.until).toISOString().slice(0, 16).replace('T', ' ')} UTC` : '';
    return `You are banned from this server${until}${hit.reason ? `: ${hit.reason}` : ''}`;
  }
}
