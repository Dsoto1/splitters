import {
  applyBrush,
  blockBox,
  boxFootprint,
  coreMaterials,
  FOLIAGE_LEVELS,
  newTerrain,
  paintSlopes,
  smoothTerrain,
  TERRAIN_BRUSHES,
  TERRAIN_MATERIAL_LABELS,
  TERRAIN_MATERIALS,
  TERRAIN_SURFACES,
  terrainHeightAt,
  terrainHoldMask,
  terrainSpacingFor,
  type EditCommand,
  type MapEntity,
  type TerrainBrush,
  type TerrainData,
  type TerrainMaterial,
  type Vec3
} from '@tiletrigger/shared';
import { materialThumbnail } from '../materials/patterns.ts';
import { openChangeGridDialog } from './changeGridDialog.ts';
import type { EditorApp } from './editorApp.ts';
import { $ } from './editorDom.ts';
import { mainGround } from './editorParts.ts';
import { type TraceImage } from './editorView.ts';

/** The Terrain tool: its brush, live sculpting strokes, whole-map smoothing, the trace image and the Terrain palette (split out of editorApp.ts, MapMaker overhaul Phase 2 item 5). */
export class TerrainTools {
  constructor(readonly app: EditorApp) {}

  terrainBrush: TerrainBrush = 'raise';
  terrainMaterial: TerrainMaterial = 'dirt';
  foliageLevel = 3;
  brushRadius = 8;
  brushStrength = 0.5;
  /** Ground point under the pointer for the terrain tool. */
  terrainHover: Vec3 | null = null;
  /**
   * Live sculpt: the document's ground before the stroke and as it is now (committed as one undo step on release),
   * and that ground kept under the floors (what the view shows and the pointer meets while the brush is dragged).
   */
  stroke: { before: TerrainData; now: TerrainData; shown: TerrainData; target: number; seed: number } | null = null;

  // ---------------------------------------------------------------- terrain

  setTerrainBrush(brush: TerrainBrush): void {
    this.terrainBrush = brush;
    this.app.setTool({ kind: 'terrain' });
    for (const b of document.querySelectorAll<HTMLElement>('[data-ground]')) b.classList.toggle('active', brush === 'paint' && b.dataset.ground === this.terrainMaterial);
    for (const b of document.querySelectorAll<HTMLElement>('[data-foliage]')) b.classList.toggle('active', brush === 'foliage' && Number(b.dataset.foliage) === this.foliageLevel);
  }

  setBrushRadius(r: number): void {
    this.brushRadius = Math.max(2, Math.min(40, r));
    for (const id of ['ed-tr-radius']) {
      $<HTMLInputElement>(id).value = String(this.brushRadius);
      $(`${id}-v`).textContent = `${this.brushRadius} m`;
    }
    this.app.env.syncRadius(this.brushRadius);
    this.app.updateHover();
  }

  startStroke(invert: boolean): void {
    const t = this.app.doc.terrain;
    if (!t || !this.terrainHover) return;
    if (invert && (this.terrainBrush === 'raise' || this.terrainBrush === 'lower')) this.terrainBrush = this.terrainBrush === 'raise' ? 'lower' : 'raise';
    // The brush works on the document's own ground; Flatten levels it to the height under the pointer as shown.
    // Flatten to the height typed in the Terrain tab, else to the height where the stroke starts.
    const typed = $<HTMLInputElement>('ed-tr-flatten-y').value.trim();
    const target = typed !== '' && Number.isFinite(Number(typed)) ? Number(typed) : this.terrainHover.y;
    this.stroke = { before: t, now: t, shown: this.app.view.ground ?? t, target, seed: (Math.random() * 1e9) | 0 };
    this.strokeStep(1 / 30);
  }

  /** Apply the brush for one frame; heights change at a steady rate however fast the pointer moves. */
  strokeStep(dt: number): void {
    const s = this.stroke!;
    const h = this.terrainHover;
    if (!h) return;
    const rate = this.brushStrength;
    const strength = this.terrainBrush === 'raise' || this.terrainBrush === 'lower' ? rate * 6 * dt : this.terrainBrush === 'roughen' ? rate * 1.5 * dt : Math.min(1, rate * 8 * dt);
    s.now = applyBrush(s.now, { brush: this.terrainBrush, x: h.x, z: h.z, radius: this.brushRadius, strength, target: s.target, material: this.terrainMaterial, level: this.foliageLevel, seed: s.seed });
    // Shown kept under the floors as it is sculpted (the paths are laid in again on release).
    s.shown = this.app.groundShownFor(s.now, false);
    this.app.view.previewTerrain({ ...this.app.viewDoc, terrain: s.shown });
    if (this.terrainBrush !== 'paint' && this.terrainBrush !== 'foliage') {
      const y = terrainHeightAt(s.shown, h.x, h.z);
      if (y !== null) this.terrainHover = { ...h, y };
    }
    this.app.updateHover();
  }

