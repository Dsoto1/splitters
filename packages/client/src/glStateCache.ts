/**
 * Redundant WebGL calls dropped before they reach the browser (docs/PERF_STJOHNS_2026-11-14.md, "Main scene drawing").
 *
 * Babylon re-sends state that has not changed on almost every draw. On St. John's main pass (High, an eye-level view,
 * about 370 draws) that was some 4,000 GL calls a frame, a third of them redundant:
 * - every draw that receives the sun's shadow sets the cascades' `lightMatrix` (3 matrices), `viewFrustumZ` and
 *   `frustumLengths` again (Babylon caches single values, never arrays or matrix lists), and thin-instanced batches
 *   set the same identity `world` matrix again;
 * - the pre-pass renderer switches the draw buffers to the scene's extra targets before each draw and back after it,
 *   two `drawBuffers` calls a draw, though most neighbours want the same targets.
 * Each call is checked and copied by the page, sent to the GPU process and checked and translated there (ANGLE, to
 * Metal on a Mac) before any drawing happens, so a frame of them costs main-thread and GPU-process time whatever the
 * draws themselves cost.
 *
 * What it does, with GL's own rules (nothing is guessed):
 * - **Uniforms**: a uniform's value belongs to its program, so a call that sets a uniform to the value it already
 *   holds changes nothing and is dropped (kept per program and uniform name, whichever location object names it). Values are compared as passed (so a
 *   changed one always goes through); calls with a sub-range, a transposed matrix or more than `MAX_CACHED` numbers
 *   go straight through and forget what was cached for that location.
 * - **Draw buffers**: the draw-buffer list belongs to the framebuffer it was set on. A `drawBuffers` call is held
 *   until something uses it (a draw, a clear, a blit, a framebuffer switch or a state query) and is only sent when it
 *   differs from what that framebuffer already has, so "extra targets, back, extra targets" between two draws is
 *   nothing at all.
 * Lost and restored contexts start the caches again. WebGPU does not use this.
 */

/** Uniform values longer than this (numbers) are not cached (bone matrix lists: they change every frame anyway). */
const MAX_CACHED = 64;

export interface GlStateCacheStats {
  uniforms: number;
  uniformsSkipped: number;
  drawBuffers: number;
  drawBuffersSent: number;
}

type AnyGl = WebGL2RenderingContext & Record<string, unknown>;
type Fn = (...a: unknown[]) => unknown;

/** Calls that read or write the bound draw framebuffer's draw buffers: a held drawBuffers is sent first. */
const USES_DRAW_BUFFERS = [
  'drawArrays',
  'drawElements',
  'drawArraysInstanced',
  'drawElementsInstanced',
  'drawRangeElements',
  'clear',
  'clearBufferfv',
  'clearBufferiv',
  'clearBufferuiv',
  'clearBufferfi',
  'blitFramebuffer',
  'getParameter',
  'getFramebufferAttachmentParameter',
  'invalidateFramebuffer',
  'invalidateSubFramebuffer',
  'readPixels',
  'flush',
  'finish',
];

/** The uniform setters, as `name: index of the value argument` (matrices take a transpose flag first). */
function uniformSetters(gl: AnyGl): Map<string, number> {
  const out = new Map<string, number>();
  for (let p: object | null = gl; p && p !== Object.prototype; p = Object.getPrototypeOf(p)) {
    for (const name of Object.getOwnPropertyNames(p)) {
      if (out.has(name)) continue;
      if (/^uniform[1-4](f|i|ui)v?$/.test(name)) out.set(name, name.endsWith('v') ? 1 : -1);
      else if (/^uniformMatrix[2-4](x[2-4])?fv$/.test(name)) out.set(name, 2);
    }
  }
  return out;
}

/**
 * Wraps `gl`'s uniform setters, `drawBuffers`, `bindFramebuffer`, `deleteFramebuffer` and the calls that use draw
 * buffers on the context object itself (its prototype is untouched). Returns the counts and a function that takes it off.
 */
