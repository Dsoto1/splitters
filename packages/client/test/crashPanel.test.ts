import { beforeAll, describe, expect, it, vi } from 'vitest';
import { CRASH_REPORT_MAX_BYTES } from '@tiletrigger/shared/crashReport';

vi.stubGlobal('__APP_VERSION__', '0.42.0');
vi.stubGlobal('__ASSET_VERSION__', 'abcdef0123456789');

let panel: typeof import('../src/crashPanel.ts');
let ctx: typeof import('../src/crashReport.ts');
beforeAll(async () => {
  ctx = await import('../src/crashReport.ts');
  panel = await import('../src/crashPanel.ts');
});

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.86 Safari/537.36';

describe('the crash report the panel would send', () => {
  it('carries the build, map, mode and coarse browser, and nothing about the player', () => {
    vi.stubGlobal('__front', { name: 'Zed_Ninja', displayName: '[TT] Zed_Ninja' });
    Object.assign(ctx.crashContext, { map: 'sandgate', mode: 'core.tdm', screen: 'game' });
    const r = panel.buildReport(
      { kind: 'error', message: 'TypeError: Zed_Ninja has no weapon', stack: 'at f (https://trigger.toshiroplay.com/assets/session-Bx9z1Q2a.js:1:2)\nat g (/home/zed/x/main.ts:3:4)' },
      new Date('2026-11-24T10:15:42Z'),
      UA,
    );
    expect(r).toMatchObject({ v: 1, kind: 'error', version: '0.42.0', sha: 'abcdef0123456789', map: 'sandgate', mode: 'core.tdm', screen: 'game', browser: 'Chrome 131', os: 'Windows', at: '2026-11-24T10:15Z' });
    expect(r.message).toBe('TypeError: [name] has no weapon');
    expect(r.stack).toBe('at f (session-Bx9z1Q2a.js:1:2)\nat g (main.ts:3:4)');
    const text = JSON.stringify(r);
    for (const gone of ['Zed', 'zed', 'toshiroplay', '6778']) expect(text).not.toContain(gone);
  });

  it('names the map and mode only in a match', () => {
    Object.assign(ctx.crashContext, { map: 'sandgate', mode: 'core.tdm', screen: 'menu' });
    expect(panel.buildReport({ kind: 'error', message: 'x', stack: '' }, new Date(), UA)).toMatchObject({ map: null, mode: null, screen: 'menu' });
  });

  it('stays under the size cap', () => {
    const r = panel.buildReport({ kind: 'rejection', message: 'x'.repeat(10_000), stack: 'at y (z.js:1:1)\n'.repeat(2000) }, new Date(), UA);
    expect(new TextEncoder().encode(JSON.stringify(r)).length).toBeLessThanOrEqual(CRASH_REPORT_MAX_BYTES);
  });

  it('offers each break once a session, one at a time, three at most', () => {
    expect(panel.takeOffer('aaaa0001')).toBe(true);
    // One open at a time.
    expect(panel.takeOffer('aaaa0002')).toBe(false);
    panel.closed();
    // The same break again: not offered.
    expect(panel.takeOffer('aaaa0001')).toBe(false);
    expect(panel.takeOffer('aaaa0002')).toBe(true);
    panel.closed();
    expect(panel.takeOffer('aaaa0003')).toBe(true);
    panel.closed();
    expect(panel.takeOffer('aaaa0004')).toBe(false);
  });
});

describe('which breaks are reported', () => {
  const origin = 'https://trigger.toshiroplay.com';
  it('reports our own errors and rejections, and describes lost graphics and freezes', () => {
    const err = new TypeError('x is undefined');
    expect(panel.breakOf('error', { filename: `${origin}/assets/main-abc.js`, error: err, message: 'Uncaught TypeError' }, origin)).toMatchObject({ kind: 'error', message: 'TypeError: x is undefined' });
    expect(panel.breakOf('rejection', err, origin)?.message).toBe('TypeError: x is undefined');
    expect(panel.breakOf('rejection', 'plain text', origin)?.message).toBe('plain text');
    expect(panel.breakOf('webgl', 20, origin)?.message).toBe('WebGL context lost and not restored after 20 s');
    expect(panel.breakOf('freeze', 31, origin)?.message).toBe('The game stopped drawing for 31 s');
  });

  it('leaves out other scripts, opaque errors and what the browser stopped on purpose', () => {
    expect(panel.breakOf('error', { filename: 'chrome-extension://abc/inject.js', error: new Error('x'), message: 'x' }, origin)).toBeNull();
    expect(panel.breakOf('error', { filename: '', error: null, message: 'Script error.' }, origin)).toBeNull();
    expect(panel.breakOf('error', { filename: `${origin}/a.js`, error: null, message: 'ResizeObserver loop completed with undelivered notifications.' }, origin)).toBeNull();
    for (const name of ['AbortError', 'NotAllowedError', 'TimeoutError']) expect(panel.breakOf('rejection', Object.assign(new Error('stopped'), { name }), origin)).toBeNull();
  });
});
