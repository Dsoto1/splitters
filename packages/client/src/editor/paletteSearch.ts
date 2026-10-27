/**
 * Fuzzy search for MapMaker's palette: every word typed must match the
 * piece's name, its tags (category, theme, what it is) or its pack, either as
 * a word start, inside a word, with one typo, or as an abbreviation of the
 * name ("sbw" → Sandbag Wall). Name matches outrank tag and pack matches.
 */

export interface SearchFields {
  /** Normalised name and its words. */
  name: string;
  nameWords: string[];
  /** The name without spaces, for abbreviations. */
  compact: string;
  tagWords: string[];
  tags: string;
  pack: string;
  packWords: string[];
}

/** Lower case, accents dropped, anything but letters and digits as spaces. */
export function normalise(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const words = (s: string) => (s ? s.split(' ') : []);

export function searchFields(name: string, tags = '', pack = ''): SearchFields {
  const n = normalise(name);
  const t = normalise(tags);
  const p = normalise(pack);
  return { name: n, nameWords: words(n), compact: n.replace(/ /g, ''), tags: t, tagWords: words(t), pack: p, packWords: words(p) };
}

/** Edit distance with adjacent swaps, stopping early past `max`. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2]! + 1);
      cur.push(v);
      best = Math.min(best, v);
    }
    if (best > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length]!;
}

/** One typo against the start of a word (so a misspelt half-typed word still finds it). */
function nearWord(token: string, list: string[]): boolean {
  if (token.length < 4) return false;
  return list.some((w) => w.length >= token.length - 1 && (distance(token, w.slice(0, token.length), 1) <= 1 || distance(token, w, 1) <= 1));
}

/** The letters of `token` in order in `text`, the first at a word start. */
function abbreviates(token: string, f: SearchFields): boolean {
  if (token.length < 2 || !f.nameWords.some((w) => w[0] === token[0])) return false;
  let i = 0;
  for (const ch of f.compact) if (ch === token[i]) i++;
  return i === token.length;
}

function tokenScore(t: string, f: SearchFields): number {
  if (f.nameWords.includes(t)) return 100;
  if (f.nameWords.some((w) => w.startsWith(t))) return 80;
  if (f.name.includes(t)) return 60;
  if (f.tagWords.some((w) => w.startsWith(t))) return 45;
  if (f.packWords.some((w) => w.startsWith(t))) return 35;
  if (t.length >= 3 && f.tags.includes(t)) return 30;
  if (t.length >= 3 && f.pack.includes(t)) return 25;
  if (nearWord(t, f.nameWords)) return 40;
  if (nearWord(t, f.tagWords)) return 18;
  if (abbreviates(t, f)) return 15;
  return 0;
}

/** How well a piece matches the query: 0 for no match, higher for better. */
export function matchScore(query: string, f: SearchFields): number {
  const q = normalise(query);
  if (!q) return 0;
  let total = 0;
  for (const t of words(q)) {
    const s = tokenScore(t, f);
    if (!s) return 0;
    total += s;
  }
  // The query at the start of the name breaks ties (a whole word still beats a word start); shorter names win ties.
  if (f.name.startsWith(q)) total += 15;
  return total - f.name.length * 0.05;
}
