// The map cards' small pictures (Match Setup's grid; docs/UI.md, "Match Setup"): each shipped map's in-game picture
// (packages/client/public/maps/shots/<id>.jpg, captured from the real map by tools/content/capture-map-shots.mjs) made
// into a 320 × 180 WebP of a few kilobytes, packages/client/public/maps/cards/<id>.webp, which the cards load lazily.
// The full 640 × 360 shot stays for the setup panel's banner and the home screen.
//
//   node tools/content/map-cards.mjs           make the missing or stale cards (and drop cards of maps no longer shipped)
//   node tools/content/map-cards.mjs --check   fail when a shipped map has no shot or no up-to-date card (pnpm content:check)
//
// A new map: capture its shot (capture-map-shots.mjs <base url> <id>), then run this. cards.lock.json records each
// card's source shot (its hash), so a recaptured shot is seen as stale.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SHOTS = join(ROOT, 'packages/client/public/maps/shots');
const CARDS = join(ROOT, 'packages/client/public/maps/cards');
const LOCK = join(CARDS, 'cards.lock.json');
export const CARD_W = 480;
export const CARD_H = 270;
const QUALITY = 60;
/** A card over this is a sign something went wrong (a full-size picture, a PNG). */
const CARD_MAX_BYTES = 24 * 1024;
const check = process.argv.includes('--check');

const retiredSrc = readFileSync(join(ROOT, 'packages/shared/src/map/retired.ts'), 'utf8');
const RETIRED = new Set([...retiredSrc.slice(retiredSrc.indexOf('new Set([')).matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]));

/** The maps the menu lists (maps/*.json, not retired, not test maps): each needs a shot and a card. */
export function shippedMapIds() {
  return readdirSync(join(ROOT, 'maps'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -5))
    .filter((id) => !RETIRED.has(id))
    .filter((id) => JSON.parse(readFileSync(join(ROOT, 'maps', `${id}.json`), 'utf8')).metadata?.testOnly !== true)
    .sort();
}

const hashOf = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 16);
const lock = existsSync(LOCK) ? JSON.parse(readFileSync(LOCK, 'utf8')) : {};
const problems = [];
const next = {};
let made = 0;
let bytes = 0;
const ids = shippedMapIds();
if (!check) mkdirSync(CARDS, { recursive: true });
for (const id of ids) {
  const shot = join(SHOTS, `${id}.jpg`);
  const card = join(CARDS, `${id}.webp`);
  if (!existsSync(shot)) {
    problems.push(`maps/${id}.json has no picture: capture it (node tools/content/capture-map-shots.mjs <base url> ${id}), then run node tools/content/map-cards.mjs`);
    continue;
  }
  const src = hashOf(readFileSync(shot));
  next[id] = src;
  const fresh = existsSync(card) && lock[id] === src;
  if (check) {
    if (!fresh) problems.push(`maps/cards/${id}.webp is missing or older than its shot (run node tools/content/map-cards.mjs)`);
    else {
      const buf = readFileSync(card);
      const meta = await sharp(buf).metadata();
      if (meta.format !== 'webp' || meta.width !== CARD_W || meta.height !== CARD_H) problems.push(`maps/cards/${id}.webp must be a ${CARD_W}×${CARD_H} WebP`);
      if (buf.length > CARD_MAX_BYTES) problems.push(`maps/cards/${id}.webp: ${buf.length} bytes, over ${CARD_MAX_BYTES}`);
      bytes += buf.length;
    }
    continue;
  }
  if (!fresh) {
    await sharp(shot).resize(CARD_W, CARD_H, { fit: 'cover' }).webp({ quality: QUALITY, effort: 6 }).toFile(card);
    made++;
  }
  bytes += readFileSync(card).length;
}
// Cards of maps no longer shipped (retired, renamed, test maps) go.
if (existsSync(CARDS)) {
  for (const f of readdirSync(CARDS)) {
    if (f === 'cards.lock.json') continue;
    const id = f.replace(/\.webp$/, '');
    if (ids.includes(id) && f.endsWith('.webp')) continue;
    if (check) problems.push(`maps/cards/${f}: not a shipped map's card (run node tools/content/map-cards.mjs)`);
    else rmSync(join(CARDS, f));
  }
}
const lockText = `${JSON.stringify(Object.fromEntries(Object.entries(next).sort(([a], [b]) => (a < b ? -1 : 1))), null, 1)}\n`;
if (check) {
  if (!existsSync(LOCK) || readFileSync(LOCK, 'utf8') !== lockText) problems.push('maps/cards/cards.lock.json is out of date (run node tools/content/map-cards.mjs)');
} else writeFileSync(LOCK, lockText);
if (problems.length) {
  for (const p of problems) console.error(`ERROR ${p}`);
  process.exit(1);
}
console.log(`${check ? 'checked' : `made ${made},`} ${ids.length} map cards (${(bytes / 1024).toFixed(0)} KB)`);
