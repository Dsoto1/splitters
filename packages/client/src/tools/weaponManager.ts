import { CORE_WEAPONS, WEAPON_CATEGORIES, WEAPON_CATEGORY_LABELS, firingOf, gunplayOf, TICK_RATE, type Ballistics, type WeaponDefinition } from '@tiletrigger/shared';
import { AudioSystem, type SoundId } from '../audio/audio.ts';
import { weaponIcon } from '../frontend/weaponIcons.ts';
import { TEXT_LIMITS, statField, type SoundSlot, type StatField, type WeaponEdit } from '../../../../tools/content/weapon-edits-format.mjs';
import { SERIES, barsSection, conesSection, drawCharts, fmt, lineSection, recoilSection, type CompareCtx, type Pick } from './weaponCompare.ts';
import type { WeaponStats } from './weaponTuningData.ts';
import {
  applicableStats,
  changeSet,
  currentSound,
  currentStat,
  descriptionOf,
  designNoteOf,
  editedDef,
  hideBlockers,
  infoOf,
  loadEdits,
  saveEdits,
  setsOf,
  soundGroups,
  soundSlots,
  tidy,
  weaponList,
  type Edits,
} from './weaponManagerData.ts';

/**
 * The owner's Weapon Manager (docs/FEATURES.md, "Weapon Manager"; the Manage tab of `?mode=weapons`): every weapon
 * with its picture, name, category, description, stats, sounds and sets. The owner renames, hides (and shows again),
 * picks sounds from the game's own library (with a play button), edits sets, category, description and stats (the
 * tuning page's comparisons update live, the game's value beside each edited one, values kept in range) and leaves
 * notes. Edits stay in this browser until sent; Send changes makes one JSON change set (Download, Copy) that
 * `node tools/content/apply-weapon-edits.mjs` applies in the repo. The page itself changes nothing in the game.
 * `window.__weaponManager` reads it in tests.
 */

