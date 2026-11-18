import { CORE_WEAPONS, fireModeCount, firingOf, getWeapon, gunplayOf, type Ballistics, type WeaponDefinition } from '@tiletrigger/shared';
import { damageAt, dropAt, recoilPath, spreadCones, ttkAt, weaponStats, type WeaponStats } from './weaponTuningData.ts';

/**
 * Weapon tuning (team tool, `?mode=weapons`; docs/GUNPLAY_SPEC.md §45 "Weapon Tuning UI / Debug Tools"): up to three
 * weapons side by side: their stat bars (on one scale across the whole arsenal, so extremes show at once), the recoil
 * path over a magazine, the spread cones at 25 m, damage and time to kill over distance, and the scope holdover angles.
 * Every number is the sim's own (tools/weaponTuningData.ts). An internal tool, as the spec asks, not an Options screen:
 * players feel weapons in the Training Range (spec §44); this is where they are compared and tuned. Deep links:
 * `?mode=weapons&w=core.smg,core.revolver&ballistics=advanced&hp=100`. `window.__weaponTuning` drives it in tests.
 */

/** Series colours: the first three slots of the dark categorical palette (validated all-pairs; three weapons at most). */
const SERIES = ['#3987e5', '#d95926', '#199e70'] as const;
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
@media (max-width: 720px) { #weapon-tuning .cols { grid-template-columns: minmax(0, 1fr); } #weapon-tuning .bars { grid-template-columns: 92px 1fr; } }
`;

interface Pick {
  def: WeaponDefinition;
  mode: number;
  color: string;
}

/**
 * What the arsenal's bars are measured against: the largest value any gun of a family has (the explosive and exotic
 * arsenal's splash damage would flatten everyone else's bars; theirs run off the end, capped).
 */
function arsenalMax(): Record<keyof WeaponStats, number> {
  const all = Object.values(CORE_WEAPONS).filter((d) => d.slot > 0 && gunplayOf(d).family);
  const out = {} as Record<keyof WeaponStats, number>;
  for (const d of all) {
    const s = weaponStats(d);
    for (const [k, v] of Object.entries(s) as [keyof WeaponStats, number | null][]) out[k] = Math.max(out[k] ?? 0, v ?? 0);
  }
  return out;
}

const fmt = (v: number, d = 0) => v.toLocaleString('en', { maximumFractionDigits: d, minimumFractionDigits: d });
const mrad = (r: number) => r * 1000;

/** A canvas sized to its box at the device's pixel ratio; returns its 2D context in CSS pixels. */
function sized(c: HTMLCanvasElement, h: number): { g: CanvasRenderingContext2D; w: number; h: number } {
  const w = Math.max(200, c.clientWidth || c.parentElement?.clientWidth || 300);
  const k = window.devicePixelRatio || 1;
  c.style.height = `${h}px`;
  c.width = Math.round(w * k);
  c.height = Math.round(h * k);
  const g = c.getContext('2d')!;
  g.setTransform(k, 0, 0, k, 0, 0);
  g.clearRect(0, 0, w, h);
  return { g, w, h };
}

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

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
  root.append(header, main);

  const option = (d: WeaponDefinition) => `<option value="${d.id}">${d.displayName}</option>`;
  header.innerHTML =
    `<h1>Weapon tuning</h1>` +
    state.ids
      .map((_, i) => `<label><i class="sw" style="background:${SERIES[i]}"></i><select data-w="${i}" aria-label="Weapon ${i + 1}">${i ? '<option value="">(none)</option>' : ''}${carried.map(option).join('')}</select><select data-m="${i}" aria-label="Fire mode ${i + 1}" hidden></select></label>`)
      .join('') +
    `<label>Ballistics <select data-b><option value="arcade">Arcade</option><option value="standard">Standard</option><option value="advanced">Advanced</option></select></label>` +
    `<label>Health <input data-hp type="number" min="1" max="1000" step="10"></label>`;
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
    main.append(barsSection(ps), recoilSection(ps), conesSection(ps), lineSection(ps, 'damage'), lineSection(ps, 'ttk'), dropSection(ps));
    // Canvases draw once they have their width.
    requestAnimationFrame(() => main.querySelectorAll<HTMLCanvasElement>('canvas').forEach((c) => (c as unknown as { draw?: () => void }).draw?.()));
  }

  const section = (title: string, note: string): HTMLElement => {
    const s = document.createElement('section');
    s.innerHTML = `<h2>${title}</h2><p class="note">${note}</p>`;
    return s;
  };
  const cardHead = (p: Pick) => {
    const f = firingOf(p.def, p.mode);
    const fam = gunplayOf(p.def).family;
    return `<h3><i class="sw" style="background:${p.color}"></i>${p.def.displayName}<small>${[fam?.replace('_', ' '), fireModeCount(p.def) > 1 ? f.label : f.mode].filter(Boolean).join(' · ')}</small></h3>`;
  };
  const legend = (ps: Pick[]) => `<div class="legend">${ps.map((p) => `<span><i class="sw" style="background:${p.color}"></i>${p.def.displayName}</span>`).join('')}</div>`;

  /** Spec §45's comparison: each stat on one scale across the whole arsenal. */
  function barsSection(ps: Pick[]): HTMLElement {
    const s = section('At a glance', 'Each bar on one scale across the guns of the arsenal, so the extremes show (explosive and exotic weapons can run off the end). Recoil: the climb over the first ten rounds; spread: hip fire standing, a shotgun\'s pattern included.');
    const rows: [string, keyof WeaponStats, (v: number) => string][] = [
      ['Damage', 'damage', (v) => `${fmt(v)} a pull`],
      ['Fire rate', 'rpm', (v) => `${fmt(v)} rpm`],
      ['Recoil', 'recoil', (v) => `${fmt(mrad(v), 0)} mrad`],
      ['Capacity', 'capacity', (v) => `${fmt(v)} rounds`],
      ['Velocity', 'velocity', (v) => (v ? `${fmt(v)} m/s` : 'instant')],
      ['Spread', 'spread', (v) => `${fmt(mrad(v), 1)} mrad`],
      ['Move speed', 'move', (v) => `${fmt(v * 100)} %`],
      ['Sprint to fire', 'sprintExit', (v) => `${fmt(v * 1000)} ms`],
      ['Sights up', 'ads', (v) => `${fmt(v * 1000)} ms`],
      ['Draw', 'equip', (v) => `${fmt(v * 1000)} ms`],
      ['Reload (empty)', 'reload', (v) => `${fmt(v, 2)} s`],
    ];
    const stats = ps.map((p) => weaponStats(p.def, p.mode));
    const grid = document.createElement('div');
    grid.className = 'card bars';
    grid.innerHTML = rows
      .map(([label, key, text]) => {
        // Move speed reads from 80 % (no weapon goes below 85 %): the differences are small on purpose.
        const share = (v: number) => (key === 'move' ? (v - 0.8) / (maxes.move - 0.8) : v / Math.max(1e-9, maxes[key]));
        return `<span class="k">${label}</span><div class="v">${stats
          .map((st, i) => {
            const v = (st[key] as number | null) ?? 0;
            return `<div class="wt-bar"><i style="width:${Math.max(0.5, Math.min(100, share(v) * 100)).toFixed(1)}%;background:${ps[i]!.color}" title="${ps[i]!.def.displayName}"></i><span>${text(v)}</span></div>`;
          })
          .join('')}</div>`;
      })
      .join('');
    s.append(grid);
    return s;
  }

  /** The aim's path over a held trigger (spec §12), all on one scale. */
  function recoilSection(ps: Pick[]): HTMLElement {
    const s = section('Recoil path', 'Where the aim has climbed after each round (up to 30) holding the trigger, with the recovery between rounds as a match runs it; first round ringed. One scale for all; grid every 10 mrad (1 m at 100 m).');
    const paths = ps.map((p) => recoilPath(p.def, p.mode, 30));
    const reach = Math.max(0.02, ...paths.flat().map((q) => Math.max(q.pitch, Math.abs(q.yaw) * 2)));
    const cols = document.createElement('div');
    cols.className = 'cols';
    ps.forEach((p, i) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = cardHead(p);
      const c = document.createElement('canvas');
      card.append(c);
      const path = paths[i]!;
      const last = path[path.length - 1];
      const foot = document.createElement('p');
      foot.className = 'note';
      foot.textContent = last ? `${path.length} rounds: up ${fmt(mrad(last.pitch), 0)} mrad, ${last.yaw >= 0 ? 'right' : 'left'} ${fmt(Math.abs(mrad(last.yaw)), 0)} mrad` : 'No recoil';
      card.append(foot);
      (c as unknown as { draw: () => void }).draw = () => {
        const { g, w, h } = sized(c, 260);
        const pad = 18;
        const scale = (h - pad * 2) / reach;
        const ox = w / 2;
        const oy = h - pad;
        g.strokeStyle = css('--wt-grid');
        g.lineWidth = 1;
        for (let m = 0; m <= reach * 1000 + 1e-6; m += 10) {
          const y = oy - (m / 1000) * scale;
          g.beginPath();
          g.moveTo(0, y);
          g.lineTo(w, y);
          g.stroke();
        }
        for (let m = 10; (m / 1000) * scale < w / 2; m += 10) {
          for (const sx of [-1, 1]) {
            const x = ox + sx * (m / 1000) * scale;
            g.beginPath();
            g.moveTo(x, 0);
            g.lineTo(x, h);
            g.stroke();
          }
        }
        g.strokeStyle = css('--wt-line');
        g.beginPath();
        g.moveTo(ox, 0);
        g.lineTo(ox, h);
        g.stroke();
        const at = (q: { yaw: number; pitch: number }) => [ox + q.yaw * scale, oy - q.pitch * scale] as const;
        g.strokeStyle = p.color;
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(ox, oy);
        for (const q of path) g.lineTo(...at(q));
        g.stroke();
        g.fillStyle = p.color;
        path.forEach((q, k) => {
          const [x, y] = at(q);
          g.beginPath();
          g.arc(x, y, k === 0 ? 4 : 2.5, 0, Math.PI * 2);
          g.fill();
          if (k === 0) {
            g.strokeStyle = css('--wt-ink');
            g.lineWidth = 1.5;
            g.beginPath();
            g.arc(x, y, 6.5, 0, Math.PI * 2);
            g.stroke();
          }
        });
        g.fillStyle = css('--wt-muted');
        g.font = '11px Barlow, sans-serif';
        g.fillText(`${fmt(reach * 1000, 0)} mrad`, 4, pad - 4);
      };
      cols.append(card);
    });
    s.append(cols);
    return s;
  }

  /** Spread cones at 25 m (spec §14-15, §27) against a body for scale. */
  function conesSection(ps: Pick[]): HTMLElement {
    const s = section('Spread cones at 25 m', 'Where a round can land on a target 25 m away: standing hip fire, sights up, running, in the air and after a long spray (the pellet pattern added for shotguns). The grey outline is a body (0.5 × 1.8 m). One scale for all.');
    const D = 25;
    const all = ps.map((p) => spreadCones(p.def));
    const reach = Math.max(0.6, ...all.flatMap((c) => (c ? [c.air + c.pattern, c.sprayed + c.pattern, c.moving + c.pattern].map((r) => Math.tan(r) * D) : [])));
    const cols = document.createElement('div');
    cols.className = 'cols';
    const kinds: [keyof NonNullable<ReturnType<typeof spreadCones>>, string, number[]][] = [
      ['air', 'In the air', [2, 3]],
      ['moving', 'Running', [6, 3]],
      ['sprayed', 'Long spray', [1, 0]],
      ['hip', 'Hip, standing', [1, 0]],
      ['ads', 'Sights up', [1, 0]],
    ];
    ps.forEach((p, i) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = cardHead(p);
      const c = document.createElement('canvas');
      card.append(c);
      const cones = all[i];
      const t = document.createElement('table');
      t.innerHTML = cones
        ? `<tr><th>At 25 m</th><th>radius</th></tr>${kinds
            .slice()
            .reverse()
            .map(([k, label]) => `<tr><td>${label}</td><td>${fmt(Math.tan(cones[k] + cones.pattern) * D * 100, 0)} cm</td></tr>`)
            .join('')}`
        : '<tr><td>No spread model (projectile or melee)</td></tr>';
      card.append(t);
      (c as unknown as { draw: () => void }).draw = () => {
        const { g, w, h } = sized(c, 240);
        const scale = (Math.min(w, h) / 2 - 8) / reach;
        const cx = w / 2;
        const cy = h / 2;
        // The body: 0.5 m wide, 1.8 m tall, aimed at the chest (1.25 m up).
        g.strokeStyle = css('--wt-muted');
        g.lineWidth = 1.5;
        g.strokeRect(cx - 0.25 * scale, cy - 0.55 * scale, 0.5 * scale, 1.8 * scale);
        g.beginPath();
        g.arc(cx, cy - 0.55 * scale - 0.13 * scale, 0.12 * scale, 0, Math.PI * 2);
        g.stroke();
        if (!cones) return;
        for (const [k, , dash] of kinds) {
          const r = Math.tan(cones[k] + cones.pattern) * D * scale;
          g.setLineDash(dash.length > 1 && dash[1] ? dash : []);
          g.strokeStyle = p.color;
          g.globalAlpha = k === 'hip' ? 1 : k === 'ads' ? 0.9 : 0.6;
          g.lineWidth = k === 'hip' ? 2.5 : 1.5;
          g.beginPath();
          g.arc(cx, cy, Math.max(1.5, r), 0, Math.PI * 2);
          g.stroke();
          if (k === 'ads') {
            g.globalAlpha = 0.25;
            g.fillStyle = p.color;
            g.fill();
          }
        }
        g.setLineDash([]);
        g.globalAlpha = 1;
      };
      cols.append(card);
    });
    s.append(cols);
    return s;
  }

  /** Damage (or time to kill) over distance, every weapon on one chart, with a crosshair and tooltip. */
  function lineSection(ps: Pick[], what: 'damage' | 'ttk'): HTMLElement {
    const s =
      what === 'damage'
        ? section('Damage over distance', `Body damage of one trigger pull (every pellet landing) by distance, under ${state.ballistics} ballistics: falloff, and damage by impact speed where the rule uses it. Past its reach a weapon does nothing.`)
        : section(`Time to kill (${state.hp} health)`, 'Seconds from the first round to the kill with every round on the body at the weapon\'s fastest rate; the steps are one more round needed.');
    const far = Math.min(300, Math.max(60, ...ps.map((p) => Math.min(p.def.range, 300))));
    const xs = Array.from({ length: 151 }, (_, k) => (k / 150) * far);
    const value = (p: Pick, x: number) => (what === 'damage' ? damageAt(p.def, x, state.ballistics) : ttkAt(p.def, x, state.hp, state.ballistics, p.mode));
    const series = ps.map((p) => xs.map((x) => value(p, x)));
    const top = Math.max(what === 'damage' ? 20 : 0.5, ...series.flat().map((v) => v ?? 0)) * 1.08;
    const card = document.createElement('div');
    card.className = 'card chart';
    card.innerHTML = legend(ps);
    const c = document.createElement('canvas');
    const tip = document.createElement('div');
    tip.className = 'tip';
    tip.hidden = true;
    card.append(c, tip);
    const L = 46;
    const R = 24;
    const T = 10;
    const B = 28;
    let hover: number | null = null;
    const draw = () => {
      const { g, w, h } = sized(c, 260);
      const px = (x: number) => L + (x / far) * (w - L - R);
      const py = (v: number) => T + (1 - v / top) * (h - T - B);
      g.font = '11px Barlow, sans-serif';
      g.lineWidth = 1;
      const stepY = what === 'damage' ? (top > 150 ? 50 : top > 60 ? 20 : 10) : top > 3 ? 1 : top > 1 ? 0.25 : 0.1;
      for (let v = 0; v <= top; v += stepY) {
        g.strokeStyle = css('--wt-grid');
        g.beginPath();
        g.moveTo(L, py(v));
        g.lineTo(w - R, py(v));
        g.stroke();
        g.fillStyle = css('--wt-muted');
        g.textAlign = 'right';
        g.fillText(what === 'damage' ? fmt(v) : `${fmt(v, stepY < 1 ? 2 : 0)} s`, L - 6, py(v) + 4);
      }
      const stepX = far > 150 ? 50 : 25;
      g.textAlign = 'center';
      for (let x = 0; x <= far; x += stepX) g.fillText(`${x} m`, px(x), h - 8);
      g.strokeStyle = css('--wt-line');
      g.beginPath();
      g.moveTo(L, py(0));
      g.lineTo(w - R, py(0));
      g.stroke();
      series.forEach((ys, i) => {
        g.strokeStyle = ps[i]!.color;
        g.lineWidth = 2;
        g.beginPath();
        let on = false;
        ys.forEach((v, k) => {
          if (v === null || (what === 'damage' && v <= 0)) {
            on = false;
            return;
          }
          if (on) g.lineTo(px(xs[k]!), py(v));
          else g.moveTo(px(xs[k]!), py(v));
          on = true;
        });
        g.stroke();
      });
      if (hover !== null) {
        const x = px(xs[hover]!);
        g.strokeStyle = css('--wt-ink2');
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x, T);
        g.lineTo(x, h - B);
        g.stroke();
        series.forEach((ys, i) => {
          const v = ys[hover!];
          if (v === null || v === undefined || (what === 'damage' && v <= 0)) return;
          g.fillStyle = ps[i]!.color;
          g.strokeStyle = css('--wt-surface');
          g.lineWidth = 2;
          g.beginPath();
          g.arc(x, py(v), 4.5, 0, Math.PI * 2);
          g.fill();
          g.stroke();
        });
      }
    };
    (c as unknown as { draw: () => void }).draw = draw;
    c.addEventListener('pointermove', (e) => {
      const r = c.getBoundingClientRect();
      const u = (e.clientX - r.left - L) / (r.width - L - R);
      if (u < 0 || u > 1) {
        hover = null;
        tip.hidden = true;
        draw();
        return;
      }
      hover = Math.round(u * (xs.length - 1));
      const d = xs[hover]!;
      tip.innerHTML = `<b>${fmt(d)} m</b><br>${ps
        .map((p, i) => {
          const v = series[i]![hover!];
          const text = v === null || v === undefined ? 'out of reach' : what === 'damage' ? (v > 0 ? fmt(v, 1) : 'out of reach') : `${fmt(v, 2)} s`;
          return `<span class="sw" style="background:${p.color}"></span> ${p.def.displayName}: ${text}`;
        })
        .join('<br>')}`;
      tip.hidden = false;
      tip.style.left = `${e.clientX - card.getBoundingClientRect().left}px`;
      tip.style.top = `${e.clientY - card.getBoundingClientRect().top}px`;
      draw();
    });
    c.addEventListener('pointerleave', () => {
      hover = null;
      tip.hidden = true;
      draw();
    });
    s.append(card);
    return s;
  }

  /** Drop below the aim and the holdover a scope marks (spec §5), as a table. */
  function dropSection(ps: Pick[]): HTMLElement {
    const s = section('Bullet drop and holdover', `Angle below the aim a target must sit for a level shot to land, under ${state.ballistics} ballistics (what a scope's holdover marks show), and the drop in centimetres. Hitscan and projectiles without bullet drop: none.`);
    const dists = [50, 100, 150, 200, 250, 300, 400, 500];
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<table><tr><th>Weapon</th>${dists.map((d) => `<th>${d} m</th>`).join('')}</tr>${ps
      .map((p) => {
        const marks = new Map(dropAt(p.def, state.ballistics).map((m) => [m.dist, m.angle]));
        return `<tr><td><i class="sw" style="background:${p.color}"></i> ${p.def.displayName}</td>${dists
          .map((d) => {
            const a = marks.get(d);
            return `<td>${a === undefined ? '–' : `${fmt(mrad(a), 2)} mrad<br><small style="color:var(--wt-muted)">${fmt(Math.tan(a) * d * 100, 0)} cm</small>`}</td>`;
          })
          .join('')}</tr>`;
      })
      .join('')}</table>`;
    s.append(card);
    return s;
  }

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
  };
  render();
}
