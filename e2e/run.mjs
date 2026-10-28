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
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';
import { COVERED_MAPS, FLOWS, MAP_FLOWS, MAP_PARTS } from './flowMap.mjs';
import { assignShards, loadTimings } from './shards.mjs';

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
const MAIN_THREAD_FLOWS = new Set(['setpieces', 'physicsfx', 'ctf', 'forts', 'zombies', 'classes', 'vehicles', 'race', ...MAP_FLOWS]);

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

/** Poll `pred()` (async, node side) until it holds; true if it did within `ms`. */
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
  await page.click('#ed-new');
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
  await page.click('#ed-new');
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
  // Palette pictures come from the prebuilt atlases, one image per group, loaded as a group is shown.
  await page.waitForFunction(() => document.querySelector('#ed-tiles .thumb.atlas .spr'), null, { timeout: T(30000) }).catch(() => {});
  const tilePics = await page.evaluate(() => ({
    bg: getComputedStyle(document.querySelector('#ed-tiles .thumb.atlas .spr') ?? document.body).backgroundImage,
    loaded: [...window.__editor.paletteAtlas.loaded],
    rendered: window.__editor.thumbs.rendered,
  }));
  check(/\/thumbs\/tiles\.[0-9a-f]+\.webp/.test(tilePics.bg), `tile cards show pictures from the tiles atlas (${tilePics.bg.slice(0, 80)})`);
  check(!tilePics.loaded.includes('western') && !tilePics.loaded.includes('scifi') && tilePics.rendered === 0, `only the shown groups' atlases load, nothing is rendered at runtime (${tilePics.loaded.join(', ')}; ${tilePics.rendered} rendered)`);
  // A piece the atlas lacks (new or user content) falls back to the runtime renderer.
  await page.evaluate(async () => {
    const m = await window.__editor.paletteAtlas.manifest;
    delete m.items['prop:prop.barrel'];
  });
  await clickTool(page, '[data-tool="prop:prop.crate_small"]');
  await page.waitForFunction(() => document.querySelector('[data-tool="prop:prop.barrel"] .thumb img')?.src.startsWith('data:image/png'), null, { timeout: T(30000) }).catch(() => {});
  const propPics = await page.evaluate(() => ({ barrel: !!document.querySelector('[data-tool="prop:prop.barrel"] .thumb img')?.src.startsWith('data:image/png'), crate: document.querySelector('[data-tool="prop:prop.crate_small"] .thumb')?.dataset.atlas, loaded: [...window.__editor.paletteAtlas.loaded] }));
  check(propPics.barrel && propPics.crate === 'industrial', `a prop missing from the atlas is rendered at runtime, the rest come from its group's atlas (${JSON.stringify(propPics)})`);
  check(!propPics.loaded.includes('western'), 'closed prop groups load nothing');

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
  await clickTool(page, '[data-tool="prop:prop.barrel"]');
  await clickAt(16, 0, 0);
  await clickTool(page, '[data-tool="tile:core.corridor"]');
  await clickAt(16, 0, 0);
  check((await page.getAttribute('#ed-tb-place', 'class')).includes('active') && (await page.textContent('#ed-tb-place')).includes('Corridor'), 'Place is lit and names the piece');
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
  await page.evaluate(() => window.__editor.view.focus({ x: -14, y: 0, z: 10 }));
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

  // Terrain: scattered plants and rocks are bedded into the ground, a little below level 0; Erase must still reach them.
  await page.click('#ed-env-btn');
  check((await page.getAttribute('#ed-env-btn', 'class')).includes('on') && (await page.isVisible('#ed-pal-tabs [data-ws="environment"][data-pane="paint"]')), 'the Environment workspace shows its own sub-tabs');
  await page.click('#ed-pal-tabs [data-ws="environment"][data-pane="terrain"]');
  await page.click('#ed-tr-new');
  await page.evaluate(() => window.__editor.view.focus({ x: 30, y: 0, z: 30 }));
  await clickTool(page, '[data-tool="scatter:rocks"]');
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
  // One rotation step per kind: R turns a spawn 45°, Shift+R a finer 15°.
  await page.evaluate(() => window.__editor.setTool({ kind: 'spawn' }));
  await clickAt(6, 0, 0);
  const sp0 = (await doc()).entities.filter((e) => e.kind === 'spawn').at(-1);
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
  const sp = await at(sp1?.position[0] ?? 6, (sp1?.position[1] ?? 0) + 0.9, sp1?.position[2] ?? 0);
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
  // The same layout at 1280×720: panels narrow, the tool bar drops its labels, nothing overlaps.
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => document.querySelector('#ed-modes [data-ws="build"]').click());
  await settle();
  check(await page.evaluate(() => { const t = document.getElementById('ed-top'); return t.scrollWidth <= t.clientWidth + 1; }), 'the top bar fits at 1280×720');
  check(await page.evaluate(() => document.getElementById('ed-toolbar').getBoundingClientRect().right <= document.getElementById('ed-right').getBoundingClientRect().left), 'the tool bar stays clear of the right panel at 1280×720');
  await shot('1280');
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
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
  // The setup goes step by step: picking a mode folds it into a line and opens the players.
  await page.click('#arcade-modes .mode-chip');
  const steps = await page.evaluate(() => ({ mode: document.getElementById('step-mode')?.className, players: document.getElementById('step-players')?.className }));
  check(/done/.test(steps.mode ?? '') && /open/.test(steps.players ?? ''), `picking a mode finishes that step and opens the players (${JSON.stringify(steps)})`);
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
  await page.waitForFunction(() => window.__audio.stats.loaded + window.__audio.stats.failed === window.__audio.total, null, { timeout: T(15000) });
  const loaded = await page.evaluate(() => ({ ...window.__audio.stats, total: window.__audio.total }));
  check(loaded.failed === 0 && loaded.loaded === loaded.total, `all ${loaded.total} sounds load and decode (${loaded.failed} failed)`);
  await page.waitForFunction(() => window.__audio.stats.played > 0, null, { timeout: T(20000) }).catch(() => {});
  const played = await page.evaluate(() => window.__audio.stats.played);
  check(played > 0, `match events play sounds (${played} played)`);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
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
  await page.waitForFunction(() => window.__cs.view.scene.meshes.filter((m) => m.name.includes('_terrain_')).length >= 5, null, { timeout: T(15000) }).catch(() => {});
  const grounds = await page.evaluate(() => window.__cs.view.scene.meshes.filter((m) => m.name.includes('_terrain_')).map((m) => m.name.split('_terrain_')[1]));
  check(grounds.length >= 5 && grounds.includes('grass') && grounds.includes('stone'), `canyon terrain is drawn in its ground materials (${grounds.join(', ')})`);
  const y = await page.evaluate(() => window.__cs.local.eye.y);
  check(y > 0.5 && y < 3, `the player stands on the ground at a base (eye ${y.toFixed(2)} m)`);
  // MapMaker: create terrain, sculpt a hill, undo it.
  await page.goto(`${CLIENT}/?mode=editor`);
  await page.waitForFunction(() => window.__editor, null, { timeout: T(30000) });
  page.once('dialog', (d) => d.accept());
  await page.click('#ed-new');
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
  // MapMaker: pick a backdrop, paint plants, scatter a forest.
  await page.goto(`${CLIENT}/?mode=editor`);
  await page.waitForFunction(() => window.__editor, null, { timeout: T(30000) });
  page.once('dialog', (d) => d.accept());
  await page.click('#ed-new');
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
  await page.click('[data-foliage="4"]');
  const at = async (x, z) => page.evaluate(([x, z]) => window.__editor.view.project({ x, y: 0, z }), [x, z]);
  let p = await at(0, 0);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.waitForTimeout(300); // wait-ok: a held brush stroke
  await page.mouse.up();
  const lush = await page.evaluate(() => window.__editor.doc.terrain.foliage.filter((v) => v === 4).length);
  check(lush > 5, `the plants brush paints overgrown cells (${lush})`);
  await clickTool(page, '[data-tool="scatter:forest"]');
  p = await at(20, 20);
  await page.mouse.move(p.x, p.y);
  await page.mouse.click(p.x, p.y);
  const trees = await page.evaluate(() => window.__editor.doc.entities.filter((e) => e.kind === 'prop').length);
  check(trees >= 3, `the scatter brush plants a patch of forest (${trees} trees)`);
  await page.keyboard.press('Control+z');
  const undone = await page.evaluate(() => window.__editor.doc.entities.filter((e) => e.kind === 'prop').length);
  check(undone === 0, 'one undo takes the whole patch back');
  // Props stay on sloping ground: raise a hill, scatter rocks on its side, nothing floats.
  await clickTool(page, '[data-tool="terrain:raise"]');
  p = await at(20, 20);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  // Hold until the hill stands at least 1.5 m tall (headless frame rates vary), at most 8 s.
  await page.waitForFunction(() => Math.max(...window.__editor.doc.terrain.heights) > 150 || window.__editor.stroke?.now && Math.max(...window.__editor.stroke.now.heights) > 150, null, { timeout: T(8000) }).catch(() => {});
  await page.mouse.up();
  await clickTool(page, '[data-tool="scatter:rocks"]');
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
  check(rocks.n > 0 && rocks.worst < 0.02, `scattered rocks sit on the hillside (${rocks.n}, worst gap ${rocks.worst.toFixed(2)} m)`);
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
  await page.waitForFunction(() => window.__cs.view.scene.transformNodes.some((n) => n.name.startsWith('prop_') && !n.name.endsWith('_model') && n.rotationQuaternion && Math.abs(n.rotationQuaternion.x) + Math.abs(n.rotationQuaternion.z) > 0.01), null, { timeout: T(15000) }).catch(() => {});
  // Rocks, logs and plants lean with the slope; trees stay upright; nothing floats.
  const props = await page.evaluate(() => {
    const roots = window.__cs.view.scene.transformNodes.filter((n) => n.name.startsWith('prop_') && !n.name.endsWith('_model'));
    const leaning = roots.filter((n) => n.rotationQuaternion && Math.abs(n.rotationQuaternion.x) + Math.abs(n.rotationQuaternion.z) > 0.01).length;
    return { roots: roots.length, leaning };
  });
  check(props.leaning > 0, `natural props lean with the canyon's slopes (${props.leaning} of ${props.roots})`);
  // Line up a bot in front of you on open ground and kill it: it falls as a ragdoll and bleeds.
  await page.evaluate(() => {
    const m = window.__match;
    const me = m.slots[window.__cs.slot];
    const bot = m.slots.find((c) => c && c !== me && c.alive);
    for (const c of m.slots) if (c && c !== me && c !== bot) c.alive = false;
    const f = window.__cs.view.camera.getForwardRay(1).direction;
    const len = Math.hypot(f.x, f.z) || 1;
    bot.move = { ...bot.move, pos: { x: me.move.pos.x + (f.x / len) * 4, y: me.move.pos.y + 0.5, z: me.move.pos.z + (f.z / len) * 4 }, velY: 0, grounded: false };
    window.__botSlot = bot.slot;
    window.__autoInput = { buttons: 0 };
  });
  // The bot lands where it was put and its avatar stands there.
  await page.waitForFunction(() => {
    const bot = window.__match.slots[window.__botSlot];
    return bot?.move.grounded && !!window.__cs.view.avatars.get(bot.slot)?.anim?.ch.joints.get('Head');
  }, null, { timeout: T(5000) }).catch(() => {});
  await frames(page, 5);
  const standing = await page.evaluate(() => {
    const m = window.__match;
    const me = m.slots[window.__cs.slot];
    const bot = m.slots[window.__botSlot];
    const standing = window.__cs.view.avatars.get(bot.slot)?.anim?.ch.joints.get('Head')?.getAbsolutePosition().y ?? null;
    window.__cs.view.pushPlayer(bot.slot, { x: (bot.move.pos.x - me.move.pos.x) * 1.2, y: 2, z: (bot.move.pos.z - me.move.pos.z) * 1.2 });
    m.damage(bot, 500, me, 'core.pistol');
    return standing;
  });
  await page.addStyleTag({ content: '#pause { display: none !important; }' });
  // Sample the fall while the body is down (the bot respawns 2-3 s after dying).
  // Measured from where its head was before the shot (a slow runner may sample it already down);
  // stop as soon as it has dropped, before the bot gets up again 2-3 s later.
  const track = standing === null ? [] : [standing];
  let ragdolled = false;
  // The push can throw the body up first and land it on something higher than it stood: measure the fall from its peak.
  const fell = () => { const top = track.indexOf(Math.max(...track)); return track.length ? track[top] - Math.min(...track.slice(top)) : 0; };
  for (let i = 0; i < 12 && !(ragdolled && fell() > 0.5); i++) {
    await page.waitForTimeout(T(150) / 2); // wait-ok: sampling interval of the fall
    const s = await page.evaluate(() => {
      // A killed body leaves the live avatars for the corpse list as soon as it ragdolls.
      const v = window.__cs.view;
      const a = v.avatars.get(window.__botSlot) ?? v.corpses.findLast((c) => c.slot === window.__botSlot)?.a;
      const head = a?.anim?.ch.joints.get('Head');
      return { rag: !!a?.ragdoll, head: head ? head.getAbsolutePosition().y : null };
    });
    ragdolled ||= s.rag;
    if (s.head !== null) track.push(s.head);
  }
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/physicsfx-ragdoll.png` });
  // The sampling above stops once the body is down: give the blood time to land.
  await page.waitForFunction(() => window.__cs.view.scene.meshes.some((m) => m.name === 'bloodSplat'), null, { timeout: T(2500) }).catch(() => {});
  const dead = await page.evaluate(() => ({ splats: window.__cs.view.scene.meshes.filter((m) => m.name === 'bloodSplat').length }));
  check(ragdolled && fell() > 0.5, `the killed bot drops as a ragdoll (${ragdolled ? 'ragdoll' : 'no ragdoll'}, head ${track.map((y) => y.toFixed(2)).join(' → ')})`);
  check(dead.splats > 0, `blood splats where it fell (${dead.splats})`);
  // Debris chunks are real bodies: they land and rest on the ground (once the effects world is up).
  await page.waitForFunction(() => !!window.__cs.view.physics, null, { timeout: T(3000) }).catch(() => {});
  await page.evaluate(() => {
    const me = window.__match.slots[window.__cs.slot];
    const f = window.__cs.view.camera.getForwardRay(1).direction;
    window.__cs.view.debris({ x: me.move.pos.x + f.x * 3, y: me.move.pos.y + 1.5, z: me.move.pos.z + f.z * 3 }, '#8a5d33', 0.8);
  });
  await page.waitForFunction(() => window.__cs.view.debrisBodies.length > 0, null, { timeout: T(2000) }).catch(() => {});
  // Headless frame rates are low, so run three seconds of physics at once rather than waiting on the frames.
  const chunks = await page.evaluate(() => {
    const view = window.__cs.view;
    for (let i = 0; i < 180; i++) view.physics.step(1 / 60);
    return view.debrisBodies.map((d) => ({ y: d.body.translation().y, v: Math.hypot(...Object.values(d.body.linvel())) }));
  });
  await page.waitForTimeout(300); // wait-ok: the optional screenshot below shows the settled debris
  check(chunks.length === 10 && chunks.every((c) => c.v < 1.5), `debris chunks land and come to rest (${chunks.length}, fastest ${Math.max(...chunks.map((c) => c.v)).toFixed(2)} m/s)`);
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
  await page.goto(`${CLIENT}/?offline=training_range&test=1&god=1`);
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
    for (let k = 0; k < n; k++) {
      if (await page.evaluate(done)) break;
      await page.evaluate(() => (window.__autoInput = { buttons: 2 }));
      await page.waitForTimeout(T(200)); // wait-ok: holds the trigger for a shot
      await page.evaluate(() => (window.__autoInput = { buttons: 0 }));
      await page.waitForTimeout(T(250)); // wait-ok: between shots
    }
  };
  const z = (i) => -8 - i * 2.6;
  await fireAt(z(10), 4);
  await page.waitForFunction(() => window.__cs.view.scenario.glass.counts.cracks > 0, null, { timeout: T(5000) }).catch(() => {});
  const proof = await page.evaluate(() => {
    const m = window.__match;
    const i = m.map.entities.findIndex((e) => e.id === 'panel_bulletproof');
    const s = m.scenario.fullState().es.find(([k]) => k === i);
    return { health: s ? s[1] : null, cracks: window.__cs.view.scenario.glass.counts.cracks };
  });
  check(proof.health !== null && proof.health > 0 && proof.health < 100 && proof.cracks > 0, `bulletproof glass stops the rounds, cracks where they strike and holds (${JSON.stringify(proof)})`);
  await fireAt(z(0), 5, () => window.__match.scenario.destructibleAlive('panel_0') === false);
  await page.waitForFunction(() => window.__cs.view.scene.meshes.some((m) => m.name === 'glassShard'), null, { timeout: T(5000) }).catch(() => {});
  const broke = await page.evaluate(() => ({ alive: window.__match.scenario.destructibleAlive('panel_0'), shards: window.__cs.view.scene.meshes.filter((m) => m.name === 'glassShard').length }));
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
  await page.click('#step-players .step-head');
  await page.selectOption('#arcade-teams', '2,2,2,2,2,2,12');
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
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
  await customSetupFlow(browser);
}

/**
 * Match setup on the smallest window (640 × 360): a custom uneven three-team
 * setup (2v3v5, you on the third team) is saved by name, survives a reload
 * and a change, loads back, and starts with those sizes.
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
  await page.click('#step-players .step-head');
  await page.waitForSelector('#arcade-team-cards');
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
  await page.click('#step-players .step-head');
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

async function arsenalFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  await page.goto(`${CLIENT}/?offline=canyon&test=1&god=1`);
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() !== 'waiting' && window.__cs.phase() !== 'countdown' && window.__give, null, { timeout: T(60000) });
  // Fire a spread of the new weapons (scripted input: headless browsers have no pointer lock).
  for (const id of ['core.flamethrower', 'core.oil_slicker', 'core.laser_rifle', 'core.railgun', 'core.bubble_blaster', 'core.swarm', 'core.disc_launcher', 'core.arc_caster', 'core.goo_gun', 'core.burst_rifle']) {
    await page.evaluate((w) => {
      window.__give(w);
      window.__cs.input.pitch = -0.25;
      window.__autoInput = { buttons: 2 };
    }, id);
    await page.waitForTimeout(T(500)); // wait-ok: fires the weapon for half a second
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
  const bar = await page.evaluate(() => document.getElementById('weapon-bar').textContent);
  check(/•/.test(bar ?? ''), `the weapon bar shows several weapons in a slot (${bar})`);
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
  // H switches to the chase camera (remembered for ground vehicles): behind the buggy, outside it and clear of walls.
  await page.keyboard.press('KeyH');
  await page.waitForTimeout(T(800)); // wait-ok: the camera eases out to the chase view
  let worst = null;
  for (let i = 0; i < 5; i++) {
    const c = await rideCam();
    if (!worst || c.inBox || !c.clear || !c.sight || c.view !== 'chase') worst = c;
    await page.waitForTimeout(T(150)); // wait-ok: sampling interval
  }
  const saved = await page.evaluate(() => localStorage.getItem('tiletrigger.vehicleCamera'));
  check(worst.view === 'chase' && !worst.inBox && worst.clear && worst.sight && worst.dist > 1, `H gives a chase camera outside the buggy and not in a wall (${JSON.stringify({ view: worst.view, inBox: worst.inBox, clear: worst.clear, sight: worst.sight, dist: worst.dist?.toFixed(1) })})`);
  check(/"ground":"chase"/.test(saved ?? ''), `the choice is remembered for ground vehicles (${saved})`);
  // Press E (again, if a slow frame swallowed the press) until we're out.
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => (window.__autoInput = { buttons: 0, once: 16 }));
    const out = await page.waitForFunction(() => !window.__match.slots[window.__cs.slot].mount, null, { timeout: T(5000) }).then(() => true, () => false);
    if (out) break;
  }
  check(await page.evaluate(() => !window.__match.slots[window.__cs.slot].mount), 'E again gets you out');
  // Out of the chase camera: back at your own eye, level.
  await page.evaluate(() => (window.__autoInput = { buttons: 0 }));
  await page.waitForTimeout(T(500)); // wait-ok: the camera eases back to your eye
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
}

/** Race mode on Sandsweep Circuit, and drawing a track with MapMaker's Road tool. */
async function raceFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 820 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  // MapMaker: lay a road with three clicks, drag a point, undo, set the laps, delete a point.
  await page.goto(`${CLIENT}/?mode=editor`);
  await page.waitForFunction(() => window.__editor, null, { timeout: T(30000) });
  page.once('dialog', (d) => d.accept());
  await page.click('#ed-new');
  await page.evaluate(() => window.__editor.view.focus({ x: 12, y: 0, z: -2 }));
  const doc = () => page.evaluate(() => window.__editor.doc);
  const at = (x, z) => page.evaluate(([x, z]) => window.__editor.view.project({ x, y: 0, z }), [x, z]);
  const clickWorld = async (x, z) => {
    const p = await at(x, z);
    await page.mouse.move(p.x, p.y);
    await page.mouse.click(p.x, p.y);
  };
  await clickTool(page, '[data-tool="road"]');
  // Let the new map settle (its first frame resets the view), then look at where the road goes.
  await frames(page, 3);
  await page.evaluate(() => window.__editor.view.focus({ x: 12, y: 0, z: -2 }));
  await clickWorld(8, -6);
  await clickWorld(16, -6);
  await clickWorld(13, 4);
  let d = await doc();
  check(d.track?.points.length === 3 && d.track.loop, `three clicks lay a circuit (${d.track?.points.length ?? 0} points)`);
  const from = await at(16, -6);
  const to = await at(19, -8);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  d = await doc();
  check(d.track && Math.hypot(d.track.points[1][0] - 19, d.track.points[1][2] + 8) < 1.5, `dragging a road point moves it (${d.track?.points[1]?.join(', ')})`);
  await page.keyboard.press('Control+KeyZ');
  d = await doc();
  check(d.track && Math.hypot(d.track.points[1][0] - 16, d.track.points[1][2] + 6) < 1, 'undo puts it back');
  // The pane is rebuilt after the undo; if the edit hit the old input, set it again on the new one.
  let laps;
  for (let tries = 0; tries < 3 && laps !== 5; tries++) {
    await page.fill('#ed-road-laps', '5');
    await page.dispatchEvent('#ed-road-laps', 'change');
    laps = await page.waitForFunction(() => window.__editor.doc.track?.laps === 5, null, { timeout: T(2000) }).then(() => 5, async () => (await doc()).track?.laps);
  }
  check(laps === 5, `the Road pane sets the laps (${laps})`);
  await page.waitForFunction(() => window.__editor.view.scene.meshes.some((m) => m.name === 'edroad_surface' && m.getTotalVertices() > 0), null, { timeout: T(5000) }).catch(() => {});
  check(await page.evaluate(() => window.__editor.view.scene.meshes.some((m) => m.name === 'edroad_surface' && m.getTotalVertices() > 0)), 'MapMaker draws the road ribbon');
  const del = await at(13, 4);
  await page.mouse.move(del.x, del.y);
  await page.mouse.click(del.x, del.y, { button: 'right' });
  d = await doc();
  check(d.track?.points.length === 2, `right-click deletes a road point (${d.track?.points.length})`);
  await page.keyboard.press('Escape');

  // A race on Sandsweep Circuit: on the grid in a speeder, the countdown, then away.
  await page.goto(`${CLIENT}/?offline=sandsweep&gamemode=core.race`);
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__match?.race && window.__match.phase === 'playing' && window.__cs.phase() === 'playing', null, { timeout: T(60000) });
  const start = await page.evaluate(() => {
    const m = window.__match;
    const me = m.slots[window.__cs.slot];
    return { seat: me.mount?.seat, grid: me.mount ? m.mounts[me.mount.index].index >= m.map.entities.length : false, racers: m.combatants().length, seated: m.combatants().filter((c) => c.mount?.seat === 0).length, placed: m.combatants().filter((c) => m.race.status(c.slot)).length };
  });
  check(start.seat === 0 && start.grid, `you start at the wheel of a grid vehicle (seat ${start.seat})`);
  // A combat race may already have wrecked someone (they are back in a moment): nearly everyone is at the wheel.
  check(start.placed === start.racers && start.seated >= start.racers - 2, `every racer has a vehicle (${start.seated}/${start.racers} at the wheel)`);
  const road = await page.evaluate(() => window.__cs.view.scene.meshes.filter((m) => /^road_/.test(m.name)).length);
  check(road > 5, `the road, curbs and arches are drawn (${road} meshes)`);
  // Headless frame rates are slow: run the clock past the countdown.
  await page.evaluate(() => {
    for (let i = 0; i < 60 * 4 && window.__match.race.state === 0; i++) window.__match.step();
  });
  check(await page.evaluate(() => window.__match.race.state === 1), 'the countdown ends and the race is on');
  await page.waitForFunction(() => /Lap 1\/3/.test(document.body.textContent ?? ''), null, { timeout: T(8000) }).catch(() => {});
  check(await page.evaluate(() => /Lap 1\/3/.test(document.body.textContent ?? '')), 'the HUD shows the lap');
  const rows = await page.evaluate(() => document.getElementById('race-order')?.children.length ?? 0);
  check(rows === start.racers, `the running order lists every racer (${rows})`);
  await page.evaluate(() => (window.__autoInput = { forward: 1, buttons: 0 }));
  await page.waitForFunction(() => (window.__match.race.status(window.__cs.slot)?.passed ?? 0) >= 1, null, { timeout: T(20000) }).catch(() => {});
  const me = await page.evaluate(() => window.__match.race.status(window.__cs.slot));
  check(me?.lap === 1 && me.passed >= 1, `you drive over the start line onto lap 1 (passed ${me?.passed})`);
  await page.waitForFunction(() => !!document.querySelector('.mode-marker[data-id="race_next"]'), null, { timeout: T(5000) }).catch(() => {});
  check(await page.evaluate(() => !!document.querySelector('.mode-marker[data-id="race_next"]')), 'a marker points to the next checkpoint');
  // The bots race too.
  await page.evaluate(() => {
    for (let i = 0; i < 60 * 12; i++) window.__match.step();
  });
  const bots = await page.evaluate(() => window.__match.combatants().filter((c) => c.bot).map((c) => window.__match.race.status(c.slot)?.passed ?? 0));
  check(bots.length > 0 && bots.every((n) => n >= 2), `the bots drive the checkpoints (${bots.join(', ')})`);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

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
}

/** Draw `n` more frames (a page's own clock, whatever the machine's speed). */
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
  { name: 'canyon', url: '/?offline=canyon&test=1&god=1&bots=1&name=Tester', ready: () => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() === 'playing' && !document.getElementById('view').classList.contains('veiled'), css: '#pause, #message { display: none !important; }', share: 0.1 },
];

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

async function designerFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 1200, height: 760 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  await page.goto(CLIENT);
  await page.click('#nav-characters');
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
  await page.goto(`${CLIENT}/?offline`);
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() !== 'waiting' && window.__cs.phase() !== 'countdown', null, { timeout: T(60000) });
  await page.waitForFunction(() => window.__cs.view.hasFirstPersonArms(), null, { timeout: T(20000) }).catch(() => {});
  check(await page.evaluate(() => window.__cs.view.hasFirstPersonArms()), 'first-person arms of the custom look hold the weapon');
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
    check(errors.length === 0, `no page or WebGPU errors (${errors.join('; ')})`);
  } finally {
    await browser.close();
  }
}

async function charactersFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(process.env.E2E_STACKS ? e.stack : e.message));
  await page.goto(`${CLIENT}/?mode=characters`);
  await page.waitForFunction(() => window.__charsReady === true, null, { timeout: T(30000) });
  const [n, want] = await page.evaluate(() => [window.__charAnimators.length, window.__charSpecs]);
  check(n === want && n >= 20, `character viewer builds every look and NPC (${n} of ${want})`);
  const lod = await page.evaluate(() => window.__charAnimators.filter((a) => a.ch.meshes.some((m) => m.getLODLevels?.().length)).length);
  check(lod === n, `every character has low-detail levels (${lod} of ${n})`);
  // Parts sharing a material are merged, and skin, hair, eyes and gear share the character atlas: a character is
  // its outfit and its atlas draw (2 on average, 3 where a look mixes outfit families), not one per part.
  const draws = await page.evaluate(() => window.__charAnimators.map((a) => a.ch.meshes.filter((m) => !m.isDisposed() && !m.isBlocked && m.getTotalVertices() > 0).length));
  const most = Math.max(...draws);
  check(most <= 4 && draws.reduce((s, d) => s + d, 0) / draws.length <= 2.5, `characters draw a few merged meshes each (at most ${most}, ${(draws.reduce((s, d) => s + d, 0) / draws.length).toFixed(1)} on average)`);
  for (const label of ['Rifle', 'Run', 'shoot', 'Death', 'Idle']) {
    await page.click(`button:text-is("${label}")`);
    await page.waitForTimeout(300); // wait-ok: plays each clip a moment (page errors are what's checked)
  }
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
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
  const relayNote = await host.evaluate(() => document.getElementById('host-info').textContent);
  check(relayNote.includes('hub provides a relay'), 'the hub hands out relay credentials, and the host is told');
  const player = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  player.on('pageerror', (e) => errors.push(`player: ${e.message}`));
  await player.addInitScript(() => localStorage.setItem('cs.name', 'Stranger'));
  await player.goto(`${CLIENT}/?${hub}`, { waitUntil: 'domcontentloaded' });
  await player.waitForFunction(() => window.__front, null, { timeout: T(30000) });
  await player.evaluate(() => document.getElementById('nav-online')?.click());
  const row = await player.waitForFunction(() => [...document.querySelectorAll('.gb-row:not(.gb-head)')].map((r) => r.textContent).find((t) => t.includes('E2E Friday Night')) ?? null, null, { timeout: T(15000) }).then((h) => h.jsonValue(), () => null);
  check(!!row && row.includes('1/') && row.includes('Hosty') && row.includes('Relay'), `the game browser lists it, with the relay badge (${row})`);
  await player.evaluate(() => [...document.querySelectorAll('.gb-row:not(.gb-head)')].find((r) => r.textContent.includes('E2E Friday Night')).querySelector('button').click());
  const joined = await player.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() !== 'waiting' && window.__cs.phase() !== 'countdown', null, { timeout: T(60000) }).then(() => true, () => false);
  check(joined, 'joining from the game browser puts the player in the match');
  if (joined) {
    // The next check-in reports two players.
    const two = await player.waitForFunction(() => fetch(`http://${new URLSearchParams(location.search).get('hub')}/lobby/games`).then((r) => r.json()).then((d) => d.games.find((g) => g.name === 'E2E Friday Night')?.players === 2), null, { timeout: T(30000), polling: 2000 }).then(() => true, () => false);
    check(two, 'the listing updates to 2 players');
  }
  await host.context().close();
  const gone = await player.waitForFunction(() => fetch(`http://${new URLSearchParams(location.search).get('hub')}/lobby/games`).then((r) => r.json()).then((d) => !d.games.some((g) => g.name === 'E2E Friday Night')), null, { timeout: T(15000), polling: 1000 }).then(() => true, () => false);
  check(gone, 'the listing goes away when the host closes the game');
  await player.context().close();

  // Offline by default; "Go online" restarts the match and lists it; "Go offline" takes it down again.
  const solo = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
  solo.on('pageerror', (e) => errors.push(`solo: ${e.message}`));
  await solo.addInitScript(() => localStorage.setItem('cs.name', 'Solo'));
  await solo.goto(`${CLIENT}/?offline=sandgate&${hub}`, { waitUntil: 'domcontentloaded' });
  await solo.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() !== 'waiting' && window.__cs.phase() !== 'countdown', null, { timeout: T(60000) });
  const offline = await solo.evaluate(() => ({ online: !document.getElementById('go-online').hidden, badge: !!window.__cs.hud.onlineNote }));
  check(offline.online && !offline.badge, 'an offline match stays offline and offers "Go online"');
  const listedAs = (name) => solo.evaluate((n) => fetch(`http://${new URLSearchParams(location.search).get('hub')}/lobby/games`).then((r) => r.json()).then((d) => d.games.some((g) => g.name === n)), name);
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
  const down = await solo.waitForFunction(() => fetch(`http://${new URLSearchParams(location.search).get('hub')}/lobby/games`).then((r) => r.json()).then((d) => !d.games.some((g) => g.name === 'E2E Go Online')), null, { timeout: T(15000), polling: 1000 }).then(() => true, () => false);
  const after = await solo.evaluate(() => ({ badge: !!window.__cs.hud.onlineNote, online: !document.getElementById('go-online').hidden }));
  check(down && !after.badge && after.online, 'Go offline removes the listing and the online line');
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await solo.context().close();
}