const CSS = `
#wm-root { padding: 12px 16px 60px; max-width: 1280px; margin: 0 auto; }
#wm-root .wm-bar { display: flex; flex-wrap: wrap; gap: 8px 10px; align-items: center; margin: 4px 0 6px; }
#wm-root .wm-bar input[type=search] { flex: 1 1 200px; min-width: 0; }
#wm-root .wm-spacer { flex: 1 1 0; }
#weapon-tuning .wm-btn { background: var(--wt-surface); color: var(--wt-ink); border: 1px solid var(--wt-line); border-radius: 8px; padding: 7px 12px; font: 600 13px Barlow, sans-serif; cursor: pointer; white-space: nowrap; }
#weapon-tuning .wm-btn:hover:not(:disabled) { border-color: #4b5763; }
#weapon-tuning .wm-btn:disabled { opacity: 0.45; cursor: default; }
#weapon-tuning .wm-btn.wm-primary { background: #2f6fb8; border-color: #3987e5; }
#weapon-tuning .wm-btn.wm-small { padding: 3px 8px; font-size: 12px; }
#weapon-tuning .wm-btn[aria-pressed=true] { background: #2a3540; }
#wm-root .wm-filter { display: inline-flex; gap: 4px; }
#wm-root .wm-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 10px; }
#wm-root .wm-card { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 4px 12px; background: var(--wt-surface); border: 1px solid var(--wt-line); border-radius: 10px; padding: 10px 12px; cursor: pointer; text-align: left; color: inherit; font: inherit; }
#wm-root .wm-card:hover, #wm-root .wm-card:focus-visible { border-color: #4b5763; outline: none; }
#wm-root .wm-card.is-hidden { opacity: 0.7; border-style: dashed; }
#weapon-tuning .wm-pic { width: 96px; height: 42px; display: grid; place-items: center; background: #14181b; border-radius: 6px; overflow: hidden; color: var(--wt-muted); font-size: 11px; }
#weapon-tuning .wm-pic img { max-width: 100%; max-height: 100%; }
#wm-root .wm-card h3 { margin: 0; font: 600 15px Barlow, sans-serif; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
#weapon-tuning .wm-badge { font: 600 11px Barlow, sans-serif; letter-spacing: 0.04em; text-transform: uppercase; padding: 1px 6px; border-radius: 4px; background: #2a3540; color: var(--wt-ink2); }
#weapon-tuning .wm-badge.edited { background: #3a3220; color: #e8c872; }
#weapon-tuning .wm-badge.hidden { background: #3a2626; color: #e89a9a; }
#wm-root .wm-sub, #wm-root .wm-line { color: var(--wt-ink2); font-size: 12.5px; }
#wm-root .wm-desc { margin: 2px 0; color: var(--wt-ink2); font-size: 12.5px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
#wm-root .wm-desc.muted { color: var(--wt-muted); font-style: italic; }
#wm-root .wm-card .wm-body { grid-column: 1 / -1; display: grid; gap: 2px; }
#weapon-tuning .wm-chip { display: inline-block; margin: 2px 4px 0 0; padding: 0 6px; border-radius: 4px; border: 1px solid var(--wt-line); color: var(--wt-ink2); font-size: 11.5px; }
#weapon-tuning .wm-overlay { position: fixed; inset: 0; z-index: 60; background: rgba(0, 0, 0, 0.55); display: flex; justify-content: flex-end; }
#weapon-tuning .wm-sheet { width: min(860px, 100%); height: 100%; overflow-y: auto; background: var(--wt-bg); border-left: 1px solid var(--wt-line); padding: 0 16px 40px; }
#weapon-tuning .wm-dialog { margin: auto; width: min(720px, calc(100% - 24px)); max-height: calc(100% - 24px); overflow-y: auto; background: var(--wt-bg); border: 1px solid var(--wt-line); border-radius: 12px; padding: 0 16px 16px; }
#weapon-tuning .wm-head { position: sticky; top: 0; z-index: 1; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 12px 0; background: var(--wt-bg); border-bottom: 1px solid var(--wt-line); }
#weapon-tuning .wm-head h2 { margin: 0; flex: 1 1 auto; font: italic 700 18px 'Chakra Petch', sans-serif; text-transform: none; letter-spacing: 0.01em; }
#weapon-tuning .wm-sheet section, #weapon-tuning .wm-dialog section { margin: 16px 0; }
#weapon-tuning .wm-field { display: grid; grid-template-columns: 130px minmax(0, 1fr); gap: 6px 12px; align-items: center; margin: 6px 0; }
#weapon-tuning .wm-field > span { color: var(--wt-ink2); font-size: 13px; }
#weapon-tuning .wm-field input[type=text], #weapon-tuning textarea, #weapon-tuning .wm-field select { width: 100%; }
#weapon-tuning textarea { background: var(--wt-surface); color: var(--wt-ink); border: 1px solid var(--wt-line); border-radius: 6px; padding: 6px 8px; font: inherit; resize: vertical; min-height: 56px; }
#weapon-tuning .wm-stats { display: grid; grid-template-columns: minmax(110px, 1.2fr) 96px minmax(40px, 0.5fr) minmax(90px, 1fr) 28px; gap: 6px 10px; align-items: center; font-size: 13px; }
#weapon-tuning .wm-stats .k { color: var(--wt-ink2); }
#weapon-tuning .wm-stats input { width: 96px; }
#weapon-tuning .wm-stats .u { color: var(--wt-muted); font-size: 12px; }
#weapon-tuning .wm-stats .was { color: var(--wt-muted); font-size: 12px; font-variant-numeric: tabular-nums; }
#weapon-tuning .wm-stats .was.changed { color: #e8c872; }
#weapon-tuning .wm-stats .wm-x, #weapon-tuning .wm-x { background: none; border: 0; color: var(--wt-muted); cursor: pointer; font-size: 15px; padding: 0; }
#weapon-tuning .wm-stats .wm-x:hover { color: var(--wt-ink); }
#weapon-tuning .wm-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; padding: 6px 0; border-bottom: 1px solid var(--wt-grid); }
#weapon-tuning .wm-row .grow { flex: 1 1 160px; min-width: 0; }
#weapon-tuning .wm-row .id { color: var(--wt-muted); font-size: 12px; }
#weapon-tuning .wm-play { width: 30px; height: 30px; border-radius: 50%; border: 1px solid var(--wt-line); background: var(--wt-surface); color: var(--wt-ink); cursor: pointer; font-size: 12px; }
#weapon-tuning .wm-play:hover { border-color: #3987e5; }
#weapon-tuning .wm-warn { color: #e8c872; font-size: 12.5px; }
#weapon-tuning .wm-bad { color: #f08a8a; font-size: 12.5px; }
#weapon-tuning .wm-ok { color: #7fd1a8; font-size: 12.5px; }
#weapon-tuning .wm-json { width: 100%; min-height: 220px; font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre; }
#weapon-tuning .wm-steps { margin: 6px 0 0; padding-left: 20px; color: var(--wt-ink2); font-size: 13px; }
#weapon-tuning .wm-sets label { display: flex; align-items: center; gap: 8px; padding: 3px 0; color: var(--wt-ink); font-size: 13.5px; }
#weapon-tuning .wm-sets small { color: var(--wt-muted); }
#weapon-tuning .wm-compare .cols { grid-template-columns: repeat(2, minmax(0, 1fr)); }
@media (max-width: 720px) {
  #wm-root .wm-list { grid-template-columns: minmax(0, 1fr); }
  #weapon-tuning .wm-field { grid-template-columns: minmax(0, 1fr); gap: 2px; }
  #weapon-tuning .wm-stats { grid-template-columns: minmax(0, 1fr) 84px 28px; }
  #weapon-tuning .wm-stats input { width: 84px; }
  #weapon-tuning .wm-stats .u { display: none; }
  #weapon-tuning .wm-stats .was { grid-column: 1 / -1; margin-top: -4px; }
  #weapon-tuning .wm-compare .cols { grid-template-columns: minmax(0, 1fr); }
  #weapon-tuning .wm-sheet { padding: 0 12px 40px; border-left: 0; }
}
`;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const famName = (def: WeaponDefinition) => (gunplayOf(def).family ?? '').replace(/_/g, ' ');
const catName = (c: string | undefined) => (c ? WEAPON_CATEGORY_LABELS[c as keyof typeof WEAPON_CATEGORY_LABELS] : 'No category');

