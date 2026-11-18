// Grip fit and audit (owner, 2026-11-18, "2a": third-person grip offsets computed from each character's measured
// hands, hand tuning only for the outliers an audit flags). Every player character holds a long gun (the rifle) and a
// pistol in the Character Select pose (`?mode=grips`, the game's own animator and renderer); for each hold the tool
//   1. measures where the hands are drawn with no offsets, and with the manifest's hand-set ones (`fixes.grip`),
//   2. fits the offsets automatically: moves each hand's point on the gun until its drawn skin sits where the
//      reference hands sit (TARGET below: the median of every character's drawn hand with the hand-set offsets the
//      owner approved), a few damped steps,
//   3. scores each candidate (none, hand-set, auto) by the error metric (cm from the target, per hand) and the audit's
//      flags (tools/content/grip-flags.mjs: palm the wrong way, off the grip, the hand through the gun),
//   4. keeps the auto fit unless the hand-set offsets score better (then they stay in the manifest), and flags an
//      outlier where even the best is over the thresholds (THRESH): those are the ones to tune by hand.
// It also reads the universal first-person arms' colours off each model (tools/content/arm-colours.mjs).
//
//   pnpm build && pnpm --filter @tiletrigger/client exec vite preview --port 4860
//   node tools/content/grip-fit.mjs http://localhost:4860 <work dir outside the repo>
//
// Writes <work>/fit.json (every measurement, saved after each character; RESUME=1 carries on) and <work>/summary.md
// (the ranked table), and with WRITE=1 content/grip-fit.json (what the build reads: the chosen offsets and colours,
// keyed by the model's hash so a rebuilt model shows as stale) and, with STRIP=1, removes from each manifest the
// hand-set offsets the audit replaced. ONLY=<ids> for some; RESCORE=1 scores <work>/fit.json again without rendering.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { armColoursOf } from './arm-colours.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
/** The offsets the fit owns, per hold (GripTune, looks.ts): [shooting hand, support hand]. */
export const OFFSETS = { long: ['gripLong', 'supportLong'], pistol: ['gripPistol', 'supportPistol'] };
/** The weapon each hold is fitted on (every gun of that style shares the hold's shape: CHARACTERS.md "Holding weapons"). */
export const HOLD_WEAPON = { long: 'core.rifle', pistol: 'core.pistol' };
/**
 * Which of each hand's three axes (the gun's right, up, ahead) the fit moves, and how much each counts in the error.
 * A long gun's support hand slides back along the handguard on short arms by design, so its `ahead` isn't fitted or
 * counted; the shooting hand's `right` (across the grip) follows from the hand's thickness (characterAnimator
 * palmOnGrip), so it is counted but only moved to pull a hand out of the gun or onto it.
 */
export const AXES = {
  long: { r: [0.5, 1, 1], l: [1, 1, 0] },
  pistol: { r: [0.5, 1, 1], l: [1, 1, 1] },
};
/** Pass marks (cm, the weighted error per hand): over either, the hold is an outlier for hand tuning. */
export const THRESH = { r: 2.5, l: 4 };
/** Hand-set offsets stay only when they beat the fit by this much (cm of summed error) or the fit raises a flag they don't. */
export const KEEP_MARGIN = 0.5;
/** Fit steps, damping, and the most the fit moves a point (m, each axis). */
const STEPS = 5;
const DAMP = 0.8;
const LIMIT = 0.09;
/** The flags that matter to a hold's fit (grip-flags.mjs; the body's posture flags aren't the offsets' doing). */
const HAND_FLAGS = ['palm', 'off', 'open', 'back'];

const round = (v) => Math.round(v * 1000) / 1000;
const median = (xs) => {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  return s.length ? s[s.length >> 1] : 0;
};

