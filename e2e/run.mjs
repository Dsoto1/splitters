// Browser end-to-end checks: MapMaker edit -> TEST -> edit loop, persistence,
// and two online clients against the dedicated server.
// Usage: pnpm build && pnpm e2e
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

// E2E_CLIENT_PORT / E2E_SERVER_PORT move the preview and game servers (e.g. when another checkout is testing).
const CLIENT_PORT = process.env.E2E_CLIENT_PORT ?? '4173';
const CLIENT = `http://localhost:${CLIENT_PORT}`;
const SERVER_PORT = +(process.env.E2E_SERVER_PORT ?? 7787);
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

/** Click a MapMaker palette tool, opening the palette tab that holds it first. */
async function clickTool(page, selector) {
  await page.evaluate((sel) => {
    const pane = document.querySelector(sel)?.closest('.ed-pane');
    if (pane) document.querySelector(`#ed-pal-tabs [data-pane="${pane.dataset.pane}"]`)?.click();
  }, selector);
  await page.click(selector);
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
  // Leaving TEST rebuilds the editor view; allow for slow software rendering on a busy machine.
  await page.waitForFunction(() => !document.getElementById('editor').hidden, null, { timeout: 15000 });
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
  // Close it, or its render loop keeps eating CPU through the later flows.
  await page.context().close();
}

/** MapMaker tool bar, Erase tool, level strip and NPC palette. Screenshots go to E2E_SHOTS when set. */
async function editoruxFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 820 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const shot = (name) => (process.env.E2E_SHOTS ? page.screenshot({ path: `${process.env.E2E_SHOTS}/editorux-${name}.png` }).catch(() => {}) : Promise.resolve());
  await page.goto(`${CLIENT}/?mode=editor`);
  await page.waitForFunction(() => window.__editor, null, { timeout: 60000 });
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
  const settle = () => page.waitForTimeout(250);

  check(await page.isVisible('#ed-toolbar #ed-tb-erase') && (await page.textContent('#ed-tb-erase')).includes('X'), 'tool bar shows Erase with its key');
  check((await page.getAttribute('#ed-tb-select', 'class')).includes('active') && (await page.textContent('#ed-toolhint')).includes('Select'), 'Select is the lit tool and the hint says what it does');

  await page.waitForFunction(() => document.querySelector('#ed-tiles .thumb img'), null, { timeout: 30000 }).catch(() => {});
  check(await page.evaluate(() => !!document.querySelector('#ed-tiles .thumb img')?.src.startsWith('data:image/png')), 'tile cards get 3D thumbnails of the real pieces');
  check(parseFloat(await page.evaluate(() => getComputedStyle(document.getElementById('ed-palette')).width)) >= 300, 'the palette is wide (300 px or more)');
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
  await page.waitForFunction(() => /Erase:/.test(document.getElementById('ed-target')?.textContent ?? ''), null, { timeout: 10000 }).catch(() => {});
  const target = await page.evaluate(() => window.__editor.pick());
  const aimed = rocks.find((e) => e.id === target?.id);
  await page.mouse.click(rp.x, rp.y);
  d = await doc();
  check(aimed && aimed.position[1] < 0 && !d.entities.some((e) => e.id === aimed.id) && d.entities.filter((e) => e.kind === 'prop').length === rocks.length - 1, `Erase deletes the rock under the pointer, standing on the terrain (${aimed?.position[1]})`);
  await page.mouse.move(700, 400);
  await shot('erase-terrain');
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
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${CLIENT}/?offline`);
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0, null, { timeout: 30000 });
  const inv = await page.evaluate(() => [...window.__cs.local.inventory.keys()]);
  check(inv.join(',') === '1,2', `offline match spawns with knife + pistol (${inv})`);
  await page.waitForTimeout(1500);
  const ammo = await page.evaluate(() => `${document.getElementById('ammo-count').textContent} / ${document.getElementById('ammo-reserve').textContent}`);
  check(/^\d+ \/ \d+$/.test(ammo), `HUD shows ammo (${ammo})`);
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

async function sandgateFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${CLIENT}/?offline=sandgate`);
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0, null, { timeout: 30000 });
  await page.waitForTimeout(2000);
  const score = (await page.textContent('#scorebar')) ?? '';
  check(score.includes('Embers') && score.includes('Tide'), `team deathmatch shows both team scores (${score})`);
  await page.waitForFunction(() => window.__cs.view.characterCount() >= 8, null, { timeout: 20000 }).catch(() => {});
  const chars = await page.evaluate(() => window.__cs.view.characterCount());
  check(chars >= 8, `5 v 5 bots are rendered as characters (${chars})`);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

