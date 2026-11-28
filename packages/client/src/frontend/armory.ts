import type { AssetContainer } from '@babylonjs/core/assetContainer';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import { MODEL_FALLBACKS, getWeapon, type WeaponDefinition } from '@tiletrigger/shared';
import { GLB, versioned } from '../assetUrl.ts';
import type { AudioSystem, SoundId } from '../audio/audio.ts';
import { SOUNDS } from '../audio/audio.ts';
import { MODEL_BASE, ModelLibrary } from '../content/models.ts';
import { isMenuKey } from '../game/keyBindings.ts';
import { opticChoices, opticOf } from '../game/optics.ts';
import { PAD, glyphs } from '../inputMode.ts';
import { myOpticFor, setMyOptic } from '../opticPrefs.ts';
import { armoryModel, armoryRole, armorySections, armoryStats, armoryTags, armoryText, loadArmoryFavs, toggleArmoryFav } from './armoryData.ts';
import type { MenuScene } from './menuScene.ts';
import { weaponIcon } from './weaponIcons.ts';
import './armory.css';

/**
 * The Armory (owner, 2026-11-27; docs/ARSENAL.md, "Armory"): every weapon a player can hold, laid out like Character
 * Select (its classes and phone layouts in style.css; armory.css only for what differs): a jump strip of the weapon
 * wheel's categories with search and Favourites only over one grid of weapon pictures, the picked weapon large in the
 * menu scene (its held, sharpest copy, its sight on it) turned by dragging, and a panel with its name, role,
 * description, stat bars, its sight (the Profile loadout's optic pick), a fire-sound preview and **Try it in the
 * range** (the Practice range with it in hand). Loaded on demand: the menu's first JS carries only the entry hook
 * (frontEnd.ts `armoryPage`).
 */

export interface ArmoryHost {
  scene: MenuScene;
  audio: AudioSystem;
  /** The Practice range with this weapon in hand (main.ts playRange). */
  play(weapon: string): void;
  /** Open on this weapon (back from a range: the one held last there), when the Armory lists it. */
  show?: string;
}

export interface ArmoryPage {
  /** The page goes (another screen, a match): the weapon on show is freed and the hero comes back. */
  leave(): void;
  /** A key on the page: true when it took it. */
  key(e: KeyboardEvent): boolean;
  /** A controller button: true when it took it. */
  pad(button: number): boolean;
  /** Q / E, LB / RB: the previous or next category. */
  cycle(dir: 1 | -1): void;
  /** Try the weapon shown in the range. */
  tryIt(): void;
}

/** The weapon shown, kept for this visit to the site (back from the range, the Armory opens on it again). */
let shown = 'core.rifle';
/** The search and Favourites only (this visit). */
let query = '';
let favsOnly = false;

/** How long (ms) the pointer or focus rests on a tile before its model's file is fetched (Character Select's). */
const PREFETCH_DWELL_MS = 120;
/** The longest side of a weapon on show (m): every weapon large, a pistol as big as a rifle. */
const SHOW_SIZE = 0.95;
/** It stands this high over the plinth (m), side-on with its muzzle to the right, turned a little toward you. */
const SHOW_HEIGHT = 1.15;
const SHOW_YAW = -Math.PI / 2 + 0.3;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> & { class?: string } = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  const { class: cls, ...rest } = props;
  if (cls) e.className = cls;
  Object.assign(e, rest);
  e.append(...children);
  return e;
};

/** The URL a model file is fetched from (as content/models.ts loads it). */
const urlOf = (path: string) => versioned(`${MODEL_BASE}${path}`);

/** The weapon on the plinth: its node (turned), the model's node inside it (fitted) and what to free. */
interface OnShow {
  id: string;
  node: TransformNode;
  model: TransformNode;
  container: AssetContainer | null;
  optic: TransformNode | null;
}

