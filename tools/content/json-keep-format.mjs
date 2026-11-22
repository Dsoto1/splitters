// Write JSON the way it was written: content files are laid out by hand (short objects on one line, long ones open),
// so a tool that changes a value keeps every untouched part byte for byte and lays out only what changed (on one
// line when it fits in 120 columns or is a list of plain values, else open, two spaces a level). Used by tools/content/apply-weapon-edits.mjs.

const WIDTH = 120;

/** A value on one line, the content files' way: `{ "a": 1, "b": [1, 2] }`. */
export function inline(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(inline).join(', ')}]`;
  const e = Object.entries(v);
  return e.length ? `{ ${e.map(([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`).join(', ')} }` : '{}';
}

/** A fresh layout: one line when it fits (below the top level), else open. */
export function layout(v, ind = '', depth = 0, lead = 0) {
  const one = inline(v);
  // Lists of plain values (weapon ids, numbers) stay on one line, however long: the content files' way.
  const plainList = Array.isArray(v) && v.every((x) => x === null || typeof x !== 'object');
  if (v === null || typeof v !== 'object' || plainList || (depth > 0 && ind.length + lead + one.length <= WIDTH)) return one;
  const next = `${ind}  `;
  if (Array.isArray(v)) return v.length ? `[\n${v.map((x) => next + layout(x, next, depth + 1)).join(',\n')}\n${ind}]` : '[]';
  const e = Object.entries(v);
  if (!e.length) return '{}';
  return `{\n${e.map(([k, x]) => `${next}${JSON.stringify(k)}: ${layout(x, next, depth + 1, JSON.stringify(k).length + 2)}`).join(',\n')}\n${ind}}`;
}

/**
 * The spans of a JSON text: for the value starting at `i`, { start, end, multi, keys? } where keys maps an object's
 * keys to their values' spans. Assumes valid JSON (it was parsed first).
 */
function scan(text, i) {
  const ws = () => {
    while (/\s/.test(text[i] ?? '')) i++;
  };
  const value = () => {
    ws();
    const start = i;
    const c = text[i];
    if (c === '{' || c === '[') {
      const keys = c === '{' ? new Map() : null;
      const items = c === '[' ? [] : null;
      i++;
      ws();
      if (text[i] === (c === '{' ? '}' : ']')) i++;
      else
        for (;;) {
          ws();
          if (keys) {
            const ks = i;
            i++;
            while (text[i] !== '"') i += text[i] === '\\' ? 2 : 1;
            i++;
            const k = JSON.parse(text.slice(ks, i));
            ws();
            i++; // :
            keys.set(k, value());
          } else items.push(value());
          ws();
          if (text[i] === ',') {
            i++;
            continue;
          }
          i++; // } or ]
          break;
        }
      return { start, end: i, multi: text.slice(start, i).includes('\n'), keys, items };
    }
    if (c === '"') {
      i++;
      while (text[i] !== '"') i += text[i] === '\\' ? 2 : 1;
      i++;
    } else while (i < text.length && !/[\s,\]}]/.test(text[i])) i++;
    return { start, end: i, multi: false };
  };
  return value();
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * `next` laid out like `text` (the JSON it replaces): unchanged values keep their exact text, a changed object that
 * was open stays open (its keys in `next`'s order, each kept or laid out afresh), anything else is laid out afresh.
 */
export function keepFormat(next, text) {
  const was = JSON.parse(text);
  const root = scan(text, 0);
  const trailing = text.endsWith('\n') ? '\n' : '';
  const render = (v, old, span, ind, depth, lead) => {
    if (span && same(v, old)) return text.slice(span.start, span.end);
    if (span?.keys && span.multi && v && typeof v === 'object' && !Array.isArray(v) && old && typeof old === 'object' && !Array.isArray(old)) {
      const nextInd = `${ind}  `;
      const lines = Object.entries(v).map(([k, x]) => `${nextInd}${JSON.stringify(k)}: ${render(x, old[k], span.keys.get(k), nextInd, depth + 1, JSON.stringify(k).length + 2)}`);
      return lines.length ? `{\n${lines.join(',\n')}\n${ind}}` : '{}';
    }
    return layout(v, ind, depth, lead);
  };
  return render(next, was, root, '', 0, 0) + trailing;
}