async function citadelFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${CLIENT}/?offline=citadel`);
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0, null, { timeout: 30000 });
  await page.waitForTimeout(4000);
  const props = await page.evaluate(() => window.__cs.view.scene.transformNodes.filter((n) => n.name.startsWith('prop_') && !n.name.includes('_model')).length);
  check(props >= 35, `Citadel's props are placed (${props})`);
  const grenades = await page.evaluate(() => document.getElementById('throwable').textContent);
  check(/1/.test(grenades ?? ''), `HUD shows the starting grenade (${grenades})`);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

async function canyonFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // The game: terrain meshes per ground material, and players stand on the ground.
  await page.goto(`${CLIENT}/?offline=canyon`);
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0, null, { timeout: 30000 });
  await page.waitForTimeout(3000);
  const grounds = await page.evaluate(() => window.__cs.view.scene.meshes.filter((m) => m.name.includes('_terrain_')).map((m) => m.name.split('_terrain_')[1]));
  check(grounds.length >= 5 && grounds.includes('grass') && grounds.includes('stone'), `canyon terrain is drawn in its ground materials (${grounds.join(', ')})`);
  const y = await page.evaluate(() => window.__cs.local.eye.y);
  check(y > 0.5 && y < 3, `the player stands on the ground at a base (eye ${y.toFixed(2)} m)`);
  // MapMaker: create terrain, sculpt a hill, undo it.
  await page.goto(`${CLIENT}/?mode=editor`);
  await page.waitForFunction(() => window.__editor, null, { timeout: 30000 });
  page.once('dialog', (d) => d.accept());
  await page.click('#ed-new');
  await page.click('#ed-pal-tabs [data-pane="terrain"]');
  await page.click('#ed-tr-new');
  check(await page.evaluate(() => !!window.__editor.doc.terrain), 'MapMaker creates terrain');
  await clickTool(page, '[data-tool="terrain:raise"]');
  const p = await page.evaluate(() => window.__editor.view.project({ x: 0, y: 0, z: 0 }));
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  // Hold until the hill has grown (headless frame rates vary), at most 6 s.
  await page.waitForFunction(() => Math.max(...window.__editor.view.scene.meshes.filter((m) => m.name.includes('_terrain_')).map((m) => m.getBoundingInfo().boundingBox.maximumWorld.y)) > 0.5, null, { timeout: 6000 }).catch(() => {});
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
  page.on('pageerror', (e) => errors.push(e.message));
  // The game: a photo sky, ground and scenery past the border, and grass growing on the canyon floor.
  await page.goto(`${CLIENT}/?offline=canyon`);
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0, null, { timeout: 30000 });
  await page.waitForFunction(() => window.__cs.view.scene.meshes.some((m) => m.name.startsWith('foliage') && m.thinInstanceCount > 0), null, { timeout: 15000 }).catch(() => {});
  const canyon = await page.evaluate(() => {
    const ms = window.__cs.view.scene.meshes;
    return { names: [...new Set(ms.filter((m) => m.name.startsWith('backdrop_')).map((m) => m.name))], plants: ms.filter((m) => m.name.startsWith('foliage')).reduce((n, m) => n + (m.thinInstanceCount || 0), 0), fog: window.__cs.view.scene.fogMode };
  });
  check(canyon.names.includes('backdrop_sky') && canyon.names.includes('backdrop_ground') && canyon.names.includes('backdrop_ridge'), `canyon has a sky, ground beyond and distant scenery (${canyon.names.join(', ')})`);
  check(canyon.plants > 1000 && canyon.fog > 0, `grass grows on the canyon floor (${canyon.plants} plants) under haze`);
  await page.goto(`${CLIENT}/?offline=skyward`);
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0, null, { timeout: 30000 });
  const space = await page.evaluate(() => window.__cs.view.scene.meshes.filter((m) => m.name.startsWith('backdrop_')).map((m) => m.name));
  check(space.includes('backdrop_sky') && !space.includes('backdrop_ground'), `Skyward floats in a starfield with no ground (${space.join(', ')})`);
  // MapMaker: pick a backdrop, paint plants, scatter a forest.
  await page.goto(`${CLIENT}/?mode=editor`);
  await page.waitForFunction(() => window.__editor, null, { timeout: 30000 });
  page.once('dialog', (d) => d.accept());
  await page.click('#ed-new');
  await page.selectOption('#ed-bd-sky', 'sunset');
  await page.waitForTimeout(300);
  const bd = await page.evaluate(() => ({ sky: window.__editor.doc.backdrop?.sky, mesh: window.__editor.view.scene.meshes.some((m) => m.name === 'backdrop_sky') }));
  check(bd.sky === 'sunset' && bd.mesh, `MapMaker sets the map's sky (${bd.sky})`);
  await page.click('#ed-blood-amount');
  await page.selectOption('#ed-blood-amount', 'heavy');
  await page.click('.ed-row-buttons button:has-text("Alien")');
  const blood = await page.evaluate(() => window.__editor.doc.blood);
  check(blood?.color === '#3f9b1f' && blood?.amount === 'heavy', `MapMaker sets the map's blood (${JSON.stringify(blood)})`);
  await page.click('#ed-pal-tabs [data-pane="terrain"]');
  await page.click('#ed-tr-new');
  await page.click('[data-foliage="4"]');
  const at = async (x, z) => page.evaluate(([x, z]) => window.__editor.view.project({ x, y: 0, z }), [x, z]);
  let p = await at(0, 0);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.waitForTimeout(300);
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
  await page.waitForFunction(() => Math.max(...window.__editor.doc.terrain.heights) > 150 || window.__editor.stroke?.now && Math.max(...window.__editor.stroke.now.heights) > 150, null, { timeout: 8000 }).catch(() => {});
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
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${CLIENT}/?offline=sky_islands`);
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__match, null, { timeout: 30000 });
  await page.waitForTimeout(1000);
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
    window.__pin = setInterval(() => { me.health = 100; }, 50);
    me.move = { pos: { x: e.position[0], y: e.position[1] + e.size[1] + 0.3, z: e.position[2] }, velY: 0, grounded: false };
    return e.id;
  });
  await page.waitForFunction((id) => window.__match.scenario.destructibleAlive(id) === false, stone, { timeout: 6000 }).catch(() => {});
  check(await page.evaluate((id) => window.__match.scenario.destructibleAlive(id) === false, stone), 'a crumbling stone gives way under you');
  // Swim: drop into the pond; the view goes under water.
  await page.evaluate(() => { const me = window.__match.slots[window.__cs.slot]; me.move = { pos: { x: 0, y: 0.6, z: 0 }, velY: 0, grounded: false }; });
  await page.waitForFunction(() => window.__match.slots[window.__cs.slot].move.swim === true, null, { timeout: 5000 }).catch(() => {});
  const under = await page.evaluate(() => ({ swim: window.__match.slots[window.__cs.slot].move.swim === true, fog: window.__cs.view.scene.fogDensity }));
  check(under.swim && under.fog > 0.05, `you swim in the pond and the view hazes under water (fog ${under.fog.toFixed(3)})`);
  // Jetpack: fly up while holding jump.
  await page.evaluate(() => { const me = window.__match.slots[window.__cs.slot]; me.move = { pos: { x: 8, y: 3, z: 8 }, velY: 0, grounded: true }; me.jetFuel = 720; window.__autoInput = { buttons: 1 }; });
  await page.waitForFunction(() => window.__match.slots[window.__cs.slot].move.pos.y > 7, null, { timeout: 8000 }).catch(() => {});
  const fly = await page.evaluate(() => ({ y: window.__match.slots[window.__cs.slot].move.pos.y, hud: document.getElementById('powerups')?.textContent ?? '' }));
  await page.evaluate(() => (window.__autoInput = { buttons: 0 }));
  check(fly.y > 7 && /JETPACK/.test(fly.hud), `the jetpack flies you up (${fly.y.toFixed(1)} m) with a fuel gauge on the HUD`);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

async function physicsfxFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${CLIENT}/?offline=canyon`);
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__match, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
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
    window.__pin = setInterval(() => { me.health = 100; }, 50);
    const bot = m.slots.find((c) => c && c !== me && c.alive);
    for (const c of m.slots) if (c && c !== me && c !== bot) c.alive = false;
    const f = window.__cs.view.camera.getForwardRay(1).direction;
    const len = Math.hypot(f.x, f.z) || 1;
    bot.move = { ...bot.move, pos: { x: me.move.pos.x + (f.x / len) * 4, y: me.move.pos.y + 0.5, z: me.move.pos.z + (f.z / len) * 4 }, velY: 0, grounded: false };
    window.__botSlot = bot.slot;
    window.__autoInput = { buttons: 0 };
  });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const m = window.__match;
    const me = m.slots[window.__cs.slot];
    const bot = m.slots[window.__botSlot];
    window.__cs.view.pushPlayer(bot.slot, { x: (bot.move.pos.x - me.move.pos.x) * 1.2, y: 2, z: (bot.move.pos.z - me.move.pos.z) * 1.2 });
    m.damage(bot, 500, me, 'core.pistol');
  });
  await page.addStyleTag({ content: '#pause { display: none !important; }' });
  // Sample the fall while the body is down (the bot respawns 2-3 s after dying).
  const track = [];
  let ragdolled = false;
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(150);
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
  const dead = await page.evaluate(() => ({ splats: window.__cs.view.scene.meshes.filter((m) => m.name === 'bloodSplat').length }));
  check(ragdolled && track[0] - Math.min(...track) > 0.5, `the killed bot drops as a ragdoll (head ${track.map((y) => y.toFixed(2)).join(' → ')})`);
  check(dead.splats > 0, `blood splats where it fell (${dead.splats})`);
  // Debris chunks are real bodies: they land and rest on the ground.
  await page.evaluate(() => {
    const me = window.__match.slots[window.__cs.slot];
    const f = window.__cs.view.camera.getForwardRay(1).direction;
    window.__cs.view.debris({ x: me.move.pos.x + f.x * 3, y: me.move.pos.y + 1.5, z: me.move.pos.z + f.z * 3 }, '#8a5d33', 0.8);
  });
  // Headless frame rates are low, so run three seconds of physics at once rather than waiting on the frames.
  const chunks = await page.evaluate(() => {
    const view = window.__cs.view;
    for (let i = 0; i < 180; i++) view.physics.step(1 / 60);
    return view.debrisBodies.map((d) => ({ y: d.body.translation().y, v: Math.hypot(...Object.values(d.body.linvel())) }));
  });
  await page.waitForTimeout(300);
  check(chunks.length === 10 && chunks.every((c) => c.v < 1.5), `debris chunks land and come to rest (${chunks.length}, fastest ${Math.max(...chunks.map((c) => c.v)).toFixed(2)} m/s)`);
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/physicsfx-debris.png` });
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
}

async function teamsFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Arcade: Team Deathmatch on Sandgate as 2v2v2v2v2v2v12 (24 players, 7 teams).
  await page.addInitScript(() => localStorage.setItem('cs.arcade', JSON.stringify({ map: 'sandgate', mode: 'core.tdm', bots: 3, skill: 'easy', scoreLimit: 40, minutes: 10 })));
  await page.goto(CLIENT);
  await page.click('#nav-play');
  await page.selectOption('#arcade-teams', '2,2,2,2,2,2,12');
  await page.click('#arcade-start');
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.keyboard.down('Tab');
  await page.waitForTimeout(300);
  const board = await page.evaluate(() => ({ many: document.getElementById('scoreboard').classList.contains('many'), tables: [...document.querySelectorAll('#scoreboard table')].map((t) => t.querySelectorAll('tr').length - 1) }));
  await page.keyboard.up('Tab');
  check(board.many && board.tables.length === 7, `the scoreboard shows seven teams (${board.tables.length})`);
  check([...board.tables].sort((a, b) => a - b).join(',') === '2,2,2,2,2,2,12', `teams are filled to 2v2v2v2v2v2v12 (${board.tables.join(',')})`);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

/** Capture the Flag offline: flags drawn, taking the enemy flag shows on the HUD, bringing it home scores. */
async function ctfFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${CLIENT}/?offline=bunker_cross&gamemode=core.ctf`);
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__match && window.__cs.mode?.state, null, { timeout: 40000 });
  await page.waitForTimeout(1500);
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
      me.health = 1e6;
      const theirs = window.__match.mode.flags.find((f) => f.team !== me.faction);
      const own = window.__match.mode.flags.find((f) => f.team === me.faction);
      const d = Math.hypot(own.base.x - theirs.base.x, own.base.z - theirs.base.z) || 1;
      const from = { x: theirs.base.x + ((own.base.x - theirs.base.x) / d) * 5, y: theirs.base.y + 0.2, z: theirs.base.z + ((own.base.z - theirs.base.z) / d) * 5 };
      me.move = { pos: from, velY: 0, grounded: false };
      window.__cs.input.yaw = Math.atan2(theirs.base.x - from.x, theirs.base.z - from.z);
      window.__cs.input.pitch = -0.15;
      document.getElementById('pause').style.visibility = 'hidden';
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${process.env.E2E_SHOTS}/ctf-flag.png`, timeout: 60000 }).catch(() => {});
  }
  // Stand on the enemy flag: it is ours to carry.
  await page.evaluate(() => {
    const me = window.__match.slots[window.__cs.slot];
    const theirs = window.__match.mode.flags.find((f) => f.team !== me.faction);
    // Bots are shooting: make the test player sturdy enough to make the run.
    me.health = 1e6;
    // If a bot already has it, put it back on its base so the test starts clean.
    if (theirs.state === 1) {
      const c = window.__match.slots[theirs.carrier];
      if (c) c.modeSpeed = undefined;
      Object.assign(theirs, { state: 0, carrier: null, pos: { ...theirs.base } });
    }
    me.move = { pos: { ...theirs.pos, y: theirs.pos.y + 0.2 }, velY: 0, grounded: false };
  });
  await page.waitForFunction(() => document.querySelector('#mode-status .ms.me'), null, { timeout: 8000 }).catch(() => {});
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
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/ctf-carrying.png`, timeout: 60000 }).catch(() => {});
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
  await page.waitForFunction(() => window.__cs.mode.state.ts.some((n) => n > 0) && document.querySelector('#sb-left b')?.textContent === '1', null, { timeout: 8000 }).catch(() => {});
  const after = await page.evaluate(() => ({ ts: window.__cs.mode.state.ts, left: document.querySelector('#sb-left b')?.textContent, msg: document.getElementById('message').textContent }));
  check(after.ts.some((n) => n === 1) && after.left === '1', `bringing it home scores a capture (${JSON.stringify(after)})`);
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/ctf-captured.png`, timeout: 60000 }).catch(() => {});
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

async function arsenalFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${CLIENT}/?offline=canyon`);
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__give, null, { timeout: 30000 });
  // Fire a spread of the new weapons (scripted input: headless browsers have no pointer lock).
  for (const id of ['core.flamethrower', 'core.oil_slicker', 'core.laser_rifle', 'core.railgun', 'core.bubble_blaster', 'core.swarm', 'core.disc_launcher', 'core.arc_caster', 'core.goo_gun', 'core.burst_rifle']) {
    await page.evaluate((w) => {
      window.__give(w);
      window.__cs.input.pitch = -0.25;
      window.__autoInput = { buttons: 2 };
    }, id);
    await page.waitForTimeout(500);
  }
  await page.evaluate(() => (window.__autoInput = { buttons: 0 }));
  await page.waitForTimeout(300);
  const zones = await page.evaluate(() => window.__cs.view.scene.transformNodes.filter((n) => n.name.startsWith('zone_')).map((n) => n.name.slice(5)));
  check(zones.length > 0, `hazards are drawn on the ground (${[...new Set(zones)].join(', ')})`);
  const bar = await page.evaluate(() => document.getElementById('weapon-bar').textContent);
  check(/•/.test(bar ?? ''), `the weapon bar shows several weapons in a slot (${bar})`);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

