import {
  autoPlayerCaps,
  BACKDROP_GROUNDS,
  blockBoxes,
  BLOOD_AMOUNTS,
  BORDER_LABELS,
  BORDER_SIDES,
  BORDER_STYLES,
  borderRect,
  BOT_CAST_CHOICES,
  BOT_CAST_MAX,
  botCastLabel,
  botSetLabel,
  castLooks,
  CHARACTER_GROUPS,
  coreCatalog,
  coreThemes,
  DEFAULT_BLOOD,
  fitBounds,
  getWeaponSet,
  hasBorder,
  hasRemovedMode,
  isTeamMode,
  mapBotSet,
  mapPlayerCaps,
  mapTeams,
  mapWeaponSet,
  MAX_TEAMS,
  MODE_LABELS,
  placementCells,
  playableModes,
  propBoxes,
  resolveBackdrop,
  SCENERY_IDS,
  SCENERY_LABELS,
  setThemeCommand,
  setupFamily,
  SKIES,
  SKY_IDS,
  TEAM_PRESETS,
  teamLayoutLabel,
  TERRAIN_MATERIAL_LABELS,
  validBotCast,
  weaponSetList,
  withMainMode,
  type Backdrop,
  type BackdropGround,
  type BloodSettings,
  type BorderStyle,
  type BoundaryStyle,
  type MapBotSet,
  type MapDocument,
  type MapPhysics,
  type SceneryId,
  type SkyId
} from '@tiletrigger/shared';
import { botManager } from '../frontend/botManager.ts';
import { BOT_SET_PRESETS } from '../playlists.ts';
import { cardShotSection,type CardShotHost } from './cardShot.ts';
import type { EditorApp } from './editorApp.ts';
import { button,escapeHtml,h2,numberInput,row,small,text } from './editorDom.ts';
import { CARD_HIDDEN_KINDS,dressable,SHIPPED_IDS } from './editorParts.ts';
import { thumbnailSection,type ThumbHost } from './makerThumb.ts';
import { removedModesRow } from './removedModes.ts';
import { skyWeatherSection,type SkyWeatherHost } from './skyWeatherSection.ts';

/** Map properties, the inspector with nothing selected: name, theme, players, modes, teams, weapons, bots, time and weather, layers, blood, physics, the boundary, and Environment → Sky's backdrop (split out of editorApp.ts, MapMaker overhaul Phase 2 item 5). */
export class MapProperties {
  constructor(readonly app: EditorApp) {}

  /** Map properties' time of day and weather (skyWeatherSection.ts). */
  readonly skyWeatherHost: SkyWeatherHost = { current: () => this.app.doc, run: (label, cmd) => this.app.run(label, cmd), preview: (h, w) => this.app.view.previewSky(this.app.doc, h, w) };

  /** What the card shot (cardShot.ts) needs from the editor. */
  readonly cardHost: CardShotHost = {
    view: () => this.app.view,
    current: () => this.app.doc,
    standOn: () => [...this.app.mapBoxes(), ...blockBoxes(this.app.viewDoc), ...propBoxes(this.app.viewDoc)],
    ground: () => this.app.shownGround,
    run: (label, cmd) => this.app.run(label, cmd),
    showAll: () => this.app.showAll,
    setShowAll: (on) => this.app.setShowAll(on, true),
    hideMarkers: (on) => {
      const kinds = this.app.view.hiddenKinds;
      kinds.clear();
      if (on) for (const k of CARD_HIDDEN_KINDS) kinds.add(k);
      this.app.updateSelectionVisuals();
    },
    leavePlan: () => this.app.plan.exit(),
    toast: (message, error) => this.app.toast(message, error),
  };

  /** What Set thumbnail (makerThumb.ts) needs from the editor. */
  readonly thumbHost: ThumbHost = {
    view: () => this.app.view,
    current: () => this.app.doc,
    shipped: () => SHIPPED_IDS.has(this.app.doc.metadata.id),
    setThumbnail: (thumbnail, camera) => {
      const m = this.app.doc.metadata;
      if (thumbnail === m.thumbnail) return;
      this.app.run(thumbnail ? 'Set thumbnail' : 'Clear thumbnail', { kind: 'setMetadata', before: { thumbnail: m.thumbnail, thumbnailCamera: m.thumbnailCamera }, after: { thumbnail, thumbnailCamera: thumbnail ? camera : undefined } });
    },
    toast: (message, error) => this.app.toast(message, error),
  };

  // ---------------------------------------------------------------- the map's own bots

  /**
   * The map's own bots (MapDocument.bots): names, looks, skills, styles, teams and squads for its PvP bots
   * or, in co-op, the players' side. They play unless the host picks a set of their own. The Bots window
   * (the one match setup and the pause menu use) edits them; one undo step per Apply.
   */
  /** Whether the Bot characters list is open (kept across re-renders). */
  castOpen = false;

