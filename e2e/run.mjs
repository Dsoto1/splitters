// Browser end-to-end checks: MapMaker edit -> TEST -> edit loop, persistence,
// and two online clients against the dedicated server.
// Usage: pnpm build && pnpm e2e   (pnpm e2e:changed: the flows e2e/flowMap.mjs maps your changes to)
//   E2E_ONLY=a,b (those flows), E2E_SHARD=i/n (one of n shards balanced by e2e/timings.json),
//   E2E_RETRIES=1 (a failed flow runs again; passing then it's FLAKY, not a failure), E2E_TIMINGS_OUT=file
//   (per-flow seconds), E2E_UPDATE_BASELINES=1 (visual flow: new pictures).
// Flows that need determinism open pages with ?test=1 (fixed sim seed, seeded MapMaker ids; &god=1 an
// invulnerable player): see packages/client/src/testMode.ts. Wait on conditions, not fixed sleeps
// (tools/ci/lint-e2e-waits.mjs).
import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium, devices } from 'playwright';
import { CHARACTER_FLOWS, COVERAGE_MAP, COVERED_MAPS, FLOWS, MAP_FLOWS, MAP_PARTS } from './flowMap.mjs';
import { assignShards, loadTimings } from './shards.mjs';
import { installFrameClock } from './frameClock.mjs';
import { FLICKER_LIMITS, analyseFrames, frameStats, summary as flickerSummary } from './flicker.mjs';

// E2E_CLIENT_PORT / E2E_SERVER_PORT move the preview and game servers (e.g. when another checkout is testing).
const CLIENT_PORT = process.env.E2E_CLIENT_PORT ?? '4173';
const CLIENT = `http://localhost:${CLIENT_PORT}`;
const SERVER_PORT = +(process.env.E2E_SERVER_PORT ?? 7787);
const procs = [];
/** CI renders in software on a shared runner, several times slower than a desk: every wait stretches there. */
const SLOW = process.env.CI ? 3 : 1;
const T = (ms) => ms * SLOW;
let failures = 0;
/**
 * The game runs its offline match in a Web Worker. These flows reach into it synchronously through
 * `window.__match` (place players, step it, read its state between frames), so they run it on the page's
 * own thread instead (localStorage tiletrigger.sim = main), the fallback the game keeps for browsers
 * without workers. Every other flow plays the worker, and reaches the match through `sim()` / `simWait()`.
 */
const MAIN_THREAD_FLOWS = new Set(['setpieces', 'physicsfx', 'ctf', 'forts', 'breakthrough', 'roulette', 'zombies', 'classes', 'vehicles', 'traffic', 'flashing', ...MAP_FLOWS]);

/** Run `fn(match, me, arg)` where the page's match runs (its worker, or the page), and return what it returns. */
async function sim(page, fn, arg) {
  return page.evaluate(([src, a]) => window.__sim.eval(src, a), [fn.toString(), arg]);
}

/** Wait until `fn(match, me, arg)` is truthy where the page's match runs (across a map change too); true if it got there in time. */
async function simWait(page, fn, arg, ms) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (await sim(page, fn, arg).catch(() => false)) return true;
    await sleep(100);
  }
  return false;
}

/**
 * Wait until `fn(match, me, arg)` holds, giving your own player `seconds` of match time to get there: the
 * match counts the inputs it has taken from this page (`me.lastSeq`, one per tick). A page drawing a frame a
 * second (software rendering on a loaded runner) sends at most a quarter second of input per frame
 * (session.ts caps a frame's step), so your swings, reloads and pickups run several times slower than the
 * clock: a wall-clock wait ran out before a 1.6 s reload had had its 96 ticks. `ms`: a wall-clock cap.
 * True if it held in time.
 */
async function meWait(page, fn, arg, seconds, ms = T(90000)) {
  const seq = () => sim(page, (m, me) => me.lastSeq).catch(() => null);
  let start = await seq();
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (await sim(page, fn, arg).catch(() => false)) return true;
    const now = await seq();
    // (A map change or a respawn starts the count again.)
    if (start === null || now === null || now < start) start = now;
    else if (now - start > seconds * 60) return !!(await sim(page, fn, arg).catch(() => false));
    await sleep(100);
  }
  return false;
}

/**
 * Bots stand still and hold fire (their inputs keep their aim but lose movement and buttons), whatever path
 * the bot's input came by (thinking, steering, coasting): flows that place a bot in front of you get it there
 * and keep it there (a bot held by speedMul alone thinks it is stuck and jumps), nobody else shoots it, and a
 * drop stays where it fell until you walk onto it.
 */
async function holdBots(page) {
  await sim(page, (m) => {
    for (const c of m.combatants()) {
      if (!c.bot || c.queue.held) continue;
      c.queue.push = (...inputs) => Array.prototype.push.apply(c.queue, inputs.map((i) => ({ ...i, forward: 0, right: 0, buttons: 0 })));
      c.queue.held = true;
    }
  });
}

/**
 * After a flow moves an actor in the match: wait until this page draws it there. Shots and blows are lag
 * compensated (the match rewinds targets to the tick your screen showed when you fired, up to 300 ms), so a
 * swing sent before your screen caught up with the move is aimed at where the actor was: on a slow page it
 * misses (and a semi-automatic weapon swings only once per press). `tick`: the match tick it was moved on;
 * also wait until the tick this page sends for lag compensation (`__cs.viewTick()`) has reached it (a drawn position can run a
 * few ticks ahead of it, past the newest snapshot).
 */
async function seenAt(page, slot, at, ms, tick = 0) {
  return page
    .waitForFunction(([s, p, t]) => {
      const a = window.__cs.view.avatars.get(s);
      return !!a && Math.hypot(a.root.position.x - p.x, a.root.position.z - p.z) < 0.25 && (!t || window.__cs.viewTick() >= t);
    }, [slot, at, tick], { timeout: ms })
    .then(() => true, () => false);
}

/** Poll `pred()` (async, node side) until it holds; true if it did within `ms`. */
/** MapMaker's New, on a map of the given size (m) of open ground, or 0 for the sky (no terrain: a blank map). */
async function newMap(page, size = 0) {
  await page.click('#ed-new');
  await page.click(`#ed-new-sizes [data-size="${size}"]`);
  await page.click('#ed-new-create');
  await page.waitForFunction((size) => (size ? window.__editor.doc.terrain?.cols > 1 : !window.__editor.doc.terrain), size, { timeout: T(5000) });
}

async function until(pred, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await pred().catch(() => false)) return true;
    await sleep(100);
  }
  return false;
}

function start(cmd, args, env = {}) {
  // Own process group, so stopping it also stops pnpm's children (vite, tsx).
  const p = spawn(cmd, args, { env: { ...process.env, ...env }, stdio: 'ignore', detached: true });
  procs.push(p);
  return p;
}

/** Pages open right now (every context the run made), for screenshots when a check fails. */
const livePages = new Set();
/** Screenshots in flight, awaited before a flow's pages are closed. */
const shots = [];
const ARTIFACTS = process.env.E2E_ARTIFACTS ?? 'e2e-artifacts';
let currentFlow = 'setup';
/** The failed checks of the flow attempt running now (for the flaky report). */
let attemptFails = [];

function check(cond, message) {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${message}`);
  if (cond) return;
  failures++;
  attemptFails.push(message);
  // What every open page showed when the check failed (uploaded by CI).
  let i = 0;
  for (const page of livePages) {
    const path = `${ARTIFACTS}/${currentFlow}-${failures}-${i++}.png`;
    shots.push(page.screenshot({ path }).catch(() => {}));
  }
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

/** Click a MapMaker palette tool, opening the palette tab that holds it first. */
async function clickTool(page, selector) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const pane = el?.closest('.ed-pane');
    if (pane) document.querySelector(`#ed-pal-tabs [data-pane="${pane.dataset.pane}"]`)?.click();
    // Prop theme groups start folded: open the one holding it.
    const group = el?.closest('.ed-group');
    if (group && !group.classList.contains('open')) group.querySelector('.ed-group-head')?.click();
  }, selector);
  await page.click(selector);
}

/** An image element that has loaded. */
function thumbLoaded(page, sel) {
  return page.evaluate((sel) => {
    const img = document.querySelector(sel);
    return !!img && img.complete && img.naturalWidth > 0;
  }, sel);
}

/** A map plan canvas with something drawn on it (not just the backdrop). */
function planDrawn(page, sel) {
  return page.evaluate((sel) => {
    const c = document.querySelector(sel);
    if (!c?.width || !c.height) return false;
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 16) if (Math.abs(d[i] - 13) + Math.abs(d[i + 1] - 19) + Math.abs(d[i + 2] - 34) > 60) n++;
    return n > 20;
  }, sel);
}

async function editorFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 820 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  await page.goto(`${CLIENT}/?mode=editor&test=1`);
  await page.waitForFunction(() => window.__editor, null, { timeout: T(30000) });
  page.once('dialog', (d) => d.accept());
  await newMap(page);
  await page.evaluate(() => window.__editor.view.focus({ x: 8, y: 0, z: 0 }));
  const doc = () => page.evaluate(() => window.__editor.doc);
  const clickWorld = async (x, z) => {
    const p = await page.evaluate(([x, z]) => window.__editor.view.project({ x, y: 0, z }), [x, z]);
    await page.mouse.move(p.x, p.y);
    await page.mouse.click(p.x, p.y);
  };

  await clickTool(page, '[data-tool="tile:core.corridor"]');
  await page.keyboard.press('KeyR');
  await clickWorld(8, 0);
  await clickTool(page, '[data-tool="tile:core.room_pillar"]');
  await clickWorld(16, 0);
  await clickWorld(0, 0); // occupied
  let d = await doc();
  check(d.classicStructure.tiles.length === 3, 'places tiles and refuses an occupied cell');

  await clickTool(page, '[data-tool="spawn"]');
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
  await clickTool(page, '[data-tool="pickup:core.health_small"]');
  await clickWorld(-2, -2);
  await page.keyboard.press('Escape');
  d = await doc();
  check(d.entities.some((e) => e.kind === 'pickup' && e.item === 'core.health_small'), 'places a pickup');
  // A weapon pickup set to "Random from category: Snipers" in the inspector (it shows a sniper here).
  const SNIPERS = ['core.weapon_sniper', 'core.weapon_marksman', 'core.weapon_railgun'];
  await clickTool(page, '[data-tool="pickup:core.weapon_rifle"]');
  await clickWorld(-3, 1);
  await page.waitForSelector('#ed-pickup-weapon', { timeout: T(10000) });
  await page.selectOption('#ed-pickup-weapon', 'sniper');
  await page.waitForFunction(() => window.__editor.doc.entities.some((e) => e.kind === 'pickup' && e.random === 'sniper'), null, { timeout: T(10000) }).catch(() => {});
  await page.keyboard.press('Escape');
  d = await doc();
  const randomPickup = d.entities.find((e) => e.kind === 'pickup' && e.random);
  check(randomPickup?.random === 'sniper' && SNIPERS.includes(randomPickup.item), `the inspector makes a weapon pickup random from a category (${JSON.stringify(randomPickup && { random: randomPickup.random, item: randomPickup.item })})`);

  // Scenario: a locked door snapped into the doorway, a button and a spike trap, wired with a logic template.
  await clickTool(page, '[data-tool="scenario:door_locked"]');
  await clickWorld(4.4, 0.6);
  await clickTool(page, '[data-tool="scenario:button"]');
  await clickWorld(-2, 3);
  await clickTool(page, '[data-tool="scenario:trap:spikes"]');
  await clickWorld(8, -2);
  await page.keyboard.press('Escape');
  d = await doc();
  const door = d.entities.find((e) => e.kind === 'door');
  const btn = d.entities.find((e) => e.kind === 'button');
  check(door && door.locked && door.position[0] === 4 && door.position[2] === 0 && Math.abs(door.yaw - Math.PI / 2) < 1e-6, 'locked door snaps into the doorway');
  check(btn && d.entities.some((e) => e.kind === 'trap' && e.trap === 'spikes'), 'places a button and a spike trap');
  // An electric fence: a straight run of posts and live wires (the placeable version of the fence border).
  await clickTool(page, '[data-tool="scenario:trap:shock"]');
  await clickWorld(16, -7);
  await page.keyboard.press('Escape');
  d = await doc();
  const fence = d.entities.find((e) => e.kind === 'trap' && e.trap === 'shock');
  const wires = await page.evaluate(() => window.__editor.view.scene.meshes.some((m) => m.name.endsWith('_wires') && m.isEnabled() && m.getTotalVertices() > 0));
  check(fence && fence.length === 12 && fence.activation === 'always' && wires, `places an electric fence run with live wires (${JSON.stringify(fence && { length: fence.length, activation: fence.activation })}, wires ${wires})`);
  await page.click('#ed-logic-btn');
  await page.selectOption('.lg-head select', '0');
  d = await doc();
  const rule = d.logic.rules[0];
  check(d.logic.rules.length === 1 && rule.when.event === 'button_pressed' && rule.when.target === btn.id && rule.do.some((a) => a.type === 'door_unlock' && a.target === door.id), 'logic template wires the button to the door');
  // Panels refresh on the editor's next frame (slow under software rendering): wait for it to catch up.
  await page.evaluate(() => document.activeElement?.blur());
  await page
    .waitForFunction(() => !/does nothing|never unlocks/.test(document.getElementById('ed-issues')?.textContent ?? ''), null, { timeout: T(10000) })
    .catch(() => {});
  const issuesText = await page.textContent('#ed-issues');
  check(!/does nothing|never unlocks/.test(issuesText ?? ''), `validation is satisfied once the rule exists (${issuesText})`);
  await page.click('.lg-head button');
  await page.keyboard.press('Control+KeyZ');
  check((await doc()).logic.rules.length === 0, 'undo removes the rule');
  await page.keyboard.press('Control+KeyY');
  check((await doc()).logic.rules.length === 1, 'redo restores the rule');

  await page.keyboard.press('F5');
  await page.waitForFunction(() => window.__cs?.local && window.__testStartMs, null, { timeout: T(20000) });
  const ms = await page.evaluate(() => window.__testStartMs);
  check(ms < 3000, `TEST starts within the 3 s budget (${ms.toFixed(0)} ms)`);
  // In play, the random pickup holds a sniper of the match's roll, and that is what's drawn.
  const rolled = randomPickup ? await sim(page, (m, _me, id) => m.pickups.find((p) => p.id === id)?.item.id, randomPickup.id).catch(() => null) : null;
  const shown = rolled ? await page.waitForFunction((r) => window.__cs.view.pickupItem(r[0]) === r[1], [randomPickup.id, rolled], { timeout: T(10000) }).then(() => true, () => false) : false;
  check(SNIPERS.includes(rolled) && shown, `a random pickup holds a weapon of its category in TEST, and that is what's drawn (${rolled}, drawn ${shown})`);
  await frames(page, 10);
  await page.keyboard.press('Escape');
  // Leaving TEST rebuilds the editor view; allow for slow software rendering on a busy machine.
  await page.waitForFunction(() => !document.getElementById('editor').hidden, null, { timeout: T(15000) });
  check(await page.evaluate(() => window.__editor.history.canUndo), 'returns to the editor with history intact');

  await page.keyboard.press('Control+KeyS');
  const id = (await doc()).metadata.id;
  // An edit after saving: Quit asks first (in-game dialog), and the change is kept as a draft.
  await page.fill('#ed-name', 'Draft Edit');
  await page.press('#ed-name', 'Enter');
  await page.waitForFunction(() => window.__editor.doc.metadata.name === 'Draft Edit', null, { timeout: T(10000) });
  await page.click('#ed-home');
  const quitAsk = await page.evaluate(() => ({
    open: document.getElementById('ed-quit-dialog').open,
    named: !document.getElementById('ed-quit-name-row').hidden,
    buttons: [...document.querySelectorAll('#ed-quit-dialog button')].map((b) => b.textContent),
  }));
  check(quitAsk.open && !quitAsk.named && quitAsk.buttons.join('|') === 'Save & quit|Quit without saving|Cancel', `Quit with unsaved changes asks Save & quit / Quit without saving / Cancel (${JSON.stringify(quitAsk)})`);
  await page.click('#ed-quit-cancel');
  check(!(await page.evaluate(() => document.getElementById('ed-quit-dialog').open || document.getElementById('editor').hidden)), 'Cancel stays in MapMaker');
  await page.waitForFunction((id) => (localStorage.getItem('cs.editor.drafts') ?? '').includes(id), id, { timeout: T(10000) });
  await page.reload();
  await page.waitForFunction(() => window.__editor, null, { timeout: T(30000) });
  d = await doc();
  check(d.metadata.id !== id && d.metadata.name === 'Untitled Map' && d.classicStructure.tiles.length === 1 && d.entities.length === 1, 'reopening MapMaker shows the blank starter map');
  await page.click('#ed-open');
  const lib = await page.$$eval('#ed-library li', (ls) => ls.map((l) => l.textContent));
  check(lib.some((t) => t.includes('Untitled Map') && t.includes('Saved')), 'saved map is listed in the library');
  check(lib.some((t) => t.startsWith('Unsaved draft (Draft Edit,')), `the unsaved edit is offered as a draft in Open (${lib.slice(0, 3).join(' / ')})`);
  // Each row shows the map's picture and plan, side by side (templates: the automatic picture).
  const tplRow = '#ed-library li:not(.draft):last-child';
  await page.evaluate((sel) => document.querySelector(sel)?.scrollIntoView(), tplRow);
  await page.waitForFunction((sel) => document.querySelector(`${sel} .map-thumbs .pic img`)?.naturalWidth > 0, tplRow, { timeout: T(15000) }).catch(() => {});
  check(await thumbLoaded(page, `${tplRow} .map-thumbs .pic img`), "the Open list shows a template's picture");
  check(await planDrawn(page, `${tplRow} .map-thumbs .plan canvas`), 'and its plan beside it, drawn separately');
  await page.click('#ed-library li.draft > button:first-of-type');
  d = await doc();
  check(d.metadata.id === id && d.metadata.name === 'Draft Edit' && d.classicStructure.tiles.length === 3 && d.classicStructure.tiles[0].surfaces?.floor?.material === 'core.checker', 'opening the draft brings back the painted map with the edit');
  check(await page.evaluate(() => document.getElementById('ed-dirty').classList.contains('on')), 'an opened draft still counts as unsaved');

  // Set thumbnail: frame the editor camera's view and capture it as the map's own picture.
  await page.keyboard.press('Escape');
  await page.waitForSelector('#ed-thumb-set', { timeout: T(5000) }).catch(() => {});
  check(await page.evaluate(() => document.querySelector('.ed-map-thumbs .pic')?.classList.contains('none')), 'Map properties: a new map has no picture yet');
  check(await planDrawn(page, '.ed-map-thumbs .plan canvas'), 'Map properties shows the plan, separate from the picture');
  await page.evaluate(() => window.__editor.view.focus({ x: 8, y: 0, z: 0 }));
  await page.click('#ed-thumb-set');
  check(await page.isVisible('#ed-thumb-frame .ed-thumb-crop'), 'Set thumbnail shows the 16:9 framing guide over the view');
  await page.click('#ed-thumb-capture');
  const pic = await page.waitForFunction(() => window.__editor.doc.metadata.thumbnail ?? null, null, { timeout: T(15000) }).then((h) => h.jsonValue(), () => null);
  check(!!pic && pic.startsWith('data:image/jpeg;base64,') && pic.length > 3000 && pic.length <= 48000, `Capture sets the map's picture: a small JPEG with something in it (${pic?.length ?? 'none'} chars)`);
  const cam = await page.evaluate(() => window.__editor.doc.metadata.thumbnailCamera);
  check(cam?.position?.length === 3 && cam?.target?.length === 3, `and records the camera it was taken from (${JSON.stringify(cam)})`);
  await page.waitForFunction(() => document.querySelector('.ed-map-thumbs .pic img')?.naturalWidth > 0, null, { timeout: T(10000) }).catch(() => {});
  check(await thumbLoaded(page, '.ed-map-thumbs .pic img'), 'Map properties shows the new picture beside the plan');
  check(!(await page.$('#ed-thumb-frame')) && !(await page.$('#editor input[type=file][accept*="image"]')), 'the guide closes; there is no image upload anywhere');
  await page.click('#ed-thumb-clear');
  check((await doc()).metadata.thumbnail === undefined, 'Clear removes it');
  await page.keyboard.press('Control+KeyZ');
  check((await doc()).metadata.thumbnail === pic, 'undo brings it back');
  // It is kept with the map (the draft store saves the whole document, as Save and Export do).
  const kept = await page.waitForFunction((p) => (localStorage.getItem('cs.editor.drafts') ?? '').includes(p.slice(0, 200)), pic ?? '-', { timeout: T(10000) }).then(() => true, () => false);
  check(kept, 'the picture is saved with the map');
  // Map properties → Bots → Bot characters: tick Soldiers, the map keeps it (one undo step).
  await page.keyboard.press('Escape');
  await page.waitForSelector('#ed-cast', { state: 'attached', timeout: T(10000) });
  await page.evaluate(() => (document.getElementById('ed-cast').open = true));
  await page.click('#ed-cast input[data-cast="soldiers"]');
  await page.waitForFunction(() => document.getElementById('ed-cast-sum')?.textContent === 'Soldiers', null, { timeout: T(5000) }).catch(() => {});
  const cast = { doc: (await doc()).botCast, sum: await page.evaluate(() => document.getElementById('ed-cast-sum')?.textContent), ticked: await page.evaluate(() => document.querySelector('#ed-cast input[data-cast="soldiers"]')?.checked) };
  check(JSON.stringify(cast.doc) === '["soldiers"]' && cast.sum === 'Soldiers' && cast.ticked, `map properties set the bot characters (${JSON.stringify(cast)})`);
  await page.keyboard.press('Control+KeyZ');
  check((await doc()).botCast === undefined, 'undo takes the bot characters back off');
  // Quit without saving goes to the menu and drops the draft; MapMaker from the menu starts blank again.
  await page.click('#ed-home');
  await page.click('#ed-quit-discard');
  await page.waitForFunction(() => document.getElementById('editor').hidden && !document.getElementById('menu').hidden, null, { timeout: T(10000) });
  check(!(await page.evaluate((id) => (localStorage.getItem('cs.editor.drafts') ?? '').includes(id), id)), 'Quit without saving returns to the menu and drops the draft');
  await page.click('#nav-mapmaker');
  await page.waitForFunction(() => !document.getElementById('editor').hidden, null, { timeout: T(15000) });
  d = await doc();
  check(d.metadata.id !== id && d.classicStructure.tiles.length === 1, 're-entering MapMaker from the menu starts on the blank starter');
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  // Close it, or its render loop keeps eating CPU through the later flows.
  await page.context().close();
  await dropRouteChecks(browser);
  await ziplineChecks(browser);
}

/**
 * A dropship drop route from the Paths group, drawn in and out of the map's bounds; in TEST you start aboard,
 * a jump while it is still off the map is refused with a hint, over the map it goes, and you land in the map.
 */
/**
 * A Zipline placed in MapMaker: the palette puts its start post down, "Place ends on the map" puts its far
 * end where you click, and in TEST play E under the start grabs it, you ride it (trolley overhead), and
 * it drops you off on the ground at the far end.
 */
async function ziplineChecks(browser) {
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 820 } })).newPage();
  livePages.add(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  await page.goto(`${CLIENT}/?mode=editor&test=1`);
  await page.waitForFunction(() => window.__editor, null, { timeout: T(30000) });
  page.once('dialog', (d) => d.accept());
  await newMap(page, 96);
  await page.evaluate(() => window.__editor.view.focus({ x: 0, y: 0, z: 8 }));
  const doc = () => page.evaluate(() => window.__editor.doc);
  const clickWorld = async (x, z) => {
    const p = await page.evaluate(([x, z]) => window.__editor.view.project({ x, y: 0, z }), [x, z]);
    await page.mouse.move(p.x, p.y);
    await page.mouse.click(p.x, p.y);
  };
  await clickTool(page, '[data-tool="scenario:zipline"]');
  await clickWorld(0, 0);
  await page.keyboard.press('Escape');
  let zip = (await doc()).entities.find((e) => e.kind === 'zipline');
  check(!!zip && Math.hypot(zip.end[0], zip.end[2]) > 10, `the Zipline palette entry places a zipline with a far end (${JSON.stringify(zip && { at: zip.position, end: zip.end })})`);
  await page.evaluate((id) => window.__editor.setSelection({ tiles: [], entities: [id] }), zip?.id);
  await page.waitForSelector('#ed-zip-ends', { timeout: T(10000) });
  // Place ends on the map: a click on the ground puts the far end there, and the start drags out of the starter room
  // at the origin (the route tool's own pointer calls, as in dropRouteChecks).
  await page.click('#ed-zip-ends');
  await page.evaluate(([x, z]) => {
    const r = window.__editor.routes;
    r.pointerDown({ x: 26, y: 0, z: 12 }, false);
    r.pointerDown({ x, y: 0, z }, false);
    r.pointerMove({ x: 24, y: 0, z: -12 });
    r.pointerUp();
  }, [zip.position[0], zip.position[2]]);
  await page.keyboard.press('Escape');
  zip = (await doc()).entities.find((e) => e.kind === 'zipline');
  const far = zip && [zip.position[0] + zip.end[0], zip.position[1] + zip.end[1], zip.position[2] + zip.end[2]];
  check(!!far && Math.hypot(far[0] - 26, far[2] - 12) < 0.05 && Math.abs(far[1]) < 0.05 && Math.hypot(zip.position[0] - 24, zip.position[2] + 12) < 0.05, `"Place ends on the map" puts the far end where you click and drags the start (${JSON.stringify(zip && { at: zip.position, far })})`);
  // (The level checks run a moment after each change: a line through the starter room is flagged until they catch up.)
  const valid = await page.waitForFunction(() => !/zipline/i.test(document.getElementById('ed-issues')?.textContent ?? ''), null, { timeout: T(20000) }).then(() => true, () => false);
  const issues = await page.textContent('#ed-issues');
  check(valid, `the zipline validates (${(issues ?? '').slice(0, 200)})`);

  await page.keyboard.press('F5');
  await page.waitForFunction(() => window.__cs?.local && window.__testStartMs, null, { timeout: T(20000) });
  await holdBots(page);
  // Stand under the start post, facing along the line, and press E (one tick).
  const start = { x: zip.position[0] + 0.2, y: zip.position[1], z: zip.position[2] + 1.5 };
  await sim(page, (m, me, p) => {
    me.move = { pos: { ...p }, velY: 0, grounded: true };
  }, start);
  await page.evaluate(() => (window.__autoInput = { buttons: 0 }));
  const prompt = await page.waitForFunction(() => /Grab the zipline/.test(document.getElementById('prompt')?.textContent ?? ''), null, { timeout: T(10000) }).then(() => true, () => false);
  check(prompt, 'under the cable the prompt offers "Grab the zipline"');
  // Press E (again, if a slow frame swallowed the press) until riding; never again once riding (that lets go).
  let grabbed = false;
  for (let i = 0; i < 4 && !grabbed; i++) {
    if (await sim(page, (m, me) => me.move.zip !== undefined).catch(() => false)) break;
    await page.evaluate(() => (window.__autoInput = { buttons: 0, once: 16 }));
    grabbed = await simWait(page, (m, me) => me.move.zip !== undefined, null, T(6000));
  }
  const trolley = grabbed && (await page.waitForFunction(() => window.__cs.view.localTrolley?.isEnabled() || [...window.__cs.view.avatars.values()].some((a) => a.trolley?.isEnabled()), null, { timeout: T(10000) }).then(() => true, () => false));
  check(grabbed && trolley, `E under the start grabs the zipline, a trolley overhead (grabbed ${grabbed}, trolley ${trolley})`);
  const arrived = await meWait(page, (m, me, end) => me.move.zip === undefined && me.move.grounded && Math.hypot(me.move.pos.x - end.x, me.move.pos.z - end.z) < 2.5, { x: 26, z: 12 }, 12, T(90000));
  const at = await sim(page, (m, me) => ({ x: +me.move.pos.x.toFixed(1), y: +me.move.pos.y.toFixed(1), z: +me.move.pos.z.toFixed(1), zip: me.move.zip ?? null, health: me.health })).catch((e) => String(e));
  check(arrived, `the ride ends at the far post, dropping you onto the ground (${JSON.stringify(at)})`);
  await page.evaluate(() => delete window.__autoInput);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  livePages.delete(page);
  await page.context().close();
}

async function dropRouteChecks(browser) {
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 820 } })).newPage();
  livePages.add(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  await page.goto(`${CLIENT}/?mode=editor&test=1`);
  await page.waitForFunction(() => window.__editor, null, { timeout: T(30000) });
  page.once('dialog', (d) => d.accept());
  // Open ground 96 m across (x and z -48..48): the play area riders may come down on.
  await newMap(page, 96);
  await page.evaluate(() => window.__editor.view.focus({ x: 0, y: 0, z: 0 }));
  const doc = () => page.evaluate(() => window.__editor.doc);
  const clickWorld = async (x, z) => {
    const p = await page.evaluate(([x, z]) => window.__editor.view.project({ x, y: 0, z }), [x, z]);
    await page.mouse.move(p.x, p.y);
    await page.mouse.click(p.x, p.y);
  };
  await clickTool(page, '[data-tool="path-drop-dropship"]');
  await clickWorld(0, 0);
  await page.keyboard.press('Escape');
  let plane = (await doc()).entities.find((e) => e.kind === 'airplane');
  check(plane?.craft === 'dropship' && plane.route.some(([x]) => Math.abs(x) > 60), `Paths → Dropship Drop Route places a dropship whose route runs in from off the map (${JSON.stringify(plane && { craft: plane.craft, route: plane.route })})`);
  // Select it: the inspector offers the aircraft and the air drop.
  await page.evaluate((id) => window.__editor.setSelection({ tiles: [], entities: [id] }), plane?.id);
  const craftSel = await page.waitForFunction(() => [...document.querySelectorAll('#editor select')].some((s) => [...s.options].some((o) => o.value === 'dropship')), null, { timeout: T(10000) }).then(() => true, () => false);
  check(craftSel, 'the inspector has an Aircraft choice (plane or dropship)');
  await page.evaluate(() => {
    const drop = [...document.querySelectorAll('#editor select')].find((s) => [...s.options].some((o) => o.value === 'start'));
    drop.value = 'start';
    drop.dispatchEvent(new Event('change'));
  });
  await page.waitForFunction(() => window.__editor.doc.entities.some((e) => e.kind === 'airplane' && e.airdrop === 'start'), null, { timeout: T(10000) }).catch(() => {});
  // Draw route: a point far outside the map's edge is fine (riders only jump over the map).
  await page.click('#ed-draw-route');
  // (The route tool's own click, at a ground point past the boundary: a headless pointer can't reach that far.)
  await page.evaluate(() => window.__editor.routes.pointerDown({ x: 62, y: 0, z: 22 }, false));
  await page.keyboard.press('Escape');
  plane = (await doc()).entities.find((e) => e.kind === 'airplane');
  check(plane?.airdrop === 'start' && plane.route.length === 4 && plane.route[3][0] > 55, `the route tool adds a point outside the boundary (${JSON.stringify(plane && { airdrop: plane.airdrop, route: plane.route })})`);
  const issues = await page.textContent('#ed-issues');
  check(!/airplane|outside the map's boundary/i.test(issues ?? ''), `no warning for flying outside the boundary (${(issues ?? '').slice(0, 200)})`);

  await page.keyboard.press('F5');
  await page.waitForFunction(() => window.__cs?.local && window.__testStartMs, null, { timeout: T(20000) });
  const aboard = await simWait(page, (m, me) => !!me.mount && m.mounts[me.mount.index].def.id === 'dropship_drop', null, T(20000));
  const plan = await sim(page, (m) => {
    const c = m.mounts.find((x) => x.route);
    const p = m.dropPlanFor(c);
    return { x: Math.round(c.pos.x), ok: p.ok.map((v) => (v ? '#' : '.')).join('') };
  }).catch((e) => String(e));
  // TEST's bots hold their fire (they would shoot you under the canopy).
  await holdBots(page);
  check(aboard, `TEST starts you aboard the dropship (${JSON.stringify(plan)})`);
  // Still off the map's west edge: a jump is refused, with a hint.
  const offMap = await sim(page, (m, me) => m.mounts[me.mount.index].pos.x < -60).catch(() => false);
  // Jump held (headless pages have no pointer lock: the automation hook sends the buttons; 1 = jump).
  await page.evaluate(() => (window.__autoInput = { buttons: 1 }));
  const hinted = await page.waitForFunction(() => /drop zone/.test(document.getElementById('message')?.textContent ?? ''), null, { timeout: T(15000) }).then(() => true, () => false);
  await page.evaluate(() => (window.__autoInput = { buttons: 0 }));
  const stillAboard = await sim(page, (m, me) => !!me.mount).catch(() => false);
  check(offMap && hinted && stillAboard, `a jump off the map is refused with a hint (off the map ${offMap}, hint ${hinted}, still aboard ${stillAboard})`);
  // Over the map: jump.
  const over = await simWait(page, (m, me) => !me.mount || m.mounts[me.mount.index].pos.x > -30, null, T(60000));
  await page.evaluate(() => (window.__autoInput = { buttons: 1 }));
  const out = await simWait(page, (m, me) => !me.mount, null, T(15000));
  await page.evaluate(() => (window.__autoInput = { buttons: 0 }));
  const after = await sim(page, (m, me) => ({ mount: me.mount ?? null, y: Math.round(me.move.pos.y), craft: Math.round(m.mounts.find((x) => x.route).pos.x) })).catch((e) => String(e));
  check(over && out, `over the map the jump goes (over ${over}, out ${out}, ${JSON.stringify(after)})`);
  const landed = await meWait(page, (m, me) => (me.move.chute ? false : me.alive && me.move.grounded), null, 40, T(120000));
  const unhurt = await sim(page, (m, me) => me.deaths === 0).catch(() => false);
  const at = await sim(page, (m, me) => ({ x: Math.round(me.move.pos.x), z: Math.round(me.move.pos.z), alive: me.alive, deaths: me.deaths, health: me.health })).catch(() => null);
  check(landed && unhurt && at && Math.abs(at.x) < 48 && Math.abs(at.z) < 48, `you parachute down and land in the map, alive (${JSON.stringify(at)})`);
  await page.evaluate(() => delete window.__autoInput);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  livePages.delete(page);
  await page.context().close();
}

/** MapMaker tool bar, Erase tool, level strip and NPC palette. Screenshots go to E2E_SHOTS when set. */
async function editoruxFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 820 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  const shot = (name) => (process.env.E2E_SHOTS ? page.screenshot({ path: `${process.env.E2E_SHOTS}/editorux-${name}.png` }).catch(() => {}) : Promise.resolve());
  await page.goto(`${CLIENT}/?mode=editor&test=1`);
  await page.waitForFunction(() => window.__editor, null, { timeout: T(60000) });
  page.once('dialog', (d) => d.accept());
  await newMap(page);
  await page.evaluate(() => window.__editor.view.focus({ x: 6, y: 0, z: 0 }));
  const doc = () => page.evaluate(() => window.__editor.doc);
  const at = (x, y, z) => page.evaluate(([x, y, z]) => window.__editor.view.project({ x, y, z }), [x, y, z]);
  const clickAt = async (x, y, z) => {
    const p = await at(x, y, z);
    await page.mouse.move(p.x, p.y);
    await page.mouse.click(p.x, p.y);
  };
  // Let the editor catch up on a frame (panels and hover refresh per frame).
  const settle = () => frames(page, 3);

  check(await page.isVisible('#ed-toolbar #ed-tb-erase') && (await page.textContent('#ed-tb-erase')).includes('X'), 'tool bar shows Erase with its key');
  check((await page.getAttribute('#ed-tb-select', 'class')).includes('active') && (await page.textContent('#ed-toolhint')).includes('Select'), 'Select is the lit tool and the hint says what it does');

  check(parseFloat(await page.evaluate(() => getComputedStyle(document.getElementById('ed-palette')).width)) >= 300, 'the palette is wide (300 px or more)');
  // Palette pictures come from the prebuilt atlases, one image per content source (a Style Pack's tiles, a content
  // pack's props), loaded as their pieces are shown.
  await page.waitForFunction(() => document.querySelector('#ed-tiles .thumb.atlas .spr'), null, { timeout: T(30000) }).catch(() => {});
  const tilePics = await page.evaluate(() => ({
    bg: getComputedStyle(document.querySelector('#ed-tiles .thumb.atlas .spr') ?? document.body).backgroundImage,
    loaded: [...window.__editor.paletteAtlas.loaded],
    rendered: window.__editor.thumbs.rendered,
  }));
  check(/\/thumbs\/tiles-[a-z]+\.[0-9a-f]+\.webp/.test(tilePics.bg), `tile cards show pictures from a tiles atlas (${tilePics.bg.slice(0, 80)})`);
  check(!tilePics.loaded.includes('props-lowpolyassets-wild-west') && !tilePics.loaded.includes('props-quaternius-modular-scifi-megakit') && tilePics.rendered === 0, `only the shown groups' atlases load, nothing is rendered at runtime (${tilePics.loaded.join(', ')}; ${tilePics.rendered} rendered)`);
  // A piece the atlas lacks (new or user content) falls back to the runtime renderer.
  await page.evaluate(async () => {
    const m = await window.__editor.paletteAtlas.manifest;
    delete m.items['prop:prop.barrel'];
  });
  await clickTool(page, '[data-tool="prop:prop.crate_small"]');
  await page.waitForFunction(() => document.querySelector('[data-tool="prop:prop.barrel"] .thumb img')?.src.startsWith('data:image/png'), null, { timeout: T(30000) }).catch(() => {});
  const propPics = await page.evaluate(() => ({ barrel: !!document.querySelector('[data-tool="prop:prop.barrel"] .thumb img')?.src.startsWith('data:image/png'), crate: document.querySelector('[data-tool="prop:prop.crate_small"] .thumb')?.dataset.atlas, loaded: [...window.__editor.paletteAtlas.loaded] }));
  check(propPics.barrel && propPics.crate === 'props-kenney-survival-kit', `a prop missing from the atlas is rendered at runtime, the rest come from its pack's atlas (${JSON.stringify(propPics)})`);
  check(!propPics.loaded.includes('props-lowpolyassets-wild-west'), 'closed prop groups load nothing');

  // Search: fuzzy over names, tags and packs, ranked across every tab; Enter picks the best match.
  await page.fill('#ed-search', 'sandbg');
  await page.waitForFunction(() => !!document.querySelector('#ed-pal-results [data-pick="prop:prop.sandbag_wall"]'), null, { timeout: T(5000) }).catch(() => {});
  const found = await page.evaluate(() => ({
    first: document.querySelector('#ed-pal-results [data-pick]')?.dataset.pick,
    picks: [...document.querySelectorAll('#ed-pal-results [data-pick]')].map((b) => b.dataset.pick),
    panes: [...document.querySelectorAll('#ed-palette .ed-pane')].filter((p) => p.offsetParent !== null).length,
  }));
  check(found.picks.includes('prop:prop.sandbag_wall') && found.panes === 0, `search with a typo finds the sandbag wall and shows only results (${found.picks.slice(0, 4).join(', ')})`);
  await page.fill('#ed-search', 'kenney barrel');
  await page.waitForFunction(() => !!document.querySelector('#ed-pal-results [data-pick="prop:prop.barrel"]'), null, { timeout: T(5000) }).catch(() => {});
  check((await page.$$eval('#ed-pal-results [data-pick]', (b) => b.map((x) => x.dataset.pick))).includes('prop:prop.barrel'), 'search matches the pack a prop comes from');
  await page.fill('#ed-search', 'jump pad');
  await page.press('#ed-search', 'Enter');
  check(await page.evaluate(() => window.__editor.tool.kind === 'scenario' && window.__editor.tool.key === 'pad'), 'Enter in the search box picks the best match');
  await page.fill('#ed-search', 'pad');
  await page.press('#ed-search', 'ArrowDown');
  const focused = await page.evaluate(() => document.activeElement?.dataset.pick);
  await page.keyboard.press('ArrowRight');
  const moved = await page.evaluate(() => document.activeElement?.dataset.pick);
  const firstPick = await page.evaluate(() => document.querySelector('#ed-pal-results [data-pick]')?.dataset.pick);
  check(focused && focused === firstPick && moved && moved !== focused, `arrow keys move from the search box through the results (${focused} → ${moved})`);
  await page.keyboard.press('KeyF');
  check(await page.evaluate((k) => JSON.parse(localStorage.getItem('tt.palette.favs') ?? '[]').includes(k), moved), 'F adds the focused piece to the favourites');
  await page.focus('#ed-search');
  await page.press('#ed-search', 'Escape');
  check(await page.evaluate(() => document.getElementById('ed-pal-results').hidden && !!document.querySelector('#ed-pal-quick .ed-quick-row [data-pick]')), 'Escape clears the search; the favourite is in the quick row');
  // Hover card names the piece under the pointer (the grid view shows pictures only).
  await page.evaluate(() => document.querySelector('[data-tool="scenario:pad"]').scrollIntoView({ block: 'center' }));
  await frames(page, 2);
  await page.hover('[data-tool="scenario:pad"]');
  const tip = await page.evaluate(() => ({ text: document.getElementById('ed-pal-tip')?.textContent ?? '', shown: !document.getElementById('ed-pal-tip')?.hidden }));
  check(tip.text.includes('Jump Pad') && tip.shown, `hovering a piece shows its name (${JSON.stringify(tip)})`);
  // Fits at 1280×720 without sideways scrolling.
  await page.setViewportSize({ width: 1280, height: 720 });
  await frames(page, 3);
  const fit = await page.evaluate(() => {
    const p = document.getElementById('ed-palette');
    const tabs = [...document.querySelectorAll('#ed-pal-tabs .tab:not([hidden])')];
    return { over: p.scrollWidth - p.clientWidth, doc: document.documentElement.scrollWidth - innerWidth, clipped: tabs.filter((t) => t.scrollWidth > t.clientWidth + 1).length };
  });
  check(fit.over <= 0 && fit.doc <= 0 && fit.clipped === 0, `the palette fits at 1280×720 with no sideways scroll or clipped tabs (${JSON.stringify(fit)})`);
  await shot('palette-1280');
  await page.setViewportSize({ width: 1400, height: 820 });
  await page.evaluate(() => document.activeElement?.blur());
  // Build: a corridor east, a barrel on it, a pickup and a squad from the NPCs tab.
  await clickTool(page, '[data-tool="tile:core.corridor"]');
  await page.click('#ed-tb-rotate');
  check(await page.evaluate(() => window.__editor.rotation === 1), 'toolbar Rotate turns the piece being placed');
  await page.click('#ed-tb-rotate');
  await page.click('#ed-tb-rotate');
  await page.click('#ed-tb-rotate');
  await clickAt(8, 0, 0);
  await clickAt(16, 0, 0);
  check((await page.getAttribute('#ed-tb-place', 'class')).includes('active') && (await page.textContent('#ed-tb-place')).includes('Corridor'), 'Place is lit and names the piece');
  // A barrel on the second corridor's floor. Placed by command: the prop tool lands a prop on the corridor's roof
  // under the pointer, and before the corridor is there, over nothing, it is refused (ghostWhy.ts).
  await page.evaluate(() => window.__editor.history.execute('Place Barrel', { kind: 'addEntities', entities: [{ id: 'prop_e2e_barrel', kind: 'prop', position: [16, 0, 0], model: 'prop.barrel', yaw: 0, scale: 1, solid: true, tint: null }] }));
  await clickTool(page, '[data-tool="pickup:core.health_small"]');
  await clickAt(-2, 0, -2);
  await clickTool(page, '[data-tool="npc:squad"]');
  await clickAt(1, 0, 2);
  let d = await doc();
  const squad = d.entities.find((e) => e.kind === 'encounter');
  check(squad && squad.roster.trooper === 2 && squad.roster.gunner === 1 && (await page.evaluate(() => window.__editor.selection.entities[0])) === squad.id, 'NPCs tab places a squad and selects it');
  await settle();
  check((await page.textContent('#ed-inspector')).includes('Troopers'), 'the squad opens in the inspector');
  await clickTool(page, '[data-tool="npc:heavy"]');
  await clickAt(-2, 0, 2.5);
  d = await doc();
  check(d.entities.some((e) => e.kind === 'encounter' && e.roster.heavy === 1 && e.activeCap === 1), 'places a lone Heavy');
  // Objects and NPCs preview where they'd go, see-through, before you click (a door snaps into the doorway).
  const objectGhost = () =>
    page.evaluate(() => {
      const n = window.__editor.view.scene.getNodeByName('ed_ghost0');
      const parts = n?.getChildMeshes() ?? [];
      return n ? { on: n.isEnabled(), x: n.position.x, z: n.position.z, faded: parts.length > 0 && parts.every((m) => m.visibility < 1 && !m.isPickable) } : null;
    });
  const hoverWith = async (tool, x, z) => {
    await clickTool(page, tool);
    const p = await at(x, 0, z);
    await page.mouse.move(p.x, p.y);
    await settle();
    return objectGhost();
  };
  const doorGhost = await hoverWith('[data-tool="scenario:door"]', 4, 1);
  check(doorGhost?.on && doorGhost.faded && Math.hypot(doorGhost.x - 4, doorGhost.z - 1) < 3, `the Door tool previews a see-through door at the pointer (${JSON.stringify(doorGhost)})`);
  const squadGhost = await hoverWith('[data-tool="npc:squad"]', -3, 4);
  check(squadGhost?.on && squadGhost.faded && Math.hypot(squadGhost.x + 3, squadGhost.z - 4) < 1, `an NPC tool previews its squad marker at the pointer (${JSON.stringify(squadGhost)})`);
  await page.evaluate(() => window.__editor.setTool({ kind: 'select' }));
  await settle();
  const leftOn = await page.evaluate(() => ['ed_ghost0', 'propGhost', 'mountGhost', 'pickupGhost', 'spawn_ghost'].filter((n) => window.__editor.view.scene.getNodeByName(n)?.isEnabled()));
  check(leftOn.length === 0, `previews go away with Select (${leftOn.join(', ')})`);
  await clickTool(page, '[data-tool="npc:militia"]');
  await clickAt(9, 0, 1);
  d = await doc();
  check(d.factions.some((f) => f.id === 'militia') && d.entities.some((e) => e.kind === 'encounter' && e.faction === 'militia' && e.order === 'follow'), 'Allied Militia adds a friendly faction and a following squad');
  await page.keyboard.press('Control+KeyZ');
  d = await doc();
  check(!d.factions.some((f) => f.id === 'militia') && !d.entities.some((e) => e.kind === 'encounter' && e.faction === 'militia'), 'one undo takes the militia and its faction back');
  await page.click('#ed-entities-btn');
  check(await page.isVisible('#ed-pal-tabs [data-pane="npcs"]') && !(await page.isVisible('#ed-pal-tabs [data-pane="tiles"]')), 'the Entities workspace swaps the palette sub-tabs');
  await page.click('#ed-pal-tabs [data-pane="entities"]');
  check(await page.isVisible('[data-tool="scenario:flag"]') && await page.isVisible('[data-tool="spawn"]'), 'Gameplay holds spawns, pickups and the game-mode objects');
  await page.click('#ed-pal-tabs [data-pane="npcs"]');
  await shot('npcs');

  // Erase tool: click the barrel, the pickup and a tile.
  await page.keyboard.press('Escape');
  await page.click('#ed-tb-erase');
  check((await page.getAttribute('#ed-tb-erase', 'class')).includes('active') && (await page.textContent('#ed-toolhint')).includes('Erase'), 'Erase lights up with its hint');
  const barrel = await at(16, 0.6, 0);
  await page.mouse.move(barrel.x, barrel.y);
  await settle();
  check((await page.textContent('#ed-target')).includes('Barrel'), `hovering the barrel marks it for erasing (${await page.textContent('#ed-target')})`);
  await shot('erase-hover');
  await page.mouse.click(barrel.x, barrel.y);
  d = await doc();
  check(!d.entities.some((e) => e.kind === 'prop'), 'Erase deletes a prop by clicking it');
  await clickAt(-2, 0.4, -2);
  d = await doc();
  check(!d.entities.some((e) => e.kind === 'pickup'), 'Erase deletes a pickup');
  const tilesBefore = d.classicStructure.tiles.length;
  await clickAt(16, 0, 0);
  d = await doc();
  check(d.classicStructure.tiles.length === tilesBefore - 1 && !d.classicStructure.tiles.some((t) => t.x === 2), 'Erase deletes a tile');
  await page.keyboard.press('Control+KeyZ');
  d = await doc();
  check(d.classicStructure.tiles.some((t) => t.x === 2), 'undo brings the erased tile back in one step');

  // A placed prop keeps its look, deselected, once the preview moves on to another model (the preview
  // used to take the model's shared materials and textures down with it, leaving placed copies white).
  // On a Platform's floor (this map has no ground: over nothing a prop is refused).
  await page.evaluate(() => window.__editor.view.focus({ x: -14, y: 0, z: 10 }));
  await clickTool(page, '[data-tool="tile:core.platform"]');
  await clickAt(-16, 0, 8);
  await clickTool(page, '[data-tool="prop:prop.ww_barrel_a"]');
  await clickAt(-14, 0, 10);
  const placedBarrel = (await doc()).entities.find((e) => e.kind === 'prop' && e.model === 'prop.ww_barrel_a');
  await clickTool(page, '[data-tool="prop:prop.sf_barrel"]');
  const away = await at(-19, 0, 14);
  await page.mouse.move(away.x, away.y);
  await page.waitForFunction(() => window.__editor.view.propGhost?.model === 'prop.sf_barrel', null, { timeout: T(10000) }).catch(() => {});
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.mouse.move(10, 400);
  await page.waitForFunction((id) => {
    const s = window.__editor.view.scene;
    return !!s.getTransformNodeByName(`edprop_${id}`)?.getChildMeshes().length && s.isReady();
  }, placedBarrel?.id, { timeout: T(30000) }).catch(() => {});
  await settle();
  const barrelPx = await (async () => {
    const { PNG } = await import('pngjs');
    const png = PNG.sync.read(await page.screenshot());
    const c = await at(-14, 0.45, 10);
    const sum = [0, 0, 0];
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) {
      const i = (Math.round(c.y + dy) * png.width + Math.round(c.x + dx)) * 4;
      for (let k = 0; k < 3; k++) sum[k] += png.data[i + k];
    }
    return sum.map((v) => Math.round(v / 25));
  })();
  check(placedBarrel && (await page.evaluate(() => window.__editor.selection.entities.length)) === 0 && Math.max(...barrelPx) < 190, `a placed textured prop draws in its colours, not white, deselected after the preview changed model (rgb ${barrelPx.join(',')})`);
  await page.keyboard.press('Control+KeyZ');
  await page.keyboard.press('Control+KeyZ');
  await page.evaluate(() => window.__editor.view.focus({ x: 6, y: 0, z: 0 }));

  // Select + Delete, and Rotate from the tool bar.
  await page.click('#ed-tb-select');
  await clickAt(1, 0, 2);
  check((await page.evaluate(() => window.__editor.selection.entities[0])) === squad.id, 'Select picks the squad');
  await page.keyboard.press('Delete');
  d = await doc();
  check(!d.entities.some((e) => e.id === squad.id), 'Delete removes the selection');
  await page.keyboard.press('Control+KeyZ');
  await clickAt(16, 0, 0);
  const sel = await page.evaluate(() => window.__editor.selection.tiles[0]);
  const rot = (await doc()).classicStructure.tiles.find((t) => t.id === sel)?.rotation;
  await page.click('#ed-tb-rotate');
  d = await doc();
  check(sel && d.classicStructure.tiles.find((t) => t.id === sel).rotation === (rot + 1) % 4, 'toolbar Rotate turns the selected tile');
  await page.click('#ed-tb-delete');
  d = await doc();
  check(!d.classicStructure.tiles.some((t) => t.id === sel), 'toolbar Delete removes the selection');
  await page.keyboard.press('Control+KeyZ');

  // Dress room as…: the start room furnished as an office, re-rolled, undone in one step each.
  await clickAt(2.6, 0, -2.6);
  await settle();
  check(await page.isVisible('#ed-dress') && (await page.textContent('#ed-inspector')).includes('Dress room'), 'the room inspector offers Dress room');
  await page.selectOption('#ed-dress-type', 'office');
  await page.click('#ed-dress');
  const dressed = async () => (await doc()).entities.filter((e) => e.kind === 'prop' && e.id.startsWith('dr_'));
  const first = await dressed();
  check(first.length >= 3 && first.some((e) => /^prop\.(hh_)?desk$/.test(e.model)), `Dress room furnishes it as an office (${first.length} props)`);
  await settle();
  await page.click('#ed-dress-reroll');
  const second = await dressed();
  check(second.length >= 3 && JSON.stringify(second.map((e) => e.position)) !== JSON.stringify(first.map((e) => e.position)), 'Re-roll replaces the dressing with another arrangement');
  await page.keyboard.press('Control+KeyZ');
  check(JSON.stringify((await dressed()).map((e) => e.position)) === JSON.stringify(first.map((e) => e.position)), 'one undo brings the first dressing back');
  await page.keyboard.press('Control+KeyZ');
  check((await dressed()).length === 0, 'and another takes it away');
  await page.keyboard.press('Escape');

  // Levels: up with the strip, build there, the toast and the ghosted ground floor; erase stays on its level.
  await page.click('#ed-level-up');
  await settle();
  check((await page.evaluate(() => window.__editor.level)) === 1 && (await page.textContent('#ed-level')) === 'Level 1', 'level strip goes up to Level 1');
  check((await page.textContent('#ed-toast')).includes('Level 1'), 'a toast says which level is being edited');
  await clickTool(page, '[data-tool="tile:core.room"]');
  await clickAt(0, 4, 0);
  d = await doc();
  check(d.classicStructure.tiles.some((t) => t.z === 1), 'places a room on Level 1');
  check(await page.evaluate(() => window.__editor.view.scene.meshes.some((m) => m.name.startsWith('edmapdim') && m.visibility < 1)), 'other levels are drawn ghosted');
  await page.click('#ed-tb-erase');
  const n = d.classicStructure.tiles.length;
  await clickAt(8, 4, 0);
  check((await doc()).classicStructure.tiles.length === n, 'erasing over an empty cell on Level 1 leaves the ground floor alone');
  await page.mouse.move(10, 400);
  await shot('level1');
  await page.click('#ed-level-list [data-level="0"]');
  check((await page.evaluate(() => window.__editor.level)) === 0 && (await page.textContent('#ed-level')) === 'Ground', 'clicking Ground in the strip goes back down');
  await page.keyboard.press('PageUp');
  check((await page.evaluate(() => window.__editor.level)) === 1, 'Page Up still changes level');
  await page.keyboard.press('PageDown');

  // The build area (owner, 2026-11-05): the grid stays local, round where the camera looks; the build limit and the
  // playable boundary always show, with the scenery zone outside the boundary; a room there places; one past the
  // build limit is refused, saying so; top bar Full grid covers the whole build area.
  const area = () => page.evaluate(() => {
    const s = window.__editor.view.scene;
    const on = (n) => s.meshes.some((m) => m.name === n && m.isEnabled());
    const g = s.meshes.find((m) => m.name === 'grid');
    g?.refreshBoundingInfo();
    return { reach: Math.round(g?.getBoundingInfo().boundingBox.extendSizeWorld.x ?? 0), gridOn: !!g?.isEnabled(), limit: on('buildLimit'), bounds: on('bounds'), band: on('sceneryBand') };
  });
  await settle();
  const a0 = await area();
  check(a0.gridOn && a0.limit && a0.reach > 40 && a0.reach < 400, `a local grid and the build limit are drawn (${JSON.stringify(a0)})`);
  const boundsBefore = await page.evaluate(() => window.__editor.doc.bounds);
  await page.evaluate((before) => window.__editor.run('Boundary', { kind: 'setBounds', before, after: { min: [-40, -40], max: [40, 40], style: 'invisible', height: 8 } }), boundsBefore);
  await settle();
  const a1 = await area();
  check(a1.bounds && a1.band && a1.limit, `with a boundary: its outline and the scenery zone outside it (${JSON.stringify(a1)})`);
  const placeAt = async (x, z) => {
    await page.evaluate(([x, z]) => window.__editor.view.focus({ x, y: 0, z }), [x, z]);
    await page.waitForFunction(([x, z]) => {
      const p = window.__editor.view.project({ x, y: 0, z });
      return Math.abs(p.x - innerWidth / 2) < innerWidth / 4 && Math.abs(p.y - innerHeight / 2) < innerHeight / 4;
    }, [x, z], { timeout: T(10000) }).catch(() => {});
    const p = await at(x, 0, z);
    await page.mouse.move(p.x, p.y);
    await settle();
    const target = await page.textContent('#ed-target');
    await page.mouse.click(p.x, p.y);
    await settle();
    return target;
  };
  await clickTool(page, '[data-tool="tile:core.room"]');
  const areaTiles = (await doc()).classicStructure.tiles.length;
  const sceneryNote = await placeAt(64, -64);
  check((await doc()).classicStructure.tiles.some((t) => t.x === 8 && t.y === -8), 'a room in the scenery zone (outside the boundary) places');
  check(/Scenery zone/.test(sceneryNote ?? ''), `hovering there says it is the scenery zone (${sceneryNote})`);
  const beyondNote = await placeAt(2072, 0);
  const limitRefusal = (await page.textContent('#ed-toast')) ?? '';
  check((await doc()).classicStructure.tiles.length === areaTiles + 1 && /build limit/.test(limitRefusal), `a room past the build limit is refused, naming it (${limitRefusal})`);
  check(/Past the build limit/.test(beyondNote ?? ''), `hovering past it says so (${beyondNote})`);
  await page.click('#ed-grid-full');
  await settle();
  const a2 = await area();
  check(a2.gridOn && a2.reach > 2000 && (await page.getAttribute('#ed-grid-full', 'aria-pressed')) === 'true', `Full grid covers the whole build area (${JSON.stringify(a2)})`);
  await page.click('#ed-grid-full');
  await settle();
  check((await area()).reach < 400, 'and off again it is local');
  await page.click('#ed-grid');
  await settle();
  const a3 = await area();
  check(!a3.gridOn && a3.limit && a3.bounds, `Grid off hides the grid, not the boundary or the build limit (${JSON.stringify(a3)})`);
  await page.click('#ed-grid');
  await page.keyboard.press('Control+KeyZ');
  await page.keyboard.press('Control+KeyZ');
  check((await doc()).classicStructure.tiles.length === areaTiles && JSON.stringify((await doc()).bounds) === JSON.stringify(boundsBefore), 'undo takes the room and the boundary back out');
  await page.keyboard.press('Escape');

  // A floor over a piece two levels tall (the owner's case, 2026-11-05): the Triumphal Arch holds its cell on Level 1
  // too, so a room there is refused, saying what to do; a Platform there becomes the arch's own floor, and the arch's
  // inspector ticks it on and off.
  await page.evaluate(() => window.__editor.view.focus({ x: -40, y: 0, z: -24 }));
  // The camera glides there: wait until the spot is on screen.
  await page.waitForFunction(() => {
    const p = window.__editor.view.project({ x: -40, y: 0, z: -24 });
    return Math.abs(p.x - innerWidth / 2) < innerWidth / 4 && Math.abs(p.y - innerHeight / 2) < innerHeight / 4;
  }, null, { timeout: T(10000) }).catch(() => {});
  // The hover cell follows the pointer once a frame: let it catch up before clicking.
  const clickCell = async (x, y, z) => {
    const p = await at(x, y, z);
    await page.mouse.move(p.x, p.y);
    await settle();
    await page.mouse.click(p.x, p.y);
    await settle();
  };
  await page.evaluate(() => window.__editor.setTool({ kind: 'tile', tile: 'imperial.triumphal_arch' }));
  await clickCell(-40, 0, -24);
  const archId = (await doc()).classicStructure.tiles.find((t) => t.tile === 'imperial.triumphal_arch' && t.x === -5 && t.y === -3)?.id;
  check(!!archId, 'places a Triumphal Arch');
  await page.click('#ed-level-up');
  await settle();
  await clickTool(page, '[data-tool="tile:core.room"]');
  await clickCell(-40, 4, -24);
  const refusal = (await page.textContent('#ed-toast')) ?? '';
  check(/Triumphal Arch/.test(refusal) && /place a Platform/.test(refusal) && /Floor on Level 1/.test(refusal), `a room over it on Level 1 is refused, saying how to put a floor in (${refusal})`);
  const platforms = (await doc()).classicStructure.tiles.filter((t) => t.tile === 'core.platform').length;
  await clickTool(page, '[data-tool="tile:core.platform"]');
  await clickCell(-40, 4, -24);
  d = await doc();
  check(JSON.stringify(d.classicStructure.tiles.find((t) => t.id === archId)?.upperFloors) === '["0,0,1"]' && d.classicStructure.tiles.filter((t) => t.tile === 'core.platform').length === platforms, 'a Platform there becomes the arch’s floor on Level 1');
  await page.mouse.move(10, 400);
  await shot('upper-floor');
  await page.evaluate((id) => window.__editor.setSelection({ tiles: [id], entities: [] }), archId);
  await settle();
  const tick = await page.evaluate(() => ({ box: document.querySelector('#ed-inspector .ed-upper-floor[data-level="1"]')?.checked ?? null, text: document.getElementById('ed-inspector').textContent }));
  check(tick.box === true && tick.text.includes('Floor on Level 1'), `the arch's inspector shows "Floor on Level 1" ticked (${tick.box})`);
  await page.click('#ed-inspector .ed-upper-floor[data-level="1"]');
  check(!(await doc()).classicStructure.tiles.find((t) => t.id === archId)?.upperFloors, 'unticking it takes the floor out');
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Control+KeyZ');
  check(JSON.stringify((await doc()).classicStructure.tiles.find((t) => t.id === archId)?.upperFloors) === '["0,0,1"]', 'and undo puts it back');
  await page.keyboard.press('Escape');
  await page.keyboard.press('PageDown');

  // Terrain: plants and rocks the Environment brush paints are bedded into the ground, a little below level 0; Erase must
  // still reach them. (The Scatter Brush sets are retired, owner 2026-11-09: none left in the palette.)
  await page.click('#ed-env-btn');
  check((await page.getAttribute('#ed-env-btn', 'class')).includes('on') && (await page.isVisible('#ed-pal-tabs [data-ws="environment"][data-pane="paint"]')), 'the Environment workspace shows its own sub-tabs');
  await page.click('#ed-pal-tabs [data-ws="environment"][data-pane="terrain"]');
  await page.click('#ed-tr-new');
  await page.evaluate(() => window.__editor.view.focus({ x: 30, y: 0, z: 30 }));
  check(!(await page.$('[data-tool^="scatter:"]')), 'the old Scatter Brush sets are gone from the palette');
  await clickTool(page, '[data-tool="envbrush"]');
  await page.selectOption('#ed-env-preset', 'alpine');
  await clickAt(30, 0, 30);
  d = await doc();
  const rocks = d.entities.filter((e) => e.kind === 'prop');
  const rock = rocks.sort((a, b) => Math.hypot(a.position[0] - 30, a.position[2] - 30) - Math.hypot(b.position[0] - 30, b.position[2] - 30))[0];
  check(rock && rock.position[1] < 0, `scattered rocks sit just under level 0 (${rocks.length}, y ${rock?.position[1]})`);
  await page.click('#ed-tb-erase');
  const rp = await at(rock.position[0], rock.position[1] + 0.3, rock.position[2]);
  await page.mouse.move(rp.x, rp.y);
  // Rock models load in the background (slow software rendering): wait until the pointer has a target.
  await page.waitForFunction(() => /Erase:/.test(document.getElementById('ed-target')?.textContent ?? ''), null, { timeout: T(10000) }).catch(() => {});
  const target = await page.evaluate(() => window.__editor.pick());
  const aimed = rocks.find((e) => e.id === target?.id);
  await page.mouse.click(rp.x, rp.y);
  d = await doc();
  check(aimed && aimed.position[1] < 0 && !d.entities.some((e) => e.id === aimed.id) && d.entities.filter((e) => e.kind === 'prop').length === rocks.length - 1, `Erase deletes the rock under the pointer, standing on the terrain (${aimed?.position[1]})`);
  await page.mouse.move(700, 400);
  await shot('erase-terrain');
  // Paths: the handles sit on the road, light up under the pointer and drag; the line follows the ribbon's curve.
  await page.evaluate(() => window.__editor.view.focus({ x: 30, y: 0, z: 40 }));
  await settle();
  await page.evaluate(() => window.__editor.setTool({ kind: 'path' }));
  for (const [x, z] of [[26, 44], [34, 42], [32, 50]]) await clickAt(x, 0, z);
  const road = (await doc()).paths?.at(-1);
  check(road?.points.length === 3, `three clicks draw a path of three points (${road?.points.length})`);
  const handle = await page.evaluate(() => {
    const m = window.__editor.view.scene.getMeshByName('pathPt1');
    return m && { x: m.position.x, y: m.position.y, z: m.position.z, group: m.renderingGroupId };
  });
  check(handle && Math.hypot(handle.x - 34, handle.z - 42) < 0.01 && handle.y - road.points[1][1] < 1 && handle.group === 1, `a path's handle sits on the road over its point, drawn over the ground (${JSON.stringify(handle)})`);
  const hp = await at(handle.x, handle.y, handle.z);
  // A few pixels off the handle still grabs it.
  await page.mouse.move(hp.x + 6, hp.y - 5);
  await page.waitForFunction(() => window.__editor.paths.hovering === 'point', null, { timeout: T(5000) }).catch(() => {});
  check(await page.evaluate(() => window.__editor.paths.hovering === 'point' && /Drag to move/.test(document.getElementById('ed-target').textContent)), 'hovering near a handle lights it and says it drags');
  const to = await at(37, 0, 46);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
  const dragged = (await doc()).paths?.find((p) => p.id === road.id)?.points[1];
  check(dragged && Math.hypot(dragged[0] - 37, dragged[2] - 46) < 1, `dragging a handle moves its point (${JSON.stringify(dragged)})`);
  // Join the ends: with the last point selected, a click on the first point makes the path a loop.
  const clickHandle = async (i) => {
    const h = await page.evaluate((i) => {
      const m = window.__editor.view.scene.getMeshByName(`pathPt${i}`);
      return m && { x: m.position.x, y: m.position.y, z: m.position.z };
    }, i);
    const s = await at(h.x, h.y, h.z);
    await page.mouse.move(s.x, s.y);
    await page.waitForFunction(() => window.__editor.paths.hovering === 'point', null, { timeout: T(5000) }).catch(() => {});
    await page.mouse.click(s.x, s.y);
  };
  await clickHandle(2);
  await clickHandle(0);
  const joined = (await doc()).paths?.find((p) => p.id === road.id);
  check(joined?.closed === true && joined.points.length === 3, `clicking the first point with the last selected joins the ends (closed ${joined?.closed})`);
  check(await page.evaluate((id) => !!window.__editor.view.scene.getMeshByName(`pathArrows_${id}`), road.id), 'the path shows arrows the way it runs');
  await page.click('#ed-path-close');
  check((await doc()).paths?.find((p) => p.id === road.id)?.closed === false, 'the pane\'s Open button opens the loop again');
  const unreversed = (await doc()).paths.find((p) => p.id === road.id).points;
  await page.click('#ed-path-reverse');
  const reversed = (await doc()).paths.find((p) => p.id === road.id).points;
  check(JSON.stringify(reversed) === JSON.stringify([...unreversed].reverse()), 'Reverse direction runs the path the other way');
  await settle(); // the edit's new meshes draw from the next frame
  await shot('paths');
  // Paint from far out: the ground under the pointer, not the invisible wall round the map.
  await page.evaluate(() => window.__editor.setTool({ kind: 'paint' }));
  await page.evaluate(() => {
    window.__editor.view.focus({ x: 30, y: 0, z: 30 });
    window.__editor.view.dolly(-260);
  });
  await settle();
  const far = await at(30, 0, 30);
  await page.mouse.move(far.x, far.y);
  await page.waitForFunction(() => !!window.__editor.paintGround, null, { timeout: T(5000) }).catch(() => {});
  const farHover = await page.evaluate(() => ({ face: window.__editor.hoverFace?.box.kind ?? null, ground: !!window.__editor.paintGround, target: document.getElementById('ed-target').textContent }));
  check(farHover.ground && farHover.face === null && /^Ground/.test(farHover.target), `zoomed far out, Paint points at the ground (${JSON.stringify(farHover)})`);
  const ground0 = await page.evaluate(() => window.__editor.doc.terrain.materials.join(''));
  await page.mouse.click(far.x, far.y);
  check(await page.evaluate((g) => window.__editor.doc.terrain.materials.join('') !== g, ground0), 'a click with Paint from far out paints the ground');
  // One rotation step per kind: R turns a spawn 45°, Shift+R a finer 15°.
  // Back from the rocks at (30, 30): (6, 0, 0) is behind the camera there.
  await page.evaluate(() => window.__editor.view.focus({ x: 6, y: 0, z: 0 }));
  await settle(); // project() uses the last frame's camera
  await page.evaluate(() => window.__editor.setTool({ kind: 'spawn' }));
  const spawns = (await doc()).entities.filter((e) => e.kind === 'spawn').length;
  await clickAt(6, 0, 0);
  const sp0 = (await doc()).entities.filter((e) => e.kind === 'spawn').at(-1);
  check((await doc()).entities.filter((e) => e.kind === 'spawn').length === spawns + 1, 'the Spawn tool places a spawn where you click');
  await page.evaluate((id) => {
    window.__editor.setTool({ kind: 'select' });
    window.__editor.setSelection({ tiles: [], entities: [id] });
  }, sp0?.id);
  await page.keyboard.press('KeyR');
  await page.keyboard.press('Shift+KeyR');
  const sp1 = (await doc()).entities.find((e) => e.id === sp0?.id);
  const turnedBy = (((sp1?.yaw ?? 0) - (sp0?.yaw ?? 0)) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  check(!!sp0 && Math.abs(turnedBy - (Math.PI / 4 + Math.PI / 12)) < 0.01, `R turns a spawn 45° and Shift+R 15° more (${((turnedBy * 180) / Math.PI).toFixed(1)}°)`);
  // Right-click with Select: the selection menu; Escape closes it.
  // The spot the spawn was placed from (on screen; the spawn itself may sit on terrain far below the level plane).
  const sp = await at(6, 0, 0);
  await page.mouse.move(sp.x, sp.y);
  await settle();
  await page.mouse.click(sp.x, sp.y, { button: 'right' });
  const menu = await page.evaluate(() => [...document.querySelectorAll('#ed-ctx button')].map((b) => b.textContent));
  const menuWhy = menu.length ? '' : ` [${await page.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); return JSON.stringify({ at: el ? `${el.tagName}#${el.id}.${el.className}` : null, tool: window.__editor.tool?.kind, looking: !!window.__editor.looking, sel: window.__editor.selection }); }, [sp.x, sp.y])}]`;
  check(menu.some((t) => t.startsWith('Rotate')) && menu.some((t) => t.startsWith('Delete')), `right-click with Select opens the selection menu (${menu.join(', ')})${menuWhy}`);
  await page.keyboard.press('Escape');
  check(!(await page.isVisible('#ed-ctx')), 'Escape closes the selection menu');
  // A drag with Erase is one undo step.
  const before = (await doc()).entities.length;
  await page.evaluate(() => {
    const h = window.__editor.history;
    h.beginStroke();
    for (const e of window.__editor.doc.entities.filter((x) => x.kind === 'spawn').slice(-1)) h.execute('Erase', { kind: 'removeEntities', entities: [e] });
    h.endStroke();
  });
  await page.keyboard.press('Control+KeyZ');
  check((await doc()).entities.length === before, 'a stroke undoes in one step');
  await editorPhase1aChecks(page, { doc, at, clickAt, settle, shot });
  await editorInspectorKeepChecks(page, { doc, clickAt, settle });
  // At 1400 px the top bar keeps Export and Import (and the owner's Publish) beside the Bot test button.
  await settle();
  const bar1400 = await page.evaluate(() => {
    const t = document.getElementById('ed-top');
    const shown = (id) => getComputedStyle(document.getElementById(id)).display !== 'none';
    return { fits: t.scrollWidth <= t.clientWidth + 1, shown: ['ed-export', 'ed-import', 'ed-maptest', 'ed-skill'].filter(shown), cls: t.className, width: innerWidth };
  });
  check(bar1400.fits && bar1400.shown.length === 4, `at 1400 px the top bar fits with Export, Import, Bot test and the bots' skill shown (${JSON.stringify(bar1400)})`);
  await shot('topbar-1400');
  // The same layout at 1280×720: panels narrow, the tool bar drops its labels, nothing overlaps.
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => document.querySelector('#ed-modes [data-ws="build"]').click());
  await settle();
  check(await page.evaluate(() => { const t = document.getElementById('ed-top'); return t.scrollWidth <= t.clientWidth + 1; }), 'the top bar fits at 1280×720');
  check(await page.evaluate(() => document.getElementById('ed-toolbar').getBoundingClientRect().right <= document.getElementById('ed-right').getBoundingClientRect().left), 'the tool bar stays clear of the right panel at 1280×720');
  await shot('1280');
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
  await editorInterfaceChecks(browser);
}

/**
 * MapMaker overhaul Phase 2 (docs/MAPMAKER_OVERHAUL_PLAN.md): the seven mode tabs and their palettes and inspectors,
 * the side panel's folding panels (kept per person), the outliner (search, select and frame, editor-only hide and lock,
 * quick at 4,096 things) and the quick row's mode-first favourites.
 */
async function editorInterfaceChecks(browser) {
  const shots = process.env.E2E_SHOTS;
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 820 }, deviceScaleFactor: shots ? 2 : 1 })).newPage();
  livePages.add(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const shot = (name) => (shots ? page.screenshot({ path: `${shots}/editorux-${name}.png` }).catch(() => {}) : Promise.resolve());
  await page.goto(`${CLIENT}/?mode=editor&test=1`);
  await page.waitForFunction(() => window.__editor, null, { timeout: T(60000) });
  page.once('dialog', (d) => d.accept());
  await newMap(page, 96);
  await frames(page, 3);
  // ---- Mode tabs: each shows its own palette tabs; every pane is in one of them.
  const modes = { build: ['tiles', 'setpieces', 'advanced'], props: ['props', 'lights'], entities: ['entities', 'npcs', 'vehicles', 'scenario'], environment: ['paint', 'plants', 'terrain', 'sky'], paths: ['paths'], test: ['test'] };
  const seen = {};
  for (const ws of Object.keys(modes)) {
    await page.click(`#ed-modes [data-ws="${ws}"]`);
    await frames(page, 2);
    seen[ws] = await page.evaluate(() => [...document.querySelectorAll('#ed-pal-tabs .tab')].filter((b) => !b.hidden).map((b) => b.dataset.pane));
  }
  check(Object.entries(modes).every(([ws, panes]) => JSON.stringify(seen[ws]) === JSON.stringify(panes)), `each mode tab shows its own palette tabs (${JSON.stringify(seen)})`);
  check(await page.evaluate(() => ['Build', 'Props', 'Gameplay', 'Logic', 'Environment', 'Paths', 'Test'].every((l, i) => document.querySelectorAll('#ed-modes .tab')[i]?.textContent.includes(l === 'Gameplay' ? 'Game' : l))), 'the top bar has Build, Props, Gameplay, Logic, Environment, Paths and Test');
  // Test: its pane plays; its inspector part says whether the map is ready.
  check(await page.isVisible('#ed-tp-play') && await page.isVisible('#ed-tp-here') && (await page.getAttribute('#ed-mode-section', 'data-ws')) === 'test', 'the Test mode has its pane (play, play from here, bot test, plan) and its own inspector section');
  await shot('mode-test');
  await page.click('#ed-modes [data-ws="paths"]');
  await frames(page, 2);
  check(await page.isVisible('[data-tool="path"]') && await page.isVisible('[data-tool="path-race"]') && (await page.getAttribute('#ed-mode-section', 'data-ws')) === 'paths', 'the Paths mode holds the paths, the track and the drop routes, and its inspector lists the paths');
  await shot('mode-paths');
  await page.click('#ed-modes [data-ws="props"]');
  await frames(page, 2);
  check(await page.isVisible('#ed-pal-tabs [data-pane="lights"]') && !(await page.$('#ed-mode-section')), 'the Props mode has props and lights; its inspector is Map properties');
  // A tool picked from another mode's card (here by key) moves the tabs to its mode.
  await page.evaluate(() => window.__editor.setTool({ kind: 'spawn' }));
  await frames(page, 2);
  check(await page.evaluate(() => document.querySelector('#ed-modes .tab.on')?.dataset.ws === 'entities'), 'picking the spawn tool shows the Gameplay mode');
  await page.keyboard.press('Escape');
  await page.click('#ed-modes [data-ws="build"]');

  // ---- Folding panels: the heading folds a panel; a reload keeps it folded (this browser only).
  await page.click('.ed-panel[data-panel="issues"] .ed-panel-head button');
  check(!(await page.isVisible('#ed-issues')) && (await page.evaluate(() => localStorage.getItem('tiletrigger.editor.panels'))) === '["issues"]', 'the Validation panel folds from its heading, remembered in this browser');
  await page.reload();
  await page.waitForFunction(() => window.__editor, null, { timeout: T(60000) });
  check(!(await page.isVisible('#ed-issues')) && (await page.isVisible('#ed-inspector')), 'after a reload the folded panel stays folded, the others open');
  await page.click('.ed-panel[data-panel="issues"] .ed-panel-head button');
  check(await page.isVisible('#ed-issues'), 'and opens again from its heading');
  page.once('dialog', (d) => d.accept());
  await newMap(page, 96);

  // ---- The outliner: 4,096 things, drawn virtualised, quick to rebuild.
  await page.evaluate(() => {
    const ed = window.__editor;
    const entities = Array.from({ length: 4096 }, (_, i) => ({ id: `olp${i}`, kind: 'prop', position: [(i % 64) - 32, 0, Math.floor(i / 64) - 32], model: i % 2 ? 'prop.barrel' : 'prop.metal_crate', yaw: 0, scale: 1, solid: true, tint: null }));
    ed.run('Many props', { kind: 'addEntities', entities });
  });
  await page.waitForFunction(() => window.__editor.outliner.entriesFor === window.__editor.doc, null, { timeout: T(20000) });
  const big = await page.evaluate(() => ({ ms: window.__editor.outliner.lastBuildMs, rows: document.querySelectorAll('#ed-ol-list [data-row]').length, height: document.querySelector('#ed-ol-list .ed-ol-spacer').getBoundingClientRect().height }));
  check(big.rows > 0 && big.rows < 60 && big.height > 4096 * 22 * 0.9 && big.ms < 400 * (process.env.CI ? 2 : 1), `the outliner lists 4,096 things drawing only the rows in view (${JSON.stringify(big)})`);
  await page.fill('#ed-ol-search', 'barrel 7');
  await frames(page, 2);
  // Every word matches the name, the kind or the id (a barrel whose id holds a 7 counts).
  const found = await page.$$eval('#ed-ol-list .ed-ol-item', (els) => els.map((e) => ({ n: e.querySelector('.nm').textContent, id: e.dataset.id })));
  check(found.length > 0 && found.every(({ n, id }) => /barrel/i.test(n) && (n.includes('7') || id.includes('7'))) && found.some(({ n }) => n === 'Barrel 7'), `searching the outliner lists only what matches (${found.slice(0, 4).map((f) => f.n).join(', ')}…)`);
  await page.fill('#ed-ol-search', '');
  await page.evaluate(() => window.__editor.history.undo());
  await page.waitForFunction(() => window.__editor.doc.entities.length < 100, null, { timeout: T(10000) });
  // A few things to pick, hide and lock.
  await page.evaluate(() => {
    const ed = window.__editor;
    ed.run('Two props', { kind: 'addEntities', entities: [{ id: 'olA', kind: 'prop', position: [20, 0, 20], model: 'prop.barrel', yaw: 0, scale: 1, solid: true, tint: null, name: 'Outliner barrel' }, { id: 'olB', kind: 'prop', position: [-20, 0, -20], model: 'prop.barrel', yaw: 0, scale: 1, solid: true, tint: null, name: 'Outliner crate' }] });
  });
  await page.fill('#ed-ol-search', 'outliner');
  await frames(page, 3);
  const camAt = () => page.evaluate(() => ({ x: window.__editor.view.camera.position.x, z: window.__editor.view.camera.position.z }));
  const before = await camAt();
  await page.click('#ed-ol-list .ed-ol-item[data-id="olA"] .nm');
  await frames(page, 3);
  const picked = await page.evaluate(() => ({ sel: window.__editor.selection.entities, target: { x: window.__editor.view.camera.position.x, z: window.__editor.view.camera.position.z }, on: document.querySelector('#ed-ol-list .ed-ol-item[data-id="olA"]')?.classList.contains('on') }));
  check(JSON.stringify(picked.sel) === '["olA"]' && picked.on && Math.hypot(picked.target.x - 20, picked.target.z - 20) < Math.hypot(before.x - 20, before.z - 20), `a click in the outliner selects the thing and frames it (${JSON.stringify(picked)})`);
  await shot('outliner');
  // Hide: gone from the view, still in the map; the flag is this browser's, per map, not in the file.
  await page.click('#ed-ol-list .ed-ol-item[data-id="olB"] [data-act="hide"]');
  await frames(page, 3);
  const hid = await page.evaluate(() => ({ shown: window.__editor.view.entityShown('olB'), inDoc: window.__editor.doc.entities.some((e) => e.id === 'olB'), stored: localStorage.getItem(`tiletrigger.editor.outliner.${window.__editor.doc.metadata.id}`), file: JSON.stringify(window.__editor.doc).includes('"hidden"') }));
  check(!hid.shown && hid.inDoc && JSON.parse(hid.stored ?? '{}').hidden?.includes('olB') && !hid.file, `the eye hides a thing from MapMaker's view only, kept per map in this browser (${JSON.stringify(hid)})`);
  // Lock: a click on it in the outliner (or the map) doesn't select it.
  await page.click('#ed-ol-list .ed-ol-item[data-id="olA"] [data-act="lock"]');
  await frames(page, 2);
  const lockedSel = await page.evaluate(() => window.__editor.selection.entities);
  await page.click('#ed-ol-list .ed-ol-item[data-id="olA"] .nm');
  await frames(page, 2);
  const after = await page.evaluate(() => ({ sel: window.__editor.selection.entities, toast: document.getElementById('ed-toast').textContent }));
  check(!lockedSel.includes('olA') && !after.sel.includes('olA') && /locked/.test(after.toast), `a locked thing drops out of the selection and can't be selected (${JSON.stringify(after)})`);
  await page.evaluate(() => {
    const ed = window.__editor;
    ed.setTool({ kind: 'select' });
    ed.setSelection({ tiles: [], entities: ['olA'] });
  });
  check((await page.evaluate(() => window.__editor.selection.entities)).length === 0, 'selecting a locked thing by any route leaves it out');
  await page.click('#ed-ol-list .ed-ol-item[data-id="olA"] [data-act="lock"]');
  await page.click('#ed-ol-list .ed-ol-item[data-id="olB"] [data-act="hide"]');
  await frames(page, 3);
  check(await page.evaluate(() => window.__editor.view.entityShown('olB')), 'showing it again draws it again');
  await page.fill('#ed-ol-search', '');

  // ---- Favourites and recent follow the mode: its own pieces first, then the rest (or only its own).
  await page.evaluate(() => localStorage.setItem('tt.palette.favs', JSON.stringify(['prop:prop.barrel', 'tile:core.room', 'spawn'])));
  await page.reload();
  await page.waitForFunction(() => window.__editor, null, { timeout: T(60000) });
  const firstFav = async (ws) => {
    await page.click(`#ed-modes [data-ws="${ws}"]`);
    await frames(page, 2);
    return page.evaluate(() => [...document.querySelectorAll('#ed-pal-quick .ed-quick-row [data-pick]')].map((c) => c.dataset.pick));
  };
  const favs = { build: await firstFav('build'), props: await firstFav('props'), entities: await firstFav('entities') };
  check(favs.build[0] === 'tile:core.room' && favs.props[0] === 'prop:prop.barrel' && favs.entities[0] === 'spawn' && favs.build.length === 3, `each mode's favourites come first in the quick row (${JSON.stringify(favs)})`);
  await page.click('#ed-pal-quick [data-q="only"]');
  check(JSON.stringify(await firstFav('props')) === '["prop:prop.barrel"]', 'This mode only shows just the mode\'s own');
  await shot('favourites');
  await page.click('#ed-pal-quick [data-q="only"]');
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

/**
 * The inspector keeps the first edit after a placement (MapMaker fixes 2, item 7; editor/inspectorKeep.ts). A placement
 * builds the inspector for the new thing and the map change rebuilds it a frame later: a value typed in before that
 * frame went with the old field. Here the placement is made as the Place tool makes it (run, then select), a value is
 * typed into X at once, and three frames pass before Enter: the field still has it and commits it.
 */
async function editorInspectorKeepChecks(page, { doc, clickAt, settle }) {
  await page.keyboard.press('Escape');
  const r = await page.evaluate(async () => {
    const ed = window.__editor;
    const id = 'spawn_keep';
    const raf = () => new Promise((res) => requestAnimationFrame(() => res()));
    ed.run('Place spawn', { kind: 'addEntities', entities: [{ id, kind: 'spawn', position: [4, 0, 4], yaw: 0 }] });
    ed.setSelection({ tiles: [], entities: [id] });
    const field = (label) => [...document.querySelectorAll('#ed-inspector .row')].find((row) => row.firstChild?.textContent === label)?.querySelector('input');
    const x = field('X');
    if (!x) return { error: 'no X field' };
    x.focus();
    x.value = '9';
    x.dispatchEvent(new Event('input', { bubbles: true }));
    await raf();
    await raf();
    await raf();
    const now = document.activeElement;
    const kept = { tag: now?.tagName ?? null, value: now?.value ?? null, rebuilt: now !== x };
    now?.dispatchEvent(new Event('change', { bubbles: true }));
    await raf();
    await raf();
    return { kept, x: ed.doc.entities.find((e) => e.id === id)?.position[0] };
  });
  check(!r.error && r.kept.tag === 'INPUT' && r.kept.value === '9' && r.x === 9, `the inspector keeps the first edit after a placement through the rebuild a frame later (${JSON.stringify(r)})`);
  // The same with the mouse and keyboard: the Spawn tool places one, X is typed at once and Enter commits it.
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__editor.view.focus({ x: 6, y: 0, z: 0 }));
  await settle();
  await page.evaluate(() => window.__editor.setTool({ kind: 'spawn' }));
  await clickAt(10, 0, 4);
  const placed = (await doc()).entities.filter((e) => e.kind === 'spawn').at(-1);
  await page.fill('#ed-inspector .row:has(> span:text-is("Z")) input', '-7');
  await page.keyboard.press('Enter');
  await settle();
  const moved = (await doc()).entities.find((e) => e.id === placed?.id);
  check(moved?.position[2] === -7, `typed into the inspector straight after placing with the mouse, the edit lands (z ${moved?.position[2]})`);
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Escape');
}

/**
 * MapMaker's checks were one flow (`editorux`, 1,337 s on CI run 42671626152: too long for a retry in the 45-minute
 * job); split by area into four of about 5-6.5 minutes each (MapMaker fixes 2, item 10), every check kept, in the
 * same order. `editorux`: the palette, tools, placing, levels, the inspector, the status bar and the top bar (one
 * page). `editorpieces`: set pieces, the ground under floors, measuring. `editortools`: turning, the workflow (Play
 * from here, the plan view, the card shot), Phase 3 part B (groups, paste, mirror, notes), the terrain grid and bot
 * hints. `editorenv`: the bot test, the environment tools, and the time of day and weather (Phase 5).
 */
async function editorpiecesFlow(browser) {
  await editorSetPieceChecks(browser);
  await editorSetPiecePart5Checks(browser);
  await editorGroundChecks(browser);
  await editorMeasureChecks(browser);
}

async function editortoolsFlow(browser) {
  await editorTurnChecks(browser);
  await editorWorkflowChecks(browser);
  await editorPartBChecks(browser);
  await editorTerrainGridChecks(browser);
  await editorBotHintChecks(browser);
  await editorTileOptionChecks(browser);
}

/**
 * Tile options (Sandfall follow-up, owner 2026-11-09): the Vaulted Tunnel's Side walls, a checkbox in the tile
 * inspector that swaps the tile for its walled twin (one undo step, and for several tunnels at once); the twin is kept
 * out of the palette.
 */
async function editorTileOptionChecks(browser) {
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 820 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  const shot = (name) => (process.env.E2E_SHOTS ? page.screenshot({ path: `${process.env.E2E_SHOTS}/editorux-${name}.png` }).catch(() => {}) : Promise.resolve());
  await page.goto(`${CLIENT}/?mode=editor&test=1`);
  await page.waitForFunction(() => window.__editor, null, { timeout: T(60000) });
  page.once('dialog', (d) => d.accept());
  await newMap(page, 0);
  const palette = await page.evaluate(() => ({ plain: !!document.querySelector('[data-tool="tile:core.tunnel_vault"]'), twin: !!document.querySelector('[data-tool="tile:core.tunnel_vault_walled"]') }));
  check(palette.plain && !palette.twin, `the palette has the Vaulted Tunnel, not its side-walled twin (${JSON.stringify(palette)})`);
  // Two tunnels on level -1 (as the palette would place them), one selected.
  await page.evaluate(() => {
    const ed = window.__editor;
    ed.history.execute('Place', { kind: 'addTiles', tiles: [{ id: 'tile_tun_a', tile: 'core.tunnel_vault', x: 2, y: 0, z: -1, rotation: 0 }, { id: 'tile_tun_b', tile: 'core.tunnel_vault', x: 2, y: 1, z: -1, rotation: 0 }] });
    ed.setSelection({ tiles: ['tile_tun_a'], entities: [] });
  });
  await frames(page, 2);
  const box = await page.$('#ed-tile-opt-sideWalls');
  check(!!box && !(await box.isChecked()), 'a Vaulted Tunnel\'s inspector has a Side walls option, off');
  await page.click('#ed-tile-opt-sideWalls');
  await frames(page, 2);
  const on = await page.evaluate(() => ({ tiles: window.__editor.doc.classicStructure.tiles.filter((t) => t.id.startsWith('tile_tun')).map((t) => t.tile), undo: window.__editor.history.undoLabel, ticked: document.getElementById('ed-tile-opt-sideWalls')?.checked }));
  check(on.tiles[0] === 'core.tunnel_vault_walled' && on.tiles[1] === 'core.tunnel_vault' && on.ticked && on.undo === 'Add side walls', `ticking it makes that tunnel side-walled, one undo step (${JSON.stringify(on)})`);
  await page.evaluate(() => window.__editor.view.focus({ x: 16, y: -4, z: 4 }));
  await frames(page, 3);
  await shot('tunnel-side-walls');
  // Both tunnels selected: the box is half ticked; a click walls both.
  await page.evaluate(() => window.__editor.setSelection({ tiles: ['tile_tun_a', 'tile_tun_b'], entities: [] }));
  await frames(page, 2);
  const half = await page.evaluate(() => ({ ind: document.getElementById('ed-tile-opt-sideWalls')?.indeterminate, label: document.querySelector('.ed-tile-options label span')?.textContent }));
  check(half.ind === true && half.label === 'Side walls (1 of 2)', `with both selected it shows one of two walled (${JSON.stringify(half)})`);
  await page.click('#ed-tile-opt-sideWalls');
  await frames(page, 2);
  const both = await page.evaluate(() => window.__editor.doc.classicStructure.tiles.filter((t) => t.id.startsWith('tile_tun')).map((t) => t.tile));
  check(both.every((t) => t === 'core.tunnel_vault_walled'), `a click walls both (${both})`);
  await page.keyboard.press('Control+KeyZ');
  await page.keyboard.press('Control+KeyZ');
  const undone = await page.evaluate(() => window.__editor.doc.classicStructure.tiles.filter((t) => t.id.startsWith('tile_tun')).map((t) => t.tile));
  check(undone.every((t) => t === 'core.tunnel_vault'), `two undos take both back to the plain tunnel (${undone})`);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

async function editorenvFlow(browser) {
  await editorMapTestChecks(browser);
  await editorEnvironmentChecks(browser);
  await editorSkyWeatherChecks(browser);
}

/**
 * Time of day and weather (map format v34; MAPMAKER_OVERHAUL_PLAN.md Phase 5): Map properties' Time of day slider
 * previews live (no edit) and sets the time when let go, its presets set one each, the weather's fall, how hard, wind
 * and fog banks each make one undo step and show in the view; then TEST starts the match with the map's weather.
 */
async function editorSkyWeatherChecks(browser) {
  const context = await browser.newContext({ viewport: { width: 1400, height: 820 }, deviceScaleFactor: Number(process.env.E2E_DSF ?? 1) });
  // Medium graphics: Low (the flows' default, phones) draws no rain or snow, only the fog.
  await context.addInitScript(() => localStorage.setItem('tiletrigger.graphics', 'medium'));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  const shot = (name) => (process.env.E2E_SHOTS ? page.screenshot({ path: `${process.env.E2E_SHOTS}/editorux-${name}.png` }).catch(() => {}) : Promise.resolve());
  await page.goto(`${CLIENT}/?mode=editor&test=1`);
  await page.waitForFunction(() => window.__editor, null, { timeout: T(60000) });
  page.once('dialog', (d) => d.accept());
  await newMap(page, 96);
  const sun = () =>
    page.evaluate(() => {
      const l = window.__editor.view.scene.getLightByName('sun');
      return { y: +l.direction.y.toFixed(3), x: +l.direction.x.toFixed(3), color: l.diffuse.toHexString(), doc: window.__editor.doc.timeOfDay ?? null, undo: window.__editor.history.undoLabel ?? null };
    });
  const panel = await page.evaluate(() => ['ed-tod-on', 'ed-tod', 'ed-weather-fall', 'ed-weather-amount', 'ed-weather-wind', 'ed-weather-fog'].map((id) => !!document.getElementById(id)));
  check(panel.every(Boolean) && (await page.locator('.ed-tod-preset').count()) === 6, `Map properties: Time of day (switch, slider, six presets) and Weather (fall, how hard, wind, fog banks) (${JSON.stringify(panel)})`);
  const before = await sun();
  // The slider previews as it moves: the sun goes low and red at 18:30, nothing is edited.
  await page.evaluate(() => {
    const s = document.getElementById('ed-tod');
    s.disabled = false;
    s.value = '18.5';
    s.dispatchEvent(new Event('input'));
  });
  const preview = await sun();
  check(preview.doc === null && preview.undo === before.undo && preview.y > before.y && preview.color !== before.color, `the time slider previews live without an edit (sun ${JSON.stringify(before)} → ${JSON.stringify(preview)}; label ${await page.textContent('#ed-tod-label')})`);
  // Let go: one undo step sets it.
  await page.evaluate(() => document.getElementById('ed-tod').dispatchEvent(new Event('change')));
  await frames(page, 2);
  const set = await sun();
  check(set.doc === 18.5 && /Time of day/.test(set.undo ?? ''), `letting go sets the time (one undo step: ${JSON.stringify(set)})`);
  // A preset: Noon, the sun high in the south.
  await page.click('.ed-tod-preset[data-hours="12"]');
  await frames(page, 2);
  const noon = await sun();
  check(noon.doc === 12 && noon.y < -0.85 && Math.abs(noon.x) < 0.01, `the Noon preset puts the sun high in the south (${JSON.stringify(noon)})`);
  await page.click('.ed-tod-preset[data-hours="22"]');
  await shot('time-night');
  // Weather: rain, harder, windy, fog; each one step, drawn in the view.
  await page.selectOption('#ed-weather-fall', 'rain');
  const slide = (id, v) =>
    page.evaluate(([id, v]) => {
      const s = document.getElementById(id);
      s.value = String(v);
      s.dispatchEvent(new Event('input'));
      s.dispatchEvent(new Event('change'));
    }, [id, v]);
  await slide('ed-weather-amount', 100);
  await slide('ed-weather-wind', 60);
  await slide('ed-weather-fog', 40);
  await frames(page, 4);
  const rain = await page.evaluate(() => ({ weather: window.__editor.doc.weather, stats: { ...window.__editor.view.weather.stats }, note: document.getElementById('ed-weather-note')?.textContent }));
  check(JSON.stringify(rain.weather) === JSON.stringify({ fall: 'rain', amount: 1, wind: 0.6, fog: 0.4 }) && rain.stats.particles > 0 && rain.stats.fogBanks > 0 && rain.stats.fogDensity > 0, `the weather is set and drawn: rain falling, fog banks, the haze thicker (${JSON.stringify(rain)})`);
  await shot('weather-rain');
  await page.keyboard.press('Control+z');
  const undone = await page.evaluate(() => window.__editor.doc.weather?.fog ?? null);
  check(undone === 0, `Undo takes back one weather step (fog ${undone})`);
  await page.keyboard.press('Control+y');
  // TEST: the match starts with the map's weather (and its time).
  await page.keyboard.press('F5');
  const playing = await page.waitForFunction(() => window.__cs?.local && window.__testStartMs, null, { timeout: T(90000) }).then(() => true, () => false);
  check(playing, 'TEST plays the map');
  if (playing) {
    await frames(page, 6);
    const inPlay = await page.evaluate(() => ({ weather: window.__cs.view.weather.current, stats: { ...window.__cs.view.weather.stats }, sun: window.__cs.view.scene.getLightByName('sun')?.diffuse.toHexString().toLowerCase() }));
    check(inPlay.weather.fall === 'rain' && inPlay.weather.amount === 1 && inPlay.stats.particles > 0 && inPlay.sun === '#9fb8ff', `a match starts with the map's weather and time of day (${JSON.stringify(inPlay)})`);
  }
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

/**
 * Bot hints in MapMaker (map format v33; MAPMAKER_OVERHAUL_PLAN.md Phase 4 item 3): the Bot hints tool (Y) places a
 * spot and a jump link, the inspector edits and deletes them (each one undo step), the checks warn of a jump no one
 * could make and a spot off the navmesh, the plan view shows them, and "What bots know" draws the bots' own spots.
 */
async function editorBotHintChecks(browser) {
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 820 }, deviceScaleFactor: Number(process.env.E2E_DSF ?? 1) })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  const shot = (name) => (process.env.E2E_SHOTS ? page.screenshot({ path: `${process.env.E2E_SHOTS}/editorux-${name}.png` }).catch(() => {}) : Promise.resolve());
  await page.goto(`${CLIENT}/?mode=editor&test=1`);
  await page.waitForFunction(() => window.__editor, null, { timeout: T(60000) });
  page.once('dialog', (d) => d.accept());
  await newMap(page, 96);
  const hints = () => page.evaluate(() => window.__editor.doc.botHints ?? []);
  const at = (x, y, z) => page.evaluate(([x, y, z]) => window.__editor.view.project({ x, y, z }), [x, y, z]);
  const clickAt = async (x, y, z) => {
    const p = await at(x, y, z);
    await page.mouse.move(p.x, p.y);
    await page.mouse.click(p.x, p.y);
  };
  // A palette card, clicked as a person would (its own click: the Entities tab's thumbnails load and shift the cards).
  const pickHint = (kind) => page.evaluate((k) => document.querySelector(`[data-tool="bothint:${k}"]`).click(), kind);
  // The new map's spawn out on the open ground (bots' main area is the ground the spawns route to; the starting room
  // has no door), then the camera on the middle.
  await page.evaluate(() => {
    const ed = window.__editor;
    const sp = ed.doc.entities.find((e) => e.kind === 'spawn');
    ed.history.execute('Move spawn', { kind: 'updateEntities', before: [sp], after: [{ ...sp, position: [10, 0, 18] }] });
  });
  await page.evaluate(() => window.__editor.view.focus({ x: 4, y: 0, z: 4 }));
  await frames(page, 3);
  // Y: the Bot hints tool (the last kind, a chokepoint first), its cards in the Entities tab.
  await page.keyboard.press('KeyY');
  const tool = await page.evaluate(() => ({ tool: window.__editor.tool, lit: document.querySelector('[data-tool="bothint:choke"]')?.classList.contains('active'), hint: document.getElementById('ed-toolhint').textContent }));
  check(tool.tool.kind === 'bothint' && tool.tool.hint === 'choke' && tool.lit && tool.hint.includes('Bot hints'), `Y picks up the Bot hints tool (${JSON.stringify(tool.tool)})`);
  await pickHint('sniper');
  await clickAt(12, 0, 6);
  let h = await hints();
  const sniper = h[0];
  check(h.length === 1 && sniper.kind === 'sniper' && Math.abs(sniper.position[0] - 12) < 0.5 && Math.abs(sniper.position[2] - 6) < 0.5 && sniper.radius === 1.5 && typeof sniper.yaw === 'number', `a click places a sniper spot where it points, facing the way the camera looks (${JSON.stringify(sniper)})`);
  await frames(page, 2);
  const shown = await page.evaluate((id) => ({ pin: !!document.querySelector(`.ed-hint-pin[data-hint="${id}"]:not([hidden])`), inspector: document.getElementById('ed-hint-inspector')?.dataset.hint }), sniper?.id);
  check(shown.pin && shown.inspector === sniper?.id, `the new hint shows as a pin and opens in the inspector (${JSON.stringify(shown)})`);
  // The inspector: radius, kind, team and facing, each one undo step.
  await page.fill('#ed-hint-radius', '5');
  await page.press('#ed-hint-radius', 'Enter');
  await page.selectOption('#ed-hint-kind', 'camp');
  const teams = await page.$$eval('#ed-hint-team option', (o) => o.map((x) => x.value));
  await page.selectOption('#ed-hint-team', teams[1]);
  await page.fill('#ed-hint-yaw', '90');
  await page.press('#ed-hint-yaw', 'Enter');
  h = await hints();
  check(h.length === 1 && h[0].kind === 'camp' && h[0].radius === 5 && h[0].team === teams[1] && Math.abs(h[0].yaw - Math.PI / 2) < 0.01, `the inspector edits the kind, radius, team and facing (${JSON.stringify(h[0])})`);
  await page.keyboard.press('Control+KeyZ');
  h = await hints();
  const undone = h[0]?.yaw;
  await page.keyboard.press('Control+KeyZ');
  await page.keyboard.press('Control+KeyZ');
  await page.keyboard.press('Control+KeyZ');
  h = await hints();
  check(Math.abs(undone - sniper.yaw) < 1e-9 && h[0]?.kind === 'sniper' && h[0].radius === 1.5 && !h[0].team, `undo takes each edit back, one at a time (${JSON.stringify(h[0])})`);
  for (let i = 0; i < 4; i++) await page.keyboard.press('Control+KeyY');
  h = await hints();
  check(h[0]?.kind === 'camp' && h[0].radius === 5, 'redo puts them back');
  // A jump link: two clicks, its start then its landing; one a player makes, one too far.
  await pickHint('jump');
  await clickAt(8, 0, -2);
  await frames(page, 2);
  const pending = await page.evaluate(() => !document.querySelector('.ed-hint-pending').hidden);
  await clickAt(12, 0, -2);
  await frames(page, 2);
  h = await hints();
  const jump = h.find((x) => x.kind === 'jump');
  const verdict = await page.evaluate(() => document.getElementById('ed-hint-verdict')?.textContent ?? '');
  check(pending && jump && Math.abs(jump.to[0] - jump.position[0] - 4) < 0.5 && /can make it/.test(verdict), `a jump link from its start to its landing; the inspector says a player can make it (${verdict})`);
  await clickAt(-4, 0, 10);
  await clickAt(8, 0, 10);
  await frames(page, 2);
  const far = await page.evaluate(() => document.getElementById('ed-hint-verdict')?.textContent ?? '');
  await page.waitForFunction(() => /couldn't make it/.test(document.getElementById('ed-issues')?.textContent ?? ''), null, { timeout: T(10000) }).catch(() => {});
  const farIssue = await page.evaluate(() => [...document.querySelectorAll('#ed-issues li')].map((l) => l.textContent).find((t) => /couldn't make it/.test(t)) ?? '');
  check(/couldn't make it/.test(far) && /across/.test(farIssue), `a jump too far: the inspector and the issues list say a player couldn't make it (${farIssue})`);
  await shot('bothints');
  // A spot lifted off the ground: the navigation check warns it is off the navmesh.
  const camp = (await hints()).find((x) => x.kind === 'camp');
  await page.click(`.ed-hint-pin[data-hint="${camp.id}"]:not(.landing)`);
  await frames(page, 2);
  check((await page.evaluate(() => document.getElementById('ed-hint-inspector')?.dataset.hint)) === camp.id, 'a click on a pin selects that hint for the inspector');
  await page.fill('#ed-hint-at-y', '9');
  await page.press('#ed-hint-at-y', 'Enter');
  const offNav = await page.waitForFunction(() => /off the navmesh/.test(document.getElementById('ed-issues')?.textContent ?? ''), null, { timeout: T(30000) }).then(() => true, () => false);
  check(offNav, 'a hint off the navmesh is a warning in the issues list');
  await page.keyboard.press('Control+KeyZ');
  await shot('bothints-inspector');
  // Delete (the inspector's button), and undo brings it back.
  const before = (await hints()).length;
  await page.click('#ed-hint-delete');
  const afterDelete = (await hints()).length;
  await page.keyboard.press('Control+KeyZ');
  check(afterDelete === before - 1 && (await hints()).length === before && (await hints()).some((x) => x.id === camp.id), `Delete removes the hint, undo brings it back (${before} → ${afterDelete})`);
  // The plan view shows them too.
  await page.keyboard.press('Escape');
  await page.keyboard.press('KeyK');
  await frames(page, 4);
  const plan = await page.evaluate(() => [...document.querySelectorAll('.ed-hint-pin')].filter((p) => !p.hidden).length);
  check(plan >= 4, `the plan view shows the hints' pins (${plan} shown)`);
  await shot('bothints-plan');
  await page.keyboard.press('KeyK');
  await frames(page, 2);
  // What bots know: the bots' own spots, worked out on the navmesh, read-only; off again clears them.
  await pickHint('choke');
  await page.check('#ed-hints-computed');
  const known = await page.waitForFunction(() => window.__editor.hints.computed, null, { timeout: T(30000) }).then(() => true, () => false);
  const knownNote = await page.textContent('#ed-hints-computed-note');
  const spots = await page.evaluate(() => ({ v: window.__editor.hints.computed?.vantage.length ?? -1, p: window.__editor.hints.computed?.parkour.length ?? -1, doc: (window.__editor.doc.botHints ?? []).length }));
  check(known && spots.v > 0 && /Bots work out \d+ sniper and \d+ camp spots and \d+ parkour links/.test(knownNote), `What bots know shows the bots' own spots (${JSON.stringify(spots)}; ${knownNote})`);
  await page.evaluate(() => window.__editor.view.focus({ x: 4, y: 0, z: 4 }));
  await frames(page, 4);
  await shot('bothints-known');
  await page.uncheck('#ed-hints-computed');
  check((await page.evaluate(() => window.__editor.hints.computed)) === null && (await hints()).length === spots.doc, 'turned off, the overlay goes (and the map is untouched)');
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

/**
 * MapMaker overhaul Phase 4 items 1 and 2 (mapTestPanel.ts): on Skyward, a 30 s bot test run in the background
 * (MapMaker keeps drawing and taking clicks meanwhile) gives heatmaps, drawn in 3D and in the plan view, and a
 * summary; Cancel ends a run at once; the spawn check labels every spawn with its exposure, draws the sightlines and
 * warns about exposed spawns in the validator's list.
 */
async function editorMapTestChecks(browser) {
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 820 }, deviceScaleFactor: process.env.E2E_SHOTS ? 2 : 1 })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  const shot = (name) => (process.env.E2E_SHOTS ? page.screenshot({ path: `${process.env.E2E_SHOTS}/editorux-${name}.png` }).catch(() => {}) : Promise.resolve());
  page.on('dialog', (d) => d.accept());
  await page.goto(`${CLIENT}/?mode=editor&test=1`);
  await page.waitForFunction(() => window.__editor, null, { timeout: T(60000) });
  await page.setInputFiles('#ed-import-file', fileURLToPath(new URL('../maps/skyward.json', import.meta.url)));
  await page.waitForFunction(() => window.__editor.doc.metadata.id === 'skyward', null, { timeout: T(30000) });
  await page.click('#ed-maptest');
  const opened = await page.evaluate(() => ({ shown: !document.getElementById('ed-maptest-panel').hidden, modes: [...document.querySelectorAll('#ed-mt-mode option')].map((o) => o.value), pressed: document.getElementById('ed-maptest').getAttribute('aria-pressed') }));
  check(opened.shown && opened.pressed === 'true' && opened.modes[0] === 'core.deathmatch' && opened.modes.includes('core.tdm'), `Bot test opens the Test panel with the modes the map plays, its main one first (${JSON.stringify(opened)})`);
  await page.selectOption('#ed-mt-mode', 'core.deathmatch');
  await page.fill('#ed-mt-bots', '6');
  // A 5-minute run: it goes on in the background while MapMaker draws and takes clicks (the match is in its own
  // worker), then Cancel ends it at once.
  await page.selectOption('#ed-mt-length', '300');
  await page.click('#ed-mt-run');
  await page.waitForFunction(() => /^\d:\d\d of 5:00 played/.test(document.getElementById('ed-mt-status').textContent), null, { timeout: T(60000) }).catch(() => {});
  // (A click on the page while it runs: the grid toggle, then Cancel at once, before a slow software-drawn frame
  // lets the match finish.)
  const during = await page.evaluate(() => {
    document.getElementById('ed-grid').click();
    return { running: window.__editor.mapTest.running, grid: document.getElementById('ed-grid').classList.contains('on'), status: document.getElementById('ed-mt-status').textContent, bar: document.getElementById('ed-mt-bar').value };
  });
  // (Clicked in the page: a software-drawn frame for Playwright's own click can take seconds, the match not.)
  await page.evaluate(() => document.getElementById('ed-mt-cancel').click());
  const cancelled = await page.evaluate(() => ({ running: window.__editor.mapTest.running, progress: !document.getElementById('ed-mt-progress').hidden, result: !!window.__editor.mapTest.result, run: !document.getElementById('ed-mt-run').disabled, frames: window.__editor.mapTest.frames.count }));
  check(during.running && !during.grid && during.bar > 0, `the bot test run goes on in the background, its progress shown, while MapMaker draws and takes a click (${JSON.stringify(during)}, ${cancelled.frames} frames drawn meanwhile)`);
  check(!cancelled.running && !cancelled.progress && !cancelled.result && cancelled.run, `Cancel ends the run at once, with no result (${JSON.stringify(cancelled)})`);
  await page.click('#ed-grid');
  if (process.env.E2E_SHOTS) {
    // The picture of a run going: another, cancelled after the shot.
    await page.click('#ed-mt-run');
    await page.waitForFunction(() => /^\d:\d\d of 5:00 played/.test(document.getElementById('ed-mt-status').textContent), null, { timeout: T(60000) }).catch(() => {});
    await shot('bottest-running');
    await page.evaluate(() => document.getElementById('ed-mt-cancel').click());
    await page.waitForFunction(() => !window.__editor.mapTest.running, null, { timeout: T(60000) }).catch(() => {});
    await page.evaluate(() => (window.__editor.mapTest.result = null));
  }
  // A 30-second run to the end, with a 50 ms timer on the page's thread measuring how late it fires (the editor's
  // thread blocked), apart from drawing.
  await page.evaluate(() => {
    const probe = (window.__mtProbe = { worst: 0, n: 0, at: performance.now() });
    probe.timer = setInterval(() => {
      const now = performance.now();
      probe.worst = Math.max(probe.worst, now - probe.at - 50);
      probe.n++;
      probe.at = now;
    }, 50);
  });
  await page.selectOption('#ed-mt-length', '30');
  await page.click('#ed-mt-run');
  await page.waitForFunction(() => !window.__editor.mapTest.running && window.__editor.mapTest.result, null, { timeout: T(180000) }).catch(() => {});
  const done = await page.evaluate(() => {
    const ed = window.__editor;
    const r = ed.mapTest.result;
    const went = ed.view.scene.getMeshByName('edMapTest_went');
    return { summary: [...document.querySelectorAll('#ed-mt-summary li')].map((l) => l.textContent), cells: r ? Object.fromEntries(Object.entries(r.layers).map(([k, v]) => [k, v.length])) : null, kills: r?.summary.kills, quads: went ? went.getTotalVertices() / 4 : 0, cost: document.getElementById('ed-mt-cost').textContent, longest: Math.round(ed.mapTest.frames.longest) };
  });
  check(done.summary[0] === 'Deathmatch, 6 bots, 0:30 played' && done.summary.some((l) => /^Kills: \d+/.test(l)) && done.summary.some((l) => /^Stuck recoveries: \d+/.test(l)) && done.summary.some((l) => /^Failed route searches: \d+/.test(l)), `the run's summary: kills, stuck recoveries, failed searches (${done.summary.join(' | ')})`);
  check(done.cells && done.cells.went > 20 && done.quads === done.cells.went && done.cells.died > 0, `heatmaps: where bots went drawn cell by cell, where they died (${JSON.stringify(done.cells)}, ${done.kills} kills)`);
  const probe = await page.evaluate(() => (clearInterval(window.__mtProbe.timer), { worst: Math.round(window.__mtProbe.worst), n: window.__mtProbe.n }));
  console.log(`bot test run: the page's 50 ms timer at most ${probe.worst} ms late over ${probe.n} ticks; ${done.cost}`);
  check(/^In the background: [\d.]+ s for 0:30 of match \([\d.]+ ms of the worker's time a match second\)/.test(done.cost), `the cost is measured: the worker's time and MapMaker's longest frame (${done.cost})`);
  await page.evaluate(() => window.__editor.view.focus({ x: 0, y: 0, z: 0 }));
  await frames(page, 4);
  await shot('bottest-heatmap');
  // A layer goes off and on with its box.
  await page.click('#ed-mt-layers input[data-layer="went"]');
  const off = await page.evaluate(() => !window.__editor.view.scene.getMeshByName('edMapTest_went'));
  await page.click('#ed-mt-layers input[data-layer="went"]');
  const on = await page.evaluate(() => !!window.__editor.view.scene.getMeshByName('edMapTest_went'));
  check(off && on, `a heatmap layer turns off and on (${off}, ${on})`);
  // The plan view shows them too, from above.
  await page.click('#ed-plan');
  await frames(page, 4);
  const plan = await page.evaluate(() => ({ plan: window.__editor.plan.on, went: !!window.__editor.view.scene.getMeshByName('edMapTest_went')?.isEnabled() }));
  check(plan.plan && plan.went, `the heatmaps show in the plan view (${JSON.stringify(plan)})`);
  await shot('bottest-plan');
  await page.click('#ed-plan');
  // Spawn exposure: a label on every spawn, sightlines, warnings for the exposed ones.
  await page.click('#ed-mt-exposure');
  await page.waitForFunction(() => window.__editor.mapTest.exposure, null, { timeout: T(60000) }).catch(() => {});
  const exp = await page.evaluate(() => {
    const ed = window.__editor;
    const x = ed.mapTest.exposure;
    return {
      spawns: ed.doc.entities.filter((e) => e.kind === 'spawn').length,
      labels: [...document.querySelectorAll('#editor > .ed-exposure-label')].map((l) => l.textContent),
      exposed: x ? x.spawns.filter((s) => s.share >= 0.5).length : -1,
      warned: ed.allIssues().filter((i) => i.code === 'spawn.exposed').length,
      lines: !!ed.view.scene.getMeshByName('edMapTest_lines'),
      list: document.querySelectorAll('#ed-mt-exp li').length,
    };
  });
  check(exp.labels.length === exp.spawns && exp.labels.every((t) => /^\d+%(seen to \d+ m|unseen)$/.test(t)), `every spawn is labelled with its exposure (${exp.labels.length} of ${exp.spawns}: ${exp.labels.slice(0, 3).join(', ')})`);
  check(exp.exposed > 0 && exp.warned === exp.exposed && exp.lines && exp.list > 0, `exposed spawns are warned in the validator's list and lines of sight drawn (${JSON.stringify(exp)})`);
  const spawn = await page.evaluate(() => window.__editor.mapTest.exposure.spawns.slice().sort((a, b) => b.share - a.share)[0].pos);
  await page.evaluate(([x, y, z]) => window.__editor.view.focus({ x, y, z }), [spawn.x, spawn.y, spawn.z]);
  await frames(page, 4);
  await shot('exposure');
  // An edit makes the check stale: its warnings leave the list until it is run again.
  await page.evaluate(() => {
    const ed = window.__editor;
    const s = ed.doc.entities.find((e) => e.kind === 'spawn');
    ed.history.execute('Move', { kind: 'updateEntities', before: [s], after: [{ ...s, position: [s.position[0] + 0.5, s.position[1], s.position[2]] }] });
  });
  await frames(page, 3);
  const stale = await page.evaluate(() => window.__editor.allIssues().filter((i) => i.code === 'spawn.exposed').length);
  check(stale === 0, `after an edit the exposure warnings wait for the next check (${stale})`);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

/**
 * Environment Phase 3 (docs/PROCEDURAL_ENVIRONMENT.md §8): the Nature tab's Environment group (species by category,
 * single placement with a confirmation where a tree would block a spawn), the environment brush (a preset, a stroke =
 * one undo step, the same seed repaints the same plants, filters, keep-clear, erase), the collision preview, the
 * round trip through Export and Import, and a big stroke's cost.
 */
async function editorEnvironmentChecks(browser) {
  const shots = process.env.E2E_SHOTS;
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 820 }, deviceScaleFactor: shots ? 2 : 1, acceptDownloads: true })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  const shot = (name) => (shots ? page.screenshot({ path: `${shots}/editorux-env-${name}.png` }).catch(() => {}) : Promise.resolve());
  // Dialogs: the next answer is set before each one is expected (accept by default).
  let answer = true;
  const asked = [];
  page.on('dialog', (d) => (asked.push(d.message()), answer ? d.accept() : d.dismiss()));
  await page.goto(`${CLIENT}/?mode=editor&test=1`);
  await page.waitForFunction(() => window.__editor, null, { timeout: T(60000) });
  await newMap(page, 160);
  // A hillside: flat grass west of x = 0, a 31° stone slope up to a 24 m plateau; a spawn and a route on the flat.
  await page.evaluate(() => {
    const ed = window.__editor;
    const t = ed.doc.terrain;
    const xOf = (i) => t.origin[0] + (i % t.cols) * t.spacing;
    const heights = t.heights.map((h, i) => Math.round(Math.min(24, Math.max(0, xOf(i) * 0.6)) * 100));
    const materials = t.materials.map((m, i) => (t.origin[0] + ((i % (t.cols - 1)) + 0.5) * t.spacing > 0 && t.origin[0] + ((i % (t.cols - 1)) + 0.5) * t.spacing < 40 ? 2 : m));
    ed.history.execute('Sculpt', { kind: 'setTerrain', before: t, after: { ...t, heights, materials } });
    ed.history.execute('Spawn', { kind: 'addEntities', entities: [{ id: 'spawn_env', kind: 'spawn', position: [-20, 0, 0], yaw: 0, faction: null }] });
    ed.history.execute('Route', { kind: 'setPaths', before: ed.doc.paths ?? null, after: [{ id: 'route_env', points: [[-45, 0, 12], [-5, 0, 12]], uses: ['route'], style: 'dirt', width: 3, closed: false, lay: false }] });
  });
  const envCount = () => page.evaluate(() => window.__editor.doc.entities.filter((e) => e.kind === 'prop' && e.model.startsWith('env.')).length);
  const at = (x, y, z) => page.evaluate(([x, y, z]) => window.__editor.view.project({ x, y, z }), [x, y, z]);
  // Over a point, from far enough back that a stroke's ends are in view (between the palette and the side panel).
  // (Then a few frames, so the view's matrices, which project() reads, follow the camera.)
  const look = async (x, z, y = 0) => {
    await page.evaluate(([x, z, y]) => { const v = window.__editor.view; v.yaw = 0; v.focus({ x, y, z }); v.dolly(-30); }, [x, z, y]);
    await frames(page, 3);
  };
  await frames(page, 3);
  await look(-15, 0);

  // ---- The Environment group: first in the Nature tab, our species by category, the brush card.
  await clickTool(page, '[data-tool="envbrush"]');
  const pal = await page.evaluate(() => {
    const nature = document.getElementById('ed-nature');
    const sec = nature.querySelector('section[data-group="nature:environment"]');
    return {
      first: nature.querySelector('section')?.dataset.group,
      heads: [...(sec?.querySelectorAll('.tile-cat') ?? [])].map((h) => h.textContent),
      species: [...(sec?.querySelectorAll('[data-tool^="prop:env."]') ?? [])].length,
      kenney: [...(sec?.querySelectorAll('[data-tool^="prop:prop."]') ?? [])].length,
      dupes: [...nature.querySelectorAll('[data-tool="prop:env.broadleaf.oak"]')].length,
      pane: !!document.getElementById('ed-env-preset') && !!document.getElementById('ed-env-species'),
    };
  });
  check(pal.first === 'nature:environment' && ['Trees', 'Plants', 'Ground cover', 'Rocks', 'Boulders', 'Cliffs'].every((h) => pal.heads.includes(h)) && pal.species >= 19 && !pal.kenney && pal.dupes === 1 && pal.pane, `the Nature tab opens on the Environment group: Trees, Plants, Ground cover, Rocks, Boulders and Cliffs of our species, and the brush (${JSON.stringify(pal)})`);
  await shot('palette');

  // ---- The brush: the Temperate preset, seed 5, a stroke across the flat = one undo step.
  await page.selectOption('#ed-env-preset', 'temperate');
  await page.fill('#ed-env-seed', '5');
  await page.dispatchEvent('#ed-env-seed', 'change');
  await page.evaluate(() => window.__editor.setBrushRadius(8));
  const stroke = async (from, to, shift = false) => {
    // The hillside's height under a point (as sculpted above).
    const hy = (x) => Math.min(24, Math.max(0, x * 0.6));
    const a = await at(from[0], hy(from[0]), from[1]);
    const b = await at(to[0], hy(to[0]), to[1]);
    // Both ends on the 3D view (not under the palette or the side panel), and no stroke report left from before.
    const inView = await page.evaluate(([a, b]) => {
      const l = document.getElementById('ed-palette').getBoundingClientRect().right;
      const r = document.getElementById('ed-right').getBoundingClientRect().left;
      window.__envStroke = null;
      return [a, b].every((p) => p.x > l + 4 && p.x < r - 4 && p.y > 80 && p.y < innerHeight - 40);
    }, [a, b]);
    if (!inView) check(false, `the stroke ${JSON.stringify(from)} → ${JSON.stringify(to)} is on the 3D view (${JSON.stringify([a, b])})`);
    await page.mouse.move(a.x, a.y);
    // (Let the palette's hover card go and the pointer's ground be found first.)
    await frames(page, 3);
    if (shift) await page.keyboard.down('Shift');
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 12 });
    await page.mouse.up();
    if (shift) await page.keyboard.up('Shift');
    await frames(page, 2);
  };
  const plants = () => page.evaluate(() => window.__editor.doc.entities.filter((e) => e.kind === 'prop' && e.model.startsWith('env.')).map((e) => `${e.model}#${e.variant ?? 0}@${e.position.join(',')}/${e.yaw}/${e.scale}`).sort());
  const undoLabel0 = await page.evaluate(() => window.__editor.history.undoLabel);
  await stroke([-30, -8], [-10, 4]);
  const painted = await plants();
  const s1 = await page.evaluate(() => window.__envStroke);
  const label = await page.evaluate(() => window.__editor.history.undoLabel);
  check(painted.length > 20 && s1?.dabs >= 2 && label === 'Paint Temperate woods' && painted.some((p) => p.startsWith('env.broadleaf.')) && painted.some((p) => p.startsWith('env.grass.')), `a stroke of the Temperate brush paints trees, shrubs and ground cover (${painted.length} plants in ${s1?.dabs} dabs, step "${label}")`);
  // Trunks, boulders and hiding bushes keep off the spawn and the route; ground cover may go on them.
  const clear = await page.evaluate(() => {
    const blocking = /env\.(broadleaf|conifer|palm|cactus|rock\.boulder|cliff|hedge|shrub)/;
    const ps = window.__editor.doc.entities.filter((e) => e.kind === 'prop' && blocking.test(e.model));
    return { onSpawn: ps.filter((e) => Math.hypot(e.position[0] + 20, e.position[2]) < 3).length, onRoute: ps.filter((e) => e.position[0] > -45 && e.position[0] < -5 && Math.abs(e.position[2] - 12) < 2.5).length };
  });
  check(s1.keptClear > 0 && clear.onSpawn === 0 && clear.onRoute === 0, `nothing that blocks play lands on the spawn or the route (${s1.keptClear} kept clear; ${JSON.stringify(clear)})`);
  await shot('brush');
  await page.keyboard.press('Control+KeyZ');
  const undone = await envCount();
  await page.keyboard.press('Control+KeyY');
  const redone = await envCount();
  check(undone === 0 && redone === painted.length && (await page.evaluate(() => window.__editor.history.undoLabel)) === 'Paint Temperate woods', `the whole stroke is one undo step (undo ${undone}, redo ${redone} of ${painted.length}; before it "${undoLabel0}")`);
  // Undo, then the same stroke with the same seed: the same plants (turns, sizes, variants and all).
  await page.keyboard.press('Control+KeyZ');
  await stroke([-30, -8], [-10, 4]);
  const again = await plants();
  check(again.length === painted.length && again.every((p, i) => p === painted[i]), `the same seed and stroke paint the same plants (${again.length} of ${painted.length} the same)`);

  // ---- Filters: on the 31° slope, oaks and maples (30° at most) stay off; the slope filter at 10° keeps everything off.
  await look(20, 0, 12);
  await page.fill('#ed-env-slope-max', '10');
  await page.dispatchEvent('#ed-env-slope-max', 'change');
  const beforeSlope = await envCount();
  await stroke([12, -6], [28, 6]);
  const s2 = await page.evaluate(() => window.__envStroke);
  check((await envCount()) === beforeSlope, `the slope filter (at most 10°) paints nothing on the hillside (${(await envCount()) - beforeSlope} painted)`);
  await page.fill('#ed-env-slope-max', '60');
  await page.dispatchEvent('#ed-env-slope-max', 'change');
  // Only stone: the brush paints the slope (pebbles, boulders and grass), never a broadleaf tree there.
  await page.evaluate(() => {
    if (!document.getElementById('ed-env-mat-stone').checked) document.getElementById('ed-env-mat-stone').click();
    for (const m of ['grass', 'dirt', 'sand', 'gravel', 'snow', 'moss', 'mud']) { const i = document.getElementById(`ed-env-mat-${m}`); if (i.checked) i.click(); }
  });
  await stroke([12, -6], [28, 6]);
  const slope = await page.evaluate(() => window.__editor.doc.entities.filter((e) => e.kind === 'prop' && e.model.startsWith('env.') && e.position[0] > 2 && e.position[0] < 38).map((e) => e.model));
  check(s2?.filtered > 0 && slope.length > 0 && !slope.some((m) => m.startsWith('env.broadleaf.')), `on the stone slope: ${slope.length} plants, no broadleaf trees (their 30° limit) (${[...new Set(slope)].join(', ')}; the 10° stroke: ${JSON.stringify(s2)})`);
  await page.selectOption('#ed-env-preset', 'alpine');
  await page.evaluate(() => { for (const m of ['grass', 'dirt', 'sand', 'gravel', 'snow', 'moss', 'mud']) { const i = document.getElementById(`ed-env-mat-${m}`); if (i && !i.checked) i.click(); } });
  await look(52, 0, 24);
  await stroke([44, -8], [60, 6]);
  await look(30, 0, 24);
  await frames(page, 4);
  await shot('hillside-top');
  if (shots) {
    // For the record (screenshots only): the whole hillside painted Alpine, seen at eye level from its foot.
    await page.fill('#ed-env-slope-max', '40');
    await page.dispatchEvent('#ed-env-slope-max', 'change');
    await page.evaluate(() => window.__editor.setBrushRadius(14));
    for (const z of [-24, -6, 12]) {
      await look(20, z, 12);
      await stroke([4, z], [36, z + 6]);
    }
    await page.evaluate(() => {
      const v = window.__editor.view;
      // From the flat south-west of the hill, looking up it (north-east), clear of the starter room.
      v.camera.position.set(-6, 1.7, -42);
      v.yaw = 0.6;
      v.pitch = 0.08;
      v.applyCamera();
    });
    await frames(page, 30);
    await page.evaluate(() => document.getElementById('ed-pal-toggle')?.click());
    await frames(page, 10);
    await shot('hillside-eye');
    await page.evaluate(() => document.getElementById('ed-pal-toggle')?.click());
    await page.evaluate(() => document.getElementById('ed-env-slope-max').scrollIntoView());
    await shot('filters');
  }

  // ---- Collision and nav preview: what blocks movement (red), shots (orange) and sight (blue), the zones (yellow).
  await page.check('#ed-env-blockers');
  await frames(page, 3);
  const overlay = await page.evaluate(() => { const m = window.__editor.view.scene.getMeshByName('envBlockers'); return m ? m.getTotalVertices() : 0; });
  check(overlay > 100, `Show what blocks draws the plants' collision footprints and the keep-clear zones (${overlay} vertices)`);
  await look(-15, 0);
  await frames(page, 3);
  await shot('blockers');
  await page.uncheck('#ed-env-blockers');

  // ---- One tree, placed with the prop tool: on the spawn it asks first (No: nothing placed; Yes: placed).
  await clickTool(page, '[data-tool="prop:env.broadleaf.oak"]');
  const onSpawn = await at(-20, 0, 0.5);
  await page.mouse.move(onSpawn.x, onSpawn.y);
  await frames(page, 2);
  const n0 = await envCount();
  answer = false;
  asked.length = 0;
  await page.mouse.click(onSpawn.x, onSpawn.y);
  await frames(page, 2);
  const refused = (await envCount()) === n0 && asked.some((m) => /Player Spawn/.test(m));
  answer = true;
  await page.mouse.click(onSpawn.x, onSpawn.y);
  await frames(page, 2);
  const placed = (await envCount()) === n0 + 1;
  const away = await at(-12, 0, -20);
  const askedOnSpawn = [...asked];
  const awayOk = await page.evaluate((p) => { const l = document.getElementById('ed-palette').getBoundingClientRect().right; const r = document.getElementById('ed-right').getBoundingClientRect().left; return p.x > l && p.x < r; }, away);
  asked.length = 0;
  await page.mouse.move(away.x, away.y);
  await page.mouse.click(away.x, away.y);
  await frames(page, 2);
  check(refused && placed && (await envCount()) === n0 + 2 && !asked.length, `a tree on the spawn asks first (No keeps it off, Yes places it); elsewhere it just places (${JSON.stringify({ refused, placed, askedOnSpawn, askedAway: asked, count: (await envCount()) - n0, awayOk })})`);
  await page.keyboard.press('Control+KeyZ');
  await page.keyboard.press('Control+KeyZ');

  // ---- Erase: Shift-drag with the brush takes the brush's species under it, in one undo step.
  await clickTool(page, '[data-tool="envbrush"]');
  await page.selectOption('#ed-env-preset', 'temperate');
  const n1 = await envCount();
  await stroke([-30, -8], [-10, 4], true);
  const n2 = await envCount();
  check(n2 < n1 && (await page.evaluate(() => window.__editor.history.undoLabel)) === 'Erase plants', `Shift-drag erases the brush's species (${n1} → ${n2})`);
  if (shots) {
    await page.click('#ed-env-mode-erase');
    const p = await at(-20, 0, -2);
    await page.mouse.move(p.x, p.y);
    await frames(page, 3);
    await shot('erase');
    await page.click('#ed-env-mode-paint');
  }
  await page.keyboard.press('Control+KeyZ');
  check((await envCount()) === n1, 'undo brings the erased stroke back');

  // ---- Round trip: Export, then Import the file: every plant exactly as it was.
  // (Compared key by key: the order of an object's keys is not part of the map.)
  const canon = () => page.evaluate(() => JSON.stringify(window.__editor.doc.entities.filter((e) => e.kind === 'prop').map((e) => Object.fromEntries(Object.entries(e).sort(([a], [b]) => (a < b ? -1 : 1))))));
  const before = await canon();
  // Export's own click, in the page: when the top bar is crowded its compact layout (fit-4) hides the File group's
  // later buttons, Export among them, and Playwright's click would wait for it to show.
  const [download] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => document.getElementById('ed-export').click())]);
  const text = readFileSync(await download.path(), 'utf8');
  await page.setInputFiles('#ed-import-file', { name: 'env.cmap.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await page.waitForFunction((n) => window.__editor.doc.entities.length === n && window.__editor.history.revision > 0, JSON.parse(before).length, { timeout: T(10000) }).catch(() => {});
  const after = await canon();
  const firstDiff = JSON.parse(after).findIndex((e, i) => JSON.stringify(e) !== JSON.stringify(JSON.parse(before)[i]));
  check(after === before, `Export then Import keeps every plant exactly (${JSON.parse(after).length} of ${JSON.parse(before).length} entities, ${after === before ? 'identical' : `first difference: ${JSON.stringify(JSON.parse(before)[firstDiff])} → ${JSON.stringify(JSON.parse(after)[firstDiff])}`})`);

  // ---- A big stroke (radius 40 m, dense) stays cheap: each dab's own work, and the frames while painting.
  await page.evaluate(() => window.__editor.setBrushRadius(40));
  await page.fill('#ed-env-density', '20');
  await page.dispatchEvent('#ed-env-density', 'change');
  await page.evaluate(() => { const v = window.__editor.view; v.focus({ x: -40, y: 0, z: 0 }); v.dolly(-90); });
  await frames(page, 2);
  // Twice: the first stroke also loads the species' models; the second (after an undo) is the brush and the redraw alone.
  const timed = async () => {
    await page.evaluate(() => {
      window.__envFrames = [];
      let last = performance.now();
      const tick = (t) => { window.__envFrames.push(t - last); last = t; if (window.__envFrames.length < 600) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
    await stroke([-55, -20], [-25, 20]);
    await frames(page, 5);
    return page.evaluate(() => { const f = window.__envFrames.slice(1).sort((a, b) => a - b); return { stroke: window.__envStroke, worst: f[f.length - 1], median: f[f.length >> 1], frames: f.length, count: window.__editor.doc.entities.length }; });
  };
  // The frames with nothing happening, for comparison (this machine's software renderer is slow with hundreds of trees in view).
  const idle = await page.evaluate(async () => { const f = []; let last = performance.now(); for (let i = 0; i < 20; i++) { const t = await new Promise(requestAnimationFrame); f.push(t - last); last = t; } f.sort((a, b) => a - b); return f[10]; });
  const cold = await timed();
  await page.keyboard.press('Control+KeyZ');
  await frames(page, 3);
  const big = await timed();
  check(big.stroke?.added > 150 && big.stroke.ms < T(400), `a 40 m stroke: ${big.stroke?.added} plants in ${big.stroke?.dabs} dabs, the slowest dab ${big.stroke?.ms.toFixed(0)} ms of brush work; frames while painting: median ${big.median.toFixed(0)} ms, slowest ${big.worst.toFixed(0)} ms (idle median ${idle.toFixed(0)} ms) (the first time, loading the models: ${cold.worst.toFixed(0)} ms) (${big.count} entities)`);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

/**
 * Map format v32's MapMaker half (the Iron Coast job): Terrain → Change grid (a preview of the vertices and the budget,
 * one undo step) on a 160 m terrain, and the coast border side chosen per side and drawn.
 */
async function editorTerrainGridChecks(browser) {
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 820 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  const shot = (name) => (process.env.E2E_SHOTS ? page.screenshot({ path: `${process.env.E2E_SHOTS}/editorux-${name}.png` }).catch(() => {}) : Promise.resolve());
  await page.goto(`${CLIENT}/?mode=editor&test=1`);
  await page.waitForFunction(() => window.__editor, null, { timeout: T(60000) });
  page.once('dialog', (d) => d.accept());
  await newMap(page, 160);
  // A cliff 8 m high across the north of the terrain (sculpted in one step), the beach south of it.
  const start = await page.evaluate(() => {
    const ed = window.__editor;
    const t = ed.doc.terrain;
    const heights = t.heights.map((h, i) => (t.origin[1] + Math.floor(i / t.cols) * t.spacing > -50 + 0.3 * (t.origin[0] + (i % t.cols) * t.spacing) ? 800 : h));
    ed.history.execute('Sculpt', { kind: 'setTerrain', before: t, after: { ...t, heights } });
    return { spacing: t.spacing, cols: t.cols, rows: t.rows };
  });
  await page.click('#ed-env-btn');
  await page.click('#ed-pal-tabs [data-ws="environment"][data-pane="terrain"]');
  await page.click('#ed-tr-grid');
  await page.waitForSelector('#ed-grid-dialog', { timeout: T(5000) });
  await page.selectOption('#ed-grid-spacing', '1');
  const preview = await page.evaluate(() => ({ after: document.getElementById('ed-grid-after').textContent, verts: document.getElementById('ed-grid-verts').textContent, size: document.getElementById('ed-grid-size').textContent, go: !document.getElementById('ed-grid-go').disabled }));
  check(preview.after === '1 m · 161 × 161' && /^25,921 \(×/.test(preview.verts) && /of 2 MB$/.test(preview.size) && preview.go, `Change grid previews the new grid, its vertices and the file against its budget (${JSON.stringify(preview)}; was ${start.cols} × ${start.rows} at ${start.spacing} m)`);
  await page.selectOption('#ed-grid-spacing', '1.5');
  const odd = await page.evaluate(() => document.getElementById('ed-grid-why').textContent);
  check(/whole number of 1\.5 m cells/.test(odd), `a spacing that doesn't divide the terrain says it changes its size (${odd})`);
  await page.selectOption('#ed-grid-spacing', '1');
  await shot('change-grid');
  const before = await page.evaluate(() => window.__editor.doc.terrain);
  await page.click('#ed-grid-go');
  await frames(page, 3);
  const after = await page.evaluate(() => {
    const t = window.__editor.doc.terrain;
    const grass = window.__editor.view.scene.meshes.find((m) => m.name === 'edmap_terrain_grass' && !m.isDisposed());
    return { spacing: t.spacing, cols: t.cols, rows: t.rows, heights: t.heights, cells: t.materials.length, label: document.getElementById('ed-tr-size').textContent, drawn: grass?.getTotalVertices() ?? 0, undo: window.__editor.history.undoLabel };
  });
  let same = true;
  for (let r = 0; r < before.rows; r++) for (let c = 0; c < before.cols; c++) if (after.heights[r * 2 * after.cols + c * 2] !== before.heights[r * before.cols + c]) same = false;
  check(after.spacing === 1 && after.cols === 161 && after.rows === 161 && after.cells === 160 * 160 && same, `Change grid resamples the terrain to 1 m, heights where the grids meet unchanged (${after.cols} × ${after.rows}, ${after.label})`);
  check(after.drawn >= 160 * 160 * 4 * 0.9 && after.undo === 'Change grid to 1 m', `the finer terrain is drawn, one undo step (${after.drawn} vertices, "${after.undo}")`);
  await page.keyboard.press('Control+KeyZ');
  const undone = await page.evaluate(() => window.__editor.doc.terrain);
  check(JSON.stringify(undone) === JSON.stringify(before), 'one undo puts the 2 m terrain back exactly');
  // The coast border: a choice per side (Sky, Border, Per side); the sea south, the coast east carrying the beach on.
  await page.click('#ed-pal-tabs [data-pane="sky"]');
  const mainHasCoast = await page.evaluate(() => [...document.querySelectorAll('#ed-bd-border option')].some((o) => o.value === 'coast'));
  await page.click('#ed-bd-border-sides summary');
  await page.selectOption('#ed-bd-border-south', 'water');
  // (The panel is drawn again from the new backdrop before the next side is set.)
  await page.waitForFunction(() => window.__editor.doc.backdrop?.borderSides?.south === 'water', null, { timeout: T(5000) }).catch(() => {});
  await frames(page, 3);
  await page.selectOption('#ed-bd-border-east', 'coast');
  await page.waitForFunction(() => window.__editor.view.scene.meshes.some((m) => m.name === 'border_coast' && !m.isDisposed()), null, { timeout: T(10000) }).catch(() => {});
  const coast = await page.evaluate(() => {
    const ed = window.__editor;
    const t = ed.doc.terrain;
    const x1 = t.origin[0] + (t.cols - 1) * t.spacing;
    const land = ed.view.scene.meshes.find((m) => m.name === 'border_coast' && !m.isDisposed());
    const sea = ed.view.scene.meshes.find((m) => m.name === 'border_coast_sea' && !m.isDisposed());
    land?.refreshBoundingInfo();
    const b = land?.getBoundingInfo().boundingBox;
    return { sides: ed.doc.backdrop?.borderSides, verts: land?.getTotalVertices() ?? 0, minX: b?.minimumWorld.x, x1, sea: !!sea, canopy: ed.view.scene.meshes.some((m) => m.name === 'border_canopy' && !m.isDisposed()) };
  });
  check(!mainHasCoast && coast.sides?.east === 'coast' && coast.sides?.south === 'water', `the coast is a per-side border choice (${JSON.stringify(coast.sides)})`);
  check(coast.verts > 500 && coast.minX >= coast.x1 - 1 && coast.sea && coast.canopy, `the coast is drawn past the east line: its land, the sea past the beach, forest inland (${JSON.stringify(coast)})`);
  await page.evaluate(([x, z]) => window.__editor.view.focus({ x, y: 0, z }), [coast.x1 + 10, -20]);
  await frames(page, 4);
  await shot('coast-border');
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

/**
 * MapMaker overhaul Phase 1 items 3 and 4 (docs/MAPMAKER_OVERHAUL_PLAN.md): the measure tool (U, the tool bar), props
 * dropped onto a table and the ground, and Randomise with the ghost showing what the click places. Screenshots go to
 * E2E_SHOTS when set.
 */
async function editorMeasureChecks(browser) {
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 820 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const shot = (name) => (process.env.E2E_SHOTS ? page.screenshot({ path: `${process.env.E2E_SHOTS}/editorux-${name}.png` }).catch(() => {}) : Promise.resolve());
  await page.goto(`${CLIENT}/?mode=editor&test=1`);
  await page.waitForFunction(() => window.__editor, null, { timeout: T(60000) });
  page.once('dialog', (d) => d.accept());
  await newMap(page);
  const doc = () => page.evaluate(() => window.__editor.doc);
  const at = (x, y, z) => page.evaluate(([x, y, z]) => window.__editor.view.project({ x, y, z }), [x, y, z]);
  // The pointer's hover follows once a frame: let it catch up before clicking.
  const hoverAt = async (x, y, z) => {
    const p = await at(x, y, z);
    await page.mouse.move(p.x, p.y);
    await frames(page, 3);
    return p;
  };
  const clickAt = async (x, y, z) => {
    const p = await hoverAt(x, y, z);
    await page.mouse.click(p.x, p.y);
    await frames(page, 3);
  };
  const focus = async (x, y, z) => {
    await page.evaluate(([x, y, z]) => window.__editor.view.focus({ x, y, z }), [x, y, z]);
    await page.waitForFunction(([x, y, z]) => {
      const p = window.__editor.view.project({ x, y, z });
      return Math.abs(p.x - innerWidth / 2) < innerWidth / 4 && Math.abs(p.y - innerHeight / 2) < innerHeight / 4;
    }, [x, y, z], { timeout: T(10000) }).catch(() => {});
    await frames(page, 3);
  };
  const props = async () => (await doc()).entities.filter((e) => e.kind === 'prop');
  await focus(0, 0, 0);

  // A table in the start room, then a crate dropped onto its top (0.8 m), not the floor under it.
  await clickTool(page, '[data-tool="prop:prop.table"]');
  await clickAt(0, 0, 1);
  const table = (await props()).find((e) => e.model === 'prop.table');
  check(table && table.position[1] === 0, `a table placed on the room's floor (${JSON.stringify(table?.position)})`);
  await clickTool(page, '[data-tool="prop:prop.crate_small"]');
  await hoverAt(0.3, 0.8, 1.2);
  const ghostY = await page.evaluate(() => window.__editor.view.scene.getNodeByName('propGhost')?.position.y);
  await clickAt(0.3, 0.8, 1.2);
  const crate = (await props()).find((e) => e.model === 'prop.crate_small');
  check(crate && Math.abs(crate.position[1] - 0.8) < 0.001 && Math.abs(ghostY - 0.8) < 0.001, `a prop dropped on the table sits on its top, as its ghost showed (crate ${JSON.stringify(crate?.position)}, ghost y ${ghostY})`);
  await page.mouse.move(10, 400);
  await shot('prop-on-table');

  // The measure tool: U and the tool bar; floor to the table's top (snapped to its middle), then a third point chains.
  await page.keyboard.press('KeyU');
  check(await page.evaluate(() => window.__editor.tool.kind === 'measure') && (await page.getAttribute('#ed-tb-measure', 'class')).includes('active') && (await page.textContent('#ed-toolhint')).includes('Measure'), 'U picks the measure tool, lit in the tool bar with its hint');
  const rev = await page.evaluate(() => window.__editor.history.revision);
  await clickAt(-2.2, 0, 2.6);
  await clickAt(0.6, 0.8, 0.8);
  const m1 = await page.evaluate(() => ({ points: window.__editor.measure.points.map((p) => p.at), labels: [...document.querySelectorAll('.ed-measure-label:not(.live)')].map((l) => l.textContent), status: document.getElementById('ed-target').textContent }));
  const [a, b] = m1.points;
  const dist = a && b ? Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) : 0;
  check(a && b && a.x === -2 && a.y === 0 && a.z === 2.5 && b.x === 0 && b.y === 0.8 && b.z === 1, `measure points snap to the grid on the floor and to the table top's middle (${JSON.stringify(m1.points)})`);
  check(m1.labels.length === 1 && m1.labels[0].startsWith(`${dist.toFixed(2)} m`) && /up 80 cm/.test(m1.labels[0]) && /jumpable/.test(m1.labels[0]) && /step 80 cm jumpable/.test(m1.status), `two points show the distance, the height difference, the slope and whether it's jumpable (${m1.labels.join(' | ')})`);
  await clickAt(2, 0, 2.5);
  const m2 = await page.evaluate(() => ({ n: window.__editor.measure.points.length, labels: [...document.querySelectorAll('.ed-measure-label:not(.live)')].map((l) => l.textContent), total: window.__editor.measure.measurement.total }));
  check(m2.n === 3 && m2.labels.length === 3 && m2.labels.at(-1) === `Total ${m2.total.toFixed(2)} m`, `a third click chains the path and shows its total (${m2.labels.join(' | ')})`);
  await page.mouse.move(700, 790);
  await frames(page, 3);
  await shot('measure');
  check((await page.evaluate(() => window.__editor.history.revision)) === rev && !JSON.stringify(await doc()).includes('measure'), 'measuring is editor-only: no edit, nothing in the map');
  // Ctrl: no snap.
  await page.keyboard.down('Control');
  await hoverAt(-1.37, 0, 2.21);
  const free = await page.evaluate(() => window.__editor.measure.hover);
  await page.keyboard.up('Control');
  check(free?.snapped === 'free' && Math.abs(free.at.x + 1.37) < 0.05, `with Ctrl the point follows the pointer, unsnapped (${JSON.stringify(free)})`);
  // It stays on screen with another tool, until Esc.
  await page.keyboard.press('KeyV');
  const kept = await page.$$eval('.ed-measure-label', (l) => l.map((x) => x.textContent));
  check(kept.length === 3, `the measurement stays on screen with another tool (${kept.join(' | ')})`);
  await page.keyboard.press('Escape');
  check((await page.$$('.ed-measure-label')).length === 0 && !(await page.evaluate(() => window.__editor.view.scene.getMeshByName('measureLines'))), 'Esc clears it');

  // Props on the ground: a terrain map, a barrel bedded into the ground under the pointer (not floating on the level).
  page.once('dialog', (d) => d.accept());
  await newMap(page, 96);
  await focus(20, 0, 20);
  await clickTool(page, '[data-tool="prop:prop.barrel"]');
  await hoverAt(20, 0, 20);
  await clickAt(20, 0, 20);
  const barrel = (await props())[0];
  // The terrain's height under the barrel (shared terrainHeightAt: the mesh's two triangles per square).
  const onTerrain = await page.evaluate((p) => {
    const t = window.__editor.doc.terrain;
    const y = (c, r) => t.baseY + (t.heights[r * t.cols + c] ?? 0) / 100;
    const fx = (p[0] - t.origin[0]) / t.spacing;
    const fz = (p[2] - t.origin[1]) / t.spacing;
    const c = Math.floor(fx);
    const r = Math.floor(fz);
    const u = fx - c;
    const v = fz - r;
    return v >= u ? y(c, r) + (y(c + 1, r + 1) - y(c, r + 1)) * u + (y(c, r + 1) - y(c, r)) * v : y(c, r) + (y(c + 1, r) - y(c, r)) * u + (y(c + 1, r + 1) - y(c + 1, r)) * v;
  }, barrel?.position);
  check(barrel && barrel.position[1] <= onTerrain + 0.001 && barrel.position[1] > onTerrain - 0.3, `a prop on the ground is bedded into it (y ${barrel?.position[1]}, ground ${onTerrain.toFixed(2)})`);

  // Randomise: off by default; on, each placement gets a turn and size, the ghost showing the next one exactly.
  check(!(await page.isChecked('#ed-prop-random')), 'Randomise is off by default');
  await page.click('#ed-prop-random');
  await page.selectOption('#ed-prop-random-size', '0.2');
  await page.evaluate(() => document.activeElement?.blur());
  await hoverAt(24, 0, 18);
  const ghost = await page.evaluate(() => {
    const n = window.__editor.view.scene.getNodeByName('propGhost');
    return n && { yaw: n.rotation.y, scale: n.scaling.x };
  });
  await clickAt(24, 0, 18);
  const first = (await props()).at(-1);
  check(ghost && first && Math.abs(first.yaw - ghost.yaw) < 1e-6 && Math.abs(first.scale - ghost.scale) < 1e-6 && (first.yaw !== 0 || first.scale !== 1), `the ghost shows the random turn and size the click places (ghost ${JSON.stringify(ghost)}, placed yaw ${first?.yaw}, scale ${first?.scale})`);
  for (const [x, z] of [[17, 18], [22, 15], [25, 22], [18, 23], [21, 25], [15, 20]]) await clickAt(x, 0, z);
  const scatter = (await props()).slice(-7);
  check(scatter.length === 7 && new Set(scatter.map((e) => e.yaw)).size === 7 && scatter.every((e) => e.scale >= 0.8 && e.scale <= 1.2), `a randomised scatter: every turn different, sizes within ±20 % (${scatter.map((e) => `${e.yaw}/${e.scale}`).join(', ')})`);
  await page.mouse.move(700, 790);
  await frames(page, 10);
  await shot('randomise');
  await page.click('#ed-prop-random');
  await measureRampCheck(page, { focus, clickAt, frames: (n) => frames(page, n), shot });
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

/**
 * The jump hint samples the ground along the line (owner, 2026-11-08): a 30° ramp of ground climbs 4.6 m over 8 m, which
 * its two ends alone call too high, but walking it there is no step: the measure tool says walkable.
 */
async function measureRampCheck(page, { focus, clickAt, frames, shot }) {
  await page.evaluate(() => {
    const ed = window.__editor;
    const before = ed.doc.terrain;
    const after = { ...before, heights: before.heights.slice() };
    for (let r = 0; r < after.rows; r++) {
      const z = after.origin[1] + r * after.spacing;
      if (z < -40 || z > -20) continue;
      for (let c = 0; c < after.cols; c++) {
        const x = after.origin[0] + c * after.spacing;
        if (x >= 28) after.heights[r * after.cols + c] = Math.round(Math.min(Math.max(x - 28, 0), 12) * Math.tan(Math.PI / 6) * 100);
      }
    }
    ed.history.execute('Ramp', { kind: 'setTerrain', before, after });
  });
  const ground = (x, z) =>
    page.evaluate(([x, z]) => {
      const t = window.__editor.doc.terrain;
      const y = (c, r) => t.baseY + (t.heights[r * t.cols + c] ?? 0) / 100;
      const fx = (x - t.origin[0]) / t.spacing;
      const fz = (z - t.origin[1]) / t.spacing;
      const c = Math.floor(fx);
      const r = Math.floor(fz);
      const u = fx - c;
      const v = fz - r;
      return v >= u ? y(c, r) + (y(c + 1, r + 1) - y(c, r + 1)) * u + (y(c, r + 1) - y(c, r)) * v : y(c, r) + (y(c + 1, r) - y(c, r)) * u + (y(c + 1, r + 1) - y(c + 1, r)) * v;
    }, [x, z]);
  await focus(34, 3, -30);
  await page.keyboard.press('KeyU');
  await clickAt(30, await ground(30, -30), -30);
  await clickAt(38, await ground(38, -30), -30);
  const m = await page.evaluate(() => ({ points: window.__editor.measure.points.map((p) => p.at), label: document.querySelector('.ed-measure-label:not(.live)')?.textContent ?? '', status: document.getElementById('ed-target').textContent }));
  const rise = m.points.length === 2 ? m.points[1].y - m.points[0].y : 0;
  check(rise > 4 && /walkable/.test(m.label) && /step walkable · no gap/.test(m.status), `a 30° ramp of ground reads walkable, sampled along the line, though its ends are ${rise.toFixed(2)} m apart in height (${m.label}; ${m.status})`);
  await page.mouse.move(700, 790);
  await frames(5);
  await shot('measure-ramp');
  await page.keyboard.press('Escape');
}

/**
 * MapMaker overhaul Phase 3 item 9 (docs/MAPMAKER_OVERHAUL_PLAN.md): turning by mouse. The rotate ring on the
 * selection gizmo turns a prop and a spawn by their own steps, shows the angle while dragging, Esc cancels a drag, a
 * drag is one undo step; the inspector's quick facings set the facing in one click (a tile's too). Screenshots go to
 * E2E_SHOTS when set.
 */
async function editorTurnChecks(browser) {
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 820 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const shot = (name) => (process.env.E2E_SHOTS ? page.screenshot({ path: `${process.env.E2E_SHOTS}/editorux-${name}.png` }).catch(() => {}) : Promise.resolve());
  await page.goto(`${CLIENT}/?mode=editor&test=1`);
  await page.waitForFunction(() => window.__editor, null, { timeout: T(60000) });
  page.once('dialog', (d) => d.accept());
  await newMap(page);
  const doc = () => page.evaluate(() => window.__editor.doc);
  const at = (x, y, z) => page.evaluate(([x, y, z]) => window.__editor.view.project({ x, y, z }), [x, y, z]);
  const yawOf = async (id) => (await doc()).entities.find((e) => e.id === id)?.yaw;
  const deg = (r) => Math.round((r * 180) / Math.PI);
  await page.evaluate(() => window.__editor.view.focus({ x: 12, y: 0, z: 4 }));
  await page.waitForFunction(() => {
    const p = window.__editor.view.project({ x: 12, y: 0, z: 4 });
    return Math.abs(p.x - innerWidth / 2) < innerWidth / 4 && Math.abs(p.y - innerHeight / 2) < innerHeight / 4;
  }, null, { timeout: T(10000) }).catch(() => {});
  await frames(page, 3);
  // A barrel and a spawn, placed with their tools.
  const place = async (tool, x, z) => {
    await clickTool(page, tool);
    const p = await at(x, 0, z);
    await page.mouse.move(p.x, p.y);
    await frames(page, 3);
    await page.mouse.click(p.x, p.y);
    await frames(page, 3);
    return page.evaluate(() => window.__editor.selection.entities[0]);
  };
  // On Platforms (the blank map has no ground there: over nothing they'd be refused).
  await clickTool(page, '[data-tool="tile:core.platform"]');
  for (const z of [0, 8]) {
    const p = await at(16, 0, z);
    await page.mouse.move(p.x, p.y);
    await frames(page, 3);
    await page.mouse.click(p.x, p.y);
    await frames(page, 3);
  }
  const barrel = await place('[data-tool="prop:prop.barrel"]', 12, 0);
  const spawn = await place('[data-tool="spawn"]', 12, 8);
  // A point on the ring of the selected thing at `centre`, facing `a` (radians; 0 is +Z, a quarter turn +X).
  const ringAt = async (centre, a) => {
    const r = await page.evaluate(() => window.__editor.ringRadius());
    return at(centre[0] + Math.sin(a) * r, centre[1], centre[2] + Math.cos(a) * r);
  };
  const select = async (id) => {
    await page.evaluate((id) => {
      window.__editor.setTool({ kind: 'select' });
      window.__editor.setSelection({ tiles: [], entities: [id] });
    }, id);
    await frames(page, 3);
  };
  /** Drag the ring from facing `from` to `to` (radians) round `centre`, through the facings between; `finish` lets go (or `esc` cancels first). */
  const dragRing = async (centre, from, to, { finish = true, esc = false, midShot = '' } = {}) => {
    const a = await ringAt(centre, from);
    await page.mouse.move(a.x, a.y);
    await frames(page, 3);
    const hot = await page.evaluate(() => window.__editor.ring.hot && /Drag the ring/.test(document.getElementById('ed-target').textContent));
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) {
      const p = await ringAt(centre, from + ((to - from) * i) / 6);
      await page.mouse.move(p.x, p.y, { steps: 2 });
    }
    await frames(page, 3);
    const mid = await page.evaluate(() => ({ label: document.getElementById('ed-ring-angle')?.hidden ? null : document.getElementById('ed-ring-angle')?.textContent, turn: window.__editor.ring.drag?.turn ?? null }));
    if (midShot) await shot(midShot);
    if (esc) await page.keyboard.press('Escape');
    if (finish) await page.mouse.up();
    await frames(page, 3);
    return { hot, ...mid };
  };

  // The barrel (a prop: 15° steps): from the south (180°) round to the east (90°) is -90°.
  await select(barrel);
  check(await page.evaluate(() => !!window.__editor.view.scene.getMeshByName('gizmoRing')), 'a selected prop has the rotate ring on its gizmo');
  const rev0 = await page.evaluate(() => window.__editor.history.revision);
  const d1 = await dragRing([12, 0, 0], Math.PI, Math.PI / 2 + 0.03, { midShot: 'rotate-ring' });
  check(d1.hot && d1.label === '-90°', `the ring lights under the pointer and shows the angle while dragging (${JSON.stringify(d1)})`);
  check(Math.abs((await yawOf(barrel)) + Math.PI / 2) < 0.002 && (await page.evaluate(() => window.__editor.history.revision)) === rev0 + 1, `letting go turns the prop -90°, one edit (yaw ${await yawOf(barrel)})`);
  await page.keyboard.press('Control+KeyZ');
  check((await yawOf(barrel)) === 0, 'one undo takes the whole drag back');
  // 20° of drag snaps to the prop's 15° step; with Shift, to its 5° step.
  await dragRing([12, 0, 0], 0, (20 * Math.PI) / 180);
  check(deg(await yawOf(barrel)) === 15, `a prop snaps to its 15° step (${deg(await yawOf(barrel))}°)`);
  await page.keyboard.down('Shift');
  await dragRing([12, 0, 0], 0, (22 * Math.PI) / 180);
  await page.keyboard.up('Shift');
  check(deg(await yawOf(barrel)) === 35, `with Shift, the finer 5° step (${deg(await yawOf(barrel))}°)`);
  // Esc cancels a drag: nothing turns.
  const before = await yawOf(barrel);
  const esc = await dragRing([12, 0, 0], 0, Math.PI / 2, { esc: true });
  check(esc.turn !== 0 && (await yawOf(barrel)) === before && !(await page.isVisible('#ed-ring-angle')), `Esc cancels the drag: no turn (${esc.label}, yaw ${await yawOf(barrel)})`);

  // The spawn (45° steps): about 50° of drag turns it 45°.
  await select(spawn);
  const s0 = await yawOf(spawn);
  await dragRing([12, 0, 8], 0, (50 * Math.PI) / 180);
  check(deg((await yawOf(spawn)) - s0) === 45, `a spawn snaps to its 45° step (${deg((await yawOf(spawn)) - s0)}°)`);

  // Quick facings: one click each, one undo step; the current one lit.
  await page.click('#ed-inspector .ed-quick-facings [data-facing="180"]');
  await frames(page, 2);
  check(Math.abs(Math.abs(await yawOf(spawn)) - Math.PI) < 0.002 && (await page.getAttribute('#ed-inspector .ed-quick-facings [data-facing="180"]', 'class'))?.includes('active'), `the 180° quick facing turns the spawn round and lights (${await yawOf(spawn)})`);
  await page.mouse.move(700, 790);
  await shot('quick-facings');
  await page.keyboard.press('Control+KeyZ');
  check(deg(await yawOf(spawn)) === deg(s0) + 45, 'one undo puts the spawn back');
  // A tile: the start room faces 90° in one click (quarter turns only, in place).
  const room = (await doc()).classicStructure.tiles[0];
  await page.evaluate((id) => window.__editor.setSelection({ tiles: [id], entities: [] }), room.id);
  await frames(page, 2);
  await page.click('#ed-inspector .ed-quick-facings [data-facing="90"]');
  const turned = (await doc()).classicStructure.tiles.find((t) => t.id === room.id);
  check(turned?.rotation === 1 && turned.x === room.x && turned.y === room.y, `a tile's quick facing turns it to 90° in place (${JSON.stringify(turned && [turned.x, turned.y, turned.rotation])})`);
  await page.keyboard.press('Control+KeyZ');
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

/**
 * MapMaker overhaul Phase 3 part A (docs/MAPMAKER_OVERHAUL_PLAN.md, items 1, 2 and 8): Play from here (Shift+F5)
 * starts you at the camera spot and Esc comes back with the view, the selection and undo as they were; the plan view
 * (K) toggles, selects and moves things, and exports a PNG; the card shot is framed at eye level, saved as the map's
 * camera (one undo step) and previewed in the card's frame. Screenshots go to E2E_SHOTS when set.
 */
async function editorWorkflowChecks(browser) {
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 820 }, acceptDownloads: true })).newPage();
  livePages.add(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const shot = (name) => (process.env.E2E_SHOTS ? page.screenshot({ path: `${process.env.E2E_SHOTS}/editorux-${name}.png` }).catch(() => {}) : Promise.resolve());
  await page.goto(`${CLIENT}/?mode=editor&test=1`);
  await page.waitForFunction(() => window.__editor, null, { timeout: T(60000) });
  page.once('dialog', (d) => d.accept());
  await newMap(page, 96);
  const doc = () => page.evaluate(() => window.__editor.doc);
  const at = (x, y, z) => page.evaluate(([x, y, z]) => window.__editor.view.project({ x, y, z }), [x, y, z]);
  const camera = () => page.evaluate(() => {
    const v = window.__editor.view;
    const p = v.camera.position;
    return { x: +p.x.toFixed(3), y: +p.y.toFixed(3), z: +p.z.toFixed(3), yaw: +v.yaw.toFixed(4), pitch: +v.pitch.toFixed(4), fov: +v.camera.fov.toFixed(4), mode: v.camera.mode };
  });
  const setCamera = (x, y, z, yaw, pitch) =>
    page.evaluate(([x, y, z, yaw, pitch]) => {
      const v = window.__editor.view;
      v.camera.position.set(x, y, z);
      v.yaw = yaw;
      v.pitch = pitch;
      v.applyCamera();
    }, [x, y, z, yaw, pitch]);
  await page.evaluate(() => window.__editor.view.focus({ x: 12, y: 0, z: 4 }));
  await frames(page, 3);
  // A barrel out on the ground, placed with its tool (an edit to undo later), and selected.
  await clickTool(page, '[data-tool="prop:prop.barrel"]');
  const bp = await at(12, 0, 0);
  await page.mouse.move(bp.x, bp.y);
  await frames(page, 3);
  await page.mouse.click(bp.x, bp.y);
  await frames(page, 3);
  const barrel = await page.evaluate(() => window.__editor.selection.entities[0]);
  await page.evaluate((id) => {
    window.__editor.setTool({ kind: 'select' });
    window.__editor.setSelection({ tiles: [], entities: [id] });
  }, barrel);

  // ---- Play from here: out on the open ground south-west of the room, looking north-east.
  await setCamera(-14, 9, -16, Math.PI / 4, -0.25);
  await frames(page, 2);
  const before = { cam: await camera(), rev: await page.evaluate(() => window.__editor.history.revision), sel: await page.evaluate(() => JSON.stringify(window.__editor.selection)) };
  check(await page.isVisible('#ed-test-here'), 'the top bar has ▶ Here (Play from here) beside PLAY TEST');
  await page.keyboard.press('Shift+F5');
  const started = await page.waitForFunction(() => window.__cs?.local && window.__testStartMs, null, { timeout: T(30000) }).then(() => true, () => false);
  const me = started ? await sim(page, (m, me) => ({ x: me.move.pos.x, y: me.move.pos.y, z: me.move.pos.z, yaw: me.yaw, pitch: me.pitch })).catch((e) => String(e)) : null;
  check(started && Math.abs(me.x + 14) < 0.3 && Math.abs(me.z + 16) < 0.3 && Math.abs(me.y) < 0.6 && Math.abs(me.yaw - Math.PI / 4) < 0.01 && Math.abs(me.pitch + 0.25) < 0.01, `Shift+F5 starts a test match standing on the ground under the camera, facing its way (${JSON.stringify(me)})`);
  const room = await sim(page, (m) => m.spawnPoints.map((s) => [Math.round(s.pos.x), Math.round(s.pos.z)])).catch(() => []);
  check(room.every(([x, z]) => Math.hypot(x + 14, z + 16) > 6), `not at the map's spawn point (${JSON.stringify(room)})`);
  await frames(page, 10);
  // The view as you play it (headless pages have no pointer lock, so the pause menu is up: hidden for the picture).
  await page.addStyleTag({ content: '#pause { visibility: hidden !important; }' }).then((h) => shot('play-from-here').then(() => h.evaluate((el) => el.remove())));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.getElementById('editor').hidden, null, { timeout: T(15000) });
  await frames(page, 2);
  const back = { cam: await camera(), rev: await page.evaluate(() => window.__editor.history.revision), sel: await page.evaluate(() => JSON.stringify(window.__editor.selection)) };
  check(JSON.stringify(back) === JSON.stringify(before), `Esc goes back to MapMaker at the same view, with the selection and history as they were (${JSON.stringify(back.cam)})`);
  await page.keyboard.press('Control+KeyZ');
  check(!(await doc()).entities.some((e) => e.id === barrel), 'undo still works after Play from here (the barrel goes)');
  await page.keyboard.press('Control+KeyY');
  // Refused, with the reason: the camera outside the map's boundary.
  await page.evaluate(() => window.__editor.run('Boundary', { kind: 'setBounds', before: null, after: { min: [-30, -30], max: [30, 30], style: 'invisible', height: 8 } }));
  await setCamera(45, 6, 0, 0, -0.2);
  await page.click('#ed-test-here');
  await frames(page, 2);
  const refused = await page.evaluate(() => ({ toast: document.getElementById('ed-toast').textContent, editor: !document.getElementById('editor').hidden, err: document.getElementById('ed-toast').classList.contains('err') }));
  check(refused.editor && refused.err && /Can't play from here: .*outside the playable boundary/.test(refused.toast), `outside the boundary it refuses, saying why (${refused.toast})`);
  await page.keyboard.press('Control+KeyZ');

  // ---- The plan view: K, from straight above, the level's tiles and icons, select and move, PNG.
  await page.evaluate(() => window.__editor.run('Flag', { kind: 'addEntities', entities: [{ id: 'flag_e2e', kind: 'flag', position: [-8, 0, 8], yaw: 0, team: 'embers' }, { id: 'hill_e2e', kind: 'hill', position: [8, 0, -10], radius: 5 }, { id: 'pick_e2e', kind: 'pickup', position: [-6, 0, -8], item: 'core.health', respawnSeconds: null }] }));
  const view3d = await camera();
  await page.mouse.move(700, 400);
  await page.keyboard.press('KeyK');
  await frames(page, 3);
  const plan = await page.evaluate(() => ({ on: window.__editor.plan.on, mode: window.__editor.view.camera.mode, pressed: document.getElementById('ed-plan').getAttribute('aria-pressed'), title: document.getElementById('ed-plan-title')?.textContent, overlay: !!document.getElementById('ed-plan-overlay'), clip: !!window.__editor.view.scene.clipPlane }));
  check(plan.on && plan.mode === 1 && plan.pressed === 'true' && plan.title === 'Plan · Ground' && plan.overlay && plan.clip, `K switches to the plan view: an orthographic camera from above, cut above the floor, its icons over it (${JSON.stringify(plan)})`);
  // North is up and east is right on screen.
  const n = await at(0, 0, 10);
  const s = await at(0, 0, -10);
  const e = await at(10, 0, 0);
  const c0 = await at(0, 0, 0);
  check(n.y < s.y && e.x > c0.x && Math.abs(n.x - s.x) < 1, `north is up, east to the right (${JSON.stringify({ n, s, e })})`);
  await shot('plan-view');
  // Select the barrel by clicking it in the plan, drag it 4 m east, undo.
  await page.evaluate(() => window.__editor.setSelection({ tiles: [], entities: [] }));
  const bpos = (await doc()).entities.find((x) => x.id === barrel).position;
  const p0 = await at(bpos[0], bpos[1] + 0.5, bpos[2]);
  await page.mouse.move(p0.x, p0.y);
  await frames(page, 3);
  await page.mouse.click(p0.x, p0.y);
  await frames(page, 2);
  check((await page.evaluate(() => window.__editor.selection.entities)).includes(barrel), 'a click in the plan selects the barrel');
  const p1 = await at(bpos[0] + 4, bpos[1] + 0.5, bpos[2]);
  await page.mouse.move(p0.x, p0.y);
  await page.mouse.down();
  await page.mouse.move((p0.x + p1.x) / 2, p0.y, { steps: 4 });
  await page.mouse.move(p1.x, p1.y, { steps: 4 });
  await frames(page, 2);
  await page.mouse.up();
  await frames(page, 2);
  const moved = (await doc()).entities.find((x) => x.id === barrel).position;
  check(Math.abs(moved[0] - bpos[0] - 4) < 0.6 && Math.abs(moved[2] - bpos[2]) < 0.6, `dragging it in the plan moves it east (${JSON.stringify(bpos)} → ${JSON.stringify(moved)})`);
  await page.keyboard.press('Control+KeyZ');
  // Another level: the level selector picks the plan.
  await page.keyboard.press('PageUp');
  await frames(page, 2);
  const up = await page.evaluate(() => ({ title: document.getElementById('ed-plan-title')?.textContent, cut: window.__editor.plan.cutY }));
  check(up.title === 'Plan · Level 1' && up.cut > 4, `PgUp shows Level 1's plan, cut above its floor (${JSON.stringify(up)})`);
  await page.keyboard.press('PageDown');
  await frames(page, 2);
  // Export PNG: through the browser's download.
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: T(20000) }).catch(() => null), page.click('#ed-plan-export')]);
  const file = download ? await download.path().catch(() => null) : null;
  const png = file ? readFileSync(file) : null;
  if (png && process.env.E2E_SHOTS) writeFileSync(`${process.env.E2E_SHOTS}/editorux-plan-export.png`, png);
  check(download?.suggestedFilename() === 'untitled_map-ground-plan.png' && png && png.subarray(1, 4).toString() === 'PNG' && png.length > 20000, `Export PNG downloads the plan (${download?.suggestedFilename()}, ${png?.length ?? 0} bytes)`);
  await page.click('#ed-plan');
  await frames(page, 2);
  const after = await camera();
  check(!(await page.evaluate(() => window.__editor.plan.on || !!document.getElementById('ed-plan-overlay') || !!window.__editor.view.scene.clipPlane)) && JSON.stringify(after) === JSON.stringify(view3d), `the Plan button goes back to the 3D view as it was (${JSON.stringify(after)})`);

  // ---- The card shot: Map properties → Set card shot…, eye level by default, Enter saves; Preview in the frame.
  await page.evaluate(() => window.__editor.setSelection({ tiles: [], entities: [] }));
  await page.waitForSelector('#ed-card-set', { timeout: T(5000) });
  check(await page.isDisabled('#ed-card-preview'), 'no card camera yet: Preview is off');
  await setCamera(-10, 12, -18, 0.6, -0.15);
  const fov0 = (await camera()).fov;
  await page.click('#ed-card-set');
  await frames(page, 3);
  const framing = await page.evaluate(() => ({ eye: document.getElementById('ed-card-eye')?.checked, crop: document.querySelector('.ed-card-crop')?.getBoundingClientRect().toJSON(), y: window.__editor.view.camera.position.y, fov: window.__editor.view.camera.fov, ground: window.__editor.shownGround ? null : 'none' }));
  const ratio = framing.crop ? framing.crop.width / framing.crop.height : 0;
  check(framing.eye && Math.abs(ratio - 16 / 9) < 0.02 && Math.abs(framing.y - (-0.15 + 1.7)) < 0.15 && framing.fov > 0.9, `the card frame is 16:9 with the card's lens, and the camera drops to eye level, 1.7 m over the ground (${JSON.stringify(framing)})`);
  await shot('card-frame');
  await page.keyboard.press('Enter');
  await frames(page, 2);
  const saved = (await doc()).metadata.cardCamera;
  check(saved && Math.abs(saved.position[1] - 1.55) < 0.15 && Math.abs(saved.yaw - 0.6) < 0.001 && Math.abs(saved.pitch + 0.15) < 0.001 && (await camera()).fov === fov0, `Enter saves the card camera in the map at eye level, and the lens goes back (${JSON.stringify(saved)})`);
  check((await doc()).formatVersion >= 30, "the map is format v30 or later");
  await page.keyboard.press('Control+KeyZ');
  check((await doc()).metadata.cardCamera === undefined, 'one undo takes the card camera off');
  await page.keyboard.press('Control+KeyY');
  // Preview: from somewhere else, the saved shot in the card's frame; Esc goes back.
  await setCamera(20, 30, 20, 2, -0.8);
  const elsewhere = await camera();
  await page.waitForSelector('#ed-card-preview:not([disabled])', { timeout: T(5000) });
  await page.click('#ed-card-preview');
  await frames(page, 3);
  const pv = await camera();
  check(Math.abs(pv.x - saved.position[0]) < 0.01 && Math.abs(pv.y - saved.position[1]) < 0.01 && Math.abs(pv.yaw - saved.yaw) < 0.001 && (await page.isVisible('.ed-card-frame.preview .ed-card-crop')), `Preview shows the saved shot in the card's frame (${JSON.stringify(pv)})`);
  await shot('card-preview');
  await page.keyboard.press('Escape');
  await frames(page, 2);
  check(JSON.stringify(await camera()) === JSON.stringify(elsewhere) && !(await page.$('.ed-card-frame')), 'Esc closes the preview, back where you were');
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  livePages.delete(page);
  await page.context().close();
}

/**
 * MapMaker overhaul Phase 1, part A (docs/MAPMAKER_OVERHAUL_PLAN.md): the ghost says why it's refused, beside the
 * pointer; the live budget bar changes on an edit and on undo, goes amber near a budget and selects what it counts; `?`
 * (and the tool bar's Keys button) opens every key, grouped, and Esc or `?` closes it.
 */
async function editorPhase1aChecks(page, { doc, at, clickAt, settle, shot }) {
  await page.evaluate(() => window.__editor.view.focus({ x: 0, y: 0, z: -16 }));
  await settle();
  // The ghost says why: a corridor over a corridor is refused, and the note beside the pointer names it and its level.
  await clickTool(page, '[data-tool="tile:core.corridor"]');
  await clickAt(-8, 0, -16);
  const placed = (await doc()).classicStructure.tiles.some((t) => t.x === -1 && t.y === -2 && t.z === 0);
  const p = await at(-8, 0, -16);
  await page.mouse.move(p.x + 3, p.y + 2);
  await settle();
  const why = await page.evaluate(() => ({ cls: document.getElementById('ed-tip').className, text: document.getElementById('ed-tip').textContent, shown: !document.getElementById('ed-tip').hidden, status: document.getElementById('ed-target').textContent, ghost: window.__editor.tileGhostAt?.check }));
  check(placed && why.shown && /tone-bad/.test(why.cls) && why.text.includes('Overlaps the Corridor on Ground') && /^Overlaps Corridor on Ground: pick a free cell/.test(why.status), `a refused ghost says why beside the pointer (${why.text}; ${why.status.slice(0, 60)})`);
  await shot('ghost-why');
  // Past the build limit (a level past the top).
  const limit = await page.evaluate(() => {
    const ed = window.__editor;
    const c = ed.tileGhost('core.corridor', [0, 0, 17]);
    return c.ok ? '' : c.short;
  });
  check(limit === 'Past the build limit (16 levels up or down)', `the ghost names the build limit (${limit})`);
  // A spawn over nothing (up on Level 1, the ground 4 m below): refused (owner, 2026-11-08). The ghost goes red with
  // its reason, and the click places nothing.
  await page.evaluate(() => {
    window.__editor.setTool({ kind: 'spawn' });
    window.__editor.setLevel(1);
  });
  await settle();
  const off = await at(32, 4, -16);
  await page.mouse.move(off.x, off.y);
  await settle();
  // A ghost's meshes (a prop's model loads in after its node is made) and whether they're all tinted red.
  const ghostState = async (name, red = false) => {
    const read = (name) => {
      const n = window.__editor.view.scene.getNodeByName(name);
      const meshes = n ? [n, ...n.getChildMeshes()].filter((m) => 'renderOverlay' in m && m.getTotalVertices?.() > 0) : [];
      return { shown: !!n?.isEnabled(), meshes: meshes.length, red: meshes.length > 0 && meshes.every((m) => m.renderOverlay) };
    };
    await page.waitForFunction((name) => {
      const n = window.__editor.view.scene.getNodeByName(name);
      return !!n && n.getChildMeshes().concat([n]).some((m) => m.getTotalVertices?.() > 0);
    }, name, { timeout: T(15000) }).catch(() => {});
    // The tint follows on the next frame drawn (EditorView seeThrough).
    await page.waitForFunction(([name, red]) => {
      const n = window.__editor.view.scene.getNodeByName(name);
      const meshes = n ? [n, ...n.getChildMeshes()].filter((m) => 'renderOverlay' in m && m.getTotalVertices?.() > 0) : [];
      return meshes.length > 0 && meshes.every((m) => m.renderOverlay === red);
    }, [name, red], { timeout: T(5000) }).catch(() => {});
    await frames(page, 3);
    return page.evaluate(read, name);
  };
  const spawnWhy = await page.evaluate(() => ({ cls: document.getElementById('ed-tip').className, text: document.getElementById('ed-tip').textContent, shown: !document.getElementById('ed-tip').hidden, onTerrain: window.__editor.hoverOnTerrain, status: document.getElementById('ed-target').textContent }));
  const spawnGhost = await ghostState('spawn_ghost', true);
  check(!spawnWhy.onTerrain && spawnWhy.shown && /tone-bad/.test(spawnWhy.cls) && spawnWhy.text.includes('✗ No floor under it') && spawnWhy.text.includes("Can't be placed here") && /^Spawn point can't be placed here: no floor under it/.test(spawnWhy.status) && spawnGhost.shown && spawnGhost.red, `a spawn over nothing is refused: a red ghost, "No floor under it" beside the pointer and on the status line (${JSON.stringify(spawnWhy)}; ghost ${JSON.stringify(spawnGhost)})`);
  await shot('spawn-why');
  const spawnsBefore = (await doc()).entities.filter((e) => e.kind === 'spawn').length;
  const revBefore = await page.evaluate(() => window.__editor.history.revision);
  await page.mouse.click(off.x, off.y);
  await settle();
  const spawnsAfter = (await doc()).entities.filter((e) => e.kind === 'spawn').length;
  check(spawnsAfter === spawnsBefore && (await page.evaluate(() => window.__editor.history.revision)) === revBefore, `the click over nothing places no spawn (${spawnsBefore} → ${spawnsAfter})`);
  // A prop over nothing the same way; over the ground on Ground its ghost is its own colour again.
  await page.evaluate(() => {
    window.__editor.setTool({ kind: 'prop', model: 'prop.barrel' });
    window.__editor.setLevel(1);
  });
  await settle();
  // Nearer the middle of the view (the spawn's spot can be under the right-hand panel).
  const offProp = await at(6, 4, -20);
  await page.mouse.move(off.x, off.y);
  await settle();
  await page.mouse.move(offProp.x, offProp.y);
  await settle();
  const propGhost = await ghostState('propGhost', true);
  const propWhy = await page.evaluate((p) => ({ under: document.elementFromPoint(p.x, p.y)?.id, level: window.__editor.level, tip: document.getElementById('ed-tip').textContent, status: document.getElementById('ed-target').textContent }), offProp);
  const propsBefore = (await doc()).entities.filter((e) => e.kind === 'prop').length;
  await page.mouse.click(offProp.x, offProp.y);
  await settle();
  const propsAfter = (await doc()).entities.filter((e) => e.kind === 'prop').length;
  check(propGhost.shown && propGhost.red && propsAfter === propsBefore, `a prop over nothing: a red ghost and no placement (${JSON.stringify(propGhost)}; ${JSON.stringify(propWhy)}; props ${propsBefore} → ${propsAfter})`);
  await shot('prop-refused');
  await page.evaluate(() => window.__editor.setLevel(0));
  await settle();
  const onFloor = await at(0, 0, -16);
  await page.mouse.move(onFloor.x, onFloor.y);
  await settle();
  const okGhost = await ghostState('propGhost');
  check(okGhost.shown && !okGhost.red, `over a floor the ghost is its own colour again (${JSON.stringify(okGhost)})`);
  await page.evaluate(() => window.__editor.setTool({ kind: 'select' }));

  // The live budget bar: Props goes up by one with a prop and back with undo.
  const bar = () =>
    page.evaluate(() => {
      const el = document.getElementById('ed-budget');
      const row = (id) => document.querySelector(`#ed-budget-rows [data-budget="${id}"]`)?.closest('.ed-budget-row');
      const r = el?.getBoundingClientRect();
      const bottom = document.getElementById('ed-bottom').getBoundingClientRect();
      const inBar = el?.parentElement?.id === 'ed-bottom' && !!r && r.top >= bottom.top - 0.5 && r.bottom <= bottom.bottom + 0.5 && r.height <= 28;
      return { inBar, level: el?.dataset.level, sum: el?.querySelector('.ed-budget-sum')?.textContent ?? '', props: row('props')?.querySelector('.ed-budget-amt')?.textContent ?? '', lights: row('lights')?.querySelector('.ed-budget-amt')?.textContent ?? '', lightsWord: row('lights')?.querySelector('.ed-budget-word')?.textContent ?? '' };
    });
  const b0 = await bar();
  await clickTool(page, '[data-tool="prop:prop.barrel"]');
  await clickAt(0, 0, -24);
  await settle();
  const b1 = await bar();
  await page.evaluate(() => window.__editor.setTool({ kind: 'select' }));
  await page.keyboard.press('Control+KeyZ');
  await settle();
  const b2 = await bar();
  const n = (t) => Number(t.split('/')[0].replace(/[^0-9]/g, ''));
  check(n(b1.props) === n(b0.props) + 1 && b2.props === b0.props && /Budget OK/i.test(b0.sum), `the budget bar counts a placed prop and its undo (${b0.props} → ${b1.props} → ${b2.props}; ${b0.sum})`);
  check(b0.inBar, 'the budget bar sits in the bottom status bar, compact (owner, 2026-11-08)');
  // Near a budget: 220 of 256 lights goes amber, names Lights, and clicking the name selects them.
  await page.evaluate(() => {
    const ed = window.__editor;
    const lights = Array.from({ length: 220 }, (_, i) => ({ id: `light_e2e_${i}`, kind: 'light', position: [(i % 20) * 2 - 20, 3, Math.floor(i / 20) * 2 - 30], yaw: 0, color: '#ffd9a0', intensity: 1, range: 6, fixture: 'ceiling' }));
    ed.history.execute('Lights', { kind: 'addEntities', entities: lights });
  });
  await settle();
  const near = await bar();
  await page.click('#ed-budget-toggle');
  await settle();
  await shot('budget-near');
  await page.click('#ed-budget .ed-budget-sum [data-budget="lights"]');
  await settle();
  const selected = await page.evaluate(() => window.__editor.selection.entities.filter((id) => id.startsWith('light_e2e_')).length);
  check(near.level === 'near' && /Near:\s*Lights/.test(near.sum) && near.lightsWord === 'Near' && selected === 220, `220 lights: the bar goes amber with its word, names Lights, and selects them (${near.sum}; ${selected} selected)`);
  await page.click('#ed-budget-toggle');
  await page.evaluate(() => window.__editor.setSelection({ tiles: [], entities: [] }));
  await page.keyboard.press('Control+KeyZ');
  await settle();
  check((await bar()).level === 'ok', 'undo takes the bar back to OK');

  // `?`: every key, grouped, from the key table; Esc and `?` close it; so does the tool bar's Keys button open it.
  await page.mouse.move(5, 400);
  await page.keyboard.press('Shift+Slash');
  await settle();
  const keys = await page.evaluate(() => ({ open: document.getElementById('ed-keys')?.open, rows: [...document.querySelectorAll('#ed-keys .ed-keys-row dt')].map((d) => d.textContent), groups: [...document.querySelectorAll('#ed-keys h3')].map((h) => h.textContent) }));
  const has = (k) => keys.rows.includes(k);
  check(keys.open && has('R') && has('Ctrl+Z') && ['V', 'P', 'X', 'B', 'O', 'T', 'G', 'N', 'U', 'Esc'].every(has) && keys.groups.includes('Tools'), `? opens the key list with R, Ctrl+Z and the tool keys (${keys.rows.length} rows; ${keys.groups.join(', ')})`);
  await shot('keys');
  await page.keyboard.press('Escape');
  await settle();
  const afterEsc = await page.evaluate(() => ({ open: document.getElementById('ed-keys')?.open, tool: window.__editor.tool.kind }));
  await page.click('#ed-tb-keys');
  await settle();
  const byButton = await page.evaluate(() => document.getElementById('ed-keys')?.open);
  await page.keyboard.press('Shift+Slash');
  await settle();
  const afterQ = await page.evaluate(() => document.getElementById('ed-keys')?.open);
  check(!afterEsc.open && byButton && !afterQ, `Esc closes it, the Keys button opens it, ? closes it (${JSON.stringify({ afterEsc, byButton, afterQ })})`);
  // / still searches the palette.
  await page.keyboard.press('Slash');
  check(await page.evaluate(() => document.activeElement?.id === 'ed-search'), '/ still searches the palette');
  await page.evaluate(() => document.activeElement?.blur());
}

/**
 * MapMaker's set pieces (docs/SET_PIECES_PLAN.md, "As built: part 2"): the Set pieces tab, placing with the ghost (and
 * its refusal, with the reason), turning and mirroring (and a piece that can't be), selecting one as one, moving it and
 * undoing, Explode and undo, Save selection as set piece with Export and Import, and a port facing a wall. Not the
 * `setpieces` flow (Sky Islands' crumbling stones and trapdoors). Screenshots go to E2E_SHOTS when set.
 */
async function editorSetPieceChecks(browser) {
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 820 }, acceptDownloads: true })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  page.on('dialog', (d) => d.accept());
  const shot = (name) => (process.env.E2E_SHOTS ? page.screenshot({ path: `${process.env.E2E_SHOTS}/setpieces-${name}.png` }).catch(() => {}) : Promise.resolve());
  await page.goto(`${CLIENT}/?mode=editor&test=1`);
  await page.waitForFunction(() => window.__editor, null, { timeout: T(60000) });
  await page.evaluate(() => localStorage.removeItem('cs.setpieces'));
  await newMap(page);
  await page.evaluate(() => window.__editor.view.focus({ x: 12, y: 0, z: 8 }));
  const settle = () => frames(page, 3);
  await settle();
  const at = (x, y, z) => page.evaluate(([x, y, z]) => window.__editor.view.project({ x, y, z }), [x, y, z]);
  const hover = async (x, y, z) => {
    const p = await at(x, y, z);
    await page.mouse.move(p.x, p.y);
    await settle();
    return p;
  };
  const doc = () => page.evaluate(() => window.__editor.doc);
  const ghost = () => page.evaluate(() => {
    const g = window.__editor.pieceHover;
    const node = window.__editor.view.scene.getTransformNodeByName('pieceGhost');
    const meshes = node?.getChildMeshes() ?? [];
    return g && { ok: g.ok, reason: g.reason, blocked: g.blocked, at: [g.placement.x, g.placement.y, g.placement.z], rotation: g.placement.rotation, mirror: g.placement.mirror, pack: g.placement.pack ?? null, shown: !!node?.isEnabled() && meshes.length > 0, seeThrough: meshes.length > 0 && meshes.every((m) => m.visibility < 1 && !m.isPickable), tip: document.getElementById('ed-tip').className, tipText: document.getElementById('ed-tip').textContent };
  });

  // The tab: every shipped piece, grouped by family, pictured from the set pieces' atlas; search finds them by name.
  await page.click('#ed-pal-tabs [data-pane="setpieces"]');
  await page.waitForFunction(() => document.querySelector('#ed-setpieces .thumb.atlas .spr'), null, { timeout: T(30000) }).catch(() => {});
  const tab = await page.evaluate(() => ({
    cards: document.querySelectorAll('#ed-setpieces .sp-btn[data-tool^="setpiece:setpiece."]').length,
    shipped: window.__editor.setPieceLib.pieces.size,
    groups: [...document.querySelectorAll('#ed-setpieces .ed-group .ttl')].map((t) => t.textContent),
    atlas: document.querySelector('#ed-setpieces .thumb.atlas')?.dataset.atlas,
  }));
  check(tab.cards === tab.shipped && tab.groups.includes('Carriageways') && tab.groups.includes('Skybridges') && tab.groups.includes('My set pieces') && tab.atlas === 'setpieces', `the Set pieces tab shows every shipped piece by family, pictured from its atlas (${JSON.stringify(tab)})`);
  await shot('tab');
  await page.fill('#ed-search', 'skybrige');
  await page.waitForFunction(() => !!document.querySelector('#ed-pal-results [data-pick="setpiece:setpiece.skybridge_2"]'), null, { timeout: T(5000) }).catch(() => {});
  check(await page.evaluate(() => !!document.querySelector('#ed-pal-results [data-pick="setpiece:setpiece.skybridge_2"]')), 'search finds set pieces by name (a typo too)');
  await page.fill('#ed-search', '');
  await page.press('#ed-search', 'Escape');
  // The Style Pack picker narrows the tab to the pack's pieces, and its look re-themes the ghost.
  await page.selectOption('#ed-pack', 'military');
  await clickTool(page, '[data-tool="setpiece:setpiece.skybridge_2"]');
  await hover(32, 0, 32);
  const military = await page.evaluate(() => ({ gate: document.querySelector('#ed-setpieces [data-tool="setpiece:setpiece.carriageway_1"]').hidden, bridge: document.querySelector('#ed-setpieces [data-tool="setpiece:setpiece.skybridge_2"]').hidden, look: document.getElementById('ed-sp-look')?.value }));
  const themed = await ghost();
  check(military.gate && !military.bridge && military.look === 'military' && themed?.pack === 'military', `the Military Compound pack shows its pieces and themes the ghost (${JSON.stringify(military)}, ghost look ${themed?.pack})`);
  await shot('pack');
  await page.selectOption('#ed-pack', '');

  // Place: a see-through ghost of the whole piece, green; a click places it, as one placement, selected.
  await clickTool(page, '[data-tool="setpiece:setpiece.carriageway_1"]');
  await page.evaluate(() => window.__editor.view.focus({ x: 12, y: 0, z: 8 }));
  await settle();
  await hover(16, 0, 8);
  const g0 = await ghost();
  check(g0?.ok && g0.shown && g0.seeThrough && JSON.stringify(g0.at) === '[2,1,0]' && /tone-place/.test(g0.tip), `the set piece tool shows the whole piece, see-through and green, at the pointer (${JSON.stringify(g0)})`);
  await shot('ghost');
  await page.mouse.click((await at(16, 0, 8)).x, (await at(16, 0, 8)).y);
  await settle();
  let d = await doc();
  const gate = d.setPieces?.[0];
  check(d.setPieces?.length === 1 && gate.piece === 'setpiece.carriageway_1' && gate.x === 2 && gate.y === 1 && gate.z === 0 && JSON.stringify(await page.evaluate(() => window.__editor.selection.setPieces)) === JSON.stringify([gate.id]), `a click places the carriageway as one placement, selected (${JSON.stringify(d.setPieces)})`);
  // Red where it can't go, with the reason, and a click there places nothing.
  await hover(16, 0, 8.5);
  const red = await ghost();
  check(red && !red.ok && /tone-bad/.test(red.tip) && /overlaps the Carriageway set piece/i.test(red.tipText) && /can't go here/.test(await page.textContent('#ed-target')), `over another piece the ghost is red and says why (${red?.reason})`);
  await shot('ghost-red');
  await page.mouse.click((await at(16, 0, 8.5)).x, (await at(16, 0, 8.5)).y);
  check((await doc()).setPieces.length === 1 && /Can't place Carriageway/.test(await page.textContent('#ed-toast')), 'a click there places nothing and says why');
  // R turns it and M mirrors it, as the ghost shows; a piece that can't be mirrored says why and greys M out.
  await page.keyboard.press('KeyR');
  await page.keyboard.press('KeyM');
  // Two cells north of the first: a free spot, on screen.
  await hover(16, 0, 24);
  const turned = await ghost();
  check(turned?.ok && turned.rotation === 1 && turned.mirror === true && (await page.textContent('#ed-sp-mirror')).includes('Mirrored'), `R turns the ghost and M mirrors it (${JSON.stringify(turned && { ok: turned.ok, at: turned.at, rotation: turned.rotation, mirror: turned.mirror, reason: turned.reason })})`);
  await page.mouse.click((await at(16, 0, 24)).x, (await at(16, 0, 24)).y);
  d = await doc();
  check(d.setPieces.length === 2 && d.setPieces[1].rotation === 1 && d.setPieces[1].mirror === true, 'it is placed as the ghost showed: turned and mirrored');
  if (d.setPieces.length === 2) await page.keyboard.press('Control+KeyZ');
  await page.keyboard.press('KeyM');
  await page.keyboard.press('KeyR');
  await page.keyboard.press('KeyR');
  await page.keyboard.press('KeyR');
  await clickTool(page, '[data-tool="setpiece:setpiece.trench_bend"]');
  await page.keyboard.press('KeyM');
  const refused = await page.evaluate(() => ({ mirror: window.__editor.pieceMirror, disabled: document.getElementById('ed-sp-mirror').disabled, why: document.getElementById('ed-sp-mirror').title, toast: document.getElementById('ed-toast').textContent }));
  check(!refused.mirror && refused.disabled && /isn't its own mirror image/.test(refused.why) && /can't be mirrored/.test(refused.toast), `M can't mirror the Trench Bend, and says why (${refused.why})`);
  await shot('mirror-refused');

  // Select: a click on any of its parts selects the placement as one; it drags a cell east; undo puts it back.
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await hover(16, 0.1, 8);
  await page.mouse.click((await at(16, 0.1, 8)).x, (await at(16, 0.1, 8)).y);
  await settle();
  const sel = await page.evaluate(() => window.__editor.selection);
  check(JSON.stringify(sel) === JSON.stringify({ tiles: [], entities: [], setPieces: [gate.id] }) && (await page.textContent('#ed-inspector h2')) === 'Carriageway', `a click on its passage selects the carriageway as one (${JSON.stringify(sel)})`);
  const insp = await page.evaluate(() => ({ look: !!document.getElementById('ed-sp-insp-look'), mirror: !!document.getElementById('ed-sp-insp-mirror'), roles: document.querySelectorAll('#ed-inspector select[data-role]').length, parts: document.querySelectorAll('#ed-inspector .ed-sp-parts input').length, ports: document.querySelectorAll('#ed-inspector .ed-sp-ports li').length }));
  check(insp.look && insp.mirror && insp.roles > 0 && insp.parts > 0 && insp.ports === 6, `the inspector shows its look, mirror, ports and overrides (${JSON.stringify(insp)})`);
  await shot('selected');
  const from = await at(16, 0.1, 8);
  const to = await at(24, 0.1, 8);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await settle();
  await page.mouse.up();
  await settle();
  const moved = (await doc()).setPieces[0];
  await page.keyboard.press('Control+KeyZ');
  const back = (await doc()).setPieces[0];
  check(moved.x === 3 && moved.y === 1 && back.x === 2 && back.y === 1, `dragging it moves it a cell; one undo puts it back (${moved.x},${moved.y} → ${back.x},${back.y})`);
  // An override: hide a part (the inspector's parts list), in one undo step.
  await page.click('#ed-inspector .ed-sp-parts input[data-part="2"]');
  check(JSON.stringify((await doc()).setPieces[0].overrides) === '{"hide":[2]}', 'unticking a part hides it on this placement');
  await page.keyboard.press('Control+KeyZ');

  // Explode to tiles: its parts become ordinary pieces, selected; one undo brings the set piece back.
  await page.evaluate((id) => window.__editor.setSelection({ tiles: [], entities: [], setPieces: [id] }), gate.id);
  await settle();
  const counts = (m) => ({ pieces: m.setPieces?.length ?? 0, tiles: m.classicStructure.tiles.length, entities: m.entities.length });
  const before = counts(await doc());
  await page.click('#ed-sp-explode');
  await settle();
  const exploded = counts(await doc());
  const exSel = await page.evaluate(() => window.__editor.selection);
  await shot('exploded');
  await page.keyboard.press('Control+KeyZ');
  const unexploded = counts(await doc());
  check(exploded.pieces === 0 && exploded.tiles > before.tiles && exSel.tiles.every((id) => id.startsWith(`sp_${gate.id}_`)) && exSel.tiles.length + exSel.entities.length === exploded.tiles + exploded.entities - before.tiles - before.entities && JSON.stringify(unexploded) === JSON.stringify(before), `Explode to tiles makes its parts ordinary pieces, selected; one undo puts it back (${JSON.stringify({ before, exploded, unexploded })})`);

  // Save selection as set piece: a box drag over the starter room; named; in My set pieces; exported, deleted, imported.
  await page.evaluate(() => window.__editor.setSelection({ tiles: [], entities: [] }));
  await page.evaluate(() => window.__editor.view.focus({ x: 0, y: 0, z: 0 }));
  await settle();
  const a = await at(-6, 0, -6);
  const b = await at(6, 0, 6);
  await page.mouse.move(Math.min(a.x, b.x) - 20, Math.min(a.y, b.y) - 20);
  await page.mouse.down();
  await page.mouse.move(Math.max(a.x, b.x) + 20, Math.max(a.y, b.y) + 20, { steps: 6 });
  const box = await page.evaluate(() => !document.getElementById('ed-marquee').hidden);
  await shot('box-select');
  await page.mouse.up();
  await settle();
  const boxed = await page.evaluate(() => window.__editor.selection);
  check(box && boxed.tiles.length === 1, `dragging a box on empty ground selects what is in it (${JSON.stringify(boxed)})`);
  await page.click('#ed-insp-save-piece');
  await page.fill('#ed-sp-save-name', 'Guard Room');
  await page.waitForFunction(() => /1 tile/.test(document.getElementById('ed-sp-save-summary').textContent), null, { timeout: T(5000) }).catch(() => {});
  await shot('save-dialog');
  await page.click('#ed-sp-save-ok');
  const lib = () => page.evaluate(() => JSON.parse(localStorage.getItem('cs.setpieces') ?? '[]').map((s) => s.def.id));
  check(JSON.stringify(await lib()) === '["local.guard_room"]' && (await page.isVisible('#ed-setpieces [data-tool="setpiece:local.guard_room"]')), 'Save as set piece keeps it in your library, in My set pieces');
  await clickTool(page, '[data-tool="setpiece:local.guard_room"]');
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: T(10000) }), page.click('#ed-sp-export')]);
  const file = join(mkdtempSync(join(tmpdir(), 'tt-piece-')), download.suggestedFilename());
  await download.saveAs(file);
  const exported = JSON.parse(readFileSync(file, 'utf8'));
  await page.click('#ed-sp-delete');
  const deleted = await lib();
  await page.setInputFiles('#ed-sp-import-file', file);
  await page.waitForFunction(() => (localStorage.getItem('cs.setpieces') ?? '').includes('local.guard_room'), null, { timeout: T(10000) }).catch(() => {});
  check(exported.id === 'local.guard_room' && deleted.length === 0 && JSON.stringify(await lib()) === '["local.guard_room"]', `Export writes it as a file, and Import brings it back (${download.suggestedFilename()})`);
  // Placed, the map carries its definition (it plays anywhere).
  await clickTool(page, '[data-tool="setpiece:local.guard_room"]');
  await page.evaluate(() => window.__editor.view.focus({ x: 32, y: 0, z: 24 }));
  await settle();
  await hover(32, 0, 24);
  await page.mouse.click((await at(32, 0, 24)).x, (await at(32, 0, 24)).y);
  d = await doc();
  check(d.setPieces.some((p) => p.piece === 'local.guard_room') && d.setPieceDefs?.some((x) => x.id === 'local.guard_room'), 'your piece places like any other, and the map carries its definition');

  // Ports: a room with a solid wall against the carriageway's west door: a warning, and the port red on its outline.
  await page.evaluate(() => {
    window.__editor.setTool({ kind: 'tile', tile: 'core.room' });
    window.__editor.view.focus({ x: 12, y: 0, z: 8 });
  });
  await settle();
  await hover(8, 0, 8);
  await page.mouse.click((await at(8, 0, 8)).x, (await at(8, 0, 8)).y);
  await page.evaluate(() => window.__editor.setEdge({ cell: [1, 1, 0], side: 'E' }, 'wall', null));
  await page.evaluate((id) => {
    window.__editor.setTool({ kind: 'select' });
    window.__editor.setSelection({ tiles: [], entities: [], setPieces: [id] });
  }, gate.id);
  await settle();
  const ports = await page.evaluate(() => ({
    warn: [...document.querySelectorAll('#ed-inspector .ed-sp-ports li.warning')].map((li) => li.textContent),
    issue: [...document.querySelectorAll('#ed-issues li')].map((li) => li.textContent).find((t) => /faces a wall/.test(t)) ?? null,
    red: window.__editor.selectedPieceOutlines().flatMap((o) => o.ports).filter((p) => p.blocked).length,
  }));
  check(ports.warn.length === 1 && /west side \(Ground\) faces a wall: the Room's wall/.test(ports.warn[0]) && !!ports.issue && ports.red === 1, `a door facing a wall is warned about, and red on the outline (${JSON.stringify(ports)})`);
  await shot('ports');
  check(errors.length === 0, `no page errors with set pieces (${errors.join('; ')})`);
  await page.context().close();
}

/**
 * Set pieces part 5 (docs/SET_PIECES_PLAN.md, "As built: part 5") in MapMaker: the brainstorm list's families in the
 * Set pieces tab, one placed from it, and a retired tile (the Catwalk Gantry): out of the palette, its inspector's
 * Replace all swaps it for the Catwalk Bridge (Up) in one undo step. Screenshots go to E2E_SHOTS when set.
 */
async function editorSetPiecePart5Checks(browser) {
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 820 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  const shot = (name) => (process.env.E2E_SHOTS ? page.screenshot({ path: `${process.env.E2E_SHOTS}/setpieces5-${name}.png` }).catch(() => {}) : Promise.resolve());
  await page.goto(`${CLIENT}/?mode=editor&test=1`);
  await page.waitForFunction(() => window.__editor, null, { timeout: T(60000) });
  await newMap(page);
  await page.evaluate(() => window.__editor.view.focus({ x: 16, y: 0, z: 16 }));
  await frames(page, 3);
  const doc = () => page.evaluate(() => window.__editor.doc);

  // The tab has the new families, and a click places one of their pieces as one placement.
  await page.click('#ed-pal-tabs [data-pane="setpieces"]');
  const groups = await page.evaluate(() => [...document.querySelectorAll('#ed-setpieces .ed-group .ttl')].map((t) => t.textContent));
  const want = ['Power core halls', 'Catwalk bridges', 'Overlooks', 'Atrium towers', 'Loading docks', 'Sunken arenas', 'Reactor rooms', 'Bunker clusters', 'Courtyard gates', 'Server vaults', 'Plazas', 'Ramp junctions', 'Sea walls'];
  check(want.every((g) => groups.includes(g)), `the Set pieces tab has the brainstorm list's families and the sea wall (${groups.join(', ')})`);
  await clickTool(page, '#ed-setpieces [data-tool="setpiece:setpiece.twin_stair_overlook"]');
  const p = await page.evaluate(() => window.__editor.view.project({ x: 16, y: 0, z: 16 }));
  await page.mouse.move(p.x, p.y);
  await frames(page, 3);
  await page.mouse.click(p.x, p.y);
  await frames(page, 3);
  const placed = (await doc()).setPieces ?? [];
  check(placed.length === 1 && placed[0].piece === 'setpiece.twin_stair_overlook' && placed[0].x === 2 && placed[0].y === 2, `a click places the Twin-Stair Overlook as one placement (${JSON.stringify(placed)})`);
  await shot('overlook');

  // A retired tile: not in the palette; a map that has one opens with it, and its inspector replaces all of them.
  const inPalette = await page.evaluate(() => document.querySelectorAll('[data-tool="tile:military.gantry"]').length);
  check(inPalette === 0, `the retired Catwalk Gantry is out of the palette (${inPalette})`);
  await page.evaluate(() => {
    const ed = window.__editor;
    ed.history.execute('Old gantries', { kind: 'addTiles', tiles: [{ id: 'gantry_e2e_a', tile: 'military.gantry', x: -3, y: 3, z: 0, rotation: 0 }, { id: 'gantry_e2e_b', tile: 'military.gantry', x: -6, y: 3, z: 0, rotation: 1 }] });
    ed.setSelection({ tiles: ['gantry_e2e_a'], entities: [], setPieces: [] });
  });
  await page.waitForSelector('#ed-retired-replace', { timeout: T(5000) }).catch(() => {});
  const label = await page.textContent('#ed-retired-replace').catch(() => '');
  check(/Replace all 2 with Catwalk Bridge \(Up\)/.test(label ?? ''), `a retired tile's inspector offers Replace all with its set piece (${label})`);
  await shot('retired');
  await page.click('#ed-retired-replace').catch(() => {});
  await frames(page, 3);
  const after = await doc();
  const bridges = (after.setPieces ?? []).filter((x) => x.piece === 'setpiece.catwalk_bridge_2').map((x) => [x.id, x.x, x.y, x.rotation]);
  check(!after.classicStructure.tiles.some((t) => t.tile === 'military.gantry') && JSON.stringify(bridges) === JSON.stringify([['gantry_e2e_a', -3, 3, 0], ['gantry_e2e_b', -6, 3, 1]]), `Replace all swaps every gantry for the Catwalk Bridge (Up) where it stood (${JSON.stringify(bridges)})`);
  check(JSON.stringify(await page.evaluate(() => window.__editor.selection.setPieces)) === '["gantry_e2e_a","gantry_e2e_b"]', 'the new pieces are selected');
  await shot('replaced');
  await page.keyboard.press('Control+KeyZ');
  await frames(page, 2);
  const undone = await doc();
  check(undone.classicStructure.tiles.filter((t) => t.tile === 'military.gantry').length === 2 && !(undone.setPieces ?? []).some((x) => x.piece === 'setpiece.catwalk_bridge_2'), 'one undo puts the gantries back');
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

/**
 * MapMaker's ground under floors (HANDOFF "MapMaker's ground under floors"): the document keeps the ground as made and
 * MapMaker shows it kept under the floors (EditorView.setMap: what loading plays), so a floor dragged off a rise gives
 * the ground under it back, its undo leaves the document's terrain byte-identical, a floor moved across the field and
 * back leaves no dip, and TEST plays the ground MapMaker showed. Screenshots go to E2E_SHOTS when set.
 */
async function editorGroundChecks(browser) {
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 820 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  page.on('dialog', (d) => d.accept());
  const shot = (name) => (process.env.E2E_SHOTS ? page.screenshot({ path: `${process.env.E2E_SHOTS}/ground-${name}.png` }).catch(() => {}) : Promise.resolve());
  await page.goto(`${CLIENT}/?mode=editor&test=1`);
  await page.waitForFunction(() => window.__editor, null, { timeout: T(60000) });
  livePages.add(page);
  await newMap(page, 96);
  const settle = () => frames(page, 3);
  const at = (x, y, z) => page.evaluate(([x, y, z]) => window.__editor.view.project({ x, y, z }), [x, y, z]);
  // The ground 0.6 m up all round (75 cm over the starter ground at -0.15 m): the starter room's floor, at 0 m, stands
  // in it, so MapMaker shows the ground lowered under the room.
  await page.evaluate(() => {
    const ed = window.__editor;
    const t = ed.doc.terrain;
    ed.run('Raise the ground', { kind: 'setTerrain', before: t, after: { ...t, heights: t.heights.map(() => 75) } });
    ed.setTool({ kind: 'select' });
    ed.view.focus({ x: 8, y: 0, z: 0 });
  });
  await settle();
  const room = (await page.evaluate(() => window.__editor.doc.classicStructure.tiles))[0];
  /** The ground's vertex heights (cm) inside a box [x0, z0, x1, z1]: as MapMaker shows it, and the document's own. */
  const ground = (box) =>
    page.evaluate((box) => {
      const ed = window.__editor;
      const read = (t) => {
        const out = [];
        for (let r = 0; r < t.rows; r++) for (let c = 0; c < t.cols; c++) {
          const x = t.origin[0] + c * t.spacing;
          const z = t.origin[1] + r * t.spacing;
          if (x >= box[0] && x <= box[2] && z >= box[1] && z <= box[3]) out.push(t.heights[r * t.cols + c]);
        }
        return out;
      };
      return { shown: read(ed.view.ground), made: read(ed.doc.terrain) };
    }, box);
  const whole = () => page.evaluate(() => ({ made: JSON.stringify(window.__editor.doc.terrain), shown: JSON.stringify(window.__editor.view.ground.heights), x: window.__editor.doc.classicStructure.tiles[0].x }));
  const lowered = (h) => h.length > 0 && h.every((v) => v < 0);
  const open = (h) => h.length > 0 && h.every((v) => v === 75);
  // Inside the room (its floor's edge vertices are lowered less), and the open ground two cells east.
  const site = (cx) => [cx * 8 - 3, -3, cx * 8 + 3, 3];
  const start = await whole();
  const g0 = { here: await ground(site(0)), there: await ground(site(2)) };
  check(room?.x === 0 && lowered(g0.here.shown) && open(g0.here.made) && open(g0.there.shown), `MapMaker shows the ground lowered under the room's floor; the document keeps the ground as made (${JSON.stringify({ shown: g0.here.shown.slice(0, 3), made: g0.here.made.slice(0, 3), east: g0.there.shown.slice(0, 3) })})`);
  await shot('placed');
  // Drag the room two cells east with Select (a click on its floor picks it, a drag moves it cell by cell).
  const drag = async (fromX, toX) => {
    // The view over both ends (the room walks off the screen otherwise).
    await page.evaluate((x) => window.__editor.view.focus({ x, y: 0, z: 0 }), (fromX + toX) / 2);
    await settle();
    const from = await at(fromX + 2.5, 0, 2.5);
    await page.mouse.move(from.x, from.y);
    await settle();
    await page.mouse.click(from.x, from.y);
    await settle();
    const picked = await page.evaluate(() => window.__editor.selection.tiles.join());
    const to = await at(toX + 2.5, 0.6, 2.5);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
    await page.mouse.move(to.x, to.y, { steps: 4 });
    await settle();
    await page.mouse.up();
    await settle();
    return picked;
  };
  const picked = await drag(0, 16);
  const moved = await whole();
  const g1 = { here: await ground(site(0)), there: await ground(site(2)) };
  check(picked === room.id && moved.x === 2 && moved.made === start.made && open(g1.here.shown) && lowered(g1.there.shown), `the room dragged two cells east gives the ground where it stood back, and MapMaker shows it lowered where it went; the document's ground is untouched (${JSON.stringify({ picked, x: moved.x, made: moved.made === start.made, back: g1.here.shown.slice(0, 3), there: g1.there.shown.slice(0, 3) })})`);
  await shot('moved');
  await page.keyboard.press('Control+KeyZ');
  await settle();
  const undone = await whole();
  check(undone.x === 0 && undone.made === start.made && undone.shown === start.shown, `one undo puts the room back with the document's terrain byte-identical and the ground as before (x ${undone.x}, document ${undone.made === start.made}, shown ${undone.shown === start.shown})`);
  await shot('undone');
  await page.keyboard.press('Control+KeyY');
  await settle();
  const redone = await whole();
  check(redone.x === 2 && redone.made === start.made && redone.shown === moved.shown, `redo moves it again, onto the same ground (x ${redone.x}, shown ${redone.shown === moved.shown})`);
  // Across the field and back, one cell at a time (each its own edit): no dip anywhere it passed.
  await drag(16, 24);
  await drag(24, 32);
  const far = await whole();
  await drag(32, 24);
  await drag(24, 16);
  await drag(16, 8);
  await drag(8, 0);
  const home = await whole();
  // Everywhere it passed east of where it stands now: open ground again.
  const passed = await ground([5, -3, 35, 3]);
  check(far.x === 4 && home.x === 0 && home.made === start.made && home.shown === start.shown && open(passed.shown), `a floor dragged across the field and back leaves the ground as it was (x ${far.x} → ${home.x}, document ${home.made === start.made}, shown ${home.shown === start.shown}, where it passed ${[...new Set(passed.shown)].join('/')} cm)`);
  await shot('home');
  // TEST plays the ground MapMaker showed.
  await page.keyboard.press('F5');
  const testing = await page.waitForFunction(() => window.__cs?.local && window.__testStartMs, null, { timeout: T(30000) }).then(() => true, () => false);
  const playedHeights = testing ? await sim(page, (m) => JSON.stringify(m.map.terrain.heights)).catch((e) => String(e)) : null;
  check(testing && playedHeights === home.shown, `TEST plays the ground MapMaker showed (${testing ? (playedHeights === home.shown ? 'same' : 'differs') : 'no match'})`);
  check(errors.length === 0, `no page errors with the ground (${errors.join('; ')})`);
  livePages.delete(page);
  await page.context().close();
}

async function offlineFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  // Map select: each card shows the map's picture and, separately, its plan; the setup panel shows both side by side.
  await page.setViewportSize({ width: 1400, height: 820 });
  await page.goto(CLIENT);
  await page.waitForFunction(() => window.__front, null, { timeout: T(30000) });
  // Options: a section at a time (Q / E step through them), wide rows, switches that save.
  await page.click('#nav-options');
  await page.waitForSelector('.opt-nav');
  const sections = await page.$$eval('.opt-nav button', (bs) => bs.map((b) => b.dataset.tab));
  const optWidth = await page.$eval('.opt-layout', (e) => e.getBoundingClientRect().width);
  check(sections.join() === 'general,display,controls,hud,accessibility,online' && optWidth > 700, `Options has its sections side by side with a wide panel (${sections.join(', ')}; ${Math.round(optWidth)} px)`);
  await page.keyboard.press('e');
  await page.keyboard.press('e');
  check((await page.textContent('.opt-title')) === 'Controls', 'E steps to the next Options section');
  await page.click('.opt-row:has-text("Invert look") .switch');
  check(await page.evaluate(() => Object.values(localStorage).some((v) => /"invertY":true/.test(v))), 'the Invert look switch saves');
  await page.click('.opt-row:has-text("Invert look") .switch');
  // Accessibility → Reduce flashing (game/reduceFlashing.ts): on for a first visit, and the switch saves.
  await page.click('.opt-nav [data-tab="accessibility"]');
  const calmDefault = await page.$eval('#opt-reduce-flashing', (b) => b.checked);
  await page.click('.opt-row:has-text("Reduce flashing") .switch');
  const calmOff = await page.evaluate(() => localStorage.getItem('tiletrigger.reduceFlashing'));
  await page.click('.opt-row:has-text("Reduce flashing") .switch');
  const calmOn = await page.evaluate(() => localStorage.getItem('tiletrigger.reduceFlashing'));
  check(calmDefault === true && calmOff === '0' && calmOn === '1', `Accessibility: Reduce flashing is on at first and its switch saves (${JSON.stringify({ calmDefault, calmOff, calmOn })})`);
  await page.keyboard.press('Escape');
  // The main menu: a Characters item (Character Select, and Back returns here: the owner wanted it kept) beside the
  // Profile entry (top right), which shows your character, name and account state and opens Profile (Change character
  // opens Character Select too). Sign-in lives there, not in the bottom bar.
  const navIds = await page.$$eval('#menu .nav button', (bs) => bs.map((b) => b.id));
  const badge = await page.evaluate(() => ({ text: document.querySelector('#profile-badge')?.textContent ?? '', footer: !!document.querySelector('.menu-footer #sign-in, .menu-footer #profile-link, .menu-footer .menu-links') }));
  check(navIds.join() === 'nav-quick,nav-play,nav-mapmaker,nav-characters,nav-online,nav-options' && /Profile/.test(badge.text) && /Guest/i.test(badge.text) && !badge.footer, `the main menu has Characters beside the Profile entry, and sign-in leaves the bottom bar (${navIds.join(', ')}; "${badge.text}")`);
  await page.click('#nav-characters');
  await page.waitForSelector('.char-grid', { timeout: T(10000) }).catch(() => {});
  const charsOpen = await page.isVisible('.char-grid');
  await page.keyboard.press('Escape');
  await page.waitForSelector('#nav-characters', { timeout: T(10000) }).catch(() => {});
  check(charsOpen && (await page.isVisible('#nav-characters')), `Characters opens Character Select and Back returns to the main menu (open ${charsOpen})`);
  const groups = await page.$$eval('.menu-footer .hint-group', (gs) => gs.map((g) => g.className.replace('hint-group ', '')));
  check(groups.join() === 'moves,acts,util', `the bottom bar's hints come in groups: getting about, actions, fullscreen (${groups.join(', ')})`);
  /** Main menu or Profile → Profile → Change character. */
  const openChars = async () => {
    if (await page.isVisible('#profile-badge')) await page.click('#profile-badge');
    await page.click('#profile-change-character');
    await page.waitForSelector('.char-grid .char-tile[data-look]');
  };
  // Character Select: whole square tiles row under row, and the grid ends above the info panel (it scrolls).
  await openChars();
  const charFit = await page.evaluate(() => {
    const t = [...document.querySelectorAll('.char-sec')[0].querySelectorAll('.char-tile')].map((e) => e.getBoundingClientRect());
    const perRow = t.filter((r) => Math.abs(r.top - t[0].top) < 1).length;
    const grid = document.querySelector('.char-grid').getBoundingClientRect();
    const info = document.querySelector('.char-info').getBoundingClientRect();
    return { tile: Math.round(t[0].height), wide: Math.round(t[0].width), step: Math.round(t[perRow].top - t[0].top), gridBottom: Math.round(grid.bottom), infoTop: Math.round(info.top) };
  });
  check(Math.abs(charFit.tile - charFit.wide) <= 1 && charFit.step >= charFit.tile && charFit.gridBottom <= charFit.infoTop, `Character Select tiles are square, row under row, above the info panel (${JSON.stringify(charFit)})`);
  // Every built-in look ships its portrait: one drawn live blocks the page while it's read back (it held the grid for seconds).
  await page.waitForSelector('.char-grid:not(.loading)', { timeout: T(30000) });
  const liveTiles = await page.$$eval('.char-grid .char-tile.loading', (ts) => ts.map((t) => t.dataset.look));
  check(liveTiles.length === 0, `every built-in character's portrait is shipped, none drawn live (${liveTiles.join(', ') || 'none'})`);
  // Drag the hero round to see the whole look; leaving the screen faces them forward again.
  const spin = await page.locator('.char-spin').boundingBox();
  const yaw = () => page.evaluate(() => window.__front.scene.yaw);
  await page.mouse.move(spin.x + spin.width / 2, spin.y + spin.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(spin.x + spin.width / 2 + i * 20, spin.y + spin.height / 2);
  await page.mouse.up();
  const turned = await yaw();
  check(Math.abs(turned) > 0.5, `dragging over the character turns them (${turned.toFixed(2)} rad)`);
  await page.keyboard.press('Escape');
  await until(async () => Math.abs(await yaw()) < 0.01, T(3000));
  check(Math.abs(await yaw()) < 0.01, 'and leaving Character Select faces them forward again');
  check((await page.evaluate(() => window.__front.screen)) === 'profile', 'Back from Character Select returns to Profile, where it was opened');
  // One grid in sections by what a character is (a compact header each), a jump strip that lights the
  // section in view; Q / E scroll to the next / previous one, and so does scrolling with the wheel.
  await openChars();
  const layout = await page.evaluate(() => ({
    secs: [...document.querySelectorAll('.char-grid .char-sec')].map((s) => s.dataset.section),
    heads: [...document.querySelectorAll('.char-sec-head')].every((h) => /\d+$/.test(h.textContent.trim())),
    chips: [...document.querySelectorAll('.char-jump .char-chip')].map((c) => c.dataset.section),
    tabs: document.querySelectorAll('.characters .tabs .tab').length,
  }));
  check(layout.secs.join() === 'soldiers,legends,folk,horror,animals,creatures,mine' && layout.chips.join() === layout.secs.join() && layout.heads && layout.tabs === 0, `Character Select is one grid in sections with a jump strip, no tabs (${layout.secs.join(', ')}; chips ${layout.chips.join(', ')})`);
  const section = () => page.evaluate(() => ({ on: document.querySelector('.char-chip.on')?.dataset.section, top: Math.round(document.querySelector('.char-grid').scrollTop) }));
  const settled = async (want) => {
    await page.waitForFunction((w) => {
      const g = document.querySelector('.char-grid');
      const s = document.querySelector(`.char-sec[data-section="${w}"]`);
      return !window.__front.charJumping && document.querySelector('.char-chip.on')?.dataset.section === w && Math.abs(g.scrollTop - Math.min(s.offsetTop, g.scrollHeight - g.clientHeight)) < 2;
    }, want, { timeout: T(5000) }).catch(() => {});
    return section();
  };
  await page.click('.char-chip[data-section="soldiers"]');
  await settled('soldiers');
  await page.keyboard.press('e');
  await page.keyboard.press('e');
  const twoOn = await settled('folk');
  check(twoOn.on === 'folk' && twoOn.top > 0, `E E scrolls the grid two sections on and the strip lights it (${JSON.stringify(twoOn)})`);
  await page.keyboard.press('q');
  const back1 = await settled('legends');
  check(back1.on === 'legends', `Q scrolls back a section (${JSON.stringify(back1)})`);
  await page.click('.char-chip[data-section="creatures"]');
  const chipJump = await settled('creatures');
  check(chipJump.on === 'creatures', `a chip in the strip jumps to its section (${JSON.stringify(chipJump)})`);
  const g = await page.locator('.char-grid').boundingBox();
  await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
  await page.mouse.wheel(0, -100000);
  await page.waitForFunction(() => document.querySelector('.char-grid').scrollTop === 0 && document.querySelector('.char-chip.on')?.dataset.section === 'soldiers', null, { timeout: T(5000) }).catch(() => {});
  const wheeled = await section();
  check(wheeled.on === 'soldiers' && wheeled.top === 0, `the mouse wheel scrolls across sections and the strip follows (${JSON.stringify(wheeled)})`);
  // Arrows move over the portraits and on across a section's end: Down from the last row of Soldiers lands in Knights & Legends.
  const lastSoldier = await page.$eval('.char-sec[data-section="soldiers"] .char-tile:last-child', (t) => t.dataset.look);
  await page.focus(`.char-tile[data-look="${lastSoldier}"]`);
  await page.keyboard.press('ArrowDown');
  const below = await page.evaluate(() => document.activeElement?.closest('.char-sec')?.dataset.section);
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowRight');
  const after = await page.evaluate(() => document.activeElement?.closest('.char-sec')?.dataset.section);
  check(below === 'legends' && after === 'legends', `arrow keys cross section boundaries (down: ${below}, right from the last soldier: ${after})`);
  // Hovering only highlights, a click shows them, and only Choose (Enter / A again, a double-click) makes them
  // yours. Leaving without it keeps your character.
  const front = () => page.evaluate(() => ({ look: window.__front.look, shown: window.__front.scene.look, screen: window.__front.screen }));
  const mine = (await front()).look;
  const others = (await page.$$eval('.char-tile[data-look]', (ts) => ts.map((t) => t.dataset.look))).filter((l) => l !== mine && l.startsWith('core.'));
  const [pickA, pickB, pickC] = others;
  const tileOf = (l) => `.char-tile[data-look="${l}"]`;
  await page.hover(tileOf(pickA));
  check((await front()).shown === mine, `hovering a portrait doesn't change who's shown (${(await front()).shown})`);
  await page.click(tileOf(pickA));
  await page.hover(tileOf(pickB));
  await page.mouse.move(spin.x + spin.width / 2, spin.y + spin.height / 2);
  const shownA = await front();
  const chooseText = await page.textContent('#char-choose');
  check(shownA.shown === pickA && shownA.look === mine && /^Choose /.test(chooseText ?? '') && (await page.$(`${tileOf(mine)} .chosen-badge`)) !== null, `a click shows the character, moving the mouse after doesn't change it, and it isn't chosen yet (${JSON.stringify(shownA)}, "${chooseText}")`);
  await page.keyboard.press('e');
  const stepped = await page.evaluate(() => ({ on: document.querySelector('.char-chip.on')?.dataset.section, shown: window.__front.scene.look }));
  check(stepped.shown === pickA, `E keeps who's shown (${JSON.stringify(stepped)})`);
  await page.keyboard.press('Escape');
  check((await front()).look === mine, 'leaving without choosing keeps your character');
  await openChars();
  await page.click(tileOf(pickA));
  await page.click('#char-choose');
  const chose = await front();
  const profName = await page.textContent('.prof-char h3').catch(() => '');
  check(chose.look === pickA && chose.screen === 'profile' && !!profName, `Choose makes them yours and returns to Profile, which shows them (${JSON.stringify(chose)}, "${profName}")`);
  await openChars();
  check((await page.$(`${tileOf(pickA)} .chosen-badge`)) !== null, 'and their portrait wears the Chosen badge');
  await page.focus(tileOf(pickC));
  await page.keyboard.press('Enter');
  const kbShown = await front();
  await page.keyboard.press('Enter');
  const kbChose = await front();
  check(kbShown.shown === pickC && kbShown.look === pickA && kbChose.look === pickC, `keyboard: Enter on a portrait shows them, Enter again chooses (${kbShown.shown} / ${kbChose.look})`);
  await openChars();
  await page.dblclick(tileOf(mine));
  check((await front()).look === mine, 'a double-click on a portrait chooses them');
  // Keys: Esc from Profile goes home; P opens Profile there, C opens Character Select from Profile.
  await page.keyboard.press('Escape');
  await page.keyboard.press('p');
  const viaP = (await front()).screen;
  await page.keyboard.press('c');
  const viaC = (await front()).screen;
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  check(viaP === 'profile' && viaC === 'characters' && (await front()).screen === 'home', `P opens Profile, C there opens Character Select, Esc steps back (${viaP} / ${viaC})`);
  await page.click('#nav-play');
  await page.waitForSelector('.map-card');
  const cards = () =>
    page.$$eval('.map-card', (cs) =>
      cs.map((c) => ({ map: c.dataset.map, pic: c.querySelector('.map-thumb.pic'), plan: c.querySelector('.map-thumb.plan canvas') })).map((x) => ({ map: x.map, img: !!x.pic?.querySelector('img'), loaded: !!x.pic?.querySelector('img')?.naturalWidth, plan: !!x.plan, inPic: !!x.pic?.querySelector('canvas, .map-thumb') })),
    );
  await page.waitForFunction(() => [...document.querySelectorAll('.map-card .map-thumb.pic img')].every((i) => i.complete), null, { timeout: T(20000) }).catch(() => {});
  const all = await cards();
  // Built-in maps (maps/*.json; retired ones aren't listed) ship a picture.
  const { readdirSync } = await import('node:fs');
  const builtIn = new Set(readdirSync(new URL('../maps/', import.meta.url)).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)));
  const missing = all.filter((c) => builtIn.has(c.map) && !c.loaded).map((c) => c.map);
  check(all.length > 20 && missing.length === 0, `every map card shows its picture (${all.length} cards; missing: ${missing.join(', ') || 'none'})`);
  check(all.every((c) => c.plan && !c.inPic) && !(await page.$('.shot-top')), 'and its plan as a separate box, nothing composited into the picture');
  await page.evaluate(() => document.querySelector('.map-card')?.scrollIntoView());
  await until(() => planDrawn(page, '.map-card .map-thumb.plan canvas'), T(5000));
  check(await planDrawn(page, '.map-card .map-thumb.plan canvas'), 'the plan is drawn top-down');
  await page.waitForFunction(() => document.querySelector('.setup-preview .pic img')?.naturalWidth > 0, null, { timeout: T(10000) }).catch(() => {});
  check((await thumbLoaded(page, '.setup-preview .pic img')) && (await planDrawn(page, '.setup-preview .plan canvas')), 'match setup shows the picture and the plan side by side');
  // The list's mode tabs and search narrow it; every card stays the same height.
  const heights = await page.$$eval('#map-cards .map-card', (cs) => new Set(cs.map((c) => Math.round(c.getBoundingClientRect().height))).size);
  check(heights === 1, `every map card is the same height (${heights} different heights)`);
  await page.click('#map-tabs [data-mode="core.ctf"]');
  const ctf = await page.$$eval('#map-cards .map-card', (cs) => cs.length);
  check(ctf > 0 && ctf < all.length, `the Capture the Flag tab lists only its maps (${ctf} of ${all.length})`);
  await page.click('#map-tabs [data-mode="all"]');
  await page.fill('#map-search', 'sandg');
  const found = await page.$$eval('#map-cards .map-card', (cs) => cs.map((c) => c.dataset.map));
  check(found.includes('sandgate') && found.length < 4, `searching finds the map by name (${found.join(', ')})`);
  await page.fill('#map-search', '');
  // What matters most stays on top: picking a mode keeps the mode chips, its variants and what wins (score, time)
  // in view, with the size presets worked out for the map; the rest is in sections below.
  await page.click('#arcade-modes .mode-chip:not(.on)');
  const top = await page.evaluate(() => {
    const body = document.querySelector('#match-setup .setup-body').getBoundingClientRect();
    const seen = (id) => {
      const r = document.getElementById(id)?.getBoundingClientRect();
      return !!r && r.height > 0 && r.top >= body.top - 1 && r.bottom <= body.bottom + 1;
    };
    return { mode: document.querySelector('#arcade-modes .mode-chip.on')?.dataset.mode, chips: seen('arcade-modes'), win: seen('setup-win'), variants: !!document.getElementById('setup-variants'), sizes: document.querySelectorAll('#setup-sizes .size-chip').length, sections: [...document.querySelectorAll('#match-setup .setup-sec')].map((x) => x.id) };
  });
  check(top.chips && top.win && top.variants && top.sizes >= 2 && top.sections.join() === 'setup-teams,setup-bots,setup-advanced', `picking a mode keeps the mode, variants and what wins in view, with the size presets (${JSON.stringify(top)})`);
  await page.setViewportSize({ width: 960, height: 540 });
  await page.goto(`${CLIENT}/?offline`);
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() !== 'waiting' && window.__cs.phase() !== 'countdown', null, { timeout: T(60000) });
  const inv = await page.evaluate(() => [...window.__cs.local.inventory.keys()]);
  check(inv.join(',') === '1,2', `offline match spawns with knife + pistol (${inv})`);
  // The match runs in its own worker (rendering keeps the page's thread): it ticks there, and the page only hears about it.
  const where = await page.evaluate(() => ({ mode: window.__sim?.mode, match: '__match' in window }));
  const t0 = await sim(page, (m) => m.tick);
  await page.waitForTimeout(1000); // wait-ok: measures the tick rate over one second
  const t1 = await sim(page, (m) => m.tick);
  check(where.mode === 'worker' && !where.match && t1 - t0 > 20, `the offline match runs in a Web Worker (${where.mode}, ${t1 - t0} ticks in 1 s)`);
  // Wait for the ammo readout (it blanks while you're down after an early death).
  await page.waitForFunction(() => /^\d+$/.test(document.getElementById('ammo-count').textContent ?? '') && /^\d+$/.test(document.getElementById('ammo-reserve').textContent ?? ''), null, { timeout: T(15000) }).catch(() => {});
  const ammo = await page.evaluate(() => `${document.getElementById('ammo-count').textContent} / ${document.getElementById('ammo-reserve').textContent}`);
  check(/^\d+ \/ \d+$/.test(ammo), `HUD shows ammo (${ammo})`);
  // A click is the user gesture that starts audio; bots fighting then make sounds.
  await page.click('#resume');
  // (A loaded machine decodes them slowly: the check below says what it got, rather than the wait throwing.)
  await page.waitForFunction(() => window.__audio.stats.loaded + window.__audio.stats.failed === window.__audio.total, null, { timeout: T(60000) }).catch(() => {});
  const loaded = await page.evaluate(() => ({ ...window.__audio.stats, total: window.__audio.total }));
  check(loaded.failed === 0 && loaded.loaded === loaded.total, `all ${loaded.total} sounds load and decode (${loaded.failed} failed)`);
  await page.waitForFunction(() => window.__audio.stats.played > 0, null, { timeout: T(20000) }).catch(() => {});
  const played = await page.evaluate(() => window.__audio.stats.played);
  check(played > 0, `match events play sounds (${played} played)`);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
  await spectateChecks(browser);
}

/**
 * Out of play (spectatorCam.ts): dying shows the kill cam on the killer, a key skips it to following
 * players (cycled with the arrow keys), Space flies the free camera, and you respawn as usual; then
 * spectating by choice from the pause menu (a bot fills the place) and joining again.
 */
async function spectateChecks(browser) {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  livePages.add(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  const shot = (name) => (process.env.E2E_SHOTS ? page.screenshot({ path: `${process.env.E2E_SHOTS}/spectate-${name}.png` }).catch(() => {}) : Promise.resolve());
  await page.goto(`${CLIENT}/?offline&test=1`);
  await page.waitForFunction(() => window.__cs?.local?.alive && window.__cs.phase() === 'playing', null, { timeout: T(60000) });
  // Bots hold fire: only the kills below happen to you (CI: a bot shot the player between Join game and the check).
  await holdBots(page);
  const spec = () => page.evaluate(() => window.__cs.spec());
  // A bot kills you; your respawn waits a minute, so there's time to watch (the bots respawn as usual).
  const killer = await sim(page, (m, me) => {
    const bot = m.combatants().find((c) => c.kind === 'bot' && c.alive);
    m.kill(me, bot, 'core.pistol');
    me.respawnTick = m.tick + 60 * 60;
    return { slot: bot.slot, name: bot.name };
  });
  // The banner, read the moment it's up. The kill cam lasts a few seconds as drawn (each frame counts at most a
  // quarter second: spectatorCam.ts), so a page drawing a frame a second shows it for many seconds; the death reaches
  // the page with the match's next snapshots, which a loaded page can take a while to get to.
  const banner = await page
    .waitForFunction(() => {
      const el = document.getElementById('killcam');
      return el && !el.hidden && window.__cs.spec().killCam !== null && { text: el.textContent, killer: window.__cs.spec().killCam };
    }, null, { timeout: T(30000), polling: 50 })
    .then((h) => h.jsonValue())
    .catch(() => null);
  check(banner?.killer === killer.slot && banner.text.includes(killer.name), `the kill cam shows the killer (${banner?.text ?? 'no banner'})`);
  check(/HP left|down/.test(banner?.text ?? ''), 'with the health they have left');
  await page.evaluate(() => (document.getElementById('pause').hidden = true));
  await shot('killcam');
  // When it ends (the match's own respawn delay, as this page knows it), you follow a player (free-for-all: anyone).
  await page.waitForFunction(() => window.__cs.spec().killCam === null && window.__cs.spec().following >= 0, null, { timeout: T(60000) }).catch(() => {});
  const first = await spec();
  const watching = await page.evaluate(() => document.querySelector('#spectating b')?.textContent ?? '');
  check(first.killCam === null && first.following >= 0 && !first.free && /^Watching /.test(watching), `after the kill cam you follow a player (${watching})`);
  await page.evaluate(() => (document.getElementById('pause').hidden = true));
  await shot('follow');
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction((f) => window.__cs.spec().following !== f, first.following, { timeout: T(3000) }).catch(() => {});
  const second = await spec();
  check(second.following >= 0 && second.following !== first.following, `→ follows the next player (${first.following} → ${second.following})`);
  // Space again: the free camera, flown with the movement keys.
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__cs.spec().free, null, { timeout: T(3000) }).catch(() => {});
  const from = (await spec()).camera;
  await page.evaluate(() => (window.__autoInput = { forward: 1, up: 1 }));
  const flown = await until(async () => {
    const c = (await spec()).camera;
    return Math.hypot(c.x - from.x, c.y - from.y, c.z - from.z) > 4;
  }, T(5000));
  await page.evaluate(() => delete window.__autoInput);
  check((await spec()).free && flown, 'Space switches to the free camera, which flies');
  await page.evaluate(() => (document.getElementById('pause').hidden = true));
  await shot('freecam');
  // Camera input while dead goes out as activity (PlayerInput.sp), so the idle rules leave a watcher alone.
  const idle = await sim(page, (m, me) => m.idleSeconds(me.slot));
  check(idle < 2, `watching counts as activity (${idle.toFixed(1)} s idle)`);
  // Respawn as usual: the normal view is back.
  await sim(page, (m, me) => void (me.respawnTick = m.tick));
  await page.waitForFunction(() => window.__cs.local.alive && !window.__cs.spec().out, null, { timeout: T(5000) }).catch(() => {});
  const back = await page.evaluate(() => ({ alive: window.__cs.local.alive, out: window.__cs.spec().out, hud: document.getElementById('spectating')?.hidden !== false }));
  check(back.alive && !back.out && back.hud, `respawning ends watching (${JSON.stringify(back)})`);
  // Die again and press Space at once: it skips the kill cam.
  await sim(page, (m, me) => {
    m.kill(me, m.combatants().find((c) => c.kind === 'bot' && c.alive), 'core.pistol');
    me.respawnTick = m.tick + 60 * 60;
  });
  await page.waitForFunction(() => window.__cs.spec().killCam !== null, null, { timeout: T(30000) }).catch(() => {});
  await page.keyboard.press('Space');
  // The page takes the key on its next frame (a second or more on a loaded page). It skipped (not ran out), and
  // Space did only that (no free camera).
  await page.waitForFunction(() => window.__cs.spec().killCam === null, null, { timeout: T(15000) }).catch(() => {});
  const skipped = await spec();
  check(skipped.killCam === null && skipped.killCamEnd === 'skipped' && !skipped.free, `a key skips the kill cam (${JSON.stringify({ killCam: skipped.killCam, end: skipped.killCamEnd, free: skipped.free, following: skipped.following })})`);
  await sim(page, (m, me) => void (me.respawnTick = m.tick));
  await page.waitForFunction(() => window.__cs.local.alive && !window.__cs.spec().out, null, { timeout: T(5000) }).catch(() => {});
  // Spectate by choice (pause menu): out of the match, a bot in the place, the free camera; Join game puts you back.
  const before = await sim(page, (m) => m.combatants().length);
  const offer = await page.evaluate(() => ({ shown: !document.getElementById('pause-spectate')?.hidden, text: document.getElementById('pause-spectate')?.textContent }));
  check(offer.shown && offer.text === 'Spectate', `the pause menu offers Spectate (${JSON.stringify(offer)})`);
  // The menu's button (clicked as the page would: the menu is hidden while a test plays).
  await page.evaluate(() => document.getElementById('pause-spectate').click());
  await page.waitForFunction(() => window.__cs.spec().spectator, null, { timeout: T(5000) }).catch(() => {});
  const out = await sim(page, (m, me) => ({ empty: m.slots[me.slot] === null, spectator: m.isSpectator(me.slot), n: m.combatants().length }));
  const s1 = await spec();
  check(s1.spectator && out.empty && out.spectator && out.n === before && s1.rule.freeCam, `spectating takes you out of the match, a bot fills the place (${JSON.stringify(out)}, ${before} before)`);
  check((await page.textContent('#pause-spectate')) === 'Join game', 'and the button says Join game');
  await page.evaluate(() => (window.__autoInput = { right: 1 }));
  await until(async () => (await spec()).following >= 0 || (await spec()).free, T(3000));
  await page.evaluate(() => delete window.__autoInput);
  await page.evaluate(() => (document.getElementById('pause').hidden = true));
  await shot('spectator');
  await page.evaluate(() => document.getElementById('pause-spectate').click());
  const alive = await page.waitForFunction(() => !window.__cs.spec().spectator && window.__cs.local.alive, null, { timeout: T(15000) }).then(() => true, () => false);
  const joined = await sim(page, (m, me) => ({ human: m.slots[me.slot]?.kind === 'human', n: m.combatants().length }));
  check(alive && joined.human && joined.n === before, `Join game puts you back in play (${JSON.stringify({ ...joined, alive })})`);
  check(errors.length === 0, `no page errors while spectating (${errors.join('; ')})`);
  livePages.delete(page);
  await page.context().close();
}

/**
 * A phone held sideways (Pixel 7, landscape, touch): the on-screen controls appear only there, and moving,
 * looking, firing, jumping, crouching, the weapon wheel, pausing and the turn-sideways prompt work by touch
 * (CDP touch events, so the browser makes real touch pointers).
 */
async function mobileFlow(browser) {
  const phone = devices['Pixel 7'];
  const ctx = await browser.newContext({ ...phone, viewport: { width: phone.viewport.height, height: phone.viewport.width }, screen: { width: phone.screen.height, height: phone.screen.width } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  const centre = async (sel) => {
    const b = await page.locator(sel).boundingBox();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height };
  };
  const state = () => page.evaluate(() => ({ pos: { ...window.__cs.local.state.pos }, yaw: window.__cs.input.yaw, held: window.__cs.local.held, mag: window.__cs.local.inventory.get(window.__cs.local.held)?.[0] }));
  /** Hold a finger at (x, y) until `pred` (page side) holds, then lift it; whether it held in time. */
  const holdUntil = async (x, y, id, pred, ms, arg) => {
    await touch('touchStart', [{ x, y, id }]);
    const ok = await page.waitForFunction(pred, arg, { timeout: T(ms) }).then(() => true, () => false);
    await touch('touchEnd', []);
    return ok;
  };

  await page.goto(CLIENT);
  await page.waitForFunction(() => window.__front, null, { timeout: T(30000) });
  check(await page.evaluate(() => document.documentElement.classList.contains('touch')), 'a phone is detected as a touch device (html.touch)');
  // Lighter defaults on a phone: Low graphics, 75% render scale.
  await page.tap('#nav-options');
  await page.waitForSelector('.opt-nav');
  await page.tap('.opt-nav button[data-tab="display"]');
  const display = await page.$$eval('.opt-row select', (ss) => ss.map((s) => s.value));
  check(display.includes('low') && display.includes('performance'), `a phone starts on Low graphics and the Performance render scale (${display.join(', ')})`);
  await page.tap('.opt-nav button[data-tab="controls"]');
  check(await page.isVisible('.opt-sub:has-text("Touch")'), 'Options → Controls lists the touch controls on a phone');
  await page.screenshot({ path: `${ARTIFACTS}/mobile-options.png` });

  // You alone on the range (&bots=1: one player in all). Its deathmatch bots shot the god-mode you about (their swarm
  // rockets' and rounds' knockback): the "walk" could be a blast's push, and the jump's tap could land while a hit
  // had you in the air (CI: grounded false, velY -1.0 / -2.5 at the tap), so the tap did nothing.
  await page.goto(`${CLIENT}/?offline=training_range&test=1&god=1&bots=1`);
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 1 && window.__cs.phase() !== 'waiting' && window.__cs.phase() !== 'countdown', null, { timeout: T(60000) });
  check(await page.evaluate(() => !document.getElementById('pause').hidden && document.getElementById('touch-ui').hidden), 'the match opens paused; the controls wait for Resume');
  await page.tap('#resume');
  await page.waitForFunction(() => !document.getElementById('touch-ui').hidden && document.getElementById('pause').hidden, null, { timeout: T(5000) }).catch(() => {});
  check(await page.isVisible('#touch-ui .tc-pad') && (await page.isVisible('#touch-ui .tc-fire')) && (await page.isVisible('#touch-ui .tc-wheel')), 'Resume starts touch play: pad, Fire and Weapons buttons show (no pointer lock)');
  await page.screenshot({ path: `${ARTIFACTS}/mobile-play.png` });

  // Move: push the pad forward.
  const pad = await centre('#touch-ui .tc-pad');
  let before = await state();
  const moved = await holdUntil(pad.x, pad.y - pad.h * 0.4, 1, (p) => Math.hypot(window.__cs.local.state.pos.x - p.x, window.__cs.local.state.pos.z - p.z) > 1, 8000, before.pos);
  check(moved, 'pushing the pad walks you');
  // Look: drag on the right half.
  before = await state();
  const vw = page.viewportSize().width;
  await touch('touchStart', [{ x: vw * 0.62, y: 140, id: 2 }]);
  for (let i = 1; i <= 8; i++) await touch('touchMove', [{ x: vw * 0.62 + i * 20, y: 140, id: 2 }]);
  await touch('touchEnd', []);
  const looked = await page.waitForFunction((y) => Math.abs(window.__cs.input.yaw - y) > 0.3, before.yaw, { timeout: T(5000) }).then(() => true, () => false);
  check(looked, 'dragging on the right half turns the view');
  // Fire: hold the button until a round goes.
  const fire = await centre('#touch-ui .tc-fire');
  before = await state();
  check(await holdUntil(fire.x, fire.y, 3, (m) => window.__cs.local.inventory.get(window.__cs.local.held)?.[0] < m, 8000, before.mag), `holding Fire shoots (magazine ${before.mag} went down)`);
  // Jump: a tap on the pad's middle. Tap or hold is read from the events' own times (a slow software-rendered
  // page handles the lift late), so the tap says when it happened: 80 ms apart. A jump is taken only on the ground:
  // tap once you stand on it (the walk above can still be carrying you).
  await page.waitForFunction(() => window.__cs.local.state.grounded && Math.abs(window.__cs.local.state.velY) < 0.01, null, { timeout: T(10000) }).catch(() => {});
  before = await state();
  // (Noted for the message if it doesn't jump: the pad's pointer events as the page saw them, and the body.)
  await page.evaluate(() => {
    window.__padSeen = [];
    const pad = document.querySelector('#touch-ui .tc-pad');
    for (const t of ['pointerdown', 'pointerup', 'pointercancel']) pad.addEventListener(t, (e) => window.__padSeen.push(`${t}@${Math.round(e.timeStamp)}`), { capture: true });
    window.__padSeen.push(`grounded ${window.__cs.local.state.grounded} velY ${window.__cs.local.state.velY.toFixed(2)}`);
  });
  const t0 = Date.now() / 1000;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pad.x, y: pad.y, id: 4 }], timestamp: t0 });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [], timestamp: t0 + 0.08 });
  const jumped = await page.waitForFunction((y) => window.__cs.local.state.pos.y > y + 0.3, before.pos.y, { timeout: T(5000) }).then(() => true, () => false);
  const padSeen = jumped ? '' : await page.evaluate(() => ` (${window.__padSeen.join(', ')}; now grounded ${window.__cs.local.state.grounded}, y ${window.__cs.local.state.pos.y.toFixed(2)}, crouch ${window.__cs.input.crouchOn})`);
  check(jumped, `a tap on the pad middle jumps${padSeen}`);
  await page.waitForFunction((y) => Math.abs(window.__cs.local.state.pos.y - y) < 0.1, before.pos.y, { timeout: T(5000) }).catch(() => {});
  // Crouch: hold the middle (and again to stand).
  check(await holdUntil(pad.x, pad.y, 5, () => window.__cs.input.crouchOn, 5000), 'holding the pad middle crouches');
  await holdUntil(pad.x, pad.y, 6, () => !window.__cs.input.crouchOn, 5000);
  // The weapon wheel: the Weapons button opens it; a tap on a weapon switches.
  const wb = await centre('#touch-ui .tc-wheel');
  await touch('touchStart', [{ x: wb.x, y: wb.y, id: 7 }]);
  await touch('touchEnd', []);
  const opened = await page.waitForFunction(() => !document.getElementById('weapon-wheel').hidden && document.querySelectorAll('#weapon-wheel .ww-item').length > 1, null, { timeout: T(5000) }).then(() => true, () => false);
  const items = await page.$$eval('#weapon-wheel .ww-item', (is) => is.map((i) => ({ code: Number(i.dataset.code), held: i.classList.contains('held'), icon: !!i.querySelector('img'), text: i.textContent })));
  check(opened && items.some((i) => i.held) && items.every((i) => i.icon), `Weapons opens the wheel with each weapon's icon, name and ammo (${items.map((i) => i.text).join(' | ')})`);
  await page.screenshot({ path: `${ARTIFACTS}/mobile-wheel.png` });
  const other = items.find((i) => !i.held);
  if (other) {
    const it = await centre(`#weapon-wheel .ww-item[data-code="${other.code}"]`);
    await touch('touchStart', [{ x: it.x, y: it.y, id: 8 }]);
    await touch('touchEnd', []);
    const switched = await page.waitForFunction((c) => window.__cs.local.held === c && document.getElementById('weapon-wheel').hidden, other.code, { timeout: T(5000) }).then(() => true, () => false);
    check(switched, 'tapping a weapon on the wheel switches to it and closes the wheel');
    // Weapons again, then Weapons once more (outside the ring): it closes without switching.
    await touch('touchStart', [{ x: wb.x, y: wb.y, id: 10 }]);
    await touch('touchEnd', []);
    await page.waitForFunction(() => !document.getElementById('weapon-wheel').hidden, null, { timeout: T(5000) }).catch(() => {});
    await touch('touchStart', [{ x: wb.x, y: wb.y, id: 11 }]);
    await touch('touchEnd', []);
    const kept = await page.waitForFunction((c) => document.getElementById('weapon-wheel').hidden && window.__cs.local.held === c, other.code, { timeout: T(5000) }).then(() => true, () => false);
    check(kept, 'a tap outside the wheel closes it and keeps your weapon');
  }
  // A big arsenal: the wheel shrinks its items to fit the ring (names, then ammo, move to the middle); none overlap.
  const many = ['core.rifle', 'core.shotgun', 'core.smg', 'core.sniper', 'core.lmg', 'core.rockets', 'core.launcher', 'core.marksman', 'core.burst_rifle', 'core.hand_cannon', 'core.flamethrower', 'core.railgun', 'core.plasma', 'core.knife', 'core.sawed_off', 'core.auto_shotgun', 'core.disc_launcher', 'core.laser_rifle'];
  await page.evaluate((ids) => { for (const id of ids) window.__give?.(id); }, many);
  await page.waitForFunction(() => window.__cs.local.inventory.size >= 14, null, { timeout: T(5000) }).catch(() => {});
  await touch('touchStart', [{ x: wb.x, y: wb.y, id: 12 }]);
  await touch('touchEnd', []);
  await page.waitForFunction(() => !document.getElementById('weapon-wheel').hidden && document.querySelectorAll('#weapon-wheel .ww-item').length >= 14, null, { timeout: T(5000) }).catch(() => {});
  const crowd = await page.$$eval('#weapon-wheel .ww-item', (is) => {
    const r = is.map((i) => i.getBoundingClientRect());
    let overlaps = 0;
    for (let a = 0; a < r.length; a++) for (let b = a + 1; b < r.length; b++) {
      const w = Math.min(r[a].right, r[b].right) - Math.max(r[a].left, r[b].left);
      const h = Math.min(r[a].bottom, r[b].bottom) - Math.max(r[a].top, r[b].top);
      if (w > 2 && h > 2) overlaps++;
    }
    return { n: r.length, overlaps };
  });
  await page.screenshot({ path: `${ARTIFACTS}/mobile-wheel-many.png` });
  check(crowd.n >= 14 && crowd.overlaps === 0, `with a big arsenal the wheel's weapons all fit without overlapping (${crowd.n} weapons, ${crowd.overlaps} overlaps)`);
  await touch('touchStart', [{ x: wb.x, y: wb.y, id: 13 }]);
  await touch('touchEnd', []);
  await page.waitForFunction(() => document.getElementById('weapon-wheel').hidden, null, { timeout: T(5000) }).catch(() => {});
  // Held upright: the turn-sideways prompt.
  await page.setViewportSize({ width: phone.viewport.width, height: phone.viewport.height });
  check(await page.waitForFunction(() => getComputedStyle(document.getElementById('touch-rotate')).display !== 'none', null, { timeout: T(3000) }).then(() => true, () => false), 'portrait shows the turn-sideways prompt');
  await page.screenshot({ path: `${ARTIFACTS}/mobile-portrait.png` });
  await page.setViewportSize({ width: phone.viewport.height, height: phone.viewport.width });
  // The pause button stops touch play.
  const pb = await centre('#touch-ui .tc-pause');
  await touch('touchStart', [{ x: pb.x, y: pb.y, id: 9 }]);
  await touch('touchEnd', []);
  check(await page.waitForFunction(() => !document.getElementById('pause').hidden && document.getElementById('touch-ui').hidden, null, { timeout: T(5000) }).then(() => true, () => false), 'the pause button opens the pause menu and hides the controls');
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await ctx.close();
}

async function vaultFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  await page.goto(`${CLIENT}/?offline=vault`);
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() !== 'waiting' && window.__cs.phase() !== 'countdown', null, { timeout: T(60000) });
  await page.waitForFunction(() => (document.getElementById('objectives')?.textContent ?? '').includes('Find the vault control'), null, { timeout: T(10000) }).catch(() => {});
  const objectives = await page.textContent('#objectives');
  check((objectives ?? '').includes('Find the vault control'), `scenario demo shows its first objective (${objectives})`);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

async function outpostFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  await page.goto(`${CLIENT}/?offline=outpost`);
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() !== 'waiting' && window.__cs.phase() !== 'countdown', null, { timeout: T(60000) });
  await page.waitForFunction(() => (document.getElementById('objectives')?.textContent ?? '').includes('Clear the courtyard'), null, { timeout: T(10000) }).catch(() => {});
  const objectives = await page.textContent('#objectives');
  check((objectives ?? '').includes('Clear the courtyard'), `co-op mission shows its first objective (${objectives})`);
  // Player, two bot teammates and at least one NPC squad, all as animated characters.
  await page.waitForFunction(() => window.__cs.view.characterCount() >= 7, null, { timeout: T(20000) }).catch(() => {});
  const chars = await page.evaluate(() => window.__cs.view.characterCount());
  check(chars >= 7, `players, bots and NPC squads are rendered as characters (${chars})`);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

async function sandgateFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  await page.goto(`${CLIENT}/?offline=sandgate`);
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() !== 'waiting' && window.__cs.phase() !== 'countdown', null, { timeout: T(60000) });
  await page.waitForFunction(() => /Embers/.test(document.getElementById('scorebar')?.textContent ?? '') && /Tide/.test(document.getElementById('scorebar')?.textContent ?? ''), null, { timeout: T(10000) }).catch(() => {});
  const score = (await page.textContent('#scorebar')) ?? '';
  check(score.includes('Embers') && score.includes('Tide'), `team deathmatch shows both team scores (${score})`);
  await page.waitForFunction(() => window.__cs.view.characterCount() >= 8, null, { timeout: T(20000) }).catch(() => {});
  const chars = await page.evaluate(() => window.__cs.view.characterCount());
  check(chars >= 8, `5 v 5 bots are rendered as characters (${chars})`);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

async function citadelFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  await page.goto(`${CLIENT}/?offline=citadel`);
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() !== 'waiting' && window.__cs.phase() !== 'countdown', null, { timeout: T(60000) });
  await page.waitForFunction(() => window.__cs.view.scene.transformNodes.filter((n) => n.name.startsWith('prop_') && !n.name.includes('_model')).length >= 35, null, { timeout: T(15000) }).catch(() => {});
  const props = await page.evaluate(() => window.__cs.view.scene.transformNodes.filter((n) => n.name.startsWith('prop_') && !n.name.includes('_model')).length);
  check(props >= 35, `Citadel's props are placed (${props})`);
  // A bot can down you in the first seconds (the HUD blanks until you respawn): wait for it to show again.
  await page.waitForFunction(() => /1/.test(document.getElementById('throwable').textContent ?? ''), null, { timeout: T(15000) }).catch(() => {});
  const grenades = await page.evaluate(() => document.getElementById('throwable').textContent);
  check(/1/.test(grenades ?? ''), `HUD shows the starting grenade (${grenades})`);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

async function canyonFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  // The game: terrain meshes per ground material, and players stand on the ground.
  await page.goto(`${CLIENT}/?offline=canyon`);
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() !== 'waiting' && window.__cs.phase() !== 'countdown', null, { timeout: T(60000) });
  // Each ground material is its own mesh, or (WebGL2) merged with the level over array textures (levelMerge.ts): by name.
  const terrainNames = () => [...window.__cs.view.scene.meshes.map((m) => m.name), ...(window.__cs.view.levelDraws?.merged ?? [])].filter((n) => n.includes('_terrain_'));
  await page.waitForFunction(`(${terrainNames})().length >= 5`, null, { timeout: T(15000) }).catch(() => {});
  const grounds = await page.evaluate(`(${terrainNames})().map((n) => n.split('_terrain_')[1])`);
  check(grounds.length >= 5 && grounds.includes('grass') && grounds.includes('stone'), `canyon terrain is drawn in its ground materials (${grounds.join(', ')})`);
  const y = await page.evaluate(() => window.__cs.local.eye.y);
  check(y > 0.5 && y < 3, `the player stands on the ground at a base (eye ${y.toFixed(2)} m)`);
  // MapMaker: create terrain, sculpt a hill, undo it.
  await page.goto(`${CLIENT}/?mode=editor`);
  await page.waitForFunction(() => window.__editor, null, { timeout: T(30000) });
  page.once('dialog', (d) => d.accept());
  // New offers sizes of open ground (Medium by default) or the sky.
  await page.click('#ed-new');
  const sizes = await page.$$eval('#ed-new-sizes button', (bs) => bs.map((b) => `${b.dataset.size}${b.classList.contains('on') ? '*' : ''}`));
  await page.click('#ed-new-create');
  await page.waitForFunction(() => window.__editor.doc.terrain, null, { timeout: T(5000) }).catch(() => {});
  const span = await page.evaluate(() => { const t = window.__editor.doc.terrain; return t ? (t.cols - 1) * t.spacing : 0; });
  check(sizes.join() === '96,160*,240,320,0' && span === 160, `a new map starts on 160 m of terrain; New offers 96/160/240/320 m or the sky (${sizes.join()}; ${span} m)`);
  await newMap(page);
  // Terrain lives in the Environment workspace (one home per pane).
  await page.click('#ed-env-btn');
  await page.click('#ed-pal-tabs [data-pane="terrain"]');
  await page.click('#ed-tr-new');
  check(await page.evaluate(() => !!window.__editor.doc.terrain), 'MapMaker creates terrain');
  await clickTool(page, '[data-tool="terrain:raise"]');
  // Clear of the new map's starting room (ground under a floor stays below it).
  const p = await page.evaluate(() => window.__editor.view.project({ x: 18, y: 0, z: 0 }));
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  // Hold until the hill has grown (headless frame rates vary), at most 6 s.
  await page.waitForFunction(() => Math.max(...window.__editor.view.scene.meshes.filter((m) => m.name.includes('_terrain_')).map((m) => m.getBoundingInfo().boundingBox.maximumWorld.y)) > 0.5, null, { timeout: T(6000) }).catch(() => {});
  await page.mouse.up();
  const peak = await page.evaluate(() => Math.max(...window.__editor.doc.terrain.heights));
  check(peak > 50, `raise brush builds a hill (${peak} cm)`);
  await page.keyboard.press('Control+z');
  const flat = await page.evaluate(() => Math.max(...window.__editor.doc.terrain.heights));
  check(flat === 0, 'undo takes the whole stroke back');
  // Flatten to a typed height: the ground under the stroke goes to it, wherever the stroke starts.
  await clickTool(page, '[data-tool="terrain:flatten"]');
  await page.fill('#ed-tr-flatten-y', '3');
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.waitForFunction(() => Math.max(...window.__editor.doc.terrain.heights) > 0 || window.__editor.stroke?.now.heights.some((h) => h > 250), null, { timeout: T(6000) }).catch(() => {});
  await page.mouse.up();
  const typed = await page.evaluate(() => Math.max(...window.__editor.doc.terrain.heights));
  check(typed > 250 && typed <= 315, `Flatten to (m) levels the ground to the typed 3 m (${typed} cm over the terrain's base)`);
  await page.fill('#ed-tr-flatten-y', '');
  // A game mode's marker (a Breakthrough spawn group) placed on that raised ground stands on it, not at the level's height.
  await clickTool(page, '[data-tool="scenario:spawn:attack"]');
  await page.mouse.move(p.x + 3, p.y + 2);
  await page.mouse.move(p.x, p.y);
  await page.mouse.click(p.x, p.y);
  await page.waitForFunction(() => window.__editor.doc.entities.some((e) => e.kind === 'spawn' && e.side === 'attack'), null, { timeout: T(5000) }).catch(() => {});
  // (Against the ground under it: the brush works by time, so on a slow runner the stroke may stop short of 3 m.)
  const marker = await page.evaluate(() => {
    const e = window.__editor.doc.entities.find((x) => x.kind === 'spawn' && x.side === 'attack');
    const t = window.__editor.doc.terrain;
    if (!e || !t) return null;
    // The terrain's height there (terrainHeightAt: the mesh's triangles).
    const fx = (e.position[0] - t.origin[0]) / t.spacing;
    const fz = (e.position[2] - t.origin[1]) / t.spacing;
    const c = Math.floor(fx);
    const r = Math.floor(fz);
    const u = fx - c;
    const v = fz - r;
    const y = (cc, rr) => t.baseY + (t.heights[rr * t.cols + cc] ?? 0) / 100;
    const ground = v >= u ? y(c, r) + (y(c + 1, r + 1) - y(c, r + 1)) * u + (y(c, r + 1) - y(c, r)) * v : y(c, r) + (y(c + 1, r) - y(c, r)) * u + (y(c + 1, r + 1) - y(c + 1, r)) * v;
    return { y: e.position[1], ground };
  });
  check(!!marker && marker.ground > 1 && Math.abs(marker.y - marker.ground) < 0.3, `an Attackers' Spawn placed on raised ground stands on it (${JSON.stringify(marker)})`);
  // An oblong terrain: width and depth (the grid 2.5 m past 320 m). (Placing the spawn opened its pane: back to Terrain.)
  await clickTool(page, '#ed-tr-remove');
  await page.fill('#ed-tr-new-w', '380');
  await page.fill('#ed-tr-new-d', '320');
  await page.click('#ed-tr-new');
  const oblong = await page.evaluate(() => { const t = window.__editor.doc.terrain; return t && { cols: t.cols, rows: t.rows, spacing: t.spacing, label: document.getElementById('ed-tr-size').textContent }; });
  check(oblong?.cols === 153 && oblong.rows === 129 && oblong.spacing === 2.5, `Create terrain makes a 380 x 320 m terrain at 2.5 m (${JSON.stringify(oblong)})`);
  // Map properties: the modes a map also offers besides its main one. (Escape leaves the tool, again lets go of the
  // spawn placed above: nothing selected shows the map's properties.)
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  // (At this width the inspector may be folded away: the box is clicked where it is.)
  await page.waitForSelector('#ed-prop-also input[data-mode="core.tdm"]', { state: 'attached', timeout: T(5000) });
  await page.evaluate(() => document.querySelector('#ed-prop-also input[data-mode="core.tdm"]').click());
  const modes = await page.evaluate(() => window.__editor.doc.metadata.supportedModes);
  check(modes.length === 2 && modes[1] === 'core.tdm', `Map properties' Also offered adds Team Deathmatch to the map's modes (${modes.join(', ')})`);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

async function sceneryFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  // The game: a photo sky, ground and scenery past the border, and grass growing on the canyon floor.
  await page.goto(`${CLIENT}/?offline=canyon`);
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() !== 'waiting' && window.__cs.phase() !== 'countdown', null, { timeout: T(60000) });
  await page.waitForFunction(() => window.__cs.view.scene.meshes.some((m) => m.name.startsWith('foliage') && m.thinInstanceCount > 0), null, { timeout: T(15000) }).catch(() => {});
  const canyon = await page.evaluate(() => {
    const ms = window.__cs.view.scene.meshes;
    return { names: [...new Set(ms.filter((m) => m.name.startsWith('backdrop_')).map((m) => m.name))], plants: ms.filter((m) => m.name.startsWith('foliage')).reduce((n, m) => n + (m.thinInstanceCount || 0), 0), fog: window.__cs.view.scene.fogMode };
  });
  check(canyon.names.includes('backdrop_sky') && canyon.names.includes('backdrop_ground') && canyon.names.includes('backdrop_ridge'), `canyon has a sky, ground beyond and distant scenery (${canyon.names.join(', ')})`);
  check(canyon.plants > 1000 && canyon.fog > 0, `grass grows on the canyon floor (${canyon.plants} plants) under haze`);
  // Its border: sheer cliffs all round, one mesh.
  const cliffs = await page.evaluate(() => window.__cs.view.scene.meshes.filter((m) => m.name === 'border_cliffs' && m.isEnabled() && m.getTotalVertices() > 1000).length);
  check(cliffs === 1, `the canyon is ringed by a cliff border (${cliffs} mesh)`);
  await page.goto(`${CLIENT}/?offline=skyward`);
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() !== 'waiting' && window.__cs.phase() !== 'countdown', null, { timeout: T(60000) });
  const space = await page.evaluate(() => window.__cs.view.scene.meshes.filter((m) => m.name.startsWith('backdrop_')).map((m) => m.name));
  check(space.includes('backdrop_sky') && !space.includes('backdrop_ground'), `Skyward floats in a starfield with no ground (${space.join(', ')})`);
  // MapMaker: pick a backdrop, paint plants, brush a wood (the Environment brush).
  await page.goto(`${CLIENT}/?mode=editor`);
  await page.waitForFunction(() => window.__editor, null, { timeout: T(30000) });
  page.once('dialog', (d) => d.accept());
  await newMap(page);
  // The backdrop lives in Environment → Sky.
  await page.click('#ed-env-btn');
  await page.click('#ed-pal-tabs [data-pane="sky"]');
  await page.selectOption('#ed-bd-sky', 'sunset');
  await page.waitForFunction(() => window.__editor.doc.backdrop?.sky === 'sunset' && window.__editor.view.scene.meshes.some((m) => m.name === 'backdrop_sky'), null, { timeout: T(5000) }).catch(() => {});
  const bd = await page.evaluate(() => ({ sky: window.__editor.doc.backdrop?.sky, mesh: window.__editor.view.scene.meshes.some((m) => m.name === 'backdrop_sky') }));
  check(bd.sky === 'sunset' && bd.mesh, `MapMaker sets the map's sky (${bd.sky})`);
  await page.click('#ed-blood-amount');
  await page.selectOption('#ed-blood-amount', 'heavy');
  await page.click('.ed-row-buttons button:has-text("Alien")');
  const blood = await page.evaluate(() => window.__editor.doc.blood);
  check(blood?.color === '#3f9b1f' && blood?.amount === 'heavy', `MapMaker sets the map's blood (${JSON.stringify(blood)})`);
  // Terrain lives in the Environment workspace (one home per pane).
  await page.click('#ed-env-btn');
  await page.click('#ed-pal-tabs [data-pane="terrain"]');
  await page.click('#ed-tr-new');
  await page.click('#ed-pal-tabs [data-pane="sky"]');
  // A border along the terrain's edge, previewed live: an electric fence, then cliffs on the north side.
  await page.selectOption('#ed-bd-border', 'fence');
  await page.waitForFunction(() => window.__editor.view.scene.meshes.some((m) => m.name === 'border_fence_posts' && m.thinInstanceCount > 10), null, { timeout: T(10000) }).catch(() => {});
  const fenced = await page.evaluate(() => ({ border: window.__editor.doc.backdrop?.border, posts: window.__editor.view.scene.meshes.find((m) => m.name === 'border_fence_posts')?.thinInstanceCount ?? 0 }));
  check(fenced.border === 'fence' && fenced.posts > 10, `MapMaker sets an electric fence border and previews it (${fenced.posts} posts)`);
  await page.click('#ed-bd-border-sides summary');
  await page.selectOption('#ed-bd-border-north', 'cliffs');
  await page.waitForFunction(() => window.__editor.view.scene.meshes.some((m) => m.name === 'border_cliffs'), null, { timeout: T(10000) }).catch(() => {});
  const mixed = await page.evaluate(() => ({ sides: window.__editor.doc.backdrop?.borderSides, cliffs: window.__editor.view.scene.meshes.some((m) => m.name === 'border_cliffs') }));
  check(mixed.sides?.north === 'cliffs' && mixed.cliffs, `MapMaker mixes border styles per side (${JSON.stringify(mixed.sides)})`);
  // Back from Sky to the Terrain pane for its plants.
  await page.click('#ed-pal-tabs [data-pane="terrain"]');
  await page.click('[data-foliage="4"]');
  const at = async (x, z) => page.evaluate(([x, z]) => window.__editor.view.project({ x, y: 0, z }), [x, z]);
  let p = await at(0, 0);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.waitForTimeout(300); // wait-ok: a held brush stroke
  await page.mouse.up();
  const lush = await page.evaluate(() => window.__editor.doc.terrain.foliage.filter((v) => v === 4).length);
  check(lush > 5, `the plants brush paints overgrown cells (${lush})`);
  // N takes up the Environment brush (the Scatter Brush it replaced is retired).
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('KeyN');
  check(await page.evaluate(() => window.__editor.tool?.kind === 'envbrush'), 'N takes up the Environment brush');
  await page.selectOption('#ed-env-preset', 'temperate');
  p = await at(20, 20);
  await page.mouse.move(p.x, p.y);
  await page.mouse.click(p.x, p.y);
  const trees = await page.evaluate(() => window.__editor.doc.entities.filter((e) => e.kind === 'prop').length);
  check(trees >= 3, `the Environment brush plants a patch of woods (${trees} plants)`);
  await page.keyboard.press('Control+z');
  const undone = await page.evaluate(() => window.__editor.doc.entities.filter((e) => e.kind === 'prop').length);
  check(undone === 0, 'one undo takes the whole patch back');
  // Props stay on sloping ground: raise a hill, brush rocks and plants on its side, nothing floats.
  await clickTool(page, '[data-tool="terrain:raise"]');
  p = await at(20, 20);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  // Hold until the hill stands at least 1.5 m tall (headless frame rates vary), at most 8 s.
  await page.waitForFunction(() => Math.max(...window.__editor.doc.terrain.heights) > 150 || window.__editor.stroke?.now && Math.max(...window.__editor.stroke.now.heights) > 150, null, { timeout: T(8000) }).catch(() => {});
  await page.mouse.up();
  await clickTool(page, '[data-tool="envbrush"]');
  await page.selectOption('#ed-env-preset', 'alpine');
  // Bring the hillside to the middle of the view, clear of the tool bar over its top edge.
  await page.evaluate(() => window.__editor.view.focus({ x: 18, y: 0, z: 18 }));
  p = await at(18, 18);
  await page.mouse.move(p.x, p.y);
  await page.mouse.click(p.x, p.y);
  const rocks = await page.evaluate(() => {
    const doc = window.__editor.doc;
    const props = doc.entities.filter((e) => e.kind === 'prop');
    const t = doc.terrain;
    const h = (x, z) => {
      const fx = (x - t.origin[0]) / t.spacing, fz = (z - t.origin[1]) / t.spacing;
      const c = Math.floor(fx), r = Math.floor(fz);
      // The highest corner of the cell: anything above it is floating.
      return t.baseY + Math.max(...[[0, 0], [1, 0], [0, 1], [1, 1]].map(([i, j]) => t.heights[(r + j) * t.cols + c + i] ?? 0)) / 100;
    };
    return { n: props.length, worst: Math.max(...props.map((e) => e.position[1] - h(e.position[0], e.position[2]))) };
  });
  check(rocks.n > 0 && rocks.worst < 0.02, `brushed rocks and plants sit on the hillside (${rocks.n}, worst gap ${rocks.worst.toFixed(2)} m)`);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

async function setpiecesFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  await page.goto(`${CLIENT}/?offline=sky_islands&test=1&god=1`);
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() !== 'waiting' && window.__cs.phase() !== 'countdown' && window.__match, null, { timeout: T(60000) });
  await page.waitForFunction(() => {
    const ms = window.__cs.view.scene.meshes;
    return ms.filter((m) => /^sc_block_.*_body$/.test(m.name)).length >= 20 && ms.filter((m) => /_surface$/.test(m.name)).length === 2;
  }, null, { timeout: T(10000) }).catch(() => {});
  const drawn = await page.evaluate(() => {
    const ms = window.__cs.view.scene.meshes;
    return { blocks: ms.filter((m) => /^sc_block_.*_body$/.test(m.name)).length, liquids: ms.filter((m) => /_surface$/.test(m.name)).length };
  });
  check(drawn.blocks >= 20 && drawn.liquids === 2, `Sky Islands draws its crumbling stones, trapdoors and cover (${drawn.blocks}) and its pond and lava (${drawn.liquids})`);
  // Stand on the first crumbling stone north of the centre: it gives way.
  const stone = await page.evaluate(() => {
    const m = window.__match;
    const e = m.map.entities.find((x) => x.kind === 'block' && x.behaviour === 'crumble');
    const me = m.slots[window.__cs.slot];
    for (const c of m.slots) if (c && c !== me) c.alive = false;
    me.move = { pos: { x: e.position[0], y: e.position[1] + e.size[1] + 0.3, z: e.position[2] }, velY: 0, grounded: false };
    return e.id;
  });
  await page.waitForFunction((id) => window.__match.scenario.destructibleAlive(id) === false, stone, { timeout: T(10000) }).catch(() => {});
  check(await page.evaluate((id) => window.__match.scenario.destructibleAlive(id) === false, stone), 'a crumbling stone gives way under you');
  // Swim: drop into the pond; the view goes under water.
  await page.evaluate(() => { const me = window.__match.slots[window.__cs.slot]; me.move = { pos: { x: 0, y: 0.6, z: 0 }, velY: 0, grounded: false }; });
  // Swimming is the match's; the haze comes with the view's next frame (slow on CI): wait for both.
  await page.waitForFunction(() => window.__match.slots[window.__cs.slot].move.swim === true && window.__cs.view.scene.fogDensity > 0.05, null, { timeout: T(5000) }).catch(() => {});
  const under = await page.evaluate(() => ({ swim: window.__match.slots[window.__cs.slot].move.swim === true, fog: window.__cs.view.scene.fogDensity }));
  check(under.swim && under.fog > 0.05, `you swim in the pond and the view hazes under water (fog ${under.fog.toFixed(3)})`);
  // Low graphics (the e2e default) keep the plain ripple material and no render target; a shot across the pond splashes.
  const pond = await page.evaluate(() => {
    const v = window.__cs.view;
    v.scenario.liquids.fx.shot({ x: 0, y: 4, z: -3 }, { x: 0, y: -2, z: 3 });
    return { quality: v.scenario.liquids.quality, shaded: v.scenario.liquids.surfaces().length, mirror: v.scenario.liquids.mirrored, fx: v.scenario.liquids.fx.active, targets: v.scene.customRenderTargets.length };
  });
  check(pond.quality !== 'low' || (pond.shaded === 0 && !pond.mirror && pond.targets === 0), `low graphics keep the plain water and no render target (${JSON.stringify(pond)})`);
  check(pond.fx > 0, `a shot across the pond splashes (${pond.fx} rings and drops)`);
  // Jetpack: fly up while holding jump.
  await page.evaluate(() => { const me = window.__match.slots[window.__cs.slot]; me.move = { pos: { x: 8, y: 3, z: 8 }, velY: 0, grounded: true }; me.jetFuel = 720; window.__autoInput = { buttons: 1 }; });
  await page.waitForFunction(() => window.__match.slots[window.__cs.slot].move.pos.y > 7, null, { timeout: T(8000) }).catch(() => {});
  const fly = await page.evaluate(() => ({ y: window.__match.slots[window.__cs.slot].move.pos.y, hud: document.getElementById('powerups')?.textContent ?? '' }));
  await page.evaluate(() => (window.__autoInput = { buttons: 0 }));
  check(fly.y > 7 && /JETPACK/.test(fly.hud), `the jetpack flies you up (${fly.y.toFixed(1)} m) with a fuel gauge on the HUD`);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

async function physicsfxFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  await page.goto(`${CLIENT}/?offline=canyon&test=1&god=1`);
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() !== 'waiting' && window.__cs.phase() !== 'countdown' && window.__match, null, { timeout: T(60000) });
  // The bots stand where they spawn, firing nothing: left to play, they drove vehicles onto the open ground the bodies
  // are thrown on, and shot you off your mark (the checks below place them where they need them).
  await holdBots(page);
  await page.waitForFunction(() => window.__cs.view.scene.transformNodes.some((n) => n.name.startsWith('prop_') && !n.name.endsWith('_model') && n.rotationQuaternion && Math.abs(n.rotationQuaternion.x) + Math.abs(n.rotationQuaternion.z) > 0.01), null, { timeout: T(15000) }).catch(() => {});
  // Rocks, logs and plants lean with the slope; trees stay upright; nothing floats.
  const props = await page.evaluate(() => {
    const roots = window.__cs.view.scene.transformNodes.filter((n) => n.name.startsWith('prop_') && !n.name.endsWith('_model'));
    const leaning = roots.filter((n) => n.rotationQuaternion && Math.abs(n.rotationQuaternion.x) + Math.abs(n.rotationQuaternion.z) > 0.01).length;
    return { roots: roots.length, leaning };
  });
  check(props.leaning > 0, `natural props lean with the canyon's slopes (${props.leaning} of ${props.roots})`);
  /**
   * Open ground for the ragdoll checks, the same place on every run (bodies dropped or thrown by cover, or into a rock,
   * flew or stopped wherever they happened to be: CI, a blast that threw nothing, a body that moved 0.44 m out; locally,
   * a killed bot's body flung 10 m up). You are put 10 m off it, facing it.
   */
  const standByOpenGround = async () => {
    // The blasts below go off on open ground, the same place on every run, with you 10 m off: nothing of the level
    // within 5 m of it at body height (a bot standing by a rock or a wall was shielded from the throw, or its body thrown
    // into the rock: CI, "up no", "outward 0.44"; which depended on where the bot, or you, happened to be). The map is
    // searched on a fixed 4 m grid out from its middle (the level is static: the same spot every time), and you are put
    // where you see it.
    const open = await page.evaluate(() => {
      const m = window.__match;
      const v = window.__cs.view;
      const me = m.slots[window.__cs.slot];
      const groundAt = (x, z) => {
        const hit = v.raycastLevel({ x, y: 60, z }, { x: 0, y: -1, z: 0 }, 120);
        return hit ? 60 - hit.dist : null;
      };
      const clearAround = (x, y, z) => {
        // Level ground round it: within 0.6 m 3 m out every way.
        for (let a = 0; a < 8; a++) {
          const g = groundAt(x + Math.cos((a / 8) * Math.PI * 2) * 3, z + Math.sin((a / 8) * Math.PI * 2) * 3);
          if (g === null || Math.abs(g - y) > 0.6) return false;
        }
        // Nothing standing within 5 m at body height: the sim's level (the throw) and the effects world (the bodies).
        if (!m.physics.boxClear({ x, y: y + 1.9, z }, { x: 5, y: 1, z: 5 }, undefined, true)) return false;
        for (let a = 0; v.physics && a < 16; a++) {
          const d = { x: Math.cos((a / 16) * Math.PI * 2), y: 0, z: Math.sin((a / 16) * Math.PI * 2) };
          for (const h of [1, 1.6]) if (v.physics.raycast({ x, y: y + h, z }, d, 5)) return false;
        }
        return true;
      };
      const cells = [];
      for (let x = -80; x <= 80; x += 4) for (let z = -80; z <= 80; z += 4) cells.push({ x, z });
      cells.sort((p, q) => Math.hypot(p.x, p.z) - Math.hypot(q.x, q.z) || p.x - q.x || p.z - q.z);
      let checked = 0;
      for (const c of cells) {
        const y = groundAt(c.x, c.z);
        if (y === null || !clearAround(c.x, y, c.z)) continue;
        // (No vehicle or turret standing there either.)
        if (m.mounts.some((v) => Math.hypot(v.pos.x - c.x, v.pos.z - c.z) < 10)) continue;
        checked++;
        // You 10 m off (the first of eight ways with ground near its height, room to stand and a clear sight of it).
        for (let k = 0; k < 8; k++) {
          const yaw = k * (Math.PI / 4);
          const px = c.x - Math.sin(yaw) * 10;
          const pz = c.z - Math.cos(yaw) * 10;
          const py = groundAt(px, pz);
          if (py === null || Math.abs(py - y) > 1) continue;
          if (!m.physics.boxClear({ x: px, y: py + 1, z: pz }, { x: 0.6, y: 0.8, z: 0.6 }, undefined, true)) continue;
          if (!m.physics.lineOfSight({ x: px, y: py + 1.6, z: pz }, { x: c.x, y: y + 1, z: c.z })) continue;
          const me0 = { x: px, y: py + 0.05, z: pz };
          me.move = { ...me.move, pos: me0, vx: 0, vz: 0, velY: 0, grounded: false };
          return { at: { x: c.x, y, z: c.z }, me: me0, yaw, checked };
        }
      }
      return { at: null, checked };
    });
    check(!!open.at, `open ground for the ragdolls, with you 10 m off (${JSON.stringify(open)})`);
    // You land there.
    if (open.at) await page.waitForFunction((p) => { const me = window.__match.slots[window.__cs.slot]; return me.move.grounded && Math.hypot(me.move.pos.x - p.x, me.move.pos.z - p.z) < 1; }, open.me, { timeout: T(5000) }).catch(() => {});
    // And the view has you there (a slow page draws the move frames later: what is in view is judged from its camera).
    if (open.at) await page.waitForFunction((p) => { const c = window.__cs.view.camera.globalPosition; return Math.hypot(c.x - p.x, c.z - p.z) < 1.5; }, open.me, { timeout: T(15000) }).catch(() => {});
    // Face it (the mass blast is the bodies in view), turned round if the yaw went the wrong way.
    if (open.at) {
      await page.evaluate((yaw) => (window.__cs.input.yaw = yaw), open.yaw);
      await frames(page, 3);
      await page.evaluate((at) => {
        const cam = window.__cs.view.camera;
        const f = cam.getForwardRay(1).direction;
        const p = cam.globalPosition;
        if (f.x * (at.x - p.x) + f.z * (at.z - p.z) < 0) window.__cs.input.yaw += Math.PI;
      }, open.at);
      await frames(page, 3);
    }
    return open;
  };
  const open0 = await standByOpenGround();
  // Line up a bot on that open ground in front of you and kill it: it falls as a ragdoll and bleeds.
  await page.evaluate((open) => {
    const m = window.__match;
    const me = m.slots[window.__cs.slot];
    // (Not one seated in a vehicle or on a turret: moved, it stayed seated, and a tank's crew can't be hurt from outside.)
    const bot = m.slots.find((c) => c && c !== me && c.alive && !c.mount);
    for (const c of m.slots) if (c && c !== me && c !== bot) c.alive = false;
    const f = window.__cs.view.camera.getForwardRay(1).direction;
    const len = Math.hypot(f.x, f.z) || 1;
    // 4 m in front of you, towards the open ground.
    const d = open ? { x: open.x - me.move.pos.x, z: open.z - me.move.pos.z } : { x: f.x, z: f.z };
    const dl = Math.hypot(d.x, d.z) || len;
    bot.move = { ...bot.move, pos: { x: me.move.pos.x + (d.x / dl) * 4, y: me.move.pos.y + 0.5, z: me.move.pos.z + (d.z / dl) * 4 }, vx: 0, vz: 0, velY: 0, grounded: false };
    window.__botSlot = bot.slot;
    window.__autoInput = { buttons: 0 };
  }, open0.at);
  // The bot lands where it was put and its avatar stands there.
  await page.waitForFunction(() => {
    const bot = window.__match.slots[window.__botSlot];
    const a = window.__cs.view.avatars.get(bot?.slot);
    return bot?.move.grounded && !!a?.anim?.ch.joints.get('Head') && Math.hypot(a.root.position.x - bot.move.pos.x, a.root.position.z - bot.move.pos.z) < 0.5;
  }, null, { timeout: T(15000) }).catch(() => {});
  await frames(page, 5);
  const standing = await page.evaluate(() => {
    const m = window.__match;
    const me = m.slots[window.__cs.slot];
    const bot = m.slots[window.__botSlot];
    const standing = window.__cs.view.avatars.get(bot.slot)?.anim?.ch.joints.get('Head')?.getAbsolutePosition().y ?? null;
    window.__cs.view.pushPlayer(bot.slot, { x: (bot.move.pos.x - me.move.pos.x) * 1.2, y: 2, z: (bot.move.pos.z - me.move.pos.z) * 1.2 });
    // No attacker: the bot may be on your team (no friendly fire; Team Deathmatch on the canyon: the first other slot
    // was a teammate on some runs, and nothing died).
    m.damage(bot, 500, null, 'core.pistol');
    return standing;
  });
  await page.addStyleTag({ content: '#pause { display: none !important; }' });
  // The view takes the death on its next frame: on a software renderer that frame can wait a second or
  // two behind the match's first shader builds, longer than the sampling below lasts.
  await page.waitForFunction(() => window.__cs.view.corpses.some((c) => c.slot === window.__botSlot), null, { timeout: T(6000) }).catch(() => {});
  // Sample the fall while the body is down (the bot respawns 2-3 s after dying).
  // Measured from where its head was before the shot (a slow runner may sample it already down);
  // stop as soon as it has dropped, before the bot gets up again 2-3 s later.
  const track = standing === null ? [] : [standing];
  let ragdolled = false;
  // The push can throw the body up first and land it on something higher than it stood: measure the fall from its peak.
  const fell = () => { const top = track.indexOf(Math.max(...track)); return track.length ? track[top] - Math.min(...track.slice(top)) : 0; };
  // Physics steps with the frames: on a slow software renderer a second of sampling can be two frames.
  // (The body is a corpse of its own: the bot respawning doesn't end it.)
  const until = Date.now() + T(8000);
  while (Date.now() < until && !(ragdolled && fell() > 0.5)) {
    await page.waitForTimeout(T(150) / 2); // wait-ok: sampling interval of the fall
    const s = await page.evaluate(() => {
      // A killed body leaves the live avatars for the corpse list as soon as it ragdolls (the body,
      // not the bot that respawns in its slot).
      const v = window.__cs.view;
      const a = v.corpses.findLast((c) => c.slot === window.__botSlot)?.a ?? v.avatars.get(window.__botSlot);
      const head = a?.anim?.ch.joints.get('Head');
      return { rag: !!a?.ragdoll, head: head ? head.getAbsolutePosition().y : null };
    });
    ragdolled ||= s.rag;
    if (s.head !== null) track.push(s.head);
  }
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/physicsfx-ragdoll.png` });
  // The sampling above stops once the body is down: give the blood time to land.
  // Splats are thin instances of one disc (bloodVisuals.ts): count them.
  await page.waitForFunction(() => window.__cs.view.blood.splatCount > 0, null, { timeout: T(2500) }).catch(() => {});
  const dead = await page.evaluate(() => {
    const v = window.__cs.view;
    const c = v.corpses.findLast((x) => x.slot === window.__botSlot);
    return { splats: v.blood.splatCount, why: { physics: !!v.physics, corpse: !!c, model: !!c?.a.anim?.ch, fall: !!c?.a.fall, death: v.lastDeath ?? null } };
  });
  check(ragdolled && fell() > 0.5, `the killed bot drops as a ragdoll (${ragdolled ? 'ragdoll' : `no ragdoll: ${JSON.stringify(dead.why)}`}, head ${track.slice(0, 12).map((y) => y.toFixed(2)).join(' → ')}${track.length > 12 ? ` … ${track.at(-1).toFixed(2)}` : ''})`);
  check(dead.splats > 0, `blood splats where it fell (${dead.splats})`);
  // A body that has come to rest (its capsules back in the pool) is a ragdoll again when a round hits it,
  // rather than staying a stiff pose that rounds pass through (owner, 3 Nov).
  // Its time is simulated time (steps at 60 a second), which on a 1-2 fps CI page takes minutes: stop it the way
  // the view does when the time runs out (Ragdoll.freeze, then the pose frozen), then shoot it.
  const reshot = await page.evaluate(() => {
    const v = window.__cs.view;
    const c = v.corpses.findLast((x) => x.slot === window.__botSlot);
    const r0 = c?.a.ragdoll;
    if (!r0 || r0.tier === 'posed') return { rested: false, tier: r0?.tier ?? null, kind: r0?.constructor?.name ?? null };
    if (!r0.frozen) {
      r0.freeze();
      c.a.anim.freezePose();
    }
    const p = c.a.anim.ch.joints.get('pelvis').getAbsolutePosition();
    // A round from 3 m off and 1.5 m up, through the pelvis and on into the ground.
    const eye = { x: p.x + 3, y: p.y + 1.5, z: p.z };
    const to = { x: p.x - 1, y: p.y - 0.5, z: p.z };
    const len = Math.hypot(to.x - eye.x, to.y - eye.y, to.z - eye.z);
    const dir = { x: (to.x - eye.x) / len, y: (to.y - eye.y) / len, z: (to.z - eye.z) / len };
    const why = { capsule: !!v.physics?.raycastRagdoll(eye, dir, len), onRay: !!v.restingBodyOnRay(eye, dir, len) };
    v.landRound({ eye, to, victim: null, zone: 0, strength: 1 });
    const r1 = c.a.ragdoll;
    return { rested: true, woke: !!r1 && r1 !== r0 && !r1.frozen, tier: r1?.tier ?? null, ...why };
  });
  check(reshot.rested && reshot.woke, `a resting body shot again becomes a ragdoll again (${JSON.stringify(reshot)})`);
  // Out of view, a death isn't simulated at all: the body is laid on the ground along the hit (ragdollBudget.ts),
  // even one killed in mid-air behind you.
  await page.waitForFunction(() => window.__match.slots.some((c) => c && c.slot !== window.__cs.slot && c.alive && window.__cs.view.avatars.get(c.slot)?.anim?.ch), null, { timeout: T(8000) }).catch(() => {});
  const behind = await page.evaluate(() => {
    const m = window.__match;
    const v = window.__cs.view;
    const me = m.slots[window.__cs.slot];
    // The farthest bot (on open ground: it walked there), held 5 m up where it is, and you turn your back on it.
    const far = (c) => Math.hypot(c.move.pos.x - me.move.pos.x, c.move.pos.z - me.move.pos.z);
    const bot = m.slots.filter((c) => c && c !== me && c.alive && v.avatars.get(c.slot)?.anim?.ch).sort((a, b) => far(b) - far(a))[0];
    if (!bot || far(bot) < 14) return bot ? { near: far(bot) } : null;
    const pos = { x: bot.move.pos.x, y: bot.move.pos.y + 5, z: bot.move.pos.z };
    window.__hold = setInterval(() => (bot.move = { ...bot.move, pos: { ...pos }, velY: 0, grounded: false }), 5);
    window.__cs.input.yaw = Math.atan2(bot.move.pos.x - me.move.pos.x, bot.move.pos.z - me.move.pos.z) + Math.PI;
    window.__awayFrom = { x: bot.move.pos.x, z: bot.move.pos.z };
    window.__airSlot = bot.slot;
    window.__posedBefore = v.ragdollTiers.posed;
    return { slot: bot.slot };
  });
  // Your back to it: the camera's forward points away (turned the other way round if the yaw went the wrong way).
  await frames(page, 3);
  await page.evaluate(() => {
    const cam = window.__cs.view.camera;
    const f = cam.getForwardRay(1).direction;
    const p = cam.globalPosition;
    const a = window.__awayFrom;
    if (a && f.x * (a.x - p.x) + f.z * (a.z - p.z) > 0) window.__cs.input.yaw += Math.PI;
  });
  // Let the avatar follow it up there first, then kill it.
  const followed = await page.waitForFunction(() => {
    const a = window.__cs.view.avatars.get(window.__airSlot);
    const b = window.__match.slots[window.__airSlot];
    return a && b && Math.hypot(a.root.position.x - b.move.pos.x, a.root.position.y - b.move.pos.y, a.root.position.z - b.move.pos.z) < 1;
  }, null, { timeout: T(15000) }).then(() => true, () => false);
  const killedAt = await page.evaluate(() => {
    const m = window.__match;
    const bot = m.slots[window.__airSlot];
    clearInterval(window.__hold);
    const y = bot.move.pos.y;
    // No attacker: it may be on your team (no friendly fire).
    window.__killT = performance.now();
    m.damage(bot, 500, null, 'core.pistol');
    // It stays dead until the view (slow on a software renderer) has laid it down.
    bot.respawnTick = m.tick + 60 * 60;
    return { y, dead: !bot.alive, phase: m.phase };
  }).then((r) => (console.log(`  (out of view: killed ${JSON.stringify(r)})`), r.y));
  // (Its own corpse: the slot may have died before.)
  await page.waitForFunction(() => window.__cs.view.corpses.some((c) => c.slot === window.__airSlot && c.born >= window.__killT && c.a.ragdoll), null, { timeout: T(15000) }).catch(() => {});
  const laid = await page.evaluate((from) => {
    const v = window.__cs.view;
    const c = v.corpses.findLast((x) => x.slot === window.__airSlot && x.born >= window.__killT);
    if (!c) {
      const a = v.avatars.get(window.__airSlot);
      const b = window.__match.slots[window.__airSlot];
      return { corpse: false, avatar: !!a, anim: !!a?.anim, ragdoll: a?.ragdoll?.tier ?? null, alive: b?.alive, hp: b?.health, phase: window.__match.phase, deaths: b?.deaths, inv: b?.invulnerable };
    }
    const p = c.a.root.position;
    // The first ground under where it died.
    const ground = v.physics.raycast({ x: p.x, y: from + 0.5, z: p.z }, { x: 0, y: -1, z: 0 }, 60);
    return { tier: c.a.ragdoll?.tier, y: p.y, ground: ground ? from + 0.5 - ground.dist : null, posed: v.ragdollTiers.posed - window.__posedBefore, death: v.lastDeath, cam: { x: +v.camera.globalPosition.x.toFixed(1), y: +v.camera.globalPosition.y.toFixed(1), z: +v.camera.globalPosition.z.toFixed(1) }, at: { x: +p.x.toFixed(1), z: +p.z.toFixed(1) } };
  }, killedAt);
  await page.evaluate(() => (window.__match.slots[window.__airSlot].respawnTick = window.__match.tick));
  check(!!behind && followed && !!laid && laid.tier === 'posed' && laid.ground !== null && Math.abs(laid.y - laid.ground) < 0.3 && laid.y < killedAt - 0.5, `a death out of view isn't simulated: the body is laid on the ground (${JSON.stringify({ followed, killedAt, laid })})`);
  // The blasts go off on the open ground found above, with you back 10 m off it, facing it.
  const open = await standByOpenGround();
  // A blast throws a bot near it up and out (the game's own throw, sim/impact.ts): a bot stood there, its inputs
  // held (it walked off before), the blast a metre to its side at waist height.
  const thrown = await page.evaluate((at0) => {
    const m = window.__match;
    const me = m.slots[window.__cs.slot];
    const bot = at0 && m.slots.find((c) => c && c !== me && c.alive && !c.mount);
    // (Not one seated in a vehicle: a blast doesn't throw a seated rider.)
    if (!bot) return null;
    if (bot.bot && !bot.queue.massHeld && !bot.queue.held) {
      bot.queue.push = (...inputs) => Array.prototype.push.apply(bot.queue, inputs.map((i) => ({ ...i, forward: 0, right: 0, buttons: 0 })));
      bot.queue.massHeld = true;
    }
    bot.move = { ...bot.move, pos: { x: at0.x, y: at0.y + 0.05, z: at0.z }, vx: 0, vz: 0, velY: 0, grounded: false };
    bot.health = 1000;
    window.__blastSlot = bot.slot;
    window.__blastBot = bot;
    window.__blastTick = m.tick;
    return { slot: bot.slot };
  }, open.at);
  // Standing there: landed, a few ticks on.
  if (thrown) await page.waitForFunction(() => { const b = window.__blastBot; return b.alive && b.move.grounded && window.__match.tick > window.__blastTick + 5; }, null, { timeout: T(5000) }).catch(() => {});
  const blast = !thrown ? null : await page.evaluate(() => {
    const m = window.__match;
    const bot = window.__blastBot;
    const at = { x: bot.move.pos.x - 1, y: bot.move.pos.y + 0.6, z: bot.move.pos.z };
    window.__blastFrom = { y: bot.move.pos.y, x: bot.move.pos.x, z: bot.move.pos.z };
    window.__blastTop = bot.move.pos.y;
    m.splash(at, 5, 0, 0, null, 'core.rockets', 1, 11);
    return { velY: bot.move.velY, push: Math.hypot(bot.move.vx ?? 0, bot.move.vz ?? 0), mount: !!bot.mount, los: m.physics.lineOfSight(at, { x: bot.move.pos.x, y: bot.move.pos.y + 1.2, z: bot.move.pos.z }) };
  });
  const rose = !!blast && await page.waitForFunction(() => {
    const b = window.__match.slots[window.__blastSlot];
    window.__blastTop = Math.max(window.__blastTop, b.move.pos.y);
    return window.__blastTop - window.__blastFrom.y > 1;
  }, null, { timeout: T(5000), polling: 16 }).then(() => true, () => false);
  const out = !blast ? 0 : await page.evaluate(() => {
    const b = window.__blastBot;
    if (b.queue.massHeld) {
      delete b.queue.push;
      delete b.queue.massHeld;
    }
    return Math.hypot(b.move.pos.x - window.__blastFrom.x, b.move.pos.z - window.__blastFrom.z);
  });
  // (Where it lands depends on the bot: it steers in the air, and a wall can stop it.)
  check(!!blast && blast.velY > 6 && blast.push > 4 && rose, `a blast throws a bot up and out (${JSON.stringify(blast)}, up ${rose ? '> 1 m' : 'no'}, out ${out.toFixed(1)} m)`);
  // A mass casualty: one blast kills everyone around a point in front of you, and nothing stalls: every body
  // goes down a ragdoll or laid down, within the budget of awake ragdoll bodies. Every body reacts to it as before
  // the performance work spread their starts over frames and settled them sooner: each one in view is thrown out and
  // up by it (screenshots before and after: physicsfx-blast-before.png, physicsfx-blast-after.png).
  // On the open ground found above, in view.
  const ring = await page.evaluate((open) => {
    const m = window.__match;
    const me = m.slots[window.__cs.slot];
    const f = window.__cs.view.camera.getForwardRay(1).direction;
    const len = Math.hypot(f.x, f.z) || 1;
    const at = open ?? { x: me.move.pos.x + (f.x / len) * 10, y: me.move.pos.y, z: me.move.pos.z + (f.z / len) * 10 };
    // Only bots the view has drawn alive (one that respawned since the last drawn frame has no body to drop yet).
    const victims = m.combatants().filter((c) => c !== me && c.alive && !c.mount && window.__cs.view.avatars.get(c.slot)?.wasAlive);
    const spots = victims.map((c, i) => {
      const a = (i / victims.length) * Math.PI * 2;
      return { x: at.x + Math.cos(a) * 2, y: at.y + 0.2, z: at.z + Math.sin(a) * 2 };
    });
    // Held on the ring until the view draws them there (a blast throws what the view sees near it): standing still,
    // firing nothing and kept alive (side by side in a team match they shot each other, and the dead respawned
    // far off before the blast).
    for (const c of victims) {
      if (!c.bot || c.queue.held) continue;
      c.queue.push = (...inputs) => Array.prototype.push.apply(c.queue, inputs.map((i) => ({ ...i, forward: 0, right: 0, buttons: 0 })));
      c.queue.massHeld = true;
    }
    clearInterval(window.__massHold);
    window.__massHold = setInterval(() => victims.forEach((c, i) => {
      if (!c.alive) return;
      // (No speed carried: the bot thrown above still had its throw's, which the blast's push then had to overcome.)
      c.move = { ...c.move, pos: { ...spots[i] }, vx: 0, vz: 0, velY: 0, grounded: true };
      c.health = Math.max(c.health, 100);
    }), 5);
    window.__massSpots = spots;
    window.__massVictims = victims;
    window.__massAt = at;
    return { at, slots: victims.map((c) => c.slot), spots };
  }, open.at);
  await page
    .waitForFunction(({ slots, spots }) => slots.every((s, i) => { const a = window.__cs.view.avatars.get(s); return !!a && Math.hypot(a.root.position.x - spots[i].x, a.root.position.z - spots[i].z) < 0.3; }), ring, { timeout: T(15000) })
    .catch(() => {});
  await page.screenshot({ path: `${ARTIFACTS}/physicsfx-blast-before.png` });
  const mass = await page.evaluate(() => {
    const m = window.__match;
    const v = window.__cs.view;
    const at = window.__massAt;
    const victims = window.__massVictims;
    clearInterval(window.__massHold);
    // Where each body's hips are as the blast goes off, and how high they get as it flies (sampled every frame; the
    // same body followed when it becomes a corpse, never the player's next life).
    const pelvisOf = (a) => {
      const j = a?.anim?.ch?.joints.get('pelvis');
      if (!j) return null;
      j.computeWorldMatrix(true);
      const p = j.getAbsolutePosition();
      return { x: p.x, y: p.y, z: p.z };
    };
    const pelvis = (s) => pelvisOf(v.avatars.get(s));
    // The bodies the blast goes off among: alive, drawn on the ring, their characters in.
    const spots = window.__massSpots;
    const onRing = victims.filter((c, i) => {
      const a = v.avatars.get(c.slot);
      return c.alive && !!a && Math.hypot(a.root.position.x - spots[i].x, a.root.position.z - spots[i].z) < 0.5 && !!pelvis(c.slot);
    });
    window.__massTrack = new Map(onRing.map((c) => [c.slot, { a: v.avatars.get(c.slot), from: pelvis(c.slot), top: -Infinity, to: null, frames: 0, started: -1, ys: [] }]));
    window.__massTrackObs = v.scene.onAfterRenderObservable.add(() => {
      for (const t of window.__massTrack.values()) {
        const p = pelvisOf(t.a);
        if (!p) continue;
        if (t.started < 0 && t.a.ragdoll) t.started = t.frames;
        t.frames++;
        t.top = Math.max(t.top, p.y);
        t.to = p;
        if (t.ys.length < 16) t.ys.push(+p.y.toFixed(2));
      }
    });
    window.__massSlots = victims.map((c) => c.slot);
    m.pendingEvents.push({ e: 'explode', s: -1, p: [at.x, at.y + 0.5, at.z], r: 6 });
    m.splash({ x: at.x, y: at.y + 0.5, z: at.z }, 6, 500, 400, null, 'core.rockets', 1, 12);
    for (const c of victims) if (c.alive) m.kill(c, null, 'core.rockets');
    // Held dead while the bodies are counted (a slow runner can take longer than the respawn time; their inputs stay
    // held too: a bot asks to respawn at once).
    for (const c of victims) c.respawnTick = m.tick + 60 * 120;
    return { killed: victims.length, onRing: window.__massTrack.size };
  });
  const t0 = Date.now();
  // Each body counts once it has become a corpse (on a 1 fps CI page the first can sink away before the last lands).
  await page.evaluate(() => (window.__massDown = new Set()));
  const down = await page.waitForFunction(() => {
    const v = window.__cs.view;
    for (const c of v.corpses) if (window.__massSlots.includes(c.slot)) window.__massDown.add(c.slot);
    // A body with no ragdoll (its model not loaded yet) falls under gravity as itself: down once it lands.
    for (const s of window.__massSlots) { const f = v.avatars.get(s)?.fall; if (f && f.y <= f.ground + 0.05) window.__massDown.add(s); }
    return window.__massSlots.every((s) => window.__massDown.has(s));
  }, null, { timeout: T(10000), polling: 50 }).then(() => true, () => false);
  await frames(page, 10);
  const massStats = await page.evaluate(() => window.__cs.view.ragdollStats());
  // Every body in view thrown by the blast: its hips carried out from the blast's centre and up (a body that only
  // dropped where it stood, or was laid down without its flight, moves neither).
  const flung = await page.evaluate(() => {
    const v = window.__cs.view;
    v.scene.onAfterRenderObservable.remove(window.__massTrackObs);
    const at = window.__massAt;
    const out = [];
    for (const [s, t] of window.__massTrack) {
      if (!t.from || !t.to) continue;
      const outward = Math.hypot(t.to.x - at.x, t.to.z - at.z) - Math.hypot(t.from.x - at.x, t.from.z - at.z);
      out.push({ s, tier: t.a.ragdoll?.tier ?? 'none', push: v.deathPush?.get(s) ?? null, outward: +outward.toFixed(2), rose: +(t.top - t.from.y).toFixed(2), started: t.started, ys: [+t.from.y.toFixed(2), ...t.ys] });
    }
    return out;
  });
  await page.screenshot({ path: `${ARTIFACTS}/physicsfx-blast-after.png` });
  await page.evaluate(() => {
    const m = window.__match;
    for (const s of window.__massSlots) {
      const c = m.slots[s];
      if (!c) continue;
      c.respawnTick = m.tick;
      if (!c.queue?.massHeld) continue;
      delete c.queue.push;
      delete c.queue.massHeld;
    }
  });
  const notDown = down ? [] : await page.evaluate(() => window.__massSlots.filter((s) => !window.__massDown.has(s)).map((s) => { const a = window.__cs.view.avatars.get(s); const b = window.__match.slots[s]; return { s, avatar: !!a, anim: !!a?.anim, fall: a?.fall ?? null, alive: b?.alive }; }));
  check(mass.killed > 0 && down && massStats.awakeBodies <= 300, `a mass casualty (${mass.killed} killed by one blast) goes down without stalling: ${(Date.now() - t0) / 1000} s, ${JSON.stringify(massStats)}${notDown.length ? ` not down: ${JSON.stringify(notDown)}` : ''}`);
  const still = flung.filter((b) => b.tier === 'posed' || b.outward < 1 || b.rose < 0.3);
  check(mass.onRing >= Math.max(1, mass.killed - 1) && flung.length === mass.onRing && still.length === 0, `every body the blast killed in view is thrown out and up by it (${flung.length} of ${mass.killed} tracked; ${still.length ? `not thrown: ${JSON.stringify(still)}` : `out ${Math.min(...flung.map((b) => b.outward))}-${Math.max(...flung.map((b) => b.outward))} m, up ${Math.min(...flung.map((b) => b.rose))}-${Math.max(...flung.map((b) => b.rose))} m`})`);
  // A far death (frozen characters, owner 2026-11-07): a character 22 m off is animated in a smoothed band (performance
  // round 4); killed there, its body must be drawn as its ragdoll lies, not as its last living poses (the smoothing
  // stayed on after the view stopped stepping it, and the dead stood mid-stride where they died, in the air if they
  // died there). Each corpse's drawn skin is checked against its bones (the skin matrix each bone's pose makes).
  // A bot back on its feet and drawn: the blast's dead were all just let go, and on a slow page none may have
  // respawned yet, or been drawn alive again (CI: no bot found, then "reading 'move'" of none).
  await page.waitForFunction(() => {
    const m = window.__match;
    const me = m.slots[window.__cs.slot];
    return m.combatants().some((c) => c !== me && c.alive && !c.mount && window.__cs.view.avatars.get(c.slot)?.anim?.ch);
  }, null, { timeout: T(20000) }).catch(() => {});
  const farSlot = await page.evaluate(() => {
    const m = window.__match;
    const v = window.__cs.view;
    const me = m.slots[window.__cs.slot];
    const bot = m.combatants().find((c) => c !== me && c.alive && !c.mount && v.avatars.get(c.slot)?.anim?.ch);
    if (!bot) return null;
    const f = v.camera.getForwardRay(1).direction;
    const len = Math.hypot(f.x, f.z) || 1;
    const x = me.move.pos.x + (f.x / len) * 22;
    const z = me.move.pos.z + (f.z / len) * 22;
    const hit = v.raycastLevel({ x, y: me.move.pos.y + 30, z }, { x: 0, y: -1, z: 0 }, 80);
    const spot = { x, y: hit ? me.move.pos.y + 30 - hit.dist + 0.05 : me.move.pos.y, z };
    if (bot.bot && !bot.queue.massHeld && !bot.queue.held) {
      bot.queue.push = (...inputs) => Array.prototype.push.apply(bot.queue, inputs.map((i) => ({ ...i, forward: 0, right: 0, buttons: 0 })));
      bot.queue.massHeld = true;
    }
    clearInterval(window.__farHold);
    window.__farHold = setInterval(() => {
      if (!bot.alive) return;
      bot.move = { ...bot.move, pos: { ...spot }, velY: 0, grounded: true };
      bot.health = Math.max(bot.health, 100);
    }, 5);
    window.__farBot = bot;
    return bot.slot;
  });
  // Drawn there and smoothed (its animation stepped below every frame, the frames between blended).
  const farReady = farSlot !== null && (await page.waitForFunction((s) => {
    const a = window.__cs.view.avatars.get(s);
    const at = window.__farBot.move.pos;
    return !!a?.anim?.smoothing && Math.hypot(a.root.position.x - at.x, a.root.position.z - at.z) < 0.3;
  }, farSlot, { timeout: T(15000) }).then(() => true, () => false));
  const farBody = farSlot === null ? { errors: [], smoothing: [], tier: null, frames: 0 } : await page.evaluate(async ({ s, frames }) => {
    const m = window.__match;
    const v = window.__cs.view;
    clearInterval(window.__farHold);
    // How far the drawn skin is from the bones' own pose (the largest difference in any skin matrix).
    const skinError = (a) => {
      let worst = 0;
      for (const mesh of a.anim.ch.meshes) {
        const sk = mesh.skeleton;
        const drawn = sk?._transformMatrices;
        if (!sk || !drawn || sk.needInitialSkinMatrix) continue;
        sk.bones.forEach((b, i) => {
          if (b._index === -1) return;
          const want = b.getAbsoluteInverseBindMatrix().multiply(b.getFinalMatrix()).m;
          const at = (b._index ?? i) * 16;
          for (let k = 0; k < 16; k++) worst = Math.max(worst, Math.abs(drawn[at + k] - want[k]));
        });
      }
      return worst;
    };
    m.splash({ ...window.__farBot.move.pos, y: window.__farBot.move.pos.y + 0.5 }, 3, 0, 0, null, 'core.rockets', 1, 6);
    m.kill(window.__farBot, null, 'core.rockets');
    window.__farBot.respawnTick = m.tick + 60 * 60;
    const out = { errors: [], smoothing: [], tier: null, frames: 0 };
    for (let n = 0; n < 400 && out.frames < frames; n++) {
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
      const c = v.corpses.find((x) => x.slot === s);
      if (!c?.a.anim?.ch) continue;
      out.frames++;
      out.tier ??= c.a.ragdoll?.tier ?? 'none';
      out.errors.push(+skinError(c.a).toFixed(3));
      out.smoothing.push(!!c.a.anim.smoothing);
    }
    return out;
  }, { s: farSlot, frames: 20 });
  await page.evaluate(() => {
    const b = window.__farBot;
    if (!b) return;
    b.respawnTick = window.__match.tick;
    if (b.queue?.massHeld) {
      delete b.queue.push;
      delete b.queue.massHeld;
    }
  });
  const farWorst = Math.max(0, ...farBody.errors);
  check(farReady && farBody.frames >= 10 && farWorst < 0.01 && !farBody.smoothing.some(Boolean), `a body that dies 22 m off, its animation smoothed, is drawn as its ragdoll lies, not standing in its last living pose (${farReady ? 'smoothed before' : 'never smoothed'}; ${farBody.tier} ragdoll, ${farBody.frames} frames, skin off its bones by ${farWorst} at most${farBody.smoothing.some(Boolean) ? ', still smoothed' : ''})`);
  // Debris chunks are real bodies: they land and rest on the ground (once the effects world is up).
  await page.waitForFunction(() => !!window.__cs.view.physics, null, { timeout: T(3000) }).catch(() => {});
  // Only this burst's chunks are checked: the mass blast above can set off more (a vehicle in the blast burns and blows
  // up some seconds later, its chunks still flying when a slow runner gets here).
  await page.evaluate(() => {
    const me = window.__match.slots[window.__cs.slot];
    const f = window.__cs.view.camera.getForwardRay(1).direction;
    window.__debrisBefore = new Set(window.__cs.view.debrisBodies.map((d) => d.body));
    window.__cs.view.debris({ x: me.move.pos.x + f.x * 3, y: me.move.pos.y + 1.5, z: me.move.pos.z + f.z * 3 }, '#8a5d33', 0.8);
  });
  await page.waitForFunction(() => window.__cs.view.debrisBodies.some((d) => !window.__debrisBefore.has(d.body)), null, { timeout: T(2000) }).catch(() => {});
  // Headless frame rates are low, so run three seconds of physics at once rather than waiting on the frames.
  const chunks = await page.evaluate(() => {
    const view = window.__cs.view;
    for (let i = 0; i < 180; i++) view.physics.step(1 / 60);
    return view.debrisBodies.filter((d) => !window.__debrisBefore.has(d.body)).map((d) => ({ y: d.body.translation().y, v: Math.hypot(...Object.values(d.body.linvel())) }));
  });
  const older = await page.evaluate(() => {
    const old = window.__cs.view.debrisBodies.filter((d) => window.__debrisBefore.has(d.body));
    const colours = [...new Set(old.map((d) => d.mesh.material?.diffuseColor?.toHexString?.() ?? d.mesh.material?.albedoColor?.toHexString?.() ?? '?'))];
    return old.length ? `${old.length} (${colours.join(', ')}, fastest ${Math.max(...old.map((d) => Math.hypot(...Object.values(d.body.linvel())))).toFixed(1)} m/s)` : 0;
  });
  await page.waitForTimeout(300); // wait-ok: the optional screenshot below shows the settled debris
  check(chunks.length === 10 && chunks.every((c) => c.v < 1.5), `debris chunks land and come to rest (${chunks.length}, fastest ${Math.max(...chunks.map((c) => c.v)).toFixed(2)} m/s; ${older} older chunks still about)`);
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/physicsfx-debris.png` });
  // Destructibles are thin instances shared by every copy (one draw per shape): one darkens as it takes damage and is gone once broken.
  const batches = () => window.__cs.view.scene.meshes.filter((m) => m.name.startsWith('sc_destructibles_'));
  const crate = await page.evaluate((src) => {
    const batches = eval(src);
    const sc = window.__match.scenario;
    // A destructible entity (breakable props and crumbling blocks are destructibles too, drawn elsewhere).
    const d = [...sc.destructibles.values()].find((x) => x.alive && window.__match.map.entities[x.i]?.kind === 'destructible' && x.b.shootable !== false);
    window.__crate = d;
    const live = (m) => { const d = m._thinInstanceDataStorage.matrixData; let n = 0; for (let i = 0; i < m.thinInstanceCount; i++) if (d[i * 16] || d[i * 16 + 1] || d[i * 16 + 5]) n++; return n; };
    const shown = batches().reduce((n, m) => n + live(m), 0);
    sc.damageDestructible(d, d.health * 0.6, true, null);
    return { draws: batches().length, shown };
  }, `(${batches})`);
  const darkest = `Math.min(1, ...(${batches})().flatMap((m) => Array.from(m._userThinInstanceBuffersStorage?.data?.instanceColor ?? [])))`;
  await page.waitForFunction((src) => eval(src) < 0.9, darkest, { timeout: T(5000) }).catch(() => {});
  const hurt = await page.evaluate((src) => eval(src), darkest);
  await page.evaluate(() => window.__match.scenario.damageDestructible(window.__crate, 1e6, true, null));
  const shownNow = `(${batches})().reduce((n, m) => { const d = m._thinInstanceDataStorage.matrixData; let k = 0; for (let i = 0; i < m.thinInstanceCount; i++) if (d[i * 16] || d[i * 16 + 1] || d[i * 16 + 5]) k++; return n + k; }, 0)`;
  await page.waitForFunction(([src, was]) => eval(src) < was, [shownNow, crate.shown], { timeout: T(5000) }).catch(() => {});
  const after = await page.evaluate((src) => eval(src), shownNow);
  check(crate.draws > 0 && crate.draws < crate.shown && hurt < 0.9 && after < crate.shown, `destructibles are shared thin instances that darken with damage and go when broken (${crate.draws} meshes for ${crate.shown} parts, darkest ${hurt.toFixed(2)}, ${crate.shown} → ${after} parts shown)`);
  // Custom blood colour from the map.
  const green = await page.evaluate(() => {
    const view = window.__cs.view;
    view.blood.setLook('#3f9b1f', 'heavy');
    const me = window.__match.slots[window.__cs.slot];
    view.blood.hit({ x: me.move.pos.x + 2, y: me.move.pos.y + 1.2, z: me.move.pos.z }, { x: 1, y: 0, z: 0 }, 2);
    return view.scene.getMaterialByName('bloodDrop').diffuseColor.g > 0.5;
  });
  check(green, 'blood takes the map\'s colour');
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
  await glassChecks(browser);
}

/** Glass on the Training Range: one instanced material, bulletproof glass cracks where it is shot, glass shatters into shards. */
async function glassChecks(browser) {
  // Medium graphics (the game's default): the water shader is on.
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
  await ctx.addInitScript(() => localStorage.setItem('tiletrigger.graphics', 'medium'));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  // You alone on the range (&bots=1): its deathmatch bots respawned in front of the panels and took the rounds meant
  // for them (CI: the bulletproof panel at full health after a dozen shots), and shot you about.
  await page.goto(`${CLIENT}/?offline=training_range&test=1&god=1&bots=1`);
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() !== 'waiting' && window.__cs.phase() !== 'countdown' && window.__match, null, { timeout: T(60000) });
  const drawn = await page.evaluate(() => {
    const g = window.__cs.view.scenario.glass.counts;
    const meshes = window.__cs.view.scene.meshes.filter((m) => m.name.startsWith('glass_panes_')).length;
    return { ...g, meshes };
  });
  // Glass panel, two tank walls, bulletproof panel, the Window pane destructible: one or two 32 m squares.
  check(drawn.panes >= 5 && drawn.meshes <= 3, `the range's glass is instanced (${drawn.panes} panes in ${drawn.meshes} meshes)`);
  const tank = await page.evaluate(() => {
    const l = window.__cs.view.scenario.liquids;
    return { quality: l.quality, water: l.surfaces().filter((m) => m.material.name.startsWith('liquid_water')).length, mirror: l.mirrored, targets: window.__cs.view.scene.customRenderTargets.length };
  });
  check(tank.quality === 'medium' && tank.water === 1 && !tank.mirror && tank.targets === 0, `on medium the tank's water has the water shader and no render target (${JSON.stringify(tank)})`);
  // Stand 4 m in front of a panel (x 15, z of panel i) and fire `n` times at it (or until `done` holds).
  const fireAt = async (z, n, done = () => false) => {
    await page.evaluate((z) => {
      const m = window.__match;
      const me = m.slots[window.__cs.slot];
      for (const c of m.slots) if (c && c !== me) c.alive = false;
      clearInterval(window.__pin);
      window.__pin = setInterval(() => {
        me.move = { ...me.move, pos: { x: 11, y: 0, z }, velY: 0, grounded: true };
      }, 30);
      const w = me.weapons.get(me.current);
      if (w) w.mag = Math.max(w.mag, 30);
      window.__cs.input.yaw = Math.PI / 2;
      window.__cs.input.pitch = -0.02;
    }, z);
    await page.waitForTimeout(T(600)); // wait-ok: the view turns to the panel
    // Each shot: the trigger held until the round has gone (the magazine drops: a press only fires on a frame that sees
    // it, and a loaded page can take longer than any fixed hold between frames; CI and locally, a pistol never fired),
    // then let go for frames that see it let go (a semi-automatic fires once a press).
    for (let k = 0; k < n; k++) {
      if (await page.evaluate(done)) break;
      const before = await page.evaluate(() => { const me = window.__match.slots[window.__cs.slot]; return me.weapons.get(me.current)?.mag ?? 0; });
      await page.evaluate(() => (window.__autoInput = { buttons: 2 }));
      const went = await page.waitForFunction((b) => { const me = window.__match.slots[window.__cs.slot]; return (me.weapons.get(me.current)?.mag ?? 0) < b; }, before, { timeout: T(5000) }).then(() => true, () => false);
      await page.evaluate(() => (window.__autoInput = { buttons: 0 }));
      await frames(page, 2);
      fired += went ? 1 : 0;
    }
  };
  let fired = 0;
  const z = (i) => -8 - i * 2.6;
  // Shots go with the frames (a held trigger fires on the next one), so on a slow renderer keep firing
  // until two rounds have landed, as a fixed few might not.
  const bulletproofHit = () => {
    const m = window.__match;
    const i = m.map.entities.findIndex((e) => e.id === 'panel_bulletproof');
    const s = m.scenario.fullState().es.find(([k]) => k === i);
    return !!s && s[1] < 100 && window.__cs.view.scenario.glass.counts.cracks > 0;
  };
  await fireAt(z(10), 12, bulletproofHit);
  await page.waitForFunction(() => window.__cs.view.scenario.glass.counts.cracks > 0, null, { timeout: T(5000) }).catch(() => {});
  const proof = await page.evaluate(() => {
    const m = window.__match;
    const i = m.map.entities.findIndex((e) => e.id === 'panel_bulletproof');
    const s = m.scenario.fullState().es.find(([k]) => k === i);
    return { health: s ? s[1] : null, cracks: window.__cs.view.scenario.glass.counts.cracks };
  });
  check(proof.health !== null && proof.health > 0 && proof.health < 100 && proof.cracks > 0, `bulletproof glass stops the rounds, cracks where they strike and holds (${JSON.stringify(proof)})`);
  // Broken glass comes back after the map's glass time (4 s here): on a slow page that can pass between a shot and the
  // next look (it broke, and was whole again by the check). So the break and its shards are noted as they happen.
  await page.evaluate(() => {
    window.__panelBroke = false;
    window.__shardsSeen = 0;
    clearInterval(window.__panelWatch);
    window.__panelWatch = setInterval(() => {
      if (window.__match.scenario.destructibleAlive('panel_0') === false) window.__panelBroke = true;
      window.__shardsSeen = Math.max(window.__shardsSeen, window.__cs.view.scene.meshes.filter((x) => x.name === 'glassShard').length);
    }, 10);
  });
  fired = 0;
  await fireAt(z(0), 8, () => window.__panelBroke);
  await page.waitForFunction(() => window.__shardsSeen > 0, null, { timeout: T(5000) }).catch(() => {});
  const broke = await page.evaluate(() => {
    const m = window.__match;
    const me = m.slots[window.__cs.slot];
    const i = m.map.entities.findIndex((e) => e.id === 'panel_0');
    const st = m.scenario.fullState().es.find(([k]) => k === i);
    const w = me.weapons.get(me.current);
    clearInterval(window.__panelWatch);
    return { alive: !window.__panelBroke, shards: window.__shardsSeen, health: st ? st[1] : null, gun: w?.def.id, mag: w?.mag, at: { x: +me.move.pos.x.toFixed(1), z: +me.move.pos.z.toFixed(1) } };
  });
  broke.fired = fired;
  check(broke.alive === false && broke.shards > 0, `the glass panel shatters into shards (${JSON.stringify(broke)})`);
  await page.evaluate(() => {
    clearInterval(window.__pin);
    window.__autoInput = { buttons: 0 };
  });
  check(errors.length === 0, `no page errors on the range (${errors.join('; ')})`);
  await page.context().close();
}

/**
 * Scoreboard open: is the local player's row on screen, inside its list's
 * visible area (sticky when the list scrolls) and inside the window?
 */
async function scoreboardMeVisible(page) {
  return page.evaluate(() => {
    const me = document.querySelector('#scoreboard .sb-row.me');
    if (!me) return { ok: false, why: 'no row marked as you' };
    const r = me.getBoundingClientRect();
    const list = me.closest('.sb-list');
    const box = (list && list.scrollHeight > list.clientHeight ? list : me.closest('.sb-body')).getBoundingClientRect();
    const inList = r.top >= box.top - 1 && r.bottom <= box.bottom + 1;
    const inWindow = r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth;
    const sideways = document.documentElement.scrollWidth > innerWidth;
    return { ok: inList && inWindow && !sideways && r.height > 0, why: `row ${Math.round(r.top)}–${Math.round(r.bottom)}, list ${Math.round(box.top)}–${Math.round(box.bottom)}, window ${innerWidth}×${innerHeight}` };
  });
}

/** The scoreboard's team columns: their rectangles, left to right. */
async function scoreboardColumns(page) {
  return page.evaluate(() => [...document.querySelectorAll('#scoreboard .sb-group')].map((g) => {
    const r = g.getBoundingClientRect();
    return { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top) };
  }));
}

async function teamsFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  // Arcade: Team Deathmatch on Sandgate as 2v2v2v2v2v2v12 (24 players, 7 teams).
  await page.addInitScript(() => localStorage.setItem('cs.arcade', JSON.stringify({ map: 'sandgate', mode: 'core.tdm', bots: 3, skill: 'easy', scoreLimit: 40, minutes: 10 })));
  await page.goto(CLIENT);
  await page.click('#nav-play');
  // More layouts (beside the size presets worked out for the map): any fixed shape.
  await page.selectOption('#arcade-teams', '2,2,2,2,2,2,12');
  // Bots section → your bots: a built-in set (Knights vs Space Crew: knights on the first team, the space crew on the second).
  await page.click('#setup-bots-head');
  await page.click('#arcade-botset');
  await page.waitForSelector('#bot-manager', { timeout: T(5000) });
  await page.selectOption('#bm-from', 'p:knights_vs_space');
  const teamCol = await page.evaluate(() => ({ rows: document.querySelectorAll('#bm-table .bm-row:not(.bm-th)').length, team: document.getElementById('bm-team-0')?.selectedOptions[0]?.textContent, team6: document.getElementById('bm-team-6')?.selectedOptions[0]?.textContent }));
  await page.click('#bm-apply');
  const setLine = await page.evaluate(() => document.getElementById('arcade-botset-sum')?.textContent);
  check(teamCol.rows === 12 && !!teamCol.team && teamCol.team !== teamCol.team6 && /Knights vs Space Crew: 12 bots/.test(setLine ?? ''), `match setup's Bots section takes a built-in set, a team per bot (${JSON.stringify(teamCol)}, ${setLine})`);
  await page.click('#arcade-start');
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() !== 'waiting' && window.__cs.phase() !== 'countdown', null, { timeout: T(60000) });
  // Every team's table fills in once the roster for all 24 has arrived.
  await page.keyboard.down('Tab');
  await page.waitForFunction(() => document.querySelectorAll('#scoreboard .sb-group').length >= 7 && document.querySelectorAll('#scoreboard .sb-row[data-slot]').length >= 24, null, { timeout: T(10500) }).catch(() => {});
  const board = await page.evaluate(() => ({
    many: document.getElementById('scoreboard').classList.contains('sb-tn'),
    tables: [...document.querySelectorAll('#scoreboard .sb-group')].map((t) => t.querySelectorAll('.sb-row[data-slot]').length),
    cols: getComputedStyle(document.querySelector('#scoreboard .sb-body')).gridTemplateColumns.split(' ').length,
  }));
  const meSeen = await scoreboardMeVisible(page);
  await page.keyboard.up('Tab');
  check(board.many && board.tables.length === 7, `the scoreboard shows seven teams (${board.tables.length})`);
  check(board.cols >= 3, `seven teams sit in a grid of columns (${board.cols} across)`);
  check(meSeen.ok, `your row is visible on the scoreboard (${meSeen.why})`);
  check([...board.tables].sort((a, b) => a - b).join(',') === '2,2,2,2,2,2,12', `teams are filled to 2v2v2v2v2v2v12 (${board.tables.join(',')})`);
  const sides = await sim(page, (m) => {
    const team = (n) => m.teams.findIndex((t) => t.id === m.combatants().find((c) => c.name === n)?.faction);
    return { clank: team('Sir Clank'), orion: team('Capt. Orion'), look: m.combatants().find((c) => c.name === 'Sir Clank')?.look };
  });
  check(sides.clank === 0 && sides.orion === 1 && sides.look === 'core.knight', `the set's bots play on their teams in their looks (${JSON.stringify(sides)})`);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
  await customSetupFlow(browser);
  await botCastFlow(browser);
  await setupLayoutFlow(browser);
  await setupLimitsFlow(browser);
  await spectateStartFlow(browser);
  await friendlyFireChecks(browser);
}

/**
 * Friendly fire (owner, 2026-11-07: turned on, it did nothing): set in Match setup, it reaches the match, and your
 * rounds hurt a teammate in front of you; with it off (the default) the same rounds pass through them.
 */
async function friendlyFireChecks(browser) {
  const out = {};
  for (const ff of ['on', 'off']) {
    const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
    await page.addInitScript((on) => localStorage.setItem('cs.arcade', JSON.stringify({ map: 'sandgate', mode: 'core.tdm', bots: 3, skill: 'easy', scoreLimit: 40, minutes: 10, ...(on ? { friendlyFire: 'on' } : {}) })), ff === 'on');
    await page.goto(`${CLIENT}/?test=1`);
    await page.click('#nav-play');
    await page.click('#arcade-start');
    await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() !== 'waiting' && window.__cs.phase() !== 'countdown', null, { timeout: T(90000) });
    // Only your rounds fly: every bot holds fire (enemies had shot the teammate placed in front of you, hurting them
    // with friendly fire off and killing them before your round did, or killed them so that they stood there
    // spawn-shielded), and what was already in the air has landed, and you are alive.
    await holdBots(page);
    await simWait(page, (m, me) => me.alive && !m.bullets.some((b) => b.owner !== me.slot) && !m.projectiles.some((p) => p.owner !== me.slot), null, T(30000));
    // A teammate held 4 m in front of you, three rounds of your gun fired straight at their chest.
    const shot = await sim(page, (m, me) => {
      const mate = m.combatants().find((c) => c !== me && c.alive && c.faction === me.faction && !c.mount);
      if (!mate) return { rule: m.rules.friendlyFire ?? 'off', mate: false, tick: m.tick };
      const at = { x: me.move.pos.x + Math.sin(me.yaw) * 4, y: me.move.pos.y, z: me.move.pos.z + Math.cos(me.yaw) * 4 };
      mate.move = { ...mate.move, pos: at, velY: 0, vx: 0, vz: 0, grounded: true };
      mate.health = mate.maxHealth;
      mate.armor = 0;
      mate.invulnerable = false;
      mate.shieldUntil = 0;
      globalThis.__ffMate = mate;
      // Who took how much health off the teammate: your rounds, and anything else (that should be nothing).
      const hits = (globalThis.__ffHits = []);
      if (!m.__ffLogged) {
        const damage = m.damage;
        m.damage = function (victim, amount, attacker, ...rest) {
          const before = victim.alive ? victim.health : 0;
          const r = damage.call(this, victim, amount, attacker, ...rest);
          if (victim === globalThis.__ffMate) globalThis.__ffHits.push({ by: attacker ? attacker.slot : -1, n: before - (victim.alive ? victim.health : 0) });
          return r;
        };
        m.__ffLogged = true;
      }
      const eye = { x: me.move.pos.x, y: me.move.pos.y + 1.6, z: me.move.pos.z };
      const chest = { x: at.x, y: at.y + 1.2, z: at.z };
      const clear = m.physics.lineOfSight(eye, chest);
      me.pitch = Math.atan2(chest.y - eye.y, 4);
      const gun = [...me.weapons.values()].map((w) => w.def).find((d) => d.kind === 'hitscan' && d.damage > 0);
      for (let i = 0; i < 3; i++) m.fireNow(me, { ...gun, alt: undefined }, 0);
      return { rule: m.rules.friendlyFire ?? 'off', mate: true, gun: gun?.id, clear, tick: m.tick };
    });
    // Ballistic rounds fly a tick or two: a third of a second of match time is plenty.
    await simWait(page, (m, me, t) => m.tick > t + 20, shot.tick, T(10000));
    const after = await sim(page, (m, me) => {
      const mate = globalThis.__ffMate;
      if (!mate) return null;
      const hits = globalThis.__ffHits ?? [];
      const sum = (list) => list.reduce((n, h) => n + h.n, 0);
      return { hurt: sum(hits.filter((h) => h.by === me.slot)), others: sum(hits.filter((h) => h.by !== me.slot)), lost: mate.maxHealth - (mate.alive ? mate.health : 0) };
    });
    // A team kill (friendly fire on): the feed marks it TK, and nothing rewards it: no kill, the streak ends, no
    // streak burst or "in a row", no kill marker. Primed one kill short of the first burst and streak reward.
    if (ff === 'on') out.tk = await teamKillCheck(page);
    out[ff] = { ...shot, hurt: after?.hurt ?? null, others: after?.others ?? null, lost: after?.lost ?? null, errors: errors.join('; ') };
    await page.context().close();
  }
  const tk = out.tk;
  check(tk?.dead && tk.feed?.tk && /\bTK\b/.test(tk.feed.text), `a team kill shows in the kill feed (upper right) marked TK (${JSON.stringify(tk)})`);
  check(tk?.dead && tk.kills === tk.kills0 && tk.streak === 0 && !tk.bursts && !tk.inARow && !tk.marker && tk.lifeKills === 0, `a team kill rewards nothing: no kill, the streak ends, no streak burst, no kill marker (${JSON.stringify(tk)})`);
  check(out.on.rule === 'on' && out.off.rule === 'off', `Match setup's friendly fire reaches the match (on: ${out.on.rule}, off: ${out.off.rule})`);
  check(out.on.mate && out.on.clear && out.on.hurt > 0, `friendly fire on: your rounds hurt a teammate in front of you (${JSON.stringify(out.on)})`);
  check(out.off.mate && out.off.clear && out.off.hurt === 0 && out.off.lost === 0, `friendly fire off: your rounds pass through a teammate unhurt (${JSON.stringify(out.off)})`);
  check(!out.on.errors && !out.off.errors, `no page errors in the friendly fire matches (${out.on.errors}${out.off.errors})`);
}

/** Friendly fire on: you down a teammate in front of you. What the page showed for it (teams flow, friendlyFireChecks). */
async function teamKillCheck(page) {
  // What the page draws for it: effects, HUD lines and the kill marker, recorded as they happen.
  await page.evaluate(() => {
    const cs = window.__cs;
    const seen = (window.__tkSeen = { fx: [], msgs: [], marker: false, feed: [] });
    // Each kill-feed line as it is drawn (it fades after 5 s): who, the TK flag passed, the line's class and text.
    const kill = cs.hud.kill.bind(cs.hud);
    cs.hud.kill = (...a) => {
      kill(...a);
      const line = document.getElementById('feed').firstElementChild;
      seen.feed.push({ killer: a[0], victim: a[1], tk: !!line?.classList.contains('tk'), text: line?.textContent.trim() ?? '', edge: line ? getComputedStyle(line).borderRightColor : '' });
    };
    const fx = cs.view.playGameplayFx.bind(cs.view);
    cs.view.playGameplayFx = (name, ...rest) => (seen.fx.push(name), fx(name, ...rest));
    const msg = cs.hud.showMessage.bind(cs.hud);
    cs.hud.showMessage = (text, ...rest) => (seen.msgs.push(text), msg(text, ...rest));
    const confirm = cs.hud.killConfirm.bind(cs.hud);
    cs.hud.killConfirm = (...a) => ((seen.marker = true), confirm(...a));
    // Two kills this life already, on the page and in the match: one more would be the first burst.
    cs.lifeKills.set(cs.slot, 2);
  });
  const shot = await sim(page, (m, me) => {
    const mate = globalThis.__ffMate;
    if (!mate?.alive) return null;
    const at = { x: me.move.pos.x + Math.sin(me.yaw) * 4, y: me.move.pos.y, z: me.move.pos.z + Math.cos(me.yaw) * 4 };
    mate.move = { ...mate.move, pos: at, velY: 0, vx: 0, vz: 0, grounded: true };
    mate.health = 1;
    mate.armor = 0;
    mate.invulnerable = false;
    mate.shieldUntil = 0;
    me.streak = 2;
    const eye = { x: me.move.pos.x, y: me.move.pos.y + 1.6, z: me.move.pos.z };
    me.pitch = Math.atan2(at.y + 1.2 - eye.y, 4);
    const gun = [...me.weapons.values()].map((w) => w.def).find((d) => d.kind === 'hitscan' && d.damage > 0);
    for (let i = 0; i < 3 && mate.alive; i++) m.fireNow(me, { ...gun, alt: undefined }, 0);
    return { tick: m.tick, kills0: me.kills, slot: mate.slot };
  });
  if (!shot) return { dead: false };
  // The kill reaches the page: its feed line drawn.
  await page.waitForFunction((slot) => window.__tkSeen.feed.some((f) => f.victim === slot), shot.slot, { timeout: T(15000) }).catch(() => {});
  const inMatch = await sim(page, (m, me) => ({ kills: me.kills, streak: me.streak ?? 0 }));
  const page_ = await page.evaluate((slot) => {
    const seen = window.__tkSeen;
    const line = seen.feed.find((f) => f.victim === slot) ?? null;
    return {
      dead: !!line,
      feed: line,
      bursts: seen.fx.filter((f) => f === 'streak').length,
      inARow: seen.msgs.some((t) => /in a row|kill streak/i.test(t)),
      marker: seen.marker || document.getElementById('hitmarker').classList.contains('kill'),
      lifeKills: window.__cs.lifeKills.get(window.__cs.slot) ?? 0,
    };
  }, shot.slot);
  return { ...inMatch, kills0: shot.kills0, ...page_ };
}

/**
 * Score and time follow the match's size (owner, 2026-11-06: "24v24 plays ok with 500 points, but also 15–20 min"):
 * Match setup suggests them for the players and bots (matchSetup.ts suggestedLimits), they follow a size change
 * until set by hand (Custom, kept through size changes), and "Back to suggested" puts them back. A setup saved
 * before suggestions, at the old 40 points and 10 minutes, follows the size.
 */
async function setupLimitsFlow(browser) {
  // The curve's values for St. John's presets (Small 4v4, Map's pick 12v12, Max 32v32 since performance round 4): points and minutes.
  const EXPECT = { '4v4': [40, 10], '12v12': [180, 15], '32v32': [650, 20] };
  const errors = [];
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.setItem('cs.arcade', JSON.stringify({ map: 'st_johns', mode: 'core.tdm', bots: 3, skill: 'normal', scoreLimit: 40, minutes: 10, teams: [4, 4] }));
    sessionStorage.setItem('seeded', '1');
  });
  await page.goto(`${CLIENT}/?test=1`);
  await page.waitForFunction(() => window.__front, null, { timeout: T(30000) });
  await page.evaluate(() => document.getElementById('nav-play').click());
  await page.waitForSelector('#arcade-score', { timeout: T(30000) });
  const read = () =>
    page.evaluate(() => ({
      score: Number(document.getElementById('arcade-score')?.value),
      time: document.getElementById('arcade-minutes')?.textContent,
      line: document.getElementById('setup-limits')?.textContent ?? '',
      custom: document.querySelectorAll('#setup-win .when-tag.custom').length,
      reset: !!document.getElementById('setup-limits-reset'),
      fact: document.querySelector('#setup-summary .fact-time')?.textContent,
      saved: JSON.parse(localStorage.getItem('cs.arcade')),
    }));
  const preset = (id) => page.evaluate((p) => document.querySelector(`#setup-sizes [data-preset="${p}"]`).click(), id);
  const suggests = (r, size) => {
    const [points, minutes] = EXPECT[size];
    return r.score === points && r.time === `${minutes} min` && r.fact === `~${minutes} min` && r.line === `Suggested for ${size}: ${points} points, ${minutes} min. They follow the size until you change them.` && r.custom === 0;
  };
  const four = await read();
  check(suggests(four, '4v4'), `a setup saved at the old 40 points and 10 minutes follows the size: 4v4 suggests ${EXPECT['4v4'].join(' points, ')} min (${JSON.stringify({ ...four, saved: undefined })})`);
  await preset('pick');
  const twelve = await read();
  await preset('max');
  const big = await read();
  // Opening the setup doesn't write it; the first change saves it with the marks (score and time following the size).
  const marks = { scoreAuto: twelve.saved.scoreAuto, timeAuto: twelve.saved.timeAuto, score: big.saved.scoreLimit, minutes: big.saved.minutes };
  check(suggests(twelve, '12v12') && suggests(big, '32v32') && marks.scoreAuto === true && marks.timeAuto === true && marks.score === EXPECT['32v32'][0] && marks.minutes === EXPECT['32v32'][1], `the suggested score and time follow the size, and the setup saves them following it: 12v12 ${twelve.score}, ${twelve.time}; 32v32 ${big.score}, ${big.time} (${JSON.stringify({ line: big.line, fact: big.fact, saved: marks })})`);
  // Set by hand: Custom, kept through a size change; Back to suggested follows the size again.
  await page.evaluate(() => {
    const i = document.getElementById('arcade-score');
    i.value = '300';
    i.dispatchEvent(new Event('change'));
  });
  await preset('pick');
  const custom = await read();
  check(custom.score === 300 && custom.custom === 1 && custom.reset && /^Custom\. Suggested for 12v12: /.test(custom.line) && custom.saved.scoreAuto === false && custom.time === `${EXPECT['12v12'][1]} min`, `a score set by hand is marked Custom and stays when the size changes; the time still follows (${JSON.stringify({ ...custom, saved: undefined })})`);
  await page.evaluate(() => document.getElementById('setup-limits-reset').click());
  const back = await read();
  check(suggests(back, '12v12') && back.saved.scoreAuto === true && back.saved.scoreLimit === EXPECT['12v12'][0], `Back to suggested puts the score back on the suggestion for the size (${JSON.stringify({ ...back, saved: undefined })})`);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

/**
 * Bot characters: match setup's Bots step offers them; a soldiers-only offline match fills with soldiers named
 * after their looks (the first in each look takes its name) or a rank and a surname, every name its own.
 */
async function botCastFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  await page.addInitScript(() => localStorage.setItem('cs.arcade', JSON.stringify({ map: 'sandgate', mode: 'core.tdm', bots: 3, skill: 'easy', scoreLimit: 40, minutes: 10, teams: [8, 8] })));
  await page.goto(`${CLIENT}/?test=1`);
  await page.click('#nav-play');
  await page.click('#setup-bots-head');
  await page.waitForSelector('#arcade-cast', { timeout: T(5000) });
  const offered = await page.evaluate(() => [...document.querySelectorAll('#arcade-cast option')].map((o) => o.value));
  check(offered[0] === 'map' && offered.includes('all') && offered.includes('soldiers') && offered.includes('pirate'), `the Bots section offers bot characters (${offered.length}: ${offered.slice(0, 4).join(', ')}…)`);
  await page.selectOption('#arcade-cast', 'soldiers');
  await page.click('#arcade-start');
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0, null, { timeout: T(60000) });
  await simWait(page, (m) => m.combatants().filter((c) => c.kind === 'bot').length >= 15, null, T(30000));
  const bots = await sim(page, (m, me, a, mod) => ({
    cast: m.botCast,
    bots: m.combatants().filter((c) => c.kind === 'bot').map((c) => ({ name: c.name, look: c.look, ok: mod.castAllows(['soldiers'], c.look), theme: mod.lookTheme(c.look) })),
    names: m.combatants().map((c) => c.name),
  }));
  const wrong = bots.bots.filter((b) => !b.ok || b.theme !== 'soldier');
  const ranked = bots.bots.filter((b) => /^(Pvt|Pfc|Cpl|Sgt|SSgt|Lt|Capt|Maj|Col)\. [A-Z]/.test(b.name));
  check(bots.bots.length === 15 && !wrong.length, `a soldiers-only match: every bot a soldier (${bots.bots.length} bots; ${wrong.map((b) => `${b.name}/${b.look}`).join(', ') || 'none wrong'})`);
  check(new Set(bots.names).size === bots.names.length && ranked.length >= 1, `soldier bots have names of their own, ranks among them (${bots.bots.map((b) => b.name).join(', ')})`);
  await page.keyboard.down('Tab');
  await page.waitForFunction(() => document.querySelectorAll('#scoreboard .sb-row[data-slot]').length >= 16, null, { timeout: T(10500) }).catch(() => {});
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/bot-cast-scoreboard.png` }).catch(() => {});
  await page.keyboard.up('Tab');
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

/** The owner's St. John's setup (2026-11-06): Team Deathmatch 24v24 with nine rules changed. */
const OWNER_SETUP = { map: 'st_johns', mode: 'core.tdm', bots: 11, skill: 'hard', scoreLimit: 40, minutes: 10, teams: [24, 24], squadSpawn: false, killstreaks: false, randomChars: true, gravity: 0.4, fallDamage: true, lethality: 'tactical', ballistics: 'advanced', vehicleDamage: 'tough', botStyle: 'tactical' };

/**
 * Match setup at the sizes it's made for (1280 × 720, 1920 × 1080, the owner's 2000 × 1100, a phone sideways at
 * 900 × 415): the mode and what wins show without scrolling, nothing scrolls sideways, and Start stays in view with
 * the setup scrolled to the bottom and every section opened (a desktop keeps several open, a phone one at a time).
 * Then, on the owner's setup: people apart from bots, Advanced rules in a line, the fit indicator and its fix, a
 * variant, a party preset, adding a bot past the limit.
 */
async function setupLayoutFlow(browser) {
  const errors = [];
  const sizes = [
    { name: '1280 × 720', viewport: { width: 1280, height: 720 } },
    { name: '1920 × 1080', viewport: { width: 1920, height: 1080 } },
    { name: '2000 × 1100', viewport: { width: 2000, height: 1100 } },
    { name: 'phone 900 × 415', viewport: { width: 900, height: 415 }, hasTouch: true, isMobile: true, touch: true },
  ];
  for (const { name, touch, ...opts } of sizes) {
    const page = await (await browser.newContext(opts)).newPage();
    page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
    await page.addInitScript((s) => localStorage.setItem('cs.arcade', JSON.stringify(s)), OWNER_SETUP);
    await page.goto(`${CLIENT}/?test=1${touch ? '&touch=1' : ''}`);
    await page.waitForFunction(() => window.__front, null, { timeout: T(30000) });
    await page.evaluate(() => document.getElementById('nav-play').click());
    await page.waitForSelector('#setup-essentials', { timeout: T(30000) });
    const essentials = await page.evaluate(() => {
      const body = document.querySelector('#match-setup .setup-body');
      body.scrollTop = 0;
      const b = body.getBoundingClientRect();
      const seen = (id) => {
        const r = document.getElementById(id)?.getBoundingClientRect();
        return !!r && r.height > 0 && r.top >= b.top - 1 && r.bottom <= b.bottom + 1;
      };
      return seen('arcade-modes') && seen('setup-win');
    });
    // Open every section in turn (a phone closes the one open before).
    for (const id of ['setup-teams', 'setup-bots', 'setup-advanced']) {
      if (!(await page.evaluate((i) => document.getElementById(i).classList.contains('open'), id))) await page.evaluate((i) => document.getElementById(`${i}-head`).click(), id);
    }
    const state = await page.evaluate(() => {
      const body = document.querySelector('#match-setup .setup-body');
      body.scrollTop = body.scrollHeight;
      const s = document.getElementById('arcade-start').getBoundingClientRect();
      return { open: [...document.querySelectorAll('#match-setup .setup-sec.open')].map((x) => x.id), start: s.top >= 0 && s.bottom <= innerHeight && s.right <= innerWidth && s.height > 0, sideways: document.documentElement.scrollWidth > innerWidth, scrolled: body.scrollTop };
    });
    check(essentials, `${name}: the mode and what wins show without scrolling`);
    check(state.start && !state.sideways && state.scrolled > 0, `${name}: Start stays in view with the setup scrolled to the bottom, nothing sideways (${JSON.stringify(state)})`);
    check(touch ? state.open.join() === 'setup-advanced' : state.open.length === 3, `${name}: ${touch ? 'one section open at a time' : 'several sections open at once'} (${state.open.join(', ')})`);
    await page.context().close();
  }

  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((s) => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.setItem('cs.arcade', JSON.stringify(s));
    sessionStorage.setItem('seeded', '1');
  }, OWNER_SETUP);
  await page.goto(`${CLIENT}/?test=1`);
  await page.waitForFunction(() => window.__front, null, { timeout: T(30000) });
  await page.evaluate(() => document.getElementById('nav-play').click());
  await page.waitForSelector('#setup-essentials', { timeout: T(30000) });
  const setup = () => page.evaluate(() => JSON.parse(localStorage.getItem('cs.arcade')));
  const read = () =>
    page.evaluate(() => ({
      who: document.querySelector('#setup-summary .fact-players')?.textContent,
      fit: document.getElementById('setup-fit')?.dataset.level,
      advanced: document.querySelector('#setup-advanced-head .sec-sum')?.textContent,
      chips: document.querySelectorAll('#setup-rule-chips span').length,
      preset: document.querySelector('#setup-sizes .size-chip.on')?.dataset.preset ?? 'custom',
      variants: [...document.querySelectorAll('#setup-variants .variant-chip.on')].map((b) => b.dataset.variant),
    }));
  const owner = await read();
  // (24v24 was Max until performance round 4 raised a computer's limit to 32v32: between Big battle and Max now.)
  check(owner.who === 'You + 47 bots · 24v24' && owner.preset === 'custom', `people apart from bots: the owner's setup reads "${owner.who}", on no preset (${owner.preset})`);
  check(owner.advanced === '9 changed · Low gravity · Tactical bots +7' && owner.chips === 0, `Advanced rules in one line, its chips inside it ("${owner.advanced}", ${owner.chips} chips while closed)`);
  check(owner.variants.join() === 'roulette', `a variant shows on when its settings are, however set (${owner.variants.join(', ')})`);
  // The fit indicator: Crowded, its details say why, and the map's own layout is a button.
  await page.evaluate(() => document.getElementById('setup-fit').click());
  const details = await page.evaluate(() => [...document.querySelectorAll('#setup-fit-list .fit-item')].map((li) => ({ topic: li.dataset.topic, level: li.className.replace('fit-item ', ''), fix: li.querySelector('.fit-fix')?.textContent ?? null })));
  const size = details.find((d) => d.topic === 'size');
  check(owner.fit === 'crowded' && size?.level === 'warn' && size.fix === 'Use 12v12' && details.some((d) => d.topic === 'spawns') && details.some((d) => d.topic === 'performance'), `St. John's at 24v24 is Crowded; its details: spawns, the map's size with "Use 12v12", performance (${JSON.stringify(details)})`);
  await page.evaluate(() => document.getElementById('setup-fit-list-fix-size').click());
  const fixed = { teams: (await setup()).teams, ...(await read()) };
  check(fixed.teams?.join() === '12,12' && fixed.fit === 'fits' && fixed.preset === 'pick' && fixed.who === 'You + 23 bots · 12v12', `"Use 12v12" sets the map's pick, and it fits (${JSON.stringify(fixed)})`);
  // Adding bots grows the teams (Even teams: both); past the limit it says whose limit it is.
  await page.evaluate(() => document.querySelector('#setup-sizes [data-preset="max"]').click());
  await page.evaluate(() => document.getElementById('arcade-team-size-1-plus').click());
  const capped = { teams: (await setup()).teams, note: await page.evaluate(() => document.getElementById('arcade-team-stopped')?.textContent) };
  check(capped.teams?.join() === '32,32' && capped.note === "32 per team is this computer's limit.", `a bot past the limit says whose limit it is (${JSON.stringify(capped)})`);
  await page.evaluate(() => document.getElementById('arcade-team-size-0-minus').click());
  check((await setup()).teams?.join() === '31,31', 'a bot fewer shrinks every team alike (Even teams)');
  // A party preset: Lunar Roulette (the Roulette mode, Lunar on, its standard features on).
  await page.evaluate(() => document.getElementById('setup-party-lunar_roulette').click());
  const party = await setup();
  const lit = await read();
  check(party.mode === 'core.roulette' && party.gravity === 0.4 && party.fallDamage === false && !party.randomChars && lit.variants.join() === 'lunar,signature,jackpots,streakpick', `Lunar Roulette: the Roulette mode in low gravity, the map's own size (${JSON.stringify({ mode: party.mode, gravity: party.gravity, fall: party.fallDamage, random: party.randomChars, bots: party.bots, variants: lit.variants })})`);
  // Enter starts from anywhere (a section head focused is a button: Enter presses it; the panel itself starts).
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Enter');
  const started = await page.waitForFunction(() => window.__cs?.local, null, { timeout: T(60000) }).then(() => true, () => false);
  check(started, 'Enter starts the match');
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

/**
 * Spectate before the start (owner, 2026-11-06: "sometimes I just wanna watch the bots go at it"). Match setup's
 * Spectate starts the match with you watching (a bot plays your place), and it starts as soon as you've loaded:
 * spectators count for the start gate, so bots against bots don't wait out its 30 s. The pause menu's Spectate,
 * pressed while the match is still loading, does the same.
 */
async function spectateStartFlow(browser) {
  const errors = [];
  // Where the match runs: note the ticks it heard you loaded, began the countdown and took you out of play.
  const hook = (page) =>
    until(
      () =>
        sim(page, (m) => {
          if (!m.__gate) {
            m.__gate = {};
            const ready = m.ready.bind(m);
            m.ready = (s) => ((m.__gate.ready ??= m.tick), ready(s));
            const count = m.startCountdown.bind(m);
            m.startCountdown = () => ((m.__gate.count ??= m.tick), count());
            const spectate = m.spectate.bind(m);
            m.spectate = (s) => ((m.__gate.spectate ??= m.tick), spectate(s));
          }
          return true;
        }),
      T(60000),
    );
  const gate = (page) => sim(page, (m, me) => ({ ...m.__gate, phase: m.phase, spectator: m.isSpectator(me.slot), humans: m.combatants().filter((c) => c.kind === 'human').length, bots: m.combatants().filter((c) => c.kind === 'bot').length }));
  // The countdown starts the tick after you've loaded; a page that took longer than the wait itself proves nothing either way.
  const startedOnLoad = (g) => g.count !== undefined && g.ready !== undefined && (g.count <= g.ready + 1 || (g.ready >= 1800 && g.count === 1800));
  // Match setup → Spectate.
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('cs.arcade', JSON.stringify({ map: 'sandgate', mode: 'core.tdm', bots: 3, skill: 'easy', scoreLimit: 40, minutes: 10, teams: [3, 3] })));
  await page.goto(`${CLIENT}/?test=1`);
  await page.waitForFunction(() => window.__front, null, { timeout: T(30000) });
  await page.click('#nav-play');
  await page.click('#arcade-spectate');
  await hook(page);
  const playing = await page.waitForFunction(() => window.__cs?.spec?.().spectator && window.__cs.phase() === 'playing', null, { timeout: T(120000) }).then(() => true, () => false);
  const g = await gate(page);
  const cam = await page.evaluate(() => {
    const s = window.__cs.spec();
    return { out: s.out, free: s.free, following: s.following };
  });
  check(playing && g.spectator && g.humans === 0 && g.bots === 6 && cam.out, `Match setup's Spectate starts the match watching it: 3v3 bots, you out of play (${JSON.stringify({ ...g, ...cam })})`);
  check(startedOnLoad(g), `it starts once you've loaded, not after the start gate's 30 s (loaded at tick ${g.ready}, countdown at ${g.count})`);
  await page.context().close();
  // The pause menu's Spectate while the match is still loading.
  const second = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  // (The button asks for the mouse, as a click on it would; clicked by script there's no user gesture to grant it.)
  second.on('pageerror', (e) => !/user gesture is required to request Pointer Lock/i.test(e.message) && errors.push(`pause: ${e.message}`));
  await second.goto(`${CLIENT}/?offline=sandgate&test=1`);
  await second.waitForFunction(() => window.__cs?.spec && window.__sim?.eval, null, { timeout: T(60000) });
  await hook(second);
  await second.evaluate(() => document.getElementById('pause-spectate').click());
  const watching = await second.waitForFunction(() => window.__cs.spec().spectator && window.__cs.phase() === 'playing', null, { timeout: T(120000) }).then(() => true, () => false);
  const h = await gate(second);
  check(watching && h.spectator && h.humans === 0 && h.spectate !== undefined && (h.ready === undefined || h.spectate <= h.ready) && startedOnLoad(h), `Spectate pressed before the start: the match still starts once you've loaded (spectated at tick ${h.spectate}, loaded at ${h.ready}, countdown at ${h.count})`);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await second.context().close();
}

/**
 * Match setup on the smallest window (640 × 360): a custom uneven three-team
 * setup (2v3v5, you on the third team; Even teams off) is saved by name in
 * the foot's saved setups menu, survives a reload and a change, loads back,
 * and starts with those sizes.
 */
async function customSetupFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  await page.goto(CLIENT);
  await page.evaluate(() => {
    localStorage.setItem('cs.arcade', JSON.stringify({ map: 'sandgate', mode: 'core.tdm', bots: 3, skill: 'easy', scoreLimit: 40, minutes: 10, teams: [4, 4] }));
    localStorage.removeItem('cs.setups');
  });
  await page.reload();
  await page.waitForFunction(() => window.__front, null, { timeout: T(30000) });
  await page.click('#nav-play');
  // A small window opens one section at a time, and starts with them all closed.
  const closed = await page.evaluate(() => [...document.querySelectorAll('#match-setup .setup-sec.open')].length);
  await page.click('#setup-teams-head');
  await page.waitForSelector('#arcade-team-cards');
  check(closed === 0, `a small window starts with the setup's sections closed (${closed} open)`);
  // Uneven teams: Even teams off first (on, every team changes alike).
  await page.evaluate(() => document.getElementById('arcade-even').click());
  const setSize = (i, v) =>
    page.evaluate(([i, v]) => {
      const input = document.getElementById(`arcade-team-size-${i}`);
      input.value = String(v);
      input.dispatchEvent(new Event('change'));
    }, [i, v]);
  await page.evaluate(() => document.getElementById('arcade-team-count-plus').click());
  await setSize(0, 2);
  await setSize(1, 3);
  await setSize(2, 5);
  await page.evaluate(() => document.querySelector('#arcade-team-cards .team-join[data-team="2"]').click());
  const total = () => page.evaluate(() => document.getElementById('arcade-team-total')?.textContent ?? '');
  const made = await total();
  const mine = await page.evaluate(() => document.querySelector('#arcade-team-cards .team-card.mine')?.dataset.team);
  check(made.startsWith('2v3v5') && mine === '2', `the team editor makes an uneven 2v3v5 with you on the third team (${made}, you on ${mine})`);
  const fits = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, start: (() => { const r = document.getElementById('arcade-start').getBoundingClientRect(); return r.bottom <= innerHeight && r.right <= innerWidth && r.height > 0; })() }));
  check(fits.sw <= fits.iw && fits.start, `match setup fits 640 × 360 without sideways scrolling, Start in view (${JSON.stringify(fits)})`);
  // Save it by name, change the setup, reload: the changed one is remembered; the saved one loads back.
  await page.evaluate(() => (document.getElementById('setup-saved').open = true));
  await page.fill('#setup-save-name', 'Three way');
  await page.evaluate(() => document.getElementById('setup-save').click());
  await page.selectOption('#arcade-teams', '1,1');
  const changed = await total();
  await page.reload();
  await page.waitForFunction(() => window.__front, null, { timeout: T(30000) });
  await page.click('#nav-play');
  await page.click('#setup-teams-head');
  await page.waitForSelector('#arcade-team-cards');
  const remembered = await total();
  check(changed.startsWith('1v1') && remembered.startsWith('1v1'), `the last setup is remembered across a reload (${changed} → ${remembered})`);
  await page.evaluate(() => (document.getElementById('setup-saved').open = true));
  const names = await page.evaluate(() => [...document.querySelectorAll('#setup-saved-list option')].map((o) => o.value).filter(Boolean));
  await page.selectOption('#setup-saved-list', 'Three way');
  await page.waitForFunction(() => document.getElementById('arcade-team-total')?.textContent.startsWith('2v3v5'), null, { timeout: T(5000) }).catch(() => {});
  const loaded = await total();
  check(names.includes('Three way') && loaded.startsWith('2v3v5'), `the saved setup reloads by name (${names.join(', ')}: ${loaded})`);
  await page.click('#arcade-start');
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0, null, { timeout: T(60000) });
  await simWait(page, (m) => !!m.teams, null, T(60000));
  await simWait(page, (m) => m.teams.map((t) => m.combatants().filter((c) => c.faction === t.id).length).join(',') === '2,3,5', null, T(10000));
  const teams = await sim(page, (m, me) => ({ sizes: m.teams.map((t) => m.combatants().filter((c) => c.faction === t.id).length), me: m.teams.findIndex((t) => t.id === me.faction) }));
  check(teams.sizes.join(',') === '2,3,5' && teams.me === 2, `the custom setup starts as 2v3v5 with you on the third team (${JSON.stringify(teams)})`);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

/**
 * Weapon sets (docs/WEAPON_SETS_PLAN.md; sim/weaponSets.ts). Sandgate's own default is Military (its Map properties):
 * Match setup names it ("Map default (Military)") and its facts show it; the match spawns you with a knife, a pistol
 * and an assault rifle (the bots too) and its weapon pickups hold Military weapons; the pause menu's Host tab switches
 * the set at once (the pickups now, your next life's loadout). Match setup's own choice, Chaos, saved with the setup,
 * gives a new oddball each life (dealt from a deck shuffled from the seed and your slot) and a sheep. MapMaker's Map properties
 * field sets a map's default, and its TEST plays it. E2E_SHOTS: the Weapons choice, a Chaos spawn, the field.
 */
async function weaponsetsFlow(browser) {
  const shots = process.env.E2E_SHOTS;
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  // Team Deathmatch on Sandgate, 2v2, saved before weapon sets (it names none: the map's default).
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.setItem('cs.arcade', JSON.stringify({ map: 'sandgate', mode: 'core.tdm', bots: 3, skill: 'easy', scoreLimit: 40, minutes: 10, teams: [2, 2] }));
    sessionStorage.setItem('seeded', '1');
  });
  /** Play → Match setup, Advanced rules → Weapons, pickups & vehicles open: the Weapon set row in view. */
  const openWeapons = async (p) => {
    await p.goto(`${CLIENT}/?test=1`);
    await p.waitForFunction(() => window.__front, null, { timeout: T(30000) });
    await p.evaluate(() => document.getElementById('nav-play').click());
    await p.waitForSelector('#setup-advanced-head', { timeout: T(30000) });
    // Advanced rules open (the head is a toggle, and the setup redraws as it settles: a click while it redrew, or on a
    // section already open, left it shut): opened only while it says it is shut, until its Weapons fold is there.
    await p.waitForFunction(() => {
      const head = document.getElementById('setup-advanced-head');
      if (head && head.getAttribute('aria-expanded') !== 'true') head.click();
      return !!document.getElementById('setup-arsenal');
    }, null, { timeout: T(10000), polling: 500 });
    await p.evaluate(() => {
      const d = document.getElementById('setup-arsenal');
      if (!d.open) d.querySelector('summary').click();
    });
    await p.waitForSelector('#arcade-weapons', { state: 'visible', timeout: T(5000) });
  };
  const setupState = (p) =>
    p.evaluate(() => ({
      options: [...document.querySelectorAll('#arcade-weapons option')].map((o) => o.value),
      first: document.querySelector('#arcade-weapons option')?.textContent,
      value: document.getElementById('arcade-weapons')?.value,
      fact: document.getElementById('setup-weapons-fact')?.textContent ?? null,
      chips: document.getElementById('setup-rule-chips')?.textContent ?? '',
      saved: JSON.parse(localStorage.getItem('cs.arcade') ?? '{}').weaponSet ?? null,
    }));
  const started = (p) => p.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() !== 'waiting' && window.__cs.phase() !== 'countdown', null, { timeout: T(60000) });
  /** What you carry now, and the random gun this life rolls (Chaos, Mixed bag). */
  const myKit = (p) => sim(p, (m, me, a, mod) => ({ set: m.weaponSet?.id, life: me.spawns, weapons: [...me.weapons.values()].map((w) => w.def.id), held: me.weapons.get(me.current)?.def.id, grenade: me.throwable?.kind, rolled: mod.randomGunFor(m.weaponSet, m.seed, me.slot, me.spawns) }));
  /**
   * Die and come straight back: the new life's loadout. The gun you die with drops at your body (rules.dropWeapons):
   * standing idle at your spawn, the next life could spawn on that same point and pick last life's oddball straight up
   * (four weapons; CI, once), or a bot's beside it. The lying drops are cleared as you die: what's checked is what a
   * life spawns with.
   */
  const respawn = async (p) => {
    const life = await sim(p, (m, me) => me.spawns ?? 0);
    await sim(p, (m, me) => {
      m.kill(me, null, 'core.respawn');
      m.drops.length = 0;
      me.respawnTick = m.tick;
    });
    await simWait(p, (m, me, n) => me.alive && (me.spawns ?? 0) > n, life, T(15000));
    return myKit(p);
  };

  // The map's own default: Military.
  await openWeapons(page);
  const offered = await setupState(page);
  check(offered.options.join() === 'map,standard,military,scifi,medieval,chaos,mixed' && offered.first === 'Map default (Military)' && offered.value === 'map' && offered.fact === 'Military weapons' && offered.saved === null, `Match setup → Weapons offers every set and the map's default, named, which the setup's facts show (${JSON.stringify(offered)})`);
  const MILITARY = ['core.rifle', 'core.burst_rifle', 'core.battle_rifle', 'core.smg', 'core.machine_pistol', 'core.lmg', 'core.shotgun', 'core.auto_shotgun', 'core.sawed_off', 'core.sniper', 'core.marksman', 'core.launcher', 'core.rockets', 'core.pistol', 'core.revolver', 'core.hand_cannon'];
  const SCIFI = ['core.plasma', 'core.laser_rifle', 'core.railgun', 'core.pulse_pistol', 'core.arc_caster', 'core.disc_launcher', 'core.swarm', 'core.guided'];
  await page.click('#arcade-start');
  await started(page);
  const kit = await sim(page, (m, me, ids) => ({
    set: m.weaponSet?.id,
    weapons: [...me.weapons.values()].map((w) => w.def.id),
    held: me.weapons.get(me.current)?.def.id,
    grenade: me.throwable?.kind,
    bots: m.combatants().filter((c) => c.kind === 'bot').map((c) => [...c.weapons.values()].map((w) => w.def.id).join(' ')),
    pickups: m.pickups.filter((p) => p.item.effect.kind === 'weapon').map((p) => p.item.effect.weapon),
    off: m.pickups.filter((p) => p.item.effect.kind === 'weapon' && !ids.includes(p.item.effect.weapon)).map((p) => p.item.id),
  }), MILITARY);
  check(kit.set === 'military' && kit.weapons.join() === 'core.knife,core.pistol,core.rifle' && kit.held === 'core.rifle' && kit.grenade === 'frag', `Sandgate's Military match spawns you with a knife, a pistol and an assault rifle in hand, and a frag (${JSON.stringify({ set: kit.set, weapons: kit.weapons, held: kit.held, grenade: kit.grenade })})`);
  check(kit.bots.length === 3 && kit.bots.every((b) => /core\.pistol/.test(b) && /core\.(rifle|marksman)/.test(b)), `the bots spawn with a pistol and an assault rifle too (${kit.bots.join(' | ')})`);
  check(kit.pickups.length > 0 && kit.off.length === 0, `its weapon pickups hold Military weapons (${kit.pickups.join(', ')}; not: ${kit.off.join(', ') || 'none'})`);
  const hud = await page.evaluate(() => ({ n: window.__cs.local.inventory.size, held: window.__cs.local.held }));
  const heldCode = await sim(page, (m, me) => me.current);
  check(hud.n === 3 && hud.held === heldCode, `the HUD has the three weapons, the rifle in hand (${JSON.stringify(hud)})`);

  // The pause menu's Host tab: the same choice, applied at once.
  await page.evaluate(() => (document.getElementById('host-controls').open = true));
  await page.waitForSelector('#hc-weapons', { state: 'attached', timeout: T(10000) });
  const tab = await page.evaluate(() => ({ value: document.getElementById('hc-weapons').value, first: document.querySelector('#hc-weapons option')?.textContent, n: document.querySelectorAll('#hc-weapons option').length }));
  check(tab.value === 'map' && tab.first === 'Map default (Military)' && tab.n === 7, `the Host tab offers the weapon set, on the map's default (${JSON.stringify(tab)})`);
  await page.evaluate(() => {
    const s = document.getElementById('hc-weapons');
    s.value = 'scifi';
    s.dispatchEvent(new Event('change'));
    document.getElementById('hc-apply')?.click();
  });
  const swapped = await simWait(page, (m, _me, ids) => m.weaponSet?.id === 'scifi' && m.pickups.filter((p) => p.item.effect.kind === 'weapon').every((p) => ids.includes(p.item.effect.weapon)), SCIFI, T(10000));
  check(swapped, 'the Host tab switches to Sci-fi at once: every weapon pickup holds a Sci-fi weapon');
  const sci = await respawn(page);
  check(sci.weapons.join() === 'core.knife,core.pulse_pistol,core.plasma' && sci.grenade === 'sticky', `your next life spawns with Sci-fi's knife, pulse pistol and plasma rifle, and a sticky grenade (${JSON.stringify(sci)})`);
  await page.close();

  // Match setup's own choice, Chaos (the setup saved in this browser; a new page).
  const page2 = await ctx.newPage();
  page2.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  await openWeapons(page2);
  await page2.selectOption('#arcade-weapons', 'chaos');
  await page2.waitForFunction(() => document.getElementById('setup-weapons-fact')?.textContent === 'Chaos weapons', null, { timeout: T(5000) }).catch(() => {});
  const picked = await setupState(page2);
  check(picked.saved === 'chaos' && picked.value === 'chaos' && picked.fact === 'Chaos weapons' && /Chaos weapons/.test(picked.chips), `picking Chaos saves it with the setup, and the setup says so (${JSON.stringify(picked)})`);
  if (shots) {
    // The choice drawn open (a list showing every option) for the picture, then back to a drop-down. Scrolled to
    // until it is in view (the setup can redraw over a first scroll).
    await page2
      .waitForFunction(
        () => {
          const s = document.getElementById('arcade-weapons');
          s.size = s.options.length;
          const r = s.getBoundingClientRect();
          if (r.top > 0 && r.bottom < innerHeight) return true;
          s.scrollIntoView({ block: 'center' });
          return false;
        },
        null,
        { timeout: T(10000), polling: 250 },
      )
      .catch(() => {});
    await page2.screenshot({ path: `${shots}/weapon-sets-setup.png` });
    await page2.evaluate(() => (document.getElementById('arcade-weapons').size = 0));
  }
  await page2.click('#arcade-start');
  await started(page2);
  const lives = [await myKit(page2)];
  for (let i = 0; i < 5; i++) lives.push(await respawn(page2));
  const mains = await sim(page2, (m, _me, _a, mod) => mod.setMainGuns(m.weaponSet).map((w) => w.id));
  check(lives[0].set === 'chaos' && lives.every((l) => l.weapons[0] === 'core.knife' && l.weapons[1] === 'core.pistol' && l.weapons.length === 3 && mains.includes(l.held) && l.held === l.rolled && l.grenade === 'sheep'), `a Chaos match spawns you with a knife, a pistol and the life's oddball, and a sheep (${lives.map((l) => `life ${l.life}: ${l.held}${mains.includes(l.held) ? '' : ' (not a main gun)'}${l.held === l.rolled ? '' : ` (rolled ${l.rolled})`}${l.weapons.length === 3 && l.weapons[0] === 'core.knife' && l.weapons[1] === 'core.pistol' && l.grenade === 'sheep' ? '' : ` [${l.weapons.join(' ')}; ${l.grenade}]`}`).join(', ')}${lives[0].set === 'chaos' ? '' : `; set ${lives[0].set}`})`);
  check(new Set(lives.map((l) => l.held)).size >= 3, `the spawn gun changes from life to life (${lives.map((l) => l.held?.replace('core.', '')).join(', ')})`);
  if (shots) {
    // Your own oddball in the picture, with the pause menu (headless pages open it) out of the way: the page draws the
    // held gun once the snapshot has it.
    await page2.addStyleTag({ content: '#pause { display: none !important; }' });
    await page2.waitForFunction((code) => window.__cs.local.held === code, await sim(page2, (m, me) => me.current), { timeout: T(10000) }).catch(() => {});
    await frames(page2, 20);
    await page2.screenshot({ path: `${shots}/weapon-sets-chaos-spawn.png` });
  }
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await ctx.close();

  // MapMaker: Map properties → Weapon set, saved in the map; TEST plays it.
  const ed = await (await browser.newContext({ viewport: { width: 1400, height: 820 } })).newPage();
  const edErrors = [];
  ed.on('pageerror', (e) => edErrors.push(process.env.E2E_STACKS ? e.stack : e.message));
  await ed.goto(`${CLIENT}/?mode=editor&test=1`);
  await ed.waitForFunction(() => window.__editor, null, { timeout: T(30000) });
  ed.once('dialog', (d) => d.accept());
  await newMap(ed, 96);
  await ed.waitForSelector('#ed-prop-weapons', { timeout: T(10000) });
  const field = await ed.evaluate(() => ({ value: document.getElementById('ed-prop-weapons').value, options: [...document.querySelectorAll('#ed-prop-weapons option')].map((o) => o.value), set: window.__editor.doc.weaponSet ?? null }));
  check(field.value === 'standard' && field.options.join() === 'standard,military,scifi,medieval,chaos,mixed' && field.set === null, `MapMaker's Map properties offer a weapon set, Standard by default (${JSON.stringify(field)})`);
  await ed.selectOption('#ed-prop-weapons', 'scifi');
  // (The inspector redraws on MapMaker's next frame: slow under software rendering.)
  await ed.waitForFunction(() => window.__editor.doc.weaponSet === 'scifi' && /pulse pistol/.test(document.getElementById('ed-prop-weapons-hint')?.textContent ?? ''), null, { timeout: T(15000) }).catch(() => {});
  const chosen = await ed.evaluate(() => ({ set: window.__editor.doc.weaponSet, value: document.getElementById('ed-prop-weapons')?.value, hint: document.getElementById('ed-prop-weapons-hint')?.textContent ?? '' }));
  check(chosen.set === 'scifi' && chosen.value === 'scifi' && /pulse pistol/.test(chosen.hint), `picking Sci-fi sets the map's default (${JSON.stringify(chosen)})`);
  if (shots) {
    await ed.evaluate(() => document.getElementById('ed-prop-weapons')?.scrollIntoView({ block: 'center' }));
    await ed.screenshot({ path: `${shots}/weapon-sets-mapmaker.png` });
  }
  await ed.keyboard.press('Control+KeyZ');
  const undone = await ed.evaluate(() => window.__editor.doc.weaponSet ?? null);
  await ed.keyboard.press('Control+KeyY');
  const redone = await ed.evaluate(() => window.__editor.doc.weaponSet ?? null);
  check(undone === null && redone === 'scifi', `undo and redo take the set back and forth (${undone} / ${redone})`);
  await ed.keyboard.press('F5');
  await ed.waitForFunction(() => window.__cs?.local && window.__testStartMs, null, { timeout: T(30000) });
  await simWait(ed, (m, me) => me.alive, null, T(15000));
  const test = await sim(ed, (m, me) => ({ set: m.weaponSet?.id, weapons: [...me.weapons.values()].map((w) => w.def.id) }));
  check(test.set === 'scifi' && test.weapons.join() === 'core.knife,core.pulse_pistol,core.plasma', `TEST plays the map's set (${JSON.stringify(test)})`);
  check(edErrors.length === 0, `no page errors in MapMaker (${edErrors.join('; ')})`);
  await ed.context().close();
}

/** Capture the Flag offline: flags drawn, taking the enemy flag shows on the HUD, bringing it home scores. */
async function ctfFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  await page.goto(`${CLIENT}/?offline=bunker_cross&gamemode=core.ctf&test=1&god=1`);
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() !== 'waiting' && window.__cs.phase() !== 'countdown' && window.__match && window.__cs.mode?.state, null, { timeout: T(60000) });
  await page.waitForFunction(() => document.getElementById('mode-label')?.textContent === 'Capture the Flag', null, { timeout: T(10000) }).catch(() => {});
  const label = await page.textContent('#mode-label');
  check(label === 'Capture the Flag', `the match runs Capture the Flag (${label})`);
  const drawn = await page.evaluate(() => ({ flags: window.__cs.mode.flagCount, nodes: window.__cs.view.scene.transformNodes.filter((n) => /^flag_[a-z]+$/.test(n.name)).length, bases: window.__cs.view.scene.transformNodes.filter((n) => /^flagbase_/.test(n.name)).length }));
  check(drawn.flags === 2 && drawn.nodes === 2 && drawn.bases === 2, `both flags and bases are drawn (${JSON.stringify(drawn)})`);
  const status = await page.evaluate(() => [...document.querySelectorAll('#mode-status [data-flag]')].map((e) => e.dataset.state));
  check(status.length === 2, `the HUD shows both flags' status (${status})`);
  if (process.env.E2E_SHOTS) {
    // Look at the enemy flag from a few metres off (the pause overlay is up in headless runs: hide it for the picture).
    await page.evaluate(() => {
      const me = window.__match.slots[window.__cs.slot];
      const theirs = window.__match.mode.flags.find((f) => f.team !== me.faction);
      const own = window.__match.mode.flags.find((f) => f.team === me.faction);
      const d = Math.hypot(own.base.x - theirs.base.x, own.base.z - theirs.base.z) || 1;
      const from = { x: theirs.base.x + ((own.base.x - theirs.base.x) / d) * 5, y: theirs.base.y + 0.2, z: theirs.base.z + ((own.base.z - theirs.base.z) / d) * 5 };
      me.move = { pos: from, velY: 0, grounded: false };
      window.__cs.input.yaw = Math.atan2(theirs.base.x - from.x, theirs.base.z - from.z);
      window.__cs.input.pitch = -0.15;
      document.getElementById('pause').style.visibility = 'hidden';
    });
    await page.waitForTimeout(1500); // wait-ok: E2E_SHOTS picture only
    await page.screenshot({ path: `${process.env.E2E_SHOTS}/ctf-flag.png`, timeout: T(60000) }).catch(() => {});
  }
  // Stand on the enemy flag: it is ours to carry.
  await page.evaluate(() => {
    const me = window.__match.slots[window.__cs.slot];
    const theirs = window.__match.mode.flags.find((f) => f.team !== me.faction);
    // If a bot already has it, put it back on its base so the test starts clean.
    if (theirs.state === 1) {
      const c = window.__match.slots[theirs.carrier];
      if (c) c.modeSpeed = undefined;
      Object.assign(theirs, { state: 0, carrier: null, pos: { ...theirs.base } });
    }
    me.move = { pos: { ...theirs.pos, y: theirs.pos.y + 0.2 }, velY: 0, grounded: false };
  });
  await page.waitForFunction(() => document.querySelector('#mode-status .ms.me'), null, { timeout: T(8000) }).catch(() => {});
  const carrying = await page.evaluate(() => ({
    hud: document.querySelector('#mode-status .ms.me')?.textContent ?? '',
    msg: document.getElementById('message').textContent,
    carrier: window.__cs.mode.state.fl.find((r) => r[1] === 1)?.[5],
    slot: window.__cs.slot,
    speed: window.__cs.local.statusSpeed,
    home: [...document.querySelectorAll('#mode-markers .mode-marker')].map((m) => m.dataset.id),
  }));
  check(carrying.carrier === carrying.slot && /You have it/.test(carrying.hud), `picking up the enemy flag shows on the HUD (${carrying.hud})`);
  check(/You have the flag/.test(carrying.msg ?? ''), `the announcer calls it (${carrying.msg})`);
  check(Math.abs(carrying.speed - 0.85) < 0.01, `the carrier is slowed (${carrying.speed})`);
  check(carrying.home.includes('base'), `a marker points the way home (${carrying.home})`);
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/ctf-carrying.png`, timeout: T(60000) }).catch(() => {});
  // Run it home (our own flag must be there: send it home if a bot took it).
  await page.evaluate(() => {
    const m = window.__match;
    const me = m.slots[window.__cs.slot];
    const ours = m.mode.flags.find((f) => f.team === me.faction);
    if (ours.state !== 0) {
      const c = m.slots[ours.carrier];
      if (c) c.modeSpeed = undefined;
      Object.assign(ours, { state: 0, carrier: null, pos: { ...ours.base } });
    }
    me.move = { pos: { ...ours.base, y: ours.base.y + 0.2 }, velY: 0, grounded: false };
  });
  await page.waitForFunction(() => window.__cs.mode.state.ts.some((n) => n > 0) && document.querySelector('#sb-left b')?.textContent === '1', null, { timeout: T(8000) }).catch(() => {});
  const after = await page.evaluate(() => ({ ts: window.__cs.mode.state.ts, left: document.querySelector('#sb-left b')?.textContent, msg: document.getElementById('message').textContent }));
  check(after.ts.some((n) => n === 1) && after.left === '1', `bringing it home scores a capture (${JSON.stringify(after)})`);
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/ctf-captured.png`, timeout: T(60000) }).catch(() => {});
  // Tab: the two teams side by side, each its own column, your capture on your row.
  await page.keyboard.down('Tab');
  await page.waitForFunction(() => document.querySelectorAll('#scoreboard .sb-group').length === 2 && document.querySelector('#scoreboard .sb-row.me'), null, { timeout: T(5000) }).catch(() => {});
  const cols = await scoreboardColumns(page);
  const meSeen = await scoreboardMeVisible(page);
  const caps = await page.evaluate(() => {
    const hd = [...document.querySelectorAll('#scoreboard .sb-hd')][0];
    const at = [...(hd?.children ?? [])].findIndex((c) => c.textContent === 'Caps');
    return at < 0 ? null : document.querySelector('#scoreboard .sb-row.me')?.children[at]?.textContent;
  });
  await page.keyboard.up('Tab');
  check(cols.length === 2 && cols[0].top === cols[1].top && cols[1].left >= cols[0].right, `two teams show as two side-by-side columns (${JSON.stringify(cols)})`);
  check(meSeen.ok, `your row is visible on the scoreboard (${meSeen.why})`);
  check(caps === '1', `the scoreboard's Caps column counts your capture (${caps})`);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

/**
 * Breakthrough (core.breakthrough) on the Breakthrough Range (maps/test_breakthrough.json: a test map, metadata.testOnly,
 * that no list offers; the test reaches it with ?testmap=; Breakthrough its only mode). Match Setup offers the mode on a map with sectors, with its own settings
 * (reinforcements, sector time, second round), and greys it out on one without, saying why. In the match the HUD
 * shows your side, the sector strip, the pool and the objectives (marked, drawn in the world, on the minimap); bots
 * take the first sector on their own (the clock run forward, you kept out of it); both sides' spawns move on, the
 * next sector's targets switch on ("two of three"), and a defender left behind the new line is warned, then hurt.
 */
/**
 * Roulette (docs/ROULETTE_MODE_PLAN.md; sim/roulette.ts, game/rouletteHud.ts): Match Setup offers the mode and its
 * variant chips (its standard features on, its variants off); the Lunar Roulette party preset starts the mode with
 * Lunar on; in the match a new character every life (the spawn card says who), a streak pick of three on the death
 * screen (a click picks), a jackpot life (its card and glow), and the awards on the scoreboard at the end.
 */
async function rouletteFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  await page.addInitScript(() => {
    if (!localStorage.getItem('cs.arcade')) localStorage.setItem('cs.arcade', JSON.stringify({ map: 'sandgate', mode: 'core.deathmatch', bots: 3, skill: 'normal', scoreLimit: 15, minutes: 10, scoreAuto: true, timeAuto: true }));
  });
  await page.goto(`${CLIENT}/?test=1&god=1`);
  await page.waitForFunction(() => window.__front, null, { timeout: T(30000) });
  await page.evaluate(() => document.getElementById('nav-play').click());
  await page.waitForSelector('#arcade-mode-roulette', { timeout: T(30000) });
  await page.evaluate(() => document.getElementById('arcade-mode-roulette').click());
  await page.waitForSelector('#setup-variant-signature', { timeout: T(10000) });
  const chips = () =>
    page.evaluate(() => ({
      mode: JSON.parse(localStorage.getItem('cs.arcade') ?? '{}').mode,
      pressed: document.getElementById('arcade-mode-roulette')?.getAttribute('aria-pressed') ?? document.getElementById('arcade-mode-roulette')?.classList.contains('on'),
      all: [...document.querySelectorAll('#setup-variants .variant-chip')].map((b) => b.dataset.variant),
      on: [...document.querySelectorAll('#setup-variants .variant-chip.on')].map((b) => b.dataset.variant),
      line: document.querySelector('.mode-line')?.textContent ?? '',
    }));
  const offered = await chips();
  check(offered.all.join() === 'lunar,signature,jackpots,streakpick,rerolls,swap,variety,rlteams' && offered.on.join() === 'signature,jackpots,streakpick', `Match Setup offers Roulette with its chips: the standard features on, the variants off (${JSON.stringify(offered)})`);
  // A standard feature switches off and on again; a variant on and off.
  await page.evaluate(() => document.getElementById('setup-variant-signature').click());
  await page.evaluate(() => document.getElementById('setup-variant-swap').click());
  const switched = await chips();
  await page.evaluate(() => document.getElementById('setup-variant-signature').click());
  await page.evaluate(() => document.getElementById('setup-variant-swap').click());
  const back = await chips();
  check(switched.on.join() === 'jackpots,streakpick,swap' && back.on.join() === 'signature,jackpots,streakpick', `its chips switch (off a standard one, on a variant: ${switched.on.join()}; back: ${back.on.join()})`);
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/roulette-setup.png`, timeout: T(60000) }).catch(() => {});
  // The party preset: Lunar Roulette plays the mode, Lunar on.
  await page.evaluate(() => document.getElementById('arcade-mode-deathmatch').click());
  await page.evaluate(() => document.getElementById('setup-party-lunar_roulette').click());
  const party = await chips();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('cs.arcade') ?? '{}'));
  check(party.mode === 'core.roulette' && party.on.join() === 'lunar,signature,jackpots,streakpick' && saved.gravity === 0.4 && saved.fallDamage === false && !saved.randomChars, `Lunar Roulette starts the Roulette mode with Lunar on (${JSON.stringify({ ...party, gravity: saved.gravity, fall: saved.fallDamage })})`);
  await page.evaluate(() => document.getElementById('arcade-start').click());
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() === 'playing' && window.__match, null, { timeout: T(150000) });
  const rules = await page.evaluate(() => ({ mode: window.__match.rules.mode, lunar: window.__match.rules.lunar, gravity: window.__match.phys.gravity, roulette: !!window.__match.roulette, label: document.getElementById('mode-label')?.textContent }));
  check(rules.mode === 'core.roulette' && rules.lunar === true && rules.gravity === 0.4 && rules.roulette && rules.label === 'Roulette', `the match plays Roulette with Lunar's extras (${JSON.stringify(rules)})`);
  // Pictures with the pause overlay (up in headless runs) hidden.
  const shoot = async (name) => {
    if (!process.env.E2E_SHOTS) return;
    await page.evaluate(() => (document.getElementById('pause').style.visibility = 'hidden'));
    await frames(page, 5);
    await page.screenshot({ path: `${process.env.E2E_SHOTS}/${name}.png`, timeout: T(60000) }).catch(() => {});
  };
  // Nobody shoots you meanwhile: the bots hold still.
  await page.evaluate(() => {
    for (const c of window.__match.combatants()) {
      if (!c.bot || c.queue.held) continue;
      c.queue.push = (...inputs) => Array.prototype.push.apply(c.queue, inputs.map((i) => ({ ...i, forward: 0, right: 0, buttons: 0 })));
      c.queue.held = true;
    }
  });
  const me = () => page.evaluate(() => window.__match.slots[window.__cs.slot]);
  const life = async () => {
    const before = await page.evaluate(() => ({ look: window.__match.slots[window.__cs.slot].look, spawns: window.__match.slots[window.__cs.slot].spawns }));
    await page.evaluate(() => {
      const m = window.__match;
      m.kill(m.slots[window.__cs.slot], null, 'core.fall');
    });
    await page.waitForFunction((n) => window.__match.slots[window.__cs.slot].alive && window.__match.slots[window.__cs.slot].spawns > n, before.spawns, { timeout: T(30000) });
    // The spawn card: "You are" and the character's name.
    const card = await page.waitForFunction(() => !document.getElementById('rl-card')?.hidden && document.querySelector('#rl-card b')?.textContent, null, { timeout: T(15000) }).then(() => page.evaluate(() => ({ name: document.querySelector('#rl-card b')?.textContent, line: document.querySelector('#rl-card span')?.textContent })), () => null);
    const after = await page.evaluate(() => window.__match.slots[window.__cs.slot].look);
    return { before: before.look, after, card };
  };
  // Shader programs once the warm-up is done, and after a few lives in new bodies (Roulette's swaps build none mid-match).
  await page.waitForFunction(() => !!window.__cs.view.prewarmed, null, { timeout: T(30000) }).catch(() => {});
  const shadersAtStart = await page.evaluate(() => window.__cs.view.shaderCount());
  const first = await life();
  // (The second life's card held on screen for its picture: a slow page draws a frame a second.)
  await page.evaluate(() => window.__cs.rouletteHold(true));
  const lives = [first, await life()];
  await shoot('roulette-spawn-card');
  await page.evaluate(() => window.__cs.rouletteHold(false));
  check(lives.every((l) => l.after !== l.before && !!l.card?.name && /:/.test(l.card?.line ?? '')), `a new character every life, with its spawn card (${JSON.stringify(lives)})`);
  // A streak pick: three kills in one life, then down: the death screen offers three; a click picks the second.
  await page.evaluate(() => {
    const m = window.__match;
    const mine = m.slots[window.__cs.slot];
    mine.shieldUntil = 0;
    const bots = m.combatants().filter((c) => c.bot);
    for (let i = 0; i < 3; i++) {
      const b = bots[i % bots.length];
      b.alive = true;
      m.kill(b, mine, 'core.pistol');
    }
    m.kill(mine, bots[0], 'core.pistol');
  });
  const shown = await page.waitForFunction(() => document.querySelectorAll('#rl-pick .rl-pick-card').length === 3 && !document.getElementById('rl-pick').hidden, null, { timeout: T(20000) }).then(() => true, () => false);
  const cards = await page.evaluate(() => [...document.querySelectorAll('#rl-pick .rl-pick-card')].map((b) => b.dataset.look));
  // (The respawn holds 6 s for the choice: held longer here, while a slow page draws the picture.)
  await page.evaluate(() => (window.__match.slots[window.__cs.slot].respawnTick = window.__match.tick + 60 * 120));
  check(shown && new Set(cards).size === 3, `3 kills in one life: the death screen offers a pick of three (${cards.join(', ')})`);
  await page.waitForFunction(() => [...document.querySelectorAll('#rl-pick img')].every((i) => i.complete), null, { timeout: T(10000) }).catch(() => {});
  await shoot('roulette-pick');
  await page.evaluate(() => document.getElementById('rl-pick-1').click());
  const picked = await page.waitForFunction((want) => window.__match.slots[window.__cs.slot].alive && window.__match.slots[window.__cs.slot].look === want, cards[1], { timeout: T(30000) }).then(() => true, () => false);
  check(picked && (await page.evaluate(() => window.__match.roulette.stats(window.__cs.slot).picks)) === 1, `a click on the second card plays it at the next spawn (${cards[1]}: ${(await me()).look})`);
  // A jackpot life (its roll forced for the picture): the card, the glow easing in, the armour.
  await page.evaluate(() => {
    const m = window.__match;
    const dir = m.roulette;
    const deal = dir.deal.bind(dir);
    dir.deal = (c) => {
      const r = deal(c);
      if (c.slot === window.__cs.slot) {
        r.roll = 'jackpot';
        dir.seats.get(c.slot).roll = 'jackpot';
        dir.deal = deal;
      }
      return r;
    };
    m.kill(m.slots[window.__cs.slot], null, 'core.fall');
  });
  const jackpot = await page.waitForFunction(() => document.getElementById('rl-card')?.classList.contains('jackpot') && !document.getElementById('rl-card').hidden, null, { timeout: T(30000) }).then(() => true, () => false);
  await page.waitForFunction(() => (window.__cs.roulette()?.glowPeak ?? 0) > 0.3, null, { timeout: T(10000) }).catch(() => {});
  const glow = await page.evaluate(() => window.__cs.roulette()?.glowPeak ?? 0);
  // (Held at its brightest for the picture.)
  await page.evaluate(() => window.__cs.rouletteHold(true));
  await shoot('roulette-jackpot');
  await page.evaluate(() => window.__cs.rouletteHold(false));
  const armour = await page.evaluate(() => window.__match.slots[window.__cs.slot].armor);
  check(jackpot && glow > 0 && armour >= 50, `a jackpot life: its card, the glow (${glow}), armour (${armour})`);
  const shadersAfter = await page.evaluate(() => window.__cs.view.shaderCount());
  console.log(`roulette: shader programs ${shadersAtStart} after the warm-up, ${shadersAfter} after three new bodies, a pick and a jackpot`);
  // The end of the match: the awards on the scoreboard.
  // (The scoreboard held up for the check and its picture.)
  await page.evaluate(() => {
    window.__match.endMatch();
    window.__match.phaseEndTick = window.__match.tick + 60 * 120;
  });
  const awards = await page.waitForFunction(() => !document.getElementById('match-awards')?.hidden && document.querySelectorAll('#match-awards .award').length > 0, null, { timeout: T(20000) }).then(() => page.evaluate(() => [...document.querySelectorAll('#match-awards .award b')].map((b) => b.textContent)), () => []);
  await shoot('roulette-awards');
  check(awards.includes('Shapeshifter') && awards.includes('Unluckiest Roll'), `the awards at the end of the match (${awards.join(', ')})`);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

async function breakthroughFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  await page.addInitScript(() => {
    if (!localStorage.getItem('cs.arcade')) localStorage.setItem('cs.arcade', JSON.stringify({ map: 'sandgate', mode: 'core.tdm', bots: 3, skill: 'normal', scoreLimit: 40, minutes: 10, scoreAuto: true, timeAuto: true, teams: [4, 4] }));
  });
  // The Breakthrough Range is a test map: Match Setup's list leaves it out, unless a test asks for it (?testmap=).
  await page.goto(`${CLIENT}/?test=1&god=1`);
  await page.waitForFunction(() => window.__front, null, { timeout: T(30000) });
  await page.evaluate(() => document.getElementById('nav-play').click());
  await page.waitForSelector('#arcade-map', { state: 'attached', timeout: T(30000) });
  const hidden = await page.evaluate(() => [...document.getElementById('arcade-map').options].some((o) => o.value === 'test_breakthrough'));
  check(!hidden, 'Match Setup does not list the Breakthrough Range (a test map)');
  await page.goto(`${CLIENT}/?test=1&god=1&testmap=test_breakthrough`);
  await page.waitForFunction(() => window.__front, null, { timeout: T(30000) });
  await page.evaluate(() => document.getElementById('nav-play').click());
  await page.waitForSelector('#arcade-map', { state: 'attached', timeout: T(30000) });
  // (The map loads behind the panel: its unavailable modes show once it has.)
  await page.waitForSelector('.mode-tag-off[data-mode="core.breakthrough"]', { timeout: T(30000) }).catch(() => {});
  const off = await page.evaluate(() => document.querySelector('.mode-tag-off[data-mode="core.breakthrough"]')?.dataset.tip ?? null);
  check(/sectors/.test(off ?? ''), `Match Setup greys Breakthrough out on a map without sectors, saying why (${off})`);
  // With ?testmap= the Range joins Match Setup's map list, by its name.
  const listed = await page.evaluate(() => [...document.getElementById('arcade-map').options].find((o) => o.value === 'test_breakthrough')?.textContent ?? null);
  check(/Breakthrough Range/.test(listed ?? ''), `with ?testmap= Match Setup lists the Breakthrough Range (${listed})`);
  // The map with sectors: Breakthrough is offered, its own settings in "what wins".
  // (The setup's map list: picked as its select does, the map browser being the way a player picks.)
  await page.evaluate(() => {
    const select = document.getElementById('arcade-map');
    select.value = 'test_breakthrough';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForSelector('#arcade-mode-breakthrough', { timeout: T(10000) });
  await page.evaluate(() => document.getElementById('arcade-mode-breakthrough').click());
  await page.waitForSelector('#arcade-bt-swap', { timeout: T(10000) });
  const setup = await page.evaluate(() => ({
    on: document.getElementById('arcade-mode-breakthrough')?.getAttribute('aria-pressed'),
    fields: [...document.querySelectorAll('#setup-win .field-label')].map((l) => l.firstChild?.textContent),
    pool: Number(document.getElementById('arcade-score')?.value),
    minutes: document.getElementById('arcade-minutes')?.textContent,
    swap: document.querySelector('#arcade-bt-swap .tab.on')?.textContent,
    length: document.querySelector('#setup-summary .fact-time')?.textContent,
  }));
  check(setup.on === 'true' && setup.fields.join() === 'Reinforcements,Sector time,Second round' && setup.pool > 0 && /^\d+ min$/.test(setup.minutes ?? '') && setup.swap === 'One round', `Match Setup offers Breakthrough on a map with sectors, with reinforcements, sector time and a second round (${JSON.stringify(setup)})`);
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/breakthrough-setup.png`, timeout: T(60000) }).catch(() => {});
  await page.evaluate(() => document.getElementById('arcade-start').click());
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() !== 'waiting' && window.__cs.phase() !== 'countdown' && window.__match && window.__cs.mode?.state?.bt, null, { timeout: T(90000) });
  await page.waitForFunction(() => document.getElementById('mode-label')?.textContent === 'Breakthrough' && document.querySelectorAll('#mode-status .bt-obj').length === 2, null, { timeout: T(15000) }).catch(() => {});
  const hud = await page.evaluate(() => {
    const m = window.__match;
    const strip = document.querySelector('#mode-status .bt-strip');
    return {
      label: document.getElementById('mode-label')?.textContent,
      side: strip?.dataset.btSide,
      sector: strip?.dataset.btSector,
      letters: [...document.querySelectorAll('#mode-status .bt-sec')].map((s) => s.textContent).join(''),
      pool: Number(document.querySelector('#mode-status .bt-pool')?.dataset.btPool),
      matchPool: m.mode.pool,
      perAttacker: m.rules.breakthroughPool,
      objectives: [...document.querySelectorAll('#mode-status .bt-obj')].map((o) => o.dataset.btObj).join(),
      markers: [...document.querySelectorAll('#mode-markers .mode-marker')].filter((x) => x.dataset.id?.startsWith('bt_')).length,
      world: window.__cs.mode.objectiveCount,
      blips: window.__cs.mode.minimapBlips().map((b) => b.label).join(),
    };
  });
  check(hud.label === 'Breakthrough' && hud.side === 'attack' && hud.sector === '0' && hud.letters === 'ABC', `the HUD shows your side and the sector strip (${JSON.stringify(hud)})`);
  check(hud.pool > 0 && Math.abs(hud.pool - hud.matchPool) <= 2 && hud.perAttacker === setup.pool, `the HUD shows the attackers' reinforcements, as set up (${hud.pool}; the match ${hud.matchPool}, ${hud.perAttacker} an attacker)`);
  check(hud.objectives === 'A1,A2' && hud.markers === 2 && hud.world >= 2 && hud.blips === 'A1,A2', `the beach's two capture zones are in play: on the HUD, marked, drawn and on the minimap (${JSON.stringify(hud)})`);
  // Pictures: the pause overlay (up in headless runs) hidden.
  const shoot = async (name) => {
    if (!process.env.E2E_SHOTS) return;
    await page.evaluate(() => (document.getElementById('pause').style.visibility = 'hidden'));
    await frames(page, 5);
    await page.screenshot({ path: `${process.env.E2E_SHOTS}/${name}.png`, timeout: T(60000) }).catch(() => {});
  };
  await shoot('breakthrough-hud');
  // Bots take the beach on their own: run the clock forward (headless frame rates are slow), you parked out of it.
  // (The sector's clock is held open for the whole run: with Match Setup's 6 reinforcements an attacker and 3 min, three
  // bot attackers took the beach in 40-160 s; this checks that they take it, not how fast.)
  const took = await page.evaluate(() => {
    const m = window.__match;
    const me = m.slots[window.__cs.slot];
    let fell = null;
    const start = m.tick;
    m.mode.clockEnd = Math.max(m.mode.clockEnd, m.tick + 60 * 310);
    for (let i = 0; i < 60 * 300 && m.mode.active === 0 && m.mode.outcome === 0; i++) {
      me.move = { pos: { x: 74, y: 0.2, z: -74 }, velY: 0, grounded: false };
      for (const e of m.step()) if (e.e === 'bt' && e.a === 'sector') fell = { seconds: Math.round((m.tick - start) / 60), team: e.team };
    }
    return { fell, active: m.mode.active, outcome: m.mode.outcome, attackers: m.mode.attackers, pool: m.mode.pool, clock: Math.round(m.mode.timeLeft) };
  });
  check(!!took.fell && took.fell.team === took.attackers && took.active === 1, `bots take the first sector on their own (${JSON.stringify(took)})`);
  if (took.active === 1) {
    await page.waitForFunction(() => document.querySelector('#mode-status .bt-strip')?.dataset.btSector === '1' && document.querySelectorAll('#mode-status .bt-obj').length === 3, null, { timeout: T(15000) }).catch(() => {});
    const next = await page.evaluate(() => {
      const m = window.__match;
      const z = (side) => m.combatants().filter((c) => m.mode.sideOf(c) === side).flatMap((c) => (m.mode.spawnSpots(c) ?? []).map((s) => s.pos.z));
      return {
        sector: document.querySelector('#mode-status .bt-strip')?.dataset.btSector,
        objectives: [...document.querySelectorAll('#mode-status .bt-obj')].map((o) => o.dataset.btObj).join(),
        need: [...document.querySelectorAll('#mode-status .ms')].map((x) => x.textContent).find((t) => /Targets:/.test(t)) ?? null,
        attack: [Math.min(...z('attack')), Math.max(...z('attack'))].map(Math.round),
        defend: [Math.min(...z('defend')), Math.max(...z('defend'))].map(Math.round),
      };
    });
    check(next.sector === '1' && next.objectives === 'B1,B2,B3' && /0 of 2 destroyed/.test(next.need ?? ''), `the guns' three targets switch on, two of three to destroy (${JSON.stringify(next)})`);
    // The guns' line runs at z -8: the attackers now spawn between the beach's line and it, the defenders beyond it.
    check(next.attack[0] > -52 && next.attack[1] < -8 && next.defend[0] > -8, `both sides' spawns move on to the guns' groups (attackers z ${next.attack}, defenders z ${next.defend})`);
    // A defender held behind the new line: warned at once, hurt after the 10 s warning.
    const fallback = await page.evaluate(() => {
      const m = window.__match;
      const d = m.combatants().find((c) => m.mode.sideOf(c) === 'defend' && c.alive && c.slot !== window.__cs.slot);
      // Its 10 s from now (one caught behind the line as the sector fell has already had some of them).
      m.mode.behind.delete(d.slot);
      // Far from the attackers' spawn and their way to the guns, so only the fall-back hurts it.
      const hold = () => (d.move = { pos: { x: 70, y: 0.2, z: -72 }, velY: 0, grounded: false });
      hold();
      m.step();
      const warned = (m.snapshot([]).md?.bf ?? []).some(([s]) => s === d.slot);
      const health = d.health;
      for (let i = 0; i < 60 * 9; i++) (hold(), m.step());
      const at9 = d.health;
      for (let i = 0; i < 60 * 2 && d.alive; i++) (hold(), m.step());
      return { warned, health, at9, at11: d.alive ? d.health : 0 };
    });
    check(fallback.warned && fallback.at9 >= fallback.health && fallback.at11 < fallback.at9, `a defender left behind the new line is warned, then hurt (${JSON.stringify(fallback)})`);
    // Your own warning: join the defenders (the HUD told of it as a roster change would), behind the line.
    await page.evaluate(() => {
      const m = window.__match;
      const me = m.slots[window.__cs.slot];
      me.faction = m.mode.defenders;
      window.__cs.hud.setRoster(m.roster());
      self.__btHold = setInterval(() => (me.move = { pos: { x: -60, y: 0.2, z: -66 }, velY: 0, grounded: false }), 50);
    });
    const warned = await page.waitForFunction(() => !document.getElementById('bt-warning')?.hidden && /Fall back behind the line/.test(document.getElementById('bt-warning')?.textContent ?? ''), null, { timeout: T(15000) }).then(() => true, () => false);
    const warning = await page.evaluate(() => ({ text: document.getElementById('bt-warning')?.textContent, side: document.querySelector('#mode-status .bt-strip')?.dataset.btSide }));
    check(warned && warning.side === 'defend', `left behind the line as a defender, you get the fall-back warning (${JSON.stringify(warning)})`);
    await shoot('breakthrough-fallback');
    await page.evaluate(() => clearInterval(self.__btHold));
  }
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

async function fortsFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  await page.goto(`${CLIENT}/?offline=fort_meadow&gamemode=core.forts&test=1&god=1`);
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() === 'playing' && window.__match && window.__cs.forts?.fo, null, { timeout: T(60000) });
  await page.waitForFunction(() => document.getElementById('mode-label')?.textContent === 'Fort Wars' && document.querySelectorAll('#fort-panel .fp-pieces span').length === 8, null, { timeout: T(10000) }).catch(() => {});
  const start = await page.evaluate(() => ({
    label: document.getElementById('mode-label')?.textContent,
    held: window.__cs.local.weapon?.id,
    barrier: window.__cs.forts.barrierUp,
    panel: document.querySelector('#fort-panel .fp-phase')?.textContent ?? '',
    picker: document.querySelectorAll('#fort-panel .fp-pieces span').length,
    flags: window.__cs.mode?.flagCount,
  }));
  check(start.label === 'Fort Wars', `the match runs Fort Wars (${start.label})`);
  check(start.held === 'core.builder' && start.barrier, `build phase: Builder in hand, barrier up (${JSON.stringify(start)})`);
  check(/Build phase/i.test(start.panel) && start.picker === 8 && start.flags === 2, `the panel shows the phase clock and the piece picker, flags are drawn (${JSON.stringify(start)})`);
  // Stand on open ground on our side, look down at the grass ahead, pick a metal wall (4) and click.
  await page.evaluate(() => {
    const m = window.__match;
    const me = m.slots[window.__cs.slot];
    const f = m.mode;
    const t = f.teamIndex(me.faction);
    const home = f.bases[t];
    const s = t === 0 ? 1 : -1;
    const pos = { x: home.x + 14, y: home.y + 0.5, z: home.z + f.midfield.dir.z * s * 8 };
    me.move = { pos, velY: 0, grounded: false };
    window.__cs.input.yaw = Math.atan2(f.midfield.dir.x * s, f.midfield.dir.z * s);
    window.__cs.input.pitch = -0.55;
    window.__cs.forts.pick(3);
    document.getElementById('pause').style.visibility = 'hidden';
  });
  await page.waitForFunction(() => window.__cs.forts.why === '' && window.__cs.view.scene.transformNodes.some((n) => n.name === 'fort_ghost' && n.isEnabled()), null, { timeout: T(10000) }).catch(() => {});
  const ghost = await page.evaluate(() => ({ why: window.__cs.forts.why, ghost: window.__cs.view.scene.transformNodes.some((n) => n.name === 'fort_ghost' && n.isEnabled()) }));
  check(ghost.ghost && ghost.why === '', `the ghost shows where the wall will go, and it can (${JSON.stringify(ghost)})`);
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/forts-build.png`, timeout: T(60000) }).catch(() => {});
  // One click can land before the ghost settles on a loaded runner: click again until the piece is built.
  for (let tries = 0; tries < 3; tries++) {
    await page.evaluate(() => (window.__autoInput = { once: 2 }));
    const built = await page.waitForFunction(() => window.__match.mode.pieces.some((p) => p.by === window.__cs.slot) && [...window.__cs.forts.pieces.values()].some((p) => p.kind === 'metal_wall'), null, { timeout: T(8000) }).then(() => true, () => false);
    if (built) break;
  }
  const placed = await page.evaluate(() => ({
    server: window.__match.mode.pieces.filter((p) => p.by === window.__cs.slot).map((p) => p.kind),
    client: [...window.__cs.forts.pieces.values()].length,
    drawn: window.__cs.view.scene.transformNodes.filter((n) => /^fort_\d+$/.test(n.name)).length,
  }));
  check(placed.server.includes('metal_wall') && placed.client >= 1 && placed.drawn === placed.client, `clicking builds the piece, and every client piece is drawn (${JSON.stringify(placed)})`);
  // Skip to the fight: the barrier drops and the Builder goes.
  await page.evaluate(() => {
    window.__autoInput = undefined;
    window.__match.mode.phaseEnd = window.__match.tick + 2;
  });
  await page.waitForFunction(() => !window.__cs.forts.barrierUp && window.__cs.local.weapon?.id !== 'core.builder' && /Combat/i.test(document.querySelector('#fort-panel .fp-phase')?.textContent ?? ''), null, { timeout: T(10000) }).catch(() => {});
  const combat = await page.evaluate(() => ({ barrier: window.__cs.forts.barrierUp, held: window.__cs.local.weapon?.id, panel: document.querySelector('#fort-panel .fp-phase')?.textContent ?? '', picker: document.querySelectorAll('#fort-panel .fp-pieces span').length }));
  check(!combat.barrier && combat.held !== 'core.builder' && /Combat/i.test(combat.panel) && combat.picker === 0, `combat: barrier down, Builder put away (${JSON.stringify(combat)})`);
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/forts-combat.png`, timeout: T(60000) }).catch(() => {});
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

/**
 * Gunplay pass 2 (docs/GUNPLAY_AUDIT.md): damage numbers (Options → HUD, off by default) float the hit's damage over
 * the bot and show nothing when off; auto-reload (on by default) starts an emptied pistol's reload without R; a
 * quick melee press breaks a reload. `target` is a held bot (holdBots) in front of you.
 */
async function gunplayReadoutChecks(page, target, { face, aimAt }) {
  const stand = (dist) => sim(page, (m, me, a) => {
    const bot = m.actor(a.slot);
    bot.move = { ...bot.move, pos: { x: me.move.pos.x + Math.sin(me.yaw) * a.dist, y: me.move.pos.y, z: me.move.pos.z + Math.cos(me.yaw) * a.dist }, velY: 0, grounded: true };
    bot.health = 100;
    bot.armor = 0;
    bot.speedMul = 0;
    return { at: bot.move.pos, tick: m.tick };
  }, { slot: target.slot, dist }).then(({ at, tick }) => seenAt(page, target.slot, at, T(15000), tick + 1));
  await page.evaluate(() => {
    window.__autoInput = { buttons: 0 };
    window.__give('core.pistol');
  });
  await meWait(page, (m, me) => me.weapons.get(me.current)?.def.id === 'core.pistol' && me.raiseTicks === 0 && me.fireCooldown === 0, null, 3);
  await face(4);
  await stand(4);
  await aimAt(target.slot);
  const shown = () => page.evaluate(() => window.__cs.damageNumbers.shown());
  // On: one shot, one number over the bot (the pistol's 24 at 4 m), on screen.
  await page.evaluate(() => localStorage.setItem('tiletrigger.damageNumbers', '1'));
  await page.evaluate(() => (window.__autoInput = { buttons: 0, once: 2 }));
  const hit = await meWait(page, (m, _me, t) => m.actor(t.slot).health < 100, target, 3);
  // Shown, and placed over the bot by a frame (hidden until then).
  await page.waitForFunction(() => [...document.querySelectorAll('#damage-numbers .dmg-num')].some((e) => e.style.visibility !== 'hidden'), null, { timeout: T(5000) }).catch(() => {});
  const nums = await shown();
  const placed = await page.evaluate(() => {
    const el = document.querySelector('#damage-numbers .dmg-num');
    const r = el?.getBoundingClientRect();
    return r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), hidden: el.style.visibility === 'hidden', onScreen: r.x > 0 && r.y > 0 && r.x < innerWidth && r.y < innerHeight } : null;
  });
  // (Character stats can soften a bot's hits: the number is what its health lost.)
  const lost = await sim(page, (m, _me, t) => String(Math.round(100 - m.actor(t.slot).health)), target);
  check(hit && nums.includes(lost) && !!placed && !placed.hidden && placed.onScreen && placed.w > 0, `damage numbers (on): the pistol's hit floats its damage over the bot (shown ${JSON.stringify(nums)}, health lost ${lost}, ${JSON.stringify(placed)})`);
  // Off (the default): the next hit shows nothing once the last number has gone.
  await page.evaluate(() => localStorage.setItem('tiletrigger.damageNumbers', '0'));
  await page.waitForFunction(() => window.__cs.damageNumbers.shown().length === 0, null, { timeout: T(5000) }).catch(() => {});
  await stand(4);
  await meWait(page, (m, me) => me.fireCooldown === 0, null, 2);
  await page.evaluate(() => (window.__autoInput = { buttons: 0, once: 2 }));
  const hit2 = await meWait(page, (m, _me, t) => m.actor(t.slot).health < 100, target, 3);
  await meWait(page, () => false, null, 0.3);
  const none = await shown();
  check(hit2 && none.length === 0, `damage numbers (off): a hit shows none (${JSON.stringify(none)})`);
  await page.evaluate(() => localStorage.removeItem('tiletrigger.damageNumbers'));
  // Auto-reload (on by default): the last round out, the reload starts without R.
  await sim(page, (m, me) => {
    const w = me.weapons.get(me.current);
    w.mag = 1;
    w.reserve = 24;
  });
  await page.waitForFunction(() => window.__cs.local.inventory.get(window.__cs.local.held)?.[0] === 1, null, { timeout: T(5000) }).catch(() => {});
  await page.evaluate(() => (window.__autoInput = { buttons: 0, once: 2 }));
  const started = await meWait(page, (m, me) => me.reloadTicks > 0, null, 2);
  const full = started && await meWait(page, (m, me) => me.weapons.get(me.current).mag === me.weapons.get(me.current).def.magazine, null, 3);
  check(started && full, `auto-reload: the pistol emptied, its reload starts by itself and fills the magazine (started ${started}, full ${full})`);
  // A quick melee press breaks a reload: R with rounds left, then Y (auto-reload off here: past "magazine out" it
  // would start the reload again once Y is let go).
  await page.evaluate(() => localStorage.setItem('tiletrigger.autoReload', '0'));
  await sim(page, (m, me) => (me.weapons.get(me.current).mag = 4));
  await page.evaluate(() => (window.__autoInput = { buttons: 0, once: 4 }));
  const reloading = await meWait(page, (m, me) => me.reloadTicks > 0, null, 2);
  await page.evaluate(() => (window.__autoInput = { buttons: 0, once: 2048 }));
  const broke = reloading && await meWait(page, (m, me) => me.reloadTicks === 0 && me.weapons.get(me.current).mag < me.weapons.get(me.current).def.magazine, null, 1);
  check(reloading && broke, `a quick melee press breaks a reload where it is (reloading ${reloading}, broken ${broke})`);
  await page.evaluate(() => {
    window.__autoInput = { buttons: 0 };
    localStorage.removeItem('tiletrigger.autoReload');
  });
}

async function arsenalFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  // Standard weapons (Rockfall Canyon's own default is Military): the mix-up and the drop below are Standard's.
  await page.goto(`${CLIENT}/?offline=canyon&weapons=standard&test=1&god=1`);
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() !== 'waiting' && window.__cs.phase() !== 'countdown' && window.__give, null, { timeout: T(60000) });
  // Where you spawned: open ground the melee checks below go back to.
  const home = await sim(page, (m, me) => ({ ...me.move.pos }));
  // The performance overlay (F3) measures frames while it shows; Pause → Settings copies a report of them.
  await page.keyboard.press('F3');
  await page.waitForFunction(() => /frame split/.test(document.getElementById('perf')?.textContent ?? '') && /\d+ draws/.test(document.getElementById('perf').textContent), null, { timeout: T(15000) }).catch(() => {});
  const overlay = await page.$eval('#perf', (e) => (e.hidden ? '' : e.textContent));
  check(/frame split/.test(overlay) && /\d+ draws/.test(overlay) && /shadow casters/.test(overlay), `F3 shows the performance overlay (${overlay.split('\n').slice(0, 4).join(' | ')})`);
  await page.evaluate(() => document.querySelector('#pause [data-tab="settings"]')?.click());
  await page.$eval('#perf-report', (b) => b.click());
  const report = await page.$eval('#perf-report-text', (e) => e.value);
  check(/performance report/.test(report) && /^Frames +\d+ over/m.test(report) && /^GPU /m.test(report), `the pause menu copies a performance report (${report.split('\n')[0]})`);
  await page.keyboard.press('F3');
  // Fire a spread of the new weapons (scripted input: headless browsers have no pointer lock).
  for (const id of ['core.flamethrower', 'core.oil_slicker', 'core.laser_rifle', 'core.railgun', 'core.bubble_blaster', 'core.swarm', 'core.disc_launcher', 'core.arc_caster', 'core.goo_gun', 'core.burst_rifle']) {
    await page.evaluate((w) => {
      window.__give(w);
      window.__cs.input.pitch = -0.25;
      window.__autoInput = { buttons: 2 };
    }, id);
    // Half a second of the match's time with the trigger held (a slow page sends its input slowly).
    await meWait(page, () => false, null, 0.5);
    // Fire, oil and goo leave hazards a while; note any that show up (slow machines draw them late).
    await page.evaluate(() => {
      window.__zonesSeen ??= new Set();
      for (const n of window.__cs.view.scene.transformNodes) if (n.name.startsWith('zone_')) window.__zonesSeen.add(n.name.slice(5));
    });
  }
  await page.evaluate(() => (window.__autoInput = { buttons: 0 }));
  await page.waitForFunction(() => window.__zonesSeen.size > 0 || window.__cs.view.scene.transformNodes.some((n) => n.name.startsWith('zone_')), null, { timeout: T(4000) }).catch(() => {});
  const zones = await page.evaluate(() => [...window.__zonesSeen, ...window.__cs.view.scene.transformNodes.filter((n) => n.name.startsWith('zone_')).map((n) => n.name.slice(5))]);
  check(zones.length > 0, `hazards are drawn on the ground (${[...new Set(zones)].join(', ')})`);
  // The bar follows the snapshots: wait for the weapons given to come in.
  await page.waitForFunction(() => /•/.test(document.getElementById('weapon-bar')?.textContent ?? ''), null, { timeout: T(10000) }).catch(() => {});
  const bar = await page.evaluate(() => document.getElementById('weapon-bar').textContent);
  const kit = /•/.test(bar ?? '') ? '' : await sim(page, (m, me) => `; the match: ${me.alive ? 'alive' : 'down'}, ${me.deaths} deaths, ${[...me.weapons.values()].map((w) => w.def.id).join(' ')}`);
  check(/•/.test(bar ?? ''), `the weapon bar shows several weapons in a slot (${bar}${kit})`);
  // The host's "Mix up weapon pickups" (pause menu → Host): a fixed weapon pickup turns into another weapon of
  // its category (its roll pool is the category's pickups, holding both), at once, and the client draws it.
  const fixed = await sim(page, (m) => m.pickups.filter((p) => p.item.effect.kind === 'weapon' && !p.entity.keepFixed).map((p) => [p.id, p.item.id]));
  // Their guns loaded first (drawing one again must not take the shared gun materials with it).
  await page.waitForFunction((ids) => ids.every(([id]) => window.__cs.view.scene.meshes.some((m) => m.name.startsWith(`pickup_${id}_gun`) && m.getTotalVertices() > 0)), fixed, { timeout: T(15000) }).catch(() => {});
  await page.evaluate(() => {
    document.getElementById('host-controls').open = true;
    document.querySelector('#hc-mix [data-value="on"]')?.click();
    // It applies live: Apply now, in the Host tab's foot.
    document.getElementById('hc-apply')?.click();
  });
  const mixed = await simWait(page, (m, _me, ids) => ids.every(([id, was]) => {
    const p = m.pickups.find((q) => q.id === id);
    return p.item.id !== was && p.pool?.includes(p.item) && p.pool.includes(p.placed);
  }), fixed, T(10000));
  const [firstId] = fixed[0] ?? [];
  // What it holds now, as the match has it each time asked: a bot taking it rolls it again (it comes back as
  // something new), so the client is waited on for the match's current roll, not the first one.
  const lies = () => sim(page, (m, _me, id) => m.pickups.find((p) => p.id === id).item.id, firstId);
  let now = firstId ? await lies() : null;
  const drawn = !!firstId && await until(async () => {
    now = await lies();
    return (await page.evaluate((id) => window.__cs.view.pickupItem(id), firstId)) === now;
  }, T(10000));
  check(fixed.length > 0 && mixed && drawn, `the host's mix-up swaps every fixed weapon pickup for another of its category, drawn by the client (${fixed.length} pickups; ${firstId}: ${fixed[0]?.[1]} → ${now})`);
  // A pickup drawn again as another gun leaves the shared gun materials alone: your own first-person gun keeps its textures.
  const fpTex = await page.evaluate(() => {
    const v = window.__cs.view;
    // Every gun drawn (pickups and the kept first-person guns): a disposed material is taken off every mesh that
    // used it (Babylon then draws them in its plain default material, white).
    const meshes = v.scene.meshes.filter((m) => /^(view_|pickup_.*_gun)/.test(m.name) && m.getTotalVertices() > 0);
    const bare = meshes.filter((m) => !m.material || m.material.getActiveTextures().some((t) => !t.getInternalTexture()));
    return { meshes: meshes.length, bare: bare.map((m) => m.name).slice(0, 4) };
  });
  check(fpTex.meshes > 0 && fpTex.bare.length === 0, `after the mix-up no gun (your first-person one included) has lost its materials (${JSON.stringify(fpTex)})`);
  // Quick melee with a gun in hand (side mouse button or Y): a punch lands on a bot right in front of you.
  // From here bots stand still and hold fire: the one placed in front stays there (no jumping), nobody else
  // hurts it (its health is what's checked), and its drop lies where it fell.
  await holdBots(page);
  // Back where you spawned, with nothing in the way: the spree above throws you about (a disc or a swarm at
  // your feet put you 7 m back, behind a wall the bot was then placed through), and bots throw sandbag walls.
  await sim(page, (m, me, at) => {
    me.move = { ...me.move, pos: { ...at }, velY: 0, vx: 0, vz: 0, grounded: true };
    for (const c of [...m.covers]) if (Math.hypot(c.pos.x - at.x, c.pos.z - at.z) < 8) m.removeCover(c);
    const zones = m.zones.filter((z) => Math.hypot(z.pos.x - at.x, z.pos.z - at.z) > 10);
    m.zones.splice(0, m.zones.length, ...zones);
  }, home);
  await page.waitForFunction((at) => { const p = window.__cs.local.state.pos; return Math.hypot(p.x - at.x, p.z - at.z) < 0.3; }, home, { timeout: T(10000) }).catch(() => {});
  // Face a way with open ground `dist` m out and nothing in between at a body's heights: the spawn has a tower
  // in front (the blunderbuss's pellets stopped on its base 3.5 m out, with the bot placed behind it).
  const face = async (dist) => {
    const yaw = await sim(page, (m, me, d) => {
      const p = me.move.pos;
      const eye = { x: p.x, y: p.y + 1.6 * me.size, z: p.z };
      const ray = (from, to) => {
        const v = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
        const len = Math.hypot(v.x, v.y, v.z);
        return m.physics.raycastHit(from, { x: v.x / len, y: v.y / len, z: v.z / len }, len) === null;
      };
      for (let i = 0; i < 16; i++) {
        const yaw = me.yaw + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * (Math.PI / 8);
        const at = { x: p.x + Math.sin(yaw) * d, z: p.z + Math.cos(yaw) * d };
        const clear = [0.3, 0.8, 1.3].every((h) => ray(eye, { x: at.x, y: p.y + h, z: at.z }) && ray({ x: p.x, y: p.y + h, z: p.z }, { x: at.x, y: p.y + h, z: at.z }));
        const ground = m.physics.raycastHit({ x: at.x, y: p.y + 1, z: at.z }, { x: 0, y: -1, z: 0 }, 2);
        if (clear && ground && Math.abs(p.y + 1 - ground.dist - p.y) < 0.3) return yaw;
      }
      return me.yaw;
    }, dist);
    await page.evaluate((y) => (window.__cs.input.yaw = y), yaw);
    await meWait(page, (m, me, y) => Math.abs(me.yaw - y) < 1e-3, yaw, 2);
  };
  await page.evaluate(() => {
    window.__give('core.pistol');
    window.__cs.input.pitch = -0.12;
  });
  await face(1.3);
  const target = await sim(page, (m, me) => {
    // An enemy (no friendly fire).
    const bot = m.combatants().find((c) => c !== me && c.alive && !c.mount && !c.npc && (!me.faction || c.faction !== me.faction));
    if (!bot) return null;
    bot.move = { ...bot.move, pos: { x: me.move.pos.x + Math.sin(me.yaw) * 1.3, y: me.move.pos.y, z: me.move.pos.z + Math.cos(me.yaw) * 1.3 }, velY: 0, grounded: true };
    bot.health = 100;
    bot.armor = 0;
    bot.speedMul = 0;
    return { slot: bot.slot, hp: bot.health, at: bot.move.pos, tick: m.tick };
  });
  // Struck only once this screen shows the bot in front (lag compensation: see seenAt).
  if (target) await seenAt(page, target.slot, target.at, T(15000), target.tick + 1);
  // Look at its middle: bots come in sizes, and a fixed glance down (-0.12) passed 4 cm over a small one's head
  // (0.78 × 1.8 m tall) 1.3 m away: the swing rightly missed.
  const aimAt = (slot) => sim(page, (m, me, s) => {
    const b = m.actor(s);
    const eye = me.move.pos.y + 1.6 * me.size;
    const middle = b.move.pos.y + 1.8 * b.size * 0.55;
    return Math.atan2(middle - eye, Math.hypot(b.move.pos.x - me.move.pos.x, b.move.pos.z - me.move.pos.z));
  }, slot).then((pitch) => page.evaluate((p) => (window.__cs.input.pitch = p), pitch));
  if (target) await aimAt(target.slot);
  await page.evaluate(() => (window.__autoInput = { buttons: 0, once: 2048 }));
  // Your fist comes in at once (first person); the server lands the punch (15 damage).
  await page.waitForFunction(() => window.__cs.view.strikes.punch > 0, null, { timeout: T(5000) }).catch(() => {});
  const swung = await page.evaluate(() => window.__cs.view.strikes.punch);
  const punched = target ? await meWait(page, (m, _me, t) => m.actor(t.slot).health <= t.hp - 10, target, 2) : false;
  await sim(page, (m, _me, t) => {
    const b = m.actor(t.slot);
    if (b) b.speedMul = 1;
  }, target);
  check(!!target && punched && swung > 0, `quick melee with a gun in hand punches the bot in front (${JSON.stringify(target)}, hit ${punched}, first-person punches: ${swung})`);
  if (target) await gunplayReadoutChecks(page, target, { face, aimAt });
  // The Battle Axe: the trigger swings it at the bot in front; the second trigger (right mouse) fires the
  // blunderbuss in its stock at the bot a few steps out (pellets, smoke, the HUD counting its loads); R loads it again.
  if (target) {
    await page.evaluate(() => {
      window.__autoInput = { buttons: 0 };
      window.__give('core.battle_axe');
      window.__cs.input.pitch = -0.12;
    });
    await page.waitForFunction(() => window.__cs.local.weapon?.id === 'core.battle_axe' && window.__cs.local.raiseTicks === 0, null, { timeout: T(8000) }).catch(() => {});
    await meWait(page, (m, me) => me.weapons.get(me.current)?.def.id === 'core.battle_axe' && me.raiseTicks === 0 && me.fireCooldown === 0, null, 2);
    const stand = (dist) => sim(page, (m, me, a) => {
      const bot = m.actor(a.slot);
      bot.move = { ...bot.move, pos: { x: me.move.pos.x + Math.sin(me.yaw) * a.dist, y: me.move.pos.y, z: me.move.pos.z + Math.cos(me.yaw) * a.dist }, velY: 0, grounded: true };
      bot.health = 100;
      bot.armor = 0;
      bot.speedMul = 0;
      return { at: bot.move.pos, tick: m.tick };
    }, { slot: target.slot, dist }).then(({ at, tick }) => seenAt(page, target.slot, at, T(15000), tick + 1));
    await face(1.6);
    await stand(1.6);
    await aimAt(target.slot);
    // The trigger held (one swing: it's semi-automatic) until the blow lands.
    await page.evaluate(() => (window.__autoInput = { buttons: 2 }));
    const chopped = await meWait(page, (m, _me, t) => m.actor(t.slot).health <= 100 - 80, target, 3);
    await page.evaluate(() => (window.__autoInput = { buttons: 0 }));
    check(chopped, 'the Battle Axe swings: the bot in front takes the blow');
    await page.waitForFunction(() => window.__cs.local.inventory.get(window.__cs.local.held)?.[2] === 2, null, { timeout: T(5000) }).catch(() => {});
    await face(5);
    await stand(5);
    await aimAt(target.slot);
    // The host rewinds targets to where the shooter saw them (lag compensation): let its history hold the bot at
    // 5 m for a while first, or on a slow runner the pellets go where the bot stood a moment ago (1.6 m away).
    await sim(page, (m) => m.tick).then((t0) => meWait(page, (m, _me, t) => m.tick >= t + 45, t0, 3));
    // After the swing's recovery (48 ticks): the barrel (bit 32, the alt trigger, as right mouse sends with a melee weapon in hand).
    await meWait(page, (m, me) => me.fireCooldown === 0, null, 2);
    const clouds = await page.evaluate(() => window.__cs.view.smokeClouds.local);
    // Held until it goes off (a slow page samples its input seldom), then let go.
    await page.evaluate(() => (window.__autoInput = { buttons: 32 }));
    await meWait(page, (m, me) => me.weapons.get(me.current)?.alt < 2, null, 2);
    await page.evaluate(() => (window.__autoInput = { buttons: 0 }));
    let blasted = await meWait(page, (m, _me, t) => m.actor(t.slot).health < 100, target, 1);
    if (!blasted) {
      // A spread can miss once at 5 m: the barrel holds two loads, so the second gets its chance.
      await meWait(page, (m, me) => me.fireCooldown === 0, null, 2);
      await page.evaluate(() => (window.__autoInput = { buttons: 32 }));
      await meWait(page, (m, me) => me.weapons.get(me.current)?.alt < 1, null, 2);
      await page.evaluate(() => (window.__autoInput = { buttons: 0 }));
      blasted = await meWait(page, (m, _me, t) => m.actor(t.slot).health < 100, target, 1);
    }
    await page.waitForFunction((n) => window.__cs.view.smokeClouds.local > n, clouds, { timeout: T(5000) }).catch(() => {});
    const after = await page.evaluate(() => ({ smoke: window.__cs.view.smokeClouds.local, loads: window.__cs.local.inventory.get(window.__cs.local.held)?.[2], hud: `${document.getElementById('ammo-count')?.textContent} ${document.getElementById('ammo-reserve')?.textContent} · ${document.getElementById('ammo-alt')?.textContent}` }));
    const hp = await sim(page, (m, _me, t) => m.actor(t.slot).health, target);
    check(blasted && after.smoke > clouds && after.loads < 2 && /RMB Blunderbuss/.test(after.hud), `the Battle Axe's blunderbuss shoots the bot 5 m out from its barrel, in a cloud of smoke (bot at ${hp} HP, loads left ${after.loads}, HUD "${after.hud}", smoke clouds ${after.smoke})`);
    // R loads the barrel again from its shells (slowly: about a second and a half for one).
    await page.evaluate(() => (window.__autoInput = { buttons: 4 }));
    await meWait(page, (m, me) => me.weapons.get(me.current)?.alt === 2, null, 4);
    await page.evaluate(() => (window.__autoInput = { buttons: 0 }));
    // (The HUD's copy comes with the next snapshots.)
    await page.waitForFunction(() => window.__cs.local.inventory.get(window.__cs.local.held)?.[2] === 2, null, { timeout: T(5000) }).catch(() => {});
    const ammo = await page.evaluate(() => window.__cs.local.inventory.get(window.__cs.local.held));
    check(ammo?.[0] === 0 && ammo[2] > after.loads && ammo[1] === 12 - (ammo[2] - after.loads), `R loads the barrel again from its shells (loads ${ammo?.[2]}, shells ${ammo?.[1]})`);
    await sim(page, (m, _me, t) => {
      const b = m.actor(t.slot);
      if (b) b.speedMul = 1;
    }, target);
  }
  // Drop weapon on death (on by default): the bot falls holding a rifle with ammo left; the rifle lies at the body
  // (drawn by the client), and walking onto it gives you the rifle with exactly that ammo.
  if (target) {
    const gun = await sim(page, (m) => (m.rules.startingWeapons.includes('core.rifle') ? 'core.sniper' : 'core.rifle'));
    await page.evaluate((id) => window.__give(id), gun);
    const handed = await simWait(page, (m, me, id) => [...me.weapons.values()].some((w) => w.def.id === id), gun, T(8000));
    // (Up again, if the blows above put it down.)
    await meWait(page, (m, _me, t) => m.actor(t.slot)?.alive, target, 10);
    const fell = handed && await sim(page, (m, me, a) => {
      const bot = m.actor(a.slot);
      const [code, w] = [...me.weapons].find(([, x]) => x.def.id === a.gun);
      // Into the bot's hands with odd ammo, out of yours (so the drop is new to you).
      bot.weapons.set(code, { ...w, mag: 7, reserve: 23, alt: 0 });
      bot.current = code;
      me.current = [...me.weapons].find(([c, x]) => c !== code && x.def.id === 'core.pistol')?.[0] ?? me.current;
      me.weapons.delete(code);
      bot.speedMul = 1;
      const at = { ...bot.move.pos };
      // (Bots fighting all along may have dropped guns already: this one is the newest.)
      const before = Math.max(0, ...m.drops.map((x) => x.id));
      m.kill(bot, me, a.gun);
      const d = m.drops.find((x) => x.id > before && x.def.id === a.gun);
      return d ? { id: d.id, at, pos: d.pos, mag: d.mag, reserve: d.reserve } : null;
    }, { slot: target.slot, gun });
    const near = !!fell && Math.hypot(fell.pos.x - fell.at.x, fell.pos.z - fell.at.z) < 0.5 && Math.abs(fell.pos.y - fell.at.y) < 2;
    const shown = !!fell && await page.waitForFunction((id) => window.__cs.view.dropsDrawn().some(([d]) => d === id) && window.__cs.view.scene.meshes.some((x) => x.name.startsWith(`drop_${id}_gun`) && x.getTotalVertices() > 0), fell.id, { timeout: T(10000) }).then(() => true, () => false);
    const seen = !fell || shown ? '' : await page.evaluate((id) => `; drawn drops ${JSON.stringify(window.__cs.view.dropsDrawn())}, meshes ${window.__cs.view.scene.meshes.filter((x) => x.name.startsWith(`drop_${id}`)).map((x) => `${x.name}:${x.getTotalVertices()}`).join(' ')}`, fell.id);
    check(near && shown && fell.mag === 7 && fell.reserve === 23, `the fallen bot's ${gun} drops at its body with its ammo, drawn on the ground (${JSON.stringify(fell)}, drawn ${shown}${seen})`);
    if (fell) {
      await sim(page, (m, me, d) => {
        me.move = { ...me.move, pos: { ...d.pos }, velY: 0 };
      }, fell);
      const took = await meWait(page, (m, me, a) => [...me.weapons.values()].some((w) => w.def.id === a.gun && w.mag === 7 && w.reserve === 23) && !m.drops.some((d) => d.id === a.id), { gun, id: fell.id }, 2);
      const gone = await page.waitForFunction((id) => !window.__cs.view.dropsDrawn().some(([d]) => d === id), fell.id, { timeout: T(8000) }).then(() => true, () => false);
      check(took && gone, `walking onto the drop gives you the ${gun} with exactly its ammo (7 + 23), and the drop goes (taken ${took}, gone on the client ${gone})`);
    }
  }
  // The Spear: held in first person as its model (the carved spear, guns/spear.glb; not the boxes it falls back
  // to), thrown at the ground a few metres out, drawn as that model in flight and stuck where it lands.
  await sim(page, (m, me, at) => {
    me.move = { ...me.move, pos: { ...at }, velY: 0, vx: 0, vz: 0, grounded: true };
  }, home);
  await page.evaluate(() => {
    window.__autoInput = { buttons: 0 };
    window.__give('core.spear');
    window.__cs.input.pitch = -0.35;
  });
  await face(6);
  await meWait(page, (m, me) => me.weapons.get(me.current)?.def.id === 'core.spear' && me.raiseTicks === 0 && me.fireCooldown === 0, null, 3);
  const spearHeld = await page.waitForFunction(() => window.__cs.view.scene.meshes.some((x) => x.name.startsWith('view_core.spear') && x.isEnabled() && x.getTotalVertices() > 1000), null, { timeout: T(20000) }).then(() => true, () => false);
  await page.evaluate(() => (window.__autoInput = { buttons: 2 }));
  const spearOut = await simWait(page, (m) => m.projectiles.some((p) => p.spec.visual === 'spear'), null, T(10000));
  await page.evaluate(() => (window.__autoInput = { buttons: 0 }));
  const spearStuck = spearOut && await simWait(page, (m) => m.projectiles.some((p) => p.spec.visual === 'spear' && p.stuck), null, T(10000));
  const spearDrawn = await page.waitForFunction(() => window.__cs.view.spearModelsDrawn() > 0, null, { timeout: T(20000) }).then(() => true, () => false);
  check(spearHeld && spearOut && spearStuck && spearDrawn, `the Spear is held as its model, and thrown it flies and sticks as that model (held ${spearHeld}, thrown ${spearOut}, stuck ${spearStuck}, drawn ${spearDrawn})`);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
  await thirdPersonShot(browser);
}

/**
 * Third-person shots go where the crosshair points (shared/sim/thirdPerson.ts): crouched behind a low wall in
 * third person with the crosshair on a head over it, the round reaches them; the same view in first person
 * (rounds along the view from the eye) hits the wall. The wall and the target are put in the match by hand on
 * open ground (the wall only in the match's world: it is the host's shot that's checked).
 */
async function thirdPersonShot(browser) {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  await page.goto(`${CLIENT}/?offline=canyon&gamemode=core.deathmatch&bots=2&test=1&god=1`);
  await page.waitForFunction(() => window.__cs?.local?.alive && window.__cs.phase() === 'playing' && window.__give, null, { timeout: T(120000) });
  // The one bot is the target: it stands where it's put and holds fire.
  await simWait(page, (m) => m.combatants().some((c) => c.kind === 'bot' && c.alive), null, T(30000));
  await holdBots(page);
  await page.evaluate(() => window.__give('core.pistol'));
  await meWait(page, (m, me) => me.weapons.get(me.current)?.def.id === 'core.pistol' && me.raiseTicks === 0, null, 3);
  // Open, level ground: from the map's spawn points in their order (whichever one the match spawned you on: it picks
  // at random among the safest few), the first direction with 22 m of it in front (eye-high sight line clear, ground
  // within 0.3 m of the spot all along); you are put on that spot.
  const setup = await sim(page, (m, me) => {
    const spots = m.map.entities.filter((e) => e.kind === 'spawn').map((e) => ({ x: e.position[0], y: e.position[1], z: e.position[2] }));
    for (const p of spots) {
      const ground = (x, z) => {
        const d = m.physics.raycastWorld({ x, y: p.y + 3, z }, { x: 0, y: -1, z: 0 }, 6);
        return d === null ? null : p.y + 3 - d;
      };
      const g0 = ground(p.x, p.z);
      if (g0 === null || Math.abs(g0 - p.y) > 0.3) continue;
      for (let k = 0; k < 16; k++) {
        const yaw = (k / 16) * Math.PI * 2;
        const at = (r) => ({ x: p.x + Math.sin(yaw) * r, z: p.z + Math.cos(yaw) * r });
        let ok = m.physics.lineOfSight({ x: p.x, y: p.y + 1, z: p.z }, { x: at(22).x, y: p.y + 1, z: at(22).z }) && m.physics.lineOfSight({ x: p.x, y: p.y + 2.2, z: p.z }, { x: at(22).x, y: p.y + 2.2, z: at(22).z });
        for (let r = 1; ok && r <= 22; r += 1) {
          const g = ground(at(r).x, at(r).z);
          ok = g !== null && Math.abs(g - p.y) < 0.3;
        }
        // Room behind for the camera (3 m back and up).
        const back = { x: p.x - Math.sin(yaw) * 3.5, z: p.z - Math.cos(yaw) * 3.5 };
        ok = ok && m.physics.lineOfSight({ x: p.x, y: p.y + 1.5, z: p.z }, { x: back.x, y: p.y + 1.9, z: back.z });
        if (!ok) continue;
        me.move = { ...me.move, pos: { x: p.x, y: g0, z: p.z }, velY: 0, grounded: true };
        // The wall: 1.45 m tall (well over a crouched eye's line at 15 m, under the third-person camera's), 15 m out,
        // 6 m wide, across the line; the target 20 m out.
        const w = at(15);
        // (Box axes turned by the yaw: its x runs across the line, its z along it.)
        m.physics.createBox({ x: w.x, y: g0 + 0.725, z: w.z }, { x: 3, y: 0.725, z: 0.2 }, yaw);
        const t = m.combatants().find((c) => c.kind === 'bot');
        return { yaw, slot: t.slot, target: { x: at(20).x, y: g0, z: at(20).z } };
      }
    }
    return null;
  });
  if (!setup) {
    check(false, 'third person: found open, level ground for the wall check');
    await page.context().close();
    return;
  }
  // Crouch (held), then into third person.
  await page.evaluate((yaw) => {
    window.__cs.input.yaw = yaw;
    window.__cs.input.pitch = 0;
    window.__autoInput = { buttons: 256 };
  }, setup.yaw);
  await meWait(page, (m, me) => me.move.stance === 1, null, 2);
  // The target, once it has spawned, stood 20 m out (and seen there: shots are lag compensated).
  await meWait(page, (m, _me, a) => m.combatants().find((c) => c.slot === a.slot)?.alive, setup, 5);
  const placedAt = await sim(page, (m, _me, a) => {
    const t = m.combatants().find((c) => c.slot === a.slot);
    t.move = { pos: { ...a.target }, velY: 0, grounded: true };
    return m.tick;
  }, setup);
  await seenAt(page, setup.slot, setup.target, T(10000), placedAt + 20);
  const shoot = async (third) => {
    for (let i = 0; i < 12 && (await page.evaluate(() => window.__cs.thirdPerson())) !== third; i++) {
      if (await page.isVisible('#resume')) await page.click('#resume').catch(() => {});
      await page.keyboard.press('KeyH');
      await sleep(500);
    }
    // The view that puts the third-person crosshair on their head (the camera moves with the view: settle it).
    const view = await sim(page, (m, me, a) => {
      const t = m.combatants().find((c) => c.slot === a.slot);
      t.health = t.maxHealth;
      const eye = { x: me.move.pos.x, y: me.move.pos.y + 1.02 * me.size, z: me.move.pos.z };
      const head = { x: t.move.pos.x, y: t.move.pos.y + 1.6 * t.size, z: t.move.pos.z };
      const look = (f, p) => ({ yaw: Math.atan2(p.x - f.x, p.z - f.z), pitch: Math.atan2(p.y - f.y, Math.hypot(p.x - f.x, p.z - f.z)) });
      const cam = (v) => {
        const cp = Math.cos(v.pitch);
        const fwd = { x: Math.sin(v.yaw) * cp, y: Math.sin(v.pitch), z: Math.cos(v.yaw) * cp };
        const o = { x: -fwd.x * 3 + Math.cos(v.yaw) * 0.6, y: -fwd.y * 3 + 0.35, z: -fwd.z * 3 - Math.sin(v.yaw) * 0.6 };
        const len = Math.hypot(o.x, o.y, o.z);
        const d = { x: o.x / len, y: o.y / len, z: o.z / len };
        const hit = m.physics.raycastWorld(eye, d, len);
        const k = hit === null ? len : Math.max(0.3, hit - 0.25);
        return { x: eye.x + d.x * k, y: eye.y + d.y * k, z: eye.z + d.z * k };
      };
      let v = look(eye, head);
      for (let i = 0; i < 20; i++) v = look(cam(v), head);
      return { ...v, overWall: m.physics.lineOfSight(cam(v), head) };
    }, setup);
    await page.evaluate((v) => {
      window.__cs.input.yaw = v.yaw;
      window.__cs.input.pitch = v.pitch;
    }, view);
    await meWait(page, (m, me, v) => Math.abs(me.yaw - v.yaw) < 1e-3 && Math.abs(me.pitch - v.pitch) < 1e-3 && me.fireCooldown === 0, view, 2);
    const mag0 = await sim(page, (m, me) => me.weapons.get(me.current).mag);
    await page.evaluate(() => (window.__autoInput = { buttons: 256, once: 2 }));
    await meWait(page, () => false, null, 0.6);
    const after = await sim(page, (m, me, slot) => {
      const t = m.combatants().find((c) => c.slot === slot);
      return { hurt: t.maxHealth - t.health, mag: me.weapons.get(me.current).mag, tp: !!me.thirdPerson, stance: me.move.stance ?? 0, tpos: t.move.pos };
    }, setup.slot);
    return { ...view, third, ...after, fired: mag0 - after.mag };
  };
  const tp = await shoot(true);
  const fp = await shoot(false);
  await page.evaluate(() => (window.__autoInput = { buttons: 0 }));
  check(tp.overWall && tp.hurt > 0, `third person, crouched behind a low wall with the crosshair on a head over it: the round reaches them (seen over the wall ${tp.overWall}, damage ${tp.hurt}; ${JSON.stringify(tp)})`);
  check(fp.hurt === 0, `the same view in first person (rounds along the view from the eye) hits the wall (damage ${fp.hurt}; ${JSON.stringify(fp)})`);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

async function zombiesFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  await page.goto(`${CLIENT}/?offline=sandgate&gamemode=core.zombies&test=1&god=1`);
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() !== 'waiting' && window.__cs.phase() !== 'countdown' && window.__match, null, { timeout: T(60000) });
  const squad = await page.evaluate(() => window.__match.combatants().map((c) => c.faction));
  check(squad.length === 4 && squad.every((f) => f === 'players'), `you and three bots hold out together (${squad.join(', ')})`);
  // Headless frame rates are slow: run the clock forward past the first break (keeping you alive).
  await page.evaluate(() => {
    for (let i = 0; i < 60 * 14; i++) {
      window.__match.step();
    }
  });
  const state = await page.evaluate(() => ({ wave: window.__match.zombies.wave, up: window.__match.actors().filter((a) => a.npc?.role === 'zombie' && a.alive).length }));
  check(state.wave === 1 && state.up > 0, `the first wave rises (wave ${state.wave}, ${state.up} up)`);
  await page.waitForFunction(() => /Zombies · wave 1/.test(document.body.textContent ?? ''), null, { timeout: T(8000) }).catch(() => {});
  const label = await page.evaluate(() => [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && /Zombies ·/.test(e.textContent ?? ''))?.textContent);
  check(/wave 1 · \d+ left/.test(label ?? ''), `the HUD counts the wave down (${label})`);
  // Zombies are drawn as shambling characters with nothing in their hands.
  await page.waitForFunction(() => window.__cs.view.characterCount() > 3, null, { timeout: T(15000) }).catch(() => {});
  const drawn = await page.evaluate(() => window.__cs.view.characterCount());
  check(drawn > 3, `zombies are drawn as characters (${drawn})`);
  // Most wear Quaternius' zombie body, walking, running and biting with its own clips.
  await page.waitForFunction(() => window.__cs.view.creatureCount('zombie') > 0, null, { timeout: T(15000) }).catch(() => {});
  const bodies = await page.evaluate(() => window.__cs.view.creatureCount('zombie'));
  check(bodies > 0, `zombies wear the zombie body (${bodies})`);
  // Co-op: the scoreboard is one list of the squad.
  await page.keyboard.down('Tab');
  await page.waitForFunction(() => document.querySelectorAll('#scoreboard .sb-row[data-slot]').length === 4, null, { timeout: T(5000) }).catch(() => {});
  const coop = await page.evaluate(() => ({ coop: document.getElementById('scoreboard').classList.contains('sb-coop'), lists: document.querySelectorAll('#scoreboard .sb-group').length, rows: document.querySelectorAll('#scoreboard .sb-row[data-slot]').length }));
  const meSeen = await scoreboardMeVisible(page);
  await page.keyboard.up('Tab');
  check(coop.coop && coop.lists === 1 && coop.rows === 4, `co-op shows the squad as one list (${JSON.stringify(coop)})`);
  check(meSeen.ok, `your row is visible on the scoreboard (${meSeen.why})`);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

/** Classes on Twin Spires CTF (class screen, picking a class, bots' classes) and Disc Arena on Grid Rings. */
async function classesFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  await page.goto(`${CLIENT}/?offline=twin_spires&gamemode=core.ctf&classes=1`);
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__match, null, { timeout: T(60000) });
  const menu = await page.evaluate(() => {
    const el = document.getElementById('class-menu');
    return el && !el.hidden ? el.querySelectorAll('button').length : 0;
  });
  check(menu === 9, `the class screen opens on joining, with nine classes (${menu})`);
  // Pick the Bulwark (5) with the keyboard: still at the spawn, so it swaps at once.
  await page.keyboard.press('Digit5');
  await page.waitForFunction(() => window.__match.slots[window.__cs.slot]?.cls?.id === 'bulwark', null, { timeout: T(10000) }).catch(() => {});
  const me = await page.evaluate(() => {
    const c = window.__match.slots[window.__cs.slot];
    return { cls: c.cls?.id, hp: c.maxHealth, menu: document.getElementById('class-menu')?.hidden };
  });
  check(me.cls === 'bulwark' && me.hp === 200 && me.menu, `picking a class swaps your loadout and closes the screen (${me.cls}, ${me.hp} HP)`);
  await page.waitForFunction(() => /BULWARK/.test(document.getElementById('powerups')?.textContent ?? ''), null, { timeout: T(8000) }).catch(() => {});
  check(await page.evaluate(() => /BULWARK/.test(document.getElementById('powerups')?.textContent ?? '')), 'the HUD names your class');
  const bots = await page.evaluate(() => window.__match.combatants().filter((c) => c.bot).map((c) => c.cls?.id));
  check(bots.length > 4 && bots.every(Boolean) && new Set(bots).size >= 4, `bots take a mix of classes (${bots.join(', ')})`);
  // Run the match on a while: a Mechanic bot builds its sentry, and the client draws it.
  await page.evaluate(() => {
    for (let i = 0; i < 60 * 20; i++) {
      window.__match.step();
      const c = window.__match.slots[window.__cs.slot];
      if (c) c.health = c.maxHealth;
    }
  });
  await page.waitForFunction(() => window.__cs.view.scene.transformNodes.some((n) => /^mount_1\d{4}$/.test(n.name)), null, { timeout: T(10000) }).catch(() => {});
  check(await page.evaluate(() => window.__cs.view.scene.transformNodes.some((n) => /^mount_1\d{4}$/.test(n.name))), 'a Mechanic bot builds a sentry and it is drawn');
  await page.keyboard.down('Tab');
  // CI's software renderer can take a moment to fill the board.
  await page.waitForFunction(() => /Bulwark/i.test(document.getElementById('scoreboard')?.textContent ?? ''), null, { timeout: T(3000) }).catch(() => {});
  const board = await page.evaluate(() => document.getElementById('scoreboard')?.textContent ?? '');
  await page.keyboard.up('Tab');
  check(/Bulwark/i.test(board), 'the scoreboard shows classes');
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();

  // Disc Arena: discs only, power discs drawn, bots knock each other into the void.
  const arena = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  const errs = [];
  arena.on('pageerror', (e) => errs.push(process.env.E2E_STACKS ? e.stack : e.message));
  await arena.goto(`${CLIENT}/?offline=grid_rings`);
  await arena.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__match, null, { timeout: T(60000) });
  const kit = await arena.evaluate(() => [...window.__match.slots[window.__cs.slot].weapons.values()].map((w) => w.def.id));
  check(kit.length === 1 && kit[0] === 'core.arena_disc', `Disc Arena: you hold arena discs only (${kit.join(', ')})`);
  const label = await arena.evaluate(() => document.getElementById('mode-label')?.textContent ?? '');
  check(/Disc Arena/.test(label), `the HUD says Disc Arena (${label})`);
  const kills = await arena.evaluate(() => {
    let n = 0;
    for (let i = 0; i < 60 * 60; i++) n += window.__match.step().filter((e) => e.e === 'kill' && e.killer !== null && e.weapon === 'core.arena_disc').length;
    return n;
  });
  check(kills > 0, `bots knock each other into the void (${kills} in a minute)`);
  await frames(arena, 5);
  check(errs.length === 0, `no page errors (${errs.join('; ')})`);
  await arena.context().close();
}

async function vehiclesFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  await page.goto(`${CLIENT}/?offline=canyon&test=1&god=1`);
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() !== 'waiting' && window.__cs.phase() !== 'countdown' && window.__match, null, { timeout: T(60000) });
  const mounts = await page.evaluate(() => window.__cs.view.scene.transformNodes.filter((n) => /^mount_[0-9]+$/.test(n.name)).length);
  check(mounts >= 9, `canyon's vehicles and turrets are drawn (${mounts})`);
  // Walk up to a free buggy, press E once, and drive. Bots like the vehicles by the bases too:
  // keep them out of them for this test, and pick a buggy nobody is in.
  await page.evaluate(() => {
    for (const c of window.__match.slots) if (c?.bot) c.bot.nextMountTick = Number.MAX_SAFE_INTEGER;
    const me = window.__match.slots[window.__cs.slot];
    const free = window.__match.mounts.filter((m) => m.def.id === 'buggy' && m.alive && m.seats.every((s) => s === null));
    const home = me.faction === 'tide' ? 60 : -60;
    const m = free.sort((a, b) => Math.abs(a.pos.z - home) - Math.abs(b.pos.z - home))[0];
    me.move = { pos: { x: m.pos.x, y: m.pos.y + 0.3, z: m.pos.z + (m.pos.z > 0 ? 3 : -3) }, velY: 0, grounded: false };
    window.__autoInput = { buttons: 0 };
  });
  await page.waitForFunction(() => /Drive/.test(document.getElementById('prompt').textContent ?? ''), null, { timeout: T(8000) }).catch(() => {});
  const prompt = await page.evaluate(() => document.getElementById('prompt').textContent);
  check(/Drive the Buggy/.test(prompt ?? ''), `the prompt offers the wheel (${prompt})`);
  // It reads on sand, snow and sky (owner, 2026-11-07: "kinda dark, black font?"): white words, a light green key on
  // a dark cap, each with a dark outline; the key's letter stands out from its cap (its ink was the dark of every other kbd).
  const look = await page.evaluate(() => {
    const el = document.getElementById('prompt');
    const kbd = el.querySelector('kbd');
    const rgb = (c) => (c.match(/[\d.]+/g) ?? []).map(Number);
    const lum = ([r, g, b]) => [r, g, b].map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
    const contrast = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
    const ps = getComputedStyle(el);
    const ks = kbd ? getComputedStyle(kbd) : null;
    return { text: rgb(ps.color), shadow: ps.textShadow, key: ks ? rgb(ks.color) : null, cap: ks ? rgb(ks.backgroundColor) : null, keyOnCap: ks ? contrast(rgb(ks.color), rgb(ks.backgroundColor)) : 0 };
  });
  const [kr, kg, kb] = look.key ?? [0, 0, 0];
  check(look.text.slice(0, 3).every((v) => v >= 240) && /rgba?\(0, 0, 0/.test(look.shadow) && kg >= 200 && kg > kr && kg > kb && look.keyOnCap >= 7, `the use prompt is white with a light green key on a dark cap, outlined (${JSON.stringify(look)})`);
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/vehicles-prompt.png`, timeout: T(60000) }).catch(() => {});
  // Press E (again, if a slow frame swallowed the press) until we're aboard.
  // A late press can still land after the wait: never press again once aboard (that gets you out).
  for (let i = 0; i < 4; i++) {
    if (await page.evaluate(() => !!window.__match.slots[window.__cs.slot].mount)) break;
    await page.evaluate(() => (window.__autoInput = { buttons: 0, once: 16 }));
    const aboard = await page.waitForFunction(() => !!window.__match.slots[window.__cs.slot].mount, null, { timeout: T(8000) }).then(() => true, () => false);
    if (aboard) break;
  }
  // The camera in the ride, in the vehicle's own frame (+Z forward), and where the seat's cockpit eye is.
  const rideCam = () =>
    page.evaluate(() => {
      const cs = window.__cs;
      const me = window.__match.slots[cs.slot];
      const m = me.mount ? cs.mounts.mounts.get(window.__match.mounts[me.mount.index].index) : null;
      const c = cs.view.camera.position;
      if (!m) return { view: cs.rideView(), cam: [c.x, c.y, c.z] };
      const d = { x: c.x - m.shown.pos.x, y: c.y - m.shown.pos.y, z: c.z - m.shown.pos.z };
      const s = Math.sin(m.shown.yaw);
      const k = Math.cos(m.shown.yaw);
      const local = [d.x * k - d.z * s, d.y, d.x * s + d.z * k];
      const seat = m.def.seats[me.mount.seat];
      const eye = m.def.cockpitEye ?? [seat.offset[0], seat.offset[1] + 1, seat.offset[2] + 0.15];
      const half = m.def.half;
      const inBox = Math.abs(local[0]) < half[0] && local[1] > 0 && local[1] < half[1] * 2 && Math.abs(local[2]) < half[2];
      const pivot = { x: m.shown.pos.x, y: m.shown.pos.y + half[1] * 2 + 0.5, z: m.shown.pos.z };
      const phys = cs.local.physics;
      const at = { x: c.x, y: c.y, z: c.z };
      return { view: cs.rideView(), local, eye, half, inBox, clear: phys.boxClear(at, { x: 0.12, y: 0.12, z: 0.12 }), sight: phys.lineOfSight(pivot, at), dist: Math.hypot(d.x, d.z) };
    });
  // First person is the default: the eye sits at the driver's seat, inside the vehicle's footprint.
  await page.waitForTimeout(T(600)); // wait-ok: the camera eases into the seat
  const cockpit = await rideCam();
  const off = cockpit.eye ? Math.hypot(...cockpit.local.map((v, i) => v - cockpit.eye[i])) : Infinity;
  check(cockpit.view === 'cockpit' && off < 0.5 && Math.abs(cockpit.local[0]) < cockpit.half[0] && Math.abs(cockpit.local[2]) < cockpit.half[2], `in the cockpit the eye is in the buggy at the driver's seat (${cockpit.view}, ${off.toFixed(2)} m from the seat eye, at ${cockpit.local?.map((v) => v.toFixed(2)).join(', ')})`);
  // The cockpit view draws the buggy's in-house cockpit (content/cockpits.ts: cage tubes, seats, dash, wheel) over
  // your copy of the body, the body's own triangles inside its hide boxes left out; the chase view (below) draws the
  // body alone.
  const interiorOn = await page.waitForFunction(() => window.__cs.view.cockpitInteriorShown() && window.__cs.view.cockpitInteriorState()?.cut, null, { timeout: T(20000) }).then(() => true, () => false);
  const bodyCut = await page.evaluate(() => {
    const me = window.__match.slots[window.__cs.slot];
    const root = window.__cs.view.scene.transformNodes.find((n) => n.name === `mount_${window.__match.mounts[me.mount.index].index}`);
    return root?.getChildMeshes().filter((m) => m.subMeshes?.length && !/^cockpit_/.test(m.name)).map((m) => m.subMeshes[0].indexCount / m.getTotalIndices()) ?? [];
  });
  const parts = await page.evaluate(() => window.__cs.view.cockpitInteriorState());
  check(interiorOn && bodyCut.some((share) => share < 0.9) && parts?.triangles > 5000, `in the cockpit the buggy's cockpit parts are drawn and its body's cockpit triangles are left out (${interiorOn}, ${parts?.triangles} triangles, body drawn ${bodyCut.map((v) => v.toFixed(2)).join(', ')})`);
  const start = await page.evaluate(() => ({ ...window.__match.slots[window.__cs.slot].move.pos }));
  await page.evaluate(() => (window.__autoInput = { forward: 1, buttons: 0 }));
  // Headless frame rates vary: wait for the drive rather than a fixed time.
  await page
    .waitForFunction((s) => { const p = window.__match.slots[window.__cs.slot].move.pos; return Math.hypot(p.x - s.x, p.z - s.z) > 8; }, start, { timeout: T(10000) })
    .catch(() => {});
  const after = await page.evaluate(() => {
    const me = window.__match.slots[window.__cs.slot];
    return { seat: me.mount?.seat, pos: me.move.pos, hud: document.getElementById('weapon-name')?.textContent, alive: me.alive };
  });
  check(after.seat === 0, `you are in the driver's seat (${after.seat}${after.alive ? '' : ', dead'})`);
  check(Math.hypot(after.pos.x - start.x, after.pos.z - start.z) > 8, `the buggy drives off (${Math.hypot(after.pos.x - start.x, after.pos.z - start.z).toFixed(1)} m)`);
  // Steering turns the cockpit's wheel and the speedometer's needle reads the speed.
  await page.evaluate(() => (window.__autoInput = { forward: 1, right: 1, buttons: 0 }));
  const turned = await page.waitForFunction(() => { const s = window.__cs.view.cockpitInteriorState(); return s && s.wheel > 0.3 && s.needles[0] > 0.1 ? s : null; }, null, { timeout: T(10000) }).then((h) => h.jsonValue(), () => page.evaluate(() => window.__cs.view.cockpitInteriorState()));
  await page.evaluate(() => (window.__autoInput = { forward: 1, buttons: 0 }));
  check(turned?.wheel > 0.3 && turned?.needles[0] > 0.1, `steering turns the cockpit's wheel and the speedometer reads the speed (${JSON.stringify(turned && { wheel: +turned.wheel.toFixed(2), needles: turned.needles.map((v) => +v.toFixed(2)) })})`);
  // Raycast suspension (sim/suspension.ts): the host sends the sprung body (ms) and the client draws it, the four
  // tires on pivots at the hubs, rolling with the speed.
  const sprung = await page.evaluate(() => {
    const me = window.__match.slots[window.__cs.slot];
    const m = me.mount ? window.__cs.mounts.mounts.get(window.__match.mounts[me.mount.index].index) : null;
    const root = m && window.__cs.view.scene.transformNodes.find((n) => n.name === `mount_${m.index}`);
    const pivots = root ? root.getChildTransformNodes().filter((n) => /_pivot\d$/.test(n.name)) : [];
    return { susp: !!m?.susp, wheels: m?.susp?.wheel.length ?? 0, pivots: pivots.length, tires: pivots.filter((p) => p.getChildren().length).length, rolled: pivots.some((p) => Math.abs(p.rotation.x) > 1e-3) };
  });
  check(sprung.susp && sprung.wheels === 4 && sprung.pivots === 4 && sprung.tires === 4 && sprung.rolled, `the buggy rides the sim's suspension, its tires on hub pivots rolling (${JSON.stringify(sprung)})`);
  // The drive and the turn leave the buggy anywhere (against a rock, on a slope): back to its spawn on open ground,
  // stopped, before the camera and seat checks below.
  await page.evaluate(() => (window.__autoInput = { buttons: 0 }));
  await page.evaluate(() => {
    const match = window.__match;
    const me = match.slots[window.__cs.slot];
    const m = me.mount ? match.mounts[me.mount.index] : null;
    if (!m) return;
    m.pos = { ...m.home.pos };
    m.yaw = m.home.yaw;
    if ('speed' in m) m.speed = 0;
  });
  await frames(page, 3);
  // H switches to the chase camera (remembered for ground vehicles): behind the buggy, outside it and clear of walls.
  await page.keyboard.press('KeyH');
  // The first chase frame can take a while in software rendering (the wider view brings new things to draw).
  await page.waitForFunction(() => window.__cs.rideView() === 'chase', null, { timeout: T(8000) }).catch(() => {});
  await page.waitForTimeout(T(800)); // wait-ok: the camera eases out to the chase view
  let worst = null;
  for (let i = 0; i < 5; i++) {
    const c = await rideCam();
    if (!worst || c.inBox || !c.clear || !c.sight || c.view !== 'chase') worst = c;
    await page.waitForTimeout(T(150)); // wait-ok: sampling interval
  }
  const saved = await page.evaluate(() => localStorage.getItem('tiletrigger.vehicleCamera'));
  check(worst.view === 'chase' && !worst.inBox && worst.clear && worst.sight && worst.dist > 1, `H gives a chase camera outside the buggy and not in a wall (${JSON.stringify({ view: worst.view, inBox: worst.inBox, clear: worst.clear, sight: worst.sight, dist: worst.dist?.toFixed(1) })})`);
  // The interior goes on the frame after the view switches (a slow page draws a frame or two a second).
  await page.waitForFunction(() => !window.__cs.view.cockpitInteriorShown(), null, { timeout: T(10000) }).catch(() => {});
  const chaseBody = await page.evaluate(() => {
    const me = window.__match.slots[window.__cs.slot];
    const root = window.__cs.view.scene.transformNodes.find((n) => n.name === `mount_${me.mount ? window.__match.mounts[me.mount.index].index : -1}`);
    return { interior: window.__cs.view.cockpitInteriorShown(), cut: root?.getChildMeshes().some((m) => m.subMeshes?.length && m.subMeshes[0].indexCount < m.getTotalIndices()) ?? null };
  });
  check(!chaseBody.interior && chaseBody.cut === false, `the chase view draws the whole body and no interior (${JSON.stringify(chaseBody)})`);
  check(/"ground":"chase"/.test(saved ?? ''), `the choice is remembered for ground vehicles (${saved})`);
  // The buggy we drove (the passenger checks below use the other one, still parked on flat ground at its spawn:
  // this one ends up wherever the drive and the steering check took it).
  await page.evaluate(() => (window.__drivenMount = window.__match.slots[window.__cs.slot].mount?.index ?? -1));
  // Press E (again, if a slow frame swallowed the press) until we're out.
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => (window.__autoInput = { buttons: 0, once: 16 }));
    const out = await page.waitForFunction(() => !window.__match.slots[window.__cs.slot].mount, null, { timeout: T(5000) }).then(() => true, () => false);
    if (out) break;
  }
  check(await page.evaluate(() => !window.__match.slots[window.__cs.slot].mount), 'E again gets you out');
  // Out of the chase camera: back at your own eye, level.
  await page.evaluate(() => (window.__autoInput = { buttons: 0 }));
  await page
    .waitForFunction(() => { const c = window.__cs.view.camera.position; const e = window.__cs.local.eye; return window.__cs.rideView() === null && Math.hypot(c.x - e.x, c.y - e.y, c.z - e.z) < 0.4; }, null, { timeout: T(5000) })
    .catch(() => {});
  const foot = await page.evaluate(() => {
    const cs = window.__cs;
    const c = cs.view.camera.position;
    const e = cs.local.eye;
    return { view: cs.rideView(), off: Math.hypot(c.x - e.x, c.y - e.y, c.z - e.z), roll: cs.view.camera.rotation.z };
  });
  // A blast nearby can still be shaking the view a little: level means within a fraction of a degree.
  check(foot.view === null && foot.off < 0.4 && Math.abs(foot.roll) < 0.01, `after getting out the camera is at your eye and level (${foot.view}, ${foot.off.toFixed(2)} m off, roll ${foot.roll})`);
  // A blast next to you while looking up shakes the view; once it settles, turning and looking around stay level
  // (Babylon kept the up vector from the shake's last frame, which rolled the view and gun with every turn).
  await page.evaluate(() => {
    window.__cs.input.pitch = 0.35;
    const me = window.__match.slots[window.__cs.slot];
    const at = { x: me.move.pos.x + 2, y: me.move.pos.y + 0.3, z: me.move.pos.z + 1 };
    window.__match.pendingEvents.push({ e: 'explode', s: -1, p: [at.x, at.y, at.z], r: 5 });
    window.__match.splash(at, 5, 20, 0.3, null, undefined, 1);
  });
  await page.waitForTimeout(1200); // wait-ok: the blast's shake plays out (what's checked is that it leaves no roll)
  let roll = 0;
  for (const [yaw, pitch] of [[1.2, 0], [0.8, 0.4], [1.5, -0.3]]) {
    await page.evaluate(([yaw, pitch]) => { window.__cs.input.yaw += yaw; window.__cs.input.pitch = pitch; }, [yaw, pitch]);
    await page.waitForTimeout(250); // wait-ok: the turn plays out
    roll = Math.max(roll, await page.evaluate(() => {
      // How far a node's right axis leaves the horizontal: its roll, in degrees.
      const deg = (n) => { n.computeWorldMatrix(true); const m = n.getWorldMatrix().m; return (Math.asin(Math.abs(m[1]) / Math.hypot(m[0], m[1], m[2])) * 180) / Math.PI; };
      return Math.max(deg(window.__cs.view.camera), deg(window.__cs.view.viewRoot));
    }));
  }
  await page.evaluate(() => (window.__cs.input.pitch = 0));
  check(roll < 1, `after leaving the buggy and a blast nearby, the view and gun stay level as you turn (${roll.toFixed(2)}° roll)`);
  // Passengers: three bots take the driver's and two passenger seats (E fills the next free seat), you take the last;
  // everyone sits, and you shoot your own gun out of the side without hitting the buggy. A fifth can't get in.
  const ride = await page.evaluate(() => {
    const match = window.__match;
    const me = match.slots[window.__cs.slot];
    // Out of any ride first (a slow frame can let a second E press land and climb back in above).
    if (me.mount) match.leaveMount(me, true);
    // Everyone holds still and holds fire (the buggy's health is checked below).
    for (const c of match.slots) if (c?.bot) { const think = c.bot.think.bind(c.bot); c.bot.think = (v) => ({ ...think(v), forward: 0, right: 0, buttons: 0 }); }
    // The buggy we drove, back at its spawn on flat ground and stopped (the drive and the steering check leave it
    // anywhere, on a slope or against a rock, where getting in from beside it can fail).
    const m = match.mounts[window.__drivenMount] ?? match.mounts.filter((x) => x.def.id === 'buggy' && x.alive && x.seats.every((s) => s === null))[0];
    m.pos = { ...m.home.pos };
    m.yaw = m.home.yaw;
    if ('speed' in m) m.speed = 0;
    // Bots drawn as characters (a creature has no seated pose).
    const bots = match.slots.filter((c) => c?.bot && c.alive && !c.mount && 'sit' in (window.__cs.view.avatars.get(c.slot)?.anim ?? {})).slice(0, 4);
    const seats = [];
    for (const b of bots.slice(0, 3)) {
      b.move = { pos: { x: m.pos.x, y: m.pos.y + 0.3, z: m.pos.z }, velY: 0, grounded: true };
      match.enterMount(b);
      seats.push(b.mount?.seat ?? -1);
    }
    me.move = { pos: { x: m.pos.x + 2.4, y: m.pos.y + 0.3, z: m.pos.z }, velY: 0, grounded: false };
    window.__autoInput = { buttons: 0 };
    return { index: m.index, seats, fifth: bots[3]?.slot, riders: bots.slice(0, 3).map((b) => b.slot) };
  });
  for (let i = 0; i < 4; i++) {
    if (await page.evaluate(() => !!window.__match.slots[window.__cs.slot].mount)) break;
    await page.evaluate(() => (window.__autoInput = { buttons: 0, once: 16 }));
    const aboard = await page.waitForFunction(() => !!window.__match.slots[window.__cs.slot].mount, null, { timeout: T(8000) }).then(() => true, () => false);
    if (aboard) break;
  }
  // Seated riders: the bots' characters ease into the seated pose.
  await page
    .waitForFunction((slots) => slots.every((s) => (window.__cs.view.avatars.get(s)?.anim?.sit ?? 0) > 0.95), ride.riders, { timeout: T(8000) })
    .catch(() => {});
  const seated = await page.evaluate((ride) => {
    const match = window.__match;
    const me = match.slots[window.__cs.slot];
    const m = match.mounts.find((x) => x.index === ride.index);
    const bot = match.slots[ride.fifth];
    bot.move = { pos: { x: m.pos.x, y: m.pos.y + 0.3, z: m.pos.z }, velY: 0, grounded: true };
    const fifth = match.enterMount(bot);
    // The bots' hips sit on their cushions, not standing up out of the buggy.
    const hips = ride.riders.map((s) => {
      const a = window.__cs.view.avatars.get(s);
      const thigh = a?.anim?.ch.joints.get('thigh_l');
      return thigh ? +(thigh.getAbsolutePosition().y - (m.pos.y + m.def.seats[match.slots[s].mount.seat].offset[1])).toFixed(2) : null;
    });
    return {
      mine: me.mount?.seat,
      role: me.mount ? m.def.seats[me.mount.seat].role : null,
      stance: me.move.stance,
      view: window.__cs.rideView(),
      sit: ride.riders.map((s) => +(window.__cs.view.avatars.get(s)?.anim?.sit ?? 0).toFixed(2)),
      hips,
      fifth,
      health: m.health,
    };
  }, ride);
  check(ride.seats.join() === '0,1,2' && seated.mine === 3 && seated.role === 'passenger' && seated.stance === 1 && seated.view === 'seat', `three riders and you fill the buggy's four seats in order, you in the back as a seated passenger (${JSON.stringify({ seats: ride.seats, mine: seated.mine, stance: seated.stance, view: seated.view })})`);
  check(seated.sit.every((v) => v > 0.95) && seated.hips.every((h) => h !== null && h > 0 && h < 0.3), `riders are drawn sitting on their seats (sit ${seated.sit.join(', ')}; hips ${seated.hips.join(', ')} m over the cushions)`);
  check(seated.fifth === false, 'a fifth player can\'t get into a full buggy');
  // Fire out of the right side, aiming down a little: your own gun, and the rounds leave through the buggy.
  const shot = await page.evaluate((index) => {
    const match = window.__match;
    const me = match.slots[window.__cs.slot];
    const m = match.mounts.find((x) => x.index === index);
    window.__cs.input.yaw = m.yaw + Math.PI / 2;
    window.__cs.input.pitch = -0.35;
    const held = me.weapons.get(me.current);
    window.__shotStart = { mag: held?.mag ?? 0, health: m.health, weapon: me.current };
    window.__autoInput = { buttons: 2 };
    return window.__shotStart;
  }, ride.index);
  await page.waitForFunction((s) => { const me = window.__match.slots[window.__cs.slot]; return (me.weapons.get(s.weapon)?.mag ?? s.mag) < s.mag; }, shot, { timeout: T(8000) }).catch(() => {});
  await page.evaluate(() => (window.__autoInput = { buttons: 0 }));
  const fired = await page.evaluate((index) => {
    const me = window.__match.slots[window.__cs.slot];
    const m = window.__match.mounts.find((x) => x.index === index);
    return { mag: me.weapons.get(window.__shotStart.weapon)?.mag, health: m.health, seat: me.mount?.seat };
  }, ride.index);
  check(fired.mag < shot.mag && fired.health === shot.health && fired.seat === 3, `a seated passenger fires their own gun out of the side and the rounds don't hit their own buggy (${JSON.stringify({ weapon: shot.weapon, mag: [shot.mag, fired.mag], health: [shot.health, fired.health] })})`);
  for (let i = 0; i < 4; i++) {
    if (await page.evaluate(() => !window.__match.slots[window.__cs.slot].mount)) break;
    await page.evaluate(() => (window.__autoInput = { buttons: 0, once: 16 }));
    await page.waitForFunction(() => !window.__match.slots[window.__cs.slot].mount, null, { timeout: T(5000) }).catch(() => {});
  }
  await page.evaluate(() => (window.__autoInput = { buttons: 0 }));
  // Blow the buggy up: it goes up in a vehicle explosion and leaves a charred wreck the client keeps solid.
  const boom = await page.evaluate(() => {
    const me = window.__match.slots[window.__cs.slot];
    const m = window.__match.mounts.filter((x) => x.def.id === 'buggy' && x.alive).sort((a, b) => Math.hypot(a.pos.x - me.move.pos.x, a.pos.z - me.move.pos.z) - Math.hypot(b.pos.x - me.move.pos.x, b.pos.z - me.move.pos.z))[0];
    // Down to a tenth of its health (the drive may already have dented it): into the burning band, not past it.
    window.__match.damageMount(m, m.health - m.def.health * 0.1, null, true);
    return m.index;
  });
  await page.waitForFunction((i) => window.__cs.mounts.mounts.get(i)?.burning, boom, { timeout: T(5000) }).catch(() => {});
  check(await page.evaluate((i) => window.__cs.mounts.mounts.get(i)?.burning === true, boom), 'a badly damaged buggy catches fire');
  await page.evaluate((i) => window.__match.damageMount(window.__match.mounts.find((x) => x.index === i), 10_000, null), boom);
  await page.waitForFunction((i) => window.__cs.mounts.mounts.get(i)?.wreck, boom, { timeout: T(5000) }).catch(() => {});
  const wreck = await page.evaluate((i) => {
    const m = window.__cs.mounts.mounts.get(i);
    return { wreck: m?.wreck, alive: m?.alive, solid: m?.body.isEnabled(), enter: !!window.__cs.mounts.enterable(m.pos) };
  }, boom);
  check(wreck.wreck && !wreck.alive && wreck.solid && !wreck.enter, `it blows up and leaves a solid wreck nobody can board (${JSON.stringify(wreck)})`);
  await frames(page, 5);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
  await arcTurretChecks(browser);
  await tankChecks(browser);
  await passengerChecks(browser);
}

/**
 * Passengers at speed (owner, 2026-11-08: "those seated don't move in lock step with the vehicle, their bodies drift
 * back ... also hearing their footsteps instead of an engine sound"). You drive a buggy with a bot beside you down the
 * canyon; every frame sampled at speed, the bot is drawn on its seat of the buggy as drawn (the model's own transform,
 * suspension included), no footstep plays near the buggy (and none of your own), and the engine runs.
 */
async function passengerChecks(browser) {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
  await ctx.addInitScript(installFrameClock);
  const page = await ctx.newPage();
  livePages.add(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  await page.goto(`${CLIENT}/?offline=canyon&test=1&god=1`);
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() !== 'waiting' && window.__cs.phase() !== 'countdown' && window.__match, null, { timeout: T(60000) });
  // Every sound asked for, with where (the AudioSystem plays nothing before a click, but the asks are what's checked).
  await page.evaluate(() => {
    const audio = window.__audio;
    const play = audio.play.bind(audio);
    window.__played = [];
    audio.play = (id, o = {}) => {
      window.__played.push({ id, at: o.at ? { x: o.at.x, y: o.at.y, z: o.at.z } : null });
      play(id, o);
    };
  });
  // You at the wheel of the south buggy at its spawn, facing up the canyon (open ground for 70 m); a bot (drawn as a
  // character) beside you.
  const ride = await page.evaluate(() => {
    const match = window.__match;
    const me = match.slots[window.__cs.slot];
    for (const c of match.slots) if (c?.bot) c.bot.nextMountTick = Number.MAX_SAFE_INTEGER;
    for (const c of match.slots) if (c?.bot) { const think = c.bot.think.bind(c.bot); c.bot.think = (v) => ({ ...think(v), forward: 0, right: 0, buttons: 0 }); }
    const m = match.mounts.filter((x) => x.def.id === 'buggy' && x.alive && x.home.pos.z < 0).sort((a, b) => a.home.pos.z - b.home.pos.z)[0];
    if (!m) return null;
    for (const c of match.slots) if (c?.mount && match.mounts[c.mount.index] === m) match.leaveMount(c, true);
    m.pos = { ...m.home.pos };
    m.yaw = 0;
    if ('speed' in m) m.speed = 0;
    me.move = { pos: { x: m.pos.x, y: m.pos.y + 0.3, z: m.pos.z }, velY: 0, grounded: true };
    match.enterMount(me);
    const bot = match.slots.find((c) => c?.bot && c.alive && !c.mount && 'sit' in (window.__cs.view.avatars.get(c.slot)?.anim ?? {}));
    if (!bot) return null;
    bot.move = { pos: { x: m.pos.x, y: m.pos.y + 0.3, z: m.pos.z }, velY: 0, grounded: true };
    match.enterMount(bot);
    window.__autoInput = { buttons: 0 };
    return { index: m.index, bot: bot.slot, mine: me.mount?.seat, theirs: bot.mount?.seat };
  });
  check(ride?.mine === 0 && ride?.theirs === 1, `you drive a buggy with a bot in the seat beside you (${JSON.stringify(ride)})`);
  if (ride) {
    // Seated and drawn sitting, then the chase camera (both of you in view) and the throttle down.
    await page.waitForFunction((r) => window.__cs.mounts.mounts.get(r.index)?.seats[1] === r.bot && (window.__cs.view.avatars.get(r.bot)?.anim?.sit ?? 0) > 0.95, ride, { timeout: T(10000) }).catch(() => {});
    await page.keyboard.press('KeyH');
    await page.waitForFunction(() => window.__cs.rideView() === 'chase', null, { timeout: T(8000) }).catch(() => {});
    // Off at full speed, on the page's frame clock from here: 60 frames a game second however slowly this machine
    // draws them (e2e/frameClock.mjs), so the passenger's own pose moves as it does for a player.
    await page.evaluate((r) => {
      window.__played.length = 0;
      const m = window.__match.mounts.find((x) => x.index === r.index);
      if ('speed' in m) m.speed = m.def.vehicle.maxSpeed;
      window.__autoInput = { forward: 1, buttons: 0 };
      window.__frameClock.freeze();
      window.__ride = { frames: 0, fast: 0, drawn: 0, worst: 0, worstY: 0, speed: 0, seated: true, me: { drawn: 0, sat: 0, worst: 0, worstY: 0 } };
    }, ride);
    // Frame by frame, while the buggy's drawn speed is over 10 m/s: how far the bot's drawn body is from its seat
    // point on the buggy's model as drawn that frame (the node's world matrix times the seat's offset).
    const steps = (n) =>
      page.evaluate(([r, n]) => {
        const cs = window.__cs;
        const node = cs.view.scene.transformNodes.find((x) => x.name === `mount_${r.index}`);
        const out = window.__ride;
        for (let i = 0; i < n; i++) {
          window.__frameClock.step(1000 / 60);
          out.frames++;
          const m = cs.mounts.mounts.get(r.index);
          const a = cs.view.avatars.get(r.bot);
          const speed = m ? Math.hypot(m.vel.x, m.vel.z) : 0;
          out.seated &&= m?.seats[1] === r.bot;
          if (!m || !a || !node || speed <= 10) continue;
          const w = node.getWorldMatrix().m;
          const [x, y, z] = m.def.seats[1].offset;
          const at = { x: x * w[0] + y * w[4] + z * w[8] + w[12], y: x * w[1] + y * w[5] + z * w[9] + w[13], z: x * w[2] + y * w[6] + z * w[10] + w[14] };
          const p = a.root.position;
          out.fast++;
          if (a.root.isEnabled() && !a.culled && a.anim) out.drawn++;
          out.worst = Math.max(out.worst, Math.hypot(p.x - at.x, p.z - at.z));
          out.worstY = Math.max(out.worstY, Math.abs(p.y - at.y));
          out.speed = Math.max(out.speed, speed);
          // Your own body (owner, 2026-11-08: the driver's seat looked empty in the chase view): drawn, sitting, on
          // the driver's seat point the same way.
          const own = cs.view.avatars.get(cs.slot);
          if (own?.root.isEnabled() && !own.hiddenSelf && own.anim) out.me.drawn++;
          if ((own?.anim?.sit ?? 0) > 0.95) out.me.sat++;
          if (own) {
            const [dx, dy, dz] = m.def.seats[0].offset;
            const seat = { x: dx * w[0] + dy * w[4] + dz * w[8] + w[12], y: dx * w[1] + dy * w[5] + dz * w[9] + w[13], z: dx * w[2] + dy * w[6] + dz * w[10] + w[14] };
            const q = own.root.position;
            out.me.worst = Math.max(out.me.worst, Math.hypot(q.x - seat.x, q.z - seat.z));
            out.me.worstY = Math.max(out.me.worstY, Math.abs(q.y - seat.y));
          }
        }
        return out;
      }, [ride, n]);
    let sample = await steps(10);
    for (let i = 0; i < 10 && sample.fast < 90 && sample.frames < 180; i++) sample = await steps(10);
    // The frame just drawn, off the canvas in the same task (a screenshot waits for frames a frozen page never asks for).
    if (process.env.E2E_SHOTS) {
      const png = await page.evaluate(() => {
        window.__frameClock.step(1000 / 60);
        const canvas = window.__cs.view.scene.getEngine().getRenderingCanvas();
        const out = document.createElement('canvas');
        [out.width, out.height] = [canvas.width, canvas.height];
        out.getContext('2d').drawImage(canvas, 0, 0);
        return out.toDataURL('image/png').split(',')[1];
      });
      writeFileSync(`${process.env.E2E_SHOTS}/vehicles-passenger-speed.png`, Buffer.from(png, 'base64'));
    }
    const heard = await page.evaluate((r) => {
      const m = window.__cs.mounts.mounts.get(r.index);
      // Footsteps from you (unpositioned) or from anyone at the buggy; the engine, yours unpositioned.
      const near = (at) => !at || (m && Math.hypot(at.x - m.shown.pos.x, at.z - m.shown.pos.z) < 6);
      return { steps: window.__played.filter((s) => s.id === 'footstep' && near(s.at)).length, engine: window.__played.filter((s) => s.id === 'vehicle.engine' && !s.at).length };
    }, ride);
    await page.evaluate(() => (window.__autoInput = { buttons: 0 }));
    const me = sample.me;
    check(me.drawn === sample.fast && me.sat === sample.fast && me.worst < 0.05 && me.worstY < 0.05, `in the chase view your own body is drawn sitting on the driver's seat every frame (${JSON.stringify({ fast: sample.fast, ...me, worst: +me.worst.toFixed(3), worstY: +me.worstY.toFixed(3) })})`);
    // The cockpit (first person from your own eyes): your body isn't drawn, as on foot in first person. Then out of
    // the buggy, on foot in first person: still not drawn.
    const ownShown = () => {
      const a = window.__cs.view.avatars.get(window.__cs.slot);
      return !!a && a.root.isEnabled() && !a.hiddenSelf;
    };
    // Frames on the page's clock until the view is `want` (null: on foot, out of every seat), at most `max`.
    const untilFrames = (want, max) =>
      page.evaluate(([want, max]) => {
        const cs = window.__cs;
        const ok = () => cs.rideView() === want && (want !== null || !cs.mounts.seatedRiders().has(cs.slot));
        for (let i = 0; i < max && !ok(); i++) window.__frameClock.step(1000 / 60);
        window.__frameClock.step(1000 / 60);
        return ok();
      }, [want, max]);
    await page.keyboard.press('KeyH');
    const cockpit = await untilFrames('cockpit', 60);
    const inCockpit = await page.evaluate(ownShown);
    if (process.env.E2E_SHOTS) {
      const png = await page.evaluate(() => {
        window.__frameClock.step(1000 / 60);
        const canvas = window.__cs.view.scene.getEngine().getRenderingCanvas();
        const out = document.createElement('canvas');
        [out.width, out.height] = [canvas.width, canvas.height];
        out.getContext('2d').drawImage(canvas, 0, 0);
        return out.toDataURL('image/png').split(',')[1];
      });
      writeFileSync(`${process.env.E2E_SHOTS}/vehicles-driver-cockpit.png`, Buffer.from(png, 'base64'));
    }
    await page.keyboard.press('KeyH');
    const chaseAgain = await untilFrames('chase', 60);
    const backInChase = await page.evaluate(ownShown);
    await page.evaluate(() => {
      const m = window.__match;
      m.leaveMount(m.slots[window.__cs.slot], true);
    });
    const out = await untilFrames(null, 120);
    const onFoot = await page.evaluate(ownShown);
    check(cockpit && !inCockpit && chaseAgain && backInChase && out && !onFoot && !(await page.evaluate(() => window.__cs.thirdPerson())), `your body is hidden in the cockpit view, drawn again in the chase view, and hidden on foot in first person after getting out (${JSON.stringify({ cockpit, inCockpit, chaseAgain, backInChase, out, onFoot })})`);
    check(sample.seated && sample.fast >= 60 && sample.drawn === sample.fast && sample.worst < 0.05 && sample.worstY < 0.05, `at speed the passenger is drawn on its seat every frame (${JSON.stringify({ ...sample, worst: +sample.worst.toFixed(3), worstY: +sample.worstY.toFixed(3), speed: +sample.speed.toFixed(1) })})`);
    check(heard.steps === 0 && heard.engine > 0, `riding plays no footsteps and the engine runs (${JSON.stringify(heard)})`);
  }
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

/**
 * The Tank (owner, 2026-11-07; content/vehicles/tank.json): alone at the wheel you fire its cannon (the empty cannon
 * seat's gun, driverFires), the HUD counts its shells (10 of 10, then 9), and nothing outside reaches you aboard (a
 * rocket's blast beside you leaves you whole; the tank takes it).
 */
async function tankChecks(browser) {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  livePages.add(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  await page.goto(`${CLIENT}/?offline=iron_tide&test=1`);
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() !== 'waiting' && window.__cs.phase() !== 'countdown', null, { timeout: T(60000) });
  await holdBots(page);
  // Bots stay out of vehicles; you stand beside the tank and press E.
  const at = await sim(page, (m, me) => {
    for (const c of m.combatants()) if (c.bot) c.bot.nextMountTick = Number.MAX_SAFE_INTEGER;
    const t = m.mounts.find((x) => x.def.id === 'tank');
    if (!t) return null;
    for (const c of m.combatants()) if (c.mount && c.mount.index === m.mounts.indexOf(t)) m.leaveMount(c, true);
    me.maxHealth = me.health = 100;
    me.move = { pos: { x: t.pos.x + Math.cos(t.yaw) * 2.4, y: t.pos.y + 0.3, z: t.pos.z - Math.sin(t.yaw) * 2.4 }, velY: 0, grounded: false };
    return { at: m.mounts.indexOf(t), index: t.index };
  }).catch(() => null);
  check(!!at, `iron_tide has a tank (${JSON.stringify(at)})`);
  if (at) {
    for (let i = 0; i < 4; i++) {
      if (await sim(page, (m, me) => !!me.mount).catch(() => false)) break;
      await page.evaluate(() => (window.__autoInput = { buttons: 0, once: 16 }));
      await simWait(page, (m, me) => !!me.mount, null, T(8000));
    }
    const seat = await sim(page, (m, me) => (me.mount ? m.mounts[me.mount.index].def.seats[me.mount.seat].role : null)).catch(() => null);
    check(seat === 'driver', `you get in at the wheel (${seat})`);
    const hud = () => page.evaluate(() => ({ name: document.getElementById('weapon-name')?.textContent, count: document.getElementById('ammo-count')?.textContent, reserve: document.getElementById('ammo-reserve')?.textContent }));
    const full = await page.waitForFunction(() => document.getElementById('weapon-name')?.textContent === 'Tank Cannon' && document.getElementById('ammo-count')?.textContent === '10', null, { timeout: T(10000) }).then(() => true, () => false);
    const h0 = await hud();
    check(full && h0.reserve === '10', `the HUD shows the cannon and its shells, 10 of 10 (${JSON.stringify(h0)})`);
    // Fire once (aim ahead and up): one shell gone, the HUD follows.
    await sim(page, (m, me) => (me.pitch = 0.2));
    await page.evaluate(() => (window.__autoInput = { buttons: 2, once: 6 }));
    const fired = await simWait(page, (m, me, a) => m.mounts[a].guns[1].shells === 9, at.at, T(10000));
    const nine = await page.waitForFunction(() => document.getElementById('ammo-count')?.textContent === '9', null, { timeout: T(10000) }).then(() => true, () => false);
    check(fired && nine, `a shot spends a shell, and the HUD counts 9 (${JSON.stringify(await hud())})`);
    if (process.env.E2E_SHOTS) {
      await page.addStyleTag({ content: '#pause, #message { display: none !important; }' });
      await page.screenshot({ path: `${process.env.E2E_SHOTS}/vehicles-tank-hud.png`, timeout: T(60000) }).catch(() => {});
    }
    // A rocket's blast beside you: the tank takes it, you don't.
    const blast = await sim(page, (m, me, a) => {
      const t = m.mounts[a];
      const before = { tank: t.health, me: me.health };
      m.splash({ x: me.move.pos.x + 1, y: me.move.pos.y + 1, z: me.move.pos.z }, 5, 120, 20, null, 'core.rockets', 1);
      return { tankLost: Math.round(before.tank - t.health), meLost: before.me - me.health, alive: me.alive };
    }, at.at).catch((e) => String(e));
    check(blast.tankLost > 0 && blast.meLost === 0 && blast.alive, `aboard, a blast beside you hurts the tank, not you (${JSON.stringify(blast)})`);
  }
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

/**
 * The Arc Turret (MOUNT_DEFS.sentry_arc): placed from MapMaker's Turrets & Sentries palette, offered in the
 * inspector's Type list; in TEST play it winds up on you first (charging, its charge orb drawn, no damage), then
 * locks its arc on (hits, drawn and sent as arc events), and walking out of its reach drops the lock.
 */
async function arcTurretChecks(browser) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  livePages.add(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  await page.goto(`${CLIENT}/?mode=editor&test=1`);
  await page.waitForFunction(() => window.__editor, null, { timeout: T(30000) });
  page.once('dialog', (d) => d.accept());
  await newMap(page, 96);
  await page.evaluate(() => window.__editor.view.focus({ x: -20, y: 0, z: 20 }));
  await clickTool(page, '[data-tool="mount:sentry_arc"]');
  const p = await page.evaluate(() => window.__editor.view.project({ x: -20, y: 0, z: 20 }));
  await page.mouse.move(p.x, p.y);
  await page.mouse.click(p.x, p.y);
  await page.keyboard.press('Escape');
  const turret = await page.evaluate(() => window.__editor.doc.entities.find((e) => e.kind === 'mount' && e.model === 'sentry_arc'));
  check(!!turret, `MapMaker's Turrets & Sentries palette places an Arc Turret (${JSON.stringify(turret?.position)})`);
  await page.evaluate((id) => window.__editor.setSelection({ tiles: [], entities: [id] }), turret?.id);
  const typed = await page.waitForFunction(() => [...document.querySelectorAll('#editor select')].some((s) => s.value === 'sentry_arc' && [...s.options].some((o) => o.value === 'sentry')), null, { timeout: T(10000) }).then(() => true, () => false);
  check(typed, 'the inspector shows it as an Arc Turret among the turret types');
  const issues = await page.textContent('#ed-issues');
  check(!/Arc Turret/.test(issues ?? ''), `no spawn warning for an Arc Turret placed away from the spawn (${(issues ?? '').slice(0, 160)})`);

  await page.keyboard.press('F5');
  await page.waitForFunction(() => window.__cs?.local && window.__testStartMs, null, { timeout: T(30000) });
  await holdBots(page);
  // Bots far off (out of its reach); you, tough, out of its reach too until the check starts.
  const at = turret.position;
  await sim(page, (m, me, a) => {
    for (const c of m.combatants()) if (c.bot) c.move = { pos: { x: a[0] + 45, y: 0.5, z: a[2] - 40 }, velY: 0, grounded: false };
    me.maxHealth = me.health = 5000;
    me.move = { pos: { x: a[0] + 40, y: 0.5, z: a[2] }, velY: 0, grounded: false };
  }, at);
  const arcState = () => page.evaluate(() => {
    const m = [...window.__cs.mounts.mounts.values()].find((x) => x.def.id === 'sentry_arc');
    return m ? { charging: !!m.charging, arcing: m.arcing, orb: window.__cs.view.chargeOrb(m.index) } : null;
  });
  await page.waitForFunction(() => [...window.__cs.mounts.mounts.values()].some((x) => x.def.id === 'sentry_arc' && x.alive && !x.charging && !x.arcing), null, { timeout: T(20000) }).catch(() => {});
  // Step in 11 m in front of it and count the arcs this page is sent.
  await page.evaluate(() => {
    window.__arcs = 0;
    const s = window.__cs;
    const draw = s.view.addArc.bind(s.view);
    s.view.addArc = (pts, color) => {
      if (color === '#8f7bff') window.__arcs++;
      draw(pts, color);
    };
  });
  const start = await sim(page, (m, me, a) => {
    me.move = { pos: { x: a[0] + 11, y: 0.5, z: a[2] }, velY: 0, grounded: false };
    return me.health;
  }, at);
  const charged = await page.waitForFunction(() => [...window.__cs.mounts.mounts.values()].some((x) => x.def.id === 'sentry_arc' && x.charging), null, { timeout: T(20000) }).then(() => true, () => false);
  const during = await sim(page, (m, me) => me.health);
  const orb = (await arcState())?.orb ?? 0;
  check(charged && during === start, `it winds up on you first: charging, no damage yet (${JSON.stringify({ charged, health: [start, during] })})`);
  check(orb > 0, `its charge orb is drawn while it winds up (${orb})`);
  const locked = await meWait(page, (m, me, s) => me.health < s, start, 4, T(60000));
  await page.waitForFunction(() => window.__arcs > 0, null, { timeout: T(10000) }).catch(() => {});
  const fired = { ...(await arcState()), arcs: await page.evaluate(() => window.__arcs), health: await sim(page, (m, me) => me.health) };
  check(locked && fired.arcs > 0, `then its arc locks on: you take hits, and the arc is drawn in its colour (${JSON.stringify(fired)})`);
  // Out of its reach: the lock drops.
  await sim(page, (m, me, a) => { me.move = { pos: { x: a[0] + 40, y: 0.5, z: a[2] }, velY: 0, grounded: false }; }, at);
  const dropped = await page.waitForFunction(() => [...window.__cs.mounts.mounts.values()].some((x) => x.def.id === 'sentry_arc' && !x.charging && !x.arcing), null, { timeout: T(15000) }).then(() => true, () => false);
  const after = await sim(page, (m, me) => me.health);
  await meWait(page, () => false, null, 1);
  const later = await sim(page, (m, me) => me.health);
  check(dropped && later === after, `walking out of its reach drops the lock: no more hits (${JSON.stringify({ dropped, health: [after, later] })})`);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  livePages.delete(page);
  await page.context().close();
}

/**
 * Tracks as map spice: drawing a track with MapMaker's Paths tool, and Team Deathmatch on Apex Ring with its NPC cars
 * lapping as traffic (Race mode was removed, owner 2026-11-08).
 */
async function trafficFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 820 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  // MapMaker: the Paths tool lays the track (a path used as a track, NPC traffic): three clicks, drag a point, undo, set its NPC cars, delete a point.
  await page.goto(`${CLIENT}/?mode=editor`);
  await page.waitForFunction(() => window.__editor, null, { timeout: T(30000) });
  page.once('dialog', (d) => d.accept());
  await newMap(page);
  await page.evaluate(() => window.__editor.view.focus({ x: 12, y: 0, z: -2 }));
  const doc = () => page.evaluate(() => window.__editor.doc);
  const raceOf = (d) => d.paths?.find((p) => p.uses.includes('race'));
  const at = (x, z) => page.evaluate(([x, z]) => window.__editor.view.project({ x, y: 0, z }), [x, z]);
  const clickWorld = async (x, z) => {
    const p = await at(x, z);
    await page.mouse.move(p.x, p.y);
    await page.mouse.click(p.x, p.y);
  };
  await clickTool(page, '[data-tool="path-race"]');
  // Let the new map settle (its first frame resets the view), then look at where the road goes.
  await frames(page, 3);
  await page.evaluate(() => window.__editor.view.focus({ x: 12, y: 0, z: -2 }));
  await clickWorld(8, -6);
  await clickWorld(16, -6);
  await clickWorld(13, 4);
  let d = await doc();
  let t = raceOf(d);
  check(t?.points.length === 3 && t.closed && t.uses.includes('road'), `three clicks lay a circuit (${t?.points.length ?? 0} points)`);
  const from = await at(16, -6);
  const to = await at(19, -8);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  t = raceOf(await doc());
  check(t && Math.hypot(t.points[1][0] - 19, t.points[1][2] + 8) < 1.5, `dragging a road point moves it (${t?.points[1]?.join(', ')})`);
  await page.keyboard.press('Control+KeyZ');
  t = raceOf(await doc());
  check(t && Math.hypot(t.points[1][0] - 16, t.points[1][2] + 6) < 1, 'undo puts it back');
  // The pane is rebuilt after the undo; if the edit hit the old input, set it again on the new one.
  // Race mode is gone: the track's pane offers its NPC cars (and their vehicle, curbs, start and pit lane), not laps,
  // a start grid, a race vehicle or combat.
  let cars;
  for (let tries = 0; tries < 3 && cars !== 5; tries++) {
    await page.fill('#ed-path-ambient', '5');
    await page.dispatchEvent('#ed-path-ambient', 'change');
    cars = await page.waitForFunction(() => window.__editor.doc.paths?.find((p) => p.uses.includes('race'))?.race?.ambient === 5, null, { timeout: T(2000) }).then(() => 5, async () => raceOf(await doc())?.race?.ambient);
  }
  check(cars === 5, `the Paths pane sets the track's NPC cars (${cars})`);
  // (The pane is rebuilt after the edit, now with the NPC car's vehicle.)
  await page.waitForSelector('#ed-path-ambient-vehicle', { state: 'attached', timeout: T(3000) }).catch(() => {});
  const pane = await page.evaluate(() => ({
    gone: ['ed-path-laps', 'ed-path-grid', 'ed-path-vehicle', 'ed-path-combat'].filter((id) => document.getElementById(id)),
    kept: ['ed-path-ambient', 'ed-path-ambient-vehicle', 'ed-path-pit', 'ed-path-curbs'].filter((id) => !document.getElementById(id)),
    race: /\brace\b/i.test(document.getElementById('ed-paths')?.textContent ?? ''),
  }));
  check(!pane.gone.length && !pane.kept.length && !pane.race, `the track pane says track / NPC traffic: no laps, grid, vehicle or combat, NPC cars and the pit lane kept (${JSON.stringify(pane)})`);
  await page.waitForFunction(() => window.__editor.view.scene.meshes.some((m) => m.name === 'edroad_surface' && m.getTotalVertices() > 0), null, { timeout: T(5000) }).catch(() => {});
  check(await page.evaluate(() => window.__editor.view.scene.meshes.some((m) => m.name === 'edroad_surface' && m.getTotalVertices() > 0)), 'MapMaker draws the road ribbon');
  const del = await at(13, 4);
  await page.mouse.move(del.x, del.y);
  await page.mouse.click(del.x, del.y, { button: 'right' });
  t = raceOf(await doc());
  check(t?.points.length === 2, `right-click deletes a road point (${t?.points.length})`);
  await page.keyboard.press('Escape');
  // Map properties: Race is no longer a mode. It isn't offered, and a map that still lists it can drop it (undo puts it back).
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__editor.run('Old modes', { kind: 'setMetadata', before: { supportedModes: window.__editor.doc.metadata.supportedModes }, after: { supportedModes: ['core.race', 'core.tdm'] } }));
  await page.waitForSelector('#ed-prop-drop-race', { state: 'attached', timeout: T(5000) });
  const raceOffered = await page.evaluate(() => !!document.querySelector('option[value="core.race"]'));
  await page.evaluate(() => document.getElementById('ed-prop-drop-race').click());
  const dropped = await page.evaluate(() => window.__editor.doc.metadata.supportedModes.join(','));
  check(!raceOffered && dropped === 'core.tdm', `Map properties doesn't offer Race and drops it from an old map's modes (offered ${raceOffered}, now ${dropped})`);
  await page.keyboard.press('Control+KeyZ');
  const undone = await page.evaluate(() => window.__editor.doc.metadata.supportedModes.join(','));
  check(undone === 'core.race,core.tdm', `undo brings Race back to the list (${undone})`);

  // Team Deathmatch on Apex Ring: its track's NPC cars lap as traffic while the teams fight (Race mode is gone).
  await page.goto(`${CLIENT}/?offline=apex_ring&gamemode=core.tdm&test=1`);
  // Polled on a timer: a loading page may draw no frames for a while.
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && ['countdown', 'playing'].includes(window.__match?.phase), null, { timeout: T(120000), polling: 250 });
  // Headless frame rates are slow: run the clock through the start countdown.
  await page.evaluate(() => {
    for (let i = 0; i < 60 * 10 && window.__match.phase !== 'playing'; i++) window.__match.step();
  });
  const start = await page.evaluate(() => {
    const m = window.__match;
    const me = m.slots[window.__cs.slot];
    const cars = m.mounts.filter((v) => v.ambient);
    return { mode: m.rules.mode, race: 'race' in m, onFoot: !me.mount, cars: cars.length, pos: cars.map((v) => ({ x: v.pos.x, z: v.pos.z })), factions: cars.filter((v) => v.faction !== null).length };
  });
  check(start.mode === 'core.tdm' && !start.race, `Team Deathmatch, no race (${start.mode})`);
  check(start.onFoot, 'you start on foot, not on a grid');
  check(start.cars >= 4 && start.factions === 0, `the track's NPC cars are out, belonging to nobody (${start.cars})`);
  const road = await page.evaluate(() => window.__cs.view.scene.meshes.filter((m) => /^road_/.test(m.name)).length);
  check(road > 5, `the road, curbs and arches are drawn (${road} meshes)`);
  // Headless frame rates are slow: run the clock 12 s.
  await page.evaluate(() => {
    for (let i = 0; i < 60 * 12; i++) window.__match.step();
  });
  const moved = await page.evaluate((before) => window.__match.mounts.filter((v) => v.ambient).map((v, i) => Math.round(Math.hypot(v.pos.x - before[i].x, v.pos.z - before[i].z))), start.pos);
  check(moved.filter((d) => d > 40).length >= moved.length - 1, `the NPC cars drive the track (moved ${moved.join(', ')} m)`);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

/**
 * The coverage map (maps/test_coverage.json: one of every tile, wall style, prop pack, pickup kind, vehicle and
 * turret, liquid, path, logic piece and mode marker, made in MapMaker): a match starts on it and runs 90 ticks with
 * every pickup and vehicle in the match, you stand on solid ground, nothing throws; it opens in MapMaker whole, as a
 * test map. Check branches run this instead of the browser map tour (nightly).
 */
async function coverageFlow(browser) {
  const { readFileSync } = await import('node:fs');
  const path = new URL(`../maps/${COVERAGE_MAP}.json`, import.meta.url);
  const file = JSON.parse(readFileSync(path, 'utf8'));
  const count = (kind) => file.entities.filter((e) => e.kind === kind).length;
  const page = await (await browser.newContext({ viewport: { width: 800, height: 450 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  await page.goto(`${CLIENT}/?offline=${COVERAGE_MAP}&test=1&god=1`);
  const ok = await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() !== 'waiting' && window.__cs.phase() !== 'countdown', null, { timeout: T(90000) }).then(() => true, () => false);
  check(ok, 'the coverage map starts a match');
  if (ok) {
    const t0 = await sim(page, (m) => m.tick).catch(() => 0);
    const ran = await simWait(page, (m, _me, t) => m.tick >= t, t0 + 90, T(30000));
    const floor = Math.min(-5, ...file.entities.filter((e) => e.kind === 'spawn').map((e) => e.position[1] - 2));
    const me = await page.evaluate(() => ({ alive: window.__cs.local.alive, y: window.__cs.local.state.pos.y }));
    check(ran && me.alive && me.y > floor, `90 ticks on it, and you stand on solid ground (y ${me.y.toFixed(1)}, floor ${floor.toFixed(1)})`);
    const got = await sim(page, (m) => ({ pickups: m.pickups.length, mounts: m.mounts.length, ziplines: m.ziplines.length }));
    // The match also runs the transport plane and the dropship as mounts.
    const want = { pickups: count('pickup'), mounts: count('mount') + count('airplane'), ziplines: count('zipline') };
    check(got.pickups >= want.pickups && got.mounts === want.mounts && got.ziplines === want.ziplines, `every pickup, vehicle, turret and zipline is in the match (${JSON.stringify(got)} of ${JSON.stringify(want)})`);
    // The Tank turns its own gun (content/guns.json `parts`, MountDef.turret): its model's turret and barrel are parts,
    // each with its own lower level of detail, and a manned cannon seat's aim turns the turret and pitches the barrel.
    // The match runs in a worker: the tank's place in it (`at`) and its entity index (its node's name) from there.
    const tank = await sim(page, (m) => { const at = m.mounts.findIndex((x) => x.def.id === 'tank'); return at < 0 ? null : { at, index: m.mounts[at].index }; }).catch(() => null);
    const parts = () =>
      page.evaluate((index) => {
        const root = window.__cs.view.scene.transformNodes.find((n) => n.name === `mount_${index}`);
        const turret = root && root.getChildTransformNodes(false, (n) => n.name.endsWith('_model_turret'))[0];
        if (!turret) return null;
        const barrel = turret.getChildTransformNodes(false, (n) => n.name.endsWith('_model_barrel'))[0];
        const lods = root.getChildMeshes(false).filter((m) => !m.isBlocked && m.getLODLevels?.().length).map((m) => m.name.replace(/^.*_model_/, ''));
        const e = (n) => n?.rotationQuaternion?.toEulerAngles() ?? { x: 0, y: 0 };
        return { barrel: !!barrel, lods: lods.sort(), yaw: e(turret).y, pitch: e(barrel).x };
      }, tank?.index);
    const tank0 = tank ? await page.waitForFunction((index) => window.__cs.view.scene.transformNodes.some((n) => n.name === `mount_${index}`) && window.__cs.view.scene.transformNodes.some((n) => n.name.startsWith(`mount_${index}_model_turret`)), tank.index, { timeout: T(30000) }).then(parts, () => null) : null;
    check(!!tank0?.barrel && ['barrel_body', 'hull', 'turret_body'].every((p) => tank0.lods.includes(p)), `the Tank's model has a turret and a barrel, each part with its own lower level of detail (${JSON.stringify(tank0)})`);
    if (tank0) {
      // A gunner in the cannon seat (the seat taken by a stand-in) aiming right and up: the turret and barrel follow.
      await sim(page, (m, me, at) => {
        const t = m.mounts[at];
        t.seats[1] = me.slot;
        self.__tankAim = setInterval(() => ((t.aimYaw = t.yaw + 0.5), (t.aimPitch = 0.3)), 20);
      }, tank.at);
      const aimed = await page.waitForFunction((index) => {
        const root = window.__cs.view.scene.transformNodes.find((n) => n.name === `mount_${index}`);
        const turret = root.getChildTransformNodes(false, (n) => n.name.endsWith('_model_turret'))[0];
        const barrel = turret.getChildTransformNodes(false, (n) => n.name.endsWith('_model_barrel'))[0];
        if (!(Math.abs(Math.abs(turret.rotationQuaternion.toEulerAngles().y) - 0.5) < 0.05 && Math.abs(Math.abs(barrel.rotationQuaternion.toEulerAngles().x) - 0.3) < 0.05)) return false;
        // The barrel's far end, in the vehicle's frame (+x its right, +y up, +z ahead): right of and above its root.
        const body = barrel.getChildMeshes(false).find((m) => !m.isBlocked);
        const V3 = window.__cs.view.camera.position.constructor;
        const toLocal = body.computeWorldMatrix(true).multiply(root.computeWorldMatrix(true).clone().invert());
        const pos = body.getVerticesData('position');
        let far = null;
        for (let i = 0; i < pos.length; i += 3) {
          const p = V3.TransformCoordinates(new V3(pos[i], pos[i + 1], pos[i + 2]), toLocal);
          if (!far || p.z > far.z) far = p;
        }
        const pivot = V3.TransformCoordinates(barrel.getAbsolutePosition(), root.getWorldMatrix().clone().invert());
        return far.x > pivot.x + 0.5 && far.y > pivot.y + 0.3;
      }, tank.index, { timeout: T(15000) }).then(() => true, () => false);
      const tank1 = await parts();
      await sim(page, (m, _me, at) => {
        clearInterval(self.__tankAim);
        m.mounts[at].seats[1] = null;
      }, tank.at);
      check(aimed, `a manned cannon seat's aim turns the Tank's turret and pitches its barrel (turret ${tank1?.yaw.toFixed(2)}, barrel ${tank1?.pitch.toFixed(2)} rad)`);
    }
  }
  check(errors.length === 0, `no page errors on the coverage map (${errors.join('; ')})`);
  await page.context().close();
  // MapMaker: it opens whole through Import, with no errors, as a test map.
  const ed = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const edErrors = [];
  ed.on('pageerror', (e) => edErrors.push(process.env.E2E_STACKS ? e.stack : e.message));
  ed.on('dialog', (d) => d.accept());
  await ed.goto(`${CLIENT}/?mode=editor&test=1`);
  await ed.waitForFunction(() => window.__editor, null, { timeout: T(30000) });
  await ed.setInputFiles('#ed-import-file', path.pathname);
  const opened = await ed.waitForFunction((want) => window.__editor.doc.metadata.id === want && Array.isArray(window.__editor.issues), file.metadata.id, { timeout: T(60000) }).then(() => true, () => false);
  const r = opened ? await ed.evaluate(() => ({ errors: window.__editor.issues.filter((i) => i.severity === 'error').map((i) => i.message), entities: window.__editor.doc.entities.length, tiles: window.__editor.doc.classicStructure.tiles.length, setPieces: window.__editor.doc.setPieces?.length ?? 0, testOnly: !!window.__editor.doc.metadata.testOnly })) : null;
  check(!!r && !r.errors.length && r.entities === file.entities.length && r.tiles === file.classicStructure.tiles.length && r.setPieces === (file.setPieces?.length ?? 0) && r.testOnly, `the coverage map opens in MapMaker whole (its set pieces kept as placements), marked as a test map (${JSON.stringify(r)})`);
  // Map properties show it as a test map.
  if (opened) await ed.evaluate(() => window.__editor.setSelection({ tiles: [], entities: [] }));
  const box = opened && (await ed.evaluate(() => document.getElementById('ed-prop-testonly')?.checked ?? null));
  check(box === true, `Map properties: "Test map" is ticked (${box})`);
  check(edErrors.length === 0, `no page errors in MapMaker (${edErrors.join('; ')})`);
  await ed.context().close();
}

/** Seconds each map of the browser tour took (played and opened in MapMaker), for timings' perMap. */
const mapSeconds = [];

/**
 * Every homage map (and any other map without a flow of its own) starts a match cleanly. The tour is long: CI runs
 * it in MAP_PARTS parts ('maps', 'maps2', ...), part i taking every MAP_PARTS-th map by name (flowMap.mapPartOf).
 * E2E_MAPS=id1,id2 checks those maps in 'maps' alone.
 */
async function mapsFlow(browser, part = 0) {
  const { readdirSync, readFileSync } = await import('node:fs');
  const only = process.env.E2E_MAPS?.split(',');
  const all = readdirSync(new URL('../maps/', import.meta.url)).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).filter((id) => !COVERED_MAPS.has(id)).sort();
  const ids = only ? (part ? [] : all.filter((id) => only.includes(id))) : all.filter((_, i) => i % MAP_PARTS === part);
  const t0 = Date.now();
  for (const id of ids) {
    const page = await (await browser.newContext({ viewport: { width: 800, height: 450 } })).newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
    // Test mode: a fixed seed, and the player takes no damage (bots can be in sight the moment the match starts);
    // falling out of the map still kills, which is what this checks.
    await page.goto(`${CLIENT}/?offline=${id}&test=1&god=1`);
    const ok = await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() !== 'waiting' && window.__cs.phase() !== 'countdown', null, { timeout: T(60000) }).then(() => true, () => false);
    // A second and a half of play (90 ticks): long enough to fall through a missing floor.
    if (ok) {
      const t0 = await sim(page, (m) => m.tick).catch(() => 0);
      await simWait(page, (m, _me, t) => m.tick >= t, t0 + 90, T(15000));
    }
    // Maps with basements (sewers, cisterns) spawn players below 0: below the lowest spawn is falling.
    const m = JSON.parse(readFileSync(new URL(`../maps/${id}.json`, import.meta.url), 'utf8'));
    const floor = Math.min(-5, ...m.entities.filter((e) => e.kind === 'spawn').map((e) => e.position[1] - 2));
    const alive = ok && (await page.evaluate((floor) => window.__cs.local.alive && window.__cs.local.state.pos.y > floor, floor));
    const where = ok ? await page.evaluate(() => window.__cs.local.state.pos.y.toFixed(1)) : 'no match';
    const why = !ok ? 'no match' : !alive ? `down or fell: y ${where}, floor ${floor.toFixed(1)}` : '';
    check(ok && alive && errors.length === 0, `${id}: match starts and you spawn on solid ground${why ? ` (${why})` : ''}${errors.length ? ` (${errors.join('; ')})` : ''}`);
    await page.context().close();
  }
  // Every map is made and edited in MapMaker: each opens there as it is, through MapMaker's own Import,
  // with no validation errors and nothing lost (the first part also takes the maps with flows of their own).
  const editable = [...ids, ...(part === 0 && !only ? [...COVERED_MAPS].sort() : [])];
  if (!editable.length) return;
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  page.on('dialog', (d) => d.accept());
  await page.goto(`${CLIENT}/?mode=editor&test=1`);
  await page.waitForFunction(() => window.__editor, null, { timeout: T(30000) });
  for (const id of editable) {
    errors.length = 0;
    const path = new URL(`../maps/${id}.json`, import.meta.url).pathname;
    const file = JSON.parse(readFileSync(path, 'utf8'));
    await page.setInputFiles('#ed-import-file', path);
    const opened = await page.waitForFunction((want) => window.__editor.doc.metadata.id === want && Array.isArray(window.__editor.issues), file.metadata.id, { timeout: T(30000) }).then(() => true, () => false);
    const r = opened ? await page.evaluate(() => ({ errors: window.__editor.issues.filter((i) => i.severity === 'error').map((i) => i.message), entities: window.__editor.doc.entities.length, tiles: window.__editor.doc.classicStructure.tiles.length })) : null;
    const whole = !!r && r.entities === file.entities.length && r.tiles === file.classicStructure.tiles.length;
    const why = !opened ? 'did not open' : [r.errors.length ? `errors: ${r.errors.slice(0, 3).join('; ')}` : '', whole ? '' : `${r.entities}/${file.entities.length} entities, ${r.tiles}/${file.classicStructure.tiles.length} tiles`, errors.length ? errors.join('; ') : ''].filter(Boolean).join(', ');
    check(opened && !r.errors.length && whole && !errors.length, `${id}: opens in MapMaker with no errors and nothing lost${why ? ` (${why})` : ''}`);
  }
  await page.context().close();
  if (ids.length) mapSeconds.push((Date.now() - t0) / 1000 / ids.length);
}

/** Draw `n` more frames (a page's own clock, whatever the machine's speed). */
/**
 * MapMaker overhaul Phase 3 part B (docs/MAPMAKER_OVERHAUL_PLAN.md, items 3-7): groups (Ctrl+G: a click picks the
 * whole group, Alt-click one; moved, flipped, duplicated as one; Ctrl+Shift+G), copy and paste between maps (Ctrl+C,
 * Ctrl+V at the pointer, new ids; another theme refused, saying why), templates (New map → Start from), Mirror…
 * (Shift+M: a mirrored copy swaps team things; half the map), and note pins (J: pin, edit, drag, list, delete; format
 * v31). Screenshots go to E2E_SHOTS when set.
 */
async function editorPartBChecks(browser) {
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 820 }, deviceScaleFactor: process.env.E2E_SHOTS ? 2 : 1 })).newPage();
  livePages.add(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const shot = (name) => (process.env.E2E_SHOTS ? page.screenshot({ path: `${process.env.E2E_SHOTS}/editorux-${name}.png` }).catch(() => {}) : Promise.resolve());
  await page.goto(`${CLIENT}/?mode=editor&test=1`);
  await page.waitForFunction(() => window.__editor, null, { timeout: T(60000) });
  page.on('dialog', (d) => d.accept());
  await newMap(page, 96);
  const doc = () => page.evaluate(() => window.__editor.doc);
  const sel = () => page.evaluate(() => window.__editor.selection);
  const toast = () => page.evaluate(() => document.getElementById('ed-toast').textContent);
  const at = (x, y, z) => page.evaluate(([x, y, z]) => window.__editor.view.project({ x, y, z }), [x, y, z]);
  /** The camera over the middle of the map, looking north and down at it. */
  const overview = async () => {
    await page.evaluate(() => {
      const v = window.__editor.view;
      v.camera.position.set(0, 40, -40);
      v.yaw = 0;
      v.pitch = -0.8;
      v.applyCamera();
    });
    await frames(page, 3);
  };
  const pointAt = async (x, y, z) => {
    const p = await at(x, y, z);
    await page.mouse.move(p.x, p.y);
    await frames(page, 3);
    return p;
  };
  await page.evaluate(() => window.__editor.view.focus({ x: 0, y: 0, z: 0 }));
  await frames(page, 3);
  check((await doc()).formatVersion >= 31, 'the map is format v31 or later');

  // ---- Groups: two pickups and the starter room, grouped with Ctrl+G.
  await page.evaluate(() => window.__editor.run('Pickups', { kind: 'addEntities', entities: [{ id: 'pick_a', kind: 'pickup', position: [-12, 0, 2], item: 'core.health_small', respawnSeconds: null }, { id: 'pick_b', kind: 'pickup', position: [-12, 0, -4], item: 'core.health_small', respawnSeconds: null }] }));
  const room = (await doc()).classicStructure.tiles[0].id;
  await page.evaluate((room) => {
    window.__editor.setTool({ kind: 'select' });
    window.__editor.setSelection({ tiles: [room], entities: ['pick_a', 'pick_b'] });
  }, room);
  await page.keyboard.press('Control+KeyG');
  await frames(page, 2);
  const g = (await doc()).groups;
  check(g?.length === 1 && g[0].members.length === 3, `Ctrl+G groups the selection (${JSON.stringify(g)})`);
  check(await page.isVisible('#ed-group-name'), "the inspector shows the group's name field and Ungroup");
  await page.fill('#ed-group-name', 'West base');
  await page.press('#ed-group-name', 'Enter');
  await frames(page, 2);
  check((await doc()).groups?.[0]?.name === 'West base', 'the group is renamed from the inspector');
  await shot('group');
  // A click on one pickup picks the whole group; Alt-click just that one.
  await page.evaluate(() => window.__editor.setSelection({ tiles: [], entities: [] }));
  const pa = await pointAt(-12, 0.5, 2);
  await page.mouse.click(pa.x, pa.y);
  await frames(page, 2);
  let s = await sel();
  check(s.tiles.length === 1 && s.entities.length === 2, `a click on a member selects the whole group (${JSON.stringify(s)})`);
  await page.evaluate(() => window.__editor.setSelection({ tiles: [], entities: [] }, true));
  await page.keyboard.down('Alt');
  await page.mouse.click(pa.x, pa.y);
  await page.keyboard.up('Alt');
  await frames(page, 2);
  s = await sel();
  check(s.tiles.length === 0 && s.entities.length === 1 && s.entities[0] === 'pick_a', `Alt-click picks one member (${JSON.stringify(s)})`);
  // Moved as one (→ a cell east), flipped as one (M), duplicated as one (Ctrl+D: a second group).
  await page.evaluate(() => window.__editor.setSelection({ tiles: [], entities: [] }));
  await page.mouse.click(pa.x, pa.y);
  await frames(page, 2);
  await page.keyboard.press('ArrowRight');
  await frames(page, 2);
  let d = await doc();
  check(d.classicStructure.tiles[0].x === 1 && d.entities.find((e) => e.id === 'pick_a').position[0] === -4 && d.entities.find((e) => e.id === 'pick_b').position[0] === -4, 'the arrow key moves the whole group a cell east');
  await page.keyboard.press('KeyM');
  await frames(page, 2);
  d = await doc();
  check(d.entities.find((e) => e.id === 'pick_a').position[0] === 12 && d.classicStructure.tiles[0].x === 0, `M flips the group east ↔ west about its own middle (${JSON.stringify(d.entities.find((e) => e.id === 'pick_a').position)})`);
  await page.keyboard.press('Control+KeyD');
  await frames(page, 2);
  d = await doc();
  check(d.groups?.length === 2 && d.groups[1].members.every((m) => !d.groups[0].members.includes(m)), 'Ctrl+D duplicates the group: the copies are a group of their own');
  await page.keyboard.press('Control+KeyZ');
  await page.keyboard.press('Control+KeyZ');
  await page.keyboard.press('Control+KeyZ');
  await frames(page, 2);
  d = await doc();
  check(d.groups?.length === 1 && d.classicStructure.tiles[0].x === 0 && d.entities.find((e) => e.id === 'pick_a').position[0] === -12, 'undo takes back the duplicate, the flip and the move, one step each');
  await page.evaluate(() => window.__editor.setSelection({ tiles: [], entities: ['pick_a'] }));
  await page.keyboard.press('Control+Shift+KeyG');
  await frames(page, 2);
  check(!(await doc()).groups, 'Ctrl+Shift+G ungroups');
  await page.keyboard.press('Control+KeyZ');
  await frames(page, 2);
  check((await doc()).groups?.length === 1, 'undo brings the group back');

  // ---- Copy and paste between maps: Ctrl+C the group, a new map, Ctrl+V at the pointer.
  await page.evaluate(() => window.__editor.setSelection({ tiles: [], entities: ['pick_b'] }));
  await page.keyboard.press('Control+KeyC');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('tiletrigger.editor.clipboard') ?? 'null'));
  check(stored?.format === 'tiletrigger.mapmaker.clipboard' && stored.tiles.length === 1 && stored.entities.length === 2 && stored.groups.length === 1, `Ctrl+C keeps the group in this browser's clipboard (${await toast()})`);
  const firstMap = (await doc()).metadata.id;
  await newMap(page, 96);
  await overview();
  await pointAt(16, 0, 8);
  await page.keyboard.press('Control+KeyV');
  await frames(page, 2);
  d = await doc();
  const pasted = await sel();
  const pastedTile = d.classicStructure.tiles.find((t) => t.id === pasted.tiles[0]);
  check(d.metadata.id !== firstMap && pasted.tiles.length === 1 && pasted.entities.length === 2 && pastedTile?.x === 2 && pastedTile?.y === 1, `Ctrl+V pastes into the other map with new ids, its anchor on the cell under the pointer (${JSON.stringify(pastedTile)}; ${await toast()})`);
  check(d.groups?.length === 1 && !pasted.entities.includes('pick_a'), 'the pasted things are still a group, with new ids');
  await shot('paste');
  await page.keyboard.press('Control+KeyZ');
  await frames(page, 2);
  check((await doc()).classicStructure.tiles.length === 1, 'one undo takes the paste back');
  // Into a map of another theme (owner, 2026-11-09: allowed): the pieces wear its theme, their own paint kept.
  await page.evaluate(() => window.__editor.run('Theme', { kind: 'setTheme', before: window.__editor.doc.classicStructure.theme, after: 'core.factory' }));
  await page.keyboard.press('Control+KeyV');
  await frames(page, 2);
  const themed = await doc();
  check(themed.classicStructure.theme === 'core.factory' && themed.classicStructure.tiles.length === 2 && /Pasted 3 things .*the pieces wear this map's .* theme, their own paint kept/.test(await toast()), `into a map of another theme it pastes, and says the pieces wear its theme (${await toast()})`);
  await shot('paste-theme');
  await page.keyboard.press('Control+KeyZ');
  await page.keyboard.press('Control+KeyZ');
  await frames(page, 2);
  check((await doc()).classicStructure.theme !== 'core.factory' && (await doc()).classicStructure.tiles.length === 1, 'two undos take the paste and the theme back');

  // ---- Mirror…: a red spawn and flag on the west, mirrored east (Shift+M): the copy is blue's.
  await page.evaluate(() => window.__editor.run('Team things', { kind: 'addEntities', entities: [{ id: 'sp_red', kind: 'spawn', position: [-28, 0, 4], yaw: 1.571, faction: 'embers' }, { id: 'flag_red', kind: 'flag', position: [-32, 0, 0], yaw: 0, team: 'embers' }] }));
  await page.evaluate(() => window.__editor.setSelection({ tiles: [], entities: ['sp_red', 'flag_red'] }));
  await page.keyboard.press('Shift+KeyM');
  await page.waitForSelector('#ed-mirror-dialog[open]', { timeout: T(5000) });
  await page.selectOption('#ed-mirror-across', 'eastWest');
  await page.fill('#ed-mirror-x', '0');
  await page.dispatchEvent('#ed-mirror-x', 'input');
  const why = await page.textContent('#ed-mirror-why');
  check(/Adds 2 mirrored things \(x = 0 m\); 2 swap team/.test(why), `the dialog says what it will do (${why})`);
  await shot('mirror-dialog');
  await page.click('#ed-mirror-go');
  await frames(page, 2);
  d = await doc();
  const blueFlag = d.entities.find((e) => e.kind === 'flag' && e.id !== 'flag_red');
  const blueSpawn = d.entities.find((e) => e.kind === 'spawn' && e.faction === 'tide');
  check(blueFlag?.team === 'tide' && blueFlag.position[0] === 32 && blueSpawn?.position[0] === 28 && Math.abs(blueSpawn.yaw + 1.571) < 0.01, `the mirrored copy is on the east, its spawn and flag the other team's (${JSON.stringify([blueFlag, blueSpawn])})`);
  await shot('mirror');
  await page.keyboard.press('Control+KeyZ');
  await frames(page, 2);
  check((await doc()).entities.filter((e) => e.kind === 'flag').length === 1, 'one undo takes the mirrored copy back');
  // Half the map: refused while the east half has things on it (the starter room straddles nothing: it's on the line).
  await page.evaluate(() => window.__editor.setSelection({ tiles: [], entities: [] }));
  await page.keyboard.press('Shift+KeyM');
  await page.waitForSelector('#ed-mirror-dialog[open]', { timeout: T(5000) });
  check(await page.isChecked('#ed-mirror-half-on'), 'with nothing selected the dialog offers half the map');
  await page.selectOption('#ed-mirror-half', 'west');
  const halfWhy = await page.textContent('#ed-mirror-why');
  check(/Adds \d+ mirrored things .*swap team.*on the line stay/.test(halfWhy) || /Can't: the east half/.test(halfWhy), `half the map: what it would do (${halfWhy})`);
  await page.click('#ed-mirror-cancel');

  // ---- Note pins: J, click the ground, write, pin; drag it; click it to edit; Map properties lists it; delete.
  await page.keyboard.press('KeyJ');
  await overview();
  const np = await pointAt(8, 0, -8);
  await page.mouse.click(np.x, np.y);
  const opened = await page.waitForSelector('#ed-note-editor', { timeout: T(5000) }).then(() => true, () => false);
  check(opened, `a click with the Note tool opens a new note's editor (${await page.evaluate(() => window.__editor.tool.kind)}; ${await toast()})`);
  await page.fill('#ed-note-text', 'Sniper line from B is too long');
  await shot('note-editor');
  await page.click('#ed-note-save');
  await frames(page, 3);
  d = await doc();
  check(d.editorNotes?.length === 1 && d.editorNotes[0].text === 'Sniper line from B is too long' && Math.abs(d.editorNotes[0].position[0] - 8) < 1, `a click with the Note tool pins a note there (${JSON.stringify(d.editorNotes)})`);
  const pin = await page.$('.ed-note-pin');
  check(!!pin && (await pin.isVisible()) && (await pin.textContent()).includes('Sniper line'), 'its pin shows over the view with its first line');
  const box = await pin.boundingBox();
  const to = await at(16, 0, -8);
  await page.mouse.move(box.x + 11, box.y + 22);
  await page.mouse.down();
  await page.mouse.move((box.x + to.x) / 2, (box.y + to.y) / 2, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await page.mouse.up();
  await frames(page, 3);
  d = await doc();
  check(Math.abs(d.editorNotes[0].position[0] - 16) < 1.5, `dragging the pin moves the note (${JSON.stringify(d.editorNotes[0].position)})`);
  await page.click('.ed-note-pin');
  await page.waitForSelector('#ed-note-editor', { timeout: T(5000) });
  await page.fill('#ed-note-text', 'Sniper line: add a wall');
  await page.click('#ed-note-save');
  await frames(page, 2);
  check((await doc()).editorNotes[0].text === 'Sniper line: add a wall', 'clicking the pin opens it to edit');
  await page.keyboard.press('KeyV');
  await page.evaluate(() => window.__editor.setSelection({ tiles: [], entities: [] }));
  await frames(page, 2);
  check((await page.textContent('#ed-notes-list')).includes('Notes (1)') && (await page.textContent('#ed-notes-list')).includes('Sniper line: add a wall'), 'Map properties lists the notes');
  await shot('notes');
  await page.click('#ed-notes-list .ed-notes-del');
  await frames(page, 2);
  check(!(await doc()).editorNotes && !(await page.$('.ed-note-pin')), 'the list deletes a note (and its pin)');
  await page.keyboard.press('Control+KeyZ');
  await frames(page, 2);
  check((await doc()).editorNotes?.length === 1, 'undo brings it back');

  // ---- Templates: New map → Start from → Symmetric CTF.
  await page.click('#ed-new');
  await page.waitForSelector('#ed-new-templates [data-template="ctf"]', { timeout: T(5000) });
  await page.click('#ed-new-templates [data-template="ctf"]');
  await shot('templates');
  await page.click('#ed-new-create');
  await page.waitForFunction(() => window.__editor.doc.entities.filter((e) => e.kind === 'flag').length === 2, null, { timeout: T(15000) }).catch(() => {});
  d = await doc();
  const flags = d.entities.filter((e) => e.kind === 'flag');
  check(flags.length === 2 && new Set(flags.map((f) => f.team)).size === 2 && d.metadata.name === 'Untitled Map' && d.metadata.id !== 'template_ctf', `Start from → Symmetric CTF makes a new map of its own from the layout (${d.metadata.id}, ${flags.length} flags)`);
  const issues = await page.evaluate(() => document.getElementById('ed-issues')?.textContent ?? '');
  await page.evaluate(() => window.__editor.view.focus({ x: 0, y: 0, z: 0 }));
  await frames(page, 4);
  await shot('template-ctf');
  check(!/error/i.test(issues), `the template validates clean (${issues.slice(0, 120)})`);

  // ---- Mirror half the map with its bot hints and, ticked, its terrain and paths (owner, 2026-11-09).
  await newMap(page, 96);
  await page.evaluate(() => {
    const ed = window.__editor;
    const t = structuredClone(ed.doc.terrain);
    // A mound on the west half (x -20, z 6) and stone paint round it.
    for (let r = 0; r < t.rows; r++) for (let c = 0; c < t.cols; c++) {
      const x = t.origin[0] + c * t.spacing;
      const z = t.origin[1] + r * t.spacing;
      const d = Math.hypot(x + 20, z - 6);
      if (d < 10) t.heights[r * t.cols + c] = Math.round(400 * (1 - d / 10));
    }
    ed.run('Mound', { kind: 'setTerrain', before: ed.doc.terrain, after: t });
    ed.run('Hint', { kind: 'setBotHints', before: ed.doc.botHints ?? null, after: [{ id: 'hint_stage', kind: 'staging', position: [-24, 0, -10], radius: 6, team: 'embers' }] });
    ed.run('Road', { kind: 'setPaths', before: ed.doc.paths ?? null, after: [{ id: 'road_w', points: [[-30, 0, -20], [-12, 0, 20]], closed: false, uses: ['road'], width: 3, style: 'dirt', lay: true }] });
    ed.setSelection({ tiles: [], entities: [] });
  });
  await page.keyboard.press('Shift+KeyM');
  await page.waitForSelector('#ed-mirror-dialog[open]', { timeout: T(5000) });
  await page.selectOption('#ed-mirror-across', 'eastWest');
  await page.fill('#ed-mirror-x', '0');
  await page.dispatchEvent('#ed-mirror-x', 'input');
  await page.selectOption('#ed-mirror-half', 'west');
  const plainWhy = await page.textContent('#ed-mirror-why');
  await page.check('#ed-mirror-ground');
  const groundWhy = await page.textContent('#ed-mirror-why');
  check(/1 bot hint/.test(plainWhy) && !/terrain/.test(plainWhy) && /1 bot hint, 1 path, the terrain/.test(groundWhy), `half the map brings its bot hint; ticked, its terrain and path too (${plainWhy} | ${groundWhy})`);
  await shot('mirror-ground-dialog');
  await page.click('#ed-mirror-go');
  await frames(page, 3);
  const mirrored = await page.evaluate(() => {
    const doc = window.__editor.doc;
    const t = doc.terrain;
    const h = (x, z) => t.heights[Math.round((z - t.origin[1]) / t.spacing) * t.cols + Math.round((x - t.origin[0]) / t.spacing)];
    return { west: h(-20, 6), east: h(20, 6), hint: doc.botHints?.find((x) => x.id !== 'hint_stage'), road: doc.paths?.find((x) => x.id !== 'road_w')?.points };
  });
  check(mirrored.west === 400 && mirrored.east === 400 && mirrored.hint?.team === 'tide' && mirrored.hint.position[0] === 24 && JSON.stringify(mirrored.road) === '[[30,0,-20],[12,0,20]]', `the east half is the west's mirror image: the mound, the staging spot (now the other team's) and the road (${JSON.stringify(mirrored)})`);
  await page.evaluate(() => window.__editor.view.focus({ x: 0, y: 0, z: 0 }));
  await frames(page, 4);
  await shot('mirror-ground');
  await page.keyboard.press('Control+KeyZ');
  await frames(page, 2);
  check(await page.evaluate(() => !window.__editor.doc.botHints?.some((x) => x.team === 'tide') && window.__editor.doc.paths?.length === 1), 'one undo takes the whole mirror back');
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  livePages.delete(page);
  await page.context().close();
}

function frames(page, n = 10) {
  return page.evaluate((n) => new Promise((done) => {
    let left = n;
    const tick = () => (--left <= 0 ? done() : requestAnimationFrame(tick));
    requestAnimationFrame(tick);
  }), n);
}

/**
 * Key scenes against committed pictures (e2e/baselines/), tolerant of software rendering's small differences:
 * a pixel differs when a channel is off by more than VISUAL_PIXEL_DELTA, and a scene fails when more than its
 * share of pixels differ. Regenerate after an intended change: `pnpm e2e:baselines` (then look at the pictures
 * and commit them). A failure leaves the new picture and a diff in e2e-artifacts/.
 */
const VISUAL_PIXEL_DELTA = 48;
// 1280 × 720: a common real window. Below 600 px tall the menus switch to their compact small-screen layout.
const VISUAL_SCENES = [
  // The main menu with its hero, as a first visit sees it.
  { name: 'menu', url: '/?test=1&name=Tester', ready: () => window.__front && document.fonts.status === 'loaded' && [...document.images].every((i) => i.complete) && !document.getElementById('menu').hidden && !document.getElementById('view').classList.contains('veiled'), share: 0.08 },
  // MapMaker's blank starter map.
  { name: 'mapmaker', url: '/?mode=editor&test=1&name=Tester', ready: () => window.__editor && !document.getElementById('editor').hidden && !document.getElementById('view').classList.contains('veiled'), share: 0.06 },
  // A map in play, alone (bots=1: just you), at the seeded spawn (hidden: the pause menu headless pages open, and HUD messages such as the slow-device hint).
  { name: 'arena', url: '/?offline=arena&test=1&god=1&bots=1&name=Tester', ready: () => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() === 'playing' && !document.getElementById('view').classList.contains('veiled'), css: '#pause, #message { display: none !important; }', share: 0.08 },
  // Outdoors: terrain, sky, foliage.
  // The procedural environment at eye height (the envlab's 'small' view: shrubs, boulders, grass, trees behind).
  { name: 'envlab', url: '/?envlab&test=1&view=small', ready: () => window.__envlab?.ready, share: 0.1 },
  // (Standard weapons, the pistol in hand, as the picture was taken: the map's own default is Military.)
  { name: 'canyon', url: '/?offline=canyon&weapons=standard&test=1&god=1&bots=1&name=Tester', ready: () => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() === 'playing' && !document.getElementById('view').classList.contains('veiled'), css: '#pause, #message { display: none !important; }', share: 0.1 },
];

/**
 * The procedural environment, Phase 1 (docs/PROCEDURAL_ENVIRONMENT_AUDIT.md §10): the environment lab draws every
 * species and variant on WebGL2 with no shader or material errors, its level of detail, wireframe, collider, wind and
 * tier toggles work; and the showcase map (maps/env_showcase.json, retired: never offered) plays with the environment
 * renderer (the default since Environment Phase 2: chunked thin instances) and without it (?env=0: each species a prop node).
 */
async function environmentFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && /shader|effect|compil|material|uniform|attribute/i.test(m.text()) && errors.push(m.text().slice(0, 200)));
  await page.goto(`${CLIENT}/?envlab&test=1&view=small`);
  const ready = await page.waitForFunction(() => window.__envlab?.ready, null, { timeout: T(120000) }).then(() => true, () => false);
  check(ready, 'the environment lab opens');
  if (!ready) return void (await page.context().close());
  const stats = () => page.evaluate(() => window.__envlab.stats().env);
  const s0 = await stats();
  check(s0.copies >= 90 && s0.drawnBatches > 0 && s0.perLevel[0] > 0, `it draws every species as thin-instance batches (${JSON.stringify(s0)})`);
  const species = await page.evaluate(() => [...new Set(window.__envlab.scene.meshes.filter((m) => /^env_[a-z]/.test(m.name) && !m.name.startsWith('env_tpl') && m.isEnabled() && m.thinInstanceCount > 0).map((m) => m.name.split('_l')[0]))].sort());
  // Every variant of every species in content/environment/ (the lab's lineup has them all).
  const envDir = new URL('../content/environment/', import.meta.url);
  const variants = readdirSync(envDir).filter((f) => f.endsWith('.json')).reduce((n, f) => n + JSON.parse(readFileSync(new URL(f, envDir), 'utf8')).species.reduce((k, s) => k + s.variants.length, 0), 0);
  check(species.length === variants, `every species and variant is drawn (${species.length} of ${variants}: ${species.join(', ')})`);
  // Level of detail forced: every copy at that level (or its species' last).
  for (const lod of [1, 2, 3]) {
    await page.evaluate((lod) => window.__envlab.set({ lod }), lod);
    const s = await stats();
    // Below the forced level only species whose lightest level that is (grass has one level, shrubs three).
    check(s.perLevel.slice(0, lod).every((n, i) => n === (s.lastLevel[i] ?? 0)) && s.perLevel.reduce((a, b) => a + (b ?? 0), 0) === s.copies, `level ${lod} forced: no copy nearer than it but species with fewer levels (${s.perLevel.join(' / ')}; lightest levels ${s.lastLevel.join(' / ')})`);
  }
  await page.evaluate(() => window.__envlab.set({ lod: null, wireframe: true, colliders: true, tier: 'low' }));
  const lines = await page.evaluate(() => window.__envlab.scene.getMeshByName('env_colliders')?.getTotalVertices() ?? 0);
  check(lines > 100, `the collider overlay draws the species' collision shapes (${lines} line vertices)`);
  await page.evaluate(() => window.__envlab.set({ wireframe: false, colliders: false, tier: 'high', wind: true }));
  await frames(page, 10);
  check(errors.length === 0, `no shader, material or page errors in the lab (${errors.join('; ')})`);
  // The showcase map in play, with the new renderer, then without it.
  for (const env of [true, false]) {
    await page.goto(`${CLIENT}/?offline=env_showcase&test=1&god=1&bots=1&name=Tester${env ? '' : '&env=0'}`);
    const playing = await page.waitForFunction(() => window.__cs?.phase?.() === 'playing', null, { timeout: T(180000) }).then(() => true, () => false);
    const drawn = playing
      ? await page.waitForFunction((env) => {
          const v = window.__cs.view;
          const s = v.environment?.stats();
          const nodes = v.scene.transformNodes.filter((n) => /^prop_/.test(n.name)).length;
          return env ? (s && s.copies > 2000 && s.drawnBatches > 0 ? { copies: s.copies, batches: s.drawnBatches, nodes } : null) : !v.environment && nodes > 2000 ? { nodes } : null;
        }, env, { timeout: T(120000) }).then((h) => h.jsonValue(), () => null)
      : null;
    check(!!drawn, `the showcase map plays ${env ? 'with the environment renderer (by default)' : 'with its species as props (?env=0)'} (${JSON.stringify(drawn)})`);
  }
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

/**
 * Fireteams (docs/FIRETEAMS_PLAN.md, Parts 1 and 2): the variant on in Match setup (its squad size beside the score) →
 * you lead a squad of bots (the HUD's order line) → hold B: the order wheel (a tap of B is still the quick-message menu)
 * → pick Hold here → a bot answers; the squad HUD shows a card per squadmate → Spread out from the wheel (the squad
 * keeps its order, the HUD says so) → the squad holds there while you go off. Screenshots:
 * e2e-artifacts/fireteams-wheel-desktop.png, fireteams-hud-desktop.png. (The phone's Orders button: packages/client/test/inputWheel.test.ts; a
 * second match on a phone here would cost another minute and a half of the shards' budget.)
 */
async function fireteamsFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  await page.addInitScript(() => localStorage.setItem('cs.arcade', JSON.stringify({ map: 'sandgate', mode: 'core.tdm', bots: 11, skill: 'easy', scoreLimit: 200, minutes: 20, fireteams: true })));
  await page.goto(`${CLIENT}/?test=1&god=1`);
  await page.click('#nav-play');
  await page.waitForSelector('#setup-variant-fireteams', { timeout: T(30000) });
  const setup = await page.evaluate(() => ({ on: document.getElementById('setup-variant-fireteams')?.getAttribute('aria-pressed'), size: document.querySelector('#arcade-squad-size .tab.on')?.textContent }));
  check(setup.on === 'true' && setup.size === '5', `Match setup: the Fireteams variant is on, squads of 5 by default (${JSON.stringify(setup)})`);
  await page.click('#arcade-start');
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() !== 'waiting' && window.__cs.phase() !== 'countdown', null, { timeout: T(90000) });
  // You lead a squad: the match says so, and the HUD shows its order.
  const led = await page.waitForFunction(() => window.__cs.squad().led !== null && document.querySelector('#squad-order b')?.textContent === 'Follow me', null, { timeout: T(15000) }).then(() => true, () => false);
  const squad = await sim(page, (m, me) => {
    const s = m.fireteams?.squadOf(me.slot);
    return s ? { leader: s.leader === me.slot, members: s.members.length, human: s.human, others: m.fireteams.squads.filter((q) => q !== s && q.team === s.team).map((q) => q.members.length) } : null;
  });
  check(led && squad?.leader && squad.human && squad.members === 5, `you lead a fireteam of 5 (HUD "Follow me"; ${JSON.stringify(squad)})`);
  check(!!squad && squad.others.length > 0 && squad.others.every((n) => n >= 2 && n <= 5), `bot-led squads fill the rest of your team (${JSON.stringify(squad?.others)})`);
  // Play: the pointer is captured on a real desktop; a headless page without pointer lock plays as touch does.
  await page.click('#resume').catch(() => {});
  await page.evaluate(() => document.pointerLockElement || window.__cs.input.setTouchEngaged(true));
  // A tap of B: the quick-message menu, as without Fireteams.
  await page.keyboard.press('KeyB');
  const menu = await page.waitForFunction(() => !document.getElementById('msg-menu')?.hidden && document.getElementById('order-wheel')?.hidden !== false, null, { timeout: T(5000) }).then(() => true, () => false);
  await page.keyboard.press('KeyB');
  await page.waitForFunction(() => document.getElementById('msg-menu')?.hidden !== false, null, { timeout: T(5000) }).catch(() => {});
  check(menu, 'a tap of B opens the quick-message menu, not the order wheel');
  // Hold B: the order wheel, seven orders (Part 2's Spread out / Stay tight last), your squad's current one ringed.
  const at = await sim(page, (m, me) => ({ x: me.move.pos.x, z: me.move.pos.z }));
  await page.keyboard.down('KeyB');
  const opened = await page.waitForFunction(() => !document.getElementById('order-wheel').hidden && document.querySelectorAll('#order-wheel .ww-item').length === 7, null, { timeout: T(5000) }).then(() => true, () => false);
  const items = await page.$$eval('#order-wheel .ww-item', (is) => is.map((i) => ({ name: i.querySelector('b').textContent, held: i.classList.contains('held'), dim: i.classList.contains('empty') })));
  check(opened && items.map((i) => i.name).join('|') === 'Follow me|Hold here|Go there|Attack that|Defend the objective|Regroup|Spread out', `holding B opens the order wheel (${items.map((i) => i.name).join(', ')})`);
  check(items[0]?.held && items[4]?.dim, `the wheel rings your squad's order (Follow me) and dims Defend the objective in Team Deathmatch (${JSON.stringify(items)})`);
  // (The wheel's items go clockwise from the top: item i of n at i / n of a turn.)
  const towards = (i) => [Math.sin((i / 7) * Math.PI * 2), -Math.cos((i / 7) * Math.PI * 2)];
  const box = await page.locator('#order-wheel .ww-item[data-code="2"]').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.evaluate(([x, y]) => window.__cs.input.aimWheel(x, y), towards(1));
  await page.waitForFunction(() => document.querySelector('#order-wheel .ww-item.on b')?.textContent === 'Hold here', null, { timeout: T(5000) }).catch(() => {});
  await page.screenshot({ path: `${ARTIFACTS}/fireteams-wheel-desktop.png` });
  // Let go of B on Hold here: the order goes, a bot answers, the HUD says Hold here.
  await page.keyboard.up('KeyB');
  const held = await simWait(page, (m, me) => m.fireteams?.squadOf(me.slot)?.order.kind === 'hold', null, T(10000));
  const ack = await page.waitForFunction(() => [...document.querySelectorAll('#feed .say, .say')].some((l) => /Holding here!/.test(l.textContent)) && document.querySelector('#squad-order b')?.textContent === 'Hold here', null, { timeout: T(10000) }).then(() => true, () => false);
  check(held, 'letting go of B on Hold here gives your squad the order (checked by the match)');
  check(ack, 'a squadmate answers "Holding here!" and the HUD shows Hold here');
  // The squad HUD (Part 2): a card for each squadmate (portrait, name, health), the order's place on the minimap.
  const cards = await page.waitForFunction(() => {
    const hud = window.__cs.squad().hud;
    const list = [...document.querySelectorAll('#squad-hud .sq-mate')];
    return hud && hud.place && list.length === hud.members.length - 1 && list.every((c) => c.querySelector('.sq-name')?.textContent && c.querySelector('.sq-hp i')) ? list.map((c) => ({ name: c.querySelector('.sq-name').textContent, hp: c.querySelector('.sq-hp i').style.width, down: c.classList.contains('down') })) : null;
  }, null, { timeout: T(10000) }).then((h) => h.jsonValue(), () => null);
  check(!!cards && cards.length === 4 && cards.every((c) => c.down || parseInt(c.hp, 10) > 0), `the squad HUD shows your 4 squadmates' cards with their health (${JSON.stringify(cards)})`);
  await page.screenshot({ path: `${ARTIFACTS}/fireteams-hud-desktop.png` });
  // Spread out (Part 2): the wheel's last entry; the squad keeps its order, spreads its ring, and the HUD says so.
  await page.keyboard.down('KeyB');
  await page.waitForFunction(() => !document.getElementById('order-wheel').hidden, null, { timeout: T(5000) }).catch(() => {});
  await page.evaluate(([x, y]) => window.__cs.input.aimWheel(x, y), towards(6));
  await page.waitForFunction(() => document.querySelector('#order-wheel .ww-item.on b')?.textContent === 'Spread out', null, { timeout: T(5000) }).catch(() => {});
  await page.keyboard.up('KeyB');
  const spread = await simWait(page, (m, me) => m.fireteams?.squadOf(me.slot)?.spacing === 'spread' && m.fireteams.squadOf(me.slot).order.kind === 'hold', null, T(10000));
  const spreadHud = await page.waitForFunction(() => document.querySelector('#squad-order i')?.textContent === 'Spread out' && [...document.querySelectorAll('#feed .say, .say')].some((l) => /Spreading out!/.test(l.textContent)), null, { timeout: T(10000) }).then(() => true, () => false);
  check(spread && spreadHud, 'Spread out from the wheel: the squad spreads (keeping Hold here), a squadmate answers "Spreading out!", the HUD says Spread out');
  const spot = await sim(page, (m, me) => m.fireteams.squadOf(me.slot).order.pos);
  // You go off (to a teammate of another squad, out of sight of the spot); the squad stays where you told it.
  const away = await sim(page, (m, me, p) => {
    const s = m.fireteams.squadOf(me.slot);
    const mate = m.combatants().filter((c) => c.alive && c.faction === me.faction && !s.members.includes(c.slot)).sort((a, b) => Math.hypot(b.move.pos.x - p.x, b.move.pos.z - p.z) - Math.hypot(a.move.pos.x - p.x, a.move.pos.z - p.z))[0];
    if (!mate) return null;
    me.move = { pos: { x: mate.move.pos.x + 1, y: mate.move.pos.y + 0.2, z: mate.move.pos.z }, velY: 0, grounded: false };
    return { tick: m.tick, x: Math.round(me.move.pos.x), z: Math.round(me.move.pos.z) };
  }, spot);
  const holding = await meWait(page, (m, me, a) => {
    const s = m.fireteams.squadOf(me.slot);
    const bots = s.members.filter((x) => x !== me.slot).map((x) => m.slots[x]).filter((c) => c?.alive);
    const near = bots.filter((c) => Math.hypot(c.move.pos.x - a.p.x, c.move.pos.z - a.p.z) < 8).length;
    return m.tick - a.tick > 8 * 60 && s.order.kind === 'hold' && bots.length > 0 && near * 2 > bots.length;
  }, { p: spot, tick: away?.tick ?? 0 }, 25);
  const where = await sim(page, (m, me, p) => {
    const s = m.fireteams.squadOf(me.slot);
    return { me: Math.round(Math.hypot(me.move.pos.x - p.x, me.move.pos.z - p.z)), bots: s.members.filter((x) => x !== me.slot).map((x) => m.slots[x]).filter((c) => c?.alive).map((c) => Math.round(Math.hypot(c.move.pos.x - p.x, c.move.pos.z - p.z))) };
  }, spot);
  check(!!away && holding && where.me > 12, `the squad holds where you gave the order after you go off (you ${where.me} m from it, the squad ${where.bots.join(', ')} m; from ${JSON.stringify(at)} to ${JSON.stringify(away)})`);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}


/**
 * New players: the first visit's tutorial offer, the tutorial on the Training Range (a step done by doing it, Skip
 * from the pause menu back to the menu, touch words on a phone), Quick Play into a Deathmatch against bots on a map
 * of its list, and a first-time tip (once only, clear of the crosshair). Automated browsers get neither the offer nor
 * tips unless they ask (&newplayer=1, &tips=1).
 */
async function newplayerFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  page.on('dialog', (d) => d.accept());
  // Without asking, a test page has no offer.
  await page.goto(`${CLIENT}/?test=1&name=Tester`);
  await page.waitForFunction(() => window.__front && !document.getElementById('menu').hidden, null, { timeout: T(60000) });
  check(!(await page.$('#first-run')), 'browser tests see no first-visit tutorial offer unless they ask');
  await page.goto(`${CLIENT}/?test=1&name=Tester&newplayer=1`);
  await page.waitForFunction(() => window.__front && !document.getElementById('menu').hidden, null, { timeout: T(60000) });
  const first = await page.evaluate(() => ({ offer: !!document.querySelector('#first-run'), nav: [...document.querySelectorAll('#menu .nav button')].map((b) => b.id), stored: localStorage.getItem('tiletrigger.tutorial') }));
  check(first.offer && first.nav[0] === 'nav-quick' && first.stored === 'offered', `a first visit: Quick Play heads the menu and the tutorial is offered, once (${JSON.stringify(first)})`);

  // The tutorial: the card, a step done by doing it, Skip.
  await page.click('#first-run-start');
  const started = await page.waitForFunction(() => window.__tutorial && window.__cs?.phase?.() === 'playing' && window.__cs.local?.alive, null, { timeout: T(120000) }).then(() => true, () => false);
  const card = started ? await page.evaluate(() => ({ step: window.__tutorial.state().step, count: document.querySelector('#tutorial .tut-count')?.textContent, text: document.querySelector('#tutorial .tut-text')?.innerHTML ?? '', skip: !!document.querySelector('#tutorial-skip'), pauseSkip: !!document.querySelector('#pause-skip-tutorial'), map: window.__cs.map })) : null;
  // No "You / Leader" score bar in the tutorial (owner, 2026-11-08); Quick Play's Deathmatch below shows it again.
  const tutScorebar = started ? await page.evaluate(() => { const el = document.getElementById('scorebar'); return { shown: !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0, boxes: document.getElementById('sb-left')?.textContent ?? '' }; }) : null;
  check(!!tutScorebar && !tutScorebar.shown, `the tutorial shows no Deathmatch score bar (You / Leader) (${JSON.stringify(tutScorebar)})`);
  check(!!card && card.step === 'look' && card.count === '1 / 10' && /<kbd>Mouse<\/kbd>/.test(card.text) && card.skip && card.pauseSkip && card.map === 'training_range', `Start tutorial opens the Training Range with the first step's card, Skip on it and in the pause menu (${JSON.stringify(card)})`);
  // Move: walking forward 5 m finishes it (and nothing else does: standing still keeps it).
  await page.evaluate(() => window.__tutorial.goTo(1));
  await frames(page, 30);
  const stillMove = await page.evaluate(() => window.__tutorial.state());
  await page.evaluate(() => (window.__autoInput = { forward: 1 }));
  const moved = await page.waitForFunction(() => window.__tutorial.state().step === 'sprint', null, { timeout: T(60000) }).then(() => true, () => false);
  await page.evaluate(() => (window.__autoInput = { forward: 1, buttons: 128 }));
  const sprinted = await page.waitForFunction(() => window.__tutorial.state().step === 'crouch', null, { timeout: T(60000) }).then(() => true, () => false);
  await page.evaluate(() => (window.__autoInput = { buttons: 256 }));
  const crouched = await page.waitForFunction(() => window.__tutorial.state().step === 'shoot', null, { timeout: T(60000) }).then(() => true, () => false);
  await page.evaluate(() => delete window.__autoInput);
  const dots = await page.$$eval('#tutorial .tut-dots i', (ds) => ds.map((d) => d.className));
  check(stillMove.step === 'move' && stillMove.progress === 0 && moved && sprinted && crouched && dots.slice(0, 4).every((c) => c === 'done') && dots[4] === 'on', `a step completes on its action: walking finishes Move, sprinting Sprint, crouching Crouch, and the dots follow (${JSON.stringify({ stillMove, moved, sprinted, crouched, dots })})`);
  // Skip (the pause menu's: Esc pauses): back to the main menu, and the offer won't come back.
  await page.evaluate(() => document.getElementById('pause-skip-tutorial').click());
  const back = await page.waitForFunction(() => !document.getElementById('menu').hidden && window.__front.screen === 'home', null, { timeout: T(30000) }).then(() => true, () => false);
  const after = await page.evaluate(() => ({ stored: localStorage.getItem('tiletrigger.tutorial'), card: !!document.querySelector('#tutorial'), skipBtn: !!document.querySelector('#pause-skip-tutorial') }));
  check(back && after.stored === 'skipped' && !after.card && !after.skipBtn, `Skip leaves the tutorial for the main menu and counts it as seen (${JSON.stringify({ back, ...after })})`);
  await page.reload();
  await page.waitForFunction(() => window.__front && !document.getElementById('menu').hidden, null, { timeout: T(60000) });
  check(!(await page.$('#first-run')), 'the next visit offers it no more');

  // Quick Play: two clicks into a Deathmatch against bots, on a map of its list, the map's recommended players.
  await page.click('#nav-quick');
  await page.waitForSelector('#quick-play');
  const choice = await page.$$eval('#quick-play .qp-mode', (bs) => bs.map((b) => b.dataset.mode));
  await page.click('#qp-dm');
  const playing = await page.waitForFunction(() => window.__cs?.phase?.() === 'playing' && window.__quickPlay, null, { timeout: T(120000) }).then(() => true, () => false);
  const qp = playing ? await page.evaluate(() => ({ ...window.__quickPlay, mode: window.__cs.rules().mode, map: window.__cs.map, saved: JSON.parse(localStorage.getItem('tiletrigger.quickPlay')) })) : null;
  const qpScorebar = playing ? await page.waitForFunction(() => { const el = document.getElementById('scorebar'); return !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0 && /You/.test(document.getElementById('sb-left').textContent); }, null, { timeout: T(30000) }).then(() => true, () => false) : false;
  const qpBar = await page.evaluate(() => { const el = document.getElementById('scorebar'); return el ? { display: getComputedStyle(el).display, width: el.getBoundingClientRect().width, left: document.getElementById('sb-left').textContent } : null; });
  check(qpScorebar, `after the tutorial, a Deathmatch shows its score bar again (You / Leader) (${JSON.stringify(qpBar)})`);
  check(choice.join() === 'core.tdm,core.deathmatch' && !!qp && qp.mode === 'core.deathmatch' && ['citadel', 'crossroads', 'bunker_cross', 'halcyon_station'].includes(qp.map) && qp.fill >= 8 && qp.setup.skill === 'normal' && qp.saved?.mode === 'core.deathmatch', `Quick Play → Deathmatch starts a match against normal bots on one of its maps (${JSON.stringify(qp && { map: qp.map, mode: qp.mode, fill: qp.fill, saved: qp.saved })})`);
  await page.goto(`${CLIENT}/?test=1&name=Tester`);
  await page.waitForFunction(() => window.__front && !document.getElementById('menu').hidden, null, { timeout: T(60000) });
  await page.click('#nav-quick');
  await page.waitForSelector('#quick-play');
  const remembered = await page.evaluate(() => ({ focus: document.activeElement?.dataset?.mode, last: document.querySelector('#quick-play .qp-last')?.closest('.qp-mode')?.dataset.mode }));
  await page.keyboard.press('Escape');
  const closed = await page.waitForFunction(() => !document.querySelector('#quick-play'), null, { timeout: T(5000) }).then(() => true, () => false);
  check(remembered.focus === 'core.deathmatch' && remembered.last === 'core.deathmatch' && closed, `Quick Play remembers the last choice (focused and marked), and Esc closes it (${JSON.stringify({ ...remembered, closed })})`);

  // A first-time tip: shown once, low in the middle, clear of the crosshair; seen, it doesn't come back.
  await page.goto(`${CLIENT}/?offline=arena&test=1&god=1&bots=1&name=Tester&tips=1`);
  await page.waitForFunction(() => window.__tips && window.__cs?.phase?.() === 'playing', null, { timeout: T(120000) });
  await page.evaluate(() => window.__tips.trigger('reload'));
  const shown = await page.waitForFunction(() => document.querySelector('#coach-tip.on'), null, { timeout: T(10000) }).then(() => true, () => false);
  const tip = await page.evaluate(() => {
    const r = document.getElementById('coach-tip').getBoundingClientRect();
    const cx = innerWidth / 2;
    const cy = innerHeight / 2;
    return { text: document.getElementById('coach-tip').textContent, clear: r.bottom < cy - 60 || r.top > cy + 60 || r.right < cx - 60 || r.left > cx + 60, seen: JSON.parse(localStorage.getItem('tiletrigger.tips')).seen };
  });
  check(shown && /reload/i.test(tip.text) && tip.clear && tip.seen.includes('reload'), `a tip shows once its situation happens, clear of the crosshair, and is remembered (${JSON.stringify(tip)})`);
  // Two situations at once: the first shows, the other waits (frames drawn between, so the HUD has had its turn).
  const one = await page.evaluate(() => new Promise((done) => {
    window.__tips.trigger('reload');
    window.__tips.trigger('vehicle');
    window.__tips.trigger('armor');
    requestAnimationFrame(() => requestAnimationFrame(() => done({ shown: document.querySelectorAll('#coach-tip.on').length, current: window.__tips.current() })));
  }));
  check(one.shown <= 1 && one.current !== 'armor', `one tip at a time: the others wait their turn (${JSON.stringify(one)})`);

  // On a phone the tutorial speaks of the touch controls.
  const phone = devices['Pixel 7'];
  const mobile = await (await browser.newContext({ ...phone, viewport: { width: phone.viewport.height, height: phone.viewport.width }, screen: { width: phone.screen.height, height: phone.screen.width } })).newPage();
  mobile.on('pageerror', (e) => errors.push(e.message));
  await mobile.goto(`${CLIENT}/?tutorial&test=1&name=Tester`);
  const touchCard = await mobile.waitForFunction(() => window.__tutorial && document.querySelector('#tutorial .tut-text')?.textContent, null, { timeout: T(120000) }).then(() => mobile.evaluate(() => document.querySelector('#tutorial .tut-text').textContent), () => '');
  check(/drag/i.test(touchCard) && !/mouse/i.test(touchCard), `on a phone the steps name the touch controls ("${touchCard}")`);
  await mobile.context().close();
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

async function visualFlow(browser) {
  const { existsSync, readFileSync } = await import('node:fs');
  const { PNG } = await import('pngjs');
  const update = !!process.env.E2E_UPDATE_BASELINES;
  const dir = new URL('./baselines/', import.meta.url);
  mkdirSync(dir, { recursive: true });
  for (const scene of VISUAL_SCENES) {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })).newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${CLIENT}${scene.url}`);
    const ready = await page.waitForFunction(scene.ready, null, { timeout: T(60000) }).then(() => true, () => false);
    if (scene.css) await page.addStyleTag({ content: scene.css });
    // Shaders, textures and streamed props settle over the first frames.
    if (ready) await frames(page, 30);
    const shot = PNG.sync.read(await page.screenshot({ animations: 'disabled', caret: 'hide' }));
    const file = new URL(`${scene.name}.png`, dir);
    if (update || !existsSync(file)) {
      writeFileSync(file, PNG.sync.write(shot));
      check(ready && errors.length === 0, `${scene.name}: baseline ${update ? 'updated' : 'written (none yet)'}${ready ? '' : ' (scene never got ready)'}${errors.length ? ` (${errors.join('; ')})` : ''}`);
      await page.context().close();
      continue;
    }
    const base = PNG.sync.read(readFileSync(file));
    let differ = 0;
    // Where the differences are, for the log (CI artifacts are not always at hand): a 12×6 grid of shares.
    const GX = 12, GY = 6;
    const grid = new Array(GX * GY).fill(0);
    const diff = new PNG({ width: shot.width, height: shot.height });
    const same = base.width === shot.width && base.height === shot.height;
    if (same) {
      for (let i = 0; i < shot.data.length; i += 4) {
        const d = Math.max(Math.abs(shot.data[i] - base.data[i]), Math.abs(shot.data[i + 1] - base.data[i + 1]), Math.abs(shot.data[i + 2] - base.data[i + 2]));
        const off = d > VISUAL_PIXEL_DELTA;
        if (off) {
          differ++;
          const p = i >> 2;
          grid[Math.floor(((p / shot.width) | 0) * GY / shot.height) * GX + Math.floor((p % shot.width) * GX / shot.width)]++;
        }
        diff.data[i] = off ? 255 : shot.data[i] >> 2;
        diff.data[i + 1] = off ? 0 : shot.data[i + 1] >> 2;
        diff.data[i + 2] = off ? 255 : shot.data[i + 2] >> 2;
        diff.data[i + 3] = 255;
      }
    }
    const share = same ? differ / (shot.width * shot.height) : 1;
    const pass = ready && same && share <= scene.share;
    if (!pass) {
      writeFileSync(`${ARTIFACTS}/visual-${scene.name}-actual.png`, PNG.sync.write(shot));
      if (same) writeFileSync(`${ARTIFACTS}/visual-${scene.name}-diff.png`, PNG.sync.write(diff));
      if (same) {
        const cell = (shot.width / GX) * (shot.height / GY);
        console.log(`visual ${scene.name}: differing pixels per cell, % (12×6 over the picture):`);
        for (let y = 0; y < GY; y++) console.log(`  ${grid.slice(y * GX, y * GX + GX).map((n) => String(Math.round((n / cell) * 100)).padStart(3)).join(' ')}`);
      }
      // A quarter-size copy of the picture, in the log: `grep '^VISUALPNG <name> ' log | cut -d' ' -f3 | tr -d '\n' | base64 -d > x.png`.
      const small = new PNG({ width: shot.width >> 2, height: shot.height >> 2 });
      for (let y = 0; y < small.height; y++) for (let x = 0; x < small.width; x++) {
        const o = (y * small.width + x) * 4, i = ((y << 2) * shot.width + (x << 2)) * 4;
        for (let c = 0; c < 4; c++) small.data[o + c] = shot.data[i + c];
      }
      const b64 = PNG.sync.write(small).toString('base64');
      for (let i = 0; i < b64.length; i += 4000) console.log(`VISUALPNG ${scene.name} ${b64.slice(i, i + 4000)}`);
    }
    console.log(`visual ${scene.name}: ${(share * 100).toFixed(2)} % of pixels differ (allowed ${(scene.share * 100).toFixed(0)} %)`);
    check(pass && errors.length === 0, `${scene.name} looks like its baseline (${same ? `${(share * 100).toFixed(1)} % of pixels differ, ${(scene.share * 100).toFixed(0)} % allowed` : `size ${shot.width}×${shot.height} vs ${base.width}×${base.height}`}${ready ? '' : '; the scene never got ready'})${errors.length ? ` (${errors.join('; ')})` : ''}`);
    await page.context().close();
  }
}

/**
 * After each frame drawn, the canvas at `size` with the HUD's hurt tint and Roulette's jackpot glow over it (HTML:
 * drawn here as the HUD draws them, hud.ts `hurtOverlay`, rouletteHud.ts `glowOverlay`), kept while `window.__flick.on` (the flashing flow). Runs in the page.
 */
function installFrameGrab(size) {
  const view = window.__cs.view;
  const engine = view.scene.getEngine();
  const canvas = engine.getRenderingCanvas();
  const out = document.createElement('canvas');
  [out.width, out.height] = size;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  const grab = (window.__flick = { on: false, frames: [], errors: [] });
  engine.onEndFrameObservable.add(() => {
    if (!grab.on) return;
    try {
      ctx.globalAlpha = 1;
      ctx.drawImage(canvas, 0, 0, out.width, out.height);
      const hurt = window.__cs.hud.hurtOverlay();
      if (hurt.opacity > 0.002) {
        ctx.globalAlpha = Math.min(1, hurt.opacity);
        ctx.drawImage(hurt.image, 0, 0, out.width, out.height);
        ctx.globalAlpha = 1;
      }
      // A heavy hit's darkened edge (HTML too: hud.ts heavyOverlay).
      const heavy = window.__cs.heavyOverlay?.();
      if (heavy && heavy.opacity > 0.002) {
        ctx.globalAlpha = Math.min(1, heavy.opacity);
        ctx.drawImage(heavy.image, 0, 0, out.width, out.height);
        ctx.globalAlpha = 1;
      }
      // Roulette's jackpot glow (HTML too: rouletteHud.ts glowOverlay).
      const glow = window.__cs.rouletteGlow?.();
      if (glow && glow.opacity > 0.002) {
        ctx.globalAlpha = Math.min(1, glow.opacity);
        ctx.drawImage(glow.image, 0, 0, out.width, out.height);
        ctx.globalAlpha = 1;
      }
      grab.frames.push(ctx.getImageData(0, 0, out.width, out.height).data);
    } catch (e) {
      grab.errors.push(String(e));
    }
  });
}

/** The frames grabbed since the last call, as [{ px, w, h }] (RGBA), and the grab's errors. */
async function takeFrames(page, w, h) {
  const { data, errors } = await page.evaluate(() => {
    const grab = window.__flick;
    const frames = grab.frames;
    grab.frames = [];
    const all = new Uint8Array(frames.reduce((n, f) => n + f.length, 0));
    let at = 0;
    for (const f of frames) {
      all.set(f, at);
      at += f.length;
    }
    let text = '';
    for (let i = 0; i < all.length; i += 0x8000) text += String.fromCharCode.apply(null, all.subarray(i, i + 0x8000));
    return { data: btoa(text), errors: grab.errors.splice(0) };
  });
  const bytes = Buffer.from(data, 'base64');
  const size = w * h * 4;
  const frames = [];
  for (let at = 0; at + size <= bytes.length; at += size) frames.push({ px: bytes.subarray(at, at + size), w, h });
  return { frames, errors };
}

/** Every `every`th frame in a grid `cols` wide, as a PNG (the flow's frame strips). */
async function frameStrip(frames, every = 4, cols = 5) {
  const { PNG } = await import('pngjs');
  const picked = frames.filter((_, i) => i % every === 0);
  if (!picked.length) return null;
  const { w, h } = picked[0];
  const rows = Math.ceil(picked.length / cols);
  const png = new PNG({ width: w * cols + cols - 1, height: h * rows + rows - 1 });
  png.data.fill(255);
  picked.forEach((f, k) => {
    const ox = (k % cols) * (w + 1);
    const oy = Math.floor(k / cols) * (h + 1);
    for (let y = 0; y < h; y++) f.px.copy(png.data, ((oy + y) * png.width + ox) * 4, y * w * 4, (y + 1) * w * 4);
  });
  return PNG.sync.write(png);
}

/**
 * Reduce flashing's flicker check (docs/LOOK.md, "Reduce flashing"; e2e/flicker.mjs: WCAG 2.3.1's general and red
 * flash thresholds). MapMaker makes a night scene with its own edits: a dark room, a room lit by a red alarm light
 * blinking four times a second, an Arc Turret and an electric fence. In play, the brightest moments are recorded
 * frame by frame at 30 frames a second of the page's own time (e2e/frameClock.mjs: however slowly this machine draws,
 * a recorded second is a second of play): an arc fight up close, the fence zapping bots in front of you, four
 * grenade blasts in front of the camera, a machine gun firing at a wall in the dark, heavy rain and a blizzard at
 * night, the alarm light. With the setting
 * on each moment must stay under the thresholds; the same moments with it off are measured and reported as numbers
 * only. Frame strips (every 4th frame) and the numbers go to e2e-artifacts/ (flashing-<moment>-<on|off>.png,
 * flashing.json). E2E_FLASH_MOMENTS=arc,blast records just those.
 */
async function flashingFlow(browser) {
  const FPS = 30;
  const [W, H] = [160, 90];
  const RECORD = 2 * FPS;
  const only = process.env.E2E_FLASH_MOMENTS?.split(',').filter(Boolean);
  const ctx = await browser.newContext({ viewport: { width: 480, height: 270 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(installFrameClock);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  await page.goto(`${CLIENT}/?mode=editor&test=1`);
  await page.waitForFunction(() => window.__editor, null, { timeout: T(30000) });
  page.once('dialog', (d) => d.accept());
  await newMap(page, 96);
  // The scene, as MapMaker edits (one undo step): a night sky, two closed rooms of dark blocks (the second lit by the
  // alarm light), an Arc Turret and a 12 m electric fence.
  const made = await page.evaluate(() => {
    const ed = window.__editor;
    const block = (id, at, size) => ({ id, kind: 'block', position: at, size, yaw: 0, material: null, tint: '#2a2a2f', behaviour: 'solid', trigger: 'step', delaySeconds: 0.8, respawnSeconds: 8, health: 120 });
    const room = (name, x, z) => [
      block(`${name}_n`, [x, 0, z - 5], [10.4, 3.4, 0.4]),
      block(`${name}_s`, [x, 0, z + 5], [10.4, 3.4, 0.4]),
      block(`${name}_w`, [x - 5, 0, z], [0.4, 3.4, 10.4]),
      block(`${name}_e`, [x + 5, 0, z], [0.4, 3.4, 10.4]),
      block(`${name}_roof`, [x, 3.4, z], [10.4, 0.4, 10.4]),
    ];
    const entities = [
      ...room('dark_room', 0, -24),
      ...room('alarm_room', 24, -24),
      { id: 'alarm_light', kind: 'light', position: [24, 3.1, -24], yaw: 0, color: '#ff3020', intensity: 1.6, range: 12, fixture: 'ceiling', blink: 4 },
      { id: 'arc_turret', kind: 'mount', model: 'sentry_arc', position: [-24, 0, 24], yaw: 0, faction: null, respawnSeconds: null },
      { id: 'live_fence', kind: 'trap', trap: 'shock', position: [24, 0, 24], yaw: 0, activation: 'always', onSeconds: 2, offSeconds: 2, offsetSeconds: 0, startEnabled: true, damage: null, length: 12 },
    ];
    const before = ed.doc.backdrop ?? null;
    const after = { scenery: 'hills', ground: 'grass', ...(before ?? {}), sky: 'night', haze: 0 };
    const ok = ed.run('Flicker check scene', { kind: 'batch', commands: [{ kind: 'setBackdrop', before, after }, { kind: 'addEntities', entities }] });
    return { ok, entities: ed.doc.entities.length, sky: ed.doc.backdrop?.sky };
  });
  check(made.ok && made.sky === 'night', `MapMaker makes the check's night scene: two dark rooms (one with a red alarm light blinking 4 times a second), an Arc Turret and an electric fence (${JSON.stringify(made)})`);
  await page.keyboard.press('F5');
  const playing = await page.waitForFunction(() => window.__cs?.local && window.__testStartMs, null, { timeout: T(60000) }).then(() => true, () => false);
  check(playing, 'the scene plays (MapMaker TEST)');
  if (!playing) return void (await ctx.close());
  await holdBots(page);
  // Both guns in hand once, so their models are in before the page's clock stops (models load in real time).
  for (const id of ['core.lmg', 'core.arc_caster']) {
    await page.evaluate((w) => window.__give(w), id);
    await page.waitForFunction((w) => window.__cs.view.viewWeapon === w && !!window.__cs.view.viewmodel, id, { timeout: T(30000) }).catch(() => {});
  }
  // The setting as the pause menu's Settings switch changes it (the menu itself stays shut).
  const setFlashing = (on) =>
    page.evaluate((on) => {
      const box = document.getElementById('reduce-flashing');
      if (box.checked === on) return;
      box.checked = on;
      box.dispatchEvent(new Event('change'));
    }, on);
  const defaultOn = await page.evaluate(() => document.getElementById('reduce-flashing')?.checked);
  check(defaultOn === true, `Reduce flashing is on by default (the pause menu's switch: ${defaultOn})`);
  await page.evaluate(installFrameGrab, [W, H]);
  await page.evaluate(() => window.__frameClock.freeze());
  const step = (n) =>
    page.evaluate(([n, ms]) => {
      const thrown = [];
      for (let i = 0; i < n; i++) thrown.push(...window.__frameClock.step(ms));
      return thrown;
    }, [n, 1000 / FPS]);
  const clockErrors = [];
  // Through the wait for players and the start countdown (nobody fires before play), on the page's clock.
  for (let i = 0; i < 40 && (await sim(page, (m) => m.phase)) !== 'playing'; i++) clockErrors.push(...(await step(15)));
  check((await sim(page, (m) => m.phase)) === 'playing', 'the match is in play before the recording starts');
  /** You, the bots and your aim held where a moment wants them (each tick), never dying, magazines full. */
  const stage = (mo) =>
    sim(page, (m, me, mo) => {
      clearInterval(self.__flashPin);
      const put = (c, p) => {
        c.move = { ...c.move, pos: { x: p[0], y: p[1], z: p[2] }, velY: 0, vx: 0, vz: 0, grounded: true };
      };
      const bots = m.combatants().filter((c) => c.bot);
      const pin = () => {
        put(me, mo.me);
        me.maxHealth = me.health = 100000;
        for (const w of me.weapons.values()) if (w.def.magazine) w.mag = w.def.magazine;
        bots.forEach((b, i) => {
          b.maxHealth = b.health = 100000;
          put(b, mo.bots[i] ?? [40 + i * 2, 0, -40]);
        });
      };
      pin();
      self.__flashPin = setInterval(pin, 1000 / 60);
    }, { me: mo.me, bots: mo.bots });
  /** Aim from your eye (1.6 m up) at a point. */
  const aim = (from, to) => {
    const d = [to[0] - from[0], to[1] - from[1] - 1.6, to[2] - from[2]];
    return { yaw: Math.atan2(d[0], d[2]), pitch: Math.atan2(d[1], Math.hypot(d[0], d[2])) };
  };
  const blast = (at) => sim(page, (m, _me, at) => m.scenario.host.blast({ x: at[0], y: at[1], z: at[2] }, 4.5, 100, 15, null, 'core.launcher'), at);
  // The moments (a few metres apart in the scene; 2 s each, setting on then off).
  const moments = [
    {
      name: 'arc',
      label: 'an arc fight up close (an Arc Turret locked on you 4.5 m off, your Arc Caster on three bots between you)',
      weapon: 'core.arc_caster',
      me: [-24, 0, 19.5],
      look: aim([-24, 0, 19.5], [-24.1, 1.1, 22.6]),
      bots: [[-25.2, 0, 22.2], [-22.9, 0, 22.5], [-24.1, 0, 22.9]],
      fire: true,
      // Locked on you from the first frame (no wind-up), for the whole recording.
      before: () =>
        sim(page, (m, me) => {
          const t = m.mounts.find((x) => x.def.id === 'sentry_arc');
          if (t) t.arc = { charge: 1000, target: me.slot, lockTicks: 0, vent: 0 };
        }),
    },
    {
      name: 'fence',
      label: 'the electric fence (three bots against it 2-4 m in front of you, zapped twice a second each)',
      weapon: 'core.arc_caster',
      me: [23.5, 0, 26.5],
      look: aim([23.5, 0, 26.5], [24, 1.1, 24]),
      bots: [[22.6, 0, 24.3], [24.4, 0, 24.3], [26, 0, 23.7]],
    },
    {
      name: 'blast',
      label: 'four grenade blasts 3-5 m in front of the camera in 0.8 s',
      weapon: 'core.arc_caster',
      me: [0, 0, 8],
      look: aim([0, 0, 8], [0, 0.5, 13]),
      bots: [],
      at: { 6: () => blast([-1.2, 0.3, 11.5]), 14: () => blast([1, 0.3, 12.5]), 22: () => blast([0, 0.3, 11]), 30: () => blast([-0.4, 0.3, 13]) },
    },
    {
      name: 'muzzle',
      label: 'a machine gun firing at a wall 3.5 m off in the dark room',
      weapon: 'core.lmg',
      me: [0, 0, -25.5],
      look: aim([0, 0, -25.5], [0, 1.2, -29]),
      bots: [],
      fire: true,
    },
    {
      name: 'jackpot',
      label: "Roulette's jackpot glow (the screen's edges easing to gold, held, then easing out)",
      weapon: 'core.arc_caster',
      me: [0, 0, 8],
      look: aim([0, 0, 8], [0, 0.5, 13]),
      bots: [],
      at: { 2: () => page.evaluate(() => window.__cs.jackpotGlow()) },
    },
    {
      name: 'fight',
      label: "a fight's moments 3 m in front of you (armour breaking, two heavy hits with your screen's edge, a kill streak's burst, a spawn shield's shimmer, armour picked up there and by you)",
      weapon: 'core.arc_caster',
      me: [0, 0, 8],
      look: aim([0, 0, 8], [0, 1, 11]),
      bots: [[0, 0, 11]],
      before: () => sim(page, (m) => {
        const b = m.combatants().find((c) => c.bot);
        if (b) b.shieldUntil = m.tick + 60 * 30;
      }),
      at: {
        4: () => page.evaluate(() => window.__cs.view.playGameplayFx('armor.break', window.__cs.view.towardCamera({ x: 0, y: 1.2, z: 11 }, 0.5), { calmable: true })),
        12: () => page.evaluate(() => (window.__cs.view.playGameplayFx('hit.big', window.__cs.view.towardCamera({ x: 0, y: 1.1, z: 11 }, 0.5), { calmable: true }), window.__cs.hud.heavyHit(90))),
        24: () => page.evaluate(() => window.__cs.view.playGameplayFx('streak', { x: 0, y: 2.1, z: 11 }, { calmable: true })),
        36: () => page.evaluate(() => (window.__cs.view.playGameplayFx('hit.big', window.__cs.view.towardCamera({ x: 0.3, y: 1, z: 11 }, 0.5), { calmable: true }), window.__cs.hud.heavyHit(70))),
        // Armour picked up: the bot's (sized for the distance, as session plays it), then your own at your chest.
        30: () => page.evaluate(() => window.__cs.view.playGameplayFx('pickup.armor', { x: 0, y: 1.2, z: 11 }, { size: window.__cs.view.farSize({ x: 0, y: 1.2, z: 11 }) })),
        44: () => page.evaluate(() => window.__cs.view.playGameplayFx('pickup.armor', { x: 0, y: 1.2, z: 8 }, { size: window.__cs.view.farSize({ x: 0, y: 1.2, z: 8 }) })),
      },
    },
    // Weather (map format v34; weatherVisuals.ts): a downpour and a blizzard with a gale at night, out in the open (the
    // brightest contrast: pale drops and flakes against the dark), drawn as High graphics draws them (the most drops;
    // the flow plays on Low, which draws none). No lightning: nothing in them may flash.
    {
      name: 'rain',
      label: 'heavy rain in a gale at night, out in the open, looking up into it',
      weapon: 'core.arc_caster',
      me: [-10, 0, 0],
      look: aim([-10, 0, 0], [0, 5, 6]),
      bots: [],
      before: () => page.evaluate(() => window.__cs.view.setWeather({ fall: 'rain', amount: 1, wind: 0.7, fog: 0.3 }, 'high')),
      after: () => page.evaluate(() => window.__cs.view.setWeather({ fall: 'none', amount: 0, wind: 0, fog: 0 })),
    },
    {
      name: 'snow',
      label: 'a blizzard at night, out in the open',
      weapon: 'core.arc_caster',
      me: [-10, 0, 0],
      look: aim([-10, 0, 0], [0, 1.4, 6]),
      bots: [],
      before: () => page.evaluate(() => window.__cs.view.setWeather({ fall: 'snow', amount: 1, wind: 0.85, fog: 0.45 }, 'high')),
      after: () => page.evaluate(() => window.__cs.view.setWeather({ fall: 'none', amount: 0, wind: 0, fog: 0 })),
    },
    {
      name: 'alarm',
      label: 'the red alarm light blinking 4 times a second, in its dark room',
      weapon: 'core.arc_caster',
      me: [24, 0, -20.5],
      look: aim([24, 0, -20.5], [24, 1.4, -28]),
      bots: [],
    },
  ];
  const report = { fps: FPS, frame: [W, H], viewport: [480, 270], limits: FLICKER_LIMITS, moments: {} };
  for (const mo of moments) {
    if (only && !only.includes(mo.name)) continue;
    await page.evaluate(() => (window.__autoInput = { buttons: 0 }));
    await page.evaluate((w) => window.__give(w), mo.weapon);
    await stage(mo);
    await page.evaluate((look) => Object.assign(window.__cs.input, look), mo.look);
    clockErrors.push(...(await step(15)));
    const runs = {};
    for (const on of [true, false]) {
      await setFlashing(on);
      await mo.before?.();
      if (mo.fire) await page.evaluate(() => (window.__autoInput = { buttons: 2 }));
      // The switch (and the trigger) settle in: a third of a second before the recording.
      clockErrors.push(...(await step(10)));
      await page.evaluate(() => {
        window.__flick.frames = [];
        window.__flick.on = true;
      });
      for (let f = 0; f < RECORD; f++) {
        await mo.at?.[f]?.();
        clockErrors.push(...(await step(1)));
      }
      await page.evaluate(() => (window.__flick.on = false));
      if (mo.fire) await page.evaluate(() => (window.__autoInput = { buttons: 0 }));
      const { frames, errors: grabErrors } = await takeFrames(page, W, H);
      clockErrors.push(...grabErrors);
      const r = analyseFrames(frames, FPS);
      // How much of the picture moved at most between two frames (a change of 0.02 or more): the moment happened.
      const stats = frames.map((f) => frameStats(f.px, f.w, f.h));
      let activity = 0;
      for (let i = 1; i < stats.length; i++) {
        let moved = 0;
        for (let k = 0; k < stats[i].L.length; k++) if (Math.abs(stats[i].L[k] - stats[i - 1].L[k]) >= 0.02) moved++;
        activity = Math.max(activity, moved / stats[i].L.length);
      }
      runs[on ? 'on' : 'off'] = { ...r, activity, frames: frames.length };
      const strip = await frameStrip(frames);
      if (strip) writeFileSync(`${ARTIFACTS}/flashing-${mo.name}-${on ? 'on' : 'off'}.png`, strip);
      console.log(`flashing ${mo.name} ${on ? 'on ' : 'off'}: ${flickerSummary(r)}; screen brightness ${Math.min(...r.meanL).toFixed(3)}-${Math.max(...r.meanL).toFixed(3)}`);
    }
    await mo.after?.();
    const { on, off } = runs;
    report.moments[mo.name] = Object.fromEntries(
      Object.entries(runs).map(([k, r]) => [k, { pass: r.pass, reasons: r.reasons, transitionsPerSecond: r.perSecond, flashesPerSecond: r.flashesPerSecond, fieldTransitionsPerSecond: r.fieldPerSecond, transitions: r.transitions.length, maxStep: +r.maxStep.toFixed(4), redTransitionsPerSecond: r.red.perSecond, redFlashes: r.red.onsets.length, maxRedArea: +r.red.maxArea.toFixed(4), activity: +r.activity.toFixed(4), meanL: r.meanL.map((x) => +x.toFixed(4)), change: r.change.map((x) => +x.toFixed(4)) }]),
    );
    // (With the setting on a moment may change little from one frame to the next: that is the point.)
    check(on.frames === RECORD && off.frames === RECORD && off.activity > 0.003, `${mo.name}: the moment was recorded, every frame, and it happened (${on.frames} + ${off.frames} frames; up to ${(off.activity * 100).toFixed(1)} % of the picture changed between two frames with the setting off, ${(on.activity * 100).toFixed(1)} % on)`);
    check(on.pass, `${mo.label}, Reduce flashing on: ${flickerSummary(on)}${on.reasons.length ? ` (FAILS: ${on.reasons.join('; ')})` : ''}`);
  }
  writeFileSync(`${ARTIFACTS}/flashing.json`, JSON.stringify(report));
  check(clockErrors.length === 0 && errors.length === 0, `no page errors while recording (${[...clockErrors, ...errors].slice(0, 4).join(' | ')})`);
  await ctx.close();
}

async function designerFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 1200, height: 760 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  await page.goto(CLIENT);
  await page.click('#profile-badge');
  await page.click('#profile-change-character');
  await page.click('.char-tile.new');
  await page.waitForFunction(() => !!window.__designer, null, { timeout: T(30000) });
  await page.click('#designer button:text-is("Female")');
  await page.click('#designer .tab:text-is("Outfit")');
  await page.selectOption('#designer .dz-row:has(label:text-is("Top")) select', 'peasant_torso_f');
  await page.click('#designer .tab:text-is("Head")');
  await page.click('#designer button:text-is("Buns")');
  const id = await page.evaluate(() => window.__designer.lookId);
  const problems = await page.evaluate(() => window.__designer.problems);
  check(problems.length === 0 && id.startsWith('c1-f'), `designer builds a wearable custom look (${id} ${problems.join(', ')})`);
  await page.click('#designer button:text-is("Save and use")');
  await page.waitForFunction(() => !document.getElementById('menu').hidden);
  const selected = await page.evaluate(() => window.__front.look);
  check(selected === id, `the saved look is selected on the menu (${selected})`);
  // Its portrait is drawn once when it's saved and kept in this browser (never drawn again on Character Select).
  const kept = await until(() => page.evaluate((id) => /^data:image\//.test(JSON.parse(localStorage.getItem('cs.portraits') ?? '{}')[id] ?? ''), id), T(20000));
  check(kept, 'saving a design keeps its portrait in the browser');
  await page.goto(`${CLIENT}/?offline`);
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() !== 'waiting' && window.__cs.phase() !== 'countdown', null, { timeout: T(60000) });
  await page.waitForFunction(() => window.__cs.view.hasFirstPersonArms(), null, { timeout: T(20000) }).catch(() => {});
  check(await page.evaluate(() => window.__cs.view.hasFirstPersonArms()), 'first-person arms of the custom look hold the weapon');
  // First person is full body by default (Options → Display → First person); Arms only applies at once, and back.
  const fpBody = await page.waitForFunction(() => window.__cs.view.hasFirstPersonBody(), null, { timeout: T(20000) }).then(() => true, () => false);
  check(fpBody, 'full-body first person: your own character is drawn from its eyes');
  const setFp = (mode) => page.evaluate((m) => {
    localStorage.setItem('tiletrigger.firstPerson', m);
    window.dispatchEvent(new Event('tiletrigger:first-person'));
  }, mode);
  await setFp('arms');
  const armsOnly = await page.waitForFunction(() => !window.__cs.view.hasFirstPersonBody() && window.__cs.view.hasFirstPersonArms(), null, { timeout: T(20000) }).then(() => true, () => false);
  await setFp('body');
  const bodyAgain = await page.waitForFunction(() => window.__cs.view.hasFirstPersonBody(), null, { timeout: T(20000) }).then(() => true, () => false);
  check(armsOnly && bodyAgain, `First person: Arms only and back to Full body apply in the match (${armsOnly}, ${bodyAgain})`);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

/**
 * WebGPU on a software adapter (SwiftShader). It renders, but can't present
 * to a headless canvas, so webgpuShim.js swaps the canvas for an offscreen
 * texture. Regression check for characters drawn as flat white silhouettes
 * (PBR's energy-conservation term divided by a zero BRDF table): a portrait
 * must show shaded, coloured pixels, and every PBR material must use the
 * scene's pass-free BRDF table (content/brdf.ts).
 */
async function webgpuFlow() {
  const browser = await chromium.launch({
    args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-webgpu-adapter=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'],
  });
  try {
    const context = await browser.newContext({ viewport: { width: 480, height: 270 } });
    await context.addInitScript({ path: new URL('./webgpuShim.js', import.meta.url).pathname });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
    page.on('console', (m) => /WebGPU (uncaptured error|context lost)/.test(m.text()) && errors.push(m.text()));
    await page.goto(`${CLIENT}/favicon.ico`).catch(() => {});
    if (!(await page.evaluate(async () => !!(await navigator.gpu?.requestAdapter())))) {
      console.log('SKIP webgpu: no WebGPU adapter in this browser');
      return;
    }
    await page.goto(`${CLIENT}/?renderer=webgpu`);
    await page.waitForFunction(() => window.__front, null, { timeout: T(60000) });
    check(await page.evaluate(() => window.__front.portraits.scene.getEngine().isWebGPU), 'the menu runs on WebGPU');
    const src = await page.evaluate(() => window.__front.portraits.get(window.__front.look));
    const px = await page.evaluate(async (url) => {
      const img = new Image();
      img.src = url;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let opaque = 0, white = 0, sum = 0, sum2 = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 200) continue;
        opaque++;
        if (d[i] > 245 && d[i + 1] > 245 && d[i + 2] > 245) white++;
        const l = (d[i] + d[i + 1] + d[i + 2]) / 3;
        sum += l;
        sum2 += l * l;
      }
      const mean = sum / Math.max(1, opaque);
      return { opaque, white, mean: Math.round(mean), sd: Math.round(Math.sqrt(Math.max(0, sum2 / Math.max(1, opaque) - mean * mean))) };
    }, src);
    check(px.opaque > 4000 && px.white < px.opaque * 0.1 && px.sd > 12 && px.mean < 220, `WebGPU portrait is a shaded character, not a white silhouette (${JSON.stringify(px)})`);
    const lut = await page.evaluate(() =>
      [window.__front.portraits.scene, ...window.__front.portraits.scene.getEngine().scenes].every((s) => {
        const t = s.environmentBRDFTexture;
        return t?.name === 'envBrdfRgbd' && t.isRGBD && s.materials.every((m) => m.getClassName() !== 'PBRMaterial' || m._environmentBRDFTexture === t);
      }),
    );
    check(lut, 'every scene and PBR material uses the pass-free BRDF table');
    // The environment lab on WebGPU: its materials (and the wind plugin's WGSL) compile and every species draws.
    await page.goto(`${CLIENT}/?envlab&test=1&renderer=webgpu&view=small`);
    const lab = await page.waitForFunction(() => window.__envlab?.ready, null, { timeout: T(120000) }).then(() => true, () => false);
    const env = lab ? await page.evaluate(() => ({ gpu: window.__envlab.scene.getEngine().isWebGPU, stats: window.__envlab.stats().env })) : null;
    check(lab && env.gpu && env.stats.drawnBatches > 0 && env.stats.copies > 50, `the environment lab draws on WebGPU (${JSON.stringify(env)})`);
    check(errors.length === 0, `no page or WebGPU errors (${errors.join('; ')})`);
  } finally {
    await browser.close();
  }
}

/**
 * The character checks, in three flows that CI runs side by side (each was ~3.5 min of an 11-min flow): part 0 the
 * viewer, the palms on large guns (first person, full body) and third-person strafing; part 1 where the hands are
 * drawn; part 2 grips in a real match (gripsInPlay).
 */
async function charactersFlow(browser, part = 0) {
  if (part === 2) {
    await gripsInPlay(browser);
    return farBodies(browser);
  }
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  if (part === 1) {
    await page.goto(`${CLIENT}/?mode=grips&test=1`);
    await page.waitForFunction(() => window.__grips, null, { timeout: T(60000) });
    await drawnHands(page);
    check(errors.length === 0, `no page errors (${errors.join('; ')})`);
    await page.context().close();
    return;
  }
  await page.goto(`${CLIENT}/?mode=characters`);
  await page.waitForFunction(() => window.__charsReady === true, null, { timeout: T(30000) });
  const [n, want] = await page.evaluate(() => [window.__charAnimators.length, window.__charSpecs]);
  check(n === want && n >= 20, `character viewer builds every look and NPC (${n} of ${want})`);
  const lod = await page.evaluate(() => window.__charAnimators.filter((a) => a.ch.meshes.some((m) => m.getLODLevels?.().length)).length);
  check(lod === n, `every character has low-detail levels (${lod} of ${n})`);
  // Through a scope (the view's zoom) the low-detail copy waits further out, as far as it looks as big as unzoomed.
  const switchAt = await page.evaluate(() => {
    const at = () => window.__charAnimators.flatMap((a) => a.ch.meshes.flatMap((m) => (m.getLODLevels?.() ?? []).map((l) => l.distanceOrScreenCoverage)));
    const plain = at();
    window.__charLodZoom(4);
    const scoped = at();
    window.__charLodZoom(1);
    return { plain: [...new Set(plain)], scoped: [...new Set(scoped)], back: [...new Set(at())] };
  });
  check(switchAt.plain.join() === '18' && switchAt.scoped.join() === '72' && switchAt.back.join() === '18', `a scope moves the characters' low-detail switch out with its zoom (${JSON.stringify(switchAt)})`);
  // Parts sharing a material are merged, and skin, hair, eyes and gear share the character atlas: a character is
  // its outfit and its atlas draw (2 on average, 3 where a look mixes outfit families), not one per part.
  const draws = await page.evaluate(() => window.__charAnimators.map((a) => a.ch.meshes.filter((m) => !m.isDisposed() && !m.isBlocked && m.getTotalVertices() > 0).length));
  const most = Math.max(...draws);
  check(most <= 4 && draws.reduce((s, d) => s + d, 0) / draws.length <= 2.5, `characters draw a few merged meshes each (at most ${most}, ${(draws.reduce((s, d) => s + d, 0) / draws.length).toFixed(1)} on average)`);
  for (const label of ['Rifle', 'Run', 'shoot', 'Death', 'Idle']) {
    await page.click(`button:text-is("${label}")`);
    await page.waitForTimeout(300); // wait-ok: plays each clip a moment (page errors are what's checked)
  }
  // First-person arms on large guns (the grip tool, `?mode=grips`, the game's own first-person placement): both palms
  // reach their points on the gun, for standard, own (Meshy) and universal arms. Out of reach, the support hand used to
  // stop short of a big gun and float in front of it.
  await page.goto(`${CLIENT}/?mode=grips&test=1`);
  await page.waitForFunction(() => window.__grips, null, { timeout: T(60000) });
  const misses = [];
  for (const look of ['core.ranger', 'core.biscuit', 'core.grizzelda']) {
    for (const weapon of ['core.rifle', 'core.singularity', 'core.lmg', 'core.flamethrower']) {
      await page.evaluate(([l, w]) => window.__grips.pose(l, w, 'first'), [look, weapon]);
      const m = await page.evaluate(() => window.__grips.miss());
      if (!m || m.r > 0.02 || m.l > 0.02) misses.push(`${look} ${weapon}: ${m ? `${(m.r * 100).toFixed(0)}/${(m.l * 100).toFixed(0)} cm` : 'no grip'}`);
    }
  }
  check(misses.length === 0, `first-person palms are on large guns' grip and handguard (${misses.join('; ') || 'all within 2 cm'})`);
  // Full-body first person (your own whole character from its eyes): the same palms on the same guns, looking ahead
  // and down at your feet.
  const bodyMisses = [];
  for (const look of ['core.ranger', 'core.galloway']) {
    for (const weapon of ['core.rifle', 'core.lmg', 'core.pistol']) {
      await page.evaluate(([l, w]) => window.__grips.pose(l, w, 'body'), [look, weapon]);
      for (const pitch of [0, -1.3]) {
        await page.evaluate((p) => window.__grips.look(p), pitch);
        const m = await page.evaluate(() => window.__grips.miss());
        if (!m || m.r > 0.02 || m.l > 0.02) bodyMisses.push(`${look} ${weapon} pitch ${pitch}: ${m ? `${(m.r * 100).toFixed(0)}/${(m.l * 100).toFixed(0)} cm` : 'no grip'}`);
      }
    }
  }
  check(bodyMisses.length === 0, `full-body first person: palms on the gun's grip and handguard (${bodyMisses.join('; ') || 'all within 2 cm'})`);
  // Third person, strafing and backing up while firing: the hips turn toward the motion and the shoulders stay square
  // to the aim (they used to wind about 140 degrees off it), the hands on the gun. A modular character and a whole
  // body, both on the default clip set (its walk/run legs, the running shot on the upper body, the backward shooting
  // walk), and the rolling Baseball Robot, which has none (it glides on the rig's idle).
  const strafes = [];
  for (const look of ['core.ranger', 'core.wwiisoldier']) {
    await page.evaluate((l) => window.__grips.pose(l, 'core.rifle', 'third'), look);
    const shoulderYaw = () =>
      page.evaluate(() => {
        const j = window.__grips.joints();
        const d = [j.upperarm_r[0] - j.upperarm_l[0], j.upperarm_r[2] - j.upperarm_l[2]];
        const h = [j.thigh_r[0] - j.thigh_l[0], j.thigh_r[2] - j.thigh_l[2]];
        return { shoulders: Math.atan2(d[0], d[1]), hips: Math.atan2(h[0], h[1]) };
      });
    await page.evaluate(() => window.__grips.drive({ speed: 5.2, moveAngle: 0, pitch: 0 }, 8, 40));
    const ahead = await shoulderYaw();
    const clips = await page.evaluate(() => {
      const c = window.__grips.anim().ch.clips;
      return { set: c.has('clip_run'), run: !!c.get('clip_run')?.isPlaying, rigRun: !!c.get('run')?.isPlaying, shootRun: [...window.__grips.anim().ch.root.getScene().animationGroups].some((g) => /clip_shoot_run_upper$/.test(g.name) && g.isPlaying && g.weight > 0.5) };
    });
    for (const [label, moveAngle, speed] of [['right', Math.PI / 2, 5.2], ['left', -Math.PI / 2, 5.2], ['back', Math.PI, 3.9]]) {
      await page.evaluate(([a, v]) => window.__grips.drive({ speed: v, moveAngle: a, pitch: 0 }, 8, 40), [moveAngle, speed]);
      const y = await shoulderYaw();
      const off = Math.abs(Math.atan2(Math.sin(y.shoulders - ahead.shoulders), Math.cos(y.shoulders - ahead.shoulders)));
      const hipTurn = Math.abs(Math.atan2(Math.sin(y.hips - ahead.hips), Math.cos(y.hips - ahead.hips)));
      const grip = await page.evaluate(() => window.__grips.drawn());
      const back = await page.evaluate(() => !!window.__grips.anim().ch.clips.get('clip_shoot_back')?.isPlaying);
      const ok = off < 0.2 && (label === 'back' || hipTurn > 0.8) && !!grip && grip.r !== null && grip.r < 0.12 && (label !== 'back' || back);
      if (!ok) strafes.push(`${look} ${label}: shoulders ${((off * 180) / Math.PI).toFixed(0)} deg off the aim, hips turned ${((hipTurn * 180) / Math.PI).toFixed(0)}, right hand ${grip?.r == null ? '-' : (grip.r * 100).toFixed(0)} cm${label === 'back' ? `, backward clip ${back}` : ''}`);
    }
    await page.evaluate(() => window.__grips.drive({ speed: 0 }, 0, 2));
    if (!(clips.set && clips.run && clips.shootRun && !clips.rigRun)) strafes.push(`${look} runs on ${JSON.stringify(clips)}`);
  }
  // The rolling Baseball Robot: no clip set loaded, no gait.
  await page.evaluate(() => window.__grips.pose('core.rollerbot', 'core.rifle', 'third'));
  await page.evaluate(() => window.__grips.drive({ speed: 5.2, moveAngle: Math.PI / 2, pitch: 0 }, 8, 20));
  const roller = await page.evaluate(() => {
    const c = window.__grips.anim().ch.clips;
    return { set: c.has('clip_run'), rigRun: !!c.get('run')?.isPlaying };
  });
  if (roller.set || roller.rigRun) strafes.push(`core.rollerbot rolls on ${JSON.stringify(roller)}`);
  await page.evaluate(() => window.__grips.drive({ speed: 0 }, 0, 2));
  check(strafes.length === 0, `third person, strafing and backing up while firing: shoulders square to the aim, hips toward the motion, hands on the gun; every walking look on the shared clip set, the rolling one on none (${strafes.join('; ') || 'all'})`);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

/** Where the hands are DRAWN, on the grip page (`?mode=grips`): characters part 1. */
async function drawnHands(page) {
  // The palm checks above measure the joints. Where the hands are DRAWN (each hand's skin through its skeleton,
  // handProbe.ts): on the grip, the shooting hand's fingers along the barrel and its flat against the grip's side.
  // A Meshy hand sits on its joint its own way: the dapper's palm faced the camera and its edge the grip in every
  // view while the joint checks passed (owner, live 2026-10-31). The palm's side counts (`sideR` 1: the shooting palm
  // in against the grip; -1: its back there, palm out), and the support palm faces up, not down (`palmL`): some hands
  // were read back to front and turned onto the gun that way (owner, 2026-11-05).
  const badHand = (d, far = 0.09) => !d || d.r === null || d.r > far || d.aheadR < 0.6 || d.sideR < 0.6 || (d.palmL !== null && d.palmL < 0);
  const fmtHand = (d) => (d ? `${(d.r * 100).toFixed(0)} cm, along ${d.aheadR.toFixed(2)}, palm in ${d.sideR.toFixed(2)}, support palm ${d.palmL === null ? '-' : d.palmL.toFixed(2)}` : 'none');
  const drawnMisses = [];
  for (const look of ['core.dapper', 'core.biscuit', 'core.ranger', 'core.galloway']) {
    for (const weapon of ['core.pistol', 'core.rifle', 'core.grapple']) {
      for (const view of ['body', 'first', 'third']) {
        await page.evaluate(([l, w, v]) => window.__grips.pose(l, w, v), [look, weapon, view]);
        const pitches = view === 'body' && weapon !== 'core.grapple' ? [0, 1.45, -1.45] : [0];
        for (const pitch of pitches) {
          if (view === 'body') await page.evaluate((p) => window.__grips.look(p), pitch);
          const d = await page.evaluate(() => window.__grips.drawn());
          if (badHand(d)) drawnMisses.push(`${look} ${weapon} ${view}${pitch ? ` pitch ${pitch}` : ''}: ${fmtHand(d)}`);
        }
      }
    }
  }
  check(drawnMisses.length === 0, `hands are drawn on the grip, fingers along the gun, the shooting palm in against its side and the support palm up (${drawnMisses.join('; ') || 'all'})`);
  // Hands whose palms were read back to front (the thumb's first joint said the back of the hand): the Gnoll's paws
  // and Honest Abe's hands were turned onto the gun palm out (shooting) and palm down (support), owner 2026-11-05.
  const flipped = [];
  for (const look of ['core.hyena', 'core.abe']) {
    for (const weapon of ['core.rifle', 'core.pistol']) {
      for (const view of ['third', 'body']) {
        await page.evaluate(([l, w, v]) => window.__grips.pose(l, w, v), [look, weapon, view]);
        const d = await page.evaluate(() => window.__grips.drawn());
        if (!d || d.sideR < 0.6 || d.palmL === null || d.palmL < 0.3) flipped.push(`${look} ${weapon} ${view}: ${fmtHand(d)}`);
      }
    }
  }
  check(flipped.length === 0, `palms read the right way round: shooting palm in, support palm up (${flipped.join('; ') || 'the Gnoll and Honest Abe, rifle and pistol, third and first person'})`);
  // The Spear (a 2 m model held a third of the way back): the shooting hand drawn on the shaft, fingers along it,
  // in every view.
  const spearMisses = [];
  for (const view of ['first', 'body', 'third']) {
    await page.evaluate(([v]) => window.__grips.pose('core.ranger', 'core.spear', v), [view]);
    const d = await page.evaluate(() => window.__grips.drawn());
    if (badHand(d, 0.05)) spearMisses.push(`${view}: ${fmtHand(d)}`);
  }
  check(spearMisses.length === 0, `the Spear's hand is drawn on its shaft, fingers along it (${spearMisses.join('; ') || 'all within 5 cm'})`);
}

/**
 * Every character past its low-detail switch draws its whole body (owner, 2026-11-06: "I see enemy in distance not
 * fully there, only feet"). Over `frames` frames, each character in view (alive, not ragdolled) past its parts'
 * low-detail distance: every part's level of detail (getLOD) is the mesh the main pass draws, and its drawn body
 * (that level's vertices skinned as the GPU skins them, through its own skeleton) is numbers throughout; those in
 * `upright` (slots known to stand or run: riders sit, others may crouch) also stand near their full height (the
 * player's height times their size). Returns how many characters were checked and the first frame each failed on.
 */
async function wholeBodies(page, frames, upright = []) {
  return page.evaluate(
    async ([frames, fullHeight, upright]) => {
      const v = window.__cs.view;
      const sc = v.scene;
      const cam = v.camera;
      const proto = Object.getPrototypeOf(sc.meshes.find((m) => m.getClassName() === 'Mesh'));
      const render0 = proto.render;
      let main = false;
      const drawn = new Set();
      proto.render = function (...a) {
        if (main) drawn.add(this);
        return render0.apply(this, a);
      };
      const o1 = sc.onBeforeDrawPhaseObservable.add(() => {
        main = sc.activeCamera === cam;
        drawn.clear();
      });
      const o2 = sc.onAfterDrawPhaseObservable.add(() => (main = false));
      /** A level's vertices as drawn: through its skeleton's matrices and its world matrix (heights; non-numbers counted). */
      const skinned = (mesh) => {
        const pos = mesh.getVerticesData('position');
        const bi = mesh.getVerticesData('matricesIndices');
        const bw = mesh.getVerticesData('matricesWeights');
        const mats = mesh.skeleton?.getTransformMatrices(mesh);
        const wm = mesh.getWorldMatrix().m;
        let lo = Infinity;
        let hi = -Infinity;
        let bad = 0;
        for (let i = 0; i < pos.length / 3; i += 3) {
          let p = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
          if (mats && bi && bw) {
            const acc = [0, 0, 0];
            for (let k = 0; k < 4; k++) {
              const w = bw[i * 4 + k];
              if (!w) continue;
              const o = bi[i * 4 + k] * 16;
              for (let c = 0; c < 3; c++) acc[c] += w * (mats[o + c] * p[0] + mats[o + 4 + c] * p[1] + mats[o + 8 + c] * p[2] + mats[o + 12 + c]);
            }
            p = acc;
          }
          const y = wm[1] * p[0] + wm[5] * p[1] + wm[9] * p[2] + wm[13];
          if (!Number.isFinite(y)) {
            bad++;
            continue;
          }
          lo = Math.min(lo, y);
          hi = Math.max(hi, y);
        }
        return { lo, hi, bad };
      };
      const checked = new Set();
      const seen = new Set();
      const failed = new Map();
      await new Promise((resolve) => {
        let n = 0;
        const o3 = sc.onAfterRenderObservable.add(() => {
          const eye = cam.globalPosition;
          for (const [slot, a] of v.avatars) {
            const ch = a.anim?.ch;
            if (!ch || a.hiddenSelf || a.culled || a.ragdoll || !a.wasAlive || !a.root.isEnabled()) continue;
            seen.add(slot);
            const parts = ch.meshes.filter((m) => !m.isDisposed() && !m.isBlocked && m.getTotalVertices() > 0 && m.isEnabled() && m.isVisible);
            const lods = parts.flatMap((m) => m.getLODLevels?.() ?? []);
            const dist = Math.hypot(a.root.position.x - eye.x, a.root.position.z - eye.z);
            if (!lods.length || dist < Math.max(...lods.map((l) => l.distanceOrScreenCoverage)) + 1) continue;
            checked.add(slot);
            let lo = Infinity;
            let hi = -Infinity;
            let bad = 0;
            // The full-detail mesh in the same pose (the same skeleton): the height the drawn level should have.
            let lo0 = Infinity;
            let hi0 = -Infinity;
            const off = [];
            for (const m of parts) {
              const level = m.getLOD(cam);
              if (!level || !drawn.has(level)) {
                off.push(`${m.name}: ${level ? `${level.name} not drawn` : 'no level'}`);
                continue;
              }
              const b = skinned(level);
              lo = Math.min(lo, b.lo);
              hi = Math.max(hi, b.hi);
              bad += b.bad;
              const f = level === m ? b : skinned(m);
              lo0 = Math.min(lo0, f.lo);
              hi0 = Math.max(hi0, f.hi);
            }
            const spec = JSON.parse(a.specKey);
            const height = hi > lo ? hi - lo : 0;
            const want = fullHeight * (spec.size ?? 1);
            const full = hi0 > lo0 ? hi0 - lo0 : 0;
            // (`full`: the full-detail mesh in the same pose, for the message: Hyena Warrior's low-detail level is drawn
            // 1.5-1.8 m against its full detail's 2.1 m in the same pose, on CI; see HANDOFF.)
            if ((off.length || bad || (upright.includes(slot) && height < want * 0.75)) && !failed.has(slot)) {
              failed.set(slot, { slot, look: spec.look, dist: Math.round(dist), frame: n, height: +height.toFixed(2), want: +want.toFixed(2), full: +full.toFixed(2), nonNumbers: bad, off });
            }
          }
          if (++n >= frames) {
            sc.onAfterRenderObservable.remove(o3);
            resolve();
          }
        });
      });
      proto.render = render0;
      sc.onBeforeDrawPhaseObservable.remove(o1);
      sc.onAfterDrawPhaseObservable.remove(o2);
      return { checked: checked.size, seen: seen.size, failed: [...failed.values()] };
    },
    [frames, 1.8, upright],
  );
}

/**
 * Far characters drawn whole in a crowd's fight (owner, 2026-11-06: far enemies drawn as feet only). A crowd (26
 * bots: out of view its characters sleep, and wake when seen again), ten bots running small circles 16-34 m ahead
 * (past the crowd's low-detail switch, within reach of the shot and hit clips), each in a fight first: a shot and a
 * hit, the clips a fight keeps paused at weight 0 between plays. Then the view turns away (they sleep) and back (they
 * wake: those clips, restarted at weight 0, turned the blend of the upper body into NaN), and every character past its
 * low-detail switch must draw its whole body for a dozen frames.
 */
async function farBodies(browser) {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  await page.goto(`${CLIENT}/?offline=canyon&gamemode=core.deathmatch&bots=26&test=1&god=1`);
  await page.waitForFunction(() => window.__cs?.local?.alive && window.__cs.phase() === 'playing', null, { timeout: T(120000) });
  await page.click('#resume').catch(() => {});
  await simWait(page, (m) => m.combatants().filter((c) => c.kind === 'bot' && c.alive).length >= 20, null, T(30000));
  await holdBots(page);
  // Open ground from where you are: the first way with a clear eye-high sight line 36 m out and ground under the spots.
  const setup = await sim(page, (m, me) => {
    const p = me.move.pos;
    const ground = (x, z) => {
      const d = m.physics.raycastWorld({ x, y: p.y + 6, z }, { x: 0, y: -1, z: 0 }, 14);
      return d === null ? null : p.y + 6 - d;
    };
    for (let k = 0; k < 16; k++) {
      const yaw = (k / 16) * Math.PI * 2;
      const at = (r, side = 0) => ({ x: p.x + Math.sin(yaw) * r + Math.cos(yaw) * side, z: p.z + Math.cos(yaw) * r - Math.sin(yaw) * side });
      const far = at(36);
      if (!m.physics.lineOfSight({ x: p.x, y: p.y + 1.6, z: p.z }, { x: far.x, y: p.y + 1.6, z: far.z })) continue;
      const spots = [];
      for (let i = 0; i < 10; i++) {
        const q = at(16 + i * 2, ((i % 5) - 2) * 3);
        const g = ground(q.x, q.z);
        if (g === null || Math.abs(g - p.y) > 2.5) break;
        spots.push({ x: q.x, y: g + 0.05, z: q.z });
      }
      if (spots.length < 10) continue;
      const bots = m.combatants().filter((c) => c.kind === 'bot' && c.alive).slice(0, 10);
      const held = bots.map((c, i) => [c, spots[i], i]);
      clearInterval(globalThis.__farHold);
      // Each runs a small circle where it stands (about running speed; standing still while __farStand), and stays alive.
      globalThis.__farStand = false;
      globalThis.__farHold = setInterval(() => {
        const t = performance.now() / 1000;
        for (const [c, s, i] of held) {
          if (!c.alive) continue;
          const a = globalThis.__farStand ? i : t * 2.6 + i;
          c.move = { ...c.move, pos: { x: s.x + Math.cos(a) * 2, y: s.y, z: s.z + Math.sin(a) * 2 }, velY: 0, grounded: true };
          c.health = Math.max(c.health, 100);
        }
      }, 5);
      return { yaw, slots: bots.map((c) => c.slot), from: { x: p.x, y: p.y, z: p.z } };
    }
    return null;
  });
  if (!setup) {
    check(false, 'far bodies: found open ground 36 m out for the crowd');
    await page.context().close();
    return;
  }
  await page.evaluate((yaw) => {
    window.__cs.input.yaw = yaw;
    window.__cs.input.pitch = -0.05;
  }, setup.yaw);
  // Their characters loaded, in view and running there.
  const running = () =>
    page.evaluate((slots) => {
      const v = window.__cs.view;
      return slots.filter((s) => {
        const a = v.avatars.get(s);
        return !!a?.anim?.ch && !a.culled && a.anim.current === 'run';
      }).length;
    }, setup.slots);
  await until(async () => (await running()) >= 8, T(120000));
  // A fight: a shot and a hit on each (the clips kept paused at weight 0 between plays), until both are over.
  await page.evaluate((slots) => {
    const v = window.__cs.view;
    for (const s of slots) {
      v.avatarAction(s, 'shoot');
      v.flinchPlayer(s, { x: 1, y: 0, z: 0 }, 0, 2);
    }
  }, setup.slots);
  await page.waitForFunction((slots) => slots.every((s) => !window.__cs.view.avatars.get(s)?.anim?.overlay), setup.slots, { timeout: T(20000) }).catch(() => {});
  // A pause and off again, as fighters stop and go: their running clips start again after the fight's (later in the
  // engine's order), and at full run the aim pose's upper-body clip is at weight 0.
  const gait = (want) =>
    page.evaluate(
      ([slots, want]) =>
        slots.filter((s) => {
          const anim = window.__cs.view.avatars.get(s)?.anim;
          return !!anim && (want === 'stand' ? anim.current !== 'run' && anim.clipUpper < 0.001 : anim.current === 'run' && anim.clipUpper > 0.999);
        }).length,
      [setup.slots, want],
    );
  await sim(page, () => (globalThis.__farStand = true));
  await until(async () => (await gait('stand')) >= 8, T(30000));
  await sim(page, () => (globalThis.__farStand = false));
  await until(async () => (await gait('run')) >= 8, T(30000));
  // Away (out of view a crowd's characters sleep) and back (they wake).
  await page.evaluate((yaw) => (window.__cs.input.yaw = yaw + Math.PI), setup.yaw);
  await page.waitForFunction((slots) => slots.every((s) => window.__cs.view.avatars.get(s)?.culled !== false), setup.slots, { timeout: T(30000) }).catch(() => {});
  const slept = await page.evaluate((slots) => slots.filter((s) => window.__cs.view.avatars.get(s)?.anim?.dormant).length, setup.slots);
  await page.evaluate((yaw) => (window.__cs.input.yaw = yaw), setup.yaw);
  await page.waitForFunction((slots) => slots.filter((s) => window.__cs.view.avatars.get(s)?.culled === false).length >= 8, setup.slots, { timeout: T(60000) }).catch(() => {});
  const back = await page.evaluate((slots) => slots.filter((s) => window.__cs.view.avatars.get(s)?.culled === false).length, setup.slots);
  const r = await wholeBodies(page, 12, setup.slots);
  const broken = r.failed.map((f) => `${f.look} at ${f.dist} m, frame ${f.frame}: ${f.height} of ${f.want} m drawn (full detail in that pose: ${f.full} m)${f.nonNumbers ? `, ${f.nonNumbers} vertices not numbers` : ''}${f.off.length ? `, ${f.off.join(', ')}` : ''}`);
  // (For a failure: where you are now against where the crowd was set out from, and whether you are alive.)
  if (r.failed.length) broken.push(`you ${await sim(page, (m, me, from) => `${Math.hypot(me.move.pos.x - from.x, me.move.pos.z - from.z).toFixed(1)} m from the setup, ${me.alive ? 'alive' : 'dead'}, ${me.deaths} deaths`, setup.from)}`);
  check(slept >= 8 && back >= 8 && r.checked >= 6 && r.failed.length === 0, `far characters draw their whole bodies after a fight, asleep out of view and awake again (${slept} slept, ${back} back in view, ${r.checked} checked past the low-detail switch of ${r.seen} seen; broken: ${broken.join('; ') || 'none'})`);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

/**
 * Grips in a real match, played as the owner plays (his report, live 2026-10-31: "the grips are not working at
 * all"): full-body first person (the default) with the dapper on a normal map with a dozen bots, switching weapons
 * by number keys and the wheel, a new gun handed over, death and respawn, third person and back, looking up and
 * down; the bots' hands near and far; the grapple's rope from the launcher's muzzle; and a creature skin's gun.
 */
async function gripsInPlay(browser) {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  const badHand = (d) => !d || d.r === null || d.r > 0.09 || d.aheadR < 0.6 || d.sideR < 0.6 || (d.palmL !== null && d.palmL < 0);
  const fmt = (d) => (d ? `${d.mode ?? ''} ${(d.r * 100).toFixed(0)} cm, along ${d.aheadR.toFixed(2)}, palm in ${d.sideR.toFixed(2)}, support palm ${d.palmL === null ? '-' : d.palmL.toFixed(2)}` : 'no hands on a gun');
  // Your own hands, measured once the switch has settled (a few tries: the gun comes up over a quarter second).
  const own = async () => {
    let d = null;
    for (let i = 0; i < 12; i++) {
      d = await page.evaluate(() => window.__cs.view.gripReport().local);
      if (!badHand(d)) return d;
      await sleep(250);
    }
    return d;
  };
  await page.goto(`${CLIENT}/?offline=canyon&gamemode=core.deathmatch&bots=12&look=core.dapper&test=1&god=1`);
  await page.waitForFunction(() => window.__cs?.local?.alive && window.__cs.phase() === 'playing' && window.__cs.view.gripReport().local, null, { timeout: T(120000) });
  await page.click('#resume').catch(() => {});
  const misses = [];
  const step = async (label, act) => {
    await act();
    await sleep(300);
    const d = await own();
    if (badHand(d)) misses.push(`${label} (${await page.evaluate(() => window.__cs.view.viewWeapon)}): ${fmt(d)}`);
    return d;
  };
  await step('spawn', async () => {});
  await page.evaluate(() => window.__give('core.rifle'));
  await step('switch to the rifle (number key)', () => page.keyboard.press('Digit3'));
  await step('back to the pistol (number key)', () => page.keyboard.press('Digit2'));
  await step('mouse wheel', () => page.mouse.wheel(0, 120));
  await step('wheel back', () => page.mouse.wheel(0, -120));
  await step('rifle again', () => page.keyboard.press('Digit3'));
  await step('looking up', () => page.evaluate(() => (window.__cs.input.pitch = 1.45)));
  await step('looking down', () => page.evaluate(() => (window.__cs.input.pitch = -1.45)));
  await page.evaluate(() => (window.__cs.input.pitch = 0));
  await step('third person and back', async () => {
    await page.keyboard.press('KeyH');
    await sleep(800);
    await page.keyboard.press('KeyH');
  });
  await step('respawn', async () => {
    await sim(page, (m, me) => m.kill(me, null, 'core.respawn'));
    await page.waitForFunction(() => !window.__cs.local.alive, null, { timeout: T(10000) }).catch(() => {});
    await page.waitForFunction(() => window.__cs.local.alive, null, { timeout: T(30000) });
    await page.click('#resume').catch(() => {});
  });
  check(misses.length === 0, `in a match, your own hands are drawn on the gun through switches, looking up and down, third person and a respawn (${misses.join('; ') || 'all'})`);
  // Scoped when the gun's sharper held copy comes in (Medium and High fetch it once you hold the gun; on a big map that
  // can land while you are already looking through the scope, or in third person): the gun is back in your hands when
  // the scope comes down (owner, 2026-11-07: Count Bonesworth's gun vanished after a sniper on a St. John's roof; the
  // copy took "off" from the view's root, switched off while scoped).
  // The give puts the marksman in your hands itself (matchHost.give sets it current). The view draws it a frame or
  // more later: pressing 3 while only the view lagged cycled on to the rifle (the same slot), and on a 1-2 fps CI page
  // the presses kept landing between the switch and its frame, ending on the rifle. So wait for the held gun, and
  // press 3 only while it isn't the marksman, each time until that press has taken.
  // (What you held, as it changed from here to the scope coming down: for the message if the gun is the wrong one.)
  await page.evaluate(() => {
    window.__heldTrace = [];
    let last = '';
    const t0 = performance.now();
    window.__heldIv = setInterval(() => {
      const asked = [...new Set((window.__cs.local.pending ?? []).map((i) => i.weapon).filter(Boolean))].join('+');
      const now = `${window.__cs.local.weapon?.id?.replace('core.', '')}/${window.__cs.view.viewWeapon?.replace('core.', '')}${window.__cs.local.alive ? '' : ' dead'}${asked ? ` asked ${asked}` : ''}${window.__cs.input.wheelOpen ? ' wheel' : ''} held#${window.__cs.local.held}`;
      if (now !== last) window.__heldTrace.push(`${((performance.now() - t0) / 1000).toFixed(1)}s ${(last = now)}`);
    }, 50);
  });
  await page.evaluate(() => window.__give('core.marksman'));
  await page.waitForFunction(() => window.__cs.local.weapon?.id === 'core.marksman', null, { timeout: T(10000) }).catch(() => {});
  for (let i = 0; i < 4; i++) {
    const held = await page.evaluate(() => window.__cs.local.weapon?.id);
    if (held === 'core.marksman') break;
    await page.keyboard.press('Digit3');
    await page.waitForFunction((was) => window.__cs.local.weapon?.id !== was, held, { timeout: T(10000) }).catch(() => {});
  }
  await page.waitForFunction(() => window.__cs.view.viewWeapon === 'core.marksman' && window.__cs.view.viewmodel && window.__cs.local.raiseTicks === 0, null, { timeout: T(20000) }).catch(() => {});
  await page.evaluate(() => (window.__autoInput = { zoom: true }));
  const scopedIn = await page.waitForFunction(() => window.__cs.view.camera.fov < 0.8, null, { timeout: T(20000) }).then(() => true, () => false);
  const swapped = await page.evaluate(
    () =>
      new Promise((done) => {
        const v = window.__cs.view;
        const def = window.__cs.local.weapon;
        const kept = v.viewmodels.get(def.id);
        const was = kept?.node;
        if (!kept || !def.view.held) return done(false);
        v.sharpenViewmodel(def, kept, def.view.held.medium);
        const t0 = performance.now();
        const poll = () => (kept.node !== was ? done(true) : performance.now() - t0 > 20000 ? done(false) : setTimeout(poll, 50));
        poll();
      }),
  );
  await page.evaluate(() => (window.__autoInput = { zoom: false }));
  await page.waitForFunction(() => window.__cs.view.camera.fov > 1.2, null, { timeout: T(20000) }).catch(() => {});
  await page.evaluate(() => delete window.__autoInput);
  await sleep(500);
  const back = await page.evaluate(() => {
    const v = window.__cs.view;
    const vm = v.viewmodel;
    const drawn = v.drawnByCamera();
    return { weapon: v.viewWeapon, on: !!vm && vm.isEnabled(), drawn: !!vm && vm.getChildMeshes().some((m) => drawn.has(m)) };
  });
  const scopeHand = await own();
  const heldTrace = await page.evaluate(() => (clearInterval(window.__heldIv), window.__heldTrace.join(', ')));
  check(scopedIn && swapped && back.on && back.drawn && !badHand(scopeHand), `the gun is back in your hands after the scope, its sharper copy having come in while scoped (scoped ${scopedIn}, copy in ${swapped}, ${JSON.stringify(back)}, ${fmt(scopeHand)}${back.weapon === 'core.marksman' ? '' : `; held/drawn: ${heldTrace}`})`);
  const body = await page.evaluate(() => window.__cs.view.gripReport().local?.mode);
  check(body === 'body', `the match draws your whole body in first person (${body})`);
  // Bots near and far (animation LOD, the low-detail mesh past 18 m): their drawn hands on their guns. Only bots
  // in view are drawn (and so measured): turn round until several have been (a respawn can face a wall, and on a
  // slow page the bots may still be loading their guns), each measured as last seen.
  const seen = new Map();
  const lookUntil = Date.now() + T(60000);
  for (let turn = 0; seen.size < 4 && Date.now() < lookUntil; turn++) {
    for (const x of await page.evaluate(() => window.__cs.view.gripReport().remote.map((x) => ({ slot: x.slot, dist: Math.round(x.dist), r: x.r, aheadR: x.aheadR, sideR: x.sideR })))) seen.set(x.slot, x);
    if (seen.size >= 4) break;
    await page.evaluate(() => (window.__cs.input.yaw += 0.8));
    await sleep(1500);
  }
  const bots = [...seen.values()];
  const badBots = bots.filter((b) => b.r === null || b.r > 0.12);
  check(bots.length > 0 && badBots.length <= Math.floor(bots.length / 4), `bots' hands are drawn on their guns near and far (${bots.length - badBots.length} of ${bots.length}; off: ${badBots.map((b) => `${b.slot} at ${b.dist} m: ${b.r === null ? '-' : (b.r * 100).toFixed(0)} cm`).join(', ') || 'none'})`);
  // The grapple's rope leaves the launcher's muzzle (it used to start under the eye, out of your chest).
  await page.evaluate(() => window.__give('core.grapple'));
  for (let i = 0; i < 4 && (await page.evaluate(() => window.__cs.view.viewWeapon)) !== 'core.grapple'; i++) {
    await page.keyboard.press('Digit1');
    await sleep(600);
  }
  await sleep(500);
  await sim(page, (m, me) => {
    const p = me.move.pos;
    const yaw = me.yaw ?? 0;
    m.fireGrapple(me, { x: p.x, y: p.y + 1.6, z: p.z }, { x: Math.sin(yaw) * 0.5, y: -0.866, z: Math.cos(yaw) * 0.5 }, { id: 'core.grapple', range: 32 }, 17);
  });
  await page.waitForFunction(() => window.__cs.view.lastRope, null, { timeout: T(5000) }).catch(() => {});
  const rope = await page.evaluate(() => window.__cs.view.lastRope);
  check(!!rope?.muzzle, `the grapple's rope starts at the launcher's muzzle (${JSON.stringify(rope)})`);
  check(errors.length === 0, `no page errors in play (${errors.join('; ')})`);
  await page.context().close();

  // A creature skin (the Imp) in third person: the gun forward along the aim at chest height, both hands on it.
  const imp = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  await imp.goto(`${CLIENT}/?offline=training_range&test=1&god=1&look=npc:imp`);
  await imp.waitForFunction(() => window.__cs?.local?.alive && window.__cs.phase() === 'playing', null, { timeout: T(120000) });
  // Into play and third person, for sure: on a slow page the pause menu can come up after a first click on Resume
  // (and then H does nothing), and a third-person camera pulled in against a wall doesn't draw your body: turn away.
  for (let i = 0; i < 12; i++) {
    if (await imp.isVisible('#resume')) await imp.click('#resume').catch(() => {});
    const state = await imp.evaluate(() => {
      const a = window.__cs.view.avatars.get(window.__cs.slot);
      return { third: window.__cs.thirdPerson(), drawn: !!a && !a.hiddenSelf && a.root.isEnabled() };
    });
    if (state.third && state.drawn) break;
    if (!state.third) await imp.keyboard.press('KeyH');
    else await imp.evaluate(() => (window.__cs.input.yaw += 1.2));
    await sleep(1000);
  }
  const held = [];
  for (const w of ['core.pistol', 'core.rifle']) {
    await imp.evaluate((id) => window.__give(id), w);
    // Until the given gun is in the drawn creature's hands (a gun model loads first; slow on a software-rendered page).
    await imp
      .waitForFunction(() => {
        const a = window.__cs.view.avatars.get(window.__cs.slot);
        return a?.weaponSlot === window.__cs.local.held && !!window.__cs.view.gripReport().creatures.find((c) => c.slot === window.__cs.slot)?.report;
      }, null, { timeout: T(30000), polling: 250 })
      .catch(() => {});
    let r = null;
    for (let i = 0; i < 20; i++) {
      await sleep(300);
      r = await imp.evaluate((s) => window.__cs.view.gripReport().creatures.find((c) => c.slot === s)?.report ?? null, await imp.evaluate(() => window.__cs.slot));
      if (r && r.facing > 0.8 && r.height > 0.9 && r.r !== null && r.r < 0.12) break;
    }
    held.push({ w, ok: !!r && r.facing > 0.8 && r.height > 0.9 && r.r !== null && r.r < 0.12, r: r && { facing: +r.facing.toFixed(2), height: +r.height.toFixed(2), hand: r.r === null ? null : +r.r.toFixed(3) } });
  }
  check(held.every((h) => h.ok), `an Imp player holds the gun forward at the chest with a hand on its grip (${JSON.stringify(held)})`);
  await imp.screenshot({ path: `${ARTIFACTS}/grips-imp-third.png` });
  await imp.context().close();
}

async function onlineFlow(browser) {
  const open = async (name) => {
    const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
    await page.goto(`${CLIENT}/?autojoin&name=${name}&server=ws://localhost:${SERVER_PORT}`);
    await page.waitForFunction(() => window.__cs?.local, null, { timeout: T(30000) });
    return { page, errors };
  };
  const a = await open('Alice');
  const b = await open('Bob');
  const slots = [await a.page.evaluate(() => window.__cs.slot), await b.page.evaluate(() => window.__cs.slot)];
  check(slots[0] !== slots[1], `two online clients get distinct slots (${slots})`);
  await a.page.waitForTimeout(1500); // wait-ok: 1.5 s of snapshots, and the player must not have fallen through
  const alive = await a.page.evaluate(() => window.__cs.local.state.pos.y > -1);
  check(alive, 'client receives snapshots and reconciles its position');
  check(a.errors.length + b.errors.length === 0, `no page errors (${[...a.errors, ...b.errors].join('; ')})`);
  // Two live matches left running would slow every flow after this one.
  await a.page.context().close();
  await b.page.context().close();
}

/** Community hub: a host lists its match in the game browser and a stranger joins from the list. */
async function lobbyFlow(browser) {
  // A community hub: broker + game browser. A host lists its match; a player finds it and joins from the list.
  const HUB_PORT = +(process.env.E2E_HUB_PORT ?? 9078);
  start('pnpm', ['--filter', '@tiletrigger/server', 'hub'], { PORT: String(HUB_PORT), HOST: '127.0.0.1', TURN_SECRET: 'e2e-secret', TURN_URLS: 'turn:127.0.0.1:3478' });
  await sleep(5000);
  const hub = `hub=127.0.0.1:${HUB_PORT}`;
  const errors = [];
  const host = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
  host.on('pageerror', (e) => errors.push(`host: ${e.message}`));
  await host.addInitScript(() => localStorage.setItem('cs.name', 'Hosty'));
  await host.goto(`${CLIENT}/?offline=sandgate&${hub}`, { waitUntil: 'domcontentloaded' });
  await host.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() !== 'waiting' && window.__cs.phase() !== 'countdown', null, { timeout: T(60000) });
  const offered = await host.evaluate(() => !document.getElementById('host-public').hidden);
  check(offered, 'hosting offers "List in the game browser" when a hub is set');
  await host.evaluate(() => {
    document.getElementById('host-name').value = 'E2E Friday Night';
    const box = document.getElementById('host-list');
    box.checked = true;
    box.dispatchEvent(new Event('change'));
  });
  // Press Host (again, if a slow first press got no answer) until the match is listed.
  let listed = false;
  for (let i = 0; i < 3 && !listed; i++) {
    await host.evaluate(() => document.getElementById('host-game').click());
    listed = await host.waitForFunction(() => /^Listed:/.test(document.getElementById('host-public-status').textContent), null, { timeout: T(20000) }).then(() => true, () => false);
  }
  check(listed, `the host's match is listed (${await host.evaluate(() => document.getElementById('host-public-status').textContent)})`);
  const hostCode = await host.evaluate(() => document.querySelector('#host-info .host-code b')?.textContent ?? '');
  // The host's check-ins with the hub (hub.ts LobbyAdvertiser: every LOBBY_HEARTBEAT_SECONDS, with fresh counts).
  let checkins = 0;
  host.on('requestfinished', (r) => r.method() === 'PUT' && /\/lobby\/games\/[\w-]+$/.test(r.url()) && checkins++);
  const relayNote = await host.evaluate(() => document.getElementById('host-info').textContent);
  check(relayNote.includes('hub provides a relay'), 'the hub hands out relay credentials, and the host is told');
  const player = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  player.on('pageerror', (e) => errors.push(`player: ${e.message}`));
  await player.addInitScript(() => localStorage.setItem('cs.name', 'Stranger'));
  await player.goto(`${CLIENT}/?${hub}`, { waitUntil: 'domcontentloaded' });
  await player.waitForFunction(() => window.__front, null, { timeout: T(30000) });
  await player.evaluate(() => document.getElementById('nav-online')?.click());
  // (The game browser refreshes every 10 s; a page drawing slowly beside a Sandgate host can miss the first.)
  const row = await player.waitForFunction(() => [...document.querySelectorAll('.gb-row:not(.gb-head)')].map((r) => r.textContent).find((t) => t.includes('E2E Friday Night')) ?? null, null, { timeout: T(45000) }).then((h) => h.jsonValue(), () => null);
  check(!!row && row.includes('1/') && row.includes('Hosty') && row.includes('Relay'), `the game browser lists it, with the relay badge (${row})`);
  await player.evaluate(() => [...document.querySelectorAll('.gb-row:not(.gb-head)')].find((r) => r.textContent.includes('E2E Friday Night')).querySelector('button').click());
  // Joining loads Sandgate (heavy since its rework): on a loaded machine that alone can take a minute or more.
  const joined = await player.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() !== 'waiting' && window.__cs.phase() !== 'countdown', null, { timeout: T(150000) }).then(() => true, () => false);
  check(joined, 'joining from the game browser puts the player in the match');
  const lobbyGames = () => player.evaluate(() => fetch(`http://${new URLSearchParams(location.search).get('hub')}/lobby/games`).then((r) => r.json()).then((d) => JSON.stringify(d.games?.map((g) => [g.name, g.code, g.players]) ?? d))).catch((e) => e.message);
  if (joined) {
    // The host's next check-in reports two players. Its timer runs on the host's page, which on a heavy map and a
    // loaded machine fires late: wait for the check-ins themselves, not a time. Two finished after the join (the
    // first may have been sent before the host counted the player), then the listing must say 2.
    // (The hub is read only as a check-in lands: every page and this runner share one address's read budget.)
    // The listing is also read every 5 s (well inside the hub's read budget): CI's run of 4 Nov counted no check-ins
    // from the host's page for the whole 9-min wait, while the listing already said 2.
    const from = checkins;
    let seen = from;
    let readAt = Date.now();
    const twoNow = async () => ((await hubGames(HUB_PORT)) ?? []).find((g) => g.name === 'E2E Friday Night')?.players === 2;
    await until(async () => {
      if (checkins === seen) {
        if (Date.now() - readAt < 5000) return false;
        readAt = Date.now();
        return twoNow();
      }
      seen = checkins;
      readAt = Date.now();
      return (await twoNow()) || checkins >= from + 2;
    }, T(180000));
    const two = await hubUntil(twoNow, 3000);
    check(two, `the listing updates to 2 players${two ? '' : ` (${checkins - from} check-ins since the join: ${await lobbyGames()})`}`);
  }
  await host.context().close();
  // The host's listing goes (the player may carry the match on under a listing of their own: host handoff).
  const gone = await player.waitForFunction((c) => fetch(`http://${new URLSearchParams(location.search).get('hub')}/lobby/games`).then((r) => r.json()).then((d) => !!d.games && !d.games.some((g) => g.name === 'E2E Friday Night' && g.code === c)), hostCode, { timeout: T(15000), polling: 1000 }).then(() => true, () => false);
  check(gone, `the host's listing goes away when the host closes the game${gone ? '' : ` (${hostCode}: ${await lobbyGames()})`}`);
  await player.context().close();

  // Offline by default; "Go online" restarts the match and lists it; "Go offline" takes it down again.
  const solo = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
  solo.on('pageerror', (e) => errors.push(`solo: ${e.message}`));
  await solo.addInitScript(() => localStorage.setItem('cs.name', 'Solo'));
  await solo.goto(`${CLIENT}/?offline=sandgate&${hub}`, { waitUntil: 'domcontentloaded' });
  await solo.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() !== 'waiting' && window.__cs.phase() !== 'countdown', null, { timeout: T(60000) });
  const offline = await solo.evaluate(() => ({ online: !document.getElementById('pause-online-switch').hidden && document.getElementById('go-offline').classList.contains('on'), badge: !!window.__cs.hud.onlineNote }));
  check(offline.online && !offline.badge, 'an offline match stays offline, and the Host tab offers Offline / Host online');
  const listedAs = (name) => solo.evaluate((n) => fetch(`http://${new URLSearchParams(location.search).get('hub')}/lobby/games`).then((r) => r.json()).then((d) => !!d.games?.some((g) => g.name === n)), name);
  await sim(solo, (m) => void (m.combatants().find((c) => c.kind === 'human').kills = 5));
  await solo.evaluate(() => {
    document.getElementById('host-name').value = 'E2E Go Online';
    document.getElementById('go-online').click();
  });
  const asked = await solo.evaluate(() => document.getElementById('online-confirm')?.textContent ?? '');
  check(/restarts/.test(asked) && /listed publicly/.test(asked), 'Go online asks first: the match restarts and is listed');
  await solo.evaluate(() => document.getElementById('online-yes').click());
  const reset = await sim(solo, (m) => m.combatants().find((c) => c.kind === 'human').kills);
  check(reset === 0, `going online restarts the match (score ${reset})`);
  const up = await solo.waitForFunction(() => /^Online · listed/.test(window.__cs.hud.onlineNote ?? ''), null, { timeout: T(60000) }).then(() => true, () => false);
  const badge = await solo.evaluate(() => window.__cs.hud.onlineNote ?? '');
  check(up && (await listedAs('E2E Go Online')), `the match is online and in the game browser (${badge})`);
  await solo.evaluate(() => document.getElementById('go-offline').click());
  const down = await solo.waitForFunction(() => fetch(`http://${new URLSearchParams(location.search).get('hub')}/lobby/games`).then((r) => r.json()).then((d) => !!d.games && !d.games.some((g) => g.name === 'E2E Go Online')), null, { timeout: T(15000), polling: 1000 }).then(() => true, () => false);
  const after = await solo.evaluate(() => ({ badge: !!window.__cs.hud.onlineNote, online: document.getElementById('go-offline').classList.contains('on') && !document.getElementById('go-online').classList.contains('on') }));
  check(down && !after.badge && after.online, 'Offline removes the listing and the online line');
  await solo.context().close();

  // Match setup's Host online is the Host tab's (owner, 2026-11-06): the match starts online, listed in the game
  // browser, and the join code still shows.
  const setupHost = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  setupHost.on('pageerror', (e) => errors.push(`setup host: ${e.message}`));
  await setupHost.addInitScript(() => {
    localStorage.setItem('cs.name', 'Setup Host');
    localStorage.setItem('cs.arcade', JSON.stringify({ map: 'sandgate', mode: 'core.tdm', bots: 3, skill: 'easy', scoreLimit: 40, minutes: 10, teams: [2, 2] }));
  });
  await setupHost.goto(`${CLIENT}/?${hub}`, { waitUntil: 'domcontentloaded' });
  await setupHost.waitForFunction(() => window.__front, null, { timeout: T(30000) });
  await setupHost.evaluate(() => document.getElementById('nav-play').click());
  await setupHost.waitForSelector('#arcade-host', { timeout: T(30000) });
  await setupHost.evaluate(() => document.getElementById('arcade-host').click());
  const foot = await setupHost.evaluate(() => ({ on: document.getElementById('arcade-host').classList.contains('on'), note: document.getElementById('arcade-online-note')?.textContent ?? '' }));
  check(foot.on && /listed in the game browser/.test(foot.note), `Match setup's Host online says the match is listed (${JSON.stringify(foot)})`);
  await setupHost.evaluate(() => document.getElementById('arcade-start').click());
  const setupListed = await hubUntil(async () => ((await hubGames(HUB_PORT)) ?? []).some((g) => g.host === 'Setup Host'), T(120000));
  const online = await setupHost.waitForFunction(() => /^Online · listed/.test(window.__cs?.hud?.onlineNote ?? '') && /[A-Z0-9]{6}/.test(document.querySelector('#host-info .host-code b')?.textContent ?? ''), null, { timeout: T(60000) }).then(() => true, () => false);
  const setupState = await setupHost.evaluate(() => ({ badge: window.__cs?.hud?.onlineNote ?? '', code: document.querySelector('#host-info .host-code b')?.textContent ?? '', status: document.getElementById('host-public-status')?.textContent ?? '' }));
  check(setupListed && online, `Host online from Match setup lists the match in the game browser, the join code showing (${JSON.stringify({ ...setupState, games: (await hubGames(HUB_PORT))?.map((g) => [g.name, g.host]) })})`);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await setupHost.context().close();
}

/** A Host Service (packages/host) on a local hub: started as the owner would (`pnpm host`), with its own state folder. */
async function startHostService({ hubPort, controlPort, env = {}, idle = false }) {
  const state = mkdtempSync(join(tmpdir(), 'tt-host-e2e-'));
  start('pnpm', ['--silent', '--filter', '@tiletrigger/host', 'start', ...(idle ? ['--', '--idle'] : [])], {
    HUB: `http://127.0.0.1:${hubPort}`,
    CONTROL_PORT: String(controlPort),
    HOST_STATE_DIR: state,
    STATUS_EVERY: '0',
    // (Its match stays on its map: no vote between matches.)
    MAP_VOTE: '0',
    ...env,
  });
  return state;
}

/** Listings on a local hub (node side). */
/**
 * The hub's game list (none while it says "slow down": it allows a burst of 60 reads per address, then 2 a second).
 * Polls of it wait a second between reads (hubUntil): polling every 100 ms used up the burst when the host took a few
 * seconds to list itself on a slow CI machine, and the next read came back with no list.
 */
/** null while the hub says "slow down" (or can't be reached). */
const hubGames = (port) => fetch(`http://127.0.0.1:${port}/lobby/games`).then((r) => r.json()).then((d) => d.games ?? null, () => null);
async function hubUntil(pred, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await pred().catch(() => false)) return true;
    await sleep(1000);
  }
  return false;
}

/**
 * Dedicated host (Host Service): a headless host registers on a local hub and lists itself; a player
 * joins it from the game browser exactly like a player-hosted game (no install, no prompt), sees bots,
 * moves and gets snapshots; an admin joined by code kicks another player from the pause menu.
 */
async function dedicatedhostFlow(browser) {
  const HUB_PORT = +(process.env.E2E_DEDICATED_HUB_PORT ?? 9079);
  const CONTROL_PORT = +(process.env.E2E_DEDICATED_CONTROL_PORT ?? 7801);
  start('pnpm', ['--filter', '@tiletrigger/server', 'hub'], { PORT: String(HUB_PORT), HOST: '127.0.0.1', TURN_SECRET: 'e2e-secret', TURN_URLS: 'turn:127.0.0.1:3478', LAN_DISCOVERY: '0' });
  await waitForHttp(`http://127.0.0.1:${HUB_PORT}/lobby/health`, T(30000));
  // AFK_SECONDS 0: no idle takeover. The test's players sit still for minutes on a slow runner (the visitor after
  // its walk, the owner in the pause menu); after 90 s a bot played for each, the roster called them bots, and the
  // admin's player list (people only) lost the visitor's Kick button mid-check. The idle rules have unit tests.
  const hostState = await startHostService({ hubPort: HUB_PORT, controlPort: CONTROL_PORT, env: { MAP: 'sandgate', MODE: 'core.tdm', BOT_FILL: '8', SERVER_NAME: 'E2E Dedicated', ADMIN_TOKEN: 'e2e-admin-token', AFK_SECONDS: '0' } });
  const listed = await hubUntil(async () => ((await hubGames(HUB_PORT)) ?? []).some((g) => g.name === 'E2E Dedicated'), T(60000));
  check(listed, 'the Host Service registers on the hub and lists itself');
  if (!listed) return;
  const game = ((await hubGames(HUB_PORT)) ?? []).find((g) => g.name === 'E2E Dedicated') ?? {};
  check(game.hostType === 'dedicated' && game.relay && !game.community && game.mapId === 'sandgate', `listed as a dedicated host with a relay, on our map (${JSON.stringify(game)})`);

  const hub = `hub=127.0.0.1:${HUB_PORT}`;
  const errors = [];
  const probes = [];
  // The pages' warnings, and the Host Service's log, for a failed check about who is in the match.
  const consoleLines = [];
  const began = Date.now();
  const hostLog = () => { try { return readFileSync(join(hostState, 'logs', 'host.log'), 'utf8').split('\n').filter(Boolean).slice(-8).join(' / ').slice(0, 600); } catch { return 'none'; } };
  const whoSaw = () => ` [console: ${consoleLines.slice(-6).join(' / ')}; host log: ${hostLog()}]`;
  const open = async (name, url) => {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
    page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
    page.on('console', (m) => (m.type() === 'warning' || m.type() === 'error') && consoleLines.push(`${((Date.now() - began) / 1000).toFixed(0)} ${name}: ${m.text().slice(0, 160)}`));
    page.on('response', (r) => r.status() >= 400 && consoleLines.push(`${((Date.now() - began) / 1000).toFixed(0)} ${name}: ${r.status()} ${r.url().slice(0, 120)}`));
    page.on('requestfailed', (r) => consoleLines.push(`${((Date.now() - began) / 1000).toFixed(0)} ${name}: ${r.failure()?.errorText ?? 'failed'} ${r.url().slice(0, 120)}`));
    // Nothing but /host may look for a Host Service on this computer.
    page.on('request', (r) => /127\.0\.0\.1:(7797|7801|7802)/.test(r.url()) && probes.push(r.url()));
    await page.addInitScript((n) => localStorage.setItem('cs.name', n), name);
    // Each caller waits for what it needs next (the menu, or play). Loading the page's scripts beside a Sandgate match
    // on a loaded machine outran Playwright's 30 s, then even a minute: that wait has its own room.
    await page.goto(url, { waitUntil: 'commit', timeout: T(60000) });
    return page;
  };
  const playing = () => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() !== 'waiting' && window.__cs.phase() !== 'countdown';

  // A player finds it in the game browser and joins from there.
  const player = await open('Visitor', `${CLIENT}/?${hub}`);
  await player.waitForFunction(() => window.__front, null, { timeout: T(90000) });
  await player.evaluate(() => document.getElementById('nav-online')?.click());
  const row = await player.waitForFunction(() => [...document.querySelectorAll('.gb-row:not(.gb-head)')].map((r) => r.textContent).find((t) => t.includes('E2E Dedicated')) ?? null, null, { timeout: T(30000) }).then((h) => h.jsonValue(), () => null);
  check(!!row && row.includes('Dedicated host') && !row.includes('Player-hosted'), `the game browser shows it as a Dedicated host (${row})`);
  await player.evaluate(() => [...document.querySelectorAll('.gb-row:not(.gb-head)')].find((r) => r.textContent.includes('E2E Dedicated')).querySelector('button').click());
  // Joining loads Sandgate (heavy since its rework): on a loaded machine that alone can take a minute or more.
  const joined = await player.waitForFunction(playing, null, { timeout: T(150000) }).then(() => true, () => false);
  const screen = joined ? '' : await player.evaluate(() => (document.body.innerText.match(/Disconnected[^\n]*/) ?? [''])[0]).catch(() => '');
  check(joined, `joining from the game browser puts the player in the match${screen ? ` (${screen})` : ''}`);
  if (joined) {
    // No install prompt, download link or banner anywhere on the way in or in game.
    const nag = await player.evaluate(() => ({
      links: document.querySelectorAll('a[href*="tiletrigger-host"], a[href*="releases"]').length,
      text: /Host Service|Download/.test([...document.querySelectorAll('body *')].filter((e) => e.offsetParent !== null && !e.children.length).map((e) => e.textContent).join(' ')),
    }));
    check(nag.links === 0 && !nag.text, `joining a dedicated host shows no install prompt or download (${JSON.stringify(nag)})`);
    const bots = await player.evaluate(() => [...window.__cs.hud.roster.values()].filter((p) => p.bot).length);
    check(bots >= 5, `the player sees the host's bots (${bots})`);
    const b0 = await player.evaluate(() => window.__cs.transport.bytesIn);
    const moved = await player.evaluate(async () => {
      let best = 0;
      for (let turn = 0; turn < 4 && best <= 1; turn++) {
        if (turn) window.__cs.input.yaw += Math.PI / 2;
        const y0 = { ...window.__cs.local.state.pos };
        window.__autoInput = { forward: 1 };
        await new Promise((r) => setTimeout(r, 1500));
        window.__autoInput = { forward: 0 };
        const y1 = window.__cs.local.state.pos;
        best = Math.max(best, Math.hypot(y1.x - y0.x, y1.z - y0.z));
      }
      return best;
    });
    const got = (await player.evaluate(() => window.__cs.transport.bytesIn)) - b0;
    check(moved > 1 && got > 2000, `the player moves and keeps getting snapshots (${moved.toFixed(1)} m, ${(got / 1024).toFixed(0)} KB)`);

    // The owner, joined by code with the admin token, kicks the visitor from the pause menu's player list.
    const admin = await open('Owner', `${CLIENT}/?join=${game.code}&${hub}&admin=e2e-admin-token`);
    const adminIn = await admin.waitForFunction(playing, null, { timeout: T(150000) }).then(() => true, () => false);
    if (!adminIn) console.log(readFileSync(join(hostState, 'logs', 'host.log'), 'utf8').split('\n').slice(-25).join('\n'));
    check(adminIn, `the owner joins by code${adminIn ? '' : ` (${await admin.evaluate(() => document.body.innerText.match(/(Disconnected|couldn|no game)[^\n]*/)?.[0] ?? window.__cs?.phase?.() ?? 'no session').catch(() => '')})`}`);
    const slot = await player.evaluate(() => window.__cs.slot);
    // (The admin's page is still settling into Sandgate as it joins: a frame every second or two on a loaded machine.)
    const button = await admin.waitForFunction((s) => !!document.getElementById(`hc-kick-${s}`), slot, { timeout: T(120000), polling: 500 }).then(() => true, () => false);
    check(button, `the admin gets the match controls, with the visitor in its player list${button ? '' : ` (${await admin.evaluate(() => JSON.stringify({ host: window.__cs?.host?.(), panels: document.querySelectorAll('[id=host-controls]').length, people: [...document.querySelectorAll('.hc-person')].map((e) => e.textContent), ids: [...document.querySelectorAll('[id^=hc-kick]')].map((e) => e.id), roster: [...(window.__cs?.hud?.roster?.values() ?? [])].filter((p) => !p.bot).map((p) => `${p.slot}:${p.name}`) }))}, visitor slot ${slot})${whoSaw()}`}`);
    if (button) {
      // The player list is rebuilt as the roster changes, so the button can be replaced between the wait above and a
      // separate click (CI: "Cannot read properties of null (reading 'click')"): find and click it in one step.
      // Once only (a slow page can run the poll that clicks after a short timeout ran out: CI then failed a kick that
      // landed), and with room for a page drawing a frame every second or two.
      const clicked = await admin.waitForFunction((s) => { if (window.__kickClicked) return true; const b = document.getElementById(`hc-kick-${s}`); if (!b) return false; b.click(); return (window.__kickClicked = true); }, slot, { timeout: T(60000), polling: 250 }).then(() => true, () => false);
      // CI once timed out here with the button gone for 45 s after it had shown: what the admin's list held then.
      if (!clicked) check(false, `the admin can click Kick for the visitor (${await admin.evaluate(() => JSON.stringify({ people: [...document.querySelectorAll('.hc-person')].map((e) => e.textContent), ids: [...document.querySelectorAll('[id^=hc-kick]')].map((e) => e.id), roster: [...(window.__cs?.hud?.roster?.values() ?? [])].filter((p) => !p.bot).map((p) => `${p.slot}:${p.name}`), phase: window.__cs?.phase?.() })).catch(() => '')}, visitor slot ${slot}, now ${await player.evaluate(() => window.__cs?.slot).catch(() => 'gone')})${whoSaw()}`);
      const kicked = await player.waitForFunction(() => /kicked/i.test(document.body.innerText), null, { timeout: T(20000) }).then(() => true, () => false);
      // What the player saw and what the host logged, when the kick didn't land (CI annotations carry it).
      const why = kicked
        ? ''
        : ` (player: ${await player.evaluate(() => JSON.stringify({ phase: window.__cs?.phase?.(), slot: window.__cs?.slot, text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 240) })).catch((e) => `gone: ${e.message.slice(0, 80)}`)}; host log: ${(() => { try { return readFileSync(join(hostState, 'logs', 'host.log'), 'utf8').split('\n').filter(Boolean).slice(-8).join(' / ').slice(0, 500); } catch { return 'none'; } })()})`;
      check(kicked, `the kicked player is told and leaves the match${why}`);
    }
    if (adminIn) {
      // The owner changes the score and time limits from the Host Service's console (as the launcher does), then
      // restarts: the match plays with them, and the admin's game shows them (score limit, the clock).
      const key = readFileSync(join(hostState, 'pairing-token'), 'utf8').trim();
      const consoleLine = (line) => fetch(`http://127.0.0.1:${CONTROL_PORT}/api/console`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ line }) }).then((r) => r.status);
      const status = () => fetch(`http://127.0.0.1:${CONTROL_PORT}/api/status`, { headers: { Authorization: `Bearer ${key}` } }).then((r) => r.json());
      const ran = [await consoleLine('rules score 5'), await consoleLine('rules time 3')];
      const waiting = await until(async () => { const s = await status(); return ['score', 'time'].every((k) => s.host?.ruleRows?.find((r) => r.key === k)?.pending); }, T(15000));
      check(ran.every((c) => c === 200) && waiting, `score and time limits set from the console wait for the restart (${ran.join(', ')})`);
      await consoleLine('restart');
      const live = await until(async () => { const s = await status(); return s.host?.rules?.now?.scoreLimit === 5 && s.host.rules.now.timeLimitSeconds === 180; }, T(20000));
      check(live, 'after the restart the match plays to 5, with 3 minutes on the clock');
      // (The rules arrive at once; the clock once the restarted match is under way: it waits for everyone to load first.)
      const seen = (await admin.waitForFunction(() => window.__cs?.rules?.()?.scoreLimit === 5 && window.__cs.rules().timeLimitSeconds === 180, null, { timeout: T(60000), polling: 500 }).then(() => true, () => false)) && (await admin.waitForFunction(() => window.__cs.phase() === 'playing' && window.__cs.timeLeft() > 0 && window.__cs.timeLeft() <= 180, null, { timeout: T(90000), polling: 500 }).then(() => true, () => false));
      check(seen, `the player's game follows: score limit 5, clock under 3 minutes (${await admin.evaluate(() => JSON.stringify({ limit: window.__cs?.rules?.()?.scoreLimit, time: window.__cs?.rules?.()?.timeLimitSeconds, left: window.__cs?.timeLeft?.(), phase: window.__cs?.phase?.() })).catch(() => '')})${seen ? '' : whoSaw()}`);
      // Kept for the next start too.
      const saved = await until(async () => (await status()).config?.rules?.modes?.tdm?.score === 5, T(10000));
      check(saved, 'the Host Service keeps them in its settings for the next start');
    }
  }
  check(probes.length === 0, `pages other than /host never look for a Host Service (${probes.join(', ')})`);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);

}

/** /host's next-map vote and Match rules before Start (owner, 10-31: every Match setup / Host tab setting there). */
async function hostpageRulesChecks(page, controlPort, token) {
  const shot = (name) => (process.env.E2E_SHOTS ? page.screenshot({ path: `${process.env.E2E_SHOTS}/hostpage-${name}.png`, fullPage: true }).catch(() => {}) : Promise.resolve());
  const form = await page.evaluate(() => ({
    vote: !!document.getElementById('hp-vote'),
    on: document.getElementById('hp-vote')?.checked,
    mode: document.getElementById('hp-rules-mode')?.textContent,
    rules: document.querySelectorAll('#hp-rules .hp-rule').length,
    main: ['score', 'time', 'respawn', 'ff', 'set', 'teams'].every((k) => !!document.querySelector(`#hp-rules-main #hp-rule-${k}`)),
    more: ['gravity', 'classes', 'leaders', 'fireteams', 'lethality'].every((k) => !!document.querySelector(`#hp-rules-more #hp-rule-${k}`)),
    tags: document.querySelectorAll('#hp-rules .hp-tag').length,
  }));
  check(form.vote && form.on && /Team Deathmatch/.test(form.mode ?? '') && form.rules >= 20 && form.main && form.more && form.tags === form.rules, `/host has the next-map vote (on) and every Match setup rule for the mode, each tagged with when it applies (${JSON.stringify(form)})`);
  await page.evaluate(() => (document.querySelector('#hp-rules-more')?.closest('details')?.setAttribute('open', '')));
  await shot('rules-stopped');
  // Set before Start, they go with it: score 7 (Team Deathmatch only), friendly fire half, low gravity, no vote.
  await page.uncheck('#hp-vote');
  await page.fill('#hp-rule-score', '7');
  await page.press('#hp-rule-score', 'Tab');
  await page.selectOption('#hp-rule-ff', 'half');
  await page.selectOption('#hp-rule-gravity', 'low');
  await page.locator('#hp-name').focus();
}

/** Running: a rule and the vote changed on /host reach the match at once, and the Host Service keeps them. */
async function hostpageLiveChecks(page, controlPort, token) {
  const status = () => fetch(`http://127.0.0.1:${controlPort}/api/status`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
  const shot = (name) => (process.env.E2E_SHOTS ? page.screenshot({ path: `${process.env.E2E_SHOTS}/hostpage-${name}.png`, fullPage: true }).catch(() => {}) : Promise.resolve());
  const started = await until(async () => { const s = await status(); return s.state === 'running' && !!s.host?.rules; }, T(30000));
  const s0 = await status();
  check(started && s0.config?.mapVote === false && s0.host?.rotation?.vote === false && s0.config?.rules?.modes?.tdm?.score === 7 && s0.config.rules.ff === 'half' && s0.config.rules.gravity === 'low' && s0.host.rules.now.scoreLimit === 7, `Start took the rules and the vote from /host (${JSON.stringify({ vote: s0.config?.mapVote, live: s0.host?.rotation?.vote, rules: s0.config?.rules, score: s0.host?.rules?.now?.scoreLimit })})`);
  // Live: the vote back on, and a live rule (mix up weapon pickups) and a restart one (time limit).
  await page.check('#hp-vote');
  const voted = await until(async () => (await status()).host?.rotation?.vote === true, T(15000));
  await page.selectOption('#hp-rule-mix', 'on');
  await page.locator('#hp-name').focus();
  const mixed = await until(async () => { const s = await status(); return s.host?.rules?.now?.mixPickups === true && s.config?.rules?.mix === true; }, T(15000));
  await page.fill('#hp-rule-time', '9');
  await page.press('#hp-rule-time', 'Tab');
  await page.locator('#hp-name').focus();
  const timed = await until(async () => (await status()).config?.rules?.modes?.tdm?.time === 9, T(15000));
  const waits = await page.waitForFunction(() => /waits for the restart/.test(document.querySelector('#hp-rule-time')?.closest('.hp-rule')?.textContent ?? ''), null, { timeout: T(10000) }).then(() => true, () => false);
  check(voted && mixed && timed && waits, `running, /host changes the match at once: the vote ${voted}, a live rule ${mixed}, a restart rule kept and shown waiting ${timed}/${waits} (${await page.evaluate(() => document.getElementById('hp-message')?.textContent)})`);
  await page.evaluate(() => (document.querySelector('#hp-rules-more')?.closest('details')?.setAttribute('open', '')));
  await shot('rules-running');
}

/** The /host page: download offered only when no Host Service runs; with one, pair, Start, see it listed, Stop. */
async function hostpageFlow(browser) {
  const HUB_PORT = +(process.env.E2E_HOSTPAGE_HUB_PORT ?? 9080);
  const CONTROL_PORT = +(process.env.E2E_HOSTPAGE_CONTROL_PORT ?? 7802);
  const errors = [];
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  // No Host Service yet: the page explains both ways to host and offers the download.
  await page.goto(`${CLIENT}/host?hostPort=${CONTROL_PORT}`, { waitUntil: 'domcontentloaded' });
  const none = await page.waitForFunction(() => /No Host Service/.test(document.getElementById('hp-state')?.textContent ?? ''), null, { timeout: T(30000) }).then(() => true, () => false);
  const offer = await page.evaluate(() => ({ downloads: document.querySelectorAll('a.hp-download').length, browser: /nothing to install/i.test(document.body.innerText) }));
  check(none && offer.downloads >= 3 && offer.browser, `/host offers the download only as an option, next to hosting in the browser (${JSON.stringify(offer)})`);

  start('pnpm', ['--filter', '@tiletrigger/server', 'hub'], { PORT: String(HUB_PORT), HOST: '127.0.0.1', LAN_DISCOVERY: '0' });
  await waitForHttp(`http://127.0.0.1:${HUB_PORT}/lobby/health`, T(30000));
  const state = await startHostService({ hubPort: HUB_PORT, controlPort: CONTROL_PORT, idle: true });
  const token = await until(() => Promise.resolve(existsSync(join(state, 'pairing-token'))), T(30000)).then(() => readFileSync(join(state, 'pairing-token'), 'utf8').trim());
  await waitForHttp(`http://127.0.0.1:${CONTROL_PORT}/api/ping`, T(30000));
  // The link the Host Service window shows pairs this browser.
  await page.goto(`${CLIENT}/host?hostPort=${CONTROL_PORT}#pair=${token}`, { waitUntil: 'domcontentloaded' });
  const paired = await page.waitForFunction(() => !!document.getElementById('hp-form') && document.getElementById('hp-form').childElementCount > 0, null, { timeout: T(30000) }).then(() => true, () => false);
  check(paired && !(await page.evaluate(() => location.hash)), `the pairing link opens the controls (and leaves the key out of the address bar)${paired ? '' : ` (${await page.evaluate(() => document.getElementById('hp-service')?.textContent)})`}`);
  if (paired) {
    await page.fill('#hp-name', 'E2E From Host Page');
    await page.selectOption('#hp-map', 'sandgate');
    await page.selectOption('#hp-mode', 'core.tdm');
    await page.fill('#hp-fill', '8');
    await hostpageRulesChecks(page, CONTROL_PORT, token);
    await page.click('#hp-start');
    const running = await page.waitForFunction(() => /Running/.test(document.getElementById('hp-run-state')?.textContent ?? ''), null, { timeout: T(60000) }).then(() => true, () => false);
    check(running, `Start starts the server (${await page.evaluate(() => document.getElementById('hp-status')?.textContent)})`);
    if (running) await hostpageLiveChecks(page, CONTROL_PORT, token);
    const listed = await hubUntil(async () => ((await hubGames(HUB_PORT)) ?? []).some((g) => g.name === 'E2E From Host Page' && g.hostType === 'dedicated'), T(30000));
    check(listed, 'the server it started is in the game browser');
    await page.click('#hp-stop');
    const stopped = await page.waitForFunction(() => /^Stopped/.test(document.getElementById('hp-run-state')?.textContent ?? ''), null, { timeout: T(30000) }).then(() => true, () => false);
    const gone = await hubUntil(async () => (await hubGames(HUB_PORT))?.every((g) => g.name !== 'E2E From Host Page') === true, T(20000));
    check(stopped && gone, 'Stop stops it and takes the listing down');
  }
  // The launcher: the service's own page, the console's log and command line, and a right bar that runs console commands.
  const launcher = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  launcher.on('pageerror', (e) => errors.push(`launcher: ${e.message}`));
  await launcher.goto(`http://127.0.0.1:${CONTROL_PORT}/#key=${token}`, { waitUntil: 'domcontentloaded' });
  const logged = await launcher.waitForFunction(() => /Host Service/.test(document.getElementById('log')?.textContent ?? ''), null, { timeout: T(20000) }).then(() => true, () => false);
  check(logged && !(await launcher.evaluate(() => location.hash)), 'the launcher shows the console log (and keeps the key out of the address bar)');
  await launcher.fill('#cmd', 'status');
  await launcher.press('#cmd', 'Enter');
  const answered = await launcher.waitForFunction(() => [...document.querySelectorAll('#log .ln.out')].some((l) => /server (stopped|running)/.test(l.textContent)), null, { timeout: T(10000) }).then(() => true, () => false);
  check(answered, 'a command typed in the launcher runs and its answer shows');
  await launcher.click('#f-vis button[data-v="code"]');
  await launcher.click('#b-start');
  const started = await launcher.waitForFunction(() => document.getElementById('pill')?.dataset.state === 'running', null, { timeout: T(60000) }).then(() => true, () => false);
  check(started, 'Start in the right bar starts the server');
  if (started) {
    // The bar runs the command only once its own status poll has seen the server running (the pill can turn first,
    // CI 4 Nov: the click only set the draft): click again until the command shows.
    const ran = await until(async () => {
      if (await launcher.evaluate(() => [...document.querySelectorAll('#log .ln.cmd')].some((l) => /visibility listed/.test(l.textContent)))) return true;
      await launcher.click('#f-vis button[data-v="listed"]');
      return launcher.waitForFunction(() => [...document.querySelectorAll('#log .ln.cmd')].some((l) => /visibility listed/.test(l.textContent)), null, { timeout: 2000 }).then(() => true, () => false);
    }, T(10000));
    check(ran, 'a right-bar toggle runs its console command (visibility listed)');
    // The Rotation card's Vote on the next map: on (the setting), and unticked it runs rotation vote off in the match.
    const statusV = () => fetch(`http://127.0.0.1:${CONTROL_PORT}/api/status`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
    const voteBox = await launcher.evaluate(() => document.getElementById('rot-vote')?.checked ?? null);
    await launcher.uncheck('#rot-vote');
    const voteOff = await until(async () => (await statusV()).host?.rotation?.vote === false, T(15000));
    check(voteBox === true && voteOff, `the launcher's Vote on the next map box runs rotation vote off (box ${voteBox}, match ${voteOff})`);
    await launcher.check('#rot-vote');
    // Match rules: the score and time limit steppers run rules commands, wait for the restart, and Restart now plays them.
    const status = () => fetch(`http://127.0.0.1:${CONTROL_PORT}/api/status`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
    await launcher.waitForFunction(() => !!document.querySelector('#rules-main .rule[data-k="score"] .stepper') && !!document.querySelector('#rules-main .rule[data-k="time"] .stepper'), null, { timeout: T(20000) }).catch(() => {});
    const now = (await status()).host?.rules?.now ?? {};
    const score = (now.scoreLimit ?? 0) + 3;
    const minutes = Math.round((now.timeLimitSeconds ?? 0) / 60) + 2;
    for (let i = 0; i < 3; i++) await launcher.click('#rules-main .rule[data-k="score"] .stepper button[aria-label="More"]');
    for (let i = 0; i < 2; i++) await launcher.click('#rules-main .rule[data-k="time"] .stepper button[aria-label="More"]');
    const cmds = await launcher.waitForFunction((w) => { const t = [...document.querySelectorAll('#log .ln.cmd')].map((l) => l.textContent).join('\n'); return t.includes(`rules score ${w[0]}`) && t.includes(`rules time ${w[1]}`); }, [score, minutes], { timeout: T(10000) }).then(() => true, () => false);
    const waits = await launcher.waitForFunction(() => !document.getElementById('rules-wait').hidden && /score limit/i.test(document.getElementById('rules-wait-text').textContent), null, { timeout: T(15000) }).then(() => true, () => false);
    check(cmds && waits, `the Match rules card sets the score limit to ${score} and the time limit to ${minutes} min (rules commands), waiting for the restart`);
    // A Match setup rule too (applies at the next match): low gravity.
    await launcher.evaluate(() => (document.getElementById('rules-more-box').open = true));
    await launcher.click('#rules-more .rule[data-k="gravity"] .seg button[data-v="low"]');
    await launcher.waitForFunction(() => [...document.querySelectorAll('#log .ln.cmd')].some((l) => /rules gravity low/.test(l.textContent)), null, { timeout: T(10000) }).catch(() => {});
    await launcher.click('#rules-restart');
    const applied = await until(async () => { const n = (await status()).host?.rules?.now; return n?.scoreLimit === score && n.timeLimitSeconds === minutes * 60 && n.gravity === 0.4; }, T(30000));
    check(applied, `Restart now plays them: score ${score}, ${minutes} min, low gravity (${JSON.stringify(((await status()).host?.rules?.now) ?? {}, ['scoreLimit', 'timeLimitSeconds', 'gravity'])})`);
    await launcher.click('#b-stop');
    await launcher.waitForFunction(() => document.getElementById('pill')?.dataset.state === 'stopped', null, { timeout: T(30000) }).catch(() => {});
  }
  await launcher.context().close();
  const siteConsole = await fetch(`http://127.0.0.1:${CONTROL_PORT}/api/console`, { method: 'POST', headers: { Origin: 'https://trigger.toshiroplay.com', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{"line":"status"}' }).then((r) => r.status);
  check(siteConsole === 403, `the console is the launcher's alone, not the site's (${siteConsole})`);
  // Another site can't drive it.
  const refused = await fetch(`http://127.0.0.1:${CONTROL_PORT}/api/status`, { headers: { Origin: 'https://evil.example', Authorization: `Bearer ${token}` } }).then((r) => r.status);
  check(refused === 403, `the control API refuses other sites' pages (${refused})`);
  await fetch(`http://127.0.0.1:${CONTROL_PORT}/api/quit`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => undefined);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

/** Host game: one browser hosts its offline match with a code, a second joins by link through a hub's broker. */
async function hostgameFlow(browser) {
  // The broker is a community hub's, as in a real game (a bare PeerJS broker never let the friend in on CI).
  const PEER_PORT = +(process.env.E2E_PEER_PORT ?? 9077);
  start('pnpm', ['--filter', '@tiletrigger/server', 'hub'], { PORT: String(PEER_PORT), HOST: '127.0.0.1' });
  await sleep(5000);
  const peer = `&hub=127.0.0.1:${PEER_PORT}`;
  const host = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
  const errors = [];
  host.on('pageerror', (e) => errors.push(`host: ${e.message}`));
  await host.goto(`${CLIENT}/?offline=arena${peer}`, { waitUntil: 'domcontentloaded', timeout: T(60000) });
  await host.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() !== 'waiting' && window.__cs.phase() !== 'countdown', null, { timeout: T(90000) });
  // CI renders in software, slowly: generous waits (readiness is checked by what follows each load),
  // and the Host button pressed again if the first press got no answer.
  const hasCode = () => /[A-Z0-9]{6}/.test(document.querySelector('#host-info .host-code b')?.textContent ?? '');
  for (let i = 0; i < 3; i++) {
    await host.evaluate(() => document.getElementById('host-game').click());
    if (await host.waitForFunction(hasCode, null, { timeout: T(30000) }).then(() => true, () => false)) break;
  }
  const code = await host.evaluate(() => document.querySelector('#host-info .host-code b').textContent);
  check(/^[A-Z0-9]{6}$/.test(code), `hosting opens a join code (${code})`);
  const friend = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
  friend.on('pageerror', (e) => errors.push(`friend: ${e.message}`));
  await friend.addInitScript(() => localStorage.setItem('cs.name', 'Friend'));
  await friend.goto(`${CLIENT}/?join=${code}${peer}`, { waitUntil: 'domcontentloaded', timeout: T(60000) });
  const joined = await friend.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() !== 'waiting' && window.__cs.phase() !== 'countdown', null, { timeout: T(60000) }).then(() => true, () => false);
  const screen = joined ? '' : await friend.evaluate(() => (document.body.innerText.match(/Disconnected[^\n]*/) ?? [''])[0]).catch(() => '');
  check(joined, `a friend joins the hosted match by its link${screen ? ` (${screen})` : ''}`);
  if (joined) {
    await simWait(host, (m) => m.combatants().some((c) => c.kind === 'human' && c.name === 'Friend'), null, T(10000));
    const seen = await sim(host, (m) => m.combatants().filter((c) => c.kind === 'human').map((c) => c.name));
    check(seen.length === 2 && seen.includes('Friend'), `the host's match has both players (${seen.join(', ')})`);
    // The friend takes over a bot where it stands, maybe mid-fight: keep them alive while they walk.
    await sim(host, (m) => {
      const f = m.combatants().find((c) => c.name === 'Friend');
      if (f) setInterval(() => (f.health = f.maxHealth), 50);
    });
    // The friend now spawns at a spawn point, which can face a wall or a bot: turn and try again if blocked.
    const moved = await friend.evaluate(async () => {
      let best = 0;
      for (let turn = 0; turn < 4 && best <= 1; turn++) {
        if (turn) window.__cs.input.yaw += Math.PI / 2;
        const y0 = { ...window.__cs.local.state.pos };
        window.__autoInput = { forward: 1 };
        await new Promise((r) => setTimeout(r, 1500));
        window.__autoInput = { forward: 0 };
        const y1 = window.__cs.local.state.pos;
        best = Math.max(best, Math.hypot(y1.x - y0.x, y1.z - y0.z));
      }
      return best;
    });
    const onHost = await sim(host, (m) => {
      const f = m.combatants().find((c) => c.name === 'Friend');
      return f ? { ...f.move.pos } : null;
    });
    const alive = await friend.evaluate(() => window.__cs.local.alive);
    check(moved > 1 && !!onHost, `the friend moves and the host's match follows (${moved.toFixed(1)} m${alive ? '' : ', friend down'})`);
    // The host's stream to a friend is compressed: a few KB/s, not the ~40 KB/s of raw snapshots.
    const bytes = () => friend.evaluate(() => window.__cs.transport.bytesIn);
    const b0 = await bytes();
    await friend.waitForTimeout(5000); // wait-ok: measures five seconds of the stream
    const rate = ((await bytes()) - b0) / 5 / 1024;
    // Raw snapshots run ~40 KB/s; compressed, a few (bursty frames on CI push it up, but well under raw).
    check(rate > 0.2 && rate < 20, `the friend's stream is compressed (${rate.toFixed(1)} KB/s)`);
    // The friend spectates (what the pause menu's button does; the offline flow clicks it): out of the host's
    // match, a bot in the place, and their camera input keeps them from going idle (PlayerInput.sp); Join game puts them back.
    const fslot = await friend.evaluate(() => window.__cs.slot);
    await friend.evaluate(() => window.__cs.spectate(true));
    const specOn = await simWait(host, (m, _me, s) => m.isSpectator(s) && m.slots[s] === null, fslot, T(10000));
    await friend.evaluate(() => (window.__autoInput = { forward: 1 }));
    await friend.waitForFunction(() => window.__cs.spec().spectator && window.__cs.spec().out, null, { timeout: T(5000) }).catch(() => {});
    // While the camera input is held, the host must see the spectator as active (measured then, not after letting
    // go: on a slow runner the last input can reach the host a second or two before a later reading).
    await simWait(host, (m, _me, s) => m.idleSeconds(s) < 1, fslot, T(8000));
    const idle = await sim(host, (m, _me, s) => m.idleSeconds(s), fslot);
    await friend.evaluate(() => delete window.__autoInput);
    const fstate = await friend.evaluate(() => window.__cs.spec());
    check(specOn && fstate.spectator && fstate.out && idle < 2, `a friend spectates in the hosted match, their camera input counting as activity (${idle.toFixed(1)} s idle; spectator ${fstate.spectator}, ${fstate.free ? 'free camera' : `following ${fstate.following}`})`);
    await friend.evaluate(() => window.__cs.spectate(false));
    const backIn = await simWait(host, (m, _me, s) => m.slots[s]?.kind === 'human' && !m.isSpectator(s), fslot, T(10000));
    await friend.waitForFunction(() => !window.__cs.spec().spectator, null, { timeout: T(5000) }).catch(() => {});
    check(specOn && backIn && !(await friend.evaluate(() => window.__cs.spec().spectator)), 'and joins the game again');
    // The host leaves (Leave match, confirmed with a friend in): the friend gets the host-left screen, not a bare error.
    // (The friend is the only one, so the host has named it successor: here it lets that go, as when no handoff
    // can happen; the flow `handoff` covers a successor carrying the match on.)
    await friend.evaluate(() => window.__cs.transport.takeHandoff?.().standby?.close());
    await host.evaluate(() => document.getElementById('exitmatch').click());
    await host.evaluate(() => document.getElementById('leave-yes')?.click());
    const left = await friend
      .waitForFunction(() => {
        const el = document.getElementById('host-left');
        if (el?.dataset.state !== 'ended') return null;
        return { title: document.getElementById('hl-title').textContent, text: document.getElementById('hl-text').textContent, rows: el.querySelectorAll('.sb-row:not(.sb-hd)').length, host: !!document.getElementById('hl-host'), menu: !!document.getElementById('hl-menu') };
      }, null, { timeout: T(30000) })
      .then((h) => h.jsonValue(), () => null);
    check(!!left && /host left/i.test(left.title) && left.host && left.menu, `the friend sees "The host left" with Host this map and Back to menu (${JSON.stringify(left)})`);
    check(!!left && /left the game/.test(left.text), `the host said goodbye first, so it reads as leaving, not a dropped link (${left?.text})`);
    check(!!left && left.rows >= 2, `the host-left screen shows the last standings (${left?.rows} rows)`);
    // Host this map: one click, the same map hosted and listed.
    await friend.evaluate(() => document.getElementById('hl-host').click());
    const rehosted = await friend
      .waitForFunction(() => window.__cs?.map === 'phase0_arena' && !document.getElementById('host-left') && /[A-Z0-9]{6}/.test(document.querySelector('#host-info .host-code b')?.textContent ?? '') && /^Listed:/.test(document.getElementById('host-public-status').textContent), null, { timeout: T(90000) })
      .then(() => true, () => false);
    const listing = await friend.evaluate(() => document.getElementById('host-public-status').textContent);
    check(rehosted, `Host this map starts the same map, hosted and listed (${listing})`);
  }
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await host.context().close();
  await friend.context().close();
}

/**
 * Host controls (pause menu → Match): offline, change the bots live, end and
 * restart, then change map; in Host game, change map with a friend who comes
 * along to the new map by themselves.
 */
async function hostcontrolsFlow(browser) {
  const errors = [];
  const playing = () => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() !== 'waiting' && window.__cs.phase() !== 'countdown';
  const openPanel = (page) => page.evaluate(() => (document.getElementById('host-controls').open = true));
  const pickMap = async (page, id) => {
    await page.evaluate(() => document.getElementById('hc-map').click());
    // Under load the cards take a while: the picker has every map of our suite.
    await page.waitForSelector('#host-maps', { timeout: T(30000) });
    await page.evaluate((mapId) => {
      document.querySelector('#host-maps .hm-modes [data-mode="core.deathmatch"]')?.click();
      document.querySelector(`#host-maps .map-card[data-id="${mapId}"]`).click();
      document.getElementById('hm-go').click();
    }, id);
  };
  /** Pause menu → Match → Rotation → Add map…: queue a map (in Deathmatch); true once "Next up" names it. */
  const queueMap = async (page, id, name) => {
    await openPanel(page);
    await page.evaluate(() => document.getElementById('hc-rot-add').click());
    // Under load the cards take a while: the picker has every map of our suite.
    if (!(await page.waitForSelector('#host-maps', { timeout: T(30000) }).then(() => true, () => false))) return false;
    await page.evaluate((mapId) => {
      document.querySelector('#host-maps .hm-modes [data-mode="core.deathmatch"]')?.click();
      document.querySelector(`#host-maps .map-card[data-id="${mapId}"]`).click();
      document.getElementById('hm-go').click();
    }, id);
    return page.waitForFunction((n) => (document.getElementById('hc-rot-next')?.textContent ?? '') === `Next up: ${n} · Deathmatch`, name, { timeout: T(30000) }).then(() => true, () => false);
  };
  /** End match takes a second click (the first only asks): the host confirms and the match ends. */
  const endMatch = (page) => page.evaluate(() => {
    const b = document.getElementById('hc-end');
    b.click();
    b.click();
  });
  /** The end-of-match scoreboard's line under its title (the overlay's, or the pause menu's board while it's open). */
  const boardNote = (page, re) => page.waitForFunction((src) => [...document.querySelectorAll('#scoreboard .sb-note, #pause-scores .sb-note')].some((n) => new RegExp(src).test(n.textContent ?? '')), re.source, { timeout: T(20000) }).then(() => true, () => false);

  // Offline: the player runs the match. The host's "Vote on the next map" is off in this flow (the plain rotation and
  // replay are what it checks; the flow `party` has the vote).
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  page.on('pageerror', (e) => errors.push(`offline: ${e.message}`));
  await page.addInitScript(() => localStorage.setItem('cs.mapVote', '0'));
  await page.goto(`${CLIENT}/?offline=arena`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(playing, null, { timeout: T(60000) });
  const state = await page.waitForFunction(() => window.__cs.host(), null, { timeout: T(10000) }).then((h) => h.jsonValue());
  check(state?.fill === 4 && state.teams === 0, `the offline player runs the match (${JSON.stringify(state)})`);
  // The pause menu: Match first; Esc goes back from a tab to Match; the host gets a Host tab.
  const menu = await page.evaluate(() => {
    const tab = (id) => document.querySelector(`#pause .pause-tabs [data-tab="${id}"]`);
    const open = () => [...document.querySelectorAll('#pause .pause-sec')].find((x) => !x.hidden)?.dataset.sec;
    const first = open();
    tab('settings').click();
    const settings = open();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true }));
    return { first, settings, back: open(), host: !tab('host').hidden };
  });
  check(menu.first === 'match' && menu.settings === 'settings' && menu.back === 'match' && menu.host, `pause menu tabs: Match first, Esc back to it, a Host tab for the host (${JSON.stringify(menu)})`);
  // Mouse users never need Esc: the Back button (top left) and the footer's key hints are buttons. From the Host
  // tab (Resume in its foot) Back resumes, as Esc does; from Settings it goes back to Match.
  const clicks = await page.evaluate(() => {
    const open = () => [...document.querySelectorAll('#pause .pause-sec')].find((x) => !x.hidden)?.dataset.sec;
    document.getElementById('pause-hint-tabs').click();
    const next = open();
    const onHost = { label: document.querySelector('#pause-back .back-label').textContent, foot: !document.getElementById('pause-host-foot').hidden };
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true }));
    // Resuming asks for the mouse (a headless page never gets it, so the menu stays) and hands the keyboard to the foot's Resume.
    const resumed = { tab: open(), focus: document.activeElement?.id };
    document.querySelector('#pause [data-tab="settings"]').click();
    const label = document.querySelector('#pause-back .back-label').textContent;
    const footGone = document.getElementById('pause-host-foot').hidden;
    document.getElementById('pause-back').click();
    const back = open();
    // A held Esc (key repeat) doesn't go back again and again.
    document.querySelector('#pause [data-tab="settings"]').click();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', repeat: true, bubbles: true }));
    const held = open();
    document.getElementById('pause-hint-back').click();
    return { next, onHost, resumed, label, footGone, back, held, top: document.querySelector('#pause-back .back-label').textContent, after: open() };
  });
  check(clicks.next === 'host' && clicks.onHost.label === 'Resume' && clicks.onHost.foot && clicks.resumed.tab === 'host' && clicks.resumed.focus === 'hc-resume' && clicks.footGone, `the Host tab has its own foot, and Esc there resumes (${JSON.stringify({ onHost: clicks.onHost, resumed: clicks.resumed, footGone: clicks.footGone })})`);
  check(clicks.label === 'Back' && clicks.back === 'match' && clicks.held === 'settings' && clicks.after === 'match' && clicks.top === 'Resume', `the pause menu's Back button and footer hints work by click; a repeating Esc does nothing (${JSON.stringify(clicks)})`);
  // Resuming may have had the mouse (a headless page can): back to the pause menu for what follows.
  await frames(page, 10);
  await page.evaluate(() => document.pointerLockElement && document.exitPointerLock());
  await page.waitForFunction(() => !document.pointerLockElement && !document.getElementById('pause').hidden, null, { timeout: T(5000) }).catch(() => {});
  const fits = await page.evaluate(() => {
    const r = document.querySelector('#pause .pause-card').getBoundingClientRect();
    return r.top >= 0 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1;
  });
  check(fits, 'the pause menu fits the window');
  await openPanel(page);
  // What wins shows the score and time suggested for the players and bots, following the size being set.
  const suggestedFor = () => page.evaluate(() => document.getElementById('hc-suggest')?.textContent ?? '');
  const before = await suggestedFor();
  await page.evaluate(() => {
    document.getElementById('hc-players-plus').click();
    document.getElementById('hc-players-plus').click();
    document.querySelector('#hc-skill [data-value="hard"]').click();
  });
  const says = await page.evaluate(() => ({ apply: document.getElementById('hc-apply').textContent, changes: document.getElementById('hc-changes').textContent, resume: !!document.getElementById('hc-resume') }));
  check(says.apply === 'Apply now' && says.changes === '+2 bots, hard bots' && says.resume, `Apply says what it will do, beside Resume (${JSON.stringify(says)})`);
  const after6 = await suggestedFor();
  check(/^Suggested for 4 players: \d+ kills, \d+ min\./.test(before) && /^Suggested for 6 players: \d+ kills, \d+ min\./.test(after6), `the Host tab suggests a score and time for the size being set ("${before}" → "${after6}")`);
  await page.evaluate(() => document.getElementById('hc-apply').click());
  const six = await simWait(page, (m) => m.combatants().length === 6, null, T(5000));
  const feed = await page.evaluate(() => document.getElementById('feed').textContent);
  check(six && feed.includes('Host set the match to 6 players, bot skill to hard'), `Apply adds bots live, with a feed line (${feed})`);
  const hard = await sim(page, (m) => m.combatants().filter((c) => c.bot).every((c) => c.bot.difficulty.id === 'hard'));
  check(hard, 'bot skill changes live');
  // Bots…: the Bots window. Esc closes it (the pause menu's back); then name a bot, give it a look and a skill, Apply.
  await page.evaluate(() => document.getElementById('hc-bots').click());
  const opened = await page.waitForSelector('#bot-manager', { state: 'attached', timeout: T(5000) }).then(() => true, () => false);
  await page.keyboard.press('Escape');
  const escClosed = await page.waitForFunction(() => !document.getElementById('bot-manager'), null, { timeout: T(5000) }).then(() => true, () => false);
  check(opened && escClosed, `Bots… opens the Bots window and Esc closes it (${opened}, ${escClosed})`);
  // One level per Esc: the look picker over the Bots window closes first, the window stays.
  await openPanel(page);
  await page.evaluate(() => document.getElementById('hc-bots').click());
  await page.waitForSelector('#bot-manager', { state: 'attached', timeout: T(5000) });
  await page.evaluate(() => {
    document.getElementById('bm-add').click();
    document.getElementById('bm-look-0').click();
  });
  const picking = await page.waitForSelector('#bm-pick-wrap', { state: 'attached', timeout: T(5000) }).then(() => true, () => false);
  await page.keyboard.press('Escape');
  const oneLevel = await page.evaluate(() => ({ picker: !!document.getElementById('bm-pick-wrap'), window: !!document.getElementById('bot-manager'), paused: !document.getElementById('pause').hidden }));
  check(picking && !oneLevel.picker && oneLevel.window && oneLevel.paused, `Esc closes the look picker only, not the Bots window too (${JSON.stringify(oneLevel)})`);
  await page.evaluate(() => document.getElementById('bm-back').click());
  check(await page.waitForFunction(() => !document.getElementById('bot-manager'), null, { timeout: T(5000) }).then(() => true, () => false), "the Bots window's Back button closes it");
  await openPanel(page);
  await page.evaluate(() => document.getElementById('hc-bots').click());
  await page.waitForSelector('#bot-manager', { state: 'attached', timeout: T(5000) });
  // (Clicks by script: the pause menu may be hidden behind the pointer lock it never got here.)
  await page.evaluate(() => {
    document.getElementById('bm-add').click();
    const name = document.getElementById('bm-name-0');
    name.value = 'Sir Testalot';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('bm-look-0').click();
    document.getElementById('bm-pick-core_knight').click();
    const skill = document.getElementById('bm-skill-0');
    skill.value = 'easy';
    skill.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const row = await page.evaluate(() => ({ look: document.querySelector('#bm-look-0 .bm-look-name')?.textContent, portrait: !!document.querySelector('#bm-look-0 img'), sum: document.getElementById('bm-sum').textContent }));
  check(row.look === 'Iron Knight' && row.portrait && /1 bot/.test(row.sum), `the bot's look shows its portrait and the summary counts it (${JSON.stringify(row)})`);
  await page.evaluate(() => document.getElementById('bm-apply').click());
  // Swapped in a bot at a time: the knight takes a random bot's place.
  const knight = await simWait(page, (m) => m.combatants().some((c) => c.kind === 'bot' && c.name === 'Sir Testalot' && c.look === 'core.knight' && c.bot.difficulty.id === 'easy') && m.combatants().length === 6, null, T(10000));
  check(knight, 'Apply brings the named bot into the match with its look and its own skill, the player count kept');
  await page.keyboard.down('Tab');
  const listed = await page.waitForFunction(() => /Sir Testalot/.test(document.getElementById('pause-scores')?.textContent ?? '') || /Sir Testalot/.test(document.getElementById('scoreboard')?.textContent ?? ''), null, { timeout: T(10000) }).then(() => true, () => false);
  await page.keyboard.up('Tab');
  const sum = await page.evaluate(() => document.getElementById('hc-bots-sum')?.textContent);
  check(listed && /1 bot \+ random/.test(sum ?? ''), `the scoreboard lists the bot, and the panel says the set (${sum})`);
  // A rule that needs a restart is marked so, and Apply says it restarts: Apply & restart plays with it at once.
  await page.evaluate(() => document.getElementById('hc-score-plus').click());
  const asks = await page.evaluate(() => ({ apply: document.getElementById('hc-apply').textContent, changes: document.getElementById('hc-changes').textContent, marked: !!document.getElementById('hc-score')?.closest('.field')?.querySelector('.when-tag.restart'), when: document.querySelector('#hc-when .seg-opt.on')?.dataset.value }));
  check(asks.apply === 'Apply & restart' && asks.changes === 'score 16: the match restarts now' && asks.marked && asks.when === 'now', `a change that needs a restart is marked, and Apply says it restarts (${JSON.stringify(asks)})`);
  await page.evaluate(() => document.getElementById('hc-apply').click());
  // (A restart plays the rules waiting for it: the score limit changes only then.)
  const applied = await simWait(page, (m) => m.rules.scoreLimit === 16, null, T(10000));
  const restartFeed = await page.waitForFunction(() => /restarted the match/.test(document.getElementById('feed').textContent ?? ''), null, { timeout: T(5000) }).then(() => true, () => false);
  const pendingNow = await page.evaluate(() => window.__cs.host()?.pending);
  check(applied && restartFeed && !Object.keys(pendingNow ?? {}).length, `Apply & restart starts the match over with the new score limit (${JSON.stringify({ score: await sim(page, (m) => m.rules.scoreLimit), restartFeed, pending: pendingNow })})`);
  // Its countdown first: End match ends a match in play. The match's own phase first: the page can still show the
  // phase from before the restart for a moment on a loaded machine, then its countdown.
  await simWait(page, (m) => m.phase === 'playing', null, T(30000));
  await page.waitForFunction(playing, null, { timeout: T(30000) }).catch(() => {});
  // Save for next match (owner, 2026-11-06): the changed rule waits for the next match; this one carries on.
  await sim(page, (m) => void (m.combatants().find((c) => c.kind === 'human').kills = 3));
  await openPanel(page);
  await page.evaluate(() => {
    document.getElementById('hc-score-plus').click();
    document.getElementById('hc-when-next').click();
  });
  const saving = await page.evaluate(() => ({ apply: document.getElementById('hc-apply').textContent, changes: document.getElementById('hc-changes').textContent, when: document.querySelector('#hc-when .seg-opt.on')?.dataset.value }));
  check(saving.apply === 'Save for next match' && saving.changes === 'score 17 from the next match' && saving.when === 'next', `Next match: Apply becomes Save for next match, and the foot says when it applies (${JSON.stringify(saving)})`);
  await page.evaluate(() => document.getElementById('hc-apply').click());
  const saved = await page.waitForFunction(() => window.__cs.host()?.pending?.scoreLimit === 17, null, { timeout: T(10000) }).then(() => true, () => false);
  const carriesOn = {
    score: await sim(page, (m) => m.rules.scoreLimit),
    kills: await sim(page, (m) => m.combatants().find((c) => c.kind === 'human').kills),
    phase: await page.evaluate(() => window.__cs.phase()),
    line: await page.evaluate(() => document.getElementById('hc-pending')?.textContent ?? ''),
    foot: await page.evaluate(() => ({ apply: document.getElementById('hc-apply').textContent, disabled: document.getElementById('hc-apply').disabled, changes: document.getElementById('hc-changes').textContent })),
  };
  check(saved && carriesOn.score === 16 && carriesOn.kills === 3 && carriesOn.phase === 'playing' && /^Saved for the next match: score 17\./.test(carriesOn.line) && carriesOn.foot.disabled, `Save for next match keeps the rule for the next match and doesn't restart this one (${JSON.stringify(carriesOn)})`);
  // Ending or restarting everyone's match takes a second click.
  const once = await page.evaluate(() => {
    const b = document.getElementById('hc-end');
    b.click();
    return { label: b.textContent, phase: window.__cs.phase() };
  });
  check(once.label === 'Click again to end' && once.phase !== 'intermission', `one click on End match only asks (${JSON.stringify(once)})`);
  await page.evaluate(() => document.getElementById('hc-end').click());
  const ended = await page.waitForFunction(() => window.__cs.phase() === 'intermission', null, { timeout: T(5000) }).then(() => true, () => false);
  check(ended, 'End match goes to the scoreboard');
  // After the scoreboard the next match starts by itself, with the rule saved for it; the HUD and the Host tab follow.
  const nextOne = await page.waitForFunction(() => window.__cs.phase() !== 'intermission' && window.__cs.rules()?.scoreLimit === 17 && !Object.keys(window.__cs.host()?.pending ?? {}).length, null, { timeout: T(30000) }).then(() => true, () => false);
  const nextScore = await sim(page, (m) => m.rules.scoreLimit);
  check(nextOne && nextScore === 17, `the next match plays the saved score limit, and the page hears so (${JSON.stringify({ match: nextScore, page: await page.evaluate(() => window.__cs.rules()?.scoreLimit), pending: await page.evaluate(() => window.__cs.host()?.pending) })})`);
  await page.waitForFunction(playing, null, { timeout: T(30000) }).catch(() => {});
  await endMatch(page);
  await page.waitForFunction(() => window.__cs.phase() === 'intermission', null, { timeout: T(5000) }).catch(() => {});
  await page.evaluate(() => {
    document.getElementById('hc-restart').click();
    document.getElementById('hc-restart').click();
  });
  const restarted = await page.waitForFunction(() => window.__cs.phase() !== 'intermission', null, { timeout: T(5000) }).then(() => true, () => false);
  const keptScore = await sim(page, (m) => m.rules.scoreLimit);
  check(restarted && keptScore === 17, `Restart match starts it over, the applied score limit kept (${keptScore})`);
  await pickMap(page, 'atomic_court');
  // The picked map loads on demand (its own chunk), so the announcement can follow a moment later.
  await page.waitForFunction(() => /Changing map to/i.test(document.getElementById('message').textContent), null, { timeout: T(5000) }).catch(() => {});
  const toast = await page.evaluate(() => document.getElementById('message').textContent);
  check(/Changing map to .*Atomic Court/i.test(toast), `the change is announced (${toast})`);
  const moved = (await simWait(page, (m) => m.map.metadata.id === 'atomic_court', null, T(60000))) && (await page.waitForFunction(() => window.__cs?.local, null, { timeout: T(60000) }).then(() => true, () => false));
  await page.waitForFunction(playing, null, { timeout: T(60000) }).catch(() => {});
  const after = { n: await sim(page, (m) => m.combatants().length), skill: await page.evaluate(() => window.__cs.host()?.skill), knight: await sim(page, (m) => m.combatants().some((c) => c.name === 'Sir Testalot' && c.look === 'core.knight')) };
  check(moved && after.n === 6 && after.skill === 'hard' && after.knight, `the match restarts on the new map with the same players and bots, the named bot too (${JSON.stringify(after)})`);
  await page.context().close();

  // Host game: the host changes map; the friend comes along without a new code.
  const PEER_PORT = +(process.env.E2E_PEER_PORT ?? 9077);
  start('pnpm', ['--filter', '@tiletrigger/server', 'hub'], { PORT: String(PEER_PORT), HOST: '127.0.0.1' });
  await sleep(5000);
  const peer = `&hub=127.0.0.1:${PEER_PORT}`;
  const host = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  host.on('pageerror', (e) => errors.push(`host: ${e.message}`));
  await host.addInitScript(() => (localStorage.setItem('cs.name', 'Hosty'), localStorage.setItem('cs.mapVote', '0')));
  await host.goto(`${CLIENT}/?offline=arena${peer}`, { waitUntil: 'domcontentloaded' });
  await host.waitForFunction(playing, null, { timeout: T(90000) });
  const hasCode = () => /[A-Z0-9]{6}/.test(document.querySelector('#host-info .host-code b')?.textContent ?? '');
  for (let i = 0; i < 3; i++) {
    await host.evaluate(() => document.getElementById('host-game').click());
    if (await host.waitForFunction(hasCode, null, { timeout: T(30000) }).then(() => true, () => false)) break;
  }
  const code = await host.evaluate(() => document.querySelector('#host-info .host-code b')?.textContent ?? '');
  const friend = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
  friend.on('pageerror', (e) => errors.push(`friend: ${e.message}`));
  await friend.addInitScript(() => localStorage.setItem('cs.name', 'Friend'));
  await friend.goto(`${CLIENT}/?join=${code}${peer}`, { waitUntil: 'domcontentloaded' });
  const joined = await friend.waitForFunction(playing, null, { timeout: T(60000) }).then(() => true, () => false);
  check(joined, `a friend joins the hosted match (${code})`);
  if (joined) {
    const guest = await friend.evaluate(() => ({ panel: document.getElementById('host-controls')?.hidden ?? true, tab: document.querySelector('#pause .pause-tabs [data-tab="host"]').hidden, fits: document.querySelector('#pause .pause-card').getBoundingClientRect().bottom <= innerHeight + 1 }));
    check(guest.panel && guest.tab, 'the friend gets no Host tab or host controls');
    check(guest.fits, 'the pause menu fits at 640×360');
    // Everything the friend's feed shows from here on (the match moves on soon after the announcement).
    await friend.evaluate(() => {
      window.__notes = [];
      new MutationObserver(() => window.__notes.push(document.getElementById('feed').textContent)).observe(document.getElementById('feed'), { childList: true, subtree: true });
    });
    await openPanel(host);
    await pickMap(host, 'atomic_court');
    const together = await simWait(host, (m) => m.map.metadata.id === 'atomic_court' && m.combatants().some((c) => c.kind === 'human' && c.name === 'Friend'), null, T(90000));
    check(together, "the friend rejoins the host's new map by themselves");
    const friendThere = await friend.waitForFunction(() => window.__cs?.map === 'atomic_court' && window.__cs.local && document.getElementById('menu').hidden, null, { timeout: T(60000) }).then(() => true, () => false);
    const sameCode = await host.evaluate(() => document.querySelector('#host-info .host-code b')?.textContent ?? '');
    check(friendThere && sameCode === code, `the friend plays on with the same join code (${sameCode})`);
    const heard = await friend.evaluate(() => window.__notes.some((t) => t.includes('Changing map to')));
    check(heard, 'the friend saw the map change announced in the feed');
    // Host game's rotation: the friend's scoreboard says where next, and the friend comes along.
    check(await queueMap(host, 'void_yard', 'Void Yard'), 'the host queues a map in Host game');
    await host.waitForFunction(playing, null, { timeout: T(60000) }).catch(() => {});
    await friend.evaluate(() => {
      const keep = setInterval(() => window.__cs?.hud?.nextMap && ((window.__sawNext = window.__cs.hud.nextMap), clearInterval(keep)), 50);
    });
    await endMatch(host);
    // What the friend's scoreboard says at the end (kept, in case its page is slow and the board isn't drawn before the travel).
    const sawNext = await friend.waitForFunction(() => window.__cs?.hud?.nextMap || window.__sawNext, null, { timeout: T(20000), polling: 50 }).then((h) => h.jsonValue(), () => '');
    check(/Next map: Void Yard \(Deathmatch\)/.test(sawNext), `the friend's end-of-match scoreboard says where the match goes next (${sawNext})`);
    const along = await simWait(host, (m) => m.map.metadata.id === 'void_yard' && m.combatants().some((c) => c.kind === 'human' && c.name === 'Friend'), null, T(90000));
    check(along, 'the rotation takes the friend along to the next map');
  }
  await host.context().close();
  await friend.context().close();

  // After Host game (a match left loading here slowed the friend's rejoin above).
  const solo = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  solo.on('pageerror', (e) => errors.push(`rotation: ${e.message}`));
  await solo.addInitScript(() => localStorage.setItem('cs.mapVote', '0'));
  await solo.goto(`${CLIENT}/?offline=arena`, { waitUntil: 'domcontentloaded' });
  await solo.waitForFunction(playing, null, { timeout: T(60000) });
  // Offline, the map rotation: queue a map, end the match, and after the scoreboard it goes there instead of replaying.
  const empty = await solo.evaluate(() => document.getElementById('hc-rot-next')?.textContent ?? '');
  check(/^Empty/.test(empty), `an empty rotation replays the map (${empty})`);
  const voteBox = await solo.evaluate(() => document.getElementById('hc-rot-vote')?.checked ?? null);
  check(voteBox === false, `the Rotation card's "Vote on the next map" shows the host's setting (off here: ${voteBox})`);
  check(await queueMap(solo, 'void_yard', 'Void Yard'), 'Add map… queues a map: "Next up: Void Yard · Deathmatch"');
  await endMatch(solo);
  check(await boardNote(solo, /Next map: Void Yard \(Deathmatch\)/), 'the end-of-match scoreboard says where the match goes next');
  const rotated = await simWait(solo, (m) => m.map.metadata.id === 'void_yard', null, T(60000));
  await solo.waitForFunction(playing, null, { timeout: T(60000) }).catch(() => {});
  const kept = await solo.evaluate(() => document.getElementById('hc-rot-next')?.textContent ?? '');
  check(rotated && kept === 'Next up: Void Yard · Deathmatch', `after the scoreboard the match travels to the queued map, and the rotation stays (${kept})`);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await solo.context().close();
}

/**
 * Host handoff: a browser hosts (listed) with two friends in. The host names one of them its successor in
 * advance and keeps it checkpointed; when the host leaves, the successor carries the match on in its own
 * browser (the listing moves with it), and the other friend follows, keeping their place and score.
 */
/**
 * Between matches and parties (sim/mapVote.ts, net/party.ts). Offline (?test=1): the match ends, the scoreboard and
 * the vote share the screen (desktop and phone pictures), keys 1-3 / a tap vote, and the next map loads with the same
 * players. Online (a hub, as hostgame): a friend joins by the host's invite link onto the host's side (their party,
 * marked on the scoreboard), both vote, and the party travels to the winner together, on one side again.
 */
async function partyFlow(browser) {
  const errors = [];
  const shots = process.env.E2E_SHOTS;
  const shot = (page, name) => (shots ? page.screenshot({ path: `${shots}/party-${name}.png`, timeout: T(60000) }).catch(() => {}) : Promise.resolve());
  const playing = () => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() !== 'waiting' && window.__cs.phase() !== 'countdown';
  const voteOpen = () => !!window.__cs?.vote?.()?.open && window.__cs.vote().maps.length >= 2;
  // The lightest of the options (the one to vote for, so the next map loads soon on a slow runner).
  const sizes = Object.fromEntries(readdirSync(new URL('../maps/', import.meta.url)).filter((f) => f.endsWith('.json')).map((f) => [f.slice(0, -5), readFileSync(new URL(`../maps/${f}`, import.meta.url)).length]));
  const lightest = (maps) => maps.reduce((best, m, i) => ((sizes[m] ?? 1e9) < (sizes[maps[best]] ?? 1e9) ? i : best), 0);

  // Offline, deterministic: the vote after the match, with keys; the next map with the same players. (Browser tests
  // replay a map that ends, as ever, unless they ask for the vote: &vote=1.)
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => errors.push(`offline: ${e.message}`));
  await page.goto(`${CLIENT}/?test=1&vote=1&offline=arena`, { waitUntil: 'domcontentloaded', timeout: T(60000) });
  await page.waitForFunction(playing, null, { timeout: T(90000) });
  const before = await sim(page, (m) => ({ map: m.map.metadata.id, n: m.combatants().length, people: m.combatants().filter((c) => c.kind === 'human').map((c) => c.name) }));
  // (The scoreboard, and so the vote, held up while the slow pictures are taken; let go after the vote.)
  await sim(page, (m) => {
    m.endMatch();
    m.holdIntermission(m.tick + 60 * 300);
  });
  const opened = await page.waitForFunction(voteOpen, null, { timeout: T(20000) }).then(() => true, () => false);
  // (The scoreboard opens with the intermission's snapshot, which a loaded page may draw a moment after the vote.)
  await page.waitForFunction(() => !document.getElementById('scoreboard').hidden, null, { timeout: T(10000) }).catch(() => {});
  const ballot = await page.evaluate(() => window.__cs.vote());
  check(opened && ballot.maps.length >= 2 && ballot.maps.length <= 3 && !ballot.maps.includes(before.map) && ballot.left > 3, `the match ends into the scoreboard and a vote on 2-3 other maps (${JSON.stringify(ballot)})`);
  const screen = await page.evaluate(() => ({ board: !document.getElementById('scoreboard').hidden, cards: document.querySelectorAll('#map-vote .mv-card').length, pause: !document.getElementById('pause').hidden, overlap: (() => { const a = document.getElementById('scoreboard').getBoundingClientRect(); const b = document.getElementById('map-vote').getBoundingClientRect(); return a.bottom > b.top + 1; })() }));
  check(screen.board && screen.cards === ballot.maps.length && !screen.pause && !screen.overlap, `the scoreboard and the vote's cards share the screen, nothing over them (${JSON.stringify(screen)})`);
  await shot(page, 'vote-desktop');
  const pick = lightest(ballot.maps);
  await page.keyboard.press(`Digit${pick + 1}`);
  const voted = await page.waitForFunction((i) => window.__cs.vote().mine === i && window.__cs.vote().votes[i] === 1, pick, { timeout: T(10000) }).then(() => true, () => false);
  check(voted, `key ${pick + 1} votes, and the host counts it (${JSON.stringify(await page.evaluate(() => window.__cs.vote()))})`);
  await shot(page, 'vote-desktop-voted');
  // Let go of the scoreboard: the vote closes as planned, the winner shows, the match travels. (The winner is noted as
  // it shows: a slow page may be on the next map by the time the runner looks.)
  await page.evaluate(() => {
    const keep = setInterval(() => window.__cs?.vote?.()?.winner && ((window.__won = window.__cs.vote().winner), clearInterval(keep)), 50);
  });
  await sim(page, (m) => (m.phaseEndTick = m.tick + 60 * 6));
  const won = await page.waitForFunction(() => window.__won ?? null, null, { timeout: T(30000), polling: 100 }).then((h) => h.jsonValue(), () => null);
  check(won === ballot.maps[pick], `the vote closes on the map with the votes (${won})`);
  await shot(page, 'vote-desktop-winner');
  const moved = await simWait(page, (m, _me, id) => m.map.metadata.id === id, ballot.maps[pick], T(120000));
  await page.waitForFunction(playing, null, { timeout: T(120000) }).catch(() => {});
  const after = await sim(page, (m) => ({ map: m.map.metadata.id, n: m.combatants().length, people: m.combatants().filter((c) => c.kind === 'human').map((c) => c.name) }));
  check(moved && after.n === before.n && JSON.stringify(after.people) === JSON.stringify(before.people) && !(await page.evaluate(() => window.__cs.vote()?.open)), `the next map loads by itself with the same players (${JSON.stringify({ before, after })})`);
  await page.context().close();

  // A phone (landscape, touch): the same screen fits, and a tap votes.
  const phone = devices['iPhone 13'];
  const pctx = await browser.newContext({ ...phone, viewport: { width: phone.viewport.height, height: phone.viewport.width }, screen: { width: phone.screen.height, height: phone.screen.width } });
  const ph = await pctx.newPage();
  ph.on('pageerror', (e) => errors.push(`phone: ${e.message}`));
  await ph.goto(`${CLIENT}/?test=1&vote=1&offline=arena`, { waitUntil: 'domcontentloaded', timeout: T(60000) });
  await ph.waitForFunction(playing, null, { timeout: T(90000) });
  await sim(ph, (m) => {
    m.endMatch();
    // (The scoreboard and the vote held up for the picture and the tap.)
    m.holdIntermission(m.tick + 60 * 120);
  });
  const pOpen = await ph.waitForFunction(voteOpen, null, { timeout: T(20000) }).then(() => true, () => false);
  const fits = await ph.evaluate(() => {
    const r = document.getElementById('map-vote').getBoundingClientRect();
    const b = document.getElementById('scoreboard').getBoundingClientRect();
    return { inside: r.left >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1, overlap: b.bottom > r.top + 1, cardH: document.querySelector('#map-vote .mv-card')?.getBoundingClientRect().height ?? 0 };
  });
  check(pOpen && fits.inside && !fits.overlap && fits.cardH >= 44, `on a phone the vote fits under the scoreboard, cards big enough to tap (${JSON.stringify(fits)})`);
  await shot(ph, 'vote-phone');
  await ph.tap('#map-vote .mv-card[data-i="1"]');
  const tapped = await ph.waitForFunction(() => window.__cs.vote().mine === 1 && window.__cs.vote().votes[1] === 1, null, { timeout: T(10000) }).then(() => true, () => false);
  check(tapped, 'a tap on a card votes');
  await shot(ph, 'vote-phone-voted');
  await pctx.close();

  // Online: a hub, a host, a friend by the host's invite link.
  const HUB_PORT = +(process.env.E2E_PARTY_HUB_PORT ?? 9079);
  start('pnpm', ['--filter', '@tiletrigger/server', 'hub'], { PORT: String(HUB_PORT), HOST: '127.0.0.1' });
  await waitForHttp(`http://127.0.0.1:${HUB_PORT}/lobby/health`, T(30000)).catch(() => {});
  const hub = `&hub=127.0.0.1:${HUB_PORT}`;
  const host = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  host.on('pageerror', (e) => errors.push(`host: ${e.message}`));
  // (The host's warnings, for the message if the party doesn't arrive together.)
  const hostLog = [];
  host.on('console', (msg) => (msg.type() === 'warning' || msg.type() === 'error') && hostLog.length < 20 && hostLog.push(msg.text().slice(0, 200)));
  await host.addInitScript(() => localStorage.setItem('cs.name', 'Hosty'));
  await host.goto(`${CLIENT}/?offline=void_yard&gamemode=core.tdm${hub}`, { waitUntil: 'domcontentloaded', timeout: T(60000) });
  await host.waitForFunction(playing, null, { timeout: T(90000) });
  const hasCode = () => /[A-Z0-9]{6}/.test(document.querySelector('#host-info .host-code b')?.textContent ?? '');
  for (let i = 0; i < 3; i++) {
    await host.evaluate(() => document.getElementById('host-game').click());
    if (await host.waitForFunction(hasCode, null, { timeout: T(30000) }).then(() => true, () => false)) break;
  }
  const link = await host.evaluate(() => document.querySelector('#host-info input')?.value ?? '');
  check(/[?&]join=[A-Z0-9]{6}&party=[A-Za-z0-9]{6,12}/.test(link), `the host's invite link carries the join code and the party (${link})`);
  const friend = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  friend.on('pageerror', (e) => errors.push(`friend: ${e.message}`));
  await friend.addInitScript(() => localStorage.setItem('cs.name', 'Friend'));
  await friend.goto(link, { waitUntil: 'domcontentloaded', timeout: T(60000) });
  const joined = await friend.waitForFunction(playing, null, { timeout: T(90000) }).then(() => true, () => false);
  check(joined, 'a friend joins by the invite link');
  if (joined) {
    await simWait(host, (m) => m.combatants().some((c) => c.kind === 'human' && c.name === 'Friend'), null, T(10000));
    const sides = () => sim(host, (m) => Object.fromEntries(m.combatants().filter((c) => c.kind === 'human').map((c) => [c.name, { team: c.faction, party: c.party ?? null }])));
    const s1 = await sides();
    check(s1.Friend && s1.Hosty && s1.Friend.team === s1.Hosty.team && s1.Friend.party === s1.Hosty.party && !!s1.Hosty.party, `the friend lands on the host's side, in the host's party (${JSON.stringify(s1)})`);
    const fill1 = await sim(host, (m) => m.combatants().length);
    // The friend can bring more friends: the Match tab's invite link, with the same party.
    const theirs = await friend.evaluate(() => document.getElementById('pause-invite-link')?.value ?? '');
    check(theirs.includes(link.match(/join=[A-Z0-9]{6}/)[0]) && theirs.includes(link.match(/party=[A-Za-z0-9]+/)[0]), `the friend's pause menu offers the same invite (${theirs})`);
    // The match ends: both vote for the same map; the party travels there together.
    await sim(host, (m) => {
      m.endMatch();
      m.holdIntermission(m.tick + 60 * 300);
    });
    const both = await Promise.all([host, friend].map((p) => p.waitForFunction(voteOpen, null, { timeout: T(30000) }).then(() => true, () => false)));
    const maps = await host.evaluate(() => window.__cs.vote().maps);
    const marked = await friend.evaluate(() => [...document.querySelectorAll('#scoreboard .sb-nm.party')].map((n) => n.textContent));
    check(both.every(Boolean) && JSON.stringify(maps) === JSON.stringify(await friend.evaluate(() => window.__cs.vote().maps)), `host and friend get the same ballot (${JSON.stringify(maps)})`);
    check(marked.includes('Hosty') && marked.includes('Friend'), `the scoreboard marks the party (${JSON.stringify(marked)})`);
    await shot(friend, 'vote-online-friend');
    const pickO = lightest(maps);
    await friend.keyboard.press(`Digit${pickO + 1}`);
    await host.keyboard.press(`Digit${pickO + 1}`);
    const counted = await host.waitForFunction((i) => window.__cs.vote().votes[i] === 2, pickO, { timeout: T(15000) }).then(() => true, () => false);
    check(counted, `both votes are counted (${JSON.stringify(await host.evaluate(() => window.__cs.vote()))})`);
    // (Where the host's page is as it goes, for the message if the party doesn't arrive together.)
    await host.evaluate(() => {
      window.__mapTrace = [];
      let last = '';
      const t0 = performance.now();
      setInterval(() => {
        const now = `${window.__cs?.map ?? '-'} ${window.__cs?.phase?.() ?? '-'} vote ${JSON.stringify(window.__cs?.vote?.() ? { w: window.__cs.vote().winner, open: window.__cs.vote().open } : null)}`;
        if (now !== last) window.__mapTrace.push(`${((performance.now() - t0) / 1000).toFixed(1)}s ${(last = now)}`);
      }, 100);
    });
    // (What the host tells its friends as it travels, and what the friend's page shows: for the message.)
    await host.evaluate(() => {
      window.__travelLog = [];
      const t = window.__cs.transport;
      const orig = t.travelGuests?.bind(t);
      if (orig) t.travelGuests = (name) => { window.__travelLog.push(`travelGuests(${name}) links ${JSON.stringify([...(t.links?.values() ?? [])].map((r) => ({ slot: r.slot, open: r.link?.open ?? null })))}`); return orig(name); };
    });
    await friend.evaluate(() => {
      window.__shown = [];
      const h = window.__cs.hud;
      const orig = h.showMessage.bind(h);
      h.showMessage = (text, ...a) => { window.__shown.push(String(text).slice(0, 80)); return orig(text, ...a); };
    });
    await sim(host, (m) => (m.phaseEndTick = m.tick + 60 * 6));
    const together = await simWait(host, (m, _me, id) => m.map.metadata.id === id && m.combatants().some((c) => c.kind === 'human' && c.name === 'Friend'), maps[pickO], T(150000));
    const s2 = together ? await sides() : {};
    const fill2 = await sim(host, (m) => m.combatants().length);
    // (Where each side is, for the message if they didn't get there together.)
    const whereNow = together ? null : { told: await host.evaluate(() => window.__travelLog).catch(() => null), shown: await friend.evaluate(() => window.__shown).catch(() => null), trace: await host.evaluate(() => window.__mapTrace).catch(() => null), log: hostLog, host: await sim(host, (m) => ({ map: m.map.metadata.id, phase: m.phase, humans: m.combatants().filter((c) => c.kind === 'human').map((c) => c.name) })).catch((e) => String(e)), friend: await friend.evaluate(() => ({ map: window.__cs?.map ?? null, phase: window.__cs?.phase?.() ?? null, local: !!window.__cs?.local, menu: !!window.__front && !window.__cs, reconnect: document.getElementById('reconnect')?.textContent ?? null, status: [...document.querySelectorAll('.status, .front-status, #front-status')].map((e) => e.textContent).filter(Boolean).join(' | ').slice(0, 200) })).catch((e) => String(e)) };
    check(together && s2.Friend?.team === s2.Hosty?.team && fill2 === fill1, `the party goes on to the voted map together, on one side, bots filling the rest (${JSON.stringify({ s2, fill1, fill2, ...(whereNow ? { whereNow } : {}) })})`);
    const friendThere = await friend.waitForFunction((id) => window.__cs?.map === id && window.__cs.local, maps[pickO], { timeout: T(90000) }).then(() => true, () => false);
    check(friendThere, "the friend's own page is on the new map too");
  }
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await host.context().close();
  await friend.context().close();
}

async function handoffFlow(browser) {
  // Each of the three pages in a browser of its own (performance round 4, the handoff flake's root cause): in one
  // browser they share one GPU process, whose thread draws every page's frames with SwiftShader, and a page's
  // synchronous WebGL calls (each shader program's link status, its uniform blocks, a context's extensions) wait
  // behind the other two pages' frames. A joining friend's warm-up made a few hundred of those: measured locally, Bo's
  // page waited 30-55 s in a second on them, 3 s a call (e2e glwait). No player's page shares a GPU process with two
  // others; that wait was the "frozen friend" the host dropped as silent.
  const own = [];
  const separate = async () => {
    const b = await browser.browserType().launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'], ...(process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {}) });
    instrumentBrowser(b);
    own.push(b);
    return b;
  };
  try {
    await handoffPages(separate);
  } finally {
    for (const b of own) await b.close().catch(() => {});
  }
}

async function handoffPages(separate) {
  const PEER_PORT = +(process.env.E2E_PEER_PORT ?? 9077);
  start('pnpm', ['--filter', '@tiletrigger/server', 'hub'], { PORT: String(PEER_PORT), HOST: '127.0.0.1' });
  await sleep(5000);
  const hub = `&hub=127.0.0.1:${PEER_PORT}`;
  const errors = [];
  const logs = [];
  const began = Date.now();
  // The pages' console, for a failed check (CI annotations carry it).
  const dump = () => console.log(`handoff console (last 40):\n  ${logs.slice(-40).join('\n  ')}`);
  const playing = () => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() !== 'waiting' && window.__cs.phase() !== 'countdown';
  const open = async (name, url) => {
    const p = await (await (await separate()).newContext({ viewport: { width: 640, height: 360 } })).newPage();
    p.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
    // The friends' console (warnings and up, and timed lines), shown when a check after the handoff fails.
    p.on('console', (m) => (m.type() === 'warning' || m.type() === 'error' || process.env.E2E_HANDOFF_LOG) && logs.push(`${((Date.now() - began) / 1000).toFixed(1)} ${name} ${m.type()}: ${m.text().slice(0, 300)}`));
    // …and the match's worker (where a hosted match runs: matchHost.ts says why it closes a friend's link).
    p.on('worker', (w) => w.on('console', (m) => (m.type() === 'warning' || m.type() === 'error') && logs.push(`${((Date.now() - began) / 1000).toFixed(1)} ${name} worker ${m.type()}: ${m.text().slice(0, 300)}`)));
    // The console's "Failed to load resource" doesn't say which: name it.
    p.on('response', (r) => r.status() >= 400 && logs.push(`${((Date.now() - began) / 1000).toFixed(1)} ${name} ${r.status()}: ${r.url().slice(0, 200)}`));
    await p.addInitScript((n) => localStorage.setItem('cs.name', n), name);
    await p.goto(url, { waitUntil: 'domcontentloaded', timeout: T(60000) });
    return p;
  };
  const host = await open('Hosty', `${CLIENT}/?offline=arena${hub}`);
  await host.waitForFunction(playing, null, { timeout: T(90000) });
  await host.evaluate(() => {
    document.getElementById('host-name').value = 'E2E Handoff';
    const box = document.getElementById('host-list');
    box.checked = true;
    box.dispatchEvent(new Event('change'));
  });
  let listed = false;
  for (let i = 0; i < 3 && !listed; i++) {
    await host.evaluate(() => document.getElementById('host-game').click());
    listed = await host.waitForFunction(() => /^Listed:/.test(document.getElementById('host-public-status').textContent), null, { timeout: T(30000) }).then(() => true, () => false);
  }
  const code = await host.evaluate(() => document.querySelector('#host-info .host-code b')?.textContent ?? '');
  check(listed && /^[A-Z0-9]{6}$/.test(code), `the host's match is listed with a code (${code})`);
  const ann = await open('Ann', `${CLIENT}/?join=${code}${hub}`);
  const bo = await open('Bo', `${CLIENT}/?join=${code}${hub}`);
  // Each friend, once in, looks about now and then, as players do. Left idle they were "away" after 90 s
  // (AWAY.afkSeconds) on a slow run: a bot played for them, and an away friend is no successor (matchHost
  // tendSuccessor), so the successor, its checkpoints and the takeover went with it. (Turning counts as playing:
  // Match.noteActivity.)
  const lookAbout = (p) => p.evaluate(() => setInterval(() => window.__cs?.input && (window.__cs.input.yaw += (window.__lookAbout = -(window.__lookAbout ?? -0.1))), 3000));
  const joins = (p) => p.waitForFunction(playing, null, { timeout: T(120000) }).then(() => lookAbout(p).then(() => true), () => false);
  const inBoth = (await Promise.all([joins(ann), joins(bo)])).every(Boolean);
  check(inBoth, 'two friends join the hosted match');
  if (!inBoth) return void dump();
  // What each friend's link knows: its standby code (asked to stand by), the successor named, a checkpoint.
  const known = (p) => p.evaluate(() => {
    const h = window.__cs?.transport?.handoff;
    const t = window.__cs?.transport;
    return { standby: h?.standby?.code ?? null, next: h?.successor?.code ?? null, name: h?.successor?.name ?? null, cp: !!h?.checkpoint, label: t?.label ?? null, gone: t?.hostGone ?? null, screen: document.getElementById('hl-title')?.textContent ?? null };
  });
  let heir = null;
  let other = null;
  const t0 = Date.now();
  const named = await until(async () => {
    const [a, b] = [await known(ann), await known(bo)];
    if (a?.standby && a.cp && b?.next === a.standby) [heir, other] = [{ page: ann, name: 'Ann' }, { page: bo, name: 'Bo' }];
    else if (b?.standby && b.cp && a?.next === b.standby) [heir, other] = [{ page: bo, name: 'Bo' }, { page: ann, name: 'Ann' }];
    return !!heir;
  }, T(180000));
  check(named, `the host names a successor in advance, everyone knows its code, and it gets checkpoints (${((Date.now() - t0) / 1000).toFixed(0)} s; ${JSON.stringify([await known(ann), await known(bo)])})`);
  if (!named) return void dump();
  // Both friends score: the other one's must survive the handoff. No score limit: on a slow run a bot reaching
  // it would end the round, and the next round's scores start from nothing.
  const scores = { Ann: 7, Bo: 6 };
  await sim(host, (m, me, k) => {
    m.rules.scoreLimit = 0;
    for (const c of m.combatants()) if (c.kind === 'human' && c.name in k) c.kills = k[c.name];
  }, scores);
  // On a loaded machine pings swing, and a clearly better one may take the successor's role over (at most every
  // 30 s): look again for whoever is named now, with a checkpoint carrying the other's score.
  const cpHas = (p, n, k) => p.evaluate(([n, k]) => !!window.__cs?.transport?.handoff?.checkpoint?.cp.players.some((x) => x.name === n && x.k === k), [n, scores[n]]).catch(() => false);
  const carried = await until(async () => {
    const [a, b] = [await known(ann), await known(bo)];
    if (a?.standby && b?.next === a.standby && (await cpHas(ann, 'Bo'))) [heir, other] = [{ page: ann, name: 'Ann' }, { page: bo, name: 'Bo' }];
    else if (b?.standby && a?.next === b.standby && (await cpHas(bo, 'Ann'))) [heir, other] = [{ page: bo, name: 'Bo' }, { page: ann, name: 'Ann' }];
    else return false;
    return true;
  }, T(30000));
  check(carried, "the successor's checkpoint carries the other friend's score");
  if (!carried) return void dump();
  // The host leaves; whichever friend was named last carries the match on.
  await host.evaluate(() => document.getElementById('exitmatch').click());
  await host.evaluate(() => document.getElementById('leave-yes')?.click());
  const hosting = (p) => p.evaluate(() => window.__cs?.transport?.label === 'local' && window.__cs.map === 'phase0_arena' && !!window.__cs.local && /[A-Z0-9]{6}/.test(document.querySelector('#host-info .host-code b')?.textContent ?? '')).catch(() => false);
  const took = await until(async () => {
    if (await hosting(heir.page)) return true;
    if (!(await hosting(other.page))) return false;
    [heir, other] = [other, heir];
    return true;
  }, T(60000));
  check(took, `${heir.name} takes the match over and hosts it`);
  if (!took) return void dump();
  const heirCode = await heir.page.evaluate(() => document.querySelector('#host-info .host-code b').textContent);
  const followed = await other.page.waitForFunction((c) => window.__cs?.transport?.label === `code ${c}` && !!window.__cs.local && !document.getElementById('host-left'), heirCode, { timeout: T(95000) }).then(() => true, () => false);
  check(followed, `${other.name} follows to ${heir.name}'s code (${heirCode}) by themselves`);
  const back = await simWait(heir.page, (m, me, [n, k]) => m.combatants().some((c) => c.kind === 'human' && c.name === n && !c.away && c.kills >= k), [other.name, scores[other.name]], T(30000));
  const seen = await sim(heir.page, (m) => m.combatants().map((c) => `${c.name}:${c.kind}:${c.kills}`));
  check(back, `${other.name} has their place back, with their score (${seen.join(', ')})`);
  if (!followed || !back) dump();
  const moved = await heir.page
    .waitForFunction((c) => fetch(`http://${new URLSearchParams(location.search).get('hub')}/lobby/games`).then((r) => r.json()).then((d) => { const g = (d.games ?? []).filter((x) => x.name === 'E2E Handoff'); return g.length === 1 && g[0].code === c; }), heirCode, { timeout: T(40000), polling: 1000 })
    .then(() => true, () => false);
  check(moved, 'the listing moves to the new host');
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
}

/** Every context a browser opens (the run's own, and the handoff flow's own browsers): its pages tracked for artifacts, low graphics, CI's waits. */
function instrumentBrowser(browser) {
  // Playwright's own default waits (30 s) stretch on CI too.
  const newContext = browser.newContext.bind(browser);
  const open = new Set();
  browser.newContext = async (...a) => {
    const ctx = await newContext(...a);
    open.add(ctx);
    ctx.on('close', () => open.delete(ctx));
    ctx.on('page', (page) => {
      livePages.add(page);
      page.on('close', () => livePages.delete(page));
    });
    // Low graphics unless a flow asks otherwise: software rendering on CI can't afford shadows and
    // post effects, and no check looks at them (the WebGPU flow uses its own browser).
    await ctx.addInitScript((simThread) => {
      try {
        if (!localStorage.getItem('tiletrigger.graphics')) localStorage.setItem('tiletrigger.graphics', 'low');
        if (simThread) localStorage.setItem('tiletrigger.sim', simThread);
      } catch {
        // No storage: the default applies.
      }
    }, MAIN_THREAD_FLOWS.has(currentFlow) ? 'main' : '');
    // A flow closing its pages right after a failed check must not cut that check's screenshot short.
    const close = ctx.close.bind(ctx);
    ctx.close = async (...c) => {
      await Promise.all(shots);
      return close(...c);
    };
    ctx.setDefaultTimeout(T(30000));
    ctx.setDefaultNavigationTimeout(T(30000));
    return ctx;
  };
  return open;
}

/** Each flow's outcome: { flow, status PASS | FLAKY | FAIL, seconds, attempts, fails (failed checks per failed attempt) }. */
const results = [];

/**
 * Per-flow timings (E2E_TIMINGS_OUT=file: JSON merged into e2e/timings.json by tools/ci/timings.mjs), flaky
 * flows (e2e-artifacts/flaky.log) and a table for the CI job summary ($GITHUB_STEP_SUMMARY).
 */
/** This run's timings: passing flows' seconds, and the tour's seconds a map (a 'maps' flow touring E2E_MAPS isn't a part's time). */
function timingsOut() {
  const named = !!process.env.E2E_MAPS;
  const flows = Object.fromEntries(results.filter((r) => r.status === 'PASS' && !(named && MAP_FLOWS.includes(r.flow))).map((r) => [r.flow, Math.round(r.seconds)]));
  return { flows, ...(mapSeconds.length ? { perMap: Math.round(mapSeconds.reduce((a, b) => a + b, 0) / mapSeconds.length) } : {}) };
}

function report() {
  if (!results.length) return;
  try {
    if (process.env.E2E_TIMINGS_OUT) writeFileSync(process.env.E2E_TIMINGS_OUT, JSON.stringify(timingsOut(), null, 2));
  } catch {}
  // The same in the log, on one line (readable from the job log alone).
  console.log(`E2E_TIMINGS ${JSON.stringify(timingsOut())}`);
  const flaky = results.filter((r) => r.status === 'FLAKY');
  for (const r of flaky) console.log(`FLAKY ${r.flow}: ${r.fails.flat().join(' | ')}`);
  if (flaky.length) {
    try {
      mkdirSync(ARTIFACTS, { recursive: true });
      writeFileSync(`${ARTIFACTS}/flaky.log`, flaky.map((r) => `${r.flow}: failed, then passed on retry\n${r.fails.map((f, i) => `  attempt ${i + 1}: ${f.join(' | ')}`).join('\n')}\n`).join('\n'));
    } catch {}
  }
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) {
    const esc = (t) => String(t).replace(/\|/g, '\\|').replace(/\s+/g, ' ').slice(0, 300);
    const label = { PASS: 'pass', FLAKY: '**FLAKY** (passed on retry)', FAIL: '**FAIL**' };
    const rows = results.map((r) => `| ${r.flow} | ${label[r.status]} | ${r.seconds.toFixed(0)} s | ${esc(r.fails.flat().join('; '))} |`);
    try {
      appendFileSync(summary, `### e2e ${process.env.E2E_SHARD_LABEL ?? ''}\n\n| Flow | Result | Time | Failed checks |\n|---|---|---|---|\n${rows.join('\n')}\n\n`);
    } catch {}
  }
}

try {
  start('pnpm', ['--filter', '@tiletrigger/client', 'exec', 'vite', 'preview', '--port', CLIENT_PORT, '--strictPort']);
  // (The flows' server stays on its map: no vote between matches travelling it elsewhere mid-run.)
  start('pnpm', ['--filter', '@tiletrigger/server', 'start'], { PORT: String(SERVER_PORT), BOT_FILL: '3', QUIET_STATS: '1', MAP_VOTE: '0' });
  await waitForHttp(CLIENT);
  await sleep(1500);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  // The contexts it opened (the run closes those a flow left open).
  const open = instrumentBrowser(browser);
  // E2E_ONLY=editor,characters runs a subset; E2E_SHARD=2/8 one of CI's parallel groups (balanced by e2e/timings.json;
  // CI's plan job passes each shard's flows in E2E_ONLY itself).
  const flows = { editor: editorFlow, editorux: editoruxFlow, editorpieces: editorpiecesFlow, editortools: editortoolsFlow, editorenv: editorenvFlow, offline: offlineFlow, mobile: mobileFlow, vault: vaultFlow, outpost: outpostFlow, sandgate: sandgateFlow, citadel: citadelFlow, canyon: canyonFlow, scenery: sceneryFlow, setpieces: setpiecesFlow, physicsfx: physicsfxFlow, teams: teamsFlow, weaponsets: weaponsetsFlow, ctf: ctfFlow, forts: fortsFlow, breakthrough: breakthroughFlow, roulette: rouletteFlow, arsenal: arsenalFlow, vehicles: vehiclesFlow, traffic: trafficFlow, zombies: zombiesFlow, classes: classesFlow, coverage: coverageFlow, ...Object.fromEntries(MAP_FLOWS.map((name, part) => [name, (b) => mapsFlow(b, part)])), designer: designerFlow, ...Object.fromEntries(CHARACTER_FLOWS.map((name, part) => [name, (b) => charactersFlow(b, part)])), online: onlineFlow, hostgame: hostgameFlow, hostcontrols: hostcontrolsFlow, party: partyFlow, lobby: lobbyFlow, handoff: handoffFlow, dedicatedhost: dedicatedhostFlow, hostpage: hostpageFlow, webgpu: webgpuFlow, visual: visualFlow, environment: environmentFlow, flashing: flashingFlow, newplayer: newplayerFlow, fireteams: fireteamsFlow };
  // e2e/flowMap.mjs (change-based selection, shards) must know every flow, and only those.
  const known = new Set(FLOWS);
  const drift = [...Object.keys(flows).filter((f) => !known.has(f)), ...FLOWS.filter((f) => !(f in flows))];
  if (drift.length) throw new Error(`flows missing from e2e/flowMap.mjs FLOWS or from run.mjs: ${drift.join(', ')}`);
  let only = process.env.E2E_ONLY?.split(',').filter(Boolean);
  if (!only && process.env.E2E_SHARD) {
    const [i, n] = process.env.E2E_SHARD.split('/').map(Number);
    const shard = assignShards(FLOWS, loadTimings(), n, FLOWS)[i - 1];
    if (!shard) throw new Error(`no shard ${process.env.E2E_SHARD}`);
    only = shard.flows;
  }
  const unknown = (only ?? []).filter((f) => !(f in flows));
  if (unknown.length) throw new Error(`unknown flows: ${unknown.join(', ')}`);
  mkdirSync(ARTIFACTS, { recursive: true });
  // E2E_RETRIES=1 (CI): a failed flow runs once more; passing then, it is reported as flaky and doesn't fail the run.
  const retries = Number(process.env.E2E_RETRIES ?? 0);
  for (const [name, flow] of Object.entries(flows)) {
    if (only && !only.includes(name)) continue;
    currentFlow = name;
    const t0 = Date.now();
    const before = failures;
    const tries = [];
    for (let attempt = 0; attempt <= retries; attempt++) {
      attemptFails = [];
      failures = before;
      const procsBefore = procs.length;
      if (attempt) console.log(`RETRY ${name} (attempt ${attempt + 1}) after: ${tries.at(-1).join(' | ')}`);
      try {
        await flow(browser);
      } catch (e) {
        // A flow that throws fails as a whole (where in it: the run.mjs frames); the run goes on to the next flow.
        console.log(`FAIL ${name}: ${e.message}`);
        console.log((e.stack ?? '').split('\n').filter((l) => l.includes('run.mjs')).join('\n'));
        failures++;
        attemptFails.push(`threw: ${e.message.split('\n')[0]}${(e.stack ?? '').match(/run\.mjs:(\d+)/) ? ` at run.mjs:${(e.stack ?? '').match(/run\.mjs:(\d+)/)[1]}` : ''}`);
      }
      await Promise.all(shots.splice(0));
      // Pages a flow left open (a running match keeps rendering) would slow every flow after it.
      for (const ctx of [...open]) await ctx.close().catch(() => {});
      tries.push(attemptFails);
      if (failures === before) break;
      // Before a retry, stop what this attempt started (a hub, a Host Service): left running, it keeps its port and the
      // retry's own copy can't bind, so the retry talks to the old one (CI: the Host Service's console said 401 to the
      // retry's pairing token).
      if (attempt < retries) {
        const mine = procs.splice(procsBefore);
        for (const p of mine) {
          try {
            process.kill(-p.pid, 'SIGTERM');
          } catch {}
        }
        await Promise.all(mine.map((p) => (p.exitCode !== null || p.signalCode !== null ? null : Promise.race([new Promise((r) => p.once('exit', r)), sleep(10000)]))));
        await sleep(1000);
      }
    }
    const status = failures > before ? 'FAIL' : tries.length > 1 ? 'FLAKY' : 'PASS';
    const seconds = (Date.now() - t0) / 1000;
    results.push({ flow: name, status, seconds, attempts: tries.length, fails: tries.filter((t) => t.length) });
    console.log(`FLOW ${name} ${status} in ${seconds.toFixed(0)} s${tries.length > 1 ? ` (${tries.length} attempts)` : ''}`);
    // On GitHub, a failed flow is also an annotation, readable from the run's summary and the API without the log.
    if (status === 'FAIL' && process.env.GITHUB_ACTIONS) console.log(`::error title=e2e ${name}::${tries.flat().join(' | ').replace(/[\r\n%]/g, ' ').slice(0, 900)}`);
  }
  await browser.close();
} catch (e) {
  console.log(`FAIL ${e.message}`);
  if (process.env.GITHUB_ACTIONS) console.log(`::error title=e2e run::${String(e.message).replace(/[\r\n%]/g, ' ').slice(0, 900)}`);
  // Where in which flow (the run.mjs frames).
  console.log((e.stack ?? '').split('\n').filter((l) => l.includes('run.mjs')).join('\n'));
  failures++;
} finally {
  for (const p of procs) {
    try {
      process.kill(-p.pid, 'SIGTERM');
    } catch {}
  }
}
report();
console.log(failures ? `${failures} check(s) failed` : 'all e2e checks passed');
process.exit(failures ? 1 : 0);
