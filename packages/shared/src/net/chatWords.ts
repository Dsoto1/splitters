/**
 * The chat filter's words (net/chat.ts filterChat), ROT13'd so the source doesn't read as a list of slurs. Each is
 * matched on a word of the line made plain (lower case, look-alike digits and symbols read as letters, other marks
 * dropped, a letter repeated any number of times counting once more):
 * - `sub`: anywhere in a word (long roots nothing innocent contains);
 * - `pre`: at a word's start (so "Scunthorpe" passes);
 * - `word`: the whole word, or with an ending (s, es, ed, er, ers, ing).
 * Phrases are matched across words. Add to the list here; the test (packages/shared/test/chat.test.ts) checks a
 * sample of each kind.
 */
export const CHAT_WORDS_ROT13: readonly (readonly [string, 'sub' | 'pre' | 'word'])[] = [
  ['shpx', 'sub'],
  ['fuvg', 'sub'],
  ['phag', 'pre'],
  ['avttre', 'pre'],
  ['avttn', 'pre'],
  ['snttbg', 'sub'],
  ['zbgures', 'sub'],
  ['ovgpu', 'pre'],
  ['onfgneq', 'pre'],
  ['nffubyr', 'sub'],
  ['qvpxurnq', 'sub'],
  ['qvpx', 'word'],
  ['pbpx', 'word'],
  ['chffl', 'word'],
  ['juber', 'pre'],
  ['fyhg', 'pre'],
  ['jnaxre', 'pre'],
  ['gjng', 'word'],
  ['cevpx', 'word'],
  ['obyybpxf', 'word'],
  ['snt', 'word'],
  ['ergneq', 'pre'],
  ['fcvp', 'word'],
  ['puvax', 'word'],
  ['xvxr', 'word'],
  ['genaal', 'word'],
  ['qlxr', 'word'],
  ['pbba', 'word'],
  ['tbbx', 'word'],
  ['jrgonpx', 'pre'],
  ['cnxv', 'word'],
  ['xlf', 'word'],
  ['encvfg', 'pre'],
];

/** Phrases (ROT13), matched across words: each word as above, whole. */
export const CHAT_PHRASES_ROT13: readonly string[] = ['xvyy lbhefrys', 'xvyy hefrys', 'xvyy lbhe frys', 'tb qvr'];

export const rot13 = (s: string): string => s.replace(/[a-z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 97 + 13) % 26) + 97));
