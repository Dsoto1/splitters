// Browser end-to-end checks: MapMaker edit -> TEST -> edit loop, persistence,
// and two online clients against the dedicated server.
// Usage: pnpm build && pnpm e2e
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const CLIENT = 'http://localhost:4173';
const SERVER_PORT = 7787;
const procs = [];
let failures = 0;

function start(cmd, args, env = {}) {
  // Own process group, so stopping it also stops pnpm's children (vite, tsx).
  const p = spawn(cmd, args, { env: { ...process.env, ...env }, stdio: 'ignore', detached: true });
  procs.push(p);
  return p;
}

function check(cond, message) {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${message}`);
  if (!cond) failures++;
}

async function waitForHttp(url, ms = 20000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await sleep(200);
  }
  throw new Error(`timed out waiting for ${url}`);
}

async function editorFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 820 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${CLIENT}/?mode=editor`);
  await page.waitForFunction(() => window.__editor, null, { timeout: 30000 });
  page.once('dialog', (d) => d.accept());
  await page.click('#ed-new');
  await page.evaluate(() => window.__editor.view.focus({ x: 8, y: 0, z: 0 }));
  const doc = () => page.evaluate(() => window.__editor.doc);
  const clickWorld = async (x, z) => {
    const p = await page.evaluate(([x, z]) => window.__editor.view.project({ x, y: 0, z }), [x, z]);
    await page.mouse.move(p.x, p.y);
    await page.mouse.click(p.x, p.y);
  };

  await page.click('[data-tool="tile:core.corridor"]');
  await page.keyboard.press('KeyR');
  await clickWorld(8, 0);
  await page.click('[data-tool="tile:core.room_pillar"]');
  await clickWorld(16, 0);
  await clickWorld(0, 0); // occupied
  let d = await doc();
  check(d.classicStructure.tiles.length === 3, 'places tiles and refuses an occupied cell');

  await page.click('[data-tool="spawn"]');
  await clickWorld(18.5, 2.5);
  await page.keyboard.press('Escape');
  d = await doc();
  check(d.entities.length === 2, 'places a spawn');

  const pillar = await page.evaluate(() => window.__editor.view.project({ x: 16, y: 0, z: 0 }));
  const north = await page.evaluate(() => window.__editor.view.project({ x: 16, y: 0, z: 8 }));
  await page.mouse.move(pillar.x, pillar.y);
  await page.mouse.down();
  await page.mouse.move(north.x, north.y, { steps: 8 });
  await page.mouse.up();
  const tileOf = async () => (await doc()).classicStructure.tiles.find((t) => t.tile === 'core.room_pillar');
  check((await tileOf()).y === 1, 'drag-moves a tile one cell');
  await page.keyboard.press('Control+KeyZ');
  check((await tileOf()).y === 0, 'undo restores the move');
  await page.keyboard.press('Control+KeyY');
  check((await tileOf()).y === 1, 'redo reapplies the move');
  await page.keyboard.press('Control+KeyZ');

  // Paint: brick walls on the start room, then checker floors on every room via scope.
  await page.click('[data-tool="paint"]');
  await page.click('[data-material="core.red_brick"]');
  const wall = await page.evaluate(() => window.__editor.view.project({ x: 0, y: 2, z: 3.5 }));
  await page.mouse.move(wall.x, wall.y);
  await page.mouse.click(wall.x, wall.y);
  const startRoom = async () => (await doc()).classicStructure.tiles.find((t) => t.tile === 'core.room');
  check((await startRoom()).surfaces?.walls?.material === 'core.red_brick', 'paints a wall surface');
  await page.click('[data-material="core.checker"]');
  await page.click('[data-tint="#4cc9f0"]');
  await page.selectOption('#ed-scope', 'all');
  const floor = await page.evaluate(() => window.__editor.view.project({ x: 1.5, y: 0, z: 1.5 }));
  await page.mouse.move(floor.x, floor.y);
  await page.mouse.click(floor.x, floor.y);
  d = await doc();
  check(d.classicStructure.tiles.every((t) => t.surfaces?.floor?.material === 'core.checker' && t.surfaces.floor.tint === '#4cc9f0'), 'paints every floor in one stroke (whole-map scope)');
  await page.screenshot({ path: process.env.E2E_SHOTS ? `${process.env.E2E_SHOTS}/paint.png` : '/dev/null' }).catch(() => {});
  await page.keyboard.press('Control+KeyZ');
  d = await doc();
  check(!d.classicStructure.tiles.some((t) => t.surfaces?.floor) && (await startRoom()).surfaces?.walls, 'undo removes the whole stroke in one step');
  await page.keyboard.press('Control+KeyY');
  await page.selectOption('#ed-scope', 'surface');
  await page.keyboard.press('Escape');

  // Pickups: place a health pack in the start room.
  await page.click('[data-tool="pickup:core.health_small"]');
  await clickWorld(-2, -2);
  await page.keyboard.press('Escape');
  d = await doc();
  check(d.entities.some((e) => e.kind === 'pickup' && e.item === 'core.health_small'), 'places a pickup');

  // Scenario: a locked door snapped into the doorway, a button and a spike trap, wired with a logic template.
  await page.click('[data-tool="scenario:door_locked"]');
  await clickWorld(4.4, 0.6);
  await page.click('[data-tool="scenario:button"]');
  await clickWorld(-2, 3);
  await page.click('[data-tool="scenario:trap:spikes"]');
  await clickWorld(8, -2);
  await page.keyboard.press('Escape');
  d = await doc();
  const door = d.entities.find((e) => e.kind === 'door');
  const btn = d.entities.find((e) => e.kind === 'button');
  check(door && door.locked && door.position[0] === 4 && door.position[2] === 0 && Math.abs(door.yaw - Math.PI / 2) < 1e-6, 'locked door snaps into the doorway');
  check(btn && d.entities.some((e) => e.kind === 'trap' && e.trap === 'spikes'), 'places a button and a spike trap');
  await page.click('#ed-logic-btn');
  await page.selectOption('.lg-head select', '0');
  d = await doc();
  const rule = d.logic.rules[0];
  check(d.logic.rules.length === 1 && rule.when.event === 'button_pressed' && rule.when.target === btn.id && rule.do.some((a) => a.type === 'door_unlock' && a.target === door.id), 'logic template wires the button to the door');
  // Panels refresh on the editor's next frame (slow under software rendering): wait for it to catch up.
  await page.evaluate(() => document.activeElement?.blur());
  await page
    .waitForFunction(() => !/does nothing|never unlocks/.test(document.getElementById('ed-issues')?.textContent ?? ''), null, { timeout: 10000 })
    .catch(() => {});
  const issuesText = await page.textContent('#ed-issues');
  check(!/does nothing|never unlocks/.test(issuesText ?? ''), `validation is satisfied once the rule exists (${issuesText})`);
  await page.click('.lg-head button');
  await page.keyboard.press('Control+KeyZ');
  check((await doc()).logic.rules.length === 0, 'undo removes the rule');
  await page.keyboard.press('Control+KeyY');
  check((await doc()).logic.rules.length === 1, 'redo restores the rule');

  await page.keyboard.press('F5');
  await page.waitForFunction(() => window.__cs?.local && window.__testStartMs, null, { timeout: 20000 });
  const ms = await page.evaluate(() => window.__testStartMs);
  check(ms < 3000, `TEST starts within the 3 s budget (${ms.toFixed(0)} ms)`);
  await page.waitForTimeout(1500);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.getElementById('editor').hidden, null, { timeout: 5000 });
  check(await page.evaluate(() => window.__editor.history.canUndo), 'returns to the editor with history intact');

  await page.keyboard.press('Control+KeyS');
  const id = (await doc()).metadata.id;
  await page.reload();
  await page.waitForFunction(() => window.__editor, null, { timeout: 30000 });
  d = await doc();
  check(d.metadata.id === id && d.classicStructure.tiles.length === 3 && d.classicStructure.tiles[0].surfaces?.floor?.material === 'core.checker', 'autosave restores the painted map after reload');
  await page.click('#ed-open');
  const lib = await page.$$eval('#ed-library li', (ls) => ls.map((l) => l.textContent));
  check(lib.some((t) => t.includes('Untitled Map')), 'saved map is listed in the library');
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
}

