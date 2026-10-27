import { appendFileSync, existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Log files: host.log, rotated at 5 MB, the last 5 kept (host.1.log … host.5.log). */
export const LOG_LIMITS = { maxBytes: 5 * 1024 * 1024, keep: 5 } as const;

/**
 * The service's log: every line goes to the console window (through `print`,
 * so it lands above the command prompt) and to a rotating file.
 */
export class Logger {
  readonly file: string | null;
  private size = 0;

  constructor(
    dir: string | null,
    private readonly print: (line: string) => void = (l) => console.log(l),
    private readonly limits = LOG_LIMITS,
  ) {
    let file: string | null = null;
    if (dir) {
      try {
        mkdirSync(dir, { recursive: true });
        file = join(dir, 'host.log');
        this.size = existsSync(file) ? statSync(file).size : 0;
        appendFileSync(file, '');
      } catch {
        file = null;
      }
    }
    this.file = file;
  }

  line(text: string): void {
    const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const out = `${stamp} ${text}`;
    this.print(out);
    if (!this.file) return;
    try {
      if (this.size + out.length + 1 > this.limits.maxBytes) this.rotate();
      appendFileSync(this.file, `${out}\n`);
      this.size += Buffer.byteLength(out) + 1;
    } catch {
      // A full disk mustn't stop the server.
    }
  }

  private rotate(): void {
    const f = this.file!;
    const nth = (n: number) => f.replace(/\.log$/, `.${n}.log`);
    rmSync(nth(this.limits.keep), { force: true });
    for (let n = this.limits.keep - 1; n >= 1; n--) if (existsSync(nth(n))) renameSync(nth(n), nth(n + 1));
    renameSync(f, nth(1));
    this.size = 0;
  }
}
