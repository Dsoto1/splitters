import {
  applyCommand,
  coreCatalog,
  coreMaterials,
  EDGE_STYLE_LABELS,
  EDGE_STYLES,
  edgeGlassAt,
  emptyPaint,
  faceSlot,
  GROUND_REFUSAL,
  groundLayerAt,
  GLASS_EDGES,
  GLASS_KIND_LABELS,
  materialRefusal,
  resolveSurface,
  setEdgeCommand,
  setEdgeGlassCommand,
  structurePaintCommand,
  structurePaintTarget,
  surfaceLayer,
  SURFACE_SLOT_LABELS,
  targetName,
  groundThemeDef,
  type EdgeStyle,
  type EdgeTarget,
  type GlassKind,
  type GroundLayer,
  type PaintRefusal,
  type PaintScope,
  type PieceScope,
  type ResolvedStyle,
  type StructureTarget,
  type SurfaceLayers,
  type SurfaceStyle,
  type TilePlacement,
} from '@tiletrigger/shared';
import type { EditorApp } from './editorApp.ts';
import { escapeHtml } from './editorDom.ts';

/** The Paint and Walls tools: painting surfaces and the ground, building a cell side as a wall, door or window with its glass, and picking a style up (split out of editorApp.ts, MapMaker overhaul Phase 2 item 5). */
export class PaintTools {
  constructor(readonly app: EditorApp) {}

  /** Style the Walls tool builds with. */
  edgeStyle: EdgeStyle = 'window';
  /** Cell side under the pointer for the wall tool. */
  hoverEdge: EdgeTarget | null = null;
  paintStyle: SurfaceStyle = { material: 'core.red_brick', tint: null };
  paintScope: PaintScope = 'surface';

  /** On a set piece: paint the material across the piece (the owner's answer 5a, the default) or this part only. */
  pieceScope: PieceScope = 'piece';

  /**
   * What Structure paint (B) would paint under the pointer: a tile's surface, a free block, a set-piece part, or why
   * not (the ground: Ground paint is Shift+B; a prop; glass). Painting plan Phase 1.
   */
  paintTarget(): StructureTarget | PaintRefusal {
    return structurePaintTarget(this.app.doc, this.app.expansion, this.app.setPieceLib, this.app.hoverFace);
  }

  /** The look a target shows now (what Alt/I picks up, and the label's "now"). */
  currentLook(t: StructureTarget): ResolvedStyle {
    const doc = this.app.viewDoc;
    if (t.kind === 'tile') return resolveSurface(doc, t.tile, t.slot);
    if (t.kind === 'part' && t.slot) return resolveSurface(doc, t.drawn as TilePlacement, t.slot);
    const block = t.kind === 'block' ? t.block : (t.drawn as Extract<StructureTarget, { kind: 'block' }>['block']);
    const own = block.material ? coreMaterials.get(block.material) : undefined;
    // An unpainted block shows the theme's floor on top and its underside elsewhere (as it is drawn).
    const face = this.app.hoverFace;
    return own ? { material: own, tint: block.tint ?? null } : resolveSurface(doc, undefined, face ? faceSlot(face.box, face.normal) : 'solids');
  }

  /** The layers under the cursor: base Structure theme → set piece look → your paint, the one shown marked (painting Phase 2). */
  layers(t: StructureTarget): SurfaceLayers {
    const face = this.app.hoverFace;
    return surfaceLayer(this.app.doc, this.app.setPieceLib, t, face ? faceSlot(face.box, face.normal) : undefined);
  }

  /**
   * What Structure paint says about the pointer: what is under it, the layers its look comes from, and what a click
   * does (or why not). The status line and the card by the cursor both show it.
   */
  describe(): { name: string; layers: SurfaceLayers | null; click: string; bad: boolean } {
    const t = this.paintTarget();
    if (t.kind === 'refused') {
      if (t.reason === 'ground') {
        const ground = this.groundUnder();
        return { name: ground ? `Ground · ${ground}` : 'Ground', layers: null, click: `Structure paint doesn't paint the ground. A click does nothing. ${GROUND_REFUSAL.replace("Structure paint doesn't paint the ground. ", '')}`, bad: true };
      }
      return { name: t.message.split(':')[0]!, layers: null, click: t.message, bad: true };
    }
    const layers = this.layers(t);
    const name = targetName(t, (id) => coreCatalog.get(id)?.displayName ?? id);
    const brush = coreMaterials.get(this.paintStyle.material)?.displayName ?? this.paintStyle.material;
    const refusal = materialRefusal(t, this.paintStyle.material);
    if (refusal) return { name, layers, click: refusal, bad: true };
    const where = t.kind === 'part' ? (this.pieceScope === 'part' ? 'on this surface only' : `across this ${t.def.displayName}`) : t.kind === 'block' ? (this.paintScope === 'surface' ? 'on this block' : 'on these blocks') : SCOPE_WORDS[this.paintScope];
    const shown = layerStyle(layers);
    // Right-click takes your paint off: the look below shows (the set piece's look, else the theme).
    const below = layers.look.style ? 'the look' : 'the theme';
    return { name, layers, click: `Click paints ${brush} ${where}. Alt+click picks up ${shown}. Right-click resets to ${below}.`, bad: false };
  }