export function installGlStateCache(gl: WebGL2RenderingContext): { stats: GlStateCacheStats; remove: () => void } {
  const g = gl as AnyGl;
  const stats: GlStateCacheStats = { uniforms: 0, uniformsSkipped: 0, drawBuffers: 0, drawBuffersSent: 0 };
  const own = new Map<string, PropertyDescriptor | undefined>();
  const real = (name: string): Fn => {
    const f = g[name] as Fn;
    return f.bind(gl) as Fn;
  };
  const wrap = (name: string, make: (call: Fn) => Fn) => {
    if (typeof g[name] !== 'function') return;
    own.set(name, Object.getOwnPropertyDescriptor(g, name));
    const f = make(real(name));
    Object.defineProperty(g, name, { value: f, configurable: true, writable: true });
  };

  // ---- uniforms: the last value set per uniform of a program
  // Two lookups of one uniform give two location objects, so values are kept per (program, name): the same key for
  // every location of it. Linking a program again resets its uniforms, and its keys with them.
  let keys = new WeakMap<WebGLUniformLocation, object>();
  let byProgram = new WeakMap<WebGLProgram, Map<string, object>>();
  wrap('getUniformLocation', (call) => (program: unknown, name: unknown) => {
    const loc = call(program, name) as WebGLUniformLocation | null;
    if (loc && program) {
      let names = byProgram.get(program as WebGLProgram);
      if (!names) byProgram.set(program as WebGLProgram, (names = new Map()));
      const n = String(name).replace(/\[0\]$/, '');
      let key = names.get(n);
      if (!key) names.set(n, (key = {}));
      keys.set(loc, key);
    }
    return loc;
  });
  wrap('linkProgram', (call) => (program: unknown) => {
    if (program) byProgram.delete(program as WebGLProgram);
    return call(program);
  });
  let values = new WeakMap<object, Float64Array>();
  const sameAndKeep = (at: WebGLUniformLocation, src: ArrayLike<number>, from: number, n: number): boolean => {
    const loc = keys.get(at) ?? at;
    let had = values.get(loc);
    if (had && had.length === n) {
      let same = true;
      for (let i = 0; i < n; i++) {
        if (had[i] !== src[from + i]) {
          same = false;
          break;
        }
      }
      if (same) return true;
    } else {
      had = new Float64Array(n);
      values.set(loc, had);
    }
    for (let i = 0; i < n; i++) had[i] = src[from + i]!;
    return false;
  };
  for (const [name, at] of uniformSetters(g)) {
    wrap(name, (call) => (...a: unknown[]) => {
      const loc = a[0] as WebGLUniformLocation | null;
      stats.uniforms++;
      if (!loc) return call(...a);
      if (at < 0) {
        // uniform1f(loc, x), uniform3i(loc, x, y, z): the numbers after the location.
        if (sameAndKeep(loc, a as ArrayLike<number>, 1, a.length - 1)) return void stats.uniformsSkipped++;
        return call(...a);
      }
      const data = a[at] as ArrayLike<number> | null | undefined;
      // A sub-range (srcOffset, srcLength), a transposed matrix or a long list: sent as it is, the cache forgotten.
      if (!data || a.length > at + 1 || (at === 2 && a[1]) || data.length > MAX_CACHED) {
        values.delete(keys.get(loc) ?? loc);
        return call(...a);
      }
      if (sameAndKeep(loc, data, 0, data.length)) return void stats.uniformsSkipped++;
      return call(...a);
    });
  }

  // ---- draw buffers: per framebuffer, held until used
  const DEFAULT = {};
  let applied = new WeakMap<object, string>();
  let bound: object = DEFAULT;
  let pending: number[] | null = null;
  let pendingKey = '';
  const sendDrawBuffers = real('drawBuffers');
  const flush = () => {
    if (!pending) return;
    const list = pending;
    pending = null;
    stats.drawBuffersSent++;
    applied.set(bound, pendingKey);
    sendDrawBuffers(list);
  };
  wrap('drawBuffers', () => (list: unknown) => {
    stats.drawBuffers++;
    const l = list as ArrayLike<number>;
    let key = '';
    for (let i = 0; i < l.length; i++) key += `${l[i]},`;
    if (applied.get(bound) === key) {
      pending = null;
      return;
    }
    pending = Array.from(l);
    pendingKey = key;
  });
  const DRAW_TARGETS = new Set<number>([gl.FRAMEBUFFER, gl.DRAW_FRAMEBUFFER]);
  wrap('bindFramebuffer', (call) => (target: unknown, fb: unknown) => {
    if (!DRAW_TARGETS.has(target as number)) return call(target, fb);
    flush();
    call(target, fb);
    bound = (fb as object | null) ?? DEFAULT;
  });
  wrap('deleteFramebuffer', (call) => (fb: unknown) => {
    // Deleting the bound framebuffer binds the default one; what was held for it goes with it.
    if (fb && fb === bound) {
      pending = null;
      bound = DEFAULT;
    }
    return call(fb);
  });
  for (const name of USES_DRAW_BUFFERS) {
    wrap(name, (call) => (...a: unknown[]) => {
      if (pending) flush();
      return call(...a);
    });
  }

  // ---- a lost context forgets all of it (a restored one starts from GL's defaults)
  const reset = () => {
    values = new WeakMap();
    keys = new WeakMap();
    byProgram = new WeakMap();
    applied = new WeakMap();
    bound = DEFAULT;
    pending = null;
  };
  const canvas = gl.canvas as HTMLCanvasElement | OffscreenCanvas | undefined;
  canvas?.addEventListener?.('webglcontextlost', reset);
  canvas?.addEventListener?.('webglcontextrestored', reset);

  return {
    stats,
    remove: () => {
      flush();
      canvas?.removeEventListener?.('webglcontextlost', reset);
      canvas?.removeEventListener?.('webglcontextrestored', reset);
      for (const [name, d] of own) {
        if (d) Object.defineProperty(g, name, d);
        else delete g[name];
      }
      own.clear();
    },
  };
}
