import {
  applyCommand,
  coreCatalog,
  coreMaterials,
  EDGE_STYLE_LABELS,
  EDGE_STYLES,
  edgeGlassAt,
  emptyPaint,
  GLASS_EDGES,
  GLASS_KIND_LABELS,
  materialRefusal,
  resolveSurface,
  setEdgeCommand,
  setEdgeGlassCommand,
  structurePaintCommand,
  structurePaintTarget,
  SURFACE_SLOT_LABELS,
  targetName,
  type EdgeStyle,
  type EdgeTarget,
  type GlassKind,
  type PaintRefusal,
  type PaintScope,
  type PieceScope,
  type ResolvedStyle,
  type StructureTarget,
  type SurfaceStyle,
  type TilePlacement,
} from '@tiletrigger/shared';
import type { EditorApp } from './editorApp.ts';

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
    return own ? { material: own, tint: block.tint ?? null } : { ...resolveSurface(doc, undefined, 'solids'), tint: block.tint ?? null };
  }

  /** The status line for Structure paint: what is under the cursor, what it shows now, and what a click does. */
  label(): string {
    const t = this.paintTarget();
    if (t.kind === 'refused') return t.message;
    const now = this.currentLook(t).material.displayName;
    const brush = coreMaterials.get(this.paintStyle.material)?.displayName ?? this.paintStyle.material;
    const refusal = materialRefusal(t, this.paintStyle.material);
    const name = targetName(t, (id) => coreCatalog.get(id)?.displayName ?? id);
    if (refusal) return `${name} · now ${now} · ${refusal}`;
    const where = t.kind === 'part' ? (this.pieceScope === 'part' ? 'this part only' : `across this ${t.def.displayName}`) : t.kind === 'block' ? (this.paintScope === 'surface' ? 'this block' : 'these blocks') : SCOPE_WORDS[this.paintScope];
    return `${name} · now ${now} · click paints ${brush} ${where}`;
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