async function offlineFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${CLIENT}/?offline`);
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0, null, { timeout: 30000 });
  const inv = await page.evaluate(() => [...window.__cs.local.inventory.keys()]);
  check(inv.join(',') === '1,2', `offline match spawns with knife + pistol (${inv})`);
  await page.waitForTimeout(1500);
  const meshes = await page.evaluate(() => document.getElementById('ammo-count').textContent);
  check(/\d+ \/ \d+/.test(meshes ?? ''), `HUD shows ammo (${meshes})`);
  // A click is the user gesture that starts audio; bots fighting then make sounds.
  await page.click('#resume');
  await page.waitForFunction(() => window.__audio.stats.loaded + window.__audio.stats.failed === window.__audio.total, null, { timeout: 15000 });
  const loaded = await page.evaluate(() => ({ ...window.__audio.stats, total: window.__audio.total }));
  check(loaded.failed === 0 && loaded.loaded === loaded.total, `all ${loaded.total} sounds load and decode (${loaded.failed} failed)`);
  await page.waitForFunction(() => window.__audio.stats.played > 0, null, { timeout: 20000 }).catch(() => {});
  const played = await page.evaluate(() => window.__audio.stats.played);
  check(played > 0, `match events play sounds (${played} played)`);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

async function vaultFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${CLIENT}/?offline=vault`);
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  const objectives = await page.textContent('#objectives');
  check((objectives ?? '').includes('Find the vault control'), `scenario demo shows its first objective (${objectives})`);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