async function vehiclesFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${CLIENT}/?offline=canyon`);
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__match, null, { timeout: 30000 });
  const mounts = await page.evaluate(() => window.__cs.view.scene.transformNodes.filter((n) => /^mount_[0-9]+$/.test(n.name)).length);
  check(mounts >= 9, `canyon's vehicles and turrets are drawn (${mounts})`);
  // Walk up to the buggy outside our base, press E once, and drive.
  await page.evaluate(() => {
    const me = window.__match.slots[window.__cs.slot];
    const z = me.faction === 'tide' ? 60 : -60;
    me.move = { pos: { x: -14, y: 0.3, z: z - (z > 0 ? -3 : 3) }, velY: 0, grounded: false };
    window.__autoInput = { buttons: 0 };
  });
  await page.waitForFunction(() => /Drive/.test(document.getElementById('prompt').textContent ?? ''), null, { timeout: 8000 }).catch(() => {});
  const prompt = await page.evaluate(() => document.getElementById('prompt').textContent);
  check(/Drive the Buggy/.test(prompt ?? ''), `the prompt offers the wheel (${prompt})`);
  await page.evaluate(() => (window.__autoInput = { buttons: 0, once: 16 }));
  await page.waitForFunction(() => !!window.__match.slots[window.__cs.slot].mount, null, { timeout: 5000 }).catch(() => {});
  const start = await page.evaluate(() => ({ ...window.__match.slots[window.__cs.slot].move.pos }));
  await page.evaluate(() => (window.__autoInput = { forward: 1, buttons: 0 }));
  // Headless frame rates vary: wait for the drive rather than a fixed time.
  await page
    .waitForFunction((s) => { const p = window.__match.slots[window.__cs.slot].move.pos; return Math.hypot(p.x - s.x, p.z - s.z) > 8; }, start, { timeout: 10000 })
    .catch(() => {});
  const after = await page.evaluate(() => ({ seat: window.__match.slots[window.__cs.slot].mount?.seat, pos: window.__match.slots[window.__cs.slot].move.pos, hud: document.getElementById('weapon-name')?.textContent }));
  check(after.seat === 0, `you are in the driver's seat (${after.seat})`);
  check(Math.hypot(after.pos.x - start.x, after.pos.z - start.z) > 8, `the buggy drives off (${Math.hypot(after.pos.x - start.x, after.pos.z - start.z).toFixed(1)} m)`);
  await page.evaluate(() => (window.__autoInput = { buttons: 0, once: 16 }));
  await page.waitForFunction(() => !window.__match.slots[window.__cs.slot].mount, null, { timeout: 5000 }).catch(() => {});
  check(await page.evaluate(() => !window.__match.slots[window.__cs.slot].mount), 'E again gets you out');
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.context().close();
}

