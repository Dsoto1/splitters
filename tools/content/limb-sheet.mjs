// The limb audit's contact sheet (docs/CHARACTER_LIMBS.md): one row per character, whole body front and side and
// upper body front and support side (Character Select's pose: standing, holding the rifle), the worst 20 marked red
// with their rank and scores, plus any looks in EXTRA (the owner's examples). Reads <dir>/limbs.json and the
// pictures <dir>/pics/<look>_{front,side,upper,support}.png that `PICTURES=1 node tools/content/limb-audit.mjs` saves
// (make them for just these looks with ONLY=...; the sheet prints the ONLY list it wants when some are missing).
//
//   node tools/content/limb-sheet.mjs <dir> [out.jpg]      EXTRA=core.elder,core.grandpachains by default
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { rankLimbs } from './limbs.mjs';

const dir = process.argv[2];
if (!dir) throw new Error('usage: limb-sheet.mjs <dir> [out.jpg]');
const file = process.argv[3] ?? join(dir, 'limb-sheet.jpg');
const extra = (process.env.EXTRA ?? 'core.elder,core.grandpachains').split(',').filter(Boolean);
const ranked = rankLimbs(JSON.parse(readFileSync(join(dir, 'limbs.json'), 'utf8')));
const worst = ranked.slice(0, 20);
const rows = [...worst, ...ranked.filter((r) => extra.includes(r.id) && !worst.includes(r))];
const VIEWS = ['front', 'side', 'upper', 'support'];
const missing = rows.filter((r) => VIEWS.some((v) => !existsSync(join(dir, 'pics', `${r.id}_${v}.png`))));
if (missing.length) {
  console.error(`pictures missing; make them with:\n  ONLY=${missing.map((r) => r.id).join(',')} PICTURES=1 node tools/content/limb-audit.mjs <url> ${dir}`);
  process.exit(1);
}
const TW = 180;
const TH = 240;
const LW = 260;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const label = (r) => {
  const rank = ranked.indexOf(r) + 1;
  const bad = rank <= 20;
  const lines = [
    `${bad ? `#${rank} ` : ''}${r.name}`,
    `legs ${r.score.legs}  elbows ${r.elbowScore}`,
    `sole roll ${r.legs.l.footRoll ?? '–'} / ${r.legs.r.footRoll ?? '–'}`,
    `skin bow ${r.legs.l.skinBow ?? '–'} / ${r.legs.r.skinBow ?? '–'}`,
    `elbow ${r.arms.l.elbow ?? '–'} / ${r.arms.r.elbow ?? '–'}`,
  ];
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${LW}" height="${TH}"><rect width="100%" height="100%" fill="${bad ? '#4a1717' : '#15181d'}"/>${lines
      .map((t, i) => `<text x="10" y="${34 + i * 24}" font-family="sans-serif" font-size="${i ? 14 : 17}" font-weight="${i ? 400 : 700}" fill="${bad && !i ? '#ff8080' : '#e8e8e8'}">${esc(t)}</text>`)
      .join('')}</svg>`,
  );
};
const tiles = [];
for (const [i, r] of rows.entries()) {
  tiles.push({ input: label(r), left: 0, top: i * TH });
  for (const [k, v] of VIEWS.entries()) tiles.push({ input: await sharp(join(dir, 'pics', `${r.id}_${v}.png`)).resize(TW, TH).png().toBuffer(), left: LW + k * TW, top: i * TH });
}
await sharp({ create: { width: LW + VIEWS.length * TW, height: rows.length * TH, channels: 3, background: '#15181d' } })
  .composite(tiles)
  .jpeg({ quality: 82 })
  .toFile(file);
console.log(file);