  renderMapBots(el: HTMLElement): void {
    const doc = this.app.doc;
    const head = document.createElement('h3');
    head.textContent = 'Bots';
    const sum = text(doc.bots?.entries.length ? botSetLabel(mapBotSet(doc)) : 'Random bots');
    sum.id = 'ed-bots-sum';
    const open = button(doc.bots ? 'Edit bots…' : 'Name the bots…', () => {
      if (document.getElementById('bot-manager')) return;
      const main = doc.metadata.supportedModes[0] ?? 'core.deathmatch';
      const teams = isTeamMode(main) ? mapTeams(doc, main === 'core.ctf' ? 2 : (doc.teamSetup?.sizes.length ?? 2)) : [];
      const win = botManager({
        set: mapBotSet(doc),
        teams: teams.map((t) => ({ name: t.name, color: t.color })),
        presets: BOT_SET_PRESETS,
        applyLabel: 'Use for this map',
        note: "This map's own bots: they play unless the host picks a set of their own (Play → Match setup → Bots, or the pause menu).",
        onApply: (set) => {
          const after: MapBotSet | null = set ? { name: set.name, fill: set.fill, entries: set.entries.map((e) => ({ ...e })) } : null;
          this.app.run('Map bots', { kind: 'setMapBots', before: this.app.doc.bots ?? null, after });
        },
        onClose: () => document.getElementById('ed-bots-edit')?.focus(),
      });
      document.body.append(win);
    });
    open.id = 'ed-bots-edit';
    el.append(head, row('Bots', sum), row('', open), small('Name your bots, pick their looks, skill, style, team and squad: a scenario\'s cast, or the players\' squad in co-op.'));
    this.renderBotCast(el);
  }

  /**
   * Map properties: the map's default weapon set (MapDocument.weaponSet; sim/weaponSets.ts): what a match here spawns
   * with, what its weapon and grenade pickups hold and what drops, unless the host picks another. Standard (the
   * mode's own loadout, pickups as placed) leaves no `weaponSet` in the file.
   */
  renderWeaponSet(el: HTMLElement): void {
    const now = mapWeaponSet(this.app.doc);
    const pick = document.createElement('select');
    pick.id = 'ed-prop-weapons';
    for (const s of weaponSetList()) {
      const o = new Option(s.name, s.id, false, s.id === now);
      o.title = s.blurb;
      pick.append(o);
    }
    pick.title = getWeaponSet(now).blurb;
    pick.addEventListener('change', () => {
      const after = pick.value === 'standard' ? null : pick.value;
      if (after !== (this.app.doc.weaponSet ?? null)) this.app.run('Weapon set', { kind: 'setWeaponSet', before: this.app.doc.weaponSet ?? null, after });
    });
    const hint = small(`${getWeaponSet(now).blurb} Hosts can pick another set (Play → Match setup → Weapons, the pause menu's Host tab).`);
    hint.id = 'ed-prop-weapons-hint';
    el.append(row('Weapon set', pick), hint);
  }

  /**
   * Bot characters (MapDocument.botCast): which looks the map's random bots wear, and so their names (a D-Day map:
   * soldiers only, named "Sgt. Dunmore"). Groups and/or name themes; none ticked: every look. Hosts can change it.
   */
  renderBotCast(el: HTMLElement): void {
    const cast = validBotCast(this.app.doc.botCast);
    const set = (next: string[]) => this.app.run('Bot characters', { kind: 'setBotCast', before: this.app.doc.botCast ?? null, after: next.length ? next : null });
    const sum = text(botCastLabel(cast));
    sum.id = 'ed-cast-sum';
    const box = document.createElement('details');
    box.id = 'ed-cast';
    box.open = this.castOpen;
    box.addEventListener('toggle', () => (this.castOpen = box.open));
    const title = document.createElement('summary');
    title.textContent = 'Choose characters…';
    box.append(title);
    const group = (label: string, ids: readonly { id: string; label: string }[]) => {
      const h = document.createElement('small');
      h.textContent = label;
      h.style.display = 'block';
      h.style.marginTop = '4px';
      box.append(h);
      for (const c of ids) {
        const lab = document.createElement('label');
        lab.className = 'ed-cast-pick';
        lab.style.display = 'inline-flex';
        lab.style.gap = '4px';
        lab.style.marginRight = '10px';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.dataset.cast = c.id;
        cb.checked = cast.includes(c.id);
        cb.disabled = !cb.checked && cast.length >= BOT_CAST_MAX;
        cb.addEventListener('change', () => set(cb.checked ? [...cast, c.id] : cast.filter((x) => x !== c.id)));
        lab.append(cb, text(c.label));
        box.append(lab);
      }
    };
    group('Characters', BOT_CAST_CHOICES.filter((c) => CHARACTER_GROUPS.some((g) => g.id === c.id)));
    group('Named as', BOT_CAST_CHOICES.filter((c) => !CHARACTER_GROUPS.some((g) => g.id === c.id)));
    const all = button('All characters', () => set([]));
    all.id = 'ed-cast-all';
    all.disabled = !cast.length;
    el.append(row('Bot characters', sum), box, row('', all), small(`Random bots wear only these characters and take their names (${castLooks(cast).length} looks). None ticked: everyone. Hosts can change it (Match setup, pause menu, server rules).`));
  }

