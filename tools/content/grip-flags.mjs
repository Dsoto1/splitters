// The grip audit's flags (tools/content/grip-audit.mjs, and the grip fit's checks, tools/content/grip-fit.mjs):
// what each means is listed at the top of grip-audit.mjs.
export const FLAGS = {
  FACE_M: 0.11,
  FACE_ABOVE: 0.02,
  CROSSED: 0.35,
  ELBOW_FLEX: -0.25,
  ELBOW_BEND: 25,
  FLAT_SHARE: 0.12,
  CURL_GAIN: 0.008,
  OPEN_R: 0.12,
  OPEN_L: 0.16,
  OFF_R: 0.065,
  OFF_L: 0.1,
  SPIKES: 3,
  SPIKE_MAX: 8,
  FP_OFF: 0.065,
  FP_AHEAD: 0.3,
  PALM_R: 0.25,
  PALM_L: 0,
};
/** How much each flag counts toward the rank (the owner's worst first: a gun at the face, then backwards elbows, then flat hands). */
export const WEIGHT = { face: 5, crossed: 4, elbow: 4, flat: 3, back: 3, palm: 3, open: 2, off: 2, spikes: 3, fp: 2 };

/** The flags a character's measurements raise (rifle side-view numbers for the body, every weapon for the hands). */
export function flagsOf(r) {
  const all = new Set();
  const notes = [];
  /** The flags each weapon raises on its own (the before/after table per weapon class). */
  const byWeapon = {};
  for (const [w, m] of Object.entries(r.weapons)) {
    const a = m.audit;
    if (!a) continue;
    const f = new Set();
    byWeapon[w] = f;
    if (w !== 'pistol' && a.gun) {
      if (w === 'rifle' && (a.gun.headToGun < FLAGS.FACE_M || a.gun.gripAboveShoulder > FLAGS.FACE_ABOVE)) f.add('face');
      if (a.gun.elbowSide.r < FLAGS.CROSSED) f.add('crossed');
    }
    for (const s of ['l', 'r']) {
      const e = a.elbows[s];
      if (e && e.bend > FLAGS.ELBOW_BEND && e.flex < FLAGS.ELBOW_FLEX) {
        f.add('elbow');
        notes.push(`${w} ${s} elbow ${e.bend}° flex ${e.flex}`);
      }
      const h = a.hands[s];
      if (h && h.fingerShare < FLAGS.FLAT_SHARE) f.add('flat');
      // (A long gun's support hand by its handguard's line, where measured: it slides back along it on short arms.)
      const tips = h?.tipsGuard ?? h?.tips ?? null;
      if (tips !== null && tips > (s === 'r' ? FLAGS.OPEN_R : FLAGS.OPEN_L)) f.add('open');
    }
    // The curl test: the support hand on a long gun measured against the handguard's line (CURL=points: against its
    // point, as before 2026-11-06).
    for (const [side, gain] of Object.entries((process.env.CURL === 'points' ? m.curl : m.curlGuard ?? m.curl) ?? {})) {
      if (gain === null) continue;
      if (gain < -FLAGS.CURL_GAIN) {
        f.add('back');
        notes.push(`${side} hand curls away from the grip (${gain} m)`);
      } else if (side === 'r' && gain < FLAGS.CURL_GAIN) f.add('flat');
    }
    const d = m.drawn;
    // A long gun's support hand slides back along the handguard when the arms are short (by design), so only a
    // pistol's support hand is held to its point.
    const pistol = w === 'pistol';
    if (d && ((d.r ?? 0) > FLAGS.OFF_R || (pistol && (d.l ?? 0) > FLAGS.OFF_L))) f.add('off');
    if (a.stretch.spikes >= FLAGS.SPIKES || a.stretch.max > FLAGS.SPIKE_MAX) f.add('spikes');
    const fp = m.fp;
    // Palms the wrong way round, as drawn in third person or first person.
    for (const x of [d, fp]) {
      if (x && ((x.sideR ?? 1) < FLAGS.PALM_R || (x.palmL ?? 1) < FLAGS.PALM_L)) {
        f.add('palm');
        notes.push(`${w} ${x === d ? 'third' : 'first'} person palms: shooting ${x.sideR?.toFixed(2) ?? '-'}, support ${x.palmL?.toFixed(2) ?? '-'}`);
      }
    }
    if (fp && ((fp.r ?? 0) > FLAGS.FP_OFF || (pistol && (fp.l ?? 0) > FLAGS.OFF_L) || (fp.aheadR ?? 1) < FLAGS.FP_AHEAD)) f.add('fp');
    for (const x of f) all.add(x);
  }
  const flags = [...all];
  return { flags, notes, score: flags.reduce((s, x) => s + WEIGHT[x], 0), byWeapon: Object.fromEntries(Object.entries(byWeapon).map(([w, f]) => [w, [...f]])) };
}

