import { Color4, CreateLineSystem, Vector3, type LinesMesh, type Scene } from '@babylonjs/core';
import {
  ENV_BRUSH_DEFAULTS,
  ENV_CATEGORIES,
  ENV_PRESETS,
  ENV_PRESET_IDS,
  ENV_SPECIES,
  MAP_BUDGETS,
  TERRAIN_MATERIALS,
  TERRAIN_MATERIAL_LABELS,
  blockingPlacement,
  brushModels,
  builtCells,
  envBrushDab,
  envEraseDab,
  envImpact,
  environmentShapes,
  getEnvSpecies,
  getProp,
  groundSampler,
  keepClearZones,
  newId,
  terrainHeightAt,
  withPreset,
  type BudgetCounts,
  type EditCommand,
  type EnvBrush,
  type EnvCategory,
  type EnvPresetId,
  type KeepClearZone,
  type MapDocument,
  type PropDefinition,
  type TerrainData,
  type TerrainMaterial,
} from '@tiletrigger/shared';

/**
 * Environment Phase 3 in MapMaker (docs/PROCEDURAL_ENVIRONMENT.md §8): the Nature tab's Environment group (our species
 * by Trees, Plants, Ground cover, Rocks, Boulders and Cliffs: single placement is the prop tool, with its surface
 * snap, Randomise, R to turn, the inspector's scale, and undo), the environment brush (paint and erase: density,
 * radius, seed, size and turn variation, per-species weights, biome presets, slope / altitude / ground filters and
 * keep-clear of spawns, routes and objectives) and the collision and nav preview (what blocks movement, shots and
 * sight). The logic is shared/editor/envBrush.ts; this is the UI. One stroke is one undo step (the editor's brush
 * stroke).
 */
export interface EnvHost {
  doc(): MapDocument;
  run(label: string, cmd: EditCommand): boolean;
  /** The ground MapMaker shows (EditorApp.shownGround). */
  ground(): TerrainData | null;
  /** Floor height of the level in view (where there is no terrain). */
  floorY(): number;
  scene(): Scene;
  budgets(): BudgetCounts;
  radius(): number;
  setRadius(r: number): void;
  toast(message: string, error?: boolean): void;
  /** Take up the brush (the `envbrush` tool). */
  useBrush(): void;
  /** Palette helpers: a group, a heading in it, a prop card (pictured from the atlas when `picture`). */
  group(container: HTMLElement, id: string, title: string, opts: { open?: boolean; note?: string }): HTMLElement;
  heading(grid: HTMLElement, text: string): void;
  propCard(grid: HTMLElement, def: PropDefinition, tags: string, picture: boolean): void;
  register(el: HTMLElement, key: string, name: string, tags: string): void;
}

export const ENV_CATEGORY_LABELS: Record<EnvCategory, string> = { tree: 'Trees', plant: 'Plants', groundcover: 'Ground cover', rock: 'Rocks', boulder: 'Boulders', cliff: 'Cliffs', deadwood: 'Deadwood' };
const TURNS: readonly [number, string][] = [[180, 'Any way'], [90, '±90°'], [45, '±45°'], [15, '±15°'], [0, 'No turn']];

export class EnvTools {
  brush: EnvBrush = structuredClone(ENV_BRUSH_DEFAULTS);
  preset: EnvPresetId | 'custom' = 'temperate';
  mode: 'paint' | 'erase' = 'paint';
  /** The eraser takes every species, not only the brush's. */
  eraseAll = false;
  /** Show what blocks movement, shots and sight (and the keep-clear zones). */
  showBlockers = false;
  private pane: HTMLElement | null = null;
  private overlay: LinesMesh | null = null;
  private overlayDoc: MapDocument | null = null;
  private zones: KeepClearZone[] | null = null;
  private built: Set<string> | null = null;
  private last: { x: number; z: number } | null = null;
  private stroke = { added: 0, removed: 0, filtered: 0, keptClear: 0, clearOf: null as KeepClearZone | null, overBudget: false, ms: 0, dabs: 0 };

  constructor(private readonly host: EnvHost) {}