/** Every homage map (and any other map without a flow of its own) starts a match cleanly. */
async function mapsFlow(browser) {
  const { readdirSync } = await import('node:fs');
  const covered = new Set(['phase0_arena', 'm3_vault', 'm4_outpost', 'sandgate', 'citadel', 'canyon']);
  const ids = readdirSync(new URL('../maps/', import.meta.url)).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).filter((id) => !covered.has(id));
  // Imported maps (maps/imported/, converted from TimeSplitters MapMaker saves) are many: spot-check 5 at random
  // (E2E_IMPORTED=all checks every one, E2E_IMPORTED=id1,id2 checks those).
  let imported = [];
  try {
    imported = readdirSync(new URL('../maps/imported/', import.meta.url)).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
  } catch {}
  const pick = process.env.E2E_IMPORTED;
  const chosen = pick === 'all' ? imported : pick ? pick.split(',') : imported.map((id) => [Math.random(), id]).sort((a, b) => a[0] - b[0]).slice(0, 5).map(([, id]) => id);
  if (imported.length) console.log(`imported maps checked: ${chosen.join(', ')}`);
  for (const id of [...ids, ...chosen]) {
    const page = await (await browser.newContext({ viewport: { width: 800, height: 450 } })).newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${CLIENT}/?offline=${id}`);
    const ok = await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0, null, { timeout: 40000 }).then(() => true, () => false);
    await page.waitForTimeout(1500);
    // Imported maps can have floors below level 0: "solid ground" there means not below the lowest floor.
    let floor = -5;
    if (chosen.includes(id)) {
      const { readFileSync } = await import('node:fs');
      const m = JSON.parse(readFileSync(new URL(`../maps/imported/${id}.json`, import.meta.url), 'utf8'));
      floor = Math.min(0, ...m.classicStructure.tiles.map((t) => t.z)) * m.classicStructure.levelHeight - 1;
    }
    const alive = ok && (await page.evaluate((floor) => window.__cs.local.alive && window.__cs.local.state.pos.y > floor, floor));
    const where = ok ? await page.evaluate(() => window.__cs.local.state.pos.y.toFixed(1)) : 'no match';
    check(ok && alive && errors.length === 0, `${id}: match starts and you spawn on solid ground${chosen.includes(id) ? ` (y ${where})` : ''}${errors.length ? ` (${errors.join('; ')})` : ''}`);
    await page.context().close();
  }
}

async function designerFlow(browser) {
  const page = await (await browser.newContext({ viewport: { width: 1200, height: 760 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(CLIENT);
  await page.click('#nav-characters');
  await page.click('.char-tile.new');
  await page.waitForFunction(() => !!window.__designer, null, { timeout: 30000 });
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
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0, null, { timeout: 30000 });
  await page.waitForFunction(() => window.__cs.view.hasFirstPersonArms(), null, { timeout: 20000 }).catch(() => {});
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
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => /WebGPU (uncaptured error|context lost)/.test(m.text()) && errors.push(m.text()));
    await page.goto(`${CLIENT}/favicon.ico`).catch(() => {});
    if (!(await page.evaluate(async () => !!(await navigator.gpu?.requestAdapter())))) {
      console.log('SKIP webgpu: no WebGPU adapter in this browser');
      return;
    }
    await page.goto(`${CLIENT}/?renderer=webgpu`);
    await page.waitForFunction(() => window.__front, null, { timeout: 60000 });
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
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${CLIENT}/?mode=characters`);
  await page.waitForFunction(() => window.__charsReady === true, null, { timeout: 30000 });
  const [n, want] = await page.evaluate(() => [window.__charAnimators.length, window.__charSpecs]);
  check(n === want && n >= 20, `character viewer builds every look and NPC (${n} of ${want})`);
  const lod = await page.evaluate(() => window.__charAnimators.flatMap((a) => a.ch.meshes).filter((m) => m.getLODLevels?.().length).length);
  check(lod > 100, `character meshes have low-detail levels (${lod})`);
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

