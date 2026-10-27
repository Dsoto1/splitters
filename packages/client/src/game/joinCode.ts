/** Codes skip look-alike letters (no I, L, O, 0, 1). */
export const JOIN_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * Strings a join code must never contain: friends read codes aloud and share
 * them, so no 666 and nothing rude. Checked on the code as written and with
 * digits read as the letters they resemble (5→S, 3→E, 4→A, 7→T, 8→B).
 */
const BLOCKED = ['666', 'ASS', 'FUK', 'FUC', 'FCK', 'SHT', 'CUM', 'CNT', 'DCK', 'DIK', 'FAG', 'GAY', 'JEW', 'KKK', 'NAZ', 'NGR', 'NGA', 'PSS', 'PUS', 'RAP', 'SEX', 'SXY', 'TIT', 'TWT', 'WTF', 'XXX', 'HEL', 'DED', 'KYS'];
const LEET: Record<string, string> = { '5': 'S', '3': 'E', '4': 'A', '7': 'T', '8': 'B' };

export function acceptableJoinCode(code: string): boolean {
  const read = code.replace(/[53478]/g, (d) => LEET[d]!);
  return !BLOCKED.some((b) => code.includes(b) || read.includes(b));
}

/** Random bytes from the browser's CSPRNG (crypto.getRandomValues). */
export const cryptoBytes = (n: number): Uint8Array => globalThis.crypto.getRandomValues(new Uint8Array(n));

/** Bytes at or above this are redrawn, so each of the 31 symbols is exactly equally likely (248 = 8 × 31). */
const UNBIASED = 256 - (256 % JOIN_CODE_ALPHABET.length);

/**
 * A random six-character code from a CSPRNG, drawn again until it is
 * acceptable: 31^6 ≈ 8.9 × 10^8 codes (29.7 bits). With at most a few hundred
 * games open, guessing one takes millions of tries, and the hub's broker
 * allows 30 joins a minute per address (broker.ts).
 */
export function makeJoinCode(bytes: (n: number) => Uint8Array = cryptoBytes): string {
  for (;;) {
    let code = '';
    while (code.length < 6) {
      for (const b of bytes(12)) {
        if (b >= UNBIASED) continue;
        code += JOIN_CODE_ALPHABET[b % JOIN_CODE_ALPHABET.length];
        if (code.length === 6) break;
      }
    }
    if (acceptableJoinCode(code)) return code;
  }
}