export function mountArmory(root: HTMLElement, host: ArmoryHost): ArmoryPage {
  const { scene: menu, audio } = host;
  const scene = menu.scene;
  const fetcher = menu.characters.fetcher;
  const procedural = new ModelLibrary(scene);
  const sections = armorySections();
  const all = sections.flatMap((s) => s.weapons);
  if (host.show && all.some((d) => d.id === host.show)) shown = host.show;
  if (!all.some((d) => d.id === shown)) shown = all[0]!.id;
  const favs = new Set(loadArmoryFavs());
  let section: string | null = null;
  let gone = false;
  let onShow: OnShow | null = null;
  let token = 0;
  let yaw = 0;
  let yawSpeed = 0;

  menu.hideHero = true;
  menu.setShot('armory');

  // ---- the jump strip: the categories, search and Favourites only (Character Select's).
  const bumper = (dir: 1 | -1) => {
    const b = el('button', { type: 'button', class: 'bumper-btn', title: `${dir > 0 ? 'Next' : 'Previous'} category (${dir > 0 ? 'E' : 'Q'})` }, ...glyphs(dir > 0 ? 'E' : 'Q', dir > 0 ? 'RB' : 'LB'), el('span', { class: 'bumper-arrow', textContent: dir > 0 ? '▶' : '◀' }));
    b.setAttribute('aria-label', `${dir > 0 ? 'Next' : 'Previous'} category`);
    b.addEventListener('click', () => step(dir));
    return b;
  };
  const chips = el('div', { class: 'char-jump-chips' });
  for (const s of sections) {
    const chip = el('button', { type: 'button', class: 'char-chip', title: `${s.label}: ${s.weapons.length} weapon${s.weapons.length === 1 ? '' : 's'}`, textContent: s.label });
    chip.dataset.section = s.id;
    chip.addEventListener('click', () => jumpTo(s.id));
    chips.append(chip);
  }
  const search = el('input', { type: 'search', id: 'armory-search', class: 'char-search', placeholder: 'Search…', value: query, maxLength: 30, autocomplete: 'off' });
  search.setAttribute('aria-label', 'Search weapons');
  const favBtn = el('button', { type: 'button', id: 'armory-favs-only', class: `char-favs-only${favsOnly ? ' on' : ''}`, title: 'Favourites only', textContent: '★' });
  favBtn.setAttribute('aria-pressed', String(favsOnly));
  favBtn.setAttribute('aria-label', 'Favourites only');
  const jump = el('nav', { class: 'char-jump' }, bumper(-1), chips, bumper(1), el('div', { class: 'char-find' }, search, favBtn));
  jump.setAttribute('aria-label', 'Weapon categories');

  // ---- the grid: a section per category, a tile per weapon (its picture and name).
  const grid = el('div', { class: 'char-grid', id: 'armory-grid' });
  let prefetchTimer = 0;
  const makeTile = (d: WeaponDefinition) => {
    const icon = weaponIcon(d.id, 'armory-icon');
    const tile = el('button', { class: `char-tile armory-tile${d.id === shown ? ' previewing' : ''}`, title: d.displayName }, ...(icon ? [icon] : []), el('span', { textContent: d.displayName }));
    tile.dataset.weapon = d.id;
    const fav = favs.has(d.id);
    const star = el('span', { class: `char-fav${fav ? ' on' : ''}`, role: 'button', tabIndex: -1, title: fav ? 'Favourite: tap to drop' : 'Keep as a favourite', textContent: fav ? '★' : '☆' });
    star.setAttribute('aria-pressed', String(fav));
    star.setAttribute('aria-label', `Favourite: ${d.displayName}`);
    star.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const now = toggleArmoryFav(d.id);
      if (now) favs.add(d.id);
      else favs.delete(d.id);
      star.classList.toggle('on', now);
      star.textContent = now ? '★' : '☆';
      star.setAttribute('aria-pressed', String(now));
      if (favsOnly) filter();
    });
    star.addEventListener('pointerdown', (e) => e.stopPropagation());
    tile.append(star);
    // A click (tap, Enter, controller A) shows it; again on the one shown (Enter, A), into the range with it.
    tile.addEventListener('click', (e) => (e.detail === 0 && shown === d.id ? tryIt() : show(d.id)));
    tile.addEventListener('dblclick', () => tryIt());
    // Resting on a tile fetches its model's file (and its neighbours' after it): a pick then has it, or most of it.
    const soon = () => {
      clearTimeout(prefetchTimer);
      prefetchTimer = window.setTimeout(() => {
        if (!tile.isConnected || !fetcher) return;
        const near = [tile.previousElementSibling, tile.nextElementSibling].flatMap((t) => (t instanceof HTMLElement && t.dataset.weapon && !t.hidden ? [urlOf(armoryModel(getWeapon(t.dataset.weapon)))] : []));
        const url = urlOf(armoryModel(d));
        if (armoryModel(d).startsWith('procedural/')) return;
        fetcher.want([url], 'soon', near);
        for (const u of near) fetcher.get(u, 'later').catch(() => undefined);
      }, PREFETCH_DWELL_MS);
    };
    tile.addEventListener('pointerenter', soon);
    tile.addEventListener('focus', soon);
    tile.addEventListener('pointerleave', () => clearTimeout(prefetchTimer));
    return tile;
  };
  for (const s of sections) {
    const sec = el('section', { class: 'char-sec' }, el('h4', { class: 'char-sec-head' }, el('span', { textContent: s.label }), el('b', { textContent: String(s.weapons.length) })), el('div', { class: 'char-sec-tiles' }, ...s.weapons.map(makeTile)));
    sec.dataset.section = s.id;
    sec.setAttribute('aria-label', s.label);
    grid.append(sec);
  }
  const empty = el('p', { class: 'char-empty', hidden: true });
  grid.append(empty);

  const filter = () => {
    const q = query.trim().toLowerCase();
    let n = 0;
    for (const sec of grid.querySelectorAll<HTMLElement>('.char-sec')) {
      let k = 0;
      for (const t of sec.querySelectorAll<HTMLElement>('.char-tile')) {
        const ok = (!q || t.title.toLowerCase().includes(q)) && (!favsOnly || favs.has(t.dataset.weapon!));
        t.hidden = !ok;
        if (ok) k++;
      }
      sec.hidden = k === 0;
      chips.querySelector<HTMLElement>(`.char-chip[data-section="${sec.dataset.section}"]`)?.toggleAttribute('hidden', sec.hidden);
      n += k;
    }
    empty.hidden = n > 0;
    empty.textContent = favsOnly && !favs.size ? 'No favourites yet: the star on a weapon keeps one here.' : `No weapons match${q ? ` "${query.trim()}"` : ''}${favsOnly ? ' among your favourites' : ''}.`;
    onScroll();
  };
  search.addEventListener('input', () => {
    query = search.value;
    grid.scrollTop = 0;
    filter();
  });
  favBtn.addEventListener('click', () => {
    favsOnly = !favsOnly;
    favBtn.classList.toggle('on', favsOnly);
    favBtn.setAttribute('aria-pressed', String(favsOnly));
    grid.scrollTop = 0;
    filter();
  });

  // ---- the section in view lights its chip; a chip or Q / E scrolls to one.
  const inView = (): string | null => {
    const secs = [...grid.querySelectorAll<HTMLElement>('.char-sec:not([hidden])')];
    if (!secs.length) return null;
    if (grid.scrollTop > 0 && grid.scrollTop + grid.clientHeight >= grid.scrollHeight - 2) return secs[secs.length - 1]!.dataset.section!;
    let at = secs[0]!;
    for (const s of secs) if (s.offsetTop <= grid.scrollTop + 24) at = s;
    return at.dataset.section!;
  };
  const mark = (id: string | null) => {
    if (!id || id === section) return;
    section = id;
    for (const c of chips.querySelectorAll<HTMLElement>('.char-chip')) {
      const on = c.dataset.section === id;
      c.classList.toggle('on', on);
      c.setAttribute('aria-current', on ? 'true' : 'false');
      if (on && chips.scrollWidth > chips.clientWidth) chips.scrollLeft = c.offsetLeft - (chips.clientWidth - c.offsetWidth) / 2;
    }
  };
  let jumping = false;
  const onScroll = () => {
    grid.classList.toggle('more', grid.scrollTop + grid.clientHeight < grid.scrollHeight - 4);
    if (!jumping) mark(inView());
  };
  grid.addEventListener('scroll', onScroll, { passive: true });
  const jumpTo = (id: string, focus = false) => {
    const sec = grid.querySelector<HTMLElement>(`.char-sec[data-section="${id}"]`);
    if (!sec) return;
    jumping = true;
    mark(id);
    grid.scrollTop = Math.min(sec.offsetTop, grid.scrollHeight - grid.clientHeight);
    requestAnimationFrame(() => (jumping = false));
    if (focus) sec.querySelector<HTMLElement>('.char-tile:not([hidden])')?.focus({ preventScroll: true });
  };
  const step = (dir: 1 | -1) => {
    const ids = [...grid.querySelectorAll<HTMLElement>('.char-sec:not([hidden])')].map((s) => s.dataset.section!);
    if (!ids.length) return;
    const i = Math.max(0, ids.indexOf(section ?? ids[0]!));
    jumpTo(ids[(i + dir + ids.length) % ids.length]!, true);
  };

  /** Arrow keys / d-pad over the tiles (Character Select's gridMove): false when the focus isn't on the grid. */
  const gridMove = (dx: number, dy: number): boolean => {
    const f = document.activeElement as HTMLElement | null;
    if (f && f !== document.body && !grid.contains(f)) return false;
    const tiles = [...grid.querySelectorAll<HTMLElement>('.char-tile')].filter((t) => !t.hidden && !t.closest('[hidden]'));
    const from = f && grid.contains(f) ? f : (grid.querySelector<HTMLElement>('.char-tile.previewing') ?? tiles[0]);
    if (!from) return false;
    let to: HTMLElement | undefined;
    if (!f || !grid.contains(f)) to = from;
    else if (dx) to = tiles[tiles.indexOf(from) + dx];
    else {
      const r = from.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const rows = tiles.map((t) => ({ t, r: t.getBoundingClientRect() })).filter(({ r: o }) => (dy > 0 ? o.top >= r.bottom - 2 : o.bottom <= r.top + 2));
      if (rows.length) {
        const top = dy > 0 ? Math.min(...rows.map((o) => o.r.top)) : Math.max(...rows.map((o) => o.r.top));
        to = rows.filter((o) => Math.abs(o.r.top - top) < 2).sort((a, b) => Math.abs(a.r.left + a.r.width / 2 - cx) - Math.abs(b.r.left + b.r.width / 2 - cx))[0]?.t;
      }
    }
    if (!to) return true;
    to.focus({ preventScroll: true });
    const g = grid.getBoundingClientRect();
    const t = to.getBoundingClientRect();
    const head = (to.closest('.char-sec')?.querySelector<HTMLElement>('.char-sec-head')?.offsetHeight ?? 0) + 6;
    if (t.top < g.top + head) grid.scrollTop -= g.top + head - t.top;
    else if (t.bottom > g.bottom - 6) grid.scrollTop += t.bottom - g.bottom + 6;
    return true;
  };

  // ---- the details panel (Character Select's char-info: a sheet on a phone).
  let sheet = false;
  const info = el('div', { class: 'char-info panel armory-info', id: 'armory-info' });
  const sheetToggle = () => {
    const b = el('button', { type: 'button', class: 'char-sheet-toggle', title: sheet ? 'Hide the details' : 'Show the details' }, el('span', { textContent: sheet ? '▾' : '▴' }));
    b.setAttribute('aria-expanded', String(sheet));
    b.setAttribute('aria-label', sheet ? 'Hide the details' : 'Show the details');
    b.addEventListener('click', () => {
      sheet = !sheet;
      info.classList.toggle('sheet-open', sheet);
      b.replaceWith(sheetToggle());
    });
    return b;
  };
  const fill = (d: WeaponDefinition) => {
    const text = armoryText(d);
    const stats = el(
      'div',
      { class: 'char-stats', id: 'armory-stats' },
      el('h4', { textContent: 'Stats' }),
      ...armoryStats(d).map((s) => {
        const bar = el('span', { class: 'stat-bar' }, el('i', { class: 'stat-fill' }));
        (bar.firstChild as HTMLElement).style.width = `${Math.round(Math.max(0.02, s.share) * 100)}%`;
        const row = el('div', { class: 'stat-row', title: s.help }, el('span', { class: 'stat-label', textContent: s.label }), bar, el('span', { class: 'stat-val', textContent: s.text }));
        row.dataset.stat = s.key;
        return row;
      }),
    );
    // Its sight: the one it carries, or the choice the loadout keeps (Profile → Favourite loadout → Optics, the same).
    const choices = opticChoices(d);
    const carried = opticOf(d, myOpticFor(d.id));
    const sights = el('div', { class: 'loadout armory-sights' }, el('h4', { textContent: 'Sights' }));
    if (choices.length) {
      const pick = el('select', { id: 'armory-optic', title: `The optic on the ${d.displayName}: kept for your loadout` }, ...choices.map((c, i) => el('option', { value: c.id, textContent: i === 0 ? `${c.name} (its own)` : c.name, selected: c.id === carried?.id })));
      pick.addEventListener('change', () => {
        setMyOptic(d.id, pick.value, choices[0]!.id);
        if (onShow?.id === d.id) dressOptic(onShow, d);
      });
      sights.append(pick, el('small', { class: 'hint', textContent: `${choices.length} to choose from, kept for your loadout` }));
    } else sights.append(el('span', { textContent: carried ? carried.kind.name : d.kind === 'melee' ? 'None' : 'Iron sights' }));
    const tryBtn = el('button', { type: 'button', id: 'armory-try', class: 'primary', textContent: 'Try it in the range', title: `The Practice range with the ${d.displayName} in hand (Enter, controller A on the one shown)` });
    tryBtn.addEventListener('click', () => tryIt());
    const fire = d.view.sound ?? `fire.${d.id.replace(/^core\./, '')}`;
    const acts = el('div', { class: 'char-actions' }, tryBtn);
    if (SOUNDS[fire]) {
      const hear = el('button', { type: 'button', id: 'armory-sound', textContent: '▶ Fire sound', title: `Hear the ${d.displayName} fire` });
      hear.addEventListener('click', () => {
        audio.unlock();
        void audio.ensure(fire).then(() => audio.play(fire as SoundId));
      });
      acts.append(hear);
    }
    info.replaceChildren(
      sheetToggle(),
      el(
        'div',
        { class: 'who' },
        el('h3', { textContent: d.displayName }),
        el('p', { class: 'armory-role', textContent: armoryRole(d) }),
        ...(text.description ? [el('p', { class: 'armory-desc', textContent: text.description })] : []),
        ...(text.range ? [el('p', { class: 'armory-range', textContent: text.range })] : []),
        el('div', { class: 'tags' }, ...armoryTags(d).map((t) => el('span', { textContent: t }))),
      ),
      stats,
      sights,
      acts,
    );
  };

  // ---- the weapon on the plinth.
  /** A model's container: from the prefetch's bytes when there are any, else by URL. */
  const load = async (path: string): Promise<AssetContainer> => {
    const url = urlOf(path);
    const rootUrl = url.slice(0, url.lastIndexOf('/') + 1);
    const byUrl = () => LoadAssetContainerAsync(url, scene, GLB);
    const c = fetcher ? await fetcher.get(url, 'now').then((buf) => (fetcher.take(url), LoadAssetContainerAsync(new Uint8Array(buf), scene, { ...GLB, rootUrl })), byUrl) : await byUrl();
    if (path.startsWith('guns/') && c.materials.some((m) => (m as { metallicTexture?: unknown }).metallicTexture)) (await import('../game/weaponFinish.ts')).finishWeapons(c, scene);
    return c;
  };
  const dressOptic = (s: OnShow, d: WeaponDefinition) => {
    s.optic?.dispose();
    s.optic = null;
    void import('../game/opticHousing.ts').then(({ attachOptic }) => {
      if (onShow !== s || gone) return;
      // A scope model of our own (content/optics.json `scopeModel`) comes in as the weapon did, its sharper copy.
      const scopeModel = (path: string) =>
        load(path).then((c) => {
          const entries = c.instantiateModelsToScene((n) => `armoryScope_${n}`, false, { doNotInstantiate: true });
          const node = new TransformNode('armoryScope', scene);
          for (const n of entries.rootNodes) n.parent = node;
          node.onDisposeObservable.add(() => c.dispose());
          return node;
        });
      s.optic = attachOptic(scene, s.model, d, false, opticOf(d, myOpticFor(d.id)), scopeModel, 'high');
    });
  };
  const free = (s: OnShow | null) => {
    if (!s) return;
    s.node.dispose();
    s.container?.dispose();
  };
  const place = async (d: WeaponDefinition) => {
    const my = ++token;
    const paths = [...new Set([armoryModel(d), d.view.model, MODEL_FALLBACKS[d.view.model], d.view.fallback].filter((p): p is string => !!p))];
    let container: AssetContainer | null = null;
    let model: TransformNode | null = null;
    for (const p of paths) {
      try {
        if (p.startsWith('procedural/')) model = await procedural.instantiate(p, `armory_${d.id}`);
        else container = await load(p);
        break;
      } catch {
        container = null;
      }
    }
    if (my !== token || gone) return container?.dispose(), model?.dispose();
    if (container) {
      const entries = container.instantiateModelsToScene((n) => `armory_${n}`, false, { doNotInstantiate: true });
      for (const g of entries.animationGroups) g.stop();
      model = new TransformNode(`armory_${d.id}`, scene);
      for (const n of entries.rootNodes) n.parent = model;
    }
    if (!model) return;
    for (const m of model.getChildMeshes()) m.isPickable = false;
    const node = new TransformNode('armoryShow', scene);
    model.parent = node;
    // Fitted: its longest side SHOW_SIZE, its middle at the node.
    const { min, max } = model.getHierarchyBoundingVectors(true);
    const k = SHOW_SIZE / Math.max(0.05, max.x - min.x, max.y - min.y, max.z - min.z);
    model.scaling.setAll(k);
    model.position.set(-((min.x + max.x) / 2) * k, -((min.y + max.y) / 2) * k, -((min.z + max.z) / 2) * k);
    node.position.set(0, SHOW_HEIGHT, 0);
    node.rotation.y = SHOW_YAW + yaw;
    const s: OnShow = { id: d.id, node, model, container, optic: null };
    free(onShow);
    onShow = s;
    root.dataset.shown = d.id;
    dressOptic(s, d);
  };
  const turn = scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(0.05, scene.getEngine().getDeltaTime() / 1000);
    if (yawSpeed !== 0) {
      yaw += yawSpeed * dt;
      yawSpeed *= Math.exp(-dt * 3);
      if (Math.abs(yawSpeed) < 0.05) yawSpeed = 0;
    }
    if (onShow) {
      onShow.node.rotation.y = SHOW_YAW + yaw;
      frameIn(onShow.node);
    }
  });

  /**
   * Stand the weapon in the middle of the free space beside the panels (the turn zone), sized to fit it, whatever the
   * window's shape: a phone held sideways leaves a narrow strip, a wide screen a big one.
   */
  const frameIn = (node: TransformNode) => {
    const cam = scene.activeCamera;
    const rect = scene.getEngine().getRenderingCanvasClientRect();
    const zone = spin.getBoundingClientRect();
    if (!cam || !rect || zone.width < 40 || zone.height < 80) return;
    const vp = cam.viewport.toGlobal(rect.width, rect.height);
    const m = cam.getViewMatrix().multiply(cam.getProjectionMatrix());
    const at = (x: number, y: number) => Vector3.Project(new Vector3(x, y, 0), Matrix.IdentityReadOnly, m, vp);
    const o = at(0, SHOW_HEIGHT);
    const perX = at(1, SHOW_HEIGHT).x - o.x;
    const perY = at(0, SHOW_HEIGHT + 1).y - o.y;
    if (Math.abs(perX) < 1 || Math.abs(perY) < 1) return;
    // The turn buttons' bar at the zone's foot stays clear; the weapon turned toward you looks bigger than its side-on size.
    const room = zone.height - 64;
    node.position.x = (zone.left - rect.left + zone.width / 2 - o.x) / perX;
    node.position.y = SHOW_HEIGHT + (zone.top - rect.top + room / 2 - o.y) / perY;
    node.scaling.setAll(Math.min(1, (zone.width * 0.7) / Math.abs(perX) / SHOW_SIZE, (room * 0.6) / Math.abs(perY) / SHOW_SIZE));
  };

  const show = (id: string) => {
    const d = getWeapon(id);
    shown = id;
    sheet = true;
    info.classList.add('sheet-open');
    for (const t of grid.querySelectorAll<HTMLElement>('.char-tile')) t.classList.toggle('previewing', t.dataset.weapon === id);
    fill(d);
    void place(d);
  };

  // ---- drag to turn (Character Select's spin zone, turning the weapon).
  const spin = el('div', { class: 'char-spin armory-spin', title: 'Drag to turn' });
  let last: { x: number; t: number } | null = null;
  let speed = 0;
  spin.addEventListener('pointerdown', (e) => {
    spin.setPointerCapture(e.pointerId);
    last = { x: e.clientX, t: e.timeStamp };
    speed = 0;
    yawSpeed = 0;
  });
  spin.addEventListener('pointermove', (e) => {
    if (!last) return;
    const r = ((e.clientX - last.x) / Math.max(320, window.innerWidth)) * Math.PI * 2 * 1.2;
    const dt = Math.max(1, e.timeStamp - last.t) / 1000;
    speed = speed * 0.5 + (r / dt) * 0.5;
    yaw += r;
    last = { x: e.clientX, t: e.timeStamp };
  });
  const end = (e: PointerEvent) => {
    if (!last) return;
    yawSpeed = e.timeStamp - last.t < 80 ? Math.max(-12, Math.min(12, speed)) : 0;
    last = null;
  };
  spin.addEventListener('pointerup', end);
  spin.addEventListener('pointercancel', end);
  const turnBtn = (dir: number, label: string, text: string) => {
    const b = el('button', { class: 'spin-btn', title: label, textContent: text });
    b.setAttribute('aria-label', label);
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    b.addEventListener('click', () => (yawSpeed = dir * 5.2));
    return b;
  };
  spin.append(el('div', { class: 'spin-bar' }, turnBtn(-1, 'Turn left (,)', '⟲'), el('span', { class: 'spin-label' }, 'Drag to turn', el('kbd', { class: 'g-kbm', textContent: ', .' })), turnBtn(1, 'Turn right (.)', '⟳')));

  root.append(jump, grid, info, spin);
  sheet = false;
  fill(getWeapon(shown));
  void place(getWeapon(shown));
  if (query || favsOnly) filter();
  new ResizeObserver(onScroll).observe(grid);
  requestAnimationFrame(() => {
    const t = grid.querySelector<HTMLElement>(`.char-tile[data-weapon="${shown}"]`);
    if (t && t.offsetTop + t.offsetHeight > grid.clientHeight) grid.scrollTop = t.closest<HTMLElement>('.char-sec')?.offsetTop ?? 0;
    mark(inView());
  });

  const tryIt = () => {
    const id = shown;
    page.leave();
    host.play(id);
  };
  const page: ArmoryPage = {
    leave() {
      if (gone) return;
      gone = true;
      clearTimeout(prefetchTimer);
      scene.onBeforeRenderObservable.remove(turn);
      free(onShow);
      onShow = null;
      menu.hideHero = false;
    },
    key(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return false;
      if (e.key.startsWith('Arrow') && gridMove(e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0, e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0)) return e.preventDefault(), true;
      if (isMenuKey('menuPrev', e.code) || isMenuKey('menuNext', e.code)) return step(isMenuKey('menuNext', e.code) ? 1 : -1), true;
      if (e.key === ',' || e.key === '.') return (yawSpeed = e.key === '.' ? 5.2 : -5.2), true;
      if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement || e.target instanceof HTMLSelectElement)) return e.preventDefault(), tryIt(), true;
      return false;
    },
    pad(b) {
      if (b === PAD.lb || b === PAD.rb) return step(b === PAD.rb ? 1 : -1), true;
      if (b === PAD.up || b === PAD.down || b === PAD.left || b === PAD.right) return gridMove(b === PAD.right ? 1 : b === PAD.left ? -1 : 0, b === PAD.down ? 1 : b === PAD.up ? -1 : 0);
      if (b === PAD.y) {
        grid.querySelector<HTMLElement>(`.char-tile[data-weapon="${shown}"] .char-fav`)?.click();
        return true;
      }
      if (b === PAD.x) return document.getElementById('armory-sound')?.click(), true;
      return false;
    },
    cycle: step,
    tryIt,
  };
  return page;
}