/** Host game: one browser hosts its offline match with a code, a second joins by link (through a local PeerJS broker). */
async function lobbyFlow(browser) {
  // A community hub: broker + game browser. A host lists its match; a player finds it and joins from the list.
  const HUB_PORT = +(process.env.E2E_HUB_PORT ?? 9078);
  start('pnpm', ['--filter', '@chronosplit/server', 'hub'], { PORT: String(HUB_PORT), HOST: '127.0.0.1', TURN_SECRET: 'e2e-secret', TURN_URLS: 'turn:127.0.0.1:3478' });
  await sleep(5000);
  const hub = `hub=127.0.0.1:${HUB_PORT}`;
  const errors = [];
  const host = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
  host.on('pageerror', (e) => errors.push(`host: ${e.message}`));
  await host.addInitScript(() => localStorage.setItem('cs.name', 'Hosty'));
  await host.goto(`${CLIENT}/?offline=arena&${hub}`);
  await host.waitForFunction(() => window.__cs?.local?.inventory?.size > 0, null, { timeout: 30000 });
  const offered = await host.evaluate(() => !document.getElementById('host-public').hidden);
  check(offered, 'hosting offers "List in the game browser" when a hub is set');
  await host.evaluate(() => {
    document.getElementById('host-name').value = 'E2E Friday Night';
    const box = document.getElementById('host-list');
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    document.getElementById('host-game').click();
  });
  const listed = await host.waitForFunction(() => /^Listed:/.test(document.getElementById('host-public-status').textContent), null, { timeout: 20000 }).then(() => true, () => false);
  check(listed, `the host's match is listed (${await host.evaluate(() => document.getElementById('host-public-status').textContent)})`);
  const relayNote = await host.evaluate(() => document.getElementById('host-info').textContent);
  check(relayNote.includes('hub provides a relay'), 'the hub hands out relay credentials, and the host is told');
  const player = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  player.on('pageerror', (e) => errors.push(`player: ${e.message}`));
  await player.addInitScript(() => localStorage.setItem('cs.name', 'Stranger'));
  await player.goto(`${CLIENT}/?${hub}`);
  await player.waitForFunction(() => window.__front, null, { timeout: 30000 });
  await player.evaluate(() => document.getElementById('nav-online')?.click());
  const row = await player.waitForFunction(() => [...document.querySelectorAll('.gb-row:not(.gb-head)')].map((r) => r.textContent).find((t) => t.includes('E2E Friday Night')) ?? null, null, { timeout: 15000 }).then((h) => h.jsonValue(), () => null);
  check(!!row && row.includes('1/') && row.includes('Hosty') && row.includes('Relay'), `the game browser lists it, with the relay badge (${row})`);
  await player.evaluate(() => [...document.querySelectorAll('.gb-row:not(.gb-head)')].find((r) => r.textContent.includes('E2E Friday Night')).querySelector('button').click());
  const joined = await player.waitForFunction(() => window.__cs?.local?.inventory?.size > 0, null, { timeout: 40000 }).then(() => true, () => false);
  check(joined, 'joining from the game browser puts the player in the match');
  if (joined) {
    // The next check-in reports two players.
    const two = await player.waitForFunction(() => fetch(`http://${new URLSearchParams(location.search).get('hub')}/lobby/games`).then((r) => r.json()).then((d) => d.games.find((g) => g.name === 'E2E Friday Night')?.players === 2), null, { timeout: 30000, polling: 2000 }).then(() => true, () => false);
    check(two, 'the listing updates to 2 players');
  }
  await host.context().close();
  const gone = await player.waitForFunction(() => fetch(`http://${new URLSearchParams(location.search).get('hub')}/lobby/games`).then((r) => r.json()).then((d) => !d.games.some((g) => g.name === 'E2E Friday Night')), null, { timeout: 15000, polling: 1000 }).then(() => true, () => false);
  check(gone, 'the listing goes away when the host closes the game');
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await player.context().close();
}

