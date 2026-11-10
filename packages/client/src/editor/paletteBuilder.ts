import {
  CORE_ITEMS,
  CORE_PROPS,
  coreCatalog,
  coreMaterials,
  coreThemes,
  EDGE_STYLE_LABELS,
  EDGE_STYLES,
  ENV_SPECIES,
  FACADE_LABELS,
  getProp,
  getStylePack,
  GLASS_KIND_LABELS,
  GLASS_KINDS,
  isTileOptionTwin,
  MOUNT_DEFS,
  MOUNT_MODELS,
  NPC_PALETTE,
  SCENARIO_PALETTE,
  setThemeCommand,
  STYLE_PACKS,
  stylePackHas,
  TILE_CATEGORIES,
  TINT_SWATCHES,
  type GlassKind,
  type MountModel,
  type PaintScope,
  type PropDefinition,
  type ScenarioPaletteKey,
  type StylePack,
  type TileDefinition
} from '@tiletrigger/shared';
import { materialThumbnail } from '../materials/patterns.ts';
import type { EditorApp } from './editorApp.ts';
import { $, escapeHtml, small } from './editorDom.ts';
import { edgeIcon, itemIcon, npcIcon, SCENARIO_ICONS } from './editorParts.ts';
import { DEFAULT_HEIGHT_GRID_SMOOTHING, HEIGHT_GRID_SMOOTHING, MAX_HEIGHT_GRID_BYTES, parseAsciiGrid, terrainFromHeightGrid } from './heightGrid.ts';
import { Palette } from './palette.ts';
import {
  NATURE_PROP_CATEGORIES,
  PROP_GROUPS,
  propGroup,
  RETIRED_PROPS,
  scenarioGroup,
  setPieceSuitsStylePack,
  stylePackRoles
} from './paletteCatalog.ts';
import { type PathKind } from './pathTool.ts';
import { isRetiredTile } from './retiredTiles.ts';
import { tileIcon } from './tileIcon.ts';

/** The palette's contents: every tab's cards (tiles, walls, gameplay, pickups, props, vehicles, paint, NPCs, paths, real places), the Style Pack picker and the palette's pictures (split out of editorApp.ts, MapMaker overhaul Phase 2 item 5). */
export class PaletteBuilder {
  constructor(readonly app: EditorApp) {}

  /** NPCs tab: lone soldiers and squads, each a preconfigured encounter. */
  buildNpcPalette(): void {
    const box = this.app.palette.group($('ed-npcs'), 'npcs:squads', 'Soldiers & Squads', {
      note: 'Click one, then click the map to drop it there. Each is an NPC squad marker: change its soldiers, faction, orders and skill in the inspector.',
    });
    for (const entry of NPC_PALETTE) {
      const b = document.createElement('button');
      b.className = 'tile-btn';
      b.dataset.tool = `npc:${entry.key}`;
      b.title = `${entry.label}: ${entry.blurb}`;
      b.innerHTML = `${npcIcon(entry.key)}${escapeHtml(entry.label)}`;
      b.addEventListener('click', () => this.app.setTool({ kind: 'npc', key: entry.key }));
      box.append(b);
      this.app.palette.register(b, { key: b.dataset.tool, name: entry.label, tags: `${entry.search} npc enemy ai` });
    }
  }