  // ---------------------------------------------------------------- teams

  /** Map properties in team modes: how many teams and how many players on each (2–8 teams of 1–16). */
  renderTeamSetup(el: HTMLElement): void {
    const doc = this.app.doc;
    const sizes = doc.teamSetup?.sizes ?? [4, 4];
    const set = (label: string, next: number[]) => this.app.run(label, { kind: 'setTeamSetup', before: doc.teamSetup, after: { sizes: next } });
    const head = document.createElement('h3');
    head.textContent = `Teams · ${teamLayoutLabel(sizes)}`;
    el.append(head);
    const presets = document.createElement('select');
    presets.id = 'ed-team-preset';
    presets.append(new Option('Presets…', ''));
    for (const p of TEAM_PRESETS) presets.append(new Option(`${teamLayoutLabel(p)} (${p.reduce((a, b) => a + b, 0)} players)`, p.join(',')));
    presets.addEventListener('change', () => presets.value && set('Set teams', presets.value.split(',').map(Number)));
    el.append(row('Layout', presets));
    const teams = mapTeams(doc, sizes.length);
    teams.forEach((t, i) => {
      const input = numberInput(sizes[i] ?? 1, 1, (v) => set('Set team size', sizes.map((s, j) => (j === i ? Math.max(1, Math.min(48, Math.round(v))) : s))));
      input.dataset.team = t.id;
      const label = document.createElement('span');
      label.innerHTML = `<span style="color:${t.color}">●</span> ${escapeHtml(t.name)}`;
      const r = row('', input);
      r.firstElementChild?.replaceWith(label);
      el.append(r);
    });
    const buttons = document.createElement('div');
    buttons.className = 'ed-row-buttons';
    const add = button('+ Team', () => set('Add team', [...sizes, sizes[sizes.length - 1] ?? 2]));
    add.id = 'ed-team-add';
    add.disabled = sizes.length >= MAX_TEAMS;
    const remove = button('− Team', () => set('Remove team', sizes.slice(0, -1)));
    remove.disabled = sizes.length <= 2;
    buttons.append(add, remove);
    const total = sizes.reduce((a, b) => a + b, 0);
    el.append(buttons, small(`${total} players in all${total > 32 ? ' (a match holds 32: the biggest teams will be short)' : ''}. Bots fill every team to its size in TEST and the Arcade.`));
  }

  // ---------------------------------------------------------------- backdrop

