import { CORE_WEAPONS, fireModeCount, firingOf, getWeapon, type Ballistics, type WeaponDefinition } from '@tiletrigger/shared';
import { SERIES, arsenalMax, barsSection, conesSection, drawCharts, dropSection, lineSection, recoilSection, type CompareCtx, type Pick } from './weaponCompare.ts';

/**
 * Weapon tuning (team tool, `?mode=weapons`; docs/GUNPLAY_SPEC.md §45 "Weapon Tuning UI / Debug Tools"): up to three
 * weapons side by side: their stat bars (on one scale across the whole arsenal, so extremes show at once), the recoil
 * path over a magazine, the spread cones at 25 m, damage and time to kill over distance, and the scope holdover angles
 * (tools/weaponCompare.ts). Every number is the sim's own (tools/weaponTuningData.ts). An internal tool, as the spec
 * asks, not an Options screen: players feel weapons in the Training Range (spec §44); this is where they are compared
 * and tuned. Deep links: `?mode=weapons&w=core.smg,core.revolver&ballistics=advanced&hp=100`.
 * `window.__weaponTuning` drives it in tests.
 *
 * Its Manage tab (`&view=manage`) is the owner's Weapon Manager (tools/weaponManager.ts, loaded only when opened):
 * rename, hide, sounds, sets, stats and notes, sent as a change file the repo applies (docs/FEATURES.md).
 */

const MAX = 3;

const CSS = `
:root { --wt-bg: #111417; --wt-surface: #1a1e22; --wt-line: #2b3137; --wt-grid: #262b30; --wt-ink: #e8ecef; --wt-ink2: #aab3bb; --wt-muted: #78828b; }
#weapon-tuning { position: relative; min-height: 100vh; background: var(--wt-bg); color: var(--wt-ink); font: 14px/1.4 Barlow, system-ui, sans-serif; z-index: 50; }
#weapon-tuning * { box-sizing: border-box; }
#weapon-tuning header { position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; padding: 12px 16px; background: rgba(17, 20, 23, 0.96); border-bottom: 1px solid var(--wt-line); }
#weapon-tuning h1 { margin: 0 8px 0 0; font: italic 700 20px 'Chakra Petch', sans-serif; letter-spacing: 0.02em; }
#weapon-tuning label { display: inline-flex; align-items: center; gap: 6px; color: var(--wt-ink2); font-size: 13px; }
#weapon-tuning select, #weapon-tuning input { background: var(--wt-surface); color: var(--wt-ink); border: 1px solid var(--wt-line); border-radius: 6px; padding: 5px 8px; font: inherit; }
#weapon-tuning input[type=number] { width: 70px; }
#weapon-tuning .sw { display: inline-block; width: 10px; height: 10px; border-radius: 3px; }
#weapon-tuning main { padding: 12px 16px 40px; max-width: 1280px; margin: 0 auto; }
#weapon-tuning section { margin: 14px 0 22px; }
#weapon-tuning h2 { margin: 0 0 4px; font: 600 15px 'Chakra Petch', sans-serif; letter-spacing: 0.04em; text-transform: uppercase; color: var(--wt-ink); }
#weapon-tuning .note { margin: 0 0 10px; color: var(--wt-muted); font-size: 12.5px; }
#weapon-tuning .cols { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 12px; }
#weapon-tuning .card { background: var(--wt-surface); border: 1px solid var(--wt-line); border-radius: 10px; padding: 10px 12px; min-width: 0; }
#weapon-tuning .card h3 { margin: 0 0 6px; display: flex; align-items: center; gap: 8px; font: 600 14px Barlow, sans-serif; }
#weapon-tuning .card h3 small { color: var(--wt-muted); font-weight: 500; }
#weapon-tuning canvas { display: block; width: 100%; }
#weapon-tuning .bars { display: grid; grid-template-columns: 112px 1fr; gap: 6px 12px; align-items: center; }
#weapon-tuning .bars .k { color: var(--wt-ink2); font-size: 13px; }
#weapon-tuning .bars .v { display: grid; gap: 3px; }
#weapon-tuning .wt-bar { display: grid; grid-template-columns: 1fr 92px; gap: 8px; align-items: center; }
#weapon-tuning .wt-bar i { display: block; height: 8px; border-radius: 0 4px 4px 0; min-width: 2px; }
#weapon-tuning .wt-bar span { color: var(--wt-ink2); font-size: 12px; font-variant-numeric: tabular-nums; white-space: nowrap; }
#weapon-tuning table { border-collapse: collapse; width: 100%; font-size: 13px; font-variant-numeric: tabular-nums; }
#weapon-tuning th, #weapon-tuning td { padding: 5px 8px; text-align: right; border-bottom: 1px solid var(--wt-grid); }
#weapon-tuning th:first-child, #weapon-tuning td:first-child { text-align: left; }
#weapon-tuning th { color: var(--wt-ink2); font-weight: 600; }
#weapon-tuning .legend { display: flex; flex-wrap: wrap; gap: 4px 14px; margin: 0 0 6px; color: var(--wt-ink2); font-size: 12.5px; }
#weapon-tuning .legend span { display: inline-flex; align-items: center; gap: 6px; }
#weapon-tuning .chart { position: relative; }
#weapon-tuning .tip { position: absolute; pointer-events: none; background: #0b0d0f; border: 1px solid var(--wt-line); border-radius: 6px; padding: 6px 8px; font-size: 12px; color: var(--wt-ink); white-space: nowrap; transform: translate(12px, -50%); }
#weapon-tuning .tip[hidden] { display: none; }
#weapon-tuning [hidden] { display: none !important; }
#weapon-tuning .wt-ctl { display: contents; }
#weapon-tuning .wt-tabs { display: inline-flex; border: 1px solid var(--wt-line); border-radius: 8px; overflow: hidden; }
#weapon-tuning .wt-tabs button { background: transparent; color: var(--wt-ink2); border: 0; padding: 6px 14px; font: 600 13px Barlow, sans-serif; cursor: pointer; }
#weapon-tuning .wt-tabs button[aria-selected=true] { background: #2a3540; color: var(--wt-ink); }
@media (max-width: 720px) { #weapon-tuning .cols { grid-template-columns: minmax(0, 1fr); } #weapon-tuning .bars { grid-template-columns: 92px 1fr; } }
`;

