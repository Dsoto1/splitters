// Screenshots of the pause menu for the host and a friend (Host game), at the e2e size and a desk size.
// Usage: pnpm build && node e2e/pauseShots.mjs <out-dir> [label]
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'docs/screenshots/pause';
const label = process.argv[3] ?? 'shot';
const PORT = process.env.SHOT_CLIENT_PORT ?? '4795';
const HUB = process.env.SHOT_HUB_PORT ?? '9795';
const CLIENT = `http://localhost:${PORT}`;
mkdirSync(out, { recursive: true });
const procs = [
  spawn('pnpm', ['--filter', '@tiletrigger/client', 'exec', 'vite', 'preview', '--port', PORT, '--strictPort'], { stdio: 'ignore', detached: true }),
  spawn('pnpm', ['--filter', '@tiletrigger/server', 'hub'], { env: { ...process.env, PORT: HUB, HOST: '127.0.0.1' }, stdio: 'ignore', detached: true }),
];
try {
  await sleep(8000);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const playing = () => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() !== 'waiting' && window.__cs.phase() !== 'countdown';
  const page = async (w, h, url, name) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    await ctx.addInitScript((n) => {
      localStorage.setItem('tiletrigger.graphics', 'low');
      localStorage.setItem('cs.name', n);
    }, name);
    const p = await ctx.newPage();
    p.setDefaultTimeout(180000);
    await p.goto(url, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(playing, null, { timeout: 180000 });
    return p;
  };
  const host = await page(960, 540, `${CLIENT}/?offline=arena&hub=127.0.0.1:${HUB}`, 'Hosty');
  for (let i = 0; i < 3; i++) {
    await host.evaluate(() => document.getElementById('host-game')?.click());
    if (await host.waitForFunction(() => /[A-Z0-9]{6}/.test(document.querySelector('#host-info .host-code b')?.textContent ?? ''), null, { timeout: 30000 }).then(() => true, () => false)) break;
  }
  const code = await host.evaluate(() => document.querySelector('#host-info .host-code b')?.textContent ?? '');
  const friend = await page(640, 360, `${CLIENT}/?join=${code}&hub=127.0.0.1:${HUB}`, 'Friend');
  await sleep(1500);
  // Each view's tabs, when the menu has them.
  const shoot = async (p, who) => {
    await p.evaluate(() => {
      const d = document.getElementById('host-controls');
      if (d && 'open' in d) d.open = true;
    });
    const tabs = await p.evaluate(() => [...document.querySelectorAll('#pause .pause-tabs [data-tab]')].filter((b) => !b.hidden).map((b) => b.dataset.tab));
    for (const size of [[640, 360], [960, 540]]) {
      await p.setViewportSize({ width: size[0], height: size[1] });
      await sleep(300);
      if (!tabs.length) await p.screenshot({ path: `${out}/${label}-${who}-${size[0]}x${size[1]}.png` });
      for (const t of tabs) {
        await p.evaluate((id) => document.querySelector(`#pause .pause-tabs [data-tab="${id}"]`).click(), t);
        await sleep(200);
        await p.screenshot({ path: `${out}/${label}-${who}-${t}-${size[0]}x${size[1]}.png` });
      }
    }
  };
  await shoot(host, 'host');
  await shoot(friend, 'guest');
  await browser.close();
} finally {
  for (const p of procs) {
    try {
      process.kill(-p.pid, 'SIGTERM');
    } catch {}
  }
}