  /** The Environment group, first in the Nature tab: the brush card, then the species by category. */
  buildPalette(container: HTMLElement, pictured: readonly string[]): void {
    const grid = this.host.group(container, 'nature:environment', 'Environment', { open: true, note: 'Our trees, plants, rocks and cliffs: click one to place it (R turns, Randomise varies, the inspector scales), or paint them with the brush.' });
    const sec = grid.closest('section');
    if (sec) container.prepend(sec);
    const brush = document.createElement('button');
    brush.className = 'tile-btn';
    brush.dataset.tool = 'envbrush';
    brush.title = 'Environment brush: paint or erase a mix of species (presets, density, filters); one stroke is one undo step';
    brush.innerHTML = '<svg viewBox="0 0 56 56"><path d="M10 46 L18 18 L26 46Z" fill="#3f6b3a"/><circle cx="36" cy="24" r="10" fill="#5f9a46"/><path d="M34 32h4v14h-4z" fill="#7a5232"/><path d="M40 44 L52 30 L54 32 L42 46Z" fill="#e2c46a"/></svg>Environment brush';
    brush.addEventListener('click', () => this.host.useBrush());
    grid.append(brush);
    this.host.register(brush, 'envbrush', 'Environment brush', 'environment brush paint erase scatter trees plants forest biome preset');
    for (const cat of ENV_CATEGORIES) {
      const list = ENV_SPECIES.filter((s) => s.category === cat);
      if (!list.length) continue;
      this.host.heading(grid, ENV_CATEGORY_LABELS[cat]);
      for (const s of list) {
        const def = getProp(s.id);
        if (def) this.host.propCard(grid, def, `nature environment ${ENV_CATEGORY_LABELS[cat]} ${s.family}`, pictured.includes(s.id));
      }
    }
    const pane = document.createElement('div');
    pane.id = 'ed-env';
    pane.className = 'ed-env';
    grid.after(pane);
    this.renderPane(pane);
  }

  /** The brush's settings, under the Environment group's cards. */
  renderPane(el: HTMLElement = this.pane!): void {
    // Clearing the pane blurs a focused input, whose change event would render it again from inside replaceChildren.
    if (this.rendering) return;
    this.rendering = true;
    try {
      this.buildPane(el);
    } finally {
      this.rendering = false;
    }
  }

  private rendering = false;