  endStroke(): void {
    const s = this.stroke;
    if (!s) return;
    this.stroke = null;
    const label = this.terrainBrush === 'paint' ? `Paint ${TERRAIN_MATERIAL_LABELS[this.terrainMaterial]}` : this.terrainBrush === 'foliage' ? `Plants: ${FOLIAGE_LEVELS[this.foliageLevel]}` : `Terrain ${this.terrainBrush}`;
    if (s.now !== s.before) this.app.run(label, { kind: 'setTerrain', before: s.before, after: s.now });
  }

  setTerrain(label: string, after: TerrainData | null): void {
    this.app.run(label, { kind: 'setTerrain', before: this.app.doc.terrain, after });
    this.setTerrainBrush(this.terrainBrush);
  }

  /**
   * Terrain → Smooth all: the whole ground smoothed in one undo step (a Gaussian of `sigma` metres: bumps and
   * pits go, slopes and hills keep their shape). With `keepUnderBlocks`, the ground under every block that
   * stands on it (bottom within 0.5 m of the ground, or below it) and 1.5 m round stays as it is, so halls on
   * levelled pads, walls and kerbs neither float nor sink; the smoothed ground meets it without a step.
   * Spawns, pickups, flags, hills, vehicles and props standing on the ground (within 30 cm over it or 1.5 m
   * into it) move up or down with it, in the same undo step.
   */
  smoothAllTerrain(sigma: number, keepUnderBlocks: boolean): void {
    const t = this.app.doc.terrain;
    if (!t || !(sigma > 0)) return;
    let hold: Uint8Array | undefined;
    if (keepUnderBlocks) {
      const feet: [number, number][][] = [];
      for (const e of this.app.doc.entities) {
        if (e.kind !== 'block') continue;
        const ground = terrainHeightAt(t, e.position[0], e.position[2]);
        if (ground === null || e.position[1] > ground + 0.5) continue;
        feet.push(boxFootprint(blockBox(e)));
      }
      hold = terrainHoldMask(t, feet, 1.5);
    }
    const after = smoothTerrain(t, sigma, hold);
    let moved = 0;
    for (let i = 0; i < t.heights.length; i++) if (after.heights[i] !== t.heights[i]) moved++;
    if (!moved) return this.app.toast('The ground is already smooth');
    const carried = new Set<MapEntity['kind']>(['spawn', 'pickup', 'prop', 'mount', 'flag', 'hill']);
    const before: MapEntity[] = [];
    const moves: MapEntity[] = [];
    // Props are bedded on the document's own ground (and drawn and played re-bedded on the ground as shown); the
    // rest stand on the ground as shown, kept under the floors, so they move as that does.
    const shownBefore = this.app.view.ground ?? t;
    const shownAfter = this.app.groundShownFor(after);
    for (const e of this.app.doc.entities) {
      if (!carried.has(e.kind)) continue;
      const was = terrainHeightAt(e.kind === 'prop' ? t : shownBefore, e.position[0], e.position[2]);
      const now = terrainHeightAt(e.kind === 'prop' ? after : shownAfter, e.position[0], e.position[2]);
      if (was === null || now === null || Math.abs(now - was) < 0.005) continue;
      const above = e.position[1] - was;
      if (above > 0.3 || above < -1.5) continue;
      before.push(e);
      moves.push({ ...e, position: [e.position[0], Math.round((e.position[1] + now - was) * 1000) / 1000, e.position[2]] } as MapEntity);
    }
    const terrainCmd: EditCommand = { kind: 'setTerrain', before: t, after };
    this.app.run('Smooth all terrain', moves.length ? { kind: 'batch', commands: [terrainCmd, { kind: 'updateEntities', before, after: moves }] } : terrainCmd);
    this.setTerrainBrush(this.terrainBrush);
    this.app.toast(`Smoothed the terrain${hold ? ' (ground under blocks kept)' : ''}${moves.length ? `; ${moves.length} things on the ground moved with it` : ''} · Ctrl+Z undoes it`);
  }