  /** What surrounds the map: sky, distant scenery, ground past the border and haze (the theme's unless set). */
  renderBackdropPanel(el: HTMLElement): void {
    const head = document.createElement('h3');
    head.id = 'ed-backdrop-head';
    head.textContent = 'Backdrop';
    el.append(head);
    const own = this.app.doc.backdrop;
    const b = resolveBackdrop(this.app.doc);
    const set = (label: string, after: Backdrop | null) => this.app.run(label, { kind: 'setBackdrop', before: this.app.doc.backdrop, after });
    const patch = (p: Partial<Backdrop>) => set('Change backdrop', { ...b, ...p });
    const select = (id: string, options: readonly (readonly [string, string])[], value: string, change: (v: string) => void) => {
      const sel = document.createElement('select');
      sel.id = id;
      for (const [v, label] of options) sel.append(new Option(label, v, false, v === value));
      sel.addEventListener('change', () => change(sel.value));
      return sel;
    };
    el.append(
      row('Sky', select('ed-bd-sky', SKY_IDS.map((id) => [id, SKIES.get(id)?.name ?? id] as const), b.sky, (v) => patch({ sky: v as SkyId }))),
      row('Scenery', select('ed-bd-scenery', SCENERY_IDS.map((id) => [id, SCENERY_LABELS[id]] as const), b.scenery, (v) => patch({ scenery: v as SceneryId }))),
      row(
        'Ground beyond',
        select('ed-bd-ground', BACKDROP_GROUNDS.map((g) => [g, g === 'water' ? 'Water' : g === 'none' ? 'None (open sky)' : TERRAIN_MATERIAL_LABELS[g]] as const), b.ground, (v) => patch({ ground: v as BackdropGround })),
      ),
    );
    const haze = document.createElement('input');
    haze.type = 'range';
    haze.min = '0';
    haze.max = '100';
    haze.step = '5';
    haze.value = String(Math.round(b.haze * 100));
    haze.id = 'ed-bd-haze';
    haze.addEventListener('change', () => patch({ haze: Number(haze.value) / 100 }));
    el.append(row('Haze', haze));
    const mist = document.createElement('input');
    mist.type = 'range';
    mist.min = '0';
    mist.max = '100';
    mist.step = '5';
    mist.value = String(Math.round((b.mist ?? 0) * 100));
    mist.id = 'ed-bd-mist';
    mist.title = 'Fog that pools in low ground (valleys, ditches, the canyon floor) and thins with height. Medium and high graphics.';
    mist.addEventListener('change', () => patch({ mist: Number(mist.value) / 100 }));
    el.append(row('Ground mist', mist));
    // Border: what stands just outside the boundary (one style, or one per side).
    const borderOptions = BORDER_STYLES.map((st) => [st, BORDER_LABELS[st]] as const);
    el.append(
      row(
        'Border',
        // Coast is for the sides a shoreline runs out through: offered per side.
        select('ed-bd-border', borderOptions.filter(([st]) => st !== 'coast' || b.border === 'coast'), b.border ?? 'none', (v) => {
          const { border: _border, borderSides: _sides, ...rest } = b;
          set('Change border', v === 'none' ? rest : { ...rest, border: v as BorderStyle });
        }),
      ),
    );
    const sides = document.createElement('details');
    sides.id = 'ed-bd-border-sides';
    sides.open = !!b.borderSides && Object.keys(b.borderSides).length > 0;
    const summary = document.createElement('summary');
    summary.textContent = 'Per side';
    sides.append(summary);
    for (const side of BORDER_SIDES) {
      const label = side[0]!.toUpperCase() + side.slice(1);
      const value = b.borderSides?.[side];
      sides.append(
        row(
          label,
          select(`ed-bd-border-${side}`, [['', 'Same as border'], ...borderOptions], value ?? '', (v) => {
            const next = { ...(b.borderSides ?? {}) };
            if (v) next[side] = v as BorderStyle;
            else delete next[side];
            const { borderSides: _sides, ...rest } = b;
            set('Change border', Object.keys(next).length ? { ...rest, borderSides: next } : rest);
          }),
        ),
      );
    }
    el.append(sides);
    if (hasBorder(this.app.doc) && !borderRect(this.app.doc)) el.append(small('A border stands along the map boundary: set one with the Boundary tool.'));
    if (own) el.append(button('Use the theme\'s backdrop', () => set('Theme backdrop', null)));
    el.append(small(own ? (hasBorder(this.app.doc) ? 'The border is solid (the fence zaps); the rest is drawn only.' : 'Drawn only: nothing out there blocks players or shots.') : "Following the theme. Change anything to give this map its own."));
  }

  // ---------------------------------------------------------------- blood

  /** Blood colour and amount for this map (red and light unless set): green for aliens, black oil for robots, or none. */
  renderBloodPanel(el: HTMLElement): void {
    const head = document.createElement('h3');
    head.textContent = 'Blood';
    el.append(head);
    const b: BloodSettings = this.app.doc.blood ?? { ...DEFAULT_BLOOD };
    const set = (after: BloodSettings | null) => this.app.run('Change blood', { kind: 'setBlood', before: this.app.doc.blood, after });
    const color = document.createElement('input');
    color.type = 'color';
    color.id = 'ed-blood-color';
    color.value = b.color;
    color.addEventListener('change', () => set({ ...b, color: color.value }));
    const amount = document.createElement('select');
    amount.id = 'ed-blood-amount';
    const labels: Record<(typeof BLOOD_AMOUNTS)[number], string> = { off: 'None', light: 'Light', heavy: 'Heavy' };
    for (const a of BLOOD_AMOUNTS) amount.append(new Option(labels[a], a, false, a === b.amount));
    amount.addEventListener('change', () => set({ ...b, amount: amount.value as BloodSettings['amount'] }));
    el.append(row('Colour', color), row('Amount', amount));
    const swatches = document.createElement('div');
    swatches.className = 'ed-row-buttons';
    for (const [label, hex] of [['Red', '#8a0b0b'], ['Alien', '#3f9b1f'], ['Oil', '#1b1b1f'], ['Ichor', '#d7b21a'], ['Coolant', '#2a7fd0']] as const) {
      const sw = button(label, () => set({ ...b, color: hex }));
      sw.style.borderLeft = `10px solid ${hex}`;
      swatches.append(sw);
    }
    el.append(swatches);
    if (this.app.doc.blood) el.append(button('Default blood', () => set(null)));
    el.append(small('Hit sprays, splats and pools. Players can still switch blood off in the pause menu.'));
  }

  // ---------------------------------------------------------------- gravity and falls

