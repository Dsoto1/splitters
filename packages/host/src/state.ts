import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { HostConfig } from './config.ts';

/**
 * Where the Host Service keeps its own files, per user (no administrator
 * rights): the pairing token, the last settings (so a relaunch restores the
 * server), bans and logs.
 *   Windows  %LOCALAPPDATA%\TileTriggerHost
 *   macOS    ~/Library/Application Support/TileTriggerHost
 *   Linux    $XDG_STATE_HOME/tiletrigger-host (~/.local/state/tiletrigger-host)
 * HOST_STATE_DIR overrides it.
 */
export function stateDir(env: NodeJS.ProcessEnv = process.env, platform = process.platform): string {
  if (env.HOST_STATE_DIR) return env.HOST_STATE_DIR;
  if (platform === 'win32') return join(env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), 'TileTriggerHost');
  if (platform === 'darwin') return join(homedir(), 'Library', 'Application Support', 'TileTriggerHost');
  return join(env.XDG_STATE_HOME ?? join(homedir(), '.local', 'state'), 'tiletrigger-host');
}

/** Write a file atomically (a crash mid-write leaves the old one), readable by this user only. */
export function writePrivate(path: string, text: string): void {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, text, { mode: 0o600 });
  renameSync(tmp, path);
  try {
    chmodSync(path, 0o600);
  } catch {
    // Windows: the profile folder is already the user's own.
  }
}

export class ServiceState {
  constructor(readonly dir: string) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  /** The pairing token for /host: made once, kept until `rotateToken`. */
  token(): string {
    const file = join(this.dir, 'pairing-token');
    if (existsSync(file)) {
      const t = readFileSync(file, 'utf8').trim();
      if (/^[a-f0-9]{48}$/.test(t)) return t;
    }
    return this.rotateToken();
  }

  rotateToken(): string {
    const t = randomBytes(24).toString('hex');
    writePrivate(join(this.dir, 'pairing-token'), t);
    return t;
  }

  /** The last settings, and whether the server was running when the service last stopped. */
  load(): { config: HostConfig | null; running: boolean } {
    try {
      const j = JSON.parse(readFileSync(join(this.dir, 'server.json'), 'utf8')) as { config?: HostConfig; running?: boolean };
      return { config: j.config ?? null, running: !!j.running };
    } catch {
      return { config: null, running: false };
    }
  }

  save(config: HostConfig | null, running: boolean): void {
    writePrivate(join(this.dir, 'server.json'), JSON.stringify({ config, running }, null, 2));
  }
}