/** A Host Service (packages/host) on a local hub: started as the owner would (`pnpm host`), with its own state folder. */
async function startHostService({ hubPort, controlPort, env = {}, idle = false }) {
  const state = mkdtempSync(join(tmpdir(), 'tt-host-e2e-'));
  start('pnpm', ['--silent', '--filter', '@tiletrigger/host', 'start', ...(idle ? ['--', '--idle'] : [])], {
    HUB: `http://127.0.0.1:${hubPort}`,
    CONTROL_PORT: String(controlPort),
    HOST_STATE_DIR: state,
    STATUS_EVERY: '0',
    ...env,
  });
  return state;
}

/** Listings on a local hub (node side). */
const hubGames = (port) => fetch(`http://127.0.0.1:${port}/lobby/games`).then((r) => r.json()).then((d) => d.games);

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
  const hostState = await startHostService({ hubPort: HUB_PORT, controlPort: CONTROL_PORT, env: { MAP: 'sandgate', MODE: 'core.tdm', BOT_FILL: '8', SERVER_NAME: 'E2E Dedicated', ADMIN_TOKEN: 'e2e-admin-token' } });
  const listed = await until(async () => (await hubGames(HUB_PORT)).some((g) => g.name === 'E2E Dedicated'), T(60000));
  check(listed, 'the Host Service registers on the hub and lists itself');
  if (!listed) return;
  const game = (await hubGames(HUB_PORT)).find((g) => g.name === 'E2E Dedicated');
  check(game.hostType === 'dedicated' && game.relay && !game.community && game.mapId === 'sandgate', `listed as a dedicated host with a relay, on our map (${JSON.stringify(game)})`);

  const hub = `hub=127.0.0.1:${HUB_PORT}`;
  const errors = [];
  const probes = [];
  const open = async (name, url) => {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
    page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
    // Nothing but /host may look for a Host Service on this computer.
    page.on('request', (r) => /127\.0\.0\.1:(7797|7801|7802)/.test(r.url()) && probes.push(r.url()));
    await page.addInitScript((n) => localStorage.setItem('cs.name', n), name);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    return page;
  };
  const playing = () => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() !== 'waiting' && window.__cs.phase() !== 'countdown';

  // A player finds it in the game browser and joins from there.
  const player = await open('Visitor', `${CLIENT}/?${hub}`);
  await player.waitForFunction(() => window.__front, null, { timeout: T(30000) });
  await player.evaluate(() => document.getElementById('nav-online')?.click());
  const row = await player.waitForFunction(() => [...document.querySelectorAll('.gb-row:not(.gb-head)')].map((r) => r.textContent).find((t) => t.includes('E2E Dedicated')) ?? null, null, { timeout: T(30000) }).then((h) => h.jsonValue(), () => null);
  check(!!row && row.includes('Dedicated host') && !row.includes('Player-hosted'), `the game browser shows it as a Dedicated host (${row})`);
  await player.evaluate(() => [...document.querySelectorAll('.gb-row:not(.gb-head)')].find((r) => r.textContent.includes('E2E Dedicated')).querySelector('button').click());
  const joined = await player.waitForFunction(playing, null, { timeout: T(60000) }).then(() => true, () => false);
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
    const adminIn = await admin.waitForFunction(playing, null, { timeout: T(60000) }).then(() => true, () => false);
    if (!adminIn) console.log(readFileSync(join(hostState, 'logs', 'host.log'), 'utf8').split('\n').slice(-25).join('\n'));
    check(adminIn, `the owner joins by code${adminIn ? '' : ` (${await admin.evaluate(() => document.body.innerText.match(/(Disconnected|couldn|no game)[^\n]*/)?.[0] ?? window.__cs?.phase?.() ?? 'no session').catch(() => '')})`}`);
    const slot = await player.evaluate(() => window.__cs.slot);
    const button = await admin.waitForFunction((s) => !!document.getElementById(`hc-kick-${s}`), slot, { timeout: T(45000), polling: 500 }).then(() => true, () => false);
    check(button, `the admin gets the match controls, with the visitor in its player list${button ? '' : ` (${await admin.evaluate(() => JSON.stringify({ host: window.__cs?.host?.(), panels: document.querySelectorAll('[id=host-controls]').length, people: [...document.querySelectorAll('.hc-person')].map((e) => e.textContent), ids: [...document.querySelectorAll('[id^=hc-kick]')].map((e) => e.id), roster: [...(window.__cs?.hud?.roster?.values() ?? [])].filter((p) => !p.bot).map((p) => `${p.slot}:${p.name}`) }))}, visitor slot ${slot})`}`);
    if (button) {
      await admin.evaluate((s) => document.getElementById(`hc-kick-${s}`).click(), slot);
      const kicked = await player.waitForFunction(() => /kicked/i.test(document.body.innerText), null, { timeout: T(20000) }).then(() => true, () => false);
      // What the player saw and what the host logged, when the kick didn't land (CI annotations carry it).
      const why = kicked
        ? ''
        : ` (player: ${await player.evaluate(() => JSON.stringify({ phase: window.__cs?.phase?.(), slot: window.__cs?.slot, text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 240) })).catch((e) => `gone: ${e.message.slice(0, 80)}`)}; host log: ${(() => { try { return readFileSync(join(hostState, 'logs', 'host.log'), 'utf8').split('\n').filter(Boolean).slice(-8).join(' / ').slice(0, 500); } catch { return 'none'; } })()})`;
      check(kicked, `the kicked player is told and leaves the match${why}`);
    }
  }
  check(probes.length === 0, `pages other than /host never look for a Host Service (${probes.join(', ')})`);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);

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
    await page.fill('#hp-fill', '8');
    await page.click('#hp-start');
    const running = await page.waitForFunction(() => /Running/.test(document.getElementById('hp-run-state')?.textContent ?? ''), null, { timeout: T(60000) }).then(() => true, () => false);
    check(running, `Start starts the server (${await page.evaluate(() => document.getElementById('hp-status')?.textContent)})`);
    const listed = await until(async () => (await hubGames(HUB_PORT)).some((g) => g.name === 'E2E From Host Page' && g.hostType === 'dedicated'), T(30000));
    check(listed, 'the server it started is in the game browser');
    await page.click('#hp-stop');
    const stopped = await page.waitForFunction(() => /^Stopped/.test(document.getElementById('hp-run-state')?.textContent ?? ''), null, { timeout: T(30000) }).then(() => true, () => false);
    const gone = await until(async () => !(await hubGames(HUB_PORT)).some((g) => g.name === 'E2E From Host Page'), T(20000));
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
    await launcher.click('#f-vis button[data-v="listed"]');
    const ran = await launcher.waitForFunction(() => [...document.querySelectorAll('#log .ln.cmd')].some((l) => /visibility listed/.test(l.textContent)), null, { timeout: T(10000) }).then(() => true, () => false);
    check(ran, 'a right-bar toggle runs its console command (visibility listed)');
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
    await page.waitForSelector('#host-maps', { timeout: T(10000) });
    await page.evaluate((mapId) => {
      document.querySelector('#host-maps .hm-modes [data-mode="core.deathmatch"]')?.click();
      document.querySelector(`#host-maps .map-card[data-id="${mapId}"]`).click();
      document.getElementById('hm-go').click();
    }, id);
  };

  // Offline: the player runs the match.
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  page.on('pageerror', (e) => errors.push(`offline: ${e.message}`));
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
  const fits = await page.evaluate(() => {
    const r = document.querySelector('#pause .pause-card').getBoundingClientRect();
    return r.top >= 0 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1;
  });
  check(fits, 'the pause menu fits the window');
  await openPanel(page);
  await page.evaluate(() => {
    document.getElementById('hc-players-plus').click();
    document.getElementById('hc-players-plus').click();
    document.querySelector('#hc-skill [data-value="hard"]').click();
    document.getElementById('hc-apply').click();
  });
  const six = await simWait(page, (m) => m.combatants().length === 6, null, T(5000));
  const feed = await page.evaluate(() => document.getElementById('feed').textContent);
  check(six && feed.includes('Host set the match to 6 players, bot skill to hard'), `Apply adds bots live, with a feed line (${feed})`);
  const hard = await sim(page, (m) => m.combatants().filter((c) => c.bot).every((c) => c.bot.difficulty.id === 'hard'));
  check(hard, 'bot skill changes live');
  // A rule change waits for the restart (the panel says so), then Restart match plays with it.
  await page.evaluate(() => {
    document.getElementById('hc-score-plus').click();
    document.getElementById('hc-apply').click();
  });
  const waiting = await page.waitForFunction(() => window.__cs.host()?.pending?.scoreLimit === 16 && document.getElementById('hc-pending'), null, { timeout: T(5000) }).then(() => true, () => false);
  const still = await sim(page, (m) => m.rules.scoreLimit);
  check(waiting && still === 15, `a score limit change waits for the restart (now ${still})`);
  await page.evaluate(() => document.getElementById('hc-end').click());
  const ended = await page.waitForFunction(() => window.__cs.phase() === 'intermission', null, { timeout: T(5000) }).then(() => true, () => false);
  check(ended, 'End match goes to the scoreboard');
  await page.evaluate(() => document.getElementById('hc-restart').click());
  const restarted = await page.waitForFunction(() => window.__cs.phase() !== 'intermission', null, { timeout: T(5000) }).then(() => true, () => false);
  check(restarted, 'Restart match starts it over');
  const applied = { score: await sim(page, (m) => m.rules.scoreLimit), pending: await page.evaluate(() => window.__cs.host()?.pending) };
  check(applied.score === 16 && !Object.keys(applied.pending ?? {}).length, `the restart plays with the waiting rule change (${JSON.stringify(applied)})`);
  await pickMap(page, 'atomic_court');
  // The picked map loads on demand (its own chunk), so the announcement can follow a moment later.
  await page.waitForFunction(() => /Changing map to/i.test(document.getElementById('message').textContent), null, { timeout: T(5000) }).catch(() => {});
  const toast = await page.evaluate(() => document.getElementById('message').textContent);
  check(/Changing map to .*Atomic Court/i.test(toast), `the change is announced (${toast})`);
  const moved = (await simWait(page, (m) => m.map.metadata.id === 'atomic_court', null, T(60000))) && (await page.waitForFunction(() => window.__cs?.local, null, { timeout: T(60000) }).then(() => true, () => false));
  await page.waitForFunction(playing, null, { timeout: T(60000) }).catch(() => {});
  const after = { n: await sim(page, (m) => m.combatants().length), skill: await page.evaluate(() => window.__cs.host()?.skill) };
  check(moved && after.n === 6 && after.skill === 'hard', `the match restarts on the new map with the same players and bots (${JSON.stringify(after)})`);
  await page.context().close();

  // Host game: the host changes map; the friend comes along without a new code.
  const PEER_PORT = +(process.env.E2E_PEER_PORT ?? 9077);
  start('pnpm', ['--filter', '@tiletrigger/server', 'hub'], { PORT: String(PEER_PORT), HOST: '127.0.0.1' });
  await sleep(5000);
  const peer = `&hub=127.0.0.1:${PEER_PORT}`;
  const host = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  host.on('pageerror', (e) => errors.push(`host: ${e.message}`));
  await host.addInitScript(() => localStorage.setItem('cs.name', 'Hosty'));
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
  }
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await host.context().close();
  await friend.context().close();
}