  /** Map physics: gravity (moon to heavy) and fall damage; arcade and servers can override both. */
  renderPhysicsPanel(el: HTMLElement): void {
    const head = document.createElement('h3');
    head.textContent = 'Gravity & falls';
    el.append(head);
    const p: MapPhysics = this.app.doc.physics ?? { gravity: 1, fallDamage: false };
    const set = (after: MapPhysics) => this.app.run('Change physics', { kind: 'setPhysics', before: this.app.doc.physics, after: after.gravity === 1 && !after.fallDamage ? null : after });
    const gravity = document.createElement('select');
    gravity.id = 'ed-gravity';
    for (const [v, label] of [[0.25, 'Moon (¼)'], [0.5, 'Low (½)'], [0.75, 'Light (¾)'], [1, 'Normal'], [1.5, 'Heavy (1½×)'], [2, 'Crushing (2×)']] as const) gravity.append(new Option(label, String(v), false, Math.abs(p.gravity - v) < 0.01));
    gravity.addEventListener('change', () => set({ ...p, gravity: Number(gravity.value) }));
    const fall = document.createElement('select');
    fall.id = 'ed-fall-damage';
    fall.append(new Option('Off', 'off', false, !p.fallDamage), new Option('On', 'on', false, p.fallDamage));
    fall.addEventListener('change', () => set({ ...p, fallDamage: fall.value === 'on' }));
    el.append(row('Gravity', gravity), row('Fall damage', fall));
    el.append(small('Gravity changes jumps, falls and jump-pad arcs. With fall damage on, drops past about 5 m hurt and about 16 m kill (jump pads, ladders and water are safe). Match settings can override both.'));
    // Glass: when shattered panes come back.
    const back = document.createElement('select');
    back.id = 'ed-glass-respawn';
    const now = this.app.doc.glass?.respawnSeconds ?? null;
    for (const [v, label] of [[null, 'Next round'], [15, 'After 15 s'], [30, 'After 30 s'], [60, 'After 1 min'], [120, 'After 2 min']] as const) back.append(new Option(label, v === null ? '' : String(v), false, now === v));
    back.addEventListener('change', () => this.app.run('Glass respawn', { kind: 'setGlass', before: this.app.doc.glass ?? null, after: back.value ? { respawnSeconds: Number(back.value) } : null }));
    el.append(row('Broken glass returns', back));
  }

  // ---------------------------------------------------------------- boundary

  /** Map properties: walls round the play area, fitted to the map in one click. */
  renderBoundsPanel(el: HTMLElement): void {
    const doc = this.app.doc;
    const head = document.createElement('h3');
    head.textContent = 'Boundary';
    el.append(head);
    const b = doc.bounds;
    const style = document.createElement('select');
    style.id = 'ed-bounds-style';
    for (const [v, label] of [['', 'None'], ['invisible', 'Invisible walls'], ['wall', 'Solid walls'], ['fence', 'Tall fence']] as const) style.append(new Option(label, v, false, (b?.style ?? '') === v));
    const set = (label: string, after: MapDocument['bounds']) => this.app.run(label, { kind: 'setBounds', before: this.app.doc.bounds, after });
    style.addEventListener('change', () => {
      if (!style.value) return set('Remove boundary', null);
      const fit = b ?? fitBounds(this.app.doc, 4);
      if (!fit) return this.app.toast('Build something first: the boundary fits round the map', true);
      set('Set boundary', { min: fit.min, max: fit.max, style: style.value as BoundaryStyle, height: b?.height ?? 8 });
    });
    el.append(row('Walls', style));
    if (b) {
      const fitBtn = button('Fit to map', () => {
        const fit = fitBounds(this.app.doc, 4);
        if (fit) set('Fit boundary', { ...b, ...fit });
      });
      fitBtn.id = 'ed-bounds-fit';
      const edge = (label: string, v: number, patch: (v: number) => Partial<NonNullable<MapDocument['bounds']>>) => row(label, numberInput(v, 1, (n) => set('Move boundary', { ...b, ...patch(n) })));
      el.append(
        edge('West (X)', b.min[0], (v) => ({ min: [Math.min(v, b.max[0] - 4), b.min[1]] })),
        edge('East (X)', b.max[0], (v) => ({ max: [Math.max(v, b.min[0] + 4), b.max[1]] })),
        edge('South (Z)', b.min[1], (v) => ({ min: [b.min[0], Math.min(v, b.max[1] - 4)] })),
        edge('North (Z)', b.max[1], (v) => ({ max: [b.max[0], Math.max(v, b.min[1] + 4)] })),
      );
      if (b.style !== 'invisible') el.append(edge('Height (m)', b.height, (v) => ({ height: Math.max(1, Math.min(60, v)) })));
      el.append(fitBtn, small('Nothing gets past the boundary: players, bots, shots or grenades. The orange outline shows it in MapMaker.'));
    } else el.append(small('Fence the map in: pick a style and the boundary fits round everything you have built.'));
  }

  /** Environment → Sky: the backdrop's one home, kept in step with the map. */
  renderSkyPane(): void {
    const el = document.getElementById('ed-sky');
    if (!el) return;
    el.replaceChildren();
    this.renderBackdropPanel(el);
  }

