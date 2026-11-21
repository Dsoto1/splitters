// The animation census of a match (tools/perf/match-profile.mjs, step `census`): from the distances of the characters
// in view, sampled through the match, how many character evaluations a second the animation LOD makes at a frame rate,
// with the bands alone and with the crowd rule (animLod.ts crowdStep, `?perfoff=animcrowd`), so the rule is measured on
// the map's own crowd without timing anything. Run by match-profile; on its own:
//   node --experimental-transform-types tools/perf/anim-census.mjs <census.json> [fps ...]
import { readFileSync } from 'node:fs';

const lod = await import('../../packages/client/src/game/animLod.ts');
const { screenShare } = await import('../../packages/client/src/game/ragdollBudget.ts');

/**
 * Evaluations a second at `fps` over the samples ({ dt ms, fov, d: distances of the living characters in view }), each
 * character on its own StepClock and phase as GameView gives it.
 */
export function evaluations(census, fps, crowd) {
  const frameMs = 1000 / fps;
  const clocks = new Map();
  let frame = 0;
  let evals = 0;
  let t = 0;
  for (const s of census.samples) {
    const near = s.d.map((x) => x.dist * x.dist).sort(lod.byNumber);
    const frames = Math.max(1, Math.round(s.dt / frameMs));
    for (let f = 0; f < frames; f++, frame++, t += frameMs) {
      for (const x of s.d) {
        const share = screenShare(x.dist, s.fov);
        const band = lod.animStepByShare(share);
        const step = crowd ? lod.crowdStep(band, lod.rankIn(near, x.dist * x.dist), share, near.length) : band;
        let c = clocks.get(x.slot);
        if (!c) clocks.set(x.slot, (c = new lod.StepClock()));
        if (c.due(t, frame, step, (x.slot * 37) % 100, true)) evals++;
      }
    }
  }
  return evals / (t / 1000);
}

export function summarize(census, rates = [39, 60]) {
  const inView = census.samples.map((s) => s.d.length);
  const avg = inView.reduce((a, b) => a + b, 0) / Math.max(1, inView.length);
  const within = (m) => census.samples.reduce((a, s) => a + s.d.filter((x) => x.dist < m).length, 0) / Math.max(1, census.samples.length);
  return {
    samples: census.samples.length,
    inViewAvg: Math.round(avg * 10) / 10,
    within8m: Math.round(within(8) * 10) / 10,
    within15m: Math.round(within(15) * 10) / 10,
    within40m: Math.round(within(40) * 10) / 10,
    perSecond: Object.fromEntries(rates.map((fps) => [`${fps}fps`, { bands: Math.round(evaluations(census, fps, false)), crowd: Math.round(evaluations(census, fps, true)) }])),
  };
}

if (process.argv[1]?.endsWith('anim-census.mjs') && process.argv[2]) {
  const census = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const rates = process.argv.slice(3).map(Number);
  console.log(JSON.stringify(summarize(census, rates.length ? rates : undefined), null, 1));
}