export function openWeaponTuning(): void {
  document.title = 'Weapon tuning · Tile Trigger';
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);
  const root = document.createElement('div');
  root.id = 'weapon-tuning';
  document.body.append(root);
  // The page scrolls (the game's own pages never do).
  for (const el of [document.documentElement, document.body]) {
    el.style.overflow = 'auto';
    el.style.height = 'auto';
    el.style.background = '#111417';
  }
  for (const id of ['view', 'hud']) document.getElementById(id)?.style.setProperty('display', 'none');

  const params = new URLSearchParams(location.search);
  const carried = Object.values(CORE_WEAPONS)
    .filter((d) => d.slot > 0 && d.kind !== 'melee')
    .sort((a, b) => a.slot - b.slot || a.displayName.localeCompare(b.displayName));
  const wanted = (params.get('w') ?? 'core.smg,core.revolver,core.rifle').split(',').filter((id) => carried.some((d) => d.id === id));
  const state = {
    ids: (wanted.length ? wanted : ['core.smg']).slice(0, MAX) as (string | '')[],
    modes: [0, 0, 0],
    ballistics: (['arcade', 'standard', 'advanced'].includes(params.get('ballistics') ?? '') ? params.get('ballistics') : 'standard') as Ballistics,
    hp: Math.max(1, Math.min(1000, Number(params.get('hp')) || 100)),
  };
  while (state.ids.length < MAX) state.ids.push('');
  const maxes = arsenalMax();

  const header = document.createElement('header');
  const main = document.createElement('main');
  // The Weapon Manager's view (Manage): loaded the first time it opens.
  const manage = document.createElement('div');
  manage.id = 'wm-root';
  manage.hidden = true;
  root.append(header, main, manage);

  const option = (d: WeaponDefinition) => `<option value="${d.id}">${d.displayName}</option>`;
  header.innerHTML =
    `<h1>Weapons</h1><nav class="wt-tabs" role="tablist"><button type="button" role="tab" data-view="compare">Compare</button><button type="button" role="tab" data-view="manage" id="wt-tab-manage">Manage</button></nav><span class="wt-ctl">` +
    state.ids
      .map((_, i) => `<label><i class="sw" style="background:${SERIES[i]}"></i><select data-w="${i}" aria-label="Weapon ${i + 1}">${i ? '<option value="">(none)</option>' : ''}${carried.map(option).join('')}</select><select data-m="${i}" aria-label="Fire mode ${i + 1}" hidden></select></label>`)
      .join('') +
    `<label>Ballistics <select data-b><option value="arcade">Arcade</option><option value="standard">Standard</option><option value="advanced">Advanced</option></select></label>` +
    `<label>Health <input data-hp type="number" min="1" max="1000" step="10"></label></span>`;
  const sel = (q: string) => header.querySelector<HTMLSelectElement>(q)!;
  state.ids.forEach((id, i) => (sel(`[data-w="${i}"]`).value = id));
  sel('[data-b]').value = state.ballistics;
  header.querySelector<HTMLInputElement>('[data-hp]')!.value = String(state.hp);
  header.addEventListener('change', (e) => {
    const t = e.target as HTMLSelectElement;
    if (t.dataset.w !== undefined) {
      state.ids[Number(t.dataset.w)] = t.value;
      state.modes[Number(t.dataset.w)] = 0;
    } else if (t.dataset.m !== undefined) state.modes[Number(t.dataset.m)] = Number(t.value);
    else if (t.dataset.b !== undefined) state.ballistics = t.value as Ballistics;
    else if (t.dataset.hp !== undefined) state.hp = Math.max(1, Math.min(1000, Number(t.value) || 100));
    const q = new URLSearchParams(location.search);
    q.set('w', state.ids.filter(Boolean).join(','));
    q.set('ballistics', state.ballistics);
    q.set('hp', String(state.hp));
    history.replaceState(null, '', `?${q}`);
    render();
  });

  const picks = (): Pick[] =>
    state.ids.flatMap((id, i) => (id ? [{ def: getWeapon(id), mode: Math.min(state.modes[i]!, fireModeCount(getWeapon(id)) - 1), color: SERIES[i]! }] : []));

  function render(): void {
    const ps = picks();
    // Fire mode selects for weapons that switch.
    state.ids.forEach((id, i) => {
      const m = sel(`[data-m="${i}"]`);
      const def = id ? getWeapon(id) : null;
      const n = def ? fireModeCount(def) : 1;
      m.hidden = n < 2;
      if (def && n > 1) {
        m.innerHTML = Array.from({ length: n }, (_, k) => `<option value="${k}">${firingOf(def, k).label}</option>`).join('');
        m.value = String(state.modes[i]);
      }
    });
    main.style.setProperty('--n', String(ps.length));
    main.innerHTML = '';
    const ctx: CompareCtx = { ballistics: state.ballistics, hp: state.hp, maxes };
    main.append(barsSection(ps, ctx), recoilSection(ps), conesSection(ps), lineSection(ps, 'damage', ctx), lineSection(ps, 'ttk', ctx), dropSection(ps, ctx));
    drawCharts(main);
  }

  // Compare and Manage (`&view=manage`): one page, two views; the manager's code loads only when it is opened.
  let managerOpen: Promise<void> | null = null;
  function showView(view: 'compare' | 'manage'): void {
    for (const b of header.querySelectorAll<HTMLButtonElement>('[data-view]')) b.setAttribute('aria-selected', String(b.dataset.view === view));
    header.querySelector<HTMLElement>('.wt-ctl')!.hidden = view !== 'compare';
    main.hidden = view !== 'compare';
    manage.hidden = view !== 'manage';
    document.title = view === 'manage' ? 'Weapon Manager · Tile Trigger' : 'Weapon tuning · Tile Trigger';
    const q = new URLSearchParams(location.search);
    if (view === 'manage') q.set('view', 'manage');
    else q.delete('view');
    history.replaceState(null, '', `?${q}`);
    if (view === 'manage') managerOpen ??= import('./weaponManager.ts').then((m) => m.openWeaponManager(manage, { ballistics: () => state.ballistics, hp: () => state.hp, maxes }));
    else render();
  }
  header.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-view]');
    if (b) showView(b.dataset.view === 'manage' ? 'manage' : 'compare');
  });

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(render, 120);
  });
  (window as unknown as { __weaponTuning: unknown }).__weaponTuning = {
    set(ids: string[], o: { ballistics?: Ballistics; hp?: number } = {}) {
      state.ids = [...ids.slice(0, MAX), '', '', ''].slice(0, MAX);
      state.modes = [0, 0, 0];
      if (o.ballistics) state.ballistics = o.ballistics;
      if (o.hp) state.hp = o.hp;
      state.ids.forEach((id, i) => (sel(`[data-w="${i}"]`).value = id));
      sel('[data-b]').value = state.ballistics;
      render();
    },
    picks: () => picks().map((p) => p.def.id),
    view: showView,
  };
  showView(params.get('view') === 'manage' ? 'manage' : 'compare');
}