async function outpostFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${CLIENT}/?offline=outpost`);
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  const objectives = await page.textContent('#objectives');
  check((objectives ?? '').includes('Clear the courtyard'), `co-op mission shows its first objective (${objectives})`);
  // Player, two bot teammates and at least one NPC squad, all as animated characters.
  await page.waitForFunction(() => window.__cs.view.characterCount() >= 7, null, { timeout: 20000 }).catch(() => {});
  const chars = await page.evaluate(() => window.__cs.view.characterCount());
  check(chars >= 7, `players, bots and NPC squads are rendered as characters (${chars})`);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

async function charactersFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${CLIENT}/?mode=characters`);
  await page.waitForFunction(() => window.__charsReady === true, null, { timeout: 30000 });
  const n = await page.evaluate(() => window.__charAnimators.length);
  check(n === 18, `character viewer builds every look and NPC (${n})`);
  for (const label of ['Rifle', 'Run', 'shoot', 'Death', 'Idle']) {
    await page.click(`button:text-is("${label}")`);
    await page.waitForTimeout(300);
  }
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

async function onlineFlow(browser) {
  const open = async (name) => {
    const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${CLIENT}/?autojoin&name=${name}&server=ws://localhost:${SERVER_PORT}`);
    await page.waitForFunction(() => window.__cs?.local, null, { timeout: 30000 });
    return { page, errors };
  };
  const a = await open('Alice');
  const b = await open('Bob');
  const slots = [await a.page.evaluate(() => window.__cs.slot), await b.page.evaluate(() => window.__cs.slot)];
  check(slots[0] !== slots[1], `two online clients get distinct slots (${slots})`);
  await a.page.waitForTimeout(1500);
  const alive = await a.page.evaluate(() => window.__cs.local.state.pos.y > -1);
  check(alive, 'client receives snapshots and reconciles its position');
  check(a.errors.length + b.errors.length === 0, `no page errors (${[...a.errors, ...b.errors].join('; ')})`);
}

try {
  start('pnpm', ['--filter', '@chronosplit/client', 'exec', 'vite', 'preview', '--port', '4173', '--strictPort']);
  start('pnpm', ['--filter', '@chronosplit/server', 'start'], { PORT: String(SERVER_PORT), BOT_FILL: '3', QUIET_STATS: '1' });
  await waitForHttp(CLIENT);
  await sleep(1500);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  // E2E_ONLY=editor,characters runs a subset of the flows.
  const only = process.env.E2E_ONLY?.split(',');
  const flows = { editor: editorFlow, offline: offlineFlow, vault: vaultFlow, outpost: outpostFlow, characters: charactersFlow, online: onlineFlow };
  for (const [name, flow] of Object.entries(flows)) if (!only || only.includes(name)) await flow(browser);
  await browser.close();
} catch (e) {
  console.log(`FAIL ${e.message}`);
  failures++;
} finally {
  for (const p of procs) {
    try {
      process.kill(-p.pid, 'SIGTERM');
    } catch {}
  }
}
console.log(failures ? `${failures} check(s) failed` : 'all e2e checks passed');
process.exit(failures ? 1 : 0);
