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

/** A random six-character code, drawn again until it is acceptable. */
export function makeJoinCode(random: () => number = Math.random): string {
  for (;;) {
    const code = Array.from({ length: 6 }, () => JOIN_CODE_ALPHABET[Math.floor(random() * JOIN_CODE_ALPHABET.length)]).join('');
    if (acceptableJoinCode(code)) return code;
  }
}
