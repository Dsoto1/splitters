// The flicker check's measure (e2e flow `flashing`; docs/LOOK.md, "Reduce flashing"): WCAG 2.3.1, "Three Flashes or
// Below Threshold", with the general flash and red flash thresholds, measured the way photosensitivity analysers
// (EA's IRIS, PEAT) do it, on recorded frames at a fixed frame rate.
//
// - Relative luminance per pixel (sRGB to linear, then 0.2126 R + 0.7152 G + 0.0722 B).
// - A frame's change: the largest change at least `area` of the screen made (the quarter of the screen that brightened
//   most, or that darkened most, whichever is more), counting only pixels whose darker state is below `darkMax`.
// - Changes the same way add up over frames; one that reaches `delta` is a transition (once per run: a slow fade is
//   one transition however long it takes). A flash is a pair of opposing transitions.
// - Red: the same on "red saturation" ((R - G - B) x 320, linear, where R / (R + G + B) >= 0.8), a transition being
//   a change of `redDelta` or more.
// - It fails on more than three flashes in any second (more than `maxTransitions` transitions), general or red, and
//   when `area` of the screen turns saturated red within `redOnsetMs` (a large red flash, however rare).

/** WCAG 2.3.1's thresholds as the check applies them. */
export const FLICKER_LIMITS = Object.freeze({
  /** Share of the screen a change must cover (WCAG: a quarter of any 10° field; analysers use a quarter of the screen). */
  area: 0.25,
  /** Relative luminance change that makes a transition (10 % of the maximum). */
  delta: 0.1,
  /** Only changes whose darker state is below this count (brighter changes are not flashes). */
  darkMax: 0.8,
  /** Red saturation change that makes a red transition. */
  redDelta: 20,
  /** More transitions than this in any one second fail: more than three flashes. */
  maxTransitions: 6,
  /** A quarter of the screen turning saturated red faster than this is a red flash (fails at once). */
  redOnsetMs: 250,
});

