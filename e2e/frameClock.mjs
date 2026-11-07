// A page clock for recording frames (the flicker check, e2e/flicker.mjs). Installed into a page before its scripts
// run (`context.addInitScript(installFrameClock)`), it passes time straight through until the test freezes it. Frozen,
// the page's time (performance.now, Date.now) stands still and moves only when the test steps it, one frame at a
// time: the timers due by then (the match's ticks on the page's thread, the game's own timeouts) run in order at
// their own times, then the frame callbacks (the render loop draws once), and the frame just drawn can be read off
// the canvas in the same task. Every recorded second is then exactly the frames a player at that frame rate sees,
// however slowly the machine draws them.
//
// (Playwright's clock does the same, but each of its timers waits for the real event loop in between, and its
// screenshots wait for real animation frames a frozen page never asks for: minutes per recorded second on a loaded
// machine.) Workers keep their own time: flows that record run the match on the page (MAIN_THREAD_FLOWS).

/** The init script: `window.__frameClock` = { freeze(), step(ms) → errors, frozen, now() }. */
export function installFrameClock() {
  if (window.__frameClock) return;
  const real = {
    now: performance.now.bind(performance),
    date: Date.now.bind(Date),
    setTimeout: window.setTimeout.bind(window),
    clearTimeout: window.clearTimeout.bind(window),
    setInterval: window.setInterval.bind(window),
    clearInterval: window.clearInterval.bind(window),
    raf: window.requestAnimationFrame.bind(window),
    caf: window.cancelAnimationFrame.bind(window),
  };
  let frozen = false;
  let vnow = 0;
  let dateOffset = 0;
  let seq = 0;
  /** id → { fn, args, delay, repeat, due (page ms), realId } */
  const timers = new Map();
  /** id → { cb, realId } */
  const frames = new Map();
  const errors = [];
  const now = () => (frozen ? vnow : real.now());
  const call = (fn, args) => {
    try {
      if (typeof fn === 'function') fn(...args);
    } catch (e) {
      errors.push(String(e?.stack ?? e).slice(0, 400));
    }
  };
  const arm = (id, t) => {
    if (frozen) return;
    const fire = () => {
      if (!timers.has(id)) return;
      if (t.repeat) t.due += t.delay;
      else timers.delete(id);
      call(t.fn, t.args);
    };
    t.realId = t.repeat ? real.setInterval(fire, t.delay) : real.setTimeout(fire, t.delay);
  };
  const add = (fn, delay, args, repeat) => {
    const id = ++seq;
    const d = Math.max(0, Number(delay) || 0);
    const t = { fn, args, delay: repeat ? Math.max(1, d) : d, repeat, due: now() + d, realId: 0 };
    timers.set(id, t);
    arm(id, t);
    return id;
  };
  const clear = (id) => {
    const t = timers.get(id);
    if (!t) return;
    if (t.realId) (t.repeat ? real.clearInterval : real.clearTimeout)(t.realId);
    timers.delete(id);
  };
  Object.defineProperty(performance, 'now', { configurable: true, writable: true, value: now });
  Date.now = () => (frozen ? dateOffset + vnow : real.date());
  window.setTimeout = (fn, delay, ...args) => add(fn, delay, args, false);
  window.setInterval = (fn, delay, ...args) => add(fn, delay, args, true);
  window.clearTimeout = clear;
  window.clearInterval = clear;
  window.requestAnimationFrame = (cb) => {
    const id = ++seq;
    const f = { cb, realId: 0 };
    frames.set(id, f);
    if (!frozen)
      f.realId = real.raf((ts) => {
        if (!frames.has(id)) return;
        frames.delete(id);
        call(cb, [frozen ? vnow : ts]);
      });
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    const f = frames.get(id);
    if (!f) return;
    if (f.realId) real.caf(f.realId);
    frames.delete(id);
  };
  window.__frameClock = {
    get frozen() {
      return frozen;
    },
    now,
    /** Stop the page's time where it is: from here it moves only by `step`. */
    freeze() {
      if (frozen) return;
      vnow = real.now();
      dateOffset = real.date() - vnow;
      frozen = true;
      for (const t of timers.values()) {
        if (t.realId) (t.repeat ? real.clearInterval : real.clearTimeout)(t.realId);
        t.realId = 0;
      }
      for (const f of frames.values()) {
        if (f.realId) real.caf(f.realId);
        f.realId = 0;
      }
    },
    /**
     * Move the frozen time on `ms`: the timers due by then, in order at their own times (one that sets another
     * runs that one too, if it falls due in time), then the frame callbacks waiting (one frame). The errors they
     * threw, if any.
     */
    step(ms) {
      if (!frozen) throw new Error('frame clock: freeze() first');
      const to = vnow + Math.max(0, ms);
      const thrown = errors.length;
      for (let guard = 0; guard < 100000; guard++) {
        let next = null;
        let nextId = 0;
        for (const [id, t] of timers) if (t.due <= to && (!next || t.due < next.due || (t.due === next.due && id < nextId))) [next, nextId] = [t, id];
        if (!next) break;
        vnow = Math.max(vnow, next.due);
        if (next.repeat) next.due += next.delay;
        else timers.delete(nextId);
        call(next.fn, next.args);
      }
      vnow = to;
      const waiting = [...frames.values()];
      frames.clear();
      for (const f of waiting) call(f.cb, [vnow]);
      return errors.slice(thrown);
    },
  };
}