/** The weighted error (cm) of a drawn hand at `at` (gun axes, model m) against `target` for one hand of a hold. */
export function handError(at, target, weights) {
  if (!at) return 99;
  let s = 0;
  for (let k = 0; k < 3; k++) s += (weights[k] * (at[k] - target[k])) ** 2;
  return round(Math.sqrt(s) * 100);
}

/** One step of the fit: offsets moved toward the target by the drawn error (the hand follows its point one for one). */
export function fitStep(offset, at, target, weights) {
  return offset.map((o, k) => {
    if (!weights[k] || !at) return o;
    const move = (target[k] - at[k]) * DAMP * (weights[k] < 1 ? 0.5 : 1);
    return round(Math.max(-LIMIT, Math.min(LIMIT, o + move)));
  });
}

/** The targets: per hold and hand, the median drawn position over the characters whose hand-set offsets passed the audit. */
export function targetsOf(results) {
  const out = {};
  for (const hold of Object.keys(OFFSETS)) {
    out[hold] = {};
    for (const s of ['r', 'l']) {
      const key = s === 'r' ? 'atR' : 'atL';
      // The approved: hand-set where there are some, else none (most characters were left on the shared hold as good).
      const ats = results
        .map((r) => r.holds?.[hold])
        .filter((h) => h && !h.error)
        .map((h) => (h.hand ?? h.none))
        .filter((m) => m?.drawn?.[key] && !m.flags?.some((f) => HAND_FLAGS.includes(f)))
        .map((m) => m.drawn[key]);
      out[hold][s] = [0, 1, 2].map((k) => round(median(ats.map((a) => a[k]))));
    }
  }
  return out;
}

/** A candidate's score: the weighted error of each hand, and its hand flags. */
export function scoreOf(m, hold, target) {
  const eR = handError(m?.drawn?.atR, target[hold].r, AXES[hold].r);
  const eL = handError(m?.drawn?.atL, target[hold].l, AXES[hold].l);
  const flags = (m?.flags ?? []).filter((f) => HAND_FLAGS.includes(f));
  return { eR, eL, flags, total: round(eR + eL * 0.6 + flags.length * 3) };
}

/**
 * The choice for one hold: auto unless the hand-set offsets beat it by KEEP_MARGIN; an outlier where the chosen one is
 * still over THRESH or raises a hand flag.
 */
export function choose(h, hold, target) {
  const auto = h.auto ? scoreOf(h.auto, hold, target) : null;
  const hand = h.hand ? scoreOf(h.hand, hold, target) : null;
  const none = scoreOf(h.none, hold, target);
  let pick = 'auto';
  if (!auto) pick = hand ? 'hand' : 'none';
  else if (hand && hand.total + KEEP_MARGIN < auto.total) pick = 'hand';
  const s = pick === 'auto' ? auto : pick === 'hand' ? hand : none;
  const outlier = s.eR > THRESH.r || s.eL > THRESH.l || s.flags.length > 0;
  return { pick, score: s, scores: { none, hand, auto }, outlier };
}

/**
 * A manifest's text without the `fixes.grip` offsets named in `keys` (and without an emptied `grip`), the rest of
 * its hand formatting kept. Throws if the result isn't the same manifest less those keys.
 */
export function stripOffsets(text, keys) {
  const before = JSON.parse(text);
  let s = text;
  // A grip written on one line: written again on one line without those keys.
  const inline = /"grip": (\{[^\n]*\})(,?)(?=\n)/.exec(s);
  if (inline) {
    const rest = Object.entries(JSON.parse(inline[1])).filter(([k]) => !keys.includes(k));
    const val = (v) => (Array.isArray(v) ? `[${v.join(', ')}]` : JSON.stringify(v));
    s = rest.length ? s.replace(inline[0], `"grip": { ${rest.map(([k, v]) => `"${k}": ${val(v)}`).join(', ')} }${inline[2]}`) : s.replace(inline[0], `"grip": {}${inline[2]}`);
  }
  for (const k of keys) s = s.replace(new RegExp(`\\n[ \\t]*"${k}": \\[[^\\]]*\\],?(?=\\n)`), '');
  s = s.replace(/,(\n[ \t]*})/g, '$1');
  s = s.replace(/,\n[ \t]*"grip": \{\s*\}/, '').replace(/\n[ \t]*"grip": \{\s*\},?(?=\n)/, '');
  s = s.replace(/,(\n[ \t]*})/g, '$1');
  const after = JSON.parse(s);
  const want = structuredClone(before);
  for (const k of keys) delete want.fixes.grip[k];
  if (!Object.keys(want.fixes.grip).length) delete want.fixes.grip;
  if (JSON.stringify(after) !== JSON.stringify(want)) throw new Error('stripOffsets: the manifest changed beyond the offsets');
  return s;
}