  syncTerrainUi(): void {
    const t = this.app.doc.terrain;
    $('ed-tr-create').hidden = !!t;
    $('ed-tr-edit').hidden = !t;
    if (t) {
      $<HTMLInputElement>('ed-tr-boundary').checked = t.boundary;
      $('ed-tr-size').textContent = `${((t.cols - 1) * t.spacing).toFixed(0)} × ${((t.rows - 1) * t.spacing).toFixed(0)} m · ${t.spacing} m grid`;
      $<HTMLSelectElement>('ed-tr-base').value = TERRAIN_MATERIALS[mainGround(t)] ?? 'grass';
    }
  }

  /** The trace image laid over the ground (owner, editor-only, never saved). */
  trace: TraceImage | null = null;

  setTrace(t: TraceImage | null): void {
    if (this.trace && this.trace.url !== t?.url) URL.revokeObjectURL(this.trace.url);
    this.trace = t;
    this.app.view.setTrace(t);
    const box = document.getElementById('ed-trace-place');
    if (box) box.hidden = !t;
  }

  buildTerrainPalette(): void {
    this.app.palettes.buildRealPlaceTools();
    const icons: Record<TerrainBrush, string> = {
      raise: '<path d="M6 46 Q28 6 50 46Z" fill="#8fbf5a"/><path d="M28 12v-6m-5 5l5-5 5 5" stroke="#ffd34d" stroke-width="3" fill="none"/>',
      lower: '<path d="M6 20 Q28 56 50 20V50H6Z" fill="#8a6a3f"/><path d="M28 8v10m-5-5l5 5 5-5" stroke="#ff7a4d" stroke-width="3" fill="none"/>',
      smooth: '<path d="M6 40 Q18 30 28 34 T50 32V50H6Z" fill="#8fbf5a"/><path d="M8 18 Q18 12 28 18 T48 18" stroke="#7fd8ff" stroke-width="3" fill="none"/>',
      flatten: '<path d="M6 36 L18 30 L38 30 L50 38V50H6Z" fill="#8fbf5a"/><path d="M12 22h32" stroke="#c7a6ff" stroke-width="3"/>',
      roughen: '<path d="M6 40 L12 32 L17 38 L23 26 L29 36 L35 28 L41 37 L50 30V50H6Z" fill="#7d8a5a"/>',
      paint: '<rect x="8" y="30" width="40" height="18" fill="#c9a36b"/><path d="M34 8l10 10-14 14-10-10z" fill="#dfe6ee"/><path d="M20 22l10 10-6 4-8-8z" fill="#8fbf5a"/>',
      foliage: '<rect x="6" y="40" width="44" height="10" fill="#8a6a3f"/><path d="M12 42 Q14 26 18 18 Q18 30 20 42Z M22 42 Q26 22 30 12 Q30 28 31 42Z M33 42 Q37 28 44 22 Q40 32 40 42Z" fill="#6fbf4a"/><circle cx="18" cy="16" r="3" fill="#ff6a8a"/>',
    };
    const brushes = $('ed-tr-brushes');
    for (const brush of TERRAIN_BRUSHES) {
      const b = document.createElement('button');
      b.className = 'tile-btn';
      b.dataset.tool = `terrain:${brush}`;
      const label = `${brush[0]!.toUpperCase()}${brush.slice(1)}`;
      b.innerHTML = `<svg viewBox="0 0 56 56">${icons[brush]}</svg>${label}`;
      b.addEventListener('click', () => this.setTerrainBrush(brush));
      brushes.append(b);
      this.app.palette.register(b, { key: b.dataset.tool, name: `${label} terrain`, tags: 'terrain ground sculpt brush' });
    }
    const grounds = $('ed-tr-materials');
    for (const m of TERRAIN_MATERIALS) {
      const def = coreMaterials.get(TERRAIN_SURFACES[m]);
      const b = document.createElement('button');
      b.className = 'mat-btn';
      b.dataset.ground = m;
      b.title = `Paint the ground with ${TERRAIN_MATERIAL_LABELS[m]}`;
      b.innerHTML = `${def ? `<img alt="" src="${materialThumbnail(def)}">` : ''}<span class="lbl">${TERRAIN_MATERIAL_LABELS[m]}</span>`;
      b.addEventListener('click', () => {
        this.terrainMaterial = m;
        this.setTerrainBrush('paint');
      });
      grounds.append(b);
      this.app.palette.register(b, { key: `ground:${m}`, name: `${TERRAIN_MATERIAL_LABELS[m]} ground`, tags: 'ground terrain paint material' });
    }
    const levels = $('ed-tr-foliage');
    FOLIAGE_LEVELS.forEach((label, level) => {
      const b = document.createElement('button');
      b.dataset.foliage = String(level);
      b.textContent = label;
      b.title = ['No plants', 'A few tufts of grass', 'Grass and the odd flower', 'Thick grass, flowers and shrubs', 'Long grass, flowers and bushes'][level]!;
      b.addEventListener('click', () => {
        this.foliageLevel = level;
        this.setTerrainBrush('foliage');
      });
      levels.append(b);
    });
    $('ed-tr-foliage-auto').addEventListener('click', () => {
      if (this.app.doc.terrain?.foliage.length) this.setTerrain('Plants follow the ground', { ...this.app.doc.terrain, foliage: [] });
    });
    $('ed-tr-new').addEventListener('click', () => {
      const size = Number($<HTMLSelectElement>('ed-tr-new-size').value);
      const ground = $<HTMLSelectElement>('ed-tr-new-ground').value as TerrainMaterial;
      // Width and depth, when typed, make an oblong terrain (32-400 m each way); the grid widens past 320 m.
      const side = (id: string) => {
        const v = Number($<HTMLInputElement>(id).value);
        return $<HTMLInputElement>(id).value.trim() !== '' && Number.isFinite(v) ? Math.max(32, Math.min(400, v)) : size;
      };
      const width = side('ed-tr-new-w');
      const depth = side('ed-tr-new-d');
      // Just under ground-floor tiles, so the two never fight for the same pixels.
      this.setTerrain('Create terrain', { ...newTerrain(width, terrainSpacingFor(width, depth), [0, 0], ground, depth), baseY: -0.15 });
    });
    for (const m of TERRAIN_MATERIALS) $<HTMLSelectElement>('ed-tr-new-ground').append(new Option(TERRAIN_MATERIAL_LABELS[m], m, m === 'grass', m === 'grass'));
    $('ed-tr-remove').addEventListener('click', () => {
      // Undoable like every edit (Ctrl+Z), so no question first.
      this.setTerrain('Remove terrain', null);
      this.app.toast('Terrain removed · Ctrl+Z brings it back');
    });
    for (const m of TERRAIN_MATERIALS) $<HTMLSelectElement>('ed-tr-base').append(new Option(TERRAIN_MATERIAL_LABELS[m], m));
    $('ed-tr-base-set').addEventListener('click', () => {
      const t = this.app.doc.terrain;
      if (!t) return;
      const to = TERRAIN_MATERIALS.indexOf($<HTMLSelectElement>('ed-tr-base').value as TerrainMaterial);
      const from = mainGround(t);
      if (to < 0 || to === from) return;
      // Undoable, one step: the main ground becomes the new one; cells painted another material keep it.
      this.setTerrain(`Main ground: ${TERRAIN_MATERIAL_LABELS[TERRAIN_MATERIALS[to]!]}`, { ...t, materials: t.materials.map((m) => (m === from ? to : m)) });
    });
    $('ed-tr-grid').addEventListener('click', () =>
      openChangeGridDialog({
        doc: () => this.app.doc,
        shownFor: (t) => this.app.groundShownFor(t),
        apply: (label, cmd, moved) => {
          if (!this.app.run(label, cmd)) return;
          this.setTerrainBrush(this.terrainBrush);
          this.app.toast(`${label}${moved ? `; ${moved} things on the ground moved with it` : ''} · Ctrl+Z undoes it`);
        },
        root: $('editor'),
      }),
    );
    $('ed-tr-smooth-all').addEventListener('click', () => this.smoothAllTerrain(Number($<HTMLSelectElement>('ed-tr-smooth-all-amount').value), $<HTMLInputElement>('ed-tr-smooth-hold').checked));
    $('ed-tr-cliffs').addEventListener('click', () => {
      if (this.app.doc.terrain) this.setTerrain('Paint cliffs as stone', paintSlopes(this.app.doc.terrain, 35, 'stone'));
    });
    $<HTMLInputElement>('ed-tr-boundary').addEventListener('change', (e) => {
      if (this.app.doc.terrain) this.setTerrain('Terrain boundary', { ...this.app.doc.terrain, boundary: (e.target as HTMLInputElement).checked });
    });
    $<HTMLInputElement>('ed-tr-radius').addEventListener('input', (e) => this.setBrushRadius(Number((e.target as HTMLInputElement).value)));
    $<HTMLInputElement>('ed-tr-strength').addEventListener('input', (e) => {
      this.brushStrength = Number((e.target as HTMLInputElement).value) / 100;
      $('ed-tr-strength-v').textContent = `${Math.round(this.brushStrength * 100)}%`;
    });
    this.syncTerrainUi();
  }
}