  /**
   * Players by mode (the map's player caps, metadata.playerCaps): for each mode the map plays (squads keep
   * their own sizes), the recommended and most players. Empty fields show the automatic caps (worked out from the
   * map's size and spawn points: sim/matchSetup.ts autoPlayerCaps); typing one sets the mode's own, Auto goes back.
   */
  renderPlayerCaps(el: HTMLElement): void {
    const doc = this.app.doc;
    const modes = playableModes(doc).filter((m) => setupFamily(m) === 'ffa' || setupFamily(m) === 'teams');
    if (!modes.length) return;
    const head = document.createElement('h3');
    head.textContent = 'Players by mode';
    head.title = 'What Match Setup recommends for each mode and the most it takes here; rotations and map changes keep matches within the most';
    const box = document.createElement('div');
    box.id = 'ed-player-caps';
    box.className = 'ed-caps';
    for (const mode of modes) {
      const caps = mapPlayerCaps(doc, mode);
      const auto = autoPlayerCaps(doc, mode);
      const set = (recommended: number, max: number) => {
        const before = doc.metadata.playerCaps;
        const r = Math.max(1, Math.min(128, Math.round(recommended)));
        const m = Math.max(r, Math.min(128, Math.round(max)));
        this.app.run(`Set ${MODE_LABELS[mode]} players`, { kind: 'setMetadata', before: { playerCaps: before }, after: { playerCaps: { ...(before ?? {}), [mode]: { recommended: r, max: m } } } });
      };
      const rec = numberInput(caps.recommended, 1, (v) => set(v, Math.max(v, caps.max)));
      rec.dataset.mode = mode;
      rec.dataset.cap = 'recommended';
      rec.title = `Recommended (automatic: ${auto.recommended})`;
      const max = numberInput(caps.max, 1, (v) => set(Math.min(caps.recommended, v), v));
      max.dataset.mode = mode;
      max.dataset.cap = 'max';
      max.title = `Most (automatic: ${auto.max})`;
      const line = document.createElement('div');
      line.className = 'ed-cap-row';
      line.append(rec, document.createTextNode(' best, up to '), max);
      if (caps.auto) line.append(small(' (automatic)'));
      else {
        const back = document.createElement('button');
        back.type = 'button';
        back.className = 'ed-cap-auto';
        back.textContent = 'Auto';
        back.title = `Back to the automatic caps (${auto.recommended} best, up to ${auto.max})`;
        back.addEventListener('click', () => {
          const before = doc.metadata.playerCaps;
          const { [mode]: _gone, ...rest } = before ?? {};
          this.app.run(`${MODE_LABELS[mode]} players: automatic`, { kind: 'setMetadata', before: { playerCaps: before }, after: { playerCaps: Object.keys(rest).length ? rest : undefined } });
        });
        line.append(back);
      }
      box.append(row(MODE_LABELS[mode], line));
    }
    el.append(head, box);
  }