  /** The ground layer under the pointer (Structure paint over bare ground names it), as "Gravel (Ground theme: Quarry)". */
  groundUnder(): string | null {
    const t = this.app.doc.terrain;
    const p = this.app.hoverPoint;
    const g = t && p ? groundLayerAt(t, p.x, p.z) : null;
    return g ? groundWords(g) : null;
  }

  /** The status line for Structure paint: what is under the cursor, its layers (the one shown ✓), and what a click does. */
  label(): string {
    const d = this.describe();
    if (!d.layers) return d.name.startsWith('Ground') ? `${d.name} · ${GROUND_REFUSAL}` : d.click;
    return `${d.name} · ${chainText(d.layers)} · ${d.click}`;
  }

  /** The card by the cursor (HTML): the surface, the three layers as chips with the shown one marked, and the click. */
  card(): { title: string; html: string; tone: string } {
    const d = this.describe();
    const [first, ...rest] = d.name.split(' · ');
    const what = d.layers ? d.layers.surface : first;
    const head = `<b><span class="ed-surface">${escapeHtml(what!)}</span>${rest.length ? ` · ${escapeHtml(rest.join(' · '))}` : ''}</b>`;
    const chain = d.layers
      ? `<div class="ed-chain">${(['base', 'look', 'paint'] as const)
          .map((k) => {
            const l = d.layers![k];
            const value = l.style ? `${l.style.material.displayName}${l.style.tint ? ` (${l.style.tint})` : ''}` : 'none';
            // A layer that gives nothing says only "none" (or why: not a set piece).
            const source = l.style || k === 'look' ? l.source : '';
            return `<span class="ed-layer ${k}${d.layers!.winner === k ? ' shown' : ''}${l.style ? '' : ' none'}" data-layer="${k}"><small>${escapeHtml(l.title)}</small>${source && source !== 'none' ? `<small>${escapeHtml(source)}</small>` : ''}<em>${escapeHtml(value)}</em></span>`;
          })
          .join('<i>→</i>')}</div>`
      : '';
    return { title: d.name, html: `${head}${chain}<span class="ed-click${d.bad ? ' bad' : ''}">${escapeHtml(d.click)}</span>`, tone: d.bad ? 'bad' : 'pick' };
  }

  paintAtHover(clear: boolean, first = true): void {
    const target = this.paintTarget();
    if (target.kind === 'refused') {
      // Says so (once a stroke): nothing is painted.
      if (first) this.app.toast(target.message, target.reason !== 'ground');
      return;
    }
    if (!clear) {
      const refusal = materialRefusal(target, this.paintStyle.material);
      if (refusal) {
        if (first) this.app.toast(refusal, true);
        return;
      }
    }
    const cmd = structurePaintCommand(this.app.doc, target, clear ? null : this.paintStyle, this.paintScope, this.pieceScope);
    if (emptyPaint(cmd)) return;
    this.app.run(paintLabel(target, clear, this.paintScope, this.pieceScope), cmd);
  }

  /** Glass the wall tool puts in windows, twin windows and firing slits (none, breakable or reinforced). */
  edgeGlass: GlassKind | null = null;

  /** Wall tool: build the hovered cell side in the given style (windows get the chosen glass, or none). */
  edgeAtHover(style: EdgeStyle): void {
    const target = this.hoverEdge;
    if (!target) return;
    this.setEdge(target, style, this.edgeGlass);
  }

