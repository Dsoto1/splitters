// Grip audit: every player character holding a rifle, a pistol, the Spin Gun, the shotgun and the Spear in the Character Select pose
// (third person, the game's own renderer: `?mode=grips`, tools/gripSheet.ts), drawn from the side and the
// front, measured as drawn (`__grips.audit()`, tools/gripAudit.ts; `__grips.drawn()`, handProbe.ts) and in
// full-body first person, then flagged and ranked worst first.
//
//   pnpm build && pnpm --filter @tiletrigger/client exec vite preview --port 4860
//   node tools/content/grip-audit.mjs http://localhost:4860 <out dir>
//
// Writes (outside the repo): <out>/audit.json (every measurement and flag), <out>/summary.md (the ranked
// table), <out>/<id>.png (one row per character: rifle side, front and hands, pistol side and front, Spin Gun
// side and front), and <out>/sheet-<n>.png (ranked contact sheets, eight characters each).
// ONLY=<manifest ids or look ids> for some; NO_SHOTS=1 measures without pictures; NO_FP=1 skips first person;
// RESCORE=1 flags and ranks <out>/audit.json again (after changing a threshold) without rendering; RESUME=1 skips
// characters already measured there (audit.json is written after every character). WEAPONS_ADD=<name>:<weapon id>,...
// measures more weapons. WEAPONS_ONLY=rifle,pistol,...
// measures only those weapons; AUDIT_PX=<px> renders a smaller page (quicker in software GL). summary.md ends with
// every character's flags per weapon (`byWeapon` in audit.json).
//
// What the flags mean (thresholds below; side-view numbers, so a gun pointed at the camera doesn't fool them):
//   face     the rifle's line runs within FACE_M of the head joint, or its grip sits above the shoulder joint
//   crossed  the shooting elbow is at or across the body's midline (arms crossed over the chest)
//   elbow    an elbow bends against its own skin (the forearm folds toward the upper arm's back: "bent backwards")
//   flat     a hand's skin barely follows its finger joints, or closing the shooting hand doesn't bring its
//            fingertips toward the grip (curl test: fingertips open against closed); an open, flat hand on the gun
//   back     closing the hand moves its fingertips AWAY from the grip (the fingers curl backwards: splayed); a long
//            gun's support hand is measured against the handguard's line (palm up under it, its fingers close up round
//            the guard, away from the support point on its underside; CURL=points measures to that point, as before
//            2026-11-06: with RESCORE=1 too, since audit.json keeps both)
//   open     the drawn fingertips end far from the hand's point on the gun (not closed round it)
//            (a long gun's support hand slides back along the handguard on short arms, so its distance counts on pistols only)
//   off      a drawn hand's centre is far from its point on the gun
//   spikes   skin edges stretched to several times their bind length (cloth dragged out by an arm)
//   palm     a palm faces the wrong way (drawn, third or first person): the shooting palm out from the grip instead
//            of in against it (`sideR`), or the support palm down or out instead of up into the handguard / round
//            the shooting hand (`palmL`); the palm's side is the hand's handedness from its drawn knuckles (handProbe.ts)
//   fp       full-body first person: a drawn hand far off the gun, or fingers not along it
//
// PALMS=old reads every hand's palm by the rule before 2026-11-05 (the thumb's first joint: it flipped some hands),
// for a before/after with the same measures.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const base = process.argv[2] ?? 'http://localhost:4860';
const out = resolve(process.argv[3] ?? join(tmpdir(), 'tiletrigger-grip-audit'));
if (!relative(ROOT, out).startsWith('..')) throw new Error(`audit output goes outside the repo, not ${out}`);
const only = process.env.ONLY?.split(',').filter(Boolean);
const shots = !process.env.NO_SHOTS;
const firstPerson = !process.env.NO_FP;

import { FLAGS, flagsOf } from './grip-flags.mjs';

export { FLAGS, flagsOf };

