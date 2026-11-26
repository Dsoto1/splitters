/**
 * Players you muted (their text chat and quick messages hidden), remembered on this device: by name, as the roster
 * shows it (a signed-in player's name is their username, so it holds from match to match; a guest's holds while
 * they keep the name). Nothing is sent anywhere: the others never know.
 */
const KEY = 'cs.chatMuted';
/** The most names kept (the oldest muted go first). */
export const MUTE_MAX = 200;

/** Where the list lives (localStorage; a stand-in in tests). */
export interface MuteStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const keyOf = (name: string) => name.trim().toLowerCase();

function storage(): MuteStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export class MuteList {
  private names: string[];

  constructor(private readonly store: MuteStore | null = storage()) {
    let list: unknown = [];
    try {
      list = JSON.parse(store?.getItem(KEY) ?? '[]');
    } catch {
      list = [];
    }
    this.names = Array.isArray(list) ? list.filter((n): n is string => typeof n === 'string' && !!n).map(keyOf).slice(-MUTE_MAX) : [];
  }

  has(name: string | undefined | null): boolean {
    return !!name && this.names.includes(keyOf(name));
  }

  /** Mute (on) or unmute `name`; kept on the device at once. */
  set(name: string, on: boolean): void {
    const k = keyOf(name);
    if (!k) return;
    this.names = this.names.filter((n) => n !== k);
    if (on) this.names.push(k);
    if (this.names.length > MUTE_MAX) this.names = this.names.slice(-MUTE_MAX);
    try {
      this.store?.setItem(KEY, JSON.stringify(this.names));
    } catch {
      // Storage full or blocked: muted for this match still.
    }
  }

  toggle(name: string): boolean {
    const on = !this.has(name);
    this.set(name, on);
    return on;
  }

  get size(): number {
    return this.names.length;
  }
}
