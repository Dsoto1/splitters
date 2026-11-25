import { describe, expect, it } from 'vitest';
import { CRASH_REPORT_MAX_BYTES, cleanCrashReport, coarseAgent, crashSignature, fitCrashReport, scrubCrashText, type CrashReport } from '../src/net/crashReport.ts';

const base = (): CrashReport => ({
  v: 1,
  kind: 'error',
  sig: '00000000',
  message: 'TypeError: x is undefined',
  stack: 'at frame (main-abc123.js:10:5)',
  version: '0.42.0',
  sha: 'abcdef0123456789abcdef0123456789abcdef01',
  map: 'sandgate',
  mode: 'core.tdm',
  screen: 'game',
  quality: 'high',
  browser: 'Chrome 131',
  os: 'Windows',
  at: '2026-11-24T10:15Z',
});

describe('crash report scrubbing', () => {
  it('cuts URLs and paths to the bundle file names, keeping line and column', () => {
    const stack = [
      'TypeError: boom',
      '    at Session.frame (https://trigger.toshiroplay.com/assets/session-Bx9z1Q2a.js?v=3:120:44)',
      '    at http://127.0.0.1:5173/src/game/view.ts:88:9',
      'frame@https://trigger.toshiroplay.com/assets/main-Ab12Cd34.js:3:9',
      '    at blob:https://trigger.toshiroplay.com/9f1c2d3e-0000-4000-8000-123456789abc:1:2',
      '    at load (/home/someone/projects/splitters/packages/client/src/main.ts:12:3)',
      '    at C:\\Users\\Someone\\game\\worker.js:7:1',
      '    at chrome-extension://abcdefghijklmnop/inject.js:1:1',
    ].join('\n');
    const out = scrubCrashText(stack);
    expect(out).toContain('(session-Bx9z1Q2a.js:120:44)');
    expect(out).toContain('at view.ts:88:9');
    expect(out).toContain('frame@main-Ab12Cd34.js:3:9');
    expect(out).toContain('(main.ts:12:3)');
    expect(out).toContain('at worker.js:7:1');
    expect(out).toContain('[extension]');
    for (const gone of ['toshiroplay', '127.0.0.1', 'someone', 'Someone', 'splitters', 'abcdefghijklmnop', '9f1c2d3e', 'http', '/']) expect(out).not.toContain(gone);
  });

  it('removes emails, addresses, account IDs, tokens and the player name', () => {
    const msg = 'player Zed_Ninja (zed@example.com, sub 3f2b1c4d-1111-4222-8333-944455556666) from 203.0.113.7 / 2001:db8:85a3:0:0:8a2e:370:7334 token eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnop';
    const out = scrubCrashText(msg, ['Zed_Ninja', '']);
    expect(out).toBe('player [name] ([email], sub [id]) from [ip] / [ip] token [token]');
  });

  it('caps the size by trimming the stack first', () => {
    const big = fitCrashReport({ ...base(), stack: 'x'.repeat(50_000), message: 'm'.repeat(5000) });
    expect(new TextEncoder().encode(JSON.stringify(big)).length).toBeLessThanOrEqual(CRASH_REPORT_MAX_BYTES);
    expect(big.message.length).toBe(300);
    expect(big.stack.length).toBeLessThanOrEqual(4000);
    // Wide characters: still under the cap.
    const wide = fitCrashReport({ ...base(), stack: '😀'.repeat(4000) });
    expect(new TextEncoder().encode(JSON.stringify(wide)).length).toBeLessThanOrEqual(CRASH_REPORT_MAX_BYTES);
  });

  it('gives the same break the same signature across builds and numbers', () => {
    const a = crashSignature('error', 'TypeError: cannot read 3 of undefined', 'at f (main-Ab12Cd34.js:10:5)\nat g (session-Zz99Yy88.js:20:1)');
    const b = crashSignature('error', 'TypeError: cannot read 7 of undefined', 'at f (main-Qq77Rr66.js:11:9)\nat g (session-Pp11Oo22.js:21:4)');
    const c = crashSignature('error', 'TypeError: something else', 'at f (main-Ab12Cd34.js:10:5)');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{8}$/);
  });

  it('reads only the browser family and OS family', () => {
    expect(coarseAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.86 Safari/537.36')).toEqual({ browser: 'Chrome 131', os: 'Windows' });
    expect(coarseAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15')).toEqual({ browser: 'Safari 18', os: 'macOS' });
    expect(coarseAgent('Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0')).toEqual({ browser: 'Firefox 133', os: 'Linux' });
    expect(coarseAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.2903.70')).toEqual({ browser: 'Edge 131', os: 'Windows' });
    expect(coarseAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1')).toEqual({ browser: 'Safari 18', os: 'iOS' });
    expect(coarseAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36')).toEqual({ browser: 'Chrome 131', os: 'Android' });
    expect(coarseAgent('curl/8.0')).toEqual({ browser: 'other', os: 'other' });
  });
});

describe('the hub check of a report', () => {
  it('keeps a good report, scrubbed again, with its own signature and fields only', () => {
    const r = cleanCrashReport({ ...base(), message: 'Error: at https://evil.example/x/y.js:1:1 by bob@mail.com', extra: 'dropped', name: 'Zed' });
    expect(typeof r).toBe('object');
    const c = r as CrashReport;
    expect(c.message).toBe('Error: at y.js:1:1 by [email]');
    expect(Object.keys(c).sort()).toEqual(Object.keys(base()).sort());
    expect(c.sig).toBe(crashSignature('error', c.message, c.stack));
    expect(c.at).toBe('2026-11-24T10:15Z');
  });

  it('refuses what is not a report', () => {
    for (const [bad, why] of [
      [null, 'not a report'],
      [[], 'not a report'],
      [{ ...base(), v: 2 }, 'unknown version'],
      [{ ...base(), kind: 'boom' }, 'bad kind'],
      [{ ...base(), message: '' }, 'bad message or stack'],
      [{ ...base(), message: 'x'.repeat(3000) }, 'bad message or stack'],
      [{ ...base(), version: '1.0 <script>' }, 'bad build'],
      [{ ...base(), map: 'My Secret Map' }, 'bad map or mode'],
      [{ ...base(), screen: 'shop' }, 'bad context'],
      [{ ...base(), browser: 'Chrome 131.0.6778.86 (my machine)' }, 'bad context'],
      [{ ...base(), os: 'Windows 11 build 22631' }, 'bad context'],
      [{ ...base(), at: 'yesterday' }, 'bad time'],
    ] as const)
      expect(cleanCrashReport(bad), JSON.stringify(bad)?.slice(0, 60)).toBe(why);
    expect(typeof cleanCrashReport({ ...base(), map: null, mode: null, quality: null })).toBe('object');
  });
});