const WEAPONS = [
  ['rifle', 'core.rifle'],
  ['pistol', 'core.pistol'],
  ['spin', 'core.lmg'],
  ['shotgun', 'core.shotgun'],
  ['spear', 'core.spear'],
  // WEAPONS_ADD=singularity:core.singularity measures another weapon too (a new model's holds: in audit.json and
  // summary.md, not in the pictures, which show the five above).
  ...(process.env.WEAPONS_ADD ?? '').split(',').filter(Boolean).map((s) => s.split(':')),
];
// WEAPONS_ONLY=rifle,pistol measures only those (a quick pass).
const weaponsOnly = process.env.WEAPONS_ONLY?.split(',').filter(Boolean);
const weapons = weaponsOnly ? WEAPONS.filter(([w]) => weaponsOnly.includes(w)) : WEAPONS;

// Characters: player manifests, plus the part-built ranger as the rig's own baseline.
const MANIFESTS = join(ROOT, 'content/characters');
const lock = JSON.parse(readFileSync(join(ROOT, 'content/meshy.lock.json'), 'utf8')).files;
const rigOf = new Map(Object.values(lock).filter((f) => f.role !== 'meshy-fparms').map((f) => [f.id, f.role === 'meshy' ? 'meshy-rig' : `in-house${f.landmarks === 'found' ? ' (found)' : ''}`]));
const manifests = readdirSync(MANIFESTS)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(MANIFESTS, f), 'utf8')))
  .filter((m) => m.status !== 'queued' && m.kind !== 'creature' && /player/.test(m.use ?? ''));
const all = [...manifests.map((m) => ({ id: m.id, look: m.look, name: m.name, rig: rigOf.get(m.id) ?? '?' }))];
const wanted = only ? all.filter((c) => only.includes(c.id) || only.includes(c.look)) : all;
if (!wanted.length) throw new Error('no characters matched');

const TILE = 300;
const LABEL = 22;
const HEAD = 30;
const VIEWS = [
  ['rifle', 'side'],
  ['rifle', 'front'],
  ['rifle', 'hands'],
  ['pistol', 'side'],
  ['pistol', 'front'],
  ['spin', 'side'],
  ['spin', 'front'],
  ['shotgun', 'side'],
  ['spear', 'side'],
];
/** The views of the weapons measured this run. */
const views = VIEWS.filter(([w]) => weapons.some(([x]) => x === w));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/'/g, '&#39;');
const text = (s, w, h, size = 14, weight = 600, fill = '#e8e8e8') =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#15181d"/><text x="8" y="${h / 2 + size / 3}" font-family="sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(s)}</text></svg>`);