/** A stat's value as the page shows it (its unit's scale, a list as its biggest step for the recoil rows). */
function shown(f: StatField, v: unknown): string {
  if (v === undefined || v === null) return '–';
  if (Array.isArray(v)) return `${(v as number[]).map((x) => fmt(x * (f.scale ?? 1), 1)).join(', ')}`;
  const n = (v as number) * (f.scale ?? 1);
  return fmt(n, f.int ? 0 : Math.abs(n) < 10 ? 2 : 1);
}

/** The short stats line under a weapon in the list. */
function statLine(def: WeaponDefinition): string {
  const f = firingOf(def, 0);
  const rpm = (60 * TICK_RATE) / Math.max(1, f.interval);
  const parts = [`${fmt(def.damage)}${def.pellets > 1 ? ` × ${def.pellets}` : ''} damage`, `${fmt(rpm)} rpm`];
  if (def.magazine > 0) parts.push(`${def.magazine} rounds`);
  const gp = gunplayOf(def);
  if (def.magazine > 0) parts.push(`${fmt((gp.reload.type === 'magazine' ? gp.reload.empty : gp.reload.start + gp.reload.each * def.magazine + gp.reload.end) / TICK_RATE, 1)} s reload`);
  parts.push(`${fmt(def.range)} m`);
  return parts.join(' · ');
}

export interface ManagerOptions {
  ballistics: () => Ballistics;
  hp: () => number;
  maxes: Record<keyof WeaponStats, number>;
}