  private buildPane(el: HTMLElement): void {
    this.pane = el;
    el.replaceChildren();
    const b = this.brush;
    const add = <T extends HTMLElement>(node: T): T => (el.append(node), node);
    const row = (label: string, control: HTMLElement, title = '') => {
      const l = document.createElement('label');
      l.className = 'stack';
      if (title) l.title = title;
      l.append(label, control);
      return add(l);
    };
    const num = (id: string, value: number | null, min: number, max: number, step: number, onChange: (v: number | null) => void, blank = '') => {
      const i = document.createElement('input');
      i.type = 'number';
      i.id = id;
      i.min = String(min);
      i.max = String(max);
      i.step = String(step);
      i.value = value === null ? '' : String(value);
      if (blank) i.placeholder = blank;
      i.addEventListener('change', () => {
        if (blank && i.value.trim() === '') return onChange(null);
        const v = Number(i.value);
        if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, v)));
      });
      return i;
    };
    const check = (id: string, label: string, title: string, value: boolean, onChange: (v: boolean) => void, parent: HTMLElement = el) => {
      const l = document.createElement('label');
      l.className = 'check';
      l.title = title;
      const i = document.createElement('input');
      i.type = 'checkbox';
      i.id = id;
      i.checked = value;
      i.addEventListener('change', () => onChange(i.checked));
      l.append(i, ` ${label}`);
      parent.append(l);
      return i;
    };
    const heading = (text: string) => {
      const h = document.createElement('div');
      h.className = 'tile-cat';
      h.textContent = text;
      return add(h);
    };
    const changed = (preset = false) => {
      if (!preset) this.preset = 'custom';
      this.renderPane();
    };

    heading('Environment brush');
    const modes = add(document.createElement('div'));
    modes.className = 'ed-row-buttons';
    for (const [m, label, title] of [
      ['paint', 'Paint', 'Paint the mix (drag for a stroke: one undo step)'],
      ['erase', 'Erase', 'Erase environment plants under the brush (right-click or Shift-drag erases too)'],
    ] as const) {
      const btn = document.createElement('button');
      btn.id = `ed-env-mode-${m}`;
      btn.textContent = label;
      btn.title = title;
      btn.classList.toggle('on', this.mode === m);
      btn.addEventListener('click', () => {
        this.mode = m;
        this.host.useBrush();
        this.renderPane();
      });
      modes.append(btn);
    }
    const preset = document.createElement('select');
    preset.id = 'ed-env-preset';
    for (const id of ENV_PRESET_IDS) preset.append(new Option(ENV_PRESETS[id].label, id, false, this.preset === id));
    preset.append(new Option('Custom mix', 'custom', false, this.preset === 'custom'));
    preset.addEventListener('change', () => {
      if (preset.value === 'custom') return;
      this.brush = withPreset(this.brush, preset.value as EnvPresetId);
      this.preset = preset.value as EnvPresetId;
      changed(true);
    });
    row('Preset', preset, 'A biome mix and the ground it suits; change any weight below to mix species from any family');
    const radius = document.createElement('input');
    radius.type = 'range';
    radius.id = 'ed-env-radius';
    radius.min = '2';
    radius.max = '40';
    radius.step = '1';
    radius.value = String(this.host.radius());
    radius.addEventListener('input', () => this.host.setRadius(Number(radius.value)));
    const rl = row('Brush size ', radius, '[ and ] resize it too');
    const rv = document.createElement('span');
    rv.id = 'ed-env-radius-v';
    rv.textContent = `${this.host.radius()} m`;
    rl.insertBefore(rv, radius);
    row('Density (plants per 100 m²)', num('ed-env-density', b.density, 0.2, 60, 0.2, (v) => ((b.density = v ?? b.density), changed())), 'How many plants a dab aims for; each species keeps its own spacing, so a dense mix of trees still stands apart');
    const seedRow = add(document.createElement('div'));
    seedRow.className = 'ed-env-seed';
    const seed = num('ed-env-seed', b.seed, 0, 2 ** 31 - 1, 1, (v) => ((b.seed = Math.round(v ?? b.seed)), this.renderPane()));
    const seedL = document.createElement('label');
    seedL.className = 'stack';
    seedL.title = 'The same seed paints the same plants on the same spot (and so does an undo and repaint)';
    seedL.append('Seed', seed);
    const reseed = document.createElement('button');
    reseed.id = 'ed-env-reseed';
    reseed.textContent = 'New seed';
    reseed.addEventListener('click', () => {
      b.seed = (b.seed * 1103515245 + 12345) % 2147483647;
      this.renderPane();
    });
    seedRow.append(seedL, reseed);
    const sizes = add(document.createElement('div'));
    sizes.className = 'ed-env-pair';
    for (const [id, label, i] of [['ed-env-size-min', 'Smallest ×', 0], ['ed-env-size-max', 'Largest ×', 1]] as const) {
      const l = document.createElement('label');
      l.className = 'stack';
      l.append(label, num(id, b.size[i], 0.25, 4, 0.05, (v) => ((b.size[i] = v ?? b.size[i]), this.renderPane())));
      sizes.append(l);
    }
    const turn = document.createElement('select');
    turn.id = 'ed-env-turn';
    for (const [deg, label] of TURNS) turn.append(new Option(label, String(deg), false, b.turn === deg));
    turn.addEventListener('change', () => (b.turn = Number(turn.value)));
    row('Turn', turn, 'Each plant turns at random within this');

    heading('Species (weights)');
    const table = add(document.createElement('div'));
    table.id = 'ed-env-species';
    table.className = 'ed-env-species';
    for (const cat of ENV_CATEGORIES) {
      for (const s of ENV_SPECIES.filter((x) => x.category === cat)) {
        const entry = b.species.find((m) => m.model === s.id) ?? (b.species.push({ model: s.id, weight: 0 }), b.species[b.species.length - 1]!);
        const line = document.createElement('div');
        line.className = 'ed-env-sp';
        line.classList.toggle('on', entry.weight > 0);
        const name = document.createElement('span');
        name.textContent = s.displayName;
        const impact = envImpact(s.id);
        name.title = `${ENV_CATEGORY_LABELS[cat]} · ${impact.movement ? 'blocks movement' : impact.sight ? 'blocks sight (you hide in it)' : 'blocks nothing'}`;
        if (impact.movement) name.classList.add('blocks');
        const w = num(`ed-env-w-${s.id}`, entry.weight, 0, 20, 0.5, (v) => ((entry.weight = v ?? 0), changed()));
        w.dataset.weight = s.id;
        const variant = document.createElement('select');
        variant.dataset.variant = s.id;
        variant.title = 'Variant';
        for (const v of s.variants) variant.append(new Option(v.name, String(v.index), false, (entry.variant ?? 0) === v.index));
        if (s.variants.length > 1) variant.append(new Option('mixed', 'any', false, entry.variant === 'any'));
        variant.disabled = s.variants.length < 2;
        variant.addEventListener('change', () => {
          entry.variant = variant.value === 'any' ? 'any' : Number(variant.value) || undefined;
          changed();
        });
        line.append(name, w, variant);
        table.append(line);
      }
    }

    heading('Where it grows');
    const slope = add(document.createElement('div'));
    slope.className = 'ed-env-pair';
    for (const [id, label, i] of [['ed-env-slope-min', 'Slope from °', 0], ['ed-env-slope-max', 'to °', 1]] as const) {
      const l = document.createElement('label');
      l.className = 'stack';
      l.title = 'Ground slope it paints on (each species also has its own steepest)';
      l.append(label, num(id, b.filters.slope[i], 0, 90, 1, (v) => ((b.filters.slope[i] = v ?? b.filters.slope[i]), this.renderPane())));
      slope.append(l);
    }
    const alt = add(document.createElement('div'));
    alt.className = 'ed-env-pair';
    for (const [id, label, i] of [['ed-env-alt-min', 'Height from m', 0], ['ed-env-alt-max', 'to m', 1]] as const) {
      const l = document.createElement('label');
      l.className = 'stack';
      l.title = 'Ground height it paints at (blank: any)';
      l.append(label, num(id, b.filters.altitude[i], -500, 2000, 0.5, (v) => ((b.filters.altitude[i] = v), this.renderPane()), 'any'));
      alt.append(l);
    }
    const mats = add(document.createElement('div'));
    mats.id = 'ed-env-mats';
    mats.className = 'ed-layers';
    mats.title = 'Terrain materials it paints on (all ticked: any)';
    for (const m of TERRAIN_MATERIALS) {
      const on = !b.filters.materials || b.filters.materials.includes(m);
      const box = check(`ed-env-mat-${m}`, TERRAIN_MATERIAL_LABELS[m], `Paint on ${TERRAIN_MATERIAL_LABELS[m].toLowerCase()}`, on, (v) => {
        const now = new Set<TerrainMaterial>(b.filters.materials ?? TERRAIN_MATERIALS);
        if (v) now.add(m);
        else now.delete(m);
        b.filters.materials = now.size === TERRAIN_MATERIALS.length ? null : TERRAIN_MATERIALS.filter((x) => now.has(x));
        changed();
      }, mats);
      box.dataset.mat = m;
    }
    check('ed-env-keepclear', 'Keep clear of spawns, routes and objectives', 'Trees, boulders, cliffs, hedges and bushes you hide in stay off spawns, paths, objectives, vehicles and pickups (grass and flowers may go anywhere)', b.filters.keepClear, (v) => {
      if (!v && !confirm('Let the brush put things that block movement or sight (trunks, boulders, cliffs, hedges, bushes) on spawns, routes and objectives?')) return this.renderPane();
      b.filters.keepClear = v;
      this.zones = null;
      this.renderPane();
    });
    check('ed-env-erase-all', 'Erase every species', 'Off: the eraser takes only the species the brush paints (weight above 0)', this.eraseAll, (v) => (this.eraseAll = v));
    check('ed-env-blockers', 'Show what blocks (collision and nav)', 'Red: stops movement (bots route round it) · orange: stops shots only (limbs overhead) · blue: you hide in it (blocks sight) · yellow: spawns and objectives kept clear', this.showBlockers, (v) => {
      this.showBlockers = v;
      this.overlayDoc = null;
      this.refresh();
    });
    const status = add(document.createElement('div'));
    status.id = 'ed-env-status';
    status.className = 'ed-note';
    this.updateStatus();
  }

  /** The brush size changed (slider, [ ]): show it. */
  syncRadius(r: number): void {
    const i = document.getElementById('ed-env-radius') as HTMLInputElement | null;
    if (i) i.value = String(r);
    const v = document.getElementById('ed-env-radius-v');
    if (v) v.textContent = `${r} m`;
  }

  /** The budget line: plants and colliding ones against the map's environment budget. */
  updateStatus(extra = ''): void {
    const el = document.getElementById('ed-env-status');
    if (!el) return;
    const c = this.host.budgets();
    el.textContent = `Plants ${c.env} / ${MAP_BUDGETS.env.placements} · colliding ${c.envColliding} / ${MAP_BUDGETS.env.colliding}${extra ? ` · ${extra}` : ''}`;
  }

  /** The brush in hand: the status line under the pointer. */
  hoverLabel(): string {
    const r = this.host.radius();
    if (this.mode === 'erase') return `Erase ${this.eraseAll ? 'every species' : 'the brush species'} · radius ${r} m`;
    const name = this.preset === 'custom' ? 'Custom mix' : ENV_PRESETS[this.preset].label;
    return `Paint ${name} · radius ${r} m · ${this.brush.density} per 100 m² · seed ${this.brush.seed}`;
  }

  /** A stroke starts (pointer down with the brush). */
  strokeStart(): void {
    this.last = null;
    this.zones = null;
    this.built = null;
    this.stroke = { added: 0, removed: 0, filtered: 0, keptClear: 0, clearOf: null, overBudget: false, ms: 0, dabs: 0 };
  }

  /** The pointer moved with the brush down: a dab once it has gone 0.8 of the radius from the last (or `first`). */
  drag(p: { x: number; z: number } | null, erase: boolean, first: boolean): void {
    if (!p) return;
    if (first) this.strokeStart();
    const r = this.host.radius();
    if (this.last && Math.hypot(p.x - this.last.x, p.z - this.last.z) < r * 0.8) return;
    this.last = { x: p.x, z: p.z };
    this.dab(p.x, p.z, erase || this.mode === 'erase');
  }

  /** One dab: paint the mix, or erase, round (x, z). */
  dab(x: number, z: number, erase: boolean): void {
    const t0 = performance.now();
    const doc = this.host.doc();
    const r = this.host.radius();
    if (erase) {
      const gone = envEraseDab(doc, x, z, r, this.eraseAll ? null : brushModels(this.brush));
      if (gone.length && this.host.run('Erase plants', { kind: 'removeEntities', entities: gone })) this.stroke.removed += gone.length;
    } else {
      const ground = this.host.ground();
      const c = this.host.budgets();
      this.zones ??= keepClearZones(doc);
      this.built ??= builtCells(doc);
      const res = envBrushDab(doc, { ...this.brush, radius: r }, x, z, {
        ground: groundSampler(ground, this.host.floorY()),
        terrain: ground,
        zones: this.zones,
        built: this.built,
        room: { placements: MAP_BUDGETS.env.placements - c.env, colliding: MAP_BUDGETS.env.colliding - c.envColliding },
      });
      const name = this.preset === 'custom' ? 'plants' : ENV_PRESETS[this.preset].label;
      if (res.plants.length && this.host.run(`Paint ${name}`, { kind: 'addEntities', entities: res.plants.map((e) => ({ ...e, id: newId('prop') })) })) this.stroke.added += res.plants.length;
      this.stroke.filtered += res.filtered;
      this.stroke.keptClear += res.keptClear;
      this.stroke.clearOf ??= res.clearOf;
      if (res.overBudget && !this.stroke.overBudget) this.host.toast('The environment budget is full: the brush stops here (see the budget bar)', true);
      this.stroke.overBudget ||= res.overBudget;
    }
    this.stroke.dabs++;
    this.stroke.ms = Math.max(this.stroke.ms, performance.now() - t0);
  }

  /** A stroke ended: say what it did. */
  strokeEnd(): void {
    const s = this.stroke;
    if (!s.dabs) return;
    const parts = [s.added ? `${s.added} painted` : '', s.removed ? `${s.removed} erased` : '', s.keptClear ? `${s.keptClear} kept clear of ${s.clearOf?.label ?? 'play'}` : ''].filter(Boolean);
    this.updateStatus(parts.join(', '));
    (window as unknown as { __envStroke?: typeof s }).__envStroke = { ...s };
    s.dabs = 0;
  }

  /**
   * Placing one species with the prop tool: fine, unless it blocks play (movement or sight) and stands on a spawn,
   * route or objective; then the author confirms.
   */
  confirmPlace(model: string, at: readonly [number, number, number], scale: number, variant?: number): boolean {
    const zone = blockingPlacement(this.host.doc(), model, at[0], at[2], scale, variant);
    if (!zone) return true;
    const s = getEnvSpecies(model);
    const what = envImpact(model, variant).movement ? 'blocks movement and sight' : 'blocks sight';
    return confirm(`${s?.displayName ?? 'This'} ${what} and would stand on the ${zone.label}. Place it anyway?`);
  }

  /** After a document change (or the toggle): rebuild the blocker overlay if it shows. Cheap when nothing changed. */
  refresh(): void {
    const doc = this.host.doc();
    if (!this.showBlockers) {
      this.overlay?.dispose();
      this.overlay = null;
      this.overlayDoc = null;
      return;
    }
    if (this.overlayDoc === doc) return;
    this.overlayDoc = doc;
    this.zones = null;
    this.overlay?.dispose();
    this.overlay = buildBlockerOverlay(this.host.scene(), doc, this.host.ground());
    this.updateStatus();
  }

  dispose(): void {
    this.overlay?.dispose();
    this.overlay = null;
  }
}