mkdirSync(out, { recursive: true });
const rescore = !!process.env.RESCORE;
let results = [];
const errors = [];
const saved = existsSync(join(out, 'audit.json')) ? JSON.parse(readFileSync(join(out, 'audit.json'), 'utf8')).results : [];
/** Everything measured so far, kept on disk after each character (a long run can be stopped and RESUME=1 carries on). */
const save = () => {
  const ids = new Set(results.map((r) => r.id));
  writeFileSync(join(out, 'audit.json'), JSON.stringify({ when: new Date().toISOString(), flags: FLAGS, results: [...saved.filter((r) => !ids.has(r.id)), ...results] }, null, 1));
};
if (rescore) {
  // Flags again from the last measurements (thresholds changed), no rendering.
  results = JSON.parse(readFileSync(join(out, 'audit.json'), 'utf8')).results.map((r) => ({ ...r, ...flagsOf(r) }));
} else {
  const browser = await chromium.launch({
    ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}),
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  // AUDIT_PX=<px>: a smaller page renders faster (software GL); the tiles are TILE px either way.
  const px = Number(process.env.AUDIT_PX) || TILE * 2;
  const page = await browser.newPage({ viewport: { width: px, height: px } });

  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/?mode=grips&test=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__grips, null, { timeout: 180_000 });
  if (process.env.PALMS) await page.evaluate((rule) => window.__grips.palmRule(rule), process.env.PALMS);
  const known = new Set((await page.evaluate(() => window.__grips.looks())).map((l) => l.id));

  const done = new Set(process.env.RESUME ? saved.filter((r) => Object.values(r.weapons).every((m) => !m.error)).map((r) => r.id) : []);
  for (const c of wanted) {
    if (done.has(c.id)) continue;
    if (!known.has(c.look)) {
      console.error(`${c.id}: no look ${c.look}`);
      continue;
    }
    const t0 = Date.now();
    const r = { ...c, weapons: {} };
    const tiles = {};
    for (const [w, weapon] of weapons) {
      const m = {};
      try {
        await page.evaluate(([l, wp]) => window.__grips.pose(l, wp, 'third'), [c.look, weapon]);
        if (shots && views.some(([vw, v]) => vw === w && v === 'hands')) tiles[`${w}-hands`] = await page.screenshot({ type: 'png' });
        m.audit = await page.evaluate(() => window.__grips.audit());
        m.drawn = await page.evaluate(() => window.__grips.drawn());
        // The gun inside each hand as drawn (tools/gripInside.ts: vertices behind the gun's surface, the deepest; measured, not flagged).
        m.inside = await page.evaluate(() => window.__grips.inside());
        if (w === 'rifle') {
          // Curl test: the fingertips with the hands open, against closed as the game closes them.
          await page.evaluate(() => window.__grips.curl(0));
          const open = await page.evaluate(() => window.__grips.audit());
          await page.evaluate(() => window.__grips.curl(1));
          m.curl = Object.fromEntries(['l', 'r'].map((s) => [s, open?.hands[s]?.tips != null && m.audit?.hands[s]?.tips != null ? Math.round((open.hands[s].tips - m.audit.hands[s].tips) * 1000) / 1000 : null]));
          // ...and the support hand against the handguard's line: palm up under the handguard, its fingers close up
          // round the guard, away from the support point on its underside (`curl` read that as a backward curl).
          const guard = (h) => h?.hands.l?.tipsGuard ?? null;
          m.curlGuard = { l: guard(open) != null && guard(m.audit) != null ? Math.round((guard(open) - guard(m.audit)) * 1000) / 1000 : m.curl.l, r: m.curl.r };
        }
        for (const [vw, v] of views) {
          if (vw !== w || v === 'hands' || !shots) continue;
          await page.evaluate((from) => window.__grips.upper(from), v);
          tiles[`${w}-${v}`] = await page.screenshot({ type: 'png' });
        }
        if (firstPerson && w !== 'spin') {
          await page.evaluate(([l, wp]) => window.__grips.pose(l, wp, 'body'), [c.look, weapon]);
          m.fp = await page.evaluate(() => window.__grips.drawn());
          m.fpInside = await page.evaluate(() => window.__grips.inside());
        }
      } catch (e) {
        m.error = e.message.split('\n')[0];
      }
      r.weapons[w] = m;
    }
    Object.assign(r, flagsOf(r));
    results.push(r);
    save();
    if (shots) {
      const composite = [];
      views.forEach(([w, v], i) => {
        const shot = tiles[`${w}-${v}`];
        composite.push({ input: text(`${w} ${v}`, TILE, LABEL, 12, 500), left: i * TILE, top: HEAD });
        if (shot) composite.push({ input: shot, left: i * TILE, top: HEAD + LABEL });
      });
      const resized = await Promise.all(composite.map(async (t) => (t.top === HEAD + LABEL ? { ...t, input: await sharp(t.input).resize(TILE, TILE).png().toBuffer() } : t)));
      const title = `${c.name} (${c.id}, ${c.rig})  score ${r.score}: ${r.flags.join(', ') || 'ok'}`;
      resized.push({ input: text(title, views.length * TILE, HEAD, 16, 700, r.score ? '#ffcf6a' : '#9be39b'), left: 0, top: 0 });
      await sharp({ create: { width: views.length * TILE, height: HEAD + LABEL + TILE, channels: 3, background: '#15181d' } }).composite(resized).png().toFile(join(out, `${c.id}.png`));
    }
    console.log(`${c.id}: ${r.score} ${r.flags.join(',')} tear ${tearOf(r)} pistol inside ${insideOf(r)} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  }
  await browser.close();

}

// Ranked, worst first: everything on disk (a RESUME or ONLY run adds to what was measured before).
if (!rescore) {
  const ids = new Set(results.map((r) => r.id));
  results = [...saved.filter((r) => !ids.has(r.id)), ...results];
}
results.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
writeFileSync(join(out, 'audit.json'), JSON.stringify({ when: new Date().toISOString(), flags: FLAGS, results }, null, 1));
/**
 * The pistol in the hands (tools/gripInside.ts), third person then full-body first person, R / L: the gun's own points
 * inside the hand (the grip showing through the palm or fingers), deepest cm and how many, then the hand's skin
 * inside the gun the same way.
 */
function insideOf(r) {
  const m = r.weapons.pistol;
  const f = (x) => (x ? ['r', 'l'].map((s) => `${(x[s].gunDepth * 100).toFixed(1)} (${x[s].gunVerts}) · ${(x[s].depth * 100).toFixed(1)} (${x[s].verts})`).join(' / ') : '-');
  return m ? `${f(m.inside)}; ${f(m.fpInside)}` : '-';
}
/** The hands' tear (tools/gripAudit.ts `tear`), worst over the weapons: longest edge stretch, then triangles turned over. */
function tearOf(r) {
  const t = { r: null, l: null };
  for (const m of Object.values(r.weapons)) for (const s of ['r', 'l']) {
    const x = m.audit?.tear?.[s];
    if (x) t[s] = t[s] ? { max: Math.max(t[s].max, x.max), flipped: Math.max(t[s].flipped, x.flipped) } : { max: x.max, flipped: x.flipped };
  }
  return ['r', 'l'].map((s) => (t[s] ? `${t[s].max}x ${t[s].flipped}` : '-')).join(' / ');
}
const n = (x, d = 2) => (x === null || x === undefined ? '-' : Number(x).toFixed(d));
const rows = results.map((r) => {
  const a = r.weapons.rifle?.audit;
  const d = r.weapons.rifle?.drawn;
  return `| ${r.name} | ${r.rig} | ${r.score} | ${r.flags.join(' ') || 'ok'} | ${n(a?.gun?.headToGun)} | ${n(a?.gun?.elbowSide.r)} | ${n(a?.elbows.r?.flex)}/${n(a?.elbows.l?.flex)} | ${n(a?.hands.r?.fingerShare)}/${n(a?.hands.l?.fingerShare)} | ${n(a?.hands.r?.tips)}/${n(a?.hands.l?.tips)} | ${n(d?.r)}/${n(d?.l)} | ${n(d?.sideR)}/${n(d?.palmL)} | ${a?.stretch.spikes ?? '-'} (${a?.stretch.max ?? '-'}) | ${tearOf(r)} | ${insideOf(r)} |`;
});
writeFileSync(
  join(out, 'summary.md'),
  [
    '| Character | Rig | Score | Flags | head-gun m | R elbow side | elbow flex R/L | finger share R/L | tips m R/L | drawn m R/L | palms R/L | spikes (max) | hand tear R/L | pistol in hand R/L (gun in hand cm (points) · hand in gun cm (verts); third; first) |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...rows,
    '',
    `Flags per weapon (${weapons.map(([w]) => w).join(', ')}):`,
    '',
    `| Character | ${weapons.map(([w]) => w).join(' | ')} |`,
    `|---|${weapons.map(() => '---').join('|')}|`,
    ...results.map((r) => `| ${r.name} | ${weapons.map(([w]) => (r.byWeapon?.[w] ? r.byWeapon[w].join(' ') || 'ok' : '-')).join(' | ')} |`),
    '',
  ].join('\n'),
);
if (shots && !rescore) {
  const per = 8;
  for (let p = 0; p * per < results.length; p++) {
    const page = results.slice(p * per, (p + 1) * per).filter((r) => existsSync(join(out, `${r.id}.png`)));
    const h = HEAD + LABEL + TILE;
    await sharp({ create: { width: views.length * TILE, height: page.length * h, channels: 3, background: '#15181d' } })
      .composite(page.map((r, i) => ({ input: join(out, `${r.id}.png`), left: 0, top: i * h })))
      .png()
      .toFile(join(out, `sheet-${p + 1}.png`));
  }
}
console.log(`${join(out, 'summary.md')} · ${results.length} characters · ${results.filter((r) => r.score).length} flagged`);
if (errors.length) console.error(`page errors: ${errors.join('; ')}`);