/** Each flow's outcome: { flow, status PASS | FLAKY | FAIL, seconds, attempts, fails (failed checks per failed attempt) }. */
const results = [];

/**
 * Per-flow timings (E2E_TIMINGS_OUT=file: JSON merged into e2e/timings.json by tools/ci/timings.mjs), flaky
 * flows (e2e-artifacts/flaky.log) and a table for the CI job summary ($GITHUB_STEP_SUMMARY).
 */
function report() {
  if (!results.length) return;
  try {
    if (process.env.E2E_TIMINGS_OUT) writeFileSync(process.env.E2E_TIMINGS_OUT, JSON.stringify({ flows: Object.fromEntries(results.filter((r) => r.status === 'PASS').map((r) => [r.flow, Math.round(r.seconds)])) }, null, 2));
  } catch {}
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
  start('pnpm', ['--filter', '@tiletrigger/server', 'start'], { PORT: String(SERVER_PORT), BOT_FILL: '3', QUIET_STATS: '1' });
  await waitForHttp(CLIENT);
  await sleep(1500);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
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
  // E2E_ONLY=editor,characters runs a subset; E2E_SHARD=2/8 one of CI's parallel groups (balanced by e2e/timings.json;
  // CI's plan job passes each shard's flows in E2E_ONLY itself).
  const flows = { editor: editorFlow, editorux: editoruxFlow, offline: offlineFlow, vault: vaultFlow, outpost: outpostFlow, sandgate: sandgateFlow, citadel: citadelFlow, canyon: canyonFlow, scenery: sceneryFlow, setpieces: setpiecesFlow, physicsfx: physicsfxFlow, teams: teamsFlow, ctf: ctfFlow, forts: fortsFlow, arsenal: arsenalFlow, vehicles: vehiclesFlow, race: raceFlow, zombies: zombiesFlow, classes: classesFlow, ...Object.fromEntries(MAP_FLOWS.map((name, part) => [name, (b) => mapsFlow(b, part)])), designer: designerFlow, characters: charactersFlow, online: onlineFlow, hostgame: hostgameFlow, hostcontrols: hostcontrolsFlow, lobby: lobbyFlow, dedicatedhost: dedicatedhostFlow, hostpage: hostpageFlow, webgpu: webgpuFlow, visual: visualFlow };
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
      if (attempt) console.log(`RETRY ${name} (attempt ${attempt + 1}) after: ${tries.at(-1).join(' | ')}`);
      try {
        await flow(browser);
      } catch (e) {
        // A flow that throws fails as a whole (where in it: the run.mjs frames); the run goes on to the next flow.
        console.log(`FAIL ${name}: ${e.message}`);
        console.log((e.stack ?? '').split('\n').filter((l) => l.includes('run.mjs')).join('\n'));
        failures++;
        attemptFails.push(`threw: ${e.message.split('\n')[0]}`);
      }
      await Promise.all(shots.splice(0));
      // Pages a flow left open (a running match keeps rendering) would slow every flow after it.
      for (const ctx of [...open]) await ctx.close().catch(() => {});
      tries.push(attemptFails);
      if (failures === before) break;
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