  /** Nothing selected: Map properties (name, theme, players, modes, teams, weapons, bots, sky and weather, layers…). */
  renderMapProperties(el: HTMLElement): void {
    const doc = this.app.doc;
    el.append(h2('Map properties'));
    // The map's picture (Set thumbnail) and plan (reference board: map properties).
    el.append(thumbnailSection(this.thumbHost));
    // The menu card shot's camera (MapMaker overhaul Phase 3 item 8).
    el.append(cardShotSection(this.cardHost));
    // Note pins (MapMaker overhaul Phase 3 item 7): every note, to go to or delete.
    el.append(this.app.notes.section());
    const name = document.createElement('input');
    name.type = 'text';
    name.id = 'ed-prop-name';
    name.value = doc.metadata.name;
    name.maxLength = 80;
    name.addEventListener('change', () => {
      const v = name.value.trim().slice(0, 80) || 'Untitled Map';
      if (v !== this.app.doc.metadata.name) this.app.run('Rename map', { kind: 'setMetadata', before: { name: this.app.doc.metadata.name }, after: { name: v } });
    });
    el.append(row('Name', name));
    const theme = document.createElement('select');
    for (const t of coreThemes.all()) theme.append(new Option(t.displayName, t.id, false, t.id === doc.classicStructure.theme));
    theme.addEventListener('change', () => this.app.run('Change theme', setThemeCommand(this.app.doc, theme.value)));
    el.append(row('Theme', theme));
    const occupied = [...doc.classicStructure.tiles.flatMap((t) => placementCells(t) ?? []), ...[...this.app.expansion.footprints.values()].flat()];
    if (occupied.length) {
      const span = (i: 0 | 1 | 2) => Math.max(...occupied.map((c) => c[i])) - Math.min(...occupied.map((c) => c[i])) + 1;
      el.append(row('Size', text(`${span(0)} × ${span(1)} cells · ${span(2)} level${span(2) === 1 ? '' : 's'}`)));
    }
    const rp = doc.metadata.recommendedPlayers;
    const setPlayers = (min: number, max: number) =>
      this.app.run('Set player count', { kind: 'setMetadata', before: { recommendedPlayers: rp }, after: { recommendedPlayers: { min: Math.max(1, Math.min(96, min)), max: Math.max(1, Math.min(96, max)) } } });
    el.append(row('Min players', numberInput(rp.min, 1, (v) => setPlayers(v, rp.max))), row('Max players', numberInput(rp.max, 1, (v) => setPlayers(rp.min, v))));
    const mode = document.createElement('select');
    const current = doc.metadata.supportedModes[0] ?? 'core.deathmatch';
    for (const [id, label] of [['core.deathmatch', 'Deathmatch'], ['core.tdm', 'Team Deathmatch'], ['core.ctf', 'Capture the Flag'], ['core.koth', 'King of the Hill'], ['core.elim', 'Elimination'], ['core.breakthrough', 'Breakthrough'], ['core.coop', 'Co-op mission'], ['core.zombies', 'Zombies'], ['core.discs', 'Disc Arena']] as const) mode.append(new Option(label, id, false, id === current));
    // The main mode (the map's pick, what TEST plays) changes; the modes it also offers stay.
    mode.addEventListener('change', () => this.app.run('Change mode', { kind: 'setMetadata', before: { supportedModes: doc.metadata.supportedModes }, after: { supportedModes: withMainMode([mode.value, ...doc.metadata.supportedModes.slice(1)], mode.value) } }));
    const teams = mapTeams(doc);
    const help: Record<string, string> = {
      'core.coop': 'Co-op: all players (and bots) team up against the NPC squads. Logic ends the mission with "players win" or "players lose".',
      'core.zombies': 'Zombies: everyone holds out against endless waves. Zombies rise from your NPC spawners (vents, hatches, burrows) first, then out-of-sight spawn points and open floor. Every map can be played this way.',
      'core.tdm': `Team Deathmatch: ${teams.map((t) => t.name).join(' against ')}. Give spawns a team in their inspector; teams without spawns of their own use the shared ones.`,
      'core.deathmatch': 'Deathmatch: everyone for themselves. NPC squads fight everyone.',
      'core.ctf': `Capture the Flag: ${teams.slice(0, 2).map((t) => t.name).join(' against ')}. Place a Flag Base (Entities tab) for each team; bring the enemy flag to yours while yours is home. Other modes ignore flag bases.`,
      'core.hostage': 'Hostage Rescue: place Hostages and at least one Rescue Zone; the first team rescues.',
      'core.breakthrough': 'Breakthrough: the first team attacks through the sectors in order, the second holds each line in turn. Entities tab (Spawns & Objectives): place a Sector for each line (1, 2, 3…, facing the way the attackers push), its objectives (Capture Zones, Destroy Targets, a Final Hold in the last) and an Attackers\' and a Defenders\' Spawn group for each sector.',
      'core.discs': 'Disc Arena: everyone throws bouncing discs that knock players about; knocking someone into the void scores. Build decks over nothing (free blocks), join them with jump pads, add walls to bank discs off, and place power disc pickups.',
      'core.bomb': 'Bomb: place Bomb Sites (A and B) away from both team spawns; the first team attacks.',
      'core.koth': 'King of the Hill: place one or more Hills (Entities tab). The hill moves to the next one every minute; a team scores while it alone stands on it.',
      'core.elim': 'Elimination: round-based Team Deathmatch. No respawns until the next round; the last team standing wins it.',
    };
    // Maps with flag bases or hills also offer those modes in the Arcade, whatever the main mode is.
    const extra = playableModes(doc).filter((m) => m !== current && m !== 'core.elim');
    if (extra.length) help[mode.value] = `${help[mode.value] ?? ''} Also playable here: ${extra.map((m) => MODE_LABELS[m]).join(', ')}.`;
    el.append(row('Mode', mode), small(help[mode.value] ?? ''));
    if (hasRemovedMode(doc.metadata.supportedModes)) el.append(removedModesRow(doc.metadata.supportedModes, (next) => this.app.run('Drop Race from the modes', { kind: 'setMetadata', before: { supportedModes: doc.metadata.supportedModes }, after: { supportedModes: next } })));
    // Modes the map offers besides its main one (the rest follow from its pieces: flag bases, hills, sectors...).
    const also = document.createElement('div');
    also.id = 'ed-prop-also';
    also.className = 'ed-layers';
    for (const [id, label] of [['core.deathmatch', 'Deathmatch'], ['core.tdm', 'Team Deathmatch'], ['core.coop', 'Co-op mission']] as const) {
      if (id === current) continue;
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.dataset.mode = id;
      box.checked = doc.metadata.supportedModes.includes(id);
      box.addEventListener('change', () => {
        const now = this.app.doc.metadata.supportedModes;
        const next = box.checked ? [...now.filter((m) => m !== id), id] : now.filter((m) => m !== id);
        this.app.run(box.checked ? `Also offer ${label}` : `Stop offering ${label}`, { kind: 'setMetadata', before: { supportedModes: now }, after: { supportedModes: next.length ? next : [current] } });
      });
      const lab = document.createElement('label');
      lab.append(box, document.createTextNode(label));
      also.append(lab);
    }
    const alsoRow = row('Also offered', also);
    alsoRow.title = 'Other modes Match Setup offers on this map; the Mode above is its own pick and what TEST plays';
    el.append(alsoRow);
    if (current === 'core.tdm' || current === 'core.koth' || current === 'core.elim' || current === 'core.breakthrough') this.renderTeamSetup(el);
    this.renderWeaponSet(el);
    this.renderMapBots(el);
    this.renderPlayerCaps(el);
    // Time of day and weather (MapMaker overhaul Phase 5).
    el.append(skyWeatherSection(this.skyWeatherHost));
    const layersHead = document.createElement('h3');
    layersHead.id = 'ed-layers-head';
    layersHead.textContent = 'Map layers';
    const layers = document.createElement('div');
    layers.className = 'ed-layers';
    for (const [key, label] of [['tile', 'Tiles'], ['prop', 'Props'], ['pickup', 'Pickups'], ['logic', 'Logic & traps'], ['spawn', 'Spawn points']] as const) {
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.dataset.layer = key;
      box.checked = !this.app.view.hiddenLayers.has(key);
      box.addEventListener('change', () => {
        if (box.checked) this.app.view.hiddenLayers.delete(key);
        else this.app.view.hiddenLayers.add(key);
        this.app.view.applyTileLayer();
        this.app.updateSelectionVisuals();
      });
      const lab = document.createElement('label');
      lab.append(box, document.createTextNode(label));
      layers.append(lab);
    }
    el.append(layersHead, layers);
    const desc = document.createElement('textarea');
    desc.rows = 3;
    desc.value = doc.metadata.description;
    desc.placeholder = 'Description';
    desc.addEventListener('change', () => this.app.run('Edit description', { kind: 'setMetadata', before: { description: doc.metadata.description }, after: { description: desc.value.slice(0, 2000) } }));
    el.append(desc);
    // A map for the tests (maps/test_coverage.json): no map list, template list, rotation or host picker offers it.
    const testOnly = document.createElement('input');
    testOnly.type = 'checkbox';
    testOnly.id = 'ed-prop-testonly';
    testOnly.checked = !!doc.metadata.testOnly;
    testOnly.addEventListener('change', () => this.app.run(testOnly.checked ? 'Mark as test map' : 'Unmark test map', { kind: 'setMetadata', before: { testOnly: doc.metadata.testOnly }, after: { testOnly: testOnly.checked || undefined } }));
    const testRow = row('Test map', testOnly);
    testRow.title = 'A map for the automated tests: hidden from the map lists, templates, rotations and the host picker';
    el.append(testRow);
    // The map's ID (its file name in maps/: `iron_coast` is maps/iron_coast.json), for a new official or test map.
    const mapId = document.createElement('input');
    mapId.type = 'text';
    mapId.id = 'ed-prop-id';
    mapId.value = doc.metadata.id;
    mapId.maxLength = 64;
    mapId.pattern = '[a-z0-9_]{4,64}';
    mapId.addEventListener('change', () => {
      const v = mapId.value.trim();
      if (!/^[a-z0-9_]{4,64}$/.test(v)) {
        mapId.value = doc.metadata.id;
        return this.app.toast('A map ID is 4 to 64 lowercase letters, digits and underscores (its file name in maps/)', true);
      }
      if (v !== this.app.doc.metadata.id) this.app.run('Change map ID', { kind: 'setMetadata', before: { id: this.app.doc.metadata.id }, after: { id: v } });
    });
    const idRow = row('Map ID', mapId);
    idRow.title = "The map's ID: lowercase letters, digits and underscores; an official map's file is maps/<ID>.json. Set it once, before the map is shared: a published or exported map keeps its ID.";
    el.append(idRow);

    const sky = button('Sky, scenery & border…', () => {
      this.app.topBar.setWorkspace('environment');
      this.app.showPane('sky');
    });
    sky.title = 'The sky, distant scenery, haze and the border live in Environment → Sky';
    el.append(sky);
    this.renderBloodPanel(el);
    this.renderPhysicsPanel(el);
    if (doc.classicStructure.tiles.some((t) => dressable(coreCatalog.get(t.tile)))) {
      const all = button('Dress all bare rooms', () => this.app.dressAllRooms());
      all.id = 'ed-dress-all';
      all.title = 'Furnish every room with no props in it, as a room type guessed from its size and the theme (undo takes it back)';
      el.append(all);
    }
    if (doc.terrain && doc.entities.some((e) => e.kind === 'prop')) {
      const settle = button('Settle all props on ground', () => this.app.settleProps());
      settle.id = 'ed-settle-all';
      el.append(settle, small('Beds every prop standing on the terrain into the slope under it; props on floors and blocks stay put.'));
    }
    this.renderBoundsPanel(el);
  }
}