  buildPalette(): void {
    this.app.topBar.buildToolbar();
    this.app.palette = new Palette($('ed-palette'), $<HTMLInputElement>('ed-search'), this.app.paletteAtlas, (key) => this.thumbFor(key));
    this.buildNpcPalette();
    this.buildPaintPalette();

    // Structure: tiles by kind of piece.
    const tilePack = (id: string) => STYLE_PACKS.find((p) => id.startsWith(`${p.id}.`) || p.tiles.includes(id));
    for (const category of TILE_CATEGORIES) {
      const grid = this.app.palette.group($('ed-tiles'), `tiles:${category}`, category);
      // Retired tiles (a set piece replaced them) stay out of the palette: maps that place one still load.
      for (const def of coreCatalog.all().filter((d) => d.category === category && !isRetiredTile(d.id) && !isTileOptionTwin(d))) this.paletteButton(grid, def, tilePack(def.id));
    }
    this.app.pieces.buildSetPiecePalette();
    const edges = this.app.palette.group($('ed-edges'), 'walls', 'Walls & Openings', { note: 'Pick a style, then click any side of a room or corridor to build it that way (O cycles styles, right-click resets).' });
    for (const style of EDGE_STYLES) {
      const b = document.createElement('button');
      b.className = 'tile-btn edge-btn';
      b.dataset.tool = `edge:${style}`;
      b.innerHTML = `${edgeIcon(style)}${escapeHtml(EDGE_STYLE_LABELS[style])}`;
      b.title = style === 'auto' ? 'Back to the automatic wall or doorway' : `Build a side as: ${EDGE_STYLE_LABELS[style]}`;
      b.addEventListener('click', () => this.app.setTool({ kind: 'edge', style }));
      edges.append(b);
      this.app.palette.register(b, { key: b.dataset.tool, name: EDGE_STYLE_LABELS[style], tags: 'wall side opening window door' });
    }
    // Glass for the windows the wall tool builds.
    const glass = document.createElement('select');
    glass.id = 'ed-edge-glass';
    glass.title = 'Glass the Window, Twin windows and Firing slit styles put in: breakable panes shatter when shot, reinforced (bulletproof) panes stop shots and crack. Both stop players; everyone sees through.';
    glass.append(new Option('Glass: none', ''), ...GLASS_KINDS.map((k) => new Option(`Glass: ${GLASS_KIND_LABELS[k].toLowerCase()}`, k)));
    glass.addEventListener('change', () => (this.app.edgeGlass = (glass.value || null) as GlassKind | null));
    const glassRow = document.createElement('div');
    glassRow.className = 'ed-row';
    glassRow.append(glass);
    edges.after(glassRow);

    // Gameplay: spawns and game-mode objectives, then pickups by kind.
    const objectives = this.app.palette.group($('ed-entities'), 'gameplay:objectives', 'Spawns & Objectives');
    const spawnBtn = document.createElement('button');
    spawnBtn.className = 'tile-btn';
    spawnBtn.dataset.tool = 'spawn';
    spawnBtn.innerHTML = `<svg viewBox="0 0 56 56"><circle cx="28" cy="30" r="12" fill="#4fb3ff"/><rect x="22" y="14" width="12" height="6" rx="2" fill="#1c1f26"/></svg>Player Spawn`;
    spawnBtn.title = 'Player Spawn: where players start and come back in';
    spawnBtn.addEventListener('click', () => this.app.setTool({ kind: 'spawn' }));
    objectives.append(spawnBtn);
    this.app.palette.register(spawnBtn, { key: 'spawn', name: 'Player Spawn', tags: 'spawn player start respawn team' });
    const scenarioGrids = new Map<string, HTMLElement>();
    const scenarioGrid = (pane: string, group: string) => {
      const id = `${pane}:${group}`;
      let grid = scenarioGrids.get(id);
      if (!grid) {
        const box = ({ entities: 'ed-entities', scenario: 'ed-scenario', lights: 'ed-lights', npcs: 'ed-npcs' } as Record<string, string>)[pane]!;
        grid = pane === 'entities' ? objectives : this.app.palette.group($(box), id, group);
        scenarioGrids.set(id, grid);
      }
      return grid;
    };
    // Objects tab order: doors first, then logic, movers, platforms, destructibles, traps.
    for (const g of ['Doors & Gates', 'Logic & Triggers', 'Lifts & Movers', 'Platforms & Climbing', 'Destructibles', 'Traps & Hazards']) scenarioGrid('scenario', g);
    for (const g of ['Lights', 'Liquids']) scenarioGrid('lights', g);
    const pickups = new Map<string, HTMLElement>();
    const pickupGroup = (kind: string) => (kind === 'weapon' ? 'Weapons' : kind === 'ammo' || kind === 'throwable' ? 'Ammo & Grenades' : kind === 'health' || kind === 'armor' ? 'Health & Armour' : 'Power-ups & Gear');
    for (const g of ['Health & Armour', 'Weapons', 'Ammo & Grenades', 'Power-ups & Gear']) pickups.set(g, this.app.palette.group($('ed-entities'), `gameplay:${g}`, g));
    for (const entry of SCENARIO_PALETTE) {
      const b = document.createElement('button');
      b.className = 'tile-btn';
      b.dataset.tool = `scenario:${entry.key}`;
      b.innerHTML = `<svg viewBox="0 0 56 56">${SCENARIO_ICONS[entry.key]}</svg>${escapeHtml(entry.label)}`;
      b.addEventListener('click', () => this.app.setTool({ kind: 'scenario', key: entry.key }));
      const { pane, group } = scenarioGroup(entry.key);
      scenarioGrid(pane, group).append(b);
      this.app.palette.register(b, { key: b.dataset.tool, name: entry.label, tags: entry.search });
    }
    // Bot hints (MapMaker overhaul Phase 4 item 3; botHintTool.ts), last in the Entities tab.
    const hintGrid = this.app.palette.group($('ed-entities'), 'gameplay:bothints', 'Bot hints', { note: 'Spots for bots on top of what they work out: chokepoints, sniper, camp and staging spots, jump links (Y). Shown in MapMaker only.' });
    this.app.hints.fillPalette(hintGrid, (el, key, name, tags) => this.app.palette.register(el, { key, name, tags }));
    for (const item of CORE_ITEMS) {
      const b = document.createElement('button');
      b.className = 'tile-btn';
      b.dataset.tool = `pickup:${item.id}`;
      b.innerHTML = `${itemIcon(item.id)}${escapeHtml(item.displayName)}`;
      b.addEventListener('click', () => this.app.setTool({ kind: 'pickup', item: item.id }));
      pickups.get(pickupGroup(item.effect.kind))!.append(b);
      this.app.palette.register(b, { key: b.dataset.tool, name: item.displayName, tags: `${item.id} pickup item ${item.effect.kind}` });
    }

    this.buildPropPalette();
    this.buildMountPalette();
    this.app.terrain.buildTerrainPalette();
    // Paths: one tool for roads, streets, trails and walkways, the track (NPC traffic) and AI routes, in the Terrain
    // pane (roads lie on the ground and shape it). The track and route cards open it on that kind of path.
    const pathGroup = this.app.palette.group($('ed-terrain-paths'), 'terrain:paths', 'Paths, Roads & Routes');
    const pathCard = (tool: string, kind: PathKind, svg: string, label: string, title: string, tags: string) => {
      const b = document.createElement('button');
      b.className = 'tile-btn';
      b.dataset.tool = tool;
      b.innerHTML = `<svg viewBox="0 0 56 56">${svg}</svg>${label}`;
      b.title = title;
      b.addEventListener('click', () => {
        this.app.paths.preset(kind);
        this.app.setTool({ kind: 'path' });
      });
      this.app.palette.register(b, { key: tool, name: label, tags });
      return b;
    };
    const dropCard = (tool: string, key: ScenarioPaletteKey, svg: string, label: string, title: string, tags: string) => {
      const b = document.createElement('button');
      b.className = 'tile-btn';
      b.dataset.tool = tool;
      b.innerHTML = `<svg viewBox="0 0 56 56">${svg}</svg>${label}`;
      b.title = title;
      b.addEventListener('click', () => this.app.setTool({ kind: 'scenario', key }));
      this.app.palette.register(b, { key: tool, name: label, tags });
      return b;
    };
    pathGroup.append(
      pathCard('path', 'road', '<rect x="4" y="4" width="48" height="48" rx="4" fill="#5c7a3a"/><path d="M6 46 C18 40 20 18 34 16 S50 10 52 6" stroke="#c9a36b" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M6 46 C18 40 20 18 34 16 S50 10 52 6" stroke="#e3c48f" stroke-width="2" stroke-dasharray="3 4" fill="none"/>', 'Paths', 'Paths (G): roads, streets, trails and walkways, the race track and AI routes: click points; join the ends for a loop; uses and settings in the pane', 'path road street trail walkway sidewalk pavement asphalt cobble dirt gravel boardwalk loop'),
      pathCard('path-route', 'route', '<rect x="4" y="4" width="48" height="48" rx="4" fill="#4a5a3a"/><path d="M8 46 C20 40 18 18 32 18 S48 12 50 8" stroke="#c58bff" stroke-width="3" stroke-dasharray="5 4" fill="none"/><path d="M44 6l6 2-3 6" stroke="#c58bff" stroke-width="3" fill="none"/>', 'Route', 'A route for the AI (never drawn in the game): bots driving vehicles follow it, NPC squads patrol it', 'route patrol waypoint npc guide ai vehicle follow'),
      // Drop routes (air drop): the transport plane's or a dropship's flight path. They are entities with a route
      // (placed like any marker, then "Draw route on the map"), drawn in and out of the map's boundary as you like.
      dropCard('path-drop-plane', 'airplane', '<rect x="4" y="4" width="48" height="48" rx="4" fill="#3a4a5a"/><path d="M4 40 C20 34 30 22 52 14" stroke="#e2703a" stroke-width="2.5" stroke-dasharray="5 4" fill="none"/><path d="M30 14l3 7v6l11 6v3l-11-3v7l4 3v2l-7-1-7 1v-2l4-3v-7l-11 3v-3l11-6v-6z" fill="#e2703a"/>', 'Plane Drop Route', 'A transport plane flying a route (battle-royale drop): place it, then Draw route; riders jump out over the map and parachute down', 'path route plane airplane drop air drop parachute battle royale fly'),
      dropCard('path-drop-dropship', 'airplane:dropship', '<rect x="4" y="4" width="48" height="48" rx="4" fill="#3a4a5a"/><path d="M4 40 C20 34 30 22 52 14" stroke="#e2703a" stroke-width="2.5" stroke-dasharray="5 4" fill="none"/><path d="M18 22h22l6 6-6 6H18l-5-6z" fill="#9fb3c4"/><rect x="22" y="25" width="12" height="6" fill="#5a6b7a"/>', 'Dropship Drop Route', 'A dropship flying a route in from off the map (drop ship): place it, then Draw route in and out of bounds; riders can only jump out over the map', 'path route dropship drop ship air drop parachute battle royale fly gunship'),
    );
    const pathPane = document.createElement('div');
    pathPane.id = 'ed-paths';
    pathGroup.after(pathPane);
    this.app.paths.renderPane(pathPane);
    const track = this.app.palette.group($('ed-mounts'), 'vehicles:track', 'Track (NPC traffic)');
    track.append(
      pathCard('path-race', 'race', '<path d="M8 50 C8 20 48 36 48 6" stroke="#3a3f48" stroke-width="12" fill="none"/><path d="M8 50 C8 20 48 36 48 6" stroke="#f2f2f2" stroke-width="1.5" stroke-dasharray="4 4" fill="none"/><path d="M40 4h12v4H40zM40 8h4v4h-4zM48 8h4v4h-4z" fill="#f2f2f2"/>', 'Track', 'Track for NPC traffic (Shift+G): a path NPC cars lap in every mode: click its points (a circuit at once), then set how many cars, their vehicle and the pit lane in the Paths pane', 'road track circuit traffic npc cars race lap'),
    );

    // Palette (after the reference board): the top bar's workspace picks a row of sub-tabs, a sub-tab one pane;
    // search shows ranked matches from all of them instead.
    const tabs = $('ed-pal-tabs');
    const showPane = (pane: string) => {
      // Stay in the current workspace if it has this pane, else move to the first one that does.
      const all = [...tabs.querySelectorAll<HTMLElement>('.tab')];
      const btn = all.find((b) => b.dataset.pane === pane && b.dataset.ws === this.app.paletteWs) ?? all.find((b) => b.dataset.pane === pane);
      if (!btn) return;
      this.app.paletteWs = btn.dataset.ws!;
      for (const b of all) {
        b.hidden = b.dataset.ws !== this.app.paletteWs;
        b.classList.toggle('on', b === btn);
        b.setAttribute('aria-selected', String(b === btn));
      }
      for (const p of document.querySelectorAll<HTMLElement>('#ed-palette .ed-pane')) p.hidden = p.dataset.pane !== pane;
      $('ed-palette').dataset.cat = btn.dataset.cat ?? '';
      this.app.topBar.syncWorkspaceTabs();
    };
    this.app.showPane = showPane;
    tabs.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('.tab');
      if (!b?.dataset.pane) return;
      this.app.paletteWs = b.dataset.ws!;
      // Picking a tab while searching goes back to browsing.
      const search = $<HTMLInputElement>('ed-search');
      if (search.value) {
        search.value = '';
        search.dispatchEvent(new Event('input'));
      }
      showPane(b.dataset.pane);
    });
    $('ed-modes').addEventListener('click', (e) => {
      const ws = (e.target as HTMLElement).closest<HTMLElement>('.tab')?.dataset.ws;
      if (ws) this.app.topBar.setWorkspace(ws);
    });
    this.buildPackPicker();
    this.app.palette.refresh();
    this.app.setTool({ kind: 'select' });
  }

  // ---------------------------------------------------------------- style packs

  /** The Style Pack the palette is narrowed to (null: every piece). */
  stylePack: StylePack | null = null;

  /** The palette's Style Pack picker: each pack narrows tiles, props, gameplay pieces, vehicles and pickups to its own. */
  buildPackPicker(): void {
    const sel = $<HTMLSelectElement>('ed-pack');
    for (const p of STYLE_PACKS) sel.append(new Option(`${p.number} ${p.displayName} (${p.style})`, p.id));
    const themeBtn = $<HTMLButtonElement>('ed-pack-theme');
    sel.addEventListener('change', () => {
      this.stylePack = getStylePack(sel.value) ?? null;
      themeBtn.hidden = !this.stylePack;
      const pack = this.stylePack;
      const note = $('ed-pack-note');
      note.hidden = !pack;
      note.textContent = pack ? `${pack.style}. ${pack.blurb} Dress rooms with the ${pack.facades.map((f) => FACADE_LABELS[f]).join(' or ')} facade in the tile inspector; demo map: ${pack.demo}.` : '';
      themeBtn.textContent = pack ? `Use theme (${coreThemes.get(pack.themes[0]!)?.displayName ?? pack.themes[0]})` : 'Use theme';
      // Gameplay pieces say what they are for in this pack.
      for (const b of document.querySelectorAll<HTMLElement>('#ed-palette .tile-btn[data-tool^="scenario:"]')) {
        if (b.dataset.baseTip === undefined) b.dataset.baseTip = b.dataset.tip ?? '';
        const why = pack?.gameplayNotes?.[b.dataset.tool!.slice('scenario:'.length) as ScenarioPaletteKey];
        this.app.palette.setTip(b, why ?? b.dataset.baseTip);
      }
      // Set pieces take the pack's look (its role pack), so their ghost re-themes; All pieces: the map theme's.
      this.app.pieces.pieceLook = pack ? (stylePackRoles(pack.id, this.app.setPieceLib.packs) ?? '') : '';
      this.app.pieces.renderPieceInfo();
      this.app.updateHover();
      this.filterPalette();
    });
    themeBtn.addEventListener('click', () => {
      const theme = this.stylePack?.themes[0];
      if (!theme || theme === this.app.doc.classicStructure.theme) return;
      this.app.run('Set theme', setThemeCommand(this.app.doc, theme));
      const picker = document.getElementById('ed-theme') as HTMLSelectElement | null;
      if (picker) picker.value = theme;
      this.app.toast(`Theme: ${coreThemes.get(theme)?.displayName ?? theme}`);
    });
  }

  /** Narrow the palette to the chosen Style Pack's pieces (search, favourites and recent follow it). */
  filterPalette(): void {
    const pack = this.stylePack;
    const suits = (tool: string) => {
      // Set pieces go with a pack when one of the looks they suit is the pack's (roles.json); the rest by stylePackHas.
      if (!tool.startsWith('setpiece:')) return stylePackHas(pack!, tool);
      const def = this.app.pieceDef(tool.slice('setpiece:'.length));
      return !def || setPieceSuitsStylePack(def, pack!.id, this.app.setPieceLib.packs);
    };
    this.app.palette.filter(pack ? (b) => !b.dataset.tool || suits(b.dataset.tool) : null);
  }

  /**
   * Terrain → Real places (owner only, like Publish: players never bring files into a map). Heights from a
   * height grid file (an ESRI ASCII grid in map metres: heightGrid.ts) become the terrain in one undo step; a
   * trace image (a plan or survey drawing of the place) lies over the ground to build on, and is never saved.
   */
  buildRealPlaceTools(): void {
    const pane = document.querySelector<HTMLElement>('.ed-pane[data-pane="terrain"]');
    if (!pane) return;
    const box = document.createElement('div');
    box.id = 'ed-tr-real';
    box.className = 'ed-owner-only';
    box.hidden = !this.app.owner;
    const num = (id: string, label: string, title: string) => {
      const l = document.createElement('label');
      l.className = 'stack';
      l.title = title;
      const i = document.createElement('input');
      i.id = id;
      i.type = 'number';
      i.step = 'any';
      l.append(label, i);
      return { l, i };
    };
    const file = (id: string, accept: string) => {
      const i = document.createElement('input');
      i.id = id;
      i.type = 'file';
      i.accept = accept;
      i.hidden = true;
      return i;
    };
    const button = (id: string, text: string, title: string) => {
      const b = document.createElement('button');
      b.id = id;
      b.textContent = text;
      b.title = title;
      return b;
    };
    const head = document.createElement('div');
    head.className = 'sub-h';
    head.textContent = 'Real places (owner)';
    const note = small('Build a real place to scale: its ground from a height grid file (ESRI ASCII .asc in metres, x east, y north, in map metres), and a plan or map of it laid over the ground to trace. Neither file is kept in the map.');
    const datum = num('ed-tr-datum', 'Ground level: file height at y 0 (m)', 'Blank: the height at the centre point (0, 0)');
    datum.i.placeholder = 'auto';
    const smoothing = document.createElement('select');
    smoothing.id = 'ed-tr-heights-smooth';
    for (const s of HEIGHT_GRID_SMOOTHING) smoothing.append(new Option(s.label, String(s.sigma), false, s.sigma === DEFAULT_HEIGHT_GRID_SMOOTHING));
    const smoothLabel = document.createElement('label');
    smoothLabel.className = 'stack';
    smoothLabel.title = 'Survey grids (lidar) carry small bumps: kerbs, hedges, cars, building edges. Smoothing averages them away over about this distance; banks, bluffs and knolls keep their shape. Off: the file as it is';
    smoothLabel.append('Smoothing', smoothing);
    const heightsFile = file('ed-tr-heights-file', '.asc,.txt');
    const heights = button('ed-tr-heights', 'Heights from a height grid file…', 'Replace the terrain with the heights in an ESRI ASCII grid (.asc); ground paint and plants are kept where the old terrain reached');
    heights.addEventListener('click', () => heightsFile.click());
    heightsFile.addEventListener('change', async () => {
      const f = heightsFile.files?.[0];
      heightsFile.value = '';
      if (!f) return;
      if (f.size > MAX_HEIGHT_GRID_BYTES) return this.app.toast('Height grid: the file is larger than 32 MB', true);
      const grid = parseAsciiGrid(await f.text());
      if ('error' in grid) return this.app.toast(`Height grid: ${grid.error}`, true);
      const typed = datum.i.value.trim() === '' ? null : Number(datum.i.value);
      const r = terrainFromHeightGrid(grid, { current: this.app.doc.terrain, datum: typed !== null && Number.isFinite(typed) ? typed : null, smoothing: Number(smoothing.value) });
      this.app.terrain.setTerrain(`Heights from ${f.name}`, r.terrain);
      if (typed === null) datum.i.value = String(Math.round(r.datum * 100) / 100);
      const t = r.terrain;
      this.app.toast(`Heights from ${f.name}: ${((t.cols - 1) * t.spacing).toFixed(0)} × ${((t.rows - 1) * t.spacing).toFixed(0)} m, ${t.spacing} m grid${r.resampled ? ' (averaged to fit)' : ''}${Number(smoothing.value) ? `, smoothed over ${smoothing.value} m` : ''}; y 0 is ${r.datum.toFixed(2)} m`);
    });
    const traceHead = document.createElement('div');
    traceHead.className = 'sub-h';
    traceHead.textContent = 'Trace image';
    // The picture is chosen through a file box that is never part of the page (MapMaker has no image upload:
    // the picture stays in this browser tab, is never saved into the map and never sent anywhere).
    const traceFile = document.createElement('input');
    traceFile.type = 'file';
    traceFile.accept = 'image/png,image/jpeg,image/webp';
    const trace = button('ed-trace', 'Trace image…', 'Lay a picture (a plan or map of the place, north up) over the ground to build on; editing only, never saved');
    trace.addEventListener('click', () => traceFile.click());
    const place = document.createElement('div');
    place.id = 'ed-trace-place';
    place.hidden = true;
    const west = num('ed-trace-x0', 'West edge x', 'Map x of the picture\'s left edge');
    const east = num('ed-trace-x1', 'East edge x', 'Map x of the picture\'s right edge');
    const south = num('ed-trace-z0', 'South edge z', 'Map z of the picture\'s bottom edge');
    const north = num('ed-trace-z1', 'North edge z', 'Map z of the picture\'s top edge');
    const opacity = document.createElement('input');
    opacity.id = 'ed-trace-opacity';
    opacity.type = 'range';
    opacity.min = '10';
    opacity.max = '100';
    opacity.value = '60';
    const opLabel = document.createElement('label');
    opLabel.className = 'stack';
    opLabel.append('Opacity', opacity);
    const clear = button('ed-trace-clear', 'Remove trace image', 'Take the picture away (it was never part of the map)');
    clear.addEventListener('click', () => this.app.terrain.setTrace(null));
    const apply = () => {
      if (!this.app.terrain.trace) return;
      const v = (i: HTMLInputElement, d: number) => (i.value.trim() !== '' && Number.isFinite(Number(i.value)) ? Number(i.value) : d);
      this.app.terrain.setTrace({ ...this.app.terrain.trace, x0: v(west.i, this.app.terrain.trace.x0), x1: v(east.i, this.app.terrain.trace.x1), z0: v(south.i, this.app.terrain.trace.z0), z1: v(north.i, this.app.terrain.trace.z1), opacity: Number(opacity.value) / 100 });
    };
    for (const i of [west.i, east.i, south.i, north.i, opacity]) i.addEventListener('input', apply);
    traceFile.addEventListener('change', () => {
      const f = traceFile.files?.[0];
      traceFile.value = '';
      if (!f) return;
      if (!f.type.startsWith('image/')) return this.app.toast('Trace image: choose a PNG, JPEG or WebP picture', true);
      // At first it covers the terrain (or 100 m round the centre); type the real edges in to place it.
      const t = this.app.doc.terrain;
      const rect = t ? { x0: t.origin[0], z0: t.origin[1], x1: t.origin[0] + (t.cols - 1) * t.spacing, z1: t.origin[1] + (t.rows - 1) * t.spacing } : { x0: -50, z0: -50, x1: 50, z1: 50 };
      const keep = this.app.terrain.trace;
      this.app.terrain.setTrace({ url: URL.createObjectURL(f), ...(keep ? { x0: keep.x0, z0: keep.z0, x1: keep.x1, z1: keep.z1 } : rect), opacity: Number(opacity.value) / 100 });
      const r = this.app.terrain.trace!;
      west.i.value = String(r.x0);
      east.i.value = String(r.x1);
      south.i.value = String(r.z0);
      north.i.value = String(r.z1);
      this.app.toast(`Trace image ${f.name}: type its edges in (map metres) to line it up; it is never saved`);
    });
    place.append(west.l, east.l, south.l, north.l, opLabel, clear);
    box.append(head, note, datum.l, smoothLabel, heights, heightsFile, traceHead, trace, place);
    pane.append(box);
  }

  /** Vehicles and turrets in the Entities tab (pictures from the atlas), then parked vehicles (props). */
  buildMountPalette(): void {
    const groups = {
      vehicle: this.app.palette.group($('ed-mounts'), 'vehicles:drive', 'Vehicles', { note: 'Players get in and out with E. Seats, team and paint in the inspector.' }),
      turret: this.app.palette.group($('ed-mounts'), 'vehicles:turrets', 'Turrets & Sentries'),
    };
    for (const id of MOUNT_MODELS) {
      const def = MOUNT_DEFS[id];
      const b = document.createElement('button');
      b.className = 'tile-btn prop-btn';
      b.dataset.tool = `mount:${id}`;
      b.title = `${def.displayName}: ${def.blurb}\n${def.seats.length} seat${def.seats.length === 1 ? '' : 's'}`;
      b.append(document.createTextNode(`${def.displayName}${def.seats.length ? ` · ${def.seats.length}` : ''}`));
      b.addEventListener('click', () => this.app.setTool({ kind: 'mount', model: id }));
      groups[def.kind === 'vehicle' ? 'vehicle' : 'turret'].append(b);
      this.app.palette.register(b, { key: b.dataset.tool, name: def.displayName, tags: `${def.kind} vehicle turret mount seats drive`, picture: true });
    }
    const parked = this.app.palette.group($('ed-mounts'), 'vehicles:parked', 'Parked Vehicles (scenery)', { open: false });
    for (const def of CORE_PROPS.filter((d) => propGroup(d) === 'vehicles')) this.propButton(parked, def, 'parked car vehicle wreck');
  }

  /** A prop card; its picture comes from the atlas as it scrolls into view. */
  propButton(grid: HTMLElement, def: PropDefinition, tags = '', picture = true): void {
    const b = document.createElement('button');
    b.className = 'tile-btn prop-btn';
    b.dataset.tool = `prop:${def.id}`;
    b.title = `${def.displayName}\n${def.size.map((v) => v.toFixed(1)).join(' × ')} m${def.collision ? '' : ' · walk-through'}${def.breakable ? ' · breakable' : ''}`;
    b.append(document.createTextNode(def.displayName));
    b.addEventListener('click', () => this.app.setTool({ kind: 'prop', model: def.id }));
    grid.append(b);
    const packs = STYLE_PACKS.filter((p) => p.props.includes(def.id)).map((p) => p.displayName);
    this.app.palette.register(b, {
      key: b.dataset.tool,
      name: def.displayName,
      tags: `${def.category} prop ${tags} ${packs.join(' ')} ${def.breakable ? 'breakable destructible' : ''} ${def.collision ? '' : 'walk-through decoration'}`,
      picture,
    });
  }

  /** Props by theme group (each one atlas), then by their own category; Nature and parked vehicles have their own tabs. */
  buildPropPalette(): void {
    const byCategory = (cats: readonly string[]) => cats.map((c) => [c, CORE_PROPS.filter((d) => d.category === c)] as const).filter(([, list]) => list.length);
    PROP_GROUPS.forEach((g, i) => {
      const grid = this.app.palette.group($('ed-props'), `props:${g.id}`, g.label, { open: i === 0 });
      for (const [cat, list] of byCategory(g.categories)) {
        this.app.palette.heading(grid, cat);
        for (const def of list) this.propButton(grid, def, g.label);
      }
    });
    // Props in a category no theme group lists yet still show, at the end.
    const other = CORE_PROPS.filter((d) => propGroup(d) === 'other');
    if (other.length) {
      const grid = this.app.palette.group($('ed-props'), 'props:other', 'More Props', { open: false });
      for (const def of other) this.propButton(grid, def);
    }
    for (const cat of NATURE_PROP_CATEGORIES) {
      const grid = this.app.palette.group($('ed-nature'), `nature:${cat}`, cat);
      for (const def of CORE_PROPS.filter((d) => d.category === cat && !RETIRED_PROPS.has(d.id))) this.propButton(grid, def, 'nature');
    }
    // Our species (Environment Phase 3): the Environment group, first in the tab, by category, with its brush.
    // Every species has a palette picture (pictureKeys lists them all, boulders and cliff faces included).
    this.app.env.buildPalette($('ed-nature'), ENV_SPECIES.map((s) => s.id));
  }

  buildPaintPalette(): void {
    const mats = $('ed-materials');
    let category = '';
    for (const def of coreMaterials.all()) {
      if (def.category !== category) {
        category = def.category;
        const h = document.createElement('div');
        h.className = 'mat-cat';
        h.textContent = category;
        mats.append(h);
      }
      const b = document.createElement('button');
      b.className = 'mat-btn';
      b.dataset.material = def.id;
      b.innerHTML = `<img alt="" src="${materialThumbnail(def)}"><span class="lbl">${escapeHtml(def.displayName)}</span>`;
      b.addEventListener('click', () => {
        this.app.paintStyle = { ...this.app.paintStyle, material: def.id };
        this.app.setTool({ kind: 'paint' });
        this.syncPaintUi();
      });
      mats.append(b);
      this.app.palette.register(b, { key: `material:${def.id}`, name: def.displayName, tags: `${def.category} material paint surface ${def.id}` });
    }
    const tints = $('ed-tints');
    const none = document.createElement('button');
    none.className = 'swatch none';
    none.title = 'No tint';
    none.dataset.tint = '';
    tints.append(none);
    for (const t of TINT_SWATCHES) {
      const b = document.createElement('button');
      b.className = 'swatch';
      b.style.background = t;
      b.title = t;
      b.dataset.tint = t;
      tints.append(b);
    }
    tints.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).dataset.tint;
      if (t === undefined) return;
      this.app.paintStyle = { ...this.app.paintStyle, tint: t || null };
      this.app.setTool({ kind: 'paint' });
      this.syncPaintUi();
    });
    $<HTMLInputElement>('ed-tint-custom').addEventListener('input', (e) => {
      this.app.paintStyle = { ...this.app.paintStyle, tint: (e.target as HTMLInputElement).value.toLowerCase() };
      this.app.setTool({ kind: 'paint' });
      this.syncPaintUi();
    });
    $<HTMLSelectElement>('ed-scope').addEventListener('change', (e) => (this.app.paintScope = (e.target as HTMLSelectElement).value as PaintScope));
    this.syncPaintUi();
  }

  /** Reflect the current brush in the palette. */
  syncPaintUi(): void {
    for (const b of document.querySelectorAll<HTMLElement>('.mat-btn')) b.classList.toggle('active', b.dataset.material === this.app.paintStyle.material);
    for (const b of document.querySelectorAll<HTMLElement>('#ed-tints .swatch')) b.classList.toggle('active', (b.dataset.tint || null) === (this.app.paintStyle.tint ?? null));
    const def = coreMaterials.get(this.app.paintStyle.material);
    const brush = $<HTMLImageElement>('ed-brush');
    if (def) brush.src = materialThumbnail(def, this.app.paintStyle.tint ?? null, 40);
    $('ed-brush-label').textContent = `${def?.displayName ?? this.app.paintStyle.material}${this.app.paintStyle.tint ? ` · ${this.app.paintStyle.tint}` : ''}`;
    if (this.app.paintStyle.tint) $<HTMLInputElement>('ed-tint-custom').value = this.app.paintStyle.tint;
  }

  /**
   * A palette picture rendered now from the real model (PNG data URL): for pieces the prebuilt atlas
   * hasn't got, and for tools/content/build-palette-atlas.mjs, which renders every piece through this.
   * Keys are the palette's: `tile:<id>`, `prop:<id>`, `mount:<id>`.
   */
  thumbFor(key: string, size?: number): Promise<string> | null {
    const at = key.indexOf(':');
    const kind = key.slice(0, at);
    const id = key.slice(at + 1);
    if (kind === 'tile') {
      const def = coreCatalog.get(id);
      return def ? this.app.thumbs.getTile(def, size) : null;
    }
    if (kind === 'prop') {
      const def = getProp(id);
      return def ? this.app.thumbs.get(def.file, 'three-quarter', size) : null;
    }
    if (kind === 'mount') {
      const def = MOUNT_DEFS[id as MountModel];
      return def ? this.app.thumbs.get(def.model, 'three-quarter', size) : null;
    }
    if (kind === 'setpiece') {
      const def = this.app.pieceDef(id);
      if (!def) return null;
      const { doc, models } = this.app.setPieceThumbDoc(def);
      // The player's pieces change as they save over them: the picture is keyed by their content.
      return this.app.thumbs.getMap(id.startsWith('local.') ? `${id}:${JSON.stringify(def).length}:${this.app.pieces.myPiecesRev}` : id, doc, models, size);
    }
    return null;
  }

  paletteButton(grid: HTMLElement, def: TileDefinition, pack?: StylePack): void {
    const b = document.createElement('button');
    b.className = 'tile-btn';
    b.dataset.tool = `tile:${def.id}`;
    // The top-down icon stands in until the picture from the atlas has loaded.
    b.innerHTML = `<span class="thumb">${tileIcon(def)}</span><span class="lbl">${escapeHtml(def.displayName)}</span>`;
    const size = (() => {
      const span = (i: 0 | 1 | 2) => Math.max(...def.cells.map((c) => c[i])) - Math.min(...def.cells.map((c) => c[i])) + 1;
      return `${span(0)} × ${span(1)} × ${span(2)}`;
    })();
    b.title = `${def.displayName}\n${def.blurb ?? ''}\nSize ${size} cells · ${def.ports.length} connectors`.trim();
    b.addEventListener('click', () => this.app.setTool({ kind: 'tile', tile: def.id }));
    grid.append(b);
    this.app.palette.register(b, {
      key: b.dataset.tool,
      name: def.displayName,
      tags: `${def.id} ${def.category} tile structure ${def.blurb ?? ''} ${pack ? pack.style : ''}`,
      pack: pack?.displayName,
      picture: true,
    });
  }
}