const RED = new Color4(1, 0.25, 0.2, 1);
const ORANGE = new Color4(1, 0.65, 0.15, 1);
const BLUE = new Color4(0.35, 0.65, 1, 1);
const YELLOW = new Color4(1, 0.9, 0.3, 1);

/**
 * Collision and nav preview: each environment shape's footprint (red: blocks movement, a nav obstacle; orange: shots
 * only), each hiding bush's cylinder (blue: blocks sight) and the keep-clear circles round spawns and objectives
 * (yellow), drawn on the ground. One line mesh, rebuilt only when the map changes.
 */
export function buildBlockerOverlay(scene: Scene, doc: MapDocument, ground: TerrainData | null): LinesMesh | null {
  const lines: Vector3[][] = [];
  const colors: Color4[][] = [];
  const y = (x: number, z: number, base: number) => (ground ? (terrainHeightAt(ground, x, z) ?? base) : base) + 0.15;
  const ring = (cx: number, cz: number, r: number, base: number, color: Color4, n = 20) => {
    const pts: Vector3[] = [];
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const px = cx + Math.cos(a) * r;
      const pz = cz + Math.sin(a) * r;
      pts.push(new Vector3(px, y(px, pz, base), pz));
    }
    lines.push(pts);
    colors.push(pts.map(() => color));
  };
  const outline = (pts: [number, number][], base: number, color: Color4) => {
    const h = hull(pts);
    if (h.length < 2) return;
    const line = [...h, h[0]!].map(([x, z]) => new Vector3(x, y(x, z, base), z));
    lines.push(line);
    colors.push(line.map(() => color));
  };
  for (const sh of environmentShapes(doc)) {
    const color = sh.blocks === 'all' ? RED : ORANGE;
    if (sh.kind === 'capsule') {
      const base = Math.min(sh.a[1], sh.b[1]);
      const pts: [number, number][] = [];
      for (const p of [sh.a, sh.b]) for (let i = 0; i < 10; i++) pts.push([p[0] + Math.cos((i / 10) * Math.PI * 2) * sh.r, p[2] + Math.sin((i / 10) * Math.PI * 2) * sh.r]);
      outline(pts, base, color);
    } else {
      const flat = sh.kind === 'hull' ? sh.points : sh.positions;
      const pts: [number, number][] = [];
      let base = Infinity;
      for (let i = 0; i < flat.length; i += 3) {
        pts.push([flat[i]!, flat[i + 2]!]);
        base = Math.min(base, flat[i + 1]!);
      }
      outline(pts, base, color);
    }
  }
  for (const e of doc.entities) {
    if (e.kind !== 'prop' || !e.solid) continue;
    const s = getEnvSpecies(e.model);
    if (s?.conceals) ring(e.position[0], e.position[2], s.conceals.radius * e.scale, e.position[1], BLUE, 16);
  }
  for (const z of keepClearZones(doc)) {
    if (z.kind === 'route') continue;
    const e = doc.entities.find((x) => x.id === z.id);
    if (!e) continue;
    const r = z.kind === 'spawn' ? 3 : z.kind === 'vehicle' ? 4 : z.kind === 'pickup' ? 1.5 : Math.max(3, 'radius' in e && typeof e.radius === 'number' ? e.radius : 0);
    ring(e.position[0], e.position[2], r, e.position[1], YELLOW, 28);
  }
  if (!lines.length) return null;
  const mesh = CreateLineSystem('envBlockers', { lines, colors }, scene);
  mesh.isPickable = false;
  mesh.renderingGroupId = 1;
  return mesh;
}

/** 2D convex hull (monotone chain). */
function hull(pts: [number, number][]): [number, number][] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: [number, number][] = [];
  for (const q of [...p].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, q) <= 0) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
