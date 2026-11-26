import { TokenBucket } from './rateLimit.ts';
import { CHAT_PHRASES_ROT13, CHAT_WORDS_ROT13, rot13 } from './chatWords.ts';

/**
 * Text chat (docs/MULTIPLAYER_PROTOCOL.md section 28): a player's line goes to whoever hosts the match (the
 * dedicated server, Host Service, or the browser hosting friends), which cleans it, holds back floods, masks the
 * filter's words and passes it on to everyone, or to the sender's team. Nothing goes through the hub or AWS.
 * Shared by every host so they all trust a sender exactly as little. Imported by the hosts and the match page
 * only (the `@tiletrigger/shared/chat` export), not by the menu.
 */

/** The longest line, in characters (longer ones are cut). */
export const CHAT_MAX_CHARS = 120;
/** Per sender: a line every 2 s on average, up to 4 in a row. */
export const CHAT_RATE = { perSecond: 0.5, burst: 4 } as const;
/** The same line again within this long is dropped (a held key, a paste spammed). */
export const CHAT_REPEAT_MS = 10_000;
/** The sender slot of a line from the match itself (the host's answer to a refused line). */
export const CHAT_SYSTEM = -1;

/** Control characters, soft hyphens, zero-width and direction marks: a line can't hide words or reorder itself. */
const INVISIBLE = /[\u0000-\u001f\u007f-\u009f\u00ad\u061c\u180e\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g;

/** A line as a host passes it on (before the filter): invisible marks gone, spaces collapsed, at most CHAT_MAX_CHARS. */
export function cleanChatText(raw: string): string {
  const one = raw.replace(INVISIBLE, ' ').replace(/\s+/g, ' ').trim();
  return Array.from(one).slice(0, CHAT_MAX_CHARS).join('').trim();
}

/** Look-alike digits and symbols read as the letters they stand for. */
const LEET: Record<string, string> = { '0': 'o', '1': 'i', '!': 'i', '|': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', $: 's', '7': 't', '+': 't', '8': 'b', '9': 'g' };

/** A word made plain for the filter: lower case, accents and marks off, look-alikes read as letters, the rest dropped. */
export function plainWord(token: string): string {
  return token
    // Punctuation round the word isn't part of it ("dick!"), though a look-alike may start one ("$hit").
    .replace(/^[^\p{L}\p{N}@$]+|[^\p{L}\p{N}]+$/gu, '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/\p{M}/gu, '')
    .replace(/[0-9!|@$+]/g, (c) => LEET[c] ?? '')
    .replace(/[^a-z]/g, '');
}

/** Each letter of `w` once or more (so "fuuuck" is "fuck", and doubled letters stay at least doubled). */
const stretch = (w: string) => [...w].map((c) => `${c}+`).join('');
const ENDINGS = '(?:s|es|ed|er|ers|ing)?';

let words: RegExp[] | null = null;
let phrases: RegExp[][] | null = null;
function lists(): { words: RegExp[]; phrases: RegExp[][] } {
  words ??= CHAT_WORDS_ROT13.map(([w, kind]) => {
    const body = stretch(rot13(w));
    return new RegExp(kind === 'sub' ? body : kind === 'pre' ? `^${body}` : `^${body}${ENDINGS}$`);
  });
  phrases ??= CHAT_PHRASES_ROT13.map((p) => rot13(p).split(' ').map((w) => new RegExp(`^${stretch(w)}$`)));
  return { words, phrases };
}

/** Whether one word (as typed) is on the filter's list. */
export function filteredWord(token: string): boolean {
  const p = plainWord(token);
  return !!p && lists().words.some((r) => r.test(p));
}

/** A line with the filter's words (and phrases) masked, each word as many stars as it had characters. */
export function filterChat(text: string): string {
  const parts = text.split(/(\s+)/);
  const at = parts.map((_, i) => i).filter((i) => i % 2 === 0 && parts[i]);
  const mask = new Set<number>();
  for (const i of at) if (filteredWord(parts[i]!)) mask.add(i);
  const plain = at.map((i) => plainWord(parts[i]!));
  for (const ph of lists().phrases) {
    for (let k = 0; k + ph.length <= at.length; k++) if (ph.every((r, j) => r.test(plain[k + j]!))) for (let j = 0; j < ph.length; j++) mask.add(at[k + j]!);
  }
  if (!mask.size) return text;
  return parts.map((s, i) => (mask.has(i) ? '*'.repeat(Array.from(s).length) : s)).join('');
}

export type ChatVerdict = { ok: true; text: string } | { ok: false; why: string };

/**
 * A host's chat gate, one per match: per sender a token bucket (CHAT_RATE) and the last line (CHAT_REPEAT_MS).
 * `say` answers with the line to pass on (cleaned and filtered) or why not (empty: an empty line, dropped quietly).
 */
export class ChatRelay {
  private readonly by = new Map<number, { bucket: TokenBucket; last: string; lastAt: number }>();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly rate: { perSecond: number; burst: number } = CHAT_RATE,
  ) {}

  say(slot: number, raw: string): ChatVerdict {
    const text = cleanChatText(raw);
    if (!text) return { ok: false, why: '' };
    let s = this.by.get(slot);
    if (!s) this.by.set(slot, (s = { bucket: new TokenBucket(this.rate.perSecond, this.rate.burst, this.now), last: '', lastAt: -Infinity }));
    const t = this.now();
    const key = text.toLowerCase();
    if (key === s.last && t - s.lastAt < CHAT_REPEAT_MS) return { ok: false, why: 'You just said that' };
    if (!s.bucket.take()) return { ok: false, why: 'Slow down: wait a moment before you chat again' };
    s.last = key;
    s.lastAt = t;
    return { ok: true, text: filterChat(text) };
  }

  /** The slot left (or changed hands): its limits start afresh for whoever has it next. */
  forget(slot: number): void {
    this.by.delete(slot);
  }
}

/**
 * Whether a listener hears a line: all chat, everyone; team chat (`toTeam`, the sender on team `from`), the
 * sender's team only. Team chat from someone with no team (free-for-all, spectating) is all chat: the host sends
 * it without `tm`.
 */
export function chatHears(toTeam: boolean, from: string | null | undefined, listener: string | null | undefined): boolean {
  return !toTeam || !from || listener === from;
}