async function hostgameFlow(browser) {
  const PEER_PORT = +(process.env.E2E_PEER_PORT ?? 9077);
  start('node', ['-e', `import('peer').then(({ PeerServer }) => PeerServer({ port: ${PEER_PORT}, path: '/', host: '127.0.0.1' }))`]);
  await sleep(1500);
  const peer = `&peer=127.0.0.1:${PEER_PORT}`;
  const host = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
  const errors = [];
  host.on('pageerror', (e) => errors.push(`host: ${e.message}`));
  await host.goto(`${CLIENT}/?offline=arena${peer}`);
  await host.waitForFunction(() => window.__cs?.local?.inventory?.size > 0, null, { timeout: 30000 });
  await host.evaluate(() => document.getElementById('host-game').click());
  // CI renders in software, slowly: generous waits (readiness is checked by what follows each load).
  await host.waitForFunction(() => /[A-Z0-9]{6}/.test(document.querySelector('#host-info .host-code b')?.textContent ?? ''), null, { timeout: 45000 });
  const code = await host.evaluate(() => document.querySelector('#host-info .host-code b').textContent);
  check(/^[A-Z0-9]{6}$/.test(code), `hosting opens a join code (${code})`);
  const friend = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
  friend.on('pageerror', (e) => errors.push(`friend: ${e.message}`));
  await friend.addInitScript(() => localStorage.setItem('cs.name', 'Friend'));
  await friend.goto(`${CLIENT}/?join=${code}${peer}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const joined = await friend.waitForFunction(() => window.__cs?.local?.inventory?.size > 0, null, { timeout: 60000 }).then(() => true, () => false);
  check(joined, 'a friend joins the hosted match by its link');
  if (joined) {
    await friend.waitForTimeout(2500);
    const seen = await host.evaluate(() => window.__match.combatants().filter((c) => c.kind === 'human').map((c) => c.name));
    check(seen.length === 2 && seen.includes('Friend'), `the host's match has both players (${seen.join(', ')})`);
    const moved = await friend.evaluate(async () => {
      const y0 = window.__cs.local.state.pos;
      window.__autoInput = { forward: 1 };
      await new Promise((r) => setTimeout(r, 1500));
      window.__autoInput = { forward: 0 };
      const y1 = window.__cs.local.state.pos;
      return Math.hypot(y1.x - y0.x, y1.z - y0.z);
    });
    const onHost = await host.evaluate(() => {
      const f = window.__match.combatants().find((c) => c.name === 'Friend');
      return f ? f.move.pos : null;
    });
    check(moved > 1 && !!onHost, `the friend moves and the host's match follows (${moved.toFixed(1)} m)`);
    // The host's stream to a friend is compressed: a few KB/s, not the ~40 KB/s of raw snapshots.
    const bytes = () => friend.evaluate(() => window.__cs.transport.bytesIn);
    const b0 = await bytes();
    await friend.waitForTimeout(5000);
    const rate = ((await bytes()) - b0) / 5 / 1024;
    check(rate > 0.2 && rate < 12, `the friend's stream is compressed (${rate.toFixed(1)} KB/s)`);
  }
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await host.context().close();
  await friend.context().close();
}

try {
  start('pnpm', ['--filter', '@chronosplit/client', 'exec', 'vite', 'preview', '--port', CLIENT_PORT, '--strictPort']);
  start('pnpm', ['--filter', '@chronosplit/server', 'start'], { PORT: String(SERVER_PORT), BOT_FILL: '3', QUIET_STATS: '1' });
  await waitForHttp(CLIENT);
  await sleep(1500);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  // E2E_ONLY=editor,characters runs a subset of the flows.
  const only = process.env.E2E_ONLY?.split(',');
  const flows = { editor: editorFlow, editorux: editoruxFlow, offline: offlineFlow, vault: vaultFlow, outpost: outpostFlow, sandgate: sandgateFlow, citadel: citadelFlow, canyon: canyonFlow, scenery: sceneryFlow, setpieces: setpiecesFlow, physicsfx: physicsfxFlow, teams: teamsFlow, ctf: ctfFlow, arsenal: arsenalFlow, vehicles: vehiclesFlow, maps: mapsFlow, designer: designerFlow, characters: charactersFlow, online: onlineFlow, hostgame: hostgameFlow, lobby: lobbyFlow, webgpu: webgpuFlow };
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