const LINEAR = (() => {
  const t = new Float64Array(256);
  for (let i = 0; i < 256; i++) {
    const c = i / 255;
    t[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }
  return t;
})();

/** Relative luminance (0..1) of an 8-bit sRGB colour. */
export function luminance(r, g, b) {
  return 0.2126 * LINEAR[r] + 0.7152 * LINEAR[g] + 0.0722 * LINEAR[b];
}

/** Red saturation of an 8-bit sRGB colour: (R - G - B) x 320 on linear values where R / (R + G + B) >= 0.8, else 0. */
export function redness(r, g, b) {
  const R = LINEAR[r];
  const G = LINEAR[g];
  const B = LINEAR[b];
  const sum = R + G + B;
  if (sum <= 0 || R / sum < 0.8) return 0;
  return Math.max(0, (R - G - B) * 320);
}

/**
 * Per-pixel luminance and red saturation of one frame. `px`: RGB or RGBA bytes (`channels` 3 or 4), w × h pixels.
 * Returns { L, red, meanL, redArea } (redArea: the share of pixels saturated red beyond `redDelta`).
 */
export function frameStats(px, w, h, channels = 4, limits = FLICKER_LIMITS) {
  const n = w * h;
  const L = new Float32Array(n);
  const red = new Float32Array(n);
  let sum = 0;
  let reds = 0;
  for (let i = 0, o = 0; i < n; i++, o += channels) {
    const r = px[o];
    const g = px[o + 1];
    const b = px[o + 2];
    const l = luminance(r, g, b);
    L[i] = l;
    sum += l;
    const s = redness(r, g, b);
    red[i] = s;
    if (s > limits.redDelta) reds++;
  }
  return { L, red, w, h, meanL: sum / n, redArea: reds / n };
}

const BINS = 1024;

/**
 * The largest change (signed) that at least `area` of the pixels made between two frames, of `a` → `b` values in
 * 0..`range`: the brightening quarter or the darkening one, whichever moved more. `skip(i)` leaves a pixel out
 * (counted as unchanged).
 */
export function areaChange(a, b, area, range = 1, skip = null) {
  const n = a.length;
  const up = new Uint32Array(BINS + 1);
  const down = new Uint32Array(BINS + 1);
  for (let i = 0; i < n; i++) {
    if (skip && skip(i)) continue;
    const d = (b[i] - a[i]) / range;
    if (d > 0) up[Math.min(BINS, Math.floor(d * BINS))]++;
    else if (d < 0) down[Math.min(BINS, Math.floor(-d * BINS))]++;
  }
  const need = Math.max(1, Math.ceil(area * n));
  const quantile = (hist) => {
    let count = 0;
    for (let k = BINS; k > 0; k--) {
      count += hist[k];
      if (count >= need) return (k / BINS) * range;
    }
    return 0;
  };
  const rise = quantile(up);
  const fall = quantile(down);
  return rise >= fall ? rise : -fall;
}

/** Transitions in a series of per-frame changes: same-signed changes add up; reaching `delta` makes one (per run). */
export function transitionsOf(changes, delta, fps) {
  const out = [];
  let acc = 0;
  let counted = false;
  let runStart = 0;
  changes.forEach((c, i) => {
    if (!c) return;
    if (acc === 0 || Math.sign(c) === Math.sign(acc)) {
      if (acc === 0) runStart = i;
      acc += c;
    } else {
      acc = c;
      counted = false;
      runStart = i;
    }
    if (!counted && Math.abs(acc) >= delta) {
      counted = true;
      out.push({ frame: i + 1, t: (i + 1) / fps, dir: Math.sign(acc), size: Math.abs(acc), frames: i - runStart + 1 });
    }
  });
  return out;
}

/** The most transitions inside any window of `seconds` (a sliding window over their times). */
export function mostInWindow(transitions, seconds = 1) {
  let most = 0;
  let j = 0;
  for (let i = 0; i < transitions.length; i++) {
    while (transitions[i].t - transitions[j].t >= seconds) j++;
    most = Math.max(most, i - j + 1);
  }
  return most;
}

/**
 * WCAG's own area, stricter than a quarter of the screen: a quarter of any 10° visual field, about a third of the
 * screen each way at a typical viewing distance (WCAG: a 341 × 256 window on a 1024 × 768 screen). The most
 * transitions in any second within any such window, slid over the screen by half a window. Reported, not judged.
 */
export function fieldPerSecond(stats, fps, limits = FLICKER_LIMITS) {
  const { w, h } = stats[0] ?? {};
  if (!w || !h) return 0;
  const fw = Math.max(1, Math.round(w / 3));
  const fh = Math.max(1, Math.round(h / 3));
  let most = 0;
  for (let y0 = 0; y0 + fh <= h; y0 += Math.max(1, Math.round(fh / 2))) {
    for (let x0 = 0; x0 + fw <= w; x0 += Math.max(1, Math.round(fw / 2))) {
      const take = (L) => {
        const out = new Float32Array(fw * fh);
        for (let y = 0; y < fh; y++) out.set(L.subarray((y0 + y) * w + x0, (y0 + y) * w + x0 + fw), y * fw);
        return out;
      };
      let prev = take(stats[0].L);
      const changes = [];
      for (let i = 1; i < stats.length; i++) {
        const cur = take(stats[i].L);
        const a = prev;
        changes.push(areaChange(a, cur, limits.area, 1, (k) => Math.min(a[k], cur[k]) >= limits.darkMax));
        prev = cur;
      }
      most = Math.max(most, mostInWindow(transitionsOf(changes, limits.delta, fps)));
    }
  }
  return most;
}

/**
 * Measure a recorded moment. `frames`: [{ px, w, h, channels? }] in order at `fps`; or already `frameStats` results
 * ({ L, red, meanL, redArea }). Returns the numbers and the verdict:
 * { frames, seconds, meanL: [..], change: [..] (per frame, signed), transitions, perSecond (most in any second),
 *   flashesPerSecond, red: { transitions, perSecond, onsets, maxArea }, maxStep (largest one-frame change over the
 *   area), pass, reasons }.
 */
export function analyseFrames(frames, fps, limits = FLICKER_LIMITS) {
  const stats = frames.map((f) => (f.L ? f : frameStats(f.px, f.w, f.h, f.channels ?? 4, limits)));
  const change = [];
  const redChange = [];
  for (let i = 1; i < stats.length; i++) {
    const a = stats[i - 1];
    const b = stats[i];
    change.push(areaChange(a.L, b.L, limits.area, 1, (k) => Math.min(a.L[k], b.L[k]) >= limits.darkMax));
    redChange.push(areaChange(a.red, b.red, limits.area, 320));
  }
  const transitions = transitionsOf(change, limits.delta, fps);
  const redTransitions = transitionsOf(redChange, limits.redDelta, fps);
  const perSecond = mostInWindow(transitions);
  const redPerSecond = mostInWindow(redTransitions);
  // A quarter of the screen turning saturated red quickly.
  const span = Math.max(1, Math.round((limits.redOnsetMs / 1000) * fps));
  const onsets = [];
  for (let i = 1; i < stats.length; i++) {
    let low = stats[i].redArea;
    for (let k = Math.max(0, i - span); k < i; k++) low = Math.min(low, stats[k].redArea);
    if (stats[i].redArea - low >= limits.area && (!onsets.length || i - onsets[onsets.length - 1].frame > span)) onsets.push({ frame: i, t: i / fps, area: stats[i].redArea });
  }
  const reasons = [];
  if (perSecond > limits.maxTransitions) reasons.push(`${perSecond} luminance transitions in one second (${Math.floor(perSecond / 2)} flashes; at most ${limits.maxTransitions})`);
  if (redPerSecond > limits.maxTransitions) reasons.push(`${redPerSecond} red transitions in one second (at most ${limits.maxTransitions})`);
  if (onsets.length) reasons.push(`${onsets.length} red flash${onsets.length > 1 ? 'es' : ''}: a quarter of the screen turned saturated red within ${limits.redOnsetMs} ms`);
  return {
    frames: stats.length,
    seconds: stats.length / fps,
    meanL: stats.map((s) => s.meanL),
    change,
    transitions,
    perSecond,
    flashesPerSecond: Math.floor(perSecond / 2),
    maxStep: change.reduce((m, c) => Math.max(m, Math.abs(c)), 0),
    red: { transitions: redTransitions, perSecond: redPerSecond, onsets, maxArea: stats.reduce((m, s) => Math.max(m, s.redArea), 0) },
    fieldPerSecond: fieldPerSecond(stats, fps, limits),
    pass: reasons.length === 0,
    reasons,
  };
}

/** One line of numbers for a measured moment (the flow's log and its JSON report). */
export function summary(r) {
  const pct = (x) => `${(x * 100).toFixed(1)} %`;
  return `${r.perSecond} transitions/s (${r.flashesPerSecond} flashes/s) of ${r.transitions.length} in ${r.seconds.toFixed(1)} s; biggest one-frame change over a quarter of the screen ${r.maxStep.toFixed(3)}; within a 10° field ${r.fieldPerSecond} transitions/s; red: ${r.red.perSecond} transitions/s, ${r.red.onsets.length} red flashes, up to ${pct(r.red.maxArea)} of the screen saturated red`;
}