// ------------------------------------------------------------------------------------------------------ the run

async function main() {
  const base = process.argv[2] ?? 'http://localhost:4860';
  const work = resolve(process.argv[3] ?? join(tmpdir(), 'tiletrigger-grip-fit'));
  if (!relative(ROOT, work).startsWith('..')) throw new Error(`work files go outside the repo, not ${work}`);
  mkdirSync(work, { recursive: true });
  const only = process.env.ONLY?.split(',').filter(Boolean);
  const MANIFESTS = join(ROOT, 'content/characters');
  const lock = JSON.parse(readFileSync(join(ROOT, 'content/meshy.lock.json'), 'utf8')).files;
  const hashOf = new Map(lock.filter((f) => f.role === 'meshy').map((f) => [f.id, f.sha256]));
  const manifests = readdirSync(MANIFESTS)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ file: join(MANIFESTS, f), m: JSON.parse(readFileSync(join(MANIFESTS, f), 'utf8')) }))
    .filter(({ m }) => m.status !== 'queued' && m.kind !== 'creature' && /player/.test(m.use ?? ''));
  const wanted = only ? manifests.filter(({ m }) => only.includes(m.id) || only.includes(m.look)) : manifests;
  const fitFile = join(work, 'fit.json');
  const saved = existsSync(fitFile) ? JSON.parse(readFileSync(fitFile, 'utf8')) : { results: [] };
  const results = new Map(saved.results.map((r) => [r.id, r]));
  const save = () => writeFileSync(fitFile, JSON.stringify({ when: new Date().toISOString(), target: saved.target, results: [...results.values()] }, null, 1));

  if (!process.env.RESCORE) {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({
      ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}),
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    const page = await browser.newPage({ viewport: { width: 320, height: 320 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${base}/?mode=grips&test=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__grips, null, { timeout: 180_000 });
    /** Measure the posed hold with `grip` (a GripTune): where the hands are drawn, the gun in the hands, the audit's flags. */
    const measure = async (grip, full) => {
      const drawn = await page.evaluate((g) => window.__grips.retune(g), grip);
      if (!full) return { drawn };
      const audit = await page.evaluate(() => window.__grips.audit());
      const inside = await page.evaluate(() => window.__grips.inside());
      return { drawn, audit, inside };
    };
    const flagged = async (hold, m) => {
      const { flagsOf } = await import('./grip-flags.mjs');
      const w = hold === 'long' ? 'rifle' : 'pistol';
      return flagsOf({ weapons: { [w]: { audit: m.audit, drawn: m.drawn } } }).flags;
    };
    // Pass 1: none and hand-set for everyone (the targets come from these); pass 2: the fit.
    for (const pass of [1, 2]) {
      // A run of some characters (ONLY) fits to the committed targets; a run of everyone measures them again.
      const committed = existsSync(join(ROOT, 'content/grip-fit.json')) ? JSON.parse(readFileSync(join(ROOT, 'content/grip-fit.json'), 'utf8')).target : null;
      const target = pass === 2 ? (saved.target = only && committed ? committed : targetsOf([...results.values()])) : null;
      if (pass === 2) console.log('targets', JSON.stringify(target));
      for (const { m } of wanted) {
        const r = results.get(m.id) ?? { id: m.id, look: m.look, name: m.name, holds: {} };
        if (process.env.RESUME && (pass === 1 ? Object.keys(OFFSETS).every((h) => r.holds[h]?.none) : Object.keys(OFFSETS).every((h) => r.holds[h]?.auto || r.holds[h]?.error))) continue;
        const t0 = Date.now();
        r.hash = hashOf.get(m.id) ?? null;
        const tune = m.fixes?.grip ?? {};
        const kept = Object.fromEntries(Object.entries(tune).filter(([k]) => !Object.values(OFFSETS).flat().includes(k)));
        if (pass === 1) {
          r.hands = null;
          try {
            r.colours = await armColoursOf(m.id);
          } catch (e) {
            r.colours = { error: e.message };
          }
        }
        for (const [hold, [gk, sk]] of Object.entries(OFFSETS)) {
          const h = (r.holds[hold] ??= {});
          try {
            await page.evaluate(([l, w]) => window.__grips.pose(l, w, 'third'), [m.look, HOLD_WEAPON[hold]]);
            if (pass === 1) {
              r.hands ??= await page.evaluate(() => window.__grips.hands());
              h.none = await measure(Object.keys(kept).length ? kept : null, true);
              h.none.flags = await flagged(hold, h.none);
              if (tune[gk] || tune[sk]) {
                h.hand = await measure({ ...kept, ...(tune[gk] ? { [gk]: tune[gk] } : {}), ...(tune[sk] ? { [sk]: tune[sk] } : {}) }, true);
                h.hand.flags = await flagged(hold, h.hand);
                h.handOffsets = { ...(tune[gk] ? { [gk]: tune[gk] } : {}), ...(tune[sk] ? { [sk]: tune[sk] } : {}) };
              } else delete h.hand;
            } else {
              let off = { r: [0, 0, 0], l: [0, 0, 0] };
              let at = h.none.drawn;
              const steps = [];
              for (let i = 0; i < STEPS; i++) {
                off = { r: fitStep(off.r, at?.atR, target[hold].r, AXES[hold].r), l: fitStep(off.l, at?.atL, target[hold].l, AXES[hold].l) };
                at = (await measure({ ...kept, [gk]: off.r, [sk]: off.l }, false)).drawn;
                steps.push(round(handError(at?.atR, target[hold].r, AXES[hold].r) + handError(at?.atL, target[hold].l, AXES[hold].l)));
              }
              h.auto = await measure({ ...kept, [gk]: off.r, [sk]: off.l }, true);
              h.auto.flags = await flagged(hold, h.auto);
              h.autoOffsets = { [gk]: off.r, [sk]: off.l };
              h.steps = steps;
            }
            delete h.error;
          } catch (e) {
            h.error = e.message.split('\n')[0];
          }
        }
        results.set(m.id, r);
        save();
        console.log(`pass ${pass} ${m.id} (${((Date.now() - t0) / 1000).toFixed(1)} s)${pass === 2 ? ` ${Object.keys(OFFSETS).map((h) => `${h} ${r.holds[h].steps?.join('→') ?? r.holds[h].error}`).join(' · ')}` : ''}`);
      }
    }
    await browser.close();
    if (errors.length) console.error(`page errors: ${errors.slice(0, 5).join('; ')}`);
  }
  const target = (saved.target ??= targetsOf([...results.values()]));
  save();
  report(work, [...results.values()], target, manifests);
}

/** summary.md, and with WRITE=1 content/grip-fit.json (and STRIP=1 the replaced hand-set offsets out of the manifests). */
function report(work, results, target, manifests) {
  const rows = [];
  const fits = {};
  const counts = { auto: 0, hand: 0, none: 0, outliers: 0, holds: 0 };
  for (const r of results.sort((a, b) => a.id.localeCompare(b.id))) {
    const entry = { hash: r.hash, ...(r.colours && !r.colours.error ? { arms: { skin: r.colours.skin, cloth: r.colours.cloth, trim: r.colours.trim } } : {}), grip: {}, keep: [], audit: {} };
    for (const hold of Object.keys(OFFSETS)) {
      const h = r.holds?.[hold];
      if (!h?.none || h.error) {
        entry.audit[hold] = { error: h?.error ?? 'not measured', outlier: true };
        counts.outliers++;
        continue;
      }
      const c = choose(h, hold, target);
      counts.holds++;
      counts[c.pick]++;
      if (c.outlier) counts.outliers++;
      if (c.pick === 'auto') Object.assign(entry.grip, h.autoOffsets);
      if (c.pick === 'hand') entry.keep.push(...Object.keys(h.handOffsets ?? {}));
      entry.audit[hold] = { pick: c.pick, eR: c.score.eR, eL: c.score.eL, flags: c.score.flags, outlier: c.outlier, ...(c.scores.hand ? { hand: c.scores.hand.total } : {}), auto: c.scores.auto?.total ?? null, none: c.scores.none.total };
      rows.push({ id: r.id, name: r.name, hold, ...c });
    }
    fits[r.id] = entry;
  }
  rows.sort((a, b) => b.score.total - a.score.total);
  const f = (s) => (s ? `${s.eR}/${s.eL}${s.flags.length ? ` ${s.flags.join(' ')}` : ''}` : '-');
  writeFileSync(
    join(work, 'summary.md'),
    [
      `Grip fit: ${counts.holds} holds · auto ${counts.auto} · hand-set kept ${counts.hand} · none ${counts.none} · outliers ${counts.outliers}`,
      '',
      `Targets (gun axes right, up, ahead; model m): ${JSON.stringify(target)}`,
      '',
      '| Character | Hold | Pick | Outlier | Error cm R/L (flags): picked | none | hand-set | auto |',
      '|---|---|---|---|---|---|---|---|',
      ...rows.map((x) => `| ${x.name} | ${x.hold} | ${x.pick} | ${x.outlier ? 'yes' : ''} | ${f(x.score)} | ${f(x.scores.none)} | ${f(x.scores.hand)} | ${f(x.scores.auto)} |`),
      '',
    ].join('\n'),
  );
  console.log(`${join(work, 'summary.md')}: ${JSON.stringify(counts)}`);
  if (process.env.WRITE) {
    // Characters not in this run keep their committed entries.
    const file = join(ROOT, 'content/grip-fit.json');
    const before = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).characters ?? {} : {};
    const live = new Set(manifests.map(({ m }) => m.id));
    for (const [id, e] of Object.entries(before)) if (!fits[id] && live.has(id)) fits[id] = e;
    for (const id of Object.keys(fits).sort()) {
      const e = fits[id];
      delete fits[id];
      fits[id] = e;
    }
    writeFileSync(
      join(ROOT, 'content/grip-fit.json'),
      `${JSON.stringify({ about: 'Generated by tools/content/grip-fit.mjs (docs/CHARACTERS.md, "Grips auto-fit"): per character, the fitted third-person grip offsets, the hand-set ones the audit kept (`keep`, still in the manifest), the universal first-person arms colours and the audit; `hash` is the model the fit was measured on.', target, characters: fits }, null, 1)}\n`,
    );
    console.log('wrote content/grip-fit.json');
  }
  if (process.env.STRIP) {
    for (const { file, m } of manifests) {
      const fit = fits[m.id];
      const grip = m.fixes?.grip;
      if (!fit || !grip) continue;
      const owned = Object.values(OFFSETS).flat();
      const drop = Object.keys(grip).filter((k) => owned.includes(k) && !fit.keep.includes(k));
      if (!drop.length) continue;
      writeFileSync(file, stripOffsets(readFileSync(file, 'utf8'), drop));
    }
    console.log('stripped replaced hand-set offsets from the manifests');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