  /** Build a side in `style`, with `glass` in its window (the Walls tool and the inspector alike). */
  setEdge(target: EdgeTarget, style: EdgeStyle, glass: GlassKind | null): void {
    const cmd = setEdgeCommand(this.app.doc, target, style);
    if ('error' in cmd) return this.app.toast(cmd.error, true);
    // Glass goes with the window: set (or clear) it in the same undo step.
    const glazed = GLASS_EDGES.has(style as never) ? glass : null;
    const glassCmd = setEdgeGlassCommand(applyCommand(this.app.doc, cmd), target, glazed);
    const label = style === 'auto' ? 'Reset wall' : `Wall: ${EDGE_STYLE_LABELS[style]}${glazed ? ` (${GLASS_KIND_LABELS[glazed].toLowerCase()} glass)` : ''}`;
    const had = edgeGlassAt(this.app.doc, target);
    this.app.run(label, 'error' in glassCmd || (!glazed && !had) ? cmd : { kind: 'batch', commands: [cmd, glassCmd] });
  }

  /** Eyedropper: copy the hovered surface's effective style into the brush. */
  pickStyleAtHover(): void {
    const target = this.paintTarget();
    if (target.kind === 'refused') return this.app.toast(target.message, target.reason !== 'ground');
    const s = this.currentLook(target);
    this.paintStyle = { material: s.material.id, tint: s.tint };
    this.app.palettes.syncPaintUi();
    this.app.toast(`Picked ${s.material.displayName}${s.tint ? ` tinted ${s.tint}` : ''}`);
  }

  // ---------------------------------------------------------------- UI

  /** Walls & Openings tool; `cycle` moves on to the next style. */
  wallsTool(cycle: boolean): void {
    const styles = EDGE_STYLES.filter((x) => x !== 'auto');
    const now = this.app.tool.kind === 'edge' ? this.app.tool.style : this.edgeStyle;
    const next = cycle ? styles[(styles.indexOf(now as (typeof styles)[number]) + 1) % styles.length]! : now;
    this.app.setTool({ kind: 'edge', style: next });
  }
}

/** The shown layer's material name. */
const layerStyle = (l: SurfaceLayers): string => {
  const s = l[l.winner].style;
  return s?.material.displayName ?? 'its look';
};

/** The chain as words: "Structure theme Imperial Arena: Opus → Set piece look Imperial (the theme's): Marble ✓ → Your paint: none". */
export function chainText(l: SurfaceLayers): string {
  return (['base', 'look', 'paint'] as const)
    .map((k) => {
      const step = l[k];
      const value = step.style?.material.displayName ?? 'none';
      const from = k === 'paint' || !step.style ? '' : ` ${step.source}`;
      return `${step.title}${from}: ${value}${l.winner === k ? ' ✓' : ''}`;
    })
    .join(' → ');
}

/** A ground layer as words: "Gravel (Ground theme: Quarry)" or "Sand (painted; Ground theme Quarry: Gravel)". */
export function groundWords(g: GroundLayer): string {
  const name = (id: string) => coreMaterials.get(id)?.displayName ?? id;
  const theme = groundThemeDef(g.theme).displayName;
  return g.painted ? `${name(g.material)} (painted; Ground theme ${theme}: ${name(g.base)})` : `${name(g.material)} (Ground theme: ${theme})`;
}

const SCOPE_WORDS: Record<PaintScope, string> = { surface: 'on this surface', sameType: 'on every piece of this type', level: 'on this level', all: 'on the whole map' };

/** The undo label: "Paint walls", "Paint block", "Paint paving across Cage Block", "Reset metal (part of Cage Block)". */
function paintLabel(t: StructureTarget, clear: boolean, scope: PaintScope, pieceScope: PieceScope): string {
  const verb = clear ? 'Reset' : 'Paint';
  if (t.kind === 'block') return `${verb} block${scope === 'surface' ? '' : 's'}`;
  if (t.kind === 'tile') {
    const scopeLabel: Record<PaintScope, string> = { surface: '', sameType: ' (all of this piece)', level: ' (whole level)', all: ' (whole map)' };
    return `${verb} ${SURFACE_SLOT_LABELS[t.slot].toLowerCase()}${scopeLabel[scope]}`;
  }
  const what = t.slot ? SURFACE_SLOT_LABELS[t.slot].toLowerCase() : 'block';
  return pieceScope === 'part' ? `${verb} ${what} (part of ${t.def.displayName})` : `${verb} ${what} across ${t.def.displayName}`;
}