export function openWeaponManager(host: HTMLElement, opts: ManagerOptions): void {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);
  const page = host.closest<HTMLElement>('#weapon-tuning') ?? document.body;

  let edits: Edits = loadEdits();
  const ui = { filter: 'all' as 'all' | 'edited' | 'hidden', search: '' };
  let audio: AudioSystem | null = null;
  let copied = 0;

  const save = () => saveEdits(edits);
  const edit = (id: string): WeaponEdit => edits[id] ?? {};
  /** Change one weapon's edit, tidy it (values back at the game's drop out), keep it, redraw. */
  function change(id: string, f: (e: WeaponEdit) => WeaponEdit, redraw = true): void {
    const def = CORE_WEAPONS[id]!;
    const next = tidy(def, f(structuredClone(edit(id))));
    if (next) edits[id] = next;
    else delete edits[id];
    save();
    if (redraw) renderList();
  }

  /** Play a sound of the game's library (the game's own audio, loaded on the first press). */
  async function play(id: string): Promise<void> {
    audio ??= new AudioSystem();
    audio.unlock();
    await audio.load();
    audio.play(id as SoundId);
  }

  host.innerHTML = `
    <div class="wm-bar">
      <input type="search" id="wm-search" placeholder="Find a weapon" aria-label="Find a weapon">
      <div class="wm-filter" role="group" aria-label="Show">
        <button type="button" class="wm-btn" data-filter="all">All</button>
        <button type="button" class="wm-btn" data-filter="edited">Edited</button>
        <button type="button" class="wm-btn" data-filter="hidden">Hidden</button>
      </div>
      <span class="wm-spacer"></span>
      <button type="button" class="wm-btn" id="wm-reset-all">Reset everything</button>
      <button type="button" class="wm-btn wm-primary" id="wm-send">Send changes</button>
    </div>
    <p class="note">Your edits stay in this browser until you send them. Nothing changes in the game until a session applies the file in the repo and lands it.</p>
    <div class="wm-list" id="wm-list"></div>`;
  const list = host.querySelector<HTMLElement>('#wm-list')!;

  function renderList(): void {
    const n = Object.keys(edits).length;
    const send = host.querySelector<HTMLButtonElement>('#wm-send')!;
    send.textContent = n ? `Send changes (${n})` : 'Send changes';
    send.disabled = !n;
    host.querySelector<HTMLButtonElement>('#wm-reset-all')!.disabled = !n;
    for (const b of host.querySelectorAll<HTMLButtonElement>('[data-filter]')) {
      b.setAttribute('aria-pressed', String(b.dataset.filter === ui.filter));
      const count = b.dataset.filter === 'edited' ? n : b.dataset.filter === 'hidden' ? weaponList().filter((d) => editedDef(d, edits[d.id]).hidden).length : 0;
      b.textContent = `${b.dataset.filter === 'all' ? 'All' : b.dataset.filter === 'edited' ? 'Edited' : 'Hidden'}${count ? ` (${count})` : ''}`;
    }
    const q = ui.search.trim().toLowerCase();
    list.innerHTML = '';
    for (const base of weaponList()) {
      const e = edits[base.id];
      const def = editedDef(base, e);
      if (ui.filter === 'edited' && !e) continue;
      if (ui.filter === 'hidden' && !def.hidden) continue;
      if (q && !`${def.displayName} ${base.displayName} ${base.id} ${def.category ?? ''} ${famName(base)}`.toLowerCase().includes(q)) continue;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `wm-card${def.hidden ? ' is-hidden' : ''}`;
      card.dataset.id = base.id;
      const desc = e?.description ?? descriptionOf(base.id);
      const sets = setsOf(base, e).filter((m) => m.member && m.editable !== false && !m.note);
      card.innerHTML = `
        <div class="wm-pic"></div>
        <div><h3>${esc(def.displayName)}${e ? '<span class="wm-badge edited">Edited</span>' : ''}${def.hidden ? '<span class="wm-badge hidden">Hidden</span>' : ''}</h3>
          <div class="wm-sub">${esc(catName(def.category))}${famName(base) ? ` · ${esc(famName(base))}` : ''} · ${base.slot ? `slot ${base.slot}` : 'mounted'}${def.displayName !== base.displayName ? ` · was ${esc(base.displayName)}` : ''}</div></div>
        <div class="wm-body">
          <p class="wm-desc${desc ? '' : ' muted'}">${esc(desc || designNoteOf(base.id) || 'No description yet.')}</p>
          <div class="wm-line">${esc(statLine(def))}</div>
          <div class="wm-line">Sounds: ${soundSlots(def).map((s) => esc(currentSound(def, s) ?? '')).join(', ')}</div>
          <div>${sets.map((m) => `<span class="wm-chip">${esc(m.name)}</span>`).join('') || '<span class="wm-line">In no weapon set list</span>'}${e?.note ? '<span class="wm-chip">Note</span>' : ''}</div>
        </div>`;
      const icon = weaponIcon(base.id, '');
      const pic = card.querySelector<HTMLElement>('.wm-pic')!;
      if (icon) pic.append(icon);
      else pic.textContent = 'no picture';
      card.addEventListener('click', () => openEditor(base.id));
      list.append(card);
    }
    if (!list.childElementCount) list.innerHTML = '<p class="note">No weapon matches.</p>';
  }

  host.querySelector('#wm-search')!.addEventListener('input', (ev) => {
    ui.search = (ev.target as HTMLInputElement).value;
    renderList();
  });
  host.querySelector('.wm-filter')!.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-filter]');
    if (!b) return;
    ui.filter = b.dataset.filter as typeof ui.filter;
    renderList();
  });
  host.querySelector('#wm-reset-all')!.addEventListener('click', () => {
    if (!confirm('Reset every weapon to how it is in the game? Your edits and notes on this page are cleared.')) return;
    edits = {};
    save();
    renderList();
  });
  host.querySelector('#wm-send')!.addEventListener('click', openSend);

  // ---------------------------------------------------------------- overlays

  function overlay(kind: 'sheet' | 'dialog', id: string, label: string, onClose?: () => void): { root: HTMLElement; box: HTMLElement; close: () => void } {
    const root = document.createElement('div');
    root.className = 'wm-overlay';
    root.id = id;
    const box = document.createElement('div');
    box.className = kind === 'sheet' ? 'wm-sheet' : 'wm-dialog';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', label);
    root.append(box);
    page.append(root);
    const close = () => {
      root.remove();
      document.removeEventListener('keydown', onKey);
      onClose?.();
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape' && page.lastElementChild === root) close();
    };
    document.addEventListener('keydown', onKey);
    root.addEventListener('click', (ev) => ev.target === root && close());
    return { root, box, close };
  }

  // ---------------------------------------------------------------- one weapon's edit panel

  function openEditor(id: string): void {
    const base = CORE_WEAPONS[id]!;
    const { box, close } = overlay('sheet', 'wm-editor', `Edit ${base.displayName}`, () => renderList());
    const info = infoOf(base);
    const fields = applicableStats(info).filter((f) => !f.list);
    const hasKick = applicableStats(info).some((f) => f.path === 'kick.pitch');
    let compareTimer = 0;

    function draw(): void {
      const e = edit(id);
      const def = editedDef(base, e);
      const blockers = hideBlockers(id);
      const scale = kickScale(e);
      box.innerHTML = `
        <div class="wm-head"><div class="wm-pic"></div><h2>${esc(def.displayName)}${def.hidden ? ' <span class="wm-badge hidden">Hidden</span>' : ''}</h2>
          <button type="button" class="wm-btn" id="wm-reset-one"${edits[id] ? '' : ' disabled'}>Reset this weapon</button>
          <button type="button" class="wm-btn wm-primary" id="wm-done">Done</button></div>
        <section><h2>Name and role</h2>
          <label class="wm-field"><span>Name</span><input type="text" id="wm-name" maxlength="${TEXT_LIMITS.name}" value="${esc(def.displayName)}"></label>
          ${def.displayName !== base.displayName ? `<p class="note">In the game: ${esc(base.displayName)}</p>` : ''}
          <label class="wm-field"><span>Category</span>${
            base.category
              ? `<select id="wm-category">${WEAPON_CATEGORIES.map((c) => `<option value="${c}"${c === def.category ? ' selected' : ''}>${esc(catName(c))}</option>`).join('')}</select>`
              : '<em class="note">None: a tool, mode-only weapon or mounted gun (never in random pickups)</em>'
          }</label>
          ${base.category && def.category !== base.category ? `<p class="note">In the game: ${esc(catName(base.category))}. A random pickup of a category rolls the weapons of it.</p>` : ''}
          <div class="wm-field"><span>Family</span><span>${esc(famName(base) || 'none')} <small class="note">(its handling defaults; not edited here)</small></span></div>
          <label class="wm-field"><span>Description</span><textarea id="wm-desc" maxlength="${TEXT_LIMITS.description}" placeholder="${esc(designNoteOf(id) || 'One or two lines for the team')}">${esc(e.description ?? descriptionOf(id))}</textarea></label>
        </section>
        <section><h2>Visibility</h2>
          <p class="note">${def.hidden ? 'Hidden: random pickups, weapon sets, class loadouts, Roulette and MapMaker\'s palette leave it out. Maps that place it still spawn it there, and MapMaker marks it Hidden.' : 'In the game: random pickups, its weapon sets and MapMaker\'s palette offer it.'}</p>
          ${
            def.hidden
              ? '<button type="button" class="wm-btn" id="wm-hide">Unhide</button>'
              : `<button type="button" class="wm-btn" id="wm-hide"${blockers.length ? ' disabled' : ''}>Hide</button>${blockers.length ? `<p class="wm-warn">Can't be hidden: ${esc(blockers.join('; '))}.</p>` : ''}`
          }
        </section>
        <section><h2>Sounds</h2><p class="note">From the game's own sound library (content/sounds.json); press ▶ to hear one.</p>
          ${soundSlots(base)
            .map((slot) => {
              const now = currentSound(def, slot)!;
              const was = currentSound(base, slot)!;
              return `<div class="wm-row"><strong style="width:90px">${slot === 'fire' ? 'Fire' : slot === 'alt' ? 'Alt-fire' : 'Reload'}</strong><button type="button" class="wm-play" data-play="${esc(now)}" aria-label="Play ${esc(now)}">▶</button><span class="grow">${esc(now)}${now !== was ? ` <span class="was changed">(in the game: ${esc(was)})</span>` : ''}</span><button type="button" class="wm-btn wm-small" data-pick="${slot}">Change…</button>${now !== was ? `<button type="button" class="wm-x" data-unsound="${slot}" title="Back to the game's" aria-label="Back to the game's sound">↺</button>` : ''}</div>`;
            })
            .join('')}
        </section>
        <section class="wm-sets"><h2>Weapon sets</h2>
          ${setsOf(base, e)
            .map((m) => `<label><input type="checkbox" data-set="${m.id}"${m.member ? ' checked' : ''}${m.editable ? '' : ' disabled'}> ${esc(m.name)} ${m.locked ? `<small>(${esc(m.locked)}: stays)</small>` : m.note ? `<small>(${esc(m.note)})</small>` : !m.editable ? '<small>(can\'t join: no pickup or category)</small>' : ''}</label>`)
            .join('')}
          ${def.hidden ? '<p class="note">While hidden it plays in no set, whatever is ticked; unhide it and these apply.</p>' : ''}
        </section>
        <section><h2>Stats</h2><p class="note">Kept within each value's range; the game's value is beside each one you change. 60 ticks = 1 second.</p>
          <div class="wm-stats">
            ${fields
              .map((f) => {
                const was = currentStat(base, f.path);
                const now = e.stats?.[f.path] ?? was;
                const changed = e.stats?.[f.path] !== undefined;
                const step = f.int ? 1 : f.scale === 1000 ? 0.1 : (f.max - f.min) * (f.scale ?? 1) > 50 ? 1 : 0.01;
                return `<span class="k">${esc(f.label)}</span><input type="number" data-stat="${f.path}" aria-label="${esc(f.label)}" min="${+(f.min * (f.scale ?? 1)).toFixed(4)}" max="${+(f.max * (f.scale ?? 1)).toFixed(4)}" step="${step}" value="${now === undefined ? '' : +((now as number) * (f.scale ?? 1)).toFixed(4)}"><span class="u">${esc(f.unit)}</span><span class="was${changed ? ' changed' : ''}">${changed ? `in the game: ${shown(f, was)}` : `range ${shown(f, f.min)}–${shown(f, f.max)}`}</span>${changed ? `<button type="button" class="wm-x" data-unstat="${f.path}" title="Back to the game's" aria-label="Back to the game's ${esc(f.label)}">↺</button>` : '<span></span>'}`;
              })
              .join('')}
            ${
              hasKick
                ? `<span class="k">Recoil (kick ×)</span><input type="number" data-kick aria-label="Recoil multiplier" min="0.25" max="${maxKickScale().toFixed(2)}" step="0.05" value="${scale.toFixed(2)}"><span class="u">×</span><span class="was${scale !== 1 ? ' changed' : ''}">${scale !== 1 ? `in the game: ×1.00 (first round up ${fmt((currentStat(base, 'kick.pitch') as number[])[0]! * 1000, 1)} mrad)` : 'scales every round\'s kick, up and sideways'}</span>${scale !== 1 ? '<button type="button" class="wm-x" data-unkick title="Back to the game\'s" aria-label="Back to the game\'s recoil">↺</button>' : '<span></span>'}`
                : ''
            }
          </div>
          <p class="wm-warn" id="wm-clamped" hidden></p>
        </section>
        <section class="wm-compare" id="wm-compare"></section>
        <section><h2>Note for the team</h2><p class="note">Anything to suggest: "make this louder", "needs a scope". It goes on the team's list with the change file.</p>
          <textarea id="wm-note" maxlength="${TEXT_LIMITS.note}" placeholder="A note or suggestion">${esc(e.note ?? '')}</textarea>
        </section>`;
      const icon = weaponIcon(id, '');
      const pic = box.querySelector<HTMLElement>('.wm-head .wm-pic')!;
      if (icon) pic.append(icon);
      else pic.textContent = 'no picture';
      drawCompare();
    }

    /** The edited weapon beside the game's: stat bars, recoil path, spread cones, damage and time to kill. */
    function drawCompare(): void {
      const host = box.querySelector<HTMLElement>('#wm-compare');
      if (!host) return;
      const e = edits[id];
      const def = editedDef(base, e);
      const ps: Pick[] = [{ def: base, mode: 0, color: SERIES[0], label: `${base.displayName} (in the game)` }];
      if (e && def !== base) ps.push({ def, mode: 0, color: SERIES[1], label: `${def.displayName} (your edit)` });
      const ctx: CompareCtx = { ballistics: opts.ballistics(), hp: opts.hp(), maxes: opts.maxes };
      host.innerHTML = `<h2>Live comparison</h2><p class="note">${ps.length > 1 ? 'The game\'s weapon and your edit, as a match runs them.' : 'Change a stat to see your edit beside the game\'s weapon.'}</p>`;
      host.style.setProperty('--n', String(ps.length));
      host.append(barsSection(ps, ctx), recoilSection(ps), conesSection(ps), lineSection(ps, 'damage', ctx), lineSection(ps, 'ttk', ctx));
      drawCharts(host);
    }

    function kickScale(e: WeaponEdit): number {
      const now = e.stats?.['kick.pitch'] as number[] | undefined;
      const was = currentStat(base, 'kick.pitch') as number[] | undefined;
      if (!now || !was?.length) return 1;
      const sum = (a: number[]) => a.reduce((s, x) => s + Math.abs(x), 0);
      return sum(was) > 0 ? Math.round((sum(now) / sum(was)) * 100) / 100 : 1;
    }
    /** The biggest multiplier that keeps every round's kick within range. */
    function maxKickScale(): number {
      const pitch = (currentStat(base, 'kick.pitch') as number[] | undefined) ?? [];
      const yaw = (currentStat(base, 'kick.yaw') as number[] | undefined) ?? [];
      const big = Math.max(1e-9, ...pitch.map(Math.abs), ...yaw.map(Math.abs));
      return Math.max(1, Math.min(3, Math.floor((statField('kick.pitch')!.max / big) * 100) / 100));
    }

    /** One stat typed in: in the field's unit, kept in range, whole where it must be. */
    function setStat(path: string, raw: string): void {
      const f = statField(path)!;
      const typed = Number(raw);
      if (raw.trim() === '' || !Number.isFinite(typed)) return;
      let v = typed / (f.scale ?? 1);
      const clamped = Math.min(f.max, Math.max(f.min, v));
      const note = box.querySelector<HTMLElement>('#wm-clamped')!;
      note.hidden = clamped === v;
      if (clamped !== v) note.textContent = `${f.label} kept within ${shown(f, f.min)}–${shown(f, f.max)} ${f.unit}.`;
      v = f.int ? Math.round(clamped) : +clamped.toPrecision(6);
      change(id, (e) => ({ ...e, stats: { ...e.stats, [path]: v } }), false);
    }

    box.addEventListener('input', (ev) => {
      const t = ev.target as HTMLInputElement;
      if (t.id === 'wm-name') change(id, (e) => ({ ...e, name: t.value }), false);
      else if (t.id === 'wm-desc') change(id, (e) => ({ ...e, description: t.value }), false);
      else if (t.id === 'wm-note') change(id, (e) => ({ ...e, note: t.value }), false);
      else return;
      box.querySelector<HTMLButtonElement>('#wm-reset-one')!.disabled = !edits[id];
    });
    box.addEventListener('change', (ev) => {
      const t = ev.target as HTMLInputElement;
      if (t.id === 'wm-category') change(id, (e) => ({ ...e, category: t.value }), false);
      else if (t.dataset.set) change(id, (e) => ({ ...e, sets: { ...e.sets, [t.dataset.set!]: t.checked } }), false);
      else if (t.dataset.stat) setStat(t.dataset.stat, t.value);
      else if (t.dataset.kick !== undefined) {
        const s = Math.min(maxKickScale(), Math.max(0.25, Number(t.value) || 1));
        const round = (a: number[]) => a.map((x) => +(x * s).toPrecision(5));
        change(id, (e) => ({ ...e, stats: { ...e.stats, 'kick.pitch': round(currentStat(base, 'kick.pitch') as number[]), 'kick.yaw': round((currentStat(base, 'kick.yaw') as number[] | undefined) ?? [0]) } }), false);
      } else return;
      clearTimeout(compareTimer);
      compareTimer = window.setTimeout(() => {
        const y = box.scrollTop;
        const focus = (document.activeElement as HTMLElement | null)?.dataset;
        const key = focus?.stat ? `[data-stat="${focus.stat}"]` : null;
        draw();
        box.scrollTop = y;
        if (key) box.querySelector<HTMLElement>(key)?.focus();
      }, 60);
    });
    box.addEventListener('click', (ev) => {
      const t = (ev.target as HTMLElement).closest<HTMLElement>('button');
      if (!t) return;
      if (t.id === 'wm-done') return close();
      if (t.id === 'wm-reset-one') {
        delete edits[id];
        save();
        return draw();
      }
      if (t.id === 'wm-hide') {
        const def = editedDef(base, edits[id]);
        change(id, (e) => ({ ...e, hidden: !def.hidden }), false);
        return draw();
      }
      if (t.dataset.play) return void play(t.dataset.play);
      if (t.dataset.pick) return pickSound(base, t.dataset.pick as SoundSlot, (sid) => {
        change(id, (e) => ({ ...e, sounds: { ...e.sounds, [t.dataset.pick!]: sid } }), false);
        draw();
      });
      const unset = (k: 'stats' | 'sounds', key: string) => change(id, (e) => {
        const part = { ...(e[k] as Record<string, unknown> | undefined) };
        delete part[key];
        if (k === 'stats' && key === 'kick.pitch') delete part['kick.yaw'];
        return { ...e, [k]: part };
      }, false);
      if (t.dataset.unstat) unset('stats', t.dataset.unstat);
      else if (t.dataset.unsound) unset('sounds', t.dataset.unsound);
      else if (t.dataset.unkick !== undefined) unset('stats', 'kick.pitch');
      else return;
      draw();
    });
    draw();
  }

  // ---------------------------------------------------------------- the sound picker

  function pickSound(def: WeaponDefinition, slot: SoundSlot, use: (id: string) => void): void {
    const { box, close } = overlay('dialog', 'wm-picker', 'Pick a sound');
    const current = currentSound(editedDef(def, edits[def.id]), slot);
    box.innerHTML = `
      <div class="wm-head"><h2>${slot === 'fire' ? 'Fire' : slot === 'alt' ? 'Alt-fire' : 'Reload'} sound for ${esc(editedDef(def, edits[def.id]).displayName)}</h2><button type="button" class="wm-btn" id="wm-picker-close">Close</button></div>
      <p class="note">Only sounds already in the game (content/sounds.json, recorded in content/provenance.json). No uploads.</p>
      <input type="search" id="wm-picker-search" placeholder="Find a sound" aria-label="Find a sound" style="width:100%">
      <div id="wm-picker-list"></div>`;
    const listEl = box.querySelector<HTMLElement>('#wm-picker-list')!;
    const fill = (q: string) => {
      listEl.innerHTML = soundGroups()
        .map((g) => {
          const ids = g.ids.filter((sid) => !q || sid.includes(q.toLowerCase()));
          if (!ids.length) return '';
          return `<section><h2>${esc(g.label)}</h2>${ids
            .map((sid) => `<div class="wm-row" data-sound="${esc(sid)}"><button type="button" class="wm-play" data-play="${esc(sid)}" aria-label="Play ${esc(sid)}">▶</button><span class="grow">${esc(sid)}${sid === current ? ' <span class="wm-ok">(now)</span>' : ''}</span><button type="button" class="wm-btn wm-small" data-use="${esc(sid)}"${sid === current ? ' disabled' : ''}>Use</button></div>`)
            .join('')}</section>`;
        })
        .join('');
    };
    fill('');
    box.querySelector('#wm-picker-search')!.addEventListener('input', (ev) => fill((ev.target as HTMLInputElement).value.trim()));
    box.addEventListener('click', (ev) => {
      const t = (ev.target as HTMLElement).closest<HTMLElement>('button');
      if (!t) return;
      if (t.id === 'wm-picker-close') close();
      else if (t.dataset.play) void play(t.dataset.play);
      else if (t.dataset.use) {
        close();
        use(t.dataset.use);
      }
    });
  }

  // ---------------------------------------------------------------- send

  function openSend(): void {
    const { set, problems } = changeSet(edits);
    const json = `${JSON.stringify(set, null, 2)}\n`;
    const n = Object.keys(set.weapons).length;
    const { box, close } = overlay('dialog', 'wm-send-dialog', 'Send changes');
    const lines = Object.entries(set.weapons).map(([id, e]) => {
      const parts: string[] = [];
      if (e.name !== undefined) parts.push(`renamed "${e.name.trim()}"`);
      if (e.hidden !== undefined) parts.push(e.hidden ? 'hidden' : 'shown again');
      if (e.category !== undefined) parts.push(`category ${e.category}`);
      if (e.description !== undefined) parts.push('description');
      if (e.sounds) parts.push(`sounds (${Object.keys(e.sounds).join(', ')})`);
      if (e.sets) parts.push(`sets (${Object.entries(e.sets).map(([s, v]) => `${v ? '+' : '−'}${s}`).join(', ')})`);
      if (e.stats) parts.push(`${Object.keys(e.stats).length} stat${Object.keys(e.stats).length === 1 ? '' : 's'}`);
      if (e.note) parts.push('a note');
      return `<li><strong>${esc(CORE_WEAPONS[id]!.displayName)}</strong>: ${esc(parts.join(', '))}</li>`;
    });
    box.innerHTML = `
      <div class="wm-head"><h2>Send changes</h2><button type="button" class="wm-btn" id="wm-send-close">Close</button></div>
      <section><p>${n} weapon${n === 1 ? '' : 's'} changed:</p><ul class="wm-steps">${lines.join('')}</ul></section>
      ${problems.length ? `<section><p class="wm-bad">Fix these first (the repo would refuse the file):</p><ul class="wm-steps">${problems.map((p) => `<li class="wm-bad">${esc(p)}</li>`).join('')}</ul></section>` : ''}
      <section><h2>How it reaches the game</h2><ol class="wm-steps">
        <li>Download the file (put it in your Google Drive) or Copy it (paste it to a session in chat).</li>
        <li>The session runs <code>node tools/content/apply-weapon-edits.mjs &lt;file&gt;</code>: it checks the file, writes it into the weapon data and puts your notes on the team's list.</li>
        <li>The session checks and lands it like any change. Until then the game is unchanged; your edits stay here.</li></ol></section>
      <section><div class="wm-bar"><button type="button" class="wm-btn wm-primary" id="wm-download"${problems.length ? ' disabled' : ''}>Download</button><button type="button" class="wm-btn" id="wm-copy"${problems.length ? ' disabled' : ''}>Copy</button><span class="wm-ok" id="wm-copied" role="status"></span></div>
        <textarea class="wm-json" id="wm-json" readonly spellcheck="false" aria-label="The change set">${esc(json)}</textarea></section>`;
    const status = box.querySelector<HTMLElement>('#wm-copied')!;
    box.addEventListener('click', async (ev) => {
      const t = (ev.target as HTMLElement).closest<HTMLElement>('button');
      if (!t) return;
      if (t.id === 'wm-send-close') close();
      else if (t.id === 'wm-download') {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
        a.download = `weapon-edits-${set.created.slice(0, 16).replace(/[:T]/g, '-')}.json`;
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        status.textContent = 'Downloaded.';
      } else if (t.id === 'wm-copy') {
        let ok = false;
        try {
          await navigator.clipboard.writeText(json);
          ok = true;
        } catch {
          const ta = box.querySelector<HTMLTextAreaElement>('#wm-json')!;
          ta.select();
          ok = document.execCommand('copy');
        }
        copied++;
        status.textContent = ok ? 'Copied: paste it to a session.' : 'Select the text below and copy it.';
      }
    });
  }

  (window as unknown as { __weaponManager: unknown }).__weaponManager = {
    edits: () => structuredClone(edits),
    changeSet: () => changeSet(edits, 'test').set,
    played: () => audio?.stats.played ?? 0,
    copied: () => copied,
  };
  renderList();
}
