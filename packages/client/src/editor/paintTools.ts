import {
  applyBrush,
  applyCommand,
  EDGE_STYLE_LABELS,
  EDGE_STYLES,
  edgeGlassAt,
  faceSlot,
  GLASS_EDGES,
  GLASS_KIND_LABELS,
  paintCommand,
  resolveSurface,
  setEdgeCommand,
  setEdgeGlassCommand,
  SURFACE_SLOT_LABELS,
  TERRAIN_MATERIAL_LABELS,
  terrainMaterialFor,
  type EdgeStyle,
  type EdgeTarget,
  type GlassKind,
  type MapDocument,
  type PaintScope,
  type SurfaceSlot,
  type SurfaceStyle,
  type TerrainMaterial
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

  /** Tile and surface slot under the cursor in paint mode. */
  paintTarget(): { tile: MapDocument['classicStructure']['tiles'][number]; slot: SurfaceSlot } | null {
    const hit = this.app.hoverFace;
    if (!hit) return null;
    const tile = this.app.doc.classicStructure.tiles.find((t) => t.id === hit.box.sourceId);
    return tile ? { tile, slot: faceSlot(hit.box, hit.normal) } : null;
  }

  /**
   * The ground Paint lays on the terrain: the terrain layer closest to the brush's material (a style pack's Packed
   * Snow paints snow, Shingle gravel: terrainMaterialFor), else the Terrain tab's ground. It used to fall back to
   * the Terrain tab's ground for every pack ground, so painting Packed Snow laid dirt or grass.
   */
  get groundPaint(): TerrainMaterial {
    return terrainMaterialFor(this.paintStyle.material) ?? this.app.terrain.terrainMaterial;
  }

  /** Paint the terrain under the pointer (a brush of the Terrain tab's radius). */
  paintGroundAtHover(): void {
    const t = this.app.doc.terrain;
    const p = this.app.paintGround;
    if (!t || !p) return;
    const m = this.groundPaint;
    const after = applyBrush(t, { brush: 'paint', x: p.x, z: p.z, radius: this.app.terrain.brushRadius, strength: 1, material: m });
    if (after.materials.every((v, i) => v === t.materials[i])) return;
    this.app.run(`Paint ${TERRAIN_MATERIAL_LABELS[m].toLowerCase()} ground`, { kind: 'setTerrain', before: t, after });
  }

  paintAtHover(clear: boolean): void {
    const target = this.paintTarget();
    if (!target) return;
    const scopeLabel: Record<PaintScope, string> = { surface: '', sameType: ' (all of this piece)', level: ' (whole level)', all: ' (whole map)' };
    const label = `${clear ? 'Reset' : 'Paint'} ${SURFACE_SLOT_LABELS[target.slot].toLowerCase()}${scopeLabel[this.paintScope]}`;
    this.app.run(label, paintCommand(this.app.doc, target.tile.id, target.slot, clear ? null : this.paintStyle, this.paintScope));
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
    if (!target) return;
    const s = resolveSurface(this.app.doc, target.tile, target.slot);
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
